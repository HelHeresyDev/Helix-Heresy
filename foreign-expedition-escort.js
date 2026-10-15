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
  return { SCOPE, source, create, active, current, contactReason, decision, review, hire, control, advance };
});
