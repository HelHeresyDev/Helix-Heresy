const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../regional-suppression'), R = require('../regional-encounters'), Wild = require('../wilderness-beasts');
const { fixture } = require('./helpers/regional-suppression-source');
const clone = x => JSON.parse(JSON.stringify(x));
function setup() {
  const f = fixture(), binding = { worldId: 'world', runId: 'run' }, ledger = S.create(binding), region = R.create(binding);
  let seed;
  for (let n = 0; n < 100; n++) {
    const l = S.create(binding), r = R.create(binding); S.register(l, f.source, r, [], `seed-${n}`, 0);
    if (r.beasts.actors.some(a => a.campaignTravelRemainingKm > 0) && r.beasts.actors.some(a => !a.campaignTravelRemainingKm)) { seed = `seed-${n}`; break; }
  }
  assert.ok(seed); const p = S.register(ledger, f.source, region, [], seed, 0);
  return { ...f, ledger, region, p, seed, actors: region.beasts.actors };
}
test('source uses finite existing individual units, real habitat paths and a specific threatened land corridor, not abundance', () => {
  const f = fixture(); assert.equal(f.source.individualCount, 10); assert.equal(f.map.beastEcology.populations[0].populationIndex, 600);
  assert.deepEqual(f.source.homes.map(h => h.distanceKm), [0, 16]); assert.equal(f.source.routeId, 'intercity-march:corridor:ab');
  const before = clone(f.map); S.sourceFromWorld(f.map, f.route, 'a', f.geometry); assert.deepEqual(f.map, before);
});
test('elk preserve stationary habitat origins, prior bodies and finite accounting without inheriting predatory corridor travel', () => {
  const f = fixture(10, 16, S.ELK), binding = { worldId: 'world', runId: 'run' }, s = S.create(binding), r = R.create(binding);
  assert.deepEqual(f.source.profileIds, []); assert.equal(f.source.reachBasis, 'territorialHabitatCrossing');
  S.register(s, f.source, r, [], 'seed', 0); const original = clone(r.beasts.actors);
  S.advance(s, r, r.beasts.actors, 100000);
  assert.deepEqual(r.beasts.actors.map(a => a.campaignTravelRemainingKm), original.map(a => a.campaignTravelRemainingKm));
  assert.equal(r.beasts.actors.length, 10); assert(r.beasts.actors.every(a => a.health === 60 && a.speciesId === S.ELK));
  assert.equal(S.facts(s, r.beasts.actors, 100000)[0].state, 'unverified');
  assert.equal(S.register(s, { ...f.source, speciesId: S.SPECIES, profileIds: ['unrelated'] }, r, r.beasts.actors, 'seed', 100000), null);
});
test('physical habitat paths may leave the territory mask; range boundaries are not artificial impassable fences', () => {
  const f = fixture(5, 1, S.ELK);
  const neighbors = { 'planet-cell:00000': ['planet-cell:00002', 'planet-cell:00004'], 'planet-cell:00001': ['planet-cell:00002'],
    'planet-cell:00002': ['planet-cell:00000', 'planet-cell:00001', 'planet-cell:00003'], 'planet-cell:00003': ['planet-cell:00002'], 'planet-cell:00004': ['planet-cell:00000'] };
  f.geometry.land = id => Boolean(neighbors[id]); f.geometry.neighbors = id => neighbors[id] || [];
  const source = S.sourceFromWorld(f.map, f.route, 'a', f.geometry)[0];
  assert(source.homes.find(h => h.cellId === 'planet-cell:00004').path.includes('planet-cell:00000'));
});
test('unlinked original elk incapacity supplies its own saved strategic fact, without a grain-contact prerequisite', () => {
  const f = fixture(5, 1, S.ELK, { crossingOnly: true }), binding = { worldId: 'world', runId: 'run' }, s = S.create(binding), r = R.create(binding);
  const corpse = Wild.actor(S.ELK, 'prior-actual-death', { x: 1, y: 2, z: 6 }, f.source.populationId); corpse.status = 'dead'; corpse.health = 0;
  R.adopt(r, [corpse], 'prior-encounter', 0); S.register(s, f.source, r, [corpse], 'seed', 0);
  assert.equal(r.beasts.actors.length, 4); r.beasts.actors.forEach(a => a.health = 12);
  const actors = [...r.beasts.actors, corpse]; assert.equal(S.facts(s, actors, 1)[0].state, 'qualifying');
  const loaded = S.normalize(clone(s)); assert.equal(S.facts(loaded, actors, 2)[0].since, 1);
  const before = clone(loaded); assert.deepEqual(S.facts(loaded, actors, 3, false), []); assert.deepEqual(loaded, before);
  assert.equal(S.facts(loaded, actors.slice(1), 3)[0].state, 'unverified');
  assert.equal(S.facts(loaded, actors, 4)[0].since, 4);
  assert.equal(S.facts(loaded, [...actors, { ...actors[0], id: 'extra' }], 5)[0].state, 'unverified');
  assert.equal(S.facts(loaded, actors, 6)[0].since, 6);
  assert.equal(S.facts(loaded, [...actors, clone(actors[0])], 7)[0].state, 'unverified');
  loaded.populations[0].createdAt = 1000; assert.equal(S.facts(loaded, actors, 8)[0].state, 'unverified');
});
test('unsupported species, missing units, unthreatened corridors and disconnected habitat cannot create convenient wolves', () => {
  for (const change of [f => f.map.beastEcology.populations[0].speciesId = 'beast:glasswing-roc', f => delete f.map.beastEcology.populations[0].devotionalUnitCount,
    f => f.map.beastEcology.populations[0].devotionalUnitCount = 0, f => f.map.beastEcology.waveProfiles[0].threatenedCorridorIds = [],
    f => f.geometry.neighbors = () => []]) {
    const f = fixture(); change(f); assert.deepEqual(S.sourceFromWorld(f.map, f.route, 'a', f.geometry), []);
  }
});
test('population allocation is conserved, exceeds representative cap legitimately and is independent of an objective', () => {
  const f = setup(); assert.equal(f.actors.length, 10); assert.equal(f.region.members.length, 10); assert.equal(R.remaining(f.region, f.source.populationId), 0);
  const before = clone(f.region); S.register(f.ledger, f.source, f.region, f.actors, 'other-seed', 100); assert.deepEqual(f.region, before);
  R.route(f.region, { id: f.source.routeId, distanceKm: 2 }, [{ id: f.source.populationId, speciesId: S.SPECIES, populationIndex: 1000 }], 'seed', 0);
  assert.equal(f.region.beasts.actors.length, 10);
});
test('original encounters, wounds and deaths consume population capacity without duplication or relocation', () => {
  const f = fixture(), binding = { worldId: 'world', runId: 'run' }, l = S.create(binding), r = R.create(binding);
  const original = Wild.actor(S.SPECIES, 'original', { x: 1, y: 2, z: 6 }, f.source.populationId, 0); original.health = 12;
  R.adopt(r, [original], 'original-ground', 0); const p = S.register(l, f.source, r, [original], 'seed', 0);
  assert.equal(p.members.length, 10); assert.equal(r.beasts.actors.length, 9); assert.equal(original.health, 12); assert.equal(original.roomId, Wild.ROOM);
  assert.equal(S.assess(p, [...r.beasts.actors, original], 0).status, 'capable');
  original.health = 48; assert.equal(S.assess(p, [...r.beasts.actors, original], 0).status, 'unverified');
});
test('missing original identities, inconsistent totals and empty rosters cannot manufacture suppression', () => {
  const f = setup(); assert.equal(S.assess(f.p, [], 0).status, 'unverified');
  assert.equal(S.assess({ ...f.p, members: [] }, f.actors, 0).status, 'unverified');
  assert.equal(S.normalize({ ...f.ledger, populations: [{ ...f.p, members: [] }] }).populations.length, 0);
  for (const a of f.actors) a.campaignTravelRemainingKm = 100;
  assert.equal(S.assess(f.p, f.actors, 0).status, 'unverified'); // Mere distance of an untouched population is not a campaign result.
  f.actors[0].health = 10;
  assert.equal(S.assess(f.p, f.actors, 0).status, 'unverified'); // An unrelated distant wound is not suppression of corridor pressure.
});
test('off-corridor original hunting groups spend actual distance at physical walking pace and cannot spawn at a local site early', () => {
  const f = setup(), far = f.actors.find(a => a.campaignTravelRemainingKm > 0), initial = far.campaignTravelRemainingKm;
  assert(!R.positions(f.region, f.source.routeId).includes(far.positionKm));
  S.advance(f.ledger, f.region, f.actors, 3600); assert.equal(far.campaignTravelRemainingKm, initial - 2.4);
  assert.equal(far.mapCell, null); assert.equal(far.roomId, '');
  S.advance(f.ledger, f.region, f.actors, 3600); assert.equal(far.campaignTravelRemainingKm, initial - 2.4);
});
test('original wounds slow approach, incapacitating wounds stop it, and no remote healing or unseen fight occurs', () => {
  const f = setup(), far = f.actors.find(a => a.campaignTravelRemainingKm > 0);
  S.advance(f.ledger, f.region, f.actors, 3600, true, () => 2); assert.equal(far.campaignTravelRemainingKm, 14.8);
  far.health = 10; const remaining = far.campaignTravelRemainingKm;
  S.advance(f.ledger, f.region, f.actors, 100000); assert.equal(far.campaignTravelRemainingKm, remaining); assert.equal(far.health, 10);
});
test('breaking one group cannot certify a region while another healthy group can arrive within the assessment window', () => {
  const f = setup(); for (const a of f.actors.filter(a => !a.campaignTravelRemainingKm)) a.health = 10;
  assert.equal(S.assess(f.p, f.actors, 0).status, 'suppressed'); // Far group initially more than six physical hours away.
  S.advance(f.ledger, f.region, f.actors, 3600); assert.equal(S.assess(f.p, f.actors, 3600).status, 'capable');
  assert.equal(f.p.suppressedSince, null); assert.equal(f.actors.filter(S.capable).length, 5);
});
test('actual surviving severe wounds suppress the scoped capacity without extinction; sufficient recovery would renew it', () => {
  const f = setup(); for (const a of f.actors) a.health = 10;
  S.advance(f.ledger, f.region, f.actors, 1); assert.equal(f.p.suppressedSince, 1); assert.equal(f.actors.filter(a => a.status === 'alive').length, 10);
  f.actors[0].health = 48; S.advance(f.ledger, f.region, f.actors, 2);
  if (!f.actors[0].campaignTravelRemainingKm) assert.equal(f.p.suppressedSince, null);
});
test('arrival displaces original groups rather than erasing or replenishing them', () => {
  const f = setup(); S.advance(f.ledger, f.region, f.actors, 16 / 2.4 * 3600 + 1);
  assert(f.p.displacements.length > 0); assert.equal(f.actors.length, 10); assert(f.actors.every(a => a.campaignTravelRemainingKm === 0));
  const before = clone(f.p.displacements); S.advance(f.ledger, f.region, f.actors, 100000); assert.deepEqual(f.p.displacements, before);
});
test('actual source-linked contacts are required; public reports never disclose unseen reserves or private capability assessment', () => {
  const f = setup(), dossier = { report: { id: 'received', speciesId: S.SPECIES }, populationIds: [f.source.populationId], profileIds: f.source.profileIds };
  assert.equal(S.record(f.ledger, dossier, f.source.routeId, 'site', [], 0), false);
  assert.equal(S.record(f.ledger, dossier, f.source.routeId, 'site', [Wild.actor(S.SPECIES, 'unrelated', {}, 'other')], 0), false);
  const near = f.actors.filter(a => !a.campaignTravelRemainingKm); near.forEach(a => a.health = 10);
  assert(S.record(f.ledger, dossier, f.source.routeId, 'site', near, 1)); const view = S.publicView(f.ledger);
  assert.match(view.reports[0].text, /broken for now/); assert.match(view.reports[0].text, /unverified/);
  assert.doesNotMatch(JSON.stringify(view), /SECRET|individualCount|populationId|suppressedSince|hunting-group:/);
  f.ledger.reports[0].privateMarker = 'SECRET'; f.ledger.reports[0].observations[0].populationId = 'SECRET';
  assert.deepEqual(S.publicView(f.ledger), view);
  S.advance(f.ledger, f.region, f.actors, 1000); assert.deepEqual(S.publicView(f.ledger), view);
});
test('continued reload/import preserves exact original identities and physical approach; fresh same-world runs inherit none', () => {
  const f = setup(); S.advance(f.ledger, f.region, f.actors, 100);
  const l = S.rebind(f.ledger, { worldId: 'world', runId: 'run' }, { worldId: 'world', runId: 'import' });
  const r = R.rebind(f.region, { worldId: 'world', runId: 'run' }, { worldId: 'world', runId: 'import' });
  assert.deepEqual(r.beasts.actors, f.actors); assert.deepEqual(l.populations, f.ledger.populations);
  assert.equal(S.create({ worldId: 'world', runId: 'fresh' }).populations.length, 0);
});
test('irreversible death freezes movement and received knowledge', () => {
  const f = setup(), before = clone({ l: f.ledger, r: f.region }); S.advance(f.ledger, f.region, f.actors, 10000, false);
  assert.deepEqual({ l: f.ledger, r: f.region }, before);
});
test('a complete small population pool blocks ordinary local/convoy claims and unexplained extra originals cannot be ignored', () => {
  const f = fixture(1), binding = { worldId: 'world', runId: 'run' }, s = S.create(binding), r = R.create(binding);
  const p = S.register(s, f.source, r, [], 'seed', 0);
  assert.equal(R.remaining(r, f.source.populationId), 0);
  const extra = Wild.actor(S.SPECIES, 'unexplained-extra', { x: 1, y: 2, z: 6 }, f.source.populationId);
  assert.equal(R.claim(r, extra, 'new-local-ground', 1), false);
  assert.equal(R.remaining(R.normalize(r), f.source.populationId), 0);
  r.beasts.actors[0].health = 0; r.beasts.actors[0].status = 'dead';
  assert.equal(S.assess(p, [...r.beasts.actors, extra], 1).status, 'unverified');
});
test('field notes distinguish captured witness time from receipt and cannot acquire later unseen conditions', () => {
  const f = setup(), near = f.actors.filter(a => !a.campaignTravelRemainingKm), captured = clone(near);
  const dossier = { report: { id: 'received', speciesId: S.SPECIES }, populationIds: [f.source.populationId], profileIds: f.source.profileIds };
  near.forEach(a => { a.health = 0; a.status = 'dead'; });
  assert(S.record(f.ledger, dossier, f.source.routeId, 'site', captured, 61, true, 1));
  const report = S.publicView(f.ledger).reports[0]; assert.equal(report.observedAt, 1); assert.equal(report.at, 61);
  assert(report.observations.every(o => o.capable)); assert.match(report.text, /remains capable/);
  assert.equal(S.record(f.ledger, dossier, f.source.routeId, 'site', captured, 62, true, 63), false);
});
