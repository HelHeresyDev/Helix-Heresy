// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
test.setTimeout(90_000);

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupForm button[type="submit"]').click();
  await page.evaluate(() => window.helixHeresyDebug.prepareChemistryEquipment());
}

async function finishProduction(page) {
  const task = await page.evaluate(() => window.helixHeresyDebug.chemicalBatchSnapshot().activeTask);
  expect(task).toBeTruthy();
  await page.evaluate((seconds) => window.helixHeresyDebug.advanceSimulation(seconds), Math.max(1, Math.ceil(task.dueAt - task.createdAt + 2)));
}

async function produceOnce(page, recipeId, inputStackId = '') {
  await page.evaluate(({ recipeId, inputStackId }) => window.helixHeresyDebug.createProductionBill({
    recipeId, inputStackId, scope: 'global', mode: 'once', materialStrategy: 'closest',
  }), { recipeId, inputStackId });
  await finishProduction(page);
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.chemicalBatchSnapshot());
  return snapshot.batches.at(-1);
}

test('chemical selectors enforce physical phase compatibility and preserve the raw receptacle', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.addChemicalRawByproduct('mineral grit', 1));
  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({ recipeId: 'chemistry:clarifyLiquid', mode: 'once', scope: 'global' }));
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.chemicalBatchSnapshot());
  expect(snapshot.activeTask).toBeNull();
  expect(snapshot.bills.at(-1).blockedReason).toContain('liquid or sludge');

  await page.evaluate(() => window.helixHeresyDebug.addChemicalRawByproduct('clean water', 1));
  await page.evaluate((billId) => window.helixHeresyDebug.setProductionBillStatus(billId, 'canceled'), snapshot.bills.at(-1).id);
  const output = await produceOnce(page, 'chemistry:clarifyLiquid');
  expect(output.quantity).toBe(0.8);
  expect(output.batch).toMatchObject({ productId: 'clarifiedReagentBase', phase: 'liquid', recipeVersion: 1 });
  expect(output.batch.lineage[0]).toMatchObject({ label: 'clean water', amount: 1, phase: 'liquid' });
  expect(output.batch.sourceLabels).toContain('Debug chemistry input');

  const stock = await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks);
  const emptiedJar = stock.find((stack) => stack.section === 'inventory' && stack.key === 'sealedCollectionJar' && stack.sourceLabels?.includes('Debug chemistry input'));
  expect(emptiedJar).toBeTruthy();
  expect(emptiedJar.contents).toEqual([]);
});

test('combined batches retain ancestry through assay packaging and truthful certification', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => {
    window.helixHeresyDebug.addChemicalRawByproduct('clean water', 1);
    window.helixHeresyDebug.addChemicalRawByproduct('mineral grit', 1);
  });
  const carrier = await produceOnce(page, 'chemistry:clarifyLiquid');
  const mineral = await produceOnce(page, 'chemistry:recoverMineral');
  const finished = await produceOnce(page, 'chemistry:formulateBuffer');

  expect(finished.batch.lineage.map((entry) => entry.batchId)).toEqual(expect.arrayContaining([carrier.batch.id, mineral.batch.id]));
  expect(finished.batch.ancestorBatchIds).toEqual(expect.arrayContaining([carrier.batch.id, mineral.batch.id]));
  expect(finished.batch.assays).toEqual([]);
  expect(finished.batch.classification).toMatchObject({ actual: 'ordinary', known: 'unclassified' });

  const assayed = await produceOnce(page, 'chemistry:assayBatch', finished.stackId);
  expect(assayed.batch.id).toBe(finished.batch.id);
  expect(assayed.batch.recipeId).toBe('chemistry:formulateBuffer');
  expect(assayed.batch.assays).toHaveLength(1);
  expect(assayed.batch.assays[0].purityBand).toMatch(/%/);
  expect(assayed.batch.assays[0].confidence).toBeGreaterThan(50);
  expect(assayed.batch.classification).toMatchObject({ actual: 'ordinary', known: 'ordinary' });

  const packaged = await produceOnce(page, 'chemistry:packageFinished', assayed.stackId);
  expect(packaged.batch.id).toBe(finished.batch.id);
  expect(packaged.batch.packaging).toMatchObject({ state: 'packaged', containerKey: 'sealedReagentBottle' });
  expect(packaged.batch.assays).toHaveLength(1);
  expect(packaged.batch.documentation.status).toBe('none');

  const certified = await produceOnce(page, 'chemistry:certifyBatch', packaged.stackId);
  expect(certified.batch.id).toBe(finished.batch.id);
  expect(certified.batch.documentation).toMatchObject({ status: 'certified', assayId: packaged.batch.assays[0].id });
  expect(certified.batch.documentation.certificateId).toContain(certified.batch.id);
  expect(certified.batch.ancestorBatchIds).toEqual(expect.arrayContaining([carrier.batch.id, mineral.batch.id]));
  expect(certified.batch.ancestorBatchIds).not.toContain(finished.batch.id);
});

test('utility loss pauses a started chemical workpiece in place and restart resumes it', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => {
    window.helixHeresyDebug.addChemicalRawByproduct('clean water', 1);
    window.helixHeresyDebug.createProductionBill({ recipeId: 'chemistry:clarifyLiquid', mode: 'once', scope: 'global' });
  });
  const task = await page.evaluate(() => window.helixHeresyDebug.chemicalBatchSnapshot().activeTask);
  await page.evaluate((seconds) => window.helixHeresyDebug.advanceSimulation(seconds), Math.max(1, Math.ceil(task.data.workStartsAt - task.createdAt + 5)));
  await page.evaluate(() => window.helixHeresyDebug.setFixtureUtility('starter-surface-water', { enabled: false }));
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(600));
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.chemicalBatchSnapshot());
  expect(snapshot.workpieces).toHaveLength(1);
  expect(snapshot.workpieces[0].status).toBe('working');
  expect(snapshot.activeTask).toBeTruthy();

  await page.evaluate(() => window.helixHeresyDebug.setFixtureUtility('starter-surface-water', { enabled: true }));
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(900));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.chemicalBatchSnapshot());
  expect(snapshot.bills.at(-1).status).toBe('completed');
  expect(snapshot.batches.at(-1).batch.productId).toBe('clarifiedReagentBase');
});
