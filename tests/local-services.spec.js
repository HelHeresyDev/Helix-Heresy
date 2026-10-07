const { test, expect } = require('@playwright/test');
const Services = require('../local-services');
const Production = require('../local-market-production');
const Carrier = require('../local-exchange-carrier');
const Campaign = require('../campaign');
const Lifecycle = require('../run-lifecycle');
const Diagnostics = require('../diagnostic-system');
const clone = value => JSON.parse(JSON.stringify(value));
const hour = 3600;
function fixture(condition = 95) {
  const production = Production.create({ cityId: 'city', workshopCapacity: 1, productionSources: [],
    manufacturingFacilities: [{ id: 'chemical-works', kind: 'chemicalWorks', name: 'Local Chemical Works', condition, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }],
    commodityDefinitions: [], listings: {} });
  production.workshops.find(w => w.id === 'rubber').stock = 10;
  production.workshops.find(w => w.id === 'assayReagent').stock = 8;
  return { state: Services.create(production), production, wallet: { money: 0 }, supplier: Carrier.support(Carrier.create('city')).supplier };
}
function readyJob(f, at = 0, confidence = 90) {
  const accepted = Services.accept(f.state, f.production, at, 5);
  expect(accepted.ok).toBe(true);
  const job = accepted.job;
  job.status = 'awaitingAssay'; job.sampleStackId = `stack:${job.id}`;
  expect(Services.recordAssay(f.state, job.id, { id: `result:${job.id}`, sampleCollectedAt: at, confidenceScore: confidence }, at, at + 1)).toBe(true);
  return job;
}
function complete(f, at = 0) {
  const job = readyJob(f, at);
  Services.preview(f.state, job.id);
  expect(Services.submit(f.state, f.production, job.id, f.wallet, at + 2).ok).toBe(true);
  return job;
}

test('only an actual supported local factory creates a named customer; acceptance conserves batch and escrow', () => {
  expect(Services.create(null)).toBeNull();
  expect(Services.create({ facilities: [] })).toBeNull();
  const f = fixture(), before = clone(f.production);
  const { job } = Services.accept(f.state, f.production, 10, 5);
  expect(f.state.client.name).toBeTruthy();
  expect(f.production.finance.money).toBe(before.finance.money - 125);
  expect(f.production.workshops.find(w => w.id === 'rubber').stock).toBe(9);
  expect(job).toMatchObject({ heldQuantity: 0.9, feeEscrow: 120, sampleAt: 10, dueAt: 10 + Services.WINDOW, status: 'accepted' });
  expect(f.wallet.money).toBe(0);
  expect(Services.accept(f.state, f.production, 11, 5).ok).toBe(false);
});

test('declining costs no resources or confidence; unavailable staff, budgets and stock refuse without rerolls', () => {
  const f = fixture(), before = clone(f.production);
  expect(Services.decline(f.state, 0)).toBe(true);
  expect(f.production).toEqual(before); expect(f.state.trust).toBe(0);
  for (const [field, value] of [['routeOpen', false], ['labour', 0], ['utilities', 0], ['condition', 0]]) {
    const g = fixture(); g.production.facilities[0][field] = value;
    expect(Services.accept(g.state, g.production, 0).ok).toBe(false);
  }
  const poor = fixture(); poor.production.finance.money = 1;
  expect(Services.accept(poor.state, poor.production, 0).reason).toContain('fund');
  const empty = fixture(); empty.production.workshops.find(w => w.id === 'rubber').stock = 0;
  expect(Services.accept(empty.state, empty.production, 0).reason).toContain('batch');
});

test('customer samples share finite producer trucks and need physical depot receipt before last-mile freight', () => {
  const f = fixture(), { job } = Services.accept(f.state, f.production, 0);
  const sh = Production.bookServiceCargo(f.production, f.state.client.facilityId, 'diagnosticSample', 1, 0);
  expect(sh).toMatchObject({ target: 'serviceDepot', delivered: false, quantity: 1 });
  expect(f.production.serviceDepot).toBeUndefined();
  const truck = f.production.trucks.find(t => t.id === sh.truckId);
  expect(truck.fuelKm).toBe(232);
  truck.driver.health = 0;
  Production.advance(f.production, hour, {}, f.supplier);
  expect(sh.delivered).toBe(false);
  truck.driver.health = 100;
  Production.advance(f.production, 2 * hour, {}, f.supplier);
  expect(sh.delivered).toBe(true);
  expect(f.production.serviceDepot[sh.id].quantity).toBe(1);
  Production.advance(f.production, 2 * hour, {}, f.supplier);
  expect(f.production.serviceDepot[sh.id].quantity).toBe(1);
  expect(f.production.trucks).toHaveLength(2);
  expect(job.sampleStackId).toBe('');
});

