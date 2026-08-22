# Northshore Ward Map

An offline-first interactive ward map for marking homes, tagging them with colors, and tracking residents locally in the browser.

The shipped app is intended to run without network access. Online tools may be used before shipping to prepare map data and address data, but the runtime app should rely only on local files and browser storage.

## Current Working Features

- Displays an interactive MapLibre map.
- Loads the ward boundary from `public/data/setup.json` on first launch.
- Supports setup mode for:
  - Importing a ward boundary from GeoJSON.
  - Drawing and editing a polygon ward boundary with Terra Draw.
  - Saving the ward boundary locally in IndexedDB.
  - Importing a local address index CSV.
  - Resetting local browser data.
- Supports runtime mode for:
  - Adding homes by clicking the map.
  - Adding homes manually with latitude and longitude.
  - Adding homes from the local address index.
  - Importing homes and residents from CSV.
  - Adding resident names to a selected home.
  - Adding tags to a selected home.
  - Color-coding homes by tag.
  - Deleting the selected home.
  - Exporting a local JSON backup.
- Persists homes, residents, tags, address index entries, and ward boundary edits in IndexedDB through Dexie.
- Checks whether added/imported home coordinates fall inside the saved ward boundary.
- Avoids hard-coded remote tile, geocoding, or storage endpoints in runtime source code.

## Current Data Status

- Initial ward boundary: present in `public/data/setup.json`.
- Address index: empty by default.
- Offline basemap: present at `public/data/northshore.pmtiles`.
- Basemap source: Protomaps/OpenStreetMap extract from the `20260822.pmtiles` build, with OSM replication time `2026-08-22T04:00:00Z`.
- Basemap coverage: padded ward area bounding box `-111.8920,40.3678,-111.8855,40.3736`, max zoom 15.
- Parcel boundaries: intentionally out of scope for now; OpenStreetMap-derived streets and likely building footprints are sufficient.

If `public/data/northshore.pmtiles` is missing, the app still loads, but the basemap will not render and the UI shows a local-basemap warning.

## Tech Stack

- Vite
- React
- TypeScript
- MapLibre GL JS
- PMTiles
- Terra Draw
- Dexie / IndexedDB
- Papa Parse
- Turf.js
- Lucide React

## Getting Started

Install dependencies:

```sh
npm install
```

Run the dev server:

```sh
npm run dev
```

Build the production app:

```sh
npm run build
```

Preview a production build:

```sh
npm run preview
```

Run TypeScript checks:

```sh
npm run typecheck
```

## Offline Map Data

The app expects a local OpenStreetMap-derived Protomaps PMTiles basemap here:

```text
public/data/northshore.pmtiles
```

The MapLibre style references it as:

```text
pmtiles:///data/northshore.pmtiles
```

Do not replace this with a remote tile URL for the shipped app. See `OFFLINE_SETUP.md` for the setup-time workflow.

Once generated, the basemap should provide street context and OSM building footprints/address points where they exist in OpenStreetMap. Official parcel data is not required for the current app.

## CSV Import Formats

### Address Index CSV

Setup mode can import an address index CSV with:

- `address`
- `latitude` or `lat`
- `longitude`, `lng`, or `lon`
- optional `label`

These addresses are stored locally and used for offline runtime address matching.

### Homes And Residents CSV

Runtime CSV import recognizes columns such as:

- `resident`, `resident_name`, `person`, `person_name`, or `name`
- `home_id`, `home_label`, `label`, or `household`
- `address`, `street_address`, or `home_address`
- `latitude` or `lat`
- `longitude`, `lng`, or `lon`
- `tags` or `tag`

Rows can create or update homes when they include an existing home ID/label, a locally indexed address, or latitude/longitude. Rows that cannot be matched are shown in the review panel.

## Local Storage

The browser database is named:

```text
northshoreWardMap
```

It stores:

- homes
- residents
- tags
- address index entries
- ward boundary metadata

Use setup mode's reset action to clear local browser data during testing.

## Known Limitations

- Runtime geocoding is intentionally not implemented.
- Unknown runtime addresses must be placed manually or imported with coordinates.
- Draw/edit mode currently starts from single polygon boundaries; imported multipolygons can be displayed and saved, but not edited as one shape through Terra Draw.
- There are no automated tests yet beyond TypeScript/build validation.
