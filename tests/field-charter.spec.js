const { test, expect } = require('@playwright/test');
const F = require('../field-charter');
const binding = { worldId: 'world', runId: 'run' };
const map = { strategicPlayableSettlementState: { cityRows: [{ cityId: 'city', assetId: 'population', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
  cityGovernments: { governments: [{ cityId: 'city', roleAssignments: { publicWorksAndProvisioning: 'works' }, institutions: [{ id: 'works', name: 'Original public works', capacityBand: 'functional' }] }] } };
const context = { alive: true, capable: true, originalBody: true, atGround: true, near: true, sourceCurrent: true, busy: false,
  escortId: 'escort', contractId: 'original-contract', escortWilling: true, escortCapable: true, escortSeconds: 14400, bodyEpoch: 1,
  route: { id: 'route', distanceKm: 2.25 }, stop: { id: 'original-site', routeId: 'route', positionKm: 1 }, collectionKm: 2,
  routeOpen: true, manifest: [{ id: 'original-tool', key: 'surveyKit', quantity: 1, carriedBy: 'scientist', kg: 2, l: 3, reserved: false }] };
const clone = x => JSON.parse(JSON.stringify(x));
function booked() { const s = F.create(map, 'city', binding, 0), c = clone(context), wallet = { money: 1000 };
  const q = F.review(s, c, 0); expect(F.accept(s, c, q, wallet, 1)).toBe(true); return { s, c, wallet, q }; }
function depart() { const x = booked(); F.advance(x.s, 401, x.c); expect(x.s.phase).toBe('boarding');
  expect(F.board(x.s, 'escort', x.c)).toBe(true); expect(F.board(x.s, 'scientist', x.c)).toBe(true);
  expect(F.launch(x.s, x.c, 402)).toBe(true); return x; }
test('allocation requires actual surviving municipal population and functioning transport/works; world stays unchanged', () => {
  const before = clone(map), s = F.create(map, 'city', binding, 0);
  expect(s.vehicle.passengerSeats).toBe(2); expect(s.source.people).toBe(1); expect(map).toEqual(before);
  expect(F.create({}, 'city', binding, 0)).toBeNull();
  const missingRole = clone(map); delete missingRole.cityGovernments.governments[0].roleAssignments; expect(F.create(missingRole, 'city', binding, 0)).toBeNull();
  const ruined = clone(map); ruined.strategicPlayableSettlementState.cityRows[0].physicalCondition = 'ruined'; expect(F.create(ruined, 'city', binding, 0)).toBeNull();
});
test('exact party, route, physical cargo, capacity and consent bind a single paid assignment', () => {
  const { s, c, wallet, q } = booked(); expect(wallet.money).toBe(1000 - q.fee);
  expect(F.accept(s, c, q, wallet, 2)).toBe(false); expect(wallet.money).toBe(1000 - q.fee);
  for (const override of [{ near: false }, { escortWilling: false }, { stop: null }, { sourceCurrent: false }, { manifest: [{ ...context.manifest[0], quantity: 999 }] }]) {
    const fresh = F.create(map, 'city', binding, 0); expect(F.review(fresh, { ...context, ...override }, 0)).toBeNull();
  }
});
test('changed cargo/body or expired exact quote cannot charge or launch; no borrowed seat', () => {
  const s = F.create(map, 'city', binding, 0), q = F.review(s, context, 0), wallet = { money: 1000 };
  expect(F.accept(s, { ...context, bodyEpoch: 2 }, q, wallet, 1)).toBe(false);
  expect(F.accept(s, context, q, wallet, 60)).toBe(false); expect(wallet.money).toBe(1000);
  const x = booked(); F.advance(x.s, 401, x.c); F.board(x.s, 'scientist', x.c);
  expect(F.board(x.s, 'invented replacement', x.c)).toBe(false); expect(F.launch(x.s, x.c, 402)).toBe(false);
  F.board(x.s, 'escort', x.c); expect(F.launch(x.s, { ...x.c, manifest: [] }, 402)).toBe(false);
});
test('actual collection, outbound travel and fuel/wear/duty persist identically through save chunking', () => {
  const { s, c } = depart(), whole = clone(s); F.advance(whole, 500, c);
  let split = clone(s); for (let at = 403; at <= 500; at++) { split = F.normalize(split); F.advance(split, at, c); }
  expect(split).toEqual(whole); expect(split.positionKm).toBeLessThan(s.positionKm); expect(split.vehicle.fuelKm).toBeLessThan(s.vehicle.fuelKm);
  expect(split.dutySeconds).toBeLessThan(s.dutySeconds); expect(split.vehicle.condition).toBeLessThan(s.vehicle.condition);
});
test('same known ground is reached without a walking accomplishment or generated destination', () => {
  const { s, c } = depart(); F.advance(s, 1000, c); expect(s.phase).toBe('onsite'); expect(s.positionKm).toBe(c.stop.positionKm);
  expect(s.booking.stopId).toBe('original-site'); expect(s.history).toEqual([]);
});
test('regional contact stops at actual saved encounter distance, without overshoot or damage roll', () => {
  const { s, c } = depart(); F.advance(s, 1000, { ...c, interruptPositions: [1.4, 1.8] });
  expect(s.phase).toBe('stranded'); expect(s.positionKm).toBe(1.8); expect(s.driver.health).toBe(100);
});
test('route loss, original incapacitation and finite fuel preserve the last real position and possessions', () => {
  for (const failure of ['route', 'driver', 'fuel', 'escort']) {
    const { s, c } = depart(), before = clone(s.booking.manifest);
    if (failure === 'driver') s.driver.health = 5; if (failure === 'fuel') s.vehicle.fuelKm = 0;
    const km = s.positionKm; F.advance(s, 410, { ...c, routeOpen: failure !== 'route', escortCapable: failure !== 'escort' });
    expect(s.phase).toBe('stranded'); expect(s.positionKm).toBe(km); expect(s.booking.manifest).toEqual(before);
    expect(s.boarded).toEqual(['escort', 'scientist']);
  }
});
test('return can preserve a physically separated person; capacity still applies, no replacement or rescue', () => {
  const { s, c } = depart(); F.advance(s, 1000, c); s.boarded = ['scientist'];
  expect(F.launch(s, c, 1001, true)).toBe(true); F.advance(s, 1400, c);
  expect(s.phase).toBe('unloading'); expect(s.positionKm).toBe(c.route.distanceKm); expect(s.boarded).toEqual(['scientist']);
});
test('independent withdrawal stops outward travel at the actual location but does not forbid a capable physical return', () => {
  const { s, c } = depart(), km = s.positionKm; F.advance(s, 410, { ...c, escortWilling: false });
  expect(s.phase).toBe('stranded'); expect(s.positionKm).toBe(km);
  expect(F.launch(s, { ...c, escortWilling: false, sourceCurrent: false }, 411, true)).toBe(true);
});
test('cancellation spends dispatched fare, fuel and actual return; no teleport or replenishment', () => {
  const { s, c, wallet, q } = booked(); F.advance(s, 30, c); const fuel = s.vehicle.fuelKm;
  expect(F.cancel(s, 30)).toBe(true); expect(s.phase).toBe('collecting'); expect(s.vehicle.fuelKm).toBe(fuel); expect(wallet.money).toBe(1000 - q.fee);
  F.advance(s, 500, c); expect(s.phase).toBe('boarding');
});
test('death freezes all charter activity; continued imports rebind only the copy and fresh runs inherit nothing', () => {
  const { s, c } = depart(), before = clone(s); F.advance(s, 10000, { ...c, alive: false }); expect(s).toEqual(before);
  expect(F.rebind(s, binding, { worldId: 'copy', runId: 'copy-run' }).runId).toBe('copy-run'); expect(s).toEqual(before);
  expect(F.create(map, 'city', { ...binding, runId: 'new' }, 0).booking).toBeNull();
});
test('rebooking retains the same spent assets and clears only the previous itinerary, not resources', () => {
  const { s, c } = depart(); F.advance(s, 1000, c); s.phase = 'completed'; s.boarded = [];
  const before = clone(s.vehicle), driver = s.driver.id, duty = s.dutySeconds, wallet = { money: 1000 };
  const q = F.review(s, c, 1001); expect(q).toBeTruthy(); expect(F.accept(s, c, q, wallet, 1002)).toBe(true);
  expect(s.vehicle).toEqual(before); expect(s.driver.id).toBe(driver); expect(s.dutySeconds).toBe(duty);
  expect(s.departed).toBe(false); expect(s.fieldArrivedAt).toBeUndefined(); expect(s.booking.id).not.toBe('works:field-charter:1');
});
test('normalization rejects impossible passengers or route positions rather than inventing replacements', () => {
  const { s } = depart(); expect(F.normalize({ ...s, boarded: ['invented person'] })).toBeNull();
  expect(F.normalize({ ...s, positionKm: 999 })).toBeNull(); expect(F.normalize({ ...s, boarded: null })).toBeNull();
  expect(F.rebind(s, { ...binding, runId: 'wrong' }, { worldId: 'other', runId: 'other-run' })).toEqual(s);
});
