(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCarrierCorroboration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const able = c => c?.status === 'alive' && c.health >= 50 && c.fatigue < 80;
  function provision(op, at) {
    if (op.carrierService) return;
    op.carrierService = { openedAt: at, contact: { handle: `${op.id}:records-contact`, accountId: `${op.id}:records-account`, label: `${op.name} records account` },
      channelPowered: true, credentialActive: true, policy: 'protectCompletedClients', interviewConsent: true,
      power: 6, workSeconds: 7200, records: [] };
  }
  function record(op, sh, kind, at, cityId, place, manifest = sh.manifest) {
    const service = op?.carrierService, observer = op?.crew.find(able);
    if (!service || sh.living || at < service.openedAt || !observer || service.records.some(r => r.document.shipmentReference === sh.id && r.document.kind === kind)) return;
    const document = { id: `${service.contact.accountId}:record:${service.records.length + 1}`, sourceAccountId: service.contact.accountId,
      shipmentReference: sh.id, kind, at, cityId, place,
      items: (manifest?.entries || []).map(e => ({ stackId: e.stack?.id || e.sourceReceptacleId, label: e.stack?.chemicalBatch?.label || e.material || manifest.material, quantity: e.amount })),
      scope: 'Carrier observation/booking only. No assay, verified civil identity, sale price or prior knowledge established.' };
    if (kind === 'returnedToDepot') document.deliveryOutcome = sh.receiptAt == null ? 'returnedWithoutHandoff' : 'returnedAfterHandoff';
    service.records.push({ document: copy(document), observerId: observer.id });
    // Prospective customer copies travel only through a working records channel.
    if (service.channelPowered && service.credentialActive) { sh.carrierDocuments ||= []; sh.carrierDocuments.push(copy(document)); }
  }
  function preview(sh) {
    if (!sh?.carrierContact || !sh.carrierDocuments?.length || sh.living) return null;
    return { kind: 'carrier', sourceId: `${sh.id}:carrier-package`, contact: copy(sh.carrierContact), records: copy(sh.carrierDocuments),
      limitation: 'Discloses this contact and these exact customer copies. Carrier release and interview remain voluntary. An authenticated account is not a verified civil identity; logs and their author are one source.' };
  }
  function context(operators, document) {
    const op = operators.find(o => o.carrierService?.contact.handle === document.contact?.handle
      && o.carrierService.contact.accountId === document.contact?.accountId);
    return { op, service: op?.carrierService };
  }
  function prepare(operators, i, submission, kind, at, allocated = false, assignment = null) {
    const { op, service } = context(operators, submission.document);
    if (!service || !service.channelPowered || !service.credentialActive || service.workSeconds <= 0 || !allocated && service.power < 1
      || service.assignment && service.assignment !== assignment || op.assignment || op.location !== op.sourceId || !op.crew.some(able)) return null;
    i.carrierChoices ||= [];
    let choice = i.carrierChoices.find(c => c.handle === service.contact.handle);
    if (!choice) {
      const references = new Set(submission.document.records.map(r => r.shipmentReference));
      const records = service.records.filter(r => references.has(r.document.shipmentReference));
      const delivered = records.some(r => r.document.kind === 'buyerHandoff');
      const returned = records.some(r => r.document.kind === 'returnedToDepot');
      const decision = service.policy === 'refuse' || service.policy === 'protectCompletedClients' && delivered ? 'refused'
        : service.policy === 'recordsOnly' || !service.interviewConsent || !returned ? 'recordsOnly' : 'limitedInterview';
      choice = { handle: service.contact.handle, at, decision, basis: { policy: service.policy, returned, delivered, interviewConsent: service.interviewConsent } };
      i.carrierChoices.push(choice);
    }
    const selected = service.records.filter(r => submission.document.records.some(d => d.id === r.document.id));
    const witness = kind === 'carrierInterview' ? op.crew.find(c => able(c) && selected.some(r => r.observerId === c.id)) : op.crew.find(able);
    if (!witness) return null;
    return { op, service, choice, witness, selected };
  }
  function next(i) {
    for (const submission of i.submissions.filter(s => s.document.kind === 'carrier')) {
      const records = (i.carrierResponses || []).find(r => r.submissionId === submission.id && r.kind === 'carrierRecords');
      if (!records) return { kind: 'carrierRecords', submission };
      if (records.decision === 'limitedInterview' && !(i.carrierResponses || []).some(r => r.submissionId === submission.id && r.kind === 'carrierInterview')) return { kind: 'carrierInterview', submission };
    }
    return null;
  }
  function complete(i, submission, kind, ctx, at) {
    i.carrierResponses ||= [];
    const common = { id: `${submission.id}:${kind}`, submissionId: submission.id, kind, at,
      sourceGroup: ctx.service.contact.accountId, account: copy(ctx.service.contact), decision: ctx.choice.decision,
      authentication: 'Authenticated carrier account channel; civil identity unverified.', independentSources: 1 };
    if (ctx.choice.decision === 'refused') {
      i.carrierResponses.push({ ...common, comparisons: [], statement: 'Carrier declined voluntary cooperation. Refusal supplies no evidence of guilt.' }); return;
    }
    if (kind === 'carrierRecords') {
      i.carrierResponses.push({ ...common, comparisons: submission.document.records.map(d => {
        const retained = ctx.selected.find(r => r.document.id === d.id);
        return { recordId: d.id, result: !retained ? 'unavailable' : JSON.stringify(retained.document) === JSON.stringify(d) ? 'matchesCarrierCopy' : 'contradicted',
          // No undisclosed replacement record is exposed on mismatch.
          scope: 'Comparison with this account’s retained record, not independent proof of every assertion.' };
      }), statement: 'Account confirms only the submitted copies that match its retained contemporaneous records. Missing records remain missing.' });
    } else {
      const records = ctx.selected.filter(r => r.observerId === ctx.witness.id && submission.document.records.some(d => d.id === r.document.id && JSON.stringify(d) === JSON.stringify(r.document)));
      i.carrierResponses.push({ ...common, recordIds: records.map(r => r.document.id), statement: records.length
        ? 'I witnessed only the transport events in the cited matching records. A depot handoff occurred where recorded, not necessarily in the investigating city. A return without buyer handoff does not establish a completed sale. I cannot establish the contents of sealed cargo or anyone’s earlier knowledge.'
        : 'No matching contemporaneous observation is available for this witness. I cannot supply the missing facts.' });
    }
  }
  function findings(i, cityId) {
    return (i.carrierResponses || []).map(response => {
      const document = i.submissions.find(s => s.id === response.submissionId).document;
      const matched = (response.comparisons || []).filter(c => c.result === 'matchesCarrierCopy').map(c => document.records.find(d => d.id === c.recordId));
      const returned = matched.some(d => d.kind === 'returnedToDepot' && d.deliveryOutcome === 'returnedWithoutHandoff'), handoff = matched.some(d => d.kind === 'buyerHandoff');
      return { ...copy(response), events: matched.map(d => ({ recordId: d.id, kind: d.kind, at: d.at, cityId: d.cityId,
        jurisdiction: d.cityId === cityId ? 'local observation; offense elements still require proof' : 'outside investigating city; no automatic local transaction inference' })),
        exculpatory: returned && !handoff ? 'Matching carrier records support return/non-delivery, within this single source’s scope.' : '',
        limit: 'Carrier logs and the author’s testimony are one source. No link to the unnamed gate presenter or scientist, verified civil identity, knowing unlawful commerce or authority to compel a foreign witness follows.' };
    });
  }
  return { provision, record, preview, prepare, next, complete, findings };
});
