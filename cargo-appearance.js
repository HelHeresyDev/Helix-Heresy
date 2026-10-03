(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-charging') : root.HelixCargoCharging);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoAppearance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Charging) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  function provision(gate, at) {
    const c = gate.cargoCourt;
    if (!c || gate.appearanceOffice || gate.jurisdiction !== 'city') return;
    const id = `${c.id}:appearance-office`;
    gate.appearanceOffice = { id, cityId: gate.cityId, institutionId: c.institutionId, active: true,
      policy: { publishedAt: at, text: 'Separate judicial scheduling and personal service for an initial case-management appointment. Attendance is not an admission. No arrest, forced entry, trial or adverse inference from silence or unexplained nonattendance.' },
      officer: { id: `${id}:server`, name: `${c.institutionId} process server`, status: 'alive', health: 100, locationId: id, workSeconds: 28800, provisions: 2 },
      clerk: { id: `${id}:clerk`, name: `${c.institutionId} appointment clerk`, status: 'alive', health: 100, locationId: id, workSeconds: 7200 },
      power: 12, job: null, lastAt: at, wasReady: false };
  }
  function source(d) {
    const p = d.proposals.at(-1), a = p?.disclosure.assessment;
    const records = (a?.recipientFindings || []).flatMap(f => (f.events || []).filter(e =>
      f.comparisons?.some(c => c.recordId === e.id && c.result === 'matchesCarrierCopy')));
    const identity = records.filter(e => e.kind === 'recipientIdentity' && e.observationId === d.actorId && e.cityId === d.cityId).sort((a, b) => a.at - b.at).at(-1);
    const address = records.filter(e => e.kind === 'chemicalDisclosure' && e.observationId === d.actorId && e.cityId === d.cityId && e.serviceLocation?.cityId === d.cityId).at(-1);
    return identity?.result === 'supported' && same(identity.document, p.subjectDocument) && address
      ? { document: copy(identity.document), location: copy(address.serviceLocation), sourceIds: [identity.id, address.id] } : null;
  }
  function valid(gate, d, findings) {
    const c = gate.cargoCourt, o = gate.appearanceOffice;
    const r = gate.criminalIntake?.referrals.find(r => r.id === d.referralId);
    return Boolean(gate.active && gate.jurisdiction === 'city' && c.active && gate.judiciary?.active
      && gate.judiciary.cityId === gate.cityId && gate.judiciary.institutionId === c.institutionId
      && o.active && o.cityId === gate.cityId && o.institutionId === c.institutionId
      && d.cityId === gate.cityId && d.status === 'allowed' && d.handoff && r
      && d.handoff.decisionId === d.decisions.at(-1)?.id && Charging.proposalFindings(gate, r, d.actorId, findings).supported);
  }
  function site(state, location) {
    return state.buyers.find(b => b.buyerService?.premises?.id === location.siteId && b.cityId === location.cityId);
  }
  function identified(state, p, document, at) {
    const o = state.identityOffices?.find(o => o.cityId === document.cityId && o.contact?.handle === document.issuer?.handle);
    return able(p) && same(p.civicDocument, document) && same(p.appearance, document.description) && document.issuedAt <= at && document.expiresAt > at
      && o?.active && o.channelPowered && o.records.some(r => r.status === 'active' && same(r.document, document));
  }
  function tell(buyer, p, a, at, text) {
    a.events.push({ at, text });
    const s = buyer?.buyerService;
    if (p?.courtPreferences?.shareNotices && s?.channelPowered && s.credentialActive)
      (s.appearanceNotices ||= []).push({ at, orderId: a.id, text, scope: 'Receiver-consented copy only; no authority over another person.' });
  }
  function availableNotice(buyer, p, at, available) {
    const s = buyer.buyerService;
    if (p.courtPreferences?.shareAvailability && s.channelPowered && s.credentialActive)
      (s.availabilityNotices ||= []).push({ at, text: available ? 'Receiving representative has returned to the receiving desk.' : 'Receiving representative is away on a personal appointment; no replacement has been assigned.' });
  }
  function returnOfficer(o, a) {
    o.job = null; o.officer.returnKm = a.officerKm || 0; o.officer.returnSiteId = a.location.siteId;
    o.officer.returnLocation = o.officer.locationId; o.wasReady = false;
  }
  function advance(state, gate, at, findings) {
    provision(gate, at);
    const o = gate.appearanceOffice, c = gate.cargoCourt;
    if (!o || !Number.isFinite(at) || at < o.lastAt) return;
    const elapsed = at - o.lastAt; o.lastAt = at;
    let judicialTime = elapsed;
    const powered = o.active && c.channelPowered && o.power > 0;
    for (const d of c.dockets) {
      let a = d.appearance;
      const current = valid(gate, d, findings);
      if (a && !a.withdrawnAt && !['complete', 'withdrawn', 'notAttended', 'unserved'].includes(a.phase) && (!current || a.decisionId !== d.handoff?.decisionId)) {
        a.withdrawnAt = at;
        const p = state.buyers.flatMap(b => b.buyerService?.representatives || []).find(p => p.id === a.personId);
        a.events.push({ at, text: 'Appearance authority withdrawn; no custody or adverse inference. Any traveler must return physically.' });
        a.phase = p?.assignment === a.id ? 'returning' : 'withdrawn';
        a.wasReady = false;
        if (c.appearanceJob === a.id) { c.appearanceJob = null; c.lastAt = Math.max(c.lastAt, at); c.wasReady = false; }
        if (o.clerk.assignment === a.id) o.clerk.assignment = null;
        if (o.job === a.id) returnOfficer(o, a);
      }
      if (!a && current && powered && able(c.judge) && c.judge.locationId === c.id && !c.job && !c.appearanceJob && !c.custodyJob && !c.trialJob) {
        const s = source(d);
        if (!s) continue; // No canonical lookup supplies a missing address or identity.
        a = d.appearance = { id: `${d.id}:appearance:${d.decisions.at(-1).id}`, decisionId: d.handoff.decisionId,
          cityId: gate.cityId, ...s, phase: 'review', progress: 0, lastAt: at, wasReady: false, officerKm: 0, events: [] };
        c.appearanceJob = a.id; a.reviewJudgeId = c.judge.id;
      }
      if (!a || ['complete', 'withdrawn', 'notAttended', 'unserved'].includes(a.phase)) continue;
      const dt = Math.max(0, at - a.lastAt); a.lastAt = at;
      const buyer = site(state, a.location), premises = buyer?.buyerService.premises;
      if (a.phase === 'review') {
        if (a.reviewJudgeId !== c.judge.id) { a.progress = 0; a.wasReady = false; a.reviewJudgeId = c.judge.id; }
        const ready = current && powered && able(c.judge) && c.judge.locationId === c.id && !c.job && c.appearanceJob === a.id && c.workSeconds > 0;
        const work = ready && a.wasReady ? Math.min(600 - a.progress, dt, judicialTime, c.workSeconds) : 0;
        c.workSeconds -= work; judicialTime -= work; a.progress += work; a.wasReady = Boolean(ready);
        if (a.progress < 600) continue;
        o.power--; a.issuedAt = at; a.serviceExpiresAt = at + 86400; a.phase = 'awaitingService'; a.wasReady = false;
        c.appearanceJob = null; c.lastAt = Math.max(c.lastAt, at); c.wasReady = false;
        a.reason = 'Separate judicial decision: initial case-management appointment needed to provide the supported local allegation and explain defense access. Personal service required; no custody authority.';
        a.judgeId = c.judge.id; a.events.push({ at, text: a.reason });
        continue;
      }
      if (['awaitingService', 'serving'].includes(a.phase)) {
        if (at >= a.serviceExpiresAt) {
          a.phase = 'unserved'; a.events.push({ at, text: 'Service window expired without personal service. No appearance deadline or guilt inferred.' });
          if (o.job === a.id) returnOfficer(o, a); continue;
        }
        const route = premises?.route;
        const ready = powered && able(o.officer) && o.officer.workSeconds > 0 && o.officer.provisions > 0 && !o.officer.returnKm
          && o.officer.locationId === (o.job === a.id ? a.officerLocation : o.id)
          && (!o.job || o.job === a.id) && route?.open && route.distanceKm > 0 && premises.publicAccess && buyer.cityId === gate.cityId;
        if (!ready) { a.wasReady = false; continue; }
        if (!o.job) { o.job = a.id; a.officerLocation = o.id; a.wasReady = false; }
        a.phase = 'serving';
        const work = a.wasReady ? Math.min(dt, o.officer.workSeconds, o.officer.provisions * 28800, (route.distanceKm - a.officerKm) * 900) : 0;
        a.wasReady = true; o.officer.workSeconds -= work; o.officer.provisions -= work / 28800; a.officerKm += work / 900;
        o.officer.locationId = `${a.id}:route:${a.officerKm}`;
        a.officerLocation = o.officer.locationId;
        if (a.officerKm + 1e-8 < route.distanceKm) continue;
        o.officer.locationId = premises.id;
        const p = buyer.buyerService.representatives.find(p => p.locationId === buyer.cityId && !p.assignment && (p.availableAt || 0) <= at && identified(state, p, a.document, at));
        a.attempts ||= []; a.attempts.push({ at, siteId: premises.id, outcome: p ? 'served' : 'noVerifiedPersonPresent' });
        returnOfficer(o, a);
        if (!p) { a.phase = 'unserved'; a.events.push({ at, text: 'No verified defendant at the disclosed public desk. No search, forced entry, arrest or inferred evasion.' }); continue; }
        a.personId = p.id; a.servedBy = o.officer.id; a.servedAt = at; a.appointmentLocationId = o.id; a.dueAt = at + Math.max(86400, route.distanceKm * 1800 + 3600);
        a.phase = 'awaitingAttendance'; a.wasReady = false; a.positionKm = 0;
        tell(buyer, p, a, at, `Personally served: initial case-management appointment at ${o.id}, attend by simulation time ${a.dueAt}. Attendance is not an admission. No arrest or trial authorized.`);
        continue;
      }
      const p = buyer?.buyerService.representatives.find(p => p.id === a.personId);
      if (!p) continue;
      const route = premises.route;
      if (a.phase === 'awaitingAttendance') {
        const obstacle = !able(p) || !route.open || !powered || !able(o.clerk) || o.clerk.locationId !== o.id || o.clerk.workSeconds < 600;
        if (obstacle) { a.dueAt += dt; a.wasReady = false; a.delay = 'Documented illness, route closure or court unavailability extends the attendance window; no evasion inferred.'; continue; }
        if (at > a.dueAt) { a.phase = 'notAttended'; tell(buyer, p, a, at, 'No attendance recorded by the window. Reason unresolved; no deliberate evasion, guilt or arrest inferred.'); continue; }
        if (p.courtPreferences?.attend !== true || p.assignment || p.locationId !== buyer.cityId || p.provisions * 28800 < route.distanceKm * 1800 + 600) continue;
        p.assignment = a.id; a.lastLocation = p.locationId; a.phase = 'outbound'; a.wasReady = false; availableNotice(buyer, p, at, false); continue;
      }
      if (a.phase === 'appointment' && (!powered || !able(o.clerk) || o.clerk.locationId !== o.id || o.clerk.workSeconds < 600 - a.progress)) {
        if (o.clerk.assignment === a.id) o.clerk.assignment = null;
        a.returnForReschedule = true; a.phase = 'returning'; a.wasReady = false;
        tell(buyer, p, a, at, 'Court unavailable: free to return physically and attend during a renewed window. No detention or missed-appearance finding.');
      }
      const traveling = ['outbound', 'returning'].includes(a.phase);
      const ready = able(p) && p.assignment === a.id && p.locationId === a.lastLocation && p.provisions > 0 && (traveling ? route.open : powered && able(o.clerk) && o.clerk.locationId === o.id && o.clerk.workSeconds > 0 && (!o.clerk.assignment || o.clerk.assignment === a.id));
      const budget = ready && a.wasReady ? dt : 0; a.wasReady = Boolean(ready);
      if (!ready) { if (a.phase !== 'returning') a.dueAt += dt; continue; }
      if (traveling) {
        const remaining = a.phase === 'outbound' ? route.distanceKm - a.positionKm : a.positionKm;
        const moved = Math.min(remaining, budget / 900, p.provisions * 32, 80 - (p.fatigue || 0));
        p.provisions -= moved / 32; p.fatigue = (p.fatigue || 0) + moved;
        a.positionKm += a.phase === 'outbound' ? moved : -moved; p.locationId = `${a.id}:walk:${a.positionKm}`;
        a.lastLocation = p.locationId;
        if (moved + 1e-8 < remaining) continue;
        if (a.phase === 'outbound') { a.phase = 'appointment'; a.progress = 0; a.arrivedAt = at; p.locationId = o.id; a.lastLocation = o.id; a.wasReady = false; }
        else {
          a.phase = a.withdrawnAt ? 'withdrawn' : a.returnForReschedule ? 'awaitingAttendance' : 'complete';
          if (a.returnForReschedule) { a.dueAt = Math.max(a.dueAt, at + 86400); a.returnForReschedule = false; a.wasReady = false; }
          a.returnedAt = at; p.locationId = buyer.cityId; p.assignment = null; p.availableAt = at; availableNotice(buyer, p, at, true);
        }
      } else if (a.phase === 'appointment') {
        if (!identified(state, p, a.document, at)) { a.phase = 'returning'; a.wasReady = false; if (o.clerk.assignment === a.id) o.clerk.assignment = null; continue; }
        o.clerk.assignment = a.id;
        const work = Math.min(600 - a.progress, budget, o.clerk.workSeconds, p.provisions * 28800);
        a.progress += work; o.clerk.workSeconds -= work; p.provisions -= work / 28800;
        if (a.progress < 600) continue;
        o.power--; o.clerk.assignment = null; a.appointmentAt = at; a.clerkId = o.clerk.id; a.phase = 'returning'; a.wasReady = false;
        a.disclosure = copy(d.proposals.at(-1));
        tell(buyer, p, a, at, 'Identity checked at court; case documents and defense-access instructions supplied. No plea, verdict, detention or automatic trial. Free to return.');
      }
    }
    // The serving officer also returns physically; no instant reuse at another desk.
    if (o.officer.returnKm > 0) {
      const route = state.buyers.find(b => b.buyerService?.premises?.id === o.officer.returnSiteId)?.buyerService.premises.route;
      const ready = able(o.officer) && o.officer.locationId === o.officer.returnLocation && route?.open && o.officer.workSeconds > 0 && o.officer.provisions > 0;
      const work = ready && o.wasReady ? Math.min(elapsed, o.officer.workSeconds, o.officer.provisions * 28800, o.officer.returnKm * 900) : 0;
      o.officer.workSeconds -= work; o.officer.provisions -= work / 28800; o.officer.returnKm -= work / 900;
      if (ready) {
        o.officer.locationId = o.officer.returnKm > 0 ? `${o.id}:return:${o.officer.returnKm}` : o.id;
        o.officer.returnLocation = o.officer.locationId;
      }
      o.wasReady = Boolean(ready);
    } else o.wasReady = false;
  }
  return { provision, source, advance };
});
