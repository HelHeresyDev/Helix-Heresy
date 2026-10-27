const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { world, Definitions } = require('./helpers/institutional-inventory-source');
const N = require('../network-operations'), X = require('../exceptional-reach');
test.setTimeout(180000);
test('dom: actual original outcomes advance privately, survive reload and do not turn public office records into live certificates', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'actual-original-institutional-outcomes');
  const map = world([Definitions.find(d => d.category === 'standards')]);
  map.strategicCapabilityHistory = { historicalHorizonYear: 1000, milestoneRows: Object.entries(X.FUNCTIONS).map(([capabilityId, kind]) => ({
    capabilityId, standardizationYear: 100, institution: { id: `institute:${capabilityId}` }, infrastructureRows: [{
      id: `commissioned:${capabilityId}`, capabilityId, function: kind, cityId: 'city:0', cellId: 'cell:0',
      operatingInstitutionId: `institute:${capabilityId}`, commissionedYear: 200, operationalAtPlayableYear: true }] })) };
  expect(await page.evaluate(source => window.helixHeresyDebug.setOriginalInstitutionalInventoryTestSource(source), N.sources(map, 'original-standard'))).toBe(true);
  const snapshot = () => page.evaluate(() => window.helixHeresyDebug.institutionalOutcomesSnapshot());
  await page.evaluate(() => window.helixHeresyDebug.advanceCityRuleForTest(1, true));
  const first = await snapshot(); expect(first.assessments[0].state).toBe('qualifying'); expect(first.public).toEqual([]);
  expect(first.continuity.rows[0].since).toBe(1);
  const duplicateRead = await snapshot(); expect(duplicateRead).toEqual(first);
  await page.evaluate(() => window.helixHeresyDebug.advanceCityRuleForTest(120, true));
  const later = await snapshot(); expect(later.continuity.rows[0].since).toBe(first.continuity.rows[0].since);
  expect(later.public).toEqual(first.public);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  const loaded = await snapshot(); expect(loaded.continuity).toEqual(later.continuity); expect(loaded.public).toEqual(first.public);
  await page.evaluate(() => window.helixHeresyDebug.advanceCityRuleForTest(1, true));
  const resumed = await snapshot(); expect(resumed.assessments[0].state).toBe('qualifying'); expect(resumed.continuity.rows[0].since).toBe(1);
  expect(errors).toEqual([]);
});
