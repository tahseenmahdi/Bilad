# Bilad / بلاد

A responsive bilingual Iraqi heritage experience built from the supplied Arctic Depths design and Malwiya assets.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. `npm run build` creates a static production export in `out/`; `npm run typecheck` checks TypeScript.

## Included

- Intact Malwiya hero, inverted L wordmark, atmospheric mesh, subtle scroll depth, and reduced-motion support.
- Five curated destinations, category filters, full story dialogs and an interactive geographic atlas.
- English/Arabic localization, RTL layout and persistent language preference.
- Save, remove and reorder destinations; browser persistence and text-file export.
- Opt-in original synthesized ambient wind, drone and plucked tones via Web Audio.
- Keyboard-accessible native dialogs and controls, visible focus and a skip link.

## Discovery guide

The guide is explicitly a local demo. It matches interests, place names and northern/southern region keywords against the five curated records. It makes no external AI calls. A live AI integration requires a server endpoint and a securely stored API credential; never add an API secret to client code.

The journey is a saved discovery list, not a transport/booking service or a scheduled route.

## Sources

User-supplied artwork is in `public/assets/`. Additional heritage photography is from Wikimedia Commons, with authors and licenses at `/credits/` and `public/assets/credits.json`. Historical records link to UNESCO. The Iraq outline is from world.geo.json; rivers are schematic.

## Deployment

`.openai/hosting.json` identifies the private Sites project and static `out/` directory. Publish the built export using the Sites workflow. No database, account system or API key is required.
