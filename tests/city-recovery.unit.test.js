const {test}=require('node:test'), assert=require('node:assert/strict');
const Recovery=require('../city-recovery'), R=require('../city-rule'), A=require('../city-authority'), D=require('../city-defense');
const {recoverySources}=require('./helpers/city-recovery-source');
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(mode) {
  const sources=recoverySources(mode), binding={worldId:'w',runId:'r'}, s=Recovery.create(sources.recovery,binding,0);
  const c={alive:true,capable:true,local:true,atCounter:true,clerkPresent:true,free:true,permission:true,sourceCurrent:true,authority:true,
    worksAvailable:true,defenseAvailable:true,cityId:'a',bodyEpoch:0};
  const stacks=Recovery.KEYS.map(key=>({id:`carried:${key}`,key,quantity:1000,knownQuantity:1000,carriedBy:'scientist'}));
  return {sources,binding,s,c,stacks,at:0};
}
function finish(f) {
  while(f.s.completed.length<f.s.source.projects.length) {
    for(const k of Recovery.KEYS) Recovery.stage(f.s,f.c,f.stacks,k,f.at);
    assert(Recovery.begin(f.s,f.c,f.at)); const seconds=f.s.job.seconds; f.at+=seconds;
    assert(Recovery.advance(f.s,f.c,f.at)); assert.equal(f.s.job,null);
  }
}
test('actual staged inputs and original finite crew repair failed city, institutions and agricultural routes without rewriting world history',()=>{
  const f=fixture(), original=copy(f.sources.rawMap); assert.equal(f.sources.operation,null); assert.equal(f.sources.defense,null);
  assert.equal(Recovery.begin(f.s,f.c,0),false); finish(f);
  assert(f.s.rested.length>0); assert(f.s.spent.metalParts>0); assert(f.s.crew.every(a=>a.workSeconds<28800));
  const map=Recovery.projectMap(f.sources.rawMap,f.s,f.binding), operation=R.sourceFromWorld(map,'a',{politicalSettlement:true});
  assert(R.validSource(operation)); assert(D.validSource(D.sourceFromWorld(map,'a',{politicalSettlement:true})));
  assert.deepEqual(f.sources.rawMap,original); assert.deepEqual(A.sourceFromWorld(map,'a').parties,f.sources.political.parties);
  assert.equal(map.strategicPlayableSettlementState.cityRows[0].currentPopulation,3000);
  assert.equal(Recovery.projectMap(f.sources.rawMap,f.s,{worldId:'w',runId:'another'}),f.sources.rawMap);
  assert(Recovery.normalize(copy(f.s)));
});
test('missing, stolen, reserved, contaminated and remotely held supplies cannot fund repairs; delivering consumes actual carried stock',()=>{
  const f=fixture(); for(const flags of [{cityOwnerId:'a'},{reservedTaskId:'other'},{ownerId:'other'},{tags:['stolen']},{tags:['contaminated']},{carriedBy:'somebody'}]) {
    assert.equal(Recovery.stage(f.s,f.c,[{...f.stacks[0],...flags}],'metalParts',0),false);
  }
  assert.equal(Recovery.stage(f.s,{...f.c,local:false},f.stacks,'metalParts',0),false);
  const n=f.stacks[0].quantity; assert(Recovery.stage(f.s,f.c,f.stacks,'metalParts',0));
  assert.equal(n-f.stacks[0].quantity,f.s.stores.metalParts); assert.equal(Recovery.begin(f.s,f.c,0),false);
});
test('paid local work continues while scientist is away, but authority loss, original worker injury and final death pause without backfill or refunds',()=>{
  const f=fixture(); for(const k of Recovery.KEYS) Recovery.stage(f.s,f.c,f.stacks,k,0);
  assert(Recovery.begin(f.s,f.c,0)); f.at=30; Recovery.advance(f.s,{...f.c,local:false},f.at); assert.equal(f.s.job.progress,30);
  const spent=copy(f.s.spent), held=copy(f.s.report); f.at+=1000; Recovery.advance(f.s,{...f.c,authority:false},f.at);
  assert.equal(f.s.job.progress,30); f.at++; Recovery.advance(f.s,f.c,f.at); assert.equal(f.s.job.progress,30);
  f.s.crew[0].health=20; f.at+=60; Recovery.advance(f.s,f.c,f.at); assert.equal(f.s.job.progress,30);
  assert.deepEqual(f.s.spent,spent); assert.deepEqual(f.s.report,held);
  const before=copy(f.s); assert.equal(Recovery.advance(f.s,{...f.c,alive:false},f.at+1000),false); assert.deepEqual(f.s,before);
});
test('partial work and finite custody survive JSON normalization; lost input ledgers and invented completion receipts are rejected',()=>{
  const f=fixture(); for(const k of Recovery.KEYS) Recovery.stage(f.s,f.c,f.stacks,k,0);
  assert(Recovery.begin(f.s,f.c,0)); Recovery.advance(f.s,f.c,60); const saved=Recovery.normalize(copy(f.s)); assert(saved);
  assert.deepEqual(saved,f.s); const forged=copy(saved); forged.stores.metalParts++;
  assert.equal(Recovery.normalize(forged),null); forged.stores.metalParts--; forged.completed.push({projectId:f.s.source.projects[0].id,at:60});
  assert.equal(Recovery.normalize(forged),null);
  const book=A.create(f.binding), e=A.register(book,f.sources.political);
  e.recovery=Recovery.create(f.sources.recovery,book,0);
  assert.doesNotThrow(()=>JSON.stringify(book));assert.equal(e.recovery.entries,undefined);
});
test('coarse paid repair catch-up agrees exactly with ordinary minute updates',()=>{
  const coarse=fixture(), fine=fixture();
  for(const f of [coarse,fine]) {for(const k of Recovery.KEYS)Recovery.stage(f.s,f.c,f.stacks,k,0);assert(Recovery.begin(f.s,f.c,0));}
  const seconds=coarse.s.job.seconds;Recovery.advance(coarse.s,coarse.c,seconds);
  for(let at=60;at<=seconds;at+=60)Recovery.advance(fine.s,fine.c,at);
  assert.deepEqual(coarse.s,fine.s);assert(Recovery.normalize(coarse.s));
});
test('existing aircraft and mounts retain their original transport mode, crews, carrying capacity and finite range rather than becoming trucks',()=>{
  for(const mode of ['groundConvoy','mixedFleet','aircraft','flyingMounts']) {
    const f=fixture(mode); finish(f); const map=Recovery.projectMap(f.sources.rawMap,f.s,f.binding);
    const source=R.sourceFromWorld(map,'a',{politicalSettlement:true}); assert(R.validSource(source));
    assert.equal(source.farms[0].transport.mode,mode); assert.equal(source.farms[0].transport.operators,6);
    const book=A.create(f.binding), e=A.register(book,A.sourceFromWorld(map,'a'));
    const office={id:'a:counter',clerk:{id:'clerk',status:'alive',health:100},workSeconds:10000,power:10000};
    let at=0; const c=()=>({...f.c,at,clerkId:'clerk',clerkPresent:true});
    for(const kind of ['inspect','negotiate','accept']) {assert(A.begin(book,e,kind,c(),office,at,kind==='accept'?copy(e.terms):null));at+=book.job.seconds;A.advance(book,c(),office,at);}
    const r=R.createClient(source,e,book.authorities,book,at,{id:'defense',initialEnergy:69120},c());assert(r);
    const farm=r.farms[0]; assert.equal(farm.mode,mode); assert.equal(farm.drivers,6);
    assert.equal(farm.initialFuelKm,source.farms[0].transport.fuelKm);assert.equal(farm.capacityKg,source.farms[0].transport.capacityKg);
    const staff=source.institutions.map(i=>({id:`original:${i.id}`,institutionId:i.id,roles:[i.role],status:'alive',health:100}));
    const operation=()=>({...c(),reportersPresent:true,politicalAuthorities:book.authorities,institutionsAvailable:true,defenseAvailable:true,
      coverageVerified:true,counterpower:'noEstablishedChallenge',routes:{[farm.id]:true}});
    assert(R.order(r,e,staff,operation(),at));at+=3600+R.INTERVAL;R.advance(r,e,staff,operation,at);
    assert.equal(r.status,'established');assert(farm.deliveredKg>0);assert(farm.spentFuelKm>0);
    assert(Math.abs(farm.initialFuelKm-farm.spentFuelKm-farm.fuelKm)<1e-6);
  }
});
test('political suspension and actual replacement are not repaired into obedience; absent farms or power plants are not constructed from service labels',()=>{
  const f=fixture(); f.sources.rawMap.strategicCivicHistory.currentInstitutionRows[0].operationalStatus='suspended';
  const source=Recovery.sourceFromWorld(f.sources.rawMap,'a'); assert(!source.projects.some(p=>p.targetId==='admin:a'));
  const absent=fixture(); absent.sources.rawMap.strategicCapabilityHistory.milestoneRows=[]; finish(absent);
  assert.equal(R.sourceFromWorld(Recovery.projectMap(absent.sources.rawMap,absent.s,absent.binding),'a',{politicalSettlement:true}),null);
});
