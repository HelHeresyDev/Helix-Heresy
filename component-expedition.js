(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./city-approach') : root.HelixCityApproach);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixComponentExpedition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Approach) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const REPORT = 120, TURNAROUND = 7200, RESERVE = 50;
  const LIMITS = 'One paid flight to a disclosed receiving checkpoint in another physical support network. No road bridge, whole-world map, resupply, ownership, allegiance, city admission or regional command. A missed or impossible return leaves living people at their real positions.';
  function source(network, originCityId, destinationCityId) {
    const city = id => network?.destinations?.find(d => d.cityId === id && d.kind === 'fortifiedCity' && d.known && d.jurisdiction?.kind === 'city');
    const a = city(originCityId), b = city(destinationCityId);
    if (!a?.supportComponentId || !b?.supportComponentId || a.supportComponentId === b.supportComponentId || a.cityId === b.cityId) return null;
    const reached = new Set([originCityId]), queue = [originCityId];
    for (let i = 0; i < queue.length; i++) for (const r of network.routes || []) {
      if (!r.supportCapable || ['closed', 'none'].includes(r.continuity) || !r.endpointCityIds?.includes(queue[i])) continue;
      for (const id of r.endpointCityIds) if (!reached.has(id)) { reached.add(id); queue.push(id); }
    }
    if (reached.has(destinationCityId)) return null;
    return { originCityId, destinationCityId, originComponentId: a.supportComponentId, destinationComponentId: b.supportComponentId,
      destinationId: b.id, cellId: b.cellId, label: b.label };
  }
  function attach(t, g, p, source, binding, origin, at) {
    if (!t || !source || !binding?.worldId || !binding.runId || !origin?.roomId || !origin.cell || !p?.id || !g?.institutionId
      || source.destinationCityId !== g.cityId || t.providerId !== p.id || t.gateId !== g.id) return false;
    t.component = { ...copy(binding), source: copy(source), origin: copy(origin), gateId: g.id, institutionId: g.institutionId,
      clerkId: g.clerk.id, providerId: p.id, aircraftId: p.aircraft.id, pilotId: p.pilot.id,
      lastAt: at, reportProgress: 0, reportReady: true, reportDeadline: at + 3600,
      received: null, arrivedAt: null, returnDeadline: null, departBy: null, releasedAt: null, strandedAt: null };
    return true;
  }
  function normalize(s) {
    return s?.worldId && s.runId && Number.isInteger(s.bodyEpoch) && s.bodyEpoch >= 0 && s.aircraftId && s.pilotId && s.providerId && s.clerkId && s.institutionId
      && s.origin?.roomId && s.origin.cell && s.source?.originCityId && s.source.destinationCityId && s.source.originComponentId && s.source.destinationComponentId
      && s.source.originComponentId !== s.source.destinationComponentId && Number.isFinite(s.lastAt) ? copy(s) : null;
  }
  function rebind(s, from, to) {
    s = normalize(s); if (!s || s.worldId !== from.worldId || s.runId !== from.runId) return null;
    if (s.origin.context?.worldId === from.worldId) s.origin.context.worldId = to.worldId;
    return { ...s, ...copy(to) };
  }
  function current(t, g, p, c) {
    const s = t?.component;
    return Boolean(s && c.worldId === s.worldId && c.runId === s.runId && c.bodyEpoch === s.bodyEpoch
      && g?.id === s.gateId && g.institutionId === s.institutionId && g.clerk?.id === s.clerkId
      && p?.id === s.providerId && p.aircraft?.id === s.aircraftId && p.pilot?.id === s.pilotId);
  }
  function resources(p) {
    return p && Number.isFinite(p.dutySeconds) && Number.isFinite(p.provisionsSeconds) && p.pilot.status === 'alive'
      && p.pilot.health >= 50 && (p.pilot.fatigue || 0) < 80 && p.aircraft.condition >= 50;
  }
  function reason(t, g, p, c, at) {
    if (!current(t, g, p, c) || !c.authorityCurrent || !c.sourceCurrent) return 'The original run, body, receiving authority and distinct support networks are required.';
    if (!c.alive || !c.capable || !c.free || !c.atOrigin || !c.pilotPresent) return 'Physically attend the original pilot at the actual departure apron with the free capable body.';
    if (!resources(p)) return 'The same original aircraft and pilot need actual condition, finite duty, provisions and bodily capacity.';
    const needed = Math.max(0, REPORT - t.component.reportProgress);
    if (g.guard.status !== 'alive' || g.guard.health < 50 || g.clerk.status !== 'alive' || g.clerk.health < 50 || c.clerkIncapacitated || !c.channel || g.powerSeconds <= 0
      || g.receptionWorkSeconds < needed || g.receptionAssignment && g.receptionAssignment !== t.id) return 'Original receiving staff, shared queue or powered communications are unavailable.';
    return Approach.transportReason(p, t.distanceKm, at, t.id) || c.weatherReason || '';
  }
  function offer(t, g, p, c, at) {
    if (reason(t, g, p, c, at)) return false;
    const flight = Math.ceil(t.distanceKm / 210 * 3600), remaining = Math.min(p.dutySeconds, p.provisionsSeconds) - 2 * flight - 600;
    const wait = Math.min(14400, Math.floor(remaining));
    if (wait < 900 || p.aircraft.condition - t.distanceKm * .02 < 50) return false;
    if (!Approach.offer(t, g, p, at)) return false;
    Object.assign(t.offer, { waitSeconds: wait, pilotId: p.pilot.id, originId: t.component.origin.siteId,
      returnTerms: `Same aircraft waits at most ${wait} seconds after physical unloading, within actual pilot duty and provisions. Return boarding must FINISH before the deadline. On expiry it attempts to return empty; damage, weather or exhausted capacity can strand aircraft and passengers. No refuelling, relief crew or replacement pickup is promised.` });
    return true;
  }
  function accepted(t, at) { t.component.departBy = at + 1800; t.component.lastAt = at; }
  function acceptReason(t, g, p, c, at) {
    return reason(t, g, p, c, at) || (!t.offer || Math.min(p.dutySeconds, p.provisionsSeconds) < 2 * t.offer.flightSeconds + t.offer.waitSeconds + 600
      || p.aircraft.condition - t.distanceKm * .02 < 50 ? 'The original quote’s complete return allowance is no longer supported. No payment or dispatch.' : '');
  }
  function dispatchReason(t, g, p, c, at) {
    return reason(t, g, p, c, at) || (p.aircraft.reservedBy !== t.id || g.berthReservedBy !== t.id || t.permit?.status !== 'active'
      ? 'The same original aircraft, receiving berth and landing permit must still belong to this booking.' : '')
      || (Math.min(p.dutySeconds, p.provisionsSeconds) < 2 * t.offer.flightSeconds + t.offer.waitSeconds + 120
      || p.aircraft.condition - t.distanceKm * .02 < 50 ? 'Departure delay or resource loss no longer supports the quoted wait and actual return. Unlaunched escrow can be refunded; no flight is invented.' : '');
  }
  function returnReason(t, p, c, at) {
    const s = t.component;
    if (c.worldId !== s.worldId || c.runId !== s.runId || c.bodyEpoch !== s.bodyEpoch || p?.id !== s.providerId
      || p.aircraft?.id !== s.aircraftId || p.pilot?.id !== s.pilotId) return 'Only the original run, body, pilot and aircraft own this return.';
    if (!c.alive || !c.capable || !c.free || !resources(p)) return 'Actual living passengers and the original fit pilot/aircraft are required; no automatic rescue or death.';
    if (s.returnDeadline != null && at >= s.returnDeadline) return 'The agreed waiting window has ended; there is no fresh pickup booking.';
    if (p.aircraft.reservedBy !== t.id || p.dutySeconds < t.offer.flightSeconds + 30 || p.provisionsSeconds < t.offer.flightSeconds + 30
      || p.aircraft.fuelKm < t.distanceKm + RESERVE || p.aircraft.condition - t.distanceKm * .01 < 50) return 'Actual return fuel, duty, provisions, aircraft and its original reservation are unavailable.';
    return c.returnWeatherReason || '';
  }
  function releaseReport(t, g) {
    if (g.receptionAssignment === t.id) g.receptionAssignment = null;
    if (g.clerk.assignment === t.id) g.clerk.assignment = null;
  }
  function fail(t, g, p, at, text) {
    releaseReport(t, g);
    const refund = Approach.refund(t);
    if (t.departedAt == null) {
      if (p.aircraft.reservedBy === t.id) p.aircraft.reservedBy = null;
      if (g.berthReservedBy === t.id) g.berthReservedBy = null;
      if (t.permit) t.permit.status = 'cancelled';
    }
    Approach.stage(t, t.departedAt == null ? 'failed' : 'flightInterrupted', at, null, text);
    return refund;
  }
  function advance(t, g, p, c, at) {
    const s = t?.component; if (!s || !c.alive || !Approach.ongoing(t) || at < s.lastAt) return { refund: 0 };
    const dt = at - s.lastAt; s.lastAt = at;
    if (!current(t, g, p, c)) return { refund: fail(t, g, p, at, 'Original body, run, people or aircraft no longer supports this booking. No recovered body is transported by the departed body’s contract.') };
    if (t.status === 'requested') {
      const ready = c.channel && c.authorityCurrent && c.sourceCurrent && !c.clerkIncapacitated && g.clerk.status === 'alive' && g.clerk.health >= 50
        && g.receptionAssignment === t.id && resources(p) && g.powerSeconds > 0 && g.receptionWorkSeconds > 0;
      if (at >= s.reportDeadline || g.clerk.status === 'dead' || p.pilot.status === 'dead') return { refund: fail(t, g, p, at, 'The original bounded receiving request could not be completed. Spent staff duty and radio charge remain spent; no landing permission was invented.') };
      if (ready && s.reportReady) {
        const n = Math.max(0, Math.min(dt, REPORT - s.reportProgress, g.receptionWorkSeconds, p.dutySeconds, p.provisionsSeconds));
        s.reportProgress += n; g.receptionWorkSeconds -= n; p.dutySeconds -= n; p.provisionsSeconds -= n;
      }
      s.reportReady = ready; t.nextAt = s.reportProgress >= REPORT ? at : at + Math.max(1, REPORT - s.reportProgress);
    } else if (['preparing', 'boarding', 'outbound', 'unloading', 'checkpoint', 'checking', 'decided', 'inbound', 'returnUnloading', 'departingEmpty', 'stranded'].includes(t.status)) {
      const n = Math.min(dt, p.dutySeconds, p.provisionsSeconds); p.dutySeconds -= n; p.provisionsSeconds -= n;
      if (s.departBy != null && t.departedAt == null && at >= s.departBy) return { refund: fail(t, g, p, at, 'Departure boarding did not finish within its original thirty-minute allocation. Unlaunched escrow refunded once; duty remains spent.') };
      if (!resources(p) || p.dutySeconds <= 0 || p.provisionsSeconds <= 0) {
        if (t.departedAt == null) return { refund: fail(t, g, p, at, 'Actual transport capacity was lost before departure.') };
        s.strandedAt ??= at;
        if (!['stranded', 'flightInterrupted'].includes(t.status)) Approach.stage(t, ['outbound', 'inbound', 'departingEmpty'].includes(t.status) ? 'flightInterrupted' : 'stranded', at, null, 'Actual original transport capacity is unavailable. Living people remain where they are; no landing, replacement pilot or death is invented.');
      }
      if (s.arrivedAt != null && s.returnDeadline != null && at >= s.returnDeadline && ['checkpoint', 'checking', 'decided', 'stranded'].includes(t.status)) {
        s.strandedAt ??= at;
        if (resources(p) && p.dutySeconds >= t.offer.flightSeconds && p.provisionsSeconds >= t.offer.flightSeconds
          && p.aircraft.fuelKm >= t.distanceKm + RESERVE && !c.returnWeatherReason && c.emptyDepartureClear) {
          p.aircraft.fuelKm -= t.distanceKm; p.aircraft.condition -= t.distanceKm * .01;
          p.pilot.location = 'cityReturningEmpty'; p.pilot.cell = null; t.returningIds = [];
          Approach.stage(t, 'departingEmpty', at, t.offer.flightSeconds, 'The finite waiting window ended. The same aircraft is returning empty; the living scientist remains at the actual foreign site.');
        } else if (t.status !== 'stranded') Approach.stage(t, 'stranded', at, null, 'The return window ended and the original aircraft cannot depart safely. No rescue, replenishment or automatic passenger death is promised.');
      }
    }
    return { refund: 0 };
  }
  function arrived(t, at) {
    if (t.component.arrivedAt == null) { t.component.arrivedAt = at; t.component.returnDeadline = at + t.offer.waitSeconds; }
  }
  function receive(t, c, at) {
    const localWitness = c.local && (c.localPilot && !['departingEmpty', 'settled', 'flightInterrupted'].includes(t?.status)
      || c.departureVisible && t.history.at(-1)?.status === 'departingEmpty' && t.history.at(-1)?.at === at);
    if (!t?.component || !c.alive || !(c.atOrigin && c.pilotPresent || localWitness || c.onBoard)) return false;
    const s = t.component;
    s.received = { at, tripId: t.id, cityId: s.source.destinationCityId, label: s.source.label,
      status: t.status, reason: t.reason, offer: t.offer ? copy(t.offer) : null, returnDeadline: s.returnDeadline,
      source: 'Personally received named pilot/receiving instructions or physically observed expedition', limits: LIMITS };
    return true;
  }
  return { REPORT, TURNAROUND, RESERVE, LIMITS, source, attach, normalize, rebind, current, resources, reason, offer, accepted, acceptReason, dispatchReason, returnReason, releaseReport, fail, advance, arrived, receive, publicView: t => copy(t?.component?.received) };
});
