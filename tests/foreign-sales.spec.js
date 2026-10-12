const { test, expect } = require('@playwright/test');
const Supplies = require('../foreign-supplies');
const copy = v => JSON.parse(JSON.stringify(v));
const def = { id: 'metalParts', label: 'Metal Parts', basePrice: 19, supply: 60, liquidity: 28, sellable: true };
function fixture() {
  const s = Supplies.create({ cityId: 'b', currentPopulation: 100 }, [{ network: { id: 'procurement:b', category: 'commercial', roles: ['procurement'] },
    standing: 'licensed', branch: { id: 'branch:b', cityId: 'b', publicName: 'B Buying Counter', capacityBand: 'functional' } }], 0, { roomId: 'hall', cell: { x: 18, y: 7, z: 22 } });
  const m = { id: 'b', treasury: 10000, listings: { metalParts: { supply: 60, demand: 1 } } };
  const item = { id: 'owned-lot', section: 'resources', key: 'metalParts', quantity: 6, unitMassKg: 1, unitVolumeL: .5, carriedBy: 'scientist' };
  const c = { alive: true, capable: true, local: true, atCounter: true, contact: true, providerCurrent: true, bodyEpoch: 0, visitId: 'trip', busy: false,
    permit: { id: 'permit', expiresAt: 21600 }, saleRouteSeconds: 20, receivingRemaining: { massKg: 48, volumeL: 24 }, supplierRemaining: { massKg: 18, volumeL: 24 } };
  const wallet = { money: 100 }, physical = { reserved: 0, handed: 0, stored: 0, missing: false }, moves = [];
  const hooks = {
    reserveSale: () => { physical.reserved++; return 'exact-reserved-slice'; },
    saleCustody: () => !physical.missing,
    move: (o, target) => { moves.push(target); return { done: true }; },
    takeSale: () => `buyer-lot-${++physical.handed}`,
    storeSale: (o, at, net) => { physical.stored++; m.listings.metalParts.supply++; wallet.money += net; return `buyer-lot-${physical.stored}`; }
  };
  return { s, m, item, c, wallet, physical, hooks, moves };
}
function book(f, quantity = 2) {
  const q = Supplies.saleQuote(f.s, f.m, def, f.item, quantity, f.c, 0); expect(q).not.toBeNull();
  expect(Supplies.sell(f.s, f.m, def, f.item, q, f.c, 0, f.hooks)).toBe(true); return q;
}
test('separate published procurement terms, exact carried ownership and legal good are required', () => {
  const f = fixture(); expect(f.s.salesTerms.good).toBe('metalParts');
  for (const patch of [{ section: 'chemicalBatches' }, { key: 'fieldRation' }, { carriedBy: '' }, { carriedBy: 'other' },
    { reservedTaskId: 'task' }, { cityOwnerId: 'b' }, { civicCustody: {} }, { carryTaskId: 'loan' }, { toolInstanceId: 'claimed' },
    { chemicalBatch: {} }, { contents: [{}] }, { biology: {} }]) expect(Supplies.saleQuote(f.s, f.m, def, { ...f.item, ...patch }, 2, f.c, 0)).toBeNull();
  delete f.s.salesTerms; expect(Supplies.saleQuote(f.s, f.m, def, f.item, 2, f.c, 0)).toBeNull();
});
test('market bid responds to supply/demand, fixed fee and exact selected slice', () => {
  const f = fixture(), q = Supplies.saleQuote(f.s, f.m, def, f.item, 2, f.c, 0);
  expect(q.stackId).toBe(f.item.id); expect(q.net).toBe(q.unitPrice * 2 - 4); expect(q.handlingFee).toBe(4);
  f.m.listings.metalParts.supply /= 2; expect(Supplies.saleQuote(f.s, f.m, def, f.item, 2, f.c, 0).unitPrice).toBeGreaterThan(q.unitPrice);
  expect(Supplies.sell(f.s, f.m, def, f.item, q, f.c, 1, f.hooks)).toBe(false);
  expect(f.m.treasury).toBe(10000); expect(f.physical.reserved).toBe(0); expect(f.wallet.money).toBe(100);
});
test('stale price, quantity, body, visit or permit quotes move no cargo or money', () => {
  for (const mutate of [f => f.item.quantity--, f => f.item.unitMassKg++, f => f.item.id = 'other', f => f.item.cityOwnerId = 'b',
    f => f.c.bodyEpoch++, f => f.c.visitId = 'new', f => f.c.permit.id = 'new', f => f.m.listings.metalParts.demand = 1.8]) {
    const f = fixture(), q = Supplies.saleQuote(f.s, f.m, def, f.item, 2, f.c, 0); mutate(f);
    expect(Supplies.sell(f.s, f.m, def, f.item, q, f.c, 1, f.hooks)).toBe(false); expect(f.physical.reserved).toBe(0); expect(f.m.treasury).toBe(10000);
  }
  const f = fixture(), q = Supplies.saleQuote(f.s, f.m, def, f.item, 2, f.c, 0);
  expect(Supplies.sell(f.s, f.m, def, f.item, q, f.c, 60, f.hooks)).toBe(false);
});
test('real funds, intake, pack, permit, finite duty and one six-unit transaction constrain execution', () => {
  for (const mutate of [f => f.m.treasury = 0, f => f.c.receivingRemaining.volumeL = 0, f => f.c.supplierRemaining.massKg = 1,
    f => f.c.permit.expiresAt = 100, f => f.s.workSeconds = 1, f => f.s.provisionsSeconds = 1, f => f.s.powerSeconds = 0,
    f => f.c.providerCurrent = false, f => f.c.atCounter = false, f => f.c.contact = false, f => f.s.actor.health = 0, f => f.c.saleRouteSeconds = null,
    f => f.c.saleRouteSeconds = -1, f => f.m.listings.metalParts.demand = NaN, f => f.m.listings.metalParts.supply = NaN]) {
    const f = fixture(); mutate(f); expect(Supplies.saleQuote(f.s, f.m, def, f.item, 2, f.c, 0)).toBeNull();
  }
  const f = fixture(); expect(Supplies.saleQuote(f.s, f.m, def, { ...f.item, quantity: 10 }, 7, f.c, 0)).toBeNull();
  const q = book(f); expect(f.m.treasury).toBe(10000 - q.gross); expect(f.m.listings.metalParts.supply).toBe(60);
  expect(f.wallet.money).toBe(100); expect(f.physical.handed).toBe(0); expect(f.s.powerSeconds).toBe(1799);
  expect(Supplies.saleQuote(f.s, f.m, def, f.item, 1, f.c, 1)).toBeNull();
  expect(Supplies.sell(f.s, f.m, def, f.item, q, f.c, 1, f.hooks)).toBe(false); expect(f.physical.reserved).toBe(1);
});
test('failed physical reservation and exhausted original staff preserve funds and cargo without rescue', () => {
  const f = fixture(), q = Supplies.saleQuote(f.s, f.m, def, f.item, 2, f.c, 0); f.hooks.reserveSale = () => null;
  expect(Supplies.sell(f.s, f.m, def, f.item, q, f.c, 0, f.hooks)).toBe(false);
  expect(f.m.treasury).toBe(10000); expect(f.s.serial).toBe(0); expect(f.s.powerSeconds).toBe(1800); expect(f.s.orders).toHaveLength(0);
  for (const mutate of [h => h.s.workSeconds = 15, h => h.s.provisionsSeconds = 15, h => h.s.actor.status = 'dead']) {
    const h = fixture(), accepted = book(h); mutate(h); Supplies.advance(h.s, h.c, 100, h.hooks);
    expect(h.physical.handed).toBe(0); expect(h.physical.stored).toBe(0); expect(h.s.orders[0].escrow).toBe(accepted.gross);
    expect(h.m.treasury).toBe(10000 - accepted.gross); expect(h.wallet.money).toBe(100);
  }
});
test('partial handoffs then actual store preparation and unit receipts pay exactly once across saves', () => {
  const f = fixture(), q = book(f); Supplies.advance(f.s, f.c, 30, f.hooks);
  expect(f.s.orders[0].handed).toBe(1); expect(f.wallet.money).toBe(100); expect(f.m.listings.metalParts.supply).toBe(60);
  f.s = copy(f.s); Supplies.advance(f.s, f.c, 60, f.hooks); expect(f.s.orders[0].status).toBe('storing');
  Supplies.advance(f.s, f.c, 149, f.hooks); expect(f.physical.stored).toBe(0);
  Supplies.advance(f.s, f.c, 150, f.hooks); expect(f.physical.stored).toBe(1); expect(f.wallet.money).toBe(100 + q.unitPrice - 4);
  expect(f.s.orders[0].escrow).toBe(q.unitPrice); expect(f.s.handlingRevenue).toBe(4);
  f.s = copy(f.s); Supplies.advance(f.s, f.c, 180, f.hooks); expect(f.s.orders[0].status).toBe('returning');
  Supplies.advance(f.s, f.c, 181, f.hooks); expect(f.s.orders[0].status).toBe('received');
  expect(f.wallet.money).toBe(100 + q.net); expect(f.m.listings.metalParts.supply).toBe(62); expect(f.s.orders[0].escrow).toBe(0);
  Supplies.advance(f.s, f.c, 200, f.hooks); expect(f.physical.stored).toBe(2); expect(f.wallet.money).toBe(100 + q.net);
  expect(f.moves).toContain('hall'); expect(f.moves).toContain('store');
});
test('absence, obstruction, original missing lot and changed capacity preserve escrow without backfill', () => {
  const f = fixture(), q = book(f); Supplies.advance(f.s, f.c, 30, f.hooks); f.c.atCounter = false;
  Supplies.advance(f.s, f.c, 100, f.hooks); expect(f.s.orders[0].handed).toBe(1);
  f.c.atCounter = true; Supplies.advance(f.s, f.c, 200, f.hooks); expect(f.s.orders[0].handed).toBe(1);
  f.hooks.move = () => ({ blocked: 'actual occupied tile' }); Supplies.advance(f.s, f.c, 201, f.hooks);
  expect(f.s.orders[0].delay).toBe('actual occupied tile'); expect(f.s.orders[0].escrow).toBe(q.gross);
  f.physical.missing = true; Supplies.advance(f.s, f.c, 202, f.hooks); Supplies.advance(f.s, f.c, 203, f.hooks);
  expect(f.s.orders[0].delay).toContain('exact original'); expect(f.wallet.money).toBe(100);
  const h = fixture(); book(h); Supplies.advance(h.s, h.c, 120, h.hooks); h.hooks.storeSale = () => null;
  Supplies.advance(h.s, h.c, 150, h.hooks); expect(h.s.orders[0].delivered).toBe(0); expect(h.s.orders[0].escrow).toBe(h.s.orders[0].quote.gross);
});
test('expiry blocks new hall handoffs but explicit outer attendance can finish the same sale', () => {
  const f = fixture(); book(f); Supplies.advance(f.s, f.c, 30, f.hooks); f.c.permit = null;
  Supplies.advance(f.s, f.c, 100, f.hooks); expect(f.s.orders[0].handed).toBe(1);
  expect(Supplies.outer(f.s, { ...f.c, atOuter: false, at: 100 })).toBe(false);
  f.c.atOuter = true; f.c.atCounter = false; expect(Supplies.outer(f.s, { ...f.c, at: 100 })).toBe(true);
  Supplies.advance(f.s, f.c, 101, f.hooks); Supplies.advance(f.s, f.c, 252, f.hooks);
  expect(f.s.orders[0].status).toBe('received'); expect(f.moves).toContain('outer'); expect(f.physical.stored).toBe(2);
});
test('buyer can finish carrying fully handed goods without player presence or admission', () => {
  const f = fixture(); book(f); Supplies.advance(f.s, f.c, 60, f.hooks);
  f.c.local = false; f.c.atCounter = false; f.c.permit = null; f.c.busy = true; f.c.visitId = 'return-journey';
  Supplies.advance(f.s, f.c, 181, f.hooks); expect(f.s.orders[0].status).toBe('received'); expect(f.physical.stored).toBe(2);
});
test('death freezes original sale and new bodies never inherit handoff, escrow or receipt', () => {
  const f = fixture(); book(f); Supplies.advance(f.s, f.c, 30, f.hooks); const frozen = JSON.stringify(f.s);
  Supplies.advance(f.s, { ...f.c, alive: false }, 300, f.hooks); expect(JSON.stringify(f.s)).toBe(frozen);
  f.c.bodyEpoch++; Supplies.advance(f.s, f.c, 300, f.hooks); expect(f.s.orders[0].status).toBe('bodyLost');
  expect(f.physical.stored).toBe(0); expect(f.wallet.money).toBe(100); expect(f.s.orders[0].escrow).toBeGreaterThan(0);
});
test('bid history contains only received observations, no remote backfill, refresh duplicates or private totals', () => {
  const f = fixture(); const v = copy(Supplies.observe(f.s, f.c, f.m, [def], 0));
  expect(v.sale.history).toEqual([{ at: 0, bid: v.sale.bid }]);
  Supplies.observe(f.s, f.c, f.m, [def], 0); expect(f.s.bidHistory).toHaveLength(1);
  f.m.listings.metalParts.supply = 1;
  expect(Supplies.observe(f.s, { ...f.c, contact: false }, f.m, [def], 1000)).toEqual(v); expect(f.s.bidHistory).toHaveLength(1);
  f.s = copy(f.s); Supplies.observe(f.s, f.c, f.m, [def], 1000); expect(f.s.bidHistory).toHaveLength(2); expect(f.s.bidHistory[1].bid).toBeGreaterThan(v.sale.bid);
  f.c.permit = null; Supplies.observe(f.s, f.c, f.m, [def], 2000); expect(f.s.bidHistory).toHaveLength(2);
  f.c.permit = { id: 'permit', expiresAt: 21600 }; f.s.powerSeconds = 0;
  Supplies.observe(f.s, f.c, f.m, [def], 3000); expect(f.s.bidHistory).toHaveLength(2);
  expect(JSON.stringify(f.s.knowledge)).not.toContain('treasury'); expect(JSON.stringify(f.s.knowledge)).not.toContain('escrow');
});
