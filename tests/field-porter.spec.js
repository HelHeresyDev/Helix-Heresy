const { test, expect } = require('@playwright/test');
const Porter = require('../field-porter');
const copy = x => JSON.parse(JSON.stringify(x));
const cell = x => ({ x, y: 10, z: 21 });
function fixture() {
  const city = { cityId: 'b', assetId: 'people:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const standings = [{ standing: 'licensed', network: { id: 'transport:b', category: 'transport', roles: ['courierDispatch'], prohibitions: [] },
    branch: { id: 'depot:b', publicName: 'Birch depot', organizationForm: 'contractDepot', currentCityId: 'b', publicPhysicalPresence: true, physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }];
  const e = { source: { cityId: 'b', populationSourceId: city.assetId }, entry: cell(10), roomId: 'ground', wilderness: { roomId: 'wild', gate: cell(20) } };
  const source = Porter.source(city, standings, e), s = Porter.create(source, e, 0);
  const c = { source, alive: true, capable: true, originalBody: true, custody: false, originalTrip: true, bodyEpoch: 1, visitId: 'visit', tripId: 'trip',
    near: true, busy: false, atGround: true, incapacitated: false, injured: false, threatened: false, care: false,
    site: { worldId: 'world', siteId: 'station', roomId: 'wild' }, drop: cell(25), dropLegal: true, itemVisible: true, carryOk: true, routeOk: true, hazards: ['Unwarded beasts and weather'] };
  const item = { id: 'stone', section: 'resources', key: 'stoneBlocks', quantity: 2, unitMassKg: 8, unitVolumeL: 5, roomId: 'wild', cell: cell(29), carriedBy: '', reservedTaskId: '', tags: [], sourceLabels: ['original'] };
  const f = { city, standings, e, s, c, item, stacks: [item], wallet: { money: 100 }, now: 0, blocked: false, capacity: true, deposited: 0 };
  f.reserve = (i, id) => { const slice = i.quantity > 1 ? { ...copy(i), id: `slice:${s.next}`, quantity: 1 } : i;
    if (slice !== i) { i.quantity--; f.stacks.push(slice); } slice.reservedTaskId = id; return slice; };
  f.hooks = { item: id => f.stacks.find(i => i.id === id), capacity: () => f.capacity,
    adjacent: goal => Math.abs(s.actor.mapCell.x - goal.x) <= 1,
    move: goal => { if (f.blocked) return false; s.actor.mapCell.x += Math.sign(goal.x - s.actor.mapCell.x); s.actor.roomId = s.actor.mapCell.x > 20 ? 'wild' : 'ground'; return true; },
    pickup: j => { f.stacks.find(i => i.id === j.stackId).carriedBy = s.actor.id; return true; },
    deposit: j => { const i = f.stacks.find(i => i.id === j.stackId); i.carriedBy = ''; i.cell = copy(j.drop); i.reservedTaskId = ''; f.deposited++; return true; },
    release: (j, canDrop) => { const i = f.stacks.find(i => i.id === j.stackId); if (!i || i.reservedTaskId !== j.id) return;
      if (canDrop && i.carriedBy === s.actor.id) { i.carriedBy = ''; i.cell = copy(s.actor.mapCell); } i.reservedTaskId = ''; } };
  return f;
}
function hire(f) { const q = Porter.review(f.s, f.c, f.now); expect(q).toBeTruthy(); expect(Porter.hire(f.s, f.c, q, f.wallet, f.now)).toBe(true); }
function tick(f, n = 1) { for (let k = 0; k < n; k++) Porter.advance(f.s, f.c, f.hooks, ++f.now); }
function onsite(f) { hire(f); tick(f, 20); expect(f.s.phase).toBe('onSite'); }
function assign(f) { expect(Porter.assign(f.s, f.c, f.item, f.now, f.reserve)).toBe(true); return f.s.job; }

