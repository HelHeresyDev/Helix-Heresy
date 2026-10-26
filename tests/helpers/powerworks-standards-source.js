const { inputs } = require('./powerworks-source');
function source(populationSourceId = 'population:a', powerId = 'original-power:a') {
  const map = inputs(populationSourceId, powerId), h = map.strategicNonStateNetworkHistory;
  for (const id of ['measure', 'alternate-measure']) {
    h.networkRows.push({ ...h.networkRows[0], networkId: id, category: 'standards', name: id,
      sourceDefinitionId: 'non-state-network.shared.common-measure' });
    h.branchRows.push({ ...h.branchRows[0], id: `${id}:a`, networkId: id, publicName: `Original ${id} bureau`, organizationForm: 'standardsBureau' });
  }
  return map;
}
module.exports = { source };
