# Stitch prompt — Bilad trip planner

Design a polished, responsive trip-planning page for **BILAD**, a cultural tourism website about Iraq. The product helps visitors choose a starting point, discover historical and natural places, and make a realistic day plan. Its local demo assistant is named **Milai**.

The direction is quiet, thoughtful travel editorial design. It should feel like a well-designed field guide with a useful map. Make it simple enough to understand in five seconds. Avoid the familiar AI dashboard aesthetic: no neon gradients, glass cards, glowing borders, sparkle icons, oversized mascots, decorative statistics, numbered section headings, or a grid of panels.

## Visual direction

- Keep the BILAD wordmark and the existing website's deep Iraqi-night blue identity in the map and introductory AI experience.
- Give the planner a light mist background around #EDF2EF, deep navy text and generously spaced, readable controls. Distinguish the tools with warm sand for setup, mint for nearby, soft blue for browsing, peach for the trip, and lilac for Milai. Expanded sections inherit their tool's pale surface and use dark text; destination cards have warm white backgrounds.
- Use a refined serif for one short heading, paired with a clear sans-serif for controls and descriptions. Keep Arabic place names readable as secondary labels in place details.
- Generous space, strong alignment, fine dividers, few containers, and small corner radii. One clear primary action. No decorative hero illustration.
- Destination photography should show the actual place. When a photo is unavailable, use a modest illustration or text treatment, never an unrelated landscape presented as that destination.

## Main desktop screen

A compact header has the BILAD wordmark, a back link, and the existing small three-dot switcher. The page heading is **“Make a day of it.”**

Keep all planning controls behind five compact, rounded buttons beneath the map: **Plan a trip**, **Nearby places**, **Browse all**, **Your trip**, and **Ask Milai**. Match the existing Ask Milai button's contraction and expansion treatment. Opening one replaces the button row with its section and a small three-dot switcher for the other options. Only one section is visible at a time. Clicking the section heading or pressing Escape restores the buttons. Preserve the trip and input values when switching.

The large, subdued Mapbox map is the visual anchor, spanning the content width. Keep streets readable but low contrast. Show small place pins, the supplied Milai mascot as the starting marker, numbered selected stops, and a thin sand-coloured road route. Avoid crowding pins with permanent labels.

**Plan a trip** reveals Starting from, a city selector, Drop a pin, Time available and Plan my day. Default time: four hours. The visitor chooses the start explicitly; no location permission prompt is needed. Creating a plan opens Your trip automatically.

**Your trip** contains total time, a quiet indication of the time budget, a compact stop sequence, travel time between stops, visit duration, and an optional return-to-start checkbox. Put reorder, remove, clear and detailed road directions in secondary positions. A new itinerary should have a short, natural empty state.

**Nearby places** reveals a clear **My starting point / Selected destination** switch. Default to the visitor's chosen starting city or custom pin; selecting a destination must not silently change that default. Allow the starting area to be chosen directly here. Show three suggestions, a small category selector (All places / History / Nature / Culture) and search. **Browse all** reveals the full collection. Each suggestion needs a name, location, brief, estimated visit time and one Add action. Selecting a marker or suggestion opens one compact place detail with a source link. Switching the nearby reference updates the map and distances while preserving the trip origin.

## Milai and interaction states

Milai is a local mock assistant, clearly but quietly labelled **Demo guide**. Use a small version of our supplied mascot only inside its conversation view. Example requests: “Plan 4 hours in Baghdad”, “Add Babylon”, “Remove Babylon”, “Show nearby places” and “Plan 8 hours of nature in Erbil”. Its response updates the same map and itinerary. Provide Undo and a clear way back to Your day.

Use believable destinations: Al-Mustansiriya, Al-Mutanabbi Street, Abbasid Palace, Aqar Quf, Taq Kasra, Babylon, Malwiya of Samarra, Erbil Citadel, Hatra, Ziggurat of Ur, Chibayish and the Marshes, Al-Nouri Mosque, Amedi, Dukan Lake, Gali Ali Beg, and Bekhal Waterfall.

Show a selected place, a three-stop Baghdad plan, an AI-edited plan, an over-time state, and unavailable-road-directions state. Real road directions must look different from a dashed estimate connecting stops. Visit durations are suggestions; do not invent opening hours, ratings, reviews, admission prices, or claims that a site is currently open.

## Mobile and motion

On mobile, prioritize the map and compact start/time controls. Use a compact expandable itinerary below the map or an unobtrusive bottom sheet; keep the map usable. Show nearby places as clean rows and Milai as a secondary view.

Use only purposeful motion: a gentle map pan on selection, a short fade for place details, and a smooth transition when a stop joins the itinerary. Approximately 180–300 ms for interface transitions; respect reduced motion. Preserve the existing animated two-button entrance to Map and Ask Milai, without adding motion everywhere.

Deliver high-fidelity desktop and mobile screens plus the key interaction states. Focus on spacing, hierarchy and usability; do not add extra product features or a marketing landing page.
