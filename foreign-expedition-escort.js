(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./expedition-escorts') : root.HelixExpeditionEscorts,
    node ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignExpeditionEscort = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Escorts, Survival) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const SCOPE = 'Personal protection during lawful nonliving field surveys in this named ground and adjacent sector only. No police powers, occupation, laboratory access, political allegiance, divine endorsement, extra passenger seat or guaranteed rescue.';
  const ADJOINING_SECONDS = 60;
  const ADJOINING_SCOPE = 'Extend personal survey protection and ordinary casualty assistance to this one personally reached adjoining patch only. Existing rate, wage reserve, duty, provisions, wounds and equipment continue unchanged. No hauling, building, station, garrison, title, extra seat or guaranteed rescue.';
  function source(city, standings, excursion) {
    if (!city?.assetId || city.cityId !== excursion?.source.cityId || city.assetId !== excursion.source.populationSourceId
      || !Number.isFinite(city.currentPopulation) || city.currentPopulation < 8 || city.physicalCondition === 'ruined'
      || ['abandoned', 'destroyed'].includes(city.habitationStatus)) return null;
    const e = [...(standings || [])].sort((a, b) => String(a.branch?.id).localeCompare(String(b.branch?.id))).find(e => e.network?.id && e.network.category === 'military'
      && e.branch?.id && e.branch.organizationForm === 'escortChapter' && e.branch.publicPhysicalPresence === true
      && (e.branch.currentCityId || e.branch.cityId) === city.cityId && ['licensed', 'chartered', 'recognized'].includes(e.standing)
      && e.branch.operationalStatus === 'active' && !['ruined', 'destroyed'].includes(e.branch.physicalCondition)
      && ['functional', 'strong', 'regionalHub'].includes(e.branch.capacityBand)
      && (e.network.roles || []).some(r => ['escortContracting', 'convoyForce', 'monsterResponse', 'perimeterDefense'].includes(r)));
    if (!e) return null;
    return { cityId: city.cityId, populationId: city.assetId, people: 1, branchId: e.branch.id, networkId: e.network.id,
      label: e.branch.publicName, restrictions: copy([...(e.network.clientRestrictions || []), ...(e.branch.clientRestrictions || [])]
        .filter(r => r.id && r.text)), prohibitions: copy(e.network.prohibitions || []), allocationId: `${e.branch.id}:field-survey-professional` };
  }
  function create(backing, excursion, seed, now) {
    if (!backing || !excursion?.wilderness || backing.cityId !== excursion.source.cityId || backing.populationId !== excursion.source.populationSourceId) return null;
    const s = { ...Escorts.defaultState(), source: copy(backing), quote: null, decisions: {}, received: null, dutySeconds: 12 * 3600, lastAt: now,
      layout: { groundRoomId: excursion.roomId, wildernessRoomId: excursion.wilderness.roomId, meeting: { x: 12, y: 10, z: excursion.entry.z }, gate: copy(excursion.wilderness.gate) } };
    s.actor = Escorts.candidate(seed, { id: backing.allocationId, label: backing.label });
    Object.assign(s.actor, { id: backing.allocationId, cityId: backing.cityId, kind: 'visitor', present: true, roomId: s.layout.groundRoomId, mapCell: copy(s.layout.meeting), affiliation: backing.label, needs: Survival.defaultState(now) });
    return s;
  }
  const active = s => ['active', 'returning'].includes(s?.contract?.status);
  const current = (s, c) => Boolean(c.source && ['cityId', 'populationId', 'branchId', 'networkId', 'allocationId'].every(k => c.source[k] === s.source[k]));
  function contactReason(s, c) {
    if (!s || !current(s, c)) return 'No current population-backed locally recognized escort chapter supports the original professional.';
    if (!c.alive || !c.capable || !c.originalBody || c.custody || !c.atGround || !c.near || !c.originalTrip || c.busy
      || s.actor.id !== s.source.allocationId || s.actor.status === 'dead' || !Number.isFinite(s.actor.health) || s.actor.health < 35 || c.escortIncapacitated) return 'Personally meet the same free capable scientist and original capable professional at the sampling ground.';
    return '';
  }
  function decision(s, c) {
    const key = JSON.stringify({ branchId: s.source.branchId, restrictions: c.source.restrictions, opposition: c.declaredOpposition });
    if (!s.decisions[key]) {
      const rule = c.source.restrictions.find(r => r.refusesDeclaredOpposition === true && c.declaredOpposition);
      s.decisions[key] = { branchId: s.source.branchId, accepted: !rule, reason: rule ? rule.text : 'Lawful survey protection only; paid service implies no support for opposition to the gods.', rule: rule ? copy(rule) : null };
    }
    return s.decisions[key];
  }
  function review(s, c, now) {
    if (contactReason(s, c) || active(s) || ['resting', 'paused'].includes(s.recovery?.status) || ['working', 'held'].includes(s.repair?.status)) return null;
    const willingness = decision(s, c); s.received = { at: now, willingness: copy(willingness), scope: SCOPE, prohibitions: copy(c.source.prohibitions) };
    if (!willingness.accepted) { s.quote = null; return null; }
    const refusal = Escorts.refusal(s.actor);
    if (refusal) { s.quote = null; s.received.reason = refusal; return null; }
    const price = Escorts.quote(s.budgetHours);
    if (s.dutySeconds < price.limitHours * 3600 + 300 || s.actor.needs?.exertion >= 80) { s.quote = null; s.received.reason = 'Original finite duty or endurance cannot support this contract and withdrawal margin.'; return null; }
    s.quote = { ...price, actorId: s.actor.id, cityId: s.source.cityId, branchId: s.source.branchId, bodyEpoch: c.bodyEpoch, visitId: c.visitId,
      tripId: c.tripId, scope: SCOPE, policy: JSON.stringify(c.source.restrictions), at: now, expiresAt: now + 60 };
    return copy(s.quote);
  }
  function hire(s, c, expected, wallet, now) {
    const q = s?.quote;
    if (!q || contactReason(s, c) || active(s) || ['resting', 'paused'].includes(s.recovery?.status) || ['working', 'held'].includes(s.repair?.status) || !Number.isFinite(now) || now < q.at || now >= q.expiresAt
      || JSON.stringify(q) !== JSON.stringify(expected) || q.bodyEpoch !== c.bodyEpoch || q.visitId !== c.visitId || q.tripId !== c.tripId
      || q.limitHours !== Escorts.quote(s.budgetHours).limitHours
      || q.policy !== JSON.stringify(c.source.restrictions) || s.dutySeconds < q.limitHours * 3600 + 300
      || !Number.isFinite(wallet?.money) || wallet.money < q.upfront || Escorts.refusal(s.actor) || !decision(s, c).accepted) return false;
    wallet.money -= q.upfront;
    s.contract = { ...Escorts.start(s.nextContract++, now, q.limitHours), id: `${s.actor.id}:contract-${s.nextContract - 1}`,
      bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId, scope: SCOPE, engagementReceived: q.fee };
    s.quote = null; s.lastAt = now; s.actor.order = 'follow'; s.actor.nextMoveAt = now + 1; s.actor.needs.lastAt = now;
    return true;
  }
  function control(s, c) {
    return Boolean(active(s) && c.alive && c.originalBody && !c.custody && c.local && s.contract.bodyEpoch === c.bodyEpoch
      && s.contract.visitId === c.visitId && s.contract.tripId === c.tripId);
  }
  function advance(s, c, now) {
    if (!s || !c.alive || now < s.lastAt) return false;
    const elapsed = now - s.lastAt; s.lastAt = now;
    if (!active(s)) return false;
    const end = Math.min(now, s.actor.status === 'dead' ? s.actor.diedAt : now);
    Escorts.accrue(s.contract, end);
    if (s.actor.status !== 'dead') s.dutySeconds = Math.max(0, s.dutySeconds - elapsed);
    if ((!control(s, c) || !current(s, c) || s.dutySeconds <= 300) && !s.contract.returnReason) {
      s.contract.status = 'returning'; s.contract.returnReason = !control(s, c) ? 'Original local scientist, body or visit no longer available; return to the agreed ground.'
        : !current(s, c) ? 'Original chapter backing is no longer available; finish safe withdrawal only.' : 'Original finite duty requires withdrawal.';
    }
    return elapsed > 0;
  }
  const adjoiningActive = s => ['working', 'held'].includes(s?.contract?.adjoining?.job?.status);
  const patchKey = p => p && JSON.stringify([p.id, p.parentSiteId, p.worldId, p.strategicCellId, p.roomId, p.bounds, p.seam, p.entry]);
  function adjoiningAuthorized(s, patch) {
    const a = s?.contract?.adjoining?.authorization, k = s?.contract;
    return Boolean(a && active(s) && a.actorId === s.actor?.id && a.branchId === s.source?.branchId && a.contractId === k.id
      && a.bodyEpoch === k.bodyEpoch && a.visitId === k.visitId && a.tripId === k.tripId && patchKey(a.patch) === patchKey(patch));
  }
  function adjoiningContactReason(s, c, now, working = false) {
    if (!s?.source || !current(s, c) || !control(s, c) || !c.capable || !c.originalTrip || !c.near || !c.atOriginal
      || c.escortIncapacitated || s.actor.id !== s.source.allocationId || s.actor.status === 'dead')
      return 'Personally reunite the original free capable body and professional on their original agreed ground.';
    if (!c.patch || !c.scouted || !Number.isFinite(c.patch.visitedAt) || !c.patch.observations?.length)
      return 'Personally reach and observe the adjoining patch, then return with its actual route and dated observations.';
    if (!Number.isFinite(now) || s.contract.status !== 'active' || s.contract.returnReason
      || now >= s.contract.startedAt + s.contract.limitHours * 3600 - (working ? 0 : ADJOINING_SECONDS)
      || s.dutySeconds - Math.max(0, now - s.lastAt) <= 300 + (working ? 0 : ADJOINING_SECONDS))
      return 'The original engagement needs remaining paid time and finite duty for consent and physical withdrawal.';
    if (!c.supported || c.busy || c.threatened || c.hauling || s.drag || s.actor.care || Escorts.refusal(s.actor))
      return 'Finish other work, self-care, casualty assistance and danger first; no unattended consent.';
    if (!decision(s, c).accepted) return decision(s, c).reason;
    return '';
  }
  function adjoiningReview(s, c, now) {
    if (adjoiningContactReason(s, c, now) || adjoiningActive(s) || adjoiningAuthorized(s, c.patch)) return null;
    const q = { actorId: s.actor.id, branchId: s.source.branchId, contractId: s.contract.id,
      bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId, patch: copy(c.patch), policy: JSON.stringify(c.source.restrictions),
      scope: ADJOINING_SCOPE, requiredSeconds: ADJOINING_SECONDS, hourly: s.contract.hourly, wageReserve: s.contract.wageReserve,
      startedAt: s.contract.startedAt, at: now, expiresAt: now + 60 };
    const a = s.contract.adjoining ||= { history: [] }; a.quote = q;
    return copy(q);
  }
  function adjoiningBegin(s, c, expected, taskId, now) {
    const a = s?.contract?.adjoining, q = a?.quote;
    if (!q || !taskId || adjoiningContactReason(s, c, now) || adjoiningActive(s) || adjoiningAuthorized(s, c.patch)
      || now < q.at || now >= q.expiresAt || JSON.stringify(q) !== JSON.stringify(expected)
      || q.actorId !== s.actor.id || q.contractId !== s.contract.id || q.branchId !== s.source.branchId
      || q.bodyEpoch !== c.bodyEpoch || q.visitId !== c.visitId || q.tripId !== c.tripId
      || q.policy !== JSON.stringify(c.source.restrictions) || JSON.stringify(q.patch) !== JSON.stringify(c.patch)
      || q.hourly !== s.contract.hourly || q.wageReserve !== s.contract.wageReserve || q.startedAt !== s.contract.startedAt) return false;
    if (a.job) a.history.push(copy(a.job));
    a.job = { ...copy(q), taskId, cell: copy(c.cell), actorCell: copy(s.actor.mapCell), roomId: c.roomId,
      status: 'working', progressSeconds: 0, lastAt: now, ready: true, reason: '' };
    a.quote = null; return true;
  }
  function adjoiningReason(s, c, now) {
    if (!adjoiningActive(s)) return 'No unfinished adjoining protection agreement.';
    const j = s.contract.adjoining.job, contact = adjoiningContactReason(s, c, now, true);
    if (contact) return contact;
    if (j.actorId !== s.actor.id || j.contractId !== s.contract.id || j.branchId !== s.source.branchId
      || j.bodyEpoch !== c.bodyEpoch || j.visitId !== c.visitId || j.tripId !== c.tripId
      || j.policy !== JSON.stringify(c.source.restrictions) || patchKey(j.patch) !== patchKey(c.patch)
      || j.hourly !== s.contract.hourly || j.wageReserve !== s.contract.wageReserve || j.startedAt !== s.contract.startedAt)
      return 'Original contract, person, body, visit, trip, published policy and named patch must remain unchanged.';
    if (j.roomId !== c.roomId || JSON.stringify(j.cell) !== JSON.stringify(c.cell)
      || JSON.stringify(j.actorCell) !== JSON.stringify(s.actor.mapCell)) return 'Both people must attend their original conversation positions; no remote acceptance.';
    return '';
  }
  function adjoiningAdvance(s, c, now) {
    if (!adjoiningActive(s) || !c.alive || !Number.isFinite(now) || now < s.contract.adjoining.job.lastAt) return 0;
    const j = s.contract.adjoining.job, dt = now - j.lastAt; j.lastAt = now;
    const blocked = adjoiningReason(s, c, now) || (!c.atHead ? 'Other work has the scientist’s attention.' : '');
    if (blocked) { j.status = 'held'; j.reason = blocked; j.ready = false; return 0; }
    j.status = 'working'; j.reason = '';
    if (!j.ready) { j.ready = true; return 0; }
    const added = Math.max(0, Math.min(dt, ADJOINING_SECONDS - j.progressSeconds)); j.progressSeconds += added;
    return added;
  }
  function adjoiningFinish(s, c, now) {
    if (!c.alive || !adjoiningActive(s) || adjoiningReason(s, c, now) || !c.atHead
      || now < s.contract.adjoining.job.lastAt || s.contract.adjoining.job.progressSeconds < ADJOINING_SECONDS) return false;
    const a = s.contract.adjoining; a.job.status = 'completed'; a.job.completedAt = now;
    a.authorization = { ...copy(a.job), at: now }; a.history.push(copy(a.authorization)); return true;
  }
  function adjoiningCancel(s, now) {
    if (!adjoiningActive(s)) return false;
    const j = s.contract.adjoining.job; j.status = 'cancelled'; j.cancelledAt = now;
    j.reason = 'No extended protection granted; original elapsed wages, duty and supplies remain spent.'; return true;
  }
  return { SCOPE, ADJOINING_SECONDS, ADJOINING_SCOPE, source, create, active, current, contactReason, decision, review, hire, control, advance,
    adjoiningActive, adjoiningAuthorized, adjoiningContactReason, adjoiningReview, adjoiningBegin, adjoiningReason, adjoiningAdvance, adjoiningFinish, adjoiningCancel };
});
