(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./powerworks-maintenance') : root.HelixPowerworksMaintenance);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPowerworksStandards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Maintenance) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = Maintenance.bound;
  const SPEC = 'Regulator metal parts: compatible metal composition, serviceable fabrication and no observed damage or contamination. Destructive one-unit sample; acceptance covers only the unchanged remaining identified lot.';
  const SCOPE = 'Prospective local replacement-part acceptance, not machine ownership, universal certification, political recognition or authority over earlier repairs. Measurements and voluntary organizational endorsement are separate.';
  const SECONDS = Object.freeze({ adopt: 60, withdraw: 60, test: 300, selfTest: 600 });
  function sources(map, city, definitions, includeRemote = false, targetPlant = city) {
    if (includeRemote) {
      const target = map?.strategicPlayableSettlementState?.cityRows?.find(c => c.cityId === city?.cityId);
      if (!target?.physicalJurisdictionExists || target.assetId !== city.populationSourceId || target.physicalCondition === 'ruined') return [];
      const local = sources(map, city, definitions);
      if (!map?.strategicCapabilityHistory?.milestoneRows?.some(m => m.infrastructureRows?.some(p => p.id === city.powerId
        && p.cityId === city.cityId && p.function === 'powerWorks' && p.operationalAtPlayableYear))) return [];
      const other = (map?.strategicPlayableSettlementState?.cityRows || []).filter(c => c.cityId !== city.cityId)
        .flatMap(c => sources(map, { cityId: c.cityId, populationSourceId: c.assetId }, definitions, false, city));
      return [...local, ...other.map(r => ({ ...r, id: `${r.branchId}:${city.powerId}:regulator-parts`, powerId: city.powerId,
        targetCityId: city.cityId, targetPopulationSourceId: city.populationSourceId }))];
    }
    const h = map?.strategicNonStateNetworkHistory, row = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === city?.cityId);
    const power = map?.strategicCapabilityHistory?.milestoneRows?.flatMap(m => m.infrastructureRows || []).find(p => p.id === targetPlant?.powerId
      && p.cityId === targetPlant.cityId && p.function === 'powerWorks' && p.operationalAtPlayableYear);
    if (!h || !power || row?.assetId !== city.populationSourceId || !row.physicalJurisdictionExists || row.physicalCondition === 'ruined' || row.currentPopulation < 64) return [];
    return h.branchRows.filter(b => b.currentCityId === city.cityId && b.publicPhysicalPresence && !b.consolidatedIntoBranchId
      && b.organizationForm === 'standardsBureau' && b.operationalStatus === 'active' && ['licensed', 'chartered'].includes(b.currentStanding)
      && !['ruined', 'destroyed'].includes(b.physicalCondition) && ['functional', 'strong', 'regionalHub'].includes(b.currentCapacityBand))
      .filter(b => { const n = h.networkRows.find(n => n.networkId === b.networkId), d = definitions?.find(d => d.id === n?.sourceDefinitionId);
        return n?.category === 'standards' && n.organizationalContinuity && !['defunct', 'dormant'].includes(n.lifecycleStatus) && d?.roles.includes('technicalStandards'); })
      .sort((a, b) => a.id.localeCompare(b.id)).slice(0, Math.floor(row.currentPopulation / 64))
      .map(b => ({ id: `${b.id}:regulator-parts`, branchId: b.id, networkId: b.networkId, cityId: city.cityId,
        populationSourceId: city.populationSourceId, powerId: targetPlant.powerId, label: b.publicName,
        specificationId: `${b.networkId}:regulator-metal-parts`, qualification: 'regulatorMaterialMetrology' }));
  }
  const validSource = r => r?.qualification === 'regulatorMaterialMetrology'
    && ['id', 'branchId', 'networkId', 'cityId', 'populationSourceId', 'powerId', 'label', 'specificationId'].every(k => typeof r[k] === 'string' && r[k]);
  function create(rows, rule, at) {
    if (!rule?.worldId || !rule.runId || !rule.powerMaintenance || !Number.isFinite(at) || at < 0 || !Array.isArray(rows) || !rows.every(validSource)
      || new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => (r.targetCityId || r.cityId) !== rule.source.cityId || r.powerId !== rule.source.powerId
        || (r.targetPopulationSourceId || r.populationSourceId) !== rule.source.populationSourceId)) return null;
    return { worldId: rule.worldId, runId: rule.runId, id: `${rule.id}:parts-standards`, ruleId: rule.id, powerId: rule.source.powerId,
      cityId: rule.source.cityId, sources: copy(rows), providers: rows.map(r => ({ sourceId: r.id, accepting: true,
        reviewer: { id: `${r.branchId}:original-material-metrologist`, qualification: r.qualification, status: 'alive', health: 100, workSeconds: 14400, assignment: null },
        bench: { id: `${r.branchId}:original-material-review-bench`, condition: 100, workSeconds: 14400, assignment: null } })),
      // Original plant's bounded local test allocation. The reference never
      // travels over the internet or belongs to the standards organization.
      reference: { id: `${rule.source.powerId}:original-parts-test-jig`, ownerCityId: rule.source.cityId,
        condition: rule.source.powerCondition ?? 75, workSeconds: 14400, sampleTests: 24, assignment: null },
      policy: null, offer: null, policies: [], job: null, assessments: [], history: [], report: null, serial: 0, lastAt: at };
  }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !s.worldId || !s.runId || !s.ruleId || !s.id || !s.cityId || !s.powerId || !Number.isFinite(s.lastAt) || s.lastAt < 0
      || !Number.isSafeInteger(s.serial) || s.serial < 0 || !Array.isArray(s.sources) || !s.sources.every(validSource)
      || !Array.isArray(s.providers) || s.providers.length !== s.sources.length || !Array.isArray(s.policies) || !Array.isArray(s.history) || !Array.isArray(s.assessments)
      || new Set(s.sources.map(r => r.id)).size !== s.sources.length || new Set(s.providers.map(p => p?.sourceId)).size !== s.providers.length
      || s.sources.some(r => (r.targetCityId || r.cityId) !== s.cityId || r.powerId !== s.powerId)
      || s.providers.some(p => !s.sources.some(r => r.id === p?.sourceId) || !p.reviewer?.id || !p.bench?.id
        || ![p.reviewer.health, p.reviewer.workSeconds, p.bench.condition, p.bench.workSeconds].every(n => Number.isFinite(n) && n >= 0)
        || p.reviewer.health > 100 || p.reviewer.workSeconds > 14400 || p.bench.workSeconds > 14400 || p.bench.condition > 100)
      || s.reference?.id !== `${s.powerId}:original-parts-test-jig` || s.reference.ownerCityId !== s.cityId
      || ![s.reference.condition, s.reference.workSeconds, s.reference.sampleTests].every(n => Number.isFinite(n) && n >= 0)
      || !Number.isInteger(s.reference.sampleTests)
      || s.reference.condition > 100 || s.reference.workSeconds > 14400 || s.reference.sampleTests > 24
      || s.assessments.some(a => !a?.id || !a.stackId || !a.fingerprint || !a.specificationId || !Number.isInteger(a.remaining) || a.remaining < 0 || !Number.isFinite(a.at)
        || !a.measurements || typeof a.measurements.suitable !== 'boolean' || typeof a.measurements.clean !== 'boolean'
        || typeof a.measurements.compatible !== 'boolean' || !a.measurements.primary || !Number.isFinite(a.measurements.fabrication)
        || a.providerId && !s.sources.some(r => r.id === a.providerId))
      || s.policy && (!s.policy.id || !Number.isFinite(s.policy.at) || !s.sources.some(r => r.id === s.policy.publisherId && r.specificationId === s.policy.specificationId))
      || s.job && (!SECONDS[s.job.kind] || !s.job.id || !Number.isFinite(s.job.progress) || s.job.progress < 0 || s.job.progress > SECONDS[s.job.kind]
        || !Array.isArray(s.job.tools) || !Array.isArray(s.job.inputs)
        || ['adopt', 'withdraw'].includes(s.job.kind) && (!s.job.offer || s.job.offer.action !== s.job.kind || s.job.inputs.length || s.job.tools.length)
        || ['test', 'selfTest'].includes(s.job.kind) && (!s.job.policy?.specificationId || s.job.inputs.length !== 2 || s.job.tools.length !== 3
          || !Number.isInteger(s.job.remaining) || s.job.remaining < 2 || !s.job.lotFingerprint))) return { worldId: s.worldId || '', runId: s.runId || '', invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, worldId: to.worldId, runId: to.runId } : null; }
  const target = (s, rule) => Boolean(s && !s.invalid && bound(s, rule) && s.ruleId === rule.id && s.powerId === rule.source.powerId && !rule.powerMaintenance?.accountLost
    && s.cityId === rule.source.cityId && s.sources.every(r => (r.targetCityId || r.cityId) === rule.source.cityId
      && (r.targetPopulationSourceId || r.populationSourceId) === rule.source.populationSourceId && r.powerId === rule.source.powerId));
  const own = (i, claim = '') => i && i.carriedBy === 'scientist' && i.quantity > 0 && !i.cityOwnerId && !i.civicCustody
    && (!i.ownerId || ['scientist', 'player'].includes(i.ownerId)) && (!i.legalOwnerId || ['scientist', 'player'].includes(i.legalOwnerId))
    && !i.containerId && !i.fixtureId && !i.carryTaskId && !i.chemicalBatch && !i.biology && !i.contents?.length
    && !i.tags?.some(t => /stolen/i.test(t)) && (!i.reservedTaskId || i.reservedTaskId === claim);
  const fingerprint = i => JSON.stringify([i.id, i.section, i.key, i.materialComposition || {}, i.craftsmanship || 0, [...(i.tags || [])].sort(), i.productionWorkpieceId || '']);
  function measure(i) {
    const primary = i.materialComposition?.primary || 'steel', fabrication = i.craftsmanship > 0 ? i.craftsmanship : 60;
    const clean = !i.tags?.some(t => /contaminated|corroded|cracked|damaged|brittle/i.test(t));
    const compatible = ['steel', 'iron'].includes(primary), suitable = compatible && fabrication >= 50 && clean;
    return { primary, fabrication, clean, compatible, suitable };
  }
  function channel(s, networks, id) {
    const r = s?.sources?.find(r => r.id === id), p = s?.providers?.find(p => p.sourceId === id), a = networks?.accounts?.find(a => a.id === r?.branchId && !a.lost);
    return bound(s, networks) && p && a && a.source.hostId === a.id && a.source.cityId === r.cityId
      && a.source.networkId === r.networkId && a.source.populationSourceId === r.populationSourceId ? { r, p, a } : null;
  }
  function local(s, rule, c, counter = false) {
    return Boolean(target(s, rule) && c.alive && c.capable && c.local && c.authority && c.sourceCurrent && c.institutionsAvailable
      && !c.otherBusy && !c.violence && !rule.command && !rule.recharge
      && (counter ? c.atCounter && c.reportersPresent : c.atWorkface && c.workAccessible));
  }
  function review(s, rule, c, action, sourceId, at) {
    const r = s?.sources?.find(r => r.id === sourceId);
    if (!local(s, rule, c, true) || s.job || !['adopt', 'withdraw'].includes(action) || action === 'adopt' && !r || action === 'withdraw' && !s.policy) return null;
    s.offer = { id: `${s.id}:proposal:${++s.serial}`, action, sourceId: r?.id || null, specificationId: r?.specificationId || null,
      text: SPEC, oldPolicyId: s.policy?.id || null, handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch, at, expiresAt: at + 600 };
    return copy(s.offer);
  }
  function begin(s, rule, networks, c, kind, providerId, stackId, stacks, tools, expected, at) {
    const policyWork = ['adopt', 'withdraw'].includes(kind), seconds = SECONDS[kind];
    if (!seconds || !local(s, rule, c, policyWork) || s.job || rule.operatorServiceAssignment) return false;
    let ch = null, lot = null, reagent = null, kit = [];
    if (policyWork) {
      if (!s.offer || JSON.stringify(expected) !== JSON.stringify(s.offer) || expected.action !== kind || at > expected.expiresAt
        || expected.handoverId !== rule.handoverId || expected.bodyEpoch !== c.bodyEpoch || expected.oldPolicyId !== (s.policy?.id || null)
        || rule.operatorWorkSeconds < seconds) return false;
    } else {
      if (!s.policy || !s.reference || s.reference.assignment || s.reference.condition < 65 || s.reference.workSeconds < seconds || s.reference.sampleTests < 1) return false;
      lot = stacks.find(i => i.id === stackId && i.section === 'resources' && i.key === 'metalParts' && own(i) && i.quantity >= 3);
      reagent = stacks.find(i => i.key === 'assayReagent' && i.section === 'resources' && own(i) && !i.tags?.includes('contaminated') && i.quantity >= 1);
      kit = Maintenance.instruments(tools, c);
      if (!lot || !reagent || kit.some(t => !t) || c.stamina < seconds / 120) return false;
      if (kind === 'selfTest' && !['analysis', 'materialsScience'].every(k => c.skills?.[k] >= 40)) return false;
      if (kind === 'test') {
        ch = channel(s, networks, providerId);
        if (!ch || !ch.p.accepting || ch.p.reviewer.status !== 'alive' || ch.p.reviewer.health < 50 || ch.p.reviewer.assignment || ch.p.bench.assignment
          || ch.p.reviewer.workSeconds < seconds || ch.p.bench.workSeconds < seconds || ch.p.bench.condition < 50
          || ch.a.operator.status !== 'alive' || ch.a.operator.assignment || ch.a.operator.workSeconds < seconds || ch.a.terminal.powerSeconds < seconds
          || !ch.a.source.charter.scope.includes('ownNewContracts') || !c.channelAvailable || c.wallet.money < 20 || rule.operatorWorkSeconds < seconds) return false;
      }
    }
    const id = `${s.id}:work:${++s.serial}`;
    s.job = { id, kind, progress: 0, at, handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch, cell: copy(c.cell),
      policy: copy(s.policy), offer: policyWork ? copy(expected) : null, providerId: ch?.r.id || null, charterId: ch?.a.source.charter.id || null,
      inputs: lot ? [{ id: lot.id, key: lot.key, quantity: 1 }, { id: reagent.id, key: reagent.key, quantity: 1 }] : [],
      lotFingerprint: lot ? fingerprint(lot) : null, remaining: lot ? lot.quantity - 1 : null, started: false,
      tools: kit.map(t => ({ id: t.tool.id, stackId: t.stack.id, key: t.key })) };
    for (const i of s.job.inputs) stacks.find(i2 => i2.id === i.id).reservedTaskId = id;
    for (const t of kit) { t.stack.reservedTaskId = id; t.tool.reservedTaskId = id; }
    if (policyWork || ch) rule.operatorServiceAssignment = id;
    if (!policyWork) s.reference.assignment = id;
    if (ch) ch.a.operator.assignment = ch.p.reviewer.assignment = ch.p.bench.assignment = id;
    return true;
  }
  function cancel(s, rule, networks, stacks, tools, at) {
    const j = s?.job; if (!j) return false;
    for (const i of stacks) if (i.reservedTaskId === j.id) delete i.reservedTaskId;
    for (const t of tools) if (t.tool?.reservedTaskId === j.id) delete t.tool.reservedTaskId;
    const ch = j.providerId && channel(s, networks, j.providerId), p = s.providers.find(p => p.sourceId === j.providerId);
    for (const a of [ch?.a.operator, p?.reviewer, p?.bench, s.reference]) if (a?.assignment === j.id) a.assignment = null;
    if (rule.operatorServiceAssignment === j.id) rule.operatorServiceAssignment = null;
    s.history.push({ at, kind: 'interrupted', workSeconds: j.progress, sampled: j.started && j.inputs.length > 0 }); s.job = null; return true;
  }
  function receive(s, rule, c, at) {
    if (!local(s, rule, c, c.atCounter) || s.job) return false;
    s.report = { at, policy: copy(s.policy), policies: copy(s.policies), assessments: copy(s.assessments), scope: SCOPE }; return true;
  }
  function permits(s, rule, i, policy) {
    // Missing saved accounting is an unknown, not a repeal of an adopted rule.
    if (!target(s, rule)) return !s && !rule?.partsStandardsInitialized;
    if (!i || !measure(i).suitable && s.policies.length) return false;
    if (!policy) return true;
    const a = s.assessments.findLast(a => !a.supersededAt && a.stackId === i.id && a.fingerprint === fingerprint(i) && a.remaining === i.quantity
      && a.specificationId === policy.specificationId && a.measurements.suitable);
    return Boolean(a);
  }
  function installed(s, stacks, inputs) {
    if (!s || s.invalid) return;
    for (const input of inputs.filter(i => i.key === 'metalParts')) {
      const i = stacks.find(i => i.id === input.id);
      for (const a of s.assessments.filter(a => !a.supersededAt && a.stackId === input.id && a.fingerprint === fingerprint(i) && a.remaining === i.quantity + input.quantity)) a.remaining -= input.quantity;
    }
  }
  function savedTools(s, rule, stacks) {
    const j = target(s, rule) && s.job;
    if (!j || j.handoverId !== rule.handoverId || !j.inputs.every(r => j.started && r.key === 'assayReagent'
      || stacks.some(i => i.id === r.id && own(i, j.id) && i.reservedTaskId === j.id))) return [];
    return j.tools.filter(t => stacks.some(i => i.id === t.stackId && i.toolInstanceId === t.id && i.reservedTaskId === j.id && own(i, j.id))).map(t => t.id);
  }
  function advance(s, rule, networks, context, to, h) {
    if (!target(s, rule) || !h.alive() || to <= s.lastAt) return false;
    if (!s.job) { s.lastAt = to; register(s, networks); return false; }
    while (s.lastAt < to && s.job && h.alive()) {
      const dt = Math.min(1, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      const j = s.job, c = context(), policyWork = !j.inputs.length, ch = j.providerId && channel(s, networks, j.providerId);
      const stacks = h.stacks(), tools = h.tools(), lot = stacks.find(i => i.id === j.inputs[0]?.id);
      const kit = j.tools.map(t => tools.find(k => k.stack.id === t.stackId && k.tool?.id === t.id)).filter(Boolean);
      const inputsValid = j.inputs.every(r => j.started && r.key === 'assayReagent' || stacks.some(i => i.id === r.id && i.key === r.key
        && own(i, j.id) && i.reservedTaskId === j.id && i.quantity >= r.quantity));
      const remoteReady = !j.providerId || ch && ch.p.reviewer.status === 'alive' && ch.p.reviewer.health >= 50 && ch.p.reviewer.assignment === j.id
        && ch.p.reviewer.workSeconds >= dt && ch.p.bench.assignment === j.id && ch.p.bench.workSeconds >= dt && ch.p.bench.condition >= 50
        && ch.a.operator.status === 'alive' && ch.a.operator.assignment === j.id && ch.a.operator.workSeconds >= dt && ch.a.terminal.powerSeconds >= dt
        && ch.a.source.charter.id === j.charterId && c.channelAvailable;
      if (!local(s, rule, c, policyWork) || j.handoverId !== rule.handoverId || j.bodyEpoch !== c.bodyEpoch || !['x', 'y', 'z'].every(k => j.cell[k] === c.cell[k])
        || (policyWork || ch) && (rule.operatorServiceAssignment !== j.id || rule.operatorWorkSeconds < dt) || !remoteReady
        || !policyWork && (!inputsValid || !lot || fingerprint(lot) !== j.lotFingerprint || lot.quantity !== j.remaining + (j.started ? 0 : 1)
          || kit.length !== 3 || Maintenance.instruments(kit, c, j.id).some(t => !t) || c.stamina < dt / 120
          || s.reference.assignment !== j.id || s.reference.condition < 65 || s.reference.workSeconds < dt
          || !j.started && s.reference.sampleTests < 1 || j.kind === 'selfTest' && !['analysis', 'materialsScience'].every(k => c.skills?.[k] >= 40))
        || !j.started && ch && c.wallet.money < 20) { cancel(s, rule, networks, stacks, tools, at); continue; }
      if ((policyWork || ch) && rule.operatorWorkedUntil >= at || ch && ch.a.operator.lastOperatingWorkAt >= at) continue;
      if (ch && c.communicate && !c.communicate({ purpose: 'partsAssessment', sessionId: j.id, sequence: Math.ceil(j.progress + dt),
        fromCityId: rule.source.cityId, toCityId: ch.r.cityId, civicCityIds: [rule.source.cityId], signer: 'branch', senderId: ch.a.id, charterId: j.charterId }, at)) {
        j.hold = 'Awaiting supported authenticated assessment guidance; no duplicate samples, fees or work.'; continue;
      }
      delete j.hold;
      if (!j.started) {
        if (ch) { c.wallet.money -= 20; ch.a.money += 20; ch.a.income ||= []; ch.a.income.push({ id: j.id, at, purpose: 'partsAssessment', amount: 20 }); }
        for (const r of j.inputs) { const i = stacks.find(i => i.id === r.id); i.quantity -= r.quantity; i.knownQuantity = Math.min(i.knownQuantity ?? i.quantity, i.quantity); }
        if (!policyWork) {
          for (const a of s.assessments.filter(a => a.stackId === lot.id && !a.supersededAt)) a.supersededAt = at;
          s.reference.sampleTests--; for (const t of kit) t.tool.current--;
        }
        j.started = true;
      }
      if (policyWork || ch) { rule.operatorWorkSeconds -= dt; rule.operatorWorkedUntil = at; }
      if (ch) {
        ch.a.operator.workSeconds -= dt; ch.a.terminal.powerSeconds -= dt; ch.a.operator.lastOperatingWorkAt = at;
        ch.p.reviewer.workSeconds -= dt; ch.p.bench.workSeconds -= dt;
      }
      if (!policyWork) { s.reference.workSeconds -= dt; h.work(dt / 120); }
      j.progress += dt;
      if (j.progress < SECONDS[j.kind]) continue;
      if (policyWork) {
        s.policy = j.kind === 'withdraw' ? null : { id: `${s.id}:policy:${++s.serial}`, at, specificationId: j.offer.specificationId,
          publisherId: j.offer.sourceId, handoverId: rule.handoverId, text: SPEC };
        s.policies.push({ at, action: j.kind, policy: copy(s.policy), priorPolicyId: j.offer.oldPolicyId }); s.offer = null;
      } else s.assessments.push({ id: `${s.id}:assessment:${++s.serial}`, at, stackId: lot.id, fingerprint: fingerprint(lot), remaining: lot.quantity,
        specificationId: j.policy.specificationId, measurements: measure(lot), providerId: j.providerId,
        endorsement: j.providerId ? 'Original provider assessment of this measured lot only' : null, sampleQuantity: 1 });
      s.history.push({ at, kind: j.kind, workSeconds: j.progress, fee: ch ? 20 : 0 });
      cancel(s, rule, networks, stacks, tools, at); s.history.pop(); receive(s, rule, c, at); h.completed?.(j.kind, j.tools);
    }
    if (!s.job) s.lastAt = to; register(s, networks); return true;
  }
  function register(s, networks) {
    if (!s || s.invalid) return;
    for (const r of s.sources) {
      const ch = channel(s, networks, r.id); if (!ch) continue;
      let a = ch.a.allocations.find(a => a.id === r.id);
      if (!a) ch.a.allocations.push(a = { id: r.id, kind: 'powerworksPartsAssessment', scope: 'Finite original local metrology service; no monopoly, municipal property or whole-institution coverage.' });
      a.reviewerId = ch.p.reviewer.id; a.benchId = ch.p.bench.id; a.assignment = ch.p.reviewer.assignment;
    }
  }
  return { SPEC, SCOPE, SECONDS, sources, create, normalize, rebind, target, own, fingerprint, measure, channel, local, review, begin, cancel, receive,
    permits, installed, savedTools, advance, register,
    trackedLot: (s, id) => Boolean(s && !s.invalid && (s.job?.inputs.some(i => i.id === id && i.key === 'metalParts') || s.assessments.some(a => a.stackId === id))),
    active: s => Boolean(s && !s.invalid && s.job), publicView: s => copy(s?.report) };
});
