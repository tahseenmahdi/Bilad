# Destination collection

Researched 19 October 2026. The app ships 16 curated records in `src/lib/destinations.ts`. This is a starter collection, not a claim to cover every attraction or rank popularity statistically. Short descriptions are independently written summaries. Each record keeps a descriptive source and a separate coordinate source when needed.

## Sources

| Places | Description source |
| --- | --- |
| Babylon | [UNESCO](https://whc.unesco.org/en/list/278/) |
| Malwiya / Samarra | [UNESCO](https://whc.unesco.org/en/list/276/) |
| Erbil Citadel | [UNESCO](https://whc.unesco.org/en/list/1437/) |
| Hatra | [UNESCO](https://whc.unesco.org/en/list/277/) |
| Ur and the marsh landscape | [UNESCO Ahwar property](https://whc.unesco.org/en/list/1481/) |
| Al-Mustansiriya, Abbasid Palace | [Iraq's UNESCO tentative-list submission](https://whc.unesco.org/en/tentativelists/5880/) |
| Aqar Quf | [UNESCO tentative list](https://whc.unesco.org/en/tentativelists/6797/) |
| Amedi | [UNESCO tentative list](https://whc.unesco.org/en/tentativelists/5601/) |
| Al-Nouri Mosque | [UNESCO's restoration project](https://www.unesco.org/en/revive-mosul/al-nouri-mosque) |
| Al-Mutanabbi Street | [Rafidain](https://rafidainiraq.com/en/mutanabbi/) |
| Gali Ali Beg, Bekhal | [Visit Kurdistan's Rawanduz guide](https://www.visitkurdistan.com/rawanduz/) |
| Dukan Lake | [Key Biodiversity Areas](https://www.keybiodiversityareas.org/en/site/factsheet/32136) |
| Taq Kasra | [Wikipedia](https://en.wikipedia.org/wiki/Taq_Kasra) |

Coordinates use UNESCO where suitable, IRCICA for Al-Mustansiriya, and the linked gazetteers/Wikipedia coordinate records for individual sites. Dukan is pinned near the southern dam, rather than in the middle of the reservoir. Chibayish is the town starting area, not a driveable point inside the wetlands. Bekhal's coordinate was cross-checked against its Wikipedia record; conflicting travel-site coordinates were not used. Pins represent site areas and must be checked for entrances/access before launch.

Only sites actually inscribed are described as World Heritage. Tentative-list sites are not given that badge. Visit allowances of 45–120 minutes are editorial planning assumptions, not source-reported opening times. No live availability, ticket prices, access permissions or traffic claims are made.

Existing local photos are reused. Credits for Babylon, Ur, Erbil and Hatra remain in `public/assets/credits.json` and appear in the selected-place view. Samarra uses the user-supplied tower image. Other places use original neutral line illustrations, not substituted photographs.

## Planning and routing

Nearest means great-circle distance, explicitly labelled in the UI. Suggested days use a proximity heuristic, six-stop maximum, 20-minute buffer, visits and optional return travel. Travel previews use great-circle distance × 1.4 with a nominal driving speed; they are not road directions.

The [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/) supplies road geometry, leg distances, durations and instructions using the existing public token. Requests are debounced, abortable and capped at 12 seconds; out-of-date results are ignored. Routes with incomplete legs or snaps over 1 km are rejected. Actual site entry access is not verified. Road durations use the driving profile, not live traffic. A failed lookup leaves an explicitly labelled dashed preview.

“Plan my day” checks its initial proposal against returned road travel and trims trailing stops if needed. Manual additions and AI edits can exceed the budget and show the amount over time with a Fit my time action. This is a day planner (1–12 hours), not a multi-day or turn-by-turn navigation app.
