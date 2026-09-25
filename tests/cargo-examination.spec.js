const { test, expect } = require('@playwright/test');
const Market = require('../intercity-smuggling');
const Review = require('../cargo-property-review');
const Gates = require('../smuggling-checkpoints');
const Exam = require('../cargo-examination');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture(productId = 'unlicensedMutagenicPrimer') {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Gates.bind(state, [{ cityId: 'b', cellId: 'b', institutionId: 'watch', jurisdiction: 'city' }]);
  const gate = state.checkpoints[0]; Review.publish(gate, { legalStatus: 'restricted' }, { institutionId: 'court' }, 0);
  const manifest = { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ amount: 1, stack: { id: 'lot', quantity: 1, knownQuantity: 1,
    chemicalBatch: { id: 'batch', productId, purity: 90, label: 'Unlicensed Mutagenic Primer', packaging: { state: 'packaged' } } } }] };
  const request = { manifest, value: 800, cargo: { massKg: 1, volumeL: 1 }, localDistanceKm: 8 };
  const q = Market.offer(state, state.operators[0].id, request, route, 0), sh = Market.book(state, q, request, route, 'contract', 0).shipment;
  Market.markCollected(state, sh.id, manifest, 'collector', 0); Market.receiveDepot(state, sh.id, manifest, 0); Market.advance(state, 0, [route]);
  return { state, gate, sh, advance: at => Market.advance(state, at, [route]) };
}
test('screen is timed and non-destructive; confirmation consumes an exact sample and finite institutional resources', () => {
  const f = fixture(); f.advance(7200);
  expect(f.sh.examination.reports[0]).toMatchObject({ method: 'nonDestructiveSpectralScreen', result: 'consistentScreen', sampleId: null });
  expect(f.sh.manifest.amount).toBe(1); expect(f.gate.examinationLab.funds).toBe(198);
  f.advance(7300); expect(f.sh.manifest.amount).toBe(.99); expect(f.sh.examination.samples[0].quantity).toBe(.01);
  expect(f.sh.propertyOrder.status).toBe('active'); expect(f.sh.playerEscrow).toBe(0); expect(f.sh.owner).toBe('player');
  expect(f.gate.examinationLab).toMatchObject({ funds: 193, reagents: 11, seals: 11, power: 37 });
  f.advance(15000); expect(f.sh.examination.reports[1]).toMatchObject({ result: 'targetDetected', purityRange: [85, 95], chainIntact: true });
  expect(f.sh.examination.samples[0].status).toBe('consumedByAssay'); expect(f.sh.propertyOrder.status).toBe('active');
  expect(f.sh.examination.samples[0].quantity + f.sh.manifest.amount).toBe(1);
});
test('reload preserves progress, sample identity, custody and exactly-once resource use', () => {
  const f = fixture(); f.advance(8000); const loaded = JSON.parse(JSON.stringify(f.state));
  f.advance(16000); Market.advance(loaded, 16000, [route]); expect(loaded).toEqual(f.state);
  const before = JSON.stringify(f.gate.examinationLab); f.advance(20000); expect(JSON.stringify(f.gate.examinationLab)).toBe(before);
  expect(f.sh.examination.samples).toHaveLength(1); expect(f.sh.examination.reports).toHaveLength(2);
});
test('failed equipment or finite supply shortage does not regenerate assets or extend detention', () => {
  for (const reason of ['power', 'funds', 'reagents', 'examiner', 'calibration']) {
    const f = fixture(), lab = f.gate.examinationLab;
    if (reason === 'power') lab.power = 0; if (reason === 'funds') lab.funds = 0; if (reason === 'reagents') lab.reagents = 0;
    if (reason === 'examiner') lab.examiner.health = 0; if (reason === 'calibration') lab.instrument.calibration = 0;
    f.advance(100000); expect(f.sh.propertyOrder.status, reason).toBe('released');
    expect(f.sh.examination.samples).toHaveLength(0); expect(f.sh.examination.phase).toBe('stopped');
    Exam.provision(f.gate); expect(f.gate.examinationLab).toBe(lab);
  }
});
test('authority expiry returns an intact untested sample at the same gate, but never restores consumed material', () => {
  const f = fixture(); f.advance(8000); f.gate.examinationLab.examiner.health = 0;
  f.advance(100000); expect(f.sh.examination.samples[0].status).toBe('returnedToLot'); expect(f.sh.manifest.amount).toBe(1);
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.saleFailedAt).not.toBeNull();
  const used = fixture(); used.advance(100000); expect(used.sh.manifest.amount).toBe(.99); expect(used.sh.receiptAt).toBeNull();
  expect(used.sh.examination.samples[0].status).toBe('consumedByAssay'); expect(used.sh.custodian).toBe('covert-depot:a');
});
test('a broken seal produces an inconclusive report and a supported custody objection, not proof or a reroll', () => {
  const f = fixture(); f.advance(8000); f.sh.examination.samples[0].sealId = 'broken'; f.advance(16000);
  const report = f.sh.examination.reports[1]; expect(report.result).toBe('inconclusive'); expect(report.supported).toBe(false);
  expect(Exam.challenge(f.sh, report.id, 'custody', 16000)).toBe(true);
  expect(f.sh.examination.challenges[0].result).toBe('sustained'); expect(Exam.challenge(f.sh, report.id, 'custody', 16000)).toBe(false);
  expect(f.sh.examination.reports).toHaveLength(2);
});
test('method and identity challenges evaluate the saved record without guilt findings', () => {
  const f = fixture(); f.advance(16000);
  const [screen, assay] = f.sh.examination.reports;
  Exam.challenge(f.sh, screen.id, 'method', 16000); expect(screen.supported).toBe(false);
  Exam.challenge(f.sh, assay.id, 'identity', 16000); expect(f.sh.examination.challenges[1].result).toBe('notEstablished');
  assay.sourceStackId = 'wrong'; Exam.challenge(f.sh, assay.id, 'custody', 16000);
  // A distinct identity objection is evaluated on its own saved facts, not a persuasion score.
  const g = fixture(); g.advance(16000); g.sh.examination.reports[1].sourceStackId = 'wrong';
  Exam.challenge(g.sh, g.sh.examination.reports[1].id, 'identity', 16000); expect(g.sh.examination.challenges[0].result).toBe('sustained');
});
test('supported negative confirmation defeats label-only inquiry while preserving the sampled remainder', () => {
  const f = fixture('sterileReagent'); f.advance(16000);
  expect(f.sh.examination.reports[1].result).toBe('targetNotDetected'); expect(f.sh.propertyOrder.status).toBe('released');
  expect(f.sh.propertyOrder.reason).toContain('did not detect'); expect(f.sh.owner).toBe('player'); expect(f.sh.manifest.amount).toBe(.99);
});
test('a custody gap or substituted sample batch cannot produce a supported confirmation', () => {
  for (const defect of ['gap', 'batch']) {
    const f = fixture(); f.advance(8000); const sample = f.sh.examination.samples[0];
    if (defect === 'gap') sample.custody.push({ at: 7900, action: 'unknownTransfer', custodian: 'unknown' });
    else sample.sourceBatchId = 'another-batch';
    f.advance(16000); expect(f.sh.examination.reports[1].result).toBe('inconclusive'); expect(f.sh.examination.reports[1].supported).toBe(false);
    expect(f.sh.propertyOrder.status).toBe('active');
  }
});
test('the reduced tested lot remains recoverable through the existing paid physical courier path', () => {
  const Local = require('../local-covert-market'), Recovery = require('../cargo-recovery');
  const f = fixture(); f.advance(100000);
  const local = Local.create('a'), contact = { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] };
  Local.bind(local, contact, 100000);
  const localRoute = { ok: true, cityId: 'a', distanceKm: 8 }, wallet = { money: 100 };
  const q = Recovery.quote(local, f.sh, contact, localRoute, 100000);
  expect(Recovery.book(local, f.sh, contact, localRoute, q, wallet, 100000).ok).toBe(true);
  Local.advance(local, 101200, localRoute); const inventory = [];
  expect(Recovery.receive(local, f.sh, inventory, { scientistPresent: true, roomId: 'exit', cell: { x: 1, y: 1, z: 0 } }, 101200).ok).toBe(true);
  expect(inventory[0]).toMatchObject({ id: 'lot', quantity: .99, chemicalBatch: { id: 'batch' } });
  expect(f.sh.examination.samples[0]).toMatchObject({ quantity: .01, status: 'consumedByAssay' });
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.playerEscrow).toBe(0);
});
