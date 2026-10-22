# Milai local guide

Milai runs entirely in the Bilad website. It does not call Gemini or require an API server, API URL, key, account, network connection, or special environment variable. Its answers are deterministic and come from Bilad's curated destinations and existing local travel helpers; it is not a general-purpose generative AI assistant.

## Supported questions and commands

The guide can answer supported questions about curated destinations, history, culture, nature, Iraqi Arabic phrases, and travel services. Answers are limited to the content and rules shipped with the website.

In chat or the map planner, use commands such as:

- `Plan 4 hours in Baghdad`
- `Plan 8 hours of nature in Erbil`
- `Add Babylon`
- `Remove Babylon`
- `Show nearby places`
- `Show nearby places near my destination`
- `Clear my plan`

Planning and stop-edit commands update the current local draft directly. The active draft is shared between the guide and map planner, and the guide's Undo control restores the previous trip edit. Save, complete, and delete operations remain in the existing journey controls rather than being performed from chat.

The planner uses the visitor's chosen starting city or map pin; it does not infer a location. Nearby distances, visit durations, and travel times are estimates. Confirm access and current conditions locally.

## Data and persistence

The guide uses the same curated destination and service data as the rest of Bilad. Questions and saved-journey data are not sent to a server. Saved journeys remain on this device and browser profile; the active editing draft is tab-local.

Map features still use the separately configured public Mapbox token described in the main README. That setting is unrelated to Milai and is not needed for the local text guide.

## Verification

From `bilad-web`, run:

```sh
node --experimental-strip-types --test tests/*.test.mjs
npm run typecheck
npm run test:browser
```

The browser tests exercise the local guide without mocking or contacting an API.
