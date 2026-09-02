const test = require('node:test');
const assert = require('node:assert/strict');
const PropertyPresentation = require('../property-presentation');

function options() {
  return {
    context: { location: { distanceBand: 'protectedApproaches' } },
    parcelRect: { x: 0, y: 0, z: 1, width: 8, height: 8 },
    access: {
      public: { boundaryCells: [{ x: 3, y: 7, z: 1 }], entranceCells: [{ x: 3, y: 3, z: 1 }] },
      freight: {
        boundaryCells: [{ x: 5, y: 7, z: 1 }, { x: 6, y: 7, z: 1 }, { x: 7, y: 7, z: 1 }],
        entranceCells: [{ x: 5, y: 3, z: 1 }, { x: 6, y: 3, z: 1 }, { x: 7, y: 3, z: 1 }]
      }
    },
    zones: {
      publicApproach: Array.from({ length: 5 }, (_entry, index) => ({ x: 3, y: 3 + index, z: 1 })),
      freightApproach: Array.from({ length: 5 }, (_entry, row) => [5, 6, 7].map((x) => ({ x, y: 3 + row, z: 1 }))).flat(),
      outdoorWork: [], outdoorStorage: [], wasteHolding: [], landscaping: []
    }
  };
}

test('saved public and three-wide freight approaches require continuous unobstructed physical routes', () => {
  const state = PropertyPresentation.defaultState(options());
  assert.equal(PropertyPresentation.routeStatus(state, 'public', [], options()).connected, true);
  assert.equal(PropertyPresentation.routeStatus(state, 'freight', [], options()).connected, true);
  const blocked = PropertyPresentation.routeStatus(state, 'freight', ['6,5,1'], options());
  assert.equal(blocked.connected, false);
  assert.match(blocked.reason, /interrupted|full entrance width/i);
});

test('zones remain authored intent and one family replaces itself per tile', () => {
  let state = PropertyPresentation.defaultState(options());
  state = PropertyPresentation.setZone(state, 'outdoorStorage', { x: 1, y: 1, z: 1 }, options());
  state = PropertyPresentation.setZone(state, 'wasteHolding', { x: 1, y: 1, z: 1 }, options());
  assert.deepEqual(PropertyPresentation.zonesAt(state, { x: 1, y: 1, z: 1 }, options()), ['wasteHolding']);
  assert.deepEqual(PropertyPresentation.zonesAt(PropertyPresentation.clearZone(state, { x: 1, y: 1, z: 1 }, options()), { x: 1, y: 1, z: 1 }, options()), []);
  const saved = JSON.parse(JSON.stringify(state));
  assert.deepEqual(PropertyPresentation.normalizeState(saved, options()).zones, state.zones);
});

test('sightlines are contextual and only opaque physical cells screen targets', () => {
  const state = PropertyPresentation.defaultState(options());
  const target = { x: 3, y: 1, z: 1 };
  const open = PropertyPresentation.sightlines(state, [target], [], options());
  assert.ok(open.visibleCellKeys.includes('3,1,1'));
  const screened = PropertyPresentation.sightlines(state, [target], ['3,4,1'], options());
  assert.ok(!screened.observers.find((observer) => observer.id === 'public-route').visibleCellKeys.includes('3,1,1'));
  assert.ok(state.observers.some((observer) => observer.id === 'route-patrol'));
});

test('weather wear is deterministic, saved by day, and idempotent', () => {
  const state = PropertyPresentation.defaultState(options());
  const fixtures = [{ id: 'sign-a', typeId: 'companySign', condition: 100 }];
  const weather = () => ({ label: 'Rain', precipitationMm: 10, windStrengthPercent: 40, temperatureOffsetC: -3 });
  const first = PropertyPresentation.advanceWeather(state, fixtures, weather, PropertyPresentation.SECONDS_PER_DAY * 3, options());
  assert.ok(first.damageByFixtureId['sign-a'] > 0);
  assert.equal(first.state.weatheredThroughDay, 3);
  const repeated = PropertyPresentation.advanceWeather(first.state, fixtures, weather, PropertyPresentation.SECONDS_PER_DAY * 3, options());
  assert.deepEqual(repeated.damageByFixtureId, {});
});

test('presentation scores actual sign, route, upkeep, land use, and proportionate screening', () => {
  const state = PropertyPresentation.defaultState(options());
  const sightlines = PropertyPresentation.sightlines(state, [{ x: 3, y: 6, z: 1 }], [], options());
  const result = PropertyPresentation.presentationAssessment(state, {
    fixtures: [
      { id: 'sign', typeId: 'companySign', origin: { x: 3, y: 6, z: 1 }, condition: 90 },
      { id: 'bed', typeId: 'landscapeBed', origin: { x: 2, y: 6, z: 1 }, condition: 80 }
    ],
    sightlines,
    blockedCellKeys: [],
    context: options().context,
    outdoorStacks: [],
    clock: 100
  }, options());
  assert.ok(result.score >= 50);
  assert.deepEqual(result.dimensions.map((dimension) => dimension.id), ['identification', 'approaches', 'upkeep', 'landUse', 'landscaping', 'security']);
  assert.equal(Object.hasOwn(result, 'evidence'), false);
});
