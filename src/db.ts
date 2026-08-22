import Dexie, { type Table } from "dexie";
import type { AddressIndexEntry, Home, Resident, Tag, WardBoundary } from "./types";

type MetaRecord =
  | { key: "wardBoundary"; value: WardBoundary | null }
  | { key: "setupLoadedAt"; value: string };

class WardMapDatabase extends Dexie {
  homes!: Table<Home, string>;
  residents!: Table<Resident, string>;
  tags!: Table<Tag, string>;
  addressIndex!: Table<AddressIndexEntry, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super("northshoreWardMap");
    this.version(1).stores({
      homes: "id, label, address",
      residents: "id, homeId, name",
      tags: "id, name",
      addressIndex: "id, normalizedAddress",
      meta: "key",
    });
  }
}

export const db = new WardMapDatabase();

export async function loadWardBoundary() {
  const record = await db.meta.get("wardBoundary");
  return (record?.value as WardBoundary | null | undefined) ?? null;
}

export async function saveWardBoundary(boundary: WardBoundary | null) {
  await db.meta.put({ key: "wardBoundary", value: boundary });
}

export async function loadAllLocalData() {
  const [homes, residents, tags, addressIndex, wardBoundary] = await Promise.all([
    db.homes.toArray(),
    db.residents.toArray(),
    db.tags.toArray(),
    db.addressIndex.toArray(),
    loadWardBoundary(),
  ]);

  return { homes, residents, tags, addressIndex, wardBoundary };
}
