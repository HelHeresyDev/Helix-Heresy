// @ts-check
const { test, expect } = require('@playwright/test');
const SurfaceExposure = require('../surface-exposure');

function siteContext(overrides = {}) {
  return {
    digest: 'site-context-fixture',
    calendar: { startOffsetDays: 34 },
    location: { latitude: 42, distanceBand: 'corridorFringe', elevationM: 220 },
    environment: {
      meanTemperatureC: 12,
      seasonalRangeC: 18,
      precipitationMm: 850,
      windBearingDeg: 240,
      windStrengthPercent: 32,
      watershedId: 'watershed-test'
    },
    localVariation: { parcelTemperatureOffsetC: 1.2, drainageIndex: 610 },
    water: { surfaceWaterNearby: true },
    ...overrides
  };
}

test('saved ordinary weather is deterministic per run and modifies ambient conditions', () => {
  const context = siteContext();
  const first = SurfaceExposure.createState(context, 'run-alpha', 0);
  const replay = SurfaceExposure.createState(context, 'run-alpha', 0);
  const otherRun = SurfaceExposure.createState(context, 'run-beta', 0);

  expect(first.weatherDays).toEqual(replay.weatherDays);
  expect(first.weatherDays.map((day) => day.digest)).not.toEqual(otherRun.weatherDays.map((day) => day.digest));
  const weather = SurfaceExposure.weatherAt(first, 0);
  const ambient = SurfaceExposure.applyWeatherAmbient({ temperatureC: 10, humidity: 40, manaDensity: 20 }, weather);
  expect(ambient.weather.digest).toBe(weather.digest);
  expect(ambient.temperatureC).toBeCloseTo(10 + weather.temperatureOffsetC, 5);
  expect(ambient.humidity).toBeCloseTo(Math.max(0, Math.min(100, 40 + weather.humidityBonus)), 5);
});

test('rain and terrain move exposed physical material while conserving provenance mass', () => {
  const context = siteContext();
  const initial = SurfaceExposure.createState(context, 'rain-run', 0);
  const result = SurfaceExposure.advance(initial, context, {
    seed: 'rain-run',
    fromClock: 0,
    toClock: 6 * SurfaceExposure.SECONDS_PER_HOUR,
    weatherOverride: { kind: 'rain', label: 'Rain', precipitationMm: 24, windStrengthPercent: 45, temperatureOffsetC: -2, digest: 'forced-rain' },
    spills: [{
      stackId: 'spill-1', label: 'Soluble test residue', substanceId: 'testResidue', amount: 10,
      phase: 'liquid', tags: ['soluble', 'hazardous'], cell: { x: 4, y: 5, z: 1 },
      terrainId: 'grass', exposureKind: 'outdoor', openSky: true
    }]
  });

  expect(result.effects.stackLosses['spill-1']).toBeGreaterThan(0);
  const record = result.state.records[0];
  expect(record.media.subsurface + record.media.drainage + record.media.offsite).toBeGreaterThan(0);
  expect(Math.abs(SurfaceExposure.recordConservation(record).difference)).toBeLessThanOrEqual(0.002);
  const known = SurfaceExposure.knownProjection(result.state, result.state.lastAdvancedAt).records[0];
  expect(known.subsurfaceStatus).toContain('unsampled');
  expect(known).not.toHaveProperty('media');
  expect(known).not.toHaveProperty('subsurfaceAmount');
  expect(result.state.drainage.exactAquiferQualityKnown).toBe(false);

  const hidden = SurfaceExposure.advance(SurfaceExposure.createState(context, 'hidden-run', 0), context, {
    seed: 'hidden-run', fromClock: 0, toClock: 6 * SurfaceExposure.SECONDS_PER_HOUR,
    weatherOverride: { kind: 'rain', label: 'Rain', precipitationMm: 24, windStrengthPercent: 45, temperatureOffsetC: -2, digest: 'hidden-rain' },
    spills: [{
      stackId: 'hidden-spill', label: 'Unobserved residue', substanceId: 'hiddenResidue', amount: 10,
      phase: 'liquid', tags: ['soluble'], knowledge: { surfaceKnown: false }, cell: { x: 9, y: 9, z: 1 },
      terrainId: 'grass', exposureKind: 'outdoor', openSky: true
    }]
  });
  expect(hidden.state.records.length).toBe(1);
  expect(SurfaceExposure.knownProjection(hidden.state, hidden.state.lastAdvancedAt).records).toEqual([]);
});

test('five-second simulation cadences accumulate fate without duplicating indivisible spill units', () => {
  const context = siteContext();
  let state = SurfaceExposure.createState(context, 'cadence-run', 0);
  let remaining = 100;
  const weather = { kind: 'rain', label: 'Rain', precipitationMm: 24, windStrengthPercent: 45, temperatureOffsetC: -2, digest: 'cadence-rain' };
  for (let step = 0; step < 720; step += 1) {
    const fromClock = step * 5;
    const result = SurfaceExposure.advance(state, context, {
      seed: 'cadence-run', fromClock, toClock: fromClock + 5, weatherOverride: weather,
      spills: [{
        stackId: 'cadence-spill', label: 'Cadence residue', substanceId: 'cadenceResidue', amount: remaining,
        phase: 'liquid', tags: ['soluble'], cell: { x: 6, y: 6, z: 1 }, terrainId: 'grass', exposureKind: 'outdoor', openSky: true
      }]
    });
    const loss = result.effects.stackLosses['cadence-spill'] || 0;
    expect(Number.isInteger(loss)).toBe(true);
    remaining -= loss;
    state = result.state;
  }
  const record = state.records[0];
  expect(remaining).toBeLessThan(100);
  expect(record.releasedAmount).toBe(100 - remaining);
  expect(Math.abs(SurfaceExposure.recordConservation(record).difference)).toBeLessThanOrEqual(0.002);
  const oneShot = SurfaceExposure.advance(SurfaceExposure.createState(context, 'cadence-run', 0), context, {
    seed: 'cadence-run', fromClock: 0, toClock: SurfaceExposure.SECONDS_PER_HOUR, weatherOverride: weather,
    spills: [{
      stackId: 'cadence-spill', label: 'Cadence residue', substanceId: 'cadenceResidue', amount: 100,
      phase: 'liquid', tags: ['soluble'], cell: { x: 6, y: 6, z: 1 }, terrainId: 'grass', exposureKind: 'outdoor', openSky: true
    }]
  });
  expect(oneShot.state.records[0].releasedAmount).toBe(record.releasedAmount);
  for (const medium of SurfaceExposure.MEDIA_KEYS) expect(oneShot.state.records[0].media[medium]).toBeCloseTo(record.media[medium], 4);
});

