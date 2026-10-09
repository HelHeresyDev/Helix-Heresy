// @ts-check
const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const Lifecycle = require('../run-lifecycle');
const Death = require('../scientist-death');
const Library = require('../world-run-library');
const { lifecycleWorld } = require('./helpers/lifecycle-world');
const clone = value => JSON.parse(JSON.stringify(value));

test('living catastrophes never end a run and resurrection handoff is distinct from terminal death', () => {
  for (const circumstance of ['arrest', 'jail', 'prison', 'penalLegion', 'deathSentence', 'laboratoryLost']) {
    const state = { [circumstance]: { status: 'active' }, runEnded: false, scientist: { vitals: { health: { current: 1 } } } };
    expect(Lifecycle.phase(state)).toBe('active');
    expect(Lifecycle.captureReport(state)).toBeNull();
  }
  const ready = Death.addContingency(Death.defaultState(), { preparedBodyId: 'body', siteId: 'hidden-base' }, 10);
  const pending = Death.recordDeath(ready.state, {}, 20);
  const state = { scientistDeath: pending.state, scientist: { vitals: { health: { current: 0 } } } };
  expect(Lifecycle.phase(state)).toBe('resurrectionPending');
  expect(Lifecycle.captureReport(state)).toBeNull();
  expect(Death.recordDeath(pending.state, {}, 21)).toMatchObject({ created: false, resurrectionPending: true });
});

test('all existing fatal causes finalize once even at later clocks and survive serialization', () => {
  for (const causeKind of ['combatTrauma', 'handlingInjury', 'untreatedExposure', 'physiologicalFailure', 'statePublicExecution']) {
    const first = Death.recordDeath(Death.defaultState(), { causeKind, causeLabel: causeKind }, 100);
    const repeated = Death.recordDeath(clone(first.state), { causeKind: 'anotherCause' }, 200);
    expect(repeated).toMatchObject({ created: false, terminal: true, record: { diedAt: 100, causeKind } });
    expect(repeated.state.records).toHaveLength(1);
    expect(Lifecycle.phase({ scientistDeath: repeated.state })).toBe('ended');
  }
});

test('only intact completed and supplied contingencies can defer a terminal ending', () => {
  for (const invalid of [{ status: 'incomplete' }, { status: 'destroyed' }, { status: 'spent' }, { siteIntact: false }, { utilitiesOnline: false }, { preparedBodyId: '' }]) {
    const ready = Death.addContingency(Death.defaultState(), { preparedBodyId: 'body', ...invalid }, 0);
    expect(Death.recordDeath(ready.state, {}, 50)).toMatchObject({ terminal: true, resurrectionPending: false });
  }
  expect(Death.recordDeath(Death.defaultState(), { physiology: { lethal: false } }, 50).state.records).toEqual([]);
});

test('postmortems freeze only supplied visible knowledge, survive load, and bound their history', () => {
  const death = Death.recordDeath(Death.defaultState(), { causeLabel: 'Known wound', summary: 'The scientist died.' }, 123);
  const state = { runEnded: true, clock: 900, seed: 'run', scientistDeath: death.state,
    events: [{ message: 'PRIVATE LAB REPORT' }], hiddenWorld: { secret: 'hidden' }, slimes: [{ genome: 'SECRET GENOME' }] };
  const visible = { worldName: 'Known World', location: 'Known Room', events: Array.from({ length: 20 }, (_, time) => ({ time, message: `Observed ${time}`, truth: 'PRIVATE' })) };
  const report = Lifecycle.captureReport(state, visible);
  expect(report.diedAt).toBe(123);
  expect(report.events).toHaveLength(12);
  expect(report.events[0]).toEqual({ time: 8, message: 'Observed 8' });
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|SECRET|genome|hiddenWorld|truth/);
  state.postmortem = clone(report);
  state.scientistDeath.records[0].causeLabel = 'Later change';
  visible.events.push({ time: 1000, message: 'Later observation' });
  expect(Lifecycle.captureReport(clone(state), visible)).toEqual(report);
  expect(Lifecycle.normalizeReport({ ...report, secret: 'PRIVATE' })).toEqual(report);
  expect(Lifecycle.captureReport({ runEnded: true, clock: 4 })).toMatchObject({ cause: 'Cause not recorded', events: [] });
});

