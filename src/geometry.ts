import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import type { WardBoundary, WardGeometry } from "./types";

type BoundaryInput =
  | WardBoundary
  | Feature<Geometry>
  | FeatureCollection<Geometry>
  | Polygon
  | MultiPolygon
  | Geometry;

function isFeatureCollection(input: BoundaryInput): input is FeatureCollection<Geometry> {
  return input.type === "FeatureCollection";
}

function isFeature(input: BoundaryInput): input is Feature<Geometry> {
  return input.type === "Feature";
}

function isWardGeometry(geometry: Geometry | null | undefined): geometry is WardGeometry {
  return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}

function samePosition(a: Position, b: Position) {
  return a.length >= 2 && b.length >= 2 && a[0] === b[0] && a[1] === b[1];
}

function closeRing(ring: Position[]) {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return samePosition(first, last) ? ring : [...ring, [...first]];
}

function normalizeGeometry(geometry: WardGeometry): WardGeometry {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map(closeRing),
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) => polygon.map(closeRing)),
  };
}

function allPositions(geometry: WardGeometry) {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  return rings.flat();
}

export function normalizeBoundary(input: BoundaryInput): WardBoundary {
  const feature = isFeatureCollection(input)
    ? input.features.find((candidate) => isWardGeometry(candidate.geometry))
    : isFeature(input)
      ? input
      : ({ type: "Feature", geometry: input, properties: {} } as Feature<Geometry>);

  if (!feature || !isWardGeometry(feature.geometry)) {
    throw new Error("Boundary must be a GeoJSON Polygon or MultiPolygon.");
  }

  const geometry = normalizeGeometry(feature.geometry);
  validateBoundaryGeometry(geometry);

  return {
    type: "Feature",
    geometry,
    properties: {
      name: typeof feature.properties?.name === "string" ? feature.properties.name : "Ward Boundary",
      source: typeof feature.properties?.source === "string" ? feature.properties.source : "setup",
    },
  };
}

export function validateBoundaryGeometry(geometry: WardGeometry) {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  if (rings.length === 0) throw new Error("Boundary must include at least one ring.");

  for (const ring of rings) {
    if (ring.length < 4) throw new Error("Each boundary ring must have at least four positions.");
    if (!samePosition(ring[0], ring[ring.length - 1])) {
      throw new Error("Boundary rings must be closed.");
    }
  }

  for (const position of allPositions(geometry)) {
    const [lng, lat] = position;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw new Error("Boundary coordinates must be valid numbers.");
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error("Boundary coordinates must be valid longitude/latitude values.");
    }
  }
}

export function isPointInsideBoundary(lng: number, lat: number, boundary: WardBoundary | null) {
  if (!boundary) return true;
  return booleanPointInPolygon(point([lng, lat]), boundary);
}

export function getBoundaryBounds(boundary: WardBoundary) {
  const positions = allPositions(boundary.geometry);
  return positions.reduce(
    (bounds, [lng, lat]) => ({
      minLng: Math.min(bounds.minLng, lng),
      minLat: Math.min(bounds.minLat, lat),
      maxLng: Math.max(bounds.maxLng, lng),
      maxLat: Math.max(bounds.maxLat, lat),
    }),
    {
      minLng: Infinity,
      minLat: Infinity,
      maxLng: -Infinity,
      maxLat: -Infinity,
    },
  );
}
