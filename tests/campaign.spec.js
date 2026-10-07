const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const Campaign = require('../campaign');
const Lifecycle = require('../run-lifecycle');
const Library = require('../world-run-library');
const { lifecycleWorld } = require('./helpers/lifecycle-world');
const clone = value => JSON.parse(JSON.stringify(value));
const checks = { synthesis: true, workbench: true, power: true, materials: true };
const outcomes = [
  { kind: 'creation', sourceId: 'slime-1' },
  { kind: 'care', sourceId: 'slime-1', createdByScientist: true, nutritionGain: 5, feedingDamage: 0, survived: true },
  { kind: 'evidence', sourceId: 'test-1', specimenId: 'slime-1', category: 'test' },
  { kind: 'research', sourceId: 'method-1' },
  { kind: 'income', sourceId: 'shipment-1', delivered: true, settled: true, amount: 10 }
];
const record = (state, outcome, at) => Campaign.record(state, { ...outcome, known: true, alive: true }, at);

test('six shared ambitions use the central theme selector without claiming future completion', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const roadmap = Campaign.roadmap(theme);
    expect(roadmap).toHaveLength(6);
    expect(roadmap.every(entry => entry.compatibility === 'shared')).toBe(true);
    expect(roadmap.at(-1)).toMatchObject({ id: 'divineRule', label: 'Rule over the gods' });
    expect(roadmap.at(-1).template).toContain('kill those who refuse');
    expect(Campaign.objectives(theme)).toHaveLength(6);
    expect(Campaign.objectives(theme).every(entry => entry.compatibility === 'shared')).toBe(true);
  }
  expect(Campaign.roadmap('invalid')).toEqual([]);
  expect(Campaign.accomplishments()).toEqual([]);
});

test('successful outcomes can arrive in any order and need a fresh ready local assessment', () => {
  let state = Campaign.assess(null, checks, 0, { known: true });
  for (const [index, outcome] of outcomes.slice().reverse().entries()) state = record(clone(state), outcome, index + 1);
  expect(state.accomplishedAt).toBeNull();
  state = Campaign.assess(state, checks, 10, { known: true });
  expect(state.accomplishedAt).toBe(10);
  expect(Campaign.accomplishments(state)).toHaveLength(7);
  const before = clone(state);
  for (const outcome of outcomes) state = record(state, outcome, 100);
  expect(state).toEqual(before);
});

test('bad feed, inherited specimens, predictions, advances and unpaid or failed deliveries do not count', () => {
  for (const changes of [{ createdByScientist: false }, { nutritionGain: 0 }, { nutritionGain: -1 }, { feedingDamage: 1 }, { survived: false }]) {
    expect(record(null, { ...outcomes[1], ...changes }, 1).objectives.care).toBeNull();
  }
  for (const changes of [{ delivered: false }, { settled: false }, { amount: 0 }, { amount: -5 }]) {
    expect(record(null, { ...outcomes[4], ...changes }, 1).objectives.income).toBeNull();
  }
  for (const changes of [{ category: 'prediction' }, { specimenId: '' }]) {
    expect(record(null, { ...outcomes[2], ...changes }, 1).objectives.evidence).toBeNull();
  }
});

test('unreported offsite changes and physical death freeze known campaign state', () => {
  const state = Campaign.assess(record(null, outcomes[0], 2), checks, 3, { known: true });
  for (const options of [{ known: false, alive: true }, { known: true, alive: false }]) {
    expect(Campaign.assess(clone(state), {}, 50, options)).toEqual(state);
    expect(Campaign.record(clone(state), { ...outcomes[4], ...options }, 50)).toEqual(state);
  }
  expect(JSON.stringify(state)).not.toMatch(/gods|population|genome|canonical/);
});

