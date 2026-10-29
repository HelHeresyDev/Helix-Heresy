const {test}=require('node:test'), assert=require('node:assert/strict');
const Library=require('../world-run-library'), R=require('../city-rule'), Recovery=require('../city-recovery');
test('normally generated charter-foundation cities retain original sources and require actual paid recovery before damaged city accounts become available',()=>{
  const map=Library.createWorld({id:'generated-city-recovery',worldSeed:'charter-foundation',worldTheme:'madcap',createdAt:'test'}).generatedData.strategicMap;
  const before=JSON.stringify([map.strategicPlayableSettlementState,map.strategicCivicHistory]);
  let repaired=0, supported=0;
  for(const city of map.strategicPlayableSettlementState.cityRows) {
    if(!city.physicalJurisdictionExists) continue;
    const source=R.sourceFromWorld(map,city.cityId,{politicalSettlement:true});
    if(source) {assert(R.validSource(source));supported++;continue;}
    const s=Recovery.create(Recovery.sourceFromWorld(map,city.cityId),{worldId:'generated-city-recovery',runId:'actual-run'},0);assert(s);
    const c={alive:true,capable:true,local:true,atCounter:true,clerkPresent:true,free:true,permission:true,sourceCurrent:true,authority:true,
      worksAvailable:true,defenseAvailable:true,cityId:city.cityId,bodyEpoch:0};
    const stacks=Recovery.KEYS.map(key=>({id:`original-owned-delivery:${key}`,key,quantity:100000,carriedBy:'scientist'}));let at=0;
    while(s.completed.length<s.source.projects.length) {
      for(const key of Recovery.KEYS) Recovery.stage(s,c,stacks,key,at);
      assert(Recovery.begin(s,c,at),`${city.cityId} cannot dispatch its actual supplied repair`);
      at+=s.job.seconds;assert(Recovery.advance(s,c,at));assert(Recovery.normalize(s));
    }
    const projected=Recovery.projectMap(map,s,s), operation=R.sourceFromWorld(projected,city.cityId,{politicalSettlement:true});
    assert(R.validSource(operation),`${city.cityId} still lacks original operating support after actual recovery`);
    assert(s.spent.metalParts>0);assert(s.completed.length>0);repaired++;supported++;
  }
  assert(repaired>0);assert.equal(supported,map.strategicPlayableSettlementState.cityRows.filter(c=>c.physicalJurisdictionExists).length);
  assert.equal(JSON.stringify([map.strategicPlayableSettlementState,map.strategicCivicHistory]),before);
});
