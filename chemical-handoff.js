(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixChemicalHandoff = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const products = { 'Unlicensed Mutagenic Primer': 'unlicensedMutagenicPrimer', 'Arcane Catalytic Suspension': 'arcaneCatalyticSuspension' };
  function items(sh) {
    return (sh?.manifest || sh?.bookedManifest)?.entries?.filter(e => e.stack?.chemicalBatch).map(e => ({ stackId: e.stack.id,
      batchId: e.stack.chemicalBatch.id, quantity: e.amount, label: e.stack.chemicalBatch.label || '',
      packaged: e.stack.chemicalBatch.packaging?.state === 'packaged' })) || [];
  }
  function preview(sh) {
    const goods = items(sh);
    if (!sh || !goods.length || sh.living || sh.receiptAt != null || sh.saleFailedAt != null || sh.chemicalHandoff || ['returned', 'canceled', 'returning'].includes(sh.phase)) return null;
    return { shipmentId: sh.id, items: goods, reports: copy(sh.examination?.reports || []),
      reportProductId: sh.propertyOrder?.rule.productId || null,
      terms: 'Offer these readable-label product declarations and these existing report copies before acceptance. Labels are claims, not assays. The receiver independently inspects, accepts, refuses or asks for verification. Ten minutes of real carrier work; no new test, custody extension or guaranteed sale. Customer copying and investigative disclosure remain separate.' };
  }
  function request(sh, quote) {
    if (!sh || !quote || sh.chemicalDisclosure || !same(quote, preview(sh))) return false;
    sh.chemicalDisclosure = copy(quote); return true;
  }
  function retain(op, sh, doc, witnessId, disclose) {
    const s = op.carrierService;
    (s.recipientRecords ||= []).push({ document: copy(doc), observerId: witnessId });
    if (disclose && s.channelPowered && s.credentialActive) {
      sh.recipientContact = copy(s.contact); (sh.recipientDocuments ||= []).push(copy(doc));
    }
  }
  function release(state, sh, op, at) {
    const j = sh.chemicalHandoff; if (!j) return;
    const p = state.buyers.find(b => b.id === sh.buyerId)?.buyerService?.representatives.find(p => p.id === j.personId);
    if (p?.assignment === j.id) { p.assignment = null; p.availableAt = at; }
    if (op.carrierService?.assignment === j.id) { op.carrierService.assignment = null; op.carrierService.availableAt = at; }
  }
  function encounter(state, sh, op, person, at) {
    if (!sh.chemicalDisclosure || sh.living || sh.saleFailedAt != null) return false;
    let j = sh.chemicalHandoff;
    const s = op.carrierService;
    if (!j) {
      const w = op.crew.find(able);
      if (!person || !w || !s || s.assignment || s.power < 1 || s.workSeconds < 600) return true;
      const prior = sh.recipientEncounter;
      j = sh.chemicalHandoff = { id: `${sh.id}:chemical-inspection`, personId: person.id, witnessId: w.id,
        observationId: prior?.personId === person.id && prior.witnessId === w.id && prior.completedAt === at ? prior.id : `${sh.id}:chemical-receiver`,
        startedAt: at, lastAt: at, progress: 0, wasReady: true, deadlineAt: Math.min(sh.deliveryDeadlineAt, at + 1800),
        phase: 'inspecting', declarations: copy(sh.chemicalDisclosure), observedItems: items(sh) };
      person.assignment = j.id; s.assignment = j.id; s.power--;
    }
    if (j.phase === 'complete') return false;
    const p = state.buyers.find(b => b.id === sh.buyerId)?.buyerService?.representatives.find(p => p.id === j.personId);
    const witness = op.crew.find(w => w.id === j.witnessId && able(w));
    const available = able(p) && p.assignment === j.id && p.locationId === sh.destinationId && witness && s.assignment === j.id
      && sh.phase === 'outbound' && sh.positionKm === sh.distanceKm && s.workSeconds > 0 && p.provisions > 0;
    const start = j.lastAt, work = available && j.wasReady ? Math.min(600 - j.progress, s.workSeconds, p.provisions * 28800, Math.max(0, Math.min(at, j.deadlineAt) - start)) : 0;
    s.workSeconds -= work; if (p) p.provisions = Math.max(0, p.provisions - work / 28800);
    j.progress += work; j.lastAt = at; j.wasReady = Boolean(available);
    if (j.progress + 1e-8 < 600) {
      if (at >= j.deadlineAt) { j.phase = 'complete'; j.accepted = false; j.completedAt = at; j.reason = 'Inspection could not finish with the original participants and finite resources.'; release(state, sh, op, at); return false; }
      return true;
    }
    const completedAt = at, preferences = p.chemicalPreferences || {};
    const observed = items(sh), unchanged = same(j.observedItems, observed) && same(j.declarations.items, observed);
    // The receiver sees only the offered copies, not later undisclosed corrections
    // in an issuer's records. Investigators independently verify those sources.
    const reports = j.declarations.reports.filter(r => r.at <= j.startedAt && r.supported && r.method === 'sealedSampleConfirmatoryAssay'
      && r.result === 'targetDetected' && r.chainIntact && r.quality?.skill >= 60 && r.quality?.calibration >= 60);
    const reportComplete = observed.every(g => reports.some(r => r.sourceStackId === g.stackId && r.sourceBatchId === g.batchId));
    const authorization = (p.chemicalAuthorizations || []).filter(a => a.cityId === sh.destinationId && a.validFrom <= completedAt && a.expiresAt > completedAt);
    const blockedProduct = j.declarations.items.some(g => (preferences.refuseDeclaredProducts || []).includes(products[g.label]));
    // This policy selects an actual spoken read-back during the witnessed visit;
    // private understanding without that response is not evidence.
    const understood = preferences.understandsDeclarations !== false && preferences.acknowledgesDeclarations !== false && observed.every(g => g.label && g.packaged);
    const verificationRequested = preferences.requireVerification === true && !reportComplete;
    j.accepted = p.receiptConsent !== false && unchanged && !blockedProduct && !verificationRequested
      && (!preferences.requireAuthorization || authorization.length > 0);
    j.reason = !unchanged ? 'Observed labels, batch identities, packaging or quantities differ from the offered declaration.' : blockedProduct ? 'Receiver refuses the declared product.'
      : verificationRequested ? 'Receiver requests supported verification; no available report resolves the request, so this handoff is refused. No test is invented.'
      : preferences.requireAuthorization && !authorization.length ? 'Receiver requires authorization and has no current copy to present.'
      : j.accepted ? 'Receiver is willing to accept after this bounded inspection.' : 'Receiver declines the transfer.';
    const premises = state.buyers.find(b => b.id === sh.buyerId)?.buyerService?.premises;
    const document = { id: `${j.id}:disclosure`, kind: 'chemicalDisclosure', shipmentReference: sh.id, observationId: j.observationId,
      serviceLocation: premises?.publicAccess && p.locationId === sh.destinationId ? { siteId: premises.id, cityId: sh.destinationId } : null,
      sourceAccountId: s.contact.accountId, cityId: sh.destinationId, at: completedAt, disclosedAt: j.startedAt,
      declarations: copy(j.declarations), observedItems: observed, unchanged, verificationRequested,
      response: j.accepted ? 'willingToAccept' : verificationRequested ? 'verificationRequested' : 'refused',
      acknowledgedProducts: understood ? j.declarations.items.map(g => products[g.label]).filter(Boolean) : [],
      acknowledgmentWitnessed: understood,
      responseStatement: understood ? 'Receiver reads back the declared product labels and states the cited reports’ recorded findings for their identified batches before deciding.' : 'No witnessed acknowledgment of product identity or report contents.',
      reportAcknowledgments: understood ? j.declarations.reports.filter(r => r.at <= j.startedAt).map(r => ({ reportId: r.id, productId: j.declarations.reportProductId,
        stackId: r.sourceStackId, batchId: r.sourceBatchId, result: r.result })) : [],
      reportIdsRead: understood ? j.declarations.reports.filter(r => r.at <= j.startedAt).map(r => r.id) : [],
      authorizationCopies: copy(authorization), reason: j.reason,
      limit: 'Witnessed disclosure and response only; not a transfer, assay, verified permit, historical knowledge or certainty of comprehension. Carrier witness and retained copy are one source.' };
    retain(op, sh, document, witness.id, p.identityDisclosureConsent === true);
    j.phase = 'complete'; j.completedAt = completedAt; j.disclosureId = document.id; release(state, sh, op, completedAt); return false;
  }
  function outcome(state, sh, op, person, at, accepted) {
    const j = sh.chemicalHandoff; if (!j || j.outcomeRecorded || j.phase !== 'complete' || person?.id !== j.personId || !j.disclosureId) return;
    const witness = op.crew.find(w => w.id === j.witnessId && able(w));
    if (!witness || !able(person) || person.locationId !== sh.destinationId || at !== j.completedAt) return;
    retain(op, sh, { id: `${j.id}:handoff`, kind: 'recipientHandoff', shipmentReference: sh.id, observationId: j.observationId,
      sourceAccountId: op.carrierService.contact.accountId, cityId: sh.destinationId, at, accepted,
      disclosureId: j.disclosureId, items: items(sh), limit: 'Observed transfer or refusal of these exact items after disclosure. Not principal, sender or driver culpability.' }, witness.id, person.identityDisclosureConsent === true);
    j.outcomeRecorded = true;
  }
  function proof(e, assessment, actorId) {
    const events = (assessment.recipientFindings || []).flatMap(f => (f.events || []).filter(event =>
      f.comparisons?.some(c => c.recordId === event.id && c.result === 'matchesCarrierCopy')));
    const handoff = events.find(h => h.kind === 'recipientHandoff' && h.accepted === true && h.observationId === actorId && h.cityId === e.cityId
      && h.at >= e.arrivedAt && h.items.some(g => g.stackId === e.observation.stackId && g.batchId && g.quantity > 0));
    const report = e.reports?.find(r => r.method === 'sealedSampleConfirmatoryAssay' && r.result === 'targetDetected' && r.supported);
    const sample = e.samples?.find(s => s.id === report?.sampleId), representation = sample?.representation;
    const item = handoff?.items.find(g => g.stackId === e.observation.stackId && g.batchId === report?.sourceBatchId);
    const goodsScope = Boolean(item && representation?.method === 'mixedSingleLiquidBatchAliquot' && representation.stackId === item.stackId
      && representation.batchId === item.batchId && representation.at <= handoff.at && item.quantity <= representation.quantity);
    const disclosure = handoff && events.find(d => d.id === handoff.disclosureId && d.kind === 'chemicalDisclosure' && d.observationId === actorId
      && d.cityId === e.cityId && d.sourceAccountId === handoff.sourceAccountId && d.disclosedAt <= d.at && d.at <= handoff.at && d.unchanged
      && same(d.observedItems, handoff.items) && same(d.declarations.items, handoff.items));
    const knowledge = Boolean(goodsScope && disclosure?.acknowledgmentWitnessed && report.chainIntact && report.quality?.skill >= 60 && report.quality?.calibration >= 60
      && report.at <= disclosure.disclosedAt && disclosure.declarations.reportProductId === e.productId
      && disclosure.reportIdsRead.includes(report.id) && disclosure.acknowledgedProducts.includes(e.productId)
      && disclosure.reportAcknowledgments?.some(a => a.reportId === report.id && a.productId === e.productId && a.stackId === item.stackId && a.batchId === item.batchId && a.result === 'targetDetected')
      && disclosure.declarations.reports.some(r => same(r, report)));
    return { transaction: handoff ? [handoff.id] : [], goodsScope,
      knowledge: knowledge ? [disclosure.id, report.id] : [], at: handoff?.at || null,
      authorizationCopies: copy(disclosure?.authorizationCopies || []), disclosureId: disclosure?.id || null };
  }
  return { preview, request, encounter, release, outcome, proof };
});
