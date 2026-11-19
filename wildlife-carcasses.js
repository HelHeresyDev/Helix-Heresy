// Sparse, deterministic local views of finite anonymous carcass inventories.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-life') : root.HelixCreatureLife,
    node ? require('./carcass-tissues') : root.HelixCarcassTissues);
  if (node) module.exports = api;
  root.HelixWildlifeCarcasses = api;
})(globalThis, function (Life, T) {
  'use strict';
  const DAY = 86400, EPS = 1e-8, CELL_M = 16, KILL_M = .1, QUERY_LIMIT = 4096;
  const finite = n => Number.isFinite(n) && n >= 0, integer = n => Number.isSafeInteger(n) && n >= 0;
  const keys = ['initialMassKg', 'massKg', 'edibleKg', 'initialEdibleKg', 'inertKg', 'consumedKg', 'decomposedKg', 'reservedKg'];
  const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  const empty = at => ({ initialMassKg: 0, massKg: 0, edibleKg: 0, consumedKg: 0, decomposedKg: 0, lastAt: at });
  const indexes = new WeakMap();
  function index(pool) {
    let value = indexes.get(pool);
    if (!value) { value = { nodes: new Map(), queries: new Map(), queriesMade: 0, nodeVisits: 0, limitedQueries: 0 }; indexes.set(pool, value); }
    return value;
  }
  function initialize(pool, regionId, at = 0) {
    if (pool.spatialCarcasses) pool.carcassSpace = { regionId, startedAt: at, count: 0, events: [], sites: {} };
  }
  // Prefix allocation is monotone: later deaths cannot relocate earlier ones.
  // Four equal-area polar sectors get integer counts and seeded remainder order.
  function countAt(pool, n, path) {
    for (const rank of node(pool, path).ranks) { if (!n) break; n = Math.floor(n / 4) + Number(n % 4 > rank); }
    return n;
  }
  function node(pool, path) {
    const cache = index(pool).nodes;
    if (cache.has(path)) return cache.get(path);
    const parent = path.length ? node(pool, path.slice(0, -1)) : null, i = Number(path.at(-1));
    const size = parent ? parent.cell.size / 2 : 1;
    const cell = parent ? { u: parent.cell.u + i % 2 * size, v: parent.cell.v + Math.floor(i / 2) * size, size } : { u: 0, v: 0, size: 1 };
    const offset = Math.floor(Life.random(`${pool.id}:${path}`) * 4);
    const ranks = parent ? [...parent.ranks, (i - parent.offset + 4) % 4] : [];
    const value = { path, cell, offset, ranks, bounds: box(pool, cell) };
    cache.set(path, value); return value;
  }
  function sector(path) {
    let u = 0, v = 0, size = 1;
    for (const ch of path) { size /= 2; const i = Number(ch); u += (i % 2) * size; v += Math.floor(i / 2) * size; }
    return { u, v, size };
  }
  function box(pool, cell) {
    const s = pool.spatial, lo = Math.sqrt(cell.u) * s.radiusM, hi = Math.sqrt(cell.u + cell.size) * s.radiusM;
    const a = cell.v * Math.PI * 2, b = (cell.v + cell.size) * Math.PI * 2, angles = [a, b];
    for (let i = 0; i <= 4; i++) if (i * Math.PI / 2 > a && i * Math.PI / 2 < b) angles.push(i * Math.PI / 2);
    const points = angles.flatMap(t => [lo, hi].map(r => [s.eastM + r * Math.cos(t), s.northM + r * Math.sin(t)]));
    return { minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
      minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) };
  }
  function position(pool, path) {
    const { u, v, size } = sector(path), s = pool.spatial;
    const radius = Math.sqrt(u + size * Life.random(`${pool.id}:${path}:radius`)) * s.radiusM;
    const angle = (v + size * Life.random(`${pool.id}:${path}:angle`)) * Math.PI * 2;
    return { regionId: pool.carcassSpace.regionId, eastM: s.eastM + radius * Math.cos(angle),
      northM: s.northM + radius * Math.sin(angle), altitudeM: pool.guild === 'fish' ? -s.depthTopM - pool.habitatDepthM / 2 : 0 };
  }
  function addAged(row, n, kg, born, at) {
    if (!n) return;
    T.add(row, n * kg);
    for (const k of T.animalKeys) T.debit(row, k, 0, n * kg * T.profiles[k].share * -Math.expm1(-T.profiles[k].decayDay * (at - born) / DAY));
  }
  function naturalSite(pool, path, at) {
    const space = pool.carcassSpace, id = `${pool.id}:corpse:${path}`;
    if (space.sites[id]) return space.sites[id];
    const row = { ...empty(at), id, poolId: pool.id, path, count: 0, referenceBodyKg: Infinity, position: position(pool, path) };
    let prior = 0;
    for (const [born, total, kg] of space.events) {
      const n = countAt(pool, total, path) - countAt(pool, prior, path); prior = total;
      if (n) { addAged(row, n, kg, born, at); row.count += n; row.referenceBodyKg = Math.min(row.referenceBodyKg, kg); }
    }
    if (!row.count) return null;
    space.sites[id] = row; return row;
  }
  // The caller has already debited live membership and added the same body
  // matter to pool.carcass. These rows are reconciled local custody, not food.
  function record(pool, n, kg, at, point) {
    const space = pool.carcassSpace; if (!space || !n) return null;
    if (point) {
      const cell = `${Math.floor(point.eastM / KILL_M)}:${Math.floor(point.northM / KILL_M)}:${Math.floor(point.altitudeM / KILL_M)}`;
      const id = `${pool.id}:kill:${cell}`;
      const row = space.sites[id] ||= { ...empty(at), id, poolId: pool.id, killCell: cell, count: 0,
        referenceBodyKg: kg / n, position: { ...point } };
      T.add(row, kg); row.count += n; row.referenceBodyKg = Math.min(row.referenceBodyKg, kg / n); row.lastAt = at;
      return row;
    }
    const before = space.count; space.count += n; space.events.push([at, space.count, kg / n]);
    for (const row of Object.values(space.sites)) if (row.path != null) {
      const added = countAt(pool, space.count, row.path) - countAt(pool, before, row.path);
      if (added) { T.add(row, added * kg / n); row.count += added; row.referenceBodyKg = Math.min(row.referenceBodyKg, kg / n); }
    }
    return null;
  }
  function advance(pool, days, to) {
    for (const row of Object.values(pool.carcassSpace?.sites || {})) {
      T.decay(row, days); row.lastAt = to;
    }
  }
  function distance(p, a, b = a) {
    const dx = b.eastM - a.eastM, dy = b.northM - a.northM, dz = b.altitudeM - a.altitudeM;
    const length = dx * dx + dy * dy + dz * dz;
    const t = length ? Math.max(0, Math.min(1, ((p.eastM - a.eastM) * dx + (p.northM - a.northM) * dy + (p.altitudeM - a.altitudeM) * dz) / length)) : 0;
    return Math.hypot(p.eastM - a.eastM - t * dx, p.northM - a.northM - t * dy, p.altitudeM - a.altitudeM - t * dz);
  }
  function query(pool, start, range, end = start, budget = QUERY_LIMIT, includeReserved = false) {
    const space = pool.carcassSpace, result = { sites: [], visits: 0, complete: true };
    if (!space || start.regionId !== space.regionId || end.regionId !== space.regionId) return result;
    const snap = p => ({ ...p, eastM: (Math.floor(p.eastM / CELL_M) + .5) * CELL_M,
      northM: (Math.floor(p.northM / CELL_M) + .5) * CELL_M });
    const a = snap(start), z = snap(end), expanded = Math.ceil(range / CELL_M) * CELL_M + CELL_M / Math.sqrt(2);
    const cache = index(pool), key = JSON.stringify([space.count, pool.huntedCount, a, z, expanded, budget]);
    cache.queriesMade++;
    const cached = cache.queries.get(key);
    const visible = row => distance(row.position, start, end) <= range
      && (includeReserved ? row.massKg > EPS : row.edibleKg > (row.reservedKg || 0) + EPS);
    if (cached) return { ...cached, visits: 0, sites: cached.sites.filter(visible) };
    const altitude = pool.guild === 'fish' ? -pool.spatial.depthTopM - pool.habitatDepthM / 2 : 0;
    const pending = Math.min(a.altitudeM, z.altitudeM) - expanded > altitude || Math.max(a.altitudeM, z.altitudeM) + expanded < altitude
      ? [] : [{ node: node(pool, ''), count: space.count }];
    while (pending.length && result.visits < budget) {
      const item = pending.pop(), entry = item.node, b = entry.bounds; result.visits++;
      if (!item.count) continue;
      if (b.maxX < Math.min(a.eastM, z.eastM) - expanded || b.minX > Math.max(a.eastM, z.eastM) + expanded
        || b.maxY < Math.min(a.northM, z.northM) - expanded || b.minY > Math.max(a.northM, z.northM) + expanded) continue;
      const centre = { eastM: (b.minX + b.maxX) / 2, northM: (b.minY + b.maxY) / 2, altitudeM: altitude };
      if (distance(centre, a, z) > expanded + Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2) continue;
      if (Math.hypot(b.maxX - b.minX, b.maxY - b.minY) <= CELL_M || entry.path.length >= 48) {
        const p = position(pool, entry.path);
        if (distance(p, a, z) <= expanded) {
          const row = naturalSite(pool, entry.path, pool.carcass.lastAt);
          if (row) result.sites.push(row);
        }
      } else {
        const counts = [0, 1, 2, 3].map(i => Math.floor(item.count / 4) + Number((i - entry.offset + 4) % 4 < item.count % 4));
        // Geometry order, not hidden food quality or the animal's hunger.
        for (let i = 3; i >= 0; i--) if (counts[i]) pending.push({ node: node(pool, entry.path + i), count: counts[i] });
      }
    }
    result.complete = !pending.length;
    cache.nodeVisits += result.visits; if (!result.complete) cache.limitedQueries++;
    for (const row of Object.values(space.sites)) if (row.killCell != null && distance(row.position, a, z) <= expanded) result.sites.push(row);
    if (cache.queries.size > 32) cache.queries.clear();
    cache.queries.set(key, result);
    if (cache.nodes.size > 32768) cache.nodes.clear();
    return { ...result, sites: result.sites.filter(visible) };
  }
  function source(r, id) {
    for (const p of r.wildlife?.pools || []) {
      if (id === p.id) return p.carcassSpace ? null : p.carcass;
      if (p.carcassSpace && Object.hasOwn(p.carcassSpace.sites, id)) return p.carcassSpace.sites[id];
    }
    return null;
  }
  const parent = (r, row) => row.poolId && r.wildlife?.pools.find(p => p.id === row.poolId)?.carcass;
  function reserve(r, row, actor, kg) {
    const parts = T.reserve(row, actor, kg), root = parent(r, row);
    if (root) for (const part of parts) {
      const paid = T.reserve(root, { carrionDiet: [part.tissue] }, part.kg).reduce((n, p) => n + p.kg, 0);
      if (!close(paid, part.kg)) throw Error('Unfunded local carcass custody');
    }
    return parts;
  }
  function release(r, row, key, kg) { T.release(row, key, kg); const root = parent(r, row); if (root) T.release(root, key, kg); }
  function debit(r, row, key, consumed, decomposed, reserved) {
    T.debit(row, key, consumed, decomposed, reserved); const root = parent(r, row);
    if (root) T.debit(root, key, consumed, decomposed, reserved);
  }
  function rows(pool) { return pool.carcassSpace ? Object.values(pool.carcassSpace.sites) : [pool.carcass]; }
  function body(row) {
    if (!row?.poolId) return null;
    const width = Math.cbrt(row.referenceBodyKg / 1000);
    return { massKg: row.referenceBodyKg, lengthM: width * 2, widthM: width, heightM: width };
  }
  const structuralKg = row => Math.max(0, row.massKg - row.edibleKg)
    + ['hard', 'tough'].reduce((n, k) => n + (row.tissues?.[k]?.kg || 0), 0);
  // Never anchor with the combined weight of a batch of scattered corpses.
  const anchorLimit = row => row.poolId ? structuralKg(row) / Math.max(1, row.count) : Infinity;
  const freeAnchorKg = row => Math.min(anchorLimit(row), ['hard', 'tough'].reduce((n, k) => n
    + Math.max(0, (row.tissues?.[k]?.kg || 0) - (row.tissues?.[k]?.reservedKg || 0)), 0) / Math.max(1, row.count));
  function take(r, row, actor, maximum) {
    return T.take(row, actor, maximum, (key, kg) => debit(r, row, key, kg, 0, false));
  }
  // A view is never a second saved actor or food stock. All operations
  // resolve to the existing spatial row and its finite parent inventory.
  function window(r, site, observer, range, tile, terrain, includeReserved = false) {
    const b = site.bounds, frame = site.origin;
    if (observer.cell.z !== b.z || !(range > 0) || !(tile > 0)) return [];
    const point = { regionId: r.id, eastM: frame.eastM + (observer.cell.x - b.x) * tile + (observer.offsetM?.x || 0),
      northM: frame.northM + (observer.cell.y - b.y) * tile + (observer.offsetM?.y || 0), altitudeM: observer.altitudeM };
    let budget = QUERY_LIMIT;
    const candidates = [];
    for (const pool of r.wildlife?.pools || []) {
      if (budget <= 0 || !pool.carcassSpace) continue;
      const batch = query(pool, point, range, point, budget, includeReserved); budget -= batch.visits;
      for (const row of batch.sites) {
        const p = row.position, x = b.x + (p.eastM - frame.eastM) / tile, y = b.y + (p.northM - frame.northM) / tile;
        if (x < b.x || x >= b.x + b.width || y < b.y || y >= b.y + b.height) continue;
        const mapCell = { x: Math.floor(x), y: Math.floor(y), z: b.z }, t = terrain(mapCell);
        if (!t || t.known === false || t.protected || t.warded || t.foundation || t.obstacleHeightM > Math.max(0, p.altitudeM)
          || (p.altitudeM < 0 ? !(t.waterDepthM >= -p.altitudeM) : !t.floor)) continue;
        const shape = body(row);
        candidates.push({ id: row.id, actorKind: 'wildlifeRemains', status: 'dead', roomId: site.roomId, mapCell,
          wildlifePosition: { eastM: x * tile, northM: y * tile, altitudeM: p.altitudeM },
          bodyPhysics: { dimensions: shape, altitudeM: p.altitudeM, mode: p.altitudeM < 0 ? 'swimming' : 'grounded' },
          ...(includeReserved ? {} : { wildlifeCarrion: {
            inventory: () => row, take: (actor, kg) => take(r, row, actor, kg), anchorKg: () => freeAnchorKg(row)
          } }),
          distanceM: distance(row.position, point) });
      }
    }
    return candidates.sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id)).slice(0, 64);
  }
  function summary(s) {
    const result = { deathBatches: 0, localSites: 0, positionedKg: 0, unresolvedKg: 0,
      queries: 0, nodeVisits: 0, limitedQueries: 0 };
    for (const r of s.regions) for (const p of r.wildlife?.pools || []) if (p.carcassSpace) {
      const sites = Object.values(p.carcassSpace.sites), kg = sites.reduce((n, row) => n + row.massKg, 0);
      result.deathBatches += p.carcassSpace.events.length; result.localSites += sites.length;
      result.positionedKg += kg; result.unresolvedKg += Math.max(0, p.carcass.massKg - kg);
      const work = indexes.get(p);
      result.queries += work?.queriesMade || 0; result.nodeVisits += work?.nodeVisits || 0; result.limitedQueries += work?.limitedQueries || 0;
    }
    return result; // Traversal work is transient instrumentation, not saved biological state.
  }
  function valid(pool, regionId, at, initializedAt = 0) {
    const space = pool.carcassSpace;
    if (!pool.spatialCarcasses) return space == null;
    if (!space || space.regionId !== regionId || space.startedAt !== initializedAt || !integer(space.count) || space.count !== pool.deadCount
      || !Array.isArray(space.events) || !space.sites || typeof space.sites !== 'object' || Array.isArray(space.sites)) return false;
    let before = 0, bodyKg = 0, priorAt = -Infinity;
    for (const e of space.events) {
      if (!Array.isArray(e) || e.length !== 3 || !Number.isFinite(e[0]) || e[0] < priorAt || e[0] > at + EPS
        || !integer(e[1]) || e[1] <= before || !(e[2] > 0) || !Number.isFinite(e[2])) return false;
      bodyKg += (e[1] - before) * e[2]; before = e[1]; priorAt = e[0];
    }
    if (before !== space.count) return false;
    if (pool.establishment) {
      let count = 0;
      const expected = pool.establishment.deaths.flatMap((n, day) => {
        count += n; return n ? [[initializedAt - (pool.establishedDays - day - .5) * DAY, count, pool.originalMassKg / pool.originalCount]] : [];
      });
      const historical = space.events.filter(e => e[0] < initializedAt);
      if (historical.length !== expected.length || historical.some((e, i) => e[0] !== expected[i][0]
        || e[1] !== expected[i][1] || !close(e[2], expected[i][2]))) return false;
    }
    let hunted = 0;
    const sums = Object.fromEntries(keys.map(k => [k, 0])), tissue = {};
    for (const [id, row] of Object.entries(space.sites)) {
      if (row.id !== id || row.poolId !== pool.id || !integer(row.count) || !row.count || !finite(row.lastAt)
        || row.lastAt > at + EPS || row.lastAt !== pool.carcass.lastAt
        || !(row.referenceBodyKg > 0) || !Number.isFinite(row.referenceBodyKg) || !row.position
        || row.position.regionId !== regionId || !['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(row.position[k]))
        || !T.valid(row) || !close(row.initialMassKg, row.massKg + row.consumedKg + row.decomposedKg)) return false;
      if (row.path != null) {
        if (typeof row.path !== 'string' || !/^[0-3]{0,48}$/.test(row.path) || id !== `${pool.id}:corpse:${row.path}`
          || JSON.stringify(row.position) !== JSON.stringify(position(pool, row.path)) || row.count !== countAt(pool, space.count, row.path)) return false;
        const b = node(pool, row.path).bounds;
        if (Math.hypot(b.maxX - b.minX, b.maxY - b.minY) > CELL_M && row.path.length < 48) return false;
        if (row.path.length) {
          const p = node(pool, row.path.slice(0, -1)).bounds;
          if (Math.hypot(p.maxX - p.minX, p.maxY - p.minY) <= CELL_M) return false;
        }
        let initial = 0, previous = 0, smallest = Infinity;
        for (const [, n, kg] of space.events) {
          const added = countAt(pool, n, row.path) - countAt(pool, previous, row.path);
          initial += added * kg; previous = n; if (added) smallest = Math.min(smallest, kg);
        }
        if (!close(initial, row.initialMassKg) || row.referenceBodyKg !== smallest) return false;
      } else {
        const p = row.position, cell = `${Math.floor(p.eastM / KILL_M)}:${Math.floor(p.northM / KILL_M)}:${Math.floor(p.altitudeM / KILL_M)}`;
        if (typeof row.killCell !== 'string' || row.killCell !== cell || id !== `${pool.id}:kill:${row.killCell}`
          || row.referenceBodyKg * row.count > row.initialMassKg + 1e-6 * Math.max(1, row.initialMassKg)) return false;
        hunted += row.count; bodyKg += row.initialMassKg;
      }
      for (const k of keys) sums[k] += row[k] || 0;
      for (const [k, t] of Object.entries(row.tissues || {})) {
        const sum = tissue[k] ||= { initialKg: 0, kg: 0, consumedKg: 0, decomposedKg: 0, reservedKg: 0 };
        for (const k of Object.keys(sum)) sum[k] += t[k];
      }
    }
    if (hunted !== pool.huntedCount || !close(bodyKg, pool.carcass.initialMassKg)) return false;
    return ['consumedKg', 'reservedKg'].every(k => close(sums[k], pool.carcass[k] || 0))
      && Object.entries(tissue).every(([k, sum]) => Object.entries(sum).every(([field, n]) => {
        const root = pool.carcass.tissues?.[k]?.[field] || 0;
        return ['consumedKg', 'reservedKg'].includes(field) ? close(n, root) : n <= root + 1e-6 * Math.max(1, root);
      }));
  }
  return { CELL_M, QUERY_LIMIT, initialize, record, advance, query, source, reserve, release, debit, rows, body, anchorLimit, freeAnchorKg, take, window, valid, countAt, summary };
});
