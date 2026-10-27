(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./network-capabilities') : root.HelixNetworkCapabilities,
    node ? require('./network-inventories') : root.HelixNetworkInventories,
    node ? require('./exceptional-reach') : root.HelixExceptionalReach);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixNetworkOperations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Capabilities, Inventories, ExceptionalReach) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const SEND = 60, REPLY = 60, RECEIVE = 30;
  const TERMS = 'No new discretionary financing or acceptance of armed receiving-approach contests against the scientist. Existing obligations, civilian protection, humanitarian supplies, property, criticism and beliefs remain protected. No sovereignty, maps or divine endorsement is transferred.';
  const SUPPLY_PURPOSE = 'municipalSupplyInterdiction';
  const SUPPLY_TERMS = 'No new municipal supply-interdiction deployments against the scientist\'s administrations. Transmit authenticated stand-down orders to original employed field teams; they must receive the order and physically return. Existing civilian protection, property claims, criticism and beliefs remain protected. No map, sovereignty or divine endorsement is transferred.';
  const purposeOf = r => r?.purpose || 'armedReceivingContest';
  const answered = (a, r) => a?.responses?.some(x => x.requestId === r.id) || a?.reply?.requestId === r.id;
  const bound = (s, c) => s && c && s.worldId === c.worldId && s.runId === c.runId;
  function hash(x) { let n = 2166136261; for (const c of String(x)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }
  // These are bounded initial operating allocations, elaborated once from
  // original premises/population, not new money or personnel per conflict.
  // Capacity is NOT a strategic harmlessness or army-strength certificate.
  function sources(map, seed) {
    const h = map?.strategicNonStateNetworkHistory;
    if (!h?.networkRows || !h.branchRows) return null;
    const cities = new Map((map.strategicPlayableSettlementState?.cityRows || []).map(c => [c.cityId, c]));
    const used = new Map(), physical = new Map(), original = [...h.branchRows].sort((a, b) => a.id.localeCompare(b.id));
    for (const b of original.filter(b => !b.consolidatedIntoBranchId)) {
      const n = h.networkRows.find(n => n.networkId === b.networkId), city = cities.get(b.currentCityId);
      const available = n && n.organizationalContinuity && n.lifecycleStatus !== 'defunct' && city?.physicalJurisdictionExists
        && city.currentPopulation >= 16 && city.physicalCondition !== 'ruined' && b.operationalStatus === 'active'
        && !['ruined', 'destroyed'].includes(b.physicalCondition) && ['functional', 'strong', 'regionalHub'].includes(b.currentCapacityBand);
      if (available && (used.get(city.cityId) || 0) < Math.floor(city.currentPopulation / 16)) {
        used.set(city.cityId, (used.get(city.cityId) || 0) + 1); physical.set(b.id, true);
      }
    }
    const branches = original.map(b => {
      const n = h.networkRows.find(n => n.networkId === b.networkId), city = cities.get(b.currentCityId);
      let physicalHost = b; const visited = new Set();
      while (physicalHost?.consolidatedIntoBranchId && !visited.has(physicalHost.id)) {
        visited.add(physicalHost.id);
        physicalHost = original.find(r => r.id === physicalHost.consolidatedIntoBranchId && r.networkId === b.networkId);
      }
      const host = physicalHost && !visited.has(physicalHost.id) ? physicalHost.id : `unresolved-host:${b.id}`;
      const allocated = physical.get(b.id) === true;
      // A new, explicit operating charter is separate from topology/ownership.
      // The seed elaborates that charter once; requests never reroll it.
      const managed = b.currentCityId === n?.originCityId || hash(`${seed}:operating-charter:${b.id}`) % 3 === 0;
      return { id: b.id, networkId: b.networkId, cityId: b.currentCityId, populationSourceId: city?.assetId || null,
        label: b.publicName, hostId: host, allocated: Boolean(allocated), public: b.publicPhysicalPresence === true,
        charter: { id: `${b.id}:operating-charter`, controllerId: managed ? b.networkId : b.id,
          mode: managed ? 'delegatedManagement' : 'autonomousAccession',
          scope: ['ownDiscretionaryFinance', 'ownNewContracts'], source: 'Original branch operating charter; not inferred from branding, cooperation or beneficial ownership.' },
        interest: n?.privatePriority === 'secureSupply' ? 'retainCorridorDiscretion' : 'boundedNoninterference',
        financePolicy: n?.privatePriority === 'secureSupply' ? { id: `${b.id}:standing-equipment-authority`,
          purpose: 'armedReceivingContest', mode: 'automatedLocalPayment', charterId: `${b.id}:operating-charter` } : null,
        // Fixed small office capital, never municipal treasury or truck title.
        capital: allocated && host === b.id ? 240 : 0, operatorSeconds: allocated && host === b.id ? 14400 : 0,
        terminalSeconds: allocated && host === b.id && city?.services?.communications !== 'failed' ? 14400 : 0,
        category: n?.category, lifecycle: b.operationalStatus, networkContinuity: Boolean(n?.organizationalContinuity) };
    });
    for (const b of branches) b.disclosurePolicy = ['concealOwnership', 'collectIntelligence'].includes(h.networkRows.find(n => n.networkId === b.networkId)?.privatePriority)
      ? 'withholdInternalAccounts' : 'limitedOfficeAccount';
    const result = { capabilityBaseline: Capabilities.baseline(map), networks: h.networkRows.map(n => ({ id: n.networkId, label: n.name,
      headBranchId: branches.find(b => b.networkId === n.networkId && b.cityId === n.originCityId
        && b.allocated && b.hostId === b.id && b.charter.controllerId === n.networkId)?.id || null })), branches,
      // Retain original concealed identities privately. No public reply from an
      // office establishes that these other capacities ceased to exist.
      concealed: [...(h.covertRows || []), ...(h.affiliateRows || [])].map(r => ({ id: r.id,
        networkId: r.networkId || r.actualParentNetworkId, status: r.status || r.lifecycleStatus })) };
    result.exceptionalSources = ExceptionalReach.sources(map);
    result.inventoryPlan = Inventories.plan(map, result);
    return result;
  }
  function account(source) {
    return { id: source.id, source: copy(source), money: source.capital, initialMoney: source.capital,
      operator: { id: `${source.id}:original-desk-operator`, populationSourceId: source.populationSourceId,
        workSeconds: source.operatorSeconds, status: 'alive', assignment: null },
      terminal: { id: `${source.id}:original-office-terminal`, powerSeconds: source.terminalSeconds },
      allocations: [], payments: [], reply: null, mandate: null, lastAt: 0, lost: false };
  }
  function validSource(source) {
    return source && ['networks', 'branches', 'concealed'].every(k => Array.isArray(source[k]))
      && (!source.capabilityBaseline || Capabilities.validBaseline(source.capabilityBaseline))
      && (!source.inventoryPlan || Inventories.validPlan(source.inventoryPlan, source.capabilityBaseline))
      && (!source.exceptionalSources || ExceptionalReach.validSources(source.exceptionalSources))
      && source.networks.every(n => typeof n.id === 'string')
      && source.branches.every(b => typeof b.id === 'string' && typeof b.hostId === 'string'
        && source.networks.some(n => n.id === b.networkId) && b.charter?.id && b.charter.controllerId
        && ['delegatedManagement', 'autonomousAccession'].includes(b.charter.mode) && Array.isArray(b.charter.scope)
        && [b.capital, b.operatorSeconds, b.terminalSeconds].every(n => Number.isFinite(n) && n >= 0));
  }
  function create(source, binding, at, options = {}) {
    if (!validSource(source) || !binding?.worldId || !binding.runId || !Number.isFinite(at)) return null;
    return { ...binding, source: copy(source), accounts: source.branches.map(account), requests: [], job: null,
      capabilityAccountingInitialized: true, capabilityAccounting: source.capabilityBaseline ? Capabilities.create(source.capabilityBaseline, binding, at) : null,
      inventoriesInitialized: true, inventories: Inventories.create(source, binding, options.originalInventory === true),
      reports: [], serial: 0, lastAt: at };
  }
  function normalize(s) {
    if (s == null) return null;
    const valid = !s.invalid && s.worldId && s.runId && validSource(s.source) && Array.isArray(s.accounts)
      && s.accounts.every(a => a?.id && a.source?.charter && a.operator && a.terminal && Array.isArray(a.allocations)
        && Array.isArray(a.payments) && [a.money, a.initialMoney, a.operator.workSeconds, a.terminal.powerSeconds].every(n => Number.isFinite(n) && n >= 0))
      && Array.isArray(s.requests) && Array.isArray(s.reports) && Number.isFinite(s.lastAt);
    // Corrupt pre-existing accounting must not become "not initialized" and
    // silently recreate every original cash balance on the next update.
    if (!valid) return { worldId: s.worldId || '', runId: s.runId || '', invalid: true, lastAt: Number(s.lastAt) || 0 };
    const next = copy(s); next.capabilityAccounting = Capabilities.normalize(s.capabilityAccounting);
    if (s.inventoriesInitialized || s.inventories) next.inventories = Inventories.normalize(s.inventories, s.source.inventoryPlan);
    return next;
  }
  function rebind(s, from, to) { s = normalize(s); if (!bound(s, from)) return null;
    s.capabilityAccounting = Capabilities.rebind(s.capabilityAccounting, from, to);
    if (s.inventoriesInitialized || s.inventories) s.inventories = Inventories.rebind(s.inventories, from, to, s.source.inventoryPlan);
    return { ...s, ...to }; }
  function sync(s, expected = s?.source) {
    if (!s || s.invalid) return;
    if (!s.source.inventoryPlan && expected?.inventoryPlan) s.source.inventoryPlan = copy(expected.inventoryPlan);
    Inventories.sync(s);
    if (expected?.capabilityBaseline && !s.source.capabilityBaseline) s.source.capabilityBaseline = copy(expected.capabilityBaseline);
    const base = expected?.capabilityBaseline || s.source.capabilityBaseline;
    if (base) {
      if (!s.capabilityAccounting) s.capabilityAccounting = Capabilities.create(base, s, s.lastAt, s.capabilityAccountingInitialized === true);
      if (Capabilities.bound(s.capabilityAccounting, s)) Capabilities.sync(s.capabilityAccounting, base);
      s.capabilityAccountingInitialized = true;
    }
    for (const a of s.accounts) if (a.reply && !a.responses?.some(r => r.requestId === a.reply.requestId)) {
      a.responses ||= []; a.responses.push(copy(a.reply));
    }
    // Original IDs are restored as gaps, not re-funded, if saved accounting is
    // missing. A changed public directory never erases a concealed original.
    for (const key of ['networks', 'branches', 'concealed']) for (const original of expected?.[key] || [])
      if (!s.source[key].some(r => r.id === original.id)) s.source[key].push(copy(original));
    for (const b of s.source.branches) if (!b.disclosurePolicy) {
      const original = expected?.branches?.find(r => r.id === b.id && r.networkId === b.networkId);
      b.disclosurePolicy = original?.disclosurePolicy || 'limitedOfficeAccount';
    }
    for (const source of s.source.branches) if (!s.accounts.some(a => a.id === source.id)) {
      const a = account(source); a.lost = true; a.money = 0; a.operator.workSeconds = 0; a.terminal.powerSeconds = 0;
      s.accounts.push(a); // Lost accounting is never a fresh initial allocation.
    }
  }
  function host(s, branchId) {
    const b = s?.source?.branches?.find(b => b.id === branchId);
    return b && s.accounts.find(a => a.id === b.hostId && !a.lost) || null;
  }
  function attach(s, chapter) {
    if (!chapter || !bound(s, chapter)) return false;
    const a = host(s, chapter.source.branchId); if (!a || a.source.networkId !== chapter.source.networkId
      || a.source.cityId !== chapter.source.cityId || a.source.populationSourceId !== chapter.source.populationSourceId) return false;
    let r = a.allocations.find(r => r.id === chapter.actor.id);
    if (!r) a.allocations.push(r = { id: chapter.actor.id, kind: 'originalProtectiveProfessional', external: true });
    // References/snapshots of the SAME employee, worn kit and paid obligation.
    // No second professional, kit stock or duty balance is created here.
    r.status = chapter.actor.status; r.assignment = chapter.actor.assignment; r.workSeconds = chapter.actor.workSeconds;
    r.equipment = copy(chapter.kit); r.contractId = chapter.contract?.id || null;
    const income = chapter.finances.engagement + chapter.finances.earnedWages, previous = r.creditedIncome || 0;
    if (income > previous) { a.money += income - previous; r.creditedIncome = income; }
    return true;
  }
  function contact(s, c) {
    return !s?.invalid && bound(s, c) && c.alive && c.capable && c.local && c.near && !c.busy && c.channel
      && c.gate && c.clerk?.status === 'alive' && c.clerk.health >= 35;
  }
  function release(s, c) {
    const a = s.job && host(s, s.job.entryId);
    if (a?.operator.assignment === s.job.id) a.operator.assignment = null;
    if (c.gate?.receptionAssignment === s.job?.id) c.gate.receptionAssignment = null;
    if (c.clerk?.assignment === s.job?.id) c.clerk.assignment = null;
    s.job = null;
  }
  function begin(s, c, networkId, entryId, at, kind = 'send', purpose = 'armedReceivingContest') {
    if (!['armedReceivingContest', SUPPLY_PURPOSE, Capabilities.PURPOSE].includes(purpose)) return false;
    if (!['send', 'receive'].includes(kind) || !contact(s, c) || s.job || c.gate.receptionAssignment || c.clerk.assignment) return false;
    const required = kind === 'send' ? SEND : RECEIVE;
    const entry = s.source.branches.find(b => b.id === entryId && b.public && b.networkId === networkId && b.cityId === c.cityId);
    const a = entry && host(s, entryId);
    if (!a || a.operator.status !== 'alive' || a.operator.assignment || a.operator.workSeconds < required || a.terminal.powerSeconds < required) return false;
    const request = s.requests.find(r => r.networkId === networkId && purposeOf(r) === purpose);
    if (kind === 'send' && request || kind === 'receive' && (!request || !request.deliveredAt)) return false;
    if (c.gate.receptionWorkSeconds < required || c.gate.powerSeconds < required + 1) return false;
    const jobId = `network-contact:${++s.serial}`;
    s.job = { id: jobId, kind, purpose, networkId, entryId, cityId: c.cityId, gateId: c.gate.id, clerkId: c.clerk.id,
      radioUnitId: c.radioUnitId || null, at, progress: 0, bodyEpoch: c.bodyEpoch, cell: copy(c.cell) };
    c.gate.receptionAssignment = c.clerk.assignment = a.operator.assignment = jobId;
    return true;
  }
  function decision(a, purpose) {
    if (purpose === Capabilities.PURPOSE) { const statement = Capabilities.statement(null, a);
      return { accepts: statement.disclosure === 'limited', statement, reason: statement.text }; }
    if (a.source.charter.mode === 'delegatedManagement') return { accepts: true, reason: 'Binding instruction within the explicit discretionary-finance/new-contract charter.' };
    return a.source.interest === 'retainCorridorDiscretion'
      ? { accepts: false, reason: purpose === SUPPLY_PURPOSE
        ? 'Autonomous branch retains discretion over its own field contracts after reported breaches. No other representative can waive those rights.'
        : 'Autonomous branch retains discretion to finance restoration of receiving access. No other representative can sign that right away.' }
      : { accepts: true, reason: 'Autonomous accession; existing obligations and protected civilian work remain outside the restriction.' };
  }
  function advance(s, context, to) {
    if (!s || s.invalid || !Number.isFinite(to) || to <= s.lastAt) return false;
    let c = context(); if (!bound(s, c) || !c.alive) return false;
    sync(s);
    // Chronological completion avoids coarse advance delivering a reply before
    // the initiating transmission, or granting retroactive remote work.
    while (s.lastAt < to) {
      c = context(); if (!bound(s, c) || !c.alive) break;
      let dt = Math.min(1, to - s.lastAt);
      if (s.job) dt = Math.min(dt, (s.job.kind === 'send' ? SEND : RECEIVE) - s.job.progress);
      for (const a of s.accounts) if (a.pending) dt = Math.min(dt, REPLY - a.pending.progress);
      const at = s.lastAt + dt; s.lastAt = at;
      const j = s.job, a = j && host(s, j.entryId),
        worked = new Set(s.accounts.filter(a => a.operator.lastOperatingWorkAt >= at).map(a => a.id));
      if (j) {
        const valid = contact(s, { ...c, busy: c.otherBusy }) && c.cityId === j.cityId && c.gate.id === j.gateId
          && c.clerk.id === j.clerkId && c.bodyEpoch === j.bodyEpoch && JSON.stringify(c.cell) === JSON.stringify(j.cell)
          && c.gate.receptionAssignment === j.id && c.clerk.assignment === j.id
          && a?.operator.assignment === j.id && a.operator.status === 'alive' && a.operator.workSeconds >= dt
          && !worked.has(a.id)
          && a.terminal.powerSeconds >= dt && c.gate.receptionWorkSeconds >= dt && c.gate.powerSeconds >= dt + 1;
        if (!valid) { if (a?.operator.assignment === j.id) a.operator.assignment = null; release(s, c); }
        else if (!c.communicate || c.communicate({ purpose: 'networkCorrespondence', sessionId: `${j.id}:${j.kind}`,
          sequence: Math.ceil(j.progress + dt), fromCityId: j.cityId, toCityId: a.source.cityId, civicCityIds: [j.cityId],
          signer: 'branch', senderId: a.id, charterId: a.source.charter.id }, at)) {
          j.progress += dt; a.operator.workSeconds -= dt; a.terminal.powerSeconds -= dt; worked.add(a.id);
          a.operator.lastOperatingWorkAt = at;
          c.gate.receptionWorkSeconds -= dt; c.gate.powerSeconds -= dt;
          if (j.progress >= (j.kind === 'send' ? SEND : RECEIVE)) {
            if (j.kind === 'send') s.requests.push({ id: j.id, purpose: purposeOf(j), networkId: j.networkId, entryId: j.entryId, at,
              terms: purposeOf(j) === SUPPLY_PURPOSE ? SUPPLY_TERMS : purposeOf(j) === Capabilities.PURPOSE ? Capabilities.TERMS : TERMS,
              deliveredAt: at, replies: [], receivedAt: null });
            else receive(s, s.requests.find(r => r.networkId === j.networkId && purposeOf(r) === purposeOf(j)), at);
            a.operator.assignment = null; release(s, c);
          }
        }
      }
      for (const r of s.requests) if (at > r.deliveredAt) {
        for (const b of s.source.branches.filter(b => b.networkId === r.networkId && b.public && b.hostId === b.id)) {
          const peer = host(s, b.id); if (!peer || answered(peer, r) || peer.operator.assignment || worked.has(peer.id)) continue;
          const principal = s.source.networks.find(n => n.id === r.networkId)?.headBranchId;
          const disclosure = purposeOf(r) === Capabilities.PURPOSE;
          if (!disclosure && b.charter.mode === 'delegatedManagement' && b.id !== principal && (!r.delegation || at <= r.delegation.at)) continue;
          if (peer.operator.status !== 'alive' || peer.operator.workSeconds < dt || peer.terminal.powerSeconds < dt) continue;
          if (peer.pending && peer.pending.requestId !== r.id) continue;
          if (c.communicate && !c.communicate({ purpose: 'networkCorrespondence', sessionId: `${r.id}:${b.id}:reply`,
            sequence: Math.ceil((peer.pending?.progress || 0) + dt), fromCityId: b.cityId,
            toCityId: s.source.branches.find(b => b.id === r.entryId).cityId,
            civicCityIds: [s.source.branches.find(b => b.id === r.entryId).cityId],
            signer: 'branch', senderId: peer.id, charterId: peer.source.charter.id }, at)) continue;
          peer.pending ||= { requestId: r.id, progress: 0 }; worked.add(peer.id);
          peer.pending.progress += dt; peer.operator.workSeconds -= dt; peer.terminal.powerSeconds -= dt;
          peer.operator.lastOperatingWorkAt = at;
          if (peer.pending.progress >= REPLY) {
            const d = decision(peer, purposeOf(r));
            if (!disclosure && d.accepts && b.id === principal && b.charter.mode === 'delegatedManagement'
              && b.charter.controllerId === r.networkId) r.delegation = { id: `${r.id}:controller-authorization`, at,
              controllerId: r.networkId, principalBranchId: b.id, operatorId: peer.operator.id,
              scope: ['ownDiscretionaryFinance', 'ownNewContracts'] };
            peer.reply = { requestId: r.id, at, branchId: b.id, ...d };
            peer.responses ||= []; peer.responses.push(copy(peer.reply));
            if (!disclosure && d.accepts) {
              const mandate = { id: `${r.id}:${b.id}:accession`, requestId: r.id, purpose: purposeOf(r), at,
              charterId: b.charter.id, controllerId: b.charter.controllerId, delegationId: b.charter.mode === 'delegatedManagement' ? r.delegation?.id : null,
              scope: copy(b.charter.scope), terms: r.terms };
              peer.mandates ||= {}; peer.mandates[purposeOf(r)] = mandate;
              if (purposeOf(r) === 'armedReceivingContest') peer.mandate = mandate;
            }
            r.replies.push(copy(peer.reply)); peer.pending = null;
          }
        }
      }
      if (!s.job && !s.requests.some(r => s.source.branches.some(b => b.networkId === r.networkId && b.public && b.hostId === b.id
        && !answered(host(s, b.id), r) && host(s, b.id)?.operator.workSeconds > 0 && host(s, b.id)?.terminal.powerSeconds > 0))) {
        s.lastAt = to; break;
      }
    }
    return true;
  }
  function receive(s, r, at) {
    if (!r) return;
    r.receivedAt = at;
    s.reports.push({ id: `${r.id}:received:${at}`, networkId: r.networkId, purpose: purposeOf(r), at,
      observedAt: r.replies.length ? Math.max(...r.replies.map(x => x.at)) : r.deliveredAt, terms: r.terms,
      replies: r.replies.map(x => ({ branchId: x.branchId, label: s.source.branches.find(b => b.id === x.branchId)?.label,
        at: x.at, accepts: x.accepts, reason: x.reason, ...(x.statement ? { statement: copy(x.statement) } : {}) })),
      limits: 'Only the specifically replying offices and their chartered assets. Silence, consolidated lineages, undisclosed affiliates and other capabilities are not certified. No map or complete branch/resource count is supplied.' });
  }
  function permitted(s, branchId, purpose, obligationAt) {
    const a = host(s, branchId);
    if (!a || a.lost) return false;
    const mandate = a.mandates?.[purpose] || (purpose === 'armedReceivingContest' ? a.mandate : null);
    if (!mandate || Number.isFinite(obligationAt) && obligationAt <= mandate.at) return true;
    return false;
  }
  function sponsor(s, branchId, cost, operation, at) {
    const a = host(s, branchId);
    if (!a || !Number.isFinite(at) || at < s.lastAt || !Number.isFinite(cost) || cost <= 0 || !operation?.id || !operation.cityId || !operation.routeId
      || operation.purpose !== 'armedReceivingContest' || a.source.cityId !== operation.payerCityId
      || !permitted(s, branchId, operation.purpose, operation.obligationAt)
      || a.source.interest !== 'retainCorridorDiscretion' || a.money < cost
      || a.source.financePolicy?.purpose !== operation.purpose || a.terminal.powerSeconds < 1
      || a.payments.some(p => p.operationId === operation.id)) return false;
    // A standing finite-budget payment rule, not an invented fresh human
    // signature. The actual municipal transmission triggers one terminal event
    // in the payer's own city. An offline terminal cannot settle a new payment.
    a.terminal.powerSeconds--;
    a.money -= cost;
    a.payments.push({ id: `${operation.id}:${a.id}:equipment-payment`, at, amount: cost, operationId: operation.id,
      cityId: operation.cityId, routeId: operation.routeId, purpose: operation.purpose,
      authorizationId: a.source.financePolicy.id, terminalId: a.terminal.id, powerSeconds: 1 }); return true;
  }
  function candidates(s, cityId) {
    return (s?.accounts || []).filter(a => !a.lost && a.id === a.source.hostId && a.source.cityId === cityId
      && a.source.interest === 'retainCorridorDiscretion' && a.source.financePolicy?.purpose === 'armedReceivingContest'
      && a.terminal.powerSeconds >= 1 && permitted(s, a.id, 'armedReceivingContest')).map(a => a.id).sort();
  }
  function fact(s, networkId, challenge, at) {
    if (!s?.source?.networks?.some(n => n.id === networkId)) return null;
    // This consumer accounts for office capital and specific local allocations,
    // NOT all armed/covert/certification/research capacity of an organization.
    return { worldId: s.worldId, runId: s.runId, targetId: `counterpower:${networkId}`, sourceId: networkId,
      kind: 'counterpower', at, since: at, state: challenge ? 'notQualifying' : 'unverified',
      proofId: `network-operations:${networkId}`, basis: 'supportedNonintervention', strategic: {
        scope: 'terrestrialRule', consumerId: 'networkOperations', sourceId: networkId, at,
        canOverturn: Boolean(challenge), willing: Boolean(challenge), responseSupported: false } };
  }
  function cancel(s, c) { if (!s?.job || !bound(s, c) || !c.alive) return false; release(s, c); return true; }
  return { SEND, REPLY, RECEIVE, TERMS, SUPPLY_PURPOSE, SUPPLY_TERMS, purposeOf, sources, create, normalize, rebind, bound, sync, host, attach, begin, advance, cancel,
    permitted, sponsor, candidates, fact, publicView: s => copy(s?.reports || []) };
});
