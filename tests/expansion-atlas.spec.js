const { test, expect } = require('@playwright/test');
const Atlas = require('../expansion-atlas');
const binding = { worldId: 'world', runId: 'run' };
const site = { id: 'ground', label: 'Known Ground', cityId: 'city', globeCellId: 'hex', kind: 'wilderness' };
const row = (f = {}, place = site) => ({ site: place, fact: { id: 'observation', category: 'terrain', sourceId: 'observer:record', source: 'Personal observation',
  subject: 'outcrop', sourceAt: 2, receivedAt: 2, text: 'Surface outcrop seen; reserves unconfirmed', coverage: 'Observed point only', cell: { x: 5, y: 6, z: 7 }, ...f } });
const merge = (rows, before = null, at = 10, alive = true) => Atlas.merge(before, binding, rows, at, alive);
test('indexes only whitelisted known facts without copying private geography, reserves or rights', () => {
  const input = row({ truth: { reserve: 99999 }, privatePolicy: 'SECRET' }, { ...site, baseline: { cells: ['SECRET'] }, owner: 'scientist' });
  const before = JSON.stringify(input), s = merge([input]);
  expect(s.entries[0]).toMatchObject({ id: 'ground', globeCellId: 'hex', facts: [{ sourceAt: 2, receivedAt: 2, indexedAt: 10 }] });
  expect(JSON.stringify(s)).not.toMatch(/SECRET|99999|baseline|owner|privatePolicy/); expect(JSON.stringify(input)).toBe(before);
});
test('reopening/reindexing never changes original source, receipt or indexing dates', () => {
  const s = merge([row()]); expect(merge([row()], s, 100)).toEqual(s);
  const unknown = merge([row({ id: 'archive', category: 'route', sourceAt: null, receivedAt: 8 })]);
  expect(unknown.entries[0].facts[0]).toMatchObject({ sourceAt: null, receivedAt: 8, indexedAt: 10 });
  expect(merge([row({ id: 'archive', category: 'route', sourceAt: null, receivedAt: 8 })], unknown, 100)).toEqual(unknown);
});
test('different accounts and dates remain separate, without inferring which reflects current truth', () => {
  const s = merge([row(), row({ sourceId: 'other-account', source: 'Received report', receivedAt: 9, sourceAt: 1, text: 'Outcrop inaccessible according to this account' })]);
  expect(s.entries[0].facts).toHaveLength(2); expect(s.entries[0].facts.map(f => f.sourceAt)).toEqual([2, 1]);
  expect(s).not.toHaveProperty('resolvedTruth');
  expect(merge([row({ text: 'Previously seen rock cleared', sourceAt: 15, receivedAt: 15 })], s, 20).entries[0].facts).toHaveLength(3);
});
test('repeat received operational confirmations retain their first dates and latest actual receipt only', () => {
  const s = merge([row({ category: 'operations', sourceAt: 5, receivedAt: 5, text: 'Counter service unavailable' })]);
  const later = merge([row({ category: 'operations', sourceAt: 15, receivedAt: 15, text: 'Counter service unavailable' })], s, 20);
  expect(later.entries[0].facts).toHaveLength(1);
  expect(later.entries[0].facts[0]).toMatchObject({ sourceAt: 5, receivedAt: 5, lastReceivedAt: 15, indexedAt: 10 });
  expect(merge([], later, 100)).toEqual(later);
});
test('listings, terrain, routes, resource evidence, rights and operations do not confer each other', () => {
  const records = ['listing', 'terrain', 'route', 'resources', 'rights', 'operations'].map(category => row({ id: category, category }));
  const s = merge(records); expect(s.entries[0].facts.map(f => f.category)).toEqual(records.map(r => r.fact.category));
  expect(JSON.stringify(s)).not.toMatch(/owned|safePassage|wholeCellSurveyed|grantsExtractionRights/);
});
test('known objective selection, change and clearing affect only the plan', () => {
  const s = merge([row(), row({}, { ...site, id: 'other', kind: 'survey' })]), before = JSON.stringify(s);
  const selected = Atlas.select(s, site.id, 'investigate', 10);
  expect(selected.objective).toEqual({ siteId: 'ground', purpose: 'investigate', at: 10 }); expect(selected.entries).toEqual(s.entries);
  expect(JSON.stringify(s)).toBe(before);
  expect(Atlas.select(selected, 'other', 'revisit', 20).objective.siteId).toBe('other');
  expect(Atlas.select(selected, null, '', 20).objective).toBeNull();
  expect(Atlas.select(selected, 'unknown', 'investigate', 20)).toEqual(selected);
  expect(Atlas.select(selected, site.id, 'conquer', 20)).toEqual(selected);
  expect(Atlas.select(selected, 'other', 'revisit', 20, false)).toEqual(selected);
});
test('future-dated and malformed evidence cannot enter an earlier index', () => {
  expect(merge([row({ receivedAt: 11 }), row({ sourceAt: 11 }), row({ sourceId: '' }), row({ category: 'privateTruth' })]).entries).toEqual([]);
  expect(merge([row({ cell: { x: 1.5, y: 2, z: 3 } })]).entries[0].facts[0].cell).toBeNull();
  expect(merge([row()], null, NaN)).toBeNull();
});
test('death freezes indexing and new unrelated run/world bindings cannot mutate the original atlas', () => {
  const s = merge([row()]); expect(merge([row({ id: 'new' })], s, 100, false)).toEqual(s);
  expect(Atlas.merge(s, { ...binding, runId: 'other' }, [], 100)).toEqual(s);
  expect(Atlas.merge(s, { ...binding, worldId: 'other' }, [], 100)).toEqual(s);
  const fresh = Atlas.merge(null, { ...binding, runId: 'other' }, [], 100);
  expect(fresh.entries).toEqual([]); expect(fresh.objective).toBeNull();
});
test('normalization round trips plans and omits extra canonical data; an absent target cannot survive', () => {
  const s = Atlas.select(merge([row()]), site.id, 'revisit', 10);
  expect(Atlas.normalize(JSON.parse(JSON.stringify({ ...s, secret: 'SECRET' })))).toEqual(s);
  expect(Atlas.normalize({ ...s, entries: [] }).objective).toBeNull();
  expect(Atlas.normalize(null)).toBeNull();
  expect(Atlas.normalize({ ...s, entries: {} }).entries).toEqual([]);
});
test('validated continued-save imports rebind the copied atlas and plan without modifying the original', () => {
  const s = Atlas.select(merge([row()]), site.id, 'investigate', 10), before = JSON.stringify(s), to = { worldId: 'copy-world', runId: 'copy-run' };
  const copy = Atlas.rebind(s, binding, to);
  expect(copy).toMatchObject(to); expect(copy.entries).toEqual(s.entries); expect(copy.objective).toEqual(s.objective);
  expect(JSON.stringify(s)).toBe(before); expect(Atlas.rebind(s, { ...binding, runId: 'unrelated' }, to)).toEqual(s);
});
test('a later acquired anchor fills missing metadata without fabricating a location in advance', () => {
  const s = merge([row({}, { ...site, globeCellId: '' })]); expect(s.entries[0].globeCellId).toBe('');
  expect(merge([row({ id: 'new' })], s).entries[0].globeCellId).toBe('hex');
});
test('unreceived nonpublic accounts are not evidence and a large legitimate history does not discard an old acquired copy', () => {
  expect(merge([row({ category: 'route', receivedAt: null })]).entries).toEqual([]);
  const s = merge([row({ id: 'old-copy', category: 'route', sourceAt: null })]);
  const many = Array.from({ length: 320 }, (_, i) => row({ id: `observation-${i}` }));
  const indexed = merge(many, s, 20);
  expect(indexed.entries[0].facts).toHaveLength(321);
  expect(indexed.entries[0].facts[0]).toEqual(s.entries[0].facts[0]);
  expect(merge(many, indexed, 100)).toEqual(indexed);
});
