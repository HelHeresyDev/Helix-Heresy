const { test, expect } = require('@playwright/test');
const Foreign = require('../foreign-expedition-escort');
const Escorts = require('../expedition-escorts');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'b', populationId: 'population:b', branchId: 'chapter:b', networkId: 'military:b',
    allocationId: 'chapter:b:professional', label: 'Birch Chapter', restrictions: [], prohibitions: ['claiming police authority'] };
  const s = Foreign.create(source, { source: { cityId: 'b', populationSourceId: 'population:b' }, roomId: 'ground:b',
    entry: { z: 21 }, wilderness: { roomId: 'wild:b', gate: { x: 20, y: 12, z: 21 } } }, 'seed', 0);
  const c = { source, alive: true, capable: true, originalBody: true, originalTrip: true, custody: false, atGround: true,
    atOriginal: true, near: true, local: true, scouted: true, bodyEpoch: 1, visitId: 'visit', tripId: 'trip', declaredOpposition: true,
    busy: false, supported: true, threatened: false, hauling: false, escortIncapacitated: false, atHead: true, roomId: 'ground:b', cell: { x: 13, y: 10, z: 21 },
    patch: { id: 'patch:east', parentSiteId: 'original-wild', worldId: 'world', strategicCellId: 'hex:2', roomId: 'wild:b',
      bounds: { x: 37, y: 8, z: 21, width: 16, height: 12 }, seam: { x: 36, y: 12, z: 21 }, entry: { x: 37, y: 12, z: 21 }, visitedAt: 0,
      observations: [{ at: 0, text: 'Personally seen unprotected entrance', kind: 'directObservation' }] } };
  const wallet = { money: 500 }; Foreign.hire(s, c, Foreign.review(s, c, 0), wallet, 0);
  return { s, c, wallet };
}
function begin(f, now = 1) {
  const q = Foreign.adjoiningReview(f.s, f.c, now); expect(q).toBeTruthy();
  expect(Foreign.adjoiningBegin(f.s, f.c, q, 'task:scope', now)).toBe(true); return q;
}
test('separate exact protection disclosure binds the original contract and only the personally scouted patch, without new payment', () => {
  const f = fixture(), before = copy(f); expect(Foreign.adjoiningBegin(f.s, f.c, {}, 'task:scope', 1)).toBe(false);
  const q = Foreign.adjoiningReview(f.s, f.c, 1);
  expect(q).toMatchObject({ actorId: f.s.actor.id, branchId: f.s.source.branchId, contractId: f.s.contract.id,
    scope: Foreign.ADJOINING_SCOPE, requiredSeconds: 60, hourly: 20, wageReserve: 80, patch: f.c.patch });
  expect(q.patch.truth).toBeUndefined(); expect(q.patch.baseline).toBeUndefined(); expect(q.patch.beasts).toBeUndefined();
  expect(Foreign.adjoiningBegin(f.s, f.c, { ...q, hourly: 0 }, 'task:scope', 2)).toBe(false);
  expect(Foreign.adjoiningBegin(f.s, f.c, q, 'task:scope', 61)).toBe(false);
  expect(Foreign.adjoiningBegin(f.s, f.c, q, 'task:scope', 2)).toBe(true);
  expect(Foreign.adjoiningAuthorized(f.s, f.c.patch)).toBe(false); expect(f.wallet).toEqual(before.wallet);
  expect(f.s.actor).toEqual(before.s.actor); expect(f.s.dutySeconds).toBe(before.s.dutySeconds);
  expect({ ...f.s.contract, adjoining: undefined }).toEqual({ ...before.s.contract, adjoining: undefined });
});
test('remote, unscouted, dangerous, invalid, occupied or spent engagements cannot preview or accept scope', () => {
  for (const wrong of [{ alive: false }, { capable: false }, { custody: true }, { originalBody: false }, { originalTrip: false }, { near: false },
    { local: false }, { atOriginal: false }, { scouted: false }, { patch: null }, { supported: false }, { busy: true }, { threatened: true }, { hauling: true },
    { escortIncapacitated: true }, { source: null }, { bodyEpoch: 2 }, { visitId: 'other' }, { tripId: 'other' }]) {
    const f = fixture(), q = Foreign.adjoiningReview(f.s, f.c, 1);
    expect(Foreign.adjoiningReview(f.s, { ...f.c, ...wrong }, 2), JSON.stringify(wrong)).toBeNull();
    expect(Foreign.adjoiningBegin(f.s, { ...f.c, ...wrong }, q, 'task', 2)).toBe(false);
  }
  for (const alter of [f => f.s.contract.status = 'returning', f => f.s.dutySeconds = 360,
    f => f.s.actor.health = 34, f => f.s.actor.needs.thirst = 85, f => f.s.actor.care = {}, f => f.s.drag = {},
    f => f.c.patch.observations = [], f => f.s.actor.id = 'replacement']) {
    const f = fixture(); alter(f); expect(Foreign.adjoiningReview(f.s, f.c, 1)).toBeNull();
  }
  const f = fixture(); expect(Foreign.adjoiningReview(f.s, f.c, 4 * 3600 - 60)).toBeNull();
});
test('changed patch, exact disclosures, policy, provider and budget invalidate acceptance without rerolling religion', () => {
  const f = fixture(), q = Foreign.adjoiningReview(f.s, f.c, 1);
  for (const p of [{ id: 'other' }, { worldId: 'other' }, { bounds: { ...f.c.patch.bounds, x: 53 } },
    { observations: [...f.c.patch.observations, { at: 2, text: 'New actually seen hazard' }] }])
    expect(Foreign.adjoiningBegin(f.s, { ...f.c, patch: { ...f.c.patch, ...p } }, q, 'task', 2)).toBe(false);
  const c = { ...f.c, source: { ...f.c.source, restrictions: [{ id: 'oath', text: 'No declared enemies of our god', refusesDeclaredOpposition: true }] } };
  expect(Foreign.adjoiningBegin(f.s, c, q, 'task', 2)).toBe(false);
  for (const now of [2, 10, 20]) expect(Foreign.adjoiningReview(f.s, c, now)).toBeNull();
  const restored = copy(f.s); expect(Foreign.adjoiningReview(restored, c, 30)).toBeNull(); expect(restored.decisions).toEqual(f.s.decisions);
  f.s.contract.wageReserve++; expect(Foreign.adjoiningBegin(f.s, f.c, q, 'task', 2)).toBe(false);
});
test('attended minute survives reload, holds without backfill and completes once without renewing any finite resource', () => {
  const f = fixture(), initial = copy(f.s); begin(f);
  expect(Foreign.adjoiningAdvance(f.s, f.c, 21)).toBe(20); Foreign.advance(f.s, f.c, 21);
  expect(f.s.contract.earned).toBeCloseTo(21 * 20 / 3600); expect(f.s.dutySeconds).toBe(initial.dutySeconds - 21);
  f.s = copy(f.s); const fraction = f.s.contract.adjoining.job.progressSeconds;
  expect(Foreign.adjoiningAdvance(f.s, { ...f.c, near: false }, 40)).toBe(0);
  expect(Foreign.adjoiningAdvance(f.s, f.c, 100)).toBe(0); expect(f.s.contract.adjoining.job.progressSeconds).toBe(fraction);
  expect(Foreign.adjoiningFinish(f.s, f.c, 100)).toBe(false);
  Foreign.adjoiningAdvance(f.s, f.c, 140); Foreign.advance(f.s, f.c, 140);
  expect(Foreign.adjoiningFinish(f.s, f.c, 140)).toBe(true); expect(Foreign.adjoiningFinish(f.s, f.c, 141)).toBe(false);
  expect(Foreign.adjoiningAuthorized(f.s, f.c.patch)).toBe(true); expect(f.s.contract.adjoining.history).toHaveLength(1);
  expect(f.s.contract.startedAt).toBe(0); expect(f.s.contract.wageReserve).toBe(80); expect(f.s.dutySeconds).toBe(initial.dutySeconds - 140);
  expect(f.s.actor.health).toBe(initial.actor.health); expect(f.s.actor.needs).toEqual(initial.actor.needs);
  expect(Foreign.adjoiningReview(f.s, f.c, 141)).toBeNull();
});
test('queue, positions, identity, backing and original policy bind every interval; death freezes unfinished acceptance', () => {
  const f = fixture(); begin(f); Foreign.adjoiningAdvance(f.s, f.c, 21);
  for (const wrong of [{ atHead: false }, { threatened: true }, { capable: false }, { bodyEpoch: 2 }, { visitId: 'other' },
    { tripId: 'other' }, { source: null }, { cell: { ...f.c.cell, x: 14 } }, { roomId: 'elsewhere' }]) {
    const s = copy(f.s); expect(Foreign.adjoiningAdvance(s, { ...f.c, ...wrong }, 40)).toBe(0);
    expect(Foreign.adjoiningFinish(s, { ...f.c, ...wrong }, 100)).toBe(false);
  }
  const s = copy(f.s); s.actor.mapCell.x++; expect(Foreign.adjoiningAdvance(s, f.c, 40)).toBe(0);
  const dead = copy(f.s); expect(Foreign.adjoiningAdvance(f.s, { ...f.c, alive: false }, 500)).toBe(0);
  expect(Foreign.adjoiningFinish(f.s, { ...f.c, alive: false }, 500)).toBe(false); expect(f.s).toEqual(dead);
});
test('cancellation grants no territory and retains spent wages and duty; later fresh consent cannot inherit effort', () => {
  const f = fixture(); begin(f); Foreign.adjoiningAdvance(f.s, f.c, 21); Foreign.advance(f.s, f.c, 21);
  const before = copy(f.s); expect(Foreign.adjoiningCancel(f.s, 21)).toBe(true); expect(Foreign.adjoiningCancel(f.s, 22)).toBe(false);
  expect(Foreign.adjoiningAuthorized(f.s, f.c.patch)).toBe(false); expect(f.s.contract.earned).toBe(before.contract.earned);
  expect(f.s.dutySeconds).toBe(before.dutySeconds); begin(f, 22); expect(f.s.contract.adjoining.job.progressSeconds).toBe(0);
  expect(f.s.contract.adjoining.history[0].status).toBe('cancelled');
});
test('late coarse updates, spent duty and changed financial terms cannot manufacture completed consent', () => {
  for (const alter of [f => f.s.dutySeconds = 350, f => f.s.contract.hourly++, f => f.s.contract.wageReserve++,
    f => f.s.contract.startedAt--]) {
    const f = fixture(); begin(f); alter(f);
    expect(Foreign.adjoiningAdvance(f.s, f.c, 61)).toBe(0); expect(Foreign.adjoiningFinish(f.s, f.c, 61)).toBe(false);
    expect(Foreign.adjoiningAuthorized(f.s, f.c.patch)).toBe(false);
  }
  const f = fixture(); begin(f); expect(Foreign.adjoiningAdvance(f.s, f.c, 14401)).toBe(0);
  expect(Foreign.adjoiningFinish(f.s, f.c, 14401)).toBe(false);
});
test('accepted scope remains usable for physical withdrawal but grants no fresh contract, patch, person or post-settlement control', () => {
  const f = fixture(); begin(f); Foreign.adjoiningAdvance(f.s, f.c, 61); Foreign.adjoiningFinish(f.s, f.c, 61);
  const original = copy(f.s); f.s.contract.status = 'returning'; f.s.contract.returnReason = 'Budget spent';
  expect(Foreign.adjoiningAuthorized(f.s, f.c.patch)).toBe(true);
  expect(Foreign.adjoiningAuthorized(f.s, { ...f.c.patch, id: 'third-patch' })).toBe(false);
  expect(Foreign.adjoiningAuthorized({ ...f.s, actor: { ...f.s.actor, id: 'replacement' } }, f.c.patch)).toBe(false);
  expect(Foreign.adjoiningAuthorized({ ...f.s, contract: { ...f.s.contract, id: 'new-contract' } }, f.c.patch)).toBe(false);
  Escorts.finish(f.s.contract, 100); expect(Foreign.adjoiningAuthorized(f.s, f.c.patch)).toBe(false);
  expect(Foreign.hire(f.s, f.c, Foreign.review(f.s, f.c, 101), f.wallet, 102)).toBe(true);
  expect(f.s.contract.adjoining).toBeUndefined(); expect(Foreign.adjoiningAuthorized(f.s, f.c.patch)).toBe(false);
  expect(original.contract.adjoining.authorization.patch).toEqual(f.c.patch);
});
