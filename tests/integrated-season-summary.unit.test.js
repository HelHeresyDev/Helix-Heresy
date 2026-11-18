const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), { membership } = require('../scripts/summarize-integrated-season');
const { source } = require('./helpers/regional-foodweb-source');
test('integrated membership summary conserves distinct species without changing a private account', () => {
  const s = P.create(source(), { worldId: 'summary-control', runId: 'private' });
  P.advance(s, P.DAY, true, true); const before = JSON.stringify(s), rows = membership(s);
  assert.deepEqual(Object.keys(rows).sort(), ['beast:glasswing-roc', 'beast:storm-kite']);
  for (const r of Object.values(rows)) assert.equal(r.original + r.born, r.living + r.dead);
  assert.equal(rows['beast:glasswing-roc'].original, 2); assert.equal(rows['beast:storm-kite'].original, 4);
  assert.equal(JSON.stringify(s), before);
});
test('integrated summary cannot hide an invented birth or unassigned species', () => {
  const s = P.create(source(), { worldId: 'summary-control', runId: 'private' });
  s.births.push({ populationId: 'population-0', originId: 'invented', count: 1 });
  assert.throws(() => membership(s), /membership|source|conserv|Birth/);
});
