(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./buyer-identity') : root.HelixBuyerIdentity,
    typeof module === 'object' && module.exports ? require('./account-access') : root.HelixAccountAccess);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixBuyerPrincipal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Identity, Access) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const ready = o => o?.active && o.channelPowered && able(o.clerk) && o.clerk.locationId === o.id;
  const contact = o => ({ ...copy(o.contact), accountId: o.id });
  const scope = 'Identified giver and recipient of this prospective instruction only. Not company ownership, an unseen employer or ultimate beneficiary, account control, earlier negotiation, payment, delivery, knowledge of illegal contents, guilt or enforcement authority. No onward delegation.';
  function provision(buyer, at, individual = false) {
    if (!buyer?.buyerService || buyer.principalSetupAt != null) return;
    buyer.principalSetupAt = at;
    const p = individual ? buyer.buyerService.representatives[0] : { id: `${buyer.id}:principal`, name: `${buyer.name} purchasing principal`, status: 'alive', health: 100, fatigue: 0, locationId: buyer.cityId };
    if (!individual) { Identity.provisionPerson(p); buyer.principals = [p]; }
    buyer.principalPersonId = p.id;
    for (const person of [p, ...buyer.buyerService.representatives]) person.authorityConsent = { appointment: true, instruction: true, customerCopy: true, release: true, revoke: true };
    // Explicit new-scenario participants, not documentary proof of ownership or past instructions.
  }
  const people = b => [...(b?.principals || []), ...(b?.buyerService?.representatives || [])].filter(Boolean);
  const principal = b => people(b).find(p => p.id === b?.principalPersonId);
  function registrationView(b) {
    const p = principal(b); if (!p) return null;
    return { ...b, identityTrip: b.principalRegistrationTrip, buyerService: { ...b.buyerService, representatives: [p] } };
  }
  function registrationPreview(state, b) { const v = registrationView(b); return v ? Identity.preview(state, v) : null; }
  function register(state, b, quote, at) {
    const v = registrationView(b); if (!v || !Identity.request(state, v, quote, at)) return false;
    b.principalRegistrationTrip = v.identityTrip; return true;
  }
  function terms(sh) {
    return { shipmentReference: sh.id, contractReference: sh.contractId, material: sh.material, quantity: sh.bookedQuantity,
      price: sh.gross, fingerprint: sh.fingerprint, destination: sh.destinationId, expiresAt: sh.deliveryDeadlineAt,
      conditions: sh.terms || '', batchRequirements: copy(sh.batchRequirements || null),
      actions: ['acknowledgeSpecifiedTerms', 'receiveSpecifiedConsignment'] };
  }
  const pending = sh => sh && !sh.living && Number.isFinite(sh.bookedQuantity) && !['canceled', 'returned', 'returning', 'forfeited'].includes(sh.phase) && sh.receiptAt == null;
  function recordFor(state, id) {
    for (const o of state.identityOffices || []) { const r = o.authorityRecords?.find(r => r.id === id); if (r) return { o, r }; }
    return null;
  }
  function preview(state, b, sh, kind = 'authorize', originalId = null) {
    if (!b || b.authorityTrip || !['authorize', 'revoke'].includes(kind)) return null;
    const p = principal(b), rep = Identity.representative(b), participants = [...new Set([p, rep])];
    if (!p || !rep || participants.some(p => !able(p) || p.assignment || p.locationId !== b.cityId || !p.civicDocument || !p.authorityConsent?.appointment)) return null;
    const o = state.identityOffices?.find(o => ready(o) && o.cityId === b.cityId && o.route.open && participants.every(p => p.civicDocument.issuer.handle === o.contact.handle));
    if (!o || sh?.buyerId !== b.id || !pending(sh)) return null;
    const prior = kind === 'revoke' ? recordFor(state, originalId) : null;
    if (kind === 'revoke' && (!prior || prior.o !== o || prior.r.principalId !== p.id || prior.r.representativeId !== rep.id || prior.r.receipt.terms.shipmentReference !== sh.id || prior.r.receipt.result !== 'supported' || prior.r.revokedAt != null)) return null;
    return { buyerId: b.id, officeId: o.id, kind, originalId, principal: copy(p.civicDocument), representative: copy(rep.civicDocument),
      terms: terms(sh), fee: o.fee, roundTripKm: o.route.distanceKm * 2, workSeconds: 1800,
      warning: 'Buyer-funded voluntary joint attendance at 4 km/h. Nonrefundable fee when clerk work starts; thirty minutes of shared clerk work. Separate identity checks, express instruction and acceptance required. No past records are rewritten. ' + scope };
  }
  function request(state, b, quote, at) {
    const sh = state.shipments.find(s => s.id === quote?.terms?.shipmentReference);
    if (!quote || !same(quote, preview(state, b, sh, quote.kind, quote.originalId)) || quote.terms.expiresAt <= at) return false;
    const p = principal(b), rep = Identity.representative(b, at), participants = [...new Set([p, rep])], o = state.identityOffices.find(o => o.id === quote.officeId);
    if (!rep || participants.some(p => !p || (p.availableAt || 0) > at || !p.authorityConsent.instruction || quote.kind === 'revoke' && !p.authorityConsent.revoke
      || !p.civicPreferences.presentationConsent || !p.civicPreferences.verificationConsent || p.provisions < (quote.roundTripKm * 900 + 1800) / 28800 || p.fatigue + quote.roundTripKm >= 80)
      || o.assignment || o.power < 1 || o.workSeconds < 1800 || b.money < quote.fee) return false;
    o.authoritySequence = (o.authoritySequence || 0) + 1;
    const id = `${o.id}:authority:${o.authoritySequence}`;
    b.authorityTrip = { id, principalId: p.id, representativeId: rep.id, quote: copy(quote), phase: 'outbound', positionKm: 0, progress: 0, lastAt: at, wasReady: true, paid: false };
    for (const person of participants) person.assignment = id;
    return true;
  }
  function release(o, t, at) { if (o?.assignment === t.id) { o.assignment = null; o.availableAt = at; } }
  function cancel(state, b, at) {
    const t = b?.authorityTrip; if (!t || t.phase === 'returning') return false;
    const o = state.identityOffices?.find(o => o.id === t.quote.officeId);
    release(o, t, at); t.phase = 'returning'; t.lastAt = at; t.wasReady = true; t.cancelledAt = at;
    // The participants retain their actual road position and must walk back. Paid fees are not refunded.
    return true;
  }
  function publish(b, r, receipt) {
    if (r.customerCopy && b.buyerService.channelPowered && b.buyerService.credentialActive) { b.authorityDocuments ||= []; b.authorityDocuments.push(copy(receipt)); }
  }
  function finish(state, b, o, t, participants, at) {
    const p = people(b).find(p => p.id === t.principalId), rep = people(b).find(p => p.id === t.representativeId);
    const identities = [p, rep].map((p, n) => Access.identityResult(o, t.presented[n], t.observed[n], at, t.visibility));
    const sh = state.shipments.find(s => s.id === t.quote.terms.shipmentReference);
    const continuous = o.clerk.id === t.clerkId && [p, rep].every((p, n) => same(p.appearance, t.observed[n]) && same(p.civicDocument, n ? t.quote.representative : t.quote.principal)
      && p.civicPreferences.presentationConsent && p.civicPreferences.verificationConsent && p.authorityConsent.appointment && p.authorityConsent.instruction && (t.quote.kind !== 'revoke' || p.authorityConsent.revoke));
    const supported = continuous && identities.every(i => i.result === 'supported') && pending(sh) && same(terms(sh), t.quote.terms) && at < t.quote.terms.expiresAt;
    const receipt = { id: t.id, observationId: t.id, kind: t.quote.kind === 'revoke' ? 'purchasingAuthorityRevocation' : 'purchasingAuthority', originalId: t.quote.originalId,
      office: contact(o), cityId: o.cityId, at, principal: identities[0], representative: identities[1], sameAttendee: p === rep, terms: copy(t.quote.terms),
      result: supported ? 'supported' : 'unverified', instruction: supported ? t.quote.kind === 'revoke' ? 'revokedAndCommunicated' : 'givenAndAccepted' : 'notEstablished', scope };
    const r = { id: t.id, receipt: copy(receipt), principalId: p.id, representativeId: rep.id, descriptions: copy(t.observed), visibility: t.visibility,
      customerCopy: participants.every(p => p.authorityConsent.customerCopy), releaseChoices: [], actions: [], rechecks: [] };
    o.authorityRecords ||= []; o.authorityRecords.push(r); publish(b, r, receipt);
    if (supported && t.quote.kind === 'revoke') { const prior = recordFor(state, t.quote.originalId); prior.r.revokedAt = at; }
  }
  function travel(state, b, at) {
    const t = b.authorityTrip; if (!t || at < t.lastAt) return;
    const ids = [...new Set([t.principalId, t.representativeId])], participants = ids.map(id => people(b).find(p => p.id === id));
    const o = state.identityOffices?.find(o => o.id === t.quote.officeId);
    let cursor = t.lastAt; t.lastAt = at;
    while (cursor < at) {
      const available = o && participants.every(p => able(p) && p.assignment === t.id && p.provisions > 0) && (t.phase === 'witnessing'
        ? ready(o) && participants.every(p => p.locationId === o.id) && (!o.assignment || o.assignment === t.id) && o.workSeconds > 0 && (t.paid || o.power >= 1 && b.money >= t.quote.fee)
        : o.route.open);
      if (!available) { release(o, t, at); t.wasReady = false; return; }
      if (!t.wasReady) { t.wasReady = true; return; }
      if (t.phase === 'witnessing') {
        const start = Math.max(cursor, o.availableAt || 0); if (start >= at) return;
        if (!t.paid) {
          b.money -= t.quote.fee; o.money += t.quote.fee; o.power--; t.paid = true; t.clerkId = o.clerk.id;
          t.observed = [t.principalId, t.representativeId].map(id => copy(people(b).find(p => p.id === id).appearance)); t.visibility = o.authorityVisibility || 'clear';
          t.presented = [t.principalId, t.representativeId].map((id, n) => {
            const p = people(b).find(p => p.id === id), document = n ? t.quote.representative : t.quote.principal;
            return p.civicPreferences.presentationConsent && p.civicPreferences.verificationConsent && same(p.civicDocument, document) ? copy(document) : null;
          });
        }
        o.assignment = t.id;
        const work = Math.min(1800 - t.progress, at - start, o.workSeconds, ...participants.map(p => p.provisions * 28800));
        o.workSeconds -= work; for (const p of participants) p.provisions -= work / 28800;
        t.progress += work; cursor = start + work; if (t.progress < 1800) return;
        finish(state, b, o, t, participants, cursor); release(o, t, cursor); t.phase = 'returning';
      } else {
        const remaining = t.phase === 'outbound' ? t.quote.roundTripKm / 2 - t.positionKm : t.positionKm;
        const moved = Math.min(remaining, (at - cursor) / 900, ...participants.map(p => p.provisions * 32), ...participants.map(p => 80 - p.fatigue));
        if (moved <= 0 && remaining > 1e-8) return;
        cursor += moved * 900; t.positionKm += t.phase === 'outbound' ? moved : -moved;
        for (const p of participants) { p.provisions -= moved / 32; p.fatigue += moved; p.locationId = `${o.route.id}:walk:${t.positionKm.toFixed(2)}km`; }
        if (moved + 1e-8 < remaining) return;
        if (t.phase === 'outbound') { for (const p of participants) p.locationId = o.id; t.phase = 'witnessing'; }
        else { for (const p of participants) { p.locationId = b.cityId; p.assignment = null; p.availableAt = cursor; } b.authorityTrip = null; return; }
      }
    }
  }
  function action(state, b, sh, rep, kind, at) {
    if (!rep || !able(rep) || rep.assignment || rep.locationId !== b.cityId || (rep.availableAt || 0) > at || !['acknowledgeSpecifiedTerms', 'receiveSpecifiedConsignment'].includes(kind)) return false;
    const candidates = (state.identityOffices || []).flatMap(o => o.authorityRecords || []).filter(r => r.receipt.kind === 'purchasingAuthority' && r.representativeId === rep.id
      && r.receipt.result === 'supported' && r.receipt.at <= at && at < r.receipt.terms.expiresAt && !(r.revokedAt != null && r.revokedAt <= at) && !(r.withdrawal && r.withdrawal.at <= at)
      && same(r.receipt.terms, terms(sh)) && !r.actions.some(a => a.kind === kind));
    const r = candidates.at(-1); if (!r) return false;
    const s = b.buyerService;
    if (kind === 'acknowledgeSpecifiedTerms') {
      if (!pending(sh) || !s.channelPowered || !s.credentialActive || s.assignment || b.authorityActionJob?.progress !== 60 || b.authorityActionJob.authorityId !== r.id) return false;
    } else if (sh.receiptAt !== at || sh.owner !== b.id) return false;
    const event = { id: `${r.id}:action:${r.actions.length + 1}`, authorityId: r.id, kind, at, shipmentReference: sh.id,
      scope: 'Buyer-originated report of this new action under the cited instruction; not an independent clerk observation of performance or payment.' };
    r.actions.push(copy(event)); sh.authorityActions ||= []; sh.authorityActions.push(copy(event));
    if (kind === 'acknowledgeSpecifiedTerms') {
      const document = { id: `${s.contact.accountId}:record:${s.records.length + 1}`, kind: 'authorityTermsAcknowledged', at, cityId: b.cityId,
        shipmentReference: sh.id, sourceAccountId: s.contact.accountId, provenance: 'buyerOriginal', participantClaim: rep.name,
        items: [], authorityReference: r.id, scope: event.scope };
      s.records.push({ document: copy(document), observerId: rep.id }); sh.buyerContact = copy(s.contact); sh.buyerDocuments ||= []; sh.buyerDocuments.push(copy(document));
    }
    return true;
  }
  function acknowledge(state, b, sh, at) {
    const rep = Identity.representative(b, at), s = b?.buyerService;
    const r = (state.identityOffices || []).flatMap(o => o.authorityRecords || []).filter(r => r.receipt.kind === 'purchasingAuthority' && r.representativeId === rep?.id
      && r.receipt.result === 'supported' && r.receipt.at <= at && at + 60 < r.receipt.terms.expiresAt && r.revokedAt == null && !r.withdrawal
      && same(r.receipt.terms, sh && terms(sh)) && !r.actions.some(a => a.kind === 'acknowledgeSpecifiedTerms')).at(-1);
    if (!r || !pending(sh) || b.authorityActionJob || !s.channelPowered || !s.credentialActive || s.assignment || s.power < 1 || s.workSeconds < 60 || (s.availableAt || 0) > at) return false;
    const id = `${r.id}:acknowledgment`;
    b.authorityActionJob = { id, authorityId: r.id, shipmentId: sh.id, personId: rep.id, progress: 0, lastAt: at, wasReady: true };
    s.power--; s.assignment = id; rep.assignment = id; return true;
  }
  function recheck(state, b, id, at) {
    const found = recordFor(state, id); if (!found) return false;
    const { o, r } = found, s = b?.buyerService;
    const attendees = [r.principalId, r.representativeId].map(id => people(b).find(p => p.id === id));
    if (!ready(o) || o.assignment || o.power < 1 || o.workSeconds < 600 || r.job || !r.customerCopy || !s?.channelPowered || !s.credentialActive
      || attendees.some(p => !able(p) || p.assignment || p.locationId !== b.cityId || (p.availableAt || 0) > at || !p.authorityConsent.release)) return false;
    r.job = { id: `${id}:status:${r.rechecks.length + 1}`, progress: 0, lastAt: at, wasReady: true }; o.assignment = r.job.id; o.power--; return true;
  }
  function advance(state, at) {
    for (const b of state.buyers) {
      if (b.principalRegistrationTrip) {
        const v = registrationView(b); if (v) { Identity.advance({ ...state, buyers: [v], shipments: [] }, at); b.principalRegistrationTrip = v.identityTrip; b.money = v.money; }
      }
      travel(state, b, at);
      const j = b.authorityActionJob;
      if (j && at >= j.lastAt) {
        const s = b.buyerService, rep = s.representatives.find(p => p.id === j.personId), sh = state.shipments.find(s => s.id === j.shipmentId);
        const available = able(rep) && rep.locationId === b.cityId && rep.assignment === j.id && s.channelPowered && s.credentialActive && (!s.assignment || s.assignment === j.id) && s.workSeconds > 0;
        const start = Math.max(j.lastAt, s.availableAt || 0);
        const work = available && j.wasReady ? Math.min(60 - j.progress, Math.max(0, at - start), s.workSeconds) : 0;
        if (available) { s.assignment = j.id; s.workSeconds -= work; } else if (s.assignment === j.id) { s.assignment = null; s.availableAt = at; }
        j.progress += work; j.lastAt = at; j.wasReady = Boolean(available);
        if (!pending(sh) || j.progress >= 60) {
          if (rep?.assignment === j.id) rep.assignment = null;
          if (s.assignment === j.id) s.assignment = null;
          if (j.progress >= 60) { action(state, b, sh, rep, 'acknowledgeSpecifiedTerms', start + work); s.availableAt = start + work; rep.availableAt = start + work; }
          b.authorityActionJob = null;
        }
      }
    }
    for (const o of state.identityOffices || []) for (const r of o.authorityRecords || []) {
      const j = r.job; if (!j || at < j.lastAt) continue;
      const b = state.buyers.find(b => people(b).some(p => p.id === r.principalId)), start = Math.max(j.lastAt, o.availableAt || 0);
      const available = b && ready(o) && (!o.assignment || o.assignment === j.id) && o.workSeconds > 0;
      const work = available && j.wasReady ? Math.min(600 - j.progress, Math.max(0, at - start), o.workSeconds) : 0;
      if (available) { o.assignment = j.id; o.workSeconds -= work; } else release(o, j, at);
      j.progress += work; j.lastAt = at; j.wasReady = Boolean(available); if (j.progress < 600) continue;
      const date = start + work;
      const ids = [r.receipt.principal, r.receipt.representative].map((i, n) => Access.identityResult(o, i.document, r.descriptions[n], r.receipt.at, r.visibility));
      const receipt = { id: j.id, observationId: r.id, kind: 'purchasingAuthorityStatus', office: contact(o), cityId: o.cityId, at: date,
        originalSupport: r.receipt.result !== 'supported' ? 'unverified' : ids.every(i => i.result === 'supported') && !r.withdrawal ? 'retained' : 'withdrawn',
        revokedAt: r.revokedAt ?? null, correction: r.withdrawal ? copy(r.withdrawal) : null, supersedes: r.rechecks.at(-1)?.id || r.id,
        scope: 'Status of the original dated instruction, not fresh physical identification. Later revocation does not erase earlier instructions. ' + scope };
      r.rechecks.push(copy(receipt)); publish(b, r, receipt); release(o, j, date); r.job = null;
    }
  }
  function withdraw(o, id, reason, at) {
    const r = o?.authorityRecords?.find(r => r.id === id);
    if (!ready(o) || !r || r.withdrawal || at < r.receipt.at || !reason?.trim()) return false;
    r.withdrawal = { at, reason: reason.trim().slice(0, 300), source: 'originatingRecordsOffice' }; return true;
  }
  function previewEvidence(state, sh) {
    const b = state?.buyers.find(b => same(b.buyerService?.contact, sh?.buyerContact));
    const records = b?.authorityDocuments?.filter(d => d.terms?.shipmentReference === sh.id || b.authorityDocuments.some(r => r.id === d.observationId && r.terms?.shipmentReference === sh.id));
    if (!records?.length) return null;
    return { kind: 'buyerPrincipal', sourceId: `${sh.id}:authority-package`, contact: copy(records[0].office), records: copy(records.filter(r => same(r.office, records[0].office))), releaseConsent: true,
      limitation: 'Exact customer-held copies only; both attendees and originating office separately decide scoped release. ' + scope };
  }
  function next(i) {
    const submission = i.submissions.find(s => s.document.kind === 'buyerPrincipal' && !(i.principalResponses || []).some(r => r.submissionId === s.id));
    return submission ? { kind: 'principalRecords', submission } : null;
  }
  function prepare(offices, i, submission, kind, at, allocated = false, assignment = null, buyers = []) {
    const o = offices.find(o => same(contact(o), submission.document.contact));
    if (!ready(o) || o.assignment && o.assignment !== assignment || o.workSeconds <= 0 || !allocated && o.power < 1) return null;
    const selected = (o.authorityRecords || []).filter(r => submission.document.records.some(d => d.observationId === r.id));
    for (const r of selected) {
      if (r.releaseChoices.some(c => c.investigationId === i.id) || !submission.document.releaseConsent) continue;
      const b = buyers.find(b => people(b).some(p => p.id === r.principalId)), s = b?.buyerService;
      const attendees = [r.principalId, r.representativeId].map(id => people(b).find(p => p.id === id));
      if (!s?.channelPowered || !s.credentialActive || s.assignment || s.power < 1 || attendees.some(p => !able(p) || p.assignment || p.locationId !== b.cityId || (p.availableAt || 0) > at)) return null;
      s.power--; r.releaseChoices.push({ investigationId: i.id, at, consent: attendees.every(p => p.authorityConsent?.release) && o.authorityReleaseConsent !== false });
    }
    return { service: o, witness: o.clerk, office: o, selected };
  }
  function complete(i, submission, kind, ctx, at) {
    i.principalResponses ||= [];
    const comparisons = submission.document.records.map(d => {
      const r = ctx.selected.find(r => r.id === d.observationId), retained = r && [r.receipt, ...r.rechecks].find(v => v.id === d.id);
      const permit = submission.document.releaseConsent === true && r?.releaseChoices.some(c => c.investigationId === i.id && c.consent);
      return { recordId: d.id, result: !r ? 'unavailable' : !permit ? 'notReleased' : !retained ? 'unavailable' : !same(retained, d) ? 'alteredCopy' : 'matchesWitnessedInstruction', receipt: permit && retained && same(retained, d) ? copy(d) : null };
    });
    i.principalResponses.push({ id: `${submission.id}:principalRecords`, submissionId: submission.id, at, account: contact(ctx.office), cityId: ctx.office.cityId, comparisons,
      limit: 'Clerk and archive are one source. Instruction and performance remain distinct. Refusal implies no guilt. ' + scope });
  }
  const findings = (i, cityId) => (i.principalResponses || []).map(r => ({ ...copy(r), jurisdiction: r.cityId === cityId ? 'local witnessed instruction' : 'foreign witnessed instruction; voluntary information only' }));
  return { provision, principal, registrationPreview, register, preview, request, cancel, advance, action, acknowledge, recheck, withdraw, previewEvidence, next, prepare, complete, findings };
});
