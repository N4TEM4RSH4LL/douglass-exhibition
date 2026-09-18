# The Douglass Exhibition

An explorable 3D museum with five connected galleries, set inside an interpretive Maryland plantation landscape. Built in HTML, CSS and JavaScript with Three.js and Vite. Exhibition writing is intentionally absent: all interpretation, quotation and analysis surfaces remain blank.

## Experience

- Cinematic arrival across the grounds and through the front entrance.
- Five numbered galleries connected by a central hall.
- Clickable symbolic objects and blank interpretation panels.
- Guided tour, architectural cutaway, free walking, drag-to-look, touch joystick and fullscreen.
- Opt-in synthesized ambient sound; no recorded voices or autoplay.
- Physically based materials, sun and exhibit lighting, shadows, dust, animated foliage, fields, cabins, cart, jetty and water.
- Reduced-motion support and a performance toggle. No accounts, tracking, backend or credentials required.

## Controls

Click the entrance icon or a Roman numeral to visit a room. Drag the view to look around. Click a small circular exhibit marker to inspect a display; close its panel with the cross or Escape. The play icon starts a guided tour. The stacked-layers icon opens the architectural cutaway.

The walking icon enables WASD / arrow-key movement. Move the mouse when pointer lock is available, or drag to look. Shift moves faster. On touchscreens, use the movement pad and drag the view. Escape exits walking. H hides the interface, F toggles fullscreen, and number keys 1–5 choose rooms. Audio is off until enabled.

## Exhibition structure

The user's supplied `Exhibition.docx` was read as a reference for spatial requirements. Its writing tasks were not executed. The original document is not included in this repository.

| Gallery | Spatial program | Reserved content |
| --- | --- | --- |
| I | Four spokes around a broken-chain vitrine | Four control analyses, a turning point panel, resistance connection |
| II | Five vitrines joined by a brass route | Five events, internal freedom analysis, connection to resistance |
| III | Opposing triptychs and a central lectern | Three pairs of contradictions, a creative exhibit and extended analysis |
| IV | Six linked archive stations | Six identity stages, event / quotation / method / change interpretation, control of representation |
| V | Writing desk, suspended blank pages and eight quotation panels | Eight quotations, curator statement and synthesis |

Each interactive location has a stable slot ID, such as `r2-stage-3` or `r5-curator-statement`. Slots and geometry live in `src/world.js`; interactions live in `src/main.js`. Displaying a slot opens a deliberately blank analysis composition. No quotations, historical arguments or student answers are embedded in the visitor experience.

## Historical scope

This is an artistic museum environment inspired by the landscape and building types of Maryland's Eastern Shore. It is not an exact reconstruction of Wye House, Covey's farm, or a home owned or occupied by Douglass. The house is a contemporary exhibition adaptation. Symbolic objects are interpretive models, not representations of authenticated surviving artifacts.

The setting distinguishes a principal house from small timber outbuildings and agricultural land. Historical context was checked against the National Park Service's [The Homes of Frederick Douglass](https://www.nps.gov/articles/the-homes-of-frederick-douglass_teaching-with-historical-places.htm). The experience does not present an enslaver's house as Douglass's own home.

## Development

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

`dist/` is a static website. Relative asset paths support Vercel, GitHub Pages subpaths and other static hosts. The source HTML must be served through Vite during development; the built output can be served by any HTTP server.

## Asset acknowledgments

All modeled geometry and procedural textures / ambient sound were created for this project. The photographic textures below are by Poly Haven and distributed under [CC0](https://polyhaven.com/license):

- [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck)
- [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock)
- [Brown Mud Dry](https://polyhaven.com/a/brown_mud_dry)
- [Grey Roof Tiles](https://polyhaven.com/a/grey_roof_tiles)
- [Plastered Wall](https://polyhaven.com/a/plastered_wall)

Three.js is distributed under the MIT license. Cormorant Garamond, loaded through Google Fonts for the Roman numerals, uses the SIL Open Font License. Georgia is the local fallback.
