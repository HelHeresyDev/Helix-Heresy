// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Vertical = require('../vertical-systems.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('custom ramps retain compact grades and load-aware traversal rules', () => {
  const one = Vertical.normalizeRamp({ lowerCell: { x: 4, y: 4, z: 0 }, direction: 'east', length: 1, width: 1 });
  const four = Vertical.normalizeRamp({ lowerCell: { x: 4, y: 4, z: 0 }, direction: 'north', length: 4, width: 2 });
  const eight = Vertical.normalizeRamp({ lowerCell: { x: 4, y: 4, z: 0 }, direction: 'south', length: 8, width: 3 });

  expect(one.grade).toBe('Steep');
  expect(four.angleDegrees).toBeCloseTo(45, 5);
  expect(four.footprintCells).toHaveLength(8);
  expect(four.upperCell).toEqual({ x: 4, y: 0, z: 1 });
  expect(eight.angleDegrees).toBeLessThan(four.angleDegrees);
  expect(Vertical.rampTraversalBlockReason(one, { width: 1, height: 1 }, { lengthM: 3, massKg: 300 })).toContain('bulky');
  expect(Vertical.rampTraversalBlockReason(four, { width: 1, height: 1 }, { widthM: 2, lengthM: 3, massKg: 300 })).toBe('');
});

test('a custom carved ramp creates a rendered route and exchanges atmosphere', async ({ page }) => {
  await startRun(page);
  const placement = await page.evaluate(() => {
    const cells = window.helixHeresyDebug.verticalMapSnapshot().excavated.filter((cell) => cell.z === 0);
    for (const cell of cells) {
      for (const direction of ['north', 'east', 'south', 'west']) {
        const result = window.helixHeresyDebug.rampPlacementSnapshot(cell, { length: 4, width: 1, direction });
        if (!result.reason) return result.ramp;
      }
    }
    return null;
  });
  expect(placement).toBeTruthy();

  const designated = await page.evaluate((ramp) => window.helixHeresyDebug.designateRamp(ramp.lowerCell, {
    length: ramp.length,
    width: ramp.width,
    direction: ramp.direction
  }), placement);
  expect(designated).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(7200));

  const result = await page.evaluate((expected) => {
    const vertical = window.helixHeresyDebug.verticalMapSnapshot();
    const ramp = vertical.connectors.find((entry) => entry.type === 'ramp');
    return {
      ramp,
      route: ramp ? window.helixHeresyDebug.navigationPlan(ramp.lowerCell, ramp.upperCell) : null,
      lineOfEffect: ramp ? window.helixHeresyDebug.directedLineOfEffect(ramp.lowerCell, ramp.upperCell) : false,
      lineOfSight: ramp ? window.helixHeresyDebug.sensoryLineOfSight(ramp.lowerCell, ramp.upperCell) : false,
      expected
    };
  }, placement);
  expect(result.ramp).toMatchObject({ type: 'ramp', length: 4, width: 1, grade: 'Gradual' });
  expect(result.ramp.footprintCells).toHaveLength(4);
  expect(result.route.found).toBe(true);
  expect(result.route.steps.at(-1).action).toBe('ramp');
  expect(result.lineOfEffect).toBe(true);
  expect(result.lineOfSight).toBe(true);

  await page.evaluate((ramp) => window.helixHeresyDebug.setMapLayer(ramp.lowerCell.z), result.ramp);
  await expect(page.locator(`[data-map-ramp="${result.ramp.id}"]`).first()).toBeVisible();
});

test('shared slabs fail after losing every support and collapse into rubble', async ({ page }) => {
  await startRun(page);
  const center = { x: 75, y: 75, z: 1 };
  const lower = { x: 75, y: 75, z: 0 };
  const open = [];
  for (let y = 74; y <= 76; y += 1) {
    for (let x = 74; x <= 76; x += 1) {
      open.push({ x, y, z: 1 }, { x, y, z: 0 });
    }
  }
  await page.evaluate(({ open, center }) => {
    window.helixHeresyDebug.setExcavatedCells(open);
    window.helixHeresyDebug.setConstructedFloor(center, { materialId: 'stoneBlocks' });
  }, { open, center });

  const before = await page.evaluate((center) => ({
    boundary: window.helixHeresyDebug.horizontalBoundarySnapshot(center),
    failures: window.helixHeresyDebug.evaluateStructuralSupport()
  }), center);
  expect(before.boundary).toMatchObject({ type: 'constructedSlab', movement: false, attackTransmission: false });
  expect(before.failures).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'constructedFloor', cell: center, status: 'strained' })]));

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(121));
  const after = await page.evaluate(({ center, lower }) => ({
    boundary: window.helixHeresyDebug.horizontalBoundarySnapshot(center),
    vertical: window.helixHeresyDebug.verticalMapSnapshot(),
    lower,
    structural: window.helixHeresyDebug.structuralSnapshot(center)
  }), { center, lower });
  expect(after.boundary.type).toBe('openShaft');
  expect(after.structural).toBeNull();
  expect(after.vertical.failures).not.toEqual(expect.arrayContaining([expect.objectContaining({ cell: center })]));
});

test('a breached slab transmits attacks but still blocks movement', async ({ page }) => {
  await startRun(page);
  const upper = { x: 72, y: 72, z: 1 };
  const lower = { x: 72, y: 72, z: 0 };
  await page.evaluate(({ upper, lower }) => {
    window.helixHeresyDebug.setExcavatedCells([upper, lower]);
    window.helixHeresyDebug.setConstructedFloor(upper, { materialId: 'stoneBlocks', condition: 20 });
  }, { upper, lower });

  const result = await page.evaluate(({ upper, lower }) => ({
    boundary: window.helixHeresyDebug.horizontalBoundarySnapshot(upper),
    lineOfEffect: window.helixHeresyDebug.directedLineOfEffect(lower, upper),
    lineOfSight: window.helixHeresyDebug.sensoryLineOfSight(lower, upper),
    route: window.helixHeresyDebug.navigationPlan(lower, upper)
  }), { upper, lower });
  expect(result.boundary).toMatchObject({ type: 'constructedSlab', open: false, movement: false, attackTransmission: true });
  expect(result.lineOfEffect).toBe(true);
  expect(result.lineOfSight).toBe(false);
  expect(result.route.found).toBe(false);
});

