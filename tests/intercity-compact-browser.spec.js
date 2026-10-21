const { test, expect } = require('@playwright/test');
const Production = require('../local-market-production');
const { openForeignWorkspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.intercityCompactSnapshot());
const action = (page, action, expected = null) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.intercityCompactAction(action, expected), { action, expected });
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
async function setup(page, renderer) {
  await openForeignWorkspace(page, `intercity-compact-${renderer}`, renderer, false, false, 6);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const p = Production.create({ cityId: 'b', manufacturingFacilities: [{ id: 'works:b', kind: 'chemicalWorks',
    condition: 95, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  p.workshops.find(w => w.id === 'assayReagent').stock = 4;
  await page.evaluate(p => {
    const d = window.helixHeresyDebug;
    d.setForeignSuppliesTestContext({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' }, standings: [],
      market: { listings: { metalParts: { supply: 2, demand: 1 }, assayReagent: { supply: 4, demand: 1 } } } });
    const state = d.exportSurveyExpeditionTestState(); p.lastAt = state.clock;
    state.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production = p;
    d.importSurveyExpeditionTestState(state);
    if (!d.setForeignCivicBargainTestSource({ cityId: 'b', charterId: 'charter:b', administrationId: 'admin:b', defenseId: 'defense:b',
      defenseName: 'B Defense', populationSourceId: 'population:b', authority: { id: 'ruler:b', kind: 'collective', name: 'B Council' },
      archive: { routeId: 'route:ab', source: 'Retained chart', sourceDate: null,
        coverage: [{ cellId: 'planet-cell:00001', latitude: 12, longitude: 20 }, { cellId: 'planet-cell:00002', latitude: 16, longitude: 21 }], notes: ['Withheld'] } })) throw new Error('Original civic source unavailable');
    if (!d.setIntercityCompactTestSource({ source: { cityId: 'b', homeId: 'a', charterId: 'charter:b', authorityId: 'ruler:b',
      institutionId: 'defense:b', depotId: 'defense:b:maintenance-receiving', populationSourceId: 'population:b',
      routeId: 'route:ab', originalCondition: 80, requiredParts: 6 },
      route: { id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous' } })) throw new Error('Original compact source unavailable');
  }, p);
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: real foreign travel, funded compact, original fleet, physical cargo, termination/completion and save`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer);
  const initial = await snap(page), panel = page.locator('[data-intercity-compact]');
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  await expect(panel).toContainText('Intercity Supply-and-Access Compact');
  expect(initial.saved).toBeTruthy(); expect(initial.context.participantsPresent).toBe(true); expect(initial.context.routeOpen).toBe(true);
  await panel.locator('[data-compact-action="negotiate"]').click(); await advance(page, 60);
  expect((await snap(page)).saved.job.progress).toBe(60); await reload(page); await advance(page, 60);
  const offer = (await snap(page)).saved.offer; expect(offer.scope).toContain('opposes the gods');
  expect(await action(page, 'sign', { ...offer, inputQuantity: 1 })).toBe(false);
  await panel.locator('[data-compact-action="sign"]').click(); await advance(page, 60);
  let s = await snap(page); expect(s.saved.status).toBe('active'); expect(s.saved.cityStock).toBe(2);
  expect(s.market.treasury).toBe(initial.market.treasury - offer.purchasePrice * 2 - 16);
  expect(s.market.production.workshops.find(w => w.id === 'assayReagent').stock).toBe(2);
  expect(s.market.production.finance.money).toBe(initial.market.production.finance.money + offer.purchasePrice * 2);
  expect(s.saved.cycles[0].fulfilledAt).toBeNull(); expect(s.campaign).toEqual(initial.campaign);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignCivicBargainAction('request'))).toBe(false);
  await panel.locator('[data-compact-action="supply"]').click(); await advance(page, 60);
  s = await snap(page); const original = s.stacks.find(i => i.key === 'metalParts' && i.carriedBy === 'scientist');
  expect(original.quantity).toBe(6); expect(original.reservedTaskId).toBeTruthy(); await reload(page); await advance(page, 60);
  s = await snap(page); expect(s.saved.preparedFittings).toBe(1); expect(s.stacks.find(i => i.id === original.id).quantity).toBe(3);
  expect(s.saved.cycles[0].shipmentId).toBeTruthy(); expect(s.saved.cycles[0].stackId).toBeFalsy();
  expect(s.market.production.trucks[0].fuelKm).toBeLessThan(initial.market.production.trucks[0].fuelKm);
  await panel.locator('[data-compact-action="report"]').click(); const dated = (await snap(page)).saved.report;
  if (renderer === 'canvas') {
    await panel.locator('[data-compact-action="terminate"]').click(); s = await snap(page);
    expect(s.saved.status).toBe('terminated'); expect(s.saved.cityRetained).toBe(1);
  }
  await advance(page, 7400); s = await snap(page); expect(s.saved.cycles[0].stackId).toBeTruthy(); expect(s.saved.report).toEqual(dated);
  await panel.locator('[data-compact-action="report"]').click();
  await panel.locator('[data-compact-action="collect"]').first().click(); await advance(page, 30);
  s = await snap(page); const returnedId = s.saved.cycles[0].stackId;
  expect(s.stacks.find(i => i.id === returnedId).carriedBy).toBe('scientist');
  expect(await page.evaluate(id => window.helixHeresyDebug.foreignLabUnloadingSnapshot().lots.some(i => i.id === id), returnedId)).toBe(true);
  if (renderer === 'dom') {
    expect(await action(page, 'supply')).toBe(true); await advance(page, 120); await advance(page, 7400);
    expect((await snap(page)).saved.status).toBe('completed'); expect(await action(page, 'report')).toBe(true);
    const second = (await snap(page)).saved.cycles[1]; expect(await action(page, 'collect', second.id)).toBe(true); await advance(page, 30);
    s = await snap(page); expect(s.stacks.find(i => i.id === second.stackId).carriedBy).toBe('scientist');
    expect(s.saved.preparedFittings).toBe(2);
  }
  const final = (await snap(page)).saved; await reload(page); expect((await snap(page)).saved).toEqual(final);
  expect(await action(page, 'collect', final.cycles[0].id)).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignCivicBargainSnapshot().knownAlignment)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect((await snap(page)).campaign).toEqual(initial.campaign); expect(errors).toEqual([]);
});
