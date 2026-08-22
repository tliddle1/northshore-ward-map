import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, type GeoJSONStoreFeatures } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { Home, Tag, WardBoundary } from "./types";
import { createOfflineMapStyle } from "./mapStyle";
import { getBoundaryBounds, normalizeBoundary } from "./geometry";

let pmtilesProtocolAdded = false;

function ensurePmtilesProtocol() {
  if (pmtilesProtocolAdded) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  pmtilesProtocolAdded = true;
}

type Props = {
  wardBoundary: WardBoundary | null;
  homes: Home[];
  tags: Tag[];
  setupMode: boolean;
  drawEnabled: boolean;
  addHomeByClick: boolean;
  selectedHomeId: string | null;
  onBoundaryDraft: (boundary: WardBoundary | null) => void;
  onHomeClick: (homeId: string) => void;
  onMapHomeClick: (lng: number, lat: number) => void;
  onMapError: (message: string) => void;
};

function homesToFeatureCollection(homes: Home[], tags: Tag[]): FeatureCollection<Point> {
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  return {
    type: "FeatureCollection",
    features: homes.map((home) => {
      const tag = home.tagIds.map((id) => tagById.get(id)).find(Boolean);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [home.lng, home.lat] },
        properties: {
          id: home.id,
          label: home.label,
          color: tag?.color ?? "#374151",
        },
      };
    }),
  };
}

export default function MapCanvas(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const [loaded, setLoaded] = useState(false);
  const homesGeojson = useMemo(() => homesToFeatureCollection(props.homes, props.tags), [props.homes, props.tags]);

  useEffect(() => {
    ensurePmtilesProtocol();
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createOfflineMapStyle(),
      center: [-111.78, 40.43],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "Map data © OpenStreetMap contributors",
      }),
    );

    map.on("load", () => {
      map.addSource("ward-boundary", {
        type: "geojson",
        data: props.wardBoundary ?? { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "ward-fill",
        type: "fill",
        source: "ward-boundary",
        paint: { "fill-color": "#2dd4bf", "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: "ward-outline",
        type: "line",
        source: "ward-boundary",
        paint: { "line-color": "#0f766e", "line-width": 3 },
      });

      map.addSource("homes", { type: "geojson", data: homesGeojson });
      map.addLayer({
        id: "homes-circle",
        type: "circle",
        source: "homes",
        paint: {
          "circle-radius": ["case", ["==", ["get", "id"], props.selectedHomeId ?? ""], 10, 7],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      setLoaded(true);
    });

    map.on("error", (event) => {
      if (String(event.error?.message ?? "").includes("northshore.pmtiles")) {
        props.onMapError("Local basemap file missing: place the setup-generated PMTiles at public/data/northshore.pmtiles.");
      }
    });

    mapRef.current = map;
    return () => {
      drawRef.current?.stop();
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const source = map.getSource("ward-boundary") as GeoJSONSource | undefined;
    source?.setData(props.wardBoundary ?? { type: "FeatureCollection", features: [] });

    if (props.wardBoundary) {
      const bounds = getBoundaryBounds(props.wardBoundary);
      map.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding: 52, duration: 500 },
      );
    }
  }, [props.wardBoundary, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const source = map.getSource("homes") as GeoJSONSource | undefined;
    source?.setData(homesGeojson);
    if (map.getLayer("homes-circle")) {
      map.setPaintProperty("homes-circle", "circle-radius", ["case", ["==", ["get", "id"], props.selectedHomeId ?? ""], 10, 7]);
    }
  }, [homesGeojson, props.selectedHomeId, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const onMapClick = (event: maplibregl.MapMouseEvent) => {
      if (props.drawEnabled) return;
      const features = map.queryRenderedFeatures(event.point, { layers: ["homes-circle"] });
      const homeId = features[0]?.properties?.id;
      if (typeof homeId === "string") {
        props.onHomeClick(homeId);
        return;
      }
      if (props.addHomeByClick) props.onMapHomeClick(event.lngLat.lng, event.lngLat.lat);
    };

    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, [loaded, props.drawEnabled, props.addHomeByClick, props.onHomeClick, props.onMapHomeClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !props.setupMode || !props.drawEnabled) {
      drawRef.current?.stop();
      drawRef.current = null;
      return;
    }

    const adapter = new TerraDrawMapLibreGLAdapter({ map, prefixId: "ward-draw" });
    const draw = new TerraDraw({
      adapter,
      modes: [
        new TerraDrawPolygonMode({
          editable: true,
          showCoordinatePoints: true,
          styles: {
            fillColor: "#14b8a6",
            fillOpacity: 0.24,
            outlineColor: "#0f766e",
            outlineWidth: 3,
          },
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: true,
                coordinates: { draggable: true, midpoints: { draggable: true }, deletable: true },
              },
            },
          },
        }),
      ],
    });

    const syncDraft = () => {
      const polygon = draw.getSnapshot().find((feature) => feature.geometry.type === "Polygon");
      if (!polygon) {
        props.onBoundaryDraft(null);
        return;
      }
      try {
        props.onBoundaryDraft(normalizeBoundary(polygon as Feature));
      } catch (error) {
        props.onMapError(error instanceof Error ? error.message : "Drawn boundary is not valid.");
      }
    };

    draw.start();
    if (props.wardBoundary?.geometry.type === "Polygon") {
      const feature: GeoJSONStoreFeatures = {
        type: "Feature",
        geometry: props.wardBoundary.geometry,
        properties: { mode: "polygon" },
      };
      draw.addFeatures([feature]);
      draw.setMode("select");
    } else {
      draw.setMode("polygon");
    }

    draw.on("finish", syncDraft);
    draw.on("change", syncDraft);
    drawRef.current = draw;

    return () => {
      draw.off("finish", syncDraft);
      draw.off("change", syncDraft);
      draw.stop();
      drawRef.current = null;
    };
  }, [loaded, props.setupMode, props.drawEnabled]);

  return <div className="map-canvas" ref={containerRef} />;
}
