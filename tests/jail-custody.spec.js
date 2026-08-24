// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Jail = require('../jail-custody.js');

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

async function bookScientist(page) {
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate((raidId) => {
    window.helixHeresyDebug.placeScientistAtRaidEntry(raidId);
    window.helixHeresyDebug.updateLawEnforcementRaids(1);
    window.helixHeresyDebug.surrenderToRaid(raidId);
    for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateLawEnforcementRaids(1, { defer: index < 7 });
  }, execution.raidId);
  return execution.raidId;
}

test('booking creates a deterministic temporary jail, transport, staff, routine, and suppressor', () => {
  const options = { seed: 'jail-seed', clock: 10_000, raidId: 'raid-1', docket: 'LE-7', roomIds: ['cell', 'corridor'], labSnapshot: { company: 'Axiom Labs', money: 123 } };
  const first = Jail.book(Jail.defaultState(), options);
  const second = Jail.book(Jail.defaultState(), options);
  expect(first.created).toBe(true);
  expect(first.stay).toMatchObject({
    status: 'active', facility: { kind: 'jail' }, detaineeId: 'scientist',
    transport: { vehicleClass: 'armored custody vehicle', arrivedAt: 10_000 },
    suppressor: { kind: 'magicSuppressingCollar', status: 'locked', suppressionActive: true, condition: 100 },
    knowledge: { labSnapshot: { company: 'Axiom Labs', money: 123 } }
  });
  expect(first.stay.actors).toHaveLength(3);
  expect(first.stay.actors.map((actor) => actor.name)).toEqual(second.stay.actors.map((actor) => actor.name));
  expect(Jail.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('communication is delayed, monitored by channel, and delivers only explicit reports', () => {
  let state = Jail.book(Jail.defaultState(), { seed: 'comms', clock: 100, raidId: 'raid-1' }).state;
  const stayId = state.stays[0].id;
  let requested = Jail.requestCommunication(state, stayId, 'companyPortal', 'Axiom Labs', 200);
  state = requested.state;
  expect(requested.request).toMatchObject({ status: 'pending', readyAt: 200 + 4 * 3600, risk: 0 });
  state = Jail.advance(state, requested.request.readyAt).state;
  expect(state.stays[0].communications.requests[0].status).toBe('ready');
  const completed = Jail.completeCommunication(state, stayId, requested.request.id, { clock: requested.request.readyAt, report: { money: 70, undergroundStatus: 'No connection' } });
  expect(completed.session).toMatchObject({ channelId: 'companyPortal', monitored: true });
  expect(completed.stay.knowledge.reports[0]).toMatchObject({ money: 70, undergroundStatus: 'No connection' });
});

test('jail release to escaped status requires the completed physical plan handoff and disables the collar', () => {
  let state = Jail.book(Jail.defaultState(), { seed: 'escape', clock: 100, raidId: 'raid-1' }).state;
  const stayId = state.stays[0].id;
  const first = Jail.observeSecurity(state, stayId, Jail.OBSERVATIONS[0].id, 200);
  state = first.state;
  expect(Jail.observeSecurity(state, stayId, Jail.OBSERVATIONS[0].id, 201).changed).toBe(false);
  expect(Jail.escape(state, stayId, 202).changed).toBe(false);
  const escaped = Jail.escape(state, stayId, 400, { completedPlanId: 'escape-plan-1' });
  expect(escaped.changed).toBe(true);
  expect(escaped.stay).toMatchObject({ status: 'escaped', suppressor: { status: 'disabled', suppressionActive: false, condition: 0 } });
});

test('physical recapture restricts communications and creates a fresh locked suppressor record', () => {
  let state = Jail.book(Jail.defaultState(), { seed: 'recapture', clock: 100, raidId: 'raid-1' }).state;
  const stayId = state.stays[0].id;
  state = Jail.requestCommunication(state, stayId, 'codedContact', 'Sable Underhook', 200).state;
  state = Jail.disableSuppressor(state, stayId, 300, 'Disabled during a failed escape stage.').state;
  const secured = Jail.resecure(state, stayId, 400, { suppressorId: 'replacement-collar', alertGain: 25 });
  expect(secured.stay).toMatchObject({ status: 'active', suppressor: { id: 'replacement-collar', status: 'locked', suppressionActive: true, condition: 100 }, communications: { requests: [expect.objectContaining({ status: 'denied' })] }, knowledge: { facilityAlert: 25 } });
});

test('a released defendant can be physically remanded for the sentencing commitment window', () => {
  let state = Jail.book(Jail.defaultState(), { seed: 'sentence-remand', clock: 100, raidId: 'raid-1' }).state;
  const stayId = state.stays[0].id; state = Jail.release(state, stayId, 200).state;
  const remanded = Jail.remand(state, stayId, 300, { suppressorId: 'sentence-collar', crewNames: ['Mara Vale', 'Ivo Ward'] });
  expect(remanded.stay).toMatchObject({ status: 'active', transport: { label: 'Armored court remand vehicle', crewNames: ['Mara Vale', 'Ivo Ward'] }, suppressor: { id: 'sentence-collar', status: 'locked', suppressionActive: true, appliedAt: 300 } });
  expect(remanded.stay.history.at(-1).action).toBe('sentencingRemand');
});

test('@smoke jail collar is physical, saved, nonterminal, and authoritatively suppresses magic', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);
  await bookScientist(page);
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.jailCustodySnapshot());
  expect(snapshot).toMatchObject({
    runEnded: false, scientist: { roomId: 'municipalHoldingCell', mapCell: { z: 3 } },
    activeStay: { status: 'active', actors: expect.any(Array), suppressor: { status: 'locked', suppressionActive: true, physicalStackId: expect.stringMatching(/^stack-/), toolInstanceId: expect.stringMatching(/^magicSuppressingCollar-/) } }
  });
  expect(snapshot.activeStay.actors).toHaveLength(3);
  expect(snapshot.activeStay.facility.roomIds).toEqual(expect.arrayContaining(['municipalHoldingCallRoom', 'municipalHoldingLegalRoom', 'municipalHoldingGuardStation', 'municipalHoldingExerciseYard']));
  expect(snapshot.magicSuppressionReason).toContain('completely suppresses');
  expect(snapshot.equipment).toContain('Neck: Warded magic-suppressing collar');
  expect(await page.evaluate(() => window.helixHeresyDebug.manaBlockReason(1))).toContain('completely suppresses');
  expect(await page.evaluate((stay) => window.helixHeresyDebug.equipmentChangeBlockReason('magicSuppressingCollar', stay.suppressor.toolInstanceId, 'unequip'), snapshot.activeStay)).toContain('cannot voluntarily remove');
  const jailActors = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().entities.filter((entry) => entry.kind === 'jailOfficer'));
  expect(jailActors).toHaveLength(3);

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate(() => window.helixHeresyDebug.jailCustodySnapshot());
  expect(reloaded).toMatchObject({ runEnded: false, activeStay: { id: snapshot.activeStay.id, suppressor: { suppressionActive: true } } });
});