test('truthful clear and contaminated reports earn equal fees, but only the clear batch returns to usable stock', () => {
  for (const [condition, status, quantity] of [[95, 'released', 9.9], [55, 'quarantined', 9]]) {
    const f = fixture(condition), job = readyJob(f);
    expect(Services.submit(f.state, f.production, job.id, f.wallet, 2).ok).toBe(false);
    Services.preview(f.state, job.id);
    expect(Services.submit(f.state, f.production, job.id, f.wallet, 2).ok).toBe(true);
    expect(f.wallet.money).toBe(120); expect(job.lotStatus).toBe(status);
    expect(f.production.workshops.find(w => w.id === 'rubber').stock).toBeCloseTo(quantity);
    expect(Services.submit(f.state, f.production, job.id, f.wallet, 3).ok).toBe(false);
    expect(f.wallet.money).toBe(120); expect(f.state.trust).toBe(1);
  }
});

test('report disclosures are exact whitelists, altered previews fail, and private signal never appears in public view', () => {
  const f = fixture(), job = readyJob(f);
  const preview = Services.preview(f.state, job.id);
  expect(Object.keys(preview).sort()).toEqual(['confidence', 'finding', 'id', 'jobId', 'measuredAt', 'sampleCollectedAt', 'summary']);
  expect(JSON.stringify(Services.publicView(f.state))).not.toMatch(/burden|feeEscrow|heldQuantity|genome|canonical|finance/);
  job.preview.summary = 'Fabricated clean bill of health';
  expect(Services.submit(f.state, f.production, job.id, f.wallet, 2).ok).toBe(false);
  expect(f.wallet.money).toBe(0);
  Services.preview(f.state, job.id);
  f.production.facilities[0].utilities = 0;
  expect(Services.submit(f.state, f.production, job.id, f.wallet, 3).ok).toBe(false);
});

test('inconclusive work requires another physical portion, unchanged signal and original deadline', () => {
  const f = fixture(), job = readyJob(f, 0, 20);
  const dueAt = job.dueAt, burden = job.burden;
  Services.preview(f.state, job.id);
  expect(Services.submit(f.state, f.production, job.id, f.wallet, 2).ok).toBe(false);
  expect(Services.recordAssay(f.state, job.id, { id: 'reroll', sampleCollectedAt: 0, confidenceScore: 100 }, 0, 2)).toBe(false);
  expect(Services.resample(f.state, f.production, job.id, 3, 5).ok).toBe(true);
  expect(job).toMatchObject({ heldQuantity: 0.8, status: 'accepted', sampleStackId: '', burden, dueAt });
  expect(f.wallet.money).toBe(0);
  expect(Services.assay(35, 70).finding).toBe('inconclusive');
});

test('missed deadlines and cancellation refund once without teleporting samples, resetting legal history or ending life', () => {
  const f = fixture(), job = readyJob(f);
  job.shipmentId = 'departed'; job.consignmentId = 'allocated-last-mile'; f.state.trust = 3;
  const budget = f.production.finance.money;
  expect(Services.advance(f.state, f.production, job.dueAt + 1)).toBe(true);
  expect(job).toMatchObject({ status: 'expired', feeEscrow: 0, sampleStackId: `stack:${job.id}`, lotStatus: 'withheld' });
  expect(f.production.finance.money).toBe(budget + 120); expect(f.state.trust).toBe(2);
  const saved = clone(f.state);
  expect(Services.advance(f.state, f.production, job.dueAt + 2)).toBe(false);
  expect(f.state).toEqual(saved);
  expect(Lifecycle.phase({ localServices: f.state, investigations: { open: true } })).toBe('active');
});

