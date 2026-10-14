const { test, expect } = require('@playwright/test');
const Foreign = require('../foreign-survey-excursion');
const Carrier = require('../municipal-carrier');
const Resources = require('../resource-surveys');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const map = { humanGeography: { cities: [{ id: 'b', name: 'Birch', cellId: 'planet-cell:00001' }] },
    strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', sovereigntyScope: 'cityOnly', charter: { id: 'charter:b' }, roleAssignments: { centralAdministration: 'admin:b', publicWorksAndProvisioning: 'works:b' },
      institutions: [{ id: 'admin:b', capacityBand: 'functional' }, { id: 'works:b', capacityBand: 'functional' }] }] } };
  const g = { cityId: 'b', institutionId: 'admin:b', clerk: { id: 'clerk:b', status: 'alive', health: 100, fatigue: 0 }, receptionWorkSeconds: 14400, powerSeconds: 86400 };
  const source = Foreign.sourceFromWorld(map, g), carrier = Carrier.fromWorld(map, 'b', 0);
  const context = { siteId: source.placeId, worldId: 'world', strategicCellId: source.cellId, seed: 'foreign-ground',
    truth: { potentialPermille: { ferrousOre: 700 }, typicalDepth: { ferrousOre: 'shallow' }, surfaceAccessibilityPermille: 500, environmentalDifficultyPermille: 10 } };
  const s = Foreign.create(g, source, carrier, context, 24);
  const c = { cityId: 'b', source: copy(source), authorityCurrent: true, alive: true, capable: true, originalBody: true, local: true, atDesk: true,
    clerkPresent: true, lineOfSight: true, otherBusy: false, excluded: false, custodyActive: false, bodyEpoch: 0, visitId: 'visit-b',
    atStand: true, atField: false, atFieldEntry: false, aboard: false, cargo: 2, kit: true, bottle: true, provisions: true, routeOpen: true };
  return { map, g, s, c, wallet: { money: 1000 } };
}
const act = (f, kind, expected = null, now = 0) => Foreign.action(f.g, f.s, f.c, now, kind, expected, f.wallet);
function permit(f) { expect(act(f, 'quote')).toBe(true); expect(act(f, 'accept', copy(f.s.quote))).toBe(true); }
function book(f) { permit(f); expect(act(f, 'book')).toBe(true); }
function field(f) { book(f); Foreign.advance(f.s, f.c, 120); expect(Foreign.board(f.s, f.c, 120)).toBe(true); f.c.aboard = true;
  Foreign.advance(f.s, f.c, 720); expect(Foreign.disembark(f.s, f.c, 720)).toBe(true); f.c.aboard = false; f.c.atDesk = false; f.c.atStand = false; f.c.atField = true; f.c.atFieldEntry = true; }
