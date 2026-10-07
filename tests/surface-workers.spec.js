const { test, expect } = require('@playwright/test');
const Workers = require('../surface-workers');
const Campaign = require('../campaign');
const clone = x => JSON.parse(JSON.stringify(x));
const route = { ok: true, cityId: 'a', distanceKm: 1, municipal: true };
function fixture() {
  const saved = Workers.create('seed', { id: 'a', name: 'Local City', supported: true }, 'madcap', 0);
  const wallet = { money: 500 };
  const hooks = { dead: false, enter: a => { a.mapCell = { x: 0, y: 0, z: 1 }; a.roomId = 'loading'; return true; },
    exit: () => ({ done: true }), haul: () => ({ reason: 'Waiting for an actual path' }), release: o => { o.carriedStackId = ''; } };
  return { saved, wallet, hooks };
}
function hire(f, hours = 2) { const q = Workers.request(f.saved, route, hours, 0); expect(Workers.hire(f.saved, route, q, f.wallet, 0).ok).toBe(true); }
function arrive(f) { Workers.advance(f.saved, route, f.wallet, 900, f.hooks); expect(f.saved.contract.status).toBe('onSite'); }
const stack = () => ({ id: 's', key: 'cloth', section: 'resources', quantity: 10, roomId: 'loading', reservedTaskId: '' });
const context = { surfaceRooms: ['loading', 'process'], routeOk: true, carryOk: true };

test('one theme-selected local applicant has a deterministic identity and finite saved personal resources', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const a = Workers.create('seed', { id: 'a', name: 'Local City', supported: true }, theme, 0);
    expect(a.actor).toMatchObject({ food: 2, water: 4, health: 100, present: false });
    expect(a.actor.name).toBe(fixture().saved.actor.name);
    a.actor.water = 0; expect(Workers.normalize(a).actor.water).toBe(0);
  }
  expect(Workers.create('seed', { id: 'a', supported: false }, 'madcap')).toBeNull();
  expect(Workers.create('seed', { supported: true }, 'madcap')).toBeNull();
});

test('exact prepaid terms reject changed routes, dates, budgets, supplies and unavailable original workers atomically', () => {
  for (const defect of ['route', 'expired', 'budget', 'supply', 'injury', 'terms']) {
    const f = fixture(), q = Workers.request(f.saved, route, 2, 0), used = { ...route }; let now = 0;
    if (defect === 'route') used.distanceKm = 2;
    if (defect === 'expired') now = 3601;
    if (defect === 'budget') f.wallet.money = 1;
    if (defect === 'supply') f.saved.actor.water = 0;
    if (defect === 'injury') f.saved.actor.health = 20;
    if (defect === 'terms') q.upfront++;
    const before = clone(f);
    expect(Workers.hire(f.saved, used, q, f.wallet, now).ok).toBe(false);
    expect(clone(f)).toEqual(before);
  }
  expect(Workers.quote(fixture().saved, { ...route, municipal: false }, 2, 0).ok).toBe(false);
  expect(Workers.quote(fixture().saved, { ...route, distanceKm: 6 }, 2, 0).ok).toBe(false);
  const f = fixture(); hire(f); expect(f.wallet.money).toBe(436); expect(f.saved.actor.money).toBe(40);
  expect(Workers.hire(f.saved, route, f.saved.quote, f.wallet, 0).ok).toBe(false);
});

test('arrival walks the original route, holds at a closed entrance and starts wages only after physical entry', () => {
  const f = fixture(); hire(f);
  Workers.advance(f.saved, route, f.wallet, 450, f.hooks); expect(f.saved.contract.positionKm).toBeCloseTo(.5); expect(f.saved.actor.present).toBe(false);
  Workers.advance(f.saved, { ...route, distanceKm: 2 }, f.wallet, 900, f.hooks); expect(f.saved.contract.positionKm).toBeCloseTo(.5);
  f.hooks.enter = () => false;
  Workers.advance(f.saved, route, f.wallet, 1350, f.hooks); expect(f.saved.contract.earned).toBe(0); expect(f.saved.actor.present).toBe(false);
  f.hooks.enter = a => { a.mapCell = { x: 0, y: 0, z: 1 }; return true; };
  Workers.advance(f.saved, route, f.wallet, 1360, f.hooks); expect(f.saved.actor.present).toBe(true); expect(f.saved.contract.startedAt).toBe(1360);
});

