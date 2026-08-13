// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

test('physical records overwrite stale global and room compatibility totals', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const biomass = (state.physicalItemStacks || []).find((stack) => stack.section === 'resources' && stack.key === 'biomass');
    if (!biomass) throw new Error('starter biomass stack not found');
    biomass.quantity = 7;
    biomass.knownQuantity = 7;
    state.resources.biomass = 999;
    state.roomStockpiles.storageRoom.resources.biomass = 888;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  const totals = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      global: state.resources.biomass,
      storage: state.roomStockpiles.storageRoom.resources.biomass,
      physical: state.physicalItemStacks
        .filter((stack) => stack.section === 'resources' && stack.key === 'biomass')
        .reduce((total, stack) => total + stack.quantity, 0),
    };
  }, { key: storageKey });

  expect(totals).toEqual({ global: 7, storage: 7, physical: 7 });

  const actorInventories = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    const stock = debug.physicalStockSnapshot();
    const biomass = stock.stacks.find((stack) => stack.section === 'resources' && stack.key === 'biomass');
    const metalParts = stock.stacks.find((stack) => stack.section === 'resources' && stack.key === 'metalParts');
    const stone = stock.stacks.find((stack) => stack.section === 'resources' && stack.key === 'stoneBlocks');
    const slime = debug.createSpatialTestSlime({ roomId: 'mainLab', size: 'seedling', shape: 'spherical' });
    const scientistCarry = debug.carryActorStack('scientist', biomass.id, 2);
    const slimeCarry = debug.carryActorStack(slime.id, metalParts.id, 1);
    const overCapacity = debug.carryActorStack('scientist', stone.id, 4);
    return {
      slimeId: slime.id,
      scientistCarry,
      slimeCarry,
      overCapacity,
      scientist: debug.actorInventorySnapshot('scientist'),
      slime: debug.actorInventorySnapshot(slime.id),
      biomassTotal: debug.physicalStockSnapshot().stacks
        .filter((stack) => stack.section === 'resources' && stack.key === 'biomass')
        .reduce((total, stack) => total + stack.quantity, 0),
    };
  });

  expect(actorInventories.scientistCarry.carriedBy).toBe('scientist');
  expect(actorInventories.slimeCarry.carriedBy).toBe(actorInventories.slimeId);
  expect(actorInventories.overCapacity).toBeNull();
  expect(actorInventories.scientist).toMatchObject({
    version: 2,
    capacity: { massKg: 25, volumeL: 80 },
    usage: { massKg: 2, volumeL: 2.4 },
    equipmentSlots: { back: '', head: '', torso: '', hands: '' },
    equipped: [],
  });
  expect(actorInventories.scientist.stacks.map((stack) => stack.id)).toContain(actorInventories.scientistCarry.id);
  expect(actorInventories.slime.version).toBe(2);
  expect(actorInventories.slime.capacity.massKg).toBeGreaterThanOrEqual(1);
  expect(actorInventories.slime.capacity.volumeL).toBeGreaterThanOrEqual(2);
  expect(actorInventories.slime.stacks.map((stack) => stack.id)).toContain(actorInventories.slimeCarry.id);
  expect(actorInventories.biomassTotal).toBe(7);

  const equippedBackpack = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    const queued = debug.queueEquipmentChange('fieldBackpack', 'equip');
    for (let attempt = 0; attempt < 6 && !debug.equipmentSnapshot().slots.back; attempt += 1) {
      debug.advanceSimulation(600);
    }
    return { queued, equipment: debug.equipmentSnapshot(), inventory: debug.actorInventorySnapshot('scientist') };
  });
  expect(equippedBackpack.queued).toBe(true);
  expect(equippedBackpack.equipment.slots.back).toBe('fieldBackpack-1');
  expect(equippedBackpack.equipment.summary).toContain('Back Mount: Field backpack');
  expect(equippedBackpack.inventory.capacity).toEqual({ massKg: 40, volumeL: 115 });
  expect(equippedBackpack.inventory.equipped).toContainEqual({
    itemKey: 'fieldBackpack', instanceId: 'fieldBackpack-1', slots: ['back'],
  });
  const protectedLoadout = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    debug.queueEquipmentChange('containmentApron', 'equip');
    for (let attempt = 0; attempt < 6 && !debug.equipmentSnapshot().slots.torso; attempt += 1) {
      debug.advanceSimulation(600);
    }
    const damage = debug.applyScientistEquipmentDamage(20, ['acid']);
    debug.saveEquipmentLoadout('Containment Work');
    return { damage, equipment: debug.equipmentSnapshot() };
  });
  expect(protectedLoadout.damage).toMatchObject({ incoming: 20, damage: 10, absorbed: 10, protection: 0.5 });
  expect(protectedLoadout.equipment.slots.torso).toBe('containmentApron-1');
  expect(protectedLoadout.equipment.contamination).toContain('Containment apron 20');
  expect(protectedLoadout.equipment.loadouts).toContainEqual(expect.objectContaining({
    name: 'Containment Work',
    slots: expect.objectContaining({ back: 'fieldBackpack', torso: 'containmentApron' }),
  }));
  await loadSavedRun(page);
  const persistedInventories = await page.evaluate(({ slimeId }) => ({
    scientist: window.helixHeresyDebug.actorInventorySnapshot('scientist'),
    slime: window.helixHeresyDebug.actorInventorySnapshot(slimeId),
    equipment: window.helixHeresyDebug.equipmentSnapshot('scientist'),
  }), { slimeId: actorInventories.slimeId });
  expect(persistedInventories.scientist.stacks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: actorInventories.scientistCarry.id, carriedBy: 'scientist' }),
  ]));
  expect(persistedInventories.slime.stacks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: actorInventories.slimeCarry.id, carriedBy: actorInventories.slimeId }),
  ]));
  expect(persistedInventories.equipment.loadouts[0].name).toBe('Containment Work');

  await page.locator('[data-workspace-tab="resources"]').click();
  await page.locator('[data-stores-menu-tab="materials"]').click();
  await expect(page.locator('#storesMaterialsList [data-resource-key="biomass"]')).toContainText('7 total');
});

