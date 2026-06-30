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

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

test('slime ai record mirrors contained baseline behavior', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.selectedSlimeId = 'contained-ai';
    state.slimes = [{
      id: 'contained-ai',
      name: 'AI-001',
      genome: state.currentGenome,
      source: 'AI fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-ai="contained-ai"]')).toContainText('AI: Contained');
  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'contained-ai');
    return slime.ai;
  }, { key: storageKey });

  expect(result).toMatchObject({
    state: 'contained',
    intent: 'rest',
    urgency: 'low',
    target: { kind: 'container' },
  });
});

test('slime ai drives summarize biological pressure without executing behavior', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const containers = state.containers || [];
    const jarFor = (index) => containers.find((container) => container.id === `basic-${index}`) || containers[index - 1] || containers[0];
    const makeSlime = (id, name, jar, stats, extra = {}) => ({
      id,
      name,
      genome: state.currentGenome,
      source: 'Drive fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      stats,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      ...extra,
    });
    state.selectedSlimeId = 'drive-hungry';
    state.slimes = [
      makeSlime('drive-hungry', 'DRIVE-FOOD', jarFor(1), {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 4, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      }),
      makeSlime('drive-injured', 'DRIVE-INJURY', jarFor(4), {
        bodyIntegrity: { current: 20, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      }),
      makeSlime('drive-stressed', 'DRIVE-STRESS', jarFor(3), {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 82, max: 100 },
      }),
      makeSlime('drive-worker', 'DRIVE-WORK', jarFor(2), {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      }, { job: 'cleanup' }),
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-drive="drive-hungry"]')).toContainText('Drive: Hunger critical');
  await expect(page.locator('[data-slime-drives="drive-hungry"]')).toContainText('Hunger');
  await expect(page.locator('[data-slime-drives="drive-hungry"]')).toContainText('Critical');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const byId = Object.fromEntries((state.slimes || []).map((slime) => [slime.id, slime.ai]));
    return byId;
  }, { key: storageKey });

  expect(result['drive-hungry']).toMatchObject({
    dominantDrive: 'hunger',
    intent: 'seekFood',
    urgency: 'critical',
    drives: { hunger: { band: 'critical' } },
  });
  expect(result['drive-injured']).toMatchObject({
    dominantDrive: 'injury',
    intent: 'rest',
    urgency: 'high',
    drives: { injury: { band: 'high' } },
  });
  expect(result['drive-stressed'].drives.stress.band).toBe('high');
  expect(result['drive-stressed'].dominantDrive).toMatch(/stress|containment/);
  expect(result['drive-worker']).toMatchObject({
    dominantDrive: 'work',
    state: 'working',
    intent: 'continueJob',
    drives: { work: { band: 'moderate' } },
  });
});

