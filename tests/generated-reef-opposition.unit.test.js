const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), World = require('../strategic-world'), S = require('../beast-habitat-sources');
const P = require('../beast-populations'), F = require('../beast-regional-foodweb'), B = require('../beast-bodies');
const Foreign = require('../foreign-wilderness');
const CATHEDRAL = 'beast:brine-cathedral', WYRM = 'beast:reef-wyrm', DAY = P.DAY;
let fixture;
function generated() {
  if (!fixture) {
    const world = L.createWorld({ id: 'generated-reef', worldSeed: 'native-encounters', createdAt: 'test', generationVersion: 8,
      creationSettings: { strategicMap: { refinementLevel: 2 } } });
    const map = world.generatedData.strategicMap, record = S.validate(map.beastHabitatSources, map);
    assert.equal(record.reefOppositionRows.length, 1);
    const [pi, ordinal, point] = record.reefOppositionRows[0], pop = record.populations[pi];
    assert.equal(pop.speciesId, CATHEDRAL);
    fixture = { world, map, record, pi, ordinal, point, populationId: pop.populationId, cathedralId: `natural-group:${pop.populationId}:${ordinal}` };
  }
  return fixture;
}
test('generated reef opposition preserves original membership, reef resources and the unmarked archive', () => {
  const { map, record, pi, ordinal, point, cathedralId } = generated();
  const old = S.generate(record.seed, map, { reefOpposition: false }), before = JSON.stringify(old);
  assert.equal(old.reefOppositionRows, undefined);
  assert.equal(S.validate(old, map), old);
  assert.equal(JSON.stringify(old), before);
  assert.deepEqual(record.patchRows, old.patchRows);
  assert.deepEqual(record.populations, old.populations);
  assert.deepEqual(record.shoreReefOrigins, old.shoreReefOrigins);
  assert.deepEqual(record.backgroundWildlife, old.backgroundWildlife);
  assert.deepEqual(record.physicalBinding.transfers, old.physicalBinding.transfers);
  assert.deepEqual(record.physicalBinding.capacities, old.physicalBinding.capacities);
  assert.equal(record.groupRows.length, old.groupRows.length);
  const moved = record.groupRows.flatMap((row, i) => row[2] !== old.groupRows[i][2] ? [row.slice(0, 2)] : []);
  assert.deepEqual(moved, [[pi, ordinal]]);
  assert.deepEqual(record.groupRows.map(([p, i, , a, j]) => [p, i, a, j]), old.groupRows.map(([p, i, , a, j]) => [p, i, a, j]));
  const source = S.expand(record, map), r = source.regions.find(r => r.id === point.regionId);
  const oldRegion = S.expand(old, map).regions.find(r => r.id === point.regionId);
  assert.equal(r.stocks.planktonKg, oldRegion.stocks.planktonKg);
  assert.equal(r.stocks.livingReefKg, oldRegion.stocks.livingReefKg);
  assert.deepEqual(r.seasons, oldRegion.seasons);
  assert.equal(r.stocks.seawaterL + (r.stocks.atmosphericWaterL || 0), oldRegion.stocks.seawaterL + (oldRegion.stocks.atmosphericWaterL || 0));
  const cat = source.groups.find(g => g.id === cathedralId);
  assert.equal(cat.regionId, r.id);
  const idx = r.source.cellIndex, mask = Buffer.from(S.populationsFor(map)[pi].territory.rangeMask, 'base64');
  assert.ok(mask[idx >> 3] & (1 << (idx & 7)));
  assert.deepEqual(r.ecology.workSites.find(s => s.id === cat.ecology.siteId).position, point);
  assert.deepEqual(cat.home, { patchId: r.id, cellId: r.cellId, eastKm: point.eastM / 1000, northKm: point.northM / 1000, depthM: -point.altitudeM });
  const coast = Foreign.coastReference(map, idx, r.areaHa), body = B.profiles[CATHEDRAL];
  for (const x of [0, body.lengthM]) for (const y of [0, body.widthM])
    assert.ok(Foreign.relative(coast, point.eastM + x, point.northM + y)[0] >= 0);
  assert.ok(r.depthM >= body.minWaterDepthM && r.depthM >= -point.altitudeM);

  const forged = structuredClone(record);
  forged.reefOppositionRows[0][2].northM++;
  forged.id = ''; forged.id = `beast-habitat-source:${World.stableHash(forged)}`;
  assert.throws(() => S.validate(forged, map), /physical accounts/);
});

