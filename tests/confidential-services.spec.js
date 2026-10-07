const { test, expect } = require('@playwright/test');
const Services = require('../confidential-services');
const Local = require('../local-covert-market');
const Diagnostics = require('../diagnostic-system');
const Campaign = require('../campaign');
const clone = x => JSON.parse(JSON.stringify(x));
const route = { ok: true, cityId: 'a', distanceKm: 8 };
function fixture(purity = 95, contamination = 0) {
  const local = Local.create('a'), contact = { id: 'customer', name: 'Sera', trust: 20, homeCityId: 'a', serviceCityIds: ['a'] }, contacts = [contact];
  Local.bind(local, contact, 0);
  const source = Local.book(local, contact, route, 'sale', { massKg: 1, volumeL: 1 }, 0).collection;
  Local.advance(local, 1200, route);
  const manifest = { commodityKind: 'manufactured', material: 'Primer', amount: 0.9, entries: [{ kind: 'chemicalBatch', amount: 0.9, sourceStackId: 'original-stack',
    stack: { id: 'original-stack', section: 'chemicalBatches', quantity: 0.9, knownQuantity: 0.9,
      chemicalBatch: { id: 'batch', label: 'Primer', purity, contaminants: { residue: contamination }, phase: 'liquid', hazards: ['toxic'],
        tags: ['chemical'], packaging: { state: 'packaged' }, classification: { actual: 'prohibited' }, lineage: [{ secret: 'private recipe' }] } } }] };
  Local.handoff(local, 'sale', manifest, 1200); Local.advance(local, 2400, route);
  return { local, contact, contacts, source, state: Services.create(local, contacts), wallet: { money: 0 }, at: 2400 };
}
function accept(f) {
  const q = Services.request(f.state, f.local, f.contacts, route, f.at);
  const r = Services.accept(f.state, f.local, f.contacts, route, q, f.at);
  expect(r.ok).toBe(true); return r.job;
}
function receive(f, job) {
  f.at += 1200; Local.advance(f.local, f.at, route);
  expect(Services.receive(f.state, f.local, job.id, `sample:${job.round}`, { scientistPresent: true }, f.at).ok).toBe(true);
}
function assay(f, job, confidence = 90) {
  expect(Services.recordAssay(f.state, job.id, { id: `assay:${job.round}`, confidenceScore: confidence, sampleCollectedAt: job.sampleAt }, job.round, f.at + 1)).toBe(true);
}

test('only an actual local buyer-owned returned packaged liquid lot creates one finite customer account', () => {
  for (const defect of ['transit', 'owner', 'foreign', 'living', 'soul', 'volatile', 'bulk', 'empty', 'notChemical']) {
    const f = fixture(), e = f.source.manifest.entries[0];
    if (defect === 'transit') f.source.phase = 'returning';
    if (defect === 'owner') f.source.owner = 'player';
    if (defect === 'foreign') f.source.transferredTo = 'foreign-convoy';
    if (defect === 'living') e.creature = {};
    if (defect === 'soul') e.stack.chemicalBatch.hazards = ['soulDamage'];
    if (defect === 'volatile') e.stack.chemicalBatch.tags = ['volatile'];
    if (defect === 'bulk') e.stack.chemicalBatch.packaging.state = 'bulk';
    if (defect === 'empty') e.amount = 0;
    if (defect === 'notChemical') e.stack = null;
    expect(Services.create(f.local, f.contacts), defect).toBeNull();
  }
  const f = fixture(); expect(f.state).toMatchObject({ money: 500, vials: 4, workSeconds: 3600, jobs: [] });
  expect(Services.create(f.local, [{ ...f.contact, homeCityId: 'b' }])).toBeNull();
});

