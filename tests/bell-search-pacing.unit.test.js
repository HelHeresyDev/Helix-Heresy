const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-foraging'), W = require('../background-wildlife');
const { source } = require('./helpers/sustenance-source');
const DAY = P.DAY, HOUR = 3600, binding = { worldId: 'bell-pacing', runId: 'original' };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);

function fixture({ hungry = false, fish = 1, areaHa = 1e7 } = {}) {
  const src = source({ species: 'abyssal-bell', guild: 'fish', count: fish, areaHa, members: 1, cohorts: 1 });
  src.regions[0].seasons.forEach(row => { row.temperatureC = 8; });
  const s = P.create(src, binding), c = s.groups[0].cohorts[0];
  if (hungry) {
    c.massKg -= c.stores.fatKg - 3000;
    c.stores.fatKg = 3000;
    c.foraging.nextAt = 1e-6;
    P.removeStock(s, 'ground', 'waterL', 0, 0, 'existing-low-reserves');
  }
  return { s, c };
}

test('Abyssal Bell search spends only the released hours and wakes at the next day without a free catch', () => {
  const { s, c } = fixture({ hungry: true }), f = c.foraging;
  const cutoff = DAY - 1;
  P.advance(s, cutoff, true, true);
  near(f.plan.used.search, 6 * HOUR);
  assert.equal(f.phase, 'idle');
  assert.equal(f.nextAt, DAY);
  assert.equal(f.plan.limits.search, 29 * 6 * HOUR); // First calendar month in the fixture.
  const restored = P.normalize(s, binding); assert.ok(restored);
  P.advance(s, DAY + 600, true, true);
  P.advance(restored, DAY, true, true);
  P.advance(restored, DAY + 600, true, true);
  assert.equal(f.phase, 'search');
  assert.ok(f.plan.used.search > 6 * HOUR && f.plan.used.search < 12 * HOUR);
  assert.equal(f.plan.searchPacing.ceiling, 12 * HOUR);
  assert.equal(W.summary(s).hunted, 0);
  assert.equal(F.summary(s).eatenKg, 0);
  assert.deepEqual(restored.groups, s.groups);
  assert.deepEqual(restored.regions, s.regions);
  assert.ok(P.normalize(s, binding));
});

test('Abyssal Bell resting for many days banks at most one prior day of search', () => {
  const { s, c } = fixture(), f = c.foraging, ceiling = f.plan.limits.search;
  P.advance(s, 7 * DAY, true, true);
  assert.equal(f.plan.used.search, 0);
  for (let i = 0; i < 5 && !f.plan.searchPacing.window; i++) P.advance(s, f.nextAt, true, true);
  const p = f.plan.searchPacing;
  assert.ok(p.window >= 7);
  assert.equal(f.plan.used.search, 0);
  assert.equal(p.ceiling, 12 * HOUR);
  assert.equal(f.plan.limits.search, ceiling);
  const inflated = structuredClone(s);
  inflated.groups[0].cohorts[0].foraging.plan.searchPacing.ceiling += 86400;
  assert.equal(P.normalize(inflated, binding), null);
  assert.ok(P.normalize(s, binding));
});

test('legacy Abyssal Bell search finishes its earned action before pacing the unspent monthly allowance', () => {
  const { s, c } = fixture({ hungry: true }), f = c.foraging;
  P.advance(s, 900, true, true);
  assert.equal(f.phase, 'search');
  const due = f.action.dueAt, beforeUsed = f.plan.used.search, originalLimit = f.plan.limits.search;
  delete f.plan.searchPacing; // Old saves had the exact same paid action, with no pacing record.
  const saved = P.normalize(s, binding); assert.ok(saved);
  const old = saved.groups[0].cohorts[0].foraging;
  P.advance(saved, due - 1, true, true);
  assert.equal(old.action.dueAt, due);
  assert.ok(old.plan.used.search > beforeUsed);
  assert.equal(old.plan.searchPacing, undefined);
  P.advance(saved, due, true, true);
  assert.equal(old.plan.searchPacing.openedAt, due);
  near(old.plan.searchPacing.spentAtOpen, old.plan.used.search);
  assert.equal(old.plan.limits.search, originalLimit);
  assert.ok(old.plan.searchPacing.ceiling - old.plan.used.search <= 6 * HOUR);
  assert.ok(P.normalize(saved, binding));
});

test('a live Abyssal Bell starts a new allowance only at the game-calendar month boundary', () => {
  const { s, c } = fixture({ fish: 1000000, areaHa: 1000 }), f = c.foraging, monthEnd = 29 * DAY;
  P.advance(s, monthEnd - 1, true, true);
  assert.equal(f.plan.monthIndex, 0);
  assert.ok(c.health > .99 && f.plan.used.search > 0 && W.summary(s).hunted > 0);
  const restored = P.normalize(s, binding); assert.ok(restored);
  P.advance(s, monthEnd, true, true);
  P.advance(restored, monthEnd, true, true);
  assert.equal(f.plan.monthIndex, 1);
  assert.equal(f.plan.limits.search, 31 * 6 * HOUR);
  assert.equal(f.plan.searchPacing.openedAt, monthEnd);
  assert.equal(f.plan.searchPacing.ceiling, 6 * HOUR);
  assert.equal(f.plan.used.search, 0);
  assert.deepEqual(restored.groups, s.groups);
  assert.ok(P.normalize(s, binding));
});
