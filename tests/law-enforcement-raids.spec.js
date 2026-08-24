// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Raids = require('../law-enforcement-raids.js');

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
  await page.locator('#startRunSubmitBtn').click();
}

function execution(overrides = {}) {
  return {
    id: 'warrant-execution-1', actionId: 'institution-action-1', caseId: 'authority-case-1',
    institutionId: 'law-enforcement', docket: 'LE-0001', issuedAt: 100, status: 'deferred',
    ...overrides
  };
}

test('law-enforcement warrants authorize deterministic named physical raid teams', () => {
  const options = {
    seed: 'raid-seed', clock: 100,
    authorizedRoomIds: ['surfaceReception', 'surfaceStaffOperations'],
    knownRoomIds: ['surfaceReception']
  };
  const first = Raids.authorize(Raids.defaultState(), execution(), options);
  const second = Raids.authorize(Raids.defaultState(), execution(), options);
  expect(first.created).toBe(true);
  expect(first.raid).toMatchObject({
    status: 'scheduled', docket: 'LE-0001', authorizedRoomIds: options.authorizedRoomIds,
    knownRoomIds: options.knownRoomIds,
    custody: { status: 'free', targetActorId: 'scientist' }
  });
  expect(first.raid.arrivalAt).toBe(second.raid.arrivalAt);
  expect(first.raid.actors.map((actor) => actor.role)).toEqual(['commander', 'breach', 'arrest', 'security']);
  expect(new Set(first.raid.actors.map((actor) => actor.name)).size).toBe(4);
  expect(first.raid.objectives).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'arrestActor', targetId: 'scientist', priority: 'primary' }),
    expect.objectContaining({ kind: 'seizeEvidence', priority: 'secondary' })
  ]));
  expect(Raids.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('surrender requires physical restraint and booking preserves a living detained run state', () => {
  let state = Raids.authorize(Raids.defaultState(), execution(), { seed: 'custody', clock: 100 }).state;
  const raidId = state.raids[0].id;
  state = Raids.activate(state, raidId, { clock: 200, entryCell: { x: 1, y: 2, z: 1 }, roomId: 'surfaceReception' }).state;
  state = Raids.recordSighting(state, raidId, { clock: 201, actorId: `${raidId}-commander`, cell: { x: 2, y: 2, z: 1 } }).state;
  state = Raids.surrender(state, raidId, 202).state;
  expect(state.raids[0]).toMatchObject({ status: 'arresting', custody: { status: 'surrendered', restraintProgress: 0 } });

  state = Raids.progressRestraint(state, raidId, { clock: 203, actorId: `${raidId}-arrest`, amount: 60 }).state;
  expect(state.raids[0].custody).toMatchObject({ status: 'restraining', restraintProgress: 60 });
  state = Raids.progressRestraint(state, raidId, { clock: 204, actorId: `${raidId}-arrest`, amount: 40 }).state;
  expect(state.raids[0]).toMatchObject({ status: 'extracting', custody: { status: 'restrained', restrainedAt: 204 } });

  state = Raids.extract(state, raidId, 220).state;
  state = Raids.book(state, raidId, { clock: 300 }).state;
  expect(state.raids[0]).toMatchObject({
    status: 'booked', custody: { status: 'booked', bookedAt: 300 },
    detention: { status: 'pretrial', cellRoomId: 'municipalHoldingCell' },
    outcome: { kind: 'booked' }
  });
  expect(state.raids[0].outcome.summary).toContain('run continues');
});

test('revoked surrender and lethal force preserve their exact causal records', () => {
  let state = Raids.authorize(Raids.defaultState(), execution(), { seed: 'resistance', clock: 100 }).state;
  const raidId = state.raids[0].id;
  state = Raids.activate(state, raidId, { clock: 200, entryCell: { x: 1, y: 2, z: 1 }, roomId: 'surfaceReception' }).state;
  state = Raids.surrender(state, raidId, 201).state;
  state = Raids.revokeSurrender(state, raidId, 202).state;
  state = Raids.escalateForce(state, raidId, {
    clock: 203, kind: 'violentResistance', witnessActorId: `${raidId}-security`,
    responsibleActorId: 'scientist', reason: 'The scientist attacked an officer with lethal force.'
  }).state;
  expect(state.raids[0]).toMatchObject({
    status: 'contact', custody: { status: 'free', restraintProgress: 0 },
    force: { posture: 'lethal', triggerKind: 'violentResistance', responsibleActorId: 'scientist' }
  });
  expect(state.raids[0].history.map((entry) => entry.action)).toEqual(expect.arrayContaining(['surrenderRevoked', 'lethalForceAuthorized']));
});

test('detention release to fugitive state requires a completed causal escape plan', () => {
  let state = Raids.authorize(Raids.defaultState(), execution(), { seed: 'escape', clock: 100 }).state;
  const raidId = state.raids[0].id;
  state = Raids.activate(state, raidId, { clock: 200, entryCell: { x: 1, y: 2, z: 1 }, roomId: 'surfaceReception' }).state;
  state = Raids.surrender(state, raidId, 201).state;
  state = Raids.progressRestraint(state, raidId, { clock: 202, actorId: `${raidId}-arrest`, amount: 100 }).state;
  state = Raids.extract(state, raidId, 220).state;
  state = Raids.book(state, raidId, { clock: 300 }).state;
  expect(Raids.escapeDetention(state, raidId, 301).changed).toBe(false);
  state = Raids.escapeDetention(state, raidId, 400, { completedPlanId: 'escape-plan-1' }).state;
  expect(state.raids[0]).toMatchObject({ status: 'escaped', custody: { status: 'escaped' }, detention: { status: 'escaped', securityStudyProgress: 0, alert: 0 }, outcome: { summary: expect.stringContaining('escape-plan-1') } });
});

test('a released raid custody record can reopen only as a physical sentencing hold', () => {
  let state = Raids.authorize(Raids.defaultState(), execution(), { seed: 'sentence-remand', clock: 100 }).state;
  const raidId = state.raids[0].id;
  state = Raids.activate(state, raidId, { clock: 200, entryCell: { x: 1, y: 2, z: 1 }, roomId: 'surfaceReception' }).state;
  state = Raids.recordSighting(state, raidId, { clock: 201, actorId: state.raids[0].actors[0].id, cell: { x: 1, y: 2, z: 1 }, roomId: 'surfaceReception' }).state;
  state = Raids.surrender(state, raidId, 202).state;
  state = Raids.progressRestraint(state, raidId, { clock: 210, actorId: `${raidId}-arrest`, amount: 100 }).state;
  state = Raids.extract(state, raidId, 220).state;
  state = Raids.book(state, raidId, { clock: 300 }).state;
  state = Raids.releaseDetention(state, raidId, 400).state;
  const remanded = Raids.remandForSentence(state, raidId, 500);
  expect(remanded.raid).toMatchObject({ status: 'booked', custody: { status: 'booked', bookedAt: 500 }, detention: { status: 'sentencingHold', bookingAt: 500 }, outcome: { kind: 'sentencingRemand' } });
  const escaped = Raids.escapeDetention(remanded.state, raidId, 600, { completedPlanId: 'post-verdict-escape-1' });
  expect(escaped.raid).toMatchObject({ status: 'escaped', detention: { status: 'escaped' }, outcome: { summary: expect.stringContaining('post-verdict-escape-1') } });
});

test('exact responsive seizures and unobserved site escape remain nonterminal outcomes', () => {
  let state = Raids.authorize(Raids.defaultState(), execution(), { seed: 'seizure-escape', clock: 100 }).state;
  const raidId = state.raids[0].id;
  state = Raids.activate(state, raidId, { clock: 200, entryCell: { x: 1, y: 2, z: 1 }, roomId: 'surfaceReception' }).state;
  state = Raids.recordSeizure(state, raidId, {
    clock: 210, actorId: `${raidId}-commander`, subjectId: 'stack-evidence-1', sourceSubjectId: 'stack-source-1',
    label: 'Responsive sample', quantity: 1, roomId: 'surfaceReception'
  }).state;
  state = Raids.externalizeSeizures(state, raidId, 220).state;
  state = Raids.escapeSite(state, raidId, 230).state;
  expect(state.raids[0]).toMatchObject({
    status: 'escaped', custody: { status: 'escaped' }, outcome: { kind: 'escapedSite' },
    seizures: [{ subjectId: 'stack-evidence-1', status: 'externalized', externalizedAt: 220 }]
  });
});

test('scientist death is recorded separately from every custody outcome', () => {
  let state = Raids.authorize(Raids.defaultState(), execution(), { seed: 'raid-death', clock: 100 }).state;
  const raidId = state.raids[0].id;
  state = Raids.activate(state, raidId, { clock: 200, entryCell: { x: 1, y: 2, z: 1 }, roomId: 'surfaceReception' }).state;
  const result = Raids.recordScientistDeath(state, raidId, { clock: 240, summary: 'A recorded fatal raid injury ended the run.' });
  expect(result.changed).toBe(true);
  expect(result.raid).toMatchObject({
    status: 'completed', custody: { status: 'free' },
    outcome: { kind: 'scientistKilled', summary: 'A recorded fatal raid injury ended the run.' }
  });
  expect(result.raid.history.at(-1)).toMatchObject({ action: 'scientistKilled' });
});

test('@smoke a physical surrender is restrained, extracted, and booked without ending the run', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  expect(execution).toMatchObject({ status: 'deferred', raidId: expect.stringMatching(/^law-enforcement-raid-/) });

  await page.evaluate((raidId) => {
    window.helixHeresyDebug.placeScientistAtRaidEntry(raidId);
    window.helixHeresyDebug.updateLawEnforcementRaids(1);
  }, execution.raidId);
  let raid = await page.evaluate((raidId) => window.helixHeresyDebug.lawEnforcementRaidsSnapshot().raids.find((entry) => entry.id === raidId), execution.raidId);
  expect(raid.status).toBe('contact');
  expect(raid.actors.every((actor) => actor.present)).toBe(true);

  await page.evaluate((raidId) => window.helixHeresyDebug.surrenderToRaid(raidId), execution.raidId);
  await page.evaluate(() => {
    for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateLawEnforcementRaids(1, { defer: index < 7 });
  });
  const booked = await page.evaluate(() => window.helixHeresyDebug.lawEnforcementRaidsSnapshot());
  raid = booked.raids.find((entry) => entry.id === execution.raidId);
  expect(raid).toMatchObject({
    status: 'booked', custody: { status: 'booked' }, detention: { status: 'pretrial', cellRoomId: 'municipalHoldingCell' },
    outcome: { kind: 'booked' }
  });
  expect(booked).toMatchObject({ runEnded: false, scientist: { roomId: 'municipalHoldingCell', mapCell: { z: 3 } } });

  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator(`[data-raid-id="${execution.raidId}"]`)).toContainText('arrest is not defeat');
  await expect(page.locator(`[data-raid-id="${execution.raidId}"] button`, { hasText: 'Observe Cell-door procedure' })).toBeVisible();

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate(() => window.helixHeresyDebug.lawEnforcementRaidsSnapshot());
  expect(reloaded).toMatchObject({ runEnded: false, detentionRaid: { id: execution.raidId, status: 'booked' }, scientist: { roomId: 'municipalHoldingCell' } });

});

test('a concealed scientist is not tracked through walls and survives an unsuccessful physical search', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate(() => {
    for (let index = 0; index < 30; index += 1) window.helixHeresyDebug.updateLawEnforcementRaids(300, { defer: index < 29 });
  });
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.lawEnforcementRaidsSnapshot());
  const raid = snapshot.raids.find((entry) => entry.id === execution.raidId);
  expect(raid).toMatchObject({ status: 'completed', custody: { status: 'free' }, outcome: { kind: 'targetNotLocated' } });
  expect(raid.communication.lastKnownCell).toBeNull();
  expect(raid.clearedRoomIds).toEqual(expect.arrayContaining(raid.authorizedRoomIds));
  expect(snapshot).toMatchObject({ runEnded: false, scientist: { roomId: 'mainLab' } });
});
