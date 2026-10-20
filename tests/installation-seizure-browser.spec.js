const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.installationSeizureSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.installationSeizureAction(action, options), { action, options });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceInstallationSeizureForTest(n), seconds);
async function walk(page, cell) {
  if (cell) expect(await page.evaluate(cell => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: cell, urgent: true })), cell)).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 45; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceInstallationSeizureForTest(Math.max(1, task.dueAt - s.clock + 1), true);
    }
    throw new Error('Actual walking did not finish');
  });
  await advance(page, 0);
}
async function setup(page, mode) {
  page.setDefaultTimeout(15000); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `installation-${mode}`);
  await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'installation-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest();
    d.configureUnsupportedTest({ municipal: true });
  });
  expect(await act(page, 'walk')).toBe(true); await walk(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.configureCityConfrontationTest())).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function reloadSaved(page) {
  await advance(page, 0); await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const mode of ['dom', 'canvas']) {
  test(`${mode}: original installation defense, actual staff retreat, interrupted withdrawal and real reload confer no rule`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, mode);
    const original = await snap(page), panel = page.locator('[data-installation-seizure]');
    await panel.locator('[data-seizure-action="begin"]').click();
    expect((await snap(page)).saved.combat.phase).toBe('fighting');
    expect(await page.evaluate(() => window.helixHeresyDebug.sovereignBargainAction('request'))).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.defenderChallengeAction('request'))).toBe(false);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2));
    const marked = await snap(page); expect(marked.saved.attempt.phase).toBe('contested');
    expect(marked.saved.combat.pendingPulse).toBeTruthy(); expect(marked.bargain.defender.wardMana).toBe(108);
    expect(marked.office.clerk.mapCell).not.toEqual(original.office.clerk.mapCell);
    expect(marked.office.clerk.workSeconds).toBeLessThan(original.office.clerk.workSeconds);
    expect(marked.bargain.defender.id).toBe(original.bargain.defender.id);
    await expect(panel).toContainText('Installation pulse marked');
    await reloadSaved(page);
    expect((await snap(page)).saved.combat.pendingPulse).toEqual(marked.saved.combat.pendingPulse);
    expect(await act(page, 'guard')).toBe(true); await advance(page, 2);
    const hit = await snap(page); expect(hit.scientist.health).toBeLessThan(marked.scientist.health);
    expect(hit.injuries.some(i => i.actorId === 'scientist')).toBe(true);
    expect(await act(page, 'withdraw')).toBe(true); await advance(page, 1);
    expect((await snap(page)).saved.attempt.phase).toBe('withdrawing');
    await reloadSaved(page); expect((await snap(page)).saved.attempt.phase).toBe('withdrawing');
    await walk(page, { x: 10, y: 14, z: 6 }); await advance(page, 40);
    const left = await snap(page); expect(left.saved.attempt.phase).toBe('withdrawn');
    expect(left.succession.control).toBeNull(); expect(left.succession.handover).toBeNull();
    expect(left.campaign.cityPower.mandate).toBeNull(); expect(left.bargain.defender.wardMana).toBe(108);
    expect(left.saved.receipts).toEqual([]); expect(left.stacks.filter(i => i.cityOwnerId === 'a')).toEqual(original.stacks.filter(i => i.cityOwnerId === 'a'));
    expect(left.saved.reports.some(r => r.evidenceAt != null)).toBe(true);
    expect(JSON.stringify(left.known)).not.toMatch(/wardMana|staminaCapacity|workSeconds|skills/);
    expect(errors).toEqual([]);
  });
  test(`${mode}: shared lethal combat permits bounded access and attended real custody, not legal ownership or an invisible garrison`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, mode);
    // Explicit already-wounded original person and already-delivered physical
    // lot; the player operation must not spawn either, heal or replenish them.
    await page.evaluate(() => {
      const d = window.helixHeresyDebug; d.configureCityConfrontationTest({ wardMana: 0, stamina: 0, defenderHealth: 12, mastery: true });
      const s = d.exportSurveyExpeditionTestState();
      s.physicalItemStacks.push({ id: 'prior-city-delivery', section: 'resources', key: 'metalParts', quantity: 3,
        roomId: 'supportedSurveyGround', cell: { x: 16, y: 12, z: 6 }, cityOwnerId: 'a', reservedTaskId: `${s.citySuccession.id}:city-maintenance-reserve`,
        civicCustody: { receiptId: 'prior-transfer', custodianId: 'municipal-stores' }, sourceLabels: ['Existing city maintenance delivery'] });
      d.importSurveyExpeditionTestState(s);
    });
    expect(await act(page, 'begin')).toBe(true); expect(await act(page, 'soulLash')).toBe(true);
    let s = await snap(page); expect(s.bargain.defender.status).toBe('dead'); expect(s.bargain.defender.health).toBe(0);
    expect(s.injuries.some(i => i.actorKind === 'cityDefender' && i.typeId === 'arcaneTrauma')).toBe(true);
    await walk(page, { x: 17, y: 12, z: 6 }); await advance(page, 1);
    s = await snap(page); expect(s.saved.attempt.phase, JSON.stringify(s.context)).toBe('held');
    expect(await act(page, 'inspect', { stackId: 'prior-city-delivery' })).toBe(true);
    const panel = page.locator('[data-installation-seizure]'); await panel.locator('[data-seizure-action="take"]').click();
    await advance(page, 4); s = await snap(page); expect(s.saved.handling.progress).toBe(4);
    expect(s.stacks.find(i => i.id === 'prior-city-delivery').quantity).toBe(3);
    await reloadSaved(page); expect((await snap(page)).saved.handling.progress).toBe(4);
    await advance(page, 6); s = await snap(page); expect(s.saved.handling.status).toBe('completed');
    expect(s.saved.receipts).toHaveLength(1); const taken = s.stacks.find(i => i.seizureCustody);
    expect(taken.carriedBy).toBe('scientist'); expect(taken.quantity).toBe(1); expect(taken.cityOwnerId).toBe('a');
    expect(taken.civicCustody).toEqual({ receiptId: 'prior-transfer', custodianId: 'municipal-stores' });
    expect(taken.reservedTaskId).toBe('');
    expect(s.stacks.find(i => i.id === 'prior-city-delivery').reservedTaskId).toBe(`${s.succession.id}:city-maintenance-reserve`);
    expect(s.stacks.filter(i => i.id === 'prior-city-delivery' || i.seizureCustody).reduce((n, i) => n + i.quantity, 0)).toBe(3);
    expect(s.succession.control).toBeNull(); expect(s.succession.handover).toBeNull(); expect(s.campaign.cityPower.mandate).toBeNull();
    expect(await act(page, 'take')).toBe(false); // exact dated inspection is stale
    expect(await act(page, 'inspect', { stackId: 'prior-city-delivery' })).toBe(true);
    expect(await act(page, 'take')).toBe(true); await advance(page, 2);
    await walk(page, { x: 18, y: 12, z: 6 }); s = await snap(page);
    expect(s.saved.handling.status).toBe('interrupted'); expect(s.saved.receipts).toHaveLength(1);
    expect(s.stacks.find(i => i.id === 'prior-city-delivery').quantity).toBe(2);
    expect(s.stacks.find(i => i.id === 'prior-city-delivery').reservedTaskId).toBe(`${s.succession.id}:city-maintenance-reserve`);
    expect(await act(page, 'withdraw')).toBe(true); await walk(page, { x: 10, y: 14, z: 6 }); await advance(page, 45);
    s = await snap(page); expect(s.saved.attempt.phase).toBe('withdrawn');
    expect(s.office.clerk.mapCell).toEqual(s.saved.staff.find(a => a.id === s.office.clerk.id).home);
    expect(s.office.active).toBe(true);
    await walk(page, { x: 8, y: 16, z: 6 }); const lastKnown = (await snap(page)).known; await advance(page, 2);
    expect((await snap(page)).known).toEqual(lastKnown);
    await reloadSaved(page); s = await snap(page); expect(s.saved.receipts).toHaveLength(1); expect(s.bargain.defender.status).toBe('dead');
    expect(s.stacks.find(i => i.seizureCustody).cityOwnerId).toBe('a'); expect(errors).toEqual([]);
  });
}
