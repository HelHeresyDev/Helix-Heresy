const Religion = require('../../religious-recognition');
const Faiths = require('../../strategic-faiths');
const Charter = require('../../charter-recognition');
const Resistance = require('../../incumbent-resistance');
const Succession = require('../../city-succession');
const Bargains = require('../../sovereign-bargains');
const Institutions = require('../../home-institution-context');
const copy = v => JSON.parse(JSON.stringify(v));
function patronSource(cityId = 'a', charterId = 'charter:a', teaching = 'cooperationWithoutDivineSovereignty') {
  return { cityId, charterId, populationSourceId: 'population:a', godName: 'Auriel',
    branch: { id: 'branch:a', publicName: 'Local Temple of Auriel', currentCityId: cityId, originalCityId: cityId,
      traditionId: 'faith:a', publicPhysicalPresence: true, operationalStatus: 'active', divineRelationship: 'authenticated',
      currentStanding: 'recognized', capacityBand: 'exceptional' },
    faith: { id: 'faith:a', godId: 'god:a', name: 'The Faith of Auriel', confirmation: { state: 'activelyConfirmed', doctrineRevision: 1 },
      civicTeaching: { position: teaching, summary: teaching, churchHasAutomaticSovereignty: false },
      // This prepared patron is an explicit rare exception, not the ordinary generated policy.
      hereticTeaching: Faiths.hereticTeachingFor('mortalAutonomy'),
      commandments: [{ id: 'aid', summary: 'Protect communities' }], prohibitions: [{ id: 'sanctuary', summary: 'Do not betray sanctuary' }],
      acceptableMethods: [{ id: 'proportional', tags: ['proportionality'] }] },
    communicationMethods: ['answered hearth-prayer'], god: { id: 'god:a', lifecycle: { lifeState: 'living', divinityState: 'divine' },
      divineCore: { identityBound: true, receivingCapacity: 600, repeatableSignature: 'divine-signature:actual-original' },
      power: { reserve: 100, reserveCapacity: 100 }, expenditures: { communication: 7 } } };
}
function civicFixture(theme = 'madcap', required = true) {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a', active: true, channelPowered: true,
    clerk: { id: 'clerk:a', locationId: 'office:a', status: 'alive', health: 100 }, power: 30, workSeconds: 14400, assignment: null, records: [] };
  const requirement = { godId: 'god:a', faithId: 'faith:a', authorizationId: 'a:designation-patron:god:a', scope: Religion.SCOPE };
  const rule = { id: 'rule:a', principle: Succession.CHARTERS[0], reviewInstitutionId: 'review:a',
    coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: required ? [requirement.authorizationId] : [],
    ...(required ? { patronRequirement: requirement } : {}), text: 'An explicit prepared local law.' };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], designationReview: rule, administrationId: office.institutionId, defenseId: 'defense:a',
    populationSourceId: 'population:a', archive: { coverage: [{ cellId: 'a' }] },
    institutions: Succession.ROLES.map(role => ({ role, id: role === 'centralAdministration' ? office.institutionId : role === 'civicReview' ? 'review:a' : `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme }), succession = Succession.create(source, b, office, { theme });
  const abdication = Resistance.create(succession, b, office, theme);
  succession.ruler.personalDefense.policy = 'preserveLife'; succession.ruler.health = 34;
  const c = { alive: true, capable: true, local: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true, busy: false,
    activeViolence: false, charterCurrent: true, cityId: 'a', authorityId: 'ruler:a', bodyEpoch: 0,
    rulerPresent: true, rulerDistanceM: 1, rulerLineOfEffect: true, cell: { x: 17, y: 8, z: 6 }, recordWitnesses: [office.clerk.id],
    administrationAvailable: true, reviewAvailable: true, rule: copy(rule), authorizationIds: [], conduct: [],
    presentIds: succession.leaders.map(a => a.id), sourceCurrent: true, branchAvailable: true, channelAvailable: true, representativePresent: true };
  if (!Resistance.demand(abdication, succession, c, 0) || !Resistance.accept(abdication, succession, office, copy(abdication.terms), c, 0)) throw new Error('Actual declaration setup failed');
  Resistance.advance(abdication, succession, office, c, 60); c.claim = copy(abdication.receipt);
  const charter = Charter.create(succession, abdication, office, theme), institutions = Institutions.create({ cityId: 'a' },
    source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 60);
  Charter.admin(charter, succession).recognitionPolicy = 'considerAdministrativeContinuity';
  const origin = patronSource(), s = Religion.create(origin, office, theme); s.actor.facilitationPolicy = 'considerScopedPetition';
  return { s, origin, charter, succession, abdication, office, institutions, c, at: 60 };
}
module.exports = { patronSource, civicFixture };
