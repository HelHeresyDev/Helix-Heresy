// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

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

async function mapSnapshot(page) {
  return page.evaluate(() => window.helixHeresyDebug.mapViewSnapshot());
}

async function savedMapUi(page) {
  return page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      activeWorkspaceTab: state.ui?.activeWorkspaceTab,
      camera: state.ui?.mapCamera,
      cursor: state.ui?.mapCursor,
      mode: state.ui?.mode,
      commandMenuOpen: Boolean(state.ui?.commandMenuOpen),
      selection: state.selection,
      selectedMapTarget: state.selectedMapTarget,
      timeSpeed: state.timeSpeed,
    };
  }, { key: storageKey });
}

async function openSelectionActions(page) {
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-panel="true"]')).toBeVisible();
  return page.locator('[data-context-command-panel="true"]');
}

async function seedRoomCorpse(page) {
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const anchor = state.labMap.rooms.mainLab.anchor;
    const now = Number(state.clock) || 0;
    state.corpses = [{
      id: 'corpse-smoke-map',
      specimenId: 'smoke-dead',
      name: 'SMOKE-DEAD',
      genome: state.currentGenome,
      source: 'Map smoke fixture',
      deathReason: 'fixture',
      diedAt: now,
      freshUntil: now + 3600,
      spoiledAt: now + 7200,
      decayProfile: { freshSeconds: 3600, decaySeconds: 3600 },
      roomId: 'mainLab',
      containerId: null,
      storage: 'room',
      mapCell: { x: anchor.x - 3, y: anchor.y },
      consumedProgress: 0,
      ruined: false,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      necropsyReport: '',
      harvestedProcedures: {},
      nextOverflowEventAt: null,
    }];
    state.nextCorpseNumber = 2;
    state.selection = null;
    state.selectedMapTarget = null;
    state.selectedSlimeId = null;
    state.ui.activeWorkspaceTab = 'map';
    state.ui.selectionInspectorTab = 'summary';
    state.ui.selectionInspectorExpanded = false;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
}

test('map smoke keeps the large blueprint visible through keyboard pan and zoom', async ({ page }) => {
  await startRun(page);

  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  const initial = await mapSnapshot(page);
  expect(initial.mapWidth).toBe(100);
  expect(initial.mapHeight).toBe(100);
  expect(initial.cells).toHaveLength(initial.width * initial.height);
  expect(initial.viewport).toMatchObject({
    x: expect.any(Number),
    y: expect.any(Number),
    width: expect.any(Number),
    height: expect.any(Number),
  });
  expect(initial.cells.some((cell) => cell.scientist)).toBe(true);
  await expect(page.locator('[data-map-viewport="true"]')).toHaveAttribute('data-map-viewport-width', String(initial.viewport.width));
  await expect(page.locator('[data-map-viewport="true"]')).toHaveAttribute('data-map-viewport-height', String(initial.viewport.height));
  const tileSpacing = await page.locator('[data-map-viewport="true"]').evaluate((grid) => {
    const first = grid.querySelector('.lab-map-cell');
    const x = Number(first.dataset.mapX);
    const y = Number(first.dataset.mapY);
    const right = grid.querySelector(`[data-map-x="${x + 1}"][data-map-y="${y}"]`);
    const below = grid.querySelector(`[data-map-x="${x}"][data-map-y="${y + 1}"]`);
    const firstRect = first.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    const belowRect = below.getBoundingClientRect();
    return {
      columnGap: rightRect.left - firstRect.right,
      rowGap: belowRect.top - firstRect.bottom,
    };
  });
  expect(tileSpacing).toEqual({ columnGap: 0, rowGap: 0 });
  const roomPanelBox = await page.locator('[data-workspace-panel="map"]').boundingBox();
  const mapGridBox = await page.locator('[data-map-viewport="true"]').boundingBox();
  if (!roomPanelBox || !mapGridBox) {
    throw new Error('Map workspace did not have measurable bounds.');
  }
  expect(mapGridBox.width).toBeGreaterThan(roomPanelBox.width * 0.9);
  expect(mapGridBox.height).toBeGreaterThan(roomPanelBox.height * 0.5);
  expect(initial.width).toBeGreaterThan(35);

  const beforePan = await savedMapUi(page);
  await page.keyboard.press('A');
  const afterLeftPan = await savedMapUi(page);
  expect(afterLeftPan.camera.x).toBeLessThan(beforePan.camera.x);
  expect(afterLeftPan.camera.y).toBe(beforePan.camera.y);
  for (const key of ['W', 'S', 'D']) {
    await page.keyboard.press(key);
    await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-keyboard-mode="navigation"]')).toContainText('Navigation mode');
  }
  const afterPan = await savedMapUi(page);
  expect(afterPan.activeWorkspaceTab).toBe('map');
  expect(afterPan.mode).toBe('navigation');
  expect(afterPan.commandMenuOpen).toBe(false);
  expect(afterPan.cursor).toEqual(beforePan.cursor);

  const beforeWheelZoom = await mapSnapshot(page);
  const gridBox = await page.locator('[data-map-viewport="true"]').boundingBox();
  if (!gridBox) {
    throw new Error('Map viewport did not have a bounding box.');
  }
  await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2);
  await page.mouse.wheel(0, -400);
  const afterWheelZoom = await mapSnapshot(page);
  expect(afterWheelZoom.zoom.index).toBeGreaterThan(beforeWheelZoom.zoom.index);
  expect(afterWheelZoom.zoom.tilePx).toBeGreaterThan(beforeWheelZoom.zoom.tilePx);
  expect(afterWheelZoom.cells.length).toBeLessThan(beforeWheelZoom.cells.length);

  await page.keyboard.press('Minus');
  const afterKeyboardZoomOut = await mapSnapshot(page);
  expect(afterKeyboardZoomOut.zoom.index).toBe(beforeWheelZoom.zoom.index);
  await expect(page.locator('[data-map-viewport="true"]')).toHaveAttribute('data-map-viewport-width', String(afterKeyboardZoomOut.viewport.width));

  const afterNavigation = await savedMapUi(page);
  expect(afterNavigation.selection).toEqual(beforePan.selection);
  expect(afterNavigation.selectedMapTarget).toEqual(beforePan.selectedMapTarget);
});

