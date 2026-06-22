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

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test.describe('UI Cleanup Pass 2 policy panel layout fix', () => {
  test('source separates corpse controls from target checkboxes and adds resilient CSS', async () => {
    const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
    const cssSource = fs.readFileSync(path.join(projectRoot, 'styles.css'), 'utf8');

    expect(appSource).toContain('corpse-policy-controls');
    expect(appSource).toContain('dataset.corpsePolicyControls');
    expect(appSource).toContain('policy-target-list');
    expect(appSource).toContain('dataset.corpsePolicyTargets');
    expect(appSource).toContain('policy-target-title');
    expect(appSource).toContain('policy-select-field');
    expect(appSource).toContain('corpseControls.append(methodLabel);');
    expect(appSource).toContain('corpseControls.append(destinationLabel);');
    expect(appSource).toContain('corpseControls.append(autoMoveLabel);');
    expect(appSource).toContain('corpseTargets.append(label);');

    expect(cssSource).toContain('.corpse-policy-controls');
    expect(cssSource).toContain('.policy-target-list');
    expect(cssSource).toContain('grid-column: 1 / -1');
    expect(cssSource).toContain('minmax(13rem, 1fr)');
    expect(cssSource).toContain('min-width: 10rem');
  });

  test('policies panel shows readable corpse controls without clipping', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 3);
    }

    const consoleIssues = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await startRun(page);

    const policyPanel = page.locator('#corpsePolicyList');
    await expect(policyPanel).toBeVisible();

    const controls = page.locator('[data-corpse-policy-controls="true"]');
    const targets = page.locator('[data-corpse-policy-targets="true"]');
    await expect(controls).toBeVisible();
    await expect(targets).toBeVisible();

    await expect(controls).toContainText('Handling method');
    await expect(controls).toContainText('Corpse destination');
    await expect(controls).toContainText('Auto-move local corpses');
    await expect(targets).toContainText('Fresh');
    await expect(targets).toContainText('Decaying');
    await expect(targets).toContainText('Spoiled');
    await expect(targets).toContainText('Ruined');

    await expect(page.locator('[data-handling-method-select="true"]')).toBeVisible();
    await expect(page.locator('[data-corpse-destination-select="true"]')).toBeVisible();
    await expect(page.locator('#doorPolicyList')).toContainText('Door behavior');
    await expect(page.locator('#feedingPolicyList')).toContainText('Mode');

    const overflow = await page.locator('#corpsePolicyList').evaluate((el) => {
      const root = el.getBoundingClientRect();
      const offenders = [];
      for (const child of el.querySelectorAll('label, select, .policy-target-list, .policy-control-list')) {
        const rect = child.getBoundingClientRect();
        if (rect.left < root.left - 1 || rect.right > root.right + 1) {
          offenders.push(`${child.tagName}.${child.className || ''}`);
        }
      }
      return offenders;
    });
    expect(overflow).toEqual([]);

    await visualPause(page, page.locator('#corpsePolicyList'), 'Policies panel corpse controls and targets');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
