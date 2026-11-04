(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./divine-bodies') : root.HelixDivineBodies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixDivineWayfinding = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B) {
  'use strict';
  const UNLOCK = 'procedure:divineWayfinding', SCAN = 30, copy = x => JSON.parse(JSON.stringify(x));
  const key = h => `${h.cellId}/${h.cityId ? `survey:${h.cityId}` : h.placeId}`;
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const point = p => p && ['x', 'y', 'z'].every(k => Number.isInteger(p[k]));
  function valid(s) {
    const a = s?.access;
    return Boolean(a && Array.isArray(a.traces) && Array.isArray(a.grounds) && Array.isArray(a.history) && Number.isFinite(a.lastAt)
      && a.traces.every((t, i) => t && t.id === `trace:${i + 1}` && typeof t.key === 'string' && t.cellId && t.placeId && Number.isFinite(t.at))
      && new Set(a.traces.map(t => t?.key)).size === a.traces.length
      && a.grounds.every((g, i) => g && (g.native ? g.roomId === B.ROOM && g.z === 6 : g.roomId === `divine-visited-ground-${i + 1}` && g.z === 200 + i) && a.traces.some(t => t.key === g.key))
      && (!a.active || a.grounds.some(g => g.key === a.active.key) && a.active.origin?.roomId && point(a.active.origin.cell)
        && Number.isInteger(a.active.bodyEpoch) && typeof a.active.returnPaid === 'boolean')
      && (!a.job || ['scan', 'outbound', 'return'].includes(a.job.kind) && point(a.job.cell) && Number.isFinite(a.job.lastAt)
        && a.job.origin?.roomId && point(a.job.origin.cell)
        && Number.isFinite(a.job.progress) && a.job.progress >= 0 && a.job.progress <= a.job.seconds && Number.isFinite(a.job.seconds)
        && a.job.seconds > 0 && Number.isInteger(a.job.bodyEpoch)
        && (a.job.kind !== 'outbound' || a.traces.some(t => t.id === a.job.target?.id && t.key === a.job.target.key)
          && a.job.terms?.feedstock === 4 && Number.isFinite(a.job.terms.mana) && a.job.terms.mana > 0)
        && (a.job.kind !== 'return' || a.active && a.job.bodyEpoch === a.active.bodyEpoch)));
  }
  function ensure(s, book, at) {
    if (!B.bound(s, book)) return null;
    if (!s.access) s.access = { traces: [], grounds: [], active: null, job: null, history: [], lastAt: at };
    return valid(s) ? s.access : null;
  }
  function reason(s, book, stacks, c) {
    if (!B.bound(s, book) || !c.alive || !c.capable || !c.allowed || !c.free) return 'A free, conscious scientist on permitted physical ground is required; custody and other transport are not bypassed.';
    if (!c.wayfinding || !c.researched || c.animancy < 201 || !c.instrument || c.suppressed) return 'Complete Divine Wayfinding and carry a calibrated functioning thaumometer; unsuppressed Animancy is required.';
    if (s.job || s.access && (!valid(s) || s.access.job)) return 'Finish or cancel the current examination or passage first.';
    return '';
  }
  function quote(km) {
    return Number.isFinite(km) && km >= 0 ? { km, mana: 2 * (10 + Math.ceil(km / 5000)), feedstock: 4,
      seconds: 10 + Math.ceil(km / 5000) } : null;
  }
  function begin(s, book, stacks, c, kind, id, at) {
    if (reason(s, book, stacks, c)) return false;
    const a = ensure(s, book, at); if (!a) return false;
    let seconds, target = null, terms = null;
    if (kind === 'scan') {
      if (c.mana < 5 || !B.reagents(stacks, 1, c, true)) return false;
      seconds = SCAN;
    } else if (kind === 'outbound') {
      target = a.traces.find(t => t.id === id);
      if (a.active || !target || !s.bodies.some(b => B.authentic(s, book, b) && key(b.home) === target.key)) return false;
      terms = quote(c.distanceTo(target.cellId));
      if (!terms || c.mana < terms.mana || !B.reagents(stacks, terms.feedstock, c, true)) return false;
      seconds = terms.seconds;
    } else if (kind === 'return') {
      if (!a.active || c.bodyEpoch !== a.active.bodyEpoch || c.roomId !== a.active.roomId || !c.originUsable(a.active.origin)) return false;
      if (!a.active.returnPaid) {
        if (c.mana < 20 || !B.reagents(stacks, 2, c, true)) return false;
        terms = { mana: 20, feedstock: 2 }; a.active.returnPaid = true;
      }
      seconds = a.active.seconds;
    } else return false;
    a.job = { kind, progress: 0, seconds, lastAt: at, ready: true, bodyEpoch: c.bodyEpoch, cell: copy(c.cell), roomId: c.roomId,
      origin: { roomId: c.roomId, cell: copy(c.cell) }, target: copy(target), terms };
    return true;
  }
  function cancel(s, at, message = 'Cancelled; paid power and reagents remain spent.') {
    if (!valid(s) || !s.access.job) return false;
    s.access.history.push({ at, text: message }); s.access.job = null; return true;
  }
  function advance(s, book, c, at, effects = {}) {
    if (!c.alive || !valid(s) || !B.bound(s, book) || at < s.access.lastAt) return false;
    const a = s.access; a.lastAt = at;
    if (a.active && c.bodyEpoch !== a.active.bodyEpoch) {
      a.job = null;
      if (c.roomId === a.active.roomId) { a.active.returnPaid = false; a.active.bodyEpoch = c.bodyEpoch; }
      else a.active = null;
      a.history.push({ at, text: 'Actual bodily recovery ended the old body-bound return allocation. No old mana, cargo or allegiance was restored.' });
      return true;
    }
    const j = a.job; if (!j) return false;
    const ready = c.capable && c.allowed && c.free && c.wayfinding && c.researched && c.instrument && !c.suppressed
      && c.bodyEpoch === j.bodyEpoch && c.roomId === j.roomId && same(c.cell, j.cell);
    if (!ready) return cancel(s, at, 'Movement, injury, suppression, other work or lost support interrupted the held passage. Costs are not refunded.');
    j.progress = Math.min(j.seconds, j.progress + Math.max(0, at - j.lastAt)); j.lastAt = at;
    if (j.progress < j.seconds) return true;
    if (j.kind === 'scan') {
      const candidates = s.bodies.filter(b => B.authentic(s, book, b) && !a.traces.some(t => t.key === key(b.home)))
        .filter(b => Number.isFinite(c.distanceTo(b.home.cellId)))
        .sort((x, y) => c.distanceTo(x.home.cellId) - c.distanceTo(y.home.cellId) || key(x.home).localeCompare(key(y.home)));
      const b = candidates[0];
      if (b) a.traces.push({ id: `trace:${a.traces.length + 1}`, key: key(b.home), at, cellId: b.home.cellId,
        cityId: b.home.cityId, placeId: b.home.cityId ? `survey:${b.home.cityId}` : b.home.placeId,
        label: `Personally measured extraordinary resonance — ${b.home.cellId}` });
      a.history.push({ at, text: b ? 'One physical resonance anchor isolated. Identity, danger and allegiance remain unknown until actual examination.'
        : 'No additional anchor isolated under these conditions. This is not a divine census or proof that no other powers exist.' });
    } else if (j.kind === 'outbound') {
      if (!s.bodies.some(b => B.authentic(s, book, b) && key(b.home) === j.target.key)) return cancel(s, at, 'The bound original ground can no longer be supported. No substitute was created.');
      let g = a.grounds.find(g => g.key === j.target.key);
      if (!g) {
        const native = c.nativeGround?.(j.target);
        g = { ...copy(j.target), native: Boolean(native), roomId: native?.roomId || `divine-visited-ground-${a.grounds.length + 1}`, z: native?.z ?? 200 + a.grounds.length };
        a.grounds.push(g);
      }
      const cell = effects.prepare?.(g); if (!point(cell)) return cancel(s, at, 'Arrival ground is obstructed; the prepaid allocation remains spent.');
      // Re-embed the SAME original bodies on their own physical ground. This
      // changes only the local map coordinate frame, never health or accounts.
      for (const b of s.bodies.filter(b => key(b.home) === g.key)) {
        b.roomId = g.roomId; b.mapCell.z = g.z; b.homeCell.z = g.z;
      }
      a.active = { key: g.key, roomId: g.roomId, origin: j.origin, bodyEpoch: j.bodyEpoch, returnPaid: true, seconds: j.seconds };
      effects.move?.(g.roomId, cell); a.history.push({ at, text: 'The same scientist and actual carried inventory reached the surveyed ground. One return was prepaid; no local stock, protection or healing was granted.' });
    } else {
      if (!a.active || a.active.bodyEpoch !== c.bodyEpoch || !c.originUsable(a.active.origin)) return cancel(s, at, 'The original return ground or body binding is unavailable; no substitute exit was created.');
      const origin = a.active.origin; a.active = null;
      effects.move?.(origin.roomId, origin.cell); a.history.push({ at, text: 'Prepaid return consumed once. Original people, stock and spent power remain where they physically belong.' });
    }
    a.job = null; return true;
  }
  function location(s, roomId) {
    const a = valid(s) && s.access.active, g = a && s.access.grounds.find(g => g.key === a.key);
    return g && g.roomId === roomId ? { field: true, roomId, cellId: g.cellId, cityId: g.cityId, placeId: g.placeId } : null;
  }
  function view(s) { return valid(s) ? copy({ traces: s.access.traces, history: s.access.history, job: s.access.job && { kind: s.access.job.kind, progress: s.access.job.progress, seconds: s.access.job.seconds }, away: Boolean(s.access.active) }) : { traces: [], history: [], job: null, away: false }; }
  return { UNLOCK, SCAN, key, valid, ensure, reason, quote, begin, cancel, advance, location, view };
});
