const N = require('../../network-operations');
function world() {
  return { strategicNonStateNetworkHistory: {
    networkRows: [{ networkId: 'original-network', name: 'Original Intercity Network', originCityId: 'b', category: 'military',
      privatePriority: 'secureSupply', organizationalContinuity: true, lifecycleStatus: 'active' }],
    branchRows: ['a', 'b', 'c'].map(id => ({ id: `branch:${id}`, networkId: 'original-network', currentCityId: id,
      publicName: `Original ${id.toUpperCase()} Chapter`, publicPhysicalPresence: true, operationalStatus: 'active', physicalCondition: 'intact', currentCapacityBand: 'functional' })),
    covertRows: [{ id: 'original-undisclosed-cell', networkId: 'original-network', cityId: 'c', status: 'active' }],
    affiliateRows: [{ id: 'original-opaque-affiliate', actualParentNetworkId: 'original-network', lifecycleStatus: 'active' }]
  }, strategicPlayableSettlementState: { cityRows: ['a', 'b', 'c'].map(cityId => ({ cityId, assetId: `population:${cityId}`,
    currentPopulation: 100, physicalJurisdictionExists: true, physicalCondition: 'intact', services: { communications: 'functional' } })) } };
}
// This fixed seed elaborates A's autonomous and C's delegated charter before
// any request, report, target, combat or strength is known. Never reroll at play.
function source() { return N.sources(world(), 'original:5'); }
module.exports = { world, source };
