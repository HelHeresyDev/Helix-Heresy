(function initStrategicJourneys(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicJourneys = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicJourneysApi() {
  "use strict";

  const HOUR = 3600;
  const ACTIVE_STATUSES = Object.freeze(["scheduled", "enRoute", "held", "returning", "diverted", "stranded"]);
  const TERMINAL_STATUSES = Object.freeze(["arrived", "returned", "cancelled"]);
  const MODE_DEFS = Object.freeze({
    hiredPassengerRoad: Object.freeze({ id: "hiredPassengerRoad", label: "Hired passenger vehicle", speedKph: 46, passengerCapacity: 6, cargoCapacity: 2, availableByDefault: true, exceptional: false }),
    hiredFreightRoad: Object.freeze({ id: "hiredFreightRoad", label: "Hired freight vehicle", speedKph: 38, passengerCapacity: 2, cargoCapacity: 24, availableByDefault: true, exceptional: false }),
    hiredAircraft: Object.freeze({ id: "hiredAircraft", label: "Hired aircraft", speedKph: 210, passengerCapacity: 8, cargoCapacity: 12, availableByDefault: false, exceptional: true }),
    flyingMount: Object.freeze({ id: "flyingMount", label: "Flying mount", speedKph: 72, passengerCapacity: 1, cargoCapacity: 1, availableByDefault: false, exceptional: true }),
    gatewayTransit: Object.freeze({ id: "gatewayTransit", label: "Gateway transit", speedKph: 600, passengerCapacity: 12, cargoCapacity: 8, availableByDefault: false, exceptional: true }),
    ownedFleet: Object.freeze({ id: "ownedFleet", label: "Owned fleet vehicle", speedKph: 44, passengerCapacity: 5, cargoCapacity: 18, availableByDefault: false, exceptional: false })
  });
  const CONTINUITY_FACTOR = Object.freeze({ municipal: 1, localApproach: 1.05, operational: 1, degraded: 1.25, intermittent: 1.55, closed: Infinity, none: 1.8 });
  const DANGER_RANK = Object.freeze({ unknown: 1, veryLow: 0, low: 1, moderate: 2, high: 3, veryHigh: 4, severe: 4, extreme: 4 });

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function cleanId(value) { return String(value || "").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 160); }
  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
    return result >>> 0;
  }
  function roll(seed, channel) { return hash(`${seed}:${channel}`) / 0xffffffff; }
  function mode(modeId) { return MODE_DEFS[modeId] || null; }
  function componentForCity(directory, cityId) {
    return (directory?.currentSupportComponents || []).find((entry) => (entry.cityIds || []).includes(cityId)) || null;
  }
  function siteRecord(startingSite) { return startingSite?.strategicLocation || startingSite || null; }

  function createDestinationDirectory(strategicMap, startingSite) {
    const directory = strategicMap?.publicPlayableSettlementDirectory;
    const site = siteRecord(startingSite);
    if (!directory || !site?.nearestSettlement?.cityId) return { destinations: [], routes: [], homeDestinationId: "", nearestSettlementDestinationId: "" };
    const nearestCityId = site.nearestSettlement.cityId;
    const homeComponent = componentForCity(directory, nearestCityId);
    const cityRows = (directory.cityRows || []).filter((row) => row.physicalCondition !== "ruined" && row.habitationStatus !== "uninhabited");
    const destinations = cityRows.map((row) => {
      const component = componentForCity(directory, row.cityId);
      return {
        id: `city:${row.cityId}`,
        kind: "fortifiedCity",
        assetId: row.assetId,
        cityId: row.cityId,
        label: row.name,
        cellId: row.cellId,
        supportComponentId: component?.id || "",
        known: true,
        reachable: Boolean(homeComponent && component?.id === homeComponent.id),
        jurisdiction: row.physicalJurisdictionExists ? { kind: "city", cityId: row.cityId } : { kind: "none", cityId: "" }
      };
    });
    const homeDestinationId = `site:${cleanId(site.id || "laboratory")}`;
    destinations.push({
      id: homeDestinationId,
      kind: "laboratorySite",
      assetId: cleanId(site.id || "laboratory"),
      cityId: nearestCityId,
      label: site.name || "Laboratory site",
      cellId: site.strategicCellId || "",
      supportComponentId: homeComponent?.id || "",
      known: true,
      reachable: true,
      distanceBand: site.distanceBand || "protectedApproaches",
      localDistanceKm: Math.max(1, finite(site.distance?.practicalTravelKm, 8)),
      routeContinuity: site.access?.routeContinuity || "localApproach",
      dangerBand: site.beastReports?.threatBand || site.tradeoffs?.beastDanger || "unknown",
      jurisdiction: clone(site.jurisdiction || { kind: "none", governingCityId: null })
    });
    const routes = (directory.routeRows || []).map((row) => {
      const canonical = (strategicMap.routeGraph?.routes || []).find((entry) => entry.id === row.corridorId);
      return {
        id: `corridor:${row.corridorId}`,
        corridorId: row.corridorId,
        endpointCityIds: clone(row.endpointCityIds || []),
        continuity: row.continuity,
        supportCapable: Boolean(row.supportCapable),
        cellPath: clone(canonical?.cellPath || []),
        distanceKm: Math.max(1, finite(canonical?.lengthKm, finite(canonical?.distanceKm, 0)))
      };
    });
    return { destinations, routes, homeDestinationId, nearestSettlementDestinationId: `city:${nearestCityId}` };
  }

  function defaultState(options = {}) {
    const network = options.network || createDestinationDirectory(options.strategicMap, options.startingSite);
    return {
      nextJourneyNumber: 1,
      homeDestinationId: cleanId(network.homeDestinationId),
      nearestSettlementDestinationId: cleanId(network.nearestSettlementDestinationId),
      destinations: clone(network.destinations || []),
      routes: clone(network.routes || []),
      journeys: [],
      lastAdvancedAt: Math.max(0, finite(options.clock, 0))
    };
  }

  function normalizeDestination(candidate) {
    const id = cleanId(candidate?.id);
    if (!id) return null;
    return {
      id, kind: String(candidate.kind || "unknown"), assetId: cleanId(candidate.assetId), cityId: cleanId(candidate.cityId),
      label: String(candidate.label || id).slice(0, 120), cellId: cleanId(candidate.cellId), supportComponentId: cleanId(candidate.supportComponentId),
      known: candidate.known !== false, reachable: Boolean(candidate.reachable), distanceBand: String(candidate.distanceBand || ""),
      localDistanceKm: Math.max(0, finite(candidate.localDistanceKm, 0)), routeContinuity: String(candidate.routeContinuity || ""),
      dangerBand: String(candidate.dangerBand || "unknown"), jurisdiction: clone(candidate.jurisdiction || { kind: "none" })
    };
  }
  function normalizeRoute(candidate) {
    const id = cleanId(candidate?.id);
    if (!id) return null;
    return { id, corridorId: cleanId(candidate.corridorId), endpointCityIds: (candidate.endpointCityIds || []).map(cleanId).filter(Boolean).slice(0, 2), continuity: String(candidate.continuity || "closed"), supportCapable: Boolean(candidate.supportCapable), cellPath: (candidate.cellPath || []).map(cleanId).filter(Boolean), distanceKm: Math.max(1, finite(candidate.distanceKm, 36)) };
  }

  function cityPath(state, fromCityId, toCityId) {
    if (!fromCityId || !toCityId || fromCityId === toCityId) return [];
    const queue = [{ cityId: fromCityId, routeIds: [] }];
    const seen = new Set([fromCityId]);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      for (const route of state.routes.filter((entry) => entry.supportCapable && entry.continuity !== "closed" && entry.endpointCityIds.includes(current.cityId))) {
        const nextCityId = route.endpointCityIds.find((id) => id !== current.cityId);
        if (!nextCityId || seen.has(nextCityId)) continue;
        const routeIds = [...current.routeIds, route.id];
        if (nextCityId === toCityId) return routeIds.map((id) => state.routes.find((entry) => entry.id === id));
        seen.add(nextCityId); queue.push({ cityId: nextCityId, routeIds });
      }
    }
    return null;
  }

  function routePlan(state, originId, destinationId, modeId) {
    const origin = state.destinations.find((entry) => entry.id === originId);
    const destination = state.destinations.find((entry) => entry.id === destinationId);
    const travelMode = mode(modeId);
    if (!origin || !destination) return { ok: false, reason: "Unknown origin or destination." };
    if (!origin.known || !destination.known) return { ok: false, reason: "The route has not been learned." };
    if (!travelMode) return { ok: false, reason: "Unknown travel mode." };
    if (!travelMode.availableByDefault) return { ok: false, reason: `${travelMode.label} requires a provider or owned asset.` };
    if ([origin, destination].some((place) => place.kind === "laboratorySite" && ["closed", "none"].includes(place.routeContinuity))) return { ok: false, reason: "This site has no usable supported road approach." };
    const sameComponent = origin.supportComponentId && origin.supportComponentId === destination.supportComponentId;
    if (!sameComponent && !travelMode.exceptional) return { ok: false, reason: "No supported route connects these destinations." };
    const routeRows = cityPath(state, origin.cityId, destination.cityId);
    if (routeRows === null && !travelMode.exceptional) return { ok: false, reason: "No currently usable corridor path connects these destinations." };
    const legs = [];
    const pushLocal = (place, direction) => {
      if (place.kind !== "laboratorySite") return;
      legs.push({ kind: "localApproach", label: `${direction === "outbound" ? "Leave" : "Approach"} ${place.label}`, routeId: "", cellPath: place.cellId ? [place.cellId] : [], distanceKm: Math.max(1, place.localDistanceKm), continuity: place.routeContinuity || "localApproach", dangerBand: place.dangerBand || "unknown" });
    };
    pushLocal(origin, "outbound");
    let currentCityId = origin.cityId;
    for (const row of routeRows || []) {
      const cellPath = clone(row.cellPath);
      if (row.endpointCityIds[0] !== currentCityId) cellPath.reverse();
      legs.push({ kind: "supportedCorridor", label: `Travel ${row.corridorId}`, routeId: row.id, cellPath, distanceKm: row.distanceKm, continuity: row.continuity, dangerBand: "moderate" });
      currentCityId = row.endpointCityIds.find((id) => id !== currentCityId);
    }
    pushLocal(destination, "inbound");
    if (!legs.length) legs.push({ kind: "localStreet", label: `Cross ${destination.label}`, routeId: "", cellPath: [origin.cellId, destination.cellId].filter(Boolean), distanceKm: 4, continuity: "municipal", dangerBand: "veryLow" });
    return { ok: true, origin: clone(origin), destination: clone(destination), mode: clone(travelMode), legs };
  }

  function legDuration(leg, travelMode) {
    const continuity = CONTINUITY_FACTOR[leg.continuity] ?? 1.25;
    return Math.max(10 * 60, Math.ceil(leg.distanceKm / travelMode.speedKph * HOUR * continuity));
  }
  function interruptionFor(seed, leg, index, requestedDangerBand) {
    const dangerRank = Math.max(DANGER_RANK[leg.dangerBand] ?? 1, DANGER_RANK[requestedDangerBand] ?? 1);
    const continuityRisk = leg.continuity === "intermittent" ? 0.16 : leg.continuity === "degraded" ? 0.08 : 0;
    const chance = clamp(0.025 + dangerRank * 0.035 + continuityRisk, 0, 0.34);
    const outcome = roll(seed, `leg:${index}:interruption`);
    if (outcome >= chance) return null;
    const kindRoll = roll(seed, `leg:${index}:kind`);
    const kind = kindRoll < 0.34 ? "routeDelay" : kindRoll < 0.58 ? "checkpointHold" : kindRoll < 0.8 ? "vehicleFault" : kindRoll < 0.94 ? "beastDiversion" : "stranding";
    const delays = { routeDelay: 45 * 60, checkpointHold: 75 * 60, vehicleFault: 2 * HOUR, beastDiversion: 3 * HOUR, stranding: 6 * HOUR };
    return { kind, triggerFraction: 0.35 + roll(seed, `leg:${index}:trigger`) * 0.3, delaySeconds: Math.round(delays[kind] * (0.8 + roll(seed, `leg:${index}:delay`) * 0.6)), revealed: false, revealedAt: null, resolved: false, summary: "" };
  }
  function windowFor(arrivalAt, modeId, legs) {
    const uncertainty = Math.max(20 * 60, Math.round((modeId === "hiredFreightRoad" ? 0.16 : 0.12) * legs.reduce((sum, leg) => sum + leg.durationSeconds, 0)));
    return { start: Math.max(0, arrivalAt - Math.round(uncertainty * 0.35)), end: arrivalAt + uncertainty };
  }

  function createJourney(candidateState, options = {}) {
    const state = normalizeState(candidateState);
    const plan = routePlan(state, cleanId(options.originId), cleanId(options.destinationId), options.modeId || "hiredPassengerRoad");
    if (!plan.ok) return { state, journey: null, reason: plan.reason };
    const passengers = Math.max(0, Math.floor(finite(options.passengers, 0)));
    const cargo = Math.max(0, finite(options.cargo, 0));
    const vehicleCount = Math.max(1, Math.floor(finite(options.vehicleCount, 1)));
    if (passengers > plan.mode.passengerCapacity * vehicleCount || cargo > plan.mode.cargoCapacity * vehicleCount) return { state, journey: null, reason: "The selected vehicle allocation lacks the required passenger or cargo capacity." };
    const now = Math.max(0, finite(options.clock, state.lastAdvancedAt));
    const id = `journey-${state.nextJourneyNumber++}`;
    const seed = String(options.seed || id);
    const legs = plan.legs.map((leg, index) => ({ ...leg, index, durationSeconds: legDuration(leg, plan.mode), status: "pending", startedAt: null, completedAt: null, interruption: interruptionFor(seed, leg, index, options.dangerBand) }));
    const baseDuration = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0);
    const requestedArrivalAt = Math.max(0, finite(options.requestedArrivalAt, 0));
    const departAt = Math.max(now, requestedArrivalAt ? requestedArrivalAt - baseDuration : now + Math.max(0, finite(options.departureDelaySeconds, 30 * 60)));
    let cursor = departAt;
    for (const leg of legs) { leg.plannedStartAt = cursor; cursor += leg.durationSeconds; leg.plannedEndAt = cursor; }
    const exactArrivalAt = Math.max(cursor, requestedArrivalAt);
    const arrivalWindow = windowFor(exactArrivalAt, plan.mode.id, legs);
    const journey = {
      id, purpose: String(options.purpose || "travel"), label: String(options.label || `${plan.origin.label} to ${plan.destination.label}`).slice(0, 180),
      subject: { kind: String(options.subject?.kind || ""), id: cleanId(options.subject?.id) },
      originId: plan.origin.id, destinationId: plan.destination.id, modeId: plan.mode.id,
      capacity: { passengers, cargo, vehicleCount }, provider: String(options.provider || (plan.mode.id.startsWith("hired") ? "contracted local carrier" : "owned or exceptional provider")),
      bookedAt: now, departAt, requestedArrivalAt: requestedArrivalAt || null, exactArrivalAt, arrivalWindow,
      status: departAt > now ? "scheduled" : "enRoute", currentLegIndex: 0, departedAt: departAt > now ? null : now, arrivedAt: null,
      cancellation: { allowedUntil: departAt, requestedAt: null, outcome: null },
      route: { supportComponentId: plan.origin.supportComponentId, jurisdictionChangesAuthority: false, legs },
      history: [{ at: now, action: "booked", summary: `${plan.mode.label} booked through a physical provider.` }]
    };
    state.journeys.push(journey);
    return { state, journey: clone(journey), reason: "" };
  }

  function interruptionSummary(interruption) {
    if (interruption.kind === "checkpointHold") return "A physical checkpoint held the vehicle; crossing the jurisdiction did not create new authority.";
    if (interruption.kind === "vehicleFault") return "A vehicle fault delayed the journey without deleting its passengers or cargo.";
    if (interruption.kind === "beastDiversion") return "A beast warning forced a physical diversion; the vehicle and shipment remain accounted for.";
    if (interruption.kind === "stranding") return "The vehicle is stranded at a saved route leg and requires later recovery; nobody was resolved dead offscreen.";
    return "Route conditions delayed the vehicle without deleting its passengers or cargo.";
  }
  function advance(candidateState, toClock) {
    const state = normalizeState(candidateState);
    const clock = Math.max(state.lastAdvancedAt, finite(toClock, state.lastAdvancedAt));
    const events = [];
    for (const journey of state.journeys.filter((entry) => ACTIVE_STATUSES.includes(entry.status))) {
      if (journey.status === "returning") {
        if (clock >= journey.exactArrivalAt) {
          journey.status = "returned"; journey.arrivedAt = journey.exactArrivalAt;
          journey.history.push({ at: journey.arrivedAt, action: "returned", summary: `The physical vehicle completed its return to ${state.destinations.find((entry) => entry.id === journey.originId)?.label || journey.originId}.` });
          events.push({ journeyId: journey.id, at: journey.arrivedAt, kind: "returned" });
        }
        continue;
      }
      if (journey.status === "scheduled" && clock >= journey.departAt) {
        journey.status = "enRoute"; journey.departedAt = journey.departAt;
        journey.history.push({ at: journey.departAt, action: "departed", summary: `${MODE_DEFS[journey.modeId].label} physically departed.` });
        events.push({ journeyId: journey.id, at: journey.departAt, kind: "departed" });
      }
      if (!["enRoute", "held", "diverted"].includes(journey.status)) continue;
      while (journey.currentLegIndex < journey.route.legs.length) {
        const leg = journey.route.legs[journey.currentLegIndex];
        if (leg.status === "pending" && clock >= leg.plannedStartAt) { leg.status = "active"; leg.startedAt = leg.plannedStartAt; }
        const interruption = leg.interruption;
        const triggerAt = leg.plannedStartAt + leg.durationSeconds * (interruption?.triggerFraction || 1);
        if (interruption && !interruption.revealed && clock >= triggerAt) {
          interruption.revealed = true; interruption.revealedAt = Math.round(triggerAt); interruption.summary = interruptionSummary(interruption);
          journey.history.push({ at: interruption.revealedAt, action: interruption.kind, summary: interruption.summary });
          events.push({ journeyId: journey.id, at: interruption.revealedAt, kind: interruption.kind, summary: interruption.summary });
          const delay = interruption.delaySeconds;
          for (let index = journey.currentLegIndex; index < journey.route.legs.length; index += 1) {
            if (index > journey.currentLegIndex) journey.route.legs[index].plannedStartAt += delay;
            journey.route.legs[index].plannedEndAt += delay;
          }
          journey.exactArrivalAt += delay; journey.arrivalWindow = windowFor(journey.exactArrivalAt, journey.modeId, journey.route.legs);
          if (interruption.kind === "stranding") { journey.status = "stranded"; break; }
          if (interruption.kind === "beastDiversion") journey.status = "diverted";
          else journey.status = "held";
        }
        if (interruption?.revealed && !interruption.resolved && journey.status !== "stranded") {
          if (clock < interruption.revealedAt + interruption.delaySeconds) break;
          interruption.resolved = true; journey.status = "enRoute";
        }
        if (journey.status === "stranded" || clock < leg.plannedEndAt) break;
        leg.status = "completed"; leg.completedAt = leg.plannedEndAt; journey.currentLegIndex += 1;
      }
      if (journey.currentLegIndex >= journey.route.legs.length && clock >= journey.exactArrivalAt) {
        journey.status = "arrived"; journey.arrivedAt = journey.exactArrivalAt;
        journey.history.push({ at: journey.arrivedAt, action: "arrived", summary: `The physical vehicle arrived at ${state.destinations.find((entry) => entry.id === journey.destinationId)?.label || journey.destinationId}.` });
        events.push({ journeyId: journey.id, at: journey.arrivedAt, kind: "arrived" });
      }
    }
    state.lastAdvancedAt = clock;
    return { state, events };
  }

  function cancelJourney(candidateState, journeyId, clock) {
    const state = advance(candidateState, clock).state;
    const journey = state.journeys.find((entry) => entry.id === cleanId(journeyId));
    if (!journey || TERMINAL_STATUSES.includes(journey.status) || ["returning", "stranded"].includes(journey.status)) return { state, journey: clone(journey), reason: "The journey cannot be cancelled." };
    const now = Math.max(0, finite(clock, state.lastAdvancedAt));
    journey.cancellation.requestedAt = now;
    if (journey.status === "scheduled" && now < journey.departAt) {
      journey.status = "cancelled"; journey.cancellation.outcome = "cancelledBeforeDeparture";
      journey.history.push({ at: now, action: "cancelled", summary: "The booking was cancelled before the vehicle physically departed." });
    } else {
      journey.status = "returning"; journey.cancellation.outcome = "physicalReturnRequired";
      const currentLeg = journey.route.legs[journey.currentLegIndex];
      const completedSeconds = journey.route.legs.slice(0, journey.currentLegIndex).reduce((sum, leg) => sum + leg.durationSeconds, 0);
      const currentSeconds = clamp(now - (currentLeg?.plannedStartAt ?? now), 0, currentLeg?.durationSeconds || 0);
      const returnSeconds = Math.max(30 * 60, completedSeconds + currentSeconds);
      journey.exactArrivalAt = now + returnSeconds;
      journey.arrivalWindow = windowFor(journey.exactArrivalAt, journey.modeId, journey.route.legs);
      journey.history.push({ at: now, action: "returnOrdered", summary: "The vehicle had already departed; cancellation became a physical return or diversion." });
    }
    return { state, journey: clone(journey), reason: "" };
  }

  function recoverStrandedJourney(candidateState, journeyId, clock) {
    const state = normalizeState(candidateState);
    const journey = state.journeys.find((entry) => entry.id === cleanId(journeyId));
    if (!journey || journey.status !== "stranded") return { state, journey: clone(journey), reason: "Only a stranded journey can receive route recovery." };
    const now = Math.max(state.lastAdvancedAt, finite(clock, state.lastAdvancedAt));
    const leg = journey.route.legs[journey.currentLegIndex];
    const recoveryDelay = 30 * 60;
    const shift = Math.max(0, now + recoveryDelay - (leg?.plannedStartAt || now));
    for (let index = journey.currentLegIndex; index < journey.route.legs.length; index += 1) {
      journey.route.legs[index].plannedStartAt += shift;
      journey.route.legs[index].plannedEndAt += shift;
    }
    journey.exactArrivalAt += shift;
    journey.arrivalWindow = windowFor(journey.exactArrivalAt, journey.modeId, journey.route.legs);
    journey.status = "enRoute";
    if (leg?.interruption) leg.interruption.resolved = true;
    journey.history.push({ at: now, action: "recoveryDispatched", summary: "The provider dispatched physical route recovery; passengers and cargo remained with the saved vehicle." });
    return { state, journey: clone(journey), reason: "" };
  }

  function publicJourney(candidate, clock = 0) {
    const journey = clone(candidate);
    if (!journey) return null;
    delete journey.exactArrivalAt;
    for (const leg of journey.route?.legs || []) {
      delete leg.plannedStartAt; delete leg.plannedEndAt;
      delete leg.durationSeconds;
      leg.interruption = leg.interruption?.revealed ? { kind: leg.interruption.kind, revealed: true, summary: leg.interruption.summary, revealedAt: leg.interruption.revealedAt, resolved: leg.interruption.resolved } : null;
    }
    journey.arrivalWindow = clone(candidate.arrivalWindow);
    journey.progress = TERMINAL_STATUSES.includes(candidate.status) ? candidate.status : candidate.status === "scheduled" ? "awaiting departure" : candidate.status === "stranded" ? "stranded" : "in transit";
    journey.asOf = Math.max(0, finite(clock, 0));
    return journey;
  }
  function nextEvent(candidateState, clock = 0) {
    const state = normalizeState(candidateState);
    const now = Math.max(0, finite(clock, 0));
    const events = [];
    for (const journey of state.journeys.filter((entry) => ACTIVE_STATUSES.includes(entry.status))) {
      if (journey.status === "scheduled" && journey.departAt >= now) events.push({ time: journey.departAt, label: `${journey.label} departs`, type: "journey" });
      if (["enRoute", "held", "diverted"].includes(journey.status)) {
        const leg = journey.route.legs[journey.currentLegIndex];
        if (leg?.interruption && !leg.interruption.revealed) events.push({ time: Math.max(now, Math.round(leg.plannedStartAt + leg.durationSeconds * leg.interruption.triggerFraction)), label: `${journey.label}: route update`, type: "journey" });
        if (leg?.interruption?.revealed && !leg.interruption.resolved) events.push({ time: Math.max(now, leg.interruption.revealedAt + leg.interruption.delaySeconds), label: `${journey.label}: carrier resumes`, type: "journey" });
        if (leg) events.push({ time: Math.max(now, leg.plannedEndAt), label: `${journey.label}: ${leg.label}`, type: "journey" });
      }
      if (journey.exactArrivalAt >= now && journey.status !== "stranded") events.push({ time: journey.exactArrivalAt, label: `${journey.label} ${journey.status === "returning" ? "returns" : "arrives"}`, type: "journey" });
    }
    return events.sort((left, right) => left.time - right.time || left.label.localeCompare(right.label))[0] || null;
  }
  function journeyForSubject(candidateState, kind, id) {
    return normalizeState(candidateState).journeys.find((entry) => entry.subject.kind === String(kind || "") && entry.subject.id === cleanId(id)) || null;
  }

  // Player-facing waiting uses published windows, never a frozen hidden outcome or exact ETA.
  function nextPublicEvent(candidateState, clock = 0) {
    const now = Math.max(0, finite(clock, 0));
    return candidateState.journeys.filter((journey) => ACTIVE_STATUSES.includes(journey.status) && journey.status !== "stranded")
      .map((journey) => ({ time: [journey.arrivalWindow.start, journey.arrivalWindow.end].find((at) => at > now), label: `${journey.label}: ${journey.status === "returning" ? "return" : "arrival"} window`, type: "journey" }))
      .filter((event) => event.time != null).sort((left, right) => left.time - right.time || left.label.localeCompare(right.label))[0] || null;
  }

  function normalizeState(candidate, options = {}) {
    if (!candidate || typeof candidate !== "object") return defaultState(options);
    const state = {
      nextJourneyNumber: Math.max(1, Math.floor(finite(candidate.nextJourneyNumber, 1))),
      homeDestinationId: cleanId(candidate.homeDestinationId), nearestSettlementDestinationId: cleanId(candidate.nearestSettlementDestinationId),
      destinations: (candidate.destinations || []).map(normalizeDestination).filter(Boolean), routes: (candidate.routes || []).map(normalizeRoute).filter(Boolean),
      journeys: [], lastAdvancedAt: Math.max(0, finite(candidate.lastAdvancedAt, options.clock || 0))
    };
    const destinationIds = new Set(state.destinations.map((entry) => entry.id));
    const routeIds = new Set(state.routes.map((entry) => entry.id));
    for (const raw of candidate.journeys || []) {
      const id = cleanId(raw?.id); const travelMode = mode(raw?.modeId);
      if (!id || !travelMode || !destinationIds.has(raw.originId) || !destinationIds.has(raw.destinationId)) continue;
      const legs = (raw.route?.legs || []).map((leg, index) => ({
        kind: String(leg.kind || "route"), label: String(leg.label || "Travel"), routeId: routeIds.has(leg.routeId) ? leg.routeId : "", cellPath: (leg.cellPath || []).map(cleanId).filter(Boolean),
        distanceKm: Math.max(0, finite(leg.distanceKm, 0)), continuity: String(leg.continuity || "unknown"), dangerBand: String(leg.dangerBand || "unknown"), index,
        durationSeconds: Math.max(1, finite(leg.durationSeconds, 1)), status: ["pending", "active", "completed"].includes(leg.status) ? leg.status : "pending",
        startedAt: leg.startedAt == null ? null : Math.max(0, finite(leg.startedAt)), completedAt: leg.completedAt == null ? null : Math.max(0, finite(leg.completedAt)),
        plannedStartAt: Math.max(0, finite(leg.plannedStartAt)), plannedEndAt: Math.max(0, finite(leg.plannedEndAt)), interruption: leg.interruption ? clone(leg.interruption) : null
      }));
      const status = [...ACTIVE_STATUSES, ...TERMINAL_STATUSES].includes(raw.status) ? raw.status : "scheduled";
      state.journeys.push({
        id, purpose: String(raw.purpose || "travel"), label: String(raw.label || id), subject: { kind: String(raw.subject?.kind || ""), id: cleanId(raw.subject?.id) },
        originId: cleanId(raw.originId), destinationId: cleanId(raw.destinationId), modeId: travelMode.id,
        capacity: { passengers: Math.max(0, Math.floor(finite(raw.capacity?.passengers))), cargo: Math.max(0, finite(raw.capacity?.cargo)), vehicleCount: Math.max(1, Math.floor(finite(raw.capacity?.vehicleCount, 1))) }, provider: String(raw.provider || "physical provider"),
        bookedAt: Math.max(0, finite(raw.bookedAt)), departAt: Math.max(0, finite(raw.departAt)), requestedArrivalAt: raw.requestedArrivalAt == null ? null : Math.max(0, finite(raw.requestedArrivalAt)),
        exactArrivalAt: Math.max(0, finite(raw.exactArrivalAt)), arrivalWindow: { start: Math.max(0, finite(raw.arrivalWindow?.start)), end: Math.max(0, finite(raw.arrivalWindow?.end)) },
        status, currentLegIndex: clamp(Math.floor(finite(raw.currentLegIndex)), 0, legs.length), departedAt: raw.departedAt == null ? null : Math.max(0, finite(raw.departedAt)), arrivedAt: raw.arrivedAt == null ? null : Math.max(0, finite(raw.arrivedAt)),
        cancellation: clone(raw.cancellation || { allowedUntil: raw.departAt, requestedAt: null, outcome: null }), route: { supportComponentId: cleanId(raw.route?.supportComponentId), jurisdictionChangesAuthority: false, legs },
        history: (raw.history || []).map((entry) => ({ at: Math.max(0, finite(entry.at)), action: String(entry.action || "update"), summary: String(entry.summary || "") })).slice(-100)
      });
    }
    state.nextJourneyNumber = Math.max(state.nextJourneyNumber, state.journeys.reduce((max, journey) => Math.max(max, Number(journey.id.match(/(\d+)$/)?.[1]) || 0), 0) + 1);
    return state;
  }

  return { MODE_DEFS, ACTIVE_STATUSES, TERMINAL_STATUSES, createDestinationDirectory, defaultState, normalizeState, routePlan, createJourney, advance, cancelJourney, recoverStrandedJourney, publicJourney, nextEvent, nextPublicEvent, journeyForSubject };
});
