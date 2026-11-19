// Internal regional work accounts. This does not adopt diagnostic world sources.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./beast-habitat') : root.HelixBeastHabitat,
    node ? require('./beast-demography') : root.HelixBeastDemography,
    node ? require('./beast-seasonal-journeys') : root.HelixBeastSeasonalJourneys,
    node ? require('./beast-regional-work') : root.HelixBeastRegionalWork);
  if (node) module.exports = api;
  root.HelixBeastRegionalEcology = api;
})(globalThis, function (Data, Habitat, Demography, Journeys, Work) {
  'use strict';
  const DAY = 86400, EPS = 1e-8, channels = Data.ledgers.map(([id]) => id);
  const nonnegative = n => Number.isFinite(n) && n >= 0;
  const vector = () => Object.fromEntries(channels.map(k => [k, 0]));
  const validVector = v => v && channels.every(k => nonnegative(v[k])) && Object.keys(v).every(k => channels.includes(k));
  const fractions = v => v && Object.values(v).every(n => nonnegative(n) && n <= 1);
  const GRAZER = 'beast:thunderback-grazer';
  const renewable = ['forageKg', 'organicKg', 'detritusKg', 'planktonKg', 'waterL', 'excessMana'];
  function validate(r) {
    const e = r.ecology; if (!e) return;
    if (!validVector(r.condition) || channels.some(k => r.condition[k] > 100)
      || !validVector(e.referenceCondition) || channels.some(k => e.referenceCondition[k] > 100)
      || !e.viabilityFloors || Object.entries(e.viabilityFloors).some(([k, v]) => !channels.includes(k) || !(v > 0) || v > e.referenceCondition[k])
      || !validVector(e.naturalRenewalEP) || !e.renewalDependencies
      || Object.entries(e.renewalDependencies).some(([key, names]) => !renewable.includes(key) || !Array.isArray(names)
        || !names.length || new Set(names).size !== names.length || names.some(k => !channels.includes(k)))
      || !Array.isArray(e.workSites) || !Array.isArray(e.renewalSites)
      || e.floodable != null && typeof e.floodable !== 'boolean') throw Error('Invalid sourced regional ecology');
    for (const season of r.seasons || []) if (season.renewalEP && !validVector(season.renewalEP)) throw Error('Invalid seasonal ecological renewal');
    const ids = new Set();
    for (const site of e.workSites) {
      if (ids.has(site.id)) throw Error('Duplicate original regional work site');
      Work.validateSite(site, r);
      ids.add(site.id);
    }
    const shares = {}, ledgerShares = {};
    for (const site of e.renewalSites) {
      if (typeof site.id !== 'string' || !site.id || ids.has(site.id) || !site.materials || !Object.keys(site.materials).length
        || !Object.values(site.materials).every(n => Number.isFinite(n) && n > 0)
        || !fractions(site.renewalShares) || !fractions(site.ledgerShares)
        || Object.keys(site.renewalShares).some(k => !renewable.includes(k))
        || Object.keys(site.ledgerShares).some(k => !channels.includes(k))
        || site.destroyedAt != null && !nonnegative(site.destroyedAt)) throw Error('Invalid original renewal site');
      ids.add(site.id);
      for (const [key, share] of Object.entries(site.renewalShares)) shares[key] = (shares[key] || 0) + share;
      for (const [key, share] of Object.entries(site.ledgerShares)) ledgerShares[key] = (ledgerShares[key] || 0) + share;
    }
    if ([...Object.values(shares), ...Object.values(ledgerShares)].some(n => n > 1 + EPS)) throw Error('Overallocated renewal sources');
    const naturalVectors = [e.naturalRenewalEP, ...(r.seasons || []).map(s => s.renewalEP).filter(Boolean)];
    if (naturalVectors.some(v => channels.some(k => v[k] > 0 && Math.abs((ledgerShares[k] || 0) - 1) > EPS)))
      throw Error('Ecological renewal needs its original physical source');
    const materials = {};
    for (const site of e.renewalSites) if (site.destroyedAt == null) for (const [k, n] of Object.entries(site.materials)) materials[k] = (materials[k] || 0) + n;
    if (Object.entries(materials).some(([k, n]) => (r.stocks[k] || 0) + EPS < n)) throw Error('Missing original renewal-site material');
  }
  function validateGroup(g, regions) {
    if (g.activityState && ['sleeping', 'dreamConsent'].some(k => typeof g.activityState[k] !== 'boolean')) throw Error('Invalid original activity/consent state');
    if (!g.ecology) return;
    const e = g.ecology, r = regions.find(r => r.id === e.regionId);
    if (!r?.ecology || !(e.effortFraction > 0 && e.effortFraction <= 1)
      || g.resources?.mana != null && g.resources.mana !== 'excessMana'
      || g.resources?.other != null && g.resources.other !== 'chargeMJ'
      || !(e.action === 'graze' && g.speciesId === GRAZER && g.resources?.foodKg === 'forageKg' || Work.actions[e.action]))
      throw Error('Unsupported or unsourced regional action');
    if (e.action !== 'graze') Work.validateGroup(g, r);
  }
  function initialize(s) {
    for (const r of s.regions) if (r.ecology && !r.deferred) {
      Work.Flood.initialize(r, s.clock);
      r.ecologicalAccount = { natural: vector(), nurturing: vector(), destruction: vector(),
        sourceLosses: [], episodes: [], exhausted: false,
        viabilityHistory: { startedAt: s.clock, minimumCondition: { ...r.condition }, floorBreaches: {},
          completedCycles: 0, lastCycleBalance: vector(), maintenanceFailures: {} } };
      // A source proposal's label is not a causal episode.
      r.exhausted = false;
    }
  }
  function plan(g, month) {
    if (g.ecology) g.ecologicalPlan = { ...g.ecology, monthIndex: month.index,
      requested: g.will !== false && g.willing !== false };
  }
  function survivingShare(r, name, kind) {
    return Math.max(0, 1 - r.ecology.renewalSites.filter(site => site.destroyedAt != null)
      .reduce((sum, site) => sum + (site[kind][name] || 0), 0));
  }
  function renewal(r, key, base) {
    if (!r.ecology) return base;
    const dependencies = r.ecology.renewalDependencies[key] || [];
    const condition = Math.min(1, ...dependencies.map(k => r.ecology.referenceCondition[k] > 0
      ? r.condition[k] / r.ecology.referenceCondition[k] : 1));
    return base * condition * survivingShare(r, key, 'renewalShares');
  }
  function requests(s, at, extra) {
    const ecological = [];
    for (const g of s.groups) {
      const p = g.ecologicalPlan, r = Demography.region(s, Journeys.location(g));
      if (!p?.requested || !r?.ecology || r.id !== p.regionId || g.transit || g.will === false || g.willing === false) continue;
      const site = p.action !== 'graze' ? r.ecology.workSites.find(site => site.id === p.siteId) : null;
      for (const c of g.cohorts) {
        const n = Demography.size(c.ranges), life = Data.lifecycle[c.speciesId];
        if (!n || c.health <= .3 || c.contactBusyUntil > at || c.regional?.workBlocked || !Demography.mature(c, at) || site && !Work.available(s, g, c, site, at)
          || p.action !== 'graze' && !site || p.action === 'graze' && g.activityState?.sleeping) continue;
        const spec = Work.spec(p.action);
        const scale = Math.min(1, c.massKg / life.adultKg) * c.health;
        ecological.push({ kind: 'ecology', g, c, recipe: Work.recipe(site, p.action), perDay: n * scale,
          action: p.action, siteId: site?.id || null, effortFraction: p.effortFraction,
          outputs: spec?.outputs || {}, channels: spec?.channels || channels.filter(k => k !== 'arcaneStability') });
      }
    }
    const workers = new Map();
    for (const request of ecological) if (request.siteId) {
      const key = `${request.g.regionId}:${request.siteId}`;
      workers.set(key, (workers.get(key) || 0) + Demography.size(request.c.ranges));
    }
    const all = [...extra, ...ecological], byCohort = new Map();
    for (const request of all) {
      if (!byCohort.has(request.c)) byCohort.set(request.c, []);
      byCohort.get(request.c).push(request);
    }
    for (const [c, list] of byCohort) {
      const ecologicalWork = list.find(q => q.kind === 'ecology');
      if (!ecologicalWork) continue; // Preserve legacy demographic-only sources.
      const g = ecologicalWork.g, life = Data.lifecycle[c.speciesId], n = Demography.size(c.ranges);
      let weight = ecologicalWork.effortFraction;
      const weights = new Map();
      for (const q of list) if (q.kind === 'growth' || q.kind === 'brood') {
        const w = q.kind === 'growth' ? 1 : Math.min(1, Demography.size(q.brood.parents) / n);
        weights.set(q, w); weight += w;
      }
      for (const [q, w] of weights) { const fraction = w / Math.max(1, weight); q.perDay *= fraction; if (q.manaPerDay) q.manaPerDay *= fraction; }
      let fraction = ecologicalWork.effortFraction / Math.max(1, weight);
      if (ecologicalWork.siteId) {
        const r = Demography.region(s, g.regionId), site = r.ecology.workSites.find(site => site.id === ecologicalWork.siteId);
        fraction *= Math.min(1, site.maxWorkers / workers.get(`${r.id}:${site.id}`));
      }
      ecologicalWork.perDay *= fraction;
      // One physiological work-energy bill for this cohort, shared with growth
      // and reproduction. Published daily throughput already includes rest.
      if (!list.some(q => q.kind === 'activity') && (life.manaDay > 0 || life.otherDay > 0)) {
        const scale = n * (c.massKg / life.adultKg) ** .75, inputs = {};
        if (life.manaDay > 0) inputs[g.resources?.mana || 'excessMana'] = life.manaDay * scale;
        if (life.otherDay > 0) inputs[g.resources?.other || 'chargeMJ'] = life.otherDay * scale;
        all.push({ kind: 'activity', g, c, recipe: {}, perDay: 0, additionalInputs: inputs });
      }
    }
    Work.limitFlow(s, ecological, at);
    return all.filter(q => q.kind !== 'ecology' || q.perDay > EPS);
  }
  function build(s, rates, extra, at, season) {
    let next = Infinity;
    const activityByCohort = new Map(extra.filter(q => q.kind === 'activity').map(q => [q.c, q]));
    for (const r of s.regions) if (r.ecology) {
      const rate = rates[r.id], raw = r.seasons?.[season]?.renewalEP || r.ecology.naturalRenewalEP;
      rate.ecology = { natural: vector(), nurturing: vector(), destruction: vector(), net: vector() };
      for (const k of channels) rate.ecology.natural[k] = raw[k] * survivingShare(r, k, 'ledgerShares');
    }
    for (const q of extra) if (q.kind === 'ecology') {
      const r = Demography.region(s, Journeys.location(q.g)), e = rates[r.id].ecology, authored = Data.rates[q.c.speciesId];
      // Ordinary grazing has already paid for its consumed physical food once.
      const food = q.g.resources?.foodKg || 'foodKg';
      const fed = ['graze', 'filterPlankton'].includes(q.action) ? rates[r.id].supply[food] ?? 0 : 1;
      q.workPerDay = q.perDay * q.factor * fed;
      if (q.action === 'filterPlankton') q.workPerDay *= Work.towers(q.c);
      if (q.action === 'filterMana') {
        const activity = activityByCohort.get(q.c);
        // Regional filtration credits only mana actually taken and spent on
        // physiology/work. It neither fills an unknown personal reserve nor
        // bills the same mana twice. Match the local one-mana/second ceiling.
        q.filteredManaPerDay = Math.min(q.perDay * q.factor * DAY, q.perDay / Math.max(1, Demography.size(q.c.ranges))
          * (activity?.inputs.excessMana || 0) * q.factor);
        q.workPerDay = q.filteredManaPerDay / DAY;
      }
      for (const k of q.channels) {
        const index = channels.indexOf(k);
        e.nurturing[k] += q.action === 'graze' ? 0 : authored.nurturing[index] * q.workPerDay;
        e.destruction[k] += authored.destruction[index] * q.workPerDay;
      }
    }
    for (const r of s.regions) if (r.ecology) {
      const rate = rates[r.id];
      rate.ecology.destruction.soilCover += rate.drainage?.erosionEPDay || 0;
    }
    for (const r of s.regions) if (r.ecology) for (const k of channels) {
      const e = rates[r.id].ecology, net = (e.natural[k] + e.nurturing[k] - e.destruction[k]) / r.areaHa;
      e.net[k] = net;
      const targets = [0, 100, r.ecology.viabilityFloors[k]].filter(Number.isFinite);
      for (const target of targets) if (Math.abs(net) > EPS && (target - r.condition[k]) / net > EPS)
        next = Math.min(next, at + (target - r.condition[k]) / net * DAY);
    }
    return next;
  }
  function integrate(s, days, to) {
    for (const q of s.extraRates || []) if (q.kind === 'ecology' && q.workPerDay > 0) {
      const g = Demography.group(s, q.groupId), c = Demography.cohort(s, g.id, q.cohortId), r = Demography.region(s, Journeys.location(g));
      const work = q.workPerDay * days;
      const site = r.ecology.workSites.find(site => site.id === q.siteId);
      Work.integrateWork(r, site, q, days);
      if (q.action !== 'graze') {
        c.ecologyHistory ||= {};
        c.ecologyHistory[r.id] = (c.ecologyHistory[r.id] || 0) + work / Math.max(1, Demography.size(c.ranges));
      }
    }
    for (const r of s.regions) if (r.ecology) {
      Work.integrateRegion(r, s.rates[r.id], days);
      const a = r.ecologicalAccount, e = s.rates[r.id].ecology;
      for (const k of channels) {
        for (const kind of ['natural', 'nurturing', 'destruction']) a[kind][k] += e[kind][k] * days;
        const before = r.condition[k];
        r.condition[k] = Math.max(0, Math.min(100, r.condition[k] + e.net[k] * days));
        // Retain transient lows even if later supplied work restores the field.
        // Old snapshots without this history remain unverified, never backfilled.
        const history = a.viabilityHistory, floor = r.ecology.viabilityFloors[k];
        if (history) {
          history.minimumCondition[k] = Math.min(history.minimumCondition[k], before, r.condition[k]);
          if (Number.isFinite(floor) && Math.min(before, r.condition[k]) < floor - EPS) {
            const start = before >= floor && e.net[k] < 0 ? Math.min(days, (before - floor) / -e.net[k]) : 0;
            const end = before < floor && e.net[k] > 0 ? Math.min(days, (floor - before) / e.net[k]) : days;
            const breach = history.floorBreaches[k] ||= { firstAt: to - (days - start) * DAY, belowDays: 0 };
            breach.belowDays += Math.max(0, end - start);
          }
        }
      }
      for (const loss of a.sourceLosses) for (const k of loss.channels) loss.damageAfter[k] += e.destruction[k] * days;
      const history = a.viabilityHistory, cycleSeconds = s.calendar.monthDays.reduce((n, d) => n + d, 0) * DAY;
      const cycle = Math.round((to - s.calendar.epochAt) / cycleSeconds);
      if (history && cycle > history.completedCycles && Math.abs(to - s.calendar.epochAt - cycle * cycleSeconds) < 1e-6) {
        for (const k of channels) {
          const balance = a.natural[k] + a.nurturing[k] - a.destruction[k], delta = balance - history.lastCycleBalance[k];
          if (Object.hasOwn(r.ecology.viabilityFloors, k) && delta < -EPS) {
            const failure = history.maintenanceFailures[k] ||= { firstAt: to, cycles: 0, missingEP: 0 };
            failure.cycles++; failure.missingEP -= delta;
          }
          history.lastCycleBalance[k] = balance;
        }
        history.completedCycles = cycle;
      }
      assessCondition(r, to, e);
      // Rejected water renewal remains actual water leaving the usable account,
      // not matter destroyed by a percentage score. Food is foregone production.
      const rejected = s.rates[r.id].rejectedWaterPerDay || 0;
      if (rejected > 0) { r.outputs ||= {}; r.outputs.unusableWaterL = (r.outputs.unusableWaterL || 0) + rejected * days; }
    }
  }
  function assessCondition(r, at, rate) {
    const a = r.ecologicalAccount;
    if (a.viabilityHistory) for (const k of channels) {
      const history = a.viabilityHistory;
      history.minimumCondition[k] = Math.min(history.minimumCondition[k], r.condition[k]);
      if (r.condition[k] < r.ecology.viabilityFloors[k] - EPS)
        history.floorBreaches[k] ||= { firstAt: at, belowDays: 0 };
    }
    const causalLoss = a.sourceLosses.find(loss => Object.entries(r.ecology.viabilityFloors).some(([k, floor]) => loss.channels.includes(k)
      && r.condition[k] <= floor + EPS && loss.damageAfter[k] > EPS && r.condition[k] < loss.condition[k] - EPS));
    if (!a.exhausted && causalLoss) { a.exhausted = true; a.episodes.push({ exhaustedAt: at, lossId: causalLoss.id }); }
    if (a.exhausted && Object.entries(r.ecology.viabilityFloors).every(([k, floor]) => r.condition[k] > floor + EPS)
      && channels.some(k => rate.nurturing[k] > 0 || rate.natural[k] > 0)) {
      a.exhausted = false; a.episodes.at(-1).recoveredAt = at;
    }
    r.exhausted = a.exhausted;
  }
  function loss(r, id, at, detail) {
    if (!r?.ecology) return;
    const a = r.ecologicalAccount;
    // Pool repeated cohort mortality by original stream/location/cause; retain
    // first/last time and cumulative count, never a record per background body.
    let event = a.sourceLosses.find(e => e.id === id);
    if (!event) { event = { id, firstAt: at, lastAt: at, condition: { ...r.condition }, damageAfter: vector(), ...detail, count: 0 }; a.sourceLosses.push(event); }
    event.lastAt = at; event.count += detail.count || 1;
  }
  function lostContributor(s, g, c, n, at, cause, ref) {
    const regionId = Journeys.location(g);
    if (c.ecologyHistory?.[regionId] > EPS) loss(Demography.region(s, regionId),
      `contributor:${c.originId}:${regionId}:${cause}`, at, { kind: 'contributor', originId: c.originId, count: n, cause, ref,
        channels: Work.spec(g.ecology.action).channels.filter(k => Data.rates[c.speciesId].nurturing[channels.indexOf(k)] > 0) });
  }
  function destroySite(s, regionId, siteId, at, cause) {
    const r = Demography.region(s, regionId), site = r?.ecology?.renewalSites.find(site => site.id === siteId);
    if (!site || site.destroyedAt != null || Object.entries(site.materials).some(([k, n]) => (r.stocks[k] || 0) < n)) return false;
    site.destroyedAt = at; r.outputs ||= {};
    for (const [k, n] of Object.entries(site.materials)) { r.stocks[k] -= n; r.outputs[`destroyedSite:${k}`] = (r.outputs[`destroyedSite:${k}`] || 0) + n; }
    const affected = new Set(Object.keys(site.ledgerShares));
    for (const key of Object.keys(site.renewalShares)) for (const k of r.ecology.renewalDependencies[key] || []) affected.add(k);
    loss(r, `renewal:${siteId}`, at, { kind: 'renewalSite', siteId, cause, channels: [...affected] }); return true;
  }
  function destroyWorkSite(s, regionId, siteId, at, cause) {
    const r = Demography.region(s, regionId), site = r?.ecology?.workSites.find(site => site.id === siteId);
    const originalDamKg = site?.action === 'buildDam' ? site.damKg : 0;
    const allDamKg = r?.ecology?.workSites.filter(site => site.action === 'buildDam' && site.destroyedAt == null)
      .reduce((n, site) => n + site.damKg, 0) || 0;
    if (!r || !Work.destroySite(r, site, at)) return false;
    if (originalDamKg > 0 && r.retainedWaterL > 0) {
      const course = r.ecology.watercourses.find(c => c.id === site.watercourseId);
      const obstructed = course.outlet?.blocked === true, down = obstructed ? r : Demography.region(s, course.downstreamRegionId);
      const released = Math.min(r.stocks.waterL || 0, r.retainedWaterL * originalDamKg / allDamKg);
      r.stocks.waterL -= released; r.retainedWaterL -= released;
      const overflow = Math.max(0, (down.stocks.waterL || 0) + released - (down.capacity.waterL || 0));
      down.stocks.waterL = Math.min(down.capacity.waterL || 0, (down.stocks.waterL || 0) + released);
      if (!down.ecology.floodable) { down.outputs ||= {}; down.outputs.waterLOverflow = (down.outputs.waterLOverflow || 0) + overflow; }
      r.watercourseReceipts ||= { passedL: 0, retainedL: 0, spilledL: 0 };
      r.watercourseReceipts.releasedL = (r.watercourseReceipts.releasedL || 0) + released;
      if (obstructed) r.watercourseReceipts.blockedReleaseL = (r.watercourseReceipts.blockedReleaseL || 0) + released;
      if (overflow > 0 && down.ecology.floodable) {
        const damage = Work.Flood.addBreach(down, overflow, at);
        down.ecologicalAccount.destruction.soilCover += damage;
        down.condition.soilCover = Math.max(0, down.condition.soilCover - damage / down.areaHa);
        for (const loss of down.ecologicalAccount.sourceLosses) if (loss.channels.includes('soilCover')) loss.damageAfter.soilCover += damage;
        assessCondition(down, at, s.rates[down.id].ecology);
      }
    }
    if (site.performedWorkDays > EPS) loss(r, `work-site:${siteId}`, at, { kind: 'workSite', siteId, cause,
      channels: Work.spec(site.action).channels.filter(k => Data.rates[site.speciesId].nurturing[channels.indexOf(k)] > 0) });
    return true;
  }
  function valid(s) {
    for (const r of s.regions) if (r.ecology && !r.deferred) {
      const at = s.regionClocks?.[r.id]?.appliedAt ?? s.appliedAt;
      const a = r.ecologicalAccount, e = s.rates[r.id]?.ecology;
      const history = a?.viabilityHistory;
      if (history && (!nonnegative(history.startedAt) || history.startedAt > at + EPS
        || !validVector(history.minimumCondition) || channels.some(k => history.minimumCondition[k] > r.condition[k] + EPS)
        || !history.floorBreaches || Object.entries(history.floorBreaches).some(([k, b]) =>
          !Object.hasOwn(r.ecology.viabilityFloors, k) || !nonnegative(b.firstAt) || b.firstAt < history.startedAt - EPS
          || b.firstAt > at + EPS || !nonnegative(b.belowDays)
          || b.belowDays > (at - history.startedAt) / DAY + EPS
          || history.minimumCondition[k] >= r.ecology.viabilityFloors[k] - EPS)
        || !Number.isSafeInteger(history.completedCycles) || history.completedCycles < 0
        || history.completedCycles > Math.floor((at - s.calendar.epochAt + EPS) / (s.calendar.monthDays.reduce((n, d) => n + d, 0) * DAY))
        || !history.lastCycleBalance || channels.some(k => !Number.isFinite(history.lastCycleBalance[k]))
        || !history.maintenanceFailures || Object.entries(history.maintenanceFailures).some(([k, b]) =>
          !Object.hasOwn(r.ecology.viabilityFloors, k) || !nonnegative(b.firstAt) || b.firstAt > at + EPS
          || !Number.isSafeInteger(b.cycles) || b.cycles < 1 || b.cycles > history.completedCycles
          || !(b.missingEP > 0) || !Number.isFinite(b.missingEP)))) return false;
      if (!a || !e || !Work.validRates(r, s.rates[r.id]) || !Work.Flood.valid(r, s.rates[r.id], at)
        || !['natural', 'nurturing', 'destruction'].every(k => validVector(a[k]) && validVector(e[k]))
        || !e.net || !channels.every(k => Number.isFinite(e.net[k])
          && Math.abs(e.net[k] - (e.natural[k] + e.nurturing[k] - e.destruction[k]) / r.areaHa) < EPS)
        || typeof a.exhausted !== 'boolean' || r.exhausted !== a.exhausted
        || !Array.isArray(a.episodes) || !Array.isArray(a.sourceLosses)
        || new Set(a.sourceLosses.map(l => l.id)).size !== a.sourceLosses.length
        || a.sourceLosses.some(l => !validVector(l.condition) || !validVector(l.damageAfter) || !nonnegative(l.firstAt) || !nonnegative(l.lastAt)
          || l.lastAt < l.firstAt || l.lastAt > at + EPS || !(l.count > 0) || !Number.isSafeInteger(l.count)
          || !Array.isArray(l.channels) || l.channels.some(k => !channels.includes(k))
          || !(l.kind === 'renewalSite' && r.ecology.renewalSites.some(site => site.id === l.siteId && site.destroyedAt != null)
            || l.kind === 'workSite' && r.ecology.workSites.some(site => site.id === l.siteId && site.destroyedAt != null && site.performedWorkDays > 0)
            || l.kind === 'contributor' && s.origins[l.originId]
              && l.count <= [...s.losses, ...(s.lossBatches || [])].filter(dead => dead.originId === l.originId && dead.regionId === r.id && dead.cause === l.cause)
                .reduce((n, dead) => n + (dead.count || 1), 0)))
        || a.exhausted && !a.episodes.length
        || a.episodes.some(e => !nonnegative(e.exhaustedAt) || !a.sourceLosses.some(l => l.id === e.lossId)
          || e.exhaustedAt > at + EPS
          || e.recoveredAt != null && (!nonnegative(e.recoveredAt) || e.recoveredAt < e.exhaustedAt))) return false;
    }
    for (const g of s.groups) {
      if (g.ecology) {
        const p = g.ecologicalPlan;
        if (!p || typeof p.requested !== 'boolean' || p.monthIndex !== s.plans.at(-1).index
          || ['action', 'regionId', 'siteId', 'effortFraction'].some(k => p[k] !== g.ecology[k])) return false;
      }
      for (const c of g.cohorts) if (c.ecologyHistory
        && Object.entries(c.ecologyHistory).some(([id, n]) => !nonnegative(n) || !Demography.region(s, id)?.ecology)) return false;
    }
    for (const q of s.extraRates || []) if (q.kind === 'ecology') {
      const g = Demography.group(s, q.groupId), spec = Work.spec(q.action), plan = g?.ecologicalPlan;
      const site = g && Demography.region(s, Journeys.location(g))?.ecology?.workSites.find(site => site.id === q.siteId);
      if (!plan || q.action !== plan.action || q.workPerDay > q.perDay * q.factor + EPS
        || JSON.stringify(q.outputs) !== JSON.stringify(spec?.outputs || {})
        || JSON.stringify(q.recipe) !== JSON.stringify(Work.recipe(site, q.action))
        || JSON.stringify(q.channels) !== JSON.stringify(spec?.channels || channels.filter(k => k !== 'arcaneStability'))) return false;
    }
    return true;
  }
  return { channels, validate, validateGroup, initialize, plan, renewal, requests, build, integrate, lostContributor, destroySite, destroyWorkSite, valid, Work };
});
