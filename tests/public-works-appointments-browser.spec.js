const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.cityAppointmentsSnapshot());
const act = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityAppointmentsAction(action, expected), { action, expected });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceCityAppointmentsForTest(n), seconds);
const admin = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityAdministrationAction(action, expected), { action, expected });
const succession = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.citySuccessionAction(action, expected), { action, expected });
const civil = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.civilInstallationAction(action, expected), { action, expected });
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw new Error(`Physical walk did not finish: ${JSON.stringify({ tasks: d.surveyExpeditionSnapshot().tasks,
      cell: d.surveyExpeditionSnapshot().scientistCell, combat: d.combatSnapshot().routineSuspension })}`);
  });
}
async function setup(page, renderer = 'dom', obstruct = false, accessPolicy = 'rejectReplacement', civilPolicy = null, combinedWorks = false, opposition = null, vacancy = false, retainedCargo = false) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(renderer => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: renderer })); }, renderer);
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'appointment-test', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'appointment-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
  });
  expect(await act(page, 'discuss')).toBe(false);
  expect(await succession(page, 'walk')).toBe(true); await finishWalk(page);
  expect(await page.evaluate(({ civilPolicy, combinedWorks, vacancy, retainedCargo }) => window.helixHeresyDebug.configureCitySuccessionTest({ retirement: true, appointmentLaw: true, combinedWorks,
    ...(retainedCargo ? { recoveryLaw: true } : {}),
    ...(vacancy ? { vacancyLaw: true, officeWork: 1800 } : {}),
    ...(civilPolicy ? { civilAccessLaw: true, officeWork: 1800 } : {}) }), { civilPolicy, combinedWorks, vacancy, retainedCargo })).toBe(true);
  expect(await succession(page, 'request')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCitySuccessionForTest(30));
  expect(await succession(page, 'hear')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCitySuccessionForTest(180));
  let s = await page.evaluate(() => window.helixHeresyDebug.citySuccessionSnapshot());
  expect(await succession(page, 'sign', s.succession.terms)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.configureSovereignBargainTest({ supply: 18, carried: true }));
  expect(await succession(page, 'deliver')).toBe(true); s = await page.evaluate(() => window.helixHeresyDebug.citySuccessionSnapshot());
  for (const a of [...s.succession.leaders, s.bargain.defender]) {
    expect(await succession(page, 'agree', a.id)).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceCitySuccessionForTest(60));
  }
  expect(await succession(page, 'handover')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCitySuccessionForTest(180));
  expect(await succession(page, 'directive')).toBe(true);
  await page.evaluate(() => { window.helixHeresyDebug.advanceCitySuccessionForTest(60); window.helixHeresyDebug.advanceCitySuccessionForTest(30); });
  // Extra attended operations require a genuinely delivered finite battery,
  // not a work/power refill or an invented appointment outcome.
  const needsSafeguardCapacity = opposition?.renewSafeguards != null;
  await page.evaluate(needsRest => window.helixHeresyDebug.configureCityAdministrationTest({ supplies: { relayBattery: 1,
    ...(needsRest ? { fieldRation: 1 } : {}) } }), needsSafeguardCapacity);
  expect(await admin(page, 'battery')).toBe(true);
  if (needsSafeguardCapacity) {
    expect(await admin(page, 'rest', s.office.clerk.id)).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(28800));
  }
  const configured = await page.evaluate(({ obstruct, accessPolicy, civilPolicy, opposition, vacancy, retainedCargo }) => window.helixHeresyDebug.configureCityAppointmentsTest({ maintenance: 50, willing: true, obstruct, accessPolicy,
    ...(vacancy && !retainedCargo ? { incumbentHealth: 1 } : {}),
    organize: Boolean(opposition), ...(opposition || {}),
    ...(civilPolicy ? { civilPolicy, resistanceStrength: 20 } : {}) }), { obstruct, accessPolicy, civilPolicy, opposition, vacancy, retainedCargo });
  const diagnostic = configured ? null : await snap(page);
  expect(configured, JSON.stringify({ appointments: diagnostic?.appointments, context: diagnostic && {
    atCounter: diagnostic.context.atCounter, busy: diagnostic.context.busy, rule: diagnostic.context.appointmentRule,
    institution: diagnostic.context.appointmentOffice }, ground: configured ? null : await page.evaluate(() => window.helixHeresyDebug.cityAppointmentGroundSnapshot()) })).toBe(true);
  expect((await page.evaluate(() => window.helixHeresyDebug.cityAppointmentGroundSnapshot())).load).toBe(.6);
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) for (const retainedCargo of [false, true]) test(`${renderer}: ${retainedCargo ? 'retained cargo recovery after ' : ''}death vacancy uses actual combat death, emergency hearing and physical supplied maintenance`, async ({ page }) => {
  if (retainedCargo) test.setTimeout(480000); // Includes real succession, vacancy, recovery and fresh repair, not injected outcomes.
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, renderer, false, 'rejectReplacement', null, false, null, true, retainedCargo);
  let s = await snap(page);
  const original = { candidate: s.appointments.candidate.id, handover: s.succession.handover,
    agreements: s.succession.agreements, stock: s.succession.provision.stock, dueAt: s.administration.dueAt,
    graceUntil: s.administration.graceUntil };
  expect(await act(page, 'vacancyObserve')).toBe(false);
  if (retainedCargo) {
    expect(await admin(page, 'inspect')).toBe(true); s = await snap(page);
    expect(await admin(page, 'order', s.administration.inspection)).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(1));
    s = await snap(page); expect(s.administration.job.cargo.quantity).toBe(3); expect(s.administration.job.progress).toBe(0);
    expect(await page.evaluate(() => window.helixHeresyDebug.configureCityAppointmentsTest({ incumbentHealth: 1 }))).toBe(true);
  }
  s = await snap(page); const old = s.succession.leaders.find(a => a.id === s.appointments.incumbentId);
  // Only initial bodily condition was prepared. Ordinary walking and combat
  // must produce death; no vacancy, testimony, signature or transfer is inserted.
  await page.evaluate(() => window.helixHeresyDebug.configureDefenderChallengeTest({ mastery: true }));
  expect(await page.evaluate(cell => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround',
    { toCell: { ...cell, x: cell.x + 1 }, allowMultiRoom: true })), old.mapCell)).toBe(true);
  await finishWalk(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('strike', id), old.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3));
  s = await snap(page); const remains = s.succession.leaders.find(a => a.id === old.id);
  expect(remains.status).toBe('dead'); expect(remains.health).toBe(0); expect(s.appointments.vacancy).toBeUndefined();
  expect(await page.evaluate(cell => window.helixHeresyDebug.physicalStockSnapshot().tileOccupancy(cell).occupiedM2, remains.mapCell)).toBeGreaterThanOrEqual(.6);
  expect(await succession(page, 'walk')).toBe(true); await finishWalk(page);
  s = await snap(page); expect(s.context.deathVisible).toBe(true);
  await page.evaluate(seconds => window.helixHeresyDebug.advanceCityAdministrationForTest(seconds), original.graceUntil + 1 - s.clock);
  expect((await snap(page)).office.maintenanceReady).toBe(false);
  const panel = page.locator('[data-city-appointments]');
  await panel.locator('[data-appointment-action="vacancyObserve"]').click(); await advance(page, 15);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 15);
  s = await snap(page); expect(s.appointments.vacancy.death.evidence.personId).toBe(old.id);
  await panel.locator('[data-appointment-action="vacancyDiscuss"]').click(); await advance(page, 60);
  await panel.locator('[data-appointment-action="vacancyPropose"]').click(); s = await snap(page);
  expect(await act(page, 'vacancyHear')).toBe(false);
  await page.evaluate(n => window.helixHeresyDebug.advanceCityAdministrationForTest(n), s.appointments.vacancy.review.readyAt - s.clock);
  await panel.locator('[data-appointment-action="vacancyHear"]').click(); await advance(page, 90);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 90);
  s = await snap(page); expect(s.appointments.vacancy.review.outcome).toBe('eligible');
  expect(s.office.maintenanceReady).toBe(false); expect(s.administration.workerId).toBe(old.id);
  expect(await act(page, 'vacancyAppoint', { ...s.appointments.vacancy.terms, workCap: 9000 })).toBe(false);
  await panel.locator('[data-appointment-action="vacancyAppoint"]').click(); await advance(page, 60);
  await panel.locator('[data-appointment-action="vacancyApproach"]').click(); await advance(page, 30);
  s = await snap(page); expect(s.appointments.candidate.mapCell).toEqual(s.administration.installation.workCell);
  await panel.locator('[data-appointment-action="vacancyTransfer"]').click(); await advance(page, 60);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 60);
  s = await snap(page); expect(s.appointments.vacancy.receipt.origin).toBe('reviewedDeathVacancy');
  expect(s.administration.workerId).toBe(original.candidate); expect(s.appointments.candidate.id).toBe(original.candidate);
  expect(s.succession.handover).toEqual(original.handover); expect(s.succession.agreements).toEqual(original.agreements);
  expect(s.succession.provision.stock).toBe(original.stock); expect(s.administration.dueAt).toBe(original.dueAt);
  expect(s.office.maintenanceReady).toBe(false);
  if (!retainedCargo) {
    expect(s.appointments.vacancy.receipt.inventory.goods.length).toBeGreaterThan(0);
    expect(s.context.stagedSupplyReachable).toBe(false);
  } else {
    expect(s.appointments.vacancy.receipt.inventory.deceasedCargo.quantity).toBe(3);
    const adminPanel = page.locator('[data-city-administration]');
    await adminPanel.locator('[data-administration-action="recoveryInspect"]').click();
    let r = (await snap(page)).administration.cargoRecovery;
    expect(r.inspection.proof.cargo.quantity).toBe(3);
    expect(await admin(page, 'recoveryAuthorize', { ...r.inspection, scope: 'private confiscation' })).toBe(false);
    await adminPanel.locator('[data-administration-action="recoveryAuthorize"]').click();
    await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(15));
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(15));
    r = (await snap(page)).administration.cargoRecovery; expect(r.order).toBeTruthy(); expect(r.collection).toBeNull();
    await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(31));
    r = (await snap(page)).administration.cargoRecovery; expect(r.collection).toBeNull();
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(90));
    s = await snap(page); r = s.administration.cargoRecovery;
    expect(r.receipt, JSON.stringify({ phase: r.job?.phase, progress: r.job?.progress,
      cell: s.appointments.candidate.mapCell, collected: Boolean(r.collection), capacity: s.context.recoveryCanCarry })).toBeTruthy();
    const lot = (await page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot())).stacks.find(i => i.id === r.collection.stackId);
    expect(lot.carriedBy).toBe(original.candidate); expect(lot.cityOwnerId).toBe('a'); expect(lot.quantity).toBe(3);
    expect(s.succession.leaders.find(a => a.id === old.id).civicMaintenanceCargo).toBeNull();
    expect(s.succession.provision.stock).toBe(original.stock); expect(s.office.maintenanceReady).toBe(false);
    expect(await admin(page, 'recoveryInspect')).toBe(false);
  }
  expect(s.succession.leaders.find(a => a.id === old.id).mapCell).toEqual(remains.mapCell);
  expect(await admin(page, 'inspect')).toBe(true);
  let a = await page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
  expect(await admin(page, 'order', a.administration.inspection), JSON.stringify({ context: a.context,
    candidate: a.succession.appointments.candidate, defender: a.bargain.defender })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(180));
  a = await page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
  expect(a.administration.job).toBeNull(); expect(a.office.maintenanceReady).toBe(true);
  expect(a.administration.receipts.find(r => r.installationId).personId).toBe(original.candidate);
  expect(a.administration.receipts.find(r => r.installationId).source.kind).toBe(retainedCargo ? 'recovered' : 'reserve');
  expect(a.succession.provision.stock).toBe(original.stock - (retainedCargo ? 0 : 3));
  if (retainedCargo) {
    expect(a.administration.cargoRecovery.consumed.quantity).toBe(3);
    expect(a.succession.leaders.find(a => a.id === old.id).mapCell).toEqual(remains.mapCell);
  }
  await expect(panel).toContainText('Physical vacancy transfer recorded');
  expect(errors).toEqual([]);
});
async function reviewed(page) {
  const panel = page.locator('[data-city-appointments]');
  await panel.locator('[data-appointment-action="discuss"]').click();
  expect((await snap(page)).appointments.job?.kind).toBe('discuss');
  await advance(page, 60);
  let s = await snap(page);
  expect(await act(page, 'propose', { ...s.appointments.dossier, willing: false })).toBe(false);
  await panel.locator('[data-appointment-action="propose"]').click();
  s = await snap(page); expect(s.appointments.review.status).toBe('queued');
  expect(await act(page, 'hear')).toBe(false);
  await advance(page, s.appointments.review.readyAt - s.clock);
  await panel.locator('[data-appointment-action="hear"]').click();
  expect((await snap(page)).appointments.job?.kind).toBe('review');
  await advance(page, 180); s = await snap(page);
  expect(s.appointments.review.outcome).toBe('eligible');
  expect(s.appointments.appointment).toBeNull();
  expect(await act(page, 'appoint', { ...s.appointments.terms, workCap: 999999 })).toBe(false);
  await panel.locator('[data-appointment-action="appoint"]').click(); await advance(page, 60);
  s = await snap(page); expect(s.appointments.appointment).not.toBeNull();
  expect(s.administration.workerId).toBe(s.appointments.incumbentId);
  expect(s.office.publicWorksAppointments).toHaveLength(1);
  await panel.locator('[data-appointment-action="approach"]').click(); await advance(page, 30);
  s = await snap(page);
  expect(s.appointments.travel, JSON.stringify({ candidate: s.appointments.candidate, context: s.context })).toBeNull();
  expect(s.appointments.candidate.mapCell).toEqual(s.administration.installation.workCell);
  expect(s.appointments.receipt).toBeNull(); return s;
}
async function civilOrder(page) {
  await reviewed(page); const s = await snap(page);
  expect(await act(page, 'transfer', s.appointments.appointment)).toBe(false);
  const panel = page.locator('[data-civil-access]');
  await panel.locator('[data-civil-access-action="file"]').click();
  let e = (await snap(page)).appointments.enforcement;
  expect(e.review.status).toBe('queued');
  expect(await civil(page, 'hear')).toBe(false);
  await advance(page, e.review.readyAt - (await snap(page)).clock);
  await panel.locator('[data-civil-access-action="hear"]').click(); await advance(page, 180);
  e = (await snap(page)).appointments.enforcement;
  expect(e.order).not.toBeNull(); expect(e.release).toBeNull();
  await panel.locator('[data-civil-access-action="discuss"]').click(); await advance(page, 60);
  return panel;
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: safeguard breach requires actual removal, received evidence, independent review and explicit watch consent`, async ({ page }) => {
  test.setTimeout(600000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const before = await oppositionReady(page, renderer, true, { oldDefense: 'flee', watchDefense: 'flee', renewSafeguards: renderer === 'dom' });
  const panel = page.locator('[data-local-opposition]');
  await panel.locator('[data-opposition-action="discuss"]').click(); await advance(page, 60);
  await panel.locator('[data-opposition-action="accept"]').click(); await advance(page, 80);
  let s = await snap(page); expect(s.appointments.opposition.phase).toBe('ended');
  const account = s.appointments.opposition.settlement, watchId = account.memberIds[1];
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ supplies: { relayBattery: 1 } }));
  expect(await admin(page, 'battery')).toBe(true);
  let w = await page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot());
  expect(w.recognition.receipt.origin).toBe('voluntaryHandover'); expect(w.known.permissionCurrent).toBe(true);
  const ordered = await page.evaluate(t => window.helixHeresyDebug.watchRecognitionAction('order', t), w.known.instructionTerms);
  w = await page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot());
  expect(ordered, JSON.stringify({ context: { ...w.context, upkeep: undefined, rule: undefined, conduct: undefined },
    actor: w.succession.leaders.find(a => a.id === watchId), office: { power: w.office.power, work: w.office.workSeconds,
      assignment: w.office.assignment, clerk: w.office.clerk, availableAt: w.office.availableAt }, recognition: w.recognition })).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.advanceSimulation(30); d.advanceWatchRecognitionForTest(25); });
  w = await page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot()); expect(w.recognition.duty.status).toBe('observing');
  // Ordinary personal skill preparation only; no incident or displacement is inserted.
  await page.evaluate(() => window.helixHeresyDebug.configureDefenderChallengeTest({ mastery: true }));
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround',
    { toCell: { x: 18, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true); await finishWalk(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('shove', id), watchId)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  s = await snap(page); expect(s.appointments.opposition.safeguards.reports).toEqual([]);
  // The eastward shove hits the actual map boundary. No displacement means
  // no fabricated promise breach. Recover and physically choose mapped ground.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3));
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround',
    { toCell: { x: 19, y: 9, z: 6 }, allowMultiRoom: true, urgent: true })))).toBe(true); await finishWalk(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('shove', id), watchId)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  s = await snap(page); expect(s.appointments.opposition.safeguards.reports.length).toBeGreaterThan(0);
  expect(s.appointments.opposition.safeguards.received).toEqual([]);
  expect(s.appointments.opposition.safeguards.reports.every(r => JSON.stringify(r.from) !== JSON.stringify(r.to))).toBe(true);
  expect(await succession(page, 'walk')).toBe(true); await finishWalk(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceWatchRecognitionForTest(25));
  w = await page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot());
  expect(w.recognition.duty).toBeNull(); expect(w.recognition.deliveries[0].status).toBe('interruptedReturn');
  expect(w.known.permissionCurrent).toBe(false);
  expect(await page.evaluate(t => window.helixHeresyDebug.watchRecognitionAction('order', t), w.known.instructionTerms)).toBe(false);
  await expect(panel).toContainText('cooperation: withdrawn');
  // Receive each actual witness separately; no omniscient report import.
  for (let i = 0; i < 2; i++) {
    s = await snap(page);
    if (s.appointments.opposition.safeguards.received.length === s.appointments.opposition.safeguards.reports.length) break;
    await panel.locator('[data-opposition-action="receiveSafeguards"]').click(); await advance(page, 15);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 15);
  }
  s = await snap(page); expect(s.appointments.opposition.safeguards.received.length).toBe(s.appointments.opposition.safeguards.reports.length);
  await panel.locator('[data-opposition-action="fileSafeguards"]').click(); await advance(page, 30);
  s = await snap(page); const complaint = s.appointments.opposition.safeguards.reviews[0]; expect(complaint.status).toBe('queued');
  // No movement, attendance or encounter remains during this idle queue wait.
  // Advance the same actual deadline through the existing upkeep clock helper.
  await page.evaluate(seconds => window.helixHeresyDebug.advanceCityAdministrationForTest(seconds), complaint.readyAt - s.clock);
  await panel.locator('[data-opposition-action="hearSafeguards"]').click(); await advance(page, 180);
  s = await snap(page); expect(s.appointments.opposition.safeguards.reviews[0].finding.outcome).toBe('breachUpheld');
  expect((await page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot())).known.permissionCurrent).toBe(false);
  await panel.locator('[data-opposition-action="meetSafeguards"]').click(); await advance(page, 60);
  s = await snap(page); const response = s.appointments.opposition.safeguards.renewalResponses[0];
  if (renderer === 'dom') {
    expect(response.decision).toBe('offered');
    expect(await page.evaluate(t => window.helixHeresyDebug.localOppositionAction('signSafeguards', { ...t, scope: 'army' }), response.terms)).toBe(false);
    await panel.locator('[data-opposition-action="signSafeguards"]').click(); await advance(page, 30);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 30);
    w = await page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot()); expect(w.known.permissionCurrent).toBe(true);
  } else {
    expect(response.decision).toBe('refused');
    expect(await page.evaluate(() => window.helixHeresyDebug.localOppositionAction('meetSafeguards'))).toBe(false);
  }
  s = await snap(page); expect(s.appointments.opposition.settlement).toEqual(account);
  expect(s.appointments.receipt).toEqual(before.appointments.receipt); expect(s.succession.agreements).toEqual(before.succession.agreements);
  expect(s.succession.provision).toEqual(before.succession.provision);
  expect(s.appointments.opposition.safeguards.reviews).toHaveLength(1); expect(s.office.localOppositionAccounts).toHaveLength(1);
  expect(errors).toEqual([]);
});

async function oppositionReady(page, renderer = 'dom', settle = true, defense = {}) {
  await setup(page, renderer, true, 'rejectReplacement', 'considerCivilEscort', false,
    { joinOpposition: true, settleOpposition: settle, ...defense });
  const panel = await civilOrder(page); let s = await snap(page);
  expect(await civil(page, 'sign', s.appointments.enforcement.terms)).toBe(true); await advance(page, 60);
  expect(await civil(page, 'serve')).toBe(true); await advance(page, 120);
  expect(await civil(page, 'escort')).toBe(true); await advance(page, 45);
  s = await snap(page); expect(s.appointments.enforcement.release).not.toBeNull();
  await panel.locator('[data-civil-access-action="transfer"]').click(); await advance(page, 120);
  s = await snap(page); expect(s.appointments.receipt.origin).toBe('compulsoryCivilAccess');
  await advance(page, 85); s = await snap(page);
  expect(s.appointments.opposition.phase, JSON.stringify(s.appointments.opposition)).toBe('protesting');
  expect(s.succession.leaders.find(a => a.id === s.appointments.incumbentId).mapCell).toEqual({ x: 16, y: 12, z: 6 });
  await expect(page.locator('[data-local-opposition]')).toContainText('earlier civil order does not authorize clearing this new protest');
  return s;
}
test('DOM: organized opposition physically blocks original supplies then accepts a saved witnessed account and actually withdraws', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const before = await oppositionReady(page), panel = page.locator('[data-local-opposition]');
  expect(await admin(page, 'inspect')).toBe(true);
  let s = await snap(page); expect(await admin(page, 'order', s.administration.inspection)).toBe(true);
  await advance(page, 15); s = await snap(page);
  expect(s.administration.job.status).toBe('collecting'); expect(s.administration.job.cargo).toBeNull();
  expect(s.administration.workerId).toBe(s.appointments.candidate.id);
  expect(s.succession.provision).toEqual(before.succession.provision);
  await panel.locator('[data-opposition-action="discuss"]').click(); await advance(page, 30);
  expect((await snap(page)).appointments.opposition.response).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 30);
  s = await snap(page); expect(s.appointments.opposition.offer).not.toBeNull();
  expect(await page.evaluate(offer => window.helixHeresyDebug.localOppositionAction('accept', { ...offer, promise: 'immunity' }), s.appointments.opposition.offer)).toBe(false);
  await panel.locator('[data-opposition-action="accept"]').click(); await advance(page, 30);
  expect((await snap(page)).office.localOppositionAccounts).toBeUndefined();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 30);
  s = await snap(page); expect(s.office.localOppositionAccounts).toHaveLength(1);
  expect(s.appointments.opposition.phase).toBe('withdrawing');
  expect(s.succession.leaders.find(a => a.id === s.appointments.incumbentId).mapCell).toEqual({ x: 16, y: 12, z: 6 });
  await advance(page, 180); s = await snap(page);
  expect(s.appointments.opposition.phase).toBe('ended'); expect(s.administration.job).toBeNull();
  expect(s.office.localOppositionAccounts).toHaveLength(1);
  expect(s.appointments.receipt).toEqual(before.appointments.receipt); expect(s.succession.agreements).toEqual(before.succession.agreements);
  expect(s.succession.provision).toEqual(before.succession.provision);
  expect(s.succession.leaders.find(a => a.id === s.appointments.incumbentId).health).toBe(before.succession.leaders.find(a => a.id === s.appointments.incumbentId).health);
  await expect(panel).toContainText('Both original people physically withdrew'); expect(errors).toEqual([]);
});
test('Canvas: organized opposition keeps categorical refusal, dated away knowledge and ordinary human combat consequences', async ({ page }) => {
  // This scenario physically executes the full succession, appointment and
  // enforcement route before exercising ordinary combat and walking away.
  test.setTimeout(420000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const before = await oppositionReady(page, 'canvas', false), panel = page.locator('[data-local-opposition]');
  await panel.locator('[data-opposition-action="discuss"]').click(); await advance(page, 60);
  let s = await snap(page); expect(s.appointments.opposition.response.decision).toBe('refused'); expect(s.appointments.opposition.offer).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect(await page.evaluate(() => window.helixHeresyDebug.localOppositionAction('discuss'))).toBe(false);
  const watchId = s.appointments.opposition.memberIds[1], watch = s.succession.leaders.find(a => a.id === watchId);
  // A prepared range/accuracy context permits testing ordinary injury without
  // bypassing the original protest, source evidence or opposition decision.
  await page.evaluate(() => window.helixHeresyDebug.configureDefenderChallengeTest({ mastery: true }));
  const attacked = await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), watchId);
  expect(attacked).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(8));
  s = await snap(page); const afterWatch = s.succession.leaders.find(a => a.id === watchId);
  expect(afterWatch.health).toBeLessThan(watch.health); expect(s.appointments.opposition.reports.length).toBeGreaterThan(0);
  const physical = await page.evaluate(() => window.helixHeresyDebug.civilInstallationSnapshot());
  expect(physical.injuries.some(i => i.actorId === watchId && i.actorKind === 'civicOfficeholder')).toBe(true);
  expect(s.appointments.receipt).toEqual(before.appointments.receipt); expect(s.office.localOppositionAccounts).toBeUndefined();
  expect(await civil(page, 'escort')).toBe(false);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround',
    { toCell: { x: 8, y: 8, z: 6 }, allowMultiRoom: true })))).toBe(true); await finishWalk(page);
  const dated = (await page.evaluate(() => window.helixHeresyDebug.localOppositionSnapshot())).known;
  await advance(page, 120); expect((await page.evaluate(() => window.helixHeresyDebug.localOppositionSnapshot())).known).toEqual(dated);
  expect(errors).toEqual([]);
});
for (const renderer of ['dom', 'canvas']) test(`${renderer}: defensive resistance uses witnessed aggression, saved visible windups, ordinary injury and actual departure`, async ({ page }) => {
  test.setTimeout(480000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const before = await oppositionReady(page, renderer, true, { oldDefense: 'coverRetreat', watchDefense: 'defendSelf' });
  const panel = page.locator('[data-local-opposition]');
  expect(before.appointments.opposition.defense).toBeUndefined();
  await expect(panel).toContainText('Peaceful opposition does not initiate combat');
  const watchId = before.appointments.opposition.memberIds[1];
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround',
    { toCell: { x: 17, y: 11, z: 6 }, allowMultiRoom: true })))).toBe(true); await finishWalk(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('strike', id), watchId)).toBe(true);
  let s = await snap(page);
  expect(s.appointments.opposition.defense.phase).toBe('active');
  const watch = s.succession.leaders.find(a => a.id === watchId), stamina = watch.physicalControl.stamina;
  expect(s.appointments.opposition.defense.participants.find(p => p.actorId === watchId).pending).toBeNull();
  await advance(page, 1); s = await snap(page);
  const pending = s.appointments.opposition.defense.participants.find(p => p.actorId === watchId).pending;
  expect(pending).not.toBeNull(); expect(pending.releaseAt - pending.startedAt).toBe(2);
  await expect(panel).toContainText('unarmed strike preparing; move or guard');
  const healthBefore = await page.evaluate(() => window.helixHeresyDebug.defenderChallengeSnapshot().scientist.health);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  s = await snap(page); expect(s.appointments.opposition.defense.participants.find(p => p.actorId === watchId).pending).toEqual(pending);
  if (renderer === 'canvas') expect(await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(true))).toBe(true);
  await advance(page, 2); s = await snap(page);
  const outcome = s.appointments.opposition.defense.participants.find(p => p.actorId === watchId).lastOutcome;
  expect(outcome.result).toBe('hit'); expect(outcome.damage).toBeGreaterThan(0);
  if (renderer === 'canvas') {
    const baseDamage = await page.evaluate(() => window.helixHeresyDebug.combatSnapshot().actions.strike.baseDamage);
    expect(outcome.damage).toBeLessThanOrEqual(Math.max(1, Math.round(baseDamage * .65)));
    expect(await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(false))).toBe(true);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.defenderChallengeSnapshot().scientist.health)).toBeLessThan(healthBefore);
  expect(s.succession.leaders.find(a => a.id === watchId).physicalControl.stamina).toBeLessThan(stamina);
  const injuries = (await page.evaluate(() => window.helixHeresyDebug.civilInstallationSnapshot())).injuries;
  expect(injuries.some(i => i.actorId === 'scientist' && i.status === 'active')).toBe(true);
  expect(injuries.some(i => i.actorId === watchId && i.actorKind === 'civicOfficeholder')).toBe(true);
  expect(s.appointments.receipt).toEqual(before.appointments.receipt);
  expect(s.succession.agreements).toEqual(before.succession.agreements);
  expect(await civil(page, 'escort')).toBe(false);
  // Ordinary movement, not a debug relocation or an abstract retreat button.
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround',
    { toCell: { x: 8, y: 8, z: 6 }, allowMultiRoom: true })))).toBe(true); await finishWalk(page);
  s = await snap(page); expect(s.appointments.opposition.defense.phase).not.toBe('active');
  expect(s.appointments.opposition.defense.participants.every(p => !p.pending && !p.guardUntil)).toBe(true);
  const dated = (await page.evaluate(() => window.helixHeresyDebug.localOppositionSnapshot())).known;
  await advance(page, 30); expect((await page.evaluate(() => window.helixHeresyDebug.localOppositionSnapshot())).known).toEqual(dated);
  if (renderer === 'dom') {
    // Prepared personal mastery only, followed by ordinary attacks. There is
    // no health mutation, spawned corpse, fabricated victory or forced outcome.
    expect(await page.evaluate(() => window.helixHeresyDebug.configureDefenderChallengeTest({ mastery: true }))).toBe(true);
    expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround',
      { toCell: { x: 14, y: 11, z: 6 }, allowMultiRoom: true })))).toBe(true); await finishWalk(page);
    const oldId = before.appointments.incumbentId;
    const remains = await page.evaluate(id => {
      const d = window.helixHeresyDebug;
      for (let i = 0; i < 12; i++) {
        const actor = d.cityAppointmentsSnapshot().succession.leaders.find(a => a.id === id);
        if (actor.status === 'dead') return actor;
        if (!d.startScientistCombatAction('strike', id)) throw new Error('Actual lethal strike unavailable');
        d.advanceCityAppointmentsForTest(2);
      }
      throw new Error('Normal combat unexpectedly preserved a health floor');
    }, oldId);
    expect(remains.health).toBe(0); expect(remains.mapCell).toEqual(before.appointments.opposition.homes[0]);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    const saved = (await snap(page)).succession.leaders.find(a => a.id === oldId);
    expect(saved.status).toBe('dead'); expect(saved.mapCell).toEqual(remains.mapCell);
    const ground = await page.evaluate(cell => window.helixHeresyDebug.citySuccessionNavigationSnapshot(cell), remains.mapCell);
    expect(ground.find(a => a.id === watchId).targetLoad).toBeGreaterThanOrEqual(.6);
    expect((await snap(page)).appointments.receipt).toEqual(before.appointments.receipt);
    expect((await page.evaluate(() => window.helixHeresyDebug.runLifecycleSnapshot())).phase).not.toBe('ended');
  }
  expect(errors).toEqual([]);
});
test('DOM: combined directorate physically reassigns only public works across reload and retains emergency authority and supplied upkeep', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'dom', false, 'rejectReplacement', null, true);
  let s = await reviewed(page); const before = s, panel = page.locator('[data-city-appointments]');
  expect(s.appointments.rule.method).toBe('reviewedCombinedPublicWorksReassignment');
  expect(s.succession.leaders.find(a => a.id === s.appointments.incumbentId).roles).toEqual(['emergencyManagement', 'publicWorksAndProvisioning']);
  expect(s.appointments.receipt).toBeNull(); await expect(panel).toContainText('original official retains emergency management');
  await panel.locator('[data-appointment-action="transfer"]').click(); await advance(page, 60);
  expect((await snap(page)).appointments.receipt).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 70);
  s = await snap(page); const old = s.succession.leaders.find(a => a.id === s.appointments.incumbentId);
  expect(s.appointments.receipt.roleDivision.retainedRoles).toEqual(['emergencyManagement']);
  expect(s.appointments.receipt.roleDivision.outgoingSignerId).toBe(old.id); expect(s.appointments.receipt.roleDivision.inventory.goods[0].quantity).toBe(3);
  expect(old.roles).toEqual(['emergencyManagement']); expect(old.officeStatus.status).toBe('publicWorksRoleReassigned');
  expect(s.appointments.candidate.roles).toEqual(['publicWorksAndProvisioning']); expect(s.administration.workerId).toBe(s.appointments.candidate.id);
  expect(s.source).toEqual(before.source); expect(s.succession.agreements).toEqual(before.succession.agreements);
  expect(s.succession.provision).toEqual(before.succession.provision); expect(s.administration.dueAt).toBe(before.administration.dueAt);
  expect(s.office.publicWorksTransfers).toHaveLength(1); await expect(panel).toContainText('Physical transfer recorded');
  expect(await admin(page, 'inspect')).toBe(true);
  const u = await page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
  expect(await admin(page, 'order', u.administration.inspection)).toBe(true); await advance(page, 180);
  s = await snap(page); expect(s.administration.receipts.at(-1).personId).toBe(s.appointments.candidate.id);
  expect(s.succession.provision.stock).toBe(before.succession.provision.stock);
  const received = await page.evaluate(() => window.helixHeresyDebug.cityResistanceAction('terms'));
  expect(received, JSON.stringify((await snap(page)).administration.resistance)).toBe(true);
  expect((await snap(page)).administration.resistance.workerId).toBe(s.appointments.candidate.id);
  expect(errors).toEqual([]);
});
test('Canvas: combined directorate refusal persists without role loss, forced release or away intelligence', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'canvas', true, 'rejectReplacement', null, true); let s = await reviewed(page);
  expect(await act(page, 'transfer', s.appointments.appointment)).toBe(false);
  const before = await snap(page); expect(before.appointments.phase).toBe('obstructed');
  expect(await civil(page, 'file')).toBe(false); expect((await snap(page)).appointments.enforcement).toBeNull();
  await expect(page.locator('[data-civil-access]')).toHaveCount(0);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).appointments.obstruction).toEqual(before.appointments.obstruction);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known; await advance(page, 180); s = await snap(page);
  expect(s.known).toEqual(dated); expect(s.appointments.receipt).toBeNull(); expect(s.administration.workerId).toBe(before.administration.workerId);
  expect(s.succession.leaders.find(a => a.id === s.appointments.incumbentId).roles).toEqual(['emergencyManagement', 'publicWorksAndProvisioning']);
  expect(s.succession.agreements).toEqual(before.succession.agreements); expect(s.succession.provision).toEqual(before.succession.provision);
  expect(errors).toEqual([]);
});
test('DOM: civil access requires separate consent and physical escort before an unsigned outgoing transfer across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'dom', true, 'rejectReplacement', 'considerCivilEscort');
  const panel = await civilOrder(page), before = await snap(page);
  expect(before.appointments.enforcement.response.decision).toBe('offered');
  expect(await civil(page, 'sign', { ...before.appointments.enforcement.terms, missionSeconds: 99999 })).toBe(false);
  await panel.locator('[data-civil-access-action="sign"]').click(); await advance(page, 60);
  await panel.locator('[data-civil-access-action="serve"]').click(); await advance(page, 60);
  expect(await civil(page, 'escort')).toBe(false); await advance(page, 60);
  await panel.locator('[data-civil-access-action="escort"]').click(); await advance(page, 10);
  let s = await snap(page), e = s.appointments.enforcement;
  expect(e.escort.status).toBe('active'); expect(e.release).toBeNull(); expect(s.appointments.receipt).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 30);
  s = await snap(page); e = s.appointments.enforcement;
  expect(e.escort.status, JSON.stringify(e)).toBe('released'); expect(e.release.steps).toBe(2);
  expect(s.appointments.receipt).toBeNull(); expect(s.office.civilAccessReleases).toHaveLength(1);
  const physical = await page.evaluate(() => window.helixHeresyDebug.civilInstallationSnapshot());
  expect(physical.injuries.some(i => i.actorKind === 'civicOfficeholder' && i.actorId === s.appointments.incumbentId)).toBe(true);
  expect(s.succession.leaders.find(a => a.id === s.appointments.incumbentId).mapCell).toEqual({ x: 14, y: 12, z: 6 });
  await panel.locator('[data-civil-access-action="transfer"]').click(); await advance(page, 60);
  expect((await snap(page)).appointments.receipt).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 70);
  s = await snap(page);
  expect(s.appointments.receipt.origin).toBe('compulsoryCivilAccess'); expect(s.appointments.receipt.accessSettlementId).toBeUndefined();
  expect(s.appointments.access.settlement).toBeNull(); expect(s.office.publicWorksTransfers).toHaveLength(1);
  expect(s.administration.workerId).toBe(s.appointments.candidate.id);
  expect(s.appointments.appointment).toEqual(before.appointments.appointment); expect(s.appointments.obstruction).toEqual(before.appointments.obstruction);
  expect(s.succession.agreements).toEqual(before.succession.agreements); expect(s.succession.provision).toEqual(before.succession.provision);
  expect(s.administration.dueAt).toBe(before.administration.dueAt);
  await expect(panel).toContainText('signed no voluntary consent');
  expect(await admin(page, 'inspect')).toBe(true);
  const u = await page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
  expect(await admin(page, 'order', u.administration.inspection)).toBe(true); await advance(page, 180);
  s = await snap(page); expect(s.administration.receipts.at(-1).personId).toBe(s.appointments.candidate.id);
  expect(s.succession.provision.stock).toBe(before.succession.provision.stock); expect(errors).toEqual([]);
});
test('Canvas: civil access defender refusal persists without removal, replacement guards or away intelligence', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'canvas', true, 'rejectReplacement', 'declineCivilEscort');
  const panel = await civilOrder(page), before = await snap(page);
  expect(before.appointments.enforcement.response.decision).toBe('refused');
  expect(before.appointments.enforcement.commission).toBeNull(); expect(await civil(page, 'discuss')).toBe(false);
  expect(await civil(page, 'escort')).toBe(false); await expect(panel).toContainText('No replacement guard');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).appointments.enforcement.response).toEqual(before.appointments.enforcement.response);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known; await advance(page, 180);
  const s = await snap(page); expect(s.known).toEqual(dated); expect(s.appointments.receipt).toBeNull();
  expect(s.administration.workerId).toBe(before.administration.workerId); expect(s.succession.provision).toEqual(before.succession.provision);
  expect(s.appointments.enforcement.release).toBeNull(); expect(errors).toEqual([]);
});
test('DOM: contested appointment physically transfers the original installation and the real technician performs supplied upkeep across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page); const before = await snap(page);
  let s = await reviewed(page); const panel = page.locator('[data-city-appointments]');
  await panel.locator('[data-appointment-action="transfer"]').click(); await advance(page, 60);
  expect((await snap(page)).appointments.receipt).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 70);
  s = await snap(page);
  expect(s.appointments.receipt).not.toBeNull(); expect(s.office.publicWorksTransfers).toHaveLength(1);
  expect(s.administration.workerId).toBe(s.appointments.candidate.id);
  expect(s.succession.handover).toEqual(before.succession.handover);
  expect(s.succession.agreements).toEqual(before.succession.agreements);
  expect(s.succession.provision).toEqual(before.succession.provision);
  expect(s.administration.dueAt).toBe(before.administration.dueAt);
  await expect(panel).toContainText('Physical transfer recorded');
  expect(await admin(page, 'inspect')).toBe(true);
  const a = await page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
  expect(await admin(page, 'order', a.administration.inspection)).toBe(true); await advance(page, 180);
  s = await snap(page); expect(s.administration.job).toBeNull();
  expect(s.administration.receipts.filter(r => r.installationId)).toHaveLength(1);
  expect(s.administration.receipts.at(-1).personId).toBe(s.appointments.candidate.id);
  const oldParts = before.succession.provision.stock;
  // The already staged three city-owned parts are consumed first, not cloned.
  expect(s.succession.provision.stock).toBe(oldParts);
  expect(errors).toEqual([]);
});
test('Canvas: incumbent obstruction leaves the recorded appointment without physical control, persists and exposes no away intelligence', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'canvas', true); let s = await reviewed(page);
  const oldWorkerId = s.administration.workerId, handover = s.succession.handover;
  expect(await act(page, 'transfer', s.appointments.appointment)).toBe(false);
  s = await snap(page); expect(s.appointments.phase).toBe('obstructed');
  expect(s.appointments.receipt).toBeNull(); expect(s.administration.workerId).toBe(oldWorkerId);
  const panel = page.locator('[data-city-appointments]');
  await panel.locator('[data-appointment-action="accessReason"]').click(); await advance(page, 60);
  s = await snap(page); expect(s.appointments.access.reason.kind).toBe('rejectReplacement');
  expect(await act(page, 'accessReason')).toBe(false); expect(await act(page, 'accessInventory')).toBe(false);
  expect(s.appointments.access.offer).toBeNull(); await expect(panel).toContainText('I reject this replacement itself');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).appointments.obstruction).toEqual(s.appointments.obstruction);
  await expect(page.locator('[data-city-appointments]')).toContainText('enforceable control has not transferred');
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known;
  expect(await act(page, 'appoint', s.appointments.terms)).toBe(false);
  await advance(page, 180); s = await snap(page);
  expect(s.known).toEqual(dated); expect(s.succession.handover).toEqual(handover);
  expect(s.administration.workerId).toBe(oldWorkerId); expect(s.appointments.receipt).toBeNull();
  expect(s.appointments.access.reason).toEqual(dated.access.reason);
  expect(errors).toEqual([]);
});
test('DOM: witnessed access negotiation preserves dissent and custody, then physically releases the installation across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'dom', true, 'custodyAccountability'); let s = await reviewed(page);
  expect(await act(page, 'transfer', s.appointments.appointment)).toBe(false);
  const before = await snap(page), panel = page.locator('[data-city-appointments]');
  await panel.locator('[data-appointment-action="accessReason"]').click(); await advance(page, 60);
  expect((await snap(page)).appointments.access.reason.kind).toBe('custodyAccountability');
  await panel.locator('[data-appointment-action="accessInventory"]').click(); await advance(page, 30);
  s = await snap(page); expect(s.appointments.job.progress).toBe(30); expect(s.appointments.access.inspection).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 90);
  s = await snap(page); expect(s.office.publicWorksAccessInspections).toHaveLength(1);
  expect(s.appointments.access.inspection.inventory.reconciliation).toEqual({ expected: 3, observed: 3, discrepancy: false });
  expect(s.appointments.access.inspection.inventory.goods).toHaveLength(1);
  await expect(panel).toContainText('Original staging account expects 3; observed 3');
  expect(await act(page, 'accessSettle', { ...s.appointments.access.offer, rights: 'immunity' })).toBe(false);
  await panel.locator('[data-appointment-action="accessSettle"]').click(); await advance(page, 60);
  s = await snap(page); expect(s.appointments.access.settlement).not.toBeNull();
  expect(s.office.publicWorksAccessSettlements).toHaveLength(1);
  expect(s.appointments.receipt).toBeNull(); expect(s.administration.workerId).toBe(before.administration.workerId);
  expect(s.appointments.incumbentPolicy).toBe('retainInstallation');
  expect(s.appointments.appointment).toEqual(before.appointments.appointment);
  expect(s.appointments.obstruction).toEqual(before.appointments.obstruction);
  expect(s.succession.provision).toEqual(before.succession.provision);
  await panel.locator('[data-appointment-action="transfer"]').click(); await advance(page, 60);
  expect((await snap(page)).appointments.receipt).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 70);
  s = await snap(page); expect(s.appointments.receipt.accessSettlementId).toBe(s.appointments.access.settlement.id);
  expect(s.office.publicWorksTransfers).toHaveLength(1); expect(s.administration.workerId).toBe(s.appointments.candidate.id);
  expect(s.succession.leaders.find(a => a.id === s.appointments.incumbentId).mapCell).toEqual({ x: 14, y: 12, z: 6 });
  expect(s.succession.agreements).toEqual(before.succession.agreements); expect(s.administration.dueAt).toBe(before.administration.dueAt);
  await expect(panel).toContainText('Physical transfer recorded');
  expect(await act(page, 'accessSettle', s.appointments.access.offer)).toBe(false);
  expect(await admin(page, 'inspect')).toBe(true);
  const upkeep = await page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
  expect(await admin(page, 'order', upkeep.administration.inspection)).toBe(true); await advance(page, 180);
  s = await snap(page); expect(s.administration.job).toBeNull(); expect(s.administration.receipts.at(-1).personId).toBe(s.appointments.candidate.id);
  expect(s.succession.provision.stock).toBe(before.succession.provision.stock);
  expect(errors).toEqual([]);
});
