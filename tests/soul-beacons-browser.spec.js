const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.soulBeaconSnapshot());
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceSoulBeaconsForTest(n), seconds);
async function finish(page) {
  for (let n = 0; n < 8; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['soulBeaconWork', 'homunculusWork', 'researchWork'].includes(t.type));
    if (!t) return;
    await advance(page, Math.max(60, t.dueAt - s.clock + 60));
  }
  const s = await snapshot(page); expect(s.tasks, JSON.stringify(s.events.slice(-3))).toEqual([]);
}
async function action(page, action, id = '') {
  const staged = await page.evaluate(({ action, id }) => window.helixHeresyDebug.stageSoulBeaconTestSupplies(action, id), { action, id });
  expect(staged, `stage ${action}: ${JSON.stringify(await page.evaluate(({ action, id }) => window.helixHeresyDebug.soulBeaconWorkPreview(action, id), { action, id }))}`).toBe(true);
  const queued = await page.evaluate(({ action, id }) => window.helixHeresyDebug.soulBeaconAction(action, id), { action, id });
  const s = await snapshot(page); expect(queued, `${action}: ${JSON.stringify(s.events.slice(-3))}`).toBe(true);
  await finish(page);
}
async function research(page, id) {
  const ok = await page.evaluate(id => window.helixHeresyDebug.startResearchProject(id), id);
  expect(ok, `${id}: ${JSON.stringify((await snapshot(page)).events.slice(-3))}`).toBe(true);
  await finish(page); expect((await snapshot(page)).research.projects[id].status).toBe('completed');
}
test('physical research, seven-day receiver, finite charging, saved choice and exactly-once imperfect return', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'late-game-soul-beacon');
  const canonical = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world));
  expect(await page.evaluate(() => window.helixHeresyDebug.soulBeaconAction('original', 'starter-exhausted-beacon'))).toBe(false);
  const before = await snapshot(page), ids = await page.evaluate(() => window.helixHeresyDebug.configureSoulBeaconTestLaboratory());
  const waterBefore = (await snapshot(page)).fixtures.filter(f => f.typeId === 'waterCisternPump').reduce((n, f) => n + (f.utility.contents.cleanWater || 0), 0);
  expect((await snapshot(page)).campaign).toEqual(before.campaign);
  await page.locator('[data-workspace-tab="research"]').click(); await expect(page.locator('[data-soul-beacons]')).toContainText('Master Animancy');
  await test.step('Examine the recovered apparatus and earn both construction projects', async () => {
    await action(page, 'original', ids.original); await research(page, 'soulBeaconReconstruction'); await research(page, 'receivingBodyDevelopment');
  });
  for (const a of ['sample', 'examineTemplate']) {
    expect(await page.evaluate(a => window.helixHeresyDebug.stageSoulBeaconTestSupplies(a), a)).toBe(true);
    expect(await page.evaluate(a => window.helixHeresyDebug.homunculusAction(a), a)).toBe(true); await finish(page);
  }
  await action(page, 'medium'); await action(page, 'inspect', ids.chamber); await action(page, 'grow', ids.chamber);
  let s = await snapshot(page), r = s.saved.receivers[0]; expect(r.status).toBe('growing'); expect(r.soulId).toBeNull();
  await action(page, 'upkeep', r.id);
  await advance(page, 11 * 3600); await action(page, 'care', r.id);
  s = await snapshot(page); const progress = s.saved.receivers[0].progressSeconds;
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snapshot(page)).saved.receivers[0].progressSeconds).toBe(progress);
  for (let n = 0; n < 16 && (await snapshot(page)).saved.receivers[0].status === 'growing'; n++) {
    await advance(page, 11 * 3600); if ((await snapshot(page)).saved.receivers[0].status === 'growing') await action(page, 'care', r.id);
  }
  s = await snapshot(page); r = s.saved.receivers[0]; expect(r.status, r.reason).toBe('ready'); expect(r.health).toBe(100);
  expect(r.consumed).toEqual({ biomass: 80, growthMedium: 24, geneticMaterial: 10, humanTissueTemplate: 1 });
  expect(s.fixtures.filter(f => f.typeId === 'sumpTank').reduce((n, f) => n + (f.utility.contents.homunculusWaste || 0), 0)).toBeGreaterThan(168);
  expect(s.fixtures.filter(f => f.typeId === 'waterCisternPump').reduce((n, f) => n + (f.utility.contents.cleanWater || 0), 0)).toBeLessThan(waterBefore - 168);
  await action(page, 'examine', r.id); await action(page, 'charge', ids.beacon); await advance(page, 6 * 3600);
  s = await snapshot(page); const b = s.saved.beacons[0]; expect(b.charge).toBe(24);
  await action(page, 'examine', b.id); await research(page, 'soulTransferIntegration'); await action(page, 'arm', b.id);
  s = await snapshot(page); expect(s.saved.beacons[0].armed, JSON.stringify(s.readiness)).toBe(true); expect(s.readiness[0].reason).toBe('');
  expect(s.saved.receivers[0].supportConsumed).toBeGreaterThan(0); expect(s.saved.receivers[0].supportConsumed).toBeLessThan(7);
  await page.evaluate(() => window.helixHeresyDebug.setSoulBeaconTestSupport({ carriedItem: true, soulDamage: 10, sourceId: 'one-real-soul-wound' }));
  const alive = await snapshot(page), goods = alive.stacks.find(i => i.carriedBy === 'scientist'); expect(goods).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage('combat'));
  await expect(page.locator('#runOutcomeHeading')).toHaveText('Resurrection handoff pending');
  await expect(page.locator('[data-soul-beacon-confirm]')).toBeDisabled();
  s = await snapshot(page); expect(s.remains).toHaveLength(1); expect(s.saved.soul.integrity).toBe(90); expect(s.ended).toBe(false);
  const deathId = s.saved.handoff.deathId; const frozen = s.clock;
  await advance(page, 86400); expect((await snapshot(page)).clock).toBe(frozen);
  await page.locator('[data-soul-beacon-destination]').check();
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await expect(page.locator('[data-soul-beacon-destination]')).toBeChecked();
  page.once('dialog', dialog => dialog.accept()); await page.locator('[data-soul-beacon-confirm]').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  s = await snapshot(page); expect(s.scientist.vitals.health.current).toBe(100); expect(s.scientist.vocalBodyId).toBe(r.id);
  expect(s.scientist.skills.animancy.xp).toBe(before.scientist.skills.animancy.xp); expect(s.saved.beacons[0].charge).toBe(0); expect(s.saved.soul.integrity).toBe(90);
  expect(s.saved.transfers).toHaveLength(1); expect(s.remains[0].body.skills.animancy.xp).toBeGreaterThan(0);
  expect(s.research).toEqual(alive.research); expect(s.campaign).toEqual(alive.campaign); expect(s.legal).toEqual(alive.legal);
  const dropped = s.stacks.find(i => i.id === goods.id); expect(dropped.carriedBy).toBe(''); expect(dropped.cell).toEqual(s.remains[0].location.mapCell);
  expect(await page.evaluate(id => window.helixHeresyDebug.confirmSoulBeaconRecoveryForTest(id), deathId)).toBe(false);
  expect(await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world))).toBe(canonical);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved.transfers).toHaveLength(1);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage('handling'));
  await expect(page.locator('#runOutcomeHeading')).toHaveText('Run ended');
  s = await snapshot(page); expect(s.deaths.records).toHaveLength(2); expect(s.remains).toHaveLength(2); expect(s.saved.transfers).toHaveLength(1);
  expect(errors).toEqual([]);
});
test('clearing an embodied receiving chamber cannot duplicate the living body as tissue', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'consumed-receiver-cleanup');
  const ids = await page.evaluate(() => window.helixHeresyDebug.configureSoulBeaconTestLaboratory());
  await page.evaluate(ids => {
    // Explicit already-consumed late-game test fixture. No ordinary receiver,
    // earned research, charge, resurrection receipt or campaign outcome granted.
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    const cell = d.soulBeaconWorkPreview('inspect', ids.chamber).cell;
    saved.soulBeacons.receivers.push({ id: 'explicit-embodied-receiver', chamberId: ids.chamber, donorSoulId: saved.soulBeacons.soul.id,
      status: 'embodied', soulId: saved.soulBeacons.soul.id, soulFormationPrevented: true, health: 100, cleared: false,
      progressSeconds: 7 * 86400, consumed: { biomass: 80, growthMedium: 24, geneticMaterial: 10, humanTissueTemplate: 1 },
      stocks: [], supportStocks: [], location: { roomId: 'mainLab', cell } });
    saved.scientist.vocalBodyId = 'explicit-embodied-receiver'; d.importSurveyExpeditionTestState(saved);
  }, ids);
  const before = (await snapshot(page)).stacks.filter(i => i.key === 'grownTissue');
  await action(page, 'clear', 'explicit-embodied-receiver');
  const s = await snapshot(page); expect(s.saved.receivers[0].cleared).toBe(true);
  expect(s.stacks.filter(i => i.key === 'grownTissue')).toEqual(before);
  expect(s.scientist.vocalBodyId).toBe('explicit-embodied-receiver'); expect(s.scientist.vitals.health.current).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