test('terms preserve an exact lot, funds and courier; stale confirmation and scarcity mutate nothing', () => {
  for (const defect of ['money', 'vials', 'crew', 'fuel', 'busy', 'route', 'expired', 'lot', 'terms']) {
    const f = fixture(), q = Services.request(f.state, f.local, f.contacts, route, f.at);
    const usedRoute = { ...route }, courier = f.local.couriers[0];
    if (defect === 'money') f.state.money = 1;
    if (defect === 'vials') f.state.vials = 0;
    if (defect === 'crew') courier.driver.health = 0;
    if (defect === 'fuel') courier.fuelKm = 1;
    if (defect === 'busy') courier.assignment = 'other';
    if (defect === 'route') usedRoute.distanceKm++;
    if (defect === 'expired') f.at += 3601;
    if (defect === 'lot') f.source.manifest.entries[0].stack.chemicalBatch.purity = 10;
    if (defect === 'terms') q.fee++;
    const before = clone(f);
    expect(Services.accept(f.state, f.local, f.contacts, usedRoute, clone(q), f.at).ok, defect).toBe(false);
    expect(f).toEqual(before);
  }
  const f = fixture(), before = clone(f);
  Services.request(f.state, f.local, f.contacts, route, f.at); expect(Services.decline(f.state, f.at)).toBe(true);
  expect(f.state.money).toBe(before.state.money); expect(f.state.vials).toBe(4); expect(f.contact.trust).toBe(20); expect(f.source).toEqual(before.source);
});

test('acceptance allocates a real portion, vial, escrow and paid loaded transport, without crediting player inventory', () => {
  const f = fixture(), job = accept(f), c = f.local.collections.find(c => c.id === job.collectionId);
  expect(f.source.manifest).toMatchObject({ amount: 0.8, entries: [{ amount: 0.8, analyticalHold: { jobId: job.id, status: 'awaitingTest' } }] });
  expect(f.state.money).toBe(301); expect(f.state.vials).toBe(3); expect(job.feeEscrow).toBe(180); expect(f.wallet.money).toBe(0);
  expect(c.manifest).toMatchObject({ amount: 0.1, batchId: 'batch', batch: { purity: 95 } });
  expect(Local.cancel(f.local, c.obligationId, f.at)).toBe(false);
  expect(Services.receive(f.state, f.local, job.id, 'stack', { scientistPresent: true }, f.at).ok).toBe(false);
  Local.advance(f.local, f.at + 1200, { ...route, distanceKm: 9 }); expect(c.positionKm).toBe(0);
  Local.advance(f.local, f.at + 2400, route);
  expect(Services.receive(f.state, f.local, job.id, 'stack', { scientistPresent: false }, f.at + 2400).ok).toBe(false);
  expect(Services.receive(f.state, f.local, job.id, 'stack', { scientistPresent: true }, f.at + 2400).ok).toBe(true);
  expect(c.manifest).toBeNull(); expect(c.phase).toBe('returning'); expect(f.local.couriers[0].assignment).toBe(c.id);
  expect(Services.receive(f.state, f.local, job.id, 'duplicate', { scientistPresent: true }, f.at + 2400).ok).toBe(false);
});

test('captured assays are bounded, cannot reroll, and truthful bad findings earn the same paid receipt and specific trust', () => {
  for (const [purity, contamination, status] of [[95, 0, 'released'], [40, 0, 'quarantined'], [95, 1, 'quarantined']]) {
    const f = fixture(purity, contamination), job = accept(f); receive(f, job); assay(f, job);
    expect(Services.recordAssay(f.state, job.id, { id: 'reroll', confidenceScore: 100, sampleCollectedAt: job.sampleAt }, job.round, f.at + 2)).toBe(false);
    expect(Services.submit(f.state, f.local, f.contacts, job.id, f.wallet, f.at + 2).ok).toBe(false);
    const p = Services.preview(f.state, job.id); expect(p.purity.low).toBeLessThan(purity);
    expect(Services.submit(f.state, f.local, f.contacts, job.id, f.wallet, f.at + 2).ok).toBe(true);
    expect(job.lotStatus).toBe(status); expect(f.source.manifest.entries[0].analyticalHold.status).toBe(status);
    expect(f.wallet.money).toBe(180); expect(f.contact.trust).toBe(22); expect(job.disclosed).toEqual(p);
    expect(Services.submit(f.state, f.local, f.contacts, job.id, f.wallet, f.at + 3).ok).toBe(false);
    expect(f.wallet.money).toBe(180); expect(f.source.manifest.amount).toBe(0.8);
  }
});

