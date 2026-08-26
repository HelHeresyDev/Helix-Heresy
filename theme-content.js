(function initThemeContent(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixThemeContent = api;
})(typeof window !== "undefined" ? window : globalThis, function createThemeContentApi() {
  "use strict";

  const VERSION = 2;
  const COMPATIBILITIES = Object.freeze(["shared", "madcap", "grim"]);
  const WORLD_THEMES = Object.freeze({
    madcap: Object.freeze({
      id: "madcap",
      label: "Madcap Heresy",
      description: "Strange hope, reckless invention, and consequences with a crooked smile."
    }),
    grim: Object.freeze({
      id: "grim",
      label: "Grim Heresy",
      description: "Cruel institutions, desperate survival, and victories paid for in scars."
    }),
    unbound: Object.freeze({
      id: "unbound",
      label: "Unbound Heresy",
      description: "All content pools are enabled; comedy, hope, cruelty, and horror may coexist."
    })
  });
  const CONTENT_TAGS = Object.freeze([
    "absurdity", "atrocity", "beast-dominance", "body-horror", "coercion", "fortified-civilization",
    "hope", "institutional-cruelty", "invention", "magic", "neutral", "scarcity",
    "science", "survival", "warfare"
  ]);

  const DEFAULT_DEFINITIONS = Object.freeze([
    Object.freeze({
      id: "world-name.madcap.improvised-miracles",
      kind: "worldName",
      compatibility: "madcap",
      contentTags: Object.freeze(["absurdity", "hope", "invention", "magic"]),
      recipe: Object.freeze({
        openings: Object.freeze(["Aether", "Aurora", "Brass", "Bubble", "Cloud", "Glimmer", "Helix", "Lumen"]),
        endings: Object.freeze(["bloom", "doodle", "garden", "gleam", "reach", "spark", "vale", "whim"]),
        titles: Object.freeze([
          "The Many-Walled Carnival",
          "The Principality of Improvised Miracles",
          "The Realm That Seemed Sensible at the Time"
        ])
      })
    }),
    Object.freeze({
      id: "world-name.madcap.unsafe-wonders",
      kind: "worldName",
      compatibility: "madcap",
      contentTags: Object.freeze(["absurdity", "invention", "science"]),
      recipe: Object.freeze({
        openings: Object.freeze(["Copper", "Fizz", "Glass", "Moon", "Quirk", "Rune", "Star", "Wonder"]),
        endings: Object.freeze(["caper", "hollow", "muddle", "rest", "shire", "spire", "tide", "wyn"]),
        titles: Object.freeze([
          "The Cheerfully Unsafe Expanse",
          "The Grand Unauthorized Experiment",
          "The Republic of Questionable Wonders"
        ])
      })
    }),
    Object.freeze({
      id: "world-name.grim.long-siege",
      kind: "worldName",
      compatibility: "grim",
      contentTags: Object.freeze(["beast-dominance", "scarcity", "survival", "warfare"]),
      recipe: Object.freeze({
        openings: Object.freeze(["Ash", "Black", "Cinder", "Dread", "Iron", "Night", "Ruin", "Storm"]),
        endings: Object.freeze(["fall", "grave", "hollow", "march", "reach", "scar", "veil", "ward"]),
        titles: Object.freeze([
          "The Long Siege",
          "The Realm Beneath a Dying Firmament",
          "The Walled and Hungry World"
        ])
      })
    }),
    Object.freeze({
      id: "world-name.grim.crowned-ruin",
      kind: "worldName",
      compatibility: "grim",
      contentTags: Object.freeze(["institutional-cruelty", "magic", "survival"]),
      recipe: Object.freeze({
        openings: Object.freeze(["Bleak", "Bone", "Ember", "Gallow", "Null", "Pale", "Sable", "Thorn"]),
        endings: Object.freeze(["crown", "deep", "mere", "rest", "shroud", "waste", "weald", "wold"]),
        titles: Object.freeze([
          "The Crowned Ruin",
          "The Kingdom of Shut Gates",
          "The Sphere Without Mercy"
        ])
      })
    }),
    Object.freeze({
      id: "world-name.shared.fallback",
      kind: "worldName",
      compatibility: "shared",
      contentTags: Object.freeze(["neutral"]),
      fallback: true,
      recipe: Object.freeze({
        openings: Object.freeze(["Aether"]),
        endings: Object.freeze(["reach"]),
        titles: Object.freeze(["The Generated World"])
      })
    }),
    Object.freeze({
      id: "world-summary.madcap.defiant-curiosity",
      kind: "worldSummary",
      compatibility: "madcap",
      contentTags: Object.freeze(["absurdity", "beast-dominance", "hope", "invention"]),
      template: "Behind fortified walls, divided humanity survives by turning magic, machinery, and inadvisable confidence into tomorrow's solutions. Beyond them, beasts rule most of {worldName}."
    }),
    Object.freeze({
      id: "world-summary.grim.walls-have-a-price",
      kind: "worldSummary",
      compatibility: "grim",
      contentTags: Object.freeze(["beast-dominance", "institutional-cruelty", "scarcity", "survival"]),
      template: "The walls of {worldName} hold because someone is always made to pay. Beyond their guns and wards, beasts inherit the land while divided powers sharpen their knives for one another."
    }),
    Object.freeze({
      id: "world-summary.shared.fallback",
      kind: "worldSummary",
      compatibility: "shared",
      contentTags: Object.freeze(["neutral"]),
      fallback: true,
      template: "{worldName} is a divided magitech world whose fortified settlements endure amid beast-dominated wilds."
    }),
    Object.freeze({
      id: "city-polity.madcap.licensed-visionary",
      kind: "cityPolityIdentity",
      compatibility: "madcap",
      contentTags: Object.freeze(["absurdity", "fortified-civilization", "hope", "invention"]),
      authorityKind: "individual",
      authorityTitles: Object.freeze(["Licensed Visionary", "Emergency Genius", "Principal Enthusiast"]),
      authorityNameOpenings: Object.freeze(["Aster", "Bramble", "Copper", "Jubilee", "Lumen", "Quill", "Spark", "Wonder"]),
      authorityNameEndings: Object.freeze(["Bell", "Fizz", "Glint", "Quirk", "Ramble", "Sprocket", "Vale", "Whim"]),
      polityNameTemplates: Object.freeze(["The Free City of {cityName}", "The Independent Works of {cityName}"]),
      governingForms: Object.freeze(["licensed personal rule", "inventor sovereignty", "emergency visionary rule"]),
      successionPrinciples: Object.freeze(["publicly demonstrated competence", "named experimental successor", "victory in the civic challenge trials"]),
      mottos: Object.freeze(["Preparedness Is Just Invention With A Deadline", "No Wall Without A Workshop", "Survive First, Improve Immediately"]),
      civicPriorities: Object.freeze(["open invention", "spectacular civil defense", "public education", "monster-warning science", "experimental infrastructure", "civic festivals"]),
      template: "{polityName} recognizes no higher government. {authorityTitle} {authorityName} rules through {governingForm}, while the city remains globally connected and physically dependent on its own walls."
    }),
    Object.freeze({
      id: "city-polity.madcap.emergency-committee",
      kind: "cityPolityIdentity",
      compatibility: "madcap",
      contentTags: Object.freeze(["absurdity", "fortified-civilization", "invention", "survival"]),
      authorityKind: "collective",
      authorityGroupTemplates: Object.freeze(["The {cityName} Emergency Committee", "The Municipal League of Improbable Survival", "The Civic Continuity Workshop"]),
      authorityTitles: Object.freeze(["Sovereign Committee", "Collective Custodian", "Municipal Directorate"]),
      polityNameTemplates: Object.freeze(["The Cooperative City of {cityName}", "The Unsupervised Municipality of {cityName}"]),
      governingForms: Object.freeze(["committee sovereignty", "rotating technical council", "chartered guild assembly"]),
      successionPrinciples: Object.freeze(["appointment by the surviving committee", "election by licensed guilds", "rotation among emergency departments"]),
      mottos: Object.freeze(["Consensus Before Catastrophe, Usually", "Every Citizen An Emergency Contact", "The Agenda Includes Survival"]),
      civicPriorities: Object.freeze(["distributed workshops", "civil defense drills", "public provisioning", "open data", "corridor warnings", "cooperative research"]),
      template: "{polityName} answers only to itself. {authorityName}, acting as its {authorityTitle}, governs through {governingForm} and maintains internet ties that cannot substitute for a supply convoy."
    }),
    Object.freeze({
      id: "city-polity.grim.sovereign-protector",
      kind: "cityPolityIdentity",
      compatibility: "grim",
      contentTags: Object.freeze(["coercion", "fortified-civilization", "institutional-cruelty", "survival"]),
      authorityKind: "individual",
      authorityTitles: Object.freeze(["Sovereign Protector", "First Castellan", "Keeper of the Last Gate"]),
      authorityNameOpenings: Object.freeze(["Aldren", "Cassia", "Damar", "Ilyra", "Mordane", "Severin", "Thessa", "Veyr"]),
      authorityNameEndings: Object.freeze(["Ash", "Black", "Grave", "Harrow", "Rook", "Scar", "Thorn", "Voss"]),
      polityNameTemplates: Object.freeze(["The Sovereign Bastion of {cityName}", "The Closed City of {cityName}"]),
      governingForms: Object.freeze(["personal emergency sovereignty", "fortress autocracy", "hereditary custodianship"]),
      successionPrinciples: Object.freeze(["designation by the reigning protector", "armed confirmation by the gate command", "inheritance under emergency law"]),
      mottos: Object.freeze(["The Gate Opens Outward Only", "Order Outlives Mercy", "The Wall Remembers Every Failure"]),
      civicPriorities: Object.freeze(["fortress discipline", "ration security", "weapons production", "surveillance", "monster extermination", "suppression infrastructure"]),
      template: "{polityName} accepts no distant master. {authorityTitle} {authorityName} rules through {governingForm}; the internet carries orders and threats, but every material promise must survive the wilderness."
    }),
    Object.freeze({
      id: "city-polity.grim.bastion-directorate",
      kind: "cityPolityIdentity",
      compatibility: "grim",
      contentTags: Object.freeze(["fortified-civilization", "institutional-cruelty", "scarcity", "warfare"]),
      authorityKind: "collective",
      authorityGroupTemplates: Object.freeze(["The {cityName} Bastion Directorate", "The Continuity Tribunal", "The Sealed Council"]),
      authorityTitles: Object.freeze(["Sovereign Directorate", "Ruling Tribunal", "Continuity Authority"]),
      polityNameTemplates: Object.freeze(["The Directorate City of {cityName}", "The Autonomous Fortress of {cityName}"]),
      governingForms: Object.freeze(["military-civic directorate", "closed administrative tribunal", "ration-holder oligarchy"]),
      successionPrinciples: Object.freeze(["internal selection under sealed vote", "promotion by continuity rank", "appointment by the surviving directorates"]),
      mottos: Object.freeze(["Nothing Enters Uncounted", "Continuity Is The Only Mandate", "The Living Owe The Wall"]),
      civicPriorities: Object.freeze(["continuity planning", "ration control", "corridor intelligence", "compulsory service", "weapons reserves", "population accounting"]),
      template: "{polityName} is diplomatically independent and logistically alone. {authorityName}, its {authorityTitle}, governs through {governingForm} and treats every external dependency as a future siege."
    }),
    Object.freeze({
      id: "city-polity.shared.fallback",
      kind: "cityPolityIdentity",
      compatibility: "shared",
      contentTags: Object.freeze(["fortified-civilization", "neutral"]),
      fallback: true,
      authorityKind: "collective",
      authorityGroupTemplates: Object.freeze(["The {cityName} Civic Authority"]),
      authorityTitles: Object.freeze(["Sovereign Council"]),
      polityNameTemplates: Object.freeze(["The Independent City of {cityName}"]),
      governingForms: Object.freeze(["independent civic government"]),
      successionPrinciples: Object.freeze(["selection under the city charter"]),
      mottos: Object.freeze(["The City Sustains Itself"]),
      civicPriorities: Object.freeze(["civil defense", "local provisioning", "infrastructure maintenance"]),
      template: "{polityName} recognizes no higher territorial government. {authorityName} governs locally while maintaining global communications and strictly limited physical reach."
    }),
    Object.freeze({
      id: "run-opening.madcap.respectable-staircase",
      kind: "runOpening",
      compatibility: "madcap",
      contentTags: Object.freeze(["absurdity", "hope", "science"]),
      template: "{companyName} opens in {worldName}, where respectable chemistry and forbidden ambition have agreed to share a staircase."
    }),
    Object.freeze({
      id: "run-opening.madcap.questionable-inheritance",
      kind: "runOpening",
      compatibility: "madcap",
      contentTags: Object.freeze(["absurdity", "invention", "magic"]),
      template: "The inherited laboratory beneath {companyName} wakes with a hum, a suspicious sparkle, and several exciting violations of common sense."
    }),
    Object.freeze({
      id: "run-opening.grim.inherited-laboratory",
      kind: "runOpening",
      compatibility: "grim",
      contentTags: Object.freeze(["institutional-cruelty", "science", "survival"]),
      template: "Beneath {companyName}, the inherited laboratory wakes in {worldName}, a world whose walls protect humanity without making it humane."
    }),
    Object.freeze({
      id: "run-opening.grim.borrowed-time",
      kind: "runOpening",
      compatibility: "grim",
      contentTags: Object.freeze(["beast-dominance", "scarcity", "survival"]),
      template: "In {worldName}, every refuge is borrowed time. {companyName} has bought a little more of it, and hidden a laboratory underneath."
    }),
    Object.freeze({
      id: "run-opening.shared.fallback",
      kind: "runOpening",
      compatibility: "shared",
      contentTags: Object.freeze(["neutral"]),
      fallback: true,
      template: "{companyName} begins operations in {worldName}."
    })
  ]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function stableHash(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function seededIndex(seed, length) {
    if (!length) return -1;
    return (parseInt(stableHash(seed), 16) >>> 0) % length;
  }

  function validateDefinition(definition) {
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new Error("Theme content definitions must be objects.");
    }
    const id = String(definition.id || "").trim();
    const kind = String(definition.kind || "").trim();
    const compatibility = String(definition.compatibility || "").trim();
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new Error("Theme content definitions require a stable semantic ID.");
    if (!/^[a-z][a-zA-Z0-9]*$/.test(kind)) throw new Error(`${id} requires a valid content kind.`);
    if (!COMPATIBILITIES.includes(compatibility)) {
      throw new Error(`${id} must explicitly declare shared, madcap, or grim compatibility.`);
    }
    if (!Array.isArray(definition.contentTags) || definition.contentTags.length === 0) {
      throw new Error(`${id} must declare at least one content tag.`);
    }
    const contentTags = [...new Set(definition.contentTags.map((tag) => String(tag || "").trim()))];
    const invalidTag = contentTags.find((tag) => !CONTENT_TAGS.includes(tag));
    if (invalidTag) throw new Error(`${id} declares unknown content tag: ${invalidTag}.`);
    if (kind === "worldName") {
      const recipe = definition.recipe;
      for (const field of ["openings", "endings", "titles"]) {
        if (!Array.isArray(recipe?.[field]) || recipe[field].length === 0) {
          throw new Error(`${id} requires a non-empty world-name ${field} recipe.`);
        }
      }
    } else if (!String(definition.template || "").trim()) {
      throw new Error(`${id} requires a renderable template.`);
    }
    if (definition.fallback && compatibility !== "shared") {
      throw new Error(`${id} fallbacks must be shared content.`);
    }
    return {
      ...clone(definition),
      id,
      kind,
      compatibility,
      contentTags,
      fallback: definition.fallback === true
    };
  }

  function createRegistry(definitions = []) {
    const normalized = definitions.map(validateDefinition);
    const ids = new Set();
    const fallbacks = new Set();
    for (const definition of normalized) {
      if (ids.has(definition.id)) throw new Error(`Duplicate theme content ID: ${definition.id}.`);
      ids.add(definition.id);
      if (definition.fallback) {
        if (fallbacks.has(definition.kind)) throw new Error(`Duplicate shared fallback for ${definition.kind}.`);
        fallbacks.add(definition.kind);
      }
    }
    return Object.freeze(normalized.map((definition) => Object.freeze(definition)));
  }

  const DEFAULT_REGISTRY = createRegistry(DEFAULT_DEFINITIONS);

  function allowedCompatibilities(worldTheme) {
    if (!WORLD_THEMES[worldTheme]) return [];
    return worldTheme === "unbound" ? ["shared", "madcap", "grim"] : ["shared", worldTheme];
  }

  function eligibleDefinitions(registry, options = {}) {
    const kind = String(options.kind || "");
    const allowed = allowedCompatibilities(options.worldTheme);
    const requiredTags = Array.isArray(options.requiredTags) ? options.requiredTags : [];
    const excludedTags = Array.isArray(options.excludedTags) ? options.excludedTags : [];
    return registry.filter((definition) => (
      definition.kind === kind
      && allowed.includes(definition.compatibility)
      && requiredTags.every((tag) => definition.contentTags.includes(tag))
      && excludedTags.every((tag) => !definition.contentTags.includes(tag))
    ));
  }

  function selectContent(registry, options = {}) {
    const worldTheme = String(options.worldTheme || "");
    const kind = String(options.kind || "");
    if (!WORLD_THEMES[worldTheme]) {
      return { ok: false, code: "invalid-world-theme", kind, worldTheme };
    }
    const eligible = eligibleDefinitions(registry, options);
    const regular = eligible.filter((definition) => !definition.fallback);
    let pool = regular;
    if (regular.length && options.preferSpecific !== false) {
      if (worldTheme === "unbound") {
        const bands = ["madcap", "grim"].filter((compatibility) => (
          regular.some((definition) => definition.compatibility === compatibility)
        ));
        if (bands.length) {
          const band = bands[seededIndex(`${options.seed}:compatibility`, bands.length)];
          pool = regular.filter((definition) => definition.compatibility === band);
        }
      } else {
        const specific = regular.filter((definition) => definition.compatibility === worldTheme);
        if (specific.length) pool = specific;
      }
    }
    if (!pool.length) pool = eligible.filter((definition) => definition.fallback);
    if (!pool.length) {
      return { ok: false, code: "no-compatible-content", kind, worldTheme };
    }
    const definition = pool[seededIndex(`${options.seed}:definition`, pool.length)];
    return {
      ok: true,
      definition: clone(definition),
      definitionId: definition.id,
      sourceTheme: definition.compatibility,
      contentTags: [...definition.contentTags],
      usedFallback: definition.fallback === true
    };
  }

  function renderTemplate(template, context = {}) {
    return String(template || "").replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(context, key) ? String(context[key]) : match
    ));
  }

  function renderSelection(selection, seed, context = {}) {
    if (!selection?.ok) return selection;
    const definition = selection.definition;
    let text;
    if (definition.kind === "worldName") {
      const recipe = definition.recipe;
      const opening = recipe.openings[seededIndex(`${seed}:opening`, recipe.openings.length)];
      const ending = recipe.endings[seededIndex(`${seed}:ending`, recipe.endings.length)];
      const title = recipe.titles[seededIndex(`${seed}:title`, recipe.titles.length)];
      text = `${opening}${ending}, ${title}`;
    } else {
      text = renderTemplate(definition.template, context);
    }
    return { ...selection, text };
  }

  function selectRenderedContent(options = {}, registry = DEFAULT_REGISTRY) {
    return renderSelection(selectContent(registry, options), String(options.seed || ""), options.context || {});
  }

  function selectionRecord(selection) {
    if (!selection?.ok) return clone(selection);
    return {
      definitionId: selection.definitionId,
      sourceTheme: selection.sourceTheme,
      contentTags: [...selection.contentTags],
      usedFallback: selection.usedFallback,
      text: selection.text
    };
  }

  return Object.freeze({
    VERSION,
    COMPATIBILITIES,
    WORLD_THEMES,
    CONTENT_TAGS,
    DEFAULT_DEFINITIONS,
    DEFAULT_REGISTRY,
    createRegistry,
    validateDefinition,
    allowedCompatibilities,
    eligibleDefinitions,
    selectContent,
    selectRenderedContent,
    renderSelection,
    renderTemplate,
    selectionRecord
  });
});
