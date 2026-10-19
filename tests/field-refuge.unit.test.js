const { test } = require('node:test');
const assert = require('node:assert/strict');
const Station = require('../field-station');
const Survival = require('../wilderness-survival');
const copy = x => JSON.parse(JSON.stringify(x));
function refuge() {
  const saved = Station.create(), layout = Station.layout({ x: 40, y: 14, z: 23 }, 'refuge');
  const c = { local: true, wilderness: true, alive: true, capable: true, free: true, observed: true, clear: true,
    siteId: 'east', worldId: 'world', roomId: 'forest', bodyEpoch: 1, visitId: 'visit', tripId: 'trip',
    geometryOkay: true, reachable: true, floorsIntact: true, wallsIntact: true, roofsIntact: true, doorPresent: true,
    materialsLocal: true, cell: layout.rest, workCell: layout.rest, seconds: 100, staminaCost: 1, stamina: 80, atHead: true };
  assert(Station.register(saved, { id: 'refuge:world:east', label: 'Supplied Wilderness Refuge', siteId: 'east', worldId: 'world', cityId: 'b', roomId: 'forest' }, layout, c, 0));
  return { saved, layout, c };
}
test('refuge has distinct resting, crate and heater access with full finite construction costs', () => {
  const { layout: l } = refuge();
  assert.equal(l.footprint.length, 20); assert.equal(l.parts.length, 43);
  assert.equal(l.cache.y + 1, l.rest.y); assert.notDeepEqual(l.heater, l.rest);
  assert(l.floors.some(c => c.x === l.heater.x && c.y === l.heater.y + 1));
  assert.deepEqual(l.parts.reduce((s, p) => { for (const [k, n] of Object.entries(p.costs)) s[k] = (s[k] || 0) + n; return s; }, {}),
    { stoneBlocks: 33, lumber: 24, metalParts: 3, steelPanels: 2 });
  assert.equal(Station.layout(l.origin).parts.length, 26);
  assert.equal(Station.workPart(refuge().saved, l.parts.find(p => p.kind === 'heater').id, 'repair').costs.metalParts, 1);
});
test('all refuge components use exact supplied original-person work, never another site or free equipment', () => {
  const { saved, layout, c } = refuge(), other = Station.create();
  const tools = ['masonryHammer', 'stoneChisel', 'handSaw', 'foldingLadder'].map(key => ({ key,
    tool: { id: `tool:${key}`, current: 1000, carriedBy: 'scientist' },
    stack: { id: `stack:${key}`, key, quantity: 1, toolInstanceId: `tool:${key}`, carriedBy: 'scientist' } }));
  for (const p of layout.parts) {
    const inputs = Object.entries(p.costs).map(([key, quantity]) => ({ key, quantity, stackId: `${p.id}:${key}`, cell: c.cell }));
    const stacks = [...inputs.map(i => ({ ...i, id: i.stackId, section: 'resources', roomId: 'forest' })), ...tools.map(t => t.stack)];
    assert.equal(Station.plan(saved, p.id, c, tools, []), null);
    const plan = Station.plan(saved, p.id, c, tools, inputs); assert(plan, p.id);
    const job = Station.begin(plan, `work:${p.id}`, 0, tools);
    stacks.filter(i => i.section === 'resources').forEach(i => i.reservedTaskId = job.taskId);
    assert(Station.reason(saved, job, { ...c, siteId: 'original' }, tools, stacks));
    Station.advance(saved, job, c, tools, stacks, 0); Station.advance(saved, job, c, tools, stacks, 100);
    assert(Station.finish(saved, job, c, tools, stacks, 100, `physical:${p.id}`));
    assert.equal(Station.finish(saved, job, c, tools, stacks, 100, `physical:${p.id}`), false);
    assert.equal(other.site, null);
  }
  assert.equal(Object.keys(saved.site.parts).length, 43);
  const publicRecord = Station.publicView(saved);
  assert.equal(publicRecord.label, 'Supplied Wilderness Refuge');
  assert.equal(publicRecord.climate, undefined);
});
function climateFixture() {
  const { saved } = refuge(); saved.site.climate = { lastAt: 0, temperatureC: -10 };
  return { saved, fuel: .09, spent: 0 };
}
function climate(f, now, overrides = {}) {
  return Station.advanceClimate(f.saved, now, { alive: true, intact: true, targetC: 20, heatCPerHour: 18, outdoorAt: () => -10,
    drawPower: seconds => { const used = Math.min(f.fuel, .18 * seconds / 3600); f.fuel -= used; f.spent += used; return used / (.18 * seconds / 3600); }, ...overrides });
}
test('finite supplied heat, exhaustion, cooling and actual absence are deterministic across serialization', () => {
  const a = climateFixture(), b = climateFixture();
  climate(a, 3600);
  climate(b, 1700); b.saved = copy(b.saved); climate(b, 3600);
  assert.deepEqual(a.saved, b.saved); assert.equal(a.fuel, 0); assert.equal(b.fuel, 0);
  assert(a.saved.site.climate.temperatureC > -10);
  const warm = a.saved.site.climate.temperatureC; climate(a, 7200);
  assert(a.saved.site.climate.temperatureC < warm);
  assert.equal(a.saved.observations, null); // Physical away operation is not received telemetry.
  const before = copy(a); assert.equal(climate(a, 9000, { alive: false }), null); assert.deepEqual(a, before);
});
test('breached shelter loses useful warmth without refunding fuel, and unsupported heat never appears', () => {
  const f = climateFixture(); climate(f, 60, { intact: false });
  assert.equal(f.saved.site.climate.temperatureC, -10); assert(f.fuel < .09);
  const cold = climateFixture(); climate(cold, 3600, { drawPower: null });
  assert.equal(cold.saved.site.climate.temperatureC, -10); assert.equal(cold.fuel, .09);
});
test('same-clock handling preserves measured warmth for physiology without consuming power twice', () => {
  const f = climateFixture(), first = climate(f, 60), fuel = f.fuel;
  const same = climate(f, 60);
  assert.deepEqual(same, first); assert.equal(f.fuel, fuel);
  const imported = copy(f); assert.equal(climate(imported, 60).values.length, 0);
});
test('heater handling credits only actual continued attendance, never blocked time or a death interval', () => {
  let work = { required: 60, progress: 0, lastAt: 0, attended: false };
  assert.equal(Station.advanceService(work, 10, true), 0); // Arrival is not ten seconds of work.
  Station.advanceService(work, 30, true); assert.equal(work.progress, 20);
  Station.advanceService(work, 90, false); assert.equal(work.progress, 20);
  work = copy(work);
  Station.advanceService(work, 200, false); Station.advanceService(work, 201, true);
  assert.equal(work.progress, 20);
  assert.equal(Station.advanceService(work, 241, true), 40); assert.equal(work.progress, 60);
  assert.equal(Station.advanceService(work, 900, true), 0);
  const ended = copy(work); Station.advanceService(work, 1000, true, false); assert.deepEqual(work, ended);
});
test('refuge temperature mitigates exposure only, while rest, thirst, food and wounds keep their ordinary rules', () => {
  const start = { ...Survival.defaultState(0), exposure: 30, exertion: 50 };
  const options = { destination: { temperatureC: -10, precipitationMm: 100 }, sheltered: true, resting: true };
  const cold = Survival.advance(start, 1800, options), warm = Survival.advance(start, 1800, { ...options, temperatureAt: () => 18 });
  assert(warm.state.exposure < cold.state.exposure);
  assert.equal(warm.state.exertion, cold.state.exertion);
  assert(warm.state.thirst > 0); assert(warm.state.hunger > 0);
  assert.equal(warm.state.health, undefined);
});
