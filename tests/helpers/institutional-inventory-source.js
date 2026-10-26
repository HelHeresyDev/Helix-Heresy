const Definitions = require('../../strategic-non-state-networks').NETWORK_DEFINITIONS;
const Networks = require('../../network-operations');
function world(definitions = Definitions, population = 256) {
  const h = { networkRows: [], branchRows: [], affiliateRows: [], covertRows: [], eventRows: [] };
  const cities = [], infrastructure = [];
  definitions.forEach((definition, i) => {
    const cityId = `city:${i}`, networkId = `original:${i}`, branchId = `branch:${i}`;
    const form = { commercial: 'registeredOffice', research: 'localLaboratory', transport: 'contractDepot', military: 'escortChapter',
      standards: 'standardsBureau', media: 'relayStudio', blackMarket: 'brokerFront' }[definition.category];
    cities.push({ cityId, assetId: `population:${i}`, currentPopulation: population, physicalJurisdictionExists: true,
      physicalCondition: 'intact', services: { transport: 'functional', communications: 'functional' } });
    infrastructure.push({ id: `power:${i}`, cityId, function: 'powerWorks', operationalAtPlayableYear: true });
    h.networkRows.push({ networkId, name: definition.id, originCityId: cityId, category: definition.category,
      sourceDefinitionId: definition.id, organizationalContinuity: true, lifecycleStatus: 'active', actualCapacityBand: 'established' });
    h.branchRows.push({ id: branchId, networkId, currentCityId: cityId, originalCityId: cityId, organizationForm: form,
      publicName: `${definition.id} original office`, publicPhysicalPresence: true, currentStanding: 'licensed',
      operationalStatus: 'active', physicalCondition: 'intact', currentCapacityBand: 'functional' });
    h.affiliateRows.push({ id: `affiliate:${i}`, actualParentNetworkId: networkId, registrationCityId: cityId,
      lifecycleStatus: 'active', declaredActivity: ['chemicalSupply', 'technicalConsulting', 'freightBrokerage', 'dataServices', 'equipmentLeasing', 'riskManagement'][i % 6] });
    h.covertRows.push({ id: `cell:${i}`, networkId, cityId, kind: ['brokerCell', 'smugglingCoordinator', 'launderingOffice', 'informantExchange'][i % 4], status: 'active' });
  });
  return { strategicNonStateNetworkHistory: h, strategicPlayableSettlementState: { cityRows: cities },
    strategicCapabilityHistory: { milestoneRows: [{ infrastructureRows: infrastructure }] } };
}
const binding = { worldId: 'inventory-world', runId: 'inventory-run' };
function fixture(definitions, population) {
  const map = world(definitions, population), source = Networks.sources(map, 'fixed-original-inventory');
  const s = Networks.create(source, binding, 0, { originalInventory: true });
  return { map, source, s, binding };
}
module.exports = { Definitions, world, fixture, binding };
