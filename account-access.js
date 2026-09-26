(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./buyer-identity') : root.HelixBuyerIdentity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixAccountAccess = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Identity) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const ready = o => o?.active && o.channelPowered && able(o.clerk) && o.clerk.locationId === o.id;
  const scope = 'Witnessed access at this appointment only. Not ownership, exclusive control, employer authorization, principal identity, earlier messages, payment, delivery, knowing participation or enforcement authority. Claimed representative authority is unverified.';
  const contact = o => ({ ...copy(o.contact), accountId: o.id });
  function provisionBuyer(buyer, at) {
    const s = buyer.buyerService, p = s?.representatives[0];
    if (!p || s.accessCredentials) return;
    // A one-time scenario allocation to a new account, not a privilege inferred from a person's role.
    // These opaque simulation capabilities are never included in a receipt or UI projection.
    const id = `${s.contact.accountId}:access-key:1`, key = `${id}:capability`;
    s.accessCredentials = [{ id, key, issuedAt: at, events: [] }];
    s.accessReleaseConsent = true; s.accessDemonstrationConsent = true;
    p.accountCredentials = [{ accountId: s.contact.accountId, credentialId: id, key }];
    p.accountAccessConsent = { appointment: true, demonstration: true, customerCopy: true, release: true, recheck: true };
  }
  function credentialEvent(buyer, id, kind, at) {
    const c = buyer?.buyerService?.accessCredentials?.find(c => c.id === id);
    if (!c || !['revoked', 'compromiseReported'].includes(kind) || at < c.issuedAt || at < (c.events.at(-1)?.at || 0)
      || c.events.some(e => e.kind === kind)) return false;
    c.events.push({ kind, at }); return true;
  }
  function credential(buyer, person, at) {
    const s = buyer.buyerService;
    for (const held of person.accountCredentials || []) {
      if (held.accountId !== s.contact.accountId) continue;
      const record = s.accessCredentials?.find(c => c.id === held.credentialId && c.key === held.key && c.issuedAt <= at);
      if (record && !record.events.some(e => e.at <= at)) return record;
    }
    return null;
  }
  function preview(state, buyer) {
    const p = Identity.representative(buyer), d = p?.civicDocument;
    // First slice uses the attendee's actual local issuing office, not a fabricated identity provider.
    const o = state.identityOffices?.find(o => o.cityId === buyer?.cityId && o.contact.handle === d?.issuer?.handle && ready(o) && o.route.open);
    if (!p || !d || !o || buyer.accessTrip || !p.accountAccessConsent?.appointment || !p.civicPreferences?.presentationConsent || !p.civicPreferences?.verificationConsent) return null;
    return { buyerId: buyer.id, officeId: o.id, attendeeName: p.name, document: copy(d), account: copy(buyer.buyerService.contact),
      fee: o.fee, roundTripKm: o.route.distanceKm * 2, workSeconds: 1800,
      terms: 'Voluntary buyer-funded walking appointment at 4 km/h, thirty minutes of clerk work and a fresh single-use account challenge. Fee is nonrefundable once work begins; no access or identity result is guaranteed. Credentials are not supplied by requesting this visit. ' + scope };
  }
  function request(state, buyer, quote, at) {
    if (!quote || !same(quote, preview(state, buyer))) return false;
    const p = Identity.representative(buyer, at), s = buyer.buyerService, o = state.identityOffices.find(o => o.id === quote.officeId);
    if (!p?.accountAccessConsent?.appointment || !p.civicPreferences?.presentationConsent || !p.civicPreferences?.verificationConsent
      || !s.accessDemonstrationConsent || !p.accountAccessConsent.demonstration || !credential(buyer, p, at)
      || o.assignment || o.power < 1 || o.workSeconds < 1800 || buyer.money < quote.fee
      || p.provisions < (quote.roundTripKm * 900 + 1800) / 28800 || p.fatigue + quote.roundTripKm >= 80) return false;
    o.accessSequence = (o.accessSequence || 0) + 1;
    const id = `${o.id}:access-observation:${o.accessSequence}`;
    buyer.accessTrip = { id, personId: p.id, quote: copy(quote), phase: 'outbound', positionKm: 0, progress: 0, paid: false, lastAt: at, wasReady: true };
    p.assignment = id; return true;
  }
  function identityResult(o, document, description, at, visibility = 'clear') {
    if (!document) return { document: null, issuerResult: 'notPresented', appearance: 'notCompared', result: 'unverified' };
    const record = o.records.find(r => r.document.number === document.number);
    const issuerResult = !record ? 'notOnFile' : !same(record.document, document) ? 'alteredDocument' : record.status !== 'active' ? record.status
      : document.issuedAt > at ? 'notYetValid' : document.expiresAt <= at ? 'expired' : 'confirmed';
    const keys = ['face', 'eyes', 'hair', 'mark'];
    const appearance = visibility !== 'clear' || keys.some(k => !description[k] || !document.description?.[k]) ? 'ambiguous'
      : keys.every(k => description[k] === document.description[k]) ? 'consistent' : 'mismatch';
    return { document: copy(document), issuerResult, appearance, result: issuerResult === 'confirmed' && appearance === 'consistent' ? 'supported' : 'unverified' };
  }
  function customerCopy(buyer, record, receipt) {
    const s = buyer.buyerService;
    if (!record.customerCopy || !s.channelPowered || !s.credentialActive) return;
    buyer.accessDocuments ||= []; buyer.accessDocuments.push(copy(receipt));
  }
  function finishVisit(buyer, p, o, t, at) {
    const s = buyer.buyerService, ch = t.challenge;
    const identity = identityResult(o, t.presented, t.observed, ch.issuedAt, t.visibility);
    const c = credential(buyer, p, at), consent = p.accountAccessConsent?.demonstration && s.accessDemonstrationConsent;
    const continuous = o.clerk.id === t.clerkId && same(p.appearance || {}, t.observed) && same(p.civicDocument, t.quote.document)
      && p.civicPreferences?.presentationConsent && p.civicPreferences?.verificationConsent;
    const available = continuous && consent && same(s.contact, t.quote.account) && s.channelPowered && s.credentialActive && (!s.assignment || s.assignment === t.id)
      && (s.availableAt || 0) <= ch.issuedAt && s.power >= 1 && s.workSeconds >= 600;
    // The clerk watches THIS attendee operate a held credential. No search by canonical person ID can answer the challenge.
    const answered = Boolean(available && c && !ch.consumedAt && at <= ch.expiresAt);
    if (available && c) { s.power--; s.workSeconds -= 600; s.availableAt = at; }
    ch.consumedAt = at;
    const receipt = { id: t.id, kind: 'accountAccessObservation', observationId: t.id, office: contact(o), cityId: o.cityId, at,
      identity, account: copy(t.quote.account), challenge: { id: ch.id, issuedAt: ch.issuedAt, expiresAt: ch.expiresAt, answeredAt: answered ? at : null,
        result: answered ? 'demonstrated' : at > ch.expiresAt ? 'expired' : 'notDemonstrated' },
      result: answered && identity.result === 'supported' && continuous ? 'supported' : 'unverified',
      scope, provenance: 'clerkFirsthandIdentityAndAccountChallenge', supersedes: null };
    o.accessRecords ||= [];
    const record = { id: t.id, receipt: copy(receipt), personId: p.id, credentialId: c?.id || null, customerCopy: p.accountAccessConsent?.customerCopy === true,
      description: copy(t.observed), visibility: t.visibility, releaseChoices: [] };
    o.accessRecords.push(record); customerCopy(buyer, record, receipt);
  }
  function release(o, t, at) { if (o?.assignment === t.id) { o.assignment = null; o.availableAt = at; } }
  function travel(state, buyer, at) {
    const t = buyer.accessTrip; if (!t || at < t.lastAt) return;
    const p = buyer.buyerService.representatives.find(p => p.id === t.personId), o = state.identityOffices?.find(o => o.id === t.quote.officeId);
    let cursor = t.lastAt; t.lastAt = at;
    while (cursor < at) {
      const available = o && able(p) && p.assignment === t.id && p.provisions > 0 && (t.phase === 'witnessing'
        ? ready(o) && p.locationId === o.id && (!o.assignment || o.assignment === t.id) && o.workSeconds > 0 && (t.paid || o.power >= 1 && buyer.money >= t.quote.fee)
        : o.route.open);
      if (!available) { release(o, t, at); t.wasReady = false; return; }
      if (!t.wasReady) { t.wasReady = true; return; }
      if (t.phase === 'witnessing') {
        const start = Math.max(cursor, o.availableAt || 0); if (start >= at) return;
        if (!t.paid) {
          buyer.money -= t.quote.fee; o.money += t.quote.fee; o.power--; t.paid = true;
          t.clerkId = o.clerk.id; t.observed = copy(p.appearance || {}); t.visibility = o.accessVisibility || 'clear';
          t.presented = p.civicPreferences?.presentationConsent && p.civicPreferences?.verificationConsent && same(p.civicDocument, t.quote.document) ? copy(p.civicDocument) : null;
          t.challenge = { id: `${t.id}:challenge`, issuedAt: start, expiresAt: start + 3600, consumedAt: null };
        }
        o.assignment = t.id;
        const work = Math.min(1800 - t.progress, at - start, o.workSeconds, p.provisions * 28800);
        o.workSeconds -= work; p.provisions = Math.max(0, p.provisions - work / 28800); t.progress += work; cursor = start + work;
        if (t.progress < 1800) return;
        finishVisit(buyer, p, o, t, cursor); release(o, t, cursor); t.phase = 'returning';
      } else {
        const remaining = t.phase === 'outbound' ? t.quote.roundTripKm / 2 - t.positionKm : t.positionKm;
        const moved = Math.min(remaining, (at - cursor) / 900, p.provisions * 32, Math.max(0, 80 - p.fatigue));
        if (moved <= 0) return;
        cursor += moved * 900; p.provisions = Math.max(0, p.provisions - moved / 32); p.fatigue += moved;
        t.positionKm += t.phase === 'outbound' ? moved : -moved; p.locationId = `${o.route.id}:walk:${t.positionKm.toFixed(2)}km`;
        if (moved + 1e-8 < remaining) return;
        if (t.phase === 'outbound') { p.locationId = o.id; t.phase = 'witnessing'; }
        else { p.locationId = buyer.cityId; p.assignment = null; p.availableAt = cursor; buyer.accessTrip = null; return; }
      }
    }
  }
  function recheck(state, buyer, receiptId, at) {
    const o = state.identityOffices?.find(o => o.accessRecords?.some(r => r.id === receiptId));
    const r = o?.accessRecords.find(r => r.id === receiptId), p = buyer?.buyerService?.representatives.find(p => p.id === r?.personId), s = buyer?.buyerService;
    if (!r || r.receipt.account.accountId !== s?.contact.accountId || !p?.accountAccessConsent?.recheck || !p.accountAccessConsent.customerCopy
      || !s.accessDemonstrationConsent || !able(p) || p.assignment || p.locationId !== buyer.cityId || (p.availableAt || 0) > at || !ready(o) || o.assignment || o.power < 1 || o.workSeconds < 600
      || !s.channelPowered || !s.credentialActive || s.assignment || s.power < 1 || s.workSeconds < 600 || r.job) return false;
    r.rechecks ||= [];
    const id = `${r.id}:recheck:${r.rechecks.length + 1}`;
    r.job = { id, lastAt: at, progress: 0, wasReady: true }; o.assignment = id; s.assignment = id;
    o.power--; s.power--; return true;
  }
  function advance(state, at) {
    for (const b of state.buyers) travel(state, b, at);
    for (const o of state.identityOffices || []) for (const r of o.accessRecords || []) {
      const j = r.job; if (!j || at < j.lastAt) continue;
      const buyer = state.buyers.find(b => same(b.buyerService?.contact, r.receipt.account)), s = buyer?.buyerService;
      const available = ready(o) && s?.channelPowered && s.credentialActive && (!s.assignment || s.assignment === j.id)
        && (!o.assignment || o.assignment === j.id) && o.workSeconds > 0 && s.workSeconds > 0;
      const begin = Math.max(j.lastAt, o.availableAt || 0, s?.availableAt || 0);
      const work = available && j.wasReady ? Math.min(600 - j.progress, Math.max(0, at - begin), o.workSeconds, s.workSeconds) : 0;
      if (available) { o.assignment = j.id; s.assignment = j.id; o.workSeconds -= work; s.workSeconds -= work; }
      else { release(o, j, at); if (s?.assignment === j.id) { s.assignment = null; s.availableAt = at; } }
      j.progress += work; j.wasReady = Boolean(available); j.lastAt = at;
      if (j.progress < 600) continue;
      const completedAt = begin + work, c = s.accessCredentials?.find(c => c.id === r.credentialId);
      const identity = identityResult(o, r.receipt.identity.document, r.description, r.receipt.challenge.issuedAt, r.visibility);
      const events = c?.events.filter(e => e.at <= completedAt) || [];
      const receipt = { id: j.id, kind: 'accountAccessRecheck', observationId: r.id, office: contact(o), cityId: o.cityId, at: completedAt,
        identity, account: copy(r.receipt.account), originalSupport: r.receipt.result !== 'supported' ? 'unverified' : identity.result !== 'supported' || r.withdrawal ? 'withdrawn' : 'retained',
        accessStatus: !c ? 'unavailable' : events.at(-1)?.kind || 'credentialStillActive', changes: copy(events),
        correction: r.withdrawal ? copy(r.withdrawal) : null, supersedes: r.rechecks.at(-1)?.id || r.id,
        scope: 'Issuer/account status reply, not a fresh physical access demonstration. Later loss or compromise does not erase the earlier witnessed event. ' + scope };
      r.rechecks.push(copy(receipt)); customerCopy(buyer, r, receipt); release(o, j, completedAt);
      s.assignment = null; s.availableAt = completedAt; r.job = null;
    }
  }
  function withdrawObservation(office, id, reason, at) {
    const r = office?.accessRecords?.find(r => r.id === id);
    if (!r || !ready(office) || r.withdrawal || at < r.receipt.at || !reason?.trim()) return false;
    r.withdrawal = { at, reason: reason.trim().slice(0, 300), source: 'originatingRecordsOffice' }; return true;
  }
  function previewEvidence(state, sh) {
    // The lookup starts from a customer-held account acknowledgment, never sh.buyerId.
    const buyer = state?.buyers.find(b => same(b.buyerService?.contact, sh?.buyerContact));
    if (!buyer?.accessDocuments?.length) return null;
    const first = buyer.accessDocuments[0];
    return { kind: 'accountAccess', sourceId: `${first.office.accountId}:customer-access-package`, contact: copy(first.office),
      records: copy(buyer.accessDocuments.filter(d => same(d.office, first.office))), releaseConsent: true,
      limitation: 'Exact customer copies only. Attendee and account must separately permit scoped release to this inquiry. No archive search. ' + scope };
  }
  function next(i) {
    const submission = i.submissions.find(s => s.document.kind === 'accountAccess' && !(i.accountAccessResponses || []).some(r => r.submissionId === s.id));
    return submission ? { kind: 'accountAccessRecords', submission } : null;
  }
  function prepare(offices, i, submission, kind, at, allocated = false, assignment = null, buyers = []) {
    const o = offices.find(o => same(contact(o), submission.document.contact));
    if (!ready(o) || o.assignment && o.assignment !== assignment || o.workSeconds <= 0 || !allocated && o.power < 1) return null;
    const selected = (o.accessRecords || []).filter(r => submission.document.records.some(d => d.observationId === r.id));
    for (const r of selected) {
      if (r.releaseChoices.some(c => c.investigationId === i.id) || !submission.document.releaseConsent) continue;
      const b = buyers.find(b => same(b.buyerService?.contact, r.receipt.account)), s = b?.buyerService;
      const p = s?.representatives.find(p => p.id === r.personId && able(p) && !p.assignment && p.locationId === b.cityId && (p.availableAt || 0) <= at);
      if (!s?.channelPowered || !s.credentialActive || s.assignment || s.power < 1 || !p) return null;
      s.power--;
      r.releaseChoices.push({ investigationId: i.id, at, consent: p.accountAccessConsent?.release === true && s.accessReleaseConsent === true && o.accessReleaseConsent !== false });
    }
    return { service: o, witness: o.clerk, office: o, selected };
  }
  function complete(i, submission, kind, ctx, at) {
    i.accountAccessResponses ||= [];
    const comparisons = submission.document.records.map(d => {
      const r = ctx.selected.find(r => r.id === d.observationId), retained = r && [r.receipt, ...(r.rechecks || [])].find(v => v.id === d.id);
      const permit = submission.document.releaseConsent === true && r?.releaseChoices.some(c => c.investigationId === i.id && c.consent);
      return { recordId: d.id, result: !r ? 'unavailable' : !permit ? 'notReleased' : !retained ? 'unavailable' : !same(retained, d) ? 'alteredCopy' : 'matchesWitnessedRecord',
        receipt: permit && retained && same(retained, d) ? copy(d) : null };
    });
    i.accountAccessResponses.push({ id: `${submission.id}:accountAccessRecords`, submissionId: submission.id, at, account: contact(ctx.office), cityId: ctx.office.cityId,
      comparisons, limit: 'Archive and clerk are one source, not two independent witnesses. Missing or refused evidence implies no guilt. ' + scope });
  }
  function findings(i, cityId) {
    return (i.accountAccessResponses || []).map(r => ({ ...copy(r), jurisdiction: r.cityId === cityId ? 'local office' : 'foreign office; voluntary access only' }));
  }
  return { provisionBuyer, credentialEvent, preview, request, advance, recheck, withdrawObservation, previewEvidence, next, prepare, complete, findings };
});
