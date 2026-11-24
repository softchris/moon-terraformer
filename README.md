# Moon Terraformer

Solve n8n-style workflow puzzles to land on the Moon, build a base and bring a telescope online.

## Run
ES modules need a web server (not file://):

    python3 -m http.server 8123     # then open http://localhost:8123

## Layout
- `js/engine/` mock n8n nodes + executor (IF, Set, HTTP Request, Merge, Filter, Sort, Limit)
- `js/levels/` one file per mission (briefing, data, validators)
- `js/canvas/editor.js` drag/drop workflow canvas
- `js/world.js`, `js/cutscenes.js` three.js moon, builds and cutscenes
- `assets/models/` Kenney Space Kit (CC0), see `assets/License.txt`

Add a mission: create `js/levels/levelN.js`, register it in `js/levels/index.js`, add a cutscene in `js/cutscenes.js`.
Dev console helpers: `__game.play('landing'|'base'|'telescope')`, `__game.setDone(n)`.

## Audio
- `js/audio.js`: sound effects from `sounds/Audio` (Kenney Sci-Fi Sounds, CC0) plus a procedurally generated ambient theme
  (detuned pads on a slow Dmaj9 → Bm9 → Gmaj7#11 → Asus2 loop, sub drone, sparse bell notes through delay and reverb).
  Music gets quieter in the editor and fuller in cutscenes. Press **M** or use the speaker button to mute.
- Effects are `.ogg`: fine in Chrome, Firefox and Edge; Safari needs 18.4+ (older versions just stay silent on effects).

## Textures
Moon: NASA LRO colour map, draped over displaced crater terrain. Earth: day map, clouds and atmosphere glow. Credits in `assets/textures/CREDITS.txt`.
The Moon radius is `R` in `js/world.js` (12; it was 5). Site layout is squeezed with `SCALE` so structures keep their spacing.
