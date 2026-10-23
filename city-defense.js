(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityDefense = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const ROLE = 'militaryDefenseCommand', DOOR = 'door-survey-wilderness-boundary';
  const POST = Object.freeze({ x: 19, y: 12, z: 6 }), SERVICE = Object.freeze({ x: 19, y: 13, z: 6 });
  const GATE = Object.freeze({ x: 20, y: 12, z: 6 });
  const COVERAGE = Object.freeze([{ x: 21, y: 12, z: 6 }, { x: 22, y: 12, z: 6 }]);
  const CAPACITY = 86400, SHIFT = 1800;
  const LIMITS = 'Original approach installation and two outer approach tiles only, not whole-city defense, a new wall, an army or divine endorsement. Station energy is separate from personal mana and counter power. Existing inner-boundary protection is outside this contribution. No forced attack, remote telemetry, automatic political collapse or city-power award.';
  const same = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  function sourceFromWorld(map, cityId) {
    const row = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === cityId);
    const g = map?.cityGovernments?.governments?.find(g => g.cityId === cityId);
    const institution = g?.institutions?.find(i => i.id === g.roleAssignments.militaryDefenseCommand);
    const current = map?.strategicCivicHistory?.currentInstitutionRows?.find(r => r.institutionId === institution?.id);
    if (!row || row.currentPopulation < 8 || !row.physicalJurisdictionExists || row.physicalCondition === 'ruined'
      || !['fragile', 'functional', 'strong'].includes(row.services?.fortifications) || !institution
      || ['disrupted', 'displaced', 'suspended'].includes(current?.operationalStatus)
      || current && current.actualControlStatus !== 'localCharter') return null;
    const condition = Math.min(({ fragile: 55, functional: 80, strong: 100 })[row.services.fortifications],
      ({ intact: 100, worn: 85, damaged: 55, badlyDamaged: 40 })[row.physicalCondition] || 55);
    return { cityId, cityName: row.name || cityId, charterId: g.charter.id, institutionId: institution.id,
      populationSourceId: row.assetId, population: row.currentPopulation, condition,
      installationId: `${row.assetId}:existing-approach-ward`, baselineEnergy: Math.floor(CAPACITY * condition / 100),
      provenance: 'Bounded elaboration of existing city fortifications and original municipal boundary, not new construction or the whole defense budget.' };
  }
  const validSource = s => s && ['cityId', 'charterId', 'institutionId', 'populationSourceId', 'installationId'].every(k => typeof s[k] === 'string' && s[k])
    && Number.isFinite(s.population) && s.population >= 8 && Number.isFinite(s.condition) && s.condition > 0 && s.condition <= 100
    && Number.isFinite(s.baselineEnergy) && s.baselineEnergy > 0 && s.baselineEnergy <= CAPACITY;
  function create(source, succession, defender, office, run, at, condition) {
    if (!validSource(source) || !run?.worldId || !run.runId || !succession?.handover || !defender?.id
      || source.cityId !== succession.source.cityId || source.charterId !== succession.source.charterId
      || office?.id !== succession.officeId || office.cityId !== source.cityId || defender.institutionId !== source.institutionId
      || !defender.exceptionalCapabilities?.includes('city-scale ward defense') || !Number.isFinite(condition) || condition <= 0) return null;
    const s = { id: source.installationId, source: copy(source), ...copy(run), officeId: office.id, defenderId: defender.id,
      handoverId: succession.handover.id, bodyEpoch: succession.handover.bodyEpoch, allocatedAt: at, lastAt: at,
      energy: source.baselineEnergy, initialEnergy: source.baselineEnergy, charged: 0, standbySpent: 0, combatSpent: 0,
      duty: null, job: null, quote: null, report: null, refusal: null, nextNumber: 1, receipts: [], contacts: [],
      baselineCondition: Math.min(condition, source.condition), message: 'Existing installation elaborated once. No wall, person or personal reserves were created.' };
    return authority(s, succession, defender, { sourceCurrent: true, bodyEpoch: s.bodyEpoch }) ? s : null;
  }
  const normalize = s => validSource(s?.source) && s.worldId && s.runId && s.defenderId && Number.isFinite(s.energy)
    && s.energy >= 0 && s.energy <= CAPACITY && Array.isArray(s.receipts) && Array.isArray(s.contacts) ? copy(s) : null;
  function authority(s, succession, a, c) {
    return Boolean(s && c.sourceCurrent && c.bodyEpoch === s.bodyEpoch && succession?.handover?.id === s.handoverId
      && succession.handover.bodyEpoch === s.bodyEpoch && succession.source.cityId === s.source.cityId && succession.source.charterId === s.source.charterId
      && succession.control?.sourceReceiptId === s.handoverId && succession.control.recognizedAuthorityId === 'scientist'
      && succession.control.bodyEpoch === s.bodyEpoch && succession.officeId === s.officeId && a?.id === s.defenderId
      && a.institutionId === s.source.institutionId && succession.agreements.some(r => r.personId === a.id
        && r.institutionId === a.institutionId && r.termsId === succession.handover.termsId && r.roles.includes(ROLE) && !r.suspendedRoles?.includes(ROLE))
      && succession.control.commandRelationships.some(r => r.personId === a.id && r.institutionId === a.institutionId && r.roles.includes(ROLE)));
  }
  const contact = c => c.alive && c.capable && c.local && c.free && !c.violence && c.defenderPresent;
  const working = (s, c) => c.installationPresent && c.condition >= 25 && s.energy > 0;
  // A real local fitting conserves reserve, never creates it or expands coverage.
  // Original capable tuning is essential; unattended/suppressed wards fall back
  // to their existing conservative consumption and interception rules.
  function efficiencyRate(s, a, c) {
    const f = s?.efficiency, post = s?.layout?.post || POST;
    return f?.installationId === s?.id && f.cityOwnerId === s.source?.cityId && f.enabled && f.remainingSeconds > 0
      && c.condition >= 50 && able(a) && !c.incapacitated && !c.suppressed && !c.obligation
      && a.assignment === s.duty?.id && same(a.mapCell, post) && a.workSeconds > 0 && a.stamina > 1 ? .75 : 1;
  }
  function standby(s, a, c, seconds) {
    if (!working(s, c) || seconds <= 0) return 0;
    const rate = efficiencyRate(s, a, c), efficient = rate < 1 ? Math.min(seconds, s.efficiency.remainingSeconds) : 0;
    const used = Math.min(s.energy, efficient * rate + seconds - efficient);
    s.energy -= used; s.standbySpent += used;
    if (efficient) s.efficiency.remainingSeconds = Math.max(0, s.efficiency.remainingSeconds - efficient);
    return used;
  }
  function inspect(s, succession, a, c, at) {
    if (!contact(c) || !c.atStation || !authority(s, succession, a, c)) return false;
    s.quote = { id: `${s.id}:inspection:${s.nextNumber++}`, at, expiresAt: at + 3600, bodyEpoch: c.bodyEpoch,
      condition: c.condition, charge: s.energy, installationId: s.id, defenderId: a.id, seconds: SHIFT,
      availability: s.refusal ? s.refusal.reason : c.obligation || a.assignment ? 'Original defender has a competing duty or institutional obligation.'
        : c.suppressed ? 'Original defender cannot tune the station while magic is suppressed.'
          : a.workSeconds < SHIFT + 60 || a.stamina < 40 ? 'Original defender requires supplied off-duty recovery before accepting this watch.'
            : !working(s, c) || !c.postAccessible ? 'Original station or post requires physical remediation.' : 'Original defender can consider this bounded watch.',
      chargeSeconds: 60, chargeKey: 'arcaneFeedstock', chargeAmount: 21600, repairSeconds: 120, repairParts: 2, repairGain: 25 };
    receive(s, succession, a, c, at); return true;
  }
  function order(s, succession, a, c, expected, at) {
    if (!contact(c) || !(c.atStation || c.atCounter) || !authority(s, succession, a, c) || !s.quote
      || JSON.stringify(s.quote) !== JSON.stringify(expected) || at >= s.quote.expiresAt || s.refusal || c.obligation
      || s.duty || s.job || !working(s, c) || !able(a) || c.incapacitated || c.suppressed
      || a.assignment || a.workSeconds < SHIFT + 60 || a.stamina < 40 || !c.postAccessible) return false;
    const id = `${s.id}:watch:${s.nextNumber++}`;
    s.duty = { id, at, homeCell: copy(a.mapCell), homeRoomId: a.roomId, phase: 'outward', progress: 0,
      bodyEpoch: c.bodyEpoch, reason: '', nextMoveAt: at + 1 };
    a.assignment = id; s.quote = null; s.message = 'Original defender accepted one thirty-minute station watch and actual return, not an offensive deployment.'; return true;
  }
  function release(s, a, at, reason = 'Watch released locally; original defender must return physically.') {
    if (!s?.duty || a?.id !== s.defenderId) return false;
    s.duty.phase = 'returning'; s.duty.reason = reason; s.duty.nextMoveAt = Math.max(s.duty.nextMoveAt, at + 1); s.message = reason; return true;
  }
  function canService(s, succession, a, c, at) {
    return contact(c) && c.atStation && authority(s, succession, a, c) && c.installationPresent
      && !s.duty && !s.job && !a.assignment && able(a) && !c.incapacitated && s.quote && at < s.quote.expiresAt
      && s.quote.bodyEpoch === c.bodyEpoch && s.quote.condition === c.condition;
  }
  function beginService(s, succession, a, c, key, stacks, at) {
    if (!canService(s, succession, a, c, at) || !['charge', 'repair'].includes(key)) return false;
    const repair = key === 'repair', quantity = repair ? 2 : 1, itemKey = repair ? 'metalParts' : 'arcaneFeedstock';
    if (repair ? c.condition >= 100 : s.energy > CAPACITY - 21600) return false;
    const stack = stacks.find(i => i.key === itemKey && i.quantity >= quantity && i.carriedBy === 'scientist'
      && !i.reservedTaskId && !i.cityOwnerId && !i.civicCustody && !i.fixtureId && !i.containerId && !i.tags?.includes('contaminated'));
    const seconds = repair ? 120 : 60; if (!stack || a.workSeconds < seconds) return false;
    const id = `${s.id}:service:${s.nextNumber++}`;
    s.job = { id, kind: key, stackId: stack.id, originalQuantity: stack.quantity, quantity, itemKey, seconds, progress: 0,
      condition: c.condition, bodyEpoch: c.bodyEpoch, lastAt: at };
    stack.reservedTaskId = id; a.assignment = id; s.quote = null; return true;
  }
  function cancelService(s, a, stacks) {
    const j = s?.job; if (!j) return false;
    const i = stacks.find(i => i.id === j.stackId); if (i?.reservedTaskId === j.id) i.reservedTaskId = '';
    if (a?.assignment === j.id) a.assignment = null; s.job = null; return true;
  }
  function advance(s, succession, a, context, to, h = {}) {
    if (!s || !context().alive || !Number.isFinite(to) || to <= s.lastAt) return false;
    while (s.lastAt < to) {
      const dt = Math.min(s.duty || s.job ? 1 : to - s.lastAt, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      const c = context(), operable = working(s, c);
      if (operable) standby(s, a, c, dt);
      const j = s.job;
      if (j) {
        const stacks = h.stacks?.() || [], i = stacks.find(i => i.id === j.stackId);
        if (!contact(c) || !c.atStation || !authority(s, succession, a, c) || !c.installationPresent || c.condition !== j.condition
          || c.bodyEpoch !== j.bodyEpoch || !able(a) || c.incapacitated || a.assignment !== j.id || a.workSeconds < dt
          || !i || i.reservedTaskId !== j.id || i.quantity !== j.originalQuantity || i.carriedBy !== 'scientist'
          || i.cityOwnerId || i.civicCustody || i.fixtureId || i.containerId || i.tags?.includes('contaminated')) {
          cancelService(s, a, stacks); s.message = 'Physical service interrupted; uninstalled supplies retained and spent duty not refunded.';
        } else {
          const used = Math.min(dt, j.seconds - j.progress); j.progress += used; a.workSeconds -= used;
          if (j.progress >= j.seconds) {
            // Exact original structure must accept the physical repair before
            // any actual parts are consumed. A missing structure is not rebuilt.
            if (j.kind === 'repair' && !h.repair?.(Math.min(100, c.condition + 25))) { cancelService(s, a, stacks); continue; }
            i.quantity -= j.quantity; if (i.knownQuantity != null) i.knownQuantity = Math.min(i.knownQuantity, i.quantity);
            if (j.kind === 'charge') { s.energy += 21600; s.charged += 21600; }
            s.receipts.push({ id: j.id, at, kind: j.kind, stackId: i.id, quantity: j.quantity, workSeconds: j.seconds,
              installationId: s.id, ownerId: s.source.cityId });
            cancelService(s, a, stacks); s.message = 'Actual original installation serviced; no personal mana, health or political consent restored.';
          }
        }
      }
      const d = s.duty; if (!d) continue;
      if (!able(a) || c.incapacitated || a.assignment !== d.id) { d.reason = 'Original defender unavailable at the actual position; no replacement or teleport.'; continue; }
      if (d.phase !== 'returning' && (!authority(s, succession, a, c) || s.refusal || c.obligation || c.suppressed
        || !operable || a.workSeconds < dt || a.stamina <= 6)) release(s, a, at, 'Station watch interrupted; original person and spent support remain.');
      if (a.workSeconds < dt) { d.reason = 'Original duty exhausted; physical return remains outstanding.'; continue; }
      if (d.phase === 'watch') {
        if (!same(a.mapCell, POST) || !c.postAccessible) { release(s, a, at, 'Original defensive post unavailable.'); continue; }
        a.workSeconds -= dt; d.progress += dt;
        if (Math.floor(d.progress / 60) > Math.floor((d.progress - dt) / 60)) a.stamina = Math.max(0, a.stamina - 1);
        if (d.progress >= SHIFT) release(s, a, at, 'Thirty-minute station watch completed; actual return still required.');
      } else if (at >= d.nextMoveAt) {
        const goal = d.phase === 'outward' ? POST : d.homeCell;
        if (same(a.mapCell, goal)) {
          if (d.phase === 'outward') d.phase = 'watch';
          else { s.receipts.push({ id: d.id, at, kind: 'watch', seconds: d.progress, reason: d.reason, personId: a.id }); a.assignment = null; s.duty = null; }
        } else if (a.stamina >= 1 && h.move?.(a, goal)) { a.workSeconds--; a.stamina--; }
        d.nextMoveAt = at + 1;
      }
    }
    return true;
  }
  function absorb(s, a, c, hit, at) {
    const amount = Math.max(0, Number(hit.amount) || 0);
    if (!s || !c.alive || !working(s, c) || !hit.hostile || !hit.lineOfEffect
      || !hit.damageTypes?.length || hit.damageTypes.some(t => !['physical', 'force'].includes(t))
      || ![...(s.layout?.coverage || COVERAGE), s.layout?.gate || GATE].some(cell => same(cell, hit.cell))) return { damage: amount, absorbed: 0 };
    const active = s.duty?.phase === 'watch' && a?.assignment === s.duty.id && same(a.mapCell, s.layout?.post || POST)
      && able(a) && !c.incapacitated && !c.suppressed && !c.obligation && !s.refusal && a.workSeconds > 0 && a.stamina > 0;
    const cost = 60 * efficiencyRate(s, a, c);
    const absorbed = Math.min(amount, active ? 20 : 5, s.energy / cost);
    s.energy -= absorbed * cost; s.combatSpent += absorbed * cost;
    // Only the actual attending defender can later communicate this contact.
    if (active && c.defenderWitness) { s.contacts.push({ at, absorbed, targetCell: copy(hit.cell), source: 'Original defender witnessed a station interception' }); s.contacts = s.contacts.slice(-80); }
    return { damage: amount - absorbed, absorbed };
  }
  function aggression(s, a, c, at) {
    if (!s || !c.defenderWitness) return false;
    s.refusal ||= { at, personId: a.id, reason: 'Personally witnessed attack on this city installation or its original personnel; discretionary station watch refused. Not a criminal verdict or divine ruling.' };
    release(s, a, at, s.refusal.reason); return true;
  }
  function receive(s, succession, a, c, at) {
    if (!contact(c) || !(c.atStation || c.atCounter) || !authority(s, succession, a, c)) return false;
    s.report = copy({ at, installationId: s.id, cityId: s.source.cityId, coverage: COVERAGE,
      condition: c.atStation ? c.condition : null, energy: c.atStation ? s.energy : null,
      status: c.atStation ? working(s, c) ? 'Outer approach ward operational' : 'Outer approach ward offline' : 'Present installation status unverified from the counter',
      duty: s.duty && { phase: s.duty.phase, seconds: s.duty.progress, personId: a.id },
      refusal: s.refusal, receipts: s.receipts, contacts: s.contacts, limits: LIMITS }); return true;
  }
  return { ROLE, DOOR, POST, SERVICE, GATE, COVERAGE, CAPACITY, SHIFT, LIMITS, same, able, sourceFromWorld, validSource,
    create, normalize, authority, contact, working, efficiencyRate, standby, inspect, order, release, beginService, cancelService, advance, absorb, aggression, receive };
});
