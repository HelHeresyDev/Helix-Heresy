(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-trial') : root.HelixCargoTrial);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoCommitment = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Trial) {
  'use strict';
  const MONTH = 30 * 86400, copy = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const free = (job, id) => !job || job === id;
  function authority(g) {
    const a = g.correctionsAuthority;
    return a?.active && a.role === 'longTermCorrectionsAuthority' && a.cityId === g.cityId
      && a.institutionId && a.jailInstitutionId && a.institutionId !== a.jailInstitutionId;
  }
  function provision(g, at) {
    if (g.cargoCorrections || !Trial.local(g) || !authority(g)) return;
    const a = g.correctionsAuthority, id = `${g.id}:corrections`, prison = `${id}:prison`;
    const actor = role => ({ id: `${id}:${role}`, name: `${a.name || a.institutionId} ${role}`, role,
      institutionId: a.institutionId, status: 'alive', health: 100, locationId: prison, workSeconds: 28800, reservedBy: null });
    const vacancies = ['fragile', 'strained'].includes(a.capacityBand) ? 0 : 2;
    g.cargoCorrections = { id, cityId: g.cityId, institutionId: a.institutionId, active: true, channelPowered: true,
      establishedAt: at, power: 12, creditClaims: [], dispatcher: actor('dispatcher'), intake: { ...actor('intake'), acceptsPlacements: true },
      facility: { id: prison, kind: 'prison', cityId: g.cityId, institutionId: a.institutionId, status: 'open', capacity: 96,
        beds: Array.from({ length: 96 }, (_, n) => ({ id: `${prison}:bed:${n}`, reservedBy: null, condition: 100, failOpen: true, locked: false,
          occupiedBy: n < 96 - vacancies ? `${prison}:registered-occupant:${n}` : null })) },
      vehicle: { id: `${id}:van`, institutionId: a.institutionId, locationId: prison, condition: 100, seats: 4, fuelKm: 40, reservedBy: null },
      crew: [actor('driver'), actor('escort')],
      care: { ...actor('care'), workSeconds: 72000, rationSeconds: 120 * 86400 },
      suppressors: Array.from({ length: vacancies }, (_, n) => ({ id: `${id}:bracelet:${n}`, condition: 100,
        failOpen: true, locationId: prison, reservedBy: null, wearerId: null, active: false })),
      route: { id: `${id}:court-road`, cityId: g.cityId, originId: prison, destinationId: g.cargoCourt.id, open: true, condition: 100, distanceKm: 4, speedKmPerHour: 20 } };
  }
  function basis(g, d) {
    const v = d.judgmentReview, x = v?.decision, sentence = d.sentencing?.sentence, judgment = d.trial?.judgment;
    const disclosure = v?.disclosures?.find(r => r.id === x?.disclosureId), input = disclosure?.input, proposed = disclosure?.proposed;
    if (!Trial.local(g) || v?.phase !== 'decided' || v.stayActive !== false || v.disposition !== 'finalAwaitingSeparateEnforcement'
      || v.handoff || !['affirmed', 'sentenceCorrected'].includes(x?.outcome) || x.sanction?.kind !== 'finitePrison'
      || !input || !proposed || !same(input.sentence, sentence) || !same(input.judgment, judgment)
      || judgment?.outcome !== 'convicted' || sentence.trialId !== d.trial.id || sentence.actorId !== d.actorId || judgment.actorId !== d.actorId
      || x.trialId !== d.trial.id || x.sentenceId !== sentence.id || x.personId !== sentence.personId || x.personId !== judgment.personId
      || x.cityId !== g.cityId || sentence.cityId !== g.cityId || judgment.cityId !== g.cityId || x.institutionId !== g.cargoCourt.institutionId
      || x.outcome !== proposed.outcome || !same(x.sanction, proposed.sanction) || x.lawId !== proposed.lawId || x.sourceLawId !== proposed.sourceLawId) return null;
    const p = input.trial?.proposal, law = p?.disclosure?.evidence?.law, range = law?.sentencing?.finitePrisonRangeMonths, months = x.sanction.months;
    if (!Number.isInteger(months) || months < 1 || months > 120 || !law?.sentencing?.ordinarySanctions?.includes('finitePrison')
      || !range || !Number.isInteger(range.minimum) || !Number.isInteger(range.maximum) || range.minimum < 1 || range.maximum > 120
      || months < range.minimum || months > range.maximum || law.id !== x.lawId || law.sourceLawId !== x.sourceLawId
      || law.cityId !== g.cityId || !law.active || !(law.publishedAt <= p.count.eventAt) || !(law.effectiveAt <= p.count.eventAt)
      || !Number.isFinite(x.at) || x.at < sentence.at || !p.subjectDocument) return null;
    const address = p.disclosure.assessment.recipientFindings?.flatMap(f => (f.events || []).filter(e =>
      f.comparisons?.some(c => c.recordId === e.id && c.result === 'matchesCarrierCopy'))).find(e =>
      e.kind === 'chemicalDisclosure' && e.observationId === d.actorId)?.serviceLocation;
    if (address?.cityId !== g.cityId) return null;
    return copy({ reviewDecisionId: x.id, reviewAt: x.at, sentenceId: sentence.id, trialId: x.trialId,
      personId: x.personId, cityId: x.cityId, lawId: x.lawId, sourceLawId: x.sourceLawId, months,
      document: p.subjectDocument, address });
  }
  function credit(g, d, input, at) {
    const j = d.custodyCase;
    if (!j || j.arrestedAt == null) return { seconds: 0, receipts: [] };
    const matches = (g.custodyOffice?.custodyReceipts || []).filter(r => r.caseId === j.id);
    const r = matches[0];
    if (j.custodyActive || matches.length !== 1 || !r || r.id !== `${j.id}:detention-receipt` || r.personId !== input.personId || r.docketId !== d.id
      || r.cityId !== g.cityId || r.institutionId !== g.custodyOffice.institutionId || r.orderId !== j.order?.id
      || g.custodyOffice.cityId !== g.cityId || j.order.cityId !== g.cityId || j.order.institutionId !== r.institutionId
      || j.personId !== input.personId || j.order.executedAt !== j.arrestedAt || !same(r.document, input.document)
      || !Number.isFinite(r.startedAt) || !Number.isFinite(r.endedAt) || r.startedAt !== j.arrestedAt || r.endedAt !== j.releasedAt
      || r.startedAt < j.order.issuedAt || r.endedAt < r.startedAt || r.endedAt > at || r.endedAt - r.startedAt > 21600) return null;
    return { seconds: r.endedAt - r.startedAt, receipts: [copy(r)] };
  }
  function tell(b, p, s, at, text) {
    if (s.events.at(-1)?.text === text) return;
    s.events.push({ at, text });
    if (p?.courtPreferences?.shareNotices && b?.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.commitmentNotices ||= []).push({ at, commitmentId: s.id, text,
        scope: 'Receiver-consented planning notice only; no NPC controls, arrest or detention authority.' });
  }
  function freeWork(g, s, at) {
    const c = g.cargoCourt, r = g.cargoCorrections;
    if (c.trialJob === s.id) { c.trialJob = null; c.lastAt = at; c.wasReady = false; }
    if (r?.job === s.id) r.job = null;
    s.wasReady = false;
  }
  function releasePlan(g, s, at, reason) {
    const p = s.plans.at(-1), r = g.cargoCorrections;
    if (!p || p.status !== 'reserved') return;
    for (const asset of [...(r?.facility?.beds || []), r?.vehicle, ...(r?.crew || [])])
      if (asset?.reservedBy === p.id) { asset.reservedBy = null; if (asset === r.vehicle) asset.reservedFuelKm = 0; }
    p.status = 'released'; p.releasedAt = at; p.releaseReason = reason;
  }
  function resourceReason(g, b, s, plan = null) {
    const r = g.cargoCorrections, a = g.correctionsAuthority, route = b?.buyerService?.premises?.route;
    if (!authority(g) || !r?.active || r.cityId !== g.cityId || r.institutionId !== a.institutionId || !r.channelPowered || r.power < 1)
      return 'Current local corrections authority or channel unavailable.';
    if (r.facility?.kind !== 'prison' || r.facility.cityId !== g.cityId || r.facility.institutionId !== r.institutionId || r.facility.status !== 'open')
      return 'A proper receiving prison is unavailable; temporary jail is not a substitute.';
    if (!able(r.dispatcher) || !able(r.intake) || r.dispatcher.role !== 'dispatcher' || r.intake.role !== 'intake' || r.intake.acceptsPlacements !== true || r.dispatcher.id === r.intake.id
      || [r.dispatcher, r.intake].some(p => p.institutionId !== r.institutionId || p.locationId !== r.facility.id || p.assignment)
      || r.intake.job || !free(r.job, s.id)) return 'Actual corrections dispatcher or intake staff unavailable.';
    if (!r.facility.beds.some(bed => !bed.occupiedBy && (plan ? bed.id === plan.bedId && bed.reservedBy === plan.id : !bed.reservedBy))) return 'No actual vacant prison bed.';
    if (!route?.open || !(route.distanceKm > 0) || !Number.isFinite(route.distanceKm) || !b.buyerService.premises.publicAccess
      || !r.route?.open || r.route.cityId !== g.cityId || r.route.originId !== r.facility.id || r.route.destinationId !== g.cargoCourt.id
      || r.route.condition < 50 || !(r.route.distanceKm > 0) || !Number.isFinite(r.route.distanceKm)
      || !(r.route.speedKmPerHour > 0) || !Number.isFinite(r.route.speedKmPerHour)) return 'Local pickup and correctional route unavailable.';
    const distance = route.distanceKm + r.route.distanceKm, v = r.vehicle;
    if (!v || v.institutionId !== r.institutionId || v.locationId !== r.facility.id || v.condition < 50 || v.seats < 3
      || v.fuelKm < distance * 2 || !free(v.reservedBy, plan?.id)) return 'Actual vehicle, seats or round-trip fuel unavailable.';
    if (r.crew?.length !== 2 || new Set([...r.crew.map(p => p.id), r.dispatcher.id, r.intake.id, s.basis.personId, g.cargoCourt.judge.id]).size !== 6
      || !r.crew.some(p => p.role === 'driver') || !r.crew.some(p => p.role === 'escort')
      || r.crew.some(p => !able(p) || p.assignment || p.institutionId !== r.institutionId || p.locationId !== r.facility.id
        || !free(p.reservedBy, plan?.id) || p.workSeconds < distance * 7200 / r.route.speedKmPerHour)) return 'Actual local driver or escort unavailable.';
    if (plan && (plan.facilityId !== r.facility.id || plan.vehicleId !== v.id || v.reservedBy !== plan.id || v.reservedFuelKm !== plan.fuelKm
      || plan.fuelKm !== distance * 2 || !same(plan.route, r.route) || !same(plan.pickupRoute, route)
      || r.crew.some(p => p.reservedBy !== plan.id || !plan.crewIds.includes(p.id))
      || plan.dispatcherId !== r.dispatcher.id || plan.intakeId !== r.intake.id)) return 'Exact reserved assets or route changed.';
    return '';
  }
  function advance(state, g, at) {
    if (!g.cargoCourt || !Number.isFinite(at)) return;
    const c = g.cargoCourt;
    for (const d of c.dockets) {
      let s = d.commitment, input = basis(g, d);
      // Physical execution owns its assets and clocks until everyone has returned.
      if (s?.phase === 'complete' || (s?.execution && s.execution.phase !== 'closed')) continue;
      if (at < (s?.lastAt ?? 0)) continue;
      if (!s && (!input || at < input.reviewAt)) continue;
      provision(g, at);
      const r = g.cargoCorrections;
      if (!s) s = d.commitment = { id: `${input.reviewDecisionId}:commitment`, basis: input, phase: 'review', lastAt: at,
        progress: 0, wasReady: false, reviews: [], notices: [], responses: [], plans: [], events: [],
        interim: 'freePendingArrangements', custodyAuthorized: false, executionAuthorized: false };
      const dt = Math.max(0, at - s.lastAt); s.lastAt = at;
      const b = state.buyers.find(b => b.cityId === g.cityId && b.buyerService?.premises?.id === s.basis.address.siteId);
      const bs = b?.buyerService, p = bs?.representatives.find(p => p.id === s.basis.personId);
      const pause = reason => { freeWork(g, s, at); releasePlan(g, s, at, reason); s.status = 'paused';
        if (s.phase === 'reserved') s.phase = 'postponed';
        tell(b, p, s, at, `${reason} Planning grants no custody; no adverse finding or free-waiting sentence credit.`); };
      const custody = input && credit(g, d, input, at);
      if (!input || !same(input, s.basis) || !custody || !authority(g) || !r?.active || r.institutionId !== g.correctionsAuthority.institutionId
        || !p || p.custody?.active) { pause('Final local sentence, distinct corrections authority or documented closed custody record unavailable.'); continue; }
      if (r.creditClaims.some(claim => custody.receipts.some(receipt => receipt.id === claim.sourceId) && claim.commitmentId !== s.id)) {
        pause('The same detention interval is already allocated to another sentence.'); continue;
      }
      if (s.reviews.length && (!same(s.reviews.at(-1).custody, custody) || s.reviews.at(-1).correctionsId !== r.institutionId)) {
        pause('Reviewed credit or receiving authority changed; a fresh legal proceeding is required.'); continue;
      }
      s.status = 'active';
      if (s.phase === 'review') {
        const ready = c.channelPowered && c.power >= 1 && able(c.judge) && c.judge.locationId === c.id && c.judge.id !== p.id
          && !c.job && !c.appearanceJob && !c.custodyJob && free(c.trialJob, s.id) && c.workSeconds > 0;
        if (!ready) { pause('Local judge, powered records or finite judicial work unavailable.'); continue; }
        const key = JSON.stringify({ custody, correctionsId: r.institutionId, judgeId: c.judge.id });
        if (s.reviewKey !== key) { s.reviewKey = key; s.progress = 0; s.wasReady = false; }
        c.trialJob = s.id;
        const work = s.wasReady ? Math.min(dt, 900 - s.progress, c.workSeconds) : 0;
        s.wasReady = true; s.progress += work; c.workSeconds -= work;
        if (s.progress < 900) continue;
        const term = input.months * MONTH, recognized = Math.min(term, custody.seconds);
        s.reviews.push({ id: `${s.id}:review`, at, judgeId: c.judge.id, correctionsId: r.institutionId,
          reviewDecisionId: input.reviewDecisionId, custody: copy(custody),
          scope: 'Conditional voluntary commitment planning only. No arrest, admission, suppression or detention authorized.' });
        s.ledger = { termSeconds: term, recognizedCustodySeconds: recognized, remainingSeconds: term - recognized,
          sourceIds: custody.receipts.map(x => x.id), creditAppliedAt: null, transportServedSeconds: 0, prisonServedSeconds: 0 };
        for (const receipt of custody.receipts) if (!r.creditClaims.some(x => x.sourceId === receipt.id))
          r.creditClaims.push({ sourceId: receipt.id, commitmentId: s.id, seconds: receipt.endedAt - receipt.startedAt, status: 'reserved' });
        c.power--; freeWork(g, s, at); s.progress = 0; s.phase = 'notice'; continue;
      }
      const reachable = bs.channelPowered && bs.credentialActive && !bs.assignment && !p.assignment && (p.availableAt || 0) <= at
        && p.locationId === g.cityId && bs.locationId === g.cityId && Trial.identified(state, p, input.document, at);
      const prefs = p.commitmentPreferences;
      if (['declined', 'postponed'].includes(s.phase)) {
        const last = Math.max(s.responses.at(-1)?.at || 0, s.plans.at(-1)?.releasedAt || 0, s.execution?.closedAt || 0);
        const changedResponse = s.phase === 'declined' && s.responses.at(-1)?.response !== 'cooperate' && prefs?.response === 'cooperate';
        const requested = Number.isFinite(prefs?.renewalRequestedAt) && prefs.renewalRequestedAt > last
          && prefs.renewalRequestedAt <= at && prefs.renewalRequestedAt > (s.renewalConsumedAt || 0);
        if (!reachable || (!changedResponse && !requested)) continue;
        s.renewalConsumedAt = at; s.phase = 'notice'; s.progress = 0; s.wasReady = false;
        tell(b, p, s, at, 'Fresh voluntary arrangements requested. Previous reservations and replies do not authorize a new pickup.');
      }
      if (s.phase === 'notice') {
        if (!reachable || prefs?.acceptNotice !== true || !r.channelPowered || r.power < 1) { pause('Fresh authenticated defendant notice unavailable.'); continue; }
        s.notices.push({ id: `${s.id}:notice:${s.notices.length + 1}`, at, personId: p.id, reviewId: s.reviews.at(-1).id, remainingSeconds: s.ledger.remainingSeconds,
          reportingLocationId: input.address.siteId, reportingDueAt: null,
          terms: 'Voluntary reporting arrangement at the verified receiving desk. Wait freely until an actual transfer is arranged; no reporting deadline while execution is unavailable.' });
        r.power--; s.phase = 'response';
        tell(b, p, s, at, `Commitment notice: ${input.months} months finite prison, ${s.ledger.recognizedCustodySeconds} seconds documented custody credit. Proposed reporting point: ${input.address.siteId}. Remain free until separately authorized physical surrender.`); continue;
      }
      if (s.phase === 'response') {
        if (!reachable || !['cooperate', 'decline', 'defer'].includes(prefs?.response)) { pause('Voluntary response unavailable; silence is not evasion.'); continue; }
        s.responses.push({ at, personId: p.id, noticeId: s.notices.at(-1).id, response: prefs.response });
        s.phase = prefs.response === 'cooperate' ? 'placement' : 'declined';
        tell(b, p, s, at, prefs.response === 'cooperate' ? 'Defendant accepted voluntary reporting arrangements, not immediate custody.' : 'Defendant declined or deferred reporting. No warrant, new charge or forced collection follows.'); continue;
      }
      if (['declined', 'postponed'].includes(s.phase)) continue;
      if (!reachable || prefs?.response !== 'cooperate') { pause('Voluntary participation or current defendant identity unavailable.'); continue; }
      const plan = s.phase === 'reserved' ? s.plans.at(-1) : null;
      if (plan && at >= plan.expiresAt) { pause('Placement reservation expired; appointment postponed without a failure-to-appear finding.'); continue; }
      const reason = resourceReason(g, b, s, plan);
      if (reason) { pause(reason); continue; }
      if (s.phase === 'reserved') continue;
      if (s.phase !== 'placement') continue;
      const placementKey = JSON.stringify({ dispatcher: r.dispatcher.id, intake: r.intake.id, facility: r.facility.id,
        vehicle: r.vehicle.id, crew: r.crew.map(x => x.id), route: r.route, pickupRoute: bs.premises.route });
      if (s.placementKey !== placementKey) { s.placementKey = placementKey; s.progress = 0; s.wasReady = false; }
      if (r.dispatcher.workSeconds <= 0 || r.intake.workSeconds <= 0) { pause('Finite placement and intake work unavailable.'); continue; }
      r.job = s.id;
      const work = s.wasReady ? Math.min(dt, 300 - s.progress, r.dispatcher.workSeconds, r.intake.workSeconds) : 0;
      s.wasReady = true; s.progress += work; r.dispatcher.workSeconds -= work; r.intake.workSeconds -= work;
      if (s.progress < 300) continue;
      const bed = r.facility.beds.find(x => !x.occupiedBy && !x.reservedBy), id = `${s.id}:plan:${s.plans.length + 1}`;
      const accepted = { id, at, expiresAt: at + 3600, status: 'reserved', personId: p.id, reviewId: s.reviews.at(-1).id,
        institutionId: r.institutionId, facilityId: r.facility.id, bedId: bed.id, vehicleId: r.vehicle.id, crewIds: r.crew.map(x => x.id),
        dispatcherId: r.dispatcher.id, intakeId: r.intake.id, route: copy(r.route), pickupRoute: copy(bs.premises.route),
        reportingLocationId: input.address.siteId, fuelKm: (r.route.distanceKm + bs.premises.route.distanceKm) * 2,
        custodyAuthorized: false, executionAuthorized: false, transportCreditBegins: 'Actual physical custody only, in the separate execution procedure.' };
      bed.reservedBy = id; r.vehicle.reservedBy = id; r.vehicle.reservedFuelKm = accepted.fuelKm;
      r.crew.forEach(x => { x.reservedBy = id; }); s.plans.push(accepted); r.power--; freeWork(g, s, at); s.phase = 'reserved';
      tell(b, p, s, at, `Placement accepted at ${r.facility.id}: one bed, vehicle and named crew reserved for one hour. Defendant remains free; no travel, fuel use, admission or sentence service has begun.`);
    }
  }
  return { advance, provision, basis, credit, resourceReason };
});