test('collection transfer is blocked without an empty replacement receptacle', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const tank = state.containers.find((container) => container.id === 'basic-10');
    tank.name = 'Replacement Test Tank';
    tank.typeId = 'specimenDrainageTank';
    tank.roomId = 'collectionBay';
    state.scientist.roomId = 'collectionBay';
    state.scientist.mapCell = state.labMap.rooms.collectionBay.anchor;
    state.physicalItemStacks = state.physicalItemStacks.filter((stack) => stack.key !== 'sealedCollectionJar');
    state.collectionBay = { stations: {
      'basic-10': {
        containerId: 'basic-10', material: 'acid droplets', methodType: 'drip',
        receptacle: { label: 'sealed collection jar', itemKey: 'sealedCollectionJar', installed: true, amount: 4, capacity: 10 },
        overflow: { amount: 2, capacity: 3 }, sourceMaterials: ['acid droplets'], sourceSlimes: ['REPLACE-001'],
      },
    } };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="map"]').click();
  await page.locator('[data-map-target-id="basic-10"]').first().click();
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  const transfer = page.locator('[data-context-command-panel="true"]').getByRole('button', { name: 'Transfer Receptacle' });
  await expect(transfer).toBeDisabled();
  await expect(transfer).toHaveAttribute('title', /No empty sealed collection jar is available as a replacement/i);
});

