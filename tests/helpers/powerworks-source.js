const { world } = require('./network-operating-source');
function inputs(populationSourceId = 'population:a', powerId = 'original-power:a') {
  const map = world(), h = map.strategicNonStateNetworkHistory;
  Object.assign(h.networkRows[0], { category: 'research', actualCapacityBand: 'established', sourceDefinitionId: 'non-state-network.shared.open-lattice' });
  for (const b of h.branchRows) Object.assign(b, { organizationForm: 'localLaboratory', currentStanding: 'licensed' });
  Object.assign(map.strategicPlayableSettlementState.cityRows[0], { assetId: populationSourceId, currentPopulation: 3000 });
  map.strategicCapabilityHistory = { milestoneRows: [{ infrastructureRows: [{ id: powerId, cityId: 'a',
    function: 'powerWorks', operationalAtPlayableYear: true, hiddenConditionBand: 'serviceable' }] }] };
  return map;
}
module.exports = { inputs };
