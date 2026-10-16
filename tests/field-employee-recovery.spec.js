const { test, expect } = require('@playwright/test');
const Recovery = require('../field-employee-recovery');
const Porter = require('../field-porter');
const Builder = require('../field-builder');
const Survival = require('../wilderness-survival');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(role) {
  const source = { cityId: 'b', populationId: 'population:b', allocationId: `${role}:original`, providerId: 'works:b',
    branchId: 'depot:b', networkId: 'transport:b', restrictions: [], prohibitions: [] };
  const e = { source: { cityId: 'b', populationSourceId: source.populationId }, entry: { z: 21 }, roomId: 'ground', wilderness: { roomId: 'wild', gate: { x: 20, y: 12, z: 21 } } };
  const s = (role === 'builder' ? Builder : Porter).create(source, e, 0);
  s.phase = 'completed'; s.contract = { actorId: s.actor.id, settledAt: 0, refund: 23, bodyEpoch: 1 }; s.dutySeconds = 100;
  s.actor.health = 72; s.actor.needs = { ...Survival.defaultState(0), thirst: 80, hunger: 75, exertion: 85 };
  s.restPlace = { id: 'original-place', stackId: 'shelter', actorId: s.actor.id };
  const c = { source, alive: true, capable: true, originalBody: true, originalTrip: true, custody: false, near: true, atGround: true,
    busy: false, incapacitated: false, placeUsable: true, atRestPlace: true, threatened: false, care: false, treatment: false,
    toolsReturned: true, bodyEpoch: 1, visitId: 'visit', tripId: 'trip', routeOk: true, site: {}, dropLegal: true, hazards: [] };
  const stack = (id, key, quantity) => ({ id, key, quantity, knownQuantity: quantity, section: 'inventory', carriedBy: s.actor.id, reservedTaskId: '' });
  return { s, c, stacks: [stack('water', 'drinkingWater', 2), stack('meal', 'trailMeal', 1)], model: role === 'builder' ? Builder : Porter };
}
for (const role of ['porter', 'builder']) test.describe(role, () => {
  test('only personal consent after actual return, settlement, handback, original backing and supplies starts rest', () => {
    for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { originalTrip: false }, { custody: true }, { near: false },
      { atGround: false }, { busy: true }, { incapacitated: true }, { placeUsable: false }, { atRestPlace: false }, { source: null },
      { threatened: true }, { care: true }, { treatment: true }, { toolsReturned: false }, { bodyEpoch: 2 }]) {
      const f = fixture(role), before = copy(f);
      expect(Recovery.begin(f.s, { ...f.c, ...wrong }, f.stacks, 0), JSON.stringify(wrong)).toBe(false);
      expect(copy(f)).toEqual(before);
    }
    for (const change of [f => f.s.phase = 'awaitingSettlement', f => f.s.contract.settledAt = null, f => f.s.actor.id = 'replacement',
      f => f.s.restPlace.actorId = 'replacement', f => f.s.actor.status = 'dead', f => f.s.job = { status: 'working' },
      f => f.stacks[0].quantity = 1, f => f.stacks[0].reservedTaskId = 'another-task', f => f.stacks[1].carriedBy = 'scientist',
      f => f.stacks[1].cityOwnerId = 'city:b', f => f.stacks[1].tags = ['toxic'],
      f => f.c.source = { ...f.c.source, restrictions: [{ refusesDeclaredOpposition: true }] }]) {
      const f = fixture(role); change(f); expect(Recovery.begin(f.s, f.c, f.stacks, 0)).toBe(false);
    }
  });
  test('eight supplied hours restore only the original eight-hour duty ceiling once', () => {
    const f = fixture(role), actorId = f.s.actor.id, contract = copy(f.s.contract);
    expect(Recovery.begin(f.s, f.c, f.stacks, 0)).toBe(true); expect(f.stacks.map(i => i.quantity)).toEqual([1, 0]);
    expect(Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS - 1).damage).toBe(0); expect(f.s.dutySeconds).toBe(100);
    Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS); expect(f.s.dutySeconds).toBe(28800); expect(f.s.recovery.status).toBe('completed');
    expect(f.s.actor.id).toBe(actorId); expect(f.s.actor.health).toBe(72); expect(f.s.contract).toEqual(contract);
    expect(f.s.actor.needs.exertion).toBe(0); expect(f.s.recovery.consumed.map(i => i.stackId)).toEqual(['water', 'meal', 'water']);
    const done = copy(f); Recovery.advance(f.s, f.c, f.stacks, 100000); expect(copy(f)).toEqual(done);
  });
  test('unusable original shelter, danger, treatment, lost backing or displacement hold progress without backfill', () => {
    for (const wrong of [{ placeUsable: false }, { atRestPlace: false }, { threatened: true }, { incapacitated: true }, { source: null }, { treatment: true }]) {
      const f = fixture(role); Recovery.begin(f.s, f.c, f.stacks, 0); Recovery.advance(f.s, f.c, f.stacks, 3600);
      Recovery.advance(f.s, { ...f.c, ...wrong }, f.stacks, 7200); expect(f.s.recovery.progressSeconds).toBe(3600); expect(f.s.recovery.status).toBe('paused');
      Recovery.advance(f.s, f.c, f.stacks, 10800); expect(f.s.recovery.progressSeconds).toBe(7200); expect(f.s.dutySeconds).toBe(100);
    }
    const f = fixture(role); Recovery.begin(f.s, f.c, f.stacks, 0); f.s.restPlace.stackId = 'new-kit';
    Recovery.advance(f.s, f.c, f.stacks, 3600); expect(f.s.recovery.progressSeconds).toBe(0);
  });
  test('supply shortages require actual later provisions and prolonged shortage causes ordinary harm, not recovery', () => {
    const f = fixture(role); Recovery.begin(f.s, f.c, f.stacks, 0); f.stacks[0].quantity = 0;
    Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS); const n = f.s.recovery.progressSeconds;
    expect(n).toBeGreaterThan(0); expect(n).toBeLessThan(Recovery.SECONDS); expect(f.s.recovery.status).toBe('paused');
    f.stacks.push({ ...f.stacks[0], id: 'later-water', quantity: 1 });
    Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS + 1); expect(f.s.recovery.progressSeconds).toBe(n + 1);
    expect(f.s.recovery.consumed.at(-1).stackId).toBe('later-water');
    const g = fixture(role); Recovery.begin(g.s, g.c, g.stacks, 0); g.stacks[0].quantity = 0;
    expect(Recovery.advance(g.s, g.c, g.stacks, 40 * 3600).damage).toBeGreaterThan(0); expect(g.s.dutySeconds).toBe(100);
  });
  test('saved effort and exact consumption are chunk-invariant, with independent rest and dated contact-only reports', () => {
    const a = fixture(role), b = fixture(role); Recovery.begin(a.s, a.c, a.stacks, 0); Recovery.begin(b.s, b.c, b.stacks, 0);
    Recovery.observe(b.s, b.c, 0); const report = copy(b.s.recoveryReport);
    const away = { ...b.c, originalTrip: false, originalBody: false, near: false, atGround: false, custody: true };
    Recovery.advance(b.s, away, b.stacks, 3600); expect(b.s.recoveryReport).toEqual(report);
    expect(Recovery.observe(b.s, away, 3600)).toBe(false); expect(Recovery.end(b.s, away, 3600)).toBe(false);
    const restored = copy(b); delete restored.s.recoveryReport;
    for (let at = 3660; at <= Recovery.SECONDS; at += 60) Recovery.advance(restored.s, restored.c, restored.stacks, at);
    Recovery.advance(a.s, a.c, a.stacks, Recovery.SECONDS); expect(restored.s).toEqual(a.s); expect(restored.stacks).toEqual(a.stacks);
  });
  test('unfinished rest blocks review and direct hire; early cancellation loses costs and another rest needs real supplies', () => {
    const f = fixture(role); f.s.quote = { old: true }; Recovery.begin(f.s, f.c, f.stacks, 0); expect(f.s.quote).toBeNull();
    f.s.dutySeconds = 28800; const wallet = { money: 500 }, offer = { site: {}, tools: [], inputs: [] };
    const q = role === 'builder' ? Builder.review(f.s, f.c, offer, 1) : Porter.review(f.s, f.c, 1); expect(q).toBeNull();
    f.s.quote = { at: 0, expiresAt: 60, actorId: f.s.actor.id }; const before = copy(f.s);
    expect(role === 'builder' ? Builder.hire(f.s, f.c, offer, f.s.quote, wallet, 1, () => ({})) : Porter.hire(f.s, f.c, f.s.quote, wallet, 1)).toBe(false);
    expect(f.s).toEqual(before); expect(wallet.money).toBe(500);
    Recovery.advance(f.s, f.c, f.stacks, 3600); expect(Recovery.end(f.s, f.c, 3600)).toBe(true); expect(f.s.dutySeconds).toBe(28800);
    expect(Recovery.begin(f.s, f.c, f.stacks, 3600)).toBe(false);
    f.stacks[0].quantity = 2; f.stacks[1].quantity = 1; expect(Recovery.begin(f.s, f.c, f.stacks, 3600)).toBe(true);
    expect(f.s.recoveryHistory[0].status).toBe('ended');
    Recovery.advance(f.s, f.c, f.stacks, 3600 + Recovery.SECONDS); expect(f.s.dutySeconds).toBe(28800);
  });
  test('irreversible scientist death freezes rest and incapacity cannot be cured by supplies', () => {
    const f = fixture(role); Recovery.begin(f.s, f.c, f.stacks, 0); const before = copy(f.s);
    expect(Recovery.advance(f.s, { ...f.c, alive: false }, f.stacks, 10000)).toEqual({ changed: false, damage: 0 }); expect(f.s).toEqual(before);
    f.s.actor.health = 5; Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS); expect(f.s.dutySeconds).toBe(100); expect(f.s.actor.health).toBe(5);
    f.s.actor.status = 'dead'; const dead = copy(f.s);
    Recovery.advance(f.s, f.c, f.stacks, Recovery.SECONDS + 100); expect(f.s).toEqual(dead);
  });
});