test('slime ai perception stays local and respects containment limits', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const containers = state.containers || [];
    const jarFor = (index) => containers.find((container) => container.id === `basic-${index}`) || containers[index - 1] || containers[0];
    const mainLab = (state.rooms || []).find((room) => room.id === 'mainLab');
    if (mainLab?.attributes?.contamination) {
      mainLab.attributes.contamination.current = 55;
    }
    const mainPitDoor = Object.values(state.doors || {}).find((door) => {
      const ids = door.roomIds || [];
      return ids.includes('mainLab') && ids.includes('pits');
    });
    if (mainPitDoor) {
      mainPitDoor.state = 'open';
      mainPitDoor.lockState = 'unlocked';
      mainPitDoor.sealState = 'unsealed';
    }
    state.roomStockpiles ||= {};
    state.roomStockpiles.mainLab ||= { resources: {}, inventory: {}, collectedByproducts: {}, specimenMaterials: {} };
    state.roomStockpiles.mainLab.resources ||= {};
    state.roomStockpiles.mainLab.resources.waste = 6;
    state.resources ||= {};
    state.resources.waste = 6;
    state.nextResidueNumber = Math.max(2, Number(state.nextResidueNumber) || 1);
    state.feedingResidues = [{
      id: 'residue-perception',
      typeKey: 'looseBiomatter',
      amount: 5,
      location: { type: 'room', roomId: 'mainLab' },
      tags: ['organic'],
      sourceLabels: ['test spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    const now = Number(state.clock) || 0;
    state.corpses = [{
      id: 'corpse-perception',
      specimenId: 'dead-perception',
      name: 'PERCEPT-DEAD',
      genome: state.currentGenome,
      source: 'Perception fixture',
      deathReason: 'fixture',
      diedAt: now,
      roomId: 'mainLab',
      containerId: null,
      storage: 'room',
      mapCell: { x: 20, y: 14 },
      consumedProgress: 0,
      ruined: false,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      necropsyReport: '',
      harvestedProcedures: {},
    }];
    const stats = {
      bodyIntegrity: { current: 100, max: 100 },
      nutrition: { current: 80, max: 100 },
      currentMass: { current: 100, max: 100 },
      divisionPressure: { current: 0, max: 100 },
      stress: { current: 0, max: 100 },
    };
    const makeSlime = (id, name, extra = {}) => ({
      id,
      name,
      genome: state.currentGenome,
      source: 'Perception fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: { x: 20, y: 15 },
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      stats,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      ...extra,
    });
    const sealedJar = jarFor(2);
    state.selectedSlimeId = 'perception-loose';
    state.slimes = [
      makeSlime('perception-loose', 'PERCEPT-LOOSE'),
      makeSlime('perception-contained', 'PERCEPT-SEALED', {
        status: 'contained',
        containerId: sealedJar.id,
        roomId: sealedJar.roomId,
        mapCell: null,
      }),
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-perception="perception-loose"]')).toContainText('Perceives:');
  await expect(page.locator('[data-slime-perception-panel="perception-loose"]')).toContainText('Loose biomatter');
  await expect(page.locator('[data-slime-perception-panel="perception-loose"]')).toContainText('corpse');
  await expect(page.locator('[data-slime-perception-panel="perception-loose"]')).toContainText('open air from Pits');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return Object.fromEntries((state.slimes || []).map((slime) => [slime.id, slime.ai?.perception]));
  }, { key: storageKey });

  const looseLabels = result['perception-loose'].entries.map((entry) => entry.label);
  expect(result['perception-loose'].scope).toBe('room-local');
  expect(looseLabels).toEqual(expect.arrayContaining([
    'Loose biomatter',
    'waste stores',
    'scientist nearby',
    'open air from Pits',
  ]));
  expect(looseLabels.some((label) => label.includes('corpse'))).toBe(true);
  expect(result['perception-loose'].entries.map((entry) => entry.kind)).toEqual(expect.arrayContaining(['food', 'corpse', 'waste', 'actor', 'door']));

  const containedLabels = result['perception-contained'].entries.map((entry) => entry.label);
  expect(result['perception-contained'].scope).toBe('container-local');
  expect(containedLabels).toContain('container muffles room cues');
  expect(containedLabels).not.toContain('Loose biomatter');
});

