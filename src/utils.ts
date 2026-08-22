export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeAddress(address: string) {
  return address
    .trim()
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function parseCoordinate(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function splitList(value: string | undefined) {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readColumn(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const normalized = normalizeHeader(name);
    const value = row[normalized];
    if (value?.trim()) return value.trim();
  }
  return "";
}

export const tagPalette = [
  "#0f766e",
  "#b91c1c",
  "#2563eb",
  "#a16207",
  "#7c3aed",
  "#15803d",
  "#be123c",
  "#0369a1",
];
