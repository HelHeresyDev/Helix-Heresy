const { test, expect } = require('@playwright/test');
const { setup, snap: outer, walk, finish, advance, reload } = require('./helpers/outer-approach-visit');
const P = require('../chapter-protection');
test.setTimeout(900000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.chapterProtectionSnapshot());
async function prepare(page, renderer) {
  const original = await setup(page, renderer, 'exhausted');
  const source = P.source({ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact' }, [{ standing: 'licensed',
    network: { id: 'original-military-network', category: 'military', roles: ['escortContracting'], prohibitions: ['claiming police authority'] },
    branch: { id: 'original-military-chapter:b', cityId: 'b', publicName: 'Original B Escort Chapter', organizationForm: 'escortChapter',
      publicPhysicalPresence: true, operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } }]);
  await page.evaluate(source => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.scientist.vitals.mana = { current: 10000, max: 10000 };
    s.scientist.vitals.health = { current: 10000, max: 10000 };
    const profile = { cityId: 'b', cityName: 'City B', workshopCapacity: 1, productionSources: [], manufacturingFacilities: [], commodityDefinitions: [], listings: {} };
    const market = s.economy.commodityMarket;
    market.intercityTrade ||= { neighbors: [], operators: [], shipments: [], ledger: [], lastAt: s.clock };
    if (!market.intercityTrade.neighbors.some(n => n.id === 'b')) market.intercityTrade.neighbors.push({ id: 'b', profile,
      treasury: 2000, reserveFraction: .6, reports: [], listings: {}, production: window.HelixLocalMarketProduction.create(profile, s.clock) });
    // Prior original municipal money and a supported original chapter are
    // inputs, never a report, consent, paid contract, casualty or resolution.
    d.importSurveyExpeditionTestState(s);
    if (!d.setChapterProtectionTestSource('b', source)) throw new Error('Original chapter source refused');
  }, source);
  let s = await snap(page); expect(s.saved.phase).toBe('idle'); expect(s.saved.contract).toBeNull();
  const start = { person: s.saved.actor.id, client: s.client.id, treasury: s.treasury, body: s.saved.actor.health,
    work: s.saved.actor.workSeconds, world: original.world, campaign: s.campaign };
  const front = await outer(page);
  await walk(page, front.saved.home.roomId, { x: 8, y: 8, z: s.client.mapCell.z });
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('strike', id), s.client.id)).toBe(true);
  await advance(page, 2); s = await snap(page);
  expect(s.client.health).toBeLessThan(100); expect(s.saved.phase).toBe('reporting'); expect(s.treasury).toBe(start.treasury);
  await advance(page, 40); s = await snap(page); expect(s.saved.job.progress).toBeGreaterThan(0); expect(s.saved.job.progress).toBeLessThan(P.REPORT);
  const progress = s.saved.job.progress; await reload(page); expect((await snap(page)).saved.job.progress).toBe(progress);
  await advance(page, P.REPORT - progress + 1); s = await snap(page);
  expect(s.saved.contract, JSON.stringify(s.context)).toBeTruthy(); expect(s.treasury).toBe(start.treasury - P.FEE - P.WAGES);
  expect(s.saved.actor.id).toBe(start.person); expect(s.client.id).toBe(start.client);
  expect(s.saved.actor.workSeconds).toBeLessThan(start.work); expect(s.saved.actor.health).toBe(start.body);
  console.log(`chapter: ${renderer} actual witnessed request, partial save and funded original contract ready`);
  return start;
}
test('DOM actual local protection, physical evacuation, saved attended negotiation, exact promise and renewed aggression preserve source scope', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const start = await prepare(page, 'dom');
  await advance(page, 30); let s = await snap(page);
  expect(s.client.mapCell).toEqual(s.saved.layout.refuge);
  expect(s.saved.actor.mapCell).not.toEqual(s.saved.layout.home);
  const front = await outer(page);
  const p = s.saved.actor.mapCell;
  await walk(page, front.saved.home.roomId, { x: p.x + 1, y: p.y, z: p.z });
  expect(await page.evaluate(() => window.helixHeresyDebug.chapterProtectionAction('report'))).toBe(true);
  const account = (await snap(page)).public;
  expect(JSON.stringify(account)).not.toMatch(/workSeconds|finances|capacityBand|hostileUntil|foodSeconds/);
  expect(await page.evaluate(() => window.helixHeresyDebug.chapterProtectionAction('parley')), JSON.stringify(await snap(page))).toBe(true);
  await advance(page, 20); s = await snap(page); expect(s.saved.job.progress).toBe(20);
  await reload(page); expect((await snap(page)).saved.job.progress).toBe(20); await advance(page, 40);
  s = await snap(page); expect(s.saved.quote).toBeTruthy();
  expect(await page.evaluate(q => window.helixHeresyDebug.chapterProtectionAction('accept', { ...q, contractId: 'another-contract' }), s.saved.quote)).toBe(false);
  expect(await page.evaluate(q => window.helixHeresyDebug.chapterProtectionAction('accept', q), s.saved.quote)).toBe(true);
  s = await snap(page); expect(s.saved.promise).toBeTruthy(); expect(s.saved.phase).toBe('settled');
  expect(s.treasury).toBe(start.treasury - 120); expect(s.campaign).toEqual(start.campaign);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2));
  expect(await page.evaluate(() => window.helixHeresyDebug.chapterProtectionAction('strike'))).toBe(true); await advance(page, 2);
  s = await snap(page); expect(s.saved.promise.breachedAt).toBeTruthy(); expect(s.saved.phase).toBe('protecting');
  expect(s.saved.actor.id).toBe(start.person); expect(s.treasury).toBe(start.treasury - 120);
  const historical = s.public;
  expect(await page.evaluate(() => window.helixHeresyDebug.outerApproachAction('return'))).toBe(true); await finish(page);
  await advance(page, 10); expect((await snap(page)).public).toEqual(historical);
  await reload(page); expect((await snap(page)).saved.actor.id).toBe(start.person);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(start.world);
  expect(errors).toEqual([]);
});
test('Canvas shared combat physically resists the same ordinary professional; wounds, remains and partial funds survive without replacement or network victory', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const start = await prepare(page, 'canvas');
  await advance(page, 30); let s = await snap(page); const front = await outer(page), p = s.saved.actor.mapCell;
  await walk(page, front.saved.home.roomId, { x: p.x + 1, y: p.y, z: p.z });
  const health = s.saved.actor.health;
  expect(await page.evaluate(() => window.helixHeresyDebug.chapterProtectionAction('soulLash'))).toBe(true); await advance(page, 2);
  s = await snap(page); expect(s.saved.actor.health).toBeLessThan(health); expect(s.injuries.some(i => i.actorId === start.person)).toBe(true);
  expect(s.saved.kit.batonCondition).toBeLessThan(100); // Actual close defensive attempts, not only a label.
  const wounded = s.saved.actor.health; await reload(page); expect((await snap(page)).saved.actor.health).toBe(wounded);
  for (let n = 0; n < 16 && (await snap(page)).saved.actor.status !== 'dead'; n++) {
    const s = await snap(page); const p = s.saved.actor.mapCell;
    if (Math.max(Math.abs(s.cell.x - p.x), Math.abs(s.cell.y - p.y)) > 5) await walk(page, front.saved.home.roomId, { x: p.x === 12 ? p.x - 1 : p.x + 1, y: p.y, z: p.z });
    expect(await page.evaluate(() => window.helixHeresyDebug.chapterProtectionAction('soulLash')), (await snap(page)).attackReason).toBe(true); await advance(page, 3);
  }
  s = await snap(page); expect(s.saved.actor.status).toBe('dead'); const remains = s.saved.actor.mapCell;
  await advance(page, 60); s = await snap(page); expect(s.saved.actor.mapCell).toEqual(remains);
  expect(s.saved.actor.id).toBe(start.person); expect(s.saved.actor.health).toBe(0);
  expect(s.treasury).toBeGreaterThan(start.treasury - 120); expect(s.saved.finances.engagement).toBe(80);
  expect(s.saved.contracts).toHaveLength(1); expect(s.campaign).toEqual(start.campaign);
  await reload(page); expect((await snap(page)).saved.actor.mapCell).toEqual(remains);
  const beforeDeath = (await snap(page)).saved;
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await advance(page, 100);
  expect((await snap(page)).saved).toEqual(beforeDeath);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(start.world);
  expect(errors).toEqual([]);
});
