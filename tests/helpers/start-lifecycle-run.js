const { expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const Library = require('../../world-run-library');
const { lifecycleWorld } = require('./lifecycle-world');

async function startLifecycleRun(page, seed = 'focused-lifecycle-run') {
  const world = lifecycleWorld();
  await page.goto(pathToFileURL(path.resolve(__dirname, '../..', 'index.html')).href);
  await page.evaluate(({ id, payload }) => {
    localStorage.clear();
    localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
    localStorage.setItem('helix-heresy-v2-library', JSON.stringify({ version: 2, worldIds: [id], runIds: [] }));
    localStorage.setItem(`helix-heresy-v2-world:${id}`, payload);
  }, { id: world.id, payload: Library.compressStorageText(JSON.stringify(world)) });
  await page.reload();
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();
  await page.locator('#seedInput').fill(seed);
  await page.locator('[data-starting-site-input]').first().check();
  await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
}

module.exports = { startLifecycleRun };
