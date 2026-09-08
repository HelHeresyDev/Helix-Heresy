const { test, expect } = require('@playwright/test');
const Beasts = require('../wilderness-beasts');
const { pathToFileURL } = require('url');
const path = require('path');
const cell = (x, y = 12) => ({ x, y, z: 6 });
const land = Array.from({ length: 64 }, (_, i) => cell(28 + i % 8, 8 + Math.floor(i / 8)));
const population = { id: 'population-a', speciesId: 'beast:rimefang-pack', populationIndex: 1000 };

test('local individuals come only from supplied regional populations; empty sectors and deaths persist', () => {
  const original = JSON.stringify(population);
  let occupied, empty;
  for (let i = 0; i < 1000 && (!occupied || !empty); i++) {
    const saved = Beasts.materialize(`seed-${i}`, 'site-a', [population], land, 10);
    if (saved.actors.length) occupied = saved; else empty = saved;
  }
  expect(occupied.actors).toHaveLength(2); expect(empty.actors).toHaveLength(0);
  expect(occupied.actors.every((actor) => actor.populationId === population.id)).toBe(true);
  expect(Beasts.materialize('seed', 'site-a', [], land).actors).toHaveLength(0);
  expect(Beasts.materialize('seed', 'site-a', [{ ...population, speciesId: 'beast:glasswing-roc' }], land).actors).toHaveLength(0);
  occupied.actors[0].status = 'dead'; occupied.actors[0].health = 0;
  expect(Beasts.normalizeState(JSON.parse(JSON.stringify(occupied)))).toEqual(occupied);
  expect(Beasts.normalizeState(empty).materialized).toBe(true);
  expect(JSON.stringify(population)).toBe(original);
});
test('bounded physical paths detour around obstacles and never cross absent boundary cells', () => {
  const cells = new Set(land.map(Beasts.key)); cells.delete(Beasts.key(cell(29, 12)));
  const next = Beasts.nextStep(cell(28), cell(31), (c) => cells.has(Beasts.key(c)));
  expect(next).toBeTruthy(); expect(next).not.toEqual(cell(29));
  expect(Beasts.nextStep(cell(28), cell(20), (c) => cells.has(Beasts.key(c)))).toBeNull();
});
test('predation, territorial response, investigation, lost contact, and flight differ', () => {
  const wolf = Beasts.actor(population.speciesId, 'wolf', cell(30), 'population-a');
  expect(Beasts.decide(wolf, cell(24), 1, true, false).behavior).toBe('pursue');
  expect(Beasts.decide(wolf, cell(22), 2, false, false)).toMatchObject({ behavior: 'investigate', goal: cell(24) });
  expect(Beasts.decide(wolf, cell(22), 20, false, false).behavior).toBe('roam');
  const elk = Beasts.actor('beast:gravebloom-elk', 'elk', cell(30), 'population-b');
  expect(Beasts.decide(elk, cell(24), 1, true, false).behavior).toBe('roam');
  expect(Beasts.decide(elk, cell(29), 2, true, false).behavior).toBe('pursue');
  elk.health = 10;
  expect(Beasts.decide(elk, cell(29), 3, true, false).behavior).toBe('flee');
});
test('public knowledge contains observed signs and dated sightings, not hidden actors or exact health', () => {
  const saved = Beasts.defaultState();
  saved.actors = [Beasts.actor(population.speciesId, 'hidden', cell(30), 'secret-population')];
  saved.tracks = [{ id: 'track', label: 'Paw prints', cell: cell(28), observedAt: null }];
  expect(Beasts.publicKnowledge(saved)).toEqual({ sightings: [], tracks: [], heard: null });
  saved.sightings.hidden = { id: 'hidden', name: 'Rimefang', cell: cell(29), observedAt: 1 };
  saved.actors[0].mapCell = cell(35); saved.tracks[0].observedAt = 0;
  const view = Beasts.publicKnowledge(saved);
  expect(view.sightings[0]).toMatchObject({ cell: cell(29), current: false });
  expect(JSON.stringify(view)).not.toContain('secret-population'); expect(view.tracks).toHaveLength(1);
});

