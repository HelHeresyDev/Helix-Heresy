const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../beast-climbing'), W = require('../wilderness-beasts'), Stops = require('../roadside-stops');
const R = require('../regional-encounters'), D = require('../beast-diplomacy'), M = require('../municipal-supply-threats');
const { sourceFixture } = require('./helpers/beast-diplomacy-source');
const copy = x => JSON.parse(JSON.stringify(x)), binding = { worldId: 'world', runId: 'run' };
function fixture() {
  const result = Stops.ensure(null, binding, 'walk', .125, 0, 21, {}, { sourceCellId: 'cell:forest', biomeCode: 'F', slopePercent: 20 }),
    site = result.site, surface = site.climbSurfaces[0], a = W.actor(C.SPECIES, 'original-ape', { ...surface.cell, x: surface.cell.x - 1 }, 'population', 0);
  a.roomId = site.roomId; a.regionalSiteId = site.id; a.regionalPhase = 'local'; a.effortSeconds = 120; a.routeId = 'walk';
  a.provokedUntil = 100; a.targetId = 'scientist';
  const f = { site, state: result.state, surface, a, at: 0, blocked: new Set(), damage: [],
    c: { alive: true, local: true, gripAble: true, incapacitated: false, dialogue: false, movementFactor: 1 } };
  f.c.canEnter = p => site.baseline.some(t => W.key(t.cell) === W.key(p)) && !site.climbSurfaces.some(s => W.key(s.cell) === W.key(p)) && !f.blocked.has(W.key(p));
  f.c.topClear = () => !f.roof;
  f.c.nextStep = (from, goal) => W.nextStep(from, goal, f.c.canEnter);
  f.c.damage = (n, cause) => { f.damage.push({ n, cause }); a.health -= n; if (a.health <= 0) a.status = 'dead'; };
  f.decision = { behavior: 'pursue', goal: { x: 10, y: 10, z: 21 } };
  return f;
}
function tick(f, seconds = 1) { f.at += seconds; return C.advance(f.a, f.site, f.c, f.at); }
function start(f) { assert(C.plan(f.a, f.site, f.decision, f.at, f.c)?.climbing); }
function perch(f) { start(f); for (let n = 0; n < 16; n++) tick(f); assert.equal(f.a.climbing.mode, 'perched'); }
test('original terrain is generated from forest/slope facts, has solid bounded columns, and is never reissued on visits or legacy loads', () => {
  const f = fixture(); assert.equal(f.site.climbSurfaces.length, 2); assert.equal(f.site.climbSurfaces[1].kind, 'rockFace');
  assert.deepEqual(C.surfaces(f.site, null), []); assert.deepEqual(C.surfaces(f.site, { sourceCellId: 'desert', biomeCode: 'D' }), []);
  f.surface.condition = 20; const saved = copy(f.state);
  const revisit = Stops.ensure(saved, binding, 'walk', .125, 200, 80, {}, { sourceCellId: 'fresh', biomeCode: 'F', slopePercent: 0 });
  assert.equal(revisit.site.climbSurfaces[0].condition, 20); assert.equal(revisit.site.entry.z, 21);
  delete saved.sites[0].climbSurfaces; assert.deepEqual(Stops.normalize(saved).sites[0].climbSurfaces, []);
  assert.equal(C.normalizeSurfaces([{ ...f.surface, heightM: 50 }], f.site), null);
});
test('an original ape physically climbs at bounded speed, spends finite stamina, perches, and descends onto actual available ground', () => {
  const f = fixture(), id = f.a.id; start(f); assert.equal(C.height(f.a), 0); tick(f);
  assert.equal(C.height(f.a), .25); assert.equal(f.a.climbStamina, 119.5);
  for (let n = 0; n < 15; n++) tick(f);
  assert.equal(f.a.climbing.mode, 'perched'); assert.deepEqual(f.a.mapCell, f.surface.cell); assert.equal(C.height(f.a), 4);
  const exit = copy(f.a.climbing.exit); for (let n = 0; n < 8; n++) tick(f);
  assert.equal(f.a.climbing.mode, 'descending'); assert.deepEqual(f.a.mapCell, exit);
  for (let n = 0; n < 16; n++) tick(f);
  assert.equal(f.a.climbing, null); assert.equal(C.height(f.a), 0); assert.equal(f.a.climbStamina, 106);
  assert.equal(f.a.id, id); assert.equal(f.a.health, 80); assert.equal(f.a.lastClimbEvent.kind, 'descended');
});
test('autonomous intent walks to an actual entry instead of teleporting, and no protected target or ground demonstration commands ascent', () => {
  const f = fixture(); f.a.mapCell = { x: 8, y: 8, z: 21 };
  const plan = C.plan(f.a, f.site, f.decision, f.at, f.c); assert(plan.next); assert.equal(W.distance(plan.next, f.a.mapCell), 1);
  assert.equal(f.a.climbing, null); f.c.dialogue = true; assert.equal(C.plan(f.a, f.site, f.decision, f.at, f.c), null);
  f.c.dialogue = false; f.c.protectedTarget = () => true; assert.equal(C.plan(f.a, f.site, f.decision, f.at, f.c), null);
  f.c.protectedTarget = () => false; f.a.provokedUntil = 0; assert.equal(C.plan(f.a, f.site, f.decision, f.at, f.c), null);
});
test('mass, grip, clearance, roofs, injuries, independent assignments, finite stamina and missing legacy allocations cannot become universal wall climbing', () => {
  for (const change of [f => f.surface.grip = .1, f => f.surface.condition = 0, f => f.surface.maxLoadKg = 1,
    f => f.surface.clearanceM = 1, f => f.c.gripAble = false, f => f.c.incapacitated = true, f => f.c.local = false,
    f => f.a.climbStamina = 0, f => delete f.a.climbStamina, f => f.a.speciesId = 'beast:rimefang-pack',
    f => f.a.speciesId = 'slime', f => f.roof = true, f => f.a.health = 1]) {
    const f = fixture(); f.site.climbSurfaces = [f.surface]; change(f);
    assert.equal(C.plan(f.a, f.site, f.decision, f.at, f.c), null);
    assert.equal(f.a.climbing, null);
  }
});
test('real elevation changes sight and line of effect; a raised observer sees over a lower rock but not an unknown full-height obstruction', () => {
  const f = fixture(), from = { x: 10, y: 8, z: 21 }, to = { x: 14, y: 8, z: 21 };
  assert.equal(C.lineClear(from, 1.5, to, 1.5, [f.surface]), false);
  const low = { ...f.surface, heightM: 2 };
  assert.equal(C.lineClear(from, 5.5, to, 1.5, [low]), true);
  assert.equal(C.lineClear(from, 5.5, to, 1.5, [f.surface]), false);
  assert.equal(C.lineClear(from, 5.5, { ...to, z: 22 }, 1.5, []), false);
  perch(f); assert.equal(C.cover(f.a, f.site.climbSurfaces), .3);
  assert(Math.hypot(1, C.height(f.a)) > 1); // Ground melee is not neighboring-tile reach.
});
test('actual impact causes a height-based fall and original wounds, with no refund, heal or replacement actor', () => {
  const f = fixture(); perch(f); const spent = f.a.climbStamina;
  assert.equal(C.interrupt(f.a, f.site, f.c, f.at, 5), false); assert(C.interrupt(f.a, f.site, f.c, f.at, 6));
  assert.equal(f.a.climbing, null); assert.equal(f.a.health, 60); assert.equal(f.damage[0].n, 20);
  assert.equal(f.a.climbStamina, spent); assert.equal(f.a.lastClimbEvent.kind, 'fall');
  assert.equal(C.interrupt(f.a, f.site, f.c, f.at, 100), false); assert.equal(f.damage.length, 1);
});
test('lost support, loss of grip and actual exhaustion cause physical falls, while a blocked landing never teleports through a body', () => {
  for (const change of [f => f.surface.condition = 0, f => f.c.gripAble = false, f => f.a.climbStamina = 0]) {
    const f = fixture(); perch(f); change(f); tick(f); assert.equal(f.a.lastClimbEvent.kind, 'fall'); assert.equal(f.damage.length, 1);
  }
  const f = fixture(); perch(f); const entry = copy(f.a.climbing.entry); f.c.canEnter = () => false;
  assert(C.interrupt(f.a, f.site, f.c, f.at, 10)); assert.equal(f.a.climbing.mode, 'landingBlocked'); assert.equal(C.height(f.a), 4);
  f.c.canEnter = p => W.key(p) === W.key(entry); tick(f); assert.equal(f.a.climbing, null); assert.deepEqual(f.a.mapCell, entry);
});
test('absence pauses without catch-up, partial movement and original stamina survive normalization, and final death freezes work', () => {
  const f = fixture(); start(f); tick(f, 4); const stamina = f.a.climbStamina;
  f.c.local = false; tick(f, 600); assert.equal(C.height(f.a), 1); assert.equal(f.a.climbStamina, stamina);
  Object.assign(f.a, C.normalizeActor(copy(f.a))); f.c.local = true; tick(f, 600); assert.equal(C.height(f.a), 1);
  tick(f); assert.equal(C.height(f.a), 1.25); const before = copy(f.a); f.c.alive = false; tick(f, 600); assert.deepEqual(f.a, before);
  const bad = C.normalizeActor({ ...copy(f.a), climbStamina: undefined }); assert.equal(bad.climbingInvalid, true); assert.equal(C.height(bad), Infinity);
});
test('continued regional copies retain the same original elevated body and reserve; departing does not drag it onto the road', () => {
  const f = fixture(); perch(f); Object.assign(f.a, { positionKm: .125, offsetM: 0, regionalAt: f.at, homePositionKm: .125,
    behavior: 'pursue', rememberedUntil: f.at + 12 });
  const region = R.create(binding); region.members.push({ actorId: f.a.id, populationId: f.a.populationId, speciesId: C.SPECIES, source: 'original' });
  region.beasts.actors.push(f.a); R.depart(region, f.site, f.at); assert.equal(f.a.regionalPhase, 'local'); assert.equal(C.height(f.a), 4);
  const continued = R.rebind(copy(region), binding, { worldId: 'world', runId: 'continued' });
  assert.equal(C.height(continued.beasts.actors[0]), 4); assert.equal(continued.beasts.actors[0].climbStamina, 112);
  assert.equal(continued.beasts.actors[0].id, f.a.id); assert.equal(W.actor(C.SPECIES, 'fresh', f.a.homeCell, 'population').climbStamina, 120);
});
test('revisiting an original patch cannot backfill a climb that was unvisited, and last-seen height is not a live private-body view', () => {
  const f = fixture(); start(f); tick(f, 4); const stamina = f.a.climbStamina;
  f.site.lastVisitedAt = 600; tick(f, 600); assert.equal(C.height(f.a), 1); assert.equal(f.a.climbStamina, stamina);
  tick(f); assert.equal(C.height(f.a), 1); tick(f); assert.equal(C.height(f.a), 1.25);
  const saved = W.defaultState(); saved.actors.push(f.a); saved.sightings[f.a.id] = { id: f.a.id, heightM: 1, observedAt: 4, cell: copy(f.a.mapCell) };
  const held = W.publicKnowledge(saved, []); f.a.climbing.heightM = 4;
  assert.deepEqual(W.publicKnowledge(saved, []), held); assert.equal(held.sightings[0].current, false); assert.equal(held.sightings[0].heightM, 1);
  f.a.lastClimbEvent = { at: 10, kind: 'fall', heightM: 4 };
  assert.equal(C.observedEvent(f.a, null, 100), null);
  const received = { climbEvent: C.observedEvent(f.a, null, 10) }; assert.equal(received.climbEvent.kind, 'fall');
  f.a.lastClimbEvent = { at: 50, kind: 'descended' }; assert.deepEqual(C.observedEvent(f.a, received, 100), received.climbEvent);
});
test('original individual compacts cover elevated aggression and the complete quiet-ground column; ground signal work never commands a climb', () => {
  const source = sourceFixture(), s = D.create(binding), r = R.create(binding); D.register(s, source.source, r, [], source.seed, 0);
  const site = Stops.ensure(null, binding, source.source.routeId, source.source.positionKm, 0, 21, {}).site;
  R.place(r, site, 0, () => true); const a = r.beasts.actors.find(a => a.dialoguePolicy === 'consider');
  const c = { alive: true, capable: true, visible: true, near: true, free: true, sourceCurrent: true, actorWitness: true,
    bodyEpoch: 0, siteId: site.id, routeId: site.routeId, cityId: 'a', scientistCell: { x: 8, y: 10, z: 21 },
    markers: [{ x: 8, y: 6, z: 21 }, { x: 12, y: 6, z: 21 }], noGo: [a.homeCell], boundary: { siteId: site.id, roomId: site.roomId, cells: [a.homeCell] } };
  c.markers = [-1, 1].map(dx => ({ ...a.homeCell, x: a.homeCell.x + dx }));
  let at = 0;
  const work = seconds => { for (let n = 0; n < seconds; n++) {
    at++; D.advance(s, [a], () => c, at);
    const intent = D.intent(s, a, c, at);
    if (intent && at >= a.nextMoveAt) {
      const next = W.nextStep(a.mapCell, intent.goal, p => site.baseline.some(t => W.key(t.cell) === W.key(p)) && !D.forbidden(s, a, p));
      if (next) a.mapCell = copy(next); a.nextMoveAt = at + 2;
    }
  } };
  assert(D.begin(s, a, 'greet', c, at)); work(60); assert(D.begin(s, a, 'check', c, at)); work(120); assert(D.contact(s, a).understood);
  assert(D.begin(s, a, 'discuss', c, at)); work(60);
  assert(D.begin(s, a, 'accept', c, at, copy(s.contacts[0].proposal))); work(60);
  a.climbing = { heightM: 4 }; c.groundInteraction = false;
  assert(D.covered(s, a, c, 'scientist', at + 1)); assert.equal(D.begin(s, a, 'check', c, at + 1), false);
  c.scientistCell = copy(a.homeCell); c.scientistHeightM = 5; D.advance(s, [a], () => c, at + 1);
  assert.equal(s.agreements[0].breachedAt, at + 1);
});
test('the carrier ecology uses the same vertical owner before attacks or ordinary ground movement', () => {
  const f = fixture(); perch(f); let called = 0, strikes = 0;
  const quota = { vehicle: { id: 'truck', mapCell: f.a.mapCell, roomId: f.site.roomId, condition: 100 }, driver: { health: 100, status: 'alive' } };
  const e = { lastAt: 0, contacts: [], clearSeconds: 0 }, s = { lastAt: 0 };
  M.step(s, quota, f.site, [f.a], 17, { encounter: e, campOnly: true, alive: () => true, sight: () => true,
    verticalStep: (a, d, at) => { called++; C.advance(a, f.site, f.c, at); return Boolean(a.climbing); },
    strike: () => { strikes++; return { ok: true }; }, canEnter: () => true });
  assert.equal(called, 1); assert.equal(strikes, 0); assert.equal(C.height(f.a), 4);
});
