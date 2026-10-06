const { test, expect } = require('@playwright/test');
const Briefings = require('../carrier-briefings');
const Carrier = require('../municipal-carrier');
const Survey = require('../survey-expeditions');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const carrier = Carrier.fromWorld({
    strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', assetId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster Works', capacityBand: 'functional' }] }] }
  }, 'a', 0);
  Carrier.reserve(carrier, 2, 4, 2, 104, { money: 500 }, 0);
  Carrier.attach(carrier, { id: 'collection' }, 'collection');
  Carrier.advance(carrier, { id: 'collection', status: 'arrived' }, 2, 100);
  const ctx = { alive: true, capable: true, atVehicle: true, lineOfSight: true, busy: false, location: 'laboratory', cityId: 'a', bodyEpoch: 0,
    destination: { id: 'survey:a', label: 'Aster municipal ground', hiddenDeposit: 'secret' }, boardingPoint: 'Reception at 2,2', returnPoint: 'Survey rendezvous at 10,10' };
  return { carrier, ctx };
}
const begin = f => Briefings.begin(f.carrier, f.ctx, [], 100);

test('fare and a real present available driver are required without remote contact discovery', () => {
  for (const mode of ['booking', 'cancelled', 'travelling', 'absent', 'sight', 'scientist', 'driver', 'busy', 'foreign', 'terms']) {
    const f = fixture(), c = f.carrier;
    if (mode === 'booking') c.contract = null;
    if (mode === 'cancelled') c.contract.returnToBase = true;
    if (mode === 'travelling') c.journeyId = 'active-road';
    if (mode === 'absent') f.ctx.atVehicle = false;
    if (mode === 'sight') f.ctx.lineOfSight = false;
    if (mode === 'scientist') f.ctx.capable = false;
    if (mode === 'driver') c.driver.status = 'dead';
    if (mode === 'busy') f.ctx.busy = true;
    if (mode === 'foreign') f.ctx.cityId = 'b';
    if (mode === 'terms') f.ctx.destination = null;
    const before = clone(c);
    expect(begin(f), mode).toBe(false); expect(c).toEqual(before);
    expect(Briefings.publicView(c).contacts).toEqual([]);
  }
});

test('a saved thirty-second conversation freezes its source without charging another fare or changing travel resources', () => {
  const f = fixture(), before = clone(f.carrier);
  expect(begin(f)).toBe(true);
  Briefings.advance(f.carrier, f.ctx, 115);
  expect(Briefings.publicView(f.carrier).copies).toEqual([]);
  let saved = Survey.normalizeState(clone({ carrier: f.carrier })).carrier;
  f.ctx.destination.label = 'Renamed after conversation began';
  saved.driver.name = 'Renamed driver';
  Briefings.advance(saved, f.ctx, 131);
  const view = Briefings.publicView(saved);
  expect(view.copies).toHaveLength(1); expect(view.copies[0].receivedAt).toBe(130);
  expect(view.copies[0].destination.label).toBe('Aster municipal ground');
  expect(view.copies[0].suppliedBy.label).toBe(before.driver.name);
  expect(saved.vehicle).toEqual(before.vehicle); expect(saved.revenue).toBe(before.revenue);
  expect(JSON.stringify(view)).not.toMatch(/hiddenDeposit|secret|fuelKm|health|reservedFuelKm|populationAtAllocation/);
  Briefings.advance(saved, f.ctx, 1000); expect(saved.briefingState.copies).toHaveLength(1);
});

test('the same driver cannot depart, dispatch or rest while conducting a briefing', () => {
  const f = fixture(); f.carrier.driver.fatigue = 50;
  expect(begin(f)).toBe(true);
  expect(Carrier.attach(f.carrier, { id: 'outbound', subject: { kind: 'scientistSurvey' } }, 'outbound')).toBe(false);
  expect(Carrier.movementReason(f.carrier)).toContain('briefing');
  Carrier.advance(f.carrier, null, 0, 115);
  expect(f.carrier.driver.fatigue).toBe(50);
  Briefings.cancel(f.carrier);
  expect(Carrier.attach(f.carrier, { id: 'outbound', subject: { kind: 'scientistSurvey' } }, 'outbound')).toBe(true);
  expect(f.carrier.contract.passengerJourneyIds).toEqual(['outbound']);
});

