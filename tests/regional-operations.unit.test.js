const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../regional-operations');
const Workers = require('../surface-workers');
const copy = x => JSON.parse(JSON.stringify(x));
const binding = { worldId: 'world', runId: 'run' };
const sources = [
  { id: 'home', kind: 'laboratory', sourceId: 'original-parcel', siteId: 'parcel', label: 'Original lab' },
  { id: 'away', kind: 'refuge', sourceId: 'original-local-operation', siteId: 'refuge', label: 'Original refuge' }
];
function fixture() {
  const s = R.create(binding); for (const source of sources) assert.ok(R.register(s, binding, source, 10)); return s;
}
test('two site identities resolve original canonical sources, never copied inventories or workers', () => {
  const s = fixture(), original = { ...sources[1], worker: { id: 'original-person', health: 61 }, stock: ['original-stack'] };
  const r = R.resolve(s, binding, 'away', [sources[0], original]);
  assert.equal(r.source, original); assert.equal(r.node, s.nodes[1]);
  assert.equal(s.nodes[1].worker, undefined); assert.equal(s.nodes[1].stock, undefined);
  assert.equal(R.register(s, binding, { ...sources[1], sourceId: 'replacement' }, 30), null);
  assert.equal(R.resolve(s, binding, 'away', [{ ...original, siteId: 'other-site' }]), null);
  assert.equal(R.resolve(s, binding, 'missing', sources), null);
  assert.equal(R.resolve(s, { ...binding, runId: 'new-run' }, 'home', sources), null);
});
test('site selection changes no sources, work, funds or observations; lost source does not erase another node', () => {
  const s = fixture(), before = copy(s.nodes), inputs = copy(sources);
  assert.equal(R.select(s, binding, 'away'), true); assert.deepEqual(s.nodes, before); assert.deepEqual(sources, inputs);
  assert.equal(R.resolve(s, binding, 'home', [sources[1]]), null);
  assert.ok(R.resolve(s, binding, 'away', [sources[1]])); assert.equal(s.nodes.length, 2);
  assert.equal(R.select(s, binding, 'unregistered'), false);
});
test('dated operation accounts are scoped, copied, and never publish private money or overwrite with future evidence', () => {
  const s = fixture(), a = { operationId: 'away', observedAt: 12, reason: 'Original supplier ledger', goods: 2 };
  s.nodes[0].money = 15;
  assert.equal(R.receive(s, binding, 'home', a, 20), false);
  assert.equal(R.receive(s, binding, 'away', a, 20), true); a.goods = 99;
  assert.equal(s.nodes[1].report.goods, 2);
  assert.equal(R.receive(s, binding, 'away', { ...a, observedAt: 40 }, 30), false);
  assert.equal(R.receive(s, binding, 'away', { ...a, observedAt: 10 }, 15), false);
  const v = R.publicView(s); assert.equal(v.nodes[0].money, undefined); assert.equal(v.nodes[1].report.receivedAt, 20);
  v.nodes[1].report.goods = 100; assert.equal(s.nodes[1].report.goods, 2);
});
test('actual original worker return refunds only into its local account, never the absent scientist treasury', () => {
  const s = fixture(), wallet = { money: 0 }, local = s.nodes[0];
  // An already prepaid, partially earned original engagement on its real return leg.
  const worker = { actor: { id: 'original-technician', cityId: 'city', health: 80, status: 'alive', present: false,
    fatigue: 10, food: 1, water: 1, money: 52 }, contract: { id: 'original-engagement', status: 'returning',
    distanceKm: 1, positionKm: .01, startedAt: 0, reserve: 48, earned: 12, hourly: 24, settled: false },
    lastAt: 0, orders: [], history: [] };
  Workers.advance(worker, { ok: true, cityId: 'city', distanceKm: 1, municipal: true }, local, 10, {});
  assert.equal(worker.contract.status, 'completed'); assert.equal(local.money, 36); assert.equal(wallet.money, 0);
  assert.equal(s.nodes[1].money, 0); assert.equal(R.settle(local, wallet, false), false);
  assert.equal(R.settle(s.nodes[1], wallet, true), false);
  assert.equal(R.settle(local, wallet, true), true); assert.equal(wallet.money, 36);
  assert.equal(R.settle(local, wallet, true), false); assert.equal(local.money, 0);
});
test('serialization and idempotent legacy registration preserve accounts, selection and dated knowledge', () => {
  let s = fixture(); R.select(s, binding, 'away'); s.nodes[0].money = 23;
  R.receive(s, binding, 'away', { operationId: 'away', observedAt: 14, source: 'inspection' }, 15);
  const before = copy(s); s = R.normalize(copy(s));
  for (const src of sources) R.register(s, binding, src, 999);
  assert.deepEqual(s, before); assert.equal(R.normalize(null), null);
});
test('continued-run rebinding retains originals while independent fresh runs inherit no property or recovery destination', () => {
  const s = fixture(); s.nodes[0].money = 17;
  const to = { worldId: 'renamed-world', runId: 'continued-run' }, next = R.rebind(s, binding, to);
  assert.equal(R.resolve(next, binding, 'home', sources), null); assert.equal(R.resolve(next, to, 'home', sources).node.money, 17);
  assert.deepEqual(next.nodes, s.nodes); assert.equal(R.rebind(s, to, binding), null);
  assert.equal(R.create(binding).nodes.length, 0); assert.equal(next.resurrection, undefined);
});
