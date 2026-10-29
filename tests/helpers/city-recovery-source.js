const World = require('../../strategic-world');
const A = require('../../city-authority'), R = require('../../city-rule'), D = require('../../city-defense'), Recovery = require('../../city-recovery');
const { sourceMap } = require('./city-authority-source');
function recoverySources(mode = 'groundConvoy', population = 3000) {
  const { map: prior } = sourceMap();
  const map = Object.assign(World.createStrategicMap('recovery-source', { refinementLevel: 1, radiusKm: 100 }), prior);
  const neighbor = World.topologyForMap(map).neighbors[0][0];
  map.humanGeography = { cities: [{id: 'a', name: 'Original A', cellId: World.cellId(0)}, {id:'controller',name:'Original Controller',cellId:World.cellId(2)}] };
  map.routeGraph = { routes: [] };
  const modeIndex = ['groundConvoy','aircraft','flyingMounts','mixedFleet'].indexOf(mode);
  map.publicSettlementDirectory = { strongholdCodes: [], foundationRows: [], cellFeatures: [],
    satelliteCodes: [`c000${neighbor.toString(36).padStart(3,'0')}012z${modeIndex}0100`], satelliteRoutePaths: [`${neighbor.toString(36)}.0`] };
  for (const c of map.strategicPlayableSettlementState.cityRows) {
    c.cellId = World.cellId(c.cityId === 'a' ? 0 : 2);
    c.services = {utilities:'functional',provisioning:'functional',transport:'functional',fortifications:'functional',communications:'functional'};
  }
  const city = map.strategicPlayableSettlementState.cityRows[0]; city.physicalCondition = 'damaged';
  city.currentPopulation = population;
  Object.assign(city.services,{utilities:'failed',provisioning:'failed',transport:'failed',fortifications:'failed'});
  for (const i of map.strategicCivicHistory.currentInstitutionRows) {
    i.cityId = i.institutionId.endsWith(':controller') ? 'controller' : 'a';
    i.currentCapacityBand = 'functional';
    if (i.cityId === 'a' && ['publicWorksAndProvisioning:a','militaryDefenseCommand:a'].includes(i.institutionId)) {
      i.operationalStatus='disrupted'; i.currentCapacityBand='fragile';
    }
  }
  const crewPerCarrier = mode === 'aircraft' ? 2 : 1, carriers = 6 / crewPerCarrier;
  const profile = ({groundConvoy:[40,1200,600],aircraft:[180,900,1800],flyingMounts:[70,180,400],mixedFleet:[40,1200,600]})[mode];
  map.strategicPlayableSettlementState.satelliteRows = [{ assetId:'satellite:c:0:0',parentId:'a',function:'agriculture',currentPopulation:600,
    physicalCondition:'damaged',localRouteUsable:false,services:{provisioning:'fragile',transport:'fragile'},
    transportAllocation:{sourceId:'satellite:c:0:0:original-local-carriers',populationSourceId:'satellite:c:0:0',mode,
      carriers,operators:6,crewPerCarrier,speedKph:profile[0],capacityKg:carriers*profile[1],rangeKm:profile[2],fuelKm:carriers*profile[2],dutySeconds:6*28800} }];
  map.strategicCapabilityHistory = {milestoneRows:['fortifiedWorks','powerWorks'].map(fn=>({infrastructureRows:[
    {id:`original:${fn}`,cityId:'a',function:fn,operationalAtPlayableYear:true,hiddenConditionBand:'robust'}]}))};
  return {rawMap:map, political:A.sourceFromWorld(map,'a'), operation:R.sourceFromWorld(map,'a',{politicalSettlement:true}),
    defense:D.sourceFromWorld(map,'a',{politicalSettlement:true}), recovery:Recovery.sourceFromWorld(map,'a')};
}
module.exports={recoverySources};