test('materials reservations remove real stock, respect competing needs, expire once and require paid physical delivery', () => {
  const f = fixture(); complete(f); complete(f, 24 * hour);
  const stock = f.production.workshops.find(w => w.id === 'assayReagent');
  stock.stock = 3;
  expect(Services.reserve(f.state, f.production, 24 * hour + 3, 31, 2).reason).toContain('cannot spare');
  stock.stock = 8;
  const reserved = Services.reserve(f.state, f.production, 24 * hour + 4, 31, 2);
  expect(reserved.ok).toBe(true); expect(stock.stock).toBe(6);
  expect(Services.reserve(f.state, f.production, 24 * hour + 5, 31, 2).ok).toBe(false);
  const budget = f.production.finance.money, money = f.wallet.money;
  expect(Services.purchase(f.state, f.production, f.wallet, 24 * hour + 5).ok).toBe(true);
  expect(f.wallet.money).toBe(money - 62); expect(f.production.finance.money).toBe(budget + 58);
  expect(reserved.reservation.consignmentId).toBe('');
  expect(Services.purchase(f.state, f.production, f.wallet, 24 * hour + 6).ok).toBe(false);
  complete(f, 48 * hour);
  expect(Services.reserve(f.state, f.production, 48 * hour + 3, 31, 2).reason).toContain('paid cargo');
  reserved.reservation.consignmentId = 'physically-booked-freight';
  expect(Services.reserve(f.state, f.production, 48 * hour + 4, 31, 2).ok).toBe(true);
  const g = fixture(); complete(g); complete(g, 24 * hour);
  Services.reserve(g.state, g.production, 24 * hour + 3, 31, 2);
  const before = g.production.workshops.find(w => w.id === 'assayReagent').stock;
  Services.advance(g.state, g.production, 28 * hour + 3);
  expect(g.production.workshops.find(w => w.id === 'assayReagent').stock).toBe(before + 2);
  Services.advance(g.state, g.production, 28 * hour + 4);
  expect(g.production.workshops.find(w => w.id === 'assayReagent').stock).toBe(before + 2);
});

test('JSON normalization preserves pending obligations and exact previews without source-truth leakage or new-run inheritance', () => {
  const f = fixture(), job = readyJob(f); Services.preview(f.state, job.id);
  const saved = Services.normalize(clone(f.state));
  expect(saved).toEqual(f.state);
  expect(Services.submit(saved, clone(f.production), job.id, { money: 0 }, 2).ok).toBe(true);
  expect(Services.create(f.production).jobs).toEqual([]);
  const sample = Diagnostics.normalizeSample({ id: 'industrial', stackId: 'stack', methodId: 'industrialBatchPortion', targetKind: 'industrialService',
    collectedAt: 0, captured: { industrialService: { jobId: job.id, burden: job.burden } } });
  expect(Diagnostics.normalizeState({ samples: [sample] }).samples[0]).toEqual(sample);
});

test('campaign records only received paid services and actually granted reservations, never whole-city indispensability', () => {
  const outcome = { kind: 'localService', sourceId: 'job-1', clientId: 'known-account', received: true, settled: true, known: true };
  let state = Campaign.record(null, outcome, 20);
  expect(state.localLeverage.service.at).toBe(20);
  expect(Campaign.record(state, outcome, 30)).toEqual(state);
  for (const change of [{ received: false }, { settled: false }, { known: false }, { alive: false }]) expect(Campaign.record(null, { ...outcome, ...change }, 20).localLeverage.service).toBeNull();
  state = Campaign.record(state, { kind: 'localReservation', sourceId: 'reserve-1', clientId: 'known-account', granted: true, known: true }, 25);
  expect(state.accomplishedAt).toBeNull();
  const report = Lifecycle.captureReport({ runEnded: true }, { accomplishments: Campaign.accomplishments(state) });
  expect(report.accomplishments).toHaveLength(2);
  expect(JSON.stringify(report)).not.toMatch(/burden|known-account|genome/);
  expect(Lifecycle.normalizeReport({ accomplishments: Array.from({ length: 12 }, (_, at) => ({ label: `Known outcome ${at}`, at, privateFact: 'SECRET' })) }).accomplishments).toHaveLength(9);
});
