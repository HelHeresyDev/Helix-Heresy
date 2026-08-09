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

async function saveContext(page) {
  return page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      seed: state.seed,
      complexity: state.complexity || 'clean',
      currentGenome: state.currentGenome || 'A'.repeat(26),
    };
  }, { key: storageKey });
}

function livingSlimeFixture({ id, name, genome, containerId = 'basic-1', roomId = 'mainLab', stats = {} }) {
  return {
    id,
    name,
    genome,
    source: 'Specimen harvest fixture',
    createdAt: 0,
    deathAt: 10000,
    lifecycleVersion: 1,
    matureAt: 0,
    mature: true,
    status: 'contained',
    containerId,
    roomId,
    automationExcluded: false,
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
  };
}

async function finishQueuedTask(page, label) {
  if (!await page.locator('#taskList').isVisible()) {
    await page.locator('#queueToggleBtn').click();
  }
  const taskRow = page.locator('#taskList .task-row').filter({ hasText: label }).first();
  await expect(taskRow).toBeVisible();
  await taskRow.getByRole('button', { name: 'Finish' }).click();
}

test('sampling a living specimen stores harvested material and worsens condition', async ({ page }) => {
  test.setTimeout(90_000);
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      size: 'seedling',
      shape: 'spherical',
      element: 'acid',
      consistency: 'watery',
    },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!jar) {
      throw new Error('basic-1 container not found');
    }
    jar.roomId = 'mainLab';
    state.started = true;
    state.paused = true;
    state.selectedSlimeId = 'harvest-live';
    state.tasks = [];
    state.specimenMaterials = {};
    state.scientist ||= {};
    state.scientist.vitals ||= {};
    state.scientist.vitals.stamina = { current: 100, max: 100 };
    state.slimes = [
      {
        id: 'harvest-live',
        name: 'HAR-LIVE',
        genome,
        source: 'Specimen harvest fixture',
        createdAt: 0,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: jar.id,
        roomId: jar.roomId,
        automationExcluded: false,
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {
          bodyIntegrity: { current: 80, max: 100 },
          nutrition: { current: 50, max: 100 },
          currentMass: { current: 100, max: 100 },
          divisionPressure: { current: 0, max: 100 },
          stress: { current: 5, max: 100 },
        },
        revealed: {},
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {},
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="specimens"]').click();
  const selectedCard = page.locator('[data-slime-card="harvest-live"]');
  await selectedCard.getByRole('button', { name: /Sample Living Tissue/ }).click();
  await finishQueuedTask(page, 'Sample Living Tissue');

  await expect(page.locator('#inventoryList')).toContainText('Harvested Specimen Materials');
  await expect(page.locator('#inventoryList')).toContainText('Caustic tissue');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((item) => item.id === 'harvest-live');
    return {
      entries: Object.values(state.specimenMaterials || {}),
      bodyIntegrity: slime?.stats?.bodyIntegrity?.current,
      currentMass: slime?.stats?.currentMass?.current,
      stress: slime?.stats?.stress?.current,
      welfare: window.helixHeresyDebug.welfareSnapshot('harvest-live'),
    };
  }, { key: storageKey });

  expect(result.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      label: 'Caustic tissue',
      amount: expect.any(Number),
      tags: expect.arrayContaining(['caustic', 'fluid', 'living', 'sample']),
    }),
  ]));
  expect(result.entries[0].amount).toBeGreaterThan(0);
  expect(result.bodyIntegrity).toBe(78);
  expect(result.currentMass).toBe(99);
  expect(result.stress).toBeGreaterThanOrEqual(9);
  expect(result.stress).toBeLessThan(9.1);
  expect(result.welfare.record.interventions).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'harvest:sample', burden: 18 }),
  ]));
  expect(result.welfare.record.history.at(-1).summary).toContain('Sample');

  await finishQueuedTask(page, 'Store 1 Caustic tissue');
  await page.locator('[data-workspace-tab="specimens"]').click();
  await page.locator('[data-creature-record-tab="testing"]').click();
  const stressButton = page.locator('#testButtons').getByRole('button', { name: /Stress Test/ });
  await expect(stressButton).toBeDisabled();
  const researchSetup = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    const before = debug.researchSnapshot();
    const evidence = [
      { methodId: 'containment', specimenId: 'evidence-a', specimenName: 'EVA', sourceKey: 'fixture:containment:a' },
      { methodId: 'containment', specimenId: 'evidence-b', specimenName: 'EVB', sourceKey: 'fixture:containment:b' },
      { methodId: 'behavior', specimenId: 'evidence-a', specimenName: 'EVA', sourceKey: 'fixture:behavior:a' },
      { methodId: 'behavior', specimenId: 'evidence-b', specimenName: 'EVB', sourceKey: 'fixture:behavior:b' },
    ];
    for (const entry of evidence) {
      debug.recordResearchEvidence({ ...entry, category: 'test', summary: 'Deterministic research fixture observation.' });
    }
    debug.addResearchResource('geneticMaterial', 1);
    return {
      harvestRecorded: before.evidence.some((entry) => entry.category === 'harvest' && entry.specimenId === 'harvest-live'),
      lockedBefore: !debug.researchUnlockKnown('test:stress'),
    };
  });
  expect(researchSetup).toEqual({ harvestRecorded: true, lockedBefore: true });

  await page.locator('[data-workspace-tab="research"]').click();
  const projectCard = page.locator('[data-research-project="controlledStress"]');
  await expect(projectCard).toContainText('Containment observations from two specimens — 2/2 observations; 2/2 specimens');
  await expect(projectCard).toContainText('Behavior observations from two specimens — 2/2 observations; 2/2 specimens');
  await projectCard.getByRole('button', { name: 'Start Project' }).click();

  const activeResearch = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((entry) => entry.type === 'researchWork');
    return {
      activeProjectId: state.research?.activeProjectId,
      status: state.research?.projects?.controlledStress?.status,
      pathLength: task?.data?.mapPath?.length || 0,
      reservedStackCount: task?.data?.reservedStackIds?.length || 0,
      workStartsAfterCreation: task?.data?.workStartsAt > task?.createdAt,
    };
  }, { key: storageKey });
  expect(activeResearch).toEqual({
    activeProjectId: 'controlledStress',
    status: 'active',
    pathLength: expect.any(Number),
    reservedStackCount: 2,
    workStartsAfterCreation: true,
  });
  expect(activeResearch.pathLength).toBeGreaterThan(1);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((entry) => entry.type === 'researchWork');
    window.helixHeresyDebug.advanceSimulation(Math.max(1, task.data.workStartsAt - state.clock + 15));
  }, { key: storageKey });
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Controlled Stress Methodology' })
    .getByRole('button', { name: 'Cancel' }).click();
  const pausedResearch = await page.evaluate(() => {
    const record = window.helixHeresyDebug.researchSnapshot().projects.controlledStress;
    return { status: record.status, progressSeconds: record.progressSeconds, inputsConsumed: record.inputsConsumed };
  });
  expect(pausedResearch.status).toBe('paused');
  expect(pausedResearch.progressSeconds).toBeGreaterThan(0);
  expect(pausedResearch.progressSeconds).toBeLessThan(90);
  expect(pausedResearch.inputsConsumed).toBe(true);

  await page.locator('[data-workspace-tab="research"]').click();
  await projectCard.getByRole('button', { name: 'Resume Project' }).click();
  const resumedReservationCount = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return (state.tasks || []).find((entry) => entry.type === 'researchWork')?.data?.reservedStackIds?.length;
  }, { key: storageKey });
  expect(resumedReservationCount).toBe(0);

  await finishQueuedTask(page, 'Controlled Stress Methodology');
  const completedResearch = await page.evaluate(() => {
    const snapshot = window.helixHeresyDebug.researchSnapshot();
    return {
      activeProjectId: snapshot.activeProjectId,
      status: snapshot.projects.controlledStress.status,
      progressSeconds: snapshot.projects.controlledStress.progressSeconds,
      inputsConsumed: snapshot.projects.controlledStress.inputsConsumed,
      unlocked: window.helixHeresyDebug.researchUnlockKnown('test:stress'),
      evidenceCount: snapshot.evidence.length,
    };
  });
  expect(completedResearch).toEqual({
    activeProjectId: '',
    status: 'completed',
    progressSeconds: 90,
    inputsConsumed: true,
    unlocked: true,
    evidenceCount: 5,
  });

  await page.locator('[data-workspace-tab="specimens"]').click();
  await page.locator('[data-creature-record-tab="testing"]').click();
  await expect(page.locator('#testButtons').getByRole('button', { name: /Stress Test/ })).toBeEnabled();

  const experimentSetup = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    const subject = debug.createSpatialTestSlime({ size: 'seedling' });
    const experimentId = debug.createExperimentDraft({
      title: 'Controlled acid comparison',
      hypothesis: 'The harvested acid-line genome produces a different visible phenotype.',
      variableType: 'genome',
      controlId: 'harvest-live',
      subjectValues: [subject.id],
    });
    const started = debug.startExperiment(experimentId);
    const experiment = debug.experimentSnapshot().experiments.find((entry) => entry.id === experimentId);
    return {
      experimentId,
      subjectId: subject.id,
      started,
      status: experiment.status,
      baseline: experiment.baselineSnapshots,
      formalControl: experiment.formalControl,
    };
  });
  expect(experimentSetup.started).toBe(true);
  expect(experimentSetup.status).toBe('running');
  expect(experimentSetup.formalControl).toBe(true);
  expect(Object.keys(experimentSetup.baseline)).toHaveLength(2);

  await page.locator('[data-workspace-tab="research"]').click();
  const experimentCard = page.locator(`[data-experiment-id="${experimentSetup.experimentId}"]`);
  await expect(experimentCard).toContainText('Evidence coverage: 0/2');

  for (const expectedCoverage of [1, 2]) {
    const queuedLabel = await page.evaluate((experimentId) => {
      const debug = window.helixHeresyDebug;
      if (!debug.queueExperimentNextStep(experimentId)) throw new Error('Experiment next step was not queued.');
      const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
      const state = payload.state || payload;
      return state.tasks.find((task) => task.data?.experimentId === experimentId)?.label || '';
    }, experimentSetup.experimentId);
    expect(queuedLabel).not.toBe('');
    await finishQueuedTask(page, queuedLabel);
    await page.locator('[data-workspace-tab="research"]').click();
    await expect(experimentCard).toContainText(`Evidence coverage: ${expectedCoverage}/2`);
  }

  const firstConclusion = await page.evaluate((experimentId) => {
    const debug = window.helixHeresyDebug;
    const queued = debug.queueExperimentConclusion(experimentId, 'supports');
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const state = payload.state || payload;
    const task = state.tasks.find((entry) => entry.type === 'experimentConclusion');
    const experiment = debug.experimentSnapshot().experiments.find((entry) => entry.id === experimentId);
    const fixture = state.fixtures.find((entry) => entry.id === task?.data?.workstationId);
    const status = debug.taskStatusSnapshot().find((entry) => entry.id === task?.id)?.status;
    return { queued, label: task?.label || '', taskId: task?.id || '', pathLength: task?.data?.mapPath?.length || 0, status, experimentStatus: experiment?.status, conclusionTaskId: experiment?.conclusionTaskId, workstationState: fixture?.operationalState };
  }, experimentSetup.experimentId);
  expect(firstConclusion).toEqual(expect.objectContaining({
    queued: true,
    status: expect.objectContaining({ id: 'active' }),
    experimentStatus: 'concluding',
    conclusionTaskId: firstConclusion.taskId,
    workstationState: 'operational',
  }));
  expect(firstConclusion.pathLength).toBeGreaterThan(0);

  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('#taskList .task-row').filter({ hasText: firstConclusion.label })
    .getByRole('button', { name: 'Cancel' }).click();
  expect(await page.evaluate((experimentId) => window.helixHeresyDebug.experimentSnapshot().experiments
    .find((entry) => entry.id === experimentId)?.status, experimentSetup.experimentId)).toBe('running');

  const finalConclusionLabel = await page.evaluate((experimentId) => {
    const debug = window.helixHeresyDebug;
    if (!debug.queueExperimentConclusion(experimentId, 'supports')) throw new Error('Experiment conclusion was not re-queued.');
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const state = payload.state || payload;
    return state.tasks.find((task) => task.type === 'experimentConclusion')?.label || '';
  }, experimentSetup.experimentId);
  await finishQueuedTask(page, finalConclusionLabel);

  const completedExperiment = await page.evaluate((experimentId) => {
    const debug = window.helixHeresyDebug;
    const experiment = debug.experimentSnapshot().experiments.find((entry) => entry.id === experimentId);
    const serialized = JSON.stringify(experiment);
    return {
      status: experiment.status,
      conclusion: experiment.conclusion,
      baseline: experiment.baselineSnapshots,
      finalCount: Object.keys(experiment.finalSnapshots).length,
      confidenceLabel: experiment.comparison?.confidenceLabel,
      comparisonSources: experiment.comparison?.evidenceSourceKeys?.length || 0,
      evidenceRecorded: debug.researchSnapshot().evidence.some((entry) => entry.sourceKey === `experiment:${experimentId}`),
      leakedHiddenEvaluation: serialized.includes('evaluated') || serialized.includes('traitMaps'),
    };
  }, experimentSetup.experimentId);
  expect(completedExperiment).toEqual(expect.objectContaining({
    status: 'completed',
    conclusion: 'supports',
    baseline: experimentSetup.baseline,
    finalCount: 2,
    confidenceLabel: expect.any(String),
    comparisonSources: 2,
    evidenceRecorded: true,
    leakedHiddenEvaluation: false,
  }));
  await page.locator('[data-workspace-tab="research"]').click();
  await expect(experimentCard).toContainText('Supports hypothesis');
  await expect(experimentCard).toContainText('Known genome differences');

  const plannedExperiment = await page.evaluate(({ genome }) => {
    const debug = window.helixHeresyDebug;
    const id = debug.createExperimentDraft({
      title: 'Planned genome synthesis',
      hypothesis: 'A newly synthesized planned genome can be observed.',
      variableType: 'genome',
      subjectValues: [`planned:${genome}`],
    });
    debug.startExperiment(id);
    if (!debug.queueExperimentNextStep(id)) throw new Error('Planned subject synthesis was not queued.');
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const state = payload.state || payload;
    const task = state.tasks.find((entry) => entry.data?.experimentId === id || entry.data?.continuation?.task?.data?.experimentId === id);
    return { id, taskType: task?.data?.continuation?.task?.type || task?.type, taskLabel: task?.label || '' };
  }, { genome: context.currentGenome });
  expect(plannedExperiment.taskType).toBe('synthesize');
  await finishQueuedTask(page, plannedExperiment.taskLabel);
  const synthesisFollowupLabel = await page.evaluate((experimentId) => {
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const state = payload.state || payload;
    return state.tasks.find((entry) => entry.type === 'synthesize' && entry.data?.experimentId === experimentId)?.label || '';
  }, plannedExperiment.id);
  if (synthesisFollowupLabel) await finishQueuedTask(page, synthesisFollowupLabel);
  const resolvedPlannedExperiment = await page.evaluate((experimentId) => {
    const debug = window.helixHeresyDebug;
    const experiment = debug.experimentSnapshot().experiments.find((entry) => entry.id === experimentId);
    const subject = experiment.subjects[0];
    const result = {
      status: experiment.status,
      synthesizedSlimeId: subject.synthesizedSlimeId,
      baselineCount: Object.keys(experiment.baselineSnapshots).length,
    };
    debug.abandonExperiment(experimentId);
    return result;
  }, plannedExperiment.id);
  expect(resolvedPlannedExperiment).toEqual({
    status: 'running',
    synthesizedSlimeId: expect.stringMatching(/^slime-/),
    baselineCount: 1,
  });

  await loadSavedRun(page);
  const reloadedExperiments = await page.evaluate(() => window.helixHeresyDebug.experimentSnapshot().experiments
    .map((entry) => ({ id: entry.id, status: entry.status })));
  expect(reloadedExperiments).toEqual(expect.arrayContaining([
    { id: experimentSetup.experimentId, status: 'completed' },
    { id: plannedExperiment.id, status: 'abandoned' },
  ]));

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('breaking down a living specimen consumes it and stores specimen material', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'none', consistency: 'fibrous gel' },
  });

  await page.evaluate(({ key, slime }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!jar) {
      throw new Error('basic-1 container not found');
    }
    state.started = true;
    state.paused = true;
    state.selectedSlimeId = slime.id;
    state.tasks = [];
    state.specimenMaterials = {};
    state.scientist ||= {};
    state.scientist.vitals ||= {};
    state.scientist.vitals.stamina = { current: 100, max: 100 };
    state.slimes = [{ ...slime, containerId: jar.id, roomId: jar.roomId }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, {
    key: storageKey,
    slime: livingSlimeFixture({
      id: 'harvest-terminal',
      name: 'HAR-END',
      genome,
      stats: {
        bodyIntegrity: { current: 90, max: 100 },
        nutrition: { current: 70, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
    }),
  });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="specimens"]').click();
  await page.locator('[data-slime-card="harvest-terminal"]').getByRole('button', { name: /Break Down Specimen/ }).click();
  await finishQueuedTask(page, 'Break Down Specimen');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      livingIds: (state.slimes || []).map((slime) => slime.id),
      entries: Object.values(state.specimenMaterials || {}),
    };
  }, { key: storageKey });

  expect(result.livingIds).not.toContain('harvest-terminal');
  expect(result.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      label: 'Slime fibers',
      tags: expect.arrayContaining(['fibrous', 'living', 'breakdown']),
    }),
  ]));
});

