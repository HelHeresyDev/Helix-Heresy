const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../divine-submission'), B = require('../divine-bodies'), O = require('../divine-capabilities');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(motive = 'protectFollowers', divinity = 'divine') {
  const god = { id: 'original', privateObjective: motive, objectives: ['protectFollowers'],
    stableIdentity: { mortalIdentityId: 'mortal:a', originKind: 'beast' }, domains: ['fire'],
    lifecycle: { lifeState: 'living', divinityState: divinity },
    divineCore: { identityBound: true, state: 'stable', repeatableSignature: 'same-soul', innateCapacity: 400, receivingCapacity: 600 },
    power: { reserve: 450, reserveCapacity: 2000 }, worshipSources: [{ populationSourceId: 'faithful', followerUnits: 12 }] };
  const book = O.create({ complete: true, rows: [{ godId: god.id, god, faith: { id: 'faith:a', tenets: ['keep followers safe'] } }] },
    { worldId: 'world', runId: 'run' }, 0, true);
  const s = B.create(book, [{ godId: god.id, cityId: 'a', cellId: 'planet:1', placeId: 'city:a', name: 'Original' }], 0), a = s.bodies[0];
  const c = { alive: true, capable: true, field: true, roomId: B.ROOM, cityId: 'a', cellId: 'planet:1', placeId: 'survey:a',
    visible: true, tracks: true, lineOfEffect: true, distance: 2, researched: true, animancy: 201, instrument: true,
    free: true, bodyEpoch: 0, mana: 70, resonanceDamage: 2000, combatReady: true, cell: { x: 10, y: 16, z: 6 } };
  const stacks = [{ key: 'arcaneFeedstock', quantity: 12, carriedBy: 'scientist', cell: copy(c.cell) }];
  a.identified = { signature: a.signature, at: 0 }; // Prior personal examination; never an allegiance input.
  return { s, a, book, c, stacks, at: 0 };
}
function wound(f, amount = 1600) {
  const loss = B.absorb(f.s, f.book, f.a, amount + 400, f.c);
  f.a.health -= loss;
  f.a.lastDamage = { serial: (f.a.lastDamage?.serial || 0) + 1, amount: loss, at: f.at, bodyEpoch: 0, attackerId: 'scientist' };
}
function demand(f) { return S.demand(f.s, f.book, f.a, f.stacks, f.c, f.at); }
function tick(f, n = 1, move) {
  for (let i = 0; i < n; i++) {
    f.at++;
    B.advance(f.s, f.book, f.at, () => f.c, { control: (a, c, at, dt) => S.control(f.s, f.book, a, c, at, dt, move) });
  }
}
test('actual original wound and present lethal capability obtain exact personal submission without reallocating faithful or obligations', () => {
  const f = fixture(), originals = copy(f.book.originals), faithful = copy(f.book.records[0].god.worshipSources);
  assert(!demand(f)); wound(f); assert(demand(f)); assert.equal(f.a.submission.status, 'accepted');
  assert.equal(f.a.health, 200); assert.equal(f.book.records[0].god.power.reserve, 50);
  assert.equal(f.a.submission.terms, S.TERMS); assert(!demand(f));
  assert.deepEqual(f.book.originals, originals); assert.deepEqual(f.book.records[0].god.worshipSources, faithful);
  assert.deepEqual(f.book.agreements, []); assert(!S.command(f.s, f.book, f.a, f.c, 'assaultCity', 0));
  assert(!JSON.stringify(S.publicView(f.a)).includes('privateObjective'));
});
test('an independent refuser does not reroll unchanged or greater force; original conflicting commands cannot be signed away', () => {
  for (const setup of [f => {}, f => f.book.records[0].god.independentCommands = ['original-obligation']]) {
    const f = fixture('opposeRivals'); setup(f); wound(f); assert(demand(f)); assert.equal(f.a.submission.status, 'refused');
    const before = copy(f.a.submission); assert(!demand(f)); f.a.lastDamage.serial++; assert(!demand(f));
    assert.deepEqual(f.a.submission, before); assert(!S.command(f.s, f.book, f.a, f.c, 'protect', 0));
  }
});
test('unidentified avatars, remote ground, incapacity, depleted present means and a different scientist body cannot coerce submission', () => {
  const changes = [f => f.a.identified = null, f => f.a = { ...f.a }, f => f.c.placeId = 'satellite:a',
    f => f.c.capable = false, f => f.c.incapacitated = true, f => f.c.visible = false, f => f.c.tracks = false,
    f => f.c.lineOfEffect = false, f => f.c.mana = 29, f => delete f.c.mana, f => f.c.combatReady = false, f => f.c.free = false,
    f => f.c.suppressed = true, f => f.c.instrument = false, f => f.c.bodyEpoch = 1, f => f.stacks[0].quantity = 2,
    f => f.stacks[0].reservedTaskId = 'other', f => f.c.resonanceDamage = 100];
  for (const change of changes) { const f = fixture(); wound(f); change(f); assert(!demand(f)); }
});
test('useful same-ground ward spends original reserve once per actual interception, with no soul immunity or remote coverage', () => {
  const f = fixture(); wound(f); demand(f);
  assert(S.command(f.s, f.book, f.a, f.c, 'protect', 0)); tick(f);
  assert.equal(f.book.records[0].god.power.reserve, 49); assert.equal(f.a.stamina, 499);
  assert.equal(S.absorb(f.s, f.book, f.a, f.c, 30, ['physical'], f.at, 'enemy'), 20);
  assert.equal(f.book.records[0].god.power.reserve, 9); assert.equal(f.a.submission.command.absorbed, 20);
  for (const c of [{ ...f.c, distance: 3 }, { ...f.c, lineOfEffect: false }, { ...f.c, magicSuppressed: true }, { ...f.c, placeId: 'satellite:a' }])
    assert.equal(S.absorb(f.s, f.book, f.a, c, 30, ['physical'], f.at, 'enemy'), 0);
  assert.equal(S.absorb(f.s, f.book, f.a, f.c, 30, ['soul'], f.at, 'enemy'), 0);
  assert.equal(S.absorb(f.s, f.book, f.a, f.c, 30, ['physical'], f.at, f.a.id), 0);
  assert.equal(S.absorb(f.s, f.book, f.a, f.c, 30, ['force'], f.at, 'enemy'), 4);
  tick(f, 2); assert.equal(f.book.records[0].god.power.reserve, 0); assert.equal(f.a.submission.command.status, 'unavailable');
  assert(!S.command(f.s, f.book, f.a, f.c, 'protect', f.at)); assert.equal(f.a.submission.status, 'accepted');
});
test('endurance, descent and suppression independently prevent unsupported protection without curing wounds or ending political submission', () => {
  for (const change of [f => f.a.stamina = 0, f => f.book.records[0].god.lifecycle.divinityState = 'descended', f => f.c.magicSuppressed = true]) {
    const f = fixture(); wound(f); demand(f); change(f);
    const original = copy(f.book.records[0].god); assert(!S.command(f.s, f.book, f.a, f.c, 'protect', 0));
    assert.equal(f.a.health, 200); assert.equal(f.a.submission.status, 'accepted'); assert.deepEqual(f.book.records[0].god, original);
  }
});
test('heard finite protection ends after two actual minutes, pauses without off-ground backfill and never creates a new account', () => {
  const f = fixture(); f.book.records[0].god.power.reserve = 800; // Initial finite original stock for this long-service case.
  wound(f, 1000); demand(f); // 800 health, same finite body, 400 reserve left after its actual ward.
  S.command(f.s, f.book, f.a, f.c, 'protect', 0); tick(f, 20);
  f.c.placeId = 'elsewhere'; tick(f, 500); assert.equal(f.a.submission.command.progress, 20);
  f.c.placeId = 'survey:a'; tick(f, 100); assert.equal(f.a.submission.command.status, 'complete');
  assert.equal(f.book.records[0].god.power.reserve, 280); assert.equal(f.a.stamina, 380); assert.equal(f.a.health, 800);
});
test('hold and withdrawal move the same wounded body through supplied collision-aware steps, never teleport or replenish it', () => {
  const f = fixture(); wound(f); demand(f); f.a.mapCell.x += 3;
  assert(S.command(f.s, f.book, f.a, f.c, 'withdraw', 0)); const p = copy(f.a.mapCell);
  tick(f, 2, () => false); assert.deepEqual(f.a.mapCell, p); assert.equal(f.a.stamina, 500);
  tick(f, 3, (a, target, retreat, exact) => { assert(exact); assert(!retreat); assert.deepEqual(target, a.homeCell); a.mapCell.x--; return true; });
  assert.deepEqual(f.a.mapCell, f.a.homeCell); assert.equal(f.a.stamina, 497); assert.equal(f.a.health, 200);
  assert(S.command(f.s, f.book, f.a, f.c, 'hold', f.at)); tick(f, 10); assert.equal(f.a.stamina, 497);
});
test('actual breach loses control, old leverage cannot reassert it, and a NEW wound can enforce re-submission without erasing memory', () => {
  const f = fixture(); wound(f); demand(f); const first = copy(f.a.submission.history);
  assert(B.attack(f.s, f.book, f.a, f.c, 0)); tick(f); assert.equal(f.a.submission.status, 'rebelled'); assert(f.a.hostile);
  assert(!S.command(f.s, f.book, f.a, f.c, 'standDown', f.at)); assert(!demand(f));
  f.a.health -= 18; f.a.lastDamage = { ...f.a.lastDamage, serial: 2, at: f.at, amount: 18 };
  assert(demand(f)); assert.equal(f.a.submission.status, 'accepted'); assert.equal(f.a.health, 182);
  assert.deepEqual(f.a.submission.history.slice(0, first.length), first); assert.equal(f.a.submission.history.filter(r => r.kind === 'accepted').length, 2);
});
test('witnessed attack activation breaks terms before damage; its new genuine wound can support reassertion but a miss cannot', () => {
  const f = fixture(); wound(f); demand(f);
  B.attack(f.s, f.book, f.a, f.c, f.at); S.witnessAttack(f.s, f.book, f.a, f.c, f.at);
  assert.equal(f.a.submission.status, 'rebelled'); assert.equal(f.a.submission.forceSerial, 1); assert(!demand(f));
  f.a.health -= 18; f.a.lastDamage = { ...f.a.lastDamage, serial: 2, amount: 18 };
  assert(demand(f)); assert.equal(f.a.health, 182); assert.equal(f.a.submission.status, 'accepted');
  const frozen = copy(f.a); assert(!S.control(f.s, f.book, f.a, { ...f.c, alive: false }, 500, 500)); assert.deepEqual(f.a, frozen);
});
test('observed incapacity/suppression is a real opening, private absent vulnerability is not, and conflicting duties retain refusal', () => {
  const f = fixture(); wound(f); demand(f); f.c.tracks = false; f.c.suppressed = true; tick(f);
  assert.equal(f.a.submission.status, 'accepted'); f.c.tracks = true; tick(f); assert.equal(f.a.submission.status, 'rebelled');
  const g = fixture(); wound(g); demand(g); g.book.records[0].god.unresolvedCommitments = ['protect-original-shrine'];
  assert(!S.command(g.s, g.book, g.a, g.c, 'withdraw', 0)); assert.deepEqual(g.book.records[0].god.unresolvedCommitments, ['protect-original-shrine']);
});
test('saves, continued binding, release, original death and final scientist death retain causality and freeze spending', () => {
  const f = fixture(); wound(f); demand(f); S.command(f.s, f.book, f.a, f.c, 'protect', 0); tick(f, 10);
  const next = { worldId: 'world', runId: 'continued' };
  f.s = B.rebind(copy(f.s), f.book, next); f.book = O.rebind(copy(f.book), f.book, next); f.a = f.s.bodies[0];
  assert(S.valid(f.a)); assert.equal(f.a.health, 200); assert.equal(f.a.submission.command.progress, 10);
  assert.equal(f.book.records[0].god.power.reserve, 40); assert.equal(f.a.stamina, 490);
  const frozen = copy({ s: f.s, book: f.book }); f.c.alive = false; tick(f, 1000);
  assert(!demand(f)); assert(!S.command(f.s, f.book, f.a, f.c, 'release', f.at));
  assert.equal(S.absorb(f.s, f.book, f.a, f.c, 20, ['physical'], f.at, 'enemy'), 0);
  assert.deepEqual({ s: f.s, book: f.book }, frozen);
  f.c.alive = true; assert(S.command(f.s, f.book, f.a, f.c, 'release', f.at)); assert.equal(f.a.submission.status, 'released');
  assert(!demand(f)); f.a.health = 0; B.death(f.s, f.book, f.a, f.at, 'actual injury'); tick(f);
  assert.equal(f.a.submission.status, 'dead'); assert.equal(f.s.bodies.length, 1);
});
test('forged terms, altered identity or malformed service cannot supply authority after import', () => {
  for (const change of [a => a.submission.terms = 'unlimited control', a => a.submission.signature = 'other',
    a => a.submission.command.progress = -1, a => a.submission.history[0].serial = 99]) {
    const f = fixture(); wound(f); demand(f); S.command(f.s, f.book, f.a, f.c, 'protect', 0); change(f.a);
    assert(!S.valid(f.a)); assert(!S.command(f.s, f.book, f.a, f.c, 'protect', 1)); assert(!demand(f));
    assert.equal(S.absorb(f.s, f.book, f.a, f.c, 20, ['physical'], 1, 'enemy'), 0);
  }
});
test('an independent same-world allocation inherits neither submission nor spent mutable body state', () => {
  const f = fixture(); wound(f); demand(f); S.command(f.s, f.book, f.a, f.c, 'protect', 0); tick(f, 10);
  const original = f.book.originals[0], next = { worldId: 'world', runId: 'independent' };
  const book = O.create({ complete: true, rows: [copy(original)] }, next, 0, true);
  const fresh = B.create(book, [f.a.home], 0), a = fresh.bodies[0];
  assert.equal(a.submission, undefined); assert.equal(a.health, 1800); assert.equal(a.stamina, 500);
  assert.equal(book.records[0].god.power.reserve, 450); assert.equal(f.a.submission.status, 'accepted');
  assert(!B.authentic(f.s, book, f.a));
});
