const { test } = require('node:test');
const assert = require('node:assert/strict');
const Challenge = require('../defender-challenges');
const Bargains = require('../sovereign-bargains');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap', collective = false) {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a', active: true, channelPowered: true, power: 10,
    workSeconds: 7200, assignment: null, availableAt: 0, clerk: { id: 'clerk:a', status: 'alive', health: 100, locationId: 'office:a' } };
  const source = { cityId: 'a', charterId: 'charter:a', authority: { id: 'sovereign:a', name: 'Aster Authority', kind: collective ? 'collective' : 'individual' },
    administrationId: office.institutionId, defenseId: 'defense:a', defenseName: 'Aster Defense', archive: { coverage: [{ cellId: 'cell:a' }] } };
  const b = Bargains.create(source, office, { theme, seed: 'challenge-test' });
  const c = { alive: true, capable: true, cityId: 'a', atCounter: true, clerkPresent: true, lineOfSight: true, visitPermission: true,
    authorityId: 'sovereign:a', administrationAvailable: true, defenseAvailable: true, participantsPresent: true,
    busy: false, otherBusy: false, bodyEpoch: 0, health: 100, cell: { x: 17, y: 8, z: 6 }, groundAvailable: true,
    witnessPresent: true, defenderPresent: true, distanceM: 2, lineOfEffect: true };
  return { b, office, c, s: Challenge.create(b, theme, 'challenge-test') };
}
function prepare(f) {
  assert.equal(Challenge.request(f.s, f.b, f.office, f.c, 0), true);
  assert.equal(Challenge.accept(f.s, f.b, f.office, copy(f.s.terms), f.c, 1), true);
  Challenge.advance(f.s, f.b, f.office, f.c, 301);
  assert.equal(f.s.phase, 'outward');
}
function ready(f) {
  prepare(f);
  // Unit movement stub makes one neighboring step per tick; browser tests use navigation.
  const move = (a, goal) => { const p = a.mapCell; a.mapCell = { x: p.x + Math.sign(goal.x - p.x), y: p.y + Math.sign(goal.y - p.y), z: goal.z }; return true; };
  for (let at = 302; at <= 312; at++) Challenge.advance(f.s, f.b, f.office, f.c, at, { move });
  assert.equal(f.s.phase, 'ready'); f.c.cell = copy(Challenge.START); f.c.atCounter = false;
  assert.equal(Challenge.start(f.s, f.b, f.c, 313), true);
}
test('all themes sanction only a limited demonstration with the same allocated defender, including collective representation', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme, true), id = f.b.defender.id;
    assert.equal(f.s.sourceTheme, 'shared'); assert.equal(Challenge.request(f.s, f.b, f.office, f.c, 0), true);
    assert.equal(f.s.terms.defenderId, id); assert.equal(f.b.allocation.people, 2); assert.equal(f.b.source.authority.kind, 'collective');
    assert.equal(f.b.defender.actorKind, 'cityDefender'); assert.equal(f.b.defender.health, 100);
    assert.match(f.s.terms.limitations, /No command/); assert.equal(f.b.copies.length, 0);
    f.b.defender.wardMana = 10; Challenge.create(f.b, theme, 'again'); assert.equal(f.b.defender.wardMana, 10);
  }
  assert.equal(Challenge.create(null), null); assert.equal(Challenge.normalize(null), null);
});
test('request refusal preserves civic services; wounds, appointments, ground, energy and authority matter', () => {
  for (const key of ['alive', 'capable', 'atCounter', 'clerkPresent', 'lineOfSight', 'visitPermission', 'administrationAvailable', 'defenseAvailable', 'participantsPresent', 'groundAvailable']) {
    const f = fixture(); assert.equal(Challenge.request(f.s, f.b, f.office, { ...f.c, [key]: false }, 0), false); assert.equal(f.s.phase, 'idle');
    assert.equal(f.office.power, 10); assert.equal(f.b.audience, null);
  }
  for (const mutate of [f => f.office.assignment = 'map-copy', f => f.b.defender.assignment = 'wall-duty', f => f.b.defender.health = 79,
    f => f.b.defender.wardMana = 23, f => f.b.representative.workSeconds = 419, f => f.c.health = 69, f => f.c.authorityId = 'other']) {
    const f = fixture(); mutate(f); assert.equal(Challenge.request(f.s, f.b, f.office, f.c, 0), false);
  }
});
test('exact terms and body bind acceptance; attended finite preparation survives save, pauses outages without backfill and excludes audience jobs', () => {
  const f = fixture(); Challenge.request(f.s, f.b, f.office, f.c, 0);
  assert.equal(Challenge.accept(f.s, f.b, f.office, { ...f.s.terms, durationSeconds: 1 }, f.c, 1), false);
  assert.equal(Challenge.accept(f.s, f.b, f.office, copy(f.s.terms), { ...f.c, bodyEpoch: 1 }, 1), false);
  assert.equal(Challenge.accept(f.s, f.b, f.office, copy(f.s.terms), f.c, 3600), false);
  assert.equal(Challenge.accept(f.s, f.b, f.office, copy(f.s.terms), f.c, 1), true);
  assert.match(Bargains.localReason(f.b, f.office, f.c), /allocated/);
  Challenge.advance(f.s, f.b, f.office, f.c, 151); assert.equal(f.s.job.progress, 150);
  f.s = Challenge.normalize(f.s); f.b = Bargains.normalize(f.b);
  f.office.channelPowered = false; Challenge.advance(f.s, f.b, f.office, f.c, 251);
  assert.equal(f.s.job.progress, 150); assert.equal(f.office.assignment, null);
  f.office.channelPowered = true; Challenge.advance(f.s, f.b, f.office, f.c, 351); assert.equal(f.s.job.progress, 150);
  Challenge.advance(f.s, f.b, f.office, f.c, 501); assert.equal(f.s.phase, 'outward');
  assert.equal(f.office.workSeconds, 6900); assert.equal(f.office.power, 9); assert.equal(f.b.defender.workSeconds, 3300);
});
test('preparation interruption spends resources, releases original people and does not replenish anything', () => {
  const f = fixture(); Challenge.request(f.s, f.b, f.office, f.c, 0); Challenge.accept(f.s, f.b, f.office, copy(f.s.terms), f.c, 1);
  Challenge.advance(f.s, f.b, f.office, f.c, 101); Challenge.advance(f.s, f.b, f.office, { ...f.c, atCounter: false }, 201);
  assert.equal(f.s.phase, 'declined'); assert.equal(f.office.workSeconds, 7100); assert.equal(f.office.power, 9);
  assert.equal(f.b.defender.assignment, null); assert.equal(f.office.assignment, null); assert.equal(f.s.receipt, null);
  assert.equal(Bargains.localReason(f.b, f.office, f.c), '');
});
test('movement has no teleport, supervision and real positions gate combat, personal projection consumes finite mana', () => {
  const f = fixture(); prepare(f); const cells = copy([f.b.defender.mapCell, f.b.representative.mapCell]);
  Challenge.advance(f.s, f.b, f.office, f.c, 302, { move: () => false });
  assert.deepEqual([f.b.defender.mapCell, f.b.representative.mapCell], cells); assert.equal(f.s.phase, 'outward');
  const g = fixture(); ready(g);
  assert.equal(Challenge.authorized(g.s, g.b, g.c, 'soulLash', 314), true);
  assert.equal(Challenge.authorized(g.s, g.b, { ...g.c, witnessPresent: false }, 'soulLash', 314), false);
  assert.equal(Challenge.authorized(g.s, g.b, { ...g.c, bodyEpoch: 1 }, 'strike', 314), false);
  assert.equal(Challenge.authorized(g.s, g.b, g.c, 'shove', 314), false);
  assert.deepEqual(Challenge.absorb(g.s, g.b, 14), { damage: 2, absorbed: 12 }); assert.equal(g.b.defender.wardMana, 96);
  g.b.defender.wardMana = 3; assert.deepEqual(Challenge.absorb(g.s, g.b, 14), { damage: 13, absorbed: 1 });
  assert.equal(g.b.defender.wardMana, 1); assert.equal(g.b.defender.health, 100);
});
test('force pulse commits energy before release, saved target can be dodged and no pulse crosses blocked line or range', () => {
  const f = fixture(); ready(f); const hits = [];
  Challenge.advance(f.s, f.b, f.office, f.c, 316, { pulse: n => hits.push(n) });
  assert.equal(f.b.defender.wardMana, 112); assert.equal(f.s.pendingPulse.releaseAt, 318);
  f.s = Challenge.normalize(f.s); f.c.cell = { ...f.c.cell, y: f.c.cell.y + 1 };
  Challenge.advance(f.s, f.b, f.office, f.c, 318, { pulse: n => hits.push(n) }); assert.deepEqual(hits, []);
  Challenge.advance(f.s, f.b, f.office, f.c, 324); Challenge.advance(f.s, f.b, f.office, { ...f.c, lineOfEffect: false }, 326, { pulse: n => hits.push(n) });
  assert.deepEqual(hits, []);
  Challenge.advance(f.s, f.b, f.office, f.c, 332); Challenge.advance(f.s, f.b, f.office, f.c, 334, { pulse: n => hits.push(n) });
  assert.deepEqual(hits, [6]); assert.equal(f.b.defender.wardMana, 96);
});
test('actual injury or loss of supervision ends the bout; no artificial health floor or physician is supplied', () => {
  for (const [extra, outcome] of [[{ health: 80 }, 'scientistStopped'], [{ cell: { x: 9, y: 12, z: 6 } }, 'withdrawn'], [{ witnessPresent: false }, 'withdrawn'], [{ bodyEpoch: 1 }, 'interrupted']]) {
    const f = fixture(); ready(f); Challenge.advance(f.s, f.b, f.office, { ...f.c, ...extra }, 314);
    assert.equal(f.s.receipt.outcome, outcome); assert.equal(f.s.phase, 'returning'); assert.equal(f.s.petition, null);
    assert.equal(Challenge.authorized(f.s, f.b, f.c, 'strike', 314), false);
  }
  const f = fixture(); ready(f); f.b.defender.health = 0; f.b.defender.status = 'dead';
  Challenge.advance(f.s, f.b, f.office, f.c, 314); assert.equal(f.b.defender.health, 0); assert.equal(f.s.receipt.outcome, 'interrupted');
});
test('witnessed concession is one dated receipt; finite physical return and attended petition never grant rule', () => {
  const f = fixture(); ready(f); f.b.defender.health = 75;
  Challenge.advance(f.s, f.b, f.office, f.c, 314); const receipt = copy(f.s.receipt);
  assert.equal(receipt.outcome, 'defenderConceded'); assert.equal(receipt.witnessed, true);
  assert.equal(Challenge.filePetition(f.s, f.b, f.office, f.c, 314), false);
  const move = (a, goal) => { a.mapCell = { x: a.mapCell.x + Math.sign(goal.x - a.mapCell.x), y: a.mapCell.y + Math.sign(goal.y - a.mapCell.y), z: goal.z }; return true; };
  for (let at = 315; at <= 330; at++) Challenge.advance(f.s, f.b, f.office, f.c, at, { move });
  assert.equal(f.s.phase, 'closed'); assert.equal(f.b.defender.assignment, null); assert.equal(f.b.defender.health, 75);
  f.c.atCounter = true; f.c.cell = { x: 17, y: 8, z: 6 };
  assert.equal(Challenge.filePetition(f.s, f.b, f.office, f.c, 331), true);
  Challenge.advance(f.s, f.b, f.office, f.c, 391);
  assert.equal(f.s.petition.status, 'filedNotAccepted'); assert.deepEqual(f.s.receipt, receipt);
  assert.equal(Challenge.filePetition(f.s, f.b, f.office, f.c, 392), false); assert.equal(Challenge.request(f.s, f.b, f.office, f.c, 392), false);
  assert.equal(f.office.power, 8); assert.equal(f.office.workSeconds, 6840);
});
test('missed attendance and time limits are not conquest; public projection hides private actor totals and death freezes all work', () => {
  const f = fixture(); ready(f); const before = copy(f.s);
  assert.equal(Challenge.advance(f.s, f.b, f.office, { ...f.c, alive: false }, 100000), false); assert.deepEqual(f.s, before);
  const view = Challenge.publicView(f.s); assert.doesNotMatch(JSON.stringify(view), /wardMana|workSeconds|skills|populationSource/);
  const work = f.b.defender.workSeconds;
  Challenge.advance(f.s, f.b, f.office, f.c, f.s.bout.endsAt); assert.equal(f.s.receipt.outcome, 'timeLimit');
  assert.equal(f.b.defender.workSeconds, work - Challenge.BOUT_SECONDS);
  const g = fixture(); prepare(g); g.s.phase = 'ready'; g.s.readyUntil = 400;
  Challenge.advance(g.s, g.b, g.office, g.c, 400); assert.equal(g.s.receipt.outcome, 'missed'); assert.equal(g.s.receipt.witnessed, false);
});
test('a coarse time-limit advance cannot certify supervision past the original finite work allocation', () => {
  const f = fixture(); ready(f); f.b.representative.workSeconds = 1;
  Challenge.advance(f.s, f.b, f.office, f.c, f.s.bout.endsAt);
  assert.equal(f.s.receipt.outcome, 'interrupted'); assert.equal(f.b.representative.workSeconds, 0);
  assert.equal(f.s.petition, null);
});
