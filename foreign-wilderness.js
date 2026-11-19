(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignWilderness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Survival) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  function contains(bounds, cell) {
    return Boolean(bounds && cell && ['x', 'y', 'z'].every(k => Number.isInteger(cell[k])) && cell.z === bounds.z
      && cell.x >= bounds.x && cell.x < bounds.x + bounds.width && cell.y >= bounds.y && cell.y < bounds.y + bounds.height);
  }
  function extensionPlan(sector) {
    if (!sector?.materialized || !sector.discovery?.baseline || !sector.context?.truth || !sector.bounds || !sector.destination) return null;
    const b = sector.bounds, id = `${sector.destination.id}:adjoining-east`, bounds = { ...copy(b), x: b.x + b.width };
    return { id, parentSiteId: sector.context.siteId, roomId: sector.roomId, bounds,
      seam: { x: bounds.x - 1, y: sector.entry.y, z: bounds.z }, entry: { x: bounds.x, y: sector.entry.y, z: bounds.z },
      destination: { ...copy(sector.destination), id, label: `Adjoining local ground — ${sector.destination.label}`,
        description: 'Unprotected adjoining ground within the same globe hex. No new station, staff, transport or safe passage.' },
      context: { ...copy(sector.context), siteId: id, seed: `${sector.context.seed || sector.context.worldId}:adjoining-east` },
      materialized: false, discovery: null };
  }
  function extensionReason(excursion, sector, c) {
    const reason = sampleReason(excursion, sector, c, 'reconnaissance');
    if (reason) return reason;
    if (c.otherBusy || !extensionPlan(sector) || !c.atSeam || !c.reachable) return 'Personally reach the clear eastern edge with the original free capable body; finish or cancel other work.';
    return '';
  }
  function create(excursion, origin, candidates, occupied, contextFor) {
    if (!excursion?.source || origin?.id !== excursion.source.cellId) return null;
    const selected = Survival.chooseDestination(origin, candidates, occupied);
    if (!selected) return null;
    const destination = { ...selected, id: `${excursion.source.placeId}:boundary:${selected.strategicCellId}` };
    const context = contextFor(destination);
    if (!context?.truth || context.siteId !== destination.id || context.strategicCellId !== destination.strategicCellId
      || context.worldId !== excursion.context.worldId) return null;
    const z = excursion.entry.z;
    const arrival = candidates.find(c => c.id === destination.strategicCellId)?.approachArrival;
    return { destination, context: copy(context), roomId: `${excursion.roomId}-wilderness`, materialized: false,
      entry: { x: 22, y: 12, z }, gate: { x: 20, y: 12, z }, bounds: { x: 21, y: 8, z, width: 16, height: 12 },
      ...(arrival && Number.isFinite(arrival.eastM) && Number.isFinite(arrival.northM)
        ? { approachArrival: { eastM: arrival.eastM, northM: arrival.northM } } : {}),
      discovery: null, shelter: null, beasts: null };
  }
  // One north/east frame for all four existing on-foot patches. On a route
  // known only to the hex, locate the entrance inside its approach-facing side.
  // The disk is the same equal-area habitat approximation used by the account.
  function populationWindow(sector, from, to, areaHa, tile) {
    if (!sector?.bounds || !sector.entry || !(areaHa > 0) || !(tile > 0)
      || from?.id !== sector.destination?.approachCellId || to?.id !== sector.destination?.strategicCellId) return null;
    const b = sector.bounds, bounds = { ...b, width: b.width * 2, height: b.height * 2 };
    const radius = Math.sqrt(areaHa * 10000 / Math.PI), room = Math.hypot(bounds.width, bounds.height) * tile;
    if (!(radius > room)) return null;
    let entry = sector.approachArrival;
    if (entry) {
      if (!Number.isFinite(entry.eastM) || !Number.isFinite(entry.northM)
        || Math.hypot(entry.eastM, entry.northM) + room > radius) return null;
    } else {
      if (![from.latitude, from.longitude, to.latitude, to.longitude].every(Number.isFinite)) return null;
      const rad = Math.PI / 180, start = to.latitude * rad, end = from.latitude * rad, delta = (from.longitude - to.longitude) * rad;
      const east = Math.sin(delta) * Math.cos(end), north = Math.cos(start) * Math.sin(end) - Math.sin(start) * Math.cos(end) * Math.cos(delta);
      const length = Math.hypot(east, north), distance = (radius - room) * .7;
      if (!(length > 1e-12)) return null;
      entry = { eastM: east / length * distance, northM: north / length * distance };
    }
    const m = n => Math.round(n * 1000) / 1000; // Stable metre frame, to the millimetre.
    return { bounds, origin: { eastM: m(entry.eastM - (sector.entry.x - b.x) * tile),
      northM: m(entry.northM - (sector.entry.y - b.y) * tile) } };
  }
  // Ground access is not permission or a supply checklist for the wild.
  function entryReason(excursion, sector, c) {
    if (!sector || sector.destination.approachCellId !== excursion?.source.cellId) return 'No traversable adjacent wilderness sector is available.';
    if (!c.alive || !c.capable || !c.originalBody || c.custodyActive || c.otherBusy
      || excursion.phase !== 'field' || excursion.trip?.bodyEpoch !== c.bodyEpoch || excursion.trip?.visitId !== c.visitId || !c.atField)
      return 'Physically attend the original free capable body at the sampling ground with its original parked trip.';
    return '';
  }
  function sampleReason(excursion, sector, c, method) {
    if (!sector || !c.atWilderness || !c.alive || !c.capable || !c.originalBody || c.custodyActive
      || excursion?.phase !== 'field' || excursion.trip?.bodyEpoch !== c.bodyEpoch || excursion.trip?.visitId !== c.visitId)
      return 'The original free capable body must physically attend its own wilderness sector.';
    if (!['reconnaissance', 'surfaceSample', 'shallowCore', 'arcaneSurvey'].includes(method)) return 'Unknown local survey method.';
    return '';
  }
  return { create, contains, populationWindow, extensionPlan, extensionReason, entryReason, sampleReason };
});