test('only a real functioning local population-backed transport depot allocates one original noncombat person', () => {
  const f = fixture(); expect(f.s.source.people).toBe(1); expect(f.s.actor.id).toBe('depot:b:field-porter'); expect(f.s.actor.actorKind).toBe('surfaceWorker');
  for (const city of [{ ...f.city, currentPopulation: 7 }, { ...f.city, services: { transport: 'failed' } }, { ...f.city, assetId: 'other' }, { ...f.city, physicalCondition: 'ruined' }])
    expect(Porter.source(city, f.standings, f.e)).toBeNull();
  for (const branch of [{ ...f.standings[0].branch, currentCityId: 'elsewhere' }, { ...f.standings[0].branch, operationalStatus: 'closed' }, { ...f.standings[0].branch, organizationForm: 'escortChapter' }])
    expect(Porter.source(f.city, [{ ...f.standings[0], branch }], f.e)).toBeNull();
});
test('exact personal disclosed finite terms require free original capable people and reachable station', () => {
  for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { originalTrip: false }, { near: false }, { custody: true }, { atGround: false }, { busy: true },
    { source: null }, { threatened: true }, { incapacitated: true }, { site: null }, { dropLegal: false }, { routeOk: false }]) {
    const f = fixture(); expect(Porter.review(f.s, { ...f.c, ...wrong }, 0), JSON.stringify(wrong)).toBeNull();
  }
  const f = fixture(); f.c.source.restrictions = [{ refusesDeclaredOpposition: true, text: 'No anti-divine clients.' }]; expect(Porter.review(f.s, f.c, 0)).toBeNull();
});
test('stale terms, changed hazard disclosures and identity cannot debit or hire', () => {
  const f = fixture(), q = Porter.review(f.s, f.c, 0);
  for (const wrong of [{ tripId: 'other' }, { bodyEpoch: 2 }, { visitId: 'other' }, { hazards: [] }, { drop: cell(26) }, { near: false }, { routeOk: false }])
    expect(Porter.hire(f.s, { ...f.c, ...wrong }, q, f.wallet, 1)).toBe(false);
  expect(Porter.hire(f.s, f.c, { ...q, upfront: 0 }, f.wallet, 1)).toBe(false);
  expect(Porter.hire(f.s, f.c, q, f.wallet, 60)).toBe(false); expect(f.wallet.money).toBe(100);
});
test('prepaid shift starts only after physical arrival and expires after two hours without a replacement or refund teleport', () => {
  const f = fixture(); hire(f); expect(f.wallet.money).toBe(36); f.blocked = true; tick(f, 100); expect(f.s.phase).toBe('arriving'); expect(f.s.contract.startedAt).toBeNull();
  f.blocked = false; tick(f, 20); const start = f.s.contract.startedAt; expect(start).toBeGreaterThan(100);
  f.blocked = true; Porter.advance(f.s, f.c, f.hooks, f.now = start + Porter.SHIFT);
  expect(f.s.phase).toBe('returning'); expect(f.s.contract.earned).toBe(24); expect(f.s.actor.roomId).toBe('wild');
  expect(Porter.settle(f.s, f.c, f.wallet, f.now)).toBe(false); expect(f.wallet.money).toBe(36);
});
test('one exact unit is reserved, physically loaded and deposited once, without repeating or restarting wages', () => {
  const f = fixture(); onsite(f); const started = f.s.contract.startedAt, j = assign(f);
  expect(f.item.quantity).toBe(1); expect(f.item.reservedTaskId).toBe(''); expect(Porter.assign(f.s, f.c, f.item, f.now, f.reserve)).toBe(false);
  tick(f, 7); expect(f.deposited).toBe(0); tick(f, 60); expect(j.status).toBe('delivered'); expect(f.deposited).toBe(1);
  tick(f, 100); expect(f.deposited).toBe(1); expect(f.s.history).toHaveLength(1); expect(f.s.contract.startedAt).toBe(started); expect(f.wallet.money).toBe(36);
});
test('bulky, dangerous, unowned, stored or unavailable goods cannot be assigned', () => {
  const f = fixture(); onsite(f);
  for (const wrong of [{ cityOwnerId: 'city' }, { civicCustody: 'city' }, { carriedBy: 'scientist' }, { reservedTaskId: 'other' }, { containerId: 'crate' },
    { fixtureId: 'crate' }, { tags: ['toxic'] }, { biology: {} }, { key: 'metalParts' }, { roomId: 'other' }]) expect(Porter.assign(f.s, f.c, { ...f.item, ...wrong }, f.now, f.reserve)).toBe(false);
  for (const wrong of [{ carryOk: false }, { routeOk: false }, { itemVisible: false }, { near: false }, { care: true }]) {
    expect(Porter.assign(f.s, { ...f.c, ...wrong }, f.item, f.now, f.reserve)).toBe(false);
  }
});
test('blocked routes and self-care cannot backfill attended handoffs or replace missing original cargo', () => {
  const f = fixture(); onsite(f); const j = assign(f); f.blocked = true; tick(f, 100); expect(j.progress).toBe(0); expect(j.reason).toContain('blocked');
  f.blocked = false; tick(f, 5); const progress = j.progress; f.c.care = true; tick(f, 100); expect(j.progress).toBe(progress);
  f.c.care = false; tick(f); expect(j.progress).toBe(progress);
  f.stacks = f.stacks.filter(i => i.id !== j.stackId); tick(f); expect(j.status).toBe('interrupted'); expect(f.item.quantity).toBe(1);
});
test('danger, injury, lost backing, custody, identity and original trip changes stop work with actual ground cargo', () => {
  for (const wrong of [{ threatened: true }, { injured: true }, { source: null }, { site: null }, { site: { worldId: 'other', siteId: 'station', roomId: 'wild' } },
    { custody: true }, { originalBody: false }, { bodyEpoch: 2 }, { visitId: 'new' }, { tripId: 'new' }]) {
    const f = fixture(); onsite(f); const j = assign(f); while (j.phase !== 'delivery') tick(f);
    const at = copy(f.s.actor.mapCell); Object.assign(f.c, wrong); tick(f);
    expect(j.status, JSON.stringify(wrong)).toBe('interrupted'); expect(f.stacks.find(i => i.id === j.stackId)).toMatchObject({ carriedBy: '', cell: at, reservedTaskId: '' });
    expect(f.s.phase).toBe('returning'); expect(f.wallet.money).toBe(36);
  }
});
test('incapacity and death preserve cargo at the actual body; scientist death freezes everything', () => {
  for (const dead of [false, true]) {
    const f = fixture(); onsite(f); const j = assign(f); while (j.phase !== 'delivery') tick(f);
    f.c.incapacitated = true; if (dead) { f.s.actor.status = 'dead'; f.s.actor.diedAt = f.now; }
    tick(f); expect(f.stacks.find(i => i.id === j.stackId).carriedBy).toBe(f.s.actor.id); expect(j.status).toBe('interrupted');
  }
  const f = fixture(); onsite(f); assign(f); f.c.alive = false; const before = copy(f.s); tick(f, 60); expect(f.s).toEqual(before);
});
test('received reports are dated snapshots, never live progress or remote orders', () => {
  const f = fixture(); onsite(f); assign(f); expect(Porter.receive(f.s, f.c, f.now)).toBe(true); const known = Porter.publicView(f.s);
  f.c.near = false; tick(f, 100); expect(f.s.job.status).toBe('delivered'); expect(Porter.publicView(f.s)).toEqual(known);
  expect(Porter.receive(f.s, f.c, f.now)).toBe(false); expect(Porter.assign(f.s, f.c, f.item, f.now, f.reserve)).toBe(false);
});
test('physical return settles once, preserves the same duty/body/supplies and permits no replacement scientist inheritance', () => {
  const f = fixture(); onsite(f); tick(f, 100); Porter.withdraw(f.s, f.hooks, f.now); tick(f, 30); expect(f.s.phase).toBe('awaitingSettlement');
  expect(Porter.settle(f.s, { ...f.c, bodyEpoch: 2 }, f.wallet, f.now)).toBe(false);
  expect(Porter.settle(f.s, { ...f.c, tripId: 'later', visitId: 'later' }, f.wallet, f.now)).toBe(true);
  const money = f.wallet.money, duty = f.s.dutySeconds, actor = f.s.actor; expect(money).toBeGreaterThan(36); expect(money).toBeLessThanOrEqual(60);
  expect(Number.isInteger(money)).toBe(true); expect(Number.isInteger(f.s.contract.refund)).toBe(true);
  expect(Porter.settle(f.s, f.c, f.wallet, f.now)).toBe(false); expect(f.wallet.money).toBe(money);
  f.wallet.money += 20; // Explicit new finite funds, not a second refund.
  hire(f); expect(f.s.actor).toBe(actor); expect(f.s.dutySeconds).toBe(duty); expect(f.s.actor.health).toBe(100);
});
test('serialized exact slices and partial work resume without duplicated goods or claims', () => {
  const f = fixture(); onsite(f); assign(f); tick(f, 7); const old = f.s.job.progress;
  f.s.job = copy(f.s.job); f.stacks = copy(f.stacks); expect(f.s.job.progress).toBe(old); tick(f, 100);
  expect(f.deposited).toBe(1); expect(f.stacks.reduce((n, i) => n + i.quantity, 0)).toBe(2);
});
test('nonfinite clocks and replacement people cannot sign, report or settle original employment', () => {
  const f = fixture(); expect(Porter.review(f.s, f.c, NaN)).toBeNull();
  const q = Porter.review(f.s, f.c, 0); expect(Porter.hire(f.s, f.c, q, f.wallet, NaN)).toBe(false);
  onsite(f); const before = copy(f.s); Porter.advance(f.s, f.c, f.hooks, NaN); expect(f.s).toEqual(before);
  expect(Porter.assign(f.s, f.c, f.item, NaN, f.reserve)).toBe(false);
  Porter.withdraw(f.s, f.hooks, f.now); tick(f, 30); expect(f.s.phase).toBe('awaitingSettlement');
  f.s.actor.id = 'replacement';
  expect(Porter.receive(f.s, f.c, f.now)).toBe(false); expect(Porter.settle(f.s, f.c, f.wallet, f.now)).toBe(false);
});