test('delegation reserves only an exact ordinary loose surface stack after route and capacity checks', () => {
  for (const defect of ['underground', 'reserved', 'hazard', 'living', 'chemical', 'carried', 'fixture', 'amount', 'path', 'capacity']) {
    const f = fixture(); hire(f); arrive(f); const s = stack(), ctx = { ...context }; let amount = 2;
    if (defect === 'underground') s.roomId = 'basement';
    if (defect === 'reserved') s.reservedTaskId = 'scientist-job';
    if (defect === 'hazard') s.tags = ['contaminated'];
    if (defect === 'living') s.creature = {};
    if (defect === 'chemical') s.chemicalBatch = {};
    if (defect === 'carried') s.carriedBy = 'scientist';
    if (defect === 'fixture') s.fixtureId = 'cabinet';
    if (defect === 'amount') amount = 11;
    if (defect === 'path') ctx.routeOk = false;
    if (defect === 'capacity') ctx.carryOk = false;
    const before = clone({ saved: f.saved, s });
    expect(Workers.assign(f.saved, s, amount, 'process', ctx, 900).ok).toBe(false); expect({ saved: f.saved, s }).toEqual(before);
  }
  const f = fixture(); hire(f); arrive(f); const s = stack();
  expect(Workers.assign(f.saved, s, 3, 'process', context, 900).ok).toBe(true); expect(s.reservedTaskId).toBe(f.saved.orders[0].id); expect(s.quantity).toBe(10);
});

test('only actual deliveries complete an order; interruption retains partial progress and releases actual load once', () => {
  const f = fixture(); hire(f); arrive(f); const s = stack(); Workers.assign(f.saved, s, 3, 'process', context, 900);
  f.hooks.haul = (a, o) => { o.delivered++; return {}; };
  f.hooks.release = o => { s.reservedTaskId = ''; o.carriedStackId = ''; };
  Workers.advance(f.saved, route, f.wallet, 910, f.hooks); expect(f.saved.orders[0].delivered).toBe(1); expect(f.saved.orders[0].status).toBe('active');
  expect(Workers.cancel(f.saved, f.hooks, 910)).toBe(true); expect(f.saved.orders[0].delivered).toBe(1); expect(s.reservedTaskId).toBe('');
  expect(Workers.cancel(f.saved, f.hooks, 910)).toBe(false);
  Workers.assign(f.saved, s, 2, 'process', context, 910); Workers.advance(f.saved, route, f.wallet, 930, f.hooks);
  expect(f.saved.orders[1]).toMatchObject({ delivered: 2, status: 'completed' }); expect(f.saved.actor.trust).toBe(51);
});

test('wages continue during waiting and rest, stop at escrow limit and unused wages refund only on physical return', () => {
  const f = fixture(); hire(f); arrive(f);
  Workers.advance(f.saved, route, f.wallet, 2700, f.hooks); expect(f.saved.contract.earned).toBeCloseTo(6);
  expect(Workers.withdraw(f.saved, f.hooks, 2700)).toBe(true); expect(f.wallet.money).toBe(436);
  f.hooks.exit = () => ({ reason: 'Locked exit' }); Workers.advance(f.saved, route, f.wallet, 2710, f.hooks); expect(f.saved.actor.present).toBe(true);
  f.hooks.exit = () => ({ done: true }); Workers.advance(f.saved, route, f.wallet, 2720, f.hooks);
  expect(f.saved.contract.status).toBe('returning'); expect(f.wallet.money).toBe(436);
  Workers.advance(f.saved, route, f.wallet, 3620, f.hooks); expect(f.saved.contract.status).toBe('completed');
  expect(f.wallet.money + f.saved.actor.money).toBeCloseTo(500); const money = f.wallet.money;
  Workers.advance(f.saved, route, f.wallet, 5000, f.hooks); expect(f.wallet.money).toBe(money);
  const g = fixture(); hire(g); arrive(g); Workers.advance(g.saved, route, g.wallet, 11000, g.hooks);
  expect(g.saved.contract.earned).toBe(24); expect(g.wallet.money).toBe(436);
});

