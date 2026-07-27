(function attachHelixMapRenderOrder(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixMapRenderOrder = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixMapRenderOrder() {
  "use strict";

  const POLICY_VERSION = 1;
  const RENDER_PASSES = Object.freeze({
    background: 0,
    terrain: 10,
    ground: 20,
    path: 30,
    item: 40,
    remains: 45,
    fixture: 50,
    actor: 60,
    overhead: 70,
    effect: 80,
    fog: 90,
    alert: 100,
    selection: 110,
    cursor: 120
  });
  const PASS_NAMES = Object.freeze(Object.fromEntries(
    Object.entries(RENDER_PASSES).map(([name, value]) => [value, name])
  ));
  const OVERHEAD_LAYERS = new Set(["overhead", "utilityAir"]);
  const GROUND_LAYERS = new Set([
    "ground",
    "fluid",
    "underfloor",
    "utilityDrain",
    "utilityElectric",
    "utilityMana"
  ]);

  function cleanNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cellKey(cell) {
    if (!cell || !Number.isFinite(Number(cell.x)) || !Number.isFinite(Number(cell.y))) return "";
    return `${Math.round(Number(cell.x))},${Math.round(Number(cell.y))},${Math.round(cleanNumber(cell.z))}`;
  }

  function targetKey(target) {
    if (!target?.kind) return "";
    if (target.kind === "tile") return `tile:${cellKey(target.tile || target.cell)}`;
    if (target.kind === "room") return `room:${target.roomId || target.id || ""}`;
    if (target.kind === "door") return `door:${target.key || target.id || ""}`;
    if (target.kind === "stockpile") {
      return `stockpile:${target.roomId || ""}:${target.focusId || ""}`;
    }
    return `${target.kind}:${target.id || target.key || ""}`;
  }

  function entityPass(entity) {
    const layer = String(entity?.visual?.layer || "");
    if (OVERHEAD_LAYERS.has(layer)) return RENDER_PASSES.overhead;
    if (GROUND_LAYERS.has(layer)) return RENDER_PASSES.ground;
    if (entity?.category === "hazard") return RENDER_PASSES.ground;
    if (entity?.category === "item" || entity?.kind === "itemStack") return RENDER_PASSES.item;
    if (entity?.category === "remains" || entity?.kind === "corpse") return RENDER_PASSES.remains;
    if (entity?.category === "actor" || ["scientist", "slime"].includes(entity?.kind)) {
      return RENDER_PASSES.actor;
    }
    return RENDER_PASSES.fixture;
  }

  function effectPass(effect) {
    const plane = String(effect?.plane || "world");
    if (plane === "ground") return RENDER_PASSES.ground;
    if (plane === "alert") return RENDER_PASSES.alert;
    return RENDER_PASSES.effect;
  }

  function entityRenderKey(entity) {
    const bounds = entity?.bounds || {};
    return [
      entityPass(entity),
      cleanNumber(bounds.y) + Math.max(1, cleanNumber(bounds.height, 1)),
      cleanNumber(bounds.x),
      cleanNumber(bounds.z),
      String(entity?.id || "")
    ];
  }

  function compareRenderKeys(left, right) {
    const count = Math.max(left?.length || 0, right?.length || 0);
    for (let index = 0; index < count; index += 1) {
      const a = left?.[index];
      const b = right?.[index];
      if (a === b) continue;
      if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b));
      return cleanNumber(a) - cleanNumber(b);
    }
    return 0;
  }

  function compareEntities(left, right) {
    return compareRenderKeys(entityRenderKey(left), entityRenderKey(right));
  }

  function orderedEntities(entities) {
    return [...(entities || [])].sort(compareEntities);
  }

  function effectRenderKey(effect) {
    const cells = effect?.cells || [];
    const xs = cells.map((cell) => cleanNumber(cell.x));
    const ys = cells.map((cell) => cleanNumber(cell.y));
    const zs = cells.map((cell) => cleanNumber(cell.z));
    return [
      effectPass(effect),
      ys.length ? Math.max(...ys) + 1 : 0,
      xs.length ? Math.min(...xs) : 0,
      zs.length ? Math.min(...zs) : 0,
      String(effect?.id || "")
    ];
  }

  function fallbackTargetPass(target) {
    if (["incident", "task", "stockpile"].includes(target?.kind)) return RENDER_PASSES.alert;
    if (target?.kind === "collectionStation") return RENDER_PASSES.fixture - 1;
    if (["container", "fixture", "door"].includes(target?.kind)) return RENDER_PASSES.fixture;
    if (target?.kind === "itemStack") return RENDER_PASSES.item;
    if (["room", "tile"].includes(target?.kind)) return RENDER_PASSES.terrain;
    return RENDER_PASSES.terrain + 5;
  }

  function targetRenderDescriptor(scene, target, sourceIndex = 0) {
    const key = targetKey(target);
    const entity = (scene?.entities || []).find((candidate) => targetKey(candidate.target) === key);
    if (entity) {
      return { target, key, visible: true, renderKey: entityRenderKey(entity), sourceIndex };
    }
    const effect = (scene?.effects || []).find((candidate) => targetKey(candidate.target) === key);
    if (effect) {
      return { target, key, visible: true, renderKey: effectRenderKey(effect), sourceIndex };
    }
    return {
      target,
      key,
      visible: false,
      renderKey: [fallbackTargetPass(target), 0, 0, 0, ""],
      sourceIndex
    };
  }

  function orderInteractionTargets(scene, candidates) {
    const seen = new Set();
    return (candidates || [])
      .map((target, sourceIndex) => targetRenderDescriptor(scene, target, sourceIndex))
      .filter((entry) => {
        if (!entry.key || seen.has(entry.key)) return false;
        seen.add(entry.key);
        return true;
      })
      .sort((left, right) => {
        const byDrawOrder = compareRenderKeys(right.renderKey, left.renderKey);
        if (byDrawOrder) return byDrawOrder;
        if (left.visible !== right.visible) return left.visible ? -1 : 1;
        return left.sourceIndex - right.sourceIndex;
      })
      .map((entry) => entry.target);
  }

  function orderSceneInteractions(scene) {
    if (!scene || !Array.isArray(scene.interactionIndex)) return scene;
    const byCell = new Map();
    scene.interactionIndex = scene.interactionIndex.map((entry) => {
      const targets = orderInteractionTargets(scene, [
        entry.primaryTarget,
        ...(entry.targets || [])
      ]);
      const ordered = { ...entry, primaryTarget: targets[0] || null, targets };
      byCell.set(entry.key, ordered);
      return ordered;
    });
    for (const cell of scene.cells || []) {
      const ordered = byCell.get(cell.key);
      if (!ordered || !cell.interaction) continue;
      cell.interaction = {
        ...cell.interaction,
        primaryTarget: ordered.primaryTarget,
        targets: ordered.targets
      };
    }
    return scene;
  }

  function targetsAtCell(scene, cell) {
    const key = cellKey(cell);
    return scene?.interactionIndex?.find((entry) => entry.key === key)?.targets || [];
  }

  function cellsOnLayer(entity, z) {
    return (entity?.footprintCells || []).filter((cell) => cleanNumber(cell.z) === cleanNumber(z));
  }

  function entityLayerMode(entity, z) {
    if (!cellsOnLayer(entity, z).length) return "hidden";
    return cleanNumber(entity?.anchorCell?.z) === cleanNumber(z) ? "anchor" : "slice";
  }

  function cellSetsOverlap(leftCells, rightCells) {
    const keys = new Set((leftCells || []).map(cellKey).filter(Boolean));
    return (rightCells || []).some((cell) => keys.has(cellKey(cell)));
  }

  function selectedOccluderIds(scene) {
    const selected = (scene?.entities || []).find((entity) => entity.selected);
    if (!selected) return new Set();
    const z = scene?.viewport?.z;
    const selectedCells = cellsOnLayer(selected, z);
    if (!selectedCells.length) return new Set();
    const ordered = orderedEntities(
      (scene.entities || []).filter((entity) => cellsOnLayer(entity, z).length)
    );
    const selectedIndex = ordered.findIndex((entity) => entity.id === selected.id);
    if (selectedIndex < 0) return new Set();
    return new Set(ordered
      .slice(selectedIndex + 1)
      .filter((entity) => cellSetsOverlap(selectedCells, cellsOnLayer(entity, z)))
      .map((entity) => entity.id));
  }

  function cutawayEntityIds(scene) {
    const z = scene?.viewport?.z;
    const focusCells = [
      ...(scene?.selection?.cells || []).filter((cell) => cleanNumber(cell.z) === cleanNumber(z)),
      ...(scene?.cells || []).filter((cell) => cell.cursor).map((cell) => cell.cell)
    ];
    if (!focusCells.length) return new Set();
    return new Set((scene?.entities || [])
      .filter((entity) => entityPass(entity) === RENDER_PASSES.overhead)
      .filter((entity) => !entity.selected)
      .filter((entity) => cellSetsOverlap(focusCells, cellsOnLayer(entity, z)))
      .map((entity) => entity.id));
  }

  function passName(pass) {
    return PASS_NAMES[pass] || `pass-${pass}`;
  }

  return {
    POLICY_VERSION,
    RENDER_PASSES,
    PASS_NAMES,
    targetKey,
    entityPass,
    effectPass,
    entityRenderKey,
    effectRenderKey,
    compareRenderKeys,
    compareEntities,
    orderedEntities,
    orderInteractionTargets,
    orderSceneInteractions,
    targetsAtCell,
    cellsOnLayer,
    entityLayerMode,
    selectedOccluderIds,
    cutawayEntityIds,
    passName
  };
}));
