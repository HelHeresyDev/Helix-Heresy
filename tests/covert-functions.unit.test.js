const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../covert-functions');
const N = require('../network-operations');
const Local = require('../local-covert-market');
const { fixture: original, Definitions } = require('./helpers/institutional-inventory-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const { s: n, binding } = original([Definitions.find(d => d.category === 'blackMarket')]);
  const s = C.create(binding, 0), source = C.sources(n, 'city:0')[0]; assert.ok(source);
  const market = Local.create('city:0'), contact = { id: 'known-independent-contact', name: 'Independent Buyer' };
  Local.bind(market, contact, 0);
  const contract = { id: 'actual-active-contract', contactId: contact.id, status: 'active', dueAt: 36000, commodityKind: 'manufactured' };
  const request = { contractId: contract.id, contactId: contact.id, cityId: 'city:0', fingerprint: 'actual-cargo',
    cargo: { massKg: 5, volumeL: 6 }, distanceKm: 1 };
  const c = { alive: true, capable: true, local: true, channel: true, busy: false, cityId: 'city:0', market, contact,
    contactAvailable: true, route: { ok: true, cityId: 'city:0', distanceKm: 1 }, contract, request, wallet: { money: 20 } };
  const f = { n, s, source, c, market, contact, contract, request };
  f.begin = () => C.begin(f.s, f.n, source.ownerId, request, c, 0);
  f.tick = at => C.advance(f.s, f.n, () => c, at);
  return f;
}
test('the original broker charges once into its own reserve and spends its original worker/terminal, never a new courier or office budget', () => {
  const f = fixture(), r = C.resources(f.n, f.source.ownerId), before = copy(f.market), office = copy(f.n.accounts);
  r.worker.state.workSeconds = 200; r.terminal.state.powerSeconds = 190;
  const funds = r.funds.state.money;
  assert.equal(f.begin(), true); assert.equal(f.begin(), false); assert.equal(f.c.wallet.money, 18);
  f.tick(60); assert.equal(f.s.job.progress, 60); assert.equal(r.worker.state.workSeconds, 140);
  assert.equal(r.terminal.state.powerSeconds, 130); assert.equal(r.funds.state.money, funds + 2);
  assert.equal(r.funds.state.ledger.length, 1); assert.deepEqual(f.n.accounts, office); assert.deepEqual(f.market, before);
  f.tick(180); assert.equal(f.s.job, null); assert.equal(f.s.reports[0].available, true);
  assert.equal(r.worker.state.assignment, null); assert.equal(r.worker.state.workSeconds, 20);
  assert.equal(r.access.state.credential, null); assert.equal(r.access.state.carrierRights, false);
  assert.equal(r.access.state.commitments.length, 1); assert.deepEqual(f.market, before);
  assert.ok(C.outcomes(f.n, f.s).owners.every(o => !o.gaps.length));
});
test('real local consent, exact contract/cargo, resources and supported independent provider are required; hidden cells are not public contacts', () => {
  for (const change of [f => f.c.alive = false, f => f.c.capable = false, f => f.c.local = false,
    f => f.c.channel = false, f => f.c.busy = true, f => f.c.contactAvailable = false,
    f => f.c.wallet.money = 1, f => f.contract.status = 'queued', f => f.contract.foreignShipmentId = 'foreign',
    f => f.contract.commodityKind = 'specimen', f => f.c.route.ok = false, f => f.contact.homeCityId = 'another-city',
    f => f.market.couriers = [], f => C.resources(f.n, f.source.ownerId).worker.state.assignment = 'prior-obligation',
    f => C.resources(f.n, f.source.ownerId).terminal.state.powerSeconds = 100,
    f => C.resources(f.n, f.source.ownerId).worker.ownerId = 'another-owner']) {
    const f = fixture(); change(f); const before = copy([f.s, f.n, f.c.wallet]);
    assert.equal(f.begin(), false); assert.deepEqual(copy([f.s, f.n, f.c.wallet]), before);
  }
  const f = fixture(), cell = f.n.source.capabilityBaseline.rows.find(r => r.kind === 'covertCell');
  assert.equal(C.begin(f.s, f.n, cell.id, f.request, f.c, 0), false);
  assert.equal(C.sources(f.n, 'city:0').length, 1); assert.equal(C.sources(f.n, 'another-city').length, 0);
});
test('partial work, interruptions, finite conditions, cancellation and changed actual consent preserve costs and earlier records', () => {
  const f = fixture(); f.begin(); f.tick(30); const r = C.resources(f.n, f.source.ownerId), work = r.worker.state.workSeconds;
  for (const key of ['channel', 'local']) {
    f.c[key] = false; f.c.request = null; f.tick(f.s.lastAt + 100);
    assert.equal(r.worker.state.workSeconds, work); assert.equal(f.s.job.progress, 30);
    f.c.request = f.request; f.c[key] = true;
  }
  f.c.busy = true; f.tick(330); f.c.busy = false; f.tick(331); assert.equal(f.s.job.progress, 31);
  f.c.contactAvailable = false; f.tick(332); assert.equal(f.s.job, null); assert.equal(r.worker.state.assignment, null);
  assert.equal(f.c.wallet.money, 18); assert.equal(f.s.history[0].progress, 31); assert.equal(f.s.reports.length, 0);
  f.c.contactAvailable = true; assert.equal(C.begin(f.s, f.n, f.source.ownerId, f.request, f.c, 333), true);
  C.cancel(f.s, f.n, 334); assert.equal(f.c.wallet.money, 16); assert.equal(f.s.history.length, 2);
  assert.equal(r.funds.state.ledger.length, 2); assert.equal(f.market.collections.length, 0);
});
test('a received introduction is dated, non-reserving and optional; ordinary fleet availability and exact cargo still decide actual booking', () => {
  const f = fixture(); f.begin(); f.tick(180); const report = C.publicView(f.s), id = report[0].id;
  assert.equal(C.usable(f.s, f.n, id, f.c, 181), true);
  f.market.couriers[0].assignment = 'separate-paid-cargo';
  assert.equal(Local.book(f.market, f.contact, f.c.route, f.contract.id, f.request.cargo, 181).ok, false);
  f.tick(240); assert.deepEqual(C.publicView(f.s), report);
  f.market.couriers[0].assignment = null;
  assert.equal(Local.book(f.market, f.contact, f.c.route, f.contract.id, f.request.cargo, 240).ok, true);
  C.cancel(f.s, f.n, 241); assert.equal(f.market.couriers[0].assignment, f.market.collections[0].id);
  const cargo = copy(f.market);
  assert.equal(C.close(f.s, f.n, id, f.c, 241), true); assert.equal(C.close(f.s, f.n, id, f.c, 242), false);
  assert.equal(C.usable(f.s, f.n, id, f.c, 242), false); assert.deepEqual(f.market, cargo); assert.deepEqual(C.publicView(f.s), report);
  assert.ok(C.outcomes(f.n, f.s).owners.every(o => !o.gaps.length));
  assert.equal(C.usable(f.s, f.n, id, { ...f.c, request: { ...f.request, fingerprint: 'changed-lot' } }, 241), false);
  assert.equal(C.usable(f.s, f.n, id, f.c, 3780), false);
  assert.doesNotMatch(JSON.stringify(report), /cell:0|actualParent|workSeconds|powerSeconds|populationSourceId|carrierRights|counterparties/);
});
test('a busy or depleted independent courier produces a dated refusal, not a replacement van or a political defeat', () => {
  const f = fixture(); f.begin(); f.market.couriers[0].fuelKm = 0; f.tick(180);
  assert.equal(f.s.reports[0].available, false); assert.equal(f.market.couriers.length, 1); assert.equal(f.market.couriers[0].fuelKm, 0);
  assert.ok(C.outcomes(f.n, f.s).owners.every(o => !o.gaps.length)); assert.equal(C.outcomes(f.n, f.s).strategicComplete, false);
});
test('all original functions and source kinds retain private scopes: historical infiltration and informant labels create no insiders or target rights', () => {
  const { s: n } = original(), before = copy(n), result = C.outcomes(n, null);
  assert.equal(result.owners.length, Definitions.length * 4); assert.ok(result.owners.every(o => !o.gaps.length));
  assert.equal(result.owners.filter(o => o.kind === 'covertCell').length, Definitions.length);
  assert.ok(result.owners.filter(o => o.kind === 'covertCell').every(o => o.state === 'ownCorrespondenceAndOrdinaryFunctionOnly'));
  assert.deepEqual(n, before); assert.equal(result.strategicComplete, false);
  for (const row of n.source.capabilityBaseline.rows.filter(r => r.kind === 'affiliate')) row.original.hiddenPurpose = 'infiltration';
  assert.deepEqual(C.outcomes(n, null), result);
  const f = fixture(), r = C.resources(f.n, f.source.ownerId);
  r.access.state.governmentAccess = true;
  assert.equal(C.outcomes(f.n, f.s).owners.find(o => o.id === f.source.ownerId).state, 'unverified');
  assert.equal(f.begin(), false);
});
test('missing/corrupt ownership, records or undeclared access remain unverified rather than certifying absence or recreating assets', () => {
  const f = fixture(); f.begin(); f.tick(180);
  const held = C.publicView(f.s);
  assert.equal(C.outcomes(f.n, null).owners.find(o => o.id === f.source.ownerId).state, 'unverified');
  const r = C.resources(f.n, f.source.ownerId); r.access.state.counterparties.push({ id: 'unproved', kind: 'insider', institutionId: 'public-works' });
  assert.equal(C.outcomes(f.n, f.s).owners.find(o => o.id === f.source.ownerId).state, 'unverified');
  assert.deepEqual(C.publicView(f.s), held);
  f.n.inventories.assets = f.n.inventories.assets.filter(a => a.id !== r.worker.id);
  const before = copy(f.n); assert.deepEqual(C.sources(f.n, 'city:0'), []); C.outcomes(f.n, f.s); assert.deepEqual(f.n, before);
  const old = fixture(); old.n.inventories.mode = 'legacyUnknown'; assert.deepEqual(C.sources(old.n, 'city:0'), []);
  assert.equal(C.outcomes(old.n, old.s).state, 'unverified');
});
test('coarse/fine saves, continued copies, independent starts and final death conserve actual resources and acquired dates', () => {
  const a = fixture(), b = fixture(); a.begin(); b.begin(); a.tick(40);
  a.s = C.normalize(a.s); a.n = N.normalize(a.n); a.tick(180);
  for (let t = 1; t <= 180; t++) b.tick(t);
  assert.deepEqual(copy([a.s, a.n]), copy([b.s, b.n]));
  const to = { worldId: 'continued-world', runId: 'continued-run' }, ns = C.rebind(a.s, a.n, to), nn = N.rebind(a.n, a.n, to);
  assert.deepEqual(C.publicView(ns), C.publicView(a.s)); assert.ok(C.outcomes(nn, ns).owners.every(o => !o.gaps.length));
  assert.equal(C.usable(ns, a.n, ns.reports[0].id, a.c, 181), false);
  a.c.alive = false; const frozen = copy([a.s, a.n]); a.tick(1000); assert.deepEqual(copy([a.s, a.n]), frozen);
  const fresh = fixture(); assert.equal(fresh.s.reports.length, 0); assert.equal(C.resources(fresh.n, fresh.source.ownerId).worker.state.workSeconds, 14400);
});
