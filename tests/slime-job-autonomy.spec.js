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

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

function roleSlime({ id, name, genome, containerId, roleId = 'idle', roleSource = 'automatic' }) {
  return {
    id, name, genome, source: 'Role autonomy fixture', createdAt: 0, deathAt: 100000,
    lifecycleVersion: 1, matureAt: 0, mature: true, status: 'contained', containerId,
    roomId: 'pits', mapCell: null, parentIds: ['shared-parent'], broodId: 'shared-brood',
    roleId, roleSource, roleKnowledge: {}, roleEvidence: {},
    revealed: { sustenance: true, element: true, consistency: true, behavior: true, stability: true, size: true, shape: true },
    measured: {}, traitObservations: {}, testsRun: [],
    stats: {
      bodyIntegrity: { current: 100, max: 100 }, nutrition: { current: 40, max: 100 },
      stress: { current: 0, max: 100 }, currentMass: { current: 80, max: 100 },
      divisionPressure: { current: 0, max: 100 },
    },
  };
}

function corpse({ id, name, genome, containerId, consumedProgress = 0 }) {
  return {
    id, specimenId: `${id}-specimen`, name, genome, source: 'Role autonomy fixture',
    deathReason: 'fixture', diedAt: 0, roomId: 'pits', containerId, storage: 'container',
    mapCell: null, consumedProgress, ruined: false, revealed: {}, measured: {},
    traitObservations: {}, testsRun: [], necropsyReport: '', harvestedProcedures: {},
  };
}

test('pit roles are automatic while physical corpse feeding remains policy-independent and shared', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await startRun(page);
  const context = await page.evaluate((key) => {
    const payload = JSON.parse(localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return { seed: state.seed, complexity: state.complexity || 'clean', currentGenome: state.currentGenome };
  }, storageKey);
  const genome = genomeForTraits({
    seed: context.seed, complexity: context.complexity, baseGenome: context.currentGenome,
    traits: { sustenance: 'carrion feeder', element: 'none', consistency: 'mucous', behavior: 'idle pooling', stability: 'steady' },
  });
  const first = roleSlime({ id: 'pit-worker-a', name: 'PIT-WORKER-A', genome, containerId: 'basic-13' });
  const second = roleSlime({ id: 'pit-worker-b', name: 'PIT-WORKER-B', genome, containerId: 'basic-13' });
  const localCorpse = corpse({ id: 'local-corpse', name: 'LOCAL-CORPSE', genome, containerId: 'basic-13', consumedProgress: 10 });
  const remoteCorpse = corpse({ id: 'remote-corpse', name: 'REMOTE-CORPSE', genome, containerId: 'basic-12', consumedProgress: 10 });

  await page.evaluate(({ key, first, second, localCorpse, remoteCorpse }) => {
    const payload = JSON.parse(localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const workerPit = state.containers.find((item) => item.id === 'basic-13');
    const otherPit = state.containers.find((item) => item.id === 'basic-12');
    workerPit.name = 'Worker Pit'; workerPit.roomId = 'pits'; workerPit.defaultRoleId = 'corpse';
    otherPit.name = 'Other Pit'; otherPit.roomId = 'pits'; otherPit.defaultRoleId = 'corpse';
    state.started = true; state.paused = true; state.tasks = []; state.scientist.roomId = 'pits';
    state.policies.corpseHandlingTargets = { fresh: false, decaying: false, spoiled: false, ruined: false };
    state.slimes = [first]; state.corpses = [localCorpse, remoteCorpse];
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, first, second, localCorpse, remoteCorpse });
  await loadSavedRun(page);
  await skipSeconds(page, 60);

  await expect(page.locator('#jobList')).toContainText('Role: Corpse Processing');
  await expect(page.locator('#jobList')).toContainText('Source: automatic: Worker Pit');
  let result = await page.evaluate((key) => {
    const payload = JSON.parse(localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const local = state.corpses.find((item) => item.id === 'local-corpse');
    const remote = state.corpses.find((item) => item.id === 'remote-corpse');
    return {
      localProgress: local.consumedProgress,
      remoteProgress: remote.consumedProgress,
      contributors: Object.keys(local.processingContributions || {}).sort(),
      roles: state.slimes.map((slime) => ({ roleId: slime.roleId, roleSource: slime.roleSource, hasLegacyJob: Object.hasOwn(slime, 'job') })),
    };
  }, storageKey);
  expect(result.localProgress).toBeGreaterThan(10);
  const firstProgress = result.localProgress;
  expect(result.remoteProgress).toBe(10);
  expect(result.contributors).toEqual(['pit-worker-a']);
  expect(result.roles).toEqual([{ roleId: 'corpse', roleSource: 'automatic', hasLegacyJob: false }]);

  await page.evaluate(({ key, second }) => {
    const payload = JSON.parse(localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.slimes[0].containerId = 'basic-1';
    state.slimes[0].roomId = 'mainLab';
    state.slimes.push(second);
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, second });
  await loadSavedRun(page);
  await skipSeconds(page, 60);
  result = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || '{}').state;
    const local = state.corpses.find((item) => item.id === 'local-corpse');
    return { progress: local.consumedProgress, contributors: Object.keys(local.processingContributions || {}).sort() };
  }, storageKey);
  expect(result.progress).toBeGreaterThan(firstProgress);
  expect(result.contributors).toEqual(['pit-worker-a', 'pit-worker-b']);

  const firstRoleSelect = page.locator('[data-job-slime-id="pit-worker-b"]');
  await firstRoleSelect.evaluate((element) => {
    element.value = 'idle';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  let role = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key) || '{}').state.slimes.find((slime) => slime.id === 'pit-worker-b')), storageKey);
  expect(role).toMatchObject({ roleId: 'idle', roleSource: 'manual' });
  await page.locator('[data-job-slime-id="pit-worker-b"]').evaluate((element) => {
    element.value = 'automatic';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  role = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key) || '{}').state.slimes.find((slime) => slime.id === 'pit-worker-b')), storageKey);
  expect(role).toMatchObject({ roleId: 'corpse', roleSource: 'automatic' });
  expect(pageErrors).toEqual([]);
});

