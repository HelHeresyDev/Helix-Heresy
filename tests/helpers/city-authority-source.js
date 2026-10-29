const { sources } = require('./regional-government-source');
const A = require('../../city-authority');
function sourceMap(kind = 'collective', status = 'sovereign') {
  const inputs = ['a', 'controller'].map(cityId => {
    const input = sources(cityId), authority = { id: cityId === 'a' && kind === 'collective' ? 'council:a' : `ruler:${cityId}`, kind: cityId === 'a' ? kind : 'individual', name: `Original ${cityId}` };
    return { cityId, input, authority };
  });
  const map = {
    cityPolities: { polities: inputs.map(s => ({ id: `polity:${s.cityId}`, cityId: s.cityId, authority: s.authority })) },
    cityGovernments: { governments: inputs.map(s => ({ cityId: s.cityId, sovereigntyScope: 'cityOnly',
      charter: { id: `charter:${s.cityId}`, decisionRule: s.authority.kind === 'collective'
        ? 'The sovereign authority acts by recorded internal resolution; delegated offices act within published mandates.'
        : 'The sovereign authority may issue recorded directives; delegated offices act within published mandates and review limits.',
      successionPrinciple: 'internal selection under sealed vote', politicalAgreements: { id: `charter:${s.cityId}:external-political-agreements`,
        authority: 'currentRecognizedSovereign', individualRule: 'recordedPersonalDirective', collectiveRule: 'unanimousThreeDelegateResolution', collectiveSeats: 3 } },
      roleAssignments: Object.fromEntries(s.input.operation.institutions.map(i => [i.role, i.id])), institutions: s.input.operation.institutions })) },
    strategicPlayableSettlementState: { cityRows: inputs.map(s => ({ cityId: s.cityId, name: `Original ${s.cityId}`, assetId: `population:${s.cityId}`,
      currentPopulation: s.cityId === 'a' && status === 'displacedClaim' ? 0 : 3000,
      physicalJurisdictionExists: s.cityId !== 'a' || status !== 'displacedClaim', physicalCondition: s.cityId === 'a' && status === 'displacedClaim' ? 'ruined' : 'intact',
      populationLedger: { departures: s.cityId === 'a' && status === 'displacedClaim' ? 3000 : 0 } })) },
    strategicCivicHistory: { currentInstitutionRows: inputs.flatMap(s => s.input.operation.institutions.map(i => ({ institutionId: i.id,
      operationalStatus: status === 'displacedClaim' && s.cityId === 'a' ? 'displaced' : 'operational',
      actualControlStatus: s.cityId === 'a' && ['puppet', 'occupied'].includes(status) ? status === 'puppet' ? 'capturedAppointments' : 'overtOccupation' : 'localCharter',
      actualControllerPolityId: s.cityId === 'a' && ['puppet', 'occupied'].includes(status) ? 'polity:controller' : `polity:${s.cityId}` }))) },
    strategicPoliticalHistory: { actorRows: [], currentControlRows: inputs.map(s => ({ cityId: s.cityId, sovereignPolityId: `polity:${s.cityId}`,
      recognizedAuthorityId: s.authority.id, controlStatus: s.cityId === 'a' ? status : 'sovereign',
      effectiveControllerPolityId: s.cityId === 'a' && ['puppet', 'occupied'].includes(status) ? 'polity:controller' : `polity:${s.cityId}`,
      tributeToPolityId: s.cityId === 'a' && status === 'tributary' ? 'polity:controller' : null,
      covertPuppetSponsorPolityId: s.cityId === 'a' && status === 'puppet' ? 'polity:controller' : null,
      ...(s.cityId === 'a' && status === 'displacedClaim' ? { claimantChannel: { id: 'original-retained-claimant-channel',
        authorityId: s.authority.id, institutionId: 'admin:a', causeId: 'original-destruction-and-displacement',
        operatorId: 'original-displaced-custodian', workSeconds: 1800, powerUnits: 12 } } : {}) })),
    eventRows: status === 'displacedClaim' ? [{ id: 'original-destruction-and-displacement', kind: 'claimantDisplacement', location: { cityId: 'a' },
      stateDelta: { physicalJurisdictionExists: false }, discoverableHooks: ['displacedClaimantBroadcast'] }] : [] }
  };
  return { map, inputs, political: A.sourceFromWorld(map, 'a'), operation: inputs[0].input.operation, defense: inputs[0].input.defense };
}
module.exports = { sourceMap };
