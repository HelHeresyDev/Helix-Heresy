(function initStrategicReligions(root, factory) {
  const themeContent = typeof module === "object" && module.exports
    ? require("./theme-content")
    : root?.HelixThemeContent;
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const cityRecognition = typeof module === "object" && module.exports
    ? require("./strategic-city-recognition")
    : root?.HelixStrategicCityRecognition;
  const api = factory(themeContent, strategicWorld, cityRecognition);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicReligions = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicReligionsApi(ThemeContent, StrategicWorld, StrategicCityRecognition) {
  "use strict";

  if (!ThemeContent) throw new Error("HelixThemeContent must load before strategic-religions.js");
  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-religions.js");
  if (!StrategicCityRecognition) throw new Error("HelixStrategicCityRecognition must load before strategic-religions.js");

  const RELIGIOUS_STANDINGS = Object.freeze(["established", "recognized", "tolerated", "restricted", "proscribed"]);
  const STANDING_CODES = Object.freeze({ established: "e", recognized: "r", tolerated: "t", restricted: "x", proscribed: "p" });
  const STANDING_BY_CODE = Object.freeze(Object.fromEntries(Object.entries(STANDING_CODES).map(([key, value]) => [value, key])));
  const ADHERENT_BANDS = Object.freeze(["trace", "minority", "significant", "majority", "dominant"]);
  const CAPACITY_BANDS = Object.freeze(["fragile", "strained", "functional", "strong", "exceptional"]);
  const BRANCH_FORMS = Object.freeze(["templeChapter", "chapelHouse", "ritualGuild", "monasticHouse", "mysteryCult"]);
  const NETWORK_ROLES = Object.freeze(["doctrine", "ritual", "pastoralCare", "charity", "burialAndSoulCare", "relicCustody", "publicAdvocacy", "security", "investigation", "intercityCommunication"]);
  const DIVINE_RELATIONS = Object.freeze(["allied", "cooperative", "neutral", "rival", "hostile"]);
  const SITE_KINDS = Object.freeze(["manifestationSanctuary", "avatarAnchor", "relicSanctum", "pilgrimageShrine", "divineThreshold"]);
  const ATTENTION_BANDS = Object.freeze(["diffuse", "watchful", "focused", "urgent"]);
  const MANIFESTATION_RESERVES = Object.freeze(["low", "moderate", "high"]);
  const PRIVATE_PRIORITIES = Object.freeze(["protectFaithful", "expandWorship", "opposeRival", "guardHolySite", "prepareAvatar", "observeMortals"]);
  const ATTENTION_CODES = Object.freeze({ diffuse: "0", watchful: "1", focused: "2", urgent: "3" });
  const RESERVE_CODES = Object.freeze({ low: "0", moderate: "1", high: "2" });
  const PRIORITY_CODES = Object.freeze({ protectFaithful: "0", expandWorship: "1", opposeRival: "2", guardHolySite: "3", prepareAvatar: "4", observeMortals: "5" });

  function deityDefinition(definition) {
    return Object.freeze({
      kind: "deityArchetype",
      template: "{deityName}, {epithet}, is a real finite god who communicates directly with the faithful.",
      ...definition,
      contentTags: Object.freeze([...definition.contentTags]),
      domains: Object.freeze([...definition.domains]),
      nameOpenings: Object.freeze([...definition.nameOpenings]),
      nameEndings: Object.freeze([...definition.nameEndings]),
      epithets: Object.freeze([...definition.epithets]),
      personalities: Object.freeze([...definition.personalities]),
      priorities: Object.freeze([...definition.priorities]),
      prohibitions: Object.freeze([...definition.prohibitions]),
      communicationMethods: Object.freeze([...definition.communicationMethods]),
      avatarForms: Object.freeze([...definition.avatarForms])
    });
  }

  const DEITY_DEFINITIONS = Object.freeze([
    deityDefinition({ id: "deity.shared.hearth", compatibility: "shared", contentTags: ["fortified-civilization", "hope", "magic"], domains: ["shelter", "healing", "charity"], preferredAspect: "L", nameOpenings: ["Auri", "Hesta", "Luma", "Vara"], nameEndings: ["el", "ra", "th", "wyn"], epithets: ["Keeper of the Living Hearth", "The Open Hand", "Guardian Within the Walls"], personalities: ["patient", "protective", "plainspoken"], priorities: ["protect communities", "shelter the displaced", "repair what violence breaks"], prohibitions: ["betraying sanctuary", "withholding emergency aid"], communicationMethods: ["answered hearth-prayer", "warmth-marked dreams", "consecrated public terminals"], avatarForms: ["radiant civic guardian", "many-handed healer"] }),
    deityDefinition({ id: "deity.shared.threshold", compatibility: "shared", contentTags: ["magic", "neutral", "science"], domains: ["souls", "death", "resurrection"], preferredAspect: "T", nameOpenings: ["Eid", "Mora", "Neme", "Than"], nameEndings: ["ara", "ion", "os", "veil"], epithets: ["Warden of Returning Memory", "The Last and First Witness", "Keeper of the Threshold"], personalities: ["formal", "compassionate", "unhurried"], priorities: ["preserve personal continuity", "prevent soul destruction", "record true deaths"], prohibitions: ["coerced soul transfer", "erasure of identity"], communicationMethods: ["lucid threshold dreams", "soul-resonant liturgy", "direct funerary audience"], avatarForms: ["masked psychopomp", "luminous ancestral figure"] }),
    deityDefinition({ id: "deity.shared.forge", compatibility: "shared", contentTags: ["invention", "magic", "science"], domains: ["craft", "invention", "flame"], preferredAspect: "F", nameOpenings: ["Brass", "Cindra", "Ferr", "Vul"], nameEndings: ["ax", "enne", "ion", "or"], epithets: ["The Unfinished Maker", "Patron of Useful Fire", "Smith of Impossible Instruments"], personalities: ["demanding", "curious", "generous with instruction"], priorities: ["teach difficult crafts", "improve essential tools", "reward demonstrated skill"], prohibitions: ["fraudulent workmanship", "deliberate destruction of knowledge"], communicationMethods: ["workshop apparitions", "inscribed machine responses", "forge-trance instruction"], avatarForms: ["living brass artisan", "walking furnace of runes"] }),
    deityDefinition({ id: "deity.shared.wild", compatibility: "shared", contentTags: ["beast-dominance", "magic", "survival"], domains: ["beasts", "wilderness", "hunting"], preferredAspect: "E", nameOpenings: ["Ard", "Koru", "Rhae", "Tala"], nameEndings: ["fang", "mar", "ra", "ven"], epithets: ["Voice Beyond the Wall", "The Measured Hunt", "Shepherd of Claw and Horn"], personalities: ["direct", "territorial", "respectful of strength"], priorities: ["preserve ecological balance", "test hunters", "oppose wasteful killing"], prohibitions: ["cruel sport", "destruction of breeding grounds"], communicationMethods: ["spoken beast-omens", "wilderness visions", "direct audience at marked stones"], avatarForms: ["crowned chimera", "towering horned hunter"] }),
    deityDefinition({ id: "deity.madcap.mutation", compatibility: "madcap", contentTags: ["absurdity", "hope", "invention", "science"], domains: ["transformation", "genetics", "beauty"], preferredAspect: "L", nameOpenings: ["Bloom", "Geno", "Miri", "Prism"], nameEndings: ["abelle", "ara", "ix", "une"], epithets: ["The Kindly Revision", "Patron of Better Tails", "She Who Celebrates the Next Draft"], personalities: ["enthusiastic", "affectionate", "restlessly inventive"], priorities: ["encourage consensual transformation", "celebrate novel life", "repair harmful inheritance"], prohibitions: ["nonconsensual alteration", "discarding failed creations"], communicationMethods: ["shared laboratory dreams", "responsive living icons", "cheerful direct prayer"], avatarForms: ["many-featured celebrant", "shifting idealized self"] }),
    deityDefinition({ id: "deity.madcap.chance", compatibility: "madcap", contentTags: ["absurdity", "hope", "magic"], domains: ["chance", "discovery", "improvisation"], preferredAspect: "A", nameOpenings: ["Fortu", "Jinx", "Quirk", "Tumble"], nameEndings: ["bell", "ia", "o", "spark"], epithets: ["The Fortunate Mistake", "Lord of the Useful Accident", "Patron of the Third Attempt"], personalities: ["playful", "cryptic", "surprisingly responsible"], priorities: ["reward adaptive thinking", "interrupt fatal certainty", "preserve second chances"], prohibitions: ["rigging games against the helpless", "mistaking luck for innocence"], communicationMethods: ["impossible coincidences with signatures", "dice-lit visions", "spontaneous spoken replies"], avatarForms: ["laughing masked traveler", "constellation of tumbling charms"] }),
    deityDefinition({ id: "deity.madcap.courier", compatibility: "madcap", contentTags: ["fortified-civilization", "invention", "magic"], domains: ["messages", "travel", "wind"], preferredAspect: "A", nameOpenings: ["Aero", "Kite", "Mercu", "Whistle"], nameEndings: ["fin", "rel", "rix", "wing"], epithets: ["The Never-Lost Message", "Courier Above the Beasts", "Friend of Open Channels"], personalities: ["impatient", "sociable", "fiercely reliable"], priorities: ["keep communication open", "deliver warnings", "protect travelers in motion"], prohibitions: ["silencing emergency messages", "betraying entrusted correspondence"], communicationMethods: ["authenticated divine messages", "wind-carried speech", "holographic visitation"], avatarForms: ["winged courier", "living ribbon of signal-light"] }),
    deityDefinition({ id: "deity.madcap.revel", compatibility: "madcap", contentTags: ["absurdity", "hope", "neutral"], domains: ["celebration", "affection", "courage"], preferredAspect: "S", nameOpenings: ["Carni", "Jubi", "Pippa", "Viva"], nameEndings: ["elle", "loon", "ra", "vox"], epithets: ["The Defiant Festival", "Lady of Courageous Affection", "The Dance Before Dawn"], personalities: ["warm", "dramatic", "unyielding before despair"], priorities: ["strengthen communal joy", "honor survival", "turn fear into solidarity"], prohibitions: ["coerced celebration", "humiliation of mourners"], communicationMethods: ["choral response", "festival avatars", "shared waking visions"], avatarForms: ["towering carnival saint", "radiant dancer in impossible colors"] }),
    deityDefinition({ id: "deity.grim.wall", compatibility: "grim", contentTags: ["fortified-civilization", "survival", "warfare"], domains: ["walls", "duty", "defense"], preferredAspect: "E", nameOpenings: ["Bast", "Khar", "Morda", "Vigil"], nameEndings: ["ion", "os", "ra", "ward"], epithets: ["The Unbroken Watch", "Keeper of the Final Gate", "He Who Stands When Others Flee"], personalities: ["severe", "protective", "incapable of retreat"], priorities: ["hold defended ground", "prepare before disaster", "honor necessary sacrifice"], prohibitions: ["abandoning dependents", "sabotaging defenses"], communicationMethods: ["ward-line speech", "sentinel dreams", "direct command through consecrated alarms"], avatarForms: ["armored gate colossus", "living wall of eyes and shields"] }),
    deityDefinition({ id: "deity.grim.ash", compatibility: "grim", contentTags: ["body-horror", "magic", "survival"], domains: ["death", "mercy", "memory"], preferredAspect: "T", nameOpenings: ["Ash", "Mourn", "Palla", "Sere"], nameEndings: ["a", "enne", "iel", "oth"], epithets: ["Mercy After Ruin", "The Ashen Archivist", "She Who Remembers the Unreturned"], personalities: ["sorrowful", "precise", "merciful without sentiment"], priorities: ["end hopeless suffering", "preserve names of the dead", "oppose soul mutilation"], prohibitions: ["erasing victims", "prolonging pain for spectacle"], communicationMethods: ["memorial flame speech", "shared mourning dreams", "audible names in ash"], avatarForms: ["veiled ash physician", "black-winged memorial figure"] }),
    deityDefinition({ id: "deity.grim.oath", compatibility: "grim", contentTags: ["coercion", "institutional-cruelty", "warfare"], domains: ["oaths", "punishment", "dominion"], preferredAspect: "S", nameOpenings: ["Drav", "Judic", "Sever", "Vark"], nameEndings: ["an", "ex", "or", "us"], epithets: ["The Binding Word", "Judge of Broken Compacts", "Lord of the Price Owed"], personalities: ["literal", "authoritarian", "predictably honorable"], priorities: ["enforce sworn obligations", "punish betrayal", "make authority answer for its promises"], prohibitions: ["secretly changing terms", "false oath evidence"], communicationMethods: ["oath-marked speech", "judicial trance", "contract glyph response"], avatarForms: ["iron-robed judge", "many-chained adjudicator"] }),
    deityDefinition({ id: "deity.grim.veil", compatibility: "grim", contentTags: ["magic", "neutral", "survival"], domains: ["secrets", "investigation", "night"], preferredAspect: "I", nameOpenings: ["Noct", "Sable", "Vesper", "Ysil"], nameEndings: ["a", "ene", "oth", "veil"], epithets: ["The Patient Witness", "Watcher Behind Closed Eyes", "Finder of Buried Causes"], personalities: ["reserved", "relentless", "hostile to easy answers"], priorities: ["reveal supported truth", "protect necessary confidences", "expose fabricated evidence"], prohibitions: ["presuming guilt", "destroying exculpatory records"], communicationMethods: ["verified investigative dreams", "shadow-script response", "private direct audience"], avatarForms: ["faceless night investigator", "cloak of articulated eyes"] })
  ]);
  const DEITY_REGISTRY = ThemeContent.createRegistry(DEITY_DEFINITIONS);

  const MOVEMENT_DEFINITIONS = Object.freeze([
    Object.freeze({ id: "mortal-autonomy", name: "The Mortal Autonomy Forum", summary: "The gods are real and powerful, but worship is a voluntary relationship rather than a debt owed by existence.", priorities: ["mortal self-determination", "transparent divine contracts", "freedom from compelled worship"] }),
    Object.freeze({ id: "arcane-naturalism", name: "The Arcane Naturalist Communion", summary: "Gods are living participants in magical reality, worthy of study and negotiation without being treated as infallible creators.", priorities: ["empirical study of divinity", "public miracle records", "bounded avatar access"] }),
    Object.freeze({ id: "human-solidarity", name: "The Human Solidarity Compact", summary: "Humans must cooperate against beast domination regardless of which real god, if any, they choose to worship.", priorities: ["interfaith emergency aid", "city survival", "opposition to sectarian violence"] })
  ]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function pick(values, seed, channel) {
    return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length];
  }

  function pickDistinct(values, count, seed, channel) {
    return [...values]
      .map((value) => ({ value, score: seededNumber(seed, `${channel}:${typeof value === "string" ? value : value.id}`) }))
      .sort((left, right) => left.score - right.score || String(left.value.id || left.value).localeCompare(String(right.value.id || right.value)))
      .slice(0, Math.min(count, values.length))
      .map((entry) => entry.value);
  }

  function uniqueGodName(definition, seed, usedNames) {
    const opening = pick(definition.nameOpenings, seed, "god-name-opening");
    const ending = pick(definition.nameEndings, seed, "god-name-ending");
    let name = `${opening}${ending}`;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${opening}${ending} ${suffix}`;
      suffix += 1;
    }
    usedNames.add(name);
    return name;
  }

  function doctrineFor(definition, seed) {
    const domains = new Set(definition.domains);
    const choose = (topic, values) => pick(values, seed, `doctrine:${topic}`);
    return {
      geneticEngineering: domains.has("genetics") || domains.has("transformation") ? "sacredWhenConsensual" : choose("geneticEngineering", ["permittedWithConsent", "regulatedStewardship", "forbiddenViolation", "noSpecialDoctrine"]),
      artificialCreatureCreation: domains.has("craft") || domains.has("invention") ? "permittedWithCreatorDuty" : choose("artificialCreatureCreation", ["permittedWithCreatorDuty", "regulatedStewardship", "forbiddenImitation", "noSpecialDoctrine"]),
      animancy: domains.has("souls") || domains.has("death") ? "narrowHealingAndFuneraryUseOnly" : choose("animancy", ["forbiddenSoulViolation", "narrowHealingAndFuneraryUseOnly", "regulatedSacrament"]),
      resurrection: domains.has("resurrection") ? "sacredRestorationWithContinuity" : choose("resurrection", ["acceptedWithContinuityProof", "conditionalDivineReview", "forbiddenReturn", "noSpecialDoctrine"]),
      magicalBeasts: domains.has("beasts") || domains.has("wilderness") ? "ecologicalStewardshipAndMeasuredHunt" : choose("magicalBeasts", ["defensiveExtermination", "studyAndContainment", "coexistenceWherePossible", "domesticationAndUse"]),
      humanModification: domains.has("transformation") ? "affirmedWithConsent" : choose("humanModification", ["affirmedWithConsent", "regulatedByDuty", "discouraged", "forbidden"]),
      punishment: domains.has("mercy") ? "restorativeMercy" : (domains.has("punishment") ? "strictProportionalJudgment" : choose("punishment", ["restorativeMercy", "proportionalJudgment", "severeCivicProtection"])),
      slavery: domains.has("dominion") ? "permittedOnlyByExplicitDivineCovenant" : choose("slavery", ["alwaysForbidden", "alwaysForbidden", "penalBondageAlsoForbidden", "noSpecialDoctrine"]),
      warfare: domains.has("defense") || domains.has("walls") ? "defensiveWarAsDuty" : (domains.has("hunting") ? "sanctionedWildernessWar" : choose("warfare", ["defensiveOnly", "sanctionedForDeclaredCause", "pacifistExceptImmediateDefense"])),
      civicAuthority: domains.has("dominion") || domains.has("oaths") ? "authorityBoundByPublishedOath" : choose("civicAuthority", ["cooperationWithoutDivineSovereignty", "conditionalMoralSupport", "strictSeparationFromChurch"])
    };
  }

  function selectedDeityDefinitions(worldTheme, seed) {
    const eligible = ThemeContent.eligibleDefinitions(DEITY_REGISTRY, { kind: "deityArchetype", worldTheme });
    const count = worldTheme === "unbound" ? 9 : 7;
    return pickDistinct(eligible, count, seed, "deity-archetype");
  }

  function createGods(worldSeed, worldTheme) {
    const usedNames = new Set();
    return selectedDeityDefinitions(worldTheme, worldSeed).map((definition, index) => {
      const ordinal = String(index + 1).padStart(2, "0");
      const godSeed = `${worldSeed}:${definition.id}`;
      const name = uniqueGodName(definition, godSeed, usedNames);
      const epithet = pick(definition.epithets, godSeed, "epithet");
      return {
        id: `god:${ordinal}`,
        kind: "realFiniteGod",
        name,
        epithet,
        publicSummary: ThemeContent.renderTemplate(definition.template, { deityName: name, epithet }),
        domains: [...definition.domains],
        personality: pick(definition.personalities, godSeed, "personality"),
        priorities: [...definition.priorities],
        prohibitions: [...definition.prohibitions],
        objectiveExistence: "confirmed",
        omnipotent: false,
        omniscient: false,
        attentionFinite: true,
        communication: {
          routine: true,
          faithfulMayReceiveDirectReplies: true,
          methods: [...definition.communicationMethods],
          identityVerification: "repeatableDivineSignature"
        },
        avatarManifestation: {
          possible: true,
          strategicallySignificant: true,
          fullManifestationCost: pick(["substantial", "severe", "extreme"], godSeed, "manifestation-cost"),
          forms: [...definition.avatarForms]
        },
        doctrine: doctrineFor(definition, godSeed),
        preferredArcaneAspect: definition.preferredAspect,
        themeContent: { definitionId: definition.id, sourceTheme: definition.compatibility, contentTags: [...definition.contentTags] }
      };
    });
  }

  function createTraditionsAndNetworks(worldSeed, gods) {
    const traditions = [];
    const networks = [];
    for (const god of gods) {
      const ordinal = god.id.slice(4);
      const traditionId = `tradition:divine:${ordinal}`;
      const networkId = `faith-network:${ordinal}`;
      traditions.push({
        id: traditionId,
        kind: "confirmedDivineFaith",
        name: `The Faith of ${god.name}`,
        deityIds: [god.id],
        acknowledgesGodsAreReal: true,
        worshipRequiredByDoctrine: god.domains.includes("dominion"),
        confirmedDoctrine: clone(god.doctrine),
        doctrinalSchismAvailable: false,
        sameGodHeresyClaimsValid: false,
        correctionAuthority: god.id,
        correctionChannel: "routineDirectDivineCommunication",
        networkId
      });
      networks.push({
        id: networkId,
        kind: "singleGodChurchNetwork",
        name: pick([`The ${god.epithet} Communion`, `The Church of ${god.name}`, `The ${god.name} Covenant`], worldSeed, `network-name:${god.id}`),
        traditionId,
        recognizedByDeityId: god.id,
        internetReach: "global",
        physicalAuthority: "localBranchesOnly",
        sovereignAuthority: false,
        roles: [...NETWORK_ROLES],
        doctrinalCompetitorsForSameGod: false
      });
    }
    const selectedMovements = pickDistinct(MOVEMENT_DEFINITIONS, 2, worldSeed, "non-theistic-movement");
    for (const [index, movement] of selectedMovements.entries()) {
      const ordinal = String(index + 1).padStart(2, "0");
      const traditionId = `tradition:non-theistic:${ordinal}`;
      const networkId = `movement-network:${ordinal}`;
      traditions.push({
        id: traditionId,
        kind: "nonTheisticMovement",
        name: movement.name,
        deityIds: [],
        acknowledgesGodsAreReal: true,
        worshipRequiredByDoctrine: false,
        publicSummary: movement.summary,
        priorities: [...movement.priorities],
        doctrinalSchismAvailable: true,
        sameGodHeresyClaimsValid: false,
        networkId
      });
      networks.push({
        id: networkId,
        kind: "philosophicalReligiousNetwork",
        name: movement.name,
        traditionId,
        recognizedByDeityId: null,
        internetReach: "global",
        physicalAuthority: "localBranchesOnly",
        sovereignAuthority: false,
        roles: [...NETWORK_ROLES],
        doctrinalCompetitorsForSameGod: false
      });
    }
    return { traditions, networks };
  }

  function standingRowsFor(worldSeed, cities, traditions) {
    return cities.map((city) => {
      const establishedIndex = seededNumber(worldSeed, `established-faith:${city.id}`) < 0.62
        ? Math.floor(seededNumber(worldSeed, `established-faith-choice:${city.id}`) * traditions.length) % traditions.length
        : -1;
      return traditions.map((tradition, index) => {
        if (index === establishedIndex) return STANDING_CODES.established;
        const roll = seededNumber(worldSeed, `religious-standing:${city.id}:${tradition.id}`);
        return roll < 0.2 ? STANDING_CODES.recognized : (roll < 0.66 ? STANDING_CODES.tolerated : (roll < 0.9 ? STANDING_CODES.restricted : STANDING_CODES.proscribed));
      }).join("");
    });
  }

  function branchFor(worldSeed, city, tradition, standing, cityIndex, traditionIndex) {
    const presenceChance = ({ established: 1, recognized: 1, tolerated: 0.3, restricted: 0.2, proscribed: 0 })[standing];
    if (seededNumber(worldSeed, `branch-presence:${city.id}:${tradition.id}`) >= presenceChance) return null;
    const capacityScore = seededNumber(worldSeed, `branch-capacity:${city.id}:${tradition.id}`) + ({ established: 0.65, recognized: 0.35, tolerated: 0.1, restricted: -0.2 })[standing];
    const capacityBand = CAPACITY_BANDS[Math.max(0, Math.min(CAPACITY_BANDS.length - 1, Math.floor(capacityScore * 3)))];
    const adherentBand = standing === "established" ? pick(["majority", "dominant"], worldSeed, `adherents:${city.id}:${tradition.id}`)
      : standing === "recognized" ? pick(["significant", "majority"], worldSeed, `adherents:${city.id}:${tradition.id}`)
        : standing === "restricted" ? pick(["trace", "minority"], worldSeed, `adherents:${city.id}:${tradition.id}`)
          : pick(["minority", "significant"], worldSeed, `adherents:${city.id}:${tradition.id}`);
    const roles = pickDistinct(NETWORK_ROLES, 5, `${worldSeed}:${city.id}:${tradition.id}`, "branch-role");
    const organizationForm = pick(BRANCH_FORMS, worldSeed, `branch-form:${city.id}:${tradition.id}`);
    const roleCodes = roles.map((role) => NETWORK_ROLES.indexOf(role).toString(36)).join("");
    return `${cityIndex.toString(36).padStart(2, "0")}${traditionIndex.toString(36)}${BRANCH_FORMS.indexOf(organizationForm).toString(36)}${ADHERENT_BANDS.indexOf(adherentBand).toString(36)}${CAPACITY_BANDS.indexOf(capacityBand).toString(36)}${roleCodes}`;
  }

  function expandBranch(code, directory, map) {
    if (!code) return null;
    const cityIndex = parseInt(code.slice(0, 2), 36);
    const traditionIndex = parseInt(code[2], 36);
    const city = map.humanGeography.cities[cityIndex];
    const tradition = directory.traditions[traditionIndex];
    const network = directory.networks.find((entry) => entry.traditionId === tradition.id);
    return {
      id: `religious-branch:${String(cityIndex + 1).padStart(3, "0")}:${String(traditionIndex + 1).padStart(2, "0")}`,
      cityId: city.id,
      traditionId: tradition.id,
      networkId: network.id,
      publicName: `${tradition.kind === "confirmedDivineFaith" ? "Temple" : "Forum"} of ${tradition.name.replace(/^The Faith of |^The /, "")} in ${city.name}`,
      organizationForm: BRANCH_FORMS[parseInt(code[3], 36)],
      standing: STANDING_BY_CODE[directory.standingRows[cityIndex][traditionIndex]],
      adherentBand: ADHERENT_BANDS[parseInt(code[4], 36)],
      capacityBand: CAPACITY_BANDS[parseInt(code[5], 36)],
      roles: [...code.slice(6)].map((roleCode) => NETWORK_ROLES[parseInt(roleCode, 36)]),
      internetConnection: "globalNetworkBranch",
      physicalScope: "thisCityAndItsControlledPropertyOnly",
      sovereignAuthority: false
    };
  }

  function createBranches(worldSeed, cities, traditions, standingRows) {
    return cities.flatMap((city, cityIndex) => traditions.map((tradition, traditionIndex) => branchFor(
      worldSeed,
      city,
      tradition,
      STANDING_BY_CODE[standingRows[cityIndex][traditionIndex]],
      cityIndex,
      traditionIndex
    )).filter(Boolean));
  }

  function holySiteScore(map, god, cellIndex, seed) {
    const aspectMatch = map.arcaneGeography.primaryAspectClasses[cellIndex] === god.preferredArcaneAspect ? 900 : 0;
    const ley = map.arcaneGeography.leyClasses[cellIndex] === "n" ? 700 : (map.arcaneGeography.leyClasses[cellIndex] === "c" ? 360 : 0);
    const mana = map.arcaneGeography.manaConcentrationPermille[cellIndex] * 0.65;
    const nullAffinity = god.domains.some((domain) => ["souls", "death", "memory", "secrets"].includes(domain)) ? map.arcaneGeography.nullPermille[cellIndex] * 0.45 : 0;
    const city = map.humanGeography.cities.find((entry) => entry.cellId === StrategicWorld.cellId(cellIndex));
    const cityAffinity = god.domains.some((domain) => ["shelter", "charity", "walls", "duty", "craft", "invention"].includes(domain)) && city ? 950 : 0;
    const wildernessAffinity = god.domains.some((domain) => ["beasts", "wilderness", "hunting", "night"].includes(domain)) && !city ? 420 : 0;
    const threat = Number(map.publicBeastAtlas.threatClasses[cellIndex] || 0) * (god.domains.includes("beasts") ? 120 : 15);
    return aspectMatch + ley + mana + nullAffinity + cityAffinity + wildernessAffinity + threat + seededNumber(seed, `holy-site:${god.id}:${cellIndex}`) * 500;
  }

  function createHolySites(worldSeed, map, gods) {
    const usedCells = new Set();
    const corridorCells = new Set(map.routeGraph.routes.flatMap((route) => route.cellPath));
    const sites = [];
    for (const god of gods) {
      const ranked = Array.from({ length: map.topology.cellCount }, (_, cellIndex) => cellIndex)
        .filter((cellIndex) => !usedCells.has(cellIndex))
        .map((cellIndex) => ({ cellIndex, score: holySiteScore(map, god, cellIndex, worldSeed) }))
        .sort((left, right) => right.score - left.score || left.cellIndex - right.cellIndex);
      const siteCount = 1;
      for (let ordinal = 0; ordinal < siteCount; ordinal += 1) {
        const choice = ranked.find((candidate) => !usedCells.has(candidate.cellIndex));
        if (!choice) continue;
        usedCells.add(choice.cellIndex);
        const cellId = StrategicWorld.cellId(choice.cellIndex);
        const city = map.humanGeography.cities.find((entry) => entry.cellId === cellId);
        const controlClass = map.cityPolities.control.classes[choice.cellIndex];
        const accessClass = city ? "fortifiedCitySanctuary" : (corridorCells.has(cellId) ? "intermittentCorridorPilgrimage" : (controlClass === "a" ? "controlledApproach" : "beastDominatedWilderness"));
        sites.push({
          id: `holy-site:${god.id.slice(4)}:${ordinal + 1}`,
          godId: god.id,
          name: `${pick(["Sanctuary", "Threshold", "Anchor", "Shrine", "Seat"], worldSeed, `site-name:${god.id}:${ordinal}`)} of ${god.epithet}`,
          cellId,
          siteKind: pick(SITE_KINDS, worldSeed, `site-kind:${god.id}:${ordinal}`),
          accessClass,
          confirmedByGod: true,
          divineActivity: "routineAndRepeatable",
          publicEffects: ["enhancedDivineCommunication", "recognizedAvatarManifestationAnchor", "consecratedRitualAccess"],
          causalFactors: [
            `primaryArcaneAspect:${map.arcaneGeography.primaryAspectClasses[choice.cellIndex]}`,
            `manaConcentration:${map.arcaneGeography.manaConcentrationPermille[choice.cellIndex]}`,
            `leyClass:${map.arcaneGeography.leyClasses[choice.cellIndex]}`,
            `access:${accessClass}`
          ]
        });
      }
    }
    return sites;
  }

  function createDivineRelations(worldSeed, gods) {
    const relations = [];
    for (let left = 0; left < gods.length; left += 1) {
      for (let right = left + 1; right < gods.length; right += 1) {
        const a = gods[left];
        const b = gods[right];
        const sharedDomains = a.domains.filter((domain) => b.domains.includes(domain));
        const roll = seededNumber(worldSeed, `divine-relation:${a.id}:${b.id}`) + sharedDomains.length * 0.12;
        const relation = roll < 0.16 ? "hostile" : (roll < 0.36 ? "rival" : (roll < 0.62 ? "neutral" : (roll < 0.85 ? "cooperative" : "allied")));
        relations.push({
          id: `divine-relation:${a.id.slice(4)}:${b.id.slice(4)}`,
          godIds: [a.id, b.id],
          relation,
          sharedDomains,
          publicReasons: sharedDomains.length ? ["overlappingDivineDomains", relation === "allied" ? "confirmedMutualCovenant" : "competingDoctrine"] : [relation === "allied" || relation === "cooperative" ? "confirmedComplementaryPriorities" : "conflictingDivinePriorities"],
          sameGodDoctrinalSchism: false
        });
      }
    }
    return relations;
  }

  function divineRelationCodes(relations) {
    return relations.map((relation) => DIVINE_RELATIONS.indexOf(relation.relation).toString(36)).join("");
  }

  function expandDivineRelations(gods, codes) {
    const relations = [];
    let codeIndex = 0;
    for (let left = 0; left < gods.length; left += 1) {
      for (let right = left + 1; right < gods.length; right += 1) {
        const a = gods[left];
        const b = gods[right];
        const relation = DIVINE_RELATIONS[parseInt(codes[codeIndex], 36)];
        const sharedDomains = a.domains.filter((domain) => b.domains.includes(domain));
        relations.push({
          id: `divine-relation:${a.id.slice(4)}:${b.id.slice(4)}`,
          godIds: [a.id, b.id],
          relation,
          sharedDomains,
          publicReasons: sharedDomains.length ? ["overlappingDivineDomains", relation === "allied" ? "confirmedMutualCovenant" : "competingDoctrine"] : [relation === "allied" || relation === "cooperative" ? "confirmedComplementaryPriorities" : "conflictingDivinePriorities"],
          sameGodDoctrinalSchism: false
        });
        codeIndex += 1;
      }
    }
    return relations;
  }

  function createPantheons(worldSeed, gods, relations) {
    const allied = relations.filter((relation) => relation.relation === "allied");
    const parent = new Map(gods.map((god) => [god.id, god.id]));
    const find = (id) => parent.get(id) === id ? id : (parent.set(id, find(parent.get(id))), parent.get(id));
    for (const relation of allied) parent.set(find(relation.godIds[1]), find(relation.godIds[0]));
    const groups = new Map();
    for (const god of gods) {
      const root = find(god.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(god.id);
    }
    return [...groups.values()].filter((godIds) => godIds.length > 1).map((godIds, index) => {
      const memberNames = godIds.map((id) => gods.find((god) => god.id === id).name);
      return { id: `pantheon:${String(index + 1).padStart(2, "0")}`, name: `The ${pick(["Concord", "Covenant", "Accord"], worldSeed, `pantheon:${index}`)} of ${memberNames[0]}`, godIds, mergesFaithNetworks: false, sovereignAuthority: false };
    });
  }

  function publicCellFeatures(map, holySites, branchCodes, standingRows) {
    const features = new Map();
    for (const [cityIndex, city] of map.humanGeography.cities.entries()) {
      const branchCount = branchCodes.filter((code) => parseInt(code.slice(0, 2), 36) === cityIndex).length;
      const established = [...standingRows[cityIndex]].some((code) => code === STANDING_CODES.established);
      if (established || branchCount) features.set(StrategicWorld.cellIndex(city.cellId), established ? "e" : "c");
    }
    for (const site of holySites) features.set(StrategicWorld.cellIndex(site.cellId), "h");
    return [...features.entries()].sort((left, right) => left[0] - right[0]).map(([index, featureClass]) => `${index.toString(36)}:${featureClass}`);
  }

  function religionsCore(record) {
    return {
      sourceArcaneGeographyDigest: record.sourceArcaneGeographyDigest,
      sourceBeastEcologyDigest: record.sourceBeastEcologyDigest,
      sourceCityRecognitionDigest: record.sourceCityRecognitionDigest,
      publicDirectoryDigest: record.publicDirectoryDigest,
      hiddenGodStateCodes: record.hiddenGodStateCodes,
      hiddenBranchIntegrityCodes: record.hiddenBranchIntegrityCodes,
      diagnostics: record.diagnostics
    };
  }

  function createStrategicReligions(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for religion generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityRecognition.validateCrossCityRecognition(strategicMap);
    const worldTheme = strategicMap.cityPolities.worldTheme;
    const gods = createGods(seed, worldTheme);
    const { traditions, networks } = createTraditionsAndNetworks(seed, gods);
    const cities = strategicMap.humanGeography.cities;
    const standingRows = standingRowsFor(seed, cities, traditions);
    const branchCodes = createBranches(seed, cities, traditions, standingRows);
    const holySites = createHolySites(seed, strategicMap, gods);
    const divineRelations = createDivineRelations(seed, gods);
    const pantheons = createPantheons(seed, gods, divineRelations);
    const publicDirectory = {
      worldTheme,
      gods,
      traditions,
      networks,
      branchCodes,
      holySites,
      divineRelationCodes: divineRelationCodes(divineRelations),
      pantheons,
      cityOrder: cities.map((city) => city.id),
      traditionOrder: traditions.map((tradition) => tradition.id),
      standingRows,
      cellFeatures: publicCellFeatures(strategicMap, holySites, branchCodes, standingRows)
    };
    publicDirectory.digest = `public-religions-${StrategicWorld.stableHash(publicDirectory)}`;
    const hiddenGodStateCodes = gods.map((god) => {
      const attention = pick(ATTENTION_BANDS, seed, `divine-attention:${god.id}`);
      const reserve = pick(MANIFESTATION_RESERVES, seed, `manifestation-reserve:${god.id}`);
      const priority = pick(PRIVATE_PRIORITIES, seed, `private-priority:${god.id}`);
      return `${ATTENTION_CODES[attention]}${RESERVE_CODES[reserve]}${PRIORITY_CODES[priority]}`;
    }).join("");
    const hiddenBranchIntegrityCodes = branchCodes.map((code) => pick(["0", "1", "2", "3"], seed, `branch-integrity:${code.slice(0, 3)}`)).join("");
    const record = {
      sourceArcaneGeographyDigest: strategicMap.arcaneGeography.digest,
      sourceBeastEcologyDigest: strategicMap.beastEcology.digest,
      sourceCityRecognitionDigest: strategicMap.crossCityRecognition.digest,
      publicDirectoryDigest: publicDirectory.digest,
      hiddenGodStateCodes,
      hiddenBranchIntegrityCodes,
      diagnostics: {
        godCount: gods.length,
        confirmedDivineFaithCount: gods.length,
        nonTheisticMovementCount: traditions.filter((tradition) => tradition.kind === "nonTheisticMovement").length,
        networkCount: networks.length,
        branchCount: branchCodes.length,
        holySiteCount: holySites.length,
        avatarCapableGodCount: gods.filter((god) => god.avatarManifestation.possible).length,
        routineCommunicationGodCount: gods.filter((god) => god.communication.routine).length,
        establishedCityCount: standingRows.filter((row) => row.includes(STANDING_CODES.established)).length,
        pantheonCount: pantheons.length
      }
    };
    record.digest = `strategic-religions-${StrategicWorld.stableHash(religionsCore(record))}`;
    return { strategicReligions: record, publicDirectory };
  }

  function cityReligiousStanding(map, cityId) {
    const directory = map?.publicReligionDirectory;
    if (!directory) return null;
    const cityIndex = directory.cityOrder.indexOf(cityId);
    const city = map.humanGeography.cities.find((entry) => entry.id === cityId);
    if (cityIndex < 0 || !city) return null;
    return {
      city: clone(city),
      standings: directory.traditionOrder.map((traditionId, traditionIndex) => ({
        tradition: clone(directory.traditions.find((tradition) => tradition.id === traditionId)),
        standing: STANDING_BY_CODE[directory.standingRows[cityIndex][traditionIndex]],
        branch: expandBranch(directory.branchCodes.find((code) => parseInt(code.slice(0, 2), 36) === cityIndex && parseInt(code[2], 36) === traditionIndex) || null, directory, map)
      }))
    };
  }

  function cellPublicReligionSnapshot(map, index) {
    if (!map?.publicReligionDirectory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const city = map.humanGeography.cities.find((entry) => entry.cellId === cellId);
    return {
      cellId,
      publicClass: ({ c: "organizedReligiousBranches", e: "establishedFaithCity", h: "confirmedHolySite" })[map.publicReligionDirectory.cellFeatures.find((entry) => parseInt(entry, 36) === index)?.split(":")[1]] || "noMajorPublicReligiousFeature",
      holySites: clone(map.publicReligionDirectory.holySites.filter((site) => site.cellId === cellId)),
      cityStanding: city ? cityReligiousStanding(map, city.id) : null
    };
  }

  function hiddenDivineStateFor(map, godId) {
    const directory = map?.publicReligionDirectory;
    const record = map?.strategicReligions;
    const index = directory?.gods.findIndex((god) => god.id === godId) ?? -1;
    if (index < 0 || !record) return null;
    const code = record.hiddenGodStateCodes.slice(index * 3, index * 3 + 3);
    const attentionByCode = Object.fromEntries(Object.entries(ATTENTION_CODES).map(([key, value]) => [value, key]));
    const reserveByCode = Object.fromEntries(Object.entries(RESERVE_CODES).map(([key, value]) => [value, key]));
    const priorityByCode = Object.fromEntries(Object.entries(PRIORITY_CODES).map(([key, value]) => [value, key]));
    return { godId, currentAttentionBand: attentionByCode[code[0]], manifestationReserve: reserveByCode[code[1]], privatePriority: priorityByCode[code[2]], omniscient: false, publicInferencePermitted: false };
  }

  function validateStrategicReligions(map, record = map?.strategicReligions, publicDirectory = map?.publicReligionDirectory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityRecognition.validateCrossCityRecognition(strategicMap);
    if (!record || !publicDirectory || record.sourceArcaneGeographyDigest !== strategicMap.arcaneGeography.digest || record.sourceBeastEcologyDigest !== strategicMap.beastEcology.digest || record.sourceCityRecognitionDigest !== strategicMap.crossCityRecognition.digest || record.publicDirectoryDigest !== publicDirectory.digest) throw new Error("Religion records are incomplete or do not match their source world.");
    const gods = publicDirectory.gods;
    const traditions = publicDirectory.traditions;
    const networks = publicDirectory.networks;
    const branchCodes = publicDirectory.branchCodes;
    const sites = publicDirectory.holySites;
    if (!Array.isArray(gods) || gods.length < 6 || !Array.isArray(traditions) || !Array.isArray(networks) || !Array.isArray(branchCodes) || !Array.isArray(sites) || typeof publicDirectory.divineRelationCodes !== "string" || !Array.isArray(publicDirectory.pantheons)) throw new Error("Public religion records are incomplete.");
    if (new Set(gods.map((god) => god.id)).size !== gods.length || gods.some((god) => god.kind !== "realFiniteGod" || god.objectiveExistence !== "confirmed" || god.omnipotent || god.omniscient || !god.attentionFinite || !god.communication.routine || !god.communication.faithfulMayReceiveDirectReplies || !god.avatarManifestation.possible)) throw new Error("Every generated god must be real, finite, communicative, and avatar-capable.");
    const divineTraditions = traditions.filter((tradition) => tradition.kind === "confirmedDivineFaith");
    if (divineTraditions.length !== gods.length || gods.some((god) => divineTraditions.filter((tradition) => tradition.deityIds.length === 1 && tradition.deityIds[0] === god.id).length !== 1) || divineTraditions.some((tradition) => {
      const god = gods.find((entry) => entry.id === tradition.deityIds[0]);
      return tradition.doctrinalSchismAvailable || tradition.sameGodHeresyClaimsValid || tradition.correctionAuthority !== tradition.deityIds[0] || tradition.correctionChannel !== "routineDirectDivineCommunication" || JSON.stringify(tradition.confirmedDoctrine) !== JSON.stringify(god?.doctrine);
    })) throw new Error("Each god must have one confirmed faith without same-god schism or heresy.");
    if (traditions.filter((tradition) => tradition.kind === "nonTheisticMovement").some((tradition) => !tradition.acknowledgesGodsAreReal || tradition.deityIds.length)) throw new Error("Non-theistic movements must acknowledge that gods objectively exist.");
    if (networks.length !== traditions.length || networks.some((network) => network.sovereignAuthority || network.physicalAuthority !== "localBranchesOnly" || !traditions.some((tradition) => tradition.id === network.traditionId)) || divineTraditions.some((tradition) => networks.filter((network) => network.traditionId === tradition.id && network.recognizedByDeityId === tradition.deityIds[0]).length !== 1)) throw new Error("Every tradition requires one non-sovereign distributed network.");
    if (new Set(branchCodes.map((code) => code.slice(0, 3))).size !== branchCodes.length || branchCodes.some((code) => typeof code !== "string" || code.length !== 11 || /[^0-9a-z]/.test(code) || parseInt(code.slice(0, 2), 36) >= strategicMap.humanGeography.cities.length || parseInt(code[2], 36) >= traditions.length || parseInt(code[3], 36) >= BRANCH_FORMS.length || parseInt(code[4], 36) >= ADHERENT_BANDS.length || parseInt(code[5], 36) >= CAPACITY_BANDS.length || [...code.slice(6)].some((roleCode) => parseInt(roleCode, 36) >= NETWORK_ROLES.length) || new Set(code.slice(6)).size !== 5)) throw new Error("Religious branch records are invalid.");
    if (JSON.stringify(publicDirectory.cityOrder) !== JSON.stringify(strategicMap.humanGeography.cities.map((city) => city.id)) || JSON.stringify(publicDirectory.traditionOrder) !== JSON.stringify(traditions.map((tradition) => tradition.id)) || !Array.isArray(publicDirectory.standingRows) || publicDirectory.standingRows.length !== publicDirectory.cityOrder.length) throw new Error("City religious standing rows are incomplete.");
    for (let cityIndex = 0; cityIndex < publicDirectory.cityOrder.length; cityIndex += 1) {
      const row = publicDirectory.standingRows[cityIndex];
      if (typeof row !== "string" || row.length !== traditions.length || /[^ertxp]/.test(row) || [...row].filter((code) => code === STANDING_CODES.established).length > 1) throw new Error("Each city must publish one valid standing for every tradition and at most one established faith.");
      for (let traditionIndex = 0; traditionIndex < traditions.length; traditionIndex += 1) {
        const standing = STANDING_BY_CODE[row[traditionIndex]];
        const branch = branchCodes.find((code) => parseInt(code.slice(0, 2), 36) === cityIndex && parseInt(code[2], 36) === traditionIndex);
        if ((standing === "established" || standing === "recognized") && !branch || standing === "proscribed" && branch) throw new Error("Branch presence does not match published city standing.");
      }
    }
    if (new Set(sites.map((site) => site.cellId)).size !== sites.length || sites.some((site) => !gods.some((god) => god.id === site.godId) || StrategicWorld.cellIndex(site.cellId) < 0 || StrategicWorld.cellIndex(site.cellId) >= strategicMap.topology.cellCount || !SITE_KINDS.includes(site.siteKind) || !site.confirmedByGod || site.divineActivity !== "routineAndRepeatable")) throw new Error("Holy sites must be unique, physical, and divinely confirmed.");
    const expectedRelationCount = gods.length * (gods.length - 1) / 2;
    if (publicDirectory.divineRelationCodes.length !== expectedRelationCount || [...publicDirectory.divineRelationCodes].some((code) => parseInt(code, 36) >= DIVINE_RELATIONS.length)) throw new Error("Divine relationships must cover distinct gods without same-god schism.");
    if (publicDirectory.pantheons.some((pantheon) => pantheon.godIds.length < 2 || pantheon.mergesFaithNetworks || pantheon.sovereignAuthority)) throw new Error("Pantheons cannot merge faith networks or create sovereignty.");
    if (!Array.isArray(publicDirectory.cellFeatures) || new Set(publicDirectory.cellFeatures.map((entry) => entry.split(":")[0])).size !== publicDirectory.cellFeatures.length || publicDirectory.cellFeatures.some((entry) => !/^[0-9a-z]+:[ceh]$/.test(entry) || parseInt(entry, 36) >= strategicMap.topology.cellCount) || JSON.stringify(publicDirectory.cellFeatures) !== JSON.stringify(publicCellFeatures(strategicMap, sites, branchCodes, publicDirectory.standingRows))) throw new Error("The public religion globe projection is invalid.");
    if (typeof record.hiddenGodStateCodes !== "string" || record.hiddenGodStateCodes.length !== gods.length * 3 || /[^0-5]/.test(record.hiddenGodStateCodes) || typeof record.hiddenBranchIntegrityCodes !== "string" || record.hiddenBranchIntegrityCodes.length !== branchCodes.length || /[^0-3]/.test(record.hiddenBranchIntegrityCodes)) throw new Error("Hidden religious state is invalid.");
    if (Object.hasOwn(publicDirectory, "hiddenGodStateCodes") || Object.hasOwn(publicDirectory, "hiddenBranchIntegrityCodes") || JSON.stringify(publicDirectory).includes("currentAttentionBand")) throw new Error("The public religion directory leaks hidden divine or branch state.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.godCount !== gods.length || diagnostics.confirmedDivineFaithCount !== divineTraditions.length || diagnostics.nonTheisticMovementCount !== traditions.length - divineTraditions.length || diagnostics.networkCount !== networks.length || diagnostics.branchCount !== branchCodes.length || diagnostics.holySiteCount !== sites.length || diagnostics.avatarCapableGodCount !== gods.length || diagnostics.routineCommunicationGodCount !== gods.length || diagnostics.establishedCityCount !== publicDirectory.standingRows.filter((row) => row.includes(STANDING_CODES.established)).length || diagnostics.pantheonCount !== publicDirectory.pantheons.length) throw new Error("Religion diagnostics do not match the saved public facts.");
    const publicCore = clone(publicDirectory);
    delete publicCore.digest;
    if (publicDirectory.digest !== `public-religions-${StrategicWorld.stableHash(publicCore)}` || record.digest !== `strategic-religions-${StrategicWorld.stableHash(religionsCore(record))}`) throw new Error("Religion records do not match their digests.");
    return { strategicReligions: clone(record), publicDirectory: clone(publicDirectory) };
  }

  function attachStrategicReligions(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createStrategicReligions(worldSeed, next);
    next.strategicReligions = generated.strategicReligions;
    next.publicReligionDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicReligionDirectory(map) {
    if (!map?.publicReligionDirectory) return null;
    const directory = clone(map.publicReligionDirectory);
    directory.branches = directory.branchCodes.map((code) => expandBranch(code, map.publicReligionDirectory, map));
    directory.divineRelations = expandDivineRelations(directory.gods, directory.divineRelationCodes);
    delete directory.branchCodes;
    delete directory.divineRelationCodes;
    return directory;
  }

  function auditStrategicReligions(map) {
    const { strategicReligions, publicDirectory } = validateStrategicReligions(map);
    const expandedDirectory = publicReligionDirectory(map);
    const divineTraditions = publicDirectory.traditions.filter((tradition) => tradition.kind === "confirmedDivineFaith");
    return {
      valid: true,
      godCount: publicDirectory.gods.length,
      everyGodObjectivelyReal: publicDirectory.gods.every((god) => god.objectiveExistence === "confirmed"),
      everyGodFinite: publicDirectory.gods.every((god) => !god.omnipotent && !god.omniscient && god.attentionFinite),
      routineDirectCommunication: publicDirectory.gods.every((god) => god.communication.routine && god.communication.faithfulMayReceiveDirectReplies),
      everyGodAvatarCapable: publicDirectory.gods.every((god) => god.avatarManifestation.possible),
      exactlyOneConfirmedFaithPerGod: divineTraditions.length === publicDirectory.gods.length && publicDirectory.gods.every((god) => divineTraditions.filter((tradition) => tradition.deityIds[0] === god.id).length === 1),
      noSameGodHeresyOrSchism: divineTraditions.every((tradition) => !tradition.doctrinalSchismAvailable && !tradition.sameGodHeresyClaimsValid),
      everyTraditionHasCityStanding: publicDirectory.standingRows.every((row) => row.length === publicDirectory.traditions.length),
      everyNetworkNonSovereign: publicDirectory.networks.every((network) => !network.sovereignAuthority),
      everyBranchLocallyBound: expandedDirectory.branches.every((branch) => branch.physicalScope === "thisCityAndItsControlledPropertyOnly" && !branch.sovereignAuthority),
      everyHolySiteDivinelyConfirmed: publicDirectory.holySites.every((site) => site.confirmedByGod && site.divineActivity === "routineAndRepeatable"),
      nonTheisticMovementsAcknowledgeGods: publicDirectory.traditions.filter((tradition) => tradition.kind === "nonTheisticMovement").every((tradition) => tradition.acknowledgesGodsAreReal),
      publicDirectoryHidesDivineAttention: !Object.hasOwn(publicDirectory, "hiddenGodStateCodes") && !JSON.stringify(publicDirectory).includes("currentAttentionBand"),
      publicDirectoryHidesBranchIntegrity: !Object.hasOwn(publicDirectory, "hiddenBranchIntegrityCodes") && !JSON.stringify(publicDirectory).includes("branchIntegrity"),
      hiddenAttentionCannotBePubliclyInferred: publicDirectory.gods.every((god) => hiddenDivineStateFor(map, god.id)?.publicInferencePermitted === false),
      diagnostics: clone(strategicReligions.diagnostics)
    };
  }

  return Object.freeze({
    RELIGIOUS_STANDINGS,
    ADHERENT_BANDS,
    CAPACITY_BANDS,
    BRANCH_FORMS,
    NETWORK_ROLES,
    DIVINE_RELATIONS,
    SITE_KINDS,
    DEITY_DEFINITIONS,
    MOVEMENT_DEFINITIONS,
    createStrategicReligions,
    validateStrategicReligions,
    attachStrategicReligions,
    publicReligionDirectory,
    cityReligiousStanding,
    cellPublicReligionSnapshot,
    hiddenDivineStateFor,
    auditStrategicReligions
  });
});
