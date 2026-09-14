const { test, expect } = require('@playwright/test');
const P = require('../city-prison');
const E = require('../city-sentence-execution');
function fixture() {
  const j = { id: 'judgment', caseId: 'case', cityId: 'city', judgeId: 'judge', verdict: 'guilty' };
  const rule = { offenseId: 'warrantObstruction', sentencing: { ordinarySanctions: ['finitePrison'], finitePrisonRangeMonths: { minimum: 3, maximum: 12 } } };
  const c = { id: 'case', cityId: 'city', personId: 'scientist', status: 'resolved', judgment: j, trial: {
    judgment: j, sentence: { id: 'sentence', cityId: 'city', judgmentId: j.id, issuedById: 'judge', kind: 'finitePrison', status: 'awaitingTransferProceeding', executionStartedAt: null, months: 3, custodyCreditSeconds: 3600 }, packet: { evidence: { localLaw: { rule } } }
  } };
  const actor = (id, role) => ({ id, role, status: 'alive', health: 100, institutionId: 'corrections', locationId: 'loading', reservedBy: null });
  const r = { cityId: 'city', institutionId: 'corrections', facility: { id: 'prison', cityId: 'city', institutionId: 'corrections', status: 'open', beds: [{ id: 'bed', occupiedBy: null, reservedBy: null }] }, vehicle: { id: 'van', cityId: 'city', institutionId: 'corrections', locationId: 'loading', condition: 100, seats: 4, fuelKm: 40, reservedBy: null }, crew: [actor('driver', 'driver'), actor('escort', 'escort')], dispatcher: actor('dispatcher', 'dispatcher'), route: { id: 'road', cityId: 'city', originId: 'loading', destinationId: 'prison', distanceKm: 4, condition: 100, open: true } };
  const f = { cityId: 'city', personId: 'scientist', sourcePersonId: 'scientist', identityVerified: true, correctionsId: 'corrections', judiciaryId: 'court', jailId: 'jail', localCustodySeconds: 3600, judge: { id: 'judge', institutionId: 'court', status: 'alive', health: 100 }, clerk: actor('clerk', 'clerk'), channel: true, atCheckpoint: true };
  const s = E.open(c, 0); E.requestReview(s, c, f, 0); E.tick(s, c, r, f, 900); E.reserve(s, c, r, f, 1000); E.serve(s, c, r, f, 1100); E.report(s, c, r, f, 8300);
  return { c, s, r, f };
}
function collected() { const x = fixture(); expect(P.authorize(x.s, x.c, x.r, x.f, 8400, E)).toBe(true); expect(P.collect(x.s, x.c, x.r, x.f, 8500, E)).toBe(true); x.p = x.s.prison; return x; }
test('reporting and signed commitment alone never collect; exact authority and live resources are required', () => {
  const x = fixture(); expect(P.collect(x.s, x.c, x.r, x.f, 8400, E)).toBe(false); expect(P.authorize(x.s, x.c, x.r, x.f, 8400, E)).toBe(true); expect(x.s.prison).toBeUndefined();
  x.r.vehicle.condition = 0; expect(P.collect(x.s, x.c, x.r, x.f, 8500, E)).toBe(false); E.tick(x.s, x.c, x.r, x.f, 8500); expect(x.s.custodyAuthority.status).toBe('withdrawn'); expect(x.c.trial.sentence.executionStartedAt).toBeNull();
});
test('finite term accounts once for pretrial and actual transport detention, with no planning credit', () => {
  const x = collected(); const { p, s, c, r } = x;
  expect(p.termEndsAt).toBe(8500 + 3 * E.MONTH - 3600); expect(P.custody(p)).toBe(true);
  P.depart(p, s, r, 8700); P.tick(p, s, c, r, 9300); expect(p.phase).toBe('intake'); expect(r.vehicle.fuelKm).toBe(36); expect(c.trial.sentence.executionStartedAt).toBeNull();
  expect(P.admit(p, s, c, r, 9420)).toBe(true); expect(p.transportCreditSeconds).toBe(920); expect(P.admit(p, s, c, r, 9500)).toBe(false); expect(r.facility.beds[0].occupiedBy).toBe('scientist');
  P.tick(p, s, c, r, 10000); expect(s.ledger.prisonServedSeconds).toBe(580); expect(s.ledger.remainingSeconds).toBe(3 * E.MONTH - 3600 - 920 - 580);
});
test('road breakdown retains real occupants, position and exclusive assets; finite kit repairs without free travel', () => {
  const { p, s, c, r } = collected(); P.depart(p, s, r, 8700); P.tick(p, s, c, r, 9000); const fuel = r.vehicle.fuelKm, position = r.vehicle.locationId;
  r.vehicle.condition = 0; P.tick(p, s, c, r, 9600); expect(r.vehicle.locationId).toBe(position); expect(r.vehicle.fuelKm).toBe(fuel); expect(r.vehicle.occupants).toContain('scientist'); expect(r.vehicle.reservedBy).toBe(s.plan.id);
  expect(P.repair(p, r, 9600)).toBe(true); expect(P.repair(p, r, 9601)).toBe(false); P.tick(p, s, c, r, 10499); expect(r.vehicle.condition).toBe(0); P.tick(p, s, c, r, 10500); expect(r.vehicle.condition).toBe(70); expect(p.repairKits).toBe(0);
});
test('lost bed blocks admission without reviving jail or resetting detention credit', () => {
  const { p, s, c, r } = collected(); P.depart(p, s, r, 8700); P.tick(p, s, c, r, 9300); r.facility.beds[0].occupiedBy = 'other'; expect(P.admit(p, s, c, r, 9420)).toBe(false); expect(p.admittedAt).toBeNull();
  P.tick(p, s, c, r, 25000); expect(p.reviews).toHaveLength(1); expect(p.collectedAt).toBe(8500); expect(c.trial.sentence.executionStartedAt).toBeNull();
});
test('release ends authority exactly, then discharge consumes return fuel and releases only own holds once', () => {
  const { p, s, c, r } = collected(); P.depart(p, s, r, 8700); P.tick(p, s, c, r, 9300); P.admit(p, s, c, r, 9420); P.tick(p, s, c, r, p.termEndsAt + 100);
  expect(P.custody(p)).toBe(false); expect(c.trial.sentence.status).toBe('completed'); expect(p.releasedAt).toBe(p.termEndsAt); expect(s.custodyAuthority.status).toBe('expired'); expect(s.ledger.remainingSeconds).toBe(0);
  const now = p.termEndsAt + 200; P.depart(p, s, r, now, true); P.tick(p, s, c, r, now + 600); expect(P.complete(p, s, r, now + 600)).toBe(true); expect(P.complete(p, s, r, now + 601)).toBe(false); expect(r.vehicle.fuelKm).toBe(32); expect(r.facility.beds[0].occupiedBy).toBeNull(); expect(r.crew.every(a => !a.reservedBy)).toBe(true);
});
test('expiry during transport ends detention without admission and returns only the actual travelled distance', () => {
  const { p, s, c, r } = collected(); P.depart(p, s, r, 8700); P.tick(p, s, c, r, 9000); p.termEndsAt = 9100; P.tick(p, s, c, r, 9100); expect(p.phase).toBe('releaseDue'); expect(p.admittedAt).toBeNull(); expect(c.trial.sentence.status).toBe('completed'); expect(P.custody(p)).toBe(false);
  P.depart(p, s, r, 9200, true); expect(p.tripDistanceKm).toBe(2); P.tick(p, s, c, r, 9500); expect(p.phase).toBe('checkpointArrival'); expect(r.vehicle.fuelKm).toBe(36);
});
test('saved local custody survives JSON reload without replenishing fuel or duplicating credit', () => {
  const x = collected(); P.depart(x.p, x.s, x.r, 8700); P.tick(x.p, x.s, x.c, x.r, 9300); P.admit(x.p, x.s, x.c, x.r, 9420);
  const saved = JSON.parse(JSON.stringify(x)); P.tick(saved.s.prison, saved.s, saved.c, saved.r, 10000); expect(saved.s.ledger.creditAppliedAt).toBe(9420); expect(saved.s.prison.transportCreditSeconds).toBe(920); expect(saved.r.vehicle.fuelKm).toBe(36);
});
test('blocked road and unavailable crew stop movement; repairs do not credit offline work or repair time as travel', () => {
  const { p, s, c, r } = collected(); P.depart(p, s, r, 8700); r.route.open = false; P.tick(p, s, c, r, 9000); expect(p.distanceTravelledKm).toBe(0); r.route.open = true;
  r.crew[1].health = 0; P.tick(p, s, c, r, 9300); expect(p.distanceTravelledKm).toBe(0); r.crew[1].health = 100;
  r.vehicle.condition = 0; P.repair(p, r, 9300); r.crew[0].health = 0; P.tick(p, s, c, r, 10200); expect(r.vehicle.condition).toBe(0); r.crew[0].health = 100; P.tick(p, s, c, r, 11100); expect(r.vehicle.condition).toBe(70); expect(p.distanceTravelledKm).toBe(0); expect(r.vehicle.fuelKm).toBe(40);
});
test('judicial failed-intake review credits real detention once and returns under interim release without completing punishment', () => {
  const { p, s, c, r, f } = collected(); P.depart(p, s, r, 8700); P.tick(p, s, c, r, 9300); r.facility.beds[0].occupiedBy = 'other';
  expect(P.requestReview(p, s, c, r, 9500)).toBe(true); expect(P.requestReview(p, s, c, r, 9501)).toBe(false);
  P.tick(p, s, c, r, 10400, { ...f, channel: false }); expect(p.transferReview.progress).toBe(0);
  P.tick(p, s, c, r, 10500, f); P.tick(p, s, c, r, 11400, f); expect(p.phase).toBe('releaseDue'); expect(p.interimRelease).toBe(true); expect(P.custody(p)).toBe(false); expect(c.trial.sentence.status).toBe('awaitingTransferProceeding'); expect(c.trial.sentence.custodyCreditSeconds).toBe(3600 + 2900); expect(s.custodyAuthority.status).toBe('withdrawn');
  P.depart(p, s, r, 11500, true); P.tick(p, s, c, r, 12100, f); P.complete(p, s, r, 12100); expect(s.phase).toBe('postponed'); expect(s.ledger.remainingSeconds).toBe(3 * E.MONTH - 6500); expect(r.facility.beds[0].occupiedBy).toBe('other'); expect(r.vehicle.reservedBy).toBeNull(); expect(c.trial.sentence.custodyCreditSeconds).toBe(6500);
});
