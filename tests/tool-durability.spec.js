// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { genomeForTraits } = require('./gene-fixtures');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

async function saveContext(page) {
  return page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      seed: state.seed,
      complexity: state.complexity || 'clean',
      currentGenome: state.currentGenome || 'A'.repeat(26),
    };
  }, { key: storageKey });
}

async function finishQueuedTask(page, label) {
  await page.locator('#queueToggleBtn').click();
  const taskRow = page.locator('#taskList .task-row').filter({ hasText: label }).first();
  await expect(taskRow).toBeVisible();
  await taskRow.getByRole('button', { name: 'Finish' }).click();
}

async function stageToolDurabilitySlime(page, { genome, toolCurrent = 10 }) {
  await page.evaluate(({ key, genome, toolCurrent }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!container) {
      throw new Error('basic-1 container not found');
    }
    container.type = 'basic';
    container.typeId = 'basicGlassJar';
    container.name = 'Durability Jar';
    container.roomId = 'mainLab';
    container.condition = 100;
    container.isOpen = false;
    container.breachState = 'intact';
    container.environment ||= {};
    container.environment.contamination = { current: 0, baseline: 0 };

    state.started = true;
    state.paused = true;
    state.clock = 0;
    state.tasks = [];
    state.selectedSlimeId = 'tool-slime';
    state.policies ||= {};
    state.policies.handling = { method: 'thickGloves' };
    state.inventory ||= {};
    state.inventory.thickGloves = 1;
    state.toolDurability = {
      ...(state.toolDurability || {}),
      thickGloves: [{ id: 'thickGloves-1', current: toolCurrent, max: 10 }],
    };
    state.scientist ||= {};
    state.scientist.vitals ||= {};
    state.scientist.vitals.stamina = { current: 100, max: 100 };
    state.slimes = [
      {
        id: 'tool-slime',
        name: 'TOOL-001',
        genome,
        source: 'Tool durability fixture',
        createdAt: 0,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: container.id,
        roomId: container.roomId,
        automationExcluded: false,
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {
          bodyIntegrity: { current: 100, max: 100 },
          nutrition: { current: 80, max: 100 },
          currentMass: { current: 100, max: 100 },
          divisionPressure: { current: 0, max: 100 },
          stress: { current: 0, max: 100 },
        },
        skills: {},
        revealed: { element: true, appendages: true },
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {},
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome, toolCurrent });
  await loadSavedRun(page);
}

test('hazardous handling wears a usable tool and shows condition in inventory', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'none' },
  });
  await stageToolDurabilitySlime(page, { genome, toolCurrent: 6 });

  const handlingNote = page.locator('[data-handling-inventory-note="true"]');
  await expect(handlingNote).toContainText('Worn 6/10');
  await page.locator('[data-open-container-id="basic-1"]').click();
  await finishQueuedTask(page, 'Open Durability Jar');
  await expect(page.locator('[data-inventory-item-key="thickGloves"]')).toContainText('Damaged (5/10)');
  await expect(page.locator('[data-handling-inventory-note="true"]')).toContainText('Damaged 5/10');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const gloves = state.toolDurability?.thickGloves?.[0];
    return {
      current: gloves?.current,
      max: gloves?.max,
      events: (state.events || []).map((event) => event.text || event.message || String(event)),
    };
  }, { key: storageKey });

  expect(result.current).toBeLessThan(result.max);
  expect(result.current).toBeGreaterThan(0);
  expect(result.current).toBe(5);
  expect(result.events.some((event) => event.includes('Thick gloves worn to Damaged'))).toBe(true);

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('broken stocked tools block handling with a specific disabled reason', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'none' },
  });
  await stageToolDurabilitySlime(page, { genome, toolCurrent: 0 });

  const handlingNote = page.locator('[data-handling-inventory-note="true"]');
  await expect(handlingNote).toContainText('Thick gloves stocked but broken');
  await expect(handlingNote).toContainText('blocked; cataloged tool is broken');
  await expect(page.locator('[data-inventory-item-key="thickGloves"]')).toContainText('Broken (0/10)');

  const openButton = page.locator('[data-open-container-id="basic-1"]');
  await expect(openButton).toBeDisabled();
  const title = await openButton.getAttribute('title');
  expect(title).toContain('all cataloged Thick gloves tools are broken');
});
