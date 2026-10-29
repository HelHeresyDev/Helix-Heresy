const {test}=require('node:test'), assert=require('node:assert/strict');
const State=require('../strategic-playable-settlement-state'), A=require('../city-authority');
const {sourceMap}=require('./helpers/city-authority-source');
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture() {
  const {map}=sourceMap('collective','displacedClaim');
  delete map.strategicPoliticalHistory.currentControlRows[0].claimantChannel;
  const [ruin,host]=map.strategicPlayableSettlementState.cityRows;
  ruin.lastCauseEventId='original-crisis'; host.services={communications:'functional'};
  map.strategicCapabilityHistory={milestoneRows:[{infrastructureRows:[{id:'original:host-power',cityId:'controller',function:'powerWorks',operationalAtPlayableYear:true,hiddenConditionBand:'robust'}]}]};
  const displacements=[{id:'actual-refugee-admission',originAssetId:ruin.assetId,sourceEventId:ruin.lastCauseEventId,
    displacedPopulation:3000,admissions:[{cityId:'controller',admittedPopulation:2000}],unresolvedDisplacedPopulation:1000}];
  map.strategicPlayableSettlementState.displacementRows=displacements;
  return {map,ruin,host,displacements};
}
test('current claimant contact is allocated from actual admitted original refugees and an existing surviving host powerworks, not a broadcast label',()=>{
  const f=fixture(), before=copy(f.map);
  const rows=State.claimantContacts(f.map,f.map.strategicPlayableSettlementState.cityRows,f.displacements);
  assert.equal(rows.length,1); const row=rows[0];
  assert.equal(row.hostCityId,'controller');assert.equal(row.displacementId,'actual-refugee-admission');
  assert.equal(row.allocatedPopulation,4); assert.equal(row.admittedPopulation,2000);
  assert.equal(row.powerSourceId,'original:host-power');assert.equal(row.reservedEnergy,2160);
  assert.deepEqual(f.map,before); assert.equal(A.sourceFromWorld(f.map,'a'),null);
  f.map.strategicPlayableSettlementState.claimantContactRows=rows;
  const source=A.sourceFromWorld(f.map,'a'); assert(A.validSource(source));
  assert.equal(source.parties[0].population,2000); assert.equal(source.parties[0].hostCityId,'controller');
  assert(!JSON.stringify(f.map.publicPlayableSettlementDirectory||{}).includes('displaced-records-custodian'));
});
test('no admitted original people, failed host communications, destroyed host or missing real power cannot create a claimant mailbox',()=>{
  for(const change of [f=>f.displacements[0].admissions=[], f=>f.displacements[0].admissions[0].admittedPopulation=3,
    f=>f.host.services.communications='failed',f=>f.host.physicalJurisdictionExists=false,
    f=>f.map.strategicCapabilityHistory.milestoneRows=[]]) {
    const f=fixture(); change(f); assert.deepEqual(State.claimantContacts(f.map,f.map.strategicPlayableSettlementState.cityRows,f.displacements),[]);
  }
});
test('the allocated custodian is a living finite original participant; exhaustion, injury and absence stop real claimant correspondence',()=>{
  const f=fixture(); f.map.strategicPlayableSettlementState.claimantContactRows=State.claimantContacts(f.map,f.map.strategicPlayableSettlementState.cityRows,f.displacements);
  const book=A.create({worldId:'world',runId:'run'}), e=A.register(book,A.sourceFromWorld(f.map,'a'));
  const office={id:'actual-counter',workSeconds:10000,power:10000,clerk:{id:'actual-clerk',status:'alive',health:100}};
  let at=0;const c=()=>({at,alive:true,capable:true,local:true,atCounter:true,free:true,permission:true,sourceCurrent:true,clerkPresent:true,clerkId:office.clerk.id,
    cityId:'controller',displacedChannelId:e.source.parties[0].channel,bodyEpoch:0});
  for(const action of ['inspect','negotiate','accept']) {
    assert(A.begin(book,e,action,c(),office,at,action==='accept'?copy(e.terms):null));at+=book.job.seconds;A.advance(book,c(),office,at);
  }
  const a=book.authorities[0];assert.equal(a.operator.workSeconds,1500);assert.equal(a.channelWorkSeconds,1500);assert.equal(a.channelPower,9);
  assert.equal(A.lifecycleFact(e,book,c(),at).state,'retired');const saved=A.normalize(copy(book));assert(saved);
  a.operator.health=20;assert.equal(A.begin(book,e,'report',c(),office,at),false);
  a.operator.health=100;a.channelPower=0;assert.equal(A.begin(book,e,'report',c(),office,at),false);
  assert.equal(saved.authorities[0].operator.workSeconds,1500);
});