test('lab blueprint stores room footprints and queues scientist movement with map paths', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);

  await expect(page.locator('[data-lab-map-panel="true"]')).toBeVisible();
  await expect(page.locator('#clockReadout')).toContainText('Day 1 00:00:00');
  await expect(page.locator('#roomSummary')).toContainText('Blueprint: 40 x 25 m; 6 mapped rooms');
  await expect(page.locator('.lab-map-cell.object-cell').first()).toBeVisible();

  const initial = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const doorCells = new Set(Object.values(state.labMap.doors || {}).flatMap((door) => [
      `${door.from.x},${door.from.y}`,
      `${door.to.x},${door.to.y}`
    ]));
    return {
      map: state.labMap,
      scientist: state.scientist,
      containers: state.containers,
      containerCellsValid: (state.containers || []).every((container) =>
        container.mapCell
        && (state.labMap.rooms[container.roomId]?.cells || []).some((cell) => cell.x === container.mapCell.x && cell.y === container.mapCell.y)
        && !doorCells.has(`${container.mapCell.x},${container.mapCell.y}`)
      )
    };
  }, { key: storageKey });

  expect(initial.map.tileSizeM).toBe(1);
  await expect(page.locator('.lab-map-cell')).toHaveCount(initial.map.width * initial.map.height);
  expect(initial.map.rooms.mainLab).toMatchObject({ x: 16, y: 10, width: 12, height: 10 });
  expect(initial.map.rooms.storageRoom).toMatchObject({ x: 18, y: 5, width: 7, height: 5 });
  expect(initial.map.rooms.pits.cells.length).toBeLessThan(initial.map.rooms.pits.width * initial.map.rooms.pits.height);
  expect(initial.map.doors['mainLab::storageRoom']).toMatchObject({
    from: { x: 21, y: 9 },
    to: { x: 21, y: 10 }
  });
  expect(initial.scientist.roomId).toBe('mainLab');
  expect(initial.scientist.mapCell).toEqual(initial.map.rooms.mainLab.anchor);
  expect(initial.scientist.physicalPresence.moveSpeedMps).toBeGreaterThan(0);
  expect(initial.containerCellsValid).toBe(true);
  expect(initial.containers.find((container) => container.id === 'basic-11').mapCell).toBeTruthy();
  expect(await page.locator('.lab-map-cell.blocking-object-cell').count()).toBeGreaterThan(initial.containers.length);

  await page.locator('[data-scientist-move-room-id="storageRoom"]').click();

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'scientistMove');
    return { task, storageAnchor: state.labMap.rooms.storageRoom.anchor };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.fromRoomId).toBe('mainLab');
  expect(queued.task.data.toRoomId).toBe('storageRoom');
  expect(queued.task.data.mapPath.length).toBeGreaterThan(1);
  expect(queued.task.data.toCell).toEqual(queued.storageAnchor);
  expect(queued.task.data.doorTransit.some((step) => step.fromRoomId === 'mainLab' && step.toRoomId === 'storageRoom')).toBe(true);
  expect(queued.task.dueAt - queued.task.createdAt).toBeLessThan(60);
  await expect(page.locator('.lab-map-cell.queued-path-cell')).toHaveCount(queued.task.data.mapPath.length);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Move scientist to Storage Room' }).getByRole('button', { name: 'Finish' }).click();

  const arrived = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      scientist: state.scientist,
      storageAnchor: state.labMap.rooms.storageRoom.anchor
    };
  }, { key: storageKey });

  expect(arrived.scientist.roomId).toBe('storageRoom');
  expect(arrived.scientist.mapCell).toEqual(arrived.storageAnchor);
  await expect(page.locator('.lab-map-cell.scientist-cell')).toHaveAttribute('data-map-room', 'storageRoom');

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('released slimes move toward accessible residue without raiding packaged storage supplies', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'loose-seeker';
    state.resources = { ...(state.resources || {}), organicFeedstock: 5 };
    state.roomStockpiles ||= {};
    state.roomStockpiles.storageRoom ||= { resources: {}, inventory: {}, collectedByproducts: {}, specimenMaterials: {} };
    state.roomStockpiles.storageRoom.resources = {
      ...(state.roomStockpiles.storageRoom.resources || {}),
      organicFeedstock: 5,
    };
    state.roomStockpiles.mainLab ||= { resources: {}, inventory: {}, collectedByproducts: {}, specimenMaterials: {} };
    delete state.roomStockpiles.mainLab.resources?.organicFeedstock;
    state.feedingResidues = [{
      id: 'residue-menagerie',
      typeKey: 'looseBiomatter',
      amount: 4,
      location: { type: 'room', roomId: 'menagerie' },
      tags: ['organic', 'mess'],
      sourceLabels: ['test spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'loose-seeker',
      name: 'LOOSE-001',
      genome: state.currentGenome,
      source: 'Autonomous movement fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: state.labMap.rooms.mainLab.anchor,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 0,
      roomBehavior: { seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 20, max: 100 },
        currentMass: { current: 50, max: 100 },
      },
      revealed: { shape: true, consistency: true, appendages: true },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-card="loose-seeker"]')).toContainText('uncontained');
  await skipSeconds(page, 1);
  await expect(page.locator('[data-slime-card="loose-seeker"]')).toContainText(/seeking|moving/i);
  await expect(page.locator('[data-slime-ai="loose-seeker"]')).toContainText(/AI: (Moving|Seeking)/);
  await expect(page.locator('[data-slime-movement="loose-seeker"]')).toContainText('Move:');

  const earlyAi = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'loose-seeker');
    const movement = slime.autonomousMovement;
    const crossingStates = [];
    for (let index = 0; index < (movement?.path || []).length - 1; index += 1) {
      const current = movement.path[index];
      const next = movement.path[index + 1];
      const mapDoor = Object.values(state.labMap?.doors || {}).find((door) =>
        (door.from.x === current.x && door.from.y === current.y && door.to.x === next.x && door.to.y === next.y)
        || (door.to.x === current.x && door.to.y === current.y && door.from.x === next.x && door.from.y === next.y)
      );
      if (mapDoor) {
        const door = state.doors?.[mapDoor.key] || mapDoor;
        crossingStates.push({
          key: mapDoor.key,
          state: door.state,
          lockState: door.lockState,
          sealState: door.sealState,
          breached: Boolean(door.breached || door.condition <= 0),
        });
      }
    }
    return { ai: slime.ai, movement, crossingStates };
  }, { key: storageKey });
  expect(['moving', 'seeking']).toContain(earlyAi.ai.state);
  expect(earlyAi.ai.intent).toBe('seekFood');
  expect(earlyAi.ai.target.kind).toBe('residue');
  expect(earlyAi.ai.target.label).toMatch(/trace from Menagerie/);
  expect(earlyAi.ai.perception.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'trace',
      targetKind: 'room',
      targetId: 'menagerie',
    }),
  ]));
  expect(earlyAi.movement.distanceMeters).toBeGreaterThan(0);
  expect(earlyAi.movement.speedMps).toBeGreaterThan(0);
  expect(earlyAi.movement.movementFactors).toEqual(expect.arrayContaining(['reduced mass']));
  expect(earlyAi.crossingStates.every((door) => door.breached || (door.state === 'open' && door.sealState !== 'sealed'))).toBe(true);

  await skipSeconds(page, 1800);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'loose-seeker');
    return {
      slime,
      storageOrganic: state.roomStockpiles?.storageRoom?.resources?.organicFeedstock || 0,
      residueAmount: (state.feedingResidues || []).find((residue) => residue.id === 'residue-menagerie')?.amount || 0,
      tasks: state.tasks || [],
    };
  }, { key: storageKey });

  expect(result.slime.roomId).toBe('menagerie');
  expect(result.residueAmount).toBeLessThan(4);
  expect(result.storageOrganic).toBe(5);
  expect(result.tasks.some((task) => /creature|slime|autonomous/i.test(task.type))).toBe(false);
  await expect(page.locator('[data-map-target-kind="slime"][data-map-target-id="loose-seeker"]').first()).toHaveAttribute('title', /feeding|seeking|loose/i);
});

