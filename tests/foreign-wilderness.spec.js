const { test, expect } = require('@playwright/test');
const Foreign = require('../foreign-wilderness');
const Discovery = require('../wilderness-discovery');
const Survival = require('../wilderness-survival');
const Beasts = require('../wilderness-beasts');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const excursion = { source: { placeId: 'foreign-survey:b', cellId: 'city-cell' }, context: { worldId: 'world' }, entry: { z: 23 }, roomId: 'foreign-ground',
    phase: 'field', trip: { bodyEpoch: 1, visitId: 'visit' }, permission: { endsAt: 1 } };
  const origin = { id: 'city-cell', neighborIds: ['wild-cell', 'ocean', 'city', 'steep'] };
  const candidates = [{ id: 'wild-cell', surfaceClass: 'land', slopePercent: 20, temperatureC: -10, precipitationMm: 1200 },
    { id: 'ocean', surfaceClass: 'ocean', slopePercent: 0, temperatureC: 20 },
    { id: 'city', surfaceClass: 'land', slopePercent: 0, temperatureC: 20 },
    { id: 'steep', surfaceClass: 'land', slopePercent: 31, temperatureC: 20 }];
  const contextFor = d => ({ worldId: 'world', siteId: d.id, strategicCellId: d.strategicCellId, truth: { potentialPermille: {} } });
  const sector = Foreign.create(excursion, origin, candidates, ['city'], contextFor);
  const c = { alive: true, capable: true, originalBody: true, custodyActive: false, otherBusy: false, atField: true, atWilderness: false, bodyEpoch: 1, visitId: 'visit' };
  return { excursion, origin, candidates, contextFor, sector, c };
}
test('foreign boundary uses only adjacent traversable unoccupied actual land and leaves its source unchanged', () => {
  const f = fixture(), before = copy(f);
  expect(f.sector.destination).toMatchObject({ strategicCellId: 'wild-cell', approachCellId: 'city-cell', temperatureC: -10, slopePercent: 20 });
  expect(f.sector.entry.z).toBe(23); expect(f.sector.materialized).toBe(false); expect(f.sector.discovery).toBeNull();
  Foreign.create(f.excursion, f.origin, f.candidates, ['city'], f.contextFor);
  expect(copy(f)).toEqual(before);
  expect(Foreign.create(f.excursion, f.origin, f.candidates, ['city', 'wild-cell'], f.contextFor)).toBeNull();
  expect(Foreign.create(f.excursion, { ...f.origin, id: 'other' }, f.candidates, [], f.contextFor)).toBeNull();
});
test('foreign boundary refuses invented cross-world or wrong-site resource contexts', () => {
  const f = fixture();
  for (const wrong of [{ worldId: 'other' }, { siteId: 'home' }, { strategicCellId: 'city-cell' }, { truth: null }])
    expect(Foreign.create(f.excursion, f.origin, f.candidates, ['city'], d => ({ ...f.contextFor(d), ...wrong }))).toBeNull();
});
test('under-equipped departure and expired municipal permission do not prevent voluntary wilderness entry', () => {
  const f = fixture();
  expect(Survival.warnings([]).length).toBeGreaterThan(0);
  expect(Foreign.entryReason(f.excursion, f.sector, f.c)).toBe('');
  for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { custodyActive: true }, { otherBusy: true }, { atField: false }, { bodyEpoch: 2 }, { visitId: 'other' }])
    expect(Foreign.entryReason(f.excursion, f.sector, { ...f.c, ...wrong })).not.toBe('');
  expect(Foreign.entryReason({ ...f.excursion, phase: 'outbound' }, f.sector, f.c)).not.toBe('');
});
test('wilderness sampling is original-body local work, not extended municipal permission or an extraction right', () => {
  const f = fixture(), c = { ...f.c, atField: false, atWilderness: true };
  for (const method of ['reconnaissance', 'surfaceSample', 'shallowCore', 'arcaneSurvey']) expect(Foreign.sampleReason(f.excursion, f.sector, c, method)).toBe('');
  for (const wrong of [{ atWilderness: false }, { originalBody: false }, { custodyActive: true }, { bodyEpoch: 2 }, { visitId: 'other' }, { alive: false }, { capable: false }])
    expect(Foreign.sampleReason(f.excursion, f.sector, { ...c, ...wrong }, 'surfaceSample')).not.toBe('');
  expect(Foreign.sampleReason(f.excursion, f.sector, c, 'extractOre')).not.toBe('');
});
test('foreign geography elaborates once in its own layer with connected withdrawal ground and dated observations only', () => {
  const { sector: s } = fixture(); s.discovery = Discovery.create(s.destination, 'foreign');
  expect(Discovery.publicView(s.discovery).records).toEqual([]);
  const baseline = Discovery.materialize(s.discovery, 'world', 'seed', s.destination, 10, null, s);
  expect(baseline.rocks.length).toBeGreaterThan(0); expect(baseline.cells.every(c => c.z === 23)).toBe(true);
  expect(Discovery.connected(baseline.cells, s.entry)).toBe(true);
  Discovery.observe(s.discovery, 11, s.entry, () => true, () => false);
  const view = Discovery.publicView(s.discovery); expect(view.records.length).toBeGreaterThan(0); expect(view.baseline).toBeUndefined();
  const saved = copy(s);
  expect(Discovery.materialize(saved.discovery, 'world', 'different', saved.destination, 500, null, saved)).toEqual(baseline);
  expect(Discovery.publicView(saved.discovery)).toEqual(view);
  expect(Discovery.materialize(Discovery.create(s.destination, 'foreign'), 'world', 'seed', s.destination, 10, null, s)).toEqual(baseline);
});
test('foreign encounters use supported actual populations only and saved identities without replenishment', () => {
  const { sector: s } = fixture(), d = Discovery.create(s.destination, 'foreign');
  const cells = Discovery.materialize(d, 'world', 'seed', s.destination, 0, null, s).cells;
  expect(Beasts.materialize('seed', s.destination.id, [], cells).actors).toEqual([]);
  expect(Beasts.materialize('seed', s.destination.id, [{ id: 'unsupported', speciesId: 'beast:colossus', populationIndex: 1000 }], cells).actors).toEqual([]);
  let beasts;
  for (let n = 0; n < 100; n++) { beasts = Beasts.materialize(`seed-${n}`, s.destination.id, [{ id: 'actual-population', speciesId: 'beast:rimefang-pack', populationIndex: 1000 }], cells); if (beasts.actors.length) break; }
  expect(beasts.actors.length).toBeGreaterThan(0); expect(beasts.actors.every(a => a.populationId === 'actual-population' && a.mapCell.z === 23)).toBe(true);
  beasts.actors[0].health = 0; beasts.actors[0].status = 'dead'; const saved = copy(beasts);
  expect(Beasts.normalizeState(saved).actors[0]).toEqual(beasts.actors[0]); expect(Beasts.publicKnowledge(saved).sightings).toEqual([]);
});
