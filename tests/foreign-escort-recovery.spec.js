const { test, expect } = require('@playwright/test');
const Recovery = require('../foreign-escort-recovery');
const Foreign = require('../foreign-expedition-escort');
const Survival = require('../wilderness-survival');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'b', populationId: 'population:b', branchId: 'chapter:b', networkId: 'military:b',
    allocationId: 'chapter:b:field-survey-professional', label: 'Birch Chapter', restrictions: [], prohibitions: [] };
  const s = Foreign.create(source, { source: { cityId: 'b', populationSourceId: 'population:b' }, roomId: 'ground', entry: { z: 21 }, wilderness: { roomId: 'wild', gate: { x: 20, y: 12, z: 21 } } }, 'seed', 0);
  s.contract = { status: 'completed', refund: 12 }; s.dutySeconds = 100; s.gearCondition = { baton: 43, vest: 25 };
  s.actor.health = 72; s.actor.needs = { ...Survival.defaultState(0), thirst: 80, hunger: 75, exertion: 85 };
  s.restPlace = { id: 'original-place', actorId: s.actor.id };
  const c = { source, alive: true, capable: true, originalBody: true, custody: false, atGround: true, local: true, near: true,
    originalTrip: true, bodyEpoch: 1, visitId: 'visit', tripId: 'trip', declaredOpposition: true, busy: false, escortIncapacitated: false,
    placeUsable: true, atRestPlace: true, threatened: false };
  const stack = (id, key, quantity) => ({ id, key, quantity, knownQuantity: quantity, section: 'inventory', carriedBy: s.actor.id, reservedTaskId: '' });
  return { s, c, stacks: [stack('water', 'drinkingWater', 2), stack('food', 'trailMeal', 1)] };
}
test('off-duty rest requires settled original people, chapter, physical shelter, explicit contact and actual unreserved provisions', () => {
  for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { custody: true }, { atGround: false }, { near: false },
    { originalTrip: false }, { busy: true }, { escortIncapacitated: true }, { source: null }, { placeUsable: false }, { atRestPlace: false }, { threatened: true }, { careActive: true }]) {
    const f = fixture(), before = copy(f); expect(Recovery.begin(f.s, { ...f.c, ...wrong }, f.stacks, 0)).toBe(false); expect(f).toEqual(before);
  }
  for (const mutate of [f => f.s.contract.status = 'active', f => f.s.contract = null, f => f.s.drag = {}, f => f.s.actor.care = {},
    f => f.s.actor.id = 'replacement', f => f.s.restPlace.actorId = 'other', f => f.s.actor.status = 'dead', f => f.stacks[0].quantity = 1,
    f => f.stacks[0].carriedBy = 'scientist', f => f.stacks[0].reservedTaskId = 'other', f => f.stacks[1].quantity = 0]) {
    const f = fixture(); mutate(f); expect(Recovery.begin(f.s, f.c, f.stacks, 0)).toBe(false);
  }
  const f = fixture(); f.c.source.restrictions = [{ id: 'oath', text: 'No declared divine opponents.', refusesDeclaredOpposition: true }];
  expect(Recovery.begin(f.s, f.c, f.stacks, 0)).toBe(false);
});
test('eight supplied hours restore only bounded duty and ordinary needs, not wounds, equipment, wages or replacement kit', () => {
  const f = fixture(), oldActor = f.s.actor.id, oldKit = copy(f.s.gearCondition), oldContract = copy(f.s.contract);
  expect(Recovery.begin(f.s, f.c, f.stacks, 0)).toBe(true);
  expect(f.stacks.map(i => i.quantity)).toEqual([1, 0]); expect(f.s.dutySeconds).toBe(100);
  Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS - 1); expect(f.s.dutySeconds).toBe(100);
  const result = Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS);
  expect(result.damage).toBe(0); expect(f.s.recovery.status).toBe('completed'); expect(f.s.dutySeconds).toBe(Recovery.DUTY);
  expect(f.s.actor.id).toBe(oldActor); expect(f.s.actor.health).toBe(72); expect(f.s.gearCondition).toEqual(oldKit); expect(f.s.contract).toEqual(oldContract);
  expect(f.s.actor.needs.exertion).toBe(0); expect(f.s.actor.needs.thirst).toBeLessThan(70); expect(f.s.actor.needs.hunger).toBeLessThan(85);
  expect(f.s.recovery.consumed.map(i => i.stackId)).toEqual(['water', 'food', 'water']);
  const done = copy(f); Recovery.advance(f.s, f.c, f.stacks, 100000); expect(f).toEqual(done);
});
test('loss of real support, shelter, original place, capacity, or peaceful attendance pauses effort without backfill', () => {
  for (const wrong of [{ source: null }, { placeUsable: false }, { atRestPlace: false }, { escortIncapacitated: true }, { threatened: true }, { careActive: true }]) {
    const f = fixture(); Recovery.begin(f.s, f.c, f.stacks, 0); Recovery.advance(f.s, f.c, f.stacks, 3600);
    Recovery.advance(f.s, { ...f.c, ...wrong }, f.stacks, 7200); expect(f.s.recovery.progressSeconds).toBe(3600); expect(f.s.recovery.status).toBe('paused');
    Recovery.advance(f.s, f.c, f.stacks, 10800); expect(f.s.recovery.progressSeconds).toBe(7200);
  }
  const f = fixture(); Recovery.begin(f.s, f.c, f.stacks, 0); f.s.restPlace.id = 'replacement';
  Recovery.advance(f.s, f.c, f.stacks, 3600); expect(f.s.recovery.progressSeconds).toBe(0);
});
test('missing drinking water holds partial effort while normal physiology continues; later actual supplies resume only future time', () => {
  const f = fixture(); Recovery.begin(f.s, f.c, f.stacks, 0); f.stacks[0].quantity = 0;
  Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS);
  const progress = f.s.recovery.progressSeconds; expect(progress).toBeLessThan(Recovery.SECONDS); expect(progress).toBeGreaterThan(0);
  expect(f.s.recovery.status).toBe('paused'); expect(f.s.actor.needs.thirst).toBeGreaterThan(70); expect(f.s.dutySeconds).toBe(100);
  f.stacks.push({ ...f.stacks[0], id: 'physical-handoff', quantity: 1, knownQuantity: 1 });
  Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS + 1); expect(f.s.recovery.progressSeconds).toBe(progress + 1);
  expect(f.s.recovery.consumed.at(-1).stackId).toBe('physical-handoff');
});
test('reload and caller chunking preserve original portions, partial effort, timing and once-only restoration', () => {
  const a = fixture(), b = fixture(); Recovery.begin(a.s, a.c, a.stacks, 0); Recovery.begin(b.s, b.c, b.stacks, 0);
  Recovery.advance(a.s, a.c, a.stacks, Recovery.SECONDS);
  Recovery.advance(b.s, b.c, b.stacks, 7200); const restored = copy(b);
  for (let at = 7260; at <= Recovery.SECONDS; at += 60) Recovery.advance(restored.s, restored.c, restored.stacks, at);
  expect(restored).toEqual(a);
});
test('absence, custody and replacement scientist do not cancel independently supported rest or reveal a live report', () => {
  const f = fixture(); Recovery.begin(f.s, f.c, f.stacks, 0); Recovery.observe(f.s, 0); const report = copy(f.s.recoveryReport);
  Recovery.advance(f.s, { ...f.c, near: false, atGround: false, local: false, originalTrip: false, originalBody: false, custody: true }, f.stacks, 3600);
  expect(f.s.recovery.progressSeconds).toBe(3600); expect(f.s.recoveryReport).toEqual(report);
  expect(Recovery.end(f.s, { ...f.c, near: false }, 3600)).toBe(false);
  expect(Recovery.observe(f.s, 3600).recovery.progressSeconds).toBe(3600);
});
test('early ending retains costs and old duty; another period needs actual supplies and fresh reviewed hire terms', () => {
  const f = fixture(); f.s.quote = { old: true }; Recovery.begin(f.s, f.c, f.stacks, 0);
  expect(f.s.quote).toBeNull(); expect(Foreign.review(f.s, f.c, 1)).toBeNull();
  expect(Foreign.hire(f.s, f.c, {}, { money: 500 }, 1)).toBe(false);
  Recovery.advance(f.s, f.c, f.stacks, 3600); expect(Recovery.end(f.s, f.c, 3600)).toBe(true);
  expect(f.s.dutySeconds).toBe(100); expect(f.stacks.map(i => i.quantity)).toEqual([1, 0]);
  expect(Recovery.begin(f.s, f.c, f.stacks, 3600)).toBe(false);
  f.stacks[0].quantity = 3; f.stacks[1].quantity = 1;
  expect(Recovery.begin(f.s, f.c, f.stacks, 3600)).toBe(true); expect(f.s.recoveryHistory[0].status).toBe('ended');
  Recovery.advance(f.s, f.c, f.stacks, 3600 + Recovery.SECONDS);
  const q = Foreign.review(f.s, f.c, 3600 + Recovery.SECONDS); expect(q).toBeTruthy();
  const wallet = { money: 500 }; expect(Foreign.hire(f.s, f.c, q, wallet, q.at)).toBe(true);
  expect(wallet.money).toBe(360); expect(f.s.dutySeconds).toBe(Recovery.DUTY);
});
test('scientist death freezes unfinished rest, physiology, supplies and reports without resurrection work', () => {
  const f = fixture(); Recovery.begin(f.s, f.c, f.stacks, 0); const before = copy(f);
  expect(Recovery.advance(f.s, { ...f.c, alive: false }, f.stacks, 50000)).toEqual({ changed: false, damage: 0 }); expect(f).toEqual(before);
});
test('prolonged unsupplied pauses cause ordinary physiological harm and cannot finish duty or revive an incapacitated professional', () => {
  const f = fixture(); Recovery.begin(f.s, f.c, f.stacks, 0); f.stacks[0].quantity = 0;
  const result = Recovery.advance(f.s, f.c, f.stacks, 40 * 3600);
  expect(result.damage).toBeGreaterThan(0); expect(f.s.recovery.status).toBe('paused'); expect(f.s.dutySeconds).toBe(100);
  f.s.actor.health = 5;
  Recovery.advance(f.s, f.c, f.stacks, 41 * 3600); expect(f.s.dutySeconds).toBe(100); expect(f.s.actor.health).toBe(5);
});
test('another fully supplied rest stays at the original ceiling and archives rather than resetting earlier receipts', () => {
  const f = fixture(); Recovery.begin(f.s, f.c, f.stacks, 0); Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS);
  const first = copy(f.s.recovery);
  f.stacks[0].quantity = 2; f.stacks[1].quantity = 1;
  expect(Recovery.begin(f.s, f.c, f.stacks, Recovery.SECONDS)).toBe(true);
  Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS * 2);
  expect(f.s.dutySeconds).toBe(Recovery.DUTY); expect(f.s.recovery.id).not.toBe(first.id); expect(f.s.recoveryHistory).toEqual([first]);
});
