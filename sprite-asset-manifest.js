(function attachHelixSpriteAssetManifest(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixSpriteAssetManifest = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixSpriteAssetManifest() {
  "use strict";

  const MANIFEST_VERSION = 3;
  const ASSET_CATEGORIES = Object.freeze([
    "terrain",
    "fixture",
    "item",
    "actor",
    "effect",
    "marker"
  ]);
  const GENERATED_ATLAS_SIZE = Object.freeze({ width: 1254, height: 1254 });
  const GENERATED_ATLAS_CELL_PX = 418;

  function atlasPlaceholder(options) {
    const column = Number(options.column) || 0;
    const row = Number(options.row) || 0;
    const logicalSize = options.logicalSize || { width: 1, height: 1, layers: 1 };
    const sourceRect = options.contentRect
      ? {
          x: column * GENERATED_ATLAS_CELL_PX + options.contentRect.x,
          y: row * GENERATED_ATLAS_CELL_PX + options.contentRect.y,
          width: options.contentRect.width,
          height: options.contentRect.height
        }
      : options.horizontal
      ? {
          x: column * GENERATED_ATLAS_CELL_PX,
          y: row * GENERATED_ATLAS_CELL_PX + 104,
          width: GENERATED_ATLAS_CELL_PX,
          height: 210
        }
      : {
          x: column * GENERATED_ATLAS_CELL_PX,
          y: row * GENERATED_ATLAS_CELL_PX,
          width: GENERATED_ATLAS_CELL_PX,
          height: GENERATED_ATLAS_CELL_PX
        };
    return {
      key: options.key,
      category: options.category,
      source: { type: "atlas", path: options.path },
      sourceSize: { ...GENERATED_ATLAS_SIZE },
      sourceRect,
      logicalSize: { ...logicalSize },
      placement: {
        anchorTile: { x: 0, y: 0, z: 0 },
        rotation: options.rotation || "none",
        mirror: options.mirror || "none"
      },
      variants: [...(options.variants || [])],
      placeholder: true
    };
  }

  const manifest = {
    id: "helix-heresy-map-sprites",
    version: MANIFEST_VERSION,
    sourceScalePxPerTile: 64,
    assets: [
      {
        key: "tile.solidEarth",
        category: "terrain",
        source: {
          type: "image",
          path: "assets/sprites/placeholders/terrain-rock-natural.png"
        },
        sourceSize: { width: 1254, height: 1254 },
        logicalSize: { width: 1, height: 1, layers: 1 },
        placement: {
          anchorTile: { x: 0, y: 0, z: 0 },
          rotation: "none",
          mirror: "none"
        },
        variants: [],
        placeholder: true
      },
      {
        key: "door.closed",
        category: "fixture",
        source: {
          type: "image",
          path: "assets/sprites/placeholders/fixture-door-closed.png"
        },
        sourceSize: { width: 1254, height: 1254 },
        logicalSize: { width: 1, height: 1, layers: 1 },
        placement: {
          anchorTile: { x: 0, y: 0, z: 0 },
          rotation: "quarterTurns",
          mirror: "none"
        },
        variants: [],
        placeholder: true
      },
      {
        key: "fixture.basicWorkbench",
        category: "fixture",
        source: {
          type: "image",
          path: "assets/sprites/placeholders/fixture-workbench-2x1.png"
        },
        sourceSize: { width: 1254, height: 1254 },
        sourceRect: { x: 0, y: 313, width: 1254, height: 627 },
        logicalSize: { width: 2, height: 1, layers: 1 },
        placement: {
          anchorTile: { x: 0, y: 0, z: 0 },
          rotation: "quarterTurns",
          mirror: "none"
        },
        variants: [],
        placeholder: true
      },
      {
        key: "item.stack",
        category: "item",
        source: {
          type: "image",
          path: "assets/sprites/placeholders/item-stack.png"
        },
        sourceSize: { width: 1254, height: 1254 },
        logicalSize: { width: 1, height: 1, layers: 1 },
        placement: {
          anchorTile: { x: 0, y: 0, z: 0 },
          rotation: "none",
          mirror: "none"
        },
        variants: [],
        placeholder: true
      },
      {
        key: "actor.slime",
        category: "actor",
        source: {
          type: "image",
          path: "assets/sprites/placeholders/actor-slime-radial.png"
        },
        sourceSize: { width: 1254, height: 1254 },
        logicalSize: { width: 1, height: 1, layers: 1 },
        placement: {
          anchorTile: { x: 0, y: 0, z: 0 },
          rotation: "none",
          mirror: "horizontal"
        },
        variants: [],
        placeholder: true
      },
      {
        key: "actor.slime.large",
        category: "actor",
        source: {
          type: "image",
          path: "assets/sprites/placeholders/actor-slime-large-2x2.png"
        },
        sourceSize: { width: 1254, height: 1254 },
        logicalSize: { width: 2, height: 2, layers: 1 },
        placement: {
          anchorTile: { x: 0, y: 0, z: 0 },
          rotation: "none",
          mirror: "horizontal"
        },
        variants: [],
        placeholder: true
      },
      {
        key: "effect.hazard.pulse",
        category: "effect",
        source: {
          type: "image",
          path: "assets/sprites/placeholders/effect-hazard-pulse.png"
        },
        sourceSize: { width: 1254, height: 1254 },
        logicalSize: { width: 1, height: 1, layers: 1 },
        placement: {
          anchorTile: { x: 0, y: 0, z: 0 },
          rotation: "none",
          mirror: "none"
        },
        variants: [],
        placeholder: true
      },
      {
        key: "marker.incident",
        category: "marker",
        source: {
          type: "image",
          path: "assets/sprites/placeholders/marker-incident.png"
        },
        sourceSize: { width: 1254, height: 1254 },
        logicalSize: { width: 1, height: 1, layers: 1 },
        placement: {
          anchorTile: { x: 0, y: 0, z: 0 },
          rotation: "none",
          mirror: "none"
        },
        variants: ["stack"],
        placeholder: true
      },
      atlasPlaceholder({ key: "tile.unknownDark", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 0, row: 0, contentRect: { x: 90, y: 84, width: 282, height: 289 } }),
      atlasPlaceholder({ key: "tile.draftExcavation.valid", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 1, row: 0, contentRect: { x: 71, y: 88, width: 277, height: 285 } }),
      atlasPlaceholder({ key: "tile.draftExcavation.invalid", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 2, row: 0, contentRect: { x: 51, y: 91, width: 275, height: 282 } }),
      atlasPlaceholder({ key: "tile.plannedExcavation", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 0, row: 1, contentRect: { x: 92, y: 57, width: 282, height: 280 } }),
      atlasPlaceholder({ key: "tile.wall", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 1, row: 1, contentRect: { x: 66, y: 55, width: 286, height: 289 } }),
      atlasPlaceholder({ key: "tile.room", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 2, row: 1, contentRect: { x: 46, y: 60, width: 281, height: 280 } }),
      atlasPlaceholder({ key: "tile.floor", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 0, row: 2, contentRect: { x: 92, y: 24, width: 280, height: 278 } }),
      atlasPlaceholder({ key: "tile.vertical", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 1, row: 2, contentRect: { x: 69, y: 28, width: 280, height: 273 } }),
      atlasPlaceholder({ key: "room.anchor", category: "terrain", path: "assets/sprites/placeholders/atlas-terrain-placeholders.png", column: 2, row: 2, contentRect: { x: 46, y: 28, width: 280, height: 273 } }),
      atlasPlaceholder({ key: "door.open", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 0, row: 0, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "door.locked", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 1, row: 0, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "door.sealed", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 2, row: 0, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "door.breached", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 0, row: 1, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "fixture.generic", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 1, row: 1, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "fixture.bed", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 2, row: 1, horizontal: true, logicalSize: { width: 2, height: 1, layers: 1 }, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "fixture.storageShelf", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 0, row: 2, horizontal: true, logicalSize: { width: 2, height: 1, layers: 1 }, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "fixture.sumpTank", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 1, row: 2, logicalSize: { width: 2, height: 2, layers: 1 }, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "fixture.fuelGenerator", category: "fixture", path: "assets/sprites/placeholders/atlas-equipment-placeholders.png", column: 2, row: 2, horizontal: true, logicalSize: { width: 2, height: 1, layers: 1 }, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "container.generic", category: "fixture", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 0, row: 0, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "container.pit", category: "fixture", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 1, row: 0, logicalSize: { width: 2, height: 2, layers: 1 }, rotation: "quarterTurns" }),
      atlasPlaceholder({ key: "item.receptacle", category: "item", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 2, row: 0 }),
      atlasPlaceholder({ key: "item.spill", category: "item", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 0, row: 1 }),
      atlasPlaceholder({ key: "item.rubble", category: "item", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 1, row: 1 }),
      atlasPlaceholder({ key: "item.materialPile", category: "item", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 2, row: 1 }),
      atlasPlaceholder({ key: "corpse.remains", category: "item", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 0, row: 2, mirror: "horizontal" }),
      atlasPlaceholder({ key: "corpse.remains.large", category: "item", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 1, row: 2, logicalSize: { width: 2, height: 2, layers: 1 }, mirror: "horizontal" }),
      atlasPlaceholder({ key: "actor.scientist", category: "actor", path: "assets/sprites/placeholders/atlas-actors-items-placeholders.png", column: 2, row: 2, mirror: "horizontal" }),
      atlasPlaceholder({ key: "effect.spill", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 0, row: 0 }),
      atlasPlaceholder({ key: "effect.structure", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 1, row: 0 }),
      atlasPlaceholder({ key: "effect.electricity", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 2, row: 0 }),
      atlasPlaceholder({ key: "effect.fire", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 0, row: 1 }),
      atlasPlaceholder({ key: "effect.magic", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 1, row: 1 }),
      atlasPlaceholder({ key: "effect.combatAction", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 2, row: 1 }),
      atlasPlaceholder({ key: "effect.task.urgent", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 0, row: 2 }),
      atlasPlaceholder({ key: "effect.task.blocked", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 1, row: 2 }),
      atlasPlaceholder({ key: "effect.task", category: "effect", path: "assets/sprites/placeholders/atlas-effects-placeholders.png", column: 2, row: 2 })
    ],
    aliases: [
      {
        match: "prefix",
        pattern: "effect.incident.",
        key: "marker.incident"
      },
      {
        match: "exact",
        pattern: "map.stack",
        key: "item.stack"
      },
      {
        match: "exact",
        pattern: "container.openDirtPit",
        key: "container.pit"
      },
      {
        match: "exact",
        pattern: "container.gratedDirtPit",
        key: "container.pit"
      },
      {
        match: "exact",
        pattern: "container.cappedDirtPit",
        key: "container.pit"
      },
      {
        match: "exact",
        pattern: "item.mapArtifact",
        key: "item.materialPile"
      },
      {
        match: "exact",
        pattern: "object.container",
        key: "container.generic"
      },
      {
        match: "exact",
        pattern: "object.unknown",
        key: "fixture.generic"
      },
      {
        match: "prefix",
        pattern: "fixture.",
        key: "fixture.generic"
      },
      {
        match: "prefix",
        pattern: "container.",
        key: "container.generic"
      },
      {
        match: "prefix",
        pattern: "door.",
        key: "door.closed"
      },
      {
        match: "prefix",
        pattern: "effect.",
        key: "effect.hazard.pulse"
      }
    ],
    categoryFallbacks: {
      terrain: { type: "procedural", key: "fallback.terrain" },
      fixture: { type: "glyph", key: "fallback.fixture", glyph: "F" },
      item: { type: "glyph", key: "fallback.item", glyph: "P" },
      actor: { type: "glyph", key: "fallback.actor", glyph: "?" },
      effect: { type: "procedural", key: "fallback.effect" },
      marker: { type: "glyph", key: "fallback.marker", glyph: "!" }
    }
  };

  return {
    MANIFEST_VERSION,
    ASSET_CATEGORIES,
    manifest
  };
}));
