const test = require('node:test'), assert = require('node:assert/strict');
const { run } = require('../scripts/benchmark-generated-beast-habitats');
test('private generated replay resumes an immutable whole-day checkpoint with the same paid consequences', () => {
  let snapshot;
  const first = run({ days: 1, checkpoint: value => { snapshot = JSON.parse(JSON.stringify(value)); } });
  const saved = JSON.stringify(snapshot), resumed = run({ days: 2, resume: snapshot }), direct = run({ days: 2 });
  assert.equal(first.diagnosticOnly, true); assert.equal(resumed.sourceId, first.sourceId);
  for (const key of ['counts', 'born', 'work', 'foodWeb', 'backgroundWildlife', 'parentalCare', 'lossesByCause', 'shortfalls'])
    assert.deepEqual(resumed[key], direct[key], key);
  assert.equal(JSON.stringify(snapshot), saved);
  const bad = JSON.parse(saved); bad.account.runId = 'another-run';
  assert.throws(() => run({ days: 2, resume: bad }), /exact private source/);
});
