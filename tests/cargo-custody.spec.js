const { test, expect } = require('@playwright/test');
const { fixture } = require('./helpers/cargo-appearance-fixture');
const Custody = require('../cargo-custody');
const Referrals = require('../cargo-criminal-referrals');
const Appearance = require('../cargo-appearance');
const Jail = require('../jail-custody');
const Buyer = require('../buyer-corroboration');
const copy = x => JSON.parse(JSON.stringify(x));
function setup(response = 'evade') {
  const f = fixture(); f.person.courtPreferences.attend = false; f.person.custodyPreferences.followup = response;
  f.until('awaitingAttendance'); f.advance(86401); expect(f.d.appearance.phase).toBe('notAttended');
  const step = seconds => { f.advance(seconds ?? 60); Custody.advance(f.state, f.gate, f.now(), Referrals.findings); };
  const until = phase => { for (let n = 0; n < 2000 && f.d.custodyCase?.phase !== phase; n++) step(); expect(f.d.custodyCase?.phase).toBe(phase); };
  return { ...f, step, until, job: () => f.d.custodyCase, office: () => f.gate.custodyOffice };
}
test('witnessed deliberate evasion leads through independent authorization, physical escort, NPC jail review and release', () => {
  const f = setup(); f.until('observedDeparture');
  expect(f.job().order).toBeUndefined(); expect(f.person.custody).toBeUndefined();
  f.until('authorization'); const report = f.job().submission;
  expect(report.observedAt).toBeGreaterThan(report.departedAt); expect(report.distanceKm).toBeCloseTo(1);
  expect(Custody.grounds(f.gate, f.d, f.job(), Referrals.findings)).toBe(true);
  f.until('execution'); expect(f.job().order.scope).toContain('No forced entry'); expect(f.person.custody).toBeUndefined();
  f.until('escort'); expect(f.person.custody).toMatchObject({ active: true, suppressionActive: true });
  expect(f.office().jail.stays).toEqual([]); expect(Buyer.canReceive(f.buyer)).toBe(false);
  f.until('review'); const stay = f.office().jail.stays[0];
  expect(stay.detaineeId).toBe(f.person.id); expect(stay.facility.cityId).toBe('b');
  expect(stay.transport).toMatchObject({ mode: 'foot', departedAt: f.job().transportDepartedAt, arrivedAt: f.job().bookedAt });
  expect(stay.actors.map(x => x.id)).toEqual(f.office().officers.map(x => x.id));
  expect(JSON.stringify(stay.history)).not.toContain('scientist'); expect(stay.knowledge.labSnapshot).toEqual({});
  expect(f.job().challenges).toHaveLength(1); expect(f.job().defendantPacket.order.id).toBe(f.job().order.id);
  f.until('closed'); expect(f.office().jail.stays[0].status).toBe('released');
  expect(f.office().custodyReceipts).toHaveLength(1);
  expect(f.office().custodyReceipts[0]).toMatchObject({ personId: f.person.id, docketId: f.d.id,
    startedAt: f.job().arrestedAt, endedAt: f.job().releasedAt, orderId: f.job().order.id });
  expect(f.person.custody).toMatchObject({ active: false, suppressionActive: false });
  expect(f.job().personReturnedAt).toBeGreaterThan(f.job().releasedAt); expect(f.person.locationId).toBe('b');
  expect(Buyer.canReceive(f.buyer)).toBe(true); expect(f.office().cell.occupant).toBeNull();
  expect(f.d.handoff).toMatchObject({ custodyAuthorized: false, trialStarted: false }); expect(f.state.jailCustody).toBeUndefined();
  expect(f.buyer.buyerService.appearanceNotices).toBeUndefined();
});
test('silence, ordinary departure and rescheduling never become arrest grounds', () => {
  for (const response of ['silent', 'leave', 'reschedule', 'cooperate']) {
    const f = setup(response); f.until('closed');
    expect(f.job().arrestedAt, response).toBeUndefined(); expect(f.person.custody).toBeUndefined();
    if (response === 'leave') expect(f.job().decisions[0].status).toBe('insufficientGrounds');
    if (['cooperate', 'reschedule'].includes(response)) expect(f.d.appearance.dueAt).toBeGreaterThan(f.job().response.at);
  }
});
test('copied report flags, source withdrawal, wrong service and retrospective policy fail independent review', () => {
  for (const defect of ['copy', 'withdrawn', 'service', 'policy']) {
    const f = setup(); f.until('authorization');
    if (defect === 'copy') f.job().submission.distanceKm = 10;
    if (defect === 'withdrawn') f.office().witnessRecords[0].status = 'withdrawn';
    if (defect === 'service') f.d.appearance.servedAt += 1;
    if (defect === 'policy') f.office().policy.publishedAt = f.now() + 1000;
    f.until('closed'); expect(f.job().arrestedAt, defect).toBeUndefined();
    expect(f.job().decisions[0].status).toBe('insufficientGrounds');
  }
});
test('unavailable cell, depleted escort, absent person and nonpeaceful response prevent execution', () => {
  for (const defect of ['cell', 'resources', 'absent', 'resists', 'identity', 'private']) {
    const f = setup(); f.until('execution');
    if (defect === 'cell') f.office().cell.occupant = 'someone-else';
    if (defect === 'resources') f.office().officers[0].workSeconds = 1;
    if (defect === 'absent') f.person.locationId = 'private-unknown-address';
    if (defect === 'resists') f.person.custodyPreferences.peacefulSurrender = false;
    if (defect === 'identity') f.state.identityOffices[0].records[0].status = 'withdrawn';
    if (defect === 'private') f.buyer.buyerService.premises.departureStand.publicAccess = false;
    f.step(600); expect(f.job().arrestedAt, defect).toBeUndefined(); expect(f.person.custody).toBeUndefined();
  }
});
test('revoked authority during escort releases at the real location without booking or teleporting', () => {
  const f = setup(); f.until('escort'); f.step(); f.step(300); const location = f.person.locationId;
  f.e.authorization.covering.push('permit'); f.step();
  expect(f.job().custodyActive).toBe(false); expect(f.person.custody.suppressionActive).toBe(false);
  expect(f.person.locationId).toBe(location); expect(f.office().jail.stays).toEqual([]);
  f.until('closed'); expect(f.person.locationId).toBe('b');
});
test('court outage cannot extend custody: timed cell and collar release at the six-hour boundary', () => {
  const f = setup(); f.until('review'); f.gate.cargoCourt.judge.health = 0; f.office().channelPowered = false;
  const releaseBy = f.job().releaseBy; f.step(releaseBy - f.now() + 1);
  expect(f.job().releasedAt).toBe(releaseBy); expect(f.office().cell.locked).toBe(false);
  expect(f.office().jail.stays[0].status).toBe('released'); expect(f.person.custody.active).toBe(false);
  expect(f.person.locationId).toBe(f.office().id); f.until('closed'); expect(f.person.locationId).toBe('b');
});
test('unavailable officers do not prevent a released defendant returning independently', () => {
  const f = setup(); f.until('review'); f.office().officers.forEach(x => { x.health = 0; });
  f.step(f.job().releaseBy - f.now() + 1);
  for (let n = 0; n < 80 && f.person.assignment; n++) f.step();
  expect(f.person.locationId).toBe('b'); expect(f.person.custody.active).toBe(false);
  expect(f.office().collar.available).toBe(false); // No able officer recovered it.
});
test('save/load preserves actual transit, jail identity, exact-once admission and release', () => {
  const f = setup(); f.until('escort'); f.step(300);
  const restored = copy(f.state), g = restored.checkpoints[0];
  for (let n = 0; n < 150; n++) {
    f.step(); Appearance.advance(restored, g, f.now(), Referrals.findings); Custody.advance(restored, g, f.now(), Referrals.findings);
  }
  expect(restored).toEqual(f.state); expect(f.job().phase).toBe('closed'); expect(f.office().jail.stays).toHaveLength(1);
});
test('explicit jail admission rejects absent people or fabricated transport and preserves legacy scientist state', () => {
  const legacy = Jail.book(Jail.defaultState(), { clock: 100, seed: 'legacy', raidId: 'raid' }).state;
  expect(Jail.admit(legacy, { clock: 200, person: { id: 'npc' } }).created).toBe(false);
  expect(Jail.normalizeState(legacy).stays[0].detaineeId).toBe('scientist');
  const f = setup(); f.until('review'); const npc = f.office().jail;
  expect(Jail.normalizeState(copy(npc))).toEqual(npc); expect(npc.stays[0].detaineeId).not.toBe('scientist');
  expect(legacy.stays[0].status).toBe('active');
  expect(Jail.activeStay(npc)).toBeNull(); expect(Jail.activeStay(npc, f.person.id).id).toBe(f.job().stayId);
  expect(npc.stays[0].actors.every(x => x.mapCell === null)).toBe(true);
  const options = { person: f.person, facility: f.office().cell, clock: f.now(), orderId: 'raid', docket: 'test',
    transport: npc.stays[0].transport, actors: f.office().officers, suppressor: npc.stays[0].suppressor };
  expect(Jail.admit(legacy, options).stay).toBeNull();
  expect(Jail.admit(Jail.defaultState(), { ...options, person: { ...f.person, id: '!!!' } }).stay).toBeNull();
});
test('unresolved explanations and unsupported statement-only evasion cannot create an order', () => {
  const explained = setup(); explained.person.custodyPreferences.explanation = 'I could not reach the court and need that obstacle reviewed.';
  explained.until('closed'); expect(explained.job().decisions[0].status).toBe('insufficientGrounds');
  expect(explained.job().submission.explanation).toContain('obstacle');
  const f = setup(); f.until('observedDeparture'); f.person.provisions = 0;
  f.step(900); expect(f.job().submission).toBeUndefined(); expect(f.job().order).toBeUndefined();
  f.step(86400); expect(f.job().arrestedAt).toBeUndefined();
});
test('altered, foreign, expired and revoked judicial instruments fail before physical arrest', () => {
  for (const defect of ['city', 'actor', 'institution', 'document', 'expired', 'revoked', 'decision', 'kind']) {
    const f = setup(); f.until('execution'); const order = f.job().order;
    if (defect === 'city') order.cityId = 'foreign';
    if (defect === 'actor') order.actorId = 'scientist';
    if (defect === 'institution') order.institutionId = 'foreign-court';
    if (defect === 'document') order.document.number = 'someone-else';
    if (defect === 'expired') order.expiresAt = f.now();
    if (defect === 'revoked') order.status = 'revoked';
    if (defect === 'decision') order.decisionId = 'unsupported';
    if (defect === 'kind') order.kind = 'arbitraryDetention';
    f.step(); expect(f.job().arrestedAt, defect).toBeUndefined(); expect(f.person.custody).toBeUndefined();
  }
});
test('road outage grants no retroactive escort movement and cannot extend timed custody', () => {
  const f = setup(); f.until('escort'); f.step(); f.step(300);
  const location = f.person.locationId, distance = f.job().distanceKm;
  f.buyer.buyerService.premises.route.open = false; f.step(1000);
  f.buyer.buyerService.premises.route.open = true; f.step(1000);
  expect(f.job().distanceKm).toBe(distance); expect(f.person.locationId).toBe(location);
  f.buyer.buyerService.premises.route.open = false; f.step(f.job().releaseBy - f.now() + 1);
  expect(f.person.custody.active).toBe(false); expect(f.person.locationId).toBe(location); expect(f.office().jail.stays).toEqual([]);
});
