const { test, expect } = require('@playwright/test');
const { visit, finish } = require('./helpers/multi-city-visit');
const { sourceMap } = require('./helpers/city-authority-source');
const { sources } = require('./helpers/regional-government-source');
test.setTimeout(600000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.cityAuthoritySnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceForeignReceptionTestTime(n), n);
async function prepare(page, renderer, status) {
  console.log(`${renderer}: registering at the original home counter`);
  await page.evaluate(({ renderer, status, local, foreign }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true,
        localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true,
        jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'political-visits', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    d.configureWildernessTest({ destination: { id: 'original-approach', label: 'Original approach', strategicCellId: 'planet-cell:00002', jurisdiction: 'Unclaimed wilderness', description: 'Existing approach' } });
    if (!d.scientistIdentityAction('walk')) throw Error('Original registration walk refused');
    for (let n = 0; n < 45; n++) { const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) break; d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true); }
    if (!d.scientistIdentityAction('preview', 'Mira Vale') || !d.scientistIdentityAction('confirm')) throw Error('Registration refused');
    d.advanceCityRuleForTest(1800, true);
    if (!d.scientistIdentitySnapshot().documents.length) throw Error('Actual original registration missing');
    console.log('political-visits: actual home registration issued');
    // Declare original prior civic records before any political work. This
    // does not transfer authority, issue assent or replace a spent actor.
    if (!d.configureCitySuccessionTest({ retirement: true })) throw Error('Prior succession records refused');
    // Original finite prior budget for three identity verifications, the
    // controller decision and seven succession jobs. Never refill it later.
    d.configureScientistIdentityTest({ power: 12 });
    const original = d.sovereignBargainSnapshot().bargain.source;
    const p = local.political, op = local.operation, defense = local.defense;
    p.charterId = op.charterId = defense.charterId = original.charterId;
    p.parties[0] = { ...p.parties[0], authorityId: original.authority.id, name: original.authority.name,
      kind: original.authority.kind, charterId: original.charterId };
    for (const list of [p.institutions, op.institutions]) for (const i of list) {
      if (i.role === 'centralAdministration') i.id = original.administrationId;
      if (i.role === 'militaryDefenseCommand') i.id = original.defenseId;
    }
    defense.institutionId = original.defenseId; op.baselineAuthorityId = original.authority.id;
    for (const farm of op.farms) farm.charterId = original.charterId;
    const b = foreign.political;
    b.cityId = 'b'; b.charterId = 'charter:b'; b.populationSourceId = 'population:b';
    b.sourceId = 'population:b:political-authority'; b.politicalSourceId = 'b:playable-political-control';
    b.institutions = foreign.operation.institutions.map(i => ({ ...b.institutions.find(v => v.role === i.role), id: i.id }));
    b.parties[0].cityId = 'b'; b.parties[0].charterId = b.charterId;
    b.parties[1] = { ...b.parties[1], ...p.parties[0] };
    foreign.operation.baselineAuthorityId = b.parties[0].authorityId;
    if (!d.configureCityAuthorityTest([local, foreign])) throw Error(`Original ${status} political inputs refused`);
  }, { renderer, status, local: sourceMap('individual'), foreign: { ...sourceMap('collective', status), ...sources('b') } });
  console.log(`${renderer}: original home registration and prior civic sources ready`);
}
async function admission(page) {
  if (!await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().context.atDesk)) {
    expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  }
  const pending = (await snapshot(page)).saved?.entries.find(e => e.source.cityId === 'b');
  if (pending?.phase === 'active' && !pending.operation) {
    // A prior political agreement is not permission for this new visit. Even
    // an API call must fail before allocating an original city account.
    expect(await page.evaluate(() => window.helixHeresyDebug.cityAuthorityAction('operate', 'b'))).toBe(false);
    expect((await snapshot(page)).saved.entries.find(e => e.source.cityId === 'b')).toEqual(pending);
  }
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await advance(page, 180);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers.at(-1)); })).toBe(true);
  await advance(page, 60);
}
async function journey(page, returning) {
  if (returning) {
    expect(await page.evaluate(() => { const d = window.helixHeresyDebug, p = d.intercityPassengerSnapshot().carrier.spaces.outer;
      return d.startScientistMove(p.roomId, { toCell: p.cell, allowMultiRoom: true }); })).toBeTruthy(); await finish(page);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true);
  await finish(page); await advance(page, 1600);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  if (returning) { expect(await page.evaluate(() => window.helixHeresyDebug.scientistIdentityAction('walk'))).toBe(true); await finish(page); }
  else await admission(page);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: real foreign visit, separately attended controller release and actual succession preserve exact city operation and history`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  page.on('console', msg => { if (msg.text().startsWith('political-visits:')) console.log(msg.text()); });
  await visit(page, renderer, { prepareHome: (p, r) => prepare(p, r, r === 'dom' ? 'occupied' : 'puppet') });
  console.log(`${renderer}: actual foreign passenger arrival and ordinary visitor permission complete`);
  await page.locator('[data-workspace-tab="visits"]').click();
  const panel = page.locator('[data-city-authority]');
  const button = name => panel.locator(`[data-city-authority-action="${name}"][data-city-authority-target="b"]`);
  const initialCounter = (await snapshot(page)).counter.gate;
  await button('inspect').click(); await advance(page, 60);
  let s = await snapshot(page), e = s.saved.entries.find(e => e.source.cityId === 'b');
  expect(e.knowledge.parties).toHaveLength(renderer === 'canvas' ? 1 : 2);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().gate.foreignCivic)).toBeFalsy();
  await button('negotiate').click(); await advance(page, 180);
  e = (await snapshot(page)).saved.entries.find(e => e.source.cityId === 'b'); expect(e.phase).toBe('offered'); expect(e.knowledge.parties).toHaveLength(2);
  await button('accept').click(); await advance(page, 60);
  e = (await snapshot(page)).saved.entries.find(e => e.source.cityId === 'b'); expect(e.phase).toBe('awaitingControllers'); expect(e.resolutions).toHaveLength(1);
  const spentCounter = (await snapshot(page)).counter.gate;
  expect(spentCounter.clerk.id).toBe(initialCounter.clerk.id);
  expect(spentCounter.receptionWorkSeconds).toBe(initialCounter.receptionWorkSeconds - 300);
  expect(spentCounter.powerSeconds).toBe(initialCounter.powerSeconds - 300);
  expect(await page.evaluate(() => window.helixHeresyDebug.cityAuthorityAction('operate', 'b'))).toBe(false);
  await journey(page, true);
  console.log(`${renderer}: actual return to the original controller counter complete`);
  await button('assent').click(); await advance(page, 30); s = await snapshot(page); expect(s.saved.job.progress).toBe(30);
  const partial = s.saved.authorities;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snapshot(page)).saved.authorities).toEqual(partial); await advance(page, 150);
  e = (await snapshot(page)).saved.entries.find(e => e.source.cityId === 'b'); expect(e.phase).toBe('active'); expect(e.resolutions).toHaveLength(2);
  const release = e.resolutions[1], held = e.knowledge;
  // The original ruler actually retires after releasing B's claim. A real
  // home transfer must not revive the released foreign territorial claim.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, a = (kind, expected) => { if (!d.citySuccessionAction(kind, expected)) throw Error(`Actual succession refused ${kind}`); };
    a('request'); d.advanceCitySuccessionForTest(30); a('hear'); d.advanceCitySuccessionForTest(180);
    a('sign', d.citySuccessionSnapshot().succession.terms); a('deliver');
    const before = d.citySuccessionSnapshot();
    for (const p of [...before.succession.leaders, before.bargain.defender]) { a('agree', p.id); d.advanceCitySuccessionForTest(60); }
    a('handover'); d.advanceCitySuccessionForTest(180);
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.citySuccessionSnapshot().succession.phase)).toBe('transferred');
  console.log(`${renderer}: actual controller succession complete after the separate release`);
  await journey(page, false);
  await button('report').click(); await advance(page, 60);
  e = (await snapshot(page)).saved.entries.find(e => e.source.cityId === 'b'); expect(e.resolutions[1]).toEqual(release);
  await button('operate').click();
  expect(await page.evaluate(() => window.helixHeresyDebug.advanceCityClientForTest(3600 + 3 * 86400))).not.toBe(false);
  e = (await snapshot(page)).saved.entries.find(e => e.source.cityId === 'b'); expect(e.operation.status).toBe('established');
  console.log(`${renderer}: three-day client operation established after the actual controller succession`);
  // The ordinary six-hour visitor permission expired during autonomous work.
  expect(await page.evaluate(() => window.helixHeresyDebug.cityAuthorityAction('report', 'b'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.cityAuthorityAction('receiveOperation', 'b'))).toBe(false);
  await admission(page); await button('receiveOperation').click();
  const history = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().saved.cityReports.find(r => r.temporal === 'historical'));
  expect(history.period.endAt - history.period.startAt).toBe(3 * 86400);
  await button('withdraw').click(); await advance(page, 60);
  e = (await snapshot(page)).saved.entries.find(e => e.source.cityId === 'b'); expect(e.operation.status).toBe('contested');
  expect(held.resolutions).toHaveLength(2);
  const before = (await snapshot(page)).saved;
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-political-visits.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
  s = await snapshot(page); expect(s.saved.runId).not.toBe(before.runId); expect(s.saved.authorities).toEqual(before.authorities);
  expect(s.saved.entries).toEqual(before.entries.map(e => ({ ...e, runId: s.saved.runId,
    ...(e.operation ? { operation: { ...e.operation, runId: s.saved.runId } } : {}) })));
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().saved.cityReports.find(r => r.temporal === 'historical'))).toEqual(history);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(errors).toEqual([]);
});
