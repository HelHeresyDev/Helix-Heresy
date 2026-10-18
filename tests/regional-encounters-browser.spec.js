const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const Regional = require('../regional-encounters');
test.setTimeout(480000);
const presence = { id: 'SECRET_REGIONAL_POPULATION', speciesId: 'beast:rimefang-pack', populationIndex: 1000 };
const plan = { id: 'site:lab:survey:a:on-foot', distanceKm: 2.25 };
let fixtureSeed;
for (let i = 0; i < 100; i++) if (Regional.route(Regional.create({ worldId: 'lifecycle-world', runId: 'fixture' }), plan, [presence], `regional-${i}`, 0).beasts.actors.length) { fixtureSeed = `regional-${i}`; break; }
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.regionalEncounterSnapshot());
const walkState = page => page.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceOverlandForTest(n), n);
const act = (page, action) => page.evaluate(action => window.helixHeresyDebug.overlandAction(action), action);
async function visits(page) { const b = page.locator('[data-workspace-tab="visits"]'); if (await b.getAttribute('aria-current') !== 'page') await b.click(); }
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function finish(page) {
  for (let i = 0; i < 30; i++) { const s = await walkState(page); if (!s.tasks.length) return; expect(s.tasks[0].reason).toBe(''); await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1)); }
  throw new Error('Actual local work did not finish');
}
async function depart(page) { expect(await act(page, 'depart')).toBe(true); await finish(page); }
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept()); page.setDefaultTimeout(15000);
  await startLifecycleRun(page, `regional-${renderer}`);
  await page.evaluate(({ renderer, presence, fixtureSeed }) => { const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'regional', publicProspects: {}, truth: { private: 'SECRET_GEOLOGY' } } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false });
    d.configureRegionalEncounterTest([presence], fixtureSeed);
  }, { renderer, presence, fixtureSeed });
  const original = await page.evaluate(() => { const s = window.helixHeresyDebug.exportSurveyExpeditionTestState(); return {
    body: s.scientist.vocalBodyId, money: s.economy.money, carrier: s.surveyExpeditions.carrier, world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; });
  const initial = await snapshot(page); expect(initial.knowledge.sightings).toEqual([]); expect(initial.ledger.beasts.actors).toHaveLength(1);
  await depart(page); await advance(page, 12000);
  const s = await snapshot(page); expect(s.stop).toBeTruthy(); expect(s.ledger.beasts.actors[0].regionalPhase).toBe('local');
  expect((await walkState(page)).saved.trip.status).toBe('stopped'); return { errors, original, initial };
}
test('Canvas actual regional travel interruption, shared combat, real saves, original remains and physical revisit retain one allocation without world edits or fresh enemies', async ({ page }) => {
  const { errors, original, initial } = await setup(page, 'canvas'); let s = await snapshot(page);
  const id = s.ledger.beasts.actors[0].id, site = s.stop, km = site.positionKm;
  expect(km).toBe(initial.ledger.beasts.actors[0].positionKm); expect(s.knowledge.sightings[0].id).toBe(id);
  await visits(page); await expect(page.locator('[data-wilderness-beasts]')).toContainText('Rimefang');
  await expect(page.locator('[data-overland-expedition]')).not.toContainText(presence.id);
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), id)).toBe(true);
  s = await snapshot(page); expect(s.ledger.beasts.actors[0].health).toBeLessThan(initial.ledger.beasts.actors[0].health);
  expect(s.injuries.some(i => i.actorId === id)).toBe(true); const wounded = s.ledger.beasts.actors[0].health;
  await reload(page); expect((await snapshot(page)).ledger.beasts.actors[0].health).toBe(wounded);
  for (let i = 0; i < 20 && (await snapshot(page)).ledger.beasts.actors[0].status !== 'dead'; i++) {
    await advance(page, 3); await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), id);
  }
  s = await snapshot(page); expect(s.ledger.beasts.actors[0].status).toBe('dead'); expect(s.ledger.losses).toHaveLength(1);
  const corpse = s.ledger.beasts.actors[0], injuries = s.injuries.filter(i => i.actorId === id);
  expect(await act(page, 'reverse')).toBe(true); expect(await act(page, 'resume')).toBe(true); await finish(page); await advance(page, 12000);
  expect((await walkState(page)).saved.trip.status).toBe('arrived'); await depart(page); await advance(page, 12000);
  s = await snapshot(page); expect(s.stop.id).toBe(site.id); expect(s.ledger.beasts.actors).toHaveLength(1);
  expect(s.ledger.beasts.actors[0]).toMatchObject({ id, status: 'dead', health: 0, mapCell: corpse.mapCell, roomId: corpse.roomId });
  expect(s.ledger.losses).toHaveLength(1); expect(s.injuries.filter(i => i.actorId === id)).toEqual(injuries); await reload(page);
  expect((await snapshot(page)).ledger.beasts.actors).toHaveLength(1);
  const result = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    body: s.scientist.vocalBodyId, money: s.economy.money, carrier: s.surveyExpeditions.carrier, valid: d.validateMapScene(), world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; });
  expect(result.body).toBe(original.body); expect(result.money).toBe(original.money); expect(result.carrier?.vehicle).toEqual(original.carrier?.vehicle);
  expect(result.world).toBe(original.world); expect(result.valid).toEqual([]); expect(errors).toEqual([]);
});
test('DOM departure retains the same pursuing animal across physical recontact, saved separation, lost contact and scientist death without same-world inheritance', async ({ page }) => {
  const { errors } = await setup(page, 'dom'); let s = await snapshot(page); const id = s.ledger.beasts.actors[0].id, firstSite = s.stop;
  for (let i = 0; i < 10; i++) {
    s = await snapshot(page); const a = s.ledger.beasts.actors[0];
    if (Math.max(Math.abs(a.mapCell.x - s.cell.x), Math.abs(a.mapCell.y - s.cell.y)) <= 1) break;
    await advance(page, 1);
  }
  s = await snapshot(page); expect(s.ledger.beasts.actors[0].behavior).toBe('pursue'); const effort = s.ledger.beasts.actors[0].effortSeconds;
  expect(await act(page, 'resume')).toBe(true); expect((await snapshot(page)).ledger.beasts.actors[0].regionalPhase).toBe('following');
  await reload(page); const following = await snapshot(page); expect(following.ledger.beasts.actors[0].id).toBe(id);
  await advance(page, 1); s = await snapshot(page); expect(s.stop).toBeTruthy(); expect(s.stop.id).not.toBe(firstSite.id);
  expect(s.ledger.beasts.actors).toHaveLength(1); expect(s.ledger.beasts.actors[0].regionalPhase).toBe('local');
  expect(s.ledger.beasts.actors[0].effortSeconds).toBeLessThan(effort); expect(s.ledger.beasts.actors[0].roomId).toBe(s.stop.roomId);
  expect(await act(page, 'resume')).toBe(true); await advance(page, 60); s = await snapshot(page);
  expect(s.ledger.beasts.actors[0].id).toBe(id); expect(s.ledger.beasts.actors[0].regionalPhase).toBe('reserve');
  expect(s.ledger.beasts.actors[0].positionKm).toBeLessThan((await walkState(page)).saved.trip.positionKm);
  await visits(page); await expect(page.locator('[data-wilderness-beasts]')).toHaveCount(0); await reload(page);
  expect((await snapshot(page)).ledger.members).toHaveLength(1);
  // Explicit near-endpoint contact fixture: a final walking step cannot publish
  // an arrival or place the scientist indoors before the real pursuer is resolved.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), a = s.regionalEncounters.beasts.actors[0];
    s.overlandExpedition.trip.positionKm = .0005; s.overlandExpedition.trip.direction = -1; s.surveyExpeditions.phase = 'inbound';
    Object.assign(a, { regionalPhase: 'following', positionKm: .0005, offsetM: .5, regionalAt: s.clock, regionalTargetKm: .0005,
      regionalMemoryUntil: s.clock + 12, effortSeconds: 60 }); d.importSurveyExpeditionTestState(s);
  });
  await advance(page, 1); const held = await walkState(page); expect(held.saved.trip.status).toBe('stopped');
  expect(held.saved.trip.positionKm).toBe(0); expect(held.saved.history).toEqual([]); expect(held.stop).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const frozen = (await snapshot(page)).ledger;
  await advance(page, 600); expect((await snapshot(page)).ledger).toEqual(frozen);
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
  await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  expect((await snapshot(page)).ledger?.beasts.actors || []).toEqual([]); expect(errors).toEqual([]);
});