test('rest, wounds, exhaustion and refusal are causal rather than random loyalty rolls', () => {
  const f = fixture(); hire(f); arrive(f); Workers.assign(f.saved, stack(), 1, 'process', context, 900);
  f.saved.actor.fatigue = 65; let worked = 0; f.hooks.haul = () => { worked++; return {}; };
  Workers.advance(f.saved, route, f.wallet, 1200, f.hooks); expect(worked).toBe(0); expect(f.saved.actor.fatigue).toBeLessThan(65); expect(f.saved.contract.earned).toBeGreaterThan(0);
  f.saved.actor.fatigue = 0; f.saved.actor.health = 20; Workers.advance(f.saved, route, f.wallet, 1210, f.hooks);
  expect(f.saved.contract.reason).toContain('wounds'); expect(f.saved.orders[0].status).toBe('cancelled'); expect(f.saved.actor.health).toBe(20);
  const g = fixture(); hire(g); arrive(g); Workers.assign(g.saved, stack(), 1, 'process', context, 900);
  g.hooks.haul = () => ({ reason: 'Observed toxic air', withdraw: true }); Workers.advance(g.saved, route, g.wallet, 910, g.hooks);
  expect(g.saved.contract.status).toBe('departing'); expect(g.saved.contract.reason).toContain('toxic');
});

test('incapacitation keeps actor, escrow and cargo; irreversible scientist death freezes everything', () => {
  const f = fixture(); hire(f); arrive(f); f.hooks.incapacitated = () => true;
  Workers.advance(f.saved, route, f.wallet, 1200, f.hooks); expect(f.saved.contract.status).toBe('onSite'); expect(f.saved.actor.reason).toContain('cannot move');
  f.hooks.dead = true; const before = clone(f); Workers.advance(f.saved, route, f.wallet, 90000, f.hooks); expect(clone(f)).toEqual(before);
});

test('a worker fatality releases only actual employer goods, retains unpaid escrow and cannot mint a replacement', () => {
  const f = fixture(); hire(f); arrive(f); const s = stack(); Workers.assign(f.saved, s, 2, 'process', context, 900);
  f.hooks.release = o => { s.reservedTaskId = ''; o.carriedStackId = ''; };
  f.saved.actor.health = 0; const wallet = f.wallet.money;
  Workers.advance(f.saved, route, f.wallet, 910, f.hooks);
  expect(f.saved.contract.status).toBe('fatality'); expect(f.saved.contract.settled).toBe(false);
  expect(f.saved.orders[0].status).toBe('cancelled'); expect(s.reservedTaskId).toBe(''); expect(f.wallet.money).toBe(wallet);
  expect(Workers.quote(f.saved, route, 2, 910).ok).toBe(false); expect(f.saved.actor.present).toBe(true);
});

test('normalization retains pending transport, partial orders and finite supplies without duplicate hiring or settlement', () => {
  const f = fixture(); hire(f); Workers.advance(f.saved, route, f.wallet, 450, f.hooks);
  f.saved = Workers.normalize(clone(f.saved)); expect(f.saved.contract.positionKm).toBeCloseTo(.5);
  arrive(f); Workers.assign(f.saved, stack(), 2, 'process', context, 900); f.saved.orders[0].delivered = 1;
  const restored = Workers.normalize(clone(f.saved)); expect(restored).toEqual(f.saved);
  Workers.withdraw(restored, f.hooks, 900); Workers.advance(restored, route, f.wallet, 2000, f.hooks);
  const money = f.wallet.money; Workers.advance(Workers.normalize(restored), route, f.wallet, 3000, f.hooks); expect(f.wallet.money).toBe(money);
  const fresh = fixture(); expect(fresh.saved.orders).toEqual([]); expect(fresh.saved.contract).toBeNull();
});

test('campaign recruitment and delegation require received real outcomes and never complete the independent-base ambition', () => {
  const flags = { known: true, alive: true, sourceId: 'actual-shift' };
  expect(Campaign.record(null, { ...flags, kind: 'workerRecruitment', arrived: false, consented: true }, 10).independentOperations.recruitment).toBeNull();
  let state = Campaign.record(null, { ...flags, kind: 'workerRecruitment', arrived: true, consented: true }, 10);
  state = Campaign.record(state, { ...flags, kind: 'workerDelegation', delivered: true }, 20);
  expect(state.independentOperations.recruitment.at).toBe(10); expect(state.independentOperations.delegation.at).toBe(20); expect(state.accomplishedAt).toBeNull();
  expect(Campaign.record(state, { ...flags, known: false, kind: 'workerDelegation', delivered: true }, 100)).toEqual(state);
});
