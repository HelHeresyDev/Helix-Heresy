const { test, expect } = require('@playwright/test');
const Assay = require('../foreign-industrial-assay');
const Workspace = require('../foreign-assay-workspace');
const Services = require('../local-services');
const Production = require('../local-market-production');
const Carrier = require('../local-exchange-carrier');
const copy = x => JSON.parse(JSON.stringify(x)), HOUR = 3600;
function fixture(condition = 95) {
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
    condition, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  p.workshops.find(w => w.id === 'rubber').stock = 3;
  const s = Assay.create(w, p), supplier = Carrier.support(Carrier.create('b')).supplier;
  return { w, c, wallet, p, s, supplier };
}
const act = (f, action, options = {}, at = 1) => Assay.action(f.s, f.w, f.p, f.c, at, action, options, f.wallet);
function accept(f) { const q = Assay.quote(f.s, f.w, f.p, f.c, 1); expect(q).not.toBeNull(); return act(f, 'accept', { expected: q }).job; }
function report(f, job, confidence = 90, at = 7200) {
  job.status = 'awaitingAssay'; job.sampleStackId = 'actual-sealed-stack';
  expect(Services.recordAssay(f.s.service, job.id, { id: 'dated-result', sampleCollectedAt: job.sampleAt, confidenceScore: confidence }, job.sampleAt, at)).toBe(true);
}
test('foreign customer requires the actual same-city chemical works and creates no new resources or people', () => {
  const f = fixture(), before = copy(f.p);
  expect(Assay.create(f.w, { ...f.p, cityId: 'other' })).toBeNull();
  expect(Assay.create(f.w, { ...f.p, facilities: [] })).toBeNull();
  expect(Assay.create(f.w, { ...f.p, facilities: [{ ...f.p.facilities[0], kind: 'glassworks' }] })).toBeNull();
  expect(Assay.create(f.w, f.p).liaisonId).toBe(f.w.actor.id);
  expect(f.p).toEqual(before); expect(f.s.service.client.facilityId).toBe('works:b');
});
test('exact attended quotes reserve actual batch, customer fee and freight and original truck only once', () => {
  const f = fixture(), q = Assay.quote(f.s, f.w, f.p, f.c, 1);
  expect(q).toMatchObject({ fee: 120, freight: 8, window: 48 * HOUR, propertyId: f.w.property.id, tenant: 'Mira' });
  const before = copy(f.p);
  expect(act(f, 'accept', { expected: { ...q, fee: 999 } }).ok).toBe(false); expect(f.p).toEqual(before);
  const { job } = act(f, 'accept', { expected: q });
  expect(job).toMatchObject({ feeEscrow: 120, heldQuantity: .9, status: 'sampleInTransit', dueAt: 1 + 48 * HOUR });
  expect(f.p.finance.money).toBe(1372); expect(f.p.finance.transportEarned).toBe(8);
  expect(f.p.workshops.find(w => w.id === 'rubber').stock).toBe(2);
  expect(f.p.trucks[0]).toMatchObject({ fuelKm: 232, driver: { id: 'b:producer-driver-1' } });
  expect(f.p.shipments[0]).toMatchObject({ target: 'foreignWorkspace', destination: { propertyId: f.w.property.id, cityId: 'b' }, serviceJobId: job.id });
  expect(act(f, 'accept', { expected: q }).ok).toBe(false); expect(f.wallet.money).toBe(625);
});
test('no offer on broken source, unfunded stock, unavailable delivery or absent original liaison and tenant', () => {
  for (const change of [f => f.p.facilities[0].routeOpen = false, f => f.p.facilities[0].utilities = 0,
    f => f.p.facilities[0].expertise = [], f => f.p.finance.money = 127, f => f.p.finance.money = NaN,
    f => f.p.workshops.find(w => w.id === 'rubber').stock = 0, f => f.p.trucks.forEach(t => t.driver.health = 0),
    f => f.p.trucks.forEach(t => t.shipment = 'existing-work'), f => f.c.atDesk = false, f => f.c.contact = false,
    f => f.c.originalBody = false, f => f.c.custody = true, f => f.w.actor.status = 'dead',
    f => f.c.authority.currentAuthority = false, f => f.w.lease.endsAt = 3500]) {
    const f = fixture(); change(f); expect(Assay.quote(f.s, f.w, f.p, f.c, 1)).toBeNull();
  }
  const f = fixture(), q = Assay.quote(f.s, f.w, f.p, f.c, 1);
  expect(act(f, 'accept', { expected: q }, q.expiresAt).ok).toBe(false);
});
test('physical truck delivery holds original cargo on driver failure, receiving expiry and reload without teleport or duplicate receipt', () => {
  let f = fixture(); const job = accept(f), sh = f.p.shipments[0]; f.p.trucks[0].driver.health = 0;
  Production.advance(f.p, 2 * HOUR, {}, f.supplier); expect(sh.delivered).toBe(false); expect(f.p.serviceDepot).toBeUndefined();
  f = copy(f); f.p.trucks[0].driver.health = 100; f.p.shipments[0].destination.endsAt = 3 * HOUR;
  Production.advance(f.p, 4 * HOUR, {}, f.supplier); expect(f.p.shipments[0].delivered).toBe(false);
  f.p.shipments[0].destination.endsAt = 100 * HOUR;
  Production.advance(f.p, 6 * HOUR, {}, f.supplier);
  const receipt = f.p.serviceDepot[sh.id]; expect(receipt).toMatchObject({ serviceJobId: job.id, sampleAt: 1, quantity: 1, destination: { propertyId: f.w.property.id } });
  Production.advance(f.p, 30 * HOUR, {}, f.supplier); expect(f.p.serviceDepot[sh.id]).toEqual(receipt);
  expect(f.p.trucks).toHaveLength(2); expect(f.s.service.jobs[0].sampleStackId).toBe('');
});
test('conclusive clean and contaminated reports pay equal fees only on exact attended receipt and release or quarantine the held lot', () => {
  for (const [condition, lot, stock] of [[95, 'released', 2.9], [55, 'quarantined', 2]]) {
    const f = fixture(condition), job = accept(f); report(f, job);
    expect(act(f, 'submit', { jobId: job.id }, 7201).ok).toBe(false);
    expect(act(f, 'preview', { jobId: job.id }, 7201).ok).toBe(true);
    f.c.atDesk = false; expect(act(f, 'submit', { jobId: job.id }, 7201).ok).toBe(false); f.c.atDesk = true;
    expect(act(f, 'submit', { jobId: job.id }, 7201).ok).toBe(true);
    expect(f.wallet.money).toBe(745); expect(job.lotStatus).toBe(lot);
    expect(f.p.workshops.find(w => w.id === 'rubber').stock).toBeCloseTo(stock);
    expect(act(f, 'submit', { jobId: job.id }, 7202).ok).toBe(false);
  }
});
test('inconclusive resampling uses another finite portion of the same burden and deadline, and no report reroll', () => {
  const f = fixture(), job = accept(f); report(f, job, 20);
  const burden = job.burden, dueAt = job.dueAt;
  expect(act(f, 'preview', { jobId: job.id }, 7201).ok).toBe(true);
  expect(act(f, 'submit', { jobId: job.id }, 7201).ok).toBe(false);
  f.p.facilities[0].condition = 55; f.p.trucks[0].shipment = null;
  expect(act(f, 'resample', { jobId: job.id }, 7201).ok).toBe(true);
  expect(job).toMatchObject({ heldQuantity: .8, burden, dueAt, sampleAt: 7201, status: 'sampleInTransit', result: null });
  expect(f.p.finance.money).toBe(1364); expect(f.wallet.money).toBe(625);
  expect(Services.recordAssay(f.s.service, job.id, { id: 'stale', sampleCollectedAt: 1, confidenceScore: 100 }, 1, 7202)).toBe(false);
});
test('cancellation and deadline expiry refund only unpaid escrow and keep shipped portions, original people and spent freight', () => {
  for (const kind of ['cancel', 'expiry']) {
    const f = fixture(), job = accept(f), before = copy(f.p.trucks);
    if (kind === 'cancel') expect(act(f, 'cancel', { jobId: job.id }).ok).toBe(true);
    else Services.advance(f.s.service, f.p, job.dueAt + 1);
    expect(f.p.finance.money).toBe(1492); expect(job.feeEscrow).toBe(0); expect(job.lotStatus).toBe('withheld');
    expect(f.p.trucks).toEqual(before); expect(f.p.shipments).toHaveLength(1);
    expect(act(f, 'cancel', { jobId: job.id }).ok).toBe(false); expect(f.wallet.money).toBe(625);
  }
});
test('dated customer knowledge omits private contamination, money, reserves and transport while away or after body change', () => {
  const f = fixture(), job = accept(f); report(f, job);
  const v = Assay.observe(f.s, f.w, f.p, f.c, 7200);
  expect(JSON.stringify(v)).not.toMatch(/burden|feeEscrow|heldQuantity|finance|trucks|canonical/);
  f.c.atDesk = false; job.lotStatus = 'unseen-change';
  expect(Assay.observe(f.s, f.w, f.p, f.c, 8000)).toEqual(v);
  f.c.atDesk = true; f.c.bodyEpoch++; expect(act(f, 'preview', { jobId: job.id }, 8000).ok).toBe(false);
  expect(f.s.observation).toEqual(v);
});
test('lease expiry blocks work and receipt but permits personal termination at the original retrieval desk', () => {
  const f = fixture(), job = accept(f); f.w.lease.endsAt = 100;
  expect(act(f, 'quote', {}, 101).ok).toBe(false);
  expect(act(f, 'submit', { jobId: job.id }, 101).ok).toBe(false);
  expect(act(f, 'cancel', { jobId: job.id }, 101).ok).toBe(true);
  expect(job.status).toBe('cancelled'); expect(f.p.finance.money).toBe(1492);
  expect(f.p.trucks[0].shipment).toBe(job.shipmentId);
});
test('missing actual receiving floor, original liaison capacity or source authority holds local delivery rather than replacing the receiver', () => {
  for (const change of [f => f.c.receivingReady = false, f => f.w.actor.fatigue = 80, f => f.w.actor.present = false,
    f => f.w.actor.roomId = 'elsewhere', f => f.c.authority.currentAuthority = false, f => f.p.facilities[0].routeOpen = false]) {
    const f = fixture(); accept(f); change(f);
    expect(Assay.deliveryReason(f.s, f.w, f.p, f.c, 2)).not.toBe('');
    expect(f.p.shipments[0].delivered).toBe(false); expect(f.p.trucks[0].shipment).toBe(f.s.service.jobs[0].shipmentId);
  }
});
