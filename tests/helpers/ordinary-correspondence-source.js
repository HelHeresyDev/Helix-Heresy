const Library = require('../../world-run-library');
const Faiths = require('../../strategic-faiths');
const Divinity = require('../../strategic-divinity');
const World = require('../../strategic-world');
const Correspondence = require('../../descended-correspondence');
const Communications = require('../../civic-communications');
const copy = x => JSON.parse(JSON.stringify(x));
let cached;
function ordinaryMap(city = { cityId: 'a', charterId: 'charter:a', populationSourceId: 'population:a',
  institutions: [{ id: 'works:a', role: 'publicWorksAndProvisioning' }] }) {
  city = { ...city, populationSourceId: city.populationSourceId || `${city.cityId}:original-population`,
    institutions: city.institutions || [{ id: `${city.cityId}:original-public-works`, role: 'publicWorksAndProvisioning' }] };
  cached ||= Library.createWorld({ id: 'ordinary-source', worldSeed: 'ordinary-original', worldTheme: 'unbound', generationVersion: 7, createdAt: 'test' }).generatedData.strategicMap;
  const faiths = Faiths.publicFaithDirectory(cached).faiths.slice(0, 2);
  const rows = faiths.map(f => copy(cached.publicPreCivicFaithDirectory.faithRows.find(r => r[0] === f.id)));
  // Change only original authored teaching inputs, before allocating people or
  // messages. Use the real semantic codec/digest rather than a canned reply.
  rows[0][10] = 'mortalAutonomy';
  rows[0][9] = World.stableHash({ ...faiths[0], hereticTeaching: Faiths.hereticTeachingFor('mortalAutonomy') });
  const gods = faiths.map(f => {
    const g = copy(Divinity.privateDivineStateFor(cached, f.godId));
    g.lifecycle.divinityState = 'descended'; g.divineCore.state = 'dormant'; g.power.reserve = 0;
    g.descendedMortalPower.condition = 'activeFormerGod'; return g;
  });
  const works = city.institutions.find(i => i.role === 'publicWorksAndProvisioning').id;
  const map = {
    publicPreCivicFaithDirectory: { faithRows: rows, holySiteRows: [] },
    strategicDivineHistory: { currentGodRows: gods, eventRows: [], currentFaithRows: faiths.map(f => ({ faithId: f.id, confirmationState: 'historicallyConfirmed' })) },
    publicReligionDirectory: { gods: gods.map((g, i) => ({ id: g.id, name: i ? 'Boreal' : 'Auriel' })) },
    publicReligiousInstitutionHistoryDirectory: { traditionRows: faiths.map(f => ({ id: f.id, kind: 'confirmedDivineFaith' })), currentBranchRows: [] },
    strategicPlayableSettlementState: { cityRows: [{ cityId: city.cityId, assetId: city.populationSourceId, physicalJurisdictionExists: true,
      physicalCondition: 'intact', currentPopulation: 3000, services: { communications: 'functional' } }] },
    strategicCapabilityHistory: { milestoneRows: [{ infrastructureRows: [{ id: 'original-orbital-backbone:a', cityId: city.cityId,
      function: 'orbitalControlGateway', operationalAtPlayableYear: true }] }] },
    cityGovernments: { governments: [{ cityId: city.cityId, charter: { id: city.charterId }, roleAssignments: { publicWorksAndProvisioning: works }, institutions: [{ id: works }] }] },
    strategicCivicHistory: { currentInstitutionRows: [{ institutionId: works, actualControlStatus: 'localCharter', operationalStatus: 'operational' }] }
  };
  const branches = map.publicReligiousInstitutionHistoryDirectory.currentBranchRows;
  // Original input IDs are selected before allocation, never mutate a live
  // custodian policy or a result to get past a refusal.
  for (const [faith, disclosed, name] of [[faiths[0], true, 'Retained Auriel Archive'], [faiths[0], true, 'Second Auriel Archive'],
    [faiths[0], false, 'Closed Auriel Archive'], [faiths[1], true, 'Retained Boreal Archive']]) {
    for (let n = branches.length; ; n++) {
      const b = { id: `${name.replaceAll(' ', '-')}:${n}`, publicName: name, traditionId: faith.id, currentCityId: city.cityId,
        originalCityId: city.cityId, publicPhysicalPresence: true, internetContinuity: true, operationalStatus: 'active',
        divineRelationship: 'historicallyConfirmed', currentStanding: 'recognized' };
      branches.push(b);
      const own = Correspondence.sources(map, Communications.sources(map)).find(s => s.branchId === b.id);
      if (own && (own.disclosure === 'releaseScopedAddress') === disclosed) break;
      branches.pop();
    }
  }
  return map;
}
module.exports = { ordinaryMap };
