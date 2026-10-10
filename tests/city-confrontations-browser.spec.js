const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.cityConfrontationSnapshot());
const act = (page, action) => page.evaluate(a => window.helixHeresyDebug.cityConfrontationAction(a), action);
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), seconds);
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw new Error('Actual walking did not finish');
  });
}
async function setup(page, mode = 'dom') {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(mode => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: mode })); }, mode);
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'confrontation-test', siteId: 'confrontation-lab', strategicCellId: 'planet-cell:00009', seed: 'confrontation-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest();
  });
  expect(await act(page, 'demand')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ municipal: true }));
  expect(await act(page, 'walk')).toBe(true); await finishWalk(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.configureCityConfrontationTest())).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const mode of ['dom', 'canvas']) test(`${mode}: actual abdication refusal, finite hostile pulse, ceasefire breach and physical withdrawal survive reload without rule`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, mode); const original = await snap(page);
  const training = await page.evaluate(() => window.helixHeresyDebug.defenderChallengeSnapshot().challenge);
  expect(training?.receipt).toBeFalsy(); expect(training?.petition).toBeFalsy();
  const panel = page.locator('[data-city-confrontation]'); await expect(panel).toContainText('Dangerous unsanctioned');
  await panel.locator('[data-confrontation-action="demand"]').click();
  const demanded = await snap(page); expect(demanded.confrontation.phase).toBe('fighting');
  expect(demanded.confrontation.encounter.abdication).toBe('rejected'); expect(demanded.succession.control).toBeNull();
  expect(demanded.bargain.defender.id).toBe(original.bargain.defender.id);
  expect(demanded.confrontation.reports.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.sovereignBargainAction('request'))).toBe(false);
  await advance(page, 2); const marked = await snap(page);
  expect(marked.confrontation.pendingPulse).toBeTruthy(); expect(marked.bargain.defender.wardMana).toBe(108);
  expect(marked.bargain.defender.mapCell).not.toEqual(original.bargain.defender.mapCell);
  await expect(panel).toContainText('Dangerous pulse marked');
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload(); await page.evaluate(saved => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(saved)), saved);
  expect((await snap(page)).confrontation.pendingPulse).toEqual(marked.confrontation.pendingPulse);
  expect(await act(page, 'guard')).toBe(true); await advance(page, 2); const hit = await snap(page);
  expect(hit.scientist.health).toBeLessThan(marked.scientist.health - 6);
  expect(hit.injuries.some(i => i.actorId === 'scientist' && i.status === 'active')).toBe(true);
  expect(hit.bargain.defender.wardMana).toBe(108);
  expect(await act(page, 'ceasefire')).toBe(true); const ceased = await snap(page);
  expect(ceased.confrontation.phase).toBe('ceasefire'); expect(ceased.confrontation.pendingPulse).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.configureCityConfrontationTest({ mastery: true }));
  expect(await act(page, 'soulLash')).toBe(true); const breached = await snap(page);
  expect(breached.confrontation.phase).toBe('fighting'); expect(breached.bargain.defender.wardMana).toBe(94);
  expect(breached.scientist.mana).toBe(ceased.scientist.mana - 12);
  expect(breached.confrontation.reports.some(r => r.kind === 'attackOutsideTraining' && r.evidenceAt != null)).toBe(true);
  expect(await act(page, 'ceasefire')).toBe(true);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 14, z: 6 }, urgent: true })))).toBe(true);
  await finishWalk(page);
  const withdrawn = await snap(page);
  expect(withdrawn.confrontation.outcomes[0].outcome).toBe('scientistPhysicallyWithdrew');
  expect(withdrawn.succession.control).toBeNull(); expect(withdrawn.succession.handover).toBeNull(); expect(withdrawn.campaign.cityPower.mandate).toBeNull();
  const history = withdrawn.confrontation.outcomes;
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).confrontation.outcomes).toEqual(history);
  expect((await snap(page)).bargain.defender.wardMana).toBe(94);
  expect(JSON.stringify((await snap(page)).known)).not.toMatch(/wardMana|staminaCapacity|workSeconds|skills/);
  expect(errors).toEqual([]);
});
test('defender death is ordinary persistent combat damage, never ruler abdication or game over', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page);
  await page.evaluate(() => window.helixHeresyDebug.configureCityConfrontationTest({ wardMana: 0, stamina: 0, defenderHealth: 12, mastery: true }));
  expect(await act(page, 'demand')).toBe(true); expect((await snap(page)).confrontation.phase).toBe('ceasefire');
  expect(await act(page, 'soulLash')).toBe(true); const killed = await snap(page);
  expect(killed.bargain.defender.status).toBe('dead'); expect(killed.bargain.defender.health).toBe(0);
  expect(killed.confrontation.outcomes[0].outcome).toBe('defenderDead'); expect(killed.succession.ruler.status).toBe('alive');
  expect(killed.succession.control).toBeNull(); expect(killed.succession.handover).toBeNull();
  expect(killed.injuries.some(i => i.actorKind === 'cityDefender' && i.typeId === 'arcaneTrauma')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).confrontation.outcomes).toEqual(killed.confrontation.outcomes);
  expect((await snap(page)).bargain.defender.status).toBe('dead');
  await advance(page, 1); expect((await snap(page)).clock).toBeGreaterThan(killed.clock);
  expect(errors).toEqual([]);
});