test('exact disclosure omits recipe, hidden classification, budgets and source truth; changed previews and disconnected accounts fail', () => {
  const f = fixture(), job = accept(f); receive(f, job); assay(f, job);
  const preview = Services.preview(f.state, job.id);
  expect(Object.keys(preview).sort()).toEqual(['batchId', 'confidence', 'contamination', 'finding', 'id', 'jobId', 'measuredAt', 'purity', 'sampleCollectedAt', 'summary']);
  expect(JSON.stringify(Services.publicView(f.state))).not.toMatch(/private recipe|signal|classification|fingerprint|money|feeEscrow|workSeconds|lineage/);
  job.preview.finding = 'unacceptable';
  expect(Services.submit(f.state, f.local, f.contacts, job.id, f.wallet, f.at + 2).ok).toBe(false);
  Services.preview(f.state, job.id); f.contact.unavailableUntil = f.at + 100;
  expect(Services.submit(f.state, f.local, f.contacts, job.id, f.wallet, f.at + 2).ok).toBe(false);
  f.contact.unavailableUntil = 0; f.source.manifest.entries[0].stack.chemicalBatch.purity = 10;
  expect(job.result.purity.high).toBe(97);
  expect(Services.submit(f.state, f.local, f.contacts, job.id, f.wallet, f.at + 2).reason).toContain('changed');
});

test('inconclusive work requires another funded physical portion, original signal and original deadline', () => {
  const f = fixture(), job = accept(f); receive(f, job); assay(f, job, 20);
  expect(Services.preview(f.state, job.id)).toBeNull();
  const before = clone(f), terms = { freight: 19, distanceKm: 8 };
  expect(Services.resample(f.state, f.local, f.contacts, route, job.id, terms, f.at + 2).ok).toBe(false); expect(f).toEqual(before);
  f.at += 1200; Local.advance(f.local, f.at, route);
  const deadline = job.dueAt, signal = clone(job.signal);
  expect(Services.resample(f.state, f.local, f.contacts, route, job.id, terms, f.at).ok).toBe(true);
  expect(job.round).toBe(2); expect(job.sampleStackId).toBe(''); expect(job.dueAt).toBe(deadline); expect(job.signal).toEqual(signal);
  expect(f.source.manifest.amount).toBe(0.7); expect(f.state.money).toBe(282); expect(f.state.vials).toBe(2);
  receive(f, job); assay(f, job); Services.preview(f.state, job.id);
  expect(Services.submit(f.state, f.local, f.contacts, job.id, f.wallet, f.at + 2).ok).toBe(true);
});

test('cancelled loaded transport physically returns once; fees refund once and freight is never refunded or cargo teleported', () => {
  const f = fixture(), job = accept(f), c = f.local.collections.find(c => c.id === job.collectionId);
  f.at += 600; Local.advance(f.local, f.at, route); expect(c.positionKm).toBe(4);
  expect(Services.stop(f.state, f.local, f.contacts, job.id, f.at)).toBe(true);
  expect(f.state.money).toBe(481); expect(f.contact.trust).toBe(19); expect(c.manifest.amount).toBe(0.1); expect(f.source.manifest.amount).toBe(0.8);
  expect(Services.stop(f.state, f.local, f.contacts, job.id, f.at)).toBe(false);
  Local.advance(f.local, f.at + 600, { ...route, ok: false }); Services.advance(f.state, f.local, f.contacts, f.at + 600);
  expect(f.source.manifest.amount).toBe(0.8);
  Local.advance(f.local, f.at + 1200, route); Services.advance(f.state, f.local, f.contacts, f.at + 1200);
  expect(f.source.manifest.amount).toBe(0.9); expect(c.manifest).toBeNull(); expect(job.sampleStatus).toBe('returned');
  Services.advance(f.state, f.local, f.contacts, f.at + 2400); expect(f.source.manifest.amount).toBe(0.9);
  expect(f.source.manifest.entries[0].analyticalHold.status).toBe('withheld');
});

