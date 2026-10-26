(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixNetworkOwnerReconciliation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const id = x => typeof x === 'string' && x.length > 0;
  const list = x => Array.isArray(x) ? x : [];
  const entries = x => list(x).map((v, i) => [i, v]).filter(([, v]) => v && typeof v === 'object');
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  // Transient comparison only. Never persist a second balance, condition or job.
  const stable = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  function valid(s) {
    return Boolean(s && !s.invalid && id(s.worldId) && id(s.runId)
      && Array.isArray(s.originals) && Array.isArray(s.records) && Array.isArray(s.boundaries)
      && s.originals.every(r => r && id(r.assetId) && id(r.kind) && r.owner && Array.isArray(r.slots)
        && r.slots.every(id) && Array.isArray(r.families) && r.families.every(id))
      && s.records.every(r => r && id(r.assetId) && ['linked', 'unknownAttribution', 'conflict', 'missingOwnerObject', 'missingAccounting'].includes(r.state)
        && Array.isArray(r.locations) && r.locations.every(id) && Array.isArray(r.commitments)
        && r.commitments.every(c => c && id(c.location)))
      && new Set(s.originals.map(r => r.assetId)).size === s.originals.length
      && new Set(s.records.map(r => r.assetId)).size === s.records.length
      && s.records.every(r => s.originals.some(o => o.assetId === r.assetId)));
  }
  function normalize(s) {
    return valid(s) ? copy(s) : { worldId: s?.worldId || '', runId: s?.runId || '', invalid: true };
  }
  function rebind(s, from, to) {
    const next = normalize(s);
    return bound(next, from) ? { ...next, worldId: to.worldId, runId: to.runId } : null;
  }
  // This reads ONLY objects already in the run. No service constructors, lazy
  // ensures, purchases, payments, assignment updates or resource elaboration.
  function collect(run) {
    const assets = [], boundaries = [];
    const boundary = (model, location, ownerKind, reason) => {
      if (model) boundaries.push({ location, ownerId: model.id || null, ownerKind, reason, scope: 'No non-state title or command inferred' });
    };
    const group = (model, location, kind, cityId, roles) => {
      if (!model) return;
      const source = model.source || {}, owner = { kind: 'branch', branchId: source.branchId || null,
        networkId: source.networkId || null, cityId: source.cityId || cityId || null, populationId: source.populationId || null };
      if (!id(source.branchId) || !roles.some(([, , assetId]) => id(assetId)))
        boundary(model, location, 'unknownAttribution', 'Existing service lacks an original branch or resolvable asset identity');
      const commitments = [{ location, kind: 'ownerLedger', id: null,
        scope: 'Original income, wages, deposits, escrow, stock and finite work remain here; never credited to office cash' },
      ...['booking', 'trip', 'contract', 'job', 'recovery', 'repair', 'toolkitService', 'lease', 'hauling']
        .filter(k => model[k]).map(k => ({ location: `${location}.${k}`, kind: k, id: model[k].id || null,
          scope: 'Existing owner terms and ledger only; no new delegation or payment' }))];
      for (const [role, object, assetId, families, suffix] of roles) {
        if (!id(assetId)) continue;
        assets.push({ assetId, kind: `${kind}.${role}`, owner, families, object,
          slot: `${kind}:${source.branchId || location}:${role}`,
          location: suffix?.startsWith('@') ? suffix.slice(1) : `${location}.${suffix || role}`,
          fingerprint: stable({ model, object }), commitments, custodianId: object?.carriedBy || null });
      }
      const actorId = model.actor?.id;
      for (const [i, stack] of entries(run.physicalItemStacks)) if ((actorId && stack.carriedBy === actorId
        || kind === 'workspace' && stack.roomId === model.roomId) && !Object.hasOwn(model.gearCondition || {}, stack.id)) {
        // Carrying/hosting tenant, municipal or borrowed property proves custody,
        // not title. The explicit original escort kit below is the exception.
        boundaries.push({ assetId: stack.id, location: `physicalItemStacks[${i}]`, custodianId: stack.carriedBy || model.property?.id,
          ownerKind: 'custodyOnly', reason: 'Physical custody does not establish institutional ownership',
          scope: 'Existing cargo, tool, lease and return claims remain authoritative' });
      }
    };
    for (const [p, location] of [[run.intercityPassenger, 'intercityPassenger'], [run.passengerConnection?.otherCarrier, 'passengerConnection.otherCarrier']]) {
      const branch = p?.source?.branchId;
      group(p, location, 'passenger', p?.homeCityId, [
        ['driver', p?.driver, p?.driver?.id || (branch && `${branch}:passenger-driver`), ['transport']],
        ['vehicle', p?.vehicle, p?.vehicle?.id || (branch && `${branch}:passenger-road-car`), ['transport']]
      ]);
    }
    const market = run.economy?.commodityMarket, neighbors = entries(market?.intercityTrade?.neighbors);
    const fleets = [[run.economy?.exchangeCarrier, 'economy.exchangeCarrier'],
      ...neighbors.map(([i, n]) => [n.carrier, `economy.commodityMarket.intercityTrade.neighbors[${i}].carrier`])];
    for (const [fleet, location] of fleets) {
      const m = fleet?.support?.passengerMaintenance, branch = m?.source?.branchId;
      group(m, `${location}.support.passengerMaintenance`, 'mechanic', m?.source?.cityId, [
        ['actor', m?.actor, m?.actor?.id || (branch && `${branch}:callout-mechanic`), ['transport']],
        ['toolkit', m?.toolkit, m?.toolkit?.id || (branch && `${branch}:mechanic-toolkit`), ['transport']]
      ]);
      boundary(fleet, location, 'independent', 'Exchange vehicles, parts, supplier payments and workshop reserves are not the callout mechanic branch');
    }
    for (const [i, g] of entries(run.penalFlights?.assistance?.cityApproach?.gates)) {
      const path = `penalFlights.assistance.cityApproach.gates[${i}]`, e = g.foreignSurvey?.escort, p = g.foreignSurvey?.porter, w = g.foreignWorkspace;
      group(p, `${path}.foreignSurvey.porter`, 'porter', g.cityId, [
        ['actor', p?.actor, p?.source?.allocationId, ['transport']]
      ]);
      const physical = (assetId, role, family, list, rootPath) => {
        const matches = list.map((object, index) => ({ object, index })).filter(r => r.object && r.object.id === assetId);
        return (matches.length ? matches : [{ object: null, index: -1 }])
          .map(r => [role, r.object, assetId, [family], `@${rootPath}[${r.index}]`]);
      };
      const kit = Object.keys(e?.gearCondition || {}).flatMap(stackId => physical(stackId, 'kit:' + stackId,
        'armedForce', Array.isArray(run.physicalItemStacks) ? run.physicalItemStacks : [], 'physicalItemStacks'));
      if (e?.restPlace?.stackId) kit.push(...physical(e.restPlace.stackId, 'restPlace', 'armedForce', Array.isArray(run.physicalItemStacks) ? run.physicalItemStacks : [], 'physicalItemStacks'));
      group(e, `${path}.foreignSurvey.escort`, 'surveyEscort', g.cityId, [
        ['actor', e?.actor, e?.source?.allocationId, ['armedForce']], ...kit
      ]);
      group(w, `${path}.foreignWorkspace`, 'workspace', w?.property?.cityId, [
        ['property', w?.property, w?.property?.id || w?.roomId, ['research']],
        ['actor', w?.actor, w?.actor?.id || (w?.source?.branchId && `${w.source.branchId}:assay-representative`), ['research']],
        ...physical(w?.benchId, 'bench', 'research', Array.isArray(run.fixtures) ? run.fixtures : [], 'fixtures')
      ]);
      boundary(g.foreignSurvey, `${path}.foreignSurvey`, 'municipal', 'Survey ground and original municipal carrier are not the porter or escort branch');
      boundary(g.foreignSurvey?.builder, `${path}.foreignSurvey.builder`, 'municipal', 'Public-works craftsperson, kit and construction obligations remain public');
      boundary(w?.municipalAssay, `${path}.foreignWorkspace.municipalAssay`, 'municipal', 'Departmental branchId is not non-state parentage; treasury and samples remain separate');
    }
    const productions = [[market?.localProduction, 'economy.commodityMarket.localProduction'],
      ...neighbors.map(([i, n]) => [n.production, `economy.commodityMarket.intercityTrade.neighbors[${i}].production`])];
    for (const [p, location] of productions) if (p) {
      const owner = { kind: 'independentProducer', id: `${p.cityId}:producer-pool`, cityId: p.cityId };
      const fingerprint = stable(p);
      const add = (object, kind, families, suffix) => {
        if (id(object?.id)) assets.push({ assetId: object.id, kind, owner, families, object, slot: object.id,
          location: `${location}.${suffix}`, fingerprint, commitments: [{ location,
            kind: 'sharedProductionLedger', id: null, scope: 'Original finance, stock, cargo, staffing and production commitments; no broker title' }] });
      };
      for (const [i, f] of entries(p.facilities)) add(f, 'producer.facility', ['research'], `facilities[${i}]`);
      for (const [i, t] of entries(p.trucks)) {
        add(t, 'producer.truck', ['transport'], `trucks[${i}]`);
        add(t.driver, 'producer.driver', ['transport'], `trucks[${i}].driver`);
        add(t.driver?.cabRadio, 'producer.radio', ['mediaReach'], `trucks[${i}].driver.cabRadio`);
      }
      boundary(p, location, 'independent', 'Shared producer pool and finance remain independent of every referring broker');
    }
    for (const [model, location, ownerKind, reason] of [
      [market?.intercityTrade, 'economy.commodityMarket.intercityTrade', 'independent', 'Commercial permits do not establish ownership of route operators or cargo'],
      [run.economy?.localCovertMarket, 'economy.localCovertMarket', 'unknownAttribution', 'Broker introductions do not identify an original cell or affiliate owner'],
      [run.economy?.intercitySmuggling, 'economy.intercitySmuggling', 'unknownAttribution', 'Smugglers, buyers, escrow, settlement offices, roadside and extraction groups retain their existing owners'],
      [run.penalFlights?.assistance?.services, 'penalFlights.assistance.services', 'independent', 'Aircraft and pilots remain contact-owned; component expeditions reuse the same aircraft'],
      [run.surveyExpeditions, 'surveyExpeditions', 'municipal', 'Survey carrier and public duties do not become non-state property'],
      [run.fieldCharter, 'fieldCharter', 'municipal', 'Municipal charter is not non-state title'],
      [run.expeditionEscorts, 'expeditionEscorts', 'unknownAttribution', 'Independent home survey professional has no original branch proof'],
      [run.leasedAnnex, 'leasedAnnex', 'independent', 'Unrelated annex and tenant belongings have no research-network title'],
      [run.cityProvisioning, 'cityProvisioning', 'municipal', 'Public carrier, treasury and provisions remain municipal'],
      [run.cityRule, 'cityRule', 'municipal', 'Public works and government resources remain municipal'],
      [run.cityDefense, 'cityDefense', 'municipal', 'Defender and city defenses remain municipal']
    ]) boundary(model, location, ownerKind, reason);
    const providerLists = [
      [market?.intercityTrade?.operators, 'economy.commodityMarket.intercityTrade.operators', 'independent', 'Route permit is not title to this operator, crew, vehicle or cargo'],
      [run.economy?.localCovertMarket?.couriers, 'economy.localCovertMarket.couriers', 'unknownAttribution', 'This courier has no original cell/affiliate parent proof'],
      ...['operators', 'buyers', 'paymentProviders', 'roadsideGroups'].map(key => [run.economy?.intercitySmuggling?.[key],
        `economy.intercitySmuggling.${key}`, 'unknownAttribution', 'Original provider, holdings and commitments remain here; sponsorship is not parentage']),
      [run.penalFlights?.assistance?.services, 'penalFlights.assistance.services', 'independent', 'Contact-owned aircraft and pilot retain their original service reservations']
    ];
    for (const [rows, path, ownerKind, reason] of providerLists) for (const [i, row] of entries(rows)) {
      boundary(row, `${path}[${i}]`, ownerKind, reason);
      if (row.aircraft) boundaries.push({ assetId: row.aircraft.id, ownerId: row.aircraft.ownerId || null,
        location: `${path}[${i}].aircraft`, ownerKind, reason, scope: 'No institutional aircraft title or command inferred' });
    }
    boundary(run.economy?.intercitySmuggling?.armedRescue, 'economy.intercitySmuggling.armedRescue', 'unknownAttribution',
      'Original contact-sponsored extraction team, equipment and paid obligations are not an original military-network allocation');
    return { assets, boundaries };
  }
  function attribution(row, book, operations) {
    if (row.owner.kind !== 'branch') return { owner: row.owner, state: 'linked', accountId: null };
    const o = row.owner, original = book.originals.find(r => r.kind === 'branch' && r.sourceId === o.branchId);
    const b = operations.source.branches.find(b => b.id === o.branchId), r = original && book.records.find(r => r.id === original.id);
    const network = b && book.originals.find(r => r.kind === 'network' && r.networkId === b.networkId);
    const category = row.kind.startsWith('workspace.') ? 'research' : row.kind.startsWith('surveyEscort.') ? 'military' : 'transport';
    const suffixes = { 'passenger.driver': 'passenger-driver', 'passenger.vehicle': 'passenger-road-car',
      'mechanic.actor': 'callout-mechanic', 'mechanic.toolkit': 'mechanic-toolkit', 'porter.actor': 'field-porter',
      'surveyEscort.actor': 'field-survey-professional', 'workspace.actor': 'assay-representative' };
    if (!b || !original || r?.lost !== false || r.networkId !== original.networkId || book.conflict
      || !network || network.original.category !== category || b.category !== category
      || !book.records.some(r => r.id === network.id && r.networkId === b.networkId && !r.lost)
      || b.networkId !== original.networkId || o.networkId && o.networkId !== b.networkId
      || !o.populationId || o.populationId !== b.populationSourceId || o.cityId !== b.cityId
      || suffixes[row.kind] && row.assetId !== `${b.id}:${suffixes[row.kind]}`)
      return { owner: o, state: 'unknownAttribution', accountId: null };
    // Host consolidation is an association, not a transfer of the asset's title.
    const account = operations.accounts.find(a => a.id === b.hostId && !a.lost);
    return { owner: { ...o, networkId: b.networkId }, state: 'linked', accountId: account?.id || null };
  }
  function reconcile(book, operations, run, binding, alive = true) {
    if (!alive || !book || book.invalid || !bound(book, binding) || !bound(operations, binding)) return false;
    if (run.worldReference && run.worldReference.worldId !== binding.worldId
      || run.runIdentity && run.runIdentity.runId !== binding.runId) return false;
    if (!book.ownerReconciliationInitialized && book.ownerReconciliation != null) book.ownerReconciliationInitialized = true;
    if (!book.ownerReconciliationInitialized) {
      book.ownerReconciliationInitialized = true;
      book.ownerReconciliation = { ...binding, originals: [], records: [], boundaries: [] };
    }
    const s = book.ownerReconciliation;
    if (!valid(s) || !bound(s, book)) {
      book.ownerReconciliation = { worldId: book.worldId, runId: book.runId, invalid: true }; return false;
    }
    const frame = collect(run), groups = new Map(), originals = new Map(s.originals.map(r => [r.assetId, r]));
    const retainedIds = new Set(originals.keys());
    const records = new Map(s.records.map(r => [r.assetId, r]));
    const slots = new Map(s.originals.flatMap(r => r.slots.map(slot => [slot, r.assetId])));
    for (const row of frame.assets) {
      const a = attribution(row, book, operations), signature = { assetId: row.assetId, kind: row.kind, owner: a.owner, families: row.families };
      let original = originals.get(row.assetId);
      if (!original) {
        original = { ...copy(signature), slots: [row.slot] }; originals.set(row.assetId, original); s.originals.push(original);
      }
      const rows = groups.get(row.assetId) || []; rows.push({ row, a, signature }); groups.set(row.assetId, rows);
      const priorSlot = slots.get(row.slot);
      if (priorSlot && priorSlot !== row.assetId) {
        rows[rows.length - 1].slotConflict = true;
        const old = records.get(priorSlot); if (old) old.state = 'conflict';
      } else slots.set(row.slot, row.assetId);
      if (!original.slots.includes(row.slot)) original.slots.push(row.slot);
    }
    s.records = s.originals.map(original => {
      const old = records.get(original.assetId), rows = groups.get(original.assetId) || [];
      let state = !old && retainedIds.has(original.assetId) ? 'missingAccounting' : 'linked';
      if (old && ['conflict', 'missingAccounting', 'missingOwnerObject'].includes(old.state)) state = old.state;
      else if (state !== 'missingAccounting' && (!rows.length || rows.some(({ row }) => !row.object))) state = 'missingOwnerObject';
      else if (rows.some(({ a }) => a.state !== 'linked')) state = 'unknownAttribution';
      if (rows.some(r => r.slotConflict || stable(r.signature) !== stable({ assetId: original.assetId, kind: original.kind,
        owner: original.owner, families: original.families })) || new Set(rows.map(r => r.row.fingerprint)).size > 1) state = 'conflict';
      if (!old && retainedIds.has(original.assetId)) state = 'missingAccounting';
      return { assetId: original.assetId, state, locations: [...new Set(rows.map(r => r.row.location))],
        accountIds: [...new Set(rows.map(r => r.a.accountId).filter(Boolean))],
        custodianIds: [...new Set(rows.map(r => r.row.custodianId).filter(Boolean))],
        commitments: [...new Map(rows.flatMap(r => r.row.commitments).map(c => [c.location, c])).values()] };
    });
    s.boundaries = frame.boundaries;
    return true;
  }
  function view(book, operations, networkId) {
    const s = book?.ownerReconciliation;
    if (!book?.ownerReconciliationInitialized) return { state: 'notReconciled', assets: [], references: [], commitments: [], boundaries: [] };
    if (!valid(s) || !bound(s, operations)) return { state: 'missingAccounting', assets: [], references: [], commitments: [], boundaries: [] };
    const selected = new Map(), refs = [], commitments = [];
    const include = (o, r, branch, relation) => {
      if (!selected.has(o.assetId)) selected.set(o.assetId, { ...copy(o), ...copy(r) });
      if (r.state !== 'linked') return;
      const hostExists = operations.accounts.some(a => a.id === branch.hostId && !a.lost);
      const associated = hostExists && (o.owner.kind !== 'branch' || (r.accountIds || []).includes(branch.hostId));
      for (const family of o.families) {
        let ref = refs.find(v => v.assetId === o.assetId && v.family === family);
        if (!ref) { ref = { assetId: o.assetId, family, owner: copy(o.owner), scope: relation,
          accountId: associated ? branch.hostId : null, accountIds: [], branchIds: [], ledgerLocations: copy(r.locations),
          control: 'Existing service terms only; no new delegated command' }; refs.push(ref); }
        if (associated && !ref.accountIds.includes(branch.hostId)) ref.accountIds.push(branch.hostId);
        if (!ref.branchIds.includes(branch.id)) ref.branchIds.push(branch.id);
      }
      for (const c of r.commitments) if (!commitments.some(v => v.location === c.location)) commitments.push({ ...copy(c), branchId: branch.id });
    };
    for (const o of s.originals) if (o.owner.kind === 'branch') {
      const b = operations.source.branches.find(b => b.id === o.owner.branchId && b.networkId === networkId);
      const r = s.records.find(r => r.assetId === o.assetId) || { assetId: o.assetId, state: 'missingAccounting', locations: [], commitments: [] };
      if (b) include(o, r, b, 'originalBranchAssetNotNewCommand');
    }
    const boundaries = copy(s.boundaries);
    for (const o of s.originals) {
      const r = s.records.find(r => r.assetId === o.assetId);
      if (!r || r.state !== 'linked') boundaries.push({ assetId: o.assetId, ownerKind: 'unknownAttribution',
        reason: r?.state || 'missingAccounting', ledgerLocations: r?.locations || [] });
    }
    for (const a of operations.accounts.filter(a => a.source.networkId === networkId && a.source.hostId === a.id && !a.lost)) {
      for (const allocation of a.allocations.filter(r => r.kind === 'essentialFuelService')) {
        for (const assetId of [allocation.facilityId, ...(allocation.truckIds || []), ...(allocation.actorIds || []), ...(allocation.radioIds || [])]) {
          const o = s.originals.find(o => o.assetId === assetId && o.owner.kind === 'independentProducer');
          const r = s.records.find(r => r.assetId === assetId);
          if (o && r) include(o, r, a.source, 'sharedIndependentVendorReferenceNotTitleOrCommand');
          else boundaries.push({ assetId, branchId: a.id, ownerKind: 'unknownAttribution', reason: 'Referenced original supplier object is missing' });
        }
      }
    }
    return { state: 'partial', assets: [...selected.values()], references: refs, commitments, boundaries };
  }
  return { collect, reconcile, view, normalize, rebind };
});
