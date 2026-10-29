const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../city-authority'), R = require('../city-rule'), Bargains = require('../sovereign-bargains');
const { sourceMap } = require('./helpers/city-authority-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(status='occupied') {
  const sources=sourceMap('collective',status), book=A.create({worldId:'w',runId:'r'}), e=A.register(book,sources.political);
  const offices=Object.fromEntries(['a','controller'].map(cityId=>[cityId,{id:`${cityId}:actual-counter`,institutionId:`admin:${cityId}`,cityId,
    clerk:{id:`${cityId}:original-clerk`,status:'alive',health:100},workSeconds:5000,power:5000,assignment:null}]));
  const f={sources,book,e,offices,current:'a',at:0,changes:[]};
  f.context=()=>({at:f.at,alive:true,capable:true,local:true,atCounter:true,free:true,sourceCurrent:true,permission:true,
    originalBody:true,lineOfSight:true,clerkPresent:true,clerkId:offices[f.current].clerk.id,bodyEpoch:0,cityId:f.current,authorityChanges:f.changes});
  f.act=action=>{assert(A.begin(book,e,action,f.context(),offices[f.current],f.at,['accept','assent'].includes(action)?copy(e.terms):null));
    f.at+=book.job.seconds;A.advance(book,f.context(),offices[f.current],f.at);};
  f.sign=()=>{f.act('inspect');f.act('negotiate');f.act('accept');};return f;
}
test('political reception accepts a real occupied or captured public counter without a supply bargain, map archive or healthy defense institution',()=>{
  for(const status of ['sovereign','tributary','puppet','occupied']) {
    const {map}=sourceMap('collective',status), before=copy(map);
    const source=A.counterSource(map,'a');assert(source);assert.equal(source.institutionId,'admin:a');
    assert.equal(Bargains.sourceFromWorld(map,'a',{cityId:'a',institutionId:'admin:a'}),null);
    assert.deepEqual(map,before);
    delete map.cityGovernments.governments[0].charter.politicalAgreements;
    assert(A.counterSource(map,'a'));assert.equal(A.sourceFromWorld(map,'a'),null);
    map.strategicCivicHistory.currentInstitutionRows.find(i=>i.institutionId==='admin:a').operationalStatus='suspended';
    assert.equal(A.counterSource(map,'a'),null);
    delete map.strategicCivicHistory.currentInstitutionRows.find(i=>i.institutionId==='admin:a').operationalStatus;
    assert.equal(A.counterSource(map,'a'),null);
  }
});
test('the existing visitor permit, original clerk, line of sight, body, custody and local or recognized exclusion remain independent gates',()=>{
  const f=fixture(), g={...f.offices.a,institutionId:'admin:a'}, source=A.counterSource(f.sources.map,'a');
  const receipt={...f.context(),atDesk:true,authorityCurrent:true,visitId:'actual-visit',otherBusy:false,bans:[]};
  const permit={id:'actual-visitor-permit',scope:'visitorHallOnly',cityId:'a',bodyEpoch:0,visitId:'actual-visit',issuedAt:0,expiresAt:1000};
  const safeguards={originalBody:true,custodyActive:false,violence:false};
  const c=(r=receipt,p=permit,s=safeguards)=>A.counterContext(g,r,p,source,0,s);
  assert(A.ready(c(),g));
  for(const changed of [{...receipt,lineOfSight:false},{...receipt,authorityCurrent:false},{...receipt,clerkPresent:false},
    {...receipt,bans:[{status:'active',cityId:'a'}]},
    {...receipt,bans:[{status:'active',cityId:'other',recognizedBy:[{cityId:'a',status:'active',localOrderId:'actual-order',institutionId:'actual-watch'}]}]}]) {
    assert.equal(A.ready(c(changed),g),false);assert.equal(A.attending(c(changed),g),false);
  }
  for(const changed of [{...permit,cityId:'other'},{...permit,bodyEpoch:1},{...permit,visitId:'old-visit'},null,{...permit,expiresAt:0}]) {
    assert.equal(A.ready(c(receipt,changed),g),false);assert.equal(A.attending(c(receipt,changed),g),false);
  }
  for(const changed of [{...safeguards,originalBody:false},{...safeguards,custodyActive:true},{...safeguards,violence:true}])assert.equal(A.ready(c(receipt,permit,changed),g),false);
  assert(A.ready(c({...receipt,bans:[{status:'active',cityId:'other'}]}),g));
});
test('lost attendance permission pauses actual partial controller work without backfill, a substitute clerk or an unearned release',()=>{
  const f=fixture();f.sign();f.current='controller';
  assert(A.begin(f.book,f.e,'assent',f.context(),f.offices.controller,f.at,copy(f.e.terms)));
  f.at+=30;A.advance(f.book,f.context(),f.offices.controller,f.at);
  const duty=f.book.authorities[1].members[0].dutySeconds,power=f.offices.controller.power;
  f.at+=500;A.advance(f.book,{...f.context(),excluded:true},f.offices.controller,f.at);
  assert.equal(f.book.job.progress,30);assert.equal(f.e.phase,'awaitingControllers');assert.equal(f.offices.controller.power,power);
  f.at++;A.advance(f.book,f.context(),f.offices.controller,f.at);assert.equal(f.book.job.progress,30);
  f.at+=150;A.advance(f.book,f.context(),f.offices.controller,f.at);assert.equal(f.e.phase,'active');
  assert.equal(f.book.authorities[1].members[0].dutySeconds,duty-150);assert(A.authorizes(f.e,f.book.authorities,f.context(),f.at));
});
test('only the local government can accept or withdraw local submission; a controller can release only its exact separately accepted claim',()=>{
  const f=fixture();f.act('inspect');f.act('negotiate');f.current='controller';
  assert.equal(A.begin(f.book,f.e,'accept',f.context(),f.offices.controller,f.at,copy(f.e.terms)),false);
  f.current='a';f.act('accept');assert.equal(A.begin(f.book,f.e,'assent',f.context(),f.offices.a,f.at,copy(f.e.terms)),false);
  f.current='controller';f.act('assent');
  assert.equal(A.begin(f.book,f.e,'withdraw',f.context(),f.offices.controller,f.at),false);
  assert.equal(A.begin(f.book,f.e,'assent',f.context(),f.offices.controller,f.at,copy(f.e.terms)),false);
});
test('an actual authority-change receipt stops unfinished old-controller work without issuing consent, restoring attention or rewriting the local agreement',()=>{
  const f=fixture();f.sign();f.current='controller';
  assert(A.begin(f.book,f.e,'assent',f.context(),f.offices.controller,f.at,copy(f.e.terms)));
  f.at+=30;A.advance(f.book,f.context(),f.offices.controller,f.at);
  const held=copy(f.e.knowledge), duty=f.book.authorities[1].members[0].dutySeconds;
  const source={cityId:'controller',charterId:'charter:controller'};
  const handover={id:'completed-controller-handover',at:f.at,cityId:source.cityId,charterId:source.charterId,recognizedAuthorityId:'scientist',bodyEpoch:0};
  f.changes=[A.authorityChange({source,handover,control:{...source,recognizedAuthorityId:'scientist',bodyEpoch:0,sourceReceiptId:handover.id}})];
  f.at+=150;A.advance(f.book,f.context(),f.offices.controller,f.at);
  assert.equal(f.book.job.progress,30);assert.equal(f.e.phase,'awaitingControllers');
  assert.equal(f.book.authorities[1].members[0].dutySeconds,duty);assert.deepEqual(f.e.knowledge,held);
  assert.equal(A.authorizes(f.e,f.book.authorities,f.context(),f.at),false);
});
test('a completed controller claim release remains historical after its government changes or its signer dies; a local authority change stops current operation without refilling it',()=>{
  const f=fixture();f.sign();f.current='controller';f.act('assent');
  const original=copy(f.e.knowledge), releaseAt=f.at;
  f.changes=[{cityId:'controller',charterId:'charter:controller',authorityId:'scientist',at:releaseAt+1,receiptId:'real-later-handover',invalid:false}];f.at++;
  f.book.authorities[1].members[0].status='dead';assert(A.authorizes(f.e,f.book.authorities,f.context(),f.at));
  f.current='a';const c=()=>({...f.context(),politicalAuthorities:f.book.authorities,coverageVerified:true,institutionsAvailable:true,
    defenseAvailable:true,reportersPresent:true,counterpower:'noEstablishedChallenge',routes:{'farm:a':true}});
  const rule=R.createClient(f.sources.operation,f.e,f.book.authorities,f.book,f.at,{id:'actual-ward',initialEnergy:69120},c());assert(rule);
  const staff=f.sources.operation.institutions.map(i=>({id:`original:${i.id}`,institutionId:i.id,roles:[i.role],status:'alive',health:100}));
  assert(R.order(rule,f.e,staff,c(),f.at));f.at+=3600+R.INTERVAL;R.advance(rule,f.e,staff,c,f.at);assert.equal(rule.status,'established');
  assert(R.receive(rule,f.e,staff,c(),f.at));const historical=copy(rule.report), initial=rule.initialEnergy, energy=rule.energy;
  f.changes.push({cityId:'a',charterId:'charter:a',authorityId:'scientist',at:f.at,receiptId:'actual-local-handover',invalid:false});
  f.at+=60;R.advance(rule,f.e,staff,c,f.at);assert.equal(rule.status,'contested');assert.equal(rule.initialEnergy,initial);assert(rule.energy<energy);
  assert.deepEqual(rule.report,historical);assert.deepEqual(f.e.knowledge,original);
  assert.equal(A.begin(f.book,f.e,'negotiate',f.context(),f.offices.a,f.at),false);
});
test('an authority label without the original completed handover and matching recognized-control receipt cannot establish a new authority',()=>{
  const source={cityId:'a',charterId:'charter:a'}, handover={id:'actual-handover',at:100,cityId:'a',charterId:'charter:a',recognizedAuthorityId:'scientist',bodyEpoch:0};
  const s={source,handover,control:{cityId:'a',charterId:'charter:a',recognizedAuthorityId:'scientist',sourceReceiptId:'actual-handover',bodyEpoch:0}};
  assert.equal(A.authorityChange({source,control:s.control}),null);assert.equal(A.authorityChange(s).invalid,false);
  assert.equal(A.authorityChange({...s,control:{...s.control,sourceReceiptId:'unrelated'}}).invalid,true);
});
test('a city operating allocation stays reserved across lost state, withdrawal and JSON saves; other cities and unsigned terms have no such allocation',()=>{
  const f=fixture();assert.equal(A.hasOperatingAllocation(f.book,'a'),false);
  f.sign();assert.equal(A.hasOperatingAllocation(f.book,'a'),false);
  f.e.operationAllocatedAt=0;f.e.operationLost=true;f.e.phase='withdrawn';
  assert(A.hasOperatingAllocation(f.book,'a'));assert(A.hasOperatingAllocation(copy(f.book),'a'));
  assert.equal(A.hasOperatingAllocation(f.book,'other'),false);assert.equal(A.hasOperatingAllocation(null,'a'),false);
});
