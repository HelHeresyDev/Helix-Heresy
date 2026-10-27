const { test, expect } = require('@playwright/test');
const { visit, finish } = require('./helpers/multi-city-visit');
const { inputs } = require('./helpers/powerworks-source');
const { sources } = require('./helpers/regional-government-source');
test.setTimeout(900000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.cityServicesSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n), n);
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    const path = info.outputPath('continued-run.json');
    require('node:fs').writeFileSync(path, JSON.stringify(await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2,
      ...window.helixHeresyDebug.currentWorldRunSnapshot() }))));
    await info.attach('continued-run', { contentType: 'application/json', path });
  }
});
test('dom: actual foreign handover, carried tools and remote original specialist serve a separate plant through save and continued import', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  let map, toolStacks;
  await visit(page, 'dom', { beforeDeparture: async page => {
    const src = await page.evaluate(() => window.helixHeresyDebug.cityRuleSnapshot().saved.source);
    map = inputs(src.populationSourceId, src.powerId);
    expect(await page.evaluate(map => window.helixHeresyDebug.configurePowerworksMaintenanceTest({ map, skilled: true }), map)).toBe(true);
    toolStacks = await page.evaluate(() => {
      const d = window.helixHeresyDebug, stacks = d.powerworksMaintenanceSnapshot().stacks.filter(i => i.toolInstanceId);
      for (const i of stacks) if (!d.dropActorStack('scientist', i.id)) throw new Error('Original tools must wait at the real home counter');
      return stacks.map(i => i.id);
    });
  } });
  const home = (await snapshot(page)).cities[0], original = sources();
  await page.locator('[data-workspace-tab="visits"]').click();
  expect(await page.evaluate(s => { const d = window.helixHeresyDebug;
    return d.setForeignCivicBargainTestSource(s.succession) && d.setRegionalGovernmentTestSources('b', s);
  }, original)).toBe(true);
  map.strategicCapabilityHistory.milestoneRows[0].infrastructureRows.push({ id: original.operation.powerId, cityId: 'b',
    function: 'powerWorks', operationalAtPlayableYear: true });
  expect(await page.evaluate(map => window.helixHeresyDebug.configureRegionalCityServicesTest({ cityId: 'b', map }), map)).toBe(true);
  const panel = page.locator('[data-regional-governments]');
  await panel.locator('[data-government-action="request"]').click(); await tick(page, 30);
  await panel.locator('[data-government-action="hear"]').click(); await tick(page, 180);
  await panel.locator('[data-government-action="sign"]').click(); await panel.locator('[data-government-action="deliver"]').click();
  const government = await page.evaluate(() => window.helixHeresyDebug.regionalGovernmentSnapshot().gates[0]);
  for (const a of [...government.saved.succession.leaders, government.bargain.defender]) {
    expect(await page.evaluate(id => window.helixHeresyDebug.regionalGovernmentAction('agree', id), a.id)).toBe(true); await tick(page, 60);
  }
  await panel.locator('[data-government-action="handover"]').click(); await tick(page, 180);
  // The original passenger car carries only twenty kilograms. The eighteen
  // parts and nine kilograms of tools cannot travel together. Pay for actual
  // return/second journeys to collect the same tools, not a larger car.
  const journey = async destination => {
    expect(await page.evaluate(id => { const d = window.helixHeresyDebug;
      return d.bookIntercityPassenger(id) && d.queueIntercityPassenger('passengerBoard');
    }, destination)).toBe(true);
    await finish(page); await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(1600));
    expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  };
  // The original carrier's quote retains its booked corridor destination;
  // foreign phase makes this same itinerary the separately paid return leg.
  await journey('city:b');
  expect(await page.evaluate(() => window.helixHeresyDebug.cityRuleAction('counter'))).toBe(true); await finish(page);
  expect(await page.evaluate(ids => ids.every(id => Boolean(window.helixHeresyDebug.carryActorStack('scientist', id, 1))), toolStacks)).toBe(true);
  await journey('city:b');
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  let s = await snapshot(page), foreign = s.cities.find(c => c.cityId === 'b');
  expect(foreign.services.powerworksMaintenance.inspection).toBeNull();
  expect(foreign.rule.id).not.toBe(home.rule.id);
  const homeWorkerId = home.services.powerworksMaintenance.providers[0].resourceRefs.technician;
  expect(foreign.services.powerworksMaintenance.providers.some(p => p.resourceRefs.technician === homeWorkerId)).toBe(true);
  expect(s.pool.assets.filter(a => a.id === homeWorkerId)).toHaveLength(1);
  const duty = s.pool.assets.find(a => a.id === homeWorkerId).value.workSeconds;
  await panel.locator('[data-powerworks-action="walk"]').click(); await finish(page); await tick(page, 0);
  s = await snapshot(page); foreign = s.cities.find(c => c.cityId === 'b');
  expect(foreign.context.atWorkface, JSON.stringify({ context: { ...foreign.context, wallet: undefined }, site: foreign.site,
    walkReason: foreign.walkReason, tasks: await page.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot().tasks) })).toBe(true);
  expect(foreign.context.authority).toBe(true); expect(foreign.context.otherBusy).toBe(false);
  const sourceId = foreign.services.powerworksMaintenance.sources.find(r => r.cityId === 'a').id;
  await panel.locator(`[data-powerworks-action="inspect"][data-provider-id="${sourceId}"]`).click(); await tick(page, 43);
  s = await snapshot(page); expect(s.cities.find(c => c.cityId === 'b').services.powerworksMaintenance.job.progress).toBe(43);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  await tick(page, 77); s = await snapshot(page); foreign = s.cities.find(c => c.cityId === 'b');
  expect(foreign.services.powerworksMaintenance.inspection.powerId).toBe(original.operation.powerId);
  expect(s.cities[0].services.powerworksMaintenance.inspection).toBeNull();
  expect(s.pool.assets.find(a => a.id === homeWorkerId).value.workSeconds).toBe(duty - 120);
  const dated = foreign.services.powerworksMaintenance.report;
  await tick(page, 60); expect((await snapshot(page)).cities.find(c => c.cityId === 'b').services.powerworksMaintenance.report).toEqual(dated);
  const before = await snapshot(page), bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2,
    ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-city-services.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
  await page.locator('[data-workspace-tab="visits"]').click(); s = await snapshot(page);
  expect(s.pool.runId).not.toBe(before.pool.runId); expect(s.pool.assets).toEqual(before.pool.assets);
  foreign = s.cities.find(c => c.cityId === 'b'); expect(foreign.services.powerworksMaintenance.runId).toBe(s.pool.runId);
  expect(foreign.services.powerworksMaintenance.report).toEqual(dated);
  await panel.locator('[data-powerworks-action="return"]').click(); await finish(page); await tick(page, 0);
  expect((await snapshot(page)).cities.find(c => c.cityId === 'b').context.atCounter).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
