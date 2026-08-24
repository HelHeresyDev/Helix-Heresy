// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('Chemistry Front has separated public, freight, restricted, hazardous, and covert access', async ({ page }) => {
  await startRun(page);

  const access = await page.evaluate(() => window.helixHeresyDebug.siteAccessSnapshot());
  expect(access.rooms.map((room) => [room.id, room.facilityClass])).toEqual(expect.arrayContaining([
    ['surfaceReception', 'public'],
    ['surfaceStaffOperations', 'staff'],
    ['surfaceFacility', 'staff'],
    ['surfaceHazardousStorage', 'hazardous'],
    ['surfaceLoadingBay', 'loading'],
    ['surfaceBasementVestibule', 'restricted'],
  ]));
  expect(access.points).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'publicEntrance', kind: 'public', lawful: true, doorId: 'door-surface-front' }),
    expect.objectContaining({ id: 'loadingBay', kind: 'freight', lawful: true, doorId: 'door-surface-loading' }),
    expect.objectContaining({ id: 'concealedExit', kind: 'covert', lawful: false, fixtureId: 'concealed-exit' }),
  ]));

  const front = access.doors.find((door) => door.id === 'door-surface-front');
  const loading = access.doors.find((door) => door.id === 'door-surface-loading');
  const basement = access.doors.find((door) => door.id === 'door-surface-basement-staff');
  const hazard = access.doors.find((door) => door.id === 'door-surface-hazard-loading');
  expect(front).toMatchObject({ accessPointId: 'publicEntrance', clearance: { widthM: 1, heightM: 2.1 }, state: { state: 'closed', lockState: 'unlocked', accessRuleId: 'unrestricted' } });
  expect(loading).toMatchObject({ accessPointId: 'loadingBay', clearance: { widthM: 3, heightM: 3.2 }, state: { typeId: 'freightDoor', state: 'closed', lockState: 'locked', accessRuleId: 'exterior' } });
  expect(loading.cells).toHaveLength(3);
  expect(new Set(loading.cells.map((cell) => cell.y)).size).toBe(3);
  expect(basement).toMatchObject({ state: { accessRuleId: 'restricted', lockdownAction: 'lock' } });
  expect(hazard).toMatchObject({ state: { accessRuleId: 'containment', lockdownAction: 'lock' } });
  expect(access.points.find((point) => point.id === 'concealedExit').cell).not.toEqual(front.cell);
  expect(access.points.find((point) => point.id === 'concealedExit').cell).not.toEqual(loading.cell);
  expect(await page.evaluate(() => window.helixHeresyDebug.verticalMapSnapshot().excavated.some((cell) => cell.z > 0))).toBe(false);
});

test('payload clearance rejects freight at the public door and stairs but accepts the loading portal', async ({ page }) => {
  await startRun(page);

  const result = await page.evaluate(() => {
    const wideLoad = { widthM: 2.2, lengthM: 1.5, heightM: 2.4, massKg: 120, label: 'palletized load' };
    const handLoad = { widthM: 0.6, lengthM: 0.5, heightM: 0.7, massKg: 20, label: 'hand load' };
    const surface = window.helixHeresyDebug.surfaceMapSnapshot();
    const frontPath = [{ x: 47, y: 53, z: 1 }, { x: 47, y: 52, z: 1 }, { x: 47, y: 51, z: 1 }];
    const loadingPath = [{ x: 60, y: 49, z: 1 }, { x: 59, y: 49, z: 1 }, { x: 58, y: 49, z: 1 }];
    return {
      frontReason: window.helixHeresyDebug.payloadPathBlockReason(frontPath, wideLoad),
      loadingReason: window.helixHeresyDebug.payloadPathBlockReason(loadingPath, wideLoad),
      bulkyStair: window.helixHeresyDebug.payloadClearanceSnapshot(surface.basementStair.lowerCell, surface.basementStair.upperCell, wideLoad),
      handStair: window.helixHeresyDebug.payloadClearanceSnapshot(surface.basementStair.lowerCell, surface.basementStair.upperCell, handLoad),
      bulkyContainer: window.helixHeresyDebug.containerHaulClearanceSnapshot('basic-4', 'surfaceLoadingBay'),
    };
  });

  expect(result.frontReason).toContain('1.0 m width clearance');
  expect(result.loadingReason).toBe('');
  expect(result.bulkyStair.found).toBe(false);
  expect(result.bulkyStair.verticalReason).toContain('cannot fit through the carved stair');
  expect(result.handStair).toMatchObject({ found: true, verticalReason: '' });
  expect(result.bulkyContainer.carriedLoad.volumeL).toBeGreaterThan(200);
  expect(result.bulkyContainer.plan.ok).toBe(false);
  expect(result.bulkyContainer.blockReason).toContain('No physical hauling route');
});

