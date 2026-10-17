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
    return { destination, context: copy(context), roomId: `${excursion.roomId}-wilderness`, materialized: false,
      entry: { x: 22, y: 12, z }, gate: { x: 20, y: 12, z }, bounds: { x: 21, y: 8, z, width: 16, height: 12 },
      discovery: null, shelter: null, beasts: null };
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
  return { create, contains, extensionPlan, extensionReason, entryReason, sampleReason };
});
