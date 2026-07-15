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

test('starter skills and sensory capabilities use the shared taxonomy', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      skillIds: Object.keys(state.scientist.skills),
      scientist: window.helixHeresyDebug.sensorySnapshot('scientist'),
    };
  }, { key: storageKey });

  expect(result.skillIds).toEqual(expect.arrayContaining(['analysis', 'perception', 'animancy', 'arcaneSenses']));
  expect(result.scientist.sensory.capabilities).toMatchObject({
    vision: true,
    hearing: true,
    chemical: true,
    magic: true,
  });
});

test('chemical traces are physical, diffuse, decay, and create bounded memory', async ({ page }) => {
  await startRun(page);
  const cells = await page.evaluate(() => {
    const records = window.helixHeresyDebug.tileEnvironmentSnapshot();
    const keys = new Set(records.map((record) => `${record.cell.x},${record.cell.y}`));
    const left = records.find((record) => keys.has(`${record.cell.x + 1},${record.cell.y}`));
    return [left.cell, { x: left.cell.x + 1, y: left.cell.y }];
  });

  const result = await page.evaluate(({ left, right }) => {
    window.helixHeresyDebug.setTileEnvironment(left, { chemicalTraces: { carrion: 30 } });
    window.helixHeresyDebug.advanceSimulation(300);
    const diffused = window.helixHeresyDebug.tileEnvironmentSnapshot(right)[0].chemicalTraces.carrion || 0;
    window.helixHeresyDebug.setTileEnvironment(left, { chemicalTraces: {} });
    window.helixHeresyDebug.setTileEnvironment(right, { chemicalTraces: {} });
    window.helixHeresyDebug.advanceSimulation(3601);
    const sensory = window.helixHeresyDebug.sensorySnapshot('scientist').sensory;
    return { diffused, sensory };
  }, { left: cells[0], right: cells[1] });

  expect(result.diffused).toBeGreaterThan(0);
  expect(result.sensory.memories.some((entry) => entry.key === 'chemical:carrion')).toBe(false);
  expect(result.sensory.log.length).toBeLessThanOrEqual(100);
});

test('blind slime follows a local chemical gradient without gaining sight or hearing', async ({ page }) => {
  await startRun(page);
  const fixture = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const empty = view.cells.filter((cell) => ['room', 'floor'].includes(cell.base.kind) && !cell.object && !cell.door && !cell.scientist);
    const emptyKeys = new Set(empty.map((cell) => `${cell.cell.x},${cell.cell.y}`));
    const left = empty.find((entry) => [
      `${entry.cell.x + 1},${entry.cell.y}`,
      `${entry.cell.x - 1},${entry.cell.y}`,
      `${entry.cell.x},${entry.cell.y + 1}`,
      `${entry.cell.x},${entry.cell.y - 1}`,
    ].some((key) => emptyKeys.has(key)));
    const right = [
      { x: left.cell.x + 1, y: left.cell.y },
      { x: left.cell.x - 1, y: left.cell.y },
      { x: left.cell.x, y: left.cell.y + 1 },
      { x: left.cell.x, y: left.cell.y - 1 },
    ].find((cell) => emptyKeys.has(`${cell.x},${cell.y}`));
    const scientistDestination = empty
      .sort((a, b) => (Math.abs(b.cell.x - left.cell.x) + Math.abs(b.cell.y - left.cell.y)) - (Math.abs(a.cell.x - left.cell.x) + Math.abs(a.cell.y - left.cell.y)))[0];
    state.scientist.mapCell = scientistDestination.cell;
    state.scientist.roomId = scientistDestination.roomId || state.scientist.roomId;
    const roomId = left.roomId || state.scientist.roomId;
    state.slimes = [{
      id: 'gradient-slime',
      name: 'GRADIENT-SLIME',
      genome: state.currentGenome,
      source: 'Perception fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      splitBlocked: true,
      status: 'released',
      containerId: null,
      roomId,
      mapCell: left.cell,
      job: 'idle',
      jobProgress: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 10, max: 100 },
        currentMass: { current: 80, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
      skills: {},
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      nextAutonomousDecisionAt: 0,
      nextPerceptionPracticeAt: 999999,
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
    return { left: left.cell, right };
  }, { key: storageKey });
  await loadSavedRun(page);

  const result = await page.evaluate(({ left, right }) => {
    window.helixHeresyDebug.setTileEnvironment(left, { chemicalTraces: { organic: 1 } });
    window.helixHeresyDebug.setTileEnvironment(right, { chemicalTraces: { organic: 35 } });
    window.helixHeresyDebug.advanceSimulation(1);
    const first = window.helixHeresyDebug.sensorySnapshot('gradient-slime');
    const firstPayload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const firstSlime = (firstPayload.state || firstPayload).slimes.find((entry) => entry.id === 'gradient-slime');
    window.helixHeresyDebug.advanceSimulation(10);
    const second = window.helixHeresyDebug.sensorySnapshot('gradient-slime');
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const slime = (payload.state || payload).slimes.find((entry) => entry.id === 'gradient-slime');
    return { first, firstSlime, second, slime };
  }, fixture);

  expect(result.first.sensory.capabilities).toMatchObject({ vision: false, hearing: false, chemical: true, taste: true, magic: true });
  const expectedDirection = fixture.right.x > fixture.left.x ? 'east'
    : fixture.right.x < fixture.left.x ? 'west'
      : fixture.right.y > fixture.left.y ? 'south' : 'north';
  expect(result.first.sensory.current.some((entry) => entry.key === 'chemical:organic' && entry.direction === expectedDirection), JSON.stringify(result.first.sensory.current)).toBe(true);
  expect(result.firstSlime.autonomousMovement?.targetCell || result.firstSlime.mapCell, JSON.stringify(result.firstSlime)).toEqual(fixture.right);
  expect(result.second.sensory.routeMemory.cells.length).toBeGreaterThan(0);
});
