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