test('@smoke delayed company access uses a physical jail escort and bounded report', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);
  await bookScientist(page);
  const request = await page.evaluate(() => window.helixHeresyDebug.requestJailCommunication('companyPortal', 'Company operations desk'));
  expect(request).toMatchObject({ channelId: 'companyPortal', status: 'pending', risk: 0 });
  const clock = await page.evaluate(() => window.helixHeresyDebug.jailCustodySnapshot().clock);
  await page.evaluate((seconds) => window.helixHeresyDebug.advanceSimulation(seconds), request.readyAt - clock + 1);
  expect(await page.evaluate((id) => window.helixHeresyDebug.beginJailCommunication(id), request.id)).toBe(true);
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.jailCustodySnapshot());
  expect(snapshot.scientist.roomId).toBe('municipalHoldingCallRoom');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1801));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.jailCustodySnapshot());
  expect(snapshot.scientist.roomId).toBe('municipalHoldingCell');
  expect(snapshot.activeStay.communications.sessions.at(-1)).toMatchObject({ channelId: 'companyPortal', monitored: true });
  expect(snapshot.activeStay.knowledge.reports.at(-1)).toMatchObject({ undergroundStatus: 'No jail network connection to the underground laboratory' });
  expect(snapshot.activeStay.knowledge.reports.at(-1)).not.toHaveProperty('slimes');
});
