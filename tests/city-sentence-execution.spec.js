const { test, expect } = require('@playwright/test');
const Execution = require('../city-sentence-execution');
function fixture(id = 'local-case') {
  const judgment = { id: `${id}:judgment`, caseId: id, cityId: 'a', judgeId: 'judge-a', verdict: 'guilty' };
  const c = { id, cityId: 'a', personId: 'scientist', status: 'resolved', judgment: structuredClone(judgment), trial: { phase: 'sentenceHandoff', judgment,
    sentence: { id: `${id}:sentence`, cityId: 'a', judgmentId: judgment.id, issuedById: 'judge-a', kind: 'finitePrison', status: 'awaitingTransferProceeding', months: 3, custodyCreditSeconds: 3600, executionStartedAt: null },
    packet: { evidence: { localLaw: { rule: { offenseId: 'warrantObstruction', sentencing: { ordinarySanctions: ['finitePrison'], finitePrisonRangeMonths: { minimum: 3, maximum: 12 } } } } } } } };
  const actor = (id, role) => ({ id, role, institutionId: 'corrections-a', status: 'alive', health: 100, locationId: 'loading-a', reservedBy: null });
  const r = { cityId: 'a', institutionId: 'corrections-a', dispatcher: actor('dispatcher-a', 'dispatcher'), facility: { id: 'prison-a', cityId: 'a', institutionId: 'corrections-a', status: 'open', beds: [{ id: 'bed-a', occupiedBy: null, reservedBy: null }, { id: 'bed-b', occupiedBy: null, reservedBy: null }] },
    vehicle: { id: 'van-a', cityId: 'a', institutionId: 'corrections-a', condition: 100, seats: 4, fuelKm: 40, reservedFuelKm: 0, locationId: 'loading-a', reservedBy: null }, crew: [actor('driver-a', 'driver'), actor('escort-a', 'escort')], route: { id: 'route-a', cityId: 'a', originId: 'loading-a', destinationId: 'prison-a', open: true, condition: 100, distanceKm: 4 } };
  const f = { cityId: 'a', personId: 'scientist', identityVerified: true, sourcePersonId: 'scientist', correctionsId: 'corrections-a', judiciaryId: 'judiciary-a', jailId: 'jail-a', judge: { id: 'judge-a', institutionId: 'judiciary-a', status: 'alive', health: 100 }, clerk: { id: 'clerk-a', status: 'alive', health: 100 }, channel: true, atCheckpoint: true, checkpointRoomId: 'checkpoint-a', localCustodySeconds: 3600, custodySourceIds: ['stay-a'] };
  const s = Execution.open(c, 0); return { c, r, f, s };
}
function reviewed(x) { expect(Execution.requestReview(x.s, x.c, x.f, 0)).toBe(true); expect(Execution.tick(x.s, x.c, x.r, x.f, 900)).toBe(true); }
function reserved(x) { reviewed(x); expect(Execution.reserve(x.s, x.c, x.r, x.f, 1000)).toBe(true); }
test('execution review verifies the exact local term and credit without changing sentence or imposing custody', () => {
  const x = fixture(), before = structuredClone(x.c.trial); reviewed(x);
  expect(x.s.phase).toBe('readyToPlan'); expect(x.s.ledger).toMatchObject({ remainingSeconds: 3 * Execution.MONTH - 3600, prisonServedSeconds: 0, creditAppliedAt: null }); expect(x.c.trial).toEqual(before); expect(x.s.custodyAuthority).toBeNull();
  expect(Execution.open(x.c, 1000)).toBeNull(); expect(JSON.parse(JSON.stringify(x.s))).toEqual(x.s);
});
test('unsupported identity, jurisdiction, prison authority, finite ranges and referrals cannot become imprisonment', () => {
  for (const change of [x => x.f.sourcePersonId = 'other', x => x.f.cityId = 'foreign', x => x.f.correctionsId = 'jail-a', x => x.c.trial.sentence.months = 121, x => x.c.trial.sentence.custodyCreditSeconds = 5000, x => x.c.trial.sentence.kind = 'judicialReferral']) {
    const x = fixture(); change(x); reviewed(x); expect(x.s.phase).toBe('reviewRequired'); expect(x.s.review.result).toBe('referred'); expect(x.r.vehicle.reservedBy).toBeNull(); expect(x.c.trial.sentence.executionStartedAt).toBeNull();
  }
  const noncustodial = fixture(); delete noncustodial.c.execution; noncustodial.c.trial.sentence.kind = 'fine'; expect(Execution.open(noncustodial.c, 0)).toBeNull();
});
test('review progress requires its live named judge and working records; custody credit can satisfy a term once', () => {
  const x = fixture(); Execution.requestReview(x.s, x.c, x.f, 0); Execution.tick(x.s, x.c, x.r, { ...x.f, channel: false }, 900); expect(x.s.progress).toBe(0);
  Execution.tick(x.s, x.c, x.r, x.f, 1000); Execution.tick(x.s, x.c, x.r, x.f, 1900); expect(x.s.phase).toBe('readyToPlan');
  const served = fixture(); served.c.trial.sentence.custodyCreditSeconds = served.f.localCustodySeconds = 3 * Execution.MONTH; reviewed(served);
  expect(served.s.phase).toBe('satisfiedByCredit'); expect(served.c.trial.sentence.status).toBe('completed'); expect(served.c.trial.sentence.executionStartedAt).toBeNull(); expect(served.s.ledger.creditAppliedAt).toBe(900); expect(Execution.tick(served.s, served.c, served.r, served.f, 2000)).toBe(false);
});
test('reservation is atomic and exclusive across cases, including bed, crew and fuel', () => {
  const x = fixture(); reserved(x); expect(x.r.vehicle).toMatchObject({ reservedBy: x.s.plan.id, fuelKm: 40, reservedFuelKm: 8 }); expect(x.r.facility.beds[0].reservedBy).toBe(x.s.plan.id); expect(x.r.crew.every(a => a.reservedBy === x.s.plan.id)).toBe(true);
  const other = fixture('case-two'); reviewed(other); const before = structuredClone(x.r); expect(Execution.reserve(other.s, other.c, x.r, other.f, 1001)).toBe(false); expect(x.r).toEqual(before);
  expect(Execution.reserve(x.s, x.c, x.r, x.f, 1002)).toBe(false); expect(x.s.nextPlan).toBe(2);
});
test('missing capacity, vehicle fuel, route or staff postpones without partial holds or new custody', () => {
  for (const change of [x => x.r.facility.beds.forEach(b => b.occupiedBy = 'occupied'), x => x.r.vehicle.fuelKm = 7, x => x.r.route.open = false, x => x.r.crew[0].health = 0]) {
    const x = fixture(); change(x); reviewed(x); expect(x.s.phase).toBe('postponed'); expect(x.s.reviewAt).toBe(15300); expect(x.r.vehicle.reservedBy).toBeNull(); expect(x.r.crew.every(a => !a.reservedBy)).toBe(true); expect(x.s.custodyAuthority).toBeNull();
  }
});
test('real service and timely witnessed reporting produce a reserved plan, never departure or prison service', () => {
  const x = fixture(); reserved(x); expect(Execution.serve(x.s, x.c, x.r, { ...x.f, atCheckpoint: false }, 1100)).toBe(false); expect(Execution.serve(x.s, x.c, x.r, x.f, 1100)).toBe(true);
  expect(Execution.report(x.s, x.c, x.r, x.f, 8299)).toBe(false); expect(Execution.report(x.s, x.c, x.r, x.f, 8300)).toBe(true); expect(x.s.phase).toBe('readyForPhysicalTransfer'); expect(x.s.plan).toMatchObject({ admissionAt: null, departureAt: null, executionStartedAt: null });
  expect(x.s.ledger.prisonServedSeconds).toBe(0); expect(x.c.trial.sentence.executionStartedAt).toBeNull(); expect(x.r.vehicle.fuelKm).toBe(40);
  Execution.tick(x.s, x.c, x.r, x.f, 11900); expect(x.s.phase).toBe('postponed'); expect(x.s.notice.reportedAt).toBe(8300); expect(x.s.notices[0].reportedAt).toBe(8300); expect(x.r.vehicle.reservedBy).toBeNull(); expect(x.r.facility.beds.every(b => !b.reservedBy)).toBe(true);
});
test('asset failure and missed windows release only owned reservations and preserve final judgments', () => {
  const x = fixture(); reserved(x); Execution.serve(x.s, x.c, x.r, x.f, 1100); const before = structuredClone(x.c.trial);
  x.r.vehicle.condition = 0; Execution.tick(x.s, x.c, x.r, { ...x.f, atCheckpoint: false }, 1200); expect(x.s.phase).toBe('postponed'); expect(x.c.trial).toEqual(before); expect(x.r.vehicle.reservedBy).toBeNull(); expect(x.s.delay).toContain('no arrest');
  const missed = fixture(); reserved(missed); Execution.serve(missed.s, missed.c, missed.r, missed.f, 1100); Execution.tick(missed.s, missed.c, missed.r, { ...missed.f, atCheckpoint: false }, 11900); expect(missed.s.delay).toContain('cause needs review'); expect(missed.s.notice.reportedAt).toBeUndefined();
  const reassigned = fixture(); reserved(reassigned); reassigned.r.vehicle.reservedBy = 'another-plan'; Execution.tick(reassigned.s, reassigned.c, reassigned.r, reassigned.f, 1100); expect(reassigned.r.vehicle.reservedBy).toBe('another-plan');
});
test('material changes invalidate stale reviews and expired plans cannot revive or reroll unchanged evidence', () => {
  const stale = fixture(); reserved(stale); Execution.serve(stale.s, stale.c, stale.r, stale.f, 1100); stale.c.trial.sentence.months = 4;
  expect(Execution.report(stale.s, stale.c, stale.r, stale.f, 8300)).toBe(false); expect(stale.s.notice.reportedAt).toBeUndefined();
  const x = fixture(); reserved(x); x.c.trial.sentence.months = 4; Execution.tick(x.s, x.c, x.r, x.f, 1100); expect(x.s.phase).toBe('postponed'); expect(x.s.plans).toHaveLength(1); expect(Execution.requestReview(x.s, x.c, x.f, 1200)).toBe(true);
  Execution.tick(x.s, x.c, x.r, x.f, 2100); expect(x.s.ledger.remainingSeconds).toBe(4 * Execution.MONTH - 3600); Execution.reserve(x.s, x.c, x.r, x.f, 2200); expect(x.s.plan.id).toContain('plan-2');
  Execution.tick(x.s, x.c, x.r, x.f, 5800); expect(x.s.phase).toBe('postponed'); expect(Execution.requestReview(x.s, x.c, x.f, 5900)).toBe(false); Execution.tick(x.s, x.c, x.r, x.f, x.s.reviewAt); expect(x.s.reviewDue).toBe(true); expect(Execution.requestReview(x.s, x.c, x.f, 20200)).toBe(true);
});
