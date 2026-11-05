(function attachHelixSpriteAssetManifest(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixSpriteAssetManifest = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixSpriteAssetManifest() {
  "use strict";

  // Schema revision, not a game release. Frozen art/geometry contract:
  // assets/sprites/production/inventory.json. Pack artwork with scripts/build-production-art.js.
  const MANIFEST_VERSION = 4;
  const ASSET_CATEGORIES = Object.freeze(["terrain", "fixture", "item", "actor", "effect", "marker"]);
  const SLOT_PX = 192;
  const SOURCE_PX_PER_TILE = 64;
  const atlasLayouts = {"underground-terrain":{"columns":3,"rows":3},"underground-equipment":{"columns":4,"rows":4},"actors-goods":{"columns":4,"rows":3},"effects-markers":{"columns":4,"rows":3},"surface-terrain":{"columns":4,"rows":4},"surface-equipment":{"columns":3,"rows":3},"surface-access":{"columns":4,"rows":3},"surface-goods":{"columns":4,"rows":4}};

  function asset(key, category, atlas, slot, width, height, rotation, mirror, anchorY = 0, variants = []) {
    const layout = atlasLayouts[atlas];
    const rectWidth = width * SOURCE_PX_PER_TILE;
    const rectHeight = height * SOURCE_PX_PER_TILE;
    return {
      key, category,
      source: { type: "atlas", path: `assets/sprites/production/${atlas}.png` },
      sourceSize: { width: layout.columns * SLOT_PX, height: layout.rows * SLOT_PX },
      sourceRect: {
        x: (slot % layout.columns) * SLOT_PX + (SLOT_PX - rectWidth) / 2,
        y: Math.floor(slot / layout.columns) * SLOT_PX + (SLOT_PX - rectHeight) / 2,
        width: rectWidth, height: rectHeight
      },
      logicalSize: { width, height, layers: 1 },
      placement: { anchorTile: { x: 0, y: anchorY, z: 0 }, rotation, mirror },
      variants, placeholder: false, development: false, production: true, generated: true
    };
  }

  const manifest = {
    id: "helix-heresy-map-sprites",
    version: MANIFEST_VERSION,
    sourceScalePxPerTile: SOURCE_PX_PER_TILE,
    assets: [
      asset("tile.solidEarth", "terrain", "underground-terrain", 0, 1, 1, "none", "none", 0, []),
      asset("door.closed", "fixture", "underground-equipment", 0, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.basicWorkbench", "fixture", "underground-equipment", 1, 2, 1, "quarterTurns", "none", 0, []),
      asset("item.stack", "item", "actors-goods", 0, 1, 1, "none", "none", 0, []),
      asset("actor.slime", "actor", "actors-goods", 1, 1, 1, "none", "horizontal", 0, []),
      asset("actor.slime.large", "actor", "actors-goods", 2, 2, 2, "none", "horizontal", 0, []),
      asset("effect.hazard.pulse", "effect", "effects-markers", 0, 1, 1, "none", "none", 0, []),
      asset("marker.incident", "marker", "effects-markers", 1, 1, 1, "none", "none", 0, ["stack"]),
      asset("tile.unknownDark", "terrain", "underground-terrain", 1, 1, 1, "none", "none", 0, []),
      asset("tile.draftExcavation.valid", "terrain", "underground-terrain", 2, 1, 1, "none", "none", 0, []),
      asset("tile.draftExcavation.invalid", "terrain", "underground-terrain", 3, 1, 1, "none", "none", 0, []),
      asset("tile.plannedExcavation", "terrain", "underground-terrain", 4, 1, 1, "none", "none", 0, []),
      asset("tile.wall", "terrain", "underground-terrain", 5, 1, 1, "none", "none", 0, []),
      asset("tile.room", "terrain", "underground-terrain", 6, 1, 1, "none", "none", 0, []),
      asset("tile.floor", "terrain", "underground-terrain", 7, 1, 1, "none", "none", 0, []),
      asset("tile.vertical", "terrain", "underground-terrain", 8, 1, 1, "none", "none", 0, []),
      asset("door.open", "fixture", "underground-equipment", 2, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.locked", "fixture", "underground-equipment", 3, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.sealed", "fixture", "underground-equipment", 4, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.breached", "fixture", "underground-equipment", 5, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.generic", "fixture", "underground-equipment", 6, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.bed", "fixture", "underground-equipment", 7, 2, 1, "quarterTurns", "none", 0, []),
      asset("fixture.storageShelf", "fixture", "underground-equipment", 8, 2, 1, "quarterTurns", "none", 0, []),
      asset("fixture.sumpTank", "fixture", "underground-equipment", 9, 2, 2, "quarterTurns", "none", 0, []),
      asset("fixture.fuelGenerator", "fixture", "underground-equipment", 10, 2, 1, "quarterTurns", "none", 0, []),
      asset("container.synthesisTube", "fixture", "underground-equipment", 11, 1, 1, "quarterTurns", "none", 0, []),
      asset("container.generic", "fixture", "underground-equipment", 12, 1, 1, "quarterTurns", "none", 0, []),
      asset("container.pit", "fixture", "underground-equipment", 13, 2, 2, "quarterTurns", "none", 0, []),
      asset("item.receptacle", "item", "actors-goods", 3, 1, 1, "none", "none", 0, []),
      asset("item.spill", "item", "actors-goods", 4, 1, 1, "none", "none", 0, []),
      asset("item.rubble", "item", "actors-goods", 5, 1, 1, "none", "none", 0, []),
      asset("item.materialPile", "item", "actors-goods", 6, 1, 1, "none", "none", 0, []),
      asset("corpse.remains", "item", "actors-goods", 7, 1, 1, "none", "horizontal", 0, []),
      asset("corpse.remains.large", "item", "actors-goods", 8, 2, 2, "none", "horizontal", 0, []),
      asset("actor.scientist", "actor", "actors-goods", 9, 1, 1, "none", "horizontal", 0, []),
      asset("effect.spill", "effect", "effects-markers", 2, 1, 1, "none", "none", 0, []),
      asset("effect.structure", "effect", "effects-markers", 3, 1, 1, "none", "none", 0, []),
      asset("effect.electricity", "effect", "effects-markers", 4, 1, 1, "none", "none", 0, []),
      asset("effect.fire", "effect", "effects-markers", 5, 1, 1, "none", "none", 0, []),
      asset("effect.magic", "effect", "effects-markers", 6, 1, 1, "none", "none", 0, []),
      asset("effect.combatAction", "effect", "effects-markers", 7, 1, 1, "none", "none", 0, []),
      asset("effect.task.urgent", "effect", "effects-markers", 8, 1, 1, "none", "none", 0, []),
      asset("effect.task.blocked", "effect", "effects-markers", 9, 1, 1, "none", "none", 0, []),
      asset("effect.task", "effect", "effects-markers", 10, 1, 1, "none", "none", 0, []),
      asset("tile.surface.outdoor.grass", "terrain", "surface-terrain", 0, 1, 1, "none", "none", 0, []),
      asset("tile.surface.outdoor.gravel", "terrain", "surface-terrain", 1, 1, 1, "none", "none", 0, []),
      asset("tile.surface.interior.constructed", "terrain", "surface-terrain", 2, 1, 1, "none", "none", 0, []),
      asset("tile.surface.interior.loading.constructed", "terrain", "surface-terrain", 3, 1, 1, "none", "none", 0, []),
      asset("tile.surface.roof.constructed", "terrain", "surface-terrain", 4, 1, 1, "none", "none", 0, []),
      asset("tile.surface.wall.exterior", "terrain", "surface-terrain", 5, 1, 1, "none", "none", 0, []),
      asset("tile.surface.wall.partition", "terrain", "surface-terrain", 6, 1, 1, "none", "none", 0, []),
      asset("tile.surface.vertical.down", "terrain", "surface-terrain", 7, 1, 1, "none", "none", 0, []),
      asset("fixture.surfaceServiceTrunk.endpoint", "fixture", "surface-terrain", 8, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.surfaceServiceTrunk.straight", "fixture", "surface-terrain", 9, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.surfaceServiceTrunk.corner", "fixture", "surface-terrain", 10, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.surfaceServiceTrunk.tee", "fixture", "surface-terrain", 11, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.surfaceServiceTrunk.cross", "fixture", "surface-terrain", 12, 1, 1, "quarterTurns", "none", 0, []),
      asset("tile.surface.roof.edge", "terrain", "surface-terrain", 13, 1, 1, "none", "none", 0, []),
      asset("tile.surface.outdoor.gravel.drainage", "terrain", "surface-terrain", 14, 1, 1, "none", "none", 0, []),
      asset("tile.surface.outdoor.gravel.weeds", "terrain", "surface-terrain", 15, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.exterior.stoneBlocks.intact", "terrain", "surface-terrain", 5, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.partition.stoneBlocks.intact", "terrain", "surface-terrain", 6, 1, 1, "none", "none", 0, []),
      asset("tile.roof.stoneBlocks.intact", "terrain", "surface-terrain", 4, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.exterior.stoneBlocks.worn", "terrain", "surface-terrain", 5, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.partition.stoneBlocks.worn", "terrain", "surface-terrain", 6, 1, 1, "none", "none", 0, []),
      asset("tile.roof.stoneBlocks.worn", "terrain", "surface-terrain", 4, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.exterior.stoneBlocks.damaged", "terrain", "surface-terrain", 5, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.partition.stoneBlocks.damaged", "terrain", "surface-terrain", 6, 1, 1, "none", "none", 0, []),
      asset("tile.roof.stoneBlocks.damaged", "terrain", "surface-terrain", 4, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.exterior.stoneBlocks.breached", "terrain", "surface-terrain", 5, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.partition.stoneBlocks.breached", "terrain", "surface-terrain", 6, 1, 1, "none", "none", 0, []),
      asset("tile.roof.stoneBlocks.breached", "terrain", "surface-terrain", 4, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.exterior.stoneBlocks.destroyed", "terrain", "surface-terrain", 5, 1, 1, "none", "none", 0, []),
      asset("tile.wall.surface.partition.stoneBlocks.destroyed", "terrain", "surface-terrain", 6, 1, 1, "none", "none", 0, []),
      asset("tile.roof.stoneBlocks.destroyed", "terrain", "surface-terrain", 4, 1, 1, "none", "none", 0, []),
      asset("fixture.utilityServiceHead", "fixture", "surface-equipment", 0, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.surfaceUtilityRiser", "fixture", "surface-equipment", 1, 1, 1, "quarterTurns", "none", 0, []),
      asset("fixture.waterCisternPump", "fixture", "surface-equipment", 2, 1, 2, "quarterTurns", "none", 0, []),
      asset("fixture.wetChemistryBench", "fixture", "surface-equipment", 3, 2, 1, "quarterTurns", "none", 0, []),
      asset("fixture.reactionVessel", "fixture", "surface-equipment", 4, 2, 2, "quarterTurns", "none", 0, []),
      asset("fixture.fumeHood", "fixture", "surface-equipment", 5, 2, 1, "quarterTurns", "none", 0, []),
      asset("fixture.analysisStation", "fixture", "surface-equipment", 6, 2, 1, "quarterTurns", "none", 0, []),
      asset("fixture.packagingStation", "fixture", "surface-equipment", 7, 2, 1, "quarterTurns", "none", 0, []),
      asset("fixture.wasteTreatmentStation", "fixture", "surface-equipment", 8, 2, 2, "quarterTurns", "none", 0, []),
      asset("door.surface.public.closed", "fixture", "surface-access", 0, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.public.locked", "fixture", "surface-access", 0, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.public.open", "fixture", "surface-access", 1, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.public.sealed", "fixture", "surface-access", 5, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.public.breached", "fixture", "surface-access", 7, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.staff.closed", "fixture", "surface-access", 2, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.staff.locked", "fixture", "surface-access", 2, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.staff.open", "fixture", "surface-access", 3, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.staff.sealed", "fixture", "surface-access", 5, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.staff.breached", "fixture", "surface-access", 7, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.hazard.closed", "fixture", "surface-access", 4, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.hazard.locked", "fixture", "surface-access", 4, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.hazard.open", "fixture", "surface-access", 3, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.hazard.sealed", "fixture", "surface-access", 5, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.hazard.breached", "fixture", "surface-access", 7, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.basement.closed", "fixture", "surface-access", 6, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.basement.locked", "fixture", "surface-access", 6, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.basement.open", "fixture", "surface-access", 3, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.basement.sealed", "fixture", "surface-access", 5, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.basement.breached", "fixture", "surface-access", 7, 1, 1, "quarterTurns", "none", 0, []),
      asset("door.surface.freight.closed", "fixture", "surface-access", 8, 1, 3, "none", "none", 1, []),
      asset("door.surface.freight.open", "fixture", "surface-access", 9, 1, 3, "none", "none", 1, []),
      asset("door.surface.freight.locked", "fixture", "surface-access", 10, 1, 3, "none", "none", 1, []),
      asset("door.surface.freight.sealed", "fixture", "surface-access", 10, 1, 3, "none", "none", 1, []),
      asset("door.surface.freight.breached", "fixture", "surface-access", 11, 1, 3, "none", "none", 1, []),
      asset("item.chemical.raw", "item", "surface-goods", 0, 1, 1, "none", "none", 0, []),
      asset("item.chemical.intermediate", "item", "surface-goods", 1, 1, 1, "none", "none", 0, []),
      asset("item.chemical.bulk", "item", "surface-goods", 2, 1, 1, "none", "none", 0, []),
      asset("item.chemical.packaged", "item", "surface-goods", 3, 1, 1, "none", "none", 0, []),
      asset("item.surface.freight", "item", "surface-goods", 4, 1, 1, "none", "none", 0, []),
      asset("item.chemical.emptyBottle", "item", "surface-goods", 5, 1, 1, "none", "none", 0, []),
      asset("item.chemical.waste", "item", "surface-goods", 6, 1, 1, "none", "none", 0, []),
      asset("item.chemical.sludge", "item", "surface-goods", 7, 1, 1, "none", "none", 0, []),
      asset("item.chemical.spill", "item", "surface-goods", 8, 1, 1, "none", "none", 0, []),
      asset("item.chemical.spill.corrosive", "item", "surface-goods", 9, 1, 1, "none", "none", 0, []),
      asset("item.chemical.spill.reactive", "item", "surface-goods", 10, 1, 1, "none", "none", 0, []),
      asset("item.chemical.vapor", "item", "surface-goods", 11, 1, 1, "none", "none", 0, []),
      asset("effect.fume.exhaust", "effect", "surface-goods", 12, 1, 1, "none", "none", 0, []),
      asset("effect.leak.water", "effect", "surface-goods", 13, 1, 1, "none", "none", 0, []),
      asset("item.chemical.residue", "item", "surface-goods", 14, 1, 1, "none", "none", 0, []),
      asset("item.surface.freight.lawful", "item", "surface-goods", 4, 1, 1, "none", "none", 0, []),
    ],
    aliases: [
      {
        "match": "prefix",
        "pattern": "effect.incident.",
        "key": "marker.incident"
      },
      {
        "match": "exact",
        "pattern": "map.stack",
        "key": "item.stack"
      },
      {
        "match": "exact",
        "pattern": "container.openDirtPit",
        "key": "container.pit"
      },
      {
        "match": "exact",
        "pattern": "container.gratedDirtPit",
        "key": "container.pit"
      },
      {
        "match": "exact",
        "pattern": "container.cappedDirtPit",
        "key": "container.pit"
      },
      {
        "match": "exact",
        "pattern": "container.reinforcedObservationVessel",
        "key": "container.generic"
      },
      {
        "match": "exact",
        "pattern": "item.mapArtifact",
        "key": "item.materialPile"
      },
      {
        "match": "exact",
        "pattern": "object.container",
        "key": "container.generic"
      },
      {
        "match": "exact",
        "pattern": "object.unknown",
        "key": "fixture.generic"
      },
      {
        "match": "prefix",
        "pattern": "fixture.",
        "key": "fixture.generic"
      },
      {
        "match": "prefix",
        "pattern": "container.",
        "key": "container.generic"
      },
      {
        "match": "prefix",
        "pattern": "door.",
        "key": "door.closed"
      },
      {
        "match": "prefix",
        "pattern": "effect.",
        "key": "effect.hazard.pulse"
      }
    ],
    categoryFallbacks: {
      "terrain": {
        "type": "procedural",
        "key": "fallback.terrain"
      },
      "fixture": {
        "type": "glyph",
        "key": "fallback.fixture",
        "glyph": "F"
      },
      "item": {
        "type": "glyph",
        "key": "fallback.item",
        "glyph": "P"
      },
      "actor": {
        "type": "glyph",
        "key": "fallback.actor",
        "glyph": "?"
      },
      "effect": {
        "type": "procedural",
        "key": "fallback.effect"
      },
      "marker": {
        "type": "glyph",
        "key": "fallback.marker",
        "glyph": "!"
      }
    }
  };
  return { MANIFEST_VERSION, ASSET_CATEGORIES, manifest };
}));
