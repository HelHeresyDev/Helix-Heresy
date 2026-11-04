// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const DivineHistory = require('../strategic-divine-history');
const Faiths = require('../strategic-faiths');
const Religion = require('../religious-recognition');
const Bodies = require('../divine-bodies');
const Owners = require('../divine-capabilities');
const Wayfinding = require('../divine-wayfinding');

const cache = new Map();

test('original divine true bodies bind physical homes and retained human/beast power without changing the generated world or exposing a roster', () => {
  const map = generatedWorld().generatedData.strategicMap, original = JSON.stringify(map);
  const book = Owners.create(Owners.sources(map), { worldId: 'original-world', runId: 'new-branch' }, 0, true);
  const homes = Bodies.homes(map, book), s = Bodies.create(book, homes, 0);
  expect(s.bodies.length).toBeGreaterThan(0); expect(Bodies.known(s)).toEqual([]);
  expect(s.bodies.some(a => a.home.cityId)).toBe(true);
  for (const a of s.bodies) {
    const g = book.records.find(r => r.godId === a.godId).god;
    expect(a.maxHealth).toBe(200 + g.divineCore.innateCapacity * 4);
    expect(a.signature).toBe(g.divineCore.repeatableSignature);
    expect(a.home.cityId ? map.humanGeography.cities.some(c => c.id === a.home.cityId && c.cellId === a.home.cellId)
      : map.strategicDivineHistory.holySiteStateRows.some(h => h.siteId === a.home.placeId && h.cellId === a.home.cellId)
        || map.strategicDivineHistory.eventRows.some(e => e.cellId === a.home.cellId && e.participantIds.includes(a.godId))).toBe(true);
  }
  expect(JSON.stringify(map)).toBe(original);
  const independent = Bodies.create(Owners.create(Owners.sources(map), { worldId: 'original-world', runId: 'independent' }, 0, true), homes, 0);
  s.bodies[0].health -= 50; expect(independent.bodies[0].health).toBe(independent.bodies[0].maxHealth);
});

test('divine closeout wayfinding discovers and reaches every living original in the normal generated world without trimming sources or changing canonical data', () => {
  test.setTimeout(600000);
  const map = generatedWorld().generatedData.strategicMap, canonical = JSON.stringify(map);
  const book = Owners.create(Owners.sources(map), { worldId: 'normal', runId: 'closeout' }, 0, true);
  const s = Bodies.create(book, Bodies.homes(map, book), 0), initial = JSON.parse(JSON.stringify(book));
  expect(book.complete).toBe(true);
  expect(s.bodies.length).toBe(book.records.filter(r => r.god.lifecycle.lifeState === 'living').length);
  expect(s.bodies.some(a => !a.home.cityId)).toBe(true);
  let at = 0;
  // A finite model operation budget, not injected encounters or allegiance.
  // Browser cases separately use the actual scientist pool and physical stock.
  const c = { alive: true, capable: true, free: true, allowed: true, wayfinding: true, researched: true, animancy: 201,
    mana: 1000, instrument: true, bodyEpoch: 0, roomId: 'lab', cell: { x: 1, y: 1, z: 0 },
    distanceTo: id => require('../strategic-world').greatCircleDistanceKm(map, 0, require('../strategic-world').cellIndex(id)), originUsable: () => true };
  const stacks = [{ key: 'arcaneFeedstock', quantity: 1000, carriedBy: 'scientist', cell: { ...c.cell } }];
  const move = (roomId, cell) => { c.roomId = roomId; c.cell = { ...cell }; stacks[0].cell = { ...cell };
    Object.assign(c, Wayfinding.location(s, roomId) || { field: false }); };
  const effects = { prepare: g => ({ x: 10, y: 10, z: g.z }), move };
  const grounds = new Set(s.bodies.map(a => Wayfinding.key(a.home)));
  for (let i = 0; i < grounds.size; i++) {
    expect(Wayfinding.begin(s, book, stacks, c, 'scan', null, at)).toBe(true); c.mana -= 5;
    at += Wayfinding.SCAN; Wayfinding.advance(s, book, c, at, effects);
    const t = s.access.traces.at(-1);
    expect(Wayfinding.begin(s, book, stacks, c, 'outbound', t.id, at)).toBe(true); c.mana -= s.access.job.terms.mana;
    at += s.access.job.seconds; Wayfinding.advance(s, book, c, at, effects);
    expect(s.bodies.filter(a => Wayfinding.key(a.home) === t.key).every(a => Bodies.local(a, c))).toBe(true);
    expect(Wayfinding.begin(s, book, stacks, c, 'return', null, at)).toBe(true);
    at += s.access.job.seconds; Wayfinding.advance(s, book, c, at, effects);
  }
  expect(new Set(s.access.traces.map(t => t.key)).size).toBe(grounds.size);
  expect(Bodies.known(s)).toEqual([]); expect(JSON.stringify(Wayfinding.view(s))).not.toContain('god:');
  expect(book).toEqual(initial); expect(JSON.stringify(map)).toBe(canonical);
});

