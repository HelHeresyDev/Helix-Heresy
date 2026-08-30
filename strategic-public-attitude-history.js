(function initStrategicPublicAttitudeHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicCityLaws = typeof module === "object" && module.exports ? require("./strategic-city-laws") : root?.HelixStrategicCityLaws;
  const strategicCrisisHistory = typeof module === "object" && module.exports ? require("./strategic-crisis-history") : root?.HelixStrategicCrisisHistory;
  const strategicPoliticalHistory = typeof module === "object" && module.exports ? require("./strategic-political-history") : root?.HelixStrategicPoliticalHistory;
  const strategicCivicHistory = typeof module === "object" && module.exports ? require("./strategic-civic-history") : root?.HelixStrategicCivicHistory;
  const strategicLegalHistory = typeof module === "object" && module.exports ? require("./strategic-legal-history") : root?.HelixStrategicLegalHistory;
  const api = factory(strategicWorld, strategicCityLaws, strategicCrisisHistory, strategicPoliticalHistory, strategicCivicHistory, strategicLegalHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicPublicAttitudeHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicPublicAttitudeHistoryApi(StrategicWorld, StrategicCityLaws, StrategicCrisisHistory, StrategicPoliticalHistory, StrategicCivicHistory, StrategicLegalHistory) {
  "use strict";

  if (!StrategicWorld || !StrategicCityLaws || !StrategicCrisisHistory || !StrategicPoliticalHistory || !StrategicCivicHistory || !StrategicLegalHistory) throw new Error("World, city-law, crisis, political, civic, and legal-history modules must load before strategic-public-attitude-history.js");

  const PRESSURE_CHANNELS = Object.freeze(["regulationSupport", "reportingCooperation", "proceduralRightsConcern", "punitivePressure", "nonharmfulTolerance"]);
  const PRESSURE_BANDS = Object.freeze(["minimal", "low", "mixed", "high", "intense"]);
  const OBSERVATION_CONFIDENCE_BANDS = Object.freeze(["uncertain", "fragmentary", "credible", "wellDocumented"]);
  const EVENT_KINDS = Object.freeze(["crisisReaction", "occupationReaction", "revoltReaction", "restorationReaction", "institutionalTrustShift", "legalAmendmentReaction", "directiveReaction"]);
  const JUSTICE_OFFENSES = Object.freeze(["warrantObstruction", "violentResistance", "custodyEscape", "failureToAppear", "evidenceTampering", "falseStatement"]);
  const CRISIS_OFFENSES = Object.freeze(["criticalInfrastructureSabotage", "emergencyInterference", "hazardousBiologicalConduct", "aidingBeastAttack"]);
  const BASELINE_BY_ATTITUDE = Object.freeze({
    strongSupport: Object.freeze({ regulationSupport: 4, reportingCooperation: 3, proceduralRightsConcern: 2, punitivePressure: 3, nonharmfulTolerance: 0 }),
    support: Object.freeze({ regulationSupport: 3, reportingCooperation: 3, proceduralRightsConcern: 2, punitivePressure: 2, nonharmfulTolerance: 1 }),
    divided: Object.freeze({ regulationSupport: 2, reportingCooperation: 2, proceduralRightsConcern: 2, punitivePressure: 2, nonharmfulTolerance: 2 }),
    resented: Object.freeze({ regulationSupport: 1, reportingCooperation: 1, proceduralRightsConcern: 3, punitivePressure: 1, nonharmfulTolerance: 3 }),
    opposed: Object.freeze({ regulationSupport: 0, reportingCooperation: 1, proceduralRightsConcern: 3, punitivePressure: 0, nonharmfulTolerance: 4 })
  });

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }
  function shiftBand(band, delta) { return PRESSURE_BANDS[Math.max(0, Math.min(PRESSURE_BANDS.length - 1, PRESSURE_BANDS.indexOf(band) + delta))]; }
  function publicLabel(value) { return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(); }

  function validateSources(map) {
    // Legal-history validation already verifies the city-law, crisis, political,
    // and civic records it consumes. Revalidating those layers independently
    // here would repeat several full-map digest passes during every preview.
    StrategicLegalHistory.validateStrategicLegalHistory(map);
    return map;
  }

  function sourceMaps(map) {
    return {
      cityById: new Map(map.humanGeography.cities.map((city) => [city.id, city])),
      crisisById: new Map(map.strategicCrisisHistory.eventRows.map((event) => [event.id, event])),
      politicalById: new Map(map.strategicPoliticalHistory.eventRows.map((event) => [event.id, event])),
      civicById: new Map(map.strategicCivicHistory.eventRows.map((event) => [event.id, event])),
      amendmentById: new Map(map.strategicLegalHistory.amendmentRows.map((event) => [event.id, event])),
      directiveById: new Map(map.strategicLegalHistory.directiveRows.map((event) => [event.id, event]))
    };
  }

  function baselineProfiles(map, seed) {
    return StrategicCityLaws.publicCityLawDirectory(map).flatMap((code) => code.offenseRules.map((rule) => {
      const baseline = BASELINE_BY_ATTITUDE[rule.publicAttitude] || BASELINE_BY_ATTITUDE.divided;
      const pressures = {};
      for (const channel of PRESSURE_CHANNELS) {
        const jitter = seededNumber(seed, `founding-pressure:${code.city.id}:${rule.offenseId}:${channel}`) < 0.2 ? (seededNumber(seed, `founding-direction:${code.city.id}:${rule.offenseId}:${channel}`) < 0.5 ? -1 : 1) : 0;
        pressures[channel] = PRESSURE_BANDS[Math.max(0, Math.min(PRESSURE_BANDS.length - 1, baseline[channel] + jitter))];
      }
      return {
        cityId: code.city.id,
        offenseId: rule.offenseId,
        offenseFamily: rule.family,
        foundingPublicAttitude: rule.publicAttitude,
        pressures,
        aggregatePressureNotPopulationConsensus: true,
        changesRecognizedLaw: false,
        establishesGuilt: false
      };
    }));
  }

  function sourceFor(source, layer, id) {
    if (layer === "crisisHistory") return source.crisisById.get(id);
    if (layer === "politicalHistory") return source.politicalById.get(id);
    if (layer === "civicHistory") return source.civicById.get(id);
    if (layer === "legalAmendment") return source.amendmentById.get(id);
    if (layer === "legalDirective") return source.directiveById.get(id);
    return null;
  }

  function accountFor(kind, cityName, offenseLabels, raisedChannels, loweredChannels) {
    const subjects = offenseLabels.join(", ");
    const changes = [raisedChannels.length ? `${raisedChannels.map(publicLabel).join(", ")} pressure rose` : "", loweredChannels.length ? `${loweredChannels.map(publicLabel).join(", ")} pressure fell` : ""].filter(Boolean).join(" while ");
    if (kind === "crisisReaction") return `${cityName} recorded a sustained public reaction concerning ${subjects} after an ecological emergency; ${changes}.`;
    if (kind === "occupationReaction") return `${cityName} recorded changing cooperation and rights concerns around ${subjects} under overt occupation; ${changes}.`;
    if (kind === "revoltReaction") return `${cityName} recorded divided public pressure around ${subjects} during organized resistance; ${changes}.`;
    if (kind === "restorationReaction") return `${cityName} recorded renewed public pressure around ${subjects} after restoration of local charter control; ${changes}.`;
    if (kind === "institutionalTrustShift") return `${cityName} recorded changing trust-related pressure around ${subjects} following visible institutional disruption or reform; ${changes}.`;
    if (kind === "legalAmendmentReaction") return `${cityName} recorded a public reaction to a prospective legal or procedural amendment affecting ${subjects}; ${changes}.`;
    return `${cityName} recorded a public reaction to a temporary directive affecting ${subjects}; ${changes}.`;
  }

  function createStrategicPublicAttitudeHistory(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for public-attitude history.");
    const strategicMap = validateSources(map);
    if (strategicMap.strategicPublicAttitudeHistory || strategicMap.publicAttitudeHistoryDirectory) throw new Error("Strategic public-attitude history already exists on this world.");
    const source = sourceMaps(strategicMap);
    const offenseById = new Map(StrategicCityLaws.OFFENSE_CATALOG.map((offense) => [offense.id, offense]));
    const baselineRows = baselineProfiles(strategicMap, seed);
    const currentByKey = new Map(baselineRows.map((row) => [`${row.cityId}:${row.offenseId}`, clone(row)]));
    const eventRows = [];
    const eventCandidates = [];
    let ordinal = 1;

    function queueEvent(candidate) { eventCandidates.push(candidate); }

    function applyEvent({ year, kind, cityId, sourceLayer, sourceEvent, offenseIds, channelShifts, publicCause }) {
      const city = source.cityById.get(cityId);
      const validOffenseIds = [...new Set(offenseIds)].filter((id) => offenseById.has(id));
      if (!city || !validOffenseIds.length) return;
      const stateDeltas = [];
      for (const offenseId of validOffenseIds) {
        const profile = currentByKey.get(`${cityId}:${offenseId}`);
        for (const [channel, shift] of Object.entries(channelShifts)) {
          const previousBand = profile.pressures[channel];
          const resultingBand = shiftBand(previousBand, shift);
          if (previousBand === resultingBand) continue;
          profile.pressures[channel] = resultingBand;
          stateDeltas.push({ offenseId, channel, previousBand, resultingBand });
        }
      }
      if (!stateDeltas.length) return;
      const changedOffenseIds = [...new Set(stateDeltas.map((delta) => delta.offenseId))];
      const id = `public-attitude-event:${String(ordinal).padStart(3, "0")}`;
      ordinal += 1;
      const raisedChannels = [...new Set(stateDeltas.filter((delta) => PRESSURE_BANDS.indexOf(delta.resultingBand) > PRESSURE_BANDS.indexOf(delta.previousBand)).map((delta) => delta.channel))];
      const loweredChannels = [...new Set(stateDeltas.filter((delta) => PRESSURE_BANDS.indexOf(delta.resultingBand) < PRESSURE_BANDS.indexOf(delta.previousBand)).map((delta) => delta.channel))];
      eventRows.push({
        id,
        year,
        kind,
        cityId,
        sourceLayer,
        sourceEventId: sourceEvent.id,
        offenseIds: changedOffenseIds,
        cause: `${sourceLayer}:${sourceEvent.kind || sourceEvent.id}`,
        stateDeltas,
        exactFactors: { channelShifts: clone(channelShifts), publicCause, retainedBySeed: true },
        aggregatePressureNotPopulationConsensus: true,
        changesRecognizedLaw: false,
        establishesGuilt: false,
        changesEvidenceReliability: false,
        changesOffenseElements: false,
        publicProjection: {
          kind,
          affectedOffenseIds: changedOffenseIds,
          raisedChannels,
          loweredChannels,
          account: accountFor(kind, city.name, changedOffenseIds.map((offenseId) => offenseById.get(offenseId).label), raisedChannels, loweredChannels),
          uncertaintyAcknowledged: true
        },
        discoverableHooks: [...new Set([sourceEvent.id, ...(sourceEvent.discoverableHooks || [])])]
      });
    }

    for (const event of strategicMap.strategicCrisisHistory.eventRows) {
      for (const cityId of event.threatenedCityIds || []) {
        if (seededNumber(seed, `attitude-crisis:${event.id}:${cityId}`) >= 0.72) continue;
        const severe = ["cityBreach", "infrastructureBreach", "costlySurvival"].includes(event.outcome);
        queueEvent({ year: event.year, kind: "crisisReaction", cityId, sourceLayer: "crisisHistory", sourceEvent: event, offenseIds: CRISIS_OFFENSES, channelShifts: { regulationSupport: 1, reportingCooperation: 1, punitivePressure: severe ? 1 : 0, nonharmfulTolerance: -1 }, publicCause: event.outcome });
      }
    }

    for (const event of strategicMap.strategicPoliticalHistory.eventRows) {
      const cityId = event.location?.cityId;
      if (!cityId) continue;
      if (event.kind === "intercityCampaign" && event.outcome === "occupationEstablished") queueEvent({ year: event.year, kind: "occupationReaction", cityId, sourceLayer: "politicalHistory", sourceEvent: event, offenseIds: JUSTICE_OFFENSES, channelShifts: { reportingCooperation: -1, proceduralRightsConcern: 1, punitivePressure: -1, nonharmfulTolerance: 1 }, publicCause: "overtOccupation" });
      if (event.kind === "subjectRevolt") {
        queueEvent({ year: event.year, kind: "revoltReaction", cityId, sourceLayer: "politicalHistory", sourceEvent: event, offenseIds: JUSTICE_OFFENSES, channelShifts: { reportingCooperation: -1, proceduralRightsConcern: 1, nonharmfulTolerance: 1 }, publicCause: event.outcome });
        if (event.outcome === "sovereigntyRestored") queueEvent({ year: Math.min(strategicMap.strategicLegalHistory.historicalHorizonYear, event.year + 1), kind: "restorationReaction", cityId, sourceLayer: "politicalHistory", sourceEvent: event, offenseIds: JUSTICE_OFFENSES, channelShifts: { reportingCooperation: 1, proceduralRightsConcern: -1 }, publicCause: event.outcome });
      }
    }

    for (const event of strategicMap.strategicCivicHistory.eventRows) {
      if (!["crisisInstitutionalDamage", "emergencyReform", "appointmentReorganization", "charterRestoration"].includes(event.kind) || seededNumber(seed, `attitude-civic:${event.id}`) >= 0.62) continue;
      const improving = ["emergencyReform", "charterRestoration"].includes(event.kind);
      queueEvent({ year: event.year, kind: improving && event.kind === "charterRestoration" ? "restorationReaction" : "institutionalTrustShift", cityId: event.cityId, sourceLayer: "civicHistory", sourceEvent: event, offenseIds: event.kind === "emergencyReform" ? CRISIS_OFFENSES : JUSTICE_OFFENSES, channelShifts: improving ? { reportingCooperation: 1, proceduralRightsConcern: -1 } : { reportingCooperation: -1, proceduralRightsConcern: 1 }, publicCause: event.publicProjection?.kind || event.kind });
    }

    for (const amendment of strategicMap.strategicLegalHistory.amendmentRows) {
      let offenseIds;
      let channelShifts;
      if (amendment.kind === "offenseStatusAmendment") {
        offenseIds = [amendment.change.offenseId];
        const stricter = StrategicCityLaws.LEGAL_STATUSES.indexOf(amendment.change.resultingValue) < StrategicCityLaws.LEGAL_STATUSES.indexOf(amendment.change.previousValue);
        const supportive = seededNumber(seed, `amendment-reaction:${amendment.id}`) < 0.6;
        channelShifts = { regulationSupport: supportive ? 1 : -1, reportingCooperation: stricter && supportive ? 1 : -1, proceduralRightsConcern: stricter ? 1 : 0, nonharmfulTolerance: stricter ? -1 : 1 };
      } else if (amendment.kind === "procedureAmendment") {
        offenseIds = JUSTICE_OFFENSES;
        channelShifts = { proceduralRightsConcern: seededNumber(seed, `procedure-reaction:${amendment.id}`) < 0.5 ? -1 : 1, reportingCooperation: 1 };
      } else {
        offenseIds = ["unlawfulViolence", "homicide", "criticalInfrastructureSabotage", "aidingBeastAttack"];
        channelShifts = { punitivePressure: amendment.change.resultingValue > amendment.change.previousValue ? -1 : 1, proceduralRightsConcern: amendment.change.resultingValue > amendment.change.previousValue ? 1 : 0 };
      }
      queueEvent({ year: amendment.year, kind: "legalAmendmentReaction", cityId: amendment.cityId, sourceLayer: "legalAmendment", sourceEvent: amendment, offenseIds, channelShifts, publicCause: amendment.kind });
    }

    const directiveOffenses = {
      curfew: ["emergencyInterference", "warrantObstruction", "failureToAppear"],
      checkpointControl: ["warrantObstruction", "contrabandCommerce", "falseStatement"],
      movementRestriction: ["emergencyInterference", "warrantObstruction", "failureToAppear"],
      rationingOrder: ["emergencyInterference", "propertyOffenses", "fraudAndCorruption"],
      emergencySeizure: ["propertyOffenses", "warrantObstruction"],
      weaponsControl: ["unlawfulViolence", "prohibitedMagic", "warrantObstruction"]
    };
    for (const directive of strategicMap.strategicLegalHistory.directiveRows) {
      if (seededNumber(seed, `directive-reaction:${directive.id}`) >= 0.5) continue;
      queueEvent({ year: directive.year, kind: "directiveReaction", cityId: directive.cityId, sourceLayer: "legalDirective", sourceEvent: directive, offenseIds: directiveOffenses[directive.kind] || JUSTICE_OFFENSES, channelShifts: { proceduralRightsConcern: 1, reportingCooperation: directive.authorityBasis === "overtOccupationDirection" ? -1 : 0, nonharmfulTolerance: 1 }, publicCause: directive.kind });
    }

    eventCandidates.sort((left, right) => left.year - right.year || left.sourceLayer.localeCompare(right.sourceLayer) || left.sourceEvent.id.localeCompare(right.sourceEvent.id) || left.kind.localeCompare(right.kind));
    for (const candidate of eventCandidates) applyEvent(candidate);
    const currentProfileRows = [...currentByKey.values()].sort((left, right) => left.cityId.localeCompare(right.cityId) || left.offenseId.localeCompare(right.offenseId));
    const eventCountByKey = new Map();
    for (const event of eventRows) for (const offenseId of event.offenseIds) eventCountByKey.set(`${event.cityId}:${offenseId}`, (eventCountByKey.get(`${event.cityId}:${offenseId}`) || 0) + 1);
    const publicProfiles = currentProfileRows.map((row) => {
      const eventCount = eventCountByKey.get(`${row.cityId}:${row.offenseId}`) || 0;
      return { ...clone(row), observationConfidence: OBSERVATION_CONFIDENCE_BANDS[Math.min(3, eventCount)], retainedShiftCount: eventCount, uncertaintyAcknowledged: true };
    });
    const record = {
      historicalHorizonYear: strategicMap.strategicLegalHistory.historicalHorizonYear,
      sourceCityLegalCodesDigest: strategicMap.cityLegalCodes.digest,
      sourceLegalHistoryDigest: strategicMap.strategicLegalHistory.digest,
      sourceCrisisHistoryDigest: strategicMap.strategicCrisisHistory.digest,
      sourcePoliticalHistoryDigest: strategicMap.strategicPoliticalHistory.digest,
      sourceCivicHistoryDigest: strategicMap.strategicCivicHistory.digest,
      offenseCatalogDigest: StrategicWorld.stableHash(StrategicCityLaws.OFFENSE_CATALOG),
      pressureChannels: [...PRESSURE_CHANNELS],
      baselineProfileRows: baselineRows,
      eventRows,
      currentProfileRows,
      principles: {
        aggregatePressureNotPopulationConsensus: true,
        attitudesNeverChangeLawAutomatically: true,
        attitudesNeverEstablishGuilt: true,
        reportingDoesNotDetermineTruth: true,
        punitivePressureCannotBypassSentencing: true,
        worldThemeIsNotAnAttitudeScore: true
      },
      diagnostics: {
        cityCount: strategicMap.humanGeography.cities.length,
        offenseCount: StrategicCityLaws.OFFENSE_CATALOG.length,
        profileCount: currentProfileRows.length,
        retainedEventCount: eventRows.length,
        crisisReactionCount: eventRows.filter((event) => event.kind === "crisisReaction").length,
        occupationReactionCount: eventRows.filter((event) => event.kind === "occupationReaction").length,
        legalReactionCount: eventRows.filter((event) => ["legalAmendmentReaction", "directiveReaction"].includes(event.kind)).length
      }
    };
    record.digest = `strategic-public-attitude-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    const publicDirectory = {
      sourcePublicAttitudeHistoryDigest: record.digest,
      historicalHorizonYear: record.historicalHorizonYear,
      knowledgePolicy: "coarseObservedPressureWithExactFactorsAndHiddenCausesRedacted",
      pressureChannels: [...PRESSURE_CHANNELS],
      currentProfileRows: publicProfiles,
      chronology: eventRows.map((event) => ({ id: event.id, year: event.year, kind: event.publicProjection.kind, cityId: event.cityId, affectedOffenseIds: clone(event.publicProjection.affectedOffenseIds), raisedChannels: clone(event.publicProjection.raisedChannels), loweredChannels: clone(event.publicProjection.loweredChannels), account: event.publicProjection.account, uncertaintyAcknowledged: true, changesRecognizedLaw: false, establishesGuilt: false })),
      principles: clone(record.principles)
    };
    publicDirectory.digest = `public-attitude-history-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    return { strategicPublicAttitudeHistory: record, publicDirectory };
  }

  function validateStrategicPublicAttitudeHistory(map, record = map?.strategicPublicAttitudeHistory, directory = map?.publicAttitudeHistoryDirectory) {
    const strategicMap = validateSources(map);
    if (!record || !directory || record.sourceCityLegalCodesDigest !== strategicMap.cityLegalCodes.digest || record.sourceLegalHistoryDigest !== strategicMap.strategicLegalHistory.digest || record.sourceCrisisHistoryDigest !== strategicMap.strategicCrisisHistory.digest || record.sourcePoliticalHistoryDigest !== strategicMap.strategicPoliticalHistory.digest || record.sourceCivicHistoryDigest !== strategicMap.strategicCivicHistory.digest || record.offenseCatalogDigest !== StrategicWorld.stableHash(StrategicCityLaws.OFFENSE_CATALOG)) throw new Error("Public-attitude history does not match its legal or historical sources.");
    const source = sourceMaps(strategicMap);
    const expectedKeys = new Set(strategicMap.humanGeography.cities.flatMap((city) => StrategicCityLaws.OFFENSE_CATALOG.map((offense) => `${city.id}:${offense.id}`)));
    const profileKey = (row) => `${row.cityId}:${row.offenseId}`;
    for (const rows of [record.baselineProfileRows, record.currentProfileRows]) {
      if (!Array.isArray(rows) || rows.length !== expectedKeys.size || new Set(rows.map(profileKey)).size !== expectedKeys.size || rows.some((row) => !expectedKeys.has(profileKey(row)) || PRESSURE_CHANNELS.some((channel) => !PRESSURE_BANDS.includes(row.pressures?.[channel])) || !row.aggregatePressureNotPopulationConsensus || row.changesRecognizedLaw || row.establishesGuilt)) throw new Error("Every city and offense must have one bounded non-consensus public-pressure profile.");
    }
    const replay = new Map(record.baselineProfileRows.map((row) => [profileKey(row), clone(row)]));
    const eventIds = new Set();
    for (const [index, event] of record.eventRows.entries()) {
      const sourceEvent = sourceFor(source, event.sourceLayer, event.sourceEventId);
      const sourceMatchesCity = event.sourceLayer === "crisisHistory" ? sourceEvent?.threatenedCityIds?.includes(event.cityId) : sourceEvent?.cityId === event.cityId || sourceEvent?.location?.cityId === event.cityId;
      const sourceYearMatches = event.year === sourceEvent?.year || event.kind === "restorationReaction" && event.year === Math.min(record.historicalHorizonYear, sourceEvent.year + 1);
      if (eventIds.has(event.id) || !EVENT_KINDS.includes(event.kind) || !sourceEvent || !sourceMatchesCity || !sourceYearMatches || !source.cityById.has(event.cityId) || !Number.isInteger(event.year) || event.year < 0 || event.year > record.historicalHorizonYear || (index && event.year < record.eventRows[index - 1].year) || !event.offenseIds.length || event.offenseIds.some((offenseId) => !expectedKeys.has(`${event.cityId}:${offenseId}`)) || !event.stateDeltas.length || !event.aggregatePressureNotPopulationConsensus || event.changesRecognizedLaw || event.establishesGuilt || event.changesEvidenceReliability || event.changesOffenseElements) throw new Error("A public-attitude event lacks a valid saved cause, chronology, bounded pressure change, or legal boundary.");
      for (const delta of event.stateDeltas) {
        const profile = replay.get(`${event.cityId}:${delta.offenseId}`);
        if (!PRESSURE_CHANNELS.includes(delta.channel) || !PRESSURE_BANDS.includes(delta.previousBand) || !PRESSURE_BANDS.includes(delta.resultingBand) || profile.pressures[delta.channel] !== delta.previousBand || delta.previousBand === delta.resultingBand) throw new Error("A public-attitude event does not follow the previously saved pressure profile.");
        profile.pressures[delta.channel] = delta.resultingBand;
      }
      eventIds.add(event.id);
    }
    const replayRows = [...replay.values()].sort((left, right) => left.cityId.localeCompare(right.cityId) || left.offenseId.localeCompare(right.offenseId));
    if (JSON.stringify(replayRows) !== JSON.stringify(record.currentProfileRows)) throw new Error("Playable-year public pressure does not match its retained history.");
    const publicJson = JSON.stringify(directory);
    if (/exactFactors|discoverableHooks|sourceEventId|sourceLayer|retainedBySeed|channelShifts/.test(publicJson)) throw new Error("The public attitude directory leaks exact or hidden causal factors.");
    if (directory.sourcePublicAttitudeHistoryDigest !== record.digest || directory.knowledgePolicy !== "coarseObservedPressureWithExactFactorsAndHiddenCausesRedacted" || directory.currentProfileRows.length !== record.currentProfileRows.length || directory.chronology.length !== record.eventRows.length || directory.currentProfileRows.some((row) => !OBSERVATION_CONFIDENCE_BANDS.includes(row.observationConfidence) || !row.uncertaintyAcknowledged || !row.aggregatePressureNotPopulationConsensus || row.changesRecognizedLaw || row.establishesGuilt) || directory.chronology.some((event) => !event.uncertaintyAcknowledged || event.changesRecognizedLaw || event.establishesGuilt)) throw new Error("The public attitude directory violates uncertainty, consensus, law, or guilt boundaries.");
    const canonicalCurrentByKey = new Map(record.currentProfileRows.map((row) => [profileKey(row), row]));
    if (directory.currentProfileRows.some((row) => {
      const canonical = canonicalCurrentByKey.get(profileKey(row));
      return !canonical || JSON.stringify(row.pressures) !== JSON.stringify(canonical.pressures) || row.foundingPublicAttitude !== canonical.foundingPublicAttitude || row.offenseFamily !== canonical.offenseFamily;
    })) throw new Error("The public attitude directory does not match the saved coarse playable-year pressures.");
    if (directory.chronology.some((entry, index) => {
      const canonical = record.eventRows[index];
      return entry.id !== canonical.id || entry.year !== canonical.year || entry.kind !== canonical.publicProjection.kind || entry.cityId !== canonical.cityId || JSON.stringify(entry.affectedOffenseIds) !== JSON.stringify(canonical.publicProjection.affectedOffenseIds) || entry.account !== canonical.publicProjection.account;
    })) throw new Error("The public attitude chronology does not match its knowledge-safe canonical projections.");
    if (record.digest !== `strategic-public-attitude-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}` || directory.digest !== `public-attitude-history-${StrategicWorld.stableHash(coreWithoutDigest(directory))}`) throw new Error("Public-attitude history does not match its digest.");
    if (record.diagnostics?.cityCount !== strategicMap.humanGeography.cities.length || record.diagnostics.offenseCount !== StrategicCityLaws.OFFENSE_CATALOG.length || record.diagnostics.profileCount !== expectedKeys.size || record.diagnostics.retainedEventCount !== record.eventRows.length) throw new Error("Public-attitude diagnostics do not match saved facts.");
    return { strategicPublicAttitudeHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicPublicAttitudeHistory(worldSeed, map) {
    const next = clone(map);
    const generated = createStrategicPublicAttitudeHistory(worldSeed, next);
    next.strategicPublicAttitudeHistory = generated.strategicPublicAttitudeHistory;
    next.publicAttitudeHistoryDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicAttitudeHistory(map) {
    if (!map?.publicAttitudeHistoryDirectory) return null;
    const directory = clone(map.publicAttitudeHistoryDirectory);
    const cityById = new Map(map.humanGeography.cities.map((city) => [city.id, city]));
    const offenseById = new Map(StrategicCityLaws.OFFENSE_CATALOG.map((offense) => [offense.id, offense]));
    directory.currentProfileRows = directory.currentProfileRows.map((row) => ({ ...row, city: clone(cityById.get(row.cityId)), offense: clone(offenseById.get(row.offenseId)) }));
    directory.chronology = directory.chronology.map((event) => ({ ...event, city: clone(cityById.get(event.cityId)), affectedOffenses: event.affectedOffenseIds.map((id) => clone(offenseById.get(id))) }));
    return directory;
  }

  function currentPublicAttitudeProfile(map, cityId, offenseOrRuntimeChargeId) {
    const offenseId = StrategicCityLaws.RUNTIME_CHARGE_TO_OFFENSE[offenseOrRuntimeChargeId] || offenseOrRuntimeChargeId;
    return clone(publicAttitudeHistory(map)?.currentProfileRows.find((row) => row.cityId === cityId && row.offenseId === offenseId) || null);
  }

  function currentCityPublicAttitudes(map, cityId) {
    const history = publicAttitudeHistory(map);
    if (!history) return null;
    return { cityId, profiles: history.currentProfileRows.filter((row) => row.cityId === cityId), chronology: history.chronology.filter((event) => event.cityId === cityId) };
  }

  function auditStrategicPublicAttitudeHistory(map) {
    const { strategicPublicAttitudeHistory: record, publicDirectory } = validateStrategicPublicAttitudeHistory(map);
    return {
      valid: true,
      oneProfilePerCityOffense: record.currentProfileRows.length === map.humanGeography.cities.length * StrategicCityLaws.OFFENSE_CATALOG.length,
      everyShiftCausallySourced: record.eventRows.every((event) => event.sourceEventId && event.stateDeltas.length),
      aggregatePressureNeverConsensus: record.currentProfileRows.every((row) => row.aggregatePressureNotPopulationConsensus),
      attitudesNeverChangeLawOrGuilt: record.eventRows.every((event) => !event.changesRecognizedLaw && !event.establishesGuilt && !event.changesEvidenceReliability && !event.changesOffenseElements),
      publicDirectoryAcknowledgesUncertainty: publicDirectory.currentProfileRows.every((row) => row.uncertaintyAcknowledged && OBSERVATION_CONFIDENCE_BANDS.includes(row.observationConfidence)),
      publicDirectoryHidesExactFactors: !JSON.stringify(publicDirectory).match(/exactFactors|discoverableHooks|sourceEventId|sourceLayer|retainedBySeed|channelShifts/),
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({ PRESSURE_CHANNELS, PRESSURE_BANDS, OBSERVATION_CONFIDENCE_BANDS, EVENT_KINDS, createStrategicPublicAttitudeHistory, validateStrategicPublicAttitudeHistory, attachStrategicPublicAttitudeHistory, publicAttitudeHistory, currentPublicAttitudeProfile, currentCityPublicAttitudes, auditStrategicPublicAttitudeHistory });
});