test('compromised operations prevent accomplishment but never erase historical receipts or end a run', () => {
  let state = outcomes.reduce((state, outcome) => record(state, outcome, 4), Campaign.normalize());
  for (const id of Campaign.CHECKS) {
    const failed = Campaign.assess(state, { ...checks, [id]: false }, 5, { known: true });
    expect(Campaign.ready(failed)).toBe(false);
    expect(failed.accomplishedAt).toBeNull();
    expect(Lifecycle.phase({ campaign: failed })).toBe('active');
  }
  state = Campaign.assess(state, checks, 6, { known: true });
  const compromised = Campaign.assess(clone(state), {}, 7, { known: true });
  expect(compromised.accomplishedAt).toBe(6);
  expect(compromised.objectives).toEqual(state.objectives);
});

test('normalization retains saved preferences and bounded known receipts without rewards or shared branches', () => {
  const saved = record({ guidanceEnabled: false, privateTruth: 'SECRET' }, { ...outcomes[0], summary: 'Created specimen', hidden: 'SECRET' }, 8);
  expect(Campaign.normalize(clone(saved))).toEqual(saved);
  expect(saved.guidanceEnabled).toBe(false);
  expect(JSON.stringify(saved)).not.toMatch(/SECRET|money|unlocks|victory|runEnded/);
  expect(Campaign.normalize().objectives.creation).toBeNull();
});

test('postmortem campaign accomplishments are frozen whitelisted known snapshots', () => {
  const state = { runEnded: true, clock: 20, seed: 'run' };
  const report = Lifecycle.captureReport(state, { accomplishments: [{ label: 'Create a living specimen', at: 3, hidden: 'SECRET' }] });
  expect(report.accomplishments).toEqual([{ label: 'Create a living specimen', at: 3 }]);
  state.postmortem = report;
  expect(Lifecycle.captureReport(state, { accomplishments: [{ label: 'Later', at: 30 }] })).toEqual(report);
  expect(JSON.stringify(report)).not.toContain('SECRET');
  expect(Lifecycle.normalizeReport({})).toMatchObject({ accomplishments: [] });
});

const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
async function start(page) {
  page.setDefaultTimeout(30000);
  const world = lifecycleWorld();
  await page.goto(appUrl);
  await page.evaluate(({ world, payload }) => {
    localStorage.clear();
    localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
    localStorage.setItem('helix-heresy-v2-library', JSON.stringify({ version: 2, worldIds: [world.id], runIds: [] }));
    localStorage.setItem(`helix-heresy-v2-world:${world.id}`, payload);
  }, { world: { id: world.id }, payload: Library.compressStorageText(JSON.stringify(world)) });
  await page.reload();
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();
  await page.locator('#seedInput').fill('campaign-lab');
  await page.locator('[data-starting-site-input]').first().check();
  await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
}
const campaign = page => page.evaluate(() => window.helixHeresyDebug.campaignSnapshot());

test('journal links real synthesis to saved progress, optional guidance and immutable death review', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await page.locator('[data-workspace-tab="journal"]').click();
  await expect(page.locator('#campaignContent')).toContainText('No deadlines');
  await expect(page.locator('[data-campaign-objective="creation"]')).toContainText('not yet recorded');
  await page.locator('[data-campaign-objective="creation"] button').click();
  await expect(page.locator('[data-workspace-tab="foundry"]')).toHaveAttribute('aria-current', 'page');
  await page.locator('#synthesizeBtn').click();
  expect((await campaign(page)).objectives.creation).toBeNull();
  await page.locator('[data-workspace-tab="tasks"]').click();
  // Finish first completes the physical material haul; work then has its own boundary.
  for (let attempt = 0; attempt < 5 && !(await campaign(page)).objectives.creation; attempt++) {
    await page.locator('[data-task-row]').filter({ hasText: 'Synthesize' }).getByRole('button', { name: 'Finish', exact: true }).click();
  }
  expect((await campaign(page)).objectives.creation).not.toBeNull();
  await page.locator('[data-workspace-tab="journal"]').click();
  await page.evaluate(() => {
    const saved = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    saved.journalMode = 'none';
    window.helixHeresyDebug.importSurveyExpeditionTestState(saved);
  });
  await expect(page.locator('#journalContent')).toContainText('Genetic notes disabled');
  await expect(page.locator('[data-campaign-objective="creation"]')).toContainText('recorded');
  await page.getByLabel('Show campaign guidance').uncheck();
  await expect(page.locator('[data-campaign-objective]')).toHaveCount(0);
  const before = await campaign(page);
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  expect(await campaign(page)).toEqual(before);
  await page.locator('[data-workspace-tab="journal"]').click();
  await expect(page.getByLabel('Show campaign guidance')).not.toBeChecked();
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  await expect(page.locator('#runOutcomeReport')).toContainText('Create a living specimen');
  const dead = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot().run);
  expect(dead.state.postmortem.accomplishments).toEqual([{ label: 'Create a living specimen', at: before.objectives.creation.at }]);
  await page.reload();
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="review-run"]').click();
  await expect(page.locator('#runOutcomeReport')).toContainText('Create a living specimen');
  await page.locator('#runOutcomeRestartBtn').click();
  await page.locator('[data-starting-site-input]').first().check();
  await page.locator('#startRunSubmitBtn').click();
  expect(Campaign.accomplishments(await campaign(page))).toEqual([]);
  expect(errors).toEqual([]);
});

