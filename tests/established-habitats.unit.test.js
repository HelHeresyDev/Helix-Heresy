const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), B = require('../beast-habitat-bindings');
const P = require('../beast-populations'), W = require('../beast-regional-work'), D = require('../creature-biology');
const { source: prepared } = require('./helpers/regional-work-source');
const copy = x => JSON.parse(JSON.stringify(x)), binding = { worldId: 'world', runId: 'run' }, DAY = P.DAY;
const approx = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
let cached;
function generated() {
  if (!cached) {
    const world = L.createWorld({ id: 'established-test', worldSeed: 'source-small', createdAt: 'test', generationVersion: 8,
      creationSettings: { strategicMap: { refinementLevel: 2 } } });
    const map = world.generatedData.strategicMap, record = map.beastHabitatSources;
    cached = { map, record, source: S.expand(record, map), raw: S.expand(record, map, { raw: true }) };
  }
  return cached;
}
function physical(action, change = () => {}, members = 1) {
  const src = prepared(action, members), site = src.regions[0].ecology.workSites[0];
  Object.assign(site, { featureId: 'actual-workface', footprintHa: 1,
    position: { regionId: 'workface', eastM: 0, northM: 0, altitudeM: 0 } });
  for (const g of src.groups) g.home = { patchId: 'workface', eastKm: 0, northKm: 0, depthM: 0 };
  change(src, site);
  const s = P.create(src, binding);
  for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
  return s;
}
const siteOf = s => s.regions[0].ecology.workSites[0];
test('new work sites share feature-first space and bind below-threshold drainage, never invented basin outlets', () => {
  const { record, map, source } = generated();
  assert.equal(record.establishedHabitats, true);
  assert.equal(record.physicalBinding.availability.filter(a => a.status === 'unavailable').length, 0);
  const dams = record.physicalBinding.workSites.filter(row => row.site.action === 'buildDam');
  assert.ok(dams.length > 0);
  assert.ok(dams.some(row => map.hydrology.riverClasses[source.regions.find(r => r.id === row.regionId).source.cellIndex] === '.'));
  assert.equal(new Set(dams.map(row => row.regionId)).size, dams.length);
  for (const r of source.regions.filter(r => map.hydrology.downstreamByCell[r.source.cellIndex] < 0))
    assert.equal(r.ecology.watercourses?.length || 0, 0);
  const raw = copy(generated().raw), first = B.allocate(raw, map, { positions: true, established: true });
  for (const g of raw.groups) { g.id = `renamed:${g.id}`; for (const c of g.cohorts) c.count *= 2; }
  const second = B.allocate(raw, map, { positions: true, established: true });
  for (const row of first.workSites.filter(row => row.site.action !== 'buildFurnace')) {
    const other = second.workSites.find(other => other.site.id === row.site.id);
    assert.deepEqual(other.site.position, row.site.position);
    assert.equal(other.site.maxWorkers, row.site.maxWorkers);
    assert.equal(other.site.footprintHa, row.site.footprintHa);
  }
});
test('original structures have paid actual construction, worker maintenance and mature labor, without past ecological or birth credits', () => {
  const { record, raw } = generated(), history = record.physicalBinding.initialWork;
  assert.ok(history.length > 0);
  for (const row of history) {
    const site = record.physicalBinding.workSites.find(x => x.site.id === row.siteId).site;
    const life = D.lifecycle[site.speciesId];
    approx(row.workers.reduce((n, w) => n + w.workerDays, 0), row.workerDays);
    assert.ok(row.workerDays <= site.maxWorkers * raw.calendar.monthDays.at(-1));
    for (const worker of row.workers) {
      const c = raw.groups.flatMap(g => g.cohorts).find(c => c.id === worker.cohortId);
      assert.ok(c); assert.ok(worker.workerDays <= c.count * Math.max(0, c.ageDays - life.adultDays));
    }
    for (const [key, cost] of Object.entries(W.spec(row.action).costs)) approx(row.inputs[site.inputKeys[key] || key], row.workerDays * cost);
    approx(row.structure.kg, row.workerDays * W.spec(row.action).outputs[row.structure.key]);
    assert.equal(site.performedWorkDays || 0, 0);
  }
  const s = P.createDiagnostic(generated().source, binding);
  assert.equal(s.births.length, 0);
  assert.ok(s.regions.every(r => !r.exhausted && Object.values(r.ecologicalAccount.nurturing).every(n => n === 0)));
});
function furnaceHistory(change = () => {}) {
  const { raw, map } = generated(), src = copy(raw);
  const g = src.groups.find(g => g.speciesId === 'beast:ember-ant'); src.groups = [g];
  const r = src.regions.find(r => r.id === g.regionId);
  r.stocks.metalKg = 10; r.capacity.metalKg = 10;
  for (const c of g.cohorts) c.ageDays = Math.max(c.ageDays, D.lifecycle[g.speciesId].adultDays + 32);
  r.seasons.at(-1).temperatureC = 20;
  change(src, r, g);
  const allocations = B.allocate(src, map, { positions: true, established: true });
  B.apply(src, allocations, map);
  return { src, allocations, r, g, site: r.ecology.workSites.find(s => s.action === 'buildFurnace') };
}
test('furnace history uses real refined metal and same-colony mature workers, never stone or future labor', () => {
  const { src, allocations, r, site } = furnaceHistory();
  const row = allocations.initialWork.find(w => w.action === 'buildFurnace'); assert.ok(row);
  assert.ok(site.furnaceKg > 0); assert.ok(site.furnaceKg <= site.maxFurnaceKg * .25);
  const localMetal = site.inputKeys.metalKg;
  const delivered = allocations.transfers.find(t => t.to === localMetal).amount;
  approx(delivered - r.stocks[localMetal], row.workerDays * .00002);
  assert.ok(row.workers.every(w => src.groups[0].cohorts.some(c => c.id === w.cohortId && c.role === 'worker')));
  assert.ok(P.validateSource(src));
  for (const change of [(_s, r) => { r.stocks.metalKg = 0; }, (_s, _r, g) => {
    for (const c of g.cohorts) c.ageDays = D.lifecycle[g.speciesId].adultDays;
  }, (_s, _r, g) => { for (const c of g.cohorts) if (c.role === 'worker') c.role = 'male'; }]) {
    const absent = furnaceHistory(change);
    assert.equal(absent.site.furnaceKg, 0);
    assert.equal(absent.allocations.initialWork.filter(w => w.action === 'buildFurnace').length, 0);
  }
});
test('unmarked archived allocations retain their original bindings and receive no construction history', () => {
  const { record, map } = generated(), legacy = S.generate(record.seed, map, { establishedHabitats: false });
  const before = JSON.stringify(legacy);
  assert.equal(legacy.establishedHabitats, undefined); assert.equal(legacy.physicalBinding.initialWork, undefined);
  assert.ok(legacy.physicalBinding.issues.some(i => i.kind === 'missingPhysicalWorkSite'));
  assert.ok(S.validate(legacy, map)); assert.equal(JSON.stringify(legacy), before);
});
test('work face reach follows original, personally moved and arrived bodies rather than region membership', () => {
  const s = physical('tendWetland'), g = s.groups[0], c = g.cohorts[0], site = siteOf(s);
  assert.ok(W.inReach(g, c, site));
  c.regionalPosition = { ...site.position, eastM: 1000 };
  assert.equal(W.inReach(g, c, site), false);
  delete c.regionalPosition; g.regionalPosition = { ...site.position, eastM: 1000 };
  assert.equal(W.inReach(g, c, site), false);
  delete g.regionalPosition;
  g.home.eastKm = 1; assert.equal(W.inReach(g, c, site), false);
  const distant = physical('tendWetland', src => { src.groups[0].home.eastKm = 1; });
  P.advance(distant, DAY, true, true); assert.equal(distant.regions[0].ecologicalReceipts?.tendWetland || 0, 0);
});
test('bounded shared formations cannot count distant members as local workers', () => {
  const s = physical('tendWetland', (_src, site) => { site.maxWorkers = 100; }, 1000000), g = s.groups[0], c = g.cohorts[0];
  g.regionalFormation = { [c.originId]: { offsetM: 0, columns: 1000, eastSpacingM: 1, northSpacingM: 1 } };
  assert.equal(W.inReach(g, c, siteOf(s)), false);
  c.regionalPosition = copy(siteOf(s).position);
  assert.ok(W.inReach(g, c, siteOf(s))); // Personal positions override the old group grid.
  assert.equal(c.ranges.length, 1);
});
test('site-local recipe exhaustion and destruction spend only its finite material partition', () => {
  const s = physical('buildDam', (src, site) => {
    site.inputKeys = { constructionKg: `${site.id}:constructionKg` };
    src.regions[0].stocks[site.inputKeys.constructionKg] = 10;
    src.regions[0].capacity[site.inputKeys.constructionKg] = 10;
  });
  const r = s.regions[0], site = siteOf(s), global = r.stocks.constructionKg;
  P.advance(s, DAY / 20, true, true); approx(site.damKg, 5);
  const branch = P.normalize(s, binding); assert.ok(branch);
  P.advance(s, DAY, true, true); P.advance(branch, DAY, true, true);
  approx(site.damKg, 10); assert.deepEqual(r, branch.regions[0]);
  assert.equal(r.stocks.constructionKg, global); approx(r.stocks[site.inputKeys.constructionKg], 0);
  const fresh = physical('buildDam', (src, site) => {
    site.inputKeys = { constructionKg: `${site.id}:constructionKg` };
    src.regions[0].stocks[site.inputKeys.constructionKg] = 10; src.regions[0].capacity[site.inputKeys.constructionKg] = 10;
  });
  assert.ok(P.destroyEcologicalWorkSite(fresh, 'workface', siteOf(fresh).id, 0, 'actual-breach'));
  approx(fresh.regions[0].outputs[`destroyedWorkSite:${site.inputKeys.constructionKg}`], 10);
  assert.equal(fresh.regions[0].stocks.constructionKg, global); assert.ok(P.normalize(fresh));
});
test('shared feature throughput is divided among actual workers instead of copied for every group', () => {
  const s = physical('tendWetland', src => {
    const g = copy(src.groups[0]); g.id = 'second'; g.populationId = 'second'; g.cohorts[0].id = 'second-workers'; src.groups.push(g);
  });
  P.advance(s, DAY, true, true); approx(s.regions[0].ecologicalReceipts.tendWetland, 1);
});
test('dormant dream sites require explicit present participants and independent consent; withdrawal interrupts only future work', () => {
  const s = physical('dreamWeather', (_src, site) => { site.participantGroupIds = []; site.allowDormantParticipants = true; });
  const r = s.regions[0], site = siteOf(s);
  P.advance(s, DAY / 4, true, true); assert.equal(r.ecologicalReceipts?.dreamWeather || 0, 0);
  assert.equal(P.setDreamParticipants(s, 'workface', site.id, ['nonexistent'], s.clock, 'test'), false);
  assert.ok(P.setEcologicalActivity(s, 'original-sleepers', { sleeping: false, dreamConsent: false }, s.clock, 'awake'));
  assert.ok(P.setDreamParticipants(s, 'workface', site.id, ['original-sleepers'], s.clock, 'record-actual-participant'));
  P.advance(s, DAY / 2, true, true); assert.equal(r.ecologicalReceipts?.dreamWeather || 0, 0);
  assert.equal(s.groups[1].activityState.dreamConsent, false);
  assert.ok(P.setEcologicalActivity(s, 'original-sleepers', { sleeping: true, dreamConsent: true }, s.clock, 'explicit-consent'));
  P.advance(s, DAY, true, true); approx(r.ecologicalReceipts.dreamWeather, .5);
  assert.ok(P.setEcologicalActivity(s, 'original-sleepers', { sleeping: true, dreamConsent: false }, s.clock, 'refused'));
  const branch = P.rebind(P.normalize(s), binding, { ...binding, runId: 'continued' });
  P.advance(s, 2 * DAY, true, true); P.advance(branch, 2 * DAY, true, true);
  approx(r.ecologicalReceipts.dreamWeather, .5); assert.deepEqual(r, branch.regions[0]);
  assert.ok(P.setDreamParticipants(s, 'workface', site.id, [], s.clock, 'left'));
  assert.deepEqual(site.participantGroupIds, []); assert.ok(P.normalize(s));
});
test('dream participants must physically reach the site and survive, not merely share its regional label', () => {
  for (const change of [s => { s.groups[1].home.eastKm = 1; }, s => { s.groups[1].regionId = 'downstream'; },
    s => { s.groups[1].cohorts[0].count = 0; }, s => { s.groups[1].willing = false; }]) {
    const s = physical('dreamWeather', (src, site) => { site.participantGroupIds = []; site.allowDormantParticipants = true; change(src); });
    assert.equal(P.setDreamParticipants(s, 'workface', siteOf(s).id, ['original-sleepers'], 0, 'attempt'), false);
    P.advance(s, DAY, true, true); assert.equal(s.regions[0].ecologicalReceipts?.dreamWeather || 0, 0);
  }
  const human = physical('dreamWeather', (src, site) => {
    site.participantGroupIds = []; site.allowDormantParticipants = true;
    const g = src.groups[1], c = g.cohorts[0], p = D.lifecycle.human;
    g.speciesId = c.speciesId = 'human'; c.ageDays = p.adultDays; c.massKg = p.adultKg;
  });
  assert.ok(P.setDreamParticipants(human, 'workface', siteOf(human).id, ['original-sleepers'], 0, 'actual-human-sleeper'));
  P.advance(human, DAY / 4, true, true); approx(human.regions[0].ecologicalReceipts.dreamWeather, .25);
  assert.ok(P.normalize(human));
});
test('malformed physical faces, local recipes and re-signed original history cannot pass validation', () => {
  for (const change of [site => { site.footprintHa = 101; }, site => { site.maxWorkers = 1e20; },
    site => { site.position.eastM = 1e8; }, site => { site.historicalWorkerDays = -1; },
    site => { site.inputKeys = { constructionKg: 'unrelated-reserve' }; }]) {
    assert.throws(() => physical('buildDam', (_src, site) => change(site)));
  }
  const { record, map } = generated(), tampered = copy(record);
  tampered.physicalBinding.initialWork[0].workerDays *= 2;
  tampered.id = ''; tampered.id = `beast-habitat-source:${require('../strategic-world').stableHash(tampered)}`;
  assert.throws(() => S.validate(tampered, map), /physical accounts/);
});
test('a full four-month work-face control retains finite material depletion and consent interruption through seasonal boundaries', () => {
  const s = physical('dreamWeather', (_src, site) => { site.participantGroupIds = []; site.allowDormantParticipants = true; });
  const site = siteOf(s), r = s.regions[0];
  P.advance(s, 29 * DAY, true, true);
  assert.equal(r.ecologicalReceipts?.dreamWeather || 0, 0);
  assert.ok(P.setDreamParticipants(s, 'workface', site.id, ['original-sleepers'], s.clock, 'actual-participation'));
  P.advance(s, 60 * DAY, true, true);
  approx(r.ecologicalReceipts.dreamWeather, 31);
  assert.ok(P.setEcologicalActivity(s, 'original-sleepers', { sleeping: true, dreamConsent: false }, s.clock, 'withdrawal'));
  const branch = P.normalize(s); assert.ok(branch);
  P.advance(s, 120 * DAY, true, true); P.advance(branch, 120 * DAY, true, true);
  approx(r.ecologicalReceipts.dreamWeather, 31); approx(r.stocks.atmosphericWaterL, 69000);
  assert.deepEqual(r, branch.regions[0]); assert.ok(P.normalize(s));
  const dam = physical('buildDam', (src, site) => {
    site.inputKeys = { constructionKg: `${site.id}:constructionKg` };
    src.regions[0].stocks[site.inputKeys.constructionKg] = 100; src.regions[0].capacity[site.inputKeys.constructionKg] = 100;
  });
  P.advance(dam, 120 * DAY, true, true);
  approx(siteOf(dam).damKg, 100); approx(dam.regions[0].ecologicalReceipts.buildDam, 1);
  approx(dam.regions[0].stocks[siteOf(dam).inputKeys.constructionKg], 0); assert.ok(P.normalize(dam));
});
