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

  const MANIFEST_VERSION = 2;
  const ASSET_CATEGORIES = Object.freeze([
    "terrain",
    "fixture",
    "item",
    "actor",
    "effect",
    "marker"
  ]);

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
      }
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
