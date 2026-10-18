# Bilad / بلاد

A minimal Malwiya experience: BILAD, the tower, atmospheric lighting and sparse embers.

Run `npm install` and `npm run dev` to preview. `npm run build` exports the production website to `out/`.

## Scroll prototype

The scene stays pinned across seven viewport heights, with seven fixed poses: the intact tower and six successive splits. Crossing each half-viewport threshold selects a pose, and a one-second eased transition carries the floors to their fixed positions. After scrolling pauses, the page settles to that pose's viewport stop. Touch gestures finish before snapping. Reversing scroll reassembles the tower.

Seven CSS-clipped copies of the same source photograph align on one 2:3 canvas. The camera gently zooms and centers the newest gap; curved SVG masks feather the lifted floors' bottom edges and restore them on reassembly. The wordmark dims during close-ups. Shared cubic cut paths follow the middle of the staircase bands in `src/components/tower-clips.ts`, with a subpixel overlap for clean reassembly. No separate floor image files are needed.

The exposed surfaces are flat image cuts, not reconstructed interiors or 3D geometry. Reduced-motion users see the intact, static tower without the long scroll track. Desktop cursor parallax, the opening fade, shared camera movement, slow light shift and decorative embers remain supported.

The original tower image is supplied by the user.
