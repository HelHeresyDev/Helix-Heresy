const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.divineBodiesSnapshot());
const act = (p, action, id) => p.evaluate(({ action, id }) => window.helixHeresyDebug.divineBodyAction(action, id), { action, id });
const tick = (p, n) => p.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), n);
async function finish(p) {
  await p.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 60; n++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw Error(`Actual walking/packing did not finish: ${JSON.stringify(d.surveyExpeditionSnapshot().tasks)}`);
  });
}
async function walk(p, cell) {
  expect(await p.evaluate(cell => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: cell, urgent: true, allowMultiRoom: true })), cell)).toBe(true);
  await finish(p);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: true individual research, physical discovery, supplied combat, saved consequences and independent survival`, async ({ page }) => {
  page.setDefaultTimeout(25000); page.on('dialog', d => d.accept());
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, `true-body-${renderer}`);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  expect(await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const god = { id: 'god:original-a', stableIdentity: { mortalIdentityId: 'original-mortal-a', originKind: renderer === 'dom' ? 'human' : 'beast' },
      domains: ['fire', 'war'], lifecycle: { lifeState: 'living', divinityState: 'divine' },
      divineCore: { identityBound: true, state: 'stable', repeatableSignature: 'original-physical-signature', innateCapacity: 400, receivingCapacity: 600 },
      power: { reserve: 1400, reserveCapacity: 2000, worshipIncome: 100 }, expenditures: { communication: 7, protection: 8, miracles: 10 },
      worshipSources: [{ populationSourceId: 'original-population-a', followerUnits: 12 }] };
    return d.configureDivineBodiesTest({ god, home: { godId: god.id, cityId: 'a', cellId: 'planet-cell:00001', placeId: 'city:a', name: 'Original Ember God' },
      priorBeaconScholarship: true, skills: { animancy: 201, fabrication: 151, materialsScience: 101, striking: 201, guarding: 201, evasion: 201, perception: 201 },
      materials: { arcaneFeedstock: 40, metalParts: 8, glass: 8 } });
  }, renderer)).toBe(true);
  let s = await snap(page); expect(s.known).toEqual([]); expect(s.research.projects.divineCoreResonance.status).not.toBe('completed');
  const originalStock = s.stacks.reduce((n, i) => n + i.quantity, 0), originals = s.owners.originals;
  expect(await page.evaluate(() => window.helixHeresyDebug.startResearchProject('divineCoreResonance')), s.researchReason).toBe(true);
  for (let n = 0; n < 6 && (await snap(page)).research.projects.divineCoreResonance.status !== 'completed'; n++) {
    s = await snap(page); const t = s.tasks.find(t => t.type === 'researchWork'); expect(t).toBeTruthy();
    await page.evaluate(n => window.helixHeresyDebug.advanceSoulBeaconsForTest(n), Math.max(60, t.dueAt - s.clock + 60));
  }
  s = await snap(page); expect(s.research.projects.divineCoreResonance.status).toBe('completed');
  expect(s.stacks.reduce((n, i) => n + i.quantity, 0)).toBe(originalStock - 12);
  console.info(`${renderer}: actual late research and original materials consumed`);
  await page.evaluate(() => window.helixHeresyDebug.setInstrumentCalibration('thaumometer', 90));
  expect(await act(page, 'packInstrument')).toBe(true); await finish(page);
  expect(await act(page, 'packReagents')).toBe(true); await finish(page);
  s = await snap(page); expect(s.stacks.filter(i => i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0)).toBe(12);
  // Prepared initial municipal access, not a discovered location, signature,
  // encounter outcome, wounded god, refilled reserve or completed new research.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'true-body', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
  });
  await page.locator('[data-workspace-tab="visits"]').click();
  await walk(page, { x: 10, y: 15, z: 6 });
  s = await snap(page); const id = s.saved.bodies[0].id, panel = page.locator('[data-divine-bodies]');
  expect(s.known).toHaveLength(1); expect(s.known[0].identified).toBe(false);
  await panel.locator('[data-divine-body-action="examine"]').click(); await tick(page, 40);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page)).saved.job.progress).toBe(40); await tick(page, 80);
  s = await snap(page); expect(s.saved.bodies[0].identified).toBeTruthy(); expect(s.known[0].name).toBe('Original Ember God');
  expect(s.stacks.filter(i => i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0)).toBe(10);
  console.info(`${renderer}: physical approach and saved personal signature examination completed`);
  if (renderer === 'dom') {
    await panel.locator('[data-divine-body-action="resonance"]').click(); await tick(page, 1);
    s = await snap(page); expect(s.combat.pendingActions.scientist.resonancePaymentId).toBeTruthy();
    const partial = s.combat.pendingActions.scientist;
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-true-body.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click();
    s = await snap(page); expect(s.combat.pendingActions.scientist).toEqual(partial); expect(s.saved.bodies).toHaveLength(1);
    for (let n = 0; n < 60 && (await snap(page)).saved.bodies[0].status !== 'dead'; n++) {
      s = await snap(page);
      if (!s.combat.pendingActions.scientist && s.clock >= (s.combat.actorRecoveryUntil.scientist || 0)) {
        const enabled = panel.locator('[data-divine-body-action="resonance"]');
        const observed = s.known.find(a => a.id === id);
        // Fight the actual moving opponent: guard while it withdraws, then
        // charge against its freshly telegraphed stationary attack (or visible
        // incapacity). Firing repeatedly at a moving last-known tile should fail.
        if (await enabled.isEnabled() && (observed?.pending?.releaseAt - s.clock >= 2.99 || observed?.condition === 'incapacitated')) await enabled.click();
        else if (!s.combat.guarding.scientist) expect(await act(page, 'guard', id)).toBe(true);
      }
      await tick(page, 1);
    }
    s = await snap(page); expect(s.saved.bodies[0].death, JSON.stringify({ body: s.saved.bodies[0], payments: s.saved.payments, contexts: s.contexts, health: s.health })).toBeTruthy();
    expect(s.owners.records[0].god.lifecycle.lifeState).toBe('dead'); expect(s.owners.incidents.filter(i => i.kind === 'trueIndividualDeath')).toHaveLength(1);
    expect(s.injuries.some(i => i.actorId === id && i.actorKind === 'divineIndividual')).toBe(true);
    const before = s.saved.bodies[0]; await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
    expect((await snap(page)).saved.bodies[0]).toEqual(before); expect((await snap(page)).health).toBeGreaterThan(0);
  } else {
    expect(await act(page, 'strike', id)).toBe(false); // Still outside ordinary one-metre reach.
    await walk(page, { x: 9, y: 16, z: 6 });
    expect(await act(page, 'strike', id)).toBe(true); expect(await act(page, 'guard', id)).toBe(true);
    await walk(page, { x: 19, y: 8, z: 6 });
    s = await snap(page); expect(s.health).toBeGreaterThan(0); expect(s.saved.bodies[0].death).toBeNull();
    expect(s.owners.records[0].god.lifecycle.lifeState).toBe('living'); expect(s.owners.records[0].god.power.reserve).toBeLessThan(1400);
    const frozen = { saved: s.saved, owners: s.owners, stacks: s.stacks, clock: s.clock };
    await page.evaluate(() => { window.helixHeresyDebug.inflictTestScientistDamage(); window.helixHeresyDebug.advanceTestRunTime(1000); });
    s = await snap(page); expect({ saved: s.saved, owners: s.owners, stacks: s.stacks, clock: s.clock }).toEqual(frozen);
  }
  expect((await snap(page)).owners.originals).toEqual(originals);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
