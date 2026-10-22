(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./city-defense') : root.HelixCityDefense);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixOuterApproach = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Defense) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const alive = a => a?.status === 'alive' && a.health > 0;
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const LIMITS = 'One defended outer receiving/service approach only. No inner-city admission, title, clerical obedience, army, confiscation, sovereign submission or campaign victory. Installed reserve and personal mana are separate. Leaving removes the claim; no invisible garrison. Only actually witnessed conduct becomes evidence, not automatic guilt.';
  function create(source, b, layout, binding, at) {
    if (!Defense.validSource(source) || !b || source.cityId !== b.source.cityId || source.charterId !== b.source.charterId
      || source.institutionId !== b.source.defenseId || source.populationSourceId !== b.source.populationSourceId
      || !b.defender?.exceptionalCapabilities?.includes('city-scale ward defense')
      || !binding?.worldId || !binding.runId || !layout?.roomId || !layout.post || !layout.service || !layout.receiving) return null;
    const id = source.installationId;
    return { id, ...copy(binding), source: copy(source), defenderId: b.defender.id, depotId: b.depot?.id || '', layout: copy(layout),
      station: { id, source: copy(source), energy: source.baselineEnergy, initialEnergy: source.baselineEnergy,
        standbySpent: 0, combatSpent: 0, contacts: [], duty: { id: `${id}:original-guard-duty`, phase: 'watch' },
        layout: { post: copy(layout.post), gate: copy(layout.structure), coverage: [layout.post, layout.service, layout.receiving].map(copy) } },
      home: { roomId: b.defender.roomId, cell: copy(b.defender.mapCell), locationId: b.defender.locationId },
      phase: 'uncontested', defenderPhase: 'guarding', claim: null, progress: 0, history: [], reports: [], observations: null,
      travel: null, pendingPulse: null, nextAttackAt: at + 2, nextMoveAt: at + 1, lastAt: at, nextNumber: 1 };
  }
  function normalize(s) {
    return Defense.validSource(s?.source) && s.worldId && s.runId && s.defenderId && s.layout?.roomId
      && Number.isFinite(s.station?.energy) && s.station.energy >= 0 && s.station.energy <= s.source.baselineEnergy
      && Number.isFinite(s.lastAt) && Array.isArray(s.history) && Array.isArray(s.reports) ? copy(s) : null;
  }
  function rebind(value, from, to) {
    const s = normalize(value); if (!s || s.worldId !== from?.worldId || s.runId !== from?.runId) return null;
    return { ...s, ...to };
  }
  const current = (s, b, c) => Boolean(s && c.source && c.worldId === s.worldId && c.runId === s.runId
    && ['cityId', 'charterId', 'institutionId', 'populationSourceId', 'installationId'].every(k => c.source[k] === s.source[k])
    && b?.defender.id === s.defenderId && b.source.charterId === s.source.charterId);
  const claiming = s => ['contested', 'held'].includes(s?.phase);
  const depotBlocked = (s, depotId) => Boolean(s?.phase === 'held' && s.claim?.heldAt != null && s.depotId && s.depotId === depotId);
  const operating = (s, c) => c.structurePresent && c.condition >= 25 && s.station.energy > 0;
  function witness(s, c, at, kind, targetId) {
    for (const witnessId of c.witnessIds || []) s.reports.push({ id: `${s.id}:conduct:${s.reports.length + 1}`,
      at, kind, targetId, witnessId, claimId: s.claim?.id || null, actorId: 'scientist', cityId: s.source.cityId, cell: copy(c.cell), communicated: c.observedWitnessIds?.includes(witnessId) || false });
  }
  function begin(s, b, c, at) {
    if (!current(s, b, c) || !c.alive || !c.capable || !c.local || !c.free || !c.observed || c.busy || claiming(s)) return false;
    s.claim = { id: `${s.id}:claim:${s.nextNumber++}`, at, bodyEpoch: c.bodyEpoch, heldAt: null, endedAt: null };
    s.phase = 'contested'; s.progress = 0;
    witness(s, c, at, 'hostileApproachClaim', s.id);
    if (c.witnessIds?.includes(b.defender.id)) s.hostileUntil = at + 30;
    return true;
  }
  function end(s, at, reason) {
    if (!claiming(s)) return false;
    s.phase = 'lost'; s.progress = 0; s.claim.endedAt = at; s.claim.reason = reason;
    s.history.push(copy(s.claim)); return true;
  }
  function bodyEnded(s, at) {
    if (!s) return false;
    s.pendingPulse = null;
    return end(s, at, 'The original scientist body died; a recovered body inherits neither physical control nor the departed body\'s position.');
  }
  function attack(s, b, c, at, targetId) {
    if (!c.local || !c.alive || !current(s, b, c)) return false;
    if (!claiming(s)) begin(s, b, { ...c, busy: false, observed: true }, at);
    witness(s, c, at, 'outerApproachAttack', targetId);
    if (c.defenderSeesScientist) s.hostileUntil = Math.max(s.hostileUntil || 0, at + 30); return true;
  }
  function absorb(s, b, c, amount, types, targetCell, at) {
    if (!current(s, b, c)) return { damage: amount, absorbed: 0 };
    return Defense.absorb(s.station, b.defender, { alive: c.alive, installationPresent: c.structurePresent, condition: c.condition,
      incapacitated: c.defenderIncapacitated, suppressed: c.suppressed, obligation: b.job || c.otherDuty, defenderWitness: c.defenderSeesScientist },
    { cell: targetCell, amount, damageTypes: types, hostile: true, lineOfEffect: c.attackLine }, at);
  }
  function personalAbsorb(s, a, amount, incapacitated = false) {
    if (!alive(a) || incapacitated) return { damage: amount, absorbed: 0 };
    const absorbed = Math.max(0, Math.min(amount, 24, a.wardMana || 0)); a.wardMana -= absorbed;
    return { damage: amount - absorbed, absorbed };
  }
  function observe(s, b, c, at) {
    if (!c.alive || !c.local || !(c.observed || c.defenderObserved || c.structureVisible || c.pulseVisible)) return false;
    s.observations = { at, phase: c.observed ? s.phase : 'approach status unverified', progress: c.observed ? s.progress : null, heldAt: s.claim?.heldAt || null,
      condition: c.structureVisible ? c.condition : null, defender: c.defenderObserved ? { id: b.defender.id, name: b.defender.name,
        status: b.defender.status, cell: copy(b.defender.mapCell) } : null,
      pendingPulse: c.pulseVisible ? copy(s.pendingPulse) : null, limits: LIMITS };
    return true;
  }
  function advance(s, b, at, context, h = {}) {
    if (!s || !Number.isFinite(at) || at <= s.lastAt || !context().alive) return false;
    while (s.lastAt < at && context().alive) {
      const bodilyDuty = alive(b.defender) && b.defender.workSeconds > 0 && b.defender.stamina > 1 && !b.job;
      const dt = Math.min(claiming(s) || s.pendingPulse || bodilyDuty ? 1 : at - s.lastAt, at - s.lastAt), now = s.lastAt + dt; s.lastAt = now;
      const c = context(), a = b.defender, valid = current(s, b, c), mobile = alive(a) && !c.defenderIncapacitated;
      if (operating(s, c)) { const used = Math.min(dt, s.station.energy); s.station.energy -= used; s.station.standbySpent += used; }
      if (claiming(s) && (!valid || !c.local || !c.capable || !c.free || s.claim.bodyEpoch !== c.bodyEpoch || c.departing))
        end(s, now, 'Actual presence, body, capability or original source no longer maintains the claim; no garrison remains.');
      const own = a.assignment === s.station.duty.id;
      // Original duties are not stolen. Only the unassigned original defender
      // can take this existing frontage duty; audience work remains exclusive.
      if (valid && mobile && !a.assignment && !b.job && a.workSeconds > 0 && a.stamina > 1) a.assignment = s.station.duty.id;
      const available = valid && mobile && a.assignment === s.station.duty.id && !b.job && !c.otherDuty && a.workSeconds > 0;
      if (!available || c.suppressed) s.pendingPulse = null;
      if (available && (a.health <= 20 || a.wardMana < 12 && a.stamina < 6)) s.defenderPhase = 'retreating';
      if (s.defenderPhase === 'retreating' && a.health > 35 && (a.wardMana >= 12 || a.stamina >= 20)) s.defenderPhase = 'guarding';
      if (available) {
        a.workSeconds = Math.max(0, a.workSeconds - dt);
        if (same(a.mapCell, s.layout.post) && Math.floor(now / 60) > Math.floor((now - dt) / 60)) a.stamina = Math.max(0, a.stamina - 1);
        if (claiming(s) && c.atBoth && c.defenderSeesScientist) s.hostileUntil = now + 30;
        const threatened = s.hostileUntil > now;
        if ((s.defenderPhase !== 'retreating' || c.distanceM <= 1) && threatened && c.defenderSeesScientist && c.distanceM <= 6) {
          if (s.pendingPulse && now >= s.pendingPulse.releaseAt) {
            const pulse = s.pendingPulse; s.pendingPulse = null; s.nextAttackAt = now + 4;
            if (!c.suppressed && same(c.cell, pulse.targetCell) && c.transitProgress === pulse.transitProgress && c.attackLine) h.pulse?.(18);
          } else if (!s.pendingPulse && now >= s.nextAttackAt && a.wardMana >= 12 && !c.suppressed) {
            a.wardMana -= 12; s.pendingPulse = { targetCell: copy(c.cell), transitProgress: c.transitProgress, releaseAt: now + 2 };
            h.telegraph?.(s.pendingPulse);
          } else if (!s.pendingPulse && now >= s.nextAttackAt && c.distanceM <= 1 && a.stamina >= 6) {
            a.stamina -= 6; s.nextAttackAt = now + 4; h.strike?.();
          }
        } else if (s.pendingPulse && now >= s.pendingPulse.releaseAt) { s.pendingPulse = null; s.nextAttackAt = now + 4; }
        // Hold the protected post; do not follow a baiting scientist out of the
        // city or abandon another assignment for a convenient duel.
        const goal = s.defenderPhase === 'retreating' ? s.home.cell : s.layout.post;
        if (now >= s.nextMoveAt && a.stamina > 1 && !same(a.mapCell, goal)) {
          if (h.move?.(a, goal)) a.stamina--; s.nextMoveAt = now + 1;
        }
        if (a.workSeconds <= 0 || a.stamina <= 1) a.assignment = null;
      } else if (own && !mobile) a.assignment = null;
      if (claiming(s)) {
        const canAct = mobile && s.defenderPhase !== 'retreating' && c.defenderCanContest && (available || c.otherDuty || b.job);
        const held = c.atBoth && c.clearAccess && !canAct && c.free && c.capable && !c.busy && !c.departing;
        s.progress = held ? Math.min(10, s.progress + dt) : 0;
        s.phase = s.progress >= 10 ? 'held' : 'contested';
        if (s.phase === 'held' && s.claim.heldAt == null) s.claim.heldAt = now;
      }
    }
    observe(s, b, context(), at); return true;
  }
  return { LIMITS, alive, same, create, normalize, rebind, current, claiming, depotBlocked, operating, begin, end, bodyEnded, attack, absorb, personalAbsorb, observe, advance };
});
