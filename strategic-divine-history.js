(function initStrategicDivineHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicDivinity = typeof module === "object" && module.exports ? require("./strategic-divinity") : root?.HelixStrategicDivinity;
  const strategicFaiths = typeof module === "object" && module.exports ? require("./strategic-faiths") : root?.HelixStrategicFaiths;
  const strategicReligions = typeof module === "object" && module.exports ? require("./strategic-religions") : root?.HelixStrategicReligions;
  const strategicCityExpansion = typeof module === "object" && module.exports ? require("./strategic-city-expansion") : root?.HelixStrategicCityExpansion;
  const strategicCapabilityHistory = typeof module === "object" && module.exports ? require("./strategic-capability-history") : root?.HelixStrategicCapabilityHistory;
  const strategicBeastEcology = typeof module === "object" && module.exports ? require("./strategic-beast-ecology") : root?.HelixStrategicBeastEcology;
  const strategicSettlements = typeof module === "object" && module.exports ? require("./strategic-settlements") : root?.HelixStrategicSettlements;
  const api = factory(strategicWorld, strategicDivinity, strategicFaiths, strategicReligions, strategicCityExpansion, strategicCapabilityHistory, strategicBeastEcology, strategicSettlements);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicDivineHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicDivineHistoryApi(StrategicWorld, StrategicDivinity, StrategicFaiths, StrategicReligions, StrategicCityExpansion, StrategicCapabilityHistory, StrategicBeastEcology, StrategicSettlements) {
  "use strict";

  if (!StrategicWorld || !StrategicDivinity || !StrategicFaiths || !StrategicReligions || !StrategicCityExpansion || !StrategicCapabilityHistory || !StrategicBeastEcology || !StrategicSettlements) throw new Error("Divinity, faith, religion, city, capability, beast, settlement, and world modules must load before strategic-divine-history.js");

  const EVENT_KINDS = Object.freeze(["divineIntervention", "divineCooperation", "worshipCollapse", "holySiteContest", "forcedDescent", "divineDeath", "reascension", "mortalAscension", "mortalGodKilling"]);
  const CONFIRMATION_STATES = Object.freeze(["activelyConfirmed", "historicallyConfirmed", "unconfirmedSuccessor"]);
  const SITE_STATES = Object.freeze(["active", "dormant", "residual", "dead"]);
  const SUCCESSOR_RESOLUTIONS = Object.freeze(["independentUnconfirmed", "reconciliationContested", "reconciled", "repudiated"]);
  const INTERVENTION_KINDS = Object.freeze(["cityWardRenewal", "massHealing", "beastRepulsion", "relayProtection", "holySiteRestoration"]);
  const COLLAPSE_CAUSES = Object.freeze(["ritualNetworkFailure", "populationDisplacement", "institutionalSuppression", "worshipperDefection", "holySiteIsolation"]);
  const CONFLICT_CAUSES = Object.freeze(["contestedHolySite", "incompatibleDivineObjectives", "retaliationForFollowerLoss", "rivalManifestation", "disputedProtectionClaim"]);
  const ASCENSION_CATALYSTS = Object.freeze(["holySiteConvergence", "orbitalArcaneExposure", "identityBoundRelic", "massWitnessedTransformation", "selfConstructedDivineCore"]);
  const ASCENDANT_TITLES = Object.freeze(["the Newly Crowned", "the Self-Made", "the Threshold-Born", "the Transcendent", "the Unbidden"]);
  const SUCCESSOR_LABELS = Object.freeze(["Continuance", "Testament", "Custodians", "Remnant", "Witnesses"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function integerBetween(seed, channel, minimum, maximum) { return minimum + Math.floor(seededNumber(seed, channel) * (maximum - minimum + 1)); }
  function pick(values, seed, channel) { return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length]; }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Math.floor(Number(value) || 0))); }
  function historyCore(record) { const core = clone(record); delete core.digest; return core; }
  function publicCore(directory) { const core = clone(directory); delete core.digest; return core; }
  function title(value) { return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }

  function validateSources(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicDivinity.validatePreCivicDivinity(strategicMap);
    StrategicFaiths.validatePreCivicFaiths(strategicMap);
    StrategicReligions.validateStrategicReligions(strategicMap);
    StrategicCityExpansion.validateCityExpansionHistory(strategicMap);
    StrategicCapabilityHistory.validateStrategicCapabilityHistory(strategicMap);
    StrategicBeastEcology.validateBeastEcology(strategicMap);
    StrategicSettlements.validateStrategicSettlements(strategicMap);
    return strategicMap;
  }

  function opportunityYears(seed, startYear, horizonYear, godCount) {
    const span = Math.max(1, horizonYear - startYear);
    const count = Math.min(22, Math.max(8, Math.floor(span / 115) + Math.ceil(godCount / 2)));
    const years = [];
    for (let ordinal = 0; ordinal < count; ordinal += 1) {
      const center = startYear + Math.floor(span * (ordinal + 1) / (count + 1));
      const jitter = integerBetween(seed, `opportunity-jitter:${ordinal}`, -Math.max(1, Math.floor(span / count / 3)), Math.max(1, Math.floor(span / count / 3)));
      years.push(clamp(center + jitter, startYear + 1, horizonYear));
    }
    return [...new Set(years)].sort((left, right) => left - right);
  }

  function initialGodIdentities(seed, map) {
    return StrategicReligions.createGods(seed, map.strategicDivinity.worldTheme);
  }

  function publicIdentity(identity) {
    return {
      id: identity.id,
      name: identity.name,
      epithet: identity.epithet,
      domains: clone(identity.domains || []),
      originKind: identity.originKind || "unknownToPublic",
      originPubliclyKnown: Boolean(identity.originPubliclyKnown),
      objectivelyReal: true,
      finite: true
    };
  }

  function faithState(god, faith) {
    const confirmationState = StrategicFaiths.confirmationStateForDivineLifecycle(god.lifecycle);
    return {
      faithId: faith.faithId,
      godId: god.id,
      name: faith.name,
      confirmationState,
      correctionChannel: confirmationState === "activelyConfirmed" ? "repeatableDirectDivineCommunication" : "lastConfirmedDoctrine",
      sameGodHeresyClaimsValid: false
    };
  }

  function siteStateRows(map) {
    return map.preCivicFaiths.holySiteRows.map((row) => ({
      siteId: row[0],
      originPatronGodId: row[1],
      currentControllerGodId: row[1],
      name: row[2],
      cellId: StrategicWorld.cellId(row[3]),
      state: SITE_STATES[row[6]],
      publiclyKnownBeforeHistory: map.publicPreCivicFaithDirectory.holySiteRows.some((publicRow) => publicRow[0] === row[0])
    }));
  }

  function allFounderCandidates(map) {
    return StrategicCityExpansion.allCitySeeds(map).flatMap((city) => city.founderRows.map((founder) => ({
      id: founder.id,
      name: founder.name,
      originKind: "human",
      cellId: city.cellId,
      availableYear: city.foundingYear,
      exceptionalCapabilities: clone(founder.exceptionalCapabilities),
      stableIdentity: true,
      sourcePopulationId: founder.peopleId || founder.sourcePopulationId || null
    })));
  }

  function beastAscensionCandidates(map) {
    const speciesById = new Map(StrategicBeastEcology.BEAST_SPECIES.map((definition) => [definition.id, definition]));
    return StrategicBeastEcology.expandPristineBeastEcology(map).populations.map((population) => {
      const species = speciesById.get(population.speciesId);
      return {
        id: `beast-paragon:${population.id}`,
        name: `${species?.name || title(population.speciesId.replace("beast:", ""))} Paragon`,
        originKind: "beast",
        cellId: population.lairCellId,
        availableYear: 0,
        exceptionalCapabilities: [species?.intelligenceBand || "instinctive", species?.threatBand || "dangerous", "populationBackedIdentity"],
        stableIdentity: true,
        sourcePopulationId: population.id,
        populationIndex: population.populationIndex
      };
    });
  }

  function godStateIsValid(god) {
    if (!god || !String(god.id || "").startsWith("god:") || !StrategicDivinity.LIFE_STATES.includes(god.lifecycle?.lifeState) || !StrategicDivinity.DIVINITY_STATES.includes(god.lifecycle?.divinityState) || !StrategicDivinity.PUBLIC_STATUSES.includes(god.lifecycle?.publicStatus) || !StrategicDivinity.DIVINE_RANKS.includes(god.rank)) return false;
    if (!Number.isInteger(god.power?.reserve) || !Number.isInteger(god.power?.reserveCapacity) || god.power.reserve < 0 || god.power.reserve > god.power.reserveCapacity) return false;
    if (god.power.worshipIncome !== StrategicDivinity.calculateWorshipIncome(god.worshipSources, god.divineCore.receivingCapacity)) return false;
    if (god.rank !== StrategicDivinity.rankForSustainablePower(god.divineCore.innateCapacity + god.power.worshipIncome, god.rank)) return false;
    return !(god.lifecycle.lifeState === "dead" && (god.lifecycle.divinityState !== "none" || god.power.reserve !== 0));
  }

  function relationshipFor(map, leftId, rightId) {
    const directory = StrategicReligions.publicReligionDirectory(map);
    return directory.divineRelations.find((relation) => relation.godIds.includes(leftId) && relation.godIds.includes(rightId))?.relation || "unknown";
  }

  function eventLocation(seed, map, year, channel, siteStates, preferSite = false) {
    const availableCities = StrategicCityExpansion.allCitySeeds(map).filter((city) => city.foundingYear <= year);
    const usableSites = siteStates.filter((site) => site.state !== "dead");
    if (usableSites.length && (preferSite || seededNumber(seed, `${channel}:site-or-city`) < 0.34)) {
      const site = pick(usableSites, seed, `${channel}:site`);
      return { cellId: site.cellId, siteId: site.siteId, cityId: null, publicPlace: site.publiclyKnownBeforeHistory };
    }
    const city = availableCities.length ? pick(availableCities, seed, `${channel}:city`) : null;
    return city ? { cellId: city.cellId, siteId: null, cityId: city.cityId, publicPlace: true } : { cellId: usableSites[0]?.cellId || null, siteId: usableSites[0]?.siteId || null, cityId: null, publicPlace: false };
  }

  function successorFor(seed, map, godId, year, ordinal, faithByGod, publicFaithByGod) {
    const base = publicFaithByGod.get(godId);
    if (!base) return null;
    const id = `tradition:successor:${godId.slice(4)}:${String(ordinal + 1).padStart(2, "0")}`;
    const name = `The ${pick(SUCCESSOR_LABELS, seed, `successor-name:${id}`)} of ${base.name.replace(/^The Faith of /, "")}`;
    const semantic = StrategicFaiths.createUnconfirmedSuccessorFaith(base, id, name);
    return {
      id: semantic.id,
      name: semantic.name,
      predecessorFaithId: faithByGod.get(godId)?.faithId || base.id,
      historicalGodId: godId,
      createdYear: year,
      confirmationState: "unconfirmedSuccessor",
      correctionAuthorityId: null,
      sameGodHeresyClaimsValid: false,
      claimsDivineInheritance: seededNumber(seed, `successor-claim:${id}`) < 0.38,
      resolution: "independentUnconfirmed",
      sovereignAuthority: false
    };
  }

  function publicEvent(event, identityById) {
    return {
      id: event.id,
      year: event.year,
      kind: event.kind,
      participantIds: clone(event.participantIds),
      participantNames: event.participantIds.map((id) => identityById.get(id)?.name || "Unidentified power"),
      cellId: event.cellId,
      cityId: event.cityId,
      siteId: event.siteId,
      outcome: event.publicOutcome,
      evidence: clone(event.publicEvidence),
      account: event.publicAccount,
      exactPowerPublic: false,
      hiddenCausalityAcknowledged: true
    };
  }

  function createStrategicDivineHistory(worldSeed, map, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for divine history.");
    const strategicMap = validateSources(map);
    if (strategicMap.strategicDivineHistory || strategicMap.publicDivineHistoryDirectory) throw new Error("Divine history already exists on this world.");
    const horizonYear = Math.max(strategicMap.cityExpansionHistory.historicalHorizonYear, Math.floor(Number(options.historicalHorizonYear) || 0));
    const startYear = Math.max(1, strategicMap.civilizationOrigins.eraEndYear);
    const identities = initialGodIdentities(seed, strategicMap);
    const identityById = new Map(identities.map((identity) => [identity.id, identity]));
    const gods = new Map(strategicMap.strategicDivinity.godOrder.map((godId) => [godId, StrategicDivinity.privateDivineStateFor(strategicMap, godId)]));
    const initialGodIds = [...gods.keys()];
    const knownGodIds = new Set(strategicMap.publicReligionDirectory.gods.map((god) => god.id));
    const publicFaiths = StrategicFaiths.publicFaithDirectory(strategicMap).faiths;
    const publicFaithByGod = new Map(publicFaiths.map((faith) => [faith.godId, faith]));
    const faithByGod = new Map(strategicMap.preCivicFaiths.faithRows.map((row) => [row[1], { faithId: row[0], name: row[2] }]));
    const siteStates = siteStateRows(strategicMap);
    const hiddenSitePower = new Map(strategicMap.preCivicFaiths.hiddenSiteRows.map((row) => [row[0], row[2]]));
    const founders = allFounderCandidates(strategicMap);
    const ascensionCandidates = [...founders, ...beastAscensionCandidates(strategicMap)];
    const usedAscendantIds = new Set();
    const lostWorshipByGod = new Map();
    const events = [];
    const publicEvents = [];
    const successors = [];
    const remains = [];
    const persistentConsequences = [];
    const ascendedFaiths = [];

    const revealParticipants = (event) => {
      if (!event.publiclyKnown) return;
      event.participantIds.forEach((godId) => {
        if (godId.startsWith("god:")) knownGodIds.add(godId);
      });
      publicEvents.push(publicEvent(event, identityById));
    };

    const addSuccessor = (godId, year) => {
      if (!knownGodIds.has(godId) || successors.some((entry) => entry.historicalGodId === godId)) return null;
      const successor = successorFor(seed, strategicMap, godId, year, successors.length, faithByGod, publicFaithByGod);
      if (successor) successors.push(successor);
      return successor;
    };

    const recordDeath = (victimId, victorId, eventBase, capturePermille, publiclyConfirmed, killedByMortal = false) => {
      const victim = gods.get(victimId);
      const victor = victorId ? gods.get(victorId) : null;
      const resolved = StrategicDivinity.resolveDivineDeath(victim, victor, { capturePermille, publiclyConfirmed });
      gods.set(victimId, resolved.victim);
      if (resolved.victor) gods.set(victorId, resolved.victor);
      const remainsRecord = {
        id: `divine-remains:${victimId.slice(4)}:${eventBase.year}`,
        formerGodId: victimId,
        cellId: eventBase.cellId,
        createdYear: eventBase.year,
        killerId: victorId,
        identityPreserved: true,
        religionTransferred: false,
        exactResidualPower: resolved.remains.power,
        kinds: clone(resolved.remains.kinds),
        publiclyDiscovered: publiclyConfirmed,
        discoverableHook: true
      };
      remains.push(remainsRecord);
      const successor = addSuccessor(victimId, eventBase.year);
      const followerDispositionRows = victim.worshipSources.map((source) => {
        const successorUnits = successor ? Math.floor(source.followerUnits * integerBetween(seed, `death-successor:${eventBase.id}:${source.id}`, 25, 70) / 100) : 0;
        return [source.sourcePopulationId, source.followerUnits - successorUnits, successorUnits];
      });
      const exactCombatContext = clone(eventBase.exactCombatContext || {});
      const event = {
        ...eventBase,
        kind: killedByMortal ? "mortalGodKilling" : "divineDeath",
        participantIds: victorId ? [victorId, victimId] : [victimId],
        prerequisites: eventBase.prerequisites || ["causalDivineConflict", "decisiveCombatMargin", "intentToKill", "identityKillingStrike"],
        actualCause: killedByMortal ? "extraordinaryMortalStrike" : "decisiveDivineCombat",
        exactContributions: { ...exactCombatContext, capturedPower: resolved.capturedPower, dissipatedPower: resolved.dissipatedPower, residualPower: resolved.remains.power, capturePermille },
        stateDelta: { victimLifeState: "dead", victimDivinityState: "none", remainsId: remainsRecord.id, successorTraditionId: successor?.id || null, identityTransferred: false, religionTransferred: false },
        followerDispositionRows,
        publicOutcome: publiclyConfirmed ? "confirmedPermanentDivineDeath" : "unresolvedDisappearance",
        publicEvidence: publiclyConfirmed ? ["destroyedDivineSignature", "recoverableDivineRemains"] : ["lostCommunication", "unverifiedRemainsReports"],
        publicAccount: publiclyConfirmed
          ? `${identityById.get(victimId)?.name || "A god"} was killed as an individual, not merely cut off from worship. Remains and an historically confirmed faith persist; no victor inherited the victim's identity or complete religion.`
          : `Communication ceased after a destructive confrontation. Public evidence does not establish whether the missing god descended, fled, or died.`,
        publiclyKnown: publiclyConfirmed || eventBase.publiclyKnown
      };
      delete event.exactCombatContext;
      events.push(event);
      revealParticipants(event);
      return event;
    };

    const years = opportunityYears(seed, startYear, horizonYear, gods.size);
    for (const [ordinal, year] of years.entries()) {
      const channel = `divine-history:${ordinal}:${year}`;
      const livingDivine = [...gods.values()].filter((god) => god.lifecycle.lifeState === "living" && god.lifecycle.divinityState === "divine");
      const descended = [...gods.values()].filter((god) => god.lifecycle.lifeState === "living" && god.lifecycle.divinityState === "descended");
      const roll = seededNumber(seed, `${channel}:kind`);

      if (descended.length && roll < 0.24) {
        const fallen = pick(descended, seed, `${channel}:reascendant`);
        const restoredSources = lostWorshipByGod.get(fallen.id) || fallen.worshipSources;
        const restoredIncome = StrategicDivinity.calculateWorshipIncome(restoredSources, fallen.divineCore.receivingCapacity);
        if (restoredSources.some((source) => source.followerUnits > 0) && restoredIncome >= fallen.expenditures.existence * 2) {
          const location = eventLocation(seed, strategicMap, year, channel, siteStates, true);
          const restored = StrategicDivinity.restoreDescendedDivinity(fallen, {
            catalyst: pick(ASCENSION_CATALYSTS, seed, `${channel}:catalyst`),
            identityStable: true,
            coreReconstructed: true,
            worshipSources: clone(restoredSources),
            publiclyObserved: location.publicPlace || knownGodIds.has(fallen.id)
          });
          gods.set(fallen.id, restored);
          for (const successor of successors.filter((entry) => entry.historicalGodId === fallen.id)) successor.resolution = "reconciliationContested";
          const event = {
            id: `divine-event:${String(events.length + 1).padStart(3, "0")}`,
            year, kind: "reascension", participantIds: [fallen.id], ...location,
            prerequisites: ["sameLivingIdentity", "reconstructedDivineCore", "restoredDeliberateWorship", "physicalReascensionRite"],
            exactContributions: { restoredWorshipIncome: restored.power.worshipIncome, startingReserve: restored.power.reserve },
            stateDelta: { lifeState: "living", divinityState: "divine", faithConfirmation: "activelyConfirmed", successorResolution: "reconciliationContested" },
            publicOutcome: "originalGodReascended",
            publicEvidence: ["restoredRepeatableSignature", "renewedDirectCorrection"],
            publicAccount: `${identityById.get(fallen.id)?.name || "A fallen god"} returned as the same continuous identity and restored active confirmation to the original faith. Existing successor institutions now face reconciliation rather than automatic erasure.`,
            publiclyKnown: location.publicPlace || knownGodIds.has(fallen.id)
          };
          events.push(event);
          revealParticipants(event);
          continue;
        }
      }

      if (roll >= 0.24 && roll < 0.27 && livingDivine.length && usedAscendantIds.size === 0) {
        const candidates = ascensionCandidates.filter((candidate) => candidate.availableYear <= year && !usedAscendantIds.has(candidate.id));
        const candidate = candidates.length ? pick(candidates, seed, `${channel}:ascendant-candidate`) : null;
        const donors = candidate ? livingDivine.filter((god) => god.worshipSources.some((source) => source.kind === candidate.originKind && source.followerUnits >= 8)) : [];
        if (candidate && donors.length) {
          const donor = pick(donors, seed, `${channel}:worship-donor`);
          const donorSource = donor.worshipSources.find((source) => source.kind === candidate.originKind && source.followerUnits >= 8);
          const transferredUnits = Math.max(4, Math.floor(donorSource.followerUnits * integerBetween(seed, `${channel}:transfer-share`, 18, 34) / 100));
          const donorSources = clone(donor.worshipSources);
          const donorCopy = donorSources.find((source) => source.id === donorSource.id);
          donorCopy.followerUnits -= transferredUnits;
          donorCopy.beliefOnlyPopulation = Math.max(donorCopy.followerUnits, donorCopy.beliefOnlyPopulation - transferredUnits);
          const ascendantSource = clone(donorSource);
          ascendantSource.id = `worship:ascendant:${StrategicWorld.stableHash(`${candidate.id}:${year}`)}`;
          ascendantSource.followerUnits = transferredUnits;
          ascendantSource.beliefOnlyPopulation = transferredUnits;
          ascendantSource.devotionPermille = Math.max(900, ascendantSource.devotionPermille);
          ascendantSource.organizationPermille = Math.max(850, ascendantSource.organizationPermille);
          ascendantSource.ritualInfrastructurePermille = Math.max(800, ascendantSource.ritualInfrastructurePermille);
          ascendantSource.offeringPermille = Math.max(700, ascendantSource.offeringPermille);
          ascendantSource.coercedWorshipPermille = 0;
          ascendantSource.receptionEfficiencyPermille = Math.max(900, ascendantSource.receptionEfficiencyPermille);
          gods.set(donor.id, StrategicDivinity.advanceDivineCycle(donor, { worshipSources: donorSources }));
          const location = eventLocation(seed, strategicMap, year, channel, siteStates, true);
          const publiclyObserved = location.publicPlace && seededNumber(seed, `${channel}:public`) < 0.72;
          const repeatableSignature = `divine-signature:${StrategicWorld.stableHash(`${seed}:${candidate.id}:${year}:ascension`)}`;
          const receivingCapacity = integerBetween(seed, `${channel}:receiving-capacity`, 300, 720);
          const ascendantIncome = StrategicDivinity.calculateWorshipIncome([ascendantSource], receivingCapacity);
          const ascended = StrategicDivinity.ascendMortal({
            id: candidate.id,
            originKind: candidate.originKind,
            stableIdentity: candidate.stableIdentity,
            transcendentPower: integerBetween(seed, `${channel}:transcendent-power`, 330, 650),
            soulStable: true,
            survivesTransformation: true
          }, {
            catalyst: pick(ASCENSION_CATALYSTS, seed, `${channel}:catalyst`),
            viableDivineCore: true,
            repeatableSignature,
            worshipSources: [ascendantSource],
            receivingCapacity,
            reserveCapacity: integerBetween(seed, `${channel}:reserve-capacity`, 900, 1800),
            existenceCost: Math.max(1, Math.min(integerBetween(seed, `${channel}:existence-cost`, 18, 44), Math.floor(ascendantIncome / 2))),
            domains: candidate.originKind === "beast" ? ["beasts", "transcendence"] : ["transcendence", "selfDetermination"],
            objectives: ["preserveIdentity", "sustainNewWorship", "surviveDivineRivalry"],
            publiclyObserved,
            originPubliclyKnown: publiclyObserved,
            urbanInterest: "conditional",
            investmentWillingness: "limited"
          });
          const identity = {
            id: ascended.id,
            name: candidate.name,
            epithet: pick(ASCENDANT_TITLES, seed, `${channel}:title`),
            domains: clone(ascended.domains),
            originKind: candidate.originKind,
            originPubliclyKnown: publiclyObserved
          };
          identityById.set(ascended.id, identity);
          gods.set(ascended.id, ascended);
          usedAscendantIds.add(candidate.id);
          const faith = { faithId: `tradition:ascended:${ascended.id.slice("god:ascended:".length)}`, godId: ascended.id, name: `The Faith of ${candidate.name}` };
          faithByGod.set(ascended.id, faith);
          ascendedFaiths.push({ ...faith, createdYear: year, distinctFromPredecessorFaith: true, confirmationState: "activelyConfirmed", sameGodHeresyClaimsValid: false });
          const event = {
            id: `divine-event:${String(events.length + 1).padStart(3, "0")}`,
            year, kind: "mortalAscension", participantIds: [ascended.id], ...location,
            mortalOrigin: { id: candidate.id, kind: candidate.originKind, name: candidate.name, priorCapabilities: clone(candidate.exceptionalCapabilities) },
            prerequisites: ["stableMortalIdentity", "transcendentPower", "soulStability", "survivedTransformation", "identityBoundDivineCore", "deliberateTransferredWorship", "repeatableDivineSignature"],
            exactContributions: { transferredFollowerUnits: transferredUnits, worshipIncome: ascended.power.worshipIncome, innateCapacity: ascended.divineCore.innateCapacity, donorGodId: donor.id },
            stateDelta: { newGodId: ascended.id, newFaithId: faith.faithId, initialRank: ascended.rank, identityContinuous: true },
            publicOutcome: publiclyObserved ? "authenticatedNewAscension" : "unconfirmedTranscendentEmergence",
            publicEvidence: publiclyObserved ? ["witnessedTransformation", "newRepeatableDivineSignature"] : ["fragmentaryTransformationReports"],
            publicAccount: publiclyObserved ? `${candidate.name} survived a physical ascension rite and established a new identity-bound divine signature. The ascendant is a new god with a distinct faith, not a continuation of another deity.` : `Reports describe a mortal transformation, but no public institution has authenticated the resulting identity.`,
            publiclyKnown: publiclyObserved
          };
          events.push(event);
          revealParticipants(event);
          continue;
        }
      }

      if (roll >= 0.27 && roll < 0.36 && livingDivine.length) {
        const god = pick(livingDivine, seed, `${channel}:collapse-god`);
        const originalSources = clone(god.worshipSources);
        lostWorshipByGod.set(god.id, originalSources.map((source) => ({ ...source, followerUnits: Math.max(1, Math.floor(source.followerUnits * 0.58)), beliefOnlyPopulation: Math.max(1, Math.floor(source.beliefOnlyPopulation * 0.65)) })));
        const vanishedSources = originalSources.map((source) => ({ ...source, followerUnits: 0, beliefOnlyPopulation: Math.max(source.beliefOnlyPopulation, source.followerUnits), devotionPermille: 0 }));
        const fallen = StrategicDivinity.advanceDivineCycle(god, { worshipSources: vanishedSources, publiclyObserved: knownGodIds.has(god.id) });
        if (fallen.lifecycle.divinityState === "descended") {
          gods.set(god.id, fallen);
          const location = eventLocation(seed, strategicMap, year, channel, siteStates, false);
          const successor = addSuccessor(god.id, year);
          const event = {
            id: `divine-event:${String(events.length + 1).padStart(3, "0")}`,
            year, kind: "worshipCollapse", participantIds: [god.id], ...location,
            actualCause: pick(COLLAPSE_CAUSES, seed, `${channel}:cause`),
            prerequisites: ["populationBackedWorshipLost", "existenceCostsUnsustainable"],
            exactContributions: { formerWorshipIncome: god.power.worshipIncome, remainingWorshipIncome: 0, releasedPower: god.power.reserve },
            stateDelta: { lifeState: "living", divinityState: "descended", identityPreserved: true, retainedMortalPower: true, faithConfirmation: "historicallyConfirmed", successorTraditionId: successor?.id || null },
            publicOutcome: "divineCommunicationCeased",
            publicEvidence: ["signatureSilence", "failedRemoteMiracles"],
            publicAccount: `${identityById.get(god.id)?.name || "A known god"} ceased answering after organized worship collapsed. The same extraordinarily powerful individual may remain alive; silence does not prove death.`,
            publiclyKnown: knownGodIds.has(god.id) || location.publicPlace
          };
          events.push(event);
          revealParticipants(event);
          continue;
        }
      }

      if (roll >= 0.36 && roll < 0.66 && livingDivine.length >= 2) {
        const attacker = pick(livingDivine, seed, `${channel}:attacker`);
        const possibleDefenders = livingDivine.filter((god) => god.id !== attacker.id);
        const defender = pick(possibleDefenders, seed, `${channel}:defender`);
        const location = eventLocation(seed, strategicMap, year, channel, siteStates, true);
        const site = location.siteId ? siteStates.find((entry) => entry.siteId === location.siteId) : null;
        const environmentDomains = location.cellId ? [strategicMap.arcaneGeography.primaryAspectClasses[StrategicWorld.cellIndex(location.cellId)], site ? strategicMap.preCivicFaiths.holySiteRows.find((row) => row[0] === site.siteId)?.[8] : null].filter(Boolean) : [];
        const attackerCommittedPower = Math.min(attacker.power.reserve, integerBetween(seed, `${channel}:attacker-commit`, 120, Math.max(120, Math.floor(attacker.power.reserve * 0.62))));
        const defenderCommittedPower = Math.min(defender.power.reserve, integerBetween(seed, `${channel}:defender-commit`, 100, Math.max(100, Math.floor(defender.power.reserve * 0.58))));
        const context = {
          seed: `${seed}:${channel}:combat`,
          environmentDomains,
          attackerCommittedPower,
          defenderCommittedPower,
          attackerHolySitePower: site?.currentControllerGodId === attacker.id ? hiddenSitePower.get(site.siteId) || 0 : 0,
          defenderHolySitePower: site?.currentControllerGodId === defender.id ? hiddenSitePower.get(site.siteId) || 0 : 0,
          attackerAllyPower: relationshipFor(strategicMap, attacker.id, defender.id) === "allied" ? 0 : integerBetween(seed, `${channel}:attacker-allies`, 0, 190),
          defenderAllyPower: integerBetween(seed, `${channel}:defender-allies`, 0, 190),
          attackerPreparation: integerBetween(seed, `${channel}:attacker-preparation`, 0, 360),
          defenderPreparation: integerBetween(seed, `${channel}:defender-preparation`, 0, 360),
          attackerSurprise: integerBetween(seed, `${channel}:attacker-surprise`, 0, 260),
          defenderSurprise: integerBetween(seed, `${channel}:defender-surprise`, 0, 160),
          attackerManifestationCost: integerBetween(seed, `${channel}:attacker-manifestation`, 35, 180),
          defenderManifestationCost: integerBetween(seed, `${channel}:defender-manifestation`, 35, 180)
        };
        const combat = StrategicDivinity.resolveDivineCombat(attacker, defender, context);
        const winner = gods.get(combat.winnerId);
        const loser = gods.get(combat.loserId);
        winner.power.reserve = Math.max(1, winner.power.reserve - Math.max(18, Math.floor((combat.winnerId === attacker.id ? attackerCommittedPower : defenderCommittedPower) * 0.12)));
        loser.power.reserve = Math.max(1, loser.power.reserve - Math.max(24, Math.floor((combat.loserId === attacker.id ? attackerCommittedPower : defenderCommittedPower) * 0.2)));
        const publiclyKnown = location.publicPlace || knownGodIds.has(attacker.id) && knownGodIds.has(defender.id);
        const killIntent = seededNumber(seed, `${channel}:kill-intent`) < 0.14;
        const deathThreshold = Math.max(430, Math.floor(Math.min(combat.attackerScore, combat.defenderScore) * 0.28));
        const base = { id: `divine-event:${String(events.length + 1).padStart(3, "0")}`, year, ...location, publiclyKnown };
        if (killIntent && combat.margin >= deathThreshold) {
          recordDeath(loser.id, winner.id, { ...base, exactCombatContext: { ...context, attackerScore: combat.attackerScore, defenderScore: combat.defenderScore, margin: combat.margin } }, integerBetween(seed, `${channel}:capture`, 100, 520), publiclyKnown, false);
        } else if (combat.margin >= 230 && loser.lifecycle.divinityState === "divine") {
          const descendedResult = StrategicDivinity.forceDivineDescent(loser, { publiclyObserved: publiclyKnown });
          gods.set(loser.id, descendedResult.god);
          gods.set(winner.id, winner);
          const successor = addSuccessor(loser.id, year);
          if (site && site.currentControllerGodId === loser.id) {
            site.currentControllerGodId = winner.id;
            site.state = "residual";
          }
          const event = {
            ...base, kind: "forcedDescent", participantIds: [attacker.id, defender.id],
            actualCause: pick(CONFLICT_CAUSES, seed, `${channel}:cause`),
            prerequisites: ["causalDivineConflict", "decisiveCombatMargin", "divineCoreBrokenWithoutKillingIndividual"],
            exactContributions: { ...context, attackerScore: combat.attackerScore, defenderScore: combat.defenderScore, margin: combat.margin, releasedPower: descendedResult.releasedPower },
            stateDelta: { winnerId: winner.id, loserId: loser.id, loserLifeState: "living", loserDivinityState: "descended", identityPreserved: true, retainedMortalPower: true, faithConfirmation: "historicallyConfirmed", siteControllerGodId: site?.currentControllerGodId || null, successorTraditionId: successor?.id || null },
            publicOutcome: "rivalForcedIntoDescent",
            publicEvidence: publiclyKnown ? ["witnessedAvatarCombat", "lostDivineSignature"] : ["damagedHolySite", "laterSignatureSilence"],
            publicAccount: `${identityById.get(winner.id)?.name || "One divine power"} broke ${identityById.get(loser.id)?.name || "a rival"}'s divine core without establishing the rival's death. The fallen individual retains identity and extraordinary mortal power.`,
          };
          events.push(event);
          revealParticipants(event);
        } else {
          gods.set(attacker.id, attacker);
          gods.set(defender.id, defender);
          if (site) site.currentControllerGodId = winner.id;
          const event = {
            ...base, kind: "holySiteContest", participantIds: [attacker.id, defender.id],
            actualCause: pick(CONFLICT_CAUSES, seed, `${channel}:cause`),
            prerequisites: ["causalDivineConflict", "finiteCommittedPower", "retreatBeforeIdentityDestruction"],
            exactContributions: { ...context, attackerScore: combat.attackerScore, defenderScore: combat.defenderScore, margin: combat.margin },
            stateDelta: { winnerId: winner.id, loserId: loser.id, siteControllerGodId: site?.currentControllerGodId || null, bothIndividualsSurvived: true },
            publicOutcome: site ? "holySiteControlChangedOrDefended" : "divineRivalryEndedInWithdrawal",
            publicEvidence: publiclyKnown ? ["boundedAvatarManifestations", "siteCustodyRecord"] : ["residualDivineDamage"],
            publicAccount: `${identityById.get(winner.id)?.name || "One divine power"} prevailed over ${identityById.get(loser.id)?.name || "a rival"}, but the loser withdrew alive. Victory did not automatically cause descent or death.`,
          };
          events.push(event);
          revealParticipants(event);
        }
        continue;
      }

      if (roll >= 0.66 && roll < 0.94 && livingDivine.length) {
        const cooperativePairs = [];
        for (let left = 0; left < livingDivine.length; left += 1) for (let right = left + 1; right < livingDivine.length; right += 1) {
          const relation = relationshipFor(strategicMap, livingDivine[left].id, livingDivine[right].id);
          if (["cooperative", "allied"].includes(relation)) cooperativePairs.push([livingDivine[left], livingDivine[right], relation]);
        }
        if (roll >= 0.86 && cooperativePairs.length) {
          const [leftGod, rightGod, relation] = pick(cooperativePairs, seed, `${channel}:cooperative-pair`);
          const leftCost = Math.min(leftGod.power.reserve - 1, integerBetween(seed, `${channel}:left-cooperation-cost`, 24, 110));
          const rightCost = Math.min(rightGod.power.reserve - 1, integerBetween(seed, `${channel}:right-cooperation-cost`, 24, 110));
          if (leftCost >= 24 && rightCost >= 24) {
            const location = eventLocation(seed, strategicMap, year, channel, siteStates, false);
            leftGod.power.reserve -= leftCost;
            rightGod.power.reserve -= rightCost;
            gods.set(leftGod.id, leftGod);
            gods.set(rightGod.id, rightGod);
            const consequence = {
              id: `divine-consequence:${String(persistentConsequences.length + 1).padStart(3, "0")}`,
              kind: "jointDefensiveWorking",
              godId: leftGod.id,
              participantGodIds: [leftGod.id, rightGod.id],
              cityId: location.cityId,
              siteId: location.siteId,
              cellId: location.cellId,
              createdYear: year,
              persistsAtPlayableYear: seededNumber(seed, `${channel}:joint-persists`) < 0.58,
              discoverable: true
            };
            persistentConsequences.push(consequence);
            const endsYear = Math.min(horizonYear, year + integerBetween(seed, `${channel}:compact-duration`, 1, 18));
            const event = {
              id: `divine-event:${String(events.length + 1).padStart(3, "0")}`,
              year, kind: "divineCooperation", participantIds: [leftGod.id, rightGod.id], ...location,
              actualCause: "boundedSharedObjective",
              prerequisites: ["compatibleImmediateObjectives", "finiteCommittedPower", "specificPhysicalTarget", "temporaryMutualConsent"],
              exactContributions: { leftGodId: leftGod.id, leftReserveSpent: leftCost, rightGodId: rightGod.id, rightReserveSpent: rightCost, relationshipAtEvent: relation },
              stateDelta: { temporaryCompactEndsYear: endsYear, persistentConsequenceId: consequence.id, mergesGods: false, mergesFaiths: false, createsSovereignty: false },
              publicOutcome: "temporaryDivineCompact",
              publicEvidence: ["twoAuthenticatedSignatures", "jointPhysicalWorking", "publishedFiniteObjective"],
              publicAccount: `${identityById.get(leftGod.id)?.name || "One god"} and ${identityById.get(rightGod.id)?.name || "another god"} committed finite power to one shared physical objective. Their compact expired without merging either identity, faith, or civic authority.`,
              publiclyKnown: location.publicPlace && knownGodIds.has(leftGod.id) && knownGodIds.has(rightGod.id)
            };
            events.push(event);
            revealParticipants(event);
            continue;
          }
        }
        const god = pick(livingDivine, seed, `${channel}:intervening-god`);
        const location = eventLocation(seed, strategicMap, year, channel, siteStates, false);
        const maximumCost = Math.min(170, god.power.reserve - 1);
        if (maximumCost >= 24) {
          const cost = integerBetween(seed, `${channel}:cost`, 24, maximumCost);
          god.power.reserve -= cost;
          if (god.power.reserve < god.power.reserveCapacity * 0.35) god.lifecycle.publicStatus = "diminished";
          gods.set(god.id, god);
          const consequence = {
            id: `divine-consequence:${String(persistentConsequences.length + 1).padStart(3, "0")}`,
            kind: pick(INTERVENTION_KINDS, seed, `${channel}:effect`),
            godId: god.id,
            cityId: location.cityId,
            siteId: location.siteId,
            cellId: location.cellId,
            createdYear: year,
            persistsAtPlayableYear: seededNumber(seed, `${channel}:persists`) < 0.72,
            discoverable: true
          };
          persistentConsequences.push(consequence);
          const event = {
            id: `divine-event:${String(events.length + 1).padStart(3, "0")}`,
            year, kind: "divineIntervention", participantIds: [god.id], ...location,
            actualCause: god.privateObjective,
            prerequisites: ["activeDivinity", "finiteReserve", "physicalTarget", "manifestationAccess"],
            exactContributions: { reserveSpent: cost, reserveAfterward: god.power.reserve, worshipIncomeAtEvent: god.power.worshipIncome },
            stateDelta: { persistentConsequenceId: consequence.id, consequenceKind: consequence.kind, persistsAtPlayableYear: consequence.persistsAtPlayableYear },
            publicOutcome: consequence.kind,
            publicEvidence: ["authenticatedManifestation", "physicalAftereffects"],
            publicAccount: `${identityById.get(god.id)?.name || "A divine power"} carried out a finite ${title(consequence.kind).toLowerCase()} intervention. The lasting effect depends on maintained local institutions rather than permanent divine attention.`,
            publiclyKnown: location.publicPlace || knownGodIds.has(god.id)
          };
          events.push(event);
          revealParticipants(event);
          continue;
        }
      }

      const extraordinaryMortals = ascensionCandidates.filter((candidate) => candidate.availableYear <= year);
      if (roll >= 0.94 && descended.length && extraordinaryMortals.length && StrategicCapabilityHistory.CAPABILITY_BY_ID.mechanizedFrames) {
        const victim = pick(descended, seed, `${channel}:mortal-victim`);
        const killer = pick(extraordinaryMortals, seed, `${channel}:mortal-killer`);
        const location = eventLocation(seed, strategicMap, year, channel, siteStates, true);
        const capability = strategicMap.strategicCapabilityHistory.milestoneRows.find((row) => row.capabilityId === "mechanizedFrames");
        if ((killer.originKind === "beast" || capability.standardizationYear <= year) && seededNumber(seed, `${channel}:mortal-kill-eligibility`) < 0.07) {
          const killerId = `mortal-killer:${killer.id}`;
          identityById.set(killerId, { id: killerId, name: killer.name, epithet: "the Godslayer", domains: [], originKind: killer.originKind, originPubliclyKnown: true });
          recordDeath(victim.id, killerId, { id: `divine-event:${String(events.length + 1).padStart(3, "0")}`, year, ...location, publiclyKnown: location.publicPlace || knownGodIds.has(victim.id), prerequisites: ["extraordinaryMortalActor", "descendedTarget", killer.originKind === "beast" ? "transcendentBeastPower" : "mechanizedAndArcaneCapability", "identityKillingStrike"], mortalActor: clone(killer), exactCombatContext: { mortalTranscendentPower: 420 + killer.exceptionalCapabilities.length * 90 + (killer.populationIndex || 0), mechanizedCapabilityYear: killer.originKind === "human" ? capability.standardizationYear : null, targetDivineState: victim.lifecycle.divinityState, preparation: integerBetween(seed, `${channel}:mortal-preparation`, 240, 680), surprise: integerBetween(seed, `${channel}:mortal-surprise`, 180, 520) } }, 0, location.publicPlace || knownGodIds.has(victim.id), true);
        }
      }
    }

    const currentGods = [...gods.values()].sort((left, right) => left.id.localeCompare(right.id));
    const currentFaithRows = currentGods.map((god) => faithState(god, faithByGod.get(god.id)));
    const publicGodIds = currentGods.map((god) => god.id).filter((godId) => knownGodIds.has(godId));
    const publicDirectory = {
      historicalHorizonYear: horizonYear,
      knowledgePolicy: "supportedEventsAndAuthenticatedIdentitiesOnly",
      preCivicBaselineDigest: strategicMap.strategicDivinity.digest,
      identityRows: publicGodIds.map((godId) => publicIdentity(identityById.get(godId))),
      currentGodRows: publicGodIds.map((godId) => {
        const god = gods.get(godId);
        const faith = faithByGod.get(godId);
        return [godId, StrategicDivinity.DIVINE_RANKS.indexOf(god.rank), StrategicDivinity.LIFE_STATES.indexOf(god.lifecycle.lifeState), StrategicDivinity.DIVINITY_STATES.indexOf(god.lifecycle.divinityState), StrategicDivinity.PUBLIC_STATUSES.indexOf(god.lifecycle.publicStatus), faith.faithId, CONFIRMATION_STATES.indexOf(StrategicFaiths.confirmationStateForDivineLifecycle(god.lifecycle))];
      }),
      eventRows: publicEvents,
      successorRows: successors.filter((successor) => knownGodIds.has(successor.historicalGodId)).map((successor) => clone(successor)),
      siteRows: siteStates.filter((site) => site.publiclyKnownBeforeHistory || publicEvents.some((event) => event.siteId === site.siteId)).map((site) => ({ siteId: site.siteId, name: site.name, cellId: site.cellId, originPatronGodId: site.originPatronGodId, currentControllerGodId: site.currentControllerGodId, state: site.state })),
      remainsRows: remains.filter((entry) => entry.publiclyDiscovered).map((entry) => ({ id: entry.id, formerGodId: entry.formerGodId, cellId: entry.cellId, createdYear: entry.createdYear, kinds: clone(entry.kinds), identityPreserved: true, religionTransferred: false, discoverableHook: true })),
      consequenceRows: persistentConsequences.filter((entry) => entry.persistsAtPlayableYear && knownGodIds.has(entry.godId)).map((entry) => clone(entry)),
      principles: { descentIsNotDeath: true, deathPermanentByDefault: true, reascensionRestoresSameIdentity: true, victorsNeverInheritCompleteReligion: true, ascendantsCreateDistinctFaiths: true, temporaryDivineCompactsMergeFaiths: false, sameGodHeresyClaimsValid: false }
    };
    publicDirectory.digest = `public-divine-history-${StrategicWorld.stableHash(publicCore(publicDirectory))}`;
    const record = {
      historicalHorizonYear: horizonYear,
      sourceDivinityDigest: strategicMap.strategicDivinity.digest,
      sourceFaithDigest: strategicMap.preCivicFaiths.digest,
      sourceReligionDigest: strategicMap.strategicReligions.digest,
      sourceCityExpansionDigest: strategicMap.cityExpansionHistory.digest,
      sourceCapabilityDigest: strategicMap.strategicCapabilityHistory.digest,
      sourceBeastEcologyDigest: strategicMap.beastEcology.digest,
      sourceSettlementDigest: strategicMap.strategicSettlements.digest,
      publicDirectoryDigest: publicDirectory.digest,
      opportunityYears: years,
      eventRows: events,
      currentGodRows: currentGods,
      currentFaithRows,
      ascendedFaithRows: ascendedFaiths,
      successorRows: successors,
      holySiteStateRows: siteStates,
      remainsRows: remains,
      persistentConsequenceRows: persistentConsequences,
      diagnostics: {
        initialGodCount: initialGodIds.length,
        currentGodCount: currentGods.length,
        activeDivineCount: currentGods.filter((god) => god.lifecycle.lifeState === "living" && god.lifecycle.divinityState === "divine").length,
        descendedCount: currentGods.filter((god) => god.lifecycle.lifeState === "living" && god.lifecycle.divinityState === "descended").length,
        deadCount: currentGods.filter((god) => god.lifecycle.lifeState === "dead").length,
        ascendedGodCount: currentGods.filter((god) => !initialGodIds.includes(god.id)).length,
        retainedEventCount: events.length,
        publicEventCount: publicEvents.length,
        successorTraditionCount: successors.length,
        remainsCount: remains.length,
        persistentConsequenceCount: persistentConsequences.filter((entry) => entry.persistsAtPlayableYear).length,
        opportunityCount: years.length
      }
    };
    record.digest = `strategic-divine-history-${StrategicWorld.stableHash(historyCore(record))}`;
    return { strategicDivineHistory: record, publicDirectory };
  }

  function expandCurrentGod(row, directory) {
    const identity = directory.identityRows.find((entry) => entry.id === row[0]);
    return {
      ...clone(identity),
      rank: StrategicDivinity.DIVINE_RANKS[row[1]],
      lifeState: StrategicDivinity.LIFE_STATES[row[2]],
      divinityState: StrategicDivinity.DIVINITY_STATES[row[3]],
      publicStatus: StrategicDivinity.PUBLIC_STATUSES[row[4]],
      faithId: row[5],
      confirmationState: CONFIRMATION_STATES[row[6]],
      exactPowerPublic: false
    };
  }

  function publicDivineHistory(map) {
    const directory = map?.publicDivineHistoryDirectory;
    if (!directory) return null;
    return {
      historicalHorizonYear: directory.historicalHorizonYear,
      knowledgePolicy: directory.knowledgePolicy,
      currentGods: directory.currentGodRows.map((row) => expandCurrentGod(row, directory)),
      chronology: clone(directory.eventRows),
      successorTraditions: clone(directory.successorRows),
      holySites: clone(directory.siteRows),
      remains: clone(directory.remainsRows),
      persistentConsequences: clone(directory.consequenceRows),
      principles: clone(directory.principles),
      digest: directory.digest
    };
  }

  function cellPublicDivineHistorySnapshot(map, index) {
    if (!map?.publicDivineHistoryDirectory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const directory = publicDivineHistory(map);
    return {
      cellId,
      events: directory.chronology.filter((event) => event.cellId === cellId),
      holySites: directory.holySites.filter((site) => site.cellId === cellId),
      remains: directory.remains.filter((entry) => entry.cellId === cellId),
      persistentConsequences: directory.persistentConsequences.filter((entry) => entry.cellId === cellId)
    };
  }

  function validateStrategicDivineHistory(map, record = map?.strategicDivineHistory, directory = map?.publicDivineHistoryDirectory) {
    const strategicMap = validateSources(map);
    if (!record || !directory || record.sourceDivinityDigest !== strategicMap.strategicDivinity.digest || record.sourceFaithDigest !== strategicMap.preCivicFaiths.digest || record.sourceReligionDigest !== strategicMap.strategicReligions.digest || record.sourceCityExpansionDigest !== strategicMap.cityExpansionHistory.digest || record.sourceCapabilityDigest !== strategicMap.strategicCapabilityHistory.digest || record.sourceBeastEcologyDigest !== strategicMap.beastEcology.digest || record.sourceSettlementDigest !== strategicMap.strategicSettlements.digest || record.publicDirectoryDigest !== directory.digest || directory.preCivicBaselineDigest !== strategicMap.strategicDivinity.digest) throw new Error("Divine history is incomplete or does not match its causal source world.");
    if (!Number.isInteger(record.historicalHorizonYear) || record.historicalHorizonYear !== strategicMap.cityExpansionHistory.historicalHorizonYear || !Array.isArray(record.opportunityYears) || record.opportunityYears.some((year, index) => !Number.isInteger(year) || year <= 0 || year > record.historicalHorizonYear || index && year <= record.opportunityYears[index - 1])) throw new Error("Divine-history opportunity chronology is invalid.");
    const invalidEvent = Array.isArray(record.eventRows) ? record.eventRows.find((event, index) => !EVENT_KINDS.includes(event.kind) || !Number.isInteger(event.year) || event.year > record.historicalHorizonYear || index && event.year < record.eventRows[index - 1].year || !event.cellId || !Array.isArray(event.participantIds) || !event.participantIds.length || !Array.isArray(event.prerequisites) || !event.prerequisites.length || !event.exactContributions || !event.stateDelta || !event.publicOutcome || !Array.isArray(event.publicEvidence)) : null;
    if (!Array.isArray(record.eventRows) || new Set(record.eventRows.map((event) => event.id)).size !== record.eventRows.length || invalidEvent) throw new Error(`A retained divine event lacks causal participants, prerequisites, location, contributions, or saved consequences${invalidEvent?.id ? ` (${invalidEvent.id}:${invalidEvent.kind})` : ""}.`);
    if (!Array.isArray(record.currentGodRows) || new Set(record.currentGodRows.map((god) => god.id)).size !== record.currentGodRows.length || record.currentGodRows.some((god) => !godStateIsValid(god)) || strategicMap.strategicDivinity.godOrder.some((godId) => !record.currentGodRows.some((god) => god.id === godId))) throw new Error("Playable-year canonical divine states are invalid or lost a pre-civic identity.");
    const assignedWorshipByPopulation = new Map();
    for (const god of record.currentGodRows) for (const source of god.worshipSources) assignedWorshipByPopulation.set(source.sourcePopulationId, (assignedWorshipByPopulation.get(source.sourcePopulationId) || 0) + source.followerUnits);
    if (record.currentGodRows.some((god) => god.worshipSources.some((source) => assignedWorshipByPopulation.get(source.sourcePopulationId) > source.sourcePopulationUnits))) throw new Error("Historical worship and ascension exceed a source population's devotional capacity.");
    if (!Array.isArray(record.currentFaithRows) || record.currentFaithRows.length !== record.currentGodRows.length || record.currentFaithRows.some((faith) => !record.currentGodRows.some((god) => god.id === faith.godId && faith.confirmationState === StrategicFaiths.confirmationStateForDivineLifecycle(god.lifecycle)) || faith.sameGodHeresyClaimsValid)) throw new Error("Playable-year faith confirmation does not match divine lifecycle.");
    if (!Array.isArray(record.successorRows) || record.successorRows.some((successor) => successor.confirmationState !== "unconfirmedSuccessor" || successor.correctionAuthorityId !== null || successor.sameGodHeresyClaimsValid || successor.sovereignAuthority || !SUCCESSOR_RESOLUTIONS.includes(successor.resolution))) throw new Error("Religious successors must remain distinct, unconfirmed, non-sovereign traditions without valid same-god heresy claims.");
    if (!Array.isArray(record.remainsRows) || record.remainsRows.some((remains) => !record.currentGodRows.some((god) => god.id === remains.formerGodId && god.lifecycle.lifeState === "dead") || !remains.identityPreserved || remains.religionTransferred || !remains.discoverableHook || !Number.isInteger(remains.exactResidualPower))) throw new Error("Divine remains do not preserve permanent death, identity, or discoverable consequences.");
    if (!Array.isArray(record.holySiteStateRows) || record.holySiteStateRows.length !== strategicMap.preCivicFaiths.holySiteRows.length || record.holySiteStateRows.some((site) => !SITE_STATES.includes(site.state) || !strategicMap.preCivicFaiths.holySiteRows.some((row) => row[0] === site.siteId && row[1] === site.originPatronGodId))) throw new Error("Divine history changed a holy site's pre-civic origin or produced an invalid current state.");
    for (const event of record.eventRows.filter((entry) => entry.kind === "divineDeath" || entry.kind === "mortalGodKilling")) {
      if (event.stateDelta.victimLifeState !== "dead" || !record.remainsRows.some((remains) => remains.id === event.stateDelta.remainsId) || event.stateDelta.identityTransferred || event.stateDelta.religionTransferred) throw new Error("A divine death must be permanent and leave identity-preserving remains without religion transfer.");
    }
    for (const event of record.eventRows.filter((entry) => entry.kind === "forcedDescent" || entry.kind === "worshipCollapse")) if (event.stateDelta.lifeState === "dead" || event.stateDelta.loserLifeState === "dead" || !event.stateDelta.identityPreserved || !event.stateDelta.retainedMortalPower) throw new Error("Descent must preserve the same living extraordinary individual.");
    for (const event of record.eventRows.filter((entry) => entry.kind === "mortalAscension")) if (event.prerequisites.length < 7 || !record.ascendedFaithRows.some((faith) => faith.godId === event.stateDelta.newGodId && faith.distinctFromPredecessorFaith)) throw new Error("Ascension requires causal mortal, physical, worship, identity, and survival prerequisites and a distinct faith.");
    const publicJson = JSON.stringify(directory);
    if (/exactContributions|actualCause|followerDispositionRows|worshipIncome|reserveAfterward|attackerScore|defenderScore|transferredFollowerUnits|exactResidualPower/.test(publicJson)) throw new Error("Public divine history leaks exact power, worship, combat, or hidden causal facts.");
    if (directory.knowledgePolicy !== "supportedEventsAndAuthenticatedIdentitiesOnly" || !Array.isArray(directory.currentGodRows) || directory.currentGodRows.some((row) => !directory.identityRows.some((identity) => identity.id === row[0])) || directory.successorRows.some((successor) => successor.confirmationState !== "unconfirmedSuccessor" || successor.sameGodHeresyClaimsValid) || directory.remainsRows.some((entry) => !entry.identityPreserved || entry.religionTransferred)) throw new Error("The public divine directory violates knowledge, succession, or remains rules.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.initialGodCount !== strategicMap.strategicDivinity.godOrder.length || diagnostics.currentGodCount !== record.currentGodRows.length || diagnostics.activeDivineCount !== record.currentGodRows.filter((god) => god.lifecycle.lifeState === "living" && god.lifecycle.divinityState === "divine").length || diagnostics.descendedCount !== record.currentGodRows.filter((god) => god.lifecycle.lifeState === "living" && god.lifecycle.divinityState === "descended").length || diagnostics.deadCount !== record.currentGodRows.filter((god) => god.lifecycle.lifeState === "dead").length || diagnostics.ascendedGodCount !== record.currentGodRows.length - diagnostics.initialGodCount || diagnostics.ascendedGodCount > 1 || diagnostics.retainedEventCount !== record.eventRows.length || diagnostics.publicEventCount !== directory.eventRows.length || diagnostics.successorTraditionCount !== record.successorRows.length || diagnostics.remainsCount !== record.remainsRows.length || diagnostics.opportunityCount !== record.opportunityYears.length) throw new Error("Divine-history diagnostics do not match saved facts.");
    if (directory.digest !== `public-divine-history-${StrategicWorld.stableHash(publicCore(directory))}` || record.digest !== `strategic-divine-history-${StrategicWorld.stableHash(historyCore(record))}`) throw new Error("Divine history does not match its digest.");
    return { strategicDivineHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicDivineHistory(worldSeed, map, options = {}) {
    const next = validateSources(map);
    const generated = createStrategicDivineHistory(worldSeed, next, options);
    next.strategicDivineHistory = generated.strategicDivineHistory;
    next.publicDivineHistoryDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function currentDivineStateFor(map, godId) {
    const god = map?.strategicDivineHistory?.currentGodRows?.find((entry) => entry.id === godId);
    return god ? clone(god) : null;
  }

  function auditStrategicDivineHistory(map) {
    const { strategicDivineHistory: record, publicDirectory } = validateStrategicDivineHistory(map);
    return {
      valid: true,
      preCivicBaselineImmutable: record.sourceDivinityDigest === map.strategicDivinity.digest,
      retainedEventsHaveConsequences: record.eventRows.every((event) => event.stateDelta && event.prerequisites.length && event.cellId),
      descentPreservesLivingIdentity: record.eventRows.filter((event) => ["forcedDescent", "worshipCollapse"].includes(event.kind)).every((event) => event.stateDelta.identityPreserved && event.stateDelta.retainedMortalPower && event.stateDelta.lifeState !== "dead" && event.stateDelta.loserLifeState !== "dead"),
      deathPermanentAndIdentityNotTransferred: record.eventRows.filter((event) => ["divineDeath", "mortalGodKilling"].includes(event.kind)).every((event) => event.stateDelta.victimLifeState === "dead" && !event.stateDelta.identityTransferred && !event.stateDelta.religionTransferred),
      ascensionsRequireCausalPrerequisites: record.eventRows.filter((event) => event.kind === "mortalAscension").every((event) => event.prerequisites.length >= 7),
      successorsRemainUnconfirmed: record.successorRows.every((successor) => successor.confirmationState === "unconfirmedSuccessor" && !successor.sameGodHeresyClaimsValid),
      publicHistoryHidesExactPowerAndCausality: !JSON.stringify(publicDirectory).match(/exactContributions|actualCause|followerDispositionRows|worshipIncome|reserveAfterward|attackerScore|defenderScore|transferredFollowerUnits|exactResidualPower/),
      quietWorldsAllowed: record.eventRows.length <= record.opportunityYears.length,
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({
    EVENT_KINDS, CONFIRMATION_STATES, SITE_STATES, SUCCESSOR_RESOLUTIONS, INTERVENTION_KINDS,
    createStrategicDivineHistory, validateStrategicDivineHistory, attachStrategicDivineHistory,
    publicDivineHistory, cellPublicDivineHistorySnapshot, currentDivineStateFor, auditStrategicDivineHistory
  });
});