test('map smoke keeps representative contextual actions selectable after navigation', async ({ page }) => {
  await startRun(page);
  await seedRoomCorpse(page);

  await page.keyboard.press('D');
  await page.keyboard.press('S');
  await page.keyboard.press('Equal');
  await page.keyboard.press('Minus');

  const tubeTile = page.locator('[data-map-target-kind="container"][data-map-target-id="synthesisTube"]').first();
  await expect(tubeTile).toBeVisible();
  await tubeTile.click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'container');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-id', 'synthesisTube');
  let panel = await openSelectionActions(page);
  await expect(panel).toContainText('Synthesis');
  await expect(panel.getByRole('button', { name: 'Open Foundry' })).toBeEnabled();
  await expect(panel.getByRole('button', { name: 'Synthesize Slime' })).toBeEnabled();
  await expect(panel.getByRole('button', { name: 'Open Known Outcome Editor' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.locator('[data-selection-inspector="true"]').getByRole('button', { name: 'Close' }).click();

  const doorTile = page.locator('[data-map-door="door-storage-main"]').first();
  await expect(doorTile).toBeVisible();
  await doorTile.click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'door');
  panel = await openSelectionActions(page);
  await expect(panel).toContainText('Door');
  await expect(panel.getByRole('button', { name: /Door$/ }).first()).toBeEnabled();
  await expect(panel.getByRole('button', { name: 'Door Policies' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.locator('[data-selection-inspector="true"]').getByRole('button', { name: 'Close' }).click();

  const containerTile = page.locator('[data-map-target-kind="container"][data-map-target-id="basic-1"]').first();
  await expect(containerTile).toBeVisible();
  await containerTile.click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'container');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-id', 'basic-1');
  panel = await openSelectionActions(page);
  await expect(panel).toContainText('Container');
  await expect(panel.getByRole('button', { name: 'Open Container', exact: true })).toBeEnabled();
  await expect(panel.getByRole('button', { name: 'Stage in Collection Bay' })).toBeEnabled();
  await expect(panel.getByRole('button', { name: 'Haul to Main Lab' })).toHaveAttribute('data-context-command-disabled', 'true');
  await expect(panel).toContainText('Basic Glass Jar 1 is already in the Main Lab.');
  await page.keyboard.press('Escape');
  await page.locator('[data-selection-inspector="true"]').getByRole('button', { name: 'Close' }).click();

  const corpseTile = page.locator('[data-map-target-kind="corpse"][data-map-target-id="corpse-smoke-map"]').first();
  await expect(corpseTile).toBeVisible();
  await corpseTile.click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'corpse');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-id', 'corpse-smoke-map');
  panel = await openSelectionActions(page);
  await expect(panel).toContainText('Corpse');
  await expect(panel.getByRole('button', { name: 'Necropsy' })).toBeEnabled();
  await expect(panel.getByRole('button', { name: 'Dump Outside' })).toBeEnabled();

  const selected = await savedMapUi(page);
  expect(selected.selection).toMatchObject({ kind: 'corpse', id: 'corpse-smoke-map' });
  expect(selected.selectedMapTarget).toMatchObject({ kind: 'corpse', id: 'corpse-smoke-map' });
});
