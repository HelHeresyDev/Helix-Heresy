(function attachHelixCanvasMapRenderer(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixCanvasMapRenderer = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixCanvasMapRenderer() {
  "use strict";

  const RENDERER_VERSION = 1;
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
    solidEarth: { fill: "#0b0b08", stroke: "#14150f", text: "#6f7566" },
    floor: { fill: "#242822", stroke: "#30362d", text: "#879080" },
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

  function cellStyle(cell) {
    const base = cell?.base || {};
    let style = BASE_STYLES[base.kind] || BASE_STYLES.solidEarth;
    if (base.kind === "room") {
      style = withStyle(style, { fill: ROOM_COLORS[base.role] || style.fill });
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
    if (cell?.route) style = withStyle(style, { fill: "#26332d", stroke: cell.route.selected ? "#f0d989" : "#75b86b" });
    return style;
  }

  function entityStyle(entity) {
    const style = ENTITY_STYLES[entity?.kind] || ENTITY_STYLES[entity?.category] || ENTITY_STYLES.mapArtifact;
    if (entity?.knowledge?.state === "stale") {
      return withStyle(style, { alpha: 0.62, dashed: true });
    }
    if (entity?.knowledge?.state === "uncertain") {
      return withStyle(style, { alpha: 0.48, dashed: true });
    }
    if (entity?.condition?.band === "critical" || entity?.condition?.band === "breached") {
      return withStyle(style, { stroke: "#ff8b73" });
    }
    return style;
  }

  function terrainGlyph(cell) {
    const layer = cell?.visual?.layer;
    return ["object", "actor", "door", "incident"].includes(layer) ? "" : String(cell?.visual?.glyph || "");
  }

  function terrainSpriteKey(cell) {
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

  function drawGlyph(ctx, glyph, x, y, size, color, alpha = 1) {
    if (!glyph || color === "transparent") return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.max(6, Math.floor(size * 0.48))}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(glyph), x + size / 2, y + size / 2 + size * 0.025, size * 0.92);
    ctx.restore();
  }

  function resolveSprite(assetLoader, semanticKey) {
    if (!assetLoader || !semanticKey || typeof assetLoader.resolve !== "function") return null;
    const resolved = assetLoader.resolve(semanticKey);
    return resolved?.status === "ready" && resolved.image ? resolved : null;
  }

  function drawSprite(ctx, resolved, x, y, width, height, alpha = 1) {
    if (!resolved?.image) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(resolved.image, x, y, width, height);
    ctx.restore();
    return true;
  }

  function tilePosition(cell, viewport, tilePx, origin) {
    return {
      x: origin.x + (cell.x - viewport.x) * tilePx,
      y: origin.y + (cell.y - viewport.y) * tilePx
    };
  }

  function renderScene(ctx, scene, options = {}) {
    const viewport = scene?.viewport || { x: 0, y: 0, z: 0, width: 1, height: 1 };
    const tilePx = Math.max(4, cleanNumber(options.tilePx, 14));
    const origin = presentationOrigin(options);
    const cells = renderCells(scene, options);
    const visibleCellKeys = new Set(cells.map((cell) => cellKey(cell.cell)));
    const cellByKey = new Map(cells.map((cell) => [cellKey(cell.cell), cell]));
    let entityCellsDrawn = 0;
    let entitiesDrawn = 0;
    let spritesDrawn = 0;
    let spriteFallbacks = 0;

    for (const cell of cells) {
      const position = tilePosition(cell.cell, viewport, tilePx, origin);
      const style = cellStyle(cell);
      drawTile(ctx, position.x, position.y, tilePx, style);
      const spriteKey = terrainSpriteKey(cell);
      const sprite = resolveSprite(options.assetLoader, spriteKey);
      if (sprite) {
        drawSprite(ctx, sprite, position.x, position.y, tilePx, tilePx, 0.55);
        spritesDrawn += 1;
      } else if (spriteKey) {
        spriteFallbacks += 1;
      }
      drawGlyph(ctx, terrainGlyph(cell), position.x, position.y, tilePx, style.text);
    }

    const categoryOrder = { structure: 1, fixture: 2, item: 3, remains: 4, hazard: 5, actor: 6 };
    const entities = [...(scene?.entities || [])]
      .filter((entity) => (entity.footprintCells || []).some((cell) => visibleCellKeys.has(cellKey(cell))))
      .sort((left, right) => (categoryOrder[left.category] || 3) - (categoryOrder[right.category] || 3) || left.id.localeCompare(right.id));
    for (const entity of entities) {
      const style = entityStyle(entity);
      let visible = false;
      for (const cell of entity.footprintCells || []) {
        if (!visibleCellKeys.has(cellKey(cell))) continue;
        visible = true;
        entityCellsDrawn += 1;
        const position = tilePosition(cell, viewport, tilePx, origin);
        ctx.save();
        ctx.globalAlpha = cleanNumber(style.alpha, 0.88);
        ctx.fillStyle = style.fill;
        ctx.fillRect(position.x + 1, position.y + 1, Math.max(1, tilePx - 2), Math.max(1, tilePx - 2));
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = Math.max(1, tilePx * 0.055);
        ctx.setLineDash(style.dashed ? [Math.max(2, tilePx * 0.2), Math.max(1, tilePx * 0.12)] : []);
        ctx.strokeRect(position.x + 1.5, position.y + 1.5, Math.max(0, tilePx - 3), Math.max(0, tilePx - 3));
        ctx.restore();
      }
      if (!visible) continue;
      entitiesDrawn += 1;
      const anchor = inViewport(entity.anchorCell, viewport)
        ? entity.anchorCell
        : (entity.footprintCells || []).find((cell) => visibleCellKeys.has(cellKey(cell)));
      if (anchor) {
        const position = tilePosition(anchor, viewport, tilePx, origin);
        const spriteKey = entity.visual?.key;
        const sprite = resolveSprite(options.assetLoader, spriteKey);
        if (sprite) {
          drawSprite(ctx, sprite, position.x, position.y, tilePx, tilePx, cleanNumber(style.alpha, 1));
          spritesDrawn += 1;
        } else {
          if (spriteKey) spriteFallbacks += 1;
          drawGlyph(ctx, entity.visual?.glyph || "?", position.x, position.y, tilePx, style.text, cleanNumber(style.alpha, 1));
        }
      }
    }

    for (const effect of scene?.effects || []) {
      for (const cell of effect.cells || []) {
        if (!visibleCellKeys.has(cellKey(cell))) continue;
        const position = tilePosition(cell, viewport, tilePx, origin);
        const spriteKey = effect.visualKey;
        const sprite = resolveSprite(options.assetLoader, spriteKey);
        if (sprite) {
          drawSprite(ctx, sprite, position.x, position.y, tilePx, tilePx);
          spritesDrawn += 1;
        } else if (spriteKey) {
          spriteFallbacks += 1;
        }
        ctx.save();
        ctx.strokeStyle = effect.severity === "critical" || effect.severity === "serious" ? "#ff8b73" : "#e1b75f";
        ctx.lineWidth = Math.max(1.5, tilePx * 0.09);
        if (effect.knowledge?.state === "stale") ctx.setLineDash([Math.max(2, tilePx * 0.2), Math.max(1, tilePx * 0.12)]);
        ctx.strokeRect(position.x + 2, position.y + 2, Math.max(0, tilePx - 4), Math.max(0, tilePx - 4));
        ctx.restore();
        if (!sprite && !cellByKey.get(cellKey(cell))?.visual?.glyph) {
          drawGlyph(ctx, "A", position.x, position.y, tilePx, "#ffd0c6");
        }
      }
    }

    for (const cell of cells) {
      const position = tilePosition(cell.cell, viewport, tilePx, origin);
      if (cell.selected || (scene?.selection?.cells || []).some((selected) => cellKey(selected) === cellKey(cell.cell))) {
        ctx.strokeStyle = "#68c8d8";
        ctx.lineWidth = Math.max(1.5, tilePx * 0.09);
        ctx.strokeRect(position.x + 1, position.y + 1, Math.max(0, tilePx - 2), Math.max(0, tilePx - 2));
      }
      if (cell.cursor) {
        ctx.strokeStyle = "#f0d989";
        ctx.lineWidth = Math.max(1.5, tilePx * 0.08);
        ctx.strokeRect(position.x + 3, position.y + 3, Math.max(0, tilePx - 6), Math.max(0, tilePx - 6));
      }
    }

    return {
      cellsDrawn: cells.length,
      entitiesDrawn,
      entityCellsDrawn,
      spritesDrawn,
      spriteFallbacks
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
      spriteFallbacks: 0
    };

    function snapshot() {
      return {
        ...diagnostics,
        averageMs: diagnostics.frameCount ? diagnostics.totalMs / diagnostics.frameCount : 0,
        pending: Boolean(frameId),
        presentation: {
          tilePx: Math.max(4, cleanNumber(presentation.tilePx, 14)),
          origin: presentationOrigin(presentation),
          includeOverscan: Boolean(presentation.includeOverscan)
        },
        assets: options.assetLoader?.snapshot?.() || null
      };
    }

    function draw() {
      frameId = 0;
      if (destroyed || !scene) return;
      const startedAt = performance.now();
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
      context.fillStyle = "#090a08";
      context.fillRect(0, 0, cssWidth, cssHeight);
      const counts = renderScene(context, scene, {
        ...presentation,
        tilePx,
        assetLoader: options.assetLoader
      });
      const elapsedMs = performance.now() - startedAt;
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
      canvas.dataset.canvasFrameCount = String(diagnostics.frameCount);
      canvas.dataset.canvasCellsDrawn = String(counts.cellsDrawn);
      canvas.dataset.canvasEntitiesDrawn = String(counts.entitiesDrawn);
      canvas.dataset.canvasSpritesDrawn = String(counts.spritesDrawn);
      options.onFrame?.(snapshot());
    }

    function invalidate() {
      if (destroyed || frameId) return;
      frameId = window.requestAnimationFrame(draw);
    }

    function setScene(nextScene, nextPresentation = {}) {
      scene = nextScene;
      presentation = { ...presentation, ...nextPresentation };
      invalidate();
    }

    function setPresentation(nextPresentation = {}) {
      presentation = { ...presentation, ...nextPresentation };
      invalidate();
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
        invalidate();
      });
      resizeObserver.observe(canvas);
    }

    return { setScene, setPresentation, clientPointToCell, pointForCell, invalidate, destroy, snapshot };
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
    renderScene,
    createRenderer
  };
}));