test('a hungry slime digests pit Waste regardless of its role and leaves physical outputs in that pit', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await startRun(page);
  const context = await page.evaluate((key) => {
    const payload = JSON.parse(localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return { seed: state.seed, complexity: state.complexity || 'clean', currentGenome: state.currentGenome };
  }, storageKey);
  const genome = genomeForTraits({
    seed: context.seed, complexity: context.complexity, baseGenome: context.currentGenome,
    traits: { sustenance: 'hazard feeder', element: 'none', consistency: 'soft gelatin', behavior: 'idle pooling', stability: 'steady' },
  });
  const slime = roleSlime({ id: 'pit-disposer', name: 'PIT-DISPOSER', genome, containerId: 'basic-13', roleId: 'idle', roleSource: 'manual' });

  await page.evaluate(({ key, slime }) => {
    const payload = JSON.parse(localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const pit = state.containers.find((item) => item.id === 'basic-13');
    pit.name = 'Disposal Pit'; pit.roomId = 'pits'; pit.defaultRoleId = 'corpse';
    state.started = true; state.paused = true; state.tasks = []; state.scientist.roomId = 'pits'; state.slimes = [slime]; state.corpses = [];
    state.physicalItemStacks = state.physicalItemStacks.filter((stack) => !(stack.section === 'resources' && stack.key === 'waste'));
    state.physicalItemStacks.push({
      id: 'room-waste', section: 'resources', key: 'waste', quantity: 4, knownQuantity: 4,
      roomId: 'pits', cell: { ...state.labMap.rooms.pits.anchor }, form: 'waste', phase: 'sludge', tags: ['waste'],
      fixtureId: '', stockpileId: '', containerId: '', contents: [], sourceLabels: ['room waste'], sourceSlimeIds: [],
    }, {
      id: 'pit-waste', section: 'resources', key: 'waste', quantity: 1, knownQuantity: 1,
      roomId: 'pits', cell: { ...pit.mapCell }, form: 'waste', phase: 'sludge', tags: ['waste', 'hazardous'],
      fixtureId: '', stockpileId: '', containerId: pit.id, contents: [], sourceLabels: ['pit waste'], sourceSlimeIds: [],
      processingProgress: 0.9999999, processingResidueProgress: 2.9,
    });
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, slime });
  await loadSavedRun(page);
  await skipSeconds(page, 60);

  await expect(page.locator('#jobList')).toContainText('Role: Idle');
  const result = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || '{}').state;
    return {
      role: state.slimes[0].roleId,
      roomWaste: state.physicalItemStacks.filter((stack) => stack.id === 'room-waste').reduce((sum, stack) => sum + stack.quantity, 0),
      pitWaste: state.physicalItemStacks.filter((stack) => stack.id === 'pit-waste').reduce((sum, stack) => sum + stack.quantity, 0),
      containedResidue: state.physicalItemStacks.filter((stack) => stack.containerId === 'basic-13' && stack.key === 'elementalResidue').reduce((sum, stack) => sum + stack.quantity, 0),
      localResidue: state.physicalItemStacks.filter((stack) => stack.containerId === 'basic-13' && stack.section === 'residue').length,
    };
  }, storageKey);
  expect(result.role).toBe('idle');
  expect(result.roomWaste).toBe(4);
  expect(result.pitWaste).toBe(0);
  expect(result.containedResidue).toBeGreaterThanOrEqual(1);
  expect(result.localResidue).toBeGreaterThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});
