const Works = require('../../corridor-works');
function fixture() {
  const endpointIds = ['a', 'b'], raw = 'original-ab', id = `corridor:${raw}`;
  const route = { id, corridorId: raw, endpointCityIds: endpointIds, distanceKm: 2, continuity: 'closed', supportCapable: false,
    cellPath: ['planet-cell:00001', 'planet-cell:00002', 'planet-cell:00003'] };
  const services = { utilities: 'functional', provisioning: 'functional', transport: 'functional' };
  const map = { routeGraph: { routes: [{ id: raw, endpointIds, cellPath: route.cellPath, lengthKm: 2 }] },
    cityExpansionHistory: { strongholdRows: [{ id: 'original-fort:ab', name: 'Original Joint Fort', corridorId: raw, ordinal: 0,
      cellId: route.cellPath[1], sponsorCityIds: endpointIds, sponsorContributionRows: [['a', 35, 35], ['b', 65, 65]],
      administration: 'dividedSponsorFacilities', serviceMode: 'groundConvoy' }] },
    strategicPlayableSettlementState: {
      routeRows: [{ corridorId: raw, endpointCityIds: endpointIds, requiredStrongholdIds: ['original-fort:ab'], physicalState: 'severed',
        continuity: 'closed', supportCapable: false, lastCauseEventId: 'original-crisis' }],
      cityRows: endpointIds.map(cityId => ({ cityId, assetId: `people:${cityId}`, currentPopulation: 100, physicalCondition: 'intact' })),
      strongholdRows: [{ strongholdId: 'original-fort:ab', name: 'Original Joint Fort', assetId: 'population:fort', currentPopulation: 100,
        physicalCondition: 'intact', habitationStatus: 'inhabited', services }] },
    strategicCrisisHistory: { eventRows: [{ id: 'original-crisis', stateDelta: { infrastructureDeltas: [
      { assetId: raw, kind: 'supportCorridor', resultingState: 'severed' }] } }] },
    cityGovernments: { governments: endpointIds.map(cityId => ({ cityId, charter: { id: `charter:${cityId}` },
      roleAssignments: { publicWorksAndProvisioning: `works:${cityId}` }, institutions: [{ id: `works:${cityId}`, capacityBand: 'functional' }] })) },
    cityPolities: { polities: endpointIds.map(cityId => ({ cityId, authority: { id: `ruler:${cityId}` } })) } };
  const network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a',
    destinations: [{ id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'old-a', localDistanceKm: 1,
      routeContinuity: 'municipal', cellId: route.cellPath[0] }, ...['a', 'b', 'c', 'd'].map(cityId => ({
      id: `city:${cityId}`, kind: 'fortifiedCity', cityId, label: `City ${cityId}`, known: true, supportComponentId: `old-${cityId}`,
      jurisdiction: { kind: 'city', cityId }, cellId: route.cellPath[0] }))], routes: [route,
      { id: 'untouched-cd', endpointCityIds: ['c', 'd'], distanceKm: 2, continuity: 'closed', supportCapable: false, cellPath: [] }] };
  const source = Works.sourceFromWorld(map, route, () => 1);
  if (!source) throw new Error('Original causal corridor fixture rejected');
  return { map, route, network, source };
}
module.exports = { fixture };