test('local readiness responds to broken fixtures but freezes while offsite, and only settled sale earns income', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await page.locator('[data-workspace-tab="journal"]').click();
  await page.getByRole('button', { name: 'Assess Laboratory', exact: true }).click();
  expect((await campaign(page)).readiness).not.toBeNull();
  await page.evaluate(() => {
    const s = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    s.fixtures.find(f => f.id === 'starter-workbench').condition = 0;
    s.clock += 1;
    window.helixHeresyDebug.importSurveyExpeditionTestState(s);
  });
  expect((await campaign(page)).readiness.checks.workbench).toBe(false);
  const before = await campaign(page);
  await page.evaluate(() => {
    const s = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    s.surveyExpeditions.phase = 'outbound';
    s.surveyExpeditions.destination = { id: 'survey:a', cityId: 'a', label: 'Survey Ground', cellId: 'cell:1' };
    s.surveyExpeditions.departedAt = s.clock;
    s.fixtures.find(f => f.id === 'starter-workbench').condition = 100;
    s.clock += 10;
    s.economy.legalLedger.unshift({ id: 'remote-sale', kind: 'sale', amount: 10, at: s.clock });
    window.helixHeresyDebug.importSurveyExpeditionTestState(s);
  });
  expect(await campaign(page)).toEqual(before);
  await page.evaluate(() => {
    const s = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    s.surveyExpeditions.phase = 'home'; s.economy.legalLedger = [];
    s.economy.commodityConsignments.push({ id: 'campaign-sale', listingId: 'biomass', status: 'queued', quantity: 1, total: 25, freightFee: 0, unitPrice: 25 });
    window.helixHeresyDebug.importSurveyExpeditionTestState(s);
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.settleTestCommodityConsignment('campaign-sale'))).toBe(false);
  expect((await campaign(page)).objectives.income).toBeNull();
  await page.evaluate(() => {
    const s = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    // Transport is covered separately. This fixture starts at its arrival/settlement boundary.
    s.economy.commodityConsignments.find(c => c.id === 'campaign-sale').status = 'inTransit';
    window.helixHeresyDebug.importSurveyExpeditionTestState(s);
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.settleTestCommodityConsignment('campaign-sale'))).toBe(true);
  expect((await campaign(page)).objectives.income).toMatchObject({ summary: 'Completed legal shipment proceeds received.' });
  const final = await campaign(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.settleTestCommodityConsignment('campaign-sale'))).toBe(false);
  expect(await campaign(page)).toEqual(final);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect(await campaign(page)).toEqual(final);
  expect(errors).toEqual([]);
});

