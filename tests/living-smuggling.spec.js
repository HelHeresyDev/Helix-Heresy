const { test, expect } = require('@playwright/test');
const Market = require('../intercity-smuggling'), Living = require('../living-smuggling');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
const local = { ok: true, cityId: 'a', distanceKm: 8 };
function fixture() {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'Neighbor', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Living.provision(state, ['organicFeedstock'], 0); const op = state.operators.find(o => o.biological);
  const creature = { id: 'slime-1', name: 'Moss', status: 'contained', genome: 'ABCDE', deathAt: 1e9, revealed: { sustenance: 'organic feeder' },
    stats: Object.fromEntries([['bodyIntegrity', 100], ['stress', 0], ['nutrition', 50], ['currentMass', 20]].map(([key, current]) => [key, { current, max: 100 }])) };
  const manifest = { commodityKind: 'specimen', material: 'Living slime', amount: 1, entries: [{ kind: 'creature', amount: 1, transportPodStackId: 'pod-1', creature }, { kind: 'transportPod', amount: 1, stack: { id: 'pod-1', craftsmanship: 95 } }] };
  const request = { manifest, value: 800, cargo: { massKg: 22, volumeL: 38 }, localDistanceKm: 8, templateId: 'offer-1', selectedId: creature.id, brokerId: 'broker', livingProfile: { feedKey: 'organicFeedstock', foodRate: .125, maximumStress: 80, hazard: .05 } };
  return { state, op, creature, request, manifest };
}
function booked() {
  const f = fixture(); f.quote = Market.offer(f.state, f.op.id, f.request, route, 0);
  expect(f.quote.ok).toBe(true); f.sh = Market.book(f.state, f.quote, f.request, route, 'contract-1', 0).shipment; return f;
}
function collected() {
  const f = booked(); Market.markCollected(f.state, f.sh.id, f.manifest, 'collector', 0); Living.collected(f.sh, f.manifest, 0, .99);
  f.jobs = [{ obligationId: 'contract-1', phase: 'returned', returnedAt: 1200, positionKm: 0 }]; return f;
}
test('biological capability, known compatible diet, pod condition and finite care reserves gate booking', () => {
  const f = fixture(); Living.provision(f.state, ['organicFeedstock'], 0); expect(f.state.operators).toHaveLength(2);
  expect(Market.offer(f.state, f.state.operators[0].id, f.request, route, 0).ok).toBe(false);
  for (const reason of ['diet', 'food', 'water', 'power', 'handler', 'pod', 'health', 'capacity']) {
    const f = fixture();
    if (reason === 'diet') f.request.livingProfile.feedKey = '';
    if (reason === 'food') f.op.careStock.feeds.organicFeedstock = 0;
    if (reason === 'water') f.op.careStock.water = 0;
    if (reason === 'power') f.op.careStock.power = 0;
    if (reason === 'handler') f.op.crew[0].trainedHandler = false;
    if (reason === 'pod') f.manifest.entries[1].stack.craftsmanship = 50;
    if (reason === 'health') f.creature.stats.bodyIntegrity.current = 50;
    if (reason === 'capacity') f.request.cargo.massKg = 119;
    const before = JSON.stringify(f.state); expect(Market.offer(f.state, f.op.id, f.request, route, 0).ok, reason).toBe(false); expect(JSON.stringify(f.state)).toBe(before);
  }
});
test('cancel before collection refunds all escrow and returns the same reserved care stocks once', () => {
  const f = booked(); expect(f.op.careStock.feeds.organicFeedstock).toBeLessThan(32);
  expect(Market.cancel(f.state, f.sh.id, 1)).toBe(true); expect(Market.cancel(f.state, f.sh.id, 2)).toBe(false);
  expect(f.op.careStock).toMatchObject({ feeds: { organicFeedstock: 32 }, water: 96, power: 96 }); expect(f.state.buyers[0].money).toBe(10000);
});
test('living needs and custody persist through reload and payment requires alive acceptable foreign receipt', () => {
  const f = collected(); Living.advance(f.state, 1800, [route], local, f.jobs);
  expect(f.sh.phase).toBe('outbound'); expect(f.sh.owner).toBe('player'); expect(f.sh.living.foodLeft).toBeLessThan(f.sh.living.food);
  expect(Market.settle(f.state, f.sh.id, 1800)).toBe(0);
  const loaded = JSON.parse(JSON.stringify(f.state));
  Living.advance(f.state, 5400, [route], local, f.jobs); Living.advance(loaded, 5400, [route], local, f.jobs);
  expect(loaded).toEqual(f.state); expect(f.sh.living.outcome).toBe('received'); expect(f.sh.owner).toBe(f.quote.buyerId);
  expect(f.sh.manifest.entries[0].creature.genome).toBe('ABCDE'); expect(Market.settle(f.state, f.sh.id, 5400)).toBe(f.quote.net);
  expect(Market.settle(f.state, f.sh.id, 5400)).toBe(0); Living.advance(f.state, 10000, [route], local, f.jobs);
  expect(f.op.assignment).toBeNull(); expect(f.sh.phase).toBe('returned');
});
test('unsafe reserves cause physical return, waiting care and an explicit laboratory handoff before empty return', () => {
  const f = collected(); Living.advance(f.state, 1800, [route], local, f.jobs);
  f.sh.living.powerLeft = 2;
  const fuel = f.op.fuelKm; Living.advance(f.state, 7200, [route], local, f.jobs);
  expect(f.sh.phase).toBe('returnWaiting'); expect(f.op.fuelKm).toBeLessThan(fuel); expect(f.sh.playerEscrow).toBe(0); expect(f.sh.receiptAt).toBeNull();
  expect(f.sh.manifest.entries[0].creature.id).toBe('slime-1');
  const returned = Living.receive(f.state, f.sh.id, 7200); expect(returned.id).toBe('slime-1'); expect(returned.ownerId).toBe('player');
  expect(Living.receive(f.state, f.sh.id, 7200)).toBeNull(); expect(f.op.assignment).toBe(f.sh.id);
  Living.advance(f.state, 10000, [route], local, f.jobs); expect(f.sh.phase).toBe('returned'); expect(f.op.assignment).toBeNull();
});
test('holds do not freeze survival: death preserves a corpse, while breach preserves an escaped individual and location', () => {
  for (const outcome of ['dead', 'escaped']) {
    const f = collected(); Living.advance(f.state, 1800, [route], local, f.jobs);
    if (outcome === 'dead') f.sh.manifest.entries[0].creature.deathAt = 1860;
    else f.sh.living.threshold = 0;
    Living.advance(f.state, 1860, [{ ...route, continuity: 'closed' }], local, f.jobs);
    expect(f.sh.living.outcome).toBe(outcome); expect(f.sh.offsiteCreature.creature.id).toBe('slime-1');
    expect(f.sh.offsiteCreature.location).toMatchObject({ routeId: 'ab', phase: 'outbound' });
    expect(f.sh.manifest.entries.some(e => e.creature)).toBe(false); expect(f.sh.playerEscrow).toBe(0);
    const funds = f.state.buyers[0].money; const saved = JSON.parse(JSON.stringify(f.state));
    Living.advance(saved, 7200, [{ ...route, continuity: 'closed' }], local, f.jobs);
    expect(saved.buyers[0].money).toBe(funds); expect(saved.shipments[0].offsiteCreature).toEqual(f.sh.offsiteCreature);
  }
});
test('destination rejection returns the same living creature rather than paying or deleting it', () => {
  const f = collected(); f.sh.living.maximumStress = .01;
  Living.advance(f.state, 10000, [route], local, f.jobs);
  expect(f.sh.living.outcome).toBe('arrivalRejected'); expect(f.sh.phase).toBe('returnWaiting');
  expect(f.sh.manifest.entries[0].creature.id).toBe('slime-1'); expect(Market.settle(f.state, f.sh.id, 10000)).toBe(0);
});

