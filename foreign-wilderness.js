(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignWilderness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Survival) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
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
  return { create, entryReason, sampleReason };
});
