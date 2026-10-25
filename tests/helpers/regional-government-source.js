const Rule = require('../../city-rule');
const Succession = require('../../city-succession');
// Original source inputs, not handover, control, service or accomplishment flags.
function sources(cityId = 'b', authorityName = 'Original Keeper') {
  const institutions = Rule.ROLES.map(role => ({ role, id: role === 'centralAdministration' ? `admin:${cityId}` : `${role}:${cityId}`, name: role }));
  const succession = { cityId, cityName: `City ${cityId}`, charterId: `charter:${cityId}`,
    authority: { id: `ruler:${cityId}`, name: authorityName, kind: 'individual' },
    succession: Succession.CHARTERS[0], populationSourceId: `population:${cityId}`, population: 3000,
    institutions, administrationId: `admin:${cityId}`, defenseId: `militaryDefenseCommand:${cityId}`,
    defenseName: 'Original municipal ward branch', archive: { routeId: 'route:ab', coverage: [
      { cellId: 'planet-cell:00001', latitude: 0, longitude: 0 }, { cellId: 'planet-cell:00002', latitude: 1, longitude: 1 }] } };
  const farm = { cityId, cityName: succession.cityName, charterId: succession.charterId,
    institutionId: `publicWorksAndProvisioning:${cityId}`, populationSourceId: succession.populationSourceId,
    cityPopulation: 3000, satelliteId: `farm:${cityId}`, satelliteName: 'Original municipal farm', satellitePopulation: 600,
    cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002', arableLandBand: 'productive',
    storageDays: 3, distanceKm: 2, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
  return { succession, operation: { cityId, cityName: succession.cityName, charterId: succession.charterId,
    populationSourceId: succession.populationSourceId, population: 3000, institutions,
    worksId: `water-wall:${cityId}`, powerId: `power:${cityId}`, reserveDays: 5, farms: [farm], baselineAuthorityId: succession.authority.id },
  defense: { cityId, charterId: succession.charterId, institutionId: succession.defenseId,
    populationSourceId: succession.populationSourceId, population: 3000, condition: 80,
    installationId: `original-ward:${cityId}`, baselineEnergy: 69120 } };
}
module.exports = { sources };
