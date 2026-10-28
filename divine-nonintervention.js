(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./divine-capabilities') : root.HelixDivineCapabilities,
    node ? require('./divine-intervention') : root.HelixDivineIntervention,
    node ? require('./strategic-faiths') : root.HelixStrategicFaiths);
  if (node) module.exports = api;
  if (root) root.HelixDivineNonintervention = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Owners, Intervention, Faiths) {
  'use strict';
  const WORK = 180, DURATION = 4 * 86400, OFFER = 600;
  const TERMS = 'For four days the named living individual will not initiate or commission attempts to overthrow the scientist’s actual terrestrial governments through their own body, manifestations or personally commanded means. The scientist will not attack the named original faithful representative or this god’s local protecting manifestation. Received witnessed renewed aggression suspends this commitment. Independent faithful retain their agency, property and obligations. No worship, conversion, endorsement, divine sovereignty, civic appointment, killing promise or control of other gods is granted.';
  const LIMITS = 'The named individual’s conditional personal nonintervention only, not ownership of faithful, immunity, divine submission, a permanent constraint or world domination. Earlier local promises and civic agreements retain their exact scope. Unaccounted independent commands or surviving claimants remain unverified.';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  function motive(r) {
    const f = r?.source?.faith;
    if (!Intervention.divine(r) || f?.godId !== r.god.id || f.confirmation?.state !== 'activelyConfirmed') return null;
    // Reciprocal protection is not political endorsement of the heretic.
    if (Intervention.motive(r) && ['strictSeparationFromChurch', 'cooperationWithoutDivineSovereignty', 'conditionalMoralSupport', 'authorityBoundByPublishedOath'].includes(f.civicTeaching?.position))
      return 'Reciprocal restraint protects the named faithful without conferring church sovereignty or endorsing the scientist.';
    const p = f.hereticTeaching?.position, interest = r.source.patronInterest;
    if (!['mortalAutonomy', 'nihilism', 'vengeance', 'liberation'].includes(p)) return null;
    const expected = Faiths.hereticTeachingFor(p);
    if (JSON.stringify(expected) !== JSON.stringify(f.hereticTeaching)) return null;
    if (p === 'mortalAutonomy') return 'Explicit mortal-autonomy teaching supports limited personal nonintervention, not allegiance.';
    if (p === 'nihilism') return 'Explicit opposition to the pantheon supports temporary restraint, not agreement about the world that follows.';
    if (['vengeance', 'liberation'].includes(p) && interest?.kind === p && interest.godId === r.god.id && interest.targetGodId
      && interest.targetGodId !== r.god.id && (p === 'vengeance' ? interest.basis === 'publishedDivineInjury' && interest.eventId
        : interest.basis === 'publishedSeizedHolySite' && interest.siteId))
      return `Published ${p === 'vengeance' ? 'injury by a living rival' : 'continuing seizure by a living rival'} supports limited practical restraint; no future killing promise is made.`;
    return null;
  }
  function channel(s, r, office, c, own = null) {
    return s && !s.invalid && r?.godRef && Owners.bound(s, r.godRef) && Owners.link(s, r) && Intervention.divine(r)
      && c.alive && c.sourceCurrent && c.serviceAvailable !== false && c.branchAvailable && c.channelAvailable && c.representativeAtChannel && c.representativeAble
      && c.clerkAtChannel && office?.id === r.officeId && office.clerk?.id === r.clerkId && office.active && office.channelPowered
      && office.maintenanceReady !== false && r.actor.status === 'alive' && r.actor.health >= 50
      && office.cityId === r.source.cityId && r.actor.id === `${r.source.branch.id}:representative`
      && r.actor.institutionId === r.source.branch.id && (r.actor.fatigue || 0) < 80
      && office.clerk.status === 'alive' && office.clerk.health >= 50 && (office.clerk.fatigue || 0) < 80
      && ![office.assignment, office.clerk.assignment, r.actor.assignment, r.job?.id].some(id => id && id !== own);
  }
  function attendance(c) { return c.alive && c.capable && c.sameGround && c.receiveAtCounter && !c.busy && c.free; }
  function observe(s, r, event, c, at) {
    if (!s || s.invalid || !c.alive || !c.sourceCurrent || !c.representativeWitness || event.actorId !== 'scientist'
      || event.targetId !== r?.actor.id || !event.id || !event.actionId
      || !s.agreements.some(a => a.payload.protectedId === r.actor.id && a.payload.bodyEpoch === c.bodyEpoch && a.payload.at <= at
        && at < a.payload.expiresAt && !a.breachedAt && a.seal === Owners.seal(s, r.god.id, a.payload)) || s.incidents.some(e => e.id === event.id)) return false;
    s.incidents.push({ ...copy(event), godId: r.god.id, witnessId: r.actor.id, at, receivedAt: null }); return true;
  }
  function beginBreach(s, r, office, c, at) {
    const e = s?.incidents?.find(e => e.godId === r?.god?.id && e.witnessId === r.actor.id && e.receivedAt == null && !e.allocated);
    const cost = Math.max(1, r?.god?.expenditures?.communication || 0);
    if (!e || s.job || !channel(s, r, office, c) || at < r.channelAvailableAt || at < (office.availableAt || 0)
      || office.power < 1 || office.workSeconds < 120 || r.actor.workSeconds < 120 || r.attentionSeconds < 60 || r.god.power.reserve < cost) return false;
    const id = `${e.id}:breach-report`;
    s.job = { id, kind: 'breach', proposal: { bodyEpoch: c.bodyEpoch }, incidentId: e.id, at, lastAt: at, progress: 0, wasReady: true };
    e.allocated = id; office.power--; r.god.power.reserve -= cost; r.attentionSeconds -= 60; r.channelAvailableAt = at + 120;
    office.assignment = office.clerk.assignment = r.actor.assignment = id; return true;
  }
  function release(s, r, office) {
    const j = s.job; if (!j) return;
    for (const a of [r.actor, office, office?.clerk]) if (a?.assignment === j.id) a.assignment = null;
    s.job = null;
  }
  function propose(s, r, office, c, at) {
    if (!attendance(c) || !channel(s, r, office, c) || s.job) return null;
    if (r.contactProcedure && r.actor.facilitationPolicy !== 'considerScopedPetition') {
      s.reply = { at, text: 'The original representative declines to facilitate this political conversation. No divine reply or new obligation was received.' }; return null;
    }
    if (!motive(r)) { s.reply = { at, text: 'The original representative supplies no compatible motive for this personal restraint proposal. No divine agreement or endorsement was received.' }; return null; }
    const active = Owners.currentAgreement(s, r.god.id, c.bodyEpoch, at);
    if (active && active.payload.expiresAt - at > 86400) { s.reply = { at, text: 'The received personal terms are not yet within their final day. No renewal was communicated.' }; return null; }
    const existing = s.proposals.findLast(p => p.godId === r.god.id && p.branchId === r.source.branch.id && p.officeId === office.id
      && p.bodyEpoch === c.bodyEpoch && p.startedAt == null && at < p.offerExpiresAt);
    if (existing) return copy(existing);
    const p = { id: `divine-restraint:${r.god.id}:${++s.serial}`, godId: r.god.id, protectedId: r.actor.id,
      faithId: r.source.faith.id, branchId: r.source.branch.id, bodyEpoch: c.bodyEpoch, officeId: office.id,
      at, offerExpiresAt: at + OFFER, duration: DURATION, scope: 'ownTerrestrialIntervention', terms: TERMS, motive: motive(r) };
    s.reply = { at, text: 'The original representative can facilitate discussion of these exact personal terms. Only completed authenticated communication establishes assent.' };
    s.proposals.push(copy(p)); return copy(p);
  }
  function begin(s, r, office, c, expected, at) {
    const p = s?.proposals?.find(p => p.id === expected?.id);
    const cost = Math.max(1, r?.god?.expenditures?.communication || 0);
    if (!p || JSON.stringify(p) !== JSON.stringify(expected) || p.terms !== TERMS || p.scope !== 'ownTerrestrialIntervention'
      || p.duration !== DURATION || p.at > at || p.offerExpiresAt !== p.at + OFFER || at >= p.offerExpiresAt || p.bodyEpoch !== c.bodyEpoch
      || !attendance(c) || !channel(s, r, office, c) || s.job || p.godId !== r.god.id || p.protectedId !== r.actor.id || !motive(r)
      || p.officeId !== office.id || p.faithId !== r.source.faith.id || p.branchId !== r.source.branch.id || p.motive !== motive(r)
      || office.power < 1 || office.workSeconds < WORK || r.actor.workSeconds < WORK || r.attentionSeconds < WORK
      || r.god.power.reserve < cost || at < r.channelAvailableAt || at < (office.availableAt || 0)
      || s.agreements.some(a => a.payload.id === p.id) || p.startedAt != null) return false;
    p.startedAt = at;
    s.job = { id: `${p.id}:communication`, proposal: copy(p), at, lastAt: at, progress: 0, wasReady: true };
    office.power--; r.god.power.reserve -= cost; r.attentionSeconds -= WORK; r.channelAvailableAt = at + WORK;
    office.assignment = office.clerk.assignment = r.actor.assignment = s.job.id; return true;
  }
  function observeBreach(s, intervention, r, at) {
    if (!s || !r) return false;
    if (intervention && (!Owners.bound(s, intervention) || intervention.godId !== r.god.id)) intervention = null;
    let changed = false;
    for (const a of s.agreements.filter(a => a.payload.godId === r.god.id && !a.breachedAt)) {
      const localAvatars = intervention?.protectedId === a.payload.protectedId ? intervention.avatars || [] : [];
      const e = [...(intervention?.reports || []), ...(s.incidents || [])].find(e => e.at >= a.payload.at && e.at < a.payload.expiresAt && e.receivedAt != null && e.receivedAt <= at
        && [a.payload.protectedId, ...localAvatars.map(a => a.id)].includes(e.targetId));
      const witnessedByAvatar = localAvatars.find(v => v.renewedAggressionAt >= a.payload.at
        && v.renewedAggressionAt < a.payload.expiresAt && v.renewedAggressionAt <= at);
      if (e || witnessedByAvatar) { a.breachedAt = e?.receivedAt ?? witnessedByAvatar.renewedAggressionAt;
        a.causeId = e?.id || `${witnessedByAvatar.id}:witnessed-renewed-aggression`; changed = true; }
    }
    return changed;
  }
  function advance(s, r, office, c, at) {
    if (!s || s.invalid || !c.alive) return false;
    if (!s.job) return beginBreach(s, r, office, c, at);
    if (at <= s.job.lastAt) return false;
    const j = s.job, dt = at - j.lastAt; j.lastAt = at;
    if (!c.sourceCurrent || c.bodyEpoch !== j.proposal.bodyEpoch || !c.representativeAble || r.actor.status !== 'alive') { release(s, r, office); return true; }
    const duration = j.kind === 'breach' ? 120 : WORK;
    const ready = (j.kind === 'breach' || attendance(c)) && channel(s, r, office, c, j.id), work = ready && j.wasReady ? Math.min(dt, duration - j.progress, office.workSeconds, r.actor.workSeconds) : 0;
    j.wasReady = ready; j.progress += work; office.workSeconds -= work; r.actor.workSeconds -= work;
    if (j.progress < duration) return work > 0;
    const completedAt = at - Math.max(0, dt - work);
    if (j.kind === 'breach') {
      const e = s.incidents.find(e => e.id === j.incidentId); if (e) e.receivedAt = completedAt;
      release(s, r, office); observeBreach(s, null, r, at); return true;
    }
    // A continuing hostile original manifestation or paid authorization is not
    // silently recalled by this broader personal commitment.
    const payload = { ...j.proposal, at: completedAt, expiresAt: completedAt + DURATION, terms: TERMS };
    s.agreements.push({ payload, seal: Owners.seal(s, r.god.id, payload), breachedAt: null });
    release(s, r, office); receive(s, r, c, at); return true;
  }
  function receive(s, r, c, at) {
    if (!s || !c.alive || !c.capable || !c.sameGround || !c.receiveAtCounter) return false;
    const a = s.agreements.findLast(a => a.payload.godId === r.god.id && a.payload.branchId === r.source.branch.id && a.payload.protectedId === r.actor.id);
    if (!a || a.seal !== Owners.seal(s, r.god.id, a.payload)) return false;
    const report = { id: `${a.payload.id}:received:${at}`, godId: a.payload.godId, godName: r.source.godName,
      branchId: r.source.branch.id, protectedId: r.actor.id, protectedName: r.actor.name,
      observedAt: a.breachedAt || (at >= a.payload.expiresAt ? a.payload.expiresAt : a.payload.at), receivedAt: at, expiresAt: a.payload.expiresAt,
      state: a.breachedAt ? 'receivedBreach' : at >= a.payload.expiresAt ? 'receivedExpiredTerms' : 'receivedConditionalPersonalCommitment',
      terms: a.payload.terms, motive: a.payload.motive, limits: LIMITS };
    s.reports.push(report); return true;
  }
  function evidence(s) {
    return publicReports(s).map(r => ({ id: r.id, sourceId: r.godId, seriesId: `divine-personal-restraint:${r.godId}${r.branchId ? ':' + r.branchId : ''}`,
      label: 'Received conditional divine personal commitment', status: 'unverified', observedAt: r.observedAt, receivedAt: r.receivedAt,
      account: { issuer: r.godName, scope: 'Named individual’s conditional personal terrestrial nonintervention',
        findings: [r.state, r.terms, r.motive, `Disclosed deadline: ${r.expiresAt} game seconds.`], limits: r.limits } }));
  }
  const publicReports = s => copy(s?.reports || []);
  return { WORK, DURATION, TERMS, LIMITS, motive, channel, propose, begin, release, observe, observeBreach, advance, receive, evidence,
    publicView: s => copy(s?.reports || []) };
});
