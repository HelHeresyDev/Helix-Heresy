const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../regional-beast-powers');
const Maps = require('../municipal-maps');
const { fixture } = require('./helpers/regional-beast-power-source');
const clone = x => JSON.parse(JSON.stringify(x));
function setup() { const f = fixture(); return { ...f, source: P.sourceFromWorld(f.map, 'a'), state: P.create({ worldId: 'world', runId: 'run' }) }; }
const begin = (f, at = 0) => P.request(f.state, f.source, f.office, f.ctx, at);
test('a real static species and physically routed canonical population justify a narrow account without mutating the world', () => {
  const f = setup(), before = clone(f.map); assert.ok(f.source); assert.equal(f.source.report.speciesName, 'Rimefang Pack');
  assert.deepEqual(f.source.populationIds, ['SECRET_POPULATION']); assert.deepEqual(f.map, before);
  assert.equal(P.sourceFromWorld(f.map, 'unknown'), null);
});
test('ordinary presence, high species threat, migration or a warning without actual regional backing cannot manufacture a power', () => {
  for (const change of [f => f.map.beastEcology.waveProfiles = [], f => f.map.beastEcology.populations[0].populationIndex = 0,
    f => f.map.beastEcology.populations[0].territory.rangeCellCount = 0, f => f.map.beastEcology.waveProfiles[0].cellPath = [],
    f => f.map.beastEcology.waveProfiles[0].distanceKm = 0, f => f.map.publicBeastAtlas.waveWarnings = [],
    f => f.map.publicBeastAtlas.waveWarnings[0].severityBand = 'guarded', f => f.map.beastEcology.waveProfiles[0].threatenedCityIds = ['elsewhere']]) {
    const f = setup(); change(f); assert.equal(P.sourceFromWorld(f.map, 'a'), null);
  }
});
test('instinctive populations can qualify without politics, language, religion or a migration record', () => {
  const f = setup(); f.map.beastEcology.species[0] = { ...f.map.beastEcology.species[0], intelligenceBand: 'instinctive', socialPattern: 'migratoryHerd' };
  assert.equal(P.sourceFromWorld(f.map, 'a').report.socialPattern, 'migratoryHerd');
});
test('request requires current attendance, permission, original finite office and available duty', () => {
  for (const change of [f => f.ctx.atCounter = false, f => f.ctx.clerkPresent = false, f => f.ctx.lineOfSight = false,
    f => f.ctx.visitPermission = false, f => f.ctx.serviceAvailable = false, f => f.ctx.capable = false, f => f.ctx.busy = true,
    f => f.office.cityId = 'other', f => f.office.clerk.status = 'dead', f => f.office.workSeconds = 179,
    f => f.office.power = 0, f => f.office.assignment = 'map-job', f => f.office.availableAt = 1]) {
    const f = setup(); change(f); const before = clone(f.office); assert.equal(begin(f), false); assert.deepEqual(f.office, before);
  }
});
test('no hidden evidence escapes pending work; completing actual duty spends exactly one power and 180 seconds', () => {
  const f = setup(); assert.equal(begin(f), true); assert.equal(f.office.power, 4);
  assert.equal(JSON.stringify(P.publicView(f.state)).includes('Rimefang'), false); assert.deepEqual(P.publicView(f.state).dossiers, []);
  P.advance(f.state, f.office, f.ctx, 60); assert.equal(f.office.workSeconds, 940); assert.equal(f.state.job.progress, 60);
  f.state = P.normalize(clone(f.state)); P.advance(f.state, f.office, f.ctx, 180);
  assert.equal(f.office.workSeconds, 820); assert.equal(f.state.job, null); assert.equal(f.office.assignment, null);
  assert.equal(f.state.dossiers[0].receivedAt, 180); assert.equal(f.state.dossiers[0].report.sourceAt, null);
  assert.doesNotMatch(JSON.stringify(P.publicView(f.state)), /SECRET|populationIds|profileIds|clerkId|rangeMask|cellPath|lairCellId|job/);
  assert.equal(begin(f, 180), false); assert.equal(f.office.power, 4);
});
test('the same office assignment excludes existing map and identity consumers', () => {
  const f = setup(); assert.equal(begin(f), true);
  const state = { officeId: f.office.id, institutionId: f.office.institutionId, cityId: 'a', accessActive: true, archive: { placeId: 'survey:a' }, copies: [] };
  assert.equal(Maps.reason(state, f.office, 'groundPlan', f.ctx), 'The clerk is already assigned to work.');
});
test('an outage pauses original work without absence backfill or a replacement clerk', () => {
  const f = setup(); begin(f); P.advance(f.state, f.office, f.ctx, 50);
  f.office.channelPowered = false; P.advance(f.state, f.office, f.ctx, 70);
  f.office.channelPowered = true; P.advance(f.state, f.office, f.ctx, 10000); assert.equal(f.state.job.progress, 50);
  f.office.clerk.id = 'replacement'; P.advance(f.state, f.office, f.ctx, 10020); assert.equal(f.state.job.progress, 50);
  f.office.clerk.id = 'original-clerk'; P.advance(f.state, f.office, f.ctx, 10040); P.advance(f.state, f.office, f.ctx, 10170);
  assert.equal(f.state.dossiers.length, 1); assert.equal(f.office.power, 4);
});
test('leaving, incapacity, permission loss and a changed body cancel unfinished work while retaining costs', () => {
  for (const change of [c => c.atCounter = false, c => c.capable = false, c => c.visitPermission = false, c => c.placeId = 'other', c => c.bodyEpoch++]) {
    const f = setup(); begin(f); P.advance(f.state, f.office, f.ctx, 30); change(f.ctx); P.advance(f.state, f.office, f.ctx, 50);
    assert.equal(f.state.job, null); assert.deepEqual(f.state.dossiers, []); assert.equal(f.office.power, 4); assert.equal(f.office.workSeconds, 970);
  }
});
test('received accounts retain their original content, not updated private ecology or live remote conditions', () => {
  const f = setup(); begin(f); f.source.report.speciesName = 'changed'; P.advance(f.state, f.office, f.ctx, 180);
  const before = clone(P.publicView(f.state)); f.map.beastEcology.populations[0].populationIndex = 0; f.office.clerk.status = 'dead';
  P.advance(f.state, f.office, f.ctx, 9999); assert.deepEqual(P.publicView(f.state), before);
});
test('witnessed individual signs supplement a dossier without identifying its population or establishing extinction', () => {
  const f = setup(); begin(f); P.advance(f.state, f.office, f.ctx, 180);
  const sighting = { id: 'seen-beast', name: 'Rimefang', speciesId: f.source.report.speciesId, observedAt: 20, condition: 'Dead; physical remains', populationId: 'SECRET_POPULATION', cell: { x: 1, y: 2, z: 3 } };
  assert.equal(P.observe(f.state, sighting, 'original-ground'), true); assert.equal(P.observe(f.state, sighting, 'original-ground'), false);
  assert.equal(P.observe(f.state, sighting, 'fallback-ground'), false);
  assert.equal(P.observe(f.state, { ...sighting, speciesId: 'slime' }, 'original-ground'), false);
  const view = P.publicView(f.state); assert.match(view.dossiers[0].observations[0].association, /unconfirmed/);
  assert.doesNotMatch(JSON.stringify(view), /SECRET|extinct|resolved|victory/); assert.equal(view.dossiers[0].observations.length, 1);
});
test('planning only selects an acquired report, costs no resources and grants no resolution', () => {
  const f = setup(); assert.equal(P.select(f.state, f.source.report.id, 0), false); begin(f); P.advance(f.state, f.office, f.ctx, 180);
  const before = clone(f.office); assert.equal(P.select(f.state, f.source.report.id, 200), true); assert.deepEqual(f.office, before);
  assert.equal(f.state.objective.purpose, 'investigate'); assert.equal(P.select(f.state, 'hidden', 201), false);
  assert.equal(P.select(f.state, null, 201, false), false); assert.equal(P.select(f.state, null, 201), true);
});
test('normalization and continued import preserve exact work, received knowledge and binding without independent-run inheritance', () => {
  const f = setup(); begin(f); P.advance(f.state, f.office, f.ctx, 60);
  const rebound = P.rebind(f.state, { worldId: 'world', runId: 'run' }, { worldId: 'world', runId: 'import' });
  assert.equal(rebound.runId, 'import'); assert.equal(rebound.job.progress, 60); assert.equal(rebound.job.id, f.state.job.id);
  P.advance(rebound, f.office, f.ctx, 180); assert.equal(rebound.dossiers.length, 1);
  assert.deepEqual(P.create({ worldId: 'world', runId: 'fresh' }).dossiers, []);
  assert.equal(P.normalize({ ...rebound, job: { ...f.state.job, progress: -1 } }).job, null);
  assert.deepEqual(P.normalize({ ...rebound, dossiers: {} }).dossiers, []);
});
test('death freezes unfinished work, knowledge and selection; fractional clocks issue exactly one dossier', () => {
  const f = setup(); begin(f); const before = clone(f.state); P.advance(f.state, f.office, { ...f.ctx, alive: false }, 1000);
  assert.deepEqual(f.state, before); assert.equal(P.observe(f.state, { id: 'seen' }, 'site', false), false);
  P.cancel(f.state, f.office, 1000); assert.equal(begin(f, 1000.1234567), true);
  P.advance(f.state, f.office, f.ctx, 1180.1234567); P.advance(f.state, f.office, f.ctx, 2000);
  assert.equal(f.state.dossiers.length, 1);
});
