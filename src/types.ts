import type { Feature, MultiPolygon, Polygon } from "geojson";

export type WardGeometry = Polygon | MultiPolygon;
export type WardBoundary = Feature<WardGeometry, { name?: string; source?: string }>;

export type Tag = {
  id: string;
  name: string;
  color: string;
  priority: number;
};

export type Resident = {
  id: string;
  homeId: string;
  name: string;
  source?: string;
  createdAt: string;
};

export type Home = {
  id: string;
  label: string;
  address?: string;
  lat: number;
  lng: number;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AddressIndexEntry = {
  id: string;
  label?: string;
  address: string;
  normalizedAddress: string;
  lat: number;
  lng: number;
  source: string;
};

export type SetupData = {
  wardBoundary: WardBoundary | null;
  addressIndex: AddressIndexEntry[];
  generatedAt: string | null;
  notes?: string;
};

export type ImportIssue = {
  rowNumber: number;
  reason: string;
  row: Record<string, string>;
};

export type ImportSummary = {
  createdHomes: number;
  updatedHomes: number;
  createdResidents: number;
  createdTags: number;
  issues: ImportIssue[];
};
