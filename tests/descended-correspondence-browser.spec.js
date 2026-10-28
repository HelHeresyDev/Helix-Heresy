const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareContactHome } = require('./helpers/civic-contact-home');
const { finish } = require('./helpers/multi-city-visit');
const { ordinaryMap } = require('./helpers/ordinary-correspondence-source');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.ordinaryCorrespondenceSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceForeignReceptionTestTime(n), n);
const visits = page => page.locator('[data-workspace-tab="visits"]').click();
for (const renderer of ['dom', 'canvas']) test(`${renderer}: original descended correspondence, actual refusal, interrupted replies and continued received-only accounts`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `ordinary-correspondence-${renderer}`); await prepareContactHome(page, renderer);
  const city = await page.evaluate(() => window.helixHeresyDebug.sovereignBargainSnapshot().bargain.source);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  expect(await page.evaluate(map => window.helixHeresyDebug.configureOrdinaryCorrespondenceTest(map), ordinaryMap(city))).toBe(true);
  console.log(`${renderer}: actual permitted counter and original ordinary sources ready`);
  await visits(page); let s = await snap(page);
  expect(s.book.originals).toHaveLength(2); expect(s.known).toEqual([]); expect(s.book.agreements).toEqual([]);
  expect(s.contexts.every(x => x.context.receiveAtCounter), JSON.stringify(s.contexts)).toBe(true);
  const panel = page.locator('[data-descended-correspondence]'), endpoints = s.saved.endpoints;
  const id = endpoints.find(e => e.source.branchName === 'Retained Auriel Archive').source.id,
    closed = endpoints.find(e => e.source.disclosure === 'withholdAddress').source.id,
    refusing = endpoints.find(e => e.source.godName === 'Boreal').source.id,
    pathId = s.communications.ports[0].id;
  const action = async (kind, endpoint = id) => panel.locator(`[data-ordinary-correspondence-action="${kind}"][data-endpoint-id="${endpoint}"]`).click();
  await expect(panel).not.toContainText('/original-individual/');
  await action('discover', closed); await tick(page, 60); await expect(panel).toContainText('withholds its routing record');
  expect((await snap(page)).saved.accounts[0].spentAttention).toBe(0);
  await action('discover'); await tick(page, 60); await action('request'); await tick(page, 25);
  s = await snap(page); expect(s.saved.accounts[0].job.progress).toBe(25);
  expect(s.communications.ports[0].spentSeconds).toBe(145);
  const ground = s.location;
  expect(await page.evaluate(g => Boolean(window.helixHeresyDebug.startScientistMove(g.roomId,
    { toCell: { x: 15, y: 8, z: g.counter.z }, allowMultiRoom: true })), ground)).toBe(true); await finish(page);
  const partial = (await snap(page)).saved.accounts[0].job.progress;
  await tick(page, 60); expect((await snap(page)).saved.accounts[0].job.progress).toBe(partial);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page);
  s = await snap(page); expect(s.saved.invalid).toBeFalsy(); expect(s.saved.accounts[0].job.progress).toBe(partial);
  console.log(`${renderer}: actual walking-away pause and partial reload preserved`);
  expect(await page.evaluate(g => Boolean(window.helixHeresyDebug.startScientistMove(g.roomId,
    { toCell: g.counter, allowMultiRoom: true })), ground)).toBe(true); await finish(page);
  await tick(page, 1); await tick(page, 60 - partial); s = await snap(page);
  expect(s.saved.accounts[0].job.kind).toBe('answer'); const held = s.known;
  expect(await page.evaluate(id => window.helixHeresyDebug.setCivicCommunicationsTestOutage(id, true), pathId)).toBe(true);
  const replyProgress = (await snap(page)).saved.accounts[0].job.progress;
  await tick(page, 120); expect((await snap(page)).saved.accounts[0].job.progress).toBe(replyProgress);
  expect((await snap(page)).known).toEqual(held);
  await page.evaluate(id => window.helixHeresyDebug.setCivicCommunicationsTestOutage(id, false), pathId); await tick(page, 1); await tick(page, 120 - replyProgress);
  expect((await snap(page)).known).toEqual(held); await action('receive'); await tick(page, 60);
  await expect(panel).toContainText('No divine reserve is used'); await action('accept'); await tick(page, 60); await tick(page, 120);
  s = await snap(page); expect(s.book.agreements).toHaveLength(1); expect(s.saved.reports).toEqual([]);
  expect(s.book.records.every(r => r.god.power.reserve === 0)).toBe(true); expect(s.saved.accounts[0].attentionSeconds).toBe(360);
  await action('receive'); await tick(page, 60); s = await snap(page);
  expect(s.saved.reports).toHaveLength(1); expect(s.saved.reports[0].state).toBe('receivedConditionalPersonalCommitment');
  console.log(`${renderer}: actual original assent and dated ordinary receipt completed`);
  expect(s.evidence.find(e => e.label === 'Received ordinary personal nonintervention account').status).toBe('unverified');
  const promise = s.book.agreements[0], report = s.saved.reports[0];
  await action('discover', refusing); await tick(page, 60); await action('request', refusing); await tick(page, 60); await tick(page, 120);
  await expect(panel).not.toContainText('original individual refuses'); await action('receive', refusing); await tick(page, 60);
  await expect(panel).toContainText('original individual refuses'); s = await snap(page); expect(s.book.agreements).toHaveLength(1);
  expect(s.book.agreements[0]).toEqual(promise); expect(s.saved.reports[0]).toEqual(report);
  const known = s.known, accounts = s.saved.accounts, ports = s.communications.ports;
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-ordinary-contact.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await visits(page); const continued = await snap(page);
  expect(continued.saved.invalid).toBeFalsy(); expect(continued.saved.runId).not.toBe(s.saved.runId); expect(continued.known).toEqual(known);
  console.log(`${renderer}: actual refusal and continued original accounts preserved`);
  expect(continued.saved.accounts).toEqual(accounts); expect(continued.communications.ports).toEqual(ports); expect(continued.book.agreements[0]).toEqual(promise);
  expect(await page.evaluate(() => window.helixHeresyDebug.citySuccessionSnapshot().succession?.handover)).toBeFalsy();
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = continued.saved; await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(500); });
  expect((await snap(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
});
