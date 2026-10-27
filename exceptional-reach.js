(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./strategic-non-state-networks') : root.HelixStrategicNonStateNetworks);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixExceptionalReach = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Networks) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const FUNCTIONS = { flyingMountInfrastructure: 'flyingMountAerie', poweredAircraft: 'airfield',
    rocketSpaceflight: 'rocketLaunchComplex', orbitalArcaneRelayMesh: 'orbitalControlGateway',
    individualSpaceflight: 'spacefarerObservationCenter' };
  const LIMITS = 'This original provider owns the aircraft and employs its pilot; the booking grants only the named civilian round trip. Receiving-point operation is not land title, military passage, city admission, network allegiance, spacecraft command or a promise of rescue.';
  // Immutable commissioning/activation evidence, not another hardware ledger.
  function sources(map) {
    const history = map?.strategicCapabilityHistory, sites = [], gaps = [];
    const claims = (map?.strategicNonStateNetworkHistory?.networkRows || []).map(n => {
      const d = Networks.NETWORK_DEFINITIONS.find(d => d.id === n.sourceDefinitionId);
      return { networkId: n.networkId, definitionId: n.sourceDefinitionId || null, defined: Boolean(d), roles: copy(d?.orbitalRoles || []) };
    });
    if (!Array.isArray(history?.milestoneRows)) return { state: 'unverified', sites, claims, activations: [], gaps: ['Canonical capability commissioning history missing'] };
    for (const [capabilityId, kind] of Object.entries(FUNCTIONS)) {
      const rows = history.milestoneRows.filter(m => m.capabilityId === capabilityId);
      if (rows.length !== 1) { gaps.push(`${capabilityId}: original milestone missing or conflicting`); continue; }
      const m = rows[0];
      for (const s of m.infrastructureRows || []) {
        const valid = s.id && s.cityId && s.cellId && s.function === kind && s.capabilityId === capabilityId
          && m.institution?.id && s.operatingInstitutionId === m.institution.id && Number.isFinite(s.commissionedYear)
          && s.commissionedYear >= m.standardizationYear && s.commissionedYear <= history.historicalHorizonYear;
        sites.push({ id: s.id || `${capabilityId}:unknown-site`, capabilityId, cityId: s.cityId, cellId: s.cellId,
          function: s.function, operatingInstitutionId: s.operatingInstitutionId || null, commissionedYear: s.commissionedYear,
          operationalAtPlayableYear: s.operationalAtPlayableYear === true, state: valid ? 'commissionedOperationOnly' : 'unverifiedCommissioning',
          ownership: 'Operating institution is identified; no non-state hardware title or control contract follows',
          means: capabilityId === 'individualSpaceflight' ? 'Observation/coordination infrastructure is not a space-capable body'
            : capabilityId === 'orbitalArcaneRelayMesh' ? 'Ground gateway is not constellation or weapon command'
              : capabilityId === 'rocketSpaceflight' ? 'Launch infrastructure is not an assembled fueled rocket, payload, crew or launch authorization'
                : capabilityId === 'flyingMountInfrastructure' ? 'Aerie is not an allocated living mount, rider or military commission'
                  : 'Airfield is not an allocated airframe, pilot or transport contract' });
      }
      if (!(m.infrastructureRows || []).length) gaps.push(`${capabilityId}: no retained commissioned site`);
    }
    const duplicate = sites.filter((s, i) => sites.findIndex(r => r.id === s.id) !== i).map(s => s.id);
    if (duplicate.length) gaps.push('Conflicting original infrastructure identities: ' + duplicate.join(', '));
    for (const s of sites) if (duplicate.includes(s.id)) s.state = 'unverifiedCommissioning';
    return { state: 'originalCommissioningEvidence', sites, gaps, claims,
      activations: (map.strategicNonStateNetworkHistory?.eventRows || []).filter(e => e.kind === 'advancedServiceActivated').map(e => ({
        id: e.id, networkIds: copy(e.networkIds || []), cityId: e.cityId, year: e.year,
        capabilityId: e.exactFactors?.capabilityId, roles: copy(e.exactFactors?.orbitalRoles || []),
        state: e.id && e.networkIds?.length && Number.isFinite(e.year) && e.year <= history.historicalHorizonYear
          && history.milestoneRows.some(m => m.capabilityId === e.exactFactors?.capabilityId && e.year >= m.standardizationYear)
          ? 'activatedServiceOnly' : 'unverifiedActivation',
        scope: 'Service activation/advertisement only; not a hardware deed, commissioning manifest or military delegation' })) };
  }
  function originalProvider(p) {
    const b = p?.originalOwner;
    return Boolean(b && b.kind === 'independentContact' && b.ownerId === p.contactId && b.ownerId === p.aircraft?.ownerId
      && b.providerId === p.id && b.aircraftId === p.aircraft.id && b.pilotId === p.pilot?.id
      && b.employerId === p.pilot.employerId && b.employerId === b.ownerId && b.padId === p.pad?.id
      && b.padOperatorId === p.pad.ownerId && b.padOperatorId === b.ownerId && b.padCellId === p.pad.cellId);
  }
  function validSources(s) {
    return Boolean(s && ['unverified', 'originalCommissioningEvidence'].includes(s.state) && Array.isArray(s.sites)
      && Array.isArray(s.activations) && Array.isArray(s.gaps) && s.gaps.every(v => typeof v === 'string')
      && Array.isArray(s.claims) && s.claims.every(c => c?.networkId && typeof c.defined === 'boolean' && Array.isArray(c.roles))
      && s.sites.every(v => v?.id && Object.hasOwn(FUNCTIONS, v.capabilityId)
        && ['commissionedOperationOnly', 'unverifiedCommissioning'].includes(v.state))
      && s.activations.every(v => v && Array.isArray(v.networkIds) && Array.isArray(v.roles)));
  }
  function charter(p, tripId) {
    return originalProvider(p) ? { ...copy(p.originalOwner), tripId, scope: 'namedCivilianRoundTrip', limits: LIMITS } : null;
  }
  function current(c, p, tripId) {
    return Boolean(c && c.tripId === tripId && c.scope === 'namedCivilianRoundTrip' && originalProvider(p)
      && same(c, charter(p, tripId)));
  }
  function flightReach(p, km, c, at) {
    if (!originalProvider(p)) return { state: 'unverified', reason: 'Original aircraft owner, employed pilot or receiving-point operating account is missing/conflicting' };
    const a = p.aircraft, pilot = p.pilot;
    if (!c?.alive || !c.capable || !c.free || !c.atOrigin || !c.pilotPresent || !c.departurePermission || !c.receivingPermission)
      return { state: 'blocked', reason: 'Actual capable attendance and independently authorized departure/receiving access are required' };
    const travel = km / 210 * 3600, work = 2 * Math.ceil(travel) + (c.waitSeconds || 0) + (c.overheadSeconds ?? 600);
    if (!Number.isFinite(km) || km <= 0 || km > a.rangeKm || a.fuelKm < 2 * km + 50
      || a.condition - km * .02 < 50 || pilot.status !== 'alive' || pilot.health < 50 || pilot.location !== 'receivingPad'
      || a.reservedBy && a.reservedBy !== c.tripId || a.readyAt > at || p.dutySeconds < work || p.provisionsSeconds < work
      || !Number.isFinite(p.dutySeconds) || !Number.isFinite(p.provisionsSeconds) || c.weatherReason
      || (c.passengers || 1) > a.passengerSeats || (c.cargoKg || 0) > a.cargoKg || (c.cargoL || 0) > a.cargoL)
      return { state: 'unavailable', reason: 'The same original pilot/aircraft cannot support the complete outward, waiting and return allowance with actual fuel, duty, provisions, capacity, condition, weather and prior reservations' };
    return { state: 'supportedCivilianFlight', distanceKm: km, seconds: work,
      scope: 'Surface-road connectivity is irrelevant to this flight; limited receiving access grants neither military passage nor admission' };
  }
  function providerViews(run) {
    const providers = run.penalFlights?.assistance?.services || [];
    return providers.filter((p, i) => providers.findIndex(q => q.id === p.id) === i).map(p => ({ providerId: p.id,
      state: providers.filter(q => q.id === p.id || q.aircraft?.id === p.aircraft?.id || q.pilot?.id === p.pilot?.id).length > 1
        ? 'conflictingProviderAliases' : originalProvider(p) ? 'independentOriginalProvider' : 'unverifiedOwner', originalOwner: copy(p.originalOwner),
      resources: { aircraft: copy(p.aircraft), pilot: copy(p.pilot), dutySeconds: p.dutySeconds,
        provisionsSeconds: p.provisionsSeconds, radioSeconds: p.radioSeconds },
      contracts: (run.penalFlights?.assistance?.cityApproach?.trips || []).filter(t => t.providerId === p.id).map(t => ({
        id: t.id, phase: t.status, payment: copy(t.payment), charter: copy(t.component?.charter),
        state: t.component && current(t.component.charter, p, t.id) ? 'actualScopedCharter' : t.component ? 'unverifiedCharter' : 'otherExistingOwnerTerms' })),
      limits: 'Read-only reference to one existing provider, never another network allocation or a second spendable balance' }));
  }
  function outcomes(n, run, assess) {
    const inv = n?.inventories, evidence = n?.source?.exceptionalSources;
    const boundaries = [run.unsupportedExcursions?.trip && { location: 'unsupportedExcursions.trip', contractId: run.unsupportedExcursions.trip.id,
      scope: 'Existing survey aircraft and its medical reservation retain their own service terms; no original non-state title or extra aircraft is inferred' },
    run.medicalExtraction?.mission && { location: 'medicalExtraction.mission', contractId: run.medicalExtraction.mission.id,
      scope: 'Existing medical crew, patient and reserved aircraft remain separate; a rescue service is not an organizational force' }].filter(Boolean);
    if (!n || n.invalid || !inv || inv.invalid || inv.conflict || inv.mode !== 'original' || !bound(inv, n)
      || !n.source?.inventoryPlan || typeof assess !== 'function' || !validSources(evidence))
      return { state: 'unverified', owners: [], providers: providerViews(run), boundaries, strategicComplete: false };
    const accounts = new Map(n.source.networks.map(v => [v.id, assess(n, v.id)]));
    const owners = n.source.capabilityBaseline.rows.map(row => {
      const a = accounts.get(row.networkId)?.sources.find(o => o.id === row.id), plan = n.source.inventoryPlan;
      const original = plan.owners.find(o => o.id === row.id);
      const sites = evidence.sites.filter(s => s.cityId === original?.cityId || row.kind === 'network');
      const ids = (a?.families || []).flatMap(f => f.assetIds), means = inv.assets.filter(v => ids.includes(v.id) && v.ownerId === row.id);
      const originalGaps = a?.gaps || ['Original owner inventory missing'];
      const unresolvedCommission = originalGaps.some(g => g.includes('Exceptional commissioned means'));
      const issues = [...originalGaps.filter(g => !g.includes('Exceptional commissioned means')), ...evidence.gaps];
      if (unresolvedCommission) {
        issues.push(`${row.id}: no original hardware/body commissioning manifest or delegated external command contract is established`);
        if (!sites.length) issues.push(`${row.id}: no matching retained local commissioning site`);
      }
      for (const site of sites) if (site.state !== 'commissionedOperationOnly') issues.push(`${site.id}: commissioning provenance unverified`);
      const activations = evidence.activations.filter(v => v.networkIds.includes(row.networkId));
      for (const a of activations) if (a.state !== 'activatedServiceOnly') issues.push(`${a.id || row.id}: activation provenance unverified`);
      const claim = evidence.claims.find(c => c.networkId === row.networkId);
      const relatedInterfaces = inv.assets.filter(v => ids.includes(v.id) && v.kind === 'interface' && !v.lost);
      const ordinary = ['launchFinance', 'experimentalLaunchSponsorship', 'orbitalResearchCoordination', 'sealedOrbitalArchive', 'orbitalCommunicationProtocols'];
      const roleScopes = (row.kind === 'network' || unresolvedCommission ? claim?.roles || [] : []).map(role => ({ role,
        state: ordinary.includes(role) ? 'existingFinanceArchiveOrProtocolScopeOnly'
          : role === 'orbitalRelayOperations' && relatedInterfaces.length ? 'existingMessageInterfacesOnly' : 'unverifiedOperationalMeans',
        requirement: role === 'individualSpacefarerRescue' ? 'Actual original space-capable person, supported rescue equipment and mission'
          : role === 'orbitalThreatInterception' ? 'Actual original interception apparatus/body, target access and mandate'
            : role === 'rocketLaunchServices' ? 'Actual rocket, payload, crew, launch control and feasible authorized mission'
              : 'Actual owned property or narrowly delegated service means; an advertised role alone supplies no material or offensive command' }));
      for (const r of roleScopes) if (r.state === 'unverifiedOperationalMeans') issues.push(`${row.id}:${r.role}: ${r.requirement} remains unverified`);
      if (!claim?.defined) issues.push(`${row.id}: original advertised-function definition unverified`);
      for (const v of means) if (v.state?.exceptionalCapabilities?.length || v.state?.spaceCapable || ['rocket', 'satellite', 'flyingMount', 'aircraft'].includes(v.kind))
        issues.push(`${v.id}: exceptional hardware/body needs an actual supported commissioned owner and target consumer`);
      return { id: row.id, networkId: row.networkId, kind: row.kind, state: issues.length ? 'unverifiedExceptionalMeans'
        : a?.sharedHost || row.kind === 'network' ? 'relatedOriginalOwnerScopes' : 'originalAllocatedFunctionsOnly',
        issues: [...new Set(issues)], sites: copy(sites), activations: copy(activations), roleScopes,
        interfaces: means.filter(v => v.kind === 'interface').map(v => ({ id: v.id, reference: copy(v.external),
          current: copy(v.ledger === 'inventory' ? v.state : bound(run.civicCommunications, n)
            ? run.civicCommunications.ports?.find(p => p.id === v.id) : null),
          siteId: plan.assets.find(a => a.id === v.id)?.infrastructureId,
          scope: plan.assets.find(a => a.id === v.id)?.accessScope || 'Original interface only' })),
        targetAccess: 'No offensive payload, space-capable employee, satellite command or military passage follows from these roles/sites; missing original manifests stay unverified',
        willingness: 'A service activation or ordinary rescue/research/communications function is not a hostile commission',
        limits: 'Current source-bound accounting only, not fleet destruction, political submission or whole-network qualification' };
    });
    return { state: 'privateExceptionalScopes', owners, providers: providerViews(run), boundaries, strategicComplete: false };
  }
  return { FUNCTIONS, LIMITS, sources, validSources, originalProvider, charter, current, flightReach, providerViews, outcomes };
});
