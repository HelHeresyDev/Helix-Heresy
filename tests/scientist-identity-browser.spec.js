const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const Expeditions = require('../survey-expeditions');
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.scientistIdentitySnapshot());
async function finishWork(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 12; n++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(0, task.dueAt - s.clock) + 1);
    }
    throw new Error('Physical work did not finish');
  });
}
test('scientist travels, walks to a real civic counter, registers and retains dated records through reload and bodily change', async ({ page }) => {
  test.setTimeout(300000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Helix Laboratory', cellId: 'planet-cell:00009', supportComponentId: 'component:one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'component:one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'survey-world', siteId: 'parcel-test', strategicCellId: 'planet-cell:00009', seed: 'survey-test', publicProspects: { prospectBands: { ferrousOre: 'moderate' } }, truth: { potentialPermille: { ferrousOre: 900 }, typicalDepth: { ferrousOre: 'exposed' }, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, court: true, money: 1000 });
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.scientistIdentityAction('preview', 'Dr. New Name'))).toBe(true);
  const home = await snapshot(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.scientistIdentityAction('confirm'))).toBe(false);
  expect((await snapshot(page)).money).toBe(home.money);
  for (const item of Expeditions.PACK_LIST.filter(i => i.required)) {
    expect(await page.evaluate(key => window.helixHeresyDebug.packSurveyItem(key), item.key)).toBe(true);
    await finishWork(page);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true);
  await finishWork(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 6; n++) {
      const s = d.surveyExpeditionSnapshot(); if (s.phase === 'field') return;
      const j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.journeyId);
      if (j.status === 'stranded') d.controlSurveyJourney('recover');
      else d.advanceSimulation(Math.max(1, j.exactArrivalAt - s.clock + 1));
    }
    throw new Error('Municipal journey did not arrive');
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.scientistIdentityAction('walk'))).toBe(true);
  await finishWork(page);
  expect((await snapshot(page)).context.atCounter).toBe(true);
  await page.getByRole('button', { name: 'Visits', exact: true }).click();
  await page.getByLabel('Chosen civic registration name').fill('Dr. New Name');
  await page.getByRole('button', { name: 'Preview Civic Registration', exact: true }).click();
  await expect(page.locator('[data-scientist-civic-preview]')).toContainText('Dr. New Name');
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Confirm Civic Appointment', exact: true }).click();
  expect((await snapshot(page)).money).toBe(before.money - before.preview.fee);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(900));
  expect((await snapshot(page)).job.progress).toBe(900);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(900));
  const registered = await snapshot(page);
  expect(registered.job).toBeNull();
  expect(registered.documents).toHaveLength(1);
  expect(registered.documents[0].registeredName).toBe('Dr. New Name');
  expect(registered.cell).toEqual(before.cell);
  await expect(page.locator('[data-scientist-civic-receipt]')).toHaveCount(1);
  await page.getByRole('button', { name: `Preview Court Access: ${registered.documents[0].number}`, exact: true }).click();
  await expect(page.locator('[data-scientist-civic-preview]')).toContainText('thirty-day local court-access credential');
  await page.getByRole('button', { name: 'Confirm Civic Appointment', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(300));
  const duringAccess = await snapshot(page);
  expect(duringAccess.courtCredentials || []).toEqual([]);
  await page.evaluate(() => { window.helixHeresyDebug.reloadSurveyExpeditionTestState(); window.helixHeresyDebug.advanceSimulation(300); });
  const access = await snapshot(page);
  expect(access.courtCredentials).toHaveLength(1);
  expect(access.cell).toEqual(registered.cell);
  await expect(page.locator('[data-court-access-credential]')).toContainText('No criminal attribution');
  const recheckActions = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.scientistIdentitySnapshot();
    d.configureScientistIdentityTest({ description: { ...s.description, hair: 'white' } });
    const preview = d.scientistIdentityAction('previewCheck', '', s.documents[0].number);
    const confirm = d.scientistIdentityAction('confirm');
    d.advanceSimulation(600);
    return { preview, confirm };
  });
  expect(recheckActions).toEqual({ preview: true, confirm: true });
  const checked = await snapshot(page);
  expect(checked.documents).toEqual(registered.documents);
  expect(checked.receipts.at(-1)).toMatchObject({ appearance: 'mismatch', result: 'unverified' });
  expect(errors).toEqual([]);
});
