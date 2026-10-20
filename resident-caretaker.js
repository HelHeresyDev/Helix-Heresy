(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixResidentCaretaker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Survival) {
  'use strict';
  const DAY = 86400, SHIFT = 28800, RESERVE = 576, FEE = 40;
  const copy = x => JSON.parse(JSON.stringify(x));
  const active = s => Boolean(s?.resident && !['completed', 'fatality'].includes(s.resident.phase));
  const contact = c => c.alive && c.capable && !c.custody && c.near && !c.busy;
  const policy = c => JSON.stringify([c.source?.restrictions, c.source?.prohibitions]);
  const note = (r, at, text) => { r.log.push({ at, text }); r.log = r.log.slice(-100); };
  const SCOPE = 'One original consenting noncombat resident caretaker at the inspected refuge. Three days from arrival: eight paid hours followed by sixteen off duty daily, 24/hour, 576 prepaid wages plus 40 for the accompanied outward and physical return journeys. Paid scheduled hours include support-related waiting/rest; no automatic renewal. Personally supplied original sleeping kit, actual food, water and designated crate fuel only. Tend the original fuel-mode heater within its existing settings; no repairs, construction, extraction, guard, unrelated property or remote orders. Original injuries, duty, provisions and tool custody persist. Eight supported rest hours restore at most eight duty hours, never health or goods. Shortage/danger ends work and prompts physical withdrawal if feasible; no rescue guarantee. Earned wages remain owed; unused escrow is returned only at personal settlement after physical return. Accepted safe work continues during employer absence/custody. Resurrection does not erase obligations; new instructions require personal recognition.';
  function refusal(s, c) {
    if (!s || active(s) || s.role !== 'builder' || s.phase !== 'completed' || s.contract?.settledAt == null || !c.toolsReturned)
      return 'Finish and settle the original commission and return every borrowed tool before a separate resident agreement.';
    if (['resting', 'paused'].includes(s.recovery?.status)) return 'Finish the existing off-duty arrangement first.';
    if (!c.source || !['cityId', 'populationId', 'providerId', 'allocationId'].every(k => s.source[k] === c.source[k])) return 'The original provider must support this same allocated person.';
    const rule = c.source.restrictions?.find(r => r.refusesDeclaredOpposition || r.forbidsWildernessWork || r.forbidsPrivateConstruction || r.forbidsResidentWork);
    if (rule || c.source.prohibitions?.length) return rule?.text || 'The provider does not permit the disclosed resident arrangement.';
    if (s.actor.id !== s.source.allocationId || s.actor.status === 'dead' || s.actor.health < 60 || c.incapacitated
      || s.dutySeconds <= 300 || ['hunger', 'thirst', 'exertion', 'exposure'].some(k => s.actor.needs[k] >= 80)) return 'The original person needs care or supported rest before accepting.';
    if (!c.plan || !c.routeOk || !c.supported || !c.fuelUsable || !c.stocked || !c.kitId || !c.provisions || c.threatened) return 'Inspect the complete supplied refuge with a fault-free fuel-mode heater, provide an original carried sleeping kit and travel provisions, and disclose the actual reachable route without immediate danger.';
    return '';
  }
  function review(s, c, now) {
    if (!s || !contact(c) || !c.originalBody || !c.originalTrip || !c.atGround || !Number.isFinite(now)) return null;
    s.residentQuote = null; const reason = refusal(s, c);
    s.residentReply = { at: now, text: reason || SCOPE }; if (reason) return null;
    return copy(s.residentQuote = { at: now, expiresAt: now + 300, actorId: s.actor.id, bodyEpoch: c.bodyEpoch,
      plan: copy(c.plan), kitId: c.kitId, policy: policy(c), reserve: RESERVE, fee: FEE, upfront: RESERVE + FEE, scope: SCOPE });
  }
  function accept(s, c, expected, wallet, now) {
    const q = s?.residentQuote;
    if (!q || !Number.isFinite(now) || !contact(c) || !c.originalBody || !c.originalTrip || !c.atGround || refusal(s, c) || now < q.at || now >= q.expiresAt
      || JSON.stringify(q) !== JSON.stringify(expected) || q.bodyEpoch !== c.bodyEpoch || q.kitId !== c.kitId
      || q.policy !== policy(c) || JSON.stringify(q.plan) !== JSON.stringify(c.plan) || !Number.isFinite(wallet?.money) || wallet.money < q.upfront) return false;
    if (s.resident) (s.residentHistory ||= []).push(copy(s.resident));
    wallet.money -= q.upfront; s.actor.money = (s.actor.money || 0) + FEE;
    s.resident = { ...copy(q), id: `${s.actor.id}:resident-${(s.residentHistory?.length || 0) + 1}`, phase: 'accompanying',
      signedAt: now, lastAt: now, arrivedAt: null, endsAt: null, earned: 0, restSeconds: 0, deployed: false,
      service: null, reason: '', log: [], report: null, recognizedBodyEpoch: c.bodyEpoch };
    s.residentQuote = null; s.quote = null; s.proposal = null; s.actor.needs.lastAt = now;
    note(s.resident, now, 'Separate resident terms accepted; same original person must physically walk with the scientist.'); return true;
  }
  function withdraw(s, now, reason) {
    if (!active(s) || !Number.isFinite(now) || ['returning', 'awaitingSettlement'].includes(s.resident.phase)) return false;
    const r = s.resident; r.phase = 'returning'; r.service = null; r.reason = reason; note(r, now, reason); return true;
  }
  function authorized(s, c) { return Boolean(s?.resident && s.actor.id === s.resident.actorId && contact(c) && c.bodyEpoch === s.resident.recognizedBodyEpoch); }
  function acceptWaterPoint(s, c, offer, now) {
    if (!active(s) || s.resident.phase !== 'resident' || !authorized(s, c) || c.threatened
      || !c.waterPointInspected || !offer?.fixtureId || !offer.port || !offer.route?.length || !Number.isFinite(now)) return false;
    s.resident.waterAccess = copy(offer);
    note(s.resident, now, 'Accepted optional original purifier drinking access and its walking route only; no collection, treatment, wages, renewal or wider work authorized.'); return true;
  }
  function receive(s, c, now) {
    if (!s?.resident || s.actor.id !== s.resident.actorId || !Number.isFinite(now) || !contact(c) || s.actor.status === 'dead') return false;
    const r = s.resident;
    r.report = copy({ at: now, actorId: s.actor.id, phase: r.phase, reason: r.reason, earned: r.earned,
      needs: s.actor.needs, dutySeconds: s.dutySeconds, deployed: r.deployed, service: r.service, log: r.log }); return true;
  }
  function recognize(s, c, now) {
    if (!active(s) || s.actor.id !== s.resident.actorId || !Number.isFinite(now) || !contact(c) || !c.recognizedIdentity) return false;
    s.resident.recognizedBodyEpoch = c.bodyEpoch; note(s.resident, now, 'Personally recognized the returning scientist; outstanding obligations remain.'); return true;
  }
  function settle(s, c, wallet, now) {
    const r = s?.resident;
    if (!r || !Number.isFinite(now) || !Number.isFinite(wallet?.money) || r.phase !== 'awaitingSettlement' || !authorized(s, c) || !c.atGround || r.settledAt != null) return false;
    r.refund = RESERVE - Math.ceil(r.earned - 1e-8); wallet.money += r.refund;
    s.actor.money = Math.round((s.actor.money + Math.ceil(r.earned - 1e-8) - r.earned) * 1e8) / 1e8; r.earned = Math.ceil(r.earned - 1e-8);
    r.phase = 'completed'; r.settledAt = now; s.lastAt = now; s.actor.needs.lastAt = now;
    note(r, now, `Physical settlement; ${r.refund} unused wages refunded once. Goods and bodily condition retained.`); return true;
  }
  // Hooks perform the ordinary physical operations. A service token identifies
  // the exact source/fixture; changed targets discard attendance, never backfill.
  function service(r, kind, token, seconds, at, finish) {
    if (!r.service || r.service.kind !== kind || r.service.token !== token) r.service = { kind, token, progress: 0, lastAt: at };
    const j = r.service;
    if (j.lastAt < at) { j.progress++; j.lastAt = at; }
    if (j.progress < seconds) return false;
    if (!finish()) { r.service = null; return false; }
    r.service = null; note(r, at, `${kind}: original physical operation completed.`); return true;
  }
  function advance(s, now, h) {
    if (!active(s) || !h.alive || !Number.isFinite(now) || now <= s.resident.lastAt) return 0;
    const r = s.resident; let damage = 0;
    while (r.lastAt + 1 <= now && active(s)) {
      const at = ++r.lastAt, c = h.context(at), a = s.actor;
      if (a.id !== r.actorId) { r.service = null; r.reason = 'Original resident identity unavailable; no substitute person, wages or work.'; continue; }
      if (a.status === 'dead' || a.health - damage <= 0) { r.phase = 'fatality'; r.service = null; note(r, at, 'Original worker died; goods and unspent escrow remain for recovery.'); break; }
      const shift = r.arrivedAt != null && at > r.arrivedAt && at <= r.endsAt && (at - r.arrivedAt - 1) % DAY < SHIFT;
      if (shift && !['returning', 'awaitingSettlement'].includes(r.phase)) {
        const earned = Math.min(RESERVE, r.earned + 24 / 3600); a.money = (a.money || 0) + earned - r.earned; r.earned = earned;
      }
      const resting = c.atSleep && c.sleepUsable && r.deployed && !c.threatened && (!shift || s.dutySeconds <= 300);
      const n = Survival.advance(a.needs, at, { destination: c.destination, sheltered: c.sheltered, resting,
        working: !resting && !['awaitingSettlement'].includes(r.phase), temperatureAt: c.temperatureAt }); a.needs = n.state; damage += n.damage;
      if (r.phase === 'resident' && !resting) s.dutySeconds = Math.max(0, s.dutySeconds - 1);
      if (r.arrivedAt != null && at >= r.endsAt) withdraw(s, at, 'Three-day resident agreement ended; no automatic renewal.');
      if (c.threatened || a.health - damage < 35 || c.providerRefusal) withdraw(s, at, c.providerRefusal || 'Danger or serious injury requires withdrawal.');
      if (c.incapacitated || a.health - damage <= 10) { r.service = null; r.reason = 'Incapacitated: actual person and possessions remain; no automatic evacuation.'; continue; }
      const care = a.needs.thirst >= 45 ? 'drinkingWater' : a.needs.hunger >= 45 ? 'trailMeal' : null;
      if (care && h.carried(care)) {
        const i = h.carried(care); service(r, 'consume', i.id, 20, at, () => h.consume(i.id, care)); continue;
      }
      if (care === 'drinkingWater' && r.phase === 'resident' && h.waterPoint?.()) {
        const point = h.waterPoint();
        if (!c.atWaterPoint) { r.service = null; h.move(point.port, at); }
        else service(r, 'drink original tank', point.fixtureId, 20, at, () => h.drinkTank(at));
        continue;
      }
      if (r.phase === 'awaitingSettlement') { r.service = null; continue; }
      if (r.phase === 'returning') {
        r.service = null; r.restSeconds = 0;
        if (c.atHome) { r.phase = 'awaitingSettlement'; note(r, at, 'Physically returned to the original defended meeting point.'); }
        else if (s.dutySeconds <= 0) r.reason = 'Exhausted on the actual withdrawal route; assistance or physical provisions/rest needed.';
        else { s.dutySeconds = Math.max(0, s.dutySeconds - 1); if (!h.move(r.plan.home, at)) r.reason = 'Withdrawal route obstructed; original person and goods remain stranded.'; }
        continue;
      }
      if (r.phase === 'accompanying') {
        r.service = null;
        if (!c.accompanied) { r.reason = 'Waiting for the personally accompanying scientist; no remote march.'; continue; }
        r.reason = 'Walking personally accompanied along the agreed physical route.';
        if (c.atSleep) { r.phase = 'resident'; r.arrivedAt = at; r.endsAt = at + 3 * DAY; note(r, at, 'Physically arrived at the agreed refuge; resident calendar starts now.'); }
        else if (s.dutySeconds > 300) { s.dutySeconds--; h.move(r.plan.sleep, at); }
        else withdraw(s, at, 'Outward travel exhausted the safe duty margin.');
        continue;
      }
      if (!c.supported) { withdraw(s, at, 'The original shelter, sleeping kit, crate or fuel heater is unusable; resident work ends.'); continue; }
      r.reason = !shift || s.dutySeconds <= 300 ? 'Off duty or recovering finite duty at the supplied sleeping place.'
        : 'On paid duty: original heater and designated local supplies only.';
      if (care || !h.available('drinkingWater') || !h.available('trailMeal')) {
        const key = care || (!h.available('drinkingWater') ? 'drinkingWater' : 'trailMeal');
        if (!h.carried(key)) {
          const i = h.supply(key);
          if (!i) { withdraw(s, at, `Actual ${key} unavailable; no resupply or bodily reset.`); continue; }
          if (!c.atCrate) { r.service = null; h.move(r.plan.cratePort, at); }
          else service(r, 'collect', i.id, 10, at, () => h.take(i.id));
          continue;
        }
      }
      if (!r.deployed) {
        if (!c.atSleep) { r.service = null; h.move(r.plan.sleep, at); }
        else service(r, 'deploy sleeping kit', r.kitId, 120, at, () => { if (!h.deploy()) return false; r.deployed = true; return true; });
        continue;
      }
      if (c.doorOpen && !c.doorwayBusy) {
        if (!c.atDoorControls) { r.service = null; h.move(r.plan.doorPort, at); }
        else service(r, 'close refuge door', r.plan.doorId, 10, at, () => h.closeDoor());
        continue;
      }
      if (!shift || s.dutySeconds <= 300) {
        r.service = null;
        if (!c.atSleep) { h.move(r.plan.sleep, at); }
        else if (resting && a.needs.thirst < 70 && a.needs.hunger < 85) {
          if (++r.restSeconds >= SHIFT) { s.dutySeconds = Math.max(s.dutySeconds, SHIFT); r.restSeconds = 0; }
        }
        continue;
      }
      r.restSeconds = 0;
      if (!c.fuelUsable) { withdraw(s, at, 'Original fuel-mode heater fault or changed operating mode requires separate attention.'); continue; }
      if (c.fuel < .1) {
        const i = h.carried('fuelReagent');
        if (!i) {
          const source = h.supply('fuelReagent');
          if (!source) { withdraw(s, at, 'Designated physical fuel exhausted; no automatic purchase or refill.'); continue; }
          if (!c.atCrate) { r.service = null; h.move(r.plan.cratePort, at); }
          else service(r, 'collect', source.id, 10, at, () => h.take(source.id));
        } else if (!c.atControls) { r.service = null; h.move(r.plan.controls, at); }
        else service(r, 'load fuel', `${i.id}:${r.plan.heaterId}`, 60, at, () => h.fuel(i.id, at));
      } else if (!c.enabled) {
        if (!c.atControls) { r.service = null; h.move(r.plan.controls, at); }
        else service(r, 'enable heater', r.plan.heaterId, 10, at, () => h.enable(at));
      } else {
        r.service = null; r.reason = 'Agreed heater supplied; on-duty standby, not free repairs or other work.';
        if (!c.atSleep) h.move(r.plan.sleep, at);
      }
    }
    return damage;
  }
  return { DAY, SHIFT, RESERVE, FEE, SCOPE, active, contact, refusal, review, accept, authorized, acceptWaterPoint, receive, recognize, settle, withdraw, advance };
});
