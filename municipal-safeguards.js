(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./home-institution-context') : root.HelixHomeInstitutionContext);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixMunicipalSafeguards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Institutions) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const distance = (a, b) => a && b && a.z === b.z ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const ROLE = 'civilWatch', APPROACH = { x: 16, y: 12, z: 6 };
  const LIMITS = 'One original person’s voluntary counter-watch cooperation only. No criminal guilt, arrest, deposition, reinstatement, confiscation, immunity, erased evidence or renewed force authority. Accepted safe work and truthful reporting remain separate.';
  function authentic(o, b) {
    const a = o?.settlement;
    return Boolean(a?.terms && b.current && a.id === `${o.id}:account` && a.recorderId === b.office?.clerk?.id
      && same(a.memberIds, o.memberIds) && same(a.terms, o.offer)
      && a.terms.id === `${o.id}:safeguards` && a.at >= a.terms.offeredAt && a.at < a.terms.expiresAt
      && a.terms.promise === 'No further unauthorized forcible removal at this receiving approach. Published law and independent review remain; this promise grants no immunity or reinstatement.'
      && a.terms.receiptId === o.receiptId && a.terms.installationId === o.installationId
      && same(a.terms.evidence, o.evidence) && b.office.localOppositionAccounts?.some(r => same(r, a)));
  }
  function state(o) {
    return o.safeguards ||= { reports: [], received: [], reviews: [], renewalResponses: [], renewals: [], job: null, nextNumber: 1, known: null };
  }
  const watch = (o, b) => b.succession?.leaders.find(a => a.id === o?.memberIds[1] && same(a.roles, [ROLE]));
  function removal(o, b, event) {
    if (!b.c.alive || !authentic(o, b) || event.actorId !== 'scientist' || !o.memberIds.includes(event.targetId)
      || event.actionId !== 'shove' || same(event.from, event.to) || distance(event.from, APPROACH) > 5
      || !b.c.threatLocal || event.at <= o.settlement.at || event.bodyEpoch !== o.settlement.terms.bodyEpoch) return false;
    const target = b.succession.leaders.find(a => a.id === event.targetId);
    if (!target || !same(target.mapCell, event.to)) return false;
    const s = state(o);
    for (const witness of b.succession.leaders.filter(a => o.memberIds.includes(a.id))) {
      if (!able(witness) || witness.locationId !== o.officeId || distance(witness.mapCell, event.from) > 6
        || !b.effects.lineOfSight(witness.mapCell, event.from) || !b.effects.lineOfSight(witness.mapCell, b.c.scientistCell)
        || !b.effects.lineOfSight(witness.mapCell, event.to)) continue;
      const id = `${o.id}:removal:${event.id}:${witness.id}`;
      if (s.reports.some(r => r.id === id)) continue;
      s.reports.push({ id, eventId: event.id, at: event.at, kind: 'forcibleRemovalAtReceivingApproach', actorId: event.actorId,
        targetId: event.targetId, witnessId: witness.id, actionId: event.actionId, from: copy(event.from), to: copy(event.to),
        accountId: o.settlement.id, bodyEpoch: event.bodyEpoch,
        authorization: 'Ordinary scientist combat supplied no removal mandate; the original civil commission did not authorize this action.',
        detail: 'Personally witnessed a successful shove displace a named participant after the accepted receiving-approach safeguards. This is not a criminal verdict.' });
    }
    return s.reports.some(r => r.at === event.at && r.witnessId === watch(o, b)?.id);
  }
  function withdrawn(o, personId) {
    const s = o?.safeguards;
    if (!s || personId !== o.memberIds[1]) return false;
    const restored = s.renewals.at(-1)?.at ?? -Infinity;
    return s.reports.some(r => r.witnessId === personId && r.at > restored && r.accountId === o.settlement?.id);
  }
  function local(o, b, ids) {
    return authentic(o, b) && b.c.alive && b.c.capable && b.c.atCounter && b.c.visitPermission && b.c.clerkPresent
      && b.c.lineOfSight && b.c.cityId === o.cityId && !b.c.busy && !b.c.activeViolence
      && b.c.bodyEpoch === o.settlement.terms.bodyEpoch && able(b.office.clerk)
      && ids.every(id => b.c.presentIds.includes(id) && able(b.succession.leaders.find(a => a.id === id)));
  }
  function release(o, b) {
    const j = o.safeguards?.job; if (!j) return false;
    for (const a of [b.office, b.office?.clerk, ...(b.succession?.leaders || [])]) if (a?.assignment === j.id) a.assignment = null;
    o.safeguards.job = null; return true;
  }
  function begin(o, b, kind, seconds, ids, data = null) {
    const s = state(o), actors = ids.map(id => b.succession.leaders.find(a => a.id === id));
    if (s.job || !local(o, b, ids) || b.office.assignment || b.office.clerk.assignment || b.office.workSeconds < seconds
      || actors.some(a => a.assignment || a.workSeconds < seconds) || !b.c.externalPowered || b.office.power < 1
      || b.at < (b.office.availableAt || 0)) return false;
    const id = `${o.id}:safeguard-work:${s.nextNumber++}`;
    s.job = { id, kind, seconds, progress: 0, lastAt: b.at, wasReady: true, ids: copy(ids), data: copy(data),
      bodyEpoch: b.c.bodyEpoch, reports: copy(s.reports), received: copy(s.received) };
    b.office.power--; for (const a of [b.office, b.office.clerk, ...actors]) a.assignment = id;
    return true;
  }
  function receive(o, b) {
    if (!b.c.alive || !authentic(o, b)) return false;
    const s = state(o), report = s.reports.find(r => !s.received.some(v => v.id === r.id) && b.c.presentIds.includes(r.witnessId));
    return Boolean(report && begin(o, b, 'receive', 30, [report.witnessId], report));
  }
  function receivedAuthentic(o, b, report) {
    const { communicatedAt, ...original } = report;
    return communicatedAt >= report.at && o.safeguards.reports.some(r => same(r, original))
      && b.office?.records?.some(r => r.id === `${report.id}:received` && r.recorderId === b.office.clerk.id && same(r.report, report));
  }
  function file(o, b) {
    if (!b.c.alive || !authentic(o, b)) return false;
    const s = state(o), report = s.received.find(r => !s.reviews.some(v => v.report.eventId === r.eventId));
    const reviewer = b.succession.leaders.find(a => a.roles.includes('civicReview'));
    if (!report || !receivedAuthentic(o, b, report) || !reviewer || o.memberIds.includes(reviewer.id) || b.institutions?.roles['civic-review'] !== reviewer.institutionId
      || !b.institutions?.offices[reviewer.institutionId]?.available) return false;
    if (!begin(o, b, 'file', 30, [report.witnessId], report)) return false;
    const id = `${report.id}:review`, readyAt = Institutions.reserve(b.institutions, 'civic-review', id, b.at);
    if (readyAt == null) { release(o, b); return false; }
    s.job.review = { id, report: copy(report), account: copy(o.settlement), reviewerId: reviewer.id,
      institutionId: reviewer.institutionId, readyAt, status: 'filing', finding: null };
    return true;
  }
  function hear(o, b) {
    const s = o?.safeguards, r = s?.reviews.find(v => v.status === 'queued' && b.at >= v.readyAt);
    const reviewer = b.succession?.leaders.find(a => a.id === r?.reviewerId && a.institutionId === r.institutionId && a.roles.includes('civicReview'));
    if (!r || !reviewer || !same(r.account, o.settlement) || !receivedAuthentic(o, b, r.report)
      || o.memberIds.includes(reviewer.id) || b.institutions?.offices[r.institutionId]?.jobs[r.id]?.readyAt !== r.readyAt
      || !b.institutions.offices[r.institutionId].available) return false;
    return begin(o, b, 'review', 180, [...new Set([r.report.witnessId, r.reviewerId])], r);
  }
  function reviewCurrent(o, b) {
    const s = o?.safeguards, r = s?.reviews.at(-1);
    return r?.status === 'completed' && r.finding?.outcome === 'breachUpheld'
      && same(r.account, o.settlement) && s.received.every(v => receivedAuthentic(o, b, v))
      && b.office?.records?.some(v => v.id === `${r.id}:finding` && v.recorderId === b.office.clerk.id && same(v.finding, r.finding))
      && s.received.every(v => s.reviews.some(t => t.status === 'completed' && t.report.eventId === v.eventId))
      && s.reports.every(v => s.received.some(t => t.id === v.id)) ? r : null;
  }
  function meet(o, b) {
    const r = reviewCurrent(o, b), s = o?.safeguards, a = watch(o, b);
    if (!r || !a || !withdrawn(o, a.id) || s.renewalResponses.some(v => v.reviewId === r.id)) return false;
    return begin(o, b, 'renewalDiscussion', 60, [a.id], r);
  }
  function sign(o, b, terms) {
    const s = o?.safeguards, r = s?.renewalResponses.at(-1), a = watch(o, b);
    return Boolean(a && r?.terms && same(terms, r.terms) && b.at < terms.expiresAt
      && reviewCurrent(o, b)?.id === r.reviewId && !s.renewals.some(v => v.terms.id === terms.id)
      && begin(o, b, 'renewalSigning', 60, [a.id], terms));
  }
  function observe(o, b) {
    const s = o?.safeguards;
    if (!s || !b.c.alive || !b.c.capable || !b.c.visitPermission || !b.c.atCounter || !b.c.clerkPresent
      || !b.c.lineOfSight || b.c.cityId !== o.cityId || !able(b.office?.clerk)) return;
    // Only received testimony is public. Private reports are not a map inspector.
    s.known = { reportedAt: b.at, received: copy(s.received), reviews: copy(s.reviews),
      renewalResponses: copy(s.renewalResponses), renewals: copy(s.renewals),
      cooperation: b.c.presentIds.includes(o.memberIds[1]) ? withdrawn(o, o.memberIds[1]) ? 'withdrawn' : 'availableSubjectToOtherDuties'
        : s.known?.cooperation ?? 'notPersonallyHeard',
      working: s.job && { kind: s.job.kind, seconds: s.job.seconds, progress: s.job.progress }, limits: LIMITS };
  }
  function advance(o, b) {
    if (b.c.alive && authentic(o, b)) state(o);
    const s = o?.safeguards, j = s?.job;
    if (!b.c.alive) return false;
    if (!j) { observe(o, b); return false; }
    if (b.at < j.lastAt) return false;
    if (!authentic(o, b) || j.bodyEpoch !== b.c.bodyEpoch || !same(j.reports, s.reports)
      || !same(j.received, s.received) || j.ids.some(id => !able(b.succession.leaders.find(a => a.id === id)))
      || j.kind === 'review' && !b.succession.leaders.some(a => a.id === j.data.reviewerId && a.roles.includes('civicReview') && a.institutionId === j.data.institutionId)
      || !able(b.office.clerk) || ['renewalSigning'].includes(j.kind) && b.at >= j.data.expiresAt) {
      release(o, b); observe(o, b); return true;
    }
    const actors = j.ids.map(id => b.succession.leaders.find(a => a.id === id));
    const ready = local(o, b, j.ids) && b.c.externalPowered
      && [b.office, b.office.clerk, ...actors].every(a => a.assignment === j.id)
      && (j.kind !== 'review' || b.institutions?.offices[j.data.institutionId]?.available
        && b.institutions.offices[j.data.institutionId].jobs[j.data.id]?.readyAt === j.data.readyAt);
    const work = ready && j.wasReady ? Math.max(0, Math.min(b.at - j.lastAt, j.seconds - j.progress, b.office.workSeconds, ...actors.map(a => a.workSeconds))) : 0;
    j.lastAt = b.at; j.wasReady = Boolean(ready); j.progress += work;
    b.office.workSeconds -= work; actors.forEach(a => a.workSeconds -= work);
    if (j.progress >= j.seconds) {
      if (j.kind === 'receive') {
        const r = { ...copy(j.data), communicatedAt: b.at };
        s.received.push(r); b.office.records ||= []; b.office.records.push({ id: `${r.id}:received`, at: b.at, recorderId: b.office.clerk.id, report: copy(r) });
      } else if (j.kind === 'file') {
        s.reviews.push({ ...j.review, filedAt: b.at, status: 'queued' });
      } else if (j.kind === 'review') {
        const r = s.reviews.find(v => v.id === j.data.id);
        if (r?.status === 'queued' && same(r, j.data)) {
          r.status = 'completed'; r.finding = { at: b.at, reviewerId: r.reviewerId, outcome: 'breachUpheld',
            reason: 'The original received witness record establishes actual post-acceptance displacement under ordinary combat, not an authorized removal commission. The narrow promise was breached; no criminal guilt or loss of another office is decided.' };
          b.office.records ||= []; b.office.records.push({ id: `${r.id}:finding`, at: b.at, recorderId: b.office.clerk.id, finding: copy(r.finding) });
        }
      } else if (j.kind === 'renewalDiscussion') {
        const a = watch(o, b), offered = a.oppositionRenewalPolicy === 'considerAcknowledgedSafeguards';
        const id = `${o.id}:watch-renewal:${s.renewalResponses.length + 1}`;
        s.renewalResponses.push({ at: b.at, reviewId: j.data.id, decision: offered ? 'offered' : 'refused',
          reason: offered ? 'Offers renewed voluntary counter observation only after acknowledging the upheld breaches. No forgiveness or broader obedience follows.' : 'The original person declines renewed cooperation. A ruling cannot compel forgiveness; unchanged facts cannot reroll this response.',
          terms: offered ? { id, offeredAt: b.at, expiresAt: b.at + 3600, reviewId: j.data.id, accountId: o.settlement.id,
            personId: a.id, bodyEpoch: b.c.bodyEpoch, receivedIds: s.received.map(v => v.id),
            acknowledgment: 'Acknowledge the received and upheld receiving-approach promise breaches; retain every original record and injury.', scope: 'Voluntary original counter observation and truthful reporting only.', limits: LIMITS } : null });
      } else if (j.kind === 'renewalSigning') {
        const r = { id: `${j.data.id}:receipt`, at: b.at, terms: copy(j.data), recorderId: b.office.clerk.id };
        s.renewals.push(r); b.office.records ||= []; b.office.records.push(copy(r));
      }
      release(o, b);
    }
    observe(o, b); return work > 0;
  }
  const publicView = o => o?.safeguards?.known ? copy(o.safeguards.known) : null;
  return { LIMITS, authentic, removal, withdrawn, receive, file, hear, meet, sign, release, advance, observe, publicView };
});
