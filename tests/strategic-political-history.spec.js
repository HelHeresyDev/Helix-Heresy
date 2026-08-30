// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const PoliticalHistory = require('../strategic-political-history');
const CapabilityHistory = require('../strategic-capability-history');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'political-history-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('political history is deterministic, bounded, causal, and preserves its source histories', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicPoliticalHistory;
  delete source.publicPoliticalHistoryDirectory;
  const regenerated = PoliticalHistory.createStrategicPoliticalHistory('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicPoliticalHistory;

  expect(regenerated.strategicPoliticalHistory).toEqual(record);
  expect(record.sourceCityExpansionDigest).toBe(map.cityExpansionHistory.digest);
  expect(record.sourceCrisisHistoryDigest).toBe(map.strategicCrisisHistory.digest);
  expect(record.eventRows.length).toBeLessThanOrEqual(map.cityPolities.polities.length * 3 + 28);
  expect(record.eventRows.every((event) => event.prerequisites.length && event.cause && event.exactFactors && event.stateDelta && event.discoverableHooks.length && event.publicAccount)).toBe(true);
  expect(PoliticalHistory.auditStrategicPoliticalHistory(map)).toMatchObject({ valid: true, sourceHistoryImmutable: true });
});

test('authority chronologies begin with founders and end at the generated playable-year authority without implicit immortality', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicPoliticalHistory;

  expect(record.authorityHistoryRows).toHaveLength(map.cityPolities.polities.length);
  for (const row of record.authorityHistoryRows) {
    const polity = map.cityPolities.polities.find((entry) => entry.cityId === row.cityId);
    expect(row.currentAuthorityActorId).toBe(polity.authority.id);
    expect(row.implicitFounderLongevity).toBe(false);
    expect(record.actorRows.find((actor) => actor.id === row.foundingAuthorityActorId)?.role).toBe('foundingSovereign');
    expect(record.actorRows.find((actor) => actor.id === row.currentAuthorityActorId)?.persistsToPlayableYear).toBe(true);
  }
});

test('campaigns are physically feasible and create bounded tribute, puppet, or occupation overlays without annexation', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicPoliticalHistory;
  const campaigns = record.eventRows.filter((event) => event.kind === 'intercityCampaign');

  expect(campaigns.length).toBeGreaterThan(0);
  expect(campaigns.every((event) => event.physicalFeasibility.corridorState !== 'severed' && event.physicalFeasibility.exactCellPath.length && !event.stateDelta.createsState && !event.stateDelta.annexation)).toBe(true);
  expect(campaigns.some((event) => event.outcome !== 'campaignRepelled')).toBe(true);
  expect(record.currentControlRows.some((row) => row.controlStatus !== 'sovereign')).toBe(true);
  expect(record.currentControlRows.every((row) => row.cityIdentityPreserved && !row.annexed)).toBe(true);
  expect(record.diagnostics.maximumForeignHoldings).toBeLessThanOrEqual(2);
  for (const event of record.eventRows.filter((entry) => entry.outcome === 'occupationEstablished')) expect(event.participantActorIds.some((id) => record.actorRows.find((actor) => actor.id === id)?.role === 'occupationCommander')).toBe(true);
  for (const event of record.eventRows.filter((entry) => entry.kind === 'subjectRevolt')) expect(event.participantActorIds.some((id) => record.actorRows.find((actor) => actor.id === id)?.role === 'rebelLeader')).toBe(true);
});

test('war compacts dissolve and every claimed specialist contribution is capability-backed', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const compacts = map.strategicPoliticalHistory.warCompactRows;

  expect(compacts.length).toBeGreaterThan(0);
  for (const compact of compacts) {
    expect(compact).toMatchObject({ finiteGoal: 'compelDefinedCampaignOutcome', dissolutionReason: 'campaignEnded', permanentAlliance: false, createsSovereignty: false, standingForceAfterDissolution: false });
    for (const member of compact.contributionRows) for (const contribution of member.contributions) {
      if (contribution.capabilityId) expect(CapabilityHistory.cityHasCapability(map, member.cityId, contribution.capabilityId)).toBe(true);
    }
  }
});

test('public political history redacts exact force comparisons and covert puppet control and survives save-load', () => {
  const world = generatedWorld();
  const map = world.generatedData.strategicMap;
  const publicHistory = PoliticalHistory.publicPoliticalHistory(map);
  const publicJson = JSON.stringify(publicHistory);

  expect(publicHistory.chronology).toHaveLength(map.strategicPoliticalHistory.eventRows.length);
  expect(publicHistory.currentControlRows.every((row) => row.publicControlStatus !== 'puppet' && row.cityIdentityPreserved)).toBe(true);
  expect(publicJson).not.toMatch(/exactFactors|attackerPower|defenderPower|revoltPower|suppressPower|margin|exactCellPath|covertPuppetSponsorPolityId|mercenarySupport/);
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));
  expect(normalized.generatedData.strategicMap.strategicPoliticalHistory).toEqual(map.strategicPoliticalHistory);
  expect(normalized.generatedData.strategicMap.publicPoliticalHistoryDirectory).toEqual(map.publicPoliticalHistoryDirectory);
});