test('released slime movement stops if an open route closes ahead of it', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const menagerieDoor = state.doors?.['mainLab::menagerie'] || state.doors?.['menagerie::mainLab'];
    if (menagerieDoor) {
      menagerieDoor.state = 'open';
      menagerieDoor.lockState = 'unlocked';
      menagerieDoor.sealState = 'unsealed';
    }
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'door-route';
    state.feedingResidues = [{
      id: 'residue-menagerie-route',
      typeKey: 'looseBiomatter',
      amount: 4,
      location: { type: 'room', roomId: 'menagerie' },
      tags: ['organic', 'mess'],
      sourceLabels: ['test spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'door-route',
      name: 'ROUTE-001',
      genome: state.currentGenome,
      source: 'Mid-route door fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: state.labMap.rooms.mainLab.anchor,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 0,
      roomBehavior: { seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 20, max: 100 },
        bodyIntegrity: { current: 30, max: 100 },
        currentMass: { current: 20, max: 100 },
        stress: { current: 90, max: 100 },
      },
      revealed: { shape: true, consistency: true, appendages: true },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await skipSeconds(page, 1);
  const started = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'door-route');
    return {
      movement: slime.autonomousMovement,
      ai: slime.ai,
    };
  }, { key: storageKey });
  expect(started.movement).toBeTruthy();
  expect(started.ai.intent).toBe('seekFood');

  await page.locator('[data-door-toggle="mainLab::menagerie"]').first().evaluate((element) => element.click());
  const doorAfterClose = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors?.['mainLab::menagerie'] || state.doors?.['menagerie::mainLab'];
  }, { key: storageKey });
  expect(doorAfterClose.state).toBe('closed');
  await skipSeconds(page, 1);

  await expect(page.locator('[data-slime-card="door-route"]')).toContainText('pressing against closed door');
  const blocked = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'door-route');
    return {
      roomId: slime.roomId,
      movement: slime.autonomousMovement,
      activity: slime.roomActivity,
      ai: slime.ai,
      tasks: state.tasks || [],
    };
  }, { key: storageKey });

  expect(blocked.roomId).toBe('mainLab');
  expect(blocked.movement).toBeNull();
  expect(blocked.activity).toMatchObject({
    type: 'pressingClosedDoor',
    targetKind: 'residue',
  });
  expect(blocked.ai).toMatchObject({
    state: 'blocked',
    intent: 'blocked',
    target: { kind: 'door' },
  });
  expect(blocked.tasks.some((task) => /creature|slime|autonomous/i.test(task.type))).toBe(false);
});

