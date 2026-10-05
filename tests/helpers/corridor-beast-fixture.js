const Market = require('../../intercity-smuggling');
const Beasts = require('../../corridor-beasts');
const Living = require('../../living-smuggling');
function beastFixture({ living = false, continuity = 'intermittent', km = 1 } = {}) {
  const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity };
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'Neighbor', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  if (living) Living.provision(state, ['organicFeedstock'], 0);
  const op = state.operators.find(o => Boolean(o.biological) === living);
  const manifest = living ? { commodityKind: 'specimen', material: 'Living slime', amount: 1, entries: [
    { kind: 'creature', amount: 1, transportPodStackId: 'pod', creature: { id: 'specimen', name: 'Moss', status: 'contained', deathAt: 1e9,
      stats: Object.fromEntries([['bodyIntegrity', 100], ['stress', 0], ['nutrition', 50]].map(([key, current]) => [key, { current, max: 100 }])) } },
    { kind: 'transportPod', amount: 1, stack: { id: 'pod', craftsmanship: 95 } }
  ] } : { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ kind: 'chemicalBatch', amount: 1, stack: { id: 'original-lot', quantity: 1 } }] };
  const request = { templateId: 'offer', selectedId: 'lot', brokerId: 'broker', value: 800, cargo: { massKg: 22, volumeL: 38 }, localDistanceKm: 8, manifest,
    ...(living ? { livingProfile: { feedKey: 'organicFeedstock', foodRate: .125, maximumStress: 80, hazard: .05 } } : {}) };
  const quote = Market.offer(state, op.id, request, route, 0), sh = Market.book(state, quote, request, route, 'contract', 0).shipment;
  Market.markCollected(state, sh.id, manifest, 'collector', 0);
  if (living) { Living.collected(sh, manifest, 0, .99); sh.phase = 'outbound'; sh.positionKm = 0; sh.custodian = op.vehicleId; }
  else { Market.receiveDepot(state, sh.id, manifest, 0); Market.advance(state, 0, [route]); }
  const beast = Beasts.createActor('saved-road-beast', 'beast:rimefang-pack', 'regional-pack', km, 0);
  state.corridorBeasts = [{ routeId: 'ab', lengthKm: 30, actors: [beast], createdAt: 0 }];
  const safety = Beasts.equipment(op);
  const advance = at => living ? Living.advance(state, at, [route], { ok: true, cityId: 'a', distanceKm: 8 }, []) : Market.advance(state, at, [route]);
  return { state, route, op, sh, beast, safety, advance };
}
module.exports = { beastFixture };
