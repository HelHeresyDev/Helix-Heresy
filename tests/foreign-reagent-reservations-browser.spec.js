const { test, expect } = require('@playwright/test');
const Assay = require('../foreign-industrial-assay');
const Services = require('../local-services');
const Production = require('../local-market-production');
const { openForeignWorkspace, workspace, advance, action, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignCommissionSnapshot());
function priorReports() {
  const p = Production.create({ cityId: 'b', workshopCapacity: 1, manufacturingFacilities: [{ id: 'works:b', name: 'B Chemical Works', kind: 'chemicalWorks',
    condition: 95, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  p.workshops.find(w => w.id === 'rubber').stock = 3; p.workshops.find(w => w.id === 'rubber').produced = 3;
  p.workshops.find(w => w.id === 'assayReagent').stock = 8; p.workshops.find(w => w.id === 'assayReagent').produced = 8;
  const service = Services.create(p), wallet = { money: 0 };
  for (const [at, condition] of [[0, 95], [86400, 55]]) {
    p.facilities[0].condition = condition; const { job } = Services.accept(service, p, at);
    job.status = 'awaitingAssay'; job.sampleStackId = `previous-portion-${job.id}`;
    Services.recordAssay(service, job.id, { id: `previous-report-${job.id}`, sampleCollectedAt: at, confidenceScore: 90 }, at, at + 1);
    Services.preview(service, job.id); expect(Services.submit(service, p, job.id, wallet, at + 2).ok).toBe(true);
  }
  return { p, service, paid: wallet.money };
}
test('canvas foreign reagent allocation locks real surplus, expires unpaid, retains paid cargo through lease interruption and reload, and supplies ordinary assays', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openForeignWorkspace(page, 'foreign-reagent-allocation', 'canvas', true);
  // Explicit historical fixture: two original paid truthful reports, one clean
  // and one contaminated. Factory/player money and produced goods are conserved.
  await page.evaluate(({ p, service, paid }) => {
    const d = window.helixHeresyDebug;
    d.setForeignSuppliesTestContext({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' }, standings: [],
      market: { listings: { assayReagent: { supply: 20, demand: 1 } } } });
    const s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    s.clock = Math.max(s.clock, 90000); s.wildernessSurvival.lastAt = s.clock; p.lastAt = s.clock;
    s.economy.money += paid; s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production = p;
    g.foreignWorkspace.commission = { service, liaisonId: g.foreignWorkspace.actor.id, bodyEpoch: s.scientistIdentity.bodyEpoch,
      quote: null, observation: null, reservationQuote: null, reservationSerial: 0, reservationHistory: [] };
    d.importSurveyExpeditionTestState(s);
  }, priorReports());
  await page.locator('[data-workspace-tab="visits"]').click(); const panel = page.locator('[data-foreign-industrial-assay]');
  await panel.getByRole('button', { name: 'Review foreign reagent reservation terms', exact: true }).click();
  let s = await snap(page), q = s.commission.reservationQuote, money = s.money;
  expect(q).toMatchObject({ quantity: 2, freight: 8, holdSeconds: 14400 }); await expect(panel).toContainText('no recurring procurement');
  expect(s.production.workshops.find(w => w.id === 'assayReagent').stock).toBe(8);
  await panel.getByRole('button', { name: 'Reserve two foreign reagent units for four hours', exact: true }).click();
  s = await snap(page); expect(s.money).toBe(money); expect(s.production.workshops.find(w => w.id === 'assayReagent').stock).toBe(6);
  const first = s.commission.service.reservation; expect(first.status).toBe('held'); expect(s.production.shipments).toHaveLength(0);
  await advance(page, first.expiresAt - s.clock); s = await snap(page);
  expect(s.commission.service.reservation.status).toBe('expired'); expect(s.production.workshops.find(w => w.id === 'assayReagent').stock).toBe(8);
  await panel.getByRole('button', { name: 'Review foreign reagent reservation terms', exact: true }).click();
  await panel.getByRole('button', { name: 'Reserve two foreign reagent units for four hours', exact: true }).click();
  s = await snap(page); const held = s.commission.service.reservation, total = held.foreignTerms.total;
  expect(held.id).not.toBe(first.id); expect(s.commission.reservationHistory[0].id).toBe(first.id);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const n = s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b'); n.listings.assayReagent.demand = 1.8; d.importSurveyExpeditionTestState(s); });
  await panel.getByRole('button', { name: 'Pay exact held foreign reagent terms', exact: true }).click();
  s = await snap(page); expect(s.money).toBe(money - total); expect(s.commission.service.reservation.status).toBe('purchased');
  expect(s.commission.service.reservation.receipt).toBeNull(); expect(s.production.finance.transportEarned).toBe(8);
  expect(await action(page, 'reviewReservation')).toBe(false);
  const roomId = (await workspace(page)).saved.roomId;
  expect(s.stacks.filter(i => i.key === 'assayReagent' && i.roomId === roomId && !i.carriedBy)).toHaveLength(0);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    g.foreignWorkspace.lease.endsAt = s.clock + 1; d.importSurveyExpeditionTestState(s); });
  await advance(page, 3700); s = await snap(page); expect(s.commission.service.reservation.receipt).toBeNull();
  expect(s.production.shipments[0].delivered).toBe(false); expect(s.production.trucks).toHaveLength(2);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.money).toBe(money - total); expect(s.commission.service.reservation.id).toBe(held.id);
  expect(await wa(page, 'quote')).toBe(true); expect(await wa(page, 'sign', { expected: (await workspace(page)).saved.quote })).toBe(true);
  await advance(page, 3700); s = await snap(page); const allocation = s.commission.service.reservation;
  expect(allocation.status).toBe('received'); expect(allocation.receivingWorkSeconds).toBe(0);
  const parcel = s.stacks.find(i => i.id === allocation.receipt.stackId), w = await workspace(page);
  expect(parcel).toMatchObject({ key: 'assayReagent', section: 'resources', quantity: 2, roomId: w.saved.roomId, carriedBy: '' });
  expect(parcel.sourceLabels).toContain(held.id); expect(allocation.receipt.shipmentId).toBe(s.production.shipments[0].id);
  expect(s.production.workshops.find(w => w.id === 'assayReagent').stock).toBe(6);
  const originalReagent = w.stacks.find(i => i.key === 'assayReagent' && i.carriedBy === 'scientist');
  const sample = w.diagnostics.samples.find(i => w.stacks.some(stack => stack.id === i.stackId && stack.carriedBy === 'scientist'));
  expect(await wa(page, 'assay', { stackId: sample.stackId })).toBe(true); await finish(page);
  s = await snap(page); expect(s.stacks.find(i => i.id === originalReagent.id).quantity).toBe(1);
  expect(s.stacks.find(i => i.id === parcel.id).quantity).toBe(1); expect(s.diagnostics.results.at(-1).workflowId).toBe('assaySample');
  expect(await wa(page, 'pack', { stackId: parcel.id })).toBe(true); await finish(page);
  expect((await workspace(page)).stacks.find(i => i.id === parcel.id).carriedBy).toBe('scientist');
  expect((await workspace(page)).context.atDesk).toBe(true); // Pickup already ended at the receiving desk.
  expect(await wa(page, 'return')).toBe(true); await finish(page); const dated = (await snap(page)).commission.observation;
  await advance(page, 60); expect((await snap(page)).commission.observation).toEqual(dated);
  expect(await action(page, 'reviewReservation')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const frozen = await snap(page); await advance(page, 120);
  expect((await snap(page)).commission).toEqual(frozen.commission); expect((await snap(page)).production).toEqual(frozen.production); expect(errors).toEqual([]);
});
