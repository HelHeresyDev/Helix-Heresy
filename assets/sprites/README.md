# Map Sprite Assets

The map uses semantic keys from `sprite-asset-manifest.js`; simulation and `MapScene` data never contain file paths or loaded image objects. The Canvas renderer asks the shared loader for a key and retains its existing procedural or glyph presentation until an image is ready.

## Development Placeholders

Files under `placeholders/` are generated development assets, not final game art. The original individual placeholders remain, and four transparent 3 by 3 atlases now cover every semantic sprite family emitted by the current map renderer:

- `atlas-terrain-placeholders.png` - unknown space, excavation states, walls, room and rough floors, vertical connectors, and room anchors.
- `atlas-equipment-placeholders.png` - open, locked, sealed, and breached doors plus generic and footprint-specific fixtures.
- `atlas-actors-items-placeholders.png` - containers, pits, receptacles, spills, rubble, material piles, small and large remains, and the scientist.
- `atlas-effects-placeholders.png` - spills, structural failure, electricity, fire, magic, combat impact, and task states.
- Original individual files - natural rock, closed door, workbench, item stack, small and large slime, hazard pulse, and incident marker.

The generated images are 1254 by 1254 pixels because they are direct development-generation outputs. Atlas cells are 418 by 418 pixels; directional 2 by 1 fixtures use a centered 418 by 210 source rectangle. Exact source rectangles and logical footprints are declared in the manifest and validated when loaded. Future production assets should generally follow the visual-language target of approximately 64 source pixels per occupied tile.

To replace or add an asset, edit the manifest entry rather than adding a path to simulation or scene-building code. Keep paths relative and repository-local, declare the exact source and logical dimensions, and preserve a category fallback. `source.type: "atlas"` entries that share a path also share one decoded image in the loader; each semantic entry selects its own `sourceRect`.

Actor scene records request semantic variants from most to least specific: actor plus pose and facing, actor plus pose, actor plus facing, then the base actor key. For example, a west-facing feeding slime tries `actor.slime.pose.feeding.facing.west`, `actor.slime.pose.feeding`, `actor.slime.facing.west`, and `actor.slime`. Missing variants therefore continue to use the existing base sprite and static procedural state cues.

Every entry declares `logicalSize.width`, `logicalSize.height`, and `logicalSize.layers`. `placement.anchorTile` is an integer offset in the oriented output rectangle—not a source-pixel pivot—and aligns with the entity's `MapScene.anchorCell`; it must fit every orientation the asset permits. `placement.rotation` declares whether quarter-turn rotation is supported, while `placement.mirror` independently permits horizontal mirroring. A `sourceRect` may select a correctly proportioned region from a larger image without changing the source file.

Canvas rotates a canonical sprite within its complete logical rectangle; it never stretches a one-tile image across a larger entity. The logical rectangle, anchor, and layer count must exactly match the authoritative `MapScene` footprint bounds. A mismatch keeps the procedural footprint and anchor glyph visible and records a placement warning.

Missing files, invalid dimensions, image decode failures, unsupported transforms, and footprint mismatches are nonfatal. Diagnostics are available in the Debug performance panel, the Canvas renderer snapshot, and `window.helixHeresyDebug.spriteAssetSnapshot()`.

## Chemistry Front Development Set

`development/chemistry-front/` contains four generated, transparent bitmap atlases for the above-ground facility. These are coherent development art rather than the later production replacement pass:

- `atlas-surface-terrain.png` (1024 by 1024, 4 by 4) covers grass, gravel and exterior wear variants, laboratory/loading floors, roof and envelope pieces, the basement stair, and every surface-service-trunk topology.
- `atlas-surface-equipment.png` (768 by 768, 3 by 3) covers the underground service head, surface riser, cistern/pump, wet bench, reaction vessel, fume hood, analysis station, packaging station, and waste-treatment plant. Each manifest rectangle has the same aspect ratio and logical footprint as its physical fixture.
- `atlas-surface-access.png` (1024 by 768, 4 by 3) covers public and staff personnel doors, hazardous and basement security states, and the three-tile freight portal. The freight entries use a center anchor at `{ x: 0, y: 1 }`.
- `atlas-surface-goods-hazards.png` (1024 by 1024, 4 by 4) covers observable raw, intermediate, bulk, packaged, freight, waste, sludge, spill, vapor, leak, residue, and exhaust forms. It deliberately does not encode hidden legality or provenance into product appearance.

The source prompt set requested a restrained top-down industrial-chemistry style consistent across all four families, isolated orthographic game sprites in the listed grid order, no text or UI, no people, no cast shadows outside each object, and a flat magenta chroma background. The equipment and freight prompts additionally specified the authoritative 1-by-1, 1-by-2, 2-by-1, 2-by-2, and 1-by-3 footprint proportions. Images were generated with the built-in image generator, chroma-keyed to soft transparency, normalized to 256-pixel atlas slots, repacked without changing semantic identity, and visually inspected for cell bleed and stray alpha.

Manifest version 4 maps these atlases through exact semantic keys. Surface walls are classified as exterior or partition from physical enclosure, the loading floor remains distinct, service trunks derive endpoint/straight/corner/tee/cross art from neighboring physical segments, and surface doors retain their access family across operational states. The DOM map continues to use its semantic glyphs; Canvas can use these authored images without changing simulation state, hit testing, knowledge, or fallback behavior.