test('utility releases enter explicit air or drainage media and preserve their receiver', () => {
  const context = siteContext();
  let state = SurfaceExposure.createState(context, 'utility-run', 0);
  state = SurfaceExposure.registerRelease(state, context, {
    seed: 'utility-run', clock: 30, coalesceKey: 'vent:test', source: { kind: 'utilityDischarge', id: 'vent-1', label: 'Exterior vent' },
    label: 'Process vapor', substanceId: 'processVapor', amount: 3, medium: 'airborne', phase: 'vapor', tags: ['volatile'],
    cell: { x: 2, y: 2, z: 1 }, terrainId: 'paved', exposureKind: 'outdoor', openSky: true
  }).state;
  state = SurfaceExposure.registerRelease(state, context, {
    seed: 'utility-run', clock: 60, coalesceKey: 'drain:test', source: { kind: 'utilityDischarge', id: 'drain-1', label: 'Exterior outfall' },
    label: 'Process effluent', substanceId: 'processEffluent', amount: 4, medium: 'drainage', phase: 'liquid', tags: ['soluble'],
    cell: { x: 3, y: 2, z: 1 }, terrainId: 'gravel', exposureKind: 'outdoor', openSky: true
  }).state;

  const vent = state.records.find((record) => record.coalesceKey === 'vent:test');
  expect(vent.media.airborne).toBe(3);
  expect(vent.receiver.kind).toBe('downwindAir');
  const drain = state.records.find((record) => record.coalesceKey === 'drain:test');
  expect(drain.media.drainage).toBe(4);
  expect(drain.receiver.watershedId).toBe('watershed-test');
  const projection = SurfaceExposure.knownProjection(state, 60);
  expect(projection.records.find((record) => record.id === drain.id).runoffStatus).toContain('observed drainage');
  expect(projection.records.find((record) => record.id === vent.id).remediationAvailable).toBe(false);
  expect(projection.records.find((record) => record.id === drain.id).remediationAvailable).toBe(false);
});

test('remediation captures bounded successor waste without deleting remaining contamination', () => {
  const context = siteContext();
  let state = SurfaceExposure.createState(context, 'cleanup-run', 0);
  state = SurfaceExposure.registerRelease(state, context, {
    seed: 'cleanup-run', clock: 0, coalesceKey: 'spill:cleanup', source: { kind: 'physicalStack', id: 'spill-cleanup', label: 'Chemical spill' },
    label: 'Chemical spill', substanceId: 'chemicalSludge', amount: 10, medium: 'surface', phase: 'sludge', tags: ['chemical', 'sticky'],
    cell: { x: 7, y: 8, z: 1 }, terrainId: 'paved', exposureKind: 'outdoor', openSky: true
  }).state;
  const before = SurfaceExposure.activeMediaTotal(state.records[0]);
  const result = SurfaceExposure.remediate(state, context, state.records[0].id, { seed: 'cleanup-run', clock: 100, maxAmount: 2 });

  expect(result.plan.id).toBe('neutralize');
  expect(result.removedAmount).toBeGreaterThan(0);
  expect(result.removedAmount).toBeLessThanOrEqual(2);
  expect(result.record.media.removed).toBe(result.removedAmount);
  expect(SurfaceExposure.activeMediaTotal(result.record)).toBeLessThan(before);
  expect(Math.abs(SurfaceExposure.recordConservation(result.record).difference)).toBeLessThanOrEqual(0.002);
});

test('surface exposure state survives JSON save and normalization without rerolling', () => {
  const context = siteContext();
  let state = SurfaceExposure.createState(context, 'save-run', SurfaceExposure.SECONDS_PER_DAY * 2);
  state = SurfaceExposure.registerRelease(state, context, {
    seed: 'save-run', clock: 200, coalesceKey: 'saved:release', source: { kind: 'release', id: 'saved', label: 'Saved release' },
    label: 'Saved residue', substanceId: 'savedResidue', amount: 1.5, medium: 'surface', phase: 'powder', tags: ['hazardous'],
    cell: { x: 1, y: 1, z: 1 }, terrainId: 'soil', exposureKind: 'outdoor', openSky: true
  }).state;
  const restored = SurfaceExposure.normalizeState(JSON.parse(JSON.stringify(state)), context, 'different-seed-is-ignored', state.lastAdvancedAt);

  expect(restored.weatherSeed).toBe('save-run');
  expect(restored.weatherDays).toEqual(state.weatherDays);
  expect(restored.records).toEqual(state.records);
  expect(() => SurfaceExposure.validateState(restored)).not.toThrow();
});
