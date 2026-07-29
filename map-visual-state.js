(function attachHelixMapVisualState(root, factory) {
  const actorVisualState = typeof module === "object" && module.exports
    ? require("./actor-visual-state.js")
    : root?.HelixActorVisualState;
  const animationClock = typeof module === "object" && module.exports
    ? require("./animation-clock.js")
    : root?.HelixAnimationClock;
  const api = factory(actorVisualState, animationClock);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixMapVisualState = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixMapVisualState(ActorVisualState, AnimationClock) {
  "use strict";

  if (!ActorVisualState) throw new Error("Map visual state requires actor visual-state derivation.");
  if (!AnimationClock) throw new Error("Map visual state requires the animation-clock contract.");
  const SCENE_VERSION = 7;
  const KNOWLEDGE_STATES = Object.freeze(["current", "stale", "uncertain", "unknown", "debug"]);
  const KNOWLEDGE_TIERS = Object.freeze(["current", "recent", "aged", "archived", "unknown"]);

  function cleanCell(candidate) {
    if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) return null;
    return {
      x: Math.round(Number(candidate.x)),
      y: Math.round(Number(candidate.y)),
      z: Number.isFinite(Number(candidate.z)) ? Math.round(Number(candidate.z)) : 0
    };
  }

  function cellKey(candidate) {
    const cell = cleanCell(candidate);
    return cell ? `${cell.x},${cell.y},${cell.z}` : "invalid";
  }

  function cleanTarget(candidate) {
    if (!candidate || typeof candidate !== "object" || !candidate.kind) return null;
    const target = { kind: String(candidate.kind) };
    if (candidate.id !== undefined && candidate.id !== null) target.id = String(candidate.id);
    if (candidate.key !== undefined && candidate.key !== null) target.key = String(candidate.key);
    if (candidate.roomId !== undefined && candidate.roomId !== null) target.roomId = String(candidate.roomId);
    if (candidate.focusId !== undefined && candidate.focusId !== null) target.focusId = String(candidate.focusId);
    const tile = cleanCell(candidate.tile);
    if (tile) target.tile = tile;
    return target;
  }

  function targetKey(candidate) {
    const target = cleanTarget(candidate);
    if (!target) return "";
    if (target.kind === "tile") return `tile:${cellKey(target.tile)}`;
    if (target.kind === "room") return `room:${target.roomId || ""}`;
    if (target.kind === "door") return `door:${target.key || target.id || ""}`;
    if (target.kind === "stockpile") {
      return `stockpile:${target.roomId || ""}:${target.focusId || ""}`;
    }
    return `${target.kind}:${target.id || target.key || ""}`;
  }

  function cleanKnowledge(candidate, fallback = "current") {
    const requested = String(candidate?.state || candidate || fallback);
    const state = KNOWLEDGE_STATES.includes(requested) ? requested : fallback;
    const result = {
      state,
      observedAt: Number.isFinite(Number(candidate?.observedAt)) ? Number(candidate.observedAt) : null,
      confidence: Number.isFinite(Number(candidate?.confidence))
        ? Math.max(0, Math.min(1, Number(candidate.confidence)))
        : state === "current" || state === "debug" ? 1 : state === "unknown" ? 0 : null
    };
    if (candidate?.source) result.source = String(candidate.source);
    const tier = String(candidate?.tier || "");
    if (KNOWLEDGE_TIERS.includes(tier)) result.tier = tier;
    return result;
  }

  function cleanOrientation(candidate) {
    const explicitTurns = candidate && typeof candidate === "object" && !Array.isArray(candidate);
    const raw = explicitTurns ? candidate : { quarterTurns: candidate };
    const requested = raw.quarterTurns;
    let quarterTurns = 0;
    if (Number.isFinite(Number(requested))) {
      const numeric = Number(requested);
      const turns = explicitTurns ? Math.round(numeric) : Math.round(numeric / 90);
      quarterTurns = ((turns % 4) + 4) % 4;
    } else {
      const named = String(requested || "").toLowerCase();
      quarterTurns = {
        vertical: 1,
        east: 1,
        south: 2,
        west: 3
      }[named] || 0;
    }
    return {
      quarterTurns,
      mirrored: Boolean(raw.mirrored)
    };
  }

  function uniqueCells(candidates) {
    const result = [];
    const seen = new Set();
    for (const candidate of candidates || []) {
      const cell = cleanCell(candidate);
      const key = cellKey(cell);
      if (!cell || seen.has(key)) continue;
      seen.add(key);
      result.push(cell);
    }
    return result;
  }

  function boundsForCells(cells, fallback = null) {
    const clean = uniqueCells(cells);
    if (!clean.length) return fallback;
    const xs = clean.map((cell) => cell.x);
    const ys = clean.map((cell) => cell.y);
    const zs = clean.map((cell) => cell.z);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      z: Math.min(...zs),
      width: Math.max(...xs) - Math.min(...xs) + 1,
      height: Math.max(...ys) - Math.min(...ys) + 1,
      depth: Math.max(...zs) - Math.min(...zs) + 1
    };
  }

  function cleanBounds(candidate, fallback = {}) {
    return {
      x: Math.round(Number(candidate?.x ?? fallback.x) || 0),
      y: Math.round(Number(candidate?.y ?? fallback.y) || 0),
      z: Math.round(Number(candidate?.z ?? fallback.z) || 0),
      width: Math.max(1, Math.round(Number(candidate?.width ?? fallback.width) || 1)),
      height: Math.max(1, Math.round(Number(candidate?.height ?? fallback.height) || 1))
    };
  }

  function overscanBounds(viewport, mapSize = {}, margin = 1) {
    const view = cleanBounds(viewport);
    const pad = Math.max(0, Math.floor(Number(margin) || 0));
    const mapWidth = Math.max(1, Math.floor(Number(mapSize.width) || view.x + view.width));
    const mapHeight = Math.max(1, Math.floor(Number(mapSize.height) || view.y + view.height));
    const x = Math.max(0, view.x - pad);
    const y = Math.max(0, view.y - pad);
    const right = Math.min(mapWidth, view.x + view.width + pad);
    const bottom = Math.min(mapHeight, view.y + view.height + pad);
    return { x, y, z: view.z, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  }

  function cellInBounds(cell, bounds) {
    const clean = cleanCell(cell);
    const area = cleanBounds(bounds);
    return Boolean(clean
      && clean.z === area.z
      && clean.x >= area.x && clean.x < area.x + area.width
      && clean.y >= area.y && clean.y < area.y + area.height);
  }

  function cellsWithinBounds(cells, bounds) {
    return (cells || []).filter((entry) => cellInBounds(entry.cell || entry, bounds));
  }

  function cleanEntity(candidate, index = 0) {
    const footprint = uniqueCells(candidate?.footprintCells || candidate?.footprint || [candidate?.anchorCell]);
    const anchor = cleanCell(candidate?.anchorCell) || footprint[0] || null;
    if (!anchor) return null;
    const target = cleanTarget(candidate?.target);
    const id = String(candidate?.id || targetKey(target) || `scene-entity-${index + 1}`);
    const knowledge = cleanKnowledge(candidate?.knowledge);
    const category = String(candidate?.category || "object");
    const kind = String(candidate?.kind || target?.kind || "object");
    const actor = category === "actor" || ["slime", "scientist", "creature"].includes(kind);
    const activity = actor && candidate?.activity
      ? ActorVisualState.normalizeActivity(candidate.activity)
      : candidate?.activity ? { ...candidate.activity } : null;
    const condition = candidate?.condition ? { ...candidate.condition } : null;
    if (condition && actor) {
      condition.cues = (candidate.condition?.cues || candidate.conditionCues || [])
        .map(String)
        .filter((cue) => ActorVisualState.CONDITION_CUES.includes(cue));
    }
    return {
      id,
      kind,
      category,
      subtype: String(candidate?.subtype || ""),
      target,
      anchorCell: anchor,
      footprintCells: footprint.length ? footprint : [anchor],
      bounds: boundsForCells(footprint.length ? footprint : [anchor]),
      orientation: cleanOrientation(candidate?.orientation),
      facing: actor ? ActorVisualState.cleanFacing(candidate?.facing) : null,
      pose: actor ? ActorVisualState.cleanPose(candidate?.pose) : String(candidate?.pose || "default"),
      activity,
      motion: AnimationClock.normalizeMotion(candidate?.motion),
      action: AnimationClock.normalizeAction(candidate?.action),
      condition,
      knowledge,
      visual: {
        key: String(candidate?.visual?.key || "object.unknown"),
        glyph: String(candidate?.visual?.glyph ?? "?"),
        recipeKey: String(candidate?.visual?.recipeKey || ""),
        variant: Number.isFinite(Number(candidate?.visual?.variant)) ? Number(candidate.visual.variant) : null,
        layer: String(candidate?.visual?.layer || ""),
        fallbackKeys: Array.isArray(candidate?.visual?.fallbackKeys)
          ? [...new Set(candidate.visual.fallbackKeys.map(String).filter(Boolean))]
          : []
      },
      blocking: Boolean(candidate?.blocking),
      tooltip: {
        parts: Array.isArray(candidate?.tooltip?.parts) ? candidate.tooltip.parts.map(String) : [],
        text: String(candidate?.tooltip?.text || "")
      },
      relatedTargets: (candidate?.relatedTargets || []).map(cleanTarget).filter(Boolean),
      selected: false
    };
  }

  function entityIntersectsBounds(entity, bounds) {
    return entity.footprintCells.some((cell) => cellInBounds(cell, bounds));
  }

  function uniqueTargets(candidates) {
    const targets = [];
    const seen = new Set();
    for (const candidate of candidates || []) {
      const target = cleanTarget(candidate);
      const key = targetKey(target);
      if (!target || !key || seen.has(key)) continue;
      seen.add(key);
      targets.push(target);
    }
    return targets;
  }

  function normalizeCellView(candidate) {
    const cell = cleanCell(candidate?.cell);
    if (!cell) return null;
    const primaryTarget = cleanTarget(candidate?.target);
    const interactionTargets = candidate?.interactionTargets || [];
    const objectTargets = candidate?.object?.targets || [];
    const overlayTarget = candidate?.overlay?.target;
    const targets = primaryTarget || interactionTargets.length || objectTargets.length || overlayTarget
      ? uniqueTargets([primaryTarget, ...interactionTargets, ...objectTargets, overlayTarget])
      : [];
    return {
      ...candidate,
      key: cellKey(cell),
      cell,
      knowledge: cleanKnowledge(candidate?.knowledge, candidate?.known === false ? "unknown" : "current"),
      entityIds: [],
      interaction: {
        primaryTarget,
        targets
      }
    };
  }

  function sceneCellAt(scene, candidate, options = {}) {
    const cell = cleanCell(candidate);
    if (!cell || !scene) return null;
    if (options.visibleOnly !== false && !cellInBounds(cell, scene.viewport)) return null;
    const key = cellKey(cell);
    return (scene.cells || []).find((entry) => entry.key === key) || null;
  }

  function interactionAtCell(scene, candidate, options = {}) {
    const cell = cleanCell(candidate);
    if (!cell || !scene || !sceneCellAt(scene, cell, options)) return null;
    const key = cellKey(cell);
    return (scene.interactionIndex || []).find((entry) => entry.key === key) || null;
  }

  function normalizeEffect(candidate, index = 0) {
    const cells = uniqueCells(candidate?.cells || [candidate?.cell]);
    if (!cells.length) return null;
    return {
      id: String(candidate?.id || `effect-${index + 1}`),
      kind: String(candidate?.kind || "effect"),
      cells,
      knowledge: cleanKnowledge(candidate?.knowledge),
      severity: String(candidate?.severity || ""),
      state: String(candidate?.state || ""),
      plane: ["ground", "world", "alert"].includes(candidate?.plane) ? candidate.plane : "world",
      visualKey: String(candidate?.visualKey || "effect.unknown"),
      target: cleanTarget(candidate?.target),
      label: String(candidate?.label || "")
    };
  }

  function normalizeOverlay(candidate, index = 0) {
    const cells = uniqueCells(candidate?.cells || [candidate?.cell]);
    if (!cells.length) return null;
    return {
      id: String(candidate?.id || `overlay-${index + 1}`),
      kind: String(candidate?.kind || "overlay"),
      cells,
      knowledge: cleanKnowledge(candidate?.knowledge),
      visualKey: String(candidate?.visualKey || "overlay.unknown"),
      value: candidate?.value ?? null,
      label: String(candidate?.label || ""),
      target: cleanTarget(candidate?.target)
    };
  }

  function buildScene(options = {}) {
    const viewport = cleanBounds(options.viewport);
    const queryBounds = cleanBounds(options.queryBounds, viewport);
    const selectedTarget = cleanTarget(options.selection?.target || options.selection);
    const selectedKey = targetKey(selectedTarget);
    const entities = (options.entities || [])
      .map(cleanEntity)
      .filter(Boolean)
      .filter((entity) => entityIntersectsBounds(entity, queryBounds));
    const seenEntityIds = new Set();
    const uniqueEntities = entities.filter((entity) => {
      if (seenEntityIds.has(entity.id)) return false;
      seenEntityIds.add(entity.id);
      entity.selected = Boolean(selectedKey && targetKey(entity.target) === selectedKey);
      return true;
    });
    const entityIdsByCell = new Map();
    for (const entity of uniqueEntities) {
      for (const cell of entity.footprintCells) {
        const key = cellKey(cell);
        if (!entityIdsByCell.has(key)) entityIdsByCell.set(key, []);
        entityIdsByCell.get(key).push(entity.id);
      }
    }
    const cells = [];
    const interactionIndex = [];
    for (const candidate of options.cells || []) {
      const cell = normalizeCellView(candidate);
      if (!cell) continue;
      cell.entityIds = [...(entityIdsByCell.get(cell.key) || [])];
      cells.push(cell);
      if (cell.interaction.primaryTarget || cell.interaction.targets.length) {
        interactionIndex.push({
          key: cell.key,
          cell: cell.cell,
          primaryTarget: cell.interaction.primaryTarget,
          targets: cell.interaction.targets
        });
      }
    }
    const effects = (options.effects || []).map(normalizeEffect).filter(Boolean)
      .filter((effect) => effect.cells.some((cell) => cellInBounds(cell, queryBounds)));
    const overlays = (options.overlays || []).map(normalizeOverlay).filter(Boolean)
      .filter((overlay) => overlay.cells.some((cell) => cellInBounds(cell, queryBounds)));
    const selectedEntity = uniqueEntities.find((entity) => entity.selected) || null;
    const selectedCells = selectedEntity
      ? selectedEntity.footprintCells
      : uniqueCells(options.selection?.cells || cells.filter((cell) => cell.selected).map((cell) => cell.cell));
    return {
      version: SCENE_VERSION,
      clock: Number.isFinite(Number(options.clock)) ? Number(options.clock) : 0,
      timeline: AnimationClock.normalizeTimeline(options.timeline),
      perspective: {
        kind: options.perspective?.kind === "debug" ? "debug" : "player",
        observerId: String(options.perspective?.observerId || "scientist")
      },
      viewport,
      queryBounds,
      mapSize: {
        width: Math.max(1, Math.floor(Number(options.mapSize?.width) || viewport.width)),
        height: Math.max(1, Math.floor(Number(options.mapSize?.height) || viewport.height)),
        tileSizeM: Math.max(0.01, Number(options.mapSize?.tileSizeM) || 1),
        layerHeightM: Math.max(0.01, Number(options.mapSize?.layerHeightM) || 1)
      },
      revisions: { ...(options.revisions || {}) },
      cells,
      entities: uniqueEntities,
      effects,
      overlays,
      selection: {
        target: selectedTarget,
        key: selectedKey,
        entityId: selectedEntity?.id || "",
        cells: selectedCells
      },
      interactionIndex
    };
  }

  function validateScene(scene) {
    const errors = [];
    if (!scene || scene.version !== SCENE_VERSION) errors.push(`Scene version must be ${SCENE_VERSION}.`);
    if (!Array.isArray(scene?.cells)) errors.push("Scene cells must be an array.");
    if (!Array.isArray(scene?.entities)) errors.push("Scene entities must be an array.");
    const ids = new Set();
    for (const entity of scene?.entities || []) {
      if (!entity.id) errors.push("Every scene entity requires an ID.");
      else if (ids.has(entity.id)) errors.push(`Duplicate scene entity ID: ${entity.id}.`);
      ids.add(entity.id);
      if (!entity.footprintCells?.length) errors.push(`Scene entity ${entity.id || "unknown"} has no footprint.`);
      if (!Number.isInteger(entity.orientation?.quarterTurns)
        || entity.orientation.quarterTurns < 0
        || entity.orientation.quarterTurns > 3
        || typeof entity.orientation?.mirrored !== "boolean") {
        errors.push(`Scene entity ${entity.id || "unknown"} has invalid orientation.`);
      }
      if (!KNOWLEDGE_STATES.includes(entity.knowledge?.state)) {
        errors.push(`Scene entity ${entity.id || "unknown"} has invalid knowledge.`);
      }
      if (entity.category === "actor" || ["slime", "scientist", "creature"].includes(entity.kind)) {
        if (!ActorVisualState.FACING_DIRECTIONS.includes(entity.facing)) {
          errors.push(`Scene actor ${entity.id || "unknown"} has invalid facing.`);
        }
        if (!ActorVisualState.POSES.includes(entity.pose)) {
          errors.push(`Scene actor ${entity.id || "unknown"} has invalid pose.`);
        }
        if (!ActorVisualState.ACTIVITY_FAMILIES.includes(entity.activity?.family || "idle")) {
          errors.push(`Scene actor ${entity.id || "unknown"} has invalid activity family.`);
        }
        if ((entity.condition?.cues || []).some((cue) => !ActorVisualState.CONDITION_CUES.includes(cue))) {
          errors.push(`Scene actor ${entity.id || "unknown"} has invalid condition cues.`);
        }
        if (entity.motion && !AnimationClock.normalizeMotion(entity.motion)) {
          errors.push(`Scene actor ${entity.id || "unknown"} has invalid motion.`);
        }
        if (entity.action && !AnimationClock.normalizeAction(entity.action)) {
          errors.push(`Scene actor ${entity.id || "unknown"} has invalid action.`);
        }
      }
    }
    for (const cell of scene?.cells || []) {
      if (!KNOWLEDGE_STATES.includes(cell.knowledge?.state)) {
        errors.push(`Scene cell ${cell.key || "unknown"} has invalid knowledge.`);
      }
      if (!cleanCell(cell.cell)) errors.push("Scene contains an invalid cell.");
      for (const entityId of cell.entityIds || []) {
        if (!ids.has(entityId)) errors.push(`Cell ${cell.key} references missing entity ${entityId}.`);
      }
    }
    return errors;
  }

  return {
    SCENE_VERSION,
    KNOWLEDGE_STATES,
    KNOWLEDGE_TIERS,
    cleanCell,
    cellKey,
    cleanTarget,
    targetKey,
    cleanKnowledge,
    cleanOrientation,
    uniqueCells,
    boundsForCells,
    overscanBounds,
    cellInBounds,
    cellsWithinBounds,
    cleanEntity,
    sceneCellAt,
    interactionAtCell,
    buildScene,
    validateScene
  };
}));
