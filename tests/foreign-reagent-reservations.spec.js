const { test, expect } = require('@playwright/test');
const Assay = require('../foreign-industrial-assay');
const Workspace = require('../foreign-assay-workspace');
const Services = require('../local-services');
const Production = require('../local-market-production');
const Carrier = require('../local-exchange-carrier');
const copy = x => JSON.parse(JSON.stringify(x)), NOW = 90000, HOUR = 3600;
function fixture() {
  const city = { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' };
  const standings = [{ standing: 'licensed', network: { id: 'research', category: 'research' }, branch: { id: 'research:b', publicName: 'B Research',
    organizationForm: 'localLaboratory', currentCityId: 'b', publicPhysicalPresence: true, operationalStatus: 'active', capacityBand: 'functional' } }];
  const authority = { cityId: 'b', currentAuthority: true, administrationId: 'admin:b' };
  const w = Workspace.create(city, standings, authority, { cityName: 'B', representativeCell: { x: 9, y: 13, z: 20 } }, 'seed', 0, 'madcap');
  const c = { city, standings, authority, alive: true, capable: true, originalBody: true, custody: false, local: true, cityId: 'b',
    bodyEpoch: 0, visitId: 'visit', tenant: 'Mira', atProperty: true, atDesk: true, contact: true, busy: false,
    visitorPermit: { cityId: 'b', bodyEpoch: 0, visitId: 'visit', expiresAt: 21600, scope: 'visitorHallOnly' } };
  const wallet = { money: 1000 }; Workspace.invite(w, c, 0); Workspace.sign(w, c, Workspace.request(w, c, 0), wallet, 0);
  const p = Production.create({ cityId: 'b', workshopCapacity: 1, manufacturingFacilities: [{ id: 'works:b', name: 'B Chemical Works', kind: 'chemicalWorks',
    condition: 95, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  p.workshops.find(w => w.id === 'rubber').stock = 3; p.workshops.find(w => w.id === 'assayReagent').stock = 8;
  const s = Assay.create(w, p); s.bodyEpoch = c.bodyEpoch;
  return { w, c, wallet, p, s, supplier: Carrier.support(Carrier.create('b')).supplier };
}
const market = unitPrice => ({ cityId: 'b', good: 'assayReagent', unitPrice });
const act = (f, kind, options = {}, at = NOW, unitPrice = 20) => Assay.action(f.s, f.w, f.p, f.c, at, kind, options, f.wallet, market(unitPrice));
function complete(f, at, condition) {
  f.p.facilities[0].condition = condition;
  const { job } = Services.accept(f.s.service, f.p, at);
  job.status = 'awaitingAssay'; job.sampleStackId = `original-portion-${job.id}`;
  Services.recordAssay(f.s.service, job.id, { id: `report-${job.id}`, sampleCollectedAt: at, confidenceScore: 90 }, at, at + 1);
  Services.preview(f.s.service, job.id); expect(Services.submit(f.s.service, f.p, job.id, f.wallet, at + 2).ok).toBe(true);
}
function eligible() { const f = fixture(); complete(f, 0, 95); complete(f, 86400, 55); f.p.lastAt = NOW; return f; }
function hold(f, at = NOW) {
  expect(act(f, 'reviewReservation', {}, at).ok).toBe(true);
  const q = copy(f.s.reservationQuote); expect(act(f, 'reserveReagent', { expected: q }, at).ok).toBe(true);
  return f.s.service.reservation;
}
const pay = (f, at = NOW) => act(f, 'purchaseReagent', { expected: copy(f.s.service.reservation.foreignTerms) }, at);
test('only two actually received conclusive reports qualify; truthful contamination counts equally and a score alone grants nothing', () => {
  const f = fixture(); expect(act(f, 'reviewReservation').ok).toBe(false);
  f.s.service.trust = 2; expect(act(f, 'reviewReservation').ok).toBe(false);
  f.s.service.trust = 0; complete(f, 0, 95); expect(act(f, 'reviewReservation').ok).toBe(false);
  complete(f, 86400, 55); expect(f.s.service.jobs.map(j => j.result.finding)).toEqual(['acceptable', 'contaminated']);
  expect(act(f, 'reviewReservation').ok).toBe(true);
  for (const change of [g => g.s.service.jobs[1].status = 'cancelled', g => g.s.service.jobs[1].paidAt = null,
    g => g.s.service.jobs[1].result.finding = 'inconclusive', g => g.s.service.jobs[1].feeEscrow = 120]) {
    const g = eligible(); change(g); expect(act(g, 'reviewReservation').ok).toBe(false);
  }
});
test('exact market-price proposal creates no goods or payment; acceptance holds two real units and retains factory needs', () => {
  const f = eligible(), before = copy(f.p), money = f.wallet.money;
  expect(act(f, 'reviewReservation').ok).toBe(true); expect(f.p).toEqual(before); expect(f.wallet.money).toBe(money);
  const q = copy(f.s.reservationQuote); expect(q).toMatchObject({ unitPrice: 20, quantity: 2, freight: 8, total: 48, holdSeconds: 4 * HOUR });
  expect(act(f, 'reserveReagent', { expected: { ...q, total: 1 } }).ok).toBe(false); expect(f.p).toEqual(before);
  expect(act(f, 'reserveReagent', { expected: q }).ok).toBe(true);
  expect(f.s.service.reservation).toMatchObject({ status: 'held', expiresAt: NOW + 4 * HOUR, goodsUnitPrice: 20, unitPrice: 24, quantity: 2, paidAt: null });
  expect(f.p.workshops.find(w => w.id === 'assayReagent').stock).toBe(6); expect(f.p.trucks.every(t => !t.shipment)).toBe(true);
  expect(act(f, 'reviewReservation').ok).toBe(false); expect(f.wallet.money).toBe(money);
  const scarce = eligible(); scarce.p.workshops.find(w => w.id === 'assayReagent').stock = 3.99;
  expect(act(scarce, 'reviewReservation').ok).toBe(false);
  scarce.p.workshops.find(w => w.id === 'assayReagent').stock = 4; hold(scarce);
  expect(scarce.p.workshops.find(w => w.id === 'assayReagent').stock).toBe(2);
});
test('changed body, original desk, source support, invalid price or exhausted finite communications refuse reservations', () => {
  for (const change of [f => f.c.atDesk = false, f => f.c.contact = false, f => f.c.bodyEpoch++, f => f.c.originalBody = false,
    f => f.c.custody = true, f => f.c.busy = true, f => f.w.actor.status = 'dead', f => f.c.authority.currentAuthority = false,
    f => f.p.facilities[0].utilities = 0, f => f.s.service.communicationSeconds = 239, f => f.w.lease.endsAt = NOW]) {
    const f = eligible(); change(f); expect(act(f, 'reviewReservation').ok).toBe(false);
  }
  for (const value of [NaN, Infinity, -1, 0, .5, Number.MAX_VALUE]) {
    const f = eligible(); expect(act(f, 'reviewReservation', {}, NOW, value).ok).toBe(false);
  }
  const f = eligible(); act(f, 'reviewReservation'); const q = copy(f.s.reservationQuote);
  expect(act(f, 'reserveReagent', { expected: q }, q.expiresAt).ok).toBe(false);
});
test('price remains locked for four hours, insufficient funds preserve held stock, and payment credits goods and freight separately once', () => {
  const f = eligible(), allocation = hold(f), producerMoney = f.p.finance.money, playerMoney = f.wallet.money;
  f.wallet.money = 47; expect(pay(f).ok).toBe(false); expect(allocation.status).toBe('held'); expect(f.p.finance.money).toBe(producerMoney);
  f.wallet.money = playerMoney;
  expect(act(f, 'purchaseReagent', { expected: { ...allocation.foreignTerms, unitPrice: 1 } }).ok).toBe(false);
  expect(act(f, 'purchaseReagent', { expected: copy(allocation.foreignTerms) }, NOW + 100, 999).ok).toBe(true);
  expect(f.wallet.money).toBe(playerMoney - 48); expect(f.p.finance.money).toBe(producerMoney + 40); expect(f.p.finance.transportEarned).toBe(8);
  expect(allocation).toMatchObject({ status: 'purchased', freightEscrow: 0, receivingWorkSeconds: 60 });
  expect(f.p.shipments[0]).toMatchObject({ serviceReservationId: allocation.id, cargo: 'assayReagent', quantity: 2, target: 'foreignWorkspace' });
  expect(pay(f).ok).toBe(false); expect(f.wallet.money).toBe(playerMoney - 48);
});
test('unpaid expiry restores exactly the original held units, never money or transport, and permits a new separately numbered allocation', () => {
  const f = eligible(), r = hold(f), before = copy(f.p), money = f.wallet.money;
  expect(Services.advance(f.s.service, f.p, r.expiresAt)).toBe(true);
  expect(r.status).toBe('expired'); expect(f.p.workshops.find(w => w.id === 'assayReagent').stock).toBe(8);
  expect(Services.advance(f.s.service, f.p, r.expiresAt + 1)).toBe(false); expect(f.wallet.money).toBe(money);
  expect(f.p.trucks).toEqual(before.trucks); expect(f.p.finance).toEqual(before.finance);
  const next = hold(f, r.expiresAt + 1); expect(next.id).not.toBe(r.id); expect(f.s.reservationHistory[0]).toEqual(r);
  expect(pay(f, next.expiresAt).ok).toBe(false); expect(next.status).toBe('expired');
});
test('busy original trucks retain paid ownership and freight escrow until a capable adequately sized original truck can dispatch', () => {
  const f = eligible(), r = hold(f); f.p.trucks.forEach(t => t.shipment = 'existing-work');
  expect(pay(f).ok).toBe(true); expect(r).toMatchObject({ status: 'purchased', shipmentId: '', freightEscrow: 8 });
  expect(f.p.finance.transportEarned || 0).toBe(0); expect(act(f, 'reviewReservation').ok).toBe(false);
  f.p.trucks[0].shipment = null; f.p.trucks[0].capacity = 1;
  expect(Assay.dispatchReservation(f.s, f.w, f.p, f.c, NOW + 1)).toBe(false);
  f.p.trucks[1].shipment = null;
  expect(Assay.dispatchReservation(f.s, f.w, f.p, f.c, NOW + 1)).toBe(true);
  expect(f.p.shipments[0].truckId).toBe(f.p.trucks[1].id); expect(f.p.trucks[1].fuelKm).toBe(232);
  expect(r.freightEscrow).toBe(0); expect(f.p.finance.transportEarned).toBe(8);
  expect(Assay.dispatchReservation(f.s, f.w, f.p, f.c, NOW + 2)).toBe(false);
  expect(f.p.trucks).toHaveLength(2);
});
test('paid cargo and reserved receiving work survive lease expiry, driver incapacity and reload; receipt retains original identity after summary pruning', () => {
  let f = eligible(); f.s.service.communicationSeconds = 240; const r = hold(f); expect(pay(f).ok).toBe(true);
  expect(f.s.service.communicationSeconds).toBe(0); expect(r.receivingWorkSeconds).toBe(60);
  expect(Assay.reservationDeliveryReason(f.s, f.w, f.p, f.c, NOW)).toBe('');
  f.w.lease.endsAt = NOW + 1; f.p.shipments[0].destination.endsAt = f.w.lease.endsAt;
  f.p.trucks[0].driver.health = 0; Production.advance(f.p, NOW + 2 * HOUR, {}, f.supplier);
  expect(f.p.shipments[0].delivered).toBe(false); f = copy(f);
  f.w.lease.endsAt = NOW + 48 * HOUR; f.p.shipments[0].destination.endsAt = f.w.lease.endsAt; f.p.trucks[0].driver.health = 100;
  Production.advance(f.p, NOW + 4 * HOUR, {}, f.supplier);
  const receipt = f.p.serviceDepot[r.shipmentId]; expect(receipt).toMatchObject({ serviceReservationId: r.id, cargo: 'assayReagent', quantity: 2,
    destination: { cityId: 'b', propertyId: f.w.property.id } });
  Services.advance(f.s.service, f.p, r.expiresAt + 1); expect(f.s.service.reservation.status).toBe('purchased');
  expect(f.p.workshops.find(w => w.id === 'assayReagent').stock).toBe(6);
  Production.advance(f.p, NOW + 30 * HOUR, {}, f.supplier); expect(f.p.serviceDepot[r.shipmentId]).toEqual(receipt);
});
test('received allocation history and private original custody persist while away without live stock knowledge or automatic recurring purchase', () => {
  const f = eligible(), r = hold(f); pay(f);
  const observed = Assay.observe(f.s, f.w, f.p, f.c, NOW); f.c.atDesk = false;
  expect(act(f, 'reviewReservation').ok).toBe(false); expect(Assay.observe(f.s, f.w, f.p, f.c, NOW + HOUR)).toEqual(observed);
  expect(JSON.stringify(observed)).not.toMatch(/burden|finance|depotFuel|driver/);
  f.c.atDesk = true; r.status = 'received'; r.receivedAt = NOW + HOUR;
  r.receipt = { stackId: 'original-reagent-lot', quantity: 2, at: r.receivedAt };
  const next = hold(f, NOW + HOUR + 1);
  expect(next.status).toBe('held'); expect(f.s.reservationHistory[0].receipt.stackId).toBe('original-reagent-lot');
  expect(f.p.shipments).toHaveLength(1); expect(next.paidAt).toBeNull();
});
