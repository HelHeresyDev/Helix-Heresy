(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./strategic-world') : root.HelixStrategicWorld,
    typeof module === 'object' && module.exports ? require('./strategic-faiths') : root.HelixStrategicFaiths,
    typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixReligiousRecognition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (World, Faiths, Theme) {
  'use strict';
  const copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const SCOPE = 'Patron position on this identified designation claim for independent civic consideration only';
  const LIMITS = 'No church command, divine submission, army, pardon, immunity, property transfer, automatic civic recognition or renewed institutional consent. Coercion, cases and original rights remain.';
  const OATH = 'I will not attack the named original participants in this designation proceeding. I will pursue disputes about this claim through independent civic review. No conversion, worship, allegiance, research concession or killing promise is made.';
  const SCIENTIST_POSITION = Object.freeze({ stance: 'opposedToDivineAuthority',
    summary: 'The scientist acknowledges that gods exist but fundamentally opposes the gods and their claimed authority.',
    promises: 'No conversion, allegiance, assassination, research concession or undisclosed campaign ambition is promised.' });
  const registry = Theme.createRegistry([{ id: 'religion.shared.patron-petition', kind: 'religiousRecognition', compatibility: 'shared',
    contentTags: ['science', 'magic'], template: 'One authenticated local patron petition', fallback: true }]);
  const usableBranch = b => b?.publicPhysicalPresence && ['active', 'strained', 'reestablished', 'reconciled'].includes(b.operationalStatus)
    && ['authenticated', 'reconciled'].includes(b.divineRelationship) && b.currentStanding !== 'proscribed';
  function sourceFromWorld(map, cityId, charterId) {
    const government = map?.cityGovernments?.governments.find(g => g.cityId === cityId && g.charter.id === charterId);
    const foundation = map?.cityExpansionHistory?.foundationRows.find(f => f.cityId === cityId)
      || map?.civilizationOrigins?.attemptRows.find(f => f.cityId === cityId && f.outcome === 'enduringCity');
    const godId = government?.charter.designationReview?.patronRequirement?.godId || foundation?.patronGodId;
    const god = map?.strategicDivineHistory?.currentGodRows.find(g => g.id === godId);
    if (!government || !god) return null;
    const faith = Faiths.publicFaithDirectory(map)?.faiths.find(f => f.godId === godId);
    const confirmation = map?.strategicDivineHistory?.currentFaithRows.find(f => f.faithId === faith?.id);
    const tradition = map?.publicReligiousInstitutionHistoryDirectory?.traditionRows.find(t => t.id === faith?.id && t.kind === 'confirmedDivineFaith');
    const branch = map?.publicReligiousInstitutionHistoryDirectory?.currentBranchRows.find(b => b.traditionId === tradition?.id
      && b.currentCityId === cityId && b.originalCityId === cityId && usableBranch(b));
    const population = map?.strategicPlayableSettlementState?.cityRows.find(r => r.cityId === cityId);
    const identity = map?.publicReligionDirectory?.gods.find(g => g.id === godId);
    if (!government || !identity || !god || !faith || !branch || !population || population.currentPopulation < 12
      || !population.physicalJurisdictionExists || confirmation?.confirmationState !== 'activelyConfirmed') return null;
    return { cityId, charterId, branch: copy(branch), faith: copy(faith), god: copy(god), godName: identity.name,
      patronInterest: Faiths.patronInterestFor(faith, map.publicDivineHistoryDirectory),
      communicationMethods: copy(identity.communication.methods), populationSourceId: population.assetId };
  }
  const divine = g => g?.lifecycle?.lifeState === 'living' && g.lifecycle.divinityState === 'divine'
    && g.divineCore?.identityBound && g.divineCore.receivingCapacity > 0 && g.divineCore.repeatableSignature;
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  function create(source, office, theme = 'madcap') {
    if (!source?.populationSourceId || !usableBranch(source.branch) || !divine(source.god) || source.faith.godId !== source.god.id
      || source.faith.confirmation?.state !== 'activelyConfirmed' || source.branch.originalCityId !== source.cityId
      || source.branch.traditionId !== source.faith.id || source.branch.currentCityId !== source.cityId
      || source.cityId !== office?.cityId || !office.clerk?.id || !source.communicationMethods?.length) return null;
    const selected = Theme.selectContent(registry, { kind: 'religiousRecognition', worldTheme: theme, seed: source.branch.id, required: true });
    if (!selected.ok) return null;
    const work = ({ fragile: 600, strained: 900, functional: 1200, strong: 1500, exceptional: 1800 })[source.branch.capacityBand];
    if (!work) return null;
    const actor = { id: `${source.branch.id}:representative`, name: `${source.branch.publicName} representative`,
      role: 'Existing faithful religious petition representative', actorKind: 'civicOfficeholder', institutionId: source.branch.id,
      locationId: office.id, roomId: 'supportedSurveyGround', mapCell: { x: 19, y: 11, z: 6 },
      status: 'alive', health: 100, maxHealth: 100, fatigue: 0, workSeconds: work, assignment: null,
      facilitationPolicy: World.stableHash(source.branch.id).endsWith('0') ? 'declinePoliticalPetitions' : 'considerScopedPetition' };
    return { id: `${source.branch.id}:patron-petition`, definitionId: selected.definitionId, sourceTheme: selected.sourceTheme,
      source: copy(source), officeId: office.id, clerkId: office.clerk.id, actor,
      allocation: { populationSourceId: source.populationSourceId, branchId: source.branch.id, people: 1 },
      god: copy(source.god), attentionSeconds: Math.min(900, source.god.divineCore.receivingCapacity),
      channelAvailableAt: 0, phase: 'unheard', facilitation: null, terms: null, request: null, reply: null,
      submissions: [], previous: [], covenants: [], job: null, history: [], nextNumber: 1, message: '' };
  }
  const normalize = s => s?.source?.branch?.id && s.actor?.id && Array.isArray(s.previous) && Array.isArray(s.submissions)
    && Array.isArray(s.history) && (s.covenants == null || Array.isArray(s.covenants))
    ? { ...copy(s), covenants: copy(s.covenants || []) } : null;
  function note(s, at, kind, message) { s.message = message; s.history.push({ at, kind, message }); s.history = s.history.slice(-40); }
  function bound(s, office, c) {
    return Boolean(s && office?.active && office.id === s.officeId && office.cityId === s.source.cityId && office.clerk.id === s.clerkId
      && s.actor.id === `${s.source.branch.id}:representative` && s.actor.institutionId === s.source.branch.id
      && s.actor.locationId === office.id && c.sourceCurrent && c.charterCurrent && c.alive && c.claim?.id
      && c.claim.origin === 'coerced' && c.claim.recognition === 'disputedSuccessorClaim'
      && c.claim.cityId === s.source.cityId && c.claim.charterId === s.source.charterId
      && c.claim.bodyEpoch === c.bodyEpoch && c.claim.recorderId === s.clerkId && c.claim.recorderInstitutionId === office.institutionId
      && c.claim.witnesses?.includes(s.clerkId));
  }
  function facts(s, c) {
    return { claim: copy(c.claim), rule: copy(c.rule), conduct: copy(c.conduct || []), godId: s.god.id,
      faithId: s.source.faith.id, doctrine: copy(s.source.faith), scope: SCOPE, bodyEpoch: c.bodyEpoch,
      scientistPosition: copy(SCIENTIST_POSITION), patronInterest: copy(s.source.patronInterest),
      covenantPeople: copy(c.covenantPeople || []) };
  }
  function local(s, office, c, own = false) {
    const id = own ? s.job?.id : null;
    return bound(s, office, c) && c.local && c.cityId === s.source.cityId && c.atCounter && c.visitPermission
      && c.capable && c.clerkPresent && c.representativePresent && c.lineOfSight && !c.busy && !c.activeViolence
      && c.branchAvailable && office.channelPowered && office.maintenanceReady !== false && able(s.actor) && able(office.clerk)
      && (!office.assignment || office.assignment === id) && (!office.clerk.assignment || office.clerk.assignment === id)
      && (!s.actor.assignment || s.actor.assignment === id);
  }
  function begin(s, office, c, at, kind, seconds, terms = null) {
    if (!s || s.job || !local(s, office, c) || office.power < 1 || office.workSeconds < seconds
      || s.actor.workSeconds < seconds || at < (office.availableAt || 0)) return false;
    const id = `${s.id}:job:${s.nextNumber++}`;
    s.job = { id, kind, seconds, progress: 0, lastAt: at, wasReady: true, facts: facts(s, c), terms: copy(terms) };
    office.power--; office.assignment = office.clerk.assignment = s.actor.assignment = id;
    note(s, at, kind, 'Attend the existing faithful representative and original clerk; spent resources remain spent.'); return true;
  }
  function meet(s, office, c, at) {
    if (!s || [s.facilitation, ...s.previous.map(p => p.facilitation)].some(r => r && same(r.facts, facts(s, c)))) return false;
    if (!begin(s, office, c, at, 'meeting', 60)) return false;
    if (s.facilitation) s.previous.push(copy({ facilitation: s.facilitation, terms: s.terms, request: s.request, reply: s.reply }));
    s.facilitation = s.terms = s.request = s.reply = null; return true;
  }
  function petition(s, office, expected, c, at) {
    const cost = Math.max(1, s?.god.expenditures.communication || 1);
    if (!s?.terms || s.reply || s.request && !s.request.interrupted || !same(expected, s.terms) || at >= s.terms.expiresAt
      || !same(s.facilitation.facts, facts(s, c)) || !divine(s.god) || !c.channelAvailable
      || s.attentionSeconds < 180 || s.god.power.reserve < cost || at < s.channelAvailableAt) return false;
    if (!begin(s, office, c, at, 'communication', 180, expected)) return false;
    // A single finite communication allocation is spent even if attendance is later interrupted.
    s.god.power.reserve -= cost; s.attentionSeconds -= 180; s.channelAvailableAt = at + 180;
    s.request = { id: `${s.id}:request:${s.nextNumber++}`, at, facts: facts(s, c), method: s.terms.method };
    return true;
  }
  // Retain the actual historical interpretation of pre-disclosure signed replies.
  // Newly started work always uses facts() above and cannot enter this branch.
  function legacyDecision(f) {
    const civic = f.doctrine.civicTeaching?.position;
    if (!['cooperationWithoutDivineSovereignty', 'conditionalMoralSupport', 'strictSeparationFromChurch', 'authorityBoundByPublishedOath'].includes(civic))
      return { outcome: 'unresolved', reason: 'No supported explicit civic teaching decides this petition.' };
    if (civic === 'strictSeparationFromChurch') return { outcome: 'refused', reason: 'The confirmed doctrine separates religious authority from civic appointment; the god declines this authorization.' };
    if (f.conduct.some(r => /attack/i.test(r.kind) && r.at >= f.claim.at))
      return { outcome: 'refused', reason: 'The supplied witnessed renewed violence conflicts with the doctrine’s required proportional methods. This is not a criminal judgment.' };
    if (civic === 'authorityBoundByPublishedOath') return { outcome: 'conditional', reason: 'The god requires a published civic oath. This slice cannot verify or enforce that oath; the condition remains unmet.' };
    if (civic === 'conditionalMoralSupport' && f.claim.origin === 'coerced')
      return { outcome: 'conditional', reason: 'Conditional moral support requires a supported remedy for coercion. No remedy or blanket forgiveness is invented; authorization remains unfulfilled.' };
    return { outcome: 'approved', reason: 'The god supports independent consideration of this disclosed claim under cooperation without church sovereignty. Other officials and the civic reviewer remain independent.' };
  }
  function decision(f) {
    if (!Object.prototype.hasOwnProperty.call(f, 'scientistPosition')) return legacyDecision(f);
    const teaching = f.doctrine.hereticTeaching, position = teaching?.position;
    const refused = reason => ({ outcome: 'refused', supportKind: 'none', reason });
    if (!same(f.scientistPosition, SCIENTIST_POSITION)) return refused('No authentic disclosure of the scientist’s opposition to divine authority supports this request.');
    if (!['mortalAutonomy', 'vengeance', 'liberation', 'nihilism'].includes(position)
      || !same(teaching, Faiths.hereticTeachingFor(position)))
      return refused('The scientist openly opposes the gods. Ordinary aid to non-worshippers, civic compliance and an oath do not imply political endorsement; no explicit exceptional teaching supports this claim.');
    const interest = f.patronInterest;
    if (['vengeance', 'liberation'].includes(position) && (!interest || interest.kind !== position || interest.godId !== f.godId
      || !interest.targetGodId || interest.targetGodId === f.godId
      || position === 'vengeance' && (interest.basis !== 'publishedDivineInjury' || !interest.eventId)
      || position === 'liberation' && (interest.basis !== 'publishedSeizedHolySite' || !interest.siteId)))
      return refused('The exceptional teaching needs a supported injury by a living rival or an actual continuing seizure. A personality label, hidden grievance or presumed oppression is insufficient.');
    const civicDecision = legacyDecision(f);
    if (civicDecision.outcome === 'conditional' && f.doctrine.civicTeaching?.position === 'authorityBoundByPublishedOath'
      && f.covenantPeople?.length) return { ...civicDecision, supportKind: 'none', motive: position,
        reason: 'This exceptional patron requires a published civic oath protecting the named original participants. Accepting, divine confirmation and filing are separate; the condition is not yet fulfilled.' };
    if (civicDecision.outcome !== 'approved') return { ...civicDecision, supportKind: 'none', motive: position };
    const reasons = {
      mortalAutonomy: 'This god explicitly permits accountable mortal government to challenge divine authority without religious allegiance.',
      vengeance: 'This god seeks the destruction of the identified living rival responsible for its published injury.',
      liberation: 'This god seeks the overthrow of the identified living rival still holding its seized holy site.',
      nihilism: 'This god seeks the pantheon’s destruction, potentially including itself, and supports this challenge to divine authority.'
    };
    return { outcome: 'approved', supportKind: 'exceptionalClaimAuthorization', motive: position,
      ...(interest ? { targetGodId: interest.targetGodId } : {}),
      reason: `${reasons[position]} Support authorizes only independent consideration of this exact disclosed civic claim. It is not approval of research or future acts, a bargain, a killing promise, or an inference about the player’s hidden ambition.` };
  }
  const seal = (s, payload) => World.stableHash(`${s.god.divineCore.repeatableSignature}:${World.stableHash(payload)}`);
  function oathOffer(s, request, at) {
    const f = request.facts, d = decision(f), people = f.covenantPeople;
    if (d.outcome !== 'conditional' || !d.motive || f.doctrine.civicTeaching?.position !== 'authorityBoundByPublishedOath'
      || !Array.isArray(people) || people.some(p => !p.id || !p.name || !p.role)
      || new Set(people.map(p => p.id)).size !== people.length
      || ![f.claim.declarantId, s.clerkId, s.actor.id].every(id => people.some(p => p.id === id))) return null;
    return { id: `${request.id}:civic-oath`, replyId: `${request.id}:reply`, offeredAt: at, expiresAt: at + 3600,
      godId: s.god.id, faithId: s.source.faith.id, branchId: s.source.branch.id, representativeId: s.actor.id,
      officeId: s.officeId, clerkId: s.clerkId, claimId: f.claim.id, cityId: s.source.cityId,
      charterId: s.source.charterId, bodyEpoch: f.bodyEpoch, scope: SCOPE, method: request.method,
      protectedPeople: copy(people), obligation: OATH, limitations: LIMITS };
  }
  function authentic(s, reply, c) {
    const request = [s?.request, ...(s?.previous || []).map(p => p.request)].find(r => r?.id === reply?.payload?.requestId);
    return Boolean(s && reply && request && divine(s.god) && c.sourceCurrent && c.charterCurrent && c.alive
      && s.god.id === s.source.god.id && s.god.divineCore.repeatableSignature === s.source.god.divineCore.repeatableSignature
      && same(request.facts.doctrine, s.source.faith)
      && reply.id === `${request.id}:reply` && !request.interrupted && reply.seal === seal(s, reply.payload) && same(reply.payload.facts, request.facts)
      && reply.payload.godId === s.god.id && reply.payload.faithId === s.source.faith.id
      && reply.payload.scope === SCOPE && reply.payload.method === request.method
      && request.facts.bodyEpoch === c.bodyEpoch && same(request.facts.claim, c.claim)
      && same(request.facts.rule, c.rule) && same(request.facts.conduct, c.conduct || [])
      && (!Object.prototype.hasOwnProperty.call(request.facts, 'scientistPosition')
        || same(request.facts.scientistPosition, SCIENTIST_POSITION) && same(request.facts.patronInterest, copy(s.source.patronInterest)))
      && (!Object.prototype.hasOwnProperty.call(request.facts, 'covenantPeople') || same(request.facts.covenantPeople, c.covenantPeople || []))
      && same(reply.payload.decision, decision(request.facts))
      && (!Object.prototype.hasOwnProperty.call(reply.payload, 'covenantOffer')
        || same(reply.payload.covenantOffer, oathOffer(s, request, reply.payload.at))));
  }
  const replyFor = (s, id) => [s?.reply, ...(s?.previous || []).map(p => p.reply)].find(r => r?.id === id);
  const covenantFor = (s, terms) => s?.covenants?.find(v => same(v.terms, terms));
  function offerCurrent(s, office, terms, c) {
    const r = replyFor(s, terms?.replyId);
    return bound(s, office, c) && Boolean(r?.payload.covenantOffer) && same(r.payload.covenantOffer, terms) && authentic(s, r, c);
  }
  function breach(v, c) {
    return v.acceptance && (c.conduct || []).find(r => r.actorId === 'scientist' && r.witnessId && r.id
      && r.cityId === v.terms.cityId && r.at >= v.acceptance.at && /attack/i.test(r.kind)
      && v.terms.protectedPeople.some(p => p.id === r.targetId));
  }
  function covenantBound(s, office, v, c) {
    const r = replyFor(s, v?.terms.replyId);
    // Later unrelated received reports do not rewrite a historical signed packet.
    return Boolean(v?.acceptance && bound(s, office, c) && r?.payload.covenantOffer
      && same(v.terms, r.payload.covenantOffer) && authentic(s, r, { ...c, conduct: r.payload.facts.conduct })
      && v.acceptance.at >= v.terms.offeredAt && v.acceptance.at < v.terms.expiresAt
      && same(v.acceptance, { id: `${v.terms.id}:acceptance`, at: v.acceptance.at, scientistId: 'scientist',
        bodyEpoch: v.terms.bodyEpoch, terms: v.terms }) && office.records?.some(row => same(row, v.acceptance)));
  }
  function confirmPayload(s, v, at) {
    const r = replyFor(s, v.terms.replyId);
    return { covenantId: v.terms.id, at, godId: s.god.id, faithId: s.source.faith.id, scope: SCOPE,
      method: v.terms.method, acceptance: copy(v.acceptance), decision: { outcome: 'approved',
        supportKind: 'covenantClaimAuthorization', motive: r.payload.decision.motive,
        reason: 'The published scoped oath is confirmed. Future use requires its continuing terms and original register filing. Independent civic review remains separate; original coercion and all cases remain.' } };
  }
  function confirmationAuthentic(s, office, v, c) {
    const r = v?.confirmation;
    return Boolean(covenantBound(s, office, v, c) && r && r.id === `${v.terms.id}:confirmation`
      && r.payload.at >= v.acceptance.at && r.payload.at < v.terms.expiresAt
      && r.seal === seal(s, r.payload) && same(r.payload, confirmPayload(s, v, r.payload.at)));
  }
  function acceptCovenant(s, office, terms, c, at) {
    return Boolean(offerCurrent(s, office, terms, c) && at < terms.expiresAt && !covenantFor(s, terms)
      && begin(s, office, c, at, 'covenantSigning', 60, terms));
  }
  function declineCovenant(s, office, terms, c, at) {
    if (!offerCurrent(s, office, terms, c) || covenantFor(s, terms) || s.job || !local(s, office, c)) return false;
    s.covenants ||= []; s.covenants.push({ terms: copy(terms), status: 'declined', declinedAt: at, acceptance: null });
    note(s, at, 'covenantDeclined', 'Declined this exact oath offer. No support, conversion or new offer was invented.'); return true;
  }
  function confirmCovenant(s, office, terms, c, at) {
    const v = covenantFor(s, terms), cost = Math.max(1, s?.god.expenditures.communication || 1);
    if (v?.status !== 'accepted' || !covenantBound(s, office, v, c) || breach(v, c) || at >= terms.expiresAt
      || !c.channelAvailable || s.attentionSeconds < 180 || s.god.power.reserve < cost || at < s.channelAvailableAt
      || !begin(s, office, c, at, 'covenantConfirmation', 180, terms)) return false;
    s.god.power.reserve -= cost; s.attentionSeconds -= 180; s.channelAvailableAt = at + 180; return true;
  }
  function fileCovenant(s, office, terms, c, at) {
    const v = covenantFor(s, terms);
    return Boolean(v?.status === 'confirmed' && confirmationAuthentic(s, office, v, c) && !breach(v, c)
      && begin(s, office, c, at, 'covenantFiling', 60, terms));
  }
  function withdrawCovenant(s, office, terms, c, at) {
    const v = covenantFor(s, terms);
    if (!v?.acceptance || !['accepted', 'confirmed', 'filed'].includes(v.status) || s.job || !local(s, office, c)) return false;
    v.status = 'withdrawn'; v.withdrawnAt = at;
    office.records ||= []; office.records.push({ id: `${terms.id}:withdrawal`, at, covenantId: terms.id, recorderId: s.clerkId });
    note(s, at, 'covenantWithdrawn', 'Personally withdrew continuing support. Earlier replies, filings and civic findings remain history.'); return true;
  }
  function suspendCovenants(s, c, at) {
    if (!s || !c.alive) return false;
    let changed = false;
    for (const v of s.covenants || []) {
      const report = breach(v, c);
      if (!report || !['accepted', 'confirmed', 'filed'].includes(v.status)) continue;
      v.status = 'suspended'; v.breach = { receivedAt: at, report: copy(report) };
      note(s, at, 'covenantSuspended', 'A received witnessed attack against a named participant suspends future covenant support. No guilt, divine punishment or historical civic finding is decided.'); changed = true;
    }
    return changed;
  }
  function submit(s, office, expected, c, at) {
    return Boolean(authentic(s, s?.reply, c) && same(expected, s.reply)
      && !s.submissions.some(r => r.replyId === s.reply.id) && begin(s, office, c, at, 'submission', 60, expected));
  }
  function release(s, office) {
    for (const a of [office, office?.clerk, s.actor]) if (a?.assignment === s.job?.id) a.assignment = null;
    s.job = null;
  }
  function cancel(s, office, at) {
    if (!s?.job) return false;
    if (s.job.kind === 'communication' && s.request) s.request.interrupted = true;
    release(s, office); note(s, at, 'interrupted', 'Unfinished petition attendance cancelled; no refund, fabricated response or changed historical record.'); return true;
  }
  function advance(s, office, c, at) {
    const changed = suspendCovenants(s, c, at);
    if (!s?.job || !c.alive) return changed;
    const j = s.job;
    if (!bound(s, office, c) || !same(j.facts, facts(s, c))
      || j.kind === 'communication' && (at >= s.terms.expiresAt || !divine(s.god))
      || j.kind === 'submission' && (!authentic(s, s.reply, c) || !same(j.terms, s.reply))
      || j.kind === 'covenantSigning' && (!offerCurrent(s, office, j.terms, c) || at >= j.terms.expiresAt)
      || j.kind === 'covenantConfirmation' && (covenantFor(s, j.terms)?.status !== 'accepted'
        || !covenantBound(s, office, covenantFor(s, j.terms), c) || at >= j.terms.expiresAt)
      || j.kind === 'covenantFiling' && (covenantFor(s, j.terms)?.status !== 'confirmed'
        || !confirmationAuthentic(s, office, covenantFor(s, j.terms), c))) return cancel(s, office, at);
    if (!local(s, office, c, true) || ['communication', 'covenantConfirmation'].includes(j.kind) && !c.channelAvailable) {
      j.lastAt = at; j.wasReady = false; return false;
    }
    const work = j.wasReady ? Math.max(0, Math.min(at - j.lastAt, j.seconds - j.progress, office.workSeconds, s.actor.workSeconds)) : 0;
    j.lastAt = at; j.wasReady = true; j.progress += work; office.workSeconds -= work; s.actor.workSeconds -= work;
    if (j.progress < j.seconds) return work > 0;
    if (j.kind === 'meeting') {
      const refused = s.actor.facilitationPolicy === 'declinePoliticalPetitions';
      s.facilitation = { at, facts: copy(j.facts), decision: refused ? 'refused' : 'offered' };
      s.terms = refused ? null : { id: `${s.id}:terms:${s.nextNumber++}`, offeredAt: at, expiresAt: at + 3600,
        branchId: s.source.branch.id, representativeId: s.actor.id, godId: s.god.id, faithId: s.source.faith.id,
        claimId: c.claim.id, cityId: s.source.cityId, charterId: s.source.charterId, bodyEpoch: c.bodyEpoch,
        scope: SCOPE, method: s.source.communicationMethods[0], evidence: copy(j.facts), limitations: LIMITS };
      s.phase = refused ? 'facilitatorRefused' : 'offered';
      note(s, at, 'facilitation', refused ? 'The original representative declines political facilitation. No divine reply occurred.' : 'Exact scoped petition offered; worship or conversion by the scientist is not required.');
    } else if (j.kind === 'communication') {
      const payload = { requestId: s.request.id, godId: s.god.id, faithId: s.source.faith.id, at,
        scope: SCOPE, method: s.request.method, facts: copy(j.facts), decision: decision(j.facts),
        covenantOffer: oathOffer(s, s.request, at) };
      s.reply = { id: `${s.request.id}:reply`, payload, seal: seal(s, payload) }; s.phase = 'answered';
      note(s, at, 'answered', payload.decision.reason);
    } else if (j.kind === 'covenantSigning') {
      const acceptance = { id: `${j.terms.id}:acceptance`, at, scientistId: 'scientist', bodyEpoch: c.bodyEpoch, terms: copy(j.terms) };
      s.covenants ||= []; s.covenants.push({ terms: copy(j.terms), status: 'accepted', acceptance, confirmation: null, filing: null });
      office.records ||= []; office.records.push(copy(acceptance));
      note(s, at, 'covenantAccepted', 'Published the exact civic oath. It binds from acceptance; divine confirmation and filing still grant no automatic recognition.');
    } else if (j.kind === 'covenantConfirmation') {
      const v = covenantFor(s, j.terms), payload = confirmPayload(s, v, at);
      v.confirmation = { id: `${v.terms.id}:confirmation`, payload, seal: seal(s, payload) }; v.status = 'confirmed';
      note(s, at, 'covenantConfirmed', payload.decision.reason);
    } else if (j.kind === 'covenantFiling') {
      const v = covenantFor(s, j.terms);
      v.filing = { id: `${v.terms.id}:filing`, at, covenantId: v.terms.id, officeId: s.officeId, recorderId: s.clerkId,
        receivedConfirmation: copy(v.confirmation) };
      v.status = 'filed'; office.records ||= []; office.records.push(copy(v.filing));
      note(s, at, 'covenantFiled', 'Original clerk filed continuing scoped patron authorization. Request independent review separately; earlier replies and findings remain unchanged.');
    } else {
      const row = { id: `${s.reply.id}:submission`, at, replyId: s.reply.id, recorderId: s.clerkId,
        officeId: s.officeId, claimId: c.claim.id, godId: s.god.id, scope: SCOPE, outcome: s.reply.payload.decision.outcome,
        receivedReply: copy(s.reply), limitations: LIMITS };
      s.submissions.push(row); office.records ||= []; office.records.push(copy(row)); s.phase = 'submitted';
      note(s, at, 'submitted', 'Original clerk entered the authenticated scoped response. The independent review must still be requested; no recognition or other assent changed.');
    }
    release(s, office); return true;
  }
  function authorizationIds(s, office, c) {
    const requirement = c.rule?.patronRequirement;
    if (!requirement || !bound(s, office, c) || requirement.godId !== s.god.id || requirement.faithId !== s.source.faith.id || requirement.scope !== SCOPE) return [];
    const covenant = (s.covenants || []).some(v => v.status === 'filed' && !breach(v, c) && confirmationAuthentic(s, office, v, c)
      && v.filing?.id === `${v.terms.id}:filing` && v.filing.covenantId === v.terms.id && v.filing.officeId === s.officeId
      && v.filing.recorderId === s.clerkId && same(v.filing.receivedConfirmation, v.confirmation)
      && office.records?.some(row => same(row, v.filing)));
    return covenant || s.submissions.some(row => row.outcome === 'approved' && row.receivedReply?.payload.decision.outcome === 'approved'
      && row.id === `${row.replyId}:submission` && row.replyId === row.receivedReply.id && row.claimId === c.claim.id
      && row.godId === s.god.id && row.scope === SCOPE && row.officeId === office.id && row.recorderId === office.clerk.id
      && office.records?.some(r => same(r, row)) && authentic(s, row.receivedReply, c)) ? [requirement.authorizationId] : [];
  }
  function publicReply(reply) {
    if (!reply) return null;
    const p = reply.payload;
    return { id: reply.id, at: p.at, godId: p.godId, faithId: p.faithId, claimId: p.facts.claim.id,
      cityId: p.facts.claim.cityId, charterId: p.facts.claim.charterId, bodyEpoch: p.facts.bodyEpoch,
      scope: p.scope, method: p.method, decision: copy(p.decision), covenantOffer: copy(p.covenantOffer), authenticated: true };
  }
  function publicView(s) {
    return s ? copy({ phase: s.phase, godName: s.source.godName, branchName: s.source.branch.publicName,
      faith: { name: s.source.faith.name, civicTeaching: s.source.faith.civicTeaching, commandments: s.source.faith.commandments,
        prohibitions: s.source.faith.prohibitions, hereticTeaching: s.source.faith.hereticTeaching || Faiths.hereticTeachingFor() },
      scientistPosition: copy(SCIENTIST_POSITION), patronInterest: copy(s.source.patronInterest), representativeId: s.actor.id,
      facilitation: s.facilitation && { at: s.facilitation.at, decision: s.facilitation.decision },
      terms: s.terms && Object.fromEntries(Object.entries(s.terms).filter(([key]) => key !== 'evidence')),
      reply: publicReply(s.reply), submissions: s.submissions.map(r => ({ id: r.id, at: r.at, replyId: r.replyId, outcome: r.outcome })),
      covenants: (s.covenants || []).map(v => ({ terms: copy(v.terms), status: v.status, acceptedAt: v.acceptance?.at ?? null,
        confirmedAt: v.confirmation?.payload.at ?? null, filedAt: v.filing?.at ?? null, declinedAt: v.declinedAt ?? null,
        withdrawnAt: v.withdrawnAt ?? null, breach: copy(v.breach) })),
      working: s.job && { kind: s.job.kind, seconds: s.job.seconds, progress: s.job.progress }, message: s.message, limitations: LIMITS }) : null;
  }
  return { SCOPE, LIMITS, SCIENTIST_POSITION, OATH, sourceFromWorld, create, normalize, meet, petition, submit, cancel, advance,
    authentic, authorizationIds, acceptCovenant, declineCovenant, confirmCovenant, fileCovenant, withdrawCovenant, publicView };
});
