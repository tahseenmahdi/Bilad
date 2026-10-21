# Milai and Gemini

Bilad remains a static Next.js export (`next.config.ts`). No Next.js API route or server action is needed. Browser requests go to the independently hosted Express service in `../ai/tourism-ai`, which uses the existing `@google/genai` integration and Gemini project/key. The default model remains `gemini-2.5-flash`; the API host may set `GEMINI_MODEL` to another compatible model. Existing Google project quota/billing applies.

Google currently limits 2.5 access to projects/users that previously used those models; new projects should select an available Gemini model in `GEMINI_MODEL` instead. See Google's [model availability/deprecation notes](https://ai.google.dev/gemini-api/docs/deprecations/). This integration keeps the prototype default for existing credentials; it does not automatically switch to another billable model on failure.

## Local setup

Use Node **22.18+** (Node 24 also supported). The API imports Bilad's TypeScript data and validation modules directly using Node's type stripping. Keep both folders in their current relative layout; there is no copied catalog to synchronize.

1. In `ai/tourism-ai`, run `npm ci`. Supply `GEMINI_API_KEY` through the server environment. `.env.example` lists placeholder settings; if you choose to create a local `.env`, keep it private. Never overwrite an existing credential file.
2. Set `BILAD_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000` for development. Start with `npm start` (default port 5000).
3. In `bilad-web`, run `npm ci`, then set `NEXT_PUBLIC_BILAD_AI_API_URL=http://localhost:5000` in your existing local frontend configuration or shell environment. This is the public API host, without `/api`. Keep the Mapbox public token separately configured as documented in the README. **Never put a Gemini key in this folder or a `NEXT_PUBLIC_*` variable.**
4. Run `npm run dev`. Visit `/ai/`; Explore Iraq's planner uses the same Gemini conversation components and journey state.

The API base URL is embedded at frontend build time. If omitted, Milai displays an explicit configuration error with a retry button. There is no automatic demo fallback. The historical deterministic helpers remain available for existing unit tests but are not connected to Milai's production UI.

## Actions and ownership

The shared `src/lib/ai-guide.ts` defines and validates these action types on the server and client:

| Action | Existing Bilad behavior |
| --- | --- |
| `focus_place` | Select a known destination on the map |
| `nearby` | Use `nearbyReference` and `nearestPlaces`; chosen start by default, named/selected destination when requested |
| `recommend_service` | Show a known `services.ts` listing; only the user's link click visits the provider |
| `build_day` | Use `buildDay`, existing origin/category/return/time settings and six-stop limit; refresh existing road routing and fit-to-time behavior |
| `add_stop`, `remove_stop`, `reorder_stops` | Edit the shared active draft with known IDs; preserve all other settings; reject over-budget additions/reorders and invalid permutations |
| `save_trip` | Show `JourneyBar`; the visitor reviews the title and clicks its existing Save as idea/Save changes control |
| `complete_journey` | Review a named, already saved Planned journey and confirm; call `JourneyProvider.transition` with revision checks and status Undo |

The model can propose at most four actions and **one write** per reply. It never applies state itself. Every write requires explicit request intent; itinerary edits and completion also require a review/confirmation click. Multiple requested changes are handled one at a time. Ambiguous, negated, hypothetical or unsupported writes are rejected or receive a follow-up. For reliable settings changes, name a starting city, a numerical time in hours/minutes, and the desired category/return option. A custom map pin is retained unless a new city is explicitly named.

Only a matching saved title or an explicit reference to the current journey supplies one journey identifier/title/status for completion. Ambiguous matches require opening the desired record. Unsaved drafts are never implicitly created as completed records. Ideas must first move to Planned through Your journeys; active unsaved edits must be saved before completion. The provider's save errors, cross-tab revision checks, unsaved-change dialogs and persistence remain authoritative. Completion returns an actual success/failure result; it does not assume a persistence write succeeded.

Pending proposals are bound to the original draft snapshot and saved revision. If the draft or target changes before acceptance, Milai asks the visitor to retry. Undo of itinerary edits is available while the matching result is current; status Undo uses the provider's own revision-checked operation. Switching chat/map retains the prompt, conversation and shared draft. Existing keyboard/reduced-motion behavior remains in place.

## Content and privacy boundary

The API retrieves from `destinations.ts`, `destination-visits.ts`, `services.ts`, and, for language questions, `expressions.ts`. A compact place identity index enables discovery, with at most six relevant detailed place/visitor records. Source URLs and the register's dated/uncertain visitor information are retained; the UI renders original Bilad source links, not model-generated URLs. Prices, admissions and open-now claims are not inferred. The prototype heritage JSON is **not** used as current operational truth.

Only relevant active trip fields, an optional selected destination, up to six short conversation messages and (when completing) one minimal saved record are sent. Notes, dates, saved collections, storage dumps, environment variables and unrelated browser state are never automatically sent. The server independently strips irrelevant context. Gemini receives the user's own question/history, so visitors should avoid entering private information in chat. Conversations are held in component memory, not added to saved journeys.

All model text is rendered as plain React text, including angle brackets and Markdown. There is no HTML/Markdown execution, arbitrary URL action, code execution, geolocation, deletion, purchase, form submission or duplicate map/planner/store. Service/source links are from curated modules and require a user click.

## Deployment and limits

Host `bilad-web/out/` on static hosting. Host the API on a Node service with **both** `ai/tourism-ai` and `bilad-web/src/lib` available in their repository-relative layout (deploy the two folders together, or package those exact source files with the service). No browser dependency on the heritage JSON exists. Use HTTPS for both public origins, configure exact allowed frontend origins on the API, and rebuild the frontend with the public API URL. Changing a backend secret needs only an API restart; changing the public host needs a frontend rebuild. Hosting only `out/` cannot run Gemini.

Limits: 16 KB JSON body; 1,000-character question; six history messages of at most 1,000 characters; 4,000-character reply; 2,500 model output tokens; four actions/one write; 25-second provider deadline and 30-second browser deadline; two-second client cooldown; 12 requests/client/minute, 120 requests/process/minute and four concurrent provider calls. Rate errors include `Retry-After`. There are no automatic billable retries. Explicit error codes cover missing credentials, quota, timeout, network/provider failure, malformed requests and invalid proposals.

The in-memory limits apply per process and reset on restart. For public/multi-instance hosting, enforce shared quota/authentication and request limits at the hosting gateway; CORS is an origin policy, not user authentication. By default Express trusts the socket address, not caller-supplied forwarding headers; a proxy may group visitors under one IP. Configure any proxy policy deliberately at deployment, with an upstream limiter. Do not log request bodies, prompts or secrets.

## Verification

From `bilad-web`:

```sh
node --experimental-strip-types --test tests/ai-guide.test.mjs
node --experimental-strip-types --test tests/*.test.mjs
npm run typecheck
npm run build
npx playwright install chromium
npm run test:browser
```

Browser tests launch their own Next dev server on port 3100 with a mock API, no Mapbox key and no Gemini quota use. `BILAD_NEXT_DIST_DIR=.next-playwright` isolates its dev build from an existing server; generated TypeScript paths include that ignored directory. Alternatively set `BILAD_TEST_BROWSER_CHANNEL=chrome` to use installed Chrome. They cover plain-text rendering, minimal context, prompt/map persistence, mobile keyboard focus, service recommendations, proposal review, shared draft edits/Undo, save, completion/Undo, dirty drafts, invalid actions, backend failures, stale responses, storage failures and conflicts. API tests run separately with `npm test` in `ai/tourism-ai`; they use injected Gemini responses and local HTTP servers. A real-key smoke check is an external deployment step, not part of the offline suites.
