(function attachHelixAnimationClock(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixAnimationClock = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixAnimationClock() {
  "use strict";

  const MIN_INTERPOLATION_MS = 80;
  const MOTION_STATES = Object.freeze(["moving", "waiting", "rotating", "stationary"]);
  const ACTION_PHASES = Object.freeze(["charge", "active", "recovery", "complete", "cancelled"]);

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, finiteNumber(value)));
  }

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

  function normalizeTimeline(candidate = {}) {
    const paused = Boolean(candidate.paused);
    return {
      revision: Math.max(0, Math.floor(finiteNumber(candidate.revision))),
      mode: String(candidate.mode || (paused ? "paused" : "running")),
      paused,
      speed: Math.max(0, finiteNumber(candidate.speed, 1))
    };
  }

  function normalizeMotion(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const fromCell = cleanCell(candidate.fromCell);
    const toCell = cleanCell(candidate.toCell);
    if (!fromCell || !toCell) return null;
    const segmentStartedAt = finiteNumber(candidate.segmentStartedAt);
    const segmentArriveAt = Math.max(
      segmentStartedAt + 0.001,
      finiteNumber(candidate.segmentArriveAt, segmentStartedAt + 0.001)
    );
    const requestedState = String(candidate.state || "moving").toLowerCase();
    return {
      id: String(candidate.id || `${fromCell.x},${fromCell.y},${fromCell.z}:${toCell.x},${toCell.y},${toCell.z}:${segmentStartedAt}`),
      state: MOTION_STATES.includes(requestedState) ? requestedState : "stationary",
      intent: String(candidate.intent || "move"),
      fromCell,
      toCell,
      fromOrientation: String(candidate.fromOrientation || ""),
      toOrientation: String(candidate.toOrientation || ""),
      segmentStartedAt,
      segmentArriveAt,
      revision: String(candidate.revision ?? "")
    };
  }

  function normalizeAction(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const startedAt = finiteNumber(candidate.startedAt);
    const activeAt = Math.max(startedAt, finiteNumber(candidate.activeAt, startedAt));
    const endsAt = Math.max(activeAt, finiteNumber(candidate.endsAt, activeAt));
    const requestedPhase = String(candidate.phase || "charge").toLowerCase();
    return {
      id: String(candidate.id || `${candidate.kind || "action"}:${startedAt}`),
      kind: String(candidate.kind || "action"),
      phase: ACTION_PHASES.includes(requestedPhase) ? requestedPhase : "charge",
      startedAt,
      activeAt,
      endsAt,
      revision: String(candidate.revision ?? "")
    };
  }

  function createClock(options = {}) {
    const now = typeof options.now === "function"
      ? options.now
      : () => typeof performance === "object" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    let anchorRealMs = finiteNumber(options.realTimeMs, now());
    let anchorGameTime = finiteNumber(options.gameTime);
    let timeline = normalizeTimeline(options.timeline);

    function setSnapshot(snapshot = {}, realTimeMs = now()) {
      anchorRealMs = finiteNumber(realTimeMs, now());
      anchorGameTime = finiteNumber(snapshot.gameTime, anchorGameTime);
      timeline = normalizeTimeline(snapshot.timeline || snapshot);
      return sample(anchorRealMs);
    }

    function sample(realTimeMs = now()) {
      const currentRealMs = finiteNumber(realTimeMs, anchorRealMs);
      const elapsedRealSeconds = Math.max(0, currentRealMs - anchorRealMs) / 1000;
      return {
        gameTime: timeline.paused
          ? anchorGameTime
          : anchorGameTime + elapsedRealSeconds * timeline.speed,
        realTimeMs: currentRealMs,
        elapsedRealSeconds,
        ...timeline
      };
    }

    function snapshot() {
      return {
        anchorRealMs,
        anchorGameTime,
        timeline: { ...timeline }
      };
    }

    return { setSnapshot, sample, snapshot };
  }

  function motionDisplayDurationMs(motion, speed = 1) {
    const clean = normalizeMotion(motion);
    if (!clean) return 0;
    const duration = clean.segmentArriveAt - clean.segmentStartedAt;
    return speed > 0 ? duration / speed * 1000 : Number.POSITIVE_INFINITY;
  }

  function sampleMotion(candidate, presentationTime, options = {}) {
    const motion = normalizeMotion(candidate);
    if (!motion) {
      return {
        valid: false,
        interpolated: false,
        active: false,
        progress: 0,
        offset: { x: 0, y: 0 },
        opacity: 1
      };
    }
    const speed = Math.max(0, finiteNumber(options.speed, 1));
    const currentTime = finiteNumber(presentationTime, motion.segmentStartedAt);
    const duration = Math.max(0.001, motion.segmentArriveAt - motion.segmentStartedAt);
    const progress = clamp((currentTime - motion.segmentStartedAt) / duration);
    const currentKnowledge = ["current", "debug"].includes(String(options.knowledgeState || "current"));
    const displayDurationMs = motionDisplayDurationMs(motion, speed);
    const vertical = motion.fromCell.z !== motion.toCell.z;
    const canAnimate = currentKnowledge
      && motion.state === "moving"
      && !options.reducedMotion
      && !options.discontinuity
      && speed > 0
      && displayDurationMs >= Math.max(0, finiteNumber(options.minInterpolationMs, MIN_INTERPOLATION_MS));
    const interpolated = canAnimate && !vertical;
    const active = canAnimate && !options.paused && currentTime < motion.segmentArriveAt;
    return {
      valid: true,
      interpolated,
      active,
      vertical,
      progress: canAnimate ? progress : 0,
      displayDurationMs,
      offset: interpolated ? {
        x: (motion.toCell.x - motion.fromCell.x) * progress,
        y: (motion.toCell.y - motion.fromCell.y) * progress
      } : { x: 0, y: 0 },
      opacity: vertical && canAnimate ? Math.max(0, 1 - progress) : 1,
      motion
    };
  }

  function sampleAction(candidate, presentationTime) {
    const action = normalizeAction(candidate);
    if (!action) return { valid: false, phase: "cancelled", progress: 1, active: false };
    const currentTime = finiteNumber(presentationTime, action.startedAt);
    if (action.phase === "cancelled") return { valid: true, action, phase: "cancelled", progress: 1, active: false };
    if (currentTime < action.activeAt) {
      const duration = Math.max(0.001, action.activeAt - action.startedAt);
      return {
        valid: true,
        action,
        phase: "charge",
        progress: clamp((currentTime - action.startedAt) / duration),
        active: true
      };
    }
    if (currentTime < action.endsAt) {
      const duration = Math.max(0.001, action.endsAt - action.activeAt);
      return {
        valid: true,
        action,
        phase: action.phase === "active" ? "active" : "recovery",
        progress: clamp((currentTime - action.activeAt) / duration),
        active: true
      };
    }
    return { valid: true, action, phase: "complete", progress: 1, active: false };
  }

  return {
    MIN_INTERPOLATION_MS,
    MOTION_STATES,
    ACTION_PHASES,
    cleanCell,
    normalizeTimeline,
    normalizeMotion,
    normalizeAction,
    createClock,
    motionDisplayDurationMs,
    sampleMotion,
    sampleAction
  };
}));