test('canceled pickup retains handler and kit until the actual local courier returns', () => {
  const f = booked(); f.sh.living.localJobId = 'pickup'; f.sh.living.kitAtDepot = false;
  Market.cancel(f.state, f.sh.id, 100);
  expect(f.op.assignment).toBe(f.sh.id); expect(f.op.careStock.water).toBeLessThan(96);
  Living.advance(f.state, 200, [route], local, [{ id: 'pickup', phase: 'returning', canceled: true }]);
  expect(f.op.assignment).toBe(f.sh.id);
  Living.advance(f.state, 500, [route], local, [{ id: 'pickup', phase: 'canceled', canceled: true }]);
  expect(f.op.assignment).toBeNull(); expect(f.op.careStock.water).toBe(96); expect(f.state.buyers[0].money).toBe(10000);
});

test('failed specimen delivery keeps offsite identity while empty transport comes home and unused return escrow refunds once', () => {
  const f = collected(); Living.advance(f.state, 1800, [route], local, f.jobs); f.sh.living.threshold = 0;
  Living.advance(f.state, 1860, [route], local, f.jobs); const record = JSON.parse(JSON.stringify(f.sh.offsiteCreature));
  Living.advance(f.state, 10000, [route], local, f.jobs);
  expect(f.sh.phase).toBe('returned'); expect(f.sh.returnEscrow).toBe(0); expect(f.op.assignment).toBeNull();
  expect(f.sh.offsiteCreature).toEqual(record); const money = f.state.buyers[0].money;
  Living.advance(f.state, 20000, [route], local, f.jobs); expect(f.state.buyers[0].money).toBe(money);
});

test('depleted life support damages the actual specimen during a route hold instead of freezing needs', () => {
  const f = collected(); Living.advance(f.state, 1800, [route], local, f.jobs);
  f.sh.living.powerLeft = 0; f.sh.living.threshold = 1e9;
  f.sh.manifest.entries[0].creature.stats.bodyIntegrity.current = 1;
  Living.advance(f.state, 7200, [{ ...route, continuity: 'closed' }], local, f.jobs);
  expect(f.sh.living.outcome).toBe('dead');
  expect(f.sh.offsiteCreature.creature.stats.bodyIntegrity.current).toBe(0);
  expect(f.sh.offsiteCreature.creature.deathCause).toContain('transport');
});
