(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCountercoalitionRelief = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const REPORT = 120, REST = 28800, RESERVE = 1000;
  const LIMITS = 'Two independent cities, one witnessed receiving-approach obstruction and one paid supply trip. No balancing army, replacement defender, annexation, permanent alliance or divine endorsement. Original payments, wounds, cargo and transport losses remain real.';
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  function sourceFromWorld(map, cityId, partnerId, route) {
    const cities = [cityId, partnerId].map(id => {
      const g = map?.cityGovernments?.governments?.find(g => g.cityId === id);
      const p = map?.cityPolities?.polities?.find(p => p.cityId === id);
      const row = map?.strategicPoliticalHistory?.currentControlRows?.find(r => r.cityId === id);
      const population = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === id);
      return g && p && row?.controlStatus === 'sovereign' && row.recognizedAuthorityId && population?.physicalJurisdictionExists
        && population.currentPopulation >= 8 && population.physicalCondition !== 'ruined'
        ? { cityId: id, polityId: p.id, charterId: g.charter.id, authorityId: row.recognizedAuthorityId, populationSourceId: population.assetId } : null;
    });
    const relation = cities.every(Boolean) && map.cityPolities.relations?.find(r => cities.every(c => r.cityPolityIds.includes(c.polityId)));
    const original = map?.routeGraph?.routes?.find(r => r.id === (route?.corridorId || route?.id));
    if (!relation || !original || ![cityId, partnerId].every(id => original.endpointIds.includes(id))) return null;
    return { cityId, partnerId, cities, relation: copy(relation), routeId: original.id,
      interest: 'Restore the original shared receiving corridor, not a common sovereign or a war against heresy.' };
  }
  function eligible(source) {
    const r = source?.relation;
    return Boolean(source?.cityId && source.partnerId && source.cityId !== source.partnerId && source.routeId
      && source.cities?.length === 2 && [source.cityId, source.partnerId].every(id => source.cities.some(c => c.cityId === id && c.authorityId && c.charterId && c.populationSourceId))
      && r?.basis === 'corridorNeighbors' && ['cordial', 'pragmatic'].includes(r.posture)
      && r.cooperationReadiness === 'high' && r.communicationCompatibility === 'clear'
      && r.standingObligations?.includes('corridorStatusExchange') && !r.grievances?.includes('corridorResponsibilityDispute'));
  }
  function create(source, o, g, at) {
    const target = source?.cities?.find(c => c.cityId === source.cityId);
    if (!eligible(source) || !o?.worldId || !o.runId || o.source.cityId !== source.cityId || !g?.foreignCivic
      || target.charterId !== o.source.charterId || target.populationSourceId !== o.source.populationSourceId
      || target.authorityId !== g.foreignCivic.bargain.source.authority?.id) return null;
    return { id: `${o.id}:neighbor-relief`, worldId: o.worldId, runId: o.runId, source: copy(source), lastAt: at,
      representativeId: g.foreignCivic.bargain.representative.id, clerkId: g.clerk.id, defenderId: o.defenderId,
      phase: 'idle', attempts: [], job: null, mission: null, recovery: null, observed: null, message: '', serial: 0 };
  }
  function normalize(s) {
    return eligible(s?.source) && s.worldId && s.runId && s.defenderId && s.clerkId && Number.isFinite(s.lastAt)
      && Array.isArray(s.attempts) && (!s.mission || Array.isArray(s.mission.cargo)) ? copy(s) : null;
  }
  function rebind(s, from, to) { s = normalize(s); return s && s.worldId === from.worldId && s.runId === from.runId ? { ...s, ...copy(to) } : null; }
  function bound(s, o, g, c) {
    return Boolean(s && c.sourceCurrent && c.independent && s.worldId === c.worldId && s.runId === c.runId
      && s.defenderId === g.foreignCivic?.bargain.defender.id && s.clerkId === g.clerk?.id
      && s.representativeId === g.foreignCivic?.bargain.representative.id && o.source.cityId === s.source.cityId);
  }
  const held = o => o.phase === 'held' && o.claim?.heldAt != null && o.claim.endedAt == null;
  const aggression = o => ['contested', 'held'].includes(o.phase) && o.claim?.endedAt == null;
  function channel(s, g, c, own) {
    const a = g.foreignCivic.bargain.representative;
    return c.channel && c.witnessAtChannel && !c.conflictingWork && able(a) && able(g.clerk)
      && ![g.receptionAssignment, a.assignment, g.clerk.assignment].some(id => id && id !== own)
      && g.receptionWorkSeconds > 0 && g.powerSeconds > 1 && a.workSeconds > 0;
  }
  function release(s, g) {
    const id = s.job?.id;
    for (const a of [g.clerk, g.foreignCivic.bargain.representative]) if (a.assignment === id) a.assignment = null;
    if (g.receptionAssignment === id) g.receptionAssignment = null;
    s.job = null;
  }
  function truck(s, market) { return market?.production?.trucks.find(t => t.id === s.mission?.truckId); }
  function cargoPlan(market, definitions) {
    const cargo = [{ key: 'fieldRation', quantity: 1 }, { key: 'drinkingWater', quantity: 1 }, { key: 'metalParts', quantity: 2 }, { key: 'preparedManaCrystals', quantity: 1 }];
    for (const row of cargo) {
      const d = definitions.find(d => d.id === row.key), stock = market?.listings?.[row.key];
      const reserve = Math.ceil((market?.profile?.listings?.[row.key]?.targetSupply || 0) * (market?.reserveFraction ?? .6));
      if (!d || !stock || stock.supply - row.quantity < reserve || !Number.isFinite(d.basePrice) || !Number.isFinite(stock.demand)) return null;
      row.unitPrice = Math.ceil(Math.max(1, d.basePrice * Math.max(.55, Math.min(1.8, stock.demand))
        * Math.pow(Math.max(.2, d.supply) / Math.max(1, stock.supply), .42) * 1.06));
    }
    return cargo;
  }
  function dispatch(s, o, market, c, at) {
    const p = market?.production, km = c.route?.distanceKm, cargo = cargoPlan(market, c.definitions || []);
    const t = p?.trucks.find(t => !t.shipment && !t.repairAt && able(t.driver) && t.capacity >= 5 && t.fuelKm >= km * 2
      && t.condition - km * .04 >= 50 && t.driver.fatigue + km * .08 <= 75);
    if (!cargo || !t || !c.routeOpen || !Number.isFinite(km) || km <= 0 || km > 100) return false;
    const cost = cargo.reduce((n, r) => n + r.unitPrice * r.quantity, 0), freight = Math.ceil(10 + km * 2);
    if (!Number.isFinite(market.treasury) || market.treasury - cost - freight < RESERVE) return false;
    const id = `${s.id}:trip:${++s.serial}`, seconds = Math.ceil(km / 30 * 3600);
    // Exact market inventory becomes city-owned cargo. The same municipal
    // exchange receives the purchase; the original producer receives freight.
    market.treasury -= cost + freight; p.finance.exchangeMoney += cost; p.finance.money += freight; p.finance.earned += freight;
    p.finance.ledger.push({ at, kind: 'neighborReliefFreight', amount: freight, missionId: id });
    for (const r of cargo) market.listings[r.key].supply -= r.quantity;
    t.fuelKm -= km * 2; t.shipment = id;
    p.shipments.push({ id, externallyManaged: 'countercoalitionRelief', truckId: t.id, cargo: 'reliefBundle', quantity: 5,
      route: copy(c.route), departedAt: at, delivered: false, returned: false, returnAt: null });
    s.mission = { id, claimId: o.claim.id, truckId: t.id, driverId: t.driver.id, cargo, cost, freight, departedAt: at,
      distanceKm: km, positionKm: 0, travelledKm: 0, allocatedFuelKm: km * 2,
      legSeconds: seconds, deadline: at + 172800, progress: 0, phase: 'outbound', deliveredAt: null, returnedAt: null, wasReady: true, visibleOnGround: false };
    s.phase = 'outbound'; s.message = 'One original truck and driver departed with purchased, allocated cargo. No additional troops were raised.';
    return true;
  }
  function stop(s, g, at, reason) {
    release(s, g); s.phase = 'dissolved'; s.message = reason;
    const a = g.foreignCivic.bargain.defender;
    if (a.assignment === s.recovery?.id) a.assignment = null;
    s.recovery = null;
    if (s.mission && !['returned', 'returning', 'returnToTruck'].includes(s.mission.phase)) {
      const m = s.mission; m.returnSeconds = Math.ceil((m.positionKm || 0) / 30 * 3600);
      m.phase = m.visibleOnGround ? 'returnToTruck' : 'returning'; m.progress = 0; m.wasReady = false; m.endedAt = at;
    }
  }
  function advance(s, o, g, market, context, to, h = {}) {
    if (!s || !context().alive || !Number.isFinite(to) || to < s.lastAt) return false;
    // Consumers call at each physical second. Coarser callers may advance road
    // travel/rest, but cannot backfill physical walking or unobserved service.
    const dt = Math.max(0, to - s.lastAt); s.lastAt = to;
    const c = context(), b = g.foreignCivic.bargain, a = b.defender;
    if (['declined', 'dissolved', 'completed', 'failed'].includes(s.phase) && (!s.mission || s.mission.returnedAt)
      && held(o) && !s.attempts.some(r => r.claimId === o.claim.id)) {
      s.previousMissions ||= []; if (s.mission) s.previousMissions.push(copy(s.mission));
      s.mission = null; s.recovery = null; s.phase = 'idle';
    }
    if (s.phase === 'contesting' && c.accessRestored && !aggression(o)) { s.phase = 'completed'; s.message = 'Actual receiving access restored. The temporary operation ended, not a permanent alliance or city submission.'; }
    if ((!bound(s, o, g, c) || !aggression(o) || o.claim?.id !== (s.job?.claimId || s.mission?.claimId || o.claim?.id)
      || c.honoredSettlement || a.status !== 'alive' || a.health < 50 || c.defenderIncapacitated
      || g.clerk.status === 'dead' || b.representative.status === 'dead' || s.mission && to >= s.mission.deadline) && ['reporting', 'outbound', 'unloading', 'recovering', 'servicing', 'contesting'].includes(s.phase))
      stop(s, g, to, 'The specific relief purpose ended or original authority/person became unavailable. Earned withdrawal payments and all spent resources remain; no replacement expedition is created.');
    if (s.phase === 'idle' && held(o) && bound(s, o, g, c) && !c.honoredSettlement && a.health >= 50 && !c.defenderIncapacitated) {
      const report = o.reports.find(r => r.actorId === 'scientist' && r.cityId === s.source.cityId && r.claimId === o.claim.id && r.at >= o.claim.at
        && ['hostileApproachClaim', 'outerApproachAttack'].includes(r.kind) && c.reportingWitnessIds?.includes(r.witnessId));
      if (report && !s.attempts.some(r => r.claimId === o.claim.id) && channel(s, g, c, null)
        && g.receptionWorkSeconds >= REPORT && g.powerSeconds >= REPORT + 1 && b.representative.workSeconds >= REPORT) {
        const id = `${s.id}:report:${++s.serial}`;
        s.job = { id, reportId: report.id, witnessId: report.witnessId, claimId: o.claim.id, progress: 0, wasReady: true, deadline: to + 3600 };
        g.receptionAssignment = g.clerk.assignment = b.representative.assignment = id;
        s.attempts.push({ claimId: o.claim.id, reportId: report.id, startedAt: to, receivedAt: null }); s.phase = 'reporting';
        return true;
      }
    }
    if (s.job && to >= s.job.deadline) { release(s, g); s.phase = 'declined'; s.message = 'The original report could not be transmitted within its one-hour channel allocation. Spent work remains spent; no recipient or response was invented.'; }
    if (s.job) {
      const j = s.job;
      const ready = bound(s, o, g, c) && channel(s, g, c, j.id) && c.reportingWitnessIds?.includes(j.witnessId);
      if (ready && j.wasReady) {
        const n = Math.min(dt, REPORT - j.progress, g.receptionWorkSeconds, Math.max(0, g.powerSeconds - 1), b.representative.workSeconds);
        j.progress += n; g.receptionWorkSeconds -= n; g.powerSeconds -= n; b.representative.workSeconds -= n;
      }
      j.wasReady = ready;
      if (j.progress >= REPORT) {
        s.attempts.at(-1).receivedAt = to; release(s, g);
        if (!dispatch(s, o, market, c, to)) { s.phase = 'declined'; s.message = 'The neighbor received the report but cannot fund or physically support this bounded response. No threat-meter force appeared.'; }
      }
    }
    const m = s.mission, t = m && truck(s, market);
    if (m && !m.returnedAt && t && t.driver.id === m.driverId) {
      const d = t.driver, sh = market.production.shipments.find(r => r.id === m.id);
      if (d.status === 'dead') {
        m.transportLostAt ??= to;
        if (!m.deliveredAt && s.phase !== 'failed') { stop(s, g, to, 'The original driver died before delivery. The attempt failed; its original truck, cargo and remains are not replaced.'); s.phase = 'failed'; }
        m.phase = 'stranded';
      }
      const ready = t.shipment === m.id && sh?.externallyManaged === 'countercoalitionRelief' && sh.truckId === t.id
        && able(d) && !h.incapacitated?.(d) && t.condition >= 50 && c.routeOpen;
      if (['outbound', 'returning'].includes(m.phase)) {
        const seconds = m.phase === 'outbound' ? m.legSeconds : (m.returnSeconds ?? m.legSeconds);
        if (ready && m.wasReady && to > m.departedAt) {
          const used = Math.min(dt, Math.max(0, seconds - m.progress)), km = Math.min(m.phase === 'outbound' ? m.distanceKm - m.positionKm : m.positionKm, used * 30 / 3600);
          m.progress += used; m.travelledKm += km; m.positionKm += m.phase === 'outbound' ? km : -km;
          t.condition -= km * .02; d.fatigue += km * .04;
        }
        m.wasReady = ready;
        if (m.progress >= seconds) {
          if (m.phase === 'returning') {
            m.phase = 'returned'; m.returnedAt = to; if (t.shipment === m.id) t.shipment = null;
            m.returnedFuelKm = Math.max(0, m.allocatedFuelKm - m.travelledKm); t.fuelKm += m.returnedFuelKm;
            if (sh) { sh.returned = true; sh.returnAt = to; }
            if (d.status === 'alive') { d.mapCell = null; d.roomId = null; } m.visibleOnGround = false;
          } else if (h.arrive?.(d, t)) {
            m.phase = 'unloading'; m.visibleOnGround = true; m.progress = 0; s.phase = 'unloading';
          }
        }
      } else if (m.phase === 'unloading' && ready) {
        if (!c.atCargo) { m.progress = 0; if (dt > 0) h.moveCargo?.(d); }
        else if (c.unloadClear) {
          m.progress += Math.min(1, dt);
          if (m.progress >= 60 && h.unload?.(m.cargo, m.id)) {
            m.deliveredAt = to; if (sh) sh.delivered = true; d.fatigue += 1; m.phase = 'returnToTruck'; m.progress = 0;
            s.phase = 'recovering'; s.message = 'Actual cargo unloaded at the original municipal rear service point; it still requires supplied off-duty recovery and physical installation work.';
          }
        } else m.progress = 0;
      } else if (m.phase === 'returnToTruck' && ready) {
        if (c.atTruck) { m.phase = 'returning'; m.progress = 0; m.wasReady = true; m.visibleOnGround = false; d.mapCell = null; d.roomId = null; t.mapCell = null; t.roomId = null; }
        else if (dt > 0) h.moveTruck?.(d);
      }
    }
    if (['recovering', 'servicing'].includes(s.phase)) {
      const stacks = h.stacks?.() || [], owned = (key, carried = false) => stacks.find(i => i.key === key && i.quantity > 0 && i.cityOwnerId === s.source.cityId
        && i.reliefMissionId === m.id && (carried ? i.carriedBy === a.id : !i.carriedBy && same(i.cell, c.cargoCell))
        && !i.reservedTaskId && !i.containerId && !i.tags?.includes('contaminated'));
      const own = !a.assignment || [o.station.duty.id, s.recovery?.id].includes(a.assignment);
      const adjacent = (x, y) => x && y && x.z === y.z && Math.max(Math.abs(x.x - y.x), Math.abs(x.y - y.y)) <= 1;
      if (!s.recovery && own && a.roomId === o.home.roomId && adjacent(a.mapCell, o.home.cell) && adjacent(a.mapCell, c.cargoCell)
        && c.restSafe && owned('fieldRation') && owned('drinkingWater')) {
        for (const key of ['fieldRation', 'drinkingWater']) { const i = owned(key); i.quantity--; i.knownQuantity = Math.min(i.knownQuantity ?? i.quantity, i.quantity); }
        s.recovery = { id: `${m.id}:original-defender-rest`, progress: 0, wasReady: true, at: to, cell: copy(a.mapCell), roomId: a.roomId,
          workCap: Math.max(a.workSeconds, 3600), serviceProgress: 0 };
        a.assignment = s.recovery.id;
      }
      const r = s.recovery;
      if (r && s.phase === 'recovering') {
        const ready = own && a.assignment === r.id && a.roomId === r.roomId && same(a.mapCell, r.cell) && c.restSafe;
        if (ready && r.wasReady && to > r.at) r.progress += dt;
        if (!ready) r.progress = 0; r.wasReady = ready;
        if (r.progress >= REST && h.collectService?.(a, stacks.filter(i => ['metalParts', 'preparedManaCrystals'].includes(i.key) && i === owned(i.key)))) {
          a.workSeconds = r.workCap; a.fatigue = 0; a.stamina = Math.min(a.staminaCapacity || 100, a.stamina + 60);
          r.restedAt = to; s.phase = 'servicing';
        }
      }
      if (r && s.phase === 'servicing' && a.assignment === r.id && c.obstructsService) {
        a.assignment = null; o.defenderPhase = 'guarding'; s.phase = 'contesting';
        s.message = 'Personally perceived obstruction interrupted installation work. The recovered original defender resumes the actual contest; uninstalled carried supplies remain, not a repaired wall or free charge.';
      }
      if (r && s.phase === 'servicing' && a.assignment === r.id && !c.defenderIncapacitated && !c.suppressed) {
        if (!c.atService) { if (dt > 0 && a.stamina > 1 && a.workSeconds > 1 && h.moveService?.(a)) { a.stamina--; a.workSeconds--; } }
        else if (c.serviceSafe && a.workSeconds > 0 && dt > 0) {
          r.serviceProgress++; a.workSeconds--;
          if (r.serviceProgress >= 120) {
            const parts = owned('metalParts', true), feed = owned('preparedManaCrystals', true);
            if (c.condition < 100 && parts?.quantity >= 2 && h.repair?.(Math.min(100, c.condition + 25))) {
              parts.quantity -= 2; parts.knownQuantity = Math.min(parts.knownQuantity ?? parts.quantity, parts.quantity); r.repairedAt = to;
            }
            if (feed && o.station.energy <= o.source.baselineEnergy - 21600) {
              feed.quantity--; feed.knownQuantity = Math.min(feed.knownQuantity ?? feed.quantity, feed.quantity);
              o.station.energy += 21600; o.station.charged = (o.station.charged || 0) + 21600; r.chargedAt = to;
            }
            a.assignment = null; o.defenderPhase = 'guarding'; s.phase = 'contesting'; r.servicedAt = to;
            s.message = 'The same surviving defender completed supplied recovery and physical service, with no health, injury or personal-mana reset. Actual movement and shared combat now decide access.';
          }
        }
      }
    }
    if (s.phase === 'contesting' && c.accessRestored && !aggression(o)) { s.phase = 'completed'; s.message = 'Actual receiving access restored. The temporary operation ended, not a permanent alliance or city submission.'; }
    return true;
  }
  function receive(s, c, at) {
    if (!s || !(c.convoyVisible || c.receivedAtCounter && s.attempts.some(r => r.receivedAt != null))) return false;
    s.observed = { at, cityId: s.source.cityId, partnerCityId: s.source.partnerId, purpose: s.source.interest,
      phase: c.receivedAtCounter ? s.phase : s.mission?.phase,
      message: c.receivedAtCounter ? s.message : 'Personally observed original relief carrier on this ground. Unseen municipal recovery, deliberations and stores remain unverified.',
      mission: c.convoyVisible && s.mission ? { phase: s.mission.phase, deliveredAt: s.mission.deliveredAt } : null, limits: LIMITS };
    return true;
  }
  return { REPORT, REST, RESERVE, LIMITS, same, sourceFromWorld, eligible, create, normalize, rebind, bound, truck, cargoPlan, advance, receive, publicView: s => copy(s?.observed) };
});
