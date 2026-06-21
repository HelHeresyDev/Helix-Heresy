// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

const visualPauseMs = Number(process.env.VISUAL_PAUSE_MS || 0);

async function visualPause(page, locator, label) {
  if (!Number.isFinite(visualPauseMs) || visualPauseMs <= 0) {
    return;
  }
  await locator.scrollIntoViewIfNeeded();
  console.log(`Visual pause: ${label} (${visualPauseMs}ms)`);
  await page.waitForTimeout(visualPauseMs);
}

test.describe('Bedroom + Doors Pass 2 smoke test', () => {
  test('source includes bedroom, door policy, and door-gated free creature routing', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const BEDROOM_ROOM_ID = "bedroom"');
    expect(source).toContain('roleLabel: "Rest and recovery"');
    expect(source).toContain('connections: [MAIN_ROOM_ID]');
    expect(source).toContain('const DOOR_POLICY_DEFS');
    expect(source).toContain('DEFAULT_DOOR_POLICY_ID = "leaveAsSet"');
    expect(source).toContain('function defaultDoors()');
    expect(source).toContain('function normalizeDoors(');
    expect(source).toContain('function doorIsOpen(');
    expect(source).toContain('doorPolicyList');
    expect(source).toContain('function bestReachableContaminationTargetRoom(');
    expect(source).toContain('blocked by closed door');
    expect(source).toContain('doorTransit: doorTransitPlan(route)');
    expect(source).toContain('doorTransit: doorTransitPlan(haulRoute)');
  });

  test('UI shows Bedroom, door states, policy, and scientist auto door behavior', async ({ page }) => {
    if (visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 6);
    }

    const consoleIssues = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(appUrl);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.locator('#setupForm button[type="submit"]').click();

    await expect(page.locator('#roomSummary')).toContainText('4 rooms active');
    await expect(page.locator('#roomSummary')).toContainText('Current location: Main Lab');
    await expect(page.locator('#roomList')).toContainText('Bedroom');
    await expect(page.locator('#roomList')).toContainText('Rest and recovery');

    await expect(page.locator('[data-room-door-controls="mainLab"]')).toContainText('Bedroom door: Closed');
    await expect(page.locator('[data-room-door-controls="mainLab"]')).toContainText('Menagerie door: Open');
    await expect(page.locator('[data-room-door-controls="mainLab"]')).toContainText('Pits door: Open');
    await expect(page.locator('[data-room-door-controls="bedroom"]')).toContainText('Main Lab door: Closed');

    const doorPolicy = page.locator('[data-door-policy-select="true"]');
    await expect(doorPolicy).toHaveValue('leaveAsSet');
    await expect(page.locator('#policySummary')).toContainText('Door behavior: leave as set');
    await expect(page.locator('#corpsePolicyList')).not.toContainText('Door behavior');
    await expect(page.locator('#doorPolicyList')).toContainText('Door behavior');
    await expect(page.locator('#policyTitle')).toBeVisible();

    await visualPause(page, page.locator('#policyTitle'), 'Policies panel with separate Doors section');
    await visualPause(page, page.locator('#roomList'), 'Room cards and door controls before scientist movement');

    // Moving through a closed Bedroom door should remain convenient for the scientist.
    // Under the default policy, the closed door returns to closed after movement.
    await page.locator('[data-scientist-move-room-id="bedroom"]').click();
    await expect(page.locator('#queueSummary')).toContainText('Move scientist to Bedroom');
    await page.keyboard.press('Shift+Period');
    await expect(page.locator('#roomSummary')).toContainText('Current location: Bedroom');
    await expect(page.locator('[data-room-door-controls="bedroom"]')).toContainText('Main Lab door: Closed');
    await visualPause(page, page.locator('#eventLog'), 'Event log after default auto-open/reclose movement');

    // Manual door buttons should change door state.
    const bedroomDoorToggle = page.locator('[data-room-door-controls="bedroom"] [data-door-toggle="bedroom::mainLab"]');
    await bedroomDoorToggle.click();
    await expect(page.locator('[data-room-door-controls="bedroom"]')).toContainText('Main Lab door: Open');
    await bedroomDoorToggle.click();
    await expect(page.locator('[data-room-door-controls="bedroom"]')).toContainText('Main Lab door: Closed');

    // The policy can leave a door open after movement.
    await doorPolicy.selectOption('leaveOpenAfterUse');
    await expect(page.locator('#policySummary')).toContainText('Door behavior: leave open after use');
    await page.locator('[data-scientist-move-room-id="mainLab"]').click();
    await expect(page.locator('#queueSummary')).toContainText('Move scientist to Main Lab');
    await page.keyboard.press('Shift+Period');
    await expect(page.locator('#roomSummary')).toContainText('Current location: Main Lab');
    await expect(page.locator('[data-room-door-controls="mainLab"]')).toContainText('Bedroom door: Open');
    await visualPause(page, page.locator('#eventLog'), 'Event log after leave-open door policy movement');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
