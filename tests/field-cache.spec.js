const { test, expect } = require('@playwright/test');
const Cache = require('../field-cache');
const copy = x => JSON.parse(JSON.stringify(x));
const cell = { x: 24, y: 10, z: 22 };
const kit = () => ({ id: 'kit', section: 'inventory', key: Cache.KEY, quantity: 1, unitMassKg: 4, unitVolumeL: 8,
  carriedBy: 'scientist', productionBillId: 'actual-craft', productionWorkpieceId: 'actual-workpiece', tags: [], sourceLabels: ['Fabricate field chest'] });
const fab = () => ({ id: 'fabricated-original', fixtureTypeId: Cache.TYPE, physicalStackId: 'kit', productionBillId: 'actual-craft', condition: 63 });
const context = () => ({ worldId: 'w', siteId: 's', roomId: 'r', bodyEpoch: 0, visitId: 'visit', tripId: 'trip', alive: true,
  capable: true, originalBody: true, local: true, custody: false, busy: false, threatened: false });
test('only the exact owned carried crafted frame is a deployment source, including claim and surviving condition', () => {
  expect(Cache.source(kit(), fab())).toBe(true);
  for (const change of [{ carriedBy: '' }, { quantity: 2 }, { key: 'storageCrateFinished' }, { cityOwnerId: 'city' },
    { reservedTaskId: 'builder' }, { fixtureId: 'other' }, { productionBillId: 'fake' }, { biology: {} }])
    expect(Cache.source({ ...kit(), ...change }, fab()), JSON.stringify(change)).toBe(false);
  for (const change of [{ condition: 0 }, { physicalStackId: 'replacement' }, { fixtureTypeId: 'storageCrate' }, { reservedOrderId: 'other' }])
    expect(Cache.source(kit(), { ...fab(), ...change })).toBe(false);
  expect(Cache.source({ ...kit(), reservedTaskId: 'task' }, { ...fab(), reservedOrderId: 'task' }, 'task')).toBe(true);
  expect(Cache.MASS).toBe(4); expect(Cache.VOLUME).toBe(8);
});
test('field work binds original body, actual world, patch, room, visit and trip without title or admission', () => {
  const c = context(), job = Cache.binding(c); expect(Cache.current(job, c)).toBe(true); expect(Cache.reason(c)).toBe('');
  for (const key of Object.keys(job)) expect(Cache.current(job, { ...c, [key]: 'replacement' })).toBe(false);
  for (const change of [{ alive: false }, { capable: false }, { originalBody: false }, { local: false }, { custody: true }, { busy: true }, { threatened: true }])
    expect(Cache.reason({ ...c, ...change })).not.toBe('');
});
test('ordinary stock excludes living, civic, contaminated or uncontained contents', () => {
  const water = { id: 'water', section: 'inventory', key: 'drinkingWater', quantity: 3 };
  expect(Cache.safe(water)).toBe(true);
  for (const change of [{ quantity: 0 }, { section: 'corpses' }, { civicCustody: {} }, { contents: [{}] }, { tags: ['toxic'] }, { creature: {} }, { chemicalBatch: {} }])
    expect(Cache.safe({ ...water, ...change })).toBe(false);
});
test('only original frame inspections update dated knowledge; closed or distant caches cannot refresh contents', () => {
  const r = { fixtureId: 'frame', cell, port: { ...cell, y: 11 }, worldId: 'w', siteId: 's', installedAt: 10 };
  const f = { id: 'frame', typeId: Cache.TYPE, installedAt: 10, origin: cell, condition: 80, accessState: 'open' };
  const items = [{ id: 'water', key: 'drinkingWater', quantity: 2, section: 'inventory', fixtureId: 'frame' }];
  Cache.observe(r, f, items, 20, true); const held = Cache.publicView([r]);
  items[0].quantity = 1; f.condition = 0; expect(Cache.publicView([r])).toEqual(held);
  Cache.observe(r, { ...f, condition: 80, accessState: 'closed' }, items, 30, false);
  expect(r.lastInspection).toMatchObject({ at: 30, contentsAt: 20, contents: [{ quantity: 2 }] });
  Cache.observe(r, null, items, 40, true); expect(r.lastInspection).toMatchObject({ at: 40, state: 'original frame missing', contentsAt: 40, contents: [{ quantity: 1 }] });
  expect(Cache.frame(r, { ...f, installedAt: 999 })).toBe(false);
  expect(Cache.publicView([r])[0]).not.toHaveProperty('kit');
});
test('attended work survives serialization, cannot backfill interruption, and freezes on death', () => {
  let j = { lastAt: 0, wasReady: false, progress: 0, required: 60 };
  Cache.advance(j, 10, true); expect(j.progress).toBe(0);
  Cache.advance(j, 20, true); expect(j.progress).toBe(10);
  Cache.advance(j, 200, false); Cache.advance(j, 300, true); expect(j.progress).toBe(10);
  j = copy(j); Cache.advance(j, 310, true); expect(j.progress).toBe(20);
  const frozen = copy(j); Cache.advance(j, 999, true, false); expect(j).toEqual(frozen);
  Cache.advance(j, 350, true); expect(j.progress).toBe(60);
});
test('folded-frame observations retain actual damage and never turn a packed record into a second frame', () => {
  const r = { fixtureId: 'original', cell, port: cell, installedAt: 1, packed: true, packedCondition: 41, kit: kit(), fabricated: fab() };
  Cache.observe(r, null, [], 20, true);
  expect(Cache.publicView([r])[0].lastInspection).toMatchObject({ at: 20, condition: 41, state: 'packed personally', contents: [] });
  expect(Cache.frame(r, { id: 'original', typeId: Cache.TYPE, installedAt: 1, origin: cell, condition: 100 })).toBe(false);
});
