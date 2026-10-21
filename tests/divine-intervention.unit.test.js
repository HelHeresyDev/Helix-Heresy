const { test } = require('node:test');
const assert = require('node:assert/strict');
const Intervention = require('../divine-intervention');
const Religion = require('../religious-recognition');
const { civicFixture } = require('./helpers/patron-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const f = civicFixture();
  f.s.source.faith.topicPositions = { warfare: 'defensiveOnly' };
  f.s.god.expenditures = { communication: 7, avatars: 12, protection: 8 };
  f.i = Intervention.create(f.s, { worldId: 'world', runId: 'run' }, f.at);
  Object.assign(f.c, { expansionActive: true, representativeWitness: true, representativeAtChannel: true,
    representativeAble: true, clerkAtChannel: true, sameGround: true, tracksScientist: true,
    scientistNearAnchor: true, lineOfEffect: true, distanceM: 1, protectsRepresentative: true,
    avatarIncapacitated: false, avatarSuppressed: false, avatarVisible: true, canHear: true, free: true });
  f.hits = 0;
  f.effects = { receivingCell: () => ({ x: 18, y: 11, z: 6 }), strike: () => f.hits++, approach: () => true };
  return f;
}
function observe(f, id = 'actual-attack', targetId = f.s.actor.id) {
  return Intervention.observe(f.i, f.s, { id, actorId: 'scientist', actionId: 'strike', targetId }, f.c, f.at);
}
function tick(f, n) { f.at += n; return Intervention.advance(f.i, f.s, f.office, () => f.c, f.at, f.effects); }
function manifest(f) { assert.ok(observe(f)); tick(f, 0); tick(f, 120); assert.ok(Intervention.present(Intervention.actor(f.i))); }
test('explicit defensive teaching and proportional methods are required, not heresy refusal or alignment', () => {
  const f = fixture();
  for (const position of ['defensiveOnly', 'defensiveWarAsDuty', 'pacifistExceptImmediateDefense']) {
    f.s.source.faith.topicPositions.warfare = position; assert.ok(Intervention.motive(f.s));
  }
  for (const position of ['sanctionedForDeclaredCause', 'sanctionedWildernessWar', 'unknown']) {
    f.s.source.faith.topicPositions.warfare = position; assert.equal(Intervention.motive(f.s), null);
  }
  f.s.source.faith.topicPositions.warfare = 'defensiveOnly'; f.s.source.faith.acceptableMethods = [];
  assert.equal(Intervention.create(f.s, { worldId: 'w', runId: 'r' }, 0), null);
});
test('opening, endorsement refusal and unrelated coercion produce no report or manifestation', () => {
  const f = fixture(), original = copy(f.s); tick(f, 1000);
  assert.equal(f.i.job, null); assert.deepEqual(f.i.avatars, []); assert.deepEqual(f.s, original);
  assert.equal(observe(f, 'unrelated', 'other-person'), false);
  f.c.expansionActive = false; assert.equal(observe(f), false); f.c.expansionActive = true;
  f.c.representativeWitness = false; assert.equal(observe(f), false);
});
test('original local eyewitness report needs actual transmission before divine receipt', () => {
  const f = fixture(), original = copy(f.s.source);
  assert.ok(observe(f)); assert.equal(observe(f), false); assert.equal(f.i.reports[0].receivedAt, null);
  f.c.channelAvailable = false; tick(f, 400); assert.equal(f.i.job, null); assert.equal(f.s.god.power.reserve, 100);
  f.c.channelAvailable = true; tick(f, 0); assert.equal(f.s.god.power.reserve, 93);
  assert.equal(f.s.attentionSeconds, 540); assert.equal(f.office.assignment, f.i.job.id);
  tick(f, 119); assert.equal(f.i.reports[0].receivedAt, null); tick(f, 1);
  assert.equal(f.i.reports[0].receivedAt, f.at); assert.equal(f.i.avatars.length, 1);
  assert.equal(f.s.god.power.reserve, 73); assert.equal(f.s.attentionSeconds, 420);
  assert.deepEqual(f.s.source, original); assert.equal(f.office.assignment, null);
});
test('report shares original clerk, representative, counter power and attention without duplicating resources', () => {
  for (const change of [f => f.office.assignment = 'other-work', f => f.s.actor.assignment = 'pastoral-duty',
    f => f.office.clerk.assignment = 'identity-registration', f => f.office.power = 0,
    f => f.office.workSeconds = 119, f => f.s.actor.workSeconds = 119,
    f => f.s.god.power.reserve = 6, f => f.s.attentionSeconds = 59, f => f.c.clerkAtChannel = false,
    f => f.c.representativeAtChannel = false, f => f.office.clerk.id = 'replacement']) {
    const f = fixture(); observe(f); change(f); tick(f, 1); assert.equal(f.i.job, null);
  }
});
test('partial report survives reload and outages pause without backfill', () => {
  const f = fixture(); observe(f); tick(f, 0); tick(f, 25);
  const work = f.office.workSeconds; f.i = Intervention.normalize(f.i); f.s = Religion.normalize(f.s);
  f.office.channelPowered = false; tick(f, 300); assert.equal(f.i.job.progress, 25);
  f.office.channelPowered = true; tick(f, 300); assert.equal(f.i.job.progress, 25);
  assert.equal(f.office.workSeconds, work); tick(f, 95); assert.equal(f.i.job, null);
  assert.equal(f.i.avatars.length, 1); assert.equal(f.s.god.power.reserve, 73);
});
test('original-channel transmission can continue after actual withdrawal without remote attacks or player receipt', () => {
  const f = fixture(); observe(f); tick(f, 0);
  f.c.sameGround = false; f.c.local = false; f.c.avatarVisible = false; f.c.representativeWitness = false;
  tick(f, 120); assert.equal(f.i.avatars.length, 1); assert.equal(f.i.reports[0].receivedAt, f.at);
  tick(f, 100); assert.equal(f.hits, 0); assert.equal(Intervention.publicView(f.i), null);
  assert.equal(f.office.assignment, null); assert.equal(f.s.god.power.reserve, 73);
});
test('representative incapacity before transmission cancels the report with no refund or divine receipt', () => {
  const f = fixture(); observe(f); tick(f, 0); tick(f, 25); f.c.representativeAble = false; tick(f, 1);
  assert.equal(f.i.job, null); assert.equal(f.i.reports[0].receivedAt, null); assert.equal(f.s.god.power.reserve, 93);
  f.c.representativeAble = true; tick(f, 300); assert.equal(f.i.avatars.length, 0);
});
test('unavailable receiving ground delays one already paid body without refund, duplicate or expiry refresh', () => {
  const f = fixture(); observe(f); tick(f, 0); f.effects.receivingCell = () => null; tick(f, 120);
  assert.equal(f.i.avatars.length, 0); assert.equal(f.s.god.power.reserve, 73);
  const expiry = f.i.authorizations[0].payload.expiresAt; f.effects.receivingCell = () => ({ x: 18, y: 11, z: 6 });
  tick(f, 100); assert.equal(Intervention.actor(f.i).expiresAt, expiry); tick(f, 100);
  assert.equal(f.i.avatars.length, 1); assert.equal(f.s.god.power.reserve, 73);
});
test('tampered or mismatched authorization cannot manifest a body after reload', () => {
  const f = fixture(); observe(f); tick(f, 0); f.effects.receivingCell = () => null; tick(f, 120);
  f.i = Intervention.normalize(f.i); f.i.authorizations[0].payload.protectedId = 'new-protected';
  f.effects.receivingCell = () => ({ x: 18, y: 11, z: 6 }); tick(f, 10);
  assert.equal(f.i.avatars.length, 0);
});
test('local physical ward spends its finite pool and never protects unrelated people or soul attacks', () => {
  const f = fixture(); manifest(f); const a = Intervention.actor(f.i);
  for (let n = 0; n < 5; n++) assert.equal(Intervention.absorb(f.i, f.c, f.s.actor.id, 20, ['physical']), 8);
  assert.equal(a.wardMana, 0); assert.equal(Intervention.absorb(f.i, f.c, a.id, 20, ['physical']), 20);
  a.wardMana = 60;
  for (const [target, types] of [['unrelated', ['physical']], [a.id, ['arcane']]])
    assert.equal(Intervention.absorb(f.i, f.c, target, 20, types), 20);
  for (const flag of ['avatarIncapacitated', 'avatarSuppressed']) {
    f.c[flag] = true; assert.equal(Intervention.absorb(f.i, f.c, a.id, 20, ['physical']), 20); f.c[flag] = false;
  }
  f.c.protectsRepresentative = false; assert.equal(Intervention.absorb(f.i, f.c, a.id, 20, ['physical']), 20);
});
test('avatar close strike is telegraphed, finite, injury-aware and cannot track outside its local guard area', () => {
  const f = fixture(); manifest(f); const a = Intervention.actor(f.i);
  tick(f, 2); assert.ok(a.pending); assert.equal(f.hits, 0); tick(f, 2); assert.equal(f.hits, 1); assert.equal(a.stamina, 34);
  tick(f, 4); f.c.scientistNearAnchor = false; tick(f, 2); assert.equal(f.hits, 1); assert.equal(a.pending, null);
  f.c.scientistNearAnchor = true; f.c.avatarIncapacitated = true; tick(f, 10); assert.equal(f.hits, 1);
  f.c.avatarIncapacitated = false; a.stamina = 5; tick(f, 20); assert.equal(f.hits, 1);
});
test('nearby nonaggression is exact, nonreligious and ends on real witnessed renewed aggression without healing', () => {
  const f = fixture(); manifest(f); const a = Intervention.actor(f.i);
  assert.equal(Intervention.agree(f.i, f.c, 'Worship the god', f.at), false);
  f.c.canHear = false; assert.equal(Intervention.agree(f.i, f.c, Intervention.TERMS, f.at), false); f.c.canHear = true;
  assert.ok(Intervention.agree(f.i, f.c, Intervention.TERMS, f.at)); tick(f, 30); assert.equal(f.hits, 0);
  a.health = 70; a.wardMana = 10;
  assert.ok(observe(f, 'renewed', a.id)); assert.equal(a.truce, null); assert.equal(a.hostile, true);
  assert.equal(a.health, 70); assert.equal(a.wardMana, 10);
});
test('expiry and defeated body never kill, descend, heal or subjugate the true god', () => {
  const f = fixture(); manifest(f); const a = Intervention.actor(f.i), god = copy(f.s.god);
  a.health = 0; a.status = 'dead'; tick(f, 600);
  assert.equal(a.manifested, false); assert.deepEqual(f.s.god, god); assert.equal(f.i.avatars.length, 1);
  assert.equal(f.i.reports.length, 1); tick(f, 1000); assert.deepEqual(f.s.god, god);
});
test('an avatar can perceive attacks against itself without inventing an unseen representative report', () => {
  const f = fixture(); manifest(f); const a = Intervention.actor(f.i);
  Intervention.agree(f.i, f.c, Intervention.TERMS, f.at);
  f.c.representativeWitness = false; f.c.avatarWitness = true;
  assert.ok(observe(f, 'self-witness', a.id)); assert.equal(a.hostile, true); assert.equal(a.truce, null);
  assert.equal(f.i.reports.length, 1); assert.equal(f.s.god.power.reserve, 73);
});
test('loss of the protected original person ends this scoped manifestation without divine death or a replacement', () => {
  const f = fixture(); manifest(f); f.s.actor.status = 'dead'; tick(f, 1);
  assert.equal(Intervention.actor(f.i).manifested, false); assert.equal(f.i.avatars.length, 1);
  assert.equal(f.s.god.lifecycle.lifeState, 'living');
});
test('renewal requires fresh witnessed evidence, a new transmission and the same finite shared reserve', () => {
  const f = fixture(); manifest(f); f.c.distanceM = 10; tick(f, 600);
  assert.equal(f.i.avatars.length, 1); tick(f, 200); assert.equal(f.i.job, null);
  assert.ok(observe(f, 'new-assault')); tick(f, 0); tick(f, 120);
  assert.equal(f.i.avatars.length, 2); assert.equal(f.s.god.power.reserve, 46); assert.equal(f.s.attentionSeconds, 240);
  assert.notEqual(f.i.avatars[0].id, f.i.avatars[1].id); assert.equal(f.i.avatars[0].manifested, false);
});
test('honored nonaggression settles pending witnessed incidents instead of recycling them into renewal', () => {
  const f = fixture(); manifest(f); observe(f, 'renewed-before-agreement');
  assert.ok(Intervention.agree(f.i, f.c, Intervention.TERMS, f.at));
  tick(f, 600); tick(f, 120); assert.equal(f.i.job, null); assert.equal(f.i.avatars.length, 1);
  assert.equal(f.s.god.power.reserve, 73); assert.equal(f.i.reports[1].receivedAt, null);
  assert.equal(f.i.reports[1].resolvedByNonaggressionAt, f.at - 720);
});
test('capacity shortage produces an honest received response without a free avatar', () => {
  const f = fixture(); f.s.god.power.reserve = 8; observe(f); tick(f, 0); tick(f, 120);
  assert.equal(f.i.authorizations[0].payload.outcome, 'capacityUnavailable'); assert.equal(f.i.avatars.length, 0);
  assert.equal(f.s.god.power.reserve, 1);
});
test('public accounts require receipt, remain dated away and omit reserves, seals, attention and unseen rosters', () => {
  const f = fixture(); manifest(f); assert.equal(Intervention.publicView(f.i), null);
  assert.ok(Intervention.receive(f.i, f.s, f.c, f.at)); const view = Intervention.publicView(f.i);
  for (const secret of ['reserve', 'attentionSeconds', 'repeatableSignature', 'allocatedPower', 'expiresAt', 'seal'])
    assert.equal(JSON.stringify(view).includes(secret), false);
  f.c.avatarVisible = false; f.c.receiveAtCounter = false; tick(f, 600);
  assert.equal(Intervention.receive(f.i, f.s, f.c, f.at), false); assert.deepEqual(Intervention.publicView(f.i), view);
});
test('run ownership, independent restart defaults, reload and irreversible death preserve exact original state', () => {
  const f = fixture(); manifest(f); assert.deepEqual(Intervention.normalize(f.i), f.i);
  assert.equal(Intervention.rebind(f.i, { worldId: 'other', runId: 'run' }, { worldId: 'w', runId: 'r' }), null);
  assert.equal(Intervention.rebind(f.i, { worldId: 'world', runId: 'run' }, { worldId: 'copy', runId: 'copy-run' }).runId, 'copy-run');
  const fresh = Intervention.create(f.s, { worldId: 'world', runId: 'new' }, f.at); assert.equal(fresh.reports.length, 0); assert.equal(fresh.avatars.length, 0);
  const original = copy(f.i); f.c.alive = false; tick(f, 1000); assert.deepEqual(f.i, original);
});
