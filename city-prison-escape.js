(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityPrisonEscape = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const phases = ['escapeAttempt', 'escaped', 'escapeEscort'];
  function ensure(p) {
    return p.escape ||= { facts: [], reports: [], interruptions: [], suspendedAt: null, work: null, restraint: 0, restrained: false, searchUntil: null, lastSeenAt: null, lastKnown: null, noticeSerial: 0 };
  }
  function observe(p, actorId, kind, cell, now) {
    const e = ensure(p);
    if (!e.reports.some(r => r.actorId === actorId && r.kind === kind)) {
      e.reports.push({ actorId, kind, cell: { ...cell }, at: now, allegationOnly: true }); e.noticeSerial++;
    }
    if (e.lastSeenAt == null || now - e.lastSeenAt > 20) e.searchUntil = now + 120;
    e.lastSeenAt = now; e.lastKnown = { ...cell };
  }
  function target(p, now) { const e = ensure(p); return e.lastKnown && now < e.searchUntil && now - e.lastSeenAt <= 20 ? e.lastKnown : null; }
  function escape(p, s, now, facts) {
    const e = ensure(p);
    if (p.phase !== 'escapeAttempt' || p.releasedAt != null || now >= p.termEndsAt || !facts.mobile || !facts.outside || facts.controlled || e.lastSeenAt != null && now - e.lastSeenAt < 10) return false;
    s.ledger.remainingSeconds = p.termEndsAt - now;
    p.serviceSeconds = Math.max(0, now - p.admittedAt - e.interruptions.reduce((n, i) => n + (i.to == null ? 0 : i.to - i.from), 0)); s.ledger.prisonServedSeconds = p.serviceSeconds;
    e.interruptions.push({ from: now, to: null, remainingSeconds: s.ledger.remainingSeconds });
    e.suspendedAt = now; e.work = null; p.phase = 'escaped'; e.noticeSerial++; return true;
  }
  function recapture(p, s, now) {
    const e = ensure(p); if (p.releasedAt != null || e.restrained || !phases.includes(p.phase)) return false;
    if (e.suspendedAt != null) { const row = e.interruptions.at(-1); row.to = Math.max(now, row.from); p.termEndsAt += row.to - row.from; e.suspendedAt = null; }
    e.restrained = true; e.work = null; p.phase = 'escapeEscort'; e.noticeSerial++; return true;
  }
  return { phases, ensure, observe, target, escape, recapture };
});
