# Requirements

## Purpose

This project provides an interactive map for a specific geographic area that changes infrequently. The map should make it easy to define the ward boundary, mark homes, tag homes with meaningful labels, associate residents with homes, and keep all data available locally between sessions.

## Functional Requirements

### Ward Boundary

- The application must allow a user to initially define the boundary of the ward, which represents the region of interest.
- The ward boundary should be editable during setup.
- The saved ward boundary should be displayed on the map whenever the application loads.
- Because the ward changes infrequently, the application does not need frequent boundary synchronization or automated boundary updates.

### Home Tagging

- The application must allow a user to mark individual homes on the map.
- The application must allow each home to be assigned one or more text tags.
- Tags must be user-defined words or short phrases.
- Tags must support color coding so homes can be visually distinguished on the map.
- Homes with tags should display their tag colors clearly in the map interface.

### Resident Names

- The application must allow a user to add the names of people who live in each home.
- Resident names must be addable manually on an ad hoc basis.
- The application must support importing resident names from a CSV file.
- CSV import should associate resident names with the correct homes when enough identifying information is provided.
- The application should provide feedback when CSV rows cannot be matched to a home.

### Local Persistence

- The application must persist ward boundaries, homes, tags, tag colors, and resident names locally.
- Saved data must remain available after closing and reopening the application.
- The application should not require a remote server or cloud account for core storage.

## Non-Functional Requirements

- The map should be usable for occasional updates and repeated lookup.
- The basemap should use OpenStreetMap-derived street and building context; official parcel boundaries are not required for the current version.
- The interface should make tagged homes easy to scan visually.
- The data model should be simple enough to export, back up, and restore later.
- The application should handle the relatively static nature of the ward without unnecessary background syncing.

## Future Considerations

- Exporting all locally stored data to a backup file.
- Restoring local data from a backup file.
- Editing or deleting imported residents in bulk.
- Filtering homes by tag, color, or resident name.
- Supporting multiple ward boundary versions if the region changes over time.
