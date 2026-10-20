(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./city-confrontations') : root.HelixCityConfrontations);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixInstallationSeizure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Combat) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  const LIMITS = 'Hostile physical seizure of this counter and receiving position only. No lawful access order, abdication, appointment, forced clerical work, ownership transfer, army, divine approval, pardon or city control. Refuge guards have no assault commission. Original people, wounds, reserves, goods and witnessed conduct persist. Leaving supplies no invisible garrison.';
  const alive = a => a?.status === 'alive' && a.health > 0;
  const claiming = s => ['contested', 'held'].includes(s?.attempt?.phase);
  const dangerous = s => s?.combat?.phase === 'fighting';
  const running = s => Boolean(s?.attempt && (claiming(s) || ['withdrawing'].includes(s.attempt.phase)
    || Combat.active(s.combat) || s.staff.some(p => ['fleeing', 'returning'].includes(p.phase))));
  function create(succession, bargain, office, staff, site) {
    const combat = Combat.create(succession, bargain);
    if (!combat || !office?.civicCounter || office.id !== bargain.officeId || office.cityId !== bargain.source.cityId
      || !site?.installationId || site.roomId !== office.civicCounter.roomId || !same(site.counter, office.civicCounter.cell)
      || !site.receiving || !staff?.length || new Set(staff.map(a => a.id)).size !== staff.length) return null;
    return { id: `${site.installationId}:hostile-seizure`, cityId: office.cityId, officeId: office.id,
      charterId: bargain.source.charterId, defenderId: bargain.defender.id, site: copy(site), combat,
      staff: staff.map((a, i) => ({ id: a.id, home: copy(a.mapCell), locationId: a.locationId,
        refuge: { x: 14 - i, y: 12, z: site.counter.z }, phase: 'home', threatUntil: 0, nextMoveAt: 0 })),
      attempt: null, history: [], reports: [], inspections: [], receipts: [], handling: null, nextNumber: 1 };
  }
  function normalize(s) {
    return s?.site?.installationId && s.site.roomId && s.site.counter && s.site.receiving && s.defenderId
      && ['staff', 'receipts', 'history', 'reports', 'inspections'].every(k => Array.isArray(s[k]))
      && Combat.normalize(s.combat) ? copy(s) : null;
  }
  function current(s, b, office) {
    return Boolean(s && b?.source.cityId === s.cityId && b.officeId === s.officeId && b.source.charterId === s.charterId
      && b.defender.id === s.defenderId && office?.id === s.officeId && office.cityId === s.cityId
      && office.civicCounter?.roomId === s.site.roomId && same(office.civicCounter.cell, s.site.counter));
  }
  function record(s, c, at, kind, targetId, detail) {
    for (const witnessId of c.witnessIds || []) s.reports.push({ id: `${s.id}:report:${s.reports.length + 1}`,
      at, kind, targetId, actorId: 'scientist', witnessId, cityId: s.cityId, cell: copy(c.cell), detail,
      communicated: (c.visibleWitnessIds || []).includes(witnessId), finding: 'Witnessed conduct; no automatic guilt, arrest, conviction or immunity.' });
  }
  function engage(s, b, c, at) {
    const d = b.defender;
    if (!claiming(s) || Combat.active(s.combat) || !c.defenseAvailable || !c.defenderCanHear
      || !alive(d) || c.defenderIncapacitated || d.assignment) return false;
    const e = s.combat.encounter = { id: `${s.attempt.id}:defense:${s.combat.nextNumber++}`, objective: 'installationSeizure',
      startedAt: at, bodyEpoch: s.attempt.bodyEpoch, roomId: s.site.roomId, defenderPost: copy(d.mapCell), lastAt: at,
      nextAttackAt: at + 2, nextMoveAt: at + 1, abdication: 'notRequested', ceasefire: null, outcome: null };
    s.combat.phase = 'fighting'; s.combat.pendingPulse = null; d.assignment = e.id; return true;
  }
  function begin(s, b, office, c, at) {
    if (!current(s, b, office) || !c.alive || !c.capable || !c.local || !c.atCounter || !c.siteObserved || !c.free
      || !c.sourceCurrent || c.otherDefense || claiming(s) || Combat.active(s.combat) || c.lawfulControl) return false;
    s.attempt = { id: `${s.id}:attempt:${s.nextNumber++}`, at, lastAt: at, bodyEpoch: c.bodyEpoch, phase: 'contested', lotId: null,
      reason: 'Declared hostile seizure; actual access remains contested. No staff obedience or political authority follows.' };
    s.history.push(copy(s.attempt)); s.handling = null;
    record(s, c, at, 'hostileInstallationClaim', s.site.installationId, 'The scientist declared an attempt to seize this municipal installation.');
    for (const p of s.staff) if ((c.hearingStaffIds || []).includes(p.id)) { p.phase = 'fleeing'; p.threatUntil = at + 30; }
    engage(s, b, c, at); return true;
  }
  function cancelHandling(s, stacks, reason = 'Handling interrupted; no unit moved or refund supplied.') {
    const j = s?.handling; if (!j || j.status !== 'working') return false;
    const i = stacks.find(i => i.id === j.stackId); if (i?.reservedTaskId === j.id) i.reservedTaskId = j.inspection.reservation || '';
    j.status = 'interrupted'; j.reason = reason; return true;
  }
  function withdraw(s, b, c, stacks, at) {
    if (!claiming(s) || !c.alive || !c.capable || !c.local || s.attempt.bodyEpoch !== c.bodyEpoch) return false;
    cancelHandling(s, stacks); s.attempt.phase = 'withdrawing';
    s.attempt.reason = 'Abandoned seizure claim; actual withdrawal is still required. Original title, property and conduct remain.';
    Combat.ceasefire(s.combat, b, c, at); return true;
  }
  function inspect(s, c, i, at) {
    if (!claiming(s) || !c.alive || !c.capable || !c.local || !c.free || !c.lotVisible || !i || i.key !== 'metalParts'
      || i.cityOwnerId !== s.cityId || i.carriedBy || i.fixtureId || i.containerId
      || i.reservedTaskId && !(c.stockReservations || []).includes(i.reservedTaskId) || i.quantity < 1
      || i.roomId !== s.site.roomId || !same(i.cell, s.site.receiving) || s.attempt.bodyEpoch !== c.bodyEpoch
      || s.attempt.lotId && s.attempt.lotId !== i.id) return false;
    s.attempt.lotId = i.id;
    s.inspections.push({ attemptId: s.attempt.id, at, stackId: i.id, quantity: i.quantity, key: i.key, cityOwnerId: i.cityOwnerId,
      civicCustody: copy(i.civicCustody || null), reservation: i.reservedTaskId || '', cell: copy(i.cell), roomId: i.roomId }); return true;
  }
  function inspection(s) { return s.inspections.filter(r => r.attemptId === s.attempt?.id).at(-1); }
  function exact(i, r, reservation = r?.reservation || '') {
    return Boolean(i && r && i.id === r.stackId && i.quantity === r.quantity && i.key === r.key && i.cityOwnerId === r.cityOwnerId
      && JSON.stringify(i.civicCustody || null) === JSON.stringify(r.civicCustody) && i.roomId === r.roomId && same(i.cell, r.cell)
      && !i.carriedBy && !i.fixtureId && !i.containerId && (i.reservedTaskId || '') === reservation);
  }
  function take(s, c, stacks, at) {
    const r = inspection(s), i = stacks.find(i => i.id === r?.stackId);
    if (s.attempt?.phase !== 'held' || dangerous(s) || !c.alive || !c.capable || !c.local || !c.canHold || !c.free || !c.nearLot || !c.lotVisible
      || !c.carryOk || s.attempt.bodyEpoch !== c.bodyEpoch || s.handling?.status === 'working' || !exact(i, r)) return false;
    const id = `${s.attempt.id}:take:${s.nextNumber++}`;
    s.handling = { id, attemptId: s.attempt.id, bodyEpoch: c.bodyEpoch, stackId: i.id, inspection: copy(r), cell: copy(c.cell),
      progress: 0, required: 10, lastAt: at, status: 'working' };
    i.reservedTaskId = id; return true;
  }
  function attack(s, b, c, stacks, at, targetId, actionId) {
    if (!s?.attempt || !c.alive || !c.local || !claiming(s) && !Combat.active(s.combat)) return false;
    cancelHandling(s, stacks);
    if (![s.defenderId, s.site.installationId, ...s.staff.map(p => p.id)].includes(targetId)) return false;
    record(s, c, at, 'installationAttack', targetId, `Observed ${actionId} during the hostile installation encounter.`);
    if (Combat.active(s.combat)) Combat.attack(s.combat, b, { ...c, witnessIds: [] }, at, actionId);
    return true;
  }
  function advance(s, b, office, c, stacks, at, h = {}) {
    if (!s?.attempt || !c.alive || !Number.isFinite(at) || at <= s.attempt.lastAt) return false;
    s.attempt.lastAt = at;
    if (claiming(s) && (!current(s, b, office) || !c.sourceCurrent || c.bodyEpoch !== s.attempt.bodyEpoch || !c.capable || !c.inHoldingArea)) {
      s.attempt.phase = 'lost'; s.attempt.reason = 'Actual presence/capability no longer maintains this claim; there is no invisible garrison.';
      cancelHandling(s, stacks);
    }
    engage(s, b, c, at);
    Combat.advance(s.combat, null, b, { ...c, installationCurrent: current(s, b, office) && c.sourceCurrent }, at, h);
    if (h.alive && !h.alive()) return true;
    if (claiming(s)) {
      s.attempt.phase = c.canHold ? 'held' : 'contested';
      s.attempt.reason = c.canHold ? 'Current physical access held only; original ownership, offices and consent remain unchanged.'
        : 'Actual occupants, a capable defender or unavailable access still contest the installation.';
    }
    if (s.attempt.phase === 'withdrawing' && !c.inHoldingArea) s.attempt.phase = 'withdrawn';
    for (const p of s.staff) {
      const a = h.person?.(p.id); if (!a) continue;
      if (!alive(a) || h.incapacitated?.(a)) { p.phase = alive(a) ? 'stranded' : 'dead'; continue; }
      if (claiming(s) && (c.hearingStaffIds || []).includes(p.id)) { p.phase = 'fleeing'; p.threatUntil = at + 30; }
      if (!claiming(s) && at >= p.threatUntil && !dangerous(s)) p.phase = same(a.mapCell, p.home) ? 'home' : 'returning';
      const goal = p.phase === 'fleeing' ? p.refuge : p.phase === 'returning' ? p.home : null;
      if (goal && (a.workSeconds < 1 || a.physicalControl?.stamina < 1)) { p.phase = 'stranded'; continue; }
      if (!goal || same(a.mapCell, goal) || at < p.nextMoveAt) continue;
      if (h.move?.(a, goal)) { a.workSeconds = Math.max(0, a.workSeconds - 1); if (a.physicalControl) a.physicalControl.stamina--;
        a.locationId = same(a.mapCell, p.home) ? p.locationId : `${s.id}:displaced`; }
      p.nextMoveAt = at + 1.5;
      if (p.phase === 'returning' && same(a.mapCell, p.home)) p.phase = 'home';
    }
    const j = s.handling;
    if (j?.status === 'working') {
      const i = stacks.find(i => i.id === j.stackId);
      if (s.attempt.phase !== 'held' || dangerous(s) || !c.capable || !c.canHold || !c.free || !c.nearLot || !c.lotVisible || !c.carryOk
        || c.bodyEpoch !== j.bodyEpoch || !same(c.cell, j.cell) || !exact(i, j.inspection, j.id)) cancelHandling(s, stacks);
      else {
        j.progress += Math.min(Math.max(0, at - j.lastAt), j.required - j.progress); j.lastAt = at;
        if (j.progress >= j.required) {
          const receipt = h.carry?.(i, j);
          if (receipt) { j.status = 'completed'; s.receipts.push({ id: j.id, at, attemptId: s.attempt.id,
            sourceStackId: j.stackId, carriedStackId: receipt.id, quantity: 1, legalOwnerId: s.cityId, originalCustody: copy(j.inspection.civicCustody) });
            record(s, c, at, 'seizedMunicipalGoods', j.stackId, 'The scientist physically took one city-owned maintenance unit; legal title did not change.'); }
          else cancelHandling(s, stacks, 'Actual handling or carrying capacity failed; original stock remains.');
        }
      }
    }
    const history = s.history.find(r => r.id === s.attempt.id); if (history) Object.assign(history, copy(s.attempt));
    return true;
  }
  function publicView(s, c, at) {
    if (!s?.attempt || !c.siteObserved || !c.local || !c.alive) return null;
    return copy({ at, attemptId: s.attempt.id, phase: s.attempt.phase, reason: s.attempt.reason,
      site: s.site, reports: s.reports.filter(r => r.communicated), inspections: s.inspections.filter(r => r.attemptId === s.attempt.id),
      receipts: s.receipts, handling: s.handling, pendingPulse: c.defenderObserved ? s.combat.pendingPulse : null,
      defenderEncounter: c.defenderObserved ? s.combat.phase : 'not currently observed', limits: LIMITS });
  }
  return { LIMITS, alive, claiming, dangerous, running, create, normalize, current, begin, engage, withdraw, inspect, inspection, take, attack, cancelHandling, advance, publicView };
});
