const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.soulBeaconSnapshot());
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceSoulBeaconsForTest(n), seconds);
async function finish(page) {
  for (let n = 0; n < 8; n++) {
    const s = await snapshot(page), task = s.tasks.find(t => ['soulBeaconWork', 'homunculusWork', 'researchWork'].includes(t.type));
    if (!task) return;
    await advance(page, Math.max(60, task.dueAt - s.clock + 60));
  }
  const s = await snapshot(page); expect(s.tasks, JSON.stringify(s.events.slice(-4))).toEqual([]);
}
async function action(page, action, id = '') {
  expect(await page.evaluate(({ action, id }) => window.helixHeresyDebug.stageSoulBeaconTestSupplies(action, id), { action, id }), `stage ${action}`).toBe(true);
  expect(await page.evaluate(({ action, id }) => window.helixHeresyDebug.soulBeaconAction(action, id), { action, id }), `${action}: ${JSON.stringify((await snapshot(page)).events.slice(-3))}`).toBe(true);
  await finish(page);
}
async function research(page, id) {
  expect(await page.evaluate(id => window.helixHeresyDebug.startResearchProject(id), id), `${id}: ${JSON.stringify((await snapshot(page)).events.slice(-3))}`).toBe(true);
  await finish(page); expect((await snapshot(page)).research.projects[id].status).toBe('completed');
}
async function advancedPair(page) {
  const ids = await page.evaluate(() => window.helixHeresyDebug.configureSoulBeaconTestLaboratory());
  await page.evaluate(ids => {
    // Explicit pre-existing late-game reconstruction fixture. Only the already
    // covered imperfect projects/body/charge are endowed. The new experiment,
    // both advanced projects, physical modification and validation are earned.
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const cost = n => Math.round(25 + Math.pow((new Set([0, 50, 100, 150, 200, 250, 300]).has(n) ? n + 20 : n) + 1, 1.25) * 4);
    const xp = level => Array.from({ length: level }, (_, n) => cost(n)).reduce((a, b) => a + b, 0);
    for (const id of ['animancy', 'medicine', 'alchemy']) s.scientist.skills[id] = { xp: xp(201), practiceTags: { priorLaboratoryWork: xp(201) } };
    for (const id of ['analysis', 'striking', 'evasion']) s.scientist.skills[id] = { xp: xp(51), practiceTags: { necropsy: xp(51) }, evolvedLabel: id === 'analysis' ? 'Forensic Analysis' : '' };
    s.scientist.skills.fabrication = { xp: xp(151), practiceTags: { priorFabrication: xp(151) } };
    for (const id of ['soulBeaconReconstruction', 'receivingBodyDevelopment', 'soulTransferIntegration']) s.research.projects[id].status = 'completed';
    const chamber = s.fixtures.find(f => f.id === ids.chamber), beacon = s.fixtures.find(f => f.id === ids.beacon);
    chamber.utility.enabled = true;
    const cell = d.soulBeaconWorkPreview('inspect', ids.chamber).cell;
    s.soulBeacons.receivers.push({ id: 'prior-ready-receiver', chamberId: ids.chamber, donorSoulId: s.soulBeacons.soul.id,
      status: 'ready', soulId: null, soulFormationPrevented: true, health: 100, cleared: false, stocks: [], supportStocks: [],
      startedAt: s.clock, readyAt: s.clock, careAt: s.clock, buffer: 1200, supportConsumed: 0, supportSeconds: 0,
      progressSeconds: 7 * 86400, consumed: { biomass: 80, growthMedium: 24, geneticMaterial: 10, humanTissueTemplate: 1 },
      location: { roomId: 'mainLab', cell } });
    s.soulBeacons.beacons.push({ id: `soul-beacon:${ids.beacon}`, fixtureId: ids.beacon, chamberId: ids.chamber,
      status: 'charged', charge: 24, armed: false, receiverId: '', progressSeconds: 6 * 3600, startedAt: s.clock,
      label: beacon.name, siteId: 'main-laboratory', location: { roomId: 'mainLab', cell: beacon.origin } });
    // This is an historical first-person loss, not a recoverable brain backup.
    s.scientist.memoryContinuity = { lostBeforeRun: true, losses: [{ deathId: 'prior-imperfect-death', at: 0 }], returns: [] };
    d.importSurveyExpeditionTestState(s);
  }, ids);
  const beaconId = `soul-beacon:${ids.beacon}`;
  await action(page, 'medium'); await action(page, 'upkeep', 'prior-ready-receiver');
  for (const a of ['sample', 'examineTemplate']) {
    expect(await page.evaluate(a => window.helixHeresyDebug.stageSoulBeaconTestSupplies(a), a)).toBe(true);
    expect(await page.evaluate(a => window.helixHeresyDebug.homunculusAction(a), a)).toBe(true); await finish(page);
  }
  return { ...ids, beaconId };
}
test('earned continuity research, supplied pairing, saved perfected return and genuine body retraining', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await startLifecycleRun(page, 'perfected-memory-transfer');
  const world = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world));
  const ids = await advancedPair(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.soulBeaconAction('prepare', id), ids.beaconId)).toBe(false);
  await action(page, 'continuityTrial', ids.beaconId);
  let s = await snapshot(page);
  expect(s.saved.continuityTrials, JSON.stringify(s.events.slice(-6))).toHaveLength(1);
  expect(s.saved.continuityTrials[0]).toMatchObject({ referencePatterns: 64, deliveredPatterns: 16, livingSubject: false });
  expect(s.saved.soul.integrity).toBe(100); expect(s.remains || []).toHaveLength(0);
  await research(page, 'memoryContinuityPreservation');
  await action(page, 'examine', 'prior-ready-receiver'); await action(page, 'examine', ids.beaconId);
  await research(page, 'receivingNeuralIntegration');
  expect((await snapshot(page)).saved.beacons[0].memoryTier).not.toBe('perfected');
  expect(await page.evaluate(id => window.helixHeresyDebug.soulBeaconAction('validate', id), ids.beaconId)).toBe(false);
  await page.evaluate(id => window.helixHeresyDebug.stageSoulBeaconTestSupplies('prepare', id), ids.beaconId);
  expect(await page.evaluate(id => window.helixHeresyDebug.soulBeaconAction('prepare', id), ids.beaconId)).toBe(true);
  await advance(page, 600); s = await snapshot(page);
  const progress = s.tasks[0].data.workProgressSeconds; expect(progress).toBeGreaterThan(0); expect(progress).toBeLessThan(4 * 3600);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).tasks[0].data.workProgressSeconds).toBe(progress);
  await page.evaluate(() => window.helixHeresyDebug.setSoulBeaconTestSupport({ power: false }));
  await advance(page, 10 * 60); expect((await snapshot(page)).tasks[0].data.workProgressSeconds).toBe(progress);
  await page.evaluate(() => window.helixHeresyDebug.setSoulBeaconTestSupport({ power: true })); await finish(page);
  await action(page, 'validate', ids.beaconId); await action(page, 'arm', ids.beaconId);
  await page.locator('[data-workspace-tab="research"]').click(); await expect(page.locator('[data-soul-beacons]')).toContainText('perfected transfer');
  await page.evaluate(() => window.helixHeresyDebug.setSoulBeaconTestSupport({ soulDamage: 10, sourceId: 'persistent-neural-test-wound', carriedItem: true }));
  const alive = await snapshot(page);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage('combat'));
  await expect(page.locator('#runOutcomeHeading')).toHaveText('Resurrection handoff pending');
  await expect(page.locator('#runOutcomePanel')).toContainText('bodily competence requires retraining');
  await page.locator('[data-soul-beacon-destination]').check();
  await expect(page.locator('[data-soul-beacon-confirm]')).toHaveText('Confirm perfected soul-beacon recovery');
  const deathId = (await snapshot(page)).saved.handoff.deathId;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await expect(page.locator('[data-soul-beacon-destination]')).toBeChecked();
  page.once('dialog', dialog => dialog.accept()); await page.locator('[data-soul-beacon-confirm]').click();
  s = await snapshot(page); expect(s.saved.transfers[0].memoryTier).toBe('perfected'); expect(s.saved.soul.integrity).toBe(90);
  expect(s.scientist.skills.animancy.xp).toBe(alive.scientist.skills.animancy.xp);
  expect(s.scientist.skills.medicine.xp).toBe(alive.scientist.skills.medicine.xp); expect(s.scientist.skills.medicine.embodiment.xp).toBe(0);
  expect(s.scientist.skills.striking.embodiment.xp).toBe(0); expect(s.scientist.skills.analysis.evolvedLabel).toBe('Forensic Analysis');
  expect(s.proficiency.medicine).toMatchObject({ knowledge: alive.proficiency.medicine.knowledge, execution: 0 });
  expect(s.proficiency.striking).toEqual({ knowledge: 51, execution: 0, combat: 0 });
  expect(s.proficiency.animancy.execution).toBe(s.proficiency.animancy.knowledge);
  expect(s.scientist.memoryContinuity.losses).toEqual(alive.scientist.memoryContinuity.losses);
  expect(s.scientist.sensory.routeMemory.cells).toEqual(expect.arrayContaining(alive.scientist.sensory.routeMemory.cells));
  expect(s.remains).toHaveLength(1); expect(s.research).toEqual(alive.research); expect(s.campaign).toEqual(alive.campaign); expect(s.legal).toEqual(alive.legal);
  await expect(page.locator('[data-skill-id="medicine"]')).toContainText('Current bodily proficiency: level 0');
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), deathId)).toBe(false);
  await action(page, 'retrain', 'medicine');
  s = await snapshot(page); expect(s.scientist.skills.medicine.embodiment.xp).toBe(205); // 4x 60, ordinary 0 -> 1 breakthrough discards excess.
  await expect(page.locator('[data-skill-id="medicine"]')).toContainText('Current bodily proficiency: level 1');
  const medicalBodyXp = s.scientist.skills.medicine.embodiment.xp;
  // A real research completion rewards theory only, never manual competence.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.research.projects.receivingNeuralIntegration.status = 'available'; s.research.projects.receivingNeuralIntegration.progressSeconds = 0;
    s.research.projects.receivingNeuralIntegration.inputsConsumed = false; d.importSurveyExpeditionTestState(s);
  });
  await research(page, 'receivingNeuralIntegration'); expect((await snapshot(page)).scientist.skills.medicine.embodiment.xp).toBe(medicalBodyXp);
  await page.locator('[data-workspace-tab="resources"]').click();
  await page.locator('[data-stores-menu-tab="scientist"]').click();
  await page.evaluate(() => window.helixHeresyDebug.stageSoulBeaconTestSupplies('retrain', 'evasion'));
  await page.locator('[data-embodied-retrain="evasion"]').click({ timeout: 10000 });
  const beforeDrill = (await snapshot(page)).scientist.skills.evasion.embodiment.xp; expect(beforeDrill).toBe(0);
  const cancelled = (await snapshot(page)).tasks.find(t => t.data?.action === 'retrain').id;
  await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), cancelled);
  expect((await snapshot(page)).scientist.skills.evasion.embodiment.xp).toBe(0);
  await page.locator('[data-embodied-retrain="evasion"]').click({ timeout: 10000 });
  await finish(page); expect((await snapshot(page)).scientist.skills.evasion.embodiment.xp).toBe(205);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  s = await snapshot(page); expect(s.scientist.skills.medicine.embodiment.xp).toBe(medicalBodyXp); expect(s.saved.transfers).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world))).toBe(world);
  expect(errors).toEqual([]);
});
test('zero-body practice survives reload and newly learned theory cannot become physical mastery', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await startLifecycleRun(page, 'post-return-new-domain');
  await page.evaluate(() => {
    // Explicit already-returned body fixture for skill normalization, not an
    // earned resurrection, researched apparatus or campaign accomplishment.
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.scientist.vocalBodyId = 'explicit-returned-body';
    s.scientist.memoryContinuity = { lostBeforeRun: true, losses: [], returns: [{ memoryTier: 'perfected', deathId: 'explicit-prior-death' }] };
    s.scientist.skills.materialsScience = { xp: 0, practiceTags: {}, embodiment: { bodyId: 'explicit-returned-body', xp: 0,
      retainedXp: 0, lastPracticedAt: 0, lastBreakthroughDecayAt: 0 } };
    delete s.scientist.skills.fabrication;
    d.importSurveyExpeditionTestState(s);
  });
  await page.locator('[data-workspace-tab="cheats"]').click();
  for (const id of ['materialsScience', 'fabrication']) {
    await page.locator('#xpCommandInput').fill(`${id} 205`); await page.locator('#xpCommandBtn').click();
    const s = await snapshot(page); expect(s.proficiency[id]).toMatchObject({ knowledge: 1, execution: 0 });
    expect(s.scientist.skills[id].embodiment).toMatchObject({ bodyId: 'explicit-returned-body', xp: 0, retainedXp: 0 });
  }
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  const s = await snapshot(page);
  for (const id of ['materialsScience', 'fabrication']) expect(s.proficiency[id]).toMatchObject({ knowledge: 1, execution: 0 });
  expect(errors).toEqual([]);
});
