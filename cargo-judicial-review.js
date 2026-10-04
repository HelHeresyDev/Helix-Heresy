(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-charging') : root.HelixCargoCharging,
    typeof module === 'object' && module.exports ? require('./scientist-identity') : root.HelixScientistIdentity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoJudicialReview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Charging, Civic) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50;
  const kinds = ['identity', 'jurisdiction', 'scope', 'omittedDefense'];
  function provision(gate, at) {
    const court = gate.judiciary;
    if (gate.cargoCourt || gate.jurisdiction !== 'city' || !court?.active || court.cityId !== gate.cityId || !court.institutionId) return;
    const id = `${gate.id}:cargo-court`;
    gate.cargoCourt = { id, institutionId: court.institutionId, cityId: gate.cityId, active: true, channelPowered: true,
      judge: { id: `${id}:judge`, name: `${court.name || court.institutionId} cargo judge`, status: 'alive', health: 100, locationId: id },
      counsel: { id: `${id}:public-counsel`, name: `${court.name || court.institutionId} public defense counsel`, status: 'alive', health: 100,
        locationId: id, acceptsAppointments: true, workSeconds: 7200 },
      reviewOffice: { id: `${id}:review`, institutionId: court.institutionId, cityId: gate.cityId,
        active: true, channelPowered: true, power: 12, workSeconds: 7200,
        reviewer: { id: `${id}:reviewer`, name: `${court.name || court.institutionId} independent cargo reviewer`,
          role: 'cargoJudgmentReview', status: 'alive', health: 100, locationId: id },
        counsel: { id: `${id}:review-counsel`, name: 'Cargo review defense counsel', status: 'alive', health: 100,
          locationId: id, acceptsAppointments: true, workSeconds: 7200 } },
      fineOffice: { id: `${id}:fine-office`, cityId: gate.cityId, institutionId: court.institutionId, locationId: id,
        active: true, channelPowered: true, power: 12, workSeconds: 7200, money: 0, receipts: [],
        officer: { id: `${id}:fine-officer`, name: `${court.name || court.institutionId} fine settlement officer`,
          role: 'voluntaryFineSettlement', status: 'alive', health: 100, locationId: id } },
      power: 12, workSeconds: 21600, lastAt: at, wasReady: false, job: null, dockets: [] };
  }
  function connectedCourt(gate) {
    const c = gate.cargoCourt;
    return Boolean(c && gate.active && gate.jurisdiction === 'city' && c.cityId === gate.cityId && c.active && c.channelPowered
      && gate.judiciary?.active && gate.judiciary.cityId === c.cityId && gate.judiciary.institutionId === c.institutionId);
  }
  function ready(gate) {
    const c = gate.cargoCourt;
    return connectedCourt(gate) && able(c.judge) && c.judge.locationId === c.id && c.judge.id !== gate.chargingOffice?.prosecutor.id;
  }
  function subjectDocument(review, actorId) {
    const a = review.disclosure.assessment;
    const check = (a.identityFindings || []).filter(c => c.personObservationId === actorId).at(-1);
    if (check?.result === 'supported') return copy(check.document);
    const receiverCheck = (a.recipientFindings || []).flatMap(f => f.events || [])
      .filter(e => e.kind === 'recipientIdentity' && e.observationId === actorId).sort((a, b) => a.at - b.at).at(-1);
    if (receiverCheck?.result === 'supported') return copy(receiverCheck.document);
    for (const f of a.scientistIdentityFindings || []) for (const c of f.comparisons || [])
      if (c.receipt?.observationId === actorId && c.issuerStatus === 'active' && ['registered', 'supported'].includes(c.receipt.result)) return copy(c.receipt.document);
    // No name/account/consignment inference. Other identity adapters need an
    // explicit person-to-document bridge before remote defense access is possible.
    return null;
  }
  function receive(gate, at) {
    const court = gate.cargoCourt;
    for (const r of gate.criminalIntake?.referrals || []) {
      const review = r.charging?.reviews.at(-1);
      for (const count of review?.counts || []) {
        if (count.status !== 'proposed') continue;
        const id = `${r.id}:count:${count.actor.id}`;
        let d = court.dockets.find(d => d.id === id);
        if (!d) {
          d = { id, referralId: r.id, actorId: count.actor.id, cityId: gate.cityId, status: 'queued', proposals: [], decisions: [], notices: [], challenges: [], mandates: [] };
          court.dockets.push(d);
        }
        if (d.proposals.some(p => p.reviewId === review.id)) continue;
        d.proposals.push({ reviewId: review.id, at, sourceRevision: review.sourceRevision, count: copy(count), disclosure: copy(review.disclosure),
          subjectDocument: subjectDocument(review, count.actor.id) });
      }
    }
  }
  function key(d, r) { return `${d.proposals.length}:${d.challenges.length}:${r?.charging?.reviewedKey || ''}:${r?.revisions.length || 0}:${r?.investigation?.submissions.length || 0}:${r?.investigation?.corrections.length || 0}`; }
  function workCounsel(gate, at) {
    const court = gate.cargoCourt, lawyer = court.counsel, job = lawyer.job;
    if (!job || at < job.lastAt) return;
    const d = court.dockets.find(d => d.id === job.docketId), mandate = d?.mandates.find(m => m.id === job.mandateId && m.status === 'active');
    if (!mandate || d.proposals.at(-1).reviewId !== job.filing.proposalId) {
      const request = d?.counselRequests?.find(x => x.id === job.filing.id);
      if (request) { request.status = 'cancelled'; request.endedAt = at; request.workSeconds = job.progress; }
      lawyer.job = null; return;
    }
    const available = connectedCourt(gate) && able(lawyer) && lawyer.locationId === court.id && lawyer.workSeconds > 0 && !lawyer.trialJob;
    const work = available && job.wasReady ? Math.min(600 - job.progress, lawyer.workSeconds, at - job.lastAt) : 0;
    const completedAt = job.lastAt + work;
    lawyer.workSeconds -= work; job.progress += work; job.lastAt = at; job.wasReady = Boolean(available);
    if (job.progress + 1e-8 < 600) return;
    d.challenges.push({ ...job.filing, at: completedAt });
    const request = d.counselRequests.find(x => x.id === job.filing.id);
    request.status = 'filed'; request.endedAt = completedAt; request.workSeconds = job.progress; lawyer.job = null;
  }
  function advance(gate, at, findings) {
    provision(gate, at);
    const court = gate.cargoCourt; if (!court || !Number.isFinite(at) || at < court.lastAt) return;
    workCounsel(gate, at);
    for (const d of court.dockets) {
      const r = gate.criminalIntake?.referrals.find(r => r.id === d.referralId);
      if (d.handoff && d.reviewedKey !== key(d, r)) { d.handoff = null; d.status = 'reviewRequired'; }
    }
    const available = ready(gate) && !court.appearanceJob && !court.custodyJob && !court.trialJob && court.workSeconds > 0 && (court.job || court.power >= 1);
    let cursor = court.lastAt;
    const elapsedReady = available && court.wasReady;
    court.lastAt = at; court.wasReady = Boolean(available);
    if (!available) return;
    receive(gate, at);
    for (const d of court.dockets) {
      const r = gate.criminalIntake?.referrals.find(r => r.id === d.referralId), signature = key(d, r);
      if (court.job?.docketId === d.id && court.job.key !== signature) court.job = null;
      if (d.reviewedKey === signature) continue;
      if (court.job && court.job.docketId !== d.id) continue;
      if (!court.job) {
        if (court.power < 1 || court.workSeconds <= 0) return;
        court.power--;
        court.job = { docketId: d.id, key: signature, startedAt: Math.max(cursor, d.proposals.at(-1).at, d.challenges.at(-1)?.at || 0), progress: 0, judgeId: court.judge.id };
      }
      const job = court.job;
      if (job.judgeId !== court.judge.id) { court.job = null; return; }
      const start = Math.max(cursor, job.startedAt), work = Math.min(1800 - job.progress, court.workSeconds, elapsedReady ? Math.max(0, at - start) : 0);
      court.workSeconds -= work; job.progress += work;
      if (job.progress + 1e-8 < 1800) return;
      cursor = start + work;
      const result = r ? Charging.proposalFindings(gate, r, d.actorId, findings) : { supported: false, reason: 'The cited source referral is unavailable.', gaps: [] };
      const stillProposed = r?.charging?.reviews.at(-1)?.counts.some(c => c.actor.id === d.actorId && c.status === 'proposed');
      const allowed = result.supported && stillProposed;
      const status = allowed ? 'allowed' : d.decisions.some(x => x.status === 'allowed') ? 'withdrawn' : 'rejected';
      const decision = { id: `${d.id}:decision:${d.decisions.length + 1}`, at: cursor, judgeId: job.judgeId, judgeName: court.judge.name,
        institutionId: court.institutionId, status, sourceRevision: r?.reviewedRevision || null, proposalId: d.proposals.at(-1).reviewId,
        actorId: d.actorId, allegation: d.proposals.at(-1).count.allegation,
        sourceFindings: result.count ? copy(result.count) : null,
        reason: allowed ? 'Source-linked charging support accepted for judicial handoff only; guilt remains unproved.' : result.reason,
        gaps: copy(result.gaps), challengeFindings: d.challenges.map(c => ({ id: c.id, kind: c.kind,
          reason: 'Reviewed against the retained and current source packets, including identity scope, local law, corrections and exculpatory material. An allegation in a filing is not new evidence.' })),
        limitation: 'No conviction, arrest warrant, physical custody, appearance deadline, cargo detention extension or foreign enforcement. Any trial requires a separate compatible handoff.' };
      d.status = status; d.decisions.push(decision); d.notices.push(copy(decision)); d.reviewedKey = signature;
      d.handoff = allowed ? { docketId: d.id, decisionId: decision.id, cityId: court.cityId, actorId: d.actorId, custodyAuthorized: false, trialStarted: false } : null;
      court.job = null;
    }
  }
  function access(gate, d, profile, offices, credentialId, at, connected) {
    if (!connectedCourt(gate) || !gate.cargoCourt.dockets.includes(d)) return null;
    const credential = Civic.courtAccess(profile, offices, credentialId, gate.cargoCourt.institutionId, at, connected);
    const document = d.proposals.at(-1)?.subjectDocument;
    return credential && document && credential.cityId === d.cityId && same(credential.document, document) ? credential : null;
  }
  function authorize(gate, d, profile, offices, credentialId, at, connected) {
    const credential = access(gate, d, profile, offices, credentialId, at, connected), lawyer = gate.cargoCourt?.counsel;
    if (!credential || !able(lawyer) || !lawyer.acceptsAppointments || lawyer.locationId !== gate.cargoCourt.id || lawyer.id === gate.cargoCourt.judge.id
      || d.mandates.some(m => m.status === 'active' && m.credentialId === credential.id)) return false;
    d.mandates.push({ id: `${d.id}:mandate:${d.mandates.length + 1}`, at, credentialId: credential.id, counselId: lawyer.id,
      status: 'active', scope: 'This defendant and this docket only; no onward delegation, plea, admission or settlement authority.' });
    return true;
  }
  function revoke(gate, d, profile, offices, credentialId, at, connected) {
    const credential = access(gate, d, profile, offices, credentialId, at, connected);
    const mandate = d.mandates.find(m => m.credentialId === credential?.id && m.status === 'active');
    if (!mandate) return false;
    mandate.status = 'revoked'; mandate.revokedAt = at; return true;
  }
  function challenge(gate, d, profile, offices, credentialId, kind, at, connected, throughCounsel = false) {
    const credential = access(gate, d, profile, offices, credentialId, at, connected);
    if (!credential || !kinds.includes(kind) || d.challenges.some(c => c.kind === kind && c.proposalId === d.proposals.at(-1).reviewId)
      || gate.cargoCourt.counsel.job?.docketId === d.id && gate.cargoCourt.counsel.job.filing.kind === kind) return false;
    const lawyer = gate.cargoCourt.counsel;
    const mandate = d.mandates.find(m => m.status === 'active' && m.credentialId === credential.id && m.counselId === lawyer.id);
    if (throughCounsel && (!mandate || !able(lawyer) || lawyer.locationId !== gate.cargoCourt.id || lawyer.workSeconds < 600 || lawyer.job || lawyer.trialJob)) return false;
    d.filingSequence = (d.filingSequence || 0) + 1;
    const filing = { id: `${d.id}:challenge:${d.filingSequence}`, at,
      submittedAt: at, kind, credentialId: credential.id, mandateId: throughCounsel ? mandate.id : null,
      proposalId: d.proposals.at(-1).reviewId, sourceIds: copy(d.proposals.at(-1).count.sourceIds),
      scope: 'Request review of retained source material; no invented testimony, identity admission or guilt inference.' };
    if (throughCounsel) {
      (d.counselRequests ||= []).push({ id: filing.id, submittedAt: at, mandateId: mandate.id, kind, status: 'drafting' });
      lawyer.job = { docketId: d.id, mandateId: mandate.id, filing, progress: 0, lastAt: at, wasReady: true };
    }
    else d.challenges.push(filing);
    return true;
  }
  return { provision, advance, access, authorize, revoke, challenge, kinds };
});
