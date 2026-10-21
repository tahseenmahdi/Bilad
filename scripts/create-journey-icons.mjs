import { mkdirSync, writeFileSync } from 'node:fs';

// One visual language: rounded strokes, quiet translucent fills, and an aqua highlight.
const groups = [
  { key: 'ideas', color: '#a0edfa', names: ['A spark of possibility', 'A bright idea', 'A saved inspiration'], icons: [
    '<path d="M48 20c3 17 11 25 28 28-17 3-25 11-28 28-3-17-11-25-28-28 17-3 25-11 28-28Z" fill="url(#ink)"/><path d="M72 17v12m-6-6h12M24 69v10m-5-5h10"/><path d="M24 29a31 31 0 0 1 31-11M72 67a31 31 0 0 1-29 12" opacity=".28"/>',
    '<path d="M34 58a22 22 0 1 1 28 0c-4 3-5 6-5 10H39c0-4-1-7-5-10Z" fill="url(#ink)"/><path d="M39 75h18m-14 7h10M48 68V47m-9-5 9 5 9-5M48 8v5M17 24l5 4m52-4-5 4"/>',
    '<path d="M30 18h36a5 5 0 0 1 5 5v57L48 66 25 80V23a5 5 0 0 1 5-5Z" fill="url(#ink)"/><path d="m48 29 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z"/>',
  ] },
  { key: 'planned', color: '#84ccf1', names: ['A path taking shape', 'A day set aside', 'A direction to follow'], icons: [
    '<path d="M28 67h31a13 13 0 0 0 0-26H38a12 12 0 0 1 0-24h20" opacity=".55"/><circle cx="27" cy="67" r="9" fill="url(#ink)"/><circle cx="27" cy="67" r="2" fill="currentColor" stroke="none"/><path d="m57 11 8 6-8 6M73 45c0-12-18-12-18 0 0 7 9 16 9 16s9-9 9-16Z" fill="url(#ink)"/><circle cx="64" cy="44" r="2.5" fill="currentColor" stroke="none"/>',
    '<rect x="20" y="23" width="56" height="54" rx="10" fill="url(#ink)"/><path d="M33 17v13m30-13v13M20 39h56m-42 13h5m11 0h5m-21 12h5m11 0h5"/><circle cx="65" cy="64" r="14" fill="#12374e"/><path d="m59 64 4 4 9-10"/>',
    '<circle cx="48" cy="48" r="29" fill="url(#ink)"/><path d="m59 35-6 18-18 8 7-19Z" fill="url(#ink)"/><path d="m42 42 11 11M48 12v7m0 58v7M12 48h7m58 0h7"/><circle cx="48" cy="48" r="2" fill="currentColor" stroke="none"/>',
  ] },
  { key: 'done', color: '#8ce4f2', names: ['A memory to keep', 'A journey complete', 'A moment collected'], icons: [
    '<path d="m22 31-5-3a5 5 0 0 0-7 4l-1 42a5 5 0 0 0 5 5l40 1" opacity=".35"/><rect x="23" y="19" width="53" height="57" rx="9" fill="url(#ink)"/><path d="M24 63h51M50 52 38 41a8 8 0 0 1 12-10 8 8 0 0 1 12 10Z" fill="url(#ink)"/><path d="M70 11v10m-5-5h10"/>',
    '<circle cx="48" cy="45" r="27" fill="url(#ink)"/><path d="m36 45 8 8 17-18M30 66l-5 16 13-5 10 7 2-12m16-7 5 17-13-5"/><path d="M73 17v10m-5-5h10" opacity=".6"/>',
    '<path d="m26 25-6-2a5 5 0 0 0-6 5L9 67a5 5 0 0 0 4 6l39 5" opacity=".35"/><rect x="26" y="17" width="53" height="58" rx="8" fill="url(#ink)"/><path d="M27 62h51m-15-34 3 7 8 1-6 6 1 8-6-4-7 4 1-8-6-6 8-1Z"/><path d="m35 54 8-9 9 9" opacity=".6"/>',
  ] },
];

const defs = color => `<defs><linearGradient id="ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity=".03"/></linearGradient></defs>`;
const wrap = (group, index) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" color="${group.color}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><title>${group.names[index]}</title>${defs(group.color)}${group.icons[index]}</svg>\n`;
mkdirSync('public/assets/journey-icons', { recursive: true });
for (const group of groups) group.icons.forEach((_, index) => writeFileSync(`public/assets/journey-icons/${group.key}-${index + 1}.svg`, wrap(group, index)));

// A self-contained review sheet keeps all nine alternatives easy to compare and export.
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="890" viewBox="0 0 960 890"><rect width="960" height="890" rx="32" fill="#07151e"/><g font-family="Arial,sans-serif"><text x="56" y="66" fill="#ecfaff" font-size="28">Memory Journeys</text><text x="56" y="96" fill="#95b9cc" font-size="14">Three minimal directions for Ideas, Planned, and Done. Column 01 is used on the website.</text>${groups.map((group, row) => `<text x="56" y="${145 + row * 244}" fill="${group.color}" font-size="13" letter-spacing="2">${group.key.toUpperCase()}</text>${group.icons.map((_, col) => `<g transform="translate(${56 + col * 290} ${163 + row * 244})"><rect width="268" height="205" rx="20" fill="#0c2636" stroke="#315c736e"/><image x="86" y="22" width="96" height="96" href="data:image/svg+xml;base64,${Buffer.from(wrap(group, col)).toString('base64')}"/><text x="22" y="153" fill="#ecfaff" font-size="14">${group.names[col]}</text><text x="22" y="180" fill="#95b9cc" font-size="11">0${col + 1}${col === 0 ? ' · Selected' : ''}</text></g>`).join('')}`).join('')}</g></svg>`;
mkdirSync('docs/previews', { recursive: true });
writeFileSync('docs/previews/memory-journeys-icon-options.svg', sheet);
