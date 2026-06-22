// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const visualPauseMs = Number(process.env.VISUAL_PAUSE_MS || 0);

async function visualPause(page, locator, label) {
  if (!Number.isFinite(visualPauseMs) || visualPauseMs <= 0) return;
  await locator.scrollIntoViewIfNeeded();
  console.log(`Visual pause: ${label} (${visualPauseMs}ms)`);
  await page.waitForTimeout(visualPauseMs);
}

async function startRunAndCreateSlime(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
  await page.locator('#synthesizeBtn').click();
  await page.keyboard.press('Shift+Period');
  await expect(page.locator('#selectedSlimeSummary')).toContainText('RG-001');
}

async function loadEditedSave(page, editFnSource) {
  await page.evaluate((fnSource) => {
    const key = 'helix-heresy-v1-save';
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const edit = new Function('payload', fnSource);
    edit(payload);
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, editFnSource);
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

test.describe('Contamination Cleanup Behavior Pass 2 observable cleanup feedback', () => {
  test('source adds observed cleanup tags, ambiguous door intent, and no cleanup tick log spam', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function cleanupActivityPerformance(');
    expect(source).toContain('function slimeDoorIntentAssessment(');
    expect(source).toContain('function roomBiologicalCleanupTags(');
    expect(source).toContain('Biological cleanup active');
    expect(source).toContain('Activity: pressing against closed door');
    expect(source).toContain('Possible intent: ${intent.text}');
    expect(source).toContain('seeking contamination–hunting');
    expect(source).toContain('Cleanup effect: ${predictionRangeText(performance.range)}');
    expect(source).toContain('recordCleanupObservation(slime, "feedingOnContamination"');
    expect(source).toContain('visible contamination cleared by biological cleanup');

    expect(source).not.toContain('fed on contamination in ${room.name}');
    expect(source).not.toContain('left residue across ${room.name}');
    expect(source).not.toContain('following contamination through connected rooms');
    expect(source).not.toContain('label: "blocked by closed door"');
  });

  test('visible UI shows room cleanup tag, creature activity tags, estimates, and ambiguous door intent', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 4);
    }

    const consoleIssues = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await startRunAndCreateSlime(page);

    await loadEditedSave(page, `
      const state = payload.state;
      state.started = true;
      state.scientist.roomId = 'mainLab';
      const mainLab = state.rooms.find((room) => room.id === 'mainLab');
      if (mainLab) mainLab.attributes.contamination.current = 42;
      const slime = state.slimes[0];
      slime.status = 'released';
      slime.containerId = null;
      slime.roomId = 'mainLab';
      slime.job = 'cleanup';
      slime.roomBehavior = { seeksContamination: true, eatsContamination: true, leavesResidue: false };
      slime.roomActivity = { type: 'feedingOnContamination', label: 'feeding on contamination', roomId: 'mainLab', updatedAt: state.clock };
      slime.cleanupObservation = { minutes: 6, feedingMinutes: 6, residueMinutes: 0, doorMinutes: 0, seekingMinutes: 0, clearEvents: 0 };
      state.events = [];
    `);

    const roomList = page.locator('#roomList');
    await expect(roomList).toContainText('Biological cleanup active');
    await expect(page.locator('#slimeList')).toContainText('Activity: feeding on contamination');
    await expect(page.locator('#slimeList')).toContainText(/Cleanup effect: (Trace|Weak|Modest|Good|Strong)(?:–(Trace|Weak|Modest|Good|Strong))?/);
    await expect(page.locator('#slimeList')).toContainText(/Confidence: (Unknown|Rough|Fair|Strong)/);
    await expect(page.locator('#eventLog')).not.toContainText(/fed on contamination|left residue|following contamination/);

    const cleanupEffectChip = page.locator('[data-cleanup-effect-range="slime-1"]').first();
    await expect(cleanupEffectChip).toBeVisible();
    const effectTitle = await cleanupEffectChip.getAttribute('title');
    expect(effectTitle || '').toContain('Cleanup effect range:');
    expect(effectTitle || '').toContain('Observed cleanup time:');
    expect(effectTitle || '').toContain('relevant skills:');

    await visualPause(page, page.locator('#roomList'), 'Biological cleanup room tag and creature activity estimates');

    await loadEditedSave(page, `
      const state = payload.state;
      state.started = true;
      state.scientist.roomId = 'mainLab';
      const mainLab = state.rooms.find((room) => room.id === 'mainLab');
      const bedroom = state.rooms.find((room) => room.id === 'bedroom');
      if (mainLab) mainLab.attributes.contamination.current = 5;
      if (bedroom) bedroom.attributes.contamination.current = 70;
      if (state.doors && state.doors['bedroom::mainLab']) state.doors['bedroom::mainLab'].state = 'closed';
      const slime = state.slimes[0];
      slime.status = 'released';
      slime.containerId = null;
      slime.roomId = 'mainLab';
      slime.job = 'cleanup';
      slime.roomBehavior = { seeksContamination: true, eatsContamination: true, predatory: true };
      slime.roomActivity = { type: 'pressingClosedDoor', label: 'pressing against closed door', roomId: 'mainLab', targetRoomId: 'bedroom', updatedAt: state.clock };
      slime.cleanupObservation = { minutes: 8, feedingMinutes: 0, residueMinutes: 0, doorMinutes: 8, seekingMinutes: 0, clearEvents: 0 };
      state.events = [];
    `);

    await expect(page.locator('#slimeList')).toContainText('Activity: pressing against closed door');
    await expect(page.locator('#slimeList')).toContainText('Possible intent: seeking contamination–hunting');
    await expect(page.locator('#slimeList')).toContainText(/Confidence: (Unknown|Rough|Fair|Strong)/);
    await expect(page.locator('#eventLog')).not.toContainText(/blocked by closed door|following contamination/);

    const intentChip = page.locator('[data-possible-intent="slime-1"]').first();
    await expect(intentChip).toBeVisible();
    const intentTitle = await intentChip.getAttribute('title');
    expect(intentTitle || '').toContain('This is an interpretation of observed door behavior');
    expect(intentTitle || '').toContain('not a command or hidden certainty');

    await visualPause(page, page.locator('#slimeList'), 'Ambiguous closed-door intent range');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
