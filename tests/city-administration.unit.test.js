const { test } = require('node:test');
const assert = require('node:assert/strict');
const Administration = require('../city-administration');
const Identity = require('../scientist-identity');
const Registry = require('../carrier-identity');
const Maps = require('../municipal-maps');
const Discovery = require('../local-discovery');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap') {
  const market = { homeId: 'a' };
  Registry.provision(market, { institutionId: 'admin:a', cityId: 'a', name: 'Actual registry', active: true, localDistanceKm: 2 }, 0);
  const office = market.identityOffices[0]; office.civicCounter = { cell: { x: 17, y: 8, z: 6 } }; office.clerk.mapCell = { x: 18, y: 8, z: 6 };
  const person = (id, cell) => ({ id, name: id, status: 'alive', health: 74, fatigue: 3, mapCell: copy(cell), locationId: office.id,
    roomId: 'supportedSurveyGround', workSeconds: 500, assignment: null });
  const actor = { ...person('works:a', { x: 16, y: 12, z: 6 }), roles: ['publicWorksAndProvisioning', 'centralAdministration'] };
  const b = { officeId: office.id, representative: person('rep:a', { x: 18, y: 9, z: 6 }),
    defender: { ...person('defender:a', { x: 19, y: 9, z: 6 }), wardMana: 4 } };
  const succession = { id: 'succession:a', officeId: office.id, source: { cityId: 'a', charterId: 'charter:a' },
    handover: { id: 'handover:a', at: 0 }, control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0 },
    leaders: [actor], agreements: [{ personId: actor.id }], provision: { stock: 15, receipts: [{ id: 'original-reserve', quantity: 18 }] } };
  const s = Administration.create(succession, b, office, { theme });
  const c = { alive: true, capable: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true,
    workerPresent: true, receiverPresent: true, busy: false, cityId: 'a', bodyEpoch: 0, charterCurrent: true,
    administrationAvailable: true, publicWorksAvailable: true, geometryAvailable: true, externalPowered: true,
    staffPresentIds: Administration.staff(succession, b, office).map(a => a.id) };
  const stacks = [{ id: 'staged:a', key: 'metalParts', quantity: 3, knownQuantity: 3, cityOwnerId: 'a', civicCustody: { cityId: 'a', quantity: 3 },
    reservedTaskId: 'succession:a:city-maintenance-reserve', carriedBy: '', cell: copy(Administration.RECEIVING) }];
  return { s, succession, b, office, c, actor, stacks, at: 0 };
}
const item = (key, quantity, extra = {}) => ({ id: `${key}:carried`, key, quantity, knownQuantity: quantity, carriedBy: 'scientist', ...extra });
const move = (a, target) => { for (const key of ['x', 'y', 'z']) if (a.mapCell[key] !== target[key]) {
  a.mapCell[key] += Math.sign(target[key] - a.mapCell[key]); return true;
} return false; };
function step(f, seconds, effects = {}) { f.at += seconds; return Administration.advance(f.s, f.succession, f.b, f.office, f.stacks, f.c, f.at, { move, ...effects }); }
function inspect(f) { assert.equal(Administration.inspect(f.s, f.succession, f.office, f.c, f.at), true); return copy(f.s.inspection); }
function order(f) { assert.equal(Administration.order(f.s, f.succession, f.b, f.office, f.stacks, inspect(f), f.c, f.at), true); }
test('upkeep binds an existing handed-over counter and original officeholder without awarding goods, power, people or a new installation', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme), before = copy({ b: f.b, succession: f.succession, office: f.office });
    assert.equal(f.s.sourceTheme, 'shared'); assert.equal(f.s.installation.id, `${f.office.id}:service-channel`);
    assert.equal(f.s.workerId, f.actor.id); assert.equal(f.s.dueAt, 86400); assert.equal(f.s.graceUntil, 115200);
    assert.deepEqual({ b: f.b, succession: f.succession, office: f.office }, before);
    assert.equal(Administration.create({ ...f.succession, handover: null }, f.b, f.office), null);
    assert.equal(Administration.create(f.succession, f.b, { ...f.office, civicCounter: null }), null);
    assert.equal(Administration.create(f.succession, f.b, { ...f.office, clerk: null }), null);
    assert.equal(Administration.create({ ...f.succession, agreements: [] }, f.b, f.office), null);
  }
});
test('exact personally inspected requirements, source bindings, attendance and finite work are required; no remote orders', () => {
  const f = fixture(), terms = inspect(f);
  assert.equal(Administration.order(f.s, f.succession, f.b, f.office, f.stacks, { ...terms, parts: 0 }, f.c, f.at), false);
  for (const key of ['alive', 'capable', 'atCounter', 'visitPermission', 'clerkPresent', 'lineOfSight', 'workerPresent', 'charterCurrent',
    'administrationAvailable', 'publicWorksAvailable', 'geometryAvailable', 'externalPowered']) {
    assert.equal(Administration.order(f.s, f.succession, f.b, f.office, f.stacks, terms, { ...f.c, [key]: false }, f.at), false, key);
  }
  assert.equal(Administration.order(f.s, f.succession, f.b, f.office, f.stacks, terms, { ...f.c, bodyEpoch: 1 }, f.at), false);
  f.actor.workSeconds = 179;
  assert.equal(Administration.order(f.s, f.succession, f.b, f.office, f.stacks, terms, f.c, f.at), false);
  assert.equal(f.stacks[0].quantity, 3); assert.equal(f.office.power, 12);
});
test('real staged parts are collected, carried, installed exactly once through physical work and preserved across reload', () => {
  const f = fixture(); order(f);
  assert.equal(f.stacks[0].quantity, 3); assert.equal(f.succession.provision.stock, 15); assert.equal(f.s.job.cargo, null);
  step(f, 1); assert.equal(f.stacks[0].quantity, 0); assert.equal(f.s.job.cargo.quantity, 3); assert.equal(f.s.servicedAt, null);
  f.s = Administration.normalize(f.s); const health = f.actor.health, energy = f.b.defender.wardMana;
  step(f, 122); assert.equal(f.s.job.progress, 119); assert.equal(f.s.servicedAt, null);
  step(f, 1); assert.equal(f.s.job, null); assert.equal(f.s.servicedAt, 124); assert.equal(f.s.receipts.length, 1);
  assert.equal(f.s.receipts[0].manifest.quantity, 3); assert.equal(f.actor.health, health); assert.equal(f.b.defender.wardMana, energy);
  assert.equal(f.office.power, 11); assert.equal(f.succession.provision.stock, 15);
  const receipt = copy(f.s.receipts); step(f, 100); assert.deepEqual(f.s.receipts, receipt);
  assert.equal(Administration.order(f.s, f.succession, f.b, f.office, f.stacks, inspect(f), f.c, f.at), false);
});
test('an already authorized supplied job continues away without live knowledge or new remote authority', () => {
  const f = fixture(); order(f); f.c.atCounter = false; f.c.cityId = null; f.c.workerPresent = false; f.c.visitPermission = false;
  assert.equal(Administration.inspect(f.s, f.succession, f.office, f.c, 1), false);
  step(f, 1000); assert.equal(f.s.servicedAt, 124); assert.equal(f.s.job, null);
  assert.equal(f.s.inspection, null); assert.equal(f.actor.assignment, null);
});
test('fractional live ticks retain walking credit across saves and produce the same physical result as a coarse advance', () => {
  const fine = fixture(), coarse = fixture(); order(fine); order(coarse);
  for (let i = 0; i < 1240; i++) { step(fine, .1); if (i === 24) fine.s = Administration.normalize(fine.s); }
  step(coarse, 124);
  assert.equal(fine.s.job, null); assert.ok(Math.abs(fine.s.servicedAt - coarse.s.servicedAt) < 1e-8);
  assert.ok(Math.abs(fine.actor.workSeconds - coarse.actor.workSeconds) < 1e-8);
  assert.deepEqual(fine.actor.mapCell, coarse.actor.mapCell); assert.equal(fine.s.receipts.length, 1);
});
test('an exhausted worker can take supplied recovery without losing cargo, backfilling work or refunding parts', () => {
  const f = fixture(); order(f); step(f, 1); f.actor.workSeconds = 0; f.stacks.push(item('fieldRation', 1));
  const cargo = copy(f.s.job.cargo), jobId = f.s.job.id;
  assert.equal(Administration.rest(f.s, f.succession, f.b, f.office, f.stacks, f.actor.id, f.c, f.at), true);
  assert.equal(Administration.inspect(f.s, f.succession, f.office, f.c, f.at), false);
  step(f, 14400); assert.equal(f.s.job.progress, 0); assert.deepEqual(f.s.job.cargo, cargo);
  f.s = Administration.normalize(f.s); step(f, 14400); assert.equal(f.actor.assignment, jobId);
  assert.equal(f.actor.workSeconds, 1800); assert.equal(f.s.job.progress, 0);
  step(f, 130); assert.equal(f.s.job, null); assert.equal(f.s.receipts.filter(r => r.installationId).length, 1);
  assert.equal(f.succession.provision.stock, 15); assert.equal(f.stacks.at(-1).quantity, 0);
});
test('blocked movement, outages, failed source custody and exhausted staff retain goods and do not backfill stopped intervals', () => {
  const f = fixture(); order(f); step(f, 1);
  step(f, 400, { move: () => false }); assert.equal(f.s.job.progress, 0); assert.equal(f.s.job.cargo.quantity, 3);
  f.c.externalPowered = false; step(f, 500); const work = f.actor.workSeconds;
  f.c.externalPowered = true; step(f, 500); assert.equal(f.actor.workSeconds, work); assert.equal(f.s.job.progress, 0);
  f.s = Administration.normalize(f.s); step(f, 130); assert.equal(f.s.job, null);
  const missing = fixture(); order(missing); missing.stacks[0].cityOwnerId = 'other'; step(missing, 500);
  assert.equal(missing.stacks[0].quantity, 3); assert.equal(missing.s.job.cargo, null);
  const tired = fixture(); order(tired); step(tired, 1); tired.actor.workSeconds = 0; step(tired, 500);
  assert.equal(tired.s.job.cargo.quantity, 3); assert.equal(tired.s.servicedAt, null);
});
test('source reservation prevents conflicting withdrawals; cancellation returns only uncollected custody, never spent work', () => {
  const f = fixture(); f.stacks = []; order(f); const reserve = f.succession.provision.stock;
  assert.equal(f.succession.provision.reservedBy, f.s.job.id); step(f, 1);
  const work = f.actor.workSeconds;
  assert.equal(Administration.cancel(f.s, f.succession, f.office, f.stacks, f.c, f.at), true);
  assert.equal(f.succession.provision.reservedBy, undefined); assert.equal(f.succession.provision.stock, reserve); assert.equal(f.actor.workSeconds, work);
  order(f); step(f, 1000); assert.equal(f.succession.provision.stock, 12); assert.equal(f.s.receipts[0].quantity, 3);
  const carrying = fixture(); order(carrying); step(carrying, 1);
  assert.equal(Administration.cancel(carrying.s, carrying.succession, carrying.office, carrying.stacks, carrying.c, carrying.at), false);
  assert.equal(carrying.s.job.cargo.quantity, 3);
});
test('published deadline and grace interrupt a real counter consumer without deposing anyone or resetting the timetable', () => {
  const f = fixture(), receipt = copy(f.succession.handover);
  step(f, Administration.PERIOD); assert.equal(Administration.status(f.s, f.at), 'due'); assert.equal(f.office.maintenanceReady, true);
  assert.ok(Identity.preview(Identity.create(), f.office, 'Scientist'));
  step(f, Administration.GRACE); assert.equal(f.office.maintenanceReady, false);
  assert.equal(Identity.preview(Identity.create(), f.office, 'Scientist'), null);
  assert.deepEqual(f.succession.handover, receipt); assert.equal(f.succession.control.recognizedAuthorityId, 'scientist');
  f.s = Administration.normalize(f.s); step(f, 86400); assert.equal(f.s.graceUntil, 115200);
  order(f); step(f, 1000); assert.equal(f.office.maintenanceReady, true); assert.ok(Identity.preview(Identity.create(), f.office, 'Scientist'));
});
test('repeated inspected jobs draw the same finite reserve, and stale inspections cannot authorize another period', () => {
  const f = fixture(), old = inspect(f); order(f); step(f, 1000); step(f, f.s.dueAt - f.at);
  assert.equal(Administration.order(f.s, f.succession, f.b, f.office, f.stacks, old, f.c, f.at), false);
  order(f); step(f, 1000); assert.equal(f.s.receipts.filter(r => r.installationId).length, 2);
  assert.equal(f.succession.provision.stock, 12); assert.equal(f.office.power, 10);
});
test('real batteries and replacement parts require original clean carried supplies and cannot create unlimited allocations', () => {
  const f = fixture(); f.office.power = 0;
  f.stacks.push(item('relayBattery', 2, { reservedTaskId: 'other' }), item('metalParts', 10, { carriedBy: '' }));
  assert.equal(Administration.handSupply(f.s, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.c, 0), false);
  assert.equal(Administration.handSupply(f.s, f.succession, f.b, f.office, f.stacks, 'metalParts', f.c, 0), false);
  f.stacks.push(item('relayBattery', 1), item('metalParts', 8));
  assert.equal(Administration.handSupply(f.s, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.c, 0), true);
  assert.equal(f.office.power, 12); assert.equal(f.stacks.find(i => i.key === 'relayBattery' && !i.reservedTaskId).quantity, 0);
  assert.equal(Administration.handSupply(f.s, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.c, 0), false);
  assert.equal(Administration.handSupply(f.s, f.succession, f.b, f.office, f.stacks, 'metalParts', f.c, 0), true);
  assert.equal(f.succession.provision.stock, 18); assert.equal(f.stacks.at(-1).quantity, 5);
  assert.equal(f.succession.provision.receipts.at(-1).purpose, 'upkeepReplacement');
  f.c.externalPowered = false; f.office.channelPowered = false; step(f, 1);
  assert.equal(Identity.preview(Identity.create(), f.office, 'Scientist'), null);
});
test('counter battery delivery depends on its own clerk, not a dead or absent military receiver', () => {
  const f = fixture(); f.office.power = 0; f.b.defender.status = 'dead'; f.c.receiverPresent = false; f.stacks.push(item('relayBattery', 1));
  assert.equal(Administration.handSupply(f.s, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.c, 0), true);
  assert.equal(f.office.power, 12); assert.equal(f.office.workSeconds, 14370); assert.equal(f.b.defender.status, 'dead');
});
test('supplied off-duty time restores only bounded work and fatigue; no simultaneous work, daily reset, healed wounds or ward recharge', () => {
  const f = fixture(); f.stacks.push(item('fieldRation', 2)); const health = f.b.defender.health;
  assert.equal(Administration.rest(f.s, f.succession, f.b, f.office, f.stacks, f.b.defender.id, f.c, 0), true);
  assert.equal(Administration.rest(f.s, f.succession, f.b, f.office, f.stacks, f.b.defender.id, f.c, 0), false);
  step(f, 14400); assert.equal(f.b.defender.workSeconds, 500); f.s = Administration.normalize(f.s); step(f, 14400);
  assert.equal(f.b.defender.workSeconds, 3600); assert.equal(f.b.defender.fatigue, 0); assert.equal(f.b.defender.health, health);
  assert.equal(f.b.defender.wardMana, 4); assert.equal(f.s.receipts[0].at, 28800); assert.equal(f.b.defender.assignment, null);
  f.b.defender.workSeconds = 50; step(f, 172800); assert.equal(f.b.defender.workSeconds, 50);
  assert.equal(f.stacks.at(-1).quantity, 1);
});
test('clerk recovery reserves the actual counter, pauses on displacement and exposes no retroactive work', () => {
  const f = fixture(); f.office.workSeconds = 0; f.stacks.push(item('fieldRation', 1));
  assert.equal(Administration.rest(f.s, f.succession, f.b, f.office, f.stacks, f.office.clerk.id, f.c, 0), true);
  assert.equal(f.office.assignment, f.s.rests[0].id);
  step(f, 1000); f.office.clerk.mapCell.x++; step(f, 1000); assert.equal(f.s.rests[0].progress, 0);
  f.office.clerk.mapCell.x--; step(f, 20000); assert.equal(f.s.rests[0].progress, 0);
  step(f, 28801); assert.equal(f.office.workSeconds, 14400); assert.equal(f.office.availableAt, f.at - 1);
  assert.equal(f.office.assignment, null); assert.equal(f.office.clerk.assignment, null);
});
test('irreversible death freezes jobs, deadlines, custody and recovery; save projection preserves only received local records', () => {
  const f = fixture(); order(f); const before = copy(f.s); f.c.alive = false; step(f, 1000000); assert.deepEqual(f.s, before);
  const view = Administration.publicView(f.s, 0); assert.deepEqual(Administration.publicView(Administration.normalize(f.s), 0), view);
  assert.doesNotMatch(JSON.stringify(view), /workCaps|wardMana|"health"|"stock"|retirementPolicy|hidden/);
  assert.equal(f.succession.provision.stock, 15); assert.equal(f.stacks[0].quantity, 3);
});
test('an offline municipal channel also blocks its real map-copying service without invalidating historical documents', () => {
  const f = fixture(), destination = { id: 'survey:a', cityId: 'a', label: 'Actual ground' };
  const discovery = Discovery.create(destination, 0), baseline = Discovery.materialize(discovery, 'world', 'seed');
  const service = Maps.bind(f.office, destination, baseline, 0), c = { ...f.c, placeId: 'survey:a', returnBooking: { id: 'trip', destinationLabel: 'Lab' } };
  assert.equal(Maps.reason(service, f.office, 'groundPlan', c), '');
  step(f, 115200); assert.notEqual(Maps.reason(service, f.office, 'groundPlan', c), '');
  assert.equal(service.copies.length, 0); assert.equal(f.office.records.length, 0);
});
test('replacement clerks, relocated counters and withdrawn continuation cannot silently inherit existing upkeep authorization', () => {
  for (const change of [f => f.office.clerk.id = 'replacement', f => f.office.civicCounter.cell.x++, f => f.succession.agreements = []]) {
    const f = fixture(); order(f); step(f, 1); const cargo = copy(f.s.job.cargo); change(f); step(f, 1000);
    assert.equal(f.s.servicedAt, null); assert.deepEqual(f.s.job.cargo, cargo);
    assert.equal(Administration.inspect(f.s, f.succession, f.office, f.c, f.at), false);
  }
});
