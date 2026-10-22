const { test, expect } = require('@playwright/test');
const { setup, snap, tick, walk, until } = require('./helpers/away-operation');
const { reload } = require('./helpers/field-station');
test.setTimeout(1200000);
const regional = page => page.evaluate(() => window.helixHeresyDebug.regionalOperationsSnapshot());
const assistant = page => page.evaluate(() => window.helixHeresyDebug.laboratoryAssistantSnapshot());
const action = (page, verb, id, options = {}) => page.evaluate(({ verb, id, options }) => window.helixHeresyDebug.regionalOperationAction(verb, id, options), { verb, id, options });

async function prepareHome(page) {
  // Both established sites and a prior finite employment are explicit inputs.
  // Hire/arrival/assignment/pickup still exercise their actual consumers; no
  // assay result, delivery, node account or independence outcome is injected.
  const player = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const player = { scientist: s.scientist, survey: s.surveyExpeditions, passenger: s.intercityPassenger, connection: s.passengerConnection };
    s.surveyExpeditions.phase = 'home'; s.intercityPassenger.phase = 'home'; s.passengerConnection = null;
    d.importSurveyExpeditionTestState(s);
    d.setLeasedAnnexTestSupport({ atLoading: true });
    d.setStrategicServiceTestNetwork({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Local city', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true }
    ] }, 'regional-original-home');
    return player;
  });
  const portion = await page.evaluate(() => window.helixHeresyDebug.configureLaboratoryAssistantTestSupport());
  expect(portion).toBeTruthy();
  expect(await page.evaluate(() => window.helixHeresyDebug.laboratoryAssistantAction('quote', { hours: 2 })), JSON.stringify(await assistant(page))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.laboratoryAssistantAction('hire', { consent: true }))).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug; d.setDoorLockPhysicalState('door-surface-loading', 'unlocked');
    d.advanceLaboratoryAssistantForTest(920); d.setLaboratoryAssistantForTest({ nearby: true });
  });
  expect((await assistant(page)).saved.contract.status).toBe('onSite');
  expect(await page.evaluate(stackId => window.helixHeresyDebug.laboratoryAssistantAction('assign', { stackId }), portion)).toBe(true);
  await page.evaluate(player => {
    const d = window.helixHeresyDebug; d.advanceLaboratoryAssistantForTest(100);
    d.setLaboratoryAssistantForTest({ toolCondition: 0 });
    const s = d.exportSurveyExpeditionTestState(); s.scientist = player.scientist; s.surveyExpeditions = player.survey;
    s.intercityPassenger = player.passenger; s.passengerConnection = player.connection;
    d.importSurveyExpeditionTestState(s);
  }, player);
}

async function pairOriginalDevices(page) {
  const residence = (await snap(page)).resident.resident.plan;
  await walk(page, residence.roomId, residence.doorPort);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    for (let n = 0; n < 2; n++) s.physicalItemStacks.push({ id: `stack-${s.nextPhysicalItemStackNumber++}`,
      key: 'satelliteCommunicator', quantity: 1, knownQuantity: 1, section: 'inventory', carriedBy: 'scientist',
      roomId: s.scientist.roomId, cell: s.scientist.mapCell, sourceLabels: ['Explicit previously purchased finite regional communicators'] });
    d.importSurveyExpeditionTestState(s);
  });
  for (const verb of ['giveRadio', 'pair', 'toggleSender'])
    expect(await page.evaluate(verb => window.helixHeresyDebug.caretakerCommunicationsAction(verb), verb)).toBe(true);
}

