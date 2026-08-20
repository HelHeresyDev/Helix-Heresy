// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Pretrial = require('../pretrial-proceedings.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
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

function supportedContext(overrides = {}) {
  return {
    seed: 'court-seed', clock: 1000, raidId: 'raid-1', authorityCaseId: 'case-1', warrantExecutionId: 'warrant-1', docket: 'CR-17',
    authoritySupport: [{ id: 'support-1', sourceId: 'evidence-1', label: 'Animantic research notes', reliability: 'strong', significanceRank: 4, traits: ['animancy', 'research'] }],
    voluntarySurrender: true,
    ...overrides
  };
}

test('charges, officials, counsel, and saved scheduling are deterministic and evidence-linked', () => {
  const first = Pretrial.open(Pretrial.defaultState(), supportedContext());
  const second = Pretrial.open(Pretrial.defaultState(), supportedContext());
  expect(first.created).toBe(true);
  expect(first.proceeding.court).toMatchObject({ judge: { name: second.proceeding.court.judge.name }, prosecutor: { name: second.proceeding.court.prosecutor.name } });
  expect(first.proceeding.charges.map((charge) => charge.typeId)).toEqual(expect.arrayContaining(['prohibitedAnimancy', 'prohibitedResearch']));
  expect(first.proceeding.charges.every((charge) => charge.support.length > 0)).toBe(true);
  expect(first.proceeding.counsel.options.map((option) => option.kind)).toEqual(['public', 'retained', 'self']);
  expect(first.proceeding.history.some((entry) => entry.action === 'voluntarySurrender')).toBe(true);
  expect(Pretrial.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('represented defendants need a privileged conference before a physical first appearance', () => {
  let state = Pretrial.open(Pretrial.defaultState(), supportedContext()).state;
  state = Pretrial.advance(state, 1000 + 3601).state;
  const proceeding = state.proceedings[0];
  const publicCounsel = proceeding.counsel.options.find((option) => option.kind === 'public');
  state = Pretrial.selectCounsel(state, proceeding.id, publicCounsel.id, 5000).state;
  state = Pretrial.advance(state, proceeding.timeline.firstAppearanceAt).state;
  expect(Pretrial.hearingRequirements(state.proceedings[0])).toContain('privileged counsel conference');
  state = Pretrial.recordConference(state, proceeding.id, { clock: 6000, channel: 'legalCounsel' }).state;
  expect(Pretrial.hearingRequirements(state.proceedings[0])).toBe('');
  const begun = Pretrial.beginHearing(state, proceeding.id, 'strictConditions', 10000);
  expect(begun).toMatchObject({ changed: true, proceeding: { firstAppearance: { status: 'inProgress' } } });
});

test('hearing decisions save reasons, bail escrow stays distinct, and fugitive cases continue', () => {
  let state = Pretrial.open(Pretrial.defaultState(), supportedContext({ voluntarySurrender: false })).state;
  const proceedingId = state.proceedings[0].id;
  state = Pretrial.advance(state, 1000 + 3601).state;
  const self = state.proceedings[0].counsel.options.find((option) => option.kind === 'self');
  state = Pretrial.selectCounsel(state, proceedingId, self.id, 1000 + 3601).state;
  state = Pretrial.advance(state, state.proceedings[0].timeline.firstAppearanceAt).state;
  state = Pretrial.beginHearing(state, proceedingId, 'securedBail', state.proceedings[0].timeline.firstAppearanceAt).state;
  const resolved = Pretrial.resolveHearing(state, proceedingId, state.proceedings[0].timeline.firstAppearanceAt + 1000);
  expect(resolved.proceeding.firstAppearance.reasons).toHaveLength(5);
  expect(['securedBail', 'detained']).toContain(resolved.decision);
  if (resolved.decision === 'securedBail') {
    const paid = Pretrial.payBail(resolved.state, proceedingId, 12000);
    expect(paid.proceeding.release).toMatchObject({ status: 'released', escrowStatus: 'held' });
  }
  const fugitive = Pretrial.markFugitive(resolved.state, proceedingId, 12000);
  expect(fugitive.proceeding).toMatchObject({ status: 'fugitive', fugitive: { active: true, benchWarrantStatus: 'issued' } });
  expect(fugitive.proceeding.charges.some((charge) => charge.typeId === 'escapeCustody')).toBe(true);
  let awaiting = Pretrial.open(Pretrial.defaultState(), supportedContext({ raidId: 'raid-2' })).state;
  awaiting = Pretrial.markFugitive(awaiting, awaiting.proceedings[0].id, 2000).state;
  const missed = Pretrial.advance(awaiting, awaiting.proceedings[0].timeline.firstAppearanceAt + 1);
  expect(missed.state.proceedings[0].charges.some((charge) => charge.typeId === 'failureToAppear')).toBe(true);
});

test('@smoke booking opens court, counsel meets privately, and conditional release uses a physical transfer', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);
  await bookScientist(page);
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot());
  expect(snapshot.activeProceeding).toMatchObject({ status: 'chargingPending', court: { judge: { name: expect.any(String) }, prosecutor: { name: expect.any(String) } } });
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3601));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot());
  const proceeding = snapshot.activeProceeding;
  const counsel = proceeding.counsel.options.find((option) => option.kind === 'public');
  expect(await page.evaluate(({ proceedingId, optionId }) => window.helixHeresyDebug.selectPretrialCounsel(proceedingId, optionId), { proceedingId: proceeding.id, optionId: counsel.id })).toBe(true);
  const request = await page.evaluate(({ name }) => window.helixHeresyDebug.requestJailCommunication('legalCounsel', name), { name: counsel.name });
  const clock = await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot().clock);
  await page.evaluate((seconds) => window.helixHeresyDebug.advanceSimulation(seconds), request.readyAt - clock + 1);
  expect(await page.evaluate((id) => window.helixHeresyDebug.beginJailCommunication(id), request.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1801));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot());
  await page.evaluate((seconds) => window.helixHeresyDebug.advanceSimulation(seconds), Math.max(1, snapshot.activeProceeding.timeline.firstAppearanceAt - snapshot.clock + 1));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot());
  expect(snapshot.activeProceeding.counsel.conferences).toHaveLength(1);
  expect(snapshot.activeProceeding.firstAppearance.status).toBe('ready');
  expect(await page.evaluate((id) => window.helixHeresyDebug.beginPretrialHearing(id, 'strictConditions'), proceeding.id)).toBe(true);
  expect((await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot())).scientist.roomId).toBe('municipalHoldingLegalRoom');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2701));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot());
  expect(snapshot.activeProceeding.firstAppearance).toMatchObject({ status: 'completed', decision: 'conditionalRelease' });
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(901));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot());
  expect(snapshot).toMatchObject({ activeProceeding: { release: { status: 'released', transport: { destinationAccessPointId: 'publicEntrance' } } }, scientist: { roomId: 'surfaceReception' } });
  const jail = await page.evaluate(() => window.helixHeresyDebug.jailCustodySnapshot());
  expect(jail.activeStay).toBeNull();
  expect(jail.magicSuppressionReason).toBe('');

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  expect((await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot())).activeProceeding.release.transport.destinationRoomId).toBe('surfaceReception');
});
