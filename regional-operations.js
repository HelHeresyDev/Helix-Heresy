(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRegionalOperations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const bound = (s, b) => Boolean(s && b && s.worldId === b.worldId && s.runId === b.runId);
  const LIMITS = 'Separate original sites, people, property and committed accounts. Selecting an account moves nobody and reveals no live remote inventory. Only personally received observations or supported communications are shown. Existing work continues on its own finite resources; an outage is not destruction, and another operation is not a resurrection device.';
  function create(b) {
    return b?.worldId && b?.runId ? { worldId: b.worldId, runId: b.runId, selectedId: null, nodes: [] } : null;
  }
  function normalize(value) {
    if (!value?.worldId || !value.runId || !Array.isArray(value.nodes)) return null;
    const s = create(value), ids = new Set();
    for (const n of value.nodes) {
      if (!n?.id || ids.has(n.id) || !['laboratory', 'refuge'].includes(n.kind) || !n.sourceId || !n.siteId) continue;
      ids.add(n.id);
      s.nodes.push({ id: n.id, kind: n.kind, sourceId: n.sourceId, siteId: n.siteId, label: String(n.label || n.id),
        createdAt: Number.isFinite(n.createdAt) ? Math.max(0, n.createdAt) : 0,
        money: Number.isFinite(n.money) ? Math.max(0, n.money) : 0, report: n.report ? copy(n.report) : null });
    }
    s.selectedId = ids.has(value.selectedId) ? value.selectedId : s.nodes[0]?.id || null;
    return s;
  }
  // Sources are references to canonical consumers, never cloned workers,
  // fixtures, stock, mission progress or wage reserves.
  function register(s, b, source, at) {
    if (!bound(s, b) || !source?.id || !source.sourceId || !source.siteId || !['laboratory', 'refuge'].includes(source.kind) || !Number.isFinite(at)) return null;
    const existing = s.nodes.find(n => n.id === source.id);
    if (existing) return ['kind', 'sourceId', 'siteId'].every(k => existing[k] === source[k]) ? existing : null;
    const n = { id: source.id, kind: source.kind, sourceId: source.sourceId, siteId: source.siteId,
      label: source.label || source.id, createdAt: at, money: 0, report: null };
    s.nodes.push(n); s.selectedId ||= n.id; return n;
  }
  function resolve(s, b, id, sources) {
    if (!bound(s, b)) return null;
    const n = s.nodes.find(n => n.id === id), source = n && sources.find(x => x.id === n.id);
    return n && source && ['kind', 'sourceId', 'siteId'].every(k => source[k] === n[k]) ? { node: n, source } : null;
  }
  function select(s, b, id) {
    if (!bound(s, b) || !s.nodes.some(n => n.id === id)) return false;
    s.selectedId = id; return true;
  }
  function receive(s, b, id, account, receivedAt) {
    const n = bound(s, b) && s.nodes.find(n => n.id === id);
    if (!n || account?.operationId !== id || !Number.isFinite(account.observedAt) || account.observedAt > receivedAt
      || !Number.isFinite(receivedAt) || n.report?.receivedAt > receivedAt) return false;
    n.report = { ...copy(account), receivedAt }; return true;
  }
  function settle(n, wallet, personal) {
    if (!n || n.kind !== 'laboratory' || !personal || !Number.isFinite(n.money) || !(n.money > 0) || !Number.isFinite(wallet?.money)) return false;
    wallet.money += n.money; n.money = 0; return true;
  }
  function publicView(s) {
    return s ? { selectedId: s.selectedId, nodes: s.nodes.map(n => ({ id: n.id, kind: n.kind, siteId: n.siteId,
      label: n.label, createdAt: n.createdAt, report: n.report ? copy(n.report) : null })) } : null;
  }
  function rebind(value, from, to) {
    const s = normalize(value); if (!bound(s, from) || !to?.worldId || !to.runId) return null;
    s.worldId = to.worldId; s.runId = to.runId; return s;
  }
  return { LIMITS, create, normalize, bound, register, resolve, select, receive, settle, publicView, rebind };
});
