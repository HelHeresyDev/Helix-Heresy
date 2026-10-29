const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { sourceMap } = require('./helpers/city-authority-source');
const { recoverySources } = require('./helpers/city-recovery-source');
test.setTimeout(900000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.cityAuthoritySnapshot());
const tick = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceCityRuleForTest(seconds), seconds);
for (const route of ['collective', 'recovery', 'claimant']) for (const renderer of ['dom', 'canvas']) test(`${renderer}: ${route === 'claimant' ? 'retained displaced-claimant correspondence and' : route === 'recovery' ? 'supplied original city recovery and actual client operation,' : 'collective political resolution, actual client operation,'} withdrawal and historical reports survive saves and continued copies`, async ({ page }) => {
  const recovery = route === 'recovery', claimant = route === 'claimant';
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept()); page.setDefaultTimeout(25000);
  await startLifecycleRun(page, `city-authority-${renderer}`);
  // A small original city exercises real scaled hauling without hundreds of
  // duplicate inventory renders; full-size generated cities are model-tested.
  const prepared = recovery ? recoverySources('groundConvoy', 600) : sourceMap();
  await page.evaluate(({ renderer, prepared, recovery, claimant, lost }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true,
        localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Original city', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true,
        jurisdiction: { kind: 'city', cityId: 'a' } },
      ...(claimant ? [{id:'city:lost-city',cityId:'lost-city',kind:'fortifiedCity',label:'Recorded ruined city',known:true,reachable:false,cellId:'planet-cell:00003'}] : [])
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'political-settlement', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest({ collective: !claimant }); d.configureUnsupportedTest({ municipal: true });
    d.configureWildernessTest({ destination: { id: 'original-approach', label: 'Original approach', strategicCellId: 'planet-cell:00002', jurisdiction: 'Unclaimed wilderness', description: 'Existing approach' } });
    const original = d.sovereignBargainSnapshot().bargain.source;
    if (recovery) {
      const map = prepared.rawMap, g = map.cityGovernments.governments[0];
      const replacements = { [g.roleAssignments.centralAdministration]: original.administrationId, [g.roleAssignments.militaryDefenseCommand]: original.defenseId };
      g.charter.id = original.charterId;
      for (const [role, id] of Object.entries(g.roleAssignments)) g.roleAssignments[role] = replacements[id] || id;
      for (const i of g.institutions) i.id = replacements[i.id] || i.id;
      for (const i of map.strategicCivicHistory.currentInstitutionRows) i.institutionId = replacements[i.institutionId] || i.institutionId;
      map.cityPolities.polities[0].authority = original.authority;
      map.strategicPoliticalHistory.currentControlRows[0].recognizedAuthorityId = original.authority.id;
      prepared.political = window.HelixCityAuthority.sourceFromWorld(map, 'a');
      prepared.recovery = window.HelixCityRecovery.sourceFromWorld(map, 'a');
      prepared.operation = window.HelixCityRule.sourceFromWorld(map, 'a', {politicalSettlement:true});
      prepared.defense = window.HelixCityDefense.sourceFromWorld(map, 'a', {politicalSettlement:true});
    } else {
    const p = prepared.political, op = prepared.operation, defense = prepared.defense;
    p.charterId = op.charterId = defense.charterId = original.charterId;
    p.parties[0] = { ...p.parties[0], authorityId: original.authority.id, name: original.authority.name, kind: original.authority.kind, charterId: original.charterId };
    for (const list of [p.institutions, op.institutions]) for (const i of list) {
      if (i.role === 'centralAdministration') i.id = original.administrationId;
      if (i.role === 'militaryDefenseCommand') i.id = original.defenseId;
    }
    defense.institutionId = original.defenseId; op.baselineAuthorityId = original.authority.id;
    for (const farm of op.farms) farm.charterId = original.charterId;
    }
    const inputs=[{political:prepared.political,operation:prepared.operation,defense:prepared.defense,
      ...(recovery?{recovery:prepared.recovery,rawMap:prepared.rawMap}:{})}];
    if(claimant) {
      lost.cityId='lost-city';lost.charterId='charter:lost-city';lost.populationSourceId='population:lost-city';
      lost.sourceId='population:lost-city:political-authority';lost.politicalSourceId='lost-city:playable-political-control';
      lost.parties[0].cityId='lost-city';lost.parties[0].charterId=lost.charterId;lost.parties[0].hostCityId='a';
      inputs.push({political:lost,operation:null,defense:null});
    }
    if (!d.configureCityAuthorityTest(inputs)) throw Error('Prior original political sources refused');
    if (!d.scientistIdentityAction('walk')) throw Error('Original civic walk refused');
    for (let n = 0; n < 50; n++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) break;
      d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true);
    }
    d.advanceCityRuleForTest(0);
  }, { renderer, prepared, recovery, claimant, lost: claimant ? sourceMap('collective','displacedClaim').political : null });
  await page.locator('[data-workspace-tab="visits"]').click();
  const panel = page.locator('[data-city-authority]'); await expect(panel).toBeVisible();
  const action = name => panel.locator(`[data-city-authority-action="${name}"][data-city-authority-target="${claimant?'lost-city':'a'}"]`).click();
  await action('inspect'); await tick(page, 60);
  let s = await snapshot(page); expect(s.saved.entries[0].phase).toBe('unreceived');
  expect(s.saved.entries[0].knowledge, JSON.stringify({ context: s.counter.context, office: s.counter.office, job: s.saved.job })).toBeTruthy();
  expect(s.saved.entries[0].knowledge.parties[0].kind).toBe('collective');
  await action('negotiate'); await tick(page, 60); s = await snapshot(page);
  expect(s.saved.job.progress).toBe(60); expect(s.saved.entries[0].terms).toBeNull();
  const partial = s.saved.authorities;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snapshot(page)).saved.authorities).toEqual(partial); await tick(page, 120);
  s = await snapshot(page); expect(s.saved.entries[0].phase).toBe('offered');
  expect(s.saved.entries[0].operation).toBeNull(); expect(s.saved.authorities[0].decisions[0].voters).toHaveLength(3);
  await action('accept'); await tick(page, 60); s = await snapshot(page);
  expect(s.saved.entries[0].phase).toBe('active'); expect(s.saved.entries[0].resolutions[0].members).toHaveLength(3);
  if(claimant) {
    expect(s.saved.entries[0].source.population).toBe(0);expect(s.saved.entries[0].operation).toBeNull();
    expect(s.saved.authorities[0].operator.workSeconds).toBe(1500);expect(s.saved.authorities[0].channelPower).toBe(9);
    expect(s.saved.authorities[0].members.every(a=>a.status==='alive')).toBe(true);
    await expect(panel.locator('[data-city-authority-action="operate"][data-city-authority-target="lost-city"]')).toHaveCount(0);
    const before=s.saved;const bundle=await page.evaluate(()=>({format:'helix-heresy-run-bundle',version:2,...window.helixHeresyDebug.currentWorldRunSnapshot()}));
    await page.locator('#newRunBtn').click();await page.locator('#titleImportFileInput').setInputFiles({name:'continued-claimants.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/,{timeout:60000});await page.locator('[data-workspace-tab="visits"]').click();s=await snapshot(page);
    expect(s.saved.runId).not.toBe(before.runId);expect(s.saved.authorities).toEqual(before.authorities);expect(s.saved.entries[0].knowledge).toEqual(before.entries[0].knowledge);
    await action('report');await tick(page,60);s=await snapshot(page);expect(s.saved.authorities[0].operator.workSeconds).toBe(1440);
    const frozen=s.saved;await page.evaluate(()=>{const d=window.helixHeresyDebug;d.inflictTestScientistDamage();d.advanceSimulation(100);});
    expect((await snapshot(page)).saved).toEqual(frozen);expect(errors).toEqual([]);return;
  }
  if (recovery) {
    expect(await page.evaluate(() => window.helixHeresyDebug.cityAuthorityAction('operate','a'))).toBe(false);
    await action('recoveryReview'); s = await snapshot(page); expect(s.saved.entries[0].recovery.source.projects.length).toBeGreaterThan(0);
    // Original physical input piles at the attended counter. Every portion
    // must actually fit in the scientist's inventory and enter city custody.
    const piles = await page.evaluate(() => window.helixHeresyDebug.configureHiddenWorkshopTest({supplies:{metalParts:120,preparedManaCrystals:30,fieldRation:120,drinkingWater:120}}));
    await page.evaluate(piles => {
      const d=window.helixHeresyDebug, keys=['metalParts','preparedManaCrystals','fieldRation','drinkingWater'];
      const r=d.cityAuthoritySnapshot().saved.entries[0].recovery;let rest=0,work=28800;
      for(const p of r.source.projects) {if(p.seconds>work){rest++;work=28800;}work-=p.seconds;}
      for(let k=0;k<keys.length;k++) {
        let needed=r.source.projects.reduce((n,p)=>n+p.costs[keys[k]],0)+(k>=2?rest*r.crew.length:0);
        while(needed>0) {
          const quantity=Math.min(5,needed);
          if(!d.carryActorStack('scientist',piles[k],quantity))throw Error(`Cannot carry original ${keys[k]}`);
          if(!d.cityAuthorityAction(`recoveryStage:${keys[k]}`,'a'))throw Error(`Original ${keys[k]} delivery refused`);
          needed-=quantity;
        }
      }
    },piles);
    await action('recoveryStart'); await tick(page,60); s=await snapshot(page);
    expect(s.saved.entries[0].recovery.job.progress).toBe(60);const held=s.saved.entries[0].recovery;
    await page.reload();await page.locator('#loadLastSaveBtn').click();await page.locator('[data-workspace-tab="visits"]').click();
    expect((await snapshot(page)).saved.entries[0].recovery).toEqual(held);
    const resumed=await snapshot(page), context=resumed.recoveries[0].context;
    expect({sourceCurrent:context.sourceCurrent,authority:context.authority,worksAvailable:context.worksAvailable,
      defenseAvailable:context.defenseAvailable,alive:context.alive,bodyEpoch:context.bodyEpoch},JSON.stringify({context,staff:resumed.saved.entries[0].staff}))
      .toEqual({sourceCurrent:true,authority:true,worksAvailable:true,defenseAvailable:true,alive:true,bodyEpoch:held.job.bodyEpoch});
    for(let n=0;n<12;n++) {
      s=await snapshot(page);const r=s.saved.entries[0].recovery;
      if(r.completed.length===r.source.projects.length) break;
      if(!r.job) await action('recoveryStart');
      const job=(await snapshot(page)).saved.entries[0].recovery.job;
      expect(job,JSON.stringify(r.report)).toBeTruthy();
      expect(await page.evaluate(n=>window.helixHeresyDebug.advanceCityRecoveryForTest(n),job.seconds-job.progress)).not.toBe(false);
      const advanced=await snapshot(page);
      expect(advanced.saved.entries[0].recovery.job,JSON.stringify({job:advanced.saved.entries[0].recovery.job,context:advanced.recoveries,
        staff:advanced.saved.entries[0].staff,crew:advanced.saved.entries[0].recovery.crew})).toBeNull();
    }
    await action('recoveryReview');s=await snapshot(page);
    expect(s.saved.entries[0].recovery.completed).toHaveLength(s.saved.entries[0].recovery.source.projects.length);
    expect(s.saved.entries[0].recovery.rested.length).toBeGreaterThan(0);
  }
  await action('operate');
  if (recovery) expect(await page.evaluate(() => window.helixHeresyDebug.advanceCityClientForTest(3600 + 3 * 86400))).not.toBe(false);
  else await page.evaluate(() => window.helixHeresyDebug.advanceCityRuleForTest(3600 + 3 * 86400, true));
  await tick(page, 0);
  s = await snapshot(page); expect(s.saved.entries[0].operation.status).toBe('established');
  expect(s.saved.entries[0].operation.authorityKind).toBe('subordinateLocalGovernment');
  await action('receiveOperation');
  const history = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().saved.cityReports.find(e => e.temporal === 'historical'));
  expect(history.period.endAt - history.period.startAt).toBe(3 * 86400);
  await action('withdraw'); await tick(page, 60); s = await snapshot(page);
  expect(s.saved.entries[0].phase).toBe('withdrawn'); expect(s.saved.entries[0].operation.status).toBe('contested');
  await action('receiveOperation');
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().saved.cityReports.find(e => e.temporal === 'historical'))).toEqual(history);
  const saved = (await snapshot(page)).saved;
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-city-authority.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click(); s = await snapshot(page);
  expect(s.saved.runId).not.toBe(saved.runId); expect(s.saved.entries[0].knowledge).toEqual(saved.entries[0].knowledge);
  expect(s.saved.authorities).toEqual(saved.authorities); expect(s.saved.entries[0].operation.foodKg).toBe(saved.entries[0].operation.foodKg);
  expect(s.saved.entries[0].operation.runId).toBe(s.saved.runId); expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = s.saved;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); });
  expect((await snapshot(page)).saved).toEqual(frozen);
});
