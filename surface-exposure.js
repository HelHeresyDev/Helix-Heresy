(function initSurfaceExposure(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixSurfaceExposure = api;
})(typeof window !== "undefined" ? window : globalThis, function createSurfaceExposureApi() {
  "use strict";

  const SECONDS_PER_HOUR = 3600;
  const SECONDS_PER_DAY = 86400;
  const FATE_STEP_SECONDS = 300;
  const WEATHER_LOOKAHEAD_DAYS = 7;
  const WEATHER_HISTORY_DAYS = 30;
  const MEDIA_KEYS = Object.freeze(["surface", "subsurface", "drainage", "airborne", "offsite", "transformed", "removed"]);
  const WEATHER_KINDS = Object.freeze({
    clear: Object.freeze({ id: "clear", label: "Clear", humidityBonus: -4, temperatureOffsetC: 1.5 }),
    overcast: Object.freeze({ id: "overcast", label: "Overcast", humidityBonus: 7, temperatureOffsetC: -1 }),
    rain: Object.freeze({ id: "rain", label: "Rain", humidityBonus: 20, temperatureOffsetC: -2 }),
    snow: Object.freeze({ id: "snow", label: "Snow", humidityBonus: 12, temperatureOffsetC: -4 }),
    windy: Object.freeze({ id: "windy", label: "Strong wind", humidityBonus: -2, temperatureOffsetC: -1 })
  });
  const TERRAIN_PROFILES = Object.freeze({
    grass: Object.freeze({ id: "grass", label: "Grass and topsoil", absorption: 0.8, infiltration: 0.62, runoff: 0.2, remediation: "excavate" }),
    soil: Object.freeze({ id: "soil", label: "Exposed soil", absorption: 0.9, infiltration: 0.72, runoff: 0.12, remediation: "excavate" }),
    gravel: Object.freeze({ id: "gravel", label: "Compacted gravel", absorption: 0.55, infiltration: 0.42, runoff: 0.42, remediation: "excavate" }),
    paved: Object.freeze({ id: "paved", label: "Constructed surface", absorption: 0.12, infiltration: 0.04, runoff: 0.84, remediation: "neutralize" }),
    roof: Object.freeze({ id: "roof", label: "Roof surface", absorption: 0.03, infiltration: 0.01, runoff: 0.94, remediation: "neutralize" })
  });
  const PHASE_PROFILES = Object.freeze({
    liquid: Object.freeze({ waterMobility: 0.9, airMobility: 0.08, adhesion: 0.2, odor: 0.5 }),
    sludge: Object.freeze({ waterMobility: 0.48, airMobility: 0.03, adhesion: 0.72, odor: 0.45 }),
    gel: Object.freeze({ waterMobility: 0.22, airMobility: 0.02, adhesion: 0.82, odor: 0.3 }),
    powder: Object.freeze({ waterMobility: 0.5, airMobility: 0.72, adhesion: 0.28, odor: 0.15 }),
    vapor: Object.freeze({ waterMobility: 0.02, airMobility: 1, adhesion: 0.02, odor: 0.75 }),
    solid: Object.freeze({ waterMobility: 0.08, airMobility: 0.02, adhesion: 0.35, odor: 0.08 })
  });

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, Number(value) || 0)); }
  function round(value, places = 6) { const scale = 10 ** places; return Math.round((Number(value) || 0) * scale) / scale; }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function cleanCell(candidate) {
    const x = Number(candidate?.x), y = Number(candidate?.y), z = Number(candidate?.z);
    return Number.isFinite(x) && Number.isFinite(y) ? { x: Math.round(x), y: Math.round(y), z: Number.isFinite(z) ? Math.round(z) : 0 } : null;
  }
  function cellKey(cell) { const clean = cleanCell(cell); return clean ? `${clean.x},${clean.y},${clean.z}` : "invalid"; }
  function hash32(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function seededUnit(seed, channel) { return hash32(`${seed}:${channel}`) / 4294967296; }
  function band(value) {
    const amount = Math.max(0, Number(value) || 0);
    return amount >= 20 ? "extensive" : amount >= 8 ? "large" : amount >= 3 ? "moderate" : amount >= 0.5 ? "small" : amount > 0 ? "trace" : "none";
  }
  function directionLabel(bearing) {
    return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round((((Number(bearing) || 0) % 360 + 360) % 360) / 45) % 8];
  }
  function terrainProfile(id) { return TERRAIN_PROFILES[id] || TERRAIN_PROFILES.grass; }
  function materialProfile(candidate = {}) {
    const phase = PHASE_PROFILES[candidate.phase] ? candidate.phase : "solid";
    const base = { ...PHASE_PROFILES[phase] };
    const tags = new Set((candidate.tags || []).map((entry) => String(entry || "").toLowerCase()));
    if (tags.has("volatile")) { base.airMobility = clamp(base.airMobility + 0.45, 0, 1); base.odor = clamp(base.odor + 0.25, 0, 1); }
    if (tags.has("soluble") || tags.has("water-soluble")) base.waterMobility = clamp(base.waterMobility + 0.35, 0, 1);
    if (tags.has("sticky") || tags.has("resin")) { base.adhesion = clamp(base.adhesion + 0.2, 0, 1); base.waterMobility *= 0.65; }
    return { phase, ...base };
  }

  function weatherDay(context, seed, dayIndex) {
    const absoluteDay = Math.floor(Number(context?.calendar?.startOffsetDays) || 0) + dayIndex;
    const latitude = Number(context?.location?.latitude) || 0;
    const hemisphereShift = latitude < 0 ? Math.PI : 0;
    const seasonWave = Math.sin(absoluteDay / 120 * Math.PI * 2 - Math.PI / 2 + hemisphereShift);
    const mean = Number(context?.environment?.meanTemperatureC) || 12;
    const range = Math.max(0, Number(context?.environment?.seasonalRangeC) || 12);
    const parcelOffset = Number(context?.localVariation?.parcelTemperatureOffsetC) || 0;
    const temperatureC = mean + parcelOffset + seasonWave * range * 0.42;
    const annualPrecipitation = Math.max(0, Number(context?.environment?.precipitationMm) || 0);
    const wetChance = clamp(0.07 + annualPrecipitation / 2600 + (1 - Math.abs(seasonWave)) * 0.08, 0.05, 0.72);
    const wetRoll = seededUnit(seed, `weather:${dayIndex}:wet`);
    const windRoll = seededUnit(seed, `weather:${dayIndex}:wind`);
    let kind = wetRoll < wetChance ? (temperatureC <= 1.5 ? "snow" : "rain") : windRoll > 0.82 ? "windy" : wetRoll < wetChance + 0.22 ? "overcast" : "clear";
    const precipitationMm = ["rain", "snow"].includes(kind)
      ? round((1.5 + seededUnit(seed, `weather:${dayIndex}:precipitation`) * 14) * clamp(annualPrecipitation / 900, 0.35, 2), 2)
      : 0;
    const prevailing = Number(context?.environment?.windBearingDeg) || 0;
    const windBearingDeg = Math.round((prevailing + (seededUnit(seed, `weather:${dayIndex}:bearing`) - 0.5) * 100 + 360) % 360);
    const baselineWind = Number(context?.environment?.windStrengthPercent) || 25;
    const windStrengthPercent = Math.round(clamp(baselineWind * 0.55 + seededUnit(seed, `weather:${dayIndex}:strength`) * 45 + (kind === "windy" ? 28 : 0), 4, 100));
    const definition = WEATHER_KINDS[kind];
    return {
      dayIndex,
      startsAt: dayIndex * SECONDS_PER_DAY,
      endsAt: (dayIndex + 1) * SECONDS_PER_DAY,
      kind,
      label: definition.label,
      precipitationMm,
      snowEquivalentMm: kind === "snow" ? precipitationMm : 0,
      windBearingDeg,
      windStrengthPercent,
      temperatureOffsetC: definition.temperatureOffsetC,
      humidityBonus: definition.humidityBonus,
      forecastConfidence: "saved",
      digest: `weather-${hash32(`${seed}:${dayIndex}:${kind}:${precipitationMm}:${windBearingDeg}:${windStrengthPercent}`).toString(16)}`
    };
  }

  function drainageRecord(context, seed) {
    const bearingDeg = Math.round(seededUnit(seed, "parcel-drainage-bearing") * 360) % 360;
    const bandId = context?.location?.distanceBand || "remoteWilderness";
    const surfaceWater = Boolean(context?.water?.surfaceWaterNearby);
    const watershedId = String(context?.environment?.watershedId || "");
    const outletKind = bandId === "cityDistrict" ? "roadDrain" : bandId === "protectedApproaches" ? "drainageDitch" : surfaceWater ? "surfaceWaterSwale" : "groundSwale";
    const labels = { roadDrain: "property road drain", drainageDitch: "protected-approach drainage ditch", surfaceWaterSwale: "surface-water drainage swale", groundSwale: "parcel-edge ground swale" };
    return {
      bearingDeg,
      directionLabel: directionLabel(bearingDeg),
      drainageIndex: Math.round(clamp(context?.localVariation?.drainageIndex, 0, 1000)),
      outletKind,
      outletLabel: labels[outletKind],
      watershedId,
      publicBasis: "Inherited grading survey and visible parcel fall",
      exactAquiferQualityKnown: false
    };
  }

  function ensureWeatherDays(state, context, throughClock) {
    const targetDay = Math.max(0, Math.floor(Math.max(0, Number(throughClock) || 0) / SECONDS_PER_DAY));
    const minimumDay = Math.max(0, targetDay - WEATHER_HISTORY_DAYS);
    const maximumDay = targetDay + WEATHER_LOOKAHEAD_DAYS;
    const byDay = new Map((state.weatherDays || []).map((entry) => [entry.dayIndex, entry]));
    for (let dayIndex = minimumDay; dayIndex <= maximumDay; dayIndex += 1) {
      if (!byDay.has(dayIndex)) byDay.set(dayIndex, weatherDay(context, state.weatherSeed, dayIndex));
    }
    state.weatherDays = [...byDay.values()].filter((entry) => entry.dayIndex >= minimumDay && entry.dayIndex <= maximumDay).sort((a, b) => a.dayIndex - b.dayIndex);
    state.weatherGeneratedThroughDay = maximumDay;
    return state;
  }

  function emptyMedia(candidate = {}) {
    return Object.fromEntries(MEDIA_KEYS.map((key) => [key, round(Math.max(0, Number(candidate[key]) || 0))]));
  }
  function normalizeHistory(candidate) {
    return (Array.isArray(candidate) ? candidate : []).slice(-32).map((entry) => ({ at: Math.max(0, Number(entry?.at) || 0), action: cleanId(entry?.action) || "changed", details: String(entry?.details || "") }));
  }
  function normalizeRecord(candidate, index = 0) {
    if (!candidate || typeof candidate !== "object") return null;
    const cell = cleanCell(candidate.cell);
    if (!cell) return null;
    const terrain = terrainProfile(candidate.terrainId);
    return {
      id: cleanId(candidate.id) || `surface-exposure-${index + 1}`,
      coalesceKey: String(candidate.coalesceKey || ""),
      source: { kind: cleanId(candidate.source?.kind) || "release", id: cleanId(candidate.source?.id), label: String(candidate.source?.label || "Surface release") },
      cell,
      roomId: cleanId(candidate.roomId),
      terrainId: terrain.id,
      exposureKind: cleanId(candidate.exposureKind) || "outdoor",
      openSky: candidate.openSky !== false,
      substanceId: cleanId(candidate.substanceId) || "unidentifiedResidue",
      label: String(candidate.label || "Surface residue"),
      phase: PHASE_PROFILES[candidate.phase] ? candidate.phase : "solid",
      tags: [...new Set((candidate.tags || []).map((entry) => cleanId(entry)).filter(Boolean))],
      releasedAmount: round(candidate.releasedAmount),
      media: emptyMedia(candidate.media),
      pendingPhysicalFate: emptyMedia(candidate.pendingPhysicalFate),
      odorIndex: round(clamp(candidate.odorIndex, 0, 100), 3),
      receiver: { kind: cleanId(candidate.receiver?.kind), label: String(candidate.receiver?.label || ""), watershedId: String(candidate.receiver?.watershedId || "") },
      knowledge: {
        surfaceKnown: candidate.knowledge?.surfaceKnown !== false,
        odorKnown: Boolean(candidate.knowledge?.odorKnown),
        runoffKnown: Boolean(candidate.knowledge?.runoffKnown),
        subsurfaceKnown: Boolean(candidate.knowledge?.subsurfaceKnown),
        learnedAt: candidate.knowledge?.learnedAt == null ? null : Math.max(0, Number(candidate.knowledge.learnedAt) || 0)
      },
      createdAt: Math.max(0, Number(candidate.createdAt) || 0),
      updatedAt: Math.max(0, Number(candidate.updatedAt ?? candidate.createdAt) || 0),
      lastWeatherDigest: String(candidate.lastWeatherDigest || ""),
      history: normalizeHistory(candidate.history)
    };
  }

  function createState(context, seed, clock = 0) {
    const state = {
      contextDigest: String(context?.digest || ""),
      weatherSeed: String(seed || "surface-weather"),
      weatherDays: [],
      weatherGeneratedThroughDay: -1,
      drainage: drainageRecord(context, seed),
      records: [],
      nextRecordNumber: 1,
      lastAdvancedAt: Math.max(0, Number(clock) || 0)
    };
    return ensureWeatherDays(state, context, clock);
  }

  function normalizeState(candidate, context, seed, clock = 0) {
    if (!candidate || typeof candidate !== "object" || candidate.contextDigest !== String(context?.digest || "")) return createState(context, seed, clock);
    const records = (Array.isArray(candidate.records) ? candidate.records : []).map(normalizeRecord).filter(Boolean);
    const state = {
      contextDigest: String(context?.digest || ""),
      weatherSeed: String(candidate.weatherSeed || seed || "surface-weather"),
      weatherDays: (Array.isArray(candidate.weatherDays) ? candidate.weatherDays : []).map((entry) => ({ ...entry })).filter((entry) => Number.isInteger(entry.dayIndex)),
      weatherGeneratedThroughDay: Math.floor(Number(candidate.weatherGeneratedThroughDay) || -1),
      drainage: candidate.drainage && typeof candidate.drainage === "object" ? { ...drainageRecord(context, seed), ...candidate.drainage, exactAquiferQualityKnown: false } : drainageRecord(context, seed),
      records,
      nextRecordNumber: Math.max(Math.floor(Number(candidate.nextRecordNumber) || 1), records.reduce((maximum, record) => Math.max(maximum, Number(record.id.match(/(\d+)$/)?.[1] || 0) + 1), 1)),
      lastAdvancedAt: Math.max(0, Number(candidate.lastAdvancedAt ?? clock) || 0)
    };
    ensureWeatherDays(state, context, clock);
    assertState(state);
    return state;
  }

  function weatherAt(candidate, clock = 0) {
    const dayIndex = Math.max(0, Math.floor(Math.max(0, Number(clock) || 0) / SECONDS_PER_DAY));
    return clone((candidate?.weatherDays || []).find((entry) => entry.dayIndex === dayIndex) || null);
  }
  function weatherForecast(candidate, clock = 0, count = 2) {
    const dayIndex = Math.max(0, Math.floor(Math.max(0, Number(clock) || 0) / SECONDS_PER_DAY));
    return clone((candidate?.weatherDays || []).filter((entry) => entry.dayIndex >= dayIndex).slice(0, Math.max(1, count)).map((entry) => {
      const leadDays = entry.dayIndex - dayIndex;
      return { ...entry, forecastConfidence: leadDays === 0 ? "current" : leadDays === 1 ? "high" : leadDays <= 3 ? "credible" : "broad" };
    }));
  }
  function applyWeatherAmbient(ambient, weather) {
    if (!weather) return clone(ambient);
    return {
      ...clone(ambient),
      temperatureC: round(Number(ambient?.temperatureC) + Number(weather.temperatureOffsetC), 1),
      humidity: round(clamp(Number(ambient?.humidity) + Number(weather.humidityBonus), 0, 100), 1),
      weather: clone(weather)
    };
  }

  function receiverFor(state, candidate = {}) {
    if (candidate.medium === "airborne" || candidate.phase === "vapor") {
      return { kind: "downwindAir", label: "downwind exterior air", watershedId: "" };
    }
    if (candidate.medium === "drainage") {
      return { kind: state.drainage.outletKind, label: state.drainage.outletLabel, watershedId: state.drainage.watershedId };
    }
    return { kind: "parcelBoundary", label: `${state.drainage.outletLabel} and downwind exterior air`, watershedId: state.drainage.watershedId };
  }
  function findRecord(state, candidate) {
    const key = String(candidate.coalesceKey || "");
    return key ? state.records.find((record) => record.coalesceKey === key) || null : null;
  }
  function ensureReleaseRecord(state, candidate, clock) {
    let record = findRecord(state, candidate);
    if (record) return record;
    const createdAt = Math.max(clock, Number(candidate.createdAt) || 0);
    record = normalizeRecord({
      ...candidate,
      id: `surface-exposure-${state.nextRecordNumber++}`,
      receiver: receiverFor(state, candidate),
      createdAt,
      updatedAt: createdAt,
      releasedAmount: 0,
      media: {},
      knowledge: { surfaceKnown: candidate.knowledge?.surfaceKnown !== false, learnedAt: candidate.knowledge?.surfaceKnown === false ? null : createdAt },
      history: [{ at: createdAt, action: "sourceRecorded", details: `${candidate.label || "Material"} acquired a saved surface-fate record.` }]
    }, state.records.length);
    state.records.push(record);
    return record;
  }

  function registerRelease(candidate, context, release) {
    const normalizationClock = Math.max(Number(release.clock) || 0, Number(candidate?.lastAdvancedAt) || 0);
    const state = normalizeState(candidate, context, release.seed || candidate?.weatherSeed, normalizationClock);
    const amount = round(Math.max(0, Number(release.amount) || 0));
    if (!amount || !cleanCell(release.cell)) return { state, record: null };
    const releaseAt = Math.max(0, Number(release.clock ?? state.lastAdvancedAt) || 0);
    const record = ensureReleaseRecord(state, release, releaseAt);
    const medium = release.medium === "airborne" ? "airborne" : release.medium === "drainage" ? "drainage" : "surface";
    record.media[medium] = round(record.media[medium] + amount);
    record.releasedAmount = round(record.releasedAmount + amount);
    record.updatedAt = Math.max(record.updatedAt, releaseAt);
    record.knowledge.odorKnown ||= medium === "airborne" && materialProfile(record).odor > 0.25;
    record.knowledge.runoffKnown ||= medium === "drainage";
    record.history.push({ at: record.updatedAt, action: "released", details: `${round(amount, 3)} units entered ${medium}.` });
    record.history = record.history.slice(-32);
    return { state, record: clone(record) };
  }

  function activeMediaTotal(record) {
    return ["surface", "subsurface", "drainage", "airborne", "offsite"].reduce((total, key) => total + (Number(record?.media?.[key]) || 0), 0);
  }
  function recordConservation(record) {
    const accounted = MEDIA_KEYS.reduce((total, key) => total + (Number(record?.media?.[key]) || 0), 0);
    return { released: round(record?.releasedAmount), accounted: round(accounted), difference: round((Number(record?.releasedAmount) || 0) - accounted) };
  }
  function addMedium(record, key, amount) { record.media[key] = round(record.media[key] + Math.max(0, amount)); }
  function moveMedium(record, from, allocations) {
    const requested = Object.values(allocations).reduce((total, value) => total + Math.max(0, Number(value) || 0), 0);
    const amount = Math.min(record.media[from], requested);
    if (amount <= 0 || requested <= 0) return 0;
    record.media[from] = round(record.media[from] - amount);
    for (const [to, value] of Object.entries(allocations)) addMedium(record, to, amount * Math.max(0, Number(value) || 0) / requested);
    return amount;
  }

  function advance(candidate, context, options = {}) {
    const savedFromClock = Math.max(0, Number(candidate?.lastAdvancedAt) || 0);
    const fromClock = savedFromClock;
    const requestedToClock = Math.max(fromClock, Number(options.toClock ?? fromClock) || fromClock);
    const toClock = fromClock + Math.floor((requestedToClock - fromClock) / FATE_STEP_SECONDS) * FATE_STEP_SECONDS;
    const state = normalizeState(candidate, context, options.seed || candidate?.weatherSeed, fromClock);
    ensureWeatherDays(state, context, requestedToClock);
    if (toClock <= fromClock) return { state, effects: { stackLosses: {}, tileEffects: [], changedRecordIds: [] } };
    const spills = (options.spills || []).filter((entry) => cleanCell(entry.cell) && Number(entry.amount) > 0);
    const activeStackIds = new Set(spills.map((entry) => entry.stackId));
    for (const record of state.records) {
      if (record.source.kind === "physicalStack" && !activeStackIds.has(record.source.id)) record.pendingPhysicalFate = emptyMedia();
    }
    const available = new Map(spills.map((entry) => [entry.stackId, Math.max(0, Number(entry.amount) || 0)]));
    const stackLosses = {};
    const tileEffects = {};
    const changedRecordIds = new Set();
    for (const spill of spills) ensureReleaseRecord(state, { ...spill, coalesceKey: spill.coalesceKey || `physical-spill:${spill.stackId}`, source: { kind: "physicalStack", id: spill.stackId, label: spill.label } }, fromClock);
    let cursor = fromClock;
    while (cursor < toClock) {
      const untilWeatherBoundary = SECONDS_PER_DAY - cursor % SECONDS_PER_DAY || SECONDS_PER_DAY;
      const stepSeconds = Math.min(toClock - cursor, FATE_STEP_SECONDS, untilWeatherBoundary);
      const hours = stepSeconds / SECONDS_PER_HOUR;
      const weather = options.weatherOverride || weatherAt(state, cursor) || weatherDay(context, state.weatherSeed, Math.floor(cursor / SECONDS_PER_DAY));
      const rainRate = weather.kind === "rain" ? Math.max(0, Number(weather.precipitationMm) || 0) / 24 : 0;
      const wind = clamp(weather.windStrengthPercent, 0, 100) / 100;
      for (const spill of spills) {
        const amount = available.get(spill.stackId) || 0;
        if (amount <= 0) continue;
        const record = findRecord(state, { coalesceKey: spill.coalesceKey || `physical-spill:${spill.stackId}` });
        if (!record) continue;
        if (spill.knowledge?.surfaceKnown && !record.knowledge.surfaceKnown) {
          record.knowledge.surfaceKnown = true;
          record.knowledge.learnedAt = cursor;
        }
        const spillHours = Math.max(0, cursor + stepSeconds - Math.max(cursor, Number(spill.createdAt ?? record.createdAt) || 0)) / SECONDS_PER_HOUR;
        if (spillHours <= 0) continue;
        const material = materialProfile(spill);
        const terrain = terrainProfile(spill.terrainId);
        const exposure = spill.openSky === false ? 0.18 : spill.exposureKind === "coveredExterior" ? 0.55 : 1;
        const absorb = Math.min(amount * 0.35, amount * material.adhesion * terrain.absorption * 0.008 * spillHours * exposure);
        const rainMoved = Math.min(amount * 0.55, amount * material.waterMobility * rainRate * 0.015 * spillHours * exposure);
        const airMoved = Math.min(amount * 0.35, amount * material.airMobility * wind * 0.012 * spillHours * exposure);
        const transformed = Math.min(amount * 0.12, amount * (0.00035 + Math.max(0, Number(weather.temperatureOffsetC)) * 0.00008) * spillHours * exposure);
        const total = Math.min(amount * 0.82, absorb + rainMoved + airMoved + transformed);
        if (total <= 0) continue;
        const scale = total / Math.max(0.000001, absorb + rainMoved + airMoved + transformed);
        const absorbedAmount = absorb * scale;
        const rainAmount = rainMoved * scale;
        const airAmount = airMoved * scale;
        const transformedAmount = transformed * scale;
        const pendingAllocations = {
          surface: absorbedAmount,
          subsurface: rainAmount * terrain.infiltration / Math.max(0.01, terrain.infiltration + terrain.runoff),
          drainage: rainAmount * terrain.runoff / Math.max(0.01, terrain.infiltration + terrain.runoff) * 0.45,
          offsite: rainAmount * terrain.runoff / Math.max(0.01, terrain.infiltration + terrain.runoff) * 0.55 + airAmount * 0.68,
          airborne: airAmount * 0.32,
          transformed: transformedAmount
        };
        for (const [medium, pending] of Object.entries(pendingAllocations)) {
          record.pendingPhysicalFate[medium] = round(record.pendingPhysicalFate[medium] + pending, 9);
        }
        const pendingTotal = Object.values(record.pendingPhysicalFate).reduce((sum, pending) => sum + pending, 0);
        const released = Math.min(Math.floor(amount + 1e-9), Math.floor(pendingTotal + 1e-9));
        if (released <= 0) continue;
        const releasedAllocations = {};
        for (const medium of MEDIA_KEYS) {
          const pending = record.pendingPhysicalFate[medium];
          const releasedAmount = pending * released / pendingTotal;
          releasedAllocations[medium] = releasedAmount;
          record.pendingPhysicalFate[medium] = round(Math.max(0, pending - releasedAmount), 9);
          addMedium(record, medium, releasedAmount);
        }
        record.releasedAmount = round(record.releasedAmount + released);
        record.lastWeatherDigest = weather.digest || "weather-override";
        record.updatedAt = cursor + stepSeconds;
        record.odorIndex = round(clamp(record.odorIndex + (released + record.media.airborne) * material.odor * exposure * 0.08, 0, 100), 3);
        record.knowledge.odorKnown ||= record.odorIndex >= 0.5;
        record.knowledge.runoffKnown ||= record.media.drainage >= 1 && record.knowledge.surfaceKnown;
        available.set(spill.stackId, Math.max(0, amount - released));
        stackLosses[spill.stackId] = round((stackLosses[spill.stackId] || 0) + released);
        const key = cellKey(spill.cell);
        tileEffects[key] ||= { cell: cleanCell(spill.cell), airborne: 0, trace: 0, substanceId: cleanId(spill.substanceId || spill.key) || "surface-residue" };
        tileEffects[key].airborne = round(tileEffects[key].airborne + releasedAllocations.airborne);
        tileEffects[key].trace = round(tileEffects[key].trace + releasedAllocations.surface + releasedAllocations.drainage * 0.12);
        changedRecordIds.add(record.id);
      }
      for (const record of state.records) {
        const recordHours = Math.max(0, cursor + stepSeconds - Math.max(cursor, record.createdAt)) / SECONDS_PER_HOUR;
        if (recordHours <= 0) continue;
        const material = materialProfile(record);
        const terrain = terrainProfile(record.terrainId);
        const rainFraction = clamp(rainRate * material.waterMobility * recordHours * 0.008 * (record.openSky ? 1 : 0.2), 0, 0.35);
        if (record.media.surface > 0 && rainFraction > 0) {
          const moved = record.media.surface * rainFraction;
          moveMedium(record, "surface", { subsurface: moved * terrain.infiltration, drainage: moved * terrain.runoff * 0.45, offsite: moved * terrain.runoff * 0.55 });
          if (moved > 0.001) changedRecordIds.add(record.id);
        }
        if (record.media.airborne > 0) {
          const dispersed = record.media.airborne * clamp(wind * recordHours * 0.05, 0, 0.75);
          moveMedium(record, "airborne", { offsite: dispersed });
          if (dispersed > 0.001) changedRecordIds.add(record.id);
        }
        const transformFraction = clamp(recordHours * 0.00025, 0, 0.08);
        for (const medium of ["surface", "subsurface", "drainage", "airborne"]) {
          const amount = record.media[medium] * transformFraction;
          if (amount > 0) {
            moveMedium(record, medium, { transformed: amount });
            if (amount > 0.001) changedRecordIds.add(record.id);
          }
        }
        record.odorIndex = round(record.odorIndex * Math.exp(-recordHours * (weather.kind === "windy" ? 0.14 : 0.045)), 3);
      }
      cursor += stepSeconds;
    }
    for (const record of state.records.filter((entry) => changedRecordIds.has(entry.id))) {
      record.updatedAt = toClock;
      record.history.push({ at: toClock, action: "weathered", details: `${weatherAt(state, Math.max(fromClock, toClock - 1))?.label || "Weather"} moved or transformed this release; provenance retained.` });
      record.history = record.history.slice(-32);
    }
    state.lastAdvancedAt = toClock;
    assertState(state);
    return { state, effects: { stackLosses, tileEffects: Object.values(tileEffects), changedRecordIds: [...changedRecordIds] } };
  }

  function remediationPlan(record) {
    const terrain = terrainProfile(record?.terrainId);
    return terrain.remediation === "excavate"
      ? { id: "excavate", label: "Excavate and bag contaminated surface", receptacleItemKey: "filterBag", washRequired: false, scraperRequired: true, surfaceFraction: 0.76, subsurfaceFraction: 0.18 }
      : { id: "neutralize", label: "Neutralize and collect surface trace", receptacleItemKey: "linedScrapeJar", washRequired: true, scraperRequired: true, surfaceFraction: 0.88, subsurfaceFraction: 0 };
  }
  function remediate(candidate, context, recordId, options = {}) {
    const normalizationClock = Math.max(Number(options.clock) || 0, Number(candidate?.lastAdvancedAt) || 0);
    const state = normalizeState(candidate, context, options.seed || candidate?.weatherSeed, normalizationClock);
    const record = state.records.find((entry) => entry.id === recordId);
    if (!record) return { state, record: null, removedAmount: 0, plan: null };
    const plan = remediationPlan(record);
    const desiredSurface = record.media.surface * plan.surfaceFraction;
    const desiredSubsurface = record.media.subsurface * plan.subsurfaceFraction;
    const desiredTotal = desiredSurface + desiredSubsurface;
    const maximum = Math.max(0, Number(options.maxAmount) || desiredTotal);
    const scale = desiredTotal > 0 ? Math.min(1, maximum / desiredTotal) : 0;
    const surfaceRemoved = desiredSurface * scale;
    const subsurfaceRemoved = desiredSubsurface * scale;
    const removedAmount = round(surfaceRemoved + subsurfaceRemoved);
    record.media.surface = round(record.media.surface - surfaceRemoved);
    record.media.subsurface = round(record.media.subsurface - subsurfaceRemoved);
    record.media.removed = round(record.media.removed + removedAmount);
    record.updatedAt = Math.max(record.updatedAt, Number(options.clock) || state.lastAdvancedAt);
    if (subsurfaceRemoved >= 0.1) record.knowledge.subsurfaceKnown = true;
    record.history.push({ at: record.updatedAt, action: plan.id, details: `${round(removedAmount, 3)} units captured as physical successor waste; remaining contamination was not deleted.` });
    record.history = record.history.slice(-32);
    assertState(state);
    return { state, record: clone(record), removedAmount, plan };
  }

  function projectRecord(record) {
    if (!record?.knowledge?.surfaceKnown) return null;
    const material = materialProfile(record);
    const terrain = terrainProfile(record.terrainId);
    const visibleAmount = record.media.surface + (record.knowledge.runoffKnown ? record.media.drainage : 0);
    const knownActiveAmount = visibleAmount
      + (record.knowledge.odorKnown ? record.media.airborne : 0)
      + (record.knowledge.subsurfaceKnown ? record.media.subsurface : 0);
    return {
      id: record.id,
      label: record.label,
      cell: clone(record.cell),
      roomId: record.roomId,
      terrain: terrain.label,
      visibleBand: band(visibleAmount),
      odorBand: record.knowledge.odorKnown ? band(record.odorIndex) : "noneKnown",
      runoffStatus: record.knowledge.runoffKnown ? `${band(record.media.drainage)} observed drainage trace` : "No observed drainage trace",
      subsurfaceStatus: record.knowledge.subsurfaceKnown ? `${band(record.media.subsurface)} confirmed subsurface contamination` : material.waterMobility * terrain.infiltration >= 0.18 ? "Infiltration possible; unsampled" : "Subsurface condition unsampled",
      active: knownActiveAmount > 0.000001,
      remediation: remediationPlan(record),
      remediationAvailable: record.media.surface > 0.000001 || record.knowledge.subsurfaceKnown && record.media.subsurface > 0.000001,
      sourceLabel: record.source.label,
      updatedAt: record.updatedAt
    };
  }
  function knownProjection(candidate, clock = 0) {
    const records = (candidate?.records || []).map(projectRecord).filter(Boolean).filter((record) => record.active);
    const knownSurfaceBurden = records.reduce((total, projection) => total + ({ none: 0, trace: 0.25, small: 1, moderate: 3, large: 8, extensive: 20 }[projection.visibleBand] || 0), 0);
    return {
      weather: weatherAt(candidate, clock),
      forecast: weatherForecast(candidate, clock, 2),
      drainage: clone(candidate?.drainage),
      records,
      knownSurfaceBurden,
      conditionBand: band(knownSurfaceBurden),
      aquiferStatement: candidate?.drainage?.exactAquiferQualityKnown ? "Aquifer sampling recorded" : "Hidden aquifer quality remains unknown"
    };
  }

  function assertState(state) {
    if (!state || typeof state !== "object" || !Array.isArray(state.records) || !Array.isArray(state.weatherDays)) throw new Error("Surface exposure state is invalid.");
    const ids = new Set();
    for (const record of state.records) {
      if (!record.id || ids.has(record.id)) throw new Error("Surface exposure record identities are invalid.");
      ids.add(record.id);
      const conservation = recordConservation(record);
      if (Math.abs(conservation.difference) > 0.002) throw new Error(`Surface exposure mass is not conserved for ${record.id}.`);
    }
    if (state.drainage?.exactAquiferQualityKnown) throw new Error("Surface context cannot reveal exact aquifer quality without a future sampling result.");
    return state;
  }

  function validateState(state) { return clone(assertState(state)); }

  return Object.freeze({
    SECONDS_PER_HOUR, SECONDS_PER_DAY, FATE_STEP_SECONDS, WEATHER_KINDS, TERRAIN_PROFILES, PHASE_PROFILES, MEDIA_KEYS,
    createState, normalizeState, validateState, weatherAt, weatherForecast, applyWeatherAmbient,
    terrainProfile, materialProfile, registerRelease, advance, remediate, remediationPlan,
    knownProjection, activeMediaTotal, recordConservation, band, clone
  });
});
