const { test } = require('node:test');
const assert = require('node:assert/strict');
const Seizure = require('../installation-seizure');
const Combat = require('../city-confrontations');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const Challenges = require('../defender-challenges');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a',
    civicCounter: { roomId: 'supportedSurveyGround', cell: { x: 17, y: 8, z: 6 } } };
  const source = { cityId: 'a', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], populationSourceId: 'population:a', administrationId: 'admin:a', defenseId: 'defense:a', archive: { coverage: [{ cellId: 'a' }] },
    institutions: Succession.ROLES.map(role => ({ role, id: `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office); Challenges.prepareDefender(b);
  const succession = Succession.create(source, b, office);
  const staff = [b.representative]; staff[0].physicalControl = { stamina: 80 };
  const s = Seizure.create(succession, b, office, staff, { installationId: 'office:a:service-channel',
    roomId: office.civicCounter.roomId, counter: office.civicCounter.cell, receiving: { x: 16, y: 12, z: 6 } });
  const c = { alive: true, capable: true, local: true, free: true, atCounter: true, siteObserved: true, sourceCurrent: true,
    bodyEpoch: 0, inHoldingArea: true, canHold: false, defenseAvailable: true, defenderCanHear: true,
    sameGround: true, cell: copy(s.site.counter), siteDistance: 0, distanceM: 3, lineOfEffect: true,
    defenderTracksScientist: true, defenderObserved: true, hearingStaffIds: [staff[0].id],
    witnessIds: [staff[0].id], visibleWitnessIds: [staff[0].id], nearLot: true, lotVisible: true, carryOk: true };
  const stacks = [{ id: 'original-lot', key: 'metalParts', quantity: 3, roomId: s.site.roomId, cell: copy(s.site.receiving),
    cityOwnerId: 'a', civicCustody: { receiptId: 'prior-delivery', custodianId: 'original-worker' } }];
  return { s, b, office, succession, staff, c, stacks, at: 0 };
}
const begin = f => assert.equal(Seizure.begin(f.s, f.b, f.office, f.c, f.at), true);
function step(f, seconds = 1, effects = {}) {
  f.at += seconds;
  return Seizure.advance(f.s, f.b, f.office, f.c, f.stacks, f.at,
    { person: id => f.staff.find(a => a.id === id), ...effects });
}
function held(f) {
  f.c.defenderCanHear = false; f.c.defenseAvailable = false; f.c.canHold = true; begin(f); step(f);
}
function inspect(f) { assert.equal(Seizure.inspect(f.s, f.c, f.stacks[0], f.at), true); }
test('binds original sovereign counter, people and defender; no stock, property or political grant', () => {
  const f = fixture(), before = copy(f.succession), goods = copy(f.stacks); begin(f);
  assert.equal(f.s.defenderId, f.b.defender.id); assert.deepEqual(f.succession, before); assert.deepEqual(f.stacks, goods);
  assert.equal(f.s.combat.encounter.objective, 'installationSeizure'); assert.equal(f.s.combat.encounter.abdication, 'notRequested');
  assert.equal(Seizure.create(f.succession, f.b, { ...f.office, cityId: 'foreign' }, f.staff, f.s.site), null);
  assert.equal(Seizure.normalize({ ...f.s, inspections: null }), null);
});
test('declaration requires actual original site attendance, free capable body and current source, not a legal order', () => {
  for (const key of ['alive', 'capable', 'local', 'atCounter', 'siteObserved', 'free', 'sourceCurrent']) {
    const f = fixture(); f.c[key] = false; assert.equal(Seizure.begin(f.s, f.b, f.office, f.c, 0), false); assert.equal(f.s.reports.length, 0);
  }
  for (const key of ['otherDefense', 'lawfulControl']) {
    const f = fixture(); f.c[key] = true; assert.equal(Seizure.begin(f.s, f.b, f.office, f.c, 0), false);
  }
});
test('same finite unrestricted pulse survives save/load, can be dodged and does not replenish reserves', () => {
  const f = fixture(); begin(f); step(f, 2); assert.equal(f.b.defender.wardMana, 108);
  const saved = copy(f.s); f.s = Seizure.normalize(f.s); assert.deepEqual(f.s, saved);
  f.c.cell.x++; let damage = 0; step(f, 2, { pulse: n => damage += n }); assert.equal(damage, 0);
  assert.equal(f.b.defender.wardMana, 108);
  assert.deepEqual(Combat.absorb(f.s.combat, f.b, 30), { damage: 6, absorbed: 24 });
  assert.equal(f.b.defender.wardMana, 84); Challenges.prepareDefender(f.b); assert.equal(f.b.defender.wardMana, 84);
  assert.equal(f.succession.control, null);
});
test('absent, unavailable or assigned original defender is never replaced, moved or replenished', () => {
  for (const change of [f => f.c.defenderCanHear = false, f => f.c.defenseAvailable = false,
    f => f.b.defender.assignment = 'wall emergency', f => f.b.defender.status = 'dead', f => f.c.defenderIncapacitated = true]) {
    const f = fixture(); change(f); const d = copy(f.b.defender); begin(f); step(f); assert.deepEqual(f.b.defender, d);
    assert.equal(f.s.combat.phase, 'idle'); assert.equal(f.s.attempt.phase, 'contested');
  }
});
test('staff use actual finite steps; blocked, exhausted, injured and dead bodies are not evacuated by fiat', () => {
  const f = fixture(); begin(f); const a = f.staff[0], cell = copy(a.mapCell), duty = a.workSeconds;
  step(f, 1, { move: () => false }); assert.deepEqual(a.mapCell, cell); assert.equal(a.workSeconds, duty);
  step(f, 2, { move: actor => { actor.mapCell.x--; return true; } });
  assert.equal(a.workSeconds, duty - 1); assert.equal(a.physicalControl.stamina, 79); assert.match(a.locationId, /displaced/);
  const officeStatus = copy(f.succession); a.physicalControl.stamina = 0; step(f, 2); assert.equal(f.s.staff[0].phase, 'stranded');
  assert.deepEqual(f.succession, officeStatus); a.status = 'dead'; step(f); assert.equal(f.s.staff[0].phase, 'dead');
  assert.equal(a.mapCell.x, cell.x - 1);
});
test('possession needs physical access; leave, incapacity, new body or lost source loses it with no garrison', () => {
  for (const change of [f => f.c.inHoldingArea = false, f => f.c.capable = false, f => f.c.bodyEpoch++, f => f.c.sourceCurrent = false,
    f => f.office.civicCounter.roomId = 'different']) {
    const f = fixture(); held(f); assert.equal(f.s.attempt.phase, 'held'); change(f); step(f);
    assert.equal(f.s.attempt.phase, 'lost'); assert.equal(f.s.history.at(-1).phase, 'lost'); assert.equal(f.succession.control, null);
  }
  const f = fixture(); held(f); f.c.canHold = false; step(f); assert.equal(f.s.attempt.phase, 'contested');
});
test('inspection binds one original actual city lot; cannot mint, switch, use foreign, carried or reserved stock', () => {
  const f = fixture(); held(f); inspect(f);
  assert.equal(Seizure.inspect(f.s, f.c, { ...f.stacks[0], id: 'second-lot' }, f.at), false);
  for (const change of [i => i.cityOwnerId = 'b', i => i.quantity = 0, i => i.cell.x++, i => i.roomId = 'lab',
    i => i.reservedTaskId = 'other', i => i.carriedBy = 'scientist', i => i.fixtureId = 'shelf', i => i.key = 'food']) {
    const g = fixture(); held(g); change(g.stacks[0]); assert.equal(Seizure.inspect(g.s, g.c, g.stacks[0], g.at), false);
  }
  f.stacks = []; assert.equal(Seizure.take(f.s, f.c, f.stacks, f.at), false); assert.equal(f.s.receipts.length, 0);
});
test('attended handling reserves exact source, retains partial work through reload and carries one real unit once', () => {
  const f = fixture(); held(f); inspect(f); assert.equal(Seizure.take(f.s, f.c, f.stacks, f.at), true);
  const jobId = f.s.handling.id; let carries = 0;
  const carry = i => { carries++; i.quantity--; i.reservedTaskId = ''; return { id: 'actual-carried-split' }; };
  step(f, 4, { carry }); assert.equal(f.s.handling.progress, 4); assert.equal(carries, 0);
  f.s = Seizure.normalize(f.s); step(f, 5, { carry }); assert.equal(f.s.handling.progress, 9);
  step(f, 1, { carry }); step(f, 50, { carry }); assert.equal(carries, 1); assert.equal(f.stacks[0].quantity, 2);
  assert.equal(f.s.receipts[0].legalOwnerId, 'a'); assert.deepEqual(f.s.receipts[0].originalCustody, f.stacks[0].civicCustody);
  assert.equal(f.s.handling.id, jobId); assert.equal(f.s.handling.status, 'completed');
  assert.equal(Seizure.take(f.s, f.c, f.stacks, f.at), false); // inspection is now stale
});
test('movement, violence, source changes, capacity and competing work interrupt without consuming or refunding stock', () => {
  for (const change of [f => f.c.cell.x++, f => f.c.canHold = false, f => f.c.nearLot = false, f => f.c.carryOk = false,
    f => f.c.free = false, f => f.stacks[0].quantity++, f => f.stacks[0].civicCustody.custodianId = 'other',
    f => Seizure.attack(f.s, f.b, f.c, f.stacks, f.at, f.s.defenderId, 'strike')]) {
    const f = fixture(); held(f); inspect(f); Seizure.take(f.s, f.c, f.stacks, f.at); step(f, 4); change(f);
    const quantity = f.stacks[0].quantity; step(f, 20, { carry: () => assert.fail('interrupted work moved goods') });
    assert.equal(f.s.handling.status, 'interrupted'); assert.equal(f.stacks[0].quantity, quantity); assert.equal(f.stacks[0].reservedTaskId, '');
  }
});
test('late handling has no backfilled time, ceasefire only permits actual withdrawal, witnesses are not guilt', () => {
  const f = fixture(); held(f); inspect(f); f.at += 100; Seizure.take(f.s, f.c, f.stacks, f.at);
  step(f); assert.equal(f.s.handling.progress, 1);
  assert.equal(Seizure.withdraw(f.s, f.b, f.c, f.stacks, f.at), true); assert.equal(f.s.attempt.phase, 'withdrawing');
  step(f); assert.equal(f.s.attempt.phase, 'withdrawing'); f.c.inHoldingArea = false; step(f, 31);
  assert.equal(f.s.attempt.phase, 'withdrawn'); assert.equal(f.s.staff[0].phase, 'home');
  assert.match(f.s.reports[0].finding, /no automatic guilt/); assert.equal(f.succession.control, null);
  const g = fixture(); g.c.witnessIds = []; begin(g); assert.equal(g.s.reports.length, 0);
  assert.equal(Seizure.publicView(g.s, { ...g.c, local: false }, 1), null);
  g.c.defenderObserved = false; assert.doesNotMatch(JSON.stringify(Seizure.publicView(g.s, g.c, 1)), /wardMana|workSeconds|skills|staminaCapacity/);
});
test('standing municipal supply designation is not an active work reservation and is restored on interruption', () => {
  const f = fixture(); held(f); f.stacks[0].reservedTaskId = 'original-city:city-maintenance-reserve';
  f.c.stockReservations = [f.stacks[0].reservedTaskId]; inspect(f);
  assert.equal(Seizure.take(f.s, f.c, f.stacks, f.at), true); step(f, 4); f.c.cell.x++; step(f);
  assert.equal(f.s.handling.status, 'interrupted'); assert.equal(f.stacks[0].reservedTaskId, f.c.stockReservations[0]);
  f.stacks[0].reservedTaskId = 'active-municipal-job';
  assert.equal(Seizure.inspect(f.s, f.c, f.stacks[0], f.at), false);
});
test('lethal pulse freezes subsequent civilians and handling; dead scientist cannot advance or restart', () => {
  const f = fixture(); begin(f); step(f, 2); const person = copy(f.staff[0]); let living = true;
  step(f, 2, { pulse: () => living = false, alive: () => living, move: () => assert.fail('post-death move') });
  assert.deepEqual(f.staff[0], person); f.c.alive = false; const saved = copy(f.s); step(f, 500);
  assert.deepEqual(f.s, saved); assert.equal(Seizure.begin(f.s, f.b, f.office, f.c, f.at), false);
});