test('released slimes press blocked doors and expose possible intent instead of queueing movement', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'door-seeker';
    state.feedingResidues = [{
      id: 'residue-storage',
      typeKey: 'looseBiomatter',
      amount: 3,
      location: { type: 'room', roomId: 'storageRoom' },
      tags: ['organic', 'mess'],
      sourceLabels: ['test spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'door-seeker',
      name: 'DOOR-001',
      genome: state.currentGenome,
      source: 'Blocked door fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: state.labMap.rooms.mainLab.anchor,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 0,
      roomBehavior: { seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 20, max: 100 },
        currentMass: { current: 50, max: 100 },
      },
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await skipSeconds(page, 1);

  await expect(page.locator('[data-slime-card="door-seeker"]')).toContainText('pressing against closed door');
  await expect(page.locator('[data-slime-card="door-seeker"]')).toContainText('Possible intent: seeking accessible food');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'door-seeker');
    return {
      activity: slime.roomActivity,
      ai: slime.ai,
      tasks: state.tasks || [],
    };
  }, { key: storageKey });

  expect(result.activity.type).toBe('pressingClosedDoor');
  expect(result.activity.targetKind).toBe('residue');
  expect(result.ai).toMatchObject({
    state: 'blocked',
    intent: 'blocked',
    target: { kind: 'door' },
  });
  expect(result.ai.perception.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'trace',
      targetKind: 'room',
      targetId: 'storageRoom',
    }),
  ]));
  expect(result.ai.reason).toContain('blocked');
  expect(result.tasks.some((task) => /creature|slime|autonomous/i.test(task.type))).toBe(false);
});

