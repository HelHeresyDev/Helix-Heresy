const { test, expect } = require('@playwright/test');
const Graph = require('../local-patch-graph');
const Foreign = require('../foreign-wilderness');
const Discovery = require('../wilderness-discovery');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const destination = { id: 'wild', label: 'Original wilderness', strategicCellId: 'hex', slopePercent: 10 };
  const w = { destination, context: { worldId: 'world', strategicCellId: 'hex', siteId: 'wild', seed: 'seed', truth: { private: 'SECRET' } },
    roomId: 'wild-room', materialized: true, bounds: { x: 21, y: 8, z: 23, width: 16, height: 12 }, entry: { x: 22, y: 12, z: 23 },
    discovery: Discovery.create(destination, 'foreign') };
  Discovery.materialize(w.discovery, 'world', 'seed', destination, 0, null, w);
  return { w, graph: Graph.create(w) };
}
test('four stable same-hex nodes form a bounded loop and retain the existing eastern identity and positions', () => {
  const { w, graph } = fixture(), ext = Foreign.extensionPlan(w), before = copy(w);
  expect(graph.nodes).toHaveLength(4); expect(graph.links).toHaveLength(4);
  expect(graph.nodes[1]).toMatchObject({ id: ext.id, bounds: ext.bounds, entry: ext.entry });
  expect(new Set(graph.nodes.map(n => n.id)).size).toBe(4);
  for (const node of graph.nodes) expect(Graph.connections(graph, node.id)).toHaveLength(2);
  expect(Graph.create(w)).toEqual(graph); expect(w).toEqual(before); expect(graph.records).toEqual([]);
  expect(JSON.stringify(graph)).not.toMatch(/SECRET|truth|baseline|beasts|permission|owned/);
});
test('two routes converge on the same southeastern node and every link is a reversible one-metre crossing', () => {
  const { graph: g } = fixture(), east = Graph.plan(g, 'wild', 'east'), south = Graph.plan(g, 'wild', 'south');
  expect(Graph.plan(g, east.toId, 'south').toId).toBe(Graph.plan(g, south.toId, 'east').toId);
  for (const n of g.nodes) for (const l of Graph.connections(g, n.id)) {
    const back = Graph.connections(g, l.toId).find(b => b.toId === n.id);
    expect(back.entry).toEqual(l.seam); expect(back.seam).toEqual(l.entry);
    expect(Math.abs(l.entry.x - l.seam.x) + Math.abs(l.entry.y - l.seam.y)).toBe(1);
    expect(Graph.nodeAt(g, l.seam).id).toBe(n.id); expect(Graph.nodeAt(g, l.entry).id).toBe(l.toId);
  }
  expect(Graph.plan(g, 'wild', 'north')).toBeNull(); expect(Graph.plan(g, 'unknown', 'east')).toBeNull();
});
test('approaching an actual edge supplies only one dated direction record, not a remote map', () => {
  const { graph: g } = fixture(), l = Graph.plan(g, 'wild', 'south');
  expect(Graph.observe(g, { ...l.seam, y: l.seam.y - 1 }, 10)).toEqual(g);
  const seen = Graph.observe(g, l.seam, 10), publicView = Graph.publicKnowledge(seen);
  expect(publicView).toHaveLength(1); expect(publicView[0]).toMatchObject({ kind: 'edge', fromId: 'wild', at: 10, cell: l.seam });
  expect(JSON.stringify(publicView)).not.toMatch(/nodes|links|bounds|baseline|SECRET/);
  expect(Graph.observe(seen, l.seam, 100)).toEqual(seen); expect(g.records).toEqual([]);
});
test('only actual adjacent physical steps can record a crossing; selection and coordinate jumps cannot', () => {
  const { graph: g } = fixture(), l = Graph.plan(g, 'wild', 'south');
  expect(Graph.recordStep(g, l.seam, l.entry, 20).records[0]).toMatchObject({ kind: 'crossing', fromId: 'wild', toId: l.toId, at: 20 });
  for (const [a, b] of [[null, null], [l.seam, { ...l.entry, z: 24 }], [l.seam, { ...l.entry, y: l.entry.y + 2 }],
    [l.seam, { ...l.entry, x: 22.5 }], [l.seam, l.seam]]) expect(Graph.recordStep(g, a, b, 30)).toEqual(g);
  const crossed = Graph.recordStep(g, l.seam, l.entry, 20);
  expect(Graph.recordStep(crossed, l.seam, l.entry, 100)).toEqual(crossed);
  expect(Graph.recordStep(crossed, l.entry, l.seam, 30).records).toHaveLength(2);
});
test('all graph entrances and return edges are natural clear connected ground regardless of entry order', () => {
  const { w, graph: g } = fixture();
  for (const node of g.nodes) {
    const destination = { ...w.destination, id: node.id }, layout = { bounds: node.bounds, entry: node.entry };
    const d = node.id === w.context.siteId ? w.discovery : Discovery.create(destination, 'adjoining');
    const b = Discovery.materialize(d, 'world', 'seed', destination, 10, null, layout);
    expect(Discovery.connected(b.cells, node.entry)).toBe(true);
    for (const l of Graph.connections(g, node.id)) expect(b.cells).toContainEqual(l.seam);
    expect(Discovery.materialize(copy(d), 'world', 'changed-seed', destination, 1000, null, layout)).toEqual(b);
  }
});
test('graph records survive save normalization without private extras or regenerated dates', () => {
  const { w, graph } = fixture(), l = Graph.plan(graph, 'wild', 'east');
  const saved = Graph.recordStep(Graph.observe(graph, l.seam, 2), l.seam, l.entry, 3);
  expect(Graph.normalize(JSON.parse(JSON.stringify({ ...saved, secret: 'SECRET' })), w)).toEqual(saved);
  expect(Graph.bound(saved, { ...w, context: { ...w.context, worldId: 'other' } })).toBe(false);
  expect(Graph.normalize(saved, { ...w, context: { ...w.context, siteId: 'other' } })).toBeNull();
  expect(Graph.normalize({ ...saved, nodes: [] }, w)).toBeNull();
  expect(Graph.normalize({ ...saved, records: [...saved.records, { ...saved.records[0], id: 'fabricated' }] }, w)).toEqual(saved);
});
test('death freezes observations/crossings and a fresh run starts without personal graph records', () => {
  const { w, graph } = fixture(), l = Graph.plan(graph, 'wild', 'east');
  const saved = Graph.observe(graph, l.seam, 10);
  expect(Graph.observe(saved, l.entry, 20, false)).toEqual(saved);
  expect(Graph.recordStep(saved, l.seam, l.entry, 20, false)).toEqual(saved);
  expect(Graph.create(w).records).toEqual([]); expect(Graph.observe(saved, l.entry, NaN)).toEqual(saved);
});
test('an older visited adjoining pair gains graph identity without rewriting terrain, goods, source changes or people', () => {
  const { w } = fixture(); w.extension = Foreign.extensionPlan(w);
  w.extension.discovery = Discovery.create(w.extension.destination, 'adjoining');
  Discovery.materialize(w.extension.discovery, 'world', 'older-seed', w.extension.destination, 5, null, w.extension);
  w.extension.materialized = true; w.extension.visitedAt = 5;
  w.extension.discovery.records.push({ id: 'old-note', at: 6, text: 'Original dated observation' });
  w.beasts = { actors: [{ id: 'original', health: 21, nextAttackAt: 80 }] };
  const before = copy(w), graph = Graph.create(w);
  expect(graph.nodes[1]).toMatchObject({ id: w.extension.id, bounds: w.extension.bounds, entry: w.extension.entry });
  expect(graph.records).toEqual([]); expect(Graph.normalize(graph, w)).toEqual(graph); expect(w).toEqual(before);
  expect(Graph.bound({}, null)).toBe(false); expect(Graph.normalize({}, null)).toBeNull();
});
