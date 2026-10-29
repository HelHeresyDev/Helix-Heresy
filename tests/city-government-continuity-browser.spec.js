const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { sourceMap } = require('./helpers/city-authority-source');
const fs = require('node:fs');
test.setTimeout(600000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.cityAuthoritySnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n), n);
for (const renderer of ['dom', 'canvas']) test(`${renderer}: real client-to-direct handover keeps one account, real role refusal and renewal recover it, and saves retain original spending`, async ({ page }, testInfo) => {
  const errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await startLifecycleRun(page,`government-continuity-${renderer}`);
  await page.evaluate(({renderer,prepared})=>{
    const d=window.helixHeresyDebug;d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({network:{homeDestinationId:'site:lab',nearestSettlementDestinationId:'city:a',routes:[],destinations:[
      {id:'site:lab',kind:'laboratorySite',cityId:'a',label:'Lab',cellId:'planet-cell:00009',supportComponentId:'one',known:true,reachable:true,localDistanceKm:2,routeContinuity:'municipal',dangerBand:'veryLow'},
      {id:'city:a',kind:'fortifiedCity',cityId:'a',label:'Original city',cellId:'planet-cell:00001',supportComponentId:'one',known:true,reachable:true,jurisdiction:{kind:'city',cityId:'a'}}
    ]},context:{worldId:'lifecycle-world',siteId:'lab',strategicCellId:'planet-cell:00009',seed:'continuing-government',publicProspects:{},truth:{}}});
    d.configureScientistIdentityTest({office:true,money:1000});d.configureSovereignBargainTest();d.configureUnsupportedTest({municipal:true});
    d.configureWildernessTest({destination:{id:'original-approach',label:'Original approach',strategicCellId:'planet-cell:00002',jurisdiction:'Unclaimed wilderness',description:'Existing approach'}});
    if(!d.scientistIdentityAction('walk'))throw Error('Original counter walk refused');
    for(let n=0;n<45;n++){const s=d.surveyExpeditionSnapshot(),t=s.tasks.find(t=>!t.reason);if(!t)break;d.advanceCityRuleForTest(Math.max(1,t.dueAt-s.clock+1),true);}
    if(!d.configureCitySuccessionTest({retirement:true,population:3000}))throw Error('Original prior civic records refused');
    // Finite original prior capacity for both procedures and a real reviewed
    // refusal/renewal. No clock step, reload or handover refills it later.
    d.configureScientistIdentityTest({power:12,workSeconds:2200});
    const source=d.citySuccessionSnapshot().succession.source,p=prepared.political,op=prepared.operation,defense=prepared.defense;
    p.charterId=op.charterId=defense.charterId=source.charterId;
    p.populationSourceId=op.populationSourceId=defense.populationSourceId=source.populationSourceId;
    p.parties[0]={...p.parties[0],authorityId:source.authority.id,name:source.authority.name,kind:source.authority.kind,charterId:source.charterId};
    for(const list of [p.institutions,op.institutions])for(const i of list)i.id=source.institutions.find(v=>v.role===i.role).id;
    for(const farm of op.farms){farm.charterId=source.charterId;farm.populationSourceId=source.populationSourceId;farm.institutionId=source.institutions.find(i=>i.role==='publicWorksAndProvisioning').id;}
    defense.institutionId=source.defenseId;op.baselineAuthorityId=source.authority.id;
    if(!d.configureCityAuthorityTest([{political:p,operation:op,defense}]))throw Error('Original city inputs refused');
    const ids=d.configureHiddenWorkshopTest({supplies:{metalParts:18,relayBattery:1}});
    if(!d.carryActorStack('scientist',ids[0],18))throw Error('Original carried reserve does not fit');
    if(!d.carryActorStack('scientist',ids[1],1))throw Error('Original counter battery does not fit');
  },{renderer,prepared:sourceMap('individual')});
  await page.locator('[data-workspace-tab="visits"]').click();
  const panel=page.locator('[data-city-authority]'), act=name=>panel.locator(`[data-city-authority-action="${name}"][data-city-authority-target="a"]`).click();
  await act('inspect');await tick(page,60);await act('negotiate');await tick(page,180);await act('accept');await tick(page,60);
  await act('operate');expect(await page.evaluate(()=>window.helixHeresyDebug.advanceCityClientForTest(3600+3*86400))).not.toBe(false);
  await act('receiveOperation');let e=(await snapshot(page)).saved.entries[0];expect(e.operation.status).toBe('established');
  const original={at:e.operation.allocatedAt,proof:e.operation.handoverId,source:e.operation.source,since:e.operation.since,report:e.operation.report};
  const history=await page.evaluate(()=>window.helixHeresyDebug.supremacySnapshot().saved.cityReports.find(r=>r.temporal==='historical'));
  console.log(`${renderer}: original client account established; performing actual succession`);
  await page.evaluate(()=>{
    const d=window.helixHeresyDebug,a=(kind,expected)=>{if(!d.citySuccessionAction(kind,expected))throw Error(`Actual succession refused ${kind}`);};
    a('request');d.advanceCitySuccessionForTest(30);a('hear');d.advanceCitySuccessionForTest(180);a('sign',d.citySuccessionSnapshot().succession.terms);a('deliver');
    for(const p of [...d.citySuccessionSnapshot().succession.leaders,d.citySuccessionSnapshot().bargain.defender]){a('agree',p.id);d.advanceCitySuccessionForTest(60);}
    a('handover');d.advanceCitySuccessionForTest(60);
  });
  expect((await snapshot(page)).saved.entries[0].operation.governmentBinding).toBeFalsy();
  const partial=await page.evaluate(()=>window.helixHeresyDebug.citySuccessionSnapshot().succession);
  await page.reload();await page.locator('#loadLastSaveBtn').click();await page.locator('[data-workspace-tab="visits"]').click();
  expect(await page.evaluate(()=>window.helixHeresyDebug.citySuccessionSnapshot().succession)).toEqual(partial);
  await page.evaluate(()=>window.helixHeresyDebug.advanceCitySuccessionForTest(120));
  e=(await snapshot(page)).saved.entries[0];expect(e.operation.governmentBinding.receiptId).toBe(partial.id+':handover');
  expect(e.staff.every(a=>!a.assignment)).toBe(true);
  expect(e.operation.allocatedAt).toBe(original.at);expect(e.operation.handoverId).toBe(original.proof);expect(e.operation.source).toEqual(original.source);
  expect(e.operation.since).toBe(original.since);expect(e.operation.status).toBe('established');expect(e.operation.report).toEqual(original.report);
  expect(e.operation.energy).toBeLessThan(original.report.energy);
  expect(await page.evaluate(()=>({rule:window.helixHeresyDebug.cityRuleSnapshot().saved,provision:window.helixHeresyDebug.cityProvisioningSnapshot().saved,defense:window.helixHeresyDebug.cityDefenseSnapshot().saved}))).toEqual({rule:null,provision:null,defense:null});
  await act('receiveOperation');await expect(panel).toContainText('continuing under the witnessed handover');
  const checkpoint=testInfo.outputPath('actual-post-handover.json');
  fs.writeFileSync(checkpoint,await page.evaluate(()=>JSON.stringify({format:'helix-heresy-run-bundle',version:2,...window.helixHeresyDebug.currentWorldRunSnapshot()})));
  await testInfo.attach('actual-post-handover.json',{path:checkpoint,contentType:'application/json'});
  // An actual out-of-scope order causes the existing official to withdraw
  // this role. Independent review and explicit renewal, not a test flag,
  // restore it; no new official, appointment or budget is supplied.
  await page.evaluate(()=>{const d=window.helixHeresyDebug;
    if(!d.cityAdministrationAction('battery'))throw Error('Actual carried counter battery refused');
    if(!d.cityAdministrationAction('inspect')){const s=d.cityAdministrationSnapshot();throw Error(`Actual counter inspection refused: ${JSON.stringify({worker:s.succession.leaders.find(a=>a.id===s.administration.workerId),office:s.office,context:s.context})}`);}
    if(!d.cityResistanceAction('terms'))throw Error('Existing duties discussion refused');
    if(!d.cityResistanceAction('accept',d.cityAdministrationSnapshot().administration.resistance.offer))throw Error('Exact duties acceptance refused');
    d.advanceCityAdministrationForTest(60);
    if(!d.cityResistanceAction('demandDefense'))throw Error('Actual bounded refusal absent');
  });
  await tick(page,60);e=(await snapshot(page)).saved.entries[0];expect(e.operation.status).toBe('contested');
  expect(e.operation.accomplishment).toEqual(original.report.accomplishment);
  const failedEnergy=e.operation.energy;
  await page.evaluate(()=>{const d=window.helixHeresyDebug;
    if(!d.cityResistanceAction('review'))throw Error('Independent review filing refused');
    let s=d.cityAdministrationSnapshot();d.advanceCityAdministrationForTest(s.administration.resistance.notice.review.readyAt-s.clock);
    if(!d.cityResistanceAction('hear'))throw Error('Actual independent hearing refused');d.advanceCityAdministrationForTest(180);
    s=d.cityAdministrationSnapshot();if(!d.cityResistanceAction('renew',s.administration.resistance.notice.review))throw Error(`Exact reviewed renewal refused: ${JSON.stringify(s.context)}`);
    d.advanceCityAdministrationForTest(60);
  });
  await tick(page,60);e=(await snapshot(page)).saved.entries[0];expect(e.operation.status).toBe('limited');expect(e.operation.energy).toBeLessThan(failedEnergy);
  expect(e.operation.since).toBeGreaterThan(original.since);expect(e.operation.accomplishment).toEqual(original.report.accomplishment);
  const before=(await snapshot(page)).saved,bundle=await page.evaluate(()=>({format:'helix-heresy-run-bundle',version:2,...window.helixHeresyDebug.currentWorldRunSnapshot()}));
  await page.locator('#newRunBtn').click();await page.locator('#titleImportFileInput').setInputFiles({name:'continued-city-government.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/,{timeout:60000});
  const after=(await snapshot(page)).saved;expect(after.runId).not.toBe(before.runId);expect(after.authorities).toEqual(before.authorities);
  expect(after.entries[0].operation).toEqual({...before.entries[0].operation,runId:after.runId});
  expect(await page.evaluate(()=>window.helixHeresyDebug.supremacySnapshot().saved.cityReports.find(r=>r.temporal==='historical'))).toEqual(history);
  expect(await page.evaluate(()=>window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen=after;await page.evaluate(()=>{const d=window.helixHeresyDebug;d.inflictTestScientistDamage();d.advanceSimulation(100);});expect((await snapshot(page)).saved).toEqual(frozen);
  expect(errors).toEqual([]);
});
