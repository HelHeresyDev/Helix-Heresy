(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-charging') : root.HelixCargoCharging,
    typeof module === 'object' && module.exports ? require('./jail-custody') : root.HelixJailCustody);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoCustody = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Charging, Jail) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  function provision(g, at) {
    if (g.custodyOffice || !g.appearanceOffice || g.jurisdiction !== 'city') return;
    const id = `${g.appearanceOffice.id}:temporary-jail`, court = g.cargoCourt;
    g.custodyOffice = { id, cityId: g.cityId, institutionId: court.institutionId, active: true, channelPowered: true,
      policy: { id: `${id}:evasion-procedure`, publishedAt: at, active: true,
        text: 'Deliberate evasion requires witnessed acknowledgment of the served obligation and an actual departure expressly to evade it. Missed attendance, silence and ordinary travel are insufficient. Separate judicial authorization; peaceful local execution only. Six-hour maximum custody from arrest, with automatic physical release safeguards; no trial or sentence.' },
      officers: [0, 1].map(n => ({ id: `${id}:officer:${n}`, name: `${court.institutionId} custody officer ${n + 1}`, status: 'alive', health: 100, fatigue: 0, locationId: id, workSeconds: 57600, provisions: 4 })),
      cell: { id, kind: 'jail', cityId: g.cityId, label: 'Local cargo pretrial holding cell', roomIds: [id], reservation: null, occupant: null, locked: false, failOpenTimer: true },
      collar: { id: `${id}:collar`, available: true, condition: 100, locationId: id, failOpenTimer: true }, meals: 4, power: 12,
      jail: Jail.defaultState(), witnessRecords: [], job: null, lastAt: at };
  }
  function current(g, d, findings) {
    const o = g.custodyOffice, c = g.cargoCourt, a = d.appearance;
    const r = g.criminalIntake?.referrals.find(r => r.id === d.referralId);
    return Boolean(g.active && g.jurisdiction === 'city' && o?.active && o.policy.active && c?.active
      && g.judiciary?.active && g.judiciary.cityId === g.cityId && g.judiciary.institutionId === c.institutionId
      && o.cityId === g.cityId && o.institutionId === c.institutionId && d.cityId === g.cityId
      && d.status === 'allowed' && d.handoff?.decisionId === a?.decisionId && a.servedAt != null && !a.withdrawnAt
      && a.attempts?.some(x => x.outcome === 'served') && r && Charging.proposalFindings(g, r, d.actorId, findings).supported);
  }
  function identified(s, p, doc, at) {
    const office = s.identityOffices?.find(o => o.cityId === doc.cityId && o.contact?.handle === doc.issuer?.handle);
    return able(p) && same(p.civicDocument, doc) && same(p.appearance, doc.description) && doc.issuedAt <= at && at < doc.expiresAt
      && office?.active && office.channelPowered && office.records.some(r => r.status === 'active' && same(r.document, doc));
  }
  function tell(b, p, j, at, text) {
    j.events.push({ at, text });
    const s = b?.buyerService;
    if (p?.courtPreferences?.shareNotices && s?.channelPowered && s.credentialActive)
      (s.appearanceNotices ||= []).push({ at, orderId: j.id, text, scope: 'Defendant-consented copy; no authority over another person or cargo.' });
  }
  function availability(b, p, at, text) {
    const s = b.buyerService;
    if (p?.courtPreferences?.shareAvailability && s.channelPowered && s.credentialActive)
      (s.availabilityNotices ||= []).push({ at, text });
  }
  function grounds(g, d, j, findings) {
    const r = j.submission, original = g.custodyOffice.witnessRecords.find(x => x.report.id === r?.id);
    const a = d.appearance;
    return Boolean(current(g, d, findings) && a.phase === 'notAttended' && original?.status === 'retained' && same(original.report, r)
      && r.cityId === g.cityId && r.appearanceId === a.id && r.actorId === d.actorId && same(r.document, a.document)
      && r.servedAt === a.servedAt && r.dueAt === a.dueAt && r.statementAt > a.dueAt
      && r.statement === 'I received this appearance order, know it remains due, and am leaving now to avoid attending.'
      && !r.explanation && r.departedAt >= r.statementAt && r.observedAt > r.departedAt && r.distanceKm > 0
      && r.witnessId !== g.cargoCourt.judge.id && g.custodyOffice.policy.publishedAt <= r.statementAt);
  }
  function freeJudge(c, j, at) {
    if (c.custodyJob === j.id) { c.custodyJob = null; c.lastAt = Math.max(c.lastAt, at); c.wasReady = false; }
  }
  function orderValid(g, d, j, at) {
    const order = j.order, decision = j.decisions.find(x => x.id === order?.decisionId);
    return Boolean(order?.status === 'active' && order.kind === 'peacefulProduction' && order.cityId === g.cityId
      && order.actorId === d.actorId && order.institutionId === g.cargoCourt.institutionId && order.lawId === g.custodyOffice.policy.id
      && same(order.document, d.appearance.document) && order.issuedAt <= at && at < order.expiresAt
      && decision?.status === 'authorized' && decision.at === order.issuedAt && decision.judgeId === order.judgeId);
  }
  function release(g, d, b, p, j, at, reason) {
    const o = g.custodyOffice;
    if (j.releasedAt != null) return;
    j.releasedAt = at; j.custodyActive = false;
    j.collarRecovered = o.officers.some(x => able(x) && x.locationId === p?.locationId);
    o.collar.locationId = j.collarRecovered ? o.officers.find(x => able(x) && x.locationId === p.locationId).id : o.collar.locationId;
    o.collar.timedReleaseAt = null; o.cell.timedReleaseAt = null;
    if (j.order) j.order.status = 'released';
    if (p?.custody?.caseId === j.id) { p.custody.active = false; p.custody.suppressionActive = false; p.custody.releasedAt = at; }
    if (j.stayId) o.jail = Jail.release(o.jail, j.stayId, at, reason).state;
    if (o.cell.reservation === j.id) { o.cell.occupant = null; o.cell.locked = false; }
    freeJudge(g.cargoCourt, j, at);
    j.phase = 'releaseReturn'; j.wasReady = false;
    tell(b, p, j, at, reason + ' The door and timed collar are unlocked; no continuing detention. Return still requires physical travel.');
  }
  function advance(s, g, at, findings) {
    provision(g, at); const o = g.custodyOffice, c = g.cargoCourt;
    if (!o || !Number.isFinite(at) || at < o.lastAt) return;
    o.lastAt = at;
    for (const d of c.dockets) {
      const a = d.appearance; if (!a) continue;
      let j = d.custodyCase;
      if (!j && a.phase === 'notAttended' && current(g, d, findings) && !o.job && o.officers.every(p => able(p) && p.locationId === o.id)) {
        j = d.custodyCase = { id: `${a.id}:followup`, phase: 'followup', lastAt: at, followupExpiresAt: at + 86400, wasReady: false, distanceKm: 0, personKm: 0,
          locationId: o.id, events: [], decisions: [], challenges: [], attempts: [], document: copy(a.document), location: copy(a.location) };
        o.job = j.id;
      }
      if (!j || j.phase === 'closed') continue;
      const b = s.buyers.find(b => b.cityId === g.cityId && b.buyerService?.premises?.id === j.location.siteId);
      const site = b?.buyerService.premises, p = b?.buyerService.representatives.find(p => p.id === j.personId);
      const dt = Math.max(0, at - j.lastAt); j.lastAt = at;
      if (j.custodyActive && (at >= j.releaseBy || !current(g, d, findings) || !grounds(g, d, j, findings) || !orderValid(g, d, j, at)))
        release(g, d, b, p, j, Math.min(at, j.releaseBy), at >= j.releaseBy ? 'The six-hour custody limit expired; the physical timed-release safeguard operated.' : 'Authority or supporting evidence withdrawn; release authorized.');
      if (!site) { j.wasReady = false; continue; }
      const route = site.route, stand = site.departureStand;
      const local = current(g, d, findings);
      if (!j.order && at >= j.followupExpiresAt && !['releaseReturn', 'officerReturn'].includes(j.phase)) {
        freeJudge(c, j, at); j.phase = p?.assignment === j.id ? 'releaseReturn' : 'officerReturn'; j.wasReady = false;
        tell(b, p, j, at, 'Bounded follow-up ended without executable authority; no detention or adverse inference.');
      }
      if (!local && !['releaseReturn', 'officerReturn'].includes(j.phase) && !j.custodyActive) {
        freeJudge(c, j, at); j.phase = p?.assignment === j.id ? 'releaseReturn' : 'officerReturn'; j.wasReady = false;
      }
      const crew = o.officers.every(x => able(x) && x.locationId === j.locationId && x.workSeconds > 0 && x.provisions > 0);
      const road = route.open && (j.distanceKm <= route.distanceKm || stand?.open);
      const ready = o.job === j.id && crew && road;
      let seconds = ready && j.wasReady ? dt : 0; j.wasReady = Boolean(ready);
      if (j.phase === 'followup') {
        if (!ready || !site.publicAccess) { j.wasReady = false; continue; }
        const used = Math.min(seconds, (route.distanceKm - j.distanceKm) * 900, ...o.officers.map(x => Math.min(x.workSeconds, x.provisions * 28800)));
        j.distanceKm += used / 900; for (const x of o.officers) { x.workSeconds -= used; x.provisions -= used / 28800; x.locationId = `${j.id}:road:${j.distanceKm}`; } j.locationId = o.officers[0].locationId;
        if (j.distanceKm + 1e-8 < route.distanceKm) continue;
        j.locationId = site.id; o.officers.forEach(x => { x.locationId = site.id; });
        const target = b.buyerService.representatives.find(x => !x.assignment && x.locationId === b.cityId && (x.availableAt || 0) <= at && identified(s, x, j.document, at));
        j.attempts.push({ at, siteId: site.id, outcome: target ? 'identified' : 'noVerifiedPerson' });
        if (!target) { j.phase = 'officerReturn'; j.wasReady = false; continue; }
        j.personId = target.id; const response = target.custodyPreferences?.followup || 'silent';
        j.response = { at, witnessId: o.officers[0].id, kind: response, explanation: String(target.custodyPreferences?.explanation || '').slice(0, 400) };
        if (response === 'cooperate' || response === 'reschedule') {
          a.phase = 'awaitingAttendance'; a.dueAt = at + 86400; a.lastAt = at; a.wasReady = false;
          if (response === 'cooperate') target.courtPreferences.attend = true;
          tell(b, target, j, at, 'Defendant requests an opportunity to attend. Renewed one-day window; explanation retained without treating it as proven or as guilt.');
          j.phase = 'officerReturn'; j.wasReady = false; continue;
        }
        if (!['evade', 'leave'].includes(response) || !stand?.open || !stand.publicAccess || !(stand.distanceKm > 0)) {
          tell(b, target, j, at, 'No observable evasion established. Silence or an unavailable departure route does not justify custody.');
          j.phase = 'officerReturn'; j.wasReady = false; continue;
        }
        j.departedAt = at; j.statementAt = at;
        j.statement = response === 'evade' ? 'I received this appearance order, know it remains due, and am leaving now to avoid attending.' : 'I am leaving for the public departure stand.';
        target.assignment = j.id; j.personLocation = target.locationId; j.phase = 'observedDeparture'; j.wasReady = false;
        availability(b, target, at, 'Receiving representative has left the receiving desk; no replacement assigned.');
        continue;
      }
      if (j.phase === 'observedDeparture') {
        if (!ready || !able(p) || p.assignment !== j.id || p.locationId !== j.personLocation || !stand.open) { j.wasReady = false; continue; }
        const moved = Math.min(seconds / 900, stand.distanceKm - j.personKm, p.provisions * 32, 80 - p.fatigue,
          ...o.officers.map(x => Math.min(x.workSeconds / 900, x.provisions * 32)));
        j.personKm += moved; j.distanceKm += moved; p.provisions -= moved / 32; p.fatigue += moved;
        j.locationId = `${j.id}:departure:${j.personKm}`; p.locationId = j.personLocation = j.locationId;
        for (const x of o.officers) { x.workSeconds -= moved * 900; x.provisions -= moved / 32; x.locationId = j.locationId; }
        if (j.personKm + 1e-8 < stand.distanceKm) continue;
        p.locationId = j.personLocation = j.locationId = stand.id; o.officers.forEach(x => { x.locationId = stand.id; });
        const report = { id: `${j.id}:witness`, cityId: g.cityId, actorId: d.actorId, appearanceId: a.id, document: copy(j.document), servedAt: a.servedAt, dueAt: a.dueAt,
          statementAt: j.statementAt, statement: j.statement, explanation: j.response.explanation, departedAt: j.departedAt, observedAt: at, distanceKm: j.personKm, from: site.id, to: stand.id, witnessId: o.officers[0].id,
          limit: 'One firsthand witness and its retained copy, not two independent sources. No private intentions or other people attributed.' };
        o.witnessRecords.push({ report: copy(report), status: 'retained' }); j.submission = copy(report); j.phase = 'authorization'; j.progress = 0; j.wasReady = false; continue;
      }
      if (j.phase === 'authorization') {
        const canReview = local && o.channelPowered && c.channelPowered && o.power > 0 && able(c.judge) && c.judge.locationId === c.id && c.workSeconds > 0 && !c.job && !c.appearanceJob && (!c.custodyJob || c.custodyJob === j.id);
        if (!canReview) { j.reviewReady = false; continue; }
        if (!c.custodyJob) { c.custodyJob = j.id; j.judgeId = c.judge.id; j.reviewReady = false; }
        if (j.judgeId !== c.judge.id) { j.progress = 0; j.judgeId = c.judge.id; j.reviewReady = false; }
        const work = j.reviewReady ? Math.min(dt, 1800 - j.progress, c.workSeconds) : 0; j.reviewReady = true; j.progress += work; c.workSeconds -= work;
        if (j.progress < 1800) continue;
        const supported = grounds(g, d, j, findings); o.power--; freeJudge(c, j, at);
        j.decisions.push({ id: `${j.id}:decision:${j.decisions.length + 1}`, at, judgeId: c.judge.id, status: supported ? 'authorized' : 'insufficientGrounds', sources: [a.id, j.submission.id],
          reason: supported ? 'Source-matched acknowledgment and actual witnessed departure expressly to evade the served obligation support temporary production for review only.' : 'No sufficient uncontradicted evasion grounds: ordinary departure, silence, unresolved explanations and defective source records cannot justify custody.' });
        if (!supported) { j.phase = 'releaseReturn'; j.wasReady = false; continue; }
        j.order = { id: `${j.id}:custody-order`, kind: 'peacefulProduction', decisionId: j.decisions.at(-1).id, judgeId: c.judge.id, institutionId: c.institutionId, lawId: o.policy.id,
          cityId: g.cityId, actorId: d.actorId, document: copy(j.document), issuedAt: at, expiresAt: at + 86400, status: 'active',
          scope: 'Peaceful local production to temporary jail and prompt review only. No forced entry, conviction, prison sentence or authority over cargo.' };
        tell(b, p, j, at, 'Separate judicial custody order issued on the retained witnessed conduct. No conviction or cargo power follows.');
        j.phase = 'execution'; j.wasReady = false; continue;
      }
      if (j.phase === 'execution') {
        if (!orderValid(g, d, j, at) || !grounds(g, d, j, findings)) { j.order.status = 'expiredOrWithdrawn'; j.phase = 'releaseReturn'; j.wasReady = false; continue; }
        if (!ready || !stand.publicAccess || !o.officers.every(x => x.locationId === stand.id) || p?.locationId !== stand.id || !identified(s, p, j.document, at)) { j.delay = 'No feasible encounter with the verified subject at the witnessed public location. No remote arrest or pursuit by hidden state.'; j.wasReady = false; continue; }
        if (p.custodyPreferences?.peacefulSurrender !== true) { tell(b, p, j, at, 'Peaceful compliance not obtained. Force is outside this procedure; execution unresolved.'); j.phase = 'releaseReturn'; j.wasReady = false; continue; }
        const required = j.distanceKm * 1800 + 7200;
        if (o.cell.reservation || o.cell.occupant || !o.cell.failOpenTimer || !o.collar.failOpenTimer || !o.collar.available || o.collar.condition < 50 || o.meals < 1 || o.power < 2
          || o.officers.some(x => x.workSeconds < required || x.provisions * 28800 < required) || p.provisions * 28800 < j.distanceKm * 1800) { j.delay = 'No reserved cell, collar, provisions or feasible round-trip escort capacity. No arrest.'; continue; }
        o.cell.reservation = j.id; o.collar.available = false; o.power--; j.arrestedAt = at; j.releaseBy = at + 21600; j.custodyActive = true;
        o.collar.locationId = p.id; o.collar.timedReleaseAt = o.cell.timedReleaseAt = j.releaseBy; j.order.executedAt = at;
        p.custody = { caseId: j.id, orderId: j.order.id, active: true, startedAt: at, releaseBy: j.releaseBy, collarId: o.collar.id, suppressionActive: true };
        j.transportDepartedAt = at; j.phase = 'escort'; j.wasReady = false;
        tell(b, p, j, at, 'Order personally served and peaceful surrender recorded. Cell and escort reserved; timed collar suppresses magic. Review and physical release are due within six hours of arrest.');
        continue;
      }
      if (j.phase === 'escort') {
        if (!ready || !able(p) || p.assignment !== j.id || p.locationId !== j.personLocation) { j.wasReady = false; continue; }
        const moved = Math.min(seconds / 900, j.distanceKm, p.provisions * 32, ...o.officers.map(x => Math.min(x.workSeconds / 900, x.provisions * 32)));
        j.distanceKm -= moved; p.provisions -= moved / 32;
        p.locationId = j.personLocation = j.locationId = `${j.id}:escort:${j.distanceKm}`;
        for (const x of o.officers) { x.workSeconds -= moved * 900; x.provisions -= moved / 32; x.locationId = j.locationId; }
        if (j.distanceKm > 1e-8) continue;
        p.locationId = j.personLocation = j.locationId = o.id; o.officers.forEach(x => { x.locationId = o.id; });
        o.meals--; p.provisions += 1; o.power--; o.cell.occupant = p.id; o.cell.locked = true;
        const booked = Jail.admit(o.jail, { person: p, facility: o.cell, clock: at, orderId: j.order.id, docket: d.id,
          transport: { id: `${j.id}:foot-escort`, label: 'Actual two-officer walking escort', mode: 'foot', departedAt: j.transportDepartedAt, arrivedAt: at, crewNames: o.officers.map(x => x.name) }, actors: o.officers,
          suppressor: { id: o.collar.id, physicalStackId: o.collar.id, appliedAt: j.arrestedAt, suppressionActive: true, status: 'locked', condition: o.collar.condition } });
        if (!booked.stay) { release(g, d, b, p, j, at, 'Admission could not be recorded; no substitute detainee or invented transport.'); continue; }
        o.jail = booked.state; j.stayId = booked.stay.id; j.bookedAt = at; j.phase = 'review'; j.progress = 0; j.reviewReady = false;
        j.defendantPacket = copy({ order: j.order, report: j.submission, decision: j.decisions.at(-1), releaseBy: j.releaseBy });
        if (p.custodyPreferences?.challenge) j.challenges.push({ at, kind: p.custodyPreferences.challenge, statement: 'I request review of the cited identity, service, conduct and need for custody.', sourceIds: [a.id, j.submission.id] });
        tell(b, p, j, at, 'Actual jail admission recorded for this defendant. Order, evidence, challenge opportunity and release deadline supplied; no scientist custody state changed.');
        continue;
      }
      if (j.phase === 'review') {
        o.jail = Jail.advance(o.jail, at, p.id).state;
        const canReview = o.channelPowered && c.channelPowered && o.power > 0 && able(c.judge) && c.judge.locationId === c.id && c.workSeconds > 0 && !c.job && !c.appearanceJob && (!c.custodyJob || c.custodyJob === j.id)
          && able(p) && p.locationId === o.id && o.officers.some(x => able(x) && x.locationId === o.id);
        if (!canReview) { j.reviewReady = false; continue; }
        if (!c.custodyJob) { c.custodyJob = j.id; j.reviewReady = false; j.judgeId = c.judge.id; }
        if (j.judgeId !== c.judge.id) { j.progress = 0; j.reviewReady = false; j.judgeId = c.judge.id; }
        const work = j.reviewReady ? Math.min(dt, 600 - j.progress, c.workSeconds) : 0; j.reviewReady = true; j.progress += work; c.workSeconds -= work;
        if (j.progress < 600) continue;
        j.review = { at, judgeId: c.judge.id, challengeIds: j.challenges.map(x => x.kind), sources: [a.id, j.submission.id],
          reason: 'Identity, service, cited conduct and challenges reviewed. Defendant now physically available and case documents supplied; this bounded production purpose is satisfied. No continued detention, trial or guilt determination.' };
        j.caseDisclosure = copy(d.proposals.at(-1)); o.power--; release(g, d, b, p, j, at, j.review.reason); continue;
      }
      if (['releaseReturn', 'officerReturn'].includes(j.phase)) {
        // Released people walk independently: unavailable officers cannot prolong custody.
        if (p?.assignment === j.id) {
          if (j.returnPersonKm == null) j.returnPersonKm = j.distanceKm;
          const pReady = able(p) && p.locationId === j.personLocation && p.provisions > 0 && route.open && (j.returnPersonKm <= route.distanceKm || stand.open);
          const moved = pReady && j.personReturnReady ? Math.min(Math.abs(route.distanceKm - j.returnPersonKm), dt / 900, p.provisions * 32) : 0; j.personReturnReady = Boolean(pReady);
          j.returnPersonKm += Math.sign(route.distanceKm - j.returnPersonKm) * moved; p.provisions -= moved / 32;
          if (moved > 0) p.locationId = j.personLocation = `${j.id}:free-return:${j.returnPersonKm}`;
          if (pReady && Math.abs(route.distanceKm - j.returnPersonKm) < 1e-8) {
            p.assignment = null; p.locationId = b.cityId; p.availableAt = at; j.personReturnedAt = at;
            availability(b, p, at, 'Receiving representative has returned to the desk; no replacement or account-wide finding.');
          }
        }
        if (ready) {
          const moved = Math.min(seconds / 900, j.distanceKm, ...o.officers.map(x => Math.min(x.workSeconds / 900, x.provisions * 32)));
          j.distanceKm -= moved; j.locationId = j.distanceKm > 1e-8 ? `${j.id}:officer-return:${j.distanceKm}` : o.id;
          for (const x of o.officers) { x.workSeconds -= moved * 900; x.provisions -= moved / 32; x.locationId = j.locationId; }
        }
        if (j.distanceKm < 1e-8 && p?.assignment !== j.id) {
          if (o.cell.reservation === j.id) o.cell.reservation = null;
          if (j.arrestedAt != null && j.collarRecovered) { o.collar.available = true; o.collar.locationId = o.id; }
          j.phase = 'closed'; j.closedAt = at; if (o.job === j.id) o.job = null; freeJudge(c, j, at);
        }
      }
    }
  }
  return { provision, current, grounds, orderValid, advance };
});
