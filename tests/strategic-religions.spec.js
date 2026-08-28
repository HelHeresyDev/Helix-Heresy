// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Religions = require('../strategic-religions');
const StrategicWorld = require('../strategic-world');
const GlobeRenderer = require('../strategic-globe-renderer');

function generatedMap(seed = 'religion-world', worldTheme = 'unbound') {
  return Library.createWorld({ id: `religions-${seed}-${worldTheme}`, worldSeed: seed, worldTheme, createdAt: 'test' }).generatedData.strategicMap;
}

function resignReligions(map) {
  const directory = map.publicReligionDirectory;
  delete directory.digest;
  directory.digest = `public-religions-${StrategicWorld.stableHash(directory)}`;
  const record = map.strategicReligions;
  record.publicDirectoryDigest = directory.digest;
  delete record.digest;
  record.digest = `strategic-religions-${StrategicWorld.stableHash({
    sourceArcaneGeographyDigest: record.sourceArcaneGeographyDigest,
    sourceDivinityDigest: record.sourceDivinityDigest,
    sourcePreCivicFaithDigest: record.sourcePreCivicFaithDigest,
    sourceBeastEcologyDigest: record.sourceBeastEcologyDigest,
    sourceCityRecognitionDigest: record.sourceCityRecognitionDigest,
    publicDirectoryDigest: record.publicDirectoryDigest,
    hiddenGodStateCodes: record.hiddenGodStateCodes,
    hiddenBranchIntegrityCodes: record.hiddenBranchIntegrityCodes,
    diagnostics: record.diagnostics,
  })}`;
  map.digest = StrategicWorld.strategicMapDigest(map);
}

test('real finite gods, communication, avatars, and public facts are deterministic', () => {
  const map = generatedMap('objective-divinity');
  const same = generatedMap('objective-divinity');
  const audit = Religions.auditStrategicReligions(map);

  expect(map.strategicReligions).toEqual(same.strategicReligions);
  expect(map.publicReligionDirectory).toEqual(same.publicReligionDirectory);
  expect(audit).toMatchObject({
    valid: true,
    everyGodObjectivelyReal: true,
    everyGodFinite: true,
    routineDirectCommunication: true,
    everyGodAvatarCapable: true,
  });
  for (const god of Religions.publicReligionDirectory(map).gods) {
    expect(god).toMatchObject({
      kind: 'realFiniteGod',
      objectiveExistence: 'confirmed',
      omnipotent: false,
      omniscient: false,
      attentionFinite: true,
      communication: { routine: true, faithfulMayReceiveDirectReplies: true, identityVerification: 'repeatableDivineSignature' },
      avatarManifestation: { possible: true, strategicallySignificant: true },
      divineStanding: { rank: expect.stringMatching(/^(minor|major)$/), publicStatus: 'active', exactPowerPublic: false },
    });
  }
});

test('each god confirms exactly one faith with no same-god heresy or schism', () => {
  const map = generatedMap('one-faith-per-god', 'grim');
  const directory = Religions.publicReligionDirectory(map);
  const divineFaiths = directory.traditions.filter((tradition) => tradition.kind === 'confirmedDivineFaith');

  expect(divineFaiths).toHaveLength(directory.gods.length);
  for (const god of directory.gods) {
    const faiths = divineFaiths.filter((faith) => faith.deityIds[0] === god.id);
    expect(faiths).toHaveLength(1);
    expect(faiths[0]).toMatchObject({ preCivicFaithId: faiths[0].id, confirmationState: 'activelyConfirmed', doctrinalSchismAvailable: false, sameGodHeresyClaimsValid: false, correctionAuthority: god.id, correctionChannel: 'routineDirectDivineCommunication', confirmedDoctrine: god.doctrine });
    expect(directory.networks.filter((network) => network.traditionId === faiths[0].id)).toEqual([
      expect.objectContaining({ kind: 'singleGodChurchNetwork', recognizedByDeityId: god.id, sovereignAuthority: false, physicalAuthority: 'localBranchesOnly' }),
    ]);
  }
  expect(Religions.auditStrategicReligions(map)).toMatchObject({ exactlyOneConfirmedFaithPerGod: true, noSameGodHeresyOrSchism: true });
});

