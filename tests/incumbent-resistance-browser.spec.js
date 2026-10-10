const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.incumbentResistanceSnapshot());
const act = (page, action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.incumbentResistanceAction(action, terms), { action, terms });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), seconds);
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
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureUnsupportedTest({ municipal: true });
    if (!d.cityConfrontationAction('walk')) throw new Error('Actual walking refused');
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) break;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    if (!d.configureCityConfrontationTest()) throw new Error('Existing-person fixture unavailable');
  });
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const mode of ['dom', 'canvas']) test(`${mode}: actual incumbent injury leads to one attended coerced declaration, not recognition; outages and reload retain original duty work`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, mode);
  await page.evaluate(() => window.helixHeresyDebug.configureIncumbentResistanceTest({
    health: 48, mana: 0, policy: 'preserveLife', rulerCell: { x: 16, y: 8, z: 6 }, mastery: true
  }));
  const original = await snap(page), panel = page.locator('[data-incumbent-resistance]');
  expect(original.resistance.receipt).toBeNull(); expect(original.succession.handover).toBeNull();
  await panel.locator('[data-incumbent-action="demand"]').click();
  expect((await snap(page)).resistance.phase).toBe('resisting');
  expect(await act(page, 'soulLash')).toBe(true);
  let s = await snap(page); expect(s.succession.ruler.health).toBe(34);
  expect(s.scientist.mana).toBe(original.scientist.mana - 12); expect(s.resistance.phase).toBe('offered');
  expect(s.confrontation.phase).toBe('ceasefire'); expect(s.confrontation.encounter.ceasefire.by).toBe('incumbent');
  expect(s.resistance.reports.some(r => r.kind === 'attackOnIncumbent' && r.evidenceAt != null)).toBe(true);
  expect(s.injuries.some(i => i.actorKind === 'cityIncumbent' && i.typeId === 'arcaneTrauma')).toBe(true);
  const terms = s.resistance.terms; expect(await act(page, 'demand')).toBe(true);
  expect((await snap(page)).resistance.terms).toEqual(terms); expect((await snap(page)).confrontation.phase).toBe('ceasefire');
  expect(await act(page, 'accept', { ...terms, origin: 'voluntary' })).toBe(false);
  expect((await snap(page)).context.recordWitnesses).toContain(original.office.clerk.id);
  await panel.locator('[data-incumbent-action="accept"]').click();
  expect((await snap(page)).resistance.phase).toBe('recording');
  await advance(page, 30); s = await snap(page);
  expect(s.resistance.job.progress).toBe(30); expect(s.office.workSeconds).toBe(original.office.workSeconds - 30);
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload(); await page.evaluate(raw => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(raw)), saved);
  expect((await snap(page)).resistance.job.progress).toBe(30);
  await page.evaluate(() => window.helixHeresyDebug.configureIncumbentResistanceTest({ powered: false }));
  await advance(page, 30); expect((await snap(page)).resistance.job.progress).toBe(30);
  await page.evaluate(() => window.helixHeresyDebug.configureIncumbentResistanceTest({ powered: true }));
  await advance(page, 1); expect((await snap(page)).resistance.job.progress).toBe(30);
  await advance(page, 30); s = await snap(page);
  expect(s.resistance.phase).toBe('claimed'); expect(s.resistance.receipt.origin).toBe('coerced');
  expect(s.resistance.receipt.recorderId).toBe(original.office.clerk.id);
  expect(s.resistance.receipt.declarantId).toBe(original.succession.ruler.id);
  expect(s.resistance.receipt.recognition).toBe('disputedSuccessorClaim'); expect(s.resistance.receipt.institutionalCommand).toEqual([]);
  expect(s.succession.ruler.status).toBe('alive'); expect(s.succession.ruler.officeStatus.status).toBe('abdicatedUnderCoercion');
  expect(s.office.power).toBe(original.office.power - 1); expect(s.office.workSeconds).toBe(original.office.workSeconds - 60);
  expect(s.succession.ruler.workSeconds).toBe(original.succession.ruler.workSeconds - 60);
  expect(s.succession.control).toBeNull(); expect(s.succession.handover).toBeNull(); expect(s.succession.agreements).toEqual([]);
  expect(s.campaign.cityPower.mandate).toBeNull(); expect(s.campaign.cityPower.succession).toBeNull();
  expect(await act(page, 'accept', terms)).toBe(false); expect(await act(page, 'demand')).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.citySuccessionAction('request'))).toBe(false);
  const receipt = s.resistance.receipt;
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 1);
  expect((await snap(page)).resistance.receipt).toEqual(receipt);
  expect(JSON.stringify((await snap(page)).known)).not.toMatch(/personalDefense|workSeconds|"skills"/);
  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator('[data-incumbent-resistance]')).toContainText('disputedSuccessorClaim');
  expect(errors).toEqual([]);
});
test('incumbent death is real persistent bodily damage and unresolved succession, never a signature or game over', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page);
  await page.evaluate(() => window.helixHeresyDebug.configureIncumbentResistanceTest({
    health: 12, mana: 0, stamina: 0, policy: 'holdOffice', rulerCell: { x: 16, y: 8, z: 6 }, mastery: true
  }));
  expect(await act(page, 'demand')).toBe(true); expect(await act(page, 'soulLash')).toBe(true);
  const killed = await snap(page); expect(killed.succession.ruler.status).toBe('dead'); expect(killed.succession.ruler.health).toBe(0);
  expect(killed.resistance.phase).toBe('unresolvedSuccession'); expect(killed.resistance.receipt).toBeNull();
  expect(killed.succession.control).toBeNull(); expect(killed.succession.handover).toBeNull();
  expect(killed.injuries.some(i => i.actorKind === 'cityIncumbent' && i.actorId === killed.succession.ruler.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await advance(page, 1); const reloaded = await snap(page); expect(reloaded.clock).toBeGreaterThan(killed.clock);
  expect(reloaded.succession.ruler.status).toBe('dead'); expect(reloaded.resistance.receipt).toBeNull();
  expect(errors).toEqual([]);
});
test('incumbent physically escapes on the real municipal map with finite saved personal reserves and a persistent windup', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page);
  await page.evaluate(() => window.helixHeresyDebug.configureIncumbentResistanceTest({ policy: 'holdOffice' }));
  const original = await snap(page); expect(await act(page, 'demand')).toBe(true);
  await advance(page, 1); let s = await snap(page);
  expect(s.resistance.phase).toBe('escaping'); expect(s.succession.ruler.mapCell).not.toEqual(original.succession.ruler.mapCell);
  expect(s.succession.ruler.personalDefense.stamina).toBe(79); expect(s.succession.ruler.id).toBe(original.succession.ruler.id);
  await advance(page, 1); s = await snap(page); expect(s.resistance.pendingPulse).toBeTruthy();
  expect(s.succession.ruler.personalDefense.mana).toBe(78);
  const before = s.succession.ruler, pulse = s.resistance.pendingPulse;
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); s = await snap(page);
  expect(s.succession.ruler).toEqual(before); expect(s.resistance.pendingPulse).toEqual(pulse);
  expect(s.resistance.receipt).toBeNull(); expect(s.succession.control).toBeNull();
  expect(errors).toEqual([]);
});
test('an exhausted escaping body still uses its own finite marked pulse; ordinary guarding and persistent scientist injuries apply', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureCityConfrontationTest({ wardMana: 0, stamina: 0 });
    d.configureIncumbentResistanceTest({ stamina: 0, policy: 'holdOffice', rulerCell: { x: 16, y: 8, z: 6 } });
  });
  const original = await snap(page); expect(await act(page, 'demand')).toBe(true);
  expect((await snap(page)).confrontation.phase).toBe('ceasefire'); expect(await act(page, 'guard')).toBe(true);
  await advance(page, 2); const marked = await snap(page);
  expect(marked.resistance.pendingPulse).toBeTruthy(); expect(marked.succession.ruler.personalDefense.mana).toBe(78);
  expect(marked.succession.ruler.mapCell).toEqual(original.succession.ruler.mapCell);
  await advance(page, 2); const hit = await snap(page);
  expect(hit.scientist.health).toBe(original.scientist.health - 8); expect(hit.resistance.pendingPulse).toBeNull();
  expect(hit.succession.ruler.personalDefense.mana).toBe(78); expect(hit.succession.ruler.personalDefense.stamina).toBe(0);
  expect(hit.injuries.some(i => i.actorKind === 'scientist')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).scientist.health).toBe(hit.scientist.health); expect((await snap(page)).resistance.receipt).toBeNull();
  expect(errors).toEqual([]);
});
