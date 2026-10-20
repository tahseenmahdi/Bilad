type Point = readonly [number, number];
type Curve = { readonly c1: Point; readonly c2: Point; readonly end: Point };
type Seam = { readonly start: Point; readonly curves: readonly Curve[] };

// Source-image pixels (1024 × 1536). These curves trace the middle of the
// visible stair treads, between the dark inner edge and stepped outer parapet.
// Each seam stops at its own tier's right wall; the continuation stays above
// the wider tier below, so that tier's rim cannot hitch a ride as a thin tail.
const seams: readonly Seam[] = [
  { start: [427, 284], curves: [
    { c1: [467, 265], c2: [549, 248], end: [584, 243] },
    { c1: [590, 242], c2: [597, 241], end: [600, 241] },
  ] },
  { start: [382, 444], curves: [
    { c1: [428, 423], c2: [537, 408], end: [607, 401] },
    { c1: [609, 401], c2: [611, 400], end: [612, 400] },
  ] },
  { start: [332, 682], curves: [
    { c1: [389, 649], c2: [546, 632], end: [652, 622] },
    { c1: [654, 622], c2: [656, 621], end: [657, 621] },
  ] },
  { start: [284, 920], curves: [
    { c1: [357, 883], c2: [548, 866], end: [686, 845] },
    { c1: [692, 844], c2: [698, 842], end: [701, 840] },
  ] },
  { start: [237, 1169], curves: [
    { c1: [330, 1126], c2: [563, 1110], end: [736, 1084] },
    { c1: [742, 1083], c2: [748, 1082], end: [751, 1081] },
  ] },
  // The plinth has a horizontal masonry joint rather than a spiral stair.
  { start: [185, 1372], curves: [
    { c1: [340, 1374], c2: [637, 1374], end: [791, 1372] },
  ] },
];

function point([x, y]: Point, offset = 0) { return `${x} ${y + offset}`; }

function forward(seam: Seam, offset = 0) {
  return `L ${point(seam.start, offset)} ` + seam.curves.map(c =>
    `C ${point(c.c1, offset)} ${point(c.c2, offset)} ${point(c.end, offset)}`,
  ).join(' ');
}

function reverse(seam: Seam, offset = 0) {
  const end = seam.curves[seam.curves.length - 1].end;
  return `L ${point(end, offset)} ` + [...seam.curves].reverse().map((curve, index) => {
    const originalIndex = seam.curves.length - 1 - index;
    const previous = originalIndex === 0 ? seam.start : seam.curves[originalIndex - 1].end;
    return `C ${point(curve.c2, offset)} ${point(curve.c1, offset)} ${point(previous, offset)}`;
  }).join(' ');
}

// Continue each tread's curve across the exposed shoulder of the wider floor.
// The same contour drives the cut and feather, avoiding horizontal fade shelves.
const edgeSeams: readonly Seam[] = seams.map((seam, index) => {
  if (index === seams.length - 1) return seam;
  const [x, y] = seam.start;
  const [endX, endY] = seam.curves[seam.curves.length - 1].end;
  return {
    start: [0, y + 100],
    curves: [
      { c1: [x * .45, y + 100], c2: [x - 48, y + 24], end: seam.start },
      ...seam.curves,
      { c1: [endX + 64, endY - 16], c2: [900, endY - 32], end: [1024, endY - 32] },
    ],
  };
});

// Adjacent floors share the same curve, with a subpixel overlap to avoid seams.
export const floorClipPaths = Array.from({ length: edgeSeams.length + 1 }, (_, index) => {
  const top = edgeSeams[index - 1];
  const bottom = edgeSeams[index];
  let path = top
    ? `M 0 ${top.start[1] - .65} ${forward(top, -.65)} L 1024 ${top.curves[top.curves.length - 1].end[1] - .65}`
    : 'M 0 0 L 1024 0';
  path += bottom
    ? ` L 1024 ${bottom.curves[bottom.curves.length - 1].end[1] + .65} ${reverse(bottom, .65)} L 0 ${bottom.start[1] + .65} Z`
    : ' L 1024 1536 L 0 1536 Z';
  return path;
});

// One shared outline preserves the tower silhouette, without carrying the
// photograph's surrounding glow upward with the individual floors.
export const towerOutline = 'M 445 103 C 454 87 550 87 572 103 L 579 123 C 593 128 601 143 601 163 L 603 241 L 615 246 L 615 400 L 658 404 L 661 626 L 700 627 L 704 848 L 749 851 L 753 1083 L 790 1089 L 794 1371 L 807 1377 L 807 1394 L 882 1425 L 882 1499 L 142 1499 L 143 1416 L 154 1401 L 154 1375 L 180 1369 L 181 1233 C 182 1197 199 1180 235 1165 L 235 994 C 235 963 248 948 281 925 L 281 759 C 281 725 299 705 329 683 L 329 511 C 329 477 348 465 378 445 L 378 356 C 378 327 395 309 424 288 L 424 175 C 424 150 431 139 443 133 Z';

export const clipCoordinateScale = 'scale(0.0009765625 0.0006510416666666666)';
export const staircaseSeamPaths = edgeSeams.map(seam => `M ${point(seam.start)} ${forward(seam)}`);
// Center of each visible curved tread for camera framing.
export const seamFocusY = seams.map(seam => (seam.start[1] + seam.curves[0].end[1]) / 2);
