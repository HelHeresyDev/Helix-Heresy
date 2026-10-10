(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityAdministration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const registry = Theme.createRegistry([{ id: 'administration.shared.counter-upkeep', kind: 'cityAdministration', compatibility: 'shared',
    template: 'Supplied local civic service and staffed recovery', contentTags: ['science', 'survival'], fallback: true }]);
  const PERIOD = 86400, GRACE = 28800, REST = 28800, WORK = 120, PARTS = 3, POWER_CAP = 12;
  const WORK_CELL = Object.freeze({ x: 16, y: 8, z: 6 });
  const RECEIVING = Object.freeze({ x: 16, y: 12, z: 6 });
  const LIMITS = 'This existing municipal counter only, not citywide defense, a repaired wall, personal ward recharge, a new army, immunity, divine approval or joint-stronghold command. Historical recognition survives service interruption. Institutional resistance remains separate.';
  const living = a => a?.status === 'alive' && a.health >= 50;
  const able = a => living(a) && (a.fatigue || 0) < 80;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cellSame = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
  const clean = i => i.quantity >= 1 && !i.fixtureId && !i.containerId && !i.toolInstanceId && !i.tags?.includes('contaminated');
  function worker(s, succession) { return succession?.leaders.find(a => a.id === s?.workerId); }
  function staff(succession, bargain, office) { return [...(succession?.leaders || []), bargain?.representative, bargain?.defender, office?.clerk].filter(Boolean); }
  function create(succession, bargain, office, options = {}) {
    const actor = succession?.leaders.find(a => a.roles.includes('publicWorksAndProvisioning'));
    if (!succession?.handover || succession.control?.recognizedAuthorityId !== 'scientist' || !actor
      || !succession.agreements.some(a => a.personId === actor.id) || office?.id !== succession.officeId
      || office.cityId !== succession.source.cityId || !office.clerk?.id || !office.civicCounter?.cell || bargain?.officeId !== office.id) return null;
    const content = Theme.selectContent(registry, { kind: 'cityAdministration', worldTheme: options.theme || 'madcap', seed: office.id, required: true });
    if (!content.ok) return null;
    const at = succession.handover.at;
    return { id: `${succession.id}:administration`, definitionId: content.definitionId, sourceTheme: content.sourceTheme,
      cityId: office.cityId, charterId: succession.source.charterId, officeId: office.id, clerkId: office.clerk.id, handoverId: succession.handover.id, workerId: actor.id,
      installation: { id: `${office.id}:service-channel`, label: 'Existing municipal counter service channel', cell: copy(office.civicCounter.cell),
        workCell: copy(WORK_CELL), basis: 'Existing active civil-records counter; no new generator or city fortification.' },
      dueAt: at + PERIOD, graceUntil: at + PERIOD + GRACE, servicedAt: null, inspection: null, job: null, rests: [],
      workCaps: Object.fromEntries(staff(succession, bargain, office).map(a => [a.id, a === office.clerk ? 14400 : succession.leaders.includes(a) ? 1800 : 3600])),
      receipts: [], history: [], message: '', nextNumber: 1, lastAt: at };
  }
  const normalize = s => s?.installation?.id && s?.handoverId && Array.isArray(s.rests) && s.workCaps ? copy(s) : null;
  function note(s, at, kind, text) { s.history.push({ at, kind, text }); s.history = s.history.slice(-40); s.message = text; }
  function status(s, at) { return !s ? 'unbound' : at >= s.graceUntil ? 'offline' : at >= s.dueAt ? 'due' : 'operational'; }
  function applyService(s, office, at) { if (s && office?.id === s.officeId) office.maintenanceReady = status(s, at) !== 'offline'; }
  function supported(s, succession, office, c) {
    return Boolean(s && office?.id === s.officeId && office.cityId === s.cityId && office.active
      && office.clerk?.id === s.clerkId && cellSame(office.civicCounter?.cell, s.installation.cell)
      && succession?.handover?.id === s.handoverId && succession.control?.recognizedAuthorityId === 'scientist'
      && succession.source.charterId === s.charterId && succession.agreements.some(a => a.personId === s.workerId)
      && c.charterCurrent && c.administrationAvailable && c.publicWorksAvailable && c.geometryAvailable);
  }
  function localReason(s, succession, office, c) {
    if (!supported(s, succession, office, c)) return 'The original charter, recognized authority and physically supported administration and public-works branch are required.';
    if (!c.alive || !c.capable || !c.atCounter || !c.visitPermission || !c.clerkPresent || !c.lineOfSight || !c.workerPresent || c.busy
      || c.cityId !== s.cityId || c.bodyEpoch !== succession.control.bodyEpoch) return 'Attend the original civic counter and named public-works official in the authenticated body, capable and free of other work.';
    if (!living(office.clerk)) return 'The original civic clerk is unavailable; no replacement or free staff is invented.';
    return '';
  }
  function inspect(s, succession, office, c, at) {
    if (localReason(s, succession, office, c) || !able(worker(s, succession)) || !able(office.clerk)
      || office.assignment || worker(s, succession)?.assignment) return false;
    s.inspection = { at, workerId: s.workerId, installationId: s.installation.id, handoverId: s.handoverId, charterId: s.charterId,
      dueAt: s.dueAt, graceUntil: s.graceUntil, parts: PARTS, workSeconds: WORK, periodSeconds: PERIOD, graceSeconds: GRACE,
      power: 'One physically delivered relay battery supplies up to twelve counter operations, capped at twelve; it does not override an external outage.',
      shifts: 'One sealed food-and-water provision pack per existing person funds eight uninterrupted off-duty hours. Recovery restores only bounded duty work and fatigue, never injuries, health or ward energy.' };
    note(s, at, 'inspection', 'The named public-works official inspected the existing counter: three parts and two minutes of local work maintain one service period, with an eight-hour grace period.'); return true;
  }
  function order(s, succession, bargain, office, stacks, expected, c, at) {
    const a = worker(s, succession);
    if (localReason(s, succession, office, c) || !s.inspection || !same(expected, s.inspection) || s.inspection.dueAt !== s.dueAt
      || s.job || !able(a) || a.assignment || office.assignment || succession.job || succession.directive?.status === 'carrying'
      || !c.externalPowered || office.power < 1 || office.workSeconds < 30 || a.workSeconds < WORK + 60
      || s.servicedAt != null && at < s.dueAt) return false;
    const staged = stacks.find(i => i.key === 'metalParts' && clean(i) && i.quantity >= PARTS && i.cityOwnerId === s.cityId
      && i.civicCustody?.cityId === s.cityId && i.reservedTaskId === `${succession.id}:city-maintenance-reserve`
      && !i.carriedBy && cellSame(i.cell, RECEIVING));
    const source = staged ? { kind: 'stack', id: staged.id, cell: copy(staged.cell), reservation: staged.reservedTaskId }
      : succession.provision.stock >= PARTS && !succession.provision.reservedBy && able(bargain.defender) && bargain.defender.workSeconds >= 1
        && bargain.defender.mapCell && bargain.defender.locationId === s.officeId && !bargain.defender.assignment
        ? { kind: 'reserve', custodianId: bargain.defender.id, cell: { ...bargain.defender.mapCell, y: bargain.defender.mapCell.y - 1 } } : null;
    if (!source) return false;
    const id = `${s.id}:service:${s.nextNumber++}`;
    s.job = { id, status: 'collecting', authorizedAt: at, terms: copy(expected), workerId: a.id, source, cargo: null, progress: 0, lastAt: at, walkCredit: 0, wasReady: true };
    if (staged) staged.reservedTaskId = id; else succession.provision.reservedBy = id;
    a.assignment = id;
    office.power--; office.workSeconds -= 30; a.workSeconds -= 30;
    note(s, at, 'order', 'Authorized exact inspected local upkeep. Existing parts remain at their source until the named worker physically collects them; supplied staff can continue while you are away.'); return true;
  }
  function cancel(s, succession, office, stacks, c, at) {
    if (localReason(s, succession, office, c) || !s.job || s.job.cargo) return false;
    const j = s.job, a = worker(s, succession), item = stacks.find(i => i.id === j.source.id);
    if (item?.reservedTaskId === j.id) item.reservedTaskId = j.source.reservation;
    if (succession.provision.reservedBy === j.id) delete succession.provision.reservedBy;
    if (a?.assignment === j.id) a.assignment = null;
    s.job = null; note(s, at, 'cancelled', 'Cancelled before collection. Original supplies remain in city custody; spent walking work is not refunded.'); return true;
  }
  function handSupply(s, succession, bargain, office, stacks, key, c, at) {
    if (localReason(s, succession, office, c) || !['metalParts', 'relayBattery'].includes(key)) return false;
    const a = key === 'metalParts' ? bargain.defender : office.clerk;
    const duty = a === office.clerk ? office : a;
    if (!able(a) || a.assignment || duty.assignment || duty.workSeconds < 30 || key === 'metalParts' && (!c.receiverPresent || a.locationId !== s.officeId)
      || key === 'relayBattery' && office.power >= POWER_CAP
      || key === 'metalParts' && succession.provision.stock >= 18) return false;
    const item = stacks.find(i => i.key === key && clean(i) && i.carriedBy === 'scientist' && !i.reservedTaskId && !i.cityOwnerId);
    if (!item) return false;
    const n = key === 'relayBattery' ? 1 : Math.min(Math.floor(item.quantity), 18 - succession.provision.stock);
    item.quantity -= n; item.knownQuantity = Math.min(item.knownQuantity ?? item.quantity, item.quantity);
    duty.workSeconds -= 30;
    const id = `${s.id}:delivery:${s.nextNumber++}`, receipt = { id, at, key, quantity: n, stackId: item.id, custodianId: a.id };
    if (key === 'relayBattery') { receipt.suppliedOperations = POWER_CAP - office.power; office.power = POWER_CAP; }
    else { succession.provision.stock += n; succession.provision.receipts.push({ id, at, quantity: n, purpose: 'upkeepReplacement',
      manifest: [{ stackId: item.id, key, quantity: n }], custodianId: a.id }); }
    s.receipts.push(receipt); note(s, at, 'delivery', `Received ${n} actual carried ${key}; no remote purchase, refund, new population or restored health.`); return true;
  }
  function rest(s, succession, bargain, office, stacks, personId, c, at) {
    if (localReason(s, succession, office, c)) return false;
    const a = staff(succession, bargain, office).find(a => a.id === personId), duty = a === office.clerk ? office : a;
    const pausedJob = a?.id === s.workerId && s.job && a.assignment === s.job.id;
    if (!living(a) || !Number.isFinite(s.workCaps[a.id]) || a.assignment && !pausedJob || duty.assignment && !pausedJob || !c.staffPresentIds?.includes(a.id) || s.rests.some(r => r.personId === a.id)
      || !(duty.workSeconds < s.workCaps[a.id] || (a.fatigue || 0) > 0)) return false;
    const item = stacks.find(i => i.key === 'fieldRation' && clean(i) && i.carriedBy === 'scientist' && !i.reservedTaskId && !i.cityOwnerId);
    if (!item) return false;
    item.quantity--; item.knownQuantity = Math.min(item.knownQuantity ?? item.quantity, item.quantity);
    const id = `${s.id}:shift:${s.nextNumber++}`;
    s.rests.push({ id, personId: a.id, stackId: item.id, startedAt: at, lastAt: at, progress: 0, wasReady: true,
      resumeAssignment: pausedJob ? s.job.id : null, cell: copy(a.mapCell), locationId: a.locationId });
    if (pausedJob) { s.job.wasReady = false; s.job.walkCredit = 0; s.job.lastAt = at; }
    a.assignment = id; duty.assignment = id;
    note(s, at, 'rest', 'An existing civic person accepted one supplied eight-hour off-duty recovery period. They cannot perform simultaneous work; provisions are spent, not a daily reset.'); return true;
  }
  function advance(s, succession, bargain, office, stacks, c, at, effects = {}) {
    if (!s || !c.alive || at < s.lastAt) return false;
    const oldStatus = status(s, s.lastAt); s.lastAt = at; applyService(s, office, at);
    let changed = oldStatus !== status(s, at);
    for (const r of [...s.rests]) {
      const a = staff(succession, bargain, office).find(a => a.id === r.personId), duty = a === office.clerk ? office : a;
      const valid = supported(s, succession, office, c) && living(a) && a.assignment === r.id && duty.assignment === r.id
        && a.locationId === r.locationId && cellSame(a.mapCell, r.cell);
      const delta = Math.max(0, at - r.lastAt); r.lastAt = at;
      if (!valid) { r.progress = 0; r.wasReady = false; continue; }
      if (!r.wasReady) { r.wasReady = true; continue; }
      const recovered = Math.min(REST - r.progress, delta);
      r.progress += recovered;
      if (r.progress + 1e-8 >= REST) {
        duty.workSeconds = Math.max(duty.workSeconds, s.workCaps[a.id]); a.fatigue = 0;
        if (a.assignment === r.id) a.assignment = null;
        if (duty.assignment === r.id) duty.assignment = null;
        if (r.resumeAssignment && s.job?.id === r.resumeAssignment) { a.assignment = s.job.id; s.job.lastAt = at; }
        if (a === office.clerk) office.availableAt = Math.max(office.availableAt || 0, at - (delta - recovered));
        s.rests = s.rests.filter(x => x.id !== r.id);
        s.receipts.push({ id: `${r.id}:receipt`, at: at - (delta - recovered),
          kind: 'suppliedShift', personId: a.id, stackId: r.stackId, quantity: 1 });
        note(s, at, 'shiftReady', 'The supplied off-duty period finished: bounded duty work is available again. Health, injuries and personal ward energy are unchanged.'); changed = true;
      }
    }
    const j = s.job, a = worker(s, succession);
    if (j) {
      let cursor = j.lastAt - (j.walkCredit || 0), remaining = Math.max(0, at - cursor); j.lastAt = at; j.walkCredit = 0;
      const valid = supported(s, succession, office, c) && able(a) && a.locationId === s.officeId && a.assignment === j.id && c.externalPowered;
      if (!valid) j.wasReady = false;
      else if (!j.wasReady) j.wasReady = true;
      else {
        while (remaining > 0 && s.job && a.workSeconds > 0) {
          const target = j.status === 'collecting' ? j.source.cell : s.installation.workCell;
          if (!cellSame(a.mapCell, target)) {
            if (remaining < 1) { j.walkCredit = remaining; break; }
            if (!effects.move?.(a, target)) break;
            a.workSeconds--; remaining--; cursor++; continue;
          }
          if (j.status === 'collecting') {
            const item = stacks.find(i => i.id === j.source.id);
            const original = j.source.kind === 'stack' ? item && clean(item) && item.quantity >= PARTS && !item.carriedBy
              && item.cityOwnerId === s.cityId && item.civicCustody?.cityId === s.cityId && item.reservedTaskId === j.id && cellSame(item.cell, j.source.cell)
              : succession.provision.stock >= PARTS && succession.provision.reservedBy === j.id && able(bargain.defender)
                && bargain.defender.workSeconds >= 1 && bargain.defender.locationId === s.officeId
                && bargain.defender.mapCell.z === a.mapCell.z && !bargain.defender.assignment && bargain.defender.id === j.source.custodianId
                && Math.hypot(a.mapCell.x - bargain.defender.mapCell.x, a.mapCell.y - bargain.defender.mapCell.y) <= 1;
            if (!original) break;
            j.cargo = { key: 'metalParts', quantity: PARTS, cityId: s.cityId, custodianId: a.id,
              sourceId: j.source.id || j.source.custodianId, sourceReceiptIds: copy(succession.provision.receipts.map(r => r.id)) };
            if (j.source.kind === 'stack') { item.quantity -= PARTS; item.knownQuantity = Math.min(item.knownQuantity ?? item.quantity, item.quantity); }
            else { succession.provision.stock -= PARTS; bargain.defender.workSeconds--; delete succession.provision.reservedBy; }
            j.status = 'installing'; changed = true; continue;
          }
          const worked = Math.min(remaining, WORK - j.progress, a.workSeconds);
          j.progress += worked; a.workSeconds -= worked; remaining -= worked; cursor += worked;
          if (j.progress + 1e-8 < WORK) break;
          s.servicedAt = cursor; s.dueAt = cursor + PERIOD; s.graceUntil = s.dueAt + GRACE;
          s.receipts.push({ id: `${j.id}:receipt`, at: cursor, installationId: s.installation.id, personId: a.id,
            quantity: PARTS, source: copy(j.source), manifest: copy(j.cargo), workSeconds: WORK, dueAt: s.dueAt, graceUntil: s.graceUntil });
          j.cargo = null; a.assignment = null; s.job = null; s.inspection = null;
          note(s, cursor, 'serviced', 'Three original city-owned parts were installed through actual local work. The counter service period renewed; no wall, health, ward energy or political allegiance was restored.');
          applyService(s, office, at); changed = true;
        }
      }
    }
    s.receipts = s.receipts.slice(-60);
    return changed;
  }
  function publicView(s, at, office = null) {
    if (!s) return null;
    return { installation: copy(s.installation), inspected: Boolean(s.inspection || s.receipts.some(r => r.installationId)),
      inspection: copy(s.inspection), status: status(s, at), dueAt: s.dueAt, graceUntil: s.graceUntil,
      availability: !office ? 'Not inspected' : !office.active || !able(office.clerk) ? 'Original counter or clerk unavailable'
        : office.assignment ? 'Clerk assigned or off duty' : !office.channelPowered ? 'External power outage'
          : status(s, at) === 'offline' ? 'Maintenance grace expired' : office.power < 1 ? 'Counter battery allocation exhausted'
            : office.workSeconds <= 0 ? 'Clerk duty allocation exhausted' : 'Counter service available',
      job: s.job && { id: s.job.id, status: s.job.status, workerId: s.job.workerId, progress: s.job.progress,
        carrying: s.job.cargo?.quantity || 0, workSeconds: WORK },
      rests: s.rests.map(r => ({ personId: r.personId, progress: r.progress, seconds: REST })),
      receipts: copy(s.receipts), message: s.message, limitations: LIMITS };
  }
  return { PERIOD, GRACE, REST, WORK, PARTS, POWER_CAP, WORK_CELL, RECEIVING, LIMITS, create, normalize, worker, staff,
    status, applyService, localReason, inspect, order, cancel, handSupply, rest, advance, publicView };
});
