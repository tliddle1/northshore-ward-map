import Papa from "papaparse";
import type { AddressIndexEntry, Home, ImportIssue, ImportSummary, Resident, Tag } from "./types";
import { createId, normalizeAddress, normalizeHeader, nowIso, parseCoordinate, readColumn, splitList, tagPalette } from "./utils";
import { isPointInsideBoundary } from "./geometry";
import type { WardBoundary } from "./types";

export function parseLocalCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      transform: (value) => value.trim(),
      complete: (result) => resolve(result.data),
      error: reject,
    });
  });
}

export function addressIndexFromRows(rows: Record<string, string>[]) {
  const entries: AddressIndexEntry[] = [];
  const issues: ImportIssue[] = [];

  rows.forEach((row, index) => {
    const address = readColumn(row, ["address", "street_address", "home_address"]);
    const label = readColumn(row, ["label", "home_label", "name"]);
    const lat = parseCoordinate(readColumn(row, ["lat", "latitude"]));
    const lng = parseCoordinate(readColumn(row, ["lng", "lon", "longitude"]));

    if (!address || lat === null || lng === null) {
      issues.push({
        rowNumber: index + 2,
        reason: "Address index rows need address, latitude, and longitude.",
        row,
      });
      return;
    }

    entries.push({
      id: createId("addr"),
      label: label || address,
      address,
      normalizedAddress: normalizeAddress(address),
      lat,
      lng,
      source: "setup-csv",
    });
  });

  return { entries, issues };
}

type ImportInput = {
  rows: Record<string, string>[];
  homes: Home[];
  tags: Tag[];
  residents: Resident[];
  addressIndex: AddressIndexEntry[];
  wardBoundary: WardBoundary | null;
};

export function importResidentsAndHomes(input: ImportInput) {
  const homes = [...input.homes];
  const tags = [...input.tags];
  const residents = [...input.residents];
  const issues: ImportIssue[] = [];
  let createdHomes = 0;
  let updatedHomes = 0;
  let createdResidents = 0;
  let createdTags = 0;

  const homesById = new Map(homes.map((home) => [home.id, home]));
  const homesByLabel = new Map(homes.map((home) => [home.label.trim().toLowerCase(), home]));
  const addresses = new Map(input.addressIndex.map((entry) => [entry.normalizedAddress, entry]));
  const tagsByName = new Map(tags.map((tag) => [tag.name.trim().toLowerCase(), tag]));

  const ensureTag = (name: string) => {
    const key = name.trim().toLowerCase();
    const existing = tagsByName.get(key);
    if (existing) return existing;

    const tag: Tag = {
      id: createId("tag"),
      name,
      color: tagPalette[tags.length % tagPalette.length],
      priority: tags.length,
    };
    tags.push(tag);
    tagsByName.set(key, tag);
    createdTags += 1;
    return tag;
  };

  input.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const residentName = readColumn(row, ["resident", "resident_name", "person", "person_name", "name"]);
    const homeId = readColumn(row, ["home_id", "id"]);
    const homeLabel = readColumn(row, ["home_label", "label", "household"]);
    const address = readColumn(row, ["address", "street_address", "home_address"]);
    const lat = parseCoordinate(readColumn(row, ["lat", "latitude"]));
    const lng = parseCoordinate(readColumn(row, ["lng", "lon", "longitude"]));
    const tagNames = splitList(readColumn(row, ["tags", "tag"]));

    let home = homeId ? homesById.get(homeId) : undefined;
    if (!home && homeLabel) home = homesByLabel.get(homeLabel.trim().toLowerCase());

    if (!home) {
      const indexedAddress = address ? addresses.get(normalizeAddress(address)) : undefined;
      const homeLat = lat ?? indexedAddress?.lat ?? null;
      const homeLng = lng ?? indexedAddress?.lng ?? null;

      if (homeLat === null || homeLng === null) {
        issues.push({
          rowNumber,
          reason: "No matching home, known local address, or latitude/longitude was found.",
          row,
        });
        return;
      }

      if (!isPointInsideBoundary(homeLng, homeLat, input.wardBoundary)) {
        issues.push({
          rowNumber,
          reason: "The home coordinate is outside the ward boundary.",
          row,
        });
        return;
      }

      const timestamp = nowIso();
      home = {
        id: createId("home"),
        label: homeLabel || indexedAddress?.label || address || `Home ${homes.length + 1}`,
        address: address || indexedAddress?.address,
        lat: homeLat,
        lng: homeLng,
        tagIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      homes.push(home);
      homesById.set(home.id, home);
      homesByLabel.set(home.label.trim().toLowerCase(), home);
      createdHomes += 1;
    }

    const startingTags = home.tagIds.length;
    const nextTagIds = new Set(home.tagIds);
    tagNames.forEach((tagName) => nextTagIds.add(ensureTag(tagName).id));
    home.tagIds = [...nextTagIds];
    if (home.tagIds.length !== startingTags) {
      home.updatedAt = nowIso();
      updatedHomes += 1;
    }

    if (residentName) {
      residents.push({
        id: createId("resident"),
        homeId: home.id,
        name: residentName,
        source: "csv",
        createdAt: nowIso(),
      });
      createdResidents += 1;
    }
  });

  const summary: ImportSummary = {
    createdHomes,
    updatedHomes,
    createdResidents,
    createdTags,
    issues,
  };

  return { homes, tags, residents, summary };
}
