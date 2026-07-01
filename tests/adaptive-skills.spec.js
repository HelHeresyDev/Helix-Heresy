// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

function normalXpToNextLevel(level) {
  return Math.round(25 + Math.pow(level + 1, 1.25) * 4);
}

function xpToNextLevel(level) {
  return [0, 50, 100, 150, 200, 250, 300].includes(level)
    ? normalXpToNextLevel(level + 20)
    : normalXpToNextLevel(level);
}

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('skill sheet hides level-zero practice and reveals Initiate skills', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);

  const skillList = page.locator('#skillList');
  await expect(skillList).toContainText('No learned skills yet');
  await expect(skillList).not.toContainText('Analysis');
  await expect(skillList).not.toContainText('Observation');
  await expect(skillList).not.toContainText('Perception');

  const firstBreakthrough = xpToNextLevel(0);

  await page.locator('#xpCommandInput').fill(`analysis ${firstBreakthrough - 1}`);
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('No learned skills yet');
  await expect(skillList).not.toContainText('Analysis');

  await page.locator('#xpCommandInput').fill('analysis 1');
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('Analysis');
  await expect(skillList).toContainText('[Initiate], level 1');
  await expect(skillList).toContainText(`0 / ${xpToNextLevel(1)} XP to level 2`);
  await expect(skillList).not.toContainText('Observation');
  await expect(skillList).not.toContainText('Perception');

  await page.locator('#xpCommandInput').fill(`perception ${firstBreakthrough + 500}`);
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('Perception');
  await expect(skillList).toContainText('[Initiate], level 1');

  const savedSkills = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const state = payload.state || payload;
    return {
      analysis: state.scientist?.skills?.analysis || null,
      perception: state.scientist?.skills?.perception || null,
    };
  });

  expect(savedSkills.analysis?.xp).toBe(firstBreakthrough);
  expect(savedSkills.analysis?.practiceTags?.cheatcommand).toBe(firstBreakthrough);
  expect(savedSkills.perception?.xp).toBe(firstBreakthrough);
  expect(savedSkills.perception?.practiceTags?.cheatcommand).toBe(firstBreakthrough);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('low-confidence diagnostic failure grants reduced XP', async ({ page }) => {
  await startRun(page);

  await page.locator('[data-physical-diagnostic-test-id="selfCheck"]').click();
  await page.locator('#skipAmountInput').evaluate((element) => {
    element.value = '300';
  });
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());

  const skill = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.scientist?.skills?.analysis || null;
  }, { key: storageKey });

  expect(skill?.xp).toBe(1.5);
  expect(skill?.practiceTags?.selfcheck).toBe(1.5);
  await expect(page.locator('#skillList')).toContainText('No learned skills yet');
});
