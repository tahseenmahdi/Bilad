# Explore Iraq

`/explore/` is a static-export-compatible cultural atlas. The fourth tower reveal links to it; `/#explore` restores reveal 4. Reduced-motion navigation includes the same destination. Resizing the tower preserves the current floor.

## Architecture

- `ExploreIraq.tsx` owns one panel, mode filters, selected destination and explicit camera requests. Closing or switching panels does not recreate the map. Mapbox GL loads on demand through `ExploreMap.tsx`, using the existing public-token environment variable and dark style. Clusters expand on selection; the collection list provides keyboard access to every result.
- Map pins use the destination's approved photograph in a rounded frame. Clusters show up to three adjacent photographs and a count, and expand geographically on click or Enter. A synchronized HTML marker pool follows the clustered Mapbox source; filtering clears the pool and invalidates outstanding cluster lookups. Missing photos fall back to the place's initial. Selected markers have a coral border and a visible name. `explore-polish.css` styles the photo markers, floating tools, results and compact cards.
- The base map uses Bilad's blue/aqua palette with brighter land and water, pale peach national borders, blue regional borders, and light labels with blue halos. The frozen Natural Earth Iraq geometry supplies a subtle aqua wash and peach national outline; the outline becomes quieter at local zoom levels.
- `lib/explore.ts` adds discovery metadata without changing Milai's destination model. All 24 places, photographs, credits, coordinates and visit records come from the existing curated collection. Region labels normalize city/area labels to governorates (Samarra → Salah al-Din, Rawanduz → Erbil, Mosul → Nineveh, Al-Mada’in → Baghdad).
- Additions use `bilad.trip.v1`, `restoreTrip`, and the existing six-stop planner limit. Existing origin, time, category and return settings are preserved. IDs are validated and deduplicated; partial trail additions report the capacity limit. Storage remains tab-local session storage. Disabled browser storage means cross-page persistence cannot be guaranteed.
- `?place=<validated destination ID>#chat` gives Milai explicit context and a curated opening reply. Daleel links to taxi services; Say It links to taxi phrases or the table category for food discovery.

## Content and geography

The outline is derived from Natural Earth's public-domain 1:50m Admin-0 geography. The frozen Iraq feature is `public/data/iraq.geojson`; the projected illustration is `public/assets/iraq-outline.svg`. Source: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries/ and https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson (retrieved 2026-10-21).

Regions currently cover the 11 governorates represented in the destination collection. They focus on curated site coordinates; there is no administrative-boundary layer or claim of exhaustive coverage. Food currently covers Al-Mutanabbi Street's café culture, not a restaurant directory. Culture includes existing cultural sites; no new museum entries were invented.

Time is a broad, non-exhaustive association filter. Nature is not assigned historical periods. Erbil Citadel appears in Ancient and Ottoman: UNESCO documents ancient Arbela and the late Ottoman fan-shaped settlement pattern (https://whc.unesco.org/en/list/1437/). Modern includes living literary culture and Al-Nouri's contemporary restoration, not a claim that the mosque originated in the modern era. Other period associations follow existing sourced destination descriptions.

Trail lines are thematic straight connections, not driving directions, travel-time estimates or current access confirmations. Milai retains responsibility for route planning. Opening/access information uses the existing dated `DestinationVisitInfo` disclosures; it is not live availability.

## Privacy and resilience

Location is requested only from the location button, with a ten-second timeout and no high-accuracy request. It moves the atlas camera and is not stored or forwarded to the itinerary or Milai. As with other map views, Mapbox receives map tile requests for the viewed area. Denied/unavailable location leaves manual discovery available.

Missing credentials, unsupported WebGL, import failure, authorization errors or a map load timeout expose a retry action and automatically open the usable collection list. Missing photographs leave a quiet fallback surface; they do not block details, sources or journey actions. Escape dismisses the current panel and restores focus. Reduced-motion preferences disable panel transitions and map flight durations.

## Validation

Run `npm run typecheck`, `npm run build`, `npm run check:visits`, and `node --experimental-strip-types --test tests/*.test.mjs`. The discovery tests cover bilingual search, region normalization, period associations, valid trail IDs, deduplication, planner capacity, and shared-session restoration. Existing planner, routing, session, visit, gesture and motion tests remain in the full suite.

Manual browser checks used desktop 1280×720 and mobile 390×844: map rendering/clusters, destination details, duplicate feedback, Milai context and restored stop, time filters, region selection, Arabic search, empty results, trail additions, location unavailable, Escape dismissal and the fourth-floor return.

A local static-export test fixture disabled WebGL, returned geolocation permission denial, and returned 404 for JPEG assets. The collection opened automatically, destination details remained usable, and the permission-denied message offered manual exploration. Daleel and Say It category navigation were also checked. The tower remained on `data-stage="4"` through desktop/mobile resizing after the resize repair.

A separate fixture simulated reduced motion in both CSS media queries and `matchMedia`; the intact tower exposed all four feature links and keyboard Enter opened Explore Iraq. This was simulated preference testing, not a change to the user's operating-system preference.
