# Map Sprite Assets

The map uses semantic keys from `sprite-asset-manifest.js`; simulation and `MapScene` data never contain file paths or loaded image objects. The Canvas renderer asks the shared loader for a key and retains its existing procedural or glyph presentation until an image is ready.

## Development Placeholders

Files under `placeholders/` are generated development assets, not final game art. They intentionally cover one representative asset in each current category:

- `tile.solidEarth` - terrain
- `door.closed` - fixture
- `item.stack` - item
- `actor.slime` - actor
- `effect.hazard.pulse` - effect
- `marker.incident` - map marker

These initial images are 1254 by 1254 pixels because they are direct development-generation outputs. Their exact dimensions are declared in the manifest and validated when loaded. Future production assets should generally follow the visual-language target of approximately 64 source pixels per occupied tile.

To replace or add an asset, edit the manifest entry rather than adding a path to simulation or scene-building code. Keep paths relative and repository-local, declare the exact source and logical dimensions, and preserve a category fallback. The schema already reserves `source.type: "atlas"` for a later atlas implementation; the current loader supports individual images.

Missing files, invalid dimensions, and image decode failures are nonfatal. Diagnostics are available in the Debug performance panel and through `window.helixHeresyDebug.spriteAssetSnapshot()`.
