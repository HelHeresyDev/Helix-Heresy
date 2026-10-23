const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../founding-expedition');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const c = { worldId: 'world', runId: 'run', bodyEpoch: 1, alive: true, free: true, capable: true, busy: false,
    inspectedSite: true, planCurrent: true, sourceCurrent: true, personalMuster: true, representativePresent: true,
    protectorWilling: true, sourceId: 'original-charter', representativeId: 'original-representative',
    kits: true, provisions: true, routeOpen: true, accompanied: true, groundSafe: true, atWork: true, protectorAtPost: true,
    buildClaimsCurrent: true, campIntact: true };
  const id = Array.from({ length: 100 }, (_, n) => `original-${n}`).find(F.willing);
  const a = { id, status: 'alive', health: 82, fatigue: 12, workSeconds: 3600, stamina: 90, wardMana: 100, money: 7 };
  const s = F.create(c), wallet = { money: 1000 }, plan = { worldId: 'world', siteId: 'boundary', stoneNodeId: 'original-face',
    observationIds: ['received-reconnaissance'], route: [{ x: 0, y: 0, z: 6 }, { x: 1, y: 0, z: 6 }], home: { cell: { x: 0, y: 0, z: 6 } }, post: { x: 1, y: 0, z: 6 } };
  assert.equal(F.inspect(s, c, plan, 0), true);
  const f = { s, a, c, wallet, at: 0, worn: 0, finished: 0, moved: 0, stamina: 100 };
  f.h = { move() { f.moved++; }, work(seconds) { if (f.stamina < seconds / 120) return false; f.stamina -= seconds / 120; return true; },
    wear(n) { f.worn += n; }, finish() { f.finished++; return true; } };
  return f;
}
function accept(f) { const q = F.review(f.s, f.a, f.c, f.at); assert.ok(q); assert.equal(F.accept(f.s, f.a, f.c, q, f.wallet, f.at), true); }
function tick(f, seconds = 1, wrong = {}) { f.at += seconds; F.advance(f.s, f.a, { ...f.c, ...wrong }, f.h, f.at); }
function build(f) { accept(f); tick(f); assert.equal(f.s.phase, 'camp');
  assert.equal(F.beginBuild(f.s, f.c, { crateId: 'original-crate', kitIds: ['kit-1', 'kit-2'], toolId: 'hammer' }, f.at), true); }
