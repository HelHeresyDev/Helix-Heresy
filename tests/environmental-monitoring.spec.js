// @ts-check
const { test, expect } = require('@playwright/test');
const Monitoring = require('../environmental-monitoring.js');
const SurfaceExposure = require('../surface-exposure.js');

function context(distanceBand = 'cityDistrict', outletKind = 'roadDrain') {
  return {
    digest: `context-${distanceBand}-${outletKind}`,
    location: { distanceBand },
    drainage: { outletKind }
  };
}

function exposureRecord(overrides = {}) {
  return {
    id: 'surface-exposure-1', label: 'Catalyst residue', substanceId: 'catalystResidue',
    source: { kind: 'physicalStack', id: 'spill-1', label: 'Catalyst spill' },
    cell: { x: 4, y: 7, z: 0 }, roomId: 'surfaceLoadingBay', terrainId: 'paved',
    tags: ['chemical', 'hazardous', 'soluble'], odorIndex: 24,
    receiver: { kind: 'roadDrain', label: 'property road drain', watershedId: 'watershed-1' },
    media: { surface: 4, subsurface: 1.2, drainage: 2.5, airborne: 0.6, offsite: 3, transformed: 0, removed: 0 },
    ...overrides
  };
}

function exposureState(record = exposureRecord(), outletKind = 'roadDrain') {
  return { drainage: { outletKind }, records: [record] };
}

test('monitoring sources depend on the saved public setting and drainage receiver', () => {
  const urban = Monitoring.sourceProfile(context('cityDistrict', 'roadDrain'), 'surface');
  const remote = Monitoring.sourceProfile(context('remoteWilderness', 'groundSwale'), 'surface');
  const roadDrain = Monitoring.sourceProfile(context('cityDistrict', 'roadDrain'), 'drainage');
  const groundSwale = Monitoring.sourceProfile(context('remoteWilderness', 'groundSwale'), 'drainage');

  expect(urban.sourceId).toBe('nearby-observer');
  expect(urban.detectionBase).toBeGreaterThan(remote.detectionBase);
  expect(roadDrain).toMatchObject({ sourceId: 'environmental-monitor', reliability: 'strong', specificity: 'siteLinked' });
  expect(roadDrain.detectionBase).toBeGreaterThan(groundSwale.detectionBase);
});

test('a scan creates saved qualitative milestones once and does not reroll them', () => {
  const site = context();
  const first = Monitoring.scan(Monitoring.defaultState(site), exposureState(), site, 300);
  expect(first.created.map((entry) => entry.mediumId).sort()).toEqual(['airborne', 'drainage', 'odor', 'offsite', 'surface']);
  expect(first.created.every((entry) => entry.detectionChance > 0 && entry.detectionChance <= 0.96)).toBe(true);
  expect(first.created.every((entry) => !('amount' in entry))).toBe(true);

  const repeated = Monitoring.scan(first.state, exposureState(), site, 3600);
  expect(repeated.created).toEqual([]);
  expect(repeated.state.milestones).toEqual(first.state.milestones);

  const saved = JSON.parse(JSON.stringify(repeated.state));
  expect(Monitoring.normalizeState(saved, site)).toEqual(repeated.state);
});

test('only a newly reached higher band creates a later opportunity', () => {
  const site = context('protectedApproaches', 'drainageDitch');
  const trace = exposureRecord({ odorIndex: 0, media: { surface: 0.7, subsurface: 0, drainage: 0, airborne: 0, offsite: 0, transformed: 0, removed: 0 } });
  const first = Monitoring.scan(Monitoring.defaultState(site), exposureState(trace, 'drainageDitch'), site, 300);
  expect(first.created).toHaveLength(1);
  expect(first.created[0]).toMatchObject({ mediumId: 'surface', band: 'trace' });

  const larger = { ...trace, media: { ...trace.media, surface: 9 } };
  const second = Monitoring.scan(first.state, exposureState(larger, 'drainageDitch'), site, 900);
  expect(second.created).toHaveLength(1);
  expect(second.created[0]).toMatchObject({ mediumId: 'surface', band: 'moderate' });
});

