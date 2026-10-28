async function prepareContactHome(page, renderer) {
  // Source inputs, paid original registration and actual walking. No civic
  // government, abdication, religious endorsement or communication outcome.
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'ordinary-contact', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.citySuccessionAction('walk')) throw new Error('Actual counter walk refused');
    for (let n = 0; n < 45; n++) { const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) break; d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true); }
    if (!d.scientistIdentityAction('preview', 'Mira Vale') || !d.scientistIdentityAction('confirm')) throw new Error('Actual registration refused');
    d.advanceCityRuleForTest(1800, true);
    if (!d.scientistIdentitySnapshot().documents.length) throw new Error('Original clerk did not issue the attended registration');
  }, renderer);
}
module.exports = { prepareContactHome };
