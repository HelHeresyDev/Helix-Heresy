const { test, expect } = require('@playwright/test');
const Trade = require('../intercity-trade');
const Carrier = require('../local-exchange-carrier');
const H = 3600;
const defs = [{ id: 'steel', section: 'resources', key: 'steel', basePrice: 100, supply: 50, liquidity: 10, buyable: true, sellable: true },
  { id: 'chemical', section: 'chemicalBatches', key: 'chemical', basePrice: 100, supply: 50, liquidity: 10, buyable: false, sellable: true }];
function fixture() {
  const profile = id => ({ cityId: id, cityName: id, productionSources: [], workshopCapacity: 1, listings: Object.fromEntries(defs.map(d => [d.id, { targetSupply: 50, targetDemand: 1 }])) });
  const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 38, supportCapable: true, continuity: 'operational' };
  const state = Trade.create(profile('a'), [profile('b')], [route], [{ corridorId: 'ab', approvals: [{ cityId: 'a', allowed: true }, { cityId: 'b', allowed: true }] }], defs);
  return { state, home: { steel: { supply: 50, demand: 1 }, chemical: { supply: 50, demand: 1 } }, supplier: Carrier.support(Carrier.create('a')).supplier,
    stack: { id: 'lot-1', section: 'resources', key: 'steel', quantity: 10, reservedTaskId: '' } };
}
const offer = (f, at = 0) => Trade.exportOffer(f.state, 'wholesaler:ab', f.stack.key, f.stack, 3, defs, at, 2);
const book = (f, q = offer(f), at = 0) => Trade.bookExport(f.state, q, f.stack, defs, at, 2);
const advance = (f, hours) => Trade.advance(f.state, hours * H, f.home, f.supplier, defs);
function collect(f, sh, at = 0) { sh.collected = true; return Trade.receiveExport(f.state, sh.id, { ...f.stack, quantity: sh.quantity }, at); }

test('export quote reserves nothing; buyer escrow and exact convoy booking precede pickup', () => {
  const f = fixture(), before = JSON.stringify(f), q = offer(f);
  expect(q.ok).toBe(true); expect(JSON.stringify(f)).toBe(before);
  const sh = book(f, q).shipment;
  expect(f.state.neighbors[0].treasury).toBe(10000 - q.gross);
  expect(sh.escrow + sh.localEscrow + sh.playerEscrow).toBe(q.gross);
  expect(f.state.operators[0].shipment).toBe(sh.id); expect(book(f).ok).toBe(false);
  advance(f, 4); expect(sh.elapsedHours).toBe(0); expect(sh.foodReserve).toBe(0);
  expect(f.state.shipments).toHaveLength(1); expect(f.home.steel.supply).toBe(50);
});

test('exact export custody, two freight stages, foreign stock and once-only proceeds survive save/load', () => {
  const f = fixture(), q = offer(f), sh = book(f, q).shipment;
  expect(collect(f, sh, H / 2)).toBe(q.localFreight);
  expect(collect(f, sh, H / 2)).toBe(0); expect(Trade.failExport(f.state, sh.id, 0)).toBe(false);
  advance(f, 1); expect(sh.dispatchedAt).toBe(H); expect(sh.elapsedHours).toBe(0);
  const loaded = JSON.parse(JSON.stringify(f));
  advance(f, 3); advance(loaded, 3); expect(loaded).toEqual(f);
  expect(sh).toMatchObject({ delivered: true, owner: 'buyer', escrow: 0, returned: false });
  expect(sh.cargoManifest).toMatchObject({ id: 'lot-1', quantity: 3, owner: 'buyer' });
  expect(f.state.neighbors[0].listings.steel.supply).toBe(53); expect(f.home.steel.supply).toBe(50);
  expect(f.state.operators[0].shipment).toBe(sh.id);
  expect(Trade.settleExport(f.state, sh.id)).toBe(q.net); expect(Trade.settleExport(f.state, sh.id)).toBe(0);
  advance(f, 5); expect(sh.returned).toBe(true); expect(f.state.operators[0].shipment).toBe(null);
});

