const { test } = require('node:test');
const assert = require('node:assert/strict');
const Outer = require('../outer-approach');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'b', charterId: 'charter:b', institutionId: 'defense:b', populationSourceId: 'population:b', population: 100,
    installationId: 'original-ward:b', condition: 80, baselineEnergy: 69120 };
  const p = (x, y) => ({ x, y, z: 25 });
  const b = { source: { cityId: 'b', charterId: 'charter:b', defenseId: 'defense:b', populationSourceId: 'population:b' }, depot: { id: 'original-depot:b' },
    defender: { id: 'original-defender', name: 'Ash', roomId: 'checkpoint', mapCell: p(11, 8), locationId: 'office', exceptionalCapabilities: ['city-scale ward defense'],
      status: 'alive', health: 100, maxHealth: 100, wardMana: 120, stamina: 100, workSeconds: 3600 } };
  const s = Outer.create(source, b, { roomId: 'front', entry: p(6, 16), post: p(11, 12), service: p(10, 13), receiving: p(10, 14), structure: p(10, 12) },
    { worldId: 'world', runId: 'run' }, 0);
  const c = { source, worldId: 'world', runId: 'run', alive: true, capable: true, free: true, local: true, observed: true, bodyEpoch: 0,
    cell: p(10, 14), busy: false, departing: false, transitProgress: 0, structurePresent: true, condition: 80, structureVisible: true,
    defenderObserved: true, defenderIncapacitated: false, suppressed: false, otherDuty: false, defenderCanContest: true,
    defenderSeesScientist: true, distanceM: 3, attackLine: true, atBoth: true, clearAccess: true, pulseVisible: true,
    witnessIds: [b.defender.id], observedWitnessIds: [b.defender.id] };
  const events = { hits: 0, moves: 0, strikes: 0 };
  const h = { pulse: n => { events.hits += n; }, strike: () => events.strikes++, move: (a, goal) => {
    a.mapCell = { ...a.mapCell, x: a.mapCell.x + Math.sign(goal.x - a.mapCell.x), y: a.mapCell.y + Math.sign(goal.y - a.mapCell.y) };
    events.moves++; return true;
  } };
  return { source, b, s, c, h, events };
}
const tick = (f, at) => Outer.advance(f.s, f.b, at, () => f.c, f.h);
test('only original supported city fortifications, defender and population can create one bounded station', () => {
  const f = fixture(), before = copy(f.b); assert.equal(f.s.station.energy, f.source.baselineEnergy); assert.deepEqual(f.b, before);
  for (const source of [null, { ...f.source, institutionId: 'other' }, { ...f.source, populationSourceId: 'other' }, { ...f.source, baselineEnergy: Infinity }])
    assert.equal(Outer.create(source, f.b, f.s.layout, { worldId: 'world', runId: 'run' }, 0), null);
  assert.equal(f.s.claim, null); assert.match(Outer.LIMITS, /No inner-city admission/);
});
test('installed interception and personal projection spend separate finite original reserves', () => {
  const f = fixture(), a = f.b.defender; a.mapCell = copy(f.s.layout.post); a.assignment = f.s.station.duty.id;
  const initial = f.s.station.energy;
  assert.deepEqual(Outer.absorb(f.s, f.b, f.c, 30, ['physical'], a.mapCell, 0), { damage: 10, absorbed: 20 });
  assert.equal(f.s.station.energy, initial - 1200); assert.equal(a.wardMana, 120);
  assert.deepEqual(Outer.personalAbsorb(f.s, a, 10), { damage: 0, absorbed: 10 }); assert.equal(a.wardMana, 110);
  a.wardMana = 0; assert.equal(Outer.absorb(f.s, f.b, f.c, 10, ['force'], a.mapCell, 0).absorbed, 10);
  f.s.station.energy = 0; a.wardMana = 25; assert.equal(Outer.personalAbsorb(f.s, a, 10).absorbed, 10);
});
test('no unsupported damage immunity, hidden remote shield, reserve refill or suppression bypass', () => {
  const f = fixture(); f.b.defender.mapCell = copy(f.s.layout.post); f.b.defender.assignment = f.s.station.duty.id;
  const energy = f.s.station.energy;
  for (const types of [['soul'], ['toxic'], ['physical', 'arcane']]) assert.equal(Outer.absorb(f.s, f.b, f.c, 30, types, f.s.layout.structure, 0).absorbed, 0);
  assert.equal(Outer.absorb(f.s, f.b, f.c, 30, ['physical'], { ...f.s.layout.post, z: 99 }, 0).absorbed, 0);
  assert.equal(f.s.station.energy, energy);
  f.c.structurePresent = false; assert.equal(Outer.absorb(f.s, f.b, f.c, 30, ['physical'], f.s.layout.structure, 0).absorbed, 0);
  assert.equal(Outer.personalAbsorb(f.s, f.b.defender, 30, true).absorbed, 0);
});
test('same original defender walks to protected post, never to a baiting scientist or through another assignment', () => {
  const f = fixture(); tick(f, 8); assert.deepEqual(f.b.defender.mapCell, f.s.layout.post); assert.equal(f.events.moves, 4);
  f.c.cell = { x: 5, y: 17, z: 25 }; tick(f, 10); assert.deepEqual(f.b.defender.mapCell, f.s.layout.post);
  const other = fixture(); other.b.defender.assignment = 'original-audience'; other.c.otherDuty = true;
  tick(other, 10); assert.equal(other.events.moves, 0); assert.equal(other.b.defender.assignment, 'original-audience');
  Outer.begin(other.s, other.b, other.c, 10); tick(other, 20); assert.equal(other.s.phase, 'contested');
});
test('hostile declaration produces paid telegraph, actual delayed pulse and no training safety floor', () => {
  const f = fixture(); assert.equal(Outer.begin(f.s, f.b, f.c, 0), true); tick(f, 2);
  assert.equal(f.b.defender.wardMana, 108); assert.equal(f.s.pendingPulse.releaseAt, 4); assert.equal(f.events.hits, 0);
  f.s = Outer.normalize(copy(f.s)); tick(f, 4); assert.equal(f.events.hits, 18); assert.equal(f.s.pendingPulse, null);
  assert.equal(f.s.phase, 'contested'); assert.equal(f.s.claim.heldAt, null);
});
test('actual dodge, cover, range loss and magic suppression prevent a marked pulse without refunding mana', () => {
  for (const changed of ['cell', 'line', 'range', 'suppression']) {
    const f = fixture(); Outer.begin(f.s, f.b, f.c, 0); tick(f, 2);
    if (changed === 'cell') f.c.cell.x--;
    if (changed === 'line') f.c.attackLine = false;
    if (changed === 'range') f.c.distanceM = 20;
    if (changed === 'suppression') f.c.suppressed = true;
    tick(f, 4); assert.equal(f.events.hits, 0, changed); assert.equal(f.b.defender.wardMana, 108);
  }
});
test('ten actual uninterrupted seconds of clear local access are required; touching a marker is not control', () => {
  const f = fixture(); f.b.defender.workSeconds = 0; f.c.defenderCanContest = false;
  Outer.begin(f.s, f.b, f.c, 0); tick(f, 5); assert.equal(f.s.progress, 5); assert.equal(f.s.phase, 'contested');
  f.c.atBoth = false; tick(f, 6); assert.equal(f.s.progress, 0);
  f.c.atBoth = true; tick(f, 15); assert.equal(f.s.phase, 'contested'); tick(f, 16); assert.equal(f.s.phase, 'held');
  assert.equal(f.s.claim.heldAt, 16); assert.equal(f.s.station.energy, f.source.baselineEnergy - 16);
  f.c.clearAccess = false; tick(f, 17); assert.equal(f.s.phase, 'contested');
});
test('defender defeat, exhaustion or retreat does not itself grant control, disable the station or cause city surrender', () => {
  const f = fixture(); Outer.begin(f.s, f.b, f.c, 0); f.b.defender.status = 'dead'; f.b.defender.health = 0; f.c.atBoth = false;
  tick(f, 20); assert.equal(f.s.phase, 'contested'); assert.ok(f.s.station.energy > 0); assert.equal(f.s.claim.heldAt, null);
  f.c.atBoth = true; tick(f, 30); assert.equal(f.s.phase, 'held'); assert.equal(f.s.history.length, 0);
  assert.equal(f.b.defender.status, 'dead'); assert.equal(f.s.sovereignty, undefined);
});
test('injured original physically retreats and genuinely recovered original can return, without replacement or free healing', () => {
  const f = fixture(); tick(f, 8); f.b.defender.health = 18; tick(f, 12);
  assert.equal(f.s.defenderPhase, 'retreating'); assert.deepEqual(f.b.defender.mapCell, f.s.home.cell); assert.equal(f.b.defender.health, 18);
  f.b.defender.health = 60; tick(f, 16); assert.equal(f.s.defenderPhase, 'guarding'); assert.deepEqual(f.b.defender.mapCell, f.s.layout.post);
  assert.equal(f.b.defender.id, f.s.defenderId); assert.equal(f.b.defender.health, 60);
});
test('physical departure loses the claim and leaves only dated observations, not an invisible garrison', () => {
  const f = fixture(); f.b.defender.workSeconds = 0; f.c.defenderCanContest = false;
  Outer.begin(f.s, f.b, f.c, 0); tick(f, 10); assert.equal(f.s.phase, 'held'); const dated = copy(f.s.observations);
  f.c.local = false; tick(f, 11); assert.equal(f.s.phase, 'lost'); assert.equal(f.s.history.length, 1); assert.deepEqual(f.s.observations, dated);
  assert.equal(Outer.end(f.s, 12, 'again'), false);
  assert.doesNotMatch(JSON.stringify(dated), /wardMana|stamina|energy|workSeconds/);
});
test('witnessed acts alone produce conduct, never automatic cases or omniscient witnesses', () => {
  const f = fixture(); f.c.witnessIds = []; Outer.begin(f.s, f.b, f.c, 0); assert.equal(f.s.reports.length, 0);
  f.c.witnessIds = ['original-person']; f.c.observedWitnessIds = []; Outer.attack(f.s, f.b, f.c, 1, f.s.id);
  assert.equal(f.s.reports[0].communicated, false); assert.equal(f.s.reports[0].witnessId, 'original-person'); assert.equal(f.s.case, undefined);
});
test('save/load and clock chunking preserve finite duty, station, wounds and pending actions exactly', () => {
  const a = fixture(), b = fixture(); Outer.begin(a.s, a.b, a.c, 0); Outer.begin(b.s, b.b, b.c, 0);
  tick(a, 19); for (let at = 1; at <= 19; at++) { b.s = Outer.normalize(copy(b.s)); tick(b, at); }
  assert.deepEqual(b.s, a.s); assert.deepEqual(b.b, a.b); assert.deepEqual(b.events, a.events);
});
test('death freezes, a changed body loses its claim, validated copied runs rebind and fresh runs inherit nothing', () => {
  const f = fixture(); Outer.begin(f.s, f.b, f.c, 0); tick(f, 2); const frozen = copy(f.s);
  f.c.alive = false; tick(f, 9); assert.deepEqual(f.s, frozen);
  f.c.alive = true; f.c.bodyEpoch++; tick(f, 3); assert.equal(f.s.phase, 'lost');
  const rebound = Outer.rebind(f.s, { worldId: 'world', runId: 'run' }, { worldId: 'copy', runId: 'copy' });
  assert.equal(rebound.runId, 'copy'); assert.equal(f.s.runId, 'run'); assert.equal(fixture().s.claim, null);
});
test('only maintained original depot access is disrupted; departure restores access without replacing cargo or awarding terms', () => {
  const f = fixture(); f.b.defender.workSeconds = 0; f.c.defenderCanContest = false;
  assert.equal(Outer.depotBlocked(f.s, 'original-depot:b'), false);
  Outer.begin(f.s, f.b, f.c, 0); tick(f, 10);
  assert.equal(Outer.depotBlocked(f.s, 'original-depot:b'), true); assert.equal(Outer.depotBlocked(f.s, 'other-depot'), false);
  f.c.departing = true; tick(f, 11); assert.equal(Outer.depotBlocked(f.s, 'original-depot:b'), false);
  assert.equal(f.s.payment, undefined); assert.equal(f.s.terms, undefined);
});
test('unseen declaration or attack supplies no omniscient target; interrupted original duty cancels a paid windup without refund', () => {
  const f = fixture(); f.c.witnessIds = []; f.c.defenderSeesScientist = false; f.c.atBoth = false;
  Outer.begin(f.s, f.b, f.c, 0); Outer.attack(f.s, f.b, f.c, 0, f.s.id); tick(f, 3);
  assert.equal(f.s.pendingPulse, null); assert.equal(f.b.defender.wardMana, 120);
  f.c.atBoth = true; f.c.defenderSeesScientist = true; tick(f, 4); assert.equal(f.b.defender.wardMana, 108);
  f.b.defender.assignment = 'another-existing-duty'; f.c.otherDuty = true; tick(f, 6);
  assert.equal(f.s.pendingPulse, null); assert.equal(f.events.hits, 0); assert.equal(f.b.defender.wardMana, 108);
});
test('a mobile injured defender can still defend themselves when cornered during physical retreat', () => {
  const f = fixture(); f.b.defender.health = 18; f.c.distanceM = 1;
  Outer.begin(f.s, f.b, f.c, 0); tick(f, 2);
  assert.equal(f.s.defenderPhase, 'retreating'); assert.equal(f.s.pendingPulse.releaseAt, 4); assert.equal(f.b.defender.wardMana, 108);
  tick(f, 4); assert.equal(f.events.hits, 18); assert.equal(f.b.defender.health, 18);
});
test('supported body recovery explicitly releases the departed claim and old pulse without moving or healing anyone', () => {
  const f = fixture(); Outer.begin(f.s, f.b, f.c, 0); tick(f, 2); const actor = copy(f.b.defender), dated = copy(f.s.observations), energy = f.s.station.energy;
  assert.equal(Outer.bodyEnded(f.s, 2), true); assert.equal(f.s.phase, 'lost'); assert.equal(f.s.pendingPulse, null);
  assert.deepEqual(f.b.defender, actor); assert.deepEqual(f.s.observations, dated); assert.equal(f.s.station.energy, energy);
  assert.equal(Outer.bodyEnded(f.s, 2), false); assert.equal(f.s.history.length, 1);
});
