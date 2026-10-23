const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../founding-works');
const F = require('../founding-expedition');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const binding = { worldId: 'world', runId: 'run' };
  const id = Array.from({ length: 1000 }, (_, n) => `original-${n}`).find(id => F.willing(id) && W.willing(id));
  const a = { id, health: 81, status: 'alive', fatigue: 12, workSeconds: 2400, stamina: 75, wardMana: 92,
    exceptionalCapabilities: ['city-scale ward defense'], money: 3 };
  const origin = { x: 25, y: 12, z: 6 };
  const expedition = { ...binding, id: 'original-project', demonstratedAt: 50, camp: { crateId: 'original-crate' },
    plan: { worldId: 'world', siteId: 'boundary', origin, home: { roomId: 'city', cell: { x: 18, y: 9, z: 6 } },
      post: { x: 26, y: 13, z: 6 }, route: [{ x: 18, y: 9, z: 6 }, { x: 19, y: 9, z: 6 }] } };
  const s = W.create(binding, expedition, { cityId: 'city', populationSourceId: 'original-population', population: 100, sourceKey: 'original-charter' });
  const f = { a, s, binding, at: 100, wallet: { money: 4000 }, spent: 0, wears: 0, released: 0, effort: 100, travel: 0, installed: {}, arrived: false, returned: false };
  const c = f.c = { ...binding, alive: true, free: true, capable: true, busy: false, bodyEpoch: 1, safe: true, campIntact: true,
    atCamp: true, atCounter: true, sourceCurrent: true, representativePresent: true, advanceReturned: true,
    routeOpen: true, supportRoute: true, layoutClear: true, availablePopulation: 100, musterClear: true, returnAdmission: { cityId: 'city' },
    protectorWilling: true, protectorAtHome: true, returnReserve: 100, protectorPresent: true, partySupplied: true,
    supplied: true, toolCurrent: true, targetClear: true, originalPart: true, physicalWorksIntact: true,
    observedIds: [a.id], observedParts: [], musterCells: [0, 1, 2, 3].map(x => ({ x, y: 0, z: 6 })),
    arrived: () => f.arrived, returned: () => f.returned };
  f.h = { effort(n) { if (f.effort < n) return false; f.effort -= n; return true; }, wear(n) { f.wears += n; },
    release() { f.released++; }, travel() { f.travel++; },
    labor(dt) { let work = 0; for (const p of f.s.people) if (p.phase === 'resident' && W.able(p.actor) && p.duty > 0) {
      const n = Math.min(dt, p.duty, f.s.job.seconds - f.s.job.progress - work); p.duty -= n; p.earned += n * W.WAGE; work += n; } return work; },
    install(p, r, fraction) { f.installed[p.id] = (f.installed[p.id] || 1) + fraction * 99; r.physicalId ||= p.id; } };
  f.pay = () => { f.spent++; return true; };
  return f;
}
function tick(f, seconds = 1, wrong = {}) { f.at += seconds; W.advance(f.s, f.a, { ...f.c, ...wrong }, f.h, f.at); }
function assessed(f) {
  f.s.investigations = { stone: { estimatedStoneTonnes: 8000 }, water: { testLitresPerDay: 9000 }, ground: { cultivableSquareMetres: 20 } };
  assert.equal(W.registerLayout(f.s, f.c, W.layout(f.s.plan.origin), f.at), true);
}
function accepted(f) { assessed(f); const q = W.review(f.s, f.a, f.c, f.at); assert.ok(q, f.s.reason);
  assert.equal(W.accept(f.s, f.a, f.c, copy(q), f.wallet, f.at), true); }
function arrived(f) { accepted(f); assert.equal(W.depart(f.s, f.a, f.c, ['kit:0', 'kit:1', 'kit:2', 'kit:3'], f.at), true);
  tick(f); assert.equal(f.s.phase, 'outward'); f.arrived = true; tick(f); assert.equal(f.s.phase, 'works'); }
