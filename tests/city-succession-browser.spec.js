const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.citySuccessionSnapshot());
const act = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.citySuccessionAction(action, expected), { action, expected });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceCitySuccessionForTest(n), seconds);
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw new Error('Physical walking did not finish');
  });
}
async function start(page, retirement = true) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'succession-test', siteId: 'succession-lab', strategicCellId: 'planet-cell:00009', seed: 'succession-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest();
    d.configureUnsupportedTest({ municipal: true });
  });
  expect(await act(page, 'request')).toBe(false);
  expect(await act(page, 'walk')).toBe(true); await finishWalk(page);
  // Explicit prepared late-game civic history, not ordinary unlocks or rewards.
  expect(await page.evaluate(retirement => window.helixHeresyDebug.configureCitySuccessionTest({ retirement }), retirement)).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function offered(page) {
  const initial = await snap(page);
  expect(await act(page, 'request')).toBe(true);
  expect((await snap(page)).succession.ruler.mapCell).toEqual(initial.succession.ruler.mapCell);
  expect(await page.evaluate(() => window.helixHeresyDebug.sovereignBargainAction('request'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
  await advance(page, 30);
  const arrived = await snap(page);
  const navigation = arrived.succession.phase === 'ready' ? [] : await page.evaluate(() => window.helixHeresyDebug.citySuccessionNavigationSnapshot());
  expect(arrived.succession.phase, JSON.stringify(navigation)).toBe('ready');
  expect(arrived.succession.ruler.mapCell).not.toEqual(initial.succession.ruler.mapCell);
  expect(arrived.succession.ruler.workSeconds).toBeLessThan(initial.succession.ruler.workSeconds);
  expect(await act(page, 'hear')).toBe(true);
  // Exercise ordinary chronological simulation, not only isolated accounting.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(90));
  expect((await snap(page)).succession.job.progress).toBe(90);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await advance(page, 90);
}
test('city succession requires exact conditional terms and separate leaders, hands over real authority and physically executes one finite directive across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await start(page); await offered(page);
  let s = await snap(page); expect(s.succession.phase).toBe('offered'); expect(s.campaign.cityPower.succession).toBeNull();
  const panel = page.locator('[data-city-succession]'); await expect(panel).toContainText('conditionalDesignation');
  expect(await act(page, 'sign', { ...s.succession.terms, quantity: 1 })).toBe(false);
  expect(await act(page, 'sign', s.succession.terms)).toBe(true);
  expect(await act(page, 'handover')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.configureSovereignBargainTest({ supply: 18, carried: true }));
  const before = await snap(page);
  expect(await act(page, 'deliver')).toBe(true); s = await snap(page);
  expect(s.succession.provision.stock).toBe(18);
  expect(s.stacks.filter(i => i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0)).toBe(
    before.stacks.filter(i => i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0) - 18);
  for (const a of [...s.succession.leaders, s.bargain.defender]) {
    expect(await act(page, 'agree', a.id)).toBe(true); await advance(page, 60);
  }
  expect(await act(page, 'handover')).toBe(true); await advance(page, 180);
  s = await snap(page); expect(s.context.authorityId).toBe('scientist'); expect(s.succession.handover).toBeTruthy();
  expect(s.succession.ruler.status).toBe('alive'); expect(s.campaign.cityPower.succession.sourceId).toBe(s.succession.handover.id);
  await expect(panel).toContainText('Recognized city authority: scientist');
  await page.locator('[data-succession-action="directive"]').click(); await advance(page, 60);
  s = await snap(page); expect(s.succession.directive.status).toBe('carrying'); expect(s.succession.provision.stock).toBe(15);
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload(); await page.evaluate(saved => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(saved)), saved);
  expect((await snap(page)).succession.directive.cargo.quantity).toBe(3);
  await advance(page, 30); s = await snap(page); expect(s.succession.directive.status).toBe('completed');
  const item = s.stacks.find(i => i.id === s.succession.directive.receipt.stackId);
  expect(item.quantity).toBe(3); expect(item.cell).toEqual({ x: 16, y: 12, z: 6 }); expect(item.carriedBy).toBe('');
  expect(item.cityOwnerId).toBe(s.succession.source.cityId); expect(item.reservedTaskId).toContain('city-maintenance-reserve');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).stacks.find(i => i.id === item.id).civicCustody.quantity).toBe(3);
  expect(await act(page, 'directive')).toBe(false); expect((await snap(page)).succession.provision.stock).toBe(15);
  expect(errors).toEqual([]);
});
test('incumbent refusal cannot reroll and a won demonstration plus money never awards city control', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await start(page, false); await offered(page);
  let s = await snap(page); expect(s.succession.phase).toBe('refused'); expect(s.succession.decision.decisionMakerId).toBe(s.succession.ruler.id);
  await expect(page.locator('[data-city-succession]')).toContainText('cannot compel abdication');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect(await act(page, 'request')).toBe(false); expect(await act(page, 'handover')).toBe(false); expect(await act(page, 'directive')).toBe(false);
  s = await snap(page); expect(s.succession.control).toBeNull(); expect(s.campaign.cityPower.succession).toBeNull();
  expect(JSON.stringify(s.known)).not.toMatch(/retirementPolicy|workSeconds|wardMana/);
  expect(errors).toEqual([]);
});