test('generated reef opposition wounds a real tower and reduces later paid filtration only in reach', t => {
  const { world, map, record, point, populationId, cathedralId } = generated();
  const binding = { worldId: world.id, runId: 'reef-region-replay' };
  function build(far = false) {
    const source = S.expand(record, map), r = source.regions.find(r => r.id === point.regionId);
    r.edges = []; // Same generated residents and resources, no migration in this short replay.
    const groups = source.groups.filter(g => g.regionId === r.id);
    if (far) {
      // Shift only the Cathedral and its workface/nursery along the same
      // mapped water corridor; all depth, supply and spend rules stay intact.
      const cat = groups.find(g => g.id === cathedralId), coast = Foreign.coastReference(map, r.source.cellIndex, r.areaHa);
      const d = Foreign.offset({ eastM: 0, northM: 0, axis: coast.axis }, 0, 256);
      cat.home.eastKm += d.eastM / 1000; cat.home.northKm += d.northM / 1000;
      for (const p of [r.ecology.workSites.find(s => s.id === cat.ecology.siteId).position, r.nurseries.find(n => n.id === cat.breeding.siteId)?.position]) if (p) {
        p.eastM += d.eastM; p.northM += d.northM;
      }
    }
    return P.createDiagnostic({ ...source, regions: [r], groups }, binding);
  }
  const near = build(), far = build(true), r = near.regions[0], control = far.regions[0];
  const cat = s => s.groups.find(g => g.id === cathedralId).cohorts[0];
  const advance = (s, at) => assert.ok(P.advance(s, at, true, true));
  assert.deepEqual(r.stocks, control.stocks);
  assert.deepEqual(cat(near), cat(far));
  let contact;
  for (let day = 1; day <= 10 && !contact; day++) {
    advance(near, day * DAY); advance(far, day * DAY);
    contact = near.foodWeb.pending.find(q => q.reefTower);
  }
  assert.ok(contact, 'ordinary elapsed feeding and sensing should create a contact');
  assert.equal(near.groups.find(g => g.id === contact.members[0].groupId).speciesId, WYRM);
  assert.equal(contact.members[1].groupId, cathedralId);
  assert.ok(r.contactHarms.some(h => h.groupId === cathedralId && h.resource === 'planktonKg'));
  assert.ok(r.ecologicalAccount.destruction.renewableBiomass > 0);
  assert.deepEqual(cat(near).feedingTowers, [100, 100, 100, 100], 'an announced bite has applied no damage');
  assert.equal(far.foodWeb.pending.length, 0);
  const restored = P.normalize(JSON.parse(JSON.stringify(near)), binding);
  assert.ok(restored);
  const continued = P.rebind(restored, binding, { worldId: binding.worldId, runId: 'continued-reef' });
  for (const s of [near, far, continued]) advance(s, contact.dueAt);
  const hit = near.foodWeb.events.find(e => e.id === contact.id);
  assert.equal(hit.outcome, 'feedingTowerWounded');
  const target = Number(hit.tower.at(-1)) - 1;
  cat(near).feedingTowers.forEach((v, i) => i === target ? assert.ok(v < 100 && v > 0) : assert.equal(v, 100));
  assert.deepEqual(cat(near).feedingTowers, cat(continued).feedingTowers);
  assert.deepEqual(cat(far).feedingTowers, [100, 100, 100, 100]);

  // Integrate the same supplied intake term that actually debits this
  // Cathedral's plankton during each upcoming regional rate interval.
  function measure(s) {
    const to = contact.dueAt + DAY / 2, here = s.regions[0];
    let kg = 0;
    while (s.clock < to) {
      const end = Math.min(to, s.nextEventAt), c = cat(s);
      assert.ok(end > s.clock);
      kg += c.needs.foodKg * c.intake.foodKg * s.rates[here.id].supply.planktonKg * (end - s.clock) / DAY;
      advance(s, end);
    }
    return kg;
  }
  const injuredKg = measure(near), intactKg = measure(far);
  assert.ok(intactKg > injuredKg && injuredKg > 0);
  assert.equal(measure(continued), injuredKg);
  assert.ok(r.stocks.planktonKg > control.stocks.planktonKg);
  assert.ok(r.ecologicalAccount.destruction.renewableBiomass < control.ecologicalAccount.destruction.renewableBiomass);
  assert.ok(r.ecologicalAccount.nurturing.wetlandReefHabitat < control.ecologicalAccount.nurturing.wetlandReefHabitat);
  assert.equal(far.foodWeb.events.some(e => e.kind === 'defense'), false);
  assert.deepEqual(continued.regions, near.regions);
  for (const s of [near, far, continued]) {
    assert.ok(P.normalize(s));
    const g = s.groups.find(g => g.id === cathedralId), here = s.regions[0];
    assert.equal(F.position(g, here, cat(s), cat(s).ranges[0][0]).regionId, r.id);
    assert.ok(P.audit(s)[populationId].background === 1);
  }
  t.diagnostic(JSON.stringify({ region: r.id, firstStrikeDay: hit.at / DAY, tower: hit.tower, towerHealthLost: hit.towerHealthLost,
    injuredKg, intactKg, shelterWithStrike: r.ecologicalAccount.nurturing.wetlandReefHabitat,
    shelterWithoutStrike: control.ecologicalAccount.nurturing.wetlandReefHabitat }));
});
