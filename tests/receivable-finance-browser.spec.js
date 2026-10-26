const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
const { inputs } = require('./helpers/municipal-fuel-source');
test.setTimeout(420000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.receivableFinanceSnapshot());
const tick = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceReceivableFinanceForTest(n), seconds);
const account = s => s.networks.accounts.find(a => a.id === 'branch:a');

for (const renderer of ['dom', 'canvas']) test(`${renderer}: original private export finance, saved attended acceptance and nonrecourse actual proceeds`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `export-finance-${renderer}`); await prepareHome(page, renderer, { sustain: false });
  await page.locator('[data-workspace-tab="visits"]').click();
  const population = await page.evaluate(() => window.helixHeresyDebug.cityRuleSnapshot().saved.source.populationSourceId);
  expect(await page.evaluate(map => window.helixHeresyDebug.configureReceivableFinanceTest(map), inputs(population).map)).toBe(true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const initial = await snap(page), panel = page.locator('[data-receivable-finance]'), net = initial.trade.shipments[0].playerEscrow;
  expect(initial.context.atCounter).toBe(true); expect(account(initial).money).toBe(240);
  await panel.locator('[data-receivable-finance-action="quote"]').click();
  let s = await snap(page); expect(s.saved.offer?.claimAmount, JSON.stringify(s.context)).toBe(110);
  expect(s.money).toBe(initial.money); expect(account(s).money).toBe(240); expect(s.trade).toEqual(initial.trade);
  await panel.locator('[data-receivable-finance-action="accept"]').click(); await tick(page, 23);
  s = await snap(page); expect(s.saved.job?.progress, JSON.stringify(s.context)).toBe(23);
  expect(s.money).toBe(initial.money); expect(account(s).money).toBe(140); expect(s.saved.claims).toEqual([]);
  expect(s.counter.workSeconds).toBe(initial.counter.workSeconds - 23); expect(s.counter.power).toBe(initial.counter.power - 1);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page)).saved.job.progress).toBe(23);
  if (renderer === 'dom') {
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    await page.locator('#newRunBtn').click();
    await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-export-finance.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click();
    const copied = await snap(page); expect(copied.saved.runId).not.toBe(s.saved.runId); expect(copied.saved.runId).toBe(copied.networks.runId);
    expect(copied.saved.job).toEqual(s.saved.job); expect(copied.trade.shipments).toEqual(s.trade.shipments);
  }
  await tick(page, 37); s = await snap(page);
  expect(s.saved.job).toBeNull(); expect(s.saved.claims).toHaveLength(1); expect(s.money).toBe(initial.money + 100);
  expect(account(s).money).toBe(140); expect(s.trade.shipments[0].playerEscrow).toBe(net);
  expect(s.counter.workSeconds).toBe(initial.counter.workSeconds - 60); expect(s.counter.power).toBe(initial.counter.power - 1);
  expect(s.ledger.filter(r => r.kind === 'receivableAdvance')).toHaveLength(1);
  expect(s.ledger.filter(r => r.kind === 'exportSale')).toHaveLength(0);
  const dated = s.public;
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.receivableFinanceSnapshot();
    return d.receivableFinanceAction('quote', { sourceId: s.saved.sources[0].id, shipmentId: s.trade.shipments[0].id, advance: 100 }); })).toBe(false);
  if (renderer === 'dom') {
    await tick(page, 3 * 3600); s = await snap(page);
    expect(s.trade.shipments[0]).toMatchObject({ delivered: true, settled: true, playerEscrow: 0 });
    expect(s.saved.claims[0]).toMatchObject({ status: 'settled', collected: 110, discountEarned: 10 });
    expect(account(s).money).toBe(250); expect(s.money).toBe(initial.money + net - 10);
    expect(s.ledger.filter(r => r.kind === 'exportSale')).toHaveLength(1); expect(s.ledger.filter(r => r.kind === 'receivableSettlement')).toHaveLength(1);
    expect(s.public).toEqual(dated); const balances = [s.money, account(s).money]; await tick(page, 3600);
    s = await snap(page); expect([s.money, account(s).money]).toEqual(balances);
    await panel.locator('[data-receivable-finance-action="report"]').click(); expect((await snap(page)).public.claims[0].status).toBe('settled');
  } else {
    await tick(page, 3600); expect(await page.evaluate(() => window.helixHeresyDebug.setReceivableFinanceTestRoute(false))).toBe(true);
    await tick(page, 40 * 3600); s = await snap(page);
    expect(s.trade.shipments[0]).toMatchObject({ delivered: false, playerEscrow: net }); expect(s.trade.shipments[0].cargoManifest.quantity).toBe(12);
    expect(s.trade.operators[0].reason).toContain('provisions exhausted'); expect(s.saved.claims[0]).toMatchObject({ status: 'active', claimAmount: 110 });
    expect(account(s).money).toBe(140); expect(s.money).toBe(initial.money + 100); expect(s.public).toEqual(dated);
    expect(s.ledger.filter(r => r.kind === 'exportSale')).toHaveLength(0);
    const frozen = s.saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 120);
    expect((await snap(page)).saved).toEqual(frozen);
  }
  expect(await panel.innerText()).not.toMatch(/initialMoney|original-undisclosed|workSeconds|populationSourceId/);
  expect((await snap(page)).networks.accounts.every(a => !a.mandate)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
