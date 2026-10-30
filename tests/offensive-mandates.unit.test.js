const { test } = require('node:test'), assert = require('node:assert/strict');
const O = require('../offensive-mandates'), F = require('../network-interdiction'), I = require('../network-inventories');
const N = require('../network-operations'), { fixture, Definitions } = require('./helpers/institutional-inventory-source');
const Ground = require('../terrestrial-forces');
const copy = v => JSON.parse(JSON.stringify(v));
function setup(seed = 'original-offensive-muster') {
  const d = Definitions.find(d => d.id === 'non-state-network.shared.bastion-contract');
  const f = fixture([d], 256); f.n = f.s;
  f.field = F.create(F.originalSources(f.n), f.binding, 'original-field-employees', 0);
  assert(I.adopt(f.n, 'interdiction', f.field, f.binding));
  f.s = O.create(f.binding, 0); f.u = f.field.units[0];
  f.target = { cityId: 'city:0', charterId: 'original-charter', authorityId: 'original-collective', kind: 'collective' };
  // Exact target is an input contract, not a changed municipal refusal/result.
  f.layout = { roomId: 'original-chapter', roomIds: ['original-chapter', 'original-approach'], returnRoom: 'original-counter',
    homes: [{ x: 2, y: 2, z: 6 }, { x: 4, y: 2, z: 6 }], visitor: { x: 3, y: 1, z: 6 } };
  const account = f.n.accounts[0];
  f.c = { alive: true, capable: true, atCounter: true, local: true, near: true, free: true, sourceCurrent: true,
    refusalReceived: true, target: f.target, bodyEpoch: 0, atPost: true, returnRouteOpen: true, returnSeconds: 100,
    heardIds: f.u.actors.map(a => a.id), manager: account.operator, terminal: account.terminal };
  f.p = O.open(f.s, f.n, f.field, f.u.id, f.target, f.layout, f.c, seed, 0); assert(f.p);
  f.at = 0; f.wallet = { money: 1000 }; f.alive = true; f.blocked = false; f.moves = 0;
  f.h = { alive: () => f.alive, incapacitated: a => a.incapacitated,
    followGoal: (_, a) => ({ ...a.mapCell, y: a.mapCell.y + 1 }),
    move: (_, a, goal) => { if (f.blocked) return false; f.moves++;
      const k = ['x', 'y', 'z'].find(k => a.mapCell[k] !== goal[k]);
      if (k) a.mapCell[k] += Math.sign(goal[k] - a.mapCell[k]); return Boolean(k); } };
  f.tick = seconds => { f.at += seconds; return O.advance(f.s, f.n, f.field, () => f.c, f.at, f.h); };
  return f;
}
function offered(f = setup()) {
  assert(O.review(f.s, f.p, f.n, f.field, f.c, f.at)); f.tick(60);
  assert.equal(f.p.phase, 'offered', JSON.stringify(f.p.report)); return f;
}
function hired(f = offered()) {
  assert(O.accept(f.s, f.p, f.n, f.field, f.c, copy(f.p.quote), f.wallet, f.at)); return f;
}
test('separate offensive purpose borrows exactly the original owner’s field team, not defensive employees, population or a new army', () => {
  const f = setup(), refs = [...f.u.actors], before = copy(f.n.inventories);
  assert.equal(O.sources(f.n, f.field, 'city:0').length, 1);
  assert.equal(f.p.target.kind, 'collective'); assert.equal(f.u.actors.length, 2);
  assert(f.u.actors.every((a, i) => a === refs[i] && a.assignment === null));
  assert.deepEqual(f.n.inventories, before);
  assert(!('control' in f.p)); assert(!('operation' in f.p)); assert(!('army' in f.p));
  assert.equal(O.open(f.s, f.n, f.field, f.u.id, f.target, f.layout, f.c, 'never-reroll', 0), f.p);
});
test('original inventory loss, wrong branch ownership, unrelated service or cross-run book cannot supply a substitute force', () => {
  for (const change of [f => f.n.inventories.assets.find(a => a.id === f.u.id).lost = true,
    f => f.n.inventories.assets.find(a => a.id === f.u.id).ownerId = 'branch:someone-else',
    f => f.n.inventories.assets.find(a => a.id === f.u.id).external.service = 'escort',
    f => f.field.runId = 'another-run', f => f.u.actors.pop(), f => f.s.runId = 'another-run']) {
    const f = setup(); change(f);
    assert.equal(O.resolve(f.s, f.n, f.field, f.p), null);
    assert(!O.review(f.s, f.p, f.n, f.field, f.c, 0)); assert.equal(f.wallet.money, 1000);
  }
});
test('review spends actual original desk/member work and power, pauses on absence, and cannot backfill or share an operator second', () => {
  const f = setup(); assert(O.review(f.s, f.p, f.n, f.field, f.c, 0));
  f.tick(20); assert.equal(f.p.job.progress, 20); assert.equal(f.c.manager.workSeconds, 14380);
  assert.equal(f.u.actors[0].workSeconds, 43180); assert.equal(f.c.terminal.powerSeconds, 14380);
  f.c.near = false; f.tick(200); assert.equal(f.p.job.progress, 20);
  f.c.near = true; f.c.manager.lastOperatingWorkAt = f.at + 1; f.tick(1); assert.equal(f.p.job.progress, 20);
  f.tick(40); assert.equal(f.p.phase, 'offered'); assert.equal(f.c.manager.workSeconds, 14340);
  assert.equal(f.wallet.money, 1000); assert(f.u.actors.every(a => !a.assignment));
});
test('a different living desk operator with the same ID is not the original shared work account', () => {
  const f = setup(); f.c.manager = copy(f.c.manager);
  assert(!O.review(f.s, f.p, f.n, f.field, f.c, 0));
});
test('stable original employee refusal is not rerolled by money, repeated review, save or fresh invitation', () => {
  const f = setup('fixed-refusal');
  assert(O.review(f.s, f.p, f.n, f.field, f.c, 0)); f.tick(60); assert.equal(f.p.phase, 'refused');
  assert(!O.review(f.s, f.p, f.n, f.field, f.c, f.at)); assert.equal(f.wallet.money, 1000);
  const s = O.normalize(f.s); assert(s); assert.equal(s.posts[0].refusedAt, 60);
  assert.equal(O.open(f.s, f.n, f.field, f.u.id, f.target, f.layout, f.c, 'different-seed', 60), f.p);
});
test('the original local chapter can independently refuse even when both original employees consider the mandate', () => {
  const f = setup('original-branch-policy-2');
  assert(f.u.actors.every(a => a.offensivePolicy === 'considerBoundedMandate'));
  assert.equal(f.c.manager.offensivePolicy, 'refuseRegimeChange');
  assert(O.review(f.s, f.p, f.n, f.field, f.c, f.at)); f.tick(60); assert.equal(f.p.phase, 'refused');
  assert(!O.review(f.s, f.p, f.n, f.field, f.c, f.at)); assert.equal(f.wallet.money, 1000);
});
test('missing retained participant disposition stays unavailable instead of being interpreted as consent or rerolled', () => {
  const f = setup(); delete f.u.actors[0].offensivePolicy;
  assert(O.review(f.s, f.p, f.n, f.field, f.c, f.at)); f.tick(60);
  assert.equal(f.p.quote, null); assert.equal(f.p.phase, 'available'); assert.equal(f.wallet.money, 1000);
  assert.equal(O.open(f.s, f.n, f.field, f.u.id, f.target, f.layout, f.c, 'never-repair-missing-consent', f.at), f.p);
  assert.equal(f.u.actors[0].offensivePolicy, undefined);
});
test('changed exact terms, absent funds, body/target mismatch, lost kit or inaccessible return cannot take money or assign people', () => {
  for (const change of [f => f.wallet.money = 271, f => f.c.bodyEpoch++, f => f.c.target = { ...f.target, charterId: 'other' },
    f => f.u.actors[0].fieldKit.toolCondition = 0, f => f.c.returnRouteOpen = false,
    f => f.c.returnSeconds = 601, f => f.c.heardIds.pop(), f => f.p.quote.total = 1]) {
    const f = offered(), expected = copy(f.p.quote); change(f); const before = f.wallet.money;
    assert(!O.accept(f.s, f.p, f.n, f.field, f.c, expected, f.wallet, f.at));
    assert.equal(f.wallet.money, before); assert.equal(f.p.contract, null); assert(f.u.actors.every(a => !a.assignment));
  }
  const f = offered(); f.tick(300); assert(!O.accept(f.s, f.p, f.n, f.field, f.c, f.p.quote, f.wallet, f.at));
});
test('real escrow earns finite actual waiting/movement wages and only heard original people obey, without a control grant', () => {
  const f = hired(); assert.equal(f.wallet.money, 728); assert.equal(f.p.contract.escrow, 192);
  assert(f.u.actors.every(a => a.money === 40));
  f.c.heardIds = [f.u.actors[0].id]; assert(O.command(f.s, f.p, f.n, f.field, f.c, 'follow', f.at));
  f.tick(10); assert.equal(f.moves, 10); assert.equal(f.u.actors[1].mapCell.y, 2);
  assert(Math.abs(f.p.contract.earned - 20 * O.RATE) < 1e-8);
  assert(!O.command(f.s, f.p, f.n, f.field, f.c, 'assault', f.at));
  assert(!O.command(f.s, f.p, f.n, f.field, f.c, 'occupy', f.at));
  assert(!('control' in f.p)); assert.equal(f.u.actors[0].workSeconds, 43130);
});
test('withdrawal requires real return, blocked/injured original bodies remain, and unused escrow refunds once at the original post', () => {
  const f = hired(); assert(O.command(f.s, f.p, f.n, f.field, f.c, 'follow', f.at)); f.tick(5);
  assert(O.command(f.s, f.p, f.n, f.field, f.c, 'withdraw', f.at)); f.blocked = true; f.tick(10);
  assert.notEqual(f.p.phase, 'returned'); const held = copy(f.u.actors.map(a => a.mapCell));
  f.u.actors[0].incapacitated = true; f.blocked = false; f.tick(5); assert.equal(f.p.phase, 'stranded');
  assert.deepEqual(f.u.actors[0].mapCell, held[0]); assert(!O.settle(f.s, f.p, f.n, f.field, f.c, f.wallet, f.at));
  f.u.actors[0].incapacitated = false; f.tick(10); assert.equal(f.p.phase, 'returned');
  assert.deepEqual(f.u.actors.map(a => a.mapCell), f.layout.homes); assert(f.u.actors.every(a => !a.assignment));
  const refund = f.p.contract.escrow; f.c.atPost = false; assert(!O.settle(f.s, f.p, f.n, f.field, f.c, f.wallet, f.at));
  f.c.atPost = true; assert(O.settle(f.s, f.p, f.n, f.field, f.c, f.wallet, f.at));
  assert(Math.abs(f.wallet.money - (728 + refund)) < 1e-8);
  assert(!O.settle(f.s, f.p, f.n, f.field, f.c, f.wallet, f.at));
  assert(O.normalize(f.s)); assert(f.u.actors[0].workSeconds < 43200);
});
test('contract expiry withdraws the same paid original people rather than renewing, refilling, teleporting or abandoning injuries', () => {
  const f = hired(); f.u.actors[0].mapCell.y += 5; f.u.actors[0].health = 60;
  f.blocked = true; f.tick(O.DUTY); assert.notEqual(f.p.phase, 'returned'); assert(f.p.contract.escrow < 1e-6);
  assert.equal(f.u.actors[0].health, 60); assert.equal(f.u.actors[0].mapCell.y, 7);
  f.blocked = false; f.tick(10); assert.equal(f.p.phase, 'returned'); assert.equal(f.u.actors[0].health, 60);
  assert(!O.review(f.s, f.p, f.n, f.field, f.c, f.at));
});
test('original corpses remain where they fell, received reports stay dated, and final scientist death freezes book, money and bodies', () => {
  const f = hired(); const old = copy(O.publicView(f.s));
  f.u.actors[0].status = 'dead'; f.u.actors[0].health = 0; const remains = copy(f.u.actors[0].mapCell);
  f.tick(5); assert.deepEqual(f.u.actors[0].mapCell, remains); assert.deepEqual(O.publicView(f.s), old);
  const before = copy({ book: f.s, field: f.field, wallet: f.wallet }); f.alive = false; f.tick(100);
  assert.deepEqual({ book: f.s, field: f.field, wallet: f.wallet }, before);
});
test('personal contact cannot locate an unseen teammate or reveal their private death through a whole-team phase', () => {
  const f = hired(); f.c.heardIds = [f.u.actors[0].id]; f.c.observedIds = [f.u.actors[0].id];
  f.u.actors[1].status = 'dead'; f.u.actors[1].health = 0; f.u.actors[1].mapCell.y += 100; f.tick(1);
  const r = O.receive(f.s, f.p, f.n, f.field, f.c, f.at);
  assert.equal(r.phase, 'partialLocalContact'); assert.deepEqual(r.people.map(a => a.id), [f.u.actors[0].id]);
  assert(!r.message.includes('dead')); const old = copy(O.publicView(f.s)); f.tick(10); assert.deepEqual(O.publicView(f.s), old);
});
test('normalization and continued rebind retain original people by reference owner IDs, pending work and exact spending; corrupt escrow cannot regenerate', () => {
  const f = hired(); f.tick(7); const s = O.normalize(f.s); assert(s);
  const to = { worldId: 'continued-world', runId: 'continued-run' };
  const n = N.rebind(f.n, f.binding, to), field = F.rebind(f.field, f.binding, to), book = O.rebind(s, f.binding, to);
  assert(book && n && field); assert(O.resolve(book, n, field, book.posts[0]));
  assert.deepEqual(book.posts[0].contract, f.p.contract); assert.deepEqual(field.units[0].actors, f.u.actors);
  assert.equal(O.rebind(s, to, to), null); const bad = copy(s); bad.posts[0].contract.escrow++;
  assert.equal(O.normalize(bad), null); assert.deepEqual(O.create(f.binding, 0).posts, []);
});
test('old interdiction cannot spend or deploy the physically mustered originals, and source accounting retains the separate mandate', () => {
  const f = hired(), before = copy(f.u.actors);
  F.reserve(f.field, f.n);
  assert.equal(f.n.accounts[0].allocations.find(a => a.id === f.u.id).assignment, f.p.contract.id);
  F.advance(f.field, f.n, () => ({ breach: { id: 'old-breach' } }), 10, { alive: () => true });
  assert.deepEqual(f.u.actors, before); assert.equal(f.u.deployment, null);
  const run = { networkInterdiction: f.field, offensiveMandates: f.s };
  const means = Ground.outcomes(f.n, run).owners.flatMap(o => o.means).filter(m => m.id.startsWith(f.u.id));
  assert.equal(means.length, 3); assert(means.every(m => m.intent.includes('no performed assault or city control')));
  assert(means.every(m => m.contract.id === f.p.contract.id));
  delete run.offensiveMandates;
  assert(Ground.outcomes(f.n, run).owners.flatMap(o => o.means).filter(m => m.id.startsWith(f.u.id)).every(m => m.state === 'unverified'));
});
test('prospective review start cannot collect work before its actual start, cancellation releases only its own reservations', () => {
  const f = setup(); assert(O.review(f.s, f.p, f.n, f.field, f.c, 100)); f.tick(100);
  assert.equal(f.p.job.progress, 0); f.tick(5); assert.equal(f.p.job.progress, 5);
  f.c.manager.assignment = 'another-actual-duty'; assert(O.cancel(f.p, f.u, f.c));
  assert.equal(f.c.manager.assignment, 'another-actual-duty'); assert(f.u.actors.every(a => !a.assignment));
  assert.equal(f.u.actors[0].workSeconds, 43195);
});
test('unreceived refusal, absent counter/body or source, unavailable original desk and missing terminal cannot create work or charge money', () => {
  for (const key of ['refusalReceived', 'atCounter', 'free', 'sourceCurrent', 'alive', 'capable']) {
    const f = setup(), b = O.create(f.binding, 0); f.c[key] = false;
    assert.equal(O.open(b, f.n, f.field, f.u.id, f.target, f.layout, f.c, 'not-a-reroll', 0), null);
    assert.deepEqual(b.posts, []); assert.equal(f.wallet.money, 1000);
  }
  for (const change of [f => f.c.manager.status = 'dead', f => f.c.manager.workSeconds = 59,
    f => { f.n.accounts[0].terminal = null; f.c.terminal = null; }, f => f.c.terminal.powerSeconds = 59]) {
    const f = setup(); change(f); assert(!O.review(f.s, f.p, f.n, f.field, f.c, f.at));
    assert.equal(f.p.job, null); assert.equal(f.wallet.money, 1000);
  }
});
test('coarse, fine and saved continuation conserve the same wages, original duty, stock and no time before signing', () => {
  const a = hired(), b = hired(); a.tick(100);
  for (let i = 0; i < 100; i++) b.tick(1);
  assert.deepEqual(a.s, b.s); assert.deepEqual(a.u.actors, b.u.actors);
  const c = hired(); c.tick(35); c.s = O.normalize(c.s); c.p = c.s.posts[0]; c.tick(65);
  assert.deepEqual(a.s, c.s); assert.deepEqual(a.u.actors, c.u.actors);
});
