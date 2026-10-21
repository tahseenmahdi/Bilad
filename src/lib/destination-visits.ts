export type VisitSource = { name: string; url: string; type: 'official' | 'editorial' | 'reporting'; publishedAt?: string };
export type DestinationVisit = {
  hours: { status: 'reported' | 'variable' | 'unconfirmed' | 'public-space'; text: string; source?: VisitSource };
  notes: { text: string; source?: VisitSource }[];
  checkedAt: string;
  reviewAfterDays: number;
};

const sources = {
  palace: { name: 'Travel Tale', url: 'https://traveltale.app/ar/iraq/baghdad/abbasid-palace', type: 'editorial', publishedAt: '2026-08-09' },
  baghdad: { name: 'Iraq Tourism Guide', url: 'https://www.iraqtourism.org/old-baghdad/', type: 'editorial' },
  dayTrips: { name: 'Iraq Tourism Guide', url: 'https://www.iraqtourism.org/day-trips-from-baghdad/', type: 'editorial' },
  babylon: { name: 'Visit Iraq', url: 'https://visit-iraq.com/en/places/babylon-ancient-site', type: 'editorial', publishedAt: '2025-11-22' },
  samarra: { name: 'Iraq Tourism Guide', url: 'https://www.iraqtourism.org/al-askari-shrine/', type: 'editorial', publishedAt: '2026-09-12' },
  erbil: { name: 'UNESCO', url: 'https://www.unesco.org/en/articles/reviving-world-heritage-site-erbil-citadel', type: 'official', publishedAt: '2026-06-10' },
  hatra: { name: 'Visit Iraq', url: 'https://visit-iraq.com/en/adventures/hatra-ruins', type: 'editorial' },
  ur: { name: 'Visit Iraq', url: 'https://visit-iraq.com/en/faq/is-the-ziggurat-of-ur-open-to-tourists', type: 'editorial' },
  urAccess: { name: 'Visit Iraq', url: 'https://visit-iraq.com/en/adventures/ziggurat-of-ur', type: 'editorial' },
  marshes: { name: 'Visit Iraq', url: 'https://visit-iraq.com/en/places/central-marshes-heart-of-the-marshland-ecosystem', type: 'editorial' },
  nuri: { name: '964media', url: 'https://en.964media.com/39824/', type: 'reporting', publishedAt: '2025-09-02' },
  nuriOfficial: { name: 'UNESCO', url: 'https://www.unesco.org/en/articles/milestone-mosul-iraq-inaugurates-iconic-landmarks-rehabilitated-unesco', type: 'official', publishedAt: '2025-09-03' },
  amedi: { name: 'VisitKurdistan.com', url: 'https://www.visitkurdistan.com/amadiyah/', type: 'editorial' },
  dukan: { name: 'VisitKurdistan.com', url: 'https://www.visitkurdistan.com/dukan-lake/', type: 'editorial' },
  rawanduz: { name: 'VisitKurdistan.com', url: 'https://www.visitkurdistan.com/rawanduz/', type: 'editorial' },
  ashur: { name: 'Visit Iraq', url: 'https://visit-iraq.com/en/places/ashur-ancient-city', type: 'editorial', publishedAt: '2025-12-29' },
  lalish: { name: 'VisitKurdistan.com', url: 'https://www.visitkurdistan.com/lalish/', type: 'editorial' },
  kirkuk: { name: 'Visit Iraq', url: 'https://visit-iraq.com/en/places/kirkuk-citadel', type: 'editorial' },
  wadi: { name: 'Iraq Tourism Guide', url: 'https://www.iraqtourism.org/wadi-al-salam/', type: 'editorial', publishedAt: '2026-09-10' },
  karbala: { name: 'Iraq Tourism Guide', url: 'https://www.iraqtourism.org/karbala/', type: 'editorial', publishedAt: '2026-09-26' },
  shrine: { name: 'Imam Hussain Holy Shrine', url: 'https://imamhussain.org/english/51874', type: 'official', publishedAt: '2026-06-24' },
} satisfies Record<string, VisitSource>;

const checkedAt = '2026-10-20';
const entry = (hours: DestinationVisit['hours'], notes: DestinationVisit['notes']): DestinationVisit => ({ hours, notes, checkedAt, reviewAfterDays: 30 });
const unconfirmed = (text = 'Visitor hours unconfirmed'): DestinationVisit['hours'] => ({ status: 'unconfirmed', text });

