const { test, expect } = require('@playwright/test');
const Market = require('../intercity-smuggling');
const Living = require('../living-smuggling');
const Gates = require('../smuggling-checkpoints');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
const facts = { cityId: 'b', cellId: 'cell:b', institutionId: 'watch:b', institutionName: 'B Gate Watch', jurisdiction: 'city' };
function fixture(living = false) {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Gates.bind(state, [facts]);
  if (living) Living.provision(state, ['feed'], 0);
  const op = state.operators.find(o => Boolean(o.biological) === living);
  const manifest = living ? { commodityKind: 'specimen', amount: 1, material: 'Moss', entries: [
    { kind: 'creature', amount: 1, transportPodStackId: 'pod', creature: { id: 'moss', genome: 'abc', status: 'contained', deathAt: 1e9,
      stats: Object.fromEntries([['bodyIntegrity', 100], ['stress', 0], ['nutrition', 80]].map(([k, current]) => [k, { current, max: 100 }])) } },
    { kind: 'transportPod', amount: 1, stack: { id: 'pod', craftsmanship: 95 } }
  ] } : { commodityKind: 'manufactured', amount: 1, material: 'Primer', entries: [{ kind: 'chemicalBatch', amount: 1, stack: { id: 'batch', quantity: 1 } }] };
  const req = { manifest, value: 800, cargo: { massKg: 10, volumeL: 20 }, localDistanceKm: 8,
    livingProfile: living ? { feedKey: 'feed', foodRate: .125, maximumStress: 80, hazard: .01 } : null };
  const quote = Market.offer(state, op.id, req, route, 0);
  const sh = Market.book(state, quote, req, route, 'contract', 0).shipment;
  Market.markCollected(state, sh.id, manifest, 'collector', 0);
  if (living) Living.collected(sh, manifest, 0, .99);
  else { Market.receiveDepot(state, sh.id, manifest, 0); Market.advance(state, 0, [route]); }
  const advance = (at, routes = [route]) => living ? Living.advance(state, at, routes, { ok: true, cityId: 'a' }, [{ obligationId: 'contract', phase: 'returned', returnedAt: 0 }]) : Market.advance(state, at, routes);
  return { state, sh, op, quote, manifest, advance };
}
test('only a physical staffed local city gate can start a saved inspection; no wilderness sovereignty', () => {
  const f = fixture(); Gates.bind(f.state, [{ ...facts, cityId: 'wild', jurisdiction: 'wilderness' }]);
  expect(f.state.checkpoints).toHaveLength(1); expect(Gates.enter(f.state, f.sh, f.op, 0)).toBe(false);
  f.state.checkpoints[0].officer.health = 0; f.advance(3600);
  expect(f.sh.inspection).toBeUndefined(); expect(f.sh.receiptAt).toBe(3600);
  Gates.bind(f.state, [facts]); expect(f.state.checkpoints[0].officer.health).toBe(0);
});
test('inspection and bounded detention preserve identity, title, crew, vehicle, escrow and reload determinism', () => {
  const f = fixture(); f.advance(6000);
  expect(f.sh.phase).toBe('detained'); expect(f.sh.custodian).toBe('freight-gate:b'); expect(f.sh.owner).toBe('player');
  expect(f.sh.inspection).toMatchObject({ crewDetained: false, vehicleSeized: false, officerId: 'freight-officer:b' });
  expect(f.sh.inspection.observations[0].entryIds).toEqual(['batch']); expect(f.sh.manifest).toEqual(f.manifest);
  expect(f.sh.playerEscrow).toBe(f.quote.net); expect(Market.settle(f.state, f.sh.id, 6000)).toBe(0);
  const loaded = JSON.parse(JSON.stringify(f.state));
  Gates.submit(f.sh, f.sh.fingerprint, 6000); Gates.submit(loaded.shipments[0], loaded.shipments[0].fingerprint, 6000);
  f.advance(10000); Market.advance(loaded, 10000, [route]); expect(loaded).toEqual(f.state);
  expect(f.sh.receiptAt).toBe(6000); expect(f.sh.phase).toBe('returned');
  expect(Market.settle(f.state, f.sh.id, 10000)).toBe(f.quote.net); expect(Market.settle(f.state, f.sh.id, 10000)).toBe(0);
});
test('unsupported suspicion expires, missing or changed documents never invent guilt or confiscation', () => {
  const f = fixture(); f.advance(6000);
  expect(Gates.submit(f.sh, 'commercial-license', 6000)).toBe(false);
  Gates.submit(f.sh, f.sh.fingerprint, 6000); f.sh.manifest.entries[0].stack.quantity = 2;
  f.advance(6600); expect(f.sh.phase).toBe('detained');
  f.advance(12660); expect(f.sh.inspection.status).toBe('released');
  expect(f.sh.inspection.reason).toContain('authority expired'); expect(f.sh.inspection.conviction).toBeUndefined();
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.playerEscrow).toBe(0);
});
test('deadline during detention refunds once and physically returns the same property without buyer receipt', () => {
  const f = fixture(); f.sh.deliveryDeadlineAt = 6600; f.advance(7200);
  expect(f.sh.saleFailedAt).toBe(6600); expect(f.sh.playerEscrow).toBe(0); expect(f.sh.phase).toBe('detained');
  const money = f.state.buyers[0].money; expect(money).toBe(10000 - f.quote.localFreight);
  f.advance(17000); expect(f.state.buyers[0].money).toBe(money); expect(f.sh.phase).toBe('returned');
  expect(f.sh.custodian).toBe('covert-depot:a'); expect(f.sh.owner).toBe('player'); expect(f.sh.receiptAt).toBeNull();
  expect(f.sh.manifest).toEqual(f.manifest); expect(f.op.fuelKm).toBe(540); expect(Market.settle(f.state, f.sh.id, 17000)).toBe(0);
});
test('voluntary return requires release, finite transport and an open route', () => {
  const f = fixture(); f.advance(6000);
  expect(Gates.requestReturn(f.state, f.sh, 6000)).toBe(true); expect(Gates.requestReturn(f.state, f.sh, 6000)).toBe(false);
  Gates.submit(f.sh, f.sh.fingerprint, 6000); f.advance(10000, [{ ...route, continuity: 'closed' }]);
  expect(f.sh.phase).toBe('returning'); expect(f.sh.positionKm).toBe(30); expect(f.op.assignment).toBe(f.sh.id);
  f.advance(14000); expect(f.sh.phase).toBe('returned'); expect(f.sh.receiptAt).toBeNull();
});
test('large advances cannot deliver past the deadline or skip the return journey', () => {
  const f = fixture(); f.sh.deliveryDeadlineAt = 1800;
  const loaded = JSON.parse(JSON.stringify(f.state)); f.advance(1800); f.advance(7200); Market.advance(loaded, 7200, [route]);
  expect(loaded.shipments).toEqual(f.state.shipments); expect(f.sh.positionKm).toBe(0); expect(f.op.fuelKm).toBe(570);
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.returnedAt).toBe(3600);
});
test('living detention consumes finite care and preserves the same specimen through release and receipt', () => {
  const f = fixture(true); f.advance(6000);
  expect(f.sh.phase).toBe('detained'); const power = f.sh.living.powerLeft;
  f.advance(6600); expect(f.sh.living.powerLeft).toBeLessThan(power); expect(f.sh.manifest.entries[0].creature.id).toBe('moss');
  Gates.submit(f.sh, f.sh.fingerprint, 6600); f.advance(7200);
  expect(f.sh.living.outcome).toBe('received'); expect(f.sh.receiptAt).not.toBeNull();
});
test('living deadline keeps care, paid freight, return reserve and physical laboratory handoff obligations', () => {
  const f = fixture(true); f.sh.deliveryDeadlineAt = 6600; f.advance(7200);
  expect(f.sh.phase).toBe('detained'); expect(f.sh.returnEscrow).toBe(f.quote.returnFee);
  Gates.submit(f.sh, f.sh.fingerprint, 7200); f.advance(18000);
  expect(f.sh.phase).toBe('returnWaiting'); expect(f.sh.owner).toBe('player'); expect(f.sh.receiptAt).toBeNull();
  expect(f.sh.manifest.entries[0].creature.id).toBe('moss'); expect(f.sh.living.powerLeft).toBeLessThan(f.sh.living.power);
  expect(Living.receive(f.state, f.sh.id, 18000).id).toBe('moss'); expect(Living.receive(f.state, f.sh.id, 18000)).toBeNull();
});
test('death during detention preserves the gate corpse record, pod custody and finite kit rather than resetting care', () => {
  const f = fixture(true); f.advance(6000);
  f.sh.manifest.entries[0].creature.deathAt = 6060; const power = f.sh.living.powerLeft;
  f.advance(6120); expect(f.sh.living.outcome).toBe('dead'); expect(f.sh.phase).toBe('detained');
  expect(f.sh.offsiteCreature).toMatchObject({ kind: 'corpse', creature: { id: 'moss' }, location: { custodian: 'freight-gate:b', positionKm: 30 } });
  expect(f.sh.custodian).toBe('freight-gate:b'); expect(f.sh.manifest.entries).toHaveLength(1);
  expect(f.sh.manifest.entries[0].stack.id).toBe('pod'); expect(f.sh.living.powerLeft).toBeLessThan(power);
  const loaded = JSON.parse(JSON.stringify(f.state));
  Living.advance(loaded, 18000, [route], { ok: true, cityId: 'a' }, []);
  expect(loaded.shipments[0].offsiteCreature).toEqual(f.sh.offsiteCreature); expect(loaded.shipments[0].receiptAt).toBeNull();
});
test('a single officer never processes overlapping loads or acquires custody of its queue', () => {
  const f = fixture(); f.advance(6000);
  const other = fixture(); other.sh.id = 'other'; other.sh.positionKm = 30;
  expect(Gates.enter(f.state, other.sh, other.op, 6000)).toBe(true);
  Gates.tick(f.state, other.sh, other.op, 6000);
  expect(other.sh.inspection.startedAt).toBeNull(); expect(other.sh.custodian).toBe(other.op.vehicleId);
  Gates.tick(f.state, f.sh, f.op, 12600);
  Gates.tick(f.state, other.sh, other.op, 12000); expect(other.sh.inspection.startedAt).toBeNull();
  Gates.tick(f.state, other.sh, other.op, 12600); expect(other.sh.inspection.startedAt).toBe(12600);
});
