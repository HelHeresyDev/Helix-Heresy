const { test, expect } = require('@playwright/test');
const { visit, finish } = require('./helpers/multi-city-visit');
const { patronSource } = require('./helpers/patron-fixture');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.divineContactsSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceForeignReceptionTestTime(n), n);
const visits = page => page.locator('[data-workspace-tab="visits"]').click();
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function prepareContactHome(page, renderer) {
  // Original civic/source inputs and actual registration, NOT a governing result.
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'divine-contacts', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.citySuccessionAction('walk')) throw new Error('Actual original counter walk refused');
    for (let n = 0; n < 45; n++) { const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) break; d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true); }
    if (!d.scientistIdentityAction('preview', 'Mira Vale') || !d.scientistIdentityAction('confirm')) throw new Error('Actual original registration refused');
    d.advanceCityRuleForTest(1800, true);
    if (!d.scientistIdentitySnapshot().documents.length) throw new Error('Original clerk did not issue the attended registration');
  }, renderer);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: original foreign branch dialogue, shared same-god budgets, independent records and continued import`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  page.on('console', m => { if (m.text().startsWith('multi-city:')) console.log(m.text()); });
  await visit(page, renderer, { prepareHome: prepareContactHome, beforeDeparture: async p => {
    const city = await p.evaluate(() => window.helixHeresyDebug.sovereignBargainSnapshot().bargain.source);
    const home = patronSource(city.cityId, city.charterId), same = patronSource('b', 'charter:b'), other = patronSource('b', 'charter:b');
    same.branch.id = 'branch:foreign:a'; same.branch.publicName = 'Original Foreign Auriel Branch';
    other.branch.id = 'branch:foreign:b'; other.branch.publicName = 'Original Boreal Branch'; other.godName = 'Boreal';
    other.faith.id = other.branch.traditionId = 'faith:b'; other.faith.godId = other.god.id = 'god:b';
    other.god.divineCore.repeatableSignature = 'original-divine:b';
    expect(await p.evaluate(({ home, same, other }) => window.helixHeresyDebug.configureReligiousRecognitionTest({ source: home, contactSources: [same, other] }), { home, same, other })).toBe(true);
    expect(await p.evaluate(() => window.helixHeresyDebug.divineNoninterventionAction('propose'))).toBe(true);
    expect(await p.evaluate(() => { const d = window.helixHeresyDebug, s = d.divineCapabilitiesSnapshot();
      return d.divineNoninterventionAction('accept', s.saved.proposals.at(-1)); })).toBe(true);
    await tick(p, 180);
    expect((await snap(p)).book.agreements).toHaveLength(1);
    expect(await p.evaluate(() => window.helixHeresyDebug.citySuccessionSnapshot().succession?.handover)).toBeFalsy();
  } });
  console.log(`${renderer}: real foreign visitor review completed`); await visits(page);
  const panel = page.locator('[data-divine-contacts]'); let s = await snap(page);
  const homeAgreement = s.book.agreements[0], homeReport = s.book.reports[0];
  expect(s.location.cityId).toBe('b'); expect(s.book.contacts).toHaveLength(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().gate.regionalGovernment)).toBeFalsy();
  await panel.locator('[data-divine-contact-action="open"][data-contact-id="branch:foreign:a:patron-petition"]').click();
  await panel.locator('[data-divine-contact-action="open"][data-contact-id="branch:foreign:b:patron-petition"]').click();
  s = await snap(page); expect(s.book.contacts).toHaveLength(2); expect(s.known).toHaveLength(2);
  expect(s.book.records.find(r => r.godId === 'god:a').attentionSeconds).toBe(420);
  expect(s.book.records.find(r => r.godId === 'god:a').god.power.reserve).toBe(93);
  expect(s.book.contacts.every(c => !c.religion.god && !c.religion.attentionSeconds)).toBe(true);
  expect(new Set(s.book.contacts.map(c => c.religion.actor.id)).size).toBe(2);
  expect(s.contexts.every(c => c.context.receiveAtCounter), JSON.stringify(s.contexts)).toBe(true);
  const same = panel.locator('[data-divine-contact="branch:foreign:a:patron-petition"]');
  await same.locator('[data-divine-contact-action="propose"]').click();
  expect(errors).toEqual([]);
  s = await snap(page);
  expect(s.book.contacts[0].reply, JSON.stringify({ contact: s.book.contacts[0], channel: s.contexts[0], record: s.book.records[0] })).toBeTruthy();
  await expect(same).toContainText('not yet within their final day');
  const other = panel.locator('[data-divine-contact="branch:foreign:b:patron-petition"]');
  await other.locator('[data-divine-contact-action="propose"]').click(); await expect(other).toContainText('No worship');
  const originalGate = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().gate);
  await other.locator('[data-divine-contact-action="accept"]').click(); await tick(page, 25);
  s = await snap(page); expect(s.book.contacts[1].job.progress).toBe(25);
  expect(s.book.records[1].god.power.reserve).toBe(93); expect(s.book.records[1].attentionSeconds).toBe(420);
  const desk = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().gate);
  expect(await page.evaluate(g => Boolean(window.helixHeresyDebug.startScientistMove(g.checkpointRoomId,
    { toCell: { x: 6, y: 7, z: g.z }, allowMultiRoom: true })), desk)).toBe(true); await finish(page);
  await reload(page); expect((await snap(page)).book.contacts[1].job.progress).toBe(25);
  await tick(page, 60); expect((await snap(page)).book.contacts[1].job.progress).toBe(25);
  expect(await page.evaluate(g => Boolean(window.helixHeresyDebug.startScientistMove(g.checkpointRoomId,
    { toCell: { x: 10, y: 7, z: g.z }, allowMultiRoom: true })), desk)).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.configureDivineContactChannelTest('branch:foreign:b:patron-petition', false))).toBe(true);
  await tick(page, 60); expect((await snap(page)).book.contacts[1].job.progress).toBe(25);
  await page.evaluate(() => window.helixHeresyDebug.configureDivineContactChannelTest('branch:foreign:b:patron-petition', true));
  await tick(page, 1); await tick(page, 155); s = await snap(page);
  expect(s.book.contacts[1].job, JSON.stringify(s.contexts)).toBeNull(); expect(s.book.agreements).toHaveLength(2);
  expect(s.book.agreements[0]).toEqual(homeAgreement); expect(s.book.reports[0]).toEqual(homeReport);
  expect(s.book.reports.at(-1).godId).toBe('god:b'); expect(s.book.reports.at(-1).branchId).toBe('branch:foreign:b');
  const gate = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().gate);
  expect(gate.clerk.id).toBe(originalGate.clerk.id); expect(gate.receptionWorkSeconds).toBe(originalGate.receptionWorkSeconds - 180);
  expect(gate.powerSeconds).toBeLessThanOrEqual(originalGate.powerSeconds - 181);
  expect(gate.regionalGovernment).toBeFalsy(); expect(gate.clerk.assignment).toBeFalsy();
  const known = s.known, reports = s.book.reports;
  // Actual walking away does not refresh the held contacts or reveal a private roster.
  expect(await page.evaluate(g => Boolean(window.helixHeresyDebug.startScientistMove(g.checkpointRoomId,
    { toCell: { x: 6, y: 7, z: g.z }, allowMultiRoom: true })), gate)).toBe(true); await finish(page);
  await tick(page, 60); expect((await snap(page)).known).toEqual(known); expect((await snap(page)).book.reports).toEqual(reports);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const oldRun = s.book.runId;
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-original-contacts.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await visits(page);
  s = await snap(page); expect(s.book.runId).not.toBe(oldRun); expect(s.known).toEqual(known);
  expect(s.book.records.every(r => r.god.power.reserve === 93 && r.attentionSeconds === 420)).toBe(true);
  expect(s.book.contacts.every(c => c.religion.godRef.runId === s.book.runId && !c.invalid)).toBe(true);
  if (renderer === 'dom') {
    const g = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().gate);
    expect(await page.evaluate(g => Boolean(window.helixHeresyDebug.startScientistMove(g.checkpointRoomId,
      { toCell: { x: 11, y: 6, z: g.z }, allowMultiRoom: true })), g)).toBe(true); await finish(page);
    await other.locator('[data-divine-contact-action="strike"]').click();
    expect((await snap(page)).book.incidents).toHaveLength(1);
    expect(await page.evaluate(g => Boolean(window.helixHeresyDebug.startScientistMove(g.checkpointRoomId,
      { toCell: { x: 6, y: 7, z: g.z }, allowMultiRoom: true })), g)).toBe(true); await finish(page);
    await tick(page, 120); s = await snap(page);
    expect(s.book.agreements[1].breachedAt).not.toBeNull(); expect(s.book.agreements[0]).toEqual(homeAgreement);
    expect(s.book.reports).toEqual(reports); expect(s.book.records[1].god.power.reserve).toBe(86);
    expect(await page.evaluate(g => Boolean(window.helixHeresyDebug.startScientistMove(g.checkpointRoomId,
      { toCell: { x: 10, y: 7, z: g.z }, allowMultiRoom: true })), g)).toBe(true); await finish(page);
    await other.locator('[data-divine-contact-action="receive"]').click(); s = await snap(page);
    expect(s.book.reports.at(-1).state).toBe('receivedBreach');
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = s.book;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(500); });
  expect((await snap(page)).book).toEqual(frozen); expect(errors).toEqual([]);
});
