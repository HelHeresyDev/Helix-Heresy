(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./charter-recognition') : root.HelixCharterRecognition,
    typeof module === 'object' && module.exports ? require('./public-works-recognition') : root.HelixPublicWorksRecognition);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixWatchRecognition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Charter, Works) {
  'use strict';
  // Keep observation off the existing medical receiving/handoff and clinic
  // cells. Their staff and physical capacity are not ours to displace.
  const ROLE = 'civilWatch', POST = Object.freeze({ x: 19, y: 10, z: 6 }), SECONDS = 600;
  const LIMITS = 'Original municipal counter observation only. Coercion, private rights, cases, judicial independence and religious duties remain. No arrests, pardons, army, new guards, citywide control, divine approval or exclusive joint-stronghold command.';
  const SCOPE = 'Original counter observation and incident reporting only';
  const DUTIES = 'One original person may undertake a ten-minute physical counter watch per exact instruction, using finite duty and the supplied counter. Incidents require real perception and later attended communication; the scientist receives no special immunity.';
  const renewedKind = kind => ['reaffirmationDiscussion', 'reaffirmationSigning'].includes(kind);
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cellSame = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const actor = (s, succession) => succession?.leaders.find(a => a.id === s?.personId && a.roles.includes(ROLE));
  function create(charter, works, succession, office) {
    const a = succession?.leaders.find(a => a.roles.includes(ROLE));
    if (!a || !office?.clerk?.id || !charter?.recognition || !works?.receipt || works.receipt.role !== Works.ROLE
      || works.administrationReceiptId !== charter.recognition.id || succession.handover || succession.officeId !== office?.id) return null;
    if (!a.watchPolicy) {
      const n = [...a.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
      a.watchPolicy = n % 5 === 0 ? 'declineCoercedContinuation' : 'considerCounterObservation';
    }
    return { id: `${charter.id}:watch`, cityId: charter.cityId, charterId: charter.charterId, sourceTheme: charter.sourceTheme,
      officeId: office.id, clerkId: office.clerk.id, personId: a.id, institutionId: a.institutionId,
      administrationReceiptId: charter.recognition.id, worksReceiptId: works.receipt.id,
      phase: 'unheard', response: null, terms: null, receipt: null, reaffirmation: null, previousReaffirmations: [], job: null, duty: null,
      reports: [], deliveries: [], history: [], nextNumber: 1, message: '' };
  }
  const normalize = s => s?.worksReceiptId && s.personId && Array.isArray(s.history) && Array.isArray(s.reports) && Array.isArray(s.deliveries)
    ? { ...copy(s), reaffirmation: s.reaffirmation ? copy(s.reaffirmation) : null, previousReaffirmations: copy(s.previousReaffirmations || []) } : null;
  function note(s, at, kind, text) { s.message = text; s.history.push({ at, kind, text }); s.history = s.history.slice(-40); }
  function identities(s, charter, works, succession, office, c) {
    const a = actor(s, succession);
    return Boolean(s && a && a.institutionId === s.institutionId && a.locationId === s.officeId
      && office?.id === s.officeId && office.cityId === s.cityId && office.clerk?.id === s.clerkId
      && charter?.cityId === s.cityId && charter.charterId === s.charterId && succession.source.charterId === s.charterId
      && charter.recognition?.id === s.administrationReceiptId && works?.receipt?.id === s.worksReceiptId
      && c.watchInstitutionId === s.institutionId && c.watchAvailable && office.active && c.alive);
  }
  function bound(s, charter, works, succession, abdication, office, c) {
    const canonical = { ...c, cityId: s?.cityId };
    return identities(s, charter, works, succession, office, c)
      && Charter.authorityCurrent(charter, succession, abdication, office, canonical)
      && Boolean(Works.authorization(works, charter, succession, abdication, office, canonical));
  }
  function facts(s, charter, c) {
    return { administrationReceiptId: s.administrationReceiptId, worksReceiptId: s.worksReceiptId,
      evidence: copy(charter.review.evidence), conditions: copy(c.watchConditions || []) };
  }
  function local(s, charter, works, succession, abdication, office, c, own = false) {
    const a = actor(s, succession), id = own ? s?.job?.id : null;
    const kind = own ? s?.job?.kind : c.attendanceKind;
    const supported = renewedKind(kind) ? reaffirmationBasis(s, charter, works, succession, abdication, office, c)
      : kind === 'instruction' ? authorization(s, charter, works, succession, abdication, office, c)
        : bound(s, charter, works, succession, abdication, office, c);
    return Boolean(supported
      && Charter.operative(charter, succession, abdication, office, c) && c.local && c.atCounter && c.visitPermission
      && c.cityId === s.cityId && (!renewedKind(kind) || c.geometryAvailable && office.maintenanceReady !== false)
      && c.capable && c.clerkPresent && c.lineOfSight && !c.busy && !c.activeViolence && able(a) && able(office.clerk)
      && c.presentIds?.includes(a.id) && office.channelPowered && !s.duty && !charter.job && !works.job && !succession.job
      && (!a.assignment || a.assignment === id) && (!office.assignment || office.assignment === id)
      && (!office.clerk.assignment || office.clerk.assignment === id));
  }
  function begin(s, charter, works, succession, abdication, office, c, at, kind, seconds, terms = null) {
    const a = actor(s, succession);
    if (!s || s.job || !local(s, charter, works, succession, abdication, office, { ...c, attendanceKind: kind }) || office.power < 1
      || office.workSeconds < seconds || a.workSeconds < seconds || at < (office.availableAt || 0)) return false;
    const id = `${s.id}:meeting:${s.nextNumber++}`, renewedBasis = renewedKind(kind) || kind === 'instruction' && Boolean(charter.reconsideration);
    s.job = { id, kind, seconds, progress: 0, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch,
      renewedBasis, facts: renewedBasis ? reaffirmationFacts(s, charter, works, c) : facts(s, charter, c), terms: copy(terms) };
    office.power--; a.assignment = office.assignment = office.clerk.assignment = id;
    note(s, at, kind, 'Attend the original watch official and shared clerk. Finite work and power are not refunded on interruption.'); return true;
  }
  function meet(s, charter, works, succession, abdication, office, c, at) {
    if (!s || s.receipt || s.response && same(s.response.facts, facts(s, charter, c))) return false;
    return begin(s, charter, works, succession, abdication, office, c, at, 'discussion', 60);
  }
  function sign(s, charter, works, succession, abdication, office, terms, c, at) {
    return Boolean(s?.terms && !s.receipt && same(terms, s.terms) && at < s.terms.expiresAt
      && same(s.response.facts, facts(s, charter, c))
      && begin(s, charter, works, succession, abdication, office, c, at, 'continuation', 60, terms));
  }
  function originalReceipt(s, charter, works, succession, abdication, office, c) {
    const r = s?.receipt;
    return r && r.id === `${s.id}:recognition` && r.origin === 'coerced' && r.role === ROLE
      && r.personId === s.personId && r.institutionId === s.institutionId && r.recorderId === s.clerkId
      && r.cityId === s.cityId && r.charterId === s.charterId && r.officeId === s.officeId
      && r.administrationReceiptId === s.administrationReceiptId && r.worksReceiptId === s.worksReceiptId
      && r.bodyEpoch === c.bodyEpoch && same(r.terms, s.terms) && r.terms?.role === ROLE
      && r.terms.personId === s.personId && r.terms.institutionId === s.institutionId
      && r.terms.claimId === charter?.claim?.id && r.terms.reviewId === charter?.review?.id
      && r.terms.bodyEpoch === c.bodyEpoch && r.terms.cityId === s.cityId && r.terms.charterId === s.charterId
      && r.terms.officeId === s.officeId && r.terms.administrationReceiptId === s.administrationReceiptId
      && r.terms.worksReceiptId === s.worksReceiptId && r.terms.origin === 'coerced'
      && r.terms.duties === DUTIES && r.terms.limitations === LIMITS && r.limitations === LIMITS
      && r.terms.retainedRights === charter.claim.terms.retainedRights
      && r.commandRelationship?.personId === s.personId && r.commandRelationship.role === ROLE && r.commandRelationship.scope === SCOPE
      && s.response?.decision === 'offered' && s.response.personId === s.personId && s.response.facts
      && same(s.response.facts, facts(s, charter, { ...c, watchConditions: s.response.facts.conditions }))
      && identities(s, charter, works, succession, office, c) && actor(s, succession)?.status === 'alive'
      && Charter.authenticRecognition(charter, succession, abdication, office, { ...c, cityId: s.cityId })
      // Historical maintenance support authenticates the old prerequisite only;
      // new watch commands still need their own current political basis below.
      && (Works.authorization(works, charter, succession, abdication, office, c)
        || Works.essentialAuthorization(works, charter, succession, abdication, office, c)) ? r : null;
  }
  function reaffirmationFacts(s, charter, works, c) {
    return { originalReceiptId: s.receipt.id, originalAdministrationReceiptId: s.administrationReceiptId,
      originalWorksReceiptId: s.worksReceiptId, administrationReaffirmationId: charter.reaffirmation.receipt.id,
      worksReaffirmationId: works.reaffirmation.receipt.id, findingId: charter.reconsideration.id,
      installationId: c.upkeep.installation.id, evidence: copy(charter.reconsideration.evidence), conditions: copy(c.watchConditions || []) };
  }
  function reaffirmationBasis(s, charter, works, succession, abdication, office, c) {
    return Boolean(originalReceipt(s, charter, works, succession, abdication, office, c)
      && Works.reaffirmationCurrent(works, charter, succession, abdication, office, { ...c, cityId: s.cityId }));
  }
  function reaffirmationTerms(s, charter, works, c, at) {
    return { id: `${s.reaffirmation.id}:terms`, offeredAt: at, expiresAt: at + 3600, ...reaffirmationFacts(s, charter, works, c),
      claimId: charter.claim.id, cityId: s.cityId, charterId: s.charterId, officeId: s.officeId,
      personId: s.personId, institutionId: s.institutionId, role: ROLE, origin: 'coerced', bodyEpoch: c.bodyEpoch,
      retainedRights: charter.claim.terms.retainedRights, duties: DUTIES, limitations: LIMITS };
  }
  function canReaffirm(s, charter, works, succession, abdication, office, c) {
    if (!s || s.job || s.duty || !reaffirmationBasis(s, charter, works, succession, abdication, office, c)) return false;
    const f = reaffirmationFacts(s, charter, works, c);
    return ![s.reaffirmation, ...(s.previousReaffirmations || [])].some(r => r?.response && same(r.response.facts, f));
  }
  function reaffirmMeeting(s, charter, works, succession, abdication, office, c, at) {
    if (!canReaffirm(s, charter, works, succession, abdication, office, c)
      || !begin(s, charter, works, succession, abdication, office, c, at, 'reaffirmationDiscussion', 60)) return false;
    if (s.reaffirmation) s.previousReaffirmations.push(copy(s.reaffirmation));
    s.reaffirmation = { id: `${s.id}:reaffirmation:${s.nextNumber++}`, response: null, terms: null, receipt: null }; return true;
  }
  function reaffirmSign(s, charter, works, succession, abdication, office, terms, c, at) {
    const r = s?.reaffirmation;
    return Boolean(r?.terms && r.response?.decision === 'offered' && !r.receipt && same(terms, r.terms)
      && reaffirmationBasis(s, charter, works, succession, abdication, office, c)
      && same(r.response.facts, reaffirmationFacts(s, charter, works, c))
      && same(r.terms, reaffirmationTerms(s, charter, works, c, r.response.at)) && at < r.terms.expiresAt
      && begin(s, charter, works, succession, abdication, office, c, at, 'reaffirmationSigning', 60, terms));
  }
  function reaffirmationCurrent(s, charter, works, succession, abdication, office, c) {
    if (!reaffirmationBasis(s, charter, works, succession, abdication, office, c)) return false;
    const a = s.reaffirmation, r = a?.receipt;
    return Boolean(r && r.id === `${a.id}:receipt` && r.type === 'watchReaffirmation' && r.recorderId === office.clerk.id
      && a.response?.decision === 'offered' && a.response.personId === s.personId
      && same(a.response.facts, reaffirmationFacts(s, charter, works, c))
      && same(a.terms, reaffirmationTerms(s, charter, works, c, a.response.at)) && same(r.terms, a.terms)
      && r.at >= a.terms.offeredAt && r.at < a.terms.expiresAt
      && Object.entries(a.terms).every(([key, value]) => key === 'id' || same(r[key], value))
      && r.commandRelationship?.personId === s.personId && r.commandRelationship.role === ROLE && r.commandRelationship.scope === SCOPE
      && office.records?.some(record => same(record, r)));
  }
  function authorization(s, charter, works, succession, abdication, office, c) {
    return originalReceipt(s, charter, works, succession, abdication, office, c)
      && (bound(s, charter, works, succession, abdication, office, c)
        || reaffirmationCurrent(s, charter, works, succession, abdication, office, c)) ? s.receipt : null;
  }
  function instructionTerms(s) {
    return s?.receipt ? { recognitionId: s.receipt.id, ...(s.reaffirmation?.receipt ? { reaffirmationId: s.reaffirmation.receipt.id } : {}),
      role: ROLE, personId: s.personId, officeId: s.officeId,
      post: copy(POST), seconds: SECONDS, duty: 'Observe this counter; record only personally perceived incidents, then physically return. No enforcement or immunity.' } : null;
  }
  function order(s, charter, works, succession, abdication, office, terms, c, at) {
    if (!authorization(s, charter, works, succession, abdication, office, c)) return false;
    if (!same(terms, instructionTerms(s))) { note(s, at, 'refusedInstruction', 'Only the exact counter-observation instruction is permitted. No arrest, immunity or wider command.'); return false; }
    if (!c.geometryAvailable || !c.postReachable || office.maintenanceReady === false) {
      note(s, at, 'unavailable', 'The original observation post must be physically reachable and the supplied counter usable. No person may be displaced or teleported.'); return false;
    }
    if (actor(s, succession).workSeconds < SECONDS + 90) {
      note(s, at, 'unavailable', 'The original watch official lacks enough finite duty for this instruction, ten-minute watch and travel allowance.'); return false;
    }
    return begin(s, charter, works, succession, abdication, office, c, at, 'instruction', 30, terms);
  }
  function release(s, succession, office) {
    if (!s.job) return;
    for (const a of [actor(s, succession), office, office?.clerk]) if (a?.assignment === s.job.id) a.assignment = null;
    s.job = null;
  }
  function cancel(s, succession, office, at) {
    if (!s?.job) return false;
    release(s, succession, office); note(s, at, 'interrupted', 'Unfinished attendance ended. No signature or command was completed.'); return true;
  }
  function advance(s, charter, works, succession, abdication, office, c, at, effects = {}) {
    if (!s || !c.alive) return false;
    const a = actor(s, succession);
    if (s.duty) {
      const d = s.duty, delta = Math.max(0, at - d.lastAt); d.lastAt = at;
      // Changed cooperation blocks NEW instructions, not truthful observation or
      // the existing person's safe return. Never commandeer a replacement actor.
      if (!identities(s, charter, works, succession, office, c) || !able(a) || a.assignment !== d.id
        || !c.geometryAvailable || !office.channelPowered || office.maintenanceReady === false || a.workSeconds <= 0) { d.wasReady = false; d.travelCredit = 0; return false; }
      if (d.bodyEpoch !== c.bodyEpoch && d.status !== 'returning') { d.status = 'returning'; d.interrupted = true; }
      if (!d.wasReady) { d.wasReady = true; return false; }
      if (delta <= 0) return false;
      if (d.status === 'walking' || d.status === 'returning') {
        d.travelCredit = Math.min(1, (d.travelCredit || 0) + delta);
        if (d.travelCredit < 1 || a.workSeconds < 1) return false;
        const target = d.status === 'walking' ? POST : d.homeCell;
        if (!cellSame(a.mapCell, target)) {
          if (!effects.move?.(a, target)) { d.blocked = true; return false; }
          a.workSeconds--; d.travelSeconds++; d.travelCredit = 0; d.blocked = false; return true;
        }
        if (d.status === 'walking') { d.status = 'observing'; d.startedAt = at; return true; }
        s.deliveries.push({ id: `${d.id}:completion`, at, dutyId: d.id, personId: a.id,
          status: d.interrupted ? 'interruptedReturn' : 'completed', seconds: d.progress, travelSeconds: d.travelSeconds,
          reportIds: s.reports.filter(r => r.dutyId === d.id).map(r => r.id) });
        if (a.assignment === d.id) a.assignment = null;
        s.duty = null; note(s, at, 'returned', 'The original watch official physically returned. Uncommunicated incident reports remain private.'); return true;
      }
      if (!cellSame(a.mapCell, POST) || !c.counterVisible) { d.wasReady = false; return false; }
      const work = Math.min(delta, SECONDS - d.progress, a.workSeconds);
      a.workSeconds -= work; d.progress += work;
      if (d.progress >= SECONDS) d.status = 'returning';
      return work > 0;
    }
    if (!s.job) return false;
    const j = s.job, renewed = renewedKind(j.kind), offer = renewed ? s.reaffirmation?.terms : s.terms;
    const supported = renewed ? reaffirmationBasis(s, charter, works, succession, abdication, office, c)
      : j.kind === 'instruction' ? authorization(s, charter, works, succession, abdication, office, c)
        : bound(s, charter, works, succession, abdication, office, c);
    if (!supported || j.bodyEpoch !== c.bodyEpoch
      || !same(j.facts, j.renewedBasis ? reaffirmationFacts(s, charter, works, c) : facts(s, charter, c))
      || ['continuation', 'reaffirmationSigning'].includes(j.kind) && (!offer || at >= offer.expiresAt || !same(j.terms, offer)))
      return cancel(s, succession, office, at);
    if (!local(s, charter, works, succession, abdication, office, c, true)) { j.wasReady = false; j.lastAt = at; return false; }
    const start = j.lastAt, work = j.wasReady ? Math.max(0, Math.min(at - start, j.seconds - j.progress, office.workSeconds, a.workSeconds)) : 0;
    j.lastAt = at; j.wasReady = true; j.progress += work; office.workSeconds -= work; a.workSeconds -= work;
    if (j.progress < j.seconds) return work > 0;
    const completedAt = start + work;
    if (renewed) {
      const r = s.reaffirmation;
      if (j.kind === 'reaffirmationDiscussion') {
        const refuses = a.watchPolicy === 'declineCoercedContinuation' || j.facts.conditions.length > 0
          || j.facts.evidence.conduct.some(report => report.at > charter.claim.at && /attack/i.test(report.kind));
        r.response = { at: completedAt, personId: a.id, facts: copy(j.facts), decision: refuses ? 'refused' : 'offered',
          reason: refuses ? 'The original watch official refuses on personal independence, received renewed violence or incompatible duties. Eligibility is not forgiveness or a criminal verdict.'
            : 'The original watch official offers separately renewed counter observation and truthful reporting only. Other officers, courts and existing cases are untouched.' };
        r.terms = refuses ? null : reaffirmationTerms(s, charter, works, c, completedAt);
        release(s, succession, office); s.phase = refuses ? 'reaffirmationRefused' : 'reaffirmationOffered';
        note(s, completedAt, 'reaffirmationResponse', r.response.reason);
      } else {
        r.receipt = { ...copy(j.terms), id: `${r.id}:receipt`, type: 'watchReaffirmation', at: completedAt,
          terms: copy(j.terms), recorderId: office.clerk.id,
          commandRelationship: { personId: a.id, role: ROLE, scope: SCOPE } };
        office.records ||= []; office.records.push(copy(r.receipt));
        release(s, succession, office); s.phase = 'reaffirmed';
        note(s, completedAt, 'reaffirmed', 'The original watch official separately reaffirmed only the existing counter duty. Original signatures, reports and cases remain; no duty or power was replenished.');
      }
    } else if (j.kind === 'discussion') {
      const refuses = a.watchPolicy === 'declineCoercedContinuation' || j.facts.conditions.length > 0
        || j.facts.evidence.conduct.some(r => /attack/i.test(r.kind));
      s.response = { at: completedAt, personId: a.id, facts: copy(j.facts), decision: refuses ? 'refused' : 'offered',
        reason: refuses ? 'The original watch official refuses on personal independence or received conduct and conditions. This is not criminal guilt.'
          : 'The original watch official offers counter observation and truthful reporting only; other watch personnel and courts have not agreed.' };
      s.terms = refuses ? null : { id: `${s.id}:terms:${s.nextNumber++}`, offeredAt: completedAt, expiresAt: completedAt + 3600,
        cityId: s.cityId, charterId: s.charterId, officeId: s.officeId, personId: a.id, institutionId: s.institutionId,
        role: ROLE, bodyEpoch: c.bodyEpoch, claimId: charter.claim.id, reviewId: charter.review.id, origin: 'coerced',
        administrationReceiptId: s.administrationReceiptId, worksReceiptId: s.worksReceiptId,
        retainedRights: charter.claim.terms.retainedRights,
        duties: DUTIES, limitations: LIMITS };
      release(s, succession, office); s.phase = refuses ? 'refused' : 'offered'; note(s, completedAt, 'response', s.response.reason);
    } else if (j.kind === 'continuation') {
      s.receipt = { id: `${s.id}:recognition`, at: completedAt, origin: 'coerced', role: ROLE,
        cityId: s.cityId, charterId: s.charterId, officeId: s.officeId, personId: a.id, institutionId: s.institutionId,
        recorderId: s.clerkId, administrationReceiptId: s.administrationReceiptId, worksReceiptId: s.worksReceiptId,
        bodyEpoch: c.bodyEpoch, terms: copy(j.terms), commandRelationship: { personId: a.id, role: ROLE, scope: SCOPE }, limitations: LIMITS };
      release(s, succession, office); s.phase = 'recognized'; note(s, completedAt, 'recognized', 'The original watch official accepted only their own exact counter duty.');
    } else {
      if (!c.geometryAvailable || !c.postReachable || !same(j.terms, instructionTerms(s))) return cancel(s, succession, office, at);
      const id = `${s.id}:duty:${s.nextNumber++}`;
      s.duty = { id, personId: a.id, recognitionId: s.receipt.id, bodyEpoch: c.bodyEpoch, homeCell: copy(a.mapCell),
        status: 'walking', progress: 0, travelSeconds: 0, lastAt: completedAt, wasReady: true, terms: copy(j.terms) };
      release(s, succession, office); a.assignment = id;
      note(s, completedAt, 'ordered', 'The original officeholder must physically reach the observation post before the ten-minute watch begins.');
    }
    return true;
  }
  function observe(s, succession, event, perception, at) {
    const a = actor(s, succession), d = s?.duty;
    if (!d || d.status !== 'observing' || d.progress >= SECONDS || !able(a) || a.assignment !== d.id || !cellSame(a.mapCell, POST)
      || !perception.counterVisible || !perception.observed || !perception.identified || !event?.id || event.at !== at
      || event.cityId !== s.cityId || !event.actorId || !event.targetId || !event.cell
      || s.reports.some(r => r.eventId === event.id)) return null;
    const r = { id: `${s.id}:incident:${s.nextNumber++}`, eventId: event.id, dutyId: d.id, at,
      cityId: s.cityId, kind: event.kind, actorId: event.actorId, targetId: event.targetId, witnessId: a.id,
      cell: copy(event.cell), detail: event.detail, finding: 'Personally observed conduct only. No guilt, charge, custody or pardon is decided.', communicatedAt: null };
    s.reports.push(r); return r;
  }
  function receive(s, succession, office, c, at, effects = {}) {
    const a = actor(s, succession), pending = s?.reports.filter(r => r.communicatedAt == null);
    // Receiving truthful evidence does not require continued political assent.
    if (!pending?.length || s.job || s.duty || !c.alive || !c.capable || !c.local || !c.atCounter || !c.visitPermission
      || c.busy || !c.clerkPresent || !c.lineOfSight || !c.presentIds?.includes(a?.id) || !able(a) || !able(office?.clerk)
      || office.id !== s.officeId || office.clerk.id !== s.clerkId || !office.active || !office.channelPowered
      || a.assignment || office.assignment || office.clerk.assignment || office.workSeconds < 30 || a.workSeconds < 30 || office.power < 1) return false;
    office.power--; office.workSeconds -= 30; a.workSeconds -= 30;
    for (const r of pending) { r.communicatedAt = at; effects.communicate?.(copy(r)); }
    note(s, at, 'received', 'Actual watch reports were physically communicated to the scientist and original clerk. Civic consideration is not a criminal judgment.'); return true;
  }
  function publicView(s) {
    const view = r => r && { id: r.id, response: r.response && { at: r.response.at, decision: r.response.decision, reason: r.response.reason },
      terms: r.terms && Object.fromEntries(Object.entries(r.terms).filter(([key]) => !['evidence', 'conditions'].includes(key))),
      receipt: r.receipt && { id: r.receipt.id, at: r.receipt.at, role: r.receipt.role, personId: r.receipt.personId,
        origin: r.receipt.origin, findingId: r.receipt.findingId, originalReceiptId: r.receipt.originalReceiptId,
        worksReaffirmationId: r.receipt.worksReaffirmationId } };
    return s ? copy({ phase: s.phase, personId: s.personId, response: s.response && { at: s.response.at, decision: s.response.decision, reason: s.response.reason },
      terms: s.terms, receipt: s.receipt, instructionTerms: instructionTerms(s),
      reaffirmation: view(s.reaffirmation), previousReaffirmations: (s.previousReaffirmations || []).map(view),
      working: s.job && { kind: s.job.kind, seconds: s.job.seconds, progress: s.job.progress },
      duty: s.duty && { id: s.duty.id, status: s.duty.status, progress: s.duty.progress, seconds: SECONDS },
      completions: s.deliveries.map(({ reportIds, ...r }) => r), reports: s.reports.filter(r => r.communicatedAt != null), message: s.message, limitations: LIMITS }) : null;
  }
  return { ROLE, POST, SECONDS, LIMITS, actor, create, normalize, meet, sign, order, instructionTerms, authorization,
    canReaffirm, reaffirmMeeting, reaffirmSign, reaffirmationCurrent, cancel, advance, observe, receive, publicView };
});
