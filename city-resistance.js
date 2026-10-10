(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./home-institution-context') : root.HelixHomeInstitutionContext);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityResistance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Institutions) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const WINDOW = 28800, MEETING = 60, HEARING = 180;
  const ROLE = 'publicWorksAndProvisioning';
  const LIMITS = 'One public-works command relationship only. No criminal verdict, deposition, confiscation, divine consent, neighboring sovereignty or citywide revolt. Repairs and previously accepted safe work remain permitted; restored machinery does not restore consent.';
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const worker = (s, succession) => succession?.leaders.find(a => a.id === s?.workerId);
  const reviewer = (s, succession) => succession?.leaders.find(a => a.id === s?.reviewerId);
  function create(upkeep, succession) {
    const a = succession?.leaders.find(a => a.id === upkeep?.workerId);
    if (!a || !succession.handover || succession.handover.id !== upkeep.handoverId) return null;
    const r = succession.leaders.find(a => a.roles.includes('civicReview'));
    return { id: `${upkeep.id}:resistance`, sourceTheme: upkeep.sourceTheme, workerId: a.id, reviewerId: r?.id || null,
      institutionId: a.institutionId, reviewerInstitutionId: r?.institutionId || null,
      handoverId: upkeep.handoverId, charterId: upkeep.charterId, installationId: upkeep.installation.id,
      offer: null, commitment: null, notice: null, incidents: [], job: null, reviews: [], renewals: [],
      commandStatus: 'active', history: [], message: '', nextNumber: 1, lastAt: upkeep.lastAt };
  }
  function note(s, at, kind, text) {
    s.history.push({ at, kind, text }); s.history = s.history.slice(-40); s.message = text;
  }
  function bound(s, upkeep, succession, office, c) {
    return Boolean(s && upkeep && s.handoverId === succession?.handover?.id && s.handoverId === upkeep.handoverId
      && succession.control?.recognizedAuthorityId === 'scientist' && succession.source.charterId === s.charterId
      && s.installationId === upkeep.installation.id && worker(s, succession)?.institutionId === s.institutionId
      && worker(s, succession)?.roles.includes(ROLE)
      && office?.id === upkeep.officeId && office.cityId === upkeep.cityId && office.active
      && office.clerk?.id === upkeep.clerkId && same(office.civicCounter?.cell, upkeep.installation.cell)
      && c.charterCurrent && c.administrationAvailable && c.publicWorksAvailable && c.geometryAvailable
      && succession.agreements.some(a => a.personId === s.workerId));
  }
  function localReason(s, upkeep, succession, office, c) {
    if (!bound(s, upkeep, succession, office, c)) return 'Original charter, installation, clerk and public-works appointment required.';
    if (!c.alive || !c.capable || !c.atCounter || !c.visitPermission || !c.clerkPresent || !c.lineOfSight
      || !c.workerPresent || c.busy || c.cityId !== upkeep.cityId || c.bodyEpoch !== succession.control.bodyEpoch)
      return 'Attend the original counter and official, in the authenticated body and free of other work.';
    if (!able(worker(s, succession)) || !able(office.clerk)) return 'The named official and clerk must be capable; supplied recovery is still available.';
    return '';
  }
  function free(s, succession, office) {
    return !s.job && !office.assignment && !office.clerk.assignment && !worker(s, succession)?.assignment && !succession.job;
  }
  function setCommand(s, succession, value, at) {
    s.commandStatus = value;
    // Preserve the original agreement and all other roles held by a combined officeholder.
    const agreement = succession.agreements.find(a => a.personId === s.workerId);
    agreement.suspendedRoles = (agreement.suspendedRoles || []).filter(role => role !== ROLE);
    if (value !== 'active') agreement.suspendedRoles.push(ROLE);
    const link = succession.control.commandRelationships?.find(a => a.personId === s.workerId);
    if (link) { link.roleStates ||= {}; link.roleStates[ROLE] = { status: value, at, sourceId: s.notice?.id || s.id }; }
  }
  function propose(s, upkeep, succession, office, c, at) {
    if (localReason(s, upkeep, succession, office, c) || s.commitment || !free(s, succession, office)) return false;
    s.offer ||= { id: `${s.id}:terms:${s.nextNumber++}`, charterId: s.charterId, handoverId: s.handoverId,
      workerId: s.workerId, installationId: s.installationId,
      duties: 'Keep this counter supplied with three city-owned maintenance parts per service period, finite battery operations and supported staff recovery; authorize reachable upkeep before its published grace expires.',
      exceptions: 'Actual outages, injury, blocked access and unavailable staff or custody are capacity evidence, not proof of personal neglect. No new duty applies before attended acceptance.',
      scope: 'Existing public-works duties only; no orders to command the city defender, seize private property or override courts or faith obligations.',
      remedySeconds: WINDOW, remedy: 'Eight hours after personal receipt of a factual notice. Repairs and existing safe work remain possible during refusal. Renewed command requires an explicit attended agreement.',
      review: 'Independent existing civic-review officeholder, actual institutional queue and an attended three-minute hearing; an administrative decision is not a criminal verdict.' };
    note(s, at, 'terms', 'Exact prospective upkeep responsibilities disclosed. Historical handover has not been rewritten.'); return true;
  }
  function release(s, succession, office) {
    if (!s.job) return;
    for (const a of [worker(s, succession), reviewer(s, succession), office.clerk]) if (a?.assignment === s.job.id) a.assignment = null;
    if (office.assignment === s.job.id) office.assignment = null;
    s.job = null;
  }
  function begin(s, upkeep, succession, office, c, at, kind, seconds, terms = null) {
    if (localReason(s, upkeep, succession, office, c) || !free(s, succession, office)
      || at < (office.availableAt || 0) || !c.externalPowered || office.power < 1
      || office.workSeconds < seconds || worker(s, succession).workSeconds < seconds) return false;
    const r = kind === 'review' ? reviewer(s, succession) : null;
    if (r && (!independent(s, succession, c) || !c.staffPresentIds?.includes(r.id) || !able(r) || r.assignment || r.workSeconds < seconds)) return false;
    const id = `${s.id}:meeting:${s.nextNumber++}`;
    s.job = { id, kind, seconds, progress: 0, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch, terms: copy(terms),
      noticeId: s.notice?.id || null, reviewId: kind === 'review' ? s.notice.review.id : null };
    office.power--; office.assignment = id; office.clerk.assignment = id; worker(s, succession).assignment = id;
    if (r) r.assignment = id;
    note(s, at, 'meeting', `Started attended ${kind}; finite clerk and official work is required, even when the service channel is overdue.`); return true;
  }
  function accept(s, upkeep, succession, office, expected, c, at) {
    if (s.commitment || !s.offer || !same(s.offer, expected) || at >= upkeep.graceUntil) return false;
    return begin(s, upkeep, succession, office, c, at, 'commitment', MEETING, expected);
  }
  function observation(s, upkeep, succession, bargain, office, stacks, c, at) {
    const a = worker(s, succession);
    if (!bound(s, upkeep, succession, office, c) || !able(a) || a.workSeconds <= 0
      || a.locationId !== office.id || !c.workerCanInspect) return null;
    const blockers = [];
    if (!c.externalPowered) blockers.push('Observed external power outage');
    if (!able(office.clerk)) blockers.push('Original clerk incapacitated');
    if (office.workSeconds < 30 || office.power < 1 || office.assignment && office.assignment !== s.job?.id)
      blockers.push('Counter duty, battery allocation or assignment unavailable');
    if (a.workSeconds < 180 || a.assignment && a.assignment !== s.job?.id && a.assignment !== upkeep.job?.id)
      blockers.push('Public-works duty allocation or assignment unavailable');
    if (upkeep.job) blockers.push('Previously authorized upkeep still pending; completion is not presumed');
    if (!c.upkeepReachable) blockers.push('Inspected physical maintenance route blocked');
    const staged = stacks.filter(i => i.key === 'metalParts' && i.quantity >= 3 && !i.carriedBy && !i.tags?.includes('contaminated')
      && i.cityOwnerId === upkeep.cityId && i.civicCustody?.cityId === upkeep.cityId
      && i.reservedTaskId === `${succession.id}:city-maintenance-reserve`
      && same(i.cell, { x: 16, y: 12, z: 6 }));
    const reserveKnown = c.reserveInspectable === true;
    const reserveReady = reserveKnown && succession.provision.stock >= 3 && !succession.provision.reservedBy
      && able(bargain?.defender) && !bargain.defender.assignment && bargain.defender.workSeconds >= 1;
    if (!staged.length && !reserveReady) blockers.push(reserveKnown
      ? 'No three clean unreserved parts with an available original custodian' : 'Original reserve custody not inspected; supply capacity unverified');
    return { at, observerId: a.id, installationId: s.installationId, charterId: s.charterId,
      dueAt: upkeep.dueAt, graceUntil: upkeep.graceUntil, servicedAt: upkeep.servicedAt,
      overdue: at >= upkeep.graceUntil, blockers,
      sourceReceiptIds: succession.provision.receipts.map(r => r.id), stagedStackIds: staged.map(i => i.id),
      maintenanceReceiptIds: upkeep.receipts.filter(r => r.installationId === s.installationId).map(r => r.id) };
  }
  function receive(s, upkeep, succession, office, c, at) {
    if (localReason(s, upkeep, succession, office, c) || !s.notice || s.notice.receivedAt != null
      || !free(s, succession, office) || office.workSeconds < 30 || worker(s, succession).workSeconds < 30) return false;
    office.workSeconds -= 30; worker(s, succession).workSeconds -= 30;
    s.notice.receivedAt = at; s.notice.remedyUntil = at + WINDOW;
    note(s, at, 'received', 'Personally received the original factual objection. The eight-hour corrective window starts now, not while the report was undisclosed.'); return true;
  }
  function unsupported(s, upkeep, succession, office, c, at) {
    if (!s.commitment || s.commandStatus !== 'active' || s.notice && !s.notice.resolvedAt
      || localReason(s, upkeep, succession, office, c) || !free(s, succession, office)
      || office.workSeconds < 30 || worker(s, succession).workSeconds < 30) return false;
    office.workSeconds -= 30; worker(s, succession).workSeconds -= 30;
    if (s.notice) s.incidents.push(copy(s.notice));
    s.notice = { id: `${s.id}:objection:${s.nextNumber++}`, kind: 'unsupportedOrder', at, observerId: s.workerId,
      commitmentId: s.commitment.id, receivedAt: at, remedyUntil: null, resolvedAt: null,
      request: 'Transfer command of the city defender to the public-works official',
      finding: 'Declined: defense command is outside this public-works agreement; no defender has consented.',
      evidence: { at, requestIssuerId: 'scientist', recipientId: s.workerId, termsId: s.commitment.id }, review: null };
    setCommand(s, succession, 'suspended', at);
    note(s, at, 'refusal', s.notice.finding); return true;
  }
  function independent(s, succession, c) {
    const r = reviewer(s, succession);
    return Boolean(r && able(r) && r.id !== s.workerId && r.institutionId !== s.institutionId
      && r.institutionId === s.reviewerInstitutionId && r.locationId === succession.officeId
      && r.roles.includes('civicReview') && c.reviewAvailable);
  }
  function fileReview(s, upkeep, succession, office, institutions, c, at) {
    if (localReason(s, upkeep, succession, office, c) || !s.notice || s.notice.receivedAt == null
      || s.notice.resolvedAt || s.notice.review || !free(s, succession, office) || !independent(s, succession, c)
      || institutions?.cityId !== upkeep.cityId || institutions.roles['civic-review'] !== s.reviewerInstitutionId
      || office.workSeconds < 30 || worker(s, succession).workSeconds < 30) return false;
    const id = `${s.notice.id}:review`, readyAt = Institutions.reserve(institutions, 'civic-review', id, at);
    if (readyAt == null) return false;
    office.workSeconds -= 30; worker(s, succession).workSeconds -= 30;
    s.notice.review = { id, queuedAt: at, readyAt, reviewerId: s.reviewerId, status: 'queued', evidence: copy(s.notice) };
    note(s, at, 'reviewFiled', 'The existing independent civic-review institution allocated its actual queue. No ruling or staff is created by filing.'); return true;
  }
  function hear(s, upkeep, succession, office, institutions, c, at) {
    const r = s.notice?.review;
    if (!r || s.commandStatus !== 'suspended' || r.status !== 'queued' || at < r.readyAt || !independent(s, succession, c)
      || institutions?.roles['civic-review'] !== s.reviewerInstitutionId
      || institutions.offices[s.reviewerInstitutionId]?.jobs[r.id]?.readyAt !== r.readyAt
      || !institutions.offices[s.reviewerInstitutionId]?.available) return false;
    return begin(s, upkeep, succession, office, c, at, 'review', HEARING);
  }
  function renew(s, upkeep, succession, bargain, office, stacks, expected, c, at) {
    const n = s.notice;
    if (s.commandStatus === 'active' || !n?.review || n.review.status !== 'completed' || !same(expected, n.review)
      || at >= upkeep.graceUntil || !observation(s, upkeep, succession, bargain, office, stacks, c, at)) return false;
    // Even a dismissed allegation does not grant obedience. The named official
    // explicitly agrees only after the supported remedy and scoped terms.
    const facts = observation(s, upkeep, succession, bargain, office, stacks, c, at);
    if (facts.blockers.length) return false;
    return begin(s, upkeep, succession, office, c, at, 'renewal', MEETING, expected);
  }
  function cancel(s, succession, office, at) {
    if (!s.job) return false;
    release(s, succession, office); note(s, at, 'interrupted', 'Meeting ended without a signature or decision. Spent work and the original review allocation remain.'); return true;
  }
  function advance(s, upkeep, succession, bargain, office, stacks, institutions, c, at) {
    if (!s || !c.alive || at < s.lastAt) return false;
    s.lastAt = at; let changed = false;
    const facts = s.commitment ? observation(s, upkeep, succession, bargain, office, stacks, c, at) : null;
    if (facts && facts.overdue && at >= s.commitment.effectiveAt && s.commandStatus === 'active'
      && (!s.notice || s.notice.resolvedAt && s.notice.evidence.graceUntil !== upkeep.graceUntil)) {
      if (s.notice) s.incidents.push(copy(s.notice));
      s.notice = { id: `${s.id}:objection:${s.nextNumber++}`, kind: 'upkeep', at, observerId: s.workerId,
        commitmentId: s.commitment.id, receivedAt: null, remedyUntil: null, resolvedAt: null,
        finding: 'The agreed counter service period has expired. A factual shortage or capacity report is not proof of personal neglect.', evidence: facts, review: null };
      worker(s, succession).workSeconds--;
      note(s, at, 'objection', 'The named official recorded an actually inspected overdue counter. Undelivered notice has no corrective deadline.'); changed = true;
    }
    const n = s.notice;
    if (n?.kind === 'upkeep' && !n.resolvedAt && facts) {
      n.capacityReports ||= [];
      n.observedCapacityEvidence ||= {};
      // Keep the first evidence of each actual obstruction even if a long
      // sequence of later status changes trims the bounded recent timeline.
      for (const blocker of facts.blockers) n.observedCapacityEvidence[blocker] ||= copy(facts);
      const last = n.capacityReports.at(-1) || n.evidence;
      if (!same(last.blockers, facts.blockers)) {
        n.capacityReports.push(copy(facts)); n.capacityReports = n.capacityReports.slice(-40);
        changed = true;
      }
      const timelyRepair = upkeep.servicedAt != null && upkeep.servicedAt > n.evidence.at
        && (n.remedyUntil == null || upkeep.servicedAt <= n.remedyUntil) && !facts.overdue;
      if (timelyRepair && s.commandStatus === 'active') {
        n.resolvedAt = at; n.resolution = 'Supported repair before the personally received corrective deadline; no refusal imposed.';
        if (n.review?.status === 'queued') { n.review.status = 'closedByRemedy'; n.review.closedAt = at; }
        note(s, at, 'remedied', n.resolution); changed = true;
      } else if (n.remedyUntil != null && at >= n.remedyUntil && s.commandStatus === 'active'
        && (facts.overdue || upkeep.servicedAt > n.remedyUntil)) {
        n.deadlineEvidence = facts;
        setCommand(s, succession, 'suspended', at);
        note(s, at, 'limitedRefusal', 'The received corrective window elapsed without timely supported repair. New discretionary public-works commands are declined; essential repair and accepted work remain authorized. Capacity evidence is retained, not converted to guilt.'); changed = true;
      }
    }
    const j = s.job;
    if (j) {
      if (localReason(s, upkeep, succession, office, c) || c.bodyEpoch !== j.bodyEpoch) return cancel(s, succession, office, at);
      const actors = [worker(s, succession), office.clerk, ...(j.kind === 'review' ? [reviewer(s, succession)] : [])];
      const valid = c.externalPowered && office.assignment === j.id && office.workSeconds > 0
        && actors.every(a => able(a) && a.assignment === j.id)
        && (j.kind !== 'review' || independent(s, succession, c) && c.staffPresentIds?.includes(s.reviewerId)
          && institutions?.offices[s.reviewerInstitutionId]?.available);
      const start = j.lastAt, delta = Math.max(0, at - start); j.lastAt = at;
      if (!valid) { j.wasReady = false; return changed; }
      const work = j.wasReady ? Math.min(delta, j.seconds - j.progress, office.workSeconds,
        ...actors.filter(a => a !== office.clerk).map(a => a.workSeconds)) : 0;
      j.wasReady = true; office.workSeconds -= work;
      for (const a of actors) if (a !== office.clerk) a.workSeconds -= work;
      j.progress += work;
      if (j.progress >= j.seconds) {
        const completedAt = start + work;
        if (j.kind === 'commitment' && completedAt < upkeep.graceUntil && !s.commitment) {
          s.commitment = { ...copy(j.terms), acceptedAt: completedAt, effectiveAt: completedAt,
            bodyEpoch: j.bodyEpoch, witnesses: [s.workerId, office.clerk.id] };
          note(s, completedAt, 'commitment', 'The scientist and original public-works official accepted precise prospective upkeep terms. No earlier service failure becomes a retrospective breach.');
        } else if (j.kind === 'review' && n?.id === j.noticeId && n.review?.id === j.reviewId && !n.resolvedAt) {
          const evidence = copy({ original: n.review.evidence, capacityReports: n.capacityReports || [],
            observedCapacityEvidence: n.observedCapacityEvidence || {}, deadline: n.deadlineEvidence || null,
            current: facts, repairs: upkeep.receipts.filter(r => r.installationId === s.installationId), commitment: s.commitment });
          const capacity = n.kind === 'upkeep' && (!facts || [...n.evidence.blockers, ...Object.keys(n.observedCapacityEvidence || {}),
            ...(n.capacityReports || []).flatMap(r => r.blockers), ...(n.deadlineEvidence?.blockers || []), ...facts.blockers].length > 0);
          const outcome = n.kind === 'unsupportedOrder' ? 'unsupportedOrderUpheld'
            : capacity ? 'capacityFailureNotMisconduct' : n.deadlineEvidence ? 'unmetObligationUpheld' : 'correctiveWindowStillOpen';
          Object.assign(n.review, { status: 'completed', at: completedAt, outcome, evidence,
            finding: capacity ? 'Observed loss of capacity supports a service objection, but does not establish personal neglect or crime.'
              : n.kind === 'unsupportedOrder' ? 'The recorded defense-command demand exceeds the signed public-works scope.'
                : n.deadlineEvidence ? 'The explicit obligation and personally received deadline were unmet on the recorded evidence; no criminal verdict or deposition follows.'
                  : 'No missed corrective deadline has been established. The scientist retains the agreed opportunity to remedy.',
            scope: LIMITS });
          s.reviews.push(copy(n.review)); note(s, completedAt, 'review', n.review.finding);
        } else if (j.kind === 'renewal' && n?.id === j.noticeId && same(j.terms, n.review)
          && at < upkeep.graceUntil && facts && !facts.blockers.length) {
          const receipt = { id: `${j.id}:receipt`, at: completedAt, personId: s.workerId, reviewId: n.review.id,
            termsId: s.commitment.id, scope: 'Renewed original public-works duties only; defense, courts, property and faith remain independent.' };
          s.renewals.push(receipt); n.resolvedAt = completedAt; n.resolution = receipt.scope;
          setCommand(s, succession, 'active', completedAt); note(s, completedAt, 'renewal', 'The named official explicitly renewed the bounded relationship after supported remedy and review. No other institution pledged obedience.');
        } else {
          note(s, completedAt, 'meetingUnfulfilled', 'The attended work ended, but the original terms, remedy or capacity no longer supported a signature. No consent or decision was awarded; spent work remains spent.');
        }
        office.availableAt = Math.max(office.availableAt || 0, completedAt); release(s, succession, office); changed = true;
      }
    }
    s.incidents = s.incidents.slice(-30); s.reviews = s.reviews.slice(-30); s.renewals = s.renewals.slice(-30);
    return changed;
  }
  function publicView(s, succession, c) {
    if (!s) return null;
    return { official: { id: s.workerId, name: worker(s, succession)?.name }, offer: copy(s.offer), commitment: copy(s.commitment),
      commandStatus: s.commandStatus, notice: copy(s.notice), reviews: copy(s.reviews), renewals: copy(s.renewals),
      independentReview: independent(s, succession, c),
      reviewAvailability: independent(s, succession, c) ? `Existing independent reviewer: ${reviewer(s, succession).name}`
        : 'Independent review unavailable: no distinct supported reviewer. A combined officeholder cannot judge their own objection.',
      working: s.job && { kind: s.job.kind, progress: s.job.progress, seconds: s.job.seconds }, message: s.message, limitations: LIMITS };
  }
  return { WINDOW, MEETING, HEARING, ROLE, LIMITS, create, localReason, propose, accept, observation, receive, unsupported,
    independent, fileReview, hear, renew, cancel, advance, publicView };
});
