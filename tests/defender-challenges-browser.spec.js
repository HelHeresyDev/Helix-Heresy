const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(240000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.defenderChallengeSnapshot());
const act = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.defenderChallengeAction(action, expected), { action, expected });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), seconds);
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
async function start(page) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'challenge-test', siteId: 'challenge-lab', strategicCellId: 'planet-cell:00009', seed: 'challenge-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest();
  });
  expect(await act(page, 'request')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ municipal: true }));
  expect(await page.evaluate(() => window.helixHeresyDebug.sovereignBargainAction('walk'))).toBe(true); await finishWalk(page);
  await page.locator('[data-workspace-tab="visits"]').click();
  expect(await act(page, 'request')).toBe(true);
}
async function bout(page) {
  const terms = (await snap(page)).challenge.terms;
  expect(await act(page, 'accept', { ...terms, durationSeconds: 1 })).toBe(false);
  expect(await act(page, 'accept', terms)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.sovereignBargainAction('request'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
  await advance(page, 150); const middle = await snap(page); expect(middle.challenge.job.progress).toBe(150);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).challenge.job).toEqual(middle.challenge.job);
  await advance(page, 150); expect((await snap(page)).challenge.phase).toBe('outward');
  expect((await snap(page)).bargain.defender.mapCell).toEqual({ x: 19, y: 9, z: 6 });
  expect(await act(page, 'walkGround')).toBe(true); await finishWalk(page);
  for (let i = 0; i < 25 && (await snap(page)).challenge.phase === 'outward'; i++) await advance(page, 1);
  expect((await snap(page)).challenge.phase).toBe('ready');
  expect((await snap(page)).bargain.defender.mapCell).toEqual({ x: 14, y: 12, z: 6 });
  expect(await act(page, 'start')).toBe(true);
}
test('sanctioned defender bout spends shared work and finite wards, telegraphs real injury and preserves withdrawal on reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await start(page); await bout(page);
  const panel = page.locator('[data-defender-challenge]');
  await expect(panel).toContainText('No command');
  expect(await act(page, 'strike')).toBe(false); // Two meters away: not a free ranged punch.
  await page.evaluate(() => window.helixHeresyDebug.configureDefenderChallengeTest({ mastery: true }));
  const before = await snap(page);
  expect(await act(page, 'soulLash')).toBe(true);
  const hit = await snap(page); expect(hit.bargain.defender.wardMana).toBe(before.bargain.defender.wardMana - 24);
  expect(hit.bargain.defender.health).toBe(98); expect(hit.scientist.mana).toBe(before.scientist.mana - 12);
  expect(hit.injuries.some(i => i.actorKind === 'cityDefender' && i.typeId === 'arcaneTrauma')).toBe(true);
  await advance(page, 3); const marked = await snap(page); expect(marked.challenge.pendingPulse).toBeTruthy();
  await expect(panel).toContainText('Marked force pulse');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).challenge.pendingPulse).toEqual(marked.challenge.pendingPulse);
  expect(await act(page, 'guard')).toBe(true); await advance(page, 2);
  const hurt = await snap(page); expect(hurt.scientist.health).toBe(marked.scientist.health - 4);
  expect(hurt.injuries.some(i => i.actorId === 'scientist' && i.status === 'active')).toBe(true);
  expect(await act(page, 'withdraw')).toBe(true);
  const ended = await snap(page); expect(ended.challenge.receipt.outcome).toBe('withdrawn');
  expect(ended.campaign.cityPower.mandate).toBeNull();
  expect(await act(page, 'soulLash')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).challenge.receipt).toEqual(ended.challenge.receipt);
  expect((await snap(page)).bargain.defender.wardMana).toBe(hurt.bargain.defender.wardMana);
  expect(errors).toEqual([]);
});
test('actual concession supports one attended political request, not city control; dodge walking and dated away knowledge survive page reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await start(page); await bout(page);
  await advance(page, 3); const marked = await snap(page);
  const target = { ...marked.scientist.cell, y: marked.scientist.cell.y + 1 };
  expect(await page.evaluate(target => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: target, urgent: true })), target)).toBe(true);
  await advance(page, 1); await advance(page, 1); expect((await snap(page)).scientist.health).toBe(marked.scientist.health);
  await finishWalk(page); // Actual urgent navigation, not fixture relocation.
  await page.evaluate(() => window.helixHeresyDebug.configureDefenderChallengeTest({ mastery: true, wardMana: 4 })); // Explicit exhausted-defense fixture, not ordinary replenishment.
  expect(await act(page, 'soulLash')).toBe(true); await advance(page, 1);
  expect(await act(page, 'soulLash')).toBe(true);
  const won = await snap(page); expect(won.challenge.receipt.outcome).toBe('defenderConceded'); expect(won.bargain.defender.health).toBe(74);
  expect(await act(page, 'petition')).toBe(false);
  for (let i = 0; i < 20 && (await snap(page)).challenge.phase === 'returning'; i++) await advance(page, 1);
  expect((await snap(page)).challenge.phase).toBe('closed');
  expect(await act(page, 'walkCounter')).toBe(true); await finishWalk(page);
  expect(await act(page, 'petition')).toBe(true); await advance(page, 30);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 30);
  const filed = await snap(page); expect(filed.challenge.petition.status).toBe('filedNotAccepted');
  expect(filed.campaign.cityPower.mandate).toBeNull(); expect(filed.bargain.defender.health).toBe(74);
  expect(await act(page, 'petition')).toBe(false); expect(await act(page, 'request')).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.sovereignBargainAction('request'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ municipal: true }));
  const dated = (await snap(page)).known; await advance(page, 10); expect((await snap(page)).known).toEqual(dated);
  expect(JSON.stringify(dated)).not.toMatch(/wardMana|workSeconds|skills/);
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload(); await page.evaluate(saved => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(saved)), saved);
  expect((await snap(page)).challenge.receipt).toEqual(won.challenge.receipt);
  expect((await snap(page)).challenge.petition).toEqual(filed.challenge.petition);
  expect(errors).toEqual([]);
});