const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
async function start(page) {
  const world = lifecycleWorld();
  await page.goto(appUrl);
  await page.evaluate(({ world, payload }) => {
    localStorage.clear();
    localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
    localStorage.setItem('helix-heresy-v2-library', JSON.stringify({ version: 2, worldIds: [world.id], runIds: [] }));
    localStorage.setItem(`helix-heresy-v2-world:${world.id}`, payload);
  }, { world: { id: world.id }, payload: Library.compressStorageText(JSON.stringify(world)) });
  await page.reload();
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();
  await page.locator('#seedInput').fill('lifecycle-first');
  await page.locator('[data-starting-site-input]').first().check({ timeout: 120000 });
  await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
}
const snapshot = page => page.evaluate(() => {
  const { run, world } = window.helixHeresyDebug.currentWorldRunSnapshot();
  return { id: run.id, worldId: world.id, digest: world.canonicalDigest, seed: run.runSeed,
    siteId: run.site.candidateId, company: run.state.siteIdentity?.legalName, health: run.state.scientist.vitals.health.current,
    clock: run.state.clock, ended: run.state.runEnded, postmortem: run.state.postmortem,
    deaths: run.state.scientistDeath.records, branch: run.worldState.changes };
});

test('death saves immediately, review/export/import stay read-only, and same-world restart branches cleanly', async ({ page }) => {
  test.setTimeout(360000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const first = await snapshot(page);
  await page.evaluate(() => { window.__canonicalBefore = JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world); });
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage('combat'));
  await expect(page.locator('#runOutcomeHeading')).toHaveText('Run ended');
  await expect(page.locator('#appShell')).toHaveAttribute('inert', '');
  const dead = await snapshot(page);
  expect(dead).toMatchObject({ ended: true, health: 0, deaths: [{ causeKind: 'combatTrauma' }] });
  expect(dead.postmortem).toMatchObject({ runSeed: first.seed, cause: 'test combat trauma' });
  expect(await page.evaluate(() => window.helixHeresyDebug.advanceTestRunTime(86400))).toBe(0);
  expect((await snapshot(page)).clock).toBe(dead.clock);
  expect(await page.evaluate(id => window.helixHeresyDebug.worldLibrarySnapshot().runs.find(run => run.id === id).status, first.id)).toBe('ended');
  await page.reload();
  await expect(page.locator('#loadLastSaveBtn')).toBeDisabled();
  await page.locator('#titleWorldLibraryBtn').click();
  await expect(page.locator('[data-library-action="resume-run"]')).toHaveCount(0);
  await page.locator('[data-library-action="review-run"]').click();
  await expect(page.locator('#runOutcomeReport')).toContainText('test combat trauma');
  const before = await page.evaluate(id => localStorage.getItem(`helix-heresy-v2-run:${id}`), first.id);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#runOutcomeExportBtn').click();
  const download = await downloadPromise;
  const bundleText = fs.readFileSync(await download.path(), 'utf8');
  const bundle = JSON.parse(bundleText);
  expect(bundle.run).toMatchObject({ status: 'ended', state: { postmortem: dead.postmortem } });
  expect(bundle.world.canonicalDigest).toBe(first.digest);
  expect(await page.evaluate(id => localStorage.getItem(`helix-heresy-v2-run:${id}`), first.id)).toBe(before);
  await page.locator('#runOutcomeLibraryBtn').click();
  await page.locator('#worldLibraryBackBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'archive.json', mimeType: 'application/json', buffer: Buffer.from(bundleText) });
  await expect(page.locator('[data-library-action="review-run"]')).toHaveCount(2);
  await expect(page.locator('[data-library-action="resume-run"]')).toHaveCount(0);
  await page.locator(`[data-run-id="${first.id}"] [data-library-action="review-run"]`).click();
  await page.locator('#runOutcomeRestartBtn').click();
  expect(await page.locator('#seedInput').inputValue()).not.toBe(first.seed);
  await page.locator('#companyNameInput').fill('Second Run Chemicals');
  await page.locator(`[data-starting-site-input="${first.siteId}"]`).check();
  await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  const second = await snapshot(page);
  expect(second.id).not.toBe(first.id);
  expect(second).toMatchObject({ worldId: first.worldId, digest: first.digest, siteId: first.siteId,
    company: 'Second Run Chemicals', ended: false, postmortem: null, deaths: [], branch: {} });
  expect(second.health).toBeGreaterThan(0);
  expect(await page.evaluate(text => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world) === text, JSON.stringify(bundle.world))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot().runs.map(run => run.status).sort())).toEqual(['active', 'ended', 'ended']);
  // Importing an archive while another run is loaded must not switch the live
  // state to a different continuation or end/overwrite the living branch.
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'archive-again.json', mimeType: 'application/json', buffer: Buffer.from(bundleText) });
  await expect(page.locator('[data-library-action="review-run"]')).toHaveCount(3);
  expect(await snapshot(page)).toEqual(second);
  expect(await page.evaluate(id => window.helixHeresyDebug.worldLibrarySnapshot().runs.find(run => run.id === id).status, second.id)).toBe('active');
  expect(errors).toEqual([]);
});

