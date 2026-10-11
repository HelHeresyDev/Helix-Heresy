const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const saved = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  await info.attach('actual-run-state', { body: Buffer.from(JSON.stringify(saved)), contentType: 'application/json' });
});
const snap = page => page.evaluate(() => window.helixHeresyDebug.publicWorksRecognitionSnapshot());
const admin = page => page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
const act = (page, action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.publicWorksRecognitionAction(action, terms), { action, terms });
const upkeep = (page, action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.cityAdministrationAction(action, terms), { action, terms });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advancePublicWorksRecognitionForTest(n), seconds);
async function visits(page) {
  if (!await page.locator('[data-public-works-recognition]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click();
}
async function ui(page, action) { await visits(page); await page.locator(`[data-public-works-recognition-action="${action}"]`).click(); }
async function reload(page) {
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload(); await page.evaluate(raw => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(raw)), saved); await visits(page);
}
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw new Error('Physical walk failed');
  });
}
async function setup(page, renderer = 'dom', policy = 'considerSuppliedCounter', disputedAppointments = false) {
  page.setDefaultTimeout(30000);
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(renderer => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: renderer })); }, renderer);
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'works-test', siteId: 'works-lab', strategicCellId: 'planet-cell:00009', seed: 'works-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.cityConfrontationAction('walk')) throw new Error('Actual walk refused');
  });
  await finishWalk(page);
  expect(await act(page, 'meet')).toBe(false);
  await page.evaluate(disputedAppointments => {
    const d = window.helixHeresyDebug;
    d.configureCityConfrontationTest(); d.configureCharterRecognitionTest({ bindInstitutions: true, policy: 'considerAdministrativeContinuity', disputedAppointmentLaw: disputedAppointments });
    d.configureIncumbentResistanceTest({ health: 48, mana: 0, policy: 'preserveLife', rulerCell: { x: 16, y: 8, z: 6 }, mastery: true });
    if (!d.incumbentResistanceAction('demand') || !d.incumbentResistanceAction('soulLash')) throw new Error('Actual coercion refused');
    if (!d.incumbentResistanceAction('accept', d.incumbentResistanceSnapshot().resistance.terms)) throw new Error('Declaration refused');
    d.advanceSimulation(60);
    if (!d.charterRecognitionAction('file')) throw new Error('Actual filing refused');
    let s = d.charterRecognitionSnapshot(); d.advanceCharterRecognitionForTest(s.recognition.review.readyAt - s.clock);
    if (!d.charterRecognitionAction('hear')) throw new Error('Actual hearing refused'); d.advanceCharterRecognitionForTest(180);
    if (!d.charterRecognitionAction('meeting')) throw new Error('Actual administrator meeting refused'); d.advanceCharterRecognitionForTest(60);
    if (!d.charterRecognitionAction('sign', d.charterRecognitionSnapshot().recognition.terms)) throw new Error('Actual continuation refused'); d.advanceCharterRecognitionForTest(60);
  }, disputedAppointments);
  expect(await page.evaluate(policy => window.helixHeresyDebug.configurePublicWorksRecognitionTest({ policy }), policy)).toBe(true);
  await visits(page);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: disputed succession permits only separately reviewed peaceful public-works replacement and supplied upkeep`, async ({ page }) => {
  test.setTimeout(300000);
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer, 'considerSuppliedCounter', true);
  await ui(page, 'meet'); await advance(page, 60); await ui(page, 'sign'); await advance(page, 60);
  const original = await snap(page);
  const appointment = () => page.evaluate(() => window.helixHeresyDebug.cityAppointmentsSnapshot());
  const appt = (action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityAppointmentsAction(action, expected), { action, expected });
  const tick = seconds => page.evaluate(n => window.helixHeresyDebug.advanceCityAdministrationForTest(n), seconds);
  expect(await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ supplies: { metalParts: 6, relayBattery: 1 } }))).toBe(true);
  expect(await upkeep(page, 'parts')).toBe(true); expect(await upkeep(page, 'battery')).toBe(true);
  expect(await page.evaluate(obstruct => window.helixHeresyDebug.configureCityAppointmentsTest({ maintenance: 50, willing: true,
    obstruct, accessPolicy: 'custodyAccountability' }), renderer === 'dom')).toBe(true);
  let s = await appointment();
  expect(s.appointments.rule.method).toBe('reviewedDisputedPublicWorksReplacement');
  expect(s.succession.handover).toBeNull(); expect(s.succession.control).toBeNull();
  const panel = page.locator('[data-city-appointments]'); await expect(panel).toContainText('peaceful, visibly inspected');
  await panel.locator('[data-appointment-action="discuss"]').click(); await tick(30); await reload(page); await tick(30);
  await panel.locator('[data-appointment-action="propose"]').click(); s = await appointment();
  expect(s.appointments.review.status).toBe('queued'); expect(await appt('hear')).toBe(false);
  await tick(s.appointments.review.readyAt - s.clock);
  await panel.locator('[data-appointment-action="hear"]').click(); await tick(90); await reload(page); await tick(90);
  s = await appointment(); expect(s.appointments.review.outcome).toBe('eligible');
  expect(await appt('appoint', { ...s.appointments.terms, scope: 'all offices' })).toBe(false);
  await panel.locator('[data-appointment-action="appoint"]').click(); await tick(60);
  s = await appointment(); expect(s.administration.workerId).toBe(s.appointments.incumbentId);
  await panel.locator('[data-appointment-action="approach"]').click(); await tick(30);
  s = await appointment(); expect(s.appointments.candidate.mapCell).toEqual(s.administration.installation.workCell);
  if (renderer === 'dom') {
    expect(await appt('transfer', s.appointments.appointment)).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.civilInstallationAction('file'))).toBe(false);
    await panel.locator('[data-appointment-action="accessReason"]').click(); await tick(60);
    await panel.locator('[data-appointment-action="accessInventory"]').click(); await tick(120);
    await panel.locator('[data-appointment-action="accessSettle"]').click(); await tick(60);
  }
  await panel.locator('[data-appointment-action="transfer"]').click(); await tick(30);
  s = await appointment(); expect(s.appointments.receipt).toBeNull();
  expect(s.succession.leaders.find(a => a.id === s.appointments.incumbentId).mapCell).toEqual({ x: 14, y: 12, z: 6 });
  await tick(60); await reload(page); await tick(60);
  s = await appointment(); expect(s.appointments.receipt.origin).toBe('peacefulDisputedAppointment');
  expect(s.administration.workerId).toBe(s.appointments.candidate.id);
  expect(s.appointments.receipt.inventory.goods).toHaveLength(1);
  expect(s.succession.handover).toBeNull(); expect(s.succession.control).toBeNull(); expect(s.succession.agreements).toEqual([]);
  expect(s.succession.provision.stock).toBe(0);
  const after = await snap(page); expect(after.charter).toEqual(original.charter); expect(after.recognition).toEqual(original.recognition);
  expect(await upkeep(page, 'inspect')).toBe(true); let u = await admin(page);
  expect(await upkeep(page, 'order', u.administration.inspection)).toBe(true); await tick(200);
  u = await admin(page); expect(u.administration.job).toBeNull();
  expect(u.administration.receipts.at(-1).personId).toBe(s.appointments.candidate.id);
  expect(u.stacks.find(i => i.civicCustody?.custodianId === s.appointments.incumbentId)?.quantity || 0).toBe(0);
  expect(await upkeep(page, 'parts')).toBe(true); u = await admin(page);
  expect(u.administration.receipts.at(-1).custodianId).toBe(s.appointments.candidate.id);
  expect(u.administration.resistance.workerId).toBe(s.appointments.candidate.id);
  expect(errors).toEqual([]);
});

for (const renderer of ['dom', 'canvas']) test(`${renderer}: separate original public works accepts, supplies and repairs the actual counter across outages, reload and absence`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer);
  const original = await snap(page), official = original.succession.leaders.find(a => a.id === original.recognition.workerId);
  const defender = (await admin(page)).bargain.defender;
  await ui(page, 'meet'); await advance(page, 30); expect((await snap(page)).recognition.job.progress).toBe(30);
  await reload(page); expect((await snap(page)).recognition.job.progress).toBe(30);
  await page.evaluate(() => window.helixHeresyDebug.configurePublicWorksRecognitionTest({ powered: false }));
  await advance(page, 600); expect((await snap(page)).recognition.job.progress).toBe(30);
  await page.evaluate(() => window.helixHeresyDebug.configurePublicWorksRecognitionTest({ powered: true }));
  await advance(page, 1); await advance(page, 30); let s = await snap(page);
  expect(s.recognition.response.decision).toBe('offered');
  expect(await act(page, 'sign', { ...s.recognition.terms, role: 'militaryDefenseCommand' })).toBe(false);
  await ui(page, 'sign'); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  s = await snap(page); expect(s.recognition.receipt).toMatchObject({ origin: 'coerced', role: 'publicWorksAndProvisioning',
    personId: official.id, recorderId: original.office.clerk.id, administrationReceiptId: original.charter.recognition.id });
  expect(s.succession.handover).toBeNull(); expect(s.succession.control).toBeNull(); expect(s.succession.agreements).toEqual([]);
  expect(s.charter.recognition).toEqual(original.charter.recognition); expect(s.office.power).toBe(original.office.power - 2);
  expect(s.office.workSeconds).toBe(original.office.workSeconds - 120);
  const receipt = s.recognition.receipt;
  expect(await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ supplies: { metalParts: 3, relayBattery: 1, fieldRation: 3 } }))).toBe(true);
  const delivered = await upkeep(page, 'parts'); let u = await admin(page);
  const { recognitions, recognitionContext, ...physicalContext } = u.context;
  const busySources = await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    return { confrontation: saved.cityConfrontation?.phase, incumbent: saved.incumbentResistance?.phase,
      challenge: saved.defenderChallenge?.phase, tasks: d.surveyExpeditionSnapshot().tasks,
      identity: saved.scientistIdentity?.job, bargain: saved.sovereignBargains?.job,
      mapService: saved.surveyExpeditions?.mapService?.job, briefing: saved.surveyExpeditions?.carrier?.briefingState?.job };
  });
  expect(delivered, JSON.stringify({ context: physicalContext, busySources, administration: u.administration })).toBe(true);
  const delivery = u.administration.receipts.find(r => r.stagedStackId), staged = u.stacks.find(i => i.id === delivery.stagedStackId);
  expect(staged).toMatchObject({ quantity: 3, cityOwnerId: 'a', cell: { x: 16, y: 12, z: 6 }, civicCustody: { custodianId: official.id, sourceStackId: delivery.stackId } });
  expect(u.succession.provision.stock).toBe(0); expect(u.bargain.defender).toEqual(defender);
  expect(u.administration.staffIds.sort()).toEqual([official.id, original.charter.administratorId, original.office.clerk.id].sort());
  expect(await upkeep(page, 'rest', defender.id)).toBe(false);
  expect(await upkeep(page, 'inspect')).toBe(true); u = await admin(page); expect(await upkeep(page, 'order', u.administration.inspection)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(10));
  await reload(page); expect((await admin(page)).administration.job).not.toBeNull();
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 14, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await admin(page)).known, knownRecognition = (await snap(page)).known;
  await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(200)); u = await admin(page);
  expect(u.administration.job).toBeNull(); expect(u.administration.receipts.filter(r => r.installationId)).toHaveLength(1);
  expect(u.known).toEqual(dated); expect((await snap(page)).known).toEqual(knownRecognition);
  expect(await upkeep(page, 'inspect')).toBe(false); expect(u.succession.provision.stock).toBe(0);
  expect((await snap(page)).recognition.receipt).toEqual(receipt);
  // Ordinary simulation finishes the defender's own return and releases its
  // confrontation reservation. This is not employment by public works.
  expect(u.bargain.defender).toEqual({ ...defender, assignment: null });
  expect(await upkeep(page, 'walk')).toBe(true); await finishWalk(page); await visits(page);
  await expect(page.locator('[data-public-works-recognition]')).toContainText('No defense reserve');
  await expect(page.locator('[data-city-administration]')).toContainText('local installation serviced');
  expect((await admin(page)).known.receipts.filter(r => r.installationId)).toHaveLength(1); expect(errors).toEqual([]);
  if (renderer === 'dom') {
    // Supply preparation creates carried goods, never a decision or renewal.
    const resist = (action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.cityResistanceAction(action, terms), { action, terms });
    const tick = seconds => page.evaluate(n => window.helixHeresyDebug.advanceCityAdministrationForTest(n), seconds);
    expect(await resist('terms')).toBe(true); u = await admin(page);
    expect(await resist('accept', u.administration.resistance.offer)).toBe(true); await tick(60);
    u = await admin(page); await tick(u.administration.graceUntil - u.clock);
    u = await admin(page); expect(u.administration.resistance.notice.remedyUntil).toBeNull();
    expect(await resist('receive')).toBe(true); await tick(28800); u = await admin(page);
    expect(u.administration.resistance.commandStatus).toBe('suspended');
    expect((await snap(page)).recognition.receipt.suspendedRoles).toEqual(['publicWorksAndProvisioning']);
    expect(await resist('review')).toBe(true); u = await admin(page);
    expect(await resist('hear')).toBe(false); await tick(u.administration.resistance.notice.review.readyAt - u.clock);
    expect(await resist('hear')).toBe(true); await tick(180);
    expect((await admin(page)).administration.resistance.notice.review.status).toBe('completed');
    await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ supplies: { metalParts: 6 } }));
    expect(await upkeep(page, 'parts')).toBe(true); expect(await upkeep(page, 'inspect')).toBe(true); u = await admin(page);
    expect(await upkeep(page, 'order', u.administration.inspection)).toBe(true); await tick(200);
    u = await admin(page); expect(u.administration.resistance.commandStatus).toBe('suspended'); expect(u.administration.job).toBeNull();
    expect(await upkeep(page, 'parts')).toBe(true); u = await admin(page);
    expect(await resist('renew', u.administration.resistance.notice.review)).toBe(true); await tick(60);
    u = await admin(page); expect(u.administration.resistance.commandStatus).toBe('active');
    expect(u.administration.resistance.renewals).toHaveLength(1); expect(u.succession.handover).toBeNull();
    expect((await snap(page)).charter.recognition).toEqual(original.charter.recognition);
    await reload(page); expect((await admin(page)).administration.resistance.renewals).toHaveLength(1);
    expect(errors).toEqual([]);
  }
});
test('original public-works refusal remains personal and stable through reload without authority, upkeep or a new supply receiver', async ({ page }) => {
  await setup(page, 'dom', 'declineCoercedContinuation'); const central = (await snap(page)).charter.recognition;
  await ui(page, 'meet'); await advance(page, 60); let s = await snap(page);
  expect(s.recognition.response.decision).toBe('refused'); expect(s.recognition.receipt).toBeNull(); expect((await admin(page)).administration).toBeNull();
  const decision = s.recognition.response; await reload(page); expect(await act(page, 'meet')).toBe(false);
  s = await snap(page); expect(s.recognition.response).toEqual(decision); expect(s.charter.recognition).toEqual(central);
  expect(await upkeep(page, 'parts')).toBe(false); expect(s.succession.control).toBeNull();
  await expect(page.locator('[data-public-works-recognition]')).toContainText('not criminal guilt');
});

for (const renderer of ['dom', 'canvas']) test(`${renderer}: public-works reaffirmation restores only its existing upkeep basis after essential offline repair and preserves the separate objection`, async ({ page }) => {
  test.setTimeout(600000);
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer);
  const civic = (action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.charterRecognitionAction(action, terms), { action, terms });
  const civicTick = n => page.evaluate(n => window.helixHeresyDebug.advanceCharterRecognitionForTest(n), n);
  const tick = n => page.evaluate(n => window.helixHeresyDebug.advanceCityAdministrationForTest(n), n);
  const resist = (action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.cityResistanceAction(action, terms), { action, terms });
  await ui(page, 'meet'); await advance(page, 60); await ui(page, 'sign');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ supplies: { metalParts: 6, relayBattery: 2 } }));
  expect(await upkeep(page, 'parts')).toBe(true);
  expect(await resist('terms')).toBe(true); let u = await admin(page);
  expect(await resist('accept', u.administration.resistance.offer)).toBe(true); await tick(60);
  expect(await resist('demandDefense')).toBe(true);
  u = await admin(page); expect(u.administration.resistance.commandStatus).toBe('suspended');
  const objection = u.administration.resistance.notice, originalWorks = (await snap(page)).recognition.receipt;
  const originalCentral = (await snap(page)).charter.recognition, installation = u.administration.installation;
  const currentRule = (await snap(page)).context.rule;
  await page.evaluate(rule => window.helixHeresyDebug.configureCharterRecognitionTest({ rule }), { ...currentRule, text: 'Authentic clarified local confirmation requirement.' });
  expect(await civic('reconsider')).toBe(true); let s = await snap(page);
  await civicTick(s.charter.reconsideration.readyAt - s.clock); expect(await civic('hearReconsideration')).toBe(true); await civicTick(180);
  expect((await snap(page)).charter.reconsideration.finding.outcome).toBe('eligible');
  expect(await act(page, 'reaffirmMeeting')).toBe(false);
  u = await admin(page); await tick(u.administration.graceUntil - u.clock);
  expect((await admin(page)).office.maintenanceReady).toBe(false); expect(await civic('reaffirmMeeting')).toBe(false);
  expect(await upkeep(page, 'battery')).toBe(true); expect(await upkeep(page, 'inspect')).toBe(true);
  u = await admin(page); expect(u.administration.inspection.essentialOnly).toBe(true);
  await page.locator('[data-administration-action="order"]').click(); await tick(10);
  expect((await admin(page)).administration.job.essentialOnly).toBe(true); await reload(page);
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ powered: false }));
  const partial = (await admin(page)).administration.job.progress;
  await tick(500); expect((await admin(page)).administration.job.progress).toBe(partial);
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ powered: true }));
  await tick(1); await tick(200); u = await admin(page);
  expect(u.office.maintenanceReady).toBe(true); expect(u.administration.job).toBeNull();
  expect(u.administration.receipts.filter(r => r.installationId)).toHaveLength(1);
  expect(u.administration.receipts.find(r => r.installationId).essentialOnly).toBe(true);
  expect(u.administration.resistance.commandStatus).toBe('suspended'); expect(u.administration.resistance.notice).toEqual(objection);
  expect((await snap(page)).known.permissionCurrent).toBe(false);
  expect(await civic('reaffirmMeeting')).toBe(true); await civicTick(60); s = await snap(page);
  expect(await civic('reaffirmSign', s.charter.reaffirmation.terms)).toBe(true); await civicTick(60);
  expect((await snap(page)).known.permissionCurrent).toBe(false);
  u = await admin(page); const dueAt = u.administration.dueAt, graceUntil = u.administration.graceUntil, custody = u.administration.receipts;
  s = await snap(page); const work = s.office.workSeconds, power = s.office.power;
  await ui(page, 'reaffirmMeeting'); await advance(page, 20); await reload(page);
  expect((await snap(page)).recognition.job.progress).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.configurePublicWorksRecognitionTest({ powered: false }));
  await advance(page, 500); expect((await snap(page)).recognition.job.progress).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.configurePublicWorksRecognitionTest({ powered: true }));
  await advance(page, 1); await advance(page, 40); s = await snap(page);
  expect(s.recognition.reaffirmation.response.decision).toBe('offered');
  expect(await act(page, 'reaffirmSign', { ...s.known.reaffirmation.terms, role: 'militaryDefense' })).toBe(false);
  await ui(page, 'reaffirmSign'); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(20)); await reload(page);
  expect((await snap(page)).recognition.reaffirmation.receipt).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(40)); s = await snap(page);
  expect(s.recognition.reaffirmation.receipt).toMatchObject({ type: 'publicWorksReaffirmation', origin: 'coerced',
    originalReceiptId: originalWorks.id, recorderId: s.office.clerk.id, role: 'publicWorksAndProvisioning', installationId: installation.id });
  expect(s.known.reaffirmationCurrent).toBe(true); expect(s.known.permissionCurrent).toBe(true);
  expect(s.recognition.receipt).toEqual(originalWorks); expect(s.charter.recognition).toEqual(originalCentral);
  expect(s.office.workSeconds).toBe(work - 120); expect(s.office.power).toBe(power - 2);
  expect(s.office.records.filter(r => r.type === 'publicWorksReaffirmation')).toHaveLength(1);
  expect(await act(page, 'reaffirmMeeting')).toBe(false); expect(await act(page, 'reaffirmSign', s.known.reaffirmation.terms)).toBe(false);
  u = await admin(page); expect(u.administration.installation).toEqual(installation);
  expect(u.administration.receipts).toEqual(custody); expect(u.administration.dueAt).toBe(dueAt); expect(u.administration.graceUntil).toBe(graceUntil);
  expect(u.administration.resistance.commandStatus).toBe('suspended'); expect(u.administration.resistance.notice).toEqual(objection);
  expect(await resist('renew', {})).toBe(false);
  expect(await resist('review')).toBe(true); u = await admin(page);
  await tick(u.administration.resistance.notice.review.readyAt - u.clock);
  expect(await resist('hear')).toBe(true); await tick(180); u = await admin(page);
  expect(u.administration.resistance.notice.review.outcome).toBe('unsupportedOrderUpheld');
  expect(u.administration.resistance.commandStatus).toBe('suspended');
  expect(await upkeep(page, 'parts')).toBe(true); u = await admin(page);
  expect(await resist('renew', u.administration.resistance.notice.review)).toBe(true); await tick(60);
  u = await admin(page); expect(u.administration.resistance.commandStatus).toBe('active');
  expect(u.administration.resistance.renewals).toHaveLength(1); expect(u.succession.handover).toBeNull(); expect(u.succession.control).toBeNull();
  await reload(page); expect((await snap(page)).recognition.reaffirmation.receipt).toEqual(s.recognition.reaffirmation.receipt);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 14, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known;
  await advance(page, 500); expect((await snap(page)).known).toEqual(dated); expect(await act(page, 'reaffirmMeeting')).toBe(false);
  expect(errors).toEqual([]);
});
