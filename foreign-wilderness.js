(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./wilderness-survival') : root.HelixWildernessSurvival,
    node ? require('./strategic-world') : root.HelixStrategicWorld);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignWilderness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Survival, World) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  function contains(bounds, cell) {
    return Boolean(bounds && cell && ['x', 'y', 'z'].every(k => Number.isInteger(cell[k])) && cell.z === bounds.z
      && cell.x >= bounds.x && cell.x < bounds.x + bounds.width && cell.y >= bounds.y && cell.y < bounds.y + bounds.height);
  }
  function extensionPlan(sector) {
    if (!sector?.materialized || sector.coast || !sector.discovery?.baseline || !sector.context?.truth || !sector.bounds || !sector.destination) return null;
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
  function wetlandBank(record, cellIndex) {
    const row = record?.patchRows?.find(([i, kind, , basis]) => i === cellIndex && kind === 1 && basis !== 4);
    if (!row) return null; // An uncharted catchment pond is not a mapped approach.
    const radiusM = Math.sqrt(row[2] * 10000 / Math.PI);
    const bed = record.physicalBinding?.workSites?.find(r => r.regionId === `habitat:${cellIndex}:wetland`
      && r.site.action === 'tendWetland')?.site;
    // Existing workface geometry can mark a bank even when all of the original
    // workers are absent. Do not read a group, census or live position here.
    return { radiusM, edgeEastM: bed ? bed.position.eastM - Math.min(2, Math.sqrt(bed.footprintHa * 10000) / 10) : -radiusM,
      accessNorthM: bed?.position.northM ?? 0 };
  }
  const wetlandAt = (bank, eastM, northM) => Boolean(bank && eastM >= bank.edgeEastM && Math.hypot(eastM, northM) <= bank.radiusM);
  const validBank = bank => Boolean(bank && Number.isFinite(bank.radiusM) && bank.radiusM > 0
    && Number.isFinite(bank.edgeEastM) && Number.isFinite(bank.accessNorthM)
    && [bank.edgeEastM, bank.accessNorthM].every(n => Math.abs(n) <= bank.radiusM));
  const validCoast = c => Boolean(c && /^planet-cell:\d+$/.test(c.landCellId) && /^planet-cell:\d+$/.test(c.seaCellId)
    && c.landCellId !== c.seaCellId && [c.eastM, c.northM, c.axis].every(Number.isInteger) && c.axis >= 0 && c.axis < 4);
  // One geographic transect per marine hex. Coarse cells have no metre-scale
  // shoreline polygon; refine their actual mapped coast in the original area
  // frame. Neither the survey nor the geography reads a creature location.
  function coastReference(map, seaIndex, areaHa) {
    if (map?.surface?.classes?.[seaIndex] !== 'W' || map.relief?.coastClasses?.[seaIndex] === '.' || !(areaHa > 0)) return null;
    const sea = World.cellSnapshot(map, seaIndex), landId = sea.neighborIds.slice().sort()
      .find(id => {
        const i = World.cellIndex(id);
        return map.surface.classes[i] === 'L' && map.relief.coastClasses[i] !== '.';
      });
    if (!landId) return null;
    const land = World.cellSnapshot(map, World.cellIndex(landId)), rad = Math.PI / 180;
    const a = sea.latitude * rad, b = land.latitude * rad, delta = (land.longitude - sea.longitude) * rad;
    const east = Math.sin(delta) * Math.cos(b), north = Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(delta);
    const length = Math.hypot(east, north), radius = Math.sqrt(areaHa * 10000 / Math.PI);
    if (!(length > 1e-12) || radius < 140) return null;
    const axis = Math.abs(east) >= Math.abs(north) ? (east < 0 ? 0 : 2) : (north < 0 ? 1 : 3);
    return { landCellId: landId, seaCellId: sea.id, axis, eastM: Math.round(east / length * (radius - 80)),
      northM: Math.round(north / length * (radius - 80)) };
  }
  function coastForLand(map, landIndex, record) {
    if (map?.surface?.classes?.[landIndex] !== 'L' || !record?.patchRows || map.relief?.coastClasses?.[landIndex] === '.') return null;
    const land = World.cellSnapshot(map, landIndex);
    const near = (id) => map.relief.elevationM[World.cellIndex(id)];
    for (const id of land.neighborIds.slice().sort((a, b) => near(b) - near(a) || a.localeCompare(b))) {
      const index = World.cellIndex(id), area = record.patchRows.find(([i, kind]) => i === index && kind === 3)?.[2];
      const coast = coastReference(map, index, area);
      if (coast?.landCellId === land.id) return coast;
    }
    return null;
  }
  const coastEast = (bounds) => bounds.x + 10;
  const coastNorth = (bounds) => bounds.y + 8;
  const seawaterCell = (sector, cell) => Boolean(sector?.coast && contains(sector.bounds, cell) && cell.x >= coastEast(sector.bounds));
  function turn(x, y, axis = 0) {
    if (axis === 1) return [-y, x];
    if (axis === 2) return [-x, -y];
    if (axis === 3) return [y, -x];
    return [x, y];
  }
  function offset(frame, x, y) {
    const [east, north] = turn(x, y, frame.axis);
    return { eastM: frame.eastM + east, northM: frame.northM + north };
  }
  function relative(frame, east, north) {
    return turn(east - frame.eastM, north - frame.northM, (4 - (frame.axis || 0)) % 4);
  }
  function coastSeaFrame(coast, bounds, tile) {
    return { ...offset(coast, (bounds.x - coastEast(bounds)) * tile, (bounds.y - coastNorth(bounds)) * tile), axis: coast.axis };
  }
  // Optical depth is measured to the top of the actual body. An exposed
  // body can be seen even in opaque water; nothing below the clear column is.
  const coastVisible = (altitudeM, heightM, clarityM) => Number.isFinite(altitudeM) && Number.isFinite(heightM)
    && Math.max(0, -(altitudeM + heightM)) <= Math.max(0, clarityM || 0);
  // One north/east frame for all four existing on-foot patches. A mapped
  // wetland can supply a dry bank approach; recorded route anchors win.
  function populationWindow(sector, from, to, areaHa, tile, bank = null) {
    if (!sector?.bounds || !sector.entry || !(areaHa > 0) || !(tile > 0)
      || from?.id !== sector.destination?.approachCellId || to?.id !== sector.destination?.strategicCellId) return null;
    const b = sector.bounds, bounds = { ...b, width: b.width * 2, height: b.height * 2 };
    const radius = Math.sqrt(areaHa * 10000 / Math.PI), room = Math.hypot(bounds.width, bounds.height) * tile;
    if (!(radius > room)) return null;
    let entry = sector.approachArrival;
    if (entry) {
      if (!Number.isFinite(entry.eastM) || !Number.isFinite(entry.northM)
        || Math.hypot(entry.eastM, entry.northM) + room > radius) return null;
    } else if (validBank(bank) && Math.hypot(bank.edgeEastM - 9 * tile, bank.accessNorthM) + room <= radius) {
      entry = { eastM: bank.edgeEastM - 9 * tile, northM: bank.accessNorthM };
    } else {
      if (![from.latitude, from.longitude, to.latitude, to.longitude].every(Number.isFinite)) return null;
      const rad = Math.PI / 180, start = to.latitude * rad, end = from.latitude * rad, delta = (from.longitude - to.longitude) * rad;
      const east = Math.sin(delta) * Math.cos(end), north = Math.cos(start) * Math.sin(end) - Math.sin(start) * Math.cos(end) * Math.cos(delta);
      const length = Math.hypot(east, north), distance = (radius - room) * .7;
      if (!(length > 1e-12)) return null;
      entry = { eastM: east / length * distance, northM: north / length * distance };
    }
    const m = n => Math.round(n * 1000) / 1000; // Stable metre frame, to the millimetre.
    const origin = { eastM: m(entry.eastM - (sector.entry.x - b.x) * tile),
      northM: m(entry.northM - (sector.entry.y - b.y) * tile) };
    // Do not turn an existing route entry into a swim. The scientist starts
    // from supported dry ground and can observe the reached water from it.
    const wet = (x, y) => wetlandAt(bank, origin.eastM + (x + .5) * tile, origin.northM + (y + .5) * tile);
    const entryDry = validBank(bank) && Array.from({ length: sector.entry.x - b.x + 1 }, (_, x) => x)
      .every(x => !wet(x, sector.entry.y - b.y));
    const entersBank = entryDry && Array.from({ length: bounds.height }, (_, y) => y)
      .some(y => Array.from({ length: bounds.width }, (_, x) => x).some(x => wet(x, y)));
    return { bounds, origin, ...(entersBank ? { wetlandBank: copy(bank) } : {}) };
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
  return { create, contains, populationWindow, wetlandBank, wetlandAt, validBank, coastReference, coastForLand, validCoast, coastEast, coastNorth,
    coastSeaFrame, offset, relative, coastVisible, seawaterCell, extensionPlan, extensionReason, entryReason, sampleReason };
});
