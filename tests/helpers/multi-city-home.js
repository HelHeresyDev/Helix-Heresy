// An actual home handover followed by real finite municipal work and renewals.
// Debug setup supplies prior civic records/source inputs only, not city control.
async function prepareHome(page, renderer) {
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'multi-city', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    d.configureWildernessTest({ destination: { id: 'original-approach', label: 'Original approach', strategicCellId: 'planet-cell:00002', jurisdiction: 'Unclaimed wilderness', description: 'Existing approach' } });
    if (!d.citySuccessionAction('walk')) throw new Error('Original counter route refused');
    for (let n = 0; n < 45; n++) { const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) break; d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true); }
    if (!d.scientistIdentityAction('preview', 'Mira Vale') || !d.scientistIdentityAction('confirm')) throw new Error('Original personal registration refused');
    d.advanceCityRuleForTest(1800, true);
    if (!d.scientistIdentitySnapshot().documents.length) throw new Error('Original clerk did not issue the actual attended registration');
    const a = (action, expected) => { if (!d.citySuccessionAction(action, expected)) throw new Error(`Original succession refused ${action}`); };
    d.configureCitySuccessionTest({ retirement: true }); a('request'); d.advanceCitySuccessionForTest(30);
    a('hear'); d.advanceCitySuccessionForTest(180); a('sign', d.citySuccessionSnapshot().succession.terms);
    d.configureSovereignBargainTest({ supply: 18, carried: true }); a('deliver');
    const before = d.citySuccessionSnapshot();
    for (const p of [...before.succession.leaders, before.bargain.defender]) { a('agree', p.id); d.advanceCitySuccessionForTest(60); }
    a('handover'); d.advanceCitySuccessionForTest(180);
    const after = d.citySuccessionSnapshot(), source = after.succession.source;
    const farm = { cityId: 'a', cityName: 'Aster', charterId: source.charterId, populationSourceId: source.populationSourceId,
      cityPopulation: 3000, satelliteId: 'original-farm:a', satelliteName: 'Original farm', satellitePopulation: 600,
      institutionId: source.institutions.find(i => i.role === 'publicWorksAndProvisioning').id,
      cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002', arableLandBand: 'productive', storageDays: 3,
      distanceKm: 2, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
    if (!d.configureCityProvisioningTest(farm) || !d.configureCityDefenseTest({ cityId: 'a', cityName: 'Aster', charterId: source.charterId,
      populationSourceId: source.populationSourceId, population: 3000, institutionId: after.bargain.defender.institutionId,
      installationId: 'original-approach:a', condition: 80, baselineEnergy: 69120 }) || !d.configureCityRuleTest({
      cityId: 'a', cityName: 'Aster', charterId: source.charterId, populationSourceId: source.populationSourceId, population: 3000,
      institutions: source.institutions.map(i => ({ role: i.role, id: i.id })), worksId: 'original-water-walls:a', powerId: 'original-power:a', reserveDays: 5, farms: [farm] }))
      throw new Error('Original city source unavailable');
    const doAction = (family, action, quantity) => { if (!d[family](action, quantity)) throw new Error(`Original ${family} refused ${action}`); };
    doAction('cityProvisioningAction', 'standing'); doAction('cityRuleAction', 'distribution'); doAction('cityRuleAction', 'operate');
    console.log(`multi-city: ${renderer} home handover complete; running original three-day support`);
    d.advanceCityRuleForTest(3600 + 3 * 86400, true);
    const current = d.cityRuleSnapshot();
    if (current.saved.status !== 'established') throw new Error(`Home city failed: ${JSON.stringify({ rule: current.saved, pc: d.cityProvisioningSnapshot(), dc: d.cityDefenseSnapshot() })}`);
    doAction('cityRuleAction', 'report');
    // Explicit prior physical test input; the real municipal action consumes it.
    const ids = d.configureHiddenWorkshopTest({ supplies: { arcaneFeedstock: 42 } });
    for (let i = 0; i < 6; i++) {
      if (!d.carryActorStack('scientist', ids[0], 7)) throw new Error('Original owned fuel parcel cannot be carried');
      doAction('cityRuleAction', 'recharge', 7); d.advanceCityRuleForTest(420, true);
    }
    console.log(`multi-city: ${renderer} home three-day account received and actual power fuel processed`);
  }, renderer);
}
module.exports = { prepareHome };
