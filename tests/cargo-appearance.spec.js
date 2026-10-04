const { test, expect } = require('@playwright/test');
const Appearance = require('../cargo-appearance');
const Charging = require('../cargo-charging');
const Court = require('../cargo-judicial-review');
const Referrals = require('../cargo-criminal-referrals');
const Buyer = require('../buyer-corroboration');
const Identity = require('../buyer-identity');
const copy = x => JSON.parse(JSON.stringify(x));
const { fixture } = require('./helpers/cargo-appearance-fixture');
test('separate judicial work, physical service, independent attendance, appointment and return', () => {
  const f = fixture(); f.advance(); expect(f.d.appearance.phase).toBe('review'); expect(f.d.handoff.custodyAuthorized).toBe(false);
  f.until('awaitingService'); const order = f.d.appearance;
  expect(order.issuedAt).toBeGreaterThan(8600); expect(order.servedAt).toBeUndefined();
  f.until('awaitingAttendance'); expect(order.servedAt - order.issuedAt).toBeGreaterThanOrEqual(1800);
  expect(order.attempts[0].outcome).toBe('served'); expect(order.dueAt - order.servedAt).toBeGreaterThanOrEqual(86400);
  f.until('outbound'); expect(Buyer.canReceive(f.buyer)).toBe(false);
  f.until('complete'); expect(Buyer.canReceive(f.buyer)).toBe(true);
  expect(order.arrivedAt).toBeGreaterThan(order.servedAt); expect(order.appointmentAt - order.arrivedAt).toBeGreaterThanOrEqual(600);
  expect(order.returnedAt - order.appointmentAt).toBeGreaterThanOrEqual(1800);
  expect(order.disclosure).toEqual(f.d.proposals.at(-1)); expect(f.person.locationId).toBe('b');
  expect(f.d.handoff).toMatchObject({ custodyAuthorized: false, trialStarted: false });
  expect(f.buyer.buyerService.appearanceNotices).toBeUndefined(); expect(f.buyer.buyerService.availabilityNotices).toHaveLength(2);
});
test('a private canonical address or unverified identity copy cannot schedule service', () => {
  for (const defect of ['missingAddress', 'unmatchedAddress', 'unmatchedIdentity', 'wrongCity']) {
    const f = fixture(), records = f.d.proposals[0].disclosure.assessment.recipientFindings[0];
    if (defect === 'missingAddress') delete records.events[1].serviceLocation;
    if (defect === 'unmatchedAddress') records.comparisons[1].result = 'unavailable';
    if (defect === 'unmatchedIdentity') records.comparisons[0].result = 'unavailable';
    if (defect === 'wrongCity') records.events[1].serviceLocation.cityId = 'foreign';
    f.advance(5000); expect(f.d.appearance, defect).toBeUndefined();
  }
});
test('wrong person, revoked document and private premises do not allow service or forced entry', () => {
  for (const defect of ['absent', 'document', 'appearance', 'private']) {
    const f = fixture(); f.until('awaitingService');
    if (defect === 'absent') f.person.locationId = 'elsewhere';
    if (defect === 'document') f.state.identityOffices[0].records[0].status = 'withdrawn';
    if (defect === 'appearance') f.person.appearance.eyes = 'changed';
    if (defect === 'private') f.buyer.buyerService.premises.publicAccess = false;
    f.until('unserved'); expect(f.d.appearance.servedAt).toBeUndefined(); expect(f.person.assignment).toBeNull();
  }
});
test('refusal to attend has no automatic adverse finding and copies need separate consent', () => {
  const f = fixture(); f.person.courtPreferences.attend = false; f.person.courtPreferences.shareNotices = true;
  f.until('awaitingAttendance'); expect(f.buyer.buyerService.appearanceNotices).toHaveLength(1);
  f.advance(86401); expect(f.d.appearance.phase).toBe('notAttended'); expect(f.person.assignment).toBeNull();
  expect(f.d.handoff.custodyAuthorized).toBe(false); expect(f.buyer.buyerService.appearanceNotices.at(-1).text).toContain('Reason unresolved');
});
test('withdrawal during travel releases no teleport, custody or stale appointment', () => {
  const f = fixture(); f.until('outbound'); f.advance(); f.advance(900);
  expect(f.d.appearance.positionKm).toBeGreaterThan(0); f.e.authorization.covering.push('lawful-permit');
  f.advance(); expect(f.d.appearance.phase).toBe('returning'); expect(f.person.locationId).not.toBe('b');
  f.until('withdrawn'); expect(f.person.locationId).toBe('b'); expect(f.d.appearance.appointmentAt).toBeUndefined();
});
test('route outages pause travel, documented court closure extends attendance and no retroactive work occurs', () => {
  const f = fixture(); f.until('awaitingAttendance'); const deadline = f.d.appearance.dueAt;
  f.gate.appearanceOffice.clerk.health = 0; f.advance(5000); expect(f.d.appearance.dueAt).toBe(deadline + 5000);
  f.gate.appearanceOffice.clerk.health = 100; f.until('outbound'); f.advance(); f.advance(300);
  const position = f.d.appearance.positionKm; f.buyer.buyerService.premises.route.open = false; f.advance(1000);
  f.buyer.buyerService.premises.route.open = true; f.advance(1000); expect(f.d.appearance.positionKm).toBe(position);
  f.until('complete');
});
test('save/load preserves service and travel progress and never duplicates notices or appointments', () => {
  const f = fixture(); f.until('serving'); f.advance(900);
  const restored = copy(f.state), otherGate = restored.checkpoints[0];
  for (let n = 0; n < 200; n++) { f.advance(); Appearance.advance(restored, otherGate, f.now(), Referrals.findings); }
  expect(restored).toEqual(f.state); expect(f.d.appearance.phase).toBe('complete');
  expect(f.d.appearance.attempts).toHaveLength(1);
});
test('court closure at arrival permits physical return and a renewed window, not indefinite holding', () => {
  const f = fixture(); f.until('appointment'); f.gate.appearanceOffice.clerk.workSeconds = 0;
  f.advance(); expect(f.d.appearance.phase).toBe('returning'); f.until('awaitingAttendance');
  expect(Buyer.canReceive(f.buyer)).toBe(true); expect(f.d.appearance.appointmentAt).toBeUndefined();
  f.gate.appearanceOffice.clerk.workSeconds = 600; f.until('complete'); expect(f.d.appearance.appointmentAt).toBeTruthy();
});
test('finite staffing and displaced actors cannot travel or serve through canonical location lookup', () => {
  const f = fixture(); f.until('serving'); f.advance(300);
  const office = f.gate.appearanceOffice, position = f.d.appearance.officerKm;
  office.officer.locationId = 'elsewhere'; f.advance(1000); expect(f.d.appearance.officerKm).toBe(position);
  expect(f.d.appearance.servedAt).toBeUndefined();
  office.officer.locationId = f.d.appearance.officerLocation; f.until('outbound'); f.advance(300);
  const p = f.d.appearance.positionKm; f.person.locationId = 'elsewhere'; f.advance(1000);
  expect(f.d.appearance.positionKm).toBe(p); expect(f.person.locationId).toBe('elsewhere');
});
test('appearance scheduling reserves the real judge and cannot authorize custody from a stale source', () => {
  const f = fixture(); f.advance(); f.advance();
  const before = f.gate.cargoCourt.workSeconds;
  Court.advance(f.gate, f.now() + 300, Referrals.findings);
  expect(f.gate.cargoCourt.workSeconds).toBe(before);
  expect(f.gate.cargoCourt.appearanceJob).toBe(f.d.appearance.id);
  f.e.authorization.covering.push('permit'); f.advance(300);
  expect(f.d.appearance.phase).toBe('withdrawn'); expect(f.gate.cargoCourt.appearanceJob).toBeNull();
  expect(f.d.appearance.issuedAt).toBeUndefined(); expect(f.d.handoff.custodyAuthorized).toBe(false);
});
test('appearance notices browser shows received availability, not undisclosed court records, across reload', async ({ page }) => {
  test.setTimeout(240000);
  const f = fixture(); f.until('complete');
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const { pathToFileURL } = require('url'), path = require('path');
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a',
    routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 30, cellPath: ['cell:1', 'cell:2'] }],
    destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 8, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Home', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true },
      { id: 'city:b', kind: 'fortifiedCity', cityId: 'b', label: 'Neighbor', cellId: 'cell:2', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'appearance-ui'));
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), m = s.economy.intercitySmuggling;
    m.buyers[0].buyerService.availabilityNotices = notices;
    m.checkpoints = [{ id: 'gate:b', cityId: 'b', institutionId: 'court:b', jurisdiction: 'city', active: true, policy: 'Local service; no custody authority.' }];
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, f.buyer.buyerService.availabilityNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-appearance-availability]')).toContainText('returned to the receiving desk');
  await expect(page.locator('[data-cargo-appearance-notice]')).toHaveCount(0);
  const shared = fixture(); shared.person.courtPreferences.shareNotices = true; shared.until('complete');
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.buyers[0].buyerService.appearanceNotices = notices;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, shared.buyer.buyerService.appearanceNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-appearance-notice]')).toHaveCount(2);
  await expect(page.locator('[data-cargo-appearance-notice]').last()).toContainText('No plea, verdict, detention or automatic trial');
  const Custody = require('../cargo-custody'), detained = fixture();
  detained.person.courtPreferences.attend = false; detained.person.courtPreferences.shareNotices = true;
  detained.person.custodyPreferences.followup = 'evade'; detained.until('awaitingAttendance'); detained.advance(86401);
  for (let n = 0; n < 300 && detained.d.custodyCase?.phase !== 'closed'; n++) {
    detained.advance(); Custody.advance(detained.state, detained.gate, detained.now(), Referrals.findings);
  }
  expect(detained.d.custodyCase.phase).toBe('closed');
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.buyers[0].buyerService.appearanceNotices = notices;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, detained.buyer.buyerService.appearanceNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-appearance-notice]').filter({ hasText: 'Actual jail admission' })).toHaveCount(1);
  await expect(page.locator('[data-cargo-appearance-notice]').last()).toContainText('no continuing detention');
  await expect(page.locator('[data-cargo-trial-notice]')).toHaveCount(0);
  const { trialFixture } = require('./helpers/cargo-trial-fixture');
  const tried = trialFixture(); tried.person.courtPreferences.shareNotices = true; tried.untilTrial('judgment');
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.buyers[0].buyerService.trialNotices = notices;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, tried.buyer.buyerService.trialNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-trial-notice]')).toHaveCount(2);
  await expect(page.locator('[data-cargo-trial-notice]').last()).toContainText('Cargo trial convicted');
  await expect(page.locator('[data-cargo-trial-notice]').last()).toContainText('No punishment or custody authorized');
  await expect(page.locator('[data-cargo-sentencing-notice]')).toHaveCount(0);
  const { sentencingFixture, finePolicy } = require('./helpers/cargo-sentencing-fixture');
  const Laws = require('../strategic-city-laws');
  const published = Laws.createMonetaryPenaltyPolicy('notice-ui', 'b', [{ offenseId: 'contrabandCommerce', sentencing: finePolicy }]);
  const sentenced = sentencingFixture({ ...finePolicy, fineRangeCredits: published.ranges.contrabandCommerce });
  sentenced.person.courtPreferences.shareNotices = true; sentenced.untilSentence('sentence');
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.buyers[0].buyerService.sentencingNotices = notices;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, sentenced.buyer.buyerService.sentencingNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-sentencing-notice]')).toHaveCount(2);
  await expect(page.locator('[data-cargo-sentencing-notice]').last()).toContainText('stayed pending separate judgment review');
  await expect(page.locator('[data-cargo-sentencing-notice]').last()).toContainText(`fine of ${published.ranges.contrabandCommerce.minimum} credits`);
  await expect(page.locator('[data-cargo-sentencing-notice]').last()).toContainText('No payment, custody, imprisonment or enforcement authorized');
  await expect(page.locator('[data-cargo-judgment-review-notice]')).toHaveCount(0);
  const Review = require('../cargo-judgment-review');
  let reviewAt = sentenced.sentencingClock();
  for (let n = 0; n < 1600 && sentenced.d.judgmentReview?.phase !== 'decided'; n++) {
    reviewAt += 60; Review.advance(sentenced.state, sentenced.gate, reviewAt, Referrals.findings);
  }
  expect(sentenced.d.judgmentReview.decision.outcome).toBe('affirmed');
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.buyers[0].buyerService.judgmentReviewNotices = notices;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, sentenced.buyer.buyerService.judgmentReviewNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-judgment-review-notice]')).toHaveCount(2);
  await expect(page.locator('[data-cargo-judgment-review-notice]').last()).toContainText('Cargo review affirmed');
  await expect(page.locator('[data-cargo-judgment-review-notice]').last()).toContainText('No collection, arrest, custody or foreign enforcement');
  expect(await page.evaluate(() => typeof window.HelixCargoJudgmentReview.advance)).toBe('function');
  expect(errors).toEqual([]);
});