test('leaving, losing sight, cancellation, replacement, incapacity or bodily change cannot complete partial conversation', () => {
  for (const mode of ['leave', 'sight', 'cancel', 'driver', 'health', 'body', 'depart', 'busy']) {
    const f = fixture(); begin(f); Briefings.advance(f.carrier, f.ctx, 110);
    if (mode === 'leave') f.ctx.atVehicle = false;
    if (mode === 'sight') f.ctx.lineOfSight = false;
    if (mode === 'cancel') f.carrier.contract.returnToBase = true;
    if (mode === 'driver') f.carrier.driver.id = 'replacement';
    if (mode === 'health') f.carrier.driver.health = 0;
    if (mode === 'body') f.ctx.bodyEpoch++;
    if (mode === 'depart') f.carrier.journeyId = 'road';
    if (mode === 'busy') f.ctx.busy = true;
    Briefings.advance(f.carrier, f.ctx, 10000);
    expect(f.carrier.briefingState.job, mode).toBeNull();
    expect(Briefings.publicView(f.carrier).copies, mode).toEqual([]);
  }
});

test('only previously disclosed reports for this booking enter copies with original dates and limited fields', () => {
  const f = fixture(); f.carrier.contract.passengerJourneyIds = ['passenger'];
  const report = (summary, at = 50, revealed = true) => ({ summary, revealedAt: at, revealed, hiddenThreat: 'secret', triggerFraction: .7 });
  const journeys = [
    { id: 'passenger', exactArrivalAt: 777, route: { legs: [{ interruption: report('Dated beast diversion warning') }, { interruption: report('Undisclosed fault', 20, false) }, { interruption: report('Future report', 200) }] } },
    { id: 'other-customer', subject: { kind: 'scientistSurvey' }, route: { legs: [{ interruption: report('Other customer secret') }] } },
    { id: 'collection', subject: { kind: 'municipalCarrier', id: f.carrier.contract.id }, route: { legs: [{ interruption: report('Collection delay', 80) }] } }
  ];
  expect(Briefings.begin(f.carrier, f.ctx, journeys, 100)).toBe(true);
  journeys[0].route.legs[0].interruption.summary = 'Changed after start';
  Briefings.advance(f.carrier, f.ctx, 130);
  const reports = Briefings.publicView(f.carrier).copies[0].reports;
  expect(reports.map(r => r.reportedAt)).toEqual([50, 80]);
  expect(reports[0].text).toBe('Dated beast diversion warning');
  expect(JSON.stringify(reports)).not.toMatch(/Undisclosed|Future|secret|777|triggerFraction|Changed/);
});

test('received copies and dated contacts survive cancelled bookings and replacements without inherited familiarity', () => {
  const f = fixture(); begin(f); Briefings.advance(f.carrier, f.ctx, 130);
  const original = clone(Briefings.publicView(f.carrier));
  f.carrier.contract = null; f.carrier.location = 'depot'; f.carrier.driver.status = 'dead';
  expect(Briefings.publicView(Survey.normalizeState(clone({ carrier: f.carrier })).carrier)).toEqual(original);
  f.carrier.driver = { ...f.carrier.driver, id: 'different-person', name: 'Another driver', status: 'alive' };
  expect(Briefings.publicView(f.carrier).contacts).toEqual(original.contacts);
  Carrier.reserve(f.carrier, 2, 4, 2, 104, { money: 500 }, 200); f.carrier.location = 'laboratory';
  Briefings.begin(f.carrier, f.ctx, [], 210); Briefings.advance(f.carrier, f.ctx, 240);
  const view = Briefings.publicView(f.carrier);
  expect(view.contacts).toHaveLength(2); expect(view.contacts[1].firstMetAt).toBe(210);
  expect(view.copies[0]).toEqual(original.copies[0]);
  expect(view.copies[1].bookingId).not.toBe(view.copies[0].bookingId);
});

test('new reports require a new completed conversation and fractional clocks finish once', () => {
  const f = fixture(), start = 100.123456789;
  Briefings.begin(f.carrier, f.ctx, [], start); Briefings.advance(f.carrier, f.ctx, start + 30);
  expect(Briefings.publicView(f.carrier).copies[0].reports).toEqual([]);
  f.carrier.contract.passengerJourneyIds = ['outbound']; f.carrier.location = 'field'; f.ctx.location = 'field';
  const j = { id: 'outbound', route: { legs: [{ interruption: { revealed: true, revealedAt: 150, summary: 'Disclosed delay' } }] } };
  Briefings.begin(f.carrier, f.ctx, [j], 200); Briefings.advance(f.carrier, f.ctx, 230);
  expect(Briefings.publicView(f.carrier).copies).toHaveLength(2);
  expect(Briefings.publicView(f.carrier).copies[0].reports).toEqual([]);
  expect(Briefings.publicView(f.carrier).copies[1].reports[0].reportedAt).toBe(150);
});