function generatedWorld(seed = 'world-seed-one', worldTheme = 'unbound') {
  const key = `${seed}:${worldTheme}`;
  if (!cache.has(key)) cache.set(key, Library.createWorld({ id: `divine-history-${key}`, worldSeed: seed, worldTheme, createdAt: 'test' }));
  return cache.get(key);
}

test('divine history is deterministic, sparse, causal, and preserves the pre-civic baseline', () => {
  const first = generatedWorld();
  const same = Library.createWorld({ id: 'same-divine-history', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  const map = first.generatedData.strategicMap;
  const record = map.strategicDivineHistory;

  expect(record).toEqual(same.generatedData.strategicMap.strategicDivineHistory);
  expect(record.sourceDivinityDigest).toBe(map.strategicDivinity.digest);
  expect(record.eventRows.length).toBeLessThanOrEqual(record.opportunityYears.length);
  expect(record.eventRows.length).toBeGreaterThan(0);
  expect(record.eventRows.every((event) => event.cellId && event.prerequisites.length && event.exactContributions && event.stateDelta)).toBe(true);
  expect(DivineHistory.auditStrategicDivineHistory(map)).toMatchObject({ valid: true, preCivicBaselineImmutable: true, retainedEventsHaveConsequences: true, quietWorldsAllowed: true });
});

test('conflict distinguishes retreat, descent, reascension, and permanent death through saved factors', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicDivineHistory;
  const kinds = new Set(record.eventRows.map((event) => event.kind));

  expect(kinds.has('holySiteContest')).toBe(true);
  expect(kinds.has('forcedDescent') || kinds.has('worshipCollapse')).toBe(true);
  expect(kinds.has('reascension')).toBe(true);
  expect(kinds.has('divineDeath')).toBe(true);

  for (const event of record.eventRows.filter((entry) => ['holySiteContest', 'forcedDescent', 'divineDeath'].includes(entry.kind))) {
    expect(event.exactContributions).toMatchObject({ attackerCommittedPower: expect.any(Number), defenderCommittedPower: expect.any(Number), attackerPreparation: expect.any(Number), defenderPreparation: expect.any(Number), attackerSurprise: expect.any(Number), defenderSurprise: expect.any(Number), attackerManifestationCost: expect.any(Number), defenderManifestationCost: expect.any(Number), attackerScore: expect.any(Number), defenderScore: expect.any(Number) });
  }
  for (const event of record.eventRows.filter((entry) => ['forcedDescent', 'worshipCollapse'].includes(entry.kind))) {
    expect(event.stateDelta).toMatchObject({ identityPreserved: true, retainedMortalPower: true });
    expect(event.stateDelta.lifeState || event.stateDelta.loserLifeState).toBe('living');
  }
  for (const event of record.eventRows.filter((entry) => entry.kind === 'divineDeath')) {
    expect(event.stateDelta).toMatchObject({ victimLifeState: 'dead', victimDivinityState: 'none', identityTransferred: false, religionTransferred: false });
    expect(record.remainsRows.some((remains) => remains.id === event.stateDelta.remainsId && remains.discoverableHook)).toBe(true);
  }
  expect(DivineHistory.auditStrategicDivineHistory(map)).toMatchObject({ descentPreservesLivingIdentity: true, deathPermanentAndIdentityNotTransferred: true });
});

test('faith confirmation follows current lifecycle while successors remain unconfirmed', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicDivineHistory;

  for (const faith of record.currentFaithRows) {
    const god = record.currentGodRows.find((entry) => entry.id === faith.godId);
    expect(faith.confirmationState).toBe(god.lifecycle.lifeState === 'living' && god.lifecycle.divinityState === 'divine' ? 'activelyConfirmed' : 'historicallyConfirmed');
    expect(faith.sameGodHeresyClaimsValid).toBe(false);
  }
  expect(record.successorRows.length).toBeGreaterThan(0);
  expect(record.successorRows.every((successor) => successor.confirmationState === 'unconfirmedSuccessor' && successor.correctionAuthorityId === null && !successor.sameGodHeresyClaimsValid && !successor.sovereignAuthority)).toBe(true);
  const reascendedGodIds = new Set(record.eventRows.filter((event) => event.kind === 'reascension').flatMap((event) => event.participantIds));
  expect(record.successorRows.filter((successor) => reascendedGodIds.has(successor.historicalGodId)).every((successor) => successor.resolution === 'reconciliationContested')).toBe(true);
});

