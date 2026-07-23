// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Spatial = require('../creature-spatial.js');
const Navigation = require('../navigation.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('shape-derived masks distinguish rounded, solid, and branching bodies', () => {
  const dimensions = { lengthCm: 460, widthCm: 460, heightCm: 460 };
  const spherical = Spatial.footprintFromDimensions(dimensions, { shape: 'spherical', tileSizeM: 1, layerHeightM: 4 });
  const cubic = Spatial.footprintFromDimensions(dimensions, { shape: 'cubic', tileSizeM: 1, layerHeightM: 4 });
  const branching = Spatial.footprintFromDimensions(dimensions, { shape: 'branching', tileSizeM: 1, layerHeightM: 4 });

  expect(spherical).toMatchObject({ width: 5, height: 5, heightLayers: 2 });
  expect(spherical.mask).toHaveLength(21);
  expect(cubic.mask).toHaveLength(25);
  expect(branching.mask).toHaveLength(17);
});

test('sparse body masks rotate without filling their empty corners', () => {
  const footprint = Navigation.normalizeFootprint({
    width: 3,
    height: 2,
    mask: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
    orientation: 'horizontal',
  });
  const horizontal = Navigation.footprintCells({ x: 5, y: 5, z: 0 }, footprint, 'horizontal');
  const vertical = Navigation.footprintCells({ x: 5, y: 5, z: 0 }, footprint, 'vertical');

  expect(horizontal).toHaveLength(4);
  expect(vertical).toHaveLength(4);
  expect(vertical).toEqual(expect.arrayContaining([
    { x: 6, y: 5, z: 0 },
    { x: 6, y: 7, z: 0 },
    { x: 5, y: 6, z: 0 },
  ]));
  expect(vertical).not.toContainEqual({ x: 5, y: 5, z: 0 });
});

test('large loose creatures and their corpses retain complete selectable footprints', async ({ page }) => {
  await startRun(page);
  const created = await page.evaluate(() => {
    const scientist = window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist');
    return window.helixHeresyDebug.createSpatialTestSlime({
      size: 'room-filling',
      shape: 'spherical',
      roomId: 'mainLab',
      cell: scientist.cell,
      massPercent: 100,
    });
  });
  expect(created.footprint.mask.length).toBeGreaterThan(1);

  const livingSnapshot = await page.evaluate((id) => window.helixHeresyDebug.creatureFootprintSnapshot(id), created.id);
  const livingTiles = page.locator(`[data-map-object-selection-keys~="slime:${created.id}"]`);
  await expect(livingTiles).toHaveCount(livingSnapshot.floorCells.length);
  await livingTiles.first().click();
  const selectedLivingCount = await livingTiles.evaluateAll((tiles) => tiles.filter((tile) => tile.classList.contains('selected-map-cell')).length);
  expect(selectedLivingCount).toBe(livingSnapshot.floorCells.length);

  const corpse = await page.evaluate((id) => window.helixHeresyDebug.killSlimeForSpatialTest(id), created.id);
  expect(corpse).not.toBeNull();
  const corpseSnapshot = await page.evaluate((id) => window.helixHeresyDebug.corpseFootprintSnapshot(id), corpse.id);
  expect(corpseSnapshot.floorCells).toHaveLength(livingSnapshot.floorCells.length);
  const corpseTiles = page.locator(`[data-map-object-selection-keys~="corpse:${corpse.id}"]`);
  await expect(corpseTiles).toHaveCount(corpseSnapshot.floorCells.length);
});

test('growth stops at available space and records compression instead of clipping', async ({ page }) => {
  await startRun(page);
  const setup = await page.evaluate(() => {
    const scientist = window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist');
    const created = window.helixHeresyDebug.createSpatialTestSlime({
      size: 'wardrobe-sized',
      shape: 'spherical',
      roomId: 'mainLab',
      cell: scientist.cell,
      massPercent: 20,
    });
    const constrainedCell = window.helixHeresyDebug.findSpatialGrowthConstraintCell(created.id, 100);
    const relocated = constrainedCell && window.helixHeresyDebug.relocateLooseSlime(created.id, constrainedCell);
    return { created, constrainedCell, relocated };
  });
  expect(setup.constrainedCell).not.toBeNull();
  expect(setup.relocated).toBe(true);

  const result = await page.evaluate((id) => window.helixHeresyDebug.advanceSlimeRegrowthForSpatialTest(id, 24 * 60 * 60), setup.created.id);
  expect(result.mass).toBeLessThan(100);
  expect(result.pressure.active).toBe(true);
  expect(result.pressure.desiredFootprint.mask.length).toBeGreaterThan(result.footprint.mask.length);
  expect(result.stress).toBeGreaterThan(0);
});

test('unobserved creatures project their last-known footprint without leaking current size', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const created = window.helixHeresyDebug.createSpatialTestSlime({
      size: 'wardrobe-sized',
      shape: 'spherical',
      roomId: 'menagerie',
      massPercent: 20,
    });
    window.helixHeresyDebug.setSlimeMassForSpatialTest(created.id, 100, 100);
    window.helixHeresyDebug.selectSlimeForSpatialTest(created.id);
    return window.helixHeresyDebug.slimeSpatialKnowledgeSnapshot(created.id);
  });

  expect(result.actualFootprint.mask.length).toBeGreaterThan(result.record.lastKnownFootprint.mask.length);
  expect(result.projectedCells).toHaveLength(result.record.lastKnownFootprint.mask.length);
  expect(result.selectionCell).toEqual(result.record.lastKnownMapCell);
  expect(result.selectionRoomId).toBe(result.record.lastKnownRoomId);
});
