(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./wilderness-beasts') : root.HelixWildernessBeasts);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRegionalEncounters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Wild) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const valid = s => typeof s === 'string' && s.length > 0;
  const time = n => Number.isFinite(n) && n >= 0;
  const CAP = 4; // Supported encounter representatives, NOT a regional census.
  function hash(s) { let n = 2166136261; for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967296; }
  function create(binding) { return { ...binding, members: [], decisions: [], routes: [], losses: [], beasts: Wild.defaultState() }; }
  function normalize(value) {
    if (!valid(value?.worldId) || !valid(value.runId)) return null;
    const s = create({ worldId: value.worldId, runId: value.runId });
    for (const m of value.members || []) if (valid(m?.actorId) && valid(m.populationId) && valid(m.source)
      && Wild.PROFILES[m.speciesId] && !s.members.some(r => r.actorId === m.actorId)) s.members.push({ actorId: m.actorId, populationId: m.populationId, speciesId: m.speciesId, source: m.source });
    s.decisions = [...new Set((value.decisions || []).filter(valid))];
    s.routes = (value.routes || []).filter(r => valid(r?.id) && Number.isFinite(r.distanceKm) && r.distanceKm > 0 && time(r.at)).map(r => ({ id: r.id, distanceKm: r.distanceKm, at: r.at }));
    s.losses = (value.losses || []).filter(r => valid(r?.actorId) && valid(r.populationId) && time(r.at)).map(r => ({ actorId: r.actorId, populationId: r.populationId, at: r.at }));
    s.beasts = Wild.normalizeState(value.beasts);
    s.beasts.actors = s.beasts.actors.filter(a => Wild.PROFILES[a.speciesId] && s.members.some(m => m.actorId === a.id)
      && valid(a.routeId) && time(a.positionKm) && Number.isFinite(a.offsetM) && time(a.effortSeconds)
      && ['reserve', 'local', 'following'].includes(a.regionalPhase));
    return s;
  }
  function adopt(s, actors, source, at) {
    for (const a of actors || []) {
      if (!valid(a?.id) || !valid(a.populationId) || !Wild.PROFILES[a.speciesId]) continue;
      if (!s.members.some(m => m.actorId === a.id)) s.members.push({ actorId: a.id, populationId: a.populationId, speciesId: a.speciesId, source });
      if ((a.status === 'dead' || a.health <= 0) && !s.losses.some(r => r.actorId === a.id)) s.losses.push({ actorId: a.id, populationId: a.populationId, at: time(a.diedAt) ? a.diedAt : at });
    }
    return s;
  }
  const remaining = (s, populationId) => Math.max(0, CAP - s.members.filter(m => m.populationId === populationId).length);
  function claim(s, actor, source, at) {
    // Existing individuals enter via adopt, never through a fresh candidate.
    // A lost materialization flag must not recreate a healthy copy of a claim.
    if (s.members.some(m => m.actorId === actor.id)) return false;
    if (!remaining(s, actor.populationId)) return false;
    adopt(s, [actor], source, at); return true;
  }
  function route(s, plan, populations, seed, at) {
    if (!plan || !(plan.distanceKm > 0) || s.routes.some(r => r.id === plan.id)) return s;
    s.routes.push({ id: plan.id, distanceKm: plan.distanceKm, at }); s.beasts.materialized = true;
    for (const p of [...populations].sort((a, b) => a.id.localeCompare(b.id))) {
      const key = `walking:${plan.id}:${p.id}`; if (s.decisions.includes(key)) continue;
      s.decisions.push(key);
      if (!Wild.PROFILES[p.speciesId] || !(p.populationIndex > 0) || !remaining(s, p.id)
        || hash(`${seed}:${key}:presence`) >= Math.min(.8, p.populationIndex / 1000)
        || s.beasts.actors.filter(a => a.routeId === plan.id).length >= 4) continue;
      const km = plan.distanceKm * (.2 + hash(`${seed}:${key}:position`) * .6);
      const id = `regional-beast:${Math.floor(hash(`${seed}:${key}:identity`) * 4294967296).toString(16)}`;
      const a = { ...Wild.actor(p.speciesId, id, { x: 0, y: 0, z: -9999 }, p.id, at), roomId: '', mapCell: null, homeCell: null,
        name: `${Wild.PROFILES[p.speciesId].name} ${s.beasts.actors.length + 1}`,
        routeId: plan.id, positionKm: km, offsetM: 3, homePositionKm: km, regionalPhase: 'reserve', effortSeconds: 120,
        regionalAt: at, regionalTargetKm: null, regionalMemoryUntil: 0, regionalSiteId: '' };
      if (claim(s, a, `walking:${plan.id}`, at)) s.beasts.actors.push(a);
    }
    return s;
  }
  const positions = (s, routeId) => s.beasts.actors.filter(a => a.routeId === routeId && a.regionalPhase === 'reserve').map(a => a.positionKm);
  function place(s, site, at, canEnter) {
    let count = 0;
    for (const a of s.beasts.actors) {
      if (a.routeId !== site.routeId || a.regionalPhase === 'local') continue;
      const x = site.entry.x + Math.round((a.positionKm - site.positionKm) * 1000), y = site.entry.y + Math.round(a.offsetM);
      const projected = { x, y, z: site.entry.z };
      // At most one metre of grid discretization. Never move a blocked animal
      // across the patch, under the scientist, or to a newly chosen spawn tile.
      const candidates = [projected, ...(Wild.key(projected) === Wild.key(site.entry) ? Wild.neighbors(projected) : [])]
        .filter(c => site.baseline.some(t => Wild.key(t.cell) === Wild.key(c)));
      const cell = candidates.find(c => canEnter(c, a)); if (!cell) continue;
      a.regionalPhase = 'local'; a.regionalSiteId = site.id; a.roomId = site.roomId; a.mapCell = copy(cell); a.homeCell = copy(cell);
      a.positionKm = site.positionKm + (cell.x - site.entry.x) / 1000; a.offsetM = cell.y - site.entry.y;
      a.nextMoveAt = Math.max(at + Wild.PROFILES[a.speciesId].stepSeconds, a.nextMoveAt);
      a.nextAttackAt = Math.max(at + 1, a.nextAttackAt); a.regionalAt = at; count++;
      if (!s.beasts.tracks.some(t => t.id === `track:${a.id}`)) s.beasts.tracks.push({ id: `track:${a.id}`, cell: copy(cell), label: Wild.PROFILES[a.speciesId].track, observedAt: null });
    }
    return count;
  }
  function syncLocal(s, site, at) {
    for (const a of s.beasts.actors.filter(a => a.regionalPhase === 'local' && a.roomId === site.roomId)) {
      const elapsed = Math.max(0, at - a.regionalAt);
      if (['pursue', 'investigate'].includes(a.behavior)) a.effortSeconds = Math.max(0, a.effortSeconds - elapsed);
      a.positionKm = Math.max(0, site.positionKm + (a.mapCell.x - site.entry.x) / 1000); a.offsetM = a.mapCell.y - site.entry.y; a.regionalAt = at;
    }
    adopt(s, s.beasts.actors, 'walking', at);
  }
  function depart(s, site, at) {
    syncLocal(s, site, at);
    for (const a of s.beasts.actors.filter(a => a.regionalPhase === 'local' && a.roomId === site.roomId)) {
      if (a.status === 'dead' || a.health < a.maxHealth * .3 || !a.effortSeconds || !['pursue', 'investigate'].includes(a.behavior) || a.rememberedUntil < at) continue;
      a.regionalPhase = 'following'; a.regionalTargetKm = site.positionKm; a.regionalMemoryUntil = a.rememberedUntil;
      a.roomId = ''; a.mapCell = null; a.regionalAt = at;
    }
  }
  function follow(s, routeId, positionKm, at, alive, speedFactor = () => 1, targetOffsetM = 0) {
    if (!alive) return { contact: false };
    let contact = false;
    for (const a of s.beasts.actors.filter(a => a.routeId === routeId && a.regionalPhase === 'following')) {
      for (; a.regionalAt + 1 <= at;) {
        a.regionalAt++;
        const profile = Wild.PROFILES[a.speciesId], gapM = Math.hypot((positionKm - a.positionKm) * 1000, a.offsetM - targetOffsetM);
        if (a.status === 'dead' || a.health < a.maxHealth * .3 || !a.effortSeconds || gapM > profile.sight && a.regionalAt > a.regionalMemoryUntil
          || profile.disposition === 'territorial' && Math.abs(positionKm - a.homePositionKm) > .03) {
          a.regionalPhase = 'reserve'; a.behavior = 'roam'; break;
        }
        if (gapM <= profile.sight) { a.regionalTargetKm = positionKm; a.regionalTargetOffsetM = targetOffsetM; a.regionalMemoryUntil = a.regionalAt + 12; }
        const dx = (a.regionalTargetKm - a.positionKm) * 1000, dy = (a.regionalTargetOffsetM || 0) - a.offsetM, distance = Math.hypot(dx, dy);
        const step = Math.min(distance, 1 / profile.stepSeconds / Math.max(1, speedFactor(a)));
        if (distance > 0) { a.positionKm += dx / distance * step / 1000; a.offsetM += dy / distance * step; }
        a.effortSeconds = Math.max(0, a.effortSeconds - 1);
        if (Math.hypot((positionKm - a.positionKm) * 1000, a.offsetM - targetOffsetM) <= 1) { contact = true; break; }
      }
    }
    adopt(s, s.beasts.actors, 'walking', at); return { contact };
  }
  function rebind(value, from, to) {
    const s = normalize(value);
    return s && s.worldId === from?.worldId && s.runId === from?.runId && valid(to?.worldId) && valid(to?.runId) ? normalize({ ...s, ...to }) : s;
  }
  return { CAP, create, normalize, adopt, remaining, claim, route, positions, place, syncLocal, depart, follow, rebind };
});