test('rare beast ascension preserves population capacity and creates a distinct minor god and faith', () => {
  const map = generatedWorld('rare-ascension-4').generatedData.strategicMap;
  const record = map.strategicDivineHistory;
  const event = record.eventRows.find((entry) => entry.kind === 'mortalAscension');
  const ascended = record.currentGodRows.find((god) => god.id === event?.stateDelta.newGodId);
  const faith = record.ascendedFaithRows.find((entry) => entry.godId === ascended?.id);
  const currentFaith = record.currentFaithRows.find((entry) => entry.godId === ascended?.id);
  const compact = record.eventRows.find((entry) => entry.kind === 'divineCooperation');

  expect(event).toMatchObject({ mortalOrigin: { kind: 'beast' }, prerequisites: expect.arrayContaining(['stableMortalIdentity', 'transcendentPower', 'soulStability', 'survivedTransformation', 'identityBoundDivineCore', 'deliberateTransferredWorship', 'repeatableDivineSignature']), stateDelta: { initialRank: 'minor', identityContinuous: true } });
  expect(event.exactContributions.transferredFollowerUnits).toBeGreaterThan(0);
  expect(ascended).toMatchObject({ definitionId: 'ascended.dynamic', rank: 'minor', stableIdentity: { originKind: 'beast', identityContinuity: 'continuousThroughAscension' }, lifecycle: { lifeState: 'living' } });
  expect(event.exactContributions.worshipIncome).toBeGreaterThan(0);
  expect(faith).toMatchObject({ distinctFromPredecessorFaith: true, confirmationState: 'activelyConfirmed', sameGodHeresyClaimsValid: false });
  expect(currentFaith.confirmationState).toBe(ascended.lifecycle.divinityState === 'divine' ? 'activelyConfirmed' : 'historicallyConfirmed');
  expect(compact).toMatchObject({ prerequisites: expect.arrayContaining(['compatibleImmediateObjectives', 'finiteCommittedPower', 'specificPhysicalTarget', 'temporaryMutualConsent']), stateDelta: { mergesGods: false, mergesFaiths: false, createsSovereignty: false, temporaryCompactEndsYear: expect.any(Number) } });

  const assigned = new Map();
  for (const god of record.currentGodRows) for (const source of god.worshipSources) assigned.set(source.sourcePopulationId, (assigned.get(source.sourcePopulationId) || 0) + source.followerUnits);
  expect(record.currentGodRows.every((god) => god.worshipSources.every((source) => assigned.get(source.sourcePopulationId) <= source.sourcePopulationUnits))).toBe(true);
  expect(DivineHistory.auditStrategicDivineHistory(map).ascensionsRequireCausalPrerequisites).toBe(true);
});

test('public chronology and save-load projection hide canonical power, cohorts, and uncertain causes', () => {
  const world = generatedWorld();
  const map = world.generatedData.strategicMap;
  const publicHistory = DivineHistory.publicDivineHistory(map);
  const publicJson = JSON.stringify(publicHistory);

  expect(publicHistory.currentGods.length).toBeGreaterThan(0);
  expect(publicHistory.chronology.every((event) => event.exactPowerPublic === false && event.hiddenCausalityAcknowledged)).toBe(true);
  const sources = map.cityGovernments.governments.map(g => Religion.sourceFromWorld(map, g.cityId, g.charter.id)).filter(Boolean);
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources) {
    expect(source.faith.hereticTeaching).toEqual(Faiths.publicFaithDirectory(map).faiths.find(f => f.id === source.faith.id).hereticTeaching);
    expect(source.patronInterest).toEqual(Faiths.patronInterestFor(source.faith, map.publicDivineHistoryDirectory));
  }
  for (const event of publicHistory.chronology.filter(event => event.conflict)) {
    const original = map.strategicDivineHistory.eventRows.find(row => row.id === event.id);
    expect(event.conflict).toEqual({ winnerId: original.stateDelta.winnerId, loserId: original.stateDelta.loserId });
    expect(event.participantIds).toContain(event.conflict.winnerId);
    expect(event.participantIds).toContain(event.conflict.loserId);
    expect(event.evidence.some(e => ['witnessedAvatarCombat', 'siteCustodyRecord'].includes(e))).toBe(true);
  }
  expect(publicHistory.principles).toMatchObject({ descentIsNotDeath: true, deathPermanentByDefault: true, reascensionRestoresSameIdentity: true, victorsNeverInheritCompleteReligion: true, ascendantsCreateDistinctFaiths: true, sameGodHeresyClaimsValid: false });
  expect(publicJson).not.toMatch(/exactContributions|actualCause|followerDispositionRows|worshipIncome|reserveAfterward|attackerScore|defenderScore|transferredFollowerUnits|exactResidualPower/);
  expect(DivineHistory.auditStrategicDivineHistory(map).publicHistoryHidesExactPowerAndCausality).toBe(true);

  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));
  expect(normalized.generatedData.strategicMap.strategicDivineHistory).toEqual(map.strategicDivineHistory);
  expect(normalized.generatedData.strategicMap.publicDivineHistoryDirectory).toEqual(map.publicDivineHistoryDirectory);
});
