const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { patronSource } = require('./helpers/patron-fixture');
const Religion = require('../religious-recognition');
test.setTimeout(600000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.divineInterventionSnapshot());
const act = (p, action) => p.evaluate(action => window.helixHeresyDebug.divineInterventionAction(action), action);
const tick = (p, n) => p.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), n);
async function visits(p) { await p.locator('[data-workspace-tab="visits"]').click(); }
async function finish(p) {
  await p.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 45; n++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) return;
      d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
    }
    throw new Error('Actual local walking did not finish');
  });
}
async function walk(p, cell) {
  expect(await p.evaluate(cell => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: cell, urgent: true, allowMultiRoom: true })), cell)).toBe(true);
  await finish(p);
}
async function reload(p) { await p.reload(); await p.locator('#loadLastSaveBtn').click(); await visits(p); }
async function setup(p, renderer) {
  p.setDefaultTimeout(20000); p.on('dialog', d => d.accept());
  await startLifecycleRun(p, `divine-intervention-${renderer}`);
  console.info(`${renderer}: real lifecycle run started`);
  await p.evaluate(({ renderer, scope }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'divine-intervention', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.cityConfrontationAction('walk')) throw new Error('Actual civic walk refused');
  }, { renderer, scope: Religion.SCOPE });
  await finish(p);
  console.info(`${renderer}: original civic ground reached`);
  await p.evaluate(scope => {
    const d = window.helixHeresyDebug; d.configureCityConfrontationTest();
    const current = d.cityConfrontationSnapshot().succession.source;
    d.configureCharterRecognitionTest({ bindInstitutions: true, policy: 'considerAdministrativeContinuity', rule: {
      id: 'prepared-original-law', principle: current.succession, reviewInstitutionId: current.institutions.find(i => i.role === 'civicReview').id,
      coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: [], text: 'Prepared independent civic review law.' } });
    d.configureIncumbentResistanceTest({ health: 48, mana: 0, policy: 'preserveLife', rulerCell: { x: 16, y: 8, z: 6 }, mastery: true });
    if (!d.incumbentResistanceAction('demand') || !d.incumbentResistanceAction('soulLash')) throw new Error('Actual coercion refused');
    if (!d.incumbentResistanceAction('accept', d.incumbentResistanceSnapshot().resistance.terms)) throw new Error('Original declaration refused');
    d.advanceSimulation(60);
  }, Religion.SCOPE);
  const source = await p.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().succession.source);
  const origin = patronSource(source.cityId, source.charterId);
  origin.faith.topicPositions = { warfare: 'defensiveOnly' };
  origin.god.expenditures = { communication: 7, avatars: 12, protection: 8 };
  expect(await p.evaluate(source => window.helixHeresyDebug.configureReligiousRecognitionTest({ source }), origin)).toBe(true);
  await visits(p);
  console.info(`${renderer}: actual coerced declaration and original religious source ready`);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: actual received coercion report, finite protecting avatar, physical resistance, nonaggression and saved expiry`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, renderer); const initial = await snap(page);
  expect(initial.saved.reports).toHaveLength(0); expect(initial.saved.avatars).toHaveLength(0);
  const originalWorld = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const originalDeclaration = await page.evaluate(() => window.helixHeresyDebug.incumbentResistanceSnapshot().resistance.receipt);
  await walk(page, { x: 18, y: 11, z: 6 });
  expect(await act(page, 'attackRepresentative')).toBe(true);
  let s = await snap(page);
  expect(s.saved.reports, JSON.stringify(s.context)).toHaveLength(1);
  expect(s.saved.reports[0].receivedAt).toBeNull(); expect(s.saved.job, JSON.stringify(s.context)).toBeTruthy();
  expect(s.religion.god.power.reserve).toBe(93);
  console.info(`${renderer}: original representative witnessed aggression; report transmission started`);
  await tick(page, 25); if (renderer === 'dom') await reload(page);
  s = await snap(page); expect(s.saved.job.progress).toBe(25);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ powered: false }));
  await tick(page, 60); expect((await snap(page)).saved.job.progress).toBe(25);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ powered: true }));
  await tick(page, 1); await tick(page, 95); s = await snap(page);
  expect(s.saved.avatars, JSON.stringify(s)).toHaveLength(1);
  expect(s.saved.reports[0].receivedAt).not.toBeNull(); expect(s.religion.god.power.reserve).toBe(73);
  expect(s.religion.attentionSeconds).toBe(420); expect(s.known.avatar.condition).toBe('physically present');
  console.info(`${renderer}: finite source-backed avatar physically manifested`);
  const id = s.saved.activeId, expiresAt = s.saved.avatars[0].expiresAt;
  await expect(page.locator('[data-divine-intervention]')).toContainText('No worship');
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), id)).toBe(false);
  // The body is physically adjacent, not a completed outcome inserted into saved state.
  const a = s.saved.avatars[0];
  if (Math.max(Math.abs(a.mapCell.x - 18), Math.abs(a.mapCell.y - 11)) > 1) {
    await tick(page, 1); s = await snap(page);
  }
  await page.locator('[data-divine-intervention-action="agree"]').click();
  expect((await snap(page)).saved.avatars[0].truce).toBeTruthy();
  await tick(page, 10); expect((await snap(page)).saved.avatars[0].truce).toBeTruthy();
  // Ordinary strikes wound the body through its finite per-hit ward cap.
  // Exhaustion of the complete ward pool is separately covered by focused model tests.
  for (let n = 0; n < 2; n++) {
    console.info(`${renderer}: actual physical strike ${n + 1}`);
    expect(await act(page, 'strike'), JSON.stringify((await snap(page)).context)).toBe(true);
    await tick(page, 2);
    const now = await snap(page);
    if (!now.saved.avatars[0].truce && now.context.canHear) expect(await act(page, 'agree')).toBe(true);
  }
  s = await snap(page); expect(s.saved.avatars[0].wardMana).toBeLessThan(60);
  expect(s.saved.avatars[0].health).toBeLessThan(120);
  expect(s.injuries.some(i => i.actorId === id && i.actorKind === 'divineAvatar')).toBe(true);
  const health = s.saved.avatars[0].health, mana = s.saved.avatars[0].wardMana;
  await reload(page); s = await snap(page);
  expect(s.saved.activeId).toBe(id); expect(s.saved.avatars[0].health).toBe(health); expect(s.saved.avatars[0].wardMana).toBe(mana);
  expect(s.saved.avatars[0].expiresAt).toBe(expiresAt); expect(s.religion.god.lifecycle).toEqual(initial.religion.god.lifecycle);
  expect(await page.evaluate(() => window.helixHeresyDebug.incumbentResistanceSnapshot().resistance.receipt)).toEqual(originalDeclaration);
  await walk(page, { x: 9, y: 10, z: 6 });
  expect((await snap(page)).context.avatarVisible).toBe(false);
  const dated = (await snap(page)).known;
  // Ordinary time advancement may stop at a telegraph; after withdrawal there is none.
  for (let n = 0; n < 10 && (await snap(page)).clock <= expiresAt; n++) await tick(page, 120);
  s = await snap(page); expect(s.saved.avatars[0].manifested).toBe(false);
  expect(s.saved.job).toBeNull();
  expect(s.known).toEqual(dated); expect(s.saved.avatars).toHaveLength(1); expect(s.religion.god.lifecycle.lifeState).toBe('living');
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(originalWorld);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = s.saved;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(500); });
  expect((await snap(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
  if (renderer === 'dom') {
    await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
    await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
    expect((await snap(page)).saved).toBeNull();
  }
});

test('dom: actual separate personal nonintervention, attended work, outages, saved evidence, continued copy and witnessed breach', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'dom');
  // Setup's actual civic walk already leaves the scientist at the counter.
  const book = () => page.evaluate(() => window.helixHeresyDebug.divineCapabilitiesSnapshot());
  const panel = page.locator('[data-divine-nonintervention]');
  let s = await book(); expect(s.context.receiveAtCounter, JSON.stringify(s.context)).toBe(true);
  const originalWorld = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const declaration = await page.evaluate(() => window.helixHeresyDebug.incumbentResistanceSnapshot().resistance.receipt);
  await panel.locator('[data-divine-nonintervention-action="propose"]').click();
  await expect(panel).toContainText('For four days'); await expect(panel).toContainText('No worship');
  await panel.locator('[data-divine-nonintervention-action="accept"]').click();
  s = await book(); expect(s.saved.job, JSON.stringify(s.context)).toBeTruthy();
  expect(s.saved.records[0].god.power.reserve).toBe(93); expect(s.known).toHaveLength(0);
  await tick(page, 25); await reload(page); s = await book(); expect(s.saved.job.progress).toBe(25);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ powered: false }));
  await tick(page, 60); expect((await book()).saved.job.progress).toBe(25);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ powered: true }));
  await tick(page, 1); await tick(page, 155); s = await book();
  expect(s.saved.job, JSON.stringify(s.context)).toBeNull(); expect(s.saved.agreements).toHaveLength(1);
  expect(s.known).toHaveLength(1); expect(s.facts[0].fact.state).toBe('qualifying');
  expect((await snap(page)).saved.avatars).toHaveLength(0);
  expect(s.evidence.find(e => e.sourceId === 'god:a').account.scope).toContain('personal terrestrial nonintervention');
  const received = s.known, reserve = s.saved.records[0].god.power.reserve;
  await walk(page, { x: 9, y: 10, z: 6 }); await tick(page, 60); expect((await book()).known).toEqual(received);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const previousRun = (await book()).saved.runId;
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-divine-restraint.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await visits(page);
  s = await book(); expect(s.saved.runId).not.toBe(previousRun); expect(s.saved.records[0].god.power.reserve).toBe(reserve);
  expect(s.known).toEqual(received); expect(s.facts[0].fact.state).toBe('qualifying');
  await walk(page, { x: 18, y: 11, z: 6 }); expect(await act(page, 'attackRepresentative')).toBe(true);
  await tick(page, 120); s = await book();
  expect(s.saved.agreements[0].breachedAt).not.toBeNull(); expect(s.facts[0].fact.state).toBe('unverified');
  // No remote rewrite of the held signed document. Reception is a separate action.
  expect(s.known).toEqual(received);
  await walk(page, { x: 17, y: 8, z: 6 });
  expect(await page.evaluate(() => window.helixHeresyDebug.divineNoninterventionAction('receive'))).toBe(true);
  expect((await book()).known.at(-1).state).toBe('receivedBreach');
  expect(await page.evaluate(() => window.helixHeresyDebug.incumbentResistanceSnapshot().resistance.receipt)).toEqual(declaration);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(originalWorld);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = (await book()).saved;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(500); });
  expect((await book()).saved).toEqual(frozen); expect(errors).toEqual([]);
});
