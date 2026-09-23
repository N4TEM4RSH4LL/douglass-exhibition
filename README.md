# The Douglass Exhibition

An explorable 3D museum with five connected galleries, set inside an interpretive Maryland plantation landscape. Built in HTML, CSS and JavaScript with Three.js and Vite. Classmates contribute through a shared exhibition studio. Their writing appears on the 3D screens and in readable exhibit views; no completed student answers are supplied.

## Experience

- A classroom title slide names Nate Marshall, Layla Decaires, Marianna McKenzie and Lucas Maguire, with a clear title, guiding question and original book cover. The title sheet fractures into the original cinematic arrival; Enter starts presentation mode, and a skip control / reduced-motion fade remains available. The Aa button reopens the slide.
- Separate **Start presentation** and **Explore full museum** modes. Presentation mode removes exploration controls and editing prompts, with large reading pages, room navigation and fullscreen. The full museum retains all exploration tools.
- Cinematic arrival across the grounds and through the front entrance.
- Five numbered galleries connected by a central hall.
- Clickable symbolic objects, live text panels and a room-by-room reading view.
- Assignment-specific editor with 37 entries, quotation references, word targets and a presentation checklist.
- Shared Postgres storage, individual field autosaves, conflict review, version history and JSON backups. Saves carry exact mutation identities, so continuing to type after your own save is acknowledged does not create a false classmate conflict. Tabs keep separate local drafts, with explicit recovery of unsaved work from closed tabs.
- Optional JPEG / PNG / WebP uploads, captions and credits for every entry. Photos appear on the physical museum screens, in full entries and in the room compositions.
- Control Map, Visual Journey, Contradiction Wall, Identity Archive and Curator’s Statement compositions use the assignment’s feature titles and connect saved writing and images in the requested order.
- A labelled icon inside each room opens its feature. The studio's **Edit [feature]** view edits that layout directly, using the same live fields, images, revision history and conflict handling as individual entries.
- Guided tour, architectural cutaway, free walking, drag-to-look, touch joystick and fullscreen.
- Opt-in synthesized ambient sound; no recorded voices or autoplay.
- Physically based materials, a photographed cloud panorama, distant shoreline, moving water, sun and exhibit lighting, shadows, dust, foliage, fields, cabins, cart and jetty.
- A rooster, four hens and two chicks forage around the front yard with independent walking, pecking and resting behavior. Exactly one mallard waddles around the house, visiting all five galleries through the doorways and pausing for visitors. Animals avoid walls, exhibits, fences, water and each other; articulated feet and moving contact shadows keep them grounded. Ambient animal movement pauses with reduced motion enabled.
- Continuous camera journeys follow rounded, collision-checked paths through the doorways, with the original entrance and hallway framing. Artifact close-ups return directly to the gallery view without turning towards the direction of movement. Room changes can be interrupted without jumping; camera turns have a bounded speed. Reduced-motion preferences use a fully covered fade.
- Reduced-motion support and a performance toggle. Public viewing; a class access key is required to share edits.

## Controls

For class, choose **Start presentation** on the title slide or open `/?mode=presentation`. Use Right Arrow / Page Down to open a room feature, advance through its filled entries, then move to the next room. Left Arrow / Page Up goes back. The navigation bar can skip directly between rooms; **F** toggles fullscreen. Room V returns to the title slide. **Exit presentation** switches to full exploration. A room can be linked directly with `/?mode=presentation#room=2`.

In the full museum:

Click the entrance icon or a Roman numeral to visit a room. Drag the view to look around. Click a small circular exhibit marker to inspect a display; close its panel with the cross or Escape. The play icon starts a guided tour. The stacked-layers icon opens the architectural cutaway.

The walking icon enables WASD / arrow-key movement. Move the mouse when pointer lock is available, or drag to look. Shift moves faster. On touchscreens, use the movement pad and drag the view. Escape exits walking. H hides the interface, F toggles fullscreen, and number keys 1–5 choose rooms. Audio is off until enabled.

## Exhibition structure

The user's supplied `Exhibition.docx` and updated `THE DOUGLASS EXHIBITION.pdf` were read as assignment references. The studio follows the brief's room names, questions, reading sections, minimum evidence counts and word targets. Its writing tasks were not executed. The source documents are not included in this repository. The studio converts their requirements into guided fields without filling in the students’ responses. Existing field IDs remain unchanged when labels are revised, so shared writing and version history are preserved. Optional titles, source details and supplementary analysis are marked in the editor.

| Gallery | Spatial program                                                | Reserved content                                                                                   |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| I       | Four Control Map panels around the chain artifact              | Four control analyses, a turning point panel, resistance connection                                |
| II      | Five vitrines joined by a brass route                          | Five events, internal freedom analysis, connection to resistance                                   |
| III     | Opposing triptychs and a central lectern                       | Three pairs of contradictions, a creative exhibit and extended analysis                            |
| IV      | Six linked archive stations                                    | Six identity stages, event / quotation / method / change interpretation, control of representation |
| V       | Writing desk, suspended blank pages and eight quotation panels | Eight quotations, curator statement and synthesis                                                  |

The room order follows the assignment: its thematic return to Chapters 9–10 in Room III is intentional. The five-event Visual Journey and six identity stages explicitly guide chronological ordering within those features. The prompts do not claim that the entire museum is a strictly linear biography.

Room II's isolated simplification is integrated: each of the five events has one main **Analysis** field, with optional title, quotation and image details. Earlier detailed responses remain accessible under **Earlier detailed responses (preserved)**. The museum uses the connected analysis when filled, otherwise it continues to display earlier responses. No saved writing is migrated or deleted. Presentation pages omit empty responses and preserve the assignment's room and event order.

