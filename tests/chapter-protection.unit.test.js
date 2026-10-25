const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../chapter-protection');
const S = require('../durable-supremacy');
const W = require('../wilderness-beasts');
const copy = x => JSON.parse(JSON.stringify(x));
function backing() {
  return { city: { cityId: 'b', assetId: 'people:b', currentPopulation: 100, physicalCondition: 'intact' },
    standings: [{ standing: 'licensed', network: { id: 'original-network', category: 'military', roles: ['escortContracting'], prohibitions: ['claiming police authority'] },
      branch: { id: 'original-branch', cityId: 'b', publicName: 'Original Chapter', organizationForm: 'escortChapter', publicPhysicalPresence: true,
        operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } }] };
}
function fixture() {
  const b = backing(), source = P.source(b.city, b.standings), bind = { worldId: 'world', runId: 'run' };
  const cell = (x, y) => ({ x, y, z: 21 });
  const client = { id: 'original-client', status: 'alive', health: 100, workSeconds: 1800, roomId: 'checkpoint', mapCell: cell(9, 8), assignment: null };
  const clerk = { id: 'original-clerk', status: 'alive', health: 100, roomId: 'checkpoint', mapCell: cell(9, 6), assignment: null };
  const layout = { roomId: 'checkpoint', roomIds: ['checkpoint'], home: cell(12, 6), refuge: cell(5, 5) };
  const s = P.create(source, bind, layout, client, clerk, 'chapter', 0), market = { id: 'b', treasury: 2000 };
  const c = { ...bind, source: copy(source), client, clerk, gate: { powerSeconds: 1800, receptionWorkSeconds: 1800, receptionAssignment: null },
    alive: true, capable: true, canCommission: true, authorityId: 'original-authority:b', charterId: 'original-charter:b', clientConsent: true, channel: true, local: true,
    near: true, clientNear: true, busy: false, otherBusy: false, bodyEpoch: 0, cell: cell(11, 7),
    actorIncapacitated: false, clientIncapacitated: false, seesAggressor: false, aggressorCell: cell(10, 7),
    aggressorRoom: 'checkpoint', aggressorDistanceToClient: 1, distanceToAggressor: 1, escortNear: true };
  const h = { move: (a, goal) => {
    const next = W.nextStep(a.mapCell, goal, p => p.x >= 5 && p.x <= 12 && p.y >= 5 && p.y <= 10
      && ![s.actor, client, clerk].some(other => other.id !== a.id && W.key(other.mapCell) === W.key(p)));
    if (!next) return false; a.mapCell = copy(next); return true;
  }, adjacent: (a, goal) => W.neighbors(goal).filter(p => p.x >= 5 && p.x <= 12 && p.y >= 5 && p.y <= 10)
    .sort((x, y) => W.distance(a.mapCell, x) - W.distance(a.mapCell, y))[0], strike: () => true };
  const f = { b, source, bind, client, clerk, s, c, market, h, at: 0 };
  f.tick = seconds => { f.at += seconds; P.advance(f.s, () => f.c, f.market, f.at, f.h); };
  f.attack = (name = 'first', targetId = 'original-client') => P.aggression(f.s, f.c,
    { id: name, witnessId: client.id, clientId: client.id, cityId: 'b', actorId: 'scientist', kind: 'namedPersonAttack', at: f.at, targetId }, f.at);
  return f;
}
function funded(f = fixture()) { assert.equal(f.attack(), true); f.tick(121); assert.equal(f.s.phase, 'protecting'); return f; }
test('only a supported local licensed original military chapter and population can allocate one ordinary employee', () => {
  for (const mutate of [b => b.city.currentPopulation = 8, b => b.standings[0].standing = 'proscribed',
    b => b.standings[0].network.category = 'transport', b => b.standings[0].network.roles = ['training'],
    b => b.standings[0].branch.cityId = 'another-city', b => b.standings[0].branch.operationalStatus = 'displaced',
    b => b.standings[0].branch.publicPhysicalPresence = false, b => b.standings[0].branch.capacityBand = 'nominal']) {
    const b = backing(); mutate(b); assert.equal(P.source(b.city, b.standings), null);
  }
  const f = fixture(); assert.equal(f.s.actor.id, 'original-branch:protective-duty-professional');
  assert.equal(f.s.actor.actorKind, 'civicOfficeholder'); assert.ok(!f.s.actor.exceptionalCapabilities);
});
test('heresy, a label, an unsigned claim, hearsay and an unseen report cannot initiate protection', () => {
  const f = fixture(); f.tick(300); assert.equal(f.s.contract, null); assert.equal(f.market.treasury, 2000);
  for (const report of [{ kind: 'hostileApproachClaim' }, { witnessId: 'unseen-person' }, { cityId: 'another-city' }, { at: 9999 }, { actorId: 'someone-else' }]) {
    assert.equal(P.aggression(f.s, f.c, { id: 'bad', kind: 'namedPersonAttack', witnessId: f.client.id, cityId: 'b', actorId: 'scientist', at: f.at, ...report }, f.at), false);
  }
});
test('original client/channel work and real local funds precede the same finite protective contract', () => {
  const f = fixture(); f.attack(); f.tick(61);
  assert.equal(f.s.phase, 'reporting'); assert.equal(f.market.treasury, 2000); assert.equal(f.s.job.progress, 60);
  assert.equal(f.client.workSeconds, 1740); assert.equal(f.c.gate.powerSeconds, 1740);
  f.s = P.normalize(f.s); f.tick(60);
  assert.equal(f.s.phase, 'protecting'); assert.equal(f.market.treasury, 1880);
  assert.equal(f.s.contract.mandate.authorityId, f.c.authorityId); assert.equal(f.s.contract.mandate.charterId, f.c.charterId);
  assert.equal(f.s.finances.engagement, 80); assert.equal(f.s.finances.escrow, 40);
  assert.equal(f.s.actor.foodSeconds, 43200 - 120); assert.equal(f.s.actor.workSeconds, 43200 - 120);
  assert.equal(f.client.assignment, f.s.contract.id); assert.equal(f.clerk.assignment, null); assert.equal(f.c.gate.receptionAssignment, null);
});
test('no balancing response for missing money, authority, consent, channel, finite support or existing assignments', () => {
  for (const mutate of [f => f.market.treasury = 1119, f => f.market.id = 'other-city', f => f.c.canCommission = false,
    f => f.c.clientConsent = false, f => f.c.channel = false, f => f.s.actor.assignment = 'prior-contract',
    f => f.client.assignment = 'prior-duty', f => f.clerk.assignment = 'prior-clerk-job', f => f.c.gate.powerSeconds = 120,
    f => f.s.actor.workSeconds = 0, f => f.s.actor.foodSeconds = 1, f => f.s.actor.status = 'dead']) {
    const f = fixture(); mutate(f); const money = f.market.treasury; f.attack(); f.tick(200);
    assert.equal(f.s.contract, null); assert.equal(f.market.treasury, money);
  }
});
test('a stable actual chapter refusal is not rerolled by repeating the same cause or reloading', () => {
  const f = fixture(); f.s.source.restrictions = f.c.source.restrictions = [{ id: 'policy', refusesProtectiveContracts: true, text: 'Existing chapter excludes this mandate.' }];
  f.attack(); f.tick(1); assert.equal(f.s.phase, 'declined'); assert.equal(f.s.attempts[0].decision.accepted, false);
  f.s = P.normalize(f.s); f.attack(); f.tick(100); assert.equal(f.s.attempts.length, 1); assert.equal(f.s.contract, null);
});
test('channel obstruction interrupts partial real work; no later unattended catch-up or free funding', () => {
  const f = fixture(); f.attack(); f.tick(30); const spent = f.s.actor.workSeconds;
  f.c.channel = false; f.tick(100); assert.equal(f.s.phase, 'interrupted'); assert.equal(f.market.treasury, 2000);
  assert.equal(f.client.assignment, null); assert.equal(f.s.actor.workSeconds, spent);
  f.c.channel = true; f.tick(500); assert.equal(f.s.contract, null);
});
test('source withdrawal permits only finite physical return; it neither freezes support nor commandeers another original contract', () => {
  const f = funded(); f.tick(20); const water = f.s.actor.waterSeconds;
  f.c.source = null; f.tick(30);
  assert.ok(f.s.actor.waterSeconds < water); assert.deepEqual(f.client.mapCell, f.s.clientHome.cell);
  assert.equal(f.s.contract.closed, true); assert.equal(f.market.treasury, 1880 + f.s.finances.refunded);
  const g = fixture(); g.s.actor.assignment = 'other-original-contract'; g.attack(); g.tick(500);
  assert.equal(g.s.actor.assignment, 'other-original-contract'); assert.equal(g.s.contract, null);
});
test('authority or employee support lost during transmission releases only original reservations without spending civic funds', () => {
  for (const mutate of [f => f.c.canCommission = false, f => f.c.actorIncapacitated = true, f => f.s.actor.foodSeconds = 0]) {
    const f = fixture(); f.attack(); f.tick(30); assert.equal(f.s.actor.assignment, f.s.job.id);
    mutate(f); f.tick(120); assert.equal(f.s.contract, null); assert.equal(f.market.treasury, 2000);
    assert.equal(f.s.actor.assignment, null); assert.equal(f.client.assignment, null); assert.equal(f.clerk.assignment, null);
  }
});
test('actual walking evacuates only the willing original client; obstruction supplies no teleport or replacement', () => {
  const f = funded(); const initial = copy(f.client.mapCell); f.h.move = () => false; f.tick(30);
  assert.deepEqual(f.client.mapCell, initial); assert.equal(f.client.id, 'original-client');
  const g = funded(); g.tick(30); assert.deepEqual(g.client.mapCell, g.s.layout.refuge);
  assert.ok(g.s.actor.physicalControl.stamina < 80); assert.equal(g.s.actor.id, f.s.actor.id);
});
test('a later witnessed close threat causes ordinary timed strikes, not remote punishment or a siege', () => {
  const f = funded(); let hits = 0; f.h.strike = () => { hits++; return true; }; f.attack('renewed'); f.c.seesAggressor = true;
  f.tick(12); assert.ok(hits > 0 && hits <= 3); assert.ok(f.s.kit.batonCondition < 100);
  f.c.aggressorDistanceToClient = 50; const before = hits; f.tick(30); assert.equal(hits, before);
  assert.equal(f.s.contracts.length, 0); assert.equal(f.market.treasury, 1880); // No second force/payment.
});
test('partial personally attended parley survives reload; exact body-bound acceptance protects voluntary withdrawal only', () => {
  const f = funded(); assert.equal(P.parley(f.s, f.c, f.at), true); f.tick(20);
  f.s = P.normalize(f.s); assert.equal(f.s.job.progress, 20); f.tick(40);
  const q = copy(f.s.quote); assert.ok(q); assert.match(q.terms, /No research, faith, city authority/);
  assert.equal(P.accept(f.s, f.c, { ...q, clientId: 'someone-else' }, f.at), false);
  assert.equal(P.accept(f.s, { ...f.c, bodyEpoch: 1 }, q, f.at), false);
  assert.equal(P.accept(f.s, f.c, q, f.at), true); assert.equal(f.s.phase, 'settled');
  f.tick(30); assert.equal(f.market.treasury, 1880); assert.deepEqual(f.client.mapCell, f.s.layout.refuge);
  f.attack('actual-new-attack'); assert.ok(f.s.promise.breachedAt); assert.equal(f.s.phase, 'protecting');
});
test('moving, other work, incapacity or expired exact terms cannot finish a conversation', () => {
  for (const mutate of [f => f.c.cell.x++, f => f.c.otherBusy = true, f => f.c.actorIncapacitated = true, f => f.c.bodyEpoch++]) {
    const f = funded(); P.parley(f.s, f.c, f.at); f.tick(10); mutate(f); f.tick(60);
    assert.equal(f.s.quote, null); assert.equal(f.s.job, null);
  }
  const f = funded(); P.parley(f.s, f.c, f.at); f.tick(60); const q = copy(f.s.quote); f.tick(300);
  assert.equal(P.accept(f.s, f.c, q, f.at), false);
});
test('only continuous actual bodily obstruction breaches the protected withdrawal; another barrier is not player misconduct', () => {
  const f = funded(); P.parley(f.s, f.c, f.at); f.tick(60); P.accept(f.s, f.c, copy(f.s.quote), f.at);
  f.h.move = () => false; f.c.blockedByScientist = () => false; f.tick(60); assert.equal(f.s.promise.breachedAt, null);
  f.c.blockedByScientist = () => true; f.tick(29); assert.equal(f.s.promise.breachedAt, null);
  f.tick(1); assert.ok(f.s.promise.breachedAt); assert.equal(f.market.treasury, 1880);
});
test('a recovered body inherits neither the departed body promise nor an old exact offer; renewed terms spend the same remaining contract', () => {
  const f = funded(); P.parley(f.s, f.c, f.at); f.tick(60); P.accept(f.s, f.c, copy(f.s.quote), f.at);
  const deadline = f.s.contract.endsAt, original = copy(f.s.promise); f.c.bodyEpoch++;
  f.tick(1); assert.equal(f.s.phase, 'protecting'); assert.deepEqual(f.s.promise, original);
  assert.equal(P.parley(f.s, f.c, f.at), true); f.tick(60);
  assert.equal(P.accept(f.s, f.c, copy(f.s.quote), f.at), true); assert.equal(f.s.promise.bodyEpoch, 1);
  assert.equal(f.s.promises[0].bodyEpoch, 0); assert.equal(f.s.contract.endsAt, deadline); assert.equal(f.market.treasury, 1880);
});
test('expiry returns surviving original people physically and settles unused escrow once without replenishment', () => {
  const f = funded(), a = f.s.actor.id, initial = f.s.actor.workSeconds;
  f.tick(P.HOURS + 50); assert.equal(f.s.contract.closed, true); assert.deepEqual(f.client.mapCell, f.s.clientHome.cell);
  assert.deepEqual(f.s.actor.mapCell, f.s.layout.home); assert.equal(f.s.actor.id, a); assert.ok(f.s.actor.workSeconds < initial);
  assert.ok(P.normalize(f.s));
  const money = f.market.treasury; f.tick(1000); assert.equal(f.market.treasury, money);
  assert.ok(Math.abs(f.market.treasury + f.s.finances.engagement + f.s.finances.earnedWages + f.s.finances.escrow - 2000) < 1e-6);
});
test('a dead professional retains the original remains; client return and money do not create another employee', () => {
  const f = funded(); f.tick(10); const remains = copy(f.s.actor.mapCell);
  Object.assign(f.s.actor, { status: 'dead', health: 0, diedAt: f.at }); f.tick(50);
  assert.equal(f.s.contract.closed, true); assert.deepEqual(f.s.actor.mapCell, remains); assert.equal(f.s.actor.status, 'dead');
  assert.ok(f.s.finances.refunded > 39); assert.equal(f.s.finances.escrow, 0);
  f.attack('later'); f.tick(200); assert.equal(f.s.contracts.length, 1); assert.equal(f.s.actor.status, 'dead');
});
test('dated observations omit hidden capacity and remain unchanged away; local settlement cannot certify a whole network', () => {
  const f = funded(); assert.equal(P.observe(f.s, { ...f.c, observed: false }, f.at), false);
  P.observe(f.s, { ...f.c, observed: true, actorVisible: true, clientVisible: true }, f.at);
  const v = P.publicView(f.s); f.tick(30); assert.deepEqual(P.publicView(f.s), v);
  assert.ok(!/foodSeconds|workSeconds|finances|capacityBand|hostileUntil/.test(JSON.stringify(v)));
  const fact = P.fact(f.s, { effectiveChallenge: false }, f.at);
  assert.equal(S.factState({ id: fact.targetId, sourceId: fact.sourceId, kind: 'counterpower' }, fact, f.bind, f.at), 'unverified');
  assert.equal(fact.state, 'unverified'); assert.notEqual(fact.state, 'retired');
});
test('coarse/fine catch-up and normalization retain original funding, positions, elapsed work and once-only cause', () => {
  const coarse = fixture(), fine = fixture(); coarse.attack(); fine.attack(); coarse.tick(300);
  for (let i = 0; i < 300; i++) { if (i === 60) fine.s = P.normalize(fine.s); fine.tick(1); }
  assert.deepEqual(fine.s, coarse.s); assert.deepEqual(fine.client, coarse.client); assert.deepEqual(fine.market, coarse.market);
});
test('continued copies rebind the same finite assets while independent runs inherit no commitment; death freezes everything', () => {
  const f = funded(), before = copy(f.s); f.c.alive = false; f.tick(1000); assert.deepEqual(f.s, before);
  const to = { worldId: 'copy', runId: 'continued' }, next = P.rebind(f.s, f.bind, to);
  assert.equal(next.actor.id, f.s.actor.id); assert.deepEqual(next.finances, f.s.finances);
  assert.equal(P.rebind(f.s, { ...f.bind, runId: 'independent' }, to), null);
  assert.equal(P.current(next, f.c), false); assert.equal(fixture().s.contract, null);
});
test('long idle intervals neither replenish people nor accrue wages, and a mismatched run cannot advance their bodies', () => {
  const f = fixture(), before = copy(f.s.actor); f.tick(30 * 86400);
  assert.deepEqual(f.s.actor, before); assert.equal(f.market.treasury, 2000); assert.equal(f.s.finances.earnedWages, 0);
  const saved = copy(f.s); P.advance(f.s, () => ({ ...f.c, runId: 'other' }), f.market, f.at + 500, f.h); assert.deepEqual(f.s, saved);
});
test('a lethal protective strike stops the pulse and all later contact work immediately', () => {
  const f = funded(); f.attack('new'); f.c.seesAggressor = true;
  let strikes = 0; f.h.strike = () => { strikes++; f.c.alive = false; return true; };
  f.tick(10); assert.equal(strikes, 1); const before = copy({ s: f.s, client: f.client, market: f.market });
  f.tick(500); assert.deepEqual({ s: f.s, client: f.client, market: f.market }, before);
});
