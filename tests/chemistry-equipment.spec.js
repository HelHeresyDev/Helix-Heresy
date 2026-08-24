// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('Chemistry Front starts with six worn machines on a physical five-medium surface service', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => ({
    chemistry: window.helixHeresyDebug.chemistryEquipmentSnapshot(),
    infrastructure: window.helixHeresyDebug.infrastructureSnapshot(),
  }));

  expect(result.chemistry.fixtures.map((fixture) => fixture.typeId).sort()).toEqual([
    'analysisStation',
    'fumeHood',
    'packagingStation',
    'reactionVessel',
    'wasteTreatmentStation',
    'wetChemistryBench',
  ]);
  expect(result.chemistry.fixtures.every((fixture) => fixture.origin.z === 1)).toBe(true);
  expect(result.chemistry.fixtures.every((fixture) => fixture.condition < 70)).toBe(true);
  expect(result.chemistry.fixtures.every((fixture) => !fixture.process.commissioned && !fixture.process.online)).toBe(true);
  expect(Object.keys(result.infrastructure.networks).sort()).toEqual(['air', 'drain', 'electricity', 'mana', 'water']);

  const riser = result.infrastructure.fixtures.find((fixture) => fixture.id === 'starter-surface-riser');
  expect(riser.components.electricity).toEqual(expect.arrayContaining([
    'starter-surface-service-head',
    'starter-surface-riser',
    'starter-surface-reaction-vessel',
  ]));
  expect(riser.components.water).toEqual(expect.arrayContaining([
    'starter-surface-water',
    'starter-surface-wet-bench',
  ]));
  const bench = result.chemistry.fixtures.find((fixture) => fixture.typeId === 'wetChemistryBench');
  expect(bench.readiness.operational).toBe(true);
  expect(bench.readiness.warnings.length).toBeGreaterThan(0);
});

test('commissioning startup and diagnostic cycles are routed work that leaves local waste and fumes', async ({ page }) => {
  await startRun(page);
  const benchId = 'starter-surface-wet-bench';

  expect(await page.evaluate((id) => window.helixHeresyDebug.queueChemistryWork(id, 'commissionEquipment'), benchId)).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(900));
  let bench = await page.evaluate((id) => window.helixHeresyDebug.chemistryEquipmentSnapshot().fixtures.find((fixture) => fixture.id === id), benchId);
  expect(bench.process.commissioned).toBe(true);
  expect(bench.process.online).toBe(false);

  expect(await page.evaluate((id) => window.helixHeresyDebug.queueChemistryWork(id, 'startEquipment'), benchId)).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(600));
  bench = await page.evaluate((id) => window.helixHeresyDebug.chemistryEquipmentSnapshot().fixtures.find((fixture) => fixture.id === id), benchId);
  expect(bench.process.online).toBe(true);
  expect(bench.utility.enabled).toBe(true);

  expect(await page.evaluate((id) => window.helixHeresyDebug.queueChemistryWork(id, 'testEquipment'), benchId)).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(600));
  const after = await page.evaluate(() => window.helixHeresyDebug.chemistryEquipmentSnapshot());
  bench = after.fixtures.find((fixture) => fixture.id === benchId);
  expect(bench.process.cycleCount).toBe(1);
  expect(bench.process.lastResult).toContain('Diagnostic cycle 1');
  expect(after.residues.some((stack) => stack.key === 'chemistryDiagnosticWaste' && stack.cell.z === 1)).toBe(true);
  expect(after.fumes.some((record) => record.cell.z === 1 && record.concentration > 0)).toBe(true);
});

test('a clean-water outage blocks new wet-bench cycles and remains explainable', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => {
    window.helixHeresyDebug.setChemistryProcess('starter-surface-wet-bench', { commissioned: true, online: true });
    window.helixHeresyDebug.setFixtureUtility('starter-surface-wet-bench', { enabled: true });
    window.helixHeresyDebug.setFixtureUtility('starter-surface-water', { enabled: false });
    window.helixHeresyDebug.queueChemistryWork('starter-surface-wet-bench', 'testEquipment');
  });
  const result = await page.evaluate(() => ({
    bench: window.helixHeresyDebug.chemistryEquipmentSnapshot().fixtures.find((fixture) => fixture.id === 'starter-surface-wet-bench'),
    order: window.helixHeresyDebug.workOrderSnapshot().find((entry) => entry.kind === 'testEquipment'),
  }));
  expect(result.bench.readiness.operational).toBe(false);
  expect(result.bench.readiness.blockers.join(' ')).toContain('Water service');
  expect(result.order.status).toBe('blocked');
  expect(result.order.blockedReason).toContain('Water service');
});
