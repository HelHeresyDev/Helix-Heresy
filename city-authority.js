(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityAuthority = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400, ROLES = ['centralAdministration', 'civicReview', 'civilWatch', 'publicWorksAndProvisioning', 'militaryDefenseCommand'];
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const id = x => typeof x === 'string' && x.length > 0 && x.length <= 1000;
  const time = x => Number.isFinite(x) && x >= 0;
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const able = a => a?.status === 'alive' && a.health >= 50 && !a.incapacitated;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hash = s => [...s].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 0);
  const SCOPE = 'City-specific political submission with retained local government, not succession, trade or a technical compact. Original controllers must separately release their claim on this city. No army, immunity, divine endorsement, remote city telemetry or domination award.';
  function sourceFromWorld(map, cityId) {
    const g = map?.cityGovernments?.governments?.find(g => g.cityId === cityId), p = map?.cityPolities?.polities?.find(p => p.cityId === cityId);
    const row = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === cityId);
    const political = map?.strategicPoliticalHistory, control = political?.currentControlRows?.find(r => r.cityId === cityId);
    if (!g?.charter?.id || !p?.authority || !row?.assetId || !control || !['individual', 'collective'].includes(p.authority.kind)
      || !id(g.charter.decisionRule) || !validLaw(g.charter.politicalAgreements) || !id(control.recognizedAuthorityId)) return null;
    const institutions = ROLES.map(role => {
      const institution = g.institutions.find(i => i.id === g.roleAssignments[role]);
      const current = map.strategicCivicHistory?.currentInstitutionRows?.find(i => i.institutionId === institution?.id);
      return institution && current ? { role, id: institution.id, controllerId: current.actualControllerPolityId,
        status: current.operationalStatus, control: current.actualControlStatus } : null;
    });
    if (institutions.some(i => !i)) return null;
    const recognized = control.recognizedAuthorityId === p.authority.id ? p.authority
      : political.actorRows?.find(a => a.id === control.recognizedAuthorityId);
    if (!recognized || !['individual', 'collective'].includes(recognized.kind)) return null;
    const displaced = control.controlStatus === 'displacedClaim';
    const cause = displaced && political.eventRows?.find(e => e.kind === 'claimantDisplacement' && e.location?.cityId === cityId
      && e.stateDelta?.physicalJurisdictionExists === false && e.discoverableHooks?.includes('displacedClaimantBroadcast'));
    const retained = map.strategicPlayableSettlementState?.claimantContactRows?.find(r => r.cityId === cityId) || control.claimantChannel;
    // A historical discovery hook is not a present address, transmitter or
    // available operator. Missing current custody stays unresolved.
    if (displaced && (!cause || row.currentPopulation !== 0 || row.physicalJurisdictionExists || row.physicalCondition !== 'ruined'
      || !id(retained?.id) || retained.authorityId !== recognized.id || retained.causeId !== cause.id
      || retained.institutionId !== g.roleAssignments.centralAdministration || !id(retained.operatorId)
      || !time(retained.workSeconds) || retained.workSeconds <= 0 || !time(retained.powerUnits) || retained.powerUnits <= 0)) return null;
    const controllers = [...new Set([control.effectiveControllerPolityId, control.tributeToPolityId,
      control.covertPuppetSponsorPolityId, ...institutions.map(i => i.controllerId)].filter(k => k && k !== p.id))];
    const parties = [{ authorityId: recognized.id, cityId, charterId: g.charter.id, kind: recognized.kind, name: recognized.name,
      decisionRule: g.charter.decisionRule, population: displaced ? retained.admittedPopulation ?? row.populationLedger?.departures : row.currentPopulation,
      channel: displaced ? retained.id : null, channelWorkSeconds: displaced ? retained.workSeconds : null,
      channelPower: displaced ? retained.powerUnits : null, channelOperatorId: displaced ? retained.operatorId : null,
      hostCityId: displaced ? retained.hostCityId || null : null, powerSourceId: displaced ? retained.powerSourceId || null : null,
      decisionMandateId: g.charter.politicalAgreements.id }];
    for (const polityId of controllers) {
      const owner = map.cityPolities.polities.find(p => p.id === polityId), government = map.cityGovernments.governments.find(g => g.cityId === owner?.cityId);
      const population = map.strategicPlayableSettlementState.cityRows.find(r => r.cityId === owner?.cityId);
      const ownerControl = political.currentControlRows.find(r => r.cityId === owner?.cityId);
      const authority = ownerControl?.recognizedAuthorityId === owner?.authority.id ? owner.authority
        : political.actorRows?.find(a => a.id === ownerControl?.recognizedAuthorityId);
      const channel = map.strategicPlayableSettlementState.claimantContactRows?.find(r => r.cityId === owner?.cityId && r.authorityId === authority?.id);
      if (!owner || !government || !validLaw(government.charter.politicalAgreements) || !authority
        || !population?.physicalJurisdictionExists && !channel) return null;
      parties.push({ authorityId: authority.id, cityId: owner.cityId, charterId: government.charter.id,
        kind: authority.kind, name: authority.name, decisionRule: government.charter.decisionRule,
        population: channel ? channel.admittedPopulation : population.currentPopulation,
        channel: channel?.id || null, channelWorkSeconds: channel?.workSeconds ?? null, channelPower: channel?.powerUnits ?? null,
        channelOperatorId: channel?.operatorId || null, hostCityId: channel?.hostCityId || null, powerSourceId: channel?.powerSourceId || null,
        decisionMandateId: government.charter.politicalAgreements.id });
    }
    const source = { cityId, cityName: row.name || cityId, charterId: g.charter.id, populationSourceId: row.assetId,
      population: row.currentPopulation, controlStatus: control.controlStatus, polityId: p.id,
      physicalJurisdictionExists: row.physicalJurisdictionExists, destructionCauseId: cause?.id || null,
      institutions, parties, sourceId: `${row.assetId}:political-authority`,
      politicalSourceId: `${cityId}:playable-political-control` };
    return validSource(source) ? source : null;
  }
  function validLaw(law) {
    return Boolean(id(law?.id) && law.authority === 'currentRecognizedSovereign' && law.individualRule === 'recordedPersonalDirective'
      && law.collectiveRule === 'unanimousThreeDelegateResolution' && law.collectiveSeats === 3);
  }
  function validSource(s) {
    return Boolean(s && ['cityId', 'charterId', 'populationSourceId', 'sourceId', 'politicalSourceId'].every(k => id(s[k]))
      && Number.isSafeInteger(s.population) && s.population >= 0
      && ['sovereign', 'tributary', 'puppet', 'occupied', 'displacedClaim'].includes(s.controlStatus)
      && Array.isArray(s.parties) && s.parties.length && new Set(s.parties.map(p => p.authorityId)).size === s.parties.length
      && s.parties.every(p => ['authorityId', 'cityId', 'charterId', 'decisionRule', 'decisionMandateId'].every(k => id(p[k]))
        && ['individual', 'collective'].includes(p.kind) && Number.isSafeInteger(p.population) && p.population >= (p.kind === 'collective' ? 3 : 1) + (p.channel ? 1 : 0)
        && (!p.channel || id(p.channel) && id(p.channelOperatorId) && time(p.channelWorkSeconds) && p.channelWorkSeconds > 0 && time(p.channelPower) && p.channelPower > 0))
      && s.parties[0].cityId === s.cityId && s.parties[0].charterId === s.charterId
      && Array.isArray(s.institutions) && ROLES.every(role => s.institutions.some(i => i.role === role && id(i.id)))
      && (s.controlStatus !== 'displacedClaim' || s.population === 0 && !s.physicalJurisdictionExists && id(s.destructionCauseId)));
  }
  function create(binding) { return id(binding?.worldId) && id(binding.runId) ? { ...binding, entries: [], authorities: [], job: null, serial: 0 } : null; }
  function register(book, source) {
    if (!book || !validSource(source)) return null;
    const old = book.entries.find(e => e.source.cityId === source.cityId);
    if (old) return same(old.source, source) ? old : null;
    const e = { kind: 'cityPoliticalSettlement', ...pickBinding(book), source: copy(source), phase: 'unreceived',
      terms: null, resolutions: [], history: [], knowledge: null, report: null, since: null, withdrawal: null,
      operation: null, operationAllocatedAt: null, operationLost: false, recovery: null, recoveryInitialized: false, staff: [] };
    book.entries.push(e); return e;
  }
  const pickBinding = b => ({ worldId: b.worldId, runId: b.runId });
  function ensureAuthority(book, party, originals = []) {
    let a = book.authorities.find(a => a.authorityId === party.authorityId);
    if (a) return a.charterId === party.charterId && a.cityId === party.cityId ? a : null;
    const count = party.kind === 'collective' ? 3 : 1;
    const members = Array.from({ length: count }, (_, n) => {
      const memberId = count === 1 ? party.authorityId : `${party.authorityId}:original-member:${n + 1}`;
      return originals.find(a => a.id === memberId) || { id: memberId, status: 'alive', health: 100,
        dutySeconds: 1800, assignment: null, policy: hash(`${memberId}:retained-autonomy`) % 7 === 0 ? 'retainIndependence' : 'considerSafeguards' };
    });
    for (const m of members) m.policy ??= hash(`${m.id}:retained-autonomy`) % 7 === 0 ? 'retainIndependence' : 'considerSafeguards';
    a = { ...copy(party), members, allocations: { population: count + (party.channel ? 1 : 0), sourceId: party.authorityId }, decisions: [],
      ...(party.channel ? { operator: originals.find(a => a.id === party.channelOperatorId) || { id: party.channelOperatorId,
        actorKind: 'civicOfficeholder', name: 'Original displaced records custodian', recordsSourceCharterId: party.charterId,
        status: 'alive', health: 100, workSeconds: party.channelWorkSeconds, assignment: null } } : {}) };
    book.authorities.push(a); return a;
  }
  function ready(c, office, own = null) {
    return Boolean(c?.alive && c.capable && c.local && c.atCounter && c.free && !c.violence && c.sourceCurrent && c.permission
      && c.clerkPresent && able(office?.clerk) && office.clerk.id === c.clerkId && c.bodyEpoch >= 0
      && time(c.at) && office.active !== false && office.channelPowered !== false && office.workSeconds > 0
      && (office.power > 0 || c.powerPerSecond === 0 && own) && (!office.assignment || office.assignment === own));
  }
  function quote(e, bodyEpoch, at) {
    return { id: `${e.source.sourceId}:terms:${at}`, cityId: e.source.cityId, charterId: e.source.charterId,
      sourceId: e.source.sourceId, bodyEpoch, at, expiresAt: at + 4 * DAY,
      disposition: e.source.controlStatus === 'displacedClaim' ? 'relinquishTerritorialClaim' : 'subordinateLocalGovernment',
      parties: e.source.parties.map(p => ({ authorityId: p.authorityId, cityId: p.cityId, charterId: p.charterId, decisionMandateId: p.decisionMandateId })),
      rights: 'Local charter, courts, property, worship and original appointments remain. No conversion, pardon or confiscation.',
      commands: 'Scientist sets city provisioning and defensive operating priorities. No independent offensive deployment against the scientist or another signatory city. Existing external claims on this named city are relinquished, not transferred to other cities.',
      obligations: 'The scientist fundamentally opposes the gods and their authority; this agreement is no divine endorsement or conversion. The scientist preserves the retained rights and refrains from aggression against the parties. Actual supply, original staff, institutional support and effective challenges remain independently consequential.' };
  }
  function begin(book, e, kind, c, office, at, expected = null, originals = []) {
    if (!bound(book, e) || book.job || !ready({ ...c, at }, office) || c.at !== at) return false;
    let party = e.source.parties.find(p => p.cityId === c.cityId && (!c.authorityId || p.authorityId === c.authorityId));
    if (!party && c.displacedChannelId) party = e.source.parties.find(p => p.channel === c.displacedChannelId);
    if (!party || kind !== 'inspect' && !e.knowledge) return false;
    if (kind === 'negotiate' && (party !== e.source.parties[0] || ['active', 'refused'].includes(e.phase))) return false;
    if (kind === 'accept' && (e.phase !== 'offered' || !same(expected, e.terms) || at >= e.terms.expiresAt || e.terms.bodyEpoch !== c.bodyEpoch)) return false;
    if (kind === 'assent' && (!e.terms || !same(expected, e.terms) || !e.resolutions.length || at >= e.terms.expiresAt
      || e.terms.bodyEpoch !== c.bodyEpoch || e.resolutions.some(r => r.authorityId === party.authorityId && r.termsId === e.terms.id))) return false;
    if (kind === 'withdraw' && e.phase !== 'active') return false;
    if (kind === 'report' && !e.terms) return false;
    if (!['inspect', 'negotiate', 'accept', 'assent', 'withdraw', 'report'].includes(kind)) return false;
    const authority = ensureAuthority(book, party, originals), seconds = ['negotiate', 'assent'].includes(kind) ? 180 : 60;
    const rate = c.powerPerSecond ?? 1, startup = rate === 0 ? 1 : 0;
    if (![0, 1].includes(rate) || !authority || authority.members.some(a => !able(a) || a.assignment || (a.dutySeconds ?? a.workSeconds ?? 0) < seconds)
      || office.workSeconds < seconds || office.power < seconds * rate + startup
      || authority.channel && (authority.channelWorkSeconds < seconds || authority.channelPower < 1
        || !able(authority.operator) || authority.operator.assignment || authority.operator.workSeconds < seconds)) return false;
    const jobId = `city-authority-work:${++book.serial}`;
    book.job = { id: jobId, cityId: e.source.cityId, authorityId: party.authorityId, kind, seconds, progress: 0, lastAt: at,
      bodyEpoch: c.bodyEpoch, officeId: office.id, clerkId: office.clerk.id, wasReady: true, powerPerSecond: rate, expected: copy(expected) };
    office.power -= startup;
    if (authority.channel) authority.channelPower--;
    office.assignment = jobId; for (const a of authority.members) a.assignment = jobId;
    if (authority.operator) authority.operator.assignment = jobId;
    return true;
  }
  function release(book, office) {
    const j = book.job; if (!j) return;
    if (office?.assignment === j.id) office.assignment = null;
    for (const a of book.authorities.flatMap(a => [...a.members, a.operator].filter(Boolean))) if (a.assignment === j.id) a.assignment = null;
    book.job = null;
  }
  function advance(book, c, office, at) {
    const j = book?.job; if (!j || !c.alive || at < j.lastAt) return false;
    const start = j.lastAt, elapsed = at - start; j.lastAt = at;
    const e = book.entries.find(e => e.source.cityId === j.cityId), authority = book.authorities.find(a => a.authorityId === j.authorityId);
    if (j.bodyEpoch !== c.bodyEpoch || !e || !authority) { release(book, office); return true; }
    const available = ready({ ...c, at }, office, j.id) && j.officeId === office.id && j.clerkId === office.clerk.id
      && authority.members.every(a => able(a) && a.assignment === j.id)
      && (!authority.channel || able(authority.operator) && authority.operator.assignment === j.id);
    if (!available) { if (office?.assignment === j.id) office.assignment = null; j.wasReady = false; return false; }
    office.assignment = j.id;
    if (!j.wasReady) { j.wasReady = true; return false; }
    const rate = j.powerPerSecond ?? 1;
    const work = Math.max(0, Math.min(elapsed, j.seconds - j.progress, office.workSeconds, rate ? office.power : Infinity,
      ...authority.members.map(a => a.dutySeconds ?? a.workSeconds), authority.channel ? Math.min(authority.channelWorkSeconds, authority.operator.workSeconds) : Infinity,
      ['accept', 'assent'].includes(j.kind) ? e.terms.expiresAt - start : Infinity));
    office.workSeconds -= work; office.power -= work * rate; j.progress += work;
    for (const a of authority.members) { const key = a.dutySeconds == null ? 'workSeconds' : 'dutySeconds'; a[key] -= work; }
    if (authority.channel) { authority.channelWorkSeconds -= work; authority.operator.workSeconds -= work; }
    if (j.progress < j.seconds) return work > 0;
    const completedAt = start + work;
    if (j.kind === 'negotiate') {
      const supporters = authority.members.filter(a => a.policy !== 'retainIndependence' && !a.hostile);
      const accepted = supporters.length === authority.members.length;
      authority.decisions.push({ id: j.id, at: completedAt, cityId: e.source.cityId, accepted,
        voters: authority.members.map(a => ({ id: a.id, assent: supporters.includes(a) })) });
      e.phase = accepted ? 'offered' : 'refused';
      if (accepted) e.disclosedAt = completedAt;
      e.terms = accepted ? quote(e, j.bodyEpoch, completedAt) : null;
    }
    if (['accept', 'assent'].includes(j.kind) && completedAt < e.terms.expiresAt) {
      const supporters = authority.members.filter(a => a.policy !== 'retainIndependence' && !a.hostile);
      if (supporters.length === authority.members.length) e.resolutions.push({ id: j.id, at: completedAt,
        authorityId: authority.authorityId, charterId: authority.charterId, decisionMandateId: authority.decisionMandateId, termsId: e.terms.id,
        members: supporters.map(a => a.id), required: authority.members.length });
      e.phase = e.source.parties.every(p => e.resolutions.some(r => r.authorityId === p.authorityId && r.termsId === e.terms.id)) ? 'active' : 'awaitingControllers';
      if (e.phase === 'active') e.since = completedAt;
    }
    if (j.kind === 'withdraw') { e.phase = 'withdrawn'; e.withdrawal = { at: completedAt, causeId: j.id }; }
    e.history.push({ id: j.id, kind: j.kind, at: completedAt, authorityId: authority.authorityId, phase: e.phase });
    receive(e, completedAt); release(book, office); return true;
  }
  function receive(e, at) {
    // Captured appointments are concealed in the ordinary public record.
    // Only the original government's actual consenting deliberation discloses
    // its private strategic command obligation, not an omniscient clerk.
    const concealed = e.source.controlStatus === 'puppet' && e.disclosedAt == null;
    e.knowledge = { at, cityId: e.source.cityId, cityName: e.source.cityName, sourceId: e.source.sourceId,
      charterId: e.source.charterId, controlStatus: concealed ? 'sovereign' : e.source.controlStatus, phase: e.phase, terms: copy(e.terms),
      resolutions: copy(e.resolutions), parties: (concealed ? e.source.parties.slice(0, 1) : e.source.parties).map(p => ({ cityId: p.cityId, authorityId: p.authorityId, name: p.name, kind: p.kind,
        ...(p.channel ? { correspondenceChannelId: p.channel } : {}) })),
      limits: SCOPE };
    return e.knowledge;
  }
  function authorizes(e, authorities, c, at) {
    return Boolean(e?.kind === 'cityPoliticalSettlement' && validSource(e.source) && e.phase === 'active' && e.terms
      && e.terms.bodyEpoch === c.bodyEpoch && e.terms.sourceId === e.source.sourceId && e.terms.cityId === e.source.cityId
      && e.terms.charterId === e.source.charterId && time(e.since) && e.since <= at && e.terms.at <= e.since && (!e.withdrawal)
      // The deadline belongs to unsigned proposals, not a perpetual renewal
      // ceremony. Accepted relationships end through actual loss or breach.
      && e.source.parties.every(p => {
        const a = authorities.find(a => a.authorityId === p.authorityId && a.charterId === p.charterId && a.cityId === p.cityId);
        const r = e.resolutions.find(r => r.authorityId === p.authorityId && r.charterId === p.charterId && r.termsId === e.terms.id && r.decisionMandateId === p.decisionMandateId);
        return a && a.kind === p.kind && a.members.length === (p.kind === 'collective' ? 3 : 1) && r && r.at <= at && r.at >= e.terms.at
          && r.required === a.members.length && Array.isArray(r.members) && new Set(r.members).size === r.members.length
          && r.members.filter(member => a.members.some(a => a.id === member && able(a) && !a.hostile)).length >= r.required;
      }));
  }
  function lifecycleFact(e, book, c, at) {
    if (e.source.controlStatus !== 'displacedClaim') return null;
    const resolved = authorizes(e, book.authorities, c, at) && c.alive && c.sourceCurrent && !c.actualOpposition;
    return { ...pickBinding(book), kind: 'city', targetId: `city:${e.source.cityId}`, sourceId: e.source.populationSourceId,
      at, since: resolved ? e.since : at, proofId: e.terms?.id || e.source.sourceId, state: resolved ? 'retired' : 'unverified',
      lifecycle: resolved ? { kind: 'physicalDestruction', sourceId: e.source.populationSourceId, causeId: e.source.destructionCauseId,
        at: e.since, population: 0, survivingClaimants: 0, settlementId: e.terms.id } : null };
  }
  function breach(book, targetId, c, at, causeId) {
    if (!c.alive || !c.witnessed || !time(at) || !id(causeId)) return false;
    let changed = false;
    for (const e of book?.entries || []) if (e.phase === 'active' && ([...e.staff, ...(e.recovery?.crew || [])].some(a => a.id === targetId)
      || e.source.parties.some(p => { const a = book.authorities.find(a => a.authorityId === p.authorityId);
        return a && [...a.members, a.operator].some(m => m?.id === targetId); }))) {
      e.withdrawal = { at, causeId }; e.phase = 'withdrawn';
      e.history.push({ at, kind: 'witnessedBreach', targetId, causeId }); changed = true;
      // No remote receipt is issued by an unseen change in another account.
    }
    return changed;
  }
  function externalCampaignAllowed(book, cityId, c, at) {
    return !(book?.entries || []).some(e => e.source.cityId === cityId && authorizes(e, book.authorities, c, at));
  }
  function adoptActor(book, incoming) {
    if (!incoming) return incoming;
    const original = [...(book?.authorities || []).flatMap(a => [...a.members, a.operator].filter(Boolean)),
      ...(book?.entries || []).flatMap(e => [...e.staff, ...(e.recovery?.crew || [])])].find(a => a.id === incoming.id);
    if (!original || original === incoming) return incoming;
    if (incoming.workSeconds != null && original.dutySeconds != null) {
      original.workSeconds = Math.min(incoming.workSeconds, original.dutySeconds); delete original.dutySeconds;
    }
    for (const key of ['health', 'workSeconds', 'stamina', 'wardMana']) if (Number.isFinite(original[key]) && Number.isFinite(incoming[key])) original[key] = Math.min(original[key], incoming[key]);
    if (Number.isFinite(original.fatigue) && Number.isFinite(incoming.fatigue)) original.fatigue = Math.max(original.fatigue, incoming.fatigue);
    for (const key of ['health', 'bodyIntegrity']) if (Number.isFinite(original.stats?.[key]?.current) && Number.isFinite(incoming.stats?.[key]?.current))
      original.stats[key].current = Math.min(original.stats[key].current, incoming.stats[key].current);
    if (incoming.status === 'dead') original.status = 'dead';
    for (const [key, value] of Object.entries(incoming)) if (original[key] == null) original[key] = copy(value);
    if (incoming.roles) original.roles = [...new Set([...(original.roles || []), ...incoming.roles])];
    return original;
  }
  function normalize(v) {
    if (!v) return null;
    if (!id(v.worldId) || !id(v.runId) || !Array.isArray(v.entries) || !Array.isArray(v.authorities)
      || !Number.isSafeInteger(v.serial) || v.serial < 0 || new Set(v.entries.map(e => e?.source?.cityId)).size !== v.entries.length
      || v.entries.some(e => !bound(e, v) || !validSource(e.source)
        || !['unreceived', 'offered', 'refused', 'awaitingControllers', 'active', 'withdrawn'].includes(e.phase)
        || !Array.isArray(e.resolutions) || !Array.isArray(e.history)
        || !Array.isArray(e.staff) || e.resolutions.some(r => !id(r?.id) || !id(r.authorityId) || !id(r.termsId)
          || !id(r.charterId) || !id(r.decisionMandateId) || !time(r.at) || !Array.isArray(r.members) || !r.members.every(id)
          || !Number.isSafeInteger(r.required) || r.required < 1)
        || e.terms && (!id(e.terms.id) || !time(e.terms.at) || e.terms.expiresAt !== e.terms.at + 4 * DAY
          || !Number.isSafeInteger(e.terms.bodyEpoch) || e.terms.bodyEpoch < 0 || e.terms.sourceId !== e.source.sourceId
          || e.terms.cityId !== e.source.cityId || e.terms.charterId !== e.source.charterId)
        || e.phase === 'active' && (!e.terms || !time(e.since))
        || e.operation && (!time(e.operationAllocatedAt) || !bound(e.operation, e)))
      || new Set(v.authorities.map(a => a?.authorityId)).size !== v.authorities.length
      || v.authorities.some(a => !id(a.authorityId) || !id(a.cityId) || !id(a.charterId) || !id(a.decisionMandateId)
        || !['individual', 'collective'].includes(a.kind) || !Array.isArray(a.members)
        || a.channel && (!time(a.channelPower) || !time(a.channelWorkSeconds) || !id(a.channelOperatorId)
          || a.operator?.id !== a.channelOperatorId || !time(a.operator.workSeconds))
        || a.members.length !== (a.kind === 'collective' ? 3 : 1) || a.members.some((m, n) => !id(m.id) || !time(m.dutySeconds ?? m.workSeconds)
          || m.id !== (a.kind === 'collective' ? `${a.authorityId}:original-member:${n + 1}` : a.authorityId)))) return null;
    if (v.job && (!id(v.job.id) || !id(v.job.cityId) || !id(v.job.authorityId) || !id(v.job.officeId) || !id(v.job.clerkId)
      || !['inspect', 'negotiate', 'accept', 'assent', 'withdraw', 'report'].includes(v.job.kind)
      || v.job.seconds !== (['negotiate', 'assent'].includes(v.job.kind) ? 180 : 60)
      || !time(v.job.lastAt) || !time(v.job.progress) || v.job.progress > v.job.seconds
      || !Number.isSafeInteger(v.job.bodyEpoch) || v.job.bodyEpoch < 0 || ![0, 1].includes(v.job.powerPerSecond))) return null;
    return copy(v);
  }
  function rebind(v, from, to) { const s = normalize(v); if (!bound(s, from) || !create(to)) return null;
    Object.assign(s, pickBinding(to)); for (const e of s.entries) {
      Object.assign(e, pickBinding(to)); if (e.operation && bound(e.operation, from)) Object.assign(e.operation, pickBinding(to));
      if (e.recovery && bound(e.recovery, from)) Object.assign(e.recovery, pickBinding(to));
    } return s; }
  return { DAY, ROLES, SCOPE, bound, sourceFromWorld, validSource, create, register, ensureAuthority, ready, quote,
    validLaw, begin, advance, release, receive, authorizes, lifecycleFact, breach, externalCampaignAllowed, adoptActor, normalize, rebind };
});
