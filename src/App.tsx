import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  Home as HomeIcon,
  Import,
  MapPinned,
  MousePointer2,
  PencilRuler,
  Plus,
  Search,
  Settings,
  Tag as TagIcon,
  Trash2,
  Upload,
  Users,
  WifiOff,
} from "lucide-react";
import MapCanvas from "./MapCanvas";
import { db, loadAllLocalData, saveWardBoundary } from "./db";
import { isPointInsideBoundary, normalizeBoundary } from "./geometry";
import { addressIndexFromRows, importResidentsAndHomes, parseLocalCsv } from "./csv";
import { loadSetupData } from "./setupData";
import type { AddressIndexEntry, Home, ImportIssue, ImportSummary, Resident, Tag, WardBoundary } from "./types";
import { createId, normalizeAddress, nowIso, parseCoordinate, tagPalette } from "./utils";

type Notice = { tone: "good" | "warn" | "bad"; message: string };

function summarizeImport(summary: ImportSummary) {
  return `Imported ${summary.createdHomes} homes, ${summary.createdResidents} residents, and ${summary.createdTags} tags. ${summary.issues.length} rows need review.`;
}

export default function App() {
  const [setupMode, setSetupMode] = useState(true);
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [addHomeByClick, setAddHomeByClick] = useState(false);
  const [wardBoundary, setWardBoundary] = useState<WardBoundary | null>(null);
  const [boundaryDraft, setBoundaryDraft] = useState<WardBoundary | null>(null);
  const [homes, setHomes] = useState<Home[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [addressIndex, setAddressIndex] = useState<AddressIndexEntry[]>([]);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [homeForm, setHomeForm] = useState({ label: "", address: "", lat: "", lng: "" });
  const [residentName, setResidentName] = useState("");
  const [tagName, setTagName] = useState("");
  const [addressSearch, setAddressSearch] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      const [setupData, localData] = await Promise.all([loadSetupData(), loadAllLocalData()]);
      setWardBoundary(localData.wardBoundary ?? setupData.wardBoundary);
      setHomes(localData.homes);
      setResidents(localData.residents);
      setTags(localData.tags);

      if (localData.addressIndex.length > 0) {
        setAddressIndex(localData.addressIndex);
      } else {
        setAddressIndex(setupData.addressIndex);
        if (setupData.addressIndex.length > 0) {
          await db.addressIndex.bulkPut(setupData.addressIndex);
        }
      }

      if (!localData.wardBoundary && setupData.wardBoundary) {
        await saveWardBoundary(setupData.wardBoundary);
      }
    }

    loadInitialData().catch((error) => {
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "Could not load local data." });
    });
  }, []);

  const selectedHome = homes.find((home) => home.id === selectedHomeId) ?? null;
  const selectedResidents = residents.filter((resident) => resident.homeId === selectedHomeId);
  const selectedTags = selectedHome ? tags.filter((tag) => selectedHome.tagIds.includes(tag.id)) : [];
  const matchingAddresses = useMemo(() => {
    const query = normalizeAddress(addressSearch);
    if (!query) return addressIndex.slice(0, 8);
    return addressIndex.filter((entry) => entry.normalizedAddress.includes(query) || entry.label?.toLowerCase().includes(query)).slice(0, 8);
  }, [addressIndex, addressSearch]);

  async function persistHomes(nextHomes: Home[]) {
    setHomes(nextHomes);
    await db.homes.bulkPut(nextHomes);
  }

  async function persistTags(nextTags: Tag[]) {
    setTags(nextTags);
    await db.tags.bulkPut(nextTags);
  }

  async function persistResidents(nextResidents: Resident[]) {
    setResidents(nextResidents);
    await db.residents.bulkPut(nextResidents);
  }

  async function handleBoundaryFile(file: File) {
    const text = await file.text();
    const boundary = normalizeBoundary(JSON.parse(text));
    setWardBoundary(boundary);
    setBoundaryDraft(boundary);
    await saveWardBoundary(boundary);
    setNotice({ tone: "good", message: "Boundary imported and saved locally." });
  }

  async function saveDrawnBoundary() {
    if (!boundaryDraft) {
      setNotice({ tone: "warn", message: "Draw or edit a polygon before saving the boundary." });
      return;
    }
    setWardBoundary(boundaryDraft);
    await saveWardBoundary(boundaryDraft);
    setDrawEnabled(false);
    setNotice({ tone: "good", message: "Drawn boundary saved locally." });
  }

  async function handleAddressIndexFile(file: File) {
    const rows = await parseLocalCsv(file);
    const result = addressIndexFromRows(rows);
    const nextIndex = [...addressIndex, ...result.entries];
    setAddressIndex(nextIndex);
    setIssues(result.issues);
    await db.addressIndex.bulkPut(result.entries);
    setNotice({
      tone: result.issues.length ? "warn" : "good",
      message: `Loaded ${result.entries.length} setup addresses. ${result.issues.length} rows need review.`,
    });
  }

  async function addHomeAt(lng: number, lat: number, source?: Partial<Home>) {
    if (!isPointInsideBoundary(lng, lat, wardBoundary)) {
      setNotice({ tone: "bad", message: "That location is outside the ward boundary." });
      return;
    }

    const timestamp = nowIso();
    const home: Home = {
      id: createId("home"),
      label: source?.label || `Home ${homes.length + 1}`,
      address: source?.address,
      lat,
      lng,
      tagIds: source?.tagIds ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const nextHomes = [...homes, home];
    await persistHomes(nextHomes);
    setSelectedHomeId(home.id);
    setNotice({ tone: "good", message: "Home added locally." });
  }

  async function addManualHome() {
    const lat = parseCoordinate(homeForm.lat);
    const lng = parseCoordinate(homeForm.lng);
    if (lat === null || lng === null) {
      setNotice({ tone: "bad", message: "Manual homes need latitude and longitude." });
      return;
    }
    await addHomeAt(lng, lat, { label: homeForm.label || undefined, address: homeForm.address || undefined });
    setHomeForm({ label: "", address: "", lat: "", lng: "" });
  }

  async function addHomeFromAddress(entry: AddressIndexEntry) {
    await addHomeAt(entry.lng, entry.lat, { label: entry.label || entry.address, address: entry.address });
  }

  async function handleResidentCsv(file: File) {
    const rows = await parseLocalCsv(file);
    const result = importResidentsAndHomes({ rows, homes, residents, tags, addressIndex, wardBoundary });
    setHomes(result.homes);
    setResidents(result.residents);
    setTags(result.tags);
    setIssues(result.summary.issues);
    await Promise.all([db.homes.bulkPut(result.homes), db.residents.bulkPut(result.residents), db.tags.bulkPut(result.tags)]);
    setNotice({ tone: result.summary.issues.length ? "warn" : "good", message: summarizeImport(result.summary) });
  }

  async function addResident() {
    if (!selectedHome || !residentName.trim()) return;
    const resident: Resident = {
      id: createId("resident"),
      homeId: selectedHome.id,
      name: residentName.trim(),
      source: "manual",
      createdAt: nowIso(),
    };
    await persistResidents([...residents, resident]);
    setResidentName("");
  }

  async function addTagToHome() {
    if (!selectedHome || !tagName.trim()) return;
    const existing = tags.find((tag) => tag.name.toLowerCase() === tagName.trim().toLowerCase());
    const tag =
      existing ??
      ({
        id: createId("tag"),
        name: tagName.trim(),
        color: tagPalette[tags.length % tagPalette.length],
        priority: tags.length,
      } satisfies Tag);
    const nextTags = existing ? tags : [...tags, tag];
    const nextHomes = homes.map((home) =>
      home.id === selectedHome.id
        ? { ...home, tagIds: [...new Set([...home.tagIds, tag.id])], updatedAt: nowIso() }
        : home,
    );
    await Promise.all([persistTags(nextTags), persistHomes(nextHomes)]);
    setTagName("");
  }

  async function deleteSelectedHome() {
    if (!selectedHome) return;
    const nextHomes = homes.filter((home) => home.id !== selectedHome.id);
    const nextResidents = residents.filter((resident) => resident.homeId !== selectedHome.id);
    setSelectedHomeId(null);
    setHomes(nextHomes);
    setResidents(nextResidents);
    await Promise.all([db.homes.delete(selectedHome.id), db.residents.bulkDelete(selectedResidents.map((resident) => resident.id))]);
  }

  async function exportLocalData() {
    const payload = {
      wardBoundary,
      homes,
      residents,
      tags,
      addressIndex,
      exportedAt: nowIso(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "northshore-ward-map-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function resetLocalData() {
    if (!window.confirm("Reset all locally stored ward map data in this browser?")) return;
    await Promise.all([db.homes.clear(), db.residents.clear(), db.tags.clear(), db.addressIndex.clear(), saveWardBoundary(null)]);
    setWardBoundary(null);
    setBoundaryDraft(null);
    setHomes([]);
    setResidents([]);
    setTags([]);
    setAddressIndex([]);
    setSelectedHomeId(null);
    setIssues([]);
    setNotice({ tone: "good", message: "Local browser data reset." });
  }

  return (
    <main className="app-shell">
      <section className="sidebar">
        <header className="brand">
          <div className="brand-mark">
            <MapPinned size={22} />
          </div>
          <div>
            <h1>Northshore Ward Map</h1>
            <p><WifiOff size={14} /> Offline runtime</p>
          </div>
        </header>

        <div className="mode-switch" role="tablist" aria-label="Mode">
          <button className={setupMode ? "active" : ""} onClick={() => setSetupMode(true)}>
            <Settings size={16} /> Setup
          </button>
          <button className={!setupMode ? "active" : ""} onClick={() => setSetupMode(false)}>
            <HomeIcon size={16} /> Runtime
          </button>
        </div>

        {notice && <div className={`notice ${notice.tone}`}>{notice.message}</div>}

        {setupMode ? (
          <div className="panel-stack">
            <section className="panel">
              <h2><PencilRuler size={17} /> Ward Boundary</h2>
              <label className="file-action">
                <Upload size={16} />
                Import GeoJSON
                <input type="file" accept=".json,.geojson,application/geo+json,application/json" onChange={(event) => event.target.files?.[0] && handleBoundaryFile(event.target.files[0])} />
              </label>
              <button className={drawEnabled ? "primary" : ""} onClick={() => setDrawEnabled((value) => !value)}>
                <MousePointer2 size={16} /> {drawEnabled ? "Drawing Enabled" : "Draw/Edit Boundary"}
              </button>
              <button onClick={saveDrawnBoundary}>
                <Check size={16} /> Save Drawn Boundary
              </button>
            </section>

            <section className="panel">
              <h2><Search size={17} /> Local Address Index</h2>
              <label className="file-action">
                <Import size={16} />
                Import Address CSV
                <input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && handleAddressIndexFile(event.target.files[0])} />
              </label>
              <p className="stat">{addressIndex.length} local addresses available for offline matching</p>
            </section>

            <section className="panel">
              <h2><Trash2 size={17} /> Local Data</h2>
              <button className="danger" onClick={resetLocalData}>
                <Trash2 size={16} /> Reset Local Data
              </button>
            </section>
          </div>
        ) : (
          <div className="panel-stack">
            <section className="panel">
              <h2><Plus size={17} /> Add Homes</h2>
              <button className={addHomeByClick ? "primary" : ""} onClick={() => setAddHomeByClick((value) => !value)}>
                <MousePointer2 size={16} /> {addHomeByClick ? "Click Map to Add" : "Add by Map Click"}
              </button>
              <div className="input-grid">
                <input placeholder="Label" value={homeForm.label} onChange={(event) => setHomeForm({ ...homeForm, label: event.target.value })} />
                <input placeholder="Address" value={homeForm.address} onChange={(event) => setHomeForm({ ...homeForm, address: event.target.value })} />
                <input placeholder="Latitude" value={homeForm.lat} onChange={(event) => setHomeForm({ ...homeForm, lat: event.target.value })} />
                <input placeholder="Longitude" value={homeForm.lng} onChange={(event) => setHomeForm({ ...homeForm, lng: event.target.value })} />
              </div>
              <button onClick={addManualHome}><Plus size={16} /> Add Manual Home</button>
            </section>

            <section className="panel">
              <h2><Search size={17} /> Local Address Lookup</h2>
              <input placeholder="Search shipped address index" value={addressSearch} onChange={(event) => setAddressSearch(event.target.value)} />
              <div className="address-list">
                {matchingAddresses.map((entry) => (
                  <button key={entry.id} onClick={() => addHomeFromAddress(entry)}>
                    <span>{entry.label || entry.address}</span>
                    <small>{entry.address}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2><Users size={17} /> CSV Import</h2>
              <label className="file-action">
                <Import size={16} />
                Import Residents/Homes CSV
                <input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && handleResidentCsv(event.target.files[0])} />
              </label>
            </section>
          </div>
        )}

        <section className="panel details">
          <h2><HomeIcon size={17} /> Selected Home</h2>
          {selectedHome ? (
            <>
              <div className="home-title">
                <strong>{selectedHome.label}</strong>
                <span>{selectedHome.address || "No address"}</span>
              </div>
              <div className="chips">
                {selectedTags.map((tag) => (
                  <span key={tag.id} style={{ "--chip-color": tag.color } as React.CSSProperties}>{tag.name}</span>
                ))}
              </div>
              <div className="inline-form">
                <input placeholder="Resident name" value={residentName} onChange={(event) => setResidentName(event.target.value)} />
                <button onClick={addResident}><Users size={16} /></button>
              </div>
              <div className="inline-form">
                <input placeholder="Tag" value={tagName} onChange={(event) => setTagName(event.target.value)} />
                <button onClick={addTagToHome}><TagIcon size={16} /></button>
              </div>
              <ul className="resident-list">
                {selectedResidents.map((resident) => <li key={resident.id}>{resident.name}</li>)}
              </ul>
              <button className="danger" onClick={deleteSelectedHome}><Trash2 size={16} /> Delete Selected Home</button>
            </>
          ) : (
            <p className="muted">Select a home marker to edit residents and tags.</p>
          )}
        </section>

        {issues.length > 0 && (
          <section className="panel issue-panel">
            <h2>Rows Needing Review</h2>
            {issues.slice(0, 5).map((issue) => (
              <p key={`${issue.rowNumber}-${issue.reason}`}><strong>Row {issue.rowNumber}:</strong> {issue.reason}</p>
            ))}
          </section>
        )}

        <footer className="sidebar-footer">
          <button onClick={exportLocalData}><Download size={16} /> Export Backup</button>
          <span>{homes.length} homes · {residents.length} residents · {tags.length} tags</span>
        </footer>
      </section>

      <section className="map-area">
        <MapCanvas
          wardBoundary={wardBoundary}
          homes={homes}
          tags={tags}
          setupMode={setupMode}
          drawEnabled={drawEnabled}
          addHomeByClick={addHomeByClick}
          selectedHomeId={selectedHomeId}
          onBoundaryDraft={setBoundaryDraft}
          onHomeClick={setSelectedHomeId}
          onMapHomeClick={(lng, lat) => addHomeAt(lng, lat)}
          onMapError={(message) => setNotice({ tone: "warn", message })}
        />
        {!wardBoundary && (
          <div className="map-empty">
            <PencilRuler size={20} />
            Import or draw a ward boundary in setup mode.
          </div>
        )}
      </section>
    </main>
  );
}
