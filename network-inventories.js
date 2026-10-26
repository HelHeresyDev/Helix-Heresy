(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./strategic-non-state-networks') : root.HelixStrategicNonStateNetworks);
  if (node) module.exports = api;
  if (root) root.HelixNetworkInventories = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Networks) {
  'use strict';
  const FAMILIES = ['finance', 'research', 'transport', 'armedForce', 'mediaReach', 'certification', 'covertAccess'];
  const SERVICES = ['passenger', 'mechanic', 'porter', 'escort', 'workspace', 'protection', 'interdiction', 'maintenance', 'standards', 'communications'];
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const id = x => typeof x === 'string' && x.length > 0;
  const rowsOf = x => Array.isArray(x) ? x.filter(r => r && typeof r === 'object') : [];
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const stable = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  const people = (qualification = 'recordkeeping') => ({ status: 'alive', health: 100, fatigue: 0,
    qualification, workSeconds: 14400, assignment: null });
  const apparatus = () => ({ condition: 100, workSeconds: 14400, assignment: null });
  const room = cityId => `foreign-assay-${String(cityId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const compatible = (value, original) => original == null ? true : typeof original === 'number'
    ? typeof value === 'number' && Number.isFinite(value) && value >= 0 : Array.isArray(original) ? Array.isArray(value)
      : typeof original === 'object' ? Boolean(value && typeof value === 'object'
        && Object.keys(original).every(k => compatible(value[k], original[k]))) : typeof value === typeof original;
  // Authored original allotments, NOT multipliers of capacity, wealth ratings,
  // player strength, elapsed play or an exhausted earlier service allocation.
  function recipe(source, category, roles) {
    const r = source.original, b = source.sourceId, rows = [];
    const add = (suffix, kind, families, state, persons = 0, service = null, exactId = null) =>
      rows.push({ id: exactId || `${b}:${suffix}`, ownerId: source.id, networkId: source.networkId,
        kind, families, initial: state, people: persons, service });
    const worker = (suffix, qualification, family, service) => add(suffix, 'person', [family], people(qualification), 1, service);
    const device = (suffix, family, service) => add(suffix, 'apparatus', [family], apparatus(), 0, service);
    const archive = family => add(`${family}-records`, 'archive', [family], { condition: 100, access: 'ownerOnly',
      entries: [{ id: `${b}:${family}:original-protocol`, topic: `${family} local operating and custody notes`, access: 'ownerOnly' }],
      copyingWorkSeconds: 7200, grantsMethodsOrCredentials: false });
    const money = value => add('non-office-reserve', 'funds', ['finance'], { money: value, held: 0, ledger: [] });
    const stocks = quantities => add('original-stores', 'stock', ['finance'], { quantities, reservations: [] });
    if (source.kind === 'affiliate') {
      const activity = r.declaredActivity;
      const families = { chemicalSupply: 'research', technicalConsulting: 'research', freightBrokerage: 'transport', dataServices: 'mediaReach',
        equipmentLeasing: 'finance', riskManagement: 'finance', orbitalTelemetry: 'mediaReach' };
      if (!families[activity]) return null;
      money(180); worker('original-employee', activity, families[activity]); archive(families[activity]);
      if (activity === 'chemicalSupply') stocks({ assayReagent: 6, glass: 4 });
      if (activity === 'equipmentLeasing') stocks({ masonryHammer: 1, metalParts: 4 });
      if (['dataServices', 'freightBrokerage'].includes(activity)) add('original-terminal', 'terminal', ['mediaReach'], { condition: 100, powerSeconds: 7200 });
      // Telemetry business registration alone supplies neither a satellite nor
      // a contracted receiver. The source carries a specific unresolved gap.
      return rows;
    }
    if (source.kind === 'covertCell') {
      if (!['brokerCell', 'smugglingCoordinator', 'launderingOffice', 'informantExchange'].includes(r.kind)) return null;
      money(120); worker('original-local-operator', r.kind, 'covertAccess'); archive('covertAccess');
      add('original-private-terminal', 'terminal', ['covertAccess', 'mediaReach'], { condition: 100, powerSeconds: 7200 });
      add('own-correspondence-access', 'access', ['covertAccess'], { principalId: source.id,
        targetId: `${b}:original-private-terminal`, scope: 'Own local correspondence only', credential: null,
        governmentAccess: false, carrierRights: false, counterparties: [], commitments: [] });
      return rows;
    }
    const form = r.organizationForm;
    if (!['registeredOffice', 'localLaboratory', 'contractDepot', 'escortChapter', 'relayStudio', 'standardsBureau',
      'brokerFront', 'covertMarketCell', 'launchOffice', 'orbitalRelayGateway', 'trainingHall', 'memberForum'].includes(form)) return null;
    money(category === 'commercial' ? 1200 : 240);
    archive(category === 'research' ? 'research' : category === 'standards' ? 'certification' : 'finance');
    if (category === 'commercial' && roles.includes('equipmentLeasing')) stocks({ masonryHammer: 1, metalParts: 4 });
    if (form === 'localLaboratory' && category === 'research') {
      worker('original-researcher', 'manualLaboratoryAnalysis', 'research'); device('original-research-apparatus', 'research');
      stocks({ assayReagent: 4, glass: 2 });
      // The existing workspace representative is not an extra researcher.
      worker('assay-representative', 'workspaceRepresentation', 'research', 'workspace');
      add('workspace-property', 'premises', ['research'], { condition: 100 }, 0, 'workspace', room(r.currentCityId));
      add('workspace-bench', 'apparatus', ['research'], { condition: 100 }, 0, 'workspace', `${room(r.currentCityId)}-bench`);
      if (roles.includes('peerReview') && roles.some(x => ['controlledFieldReview', 'hazardReview'].includes(x))) {
        worker('original-regulator-specialist', 'powerworksRegulatorDiagnostics', 'research', 'maintenance');
        device('original-regulator-bench', 'research', 'maintenance');
      }
    }
    if (form === 'contractDepot' && category === 'transport') {
      worker('passenger-driver', 'roadPassengerDriving', 'transport', 'passenger');
      add('passenger-road-car', 'vehicle', ['transport'], { condition: 100, fuelKm: 2400, cargoKg: 20, cargoL: 40 }, 0, 'passenger');
      add('passenger-service', 'serviceReserve', ['transport'], { provisionsSeconds: 96 * 3600 }, 0, 'passenger');
      worker('callout-mechanic', 'roadVehicleMaintenance', 'transport', 'mechanic');
      add('mechanic-toolkit', 'equipment', ['transport'], { condition: 100, massKg: 6, volumeL: 6 }, 0, 'mechanic');
      add('mechanic-duty', 'serviceReserve', ['transport'], { workSeconds: 8 * 3600 }, 0, 'mechanic');
      worker('field-porter', 'noncombatHauling', 'transport', 'porter');
      add('porter-duty', 'serviceReserve', ['transport'], { dutySeconds: 8 * 3600 }, 0, 'porter');
      add('porter-supplies', 'stock', ['transport'], { drinkingWater: 3, trailMeal: 2 }, 0, 'porter');
      stocks({ metalParts: 4 });
    }
    if (form === 'escortChapter' && category === 'military') {
      worker('protective-duty-professional', 'personalProtection', 'armedForce', 'protection');
      rows.at(-1).initial = { ...rows.at(-1).initial, workSeconds: 43200, foodSeconds: 43200, waterSeconds: 43200 };
      add('protective-kit', 'equipment', ['armedForce'], { batonCondition: 100, vestCondition: 100 }, 0, 'protection');
      worker('field-survey-professional', 'lawfulSurveyProtection', 'armedForce', 'escort');
      add('survey-duty', 'serviceReserve', ['armedForce'], { dutySeconds: 43200 }, 0, 'escort');
      add('survey-supplies', 'stock', ['armedForce'], { escortBaton: 1, escortVest: 1, drinkingWater: 4, trailMeal: 3,
        medicalBandage: 3, neutralizingWash: 1, fieldShelter: 1 }, 0, 'escort');
      for (const i of [1, 2]) {
        worker(`original-field-team:${i}`, 'limitedFieldProtection', 'armedForce', 'interdiction');
        rows.at(-1).initial = { ...rows.at(-1).initial, workSeconds: 43200, foodSeconds: 43200, waterSeconds: 43200,
          fieldKit: { toolCondition: 100, vestCondition: 100 } };
      }
      add('original-field-team', 'serviceReserve', ['armedForce'], { radioSeconds: 3600 }, 0, 'interdiction');
      worker('original-reserve-professional', 'localDefensiveDuty', 'armedForce');
      add('original-reserve-kit', 'equipment', ['armedForce'], { toolCondition: 100, vestCondition: 100 });
    }
    if (form === 'trainingHall' && category === 'military') worker('original-instructor', 'ordinaryProtectiveTraining', 'armedForce');
    if (form === 'relayStudio' && category === 'media') {
      worker('original-editor', 'editorialWork', 'mediaReach'); archive('mediaReach');
      add('original-broadcast-console', 'terminal', ['mediaReach'], { condition: 100, powerSeconds: 7200, acceptedMessages: [] });
    }
    if (form === 'standardsBureau' && category === 'standards') {
      worker('original-material-metrologist', 'regulatorMaterialMetrology', 'certification', 'standards');
      device('original-material-review-bench', 'certification', 'standards');
    }
    if (category === 'research' && ['memberForum', 'standardsBureau'].includes(form)) {
      worker('original-peer-reviewer', 'researchProtocolReview', 'research');
      if (form === 'standardsBureau') device('original-protocol-review-apparatus', 'certification');
    }
    if (['brokerFront', 'covertMarketCell'].includes(form) && category === 'blackMarket') {
      worker('original-broker', 'localBrokerage', 'covertAccess'); archive('covertAccess');
      add('original-private-terminal', 'terminal', ['covertAccess', 'mediaReach'], { condition: 100, powerSeconds: 7200 });
      add('own-correspondence-access', 'access', ['covertAccess'], { principalId: source.id, targetId: `${b}:original-private-terminal`,
        scope: 'Own local correspondence only', credential: null, governmentAccess: false, carrierRights: false,
        counterparties: [], commitments: [] });
    }
    return rows;
  }
  function plan(map, source) {
    if (!source?.capabilityBaseline) return null;
    const original = source.capabilityBaseline.rows, assets = [], owners = [];
    const cities = new Map((map?.strategicPlayableSettlementState?.cityRows || []).map(c => [c.cityId, c]));
    const definitions = new Map((Networks?.NETWORK_DEFINITIONS || []).map(d => [d.id, d]));
    const budgets = new Map([...cities.values()].map(c => [c.cityId, { people: Math.floor(c.currentPopulation / 4),
      premises: Math.floor(c.currentPopulation / 16), usedPeople: 0, usedPremises: 0 }]));
    for (const b of source.branches.filter(b => b.allocated && b.hostId === b.id)) {
      const budget = budgets.get(b.cityId); if (budget) { budget.usedPeople++; budget.usedPremises++; }
    }
    for (const row of [...original].sort((a, b) => a.id.localeCompare(b.id))) {
      const r = row.original, network = original.find(n => n.kind === 'network' && n.networkId === row.networkId);
      const definition = definitions.get(network?.original.sourceDefinitionId), branch = source.branches.find(b => b.id === row.sourceId);
      const cityId = row.kind === 'branch' ? r.currentCityId : row.kind === 'affiliate' ? r.registrationCityId : r.cityId;
      const city = cities.get(cityId), budget = budgets.get(cityId);
      const owner = { id: row.id, networkId: row.networkId, kind: row.kind, cityId: cityId || null,
        populationSourceId: city?.assetId || null, hostId: branch?.hostId || null, assetIds: [], gaps: [],
        existingReferences: branch?.allocated && branch.hostId === branch.id ? [
          { id: branch.id, kind: 'premises', families: ['finance'], field: 'source' },
          { id: `${branch.id}:working-capital`, kind: 'funds', families: ['finance'], field: 'money' },
          { id: `${branch.id}:original-desk-operator`, kind: 'person', families: ['finance'], field: 'operator' },
          { id: `${branch.id}:original-office-terminal`, kind: 'terminal', families: ['mediaReach'], field: 'terminal' }
        ] : [],
        continuity: r.lifecycleStatus || r.operationalStatus || r.status || 'unknown',
        controller: row.kind === 'branch' ? copy(branch?.charter) : { mode: 'independentOwner', controllerId: row.id,
          beneficialParentId: row.networkId, scope: ['ownExistingAssetsOnly'], delegation: null } };
      owners.push(owner);
      if (row.kind === 'network') {
        owner.members = original.filter(s => s.kind !== 'network' && s.networkId === row.networkId).map(s => s.id);
        if (!r.organizationalContinuity || ['dormant', 'defunct'].includes(r.lifecycleStatus))
          owner.gaps.push('Original network continuity, surviving claims and control remain unverified');
        continue;
      }
      if (row.kind === 'branch' && branch?.hostId !== branch?.id) { owner.sharedHost = `branch:${branch.hostId}`; continue; }
      if (!city?.assetId || !city.physicalJurisdictionExists || city.physicalCondition === 'ruined'
        || !Number.isFinite(city.currentPopulation) || city.currentPopulation < 16) { owner.gaps.push('Original populated premises unavailable; surviving property/claims unverified'); continue; }
      if (!definition) { owner.gaps.push('Original function definition missing'); continue; }
      if (row.kind === 'branch' && !definition.branchForms.includes(r.organizationForm)) {
        owner.gaps.push('Original premises form is unsupported for this function definition'); continue;
      }
      if (['dormant', 'defunct', 'destroyed', 'dissolved', 'consolidated'].includes(owner.continuity)) {
        owner.gaps.push('Historical inactivity does not settle surviving assets, claims or control; no fresh staff/reserve is issued'); continue;
      }
      if (row.kind === 'branch' && ['ruined', 'destroyed'].includes(r.physicalCondition)) {
        owner.gaps.push('Original premises lost; surviving reserves, claims and personnel unverified'); continue;
      }
      const rows = recipe(row, network.original.category, definition.roles);
      if (!rows) { owner.gaps.push('Original function has no supported inventory recipe'); continue; }
      const needed = rows.reduce((n, a) => n + a.people, 0), ownsOffice = branch?.allocated && branch.hostId === branch.id;
      if (budget.usedPeople + needed > budget.people || !ownsOffice && budget.usedPremises + 1 > budget.premises) {
        owner.gaps.push('Shared original city population/premises budget cannot support this allocation'); continue;
      }
      if (new Set(rows.map(a => a.id)).size !== rows.length || rows.some(a => assets.some(b => b.id === a.id))) {
        owner.gaps.push('Conflicting original asset identity'); continue;
      }
      budget.usedPeople += needed; if (!ownsOffice) budget.usedPremises++;
      owner.premisesId = ownsOffice ? branch.id : `${row.sourceId}:original-premises`;
      if (!ownsOffice) rows.push({ id: owner.premisesId, ownerId: row.id, networkId: row.networkId, kind: 'premises',
        families: ['finance'], initial: { condition: 100 }, people: 0, service: null });
      for (const a of rows) { a.cityId = cityId; a.populationSourceId = city.assetId; assets.push(a); owner.assetIds.push(a.id); }
      if (r.declaredActivity === 'orbitalTelemetry' || ['launchOffice', 'orbitalRelayGateway'].includes(r.organizationForm))
        owner.gaps.push('Exceptional commissioned means and access require the retained infrastructure owner reconciliation');
    }
    // Explicit coverage of ordinary, non-physical service interfaces. The
    // existing commissioning consumer still establishes usability and terms.
    const infrastructure = map?.strategicCapabilityHistory?.milestoneRows?.flatMap(m => m.infrastructureRows || []) || [];
    for (const owner of owners.filter(o => o.kind === 'branch' && o.premisesId && !o.sharedHost)) {
      const n = original.find(r => r.kind === 'network' && r.networkId === owner.networkId), d = definitions.get(n?.original.sourceDefinitionId);
      const b = original.find(r => r.id === owner.id)?.original;
      const gateway = infrastructure.find(r => r.cityId === owner.cityId && r.operationalAtPlayableYear
        && r.function === 'orbitalControlGateway');
      const activated = map?.strategicNonStateNetworkHistory?.eventRows?.some(e => e.kind === 'advancedServiceActivated'
        && e.networkIds?.includes(owner.networkId) && e.exactFactors?.capabilityId === 'orbitalArcaneRelayMesh');
      if (n?.original.category === 'media' && d?.roles.includes('relayOperations') && gateway && activated
        && b.organizationForm === 'orbitalRelayGateway' && ['licensed', 'chartered'].includes(b.currentStanding)
        && b.operationalStatus === 'active' && b.publicPhysicalPresence && cities.get(owner.cityId).currentPopulation >= 64) {
        const a = { id: `${owner.id.slice(7)}:original-data-interface`, ownerId: owner.id, networkId: owner.networkId,
          cityId: owner.cityId, populationSourceId: owner.populationSourceId, kind: 'interface', families: ['mediaReach'],
          infrastructureId: gateway.id, accessScope: 'Original local interface, not ownership of its shared backbone',
          initial: { condition: 100, powerSeconds: cities.get(owner.cityId).services?.communications === 'failed' ? 0 : 14400 }, people: 0, service: 'communications' };
        owner.assetIds.push(a.id); assets.push(a);
      }
    }
    return { owners, assets, budgets: [...budgets].map(([cityId, budget]) => ({ cityId, ...budget })),
      policy: 'Fixed authored original inventories; shared city allocation ceiling, no capacity/threat scaling or inferred command' };
  }
  function validPlan(p, base) {
    return Boolean(p && Array.isArray(p.owners) && Array.isArray(p.assets) && Array.isArray(p.budgets)
      && p.owners.every(o => o && id(o.id) && id(o.networkId) && Array.isArray(o.assetIds) && Array.isArray(o.gaps)
        && Array.isArray(o.existingReferences) && o.existingReferences.every(r => id(r.id) && Array.isArray(r.families)))
      && p.assets.every(a => a && id(a.id) && id(a.ownerId) && id(a.kind) && a.initial && Number.isInteger(a.people) && a.people >= 0
        && Array.isArray(a.families) && a.families.every(f => FAMILIES.includes(f))
        && p.owners.some(o => o.id === a.ownerId && o.networkId === a.networkId && o.assetIds.includes(a.id)))
      && p.owners.every(o => o.assetIds.every(id => p.assets.some(a => a.id === id && a.ownerId === o.id)))
      && new Set(p.owners.map(o => o.id)).size === p.owners.length && new Set(p.assets.map(a => a.id)).size === p.assets.length
      && (!base || base.rows.length === p.owners.length && base.rows.every(r => p.owners.some(o => o.id === r.id && o.networkId === r.networkId)))
      && p.budgets.every(b => ['people', 'premises', 'usedPeople', 'usedPremises'].every(k => Number.isFinite(b[k]) && b[k] >= 0)
        && b.usedPeople <= b.people && b.usedPremises <= b.premises));
  }
  function create(source, binding, fresh = false) {
    if (!id(binding?.worldId) || !id(binding.runId)) return null;
    const p = source?.inventoryPlan;
    return { worldId: binding.worldId, runId: binding.runId, mode: fresh && p ? 'original' : 'legacyUnknown',
      originals: copy(p?.assets || []).map(a => ({ id: a.id, ownerId: a.ownerId, kind: a.kind })),
      owners: copy(p?.owners || []), assets: fresh && p ? p.assets.map(a => ({ id: a.id, ownerId: a.ownerId,
        kind: a.kind, families: copy(a.families), state: copy(a.initial), ledger: 'inventory', external: null, lost: false })) : [],
      observed: [], conflict: false };
  }
  function normalize(s, plan) {
    if (!s || s.invalid || !id(s.worldId) || !id(s.runId) || !['original', 'legacyUnknown'].includes(s.mode)
      || !['originals', 'owners', 'assets', 'observed'].every(k => Array.isArray(s[k]))
      || !s.originals.every(a => a && id(a.id) && id(a.ownerId))
      || !s.owners.every(o => o && id(o.id) && id(o.networkId) && Array.isArray(o.gaps) && Array.isArray(o.assetIds))
      || !s.assets.every(a => a && id(a.id) && id(a.ownerId) && typeof a.lost === 'boolean' && Array.isArray(a.families)
        && s.originals.some(o => o.id === a.id && o.ownerId === a.ownerId && o.kind === a.kind)
        && (!plan || a.lost || a.ledger === 'service' || compatible(a.state, plan.assets.find(p => p.id === a.id)?.initial))
        && (!a.state || Object.values(a.state).every(v => typeof v !== 'number' || Number.isFinite(v) && v >= 0))
        && ['inventory', 'service'].includes(a.ledger) && (a.ledger === 'inventory' ? a.state && !a.external : !a.state && a.external))
      || ['originals', 'owners', 'assets'].some(k => new Set(s[k].map(a => a.id)).size !== s[k].length))
      return { worldId: s?.worldId || '', runId: s?.runId || '', invalid: true };
    return copy(s);
  }
  function rebind(s, from, to, plan) { s = normalize(s, plan); return bound(s, from) ? { ...s, worldId: to.worldId, runId: to.runId } : null; }
  function sync(operations) {
    if (!operations || operations.invalid) return;
    if (!operations.inventoriesInitialized && operations.inventories) operations.inventoriesInitialized = true;
    if (!operations.inventoriesInitialized) {
      operations.inventoriesInitialized = true;
      operations.inventories = create(operations.source, operations, false);
    }
    const s = operations.inventories;
    if (!s || s.invalid || !bound(s, operations)) return;
    const assets = new Map(s.assets.map(a => [a.id, a]));
    for (const original of s.originals) {
      const a = assets.get(original.id);
      if (!a && s.mode === 'original') s.assets.push({ ...copy(original), families: [], ledger: 'inventory',
        state: {}, external: null, lost: true });
      else if (a && (a.ownerId !== original.ownerId || a.kind !== original.kind)) s.conflict = true;
    }
  }
  // Constructor adapters describe where the SAME original resources go. No
  // contract, permission or service qualification is supplied by this mapping.
  function serviceRows(kind, m, fixture) {
    if (!m) return [];
    const b = m.source?.branchId, source = m.source;
    const row = (id, object) => ({ id, object, source, service: kind, cityId: source?.cityId || m.homeCityId || m.property?.cityId });
    if (kind === 'passenger') return [row(m.driver?.id || `${b}:passenger-driver`, m.driver), row(m.vehicle?.id || `${b}:passenger-road-car`, m.vehicle), row(`${b}:passenger-service`, m)];
    if (kind === 'mechanic') return [row(m.actor?.id || `${b}:callout-mechanic`, m.actor), row(m.toolkit?.id || `${b}:mechanic-toolkit`, m.toolkit), row(`${b}:mechanic-duty`, m)];
    if (kind === 'porter' || kind === 'escort') {
      const prefix = kind === 'porter' ? 'porter' : 'survey';
      return [row(m.actor?.id || source?.allocationId, m.actor), row(`${b}:${prefix}-duty`, m), row(`${b}:${prefix}-supplies`, m.inventorySupplies)];
    }
    if (kind === 'workspace') return [row(m.actor?.id || `${b}:assay-representative`, m.actor), row(m.property?.id || m.roomId, m.property), row(m.benchId, fixture)];
    if (kind === 'protection') return [row(m.actor?.id || source?.allocationId, m.actor), row(`${b}:protective-kit`, m.kit)];
    if (kind === 'interdiction') return rowsOf(m.units).flatMap(u => [row(u.id, u), ...rowsOf(u.actors).map(a => row(a.id, a))]
      .map(r => ({ ...r, source: u.source, cityId: u.source?.cityId })));
    if (kind === 'maintenance' || kind === 'standards') return rowsOf(m.providers).flatMap(p => {
      const src = rowsOf(m.sources).find(s => s.id === p.sourceId), worker = kind === 'maintenance' ? p.technician : p.reviewer;
      return [row(worker?.id, worker), row(p.bench?.id, p.bench)].map(r => ({ ...r, source: src, cityId: src?.cityId }));
    });
    if (kind === 'communications') return rowsOf(m.ports).filter(p => rowsOf(m.sources).find(r => r.id === p.id)?.kind === 'provider')
      .map(p => { const src = m.sources.find(r => r.id === p.id); return { ...row(p.id, p), source: src, cityId: src.cityId }; });
    return [];
  }
  function adopt(operations, kind, model, binding, fixture) {
    if (!model) return null;
    if (!SERVICES.includes(kind)) return null;
    if (!operations) return model;
    if (!bound(operations, binding) || operations.invalid) return null;
    sync(operations);
    const s = operations.inventories;
    if (s?.mode === 'legacyUnknown') return model;
    if (!s || s.invalid || s.conflict || !bound(s, operations)) return null;
    const supplies = ['porter', 'escort'].includes(kind) ? model.inventorySupplies || {} : null;
    const rows = serviceRows(kind, model, fixture).map(r => r.id?.endsWith('-supplies') && supplies ? { ...r, object: supplies } : r);
    const expected = operations.source.inventoryPlan?.assets || [];
    if (new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => {
      const a = s.assets.find(a => a.id === r.id), p = expected.find(a => a.id === r.id);
      return !r.object || !a || !p || a.lost || a.ledger !== 'inventory' || !compatible(a.state, p.initial) || a.ownerId !== `branch:${r.source?.branchId}`
        || p.service !== kind || p.cityId !== r.cityId
        || p.kind === 'premises' && r.object.cityId !== p.cityId
        || p.populationSourceId !== (r.source.populationId || r.source.populationSourceId)
        || r.source.networkId && r.source.networkId !== p.networkId;
    })) return null;
    if (supplies) model.inventorySupplies = supplies;
    for (const r of rows) {
      const a = s.assets.find(a => a.id === r.id);
      Object.assign(r.object, copy(a.state));
      a.state = null; a.ledger = 'service'; a.external = { service: kind, assetId: r.id };
    }
    return model;
  }
  function eligibleSources(operations, kind, rows) {
    if (!operations || operations.inventories?.mode === 'legacyUnknown') return rows;
    const s = operations.inventories;
    if (!s || s.invalid || s.conflict) return [];
    return rows.filter(r => {
      if (r.kind === 'municipal') return true;
      const assets = (operations.source.inventoryPlan?.assets || []).filter(a => a.ownerId === `branch:${r.branchId}` && a.service === kind);
      return assets.length > 0 && assets.every(a => s.assets.some(v => v.id === a.id && !v.lost && v.ledger === 'inventory'));
    });
  }
  function takeSupplies(model, keys, fallback) {
    if (!model.inventorySupplies) return fallback;
    return keys.map(key => { const n = model.inventorySupplies[key] || 0; model.inventorySupplies[key] = 0; return [key, n]; }).filter(([, n]) => n > 0);
  }
  function observe(operations, run, binding, alive = true) {
    if (!alive || !bound(operations, binding)) return false;
    if (run.worldReference && run.worldReference.worldId !== binding.worldId
      || run.runIdentity && run.runIdentity.runId !== binding.runId) return false;
    sync(operations); const s = operations.inventories;
    if (!s || s.invalid || !bound(s, operations)) return false;
    const groups = [], add = (kind, model, fixture) => { if (model) groups.push(...serviceRows(kind, model, fixture)); };
    add('passenger', run.intercityPassenger); add('passenger', run.passengerConnection?.otherCarrier);
    for (const fleet of [run.economy?.exchangeCarrier, ...rowsOf(run.economy?.commodityMarket?.intercityTrade?.neighbors).map(n => n.carrier)])
      add('mechanic', fleet?.support?.passengerMaintenance);
    for (const g of rowsOf(run.penalFlights?.assistance?.cityApproach?.gates)) {
      add('porter', g.foreignSurvey?.porter); add('escort', g.foreignSurvey?.escort);
      const benches = rowsOf(run.fixtures).filter(f => f.id === g.foreignWorkspace?.benchId);
      for (const bench of benches.length ? benches : [null]) add('workspace', g.foreignWorkspace, bench);
      add('protection', g.outerApproach?.chapterProtection);
    }
    add('interdiction', run.networkInterdiction); add('maintenance', run.powerworksMaintenance);
    add('standards', run.powerworksStandards); add('communications', run.civicCommunications);
    const finance = run.receivableFinance;
    if (finance && !finance.invalid && bound(finance, operations)) for (const claim of rowsOf(finance.claims)) {
      const source = rowsOf(finance.sources).find(r => r.id === claim.financierSourceId && r.branchId === claim.creditorId);
      groups.push({ id: claim.id, object: claim, source, cityId: source?.cityId, service: 'receivableFinance', acquired: true });
    }
    const observed = new Map();
    const expected = new Map((operations.source.inventoryPlan?.assets || []).map(a => [a.id, a]));
    for (const r of groups) {
      if (!id(r.id)) continue;
      const prior = observed.get(r.id), signature = stable({ source: r.source, object: r.object });
      const branch = r.acquired && operations.source.branches.find(b => b.id === r.source?.branchId);
      const p = expected.get(r.id) || (branch && { ownerId: `branch:${branch.id}`, cityId: branch.cityId,
        populationSourceId: branch.populationSourceId, networkId: branch.networkId, kind: 'claim' });
      const sourceConflict = s.mode === 'original' && (!p || p.cityId !== r.cityId
        || p.populationSourceId !== (r.source?.populationId || r.source?.populationSourceId)
        || p.ownerId !== `branch:${r.source?.branchId}` || r.source?.networkId && p.networkId !== r.source.networkId
        || p.kind === 'premises' && r.object?.cityId !== p.cityId);
      if (prior && prior.signature !== signature) prior.conflict = true;
      else if (!prior) observed.set(r.id, { id: r.id, ownerId: `branch:${r.source?.branchId}`, service: r.service,
        present: Boolean(r.object), signature, acquired: r.acquired === true, conflict: sourceConflict });
    }
    s.observed = [...observed.values()].map(({ signature, ...r }) => r);
    for (const a of s.assets.filter(a => a.ledger === 'service')) {
      const r = observed.get(a.id);
      if (!r?.present || r.ownerId !== a.ownerId || r.conflict) a.lost = true;
    }
    return true;
  }
  function assess(operations, networkId, existingReferences = null) {
    const s = operations?.inventories, p = operations?.source?.inventoryPlan;
    const unknown = { complete: false, state: 'unverified', sources: [], assets: [] };
    if (!s || s.invalid || !bound(s, operations) || !p || s.conflict) return unknown;
    existingReferences ||= operations.accounts.filter(a => !a.lost && a.source.networkId === networkId)
      .flatMap(a => a.allocations.filter(r => r.kind === 'exportReceivableFinance')
        .flatMap(r => (r.claimIds || []).map(assetId => ({ accountId: a.id, assetId, owner: 'receivableFinance.claims' }))));
    const sourceRows = p.owners.filter(o => o.networkId === networkId).map(o => {
      const saved = s.owners.find(r => r.id === o.id);
      return saved && stable(saved) === stable(o) ? saved : { ...o, gaps: ['Original source inventory record missing or conflicting'] };
    }), allAssets = new Map(s.assets.map(a => [a.id, a])), planned = new Map(p.assets.map(a => [a.id, a]));
    const acquired = [];
    for (const ref of existingReferences.filter(r => r.owner === 'receivableFinance.claims')) {
      const owner = p.owners.find(o => o.kind === 'branch' && o.networkId === networkId && o.hostId === ref.accountId);
      if (!owner) continue;
      const observed = s.observed.find(r => r.id === ref.assetId && r.acquired);
      const a = { id: ref.assetId, ownerId: owner.id, kind: 'claim', families: ['finance'], state: null, ledger: 'service',
        external: { service: 'receivableFinance', assetId: ref.assetId },
        lost: !observed?.present || observed.conflict || observed.ownerId !== owner.id };
      allAssets.set(a.id, a); planned.set(a.id, a); acquired.push(a);
    }
    for (const owner of p.owners) for (const ref of owner.existingReferences || []) {
      const accounts = operations.accounts.filter(a => a.id === owner.hostId && !a.lost), a = accounts[0];
      const lost = accounts.length !== 1 || a?.source.networkId !== owner.networkId || a?.source.populationSourceId !== owner.populationSourceId;
      const r = { ...ref, ownerId: owner.id, ledger: 'operatingOffice', state: null,
        external: { accountId: owner.hostId, field: ref.field }, lost };
      allAssets.set(ref.id, r); planned.set(ref.id, r);
    }
    const result = (owner, visiting = new Set()) => {
      if (visiting.has(owner.id)) return { id: owner.id, kind: owner.kind, gaps: ['Cyclic original host/member accounting'],
        families: FAMILIES.map(family => ({ family, state: 'unverified', assetIds: [] })) };
      const next = new Set(visiting); next.add(owner.id);
      const related = owner.members || (owner.sharedHost ? [owner.sharedHost] : []);
      const ownIds = o => [...(o?.assetIds || []), ...(o?.existingReferences || []).map(r => r.id),
        ...acquired.filter(a => a.ownerId === o?.id).map(a => a.id)];
      const children = related.map(id => {
        const original = p.owners.find(o => o.id === id), saved = s.owners.find(o => o.id === id);
        if (!original) return null;
        return result(saved && stable(saved) === stable(original) ? saved
          : { ...original, gaps: ['Original related owner record missing or conflicting'] }, next);
      });
      const ids = [...new Set([...ownIds(owner), ...children.flatMap(o => o?.families.flatMap(f => f.assetIds) || [])])];
      const gaps = [...owner.gaps];
      if (s.mode !== 'original') gaps.push('Legacy inventories unknown; no retroactive original reserves');
      if (children.some(o => !o || o.gaps.length)) gaps.push('Related original source has unresolved inventory');
      if (ids.some(id => !allAssets.has(id) || allAssets.get(id).lost
        || allAssets.get(id).ownerId !== planned.get(id)?.ownerId || allAssets.get(id).kind !== planned.get(id)?.kind
        || allAssets.get(id).ledger === 'inventory' && !compatible(allAssets.get(id).state, planned.get(id)?.initial)))
        gaps.push('Missing or conflicting original asset accounting or service owner');
      return { id: owner.id, kind: owner.kind, ownerId: owner.id, controller: copy(owner.controller),
        sharedHost: owner.sharedHost || null, gaps, families: FAMILIES.map(family => {
          const assetIds = ids.filter(id => (planned.get(id)?.families || []).includes(family));
          const ordinary = family === 'covertAccess' && assetIds.every(id => ['archive', 'terminal', 'access'].includes(planned.get(id)?.kind));
          return { family, state: gaps.length ? 'unverified' : assetIds.length ? ordinary ? 'ordinaryFunctionOnly' : 'accounted' : 'empty', assetIds,
            basis: gaps.length ? 'Unresolved original accounting' : assetIds.length ? 'Actual bounded original owner assets or separately owned member references'
              : 'Supported recipe allocates no owned resource in this family; not a strategic harmlessness finding' };
        }) };
    };
    const sources = sourceRows.map(o => result(o)), ids = new Set(sources.flatMap(o => o.families.flatMap(f => f.assetIds)));
    return { complete: sources.length > 0 && sources.every(o => !o.gaps.length), state: 'privateInventoryOnly', sources,
      assets: [...ids].map(id => copy(allAssets.get(id) || { id, lost: true })),
      limits: 'Inventories confer no command, dependency, feasible reach, intent, acquired knowledge or strategic completion' };
  }
  return { FAMILIES, plan, validPlan, create, normalize, rebind, sync, serviceRows, adopt, eligibleSources, takeSupplies, observe, assess };
});
