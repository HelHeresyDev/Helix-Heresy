const { test } = require('node:test');
const assert = require('node:assert/strict');
const Force = require('../field-force');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const e = { source: { cityId: 'b', populationSourceId: 'people:b' }, roomId: 'ground', entry: { z: 21 }, wilderness: { roomId: 'wild', gate: { x: 20, y: 12, z: 21 } } };
  const city = { cityId: 'b', assetId: 'people:b', currentPopulation: 100, physicalCondition: 'intact' };
  const entry = { standing: 'licensed', network: { id: 'military:b', category: 'military', roles: ['escortContracting', 'perimeterDefense'], prohibitions: ['claiming police authority'] },
    branch: { id: 'chapter:b', publicName: 'Birch Guards', currentCityId: 'b', organizationForm: 'escortChapter', publicPhysicalPresence: true,
      operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } };
  const source = Force.source(city, [entry], e), s = Force.create(source, e, 'force', 0);
  const posts = [{ x: 20, y: 12, z: 21 }, { x: 21, y: 12, z: 21 }];
  const c = { source, alive: true, capable: true, originalBody: true, originalTrip: true, near: true, atGround: true, bodyEpoch: 1, visitId: 'v', tripId: 't',
    supplied: true, routeOk: true, refugeValid: true, plan: { id: 'refuge', home: { x: 12, y: 10, z: 21 }, route: [{ x: 12, y: 10, z: 21 }, posts[0]], posts, travelSeconds: 600 } };
  return { s, c, city, e, entry, wallet: { money: 1000 }, flags: {}, moves: 0, defended: 0 };
}
function hire(f) { const q = Force.review(f.s, f.c, 0); assert(q); assert(Force.accept(f.s, f.c, q, f.wallet, 0)); return q; }
function hooks(f) {
  return { alive: f.flags.alive !== false, current: () => !f.flags.providerLost, refugeValid: () => !f.flags.refugeLost,
    physiology: () => {}, defend: () => { f.defended++; }, care: () => Boolean(f.flags.care),
    context: m => ({ supplied: !f.flags.shortage, threatCount: f.flags.threats || 0, incapacitated: f.flags.incapacitated === m.actor.id,
      accompanied: !f.flags.absent, atHome: JSON.stringify(m.actor.mapCell) === JSON.stringify(m.layout.meeting),
      atPost: JSON.stringify(m.actor.mapCell) === JSON.stringify(f.c.plan.posts[f.s.members.indexOf(m)]) }),
    move: (m, goal) => { if (!f.flags.blocked) { m.actor.mapCell = copy(goal); f.moves++; } } };
}
function tick(f, until) { for (let at = f.s.operation.lastAt + 1; at <= until; at++) Force.advance(f.s, at, hooks(f)); }
test('two separate original defensive allocations require real local chapter role, population and functional capacity', () => {
  const f = fixture(), original = copy(f);
  assert.equal(f.s.members.length, 2); assert.equal(new Set(f.s.members.map(m => m.actor.id)).size, 2);
  assert(f.s.members.every(m => !m.actor.id.endsWith('field-survey-professional')));
  for (const change of [{ currentPopulation: 15 }, { physicalCondition: 'ruined' }, { habitationStatus: 'destroyed' }])
    assert.equal(Force.source({ ...f.city, ...change }, [f.entry], f.e), null);
  for (const change of [{ organizationForm: 'trainingHall' }, { publicPhysicalPresence: false }, { capacityBand: 'weak' }, { operationalStatus: 'inactive' }])
    assert.equal(Force.source(f.city, [{ ...f.entry, branch: { ...f.entry.branch, ...change } }], f.e), null);
  assert.equal(Force.source(f.city, [{ ...f.entry, network: { ...f.entry.network, roles: ['escortContracting'] } }], f.e), null);
  assert.deepEqual(f, original);
});
test('single review discloses exact prepaid travel/watch/return scope and binds original people, body, trip, policy and plan', () => {
  const f = fixture(); const q = Force.review(f.s, f.c, 0); assert(q);
  assert.equal(q.budgetSeconds, 15900); assert.equal(q.reserveEach, 89); assert.equal(q.upfront, 298);
  for (const c of [{ ...f.c, bodyEpoch: 2 }, { ...f.c, tripId: 'other' }, { ...f.c, supplied: false }, { ...f.c, plan: { ...f.c.plan, travelSeconds: 700 } },
    { ...f.c, source: { ...f.c.source, restrictions: [{ id: 'oath', text: 'No heretics.', refusesDeclaredOpposition: true }] } }])
    assert.equal(Force.accept(f.s, c, q, f.wallet, 1), false);
  assert.equal(Force.accept(f.s, f.c, { ...q, upfront: 0 }, f.wallet, 1), false);
  assert.equal(Force.accept(f.s, f.c, q, { money: 297 }, 1), false);
  assert.equal(Force.accept(f.s, f.c, q, f.wallet, 60), false);
  assert(Force.accept(f.s, f.c, q, f.wallet, 1)); assert.equal(f.wallet.money, 702);
  assert(f.s.members.every(m => m.actor.money === 60 && m.dutySeconds === Force.DUTY));
});
test('actual restrictions refuse stably without inventing a universal anti-heretic oath or treating police prohibition as defense prohibition', () => {
  const f = fixture(); assert(Force.review(f.s, f.c, 0));
  f.c.source.restrictions = [{ id: 'oath', text: 'We refuse declared opponents of our god.', refusesDeclaredOpposition: true }];
  assert.equal(Force.review(f.s, f.c, 1), null); assert.match(f.s.reply.text, /refuse/);
  f.s = copy(f.s); assert.equal(Force.review(f.s, f.c, 2), null);
  f.c.source.restrictions = []; assert(Force.review(f.s, f.c, 3));
});
test('unsupported posts, long route, depleted kit, danger and original incapacity refuse departure', () => {
  for (const change of [{ supplied: false }, { threatened: true }, { routeOk: false }, { refugeValid: false }, { incapacitatedIds: ['chapter:b:refuge-guard-1'] }]) {
    const f = fixture(); assert.equal(Force.review(f.s, { ...f.c, ...change }, 0), null);
  }
  const f = fixture(); f.c.plan.travelSeconds = 16000; assert.equal(Force.review(f.s, f.c, 0), null);
  f.c.plan.travelSeconds = 600; f.c.plan.posts[1] = copy(f.c.plan.posts[0]); assert.equal(Force.review(f.s, f.c, 0), null);
});
test('outward attendance is physical; finite paid waiting cannot manufacture arrival or an indefinite reserve', () => {
  const f = fixture(); hire(f); f.flags.absent = true; tick(f, 599);
  assert.equal(f.moves, 0); assert.equal(f.s.operation.watchStartedAt, null);
  assert(f.s.members.every(m => m.dutySeconds === Force.DUTY - 599 && m.contract.earned > 3));
  tick(f, 601); assert.equal(f.s.operation.phase, 'returned'); assert.equal(f.s.operation.watchStartedAt, null);
  assert.match(f.s.operation.reason, /travel\/wait/);
});
test('both actual positions start one fixed watch; accepted safe duty continues absent employer without knowledge or remote command', () => {
  const f = fixture(); hire(f); tick(f, 1); assert.equal(f.s.operation.phase, 'watch');
  const ends = f.s.operation.watchEndsAt; assert.equal(ends, 14401);
  assert(Force.receive(f.s, f.c, 1)); const report = copy(f.s.report);
  f.flags.absent = true; tick(f, 1000); assert.equal(f.s.operation.phase, 'watch');
  assert.equal(Force.order(f.s, { ...f.c, near: false }, 'withdraw', 1000), false);
  assert.equal(Force.receive(f.s, { ...f.c, near: false }, 1000), false); assert.deepEqual(f.s.report, report);
  assert.equal(Force.order(f.s, { ...f.c, bodyEpoch: 2 }, 'withdraw', 1000), false);
  for (const order of ['assault', 'arrest', 'seize', 'pursue']) assert.equal(Force.order(f.s, f.c, order, 1000), false);
  assert(Force.order(f.s, { ...f.c, atRefuge: true }, 'hold', 1000)); assert.equal(f.s.operation.watchEndsAt, ends);
  tick(f, ends + 1); assert.equal(f.s.operation.phase, 'returned'); assert(f.s.members.every(m => m.phase === 'returned'));
});
test('original wages stop on physical return; personal settlement refunds unused reserve exactly once without renewing people, equipment or duty', () => {
  const f = fixture(), q = hire(f); tick(f, 2); assert(Force.order(f.s, f.c, 'withdraw', 2)); tick(f, 4);
  assert.equal(f.s.operation.phase, 'returned'); const before = copy(f.s.members), earned = f.s.operation.earned;
  tick(f, 500); assert.equal(f.s.operation.earned, earned);
  assert.equal(Force.settle(f.s, { ...f.c, near: false }, f.wallet, 500), false);
  assert(Force.settle(f.s, f.c, f.wallet, 500)); const money = f.wallet.money;
  assert(money < 1000 - 2 * q.feeEach); assert.equal(Force.settle(f.s, f.c, f.wallet, 501), false);
  assert.equal(f.wallet.money, money);
  const settled = copy(before); for (const m of settled) {
    const paid = Math.ceil(m.contract.earned - 1e-8); m.actor.money = Math.round((m.actor.money + paid - m.contract.earned) * 1e8) / 1e8; m.contract.earned = paid;
  }
  assert.deepEqual(f.s.members, settled); assert.equal(Number.isInteger(money), true);
  assert.equal(money + f.s.members.reduce((n, m) => n + m.actor.money, 0), 1000);
  const next = Force.review(f.s, f.c, 502); assert(next);
  assert(Force.accept(f.s, f.c, next, f.wallet, 502)); assert.equal(f.s.history.length, 1);
  assert.deepEqual(f.s.members.map(m => m.dutySeconds), before.map(m => m.dutySeconds));
  assert.equal(f.s.operation.id.endsWith('watch-2'), true);
});
test('shortage, danger, provider/refuge loss and original exhaustion prompt physical withdrawal, never teleportation', () => {
  for (const flag of ['shortage', 'providerLost', 'refugeLost', 'threats']) {
    const f = fixture(); hire(f); tick(f, 2); f.flags[flag] = flag === 'threats' ? 3 : true; f.flags.blocked = true;
    const cells = f.s.members.map(m => copy(m.actor.mapCell)); tick(f, 10);
    assert.equal(f.s.operation.phase, 'returning', flag); assert.deepEqual(f.s.members.map(m => m.actor.mapCell), cells);
    assert(f.s.members.every(m => m.contract.earned > 0));
    f.flags.blocked = false; tick(f, 12); assert.equal(f.s.operation.phase, 'returned');
  }
});
test('incapacitated original body remains; surviving member can return without replacement and corpse does not respawn', () => {
  const f = fixture(); hire(f); tick(f, 2); const original = f.s.members.map(m => m.actor.id);
  f.s.members[0].actor.health = 20; f.flags.incapacitated = original[0]; tick(f, 5);
  assert.equal(f.s.members[0].phase, 'returning'); assert.equal(f.s.members[1].phase, 'returned');
  f.s.members[0].actor.status = 'dead'; f.s.members[0].actor.diedAt = 5; tick(f, 6);
  assert.equal(f.s.members[0].phase, 'fatality'); assert.equal(f.s.operation.phase, 'returned');
  assert.deepEqual(f.s.members.map(m => m.actor.id), original); assert.equal(Force.review(f.s, f.c, 7), null);
});
test('actual serialized partial operation resumes deterministically and irreversible scientist death freezes it', () => {
  const f = fixture(); hire(f); tick(f, 500); const g = copy(f); tick(f, 1000); tick(g, 750); tick(g, 1000);
  assert.deepEqual(f, g); f.flags.alive = false; const saved = copy(f.s); tick(f, 1010); assert.deepEqual(f.s, saved);
});
test('replacement member or allocation cannot inherit original command or quote; away review cannot reveal live refusal', () => {
  const f = fixture(); const q = Force.review(f.s, f.c, 0), reply = copy(f.s.reply);
  f.s.members[0].actor.id = 'replacement'; assert.equal(Force.accept(f.s, f.c, q, f.wallet, 1), false);
  assert.equal(Force.review(f.s, { ...f.c, near: false }, 1), null); assert.deepEqual(f.s.reply, reply);
});
test('original guard off-duty recovery consumes real supplies and restores duty only after eight supported hours, not health or gear', () => {
  const Recovery = require('../foreign-escort-recovery'), f = fixture(); hire(f); tick(f, 2);
  Force.withdraw(f.s, 2, 'Return'); tick(f, 4); assert(Force.settle(f.s, f.c, f.wallet, 4));
  const m = f.s.members[0]; m.dutySeconds = 100; m.actor.health = 72; m.gearCondition.original = 43;
  m.restPlace = { id: 'original-shelter', actorId: m.actor.id, branchId: m.source.branchId };
  const c = { ...f.c, source: m.source, atRestPlace: true, placeUsable: true, declaredOpposition: true };
  const stacks = [{ id: 'original-water', section: 'inventory', key: 'drinkingWater', carriedBy: m.actor.id, quantity: 2, knownQuantity: 2 },
    { id: 'original-meal', section: 'inventory', key: 'trailMeal', carriedBy: m.actor.id, quantity: 1, knownQuantity: 1 }];
  assert(Recovery.begin(m, c, stacks, 5)); assert.equal(stacks[0].quantity, 1); assert.equal(stacks[1].quantity, 0);
  assert.equal(Force.review(f.s, { ...f.c, recovering: true }, 5), null);
  Recovery.advance(m, c, stacks, 3605); assert.equal(m.dutySeconds, 100);
  const saved = copy({ m, stacks }); Recovery.advance(saved.m, { ...c, placeUsable: false }, saved.stacks, 3705);
  assert.equal(saved.m.recovery.progressSeconds, 3600); assert.equal(saved.m.dutySeconds, 100);
  Recovery.advance(m, c, stacks, 28805); assert.equal(m.recovery.status, 'completed'); assert.equal(m.dutySeconds, Force.DUTY);
  assert.equal(m.actor.health, 72); assert.equal(m.gearCondition.original, 43); assert.equal(stacks[0].quantity, 1);
});
test('provider loss does not erase original personal wage settlement obligations', () => {
  const f = fixture(); hire(f); tick(f, 2); f.flags.providerLost = true; tick(f, 4);
  assert.equal(f.s.operation.phase, 'returned');
  assert(Force.receive(f.s, { ...f.c, source: null }, 5));
  assert(Force.settle(f.s, { ...f.c, source: null, visitId: 'later-visit', tripId: 'later-trip' }, f.wallet, 5));
  assert.equal(Force.review(f.s, { ...f.c, source: null }, 6), null);
});
test('assaulted original members refuse renewed employment without erasing settlement or spawning willing replacements', () => {
  const f = fixture(); hire(f); tick(f, 2); f.s.employerAssault = { at: 2, actorId: f.s.members[0].actor.id };
  Force.withdraw(f.s, 2, 'Employer assault'); tick(f, 4); assert(Force.settle(f.s, f.c, f.wallet, 4));
  assert.equal(Force.review(f.s, f.c, 5), null); assert.match(f.s.reply.text, /assaulted/);
  f.s = copy(f.s); assert.equal(Force.review(f.s, f.c, 6), null); assert.equal(f.s.members.length, 2);
});
test('a reunited survivor reports only their own dated account, never the unseen stranded member’s current body or stocks', () => {
  const f = fixture(); hire(f); tick(f, 2); f.s.members[1].actor.health = 5;
  assert(Force.receive(f.s, { ...f.c, near: false, reporterIds: [f.s.members[0].actor.id] }, 3));
  assert.equal(f.s.report.members.length, 1); assert.equal(f.s.report.members[0].actorId, f.s.members[0].actor.id);
  assert.equal(f.s.report.partial, true);
  assert.equal(f.s.report.members.some(m => m.health === 5), false);
});
