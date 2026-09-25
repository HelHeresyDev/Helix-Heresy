(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixBuyerCorroboration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const able = p => p?.status === 'alive' && p.health >= 50 && p.fatigue < 80 && !p.assignment;
  function provision(buyer, at) {
    if (buyer.buyerService) return;
    buyer.buyerService = { openedAt: at, locationId: buyer.cityId,
      contact: { handle: `${buyer.id}:records-contact`, accountId: `${buyer.id}:records-account`, label: `${buyer.name} records account` },
      representatives: [{ id: `${buyer.id}:representative`, name: `${buyer.name} receiving representative`, status: 'alive', health: 100, fatigue: 0, locationId: buyer.cityId }],
      channelPowered: true, credentialActive: true, policy: 'protectCompletedPurchases', interviewConsent: true, power: 6, workSeconds: 7200, records: [] };
  }
  const present = service => service.representatives.filter(p => able(p) && p.locationId === service.locationId);
  const canReceive = buyer => !buyer?.buyerService || !buyer.buyerService.assignment && buyer.buyerService.locationId === buyer.cityId && present(buyer.buyerService).length > 0;
  function record(buyer, sh, kind, at, manifest = sh.manifest) {
    const service = buyer?.buyerService, observer = service && present(service)[0];
    if (!service || sh.living || at < service.openedAt || !observer || service.assignment || service.locationId !== buyer.cityId
      || service.records.some(r => r.document.shipmentReference === sh.id && r.document.kind === kind)) return;
    // Order/cancellation acknowledgments require an actual working message channel at that event.
    if (kind !== 'deliveryReceived' && (!service.channelPowered || !service.credentialActive)) return;
    if (!['orderAcknowledged', 'deliveryReceived', 'cancellationAcknowledged'].includes(kind)) return;
    const document = { id: `${service.contact.accountId}:record:${service.records.length + 1}`, sourceAccountId: service.contact.accountId,
      shipmentReference: sh.id, kind, at, cityId: buyer.cityId,
      provenance: 'buyerOriginal', participantClaim: observer.name,
      items: kind === 'cancellationAcknowledged' ? [] : (manifest?.entries || []).map(e => ({ stackId: e.stack?.id || e.sourceReceptacleId,
        label: e.stack?.chemicalBatch?.label || e.material || manifest.material, quantity: e.amount })),
      scope: kind === 'orderAcknowledged' ? 'Acknowledged order terms, not delivery, payment proof or earlier knowledge.'
        : kind === 'cancellationAcknowledged' ? 'Cancellation message received, not personal observation of the journey or proof that no exchange ever occurred.'
          : 'Personal receipt of the listed cargo only; sealed contents, civil identities and anyone’s earlier knowledge remain unverified.' };
    service.records.push({ document: copy(document), observerId: observer.id });
    if (service.channelPowered && service.credentialActive) {
      sh.buyerContact = copy(service.contact); sh.buyerDocuments ||= []; sh.buyerDocuments.push(copy(document));
    }
  }
  function preview(sh) {
    if (!sh?.buyerContact || !sh.buyerDocuments?.length || sh.living) return null;
    return { kind: 'buyer', sourceId: `${sh.id}:buyer-package`, contact: copy(sh.buyerContact), records: copy(sh.buyerDocuments),
      limitation: 'Only this contact and these customer copies are disclosed. Buyer release and interviews remain voluntary; account authentication is not civil identity or independent verification.' };
  }
  function prepare(buyers, i, submission, kind, at, allocated = false, assignment = null) {
    const buyer = buyers.find(b => b.buyerService?.contact.handle === submission.document.contact?.handle
      && b.buyerService.contact.accountId === submission.document.contact?.accountId), service = buyer?.buyerService;
    if (!service || !service.channelPowered || !service.credentialActive || service.locationId !== buyer.cityId
      || service.workSeconds <= 0 || !allocated && service.power < 1 || service.assignment && service.assignment !== assignment || !present(service).length) return null;
    const selected = service.records.filter(r => submission.document.records.some(d => d.id === r.document.id));
    i.buyerChoices ||= [];
    let choice = i.buyerChoices.find(c => c.handle === service.contact.handle);
    if (!choice) {
      const references = new Set(submission.document.records.map(d => d.shipmentReference));
      const delivered = service.records.some(r => references.has(r.document.shipmentReference) && r.document.kind === 'deliveryReceived');
      const decision = service.policy === 'refuse' || service.policy === 'protectCompletedPurchases' && delivered ? 'refused'
        : service.policy === 'recordsOnly' || !service.interviewConsent ? 'recordsOnly' : 'limitedInterview';
      choice = { handle: service.contact.handle, at, decision, basis: { policy: service.policy, delivered, interviewConsent: service.interviewConsent } };
      i.buyerChoices.push(choice);
    }
    // A replacement may answer for the account, but must not inherit personal memories.
    const witness = kind === 'buyerInterview' ? present(service).find(p => selected.some(r => r.observerId === p.id)) : present(service)[0];
    if (!witness) return null;
    return { service, choice, witness, selected };
  }
  function next(i) {
    for (const submission of i.submissions.filter(s => s.document.kind === 'buyer')) {
      const response = (i.buyerResponses || []).find(r => r.submissionId === submission.id && r.kind === 'buyerRecords');
      if (!response) return { kind: 'buyerRecords', submission };
      if (response.decision === 'limitedInterview' && !(i.buyerResponses || []).some(r => r.submissionId === submission.id && r.kind === 'buyerInterview')) return { kind: 'buyerInterview', submission };
    }
    return null;
  }
  function complete(i, submission, kind, ctx, at) {
    i.buyerResponses ||= [];
    const common = { id: `${submission.id}:${kind}`, submissionId: submission.id, kind, at,
      sourceGroup: ctx.service.contact.accountId, account: copy(ctx.service.contact), decision: ctx.choice.decision,
      authentication: 'Authenticated buyer account channel; civil identity unverified.', independentSources: 1 };
    if (ctx.choice.decision === 'refused') {
      i.buyerResponses.push({ ...common, comparisons: [], statement: 'Buyer declined voluntary cooperation. Refusal supplies no evidence of guilt.' }); return;
    }
    if (kind === 'buyerRecords') {
      i.buyerResponses.push({ ...common, comparisons: submission.document.records.map(d => {
        const retained = ctx.selected.find(r => r.document.id === d.id);
        return { recordId: d.id, result: !retained ? 'unavailable' : JSON.stringify(retained.document) === JSON.stringify(d) ? 'matchesBuyerCopy' : 'contradicted',
          scope: 'Comparison with this account’s retained copy, not independent authentication of every assertion.' };
      }), statement: 'Only matching selected records are confirmed. Missing records remain missing; no undisclosed replacement is supplied.' });
    } else {
      const records = ctx.selected.filter(r => r.observerId === ctx.witness.id && r.document.provenance === 'buyerOriginal'
        && submission.document.records.some(d => JSON.stringify(d) === JSON.stringify(r.document)));
      i.buyerResponses.push({ ...common, participantClaim: ctx.witness.name, recordIds: records.map(r => r.document.id),
        statement: records.length ? 'I personally handled only the acknowledgments or receipts cited here. An order is not delivery; a cancellation message is not an observation of the journey. I cannot establish anyone else’s identity or earlier knowledge.'
          : 'I have no relevant matching firsthand observation. Missing facts cannot be supplied from another person’s records.' });
    }
  }
  function findings(i, cityId) {
    return (i.buyerResponses || []).map(response => {
      const document = i.submissions.find(s => s.id === response.submissionId).document;
      const ids = response.recordIds || (response.comparisons || []).filter(c => c.result === 'matchesBuyerCopy').map(c => c.recordId);
      const matched = document.records.filter(d => ids.includes(d.id));
      return { ...copy(response), events: matched.map(d => ({ recordId: d.id, kind: d.kind, at: d.at, cityId: d.cityId,
        participantClaim: d.participantClaim, sourceGroup: d.sourceAccountId, independentObservation: d.provenance === 'buyerOriginal', scope: d.scope,
        jurisdiction: d.cityId === cityId ? 'local event; offense elements still require proof' : 'outside investigating city; no automatic local transaction inference' })),
        exculpatory: matched.some(d => d.kind === 'cancellationAcknowledged' && d.provenance === 'buyerOriginal') ? 'Potentially exculpatory cancellation acknowledgment; not proof that no exchange ever occurred.' : '',
        limit: 'Buyer records and their author are one source. Copied carrier material is not an independent buyer observation. Separate original receipt and carrier handoff may corroborate that event only, not civil identity, knowing unlawful commerce or foreign enforcement authority.' };
    });
  }
  return { provision, record, preview, prepare, next, complete, findings, canReceive };
});
