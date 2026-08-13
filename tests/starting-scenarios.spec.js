// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function openFreshSetup(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

test('New Run presents data-driven scenario cards and hides Debug starts with Debug tools', async ({ page }) => {
  await openFreshSetup(page);

  const chemistry = page.locator('[data-starting-scenario="chemistryFront"]');
  const underground = page.locator('[data-starting-scenario="undergroundLaboratory"]');
  await expect(chemistry).toContainText('Chemistry Front');
  await expect(chemistry).toContainText('Surface business property');
  await expect(chemistry).toContainText('Incomplete inherited records');
  await expect(chemistry.locator('input')).toBeChecked();
  await expect(underground).toContainText('Debug only');

  await page.locator('#debugToggleBtn').evaluate((button) => button.click());
  await expect(page.locator('#debugToggleBtn')).toHaveText('Debug Off');
  await expect(underground).toHaveCount(0);
  await expect(chemistry.locator('input')).toBeChecked();
  await expect(page.locator('#startRunSubmitBtn')).toHaveText('Begin Chemistry Front');
});

test('Chemistry Front materializes immutable scenario, blueprint, generated identity, and liability provenance', async ({ page }) => {
  await openFreshSetup(page);
  const setup = await page.evaluate(() => ({
    seed: document.querySelector('#seedInput').value,
    name: document.querySelector('#companyNameInput').value,
  }));
  await page.locator('#startRunSubmitBtn').click();

  const result = await page.evaluate(() => ({
    current: window.helixHeresyDebug.startingScenarioSnapshot(),
    catalog: window.helixHeresyDebug.startingScenarioCatalogSnapshot(),
    surface: window.helixHeresyDebug.surfaceMapSnapshot(),
  }));

  expect(result.current).toMatchObject({
    scenario: {
      id: 'chemistryFront',
      version: 3,
      blueprintId: 'chemistry-front-site-v3',
      blueprintVersion: 3,
      loadoutProfileId: 'inherited-laboratory-v1',
      materialized: true,
      legacyMigration: false,
    },
    identity: {
      kind: 'frontCompany',
      legalName: setup.name,
      nameSource: 'generated',
      declaredActivity: 'Specialty reagent blending and chemical services',
      publicFacing: true,
      sourceScenarioId: 'chemistryFront',
    },
  });
  expect(setup.name).toBeTruthy();
  expect(result.current.identity.legalName).toBe(await page.evaluate((seed) => window.helixHeresyDebug.generatedCompanyName(seed), setup.seed));
  expect(result.current.liabilities.map((entry) => entry.id)).toEqual([
    'incomplete-business-records',
    'concealed-research-basement',
  ]);
  expect(result.catalog).toHaveLength(2);
  expect(result.catalog.find((entry) => entry.id === 'chemistryFront')).toMatchObject({
    debugOnly: false,
    blueprint: { surfaceMode: 'boundedFacility', spawn: { roomId: 'mainLab' } },
    loadout: { id: 'inherited-laboratory-v1', version: 1 },
  });
  expect(result.catalog.find((entry) => entry.id === 'chemistryFront').loadout.fixtureIds.length).toBeGreaterThan(10);
  expect(result.catalog.find((entry) => entry.id === 'chemistryFront').loadout.resources.biomass).toBeGreaterThan(0);
  expect(result.surface.ground.length).toBeGreaterThan(250);
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
});

test('version-one Chemistry Front saves keep their provenance and do not gain the divided surface topology', async ({ page }) => {
  await openFreshSetup(page);
  await page.locator('#startRunSubmitBtn').click();
  await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.startingScenario = {
      ...state.startingScenario,
      version: 1,
      blueprintId: 'chemistry-front-site-v1',
      blueprintVersion: 1,
    };
    const modernSurfaceIds = new Set([
      'surfaceReception',
      'surfaceStaffOperations',
      'surfaceHazardousStorage',
      'surfaceLoadingBay',
      'surfaceBasementVestibule',
    ]);
    state.rooms = state.rooms.filter((room) => !modernSurfaceIds.has(room.id));
    state.labMap.rooms = Object.fromEntries(Object.entries(state.labMap.rooms).filter(([roomId]) => !modernSurfaceIds.has(roomId)));
    state.labMap.doors = Object.fromEntries(Object.entries(state.labMap.doors).filter(([doorId, door]) =>
      doorId === 'door-surface-front' || (door.cell?.z ?? 0) === 0));
    state.labMap.doors['door-surface-front'].roomIds = ['surfaceFacility'];
    state.doors = Object.fromEntries(Object.entries(state.doors).filter(([doorId]) => state.labMap.doors[doorId]));
    delete state.siteAccessPoints;
    window.localStorage.setItem(key, JSON.stringify({ ...payload, state }));
  }, storageKey);

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const restored = await page.evaluate(() => ({
    scenario: window.helixHeresyDebug.startingScenarioSnapshot().scenario,
    access: window.helixHeresyDebug.siteAccessSnapshot(),
    surface: window.helixHeresyDebug.surfaceMapSnapshot(),
  }));
  expect(restored.scenario).toMatchObject({
    id: 'chemistryFront',
    version: 1,
    blueprintId: 'chemistry-front-site-v1',
    blueprintVersion: 1,
  });
  expect(restored.access.rooms.map((room) => room.id)).toEqual(['surfaceFacility']);
  expect(restored.access.doors.filter((door) => door.cell.z === 1).map((door) => door.id)).toEqual(['door-surface-front']);
  expect(restored.surface.loadingDoor).toBeNull();
});

