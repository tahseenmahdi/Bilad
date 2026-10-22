# Shared day trips and Your journeys

`/journeys/` is a prerendered page in the Bilad Next application. Tower reveal 5 opens it; its Bilad link restores `/#journeys`. Existing tower geometry, spring, gap sizes and resize handling are reused. The reduced-motion links include Your journeys.

## Architecture

- `JourneyProvider` in the root layout owns one active editing draft and the saved collection. Client navigation between Explore Iraq, Milai, journeys and the other features preserves that draft.
- Both maps use `TripPlanner` for setup, stop editing, route requests, fallback estimates and save controls. Its atlas adapter supplies routes and point selection to the existing `ExploreMap`, without replacing photo markers, clustering or discovery modes. Switching Explore panels leaves the map mounted and retains its view, selected destination and filters.
- `journeys.ts` validates the versioned records, retains unavailable editorial IDs, creates/duplicates records, checks revisions and handles migration. The six-stop, 1–12 hour planner remains a single day. `scope: 'day'` leaves room for a future format migration without claiming multi-day support.
- Saved data contains intent: ordered destination IDs, origin, time, category, return setting, title, status, optional intended date and notes. Records also have ID, revision, created/updated dates and nullable completion date. Calculated geometry, directions and travel estimates are not saved. Maps refresh them when opened.
- Ideas, Planned and Done are user collections. Curated themes appear separately and first create an unsaved draft; only an explicit Save places them in the collection.

## Device storage and migration

`localStorage['bilad.journeys.v1']` contains `{version: 1, journeys: [...]}`. It survives browser restarts for the same browser profile, origin and device. There is no account, backend, cloud backup or cross-device synchronization. Private browsing, clearing site data, browser eviction or device loss can remove the collection. Changes between localhost ports or deployment origins create separate collections.

The active draft has its own versioned envelope in tab-local `sessionStorage['bilad.draft.v1']`. Saved records are not edited until Save succeeds. The original `bilad.trip.v1` session key is maintained for compatibility. Draft recovery is tab-local, while the collection is device-local. Drafts are kept for reloads when session storage permits; unsaved edits also install the browser's normal page-exit warning. Client navigation within Bilad keeps the draft without a warning.

On the first upgrade, an existing session itinerary is imported as an Idea while preserving the active itinerary. A deterministic import ID makes retries idempotent. Import reads and merges the current collection; it never replaces unrelated saved trips. If device storage fails, the session itinerary stays open and the error explains that saving failed. An old automatically obtained `device` origin is retained only in the current tab draft and omitted from saved history; new planners do not automatically request location. Explore's explicit location action centers the map without storing the device position.

Invalid JSON, unsupported versions and malformed collection records cause an error and are left untouched. The app never initializes over unreadable saved data. Invalid draft data falls back to the validated legacy itinerary. Removed destination IDs remain in saved records and appear as unavailable, with an explicit Remove action. They count against capacity and are excluded from routing.

Every save reads the latest collection and checks the edited record's revision. Where available, the Web Locks API serializes writes between same-origin tabs. Storage events update collection cards, while preserving the current tab's editing draft. Conflicting saves/deletes/Undo are rejected, with an option to save a separate copy or reopen the latest version. Browsers without Web Locks use synchronous read/merge/write with revision checks; truly simultaneous writes across processes cannot be made fully transactional with localStorage alone.

Disabled storage and quota errors never clear the active draft or claim a successful save. Session storage and local storage may fail independently. Keep the page open if neither is available. No automatic destructive reset or silent data eviction is implemented.

## Actions and accessibility

Opening another saved trip or starting a new one with unsaved edits opens a native modal: Save and open, Discard and open, or Keep editing. Save failures keep the modal and edits open. Native dialog focus trapping, Escape cancellation and focus restoration are used. The journey editor and map panels restore focus on close. Explicit coordinate fields provide a keyboard alternative to selecting a custom point on the map.

Completion is manual and preserves all planner settings. It records the completion time and offers Undo. Moving Done back to Planned clears that completion time. Duplicating creates a separate Idea with a new ID, no completion date and no intended date. Deletion has a confirmation and immediate Undo. Undo is only available during this open session and until another operation replaces its feedback; it is not a permanent trash archive.

Map lines distinguish calculated road routes (solid aqua), fallback connections (dashed aqua), and curated themes (dashed coral). Maps and routes reuse the existing Mapbox configuration. Directions and estimates do not confirm current access, safety, opening times or availability. Lists and controls remain usable without WebGL, a token or successful directions requests.

## Verification

Run:

```powershell
npm run typecheck
node --experimental-strip-types --test tests/*.test.mjs
npm run check:visits
npm run build
```

The journey tests cover storage round trips, draft recovery independent of property order, every status transition, completion restoration, duplication, import idempotence, preservation of existing data, unavailable IDs, duplicate/capacity handling, malformed/future data, disabled/quota-limited storage, and stale conflicting writes/deletes/Undo. Existing routing tests cover failure responses, invalid geometry, cancellation and fallback boundaries; existing motion tests cover all six tower gaps.

Browser checks cover real Mapbox road results; trail additions and deduplication; reordered-stop continuity from Explore to Milai; saved journey reopening in a fresh tab; conflict rejection between two tabs; completion Undo; duplication; unsaved switch cancellation; desktop and 390px layouts; the mobile bottom sheet; keyboard Escape; fifth-reveal entry/return and retention after resizing. Reduced-motion navigation and styles are checked in source with the unchanged tower motion tests; this browser harness does not expose media-preference emulation. Storage exception tests use an injected storage adapter, without filling or disabling the user's actual browser storage.
