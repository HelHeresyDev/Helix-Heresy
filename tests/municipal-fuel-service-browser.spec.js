const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
const { inputs } = require('./helpers/municipal-fuel-source');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.municipalFuelServiceSnapshot());
const tick = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n, false), seconds);
async function reload(page) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: actual original powerworks contract, physical fuel delivery, municipal processing, cancellation and saved partial work`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `municipal-fuel-${renderer}`); await prepareHome(page, renderer, { sustain: false });
  await page.locator('[data-workspace-tab="visits"]').click();
  expect(await page.evaluate(() => window.helixHeresyDebug.cityRuleAction('operate'))).toBe(true); await tick(page, 3600);
  const rule = await page.evaluate(() => window.helixHeresyDebug.cityRuleSnapshot().saved);
  expect(rule.plan).toBeTruthy();
  expect(await page.evaluate(prior => window.helixHeresyDebug.configureMunicipalFuelServiceTest(prior), {
    ...inputs(rule.source.populationSourceId), stocks: { arcaneFeedstock: 30, fieldRation: 30, drinkingWater: 30 }
  })).toBe(true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const panel = page.locator('[data-municipal-fuel-service]'), before = await snap(page);
  expect(before.context.authority).toBe(true); expect(before.context.otherBusy).toBe(false);
  await panel.locator('[aria-label="Fuel units per trip"]').fill('4');
  await panel.locator('[data-fuel-service-action="quote"]').click();
  await expect(panel).toContainText('4 units per trip');
  await panel.locator('[data-fuel-service-action="sign"]').click(); await tick(page, 43);
  let s = await snap(page); expect(s.saved.job?.progress, JSON.stringify(s.context)).toBe(43);
  expect(s.money).toBe(before.money); expect(s.saved.contract).toBeNull();
  await reload(page); expect((await snap(page)).saved.job.progress).toBe(43);
  await tick(page, 77); s = await snap(page); expect(s.saved.contract).toBeTruthy(); expect(s.money).toBe(before.money - 500);
  expect(s.saved.mission).toBeNull(); expect(s.rule.powerFuel.received).toBe(0);
  const dated = s.public; await tick(page, 1); s = await snap(page);
  expect(s.saved.mission).toBeTruthy(); expect(s.listings.arcaneFeedstock.supply).toBe(26);
  const mission = s.saved.mission, spent = s.saved.spent;
  expect(s.production.trucks.find(t => t.id === mission.truckId).shipment).toBe(mission.id);
  expect(s.money + s.saved.balance + s.saved.spent).toBe(before.money);
  expect(s.public).toEqual(dated);
  await panel.locator('[data-fuel-service-action="cancel"]').click();
  await panel.locator('[data-fuel-service-action="refund"]').click(); s = await snap(page);
  expect(s.money).toBe(before.money - spent); expect(s.saved.balance).toBe(0);
  const cancellationReceipt = s.public;
  await tick(page, 3599); s = await snap(page); expect(s.rule.powerFuel.received).toBe(0);
  await tick(page, 25); s = await snap(page);
  const driver = s.production.trucks.find(t => t.id === mission.truckId).driver;
  expect(driver.actorKind).toBe('reliefDriver'); expect(driver.logisticsRole).toBe('municipalFuel'); expect(driver.mapCell).toBeTruthy();
  expect(s.production.trucks.find(t => t.id === mission.truckId).mapCell).toEqual({ x: 19, y: 17, z: 6 });
  expect(s.rule.powerFuel.received).toBe(0); expect(s.saved.mission.handling).toBeGreaterThan(0);
  const handling = s.saved.mission.handling;
  if (renderer === 'dom') {
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    await page.locator('#newRunBtn').click();
    await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-municipal-fuel.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
    await page.locator('[data-workspace-tab="visits"]').click();
    const continued = await snap(page);
    expect(continued.saved.runId).not.toBe(s.saved.runId); expect(continued.rule.runId).toBe(continued.saved.runId);
    expect(continued.networks.runId).toBe(continued.saved.runId); expect(continued.saved.mission.id).toBe(mission.id);
    expect(continued.rule.powerFuel).toEqual(s.rule.powerFuel);
    expect(continued.production.trucks).toEqual(s.production.trucks); expect(continued.context.authority).toBe(true);
  } else await reload(page);
  expect((await snap(page)).saved.mission.handling).toBe(handling);
  if (renderer === 'canvas') {
    // Use the actual shared targeted combat action and its actual geometry,
    // damage, surviving human and finite provider transmission, not a breach
    // flag or manufactured notice. It does not confiscate already paid fuel.
    expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 18, y: 16, z: 6 }, urgent: true })))).toBe(true);
    await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      for (let i = 0; i < 40; i++) {
        const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return;
        d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true);
      }
      throw new Error('Actual walk to the original fuel driver did not finish');
    });
    for (let i = 0; i < 4; i++) {
      expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('strike', id), driver.id)).toBe(true);
      await tick(page, 2); s = await snap(page);
      if (s.production.trucks.find(t => t.id === mission.truckId).driver.health < driver.health) break;
    }
    expect(s.production.trucks.find(t => t.id === mission.truckId).driver.health).toBeLessThan(driver.health);
    expect(s.production.trucks.find(t => t.id === mission.truckId).driver.fuelServiceAttack?.missionId).toBe(mission.id);
    expect(s.saved.suspended).toHaveLength(0);
  }
  await tick(page, 330); s = await snap(page);
  expect(s.rule.powerFuel.received).toBe(4); expect(s.rule.powerFuel.processed).toBeGreaterThan(0);
  expect(s.rule.chargedEnergy).toBeGreaterThanOrEqual(21600);
  expect(s.rule.powerFuel.stock + s.rule.powerFuel.processed + (s.rule.powerFuel.progress ? 1 : 0)).toBe(4);
  expect(s.saved.mission.phase).toBe('returning'); expect(s.public).toEqual(cancellationReceipt);
  if (renderer === 'canvas') expect(s.saved.suspended).toHaveLength(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  await tick(page, 3600); s = await snap(page);
  const returningTruck = s.production.trucks.find(t => t.id === mission.truckId);
  if (renderer === 'dom') {
    expect(s.saved.mission.returnedAt).toBeTruthy(); expect(s.saved.missions).toHaveLength(1);
    expect(returningTruck.shipment).not.toBe(mission.id);
  } else {
    // The real strike caused an ordinary untreated wound. Its progression can
    // incapacitate the same driver on the return leg. Do not heal/teleport a
    // paid carrier to satisfy an unrealistically successful-return assertion.
    expect(returningTruck.driver.health).toBeLessThan(50); expect(s.saved.mission.returnedAt).toBeNull();
    expect(s.saved.mission.phase).toBe('returning'); expect(returningTruck.shipment).toBe(mission.id);
    expect(s.saved.mission.remaining).toBe(0); expect(s.production.trucks).toHaveLength(2);
    expect(s.saved.missions).toHaveLength(0); expect(s.rule.powerFuel.received).toBe(4);
  }
  if (renderer === 'canvas') {
    expect(await page.evaluate(() => window.helixHeresyDebug.cityRuleAction('counter'))).toBe(true);
    await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      for (let i = 0; i < 40; i++) {
        const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return;
        d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true);
      }
      throw new Error('Actual walk back to the original municipal counter did not finish');
    });
    await tick(page, 0);
  }
  await panel.locator('[data-fuel-service-action="report"]').click(); await tick(page, 60); s = await snap(page);
  expect(s.public.deliveries).toHaveLength(4); expect(s.public.at).toBe(s.clock);
  await expect(panel).toContainText('4 individually unloaded units');
  expect(s.networks.accounts.every(a => !a.mandate)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().saved.phase)).not.toBe('qualified');
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  if (renderer === 'canvas') {
    const frozen = s.saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 60);
    expect((await snap(page)).saved).toEqual(frozen);
  }
  expect(errors).toEqual([]);
});
