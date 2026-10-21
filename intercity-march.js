(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./overland-expedition') : root.HelixOverlandExpedition);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixIntercityMarch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Walk) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const time = n => Number.isFinite(n) && n >= 0;
  const id = s => typeof s === 'string' && s.length > 0;
  const cell = c => c && ['x', 'y', 'z'].every(k => Number.isInteger(c[k]));
  const active = s => ['outward', 'staging', 'returning'].includes(s?.operation?.phase);
  const LIMITS = 'Personal expedition only. Original carried supplies, wounds and time persist. Exterior roadside ground grants no admission, shelter, ownership, garrison, military transit, army, political concession or campaign victory. Existing guards and commercial vehicles are not mobilized. Only supported regional encounter species are simulated; silence is not safety.';
  function create(binding) { return { ...binding, routes: [], history: [], operation: null }; }
  function normalize(s) {
    if (!id(s?.worldId) || !id(s.runId) || !Array.isArray(s.routes) || !Array.isArray(s.history)
      || !s.routes.every(r => ['sourceId', 'routeId', 'homeCityId', 'cityId', 'destinationId'].every(k => id(r?.[k]))
        && r.homeCityId !== r.cityId && time(r.sourceAt) && Number.isFinite(r.distanceKm) && r.distanceKm > 0)
      || !s.history.every(h => id(h?.id) && id(h.cityId) && time(h.startedAt)
        && (time(h.returnedAt) || h.returnedAt === null && time(h.bodyEndedAt)) && time(h.walkedKm))) return null;
    const o = s.operation, walk = o && Walk.normalize(o.walk);
    if (o && (!walk || walk.worldId !== s.worldId || walk.runId !== s.runId || !id(o.origin?.roomId) || !cell(o.origin.cell)
      || !o.prior || o.prior.walk && !Walk.normalize(o.prior.walk)
      || o.plan?.id !== walk.route.id || o.plan.distanceKm !== walk.route.distanceKm
      || !['reconnoitre', 'prepareTerms'].includes(o.objective) || !time(o.startedAt)
      || !['outward', 'staging', 'returning', 'returned', 'bodyLost'].includes(o.phase))) return null;
    return copy(s);
  }
  function learn(s, passenger, now) {
    const t = passenger?.trip;
    if (!s || !id(t?.id) || !time(t.arrivedAt) || !time(now) || t.arrivedAt > now || !Number.isFinite(t.km) || t.km <= 0
      || !id(t.routeId) || !id(t.destinationId) || !id(t.destinationCityId) || !id(passenger.homeCityId) || passenger.homeCityId === t.destinationCityId
      || !passenger.receipts?.some(r => r.id === t.id && r.at === t.arrivedAt
        && r.destination === (t.outbound ? t.destinationCityId : passenger.homeCityId))) return false;
    if (s.routes.some(r => r.sourceId === t.id)) return false;
    s.routes.push({ sourceId: t.id, sourceAt: t.arrivedAt, routeId: t.routeId, homeCityId: passenger.homeCityId,
      cityId: t.destinationCityId, destinationId: t.destinationId, label: t.destinationLabel, distanceKm: t.km }); return true;
  }
  function plans(s, network, homeCityId) {
    const factors = { continuous: 1, operational: 1, degraded: 1.25, intermittent: 1.55 };
    return (s?.routes || []).filter(r => r.homeCityId === homeCityId).flatMap(r => {
      const route = network?.routes?.find(e => e.id === r.routeId && e.endpointCityIds?.length === 2
        && e.endpointCityIds.includes(r.homeCityId) && e.endpointCityIds.includes(r.cityId));
      const destination = network?.destinations?.find(d => d.id === r.destinationId && d.cityId === r.cityId && d.known && d.kind === 'fortifiedCity');
      if (!route || !destination || !route.supportCapable || !factors[route.continuity] || route.distanceKm !== r.distanceKm) return [];
      return [{ id: `intercity-march:${route.id}`, homeId: `city:${homeCityId}`, groundId: `${destination.id}:exterior`,
        cityId: r.cityId, homeCityId, corridorId: route.id, cellPath: copy(route.cellPath || []),
        label: `${homeCityId} → ${destination.label} exterior`, sourceId: r.sourceId, sourceAt: r.sourceAt,
        source: 'Personally completed passenger itinerary; not a released map or military permission',
        directions: 'Retrace this measured corridor on foot, stopping on exterior roadside ground before city admission. Current hazards and military access remain unverified.',
        distanceKm: r.distanceKm, legs: [{ distanceKm: r.distanceKm, factor: factors[route.continuity] }] }];
    }).filter((r, i, all) => all.findIndex(p => p.id === r.id) === i);
  }
  function begin(s, plan, objective, origin, prior, now, bodyEpoch) {
    if (!s || active(s) || !plan || !time(now) || plan.sourceAt > now || !['reconnoitre', 'prepareTerms'].includes(objective) || !origin?.roomId || !cell(origin.cell) || !prior
      || !s.routes.some(r => r.sourceId === plan.sourceId && r.routeId === plan.corridorId && r.cityId === plan.cityId
        && r.homeCityId === plan.homeCityId && r.distanceKm === plan.distanceKm)) return null;
    const walk = Walk.begin(null, plan, { worldId: s.worldId, runId: s.runId }, 'home', now, bodyEpoch);
    if (!walk) return null;
    s.operation = { id: `${plan.id}:expedition:${s.history.length + 1}`, phase: 'outward', objective, plan: copy(plan), origin: copy(origin),
      prior: copy(prior), walk, startedAt: now, stagedAt: null, returnedAt: null, stagingSiteId: null };
    return walk;
  }
  function stage(s, walk, site, now) {
    const o = s?.operation;
    if (!active(s) || !site || walk.trip.direction !== 1 || walk.trip.bodyEpoch !== o.walk.trip.bodyEpoch || walk.trip.status !== 'stopped'
      || walk.route.id !== o.walk.route.id || walk.trip.positionKm !== walk.route.distanceKm
      || site.routeId !== walk.route.id || site.positionKm !== walk.trip.positionKm) return false;
    o.phase = 'staging'; o.walk = copy(walk); o.stagingSiteId = site.id;
    if (o.stagedAt == null) o.stagedAt = now;
    return true;
  }
  function finish(s, walk, now) {
    const o = s?.operation;
    if (!active(s) || walk.route.id !== o.walk.route.id || walk.trip.bodyEpoch !== o.walk.trip.bodyEpoch
      || walk.trip.status !== 'arrived' || walk.trip.direction !== -1 || walk.trip.positionKm !== 0) return null;
    o.walk = copy(walk); o.phase = 'returned'; o.returnedAt = now;
    s.history.push({ id: o.id, cityId: o.plan.cityId, objective: o.objective, startedAt: o.startedAt,
      stagedAt: o.stagedAt, returnedAt: now, stagingSiteId: o.stagingSiteId, walkedKm: walk.trip.walkedKm });
    return copy(o.prior);
  }
  function rebind(value, from, to) {
    const s = normalize(value);
    if (!s || s.worldId !== from?.worldId || s.runId !== from?.runId) return null;
    Object.assign(s, to);
    if (s.operation) {
      s.operation.walk = Walk.rebind(s.operation.walk, from, to);
      s.operation.prior.walk = Walk.rebind(s.operation.prior.walk, from, to);
    }
    return s;
  }
  function bodyEnded(s, at) {
    const o = s?.operation;
    if (!active(s) || !time(at)) return null;
    o.phase = 'bodyLost'; o.bodyEndedAt = at; o.walk.trip.status = 'interrupted';
    o.walk.trip.reason = 'The original body died; a recovered scientist inherits neither this walk nor its physical possessions.';
    s.history.push({ id: o.id, cityId: o.plan.cityId, objective: o.objective, startedAt: o.startedAt,
      stagedAt: o.stagedAt, returnedAt: null, bodyEndedAt: at, stagingSiteId: o.stagingSiteId, walkedKm: o.walk.trip.walkedKm });
    return copy(o.prior);
  }
  return { LIMITS, active, create, normalize, learn, plans, begin, stage, finish, bodyEnded, rebind };
});
