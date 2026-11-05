const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { finish } = require('./helpers/divine-submission-visit');
test.setTimeout(180000); test.use({ actionTimeout: 12000 });
const keyActivate = async locator => { await locator.focus(); await locator.press('Enter'); };
async function auditNames(page) {
  return page.evaluate(() => [...document.querySelectorAll('input,select,textarea,button')]
    .filter(e => e.getClientRects().length && !e.closest('[hidden],[inert],.hidden') && e.type !== 'hidden')
    .filter(e => !e.getAttribute('aria-label')?.trim() && !e.getAttribute('aria-labelledby')?.trim()
      && ![...(e.labels || [])].some(l => l.textContent.trim()) && !(['BUTTON', 'INPUT'].includes(e.tagName) && (e.textContent.trim() || ['submit', 'button'].includes(e.type) && e.value))
      && !e.title.trim()).map(e => e.outerHTML.slice(0, 200)));
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: shared keyboard, focus, labels, local map orders and blocked-action journey`, async ({ page }) => {
  // Keep wall time fixed while testing native pause activation. Animation and
  // input events still run; physical work below advances by its actual clock.
  await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, `accessibility-${renderer}`);
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  await keyActivate(page.locator('#debugToggleBtn')); await expect(page.locator('#debugToggleBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#labRoot')).not.toHaveAttribute('aria-live', /polite|assertive/);
  await expect(page.locator('.status-strip')).not.toHaveAttribute('aria-live', /polite|assertive/);
  const pause = page.locator('#pauseBtn'); await keyActivate(pause); await expect(pause).toHaveText('Pause');
  await pause.press('Space'); await expect(pause).toHaveText('Resume');
  const speed = page.locator('#timeSpeedSelect'); await speed.focus(); await speed.press('Home'); await speed.press('ArrowDown');
  await expect(speed).toBeFocused(); await expect(pause).toHaveText('Resume');
  for (const view of ['specimens', 'research', 'economy', 'log']) {
    await keyActivate(page.locator(`[data-workspace-tab="${view}"]`));
    expect(await auditNames(page), `Unlabelled controls in ${view}`).toEqual([]);
    if (view === 'specimens') {
      const living = page.locator('[data-creature-record-tab="living"]'); await living.focus(); await living.press('End');
      const testing = page.locator('[data-creature-record-tab="testing"]'); await expect(testing).toBeFocused(); await expect(testing).toHaveAttribute('aria-selected', 'true');
      await expect(testing).toHaveAttribute('aria-controls', /a11y-panel/);
      await testing.press('Home'); await expect(living).toBeFocused();
    }
    if (view === 'research') {
      await keyActivate(page.locator('#actionAvailability summary'));
      await expect(page.locator('#actionAvailabilityList')).toContainText(/evidence|prerequisite|skill|research|specimen/i);
      await keyActivate(page.locator('[data-workspace-tab="log"]'));
      await expect(page.locator('#actionAvailabilityList')).toContainText('Play preview');
      await keyActivate(page.locator('[data-workspace-tab="research"]'));
      await page.keyboard.press('Escape'); await expect(page.locator('#actionAvailability')).not.toHaveAttribute('open');
    }
  }
  await keyActivate(page.locator('[data-workspace-tab="foundry"]'));
  const input = page.locator('#sequenceInput'); await input.fill('ACGT'); await input.focus(); await input.press('ArrowLeft');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  await expect(input).toBeFocused(); await expect(input).toHaveValue('ACGT');
  expect(await input.evaluate(e => e.selectionStart)).toBe(3);
  // Dynamic controls survive their parent's rebuild without transferring focus
  // to a different target. The fixture supplies no game outcome or permission.
  await page.evaluate(() => {
    const root = document.querySelector('[data-workspace-panel="foundry"]');
    const block = document.createElement('div'); block.dataset.a11yFixtureEntity = 'original-order';
    block.innerHTML = '<label>Draft amount <input type="text" data-draft-amount="original-order"></label>'; root.append(block);
    const e = block.querySelector('input'); e.value = 'draft'; e.focus(); e.setSelectionRange(2, 2);
    window.HelixAccessibilityUI.preserveFocus(document, () => { block.outerHTML = block.outerHTML; });
  });
  await expect(page.locator('[data-draft-amount]')).toBeFocused(); await expect(page.locator('[data-draft-amount]')).toHaveValue('draft');
  await page.evaluate(() => {
    const block = document.querySelector('[data-a11y-fixture-entity]');
    window.HelixAccessibilityUI.preserveFocus(document, () => {
      block.outerHTML = '<div data-a11y-fixture-entity="different-order"><label>Draft amount <input type="text" data-draft-amount="different-order"></label></div>';
    });
  });
  await expect(page.locator('[data-draft-amount]')).not.toBeFocused(); await expect(page.locator('[data-draft-amount]')).toHaveValue('');
  await keyActivate(page.locator('[data-workspace-tab="map"]'));
  // The first northern tile contains the actual synthesis tube; continue to
  // the next floor tile rather than asking movement through a blocking object.
  const map = page.locator('[data-map-viewport][tabindex="0"]').first(); await map.focus(); await map.press('ArrowUp'); await map.press('ArrowUp');
  await expect(map).toBeFocused(); await expect(page.locator('#interfaceAnnouncer')).toContainText('Map cursor');
  await map.press('Enter');
  await keyActivate(page.locator('[data-selection-also-here-key^="tile:"]').first());
  await keyActivate(page.locator('[data-selection-inspector-tab="actions"]'));
  const move = page.getByRole('button', { name: /Move Scientist Here/i }).first();
  await expect(move).toBeEnabled(); await keyActivate(move); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot().scientistCell)).toEqual({ x: 52, y: 48, z: 0 });
  const summary = await page.locator('[data-map-assistive-status]').textContent(); expect(summary).toContain('Map cursor');
  await map.focus(); await map.press('[');
  await expect(page.locator('[data-map-assistive-status]')).toContainText(/unknown|unobserved|unexplored|no known/i);
  await expect(page.locator('[data-map-assistive-status]')).not.toContainText(/Granite|Basalt|ore deposit/i);
  expect(errors).toEqual([]);
});

test('a real queued move held by changed physical doors remains inspectable and cancellable by keyboard', async ({ page }) => {
  await startLifecycleRun(page, 'accessibility-blocked-queue');
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    const task = d.startScientistMove('storageRoom', { toCell: saved.labMap.rooms.storageRoom.anchor, urgent: true, allowMultiRoom: true });
    const doors = Object.entries(saved.labMap.doors).filter(([, door]) => door.roomIds.includes('storageRoom'));
    for (const [id] of doors) { d.setDoorPhysicalState(id, 'closed'); d.setDoorLockPhysicalState(id, 'locked'); }
    return { id: task?.id, doors: doors.length, tasks: d.surveyExpeditionSnapshot().tasks };
  });
  expect(result.id).toBeTruthy(); expect(result.doors).toBeGreaterThan(0);
  const blocked = result.tasks.find(t => t.id === result.id); expect(blocked.reason).toBeTruthy();
  await keyActivate(page.locator('[data-workspace-tab="tasks"]'));
  await keyActivate(page.locator('[data-task-menu-tab="blocked"]'));
  await expect(page.locator('#blockedTaskList')).toContainText(blocked.reason);
  const row = page.locator(`[data-task-row="${result.id}"]`);
  await keyActivate(row.getByRole('button', { name: /Cancel/i }));
  expect(await page.evaluate(id => window.helixHeresyDebug.surveyExpeditionSnapshot().tasks.some(t => t.id === id), result.id)).toBe(false);
});

test('startup, world/site choice, native confirmation cancellation, death and independent restart retain keyboard focus', async ({ page }) => {
  await startLifecycleRun(page, 'accessibility-startup');
  await keyActivate(page.locator('#newRunBtn')); await keyActivate(page.locator('#titleSettingsBtn'));
  const dialog = page.locator('#setupOverlay'); await expect(dialog).toHaveAttribute('role', 'dialog'); await expect(dialog).toHaveAttribute('aria-labelledby', 'titleSettingsHeading');
  await page.locator('#titleSettingsBackBtn').focus(); await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#titleResetSettingsBtn')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#titleSettingsBackBtn')).toBeFocused();
  await keyActivate(page.locator('#titleSettingsBackBtn')); await expect(page.locator('#titleSettingsBtn')).toBeFocused();
  await keyActivate(page.locator('#titleWorldLibraryBtn'));
  const del = page.locator('[data-library-action="delete-run"]').first(); await del.focus();
  page.once('dialog', d => d.dismiss()); await del.press('Enter'); await expect(del).toBeFocused();
  await keyActivate(page.locator('[data-library-action="start-run"]').first());
  expect(await auditNames(page)).toEqual([]);
  const globe = page.locator('#strategicWorldCanvas'); await globe.focus(); await globe.press('ArrowRight'); await globe.press('Enter');
  await expect(page.locator('#strategicCellId')).not.toHaveText('None');
  await page.locator('[data-starting-site-input]').first().focus(); await page.keyboard.press('Space');
  await page.locator('#seedInput').fill('accessibility-new-branch'); await keyActivate(page.locator('#startRunSubmitBtn'));
  await expect(dialog).toHaveClass(/hidden/);
  await page.evaluate(() => { window.helixHeresyDebug.inflictTestScientistDamage(); window.helixHeresyDebug.advanceTestRunTime(1); });
  await expect(page.locator('#runOutcomeHeading')).toBeFocused(); await expect(dialog).toHaveAttribute('aria-labelledby', 'runOutcomeHeading');
  await keyActivate(page.locator('#runOutcomeRestartBtn'));
  await page.locator('[data-starting-site-input]').first().focus(); await page.keyboard.press('Space');
  await page.locator('#seedInput').fill('accessibility-after-death'); await keyActivate(page.locator('#startRunSubmitBtn'));
  await expect(dialog).toHaveClass(/hidden/); await expect(page.locator('#pauseBtn')).toBeFocused();
});

test('200-percent-equivalent layout, readable contrast and reduced sensory settings retain usable management controls', async ({ page, context }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startLifecycleRun(page, 'accessibility-zoom');
  await keyActivate(page.locator('#newRunBtn')); await keyActivate(page.locator('#titleSettingsBtn'));
  await page.locator('[data-title-preference="mapContrast"]').selectOption('high');
  await keyActivate(page.locator('#titleSettingsBackBtn')); await keyActivate(page.locator('#loadLastSaveBtn'));
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 400, deviceScaleFactor: 2, mobile: false });
  for (const view of ['research', 'economy', 'log']) {
    await keyActivate(page.locator(`[data-workspace-tab="${view}"]`));
    const panel = page.locator(`[data-workspace-panel="${view}"]`);
    await expect(panel).toBeVisible();
    const rect = await panel.boundingBox(); expect(rect.height).toBeGreaterThan(40); expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(641);
    expect(await panel.evaluate(e => e.scrollWidth <= e.clientWidth + 2)).toBe(true);
    expect(await auditNames(page)).toEqual([]);
  }
  const settings = page.locator('[data-notification-settings="game"]');
  await settings.getByRole('slider', { name: 'Notification volume' }).focus(); await page.keyboard.press('End');
  await expect(settings.getByRole('slider', { name: 'Notification volume' })).toHaveValue('100');
  await page.screenshot({ path: '/tmp/helix-a11y-zoom-management.png' });
  await keyActivate(page.locator('[data-workspace-tab="map"]'));
  await page.locator('[data-map-viewport][tabindex="0"]').first().focus(); await page.keyboard.press('ArrowRight');
  await page.screenshot({ path: '/tmp/helix-a11y-zoom-map.png' });
  expect(await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }))).toEqual({ body: 640, viewport: 640 });
  await client.send('Emulation.clearDeviceMetricsOverride'); await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await keyActivate(page.locator('[data-workspace-tab="log"]'));
  const textPanel = page.locator('[data-workspace-panel="log"]');
  await expect(textPanel).toBeVisible();
  expect(await textPanel.evaluate(e => e.scrollWidth <= e.clientWidth + 2)).toBe(true);
  await settings.getByRole('checkbox', { name: 'Mute all notification sounds' }).focus();
  await page.screenshot({ path: '/tmp/helix-a11y-text-200.png' });
  await expect(settings.getByRole('checkbox', { name: 'Mute all notification sounds' })).toBeInViewport();
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-map-contrast', 'high');
  await page.screenshot({ path: '/tmp/helix-a11y-forced-colors.png' });
});