test('spatial incidents appear as map alerts without creating response tasks', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.tasks = [];
    state.incidents = [];
    state.nextIncidentNumber = 1;
    state.rooms = (state.rooms || []).map((room) => {
      if (room.id !== 'mainLab') {
        return room;
      }
      return {
        ...room,
        attributes: {
          ...room.attributes,
          contamination: {
            ...(room.attributes?.contamination || {}),
            current: 62,
            baseline: 10,
          },
        },
      };
    });
    state.feedingResidues = [{
      id: 'residue-alert',
      typeKey: 'hazardousSludge',
      amount: 3,
      location: { type: 'room', roomId: 'mainLab' },
      tags: ['hazardous', 'mess'],
      sourceLabels: ['alert fixture'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'alert-slime',
      name: 'ALERT-001',
      genome: state.currentGenome,
      source: 'Incident alert fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: state.labMap.rooms.mainLab.anchor,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 10000,
      roomActivity: {
        type: 'pressingClosedDoor',
        label: 'pressing against closed door',
        roomId: 'mainLab',
        targetRoomId: 'storageRoom',
        targetKind: 'residue',
        targetId: 'residue-storage',
        targetLabel: 'Loose biomatter',
        doorKey: 'mainLab::storageRoom',
        updatedAt: 0,
      },
      roomBehavior: { seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 20, max: 100 },
        currentMass: { current: 50, max: 100 },
      },
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  const panel = page.locator('[data-incident-panel="true"]');
  await expect(panel).toContainText('Incident Alerts');
  await expect(panel).toContainText('3 active alerts');
  await expect(panel).toContainText('ALERT-001 pressing against a blocked door');
  await expect(panel).toContainText('Main Lab contamination is fouled');
  await expect(panel).toContainText('Hazardous sludge in Main Lab');
  await expect(page.locator('[data-incident-alert]')).toHaveCount(3);

  const highlightedAlerts = await page.locator('.lab-map-cell.incident-alert-cell').count();
  expect(highlightedAlerts).toBeGreaterThan(0);
  await expect(page.locator('[data-room-card="mainLab"]')).toContainText('3 active alerts');

  const tasks = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.tasks || [];
  }, { key: storageKey });
  expect(tasks).toEqual([]);
});

test('room contamination diffuses through connected doors according to seal quality', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.tasks = [];
    state.slimes = [];
    state.corpses = [];
    state.feedingResidues = [];
    state.rooms = (state.rooms || []).map((room) => {
      const current = room.id === 'mainLab' ? 80 : 0;
      return {
        ...room,
        attributes: {
          ...room.attributes,
          contamination: {
            ...(room.attributes?.contamination || {}),
            current,
            baseline: current,
            recoveryPerHour: 0,
          },
        },
      };
    });
    state.doors['mainLab::storageRoom'] = {
      ...state.doors['mainLab::storageRoom'],
      typeId: 'wardedContainmentDoor',
      condition: 100,
      state: 'closed',
      lockState: 'unlocked',
      sealState: 'sealed',
      wardIds: ['sealTightening'],
      breached: false,
    };
    state.doors['bedroom::mainLab'] = {
      ...state.doors['bedroom::mainLab'],
      typeId: 'roughWoodDoor',
      condition: 30,
      state: 'closed',
      lockState: 'unlocked',
      sealState: 'sealed',
      wardIds: [],
      breached: false,
    };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
  await skipSeconds(page, 3600);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const roomValue = (roomId) => (state.rooms || []).find((room) => room.id === roomId)?.attributes?.contamination?.current;
    return {
      main: roomValue('mainLab'),
      storage: roomValue('storageRoom'),
      bedroom: roomValue('bedroom'),
      tasks: state.tasks || [],
    };
  }, { key: storageKey });

  expect(result.main).toBeLessThan(80);
  expect(result.storage).toBeLessThan(0.1);
  expect(result.bedroom).toBeGreaterThan(1);
  expect(result.bedroom).toBeGreaterThan(result.storage + 1);
  expect(result.tasks).toEqual([]);
  await expect(page.locator('[data-door-connection="mainLab::storageRoom"]').first()).toContainText('blocks contamination diffusion');
  await expect(page.locator('[data-door-connection="bedroom::mainLab"]').first()).toContainText('sealed: about 78% leak potential');
  await expect(page.locator('[data-room-card="bedroom"]')).toContainText('contamination drifting in');
});

