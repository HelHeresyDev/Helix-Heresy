(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixBeastClimbing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SPECIES = 'beast:mirror-ape', STAMINA = 120, SPEED = .25;
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const cell = p => p && ['x', 'y', 'z'].every(k => Number.isInteger(p[k]));
  const same = (a, b) => cell(a) && cell(b) && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const distance = (a, b) => !cell(a) || !cell(b) || a.z !== b.z ? Infinity : Math.hypot(a.x - b.x, a.y - b.y);
  const finite = x => Number.isFinite(x) && x >= 0;
  function validSurface(f, site) {
    return Boolean(typeof f?.id === 'string' && f.id && typeof f.sourceCellId === 'string' && f.sourceCellId && ['tree', 'rockFace'].includes(f.kind) && cell(f.cell)
      && [f.heightM, f.grip, f.clearanceM, f.maxLoadKg, f.condition, f.cover].every(finite)
      && f.heightM >= 2 && f.heightM <= 6 && f.grip >= 0 && f.grip <= 1 && f.clearanceM >= 0
      && f.maxLoadKg > 0 && finite(f.condition) && f.condition <= 100 && f.cover >= 0 && f.cover <= .5
      && site?.baseline?.some(t => same(t.cell, f.cell)) && f.cell.y !== site.entry.y);
  }
  // Original local terrain recipe, independent of the presence, strength or
  // personality of an ape. No construction, ward, roof or map-layer connector.
  function surfaces(site, source) {
    if (!source?.sourceCellId || !['B', 'F', 'R', 'Y'].includes(source.biomeCode)) return [];
    const rows = [{ kind: 'tree', cell: { x: 12, y: 8, z: site.entry.z }, heightM: 4, grip: .9, cover: .3 }];
    if (source.slopePercent >= 15) rows.push({ kind: 'rockFace', cell: { x: 13, y: 13, z: site.entry.z }, heightM: 2.5, grip: .7, cover: .1 });
    else rows.push({ kind: 'tree', cell: { x: 12, y: 13, z: site.entry.z }, heightM: 4, grip: .85, cover: .3 });
    return rows.map((r, i) => ({ ...r, id: `${site.id}:natural-climb:${i}`, sourceCellId: source.sourceCellId,
      clearanceM: 2.5, maxLoadKg: 160, condition: 100 })).filter(r => validSurface(r, site));
  }
  function normalizeSurfaces(rows, site) {
    if (!Array.isArray(rows) || rows.some(f => !validSurface(f, site)) || new Set(rows.map(f => f.id)).size !== rows.length) return null;
    return copy(rows);
  }
  function normalizeActor(a) {
    if (!a || a.speciesId !== SPECIES) return a;
    // Missing legacy stamina is unknown, never another endowment on load.
    if (a.climbStamina != null && (!finite(a.climbStamina) || a.climbStamina > STAMINA)) a.climbingInvalid = true;
    const c = a.climbing;
    if (c && (!finite(a.climbStamina) || !finite(a.climbMassKg))) a.climbingInvalid = true;
    if (c && (!c.surfaceId || !c.siteId || !cell(c.entry) || !cell(c.exit) || !cell(c.top)
      || !finite(c.heightM) || !finite(c.lastAt) || typeof c.wasReady !== 'boolean'
      || !['ascending', 'perched', 'descending', 'landingBlocked'].includes(c.mode)
      || !finite(c.maximumHeightM) || c.heightM > c.maximumHeightM || c.maximumHeightM > 6
      || ![c.entry, c.top, c.exit].some(p => same(p, a.mapCell)))) a.climbingInvalid = true;
    return a;
  }
  const height = a => a?.climbingInvalid ? Infinity : a?.speciesId === SPECIES && a.climbing ? a.climbing.heightM : 0;
  const neighbors = p => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => ({ x: p.x + x, y: p.y + y, z: p.z }));
  const capable = (a, c) => a?.speciesId === SPECIES && !a.climbingInvalid && a.status === 'alive'
    && a.health >= a.maxHealth * .2 && finite(a.climbStamina) && a.climbStamina > 0 && c.gripAble !== false && !c.incapacitated;
  const usable = (f, a) => f && f.condition >= 50 && f.grip >= .5 && f.clearanceM >= 1.8 && f.maxLoadKg >= a.climbMassKg;
  function finish(a, at) { a.climbing = null; a.nextClimbAt = at + 60; a.nextMoveAt = at + 2; }
  function fall(a, site, c, at, reason) {
    const p = a.climbing; if (!p) return false;
    const landing = [p.entry, p.exit, ...neighbors(a.mapCell)].find(t => c.canEnter(t));
    if (!landing) { p.mode = 'landingBlocked'; p.wasReady = false; p.lastAt = at; return true; }
    const metres = p.heightM; a.mapCell = copy(landing);
    a.lastClimbEvent = { at, siteId: site?.id || p.siteId, kind: 'fall', heightM: metres, reason, cell: copy(landing) };
    finish(a, at); c.damage?.(Math.ceil(metres * 5), 'Fall from a natural climbing surface'); return true;
  }
  function interrupt(a, site, c, at, damage = 0) {
    return a?.climbing && height(a) > 0 && (damage >= 6 || !capable(a, c)) ? fall(a, site, c, at, 'Impact or loss of bodily grip') : false;
  }
  function plan(a, site, decision, at, c) {
    if (!capable(a, c) || a.climbing || at < (a.nextClimbAt || 0) || c.dialogue || !c.local
      || !['flee', 'pursue', 'investigate'].includes(decision?.behavior) || !decision.goal) return null;
    if (decision.behavior !== 'flee' && !(at < a.provokedUntil && a.targetId && !c.protectedTarget?.(a.targetId))) return null;
    const options = (site.climbSurfaces || []).filter(f => usable(f, a) && a.climbStamina >= f.heightM * 3 + 4)
      .sort((f, g) => distance(a.mapCell, f.cell) - distance(a.mapCell, g.cell) || f.id.localeCompare(g.id));
    for (const f of options) {
      const entries = neighbors(f.cell).filter(c.canEnter).sort((p, q) => distance(a.mapCell, p) - distance(a.mapCell, q));
      for (const entry of entries) {
        const exit = neighbors(f.cell).filter(p => !same(p, entry) && c.canEnter(p))
          .sort((p, q) => distance(q, decision.goal) - distance(p, decision.goal))[0];
        if (!exit || !c.topClear(f.cell, f.heightM)) continue;
        if (!same(a.mapCell, entry)) {
          const next = c.nextStep(a.mapCell, entry); if (next) return { next, behavior: 'seekClimb' };
        } else {
          a.climbing = { surfaceId: f.id, siteId: site.id, entry: copy(entry), exit: copy(exit), top: copy(f.cell),
            maximumHeightM: f.heightM, heightM: 0, mode: 'ascending', lastAt: at, wasReady: true, perchedAt: null };
          a.climbing.visitAt = site.lastVisitedAt;
          a.lastClimbEvent = { at, siteId: site.id, kind: 'started', heightM: 0, cell: copy(a.mapCell) };
          return { climbing: true, behavior: 'climbing' };
        }
      }
    }
    return null;
  }
  function advance(a, site, c, at) {
    const p = a?.climbing;
    if (!p || a.climbingInvalid || !c.alive || at <= p.lastAt) return false;
    const dt = at - p.lastAt; p.lastAt = at;
    const f = site?.climbSurfaces?.find(f => f.id === p.surfaceId);
    if (!c.local) { p.wasReady = false; return false; }
    if (p.visitAt !== site.lastVisitedAt) { p.visitAt = site.lastVisitedAt; p.wasReady = false; return false; }
    if (!f || site.id !== p.siteId || f.heightM !== p.maximumHeightM || !usable(f, a) || !capable(a, c) || a.status !== 'alive')
      return fall(a, site, c, at, 'Original support or bodily grip unavailable');
    const ready = c.gripAble !== false && !c.incapacitated;
    if (p.mode === 'landingBlocked') return fall(a, site, c, at, 'Landing ground became available');
    if (!p.wasReady) { p.wasReady = ready; return false; }
    if (p.mode === 'perched') {
      a.climbStamina = Math.max(0, a.climbStamina - Math.min(dt, 8) * .25);
      if (!a.climbStamina) return fall(a, site, c, at, 'Original climbing stamina exhausted');
      if (at - p.perchedAt >= 8 || a.climbStamina < p.heightM + 3 || c.dialogue) {
        const exit = [p.exit, p.entry].find(t => c.canEnter(t) && c.topClear(t, p.heightM));
        if (exit) { a.mapCell = copy(exit); p.mode = 'descending'; }
      }
      return true;
    }
    const costPerM = p.mode === 'ascending' ? 2 : 1,
      metres = Math.min(dt * SPEED / Math.max(1, c.movementFactor || 1), a.climbStamina / costPerM,
        p.mode === 'ascending' ? f.heightM - p.heightM : p.heightM);
    if (p.mode === 'ascending' && p.heightM + metres >= f.heightM && !c.topClear(f.cell, f.heightM)) { p.mode = 'descending'; return true; }
    a.climbStamina = Math.max(0, a.climbStamina - metres * costPerM);
    p.heightM += p.mode === 'ascending' ? metres : -metres;
    if (p.mode === 'ascending' && p.heightM >= f.heightM) {
      a.mapCell = copy(f.cell); p.mode = 'perched'; p.perchedAt = at;
      a.lastClimbEvent = { at, siteId: site.id, kind: 'perched', heightM: p.heightM, cell: copy(a.mapCell) };
    } else if (p.mode === 'descending' && p.heightM <= 0) {
      const landing = [p.exit, p.entry].find(c.canEnter);
      if (!landing) { p.heightM = .25; p.mode = 'landingBlocked'; return true; }
      a.mapCell = copy(landing); a.lastClimbEvent = { at, siteId: site.id, kind: 'descended', heightM: 0, cell: copy(landing) }; finish(a, at);
    }
    if (a.climbing && !a.climbStamina) return fall(a, site, c, at, 'Original climbing stamina exhausted');
    return metres > 0;
  }
  // Same outdoor patch only. Existing opaque buildings/doors remain the
  // caller's responsibility; altitude never bypasses an unknown roof or ward.
  function lineClear(from, fromHeight, to, toHeight, rows) {
    if (!cell(from) || !cell(to) || from.z !== to.z || !finite(fromHeight) || !finite(toHeight)) return false;
    const steps = Math.max(1, Math.ceil(distance(from, to) * 8));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t, h = fromHeight + (toHeight - fromHeight) * t;
      if ((rows || []).some(f => f.condition > 0 && Math.abs(x - f.cell.x) < .45 && Math.abs(y - f.cell.y) < .45 && h < f.heightM)) return false;
    }
    return true;
  }
  function cover(a, rows) { return a?.climbing?.mode === 'perched' ? rows?.find(f => f.id === a.climbing.surfaceId)?.cover || 0 : 0; }
  // The caller has already established current visibility. Rediscovering a
  // body does not reveal the history of an earlier unseen fall or departure.
  function observedEvent(a, previous, at) { return copy(a.lastClimbEvent?.at === at ? a.lastClimbEvent : previous?.climbEvent || null); }
  return { SPECIES, STAMINA, SPEED, validSurface, surfaces, normalizeSurfaces, normalizeActor, height, capable, plan, advance, interrupt, lineClear, cover, observedEvent };
});
