const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../civic-assay-mandate');
const S = require('../local-services');
const P = require('../local-market-production');
const Campaign = require('../campaign');
const Home = require('../home-institution-context');
const copy = v => JSON.parse(JSON.stringify(v));
const HOUR = 3600;
function fixture() {
  const production = P.create({ cityId: 'city', workshopCapacity: 1, productionSources: [], commodityDefinitions: [], listings: {},
    manufacturingFacilities: [{ id: 'works', kind: 'chemicalWorks', name: 'Participating works', condition: 95, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  production.workshops.find(w => w.id === 'rubber').stock = 10;
  const service = S.create(production), wallet = { money: 0 };
  const a = S.accept(service, production, 0, 5).job; a.status = 'awaitingAssay'; a.sampleStackId = 'original-qualification-sample';
  S.recordAssay(service, a.id, { id: 'qualification-assay', sampleCollectedAt: 0, confidenceScore: 90 }, 0, 10);
  S.preview(service, a.id); S.submit(service, production, a.id, wallet, 11);
  const authority = { cityId: 'city', charterId: 'charter', authorityId: 'sovereign', issuerId: 'works-office', reviewerId: 'charter-office' };
  const f = { s: C.create(authority), service, production, wallet, now: 100,
    context: { channel: true, issuerAvailable: true, reviewerAvailable: true, producerAvailable: true, equipment: true, readyAt: 200 } };
  f.sign = () => { assert.equal(C.request(f.s, service, f.now, f.context).ok, true); f.now = 200;
    C.advance(f.s, service, f.now, f.context); const terms = copy(f.s.proposal);
    assert.equal(C.sign(f.s, service, f.now, terms, f.context).ok, true); return C.current(f.s); };
  f.enroll = () => C.enroll(f.s, service, production, f.now, 5, f.context);
  f.assay = (j, confidence = 90, condition = 95) => {
    // Explicit model fixture for the physical carrier/assay adapters; no free reports in the browser test.
    j.shipmentId = `actual-truck:${j.id}`; j.consignmentId = `actual-carrier:${j.id}`; j.sampleStackId = `actual-stack:${j.id}`; j.status = 'awaitingAssay';
    assert.equal(S.recordAssay(service, j.id, { id: `assay:${j.id}`, sampleCollectedAt: j.sampleAt, confidenceScore: confidence }, j.sampleAt, f.now + 1), true);
    S.preview(service, j.id);
  };
  return f;
}
test('charter-backed named representatives are stable, run-owned and never invented for absent authority', () => {
  assert.equal(C.create(null), null); assert.equal(C.create({ cityId: 'city', authorityId: 'ruler' }), null);
  const f = fixture(), authority = copy(f.s.authority);
  assert.deepEqual(C.create(authority), f.s); assert.notEqual(f.s.issuer.id, f.s.reviewer.id);
  f.sign(); assert.deepEqual(authority, f.s.authority); assert.deepEqual(C.create(authority).mandates, []);
});
test('actual paid assessment and usable offices/equipment are required; chapter receipts confer no authority', () => {
  const f = fixture();
  for (const key of ['channel', 'issuerAvailable', 'producerAvailable', 'equipment']) assert.equal(C.request(f.s, f.service, 100, { ...f.context, [key]: false }).ok, false);
  const noWork = S.create(f.production); noWork.trust = 10;
  assert.equal(C.request(f.s, noWork, 100, f.context).ok, false);
  assert.equal(C.request(f.s, f.service, 100, { ...f.context, readyAt: null }).ok, false);
});
test('queued exact quotes expire, preserve parties and must be confirmed; signing creates no resources', () => {
  const f = fixture(), before = copy(f.production), money = f.wallet.money;
  assert.equal(C.request(f.s, f.service, 100, f.context).ok, true);
  assert.equal(C.sign(f.s, f.service, 150, copy(f.s.proposal), f.context).ok, false);
  C.advance(f.s, f.service, 200, f.context);
  const forged = { ...f.s.proposal, maxBatches: 999 };
  assert.equal(C.sign(f.s, f.service, 200, forged, f.context).ok, false);
  assert.equal(C.sign(f.s, f.service, 200, copy(f.s.proposal), f.context).ok, true);
  assert.equal(C.current(f.s).endsAt, 200 + C.TERM); assert.deepEqual(f.production, before); assert.equal(f.wallet.money, money);
  const g = fixture(); C.request(g.s, g.service, 100, g.context); C.advance(g.s, g.service, 200 + C.QUOTE, g.context);
  assert.equal(C.sign(g.s, g.service, 200 + C.QUOTE, copy(g.s.proposal), g.context).ok, false);
});
test('three identified concurrent batches conserve original stock, samples and escrow and never bind another city', () => {
  const f = fixture(), m = f.sign(), stock = f.production.workshops.find(w => w.id === 'rubber'), before = stock.stock, budget = f.production.finance.money;
  const jobs = [f.enroll(), f.enroll(), f.enroll()].map(r => { assert.equal(r.ok, true); return r.job; });
  assert.equal(stock.stock, before - 3); assert.equal(f.production.finance.money, budget - 3 * 125);
  assert.equal(m.jobIds.length, 3); assert.equal(new Set(m.jobIds).size, 3); assert.equal(f.enroll().ok, false);
  assert.equal(jobs.reduce((sum, j) => sum + j.heldQuantity + .1, 0), 3);
  assert.equal(jobs.some(j => j.shipmentId || j.consignmentId || j.civic.dispatchApproved), false);
  const g = fixture(); g.sign(); g.production.cityId = 'foreign'; assert.equal(g.enroll().ok, false);
  const h = fixture(); const term = h.sign(); h.now = term.endsAt - S.WINDOW + 1; assert.equal(h.enroll().ok, false);
});
test('dispatch selection survives reload, controls authorization order and cannot preempt booked physical trips', () => {
  const f = fixture(); f.sign(); const a = f.enroll().job, b = f.enroll().job;
  assert.equal(C.prioritize(f.s, f.service, b.id, f.now).ok, true);
  f.s = C.normalize(f.s); assert.equal(C.current(f.s).priorityJobId, b.id);
  assert.equal(C.dispatch(f.s, f.service, f.now, f.context).ok, true); assert.equal(b.civic.dispatchApproved, true); assert.equal(a.civic.dispatchApproved, false);
  b.shipmentId = 'already-departed'; assert.equal(C.prioritize(f.s, f.service, b.id, f.now).ok, false);
  C.dispatch(f.s, f.service, f.now, f.context); assert.ok(b.civic.dispatchRank < a.civic.dispatchRank);
  assert.deepEqual(S.normalize(f.service), f.service);
});
test('civic holds cannot be bypassed by private submission; only exact confident truthful dispositions settle once', () => {
  for (const [condition, action, expected] of [[95, 'clear', 'released'], [55, 'quarantine', 'quarantined']]) {
    const f = fixture(); f.sign(); f.production.facilities[0].condition = condition; const j = f.enroll().job; f.assay(j);
    const money = f.wallet.money, stock = f.production.workshops.find(w => w.id === 'rubber').stock;
    assert.equal(C.decide(f.s, f.service, f.production, f.wallet, j.id, 'hold', f.now, f.context).ok, true);
    assert.equal(f.wallet.money, money); assert.equal(S.submit(f.service, f.production, j.id, f.wallet, f.now).ok, false);
    assert.equal(C.decide(f.s, f.service, f.production, f.wallet, j.id, action === 'clear' ? 'quarantine' : 'clear', f.now, f.context).ok, false);
    assert.equal(C.decide(f.s, f.service, f.production, f.wallet, j.id, action, f.now, f.context).ok, true);
    assert.equal(j.lotStatus, expected); assert.equal(f.wallet.money, money + 120);
    assert.equal(f.production.workshops.find(w => w.id === 'rubber').stock, stock + (action === 'clear' ? .9 : 0));
    assert.equal(C.decide(f.s, f.service, f.production, f.wallet, j.id, action, f.now, f.context).ok, false);
  }
});
test('uncertain assays cannot be cleared by decree; fresh portions retain original signal, deadline and batch limit', () => {
  const f = fixture(), m = f.sign(), j = f.enroll().job; f.assay(j, 20);
  assert.equal(C.decide(f.s, f.service, f.production, f.wallet, j.id, 'clear', f.now, f.context).ok, false);
  const due = j.dueAt, signal = j.burden;
  assert.equal(S.resample(f.service, f.production, j.id, f.now + 1, 5).ok, true);
  assert.equal(j.heldQuantity, .8); assert.equal(j.dueAt, due); assert.equal(j.burden, signal); assert.equal(m.jobIds.length, 1); assert.equal(j.civic.dispatchApproved, false);
});
test('expiry, absence and death grant no new authority and never release held goods or erase obligations', () => {
  const f = fixture(), m = f.sign(), j = f.enroll().job; f.assay(j);
  const saved = copy(f.s); assert.equal(C.advance(f.s, f.service, m.endsAt, { ...f.context, dead: true }), 0); assert.deepEqual(f.s, saved);
  assert.equal(C.decide(f.s, f.service, f.production, f.wallet, j.id, 'clear', f.now, { ...f.context, channel: false }).ok, false);
  const service = copy(f.service), budget = copy(f.production), money = f.wallet.money;
  C.advance(f.s, f.service, m.endsAt, f.context); assert.equal(m.status, 'expired'); assert.deepEqual(f.service, service); assert.deepEqual(f.production, budget); assert.equal(f.wallet.money, money);
  assert.equal(C.decide(f.s, f.service, f.production, f.wallet, j.id, 'clear', m.endsAt, f.context).ok, false);
  assert.equal(S.submit(f.service, f.production, j.id, f.wallet, m.endsAt).ok, false);
});
test('producer complaints, named review and frozen evidence cannot reroll; unsupported delay suspends and hands back without freeing stock', () => {
  const f = fixture(), m = f.sign(), j = f.enroll().job;
  f.now += C.DISPUTE_DELAY; C.advance(f.s, f.service, f.now, f.context); C.advance(f.s, f.service, f.now + 1, f.context);
  assert.equal(m.disputes.length, 1); assert.equal(m.disputes[0].producerId, f.service.client.id);
  assert.equal(C.fileReview(f.s, f.service, f.now, { ...f.context, readyAt: f.now + HOUR }).ok, true);
  const evidence = copy(m.review.evidence), before = copy(f.production); f.s = C.normalize(f.s);
  C.advance(f.s, f.service, f.now + HOUR, { ...f.context, reviewerAvailable: false }); assert.equal(C.current(f.s).review.status, 'pending');
  C.advance(f.s, f.service, f.now + HOUR, f.context);
  const r = C.current(f.s); assert.equal(r.review.outcome, 'suspended'); assert.deepEqual(r.review.evidence, evidence);
  assert.equal(r.status, 'returned'); assert.equal(j.civic.returned, true); assert.equal(j.heldQuantity, .9); assert.deepEqual(f.production, before);
});
test('truthful negative findings survive producer disagreement; stopped obligations revoke, not convict or confiscate', () => {
  const f = fixture(), m = f.sign(); f.production.facilities[0].condition = 55; const j = f.enroll().job; f.assay(j);
  C.decide(f.s, f.service, f.production, f.wallet, j.id, 'quarantine', f.now, f.context);
  f.now += C.DISPUTE_DELAY; C.advance(f.s, f.service, f.now, f.context);
  C.fileReview(f.s, f.service, f.now, { ...f.context, readyAt: f.now + HOUR }); C.advance(f.s, f.service, f.now + HOUR, f.context);
  assert.equal(m.review.outcome, 'upheld'); assert.equal(m.status, 'active'); assert.equal(j.lotStatus, 'quarantined');
  assert.equal(C.fileReview(f.s, f.service, f.now + HOUR, { ...f.context, readyAt: f.now + 2 * HOUR }).ok, false);
  const g = fixture(), gm = g.sign(), gj = g.enroll().job; S.stop(g.service, g.production, gj, g.now);
  C.fileReview(g.s, g.service, g.now, { ...g.context, readyAt: g.now + HOUR }); C.advance(g.s, g.service, g.now + HOUR, g.context);
  assert.equal(gm.status, 'revoked'); assert.match(gm.review.reason, /not a criminal conviction/); assert.equal(gj.heldQuantity, .9);
});
test('reviewed handback permits ordinary supported settlement, and public/campaign records omit private batch truth', () => {
  const f = fixture(), m = f.sign(), j = f.enroll().job; f.assay(j); C.relinquish(f.s, f.now);
  C.fileReview(f.s, f.service, f.now, { ...f.context, readyAt: f.now + HOUR }); C.advance(f.s, f.service, f.now + HOUR, f.context);
  assert.equal(j.civic.returned, true); assert.equal(j.lotStatus, 'awaitingTest');
  assert.equal(S.submit(f.service, f.production, j.id, f.wallet, f.now + HOUR).ok, true);
  assert.equal(S.submit(f.service, f.production, j.id, f.wallet, f.now + HOUR + 1).ok, false);
  assert.doesNotMatch(JSON.stringify(C.publicView(f.s, f.now)), /burden|heldQuantity|feeEscrow|private|workSeconds/);
  const campaign = Campaign.record(null, { kind: 'civicMandate', known: true, granted: true, sourceId: m.id, cityId: 'city', summary: 'Scoped delegation received.' }, 10);
  assert.equal(campaign.cityPower.mandate.at, 10); assert.equal(campaign.accomplishedAt, null);
  assert.equal(Campaign.record(null, { kind: 'civicMandate', known: true, granted: false, sourceId: m.id, cityId: 'city' }, 10).cityPower.mandate, null);
  assert.deepEqual(Campaign.normalize(campaign), campaign);
});
test('issuer and reviewer share finite office throughput where roles coincide; reload does not reset or accelerate work', () => {
  const home = Home.create({ cityId: 'city' }, [{ id: 'combined', role: 'publicWorksAndProvisioning', capacityBand: 'functional' },
    { id: 'combined', role: 'civicReview', capacityBand: 'functional' }]);
  const first = Home.reserve(home, 'environmental-health', 'grant', 0), second = Home.reserve(home, 'civic-review', 'review', 0);
  assert.equal(second, first * 2); assert.equal(Home.reserve(copy(home), 'civic-review', 'review', 0), second);
});
test('a producer filing uses only its allocated batch, delays and received report, never unsent laboratory findings', () => {
  const f = fixture(), m = f.sign(), j = f.enroll().job; f.assay(j);
  f.now += C.DISPUTE_DELAY; C.advance(f.s, f.service, f.now, f.context);
  assert.equal(C.fileReview(f.s, f.service, f.now, { ...f.context, readyAt: f.now + HOUR, producerFiled: true }).ok, true);
  assert.equal(m.review.filedBy, f.service.client.id); assert.equal(m.review.evidence[0].result, null);
  assert.equal(m.review.evidence[0].status, 'awaitingReport'); assert.doesNotMatch(JSON.stringify(m.review), /assay:|burden|sampleStackId|feeEscrow/);
  assert.equal(j.result.finding, 'acceptable'); assert.ok(j.preview); // Nothing sent or destroyed by the complaint.
});
test('finite account work and the exact consenting producer are revalidated without empty-stock or cash endowments', () => {
  const f = fixture(), before = copy(f.s); f.service.communicationSeconds = 0;
  assert.equal(C.request(f.s, f.service, f.now, f.context).ok, false); assert.deepEqual(f.s, before);
  const g = fixture(); C.request(g.s, g.service, g.now, g.context); C.advance(g.s, g.service, 200, g.context);
  const quote = copy(g.s.proposal); g.service.client.id = 'another-account';
  assert.equal(C.sign(g.s, g.service, 200, quote, g.context).ok, false);
  const h = fixture(); h.sign(); const budget = copy(h.production); h.production.finance.money = 0;
  assert.equal(h.enroll().ok, false); assert.equal(h.production.workshops.find(w => w.id === 'rubber').stock, budget.workshops.find(w => w.id === 'rubber').stock);
  h.production.finance.money = budget.finance.money; const j = h.enroll().job; const comms = h.service.communicationSeconds;
  assert.equal(C.dispatch(h.s, h.service, h.now, { ...h.context, producerAvailable: false }).ok, false);
  assert.equal(h.service.communicationSeconds, comms); assert.equal(j.civic.dispatchApproved, false);
});
