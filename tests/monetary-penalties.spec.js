const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path'), vm = require('vm');
const World = require('../strategic-world');
const Governments = require('../strategic-city-governments');
const Laws = require('../strategic-city-laws');
const History = require('../strategic-legal-history');
const Referrals = require('../cargo-criminal-referrals');
const { sentencingFixture } = require('./helpers/cargo-sentencing-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
// Exercise the complete law stage and its compact serialization, without running
// unrelated geography/history generation. Only upstream-stage validators are stubbed.
function fixture() {
  const context = { module: { exports: {} }, require: id => id === './strategic-world'
    ? { ...World, validateStrategicMap: x => x } : { ...Governments, validateCityGovernments: () => {} } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../strategic-city-laws.js'), 'utf8'), context);
  const stage = context.module.exports;
  const cities = Array.from({ length: 8 }, (_, n) => ({ id: `city:${n}`, name: `City ${n}`, cellId: `cell:${n}` }));
  const governments = cities.map(c => {
    const roles = ['judiciary', 'publicProsecution', 'civilWatch', 'temporaryJailAuthority', 'longTermCorrectionsAuthority', 'civicReview'];
    return { id: `gov:${c.id}`, cityId: c.id, polityId: `polity:${c.id}`, charter: { jurisdictionClaim: { cityId: c.id } },
      roleAssignments: Object.fromEntries(roles.map(r => [r, `${c.id}:${r}`])), threatReadiness: { waveWarningIds: [] },
      institutions: roles.map(r => ({ id: `${c.id}:${r}`, capacityBand: 'functional', independenceBand: Governments.INDEPENDENCE_BANDS[2] })) };
  });
  const map = { humanGeography: { cities }, cityGovernments: { digest: 'government-fixture', governments },
    cityPolities: { polities: cities.map(c => ({ id: `polity:${c.id}`, cityId: c.id, name: c.name, civicPriorities: [], logisticalDependencies: [] })) } };
  const result = stage.createCityLegalCodes('fine-policy-test', map);
  map.cityLegalCodes = result.cityLegalCodes; map.publicCityLawDirectory = result.publicDirectory;
  return { map, stage };
}
test('generation stores complete modest city variation and offense-specific ranges deterministically', () => {
  const { map, stage } = fixture(), again = fixture().map;
  expect(map).toEqual(again); expect(() => stage.validateCityLegalCodes(map)).not.toThrow();
  const policies = map.publicCityLawDirectory.entries.map(e => e.monetaryPenaltyPolicy);
  expect(new Set(policies.map(p => p.scalePercent)).size).toBeGreaterThan(1);
  for (const code of Laws.publicCityLawDirectory(map)) {
    const policy = code.monetaryPenaltyPolicy;
    expect([80, 90, 100, 110, 120]).toContain(policy.scalePercent);
    for (const rule of code.offenseRules) {
      expect(Boolean(rule.sentencing.fineRangeCredits)).toBe(rule.sentencing.ordinarySanctions.includes('fine'));
      if (rule.sentencing.fineRangeCredits) expect(rule.sentencing.fineRangeCredits).toEqual(policy.ranges[rule.offenseId]);
    }
    expect(policy.ranges.contrabandCommerce.minimum).toBe(300 * policy.scalePercent / 100);
    expect(policy.ranges.corporateLicensing.minimum).toBeLessThan(policy.ranges.contrabandCommerce.minimum);
  }
});
test('reload and repeated projections use saved amounts and never alias or reroll canonical records', () => {
  const { map } = fixture(); const saved = copy(map);
  const a = Laws.publicCityLawDirectory(map), b = Laws.publicCityLawDirectory(copy(map)); expect(a).toEqual(b);
  a[0].offenseRules.find(r => r.offenseId === 'contrabandCommerce').sentencing.fineRangeCredits.minimum = 999;
  expect(map).toEqual(saved);
  // Saved amounts are authoritative, not recalculated from current baseline tables.
  map.publicCityLawDirectory.entries[0].monetaryPenaltyPolicy.ranges.contrabandCommerce = { minimum: 321, maximum: 3210 };
  expect(Laws.publicRuleFor(map, 'city:0', 'contrabandCommerce').sentencing.fineRangeCredits.minimum).toBe(321);
});
test('historical worlds lack fines without backfill; malformed present policies are rejected', () => {
  const { map } = fixture(); delete map.publicCityLawDirectory.entries[0].monetaryPenaltyPolicy;
  const before = copy(map); const rule = Laws.publicRuleFor(map, 'city:0', 'contrabandCommerce');
  expect(rule.sentencing.fineRangeCredits).toBeUndefined(); expect(Laws.monetaryPenaltyLabel(rule)).toBe('fine amounts not published');
  expect(map).toEqual(before);
  for (const defect of ['city', 'currency', 'negative', 'missing', 'extra', 'fraction', 'scale']) {
    const bad = fixture().map, policy = bad.publicCityLawDirectory.entries[0].monetaryPenaltyPolicy;
    if (defect === 'city') policy.cityId = 'foreign';
    if (defect === 'currency') policy.denomination = 'inventedCurrency';
    if (defect === 'negative') policy.ranges.contrabandCommerce.minimum = -1;
    if (defect === 'missing') delete policy.ranges.contrabandCommerce;
    if (defect === 'extra') policy.ranges.homicide = { minimum: 1, maximum: 2 };
    if (defect === 'fraction') policy.ranges.contrabandCommerce.maximum = .5;
    if (defect === 'scale') policy.scalePercent = 500;
    expect(() => Laws.publicCityLawDirectory(bad), defect).toThrow(/monetary/);
  }
});
test('theme, prison capacity and enforcement preferences do not set monetary policy', () => {
  const { map, stage } = fixture(); const before = map.publicCityLawDirectory.entries.map(e => e.monetaryPenaltyPolicy);
  map.worldTheme = 'grim';
  for (const g of map.cityGovernments.governments) {
    g.institutions.forEach(i => { i.capacityBand = 'exceptional'; }); g.threatReadiness.waveWarningIds.push('wave');
  }
  map.cityPolities.polities.forEach(p => { p.civicPriorities = ['order']; p.logisticalDependencies = ['water']; });
  expect(stage.createCityLegalCodes('fine-policy-test', map).publicDirectory.entries.map(e => e.monetaryPenaltyPolicy)).toEqual(before);
});
test('historical prison and legal-status amendments preserve saved monetary terms and missing old ranges', () => {
  const { map } = fixture(); const before = Laws.publicRuleFor(map, 'city:0', 'contrabandCommerce').sentencing.fineRangeCredits;
  map.strategicLegalHistory = { amendmentRows: [
    { id: 'amendment:1', cityId: 'city:0', year: 2, kind: 'sentencingPolicyAmendment', change: { resultingValue: 36 } },
    { id: 'amendment:2', cityId: 'city:0', year: 3, kind: 'offenseStatusAmendment', change: { offenseId: 'contrabandCommerce', resultingValue: 'restricted' } }
  ] };
  expect(History.currentRecognizedRuleFor(map, 'city:0', 'contrabandCommerce').sentencing.fineRangeCredits).toEqual(before);
  delete map.publicCityLawDirectory.entries[0].monetaryPenaltyPolicy;
  expect(History.currentRecognizedRuleFor(map, 'city:0', 'contrabandCommerce').sentencing.fineRangeCredits).toBeUndefined();
});
test('generated public rule reaches prospective publication and a stayed lower-bound cargo sentence', () => {
  const { map } = fixture(), rule = Laws.publicRuleFor(map, 'city:0', 'contrabandCommerce');
  const g = { id: 'gate', cityId: 'city:0', jurisdiction: 'city' };
  Referrals.provision(g, rule, null, 100);
  expect(g.criminalRule.sentencing.fineRangeCredits).toEqual(rule.sentencing.fineRangeCredits);
  const f = sentencingFixture(g.criminalRule.sentencing); const funds = f.buyer.money;
  f.untilSentence('sentence'); expect(f.d.sentencing.sentence.sanction.credits).toBe(rule.sentencing.fineRangeCredits.minimum);
  expect(f.d.sentencing.sentence.enforcementAuthorized).toBe(false); expect(f.buyer.money).toBe(funds);
  const old = { id: 'old', cityId: 'city:0', jurisdiction: 'city' };
  Referrals.provision(old, { ...rule, sentencing: undefined }, null, 50); Referrals.provision(old, rule, null, 200);
  expect(old.criminalRule.sentencing).toBeNull(); expect(old.criminalRule.publishedAt).toBe(50);
});
test('public fine labels expose actual ranges but no hidden enforcement data', () => {
  const { map } = fixture(), code = Laws.publicCityLawDirectory(map)[0];
  const rule = code.offenseRules.find(r => r.offenseId === 'contrabandCommerce');
  expect(Laws.monetaryPenaltyLabel(rule)).toContain(`${rule.sentencing.fineRangeCredits.minimum}–${rule.sentencing.fineRangeCredits.maximum} credits`);
  expect(Laws.monetaryPenaltyLabel(code.offenseRules.find(r => r.offenseId === 'homicide'))).toBe('');
  expect(JSON.stringify(code.monetaryPenaltyPolicy)).not.toMatch(/enforcement|priority|wealth|theme/i);
});
