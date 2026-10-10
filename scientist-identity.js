(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixScientistIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const COUNTER = Object.freeze({ x: 17, y: 8, z: 6 });
  const CLERK = Object.freeze({ x: 18, y: 8, z: 6 });
  const scope = 'Prospective civic registration of the physically observed attendee only. A chosen registration name is not verified birth history, a clean criminal record, account control, inherited ownership or continuity with the original scientist. No DNA test, soul identification, global wanted-person search, cargo attribution or enforcement authority.';
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const ready = o => o?.active && o.channelPowered && o.maintenanceReady !== false && able(o.clerk) && o.clerk.locationId === o.id;
  const contact = o => ({ ...copy(o.contact), accountId: o.id });
  const cleanName = name => String(name || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 80);
  function create() {
    return { bodyEpoch: 0, bodyEnded: false, description: { face: 'oval', eyes: 'gray', hair: 'dark', mark: 'freckled cheeks', ageBand: 'young adult' },
      documents: [], receipts: [], preview: null, job: null, message: '' };
  }
  function preview(value, office, name, kind = 'register', documentNumber = null) {
    if (!ready(office) || value.job || value.bodyEnded || !['register', 'check', 'courtAccess'].includes(kind)) return null;
    if (kind === 'courtAccess' && (!office.courtAuthority?.active || office.courtAuthority.cityId !== office.cityId || !office.courtAuthority.institutionId)) return null;
    const document = kind !== 'register' ? value.documents.find(d => d.number === documentNumber) : null;
    if (kind !== 'register' && (!document || document.issuer.handle !== office.contact.handle)) return null;
    const registeredName = kind === 'register' ? cleanName(name) : document.registeredName;
    if (!registeredName) return null;
    return { kind, office: contact(office), cityId: office.cityId, registeredName, description: copy(value.description), document: document ? copy(document) : null,
      ...(kind === 'courtAccess' ? { courtId: office.courtAuthority.institutionId } : {}),
      fee: kind === 'register' ? office.fee : 0, workSeconds: kind === 'register' ? 1800 : 600,
      warning: (kind === 'courtAccess' ? 'Fresh physical identity comparison for a thirty-day local court-access credential. It grants neither access to unrelated defendants nor counsel authority, and proves no criminal participation. ' : '') + 'Attendance at the staffed civic counter is required. Confirmation creates a permanent local visit record and charges the stated nonrefundable fee. Leaving or cancelling stops work; no completed document is invented. Registration is not anonymity or immunity. ' + scope };
  }
  function present(ctx, office) {
    return ctx?.alive && ctx.capable && ctx.atCounter && ctx.cityId === office.cityId && ctx.clerkPresent && ctx.lineOfSight && !ctx.busy;
  }
  function begin(value, office, quote, wallet, ctx, at) {
    if (!quote || !same(quote, preview(value, office, quote.registeredName, quote.kind, quote.document?.number)) || !present(ctx, office) || quote.kind === 'register' && ctx.visibility !== 'clear'
      || office.assignment || office.power < 1 || office.workSeconds < quote.workSeconds || wallet.money < quote.fee || at < (office.availableAt || 0)) return false;
    office.scientistVisits ||= []; office.scientistSequence = (office.scientistSequence || 0) + 1;
    const id = `${office.id}:civic-visit:${office.scientistSequence}`;
    const job = { id, officeId: office.id, quote: copy(quote), bodyEpoch: value.bodyEpoch, clerkId: office.clerk.id, progress: 0, lastAt: at, wasReady: true };
    office.scientistVisits.push({ id, startedAt: at, claim: copy(quote), status: 'inProgress' });
    wallet.money -= quote.fee; office.money += quote.fee; office.power--; office.assignment = id;
    value.job = job; value.preview = null; value.message = 'Visit started. The local claim record is permanent; no completed document yet.'; return true;
  }
  function release(office, job, at) { if (office?.assignment === job.id) { office.assignment = null; office.availableAt = at; } }
  function cancel(value, offices, at, reason = 'cancelled') {
    const job = value.job; if (!job) return false;
    const office = offices.find(o => o.id === job.officeId), visit = office?.scientistVisits?.find(v => v.id === job.id);
    if (visit) { visit.status = reason; visit.endedAt = at; }
    release(office, job, at); value.job = null; value.message = 'Visit stopped. The original claim and paid fee remain recorded; no travel, refund or finished document is created.'; return true;
  }
  function endBody(value, offices, at) { cancel(value, offices, at, 'bodyEnded'); value.bodyEnded = true; value.preview = null; }
  function replaceBody(value, offices, description, at) {
    cancel(value, offices, at, 'bodyChanged'); value.bodyEpoch++; value.bodyEnded = false;
    value.description = copy(description); value.preview = null;
    // Old receipts remain historical records. No document is rewritten or designated the new body's identity.
  }
  function compare(office, document, description, at, visibility = 'clear') {
    const r = office.records.find(r => r.document.number === document.number), keys = ['face', 'eyes', 'hair', 'mark', 'ageBand'];
    const issuerResult = !r ? 'notOnFile' : !same(r.document, document) ? 'alteredDocument' : r.status !== 'active' ? r.status
      : document.issuedAt > at ? 'notYetValid' : document.expiresAt <= at ? 'expired' : 'confirmed';
    const appearance = visibility !== 'clear' || keys.some(k => !description[k] || !document.description?.[k]) ? 'ambiguous'
      : keys.every(k => description[k] === document.description[k]) ? 'consistent' : 'mismatch';
    return { issuerResult, appearance, result: issuerResult === 'confirmed' && appearance === 'consistent' ? 'supported' : 'unverified' };
  }
  function advance(value, offices, ctx, at) {
    const job = value.job; if (!job || at < job.lastAt) return false;
    const office = offices.find(o => o.id === job.officeId), visit = office?.scientistVisits?.find(v => v.id === job.id);
    if (!ctx?.alive || value.bodyEnded || value.bodyEpoch !== job.bodyEpoch || !ctx.atCounter || ctx.cityId !== office?.cityId) {
      cancel(value, offices, at, 'interrupted'); return true;
    }
    const available = ready(office) && visit && present(ctx, office) && office.clerk.id === job.clerkId && (!office.assignment || office.assignment === job.id)
      && office.workSeconds > 0 && same(value.description, job.quote.description) && (job.quote.kind !== 'register' || ctx.visibility === 'clear')
      && (job.quote.kind !== 'courtAccess' || office.courtAuthority?.active && office.courtAuthority.cityId === office.cityId && office.courtAuthority.institutionId === job.quote.courtId);
    if (!available) { release(office, job, at); job.lastAt = at; job.wasReady = false; value.message = 'Work paused: attendee, original clerk, visibility, description or finite resources unavailable. No retroactive work.'; return false; }
    office.assignment = job.id;
    const start = Math.max(job.lastAt, office.availableAt || 0);
    const work = job.wasReady ? Math.min(job.quote.workSeconds - job.progress, Math.max(0, at - start), office.workSeconds) : 0;
    office.workSeconds -= work; job.progress += work; job.lastAt = at; job.wasReady = true;
    if (job.progress + 1e-8 < job.quote.workSeconds) return false;
    const completedAt = start + work;
    let document = job.quote.document, result;
    if (job.quote.kind === 'register') {
      document = { number: `${office.id}:document:${office.records.length + 1}`, issuer: copy(office.contact), cityId: office.cityId,
        registeredName: job.quote.registeredName, description: copy(job.quote.description), issuedAt: completedAt, expiresAt: completedAt + 31536000, scope };
      office.records.push({ document: copy(document), status: 'active', registeredAt: completedAt }); value.documents.push(copy(document));
      result = { issuerResult: 'issuedHere', appearance: 'recorded', result: 'registered' };
    } else result = compare(office, document, job.quote.description, completedAt, ctx.visibility || 'clear');
    const receipt = { id: job.id, observationId: job.id, kind: job.quote.kind === 'register' ? 'scientistCivicRegistration' : 'scientistCivicCheck',
      office: contact(office), cityId: office.cityId, startedAt: visit.startedAt, at: completedAt, document: copy(document), ...result,
      scope: job.quote.kind === 'register' ? scope : 'Comparison with this dated physical presenter only, not proof of historical, bodily or soul continuity. ' + scope };
    visit.status = 'completed'; visit.endedAt = completedAt; visit.receipt = copy(receipt);
    value.receipts.push(copy(receipt)); release(office, job, completedAt); value.job = null;
    if (job.quote.kind === 'courtAccess' && result.result === 'supported') {
      const credential = { id: `${job.id}:court-access`, officeId: office.id, courtId: job.quote.courtId, cityId: office.cityId,
        document: copy(document), observationId: job.id, issuedAt: completedAt, expiresAt: Math.min(document.expiresAt, completedAt + 2592000) };
      (value.courtCredentials ||= []).push({ ...copy(credential), bodyEpoch: value.bodyEpoch });
      (office.courtCredentials ||= []).push({ credential: copy(credential), status: 'active' });
    }
    value.message = 'Civic visit completed. You remain at the counter; return transport must still be reached and boarded physically.'; return true;
  }
  function evidencePreview(value, officeId = null) {
    const first = value.receipts.find(r => !officeId || r.office.accountId === officeId); if (!first) return null;
    return { kind: 'scientistIdentity', sourceId: `${first.office.accountId}:civic-customer-package`, contact: copy(first.office),
      records: copy(value.receipts.filter(r => r.office.accountId === first.office.accountId)), releaseConsent: true,
      limitation: 'Only these chosen-name registration and physical-check receipts are disclosed. You consent to scoped issuer verification for this inquiry. An authenticated submission does not prove that the remote submitter is the registered attendee. ' + scope };
  }
  function next(i) {
    const submission = i.submissions.find(s => s.document.kind === 'scientistIdentity' && !(i.scientistIdentityResponses || []).some(r => r.submissionId === s.id));
    return submission ? { kind: 'scientistIdentityRecords', submission } : null;
  }
  function prepare(offices, i, submission, kind, at, allocated = false, assignment = null) {
    const office = offices.find(o => same(contact(o), submission.document.contact));
    if (!ready(office) || office.assignment && office.assignment !== assignment || office.workSeconds <= 0 || !allocated && office.power < 1) return null;
    const selected = (office.scientistVisits || []).filter(v => submission.document.records.some(d => d.id === v.id));
    i.scientistIdentityChoices ||= [];
    let choice = i.scientistIdentityChoices.find(c => c.officeId === office.id);
    if (!choice) { choice = { officeId: office.id, at, release: office.civicReleaseConsent !== false }; i.scientistIdentityChoices.push(choice); }
    return { service: office, office, witness: office.clerk, selected, choice };
  }
  function complete(i, submission, kind, ctx, at) {
    i.scientistIdentityResponses ||= [];
    const comparisons = submission.document.records.map(d => {
      const retained = ctx.selected.find(r => r.id === d.id)?.receipt;
      const permitted = submission.document.releaseConsent === true && ctx.choice.release;
      const matched = permitted && retained && same(retained, d);
      const issuer = matched && ctx.office.records.find(r => r.document.number === d.document.number);
      return { recordId: d.id, result: !permitted ? 'notReleased' : !retained ? 'unavailable' : !matched ? 'alteredCopy' : 'matchesCivicRecord',
        receipt: matched ? copy(d) : null, issuerStatus: !matched ? null : !issuer ? 'unavailable' : !same(issuer.document, d.document) ? 'contradicted' : issuer.status };
    });
    i.scientistIdentityResponses.push({ id: `${submission.id}:scientistIdentityRecords`, submissionId: submission.id, at, account: contact(ctx.office), cityId: ctx.office.cityId, comparisons,
      limit: 'Clerk and archive are one source. The registered attendee, current document presenter and remote submitter are not automatically the same person. No historical, account, shipment or soul linkage. Refusal implies no guilt. ' + scope });
  }
  function findings(i, cityId) {
    return (i.scientistIdentityResponses || []).map(r => ({ ...copy(r), jurisdiction: r.cityId === cityId ? 'local civic record' : 'foreign civic record; voluntary information only' }));
  }
  function courtAccess(value, offices, id, courtId, at, connected) {
    const credential = value?.courtCredentials?.find(c => c.id === id), office = offices.find(o => o.id === credential?.officeId);
    const record = office?.courtCredentials?.find(r => r.credential.id === id);
    const { bodyEpoch, ...presented } = credential || {};
    if (!connected || value?.bodyEnded || !credential || credential.bodyEpoch !== value.bodyEpoch || credential.courtId !== courtId
      || credential.issuedAt > at || credential.expiresAt <= at || !ready(office) || !office.courtAuthority?.active
      || office.courtAuthority.institutionId !== courtId || office.courtAuthority.cityId !== credential.cityId
      || record?.status !== 'active' || !same(record.credential, presented)
      || compare(office, credential.document, value.description, at).result !== 'supported') return null;
    return copy(credential);
  }
  return { COUNTER, CLERK, create, preview, begin, cancel, endBody, replaceBody, advance, evidencePreview, next, prepare, complete, findings, courtAccess };
});
