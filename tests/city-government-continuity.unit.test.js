const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../city-authority'), R = require('../city-rule'), S = require('../city-succession');
const B = require('../sovereign-bargains'), D = require('../defender-challenges'), H = require('../city-rule-history');
const Supremacy = require('../durable-supremacy');
const { sourceMap } = require('./helpers/city-authority-source');
const { sources } = require('./helpers/regional-government-source');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const input = sourceMap('individual'), source = sources('a').succession;
  const office = { id:'counter:a',cityId:'a',institutionId:source.administrationId,active:true,channelPowered:true,maintenanceReady:true,availableAt:0,
    clerk:{id:'clerk:a',status:'alive',health:100},power:20,workSeconds:1500,assignment:null };
  const bargain=B.create(source,office), succession=S.create(source,bargain,office);D.prepareDefender(bargain);
  succession.ruler.retirementPolicy='considerAdministrativeRetirement';
  const book=A.create({worldId:'w',runId:'r'}), entry=A.register(book,input.political);
  entry.staff=[...succession.leaders,bargain.defender];
  const f={input,source,office,bargain,succession,book,entry,at:0};
  f.old=()=>({alive:true,capable:true,local:true,atCounter:true,free:true,sourceCurrent:true,permission:true,clerkPresent:true,
    clerkId:office.clerk.id,bodyEpoch:0,cityId:'a',at:f.at,powerPerSecond:0,politicalAuthorities:book.authorities,
    coverageVerified:true,institutionsAvailable:true,reportersPresent:true,defenseAvailable:true,counterpower:'noEstablishedChallenge',routes:{'farm:a':true}});
  for(const action of ['inspect','negotiate','accept']) {
    assert(A.begin(book,entry,action,f.old(),office,f.at,action==='accept'?copy(entry.terms):null,[succession.ruler]));
    f.at+=book.job.seconds;A.advance(book,f.old(),office,f.at);
  }
  f.rule=R.createClient(input.operation,entry,book.authorities,book,f.at,{id:input.defense.installationId,initialEnergy:69120},f.old());
  assert(f.rule);entry.operation=f.rule;entry.operationAllocatedAt=f.at;
  assert(R.order(f.rule,entry,entry.staff,f.old(),f.at));
  f.tick=n=>{f.at+=n;R.advance(f.rule,entry,entry.staff,f.rule.governmentBinding?f.current:f.old,f.at);};
  f.current=()=>({...f.old(),governingSuccession:f.succession,governingPeople:[...f.succession.leaders,f.bargain.defender],
    authorityChanges:f.succession.handover?[A.authorityChange(f.succession)]:[]});
  f.transfer=()=>R.continueGovernment(f.rule,f.entry,f.entry.staff,f.old,f.succession,[...f.succession.leaders,f.bargain.defender],f.current(),f.at);
  return f;
}
function handover(f, reload=false) {
  let s=f.succession,b=f.bargain,o=f.office;
  const c={...f.old(),visitPermission:true,lineOfSight:true,busy:false,authorityId:s.source.authority.id,
    charterCurrent:true,administrationAvailable:true,participantsPresent:true,leadersPresent:true,
    serviceIds:['original-batch:a','original-batch:b','original-batch:c']};
  const challenge={terms:{bodyEpoch:0},receipt:{id:'original-concession',outcome:'defenderConceded',bodyEpoch:0,
    defenderId:b.defender.id,witnessId:b.representative.id,charterId:s.source.charterId,authorityId:s.ruler.id},
    petition:{id:'original-petition',status:'filedNotAccepted',authorityId:s.ruler.id,receiptId:'original-concession'}};
  const step=n=>{f.at+=n;S.advance(s,b,o,c,f.at,{move:(actor,target)=>{actor.mapCell=copy(target);return true;}});};
  assert(S.request(s,b,o,challenge,c,f.at));step(30);assert.equal(s.phase,'ready');
  assert(S.hear(s,b,o,c,f.at));step(180);assert(S.sign(s,b,o,copy(s.terms),c,f.at));
  assert(S.deliver(s,b,o,[{id:'original-owned-parts',key:'metalParts',quantity:18,carriedBy:'scientist'}],c,f.at));
  for(const a of [...s.leaders,b.defender]){assert(S.agree(s,b,o,a.id,c,f.at));step(60);}
  assert(S.handover(s,b,o,c,f.at));
  if(reload){
    step(60);const budget=s.leaders.map(a=>a.workSeconds);
    s=S.normalize(copy(s));b=B.normalize(copy(b));o=copy(o);f.book=A.normalize(copy(f.book));f.entry=f.book.entries[0];f.rule=f.entry.operation;
    // Saved graphs must rejoin before the existing work/release mutates them.
    s.ruler=A.adoptActor(f.book,s.ruler);s.leaders=s.leaders.map(a=>A.adoptActor(f.book,a));b.defender=A.adoptActor(f.book,b.defender);
    assert.deepEqual(s.leaders.map(a=>a.workSeconds),budget);f.succession=s;f.bargain=b;f.office=o;step(120);
  }else step(180);
  assert.equal(s.phase,'transferred');
}
test('saved partial succession rejoins original actors before completion, releases each real reservation and never restores spent personal work',()=>{
  const f=fixture();f.tick(3600);handover(f,true);
  for(const p of [...f.succession.leaders,f.bargain.defender]){
    assert.equal(p.assignment,null);assert.equal(f.entry.staff.find(a=>a.id===p.id),p);assert(p.workSeconds<(p.id===f.bargain.defender.id?3600:1800));
  }
  assert(f.transfer());assert(R.authority(f.rule,f.entry,f.entry.staff,f.current()));
});
test('real succession continues the same depleted account and qualifying interval without replenishing people, work, cargo, maintenance or held reports',()=>{
  const f=fixture();f.tick(3600+R.INTERVAL);assert.equal(f.rule.status,'established');
  assert(R.receive(f.rule,f.entry,f.entry.staff,f.old(),f.at));const report=copy(f.rule.report), period=H.project(report)[1];
  const since=f.rule.since, allocation=f.rule.allocatedAt, original=f.rule, initial=copy(f.rule.source);
  handover(f);const people=copy([...f.succession.leaders,f.bargain.defender]);
  // Real old-government work is advanced to the actual transfer boundary.
  R.advance(f.rule,f.entry,f.entry.staff,f.old,f.at);const reserves=copy(f.rule);
  assert(f.transfer());assert.equal(f.rule,original);assert.deepEqual(f.rule.source,initial);
  for(const key of ['foodKg','waterLiters','rawWaterLiters','energy','spentEnergy','eatenKg','operatorWorkSeconds','farms','powerFuel','powerMaintenance','allocatedAt','plan'])assert.deepEqual(f.rule[key],reserves[key],key);
  assert.deepEqual([...f.succession.leaders,f.bargain.defender],people);assert.equal(f.rule.since,since);assert.equal(f.rule.allocatedAt,allocation);
  assert.deepEqual(f.rule.report,report);assert.equal(f.rule.governmentBinding.receiptId,f.succession.handover.id);
  f.succession.ruler.status='dead';f.tick(60);assert.equal(f.rule.status,'established');
  assert.equal(Supremacy.cityAccount(f.book,f.rule,f.entry,f.entry.staff,f.current(),f.at).basis,'directGovernment');
  assert(R.receive(f.rule,f.entry,f.entry.staff,f.current(),f.at));assert.deepEqual(H.project(f.rule.report)[1].period,period.period);
  assert.deepEqual(H.project(f.rule.report)[1].cityScope,period.cityScope);assert.equal(f.transfer(),false);
});
test('missing assent, changed city/population/body/charter and a control label without an actual handover cannot bind or refill an account',()=>{
  for(const change of [f=>{f.succession.handover=null;},f=>f.succession.agreements.pop(),f=>f.succession.source.cityId='other',
    f=>f.succession.source.populationSourceId='other',f=>f.succession.source.population++,f=>f.succession.source.charterId='other',
    f=>f.succession.control.sourceReceiptId='unrelated',f=>f.succession.control.bodyEpoch++]) {
    const f=fixture();f.tick(3600);handover(f);change(f);const held=copy(f.rule);
    assert.equal(f.transfer(),false);assert.deepEqual(f.rule,held);
  }
});
test('actual in-transit original cargo and a not-yet-completed qualifying interval cross the handover without a new timer or shipment',()=>{
  const f=fixture();f.tick(3601);const since=f.rule.since;
  assert(f.rule.farms.some(f=>f.trip));handover(f);
  R.advance(f.rule,f.entry,f.entry.staff,f.old,f.at);
  const cargo=copy(f.rule.farms);assert(cargo.some(f=>f.trip));
  assert(f.transfer());assert.deepEqual(f.rule.farms,cargo);assert.equal(f.rule.since,since);
  f.tick(since+R.INTERVAL-f.at);assert.equal(f.rule.status,'established');assert.equal(f.rule.establishedAt,since+R.INTERVAL);
  assert(f.rule.farms[0].deliveredKg>0);assert.equal(f.rule.receipts.filter(r=>r.kind==='governmentContinuation').length,1);
});
test('a genuine gap remains a gap; role-specific withdrawal and injuries interrupt current government and actual restoration recovers without refunds',()=>{
  const f=fixture();f.tick(3600+100);handover(f);
  const since=f.rule.since;f.entry.withdrawal={at:f.at-1,causeId:'actual-breach'};f.entry.phase='withdrawn';
  assert(f.transfer());assert(f.rule.since>since);assert.equal(f.rule.status,'limited');
  const person=f.succession.leaders.find(a=>a.roles.includes('publicWorksAndProvisioning')), agreement=f.succession.agreements.find(a=>a.personId===person.id);
  agreement.suspendedRoles=['publicWorksAndProvisioning'];f.tick(60);assert.equal(f.rule.status,'contested');
  const spent=f.rule.spentEnergy;agreement.suspendedRoles=[];f.tick(60);assert.equal(f.rule.status,'limited');assert(f.rule.spentEnergy>spent);
  person.health=20;f.tick(60);assert.equal(f.rule.status,'contested');person.health=70;f.tick(60);assert.equal(f.rule.status,'limited');
});
test('JSON saves, continued copies, missing actual authority and death retain the same original account and spent people',()=>{
  const f=fixture();f.tick(3600);handover(f);assert(f.transfer());
  const saved=R.normalize(copy(f.rule));assert(saved);assert.deepEqual(saved,f.rule);
  f.rule=saved;f.entry.operation=saved;const from={worldId:'w',runId:'r'}, to={worldId:'w',runId:'continued'};
  const continued=A.rebind(f.book,from,to);assert(continued);assert.equal(continued.entries[0].operation.runId,'continued');
  const malformed=copy(saved);malformed.governmentBinding.fromProofId='other';assert.equal(R.normalize(malformed),null);
  const hidden=f.current();delete hidden.governingSuccession;assert.equal(R.authority(saved,f.entry,f.entry.staff,hidden),false);
  const frozen=copy(saved);R.advance(saved,f.entry,f.entry.staff,()=>({...f.current(),alive:false}),f.at+100);assert.deepEqual(saved,frozen);
});
test('a legitimate current direct ruler retains existing counter access without another visitor permit, but body changes, exclusions and uncompleted handovers grant none',()=>{
  const f=fixture();f.tick(3600);handover(f);assert(f.transfer());
  const g={...f.office,institutionId:'admin:a'}, source={cityId:'a',charterId:'charter:a',institutionId:'admin:a'};
  const receipt={...f.old(),atDesk:true,lineOfSight:true,authorityCurrent:true,otherBusy:false,bans:[],visitId:'actual-visit'};
  const safeguards={originalBody:true,custodyActive:false,violence:false,governmentBinding:f.rule.governmentBinding,governingSuccession:f.succession};
  const context=(r=receipt,s=safeguards)=>A.counterContext(g,r,null,source,f.at,s);
  assert(A.attending(context(),g));assert.equal(A.attending(context({...receipt,bodyEpoch:1}),g),false);
  assert.equal(A.attending(context({...receipt,bans:[{cityId:'a',status:'active'}]}),g),false);
  assert.equal(A.attending(context(receipt,{...safeguards,governingSuccession:{...f.succession,handover:null}}),g),false);
  assert.equal(A.attending(context(receipt,{...safeguards,governmentBinding:{...f.rule.governmentBinding,cityId:'other'}}),g),false);
});