test('unsupported legacy contingency cannot suspend handling death or grant free revival', async ({ page }) => {
  test.setTimeout(240000);
  await start(page);
  await page.evaluate(() => window.helixHeresyDebug.addTestResurrectionContingency());
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage('handling'));
  await expect(page.locator('#runOutcomeHeading')).toHaveText('Run ended');
  const saved = await snapshot(page);
  expect(saved).toMatchObject({ ended: true, health: 0,
    deaths: [{ causeKind: 'handlingInjury', terminal: true, resurrection: { status: 'unavailable' } }] });
  await page.reload();
  await expect(page.locator('#loadLastSaveBtn')).toBeDisabled();
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="review-run"]').click();
  await expect(page.locator('#runOutcomeHeading')).toHaveText('Run ended');
  expect(await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot().runs[0].state.scientistDeath.records)).toEqual(saved.deaths);
  await expect(page.locator('[data-library-action="resume-run"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot().runs[0].status)).toBe('ended');
});

test('scoped placement envelope keeps roofs and other layers correct and refreshes after a breach', async ({ page }) => {
  test.setTimeout(120000);
  await start(page);
  const surface = await page.evaluate(() => window.helixHeresyDebug.surfaceMapSnapshot());
  expect(surface.envelopeCounts.outdoor).toBeGreaterThan(0);
  expect(surface.envelopeCounts.interior).toBeGreaterThan(0);
  const cells = [surface.samples.outdoor, surface.samples.interior,
    { ...surface.samples.interior, z: surface.surfaceZ + 1 },
    { x: 5, y: 5, z: 0 }, { x: 5, y: 5, z: 5 }, { x: 5, y: 5, z: 7 }];
  const views = await page.evaluate(cells => cells.map(cell => window.helixHeresyDebug.surfaceEnvelopeForTest(cell)), cells);
  for (const view of views) expect(view.direct).toEqual(view.batched);
  expect(views[0].direct.kind).toBe('outdoor');
  expect(views[1].direct.kind).toBe('interior');
  expect(views[2].direct.kind).toBe('roof');
  expect(views[3].direct.kind).toBe('subterranean');
  expect(views[4].direct.kind).toBe('openAir');
  expect(views[5].direct.kind).toBe('openAir');
  await page.evaluate(id => {
    const d = window.helixHeresyDebug;
    const saved = d.exportSurveyExpeditionTestState();
    Object.assign(saved.doors[id], { condition: 0, breached: true, state: 'open', lockState: 'unlocked', sealState: 'unsealed' });
    d.importSurveyExpeditionTestState(saved);
  }, surface.frontDoor.id);
  const breached = await page.evaluate(() => window.helixHeresyDebug.surfaceMapSnapshot());
  expect(breached.envelopeCounts.exposedInterior).toBeGreaterThan(0);
  expect(breached.envelopeCounts.interior || 0).toBeLessThan(surface.envelopeCounts.interior);
});