test('hazard cleanup waits for enough vessel capacity and produces contained physical waste', async ({ page }) => {
  await startRun(page);
  const initialContamination = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const room = state.rooms.find((entry) => entry.id === 'mainLab');
    room.attributes.contamination.current = 44;
    state.tileEnvironments = {};
    state.scientist.roomId = 'mainLab';
    state.scientist.mapCell = state.labMap.rooms.mainLab.anchor;
    state.physicalItemStacks = state.physicalItemStacks.filter((stack) => stack.key !== 'linedScrapeJar' && stack.section !== 'residue');
    state.physicalItemStacks.push({
      id: 'cleanup-hazard', section: 'residue', key: 'hazardousSludge', quantity: 13, knownQuantity: 13,
      unitVolumeL: 1, unitMassKg: 1, roomId: 'mainLab', cell: { x: state.scientist.mapCell.x + 1, y: state.scientist.mapCell.y },
      fixtureId: '', stockpileId: '', observedAt: state.clock, reservedTaskId: '', containerId: '', form: 'spill', phase: 'sludge',
      tags: ['hazardous', 'chemical'], contents: [], sourceLabels: ['cleanup fixture'], sourceSlimeIds: [], createdAt: state.clock, updatedAt: state.clock,
    });
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
    return room.attributes.contamination.current;
  }, { key: storageKey });
  await loadSavedRun(page);
  await skipSeconds(page, 1);
  await expect(page.locator('#taskList')).not.toContainText(/Clean Hazardous sludge/i);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.physicalItemStacks.push({
      id: 'cleanup-jars', section: 'inventory', key: 'linedScrapeJar', quantity: 2, knownQuantity: 2,
      unitVolumeL: 13, unitMassKg: 0.6, roomId: 'mainLab', cell: { ...state.labMap.rooms.mainLab.anchor },
      fixtureId: '', stockpileId: '', observedAt: state.clock, reservedTaskId: '', containerId: '', form: 'stack', phase: 'solid',
      tags: [], contents: [], sourceLabels: [], sourceSlimeIds: [], createdAt: state.clock, updatedAt: state.clock,
    });
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
  await skipSeconds(page, 1);
  await page.locator('#queueToggleBtn').click();
  const cleanup = page.locator('#taskList .task-row').filter({ hasText: /Clean Hazardous sludge/i });
  await expect(cleanup).toBeVisible();
  await cleanup.getByRole('button', { name: 'Finish' }).click();

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const vessels = state.physicalItemStacks.filter((stack) =>
      stack.form === 'receptacle' && (stack.contents || []).some((content) => content.kind === 'waste' && content.key === 'hazardousSludge')
    );
    return {
      spillExists: state.physicalItemStacks.some((stack) => stack.id === 'cleanup-hazard'),
      vesselAmounts: vessels.map((stack) => stack.contents.find((content) => content.key === 'hazardousSludge').amount),
      derivedWaste: state.resources.waste,
      contamination: state.rooms.find((room) => room.id === 'mainLab').attributes.contamination.current,
    };
  }, { key: storageKey });

  expect(result.spillExists).toBe(false);
  expect(result.vesselAmounts.sort((a, b) => a - b)).toEqual([1, 12]);
  expect(result.derivedWaste).toBe(13);
  expect(result.contamination).toBeGreaterThan(10);
  expect(result.contamination).toBeLessThanOrEqual(initialContamination);
});

test('tile occupancy permits sharing by small actors but rejects bodies or piles that exceed one square meter', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.physicalItemStacks.push({
      id: 'clutter-pile', section: 'resources', key: 'stoneBlocks', quantity: 80, knownQuantity: 80,
      unitVolumeL: 5, unitMassKg: 8, roomId: 'mainLab', cell: { x: state.scientist.mapCell.x + 1, y: state.scientist.mapCell.y },
      fixtureId: '', stockpileId: '', observedAt: state.clock, reservedTaskId: '', containerId: '', form: 'stack', phase: 'solid',
      tags: [], contents: [], sourceLabels: [], sourceSlimeIds: [], createdAt: state.clock, updatedAt: state.clock,
    });
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  const space = await page.evaluate(({ key }) => {
    const debug = window.helixHeresyDebug;
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const scientistCell = state.scientist.mapCell;
    const emptyCell = { x: scientistCell.x, y: scientistCell.y + 1 };
    const clutterCell = { x: scientistCell.x + 1, y: scientistCell.y };
    const bases = ['A', 'C', 'G', 'T'];
    const profiles = bases.flatMap((first) => bases.map((second) => {
      const genome = `${first}${second}${state.currentGenome.slice(2)}`;
      return debug.genomeSpaceSnapshot(genome, emptyCell);
    })).sort((a, b) => a.floorLoadM2 - b.floorLoadM2);
    const smallGenome = profiles[0].genome;
    const largeGenome = profiles.at(-1).genome;
    return {
      smallShares: debug.genomeSpaceSnapshot(smallGenome, scientistCell),
      largeEmpty: debug.genomeSpaceSnapshot(largeGenome, emptyCell),
      largeShares: debug.genomeSpaceSnapshot(largeGenome, scientistCell),
      clutter: debug.physicalStockSnapshot().tileOccupancy(clutterCell),
    };
  }, { key: storageKey });

  expect(space.smallShares.fits).toBe(true);
  expect(space.largeEmpty.fits).toBe(true);
  expect(space.largeShares.fits).toBe(false);
  expect(space.clutter.occupiedM2).toBeGreaterThanOrEqual(0.8);
  expect(space.clutter.scientistFits).toBe(false);
});
