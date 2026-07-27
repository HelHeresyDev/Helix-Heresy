(function attachHelixActorVisualState(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixActorVisualState = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixActorVisualState() {
  "use strict";

  const FACING_DIRECTIONS = Object.freeze(["north", "east", "south", "west", "none"]);
  const POSES = Object.freeze([
    "idle",
    "moving",
    "working",
    "feeding",
    "attacking",
    "guarded",
    "fleeing",
    "quiescent",
    "strained",
    "recovering",
    "prone"
  ]);
  const ACTIVITY_FAMILIES = Object.freeze([
    "idle",
    "movement",
    "work",
    "feeding",
    "combat",
    "containment",
    "recovery",
    "terminal"
  ]);
  const CONDITION_CUES = Object.freeze(["injured", "critical", "compressed", "stressed", "uncertain"]);
  const ATTACK_INTENTS = new Set(["attack", "fight", "feedattack", "lashout", "threaten"]);
  const FLEE_INTENTS = new Set(["flee", "panic"]);
  const GUARD_INTENTS = new Set(["defend", "freeze", "endure", "hide"]);

  function cleanCell(candidate) {
    if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) {
      return null;
    }
    return {
      x: Math.round(Number(candidate.x)),
      y: Math.round(Number(candidate.y)),
      z: Number.isFinite(Number(candidate.z)) ? Math.round(Number(candidate.z)) : 0
    };
  }

  function cleanFacing(candidate, fallback = "none") {
    const requested = String(candidate || "").toLowerCase();
    return FACING_DIRECTIONS.includes(requested)
      ? requested
      : FACING_DIRECTIONS.includes(fallback) ? fallback : "none";
  }

  function cleanPose(candidate, fallback = "idle") {
    const requested = String(candidate || "").toLowerCase();
    return POSES.includes(requested)
      ? requested
      : POSES.includes(fallback) ? fallback : "idle";
  }

  function directionBetween(fromCandidate, toCandidate, previousFacing = "none") {
    const from = cleanCell(fromCandidate);
    const to = cleanCell(toCandidate);
    const previous = cleanFacing(previousFacing);
    if (!from || !to) return previous;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (!dx && !dy) return previous;
    if (Math.abs(dx) === Math.abs(dy)) {
      if (dx && ["east", "west"].includes(previous)) return dx > 0 ? "east" : "west";
      if (dy && ["north", "south"].includes(previous)) return dy > 0 ? "south" : "north";
    }
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "east" : "west";
    return dy > 0 ? "south" : "north";
  }

  function cleanIntent(candidate) {
    return String(candidate || "").replace(/[^a-z]/gi, "").toLowerCase();
  }

  function activityFamily(candidate = {}, options = {}) {
    const id = String(candidate?.id || candidate?.type || "").trim();
    const label = String(candidate?.label || "").trim();
    const readableId = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ");
    const value = `${readableId} ${label}`.toLowerCase();
    const intent = cleanIntent(candidate?.combatIntent || candidate?.intent || options.combatIntent);
    if (options.dead || /\b(dead|death|terminal)\b/.test(value)) return "terminal";
    if (ATTACK_INTENTS.has(intent) || FLEE_INTENTS.has(intent) || GUARD_INTENTS.has(intent)
      || /\b(combat|attack|attacking|threat response|lashing out|defending|freezing|panicking)\b/.test(value)) {
      return "combat";
    }
    if (options.containment?.active
      || /\b(containment|pressing closed door|straining|seeping|corroding|shocking fittings|gripping seams|fouling the interior)\b/.test(value)) {
      return "containment";
    }
    if (/\b(feed|feeding|ingestion|consume|consuming|hunting sensed prey)\b/.test(value)) return "feeding";
    if (/\b(work|working|haul|hauling|harvest|necropsy|cleanup|cleaning|production|construct|repair|maintenance|collect|recapture|bait|synthesi[sz]|test|diagnostic|trade|transfer|operation|interaction|excavat|deconstruct|smooth)\w*\b/.test(value)) {
      return "work";
    }
    if (/\b(recover|recovering|recovery|rest|resting|convalesc|emerging)\b/.test(value)) return "recovery";
    if (options.motionActive
      || /\b(move|moving|wander|wandering|explor|seeking|fleeing|travel|in transit)\b/.test(value)) {
      return "movement";
    }
    if (/\b(quiescent|idle|waiting|contained|stationary|blocked)\b/.test(value)) return "idle";
    return ACTIVITY_FAMILIES.includes(candidate?.family) ? candidate.family : "idle";
  }

  function normalizeActivity(candidate = {}, options = {}) {
    const id = String(candidate?.id || candidate?.type || options.fallbackId || "idle").trim() || "idle";
    const label = String(candidate?.label || options.fallbackLabel || id).trim() || id;
    const activity = {
      id,
      family: activityFamily({ ...candidate, id, label }, options),
      label,
      source: String(candidate?.source || options.source || "simulation")
    };
    if (candidate?.target && typeof candidate.target === "object") {
      activity.target = { ...candidate.target };
    }
    const combatIntent = String(candidate?.combatIntent || candidate?.intent || options.combatIntent || "").trim();
    if (combatIntent) activity.combatIntent = combatIntent;
    return activity;
  }

  function motionIsActive(candidate) {
    if (!candidate) return false;
    const state = String(candidate.state || candidate.status || "").toLowerCase();
    if (["moving", "active", "reserved", "traversing"].includes(state)) return true;
    return Boolean(candidate.nextCell || candidate.destination || candidate.targetCell);
  }

  function poseFor(candidate = {}) {
    const activity = normalizeActivity(candidate.activity, {
      combatIntent: candidate.combatIntent,
      containment: candidate.containment,
      dead: candidate.dead,
      motionActive: motionIsActive(candidate.motion)
    });
    const intent = cleanIntent(activity.combatIntent || candidate.combatIntent || candidate.motion?.intent);
    const conditionBand = String(candidate.condition?.band || "").toLowerCase();
    if (candidate.dead || conditionBand === "dead" || activity.family === "terminal") return "prone";
    if (ATTACK_INTENTS.has(intent)) return "attacking";
    if (FLEE_INTENTS.has(intent)) return "fleeing";
    if (GUARD_INTENTS.has(intent)) return "guarded";
    if (activity.family === "combat") return "attacking";
    if (candidate.containment?.active || activity.family === "containment") return "strained";
    if (activity.family === "feeding") return "feeding";
    if (activity.family === "work") return "working";
    if (motionIsActive(candidate.motion)) {
      return FLEE_INTENTS.has(cleanIntent(candidate.motion?.intent)) ? "fleeing" : "moving";
    }
    if (activity.family === "movement") return "moving";
    if (activity.family === "recovery") return "recovering";
    if (/\bquiescent\b/i.test(`${activity.id} ${activity.label}`)) return "quiescent";
    return "idle";
  }

  function conditionCues(candidate = {}) {
    const cues = new Set();
    const condition = candidate.condition || {};
    const band = String(condition.band || "").toLowerCase();
    const ratio = Number(condition.ratio);
    if (band === "critical" || band === "failing" || (Number.isFinite(ratio) && ratio <= 0.25)) {
      cues.add("critical");
    } else if (["injured", "damaged", "strained", "wounded"].includes(band)
      || (Number.isFinite(ratio) && ratio <= 0.5)) {
      cues.add("injured");
    }
    const containment = candidate.containment || {};
    const containmentMethod = String(containment.method || "").toLowerCase();
    if (condition.compressed || containment.compressed
      || (containment.active && ["press", "seep", "climb"].includes(containmentMethod))) {
      cues.add("compressed");
    }
    const stress = Number(condition.stress);
    const stressBand = String(condition.stressBand || "").toLowerCase();
    if ((Number.isFinite(stress) && stress >= 70)
      || ["high", "critical", "panicked", "desperate"].includes(stressBand)) {
      cues.add("stressed");
    }
    if (candidate.knowledge?.state === "uncertain") cues.add("uncertain");
    return CONDITION_CUES.filter((cue) => cues.has(cue));
  }

  function deriveFacing(candidate = {}) {
    const anchor = cleanCell(candidate.anchorCell);
    const previous = cleanFacing(candidate.previousFacing, candidate.defaultFacing || "none");
    const activity = normalizeActivity(candidate.activity, {
      combatIntent: candidate.combatIntent,
      containment: candidate.containment,
      motionActive: motionIsActive(candidate.motion)
    });
    const combatActive = activity.family === "combat" || cleanIntent(activity.combatIntent || candidate.combatIntent);
    if (combatActive && candidate.combatTargetCell) {
      return directionBetween(anchor, candidate.combatTargetCell, previous);
    }
    const movementCell = candidate.movementTargetCell
      || candidate.motion?.nextCell
      || candidate.motion?.destination
      || candidate.motion?.targetCell;
    if (movementCell) return directionBetween(anchor, movementCell, previous);
    if (candidate.activityTargetCell) return directionBetween(anchor, candidate.activityTargetCell, previous);
    return previous;
  }

  function deriveActorVisualState(candidate = {}) {
    const motionActive = motionIsActive(candidate.motion);
    const activity = normalizeActivity(candidate.activity, {
      combatIntent: candidate.combatIntent,
      containment: candidate.containment,
      dead: candidate.dead,
      motionActive
    });
    const pose = poseFor({ ...candidate, activity });
    const facing = deriveFacing({ ...candidate, activity });
    const cues = conditionCues(candidate);
    return {
      facing,
      pose,
      activity,
      conditionCues: cues
    };
  }

  function spriteKeyCandidates(baseKey, candidate = {}) {
    const base = String(baseKey || "").trim();
    if (!base) return [];
    const pose = cleanPose(candidate.pose);
    const facing = cleanFacing(candidate.facing);
    const keys = [];
    if (facing !== "none") keys.push(`${base}.pose.${pose}.facing.${facing}`);
    keys.push(`${base}.pose.${pose}`);
    if (facing !== "none") keys.push(`${base}.facing.${facing}`);
    keys.push(base);
    return [...new Set(keys)];
  }

  return {
    FACING_DIRECTIONS,
    POSES,
    ACTIVITY_FAMILIES,
    CONDITION_CUES,
    cleanCell,
    cleanFacing,
    cleanPose,
    directionBetween,
    activityFamily,
    normalizeActivity,
    motionIsActive,
    poseFor,
    conditionCues,
    deriveFacing,
    deriveActorVisualState,
    spriteKeyCandidates
  };
}));
