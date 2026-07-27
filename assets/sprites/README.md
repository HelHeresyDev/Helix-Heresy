# Map Sprite Assets

The map uses semantic keys from `sprite-asset-manifest.js`; simulation and `MapScene` data never contain file paths or loaded image objects. The Canvas renderer asks the shared loader for a key and retains its existing procedural or glyph presentation until an image is ready.

## Development Placeholders

Files under `placeholders/` are generated development assets, not final game art. They intentionally cover one representative asset in each current category:

- `tile.solidEarth` - terrain
- `door.closed` - fixture
- `fixture.basicWorkbench` - directional 2 by 1 fixture
- `item.stack` - item
- `actor.slime` - actor
- `actor.slime.large` - 2 by 2 large actor
- `effect.hazard.pulse` - effect
- `marker.incident` - map marker

These initial images are 1254 by 1254 pixels because they are direct development-generation outputs. Their exact dimensions are declared in the manifest and validated when loaded. Future production assets should generally follow the visual-language target of approximately 64 source pixels per occupied tile.

To replace or add an asset, edit the manifest entry rather than adding a path to simulation or scene-building code. Keep paths relative and repository-local, declare the exact source and logical dimensions, and preserve a category fallback. The schema already reserves `source.type: "atlas"` for a later atlas implementation; the current loader supports individual images.

Actor scene records request semantic variants from most to least specific: actor plus pose and facing, actor plus pose, actor plus facing, then the base actor key. For example, a west-facing feeding slime tries `actor.slime.pose.feeding.facing.west`, `actor.slime.pose.feeding`, `actor.slime.facing.west`, and `actor.slime`. Missing variants therefore continue to use the existing base sprite and static procedural state cues.

Every entry declares `logicalSize.width`, `logicalSize.height`, and `logicalSize.layers`. `placement.anchorTile` is an integer offset in the oriented output rectangle—not a source-pixel pivot—and aligns with the entity's `MapScene.anchorCell`; it must fit every orientation the asset permits. `placement.rotation` declares whether quarter-turn rotation is supported, while `placement.mirror` independently permits horizontal mirroring. A `sourceRect` may select a correctly proportioned region from a larger image without changing the source file.

Canvas rotates a canonical sprite within its complete logical rectangle; it never stretches a one-tile image across a larger entity. The logical rectangle, anchor, and layer count must exactly match the authoritative `MapScene` footprint bounds. A mismatch keeps the procedural footprint and anchor glyph visible and records a placement warning.

Missing files, invalid dimensions, image decode failures, unsupported transforms, and footprint mismatches are nonfatal. Diagnostics are available in the Debug performance panel, the Canvas renderer snapshot, and `window.helixHeresyDebug.spriteAssetSnapshot()`.
