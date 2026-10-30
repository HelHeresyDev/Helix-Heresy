const { test } = require('node:test'), assert = require('node:assert/strict');
const Library = require('../world-run-library');
function fixture() {
  const values = new Map(), storage = { getItem: k => values.get(k) || null,
    setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  // Small records isolate repository behavior, not current-world gameplay.
  const world = Library.createWorld({ id: 'cache-world', worldSeed: 'cache-world', generationVersion: 1, createdAt: 'test' });
  const key = Library.WORLD_KEY_PREFIX + world.id;
  storage.setItem(key, JSON.stringify(world));
  return { storage, world, key, repository: Library.createRepository(storage) };
}
test('unchanged bytes are decoded once while every returned world is an independent copy', () => {
  const f = fixture(); f.storage.setItem(f.key, ' \n' + JSON.stringify(f.world) + '\n');
  const raw = f.storage.getItem(f.key), parse = JSON.parse; let decoded = 0;
  // Whitespace distinguishes source decoding from ordinary JSON copy work.
  // Forward every parse unchanged; do not mock validation/generation results.
  JSON.parse = function (value, ...args) { if (value === raw) decoded++; return parse(value, ...args); };
  try {
    const first = f.repository.getWorld(f.world.id); first.name = 'run mutation'; first.generatedData.canonicalState.worldName = 'private mutation';
    const second = f.repository.getWorld(f.world.id); assert.deepEqual(second, f.world); assert.equal(decoded, 1);
    assert.equal(f.storage.getItem(f.key), raw);
  } finally { JSON.parse = parse; }
});
test('changed, invalid and removed records cannot reuse stale validation or repair themselves from cached data', () => {
  const f = fixture(); f.repository.getWorld(f.world.id);
  const tampered = { ...f.world, name: 'changed without a matching canonical digest' };
  f.storage.setItem(f.key, JSON.stringify(tampered));
  assert.throws(() => f.repository.getWorld(f.world.id), /digest/); assert.throws(() => f.repository.getWorld(f.world.id), /digest/);
  f.storage.setItem(f.key, '{broken'); assert.throws(() => f.repository.getWorld(f.world.id));
  f.storage.removeItem(f.key); assert.equal(f.repository.getWorld(f.world.id), null);
  const next = Library.createWorld({ ...f.world, name: 'Legitimately changed world' });
  f.storage.setItem(f.key, Library.compressStorageText(JSON.stringify(next))); assert.deepEqual(f.repository.getWorld(f.world.id), next);
  assert.deepEqual(Library.createRepository(f.storage).getWorld(f.world.id), next); // A fresh repository validates independently.
});
test('putWorld, normal run saves and deletion retain canonical ownership and cached-copy isolation', () => {
  const f = fixture(), stored = f.repository.putWorld(f.world); stored.summary = 'mutated return';
  const run = Library.createRun({ id: 'cache-run', worldId: f.world.id, worldGenerationVersion: f.world.generationVersion,
    canonicalWorldDigest: f.world.canonicalDigest, runSeed: 'run', state: { runEnded: false }, createdAt: 'test' });
  f.repository.putRun(run); assert.deepEqual(f.repository.getWorld(f.world.id), f.world);
  assert.equal(f.repository.getRun(run.id).worldId, f.world.id);
  assert.throws(() => f.repository.deleteWorld(f.world.id), /runs/);
  assert(f.repository.deleteRun(run.id)); assert(f.repository.deleteWorld(f.world.id)); assert.equal(f.repository.getWorld(f.world.id), null);
});
test('bounded cache eviction revalidates the original saved record without changing or conflating worlds', () => {
  const f = fixture(); f.storage.setItem(f.key, ' \n' + JSON.stringify(f.world) + '\n');
  const raw = f.storage.getItem(f.key), parse = JSON.parse; let decoded = 0;
  const others = ['second', 'third'].map(id => Library.createWorld({ id, worldSeed: id, generationVersion: 1, createdAt: 'test' }));
  JSON.parse = function (value, ...args) { if (value === raw) decoded++; return parse(value, ...args); };
  try {
    f.repository.getWorld(f.world.id); assert.equal(decoded, 1);
    f.repository.putWorld(others[0]);
    f.repository.getWorld(f.world.id); // Reading promotes this world over the second.
    f.repository.putWorld(others[1]);
    assert.deepEqual(f.repository.getWorld(f.world.id), f.world); assert.equal(decoded, 1);
    f.repository.getWorld(others[0].id); // Third is evicted; original remains most recently used.
    f.repository.getWorld(others[1].id); // Now the original must be evicted.
    assert.deepEqual(f.repository.getWorld(f.world.id), f.world); assert.equal(decoded, 2);
    const changed = { ...f.world, summary: 'invalid after eviction' }; f.storage.setItem(f.key, JSON.stringify(changed));
    assert.throws(() => f.repository.getWorld(f.world.id), /digest/);
    for (const w of others) assert.deepEqual(f.repository.getWorld(w.id), w);
  } finally { JSON.parse = parse; }
});
test('storage read failure cannot expose a previously cached world as if storage were still valid', () => {
  const f = fixture(); f.repository.getWorld(f.world.id);
  const getItem = f.storage.getItem;
  f.storage.getItem = () => { throw Error('storage unavailable'); };
  assert.throws(() => f.repository.getWorld(f.world.id), /storage unavailable/);
  f.storage.getItem = getItem; assert.deepEqual(f.repository.getWorld(f.world.id), f.world);
});
