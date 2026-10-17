const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
const report = page => page.evaluate(() => window.helixHeresyDebug.civicFootholdSnapshot());
const admin = page => page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
const assess = page => page.evaluate(() => window.helixHeresyDebug.assessCivicFoothold());
async function visits(page) {
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw new Error('Real municipal walk did not finish');
  });
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(r => window.helixHeresyDebug.setMapRenderer(r), renderer); await visits(page);
}
async function unchangedInputs(page) {
  return page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), a = d.cityAdministrationSnapshot();
    return { clock: s.clock, money: s.economy.money, campaign: s.campaign, succession: s.citySuccession, administration: s.cityAdministration,
      power: a.office.power, work: a.office.workSeconds, clerk: a.office.clerk, tasks: s.tasks, stocks: s.physicalItemStacks,
      identity: s.scientistIdentity, opposition: s.incumbentResistance };
  });
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `civic-foothold-${renderer}`);
  const home = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'foothold', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.citySuccessionAction('walk')) throw new Error('Actual counter walk refused');
  }, renderer);
  await finishWalk(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    // Explicit original local civic sources/qualifications; the actual
    // designation, supplies, consent and handover below use production work.
    if (!d.configureCitySuccessionTest({ retirement: true }) || !d.citySuccessionAction('request')) throw new Error('Supported succession request refused');
    d.advanceCitySuccessionForTest(30);
    if (!d.citySuccessionAction('hear')) throw new Error('Hearing refused'); d.advanceCitySuccessionForTest(180);
    if (!d.citySuccessionAction('sign', d.citySuccessionSnapshot().succession.terms)) throw new Error('Exact terms refused');
    d.configureSovereignBargainTest({ supply: 18, carried: true });
    if (!d.citySuccessionAction('deliver')) throw new Error('Actual parts refused');
    const s = d.citySuccessionSnapshot();
    for (const a of [...s.succession.leaders, s.bargain.defender]) {
      if (!d.citySuccessionAction('agree', a.id)) throw new Error('Original institutional continuation refused'); d.advanceCitySuccessionForTest(60);
    }
    if (!d.citySuccessionAction('handover')) throw new Error('Handover refused'); d.advanceCitySuccessionForTest(180);
  });
  await visits(page); return { errors, world, home };
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('civic-foothold', {
    body: JSON.stringify({ assessment: await report(page), administration: await admin(page) }), contentType: 'application/json' });
});
test('Canvas free assessment preserves authority, records a visible outage without a clerk, saves real dates and stays stale while away or reading Journal', async ({ page }) => {
  const f = await setup(page, 'canvas'), before = await unchangedInputs(page);
  await page.getByRole('button', { name: 'Assess civic foothold', exact: true }).click();
  let r = (await report(page)).report; expect(r.recognition.some(r => r.sourceId === before.succession.handover.id)).toBe(true);
  expect(await unchangedInputs(page)).toEqual(before); expect(r.limitations).toContain('No citywide control');
  const oldDate = r.at;
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), id = s.citySuccession.officeId;
    const office = s.economy.intercitySmuggling.identityOffices.find(o => o.id === id);
    office.channelPowered = false; office.power = 0; office.workSeconds = 0;
    office.clerk.mapCell = { ...office.clerk.mapCell, x: 10, y: 15 }; // Actual absence, not a free substitute clerk.
    s.clock += 10; d.importSurveyExpeditionTestState(s);
  });
  expect((await report(page)).report.at).toBe(oldDate); const failedInputs = await unchangedInputs(page);
  expect(await assess(page)).toBe(true); r = (await report(page)).report; expect(r.conclusion).toBe('blocked');
  expect(r.recognition[0].at).toBe(before.succession.handover.at); expect(r.support.find(r => r.id === 'visiblePower').at).toBe(r.at);
  expect(await unchangedInputs(page)).toEqual(failedInputs);
  await reload(page, 'canvas'); expect((await report(page)).report).toEqual(r);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); expect(await assess(page)).toBe(false); expect((await report(page)).report).toEqual(r);
  await expect(page.locator('[data-workspace-tab="journal"]')).toBeHidden();
  // Journal is intentionally unavailable on survey trips. Exercise its saved,
  // read-only view in a separate home fixture, not a pretend transport return.
  await page.evaluate(({ home, record }) => {
    home.civicFoothold = record; home.campaign.guidanceEnabled = false;
    window.helixHeresyDebug.importSurveyExpeditionTestState(home);
  }, { home: f.home, record: r });
  await expect(page.locator('[data-workspace-tab="journal"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-workspace-tab="journal"]').click({ timeout: 10000 });
  await expect(page.getByLabel('Show campaign guidance')).not.toBeChecked();
  await expect(page.locator('[data-workspace-panel="journal"] [data-civic-foothold]')).toContainText('Local counter operations blocked');
  await expect(page.locator('[data-workspace-panel="journal"] [data-civic-foothold]')).toContainText('not live monitoring');
  expect((await report(page)).report).toEqual(r);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(f.world);
  expect(f.errors).toEqual([]);
});
test('DOM received refusal remains distinct from restored power; private motives and exact reserves never enter the saved report or campaign accomplishment', async ({ page }) => {
  const f = await setup(page, 'dom');
  expect(await page.evaluate(() => window.helixHeresyDebug.cityResistanceAction('terms'))).toBe(true);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.cityResistanceAction('accept', d.cityAdministrationSnapshot().administration.resistance.offer); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCityAdministrationForTest(60));
  expect(await page.evaluate(() => window.helixHeresyDebug.cityResistanceAction('demandDefense'))).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.cityAdministration.resistance.privateMotive = 'SECRET_OPPOSITION_POLICY'; s.citySuccession.ruler.privatePlans = 'SECRET_UNSEEN_RIVAL';
    s.sovereignBargains.defender.wardMana = 1234567; d.importSurveyExpeditionTestState(s);
    d.configureCityAdministrationTest({ powered: false, power: 0 });
  });
  const original = await unchangedInputs(page); expect(await assess(page)).toBe(true); const failed = (await report(page)).report;
  expect(failed.conclusion).toBe('blocked'); expect(failed.commands.find(r => r.id === 'publicWorksMaintenance').status).toBe('withdrawn');
  expect(failed.opposition.length).toBeGreaterThan(0); expect(JSON.stringify(failed)).not.toMatch(/SECRET_|1234567|wardMana|privateMotive/);
  expect(await unchangedInputs(page)).toEqual(original);
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ powered: true, power: 2 }));
  const repaired = await unchangedInputs(page); expect(await assess(page)).toBe(true); const r = (await report(page)).report;
  expect(r.support.find(r => r.id === 'visiblePower').status).toBe('supported'); expect(r.commands.find(r => r.id === 'publicWorksMaintenance').status).toBe('withdrawn');
  expect(r.recognition).toEqual(failed.recognition); expect(await unchangedInputs(page)).toEqual(repaired);
  await reload(page, 'dom'); expect((await report(page)).report).toEqual(r);
  expect(await page.evaluate(() => window.HelixCampaign.accomplishments(window.helixHeresyDebug.campaignSnapshot()).some(r => /world domination|city power/i.test(r.label)))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(f.world);
  expect(f.errors).toEqual([]);
});
