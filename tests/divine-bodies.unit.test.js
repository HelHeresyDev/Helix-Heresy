const { test } = require('node:test'), assert = require('node:assert/strict');
const Bodies = require('../divine-bodies'), Owners = require('../divine-capabilities'), Research = require('../research-system');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(divinityState = 'divine', kind = 'human') {
  const god = { id: 'god:a', stableIdentity: { mortalIdentityId: 'original:mortal', originKind: kind }, domains: ['fire', 'war'],
    lifecycle: { lifeState: 'living', divinityState }, divineCore: { state: 'stable', repeatableSignature: 'original-signature', identityBound: true,
      innateCapacity: 400, receivingCapacity: 600 }, power: { reserve: 1400, reserveCapacity: 2000, worshipIncome: 100 },
    expenditures: { communication: 7, protection: 8, miracles: 10 }, worshipSources: [{ populationSourceId: 'actual-population', followerUnits: 12 }] };
  const book = Owners.create({ complete: true, rows: [{ godId: god.id, god: copy(god), faith: { id: 'faith:a', godId: god.id } }] },
    { worldId: 'world', runId: 'run' }, 0, true);
  const home = { godId: god.id, cityId: 'city:a', cellId: 'planet-cell:00001', placeId: 'city:city:a', name: 'Original God' };
  const s = Bodies.create(book, [home], 0), a = s.bodies[0], c = { alive: true, capable: true, field: true, roomId: Bodies.ROOM,
    cityId: home.cityId, cellId: home.cellId, placeId: `survey:${home.cityId}`, visible: true, distance: 2, lineOfEffect: true,
    tracks: true, researched: true, instrument: true, free: true, animancy: 201, bodyEpoch: 0,
    cell: { x: 10, y: 15, z: 6 }, incapacitated: false, suppressed: false, magicSuppressed: false };
  const stacks = [{ id: 'original-carried-reagents', key: 'arcaneFeedstock', quantity: 20, carriedBy: 'scientist', cell: copy(c.cell) }];
  return { s, a, book, c, stacks, god, at: 0 };
}
function tick(f, n, effects = {}) { f.at += n; return Bodies.advance(f.s, f.book, f.at, () => f.c, effects); }
function identify(f) { assert(Bodies.begin(f.s, f.book, f.a, f.stacks, f.c, f.at)); tick(f, 120); assert(f.a.identified); }
test('original human and beast gods share identity/accounts while physical bodies are allocated once without canonical changes or public rosters', () => {
  for (const kind of ['human', 'beast', 'otherCreature']) {
    const f = fixture('divine', kind), initial = copy(f.book.originals);
    assert.equal(f.a.maxHealth, 1800); assert.equal(f.a.stamina, 500); assert.equal(f.a.skills.striking, 400 / 3);
    assert.equal(f.a.mortalIdentityId, 'original:mortal'); assert.deepEqual(Bodies.known(f.s), []);
    assert(Bodies.observe(f.s, f.book, f.a, f.c, 0)); assert.equal(Bodies.known(f.s)[0].name, 'Unidentified extraordinary individual');
    assert(!JSON.stringify(Bodies.known(f.s)).includes('original-signature')); assert.deepEqual(f.book.originals, initial);
  }
});
test('late research is an ordinary physically supplied project, not an instant divine outcome', () => {
  const p = Research.PROJECT_BY_ID.divineCoreResonance;
  assert.equal(p.minimumSkills.animancy, 201); assert.equal(p.minimumSkills.fabrication, 151);
  assert.deepEqual(p.prerequisites, ['soulBeaconReconstruction']); assert.equal(p.workSeconds, 64800);
  assert.equal(p.inputs.resources.arcaneFeedstock, 12); assert.equal(p.unlocks[0].id, Bodies.UNLOCK);
  assert(!Research.isUnlocked(Research.defaultState(), Bodies.UNLOCK));
});
test('two-minute personal examination consumes actual clean carried reagents once and pauses without absence/outage backfill', () => {
  const f = fixture(); assert(Bodies.begin(f.s, f.book, f.a, f.stacks, f.c, 0)); assert.equal(f.stacks[0].quantity, 18);
  tick(f, 40); f.c.instrument = false; tick(f, 400); assert.equal(f.s.job.progress, 40);
  f.c.instrument = true; tick(f, 400); assert.equal(f.s.job.progress, 40); tick(f, 80);
  assert(f.a.identified); assert.equal(f.s.reports.length, 1); assert(!Bodies.begin(f.s, f.book, f.a, f.stacks, f.c, f.at));
  Bodies.observe(f.s, f.book, f.a, f.c, f.at); assert.equal(Bodies.known(f.s)[0].name, 'Original God');
});
test('wrong ground, missing research, tool, capability, actual sight, free attention, suppression or supplies cannot reveal identity', () => {
  for (const change of [f => f.c.cityId = 'other', f => f.c.placeId = 'another-ground-in-the-same-city', f => f.c.visible = false, f => f.c.field = false,
    f => f.c.researched = false, f => f.c.instrument = false, f => f.c.capable = false,
    f => f.c.free = false, f => f.c.suppressed = true, f => f.stacks[0].carriedBy = 'remote-owner',
    f => f.stacks[0].tags = ['contaminated'], f => f.stacks[0].reservedTaskId = 'other-work']) {
    const f = fixture(); change(f); assert(!Bodies.begin(f.s, f.book, f.a, f.stacks, f.c, 0)); assert.equal(f.stacks[0].quantity, 20);
  }
});
test('charged resonant release needs the actual paid original target, scientist body, mana, research, instrument and sight; receipts cannot be replayed', () => {
  const f = fixture(); identify(f);
  const p = Bodies.payResonance(f.s, f.book, f.a, f.stacks, f.c, f.at);
  const pending = { actionId: 'divineResonance', startedAt: f.at, releaseAt: f.at + 3, manaPaid: 30, target: { id: f.a.id }, resonancePaymentId: p.id };
  assert.equal(f.stacks[0].quantity, 15);
  assert(!Bodies.release(f.s, f.book, f.a, pending, f.c, f.at));
  assert(!Bodies.release(f.s, f.book, f.a, { ...pending, manaPaid: 0 }, f.c, f.at + 3));
  assert(!Bodies.release(f.s, f.book, f.a, pending, { ...f.c, bodyEpoch: 1 }, f.at + 3));
  assert(Bodies.release(f.s, f.book, f.a, pending, f.c, f.at + 3));
  assert(!Bodies.release(f.s, f.book, f.a, pending, f.c, f.at + 4));
  assert.equal(f.stacks[0].quantity, 15);
});
test('avatars, unknown bodies, exhausted material and inadequate scholarship cannot buy a resonant attack', () => {
  const f = fixture(); assert(Bodies.resonanceReason(f.s, f.book, f.a, f.stacks, f.c)); identify(f);
  assert(Bodies.resonanceReason(f.s, f.book, { ...f.a, actorKind: 'divineAvatar' }, f.stacks, f.c));
  assert(Bodies.resonanceReason(f.s, f.book, f.a, f.stacks, { ...f.c, animancy: 200 }));
  f.stacks[0].quantity = 2; assert.equal(Bodies.payResonance(f.s, f.book, f.a, f.stacks, f.c, f.at), null);
});
test('original divine ward spends the SAME finite reserve; zero reserve and descent are not death and do not erase perfected bodily power', () => {
  for (const state of ['divine', 'descended']) {
    const f = fixture(state), g = f.book.records[0].god;
    const rest = Bodies.absorb(f.s, f.book, f.a, 2000, f.c);
    assert.equal(rest, state === 'divine' ? 1600 : 2000); assert.equal(g.power.reserve, state === 'divine' ? 1000 : 1400);
    g.power.reserve = 0; assert.equal(Bodies.absorb(f.s, f.book, f.a, 2000, f.c), 2000);
    assert.equal(f.a.status, 'alive'); assert.equal(f.a.maxHealth, 1800); assert(!Bodies.death(f.s, f.book, f.a, 10, 'silence'));
  }
});
test('true death mutates only the original living account once, preserves body/remains and worship ownership, never gives submission', () => {
  const f = fixture(), source = copy(f.book.originals), followers = copy(f.book.records[0].god.worshipSources);
  identify(f); f.a.health = 0; assert(Bodies.death(f.s, f.book, f.a, f.at, 'actual bodily combat'));
  assert.equal(f.book.records[0].god.lifecycle.lifeState, 'dead'); assert.equal(f.book.records[0].god.lifecycle.divinityState, 'none');
  assert.equal(f.a.death.remainsId, f.a.id); assert.equal(f.a.death.signature, f.a.signature);
  assert(!Bodies.death(f.s, f.book, f.a, f.at + 1, 'second claim')); assert.equal(f.book.incidents.length, 1);
  assert.deepEqual(f.book.originals, source); assert.deepEqual(f.book.records[0].god.worshipSources, followers); assert.deepEqual(f.book.agreements, []);
});
test('actual divine retaliation telegraphs, pays finite original power and cannot hit through distance or off-screen information', () => {
  const f = fixture(); assert(Bodies.attack(f.s, f.book, f.a, f.c, 0));
  let strikes = 0, warnings = 0; tick(f, 1, { telegraph: () => warnings++ });
  assert.equal(warnings, 1); assert.equal(f.book.records[0].god.power.reserve, 1375); assert(f.a.pending);
  f.c.distance = 6; tick(f, 3, { strike: () => strikes++ }); assert.equal(strikes, 0);
  f.c.distance = 2; tick(f, 5); assert(f.a.pending);
  f.c.cityId = 'elsewhere'; tick(f, 3, { strike: () => strikes++ }); assert.equal(strikes, 0); assert.equal(f.a.pending, null);
});
test('wounded gods withdraw through actual finite movement, blockage retains position, and player retreat grants no defeat or healing', () => {
  const f = fixture('descended'); f.a.health = 400; f.c.distance = 5; Bodies.attack(f.s, f.book, f.a, f.c, 0);
  const before = copy(f.a.mapCell); tick(f, 1, { move: () => false }); assert.deepEqual(f.a.mapCell, before);
  tick(f, 1, { move: (a, target, retreat) => { assert(retreat); a.mapCell.x++; return true; } });
  assert.equal(f.a.mapCell.x, before.x + 1); assert.equal(f.a.stamina, 499);
  f.c.tracks = false; tick(f, 500); assert.equal(f.a.health, 400); assert.equal(f.a.status, 'alive');
  assert.equal(f.book.records[0].god.lifecycle.lifeState, 'living'); assert.equal(f.s.reports.length, 0);
});
test('partial examination, paid charge, wounds, independent memories and true death survive serialization and continued binding without new bodies/reserves', () => {
  const f = fixture(); Bodies.begin(f.s, f.book, f.a, f.stacks, f.c, 0); tick(f, 50);
  f.s = Bodies.normalize(copy(f.s)); f.a = f.s.bodies[0]; f.book = Owners.normalize(copy(f.book)); tick(f, 70); assert(f.a.identified);
  const reserve = f.book.records[0].god.power.reserve; f.a.health = 700;
  const p = Bodies.payResonance(f.s, f.book, f.a, f.stacks, f.c, f.at);
  const next = { worldId: 'world', runId: 'continued' };
  f.s = Bodies.rebind(f.s, f.book, next); f.book = Owners.rebind(f.book, f.book, next); f.a = f.s.bodies[0];
  assert.equal(f.s.bodies.length, 1); assert.equal(f.a.health, 700); assert.equal(f.book.records[0].god.power.reserve, reserve);
  assert(Bodies.release(f.s, f.book, f.a, { actionId: 'divineResonance', startedAt: f.at, releaseAt: f.at + 3, manaPaid: 30,
    target: { id: f.a.id }, resonancePaymentId: p.id }, f.c, f.at + 3));
  f.a.health = 0; Bodies.death(f.s, f.book, f.a, f.at + 3, 'actual injury');
  assert.equal(Bodies.normalize(copy(f.s)).bodies[0].death.godId, f.a.godId);
});
test('dated knowledge does not refresh from private death; final scientist death freezes examination, body, spending and original accounts', () => {
  const f = fixture(); Bodies.observe(f.s, f.book, f.a, f.c, 0); f.c.visible = false;
  f.a.health = 0; Bodies.death(f.s, f.book, f.a, 1, 'unseen injury'); tick(f, 1);
  assert.equal(Bodies.known(f.s)[0].condition, 'living');
  f.a.identified = { at: 0, signature: f.a.signature }; f.c.visible = true;
  Bodies.observe(f.s, f.book, f.a, f.c, 10);
  assert.equal(Bodies.known(f.s)[0].death.at, null); assert.equal(Bodies.known(f.s)[0].death.observedAt, 10);
  const frozen = copy({ s: f.s, book: f.book, stacks: f.stacks }); f.c.alive = false; tick(f, 100000);
  assert.deepEqual({ s: f.s, book: f.book, stacks: f.stacks }, frozen);
});
test('missing originals, altered signature, duplicate bodies and invalid saved positions cannot mint a usable individual', () => {
  const f = fixture(); f.book.records[0].lost = true; assert(!Bodies.authentic(f.s, f.book, f.a));
  f.book.records[0].lost = false; f.a.signature = 'forged'; assert(!Bodies.authentic(f.s, f.book, f.a));
  f.s.bodies.push(copy(f.a)); assert(Bodies.normalize(f.s).invalid);
  const g = fixture(); g.a.mapCell.x = NaN; assert(Bodies.normalize(g.s).invalid);
});
test('a missing public branch does not accidentally match an undefined city field or invent residence at the first city', () => {
  const f = fixture(), map = { humanGeography: { cities: [{ id: 'city:a', cellId: 'planet-cell:00001' }] },
    strategicDivineHistory: { eventRows: [], holySiteStateRows: [{ siteId: 'original-site', originPatronGodId: 'god:a', cellId: 'planet-cell:00002', state: 'active' }] } };
  const h = Bodies.homes(map, f.book); assert.equal(h[0].cityId, null); assert.equal(h[0].cellId, 'planet-cell:00002');
  assert.equal(h[0].placeId, 'original-site');
});
