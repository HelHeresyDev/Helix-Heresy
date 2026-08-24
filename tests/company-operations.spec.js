// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function openFreshSetup(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
}

async function startRun(page) {
  await openFreshSetup(page);
  await page.locator('#setupForm button[type="submit"]').click();
}

test('company name supports deterministic generation and authoritative player input', async ({ page }) => {
  await openFreshSetup(page);
  await page.locator('#seedInput').fill('paper-trail-seed');
  await page.locator('#seedInput').dispatchEvent('change');
  const first = await page.locator('#companyNameInput').inputValue();
  expect(first).toBe(await page.evaluate(() => window.helixHeresyDebug.generatedCompanyName('paper-trail-seed')));

  await page.locator('#randomCompanyNameBtn').click();
  const second = await page.locator('#companyNameInput').inputValue();
  expect(second).not.toBe(first);
  expect(second).toBe(await page.evaluate(() => window.helixHeresyDebug.generatedCompanyName('paper-trail-seed', 1)));

  await page.locator('#companyNameInput').fill('Morrow Vale Chemical Works');
  await page.locator('#startRunSubmitBtn').click();
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.companySnapshot());
  expect(snapshot.company).toMatchObject({ legalName: 'Morrow Vale Chemical Works', nameSource: 'custom', operatingState: 'renovation' });
  expect(snapshot.identity).toMatchObject({ legalName: 'Morrow Vale Chemical Works', nameSource: 'custom' });
});

test('Company tab exposes declarations, qualitative credibility, exceptions, records, and saved operating state', async ({ page }) => {
  await startRun(page);
  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="company"]').click();

  await expect(page.locator('[data-economy-category="companyIdentity"]')).toBeVisible();
  await expect(page.locator('[data-company-declaration]')).toHaveCount(4);
  await expect(page.locator('[data-company-credibility-dimension]')).toHaveCount(6);
  await expect(page.locator('[data-company-exception="incomplete-inherited-records"]')).toBeVisible();
  await expect(page.locator('[data-company-record-kind="inheritance"]')).toBeVisible();

  await page.getByLabel('Company operating state').selectOption('open');
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.companySnapshot());
  expect(snapshot.company.operatingState).toBe('open');
  expect(snapshot.identity.operatingState).toBe('open');
  expect(snapshot.company.records.at(-1)).toMatchObject({ kind: 'operatingState', category: 'corporate' });
});

test('legal purchases and receipts append immutable records to the open reporting period', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMarketCash(1000));
  const result = await page.evaluate(() => window.helixHeresyDebug.buyCommodity('steelPanels', 3));
  expect(result.filled).toBe(3);

  let snapshot = await page.evaluate(() => window.helixHeresyDebug.companySnapshot());
  expect(snapshot.company.records).toContainEqual(expect.objectContaining({
    kind: 'purchase',
    listingId: 'steelPanels',
    quantity: 3,
    lawful: true,
  }));

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(45 * 60));
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(6 * 60));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.companySnapshot());
  expect(snapshot.company.records).toContainEqual(expect.objectContaining({
    kind: 'received',
    listingId: 'steelPanels',
    quantity: 3,
    lawful: true,
  }));
  const active = snapshot.company.periods.find((period) => period.id === snapshot.company.activePeriodId);
  expect(active.recordIds).toEqual(expect.arrayContaining(snapshot.company.records.filter((record) => record.periodId === active.id).map((record) => record.id)));
});

test('due books route through Staff Operations and freeze a filed-period snapshot', async ({ page }) => {
  await startRun(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.makeCompanyPeriodDue())).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.startCompanyFiling())).toBe(true);

  await page.locator('[data-workspace-tab="tasks"]').click();
  const filingTask = page.locator('[data-task-row]').filter({ hasText: 'Close company books: period 1' });
  await expect(filingTask).toContainText('Company Records');
  await filingTask.getByRole('button', { name: 'Finish' }).click();

  let snapshot = await page.evaluate(() => window.helixHeresyDebug.companySnapshot());
  const filed = snapshot.company.periods.find((period) => period.number === 1);
  expect(filed).toMatchObject({ status: 'filed', taskId: '' });
  expect(filed.snapshot).toMatchObject({ recordCount: 1, operatingState: 'renovation' });
  expect(filed.snapshot.exceptions).toContainEqual(expect.objectContaining({ kind: 'incompleteRecords' }));
  expect(snapshot.company.periods.find((period) => period.number === 2)).toMatchObject({ status: 'open' });
  expect(snapshot.company.records.at(-1)).toMatchObject({ kind: 'periodFiled', periodId: snapshot.company.activePeriodId });

  const frozen = JSON.stringify(filed.snapshot);
  await page.evaluate(() => window.helixHeresyDebug.setCompanyOperatingState('open'));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.companySnapshot());
  expect(JSON.stringify(snapshot.company.periods.find((period) => period.number === 1).snapshot)).toBe(frozen);
});