test('unexcavated space above a carved tile remains a natural rock boundary', async ({ page }) => {
  await startRun(page);
  const lower = await page.evaluate(() => window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist').cell);
  const upper = { ...lower, z: lower.z + 1 };
  const boundary = await page.evaluate((cell) => window.helixHeresyDebug.horizontalBoundarySnapshot(cell), upper);
  expect(boundary).toMatchObject({ type: 'naturalRock', open: false, movement: false, attackTransmission: false });
});

test('an anchored fixture collapses after its floor support is removed', async ({ page }) => {
  await startRun(page);
  const fixture = await page.evaluate(() => window.helixHeresyDebug.fixtureSnapshot().fixtures.find((entry) => entry.definition?.layer === 'floor' && entry.typeId !== 'concealedExit'));
  expect(fixture).toBeTruthy();
  const center = { x: 82, y: 82, z: 0 };
  const open = [];
  for (let y = 79; y <= 85; y += 1) {
    for (let x = 79; x <= 85; x += 1) {
      open.push({ x, y, z: 0 }, { x, y, z: -1 });
    }
  }
  expect(await page.evaluate(({ open, fixtureId, center }) => {
    window.helixHeresyDebug.setExcavatedCells(open);
    return window.helixHeresyDebug.setFixtureOrigin(fixtureId, center);
  }, { open, fixtureId: fixture.id, center })).toBe(true);

  const before = await page.evaluate((fixtureId) => window.helixHeresyDebug.verticalMapSnapshot().failures.find((failure) => failure.targetId === fixtureId), fixture.id);
  expect(before).toMatchObject({ kind: 'fixture', status: 'strained' });
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(121));
  const after = await page.evaluate((fixtureId) => ({
    fixture: window.helixHeresyDebug.fixtureSnapshot().fixtures.find((entry) => entry.id === fixtureId),
    failure: window.helixHeresyDebug.verticalMapSnapshot().failures.find((entry) => entry.targetId === fixtureId)
  }), fixture.id);
  expect(after.fixture).toBeUndefined();
  expect(after.failure).toBeUndefined();
});

test('new spills fall vertically through an existing open shaft', async ({ page }) => {
  await startRun(page);
  const scientist = await page.evaluate(() => window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist').cell);
  const upper = { ...scientist };
  const lower = { ...upper, z: upper.z - 1 };
  expect(await page.evaluate((upper) => window.helixHeresyDebug.designateVerticalExcavation('channelDown', upper), upper)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3600));
  const spill = await page.evaluate((upper) => window.helixHeresyDebug.addPhysicalSpill(upper, 2, 'vertical-sludge'), upper);
  expect(spill.cell).toEqual(upper);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(10));
  const moved = await page.evaluate((id) => window.helixHeresyDebug.physicalStockSnapshot().stacks.find((stack) => stack.id === id), spill.id);
  expect(moved.cell).toEqual(lower);
  expect(moved.sourceLabels.join(' ')).toContain('fell 4 m');
});

test('a ceiling order closes the shared boundary using elevated work equipment', async ({ page }) => {
  await startRun(page);
  const stairUpper = await page.evaluate(() => window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist').cell);
  expect(await page.evaluate((cell) => window.helixHeresyDebug.designateVerticalExcavation('stairDown', cell), stairUpper)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3600));
  const upper = await page.evaluate((cell) => {
    const candidates = [
      { x: cell.x + 1, y: cell.y, z: cell.z },
      { x: cell.x - 1, y: cell.y, z: cell.z },
      { x: cell.x, y: cell.y + 1, z: cell.z },
      { x: cell.x, y: cell.y - 1, z: cell.z }
    ];
    return candidates.find((candidate) => window.helixHeresyDebug.designateVerticalExcavation('channelDown', candidate)) || null;
  }, stairUpper);
  expect(upper).toBeTruthy();
  const lower = { ...upper, z: upper.z - 1 };
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3600));
  expect(await page.evaluate((cell) => window.helixHeresyDebug.designateConstruction('build', [cell], { buildType: 'stoneCeiling' }), lower)).toBe(true);
  const footprint = await page.evaluate(() => {
    const orders = window.helixHeresyDebug.constructionSnapshot().orders;
    return window.helixHeresyDebug.constructionFootprintSnapshot(orders.at(-1).id);
  });
  expect(footprint).toEqual(expect.arrayContaining([lower, upper]));
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3600));

  const result = await page.evaluate((upper) => ({
    boundary: window.helixHeresyDebug.horizontalBoundarySnapshot(upper),
    tools: window.helixHeresyDebug.constructionToolSnapshot(),
    orders: window.helixHeresyDebug.constructionSnapshot().orders
  }), upper);
  expect(result.tools).toEqual(expect.arrayContaining([expect.objectContaining({ itemKey: 'foldingLadder' })]));
  expect(result.orders).toEqual(expect.arrayContaining([
    expect.objectContaining({ mode: 'build', buildType: 'stoneCeiling', tiles: [expect.objectContaining({ status: 'completed' })] })
  ]));
  expect(result.boundary).toMatchObject({ type: 'constructedSlab', open: false, movement: false });
});
