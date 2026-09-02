(function initPropertyPresentation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixPropertyPresentation = api;
})(typeof window !== "undefined" ? window : globalThis, function createPropertyPresentationApi() {
  "use strict";

  const SECONDS_PER_DAY = 86400;
  const ZONE_DEFS = Object.freeze({
    publicApproach: Object.freeze({ id: "publicApproach", label: "Public Approach", family: "route", glyph: "·" }),
    freightApproach: Object.freeze({ id: "freightApproach", label: "Freight Lane", family: "route", glyph: "=" }),
    outdoorWork: Object.freeze({ id: "outdoorWork", label: "Outdoor Work Area", family: "use", glyph: "w" }),
    outdoorStorage: Object.freeze({ id: "outdoorStorage", label: "Outdoor Storage Area", family: "use", glyph: "s" }),
    wasteHolding: Object.freeze({ id: "wasteHolding", label: "Waste-Holding Area", family: "use", glyph: "x" }),
    landscaping: Object.freeze({ id: "landscaping", label: "Landscaped Area", family: "use", glyph: "," })
  });
  const PROPERTY_FIXTURE_DEFS = Object.freeze({
    companySign: Object.freeze({ id: "companySign", label: "Company Sign", kind: "sign", opaque: false, weatherRate: 0.18 }),
    meshBarrier: Object.freeze({ id: "meshBarrier", label: "Mesh Barrier", kind: "barrier", opaque: false, weatherRate: 0.08 }),
    privacyScreen: Object.freeze({ id: "privacyScreen", label: "Privacy Screen", kind: "screen", opaque: true, weatherRate: 0.12 }),
    landscapeBed: Object.freeze({ id: "landscapeBed", label: "Landscape Bed", kind: "landscaping", opaque: false, weatherRate: 0.26 }),
    wasteEnclosure: Object.freeze({ id: "wasteEnclosure", label: "Waste Enclosure", kind: "waste", opaque: true, weatherRate: 0.1 })
  });
  const BAND_DEFS = Object.freeze([
    Object.freeze({ id: "excellent", label: "Excellent", min: 86 }),
    Object.freeze({ id: "credible", label: "Credible", min: 68 }),
    Object.freeze({ id: "serviceable", label: "Serviceable", min: 48 }),
    Object.freeze({ id: "poor", label: "Poor", min: 28 }),
    Object.freeze({ id: "failed", label: "Failed", min: 0 })
  ]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, finite(value, minimum))); }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function cleanCell(candidate) {
    if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) return null;
    return { x: Math.round(Number(candidate.x)), y: Math.round(Number(candidate.y)), z: Math.round(Number(candidate.z) || 0) };
  }
  function cellKey(cell) { const clean = cleanCell(cell); return clean ? `${clean.x},${clean.y},${clean.z}` : ""; }
  function uniqueCells(cells) {
    const result = [];
    const seen = new Set();
    for (const candidate of Array.isArray(cells) ? cells : []) {
      const cell = cleanCell(candidate);
      const key = cellKey(cell);
      if (!cell || seen.has(key)) continue;
      seen.add(key); result.push(cell);
    }
    return result.sort((left, right) => left.z - right.z || left.y - right.y || left.x - right.x);
  }
  function orthogonal(cell) {
    return [{ x: cell.x + 1, y: cell.y, z: cell.z }, { x: cell.x - 1, y: cell.y, z: cell.z }, { x: cell.x, y: cell.y + 1, z: cell.z }, { x: cell.x, y: cell.y - 1, z: cell.z }];
  }
  function rectCells(rect) {
    const result = [];
    const x = Math.round(finite(rect?.x)); const y = Math.round(finite(rect?.y)); const z = Math.round(finite(rect?.z));
    for (let dy = 0; dy < Math.max(0, Math.round(finite(rect?.height))); dy += 1) {
      for (let dx = 0; dx < Math.max(0, Math.round(finite(rect?.width))); dx += 1) result.push({ x: x + dx, y: y + dy, z });
    }
    return result;
  }
  function straightCells(from, to) {
    const start = cleanCell(from); const end = cleanCell(to);
    if (!start || !end || start.z !== end.z) return [];
    const cells = [];
    let x = start.x; let y = start.y;
    const dx = Math.abs(end.x - start.x); const sx = start.x < end.x ? 1 : -1;
    const dy = -Math.abs(end.y - start.y); const sy = start.y < end.y ? 1 : -1;
    let error = dx + dy;
    while (true) {
      cells.push({ x, y, z: start.z });
      if (x === end.x && y === end.y) break;
      const doubled = 2 * error;
      if (doubled >= dy) { error += dy; x += sx; }
      if (doubled <= dx) { error += dx; y += sy; }
    }
    return cells;
  }

  function observerProfiles(context = {}, parcelRect = {}, access = {}) {
    const rect = { x: Math.round(finite(parcelRect.x)), y: Math.round(finite(parcelRect.y)), z: Math.round(finite(parcelRect.z)), width: Math.max(1, Math.round(finite(parcelRect.width, 1))), height: Math.max(1, Math.round(finite(parcelRect.height, 1))) };
    const band = String(context?.location?.distanceBand || "remoteWilderness");
    const publicCell = cleanCell(access.public?.boundaryCells?.[0]) || { x: rect.x + Math.floor(rect.width / 2), y: rect.y + rect.height - 1, z: rect.z };
    const freightCell = cleanCell(access.freight?.boundaryCells?.[0]) || { x: rect.x + rect.width - 1, y: rect.y + Math.floor(rect.height / 2), z: rect.z };
    const activity = { cityDistrict: 1, protectedApproaches: 0.68, corridorFringe: 0.42, remoteWilderness: 0.14 }[band] || 0.14;
    const observers = [
      { id: "public-route", label: band === "cityDistrict" ? "Public street frontage" : band === "protectedApproaches" ? "Protected approach road" : band === "corridorFringe" ? "Supported corridor approach" : "Occasional wilderness approach", kind: "public", cell: publicCell, activity },
      { id: "service-route", label: "Freight and service approach", kind: "service", cell: freightCell, activity: Math.max(0.12, activity * 0.72) }
    ];
    if (band === "cityDistrict") observers.push({ id: "neighbor-activity", label: "Neighboring city activity", kind: "neighbor", cell: { x: rect.x, y: rect.y + Math.floor(rect.height / 2), z: rect.z }, activity: 0.74 });
    else if (band === "protectedApproaches") observers.push({ id: "route-patrol", label: "Approach patrol traffic", kind: "patrol", cell: { x: rect.x + Math.floor(rect.width / 2), y: rect.y, z: rect.z }, activity: 0.4 });
    return observers.map((entry) => ({ ...entry, cell: cleanCell(entry.cell), activity: clamp(entry.activity, 0, 1) }));
  }

  function normalizeAccess(candidate = {}) {
    const normalize = (entry, id, label, requiredWidth) => ({
      id, label, requiredWidth,
      boundaryCells: uniqueCells(entry?.boundaryCells), entranceCells: uniqueCells(entry?.entranceCells)
    });
    return {
      public: normalize(candidate.public, "public", "Public approach", 1),
      freight: normalize(candidate.freight, "freight", "Freight lane", 3)
    };
  }
  function defaultState(options = {}) {
    const access = normalizeAccess(options.access);
    const zones = Object.fromEntries(Object.keys(ZONE_DEFS).map((id) => [id, uniqueCells(options.zones?.[id])]));
    return {
      contextDigest: String(options.context?.digest || ""), parcelRect: { ...options.parcelRect }, access, zones,
      observers: observerProfiles(options.context, options.parcelRect, access), weatheredThroughDay: 0, wearLog: [],
      lastAssessmentAt: 0
    };
  }
  function normalizeState(candidate, options = {}) {
    const fallback = defaultState(options);
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const access = normalizeAccess(source.access?.public?.boundaryCells?.length ? source.access : fallback.access);
    const zones = {};
    for (const id of Object.keys(ZONE_DEFS)) {
      zones[id] = uniqueCells(Array.isArray(source.zones?.[id]) ? source.zones[id] : fallback.zones[id]);
    }
    return {
      contextDigest: String(options.context?.digest || source.contextDigest || ""),
      parcelRect: source.parcelRect?.width ? { ...source.parcelRect } : { ...fallback.parcelRect }, access, zones,
      observers: (Array.isArray(source.observers) && source.observers.length ? source.observers : fallback.observers).map((entry, index) => ({
        id: cleanId(entry?.id) || `parcel-observer-${index + 1}`, label: String(entry?.label || "Known public vantage"),
        kind: cleanId(entry?.kind) || "public", cell: cleanCell(entry?.cell), activity: clamp(entry?.activity, 0, 1)
      })).filter((entry) => entry.cell),
      weatheredThroughDay: Math.max(0, Math.floor(finite(source.weatheredThroughDay))),
      wearLog: (Array.isArray(source.wearLog) ? source.wearLog : []).slice(-64).map((entry) => ({ day: Math.max(1, Math.floor(finite(entry?.day, 1))), fixtureId: cleanId(entry?.fixtureId), loss: clamp(entry?.loss, 0, 100), cause: String(entry?.cause || "ordinary exterior exposure") })),
      lastAssessmentAt: Math.max(0, finite(source.lastAssessmentAt))
    };
  }

  function setZone(candidate, zoneId, cell, options = {}) {
    const state = normalizeState(candidate, options);
    const definition = ZONE_DEFS[zoneId]; const clean = cleanCell(cell);
    if (!definition || !clean) return state;
    const key = cellKey(clean);
    for (const [id, cells] of Object.entries(state.zones)) {
      if (ZONE_DEFS[id].family === definition.family) state.zones[id] = cells.filter((entry) => cellKey(entry) !== key);
    }
    state.zones[zoneId] = uniqueCells([...state.zones[zoneId], clean]);
    return state;
  }
  function clearZone(candidate, cell, options = {}) {
    const state = normalizeState(candidate, options); const key = cellKey(cell);
    for (const id of Object.keys(state.zones)) state.zones[id] = state.zones[id].filter((entry) => cellKey(entry) !== key);
    return state;
  }
  function zonesAt(candidate, cell, options = {}) {
    const state = normalizeState(candidate, options); const key = cellKey(cell);
    return Object.keys(ZONE_DEFS).filter((id) => state.zones[id].some((entry) => cellKey(entry) === key));
  }

  function disjointRouteWidth(zoneCells, starts, terminalCells) {
    const zoneKeys = new Set(zoneCells.map(cellKey));
    const startKeys = new Set(starts.map(cellKey));
    const terminalKeys = new Set(terminalCells.map(cellKey));
    const source = "@source"; const sink = "@sink";
    const capacity = new Map();
    const adjacency = new Map();
    const edgeKey = (from, to) => `${from}>${to}`;
    const addEdge = (from, to, amount) => {
      const key = edgeKey(from, to); const reverse = edgeKey(to, from);
      capacity.set(key, (capacity.get(key) || 0) + amount);
      if (!capacity.has(reverse)) capacity.set(reverse, 0);
      if (!adjacency.has(from)) adjacency.set(from, new Set());
      if (!adjacency.has(to)) adjacency.set(to, new Set());
      adjacency.get(from).add(to); adjacency.get(to).add(from);
    };
    const input = (key) => `${key}:in`; const output = (key) => `${key}:out`;
    for (const cell of zoneCells) {
      const key = cellKey(cell);
      addEdge(input(key), output(key), 1);
      if (startKeys.has(key)) addEdge(source, input(key), 1);
      if (terminalKeys.has(key)) addEdge(output(key), sink, 1);
      for (const neighbor of orthogonal(cell)) {
        const neighborKey = cellKey(neighbor);
        if (zoneKeys.has(neighborKey)) addEdge(output(key), input(neighborKey), zoneCells.length + 1);
      }
    }
    let flow = 0;
    while (true) {
      const parents = new Map([[source, null]]); const queue = [source];
      while (queue.length && !parents.has(sink)) {
        const current = queue.shift();
        for (const next of adjacency.get(current) || []) {
          if (parents.has(next) || (capacity.get(edgeKey(current, next)) || 0) <= 0) continue;
          parents.set(next, current); queue.push(next);
        }
      }
      if (!parents.has(sink)) break;
      let cursor = sink;
      while (cursor !== source) {
        const parent = parents.get(cursor);
        capacity.set(edgeKey(parent, cursor), capacity.get(edgeKey(parent, cursor)) - 1);
        capacity.set(edgeKey(cursor, parent), (capacity.get(edgeKey(cursor, parent)) || 0) + 1);
        cursor = parent;
      }
      flow += 1;
    }
    return flow;
  }

  function routeStatus(candidate, routeKind, blockedCellKeys = [], options = {}) {
    const state = normalizeState(candidate, options);
    const isFreight = routeKind === "freight";
    const zoneId = isFreight ? "freightApproach" : "publicApproach";
    const access = isFreight ? state.access.freight : state.access.public;
    const blocked = new Set(Array.from(blockedCellKeys || [], (entry) => typeof entry === "string" ? entry : cellKey(entry)));
    const zoneCells = state.zones[zoneId].filter((entry) => !blocked.has(cellKey(entry)));
    const zoneKeys = new Set(zoneCells.map(cellKey));
    const entrancesTouched = access.entranceCells.filter((entrance) => orthogonal(entrance).some((cell) => zoneKeys.has(cellKey(cell))) || zoneKeys.has(cellKey(entrance)));
    const boundariesTouched = access.boundaryCells.filter((boundary) => zoneKeys.has(cellKey(boundary)));
    const terminalCells = uniqueCells(entrancesTouched.flatMap((entrance) => [entrance, ...orthogonal(entrance)]).filter((cell) => zoneKeys.has(cellKey(cell))));
    const width = disjointRouteWidth(zoneCells, boundariesTouched, terminalCells);
    const connected = width >= access.requiredWidth;
    return {
      id: routeKind, label: access.label, connected, requiredWidth: access.requiredWidth, availableWidth: width,
      zoneCellCount: zoneCells.length, blockedCellCount: state.zones[zoneId].length - zoneCells.length,
      reason: connected ? `${access.label} physically connects the parcel boundary to its entrance.`
        : !zoneCells.length ? `${access.label} has no designated cells.`
          : boundariesTouched.length < access.requiredWidth ? `${access.label} does not reach enough parcel-boundary cells.`
            : terminalCells.length < access.requiredWidth ? `${access.label} does not reach the full entrance width.`
              : `${access.label} is interrupted by a physical obstruction.`
    };
  }

  function sightlines(candidate, targetCells, opaqueCellKeys = [], options = {}) {
    const state = normalizeState(candidate, options);
    const opaque = new Set(Array.from(opaqueCellKeys || [], (entry) => typeof entry === "string" ? entry : cellKey(entry)));
    const targets = uniqueCells(targetCells);
    const rows = state.observers.map((observer) => {
      const visibleCells = targets.filter((target) => straightCells(observer.cell, target).slice(1, -1).every((cell) => !opaque.has(cellKey(cell))));
      return { id: observer.id, label: observer.label, kind: observer.kind, activity: observer.activity, cell: observer.cell, visibleCells, visibleCellKeys: visibleCells.map(cellKey) };
    });
    const visibleCellKeys = [...new Set(rows.flatMap((entry) => entry.visibleCellKeys))];
    return { observers: rows, visibleCellKeys, visibleCount: visibleCellKeys.length, targetCount: targets.length };
  }

  function advanceWeather(candidate, fixtures = [], weatherProvider = () => ({}), clock = 0, options = {}) {
    const state = normalizeState(candidate, options);
    const throughDay = Math.floor(Math.max(0, finite(clock)) / SECONDS_PER_DAY);
    const damageByFixtureId = {};
    for (let day = state.weatheredThroughDay + 1; day <= throughDay; day += 1) {
      const weather = weatherProvider(day) || {};
      const precipitation = Math.max(0, finite(weather.precipitationMm));
      const wind = clamp(weather.windStrengthPercent, 0, 100);
      const temperature = Math.abs(finite(weather.temperatureOffsetC));
      for (const fixture of fixtures) {
        const definition = PROPERTY_FIXTURE_DEFS[fixture?.typeId];
        if (!definition) continue;
        const loss = Math.round((definition.weatherRate + precipitation * 0.012 + wind * 0.003 + temperature * 0.008) * 100) / 100;
        if (loss <= 0) continue;
        damageByFixtureId[fixture.id] = Math.round(((damageByFixtureId[fixture.id] || 0) + loss) * 100) / 100;
        state.wearLog.push({ day, fixtureId: cleanId(fixture.id), loss, cause: `${String(weather.label || "ordinary weather")} exterior exposure` });
      }
    }
    state.weatheredThroughDay = Math.max(state.weatheredThroughDay, throughDay);
    state.wearLog = state.wearLog.slice(-64);
    return { state, damageByFixtureId };
  }

  function band(score) { return BAND_DEFS.find((entry) => score >= entry.min) || BAND_DEFS.at(-1); }
  function presentationAssessment(candidate, inputs = {}, options = {}) {
    const state = normalizeState(candidate, options);
    const fixtures = Array.isArray(inputs.fixtures) ? inputs.fixtures.filter((entry) => PROPERTY_FIXTURE_DEFS[entry?.typeId]) : [];
    const sight = inputs.sightlines || { visibleCellKeys: [] };
    const visible = new Set(sight.visibleCellKeys || []);
    const publicRoute = inputs.publicRoute || routeStatus(state, "public", inputs.blockedCellKeys, options);
    const freightRoute = inputs.freightRoute || routeStatus(state, "freight", inputs.blockedCellKeys, options);
    const signs = fixtures.filter((entry) => entry.typeId === "companySign");
    const visibleSigns = signs.filter((entry) => visible.has(cellKey(entry.origin)));
    const landscapes = fixtures.filter((entry) => entry.typeId === "landscapeBed");
    const privacy = fixtures.filter((entry) => ["privacyScreen", "wasteEnclosure"].includes(entry.typeId));
    const enclosureCount = fixtures.filter((entry) => entry.typeId === "wasteEnclosure").length;
    const averageCondition = fixtures.length ? fixtures.reduce((sum, entry) => sum + clamp(entry.condition, 0, 100), 0) / fixtures.length : 0;
    const publicCells = new Set(state.zones.publicApproach.map(cellKey));
    const freightCells = new Set(state.zones.freightApproach.map(cellKey));
    const incompatibleCrossings = [...state.zones.wasteHolding, ...state.zones.outdoorWork, ...state.zones.outdoorStorage]
      .filter((cell) => publicCells.has(cellKey(cell))).length + state.zones.wasteHolding.filter((cell) => freightCells.has(cellKey(cell))).length;
    const visibleWaste = (inputs.outdoorStacks || []).filter((entry) => visible.has(cellKey(entry.cell)) && (entry.tags || []).some((tag) => ["waste", "processWaste", "hazard", "hazardous", "chemical"].includes(tag))).length;
    const visibleClutter = (inputs.outdoorStacks || []).filter((entry) => visible.has(cellKey(entry.cell))).length;
    const bandId = String(inputs.context?.location?.distanceBand || options.context?.location?.distanceBand || "remoteWilderness");
    const privacyAllowance = { cityDistrict: 6, protectedApproaches: 10, corridorFringe: 14, remoteWilderness: 18 }[bandId] || 18;

    const identification = clamp((visibleSigns.length ? 58 : signs.length ? 30 : 0) + (visibleSigns[0]?.condition || signs[0]?.condition || 0) * 0.42, 0, 100);
    const access = clamp((publicRoute.connected ? 55 : 0) + (freightRoute.connected ? 35 : 0) + Math.min(10, state.zones.publicApproach.length + state.zones.freightApproach.length) - incompatibleCrossings * 14, 0, 100);
    const upkeep = clamp(averageCondition - visibleWaste * 16 - Math.max(0, visibleClutter - 4) * 3, 0, 100);
    const landUse = clamp(35 + (state.zones.outdoorWork.length ? 15 : 0) + (state.zones.outdoorStorage.length ? 15 : 0) + (state.zones.wasteHolding.length ? 15 : 0) + Math.min(20, enclosureCount * 12) - incompatibleCrossings * 12 - visibleWaste * 8, 0, 100);
    const landscape = clamp(landscapes.length ? 45 + Math.min(25, landscapes.length * 8) + landscapes.reduce((sum, entry) => sum + clamp(entry.condition, 0, 100), 0) / landscapes.length * 0.3 : 28, 0, 100);
    const security = clamp(70 + Math.min(20, privacy.length * 4) - Math.max(0, privacy.length - privacyAllowance) * 12 - (!publicRoute.connected ? 28 : 0), 0, 100);
    const dimensions = [
      { id: "identification", label: "Identification", score: identification, reason: visibleSigns.length ? "A maintained company sign is visible from a known public approach." : signs.length ? "The company sign is screened from known public approaches." : "No physical company sign identifies the frontage." },
      { id: "approaches", label: "Approaches", score: access, reason: `${publicRoute.reason} ${freightRoute.reason}${incompatibleCrossings ? ` ${incompatibleCrossings} incompatible route crossing${incompatibleCrossings === 1 ? "" : "s"}.` : ""}` },
      { id: "upkeep", label: "Exterior Upkeep", score: upkeep, reason: `${fixtures.length} presentation fixture${fixtures.length === 1 ? "" : "s"} average ${Math.round(averageCondition)}% condition; ${visibleWaste} visible waste condition${visibleWaste === 1 ? "" : "s"}.` },
      { id: "landUse", label: "Outdoor Land Use", score: landUse, reason: `${state.zones.outdoorWork.length} work, ${state.zones.outdoorStorage.length} storage, and ${state.zones.wasteHolding.length} waste-zone cells; ${enclosureCount} physical waste enclosure${enclosureCount === 1 ? "" : "s"}.` },
      { id: "landscaping", label: "Landscaping", score: landscape, reason: landscapes.length ? `${landscapes.length} maintained physical landscape bed${landscapes.length === 1 ? "" : "s"}.` : "No maintained landscaping softens the frontage." },
      { id: "security", label: "Contextual Security", score: security, reason: privacy.length > privacyAllowance ? "The amount of opaque screening is excessive for this setting." : "Physical screening remains proportionate to the local setting." }
    ].map((entry) => ({ ...entry, score: Math.round(entry.score), band: band(entry.score).label }));
    const score = Math.round(dimensions.reduce((sum, entry) => sum + entry.score, 0) / dimensions.length);
    state.lastAssessmentAt = Math.max(state.lastAssessmentAt, finite(inputs.clock));
    return { state, score, band: band(score), dimensions, reasons: dimensions.map((entry) => entry.reason), publicRoute, freightRoute, visibleWaste, visibleClutter };
  }

  return Object.freeze({
    SECONDS_PER_DAY, ZONE_DEFS, PROPERTY_FIXTURE_DEFS, BAND_DEFS,
    clone, cleanCell, cellKey, rectCells, straightCells, observerProfiles,
    defaultState, normalizeState, setZone, clearZone, zonesAt, disjointRouteWidth, routeStatus, sightlines, advanceWeather, band, presentationAssessment
  });
});
