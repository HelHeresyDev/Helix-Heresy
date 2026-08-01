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
