function addCommunications(map, city) {
  map = JSON.parse(JSON.stringify(map));
  const h = map.strategicNonStateNetworkHistory;
  h.networkRows.push({ networkId: 'original-relay-network', name: 'Original Aethercast', category: 'media', originCityId: city.cityId,
    sourceDefinitionId: 'non-state-network.shared.aethercast', organizationalContinuity: true, lifecycleStatus: 'active', privatePriority: 'expandAccess' });
  h.branchRows.push({ id: 'original-relay-office', networkId: 'original-relay-network', currentCityId: city.cityId,
    publicName: 'Original local relay gateway', publicPhysicalPresence: true, operationalStatus: 'active', physicalCondition: 'intact',
    currentCapacityBand: 'functional', currentStanding: 'licensed', organizationForm: 'orbitalRelayGateway' });
  h.eventRows ||= []; h.eventRows.push({ kind: 'advancedServiceActivated', networkIds: ['original-relay-network'],
    exactFactors: { capabilityId: 'orbitalArcaneRelayMesh' } });
  map.strategicCapabilityHistory ||= { milestoneRows: [] };
  map.strategicCapabilityHistory.milestoneRows.push({ infrastructureRows: [{ id: 'original-orbital-backbone:a', cityId: city.cityId,
    function: 'orbitalControlGateway', operationalAtPlayableYear: true }] });
  const institutionId = city.institutions.find(i => i.role === 'publicWorksAndProvisioning').id;
  map.cityGovernments = { governments: [{ cityId: city.cityId, charter: { id: city.charterId },
    roleAssignments: { publicWorksAndProvisioning: institutionId }, institutions: [{ id: institutionId }] }] };
  map.strategicCivicHistory = { currentInstitutionRows: [{ institutionId, actualControlStatus: 'localCharter', operationalStatus: 'operational' }] };
  return map;
}
module.exports = { addCommunications };
