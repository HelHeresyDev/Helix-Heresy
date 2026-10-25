(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./expedition-escorts') : root.HelixExpeditionEscorts);
  if (node) module.exports = api;
  if (root) root.HelixChapterProtection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Escorts) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const id = x => typeof x === 'string' && x.length > 0;
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const able = a => a?.status === 'alive' && a.health >= 35;
  const SCOPE = 'One licensed chapter, one original protective-duty professional and one willing threatened official. Finite local paid protection/evacuation only; no police authority, army, sovereignty, maps, divine endorsement, organization dissolution or network-wide nonintervention.';
  const FEE = 80, WAGES = 40, HOURS = 7200, REPORT = 120, PARLEY = 60, RESERVE = 1000;
  function source(city, standings) {
    if (!city?.assetId || !city.cityId || city.currentPopulation < 16 || city.physicalCondition === 'ruined' || city.physicalJurisdictionExists === false) return null;
    const row = [...(standings || [])].sort((a, b) => String(a.branch?.id).localeCompare(String(b.branch?.id))).find(e =>
      e.network?.category === 'military' && id(e.network.id) && e.branch?.organizationForm === 'escortChapter'
      && id(e.branch.id) && (e.branch.currentCityId || e.branch.cityId) === city.cityId
      && e.branch.publicPhysicalPresence === true && e.branch.operationalStatus === 'active'
      && !['ruined', 'destroyed'].includes(e.branch.physicalCondition)
      && ['licensed', 'chartered', 'recognized'].includes(e.standing)
      && ['functional', 'strong', 'regionalHub'].includes(e.branch.capacityBand)
      && e.network.roles?.some(r => ['escortContracting', 'perimeterDefense', 'convoyForce'].includes(r)));
    if (!row) return null;
    return { cityId: city.cityId, populationSourceId: city.assetId, networkId: row.network.id, branchId: row.branch.id,
      allocationId: `${row.branch.id}:protective-duty-professional`, label: row.branch.publicName,
      capacityBand: row.branch.capacityBand, people: 1, roles: copy(row.network.roles),
      restrictions: copy([...(row.network.clientRestrictions || []), ...(row.branch.clientRestrictions || [])]),
      prohibitions: copy(row.network.prohibitions || []), provenance: 'One original local chapter employee, separate from its survey professional and municipal defender; no added city population.' };
  }
  function validSource(s) { return s && ['cityId', 'populationSourceId', 'networkId', 'branchId', 'allocationId'].every(k => id(s[k]))
    && s.allocationId === `${s.branchId}:protective-duty-professional` && s.people === 1 && Array.isArray(s.restrictions)
    && ['functional', 'strong', 'regionalHub'].includes(s.capacityBand) && s.roles?.some(r => ['escortContracting', 'perimeterDefense', 'convoyForce'].includes(r)); }
  const bound = (s, b) => s && b && s.worldId === b.worldId && s.runId === b.runId;
  function create(backing, binding, layout, client, clerk, seed, at) {
    if (!validSource(backing) || !id(binding?.worldId) || !id(binding.runId) || !client?.id || !clerk?.id
      || !client.mapCell || !layout?.home || !layout.refuge || !layout.roomIds?.includes(layout.roomId)) return null;
    const actor = Escorts.candidate(seed, { id: backing.allocationId, label: backing.label });
    Object.assign(actor, { id: backing.allocationId, actorKind: 'civicOfficeholder', affiliation: backing.label,
      roomId: layout.roomId, mapCell: copy(layout.home), physicalControl: { strength: 25, stamina: 80, staminaCapacity: 80 },
      workSeconds: 43200, foodSeconds: 43200, waterSeconds: 43200, assignment: null });
    return { ...binding, id: `${backing.branchId}:local-protection`, source: copy(backing), layout: copy(layout),
      clientId: client.id, clerkId: clerk.id, clientHome: { cell: copy(client.mapCell), roomId: client.roomId }, actor,
      kit: { batonCondition: 100, vestCondition: 100 }, attempts: [], contracts: [], contract: null,
      phase: 'idle', job: null, quote: null, promise: null, report: null, observations: [], lastAt: at,
      nextMoveAt: at + 1, nextAttackAt: at + 4, serial: 0, finances: { engagement: 0, earnedWages: 0, refunded: 0, escrow: 0 } };
  }
  function normalize(s) { return validSource(s?.source) && id(s.worldId) && id(s.runId) && s.actor?.id === s.source.allocationId
    && id(s.clientId) && id(s.clerkId) && s.layout?.roomIds?.length && Array.isArray(s.attempts) && Array.isArray(s.contracts)
    && Array.isArray(s.observations) && Number.isFinite(s.lastAt) && s.finances?.escrow >= 0 ? copy(s) : null; }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, ...to } : null; }
  function current(s, c) { return bound(s, c) && c.source && ['cityId', 'populationSourceId', 'branchId', 'networkId', 'allocationId']
    .every(k => s.source[k] === c.source[k]) && c.client?.id === s.clientId && c.clerk?.id === s.clerkId; }
  const assigned = s => Boolean(s?.contract && !s.contract.endedAt && !s.contract.closed);
  function releaseChannel(s, c) {
    for (const a of [s.actor, c.client, c.clerk]) if (a?.assignment === s.job?.id) a.assignment = null;
    if (c.gate?.receptionAssignment === s.job?.id) c.gate.receptionAssignment = null;
    s.job = null;
  }
  function willingness(s) {
    const rule = s.source.restrictions.find(r => r.refusesProtectiveContracts === true);
    return { accepted: !rule, reason: rule?.text || 'Named-person protection and voluntary evacuation only; no occupation or regime-change mandate.' };
  }
  function aggression(s, c, report, at) {
    if (!s || !c.alive || !current(s, c) || !report || report.witnessId !== s.clientId || report.actorId !== 'scientist'
      || report.cityId !== s.source.cityId || !['outerApproachAttack', 'namedPersonAttack'].includes(report.kind) || report.at > at) return false;
    if (!assigned(s) && !s.attempts.some(r => r.causeId === report.id)) s.pendingCause = copy(report);
    if (assigned(s)) {
      s.contract.hostileUntil = at + 30; s.contract.lastAggressionAt = at;
      if (s.promise?.bodyEpoch === c.bodyEpoch && !s.promise.breachedAt) { s.promise.breachedAt = at; s.phase = 'protecting'; s.quote = null; }
      if (s.job?.kind === 'parley') { s.job = null; s.quote = null; }
    }
    return true;
  }
  function contact(s, c) { return current(s, c) && c.alive && c.capable && c.local && c.near && c.clientNear
    && !c.busy && able(s.actor) && !c.actorIncapacitated && able(c.client) && !c.clientIncapacitated; }
  function parley(s, c, at) {
    if (!contact(s, c) || !assigned(s) || s.job || s.quote || s.promise?.bodyEpoch === c.bodyEpoch && !s.promise.breachedAt
      || at < s.contract.hostileUntil || !willingness(s).accepted || s.actor.workSeconds < PARLEY || c.client.workSeconds < PARLEY) return false;
    s.job = { id: `${s.id}:parley:${++s.serial}`, kind: 'parley', at, progress: 0, bodyEpoch: c.bodyEpoch,
      actorCell: copy(s.actor.mapCell), clientCell: copy(c.client.mapCell), cell: copy(c.cell), ready: true }; return true;
  }
  function accept(s, c, expected, at) {
    if (!contact(s, c) || !assigned(s) || s.job || !s.quote || JSON.stringify(s.quote) !== JSON.stringify(expected)
      || s.quote.bodyEpoch !== c.bodyEpoch || at >= s.quote.expiresAt || at >= s.contract.endsAt) return false;
    s.promises ||= []; if (s.promise) s.promises.push(copy(s.promise));
    s.promise = { ...copy(s.quote), at, endsAt: s.contract.endsAt, breachedAt: null };
    s.phase = 'settled'; s.quote = null; return true;
  }
  function close(s, c, market, at, reason) {
    const k = s.contract; if (!k || k.closed) return;
    k.endedAt ??= at; k.closed = true; k.reason = reason;
    if (market?.id === s.source.cityId && Number.isFinite(market.treasury)) {
      market.treasury += s.finances.escrow; s.finances.refunded += s.finances.escrow; s.finances.escrow = 0;
    }
    if (s.actor.assignment === k.id) s.actor.assignment = null;
    if (c.client.assignment === k.id) c.client.assignment = null;
    s.phase = reason; s.job = null; s.quote = null; s.contracts.push(copy(k));
  }
  function advance(s, context, market, to, h = {}) {
    if (!s || !Number.isFinite(to) || to <= s.lastAt) return false;
    const initial = context(); if (!initial.alive || !bound(s, initial)) return false;
    if (!s.pendingCause && !s.job && !assigned(s)) {
      // Off-duty means no action: it restores no health, gear, duty or food.
      // Settle an old claim only against its original currently available account.
      if (current(s, initial) && s.contract?.closed && s.finances.escrow > 0 && market?.id === s.source.cityId && Number.isFinite(market.treasury)) {
        market.treasury += s.finances.escrow; s.finances.refunded += s.finances.escrow; s.finances.escrow = 0;
      }
      s.lastAt = to; return false;
    }
    while (s.lastAt < to && context().alive) {
      if (!s.pendingCause && !s.job && !assigned(s)) { s.lastAt = to; break; }
      const dt = Math.min(1, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      const c = context(), a = s.actor, client = c.client;
      if (!current(s, c)) {
        if (s.job?.kind === 'report') releaseChannel(s, c);
        s.quote = null;
        if (!bound(s, c) || client?.id !== s.clientId || !assigned(s)) continue;
        s.contract.returning = true; s.phase = 'returning'; s.job = null;
      }
      if (s.contract?.closed && s.finances.escrow > 0 && market?.id === s.source.cityId && Number.isFinite(market.treasury)) {
        market.treasury += s.finances.escrow; s.finances.refunded += s.finances.escrow; s.finances.escrow = 0;
      }
      if (s.pendingCause && current(s, c) && !assigned(s) && !s.job) {
        const cause = s.pendingCause; s.pendingCause = null;
        const decision = willingness(s); s.attempts.push({ causeId: cause.id, at, receivedAt: null, decision: copy(decision) });
        if (!decision.accepted || !c.canCommission || !able(client) || c.clientIncapacitated || !able(a) || c.actorIncapacitated || a.assignment
          || client.assignment || c.clerk.assignment || c.gate.receptionAssignment || !c.channel || !c.clientConsent
          || a.workSeconds < REPORT + 300 || a.foodSeconds < REPORT + HOURS || a.waterSeconds < REPORT + HOURS
          || c.gate.powerSeconds < REPORT + 1 || c.gate.receptionWorkSeconds < REPORT || client.workSeconds < REPORT
          || market?.id !== s.source.cityId || !Number.isFinite(market.treasury) || market.treasury < RESERVE + FEE + WAGES) {
          s.phase = 'declined'; continue;
        }
        const jobId = `${s.id}:report:${++s.serial}`;
        s.job = { id: jobId, kind: 'report', cause: copy(cause), at, progress: 0, ready: true };
        a.assignment = client.assignment = c.clerk.assignment = c.gate.receptionAssignment = jobId; s.phase = 'reporting'; continue;
      }
      if (s.job?.kind === 'report') {
        const j = s.job;
        if (!able(client) || c.clientIncapacitated || !able(c.clerk) || !able(a) || c.actorIncapacitated || !c.channel || !c.clientConsent || !c.canCommission
          || client.assignment !== j.id || c.clerk.assignment !== j.id || c.gate.receptionAssignment !== j.id
          || a.assignment !== j.id || a.foodSeconds < dt || a.waterSeconds < dt
          || c.gate.powerSeconds < dt + 1 || c.gate.receptionWorkSeconds < dt || client.workSeconds < dt || a.workSeconds < dt) {
          releaseChannel(s, c); s.phase = 'interrupted'; continue;
        }
        const work = Math.min(dt, REPORT - j.progress); j.progress += work; client.workSeconds -= work;
        c.gate.powerSeconds -= work; c.gate.receptionWorkSeconds -= work; a.workSeconds -= work; a.foodSeconds -= work; a.waterSeconds -= work;
        if (j.progress >= REPORT) {
          const cause = copy(j.cause); s.attempts.at(-1).receivedAt = at; releaseChannel(s, c);
          if (market.treasury < RESERVE + FEE + WAGES || a.assignment || !willingness(s).accepted) { s.phase = 'declined'; continue; }
          market.treasury -= FEE + WAGES; s.finances.engagement += FEE; s.finances.escrow += WAGES;
          s.contract = { id: `${s.id}:contract:${++s.serial}`, causeId: cause.id, at, endsAt: at + HOURS,
            mandate: { at, authorityId: c.authorityId, charterId: c.charterId, clientId: s.clientId, clerkId: s.clerkId,
              scope: 'This one named-person protective expenditure only; not occupation, police command or political submission.' },
            earned: 0, hostileUntil: at, lastAggressionAt: cause.at, clientConsentedAt: at, endedAt: null, closed: false };
          a.assignment = client.assignment = s.contract.id; s.phase = 'protecting';
          continue; // Transmission time is not simultaneous paid field duty.
        }
      }
      if (!assigned(s)) continue;
      if (s.quote && at >= s.quote.expiresAt) s.quote = null;
      if (s.quote && s.quote.bodyEpoch !== c.bodyEpoch) s.quote = null;
      if (s.phase === 'settled' && s.promise?.bodyEpoch !== c.bodyEpoch) s.phase = 'protecting';
      const k = s.contract, live = a.status !== 'dead';
      const earningUntil = Math.min(at, k.endsAt, live ? at : a.diedAt ?? at);
      const wage = Math.max(0, Math.min(s.finances.escrow, Math.min(WAGES, (earningUntil - k.at) / HOURS * WAGES) - k.earned));
      k.earned += wage; s.finances.earnedWages += wage; s.finances.escrow -= wage;
      if (live) { a.workSeconds = Math.max(0, a.workSeconds - dt); a.foodSeconds = Math.max(0, a.foodSeconds - dt); a.waterSeconds = Math.max(0, a.waterSeconds - dt); }
      const mobile = able(a) && !c.actorIncapacitated && a.assignment === k.id && a.workSeconds > 0
        && a.foodSeconds > 0 && a.waterSeconds > 0 && a.physicalControl.stamina > 1;
      const clientMobile = able(client) && !c.clientIncapacitated && client.assignment === k.id && client.workSeconds > 0;
      if (!live || !able(client) || c.clientIncapacitated || at >= k.endsAt || !mobile || !c.clientConsent) {
        k.returning = true; s.phase = 'returning'; s.quote = null; s.job = null;
      }
      if (s.job?.kind === 'parley') {
        const j = s.job;
        if (!contact(s, { ...c, busy: c.otherBusy }) || j.bodyEpoch !== c.bodyEpoch || !same(j.actorCell, a.mapCell)
          || !same(j.clientCell, client.mapCell) || !same(j.cell, c.cell) || at < k.hostileUntil) { s.job = null; s.quote = null; continue; }
        const work = Math.min(dt, PARLEY - j.progress, client.workSeconds); j.progress += work; client.workSeconds -= work;
        if (j.progress >= PARLEY) { s.quote = { id: j.id, at, expiresAt: Math.min(at + 300, k.endsAt), bodyEpoch: c.bodyEpoch,
          clientId: s.clientId, branchId: s.source.branchId, contractId: k.id,
          terms: 'Allow this willing official and original professional to withdraw without attacks or physically blocking their route. No research, faith, city authority, property or map is transferred.' }; s.job = null; }
        continue;
      }
      const settled = s.promise?.bodyEpoch === c.bodyEpoch && !s.promise.breachedAt && at < s.promise.endsAt;
      const threat = !settled && at < k.hostileUntil && c.seesAggressor && c.aggressorCell
        && c.aggressorDistanceToClient <= 4 && s.layout.roomIds.includes(c.aggressorRoom);
      if (mobile && threat && c.distanceToAggressor <= 1 && at >= s.nextAttackAt && s.kit.batonCondition > 0) {
        if (h.strike?.(a, at)) { a.physicalControl.stamina -= 3; s.kit.batonCondition = Math.max(0, s.kit.batonCondition - .5); }
        s.nextAttackAt = at + 4;
        if (!context().alive) return true; // Finish this impact's cost, not an unseen subsequent action.
      } else if (at >= s.nextMoveAt) {
        s.nextMoveAt = at + 1;
        if (mobile) {
          const goal = k.returning ? s.layout.home : threat ? h.adjacent?.(a, c.aggressorCell) : h.adjacent?.(a, client.mapCell);
          if (goal && !same(a.mapCell, goal) && h.move?.(a, goal)) a.physicalControl.stamina = Math.max(0, a.physicalControl.stamina - .1);
        }
        if (clientMobile && !s.quote && (!threat || settled) && (k.returning || c.escortNear)) {
          const goal = k.returning ? s.clientHome.cell : s.layout.refuge;
          if (!same(client.mapCell, goal) && h.move?.(client, goal)) { client.workSeconds--; k.obstructedSeconds = 0; }
          else if (!same(client.mapCell, goal) && settled && c.blockedByScientist?.(client, goal)) {
            k.obstructedSeconds = (k.obstructedSeconds || 0) + dt;
            if (k.obstructedSeconds >= 30) { s.promise.breachedAt = at; k.hostileUntil = at + 30; s.phase = 'protecting'; }
          } else k.obstructedSeconds = 0;
        }
      }
      if (k.returning && (client.status === 'dead' || same(client.mapCell, s.clientHome.cell))
        && (a.status === 'dead' || same(a.mapCell, s.layout.home))) close(s, c, market, at, 'completed');
    }
    return true;
  }
  function observe(s, c, at) {
    if (!s || !c.alive || !c.capable || !c.local || !c.observed) return false;
    const v = { at, branch: s.source.label, branchId: s.source.branchId,
      phase: c.actorVisible && c.clientVisible ? s.phase : 'Local commitment status unverified',
      professional: c.actorVisible ? { id: s.actor.id, name: s.actor.name, condition: s.actor.status === 'dead' ? 'Physical remains' : s.actor.health < 35 ? 'Incapacitated' : 'Alive' } : null,
      client: c.clientVisible ? { id: s.clientId, condition: c.client.status === 'dead' ? 'Physical remains' : 'Personally observed original official' } : null,
      quote: c.near && c.clientNear ? copy(s.quote) : null, promise: copy(s.promise), scope: SCOPE };
    s.report = v; s.observations.push(copy(v)); s.observations = s.observations.slice(-50); return true;
  }
  function fact(s, c, at) {
    return { worldId: s.worldId, runId: s.runId, targetId: `counterpower:${s.source.networkId}`, sourceId: s.source.networkId,
      kind: 'counterpower', at, since: at, proofId: s.id, state: c.effectiveChallenge ? 'notQualifying' : 'unverified', basis: 'supportedNonintervention',
      strategic: { scope: 'terrestrialRule', consumerId: 'chapter-protection', sourceId: s.source.networkId, at,
        canOverturn: Boolean(c.effectiveChallenge), willing: Boolean(c.effectiveChallenge), responseSupported: false } };
  }
  return { SCOPE, FEE, WAGES, HOURS, REPORT, PARLEY, RESERVE, source, validSource, create, normalize, rebind,
    bound, current, assigned, willingness, aggression, contact, parley, accept, advance, observe, fact, publicView: s => copy(s?.report) };
});