test('breaking down a corpse removes the corpse and stores harvested material', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'none', consistency: 'crystalline gel' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.started = true;
    state.paused = true;
    state.clock = 10;
    state.tasks = [];
    state.slimes = [];
    state.specimenMaterials = {};
    state.scientist ||= {};
    state.scientist.vitals ||= {};
    state.scientist.vitals.stamina = { current: 100, max: 100 };
    state.corpses = [
      {
        id: 'corpse-harvest',
        specimenId: 'dead-harvest',
        name: 'HAR-DEAD',
        genome,
        source: 'Specimen harvest fixture',
        deathReason: 'fixture',
        diedAt: 0,
        roomId: 'mainLab',
        containerId: null,
        storage: 'drum',
        consumedProgress: 0,
        ruined: false,
        harvestedProcedures: {},
        revealed: {},
        measured: {},
        traitObservations: {},
        testsRun: [],
        necropsyReport: '',
        freshUntil: 120 * 60,
        spoiledAt: 240 * 60,
        lastFreshness: 'fresh',
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="specimens"]').click();
  await page.locator('[data-corpse-card="corpse-harvest"]').getByRole('button', { name: /Break Down Corpse/ }).click();
  await finishQueuedTask(page, 'Break Down Corpse');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      corpseIds: (state.corpses || []).map((corpse) => corpse.id),
      entries: Object.values(state.specimenMaterials || {}),
    };
  }, { key: storageKey });

  expect(result.corpseIds).not.toContain('corpse-harvest');
  expect(result.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      label: 'Crystal shards',
      tags: expect.arrayContaining(['crystalline', 'corpse', 'fresh', 'breakdown']),
    }),
  ]));
});