test('version-two Chemistry Front saves do not acquire the later chemistry equipment line', async ({ page }) => {
  await openFreshSetup(page);
  await page.locator('#startRunSubmitBtn').click();
  await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.startingScenario = {
      ...state.startingScenario,
      version: 2,
      blueprintId: 'chemistry-front-site-v2',
      blueprintVersion: 2,
    };
    state.fixtures = state.fixtures.filter((fixture) => !fixture.id.startsWith('starter-surface-'));
    window.localStorage.setItem(key, JSON.stringify({ ...payload, state }));
  }, storageKey);

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const restored = await page.evaluate(() => ({
    scenario: window.helixHeresyDebug.startingScenarioSnapshot().scenario,
    chemistry: window.helixHeresyDebug.chemistryEquipmentSnapshot(),
  }));
  expect(restored.scenario).toMatchObject({
    id: 'chemistryFront',
    version: 2,
    blueprintId: 'chemistry-front-site-v2',
    blueprintVersion: 2,
  });
  expect(restored.chemistry.fixtures).toEqual([]);
});

test('Debug Underground Laboratory removes surface topology and persists its choice', async ({ page }) => {
  await openFreshSetup(page);
  await page.locator('[data-starting-scenario-input="undergroundLaboratory"]').check();
  await expect(page.locator('#startRunSubmitBtn')).toHaveText('Begin Underground Laboratory');
  await page.locator('#startRunSubmitBtn').click();

  const before = await page.evaluate(() => ({
    current: window.helixHeresyDebug.startingScenarioSnapshot(),
    surface: window.helixHeresyDebug.surfaceMapSnapshot(),
    vertical: window.helixHeresyDebug.verticalMapSnapshot(),
    upperBoundary: window.helixHeresyDebug.horizontalBoundarySnapshot({ x: 52, y: 50, z: 1 }),
  }));
  expect(before.current).toMatchObject({
    scenario: { id: 'undergroundLaboratory', blueprintId: 'underground-laboratory-site-v1', materialized: true },
    identity: { kind: 'unregisteredResearchSite', publicFacing: false },
    liabilities: [expect.objectContaining({ id: 'no-surface-cover', status: 'active' })],
  });
  expect(before.surface.surfaceZ).toBeNull();
  expect(before.surface.ground).toEqual([]);
  expect(before.surface.roofs).toEqual([]);
  expect(before.surface.frontDoor).toBeNull();
  expect(before.surface.basementStair).toBeNull();
  expect(before.vertical.excavated.some((cell) => cell.z > 0)).toBe(false);
  expect(before.upperBoundary).toMatchObject({ type: 'naturalRock', open: false });

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const restored = await page.evaluate(() => window.helixHeresyDebug.startingScenarioSnapshot());
  expect(restored).toEqual(before.current);
});

test('scenario-less legacy saves gain Debug provenance without rebuilding their physical site', async ({ page }) => {
  await openFreshSetup(page);
  await page.locator('#startRunSubmitBtn').click();
  await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    delete state.startingScenario;
    delete state.siteIdentity;
    delete state.startingLiabilities;
    window.localStorage.setItem(key, JSON.stringify({ ...payload, state }));
  }, storageKey);

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const result = await page.evaluate(() => ({
    current: window.helixHeresyDebug.startingScenarioSnapshot(),
    surface: window.helixHeresyDebug.surfaceMapSnapshot(),
  }));
  expect(result.current).toMatchObject({
    scenario: {
      id: 'undergroundLaboratory',
      blueprintId: 'underground-laboratory-site-v1',
      materialized: false,
      legacyMigration: true,
    },
    identity: { kind: 'unregisteredResearchSite', publicFacing: false },
  });
  expect(result.surface.ground.length).toBeGreaterThan(250);
  expect(result.surface.frontDoor).toMatchObject({ id: 'door-surface-front' });
});