test('care and physical research complete the laboratory ambition once without free rewards', async ({ page }) => {
  test.setTimeout(240000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await page.locator('[data-workspace-tab="foundry"]').click();
  await page.locator('#synthesizeBtn').click();
  await page.locator('[data-workspace-tab="tasks"]').click();
  for (let attempt = 0; attempt < 5 && !(await campaign(page)).objectives.creation; attempt++) {
    await page.locator('[data-task-row]').filter({ hasText: 'Synthesize' }).getByRole('button', { name: 'Finish', exact: true }).click();
  }
  // Supply a hungry living subject and local material stocks at the care
  // boundary; physiology and transport have separate focused coverage.
  const id = await page.evaluate(() => {
    const s = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    const slime = s.slimes.find(slime => slime.source === 'Synthetic');
    if (!slime) throw new Error('Missing synthesized specimen fixture');
    slime.roomId = 'mainLab'; slime.deathAt = s.clock + 10000;
    slime.stats.nutrition.current = 10; slime.stats.bodyIntegrity.current = 100;
    for (const stack of s.physicalItemStacks.filter(stack => stack.section === 'resources')) {
      stack.roomId = 'mainLab'; stack.cell = { x: 50, y: 50, z: 0 }; stack.fixtureId = ''; stack.reservedTaskId = '';
    }
    window.helixHeresyDebug.importSurveyExpeditionTestState(s);
    return slime.id;
  });
  for (const key of ['organicFeedstock', 'mineralFeedstock', 'metalFeedstock', 'silicateFeedstock', 'chemicalFeedstock', 'arcaneFeedstock', 'carrionFeedstock', 'contaminatedFeedstock']) {
    if ((await campaign(page)).objectives.care) break;
    await page.evaluate(({ id, key }) => window.helixHeresyDebug.feedTestCampaignSpecimen(id, key), { id, key });
  }
  expect((await campaign(page)).objectives.care).not.toBeNull();
  await page.evaluate(id => {
    for (const specimenId of [id, 'prior-tested-specimen']) window.helixHeresyDebug.recordResearchEvidence({
      methodId: 'containment', category: 'test', specimenId, specimenName: specimenId,
      sourceKey: `completed-test:${specimenId}`, summary: 'A recorded physical containment test.'
    });
    window.helixHeresyDebug.addResearchSpecimenMaterial('Research tissue', 1);
    window.helixHeresyDebug.addResearchResource('glass', 2);
    window.helixHeresyDebug.addResearchResource('metalParts', 1);
  }, id);
  expect((await campaign(page)).objectives.evidence).not.toBeNull();
  const started = await page.evaluate(() => window.helixHeresyDebug.startResearchProject('reinforcedObservationVessels'));
  expect(started).toBe(true);
  const tasks = page.locator('[data-workspace-tab="tasks"]');
  // Starting research already opens Tasks; clicking the active tab toggles back to Map.
  if (await tasks.getAttribute('aria-current') !== 'page') await tasks.click();
  for (let attempt = 0; attempt < 8 && !(await campaign(page)).objectives.research; attempt++) {
    await page.locator('[data-task-row]').filter({ hasText: 'Reinforced Observation Vessels' }).getByRole('button', { name: 'Finish', exact: true }).click();
  }
  expect((await campaign(page)).objectives.research).not.toBeNull();
  await page.evaluate(() => {
    const s = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    s.economy.commodityConsignments.push({ id: 'ambition-sale', listingId: 'biomass', status: 'inTransit', quantity: 1, total: 25, freightFee: 0, unitPrice: 25 });
    window.helixHeresyDebug.importSurveyExpeditionTestState(s);
    window.helixHeresyDebug.settleTestCommodityConsignment('ambition-sale');
  });
  await page.locator('[data-workspace-tab="journal"]').click();
  const before = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  await page.getByRole('button', { name: 'Assess Laboratory', exact: true }).click();
  const complete = await campaign(page);
  expect(complete.readiness.checks).toEqual(checks);
  expect(complete.accomplishedAt).not.toBeNull();
  await expect(page.locator('#campaignContent')).toContainText('Next opportunities');
  const after = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(after.economy.money).toBe(before.economy.money);
  expect(after.research.unlocks).toEqual(before.research.unlocks);
  expect(after.physicalItemStacks).toEqual(before.physicalItemStacks);
  expect(after.runEnded).toBe(false);
  await page.getByRole('button', { name: 'Assess Laboratory', exact: true }).click();
  expect(await campaign(page)).toEqual(complete);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect(await campaign(page)).toEqual(complete);
  expect(errors).toEqual([]);
});
