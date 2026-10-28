(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./wilderness-beasts') : root.HelixWildernessBeasts,
    node ? require('./strategic-world') : root.HelixStrategicWorld,
    node ? require('./strategic-beast-ecology') : root.HelixStrategicBeastEcology);
  if (node) module.exports = api;
  if (root) root.HelixMirrorApePopulations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Wild, World, Ecology) {
  'use strict';
  const SPECIES = 'beast:mirror-ape', GROUP = 2, SEPARATION_KM = .04;
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const id = x => typeof x === 'string' && x.length > 0;
  const time = x => Number.isFinite(x) && x >= 0;
  const hash = x => World.stableHash(x);
  const random = x => parseInt(hash(x), 16) / 4294967296;
  const identity = (seed, populationId, ordinal) => `mirror-ape:${hash(`${seed}:${populationId}:${ordinal}:identity`)}${ordinal < 2 ? '' : `:${ordinal}`}`;
  function habitat(map, source, geometry) {
    const p = map?.beastEcology?.populations?.find(p => p.id === source.populationId),
      raw = map?.routeGraph?.routes?.find(r => r.id === source.canonicalCorridorId);
    if (p?.speciesId !== SPECIES || p.devotionalUnitCount !== source.originalCount || !raw?.endpointIds?.includes(source.cityId)
      || !raw.cellPath?.length || !geometry) return null;
    const path = raw.endpointIds[0] === source.cityId ? raw.cellPath : [...raw.cellPath].reverse(), km = [0],
      cities = new Set((map.humanGeography?.cities || []).map(c => c.cellId));
    for (let i = 1; i < path.length; i++) km.push(km.at(-1) + geometry.distance(path[i - 1], path[i]));
    if (!(km.at(-1) > 0)) return null;
    const spans = [];
    for (let i = 1; i < path.length - 1; i++) if (!cities.has(path[i]) && geometry.land(path[i])
      && Ecology.maskIncludes(p.territory?.rangeMask, World.cellIndex(path[i]))) {
      // A hex's traversed portion is bounded by the adjacent path midpoints,
      // not the entire road, a migration warning or a newly revealed map.
      spans.push({ cellId: path[i], startKm: (km[i - 1] + km[i]) / 2 / km.at(-1) * source.distanceKm,
        endKm: (km[i] + km[i + 1]) / 2 / km.at(-1) * source.distanceKm });
    }
    const h = { populationId: p.id, routeId: source.routeId, originalCount: p.devotionalUnitCount, spans };
    return validHabitat(h, source) ? h : null;
  }
  function validHabitat(h, source) {
    return Boolean(h && source?.speciesId === SPECIES && h.populationId === source.populationId && h.routeId === source.routeId && h.originalCount === source.originalCount
      && Array.isArray(h.spans) && h.spans.length && h.spans.every((s, i) => s && id(s.cellId) && time(s.startKm)
        && s.startKm > 0 && s.endKm > s.startKm && s.endKm < source.distanceKm
        && (!i || h.spans[i - 1].endKm <= s.startKm))
      && h.spans.some(s => s.cellId === source.sourceCellId && source.positionKm >= s.startKm && source.positionKm <= s.endKm));
  }
  const blueprint = p => [p.populationId, p.routeId, p.originalCount, p.seed, p.allocatedAt, p.initialIds, p.habitat,
    p.groups.map(g => [g.ordinal, g.count, g.positionKm, g.cellId, g.offsets])];
  function create(source, initialIds, seed, at, h) {
    if (!validHabitat(h, source) || !id(seed) || !time(at) || !initialIds.length || initialIds.length > source.originalCount) return null;
    const p = { populationId: source.populationId, routeId: source.routeId, originalCount: source.originalCount,
      allocatedAt: at, seed, initialIds: [...initialIds], habitat: copy(h), groups: [] }, occupied = [source.positionKm];
    for (let ordinal = initialIds.length; ordinal < source.originalCount; ordinal += GROUP) {
      const g = { ordinal, count: Math.min(GROUP, source.originalCount - ordinal), positionKm: null, cellId: null, materializedAt: null };
      g.offsets = Array.from({ length: g.count }, (_, i) => (i % 2 ? -1 : 1)
        * (2 + Math.floor(random(`${seed}:${source.populationId}:${ordinal + i}:offset`) * 3)));
      // Only a fraction of a habitat population occupies this narrow approach.
      // Unlocated originals remain conserved and unresolved, not harmless.
      if (random(`${seed}:${source.populationId}:${ordinal}:approach`) < .5) for (let attempt = 0; attempt < 8; attempt++) {
        const span = h.spans[Math.floor(random(`${seed}:${ordinal}:${attempt}:span`) * h.spans.length)],
          position = span.startKm + .004 + random(`${seed}:${source.populationId}:${ordinal}:${attempt}:position`) * Math.max(0, span.endKm - span.startKm - .008);
        if (position < span.endKm - .004 && occupied.every(km => Math.abs(km - position) >= SEPARATION_KM)) {
          g.positionKm = position; g.cellId = span.cellId; occupied.push(position); break;
        }
      }
      p.groups.push(g);
    }
    p.seal = hash(blueprint(p)); return p;
  }
  function valid(p, source, memberIds) {
    if (!p || p.invalid || !id(p.seed) || !time(p.allocatedAt) || !validHabitat(p.habitat, source)
      || p.populationId !== source.populationId || p.routeId !== source.routeId || p.originalCount !== source.originalCount
      || !Array.isArray(p.initialIds) || !p.initialIds.length || !p.initialIds.every(id) || !Array.isArray(p.groups)
      || p.groups.length !== Math.ceil((p.originalCount - p.initialIds.length) / GROUP)) return false;
    const issued = [...p.initialIds];
    for (let i = 0; i < p.groups.length; i++) {
      const g = p.groups[i];
      if (!g || g.ordinal !== p.initialIds.length + i * GROUP || g.count !== Math.min(GROUP, p.originalCount - g.ordinal)
        || !Array.isArray(g.offsets) || g.offsets.length !== g.count || !g.offsets.every((n, i) => Number.isInteger(n)
          && Math.abs(n) >= 2 && Math.abs(n) <= 4 && (i % 2 ? n < 0 : n > 0))
        || !(g.positionKm === null && g.cellId === null || time(g.positionKm) && p.habitat.spans.some(s => s.cellId === g.cellId
          && g.positionKm > s.startKm && g.positionKm < s.endKm))
        || !(g.materializedAt === null || time(g.materializedAt) && g.materializedAt >= p.allocatedAt && g.positionKm !== null)) return false;
      if (g.materializedAt !== null) for (let n = 0; n < g.count; n++) issued.push(identity(p.seed, p.populationId, g.ordinal + n));
    }
    return new Set(issued).size === issued.length && issued.length === memberIds.length && memberIds.every(x => issued.includes(x))
      && p.seal === hash(blueprint(p));
  }
  function normalize(t) {
    if (t.pool && !valid(t.pool, t.source, t.memberIds)) t.pool = { ...(typeof t.pool === 'object' ? t.pool : {}), invalid: true };
    return t;
  }
  function positions(t, routeId) {
    return t.source.routeId === routeId && valid(t.pool, t.source, t.memberIds)
      ? t.pool.groups.filter(g => g.positionKm !== null && g.materializedAt === null).map(g => g.positionKm) : [];
  }
  function materialize(t, region, site, at, canEnter, alive = true) {
    const p = t?.pool;
    if (!alive || !time(at) || !valid(p, t.source, t.memberIds) || at < p.allocatedAt || site?.routeId !== p.routeId
      || !region.managedPopulationIds.includes(p.populationId)) return 0;
    let count = 0;
    for (const g of p.groups) {
      if (g.positionKm === null || g.materializedAt !== null) continue;
      const cells = Array.from({ length: g.count }, (_, i) => ({ x: site.entry.x + Math.round((g.positionKm - site.positionKm) * 1000),
        y: site.entry.y + g.offsets[i], z: site.entry.z }));
      if (!cells.every(c => site.baseline.some(t => Wild.key(t.cell) === Wild.key(c)))) continue;
      const ids = cells.map((_, i) => identity(p.seed, p.populationId, g.ordinal + i));
      if (ids.some(actorId => region.members.some(m => m.actorId === actorId) || region.beasts.actors.some(a => a.id === actorId))) {
        p.invalid = true; return count; // A lost receipt cannot recreate a claimed individual.
      }
      const actors = cells.map((c, i) => ({ ...Wild.actor(SPECIES, ids[i], c, p.populationId, p.allocatedAt),
        name: `Mirror Ape ${hash(ids[i]).slice(0, 4)}`, roomId: '', mapCell: null, homeCell: null, routeId: p.routeId,
        positionKm: g.positionKm, homePositionKm: g.positionKm, offsetM: g.offsets[i],
        regionalPhase: 'reserve', effortSeconds: 120, regionalAt: at, regionalSiteId: '',
        dialoguePolicy: parseInt(hash(`${p.seed}:${ids[i]}:consent`), 16) % 2 ? 'consider' : 'decline', contactWorkSeconds: 900 }));
      if (!cells.every((c, i) => canEnter(c, actors[i]))) continue;
      g.materializedAt = at; t.memberIds.push(...ids);
      region.members.push(...ids.map(actorId => ({ actorId, populationId: p.populationId, speciesId: SPECIES, source: t.source.id })));
      region.beasts.actors.push(...actors); count += actors.length;
    }
    return count;
  }
  function candidates(t, actors, sites, link) {
    if (!['populationId', 'routeId', 'cityId', 'canonicalCorridorId', 'distanceKm', 'originalCount']
      .every(k => t.source[k] === link.population[k])) return [];
    const rows = [];
    for (const actorId of t.memberIds) {
      const a = actors.find(a => a.id === actorId);
      if (!a || a.actorKind !== 'wildernessBeast' || a.genome || a.populationId !== t.source.populationId
        || a.speciesId !== SPECIES || a.status !== 'alive' || a.health < a.maxHealth * .3 || a.routeId !== t.source.routeId
        || !['local', 'reserve'].includes(a.regionalPhase) || Math.abs(a.offsetM) > Wild.PROFILES[SPECIES].sight) continue;
      const site = a.regionalPhase === 'local' && sites.find(s => s.id === a.regionalSiteId && s.roomId === a.roomId);
      if (a.regionalPhase === 'local' && !site) continue;
      const corridorKm = site?.positionKm ?? a.positionKm;
      if (!link.habitat.spans.some(s => s.cellId === link.cellId && corridorKm >= s.startKm && corridorKm <= s.endKm)) continue;
      rows.push({ actorId, corridorKm, siteId: site?.id || null });
    }
    if (valid(t.pool, t.source, t.memberIds)) for (const g of t.pool.groups) if (g.materializedAt === null && g.positionKm !== null && g.cellId === link.cellId)
      rows.push({ actorId: identity(t.pool.seed, t.source.populationId, g.ordinal), corridorKm: g.positionKm, siteId: null });
    return rows;
  }
  return { SPECIES, GROUP, SEPARATION_KM, habitat, validHabitat, identity, create, valid, normalize, positions, materialize, candidates };
});
