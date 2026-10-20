const { test } = require('node:test');
const assert = require('node:assert/strict');
const Caretaker = require('../resident-caretaker');
const Survival = require('../wilderness-survival');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'city', populationId: 'people', providerId: 'works', allocationId: 'original', restrictions: [], prohibitions: [] };
  const f = { s: { role: 'builder', phase: 'completed', contract: { settledAt: 0 }, source, dutySeconds: 28800,
    actor: { id: 'original', health: 100, status: 'alive', money: 0, needs: Survival.defaultState(0) } },
  c: { alive: true, capable: true, near: true, originalBody: true, originalTrip: true, atGround: true, bodyEpoch: 0,
    toolsReturned: true, source, plan: { id: 'refuge', heaterId: 'heater', doorId: 'door', home: 0, sleep: 3, controls: 2, cratePort: 1, doorPort: 3 },
    kitId: 'original-kit', provisions: true, stocked: true, routeOk: true, supported: true, fuelUsable: true },
  wallet: { money: 1000 }, pos: 0, enabled: false, fuel: 0, deployed: false, flags: {},
  supplies: { drinkingWater: 30, trailMeal: 15, fuelReagent: 20 }, carried: { drinkingWater: 3, trailMeal: 2 }, consumed: [], loaded: 0, time: 0 };
  return f;
}
function hire(f) {
  const q = Caretaker.review(f.s, f.c, 0); assert(q);
  assert(Caretaker.accept(f.s, f.c, q, f.wallet, 0)); return q;
}
function hooks(f) {
  const item = (where, key) => f[where][key] > 0 ? { id: `${where}:${key}`, key } : null;
  return { alive: f.flags.alive !== false,
    context: at => {
      if (f.enabled) f.fuel = Math.max(0, f.fuel - .18 / 3600);
      return { ...f.c, accompanied: true, destination: { temperatureC: 18, precipitationMm: 0 }, sheltered: f.pos > 0,
        atHome: f.pos === 0, atSleep: f.pos === 3, atCrate: f.pos === 1, atControls: f.pos === 2,
        sleepUsable: true, supported: true, fuelUsable: true, enabled: f.enabled, fuel: f.fuel, ...f.flags };
    },
    move: target => { if (!f.flags.blocked) f.pos += Math.sign(target - f.pos); return !f.flags.blocked; },
    carried: key => item('carried', key), supply: key => item('supplies', key),
    available: key => item('carried', key) || item('supplies', key),
    take: id => { const key = id.split(':')[1]; if (!f.supplies[key]) return false; f.supplies[key]--; f.carried[key] = (f.carried[key] || 0) + 1; return true; },
    consume: (id, key) => { if (!f.carried[key]) return false; f.carried[key]--; f.consumed.push(key); f.s.actor.needs = Survival.consume(f.s.actor.needs, key); return true; },
    deploy: () => { f.deployed = true; return true; },
    fuel: id => { if (!f.carried.fuelReagent || f.pos !== 2) return false; f.carried.fuelReagent--; f.fuel++; f.loaded++; return true; },
    enable: () => { if (f.pos !== 2) return false; f.enabled = true; return true; }, closeDoor: () => true };
}
function advance(f, at) { const damage = Caretaker.advance(f.s, at, hooks(f)); f.s.actor.health -= damage; f.time = at; }
test('optional original water-point consent grants only physical finite drinking and survives reload', () => {
  const f = fixture(); hire(f); advance(f, 250);
  const offer = { fixtureId: 'original-purifier', port: 4, route: [3, 4] };
  assert.equal(Caretaker.acceptWaterPoint(f.s, f.c, offer, 250), false);
  assert.equal(Caretaker.acceptWaterPoint(f.s, { ...f.c, waterPointInspected: true, bodyEpoch: 1 }, offer, 250), false);
  assert(Caretaker.acceptWaterPoint(f.s, { ...f.c, waterPointInspected: true }, offer, 250));
  f.s = copy(f.s); assert.deepEqual(f.s.resident.waterAccess, offer);
  f.carried.drinkingWater = 0; f.s.actor.needs.thirst = 60; let tank = 1, operations = 0;
  const h = hooks(f), context = h.context;
  h.context = at => ({ ...context(at), atWaterPoint: f.pos === offer.port });
  h.waterPoint = () => f.s.resident.waterAccess && tank ? offer : null;
  h.drinkTank = () => { if (tank < 1 || f.pos !== offer.port) return false; tank--; operations++; f.s.actor.needs = Survival.consume(f.s.actor.needs, 'drinkingWater'); return true; };
  Caretaker.advance(f.s, 260, h); assert.equal(tank, 1); assert.equal(f.pos, 4);
  Caretaker.advance(f.s, 285, h); assert.equal(tank, 0); assert.equal(operations, 1);
  assert(f.s.actor.needs.thirst < 45); assert.equal(f.carried.drinkingWater, 0);
  assert.equal(f.s.resident.endsAt, 4 + 3 * 86400);
  assert(f.s.resident.log.some(l => /no collection, treatment/.test(l.text)));
});
test('separate consent requires original settled person, source, returned tools, actual support and exact prepaid terms', () => {
  const f = fixture();
  for (const [key, value] of [['toolsReturned', false], ['stocked', false], ['provisions', false], ['supported', false], ['fuelUsable', false], ['routeOk', false]]) {
    assert.equal(Caretaker.review(f.s, { ...f.c, [key]: value }, 0), null, key);
  }
  assert.equal(Caretaker.review(f.s, { ...f.c, source: { ...f.c.source, providerId: 'other' } }, 0), null);
  const q = Caretaker.review(f.s, f.c, 0); assert(q);
  assert.equal(Caretaker.accept(f.s, f.c, { ...q, reserve: 0 }, f.wallet, 0), false);
  assert.equal(Caretaker.accept(f.s, f.c, q, { money: 615 }, 0), false);
  assert(Caretaker.accept(f.s, f.c, q, f.wallet, 0)); assert.equal(f.wallet.money, 384);
  assert.equal(f.s.actor.money, 40); assert.equal(f.s.actor.id, 'original'); assert.equal(f.s.dutySeconds, 28800);
  assert.equal(Caretaker.review(f.s, f.c, 1), null);
});
test('outward journey requires physical accompaniment and starts the three-day calendar only on arrival', () => {
  const f = fixture(); hire(f); f.flags.accompanied = false; advance(f, 60);
  assert.equal(f.pos, 0); assert.equal(f.s.resident.arrivedAt, null); assert.equal(f.s.resident.earned, 0);
  delete f.flags.accompanied; advance(f, 64); assert.equal(f.pos, 3); assert.equal(f.s.resident.arrivedAt, 64);
  assert.equal(f.s.resident.endsAt, 64 + 3 * 86400);
});
test('resident physically deploys original kit, collects and spends finite fuel and operates original controls once', () => {
  const f = fixture(); hire(f); advance(f, 250);
  assert(f.deployed); assert(f.enabled); assert.equal(f.loaded, 1); assert.equal(f.supplies.fuelReagent, 19);
  assert.equal(f.carried.fuelReagent, 0); assert(f.fuel > .99 && f.fuel < 1);
  assert(f.s.resident.log.some(l => /load fuel/.test(l.text)));
});
test('real serialization preserves partial service; chunking produces identical stock, wages, needs and receipts', () => {
  const f = fixture(); hire(f); advance(f, 170); assert.equal(f.s.resident.service.kind, 'load fuel');
  const saved = copy(f); advance(f, 400); advance(saved, 201); advance(saved, 400);
  assert.deepEqual(f, saved); assert.equal(f.loaded, 1);
});
test('supplied standby parks at the original sleeping place and does not close an occupied doorway', () => {
  const f = fixture(); hire(f); advance(f, 250);
  assert.equal(f.pos, 3); assert.equal(f.s.resident.restSeconds, 0);
  f.pos = 2; f.flags.doorOpen = true; f.flags.doorwayBusy = true;
  const h = hooks(f); let closes = 0; h.closeDoor = () => { closes++; return true; };
  Caretaker.advance(f.s, 280, h);
  assert.equal(closes, 0); assert.equal(f.pos, 3); assert.equal(f.s.resident.restSeconds, 0);
  f.flags.doorwayBusy = false; f.flags.atDoorControls = true;
  Caretaker.advance(f.s, 300, h); assert(closes > 0);
});
test('displacement and changed source discard attended progress without paying with absent goods', () => {
  const f = fixture(); hire(f); advance(f, 170); const before = f.s.resident.service.progress;
  assert(before > 0); f.pos = 1; advance(f, 171); assert.equal(f.s.resident.service, null);
  advance(f, 180); assert(f.s.resident.service.progress < before); assert.equal(f.loaded, 0);
});
test('accepted work continues without employer contact or during custody; reports stay dated until personal receipt', () => {
  const f = fixture(); hire(f); assert(Caretaker.receive(f.s, f.c, 0)); const report = copy(f.s.resident.report);
  f.flags.near = false; f.flags.custody = true; advance(f, 260); assert(f.enabled);
  assert.deepEqual(f.s.resident.report, report);
  assert.equal(Caretaker.receive(f.s, { ...f.c, near: false }, 260), false);
  assert.equal(Caretaker.receive(f.s, { ...f.c, custody: true }, 260), false);
  assert(Caretaker.receive(f.s, f.c, 260)); assert.equal(f.s.resident.report.phase, 'resident');
});
test('shortage triggers physical withdrawal; obstruction strands original person and physical return precedes once-only settlement', () => {
  const f = fixture(); hire(f); advance(f, 125); f.supplies.fuelReagent = 0; f.flags.blocked = true; advance(f, 160);
  assert.equal(f.s.resident.phase, 'returning'); assert(f.pos > 0);
  assert.equal(Caretaker.settle(f.s, f.c, f.wallet, 160), false);
  f.flags.blocked = false; advance(f, 170); assert.equal(f.s.resident.phase, 'awaitingSettlement'); assert.equal(f.pos, 0);
  const earned = f.s.resident.earned; assert(Caretaker.settle(f.s, f.c, f.wallet, 170));
  assert.equal(f.wallet.money, 960 - Math.ceil(earned)); assert.equal(f.s.actor.money, 40 + Math.ceil(earned));
  const money = f.wallet.money; assert.equal(Caretaker.settle(f.s, f.c, f.wallet, 171), false); assert.equal(f.wallet.money, money);
});
test('supplied off-duty rest restores finite duty but neither health, provisions nor wages', () => {
  const f = fixture(); hire(f); advance(f, 250); f.s.dutySeconds = 300; f.s.actor.health = 75;
  const stock = f.supplies.drinkingWater + f.carried.drinkingWater; advance(f, 30000);
  assert(f.s.dutySeconds > 20000); assert.equal(f.s.actor.health, 75);
  assert(f.supplies.drinkingWater + f.carried.drinkingWater < stock); assert(f.consumed.includes('drinkingWater'));
  const wages = f.s.resident.earned; advance(f, 31000); assert.equal(f.s.resident.earned, wages);
});
test('unsupported shelter, changed provider and real danger stop duties without creating guards or replacements', () => {
  for (const flags of [{ supported: false }, { providerRefusal: 'Provider refuses' }, { threatened: true }, { fuelUsable: false }]) {
    const f = fixture(); hire(f); advance(f, 250); Object.assign(f.flags, flags); advance(f, 251);
    assert.equal(f.s.resident.phase, 'returning', JSON.stringify(flags)); assert.equal(f.s.actor.id, 'original');
  }
});
test('resurrection retains obligations, not automatic new-body command authority; explicit personal recognition is required', () => {
  const f = fixture(); hire(f); advance(f, 250); const earned = f.s.resident.earned, c = { ...f.c, bodyEpoch: 1 };
  assert.equal(Caretaker.authorized(f.s, c), false); assert.equal(Caretaker.recognize(f.s, c, 250), false);
  assert.equal(Caretaker.recognize(f.s, { ...c, recognizedIdentity: true, near: false }, 250), false);
  assert(Caretaker.recognize(f.s, { ...c, recognizedIdentity: true }, 250)); assert(Caretaker.authorized(f.s, c));
  assert.equal(f.s.resident.earned, earned); assert.equal(f.wallet.money, 384);
});
test('three supplied days end without automatic renewal, with finite full pay and a physical return', () => {
  const f = fixture(); hire(f); advance(f, 3 * 86400 + 20);
  assert.equal(f.s.resident.phase, 'awaitingSettlement', JSON.stringify({ duty: f.s.dutySeconds, r: f.s.resident, pos: f.pos })); assert.equal(f.pos, 0);
  assert(Math.abs(f.s.resident.earned - 576) < .02); assert(f.loaded > 1); assert(f.supplies.fuelReagent < 20);
  assert(f.supplies.drinkingWater < 30); assert(f.supplies.trailMeal < 15);
});
test('scientist death freezes all work; worker death retains escrow and original identity', () => {
  const f = fixture(); hire(f); advance(f, 170); f.flags.alive = false; const before = copy(f); advance(f, 1000);
  before.time = 1000; assert.deepEqual(f, before);
  f.flags.alive = true; f.s.actor.status = 'dead'; advance(f, 1001); assert.equal(f.s.resident.phase, 'fatality');
  assert.equal(f.s.actor.id, 'original'); assert.equal(f.wallet.money, 384);
});
test('a later resident agreement needs fresh consent and wages without resetting the original person or duty', () => {
  const f = fixture(); hire(f); advance(f, 250);
  assert(Caretaker.withdraw(f.s, 250, 'Personally ended agreement.')); advance(f, 260);
  assert(Caretaker.settle(f.s, f.c, f.wallet, 260));
  const duty = f.s.dutySeconds, needs = copy(f.s.actor.needs), money = f.wallet.money, old = f.s.resident.id;
  const q = Caretaker.review(f.s, f.c, 260); assert(q);
  assert(Caretaker.accept(f.s, f.c, q, f.wallet, 260));
  assert.notEqual(f.s.resident.id, old); assert.equal(f.s.residentHistory.length, 1);
  assert.equal(f.s.actor.id, 'original'); assert.equal(f.s.dutySeconds, duty); assert.deepEqual(f.s.actor.needs, needs);
  assert.equal(f.wallet.money, money - 616); assert.equal(f.s.resident.arrivedAt, null);
});
test('a substituted actor cannot inherit standing work, wages, reports or command recognition', () => {
  const f = fixture(); hire(f); advance(f, 170); const wages = f.s.resident.earned;
  f.s.actor.id = 'substitute'; advance(f, 300);
  assert.equal(f.loaded, 0); assert.equal(f.s.resident.earned, wages); assert.equal(f.s.resident.service, null);
  assert.equal(Caretaker.authorized(f.s, f.c), false); assert.equal(Caretaker.receive(f.s, f.c, 300), false);
  assert.equal(Caretaker.recognize(f.s, { ...f.c, recognizedIdentity: true }, 300), false);
});
test('the returned worker can still physically consume their own finite provisions while awaiting settlement', () => {
  const f = fixture(); hire(f); advance(f, 250); Caretaker.withdraw(f.s, 250, 'Return'); advance(f, 260);
  f.s.actor.needs.thirst = 60; const water = f.carried.drinkingWater, earned = f.s.resident.earned;
  advance(f, 282); assert.equal(f.s.resident.phase, 'awaitingSettlement');
  assert.equal(f.carried.drinkingWater, water - 1); assert(f.s.actor.needs.thirst < 30); assert.equal(f.s.resident.earned, earned);
});
