# Destination hours & access: editorial register

Bilad's manually maintained register lives in `src/lib/destination-visits.ts`.
It covers all 24 map destinations. The initial web-source review was 20 October
2026. This is a source-reading date, **not** an on-site inspection or confirmation
from each venue. No live availability feed or automated editorial service exists.

## Reader-facing policy

- Show reported hours only with a linked source. The source's publication/update
  date is shown where known. Al-Nouri's hours are explicitly a September 2025
  news report, not a freshly confirmed official timetable.
- Label variable schedules, public places and unconfirmed hours separately.
  Never translate a public road or an outdoor site into a 24-hour admission claim.
- Link each access note to the evidence supporting it. Unsourced recommendations
  are labelled Bilad planning advice; they do not assert admission rights.
- Distinguish official authorities (UNESCO and the shrine), independent editorial
  guides, commercial operator guides and news reporting. VisitKurdistan.com,
  IraqTourism.org, Visit-Iraq.com and Travel Tale are **not government sources**.
  Visit-Iraq.com's visitor guides are operator/editorial sources, not gate staff.
- UNESCO's conservation articles support restoration notes, not opening hours.
- Do not infer “open now”, accessible admission, safety, a fixed price, permission
  to climb, or a guaranteed booking from these records. The planning time budget
  still does not check an arrival time against these hours.

## Maintenance workflow

An editor must review every record at least every 30 days, and earlier after a
closure, holiday, major religious observance or operator notice. This is a manual
workflow, not a promise that a background service will update the data.

1. Run `npm run check:visits` (Node 22.18+ or newer with native TypeScript support).
   It exits non-zero for missing/obsolete IDs or overdue reviews. It checks age
   and coverage only; it cannot verify whether a source is accurate.
2. Open each cited page and inspect the full relevant passage. Prefer current
   venue/operator or public-authority information. Do not use a search snippet
   alone or copy hours from a map aggregator as verified admission times.
3. If sources conflict, are unavailable, or no longer support the claim, set the
   schedule to `unconfirmed`, remove unsupported details and state what visitors
   should confirm. Keep old reports clearly dated if they remain useful context.
4. Update that entry's `checkedAt` only after reviewing all its claims and links.
   The shared date is for the initial batch; future reviews should override it
   per record, e.g. `{ ...entry(hours, notes), checkedAt: 'YYYY-MM-DD' }`.
   Preserve a source's publication date rather than replacing it with today's date.
5. Run `node --test tests/*.test.mjs`, `npm run check:visits`, and `npm run build`.
   Check expanded destination information and itinerary accordions on mobile.

The UI automatically marks a record overdue after its 30-day review window,
using Baghdad midnight. This warns readers; it does **not** refresh the source.
The selected destination displays visiting hours in a highlighted box by default;
unconfirmed schedules use a cooler, neutral colour. Entrance animations respect
reduced-motion preferences. Access notes stay behind “Plan your visit”, while
itinerary rows keep their compact “Visit info” disclosure.
Opening it shows hours and access notes; numbered per-claim links point directly
to the evidence. “Sources & review” reveals the deduplicated publisher list,
source dates, review date and photo attribution. The destination image has a
fixed frame independent of the disclosure height.
When adding a destination, add its editorial record too; coverage tests enforce
an exact ID match with the destination catalog.

## Initial evidence highlights

- [Abbasid Palace / Travel Tale](https://traveltale.app/ar/iraq/baghdad/abbasid-palace):
  editorial listing of 09:00–16:00 daily, updated August 2026.
- [Al-Nouri / 964media](https://en.964media.com/39824/):
  September 2025 report of 10:00–22:00 daily.
- [Erbil Citadel / UNESCO](https://www.unesco.org/en/articles/reviving-world-heritage-site-erbil-citadel):
  conservation project; no visitor timetable established by this source.
- [Karbala / Iraq Tourism Guide](https://www.iraqtourism.org/karbala/):
  editorial report of round-the-clock shrine access; individual gate access
  and event arrangements still require local confirmation.

The complete per-claim source URLs and known publication dates are stored with
the records and shown directly in the website, not just in this document.
