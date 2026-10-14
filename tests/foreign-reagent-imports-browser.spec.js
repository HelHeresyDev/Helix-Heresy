const { test, expect } = require('@playwright/test');
const Services = require('../local-services');
const Production = require('../local-market-production');
const { openForeignWorkspace, workspace, advance, action, wa, finish, finishHome, municipalTravel } = require('./helpers/foreign-assay-visit');
test.setTimeout(900000);
const account = page => page.evaluate(() => window.helixHeresyDebug.foreignCommissionSnapshot());
const home = page => page.evaluate(() => window.helixHeresyDebug.foreignLabUnloadingSnapshot());
function priorReports() {
  const p = Production.create({ cityId: 'b', workshopCapacity: 1, manufacturingFacilities: [{ id: 'works:b', name: 'B Chemical Works', kind: 'chemicalWorks',
    condition: 95, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  p.workshops.find(w => w.id === 'rubber').stock = 3; p.workshops.find(w => w.id === 'rubber').produced = 3;
  p.workshops.find(w => w.id === 'assayReagent').stock = 8; p.workshops.find(w => w.id === 'assayReagent').produced = 8;
  const service = Services.create(p), wallet = { money: 0 };
  service.nextOfferAt = -172800; // Explicit start of this pre-departure account history.
  for (const [at, condition] of [[-172800, 95], [-86400, 55]]) {
    p.facilities[0].condition = condition; const { job } = Services.accept(service, p, at);
    job.status = 'awaitingAssay'; job.sampleStackId = `prior-portion-${job.id}`;
    Services.recordAssay(service, job.id, { id: `prior-report-${job.id}`, sampleCollectedAt: at, confidenceScore: 90 }, at, at + 1);
    Services.preview(service, job.id); expect(Services.submit(service, p, job.id, wallet, at + 2).ok).toBe(true);
  }
  return { p, service, paid: wallet.money };
}
test('canvas factory reagent survives foreign consumption, paid physical return, guarded saved home unloading and ordinary home assay', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // Real world-bound save, finite original departure cargo, and an actually paid
  // municipal round trip rather than a debug teleport home.
  await openForeignWorkspace(page, 'factory-reagent-home', 'canvas', true, true);
  await page.evaluate(({ p, service, paid }) => {
    const d = window.helixHeresyDebug;
    d.setForeignSuppliesTestContext({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' }, standings: [], market: { listings: { assayReagent: { supply: 20, demand: 1 } } } });
    const s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    p.lastAt = s.clock; s.economy.money += paid;
    s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production = p;
    g.foreignWorkspace.commission = { service, liaisonId: g.foreignWorkspace.actor.id, bodyEpoch: s.scientistIdentity.bodyEpoch,
      quote: null, observation: null, reservationQuote: null, reservationSerial: 0, reservationHistory: [] };
    // Remove the existing home reserve, not the real original carried unit.
    s.physicalItemStacks = s.physicalItemStacks.filter(i => i.key !== 'assayReagent' || i.carriedBy);
    d.importSurveyExpeditionTestState(s);
  }, priorReports());
  expect(await action(page, 'reviewReservation')).toBe(true);
  expect(await action(page, 'reserveReagent', { expected: (await account(page)).commission.reservationQuote })).toBe(true);
  let s = await account(page), allocation = s.commission.service.reservation;
  expect(allocation.receipt).toBeNull();
  expect(await action(page, 'purchaseReagent', { expected: allocation.foreignTerms })).toBe(true);
  expect((await account(page)).commission.service.reservation.receipt).toBeNull();
  await advance(page, 3700); s = await account(page); allocation = s.commission.service.reservation;
  expect(allocation.status).toBe('received'); expect(allocation.receipt.importLots).toEqual([{ stackId: allocation.receipt.stackId, parentStackId: null, remaining: 2, unloadedAt: null }]);
  let w = await workspace(page); const samples = w.diagnostics.samples.filter(p => w.stacks.some(i => i.id === p.stackId && i.carriedBy === 'scientist'));
  expect(samples).toHaveLength(2);
  // Ordinary assay reservation genuinely splits this two-unit parcel, consumes
  // one original portion and leaves the other importable, not a replacement lot.
  expect(await wa(page, 'assay', { stackId: samples[0].stackId })).toBe(true); await finish(page);
  s = await account(page); allocation = s.commission.service.reservation;
  expect(allocation.receipt.importLots.map(l => l.remaining)).toEqual([1, 0]);
  expect(await wa(page, 'pack', { stackId: allocation.receipt.stackId })).toBe(true); await finish(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.unloadForeignLabInput(id, 'any'), allocation.receipt.stackId)).toBe(false);
  // A later separately accepted offer archives, rather than erases, the old
  // original receipt and its reduced balances. Do not purchase this new offer.
  if (!(await workspace(page)).context.atDesk) { expect(await wa(page, 'walk')).toBe(true); await finish(page); }
  expect(await action(page, 'reviewReservation')).toBe(true);
  expect(await action(page, 'reserveReagent', { expected: (await account(page)).commission.reservationQuote })).toBe(true);
  expect((await account(page)).commission.reservationHistory[0].receipt.importLots.map(l => l.remaining)).toEqual([1, 0]);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const moneyBeforeReturn = (await workspace(page)).money;
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  const booking = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  expect(booking.carrier.booking.outbound).toBe(false); expect(booking.money).toBe(moneyBeforeReturn - booking.carrier.booking.fee);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  await advance(page, 1600);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect((await home(page)).context.atLab).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finishHome(page); await municipalTravel(page);
  await page.locator('[data-workspace-tab="visits"]').click();
  let h = await home(page); expect(h.context.atLab).toBe(true); expect(h.lots).toHaveLength(1); expect(h.lots[0].quantity).toBe(1);
  expect(h.lots[0].id).toBe(allocation.receipt.stackId);
  const lotId = h.lots[0].id; // Reservation removes it from the available-lots list.
  expect(await page.evaluate(id => window.helixHeresyDebug.startDiagnosticSampleAssay(id), samples[1].stackId)).toBe(false);
  const destination = h.destinations.find(d => !d.fixtureId); expect(destination).toBeTruthy();
  const panel = page.locator('[data-foreign-lab-unloading]'); await expect(panel).toContainText('conserved parcel lineage verified');
  await panel.getByLabel('Imported reagent home storage').selectOption(destination.id);
  await panel.getByRole('button', { name: `Walk to Storage and Unload ${lotId}`, exact: true }).click();
  h = await home(page); expect(h.receipts).toHaveLength(0); const pending = h.tasks[0]; expect(pending.reason).toBe('');
  const guards = await page.evaluate(({ stackId, stockpileId }) => {
    const d = window.helixHeresyDebug, original = d.exportSurveyExpeditionTestState(), out = [];
    for (const kind of ['body', 'owner', 'dimensions', 'labels', 'receipt', 'inflation', 'space']) {
      const s = JSON.parse(JSON.stringify(original)), item = s.physicalItemStacks.find(i => i.id === stackId);
      const r = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignWorkspace.commission.reservationHistory[0];
      if (kind === 'body') s.scientistIdentity.bodyEpoch++;
      if (kind === 'owner') item.cityOwnerId = 'b';
      if (kind === 'dimensions') item.unitMassKg++;
      if (kind === 'labels') item.sourceLabels = [];
      if (kind === 'receipt') r.receipt.shipmentId = 'different';
      if (kind === 'inflation') item.quantity++;
      if (kind === 'space') s.stockpileDesignations.find(p => p.id === stockpileId).allowFloorStorage = false;
      d.importSurveyExpeditionTestState(s); const before = d.foreignLabUnloadingSnapshot(); d.advanceSimulation(1);
      out.push({ kind, reason: before.tasks[0]?.reason, receipts: d.foreignLabUnloadingSnapshot().receipts.length,
        carried: d.physicalStockSnapshot().stacks.find(i => i.id === stackId)?.carriedBy });
    }
    d.importSurveyExpeditionTestState(original); return out;
  }, { stackId: lotId, stockpileId: destination.stockpileId });
  for (const g of guards) { expect(g.reason, g.kind).toBeTruthy(); expect(g.receipts, g.kind).toBe(0); expect(g.carried, g.kind).toBe('scientist'); }
  await panel.getByRole('button', { name: `Cancel ${pending.label}`, exact: true }).click();
  expect((await home(page)).lots).toHaveLength(1);
  await panel.getByRole('button', { name: `Walk to Storage and Unload ${lotId}`, exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  const beforeReload = await home(page); expect(beforeReload.receipts).toHaveLength(0);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await home(page)).tasks[0].id).toBe(beforeReload.tasks[0].id); await finishHome(page);
  h = await home(page); expect(h.receipts).toHaveLength(1); expect(h.receipts[0]).toMatchObject({ kind: 'factoryReagent', orderId: allocation.id,
    shipmentId: allocation.shipmentId, sourceStackId: allocation.receipt.stackId, deliveredQuantity: 2, quantity: 1, receivedAt: allocation.receipt.at });
  const stored = await page.evaluate(id => window.helixHeresyDebug.physicalStockSnapshot().stacks.find(i => i.id === id), allocation.receipt.stackId);
  expect(stored.carriedBy).toBe(''); expect(stored.stockpileId).toBe(destination.stockpileId);
  // Repacking the original already-received unit cannot create another home
  // receipt. Drop it back at its actual location for the ordinary home assay.
  expect(await page.evaluate(id => window.helixHeresyDebug.carryActorStack('scientist', id, 1), stored.id)).toBeTruthy();
  expect(await page.evaluate(({ id, dest }) => window.helixHeresyDebug.unloadForeignLabInput(id, dest), { id: stored.id, dest: destination.id })).toBe(false);
  expect(await page.evaluate(id => window.helixHeresyDebug.dropActorStack('scientist', id), stored.id)).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.startDiagnosticSampleAssay(id), samples[1].stackId)).toBe(true); await finishHome(page);
  expect((await home(page)).receipts).toHaveLength(1);
  expect(await page.evaluate(id => window.helixHeresyDebug.physicalStockSnapshot().stacks.some(i => i.id === id), stored.id)).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b')
    .foreignWorkspace.commission.reservationHistory[0].receipt.importLots.reduce((n, l) => n + l.remaining, 0))).toBe(0);
  expect(errors).toEqual([]);
});
