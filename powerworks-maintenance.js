(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPowerworksMaintenance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const WORKFACE = Object.freeze({ x: 17, y: 16, z: 6 });
  const SECONDS = Object.freeze({ inspect: 120, repair: 600, learn: 1200, investigate: 1800 });
  const FEES = Object.freeze({ inspect: 12, repair: 60, learn: 120 });
  const COSTS = Object.freeze({ repair: { metalParts: 2, rubber: 1 }, investigate: { preparedManaCrystals: 1, assayReagent: 1 } });
  const SCOPE = 'One original powerworks regulator and its actual maintenance. Remote specialists guide the same municipal operator; internet contact transports no person or part. Paid inspection and transferable local methods are not sovereignty, monopoly, mandatory certification, divine endorsement or worldwide capability resolution.';
  const validSource = r => r && r.qualification === 'powerworksRegulatorDiagnostics'
    && ['id', 'branchId', 'networkId', 'cityId', 'powerId', 'populationSourceId', 'laboratoryId', 'label'].every(k => typeof r[k] === 'string' && r[k]);
  const able = a => a?.status === 'alive' && a.health >= 50 && a.workSeconds > 0;
  function sources(map, city, definitions) {
    const row = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === city?.cityId), h = map?.strategicNonStateNetworkHistory;
    const power = map?.strategicCapabilityHistory?.milestoneRows?.flatMap(m => m.infrastructureRows || [])
      .find(r => r.id === city?.powerId && r.cityId === city.cityId && r.function === 'powerWorks' && r.operationalAtPlayableYear);
    if (!h || !power || !row?.physicalJurisdictionExists || row.physicalCondition === 'ruined' || row.currentPopulation < 64
      || row.assetId !== city.populationSourceId || row.services?.communications === 'failed') return [];
    // One bounded ORIGINAL laboratory service allocation, not a technician
    // inferred from a rating, clerk, arbitrary branch label or new conflict.
    const candidates = h.branchRows.filter(b => b.currentCityId === city.cityId && b.publicPhysicalPresence
      && !b.consolidatedIntoBranchId && b.organizationForm === 'localLaboratory' && b.operationalStatus === 'active'
      && ['licensed', 'chartered'].includes(b.currentStanding) && !['ruined', 'destroyed'].includes(b.physicalCondition)
      && ['functional', 'strong', 'regionalHub'].includes(b.currentCapacityBand)).filter(b => {
      const n = h.networkRows.find(n => n.networkId === b.networkId), def = definitions?.find(d => d.id === n?.sourceDefinitionId);
      return n?.category === 'research' && n.organizationalContinuity && !['defunct', 'dormant'].includes(n.lifecycleStatus)
        && def?.roles.includes('peerReview') && def.roles.some(r => ['controlledFieldReview', 'hazardReview'].includes(r));
    }).sort((a, b) => a.id.localeCompare(b.id)).slice(0, Math.floor(row.currentPopulation / 64));
    return candidates.map(b => ({ id: `${b.id}:${power.id}:original-regulator-service`, branchId: b.id, networkId: b.networkId,
      cityId: city.cityId, powerId: power.id, populationSourceId: city.populationSourceId, laboratoryId: b.id, label: b.publicName,
      qualification: 'powerworksRegulatorDiagnostics',
      methodPolicy: definitions.find(d => d.id === h.networkRows.find(n => n.networkId === b.networkId)?.sourceDefinitionId)?.roles.includes('restrictedArchive') ? 'restrictedArchive' : 'paidTransfer',
      provenance: 'Original local licensed controlled-field laboratory serving an original operational powerworks; one distinct specialist and bench allocated once within finite source population.' }));
  }
  function create(rows, rule, at) {
    if (!rule?.powerMaintenance || !rule.worldId || !rule.runId || !Array.isArray(rows) || !rows.every(validSource)
      || rows.some(r => r.cityId !== rule.source.cityId || r.powerId !== rule.source.powerId || r.populationSourceId !== rule.source.populationSourceId)) return null;
    return { worldId: rule.worldId, runId: rule.runId, id: `${rule.id}:technical-maintenance`, ruleId: rule.id, powerId: rule.source.powerId,
      lastAt: at, serial: 0, sources: copy(rows), providers: rows.map(r => ({ sourceId: r.id, accepting: true,
        technician: { id: `${r.branchId}:original-regulator-specialist`, populationSourceId: r.populationSourceId,
          qualification: r.qualification, status: 'alive', health: 100, workSeconds: 14400, assignment: null },
        bench: { id: `${r.laboratoryId}:original-regulator-bench`, condition: 100, workSeconds: 14400 },
        receipts: [] })), job: null, inspection: null, method: null, history: [], report: null };
  }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !s.id || !s.ruleId || !s.powerId || !s.worldId || !s.runId || !Number.isFinite(s.lastAt) || s.lastAt < 0
      || !Array.isArray(s.sources) || !s.sources.every(validSource) || !Array.isArray(s.providers)
      || s.providers.length !== s.sources.length || new Set(s.sources.map(r => r.id)).size !== s.sources.length
      || new Set(s.providers.map(p => p.sourceId)).size !== s.providers.length
      || !Array.isArray(s.history) || s.providers.some(p => !s.sources.some(r => r.id === p.sourceId)
        || !p.technician?.id || p.technician.qualification !== 'powerworksRegulatorDiagnostics' || !p.bench?.id
        || ![p.technician.health, p.technician.workSeconds, p.bench.condition, p.bench.workSeconds].every(n => Number.isFinite(n) && n >= 0)
        || p.technician.health > 100 || p.technician.workSeconds > 14400 || p.bench.condition > 100 || p.bench.workSeconds > 14400
        || !Array.isArray(p.receipts))
      || s.method && (s.method.powerId !== s.powerId || !Number.isFinite(s.method.at) || !s.method.sourceId)
      || s.job && (!SECONDS[s.job.kind] || !Number.isFinite(s.job.progress) || s.job.progress < 0 || s.job.progress > SECONDS[s.job.kind]
        || !Array.isArray(s.job.inputs) || !Array.isArray(s.job.tools) || s.job.tools.length !== 3
        || !Number.isInteger(s.job.toolWearBlocks) || s.job.toolWearBlocks !== Math.ceil(s.job.progress / 600)
        || s.job.fee !== (s.job.providerId ? FEES[s.job.kind] : 0))) return { worldId: s.worldId || '', runId: s.runId || '', invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, worldId: to.worldId, runId: to.runId } : null; }
  const target = (s, rule) => Boolean(s && !s.invalid && bound(s, rule) && rule.id === s.ruleId && rule.source.powerId === s.powerId
    && rule.powerMaintenance && !rule.powerMaintenance.accountLost);
  const source = (s, id) => s.sources.find(r => r.id === id);
  function channel(s, networks, id) {
    const r = source(s, id), p = s.providers.find(p => p.sourceId === id), a = networks?.accounts?.find(a => a.id === r?.branchId && !a.lost);
    return bound(s, networks) && p && a?.source.hostId === a.id && a.source.networkId === r.networkId
      && a.source.populationSourceId === r.populationSourceId && a.source.cityId === r.cityId ? { r, p, a } : null;
  }
  function local(s, rule, c) {
    return Boolean(target(s, rule) && c.alive && c.capable && c.local && c.atWorkface && c.workAccessible && c.authority
      && c.sourceCurrent && c.institutionsAvailable && !c.otherBusy && !c.violence && !rule.command && !rule.recharge);
  }
  const own = (i, claim = '') => i && i.carriedBy === 'scientist' && i.quantity > 0 && !i.cityOwnerId && !i.civicCustody
    && (!i.ownerId || i.ownerId === 'scientist') && (!i.legalOwnerId || i.legalOwnerId === 'scientist')
    && !i.containerId && !i.fixtureId && !i.carryTaskId && !i.chemicalBatch && !i.biology && !i.contents?.length
    && !i.tags?.some(t => /contaminated|stolen/i.test(t)) && (!i.reservedTaskId || i.reservedTaskId === claim);
  function instruments(tools, c, claim = '') {
    return ['environmentalSurveyKit', 'thaumometer', 'masonryHammer'].map(key => tools.find(t => t.key === key && own(t.stack, claim)
      && t.stack.quantity === 1 && t.tool?.id === t.stack.toolInstanceId && t.tool.carriedBy === 'scientist'
      && t.tool.current >= 2 && (!t.tool.reservedTaskId || t.tool.reservedTaskId === claim)
      && (key === 'masonryHammer' || c.calibrations?.[t.tool.id] >= 65)));
  }
  function inspectionCurrent(s, rule, at) {
    return Boolean(s.inspection && s.inspection.powerId === s.powerId && s.inspection.at <= at
      && at - s.inspection.at <= 86400 && Math.abs(s.inspection.condition - rule.powerMaintenance.condition) < 2
      && s.inspection.repaired === rule.powerMaintenance.repaired);
  }
  function begin(s, rule, networks, c, kind, providerId, stacks, tools, wallet, at) {
    if (!SECONDS[kind] || !local(s, rule, c) || s.job || rule.operatorServiceAssignment || !(c.stamina > 0)) return false;
    const remote = Boolean(providerId), ch = remote ? channel(s, networks, providerId) : null, seconds = SECONDS[kind];
    if (remote && (!c.channelAvailable || !ch || !ch.p.accepting || !able(ch.p.technician) || ch.p.technician.assignment || ch.p.bench.condition < 50
      || ch.p.technician.workSeconds < seconds || ch.p.bench.workSeconds < seconds || ch.a.operator.status !== 'alive'
      || ch.a.operator.assignment || ch.a.operator.workSeconds < seconds || ch.a.terminal.powerSeconds < seconds
      || !ch.a.source.charter.scope.includes('ownNewContracts') || wallet.money < FEES[kind] || kind === 'investigate'
      || kind === 'learn' && ch.r.methodPolicy !== 'paidTransfer'
      || rule.operatorWorkSeconds < seconds)) return false;
    if (!remote && (kind === 'learn' || !['materialsScience', 'analysis'].every(k => c.skills?.[k] >= (kind === 'investigate' ? 40 : 20)))) return false;
    if (!remote && kind === 'repair' && s.method?.powerId !== s.powerId) return false;
    if (['repair', 'learn', 'investigate'].includes(kind) && !inspectionCurrent(s, rule, at)) return false;
    if (kind === 'repair' && rule.powerMaintenance.condition >= 99.99 || ['learn', 'investigate'].includes(kind) && s.method) return false;
    const kit = instruments(tools, c);
    if (kit.some(t => !t)) return false;
    const inputs = [];
    for (const [key, quantity] of Object.entries(COSTS[kind] || {})) {
      const i = stacks.find(i => i.key === key && i.section === 'resources' && own(i) && i.quantity >= quantity);
      if (!i) return false; inputs.push({ id: i.id, key, quantity });
    }
    const id = `${s.id}:work:${++s.serial}`;
    s.job = { id, kind, providerId: providerId || null, charterId: ch?.a.source.charter.id || null,
      handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch, at, progress: 0, toolWearBlocks: 0, fee: remote ? FEES[kind] : 0, paid: false,
      inputs, tools: kit.map(t => ({ id: t.tool.id, stackId: t.stack.id, key: t.key })), cell: copy(c.cell) };
    for (const i of inputs) stacks.find(s => s.id === i.id).reservedTaskId = id;
    for (const t of kit) { t.stack.reservedTaskId = id; t.tool.reservedTaskId = id; }
    if (kind === 'repair') rule.powerMaintenance.repairAssignment = id;
    if (ch) { ch.p.technician.assignment = id; ch.a.operator.assignment = id; rule.operatorServiceAssignment = id; }
    return true;
  }
  function cancel(s, rule, networks, stacks, tools, at) {
    const j = s?.job; if (!j) return false;
    for (const i of stacks) if (i.reservedTaskId === j.id) delete i.reservedTaskId;
    for (const t of tools) if (t.tool?.reservedTaskId === j.id) delete t.tool.reservedTaskId;
    const ch = j.providerId && channel(s, networks, j.providerId);
    if (ch?.p.technician.assignment === j.id) ch.p.technician.assignment = null;
    if (ch?.a.operator.assignment === j.id) ch.a.operator.assignment = null;
    if (rule.operatorServiceAssignment === j.id) rule.operatorServiceAssignment = null;
    if (rule.powerMaintenance.repairAssignment === j.id) delete rule.powerMaintenance.repairAssignment;
    s.history.push({ at, kind: 'interrupted', workSeconds: j.progress, fee: j.paid ? j.fee : 0 }); s.job = null; return true;
  }
  function receive(s, rule, c, at) {
    if (!local(s, rule, c) || s.job) return false;
    s.report = { at, powerId: s.powerId, condition: s.inspection?.condition ?? null, measuredAt: s.inspection?.at ?? null,
      inspection: copy(s.inspection), method: copy(s.method), history: copy(s.history), scope: SCOPE };
    return true;
  }
  function register(s, networks) {
    if (!s || s.invalid) return;
    for (const r of s.sources) {
      const ch = channel(s, networks, r.id); if (!ch) continue;
      let a = ch.a.allocations.find(a => a.id === r.id);
      if (!a) ch.a.allocations.push(a = { id: r.id, kind: 'powerworksTechnicalService', external: true });
      a.technicianId = ch.p.technician.id; a.benchId = ch.p.bench.id; a.powerId = s.powerId;
      a.assignment = ch.p.technician.assignment; a.scope = 'One original local diagnostic allocation only; not wider institutional research capacity, city ownership or mandatory certification.';
    }
  }
  function savedTools(s, rule, stacks) {
    const j = target(s, rule) && s.job;
    if (!j || j.tools.length !== 3 || new Set(j.tools.map(t => t.id)).size !== 3
      || j.handoverId !== rule.handoverId || !j.inputs.every(r => stacks.some(i => i.id === r.id && i.key === r.key
        && own(i, j.id) && i.reservedTaskId === j.id && i.quantity >= r.quantity))) return [];
    return j.tools.filter(t => stacks.some(i => i.id === t.stackId && i.toolInstanceId === t.id && i.key === t.key
      && i.quantity === 1 && own(i, j.id) && i.reservedTaskId === j.id)).map(t => t.id);
  }
  function advance(s, rule, networks, context, to, h) {
    if (!target(s, rule) || !h.alive() || to <= s.lastAt) return false;
    // Idle time grants neither wear backfill, duty recovery nor new reports.
    if (!s.job) { s.lastAt = to; register(s, networks); return false; }
    while (s.lastAt < to && h.alive()) {
      const dt = Math.min(1, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      const j = s.job; if (!j) { s.lastAt = to; break; }
      const c = context(), stacks = h.stacks(), tools = h.tools(), ch = j.providerId && channel(s, networks, j.providerId);
      const actualTools = j.tools.map(r => tools.find(t => t.stack.id === r.stackId && t.tool?.id === r.id)).filter(Boolean);
      const inputs = j.inputs.every(r => stacks.some(i => i.id === r.id && i.key === r.key && own(i, j.id) && i.reservedTaskId === j.id && i.quantity >= r.quantity));
      const remoteReady = !j.providerId || ch && ch.p.accepting && able(ch.p.technician) && ch.p.technician.assignment === j.id
        && ch.p.bench.condition >= 50 && ch.p.bench.workSeconds >= dt && ch.a.operator.status === 'alive'
        && ch.a.operator.assignment === j.id && ch.a.operator.workSeconds >= dt && ch.a.terminal.powerSeconds >= dt
        && ch.a.source.charter.id === j.charterId && ch.a.source.charter.scope.includes('ownNewContracts')
        && rule.operatorServiceAssignment === j.id && rule.operatorWorkSeconds >= dt && c.channelAvailable;
      const kitReady = actualTools.length === 3 && instruments(actualTools, c, j.id).every(Boolean);
      if (!local(s, rule, c) || j.bodyEpoch !== c.bodyEpoch || j.handoverId !== rule.handoverId
        || !['x', 'y', 'z'].every(k => j.cell[k] === c.cell[k]) || !inputs || !kitReady || !remoteReady
        || !j.providerId && !['materialsScience', 'analysis'].every(k => c.skills?.[k] >= (j.kind === 'investigate' ? 40 : 20))
        || !j.paid && c.wallet.money < j.fee || c.stamina < dt / 120) {
        cancel(s, rule, networks, stacks, tools, at); continue;
      }
      if (ch && (ch.a.operator.lastOperatingWorkAt >= at || rule.operatorWorkedUntil >= at)) continue;
      if (ch && c.communicate && !c.communicate({ purpose: 'technicalGuidance', sessionId: j.id,
        sequence: Math.ceil(j.progress + dt), fromCityId: rule.source.cityId, toCityId: ch.r.cityId, civicCityIds: [rule.source.cityId], signer: 'city',
        charterId: rule.source.charterId, handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch }, at)) {
        j.hold = 'Awaiting supported authenticated communication; no remote work was performed.'; continue;
      }
      delete j.hold;
      if (!j.paid) {
        c.wallet.money -= j.fee; if (ch) {
          ch.a.money += j.fee; ch.p.receipts.push({ at, jobId: j.id, amount: j.fee });
          ch.a.income ||= []; ch.a.income.push({ at, id: j.id, purpose: 'powerworksTechnicalService', amount: j.fee });
        }
        j.paid = true; // Earned commencement fee; interruption is not free work.
      }
      if (ch) {
        ch.p.technician.workSeconds -= dt; ch.p.bench.workSeconds -= dt;
        ch.a.operator.workSeconds -= dt; ch.a.terminal.powerSeconds -= dt; ch.a.operator.lastOperatingWorkAt = at;
        rule.operatorWorkSeconds -= dt; rule.operatorWorkedUntil = at;
      }
      // Tool durability is an integer in the shared save format. Charge each
      // commenced ten-minute work block once, retaining the block counter on
      // interruption/reload rather than losing fractional wear to rounding.
      const blocks = Math.floor(j.progress / 600) + 1, wear = blocks - j.toolWearBlocks;
      if (wear > 0) { for (const t of actualTools) t.tool.current -= wear; j.toolWearBlocks = blocks; }
      h.work(dt / 120); j.progress += dt;
      if (j.progress + 1e-7 < SECONDS[j.kind]) continue;
      for (const r of j.inputs) {
        const i = stacks.find(i => i.id === r.id); i.quantity -= r.quantity;
        i.knownQuantity = Math.min(i.knownQuantity ?? i.quantity, i.quantity);
      }
      if (j.kind === 'inspect') s.inspection = { at, powerId: s.powerId, condition: rule.powerMaintenance.condition,
        repaired: rule.powerMaintenance.repaired, fault: 'Regulator alignment and worn conductor seals', providerId: j.providerId };
      if (j.kind === 'repair') {
        const restored = Math.min(25, 100 - rule.powerMaintenance.condition);
        rule.powerMaintenance.condition += restored; rule.powerMaintenance.repaired += restored;
        s.inspection = { at, powerId: s.powerId, condition: rule.powerMaintenance.condition,
          repaired: rule.powerMaintenance.repaired, fault: 'Post-repair regulator test', providerId: j.providerId };
      }
      if (['learn', 'investigate'].includes(j.kind)) s.method = { at, powerId: s.powerId, sourceId: j.providerId || 'personal-reproducible-investigation',
        scope: 'Regulator inspection and material-backed repair at this original powerworks; retained knowledge, not bodily skill or certification.' };
      s.history.push({ at, kind: j.kind, jobId: j.id, providerId: j.providerId, workSeconds: j.progress, fee: j.fee });
      // Release claims without fabricating an interruption or refund.
      const history = s.history; cancel(s, rule, networks, stacks, tools, at); history.pop();
      receive(s, rule, c, at); h.completed?.(j.kind, j.tools);
    }
    s.history = s.history.slice(-100); register(s, networks); return true;
  }
  return { WORKFACE, SECONDS, FEES, COSTS, SCOPE, bound, sources, validSource, create, normalize, rebind, target, channel,
    begin, cancel, receive, register, savedTools, advance, active: s => Boolean(s && !s.invalid && s.job), publicView: s => copy(s?.report) };
});
