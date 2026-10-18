(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLocalPatchGraph = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const inside = (b, c) => b && c && ['x', 'y', 'z'].every(k => Number.isInteger(c[k])) && c.z === b.z
    && c.x >= b.x && c.x < b.x + b.width && c.y >= b.y && c.y < b.y + b.height;
  const date = x => Number.isFinite(x) && x >= 0;
  // Geometry only, never terrain, resources, actors or public knowledge. The
  // saved root/east identities and footprints are the original adjoining pair.
  function create(root) {
    const b = root?.bounds, id = root?.context?.siteId;
    if (!root?.discovery?.baseline || !id || !root.context.worldId || !root.context.strategicCellId
      || !b || !['x', 'y', 'z', 'width', 'height'].every(k => Number.isInteger(b[k])) || b.width < 3 || b.height < 5) return null;
    const nodes = [[0, 0, id], [1, 0, `${id}:adjoining-east`], [0, 1, `${id}:adjoining-south`], [1, 1, `${id}:adjoining-southeast`]]
      .map(([column, row, siteId]) => ({ id: siteId, column, row,
        bounds: { ...copy(b), x: b.x + column * b.width, y: b.y + row * b.height },
        entry: column === 0 && row === 0 ? copy(root.entry)
          : column === 1 && row === 0 ? { x: b.x + b.width, y: root.entry.y, z: b.z }
            : { x: b.x + column * b.width + 1, y: root.entry.y + b.height, z: b.z } }));
    const links = [];
    for (const a of nodes) for (const d of ['east', 'south']) {
      const n = nodes.find(n => n.column === a.column + (d === 'east' ? 1 : 0) && n.row === a.row + (d === 'south' ? 1 : 0));
      if (!n) continue;
      const cellA = d === 'east' ? { x: a.bounds.x + b.width - 1, y: root.entry.y + a.row * b.height, z: b.z }
        : { x: a.bounds.x + 1, y: a.bounds.y + b.height - 1, z: b.z };
      links.push({ id: `${a.id}:${d}`, a: a.id, b: n.id, direction: d, cellA,
        cellB: { ...cellA, x: cellA.x + (d === 'east' ? 1 : 0), y: cellA.y + (d === 'south' ? 1 : 0) } });
    }
    return { worldId: root.context.worldId, strategicCellId: root.context.strategicCellId, rootSiteId: id, nodes, links, records: [] };
  }
  function bound(graph, root) {
    return Boolean(graph && root?.context && graph.worldId === root.context.worldId && graph.strategicCellId === root.context.strategicCellId
      && graph.rootSiteId === root.context.siteId);
  }
  function normalize(graph, root) {
    const expected = create(root);
    if (!expected || !bound(graph, root) || JSON.stringify(graph.nodes) !== JSON.stringify(expected.nodes)
      || JSON.stringify(graph.links) !== JSON.stringify(expected.links)) return null;
    const seen = new Set();
    expected.records = (Array.isArray(graph.records) ? graph.records : []).filter(r => {
      const link = connections(expected, r?.fromId).find(l => l.toId === r.toId && l.id === r.linkId);
      return link && ['edge', 'crossing'].includes(r.kind) && date(r.at) && typeof r.text === 'string'
        && r.id === `${link.id}:${r.kind === 'edge' ? 'edge' : 'crossed'}:${r.fromId}`
        && (r.kind === 'edge' ? same(link.seam, r.cell) : inside(expected.nodes.find(n => n.id === r.toId).bounds, r.cell))
        && !seen.has(r.id) && seen.add(r.id);
    }).map(r => ({ id: r.id, linkId: r.linkId, fromId: r.fromId, toId: r.toId, kind: r.kind, at: r.at,
      cell: { x: r.cell.x, y: r.cell.y, z: r.cell.z }, text: r.text.slice(0, 1200) }));
    return expected;
  }
  function nodeAt(graph, cell) { return graph?.nodes.find(n => inside(n.bounds, cell)) || null; }
  function connections(graph, fromId) {
    return (graph?.links || []).filter(l => l.a === fromId || l.b === fromId).map(l => ({ id: l.id, fromId,
      toId: l.a === fromId ? l.b : l.a, direction: l.a === fromId ? l.direction : l.direction === 'east' ? 'west' : 'north',
      seam: copy(l.a === fromId ? l.cellA : l.cellB), entry: copy(l.a === fromId ? l.cellB : l.cellA) }));
  }
  function plan(graph, fromId, direction) { return connections(graph, fromId).find(l => l.direction === direction) || null; }
  function observe(graph, cell, at, alive = true) {
    if (!graph || !alive || !date(at)) return graph;
    const s = copy(graph), from = nodeAt(s, cell);
    if (!from) return s;
    for (const l of connections(s, from.id)) if (same(l.seam, cell) && !s.records.some(r => r.id === `${l.id}:edge:${from.id}`))
      s.records.push({ id: `${l.id}:edge:${from.id}`, linkId: l.id, fromId: from.id, toId: l.toId, kind: 'edge', at, cell: copy(cell),
        text: `Personally reached the ${l.direction} local edge. Immediately adjoining ground is unprotected; this is not an onward survey or a safe route.` });
    return s;
  }
  function recordStep(graph, fromCell, toCell, at, alive = true) {
    if (!graph || !alive || !date(at) || !fromCell || !toCell || fromCell.z !== toCell.z
      || !['x', 'y', 'z'].every(k => Number.isInteger(fromCell[k]) && Number.isInteger(toCell[k]))
      || Math.abs(fromCell.x - toCell.x) + Math.abs(fromCell.y - toCell.y) !== 1) return graph;
    const from = nodeAt(graph, fromCell), to = nodeAt(graph, toCell);
    const l = from && to && connections(graph, from.id).find(l => l.toId === to.id);
    if (!l || graph.records.some(r => r.id === `${l.id}:crossed:${from.id}`)) return graph;
    const s = copy(graph);
    s.records.push({ id: `${l.id}:crossed:${from.id}`, linkId: l.id, fromId: from.id, toId: to.id, kind: 'crossing', at, cell: copy(toCell),
      text: `Personally walked the ${l.direction} connection to adjoining local ground within the same globe hex. No defended seam, current safety or access right follows.` });
    return s;
  }
  function publicKnowledge(graph) {
    return (graph?.records || []).map(r => ({ id: r.id, fromId: r.fromId, toId: r.toId, kind: r.kind, at: r.at,
      cell: copy(r.cell), text: r.text, source: 'Scientist physical local-route observation' }));
  }
  return { create, bound, normalize, nodeAt, connections, plan, observe, recordStep, publicKnowledge };
});
