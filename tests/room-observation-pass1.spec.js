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

test.describe('Room Observation Pass 1 detached room change discovery', () => {
  test('source adds room snapshot comparison and detached discovery wording', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function roomChangeDiscoveryMessage(');
    expect(source).toContain('function roomChangeSentence(');
    expect(source).toContain('observeScientistRoom({ discoverChanges: true })');
    expect(source).toContain('This room changed: ${roomChangeSentence(changes)}.');
    expect(source).toContain('the contamination is lower');
    expect(source).toContain('there is more trace slime');
    expect(source).toContain('biological cleanup is a plausible cause');
    expect(source).toContain('Cause uncertain.');
    expect(source).toContain('contaminationValue');
    expect(source).toContain('cleanupActorIds');
    expect(source).toContain('residueActorIds');
    expect(source).toContain('const cleanupNames = namesForSlimeIds(current.cleanupActorIds);');
    expect(source).toContain('const freeNames = namesForSlimeIds(current.freeCreatureIds);');

    expect(source).not.toContain('The scientist notices');
    expect(source).not.toContain('I notice');
    expect(source).not.toContain('cleaned the room while you were away');
  });

  test('entering a changed room logs conjectural detached analysis once', async ({ page }) => {
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
      state.paused = true;
      state.clock = 120;
      state.scientist.roomId = 'bedroom';
      const mainLab = state.rooms.find((room) => room.id === 'mainLab');
      const bedroom = state.rooms.find((room) => room.id === 'bedroom');
      if (mainLab) {
        mainLab.attributes.contamination.current = 8;
        mainLab.observation = {
          observedAt: 10,
          exposureScore: 55,
          exposureBand: 'Poor',
          effect: 'stamina recovery slowed',
          knownFactors: ['fouled air'],
          unknownFactors: [],
          contaminationValue: 48,
          contaminationBand: 'Fouled',
          crowdingLabel: 'Clear',
          freeCreatureCount: 0,
          freeCreatureIds: [],
          cleanupActorIds: [],
          residueActorIds: []
        };
      }
      if (bedroom) {
        bedroom.attributes.contamination.current = 2;
        bedroom.observation = {
          observedAt: 119,
          exposureScore: 2,
          exposureBand: 'Good',
          effect: 'rest recovery stable',
          knownFactors: ['cleaner air'],
          unknownFactors: [],
          contaminationValue: 2,
          contaminationBand: 'Clean',
          crowdingLabel: 'Clear',
          freeCreatureCount: 0,
          freeCreatureIds: [],
          cleanupActorIds: [],
          residueActorIds: []
        };
      }
      state.doors = {
        'bedroom::mainLab': { roomIds: ['bedroom', 'mainLab'], state: 'closed' },
        'mainLab::menagerie': { roomIds: ['mainLab', 'menagerie'], state: 'closed' },
        'mainLab::pits': { roomIds: ['mainLab', 'pits'], state: 'closed' }
      };
      state.roomObservations = {
        mainLab: mainLab?.observation,
        bedroom: bedroom?.observation
      };
      const slime = state.slimes[0];
      slime.status = 'released';
      slime.containerId = null;
      slime.roomId = 'mainLab';
      slime.job = 'cleanup';
      slime.roomBehavior = { seeksContamination: true, eatsContamination: true, leavesResidue: false };
      slime.outOfContainerBehavior = { seeksContamination: true, eatsContamination: true, leavesResidue: false };
      slime.roomActivity = { type: 'feedingOnContamination', label: 'feeding on contamination', roomId: 'mainLab', updatedAt: state.clock };
      slime.cleanupObservation = { minutes: 10, feedingMinutes: 10, residueMinutes: 0, doorMinutes: 0, seekingMinutes: 0, clearEvents: 1 };
      state.events = [];
    `);

    await expect(page.locator('#roomSummary')).toContainText('Current location: Bedroom');
    await expect(page.locator('#eventLog')).not.toContainText('This room changed:');

    await visualPause(page, page.locator('#roomSummary'), 'Before entering changed room');

    await page.locator('[data-scientist-move-room-id="mainLab"]').click();
    await page.keyboard.press('Shift+Period');

    const eventLog = page.locator('#eventLog');
    await expect(eventLog).toContainText('Arrived in Main Lab.');
    await expect(eventLog).toContainText('This room changed: the contamination is lower');
    const logText = await eventLog.textContent();
    expect(logText).toMatch(/(RG-001 is present; biological cleanup is a plausible cause\.|Cause uncertain\.)/);
    await expect(eventLog).not.toContainText('The scientist notices');
    await expect(eventLog).not.toContainText('I notice');
    await expect(eventLog).not.toContainText('RG-001 cleaned the room while you were away');

    const discoveryCount = await page.locator('#eventLog').getByText(/This room changed:/).count();
    expect(discoveryCount).toBe(1);

    await visualPause(page, page.locator('#eventLog'), 'Detached room change discovery event');

    await page.keyboard.press('Shift+Period');
    const discoveryCountAfterExtraSkip = await page.locator('#eventLog').getByText(/This room changed:/).count();
    expect(discoveryCountAfterExtraSkip).toBe(1);

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
