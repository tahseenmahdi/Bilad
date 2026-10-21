# Connected travel flow

## Implemented

- Destination hours and access panels cover every map destination, with claim-level sources, uncertainty labels, check dates and overdue-review warnings. See `destination-visits.md` for the manual editorial maintenance workflow and `npm run check:visits` audit.
- Trip planning and the itinerary link to Daleel's taxi category and the taxi phrasebook.
- Daleel and the taxi phrasebook link back to the map, with the plan restored in the same tab.
- Session storage retains the origin, stops, category, time budget, and return preference. It is not shared with a server. Saved data is validated before use.
- The taxi phrase category includes asking for a destination, the fare, a drop-off, and a short wait.
- Arabic phrases and itineraries can be copied. Copy failures produce a useful message.
- Category URLs use hashes, keeping the static export compatible and categories directly linkable.
- Phrase counts and page metadata reflect the expanded collection.
- Shared taxi icon, travel shortcuts, category navigation hook, place art, and itinerary timeline replace repeated rendering code.
- Manually selecting a starting city dismisses the pending location indicator.

Taxi audio uses the existing speech-generation script with the ar-IQ-RanaNeural synthetic voice. Existing recordings are preserved; the four new files and their generation manifest are in public/audio/expressions. A native Iraqi speaker should review pronunciation before public release.

## Useful next additions

- An offline phrasebook with downloadable recordings and a clear storage control.
- A shareable trip URL with explicit user control over including a precise starting point.
- Live taxi booking only after a supported provider integration is available; the current action opens provider choices in Daleel.
- Arabic interface localization and an optional pronunciation guide reviewed by Iraqi speakers.
