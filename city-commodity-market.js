(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityCommodityMarket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const groups = {
    biologicalProductivity: ['biomass', 'fieldRation', 'trailMeal'],
    constructionStone: ['stoneBlocks'], timberFiber: ['lumber', 'cloth', 'medicalBandage', 'filterBag', 'escortVest', 'fieldShelter'],
    ferrousOre: ['steelPanels', 'metalParts', 'escortBaton', 'satelliteCommunicator'],
    baseMetalOre: ['relayBattery'],
    industrialMinerals: ['bricks', 'glass', 'sealedCollectionJar', 'linedScrapeJar', 'condenserFlask', 'mixedOutputJar', 'sealedReagentBottle'],
    chemicalFeedstock: ['rubber', 'assayReagent', 'neutralizingWash', 'membraneSealant', 'helixBufferSolution'],
    freshWater: ['drinkingWater']
  };
  const familyFor = id => Object.keys(groups).find(k => groups[k].includes(id)) || 'manufacturedGoods';
  const condition = value => ({ intact: 1, worn: 0.85, damaged: 0.5, ruined: 0 }[value] ?? 1);
  function profile(cityId, directory, current, definitions) {
    const foundation = directory?.foundations?.find(f => f.city.id === cityId);
    if (!foundation) return null;
    const city = current?.cityRows?.find(c => c.cityId === cityId || c.assetId === cityId);
    const viable = !['abandoned', 'destroyed'].includes(city?.habitationStatus) && city?.physicalCondition !== 'ruined';
    const utilities = ({ failed: 0.3, fragile: 0.55, strained: 0.8, functional: 1, strong: 1.1 }[city?.services?.utilities] ?? 1);
    const infrastructure = viable ? condition(city?.physicalCondition) * utilities : 0;
    const population = ({ trace: 0.65, small: 0.75, modest: 0.85, substantial: 1, large: 1.15, immense: 1.3 }[city?.populationBand] ?? 1);
    const output = {}, reasons = {};
    const add = (family, amount, label) => { if (!family || amount <= 0) return; output[family] = (output[family] || 0) + amount; (reasons[family] ||= []).push(label); };
    for (const f of [foundation.primaryExploitation, foundation.secondaryExploitation]) if (f) add(f.id, 0.5 * infrastructure, `Published local exploitation: ${f.label || f.id}.`);
    add('biologicalProductivity', ({ marginal: 0, limited: 0.1, productive: 0.25, abundant: 0.4 }[foundation.arableLandBand] || 0) * infrastructure, `Nearby arable land: ${foundation.arableLandBand}.`);
    // Only directly dependent satellites; joint strongholds and foreign cities are not free imports.
    for (const satellite of directory.satellites || []) {
      if (satellite.parentId !== cityId) continue;
      const status = current?.satelliteRows?.find(r => r.satelliteId === satellite.id || r.assetId === satellite.id);
      if (['abandoned', 'destroyed'].includes(status?.habitationStatus)) continue;
      const size = ({ camp: 0.06, hamlet: 0.09, village: 0.12, town: 0.18 }[satellite.sizeBand] ?? 0.06);
      add(satellite.exportResource?.id, size * condition(status?.physicalCondition) * infrastructure, `Local ${satellite.function} settlement: ${satellite.name}.`);
    }
    const listings = {};
    for (const def of definitions) {
      const family = familyFor(def.id), abundance = Math.min(1.4, output[family] || 0);
      const supplyFactor = infrastructure * (0.5 + abundance);
      const demand = Math.max(0.55, Math.min(1.8, population + (1 - infrastructure) * 0.25 + (abundance ? 0 : 0.15)));
      listings[def.id] = { targetSupply: Math.round(def.supply * supplyFactor), targetDemand: demand,
        reasons: [...new Set(reasons[family] || ['No published local production anchor for this commodity family; limited merchant stocks.']), `City infrastructure: ${city?.physicalCondition || 'not reported'}; utilities: ${city?.services?.utilities || 'not reported'}; population: ${city?.populationBand || 'not reported'}.`] };
    }
    return { cityId, cityName: foundation.city.name || foundation.city.label || cityId, playableYear: current?.playableYear ?? null, source: 'publicSettlementFacts', listings };
  }
  function evolve(listing, baseline, def, randomSupply, randomDemand) {
    const target = baseline?.targetSupply ?? def.supply, demand = baseline?.targetDemand ?? 1;
    return {
      supply: Math.max(baseline ? 0 : 1, listing.supply + (target - listing.supply) * 0.12 + (target > 0 ? (randomSupply - 0.48) * def.liquidity * 0.12 : 0)),
      demand: Math.max(0.55, Math.min(1.8, listing.demand * 0.82 + demand * (0.82 + randomDemand * 0.36) * 0.18))
    };
  }
  return { familyFor, profile, evolve };
});