function inspectOrder(f, items) {
  for (const i of items) expect(Porter.append(f.s, f.c, i, f.now)).toBe(true);
  return copy(f.s.proposal);
}
function acceptOrder(f, expected = copy(f.s.proposal), contexts = []) {
  return Porter.accept(f.s, f.c, (f.s.proposal?.rows || []).map((r, n) => ({ item: f.stacks.find(i => i.id === r.sourceId),
    context: { ...f.c, ...contexts[n] } })), expected, f.now, f.reserve, f.hooks.release);
}
function four(f) {
  f.item.quantity = 5;
  return inspectOrder(f, [f.item, f.item, f.item, f.item]);
}
test('editable orders stop at four and reject depleted piles, altered snapshots and reserved builder materials', () => {
  const f = fixture(); onsite(f);
  inspectOrder(f, [f.item, f.item]); expect(Porter.append(f.s, f.c, f.item, f.now)).toBe(false);
  expect(Porter.edit(f.s, f.c, f.now)).toBe(true); expect(f.s.proposal.rows).toHaveLength(1);
  expect(Porter.edit(f.s, f.c, f.now, true)).toBe(true); expect(f.s.proposal).toBeNull();
  const p = four(f); expect(Porter.append(f.s, f.c, f.item, f.now)).toBe(false); expect(f.s.proposal).toEqual(p);
  expect(acceptOrder(f, { ...p, drop: cell(26) })).toBe(false);
  f.item.reservedTaskId = 'field-build:original:part-1'; expect(acceptOrder(f)).toBe(false);
  expect(f.item.quantity).toBe(5); expect(f.wallet.money).toBe(36);
});
test('acceptance preflights every exact inspected source and personal condition before reserving anything', () => {
  for (const wrong of [{ quantity: 6 }, { sourceLabels: ['substitute'] }, { cell: cell(28) }, { carriedBy: 'scientist' }, { cityOwnerId: 'city' }]) {
    const f = fixture(); onsite(f); four(f); Object.assign(f.item, wrong);
    expect(acceptOrder(f), JSON.stringify(wrong)).toBe(false); expect(f.stacks).toHaveLength(1); expect(f.item.reservedTaskId).toBe('');
  }
  for (const wrong of [{ near: false }, { itemVisible: false }, { carryOk: false }, { routeOk: false }, { injured: true }, { care: true },
    { tripId: 'new' }, { site: null }, { source: null }, { bodyEpoch: 2 }, { drop: cell(26) }, { threatened: true }]) {
    const f = fixture(); onsite(f); four(f); expect(acceptOrder(f, copy(f.s.proposal), [{}, {}, {}, wrong]), JSON.stringify(wrong)).toBe(false);
    expect(f.stacks).toHaveLength(1); expect(f.item.quantity).toBe(5);
  }
  const f = fixture(); onsite(f); four(f); f.now = f.s.contract.startedAt + Porter.SHIFT;
  expect(acceptOrder(f)).toBe(false); expect(f.stacks).toHaveLength(1);
});
test('four disjoint one-unit claims from one pile deliver sequentially on one unchanged clock without repeat or surplus claims', () => {
  const f = fixture(); onsite(f); const start = f.s.contract.startedAt, duty = f.s.dutySeconds;
  four(f); expect(acceptOrder(f)).toBe(true); const o = f.s.deliveryOrder;
  expect(f.item).toMatchObject({ quantity: 1, reservedTaskId: '' });
  expect(new Set(o.jobs.map(j => j.stackId)).size).toBe(4); expect(new Set(o.jobs.map(j => j.id)).size).toBe(4);
  expect(o.jobs.every(j => f.stacks.find(i => i.id === j.stackId).reservedTaskId === j.id)).toBe(true);
  expect(Porter.append(f.s, f.c, f.item, f.now)).toBe(false); expect(Porter.assign(f.s, f.c, f.item, f.now, f.reserve)).toBe(false);
  tick(f, 250); expect(o.status).toBe('delivered'); expect(o.index).toBe(4); expect(f.deposited).toBe(4);
  expect(f.s.history.map(j => j.id)).toEqual(o.jobs.map(j => j.id)); expect(f.s.contract.startedAt).toBe(start);
  expect(f.s.dutySeconds).toBe(duty - 250); expect(f.wallet.money).toBe(36);
  tick(f, 100); expect(f.deposited).toBe(4); expect(f.stacks.reduce((n, i) => n + i.quantity, 0)).toBe(5);
  inspectOrder(f, [f.item]); expect(acceptOrder(f)).toBe(true); tick(f, 80); expect(f.deposited).toBe(5);
  expect(f.s.contract.startedAt).toBe(start); expect(f.wallet.money).toBe(36);
});
test('mixed sources retain ordered pickups and exact signatures, not a homogeneous delivery quota', () => {
  const f = fixture(); onsite(f);
  const lumber = { ...copy(f.item), id: 'wood', key: 'lumber', unitMassKg: 5, unitVolumeL: 4, cell: cell(31) };
  f.stacks.push(lumber); inspectOrder(f, [lumber, f.item, lumber]); expect(acceptOrder(f)).toBe(true);
  tick(f, 250); expect(f.deposited).toBe(3); expect(f.s.history.map(j => j.sourceId)).toEqual(['wood', 'stone', 'wood']);
  expect(f.stacks.find(i => i.id === 'stone').quantity).toBe(1);
});
test('partial handoffs and order index survive serialization; blocked next delivery never skips or backfills', () => {
  const f = fixture(); onsite(f); four(f); expect(acceptOrder(f)).toBe(true);
  while (!f.s.job.progress) tick(f);
  const progress = f.s.job.progress, now = f.now;
  Object.assign(f.s, copy(f.s)); f.stacks = copy(f.stacks); tick(f);
  expect(f.s.job.progress).toBe(progress + 1);
  while (f.deposited < 1) tick(f); f.blocked = true; const id = f.s.job.id;
  tick(f, 100); expect(f.s.deliveryOrder.index).toBe(1); expect(f.s.job.id).toBe(id); expect(f.s.job.reason).toContain('blocked');
  expect(f.s.job.progress).toBe(0); expect(f.deposited).toBe(1);
  Object.assign(f.s, copy(f.s)); f.stacks = copy(f.stacks); f.blocked = false; f.c.care = true; tick(f, 50); f.c.care = false;
  tick(f); expect(f.s.job.progress).toBe(0); tick(f, 250);
  expect(f.deposited).toBe(4); expect(f.s.history).toHaveLength(4); expect(f.now).toBeGreaterThan(now);
});
test('loss of an exact future unit interrupts the order and physically withdraws without reserving surplus', () => {
  const f = fixture(); onsite(f); four(f); expect(acceptOrder(f)).toBe(true);
  while (f.deposited < 1) tick(f);
  while (f.s.job.phase !== 'delivery') tick(f);
  const at = copy(f.s.actor.mapCell), carried = f.s.job.stackId, missing = f.s.deliveryOrder.jobs[3].stackId;
  f.stacks = f.stacks.filter(i => i.id !== missing); tick(f);
  expect(f.s.phase).toBe('returning'); expect(f.s.deliveryOrder.status).toBe('interrupted'); expect(f.deposited).toBe(1);
  expect(f.stacks.find(i => i.id === carried)).toMatchObject({ carriedBy: '', cell: at, reservedTaskId: '' });
  expect(f.stacks.every(i => !i.reservedTaskId)).toBe(true); expect(f.item.quantity).toBe(1);
  tick(f, 100); expect(f.deposited).toBe(1);
});
test('altered current order cargo cannot use an identical surplus unit and no incomplete order is inherited by a new body', () => {
  for (const wrong of ['cargo', 'body', 'incapacity']) {
    const f = fixture(); onsite(f); four(f); expect(acceptOrder(f)).toBe(true);
    while (f.s.job.phase !== 'delivery') tick(f); const j = f.s.job;
    if (wrong === 'cargo') f.stacks.find(i => i.id === j.stackId).sourceLabels = ['changed provenance'];
    if (wrong === 'body') f.c.bodyEpoch = 2;
    if (wrong === 'incapacity') f.c.incapacitated = true;
    tick(f); expect(f.s.phase).toBe('returning'); expect(f.s.deliveryOrder.status).toBe('interrupted');
    expect(f.deposited).toBe(0); expect(f.stacks.every(i => !i.reservedTaskId)).toBe(true);
    expect(f.item.quantity).toBe(1); expect(f.item.reservedTaskId).toBe('');
    expect(f.stacks.find(i => i.id === j.stackId).carriedBy).toBe(wrong === 'incapacity' ? f.s.actor.id : '');
  }
});
test('personal cancellation releases only this order, retaining delivered goods and actual carried position', () => {
  const f = fixture(); onsite(f); four(f); expect(acceptOrder(f)).toBe(true);
  while (f.deposited < 1) tick(f); while (f.s.job.phase !== 'delivery') tick(f);
  const j = f.s.job, at = copy(f.s.actor.mapCell); f.item.reservedTaskId = 'field-build:other';
  expect(Porter.stopJob(f.s, f.hooks, f.now, 'Personal cancellation')).toBe(true);
  expect(Porter.stopJob(f.s, f.hooks, f.now, 'Again')).toBe(false);
  expect(f.stacks.find(i => i.id === j.stackId)).toMatchObject({ cell: at, carriedBy: '', reservedTaskId: '' });
  expect(f.item.reservedTaskId).toBe('field-build:other'); expect(f.s.deliveryOrder.jobs.map(j => j.status)).toEqual(['delivered', 'interrupted', 'cancelled', 'cancelled']);
  expect(f.s.history.map(j => j.status)).toEqual(['delivered', 'interrupted', 'cancelled', 'cancelled']);
  tick(f, 100); expect(f.deposited).toBe(1);
});
test('danger, death and spent budget release pending claims without extending time or teleporting body cargo', () => {
  for (const reason of ['danger', 'dead', 'budget']) {
    const f = fixture(); onsite(f); four(f); expect(acceptOrder(f)).toBe(true);
    while (f.s.job.phase !== 'delivery') tick(f); const carried = f.s.job.stackId;
    if (reason === 'danger') f.c.threatened = true;
    if (reason === 'dead') { f.s.actor.status = 'dead'; f.s.actor.diedAt = f.now; f.c.incapacitated = true; }
    if (reason === 'budget') f.now = f.s.contract.startedAt + Porter.SHIFT - 1;
    tick(f); expect(f.s.deliveryOrder.status).toBe('interrupted'); expect(f.deposited).toBe(0);
    expect(f.stacks.every(i => !i.reservedTaskId)).toBe(true);
    expect(f.stacks.find(i => i.id === carried).carriedBy).toBe(reason === 'dead' ? f.s.actor.id : '');
    if (reason === 'budget') expect(f.s.contract.earned).toBe(24);
  }
});
test('signed instructions stay public but private multi-delivery outcomes require a dated personal report', () => {
  const f = fixture(); onsite(f); four(f); expect(acceptOrder(f)).toBe(true);
  expect(Porter.receive(f.s, f.c, f.now)).toBe(true); const known = Porter.publicView(f.s);
  expect(known.received.order.jobs[0].status).toBe('working'); f.c.near = false; tick(f, 250);
  expect(Porter.publicView(f.s)).toEqual(known); expect(Porter.receive(f.s, f.c, f.now)).toBe(false);
  f.c.near = true; expect(Porter.receive(f.s, f.c, f.now)).toBe(true);
  expect(Porter.publicView(f.s).received.order.jobs.every(j => j.status === 'delivered')).toBe(true);
  const before = copy(f.s); f.c.alive = false; tick(f, 100); expect(f.s).toEqual(before);
});
test('a failed reservation releases acquired exact claims without charging or creating a signed order', () => {
  const f = fixture(); onsite(f); four(f); let calls = 0;
  const entries = f.s.proposal.rows.map(() => ({ item: f.item, context: f.c }));
  expect(Porter.accept(f.s, f.c, entries, copy(f.s.proposal), f.now,
    (i, id) => ++calls === 3 ? null : f.reserve(i, id), f.hooks.release)).toBe(false);
  expect(f.stacks.every(i => !i.reservedTaskId)).toBe(true); expect(f.stacks.reduce((n, i) => n + i.quantity, 0)).toBe(5);
  expect(f.s.deliveryOrder).toBeNull(); expect(f.s.job).toBeNull(); expect(f.wallet.money).toBe(36);
});

