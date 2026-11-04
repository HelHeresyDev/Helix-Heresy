const { test } = require('node:test'), assert = require('node:assert/strict');
const B = require('../divine-bodies'), S = require('../divine-submission'), R = require('../divine-reign'), W = require('../divine-wayfinding');
const O = require('../divine-capabilities'), Campaign = require('../campaign'), Lifecycle = require('../run-lifecycle');
const { fixture, clone, scan, visit, identify, hit, advance } = require('./helpers/divine-closeout-model');
function qualify(f) {
  scan(f); visit(f, 'trace:1');
  const a = f.bodies.bodies[0]; identify(f, a); hit(f, a, 1600);
  // The explicit source here has 475 reserve; penetrating force is genuine,
  // not an injected signature or submission outcome.
  f.c.mana = 70; // Prior finite combat allocation in this isolated model case.
  assert(S.demand(f.bodies, f.book, a, f.stacks, f.c, f.at));
  for (const other of f.bodies.bodies.slice(1)) {
    // Visit its actual independently discovered source; no remote kills.
    W.begin(f.bodies, f.book, f.stacks, f.c, 'return', null, f.at); advance(f, f.bodies.access.job.seconds);
    scan(f); visit(f, f.bodies.access.traces.at(-1).id); identify(f, other); hit(f, other, 10000);
  }
  R.advance(f.reign, f.bodies, f.book, f.at, f.c); return a;
}
test('complete original submission/death plus a living submitted survivor qualifies once; actual personal evidence recognizes it', () => {
  const f = fixture(), original = clone(f.book.originals); qualify(f);
  assert(f.reign.current); assert.equal(f.reign.achievedAt, f.at); assert.equal(f.reign.recognizedAt, null);
  assert(R.review(f.reign, f.bodies, f.book, f.at, f.c)); assert.equal(f.reign.recognizedAt, f.at);
  const campaign = Campaign.record(null, { kind: 'divineRule', known: true, alive: true, achievedAt: f.at, recognizedAt: f.at }, f.at);
  assert.equal(Campaign.accomplishments(campaign).filter(a => a.label === 'Rule over the gods').length, 1);
  assert.deepEqual(f.book.originals, original);
});
test('avatars, friendship, worship loss, absence, incomplete scope, lost originals and trimmed source books cannot qualify', () => {
  for (const change of [f => f.book.complete = false, f => f.book.originals.pop(), f => f.book.records.pop(),
    f => f.book.records[0].lost = true, f => f.bodies.bodies.pop(), f => f.book.records[0].god.unresolvedCommitments = ['original'],
    f => f.bodies.bodies[0].submission.status = 'released', f => f.bodies.bodies[0].actorKind = 'divineAvatar']) {
    const f = fixture(1); qualify(f); change(f); R.advance(f.reign, f.bodies, f.book, f.at, f.c); assert(!f.reign.current);
  }
  const f = fixture(1); f.book.records[0].god.lifecycle.divinityState = 'descended'; R.advance(f.reign, f.bodies, f.book, 0, f.c);
  assert(!f.reign.current); assert.equal(f.reign.achievedAt, null);
  const g = fixture(1); qualify(g); const sources = clone(g.book.originals.map(o => o.god));
  g.reign.scope = []; g.book.records = []; g.book.originals = [];
  assert(!R.assess(g.reign, g.bodies, g.book, 0, sources).ok);
});
test('extermination alone is not reign; ordinary refusal is resolved only by actual permanent original death', () => {
  const f = fixture(1); scan(f); visit(f, 'trace:1'); identify(f, f.bodies.bodies[0]); hit(f, f.bodies.bodies[0], 10000);
  R.advance(f.reign, f.bodies, f.book, f.at, f.c); assert(!f.reign.current); assert.equal(f.reign.achievedAt, null);
});
test('real breach loses current reign; a new physical wound reasserts it without deleting or re-awarding history', () => {
  const f = fixture(1), a = qualify(f), at = f.reign.achievedAt;
  hit(f, a, 500); // Original reserve was already spent; another real wound breaks terms.
  R.advance(f.reign, f.bodies, f.book, ++f.at, f.c); assert(!f.reign.current); assert.equal(f.reign.achievedAt, at);
  assert(S.demand(f.bodies, f.book, a, f.stacks, f.c, f.at)); R.advance(f.reign, f.bodies, f.book, f.at, f.c);
  assert(f.reign.current); assert.equal(f.reign.achievedAt, at); assert.equal(f.reign.epochs.filter(e => e.current).length, 2);
});
test('delayed recognition can follow later loss, but unavailable personal evidence cannot disclose private qualification', () => {
  const f = fixture(1), a = qualify(f), at = f.at; const id = a.identified; a.identified = null;
  R.review(f.reign, f.bodies, f.book, f.at, f.c); assert.equal(R.view(f.reign).achievedAt, null);
  a.identified = id; S.command(f.bodies, f.book, a, f.c, 'release', f.at); R.advance(f.reign, f.bodies, f.book, ++f.at, f.c);
  assert(!f.reign.current); R.review(f.reign, f.bodies, f.book, f.at, f.c);
  assert.equal(f.reign.achievedAt, at); assert.equal(f.reign.recognizedAt, f.at); assert(R.view(f.reign).knownLoss);
  assert(!JSON.stringify(R.view(f.reign)).includes('sig:')); assert(!JSON.stringify(R.view(f.reign)).includes('reserve'));
});
test('unseen death cannot leak its private timestamp; later evidence establishes a conservative confirmed-by date', () => {
  const f = fixture(); scan(f); visit(f, 'trace:1');
  const a = f.bodies.bodies[0]; identify(f, a); hit(f, a, 1600); assert(S.demand(f.bodies, f.book, a, f.stacks, f.c, f.at));
  W.begin(f.bodies, f.book, f.stacks, f.c, 'return', null, f.at); advance(f, f.bodies.access.job.seconds);
  scan(f); visit(f, 'trace:2'); const other = f.bodies.bodies[1]; identify(f, other);
  f.c.visible = false; hit(f, other, 10000); R.advance(f.reign, f.bodies, f.book, f.at, f.c);
  const actual = f.reign.achievedAt; assert.equal(f.reign.proven, null);
  f.c.visible = true; f.at += 100; B.observe(f.bodies, f.book, other, f.c, f.at);
  assert.equal(other.observed.death.at, null); R.review(f.reign, f.bodies, f.book, f.at, f.c);
  const v = R.view(f.reign); assert.equal(v.achievedAt, null); assert.equal(v.confirmedByAt, f.at); assert.equal(f.reign.achievedAt, actual);
  const campaign = Campaign.record(null, { kind: 'divineRule', known: true, alive: true, ...v }, f.at);
  assert.equal(campaign.divineRule.achievedAt, null); assert.equal(Campaign.accomplishments(campaign)[0].at, f.at);
});
test('real canonical new ascension invalidates current reign, conserves identity/stock, and duplicate or unbacked births are refused', () => {
  const f = fixture(1); qualify(f); const at = f.reign.achievedAt;
  const candidate = { id: 'new-mortal', originKind: 'human', stableIdentity: true, transcendentPower: 100, soulStable: true,
    survivesTransformation: true, health: 80, maxHealth: 100, stamina: 30, roomId: f.c.roomId, mapCell: { x: 14, y: 14, z: f.c.cell.z } };
  const rite = { catalyst: true, viableDivineCore: true, repeatableSignature: 'divine-signature:new', receivingCapacity: 100,
    reserveCapacity: 100, worshipSources: [{ ...f.book.records[0].god.worshipSources[0], id: 'worship:new', followerUnits: 10 }] };
  const mortalId = candidate.id;
  candidate.skills = { striking: 500 }; f.c.injuries = [{ actorId: mortalId, actorKind: 'homunculus', id: 'original-wound', severityId: 'moderate' }];
  const a = R.registerAscendant(f.reign, f.bodies, f.book, candidate, rite, f.bodies.bodies[0].home, ++f.at, f.c);
  assert.equal(a, candidate); assert(!f.reign.current); assert.equal(a.mortalIdentityId, mortalId); assert.equal(a.stamina, 30);
  assert.equal(a.skills.striking, 500); assert.equal(f.c.injuries[0].id, 'original-wound'); assert.equal(f.c.injuries[0].actorId, a.id);
  assert.equal(f.reign.achievedAt, at); assert.equal(f.book.records.length, 2);
  assert(!R.registerAscendant(f.reign, f.bodies, f.book, candidate, rite, a.home, f.at, f.c));
  a.identified = { at: f.at, signature: a.signature }; hit(f, a, 10000); R.advance(f.reign, f.bodies, f.book, f.at, f.c);
  assert(f.reign.current); assert.equal(f.reign.achievedAt, at);
});
test('save/import retains history and current condition, independent starts inherit neither, and final death freezes assessment/recognition', () => {
  const f = fixture(1); qualify(f); R.review(f.reign, f.bodies, f.book, f.at, f.c);
  const to = { worldId: 'world', runId: 'continued' }, reign = R.rebind(f.reign, f.book, to), book = O.rebind(f.book, f.book, to), bodies = B.rebind(f.bodies, f.book, to);
  assert(R.assess(reign, bodies, book, 0).ok); assert.equal(reign.achievedAt, f.reign.achievedAt);
  const frozen = clone(reign); R.advance(reign, bodies, book, 10000, { alive: false }); R.review(reign, bodies, book, 10000, { alive: false }); assert.deepEqual(reign, frozen);
  const fresh = R.create(O.create({ complete: true, rows: f.book.originals }, { worldId: 'world', runId: 'fresh' }, 0, true), 0);
  assert.equal(fresh.achievedAt, null); assert.equal(fresh.recognizedAt, null); assert(!fresh.current);
  const accomplishments = Array.from({ length: 15 }, (_, i) => ({ label: `Earlier ${i}`, at: i }));
  accomplishments.push({ label: 'Rule over the gods', at: 100, recognizedAt: 150 });
  const report = Lifecycle.normalizeReport({ accomplishments }); assert.deepEqual(report.accomplishments.at(-1), accomplishments.at(-1));
});
