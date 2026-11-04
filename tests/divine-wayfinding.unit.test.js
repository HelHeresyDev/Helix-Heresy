const { test } = require('node:test'), assert = require('node:assert/strict');
const B = require('../divine-bodies'), W = require('../divine-wayfinding'), Research = require('../research-system');
const { fixture, clone, advance, scan, visit } = require('./helpers/divine-closeout-model');
test('late wayfinding is an ordinary research project; a paid scan discloses one ground, never a source roster or identity', () => {
  assert.deepEqual(Research.PROJECT_BY_ID.divineWayfinding.prerequisites, ['divineCoreResonance']);
  const f = fixture(), originals = clone(f.book); assert.equal(W.view(f.bodies).traces.length, 0);
  scan(f); assert.equal(f.stacks[0].quantity, 999); assert.equal(f.c.mana, 95);
  const v = W.view(f.bodies); assert.equal(v.traces.length, 1); assert(!JSON.stringify(v).includes('god:'));
  assert(!JSON.stringify(v).includes('sig:')); assert(!JSON.stringify(v).includes('Original 0'));
  assert.deepEqual(f.book, originals); assert.deepEqual(B.known(f.bodies), []);
});
test('personal examination labels an unknown original distinctly without inventing a public divine name', () => {
  const f = fixture(1), a = f.bodies.bodies[0]; a.home.name = 'Unidentified extraordinary individual';
  scan(f); visit(f, 'trace:1'); assert(B.begin(f.bodies, f.book, a, f.stacks, f.c, f.at));
  f.at += B.WORK; B.advance(f.bodies, f.book, f.at, () => f.c); B.observe(f.bodies, f.book, a, f.c, f.at);
  assert.equal(B.known(f.bodies)[0].name, 'Personally identified ascended individual 1'); assert.equal(a.signature, 'sig:0');
});
test('every original ground can be discovered and physically visited with the SAME body and finite prepaid one-use return', () => {
  const f = fixture(), identities = f.bodies.bodies.map(a => ({ id: a.id, health: a.health, stamina: a.stamina }));
  for (let i = 0; i < 2; i++) {
    scan(f); const t = f.bodies.access.traces[i]; visit(f, t.id);
    const a = f.bodies.bodies.find(a => W.key(a.home) === t.key);
    assert(B.local(a, f.c)); assert.equal(a.mapCell.z, f.c.cell.z); assert.equal(f.stacks[0].cell.z, f.c.cell.z);
    assert(f.bodies.access.active.returnPaid); const before = f.stacks[0].quantity;
    assert(W.begin(f.bodies, f.book, f.stacks, f.c, 'return', null, f.at)); advance(f, f.bodies.access.job.seconds);
    assert.equal(f.c.roomId, 'lab'); assert.equal(f.stacks[0].quantity, before);
    assert(!W.begin(f.bodies, f.book, f.stacks, f.c, 'return', null, f.at));
  }
  assert.deepEqual(f.bodies.bodies.map(a => ({ id: a.id, health: a.health, stamina: a.stamina })), identities);
  assert.notEqual(f.bodies.access.grounds[0].roomId, f.bodies.access.grounds[1].roomId);
});
test('missing support, custody, insufficient original mana/reagents and unread traces cannot buy a passage', () => {
  for (const mutate of [f => f.c.allowed = false, f => f.c.free = false, f => f.c.capable = false, f => f.c.wayfinding = false,
    f => f.c.suppressed = true, f => f.c.instrument = false, f => f.c.mana = 0, f => f.stacks[0].reservedTaskId = 'other']) {
    const f = fixture(); mutate(f); assert(!W.begin(f.bodies, f.book, f.stacks, f.c, 'scan', null, 0));
  }
  const f = fixture(); assert(!W.begin(f.bodies, f.book, f.stacks, f.c, 'outbound', 'unheard', 0));
  scan(f); f.c.mana = 0; assert(!W.begin(f.bodies, f.book, f.stacks, f.c, 'outbound', 'trace:1', f.at));
});
test('movement, suppression, loss of instrument or bodily identity interrupts without refund or travel; blocked return preserves the actual anchor', () => {
  for (const change of [f => f.c.cell.x++, f => f.c.suppressed = true, f => f.c.instrument = false, f => f.c.bodyEpoch++]) {
    const f = fixture(); scan(f); assert(W.begin(f.bodies, f.book, f.stacks, f.c, 'outbound', 'trace:1', f.at));
    const stock = f.stacks[0].quantity; change(f); advance(f, 100);
    assert.equal(f.bodies.access.job, null); assert.equal(f.bodies.access.active, null); assert.equal(f.stacks[0].quantity, stock);
  }
  const f = fixture(); scan(f); visit(f, 'trace:1'); f.c.originUsable = () => false;
  assert(!W.begin(f.bodies, f.book, f.stacks, f.c, 'return', null, f.at)); assert(f.bodies.access.active);
});
test('partial paid work, visited grounds, actual cargo and one-use return persist; final death freezes everything', () => {
  const f = fixture(); scan(f); W.begin(f.bodies, f.book, f.stacks, f.c, 'outbound', 'trace:1', f.at); advance(f, 4);
  const to = { worldId: 'world', runId: 'continued' }, O = require('../divine-capabilities');
  f.bodies = B.rebind(f.bodies, f.book, to); f.book = O.rebind(f.book, f.book, to);
  assert(W.valid(f.bodies)); assert.equal(f.bodies.access.job.progress, 4); advance(f, 20); assert(f.bodies.access.active);
  const frozen = clone({ bodies: f.bodies, book: f.book, stacks: f.stacks }); f.c.alive = false; advance(f, 10000);
  assert.deepEqual({ bodies: f.bodies, book: f.book, stacks: f.stacks }, frozen);
});
test('a recovered body does not inherit a free return or falsely remain away when resurrection placed it elsewhere', () => {
  const f = fixture(); scan(f); visit(f, 'trace:1'); f.c.bodyEpoch++;
  advance(f, 1); assert.equal(f.bodies.access.active.returnPaid, false);
  const before = f.stacks[0].quantity; f.c.mana = 0;
  assert(!W.begin(f.bodies, f.book, f.stacks, f.c, 'return', null, f.at));
  f.c.mana = 30; assert(W.begin(f.bodies, f.book, f.stacks, f.c, 'return', null, f.at));
  assert.equal(f.stacks[0].quantity, before - 2); assert.equal(f.bodies.access.job.terms.mana, 20);
  advance(f, f.bodies.access.job.seconds); assert.equal(f.bodies.access.active, null);
  const g = fixture(); scan(g); visit(g, 'trace:1'); g.c.bodyEpoch++; g.c.roomId = 'hidden-beacon-base';
  advance(g, 1); assert.equal(g.bodies.access.active, null);
});
test('malformed saved origins, unbacked trace targets or return tokens fail closed', () => {
  for (const change of [s => s.access.job.origin = null, s => s.access.job.target.id = 'unmeasured', s => s.access.job.terms.feedstock = 0]) {
    const f = fixture(); scan(f); W.begin(f.bodies, f.book, f.stacks, f.c, 'outbound', 'trace:1', f.at); change(f.bodies);
    assert(!W.valid(f.bodies)); assert(!W.advance(f.bodies, f.book, f.c, 1000));
  }
});
