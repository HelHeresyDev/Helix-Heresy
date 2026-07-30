// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Terrain = require('../terrain-connectivity.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('cardinal masks classify structural joins without diagonal leakage', () => {
  expect(Terrain.describeEdgeRelations({ north: 'joined', east: 'joined' })).toMatchObject({
    cardinalMask: 3,
    shape: 'corner',
    rotationQuarterTurns: 0,
  });
  expect(Terrain.classifyCardinalMask(6)).toEqual({ shape: 'corner', rotationQuarterTurns: 1 });
  expect(Terrain.classifyCardinalMask(5)).toEqual({ shape: 'straight', rotationQuarterTurns: 0 });
  expect(Terrain.classifyCardinalMask(7)).toEqual({ shape: 'tee', rotationQuarterTurns: 0 });
  expect(Terrain.classifyCardinalMask(15)).toEqual({ shape: 'cross', rotationQuarterTurns: 0 });

  const diagonalOnly = Terrain.describeEdgeRelations({}, { northEast: 'joined', southWest: 'joined' });
  expect(diagonalOnly.cardinalMask).toBe(0);
  expect(diagonalOnly.diagonalMask).toBe(5);
});

test('edge relations retain seams, portals, unknown caps, and map boundaries', () => {
  const edges = Terrain.describeEdgeRelations({
    north: 'joined',
    east: 'abutment',
    south: 'portal',
    west: 'unknown',
  });
  expect(edges).toMatchObject({
    joinedMask: 1,
    abutmentMask: 2,
    portalMask: 4,
    unknownMask: 8,
    contactMask: 7,
  });

  expect(Terrain.describeEdgeRelations({ west: 'boundary' }).boundaryMask).toBe(8);
});

test('variation, door framing, and ramp segments are deterministic', () => {
  expect(Terrain.variationIndex(['seed', 10, 20, 0, 'floor'], 8))
    .toBe(Terrain.variationIndex(['seed', 10, 20, 0, 'floor'], 8));
  expect(Terrain.inferFrameAxis({ supportMask: 10, passageMask: 5 })).toBe('eastWest');
  expect(Terrain.passageAxisForFrame('eastWest')).toBe('northSouth');

  const ramp = {
    direction: 'east',
    length: 3,
    width: 1,
    footprintCells: [
      { x: 1, y: 1, z: 0 },
      { x: 2, y: 1, z: 0 },
      { x: 3, y: 1, z: 0 },
    ],
    upperCells: [{ x: 4, y: 1, z: 1 }],
  };
  expect(Terrain.rampSegment(ramp, ramp.footprintCells[0])).toMatchObject({ kind: 'entry', alongIndex: 0 });
  expect(Terrain.rampSegment(ramp, ramp.footprintCells[1])).toMatchObject({ kind: 'middle', alongIndex: 1 });
  expect(Terrain.rampSegment(ramp, ramp.footprintCells[2])).toMatchObject({ kind: 'exit', alongIndex: 2 });
  expect(Terrain.rampSegment(ramp, ramp.upperCells[0])).toMatchObject({ kind: 'upperLanding', alongIndex: 3 });
});

test('semantic map cells expose renderer-neutral physical connectivity', async ({ page }) => {
  await startRun(page);

  const snapshot = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const floor = view.cells.find((cell) => cell.terrainConnectivity?.floor);
    const rock = view.cells.find((cell) => cell.terrainConnectivity?.solid);
    const door = view.cells.find((cell) => cell.door?.connectivity);
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const savedDoor = door ? (payload.state || payload).labMap.doors[door.door.key] : null;
    return {
      floor: floor?.terrainConnectivity,
      rock: rock?.terrainConnectivity,
      door: door?.door,
      savedDoor,
    };
  });

  expect(snapshot.floor?.floor).toMatchObject({
    kind: 'floor',
    connectivity: {
      cardinalMask: expect.any(Number),
      diagonalMask: expect.any(Number),
      shape: expect.any(String),
    },
    variation: expect.any(Number),
  });
  expect(snapshot.floor?.boundaries.room).toMatchObject({
    cardinalMask: expect.any(Number),
    boundaryMask: expect.any(Number),
  });
  expect(snapshot.rock?.solid).toMatchObject({
    kind: 'naturalRock',
    connectivity: {
      exposedMask: expect.any(Number),
      unknownMask: expect.any(Number),
    },
  });
  expect(snapshot.door).toMatchObject({
    frameAxis: expect.stringMatching(/^(eastWest|northSouth)$/),
    passageAxis: expect.stringMatching(/^(eastWest|northSouth)$/),
    connectivity: {
      supportMask: expect.any(Number),
      frameSupportMask: expect.any(Number),
    },
  });
  expect(snapshot.savedDoor).toMatchObject({
    frameAxis: snapshot.door.frameAxis,
    passageAxis: snapshot.door.passageAxis,
  });
});

test('knowledge boundaries cap terrain connectivity without revealing hidden neighbors', async ({ page }) => {
  await startRun(page);
  await page.locator('#debugToggleBtn').click();
  await expect(page.locator('#debugToggleBtn')).toHaveAttribute('aria-pressed', 'false');

  const result = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const capped = view.cells.find((cell) =>
      cell.known && cell.terrainConnectivity?.solid?.connectivity?.unknownMask > 0);
    const hidden = view.cells.find((cell) => !cell.known);
    return {
      capped: capped?.terrainConnectivity?.solid?.connectivity,
      hidden: hidden?.terrainConnectivity,
    };
  });

  expect(result.capped).toMatchObject({
    unknownMask: expect.any(Number),
  });
  expect(result.capped.unknownMask).toBeGreaterThan(0);
  expect(result.hidden).toEqual({ version: 1, known: false });
});

test('stacked stairs describe both vertical directions on the shared tile', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const center = window.helixHeresyDebug.navigationSnapshot().actors
      .find((actor) => actor.id === 'scientist').cell;
    const lower = { ...center, z: center.z - 1 };
    const upper = { ...center, z: center.z + 1 };
    window.helixHeresyDebug.setExcavatedCells([lower, center, upper]);
    window.helixHeresyDebug.setVerticalConnectorsForTest([
      { id: 'stacked-lower', type: 'carvedStairs', lowerCell: lower, upperCell: center },
      { id: 'stacked-upper', type: 'carvedStairs', lowerCell: center, upperCell: upper },
    ]);
    return window.helixHeresyDebug.terrainConnectivitySnapshot(center, { fullReveal: true });
  });

  expect(result.vertical?.stairs).toMatchObject({
    up: true,
    down: true,
    direction: 'both',
    connectorIds: expect.arrayContaining(['stacked-lower', 'stacked-upper']),
  });
});
