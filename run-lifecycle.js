(function attachRunLifecycle(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixRunLifecycle = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createRunLifecycle() {
  "use strict";

  const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.slice(0, 2000) : fallback;
  const clock = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
  function latestDeath(state) { return state?.scientistDeath?.records?.at(-1) || null; }
  function phase(state) {
    if (state?.runEnded || latestDeath(state)?.terminal) return "ended";
    if (latestDeath(state)?.resurrection?.status === "pending" && Number(state?.scientist?.vitals?.health?.current) <= 0) return "resurrectionPending";
    return "active";
  }

  // Only copy player-visible text, never canonical truth, genomes, inventories,
  // or private investigations. Keep reports small and independent of live state.
  function normalizeReport(value) {
    if (!value || typeof value !== "object") return null;
    return {
      deathId: text(value.deathId), diedAt: clock(value.diedAt),
      cause: text(value.cause, "Cause not recorded"),
      summary: text(value.summary, "This scientist's run has ended."),
      location: text(value.location, "Location not recorded"),
      worldName: text(value.worldName, "Reusable world"),
      scenario: text(value.scenario, "Starting circumstances not recorded"),
      startingSite: text(value.startingSite, "Starting site not recorded"),
      company: text(value.company, "Unnamed laboratory"), runSeed: text(value.runSeed),
      events: (Array.isArray(value.events) ? value.events : []).slice(-12).map((entry) => ({
        time: clock(entry?.time), message: text(entry?.message)
      })).filter((entry) => entry.message)
    };
  }

  function captureReport(state, visible = {}) {
    if (phase(state) !== "ended") return null;
    if (state.postmortem) return normalizeReport(state.postmortem);
    const death = latestDeath(state);
    return normalizeReport({
      ...visible, deathId: death?.id, diedAt: death?.diedAt ?? state.clock,
      cause: death?.causeLabel || "Cause not recorded",
      summary: death?.summary || "This archived run ended before a detailed death record was available.",
      runSeed: state.seed, events: visible.events || []
    });
  }

  return { phase, normalizeReport, captureReport };
}));
