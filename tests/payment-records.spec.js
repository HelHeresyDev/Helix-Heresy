const { test, expect } = require('@playwright/test');
const Payments = require('../payment-records');
const Market = require('../intercity-smuggling');
const Carrier = require('../carrier-corroboration');
const Buyer = require('../buyer-corroboration');
const Investigations = require('../cargo-investigations');
const copy = v => JSON.parse(JSON.stringify(v));
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture(provider = true) {
  const state = Market.create('a'), broker = { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] };
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], broker, 0);
  const p = state.paymentProviders[0], b = state.buyers[0], op = state.operators[0];
  const request = { templateId: 'offer', selectedId: 'batch', brokerId: 'broker', value: 500, cargo: { massKg: 5, volumeL: 6 }, localDistanceKm: 8,
    paymentProviderId: provider ? p.id : null, localPayee: { accountId: 'broker:freight', handle: 'broker:channel', label: 'Local collector account' },
    manifest: { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ kind: 'chemicalBatch', amount: 5, sourceStackId: 'batch', stack: { id: 'batch', quantity: 5, purity: 90 } }] } };
  const quote = Market.offer(state, op.id, request, route, 0);
  return { state, p, b, op, request, quote, advance: at => Market.advance(state, at, [route]) };
}
function booked() { const f = fixture(); const result = Market.book(f.state, f.quote, f.request, route, 'contract', 0); expect(result.ok).toBe(true); f.sh = result.shipment; f.c = f.p.cases[0]; return f; }
function report(f, kind, at) {
  if (kind === 'receivedAtDepot') Carrier.record(f.op, f.sh, kind, at, 'a', 'depot', f.request.manifest);
  else Buyer.record(f.b, f.sh, kind, at, f.request.manifest);
  Payments.relay(f.state, f.sh, at);
}
function fundedTotal(f) { return f.b.money + f.op.money + f.p.money + f.p.held + f.p.accounts.reduce((n, a) => n + a.balance, 0); }
function inquiry(f, at = 10000) {
  const r = { id: 'inquiry', sourceOrderId: 'order', reviewedRevision: 1, revisions: [{ evidence: { personObservations: [], reports: [], observation: { observerId: 'officer' } } }], reviews: [{ at, status: 'acceptedForInvestigation', elements: [] }] };
  r.investigation = { id: 'inquiry:investigation', status: 'awaitingNamedSource', interviews: [{ kind: 'officer', persons: [] }, { kind: 'examiner' }], submissions: [], corrections: [], assessments: [], notices: [{}], job: null, assessedSignature: '' };
  const gate = { id: 'gate', cityId: 'b', institutionId: 'watch', active: true, jurisdiction: 'city', criminalIntake: { active: true, cityId: 'b', referrals: [r] } };
  Investigations.provision(gate, at);
  return { gate, r, i: r.investigation, advance: at => Investigations.advance(gate, at, f.state.operators, f.state.buyers, [], [], f.state.paymentProviders) };
}
test('provider is a separate finite local service; quote is inert and optional old contracts are untouched', () => {
  const f = fixture(); expect(f.p.operator.locationId).toBe(f.p.id); expect(f.p.cityId).toBe('a');
  expect(f.quote.payment).toMatchObject({ fee: 20, gross: 500, feePayer: 'buyer' }); expect(f.p.records).toEqual([]); expect(f.b.money).toBe(10000);
  const g = fixture(false), sh = Market.book(g.state, g.quote, g.request, route, 'old', 0).shipment;
  expect(sh.paymentCase).toBeUndefined(); expect(sh.playerEscrow + sh.localEscrow + sh.freightEscrow).toBe(500);
  expect(g.p.records).toEqual([]); g.state.paymentProviderId = g.p.id; g.advance(1000); expect(g.p.records).toEqual([]); expect(Payments.preview(sh)).toBeNull();
});
test('unavailable provider, account consent and insufficient funds cannot silently fall back to direct escrow', () => {
  for (const failure of ['provider', 'operator', 'payer', 'seller', 'carrier', 'consent', 'funds', 'power', 'work']) {
    const f = fixture();
    if (failure === 'provider') f.p.active = false; if (failure === 'operator') f.p.operator.health = 0;
    if (failure === 'payer') f.b.buyerService.channelPowered = false; if (failure === 'seller') f.p.customer.credentialActive = false;
    if (failure === 'carrier') f.op.carrierService.paymentConsent = false; if (failure === 'consent') f.b.buyerService.paymentConsent = false;
    if (failure === 'funds') f.b.money = 519; if (failure === 'power') f.p.power = 0; if (failure === 'work') f.p.workSeconds = 0;
    expect(Market.offer(f.state, f.op.id, f.request, route, 0).ok, failure).toBe(false); expect(f.p.records).toEqual([]);
  }
  const f = fixture(); f.p.fee++; expect(Market.book(f.state, f.quote, f.request, route, 'changed', 0).ok).toBe(false); expect(f.b.money).toBe(10000);
});
test('funding creates one real custody balance and separate fee, funding and reservation entries', () => {
  const f = booked(); expect(f.b.money).toBe(9480); expect(f.p).toMatchObject({ money: 20, held: 500, power: 23 });
  expect(f.sh).toMatchObject({ playerEscrow: 0, localEscrow: 0, freightEscrow: 0 }); expect(fundedTotal(f)).toBe(11200);
  expect(f.sh.paymentDocuments.map(d => d.kind)).toEqual(['fundingReceived', 'providerFeePaid', 'fundsReserved']);
  expect(Payments.fund(f.state, f.sh, f.quote.payment, 0)).toBe(false); expect(fundedTotal(f)).toBe(11200); expect(f.p.cases).toHaveLength(1);
});
test('hidden delivery fields alone cannot release provider money or fabricate source records', () => {
  const f = booked(); f.sh.receiptAt = 10; f.sh.owner = f.b.id; Payments.relay(f.state, f.sh, 100); Payments.advance(f.state, 10000);
  expect(f.p.jobs).toEqual([]); expect(Market.settle(f.state, f.sh.id, 10000)).toBe(0); expect(f.p.held).toBe(500);
});
test('deleted buyer payloads cannot be relayed, while previously received provider copies survive', () => {
  for (const alreadySent of [false, true]) {
    const f = booked(); Buyer.record(f.b, f.sh, 'deliveryReceived', 100, f.request.manifest);
    if (alreadySent) Payments.relay(f.state, f.sh, 100);
    const jobs = copy(f.p.jobs), customerCopies = copy(f.sh.buyerDocuments);
    const original = f.b.buyerService.records.find(r => r.document.kind === 'deliveryReceived');
    original.document = null; original.status = 'deleted';
    Payments.relay(f.state, f.sh, 200);
    expect(f.p.jobs).toEqual(jobs); expect(f.sh.buyerDocuments).toEqual(customerCopies);
    expect(f.p.jobs.length > 0).toBe(alreadySent);
  }
});
test('authenticated reports queue work; completion is dated and cannot duplicate across reload or replay', () => {
  const f = booked(); report(f, 'receivedAtDepot', 100); expect(f.c.legs.local.status).toBe('queued'); expect(f.p.held).toBe(500);
  Payments.advance(f.state, 400); expect(f.p.jobs[0].progress).toBe(300); const saved = copy(f.state);
  Payments.advance(f.state, 700); Payments.advance(saved, 700); expect(saved).toEqual(f.state);
  expect(f.c.credits.local).toBe(f.quote.localFreight); expect(fundedTotal(f)).toBe(11200);
  Payments.relay(f.state, f.sh, 900); Payments.advance(f.state, 2000); expect(f.p.jobs).toHaveLength(1);
  const paid = Payments.claim(f.state, f.sh, 'local', f.quote.payment.local, 2000);
  expect(paid).toBe(f.quote.localFreight); expect(Payments.claim(f.state, f.sh, 'local', f.quote.payment.local, 2000)).toBe(0); expect(fundedTotal(f) + paid).toBe(11200);
});
test('provider can pay on an authenticated report without falsely certifying physical delivery', () => {
  const f = booked(); report(f, 'deliveryReceived', 100); expect(f.sh.receiptAt).toBeNull(); Payments.advance(f.state, 700);
  const amount = Market.settle(f.state, f.sh.id, 700); expect(amount).toBe(f.quote.net); expect(f.sh.receiptAt).toBeNull();
  expect(Market.settle(f.state, f.sh.id, 800)).toBe(0); expect(fundedTotal(f) + amount).toBe(11200);
  expect(f.sh.paymentDocuments.find(d => d.kind === 'authenticatedInstructionReceived').scope).toContain('Not civil identity');
});
test('real depot custody and delivery proceed separately from delayed provider processing', () => {
  const f = booked(); Market.markCollected(f.state, f.sh.id, f.request.manifest, 'courier', 10);
  expect(Market.receiveDepot(f.state, f.sh.id, f.request.manifest, 100)).toBe(0); expect(f.sh.phase).toBe('depot');
  f.p.workSeconds = 0; f.advance(100); f.advance(3700); expect(f.sh.receiptAt).toBe(3700); expect(Market.settle(f.state, f.sh.id, 3700)).toBe(0);
  f.p.workSeconds = 1200; f.advance(4000); f.advance(4600); f.advance(5200); f.advance(5800);
  expect(Market.settle(f.state, f.sh.id, 5800)).toBe(f.quote.net); expect(f.sh.receiptAt).toBe(3700);
});
test('offline messages retain their actual report time and are not backdated as provider receipt', () => {
  const f = booked(); f.p.channelPowered = false; report(f, 'deliveryReceived', 100); expect(f.p.jobs).toHaveLength(0);
  f.p.channelPowered = true; Payments.relay(f.state, f.sh, 5000); Payments.advance(f.state, 5000);
  expect(f.p.jobs[0].progress).toBe(0); const d = f.c.documents.find(d => d.kind === 'authenticatedInstructionReceived');
  expect(d.at).toBe(5000); expect(d.message.at).toBe(100); Payments.advance(f.state, 5600); expect(f.c.credits.seller).toBe(f.quote.net);
});
test('missing or altered account reports and wrong endpoints cannot trigger payments', () => {
  const f = booked(); Buyer.record(f.b, f.sh, 'deliveryReceived', 100, f.request.manifest); const d = copy(f.b.buyerService.records.at(-1).document);
  d.kind = 'receivedAtDepot'; expect(Payments.receive(f.p, f.c, d, f.b.buyerService, 100)).toBe(false);
  d.kind = 'deliveryReceived'; d.at = 0; expect(Payments.receive(f.p, f.c, d, f.b.buyerService, 100)).toBe(false);
  f.b.buyerService.credentialActive = false; Payments.relay(f.state, f.sh, 100); expect(f.p.jobs).toEqual([]);
});
test('pre-collection cancellation refunds once after processing, preserving the provider fee and custody history', () => {
  const f = booked(); expect(Market.cancel(f.state, f.sh.id, 100)).toBe(true); expect(f.b.money).toBe(9480); expect(f.p.held).toBe(500);
  f.advance(700); expect(f.b.money).toBe(9980); expect(f.p.held).toBe(0); expect(fundedTotal(f)).toBe(11200);
  f.advance(10000); expect(f.b.money).toBe(9980); expect(f.p.records.filter(r => r.document.kind === 'refundCompleted')).toHaveLength(1);
  expect(f.p.records.some(r => r.document.kind === 'fundingReceived')).toBe(true);
});
test('earned queued local freight is preserved while unused sale and transit allocations refund', () => {
  const f = booked(); report(f, 'receivedAtDepot', 100); report(f, 'cancellationAcknowledged', 200);
  Payments.advance(f.state, 700); Payments.advance(f.state, 1300); Payments.advance(f.state, 1900);
  expect(f.c.credits.local).toBe(f.quote.localFreight); expect(f.b.money).toBe(9980 - f.quote.localFreight); expect(fundedTotal(f)).toBe(11200);
  report(f, 'deliveryReceived', 2000); Payments.advance(f.state, 3000); expect(f.c.credits.seller).toBe(0);
  expect(f.c.documents.at(-1).outcome).toContain('contradictory');
});
test('outages, exhausted work and busy operators preserve balances and do not earn retroactive progress', () => {
  const f = booked(); report(f, 'deliveryReceived', 100); Payments.advance(f.state, 400); f.p.channelPowered = false;
  Payments.advance(f.state, 1000); expect(f.p.assignment).toBeNull(); f.p.channelPowered = true; Payments.advance(f.state, 5000);
  expect(f.p.jobs[0].progress).toBe(300); Payments.advance(f.state, 5300); expect(f.c.credits.seller).toBe(f.quote.net); expect(f.p.power).toBe(22);
});
test('withheld statement copies are not backfilled and corrections append without moving money', () => {
  const f = fixture(); f.p.customer.customerCopy = false; const sh = Market.book(f.state, f.quote, f.request, route, 'contract', 0).shipment;
  expect(sh.paymentDocuments).toEqual([]); f.p.customer.customerCopy = true; Payments.relay(f.state, sh, 100); expect(Payments.preview(sh)).toBeNull();
  const g = booked(), original = copy(g.p.records[0].document), before = fundedTotal(g);
  expect(Payments.correct(g.p, original.id, 'Account label transcription error; amount unchanged.', 100)).toBe(true); Payments.advance(g.state, 700);
  expect(g.p.records[0].document).toEqual(original); expect(g.c.documents.at(-1)).toMatchObject({ kind: 'recordCorrection', supersedes: original.id, moneyMovement: 0 }); expect(fundedTotal(g)).toBe(before);
});
test('independent verification discloses exact selected records, not balances, identity or delivery certification', () => {
  const f = booked(), q = inquiry(f), d = Payments.preview(f.sh);
  expect(Investigations.submit(q.gate, q.r, d, 10000)).toBe(true); q.advance(10000); q.advance(13600);
  expect(q.i.paymentResponses[0].comparisons.every(c => c.result === 'matchesProviderRecord')).toBe(true);
  const a = q.i.assessments.at(-1); expect(a.paymentFindings[0].jurisdiction).toContain('foreign'); expect(a.actors.some(a => a.id === f.b.id)).toBe(false);
  expect(JSON.stringify(d)).not.toContain('operator'); expect(JSON.stringify(d)).not.toContain('held'); expect(a.paymentFindings[0].limit).toContain('derived');
});
test('refusal, missing and altered statements reveal no replacement archive entries and freeze consent per inquiry', () => {
  for (const failure of ['payer', 'seller', 'recipient', 'provider', 'altered', 'missing']) {
    const f = booked(), q = inquiry(f), d = Payments.preview(f.sh);
    if (failure === 'payer') f.b.buyerService.paymentReleaseConsent = false;
    if (failure === 'seller') f.p.customer.releaseConsent = false;
    if (failure === 'recipient') f.p.accounts.find(a => a.contact.accountId === f.quote.payment.local.accountId).releaseConsent = false;
    if (failure === 'provider') f.p.releaseConsent = false;
    if (failure === 'altered') d.records[0].amount++;
    if (failure === 'missing') f.p.records = [];
    Investigations.submit(q.gate, q.r, d, 10000); q.advance(10000); f.b.buyerService.paymentReleaseConsent = true; q.advance(13600);
    expect(q.i.paymentResponses[0].comparisons[0].record, failure).toBeNull();
  }
});
test('investigative work shares the provider and corrections reach authorities only after fresh disclosure', () => {
  const f = booked(), q = inquiry(f), d = Payments.preview(f.sh);
  Investigations.submit(q.gate, q.r, d, 10000); q.advance(10000); expect(f.p.assignment).toBeTruthy();
  q.gate.investigationOffice.channelPowered = false; q.advance(10500); expect(f.p.assignment).toBeNull();
  q.gate.investigationOffice.channelPowered = true; q.advance(11000); q.advance(14600); const old = copy(q.i.assessments[0]);
  Payments.correct(f.p, d.records[0].id, 'Provider correction', 15000); Payments.advance(f.state, 15600); expect(q.i.assessments).toEqual([old]);
  Investigations.submit(q.gate, q.r, Payments.preview(f.sh), 16000); q.advance(16000); q.advance(19600);
  expect(q.i.assessments.at(-1).paymentFindings.at(-1).comparisons.some(c => c.record?.kind === 'recordCorrection')).toBe(true); expect(q.i.assessments[0]).toEqual(old);
});
test('provider selection cannot be stripped from an already previewed quote without new confirmation', () => {
  const f = fixture(); const changed = { ...f.request, paymentProviderId: null };
  expect(Market.book(f.state, f.quote, changed, route, 'contract', 0).ok).toBe(false);
  expect(f.b.money).toBe(10000); expect(f.state.shipments).toEqual([]); expect(f.p.held).toBe(0);
  expect(Payments.quote(f.state, { ...f.quote, livingPlan: { specimen: true } }, f.request)).toBeNull();
});
test('missing recipient accounts are not recreated and offline customer cancellation waits for communication', () => {
  const f = booked(); report(f, 'deliveryReceived', 100); f.p.accounts = f.p.accounts.filter(a => a.contact.accountId !== f.quote.payment.seller.accountId);
  const count = f.p.accounts.length; Payments.advance(f.state, 1000); expect(f.p.accounts).toHaveLength(count); expect(f.p.held).toBe(500);
  expect(Market.settle(f.state, f.sh.id, 1000)).toBe(0);
  const g = booked(); g.p.customer.channelPowered = false; g.b.buyerService.channelPowered = false;
  Market.cancel(g.state, g.sh.id, 100); expect(g.c.customerInstructions).toHaveLength(1); expect(g.p.jobs).toEqual([]);
  g.p.customer.channelPowered = true; g.b.buyerService.channelPowered = true; g.advance(1000);
  expect(g.c.documents.find(d => d.kind === 'authenticatedInstructionReceived').at).toBe(1000); expect(g.b.money).toBe(9480);
  g.advance(1600); expect(g.b.money).toBe(9980); expect(fundedTotal(g)).toBe(11200);
});
