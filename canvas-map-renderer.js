(function attachHelixCanvasMapRenderer(root, factory) {
  const renderOrder = typeof module === "object" && module.exports
    ? require("./map-render-order.js")
    : root?.HelixMapRenderOrder;
  const animationClock = typeof module === "object" && module.exports
    ? require("./animation-clock.js")
    : root?.HelixAnimationClock;
  const api = factory(renderOrder, animationClock);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixCanvasMapRenderer = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixCanvasMapRenderer(RenderOrder, AnimationClock) {
  "use strict";

  if (!RenderOrder) throw new Error("Canvas map renderer requires the map render-order policy.");
  if (!AnimationClock) throw new Error("Canvas map renderer requires the animation-clock contract.");
  const RENDERER_VERSION = 9;
  const ROOM_COLORS = Object.freeze({
    mainLab: "#22251d",
    livingStorage: "#1a261d",
    corpseProcessing: "#251c1a",
    restRecovery: "#202234",
    materialStorage: "#252318",
    byproductCollection: "#1a2427",
    excavated: "#2a241b"
  });
  const BASE_STYLES = Object.freeze({
    unknownDark: { fill: "#030403", stroke: "#050605", text: "transparent" },
    offsite: { fill: "#080a08", stroke: "#111510", text: "transparent" },
    solidEarth: { fill: "#0b0b08", stroke: "#14150f", text: "#6f7566" },
    floor: { fill: "#242822", stroke: "#30362d", text: "#879080" },
    surface: { fill: "#34412b", stroke: "#536247", text: "#b8c5aa" },
    roof: { fill: "#3a3b35", stroke: "#74766d", text: "#d1d2ca" },
    room: { fill: "#1d2119", stroke: "#2c3128", text: "#adb4a7" },
    constructedWall: { fill: "#1c1f1c", stroke: "#697067", text: "#aeb6aa" },
    plannedExcavation: { fill: "#302618", stroke: "#b78f4d", text: "#e1b75f" },
    draftExcavation: { fill: "#242615", stroke: "#759653", text: "#9abe60" }
  });
  const ENTITY_STYLES = Object.freeze({
    scientist: { fill: "#68c8d8", stroke: "#bdefff", text: "#08110f" },
    slime: { fill: "#1f2b1a", stroke: "#75b86b", text: "#9abe60" },
    corpse: { fill: "#2d1f1d", stroke: "#c95b5b", text: "#e39a8c" },
    container: { fill: "#2b261a", stroke: "#756539", text: "#e1b75f" },
    fixture: { fill: "#202724", stroke: "#527066", text: "#b8d7cc" },
    door: { fill: "#39221f", stroke: "#e1b75f", text: "#ffb8a8" },
    itemStack: { fill: "#25261f", stroke: "#77796a", text: "#d8d8cd" },
    rubble: { fill: "#26231d", stroke: "#776d59", text: "#b6a98c" },
    materialPile: { fill: "#29271d", stroke: "#7c7451", text: "#d1c178" },
    mapArtifact: { fill: "#25261f", stroke: "#77796a", text: "#d8d8cd" }
  });

  function cleanNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cellKey(cell) {
    return `${Math.round(cleanNumber(cell?.x))},${Math.round(cleanNumber(cell?.y))},${Math.round(cleanNumber(cell?.z))}`;
  }

  function inViewport(cell, viewport) {
    return Boolean(cell && viewport
      && cleanNumber(cell.z) === cleanNumber(viewport.z)
      && cleanNumber(cell.x) >= cleanNumber(viewport.x)
      && cleanNumber(cell.x) < cleanNumber(viewport.x) + cleanNumber(viewport.width, 1)
      && cleanNumber(cell.y) >= cleanNumber(viewport.y)
      && cleanNumber(cell.y) < cleanNumber(viewport.y) + cleanNumber(viewport.height, 1));
  }

  function visibleCells(scene) {
    return (scene?.cells || []).filter((entry) => inViewport(entry.cell, scene.viewport));
  }

  function renderCells(scene, options = {}) {
    if (!options.includeOverscan) return visibleCells(scene);
    const layer = cleanNumber(scene?.viewport?.z);
    return (scene?.cells || []).filter((entry) => cleanNumber(entry?.cell?.z) === layer);
  }

  function presentationOrigin(options = {}) {
    return {
      x: cleanNumber(options.origin?.x, 6),
      y: cleanNumber(options.origin?.y, 6)
    };
  }

  function screenToCell(scene, point, options = {}) {
    if (!scene?.viewport || !point) return null;
    const tilePx = Math.max(1, cleanNumber(options.tilePx, 14));
    const origin = presentationOrigin(options);
    const x = Math.floor((cleanNumber(point.x) - origin.x) / tilePx) + cleanNumber(scene.viewport.x);
    const y = Math.floor((cleanNumber(point.y) - origin.y) / tilePx) + cleanNumber(scene.viewport.y);
    const z = cleanNumber(scene.viewport.z);
    const mapWidth = Math.max(1, cleanNumber(scene.mapSize?.width, scene.viewport.x + scene.viewport.width));
    const mapHeight = Math.max(1, cleanNumber(scene.mapSize?.height, scene.viewport.y + scene.viewport.height));
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return null;
    return { x, y, z };
  }

  function cellToScreen(scene, cell, options = {}) {
    if (!scene?.viewport || !cell || cleanNumber(cell.z) !== cleanNumber(scene.viewport.z)) return null;
    const tilePx = Math.max(1, cleanNumber(options.tilePx, 14));
    const origin = presentationOrigin(options);
    return {
      x: origin.x + (cleanNumber(cell.x) - cleanNumber(scene.viewport.x)) * tilePx,
      y: origin.y + (cleanNumber(cell.y) - cleanNumber(scene.viewport.y)) * tilePx,
      width: tilePx,
      height: tilePx
    };
  }

  function withStyle(base, changes = {}) {
    return { ...base, ...changes };
  }

  function mixColor(left, right, ratio = 0) {
    const parse = (value) => {
      const match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
      if (!match) return null;
      const number = Number.parseInt(match[1], 16);
      return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
    };
    const a = parse(left);
    const b = parse(right);
    if (!a || !b) return left;
    const amount = Math.max(0, Math.min(1, cleanNumber(ratio)));
    const mixed = a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }

  function lightingStyle(cell, style, strength = 1) {
    const lighting = cell?.lighting;
    if (!lighting || ["unknown", "remembered"].includes(lighting.band)) return style;
    const scale = Math.max(0, Math.min(1, cleanNumber(strength, 1)));
    const treatment = {
      dark: { color: "#030503", fill: 0.62, stroke: 0.38, text: 0.2 },
      dim: { color: "#080b08", fill: 0.28, stroke: 0.16, text: 0.08 },
      lit: { color: lighting.spectrum === "warm" ? "#6b5a2f" : "#5a6258", fill: 0.06, stroke: 0.04, text: 0 },
      bright: { color: lighting.spectrum === "warm" ? "#d1aa55" : "#b8c2b5", fill: 0.14, stroke: 0.1, text: 0.04 }
    }[lighting.band];
    if (!treatment) return style;
    return withStyle(style, {
      fill: mixColor(style.fill, treatment.color, treatment.fill * scale),
      stroke: mixColor(style.stroke, treatment.color, treatment.stroke * scale),
      text: mixColor(style.text, treatment.color, treatment.text * scale)
    });
  }

  function highContrastStyle(style, enabled = false) {
    if (!enabled || !style) return style;
    return withStyle(style, {
      fill: mixColor(style.fill, "#000000", 0.48),
      stroke: mixColor(style.stroke, "#ffffff", 0.5),
      text: style.text === "transparent" ? style.text : mixColor(style.text, "#ffffff", 0.42)
    });
  }

  function overlayStyle(cell, style) {
    const overlay = cell?.overlay;
    if (!overlay) return style;
    const states = new Set(overlay.states || []);
    if (overlay.id === "contamination") {
      if (states.has("contamination-hazardous")) return withStyle(style, { fill: "#3a1c28", stroke: "#ff8b73" });
      if (states.has("contamination-fouled")) return withStyle(style, { fill: "#38231c", stroke: "#c96b4f" });
      if (states.has("contamination-tainted")) return withStyle(style, { fill: "#312b18", stroke: "#e1b75f" });
      return withStyle(style, { fill: "#18241a", stroke: "#75b86b" });
    }
    if (overlay.id === "temperature") {
      if ([...states].some((state) => state.includes("cold") || state.includes("freezing"))) {
        return withStyle(style, { fill: "#162a32", stroke: "#68c8d8" });
      }
      if ([...states].some((state) => state.includes("warm") || state.includes("hot") || state.includes("scalding"))) {
        return withStyle(style, { fill: "#3b241c", stroke: "#e67e4e" });
      }
      return withStyle(style, { fill: "#203026" });
    }
    if (overlay.id === "humidity") {
      if ([...states].some((state) => state.includes("damp") || state.includes("wet"))) {
        return withStyle(style, { fill: "#183039", stroke: "#64b2cd" });
      }
      if ([...states].some((state) => state.includes("dry") || state.includes("parched"))) {
        return withStyle(style, { fill: "#302b1d", stroke: "#cab165" });
      }
      return withStyle(style, { fill: "#1e2e28" });
    }
    if (overlay.id === "ambientMana") return withStyle(style, { fill: "#2b2538", stroke: "#bf91dd" });
    if (overlay.id === "light") return withStyle(style, { fill: states.has("light-bright") ? "#45412a" : "#303123", stroke: "#cdc17e" });
    if (overlay.id === "infrastructure") return withStyle(style, { fill: "#202722", stroke: "#aebba6" });
    if (overlay.id === "movement") return withStyle(style, { fill: "#1f302d", stroke: "#68c8d8" });
    if (overlay.id === "resources") return withStyle(style, { fill: "#26311f", stroke: "#9abe60" });
    if (overlay.id === "incidents") return withStyle(style, { fill: "#39221f", stroke: "#ff8b73" });
    if (overlay.id === "combat") return withStyle(style, { fill: "#3a1717", stroke: "#ff8b73" });
    if (overlay.id === "construction") return withStyle(style, { fill: "#302618", stroke: "#e1b75f" });
    if (overlay.id === "rooms") return withStyle(style, { stroke: "#5ea69e" });
    if (overlay.id === "access") {
      if (states.has("access-forbidden")) return withStyle(style, { fill: "#3b1d1d", stroke: "#e8685b" });
      if (states.has("access-allowed")) return withStyle(style, { fill: "#1c3524", stroke: "#74cd84" });
    }
    if (overlay.id === "debug") return withStyle(style, { stroke: "#d697ff", dashed: true });
    return style;
  }

  function cellStyle(cell, options = {}) {
    const base = cell?.base || {};
    let style = BASE_STYLES[base.kind] || BASE_STYLES.solidEarth;
    if (base.kind === "room") {
      style = withStyle(style, { fill: ROOM_COLORS[base.role] || style.fill });
      if (base.surface) style = withStyle(style, { fill: "#353a34", stroke: "#596158" });
    }
    if (base.kind === "surface") {
      if (base.terrainId === "gravel") style = withStyle(style, { fill: "#45443b", stroke: "#626157" });
      if (base.terrainId === "soil") style = withStyle(style, { fill: "#3b3023", stroke: "#574734" });
      if (["interior", "exposedInterior"].includes(base.enclosure)) style = withStyle(style, { fill: "#353a34", stroke: "#596158" });
      if (base.enclosure === "coveredExterior") style = withStyle(style, { fill: "#3b4037", stroke: "#5a6256", dashed: true });
    }
    if (base.kind === "floor" && base.smoothed) style = withStyle(style, { fill: "#2d332c", stroke: "#444d42" });
    if ((base.kind === "floor" || base.kind === "room") && base.constructedFloor) {
      style = withStyle(style, { fill: "#353a34", stroke: "#596158" });
    }
    if (base.kind === "solidEarth" && base.smoothedWall) style = withStyle(style, { fill: "#13150f", stroke: "#35392d" });
    if (base.kind === "draftExcavation" && !base.valid) style = withStyle(style, { fill: "#332118", stroke: "#c96b4f", text: "#ffb8a8" });
    if (base.blockedReason) style = withStyle(style, { fill: "#2d2020", stroke: "#c96b4f" });
    if (base.state === "damaged" || base.state === "breached") style = withStyle(style, { stroke: "#d08a63", dashed: base.state === "breached" });
    style = overlayStyle(cell, style);
    style = lightingStyle(cell, style, cell?.overlay ? 0.55 : 1);
    if (cell?.door) {
      const doorStyles = {
        open: { fill: "#26281f", stroke: "#e1b75f", text: "#e1b75f" },
        closed: ENTITY_STYLES.door,
        locked: { fill: "#322038", stroke: "#b68cff", text: "#dfc7ff" },
        sealed: { fill: "#202f38", stroke: "#68c8d8", text: "#bdefff" },
        breached: { fill: "#451f1f", stroke: "#c95b5b", text: "#ffd1ca" }
      };
      style = withStyle(style, doorStyles[cell.door.state] || ENTITY_STYLES.door);
    }
    if (cell?.knowledge?.state === "stale") {
      style = withStyle(style, {
        alpha: cell.knowledge.tier === "archived" ? 0.48 : cell.knowledge.tier === "aged" ? 0.58 : 0.68,
        dashed: true
      });
    }
    return highContrastStyle(style, options.highContrast);
  }

  function entityStyle(entity, options = {}) {
    const style = ENTITY_STYLES[entity?.kind] || ENTITY_STYLES[entity?.category] || ENTITY_STYLES.mapArtifact;
    if (entity?.knowledge?.state === "stale") {
      return highContrastStyle(withStyle(style, { alpha: 0.62, dashed: true }), options.highContrast);
    }
    if (entity?.knowledge?.state === "uncertain") {
      return highContrastStyle(withStyle(style, { alpha: 0.48, dashed: true }), options.highContrast);
    }
    if (entity?.condition?.band === "critical" || entity?.condition?.band === "breached") {
      return highContrastStyle(withStyle(style, { stroke: "#ff8b73" }), options.highContrast);
    }
    return highContrastStyle(style, options.highContrast);
  }

  function entityMotionSample(entity, options = {}) {
    return AnimationClock.sampleMotion(entity?.motion, options.presentationTime, {
      speed: options.speed,
      paused: options.paused,
      reducedMotion: options.reducedMotion,
      discontinuity: !["running", "paused"].includes(String(options.timelineMode || "running")),
      knowledgeState: entity?.knowledge?.state,
      minInterpolationMs: AnimationClock.MIN_INTERPOLATION_MS
    });
  }

  function terrainGlyph(cell) {
    if (cell?.knowledge?.state === "stale") {
      return String(cell?.visual?.glyph || "");
    }
    const layer = cell?.visual?.layer;
    return ["object", "actor", "door", "incident", "construction"].includes(layer)
      ? ""
      : String(cell?.visual?.glyph || "");
  }

  function terrainSpriteKey(cell) {
    if (cell?.knowledge?.state === "stale") {
      return String(cell?.visual?.spriteKey || cell?.base?.spriteKey || "");
    }
    const layer = cell?.visual?.layer;
    if (["object", "actor", "door", "incident"].includes(layer)) {
      return String(cell?.base?.spriteKey || "");
    }
    return String(cell?.visual?.spriteKey || cell?.base?.spriteKey || "");
  }

  function drawTile(ctx, x, y, size, style) {
    const inset = Math.max(0.5, Math.min(1.25, size * 0.06));
    ctx.globalAlpha = cleanNumber(style.alpha, 1);
    ctx.fillStyle = style.fill;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.setLineDash(style.dashed ? [Math.max(2, size * 0.22), Math.max(1, size * 0.12)] : []);
    ctx.strokeRect(x + inset, y + inset, Math.max(0, size - inset * 2), Math.max(0, size - inset * 2));
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawGlyph(ctx, glyph, x, y, size, color, alpha = 1, markerScale = 1) {
    if (!glyph || color === "transparent") return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.max(6, Math.floor(size * 0.48 * cleanNumber(markerScale, 1)))}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(glyph), x + size / 2, y + size / 2 + size * 0.025, size * 0.92);
    ctx.restore();
  }

  function drawAtmosphere(ctx, cell, position, tilePx) {
    if (!cell?.atmosphere?.visible) return false;
    const dense = cell.atmosphere.band === "dense";
    ctx.save();
    ctx.globalAlpha = dense ? 0.24 : 0.14;
    ctx.fillStyle = dense ? "#b9b49b" : "#a5aa96";
    const radius = Math.max(0.7, tilePx * 0.045);
    const points = dense ? [[0.24, 0.28], [0.7, 0.25], [0.48, 0.58], [0.78, 0.76]] : [[0.3, 0.34], [0.72, 0.68]];
    for (const [x, y] of points) {
      ctx.beginPath();
      ctx.arc(position.x + tilePx * x, position.y + tilePx * y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return true;
  }

  function resolveSprite(assetLoader, semanticKey, fallbackKeys = []) {
    if (!assetLoader || !semanticKey || typeof assetLoader.resolve !== "function") return null;
    const keys = [semanticKey, ...(fallbackKeys || [])].filter(Boolean);
    if (keys.length > 1) {
      for (const key of keys) {
        const candidate = assetLoader.resolve(key);
        if (candidate?.status === "ready" && candidate.image
          && ["exact", "alias"].includes(candidate.resolution)) {
          return candidate;
        }
      }
    }
    const resolved = assetLoader.resolve(semanticKey);
    return resolved?.status === "ready" && resolved.image ? resolved : null;
  }

  function spriteSourceRect(entry) {
    const sourceSize = entry?.sourceSize || {};
    const rect = entry?.sourceRect || {};
    return {
      x: Math.max(0, cleanNumber(rect.x)),
      y: Math.max(0, cleanNumber(rect.y)),
      width: Math.max(1, cleanNumber(rect.width, sourceSize.width || 1)),
      height: Math.max(1, cleanNumber(rect.height, sourceSize.height || 1))
    };
  }

  function drawSprite(ctx, resolved, x, y, width, height, alpha = 1) {
    if (!resolved?.image) return false;
    const source = spriteSourceRect(resolved.entry);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      resolved.image,
      source.x,
      source.y,
      source.width,
      source.height,
      x,
      y,
      width,
      height
    );
    ctx.restore();
    return true;
  }

  function cleanOrientation(candidate) {
    const quarterTurns = Math.round(cleanNumber(candidate?.quarterTurns));
    return {
      quarterTurns: ((quarterTurns % 4) + 4) % 4,
      mirrored: Boolean(candidate?.mirrored)
    };
  }

  function orientedLogicalSize(entry, orientation = {}) {
    const logical = entry?.logicalSize || {};
    const clean = cleanOrientation(orientation);
    const rotated = clean.quarterTurns % 2 === 1;
    return {
      width: Math.max(1, cleanNumber(rotated ? logical.height : logical.width, 1)),
      height: Math.max(1, cleanNumber(rotated ? logical.width : logical.height, 1)),
      layers: Math.max(1, cleanNumber(logical.layers, 1))
    };
  }

  function entityBounds(entity) {
    if (entity?.bounds) {
      return {
        x: cleanNumber(entity.bounds.x),
        y: cleanNumber(entity.bounds.y),
        z: cleanNumber(entity.bounds.z),
        width: Math.max(1, cleanNumber(entity.bounds.width, 1)),
        height: Math.max(1, cleanNumber(entity.bounds.height, 1)),
        depth: Math.max(1, cleanNumber(entity.bounds.depth, 1))
      };
    }
    const cells = entity?.footprintCells || [];
    if (!cells.length) return null;
    const xs = cells.map((cell) => cleanNumber(cell.x));
    const ys = cells.map((cell) => cleanNumber(cell.y));
    const zs = cells.map((cell) => cleanNumber(cell.z));
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      z: Math.min(...zs),
      width: Math.max(...xs) - Math.min(...xs) + 1,
      height: Math.max(...ys) - Math.min(...ys) + 1,
      depth: Math.max(...zs) - Math.min(...zs) + 1
    };
  }

  function spritePlacement(entity, resolved) {
    const entry = resolved?.entry;
    const anchorCell = entity?.anchorCell;
    if (!entry || !anchorCell) return { matches: false, reason: "missing sprite entry or entity anchor" };
    const orientation = cleanOrientation(entity.orientation);
    const logical = entry.logicalSize || {};
    const placement = entry.placement || {};
    const nonSquare = cleanNumber(logical.width, 1) !== cleanNumber(logical.height, 1);
    if (orientation.quarterTurns && placement.rotation !== "quarterTurns" && nonSquare) {
      return { matches: false, reason: "asset does not support the requested quarter-turn rotation" };
    }
    if (orientation.mirrored && placement.mirror !== "horizontal") {
      return { matches: false, reason: "asset does not support horizontal mirroring" };
    }
    const effectiveOrientation = {
      quarterTurns: placement.rotation === "quarterTurns" ? orientation.quarterTurns : 0,
      mirrored: placement.mirror === "horizontal" && orientation.mirrored
    };
    const size = orientedLogicalSize(entry, effectiveOrientation);
    const anchor = placement.anchorTile || { x: 0, y: 0, z: 0 };
    const expected = {
      x: cleanNumber(anchorCell.x) - cleanNumber(anchor.x),
      y: cleanNumber(anchorCell.y) - cleanNumber(anchor.y),
      z: cleanNumber(anchorCell.z) - cleanNumber(anchor.z),
      width: size.width,
      height: size.height,
      depth: size.layers
    };
    const actual = entityBounds(entity);
    const matches = Boolean(actual
      && actual.x === expected.x
      && actual.y === expected.y
      && actual.z === expected.z
      && actual.width === expected.width
      && actual.height === expected.height
      && actual.depth === expected.depth);
    return {
      matches,
      reason: matches
        ? ""
        : `asset expects ${expected.width}x${expected.height}x${expected.depth} at ${expected.x},${expected.y},${expected.z}; footprint is ${actual?.width || 0}x${actual?.height || 0}x${actual?.depth || 0} at ${actual?.x || 0},${actual?.y || 0},${actual?.z || 0}`,
      orientation: effectiveOrientation,
      canonicalSize: {
        width: Math.max(1, cleanNumber(logical.width, 1)),
        height: Math.max(1, cleanNumber(logical.height, 1))
      },
      bounds: expected,
      source: spriteSourceRect(entry)
    };
  }

  function drawPlacedSprite(ctx, resolved, placement, viewport, tilePx, origin, alpha = 1, offset = null) {
    if (!resolved?.image || !placement?.matches) return false;
    const x = origin.x + (placement.bounds.x - viewport.x + cleanNumber(offset?.x)) * tilePx;
    const y = origin.y + (placement.bounds.y - viewport.y + cleanNumber(offset?.y)) * tilePx;
    const width = placement.bounds.width * tilePx;
    const height = placement.bounds.height * tilePx;
    const canonicalWidth = placement.canonicalSize.width * tilePx;
    const canonicalHeight = placement.canonicalSize.height * tilePx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(placement.orientation.quarterTurns * Math.PI / 2);
    if (placement.orientation.mirrored) ctx.scale(-1, 1);
    ctx.drawImage(
      resolved.image,
      placement.source.x,
      placement.source.y,
      placement.source.width,
      placement.source.height,
      -canonicalWidth / 2,
      -canonicalHeight / 2,
      canonicalWidth,
      canonicalHeight
    );
    ctx.restore();
    return true;
  }

  function tilePosition(cell, viewport, tilePx, origin, offset = null) {
    return {
      x: origin.x + (cell.x - viewport.x + cleanNumber(offset?.x)) * tilePx,
      y: origin.y + (cell.y - viewport.y + cleanNumber(offset?.y)) * tilePx
    };
  }

  function drawRoute(ctx, cell, position, tilePx, options = {}) {
    if (!cell?.route) return false;
    const route = cell.route;
    const color = route.selected
      ? (options.highContrast ? "#fff36a" : "#f0d989")
      : (options.highContrast ? "#5cffff" : "#68c8d8");
    const centerX = position.x + tilePx / 2;
    const centerY = position.y + tilePx / 2;
    const directions = {
      north: [centerX, position.y],
      east: [position.x + tilePx, centerY],
      south: [centerX, position.y + tilePx],
      west: [position.x, centerY]
    };
    const connections = Array.isArray(route.connections) ? route.connections : [];
    ctx.save();
    ctx.globalAlpha = route.selected ? 0.96 : 0.86;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(options.highContrast ? 2 : 1.5, tilePx * 0.11);
    ctx.beginPath();
    if (connections.length) {
      for (const direction of connections) {
        const target = directions[direction];
        if (!target) continue;
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(target[0], target[1]);
      }
    } else if (!route.start && !route.end) {
      ctx.moveTo(position.x + tilePx * 0.16, centerY);
      ctx.lineTo(position.x + tilePx * 0.84, centerY);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(1.5, tilePx * 0.075), 0, Math.PI * 2);
    ctx.fill();
    if (route.end) {
      const radius = Math.max(3, tilePx * 0.2);
      ctx.fillStyle = "rgba(12, 18, 16, 0.82)";
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, tilePx * 0.07);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX + radius, centerY);
      ctx.lineTo(centerX, centerY + radius);
      ctx.lineTo(centerX - radius, centerY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (route.vertical?.length) {
      ctx.fillStyle = color;
      ctx.font = `700 ${Math.max(7, Math.floor(tilePx * 0.32))}px ui-monospace, SFMono-Regular, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(route.vertical.includes("up") ? "↑" : "↓", centerX, centerY);
    }
    ctx.restore();
    return true;
  }

  function drawDesignation(ctx, cell, position, tilePx) {
    if (!cell?.planned && !cell?.draft
      && !["plannedExcavation", "draftExcavation"].includes(cell?.base?.kind)) {
      return false;
    }
    const invalid = cell?.draft && !cell.draft.valid;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = invalid ? "#c96b4f" : cell?.draft ? "#759653" : "#b78f4d";
    ctx.lineWidth = Math.max(1.25, tilePx * 0.08);
    ctx.setLineDash([Math.max(2, tilePx * 0.2), Math.max(1, tilePx * 0.1)]);
    ctx.strokeRect(
      position.x + tilePx * 0.12,
      position.y + tilePx * 0.12,
      tilePx * 0.76,
      tilePx * 0.76
    );
    ctx.restore();
    drawGlyph(
      ctx,
      cell?.visual?.glyph || (invalid ? "?" : "M"),
      position.x,
      position.y,
      tilePx,
      invalid ? "#ffb8a8" : "#e1b75f",
      0.9
    );
    return true;
  }

  function drawEntityCell(ctx, position, tilePx, style, options = {}) {
    const alpha = cleanNumber(style.alpha, 0.88) * cleanNumber(options.alphaMultiplier, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style.fill;
    ctx.fillRect(position.x + 1, position.y + 1, Math.max(1, tilePx - 2), Math.max(1, tilePx - 2));
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = Math.max(1, tilePx * 0.055);
    ctx.setLineDash(options.slice || options.cutaway || style.dashed
      ? [Math.max(2, tilePx * 0.2), Math.max(1, tilePx * 0.12)]
      : []);
    ctx.strokeRect(position.x + 1.5, position.y + 1.5, Math.max(0, tilePx - 3), Math.max(0, tilePx - 3));
    if (options.slice) {
      ctx.beginPath();
      ctx.moveTo(position.x + tilePx * 0.2, position.y + tilePx * 0.2);
      ctx.lineTo(position.x + tilePx * 0.8, position.y + tilePx * 0.8);
      ctx.moveTo(position.x + tilePx * 0.8, position.y + tilePx * 0.2);
      ctx.lineTo(position.x + tilePx * 0.2, position.y + tilePx * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function actorCueModel(entity) {
    const actor = entity?.category === "actor" || ["slime", "scientist", "creature"].includes(entity?.kind);
    if (!actor) return null;
    const poseMarks = {
      moving: ">",
      working: "+",
      feeding: "o",
      attacking: "!",
      guarded: "D",
      fleeing: ">>",
      quiescent: ".",
      strained: "=",
      recovering: "+"
    };
    const conditionMarks = {
      injured: "/",
      critical: "!!",
      compressed: "=",
      stressed: "^",
      uncertain: "?"
    };
    return {
      facing: ["north", "east", "south", "west"].includes(entity?.facing) ? entity.facing : "none",
      pose: String(entity?.pose || "idle"),
      poseMark: poseMarks[entity?.pose] || "",
      conditionMarks: (entity?.condition?.cues || []).map((cue) => conditionMarks[cue]).filter(Boolean)
    };
  }

  function drawActorStateCues(ctx, entity, position, tilePx, alpha = 1, markerScale = 1) {
    const cue = actorCueModel(entity);
    if (!cue || tilePx < 8) return false;
    const scale = Math.max(1, cleanNumber(markerScale, 1));
    const x = position.x;
    const y = position.y;
    const center = { x: x + tilePx / 2, y: y + tilePx / 2 };
    const edge = tilePx * 0.16;
    const half = Math.max(1.5, tilePx * 0.09 * scale);
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0.35, alpha));
    if (cue.facing !== "none") {
      const point = {
        north: { x: center.x, y: y + edge },
        east: { x: x + tilePx - edge, y: center.y },
        south: { x: center.x, y: y + tilePx - edge },
        west: { x: x + edge, y: center.y }
      }[cue.facing];
      ctx.fillStyle = "#e9f4c7";
      ctx.beginPath();
      if (cue.facing === "north" || cue.facing === "south") {
        const direction = cue.facing === "north" ? -1 : 1;
        ctx.moveTo(point.x, point.y + direction * half);
        ctx.lineTo(point.x - half, point.y - direction * half);
        ctx.lineTo(point.x + half, point.y - direction * half);
      } else {
        const direction = cue.facing === "west" ? -1 : 1;
        ctx.moveTo(point.x + direction * half, point.y);
        ctx.lineTo(point.x - direction * half, point.y - half);
        ctx.lineTo(point.x - direction * half, point.y + half);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = `800 ${Math.max(6, Math.floor(tilePx * 0.31 * scale))}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.textBaseline = "bottom";
    if (cue.poseMark) {
      ctx.fillStyle = "#f0d989";
      ctx.textAlign = "left";
      ctx.fillText(cue.poseMark, x + tilePx * 0.1, y + tilePx * 0.94, tilePx * 0.38);
    }
    if (cue.conditionMarks.length) {
      ctx.fillStyle = cue.conditionMarks.includes("!!") ? "#ff8b73" : "#ffd0c6";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(cue.conditionMarks.slice(0, 2).join(""), x + tilePx * 0.92, y + tilePx * 0.06, tilePx * 0.5);
    }
    ctx.restore();
    return true;
  }

  function drawEntityStatusCues(ctx, entity, position, tilePx, alpha = 1, markerScale = 1) {
    const cues = (entity?.statusCues || []).slice(0, 2);
    if (!cues.length) return false;
    const scale = Math.max(1, cleanNumber(markerScale, 1));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${Math.max(6, Math.floor(tilePx * 0.23 * scale))}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    cues.forEach((cue, index) => {
      const radius = Math.max(3, tilePx * 0.16 * scale);
      const x = position.x + tilePx - radius - index * radius * 1.65;
      const y = position.y + tilePx - radius;
      ctx.beginPath();
      ctx.fillStyle = "rgba(18, 19, 15, 0.94)";
      ctx.strokeStyle = ["serious", "critical"].includes(cue.severity) ? "#ff8b73" : "#e1b75f";
      ctx.lineWidth = Math.max(1, tilePx * 0.045);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(cue.glyph || "!", x, y + tilePx * 0.015, radius * 1.5);
    });
    ctx.restore();
    return true;
  }

  function effectColor(effect) {
    const feedbackColors = {
      feedbackArrival: "#68c8d8",
      feedbackWork: "#e1b75f",
      feedbackDoor: "#f0d989",
      feedbackImpact: "#ff8b73",
      feedbackMiss: "#b9c1b4",
      feedbackConstruction: "#c6a66a",
      feedbackHazard: "#e67e4e",
      feedbackComplete: "#9abe60",
      feedbackFailure: "#ff8b73"
    };
    if (feedbackColors[effect?.kind]) return feedbackColors[effect.kind];
    const damageTags = new Set(effect?.damageTags || []);
    if (effect?.kind === "fire" || damageTags.has("heat")) return "#ff9c56";
    if (effect?.kind === "electricity" || damageTags.has("electrical")) return "#9ed8ff";
    if (effect?.kind === "magic" || [...damageTags].some((tag) => ["arcane", "radiant", "shadow", "force"].includes(tag))) return "#cbb0ff";
    if (effect?.kind === "hazardousSpill" || ["serious", "critical"].includes(effect?.severity)) return "#ff8b73";
    if (effect?.plane === "ground") return "#9fbd96";
    return "#e1b75f";
  }

  function effectAlpha(effect, options = {}) {
    const knowledgeAlpha = effect?.knowledge?.state === "stale" ? 0.52
      : effect?.knowledge?.state === "uncertain" ? 0.68
        : 1;
    const intensityAlpha = {
      trace: 0.4,
      low: 0.52,
      medium: 0.68,
      high: 0.84,
      extreme: 1
    }[effect?.intensityBand] || 0.68;
    const presentationMultiplier = {
      reduced: 0.58,
      standard: 1,
      strong: 1.24
    }[options.effectIntensity] || 1;
    const minimum = ["serious", "critical"].includes(effect?.severity) ? 0.66 : 0.2;
    return Math.min(1, Math.max(minimum, knowledgeAlpha * intensityAlpha * presentationMultiplier));
  }

  function drawGroundEffect(ctx, effect, position, tilePx, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, tilePx * 0.05);
    ctx.beginPath();
    ctx.ellipse(
      position.x + tilePx * 0.5,
      position.y + tilePx * 0.72,
      tilePx * 0.38,
      tilePx * 0.2,
      -0.08,
      0,
      Math.PI * 2
    );
    ctx.fill();
    if (effect.kind === "hazardousSpill") {
      ctx.beginPath();
      ctx.moveTo(position.x + tilePx * 0.24, position.y + tilePx * 0.58);
      ctx.lineTo(position.x + tilePx * 0.72, position.y + tilePx * 0.82);
      ctx.moveTo(position.x + tilePx * 0.32, position.y + tilePx * 0.82);
      ctx.lineTo(position.x + tilePx * 0.68, position.y + tilePx * 0.58);
      ctx.stroke();
    }
  }

  function drawWorldEffect(ctx, effect, position, tilePx, color) {
    const centerX = position.x + tilePx * 0.5;
    const centerY = position.y + tilePx * 0.48;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.25, tilePx * 0.07);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (effect.kind === "electricity") {
      ctx.beginPath();
      ctx.moveTo(centerX - tilePx * 0.18, centerY - tilePx * 0.34);
      ctx.lineTo(centerX + tilePx * 0.04, centerY - tilePx * 0.08);
      ctx.lineTo(centerX - tilePx * 0.02, centerY + tilePx * 0.02);
      ctx.lineTo(centerX + tilePx * 0.2, centerY + tilePx * 0.34);
      ctx.stroke();
      return;
    }
    if (effect.kind === "fire") {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - tilePx * 0.34);
      ctx.quadraticCurveTo(centerX + tilePx * 0.28, centerY, centerX, centerY + tilePx * 0.34);
      ctx.quadraticCurveTo(centerX - tilePx * 0.28, centerY, centerX, centerY - tilePx * 0.34);
      ctx.fill();
      return;
    }
    if (effect.kind === "magic") {
      ctx.beginPath();
      ctx.arc(centerX, centerY, tilePx * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      drawGlyph(ctx, effect.glyph || "*", position.x, position.y, tilePx, color);
      return;
    }
    if (effect.kind === "structuralFailure") {
      ctx.beginPath();
      ctx.moveTo(centerX - tilePx * 0.32, centerY - tilePx * 0.25);
      ctx.lineTo(centerX - tilePx * 0.06, centerY - tilePx * 0.02);
      ctx.lineTo(centerX - tilePx * 0.22, centerY + tilePx * 0.3);
      ctx.moveTo(centerX + tilePx * 0.24, centerY - tilePx * 0.3);
      ctx.lineTo(centerX + tilePx * 0.04, centerY);
      ctx.lineTo(centerX + tilePx * 0.3, centerY + tilePx * 0.25);
      ctx.stroke();
      return;
    }
    drawGlyph(ctx, effect.glyph || "*", position.x, position.y, tilePx, color);
  }

  function drawAlertEffect(ctx, effect, position, tilePx, color) {
    const centerX = position.x + tilePx * 0.5;
    const centerY = position.y + tilePx * 0.5;
    if (effect.uncertaintyRadius > 0) {
      ctx.save();
      ctx.setLineDash([Math.max(2, tilePx * 0.22), Math.max(1, tilePx * 0.14)]);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, tilePx * 0.055);
      ctx.beginPath();
      ctx.arc(centerX, centerY, (effect.uncertaintyRadius + 0.5) * tilePx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const radius = tilePx * 0.34;
    ctx.strokeStyle = color;
    ctx.fillStyle = "rgba(25, 18, 14, 0.82)";
    ctx.lineWidth = Math.max(1.5, tilePx * 0.08);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX + radius, centerY);
    ctx.lineTo(centerX, centerY + radius);
    ctx.lineTo(centerX - radius, centerY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawGlyph(ctx, effect.glyph || "!", position.x, position.y, tilePx, color);
  }

  function feedbackEffectSample(effect, options = {}) {
    const feedback = effect?.feedback;
    if (!feedback) {
      return { valid: false, visible: true, active: false, animated: false, progress: 0, opacity: 1, pulse: 0 };
    }
    const startedAtMs = cleanNumber(feedback.startedAtMs);
    const durationMs = Math.max(1, cleanNumber(feedback.durationMs, 1));
    const nowMs = cleanNumber(options.presentationRealTimeMs, startedAtMs);
    const elapsedMs = nowMs - startedAtMs;
    const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    const visible = elapsedMs >= 0 && elapsedMs < durationMs;
    const animated = visible && !options.reducedMotion;
    const fadeStart = 0.62;
    return {
      valid: true,
      visible,
      active: visible,
      animated,
      progress: animated ? progress : 0.5,
      opacity: !visible ? 0 : animated && progress > fadeStart
        ? 1 - (progress - fadeStart) / (1 - fadeStart)
        : 1,
      pulse: animated ? (Math.sin(progress * Math.PI * 4) + 1) / 2 : 0.5
    };
  }

  function feedbackDirectionVector(direction) {
    return {
      north: { x: 0, y: -1 },
      east: { x: 1, y: 0 },
      south: { x: 0, y: 1 },
      west: { x: -1, y: 0 },
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 }
    }[direction] || { x: 0, y: 0 };
  }

  function drawFeedbackEffect(ctx, effect, sample, position, tilePx, color) {
    const centerX = position.x + tilePx * 0.5;
    const centerY = position.y + tilePx * 0.5;
    const progress = sample.progress;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.5, tilePx * 0.065);
    if (["feedbackArrival", "feedbackComplete"].includes(effect.kind)) {
      const radius = tilePx * (0.16 + progress * 0.32);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      if (effect.kind === "feedbackComplete") {
        ctx.beginPath();
        ctx.moveTo(centerX - tilePx * 0.16, centerY);
        ctx.lineTo(centerX - tilePx * 0.03, centerY + tilePx * 0.13);
        ctx.lineTo(centerX + tilePx * 0.2, centerY - tilePx * 0.16);
        ctx.stroke();
      }
      return;
    }
    if (effect.kind === "feedbackWork") {
      const radius = tilePx * (0.25 + sample.pulse * 0.06);
      const angle = sample.animated ? progress * Math.PI * 2 : 0;
      for (let index = 0; index < 4; index += 1) {
        const spoke = angle + index * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(spoke) * radius * 0.45, centerY + Math.sin(spoke) * radius * 0.45);
        ctx.lineTo(centerX + Math.cos(spoke) * radius, centerY + Math.sin(spoke) * radius);
        ctx.stroke();
      }
      ctx.strokeRect(centerX - tilePx * 0.12, centerY - tilePx * 0.12, tilePx * 0.24, tilePx * 0.24);
      return;
    }
    if (effect.kind === "feedbackDoor") {
      const horizontal = ["east", "west"].includes(effect.feedback?.direction);
      const spread = tilePx * (sample.animated ? 0.08 + progress * 0.24 : 0.22);
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(centerX - spread, centerY - tilePx * 0.34);
        ctx.lineTo(centerX - spread, centerY + tilePx * 0.34);
        ctx.moveTo(centerX + spread, centerY - tilePx * 0.34);
        ctx.lineTo(centerX + spread, centerY + tilePx * 0.34);
      } else {
        ctx.moveTo(centerX - tilePx * 0.34, centerY - spread);
        ctx.lineTo(centerX + tilePx * 0.34, centerY - spread);
        ctx.moveTo(centerX - tilePx * 0.34, centerY + spread);
        ctx.lineTo(centerX + tilePx * 0.34, centerY + spread);
      }
      ctx.stroke();
      return;
    }
    if (effect.kind === "feedbackImpact") {
      const direction = feedbackDirectionVector(effect.feedback?.direction);
      const offsetX = direction.x * tilePx * 0.1;
      const offsetY = direction.y * tilePx * 0.1;
      const inner = tilePx * 0.08;
      const outer = tilePx * (0.3 + progress * 0.18);
      for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(centerX + offsetX + Math.cos(angle) * inner, centerY + offsetY + Math.sin(angle) * inner);
        ctx.lineTo(centerX + offsetX + Math.cos(angle) * outer, centerY + offsetY + Math.sin(angle) * outer);
        ctx.stroke();
      }
      return;
    }
    if (effect.kind === "feedbackMiss") {
      ctx.setLineDash([Math.max(2, tilePx * 0.12), Math.max(1, tilePx * 0.08)]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, tilePx * 0.32, -Math.PI * 0.8, Math.PI * 0.35);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    if (effect.kind === "feedbackConstruction") {
      const points = [[-0.28, 0.18], [-0.12, -0.04], [0.08, 0.14], [0.24, -0.12], [0.3, 0.2]];
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const rise = sample.animated ? progress * tilePx * (0.12 + index * 0.025) : tilePx * 0.08;
        ctx.beginPath();
        ctx.arc(
          centerX + point[0] * tilePx,
          centerY + point[1] * tilePx - rise,
          Math.max(1.5, tilePx * (0.045 + index * 0.006)),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      return;
    }
    if (effect.kind === "feedbackHazard") {
      for (const offset of [0, 0.18]) {
        const local = sample.animated ? (progress + offset) % 1 : 0.5 + offset * 0.2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, tilePx * (0.12 + local * 0.36), 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }
    if (effect.kind === "feedbackFailure") {
      const radius = tilePx * 0.3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX + radius, centerY);
      ctx.lineTo(centerX, centerY + radius);
      ctx.lineTo(centerX - radius, centerY);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX - tilePx * 0.12, centerY - tilePx * 0.12);
      ctx.lineTo(centerX + tilePx * 0.12, centerY + tilePx * 0.12);
      ctx.moveTo(centerX + tilePx * 0.12, centerY - tilePx * 0.12);
      ctx.lineTo(centerX - tilePx * 0.12, centerY + tilePx * 0.12);
      ctx.stroke();
    }
  }

  function drawEffect(ctx, effect, visibleCellKeys, viewport, tilePx, origin, options = {}) {
    let cellsDrawn = 0;
    let spritesDrawn = 0;
    let spriteFallbacks = 0;
    const feedbackSample = feedbackEffectSample(effect, options);
    if (feedbackSample.valid && !feedbackSample.visible) {
      return { cellsDrawn, spritesDrawn, spriteFallbacks, activeAnimations: 0 };
    }
    for (const cell of effect.cells || []) {
      if (!visibleCellKeys.has(cellKey(cell))) continue;
      cellsDrawn += 1;
      const position = tilePosition(cell, viewport, tilePx, origin);
      const spriteKey = feedbackSample.valid ? "" : effect.visualKey;
      const sprite = options.glyphMode ? null : resolveSprite(options.assetLoader, spriteKey);
      if (sprite) {
        drawSprite(ctx, sprite, position.x, position.y, tilePx, tilePx);
        spritesDrawn += 1;
      } else if (spriteKey && !options.glyphMode) {
        spriteFallbacks += 1;
      }
      ctx.save();
      const color = effectColor(effect);
      ctx.globalAlpha = effectAlpha(effect, options) * (feedbackSample.valid ? feedbackSample.opacity : 1);
      if (["stale", "uncertain"].includes(effect.knowledge?.state)) {
        ctx.setLineDash([Math.max(2, tilePx * 0.2), Math.max(1, tilePx * 0.12)]);
      }
      if (feedbackSample.valid) {
        drawFeedbackEffect(ctx, effect, feedbackSample, position, tilePx, color);
      } else if (!sprite) {
        if (effect.plane === "ground") drawGroundEffect(ctx, effect, position, tilePx, color);
        else if (effect.plane === "alert") drawAlertEffect(ctx, effect, position, tilePx, color);
        else drawWorldEffect(ctx, effect, position, tilePx, color);
      } else if (effect.plane === "alert" && effect.uncertaintyRadius > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, tilePx * 0.055);
        ctx.beginPath();
        ctx.arc(
          position.x + tilePx * 0.5,
          position.y + tilePx * 0.5,
          (effect.uncertaintyRadius + 0.5) * tilePx,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      if (!feedbackSample.valid) {
        drawGlyph(
          ctx,
          effect.glyph || "!",
          position.x,
          position.y,
          tilePx,
          color,
          1,
          options.markerScale
        );
      }
      if (effect.stackCount > 1) {
        ctx.fillStyle = color;
        ctx.font = "800 " + Math.max(6, Math.floor(tilePx * 0.24 * cleanNumber(options.markerScale, 1))) + "px ui-monospace, SFMono-Regular, Consolas, monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(String(effect.stackCount), position.x + tilePx * 0.94, position.y + tilePx * 0.04, tilePx * 0.4);
      }
      ctx.restore();
    }
    return {
      cellsDrawn,
      spritesDrawn,
      spriteFallbacks,
      activeAnimations: feedbackSample.active ? 1 : 0
    };
  }

  function prepareDrawPlan(scene, options = {}) {
    const cells = renderCells(scene, options);
    const visibleCellKeys = new Set(cells.map((cell) => cellKey(cell.cell)));
    const entities = RenderOrder.orderedEntities((scene?.entities || [])
      .filter((entity) => (entity.footprintCells || [])
        .some((cell) => visibleCellKeys.has(cellKey(cell)))));
    const effects = [...(scene?.effects || [])]
      .filter((effect) => (effect.cells || [])
        .some((cell) => visibleCellKeys.has(cellKey(cell))))
      .sort((left, right) => RenderOrder.compareRenderKeys(
        RenderOrder.effectRenderKey(left),
        RenderOrder.effectRenderKey(right)
      ));
    const entitiesByPass = new Map();
    const effectsByPass = new Map();
    for (const entity of entities) {
      const pass = RenderOrder.entityPass(entity);
      if (!entitiesByPass.has(pass)) entitiesByPass.set(pass, []);
      entitiesByPass.get(pass).push(entity);
    }
    for (const effect of effects) {
      const pass = RenderOrder.effectPass(effect);
      if (!effectsByPass.has(pass)) effectsByPass.set(pass, []);
      effectsByPass.get(pass).push(effect);
    }
    return {
      cells,
      visibleCellKeys,
      cellsByKey: new Map(cells.map((cell) => [cellKey(cell.cell), cell])),
      entities,
      effects,
      entitiesByPass,
      effectsByPass,
      occluderIds: RenderOrder.selectedOccluderIds(scene),
      cutawayIds: RenderOrder.cutawayEntityIds(scene),
      selectedCellKeys: new Set((scene?.selection?.cells || []).map(cellKey)),
      stats: {
        inputCells: scene?.cells?.length || 0,
        visibleCells: cells.length,
        culledCells: Math.max(0, (scene?.cells?.length || 0) - cells.length),
        inputEntities: scene?.entities?.length || 0,
        visibleEntities: entities.length,
        culledEntities: Math.max(0, (scene?.entities?.length || 0) - entities.length),
        inputEffects: scene?.effects?.length || 0,
        visibleEffects: effects.length,
        culledEffects: Math.max(0, (scene?.effects?.length || 0) - effects.length)
      }
    };
  }

  function renderScene(ctx, scene, options = {}) {
    const viewport = scene?.viewport || { x: 0, y: 0, z: 0, width: 1, height: 1 };
    const tilePx = Math.max(4, cleanNumber(options.tilePx, 14));
    const origin = presentationOrigin(options);
    const drawPlan = options.drawPlan || prepareDrawPlan(scene, options);
    const {
      cells,
      visibleCellKeys,
      cellsByKey,
      entities,
      effects,
      entitiesByPass,
      effectsByPass,
      occluderIds,
      cutawayIds,
      selectedCellKeys
    } = drawPlan;
    let entityCellsDrawn = 0;
    let entitiesDrawn = 0;
    let spritesDrawn = 0;
    let spriteFallbacks = 0;
    let multiTileSpritesDrawn = 0;
    let spritePlacementMismatches = 0;
    let tallSlicesDrawn = 0;
    let fadedOccludersDrawn = 0;
    let overheadCutawaysDrawn = 0;
    let activeAnimations = 0;
    let interpolatedEntities = 0;
    const entityHitRegions = [];
    const entityMotionSamples = new Map();
    const placementWarnings = [];
    const renderPassCounts = {};
    const countPass = (pass, amount = 1) => {
      const name = RenderOrder.passName(pass);
      renderPassCounts[name] = (renderPassCounts[name] || 0) + amount;
    };

    for (const cell of cells) {
      const position = tilePosition(cell.cell, viewport, tilePx, origin);
      const style = cellStyle(cell, options);
      drawTile(ctx, position.x, position.y, tilePx, style);
      const spriteKey = terrainSpriteKey(cell);
      const sprite = options.glyphMode ? null : resolveSprite(options.assetLoader, spriteKey);
      if (sprite) {
        drawSprite(ctx, sprite, position.x, position.y, tilePx, tilePx, 0.55 * cleanNumber(style.alpha, 1));
        spritesDrawn += 1;
      } else if (spriteKey && !options.glyphMode) {
        spriteFallbacks += 1;
      }
      const priorAlpha = ctx.globalAlpha;
      ctx.globalAlpha = cleanNumber(style.alpha, 1);
      drawGlyph(ctx, terrainGlyph(cell), position.x, position.y, tilePx, style.text, 1, options.markerScale);
      ctx.globalAlpha = priorAlpha;
    }
    countPass(RenderOrder.RENDER_PASSES.terrain, cells.length);

    const drawEntity = (entity) => {
      const anchorLightingCell = cellsByKey.get(cellKey(entity.anchorCell))
        || (entity.footprintCells || []).map((cell) => cellsByKey.get(cellKey(cell))).find(Boolean);
      const style = highContrastStyle(
        lightingStyle(anchorLightingCell, entityStyle(entity), 0.42),
        options.highContrast
      );
      const motionSample = entityMotionSample(entity, options);
      entityMotionSamples.set(entity.id, motionSample);
      if (motionSample.active) activeAnimations += 1;
      if (motionSample.interpolated) interpolatedEntities += 1;
      const layerMode = RenderOrder.entityLayerMode(entity, viewport.z);
      const faded = occluderIds.has(entity.id);
      const cutaway = cutawayIds.has(entity.id);
      const alphaMultiplier = (cutaway ? 0.22 : faded ? 0.32 : 1) * motionSample.opacity;
      const visibleFootprint = (entity.footprintCells || []).filter((cell) => visibleCellKeys.has(cellKey(cell)));
      if (!visibleFootprint.length || layerMode === "hidden") return;
      if (faded) fadedOccludersDrawn += 1;
      if (cutaway) overheadCutawaysDrawn += 1;
      if (layerMode === "slice") tallSlicesDrawn += 1;
      for (const cell of visibleFootprint) {
        if (!visibleCellKeys.has(cellKey(cell))) continue;
        entityCellsDrawn += 1;
        const position = tilePosition(cell, viewport, tilePx, origin, motionSample.offset);
        drawEntityCell(ctx, position, tilePx, style, {
          alphaMultiplier,
          slice: layerMode === "slice",
          cutaway
        });
      }
      entitiesDrawn += 1;
      countPass(RenderOrder.entityPass(entity));
      if (layerMode === "slice") return;
      const glyphAnchor = inViewport(entity.anchorCell, viewport)
        ? entity.anchorCell
        : visibleFootprint[0];
      if (glyphAnchor) {
        const position = tilePosition(glyphAnchor, viewport, tilePx, origin, motionSample.offset);
        const spriteKey = entity.visual?.key;
        const sprite = options.glyphMode
          ? null
          : resolveSprite(options.assetLoader, spriteKey, entity.visual?.fallbackKeys);
        if (sprite) {
          const placement = spritePlacement(entity, sprite);
          if (drawPlacedSprite(
            ctx,
            sprite,
            placement,
            viewport,
            tilePx,
            origin,
            cleanNumber(style.alpha, 1) * alphaMultiplier,
            motionSample.offset
          )) {
            spritesDrawn += 1;
            if (placement.bounds.width > 1 || placement.bounds.height > 1 || placement.bounds.depth > 1) {
              multiTileSpritesDrawn += 1;
            }
          } else {
            spriteFallbacks += 1;
            spritePlacementMismatches += 1;
            if (placementWarnings.length < 8) {
              placementWarnings.push(`${entity.id} (${sprite.resolvedKey}): ${placement.reason}`);
            }
            drawGlyph(
              ctx,
              entity.visual?.glyph || "?",
              position.x,
              position.y,
              tilePx,
              style.text,
              cleanNumber(style.alpha, 1) * alphaMultiplier,
              options.markerScale
            );
          }
        } else {
          if (spriteKey && !options.glyphMode) spriteFallbacks += 1;
          drawGlyph(
            ctx,
            entity.visual?.glyph || "?",
            position.x,
            position.y,
            tilePx,
            style.text,
            cleanNumber(style.alpha, 1) * alphaMultiplier,
            options.markerScale
          );
        }
        drawActorStateCues(
          ctx,
          entity,
          position,
          tilePx,
          cleanNumber(style.alpha, 1) * alphaMultiplier,
          options.markerScale
        );
        drawEntityStatusCues(
          ctx,
          entity,
          position,
          tilePx,
          cleanNumber(style.alpha, 1) * alphaMultiplier,
          options.markerScale
        );
      }
      const bounds = entityBounds(entity);
      if (bounds
        && entity.category === "actor"
        && entity.target
        && ["current", "debug"].includes(entity.knowledge?.state)) {
        entityHitRegions.push({
          entityId: entity.id,
          target: entity.target,
          anchorCell: entity.anchorCell,
          x: origin.x + (bounds.x - viewport.x + motionSample.offset.x) * tilePx,
          y: origin.y + (bounds.y - viewport.y + motionSample.offset.y) * tilePx,
          width: bounds.width * tilePx,
          height: bounds.height * tilePx
        });
      }
    };

    const drawEffectsAtPass = (pass) => {
      for (const effect of effectsByPass.get(pass) || []) {
        const counts = drawEffect(
          ctx,
          effect,
          visibleCellKeys,
          viewport,
          tilePx,
          origin,
          options
        );
        spritesDrawn += counts.spritesDrawn;
        spriteFallbacks += counts.spriteFallbacks;
        activeAnimations += counts.activeAnimations || 0;
        countPass(pass, counts.cellsDrawn);
      }
    };
    const drawEntitiesAtPass = (pass) => {
      for (const entity of entitiesByPass.get(pass) || []) {
        drawEntity(entity);
      }
    };

    drawEffectsAtPass(RenderOrder.RENDER_PASSES.ground);
    drawEntitiesAtPass(RenderOrder.RENDER_PASSES.ground);
    for (const cell of cells) {
      const position = tilePosition(cell.cell, viewport, tilePx, origin);
      if (drawRoute(ctx, cell, position, tilePx, options)) countPass(RenderOrder.RENDER_PASSES.path);
      if (drawDesignation(ctx, cell, position, tilePx)) countPass(RenderOrder.RENDER_PASSES.path);
    }
    for (const pass of [
      RenderOrder.RENDER_PASSES.item,
      RenderOrder.RENDER_PASSES.remains,
      RenderOrder.RENDER_PASSES.fixture,
      RenderOrder.RENDER_PASSES.actor,
      RenderOrder.RENDER_PASSES.overhead
    ]) {
      drawEntitiesAtPass(pass);
    }
    drawEffectsAtPass(RenderOrder.RENDER_PASSES.effect);
    for (const cell of cells) {
      const position = tilePosition(cell.cell, viewport, tilePx, origin);
      if (drawAtmosphere(ctx, cell, position, tilePx)) countPass(RenderOrder.RENDER_PASSES.effect);
    }
    drawEffectsAtPass(RenderOrder.RENDER_PASSES.alert);

    const selectedMotion = entityMotionSamples.get(scene?.selection?.entityId);
    for (const cell of cells) {
      const position = tilePosition(cell.cell, viewport, tilePx, origin);
      if (cell.selected || selectedCellKeys.has(cellKey(cell.cell))) {
        const selectionPosition = selectedMotion
          ? tilePosition(cell.cell, viewport, tilePx, origin, selectedMotion.offset)
          : position;
        ctx.save();
        ctx.globalAlpha = selectedMotion?.opacity ?? 1;
        ctx.strokeStyle = options.highContrast ? "#5cffff" : "#68c8d8";
        ctx.lineWidth = Math.max(options.highContrast ? 2.25 : 1.5, tilePx * (options.highContrast ? 0.13 : 0.09));
        ctx.strokeRect(selectionPosition.x + 1, selectionPosition.y + 1, Math.max(0, tilePx - 2), Math.max(0, tilePx - 2));
        ctx.restore();
        countPass(RenderOrder.RENDER_PASSES.selection);
      }
      if (cell.cursor) {
        ctx.strokeStyle = options.highContrast ? "#fff36a" : "#f0d989";
        ctx.lineWidth = Math.max(options.highContrast ? 2.25 : 1.5, tilePx * (options.highContrast ? 0.12 : 0.08));
        ctx.strokeRect(position.x + 3, position.y + 3, Math.max(0, tilePx - 6), Math.max(0, tilePx - 6));
        countPass(RenderOrder.RENDER_PASSES.cursor);
      }
    }

    return {
      cellsDrawn: cells.length,
      entitiesDrawn,
      entityCellsDrawn,
      spritesDrawn,
      spriteFallbacks,
      multiTileSpritesDrawn,
      spritePlacementMismatches,
      placementWarnings,
      tallSlicesDrawn,
      fadedOccludersDrawn,
      overheadCutawaysDrawn,
      activeAnimations,
      animationActive: activeAnimations > 0,
      interpolatedEntities,
      entityHitRegions,
      renderPassCounts,
      drawPlanStats: { ...drawPlan.stats }
    };
  }

  function createRenderer(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new Error("Canvas map renderer requires a canvas element.");
    }
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    let scene = null;
    let presentation = {};
    let frameId = 0;
    let destroyed = false;
    let resizeObserver = null;
    let entityHitRegions = [];
    let drawPlan = null;
    const pendingInvalidationReasons = new Set();
    const now = typeof options.now === "function"
      ? options.now
      : () => typeof performance === "object" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    const presentationClock = AnimationClock.createClock({ now });
    const diagnostics = {
      version: RENDERER_VERSION,
      frameCount: 0,
      lastMs: 0,
      maxMs: 0,
      totalMs: 0,
      width: 0,
      height: 0,
      devicePixelRatio: 1,
      cellsDrawn: 0,
      entitiesDrawn: 0,
      entityCellsDrawn: 0,
      spritesDrawn: 0,
      spriteFallbacks: 0,
      multiTileSpritesDrawn: 0,
      spritePlacementMismatches: 0,
      placementWarnings: [],
      tallSlicesDrawn: 0,
      fadedOccludersDrawn: 0,
      overheadCutawaysDrawn: 0,
      activeAnimations: 0,
      interpolatedEntities: 0,
      renderPassCounts: {},
      drawPlanBuilds: 0,
      drawPlanUses: 0,
      drawPlanCacheHits: 0,
      drawPlanStats: {},
      invalidations: {},
      lastInvalidationReasons: []
    };

    function rebuildDrawPlan() {
      drawPlan = scene ? prepareDrawPlan(scene, presentation) : null;
      diagnostics.drawPlanBuilds += drawPlan ? 1 : 0;
      diagnostics.drawPlanStats = { ...(drawPlan?.stats || {}) };
    }

    function snapshot() {
      return {
        ...diagnostics,
        averageMs: diagnostics.frameCount ? diagnostics.totalMs / diagnostics.frameCount : 0,
        pending: Boolean(frameId),
        presentation: {
          tilePx: Math.max(4, cleanNumber(presentation.tilePx, 14)),
          origin: presentationOrigin(presentation),
          includeOverscan: Boolean(presentation.includeOverscan),
          glyphMode: Boolean(presentation.glyphMode),
          reducedMotion: Boolean(presentation.reducedMotion),
          highContrast: Boolean(presentation.highContrast),
          effectIntensity: ["reduced", "strong"].includes(presentation.effectIntensity)
            ? presentation.effectIntensity
            : "standard",
          markerScale: Math.max(1, cleanNumber(presentation.markerScale, 1))
        },
        timeline: presentationClock.snapshot(),
        assets: options.assetLoader?.snapshot?.() || null
      };
    }

    function drawFrame(realTimeMs) {
      frameId = 0;
      if (destroyed || !scene) return;
      const invalidationReasons = [...pendingInvalidationReasons];
      pendingInvalidationReasons.clear();
      const reusedDrawPlan = Boolean(drawPlan);
      if (!drawPlan) rebuildDrawPlan();
      const startedAt = now();
      const clockSample = presentationClock.sample(
        Number.isFinite(Number(realTimeMs)) ? Number(realTimeMs) : startedAt
      );
      const rect = canvas.getBoundingClientRect();
      const tilePx = Math.max(4, cleanNumber(presentation.tilePx, 14));
      const fallbackWidth = cleanNumber(scene.viewport?.width, 1) * tilePx + 12;
      const fallbackHeight = cleanNumber(scene.viewport?.height, 1) * tilePx + 12;
      const cssWidth = Math.max(1, Math.round(rect.width || fallbackWidth));
      const cssHeight = Math.max(1, Math.round(rect.height || fallbackHeight));
      const dpr = Math.max(1, cleanNumber(options.devicePixelRatio, rootDevicePixelRatio()));
      const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
      const backingHeight = Math.max(1, Math.round(cssHeight * dpr));
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = presentation.highContrast ? "#000000" : "#090a08";
      context.fillRect(0, 0, cssWidth, cssHeight);
      const counts = renderScene(context, scene, {
        ...presentation,
        tilePx,
        assetLoader: options.assetLoader,
        presentationTime: clockSample.gameTime,
        presentationRealTimeMs: clockSample.realTimeMs,
        speed: clockSample.speed,
        paused: clockSample.paused,
        timelineMode: clockSample.mode,
        drawPlan
      });
      const elapsedMs = now() - startedAt;
      diagnostics.frameCount += 1;
      diagnostics.lastMs = elapsedMs;
      diagnostics.maxMs = Math.max(diagnostics.maxMs, elapsedMs);
      diagnostics.totalMs += elapsedMs;
      diagnostics.width = cssWidth;
      diagnostics.height = cssHeight;
      diagnostics.devicePixelRatio = dpr;
      diagnostics.cellsDrawn = counts.cellsDrawn;
      diagnostics.entitiesDrawn = counts.entitiesDrawn;
      diagnostics.entityCellsDrawn = counts.entityCellsDrawn;
      diagnostics.spritesDrawn = counts.spritesDrawn;
      diagnostics.spriteFallbacks = counts.spriteFallbacks;
      diagnostics.multiTileSpritesDrawn = counts.multiTileSpritesDrawn;
      diagnostics.spritePlacementMismatches = counts.spritePlacementMismatches;
      diagnostics.placementWarnings = counts.placementWarnings;
      diagnostics.tallSlicesDrawn = counts.tallSlicesDrawn;
      diagnostics.fadedOccludersDrawn = counts.fadedOccludersDrawn;
      diagnostics.overheadCutawaysDrawn = counts.overheadCutawaysDrawn;
      diagnostics.activeAnimations = counts.activeAnimations;
      diagnostics.interpolatedEntities = counts.interpolatedEntities;
      diagnostics.renderPassCounts = counts.renderPassCounts;
      diagnostics.drawPlanUses += 1;
      if (reusedDrawPlan) diagnostics.drawPlanCacheHits += 1;
      diagnostics.drawPlanStats = { ...counts.drawPlanStats };
      diagnostics.lastInvalidationReasons = invalidationReasons;
      entityHitRegions = counts.entityHitRegions;
      canvas.dataset.canvasFrameCount = String(diagnostics.frameCount);
      canvas.dataset.canvasCellsDrawn = String(counts.cellsDrawn);
      canvas.dataset.canvasEntitiesDrawn = String(counts.entitiesDrawn);
      canvas.dataset.canvasSpritesDrawn = String(counts.spritesDrawn);
      options.onFrame?.(snapshot());
      if (counts.animationActive) invalidate("animation");
    }

    function draw(realTimeMs) {
      try {
        drawFrame(realTimeMs);
      } catch (error) {
        frameId = 0;
        pendingInvalidationReasons.clear();
        if (typeof options.onError === "function") {
          options.onError(error);
          return;
        }
        throw error;
      }
    }

    function invalidate(reason = "manual") {
      const key = String(reason || "manual");
      pendingInvalidationReasons.add(key);
      diagnostics.invalidations[key] = (diagnostics.invalidations[key] || 0) + 1;
      if (destroyed || frameId) return;
      frameId = window.requestAnimationFrame(draw);
    }

    function setScene(nextScene, nextPresentation = {}) {
      scene = nextScene;
      presentation = { ...presentation, ...nextPresentation };
      presentationClock.setSnapshot({
        gameTime: scene?.clock,
        timeline: scene?.timeline
      });
      rebuildDrawPlan();
      invalidate("scene");
    }

    function setPresentation(nextPresentation = {}) {
      const includeOverscanChanged = nextPresentation.includeOverscan !== undefined
        && Boolean(nextPresentation.includeOverscan) !== Boolean(presentation.includeOverscan);
      presentation = { ...presentation, ...nextPresentation };
      if (includeOverscanChanged) rebuildDrawPlan();
      invalidate("presentation");
    }

    function clientPointToCell(clientX, clientY) {
      if (!scene) return null;
      const rect = canvas.getBoundingClientRect();
      return screenToCell(scene, {
        x: cleanNumber(clientX) - rect.left,
        y: cleanNumber(clientY) - rect.top
      }, presentation);
    }

    function pointForCell(cell) {
      return cellToScreen(scene, cell, presentation);
    }

    function clientPointTarget(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = cleanNumber(clientX) - rect.left;
      const y = cleanNumber(clientY) - rect.top;
      return [...entityHitRegions].reverse().find((entry) =>
        x >= entry.x && x < entry.x + entry.width
        && y >= entry.y && y < entry.y + entry.height
      ) || null;
    }

    function pointForEntity(entityId) {
      const region = entityHitRegions.find((entry) => entry.entityId === entityId);
      return region ? { ...region } : null;
    }

    function destroy() {
      destroyed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      resizeObserver?.disconnect();
      resizeObserver = null;
    }

    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        options.onResize?.();
        invalidate("resize");
      });
      resizeObserver.observe(canvas);
    }

    return {
      setScene,
      setPresentation,
      clientPointToCell,
      clientPointTarget,
      pointForCell,
      pointForEntity,
      invalidate,
      destroy,
      snapshot
    };
  }

  function rootDevicePixelRatio() {
    return typeof window === "object" ? Math.max(1, cleanNumber(window.devicePixelRatio, 1)) : 1;
  }

  return {
    RENDERER_VERSION,
    visibleCells,
    renderCells,
    screenToCell,
    cellToScreen,
    cellStyle,
    entityStyle,
    entityMotionSample,
    actorCueModel,
    effectColor,
    effectAlpha,
    feedbackEffectSample,
    orientedLogicalSize,
    spritePlacement,
    prepareDrawPlan,
    renderScene,
    createRenderer
  };
}));
