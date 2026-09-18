(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityCommodityMarket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const groups = {
    biologicalProductivity: ['biomass', 'fieldRation', 'trailMeal'],
    constructionStone: ['stoneBlocks'], timberFiber: ['lumber', 'cloth', 'medicalBandage', 'filterBag', 'escortVest', 'fieldShelter'],
    ferrousOre: ['steelPanels', 'metalParts', 'escortBaton'],
    baseMetalOre: ['refinedConductors', 'relayBattery'], manaCrystals: ['preparedManaCrystals'],
    industrialMinerals: ['bricks', 'glass', 'sealedCollectionJar', 'linedScrapeJar', 'condenserFlask', 'mixedOutputJar', 'sealedReagentBottle'],
    chemicalFeedstock: ['rubber', 'assayReagent', 'neutralizingWash', 'membraneSealant', 'helixBufferSolution'],
    freshWater: ['drinkingWater']
  };
  const familyFor = id => Object.keys(groups).find(k => groups[k].includes(id)) || 'manufacturedGoods';
  const condition = value => ({ intact: 1, worn: 0.85, damaged: 0.5, ruined: 0 }[value] ?? 1);
  function profile(cityId, directory, current, definitions, distanceBetween = null, capabilities = null) {
    const foundation = directory?.foundations?.find(f => f.city.id === cityId);
    if (!foundation) return null;
    const city = current?.cityRows?.find(c => c.cityId === cityId || c.assetId === cityId);
    const viable = !['abandoned', 'destroyed'].includes(city?.habitationStatus) && city?.physicalCondition !== 'ruined';
    const utilities = ({ failed: 0.3, fragile: 0.55, strained: 0.8, functional: 1, strong: 1.1 }[city?.services?.utilities] ?? 1);
    const infrastructure = viable ? condition(city?.physicalCondition) * utilities : 0;
    const population = ({ trace: 0.65, small: 0.75, modest: 0.85, substantial: 1, large: 1.15, immense: 1.3 }[city?.populationBand] ?? 1);
    const output = {}, reasons = {}, productionSources = [];
    const source = (id, name, family, capacity, route) => {
      if (!family || capacity <= 0) return;
      productionSources.push({ id, name, family, capacity, route });
    };
    const add = (family, amount, label) => { if (!family || amount <= 0) return; output[family] = (output[family] || 0) + amount; (reasons[family] ||= []).push(label); };
    for (const f of [foundation.primaryExploitation, foundation.secondaryExploitation]) if (f) {
      add(f.id, 0.5 * infrastructure, `Published local exploitation: ${f.label || f.id}.`);
      source(`${cityId}:${f.id}`, `${foundation.city.name || cityId} ${f.label || f.id} works`, f.id, infrastructure, { open: true, distanceKm: 4, cellIds: [foundation.city.cellId].filter(Boolean), mode: 'groundConvoy' });
    }
    add('biologicalProductivity', ({ marginal: 0, limited: 0.1, productive: 0.25, abundant: 0.4 }[foundation.arableLandBand] || 0) * infrastructure, `Nearby arable land: ${foundation.arableLandBand}.`);
    if (['limited', 'productive', 'abundant'].includes(foundation.arableLandBand) && !(directory.satellites || []).some(s => s.parentId === cityId && s.function === 'agriculture')) source(`${cityId}:farms`, `${foundation.city.name || cityId} nearby farms`, 'biologicalProductivity', infrastructure * ({ limited: 0.25, productive: 0.5, abundant: 1 }[foundation.arableLandBand]), { open: true, distanceKm: 4, cellIds: [foundation.city.cellId].filter(Boolean), mode: 'groundConvoy' });
    // Only directly dependent satellites; joint strongholds and foreign cities are not free imports.
    for (const satellite of directory.satellites || []) {
      if (satellite.parentId !== cityId) continue;
      const status = current?.satelliteRows?.find(r => r.satelliteId === satellite.id || r.assetId === satellite.id);
      if (['abandoned', 'destroyed'].includes(status?.habitationStatus)) continue;
      const size = ({ camp: 0.06, hamlet: 0.09, village: 0.12, town: 0.18 }[satellite.sizeBand] ?? 0.06);
      add(satellite.exportResource?.id, size * condition(status?.physicalCondition) * infrastructure, `Local ${satellite.function} settlement: ${satellite.name}.`);
      const cells = satellite.localRouteCellIds || [], mode = satellite.logistics?.vehicleMode || 'unknown';
      const length = cells.length === 1 ? 4 : cells.length > 1 && distanceBetween ? cells.slice(1).reduce((n, id, i) => {
        const segment = distanceBetween(cells[i], id);
        return Number.isFinite(segment) ? n + segment : NaN;
      }, 0) : NaN;
      source(satellite.id, satellite.name, satellite.exportResource?.id, size * condition(status?.physicalCondition) * infrastructure, {
        open: Number.isFinite(length) && ['groundConvoy', 'mixedFleet'].includes(mode) && status?.services?.transport !== 'failed',
        distanceKm: Number.isFinite(length) ? Math.max(4, length) : null, cellIds: [...cells], mode
      });
    }
    const listings = {};
    for (const def of definitions) {
      const family = familyFor(def.id), abundance = Math.min(1.4, output[family] || 0);
      const supplyFactor = infrastructure * (0.5 + abundance);
      const demand = Math.max(0.55, Math.min(1.8, population + (1 - infrastructure) * 0.25 + (abundance ? 0 : 0.15)));
      listings[def.id] = { targetSupply: Math.round(def.supply * supplyFactor), targetDemand: demand,
        reasons: [...new Set(reasons[family] || ['No published local production anchor for this commodity family; limited merchant stocks.']), `City infrastructure: ${city?.physicalCondition || 'not reported'}; utilities: ${city?.services?.utilities || 'not reported'}; population: ${city?.populationBand || 'not reported'}.`] };
    }
    // Run-local workshop detail elaborates an actual deployed industrial site.
    // Resource labels select a specialism; they never establish industry alone.
    const adoption = capabilities?.cityProfiles?.find(p => p.city.id === cityId);
    const industrial = capabilities?.milestones?.find(m => m.capability.id === 'industrialFabrication');
    const site = industrial?.infrastructureSites?.find(s => s.cityId === cityId && s.function === 'industrialWorks' && s.operationalAtPlayableYear);
    const roles = industrial?.institution?.roles || [];
    const families = new Set(productionSources.map(s => s.family));
    const manufacturingFacilities = [];
    if (viable && adoption?.deployedCapabilityIds.includes('industrialFabrication') && adoption.deployedCapabilityIds.includes('standardManaPower') && site) {
      const establish = (kind, label, expertise, requiredRole) => {
        if (!roles.includes(requiredRole)) return;
        manufacturingFacilities.push({ id: `${cityId}:${kind}`, kind, name: `${foundation.city.name || cityId} ${label}`, siteId: site.id,
          basis: 'Run-local specialism of published deployed industrial works and expertise.', expertise: [expertise],
          condition: condition(city?.physicalCondition) * 100, labour: 1, utilities: city?.services?.utilities === 'failed' ? 0 : infrastructure,
          routeOpen: city?.services?.transport !== 'failed' });
      };
      if (families.has('industrialMinerals')) establish('glassworks', 'Glassworks', 'glassworking', 'precisionManufacturing');
      if (families.has('timberFiber')) establish('textileWorks', 'Textile Works', 'textileProcessing', 'precisionManufacturing');
      if (families.has('chemicalFeedstock')) {
        establish('chemicalWorks', 'Chemical Works', 'chemicalProcessing', 'chemicalIndustry');
        establish('medicalSupplies', 'Sterile Dressing Works', 'sterileProcessing', 'chemicalIndustry');
      }
      if (families.has('baseMetalOre')) establish('metalRefinery', 'Conductor Refinery', 'conductorRefining', 'precisionManufacturing');
      const deployedSite = (id, fn, role) => {
        const milestone = capabilities.milestones.find(m => m.capability.id === id);
        return adoption.deployedCapabilityIds.includes(id) && milestone?.institution?.roles?.includes(role)
          && milestone.infrastructureSites?.some(s => s.cityId === cityId && s.function === fn && s.operationalAtPlayableYear);
      };
      // An operating gateway alone is not a radio factory. These specialisms
      // require industrial works plus the appropriate deployed engineering base.
      if (deployedSite('standardManaPower', 'powerWorks', 'powerEngineering')) {
        if (families.has('manaCrystals')) establish('crystalWorks', 'Crystal Preparation Works', 'crystalPreparation', 'precisionManufacturing');
        if (families.has('chemicalFeedstock')) establish('batteryWorks', 'Battery Works', 'batteryFabrication', 'chemicalIndustry');
      }
      if (deployedSite('regionalDataRelays', 'regionalRelayHub', 'relayEngineering')) establish('electronicsWorks', 'Relay Electronics Works', 'relayFabrication', 'precisionManufacturing');
    }
    return { cityId, cityName: foundation.city.name || foundation.city.label || cityId, playableYear: current?.playableYear ?? null, source: 'publicSettlementFacts', listings, manufacturingFacilities,
      commodityDefinitions: definitions.map(d => ({ id: d.id, label: d.label || d.id, basePrice: d.basePrice, supply: d.supply })),
      productionSources: productionSources.sort((a, b) => a.id.localeCompare(b.id)), workshopCapacity: viable && city?.services?.utilities !== 'failed' ? infrastructure : 0 };
  }
  function evolve(listing, baseline, def, randomSupply, randomDemand) {
    const demand = baseline?.targetDemand ?? 1;
    return {
      // Local consumption removes only unowned exchange stock. Production and
      // physical receipts are the sole positive replenishment path.
      supply: Math.max(0, listing.supply - def.liquidity * 0.02 * demand * (0.5 + randomSupply)),
      demand: Math.max(0.55, Math.min(1.8, listing.demand * 0.82 + demand * (0.82 + randomDemand * 0.36) * 0.18))
    };
  }
  return { familyFor, profile, evolve };
});
