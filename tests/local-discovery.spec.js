const { test, expect } = require('@playwright/test');
const Discovery = require('../local-discovery');
const Expeditions = require('../survey-expeditions');
const destination = { id: 'survey:a', cityId: 'a', label: 'Aster Municipal Survey Ground' };
const clone = value => JSON.parse(JSON.stringify(value));

test('materialization is world/place stable, order independent and private until observed', () => {
  const a = Discovery.create(destination, 0), b = Discovery.create(destination, 500);
  const unrelated = Discovery.create({ ...destination, id: 'survey:b' }, 0);
  Discovery.materialize(unrelated, 'world', 'seed');
  expect(Discovery.materialize(a, 'world', 'seed')).toEqual(Discovery.materialize(b, 'world', 'seed'));
  expect(Discovery.publicView(a).records).toHaveLength(2);
  expect(JSON.stringify(Discovery.publicView(a))).not.toMatch(/baseline|bounds|marker|mineral.*potential/);
  const saved = clone(a);
  expect(Discovery.materialize(saved, 'changed', 'changed')).toEqual(a.baseline);
  expect(destination).toEqual({ id: 'survey:a', cityId: 'a', label: 'Aster Municipal Survey Ground' });
});

test('dated observations need proximity and sight, preserve changes and do not refresh unseen truth', () => {
  const state = Discovery.create(destination, 0); Discovery.materialize(state, 'world', 'seed');
  Discovery.observe(state, 10, { x: 10, y: 10, z: 7 }, () => true, false);
  Discovery.observe(state, 10, { x: 10, y: 10, z: 6 }, () => false, false);
  expect(state.records).toHaveLength(2);
  Discovery.observe(state, 20, { x: 10, y: 10, z: 6 }, () => true, false);
  const observed = clone(Discovery.publicView(state));
  Discovery.observe(state, 30, { x: 0, y: 0, z: 6 }, () => true, true);
  expect(Discovery.publicView(state)).toEqual(observed);
  Discovery.observe(state, 40, { x: 15, y: 14, z: 6 }, () => true, true);
  expect(state.records.filter(row => row.subject === 'loose-rock')).toHaveLength(2);
  const saved = Expeditions.normalizeState({ discovery: state });
  expect(saved.discovery).toEqual(state);
  Discovery.observe(saved.discovery, 50, { x: 15, y: 14, z: 6 }, () => true, true);
  expect(saved.discovery).toEqual(state);
  expect(Discovery.create(destination, 60).records).toHaveLength(2);
});

test('limited extracts do not grant broader maps or mineral knowledge and copies survive revocation', () => {
  const state = Discovery.create(destination, 0), before = clone(state.records);
  Discovery.revoke(state);
  const view = Discovery.publicView(state);
  expect(view.accessActive).toBe(false);
  expect(view.records).toEqual(before);
  expect(view.limitations).toContain('not mineral surveys');
  view.records[0].text = 'tampered';
  expect(state.records).toEqual(before);
  const advertised = Expeditions.destinationFor({ nearestSettlementDestinationId: 'city:a', destinations: [{ id: 'city:a', cityId: 'a', label: 'Aster', known: true, supportComponentId: 'one', jurisdiction: { kind: 'city' } }] });
  expect(advertised.publicDanger).not.toMatch(/15,14|10,10/);
  expect(advertised.publicDanger).toContain('withheld');
});
