const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { finish } = require('./helpers/divine-submission-visit');
test.setTimeout(180000);
test.use({ actionTimeout: 15000 });
const prefsKey = 'helix-heresy-v1-preferences';
const snapshot = p => p.evaluate(() => window.helixHeresyDebug.notificationSnapshot());
const emit = (p, message, options) => p.evaluate(({ message, options }) => window.helixHeresyDebug.emitNotificationTestEvent(message, options), { message, options });
async function instrumentAudio(p) {
  await p.addInitScript(() => {
    window.toneNotes = [];
    const proto = window.AudioContext?.prototype; if (!proto) return;
    const create = proto.createOscillator;
    proto.createOscillator = function (...args) {
      window.toneContext = this;
      const node = create.apply(this, args), start = node.start;
      node.start = function (...args) { window.toneNotes.push({ frequency: node.frequency.value }); return start.apply(this, args); };
      return node;
    };
  });
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: notification controls and actual supplied synthesis/test outcomes, danger, reload and continued import`, async ({ page }) => {
  await instrumentAudio(page); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, `notifications-${renderer}`);
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  await page.locator('[data-workspace-tab="log"]').click();
  const settings = page.locator('[data-notification-settings="game"]');
  await expect(settings.locator('[data-notification-pref="muted"]')).toBeChecked();
  await settings.getByRole('button', { name: 'Enable sound for this page' }).focus(); await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).audioReady).toBe(true);
  const volume = settings.getByRole('slider', { name: 'Notification volume' });
  await volume.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  await expect(volume).toHaveValue('1'); expect((await snapshot(page)).preferences.volume).toBe(.01);
  await settings.getByRole('button', { name: 'Play preview' }).click();
  await expect.poll(() => page.evaluate(() => window.toneNotes.length)).toBe(2);
  if (renderer === 'dom') {
    // Browser permission/resume can resolve after a newer mute command. Hold
    // actual resume promises and ensure the obsolete preview cannot play.
    await page.evaluate(async () => {
      await window.toneContext.suspend(); window.resumeReleases = [];
      const resume = window.AudioContext.prototype.resume; window.originalAudioResume = resume;
      window.AudioContext.prototype.resume = function () { return new Promise(resolve => window.resumeReleases.push(() => resume.call(this).then(resolve))); };
    });
    await settings.getByRole('button', { name: 'Play preview' }).click();
    await settings.getByRole('checkbox', { name: 'Mute all notification sounds' }).check();
    await page.evaluate(async () => {
      window.AudioContext.prototype.resume = window.originalAudioResume;
      await Promise.all(window.resumeReleases.map(release => release()));
    });
    expect(await page.evaluate(() => window.toneNotes.length)).toBe(2);
    await settings.getByRole('checkbox', { name: 'Mute all notification sounds' }).uncheck();
  }
  // An actual supplied task, not a forged notification outcome.
  await page.locator('[data-workspace-tab="foundry"]').click(); await page.locator('#synthesizeBtn').click(); await finish(page);
  await expect(page.locator('#messageFeed [data-notification-kind="completion"]')).toContainText('stabilized');
  await expect.poll(() => page.evaluate(() => window.toneNotes.length)).toBeGreaterThanOrEqual(4);
  await page.locator('[data-workspace-tab="specimens"]').click();
  await page.locator('[data-creature-record-tab="testing"]').click();
  const testButton = page.locator('[data-test-id="sustenance"]');
  await expect(testButton).toBeEnabled(); await testButton.click(); await finish(page);
  await expect(page.locator('#messageFeed [data-notification-kind="discovery"]')).toContainText('New observations recorded');
  // Explicit event fixtures exercise shared delivery boundaries, not simulation
  // outcomes. Ordinary history is never rewritten by notification grouping.
  const broken = await page.evaluate(() => window.helixHeresyDebug.damageTool('thaumometer', 10000));
  expect(broken.broken).toBe(true);
  await expect(page.locator('#messageFeed [data-notification-kind="warning"]')).toContainText('broke');
  const historyBefore = (await snapshot(page)).events.length;
  await page.evaluate(() => { for (let i = 0; i < 100; i++) window.helixHeresyDebug.emitNotificationTestEvent('Observed warning: blocked work.', { severity: 'warning', sourceKind: 'fixture', sourceId: 'burst' }); });
  await expect(page.locator('#messageFeed')).toContainText('100 related notices');
  expect((await snapshot(page)).events.length).toBe(Math.min(240, historyBefore + 100));
  const beforeDanger = await page.evaluate(() => window.toneNotes.length);
  await emit(page, 'Visible critical fixture alarm.', { severity: 'critical', sourceKind: 'fixture', sourceId: 'danger' });
  await expect(page.locator('#messageFeed')).toHaveAttribute('data-feed-fade', 'false');
  await expect.poll(() => page.evaluate(() => window.toneNotes.length)).toBe(beforeDanger + 3);
  const dismiss = page.locator('[data-notification-kind="danger"] [data-notification-dismiss]');
  await dismiss.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#messageFeed')).not.toContainText('Visible critical fixture alarm');
  await page.locator('[data-workspace-tab="log"]').click(); await expect(page.locator('#eventLog')).toContainText('Visible critical fixture alarm');
  const warningToggle = settings.getByRole('checkbox', { name: 'Warning sounds' }); await warningToggle.uncheck();
  const saved = (await snapshot(page)).preferences;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="log"]').click();
  expect((await snapshot(page)).preferences).toEqual(saved); await expect(settings.getByRole('checkbox', { name: 'Warning sounds' })).not.toBeChecked();
  expect(await page.evaluate(() => window.toneNotes.length)).toBe(0);
  await expect(page.locator('#eventLog')).toContainText('Visible critical fixture alarm');
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const notes = await page.evaluate(() => window.toneNotes.length);
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'notifications.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  expect((await snapshot(page)).preferences).toEqual(saved); expect((await snapshot(page)).groups).toEqual([]);
  expect(await page.evaluate(() => window.toneNotes.length)).toBe(notes);
  await page.evaluate(() => { window.helixHeresyDebug.inflictTestScientistDamage(); window.helixHeresyDebug.advanceTestRunTime(1); });
  await expect(page.locator('#notificationAnnouncer')).toContainText('Immediate danger');
  const afterDeath = await page.evaluate(() => window.toneNotes.length);
  await emit(page, 'Impossible later research completed.', { cue: 'discovery' });
  expect(await page.evaluate(() => window.toneNotes.length)).toBe(afterDeath);
  expect(errors).toEqual([]);
});
test('unavailable audio keeps controls and text usable, and the browser-wide mute default survives settings reload', async ({ page }) => {
  await page.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await startLifecycleRun(page, 'notifications-no-audio');
  await page.locator('[data-workspace-tab="log"]').click();
  const panel = page.locator('[data-notification-settings="game"]');
  await panel.getByRole('button', { name: 'Enable sound for this page' }).click();
  // An unsuccessful explicit enable does not silently turn off mute.
  expect((await snapshot(page)).preferences.muted).toBe(true);
  // Unmuting is also a real user setting; failure must be explained, not thrown.
  await panel.getByRole('checkbox', { name: 'Mute all notification sounds' }).uncheck();
  await expect(panel.locator('[data-notification-status]')).toContainText('unavailable or blocked');
  await emit(page, 'Visible unavailable-audio warning.', { severity: 'warning' });
  await expect(page.locator('#messageFeed')).toContainText('Visible unavailable-audio warning');
  expect((await snapshot(page)).audioReady).toBe(false);
  await panel.getByRole('checkbox', { name: 'Mute all notification sounds' }).check();
  await page.locator('#newRunBtn').click(); await page.locator('#titleSettingsBtn').click();
  await expect(page.locator('[data-notification-settings="title"] [data-notification-pref="muted"]')).toBeChecked();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).notificationAudio.muted, prefsKey)).toBe(true);
});

test('background and off-site knowledge boundaries discard unheard cues without backlog or hidden-lab notification', async ({ page }) => {
  await instrumentAudio(page); await startLifecycleRun(page, 'notifications-boundaries');
  await page.locator('[data-workspace-tab="log"]').click();
  await page.locator('[data-notification-settings="game"] [data-notification-action="enable"]').click();
  await page.evaluate(() => {
    // Explicit visibility fixture runs the real visibility-change handler.
    window.notificationHidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.notificationHidden });
    document.dispatchEvent(new Event('visibilitychange'));
    const d = window.helixHeresyDebug;
    d.emitNotificationTestEvent('Background critical alarm.', { severity: 'critical', sourceId: 'background' });
    window.notificationHidden = false; document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await snapshot(page)).groups.length).toBe(0);
  expect(await page.evaluate(() => window.toneNotes.length)).toBe(0);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', known: true },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'City', cellId: 'planet-cell:00001', known: true,
        supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'notification-boundary', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ municipal: true });
    d.emitNotificationTestEvent('Unreceived remote laboratory secret.', { severity: 'critical', sourceKind: 'laboratory', sourceId: 'secret' });
  });
  await expect.poll(async () => (await snapshot(page)).groups.length).toBe(0);
  expect(await page.evaluate(() => window.toneNotes.length)).toBe(0);
  await emit(page, 'Personally received field warning.', { severity: 'warning', sourceKind: 'surveyExpedition', sourceId: 'field' });
  await expect(page.locator('#notificationAnnouncer')).toContainText('Personally received field warning');
  await expect.poll(() => page.evaluate(() => window.toneNotes.length)).toBe(2);
  expect((await snapshot(page)).groups.some(g => g.event.message.includes('secret'))).toBe(false);
  await expect(page.locator('#messageFeed')).not.toContainText('Unreceived remote laboratory secret');
});
