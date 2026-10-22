# Milai Gemini guide

Milai's chat and Gemini API run in the same `bilad-web` Next application. The browser calls `/api/guide`; `src/app/api/guide/route.ts` calls Gemini from the server using `@google/genai`. The model prompt and curated retrieval live under `src/lib/server/`. The separate `ai/tourism-ai` prototype is not required to deploy or run Bilad.

## Local setup

Use Node 22.18+ (or 24). In `bilad-web`, run `npm ci`. Set `GEMINI_API_KEY` in this app's private server environment or an existing `.env.local`; `GEMINI_MODEL` is optional and defaults to `gemini-2.5-flash`. Set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` for the map and Mapbox road directions. `.env.example` contains placeholders; never commit a real key or put it in `NEXT_PUBLIC_*`.

Run `npm run dev` locally. For production run `npm run build` and `npm start`, or deploy this one folder to a host that supports Next.js server routes and configure `GEMINI_API_KEY` in that host's environment. A static file host cannot execute `/api/guide`; uploading only generated HTML will leave chat unavailable. No separate AI host, API base URL, or CORS configuration is needed. Without a Mapbox token, the planner shows an estimated preview instead of road directions.

## Supported behavior

Milai answers questions using Bilad's curated destinations, visitor notes, language phrases and service catalog. It can open the map, focus a known place, and show nearby places. It can propose known place and service IDs. A service recommendation appears as a card; it never opens the provider URL automatically.

For a request such as “Plan 4 hours in Baghdad with 3 stops” or “Plan a route from Erbil to Erbil Citadel,” Gemini proposes a typed `build_day` action. Named stops and stop counts are validated against the request. Bilad calculates the route from its own places, budget and stop limit. Chat shows the actual proposed stops. Confirming creates a **new Idea** through `JourneyProvider`, then opens that route in the map. The Mapbox road route is fetched by the existing planner when configured; otherwise an estimated route is labeled as such. The current origin, duration, category and return setting are preserved unless the user explicitly asks to change them. If no origin or feasible route exists, Milai explains the constraint without changing state.

Milai can also propose adding, removing or reordering existing stops, saving an active trip, or marking an identified saved Planned journey Done. These writes show a confirmation card. Stop edits keep the existing Undo behavior. Saving uses the provider's revision checks and error feedback. Completion requires the open saved record, a clean draft and a matching revision, and retains the provider's Undo status change. It never deletes a journey, requests geolocation, submits a form, books anything, or opens an external link.

## Data and limits

The built-in route imports Bilad's curated destination, service and visitor modules. The model receives a small place index, relevant records, brief chat history, and only the active trip or selected saved journey when relevant. It does not receive the full journey collection, private notes, browser storage or credentials. Responses are JSON proposals with exact action and ID validation on the server and again in the browser. Both chat and the map use the existing shared draft. Error responses are shown in chat with retry; no deterministic reply is presented as a Gemini success.

Requests allow 1,000 message characters and six history entries; model replies allow 4,000 characters and at most four actions with one write. The built-in route has a 16 KB body limit, a 25-second timeout, and a 12-request-per-minute process limit. Successful responses use `{success:true,data:{reply,placeIds,serviceIds,actions}}`; errors use `{success:false,error:{code,message}}`. Same-origin requests need no CORS allowlist.

## Verification

In `bilad-web`, run `node --experimental-strip-types --test tests/*.test.mjs`, `npm run typecheck`, `npm run test:browser`, and `npm run build`. The API tests inject Gemini responses; the browser suite intercepts `/api/guide`, so neither consumes Gemini quota. A live Gemini reply requires a configured key in the running Bilad server.