test('every city publishes standing while physical branches remain locally bound', () => {
  const map = generatedMap('city-religious-standing');
  const directory = Religions.publicReligionDirectory(map);

  expect(directory.standingRows).toHaveLength(map.humanGeography.cities.length);
  expect(directory.standingRows.every((row) => row.length === directory.traditions.length)).toBe(true);
  expect(directory.standingRows.every((row) => [...row].filter((code) => code === 'e').length <= 1)).toBe(true);
  for (const city of map.humanGeography.cities) {
    const standing = Religions.cityReligiousStanding(map, city.id);
    expect(standing.standings).toHaveLength(directory.traditions.length);
    for (const entry of standing.standings) {
      if (['established', 'recognized'].includes(entry.standing)) expect(entry.branch).toBeTruthy();
      if (entry.standing === 'proscribed') expect(entry.branch).toBeNull();
    }
  }
  expect(directory.branches.every((branch) => branch.internetConnection === 'globalNetworkBranch' && branch.physicalScope === 'thisCityAndItsControlledPropertyOnly' && branch.sovereignAuthority === false && branch.roles.length === 5)).toBe(true);
});

test('holy sites are unique physical and divinely confirmed strategic facts', () => {
  const map = generatedMap('confirmed-holy-sites');
  const directory = Religions.publicReligionDirectory(map);

  expect(directory.holySites.length).toBe(map.preCivicFaiths.diagnostics.holySiteCount);
  expect(new Set(directory.holySites.map((site) => site.cellId)).size).toBe(directory.holySites.length);
  for (const site of directory.holySites) {
    const index = StrategicWorld.cellIndex(site.cellId);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(map.topology.cellCount);
    expect(site).toMatchObject({ confirmedByGod: true, divineActivity: 'active', routineCommunicationRequired: false, publicEffects: expect.arrayContaining(['boundedManifestationSupport']) });
    expect(site.causalFactors.join(' ')).not.toMatch(/city|corridor|beastPressure|population/i);
    expect(Religions.cellPublicReligionSnapshot(map, index).holySites).toContainEqual(site);
  }
  expect(GlobeRenderer.availableLayers(map)).toContain('religions');
  expect(GlobeRenderer.legendForLayer('religions').map((entry) => entry.label)).toEqual(expect.arrayContaining(['Confirmed holy site', 'City with established faith']));
});

test('theme selection changes compatible divine content without changing divine reality or limits', () => {
  const maps = ['madcap', 'grim', 'unbound'].map((theme) => generatedMap('theme-divinity', theme));
  const allowed = { madcap: new Set(['shared', 'madcap']), grim: new Set(['shared', 'grim']), unbound: new Set(['shared', 'madcap', 'grim']) };
  for (const [index, map] of maps.entries()) {
    const theme = ['madcap', 'grim', 'unbound'][index];
    expect(map.publicReligionDirectory.gods.every((god) => allowed[theme].has(god.themeContent.sourceTheme))).toBe(true);
    expect(map.publicReligionDirectory.gods.every((god) => god.objectiveExistence === 'confirmed' && !god.omnipotent && !god.omniscient && god.avatarManifestation.possible)).toBe(true);
  }
  expect(new Set(maps[2].publicReligionDirectory.gods.map((god) => god.themeContent.sourceTheme))).toEqual(new Set(['shared', 'madcap', 'grim']));
});

test('public religion records hide current divine attention and validation rejects theological contradictions', () => {
  const map = generatedMap('religion-integrity');
  const firstGod = map.publicReligionDirectory.gods[0];
  const hidden = Religions.hiddenDivineStateFor(map, firstGod.id);

  expect(JSON.stringify(map.publicReligionDirectory)).not.toContain('hiddenGodStateCodes');
  expect(JSON.stringify(map.publicReligionDirectory)).not.toContain('currentAttentionBand');
  expect(hidden).toMatchObject({ godId: firstGod.id, omniscient: false, publicInferencePermitted: false });

  const altered = JSON.parse(JSON.stringify(map));
  altered.publicReligionDirectory.gods[0].objectiveExistence = 'disputed';
  resignReligions(altered);
  expect(() => Religions.validateStrategicReligions(altered)).toThrow(/objectively real|real, finite/i);

  const leaked = JSON.parse(JSON.stringify(map));
  leaked.publicReligionDirectory.hiddenGodStateCodes = leaked.strategicReligions.hiddenGodStateCodes;
  resignReligions(leaked);
  expect(() => Religions.validateStrategicReligions(leaked)).toThrow(/leaks hidden divine/i);
});
