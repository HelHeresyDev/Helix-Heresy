(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./carrier-identity') : root.HelixCarrierIdentity,
    typeof module === 'object' && module.exports ? require('./carrier-corroboration') : root.HelixCarrierCorroboration);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixBuyerIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Identity, Carrier) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const ready = o => o?.active && o.channelPowered && able(o.clerk) && o.clerk.locationId === o.id;
  const limit = 'This observed representative only, not the buyer principal, employer, account controller, negotiator, payer or knowing offender. Description consistency is bounded support, not certain identity. No historical linkage, guilt or enforcement authority.';
  function provisionPerson(person) {
    Identity.provisionDriver(person);
    person.provisions = 2; person.receiptConsent = true; person.identityDisclosureConsent = true;
  }
  function provision(state, institution, at) {
    if (state.buyers.some(b => b.cityId === institution?.cityId)) Identity.provision(state, institution, at, institution.cityId);
  }
  function representative(buyer, at = Infinity) {
    const s = buyer?.buyerService;
    return !s?.assignment && s?.locationId === buyer.cityId ? s.representatives.find(p => able(p) && !p.assignment && p.locationId === buyer.cityId && (p.availableAt || 0) <= at) : null;
  }
  function preview(state, buyer) {
    const person = representative(buyer), office = state.identityOffices?.find(o => o.cityId === buyer?.cityId && ready(o) && o.route.open);
    if (!person?.appearance || person.civicDocument || buyer.identityTrip || !office) return null;
    return { buyerId: buyer.id, officeId: office.id, personName: person.name, description: copy(person.appearance), fee: office.fee,
      roundTripKm: office.route.distanceKm * 2, workSeconds: 1800,
      terms: 'Buyer-funded voluntary registration. Walk at 4 km/h using finite personal provisions; thirty minutes of local clerk work. No replacement while away. Prospective registration is not birth history, principal identity or account ownership.' };
  }
  function request(state, buyer, quote, at) {
    if (!quote || !same(quote, preview(state, buyer))) return false;
    const p = representative(buyer, at), o = state.identityOffices.find(o => o.id === quote.officeId);
    if (!p?.civicPreferences.registrationConsent || o.assignment || o.power < 1 || o.workSeconds < 1800 || buyer.money < quote.fee
      || p.provisions < (quote.roundTripKm * 900 + 1800) / 28800 || p.fatigue + quote.roundTripKm >= 80) return false;
    const id = `${buyer.id}:registration:${at}`;
    buyer.identityTrip = { id, personId: p.id, officeId: o.id, quote: copy(quote), phase: 'outbound', positionKm: 0, progress: 0, paid: false, lastAt: at, wasReady: true };
    p.assignment = id; return true;
  }
  function travel(state, buyer, at) {
    const t = buyer.identityTrip; if (!t || at < t.lastAt) return;
    const p = buyer.buyerService.representatives.find(p => p.id === t.personId), o = state.identityOffices?.find(o => o.id === t.officeId);
    let cursor = t.lastAt; t.lastAt = at;
    while (cursor < at) {
      const available = able(p) && p.assignment === t.id && p.provisions > 0 && o && (t.phase === 'registering'
        ? ready(o) && p.locationId === o.id && (!o.assignment || o.assignment === t.id) && o.workSeconds > 0 && (t.paid || o.power >= 1 && buyer.money >= t.quote.fee)
        : o.route.open);
      if (!available) { if (o?.assignment === t.id) { o.assignment = null; o.availableAt = at; } t.wasReady = false; return; }
      if (!t.wasReady) { t.wasReady = true; return; }
      if (t.phase === 'registering') {
        const start = Math.max(cursor, o.availableAt || 0);
        if (start >= at) return;
        if (!t.paid) { buyer.money -= t.quote.fee; o.money += t.quote.fee; o.power--; t.paid = true; }
        o.assignment = t.id;
        const work = Math.min(1800 - t.progress, at - start, o.workSeconds, p.provisions * 28800);
        o.workSeconds -= work; p.provisions = Math.max(0, p.provisions - work / 28800); t.progress += work; cursor = start + work;
        if (t.progress < 1800) return;
        const document = { number: `${o.id}:document:${o.records.length + 1}`, issuer: copy(o.contact), cityId: o.cityId,
          registeredName: t.quote.personName, description: copy(p.appearance), issuedAt: cursor, expiresAt: cursor + 31536000,
          scope: 'Prospective local civic registration following physical attendance; no verified birth history or account linkage.' };
        o.records.push({ document: copy(document), status: 'active', registeredAt: cursor }); p.civicDocument = copy(document);
        o.assignment = null; o.availableAt = cursor; t.phase = 'returning';
      } else {
        const remaining = t.phase === 'outbound' ? t.quote.roundTripKm / 2 - t.positionKm : t.positionKm;
        const moved = Math.min(remaining, (at - cursor) / 900, p.provisions * 32, Math.max(0, 80 - p.fatigue));
        if (moved <= 0) return;
        cursor += moved * 900; p.provisions = Math.max(0, p.provisions - moved / 32); p.fatigue += moved;
        t.positionKm += t.phase === 'outbound' ? moved : -moved;
        p.locationId = `${o.route.id}:walk:${t.positionKm.toFixed(2)}km`;
        if (moved + 1e-8 < remaining) return;
        if (t.phase === 'outbound') { p.locationId = o.id; t.phase = 'registering'; }
        else { p.locationId = buyer.cityId; p.assignment = null; p.availableAt = cursor; buyer.identityTrip = null; return; }
      }
    }
  }
  function requestCheck(sh) {
    if (!sh || sh.living || sh.receiptAt != null || sh.saleFailedAt != null || sh.recipientEncounter || sh.recipientCheckRequested) return false;
    sh.recipientCheckRequested = true; return true;
  }
  function retain(op, sh, document, observerId, disclose) {
    const s = op.carrierService; if (!s) return;
    s.recipientRecords ||= []; s.recipientRecords.push({ document: copy(document), observerId });
    if (disclose && s.channelPowered && s.credentialActive) {
      sh.recipientContact = copy(s.contact); sh.recipientDocuments ||= []; sh.recipientDocuments.push(copy(document));
    }
  }
  function release(state, sh, op, at) {
    const e = sh.recipientEncounter; if (!e) return;
    for (const b of state.buyers) for (const p of b.buyerService?.representatives || []) if (p.assignment === e.id) { p.assignment = null; p.availableAt = at; }
    for (const o of state.identityOffices || []) if (o.assignment === e.job?.id) { o.assignment = null; o.availableAt = at; }
    if (op.carrierService?.assignment === e.job?.id) { op.carrierService.assignment = null; op.carrierService.availableAt = at; }
  }
  function finish(state, sh, op, at, issuerResult) {
    const e = sh.recipientEncounter, p = e.presentation, keys = ['face', 'eyes', 'hair', 'mark'];
    const appearance = !p.document ? 'notCompared' : p.visibility !== 'clear' || keys.some(k => !p.observed[k] || !p.document.description?.[k]) ? 'ambiguous'
      : keys.every(k => p.observed[k] === p.document.description[k]) ? 'consistent' : 'mismatch';
    const result = !p.document ? 'notPresented' : issuerResult === 'confirmed' && appearance === 'consistent' ? 'supported'
      : appearance === 'mismatch' || ['alteredDocument', 'withdrawn'].includes(issuerResult) ? 'mismatch' : appearance === 'ambiguous' ? 'ambiguous' : 'unavailable';
    const document = { id: e.job.id, kind: 'recipientIdentity', shipmentReference: sh.id, observationId: e.id, at,
      presentedAt: p.at, cityId: sh.destinationId, document: copy(p.document), issuerResult, appearance, result,
      sourceAccountId: op.carrierService.contact.accountId, provenance: 'carrierFirsthandObservationWithIssuerResponse',
      supersedes: e.latestCheckId || null, limit };
    retain(op, sh, document, e.witnessId, p.disclose); e.latestCheckId = document.id;
    release(state, sh, op, at); e.job = null; e.completedAt = at;
  }
  function tick(state, sh, op, at) {
    const e = sh.recipientEncounter, j = e?.job; if (!j || at < j.lastAt) return;
    const p = e.presentation, s = op.carrierService, o = state.identityOffices?.find(o => o.contact.handle === p.document?.issuer?.handle && o.cityId === p.document.cityId);
    const witness = op.crew.find(c => c.id === e.witnessId && able(c));
    const buyer = state.buyers.find(b => b.id === sh.buyerId), person = buyer?.buyerService?.representatives.find(p => p.id === e.personId);
    const present = j.recheck ? !op.assignment && !op.identityTrip && op.location === op.sourceId
      : sh.phase === 'outbound' && sh.positionKm === sh.distanceKm && able(person) && person.assignment === e.id && person.locationId === sh.destinationId;
    const available = present && witness && p.verify && ready(o) && s?.channelPowered && s.credentialActive && s.workSeconds > 0 && o.workSeconds > 0
      && (!s.assignment || s.assignment === j.id) && (!o.assignment || o.assignment === j.id) && (j.paid || s.power >= 1 && o.power >= 1);
    if (available) {
      if (!j.paid) { s.power--; o.power--; j.paid = true; }
      s.assignment = j.id; o.assignment = j.id;
      const begin = Math.max(j.lastAt, o.availableAt || 0, s.availableAt || 0);
      const work = j.wasReady ? Math.min(600 - j.progress, Math.max(0, Math.min(at, j.deadlineAt) - begin), s.workSeconds, o.workSeconds) : 0;
      s.workSeconds -= work; o.workSeconds -= work; j.progress += work;
      if (j.progress >= 600) {
        const d = p.document, r = o.records.find(r => r.document.number === d.number);
        const result = !r ? 'notOnFile' : !same(r.document, d) ? 'alteredDocument' : r.status === 'withdrawn' ? 'withdrawn' : r.status !== 'active' ? 'revoked'
          : d.issuedAt > p.at ? 'notYetValid' : d.expiresAt <= p.at ? 'expired' : 'confirmed';
        finish(state, sh, op, begin + work, result); return;
      }
    } else {
      if (o?.assignment === j.id) { o.assignment = null; o.availableAt = at; }
      if (s?.assignment === j.id) { s.assignment = null; s.availableAt = at; }
    }
    j.wasReady = Boolean(available); j.lastAt = at;
    if (at >= j.deadlineAt) finish(state, sh, op, j.deadlineAt, p.verify ? 'unavailable' : 'notConsented');
  }
  function encounter(state, sh, op, at) {
    if (!sh.recipientCheckRequested || sh.living || sh.saleFailedAt != null) return false;
    if (!sh.recipientEncounter) {
      const person = representative(state.buyers.find(b => b.id === sh.buyerId), at), witness = op.crew.find(able);
      if (!person || !witness || !op.carrierService) return false;
      const id = `${sh.id}:recipient-observation`, presented = person.civicPreferences?.presentationConsent && person.civicDocument;
      const e = sh.recipientEncounter = { id, personId: person.id, witnessId: witness.id,
        presentation: { at, document: presented ? copy(presented) : null, observed: copy(person.appearance || {}), visibility: op.recipientVisibility || 'clear',
          verify: Boolean(presented && person.civicPreferences.verificationConsent), disclose: person.identityDisclosureConsent === true },
        job: { id: `${id}:check:1`, lastAt: at, deadlineAt: at + 600, progress: 0, paid: false, wasReady: true } };
      person.assignment = id;
      if (!presented || !e.presentation.verify) { finish(state, sh, op, at, presented ? 'notConsented' : 'notPresented'); return false; }
    }
    tick(state, sh, op, at); return Boolean(sh.recipientEncounter.job);
  }
  function handoff(state, sh, op, person, at) {
    const e = sh.recipientEncounter; if (!e || e.outcomeRecorded || !person) return;
    const witness = op.crew.find(c => c.id === e.witnessId && able(c));
    if (!witness) return;
    const observationId = person.id === e.personId && person.locationId === sh.destinationId && at === e.completedAt ? e.id : `${sh.id}:replacement-recipient`;
    retain(op, sh, { id: `${sh.id}:recipient-handoff`, kind: 'recipientHandoff', shipmentReference: sh.id, observationId, at, cityId: sh.destinationId,
      accepted: person.receiptConsent !== false, sourceAccountId: op.carrierService.contact.accountId,
      items: (sh.manifest?.entries || []).map(e => ({ stackId: e.stack?.id || e.sourceReceptacleId, quantity: e.amount })),
      limit: 'Actual cargo acceptance or refusal by this observed person, separate from identity, payment, contents and earlier knowledge.' }, witness.id,
    person.identityDisclosureConsent === true && (person.id !== e.personId || e.presentation.disclose));
    e.outcomeRecorded = true;
  }
  function recheck(state, sh, at) {
    const e = sh?.recipientEncounter, op = state.operators.find(o => o.id === sh?.operatorId);
    if (!e?.latestCheckId || e.job || !e.presentation.verify || !op || op.assignment || op.identityTrip || op.location !== op.sourceId
      || op.carrierService.assignment || !op.crew.some(c => c.id === e.witnessId && able(c))) return false;
    const count = op.carrierService.recipientRecords.filter(r => r.document.kind === 'recipientIdentity' && r.document.observationId === e.id).length;
    e.job = { id: `${e.id}:check:${count + 1}`, recheck: true, lastAt: at, deadlineAt: at + 600, progress: 0, paid: false, wasReady: true };
    tick(state, sh, op, at); return true;
  }
  function advance(state, at) {
    for (const b of state.buyers) travel(state, b, at);
    for (const sh of state.shipments) if (sh.recipientEncounter?.job?.recheck) {
      const op = state.operators.find(o => o.id === sh.operatorId); if (op) tick(state, sh, op, at);
    }
  }
  function expireEncounter(state, sh, op, at) {
    const job = sh.recipientEncounter?.job;
    // Incapacitation or a blocked vehicle must not leave the voluntary receiver reservation stuck.
    if (job && !job.recheck && at >= job.deadlineAt) tick(state, sh, op, at);
  }
  function previewEvidence(sh) {
    return sh?.recipientContact && sh.recipientDocuments?.length ? { kind: 'recipient', sourceId: `${sh.id}:recipient-package`, contact: copy(sh.recipientContact), records: copy(sh.recipientDocuments),
      limitation: 'Only these exact customer copies. Carrier cooperation remains voluntary. Reports of issuer replies are not a new direct investigator interview; repeated copies are one source. ' + limit } : null;
  }
  function prepare(operators, i, submission, kind, at, allocated, assignment) {
    const ctx = Carrier.prepare(operators, i, submission, 'carrierRecords', at, allocated, assignment);
    if (ctx) ctx.selected = (ctx.service.recipientRecords || []).filter(r => submission.document.records.some(d => d.id === r.document.id));
    return ctx;
  }
  function next(i) {
    const submission = i.submissions.find(s => s.document.kind === 'recipient' && !(i.recipientResponses || []).some(r => r.submissionId === s.id));
    return submission ? { kind: 'recipientRecords', submission } : null;
  }
  function complete(i, submission, kind, ctx, at) {
    i.recipientResponses ||= [];
    i.recipientResponses.push({ id: `${submission.id}:${kind}`, submissionId: submission.id, at, account: copy(ctx.service.contact), decision: ctx.choice.decision,
      comparisons: ctx.choice.decision === 'refused' ? [] : submission.document.records.map(d => {
        const r = ctx.selected.find(r => r.document.id === d.id);
        return { recordId: d.id, result: !r ? 'unavailable' : same(d, r.document) ? 'matchesCarrierCopy' : 'contradicted' };
      }), limit: 'Voluntary retained-record comparison. Refusal is not guilt. Carrier observation and copied issuer response are not extra independent witnesses. ' + limit });
  }
  function findings(i, cityId) {
    return (i.recipientResponses || []).map(r => {
      const d = i.submissions.find(s => s.id === r.submissionId).document;
      return { ...copy(r), events: d.records.filter(d => r.comparisons.some(c => c.recordId === d.id && c.result === 'matchesCarrierCopy')).map(d => ({ ...copy(d),
        jurisdiction: d.cityId === cityId ? 'local observation; offense elements remain separate' : 'foreign observation; no local authority inferred' })) };
    });
  }
  return { provisionPerson, provision, representative, preview, request, advance, requestCheck, encounter, handoff, release, expireEncounter, recheck, previewEvidence, prepare, next, complete, findings };
});
