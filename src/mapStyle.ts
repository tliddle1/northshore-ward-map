import type { StyleSpecification } from "maplibre-gl";

export const localBasemapUrl = "pmtiles:///data/northshore.pmtiles";

export function createOfflineMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Northshore Offline",
    sources: {
      protomaps: {
        type: "vector",
        url: localBasemapUrl,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#eef2e7" },
      },
      {
        id: "landuse",
        type: "fill",
        source: "protomaps",
        "source-layer": "landuse",
        paint: { "fill-color": "#dfe9d3", "fill-opacity": 0.7 },
      },
      {
        id: "water",
        type: "fill",
        source: "protomaps",
        "source-layer": "water",
        paint: { "fill-color": "#9ecae1" },
      },
      {
        id: "buildings",
        type: "fill",
        source: "protomaps",
        "source-layer": "buildings",
        minzoom: 13,
        paint: { "fill-color": "#c9c1b3", "fill-opacity": 0.72 },
      },
      {
        id: "roads-minor",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 16, 5] },
      },
      {
        id: "roads-major",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["in", ["get", "kind"], ["literal", ["major_road", "highway"]]],
        paint: { "line-color": "#e4b363", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 16, 8] },
      },
    ],
  };
}