test('failed pre-pickup exports refund all unused buyer escrow exactly once', () => {
  const f = fixture(), sh = book(f).shipment;
  expect(Trade.exportLot(defs[0], null, sh.quantity, sh.id)).toBe(null);
  expect(Trade.exportLot(defs[0], { ...f.stack, quantity: 1 }, sh.quantity, sh.id)).toBe(null);
  expect(Trade.failExport(f.state, sh.id, 0)).toBe(true);
  expect(Trade.failExport(f.state, sh.id, 0)).toBe(false);
  expect(f.state.neighbors[0].treasury).toBe(10000); expect(f.state.operators[0].shipment).toBe(null);
  expect(Trade.settleExport(f.state, sh.id)).toBe(0);
});

test('depot handoff refuses a substituted manifest without losing cargo or releasing funds', () => {
  const f = fixture(), sh = book(f).shipment; sh.collected = true;
  for (const manifest of [{ ...f.stack, id: 'wrong-lot', quantity: 3 }, { ...f.stack, quantity: 2 }, { ...f.stack, key: 'chemical', quantity: 3 }]) {
    const before = JSON.stringify(f);
    expect(Trade.receiveExport(f.state, sh.id, manifest, 0)).toBe(null); expect(JSON.stringify(f)).toBe(before);
  }
});

test('changed terms and exact lots require fresh confirmation; constraints do not mutate state', () => {
  for (const change of ['price', 'expiry', 'lot', 'reserved', 'funds', 'route', 'permit', 'fuel', 'food', 'crew', 'capacity', 'loss']) {
    const f = fixture(), q = offer(f), op = f.state.operators[0];
    if (change === 'price') f.state.neighbors[0].listings.steel.demand = 1.2;
    if (change === 'lot') f.stack.id = 'different-lot';
    if (change === 'reserved') f.stack.reservedTaskId = 'local-limit-sale';
    if (change === 'funds') f.state.neighbors[0].treasury = 0;
    if (change === 'route') op.route.supportCapable = false;
    if (change === 'permit') op.permit.approvals[1].allowed = false;
    if (change === 'fuel') op.fuelKm = 0;
    if (change === 'food') op.provisions = 0;
    if (change === 'crew') op.crew[0].health = 0;
    if (change === 'capacity') op.capacity = 1;
    if (change === 'loss') f.state.neighbors[0].listings.steel.supply = 1000000;
    const before = JSON.stringify(f), result = book(f, q, change === 'expiry' ? H + 1 : 0);
    expect(result.ok, change).toBe(false); expect(JSON.stringify(f), change).toBe(before);
    if (result.revised) expect(book(f, result.revised, change === 'expiry' ? H + 1 : 0).ok).toBe(true);
  }
});

test('certified chemical packages are indivisible, quality priced and retain their manifest', () => {
  const f = fixture(); f.stack = { id: 'batch-lot', section: 'chemicalBatches', key: 'chemical', quantity: 4.5, chemicalBatch: { id: 'batch-1', purity: 90, craftsmanship: 80,
    classification: { known: 'ordinary', actual: 'ordinary' }, packaging: { state: 'packaged' }, documentation: { status: 'certified' } } };
  const q = offer(f); expect(q).toMatchObject({ ok: true, quantity: 4.5 });
  expect(q.gross).toBe(Math.floor(4.5 * 94 * (0.8 + (90 * .65 + 80 * .35) * .004)));
  f.stack.chemicalBatch.purity = 89; expect(book(f, q).revised.ok).toBe(true);
  f.stack.chemicalBatch.documentation.status = 'uncertified'; expect(offer(f).ok).toBe(false);
  f.stack.chemicalBatch.documentation.status = 'certified'; const sh = book(f).shipment;
  collect(f, sh); expect(sh.cargoManifest.chemicalBatch).toEqual(f.stack.chemicalBatch);
});

test('departure is rechecked after collection and transit exhaustion preserves cargo and payment', () => {
  const f = fixture(), sh = book(f).shipment, op = f.state.operators[0]; collect(f, sh);
  op.route.supportCapable = false; advance(f, 20);
  expect(sh.waitingCargo).toBe(true); expect(sh.elapsedHours).toBe(0); expect(sh.foodReserve).toBe(0);
  op.route.supportCapable = true; advance(f, 21); expect(sh.waitingCargo).toBe(false);
  op.route.supportCapable = false; advance(f, 40);
  expect(sh.delivered).toBe(false); expect(sh.playerEscrow).toBeGreaterThan(0); expect(sh.cargoManifest.quantity).toBe(3);
  expect(op.reason).toContain('provisions exhausted'); expect(op.crew.every(c => c.status === 'alive')).toBe(true);
  expect(Trade.settleExport(f.state, sh.id)).toBe(0);
});
