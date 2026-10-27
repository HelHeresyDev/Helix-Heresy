(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./network-owner-reconciliation') : root.HelixNetworkOwnerReconciliation,
    node ? require('./network-inventories') : root.HelixNetworkInventories,
    node ? require('./institutional-outcomes') : root.HelixInstitutionalOutcomes);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixNetworkCapabilities = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Owners, Inventories, Outcomes) {
  'use strict';
  const FAMILIES = Object.freeze(['finance', 'research', 'transport', 'armedForce', 'mediaReach', 'certification', 'covertAccess']);
  const PURPOSE = 'institutionalCapabilityAccount';
  const TERMS = 'Request a limited account of each replying office\'s own existing functions and commitments. No asset transfer, inspection rights, maps, beneficial-ownership disclosure, sovereignty, nonintervention or worldwide completeness is agreed.';
  const LIMITS = 'A limited office account is not an inventory of the whole institution. Unexamined assets, commitments and independently controlled capabilities remain unverified. Criticism, faith, withheld knowledge and independent operation are not themselves a strategic challenge.';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const id = x => typeof x === 'string' && x.length > 0;
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  function baseline(map) {
    const h = map?.strategicNonStateNetworkHistory, rows = [];
    const lists = [['network', h?.networkRows], ['branch', h?.branchRows], ['covertCell', h?.covertRows], ['affiliate', h?.affiliateRows]];
    let complete = lists.every(([, list]) => Array.isArray(list));
    for (const [kind, list] of lists) for (const raw of list || []) {
      const sourceId = kind === 'network' ? raw.networkId : raw.id;
      const networkId = kind === 'affiliate' ? raw.actualParentNetworkId : raw.networkId;
      if (!id(sourceId) || !id(networkId)) { complete = false; continue; }
      const advertised = kind === 'network' && map.publicNonStateNetworkDirectory?.networkRecords?.find(r => r.id === networkId);
      rows.push({ id: `${kind}:${sourceId}`, sourceId, kind, networkId, original: copy(raw),
        // Retain the claim, not a generated weapon, stockpile or harmlessness proof.
        advertisedCapabilityCodes: advertised?.capabilityCodes || null });
    }
    const keys = new Set(rows.map(r => r.id)), networks = new Set(rows.filter(r => r.kind === 'network').map(r => r.networkId));
    complete &&= keys.size === rows.length && rows.every(r => networks.has(r.networkId));
    return { complete, rows };
  }
  function validBaseline(base) {
    return base && typeof base.complete === 'boolean' && Array.isArray(base.rows)
      && base.rows.every(r => id(r.id) && id(r.sourceId) && id(r.networkId)
        && ['network', 'branch', 'covertCell', 'affiliate'].includes(r.kind) && r.id === `${r.kind}:${r.sourceId}` && r.original)
      && new Set(base.rows.map(r => r.id)).size === base.rows.length;
  }
  const record = (r, lost = false) => ({ id: r.id, networkId: r.networkId, lost });
  function create(base, binding, at, lost = false) {
    if (!validBaseline(base) || !id(binding?.worldId) || !id(binding.runId) || !Number.isFinite(at)) return null;
    return { worldId: binding.worldId, runId: binding.runId, allocatedAt: at, catalogComplete: base.complete,
      originals: copy(base.rows), records: base.rows.map(r => record(r, lost)), conflict: false };
  }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !id(s.worldId) || !id(s.runId) || !Number.isFinite(s.allocatedAt)
      || !validBaseline({ complete: s.catalogComplete, rows: s.originals }) || !Array.isArray(s.records)
      || !s.records.every(r => id(r.id) && id(r.networkId) && typeof r.lost === 'boolean')
      || new Set(s.records.map(r => r.id)).size !== s.records.length)
      return { worldId: s.worldId || '', runId: s.runId || '', invalid: true };
    const next = copy(s);
    if (s.ownerReconciliationInitialized) next.ownerReconciliation = Owners.normalize(s.ownerReconciliation);
    return next;
  }
  function sync(s, base) {
    if (!s || s.invalid || !validBaseline(base)) return false;
    const originals = new Map(s.originals.map(r => [r.id, r])), records = new Map(s.records.map(r => [r.id, r]));
    for (const row of base.rows) {
      const old = originals.get(row.id);
      if (!old) { s.originals.push(copy(row)); originals.set(row.id, row); }
      else if (old.networkId !== row.networkId || old.sourceId !== row.sourceId || old.kind !== row.kind) s.conflict = true;
    }
    for (const row of s.originals) {
      const old = records.get(row.id);
      // A missing saved record is an explicit gap, not a fresh asset allocation.
      if (!old) { const gap = record(row, true); s.records.push(gap); records.set(row.id, gap); }
      else if (old.networkId !== row.networkId) s.conflict = true;
    }
    if (s.records.some(r => !originals.has(r.id))) s.conflict = true;
    s.catalogComplete = base.complete;
    return !s.conflict;
  }
  function rebind(s, from, to) {
    s = normalize(s); if (!bound(s, from)) return null;
    if (s.ownerReconciliationInitialized) s.ownerReconciliation = Owners.rebind(s.ownerReconciliation, from, to);
    if (s.institutionalContinuity) s.institutionalContinuity = bound(s.institutionalContinuity, from)
      ? { ...s.institutionalContinuity, worldId: to.worldId, runId: to.runId } : null;
    return { ...s, worldId: to.worldId, runId: to.runId };
  }
  function references(operations, networkId) {
    const refs = [], seen = new Set();
    const add = (accountId, assetId, family, owner, scope) => {
      const key = `${accountId}:${assetId}:${family}`; if (seen.has(key)) return;
      seen.add(key); refs.push({ accountId, assetId, family, owner, scope });
    };
    for (const a of operations?.accounts || []) {
      if (a.lost || a.source.networkId !== networkId || a.source.hostId !== a.id) continue;
      // References to conserved owner records, NEVER copies/new balances.
      add(a.id, `${a.id}:working-capital`, 'finance', 'networkOperations.money', 'smallOfficeWorkingCapitalOnly');
      add(a.id, a.operator.id, 'finance', 'networkOperations.operator', 'deskWorkOnly');
      add(a.id, a.terminal.id, 'mediaReach', 'networkOperations.terminal', 'officeCommunicationsOnly');
      for (const allocation of a.allocations) {
        if (allocation.kind === 'originalProtectiveProfessional') {
          add(a.id, allocation.id, 'armedForce', 'chapterProtection', 'oneOriginalProtectiveDuty');
          add(a.id, `${allocation.id}:kit`, 'armedForce', 'chapterProtection.kit', 'sameWornKit');
        } else if (allocation.kind === 'originalFieldTeam') {
          for (const actorId of allocation.actorIds || []) {
            add(a.id, actorId, 'armedForce', 'networkInterdiction', 'originalLimitedFieldDuty');
            add(a.id, `${actorId}:kit`, 'armedForce', 'networkInterdiction.fieldKit', 'sameWornKit');
          }
        } else if (allocation.kind === 'exportReceivableFinance') {
          for (const id of allocation.claimIds || []) add(a.id, id, 'finance', 'receivableFinance.claims', 'oneAssignedExportReceivableNotNewCashOrTotalWealth');
        } else if (allocation.kind === 'civicRelayAccess') {
          add(a.id, allocation.interfaceId, 'mediaReach', 'civicCommunications.ports', 'oneOriginalAccessInterfaceNotConstellationOwnership');
        } else if (allocation.kind === 'powerworksPartsAssessment') {
          add(a.id, allocation.reviewerId, 'certification', 'powerworksStandards.providers.reviewer', 'finiteOriginalMaterialAssessmentNotSovereignty');
          add(a.id, allocation.benchId, 'certification', 'powerworksStandards.providers.bench', 'originalReviewApparatusNotMunicipalTestJig');
        } else if (allocation.kind === 'powerworksTechnicalService') {
          add(a.id, allocation.technicianId, 'research', 'powerworksMaintenance.providers.technician', 'oneQualifiedOriginalRegulatorSpecialist');
          add(a.id, allocation.benchId, 'research', 'powerworksMaintenance.providers.bench', 'finiteOriginalDiagnosticBench');
        } else if (allocation.kind === 'essentialFuelService') {
          // Once reconciled, only an actual surviving supplier object can back
          // this reference. The old allocation IDs alone cannot recreate it.
          if (operations.capabilityAccounting?.ownerReconciliationInitialized) continue;
          // Brokers reference, but do not own, the SAME producer assets.
          // Shared-vendor references must never count as extra assets.
          const vendor = allocation.facilityId;
          add(vendor, vendor, 'research', 'localMarketProduction.facilities', 'independentVendorTechnicalServiceOnly');
          for (const id of allocation.truckIds || []) add(vendor, id, 'transport', 'localMarketProduction.trucks', 'sharedIndependentVendor');
          for (const id of allocation.actorIds || []) add(vendor, id, 'transport', 'localMarketProduction.trucks.driver', 'sameOriginalDriver');
          for (const id of allocation.radioIds || []) add(vendor, id, 'mediaReach', 'localMarketProduction.trucks.driver.cabRadio', 'finiteCabCommunicationsOnly');
        }
      }
    }
    return refs.concat(Owners.view(operations?.capabilityAccounting, operations, networkId).references);
  }
  function assess(s, operations, networkId, frame, at) {
    if (!s || s.invalid || !bound(s, operations) || !s.originals.some(r => r.kind === 'network' && r.networkId === networkId))
      return { catalogComplete: false, strategicComplete: false, state: 'unverified', sources: [], references: [], families: [] };
    const sources = s.originals.filter(r => r.networkId === networkId), refs = references(operations, networkId);
    const ownerAccount = Owners.view(s, operations, networkId);
    const inventory = Inventories.assess(operations, networkId, refs);
    const records = new Map(s.records.map(r => [r.id, r]));
    const branchAccounts = sources.filter(r => r.kind === 'branch').map(r => {
      const branch = operations.source.branches.find(b => b.id === r.sourceId);
      const account = branch && operations.accounts.find(a => a.id === branch.hostId);
      return { sourceId: r.id, accountId: account?.id || null, lost: !account || account.lost === true };
    });
    const commitments = operations.source.branches.filter(b => b.networkId === networkId)
      .map(b => ({ id: b.charter.id, branchId: b.id, kind: 'operatingCharter', controllerId: b.charter.controllerId,
        mode: b.charter.mode, scope: copy(b.charter.scope) }));
    for (const a of operations.accounts.filter(a => a.source.networkId === networkId && a.source.hostId === a.id && !a.lost)) {
      for (const m of Object.values(a.mandates || {})) commitments.push({ id: m.id, branchId: a.id,
        kind: 'scopedMandate', purpose: m.purpose, terms: m.terms });
      if (a.mandate && !commitments.some(r => r.id === a.mandate.id)) commitments.push({ id: a.mandate.id,
        branchId: a.id, kind: 'scopedMandate', purpose: 'armedReceivingContest', terms: a.mandate.terms });
      for (const r of a.allocations) if (r.contractId || r.assignment) commitments.push({ id: r.contractId || r.assignment,
        branchId: a.id, kind: 'existingAllocationCommitment', allocationId: r.id });
    }
    const outcome = s === operations.capabilityAccounting ? Outcomes.read(frame, operations, networkId, at) : null;
    return { catalogComplete: s.catalogComplete && !s.conflict && sources.every(r => records.get(r.id)?.networkId === r.networkId && !records.get(r.id).lost),
      // Only a current read of the actual original consumers can resolve this.
      strategicComplete: outcome?.strategicComplete === true, state: outcome?.state || 'unverified', outcome,
      sources: sources.map(r => { const accountId = branchAccounts.find(b => b.sourceId === r.id)?.accountId;
        return { id: r.id, kind: r.kind, lost: records.get(r.id)?.lost !== false,
          families: outcome?.sources.find(s => s.id === r.id)?.families || FAMILIES.map(family => ({ family,
            state: refs.some(a => a.family === family && (a.branchIds ? a.branchIds.includes(r.sourceId)
              : accountId && a.accountId === accountId)) ? 'partiallyAccounted' : 'unallocated' })) };
      }), branchAccounts, commitments: commitments.concat(ownerAccount.commitments), ownerAccount, inventory,
      references: refs, families: FAMILIES.map(family => outcome ? { family, state: outcome.state,
        assetIds: [...new Set(outcome.sources.flatMap(s => s.families.find(f => f.family === family)?.assetIds || []))] }
        : ({ family, state: refs.some(r => r.family === family) ? 'partiallyAccounted' : 'unallocated',
        requires: 'Actual owner assets, authority, commitments, necessary-government dependency, feasible reach, intent and supported outcomes.' })) };
  }
  function statement(operations, a) {
    // Do not consult concealed sources, ratings, cash balances, people counts,
    // current deployment positions or the private assessment to build a reply.
    if (a.source.disclosurePolicy === 'withholdInternalAccounts') return { disclosure: 'withheld', scope: 'ownOfficeOnly',
      functions: [], text: 'This office withholds its internal capability account. Existing contracts and prior restrictions are unchanged.', limits: LIMITS };
    const functions = ['Original desk and finite powered correspondence'];
    if (a.source.financePolicy) functions.push('Separately authorized discretionary contract finance');
    if (a.allocations.some(r => r.kind === 'originalProtectiveProfessional')) functions.push('Retained local protective-duty allocation; readiness and current commitments are not certified');
    if (a.allocations.some(r => r.kind === 'originalFieldTeam')) functions.push('Retained limited field-duty allocation; no live deployment report');
    return { disclosure: 'limited', scope: 'ownOfficeOnly', functions,
      text: 'This office accounts only for the named local functions. This is not a declaration of the whole institution\'s resources or command rights.', limits: LIMITS };
  }
  return { FAMILIES, PURPOSE, TERMS, LIMITS, bound, baseline, validBaseline, create, normalize, sync, rebind, references, assess, statement };
});
