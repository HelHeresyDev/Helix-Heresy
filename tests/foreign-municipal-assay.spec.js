const { test, expect } = require('@playwright/test');
const Municipal = require('../foreign-municipal-assay');
const Assay = require('../foreign-industrial-assay');
const Workspace = require('../foreign-assay-workspace');
const Services = require('../local-services');
const Production = require('../local-market-production');
const Carrier = require('../local-exchange-carrier');
const copy = x => JSON.parse(JSON.stringify(x));
function world() {
  return { cityGovernments: { governments: [{ cityId: 'b', sovereigntyScope: 'cityOnly', charter: { id: 'charter:b' },
    roleAssignments: { centralAdministration: 'admin:b', publicWorksAndProvisioning: 'civic:b' }, institutions: [
      { id: 'admin:b', roles: ['centralAdministration'], capacityBand: 'functional', branches: [{ role: 'centralAdministration', id: 'admin:b:treasury' }] },
      { id: 'civic:b', publicName: 'B Provisioning', roles: ['publicWorksAndProvisioning'], capacityBand: 'functional', fundingInstitutionId: 'admin:b',
        branches: [{ role: 'publicWorksAndProvisioning', id: 'civic:b:protected-provisioning' }] }
    ] }] }, strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact' }] } };
}
function fixture(condition = 95) {
  const source = Municipal.sourceFromWorld(world(), 'b');
  const city = { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' };
  const standings = [{ standing: 'licensed', network: { id: 'research', category: 'research' }, branch: { id: 'research:b', publicName: 'B Research',
    organizationForm: 'localLaboratory', currentCityId: 'b', publicPhysicalPresence: true, operationalStatus: 'active', capacityBand: 'functional' } }];
  const authority = { cityId: 'b', currentAuthority: true, administrationId: 'admin:b' };
  const w = Workspace.create(city, standings, authority, { cityName: 'B', representativeCell: { x: 9, y: 13, z: 20 } }, 'seed', 0, 'madcap');
  w.site = { entry: { x: 10, y: 13, z: 20 } };
  const c = { city, standings, authority, alive: true, capable: true, originalBody: true, custody: false, local: true, cityId: 'b',
    bodyEpoch: 0, visitId: 'visit', tenant: 'Mira', atProperty: true, atDesk: true, contact: true, municipalContact: true, municipalSource: source, busy: false,
    visitorPermit: { cityId: 'b', bodyEpoch: 0, visitId: 'visit', expiresAt: 21600, scope: 'visitorHallOnly' } };
  const wallet = { money: 1000 }; Workspace.invite(w, c, 0); Workspace.sign(w, c, Workspace.request(w, c, 0), wallet, 0);
  const p = Production.create({ cityId: 'b', workshopCapacity: 1, manufacturingFacilities: [{ id: 'works:b', name: 'B Chemical Works', kind: 'chemicalWorks',
    condition, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  p.workshops.find(w => w.id === 'rubber').stock = 3;
  const a = Assay.create(w, p), s = Municipal.create(source, w, a);
  return { w, c, wallet, p, a, s };
}
const act = (f, kind, options = {}, now = 1) => Municipal.action(f.s, f.w, f.a, f.p, f.c, now, kind, options, f.wallet);
function consent(f) { expect(act(f, 'quote').ok).toBe(true); expect(act(f, 'consent', { expected: copy(f.s.quote) }).ok).toBe(true); }
function accept(f) { consent(f); const r = act(f, 'accept', { expected: copy(f.s.quote) }); expect(r.ok).toBe(true); return r.job; }
function report(f, j, confidence = 90) {
  j.status = 'awaitingAssay'; j.sampleStackId = 'physical-sample';
  expect(Services.recordAssay(f.s, j.id, { id: 'identified-result', sampleCollectedAt: j.sampleAt, confidenceScore: confidence }, j.sampleAt, 7200)).toBe(true);
}
test('municipal source is exact existing funded provisioning and treasury, including a combined office but not a displaced authority', () => {
  const map = world(); expect(Municipal.sourceFromWorld(map, 'b')).toMatchObject({ budget: 128, populationSourceId: 'population:b', institutionId: 'civic:b' });
  map.cityGovernments.governments[0].institutions[1].roles.unshift('emergencyManagement'); expect(Municipal.sourceFromWorld(map, 'b')).not.toBeNull();
  for (const change of [m => m.cityGovernments.governments[0].sovereigntyScope = 'jointStronghold',
    m => m.cityGovernments.governments[0].institutions[1].fundingInstitutionId = 'other',
    m => m.cityGovernments.governments[0].institutions[0].branches = [], m => m.cityGovernments.governments[0].institutions[1].branches = [],
    m => m.strategicPlayableSettlementState.cityRows[0].currentPopulation = 3,
    m => m.strategicCivicHistory = { currentInstitutionRows: [] },
    m => m.strategicCivicHistory = { currentInstitutionRows: ['admin:b', 'civic:b'].map(institutionId => ({ institutionId, actualControlStatus: 'occupation', operationalStatus: 'active', currentCapacityBand: 'strong' })) }]) {
    const bad = world(); change(bad); expect(Municipal.sourceFromWorld(bad, 'b')).toBeNull();
  }
});
test('one saved original officer and finite departmental allocation create no factory stock, private trust, people or transport', () => {
  const f = fixture(), before = copy(f.p), original = copy(f.s.actor);
  expect(f.s.money).toBe(128); expect(f.a.service.trust).toBe(0); expect(f.s.actor.id).not.toBe(f.w.actor.id);
  expect(Municipal.create({ ...f.s.source, cityId: 'other' }, f.w, f.a)).toBeNull();
  expect(f.p).toEqual(before); expect(copy(f).s.actor).toEqual(original); expect(copy(f).s.money).toBe(128);
});
test('exact supplier consent holds a real captured batch; city books original freight and escrow, never the factory fee account', () => {
  const f = fixture(); expect(act(f, 'quote').ok).toBe(true); const q = copy(f.s.quote);
  expect(act(f, 'accept', { expected: q }).ok).toBe(false);
  expect(act(f, 'consent', { expected: { ...q, supplierId: 'other' } }).ok).toBe(false);
  expect(act(f, 'consent', { expected: q }).ok).toBe(true); expect(f.p.workshops.find(w => w.id === 'rubber').stock).toBe(2);
  expect(act(f, 'consent', { expected: f.s.quote }).ok).toBe(false);
  f.p.facilities[0].condition = 55;
  const before = copy(f.p.finance), r = act(f, 'accept', { expected: copy(f.s.quote) }); expect(r.ok).toBe(true);
  expect(r.job).toMatchObject({ burden: 5, heldQuantity: .9, feeEscrow: 120, status: 'sampleInTransit', dueAt: 172801 });
  expect(f.p.finance.money).toBe(before.money); expect(f.p.finance.transportEarned).toBe((before.transportEarned || 0) + 8); expect(f.s.money).toBe(0);
  expect(f.p.trucks).toHaveLength(2); expect(f.p.trucks[0].fuelKm).toBe(232); expect(f.a.service.jobs).toEqual([]); expect(f.wallet.money).toBe(625);
  expect(act(f, 'accept', { expected: q }).ok).toBe(false);
});
test('no booking on absent consent, mismatched city or body, lost institution, unavailable source stock or original staff or trucks', () => {
  for (const change of [f => f.c.municipalContact = false, f => f.c.contact = false, f => f.c.custody = true,
    f => f.c.originalBody = false, f => f.c.busy = true, f => f.c.municipalSource.institutionId = 'other',
    f => f.s.actor.status = 'dead', f => f.s.actor.id = 'replacement', f => f.s.actor.roomId = 'elsewhere', f => f.w.actor.status = 'dead',
    f => f.s.money = 127, f => f.s.money = NaN, f => f.s.communicationSeconds = NaN, f => f.s.communicationSeconds = 120,
    f => f.p.facilities[0].routeOpen = false, f => f.p.facilities[0].expertise = [], f => f.w.lease.endsAt = 3000,
    f => f.p.workshops.find(w => w.id === 'rubber').stock = 0, f => f.p.trucks.forEach(t => t.shipment = 'busy')]) {
    const f = fixture(); change(f); expect(act(f, 'quote').ok).toBe(false); expect(f.s.jobs).toEqual([]);
  }
  const f = fixture(); consent(f); f.c.bodyEpoch++;
  expect(act(f, 'accept', { expected: f.s.quote }).ok).toBe(false); expect(f.s.money).toBe(128);
});
test('expired unbooked consent returns original supplier stock once through save/load without any sample or freight', () => {
  let f = fixture(); consent(f); f = copy(f);
  expect(Municipal.advance(f.s, f.a, f.p, 61)).toBe(true); expect(f.p.workshops.find(w => w.id === 'rubber').stock).toBe(3);
  expect(Municipal.advance(f.s, f.a, f.p, 62)).toBe(false); expect(f.s.money).toBe(128); expect(f.p.shipments).toEqual([]);
});
test('original sample truck and destination retain booked cargo across receiver failure and save/load', () => {
  let f = fixture(), j = accept(f), sh = f.p.shipments[0]; sh.destination.closed = true;
  const support = Carrier.support(Carrier.create('b')).supplier;
  Production.advance(f.p, 3700, {}, support); expect(sh.delivered).toBe(false); f = copy(f);
  f.p.shipments[0].destination.closed = false; Production.advance(f.p, 11100, {}, support);
  expect(f.p.serviceDepot[sh.id]).toMatchObject({ serviceJobId: j.id, sampleAt: j.sampleAt, quantity: 1 });
  expect(f.s.jobs[0].sampleStackId).toBe(''); expect(f.s.jobs[0].reportReceipt).toBeNull(); expect(f.wallet.money).toBe(625);
});
test('clean and contaminated reports pay equally only on exact personal municipal receipt, never create legal dispositions or private trust', () => {
  for (const condition of [95, 55]) {
    let f = fixture(condition), j = accept(f); report(f, j);
    expect(act(f, 'submit', { jobId: j.id }, 7201).ok).toBe(false);
    expect(act(f, 'preview', { jobId: j.id }, 7201).ok).toBe(true);
    f.c.municipalContact = false; expect(act(f, 'submit', { jobId: j.id }, 7201).ok).toBe(false); f.c.municipalContact = true;
    const reviewed = copy(j.preview); j.preview.id = 'substituted'; expect(act(f, 'submit', { jobId: j.id }, 7201).ok).toBe(false); j.preview = reviewed;
    f = copy(f); expect(act(f, 'submit', { jobId: j.id }, 7201).ok).toBe(true); j = f.s.jobs[0];
    expect(j.reportReceipt).toMatchObject({ reportId: 'identified-result', institutionId: 'civic:b', scope: 'Advisory supplier batch assessment only' });
    expect(j.lotStatus).toBe('supplierWithheld'); expect(f.wallet.money).toBe(745); expect(f.a.service.trust).toBe(0); expect(f.s.money).toBe(0);
    expect(f.p.workshops.find(w => w.id === 'rubber').stock).toBe(2); expect(act(f, 'submit', { jobId: j.id }, 7202).ok).toBe(false);
    expect(act(f, 'quote', {}, 7203).ok).toBe(false); expect(f.s.actor.id).toBe(f.s.allocation.institutionId + ':protected-provisioning:assay-customer');
  }
});
test('inconclusive work is unpaid; expiry or personal cancellation refunds city escrow once, not supplier finances or spent freight', () => {
  for (const kind of ['cancel', 'expiry']) {
    const f = fixture(), j = accept(f); report(f, j, 20); act(f, 'preview', { jobId: j.id }, 7201);
    expect(act(f, 'submit', { jobId: j.id }, 7201).ok).toBe(false); const factoryMoney = f.p.finance.money;
    if (kind === 'cancel') { f.w.lease.endsAt = 100; expect(act(f, 'cancel', { jobId: j.id }, 7202).ok).toBe(true); }
    else Municipal.advance(f.s, f.a, f.p, j.dueAt + 1);
    expect(f.s.money).toBe(120); expect(j.feeEscrow).toBe(0); expect(f.p.finance.money).toBe(factoryMoney); expect(f.wallet.money).toBe(625);
    Municipal.advance(f.s, f.a, f.p, j.dueAt + 2); expect(f.s.money).toBe(120); expect(f.p.shipments).toHaveLength(1);
  }
});
test('municipal observations remain dated while absent or after body or authority change, omitting hidden captured burden and escrow', () => {
  const f = fixture(), j = accept(f); report(f, j);
  const observed = Municipal.observe(f.s, f.w, f.c, 7200); expect(JSON.stringify(observed)).not.toMatch(/burden|feeEscrow|heldQuantity|trucks|finance/);
  for (const change of [() => f.c.atDesk = false, () => { f.c.atDesk = true; f.c.bodyEpoch++; }]) {
    change(); j.status = 'unseen-change'; expect(Municipal.observe(f.s, f.w, f.c, 8000)).toEqual(observed);
  }
});
