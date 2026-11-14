// Physical adapters for the existing local ecological actions, not new powers.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./beast-habitat') : root.HelixBeastHabitat,
    node ? require('./beast-demography') : root.HelixBeastDemography,
    node ? require('./beast-seasonal-journeys') : root.HelixBeastSeasonalJourneys,
    node ? require('./beast-bodies') : root.HelixBeastBodies);
  if (node) module.exports = api;
  root.HelixBeastRegionalWork = api;
})(globalThis, function (Data, Habitat, G, Journeys, Bodies) {
  'use strict';
  const DAY = 86400, EPS = 1e-8;
  const actions = Object.freeze({ rootStabilize: 'beast:ironroot-colossus', tendWetland: 'beast:mire-choir',
    cultivateReef: 'beast:reef-wyrm', buildDam: 'beast:rivercoil', growBlooms: 'beast:gravebloom-elk',
    buildFurnace: 'beast:ember-ant', dreamWeather: 'beast:dreaming-tortoise',
    filterMana: 'beast:ley-manta', filterPlankton: 'beast:brine-cathedral' });
  const diets = { rootStabilize: ['organicKg'], tendWetland: ['forageKg', 'meatKg', 'detritusKg'],
    cultivateReef: ['meatKg'], buildDam: ['forageKg', 'meatKg', 'detritusKg'], growBlooms: ['forageKg', 'bloomKg'],
    buildFurnace: ['forageKg', 'meatKg', 'detritusKg'], dreamWeather: ['forageKg', 'bloomKg'],
    filterMana: ['organicKg'], filterPlankton: ['planktonKg'] };
  const nonnegative = n => Number.isFinite(n) && n >= 0;
  const id = s => typeof s === 'string' && s.length > 0 && !Object.hasOwn(Object.prototype, s);
  const towersValid = c => c.feedingTowers == null || c.speciesId === actions.filterPlankton
    && Array.isArray(c.feedingTowers) && c.feedingTowers.length === 4 && c.feedingTowers.every(n => nonnegative(n) && n <= 100);
  const towers = c => c.feedingTowers?.reduce((sum, n) => sum + n / 400, 0) || 0;
  const spec = action => Habitat.workSpec(action) || Habitat.filterSpec(action);
  function validateSite(site, r) {
    if (!id(site.id) || actions[site.action] !== site.speciesId || site.areaHa !== r.areaHa
      || !nonnegative(site.maxWorkers) || site.destroyedAt != null && !nonnegative(site.destroyedAt)
      || site.performedWorkDays != null && !nonnegative(site.performedWorkDays)) throw Error('Invalid original regional work site');
    if (site.action === 'rootStabilize') {
      if (typeof site.rootable !== 'boolean' || !id(site.substrateKey) || !(site.minSubstrateKg > 0)
        || !Number.isFinite(site.minSubstrateKg) || !nonnegative(site.vitrifiedKg)) throw Error('Invalid rooted substrate');
    } else if (['tendWetland', 'cultivateReef', 'filterPlankton', 'buildDam'].includes(site.action)) {
      const w = site.water;
      if (!w || !['waterL', 'seawaterL'].includes(w.stockKey) || !(w.areaM2 > 0 && w.areaM2 <= r.areaHa * 10000)
        || !nonnegative(w.minDepthM) || !Object.hasOwn(r.capacity, w.stockKey)) throw Error('Missing actual water-column geometry');
      if (['cultivateReef', 'filterPlankton'].includes(site.action) && w.stockKey !== 'seawaterL') throw Error('Marine work requires its actual marine medium');
      if (site.action === 'buildDam' && (!id(site.watercourseId) || !nonnegative(site.damKg)
        || !nonnegative(site.maxDamKg) || site.damKg > site.maxDamKg || !(site.retentionLPerKgDay > 0)
        || !Number.isFinite(site.retentionLPerKgDay))) throw Error('Invalid actual dam');
    } else if (site.action === 'buildFurnace') {
      if (!id(site.colonyId) || typeof site.oxygen !== 'boolean' || !nonnegative(site.waterDepthM)
        || !nonnegative(site.furnaceKg) || !nonnegative(site.maxFurnaceKg) || site.furnaceKg > site.maxFurnaceKg) throw Error('Invalid original colony workface');
    } else if (site.action === 'filterMana' && site.medium !== 'air') throw Error('Missing original mana-current medium');
    if (['growBlooms', 'dreamWeather'].includes(site.action) && (!Array.isArray(site.phases)
      || site.phases.some(i => !Number.isSafeInteger(i) || i < 0))) throw Error('Missing actual seasonal window');
    if (site.action === 'dreamWeather' && (!Array.isArray(site.participantGroupIds) || !site.participantGroupIds.length
      || site.participantGroupIds.some(v => !id(v)) || new Set(site.participantGroupIds).size !== site.participantGroupIds.length)) throw Error('Missing original dream participants');
    if (site.action === 'cultivateReef' && !Object.hasOwn(r.capacity, 'livingReefKg')
      || site.action === 'growBlooms' && !Object.hasOwn(r.capacity, 'bloomKg')) throw Error('Missing physical growth capacity');
  }
  function validateGroup(g, r) {
    const e = g.ecology;
    if (!actions[e.action] || g.speciesId !== actions[e.action] || !diets[e.action].includes(g.resources?.foodKg)
      || !r.ecology.workSites.some(site => site.id === e.siteId && site.action === e.action && site.speciesId === g.speciesId)
      || e.action === 'filterPlankton' && g.cohorts.some(c => !c.feedingTowers || !towersValid(c))) throw Error('Unsupported or unsourced regional action');
  }
  function validateLinks(s) {
    const regions = new Map(s.regions.map(r => [r.id, r])), groups = new Map(s.groups.map(g => [g.id, g]));
    for (const r of s.regions) {
      const courses = r.ecology?.watercourses || [];
      // One physical outlet per account. Branches need separately partitioned
      // source accounts, not duplicated copies of the same incoming flow.
      if (!Array.isArray(courses) || courses.length > 1) throw Error('Invalid physical watercourse');
      for (const c of courses) if (!id(c.id) || c.sourceKey !== 'flowWaterL' || !nonnegative(c.flowPerDay)
        || !regions.get(c.downstreamRegionId)?.ecology || !r.edges.some(edge => edge.id === c.downstreamRegionId)
        || c.downstreamRegionId === r.id) throw Error('Watercourse lacks original adjoining reach');
      for (const site of r.ecology?.workSites || []) {
        if (site.phases?.some(i => i >= s.calendar.monthDays.length)) throw Error('Work season outside original calendar');
        if (site.action === 'buildDam' && !courses.some(c => c.id === site.watercourseId)) throw Error('Dam lacks original connected flow');
        for (const groupId of site.participantGroupIds || []) {
          const g = groups.get(groupId);
          if (!g || ['slime', 'mudlet', 'cinderling', 'zephyrMote', 'quartzShardling', 'rootling', 'sporecap', 'lanternWisp'].includes(g.speciesId))
            throw Error('No original capable dream participant');
        }
      }
    }
    order(s); // Reject cycles instead of circulating the same water repeatedly.
  }
  function order(s) {
    const indegree = new Map(s.regions.map(r => [r.id, 0])), byId = new Map(s.regions.map(r => [r.id, r]));
    for (const r of s.regions) for (const c of r.ecology?.watercourses || []) indegree.set(c.downstreamRegionId, indegree.get(c.downstreamRegionId) + 1);
    const queue = s.regions.filter(r => indegree.get(r.id) === 0), result = [];
    for (let i = 0; i < queue.length; i++) {
      const r = queue[i]; result.push(r);
      for (const c of r.ecology?.watercourses || []) {
        const n = indegree.get(c.downstreamRegionId) - 1; indegree.set(c.downstreamRegionId, n);
        if (!n) queue.push(byId.get(c.downstreamRegionId));
      }
    }
    if (result.length !== s.regions.length) throw Error('Cyclic physical watercourse');
    return result;
  }
  const siteFor = (s, g) => G.region(s, Journeys.location(g))?.ecology?.workSites.find(site => site.id === g.ecologicalPlan?.siteId);
  function waterThreshold(site, c) {
    const w = site.water, body = Bodies.profiles[site.speciesId], scale = c ? Math.cbrt(c.massKg / Data.lifecycle[c.speciesId].adultKg) : 1;
    return Math.max(w.minDepthM, (body?.minWaterDepthM || 0) * scale) * w.areaM2 * 1000;
  }
  function wet(site, r, c) {
    if (!site?.water) return true;
    const w = site.water, body = Bodies.profiles[site.speciesId], scale = c ? Math.cbrt(c.massKg / Data.lifecycle[c.speciesId].adultKg) : 1;
    return w.areaM2 >= (body?.lengthM || 0) * (body?.widthM || 0) * scale ** 2
      && (r.stocks[w.stockKey] || 0) > waterThreshold(site, c) + EPS;
  }
  function available(s, g, c, site, at) {
    const r = G.region(s, Journeys.location(g)), action = g.ecologicalPlan?.action;
    if (!site || site.destroyedAt != null || !wet(site, r, c) || g.activityState?.sleeping && action !== 'dreamWeather') return false;
    if (action === 'rootStabilize') return site.rootable && (r.stocks[site.substrateKey] || 0) >= site.minSubstrateKg
      && (!site.vitrifiedKg || r.stocks.soilSeedKg > 0);
    if (action === 'tendWetland') return r.stocks.wetlandBedKg > EPS;
    if (action === 'cultivateReef') return r.stocks.livingReefKg > EPS && r.stocks.livingReefKg < r.capacity.livingReefKg - EPS;
    if (action === 'growBlooms') return site.phases.includes(Journeys.monthAt(s.calendar, at).season)
      && r.stocks.bloomKg > EPS && r.stocks.bloomKg < r.capacity.bloomKg - EPS;
    if (action === 'buildFurnace') return c.role === 'worker' && c.colonyId === site.colonyId && site.oxygen
      && site.waterDepthM <= .1 && site.furnaceKg < site.maxFurnaceKg - EPS;
    if (action === 'buildDam') return site.damKg < site.maxDamKg - EPS && flowAvailable(r, site, s, at) > EPS;
    if (action === 'filterPlankton') return towers(c) > 0;
    if (action === 'dreamWeather') return g.activityState?.sleeping === true
      && g.activityState.dreamConsent === true && site.phases.includes(Journeys.monthAt(s.calendar, at).season)
      && site.participantGroupIds.every(id => {
        const other = G.group(s, id);
        return other && other.id !== g.id && other.regionId === r.id && !other.transit && other.will !== false && other.willing !== false
          && other.activityState?.sleeping === true && other.activityState.dreamConsent === true
          && other.cohorts.some(c => G.size(c.ranges) && c.health > .3);
      });
    return action === 'filterMana';
  }
  function intake(s, g, c, key) {
    if (key !== 'foodKg' || g.ecology?.action !== 'filterPlankton') return 1;
    const r = G.region(s, Journeys.location(g)), site = r?.ecology?.workSites.find(site => site.id === g.ecology.siteId);
    return site && site.destroyedAt == null && wet(site, r, c) ? towers(c) : 0;
  }
  function outputKeys(action) {
    return action === 'cultivateReef' ? ['livingReefKg'] : action === 'growBlooms' ? ['bloomKg']
      : action === 'dreamWeather' ? ['waterL'] : [];
  }
  function flowAvailable(r, site, s, at) {
    const course = r.ecology.watercourses.find(c => c.id === site.watercourseId);
    const phase = Journeys.monthAt(s.calendar, at).season;
    const renewed = (r.seasons?.[phase]?.renewal || r.renewalPerDay).flowWaterL || 0;
    return (r.stocks.flowWaterL || 0) > EPS ? course.flowPerDay : Math.min(course.flowPerDay, renewed);
  }
  function limitFlow(s, requests, at, actualRate = null) {
    const byCourse = new Map();
    for (const q of requests) if (q.action === 'buildDam') {
      const r = G.region(s, q.g.regionId), site = r.ecology.workSites.find(site => site.id === q.siteId), key = `${r.id}:${site.watercourseId}`;
      const course = r.ecology.watercourses.find(c => c.id === site.watercourseId);
      if (!byCourse.has(key)) byCourse.set(key, { list: [], flow: actualRate
        ? course.flowPerDay * (actualRate.supply[course.sourceKey] || 0) : flowAvailable(r, site, s, at) });
      byCourse.get(key).list.push(q);
    }
    for (const { list, flow } of byCourse.values()) {
      const wanted = list.reduce((sum, q) => sum + q.perDay * 1000, 0), factor = Math.min(1, flow / wanted);
      for (const q of list) {
        q.perDay *= factor;
        if (q.inputs) for (const key of Object.keys(q.inputs)) q.inputs[key] *= factor;
      }
    }
  }
  function prepareOutputs(r, rate, list, at) {
    let next = Infinity; const structures = new Map();
    for (const q of list) if (q.kind === 'ecology') {
      const work = q.perDay * q.factor;
      for (const key of outputKeys(q.action)) {
        rate.net[key] = (rate.net[key] || 0) + q.outputs[key] * work;
        if (key === 'waterL') rate.ecologicalWaterPerDay = (rate.ecologicalWaterPerDay || 0) + q.outputs[key] * work;
      }
      const site = r.ecology.workSites.find(site => site.id === q.siteId);
      if (q.action === 'buildDam' || q.action === 'buildFurnace') {
        const key = q.action === 'buildDam' ? 'damKg' : 'furnaceKg', cap = q.action === 'buildDam' ? 'maxDamKg' : 'maxFurnaceKg';
        if (!structures.has(site)) structures.set(site, { key, cap, perDay: 0 });
        structures.get(site).perDay += q.outputs[key] * work;
      }
    }
    for (const [site, { key, cap, perDay }] of structures) if (perDay > EPS)
      next = Math.min(next, at + (site[cap] - site[key]) / perDay * DAY);
    return next;
  }
  function addFlowDemand(r, rate) {
    for (const c of r.ecology?.watercourses || []) rate.demand[c.sourceKey] = (rate.demand[c.sourceKey] || 0) + c.flowPerDay;
  }
  function route(s, r, rate, list, rates) {
    for (const course of r.ecology?.watercourses || []) {
      const flow = course.flowPerDay * (rate.supply[course.sourceKey] ?? 0);
      const sites = r.ecology.workSites.filter(site => site.action === 'buildDam' && site.watercourseId === course.id && site.destroyedAt == null);
      let wanted = 0;
      for (const site of sites) {
        const fresh = list.filter(q => q.kind === 'ecology' && q.siteId === site.id).reduce((n, q) => n + q.perDay * q.factor * 1000, 0);
        wanted += Math.max(site.damKg * site.retentionLPerKgDay, fresh);
      }
      const capture = Math.min(flow, wanted), capacity = r.capacity.waterL || 0;
      const room = (r.stocks.waterL || 0) < capacity - EPS ? Infinity : Math.max(0, -(rate.net.waterL || 0));
      const retained = Math.min(capture, room), spill = capture - retained;
      rate.net.waterL = (rate.net.waterL || 0) + retained;
      const down = rates[course.downstreamRegionId]; down.renewal.waterL = (down.renewal.waterL || 0) + flow - retained;
      rate.watercourse = { id: course.id, flowPerDay: flow, retainedPerDay: retained, spillPerDay: spill, downstreamRegionId: course.downstreamRegionId };
    }
  }
  function boundaries(r, rate, at, list = []) {
    let next = Infinity;
    for (const site of r.ecology?.workSites || []) if (site.water) {
      const w = site.water, net = rate.net[w.stockKey] || 0, users = list.filter(q => q.siteId === site.id);
      for (const q of users.length ? users : [{ c: null }]) {
        const days = (waterThreshold(site, q.c) - (r.stocks[w.stockKey] || 0)) / net;
        if (days > EPS && Number.isFinite(days)) next = Math.min(next, at + days * DAY);
      }
    }
    return next;
  }
  function integrateWork(r, site, q, days) {
    const amount = q.workPerDay * days;
    if (site && amount > 0) site.performedWorkDays = (site.performedWorkDays || 0) + amount;
    for (const [key, value] of Object.entries(q.outputs)) {
      if (outputKeys(q.action).includes(key)) continue; // Already in the shared stock derivative.
      if (q.action === 'buildDam' && key === 'damKg' || q.action === 'buildFurnace' && key === 'furnaceKg') site[key] += value * amount;
      else { r.outputs ||= {}; r.outputs[key] = (r.outputs[key] || 0) + value * amount; }
    }
    r.ecologicalReceipts ||= {};
    r.ecologicalReceipts[q.action] = (r.ecologicalReceipts[q.action] || 0) + amount;
  }
  function integrateRegion(r, rate, days) {
    if (rate.watercourse) {
      r.watercourseReceipts ||= { passedL: 0, retainedL: 0, spilledL: 0 };
      r.watercourseReceipts.passedL += (rate.watercourse.flowPerDay - rate.watercourse.retainedPerDay) * days;
      r.watercourseReceipts.retainedL += rate.watercourse.retainedPerDay * days;
      r.watercourseReceipts.spilledL += rate.watercourse.spillPerDay * days;
    }
  }
  function integrateWater(r, rate, days, before) {
    if (!rate.watercourse && !r.retainedWaterL) return;
    const captured = rate.watercourse?.retainedPerDay || 0;
    const income = (rate.renewal.waterL || 0) + captured + (rate.ecologicalWaterPerDay || 0);
    const drawn = Math.max(0, income - (rate.net.waterL || 0));
    const overflow = Math.max(0, before + (rate.net.waterL || 0) * days - (r.capacity.waterL || 0));
    // This aggregate stock spends captured water first. The tag is provenance,
    // not additional water, and cannot survive an actual withdrawal/overflow.
    r.retainedWaterL = Math.min(r.stocks.waterL || 0, Math.max(0, (r.retainedWaterL || 0) + (captured - drawn) * days - overflow));
  }
  function validRates(r, rate) {
    if (r.ecologicalReceipts && !Object.values(r.ecologicalReceipts).every(nonnegative)
      || r.watercourseReceipts && !Object.values(r.watercourseReceipts).every(nonnegative)
      || r.retainedWaterL != null && (!nonnegative(r.retainedWaterL) || r.retainedWaterL > (r.stocks.waterL || 0) + EPS)
      || rate.ecologicalWaterPerDay != null && !nonnegative(rate.ecologicalWaterPerDay)) return false;
    const course = r.ecology?.watercourses?.[0], cached = rate.watercourse;
    if (!course) return !cached;
    return Boolean(cached && cached.id === course.id && cached.downstreamRegionId === course.downstreamRegionId
      && ['flowPerDay', 'retainedPerDay', 'spillPerDay'].every(k => nonnegative(cached[k]))
      && cached.flowPerDay <= course.flowPerDay + EPS && cached.retainedPerDay + cached.spillPerDay <= cached.flowPerDay + EPS
      && Math.abs(cached.flowPerDay - course.flowPerDay * (rate.supply[course.sourceKey] || 0)) < EPS);
  }
  function destroySite(r, site, at) {
    if (!site || site.destroyedAt != null) return false;
    let stockKey = null;
    if (site.action === 'rootStabilize') stockKey = site.substrateKey;
    if (site.action === 'tendWetland') stockKey = 'wetlandBedKg';
    if (site.action === 'cultivateReef') stockKey = 'livingReefKg';
    if (site.action === 'growBlooms') stockKey = 'bloomKg';
    r.outputs ||= {};
    if (stockKey) { const n = r.stocks[stockKey] || 0; r.stocks[stockKey] = 0; r.outputs[`destroyedWorkSite:${stockKey}`] = (r.outputs[`destroyedWorkSite:${stockKey}`] || 0) + n; }
    for (const key of ['damKg', 'furnaceKg']) if (site[key] > 0) {
      r.outputs[`destroyedWorkSite:${key}`] = (r.outputs[`destroyedWorkSite:${key}`] || 0) + site[key]; site[key] = 0;
    }
    site.destroyedAt = at; return true;
  }
  return { actions, diets, spec, towersValid, towers, validateSite, validateGroup, validateLinks, order, siteFor, wet, available,
    intake, outputKeys, limitFlow, prepareOutputs, addFlowDemand, route, boundaries, integrateWork, integrateRegion, integrateWater, validRates, destroySite };
});