test('hidden monitoring and reports do not appear in the player projection', () => {
  const site = context();
  const first = Monitoring.scan(Monitoring.defaultState(site), exposureState(), site, 300);
  const milestone = first.state.milestones[0];
  let updated = Monitoring.updateMilestone(first.state, milestone.id, {
    externalExposureId: 'external-exposure-1', reportId: 'witness-report-1', outcome: 'reported', knowledge: 'hidden'
  }, site).state;
  expect(Monitoring.knownProjection(updated, site)).toEqual({
    disclosed: [], summary: 'No external environmental observation has been disclosed or reasonably inferred'
  });

  updated = Monitoring.updateMilestone(updated, milestone.id, { knowledge: 'inferred' }, site).state;
  updated = Monitoring.syncExternal(updated, [{ id: 'external-exposure-1', observed: true, reportId: 'witness-report-1', knowledge: 'hidden' }], [{ id: 'witness-report-1', knowledge: 'hidden' }], site);
  const known = Monitoring.knownProjection(updated, site);
  expect(known.disclosed).toHaveLength(1);
  expect(known.disclosed[0]).toMatchObject({ knowledge: 'inferred', sourceLabel: 'Possible external observation' });
  expect(JSON.stringify(known)).not.toContain('catalystResidue');
});

test('a field sample freezes one medium at collection time', () => {
  const record = exposureRecord();
  const captured = Monitoring.captureSample(record, 'soilCore', 500);
  record.media.subsurface = 99;
  record.substanceId = 'differentMaterial';

  const result = Monitoring.assaySample(captured, 90);
  expect(captured).toMatchObject({ mediumId: 'subsurface', amount: 1.2, substanceId: 'catalystResidue', collectedAt: 500 });
  expect(result).toMatchObject({ detected: true, identity: 'substance', burden: 'trace', substanceId: 'catalystResidue', knowledgeKey: 'subsurfaceKnown' });
});

test('low-confidence assays reveal presence without fabricating identity or exact burden', () => {
  const captured = Monitoring.captureSample(exposureRecord(), 'runoffSample', 700);
  const result = Monitoring.assaySample(captured, 20);
  expect(result).toMatchObject({ detected: true, identity: 'indeterminate', burden: 'presenceOnly', substanceId: '' });
});

test('saved surface projections describe historical samples without exposing current hidden media', () => {
  const localContext = {
    digest: 'surface-sample-context', calendar: { startOffsetDays: 20 },
    location: { distanceBand: 'cityDistrict', latitude: 30 },
    environment: { meanTemperatureC: 14, seasonalRangeC: 12, precipitationMm: 800, windBearingDeg: 90, windStrengthPercent: 30 },
    localVariation: { parcelTemperatureOffsetC: 0, drainageIndex: 500 }, water: { surfaceWaterNearby: false }
  };
  let state = SurfaceExposure.createState(localContext, 'sample-seed', 0);
  state = SurfaceExposure.registerRelease(state, localContext, {
    seed: 'sample-seed', clock: 0, source: { kind: 'spill', id: 'spill-1', label: 'Known spill' },
    label: 'Known spill', substanceId: 'knownSpill', amount: 4, medium: 'surface', phase: 'liquid', tags: ['soluble'],
    cell: { x: 2, y: 3, z: 0 }, roomId: 'surfaceLoadingBay', terrainId: 'soil', knowledge: { surfaceKnown: true }
  }).state;
  const record = state.records[0];
  state = SurfaceExposure.recordSampleObservation(state, localContext, record.id, {
    mediumId: 'subsurface', methodId: 'soilCore', sampledAt: 100, analyzedAt: 200,
    detected: true, band: 'trace', confidence: 'strong'
  }, 'sample-seed', 200);
  state.records[0].media.subsurface = 25;

  const projection = SurfaceExposure.knownProjection(state, 200).records[0];
  expect(projection.subsurfaceStatus).toContain('trace in saved shallow core');
  expect(projection.subsurfaceStatus).toContain('broader subsurface remains unknown');
  expect(projection.subsurfaceStatus).not.toContain('25');
});
