(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixHomeInstitutionContext = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ROLES = Object.freeze({
    "commercial-registry": "centralAdministration",
    "environmental-health": "publicWorksAndProvisioning",
    "law-enforcement": "civilWatch",
    "civic-review": "civicReview"
  });
  const HOURS = { fragile: 24, strained: 12, functional: 6, strong: 3, exceptional: 2 };
  const THEORY_OFFENSE = Object.freeze({
    "reporting-noncompliance": "corporateLicensing",
    "improper-biological-disposal": "hazardousBiologicalConduct",
    "off-books-commerce": "contrabandCommerce"
  });
  const copy = value => JSON.parse(JSON.stringify(value));

  // Run-owned allocations of existing institutional throughput, not new officials.
  // Different responsibilities held by one office share the same queue.
  function create(profile, institutions, clock = 0) {
    const roles = {}, offices = {};
    for (const [key, role] of Object.entries(ROLES)) {
      const source = institutions.find(row => row.role === role);
      if (!source?.id) continue;
      roles[key] = source.id;
      if (offices[source.id]) continue;
      offices[source.id] = {
        id: source.id,
        available: !["displaced", "disrupted", "suspended"].includes(source.status),
        workSeconds: (HOURS[source.capacityBand] || 24) * 3600
          * (1 + Math.max(0, Math.min(8, Number(source.workload) || 0)) / 4),
        reservedUntil: clock, jobs: {}
      };
    }
    return {
      cityId: String(profile.cityId),
      publicContext: {
        cityName: String(profile.cityName || profile.cityId),
        resources: [...new Set((profile.productionSources || []).map(row => row.family).filter(Boolean))].sort(),
        laws: (profile.lawRules || []).map(row => ({ label: row.label || row.offenseId, status: row.legalStatus })),
        faiths: (profile.faiths || []).map(row => ({ name: row.name, prohibitions: [...row.prohibitions] }))
      },
      roles, offices
    };
  }

  function fromWorld(profile, map, clock = 0) {
    const government = map?.cityGovernments?.governments.find(row => row.cityId === profile.cityId);
    if (!government) return null;
    const institutions = Object.values(ROLES).flatMap(role => {
      const baseline = government.institutions.find(row => row.id === government.roleAssignments[role]);
      if (!baseline) return [];
      const current = map.strategicCivicHistory?.currentInstitutionRows.find(row => row.institutionId === baseline.id);
      const pipelines = (map.strategicEnforcementPracticeHistory?.pipelineRows || []).filter(row => row.responsibleInstitutionId === baseline.id);
      return [{ role, id: baseline.id,
        status: pipelines.some(row => row.operationalState === "suspended") ? "suspended" : current?.operationalStatus || "operational",
        capacityBand: current?.currentCapacityBand || baseline.capacityBand,
        workload: Math.max(0, ...pipelines.map(row => row.exactWorkloadIndex || 0)) }];
    });
    const state = create(profile, institutions, clock);
    state.priorities = Object.fromEntries((map.strategicEnforcementPracticeHistory?.practiceRows || [])
      .filter(row => row.cityId === profile.cityId).map(row => [row.offenseId, row.actualPriority]));
    return state;
  }

  function reserve(state, institutionId, jobId, clock, priority = 1) {
    if (!state) return clock; // Unbound scenarios retain their original behavior.
    const office = state.offices[state.roles[institutionId]];
    if (!office?.available) return null;
    let job = office.jobs[jobId];
    if (!job) {
      const start = Math.max(clock, office.reservedUntil);
      job = office.jobs[jobId] = {
        queuedAt: clock, readyAt: start + office.workSeconds / Math.max(0.5, Math.min(2, priority))
      };
      office.reservedUntil = job.readyAt;
    }
    // Repeated updates and reloads cannot duplicate or accelerate an allocation.
    return job.readyAt;
  }

  function permit(state, institutionId, jobId, clock, priority = 1) {
    const readyAt = reserve(state, institutionId, jobId, clock, priority);
    return readyAt != null && clock >= readyAt;
  }

  // Only newly seeded visits, before their physical journeys have been booked.
  // Already issued notices, deadlines, and journeys are never rewritten on load.
  function initialInspections(state, visits, clock) {
    if (!state || state.initialInspectionsScheduled) return visits;
    state.initialInspectionsScheduled = true;
    return visits.filter(visit => {
      if (!["registryAuditor", "environmentalInspector"].includes(visit.typeId)) return true;
      const institution = visit.typeId === "registryAuditor" ? "commercial-registry" : "environmental-health";
      const readyAt = reserve(state, institution, `initial-inspection:${visit.id}`, clock);
      if (readyAt == null) return false;
      const delay = Math.max(0, readyAt - clock);
      visit.arrivalAt += delay;
      visit.arrivalWindow.start += delay;
      visit.arrivalWindow.end += delay;
      return true;
    });
  }

  function priority(state, theoryId) {
    if (!state) return 1;
    const resources = state.publicContext.resources;
    // Relevant processing is familiar locally, but discharge review is also a
    // practiced responsibility. This changes service time, never case strength.
    const practice = { low: 0.75, standard: 1, elevated: 1.25, critical: 1.5 }[state.priorities?.[THEORY_OFFENSE[theoryId]]] || 1;
    return theoryId === "site-discharge" && resources.includes("chemicalFeedstock") ? 2 : practice;
  }

  function publicView(state, company = {}) {
    if (!state) return null;
    const result = copy(state.publicContext);
    const familiar = result.resources.includes("chemicalFeedstock");
    const documented = (company.periods || []).some(row => row.status === "filed")
      && (company.records || []).some(row => row.lawful === true && ["production", "sale", "received"].includes(row.kind));
    result.plausibility = familiar
      ? "Chemical processing fits the published local resource economy."
      : "Chemical processing is unusual in the published local resource economy; this is not a violation.";
    result.documentation = documented
      ? "Filed periods and recorded lawful activity provide a business explanation; authorities must still receive and verify the relevant records."
      : "Consistent filings and lawful production, purchase, and sales records can explain the declared business.";
    return result;
  }

  return { ROLES, create, fromWorld, reserve, permit, initialInspections, priority, publicView };
}));