test('expiry after laboratory receipt keeps actual sample custody and does not mint another customer or free funds', () => {
  const f = fixture(), job = accept(f); receive(f, job);
  Services.advance(f.state, f.local, f.contacts, job.dueAt + 1);
  expect(job).toMatchObject({ status: 'expired', sampleStatus: 'laboratory', sampleStackId: 'sample:1', feeEscrow: 0 });
  expect(f.state.money).toBe(481); expect(f.wallet.money).toBe(0); expect(f.source.manifest.amount).toBe(0.8);
  expect(Services.create(f.local, f.contacts)).toBeNull();
  expect(Services.offer(f.state, f.local, f.contacts, route, job.dueAt + 2).ok).toBe(false);
});

test('changed customer custody or batch cannot release, resample or silently mix a returned portion into another lot', () => {
  for (const defect of ['owner', 'batch']) {
    const f = fixture(), job = accept(f); receive(f, job); assay(f, job); Services.preview(f.state, job.id);
    if (defect === 'owner') f.source.owner = 'another-customer';
    else f.source.manifest.entries[0].stack.chemicalBatch.purity = 10;
    expect(Services.submit(f.state, f.local, f.contacts, job.id, f.wallet, f.at + 2).ok).toBe(false);
    expect(f.wallet.money).toBe(0); expect(f.source.manifest.amount).toBe(0.8);
  }
  const f = fixture(), job = accept(f), c = f.local.collections.find(c => c.id === job.collectionId);
  f.source.manifest.entries[0].stack.chemicalBatch.id = 'different-batch';
  Services.stop(f.state, f.local, f.contacts, job.id, f.at);
  Local.advance(f.local, f.at + 1, route); Services.advance(f.state, f.local, f.contacts, f.at + 1);
  expect(job.sampleStatus).toBe('depotHold'); expect(c.manifest.amount).toBe(0.1); expect(f.source.manifest.amount).toBe(0.8);
  const saved = clone(f); Services.advance(f.state, f.local, f.contacts, f.at + 2); expect(f).toEqual(saved);
});

test('saved transport, captured samples, exact reports and customer resources survive normalization without new-run inheritance', () => {
  const f = fixture(), job = accept(f), saved = clone(f);
  saved.state = Services.normalize(saved.state);
  expect(saved.state).toEqual(f.state);
  receive(f, job); receive(saved, saved.state.jobs[0]); expect(saved).toEqual(f);
  assay(f, job); Services.preview(f.state, job.id);
  const restored = Services.normalize(clone(f.state)); expect(restored).toEqual(f.state);
  expect(Services.submit(restored, clone(f.local), clone(f.contacts), job.id, { money: 0 }, f.at + 2).ok).toBe(true);
  const sample = Diagnostics.normalizeSample({ id: 'sample', stackId: 'stack', methodId: 'confidentialChemicalPortion', targetKind: 'confidentialService', collectedAt: job.sampleAt,
    captured: { confidentialService: { jobId: job.id, round: job.round, signal: job.signal } } });
  expect(Diagnostics.normalizeState({ samples: [sample] }).samples[0]).toEqual(sample);
  expect(Campaign.normalize().localLeverage.service).toBeNull();
  const campaign = Campaign.record(null, { kind: 'localService', known: true, alive: true, received: true, settled: true, sourceId: job.id, clientId: f.contact.id }, f.at + 2);
  expect(campaign.localLeverage.service).not.toBeNull(); expect(campaign.accomplishedAt).toBeNull();
});
