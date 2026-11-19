const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library');
test('packed storage preserves Unicode, dictionary growth/reset and raw UTF-16 code units losslessly', () => {
  const bytes = new Uint8Array(4 * 1024 * 1024); let seed = 413;
  for (let i = 0; i < bytes.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    bytes[i] = 32 + (seed >>> 0) % 64;
  }
  const text = '🛰️ 魔法 habitat\n' + new TextDecoder().decode(bytes), packed = L.compressStorageText(text);
  assert.ok(packed.startsWith('lzp:'));
  assert.equal(L.decompressStorageText(packed), text);
  assert.equal(L.decompressStorageText(L.compressStorageText('magic 🛰️ relays')), 'magic 🛰️ relays');
  assert.equal(L.decompressStorageText('plain legacy JSON'), 'plain legacy JSON');
  assert.throws(() => L.decompressStorageText(packed.slice(0, -1)), /truncated|corrupt/);
  assert.throws(() => L.decompressStorageText(packed + 'x'), /padding/);
  for (const value of ['lzp:nope:x', 'lzp:999999999999:x', 'lzp:0:'])
    assert.throws(() => L.decompressStorageText(value), /corrupt/);
});
test('saving a run losslessly repacks only its large legacy world without deleting branches', () => {
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const repository = L.createRepository(storage);
  const world = repository.putWorld(L.createWorld({ id: 'legacy-storage', worldSeed: 'codec-control', generationVersion: 1,
    generatedData: { originalArchive: 'finite original physical record '.repeat(50000) }, createdAt: 'test' }));
  const base = { worldId: world.id, worldGenerationVersion: world.generationVersion, canonicalWorldDigest: world.canonicalDigest,
    scenario: { id: 'chemistryFront' }, state: { started: true, clock: 0 } };
  const a = repository.putRun(L.createRun({ ...base, id: 'a', runSeed: 'a' }));
  // Literal-byte LZW is a valid old stream, including the saturated dictionary.
  const text = JSON.stringify(world), bytes = new TextEncoder().encode(text); let legacy = 'lz16:';
  for (let i = 0; i < bytes.length; i += 8192) legacy += String.fromCharCode(...bytes.slice(i, i + 8192));
  const key = `${L.WORLD_KEY_PREFIX}${world.id}`; storage.setItem(key, legacy);
  assert.equal(L.decompressStorageText(legacy), text);
  repository.putRun(L.createRun({ ...base, id: 'b', runSeed: 'b' }));
  assert.ok(storage.getItem(key).startsWith('lzp:'));
  assert.equal(L.decompressStorageText(storage.getItem(key)), text);
  assert.deepEqual(repository.getWorld(world.id), world); assert.deepEqual(repository.getRun('a'), a);
  assert.equal(repository.getRun('b').id, 'b');
});
