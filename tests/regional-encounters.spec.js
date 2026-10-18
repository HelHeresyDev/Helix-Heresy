const { test, expect } = require('@playwright/test');
const R = require('../regional-encounters');
const Wild = require('../wilderness-beasts');
const Stops = require('../roadside-stops');
const Walk = require('../overland-expedition');
const Survival = require('../wilderness-survival');
const binding = { worldId: 'world', runId: 'run' }, plan = { id: 'route', distanceKm: 2 };
const p = { id: 'SECRET_POPULATION', speciesId: 'beast:rimefang-pack', populationIndex: 900 };
const copy = x => JSON.parse(JSON.stringify(x));
function allocated(pop = p) {
  for (let i = 0; i < 100; i++) { const s = R.route(R.create(binding), plan, [pop], `seed-${i}`, 0); if (s.beasts.actors.length) return s; }
  throw new Error('No deterministic supported presence seed');
}
function siteFor(s, km = s.beasts.actors[0].positionKm, z = 22) { return Stops.ensure(null, binding, plan.id, km, 1, z, { temperatureC: 18 }).site; }
test('seeded route allocation is independent of stops, reloads, cargo or later population changes; absence is saved', () => {
  const s = allocated(), original = copy(s), source = copy(p);
  R.route(s, plan, [{ ...p, populationIndex: 999999 }], 'different seed', 90000); expect(s).toEqual(original); expect(p).toEqual(source);
  const absent = R.route(R.create(binding), plan, [], 'seed', 0);
  R.route(absent, plan, [p], 'seed', 100); expect(absent.beasts.actors).toEqual([]);
  const unsupported = R.route(R.create(binding), plan, [{ ...p, speciesId: 'unsupported-flyer' }], 'seed', 0);
  expect(unsupported.beasts.actors).toEqual([]); expect(unsupported.decisions).toHaveLength(1);
  expect(R.normalize(copy(original))).toEqual(original);
});
test('legacy individuals are adopted without copying/healing/renaming; finite claims never replenish on death', () => {
  const s = R.create(binding), actors = Array.from({ length: R.CAP }, (_, i) => ({ ...Wild.actor(p.speciesId, `original-${i}`, { x: 30, y: 12, z: 6 }, p.id), health: 10, injuries: ['original wound'] }));
  const before = copy(actors); R.adopt(s, actors, 'legacy', 0); R.adopt(s, actors, 'legacy', 1);
  expect(actors).toEqual(before); expect(s.members).toHaveLength(R.CAP); expect(s.beasts.actors).toEqual([]);
  R.route(s, plan, [p], 'seed-0', 2); expect(s.beasts.actors).toEqual([]);
  actors[0].status = 'dead'; actors[0].health = 0; actors[0].diedAt = 3;
  R.adopt(s, actors, 'legacy', 5); R.adopt(s, actors, 'legacy', 6);
  expect(s.losses).toEqual([{ actorId: actors[0].id, populationId: p.id, at: 3 }]); expect(R.remaining(s, p.id)).toBe(0);
  expect(R.claim(s, { ...actors[0], id: 'new-copy' }, 'another patch', 7)).toBe(false);
  expect(R.claim(s, { ...before[0] }, 'same missing materialization flag', 8)).toBe(false);
});
test('preexisting rosters larger than the supported cap are preserved, never deleted to fit a new quota', () => {
  const s = R.create(binding), legacy = Array.from({ length: 8 }, (_, i) => ({ ...p, populationId: p.id, id: `legacy-${i}` }));
  R.adopt(s, legacy, 'legacy', 0); expect(s.members).toHaveLength(8); expect(R.remaining(s, p.id)).toBe(0);
});
test('same allocated animal occupies only original suitable ground, never copied by stop cycling or placed under an occupied tile', () => {
  const s = allocated(), a = s.beasts.actors[0], site = siteFor(s), id = a.id;
  expect(R.place(s, site, 1, () => false)).toBe(0); expect(a.regionalPhase).toBe('reserve');
  const original = copy(a), cell = { x: 10, y: 13, z: site.entry.z };
  expect(R.place(s, site, 2, c => Wild.key(c) === Wild.key(cell))).toBe(1);
  expect(a.id).toBe(id); expect(a.mapCell).toEqual(cell); expect(a.health).toBe(original.health);
  const other = siteFor(s, site.positionKm + .001, 23); expect(R.place(s, other, 5, () => true)).toBe(0);
  expect(a.roomId).toBe(site.roomId); expect(a.mapCell).toEqual(cell); expect(s.beasts.actors).toHaveLength(1);
});
test('wounds, original physical remains and once-only losses survive reload and revisits without altering abundance', () => {
  const s = allocated(), site = siteFor(s); R.place(s, site, 1, () => true);
  const a = s.beasts.actors[0]; a.health = 0; a.status = 'dead'; a.diedAt = 10; a.wounds = ['same-wound']; R.syncLocal(s, site, 10);
  const saved = R.normalize(copy(s)); R.place(saved, site, 10000, () => true); R.syncLocal(saved, site, 10000);
  expect(saved.beasts.actors[0]).toMatchObject({ id: a.id, health: 0, status: 'dead', wounds: ['same-wound'], mapCell: a.mapCell });
  expect(saved.losses).toHaveLength(1); expect(p.populationIndex).toBe(900); expect(saved.members).toHaveLength(1);
});
test('departure retains actual separation and finite pursuit; speed/injuries and elapsed memory determine contact or escape', () => {
  const s = allocated(), site = siteFor(s); R.place(s, site, 1, () => true); const a = s.beasts.actors[0];
  a.mapCell = { ...site.entry, x: site.entry.x + 2 }; a.behavior = 'pursue'; a.rememberedUntil = 30;
  R.depart(s, site, 2); expect(a.regionalPhase).toBe('following'); expect(a.mapCell).toBeNull(); expect(a.positionKm).toBeCloseTo(site.positionKm + .002, 12);
  const impaired = copy(s), escaped = copy(s);
  expect(R.follow(s, plan.id, site.positionKm, 4, true).contact).toBe(true);
  expect(R.follow(impaired, plan.id, site.positionKm, 4, true, () => 10).contact).toBe(false);
  R.follow(escaped, plan.id, site.positionKm + .1, 100, true);
  expect(escaped.beasts.actors[0].regionalPhase).toBe('reserve'); expect(escaped.beasts.actors[0].positionKm).toBeLessThan(site.positionKm + .01);
  expect(escaped.beasts.actors[0].effortSeconds).toBeLessThan(120);
});
test('following steps, effort, identity and contact are save/chunk independent for the same target history', () => {
  const s = allocated(), site = siteFor(s); R.place(s, site, 1, () => true); const a = s.beasts.actors[0];
  a.behavior = 'pursue'; a.rememberedUntil = 50; R.depart(s, site, 1);
  const whole = copy(s); R.follow(whole, plan.id, site.positionKm, 5, true);
  let part = copy(s); for (let at = 2; at <= 5; at++) { part = R.normalize(copy(part)); R.follow(part, plan.id, site.positionKm, at, true); }
  expect(part).toEqual(whole);
});
test('regional positions interrupt actual measured walking, not a completed-arrival or shipment-loss roll', () => {
  const s = allocated(), km = s.beasts.actors[0].positionKm;
  const route = { ...plan, homeId: 'home', groundId: 'ground', sourceId: 'received', sourceAt: 0, legs: [{ distanceKm: 2, factor: 1 }] };
  const start = Walk.begin(null, route, binding, 'home', 0, 1);
  const result = Walk.advance(start, Survival.defaultState(), 10000, { alive: true, capable: true, atRoad: true, bodyEpoch: 1,
    routeOpen: true, speedKph: 4, stopPositions: R.positions(s, plan.id) });
  expect(result.arrived).toBe(false); expect(result.state.trip.status).toBe('stopped'); expect(result.state.trip.positionKm).toBe(km);
  expect(result.state.trip.walkedKm).toBeCloseTo(km, 10); expect(result.state.history).toEqual([]);
});
test('public knowledge contains only dated observations, no population IDs, hidden roster, route coordinates or safety proof', () => {
  const s = allocated(); expect(Wild.publicKnowledge(s.beasts)).toEqual({ sightings: [], tracks: [], heard: null });
  const a = s.beasts.actors[0]; s.beasts.sightings[a.id] = { id: a.id, name: a.name, cell: { x: 10, y: 13, z: 22 }, observedAt: 5, condition: 'Visibly wounded' };
  const view = Wild.publicKnowledge(s.beasts, []); expect(view.sightings[0].current).toBe(false);
  expect(JSON.stringify(view)).not.toContain(p.id); expect(JSON.stringify(view)).not.toContain('positionKm');
});
test('death freezes pursuit, fresh runs inherit nothing and validated imports rebind only their copied ledger', () => {
  const s = allocated(), before = copy(s), to = { worldId: 'copy', runId: 'copy-run' };
  R.follow(s, plan.id, 1, 1000, false); expect(s).toEqual(before);
  expect(R.rebind(s, binding, to)).toMatchObject(to); expect(s).toEqual(before);
  expect(R.rebind(s, { ...binding, runId: 'wrong' }, to)).toEqual(s);
  expect(R.create({ ...binding, runId: 'new' }).members).toEqual([]);
});
