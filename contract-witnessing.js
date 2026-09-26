(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixContractWitnessing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && !p.assignment;
  function provision(state, institution, at) {
    if (!institution?.institutionId || institution.cityId !== state.homeId || institution.active !== true) return;
    state.witnessOffices ||= [];
    if (state.witnessOffices.some(o => o.institutionId === institution.institutionId)) return;
    const id = `${institution.institutionId}:contract-records`;
    state.witnessOffices.push({ id, institutionId: institution.institutionId, cityId: institution.cityId,
      witnessService: { openedAt: at, active: true, locationId: id, channelPowered: true, credentialActive: true,
        contact: { handle: `${id}:contact`, accountId: id, label: `${institution.name || institution.institutionId} contract records` },
        clerk: { id: `${id}:clerk`, name: 'Contract records clerk', locationId: id, status: 'alive', health: 100 },
        fee: 20, money: 0, power: 12, workSeconds: 14400, assignment: null, lastAt: at, records: [] } });
  }
  const ready = office => office?.witnessService.active && office.witnessService.channelPowered && office.witnessService.credentialActive
    && able(office.witnessService.clerk) && office.witnessService.clerk.locationId === office.witnessService.locationId
    && office.witnessService.locationId === office.id;
  function filingPreview(state, sh, kind = 'terms', note = '') {
    const original = sh?.witnessFilingIds?.[0];
    const office = state.witnessOffices?.find(o => o.cityId === state.homeId && ready(o)
      && (!original || o.witnessService.records.some(r => r.id === original)));
    if (!office || !sh || sh.living || !Number.isFinite(sh.bookedQuantity) || !['terms', 'cancellation', 'amendment'].includes(kind)) return null;
    if (kind === 'terms' && (sh.phase !== 'awaitingCollection' || sh.witnessFilingIds?.length)) return null;
    if (kind !== 'terms' && !sh.witnessFilingIds?.length) return null;
    if (kind === 'cancellation' && sh.phase !== 'canceled' && sh.saleFailedAt == null) return null;
    if (kind === 'amendment' && !note.trim()) return null;
    const buyerContact = sh.buyerContact;
    if (!buyerContact) return null;
    return { office: copy(office.witnessService.contact), fee: office.witnessService.fee, kind,
      senderAccount: `customer-channel:${state.homeId}`, buyerAccount: copy(buyerContact),
      terms: { reference: sh.contractId, material: sh.material, quantity: sh.bookedQuantity, sourceCityId: sh.sourceId,
        destinationCityId: sh.destinationId, agreedGross: sh.gross, localFreight: sh.localFreight, intercityFreight: sh.intercityFreight,
        deliveryDeadlineAt: sh.deliveryDeadlineAt, performanceCondition: 'Actual destination receipt required; quoted price is not proof of payment.' },
      note: kind === 'cancellation' ? 'Sender reports cancellation; not proof that no exchange occurred.' : note.trim().slice(0, 500),
      limitation: 'Permanent outside record of current account acknowledgments only. Not historical signatures, civil identity, delivery, payment or legality. Filing does not authorize investigator access or amend the commercial contract.' };
  }
  function file(state, sh, preview, wallet, at) {
    if (!preview || !equal(preview, filingPreview(state, sh, preview.kind, preview.note))) return false;
    const office = state.witnessOffices.find(o => o.witnessService.contact.accountId === preview.office.accountId), s = office.witnessService;
    if (s.assignment || s.workSeconds < 1800 || s.power < 1 || !Number.isFinite(wallet?.money) || wallet.money < s.fee || at < s.openedAt
      || s.records.some(r => r.shipmentId === sh.id && equal(r.filing, preview))) return false;
    const id = `${office.id}:filing:${s.records.length + 1}`;
    wallet.money -= s.fee; s.money += s.fee; s.power--;
    const record = { id, shipmentId: sh.id, filing: copy(preview), filedAt: at, progress: 0, lastAt: at, wasReady: true, status: 'pending',
      acknowledgments: [{ accountId: preview.senderAccount, at, scope: 'Sender approved these exact filed terms and statement.' }], releaseChoices: [] };
    s.records.push(record); s.assignment = id; sh.witnessFilingIds ||= []; sh.witnessFilingIds.push(id);
    return true;
  }
  function buyerContext(state, contact) {
    const buyer = state.buyers?.find(b => b.buyerService?.contact.handle === contact.handle && b.buyerService.contact.accountId === contact.accountId);
    const service = buyer?.buyerService, witness = service?.representatives.find(p => able(p) && p.fatigue < 80 && p.locationId === service.locationId);
    return service && witness && service.locationId === buyer.cityId && service.channelPowered && service.credentialActive && !service.assignment
      ? { service, witness } : null;
  }
  function advance(state, at) {
    for (const office of state.witnessOffices || []) {
      const s = office.witnessService, r = s.records.find(r => r.id === s.assignment && r.status === 'pending');
      if (!r || at < r.lastAt) continue;
      const sh = state.shipments.find(sh => sh.id === r.shipmentId), ctx = buyerContext(state, r.filing.buyerAccount);
      // The office does not infer a signature from a private contract or escrow ledger.
      const available = ready(office) && s.workSeconds > 0;
      const work = available && r.wasReady ? Math.min(1800 - r.progress, at - r.lastAt, s.workSeconds) : 0;
      r.progress += work; s.workSeconds -= work; r.lastAt = at; r.wasReady = available;
      if (r.progress < 1800) continue;
      const canAcknowledge = ctx && ctx.service.power >= 1
        && (r.filing.kind !== 'terms' || sh?.phase === 'awaitingCollection')
        && ctx.service.witnessTermsConsent === true && (r.filing.kind !== 'amendment' || ctx.service.witnessAmendmentConsent === true);
      if (canAcknowledge) {
        ctx.service.power--;
        r.acknowledgments.push({ accountId: ctx.service.contact.accountId, at, scope: 'Buyer account acknowledged this exact filing now, not at the original booking time.' });
      }
      r.status = canAcknowledge ? 'acknowledged' : 'missingAcknowledgment'; r.completedAt = at;
      r.receipt = { id: r.id, office: copy(s.contact), cityId: office.cityId, filedAt: r.filedAt, completedAt: at,
        kind: r.filing.kind, terms: copy(r.filing.terms), note: r.filing.note, acknowledgments: copy(r.acknowledgments), status: r.status,
        limitation: r.filing.limitation };
      if (sh) { sh.witnessDocuments ||= []; sh.witnessDocuments.push(copy(r.receipt)); }
      s.assignment = null; s.availableAt = at;
    }
  }
  function preview(sh) {
    if (!sh?.witnessDocuments?.length) return null;
    return { kind: 'witness', sourceId: `${sh.id}:witness-package`, contact: copy(sh.witnessDocuments[0].office), records: copy(sh.witnessDocuments),
      releaseConsent: true, limitation: 'Sender consents to verification of only these receipts for this inquiry. Every other party must independently consent; no archive search or foreign compulsion.' };
  }
  function next(i) {
    const submission = i.submissions.find(s => s.document.kind === 'witness' && !(i.witnessResponses || []).some(r => r.submissionId === s.id));
    return submission ? { kind: 'witnessRecords', submission } : null;
  }
  function prepare(offices, i, submission, kind, at, allocated = false, assignment = null, buyers = []) {
    const office = offices.find(o => o.witnessService?.contact.handle === submission.document.contact?.handle
      && o.witnessService.contact.accountId === submission.document.contact?.accountId), service = office?.witnessService;
    if (!ready(office) || service.workSeconds <= 0 || !allocated && service.power < 1 || service.assignment && service.assignment !== assignment) return null;
    const selected = service.records.filter(r => submission.document.records.some(d => d.id === r.id));
    // Consent comes through the other party's own account, never from a submitter-supplied flag.
    for (const r of selected) {
      if (!submission.document.releaseConsent || r.releaseChoices.some(c => c.investigationId === i.id)) continue;
      const ctx = buyerContext({ buyers }, r.filing.buyerAccount);
      if (!ctx || ctx.service.power < 1) return null;
      ctx.service.power--;
      r.releaseChoices.push({ investigationId: i.id, at, accountId: ctx.service.contact.accountId, consent: ctx.service.witnessReleaseConsent === true });
    }
    return { service, witness: service.clerk, selected, office };
  }
  function complete(i, submission, kind, ctx, at) {
    i.witnessResponses ||= [];
    const comparisons = submission.document.records.map(d => {
      const r = ctx.selected.find(r => r.id === d.id), consent = r?.releaseChoices.find(c => c.investigationId === i.id);
      const permitted = submission.document.releaseConsent === true && consent?.consent === true;
      return { recordId: d.id, result: !r ? 'unavailable' : !permitted ? 'notReleased' : !r.receipt ? 'unavailable' : !equal(r.receipt, d) ? 'alteredCopy'
        : d.status === 'missingAcknowledgment' ? 'missingAcknowledgment' : 'matchesWitnessedTerms',
        receipt: permitted && r?.receipt && equal(r.receipt, d) ? copy(d) : null };
    });
    i.witnessResponses.push({ id: `${submission.id}:witnessRecords`, submissionId: submission.id, at, sourceGroup: ctx.service.contact.accountId,
      account: copy(ctx.service.contact), cityId: ctx.office.cityId, comparisons,
      limit: 'Independent witness of account acknowledgments only. Archive and clerk remain one source. No civil identity, payment, delivery, knowledge, guilt or foreign enforcement authority established. Nonrelease or absence is not evidence of guilt; altered copies do not identify who changed them.' });
  }
  function findings(i, cityId) {
    return (i.witnessResponses || []).map(r => ({ ...copy(r), jurisdiction: r.cityId === cityId ? 'local records office' : 'foreign records office; voluntary access only',
      exculpatory: r.comparisons.some(c => c.receipt?.kind === 'cancellation') ? 'Retain the dated cancellation statement; it does not prove nonoccurrence of every exchange.' : '' }));
  }
  return { provision, filingPreview, file, advance, preview, next, prepare, complete, findings };
});
