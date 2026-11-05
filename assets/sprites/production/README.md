# Production art

## Frozen scope

`inventory.json` freezes the 125 pre-existing semantic mappings, logical footprints,
tile anchors, transform permissions, variants, aliases and category fallbacks from
commit `08b18d9`. The replacement consists of eight atlas images and one separate
title illustration. No new species, mechanics, animation rig or cosmetic-pack
backlog is part of this pass. Condition/status, semantic zoom and unknown-state
rules remain renderer-owned. These are production replacements for the current
inventory, not a claim that deferred gameplay has final artwork.

| Sheet | Layout | Subjects |
| --- | --- | --- |
| underground-terrain | 3 × 3 | Rock, unknown space, excavation states, wall, floors, stairs |
| underground-equipment | 4 × 4 | Existing door states, workbench, furniture, utilities, containment |
| actors-goods | 4 × 3 | Existing scientist and slimes, stock, spills, rubble, remains |
| effects-markers | 4 × 3 | Existing hazard, incident, structural, combat and task cues |
| surface-terrain | 4 × 4 | Chemistry-front ground, floor, roof, walls, stairs, service topology |
| surface-equipment | 3 × 3 | Existing chemistry and water/waste/service machinery |
| surface-access | 4 × 3 | Existing personnel and freight access forms/states |
| surface-goods | 4 × 4 | Existing observable goods, waste, residue and plumes |

Shared mappings remain shared; ordinary and lawful freight deliberately select the
same source rectangle, so hidden legality/provenance cannot be inferred from art.
The set is shared by Madcap, Grim and Unbound. Living slimes have no faces,
speech, cooperative poses or equipment. Title art contains no new gameplay promise.

## Sources and provenance

All source PNGs in `source/` were generated for this approved replacement pass
with OpenAI's **built-in image_gen**, not the API/CLI fallback. No external artist,
franchise, stock illustration, trademark or third-party photograph was supplied
as a reference. `prompts.json` and `corrections.json` contain the exact base prompt set and corrections;
source and final-file SHA-256 hashes are recorded in `build-record.json`.
The surface-equipment correction used this pass's initial generated sheet as its
edit target, not a third-party image. A network-interrupted generation was retried
without switching providers or introducing an API credential requirement.

These project assets are distributed under the repository's [LICENSE](../../../LICENSE)
(all rights reserved); they are not an open-licensed asset pack. Generation is
disclosed here, not represented as a human artist commission or an assurance of
exclusive copyright protection. Historical development/placeholders are retained
outside this directory for reference, but no runtime manifest entry uses them.

## Mechanical packing

Run `node scripts/build-production-art.js` from the repository root with Node and
ImageMagick (`magick`) installed. Source PNGs remain unchanged. The script slices
equal grid cells, detects each visible subject's bounding box, crops, downsamples
and centers it without distorting its aspect ratio; it preserves generated alpha
inside each selected crop. It does not draw substitute sprites or chroma-key a
background. Faint fringe outside the detected subject bounds is excluded.

The packed sheets use 192-pixel slots, enough for the existing three-tile freight
door. Each actual source rectangle is **64 pixels per occupied tile**, e.g. 128 ×
64 for a 2 × 1 bench, 128 × 128 for a 2 × 2 tank, and 64 × 192 for a 1 × 3 freight
door. Transparent slot padding is not part of the source rectangle or physical
footprint. The center freight anchor remains `{ x: 0, y: 1, z: 0 }`.
Connected utility art reaches tile edges; standalone objects retain clear padding.
The access source has explicit reviewed row bounds in the inventory to exclude
freight endcaps that extend slightly above the nominal last-row boundary. No
neighboring-row fragments are included in personnel-door sprites.
The underground door slots reuse the reviewed overhead surface-access forms;
the first underground sheet's front-elevation door candidates are not packed.
PNG atlas alpha stays RGBA. Final metadata is stripped; the title is encoded as
WebP at `assets/art/title-key-art.webp` and remains separate from HTML menu text.

## Acceptance and limits

Focused tests compare every geometry/alias/fallback against the frozen inventory,
check dimensions/hashes and decoded memory bounds, exercise shared-source loading
and a whole-sheet failure, and load the actual images in Chromium. Physical
Canvas placement, multi-tile sprites, exact surface keys and the retained DOM
map are covered by the named sprite-loader cases. Contact sheets and title/map
screenshots support visual inspection at actual play sizes. Title art is purely
decorative, static, pointer-transparent and hidden for high/forced contrast; menu
labels, focus handling and controls remain native HTML. A missing illustration
leaves the existing backdrop and opaque menu usable.

This is not a cross-engine art/accessibility certification. The full test suite is
not required or run; the accessibility verification limits in `ACCESSIBILITY.md`
still apply. Future cosmetic variants remain outside this frozen inventory.

The ten unique focused checks passed. Re-run just these art-related cases with:

```sh
npx playwright test tests/production-art.spec.js tests/sprite-asset-loader.spec.js --project=chromium --workers=2
npx playwright test tests/title-screen.spec.js --project=chromium --grep 'title Settings persist independently'
```

Actual atlas files total 879,901 bytes (15,040,512 decoded RGBA bytes); the separate
title WebP is 275,302 bytes. The tests create temporary contact-sheet and physical
map captures, including underground 8px/64px views and ordinary/debug surface views.

One pre-existing uncatalogued surface fixture, the 2 × 1 starter waste enclosure,
cannot use the generic 1 × 1 cabinet image. It intentionally retains its procedural
footprint/glyph and placement diagnostic. The focused surface check names this
existing fallback explicitly and rejects other warnings; no image is stretched,
no physical size is changed, and no extra asset/mechanic prompt is created.