Each interactive location has a stable slot ID, such as `r2-stage-3` or `r5-curator-statement`. Geometry lives in `src/world.js`; the shared content model and guidance live in `src/exhibition-schema.js`. `src/exhibition-content.js` draws saved content onto the screens and renders the full entry. No quotations, historical arguments or completed student answers are prefilled.

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

`dist/` contains the static museum and `editor.html`. Relative asset paths support Vercel and the GitHub Pages subpath. Vercel additionally serves `api/exhibition.js` (including the public read-only event stream); GitHub Pages uses the canonical Vercel API with an explicit CORS allowlist. Both hosts read and write the same exhibition.

For local shared editing, put server variables in `.env.local` (see `.env.example`), initialize the database once with `npm run db:setup`, then run `npm run dev:api` in a second terminal. Vite proxies `/api` to port 5174. Never expose `DATABASE_URL` or the class key through `VITE_` variables.

`npm test` checks the actual world’s shoreline, assignment bindings and all 36 camera routes against its collision geometry, plus 150 animated journeys including 125 interrupted room changes. It also independently raycasts the camera and its near plane against rendered walls and exhibit frames during III↔IV and IV↔V transitions, checks that artifact exits do not pan away first, and preserves the six-second entrance timing without advancing across delayed frames. Ten simulated minutes verify outdoor animal movement and separation, the duck’s circuit through all five rooms, clearance from rendered furniture, visitor pauses and reduced-motion behavior. `npm run test:persistence` uses an isolated random database namespace to verify auth, validation, concurrent writes, revision history, lost acknowledgements, offline drafts, stale focused edits and a real HTTP event stream. It removes only that test namespace afterward.

## Class workflow and saving

1. Open `/editor.html` or choose **Exhibition studio** in the museum.
2. Choose **Enter class key** and use the owner-supplied class key. An optional name or initials appears in version history; it is a display label, not an authenticated identity.
3. Select a room and an entry, or choose **Edit [feature]** to fill the visual layout directly. Each field explains exactly what belongs there, including exact quotations, references, authorial choices and artifact interpretations. Image uploads, captions and credits expand within each entry. Use **All fields** for its complete response form.
4. Typing writes an immediate browser draft and queues a shared save. Wait for **Live · all changes saved** (or **All changes saved to the shared exhibition** during fallback) before closing or presenting. A local-only draft is not yet visible to classmates.
5. The studio and museum receive live server-sent updates while visible. Saves handled by the same server instance broadcast immediately after the database commits; changes from other instances are picked up by a one-second database check. The connection renews automatically and falls back to a three-second refresh during interruptions. Physical screens show an excerpt; exhibit views show the complete submitted content. **Read Room** opens every entry without requiring precise 3D navigation.
6. Use **Version history** to restore previous saves, or **Download backup** to keep a portable JSON copy. **Restore from backup** previews the changed fields before queuing them. Downloaded backups contain writing, not the class access key.
7. Check the **Presentation checklist**. Its completion counts check filled fields and word targets; students still need to verify quotation accuracy, analytical quality, chronological order and the overall argument.

Each field has a database revision. Saving uses an atomic compare-and-swap operation and appends history in the same transaction. Different fields can save concurrently. Competing edits to the same field retain the local draft and shared version until the contributor chooses. Save identifiers make retries safe after a lost response. History is retained in the database and browsed in pages of 100 versions.

The class key is a shared editing capability. It is stored only for the browser session, sent as an authorization header, and checked against server-only SHA-256 hashes. `EDITOR_SECRET_HASH` preserves the original case-sensitive key; `EDITOR_CLASS_KEY_HASH` accepts a readable DOUGLASS code after removing separators and normalizing capitalization. Both can coexist. Full invitation links can also be pasted into the key field. Class invitation fragments are removed from the address bar after reading. Anyone given the key can edit the exhibition; keep it within the class. Neither the key nor database credentials belong in this repository. Rotate a compromised key by replacing the server hash and sharing the new key.

Uploaded images are resized in the browser to at most 1600 pixels on their longest edge and re-encoded before upload (at most 1 MB). The authenticated `/api/media` endpoint stores content-addressed bytes in the same Postgres database. Public image reads support both hosts. Images retain caption/credit fields and versioned references; JSON backups contain those references, not a standalone archive of image bytes. Replaced images remain available for history restoration.

The default database namespace is `douglass-main`; `EXHIBITION_ID` is server-controlled. Database/service availability and browser storage remain practical limits: errors retain drafts where browser storage is available and show that shared saving has not succeeded. Keep occasional downloaded backups. No deletion or reset endpoint is exposed.

## Asset acknowledgments

The opening and the author’s desk use the public-domain [1845 Narrative title-page scan](https://commons.wikimedia.org/wiki/File:LifeOfFrederickDouglassCover.jpg), originally from the University of North Carolina’s Documenting the American South collection. The desk is an interpretive model displaying a facsimile, not an authenticated possession.

All modeled geometry and procedural textures / ambient sound were created for this project. The photographic textures below are by Poly Haven and distributed under [CC0](https://polyhaven.com/license):

- [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck)
- [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock)
- [Brown Mud Dry](https://polyhaven.com/a/brown_mud_dry)
- [Grey Roof Tiles](https://polyhaven.com/a/grey_roof_tiles)
- [Plastered Wall](https://polyhaven.com/a/plastered_wall)
- [Kloofendal 38° Partly Cloudy Pure Sky](https://polyhaven.com/a/kloofendal_38d_partly_cloudy_puresky)

Three.js is distributed under the MIT license. Cormorant Garamond and DM Sans, loaded through Google Fonts, use the SIL Open Font License. Georgia is the local fallback.