function stagingContext(f, x = 27) {
  return { ...f.c, local: true, cell: cell(x), stageLegal: true,
    site: { ...f.c.site, layout: { footprint: [cell(25), cell(26), cell(27)] } } };
}
function destination(f, x = 27) {
  const mark = Porter.markStage(stagingContext(f, x), f.now); expect(mark).toBeTruthy();
  return { ...f.c, destination: mark, deliveryDrop: copy(mark.cell), deliveryDropLegal: true };
}
test('staging marks require personal inspection of clear local ground inside or one tile beside the same hut', () => {
  const f = fixture(), c = stagingContext(f);
  for (const x of [24, 25, 26, 27, 28]) expect(Porter.stagingArea(c.site, cell(x))).toBe(true);
  for (const target of [cell(23), cell(29), { ...cell(27), z: 22 }, { ...cell(27), x: 27.5 }]) expect(Porter.stagingArea(c.site, target)).toBe(false);
  for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { custody: true }, { originalTrip: false },
    { busy: true }, { local: false }, { stageLegal: false }, { tripId: '' }, { visitId: '' }, { bodyEpoch: -1 }, { site: null }, { cell: cell(30) }])
    expect(Porter.markStage({ ...c, ...wrong }, 1), JSON.stringify(wrong)).toBeNull();
  expect(Porter.markStage(c, NaN)).toBeNull(); const mark = Porter.markStage(c, 1);
  expect(mark).toMatchObject({ cell: cell(27), at: 1, bodyEpoch: 1, tripId: 'trip', visitId: 'visit', site: f.c.site });
  const initial = Porter.markStage({ ...c, bodyEpoch: 0 }, 1);
  expect(initial.bodyEpoch).toBe(0); expect(Porter.stageCurrent(initial, { ...f.c, bodyEpoch: 0 })).toBe(true);
});
test('one pile supplies distinct inspected destinations and the original default without extending the paid shift', () => {
  const f = fixture(); onsite(f); f.item.quantity = 4; const a = destination(f, 27), b = destination(f, 28);
  for (const c of [a, f.c, b]) expect(Porter.append(f.s, c, f.item, f.now)).toBe(true);
  expect(acceptOrder(f, copy(f.s.proposal), [a, {}, b])).toBe(true);
  const o = f.s.deliveryOrder, started = f.s.contract.startedAt;
  expect(o.jobs.map(j => j.drop)).toEqual([cell(27), cell(25), cell(28)]);
  expect(o.jobs.map(j => j.destination?.id || null)).toEqual([a.destination.id, null, b.destination.id]);
  expect(f.item).toMatchObject({ quantity: 1, reservedTaskId: '' }); expect(f.s.contract.drop).toEqual(cell(25));
  tick(f, 200); expect(f.deposited).toBe(3); expect(o.status).toBe('delivered');
  expect(o.jobs.map(j => f.stacks.find(i => i.id === j.stackId).cell)).toEqual([cell(27), cell(25), cell(28)]);
  expect(f.wallet.money).toBe(36); expect(f.s.contract.startedAt).toBe(started);
});
test('missing, altered, stale or inaccessible destination bindings refuse the whole order before reservation', () => {
  for (const wrong of [{ deliveryDropLegal: false }, { routeOk: false }, { deliveryDrop: cell(26) }, { destination: null },
    { destination: { at: 2 } }]) {
    const f = fixture(); onsite(f); const c = destination(f); expect(Porter.append(f.s, c, f.item, f.now)).toBe(true);
    expect(acceptOrder(f, copy(f.s.proposal), [{ ...c, ...wrong }]), JSON.stringify(wrong)).toBe(false);
    expect(f.stacks).toHaveLength(1); expect(f.item.quantity).toBe(2); expect(f.item.reservedTaskId).toBe('');
  }
  for (const wrong of [{ at: 99 }, { cell: cell(28) }, { bodyEpoch: 2 }, { visitId: 'later' }, { tripId: 'later' },
    { site: { worldId: 'other', siteId: 'station', roomId: 'wild' } }]) {
    const f = fixture(); onsite(f); const c = destination(f); expect(Porter.append(f.s, c, f.item, f.now)).toBe(true);
    expect(acceptOrder(f, copy(f.s.proposal), [{ ...c, destination: { ...c.destination, ...wrong } }])).toBe(false);
    expect(f.item.quantity).toBe(2);
  }
  const f = fixture(); onsite(f); const c = destination(f);
  expect(Porter.append(f.s, { ...c, destination: null }, f.item, f.now)).toBe(false); // No arbitrary uninspected coordinate.
  expect(Porter.assign(f.s, c, f.item, f.now, f.reserve)).toBe(false); // Immediate instruction remains the default drop.
});
test('blocked later staging holds the named delivery across reload and cannot skip ahead or borrow care time', () => {
  const f = fixture(); onsite(f); f.item.quantity = 4; const a = destination(f, 27), b = destination(f, 28);
  for (const c of [f.c, a, b]) expect(Porter.append(f.s, c, f.item, f.now)).toBe(true);
  expect(acceptOrder(f, copy(f.s.proposal), [{}, a, b])).toBe(true);
  let obstructed = true; f.hooks.dropLegal = j => !obstructed || j.drop.x !== 27;
  tick(f, 100); const id = f.s.job.id;
  expect(f.deposited).toBe(1); expect(f.s.deliveryOrder.index).toBe(1); expect(f.s.job.reason).toContain('unavailable');
  expect(f.s.job.drop).toEqual(cell(27)); expect(f.s.job.progress).toBe(0);
  Object.assign(f.s, copy(f.s)); f.stacks = copy(f.stacks);
  expect(f.s.deliveryOrder.jobs.slice(1).every(j => f.stacks.find(i => i.id === j.stackId).reservedTaskId === j.id)).toBe(true);
  f.c.care = true; tick(f, 50); obstructed = false; f.c.care = false; tick(f);
  expect(f.s.job.id).toBe(id); expect(f.s.job.progress).toBe(0); tick(f, 150);
  expect(f.deposited).toBe(3); expect(f.s.history.map(j => j.drop)).toEqual([cell(25), cell(27), cell(28)]);
});
test('runtime access is per delivery, not the old apron or a later edited mark; interruption keeps real cargo custody', () => {
  for (const budget of [false, true]) {
    const f = fixture(); onsite(f); const c = destination(f);
    expect(Porter.append(f.s, c, f.item, f.now)).toBe(true); expect(acceptOrder(f, copy(f.s.proposal), [c])).toBe(true);
    const job = f.s.job; c.destination.cell.x = 999; // Later note edits cannot retarget accepted cargo.
    f.c.dropLegal = false; f.hooks.dropLegal = j => j.drop.x === 27;
    while (f.s.job.phase !== 'delivery') tick(f); const at = copy(f.s.actor.mapCell);
    expect(job.drop).toEqual(cell(27)); expect(job.destination.cell).toEqual(cell(27));
    if (budget) { f.now = f.s.contract.startedAt + Porter.SHIFT - 1; tick(f); }
    else expect(Porter.stopJob(f.s, f.hooks, f.now, 'Personal cancellation')).toBe(true);
    expect(f.stacks.find(i => i.id === job.stackId)).toMatchObject({ carriedBy: '', cell: at, reservedTaskId: '' });
    expect(f.deposited).toBe(0); expect(f.item.quantity).toBe(1); if (budget) expect(f.s.phase).toBe('returning');
  }
});
