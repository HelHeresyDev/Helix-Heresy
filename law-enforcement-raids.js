(function attachHelixLawEnforcementRaids(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixLawEnforcementRaids = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixLawEnforcementRaids() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const STATUSES = Object.freeze(["scheduled", "entering", "searching", "contact", "arresting", "extracting", "booked", "escaped", "withdrawing", "completed"]);
  const ACTOR_STATUSES = Object.freeze(["scheduled", "active", "restraining", "escorting", "injured", "incapacitated", "withdrawn"]);
  const CUSTODY_STATUSES = Object.freeze(["free", "surrendered", "restraining", "restrained", "extracting", "booked", "released", "escaped"]);
  const TEAM_ROLES = Object.freeze([
    { role: "commander", label: "Raid Commander", equipment: ["radio", "protectiveVest", "restraints"] },
    { role: "breach", label: "Breach Officer", equipment: ["radio", "protectiveVest", "pryBar"] },
    { role: "arrest", label: "Arrest Officer", equipment: ["radio", "protectiveVest", "restraints"] },
    { role: "security", label: "Security Officer", equipment: ["radio", "protectiveVest", "lessLethalWeapon"] }
  ]);
  const GIVEN_NAMES = Object.freeze(["Mara", "Ivo", "Nia", "Dane", "Sera", "Oren", "Tamsin", "Cal", "Vera", "Jules", "Rook", "Anja"]);
  const SURNAMES = Object.freeze(["Vale", "Morrow", "Kade", "Dunn", "Rusk", "Sloane", "Voss", "Keene", "Ward", "Hale", "Pike", "Quill"]);

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function uniqueIds(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(cleanId).filter(Boolean))];
  }

  function cleanCell(candidate) {
    if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) return null;
    return { x: Math.round(Number(candidate.x)), y: Math.round(Number(candidate.y)), z: Math.round(Number(candidate.z) || 0) };
  }

  function hash(seed) {
    const text = String(seed || "law-enforcement-raid");
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    value += value << 13; value ^= value >>> 7;
    value += value << 3; value ^= value >>> 17; value += value << 5;
    return value >>> 0;
  }

  function unitRoll(seed) {
    return hash(seed) / 4294967296;
  }

  function normalizeEquipment(candidate) {
    return (Array.isArray(candidate) ? candidate : []).map((entry) => ({
      id: cleanId(typeof entry === "string" ? entry : entry?.id),
      label: String(typeof entry === "string" ? entry : entry?.label || "Enforcement equipment").trim()
    })).filter((entry) => entry.id);
  }

  function normalizeActor(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const roleDef = TEAM_ROLES.find((entry) => entry.role === source.role) || TEAM_ROLES[index] || TEAM_ROLES.at(-1);
    return {
      id: cleanId(source.id) || `raid-actor-${index + 1}`,
      name: String(source.name || roleDef.label).trim(), role: roleDef.role,
      status: ACTOR_STATUSES.includes(source.status) ? source.status : "scheduled",
      health: Math.max(0, Math.min(100, finite(source.health, 100))),
      mapCell: cleanCell(source.mapCell), roomId: cleanId(source.roomId), present: Boolean(source.present),
      movementAccumulator: Math.max(0, finite(source.movementAccumulator)),
      lastAttackAt: source.lastAttackAt == null ? null : Math.max(0, finite(source.lastAttackAt)),
      equipment: normalizeEquipment(source.equipment?.length ? source.equipment : roleDef.equipment),
      inventory: source.inventory && typeof source.inventory === "object" ? { ...source.inventory } : null,
      route: (Array.isArray(source.route) ? source.route : []).map(cleanCell).filter(Boolean),
      routeIndex: Math.max(0, Math.floor(finite(source.routeIndex))),
      targetKind: cleanId(source.targetKind), targetId: cleanId(source.targetId)
    };
  }

  function normalizeHistoryEntry(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return { at: Math.max(0, finite(source.at)), action: cleanId(source.action) || "updated", summary: String(source.summary || "Raid state updated.").trim() };
  }

  function normalizeRaid(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const authorizedAt = Math.max(0, finite(source.authorizedAt));
    const custodyStatus = CUSTODY_STATUSES.includes(source.custody?.status) ? source.custody.status : "free";
    return {
      id: cleanId(source.id) || `law-enforcement-raid-${index + 1}`,
      warrantExecutionId: cleanId(source.warrantExecutionId), actionId: cleanId(source.actionId), caseId: cleanId(source.caseId),
      docket: String(source.docket || "LE-0000").trim(), institutionId: cleanId(source.institutionId) || "law-enforcement",
      status: STATUSES.includes(source.status) ? source.status : "scheduled", authorizedAt,
      arrivalAt: Math.max(authorizedAt, finite(source.arrivalAt, authorizedAt)),
      arrivalWindowEnd: Math.max(authorizedAt, finite(source.arrivalWindowEnd, source.arrivalAt ?? authorizedAt)),
      entryPointId: cleanId(source.entryPointId) || "publicEntrance",
      objectives: (Array.isArray(source.objectives) ? source.objectives : []).map((entry, objectiveIndex) => ({
        id: cleanId(entry?.id) || `raid-objective-${objectiveIndex + 1}`,
        kind: cleanId(entry?.kind) || "arrestActor", targetKind: cleanId(entry?.targetKind), targetId: cleanId(entry?.targetId),
        label: String(entry?.label || "Raid objective").trim(), priority: entry?.priority === "secondary" ? "secondary" : "primary",
        status: ["pending", "active", "completed", "failed"].includes(entry?.status) ? entry.status : "pending"
      })),
      authorizedRoomIds: uniqueIds(source.authorizedRoomIds), knownRoomIds: uniqueIds(source.knownRoomIds), clearedRoomIds: uniqueIds(source.clearedRoomIds),
      barriers: (Array.isArray(source.barriers) ? source.barriers : []).map((entry, barrierIndex) => ({
        id: cleanId(entry?.id) || `raid-barrier-${barrierIndex + 1}`, kind: cleanId(entry?.kind) || "door",
        barrierId: cleanId(entry?.barrierId), label: String(entry?.label || "Raid entry barrier").trim(), cell: cleanCell(entry?.cell),
        authorizedRoomId: cleanId(entry?.authorizedRoomId), startingCondition: Math.max(0, finite(entry?.startingCondition, 100)),
        currentCondition: Math.max(0, finite(entry?.currentCondition, entry?.startingCondition ?? 100)),
        damageApplied: Math.max(0, finite(entry?.damageApplied)), status: entry?.status === "breached" ? "breached" : "breaching",
        firstHitAt: Math.max(authorizedAt, finite(entry?.firstHitAt)), completedAt: entry?.completedAt == null ? null : Math.max(authorizedAt, finite(entry.completedAt))
      })),
      actors: (Array.isArray(source.actors) ? source.actors : []).map(normalizeActor),
      seizures: (Array.isArray(source.seizures) ? source.seizures : []).map((entry, seizureIndex) => ({
        id: cleanId(entry?.id) || `raid-seizure-${seizureIndex + 1}`, subjectKind: cleanId(entry?.subjectKind) || "physicalStack",
        subjectId: cleanId(entry?.subjectId), sourceSubjectId: cleanId(entry?.sourceSubjectId), label: String(entry?.label || "Responsive evidence").trim(),
        quantity: Math.max(0, finite(entry?.quantity, 1)), actorId: cleanId(entry?.actorId),
        status: entry?.status === "externalized" ? "externalized" : "carried", locatedAt: Math.max(authorizedAt, finite(entry?.locatedAt)),
        externalizedAt: entry?.externalizedAt == null ? null : Math.max(authorizedAt, finite(entry.externalizedAt)),
        custody: (Array.isArray(entry?.custody) ? entry.custody : []).map((custody) => ({
          at: Math.max(authorizedAt, finite(custody?.at)), action: cleanId(custody?.action) || "located", actorId: cleanId(custody?.actorId),
          roomId: cleanId(custody?.roomId), details: String(custody?.details || "").trim()
        }))
      })),
      communication: {
        state: ["quiet", "searching", "contact", "custody", "withdrawal"].includes(source.communication?.state) ? source.communication.state : "quiet",
        lastKnownCell: cleanCell(source.communication?.lastKnownCell),
        lastSightedAt: source.communication?.lastSightedAt == null ? null : Math.max(authorizedAt, finite(source.communication.lastSightedAt)),
        reportedByActorId: cleanId(source.communication?.reportedByActorId)
      },
      force: {
        posture: source.force?.posture === "lethal" ? "lethal" : "arrest",
        triggerId: cleanId(source.force?.triggerId), triggerKind: cleanId(source.force?.triggerKind),
        triggeredAt: source.force?.triggeredAt == null ? null : Math.max(authorizedAt, finite(source.force.triggeredAt)),
        witnessActorId: cleanId(source.force?.witnessActorId), responsibleActorId: cleanId(source.force?.responsibleActorId),
        reason: String(source.force?.reason || "").trim()
      },
      custody: {
        status: custodyStatus, targetActorId: cleanId(source.custody?.targetActorId) || "scientist",
        surrenderedAt: source.custody?.surrenderedAt == null ? null : Math.max(authorizedAt, finite(source.custody.surrenderedAt)),
        restraintStartedAt: source.custody?.restraintStartedAt == null ? null : Math.max(authorizedAt, finite(source.custody.restraintStartedAt)),
        restraintProgress: Math.max(0, Math.min(100, finite(source.custody?.restraintProgress))),
        restrainedAt: source.custody?.restrainedAt == null ? null : Math.max(authorizedAt, finite(source.custody.restrainedAt)),
        arrestingActorId: cleanId(source.custody?.arrestingActorId),
        extractedAt: source.custody?.extractedAt == null ? null : Math.max(authorizedAt, finite(source.custody.extractedAt)),
        bookedAt: source.custody?.bookedAt == null ? null : Math.max(authorizedAt, finite(source.custody.bookedAt)),
        escapedAt: source.custody?.escapedAt == null ? null : Math.max(authorizedAt, finite(source.custody.escapedAt))
      },
      detention: source.detention && typeof source.detention === "object" ? {
        facilityId: cleanId(source.detention.facilityId) || "municipal-holding",
        facilityLabel: String(source.detention.facilityLabel || "Municipal Holding Facility").trim(),
        cellRoomId: cleanId(source.detention.cellRoomId) || "municipalHoldingCell",
        bookingAt: Math.max(authorizedAt, finite(source.detention.bookingAt)),
        status: ["pretrial", "released", "escaped", "transferred"].includes(source.detention.status) ? source.detention.status : "pretrial",
        securityStudyProgress: Math.max(0, Math.min(100, finite(source.detention.securityStudyProgress))),
        alert: Math.max(0, Math.min(100, finite(source.detention.alert)))
      } : null,
      outcome: source.outcome && typeof source.outcome === "object" ? {
        kind: cleanId(source.outcome.kind), at: Math.max(authorizedAt, finite(source.outcome.at)), summary: String(source.outcome.summary || "").trim()
      } : null,
      history: (Array.isArray(source.history) ? source.history : []).map(normalizeHistoryEntry).sort((left, right) => left.at - right.at)
    };
  }

  function defaultState() {
    return { version: VERSION, raids: [], nextRaidNumber: 1, nextForceTriggerNumber: 1 };
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const raids = (Array.isArray(source.raids) ? source.raids : []).map(normalizeRaid);
    return {
      version: VERSION, raids,
      nextRaidNumber: Math.max(1, Math.floor(finite(source.nextRaidNumber, raids.length + 1))),
      nextForceTriggerNumber: Math.max(1, Math.floor(finite(source.nextForceTriggerNumber, 1)))
    };
  }

  function teamFor(seed, raidId) {
    return TEAM_ROLES.map((definition, index) => {
      const nameIndex = hash(`${seed}:${raidId}:${definition.role}:given`) % GIVEN_NAMES.length;
      const surnameIndex = hash(`${seed}:${raidId}:${definition.role}:surname`) % SURNAMES.length;
      return normalizeActor({
        id: `${raidId}-${definition.role}`, name: `${GIVEN_NAMES[nameIndex]} ${SURNAMES[surnameIndex]}`,
        role: definition.role, equipment: definition.equipment, status: "scheduled"
      }, index);
    });
  }

  function authorize(candidate, execution, context = {}) {
    const state = normalizeState(candidate);
    if (!execution?.id || execution.institutionId !== "law-enforcement") return { state, raid: null, created: false };
    const existing = state.raids.find((entry) => entry.warrantExecutionId === cleanId(execution.id));
    if (existing) return { state, raid: existing, created: false };
    const authorizedAt = Math.max(0, finite(context.clock, execution.issuedAt));
    const id = `law-enforcement-raid-${state.nextRaidNumber++}`;
    const delay = Math.floor((1 + unitRoll(`${context.seed}:${execution.id}:raid-delay`) * 2) * HOUR);
    const arrivalAt = authorizedAt + delay;
    const raid = normalizeRaid({
      id, warrantExecutionId: execution.id, actionId: execution.actionId, caseId: execution.caseId,
      docket: execution.docket, authorizedAt, arrivalAt, arrivalWindowEnd: arrivalAt + HOUR,
      authorizedRoomIds: context.authorizedRoomIds, knownRoomIds: context.knownRoomIds || context.authorizedRoomIds,
      objectives: [
        { id: `${id}-arrest-scientist`, kind: "arrestActor", targetKind: "scientist", targetId: "scientist", label: "Locate and arrest the scientist", priority: "primary" },
        { id: `${id}-seize-evidence`, kind: "seizeEvidence", targetKind: "evidenceCategory", targetId: "responsiveEvidence", label: "Secure responsive evidence encountered during the lawful search", priority: "secondary" }
      ],
      actors: teamFor(context.seed, id),
      history: [{ at: authorizedAt, action: "authorized", summary: "A named four-person team was assigned to execute the search-and-arrest warrant." }]
    }, state.raids.length);
    state.raids.push(raid);
    return { state, raid, created: true };
  }

  function withRaid(candidate, raidId, mutate) {
    const state = normalizeState(candidate);
    const raid = state.raids.find((entry) => entry.id === cleanId(raidId));
    if (!raid) return { state, raid: null, changed: false };
    const changed = mutate(raid, state) !== false;
    return { state, raid, changed };
  }

  function activate(candidate, raidId, options = {}) {
    return withRaid(candidate, raidId, (raid) => {
      if (raid.status !== "scheduled") return false;
      raid.status = "entering";
      raid.communication.state = "searching";
      for (const actor of raid.actors) {
        actor.status = "active"; actor.present = true; actor.mapCell = cleanCell(options.entryCell); actor.roomId = cleanId(options.roomId);
      }
      raid.history.push({ at: Math.max(raid.authorizedAt, finite(options.clock)), action: "arrived", summary: "The raid team entered through the saved lawful entry point." });
      return true;
    });
  }

  function recordSighting(candidate, raidId, options = {}) {
    return withRaid(candidate, raidId, (raid) => {
      const cell = cleanCell(options.cell);
      if (!cell || ["booked", "completed", "withdrawing"].includes(raid.status)) return false;
      raid.status = "contact"; raid.communication.state = "contact";
      raid.communication.lastKnownCell = cell; raid.communication.lastSightedAt = Math.max(raid.authorizedAt, finite(options.clock));
      raid.communication.reportedByActorId = cleanId(options.actorId);
      if (!raid.history.some((entry) => entry.action === "scientistSighted")) raid.history.push({ at: raid.communication.lastSightedAt, action: "scientistSighted", summary: "An officer physically sighted the named arrest target and shared the last-known position." });
      return true;
    });
  }

  function surrender(candidate, raidId, clock = 0) {
    return withRaid(candidate, raidId, (raid) => {
      if (!["free", "surrendered"].includes(raid.custody.status) || ["scheduled", "booked", "completed"].includes(raid.status)) return false;
      if (raid.custody.status === "surrendered") return false;
      raid.custody.status = "surrendered"; raid.custody.surrenderedAt = Math.max(raid.authorizedAt, finite(clock)); raid.status = "arresting";
      raid.history.push({ at: raid.custody.surrenderedAt, action: "surrendered", summary: "The scientist surrendered, but remained free until an officer could physically apply restraints." });
      return true;
    });
  }

  function revokeSurrender(candidate, raidId, clock = 0) {
    return withRaid(candidate, raidId, (raid) => {
      if (raid.custody.status !== "surrendered") return false;
      raid.custody.status = "free"; raid.custody.restraintProgress = 0; raid.status = "contact";
      raid.history.push({ at: Math.max(raid.authorizedAt, finite(clock)), action: "surrenderRevoked", summary: "The scientist revoked surrender before restraint was completed; resistance was recorded." });
      return true;
    });
  }

  function progressRestraint(candidate, raidId, options = {}) {
    return withRaid(candidate, raidId, (raid) => {
      if (!["surrendered", "restraining"].includes(raid.custody.status) && !options.incapacitated) return false;
      const actorId = cleanId(options.actorId);
      const actor = raid.actors.find((entry) => entry.id === actorId && entry.present && entry.health > 0);
      if (!actor) return false;
      raid.status = "arresting"; raid.custody.status = "restraining"; raid.custody.arrestingActorId = actor.id;
      raid.custody.restraintStartedAt ??= Math.max(raid.authorizedAt, finite(options.clock)); actor.status = "restraining";
      raid.custody.restraintProgress = Math.min(100, raid.custody.restraintProgress + Math.max(0, finite(options.amount)));
      if (raid.custody.restraintProgress >= 100) {
        raid.custody.status = "restrained"; raid.custody.restrainedAt = Math.max(raid.authorizedAt, finite(options.clock)); raid.status = "extracting"; actor.status = "escorting";
        raid.objectives.find((entry) => entry.kind === "arrestActor").status = "active";
        raid.communication.state = "custody";
        raid.history.push({ at: raid.custody.restrainedAt, action: "restrained", summary: "An arrest officer physically completed restraint of the scientist." });
      }
      return true;
    });
  }

  function extract(candidate, raidId, clock = 0) {
    return withRaid(candidate, raidId, (raid) => {
      if (!['restrained', 'extracting'].includes(raid.custody.status)) return false;
      raid.custody.status = "extracting"; raid.custody.extractedAt = Math.max(raid.authorizedAt, finite(clock));
      raid.history.push({ at: raid.custody.extractedAt, action: "extracted", summary: "Officers physically escorted the restrained scientist through the lawful site exit." });
      return true;
    });
  }

  function book(candidate, raidId, options = {}) {
    return withRaid(candidate, raidId, (raid) => {
      if (raid.custody.status !== "extracting" || raid.custody.extractedAt == null) return false;
      const clock = Math.max(raid.authorizedAt, finite(options.clock));
      raid.custody.status = "booked"; raid.custody.bookedAt = clock; raid.status = "booked";
      raid.detention = {
        facilityId: cleanId(options.facilityId) || "municipal-holding", facilityLabel: String(options.facilityLabel || "Municipal Holding Facility").trim(),
        cellRoomId: cleanId(options.cellRoomId) || "municipalHoldingCell", bookingAt: clock, status: "pretrial", securityStudyProgress: 0, alert: 0
      };
      const objective = raid.objectives.find((entry) => entry.kind === "arrestActor"); if (objective) objective.status = "completed";
      raid.outcome = { kind: "booked", at: clock, summary: "The scientist was booked into pretrial detention. The run continues." };
      for (const actor of raid.actors) { actor.present = false; actor.status = "withdrawn"; actor.mapCell = null; }
      raid.history.push({ at: clock, action: "booked", summary: raid.outcome.summary });
      return true;
    });
  }

  function studySecurity(candidate, raidId, options = {}) {
    return withRaid(candidate, raidId, (raid) => {
      if (raid.status !== "booked" || raid.detention?.status !== "pretrial") return false;
      raid.detention.securityStudyProgress = Math.min(100, raid.detention.securityStudyProgress + Math.max(0, finite(options.amount, 20)));
      raid.detention.alert = Math.min(100, raid.detention.alert + Math.max(0, finite(options.alert)));
      raid.history.push({ at: Math.max(raid.authorizedAt, finite(options.clock)), action: "securityStudied", summary: "The detained scientist studied the holding cell's physical security and routines." });
      return true;
    });
  }

  function escapeDetention(candidate, raidId, clock = 0) {
    return withRaid(candidate, raidId, (raid) => {
      if (raid.status !== "booked" || raid.detention?.status !== "pretrial" || raid.detention.securityStudyProgress < 100) return false;
      const at = Math.max(raid.authorizedAt, finite(clock)); raid.status = "escaped"; raid.custody.status = "escaped"; raid.custody.escapedAt = at;
      raid.detention.status = "escaped"; raid.outcome = { kind: "escapedDetention", at, summary: "The scientist escaped municipal holding and remains alive as a fugitive." };
      raid.history.push({ at, action: "escapedDetention", summary: raid.outcome.summary });
      return true;
    });
  }

  function releaseDetention(candidate, raidId, clock = 0) {
    return withRaid(candidate, raidId, (raid) => {
      if (raid.status !== "booked" || raid.detention?.status !== "pretrial") return false;
      const at = Math.max(raid.authorizedAt, finite(clock));
      raid.status = "completed"; raid.custody.status = "released"; raid.detention.status = "released";
      raid.communication.state = "withdrawal";
      raid.outcome = { kind: "pretrialRelease", at, summary: "The criminal case continued after a court-authorized release from temporary jail." };
      raid.history.push({ at, action: "pretrialRelease", summary: raid.outcome.summary });
      return true;
    });
  }

  function escalateForce(candidate, raidId, options = {}) {
    return withRaid(candidate, raidId, (raid, state) => {
      if (raid.force.posture === "lethal") return false;
      const at = Math.max(raid.authorizedAt, finite(options.clock));
      raid.force = {
        posture: "lethal", triggerId: `raid-force-trigger-${state.nextForceTriggerNumber++}`,
        triggerKind: cleanId(options.kind) || "violentResistance", triggeredAt: at,
        witnessActorId: cleanId(options.witnessActorId), responsibleActorId: cleanId(options.responsibleActorId) || "scientist",
        reason: String(options.reason || "An immediate serious threat authorized lethal force.").trim()
      };
      raid.history.push({ at, action: "lethalForceAuthorized", summary: raid.force.reason });
      return true;
    });
  }

  function recordSeizure(candidate, raidId, options = {}) {
    return withRaid(candidate, raidId, (raid) => {
      const subjectId = cleanId(options.subjectId);
      const actorId = cleanId(options.actorId);
      if (!subjectId || !actorId || raid.seizures.some((entry) => entry.subjectId === subjectId)) return false;
      const at = Math.max(raid.authorizedAt, finite(options.clock));
      raid.seizures.push({
        id: `raid-seizure-${raid.seizures.length + 1}`, subjectKind: cleanId(options.subjectKind) || "physicalStack",
        subjectId, sourceSubjectId: cleanId(options.sourceSubjectId) || subjectId, label: String(options.label || "Responsive evidence").trim(),
        quantity: Math.max(0, finite(options.quantity, 1)), actorId, status: "carried", locatedAt: at, externalizedAt: null,
        custody: [
          { at, action: "located", actorId, roomId: cleanId(options.roomId), details: "Physically perceived during the authorized raid search." },
          { at, action: "carried", actorId, roomId: cleanId(options.roomId), details: "Entered the officer's physical inventory." }
        ]
      });
      const objective = raid.objectives.find((entry) => entry.kind === "seizeEvidence"); if (objective) objective.status = "active";
      raid.history.push({ at, action: "evidenceSeized", summary: `${String(options.label || "Responsive evidence").trim()} entered exact physical raid custody.` });
      return true;
    });
  }

  function externalizeSeizures(candidate, raidId, clock = 0) {
    return withRaid(candidate, raidId, (raid) => {
      const at = Math.max(raid.authorizedAt, finite(clock));
      let changed = false;
      for (const seizure of raid.seizures.filter((entry) => entry.status === "carried")) {
        seizure.status = "externalized"; seizure.externalizedAt = at;
        seizure.custody.push({ at, action: "externalized", actorId: seizure.actorId, roomId: "", details: "Transferred from the site into law-enforcement evidence custody." });
        changed = true;
      }
      if (changed) { const objective = raid.objectives.find((entry) => entry.kind === "seizeEvidence"); if (objective) objective.status = "completed"; }
      return changed;
    });
  }

  function completeUnlocated(candidate, raidId, clock = 0) {
    return withRaid(candidate, raidId, (raid) => {
      if (["booked", "escaped", "completed"].includes(raid.status) || raid.custody.status !== "free") return false;
      const at = Math.max(raid.authorizedAt, finite(clock)); raid.status = "completed"; raid.communication.state = "withdrawal";
      const objective = raid.objectives.find((entry) => entry.kind === "arrestActor"); if (objective) objective.status = "failed";
      for (const actor of raid.actors) { actor.present = false; actor.status = "withdrawn"; actor.mapCell = null; }
      raid.outcome = { kind: "targetNotLocated", at, summary: "The authorized premises were physically searched, but the scientist was not located. The run continues." };
      raid.history.push({ at, action: "targetNotLocated", summary: raid.outcome.summary });
      return true;
    });
  }

  function escapeSite(candidate, raidId, clock = 0) {
    return withRaid(candidate, raidId, (raid) => {
      if (["scheduled", "booked", "escaped", "completed"].includes(raid.status) || !["free", "surrendered"].includes(raid.custody.status)) return false;
      const at = Math.max(raid.authorizedAt, finite(clock)); raid.status = "escaped"; raid.custody.status = "escaped"; raid.custody.escapedAt = at;
      const objective = raid.objectives.find((entry) => entry.kind === "arrestActor"); if (objective) objective.status = "failed";
      for (const actor of raid.actors) { actor.present = false; actor.status = "withdrawn"; actor.mapCell = null; }
      raid.outcome = { kind: "escapedSite", at, summary: "The scientist physically left through an unobserved site exit and evaded this raid. The run continues." };
      raid.history.push({ at, action: "escapedSite", summary: raid.outcome.summary });
      return true;
    });
  }

  function recordScientistDeath(candidate, raidId, options = {}) {
    return withRaid(candidate, raidId, (raid) => {
      if (["booked", "escaped", "completed"].includes(raid.status)) return false;
      const at = Math.max(raid.authorizedAt, finite(options.clock)); raid.status = "completed"; raid.communication.state = "withdrawal";
      const objective = raid.objectives.find((entry) => entry.kind === "arrestActor"); if (objective) objective.status = "failed";
      for (const actor of raid.actors) { actor.present = false; actor.status = "withdrawn"; actor.mapCell = null; }
      raid.outcome = { kind: "scientistKilled", at, summary: String(options.summary || "The scientist died during the raid. Death ended the run; arrest did not.").trim() };
      raid.history.push({ at, action: "scientistKilled", summary: raid.outcome.summary });
      return true;
    });
  }

  function nextEvent(candidate, clock = 0) {
    return normalizeState(candidate).raids.filter((raid) => raid.status === "scheduled" && raid.arrivalAt >= finite(clock))
      .sort((left, right) => left.arrivalAt - right.arrivalAt || left.id.localeCompare(right.id))[0] || null;
  }

  return Object.freeze({
    VERSION, STATUSES, ACTOR_STATUSES, CUSTODY_STATUSES, TEAM_ROLES,
    defaultState, normalizeState, normalizeRaid, authorize, activate, recordSighting,
    surrender, revokeSurrender, progressRestraint, extract, book, studySecurity, escapeDetention, releaseDetention, escalateForce,
    recordSeizure, externalizeSeizures, completeUnlocated, escapeSite, recordScientistDeath, nextEvent
  });
}));
