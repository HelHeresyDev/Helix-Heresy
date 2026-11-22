const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-foraging');
const { observe } = require('../scripts/trace-lantern-shortfall');
const { windSource } = require('./helpers/wind-source');
const binding = { worldId: 'lantern-shortfall-trace', runId: 'original' };

function fixture(wind, preyX) {
  const account = P.create(windSource({ wind, preyX }), binding), [lantern, prey] = account.groups;
  lantern.cohorts[0].regional.stamina = 300;
  P.kill(account, prey.id, prey.cohorts[0].id, 0, 0, 'actual-original-death');
  return { account, originId: lantern.cohorts[0].originId };
}

test('retained shortfall observer counts a real reached meal without changing executed state', () => {
  const { account, originId } = fixture({ x: 0, y: .2 }, 20);
  const control = P.normalize(account, binding); assert.ok(control);
  const step = F.step, integrate = F.integrate, watched = observe(account, originId);
  try {
    P.advance(account, 250, true, true);
    P.advance(control, 250, true, true); // This independent run is not counted.
  } finally { watched.stop(); }
  assert.equal(F.step, step); assert.equal(F.integrate, integrate);
  assert.deepEqual(account, control);
  const { eatenKg, detections, captures, elapsedSeconds } = watched.summary;
  assert.equal(eatenKg, account.regions[0].foraging.receipts.eatenKg);
  assert.ok(eatenKg > 0 && detections > 0 && captures > 0);
  assert.ok(elapsedSeconds.approach > 0 && elapsedSeconds.handling > 0 && elapsedSeconds.eating > 0);
});

test('retained shortfall observer distinguishes a distant carcass from nearby tissue in overpowering air', () => {
  for (const [wind, preyX] of [[{ x: 0, y: .2 }, 500], [{ x: -20, y: 0 }, 0]]) {
    const { account, originId } = fixture(wind, preyX), watched = observe(account, originId);
    try { P.advance(account, 120, true, true); } finally { watched.stop(); }
    assert.equal(watched.summary.eatenKg, 0);
    if (preyX) {
      assert.equal(watched.summary.sites.length, 0);
      assert.equal(watched.summary.unholdableSeconds, 0);
    } else {
      assert.ok(watched.summary.sites.some(row => row.compatibleKg > 0 && !row.airborneGripPossible));
      assert.ok(watched.summary.unholdableSeconds > 0);
    }
    assert.ok(P.normalize(account, binding));
  }
});