test('door access states block routing and show physical door data', async ({ page }) => {
  await startRun(page);

  const initialDoors = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors;
  }, { key: storageKey });

  expect(initialDoors['mainLab::storageRoom']).toMatchObject({
    typeId: 'reinforcedWoodDoor',
    condition: 100,
    lockState: 'unlocked',
    sealState: 'unsealed',
    breached: false
  });
  expect(initialDoors['collectionBay::mainLab'].typeId).toBe('glassObservationDoor');
  expect(initialDoors['mainLab::pits'].wardIds).toContain('sealTightening');
  await expect(page.locator('[data-door-connection="mainLab::storageRoom"]').first()).toContainText('Reinforced Wood Door');

  await page.locator('[data-door-lock-toggle="mainLab::storageRoom"]').first().click();
  await expect(page.locator('[data-scientist-move-room-id="storageRoom"]')).toBeDisabled();
  await expect(page.locator('[data-scientist-move-room-id="storageRoom"]')).toHaveAttribute('title', /locked/i);
  await expect(page.locator('[data-map-door="mainLab::storageRoom"].door-locked').first()).toBeVisible();

  let door = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors['mainLab::storageRoom'];
  }, { key: storageKey });
  expect(door.state).toBe('closed');
  expect(door.lockState).toBe('locked');

  await page.locator('[data-door-lock-toggle="mainLab::storageRoom"]').first().click();
  await expect(page.locator('[data-scientist-move-room-id="storageRoom"]')).toBeEnabled();

  await page.locator('[data-door-seal-toggle="mainLab::storageRoom"]').first().click();
  await expect(page.locator('[data-scientist-move-room-id="storageRoom"]')).toBeDisabled();
  await expect(page.locator('[data-scientist-move-room-id="storageRoom"]')).toHaveAttribute('title', /sealed/i);
  await expect(page.locator('[data-map-door="mainLab::storageRoom"].door-sealed').first()).toBeVisible();

  door = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors['mainLab::storageRoom'];
  }, { key: storageKey });
  expect(door.state).toBe('closed');
  expect(door.lockState).toBe('unlocked');
  expect(door.sealState).toBe('sealed');

  await page.locator('[data-door-seal-toggle="mainLab::storageRoom"]').first().click();
  await expect(page.locator('[data-scientist-move-room-id="storageRoom"]')).toBeEnabled();
});

test('container hauling reserves a footprint and routes to adjacent access cells', async ({ page }) => {
  await startRun(page);

  const before = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((candidate) => candidate.id === 'basic-1');
    return { container };
  }, { key: storageKey });

  expect(before.container.mapCell).toBeTruthy();

  await page.locator('[data-container-room-select="basic-1"]').selectOption('collectionBay');

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'containerHaul');
    return { task };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.fromCell).toEqual(before.container.mapCell);
  expect(queued.task.data.mapPath[0]).toEqual(queued.task.data.fromAccessCell);
  expect(queued.task.data.mapPath.at(-1)).toEqual(queued.task.data.toAccessCell);
  expect(queued.task.data.toCell).not.toEqual(queued.task.data.toAccessCell);
  expect(Math.abs(queued.task.data.toCell.x - queued.task.data.toAccessCell.x)
    + Math.abs(queued.task.data.toCell.y - queued.task.data.toAccessCell.y)).toBe(1);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Haul Basic Glass Jar 1 to Collection Bay' }).getByRole('button', { name: 'Finish' }).click();

  const arrived = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((candidate) => candidate.id === 'basic-1');
    return { container };
  }, { key: storageKey });

  expect(arrived.container.roomId).toBe('collectionBay');
  expect(arrived.container.mapCell).toEqual(queued.task.data.toCell);
});

