const { test, expect } = require('@playwright/test');
const { fixture, walk, tick } = require('./helpers/resident-caretaker');
const { reload } = require('./helpers/field-station');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(720000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.caretakerCommunicationsSnapshot());
const act = (page, action) => page.evaluate(action => window.helixHeresyDebug.caretakerCommunicationsAction(action), action);
async function setup(page, renderer) {
  const f = await fixture(page, renderer);
  expect(await page.evaluate(() => window.helixHeresyDebug.residentCaretakerAction('inspect'))).toBe(true);
  const supplied = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), site = s.fieldRefuge.site, plan = s.fieldRefuge.staffPlan;
    const b = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.builder;
    // Prior paid, arrived residence and purchased physical devices are inputs.
    // Pairing, transfer, messages, battery work and withdrawal are not supplied.
    const kit = s.physicalItemStacks.find(i => i.key === 'fieldShelter' && i.carriedBy === 'scientist');
    b.actor.mapCell = plan.sleep; b.actor.roomId = site.roomId;
    b.resident = { id: 'prior-paid-radio-residence', actorId: b.actor.id, phase: 'resident', recognizedBodyEpoch: s.scientistIdentity.bodyEpoch,
      signedAt: s.clock, lastAt: s.clock, arrivedAt: s.clock, endsAt: s.clock + 3 * 86400, earned: 0, restSeconds: 0,
      deployed: true, service: null, reason: '', log: [], report: null, kitId: kit.id, plan };
    kit.carriedBy = ''; kit.roomId = site.roomId; kit.cell = plan.sleep; kit.reservedTaskId = b.resident.id;
    const heater = s.fixtures.find(i => i.id === site.heaterId); heater.utility.fuel = 1; heater.utility.enabled = true;
    s.doors[site.doorId].state = 'closed';
    const add = (key, quantity) => { const id = `stack-${s.nextPhysicalItemStackNumber++}`;
      s.physicalItemStacks.push({ id, key, quantity, knownQuantity: quantity, section: 'inventory', roomId: site.roomId,
        cell: plan.doorPort, carriedBy: 'scientist', sourceLabels: ['Explicit finite purchased communication equipment'] }); return id; };
    const senderId = add('satelliteCommunicator', 1), receiverId = add('satelliteCommunicator', 1), batteryId = add('relayBattery', 2);
    s.economy.money = 384; b.actor.money = 40;
    d.importSurveyExpeditionTestState(s); d.configureUnsupportedTest({ cell: plan.doorPort });
    return { plan, senderId, receiverId, batteryId, site, duty: b.dutySeconds };
  });
  return { ...f, ...supplied };
}
test('Canvas paired finite radios, asymmetric outage, saved in-flight reply and dated knowledge', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await setup(page, 'canvas');
  expect(await act(page, 'pair')).toBe(false);
  expect(await act(page, 'giveRadio')).toBe(true);
  let s = await snap(page); expect(s.stacks.find(i => i.id === f.receiverId).carriedBy).toBe(f.workerId);
  await page.getByRole('button', { name: 'Pair communicators and enable caretaker reception', exact: true }).click();
  s = await snap(page); expect(s.public.link).toMatchObject({ senderId: f.senderId, receiverId: f.receiverId });
  expect(s.radios[f.receiverId].charge).toBe(14400); expect(s.resident.earned).toBe(0); expect(s.actor.money).toBe(40);
  expect(await act(page, 'report')).toBeTruthy(); expect(await act(page, 'report')).toBe(false);
  await tick(page, 1); expect((await snap(page)).public.issued[0].sentAt).toBeNull();
  expect(await act(page, 'toggleSender')).toBe(true); await tick(page, 1);
  const uploaded = (await snap(page)).public; expect(uploaded.issued[0].sentAt).not.toBeNull();
  expect(await act(page, 'toggleReceiver')).toBe(true); await tick(page, 3);
  s = await snap(page); expect(s.private.messages[0].deliveredAt).toBeNull(); expect(s.public).toEqual(uploaded);
  const saved = s.private; await reload(page, 'canvas'); expect((await snap(page)).private).toEqual(saved);
  expect(await act(page, 'toggleReceiver')).toBe(true);
  await walk(page, f.wildRoom, f.l.apron); await tick(page, 20);
  s = await snap(page); expect(s.public.received).toHaveLength(1);
  const first = s.public.received[0]; expect(first.observedAt).toBeLessThan(first.receivedAt);
  expect(first.account.actorId).toBe(f.workerId); expect(first.account.phase).toBe('resident');
  expect(first.account.observations.supplies).toBeUndefined(); // No unseen crate inventory.
  console.info('Canvas: real device handover, delayed report and saved asymmetric outage passed.');
  expect(await act(page, 'toggleReceiver')).toBe(false); // No remote power switch.
  expect(await act(page, 'report')).toBeTruthy(); await tick(page, 1);
  expect(await act(page, 'toggleSender')).toBe(true); await tick(page, 20);
  s = await snap(page); expect(s.private.messages[1].replySentAt).not.toBeNull(); expect(s.public.received).toEqual([first]);
  const inFlight = s.private; await reload(page, 'canvas'); expect((await snap(page)).private).toEqual(inFlight);
  expect(await act(page, 'toggleSender')).toBe(true); await tick(page, 1);
  s = await snap(page); expect(s.public.received).toHaveLength(2); expect(s.public.received[0]).toEqual(first);
  expect(errors).toEqual([]);
});
test('physical caretaker battery replacement attends the same device and consumes one carried battery across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await setup(page, 'canvas');
  expect(await act(page, 'giveRadio')).toBe(true); expect(await act(page, 'pair')).toBe(true);
  expect(await act(page, 'battery')).toBe(true); await tick(page, 15);
  let s = await snap(page); expect(s.stacks.find(i => i.id === f.batteryId).quantity).toBe(2); expect(s.tasks).toHaveLength(1);
  await reload(page, 'canvas'); await tick(page, 20); s = await snap(page);
  expect(s.stacks.find(i => i.id === f.batteryId).quantity, JSON.stringify({ clock: s.clock, tasks: s.tasks, actor: s.actor.mapCell, cell: s.cell })).toBe(1);
  expect(s.radios[f.receiverId]).toMatchObject({ charge: 14400, powered: false });
  expect(s.actor.id).toBe(f.workerId); expect(s.actor.money).toBeGreaterThan(40); expect(s.actor.health).toBe(100);
  expect(errors).toEqual([]);
});
test('DOM original recipient receives one withdrawal, physically returns with the same finite radio and retains dated reports across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await setup(page, 'dom');
  expect(await act(page, 'giveRadio')).toBe(true); expect(await act(page, 'pair')).toBe(true); expect(await act(page, 'toggleSender')).toBe(true);
  await walk(page, f.wildRoom, f.l.apron);
  // Explicit real regional service outage input; no random distance roll.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.communicationsOutage = 'Regional orbital-arcane service unavailable';
    d.importSurveyExpeditionTestState(s); });
  expect(await act(page, 'withdraw')).toBeTruthy(); await tick(page, 3);
  let s = await snap(page); expect(s.public.issued[0].sentAt).toBeNull(); expect(s.resident.phase).toBe('resident');
  expect(s.actor.id).toBe(f.workerId); expect(s.resident.earned).toBeGreaterThan(0); // Ordinary door/heater work continues offline.
  await reload(page, 'dom');
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.communicationsOutage = null;
    d.importSurveyExpeditionTestState(s); });
  for (let n = 0; n < 25; n++) { if ((await snap(page)).public.received.length) break; await tick(page, 1); }
  s = await snap(page);
  expect(s.resident.phase).toBe('returning'); expect(s.public.received).toHaveLength(1);
  expect(s.public.received[0].outcome).toBe('withdrawal accepted'); expect(s.actor.mapCell).not.toEqual(f.plan.home);
  const receipt = s.public.received[0], partialCell = s.actor.mapCell, charge = s.radios[f.receiverId].charge;
  console.info('DOM: withdrawal acknowledged once; original person is walking, not teleported.');
  await reload(page, 'dom'); expect((await snap(page)).actor.mapCell).toEqual(partialCell);
  for (let n = 0; n < 35; n++) { if ((await snap(page)).resident.phase === 'awaitingSettlement') break; await tick(page, 5); }
  s = await snap(page); expect(s.resident.phase).toBe('awaitingSettlement'); expect(s.actor.mapCell).toEqual(f.plan.home);
  expect(s.stacks.find(i => i.id === f.receiverId).carriedBy).toBe(f.workerId);
  expect(s.radios[f.receiverId].charge).toBeLessThan(charge); expect(s.actor.id).toBe(f.workerId); expect(s.actor.health).toBe(100);
  expect(s.resident.settledAt).toBeUndefined(); expect(s.actor.needs).not.toEqual({}); expect(s.public.received[0]).toEqual(receipt);
  expect(s.resident.log.filter(l => l.text.includes('Authenticated paired request'))).toHaveLength(1);
  await tick(page, 10); await reload(page, 'dom'); expect((await snap(page)).public.received[0]).toEqual(receipt);
  expect(errors).toEqual([]);
});
test('home packing carries two distinct paid radio units, not a duplicated identity or an unlimited third device', async ({ page }) => {
  await startLifecycleRun(page, 'two-physical-radios');
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const i = s.physicalItemStacks.find(i => i.key === 'satelliteCommunicator' && !i.carriedBy && !i.reservedTaskId);
    if (!i) throw Error('Original home radio supply missing');
    i.quantity = 2; i.knownQuantity = 2; i.sourceLabels = ['Explicit finite purchased two-device lot'];
    d.importSurveyExpeditionTestState(s);
  });
  for (let n = 0; n < 2; n++) {
    expect(await page.evaluate(() => window.helixHeresyDebug.packSurveyItem('satelliteCommunicator'))).toBe(true);
    await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      for (let k = 0; k < 12; k++) {
        const s = d.exportSurveyExpeditionTestState(), t = s.tasks.find(t => t.data?.itemKey === 'satelliteCommunicator');
        if (!t) return;
        d.advanceFieldWaterForTest(Math.max(1, t.dueAt - s.clock + 1));
      }
      throw Error('Physical radio packing did not finish');
    });
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.packSurveyItem('satelliteCommunicator'))).toBe(false);
  const s = await snap(page), radios = s.stacks.filter(i => i.key === 'satelliteCommunicator' && i.carriedBy === 'scientist');
  expect(radios).toHaveLength(2); expect(radios.every(i => i.quantity === 1)).toBe(true); expect(radios[0].id).not.toBe(radios[1].id);
  expect(s.public.link).toBeNull();
});