test('original rare willingness is stable; no replacement offered, free fee, altered terms or remote acceptance', () => {
  const f = fixture(), before = copy(f.a);
  assert.equal(F.willing(f.a.id), true);
  const q = F.review(f.s, f.a, f.c, 0);
  for (const wrong of [{ personalMuster: false }, { representativePresent: false }, { alive: false }, { free: false }, { capable: false },
    { busy: true }, { sourceCurrent: false }, { planCurrent: false }, { protectorWilling: false }, { kits: false }, { provisions: false },
    { routeOpen: false }, { competingDuty: true }, { incapacitated: true }, { bodyEpoch: 2 }])
    assert.equal(F.accept(f.s, f.a, { ...f.c, ...wrong }, q, f.wallet, 0), false);
  assert.equal(F.accept(f.s, f.a, f.c, { ...q, fee: 0 }, f.wallet, 0), false);
  assert.equal(F.accept(f.s, f.a, f.c, q, f.wallet, 120), false);
  assert.deepEqual(f.a, before); assert.equal(f.wallet.money, 1000);
  accept(f); assert.equal(f.wallet.money, 760); assert.equal(f.a.money, 247); assert.equal(f.a.assignment, f.s.id);
  assert.equal(F.accept(f.s, f.a, f.c, q, f.wallet, 1), false);
  assert.equal(f.a.health, 82); assert.equal(f.a.wardMana, 100);
});
test('inspection binds actual received evidence and route; fresh same-world run inherits no camp or people', () => {
  const f = fixture();
  for (const wrong of [{ inspectedSite: false }, { busy: true }, { runId: 'other' }, { worldId: 'other' }, { alive: false }])
    assert.equal(F.inspect(f.s, { ...f.c, ...wrong }, f.s.plan, 1), false);
  assert.equal(F.inspect(f.s, f.c, { ...f.s.plan, observationIds: [] }, 1), false);
  assert.deepEqual(F.normalize(f.s), f.s);
  const fresh = F.create({ worldId: 'world', runId: 'next' });
  assert.equal(fresh.plan, null); assert.equal(fresh.agreement, null); assert.equal(fresh.camp, null);
  assert.equal(F.bound(f.s, { ...f.c, runId: 'next' }), false);
  const rebound = F.rebind(f.s, f.c, { worldId: 'imported', runId: 'continued' });
  assert.equal(rebound.plan.worldId, 'imported'); assert.deepEqual(rebound.plan.route, f.s.plan.route);
  assert.equal(F.rebind(f.s, { worldId: 'wrong', runId: 'run' }, f.c), null);
  F.review(f.s, f.a, f.c, 0);
  const quoted = F.rebind(f.s, f.c, { worldId: 'imported', runId: 'continued' });
  assert.equal(quoted.quote.plan.worldId, 'imported'); assert.equal(quoted.quote.actorId, f.a.id);
});
test('a declining or unsupported original protector cannot be replaced, numerically fabricated or made willing by payment', () => {
  const f = fixture(), before = copy(f.s);
  const declining = { ...f.a, id: Array.from({ length: 100 }, (_, n) => `declining-${n}`).find(id => !F.willing(id)) };
  assert.equal(F.review(f.s, declining, f.c, 0), null); assert.equal(f.s.agreement, null); assert.equal(f.wallet.money, 1000);
  assert.deepEqual(f.s.plan, before.plan);
  for (const field of ['health', 'workSeconds', 'stamina', 'wardMana']) {
    const a = { ...f.a }; delete a[field]; assert.equal(F.review(f.s, a, f.c, 0), null);
  }
  assert.deepEqual(f.a, fixture().a);
});
test('construction conserves original claims, spends real work/stamina/wear and pauses absence without backfill', () => {
  const f = fixture(); build(f); const claims = copy(f.s.job.claims);
  assert.equal(F.beginBuild(f.s, f.c, claims, f.at), false);
  tick(f); for (let n = 0; n < 330; n++) tick(f);
  assert.equal(f.s.job.progress, 330); assert.equal(f.a.workSeconds, 3270); assert.equal(f.worn, 1);
  for (const wrong of [{ atWork: false }, { protectorAtPost: false }, { groundSafe: false }, { buildClaimsCurrent: false }, { busy: true }, { capable: false }]) {
    tick(f, 20, wrong); tick(f); assert.equal(f.s.job.progress, 330);
  }
  tick(f, 4000); assert.equal(f.s.job.progress, 330); tick(f); assert.equal(f.s.job.progress, 330);
  f.s = F.normalize(copy(f.s)); assert.deepEqual(f.s.job.claims, claims);
  for (let n = 0; n < 330; n++) tick(f);
  assert.equal(f.s.job, null); assert.equal(f.worn, 2); assert.equal(f.finished, 1);
  assert.equal(f.s.camp.crateId, 'original-crate'); assert.deepEqual(f.s.camp.kitIds, ['kit-1', 'kit-2']);
  assert.equal(f.a.workSeconds, 2940); assert.ok(Math.abs(f.stamina - (100 - F.BUILD / 120)) < 1e-8);
  tick(f); assert.equal(f.finished, 1); assert.equal(f.s.demonstratedAt, null);
});
test('supplied camp demonstration requires original people, consumption and continuous real attendance, never city creation', () => {
  const f = fixture(); build(f); for (let n = 0; n < 662; n++) tick(f);
  assert.ok(f.s.camp); for (let n = 0; n < 601; n++) tick(f); assert.equal(f.s.demonstratedAt, null);
  assert.equal(F.shareMeal(f.s, f.c, () => false, f.at), false);
  let meals = 0; assert.equal(F.shareMeal(f.s, f.c, () => { meals++; return true; }, f.at), true);
  assert.equal(F.shareMeal(f.s, f.c, () => { meals++; return true; }, f.at), false); assert.equal(meals, 1);
  for (let n = 0; n < 300; n++) tick(f); tick(f, 1, { campIntact: false });
  assert.equal(f.s.continuityFrom, null); for (let n = 0; n < 600; n++) tick(f);
  assert.equal(f.s.demonstratedAt, null); tick(f); assert.ok(f.s.demonstratedAt);
  assert.equal(f.s.city, undefined); assert.equal(f.s.population, undefined);
  F.receive(f.s, f.c, f.at); const dated = copy(f.s.report);
  tick(f, 1, { atWork: false }); assert.deepEqual(f.s.report, dated);
  assert.equal(F.receive(f.s, { ...f.c, atWork: false, personalMuster: false }, f.at), false);
  F.receive(f.s, { ...f.c, protectorAtPost: false, personalMuster: false }, f.at);
  assert.equal(f.s.report.phase, 'camp inspected; absent protector unverified');
  assert.match(f.s.report.reason, /unverified/);
});
test('lost original assignment and incapacity cannot backfill; source loss, term and changed body require physical return', () => {
  for (const wrong of [{ sourceCurrent: false }, { planCurrent: false }, { bodyEpoch: 2 }]) {
    const f = fixture(); build(f); tick(f); const partial = f.s.job.progress;
    tick(f, 1, wrong); assert.equal(f.s.phase, 'returning'); assert.equal(f.s.job.progress, partial);
    assert.equal(f.a.assignment, f.s.id); assert.ok(f.moved); assert.equal(f.wallet.money, 760);
    tick(f, 1, { ...wrong, atHome: true }); assert.equal(f.s.phase, 'returned'); assert.equal(f.a.assignment, null);
  }
  const f = fixture(); build(f); tick(f); tick(f); const before = f.s.job.progress;
  f.a.assignment = 'other'; tick(f, 100); f.a.assignment = f.s.id; tick(f); assert.equal(f.s.job.progress, before);
  tick(f, 1, { incapacitated: true }); tick(f); assert.equal(f.s.job.progress, before);
  f.a.health = 0; tick(f); assert.equal(f.s.phase, 'fatality'); assert.equal(f.a.assignment, f.s.id);
  assert.equal(f.wallet.money, 760); assert.equal(F.review(f.s, f.a, f.c, f.at), null);
});
test('expiry and a real return reserve stop work without arrival, cash refund or clock-gap credit', () => {
  const f = fixture(); accept(f); f.at = f.s.agreement.endsAt - 1;
  tick(f); assert.equal(f.s.phase, 'returning'); assert.equal(f.a.assignment, f.s.id); assert.equal(f.wallet.money, 760);
  const g = fixture(); build(g); g.a.workSeconds = 59;
  tick(g, 1, { returnReserve: 60 }); assert.equal(g.s.phase, 'returning'); assert.equal(g.s.job.progress, 0);
  assert.equal(g.s.job.running, false); assert.equal(g.a.workSeconds, 59);
  const before = copy(g.s); tick(g, 1000, { alive: false }); assert.deepEqual(g.s, before);
});