async function start(page, options) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate((options) => {
    const debug = window.helixHeresyDebug;
    debug.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'world-test', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'beast-test', publicProspects: {}, truth: {} } });
    debug.configureWildernessTest({ destination: { id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001', label: 'Woodland Boundary', temperatureC: 18, slopePercent: 20, precipitationMm: 500, terrain: 'broken ground', jurisdiction: 'Wilderness', description: 'Bounded test sector.' }, mode: 'wilderness', autoCare: false });
    debug.configureWildernessBeastsTest(options);
  }, options);
}
const snapshot = (page) => page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot());
test.describe('physical beast encounters', () => {
  test.setTimeout(180000);
  test('visible targets use shared strike, spell costs, injuries, guarding, and saved remains', async ({ page }) => {
    await start(page, { actors: [{ id: 'wolf', cell: cell(23), nextAttackAt: 1000, nextMoveAt: 1000 }] });
    const original = await snapshot(page);
    expect(original.knowledge.sightings).toHaveLength(1);
    expect(await page.evaluate(() => window.helixHeresyDebug.startScientistCombatAction('shove', 'wolf'))).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.cancelScientistCombatAction())).toBe(true);
    expect((await snapshot(page)).actors[0].health).toBe(original.actors[0].health);
    expect(await page.evaluate(() => window.helixHeresyDebug.startScientistCombatAction('strike', 'wolf'))).toBe(true);
    let saved = await snapshot(page); expect(saved.actors[0].health).toBeLessThan(original.actors[0].health);
    expect(saved.injuries.some((injury) => injury.actorKind === 'wildernessBeast')).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3));
    expect(await page.evaluate(() => window.helixHeresyDebug.wildernessBeastActionReason('soulLash', 'wolf'))).toBe('');
    const mana = (await snapshot(page)).mana;
    expect(await page.evaluate(() => window.helixHeresyDebug.startScientistCombatAction('soulLash', 'wolf'))).toBe(true);
    expect((await snapshot(page)).mana).toBeLessThan(mana);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    expect((await snapshot(page)).actors[0].health).toBeLessThan(original.actors[0].health);
    await page.locator('[data-workspace-tab="visits"]').click();
    await expect(page.locator('[data-wilderness-beasts]')).toContainText('Rimefang');
    await expect(page.locator('[data-wilderness-beasts]')).toContainText('not a safety assessment');
    // Repeated physically valid attacks leave a persistent corpse, never a replacement animal.
    for (let i = 0; i < 15 && (await snapshot(page)).actors[0].status !== 'dead'; i++) {
      await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3));
      await page.evaluate(() => window.helixHeresyDebug.startScientistCombatAction('strike', 'wolf'));
    }
    saved = await snapshot(page); expect(saved.actors[0].status).toBe('dead');
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    expect((await snapshot(page)).actors).toHaveLength(1); expect((await snapshot(page)).actors[0].status).toBe('dead');
  });
  test('unseen actors do not grant targets; sound, movement, and losing sight preserve knowledge boundaries', async ({ page }) => {
    await start(page, { actors: [{ id: 'hidden', cell: cell(31), nextMoveAt: 1000 }] });
    expect((await snapshot(page)).knowledge.sightings).toHaveLength(0);
    expect(await page.evaluate(() => window.helixHeresyDebug.startScientistCombatAction('soulLash', 'hidden'))).toBe(false);
    expect((await snapshot(page)).knowledge.heard.label).toContain('source not located');
    await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(3));
    expect((await snapshot(page)).knowledge.sightings).toHaveLength(0);
    expect((await snapshot(page)).health).toBeGreaterThan(0);
    await page.evaluate(() => window.helixHeresyDebug.configureWildernessBeastsTest({ actors: [{ id: 'hunter', cell: { x: 26, y: 12, z: 6 }, nextMoveAt: 0, nextAttackAt: 1000 }] }));
    await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(3));
    expect((await snapshot(page)).actors[0].mapCell.x).toBeLessThan(26);
    const position = (await snapshot(page)).actors[0].mapCell;
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    expect((await snapshot(page)).actors[0].mapCell).toEqual(position);
  });
  test('time skips stop for local attacks, guard mitigates them, and withdrawal crosses the secured boundary on foot', async ({ page }) => {
    await start(page, { scientistCell: cell(22), actors: [{ id: 'wolf', cell: cell(23), nextMoveAt: 1000, nextAttackAt: 1 }] });
    await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(true));
    const before = await snapshot(page);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(600));
    let saved = await snapshot(page);
    expect(saved.clock - before.clock).toBeLessThan(600);
    expect(saved.health).toBeLessThan(before.health);
    expect(before.health - saved.health).toBeLessThan(Beasts.PROFILES[population.speciesId].damage);
    await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(false));
    expect(await page.evaluate(() => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 18, y: 12, z: 6 }, allowMultiRoom: true, urgent: true }))).toBeTruthy();
    for (let i = 0; i < 30 && (await snapshot(page)).scientistCell.x > 18; i++) await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
    saved = await snapshot(page); expect(saved.scientistCell.x).toBe(18);
    const health = saved.health;
    await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(30));
    saved = await snapshot(page); expect(saved.health).toBe(health); expect(saved.actors[0].mapCell.x).toBeGreaterThan(20);
    expect(saved.knowledge.sightings[0].current).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.startScientistCombatAction('soulLash', 'wolf'))).toBe(false);
  });
});