test('lab blueprint clicks focus existing room door and object panels', async ({ page }) => {
  await startRun(page);

  await page.locator('[data-map-target-kind="container"][data-map-target-id="basic-1"]').first().click();
  await expect(page.locator('[data-container-card="basic-1"]')).toHaveClass(/selected-map-target/);

  let selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).selectedMapTarget;
  }, { key: storageKey });
  expect(selected).toEqual({ kind: 'container', id: 'basic-1' });

  await page.locator('[data-map-door="mainLab::storageRoom"]').first().click();
  await expect(page.locator('[data-door-connection="mainLab::storageRoom"]').first()).toHaveClass(/selected-map-target/);
  selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).selectedMapTarget;
  }, { key: storageKey });
  expect(selected.kind).toBe('door');
  expect(selected.key).toBe('mainLab::storageRoom');

  const bedroomCell = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const bedroom = state.labMap.rooms.bedroom;
    const doorCells = new Set(Object.values(state.labMap.doors || {}).flatMap((door) => [
      `${door.from.x},${door.from.y}`,
      `${door.to.x},${door.to.y}`
    ]));
    return bedroom.cells.find((cell) => !doorCells.has(`${cell.x},${cell.y}`));
  }, { key: storageKey });

  await page.locator(`[data-map-x="${bedroomCell.x}"][data-map-y="${bedroomCell.y}"]`).click();
  await expect(page.locator('[data-room-card="bedroom"]')).toHaveClass(/selected-map-target/);
  selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).selectedMapTarget;
  }, { key: storageKey });
  expect(selected).toEqual({ kind: 'room', roomId: 'bedroom' });
});

test('construction designations become unassigned rooms that can receive a purpose', async ({ page }) => {
  await startRun(page);

  await expect(page.locator('[data-construction-panel="true"]')).toBeVisible();
  await page.locator('[data-dig-x="true"]').fill('25');
  await page.locator('[data-dig-y="true"]').fill('6');
  await page.locator('[data-dig-width="true"]').fill('4');
  await page.locator('[data-dig-height="true"]').fill('4');
  await page.locator('[data-designate-dig="true"]').click();

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'excavate');
    return {
      task,
      map: state.labMap,
      construction: state.construction
    };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.rect).toEqual({ x: 25, y: 6, width: 4, height: 4 });
  expect(queued.task.data.cells).toHaveLength(16);
  expect(queued.map.width).toBeGreaterThanOrEqual(40);
  expect(queued.construction.lastDigRect).toEqual({ x: 25, y: 6, width: 4, height: 4 });
  await expect(page.locator('.lab-map-cell.planned-excavation-cell')).toHaveCount(16);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Excavate 4 x 4 chamber' }).getByRole('button', { name: 'Finish' }).click();

  const excavated = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const room = (state.rooms || []).find((candidate) => candidate.role === 'excavated');
    const doorKeys = room
      ? Object.keys(state.doors || {}).filter((keyName) => keyName.includes(room.id))
      : [];
    return {
      room,
      mapRoom: room ? state.labMap.rooms[room.id] : null,
      doorKeys,
      doors: state.doors
    };
  }, { key: storageKey });

  expect(excavated.room).toBeTruthy();
  expect(excavated.room.name).toBe('Unassigned Excavation 1');
  expect(excavated.room.connections).toEqual(expect.arrayContaining(['mainLab']));
  expect(excavated.mapRoom.cells).toHaveLength(16);
  expect(excavated.doorKeys.length).toBeGreaterThan(0);
  expect(excavated.doorKeys.some((keyName) => excavated.doors[keyName].state === 'open')).toBe(true);
  await expect(page.locator('.lab-map-cell.planned-excavation-cell')).toHaveCount(0);
  await expect(page.locator(`[data-room-purpose-control="${excavated.room.id}"]`)).toBeVisible();

  await page.locator(`[data-room-purpose-select="${excavated.room.id}"]`).selectOption('storage');
  await page.locator(`[data-assign-room-purpose="${excavated.room.id}"]`).click();

  const assigned = await page.evaluate(({ key, roomId }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const room = (state.rooms || []).find((candidate) => candidate.id === roomId);
    return { room };
  }, { key: storageKey, roomId: excavated.room.id });

  expect(assigned.room.role).toBe('materialStorage');
  expect(assigned.room.name).toBe('Storage Room 1');
  await expect(page.locator(`[data-room-purpose-control="${excavated.room.id}"]`)).toHaveCount(0);
});
