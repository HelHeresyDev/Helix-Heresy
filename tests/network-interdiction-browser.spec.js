const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
const { setup, snap: outer, walk, finish, advance, reload } = require('./helpers/outer-approach-visit');
const { source: operatingSource, world } = require('./helpers/network-operating-source');
const I = require('../network-interdiction');
const P = require('../chapter-protection');
const fs = require('node:fs');
test.setTimeout(1800000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.networkInterdictionSnapshot());
const protection = p => p.evaluate(() => window.helixHeresyDebug.chapterProtectionSnapshot());
async function checkpoint(page, name) {
  const path = test.info().outputPath(`${name}.json`);
  fs.writeFileSync(path, JSON.stringify(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))));
  await test.info().attach(name, { contentType: 'application/json', path });
}
test.afterEach(async ({ page }) => {
  if (test.info().status === test.info().expectedStatus || page.isClosed()) return;
  fs.writeFileSync(test.info().outputPath('failure-state.json'), JSON.stringify(await page.evaluate(() => ({
    state: window.helixHeresyDebug.exportSurveyExpeditionTestState(),
    outer: window.helixHeresyDebug.outerApproachSnapshot(),
    network: window.helixHeresyDebug.networkInterdictionSnapshot()
  }))));
  await checkpoint(page, 'failure-save');
});
async function prepare(page, renderer) {
  page.on('dialog', d => d.accept()); await startLifecycleRun(page, `network-interdiction-${renderer}`);
  await prepareHome(page, renderer, { sustain: false, farm: { distanceKm: .11, satelliteCellId: 'planet-cell:00004',
    routeCellIds: ['planet-cell:00004', 'planet-cell:00002', 'planet-cell:00001'] } });
  expect(await page.evaluate(() => window.helixHeresyDebug.cityRuleAction('operate'))).toBe(true);
  const original = await setup(page, renderer, 'exhausted', true);
  const m = world(); m.strategicNonStateNetworkHistory.networkRows[0].actualCapacityBand = 'strong';
  m.strategicNonStateNetworkHistory.branchRows.forEach(b => { b.organizationForm = 'escortChapter'; b.currentStanding = 'licensed'; });
  m.routeGraph = { routes: [{ id: 'route:ab', endpointIds: ['a', 'b'], cellPath: ['planet-cell:00001', 'planet-cell:00002', 'planet-cell:00003'] }] };
  const q = (await snap(page)).quota;
  const links = I.links(m, q.source, { land: () => true,
    distance: (a, b) => a === 'planet-cell:00004' || b === 'planet-cell:00004' ? .01
      : a === 'planet-cell:00003' || b === 'planet-cell:00003' ? .9 : .1 }, [{ id: 'route:ab', distanceKm: 2 }]);
  expect(links).toHaveLength(1);
  const chapter = P.source({ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact' }, [{ standing: 'licensed',
    network: { id: 'original-network', category: 'military', roles: ['escortContracting'], prohibitions: ['claiming police authority'] },
    branch: { id: 'branch:b', cityId: 'b', publicName: 'Original B Chapter', organizationForm: 'escortChapter', publicPhysicalPresence: true,
      operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } }]);
  await page.evaluate(({ operating, source, links, chapter }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.scientist.vitals.mana = { current: 10000, max: 10000 }; s.scientist.vitals.health = { current: 10000, max: 10000 };
    const market = s.economy.commodityMarket;
    market.intercityTrade ||= { neighbors: [], operators: [], shipments: [], ledger: [], lastAt: s.clock };
    if (!market.intercityTrade.neighbors.some(n => n.id === 'b')) market.intercityTrade.neighbors.push({ id: 'b', treasury: 2000, listings: {},
      profile: { cityId: 'b', listings: {} }, reserveFraction: .6, production: window.HelixLocalMarketProduction.create({ cityId: 'b' }, s.clock) });
    d.importSurveyExpeditionTestState(s);
    // Prior original allocations only. No signed promise, witnessed breach,
    // financed deployment, journey, damage, consent or receipt is injected.
    if (!d.setNetworkOperationsTestSource(operating) || !d.setChapterProtectionTestSource('b', chapter)
      || !d.setNetworkInterdictionTestSource({ sources: [source], links })) throw new Error('Original sources refused');
  }, { operating: operatingSource(), source: I.sources(m).find(s => s.branchId === 'branch:b'), links, chapter });
  let s = await protection(page); const front = await outer(page);
  await walk(page, front.saved.home.roomId, { x: 8, y: 8, z: s.client.mapCell.z });
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('strike', id), s.client.id)).toBe(true);
  await advance(page, 123); s = await protection(page); expect(s.saved.contract).toBeTruthy(); await advance(page, 30);
  s = await protection(page); const cell = s.saved.actor.mapCell;
  await walk(page, front.saved.home.roomId, { x: cell.x + 1, y: cell.y, z: cell.z });
  expect(await page.evaluate(() => window.helixHeresyDebug.chapterProtectionAction('parley'))).toBe(true); await advance(page, 60);
  s = await protection(page); expect(await page.evaluate(q => window.helixHeresyDebug.chapterProtectionAction('accept', q), s.saved.quote)).toBe(true);
  const c = s.context.clerk.mapCell;
  await walk(page, front.saved.home.roomId, { x: c.x - 2, y: c.y + 1, z: c.z });
  expect(await page.evaluate(() => window.helixHeresyDebug.chapterProtectionAction('soulLash'))).toBe(true); await advance(page, 2);
  s = await protection(page); expect(s.saved.promise.breachedAt).toBeTruthy(); expect(s.saved.interdictionWitnesses?.length, JSON.stringify(s.context)).toBe(1);
  await advance(page, 30); let n = await snap(page);
  expect(n.saved.units[0].job, JSON.stringify({ unit: n.saved.units[0], contexts: n.contexts })).toBeTruthy();
  expect(n.saved.units[0].job.progress).toBeGreaterThan(0);
  const progress = n.saved.units[0].job.progress; await reload(page); n = await snap(page); expect(n.saved.units[0].job.progress).toBe(progress);
  await advance(page, 121 - progress); n = await snap(page); expect(n.saved.units[0].phase).toBe('outbound');
  expect(n.accounts.accounts.find(a => a.id === 'branch:b').payments.filter(p => p.purpose === I.PURPOSE)).toHaveLength(1);
  expect(n.saved.units[0].actors.every(a => a.mapCell == null)).toBe(true); expect(n.public).toEqual([]);
  await checkpoint(page, 'actual-funded-deployment-save');
  console.info(`${renderer}: original home government, actual signed withdrawal/breach, original-clerk report, saved finite deployment ready`);
  return { original, ids: n.saved.units[0].actors.map(a => a.id), world: original.world };
}
async function roadTime(page, seconds) { await page.evaluate(n => window.helixHeresyDebug.advanceOverlandForTest(n), seconds); }
async function resume(page) {
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('resume'))).toBe(true); await finish(page, 'march');
}
test('Canvas distinct supply-route mandate authenticates a finite radio recall and actual return, without refund or instantaneous relocation', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const start = await prepare(page, 'canvas');
  const n = await snap(page), clerk = (await protection(page)).context.clerk;
  await walk(page, (await outer(page)).saved.home.roomId, { x: clerk.mapCell.x - 1, y: clerk.mapCell.y + 1, z: clerk.mapCell.z });
  await page.locator('[data-network-action="send"][data-network-entry="branch:b"][data-network-purpose="municipalSupplyInterdiction"]').click();
  await advance(page, 20); await reload(page); await advance(page, 161);
  let s = await snap(page); expect(s.saved.units[0].deployment.ceasefire).toBeTruthy();
  expect(s.saved.units[0].phase).toBe('returning'); expect(s.saved.units[0].deployment.positionKm).toBeGreaterThan(0);
  expect(s.saved.units[0].actors.every(a => a.mapCell == null)).toBe(true);
  await advance(page, 220); s = await snap(page); expect(s.saved.units[0].phase).toBe('returned');
  expect(s.saved.units[0].actors.map(a => a.id)).toEqual(start.ids);
  expect(s.saved.units[0].actors[0].workSeconds).toBeLessThan(n.saved.units[0].actors[0].workSeconds);
  expect(s.saved.units[0].deployment.spent).toBe(I.COST); expect(s.quota.vehicle.condition).toBe(100);
  await page.locator('[data-network-action="receive"][data-network-entry="branch:b"][data-network-purpose="municipalSupplyInterdiction"]').click(); await advance(page, 30);
  const receipt = await page.evaluate(() => window.helixHeresyDebug.networkOperationsSnapshot().public);
  expect(receipt.some(r => r.purpose === 'municipalSupplyInterdiction')).toBe(true);
  expect(JSON.stringify(receipt)).not.toMatch(/positionKm|radioSeconds|workSeconds|populationSourceId/);
  await reload(page); s = await snap(page); expect(s.saved.units[0].phase).toBe('returned');
  const frozen = s.saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await advance(page, 100);
  expect((await snap(page)).saved).toEqual(frozen); expect(s.campaign).toEqual(start.original.campaign);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(start.world); expect(errors).toEqual([]);
});
test('DOM original team reaches the shared supply road, physically disables the real truck, and can be resisted with actual repair and delivery', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const start = await prepare(page, 'dom');
  await advance(page, 2800); let s = await snap(page); expect(s.saved.units[0].phase).toBe('deployed');
  expect(s.quota.roadContactId).toBeFalsy(); expect(s.public).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.cityProvisioningAction('inspect'))).toBe(false); // No remote civic attendance.
  expect(await page.evaluate(() => window.helixHeresyDebug.outerApproachAction('return'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('reverse'))).toBe(true); await resume(page); await roadTime(page, 3000);
  let road = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
  if (road.roomId === s.saved.units[0].actors[0].roomId) { await resume(page); await roadTime(page, 1000); }
  expect(await page.evaluate(() => window.helixHeresyDebug.cityProvisioningAction('walk'))).toBe(true); await finish(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug;
    const ids = d.configureHiddenWorkshopTest({ supplies: { metalParts: 4, rubber: 2 }, carryTools: ['masonryHammer'] });
    for (const id of ids) { const i = d.exportSurveyExpeditionTestState().physicalItemStacks?.find(i => i.id === id);
      if (!d.carryActorStack('scientist', id, i?.quantity || 1)) throw new Error('Actual owned repair input not carried'); }
  });
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug;
    return d.cityProvisioningAction('inspect') && d.cityProvisioningAction('dispatch', d.cityProvisioningSnapshot().saved.quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCityProvisioningForTest(400, true)); s = await snap(page);
  expect(s.quota.roadContactId).toBeTruthy(); expect(s.quota.vehicle.condition).toBeLessThan(50);
  expect(s.quota.driver.health).toBe(100); expect(s.quota.order.deliveredKg).toBe(0); expect(s.public).toEqual([]);
  const plan = await page.evaluate(() => window.helixHeresyDebug.intercityMarchSnapshot().plans[0]);
  expect(await page.evaluate(id => window.helixHeresyDebug.intercityMarchAction('depart', id), plan.id)).toBe(true); await finish(page, 'march'); await roadTime(page, 1000);
  s = await snap(page); expect(s.roomId).toBe(s.quota.vehicle.roomId);
  expect(await page.evaluate(() => window.helixHeresyDebug.networkInterdictionAction('observe'))).toBe(true);
  expect((await snap(page)).public.length).toBeGreaterThan(0);
  await checkpoint(page, 'actual-observed-road-contact-save');
  for (let n = 0; n < 20; n++) {
    const s = await snap(page), a = s.saved.units[0].actors.find(a => a.status === 'alive' && a.health >= 35); if (!a) break;
    expect(await page.evaluate(id => window.helixHeresyDebug.networkInterdictionAction('soulLash', id), a.id)).toBe(true); await advance(page, 3);
  }
  s = await snap(page); expect(s.saved.units[0].actors.every(a => a.status === 'dead' || a.health < 35)).toBe(true);
  await advance(page, 45); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  s = await snap(page); await walk(page, s.roomId, { ...s.quota.vehicle.mapCell, x: s.quota.vehicle.mapCell.x + 1 });
  expect(await page.evaluate(() => window.helixHeresyDebug.networkInterdictionAction('repair'))).toBe(true);
  await advance(page, 40); await reload(page); await advance(page, 80);
  s = await snap(page); expect(s.saved.repairs.at(-1).completedAt).toBeTruthy(); expect(s.quota.vehicle.condition).toBeGreaterThanOrEqual(50);
  expect(s.saved.units[0].deployment.carrier.endedAt).toBeGreaterThanOrEqual(s.saved.repairs.at(-1).completedAt);
  for (let n = 0; n < 8 && !s.quota.receipts.some(r => r.deliveredKg > 0); n++) {
    await page.evaluate(() => window.helixHeresyDebug.advanceCityProvisioningForTest(300, true)); s = await snap(page);
  }
  expect(s.quota.receipts.some(r => r.deliveredKg > 0), JSON.stringify(s.quota.order)).toBe(true);
  expect(s.saved.units[0].actors.map(a => a.id)).toEqual(start.ids); expect(s.campaign).toEqual(start.original.campaign);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(start.world); expect(errors).toEqual([]);
});