test('only the demonstrated original camp and finite original population can seed works; new games inherit nothing', () => {
  const f = fixture(); assert.ok(f.s); assert.deepEqual(W.normalize(f.s), f.s);
  assert.equal(W.create(f.binding, { ...f.s, camp: null }, f.s.source), null);
  assert.equal(W.create(f.binding, { ...f.s, camp: {} }, { ...f.s.source, population: 4 }), null);
  assert.equal(W.bound(f.s, { ...f.binding, runId: 'fresh' }), false);
  assert.equal(W.normalize({ ...f.s, people: [{ actor: { id: 'x' } }] }), null);
  const rebound = W.rebind(f.s, f.binding, { worldId: 'continued-world', runId: 'continued-run' });
  assert.equal(rebound.plan.worldId, 'continued-world'); assert.deepEqual(rebound.source, f.s.source);
  assert.deepEqual(rebound.plan.route, f.s.plan.route); assert.equal(W.rebind(f.s, { worldId: 'wrong', runId: 'run' }, f.binding), null);
});
test('assessment is fixed by the original source, scoped to real ground and creates no supply or convenient missing resource', () => {
  const context = { worldId: 'world', siteId: 'boundary', seed: 'fixed', truth: { potentialPermille: {}, surfaceAccessibilityPermille: 1000 } };
  assert.equal(W.measurement('stone', context, 20, 1).estimatedStoneTonnes, 0);
  assert.equal(W.measurement('water', context, 20, 1).testLitresPerDay, 0);
  assert.equal(W.measurement('ground', context, 20, 1).cultivableSquareMetres, 0);
  context.truth.potentialPermille = { constructionStone: 1000, freshWater: 1000, biologicalProductivity: 1000 };
  const result = W.measurement('stone', context, 20, 1);
  assert.deepEqual(W.measurement('stone', context, 200, 1), result);
  assert.equal(W.measurement('ground', context, 20, 1).cultivableSquareMetres, 16);
  assert.match(result.qualification, /not proven recoverable/); assert.equal(result.goods, undefined);
  assert.equal(W.measurement('water', { siteId: 'boundary' }, 20, 1), null);
});
test('investigation spends inputs once; real attendance, original tool, support and wear survive partial reload', () => {
  const f = fixture(), captured = { kind: 'stone', siteId: 'boundary', estimatedStoneTonnes: 8000 };
  assert.equal(W.beginInvestigation(f.s, f.c, 'stone', { toolId: 'original-kit' }, captured, () => false, f.at), false);
  assert.equal(W.beginInvestigation(f.s, f.c, 'stone', { toolId: 'original-kit' }, captured, f.pay, f.at), true);
  assert.equal(f.spent, 1); tick(f); for (let n = 0; n < 900; n++) tick(f);
  const progress = f.s.job.progress; assert.equal(progress, 900); assert.equal(f.wears, 1);
  for (const wrong of [{ atCamp: false }, { safe: false }, { toolCurrent: false }, { capable: false }, { free: false },
    { busy: true }, { sourceCurrent: false }, { campIntact: false }, { bodyEpoch: 2 }, { workFit: false }, { jobAttendance: false }]) { tick(f, 1, wrong); tick(f); assert.equal(f.s.job.progress, progress); }
  tick(f, 4000); tick(f); assert.equal(f.s.job.progress, progress);
  f.s = W.normalize(f.s); for (let n = 0; n < 900; n++) tick(f);
  assert.equal(f.s.job, null); assert.equal(f.s.investigations.stone.estimatedStoneTonnes, 8000); assert.equal(f.wears, 2);
  assert.equal(W.beginInvestigation(f.s, f.c, 'stone', { toolId: 'other' }, captured, f.pay, f.at), false); assert.equal(f.spent, 1);
});
test('layout fixes substantial real components and gate; support and actual inspection are necessary', () => {
  const f = fixture(), l = W.layout(f.s.plan.origin);
  assert.equal(l.parts.filter(p => p.kind === 'wall').length, 23);
  assert.equal(l.parts.filter(p => p.kind === 'gate').length, 1);
  assert.equal(l.parts.length, 33); assert.deepEqual(W.totals(l.parts), { stoneBlocks: 744, metalParts: 54, lumber: 40, cloth: 8 });
  assert.ok(l.parts.filter(p => p.kind === 'roof').every(p => p.cell.z === p.work.z + 1));
  for (const wrong of [{ layoutClear: false }, { supportRoute: false }, { atCamp: false }, { safe: false }, { alive: false }])
    assert.equal(W.registerLayout(f.s, { ...f.c, ...wrong }, l, f.at), false);
  assert.equal(W.registerLayout(f.s, f.c, { ...l, gate: { x: 0, y: 0, z: 6 } }, f.at), false);
  assert.equal(W.registerLayout(f.s, f.c, l, f.at), true); assert.equal(W.registerLayout(f.s, f.c, l, f.at), false);
});
test('short advance release never grants a longer commitment, more followers, a replacement guardian or god endorsement', () => {
  const f = fixture(); assessed(f);
  const declining = { ...f.a, id: Array.from({ length: 100 }, (_, n) => `decline-${n}`).find(id => !W.willing(id)) };
  assert.equal(W.review(f.s, declining, f.c, f.at), null); assert.equal(f.s.people.length, 0);
  for (const wrong of [{ advanceReturned: false }, { atCounter: false }, { protectorAtHome: false }, { sourceCurrent: false },
    { representativePresent: false }, { protectorWilling: false }, { competingDuty: true }, { availablePopulation: 4 },
    { musterClear: false }, { returnAdmission: null }, { musterCells: [] }, { routeOpen: false }, { campIntact: false }])
    assert.equal(W.review(f.s, f.a, { ...f.c, ...wrong }, f.at), null);
  f.s.investigations.water.testLitresPerDay = 0; assert.equal(W.review(f.s, f.a, f.c, f.at), null);
  assert.match(f.s.reason, /no deposit/); assert.equal(f.wallet.money, 4000); assert.equal(f.a.money, 3);
});
test('exact personal acceptance conserves fee, prepaid wages and source identities without healing or population duplication', () => {
  const f = fixture(); assessed(f); const q = W.review(f.s, f.a, f.c, f.at), original = copy(f.a);
  assert.equal(W.accept(f.s, f.a, f.c, { ...q, fee: 0 }, f.wallet, f.at), false);
  assert.equal(W.accept(f.s, f.a, { ...f.c, bodyEpoch: 2 }, q, f.wallet, f.at), false);
  assert.equal(W.accept(f.s, f.a, f.c, q, f.wallet, q.expiresAt), false);
  assert.equal(W.accept(f.s, f.a, f.c, q, { money: 1200 }, f.at), false);
  assert.equal(W.accept(f.s, f.a, f.c, q, f.wallet, f.at), true);
  assert.equal(f.wallet.money, 4000 - 1200 - 192); assert.equal(f.a.money, 1203); assert.equal(f.a.assignment, f.s.id);
  for (const key of ['health', 'stamina', 'wardMana', 'workSeconds']) assert.equal(f.a[key], original[key]);
  assert.equal(new Set(f.s.people.map(p => p.actor.id)).size, 4); assert.equal(f.s.ledger.allocated, 4); assert.equal(f.s.ledger.departed.length, 0);
  assert.equal(W.accept(f.s, f.a, f.c, q, f.wallet, f.at), false); assert.equal(f.s.people.length, 4);
  assert.equal(f.s.city, undefined); assert.equal(f.s.divineEndorsement, undefined);
});
test('departure requires separate physical kits, supplies and original people; travel awards no remote labor', () => {
  const f = fixture(); accepted(f);
  const ids = ['kit:0', 'kit:1', 'kit:2', 'kit:3'];
  for (const wrong of [{ partySupplied: false }, { protectorAtHome: false }, { routeOpen: false }, { atCounter: false }, { sourceCurrent: false }])
    assert.equal(W.depart(f.s, f.a, { ...f.c, ...wrong }, ids, f.at), false);
  assert.equal(W.depart(f.s, f.a, f.c, ['same', 'same', 'same', 'same'], f.at), false);
  assert.equal(W.depart(f.s, f.a, f.c, ids, f.at), true); assert.equal(f.s.ledger.departed.length, 4);
  tick(f); assert.equal(f.s.phase, 'outward'); assert.equal(f.travel, 1);
  assert.equal(W.beginPart(f.s, f.c, f.s.layout.parts[0].id, { toolId: 'hammer' }, f.pay, f.at), false);
  tick(f, 1, { routeOpen: false }); assert.equal(f.travel, 1); tick(f, 1000); assert.equal(f.travel, 1);
  f.arrived = true; tick(f); assert.equal(f.s.phase, 'works'); assert.ok(f.s.people.every(p => p.phase === 'resident'));
});
test('supplied original residents construct real partial works, cannot reroll costs or earn through unsupported intervals', () => {
  const f = fixture(); arrived(f); const p = f.s.layout.parts[0];
  for (const wrong of [{ atCamp: false }, { protectorPresent: false }, { safe: false }, { targetClear: false }, { supplied: false }, { routeOpen: false }])
    assert.equal(W.beginPart(f.s, { ...f.c, ...wrong }, p.id, { toolId: 'hammer' }, f.pay, f.at), false);
  assert.equal(W.beginPart(f.s, f.c, p.id, { toolId: 'hammer' }, f.pay, f.at), true); tick(f); tick(f, 1);
  assert.equal(f.s.job.progress, 4); assert.equal(f.spent, 1); assert.ok(f.s.people.every(p => p.duty === W.DUTY - 1));
  const earned = f.s.people.map(p => p.earned), progress = f.s.job.progress;
  for (const wrong of [{ originalPart: false }, { protectorPresent: false }, { supplied: false }, { safe: false }, { busy: true }, { workFit: false }, { jobAttendance: false }]) {
    tick(f, 1, wrong); tick(f); assert.equal(f.s.job.progress, progress); assert.deepEqual(f.s.people.map(p => p.earned), earned); }
  f.effort = 0; tick(f); assert.deepEqual(f.s.people.map(p => p.earned), earned); assert.equal(f.s.job.progress, progress);
  f.effort = 100; f.s = W.normalize(f.s); for (let n = 0; n < 900; n++) tick(f);
  assert.equal(f.s.job, null); assert.equal(f.s.parts[p.id].progress, p.seconds); assert.equal(f.wears, 2);
  assert.ok(Math.abs(f.installed[p.id] - 100) < 1e-8);
  assert.equal(W.beginPart(f.s, f.c, p.id, { toolId: 'new-hammer' }, f.pay, f.at), false); assert.equal(f.spent, 1);
});
test('only actual surviving complete supplied works and present residents support a dated milestone, never city creation', () => {
  const f = fixture(); arrived(f);
  assert.equal(W.milestone(f.s, f.c, f.at), false);
  for (const p of f.s.layout.parts) {
    assert.equal(W.beginPart(f.s, f.c, p.id, { toolId: 'original-hammer' }, f.pay, f.at), true);
    while (f.s.job) tick(f);
  }
  for (const wrong of [{ physicalWorksIntact: false }, { safe: false }, { protectorPresent: false }, { supplied: false }, { atCamp: false }, { routeOpen: false }])
    assert.equal(W.milestone(f.s, { ...f.c, ...wrong }, f.at), false);
  assert.equal(W.milestone(f.s, f.c, f.at), true); assert.equal(f.s.milestoneAt, f.at);
  assert.equal(f.s.city, undefined); assert.equal(f.s.sovereignty, undefined);
  assert.ok(f.s.people.every(p => p.duty > 0)); assert.equal(f.spent, 33);
});
test('withdrawal and original deaths preserve costs/property and require real return; only returned unused wages settle once', () => {
  const f = fixture(); arrived(f); const p = f.s.layout.parts[0];
  W.beginPart(f.s, f.c, p.id, { toolId: 'hammer' }, f.pay, f.at); tick(f); tick(f);
  const partial = copy(f.s.parts), funds = f.wallet.money;
  f.s.people[0].actor.health = 0; f.s.people[0].actor.status = 'dead'; tick(f);
  assert.equal(f.s.phase, 'returning'); assert.equal(f.s.ledger.deaths.length, 1); assert.deepEqual(f.s.parts, partial);
  assert.equal(W.settle(f.s, f.c, f.wallet), false); assert.equal(f.wallet.money, funds);
  f.s.people.slice(1).forEach(p => { p.phase = 'returned'; f.s.ledger.returned.push(p.actor.id); }); f.returned = true; tick(f);
  assert.equal(f.s.phase, 'abandoned'); assert.equal(f.a.assignment, null); assert.equal(f.a.money, 1203);
  assert.equal(W.settle(f.s, f.c, f.wallet), true); const settled = f.wallet.money;
  assert.equal(W.settle(f.s, f.c, f.wallet), false); assert.equal(f.wallet.money, settled);
  assert.equal(f.s.people.length, 4); assert.equal(f.s.people[0].settled, false); assert.deepEqual(f.s.parts, partial);
});
test('changed identity, source loss, incapacity and finite expiry withdraw; scientist death freezes all state', () => {
  for (const loss of [{ workSeconds: 100 }, { stamina: 14 }, { exceptionalCapabilities: [] }]) {
    const f = fixture(); arrived(f); Object.assign(f.a, loss); tick(f);
    assert.equal(f.s.phase, 'returning'); assert.equal(f.a.assignment, f.s.id);
  }
  for (const wrong of [{ bodyEpoch: 2 }, { sourceCurrent: false }, { campIntact: false }]) {
    const f = fixture(); arrived(f); tick(f, 1, wrong); assert.equal(f.s.phase, 'returning'); assert.equal(f.wallet.money, 2608);
  }
  const f = fixture(); arrived(f); const before = copy(f.s); tick(f, 1, { alive: false }); assert.deepEqual(f.s, before);
  f.at = f.s.agreement.endsAt - 1; f.s.lastAt = f.at; tick(f); assert.equal(f.s.phase, 'returning'); assert.equal(f.a.assignment, f.s.id);
});
test('personal reports contain only observed people/parts and never reveal unseen deaths or private readiness', () => {
  const f = fixture(); arrived(f); f.s.people[0].actor.status = 'dead';
  assert.equal(W.receive(f.s, { ...f.c, atCamp: false, atCounter: false }, f.a, f.at), false);
  assert.equal(W.receive(f.s, { ...f.c, atCamp: false, observedIds: [], observedParts: [{ secret: true }] }, f.a, f.at), true);
  assert.deepEqual(f.s.report.people, []); assert.equal(f.s.report.protector, null); assert.equal(f.s.report.parts, null);
  assert.equal(f.s.report.phase, undefined); assert.equal(f.s.report.reason, undefined);
  const dated = copy(f.s.report); tick(f); assert.deepEqual(f.s.report, dated);
});
test('source population and available labor lose the original migrants once; returned survivors do not erase deaths', () => {
  const f = fixture(); const before = copy(f.s.source);
  assert.deepEqual(W.population(f.s, 'city', 100), { residents: 100, availableLabor: 100, away: 0, assigned: 0 });
  accepted(f); assert.deepEqual(W.population(f.s, 'city', 100), { residents: 100, availableLabor: 96, away: 0, assigned: 4 });
  W.depart(f.s, f.a, f.c, ['a', 'b', 'c', 'd'], f.at);
  assert.deepEqual(W.population(f.s, 'city', 100), { residents: 96, availableLabor: 96, away: 4, assigned: 0 });
  f.s.people[0].actor.status = 'dead'; f.s.people.slice(1).forEach(p => { p.phase = 'returned'; f.s.ledger.returned.push(p.actor.id); });
  assert.deepEqual(W.population(f.s, 'city', 100), { residents: 99, availableLabor: 99, away: 1, assigned: 0 });
  assert.deepEqual(W.population(f.s, 'other-city', 100), { residents: 100, availableLabor: 100, away: 0, assigned: 0 });
  assert.deepEqual(f.s.source, before); assert.equal(W.population(f.s, 'city', NaN), null);
});
test('limited personal projected cover requires actual original protector, witnessed beast attack and finite mana/work', () => {
  const f = fixture(); arrived(f);
  const c = { ...f.c, lineOfEffect: true, hostileBeast: true }, hit = { targetId: f.s.people[0].actor.id, amount: 10, damageTypes: ['physical'] };
  const mana = f.a.wardMana, duty = f.a.workSeconds;
  for (const wrong of [{ lineOfEffect: false }, { protectorPresent: false }, { hostileBeast: false }, { sourceCurrent: false },
    { incapacitated: true }, { alive: false }, { runId: 'other' }]) assert.deepEqual(W.absorb(f.s, f.a, { ...c, ...wrong }, hit, f.at), { damage: 10, absorbed: 0 });
  assert.deepEqual(W.absorb(f.s, f.a, c, { ...hit, targetId: 'unrelated-stranger' }, f.at), { damage: 10, absorbed: 0 });
  assert.deepEqual(W.absorb(f.s, f.a, c, { ...hit, damageTypes: ['soul'] }, f.at), { damage: 10, absorbed: 0 });
  assert.equal(f.a.wardMana, mana); assert.equal(f.a.workSeconds, duty);
  assert.deepEqual(W.absorb(f.s, f.a, c, hit, f.at), { damage: 4, absorbed: 6 });
  assert.equal(f.a.wardMana, mana - 12); assert.equal(f.a.workSeconds, duty - 1);
  f.a.wardMana = 2; assert.deepEqual(W.absorb(f.s, f.a, c, hit, f.at), { damage: 9, absorbed: 1 });
  assert.equal(f.a.wardMana, 0); assert.deepEqual(W.absorb(f.s, f.a, c, hit, f.at), { damage: 10, absorbed: 0 });
  assert.equal(f.s.city, undefined);
});
