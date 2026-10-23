const { test, expect } = require('@playwright/test');
const { openForeignWorkspace, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.wardResearchSnapshot());
const action = (page, action, expected = null) => page.evaluate(({ action, expected }) =>
  window.helixHeresyDebug.wardResearchAction(action, expected), { action, expected });
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceWardResearchForTest(seconds), seconds);
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
async function walk(page, kind) {
  expect(await action(page, kind), JSON.stringify(await snap(page))).toBe(true);
  for (let n = 0; n < 15; n++) {
    const s = await snap(page), t = s.tasks[0]; if (!t) return;
    expect(t.reason, JSON.stringify(t)).toBe(''); await advance(page, Math.max(1, Math.ceil(t.dueAt - s.clock + 1)));
  }
  throw new Error('Original physical walking did not complete');
}
async function prepareResearch(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.paused = true;
    // Explicit earlier scientific experience and resources, never a completed
    // ward project, installed fitting, measured benefit or political outcome.
    for (const id of ['materialsScience', 'animancy', 'fabrication']) { s.scientist.skills[id] ||= {}; s.scientist.skills[id].xp = 100000000; }
    s.research = window.HelixResearchSystem.defaultState(); s.research.projects.reinforcedObservationVessels.status = 'completed';
    s.research.evidence = ['earlier-specimen-a', 'earlier-specimen-b'].map((specimenId, i) => ({ id: `prior-element-${i}`, methodId: 'element',
      sourceKey: `earlier-element:${specimenId}`, specimenId, observedAt: s.clock, summary: 'Explicit earlier elemental observation.' }));
    d.importSurveyExpeditionTestState(s);
    d.configureHiddenWorkshopTest({ supplies: { metalParts: 2, glass: 2, arcaneFeedstock: 2 } });
    if (!d.startResearchProject('wardEfficiencyCoupling')) throw new Error('Original research work/material route unavailable');
  });
  const start = await page.evaluate(() => { const s = window.helixHeresyDebug.exportSurveyExpeditionTestState(); return { clock: s.clock, task: s.tasks.find(t => t.type === 'researchWork') }; });
  expect(start.task).toBeTruthy();
  await page.evaluate(seconds => window.helixHeresyDebug.advanceWardTheoryForTest(seconds), Math.max(1, Math.floor((start.task.dueAt - start.clock) / 2)));
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), t = s.tasks.find(t => t.type === 'researchWork');
    if (t) d.advanceWardTheoryForTest(Math.max(1, t.dueAt - s.clock + 2)); });
  expect((await page.evaluate(() => window.helixHeresyDebug.researchSnapshot())).projects.wardEfficiencyCoupling.status).toBe('completed');
  expect((await page.evaluate(() => window.helixHeresyDebug.researchSnapshot())).unlocks).toContain('procedure:wardEfficiencyTrial');
  console.info('Actual ward research completed at the home bench, across reload.');
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, ids = d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer'],
      supplies: { glass: 1, rubber: 3, preparedManaCrystals: 1, drinkingWater: 1, trailMeal: 1 } });
    const s = d.exportSurveyExpeditionTestState();
    for (const id of ids) { const i = s.physicalItemStacks.find(i => i.id === id); if (!d.carryActorStack('scientist', id, i.quantity)) throw new Error('Original prototype cargo not carried'); }
  });
}
async function setup(page, renderer) {
  page.on('dialog', d => d.accept());
  await openForeignWorkspace(page, `ward-research-${renderer}`, renderer, false, false, 6, false, false, prepareResearch);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    // Explicit original neighboring treasury/exchange account before any
    // scientific agreement; no signature or demonstration awards public funds.
    d.setForeignSuppliesTestContext({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' }, standings: [], market: { listings: {} } });
    if (!d.setForeignCivicBargainTestSource({ cityId: 'b', charterId: 'charter:b', administrationId: 'admin:b', defenseId: 'defense:b',
      defenseName: 'Original B Defense', populationSourceId: 'population:b', authority: { id: 'ruler:b', kind: 'collective', name: 'Independent B Council' },
      archive: { routeId: 'route:ab', source: 'Unreleased original chart', sourceDate: null,
        coverage: [{ cellId: 'planet-cell:00001', latitude: 12, longitude: 20 }, { cellId: 'planet-cell:00002', latitude: 16, longitude: 21 }], notes: ['Withheld'] } })) throw new Error('Original civic source unavailable');
    if (!d.setOuterApproachTestSource('b', { cityId: 'b', cityName: 'City B', charterId: 'charter:b', institutionId: 'defense:b',
      populationSourceId: 'population:b', population: 100, installationId: 'population:b:existing-approach-ward', condition: 80, baselineEnergy: 69120 })) throw new Error('Original installation unavailable');
  });
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: earned ward research, civilian paired trial, actual tuning, finite technical compact and safe handback survive saves`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer);
  const original = await snap(page), world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const panel = page.locator('[data-ward-research]'); await expect(panel).toContainText('Ward-Efficiency Compact');
  const eligibility = Object.fromEntries(['local', 'atDesk', 'researched', 'visitorPermit', 'busy'].map(k => [k, original.context[k]]));
  console.info(`${renderer}: civilian reception reached`, JSON.stringify(eligibility));
  await expect(panel.locator('[data-ward-research-action="authorize"]'), JSON.stringify(eligibility)).toBeEnabled();
  await panel.locator('[data-ward-research-action="authorize"]').click(); await advance(page, 60);
  let s = await snap(page); expect(s.saved?.job?.kind, JSON.stringify({ saved: s.saved, context: s.context && {
    free: s.context.free, atDesk: s.context.atDesk, defenderPresent: s.context.defenderPresent, current: s.context.authorityCurrent }, treasury: s.treasury })).toBe('authorize'); expect(s.saved.authorization).toBeNull();
  await reload(page); await advance(page, 60); s = await snap(page); expect(s.saved.authorization, JSON.stringify(s)).toBeTruthy();
  expect(s.front.layout.stagingSiteId).toBeNull(); expect(s.front.claim).toBeNull(); // No military march/claim required.
  console.info(`${renderer}: original civilian trial authorized across reload.`);
  const defenderId = s.defender.id, mana = s.defender.wardMana;
  await walk(page, 'walkStation'); expect(await action(page, 'baseline')).toBe(true); await advance(page, 120);
  s = await snap(page); expect(s.saved.baseline.energySpent).toBe(120);
  expect(await action(page, 'install')).toBe(true); await advance(page, 75);
  const partial = (await snap(page)).saved.job; expect(partial.progress).toBe(75); await reload(page);
  expect((await snap(page)).saved.job.progress).toBe(75); expect(await action(page, 'cancel')).toBe(true);
  expect((await snap(page)).saved.partialInstall.progress).toBe(75);
  expect(await action(page, 'install')).toBe(true); await advance(page, 105);
  s = await snap(page); expect(s.front.station.efficiency).toBeTruthy(); expect(s.front.station.efficiency.certified).toBe(false);
  expect(await action(page, 'improved')).toBe(true); await advance(page, 60); await reload(page); await advance(page, 60);
  s = await snap(page); expect(s.saved.demonstration.energySpent, JSON.stringify(s)).toBe(90); expect(s.saved.demonstration.saving).toBe(.25);
  console.info(`${renderer}: original prototype and actual paired measurements completed.`);
  expect(s.defender.wardMana).toBe(mana); expect(s.front.station.energy + s.front.station.standbySpent + s.front.station.combatSpent).toBe(s.front.station.initialEnergy);
  await walk(page, 'desk'); expect(await action(page, 'negotiate')).toBe(true); await advance(page, 120);
  s = await snap(page); expect(s.saved.offer).toBeTruthy(); const treasury = s.treasury, wallet = s.money;
  expect(await action(page, 'sign', { ...s.saved.offer, fee: 9999 })).toBe(false);
  await panel.locator('[data-ward-research-action="sign"]').click(); await advance(page, 30); await reload(page); await advance(page, 30);
  s = await snap(page); expect(s.saved.status, JSON.stringify(s)).toBe('active'); expect(s.treasury).toBe(treasury - 120); expect(s.money).toBe(wallet);
  console.info(`${renderer}: exact finite technical compact signed across reload.`);
  await walk(page, 'walkStation'); expect(await action(page, 'conservative')).toBe(true);
  const conservative = (await snap(page)).front.station.energy; await advance(page, 12); expect(conservative - (await snap(page)).front.station.energy).toBe(12);
  expect(await action(page, 'economical')).toBe(true); const economic = (await snap(page)).front.station.energy;
  // Exercise the normal simulation heartbeat as well as the focused fixture clock.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(12)); expect(economic - (await snap(page)).front.station.energy).toBe(9);
  expect(await action(page, 'report')).toBe(true); const dated = (await snap(page)).saved.report;
  s = await snap(page); await advance(page, s.saved.cycles[0].dueAt - s.clock);
  expect((await snap(page)).saved.status).toBe('cure'); expect((await snap(page)).saved.report).toEqual(dated);
  expect(await action(page, 'maintain')).toBe(true); await advance(page, 60); await reload(page);
  s = await snap(page); expect(s.tools.find(t => t.key === 'masonryHammer').tool.reservedTaskId).toBe(s.saved.job.id);
  await advance(page, 60);
  s = await snap(page); expect(s.saved.earned).toBe(60); expect(s.money).toBe(wallet);
  console.info(`${renderer}: first original-material upkeep earned local pay across reload.`);
  await walk(page, 'desk'); expect(await action(page, 'collect')).toBe(true); expect(await action(page, 'collect')).toBe(false);
  expect((await snap(page)).money).toBe(wallet + 60);
  if (renderer === 'dom') {
    await walk(page, 'walkStation'); s = await snap(page); await advance(page, s.saved.cycles[1].dueAt - s.clock);
    expect(await action(page, 'maintain')).toBe(true); await advance(page, 120); expect((await snap(page)).saved.status).toBe('completed');
    expect(await action(page, 'conservative')).toBe(false); await walk(page, 'desk'); expect(await action(page, 'collect')).toBe(true);
    s = await snap(page); expect(s.money).toBe(wallet + 120); expect(s.saved.refunded).toBe(0);
  } else {
    expect(await action(page, 'terminate')).toBe(true); s = await snap(page); expect(s.saved.status).toBe('terminated'); expect(s.saved.refunded).toBe(60);
    expect(await action(page, 'terminate')).toBe(false); expect(await action(page, 'walkStation')).toBe(false);
    expect(s.treasury).toBe(treasury - 60); expect(s.money).toBe(wallet + 60);
  }
  expect(await action(page, 'report')).toBe(true); const final = await snap(page); await reload(page); s = await snap(page);
  expect(s.saved).toEqual(final.saved); expect(s.front.station.efficiency.id).toBe(final.front.station.efficiency.id);
  expect(s.defender.id).toBe(defenderId); expect(s.front.claim).toBeNull(); expect(s.campaign).toEqual(original.campaign);
  expect(s.front.station.efficiency.cityOwnerId).toBe('b'); expect(s.front.station.energy).toBeGreaterThan(0);
  const frozen = s.saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await advance(page, 10);
  expect((await snap(page)).saved).toEqual(frozen);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
