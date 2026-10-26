const { world } = require('./network-operating-source');
function inputs(populationSourceId = 'population:a') {
  const map = world(), h = map.strategicNonStateNetworkHistory;
  Object.assign(h.networkRows[0], { category: 'commercial', actualCapacityBand: 'established', sourceDefinitionId: 'non-state-network.shared.meridian-holdings' });
  for (const b of h.branchRows) Object.assign(b, { organizationForm: 'registeredOffice', currentStanding: 'licensed' });
  Object.assign(map.strategicPlayableSettlementState.cityRows[0], { assetId: populationSourceId, currentPopulation: 3000 });
  const profile = { cityId: 'a', cityName: 'Aster', workshopCapacity: 1, listings: {},
    manufacturingFacilities: [{ id: 'a:original-crystal-works', kind: 'crystalWorks', siteId: 'original-industrial-site',
      expertise: ['crystalPreparation'], condition: 100, labour: 1, utilities: 1, routeOpen: true }],
    productionSources: [{ id: 'original-mana-mine:a', name: 'Original mana mine', family: 'manaCrystals', capacity: 1,
      route: { open: true, distanceKm: 4, cellIds: ['planet-cell:00001'], mode: 'groundConvoy' } }] };
  return { map, profile };
}
module.exports = { inputs };
