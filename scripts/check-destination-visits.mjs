import { places } from '../src/lib/destinations.ts';
import { destinationVisits, visitReviewDue } from '../src/lib/destination-visits.ts';

const now = new Date();
const missing = places.filter(place => !destinationVisits[place.id]);
const obsolete = Object.keys(destinationVisits).filter(id => !places.some(place => place.id === id));
const due = places.filter(place => destinationVisits[place.id] && visitReviewDue(destinationVisits[place.id], now));
console.log(`Visit-information audit: ${places.length} destinations; ${missing.length} missing; ${obsolete.length} obsolete; ${due.length} overdue.`);
for (const place of missing) console.error(`MISSING ${place.id}`);
for (const id of obsolete) console.error(`OBSOLETE ${id}`);
for (const place of due) console.error(`REVIEW ${place.id}: source checked ${destinationVisits[place.id].checkedAt}`);
console.log('This audit checks coverage and review age, not source accuracy or live admission. Follow docs/destination-visits.md to review entries.');
if (missing.length || obsolete.length || due.length) process.exitCode = 1;
