(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLocalOpposition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const distance = (a, b) => a && b && a.z === b.z ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const POSTS = [{ x: 16, y: 12, z: 6 }, { x: 17, y: 12, z: 6 }];
  const LIMITS = 'Two original people at this receiving approach only. No deposition, seizure, criminal verdict, immunity, religious endorsement, arrest, new civil escort authority or army. Recognition, original dissent, injuries, custody, deadlines and emergency duties remain.';
  const members = (s, b) => s.memberIds.map(id => b.succession.leaders.find(a => a.id === id));
  function create(b) {
    const a = b.appointment, e = a?.enforcement, old = b.succession?.leaders.find(p => p.id === a?.incumbentId);
    const watch = b.succession?.leaders.find(p => same(p.roles, ['civilWatch']));
    const source = b.succession?.source.institutions.find(i => i.role === 'civilWatch');
    const report = e?.reports.find(r => r.witnessId === old?.id && r.targetId === old?.id && r.kind === 'boundedGrip');
    if (!b.authenticTransfer || a?.receipt?.origin !== 'compulsoryCivilAccess' || !old || !watch || old.id === watch.id
      || watch.id === a.reviewerId || !same(source?.officeRoles, ['civilWatch']) || source.id !== watch.institutionId
      || old.oppositionPolicy !== 'seekSafeguards' || !report || !e.release || !watch.mapCell || !old.mapCell) return null;
    return { id: `${a.receipt.id}:local-opposition`, cityId: a.cityId, charterId: a.charterId, officeId: a.officeId,
      receiptId: a.receipt.id, installationId: a.installationId, memberIds: [old.id, watch.id], watchInstitutionId: watch.institutionId,
      evidence: copy({ report, release: e.release, transfer: a.receipt }), homes: [copy(old.mapCell), copy(watch.mapCell)],
      phase: 'waiting', meetingProgress: 0, formed: null, joinDecision: null, protestSeconds: 0,
      job: null, offer: null, response: null, settlement: null, declined: null, reports: [], history: [],
      message: '', known: null, lastAt: b.at, credit: 0, wasReady: false };
  }
  function current(s, b) {
    const a = b.appointment;
    return Boolean(s && b.authenticTransfer && a.receipt.id === s.receiptId && a.cityId === s.cityId
      && a.charterId === s.charterId && a.installationId === s.installationId && b.office?.id === s.officeId
      && b.succession.source.charterId === s.charterId && same(a.receipt, s.evidence.transfer)
      && same(a.enforcement?.release, s.evidence.release) && a.enforcement?.reports.some(r => same(r, s.evidence.report))
      && members(s, b).every(Boolean) && same(members(s, b)[1].roles, ['civilWatch'])
      && members(s, b)[1].institutionId === s.watchInstitutionId
      && b.succession.source.institutions.some(i => i.role === 'civilWatch' && i.id === s.watchInstitutionId && same(i.officeRoles, ['civilWatch'])));
  }
  function note(s, at, kind, text) { s.history.push({ at, kind, text }); s.message = text; }
  function clearJob(s, b) {
    if (!s.job) return;
    if (b.office?.assignment === s.job.id) b.office.assignment = null;
    if (b.office?.clerk?.assignment === s.job.id) b.office.clerk.assignment = null;
    s.job = null;
  }
  function release(s, b) {
    clearJob(s, b);
    for (const a of members(s, b)) if (a?.assignment === s.id) a.assignment = null;
  }
  function withdraw(s, b, reason) {
    clearJob(s, b); s.phase = 'withdrawing'; s.credit = 0;
    note(s, b.at, 'withdrawal', `${reason} Actual walking is still required; no occupant or supply was removed.`);
  }
  function visible(s, b) {
    return Boolean(b.c.alive && b.c.capable && b.c.atCounter && b.c.visitPermission && b.c.lineOfSight
      && b.c.cityId === s.cityId && s.memberIds.every(id => b.c.presentIds?.includes(id)));
  }
  function observe(s, b) {
    if (!s?.formed || !visible(s, b) || !members(s, b).every(Boolean)) return;
    s.known = { reportedAt: b.at, phase: s.phase, members: members(s, b).map(a => ({ id: a.id, name: a.name, cell: copy(a.mapCell) })),
      formed: copy(s.formed), response: copy(s.response), offer: copy(s.offer), settlement: copy(s.settlement), declined: copy(s.declined),
      working: s.job && { kind: s.job.kind, progress: s.job.progress, seconds: s.job.seconds },
      reports: copy(s.reports.filter(r => b.c.presentIds.includes(r.witnessId))), message: s.message, limitations: LIMITS };
  }
  function local(s, b) {
    return current(s, b) && visible(s, b) && b.c.clerkPresent && !b.c.busy && !b.c.activeViolence
      && able(b.office.clerk) && b.c.bodyEpoch === b.appointment.bodyEpoch
      && members(s, b).every(a => able(a) && a.assignment === s.id) && !s.job && !b.office.assignment && !b.office.clerk.assignment;
  }
  function terms(s, b, at) {
    return { id: `${s.id}:safeguards`, offeredAt: at, expiresAt: at + 3600, memberIds: copy(s.memberIds),
      receiptId: s.receiptId, installationId: s.installationId, bodyEpoch: b.c.bodyEpoch, evidence: copy(s.evidence),
      account: 'Acknowledge the recorded compulsory escort and bodily injury without pretending the outgoing person consented or deciding criminal guilt.',
      promise: 'No further unauthorized forcible removal at this receiving approach. Published law and independent review remain; this promise grants no immunity or reinstatement.',
      response: 'Both participants will physically withdraw from this finite protest after an attended accepted account. Original policy dissent remains.', limits: LIMITS };
  }
  function begin(s, b, kind, expected = null) {
    if (!s?.formed || !local(s, b) || !['approaching', 'protesting'].includes(s.phase)
      || b.at < (b.office.availableAt || 0) || !b.c.externalPowered || b.office.power < 1 || b.office.workSeconds < 60
      || members(s, b).some(a => a.workSeconds < 72)) return false;
    s.job = { id: `${s.id}:${kind}`, kind, seconds: 60, progress: 0, lastAt: b.at, wasReady: true,
      bodyEpoch: b.c.bodyEpoch, terms: copy(expected) };
    b.office.power--; b.office.assignment = s.job.id; b.office.clerk.assignment = s.job.id;
    s.credit = 0; s.lastAt = b.at;
    note(s, b.at, kind, 'The two actual participants and original clerk must attend one minute using finite work and counter power. No path has cleared.'); return true;
  }
  function discuss(s, b) { return Boolean(s && !s.response && begin(s, b, 'discussion')); }
  function accept(s, b, expected) {
    return Boolean(s?.offer && !s.settlement && !s.declined && same(expected, s.offer) && b.at < s.offer.expiresAt
      && same(s.offer, terms(s, b, s.offer.offeredAt)) && begin(s, b, 'settlement', expected));
  }
  function decline(s, b, expected) {
    if (!s?.offer || s.settlement || s.declined || !local(s, b) || !same(expected, s.offer) || b.at >= s.offer.expiresAt) return false;
    s.declined = { at: b.at, offerId: s.offer.id }; note(s, b.at, 'declined', 'Declined the optional safeguards. No promise, punishment or renewed civil enforcement authority follows.'); observe(s, b); return true;
  }
  function cancel(s, b) {
    if (!s?.job || !visible(s, b)) return false;
    clearJob(s, b); s.credit = 0; s.lastAt = b.at;
    note(s, b.at, 'cancelled', 'Ended unfinished attendance. Spent work, protest, positions and original records remain; no refund or renewed offer.'); observe(s, b); return true;
  }
  function attack(s, b, actorId, targetId, actionId) {
    if (!s || !b.c.alive || !s.memberIds.includes(targetId)) return false;
    const target = members(s, b).find(a => a.id === targetId);
    if (!target?.mapCell) return false;
    for (const a of [...members(s, b), b.office?.clerk, b.appointment?.candidate]) {
      if (a?.status !== 'alive' || distance(a.mapCell, target.mapCell) > 6 || !b.effects?.lineOfSight?.(a.mapCell, target.mapCell)) continue;
      s.reports.push({ id: `${s.id}:attack:${s.reports.length + 1}`, at: b.at, actorId, targetId, witnessId: a.id,
        detail: `Actually witnessed ${actionId} against a protest participant. No criminal verdict or lawful clearance follows.` });
    }
    s.violenceAt = b.at;
    if (!['ended', 'stopped', 'unsupported'].includes(s.phase)) {
      if (s.formed) withdraw(s, b, 'Violence ended peaceful negotiations; the participants attempt to retreat');
      else { release(s, b); s.phase = 'stopped'; }
    }
    observe(s, b); return true;
  }
  function advance(s, b) {
    if (!s || !b.c.alive || b.at < s.lastAt) return false;
    const elapsed = b.at - s.lastAt; s.lastAt = b.at;
    if (['ended', 'stopped', 'unsupported', 'declinedSupport'].includes(s.phase)) { observe(s, b); return false; }
    const actors = members(s, b);
    if (!current(s, b)) { release(s, b); s.phase = 'unsupported'; note(s, b.at, 'unsupported', 'Original transfer or people unavailable. Historical opposition and actual positions remain.'); observe(s, b); return true; }
    if (!actors.every(able) || actors.some(a => a.locationId !== s.officeId)) {
      release(s, b); s.phase = 'stopped'; note(s, b.at, 'stopped', 'An actual participant is absent or incapable. No body was moved and no recognition changed.'); observe(s, b); return true;
    }
    if (s.job) {
      const j = s.job, previous = j.lastAt; j.lastAt = b.at;
      if (!visible(s, b) || !b.c.clerkPresent || !able(b.office.clerk) || b.c.busy || b.c.activeViolence || b.c.bodyEpoch !== j.bodyEpoch
        || b.office.assignment !== j.id || b.office.clerk.assignment !== j.id || actors.some(a => a.assignment !== s.id)
        || j.kind === 'settlement' && (b.at >= s.offer.expiresAt || !same(j.terms, s.offer) || !same(s.offer, terms(s, b, s.offer.offeredAt)))) {
        clearJob(s, b); s.credit = 0; note(s, b.at, 'interrupted', 'Attendance, safe conditions or exact terms changed. No unsigned account was recorded.'); observe(s, b); return true;
      }
      if (!b.c.externalPowered) { j.wasReady = false; observe(s, b); return false; }
      const work = j.wasReady ? Math.min(b.at - previous, 60 - j.progress, b.office.workSeconds, ...actors.map(a => a.workSeconds)) : 0;
      j.wasReady = true; j.progress += work; b.office.workSeconds -= work; actors.forEach(a => a.workSeconds -= work);
      if (j.progress >= 60) {
        const at = previous + work;
        if (j.kind === 'discussion') {
          s.response = { at, grievance: 'Compulsory removal and actual injury without voluntary outgoing consent. The lawful appointment remains recorded.',
            decision: actors[0].oppositionSettlementPolicy === 'considerSafeguards' ? 'offered' : 'refused' };
          if (s.response.decision === 'offered') s.offer = terms(s, b, at);
          note(s, at, 'response', s.offer ? 'Exact optional safeguards offered; neither path nor title changed.' : 'The former official refuses this settlement. Waiting or reload cannot reroll that decision.'); clearJob(s, b);
        } else {
          s.settlement = { id: `${s.id}:account`, at, recorderId: b.office.clerk.id, memberIds: copy(s.memberIds), terms: copy(j.terms) };
          b.office.localOppositionAccounts ||= []; b.office.localOppositionAccounts.push(copy(s.settlement));
          withdraw(s, b, 'The exact witnessed account was accepted and recorded once');
        }
      }
      s.credit = 0; observe(s, b); return work > 0;
    }
    const ready = b.c.localGround && b.c.watchAvailable && !b.c.activeViolence;
    if (!ready) { s.credit = 0; s.wasReady = false; observe(s, b); return false; }
    if (s.phase === 'waiting') {
      if (actors.some(a => a.assignment || a.workSeconds < 90)) return false;
      actors.forEach(a => a.assignment = s.id); s.phase = 'seeking'; s.wasReady = true; s.credit = 0;
      return true;
    }
    if (actors.some(a => a.assignment !== s.id)) { release(s, b); s.phase = 'stopped'; observe(s, b); return true; }
    if (!s.wasReady) { s.wasReady = true; s.credit = 0; observe(s, b); return false; }
    s.credit = Math.min(60, s.credit + elapsed); let changed = false;
    while (s.credit >= 1) {
      s.credit--; changed = true;
      if (s.phase !== 'withdrawing' && (s.protestSeconds >= 600 || actors.some(a => a.workSeconds <= 12))) {
        withdraw(s, b, 'The finite protest or personal capacity limit was reached'); break;
      }
      if (s.phase === 'seeking') {
        if (distance(actors[0].mapCell, actors[1].mapCell) > 1 || !b.effects?.lineOfSight?.(actors[0].mapCell, actors[1].mapCell)) {
          if (b.effects?.approach?.(actors[1], actors[0].mapCell)) actors[1].workSeconds--;
          else { s.credit = 0; break; }
          continue;
        }
        actors.forEach(a => a.workSeconds--); s.meetingProgress++;
        if (s.meetingProgress >= 60) {
          s.joinDecision = { at: b.at, personId: actors[1].id, evidence: copy(s.evidence.report),
            decision: actors[1].oppositionPolicy === 'joinCustodySafeguards' ? 'joined' : 'refused' };
          if (s.joinDecision.decision === 'refused') { release(s, b); s.phase = 'declinedSupport'; break; }
          s.formed = { at: b.at, memberIds: copy(s.memberIds), evidence: copy(s.evidence),
            objective: 'Safeguards against further unauthorized removal at the receiving approach; no reinstatement, stolen supplies or attack on emergency services.' };
          s.phase = 'approaching'; note(s, b.at, 'formed', 'Two original people agreed after actual contact and shared witnessed evidence. Their protest is not citywide revolt.');
        }
      } else if (s.phase === 'approaching' || s.phase === 'protesting') {
        s.protestSeconds++; actors.forEach(a => a.workSeconds--);
        for (let i = 0; i < actors.length; i++) if (!same(actors[i].mapCell, POSTS[i])) b.effects?.move?.(actors[i], POSTS[i]);
        s.phase = actors.every((a, i) => same(a.mapCell, POSTS[i])) ? 'protesting' : 'approaching';
      } else if (s.phase === 'withdrawing') {
        for (let i = 0; i < actors.length; i++) if (!same(actors[i].mapCell, s.homes[i])) {
          if (actors[i].workSeconds < 1) { release(s, b); s.phase = 'stopped'; note(s, b.at, 'stopped', 'Withdrawal capacity exhausted. Actual remaining occupants are not deleted.'); break; }
          if (b.effects?.move?.(actors[i], s.homes[i])) actors[i].workSeconds--;
        }
        if (s.phase === 'withdrawing' && actors.every((a, i) => same(a.mapCell, s.homes[i]))) {
          release(s, b); s.phase = 'ended'; note(s, b.at, 'ended', 'Both original people physically withdrew. Dissent, injuries, original appointment and any witnessed promise remain.'); break;
        }
      }
    }
    observe(s, b); return changed;
  }
  const publicView = s => s?.known ? copy(s.known) : null;
  return { POSTS, LIMITS, create, current, members, advance, discuss, accept, decline, cancel, attack, observe, publicView };
});
