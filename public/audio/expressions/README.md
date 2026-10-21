# Voice recordings

The current clips are human recordings supplied in `public/audio/normal expressions`
and split in the exact order listed in the project documentation. File names match the `id`
in `src/lib/expressions.ts` (for example `hala.mp3` and `chai.mp3`).
Rebuild the site after adding recordings: the page detects available files
at build time and enables only those playback controls.

Record the Arabic phrase only, at a natural, clear pace, with consistent
volume and little background noise. Have the Iraqi speaker review each
phrase and its intended meaning before recording.

The source file is preserved in `../normal expressions/`. Each clip has been
trimmed at the pauses and normalized for consistent playback.

The generation script remains available for future fallback testing, but it is
not used by the current page. Missing recordings show “Voice coming soon”.
Playback never starts automatically.
