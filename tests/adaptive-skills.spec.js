// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

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

  await page.locator('#xpCommandInput').fill('analysis 99');
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('No learned skills yet');
  await expect(skillList).not.toContainText('Analysis');

  await page.locator('#xpCommandInput').fill('analysis 1');
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('Analysis');
  await expect(skillList).toContainText('[Initiate], level 1');
  await expect(skillList).not.toContainText('Observation');

  const savedSkill = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const state = payload.state || payload;
    return state.scientist?.skills?.analysis || null;
  });

  expect(savedSkill?.xp).toBe(100);
  expect(savedSkill?.practiceTags?.cheatcommand).toBe(100);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

