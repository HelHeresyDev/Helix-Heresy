const { test } = require('node:test');
const assert = require('node:assert/strict');
const Settlement = require('../campaign-settlement');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(treasury = 10000) {
  const p = (x, y, z = 25) => ({ x, y, z });
  const source = { cityId: 'b', charterId: 'charter:b', administrationId: 'admin:b', defenseId: 'defense:b', populationSourceId: 'people:b', authority: { id: 'sovereign:b' } };
  const g = { clerk: { id: 'clerk:b', status: 'alive', health: 100, mapCell: p(10, 6) }, receptionWorkSeconds: 5000, powerSeconds: 5000,
    foreignCivic: { bargain: { source, representative: { id: 'rep:b', status: 'alive', health: 100, workSeconds: 5000, roomId: 'checkpoint', mapCell: p(9, 8) },
      defender: { id: 'defender:b', status: 'dead', health: 0 }, depot: { id: 'depot:b', stock: 0 } } } };
  const o = { id: 'original-ward:b', worldId: 'world', runId: 'run', source, depotId: 'depot:b', phase: 'held',
    layout: { receiving: p(10, 14), entry: p(6, 16), linkMeters: 20 }, hostileUntil: 30, pendingPulse: null };
  const s = Settlement.create(o, g, 0), market = { id: 'b', treasury }, economy = { money: 100 };
  const c = { worldId: 'world', runId: 'run', civicSource: copy(source), authorityCurrent: true, alive: true, capable: true, free: true,
    local: true, busy: false, atBoth: true, clearAccess: true, need: 'depot:b:unfilled:6', canRestore: false, unsafe: false,
    channel: true, conflictingWork: false, representativeIncapacitated: false, bodyEpoch: 0, reportContact: true,
    departureObserved: false, withdrawalReceiptId: 'original-return' };
  const context = () => ({ ...c, held: o.phase === 'held', obstructed: o.phase === 'held',
    meeting: JSON.stringify(g.foreignCivic.bargain.representative.mapCell) === JSON.stringify(s.meeting), attendance: c.local,
    channel: c.channel && !s.witnessAtStaging, withdrawalWitness: Boolean(c.staged && s.witnessAtStaging) });
  const events = { steps: 0, links: [] };
  const hooks = { accepted: () => { o.phase = 'lost'; }, move: (a, goal) => {
    if (c.blocked) return false;
    a.mapCell = { ...a.mapCell, x: a.mapCell.x + Math.sign(goal.x - a.mapCell.x), y: a.mapCell.y + Math.sign(goal.y - a.mapCell.y) };
    events.steps++; return true;
  }, crossLink: (a, outward) => {
    if (c.blockedLink) return false;
    events.links.push(outward); a.mapCell = outward ? p(100, 100, 8) : copy(s.watching); a.roomId = outward ? 'stage' : 'front'; return true;
  } };
  const f = { o, g, s, market, economy, c, context, hooks, events };
  f.tick = to => Settlement.advance(f.s, o, g, market, economy, to, context, hooks);
  return f;
}
function offer(f) { assert.equal(Settlement.request(f.s, f.o, f.g, f.market, f.context(), 0), true); f.tick(130); assert.equal(f.s.phase, 'offered'); }
function accept(f) { offer(f); assert.equal(Settlement.accept(f.s, f.o, f.g, f.market, f.context(), copy(f.s.offer), 130), true); f.tick(190); assert.equal(f.s.phase, 'active'); }
function withdraw(f) {
  f.tick(200); f.c.departureObserved = true; f.c.local = false; f.c.reportContact = false; f.c.staged = true;
  f.tick(222); f.c.departureObserved = false;
}
test('original sovereign, representative, clerk and depot identities are required; defender attendance is not', () => {
  const f = fixture(), b = copy(f.g.foreignCivic.bargain); assert.ok(f.s); assert.deepEqual(f.g.foreignCivic.bargain, b);
  assert.equal(Settlement.create(f.o, { foreignCivic: { bargain: {} } }, 0), null);
  assert.equal(Settlement.create({ ...f.o, depotId: 'other' }, f.g, 0), null);
  offer(f); assert.equal(f.s.mandate.authorityId, b.source.authority.id); assert.equal(f.s.mandate.representativeId, b.representative.id);
  assert.equal(f.s.offer.amount, 250); assert.equal(f.g.foreignCivic.bargain.defender.status, 'dead'); assert.equal(f.market.treasury, 10000);
  assert.equal(f.s.paid, 0); assert.equal(f.s.terms, null);
});
test('no unused-marker leverage, automatic capitulation, unsafe parley, private treasury or foreign run', () => {
  for (const change of ['need', 'canRestore', 'unsafe', 'authorityCurrent', 'worldId', 'channel', 'capable', 'free']) {
    const f = fixture(); f.c[change] = change === 'worldId' ? 'other' : ['canRestore', 'unsafe'].includes(change);
    assert.equal(Settlement.request(f.s, f.o, f.g, f.market, f.context(), 0), false, change); assert.equal(f.economy.money, 100);
  }
  const f = fixture(); f.market.id = 'private-factory'; assert.equal(Settlement.request(f.s, f.o, f.g, f.market, f.context(), 0), false);
  f.market.id = 'b'; f.g.foreignCivic.bargain.representative.assignment = 'prior-duty';
  assert.equal(Settlement.request(f.s, f.o, f.g, f.market, f.context(), 0), false);
});
test('real movement precedes finite attended mandate; blocked routes create no teleport or consent', () => {
  const f = fixture(); f.c.blocked = true; const home = copy(f.g.foreignCivic.bargain.representative.mapCell);
  assert.ok(Settlement.request(f.s, f.o, f.g, f.market, f.context(), 0)); f.tick(50);
  assert.deepEqual(f.g.foreignCivic.bargain.representative.mapCell, home); assert.equal(f.s.job.progress, 0); assert.equal(f.s.mandate, null);
  f.c.blocked = false; f.tick(180); assert.equal(f.s.phase, 'offered'); assert.ok(f.events.steps > 0);
  assert.equal(f.g.powerSeconds, 4880); assert.equal(f.g.receptionWorkSeconds, 4880);
});
test('offers counter down to genuinely spare cash while preserving prior allocations and protected operating funds', () => {
  const f = fixture(1123); offer(f); assert.equal(f.s.offer.amount, 122);
  assert.ok(Settlement.accept(f.s, f.o, f.g, f.market, f.context(), copy(f.s.offer), 130)); f.tick(190);
  assert.equal(f.market.treasury, 1001); assert.equal(f.s.heldFunds, 61); assert.equal(f.economy.money, 161);
  const poor = fixture(1001); assert.equal(Settlement.request(poor.s, poor.o, poor.g, poor.market, poor.context(), 0), false);
});
test('only exact current offer commits once; signed reserve and upfront debit conserve money', () => {
  const f = fixture(); offer(f); const bad = { ...f.s.offer, amount: 500 };
  assert.equal(Settlement.accept(f.s, f.o, f.g, f.market, f.context(), bad, 130), false);
  assert.ok(Settlement.accept(f.s, f.o, f.g, f.market, f.context(), copy(f.s.offer), 130)); f.tick(190);
  assert.equal(f.market.treasury, 9750); assert.equal(f.economy.money, 225); assert.equal(f.s.heldFunds, 125);
  assert.equal(f.market.treasury + f.economy.money + f.s.heldFunds, 10100);
  assert.equal(Settlement.accept(f.s, f.o, f.g, f.market, f.context(), f.s.offer, 190), false); assert.equal(f.o.phase, 'lost');
});
test('unsigned interruption spends work but neither money nor consent; unchanged completed refusals cannot reroll', () => {
  const f = fixture(); assert.ok(Settlement.request(f.s, f.o, f.g, f.market, f.context(), 0)); f.tick(30);
  f.c.channel = false; f.tick(31); assert.equal(f.s.phase, 'interrupted'); assert.equal(f.s.terms, null); assert.equal(f.economy.money, 100);
  f.c.channel = true; f.tick(50); assert.equal(f.s.returnPending, false);
  f.s.phase = 'refused';
  assert.equal(Settlement.request(f.s, f.o, f.g, f.market, f.context(), 50), false);
  assert.equal(f.g.powerSeconds < 5000, true);
});
test('withdrawal requires paid measured witness travel, real receipt, clear access and return to original powered clerk', () => {
  const f = fixture(); accept(f); f.tick(200); f.c.departureObserved = true; f.c.local = false; f.c.reportContact = false;
  f.tick(210); assert.equal(f.events.links.length, 0); assert.equal(f.s.paid, 125);
  f.c.staged = true; f.tick(222); assert.deepEqual(f.events.links, [true]); assert.ok(f.s.terms.withdrawnAt);
  assert.equal(f.s.paid, 125); assert.equal(f.s.heldFunds, 125); // The witness is outside, not at a remote magic desk.
  f.c.departureObserved = false; f.tick(260); assert.deepEqual(f.events.links, [true, false]); assert.equal(f.s.paid, 250);
  assert.equal(f.economy.money, 350); assert.equal(f.s.heldFunds, 0); assert.equal(f.g.foreignCivic.bargain.representative.assignment, null);
  assert.equal(f.s.history.filter(r => r.kind === 'payment').length, 1); assert.equal(f.market.treasury + f.economy.money, 10100);
});
test('departing unseen or failing to await the actual witness earns no remote completion', () => {
  const f = fixture(); accept(f); f.c.local = false; f.c.reportContact = false; f.c.staged = true; f.tick(250);
  assert.equal(f.s.terms.withdrawnAt, null); assert.equal(f.s.paid, 125); assert.deepEqual(f.events.links, []);
});
test('blocked witness entry and exhausted original duty preserve partial link and location across saves', () => {
  const f = fixture(); accept(f); f.tick(200); f.c.departureObserved = true; f.c.blockedLink = true; f.c.local = false;
  f.tick(225); assert.equal(f.s.witnessTravel.progress, 20); assert.equal(f.s.witnessAtStaging, false); assert.equal(f.events.links.length, 0);
  const duty = f.g.foreignCivic.bargain.representative.workSeconds; f.tick(230); assert.equal(f.g.foreignCivic.bargain.representative.workSeconds, duty);
  f.c.blockedLink = false; f.tick(231); assert.equal(f.s.witnessAtStaging, true);
});
test('breach before withdrawal refunds only the unearned city-held balance and never claws back paid property', () => {
  const f = fixture(); accept(f); Settlement.aggression(f.s, f.g, f.market, 191);
  assert.equal(f.s.phase, 'breached'); assert.equal(f.market.treasury, 9875); assert.equal(f.economy.money, 225); assert.equal(f.s.heldFunds, 0);
  Settlement.aggression(f.s, f.g, f.market, 192); assert.equal(f.market.treasury, 9875); assert.equal(Settlement.truce(f.s, 192), false);
});
test('earned balance survives later breach and channel outage without double payment or invented funds', () => {
  const f = fixture(); accept(f); withdraw(f); f.c.channel = false;
  Settlement.aggression(f.s, f.g, f.market, 223); f.tick(260); assert.equal(f.s.heldFunds, 125); assert.equal(f.s.paid, 125);
  f.c.channel = true; f.tick(261); assert.equal(f.s.paid, 250); assert.equal(f.s.phase, 'breached'); f.tick(300); assert.equal(f.economy.money, 350);
});
test('loss of original authority or treasury cannot sign or discharge a different sovereign obligation', () => {
  const f = fixture(); offer(f); f.c.civicSource.authority.id = 'usurper';
  assert.equal(Settlement.accept(f.s, f.o, f.g, f.market, f.context(), f.s.offer, 130), false); f.tick(131); assert.equal(f.s.phase, 'expired');
  const b = fixture(); accept(b); withdraw(b); b.c.authorityCurrent = false; b.tick(260); assert.equal(b.s.heldFunds, 125);
});
test('received statements stay dated away and contain no private treasury, personnel reserves or hidden defensive roster', () => {
  const f = fixture(); accept(f); const report = copy(f.s.report); f.c.reportContact = false; withdraw(f); f.tick(260);
  assert.deepEqual(f.s.report, report); assert.doesNotMatch(JSON.stringify(report), /"(?:treasury|workSeconds|stamina|wardMana|defenderId)":/);
});
test('real 24-hour completion is bounded, while failure to withdraw expires without automatic surrender or a second payment', () => {
  const f = fixture(); accept(f); withdraw(f); f.tick(260); f.tick(f.s.terms.endsAt);
  assert.equal(f.s.phase, 'honored'); assert.equal(f.s.paid, 250); assert.equal(f.s.sovereignty, undefined); assert.equal(f.s.domination, undefined);
  const b = fixture(); accept(b); b.tick(b.s.terms.endsAt); assert.equal(b.s.phase, 'unperformed'); assert.equal(b.economy.money, 225); assert.equal(b.market.treasury, 9875);
});
test('death freezes exactly; supported body recovery cancels unsigned work and does not inherit withdrawal', () => {
  const f = fixture(); accept(f); f.tick(200); const frozen = copy(f.s); f.c.alive = false; f.tick(250); assert.deepEqual(f.s, frozen);
  Settlement.bodyEnded(f.s, f.g, f.market, 200); assert.equal(f.s.phase, 'unperformed'); assert.equal(f.s.paid, 125); assert.equal(f.s.heldFunds, 0);
  f.c.alive = true; f.c.bodyEpoch++; f.tick(201); assert.equal(f.s.terms.withdrawnAt, null);
});
test('fractional and coarse advancement with saved partial parley have the same finite result', () => {
  const a = fixture(), b = fixture();
  for (const f of [a, b]) assert.ok(Settlement.request(f.s, f.o, f.g, f.market, f.context(), 0));
  a.tick(130); for (let n = 1; n <= 260; n++) b.tick(n / 2);
  assert.deepEqual(b.s, a.s); assert.deepEqual(b.g, a.g);
  const saved = Settlement.normalize(copy(a.s)); assert.deepEqual(saved, a.s); assert.equal(fixture().s.terms, null);
});
test('continued copies rebind only their own run without duplicating the original funds or authority', () => {
  const f = fixture(); accept(f);
  const rebound = Settlement.rebind(f.s, { worldId: 'world', runId: 'run' }, { worldId: 'copy-world', runId: 'copy-run' });
  assert.equal(rebound.runId, 'copy-run'); assert.equal(rebound.worldId, 'copy-world'); assert.equal(rebound.heldFunds, 125);
  assert.equal(f.s.runId, 'run'); assert.equal(Settlement.rebind(f.s, { worldId: 'world', runId: 'other' }, { worldId: 'world', runId: 'copy' }), null);
  assert.equal(Settlement.normalize({ ...f.s, heldFunds: -1 }), null);
});
test('saved partial witness travel retains progress and spends each original duty second exactly once', () => {
  const a = fixture(), b = fixture(); for (const f of [a, b]) { accept(f); f.tick(200); f.c.departureObserved = true; f.c.local = false; f.c.staged = true; }
  a.tick(260);
  for (let at = 201; at <= 260; at++) { Object.assign(b.s, Settlement.normalize(copy(b.s))); b.tick(at); }
  assert.deepEqual(a.s, b.s); assert.deepEqual(a.g, b.g); assert.deepEqual(a.economy, b.economy); assert.deepEqual(a.events, b.events);
});
test('depleted duty, real receiving obstruction and expired offers never complete unsigned acceptance or withdrawal', () => {
  const f = fixture(); offer(f); assert.equal(Settlement.accept(f.s, f.o, f.g, f.market, f.context(), f.s.offer, f.s.offer.expiresAt), false);
  const b = fixture(); accept(b); b.tick(200); b.g.foreignCivic.bargain.representative.workSeconds = 0;
  b.c.departureObserved = true; b.c.staged = true; b.tick(250); assert.equal(b.s.witnessTravel, null); assert.equal(b.s.paid, 125);
  const blocked = fixture(); accept(blocked); blocked.c.clearAccess = false; withdraw(blocked);
  assert.equal(blocked.s.terms.withdrawnAt, null); assert.equal(blocked.s.paid, 125);
});
test('actual competing expenditure during signature cannot overdraw the city or create a private-property substitute', () => {
  const f = fixture(); offer(f); assert.ok(Settlement.accept(f.s, f.o, f.g, f.market, f.context(), f.s.offer, 130));
  f.tick(160); f.market.treasury = 1100; f.tick(190);
  assert.equal(f.s.phase, 'refused'); assert.equal(f.economy.money, 100); assert.equal(f.s.heldFunds, 0); assert.equal(f.market.treasury, 1100);
});
test('a recovered body inherits neither an unwitnessed journey nor erasure of an already exercised obligation window', () => {
  const f = fixture(); accept(f); withdraw(f); f.tick(260); f.c.bodyEpoch++;
  Settlement.bodyEnded(f.s, f.g, f.market, 260); f.tick(f.s.terms.endsAt);
  assert.equal(f.s.phase, 'honored'); assert.equal(f.s.paid, 250); assert.equal(f.economy.money, 350);
});
