# Offline Setup

The shipped app is designed to run without internet access. Online tools should only be used before shipping to prepare the local data bundle.

## Map Data

1. Create or obtain the ward boundary as GeoJSON.
2. Use the boundary or its bounding box to extract a Protomaps/OpenStreetMap PMTiles file for the area.
3. Save the generated file at:

   ```text
   public/data/northshore.pmtiles
   ```

4. Build the app with:

   ```sh
   npm run build
   ```

At runtime, the app loads only `pmtiles:///data/northshore.pmtiles`.

The intended basemap data is OpenStreetMap-derived street and building context. Official parcel boundaries are not part of the current data plan.

For the current ward boundary, use a padded bounding box like:

```sh
pmtiles extract \
  https://build.protomaps.com/YYYYMMDD.pmtiles \
  public/data/northshore.pmtiles \
  --bbox=-111.8920,40.3678,-111.8855,40.3736 \
  --maxzoom=15
```

Replace `YYYYMMDD` with a current Protomaps daily build from `maps.protomaps.com/builds`.

The current checked-in basemap was generated with:

```sh
pmtiles extract \
  https://build.protomaps.com/20260822.pmtiles \
  public/data/northshore.pmtiles \
  --bbox=-111.8920,40.3678,-111.8855,40.3736 \
  --maxzoom=15
```

Its source metadata reports OSM replication time `2026-08-22T04:00:00Z`.

## Setup Data

Optional setup-time data can be placed in:

```text
public/data/setup.json
```

The file supports:

- `wardBoundary`: a GeoJSON `Polygon` or `MultiPolygon` feature.
- `addressIndex`: local address records with `address`, `normalizedAddress`, `lat`, `lng`, and `source`.

The setup screen can also import:

- Ward boundary GeoJSON.
- Address index CSV with `address`, `latitude`, and `longitude` columns.

## Runtime Rules

- Do not add remote tile URLs to the map style.
- Do not call geocoding APIs from the shipped app.
- CSV imports at runtime must match the local address index or include latitude/longitude.
- Unknown runtime addresses must be placed manually.