// Bilad's manually maintained visitor-information register. A source check is
// not an on-site verification. Never infer "open now" from these records.
export const destinationVisits: Record<string, DestinationVisit> = {
  mustansiriya: entry(unconfirmed(), [
    { text: 'Published hours conflict; confirm interior access locally before planning your visit.', source: sources.baghdad },
  ]),
  mutanabbi: entry({ status: 'public-space', text: 'Public street · individual shop hours vary', source: sources.baghdad }, [
    { text: 'Friday is the main book-market day; cafés and bookshops keep their own hours.', source: sources.baghdad },
  ]),
  abbasid: entry({ status: 'reported', text: 'Daily 09:00–16:00 · editorial listing', source: sources.palace }, [
    { text: 'The listing requests modest dress and no touching the historic surfaces. Confirm admission on the day.', source: sources.palace },
  ]),
  'aqar-quf': entry(unconfirmed(), [
    { text: 'An exposed site with little shade; plan for sun and bring water.', source: sources.dayTrips },
  ]),
  ctesiphon: entry(unconfirmed('Gate hours unconfirmed'), [
    { text: 'Confirm the current gate arrangements locally. A public exterior view does not confirm admission beneath the arch.' },
  ]),
  babylon: entry({ status: 'variable', text: 'Morning to before sunset · exact gate times unconfirmed', source: sources.babylon }, [
    { text: 'The guide reports ID and bag checks and limited on-site supplies; take water.', source: sources.babylon },
  ]),
  samarra: entry(unconfirmed(), [
    { text: 'Reports disagree on whether the minaret ramp is accessible; confirm climbing permission before travel.', source: sources.samarra },
  ]),
  'erbil-citadel': entry(unconfirmed('Visitor timetable unconfirmed · restoration project'), [
    { text: 'UNESCO documents a four-year conservation project. Ask which areas admit visitors before planning an interior visit.', source: sources.erbil },
  ]),
  hatra: entry(unconfirmed(), [
    { text: 'The operator lists this as a guided visit with uneven terrain. Confirm entry arrangements before setting out.', source: sources.hatra },
  ]),
  ur: entry({ status: 'variable', text: 'Daily morning to before sunset · operator report', source: sources.ur }, [
    { text: 'Archaeological ground is uneven; reaching the upper stairway requires climbing steps.', source: sources.urAccess },
  ]),
  marshes: entry({ status: 'variable', text: 'Boat departures depend on local arrangements', source: sources.marshes }, [
    { text: 'Confirm water levels and boat routes before travel; facilities are limited within the wetlands.', source: sources.marshes },
  ]),
  'al-nuri': entry({ status: 'reported', text: 'Daily 10:00–22:00 · reported September 2025', source: sources.nuri }, [
    { text: 'UNESCO confirms the restored complex was inaugurated in September 2025. Ask staff about visitor access during worship.', source: sources.nuriOfficial },
  ]),
  amedi: entry({ status: 'public-space', text: 'Town visit · individual monument hours unconfirmed', source: sources.amedi }, [
    { text: 'The plateau town can be explored on foot; individual buildings have separate entry arrangements.', source: sources.amedi },
  ]),
  dukan: entry({ status: 'variable', text: 'Shore access and boat schedules vary', source: sources.dukan }, [
    { text: 'Agree the boat route and price before departure, and check for life jackets.', source: sources.dukan },
  ]),
  'gali-ali-beg': entry(unconfirmed('Gate and parking hours unconfirmed'), [
    { text: 'Viewing paths and platforms are reported; confirm any entry or parking charge locally.', source: sources.rawanduz },
  ]),
  bekhal: entry(unconfirmed('Visitor and café hours unconfirmed'), [
    { text: 'Stairs follow the cascades. Wear shoes with grip on wet surfaces.', source: sources.rawanduz },
  ]),
  ashur: entry(unconfirmed('Access requires confirmation before travel'), [
    { text: 'A dated operator guide advises against visiting. Obtain current access advice rather than relying on a map pin.', source: sources.ashur },
  ]),
  lalish: entry(unconfirmed('Temple visitor hours unconfirmed'), [
    { text: 'Go barefoot in sacred areas, avoid stepping on thresholds, and ask before interior photography.', source: sources.lalish },
  ]),
  'kirkuk-citadel': entry(unconfirmed('Individual building access unconfirmed'), [
    { text: 'The guide describes access by a ramp to the open-air citadel; confirm which buildings are admitting visitors.', source: sources.kirkuk },
  ]),
  ukhaidir: entry(unconfirmed(), [
    { text: 'Approach roads require a private vehicle; the fortress is exposed to the sun.', source: sources.dayTrips },
  ]),
  'wadi-al-salam': entry({ status: 'public-space', text: 'Working cemetery · no published visitor timetable', source: sources.wadi }, [
    { text: 'Use the lanes, avoid walking on graves, and give funerals and grieving families privacy.', source: sources.wadi },
  ]),
  'imam-husayn': entry({ status: 'reported', text: '24-hour access reported · individual gates may vary', source: sources.karbala }, [
    { text: 'Observe the local dress code and confirm gate procedures with staff.', source: sources.karbala },
    { text: 'The shrine describes extra luggage storage and visitor services during Ashura; arrangements vary with observances.', source: sources.shrine },
  ]),
  korek: entry({ status: 'variable', text: 'Cable-car times vary with season and weather', source: sources.rawanduz }, [
    { text: 'Confirm the last return cable car with the operator before going up.', source: sources.rawanduz },
  ]),
  'rawanduz-canyon': entry({ status: 'public-space', text: 'Roadside viewpoints · no fixed visitor timetable', source: sources.rawanduz }, [
    { text: 'Mountain roads are narrow and winding; conditions can worsen after rain or in winter.', source: sources.rawanduz },
  ]),
};

export function visitReviewDue(info: DestinationVisit, at: Date): boolean {
  return at.getTime() >= Date.parse(`${info.checkedAt}T00:00:00+03:00`) + info.reviewAfterDays * 86400000;
}

export function getDestinationVisit(id: string): DestinationVisit | undefined {
  return destinationVisits[id];
}
