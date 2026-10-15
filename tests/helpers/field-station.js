const { expect } = require('@playwright/test');
const Carrier = require('../../municipal-carrier');
const { openForeignWorkspace, advance: advanceForeign, wa } = require('./foreign-assay-visit');
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot());
const field = page => page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldStationAction(action, options), { action, options });
const trip = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignSurveyAction(action, options), { action, options });
async function advance(page, seconds) {
  const s = await snap(page);
  return s.local && s.saved?.site ? page.evaluate(n => window.helixHeresyDebug.advanceFieldStationForTest(n), seconds) : advanceForeign(page, seconds);
}
async function finish(page) {
  for (let n = 0; n < 12; n++) {
    const s = await snap(page), task = s.tasks.find(t => !t.reason);
    if (!task) return;
    await advance(page, Math.max(1, task.dueAt - s.clock + 1));
  }
  throw new Error(`Physical station work did not finish: ${JSON.stringify((await snap(page)).tasks)}`);
}
async function move(page, cell) {
  const s = await snap(page); if (JSON.stringify(s.cell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell })), { roomId: s.saved.site.roomId, cell })).toBe(true);
  await finish(page);
}
async function reload(page, renderer = 'canvas') {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]');
  if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function arrive(page) {
  page.on('dialog', d => d.accept());
  await openForeignWorkspace(page, 'field-station', 'canvas', false, false, 0, 'station', 'station');
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  // Explicit finite local tool fixture. The three masonry/carpentry hand tools
  // arrived through the real 40 L intercity allowance; adding the ladder there
  // would exceed it. No station action grants or replenishes this local tool.
  expect(await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureHiddenWorkshopTest({ carryTools: ['foldingLadder'] });
    return d.fieldStationSnapshot().stacks.some(i => i.key === 'foldingLadder' && i.carriedBy === 'scientist');
  })).toBe(true);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), context = {
      worldId: s.resourceSurveys.context?.worldId || 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'station',
      truth: { potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
    if (!d.setForeignSurveyTestSource(source, carrier, context)) return false;
    return d.setForeignWildernessTestSource({ origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 20, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Dry woodland' }], occupied: [], context });
  }, { source, carrier })).toBe(true);
  expect(await trip(page, 'quote')).toBe(true); expect(await trip(page, 'accept', { expected: (await field(page)).excursion.quote })).toBe(true);
  expect(await trip(page, 'book')).toBe(true); await advance(page, 120);
  expect(await trip(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await trip(page, 'disembark')).toBe(true); await finish(page);
  expect(await act(page, 'register')).toBe(false); // Sampling permission is not construction permission.
  expect(await trip(page, 'enterWilderness')).toBe(true); await finish(page);
  await page.locator('[data-workspace-tab="visits"]').click();
  await page.getByRole('button', { name: 'Automatic Eating and Drinking: On', exact: true }).click();
}

module.exports = { snap, field, act, trip, advance, finish, move, reload, arrive };