for (const renderer of ['canvas', 'dom']) test(`${renderer}: independently addressed original laboratory and refuge retain local work, losses, custody, money and dated reports`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const f = await setup(page, renderer, prepareHome, pairOriginalDevices);
  let r = await regional(page), away = await snap(page), lab = await assistant(page);
  expect(r.saved.nodes).toHaveLength(2);
  const homeId = r.saved.nodes.find(n => n.kind === 'laboratory').id, awayId = away.saved.id;
  const workerId = lab.saved.actor.id, orderId = lab.saved.orders[0].id, caretakerId = away.resident.actor.id;
  const knownLab = lab.known, partial = lab.saved.orders[0].workSeconds;
  expect(lab.saved.orders[0].status).toBe('active');
  expect(await action(page, 'inspect', homeId)).toBe(false);
  expect(await action(page, 'settle', homeId)).toBe(false);
  expect(await action(page, 'withdraw', homeId)).toBe(false);
  await page.getByRole('button', { name: 'View operation: Supplied Wilderness Refuge', exact: true }).click();
  await page.getByRole('button', { name: 'Request paired report for this operation', exact: true }).click();
  expect((await page.evaluate(() => window.helixHeresyDebug.caretakerCommunicationsSnapshot())).public.issued).toHaveLength(1);
  expect(await action(page, 'report', awayId)).toBe(false);
  expect(await action(page, 'accept', 'not-an-operation', { deposit: 300 })).toBe(false);
  const beforeSelection = await regional(page);
  await page.getByRole('button', { name: 'View operation: Original laboratory', exact: true }).click();
  r = await regional(page); expect(r.saved.selectedId).toBe(homeId); expect(r.cell).toEqual(beforeSelection.cell);
  expect(r.money).toBe(beforeSelection.money); expect(r.saved.nodes).toEqual(beforeSelection.saved.nodes);
  expect(await action(page, 'review', awayId)).toBe(true); away = await snap(page);
  expect(await action(page, 'accept', awayId, { expected: away.saved.quote, deposit: 300 })).toBe(true);
  await walk(page, f.room, f.away);
  // The heartbeat still uses single-second ground work internally; avoid
  // redrawing unrelated panels after every ten simulated road seconds.
  away = await until(page, s => s.saved.mission.phase === 'returned', 60, 60);
  expect(away.saved.mission.deliveredAt).not.toBeNull();
  lab = await assistant(page);
  expect(lab.saved.actor.id).toBe(workerId); expect(lab.saved.orders[0].id).toBe(orderId);
  expect(lab.saved.orders[0].workSeconds).toBe(partial); expect(lab.saved.orders[0].result).toBeNull();
  expect(lab.saved.orders[0].reason).toContain('broken');
  expect(away.resident.actor.id).toBe(caretakerId); expect(away.context.supported).toBe(true);
  expect(away.resident.resident.earned).toBeGreaterThan(0);
  const comms = await page.evaluate(() => window.helixHeresyDebug.caretakerCommunicationsSnapshot());
  expect(comms.public.received).toHaveLength(1);
  expect(comms.public.received[0].account.actorId).toBe(caretakerId);
  expect(comms.public.received[0].observedAt).toBeLessThan(comms.public.received[0].receivedAt);
  const dated = (await regional(page)).view;
  await reload(page, renderer);
  expect((await regional(page)).view).toEqual(dated);
  expect((await assistant(page)).saved.orders[0].workSeconds).toBe(partial);
  console.info(`${renderer}: local freight completed despite broken original home instrument; reload retained both nodes`);

  // Lose the original refuge installation/route support, not the living run.
  // Repair the same original laboratory instrument; create no replacements.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.fixtures.find(f => f.id === s.fieldRefuge.site.cacheId).condition = 0;
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.communicationsOutage = 'Actual regional orbital/arcane outage';
    d.importSurveyExpeditionTestState(s); d.setLaboratoryAssistantForTest({ toolCondition: 70 });
  });
  expect(await action(page, 'report', awayId)).toBe(true);
  expect(await action(page, 'withdraw', awayId)).toBe(true);
  await tick(page, 900);
  lab = await assistant(page); away = await snap(page);
  expect(lab.saved.orders[0].status, JSON.stringify(lab.saved)).toBe('completed');
  expect(lab.saved.orders[0].result).toBeTruthy(); expect(lab.known).toEqual(knownLab);
  expect(lab.saved.orders[0].receivedAt).toBeNull();
  expect(away.context.supported).toBe(false); expect(away.saved.currentReady).toBe(false);
  expect((await regional(page)).view.nodes.find(n => n.id === awayId).report).toEqual(dated.nodes.find(n => n.id === awayId).report);
  expect((await regional(page)).saved.nodes).toHaveLength(2);
  const outage = await page.evaluate(() => window.helixHeresyDebug.caretakerCommunicationsSnapshot());
  expect(outage.public.received).toEqual(comms.public.received);
  expect(outage.public.issued.slice(-2).every(m => m.sentAt == null)).toBe(true);
  expect(await action(page, 'report', awayId)).toBe(false); // Duplicate pending instruction, not an acknowledgment.
  expect(await action(page, 'withdraw', awayId)).toBe(false);
  expect(await action(page, 'localReport', awayId)).toBe(false); // Not at crate/provider.
  const budget = (await snap(page)).saved.balance, cash = (await regional(page)).money;
  expect(await action(page, 'refund', awayId)).toBe(false);
  expect((await regional(page)).money).toBe(cash); expect((await snap(page)).saved.balance).toBe(budget);
  const packet = lab.saved.orders[0].reportStackId;
  await reload(page, renderer);
  expect((await assistant(page)).saved.orders[0].reportStackId).toBe(packet);
  expect((await assistant(page)).saved.actor.id).toBe(workerId);
  expect((await snap(page)).resident.actor.id).toBe(caretakerId);
  expect((await regional(page)).view).toEqual(dated);
  expect((await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState())).runEnded).toBeFalsy();
  expect(errors).toEqual([]);
});