test('exact cross-layer transfers make repeated physical trips and deliver the requested quantity', async ({ page }) => {
  await startRun(page);

  const before = await page.evaluate(() => window.helixHeresyDebug.exactTransferSnapshot());
  expect(before.rooms.storageRoom.resources.biomass).toBe(50);
  expect(before.rooms.surfaceLoadingBay.resources.biomass || 0).toBe(0);

  const queued = await page.evaluate(() => window.helixHeresyDebug.queueExactResourceTransfer('biomass', 30, 'storageRoom', 'surfaceLoadingBay'));
  expect(queued.ok).toBe(true);
  expect(queued.task.data.haulLegs).toHaveLength(2);
  expect(queued.task.data.mapPath.some((cell) => cell.z === 0)).toBe(true);
  expect(queued.task.data.mapPath.some((cell) => cell.z === 1)).toBe(true);

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(600));
  const after = await page.evaluate(() => window.helixHeresyDebug.exactTransferSnapshot());
  expect(after.tasks).toHaveLength(0);
  expect(after.carried).toHaveLength(0);
  expect(after.rooms.storageRoom.resources.biomass).toBe(20);
  expect(after.rooms.surfaceLoadingBay.resources.biomass).toBe(30);
});

test('blocked exact transfers survive reload and cancellation drops the current physical load', async ({ page }) => {
  await startRun(page);
  const queued = await page.evaluate(() => window.helixHeresyDebug.queueExactResourceTransfer('biomass', 30, 'storageRoom', 'surfaceLoadingBay'));
  expect(queued.ok).toBe(true);

  let inTransit;
  for (let elapsed = 0; elapsed < 60; elapsed += 5) {
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(5));
    inTransit = await page.evaluate(() => window.helixHeresyDebug.exactTransferSnapshot());
    if (inTransit.carried.length) break;
  }
  expect(inTransit.carried).toHaveLength(1);
  const carriedId = inTransit.carried[0].id;
  const carriedQuantity = inTransit.carried[0].quantity;

  await page.evaluate(() => window.helixHeresyDebug.setDoorLockPhysicalState('door-surface-basement-staff', 'locked'));
  const blocked = await page.evaluate(() => ({
    transfer: window.helixHeresyDebug.exactTransferSnapshot(),
    statuses: window.helixHeresyDebug.taskStatusSnapshot(),
  }));
  expect(blocked.transfer.carried[0]).toMatchObject({ id: carriedId, quantity: carriedQuantity, carriedBy: 'scientist' });
  expect(blocked.statuses.find((task) => task.id === queued.task.id).status.reason).toContain('locked');

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const restored = await page.evaluate(() => window.helixHeresyDebug.exactTransferSnapshot());
  expect(restored.tasks[0].id).toBe(queued.task.id);
  expect(restored.carried[0]).toMatchObject({ id: carriedId, quantity: carriedQuantity, carriedBy: 'scientist' });

  await page.evaluate((taskId) => window.helixHeresyDebug.cancelTask(taskId), queued.task.id);
  const canceled = await page.evaluate(() => window.helixHeresyDebug.exactTransferSnapshot());
  const dropped = canceled.physicalStacks.find((stack) => stack.id === carriedId);
  expect(canceled.tasks).toHaveLength(0);
  expect(canceled.carried).toHaveLength(0);
  expect(dropped).toMatchObject({ quantity: carriedQuantity, cell: canceled.scientistCell });
  expect(dropped.carriedBy || '').toBe('');
});
