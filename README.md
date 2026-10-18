# Bilad / بلاد

A minimal Malwiya experience: BILAD, the tower, atmospheric lighting and sparse embers.

Run `npm install` and `npm run dev` to preview. `npm run build` exports the production website to `out/`.

## Scroll prototype

The scene stays pinned across eight viewport heights. Seven CSS-clipped copies of the same source photograph align on one 2:3 canvas. Each viewport of scrolling lifts the next tier, starting with the crown; reversing scroll reassembles the tower. The cut polygons follow the source photograph’s spiral seams and can be adjusted in `src/components/Bilad.tsx`. No separate floor image files are needed.

The exposed surfaces are flat image cuts, not reconstructed interiors or 3D geometry. Reduced-motion users see the intact, static tower without the long scroll track. Desktop cursor parallax, the opening fade, shared camera movement, slow light shift and decorative embers remain supported.

The original tower image is supplied by the user.
