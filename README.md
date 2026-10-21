# Bilad / بلاد

A minimal Malwiya experience: BILAD, the tower, atmospheric lighting and sparse embers.

Run `npm install` and `npm run dev` to preview. `npm run build` exports the production website to `out/`.

## Scroll prototype

The scene stays pinned across seven viewport heights, with seven resting poses: the intact tower and six successive splits. Each wheel gesture (including its momentum tail), vertical swipe, or arrow/page key press advances at most one floor. A light 2 px wheel input or 6 px vertical swipe is enough to move; wheel gestures rearm after a 100 ms quiet gap, and direction changes respond immediately. New input retargets the camera while it is moving, preserving velocity through a critically damped spring instead of locking input until a fixed animation finishes. Floor geometry interpolates directly, without a second easing or sticky resting zones. Floors, edge feathering, depth fading, camera movement, and snippet visibility share that clock. Snippet entrances finish quickly. Scrollbar dragging and explicit Home/End navigation remain available; a partial scrollbar stop settles after 100 ms. Reversing scroll reassembles the tower and restores its edges. Pinch zoom and reduced-motion browsing retain native behavior.

Seven CSS-clipped copies of the same source photograph align on one 2:3 canvas. The camera gently zooms and centers the newest gap; curved SVG masks feather the lifted floors' bottom edges and restore them on reassembly. The wordmark shrinks into a crisp upper-left signature during close-ups, outside the moving scene, and returns to its centered opening position on reassembly. Shared cubic cut paths follow the middle of the staircase bands in `src/components/tower-clips.ts`, with a subpixel overlap for clean reassembly. No separate floor image files are needed.

The exposed surfaces are flat image cuts, not reconstructed interiors or 3D geometry. Reduced-motion users see the intact, static tower without the long scroll track. Desktop cursor parallax, the opening fade, shared camera movement, slow light shift and decorative embers remain supported.

The original tower image is supplied by the user.

## AI guide entrance

The first split opens a larger gap for the supplied AI mascot, feature introduction, and a link to `/ai/`. A short atmospheric wash connects the routes. The guide page adapts `AI chatbot design reference` into a responsive page with the mascot, a question input, and suggested prompts. Its return link opens the first tower reveal at `/#guide`. Reduced-motion visitors can reach the guide directly from the intact tower.

Milai uses Gemini through the Express API in `../ai/tourism-ai`; credentials stay on that server. Set the public `NEXT_PUBLIC_BILAD_AI_API_URL` to the API host (without `/api`) before starting or building Bilad. Missing configuration, unavailable Gemini, quota limits and invalid responses show explicit errors and a retry control. There is no silent demo fallback.

Chat and both map planners use the same curated Bilad content and shared journey draft. Milai can answer questions, focus places, find nearby destinations, recommend existing services, and propose day plans or stop edits. Writes require explicit intent and review: accept itinerary edits with Undo, save with the existing journey Save controls, and confirm completion of an already saved Planned journey. It cannot delete records, request location, book, purchase, open links or run arbitrary actions. Personal notes and saved collections are never automatically sent to Gemini. See [Milai architecture, access boundaries, supported actions, setup and deployment](docs/milai-ai.md).

## Map and day planner

The guide page has animated AI and map buttons. Opening either reveals a three-dot switcher with the other option and a way back to both buttons. The chat prompt is preserved while switching.

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to your own public Mapbox token (`pk.` prefix). Allow your deployed domain and localhost in the token's URL restrictions. Restart development after changing configuration; production static exports must be rebuilt with this variable set.

The current planner uses an explicitly selected city or map pin. It makes no IP or browser-geolocation request. The previous location adapter and component remain available as unused prototype code, with their existing tests.

Sixteen sourced historical, cultural and natural destinations are selectable through map pins, search and nearby suggestions. Choosing a place shows its brief and nearby alternatives. The map opens with five compact animated buttons: Plan a trip, Nearby places, Browse all, Your trip, and Ask Milai. Only one section expands at a time; a three-dot switcher opens the other options, and the section heading or Escape collapses it. Settings, prompts and itinerary state are preserved. Set 1–12 hours, choose optional return travel, then build a day or add, remove and reorder stops yourself. The UI is responsive, keyboard accessible, and respects reduced motion.

The planner uses a light workspace and separate sand, mint, blue, peach and lilac tool surfaces. Nearby places defaults to the visitor's chosen starting area, even when another destination is selected. Its My starting point / Selected destination switch changes the recommendation reference and map view without changing the route origin. A city can be chosen directly within Nearby places; an existing custom map pin is also supported. Without a chosen start, the interface asks for an area rather than assuming a current location. Milai's generic nearby query also uses the start; explicitly asking about a named destination or “my destination” uses that destination.

Mapbox GL JS loads on demand. Its Directions API provides the road route, leg times and expandable directions for chosen stops. Mapbox receives the selected route coordinates. If road directions cannot be fetched, the interface clearly labels the dashed connection as an estimated preview. The list and planning controls remain usable if the map fails. Travel and visit times are estimates, site pins are not verified entrances, and local access/opening times need checking. See [destination sources and planning assumptions](docs/destination-data.md).

Run `node --experimental-strip-types --test tests/*.test.mjs` for planning, AI action validation, journey persistence, historical demo commands, route response validation and the earlier location adapters. Run `npm run typecheck` and `npm run build` before shipping. Run `npm test` in `../ai/tourism-ai` for API tests. `npm run test:browser` covers Milai's UI with a mocked API (install Chromium with `npx playwright install chromium`, or set `BILAD_TEST_BROWSER_CHANNEL=chrome`). The static export contains no backend endpoint: deploy the Express API separately, configure its exact allowed Bilad origins and Gemini key, and rebuild the frontend with its HTTPS API host. Saved journeys persist on this device; the editing draft is tab-local.

The design brief for further exploration in Stitch is in [docs/stitch-planner-prompt.md](docs/stitch-planner-prompt.md).

## Explore Iraq

The fourth Malwiya reveal opens /explore/, a standalone cultural atlas with Places, Trails, Regions and Time modes. Plan a trip opens the same planning controls used by Milai, editing one shared active draft. See [Explore Iraq architecture, content limits and validation](docs/explore-iraq.md).

## Your journeys

The fifth reveal opens `/journeys/`: Ideas, Planned and Done, with editable day trips, optional dates and personal notes. Save from either map, reopen in either map, move between statuses, complete with Undo, duplicate, or delete with confirmation and Undo. Opening another trip protects unsaved edits. Journeys are stored on the same device and browser profile, with validated versioned storage, legacy session migration, failure feedback and cross-tab conflict checks. There is no account or cloud backup. See [architecture, persistence limitations and verification](docs/journeys.md).
