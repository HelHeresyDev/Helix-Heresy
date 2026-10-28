const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../beast-diplomacy'), R = require('../regional-encounters'), Wild = require('../wilderness-beasts');
const Stops = require('../roadside-stops'), M = require('../municipal-supply-threats'), Corridor = require('../corridor-beasts');
const { sourceFixture } = require('./helpers/beast-diplomacy-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const base = sourceFixture(), b = { worldId: 'world', runId: 'run' }, s = D.create(b), r = R.create(b);
  D.register(s, base.source, r, [], base.seed, 0);
  const site = Stops.ensure(null, b, base.source.routeId, base.source.positionKm, 0, 21, {}).site;
  R.place(r, site, 0, () => true);
  const a = r.beasts.actors.find(a => a.dialoguePolicy === 'consider');
  const f = { ...base, b, s, r, site, a, at: 0, blocked: false, scientist: copy(site.entry),
    c: { alive: true, capable: true, visible: true, near: true, sourceCurrent: true, free: true, bodyEpoch: 0,
      siteId: site.id, routeId: site.routeId, cityId: 'a', actorWitness: true } };
  f.context = actor => ({ ...f.c, scientistCell: f.scientist,
    markers: [-1, 1].map(dx => ({ ...actor.homeCell, x: actor.homeCell.x + dx })), noGo: [actor.homeCell],
    boundary: { siteId: site.id, roomId: site.roomId, cells: site.baseline.map(t => t.cell).filter(p => Wild.distance(p, actor.homeCell) <= 1) } });
  return f;
}
function tick(f, seconds) {
  for (let n = 0; n < seconds; n++) {
    f.at++; D.advance(f.s, f.r.beasts.actors, f.context, f.at, f.c.alive);
    for (const a of f.r.beasts.actors) {
      const intent = D.intent(f.s, a, f.context(a), f.at);
      if (!f.blocked && intent && f.at >= a.nextMoveAt) {
        const next = Wild.nextStep(a.mapCell, intent.goal, p => f.site.baseline.some(t => Wild.key(t.cell) === Wild.key(p))
          && !D.forbidden(f.s, a, p));
        if (next) a.mapCell = copy(next);
        a.nextMoveAt = f.at + 2;
      }
    }
  }
}
function action(f, kind, a = f.a, expected = null) { return D.begin(f.s, a, kind, f.context(a), f.at, expected); }
function understand(f) { assert(action(f, 'greet')); tick(f, 60); assert(action(f, 'check')); tick(f, 120); assert(D.contact(f.s, f.a).understood); }
function agree(f) { understand(f); assert(action(f, 'discuss')); tick(f, 60); assert(action(f, 'accept', f.a, copy(D.contact(f.s, f.a).proposal))); tick(f, 60); }
test('only a real original sapient ground population intersecting the measured approach supplies a source; no wave warning needed', () => {
  const f = sourceFixture(); assert.equal(f.map.publicBeastAtlas, undefined);
  assert.equal(D.sources(f.map, f.route, 'a', f.geometry).length, 1);
  const original = copy(f.map);
  f.map.beastEcology.populations[0].speciesId = 'beast:rimefang-pack'; assert.equal(D.sources(f.map, f.route, 'a', f.geometry).length, 0);
  f.map.beastEcology = original.beastEcology; f.map.beastEcology.populations[0].territory.rangeMask = Buffer.from([0]).toString('base64');
  assert.equal(D.sources(f.map, f.route, 'a', f.geometry).length, 0);
});
test('bounded original participants conserve source count, identity, refusal policy, wounds and actual remains across re-registration', () => {
  const f = fixture(); assert.equal(f.r.members.length, 2); assert.equal(f.s.troops[0].source.originalCount, 5);
  const ids = f.r.beasts.actors.map(a => a.id); f.a.health = 0; f.a.status = 'dead';
  D.register(f.s, f.source, f.r, f.r.beasts.actors, 'new-reroll-seed', 10000);
  assert.deepEqual(f.r.beasts.actors.map(a => a.id), ids); assert.equal(f.a.health, 0);
  assert.equal(f.map.beastEcology.populations[0].devotionalUnitCount, 5);
  assert.equal(R.remaining(f.r, f.source.populationId), 0);
  const empty = D.create(f.b); assert.equal(D.register(empty, f.source, f.r, f.r.beasts.actors, f.seed, 10000), null);
});
test('generic boundary, route and commercial allocators never create unowned replacement Mirror Apes', () => {
  const f = fixture(), p = { id: 'unmanaged', speciesId: D.SPECIES, populationIndex: 1000, positionKm: .1 };
  assert.equal(Wild.materialize('seed', 'place', [p], [{ x: 30, y: 10, z: 21 }]).actors.length, 0);
  const r = R.create(f.b); R.route(r, { id: 'route', distanceKm: 1 }, [p], 'seed', 0); assert.equal(r.members.length, 0);
  const market = {}; Corridor.provision(market, { id: 'route', distanceKm: 1 }, [p], 'seed', 0);
  assert.equal(market.corridorBeasts[0].actors.length, 0);
});
test('imitation is not understanding: actual unguided movement, continuous stop and a real forbidden-ground detour are required', () => {
  const f = fixture(); assert.equal(action(f, 'discuss'), false); assert(action(f, 'greet')); tick(f, 60);
  assert.equal(D.contact(f.s, f.a).understood, false); assert.equal(action(f, 'discuss'), false);
  assert(action(f, 'check')); f.blocked = true; tick(f, 200); assert.equal(D.contact(f.s, f.a).understood, false);
  assert.equal(f.s.job.stage, 'first'); f.blocked = false; tick(f, 40);
  assert.equal(D.contact(f.s, f.a).checks[0].detourObserved, true); assert.equal(f.s.job, null);
  assert.equal(f.a.contactWorkSeconds, 720); assert.equal(D.contact(f.s, f.a).checks[0].haltSeconds, 10);
});
test('one independently refusing individual does not become a troop emissary or change policy with waiting and reload', () => {
  const f = fixture(), a = f.r.beasts.actors.find(a => a.dialoguePolicy === 'decline'), work = a.contactWorkSeconds;
  assert.equal(action(f, 'greet', a), false); assert.match(D.publicView(f.s).at(-1).message, /declines/);
  f.s = D.normalize(copy(f.s)); f.r = R.normalize(copy(f.r)); const saved = f.r.beasts.actors.find(b => b.id === a.id);
  f.at += 86400; assert.equal(action(f, 'greet', saved), false); assert.equal(saved.contactWorkSeconds, work);
  assert.equal(f.s.agreements.length, 0); assert.equal(D.contact(f.s, f.a)?.understood === true, false);
});
test('absence, busy attention and interrupted continuous stopping pause without backfill or refilling spent attention', () => {
  const f = fixture(); assert(action(f, 'greet')); tick(f, 20); f.c.visible = false; tick(f, 100);
  assert.equal(f.s.job.progress, 20); f.s = D.normalize(copy(f.s));
  f.c.visible = true; tick(f, 1); assert.equal(f.s.job.progress, 20); tick(f, 40); assert.equal(f.s.job, null);
  assert.equal(f.a.contactWorkSeconds, 840);
  f.c.free = false; assert.equal(action(f, 'check'), false); assert.equal(f.a.contactWorkSeconds, 840);
});
test('slime biology, an unusable gesture channel or missing original attention/policy cannot acquire dialogue by relabeling a record', () => {
  for (const change of [f => f.a.genome = {}, f => f.a.actorKind = 'slime', f => f.c.gesture = false,
    f => delete f.a.dialoguePolicy, f => delete f.a.contactWorkSeconds]) {
    const f = fixture(); change(f); assert.equal(action(f, 'greet'), false);
    assert.equal(f.s.job, null); assert.equal(f.s.contacts.length, 0);
    D.register(f.s, f.source, f.r, f.r.beasts.actors, 'different-seed', 1000);
    assert.equal(action(f, 'greet'), false);
  }
});
test('exact individual terms require real comprehension, fresh attended assent and finite attention, not a friendliness flag', () => {
  const f = fixture(); understand(f); assert(action(f, 'discuss')); tick(f, 60);
  const p = copy(D.contact(f.s, f.a).proposal); p.terms = 'The entire troop submits';
  assert.equal(action(f, 'accept', f.a, p), false); p.terms = D.TERMS; p.boundary.cells.push({ x: 99, y: 99, z: 21 });
  assert.equal(action(f, 'accept', f.a, p), false);
  const exact = copy(D.contact(f.s, f.a).proposal); assert(action(f, 'accept', f.a, exact)); tick(f, 59);
  assert.equal(f.s.agreements.length, 0); tick(f, 1); assert.equal(f.s.agreements.length, 1);
  assert.equal(f.a.contactWorkSeconds, 600); assert.equal(f.s.agreements[0].payload.expiresAt, f.at + D.DURATION);
  assert.equal(action(f, 'discuss'), false); assert.equal(f.s.troops[0].memberIds.length, 2);
});
test('tampered unfinished assent, body/source loss and actual death cannot manufacture an agreement or refund its budget', () => {
  for (const change of [f => f.s.job.proposal.terms = 'forged', f => f.c.bodyEpoch++, f => f.c.sourceCurrent = false, f => f.a.status = 'dead']) {
    const f = fixture(); understand(f); assert(action(f, 'discuss')); tick(f, 60);
    assert(action(f, 'accept', f.a, copy(D.contact(f.s, f.a).proposal))); change(f); tick(f, 60);
    assert.equal(f.s.agreements.length, 0); assert.equal(f.a.contactWorkSeconds, 600);
  }
});
test('actual witnessed aggression and quiet-ground encroachment break only the named promise; received history stays dated', () => {
  for (const kind of ['attack', 'encroach']) {
    const f = fixture(); agree(f); const reports = copy(D.publicView(f.s));
    if (kind === 'attack') assert(D.aggression(f.s, f.a, { id: 'strike:1', actorId: 'scientist', targetId: f.a.id, actionId: 'strike' }, f.context(f.a), f.at));
    else { f.scientist = copy(f.a.homeCell); tick(f, 1); }
    assert(f.s.agreements[0].breachedAt != null); assert.deepEqual(D.publicView(f.s), reports);
    assert.equal(D.covered(f.s, f.a, f.context(f.a), 'scientist', f.at), false);
    assert(D.hear(f.s, f.a, f.context(f.a), f.at)); assert.equal(D.publicView(f.s).at(-1).agreement.state, 'receivedBrokenCompact');
    assert.equal(action(f, 'discuss'), false); assert.equal(f.s.agreements.length, 1);
  }
});
test('physical supply AI honors only the consenting individual and scoped traffic, without pacifying other beasts or unrelated targets', () => {
  function scene(f, honored, outsider = false) {
    const a = f.a, q = { source: { distanceKm: 2 }, roadContactId: 'road-contact', order: { phase: 'outbound' },
      vehicle: { id: 'truck', condition: 100, cargoKg: 40, roomId: f.site.roomId, mapCell: { x: 12, y: a.homeCell.y - 2, z: 21 } },
      driver: { id: 'driver', status: 'alive', health: 100, roomId: f.site.roomId, mapCell: { x: 12, y: a.homeCell.y - 3, z: 21 } } };
    a.mapCell = copy(a.homeCell); a.lastTarget = null; a.nextAttackAt = 0; a.nextMoveAt = 0; a.effortSeconds = 120;
    const e = { id: 'road-contact', lastAt: f.at, clearSeconds: 0, contacts: [] }, state = { encounters: [e] };
    const c = { ...f.context(a), trafficIds: [q.vehicle.id, q.driver.id] };
    let outsiderDamage = 0;
    for (let n = 1; n <= 12; n++) M.step(state, q, f.site, [a], f.at + n, {
      encounter: e, campOnly: true, alive: () => true, sight: () => true,
      protectedTarget: (a, id) => honored && D.covered(f.s, a, c, id, f.at + n),
      targets: outsider ? [{ id: 'unrelated', kind: 'creature', cell: { ...a.homeCell, x: a.homeCell.x + 1 } }] : [],
      canEnter: (a, p) => f.site.baseline.some(t => Wild.key(t.cell) === Wild.key(p)) && ![q.vehicle.mapCell, q.driver.mapCell].some(c => Wild.key(c) === Wild.key(p)),
      strike: (a, t, profile) => { if (t.id === 'truck') q.vehicle.condition -= profile.damage; else outsiderDamage += profile.damage; return { ok: true }; }
    });
    return { q, outsiderDamage };
  }
  const f = fixture(); agree(f);
  assert(scene(f, false).q.vehicle.condition < 100); assert.equal(scene(f, true).q.vehicle.condition, 100);
  assert(scene(f, true, true).outsiderDamage > 0);
  const c = { ...f.context(f.a), trafficIds: ['truck'] }; assert(D.covered(f.s, f.a, c, 'truck', f.at));
  c.cityId = 'another-city'; assert.equal(D.covered(f.s, f.a, c, 'truck', f.at), false);
  assert.equal(D.covered(f.s, f.r.beasts.actors.find(a => a !== f.a), f.context(f.a), 'scientist', f.at), false);
});
test('expiry has no automatic renewal; no unseen change rewrites a held account or publishes the original population roster', () => {
  const f = fixture(); agree(f); const known = D.publicView(f.s); f.at += D.DURATION;
  assert.equal(D.covered(f.s, f.a, f.context(f.a), 'scientist', f.at), false); assert.deepEqual(D.publicView(f.s), known);
  assert.equal(f.a.contactWorkSeconds, 600); assert(D.hear(f.s, f.a, f.context(f.a), f.at));
  assert.equal(D.publicView(f.s).at(-1).agreement.state, 'receivedExpiredCompact');
  assert(!/SECRET|originalCount|contactWorkSeconds|dialoguePolicy/.test(JSON.stringify(D.publicView(f.s))));
  assert(D.evidence(f.s).every(e => e.status === 'unverified'));
});
test('an overlapping paid renewal retains old terms and a genuine witnessed breach applies to every still-current identical promise', () => {
  const f = fixture(); agree(f); const old = copy(f.s.agreements[0].payload), reports = D.publicView(f.s);
  f.at += D.DURATION - 86400;
  assert(action(f, 'discuss')); tick(f, 60); assert(action(f, 'accept', f.a, copy(D.contact(f.s, f.a).proposal))); tick(f, 60);
  assert.equal(f.s.agreements.length, 2); assert.deepEqual(f.s.agreements[0].payload, old); assert.equal(f.a.contactWorkSeconds, 480);
  assert(D.aggression(f.s, f.a, { id: 'renewal-breach', actorId: 'scientist', targetId: f.a.id }, f.context(f.a), f.at));
  assert(f.s.agreements.every(a => a.breachedAt === f.at)); assert.deepEqual(D.publicView(f.s).slice(0, reports.length), reports);
});
test('continued imports retain original terms/work and identity; independent runs inherit nothing and irreversible death freezes work', () => {
  const f = fixture(); assert(action(f, 'greet')); tick(f, 20);
  const s = D.rebind(copy(f.s), f.b, { worldId: 'world-copy', runId: 'continued' }); assert.equal(s.job.progress, 20);
  assert.equal(s.troops[0].memberIds[0], f.s.troops[0].memberIds[0]); assert.equal(D.create({ ...f.b, runId: 'fresh' }).reports.length, 0);
  const saved = copy(f.s); f.c.alive = false; tick(f, 100); assert.deepEqual(f.s, saved);
  assert.equal(D.normalize({ ...saved, job: { ...saved.job, progress: -1 } }).invalid, true);
});
test('a witnessed violation during paid renewal cancels unfinished assent without refund or a replacement promise', () => {
  const f = fixture(); agree(f); f.at += D.DURATION - 86400;
  assert(action(f, 'discuss')); tick(f, 60); assert(action(f, 'accept', f.a, copy(D.contact(f.s, f.a).proposal))); tick(f, 20);
  assert(D.aggression(f.s, f.a, { id: 'interrupted-assent', actorId: 'scientist', targetId: f.a.id }, f.context(f.a), f.at));
  assert.equal(D.intent(f.s, f.a, f.context(f.a), f.at), null); tick(f, 60);
  assert.equal(f.s.job, null); assert.equal(f.s.agreements.length, 1); assert.equal(f.a.contactWorkSeconds, 480);
  assert(f.s.agreements[0].breachedAt != null);
});