test('foreign municipal ground and carrier require real independent city sources and create no deposits or original world mutations', () => {
  const f = fixture(), before = copy(f.map); expect(f.s.source).toMatchObject({ worksId: 'works:b', populationSourceId: 'population:b' });
  expect(f.map).toEqual(before); expect(f.s.carrier.vehicle.fuelKm).toBe(200); expect(f.s.carrier.driver.id).toBe('works:b:survey-carrier:driver');
  expect(Foreign.create(f.g, f.s.source, { ...f.s.carrier, cityId: 'home' }, f.s.context, 24)).toBeNull();
  for (const change of [m => m.cityGovernments.governments[0].sovereigntyScope = 'jointStronghold', m => m.strategicPlayableSettlementState.cityRows[0].services.transport = 'failed',
    m => m.cityGovernments.governments[0].institutions[1].capacityBand = 'fragile', m => m.strategicCivicHistory = { currentInstitutionRows: [] },
    m => m.humanGeography.cities = []]) { const bad = copy(f.map); change(bad); expect(Foreign.sourceFromWorld(bad, f.g)).toBeNull(); }
});
test('sampling terms are separate exact body/visit permissions using only original shared reception work and power', () => {
  const f = fixture(); expect(act(f, 'book')).toBe(false); expect(act(f, 'quote')).toBe(true);
  const q = copy(f.s.quote); expect(act(f, 'accept', { ...q, scope: 'unrestricted' })).toBe(false); expect(f.s.permission).toBeNull();
  expect(act(f, 'accept', q)).toBe(true); expect(f.g.receptionWorkSeconds).toBe(14280); expect(f.g.powerSeconds).toBe(86280);
  expect(f.s.permission.endsAt).toBe(3 * 86400); expect(f.wallet.money).toBe(1000); expect(Foreign.permit(f.s, { ...f.c, bodyEpoch: 1 }, 1)).toBe(false);
  expect(Foreign.permit(f.s, { ...f.c, visitId: 'other' }, 1)).toBe(false);
});
test('no access or quote on custody, exclusion, source changes, absent original body/clerk or competing reception work', () => {
  for (const change of [f => f.c.atDesk = false, f => f.c.cityId = 'other', f => f.c.originalBody = false, f => f.c.custodyActive = true, f => f.c.excluded = true,
    f => f.c.source.worksId = 'other', f => f.g.clerk.id = 'replacement', f => f.g.receptionAssignment = 'visitor-review', f => f.g.powerSeconds = 59]) {
    const f = fixture(); change(f); expect(act(f, 'quote')).toBe(false); expect(f.s.permission).toBeNull();
  }
});
test('paid original local collection precedes boarding with real kit, sample bottle, provisions, fuel and cargo capacity', () => {
  const f = fixture(); book(f); expect(f.wallet.money).toBe(906); expect(f.s.phase).toBe('collecting'); expect(Foreign.board(f.s, f.c, 1)).toBe(false);
  Foreign.advance(f.s, f.c, 120); expect(f.s.phase).toBe('city'); expect(f.s.carrier.vehicle.fuelKm).toBeCloseTo(199.75);
  for (const patch of [{ kit: false }, { bottle: false }, { provisions: false }, { cargo: 25 }, { atStand: false }, { originalBody: false }])
    expect(Foreign.board(f.s, { ...f.c, ...patch }, 120)).toBe(false);
  expect(Foreign.board(f.s, f.c, 120)).toBe(true); expect(f.s.phase).toBe('outbound'); expect(Foreign.disembark(f.s, f.c, 120)).toBe(false);
});
test('moving original vehicle spends actual finite distance/fuel and holds same position through saved failures without backfill', () => {
  let f = fixture(); book(f); Foreign.advance(f.s, f.c, 60); expect(f.s.leg.progressKm).toBeCloseTo(.125);
  f.s.carrier.driver.health = 0; Foreign.advance(f.s, f.c, 1000); f = copy(f);
  expect(f.s.leg.progressKm).toBeCloseTo(.125); f.s.carrier.driver.health = 100;
  Foreign.advance(f.s, f.c, 2000); expect(f.s.leg.progressKm).toBeCloseTo(.125); Foreign.advance(f.s, f.c, 2060);
  expect(f.s.phase).toBe('city'); expect(f.s.carrier.vehicle.fuelKm).toBeCloseTo(199.75); expect(f.wallet.money).toBe(906);
  expect(f.s.carrier.driver.id).toBe('works:b:survey-carrier:driver');
});
test('surface-only findings bind the foreign site and sampled point without granting whole-cell deposits or extraction', () => {
  const f = fixture(); field(f); expect(Foreign.sampleReason(f.s, f.c, 721, 'surfaceSample')).toBe('');
  for (const method of ['shallowCore', 'arcaneSurvey', 'creatureCollection', 'construction']) expect(Foreign.sampleReason(f.s, f.c, 721, method)).toBeTruthy();
  const captured = Resources.capture(f.s.context, f.s.entry, 'surfaceSample', 721, 90, { id: 'real-kit' });
  const state = Resources.defaultState({ ...f.s.context, siteId: 'home' }); state.sites[f.s.context.siteId] = copy(f.s.context);
  const result = Resources.record(state, captured, { at: 800, score: 90 });
  expect(result.observation).toMatchObject({ siteId: 'foreign-survey:b', coverage: 'local sampling point; strategic cell remains unsurveyed' });
  expect(JSON.stringify(result.observation)).not.toMatch(/potentialPermille|recoverableYield|reserveTonnes/);
});
test('expired sampling rights stop work, not original prepaid physical return; unfit parked driver cannot trap a capable passenger inside', () => {
  const f = fixture(); field(f); f.s.permission.endsAt = 750;
  expect(Foreign.sampleReason(f.s, f.c, 751, 'surfaceSample')).toBeTruthy(); expect(Foreign.board(f.s, f.c, 751)).toBe(true); f.c.aboard = true;
  Foreign.advance(f.s, f.c, 1351); expect(f.s.phase).toBe('cityReturned'); f.s.carrier.driver.health = 0;
  expect(Foreign.disembark(f.s, f.c, 1351)).toBe(true); expect(f.s.phase).toBe('depotReturn');
  f.c.aboard = false; f.s.carrier.driver.health = 100; Foreign.advance(f.s, f.c, 1471);
  expect(f.s.phase).toBe('depot'); expect(f.s.carrier.vehicle.fuelKm).toBeCloseTo(195.5); expect(f.s.carrier.contract).toBeNull();
});
test('failed occupied return retains living stranded scientist, original cabin, finite fuel and paid trip rather than replacing or teleporting them', () => {
  const f = fixture(); field(f); Foreign.board(f.s, f.c, 720); f.c.aboard = true; Foreign.advance(f.s, f.c, 1020);
  const position = f.s.leg.progressKm, fuel = f.s.carrier.vehicle.fuelKm; f.c.routeOpen = false; Foreign.advance(f.s, f.c, 10000);
  expect(f.s.phase).toBe('inbound'); expect(f.s.leg.progressKm).toBe(position); expect(f.s.carrier.vehicle.fuelKm).toBe(fuel); expect(f.c.alive).toBe(true);
});
test('damage during an occupied leg stops at actual condition/endurance limits rather than completing a coarse update through failure', () => {
  const f = fixture(); field(f); Foreign.board(f.s, f.c, 720); f.c.aboard = true;
  f.s.carrier.vehicle.condition = 50.01; Foreign.advance(f.s, f.c, 1320);
  expect(f.s.phase).toBe('inbound'); expect(f.s.leg.progressKm).toBeCloseTo(.5); expect(f.s.carrier.vehicle.condition).toBeCloseTo(50);
  const position = f.s.leg.progressKm; Foreign.advance(f.s, f.c, 1920); expect(f.s.leg.progressKm).toBe(position);
});
test('dated observations remain unchanged away, while death freezes original work and vehicle resources', () => {
  const f = fixture(); field(f); const v = Foreign.observe(f.s, f.c, 721);
  f.c.atFieldEntry = false; Foreign.observe(f.s, f.c, 800); expect(f.s.observation).toEqual(v);
  Foreign.board(f.s, { ...f.c, atFieldEntry: true }, 800); const frozen = copy(f.s); f.c.alive = false;
  expect(Foreign.advance(f.s, f.c, 100000)).toBe(false); expect(f.s).toEqual(frozen);
});
