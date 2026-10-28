const { test } = require('node:test');
const assert = require('node:assert/strict');
const I = require('../beast-spell-imitation'), W = require('../wilderness-beasts'), C = require('../beast-climbing');
const D = require('../beast-diplomacy'), R = require('../regional-encounters'), Stops = require('../roadside-stops'), M = require('../municipal-supply-threats');
const { sourceFixture } = require('./helpers/beast-diplomacy-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const a = W.actor(I.SPECIES, 'original-ape', { x: 10, y: 6, z: 21 }, 'original-population', 0);
  a.roomId = 'original-patch';
  const c = { alive: true, local: true, sourceCurrent: true, incapacitated: false, conscious: true, visual: true,
    casterVisible: true, releaseVisible: true, handsFree: true, suppressed: false, dialogue: false,
    targetKind: 'creature', targetAlive: true, targetSouled: true, targetVisible: true, lineOfEffect: true,
    distanceM: 4, targetCell: { x: 10, y: 10, z: 21 }, casterHeightM: 0, targetHeightM: 0,
    protectedTarget: false, decision: 'pursue', bodyEpoch: 0, visitAt: 0 };
  const event = { id: 'real-paid-cast:1', casterId: 'scientist', spellId: 'soulLash', at: 1,
    roomId: a.roomId, casterCell: copy(c.targetCell), released: true, paid: true,
    casterSkill: 100, casterMana: 1000, baseDamage: 1000, giftedEquipment: ['divine-collar'] };
  return { a, c, event, at: 10 };
}
function learn(f) { assert(I.observe(f.a, f.event, f.c)); }
function begin(f) { return I.begin(f.a, 'scientist', f.c, f.at); }
function release(f) { f.at += I.PREPARE; return I.advance(f.a, f.c, f.at); }
test('one actual identified visible paid release teaches exactly Soul Lash, not the caster’s skill, reserves, enhancements or commands', () => {
  const f = fixture(), before = copy(f.a); learn(f);
  assert.equal(f.a.spellImitation.known.length, 1); assert.equal(f.a.spellImitation.known[0].castId, f.event.id);
  assert.equal(f.a.spellImitation.mana, 48); assert.equal(f.a.spellImitation.animancy, 1);
  assert.equal(f.a.behavior, before.behavior); assert.equal(f.a.targetId, undefined); assert.equal(f.a.health, 80);
  assert(!JSON.stringify(f.a.spellImitation).includes('giftedEquipment'));
  assert.equal(I.observe(f.a, f.event, f.c), false); assert.equal(I.observe(f.a, { ...f.event, id: 'real-paid-cast:2' }, f.c), false);
  assert.equal(f.a.spellImitation.known.length, 1); assert.equal(f.a.spellImitation.spent, 0);
});
test('sound, damage, unseen casters, partial gestures, blocked release perception and unconscious observers are not spell knowledge', () => {
  for (const change of [f => f.c.casterVisible = false, f => f.c.releaseVisible = false, f => f.c.visual = false,
    f => f.c.conscious = false, f => f.c.incapacitated = true, f => f.c.sourceCurrent = false, f => f.c.local = false,
    f => f.event.paid = false, f => f.event.released = false, f => f.event.casterId = f.a.id,
    f => f.event.roomId = 'elsewhere', f => f.event.casterCell = null, f => f.a.health = 1, f => f.a.status = 'dead']) {
    const f = fixture(); change(f); assert.equal(I.observe(f.a, f.event, f.c), false); assert.equal(f.a.spellImitation.known.length, 0);
  }
});
test('no other spell, miracle, equipment, species label or slime imitation channel can supply copied magic', () => {
  for (const id of ['resurrection', 'divineAvatar', 'manaEmitter', 'fireBreath', 'strike', 'soulBeacon']) {
    const f = fixture(); assert.equal(I.observe(f.a, { ...f.event, spellId: id }, f.c), false);
  }
  for (const change of [a => a.speciesId = 'beast:rimefang-pack', a => a.actorKind = 'slime', a => a.genome = 'imitative-looking-genome',
    a => a.id = 'replacement', a => a.populationId = 'replacement-source']) {
    const f = fixture(); change(f.a); assert.equal(I.observe(f.a, f.event, f.c), false); assert.equal(begin(f), false);
  }
});
test('learning does not imply hostility, force retaliation or confer fluent cooperation', () => {
  for (const decision of ['roam', 'return', 'flee', 'dialogue', 'investigate']) {
    const f = fixture(); learn(f); f.c.decision = decision;
    assert.equal(begin(f), false); assert.equal(f.a.spellImitation.mana, 48); assert.equal(f.a.contactWorkSeconds, undefined);
  }
});
test('preparation spends the original mana exactly once; completing, missing or cancelling never refunds or replenishes it', () => {
  const f = fixture(); learn(f); assert(begin(f));
  assert.equal(f.a.spellImitation.mana, 36); assert.equal(f.a.spellImitation.spent, 12);
  assert.equal(begin(f), false); assert.equal(I.advance(f.a, f.c, f.at + .5), null);
  const cast = release(f); assert.equal(cast.targetId, 'scientist'); assert.equal(f.a.spellImitation.casts[0].state, 'released');
  assert.equal(I.advance(f.a, f.c, f.at + 1), null); assert.equal(f.a.spellImitation.mana, 36);
  assert.equal(begin(f), false); f.at = f.a.spellImitation.nextCastAt; assert(begin(f));
  assert(I.interrupt(f.a, 'actual impact', f.at)); assert.equal(f.a.spellImitation.mana, 24); assert.equal(f.a.spellImitation.spent, 24);
});
test('range, line of effect, genuine perception, valid souls, hands, suppression and independent commitments constrain casting', () => {
  for (const change of [f => f.c.distanceM = 5.01, f => f.c.distanceM = -1, f => f.c.lineOfEffect = false,
    f => f.c.targetVisible = false, f => f.c.targetAlive = false, f => f.c.targetSouled = false,
    f => f.c.targetKind = 'structure', f => f.c.handsFree = false, f => f.c.suppressed = true,
    f => f.c.dialogue = true, f => f.c.protectedTarget = true, f => f.c.incapacitated = true]) {
    const f = fixture(); learn(f); change(f); assert.equal(begin(f), false); assert.equal(f.a.spellImitation.spent, 0);
  }
});
test('stable elevated casting uses actual height and barriers; moving climbing limbs cannot prepare or finish a spell', () => {
  const f = fixture(); learn(f); f.a.climbing = { mode: 'perched', heightM: 4 };
  f.c.casterHeightM = C.height(f.a); f.c.distanceM = Math.hypot(2, C.height(f.a)); assert(begin(f));
  f.a.climbing.mode = 'descending'; f.c.casterHeightM = 3.75; assert.equal(release(f), null);
  assert.equal(f.a.spellImitation.casts[0].state, 'interrupted'); assert.equal(f.a.spellImitation.mana, 36);
  for (const mode of ['ascending', 'descending', 'landingBlocked']) {
    const g = fixture(); learn(g); g.a.climbing = { mode, heightM: 2 }; assert.equal(begin(g), false);
  }
  const g = fixture(); learn(g); g.a.climbing = { mode: 'perched', heightM: 4 }; g.c.casterHeightM = 4;
  assert(begin(g)); assert(release(g)); assert.equal(g.a.spellImitation.animancy, 1);
});
test('actual target or caster movement, lost sight, injury, changed bodies, changed visits and new protected terms interrupt without refund', () => {
  for (const change of [f => f.c.targetCell.x++, f => f.a.mapCell.x++, f => f.c.targetHeightM++, f => f.c.casterHeightM++,
    f => f.c.targetVisible = false, f => f.c.lineOfEffect = false, f => f.c.handsFree = false, f => f.c.protectedTarget = true,
    f => f.c.bodyEpoch++, f => f.c.visitAt++, f => f.c.local = false, f => f.a.status = 'dead']) {
    const f = fixture(); learn(f); assert(begin(f)); change(f);
    assert.equal(release(f), null); assert.equal(f.a.spellImitation.pending, null); assert.equal(f.a.spellImitation.mana, 36);
    assert.equal(f.a.spellImitation.casts[0].state, 'interrupted'); assert.equal(f.a.spellImitation.known.length, 1);
  }
});
test('one individual’s four original casts exhaust its finite mana; waiting and additional demonstrations give no free refill', () => {
  const f = fixture(); learn(f);
  for (let n = 0; n < 4; n++) { f.at = Math.max(f.at, f.a.spellImitation.nextCastAt); assert(begin(f)); assert(release(f)); }
  assert.equal(f.a.spellImitation.mana, 0); assert.equal(f.a.spellImitation.spent, 48); assert.equal(f.a.spellImitation.casts.length, 4);
  f.at += 86400; assert.equal(begin(f), false); assert.equal(I.observe(f.a, { ...f.event, id: 'new-cast', at: f.at }, f.c), false);
  assert.equal(f.a.spellImitation.mana, 0); assert(I.valid(f.a));
});
test('partial preparation, learned source identity and spent mana survive actor normalization and continued regional copies', () => {
  const f = fixture(); learn(f); assert(begin(f)); const saved = copy(f.a);
  f.a = W.normalizeState({ actors: [saved] }).actors[0]; assert(I.valid(f.a)); assert.deepEqual(f.a, saved);
  const b = { worldId: 'world', runId: 'run' }, region = R.create(b);
  Object.assign(f.a, { routeId: 'walk', positionKm: .125, offsetM: 0, effortSeconds: 120, regionalPhase: 'local', regionalAt: 10 });
  region.members.push({ actorId: f.a.id, speciesId: f.a.speciesId, populationId: f.a.populationId, source: 'original' }); region.beasts.actors.push(f.a);
  const continued = R.rebind(region, b, { worldId: 'world', runId: 'continued' }), a = continued.beasts.actors[0];
  assert.equal(a.spellImitation.mana, 36); assert.deepEqual(a.spellImitation.pending, saved.spellImitation.pending);
  assert(I.advance(a, f.c, f.at + I.PREPARE)); assert.equal(a.spellImitation.mana, 36);
  const fresh = fixture(); assert.equal(fresh.a.spellImitation.known.length, 0); assert.equal(fresh.a.spellImitation.mana, 48);
});
test('lost legacy budgets and corrupt or rebound source records remain unavailable, never reconstructed as fresh capacity', () => {
  const f = fixture(); learn(f); assert(begin(f));
  for (const change of [a => a.spellImitation.mana++, a => a.spellImitation.spent = 0,
    a => a.spellImitation.actorId = 'replacement', a => a.spellImitation.populationId = 'other',
    a => a.spellImitation.known = [], a => a.spellImitation.casts = [], a => a.spellImitation = 'invalid']) {
    const a = copy(f.a); change(a); I.normalizeActor(a); assert.equal(I.valid(a), false);
    assert.equal(I.begin(a, 'scientist', f.c, 100), false);
  }
  const old = copy(f.a); delete old.spellImitation; assert.equal(I.normalizeActor(old).spellImitation, undefined);
  assert.equal(I.observe(old, f.event, f.c), false); assert.equal(I.begin(old, 'scientist', f.c, 100), false);
});
test('only an actually witnessed release enters player knowledge; learning, private reserves and unobserved casts stay private', () => {
  const f = fixture(); learn(f); assert.equal(I.observedEvent(f.a, null, f.at), null); assert.equal(I.visiblePreparation(f.a), null);
  assert(begin(f)); assert(I.visiblePreparation(f.a)); assert.equal(I.observedEvent(f.a, null, f.at), null);
  release(f); assert.equal(I.observedEvent(f.a, null, f.at + 100), null);
  const received = { spellEvent: I.observedEvent(f.a, null, f.at) }; assert.equal(received.spellEvent.spell, 'Soul Lash');
  assert(!JSON.stringify(received).match(/mana|spent|known|casterId|original-population/i));
  f.at += 100; assert(begin(f)); release(f); assert.deepEqual(I.observedEvent(f.a, received, f.at + 1), received.spellEvent);
});
test('final scientist death freezes memory, mana, preparation and receipts without finishing an unseen attack', () => {
  const f = fixture(); learn(f); assert(begin(f)); f.c.alive = false; const before = copy(f.a);
  assert.equal(I.advance(f.a, f.c, f.at + 100), null); assert.equal(I.observe(f.a, f.event, f.c), false);
  assert.equal(I.interrupt(f.a, 'death freeze', f.at + 100, false), false); assert.deepEqual(f.a, before);
});
test('the carrier’s physical AI shares the same spell owner and cannot cast at structures or treat a perched caster as grounded', () => {
  const f = fixture(); learn(f); f.a.climbing = { mode: 'perched', heightM: 4 }; f.c.casterHeightM = 4;
  f.a.regionalPhase = 'local'; let strikes = 0, targetKinds = [];
  const site = { roomId: f.a.roomId }, q = { vehicle: { id: 'truck', roomId: f.a.roomId, condition: 100, mapCell: f.c.targetCell }, driver: { status: 'alive', health: 100 } },
    e = { lastAt: 9, contacts: [], clearSeconds: 0 }, s = { lastAt: 9 };
  M.step(s, q, site, [f.a], 10, { encounter: e, campOnly: true, alive: () => true, verticalStep: () => true,
    sight: () => true, canEnter: () => true, strike: () => { strikes++; return { ok: true }; },
    spellStep: (a, t, decision, at) => { targetKinds.push(t?.kind); return I.begin(a, t?.id, { ...f.c, targetKind: t?.kind }, at); } });
  assert.deepEqual(targetKinds, ['structure']); assert.equal(strikes, 0); assert.equal(f.a.spellImitation.spent, 0);
});
test('actual carrier targeting advances the same original spell account against an exposed souled person, not a second budget', () => {
  const f = fixture(); learn(f); f.c.targetCell.y = 9; f.c.distanceM = 3;
  f.a.regionalPhase = 'local'; const before = copy(f.a.spellImitation.known);
  const site = { roomId: f.a.roomId }, q = { vehicle: { id: 'truck', roomId: 'distant', condition: 100 }, driver: { status: 'alive', health: 100 } },
    e = { lastAt: 9, contacts: [], clearSeconds: 0 }, s = { lastAt: 9 };
  let releases = 0, strikes = 0;
  const hooks = { encounter: e, campOnly: true, alive: () => true, sight: () => true, canEnter: () => true,
    targets: [{ kind: 'creature', id: 'scientist', cell: f.c.targetCell }], strike: () => { strikes++; return { ok: true }; },
    spellStep: (a, t, decision, at) => {
      if (a.spellImitation.pending) { if (I.advance(a, f.c, at)) releases++; return true; }
      return I.begin(a, t?.id, { ...f.c, decision: decision.behavior, targetKind: t?.kind }, at);
    } };
  M.step(s, q, site, [f.a], 10, hooks);
  assert.equal(f.a.spellImitation.mana, 36); assert(f.a.spellImitation.pending);
  M.step(s, q, site, [f.a], 12, hooks);
  assert.equal(releases, 1); assert.equal(strikes, 0); assert.equal(f.a.spellImitation.mana, 36);
  assert.deepEqual(f.a.spellImitation.known, before); assert.equal(f.a.spellImitation.casts[0].state, 'released');
});
test('a genuine individual compact remains method-independent after real cognition and assent, including magical attacks from a perch', () => {
  const source = sourceFixture(), binding = { worldId: 'world', runId: 'run' }, s = D.create(binding), region = R.create(binding);
  D.register(s, source.source, region, [], source.seed, 0);
  const site = Stops.ensure(null, binding, source.source.routeId, source.source.positionKm, 0, 21, {}).site;
  R.place(region, site, 0, () => true); const a = region.beasts.actors.find(a => a.dialoguePolicy === 'consider'), f = fixture();
  const c = { alive: true, capable: true, visible: true, near: true, free: true, sourceCurrent: true, actorWitness: true,
    bodyEpoch: 0, siteId: site.id, routeId: site.routeId, cityId: 'a', scientistCell: { x: 8, y: 10, z: 21 },
    markers: [-1, 1].map(dx => ({ ...a.homeCell, x: a.homeCell.x + dx })), noGo: [a.homeCell],
    boundary: { siteId: site.id, roomId: site.roomId, cells: [a.homeCell] } };
  let at = 0; const work = n => { for (let i = 0; i < n; i++) { at++; D.advance(s, [a], () => c, at);
    const intent = D.intent(s, a, c, at); if (intent && at >= a.nextMoveAt) { const next = W.nextStep(a.mapCell, intent.goal,
      p => site.baseline.some(t => W.key(t.cell) === W.key(p)) && !D.forbidden(s, a, p)); if (next) a.mapCell = copy(next); a.nextMoveAt = at + 2; } } };
  assert(D.begin(s, a, 'greet', c, at)); work(60); assert(D.begin(s, a, 'check', c, at)); work(120);
  assert(D.contact(s, a).understood); assert(D.begin(s, a, 'discuss', c, at)); work(60);
  assert(D.begin(s, a, 'accept', c, at, copy(D.contact(s, a).proposal))); work(60);
  assert(I.observe(a, { ...f.event, roomId: a.roomId, at }, f.c)); a.climbing = { mode: 'perched', heightM: 4 };
  const protectedTarget = D.covered(s, a, c, 'scientist', at + 1);
  assert(protectedTarget); assert.equal(I.begin(a, 'scientist', { ...f.c, protectedTarget, casterHeightM: 4 }, at + 1), false);
  assert.equal(a.spellImitation.spent, 0); assert.equal(s.agreements[0].breachedAt, null);
});
