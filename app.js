(() => {
  "use strict";

  const STORAGE_KEY = "rogue-genesis-v1-save";
  const SAVE_FILE_NAME = "rogue-genesis-save.json";
  const BASES = ["A", "C", "G", "T"];
  const COMPLEMENT = { A: "T", T: "A", C: "G", G: "C" };
  const STORAGE_CAPACITY = 12;
  const REAL_TICK_MS = 250;
  const GAME_MINUTES_PER_REAL_SECOND = 1;
  const MAX_SKILL_LEVEL = 100;
  const STAMINA_REGEN_MINUTES = 10;
  const MANA_REGEN_MINUTES = 10;
  const NEW_DISCOVERY_XP = 25;
  const DEFAULT_VITAL_MAX = 100;
  const BASE_ACTION_STAMINA = 10;
  const HANDLING_STAMINA = 3;
  const DISPLAY_REGION_KEYS = [
    "size",
    "color",
    "texture",
    "movement",
    "behavior",
    "diet",
    "byproduct",
    "element",
    "stability",
    "brood",
    "growth",
    "lifespan"
  ];
  const TRAIT_SYMBOLS = {
    size: "□",
    color: "■",
    texture: "≋",
    movement: "→",
    behavior: "!",
    diet: "◒",
    byproduct: "◆",
    element: "✦",
    stability: "◇",
    brood: "×",
    growth: "↑",
    lifespan: "⌛"
  };
  const ELEMENT_SYMBOLS = {
    none: "--",
    flame: "△",
    frost: "*",
    storm: "↯",
    stone: "■",
    shadow: "◑",
    light: "☼",
    water: "≈",
    wind: "∿",
    wood: "♣",
    metal: "⬢",
    poison: "!",
    acid: "⌁",
    dream: "◌",
    gravity: "↓",
    ether: "✦"
  };
  const SIZE_VOLUME_CM3 = {
    threadlike: 8,
    seedling: 32,
    "thumb-sized": 18,
    "cup-sized": 230,
    "hand-sized": 520,
    "pancake-wide": 900,
    "compact dense": 1500,
    "shoebox-sized": 2100,
    "bucket-sized": 12000,
    "barrel-sized": 160000,
    "waist-high": 360000,
    "cart-sized": 620000,
    "door-high": 920000,
    "wardrobe-sized": 1400000,
    towering: 3200000,
    "room-filling": 8500000
  };

  const SKILL_DEFS = [
    { id: "observation", label: "Observation" },
    { id: "slimeHandling", label: "Slime Handling" },
    { id: "biofabrication", label: "Biofabrication" },
    { id: "nutrition", label: "Nutrition" },
    { id: "arcaneChemistry", label: "Arcane Chemistry" },
    { id: "materialsAnalysis", label: "Materials Analysis" },
    { id: "ethology", label: "Ethology" },
    { id: "physiology", label: "Physiology" },
    { id: "reproductiveBiology", label: "Reproductive Biology" }
  ];
  const SKILL_BY_ID = Object.fromEntries(SKILL_DEFS.map((skill) => [skill.id, skill]));
  const SKILL_ALIASES = Object.fromEntries(SKILL_DEFS.flatMap((skill) => [
    [normalizeCommandName(skill.id), skill.id],
    [normalizeCommandName(skill.label), skill.id]
  ]));

  const REGION_DEFS = [
    { key: "size", label: "Size", test: "visual" },
    { key: "color", label: "Color", test: "visual" },
    { key: "texture", label: "Texture", test: "visual" },
    { key: "behavior", label: "Behavior", test: "behavior" },
    { key: "diet", label: "Diet", test: "feed" },
    { key: "byproduct", label: "Byproduct", test: "byproduct" },
    { key: "element", label: "Element", test: "element" },
    { key: "stability", label: "Stability", test: "containment" },
    { key: "movement", label: "Movement", test: "visual" },
    { key: "brood", label: "Brood Size", test: "breeding" },
    { key: "growth", label: "Growth Speed", test: "breeding" },
    { key: "lifespan", label: "Lifespan", test: "lifespan" }
  ].map((region, index) => ({
    ...region,
    start: index * 2,
    length: 2
  }));

  const GENOME_LENGTH = REGION_DEFS.length * 2;
  const REGION_BY_KEY = Object.fromEntries(REGION_DEFS.map((region) => [region.key, region]));
  const DISPLAY_REGION_DEFS = DISPLAY_REGION_KEYS.map((key) => REGION_BY_KEY[key]);
  const TESTS = [
    { id: "visual", label: "Visual Survey", traits: ["size", "color", "texture", "movement"], duration: 4, skillId: "observation", xp: 15 },
    { id: "feed", label: "Feed Test", traits: ["diet"], duration: 8, skillId: "nutrition", xp: 20 },
    { id: "element", label: "Element Exposure", traits: ["element"], duration: 10, skillId: "arcaneChemistry", xp: 20 },
    { id: "containment", label: "Containment Test", traits: ["stability"], duration: 12, skillId: "physiology", xp: 25 },
    { id: "byproduct", label: "Byproduct Collection", traits: ["byproduct"], duration: 14, skillId: "materialsAnalysis", xp: 20 },
    { id: "behavior", label: "Behavior Observation", traits: ["behavior"], duration: 9, skillId: "ethology", xp: 20 },
    { id: "stress", label: "Stress Test", traits: ["stability", "lifespan"], duration: 16, skillId: "physiology", xp: 25 },
    { id: "breeding", label: "Breeding Survey", traits: ["brood", "growth"], duration: 18, skillId: "reproductiveBiology", xp: 30 },
    { id: "lifespan", label: "Lifespan Study", traits: ["lifespan"], duration: 20, skillId: "physiology", xp: 25 }
  ];

  const dom = {};
  let state;
  let geneMap;
  let lastTickAt = Date.now();

  function defaultState() {
    const seed = makeSeed();
    return {
      started: false,
      seed,
      journalMode: "auto",
      complexity: "clean",
      scientist: defaultScientist(),
      paused: true,
      clock: 0,
      currentGenome: "",
      queueDrawerOpen: false,
      slimes: [],
      tasks: [],
      selectedSlimeId: null,
      nextSlimeNumber: 1,
      nextTaskNumber: 1,
      discoveries: {},
      regionNotes: {},
      genomeNotes: {},
      slimeNotes: {},
      regionLocks: {},
      knownResultKeys: {},
      resultRepeats: {},
      events: []
    };
  }

  function defaultScientist() {
    return {
      vitals: {
        health: { current: DEFAULT_VITAL_MAX, max: DEFAULT_VITAL_MAX },
        stamina: { current: DEFAULT_VITAL_MAX, max: DEFAULT_VITAL_MAX },
        mana: { current: DEFAULT_VITAL_MAX, max: DEFAULT_VITAL_MAX }
      },
      skills: Object.fromEntries(SKILL_DEFS.map((skill) => [skill.id, { xp: 0 }]))
    };
  }

  function init() {
    cacheDom();
    bindEvents();
    const loaded = loadLocalSave();
    state = loaded || defaultState();
    geneMap = buildGeneMap(state.seed, state.complexity);
    if (!state.currentGenome) {
      state.currentGenome = randomGenome(seedRng(`${state.seed}:starter`));
    }
    syncSetupForm();
    dom.setupOverlay.classList.toggle("hidden", state.started);
    render();
    window.setInterval(tick, REAL_TICK_MS);
  }

  function cacheDom() {
    for (const id of [
      "clockReadout",
      "pauseReadout",
      "seedReadout",
      "storageReadout",
      "pauseBtn",
      "newRunBtn",
      "exportFolderBtn",
      "exportFileBtn",
      "importFileInput",
      "labRoot",
      "sequenceStatus",
      "helixGrid",
      "sequenceInput",
      "loadSelectedGenomeBtn",
      "randomGenomeBtn",
      "copySequenceBtn",
      "lockSummary",
      "randomUnlockedBtn",
      "lockAllBtn",
      "clearLocksBtn",
      "regionLockGrid",
      "synthesizeBtn",
      "applyKnownBtn",
      "confirmKnownBtn",
      "knownEditor",
      "knownTraitSelect",
      "knownOutcomeSelect",
      "predictionList",
      "selectedSlimeSummary",
      "releaseBtn",
      "slimeList",
      "testButtons",
      "parentASelect",
      "parentBSelect",
      "breedBtn",
      "healthReadout",
      "staminaReadout",
      "manaReadout",
      "skillList",
      "restFullBtn",
      "restMinutesInput",
      "restCustomBtn",
      "xpCommandInput",
      "xpCommandBtn",
      "xpCommandStatus",
      "journalModeReadout",
      "journalContent",
      "queueDrawer",
      "queueToggleBtn",
      "queueBadge",
      "queueNextReadout",
      "queueSummary",
      "skipAmountInput",
      "skipTimeBtn",
      "taskList",
      "eventLog",
      "setupOverlay",
      "setupForm",
      "seedInput",
      "randomSeedBtn",
      "journalModeSelect",
      "complexitySelect"
    ]) {
      dom[id] = document.getElementById(id);
    }
  }

  function bindEvents() {
    dom.setupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = defaultState();
      next.started = true;
      next.paused = false;
      next.seed = cleanSeed(dom.seedInput.value) || makeSeed();
      next.journalMode = dom.journalModeSelect.value;
      next.complexity = dom.complexitySelect.value;
      next.currentGenome = randomGenome(seedRng(`${next.seed}:starter`));
      state = next;
      geneMap = buildGeneMap(state.seed, state.complexity);
      addEvent("Run initialized.");
      persist();
      render();
    });

    dom.randomSeedBtn.addEventListener("click", () => {
      dom.seedInput.value = makeSeed();
    });

    dom.pauseBtn.addEventListener("click", () => {
      state.paused = !state.paused;
      lastTickAt = Date.now();
      persist();
      render();
    });

    dom.newRunBtn.addEventListener("click", () => {
      if (!window.confirm("Start a new run? The current run remains available only if exported first.")) {
        return;
      }
      state = defaultState();
      geneMap = buildGeneMap(state.seed, state.complexity);
      syncSetupForm();
      persist();
      render();
    });

    dom.sequenceInput.addEventListener("input", () => {
      const cleaned = cleanGenome(dom.sequenceInput.value);
      dom.sequenceInput.value = cleaned;
      if (cleaned.length === GENOME_LENGTH) {
        state.currentGenome = preserveLockedRegions(cleaned, state.currentGenome);
        dom.sequenceInput.value = state.currentGenome;
        persist();
        render();
      } else {
        dom.sequenceStatus.textContent = `${cleaned.length}/${GENOME_LENGTH} base pairs`;
      }
    });

    dom.randomGenomeBtn.addEventListener("click", () => {
      const previous = state.currentGenome;
      const drafted = randomGenome(seedRng(`${state.seed}:random:${Date.now()}:${Math.random()}`));
      state.currentGenome = preserveLockedRegions(drafted, state.currentGenome);
      addEvent(state.currentGenome === previous ? "All regions are locked." : "Genome draft randomized.");
      persist();
      render();
    });

    dom.loadSelectedGenomeBtn.addEventListener("click", () => {
      const slime = getSelectedSlime();
      if (!slime) {
        return;
      }
      const previous = state.currentGenome;
      state.currentGenome = preserveLockedRegions(slime.genome, state.currentGenome);
      addEvent(state.currentGenome === previous ? "All regions are locked." : `${slime.name} genome loaded into the foundry.`);
      persist();
      render();
    });

    dom.copySequenceBtn.addEventListener("click", async () => {
      await copyText(state.currentGenome);
      addEvent("Sequence copied.");
      persist();
      render();
    });

    dom.randomUnlockedBtn.addEventListener("click", () => {
      const changed = randomizeUnlockedRegions();
      addEvent(changed ? `Randomized ${changed} unlocked regions.` : "All regions are locked.");
      persist();
      render();
    });

    dom.lockAllBtn.addEventListener("click", () => {
      for (const region of REGION_DEFS) {
        state.regionLocks[region.key] = true;
      }
      addEvent("All genome regions locked.");
      persist();
      render();
    });

    dom.clearLocksBtn.addEventListener("click", () => {
      state.regionLocks = {};
      addEvent("Genome region locks cleared.");
      persist();
      render();
    });

    dom.synthesizeBtn.addEventListener("click", () => {
      if (!canAddContainedSlime()) {
        addEvent("No containment pod is open.");
        persist();
        render();
        return;
      }
      startStaminaTask({
        type: "synthesize",
        label: "Synthesize slime",
        baseDuration: 8,
        skillId: "biofabrication",
        baseXp: 25,
        baseCost: BASE_ACTION_STAMINA,
        data: { genome: state.currentGenome }
      });
    });

    dom.applyKnownBtn.addEventListener("click", () => {
      dom.knownEditor.classList.toggle("hidden");
      renderKnownEditor();
    });

    dom.knownTraitSelect.addEventListener("change", renderKnownEditor);
    dom.confirmKnownBtn.addEventListener("click", () => {
      const traitKey = dom.knownTraitSelect.value;
      const discoveryKey = dom.knownOutcomeSelect.value;
      if (!traitKey || !discoveryKey) {
        return;
      }
      const item = state.discoveries[traitKey]?.[discoveryKey];
      if (!item) {
        return;
      }
      let nextGenome = state.currentGenome;
      for (const codeRef of item.codes) {
        nextGenome = replaceRegionCode(nextGenome, codeRef.region, codeRef.code);
      }
      state.currentGenome = nextGenome;
      addEvent(`${getRegionLabel(traitKey)} sequence applied.`);
      persist();
      render();
    });

    dom.releaseBtn.addEventListener("click", () => {
      const slime = getSelectedSlime();
      if (!slime || slime.status === "dead") {
        return;
      }
      if (slime.status === "released" && containedSlimeCount() >= STORAGE_CAPACITY) {
        addEvent("No containment pod is open.");
        persist();
        render();
        return;
      }
      const cost = adjustedStaminaCost(HANDLING_STAMINA, ["slimeHandling"]);
      if (!spendStamina(cost)) {
        addEvent(`Not enough stamina. ${cost} required.`);
        persist();
        render();
        return;
      }
      slime.status = slime.status === "released" ? "contained" : "released";
      addEvent(`${slime.name} ${slime.status === "released" ? "released into the lab" : "returned to containment"}.`);
      awardXp("slimeHandling", 5, "Slime handling");
      persist();
      render();
    });

    dom.breedBtn.addEventListener("click", () => {
      const parentA = findSlime(dom.parentASelect.value);
      const parentB = findSlime(dom.parentBSelect.value);
      if (!parentA || !parentB || parentA.id === parentB.id) {
        addEvent("Select two different mature slimes.");
        persist();
        render();
        return;
      }
      if (!isBreedable(parentA) || !isBreedable(parentB)) {
        addEvent("Breeding requires living mature slimes.");
        persist();
        render();
        return;
      }
      startStaminaTask({
        type: "breed",
        label: `Breed ${parentA.name} x ${parentB.name}`,
        baseDuration: 18,
        skillId: "reproductiveBiology",
        baseXp: 30,
        baseCost: BASE_ACTION_STAMINA,
        data: { parentAId: parentA.id, parentBId: parentB.id }
      });
    });

    dom.restFullBtn.addEventListener("click", () => {
      const missing = scientistVital("stamina").max - scientistVital("stamina").current;
      if (missing <= 0) {
        addEvent("Stamina is already full.");
        persist();
        render();
        return;
      }
      createRestTask(Math.ceil(missing));
    });

    dom.restCustomBtn.addEventListener("click", () => {
      const minutes = Math.max(1, Math.floor(Number(dom.restMinutesInput.value) || 1));
      createRestTask(minutes);
    });

    dom.xpCommandBtn.addEventListener("click", () => {
      runXpCommand();
    });

    dom.xpCommandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runXpCommand();
      }
    });

    dom.queueToggleBtn.addEventListener("click", () => {
      state.queueDrawerOpen = !state.queueDrawerOpen;
      persist();
      render();
    });

    dom.skipTimeBtn.addEventListener("click", () => {
      const amount = Math.max(1, Math.floor(Number(dom.skipAmountInput.value) || 1));
      advanceTime(amount);
      persist();
      render();
    });

    dom.exportFileBtn.addEventListener("click", () => {
      downloadSave();
    });

    dom.exportFolderBtn.addEventListener("click", () => {
      exportToFolder();
    });

    dom.importFileInput.addEventListener("change", importSave);
  }

  function tick() {
    const now = Date.now();
    const elapsedSeconds = (now - lastTickAt) / 1000;
    lastTickAt = now;
    if (!state?.started || state.paused) {
      return;
    }
    const changed = advanceTime(elapsedSeconds * GAME_MINUTES_PER_REAL_SECOND, { quiet: true });
    if (changed) {
      render();
    } else {
      renderLiveReadouts();
    }
  }

  function advanceTime(minutes, options = {}) {
    state.clock += minutes;
    const vitalsChanged = recoverVitals(minutes);
    const expired = expireSlimes();
    const completed = completeDueTasks();
    if (!options.quiet) {
      addEvent(`Advanced ${formatDuration(minutes)}.`);
    }
    if (!options.quiet || expired || completed || vitalsChanged) {
      persist();
    }
    return expired + completed + (vitalsChanged ? 1 : 0);
  }

  function completeDueTasks() {
    let completedCount = 0;
    let completedAny = true;
    while (completedAny) {
      completedAny = false;
      const due = state.tasks
        .filter((task) => task.dueAt <= state.clock)
        .sort((a, b) => a.dueAt - b.dueAt);
      for (const task of due) {
        state.tasks = state.tasks.filter((candidate) => candidate.id !== task.id);
        completeTask(task);
        completedAny = true;
        completedCount += 1;
      }
    }
    return completedCount;
  }

  function completeTask(task) {
    if (task.type === "synthesize") {
      if (containedSlimeCount() >= STORAGE_CAPACITY) {
        addEvent("Synthesis could not stabilize; no containment pod was open.");
        return;
      }
      const slime = createSlime(task.data.genome, "Synthetic");
      const reveal = revealTraits(slime, TESTS.find((test) => test.id === "visual").traits);
      awardActionXp(task.data.skillId, task.data.baseXp, reveal, "Synthesis");
      addEvent(`${slime.name} stabilized.`);
      state.selectedSlimeId = slime.id;
      return;
    }

    if (task.type === "test") {
      const slime = findSlime(task.data.slimeId);
      const test = TESTS.find((candidate) => candidate.id === task.data.testId);
      if (!slime || !test) {
        return;
      }
      const reveal = revealTraits(slime, test.traits, { measured: true, testId: test.id });
      awardActionXp(task.data.skillId, task.data.baseXp, reveal, test.label);
      addEvent(`${test.label} complete for ${slime.name}.`);
      return;
    }

    if (task.type === "breed") {
      completeBreeding(task);
      return;
    }

    if (task.type === "mature") {
      const slime = findSlime(task.data.slimeId);
      if (slime && slime.status !== "dead") {
        slime.mature = true;
        addEvent(`${slime.name} reached maturity.`);
      }
      return;
    }

    if (task.type === "rest") {
      restoreStamina(task.data.restore);
      addEvent(`Rest complete. Recovered ${formatNumber(task.data.restore)} stamina.`);
    }
  }

  function createTask({ type, label, duration, data }) {
    const task = {
      id: `task-${state.nextTaskNumber++}`,
      type,
      label,
      createdAt: state.clock,
      dueAt: state.clock + duration,
      data
    };
    state.tasks.push(task);
    addEvent(`${label} started.`);
    persist();
    render();
  }

  function startStaminaTask({ type, label, baseDuration, skillId, baseXp, baseCost, data }) {
    const cost = adjustedStaminaCost(baseCost, [skillId, "slimeHandling"]);
    if (!spendStamina(cost)) {
      addEvent(`Not enough stamina. ${cost} required.`);
      persist();
      render();
      return false;
    }
    createTask({
      type,
      label,
      duration: adjustedDuration(baseDuration, skillId),
      data: {
        ...data,
        skillId,
        baseXp,
        staminaCost: cost
      }
    });
    return true;
  }

  function createRestTask(minutes) {
    createTask({
      type: "rest",
      label: `Rest ${formatDuration(minutes)}`,
      duration: minutes,
      data: { restore: minutes }
    });
  }

  function createSlime(genome, source, options = {}) {
    const evaluated = evaluateGenome(genome);
    const lifespanMinutes = evaluated.traits.lifespan.meta.lifeMinutes;
    const slime = {
      id: `slime-${state.nextSlimeNumber}`,
      name: `RG-${String(state.nextSlimeNumber).padStart(3, "0")}`,
      genome,
      source,
      createdAt: state.clock,
      deathAt: state.clock + lifespanMinutes,
      matureAt: options.matureAt ?? state.clock,
      mature: options.mature ?? true,
      status: "contained",
      revealed: {},
      measured: {},
      testsRun: []
    };
    state.nextSlimeNumber += 1;
    state.slimes.unshift(slime);
    return slime;
  }

  function completeBreeding(task) {
    const parentA = findSlime(task.data.parentAId);
    const parentB = findSlime(task.data.parentBId);
    if (!parentA || !parentB || !isBreedable(parentA) || !isBreedable(parentB)) {
      addEvent("Breeding run could not complete.");
      return;
    }
    const evalA = evaluateGenome(parentA.genome);
    const evalB = evaluateGenome(parentB.genome);
    const broodAverage = (evalA.traits.brood.meta.count + evalB.traits.brood.meta.count) / 2;
    const rng = seedRng(`${state.seed}:breed:${task.id}:${state.clock}`);
    const broodCount = clamp(Math.round(broodAverage + Math.floor(rng() * 3) - 1), 1, 8);
    const growthAverage = (evalA.traits.growth.meta.growthMinutes + evalB.traits.growth.meta.growthMinutes) / 2;
    const created = [];
    const revealSummary = emptyRevealSummary();
    for (let i = 0; i < broodCount; i += 1) {
      if (!canAddContainedSlime()) {
        addEvent("Remaining offspring diverted; containment is full.");
        break;
      }
      const childGenome = crossoverGenome(parentA.genome, parentB.genome, seedRng(`${state.seed}:child:${task.id}:${i}`));
      const growthMinutes = Math.max(4, Math.round(growthAverage * (0.8 + rng() * 0.4)));
      const child = createSlime(childGenome, "Bred", {
        mature: false,
        matureAt: state.clock + growthMinutes
      });
      mergeRevealSummary(revealSummary, revealTraits(child, ["size", "color", "texture", "movement"]));
      createTask({
        type: "mature",
        label: `Mature ${child.name}`,
        duration: growthMinutes,
        data: { slimeId: child.id }
      });
      created.push(child.name);
    }
    awardActionXp(task.data.skillId, task.data.baseXp, revealSummary, "Breeding");
    addEvent(`Breeding produced ${created.length} offspring.`);
  }

  function revealTraits(slime, traitKeys, options = {}) {
    const evaluated = evaluateGenome(slime.genome);
    const summary = emptyRevealSummary();
    slime.revealed ||= {};
    slime.measured ||= {};
    slime.testsRun ||= [];
    if (options.testId && !slime.testsRun.includes(options.testId)) {
      slime.testsRun.push(options.testId);
    }
    for (const traitKey of traitKeys) {
      const result = evaluated.traits[traitKey];
      const key = knowledgeKey(traitKey, evaluated.details[traitKey].codes);
      const repeatKey = `${options.measured ? "measured" : "observed"}:${key}`;
      const wasKnown = Boolean(state.knownResultKeys[repeatKey]);
      if (wasKnown) {
        const repeats = state.resultRepeats[repeatKey] || 0;
        summary.repeatMultipliers.push(1 / (2 ** (repeats + 1)));
        state.resultRepeats[repeatKey] = repeats + 1;
      } else {
        summary.newDiscoveries += 1;
        summary.repeatMultipliers.push(1);
        state.knownResultKeys[repeatKey] = true;
        state.resultRepeats[repeatKey] = 0;
      }
      slime.revealed[traitKey] = result.label;
      if (options.measured) {
        slime.measured[traitKey] = true;
      }
      recordDiscovery(slime, traitKey, evaluated, { measured: Boolean(options.measured) });
    }
    return summary;
  }

  function recordDiscovery(slime, traitKey, evaluated = evaluateGenome(slime.genome), options = {}) {
    if (state.journalMode !== "auto") {
      return;
    }
    const detail = evaluated.details[traitKey];
    const key = knowledgeKey(traitKey, detail.codes);
    state.discoveries[traitKey] ||= {};
    const entry = state.discoveries[traitKey][key] ||= {
      trait: traitKey,
      label: evaluated.traits[traitKey].label,
      codes: detail.codes,
      sample: slime.genome,
      discoveredAt: state.clock
    };
    entry.estimate ||= estimatedReading(traitKey, evaluated.traits[traitKey], slime.genome);
    if (options.measured) {
      entry.measurement = preciseReading(traitKey, evaluated.traits[traitKey]);
      entry.measuredAt = state.clock;
    }
  }

  function emptyRevealSummary() {
    return { newDiscoveries: 0, repeatMultipliers: [] };
  }

  function mergeRevealSummary(target, source) {
    target.newDiscoveries += source.newDiscoveries;
    target.repeatMultipliers.push(...source.repeatMultipliers);
    return target;
  }

  function awardActionXp(skillId, baseXp, revealSummary, label) {
    if (!skillId || !SKILL_BY_ID[skillId]) {
      return;
    }
    const multipliers = revealSummary.repeatMultipliers.length ? revealSummary.repeatMultipliers : [1];
    const averageMultiplier = multipliers.reduce((sum, value) => sum + value, 0) / multipliers.length;
    const actionXp = baseXp * averageMultiplier;
    const bonusXp = revealSummary.newDiscoveries * NEW_DISCOVERY_XP;
    awardXp(skillId, actionXp + bonusXp, label);
  }

  function awardXp(skillId, amount, reason) {
    const skill = scientistSkill(skillId);
    const before = skillLevel(skillId);
    skill.xp = Math.max(0, skill.xp + Math.max(0, Number(amount) || 0));
    const after = skillLevel(skillId);
    const label = SKILL_BY_ID[skillId]?.label || skillId;
    addEvent(`${label} gained ${formatXp(amount)} XP${reason ? ` from ${reason}` : ""}.`);
    if (after > before) {
      addEvent(`${label} reached level ${after}.`);
    }
  }

  function skillLevel(skillId) {
    const xp = scientistSkill(skillId).xp;
    let level = 0;
    let remaining = xp;
    while (level < MAX_SKILL_LEVEL) {
      const needed = xpToNextLevel(level);
      if (remaining < needed) {
        break;
      }
      remaining -= needed;
      level += 1;
    }
    return level;
  }

  function skillProgress(skillId) {
    const xp = scientistSkill(skillId).xp;
    let level = 0;
    let remaining = xp;
    while (level < MAX_SKILL_LEVEL) {
      const needed = xpToNextLevel(level);
      if (remaining < needed) {
        return { level, current: remaining, next: needed, percent: needed ? remaining / needed : 1 };
      }
      remaining -= needed;
      level += 1;
    }
    return { level: MAX_SKILL_LEVEL, current: 0, next: 0, percent: 1 };
  }

  function xpToNextLevel(level) {
    return Math.round(100 * Math.pow(level + 1, 2.2));
  }

  function expireSlimes() {
    let expired = 0;
    for (const slime of state.slimes) {
      if (slime.status !== "dead" && slime.deathAt <= state.clock) {
        slime.status = "dead";
        slime.mature = false;
        addEvent(`${slime.name} reached the end of its lifespan.`);
        expired += 1;
      }
    }
    return expired;
  }

  function buildGeneMap(seed, complexity) {
    const rng = seedRng(`${seed}:gene-map:${complexity}`);
    const codes = pairCodes();
    const traitMaps = {};
    for (const region of REGION_DEFS) {
      const shuffledCodes = shuffle([...codes], rng);
      const outcomes = shuffle(makeOutcomes(region.key, rng), rng);
      traitMaps[region.key] = {};
      for (let i = 0; i < shuffledCodes.length; i += 1) {
        traitMaps[region.key][shuffledCodes[i]] = outcomes[i];
      }
    }
    return {
      seed,
      complexity,
      traitMaps,
      interactions: makeInteractions(seed, complexity, rng)
    };
  }

  function makeOutcomes(key, rng) {
    const pools = {
      size: [
        ["seedling", 0.2],
        ["thumb-sized", 0.35],
        ["cup-sized", 0.55],
        ["hand-sized", 0.8],
        ["shoebox-sized", 1.2],
        ["bucket-sized", 1.7],
        ["barrel-sized", 2.4],
        ["waist-high", 3.4],
        ["door-high", 4.8],
        ["cart-sized", 6.2],
        ["wardrobe-sized", 8.5],
        ["room-filling", 12],
        ["threadlike", 0.1],
        ["pancake-wide", 1.0],
        ["towering", 10],
        ["compact dense", 2.2]
      ],
      color: [
        ["moss green", "#75b86b"],
        ["lamp yellow", "#e6d45f"],
        ["ink black", "#171717"],
        ["milk white", "#f2f0dc"],
        ["copper orange", "#d98242"],
        ["deep violet", "#8061c5"],
        ["glass clear", "#bdefff"],
        ["blood red", "#c83d3d"],
        ["moon blue", "#6ea9d6"],
        ["ash gray", "#90938b"],
        ["rose pink", "#d979a7"],
        ["acid lime", "#b7e35f"],
        ["tar brown", "#6b4f3c"],
        ["teal green", "#3fb6a3"],
        ["ember gold", "#d69d3a"],
        ["opal pale", "#d7cdea"]
      ],
      texture: [
        "watery",
        "gelatinous",
        "rubbery",
        "foamy",
        "grainy",
        "sticky",
        "glassy",
        "ropey",
        "velvet-slick",
        "clotted",
        "bubbled",
        "oily",
        "fibrous",
        "crystalline",
        "powdered",
        "elastic"
      ],
      behavior: [
        "idle pooling",
        "edge following",
        "light seeking",
        "light avoiding",
        "heat seeking",
        "cold nesting",
        "tool orbiting",
        "sound following",
        "vibration hunting",
        "hiding",
        "guarding",
        "cleaning",
        "swarming",
        "burrowing",
        "circling",
        "still ambush"
      ],
      diet: [
        "sugars",
        "bone dust",
        "mold",
        "scrap metal",
        "ash",
        "lamp oil",
        "raw mana salts",
        "rotting leaves",
        "sand",
        "blood residue",
        "paper fiber",
        "glass powder",
        "coal dust",
        "meat slurry",
        "sewer film",
        "hazard sludge"
      ],
      byproduct: [
        "adhesive gel",
        "cooling brine",
        "glow mucus",
        "clean water",
        "black resin",
        "alkaline foam",
        "acid droplets",
        "fertile silt",
        "mana dew",
        "grease pearls",
        "salt crystals",
        "numbing paste",
        "smoke vapor",
        "coagulating wax",
        "metallic flakes",
        "sterile solvent"
      ],
      element: [
        "none",
        "flame",
        "frost",
        "storm",
        "stone",
        "shadow",
        "light",
        "water",
        "wind",
        "wood",
        "metal",
        "poison",
        "acid",
        "dream",
        "gravity",
        "ether"
      ],
      stability: [
        ["placid", 1],
        ["steady", 2],
        ["docile", 2],
        ["nervous", 4],
        ["flickering", 5],
        ["volatile", 7],
        ["fractious", 6],
        ["apathetic", 3],
        ["hungry", 5],
        ["territorial", 6],
        ["obedient", 2],
        ["fragile", 4],
        ["self-knitting", 2],
        ["erratic", 7],
        ["predatory", 8],
        ["dormant", 1]
      ],
      movement: [
        "oozing",
        "pulsing",
        "hopping",
        "rolling",
        "climbing",
        "flattening",
        "threading",
        "dripping",
        "sliding",
        "bouncing",
        "flowing uphill",
        "anchoring",
        "skittering",
        "floating",
        "splattering",
        "burrowing"
      ],
      brood: [
        ["single offspring", 1],
        ["paired offspring", 2],
        ["small clutch", 3],
        ["small clutch", 3],
        ["standard clutch", 4],
        ["standard clutch", 4],
        ["large clutch", 5],
        ["large clutch", 5],
        ["swollen clutch", 6],
        ["swollen clutch", 6],
        ["dense clutch", 7],
        ["dense clutch", 7],
        ["flood clutch", 8],
        ["flood clutch", 8],
        ["reluctant single", 1],
        ["unstable pair", 2]
      ],
      growth: [
        ["flash growth", 4],
        ["rapid growth", 6],
        ["quick growth", 8],
        ["quick growth", 9],
        ["steady growth", 12],
        ["steady growth", 14],
        ["patient growth", 18],
        ["patient growth", 20],
        ["slow growth", 25],
        ["slow growth", 30],
        ["deep gestation", 36],
        ["deep gestation", 42],
        ["delayed growth", 48],
        ["delayed growth", 54],
        ["glacial growth", 60],
        ["glacial growth", 72]
      ],
      lifespan: [
        ["brief", 180],
        ["short", 240],
        ["short", 300],
        ["modest", 420],
        ["modest", 540],
        ["stable", 720],
        ["stable", 960],
        ["long", 1320],
        ["long", 1800],
        ["enduring", 2400],
        ["enduring", 3000],
        ["elder", 3600],
        ["elder", 4800],
        ["flicker-lived", 120],
        ["slow-fading", 6000],
        ["near-persistent", 7200]
      ]
    };

    const pool = shuffle([...pools[key]], rng);
    return pool.map((entry, index) => outcomeFromEntry(key, entry, index));
  }

  function outcomeFromEntry(key, entry, index) {
    if (key === "color") {
      return { label: entry[0], meta: { color: entry[1] } };
    }
    if (key === "size") {
      return { label: entry[0], meta: { mass: entry[1] } };
    }
    if (key === "stability") {
      return { label: entry[0], meta: { risk: entry[1] } };
    }
    if (key === "brood") {
      return { label: entry[0], meta: { count: entry[1] } };
    }
    if (key === "growth") {
      return { label: entry[0], meta: { growthMinutes: entry[1] } };
    }
    if (key === "lifespan") {
      return { label: entry[0], meta: { lifeMinutes: entry[1] } };
    }
    return { label: String(entry), meta: { index } };
  }

  function makeInteractions(seed, complexity, rng) {
    const counts = { clean: 0, linked: 4, entangled: 9 };
    const count = counts[complexity] ?? 0;
    const targetable = REGION_DEFS.map((region) => region.key);
    const modifiers = [
      "faint secondary expression",
      "suppressed expression",
      "amplified expression",
      "unstable secondary rhythm",
      "mineralized trace",
      "thaumic aftereffect",
      "cold-biased expression",
      "heat-biased expression",
      "predatory undertone",
      "dormant undertone",
      "rapid cycling",
      "slow cycling"
    ];
    const interactions = [];
    for (let i = 0; i < count; i += 1) {
      const target = targetable[Math.floor(rng() * targetable.length)];
      let source = target;
      while (source === target) {
        source = targetable[Math.floor(rng() * targetable.length)];
      }
      interactions.push({
        id: `ix-${i}`,
        target,
        source,
        modifiers: shuffle([...modifiers], seedRng(`${seed}:interaction:${i}`)).slice(0, 4)
      });
    }
    return interactions;
  }

  function evaluateGenome(genome) {
    const traits = {};
    const details = {};
    for (const region of REGION_DEFS) {
      const code = getRegionCode(genome, region.key);
      const baseOutcome = geneMap.traitMaps[region.key][code];
      traits[region.key] = cloneOutcome(baseOutcome);
      details[region.key] = {
        codes: [{ region: region.key, code }]
      };
    }

    for (const interaction of geneMap.interactions) {
      const targetCode = getRegionCode(genome, interaction.target);
      const sourceCode = getRegionCode(genome, interaction.source);
      const hashValue = stringHash(`${state.seed}:${interaction.id}:${targetCode}:${sourceCode}`);
      const modifier = interaction.modifiers[hashValue % interaction.modifiers.length];
      traits[interaction.target] = {
        ...traits[interaction.target],
        label: `${traits[interaction.target].label} / ${modifier}`
      };
      details[interaction.target].codes.push({ region: interaction.source, code: sourceCode });
    }

    return { traits, details };
  }

  function cloneOutcome(outcome) {
    return {
      label: outcome.label,
      meta: { ...outcome.meta }
    };
  }

  function getRegionCode(genome, regionKey) {
    const region = REGION_BY_KEY[regionKey];
    return genome.slice(region.start, region.start + region.length);
  }

  function replaceRegionCode(genome, regionKey, code) {
    const region = REGION_BY_KEY[regionKey];
    return `${genome.slice(0, region.start)}${code}${genome.slice(region.start + region.length)}`;
  }

  function knowledgeKey(traitKey, codes) {
    return `${traitKey}|${codes.map((item) => `${item.region}:${item.code}`).sort().join("|")}`;
  }

  function render() {
    renderLiveReadouts();
    dom.sequenceInput.value = state.currentGenome;
    dom.sequenceStatus.textContent = `${state.currentGenome.length}/${GENOME_LENGTH} base pairs`;
    dom.journalModeReadout.textContent = journalModeName(state.journalMode);
    renderHelix();
    renderMutationBench();
    renderPredictions();
    renderSlimes();
    renderTests();
    renderBreeding();
    renderScientist();
    renderTasks();
    renderJournal();
    renderEvents();
    renderKnownEditor();
    refreshActionControls();
    syncSetupForm();
  }

  function renderLiveReadouts() {
    dom.setupOverlay.classList.toggle("hidden", state.started);
    dom.clockReadout.textContent = formatClock(state.clock);
    dom.pauseReadout.textContent = state.paused ? "Paused" : "Running";
    dom.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    dom.seedReadout.textContent = `Seed: ${state.seed}`;
    const reserved = pendingSynthesisCount();
    dom.storageReadout.textContent = reserved
      ? `Storage ${containedSlimeCount()}+${reserved}/${STORAGE_CAPACITY}`
      : `Storage ${containedSlimeCount()}/${STORAGE_CAPACITY}`;
    renderVitalReadouts();
    refreshActionControls();
    renderQueueShell();
    for (const element of document.querySelectorAll("[data-task-remaining]")) {
      const task = state.tasks.find((candidate) => candidate.id === element.dataset.taskRemaining);
      if (task) {
        element.textContent = `${formatDuration(task.dueAt - state.clock)} remaining`;
      }
    }
    for (const element of document.querySelectorAll("[data-slime-life]")) {
      const slime = findSlime(element.dataset.slimeLife);
      if (slime) {
        element.textContent = `life ${formatDuration(Math.max(0, slime.deathAt - state.clock))}`;
      }
    }
    for (const element of document.querySelectorAll("[data-slime-maturity]")) {
      const slime = findSlime(element.dataset.slimeMaturity);
      if (slime) {
        element.textContent = slime.mature ? "mature" : `matures in ${formatDuration(slime.matureAt - state.clock)}`;
      }
    }
  }

  function renderHelix() {
    const rows = 12;
    const cols = GENOME_LENGTH * 3 + 6;
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ text: " ", type: "text" })));

    for (let i = 0; i < GENOME_LENGTH; i += 1) {
      const x = i * 3 + 3;
      const yA = Math.round(1 + ((Math.sin(i * 0.78) + 1) / 2) * 8);
      const yB = rows - 1 - yA;
      const minY = Math.min(yA, yB);
      const maxY = Math.max(yA, yB);
      const base = state.currentGenome[i];
      const complement = COMPLEMENT[base];
      const pair = `${base}-${complement}`;
      for (let y = minY + 1; y < maxY; y += 1) {
        grid[y][x] = { text: y % 2 === 0 ? ":" : ".", type: "text" };
      }
      grid[yA][x] = { text: base, type: "base", index: i, complement: false, pair };
      grid[yB][x] = { text: complement, type: "base", index: i, complement: true, pair };
      if (i > 0) {
        const prevX = (i - 1) * 3 + 3;
        const prevYA = Math.round(1 + ((Math.sin((i - 1) * 0.78) + 1) / 2) * 8);
        const prevYB = rows - 1 - prevYA;
        const midX = Math.floor((prevX + x) / 2);
        const midYA = Math.floor((prevYA + yA) / 2);
        const midYB = Math.floor((prevYB + yB) / 2);
        grid[midYA][midX] = { text: yA > prevYA ? "\\" : "/", type: "text" };
        grid[midYB][midX] = { text: yB > prevYB ? "\\" : "/", type: "text" };
      }
    }

    dom.helixGrid.style.gridTemplateColumns = `repeat(${cols}, 1ch)`;
    dom.helixGrid.textContent = "";
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const cell = document.createElement("span");
        cell.className = "helix-cell";
        const data = grid[y][x];
        if (data.type === "base") {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `base-glyph ${baseClass(data.text)}${data.complement ? " base-complement" : ""}`;
          button.textContent = data.text;
          button.title = `Base pair ${data.index + 1}: ${data.pair}`;
          button.setAttribute("aria-label", `Base pair ${data.index + 1}: ${data.pair}`);
          button.addEventListener("click", () => {
            cycleBasePair(data.index, data.complement);
          });
          cell.append(button);
        } else {
          cell.textContent = data.text;
        }
        dom.helixGrid.append(cell);
      }
    }
  }

  function renderPredictions() {
    const evaluated = evaluateGenome(state.currentGenome);
    dom.predictionList.textContent = "";
    for (const region of DISPLAY_REGION_DEFS) {
      const detail = evaluated.details[region.key];
      const key = knowledgeKey(region.key, detail.codes);
      const known = state.journalMode === "auto" ? state.discoveries[region.key]?.[key] : null;
      const row = document.createElement("div");
      row.className = "prediction-row";
      row.append(
        traitLabelEl(region, known ? evaluated.traits[region.key] : null),
        textEl("span", known ? formatKnownOutcome(known) : "Undiscovered")
      );
      dom.predictionList.append(row);
    }
  }

  function renderMutationBench() {
    const lockedCount = REGION_DEFS.filter((region) => isRegionLocked(region.key)).length;
    dom.loadSelectedGenomeBtn.disabled = !getSelectedSlime();
    dom.randomUnlockedBtn.disabled = lockedCount === REGION_DEFS.length;
    dom.lockSummary.textContent = `${lockedCount}/${REGION_DEFS.length} regions locked`;
    dom.regionLockGrid.textContent = "";

    for (const region of REGION_DEFS) {
      const locked = isRegionLocked(region.key);
      const row = document.createElement("div");
      row.className = `region-lock-row${locked ? " locked" : ""}`;

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "region-lock-toggle";
      toggleLabel.title = `${locked ? "Unlock" : "Lock"} ${region.label}`;
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = locked;
      toggle.addEventListener("change", () => {
        setRegionLock(region.key, toggle.checked);
        persist();
        render();
      });
      toggleLabel.append(toggle);

      const name = document.createElement("div");
      name.className = "region-lock-name";
      name.append(textEl("span", region.label), baseSequenceEl(getRegionCode(state.currentGenome, region.key), "region-code"));

      const mutate = document.createElement("button");
      mutate.type = "button";
      mutate.className = "region-mutate";
      mutate.textContent = "Mutate";
      mutate.disabled = locked;
      mutate.addEventListener("click", () => {
        mutateRegion(region.key);
      });

      row.append(toggleLabel, name, mutate);
      dom.regionLockGrid.append(row);
    }
  }

  function renderFoundryActionState() {
    const cost = adjustedStaminaCost(BASE_ACTION_STAMINA, ["biofabrication", "slimeHandling"]);
    const duration = adjustedDuration(8, "biofabrication");
    dom.synthesizeBtn.textContent = `Synthesize Slime (${formatDuration(duration)}, ${cost} STA)`;
    const reason = canAddContainedSlime() ? staminaBlockReason(cost) : "No containment pod is open.";
    setActionButtonState(dom.synthesizeBtn, Boolean(reason), reason);
  }

  function refreshActionControls() {
    renderFoundryActionState();
    refreshReleaseButtonState();
    refreshTestButtonStates();
    refreshBreedButtonState();
  }

  function refreshReleaseButtonState() {
    const selected = getSelectedSlime();
    const cost = adjustedStaminaCost(HANDLING_STAMINA, ["slimeHandling"]);
    const releaseLabel = selected?.status === "released" ? "Contain" : "Release";
    dom.releaseBtn.textContent = `${releaseLabel} (${cost} STA)`;
    const reason = !selected || selected.status === "dead"
      ? "No living slime selected."
      : staminaBlockReason(cost);
    setActionButtonState(dom.releaseBtn, Boolean(reason), reason);
  }

  function refreshTestButtonStates() {
    const slime = getSelectedSlime();
    for (const button of dom.testButtons.querySelectorAll("[data-test-id]")) {
      const test = TESTS.find((candidate) => candidate.id === button.dataset.testId);
      if (!test) {
        continue;
      }
      const cost = adjustedStaminaCost(BASE_ACTION_STAMINA, [test.skillId, "slimeHandling"]);
      const duration = adjustedDuration(test.duration, test.skillId);
      button.textContent = `${test.label} (${formatDuration(duration)}, ${cost} STA)`;
      const reason = testBlockReason(test, slime, cost);
      setActionButtonState(button, Boolean(reason), reason);
    }
  }

  function testBlockReason(test, slime, cost) {
    if (!slime || slime.status === "dead") {
      return "No living slime selected.";
    }
    if (hasPendingTest(slime.id, test.id)) {
      return "Test already pending.";
    }
    return staminaBlockReason(cost);
  }

  function refreshBreedButtonState() {
    const breedable = state.slimes.filter(isBreedable);
    const cost = adjustedStaminaCost(BASE_ACTION_STAMINA, ["reproductiveBiology", "slimeHandling"]);
    const duration = adjustedDuration(18, "reproductiveBiology");
    dom.breedBtn.textContent = `Begin (${formatDuration(duration)}, ${cost} STA)`;
    const reason = breedable.length < 2 ? "Breeding requires two mature slimes." : staminaBlockReason(cost);
    setActionButtonState(dom.breedBtn, Boolean(reason), reason);
  }

  function renderSlimes() {
    dom.slimeList.textContent = "";
    const selected = getSelectedSlime();
    dom.selectedSlimeSummary.textContent = selected ? `${selected.name} - ${selected.status}` : "No slime selected";
    refreshReleaseButtonState();

    if (state.slimes.length === 0) {
      dom.slimeList.append(emptyText("No living samples."));
      return;
    }

    for (const slime of state.slimes) {
      const card = document.createElement("article");
      card.className = `slime-card${slime.id === state.selectedSlimeId ? " selected" : ""}${slime.status === "dead" ? " dead" : ""}`;
      card.addEventListener("click", () => {
        state.selectedSlimeId = slime.id;
        persist();
        render();
      });
      const title = document.createElement("h3");
      title.append(textEl("span", slime.name), textEl("span", slime.status));
      const meta = document.createElement("div");
      meta.className = "slime-meta";
      const maturity = chip(slime.mature ? "mature" : `matures in ${formatDuration(slime.matureAt - state.clock)}`);
      maturity.dataset.slimeMaturity = slime.id;
      const life = chip(`life ${formatDuration(Math.max(0, slime.deathAt - state.clock))}`);
      life.dataset.slimeLife = slime.id;
      meta.append(maturity);
      meta.append(life);
      meta.append(chip(slime.genome));
      card.append(title, meta);
      if (slime.id === state.selectedSlimeId) {
        card.append(renderTraitGrid(slime));
      }
      dom.slimeList.append(card);
    }
  }

  function renderTraitGrid(slime) {
    const grid = document.createElement("div");
    grid.className = "trait-grid subpanel";
    const evaluated = evaluateGenome(slime.genome);
    for (const region of DISPLAY_REGION_DEFS) {
      const outcome = slime.revealed?.[region.key] ? evaluated.traits[region.key] : null;
      const row = document.createElement("div");
      row.className = "trait-row";
      row.append(
        traitLabelEl(region, outcome),
        textEl("span", formatTraitValue(slime, region.key, evaluated.traits[region.key]))
      );
      grid.append(row);
    }
    return grid;
  }

  function renderTests() {
    dom.testButtons.textContent = "";
    const slime = getSelectedSlime();
    for (const test of TESTS) {
      const cost = adjustedStaminaCost(BASE_ACTION_STAMINA, [test.skillId, "slimeHandling"]);
      const duration = adjustedDuration(test.duration, test.skillId);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.testId = test.id;
      button.textContent = `${test.label} (${formatDuration(duration)}, ${cost} STA)`;
      const reason = testBlockReason(test, slime, cost);
      setActionButtonState(button, Boolean(reason), reason);
      button.addEventListener("click", () => {
        startStaminaTask({
          type: "test",
          label: `${test.label} on ${slime.name}`,
          baseDuration: test.duration,
          skillId: test.skillId,
          baseXp: test.xp,
          baseCost: BASE_ACTION_STAMINA,
          data: { slimeId: slime.id, testId: test.id }
        });
      });
      dom.testButtons.append(button);
    }
  }

  function renderBreeding() {
    const breedable = state.slimes.filter(isBreedable);
    renderSlimeOptions(dom.parentASelect, breedable, state.selectedSlimeId);
    renderSlimeOptions(dom.parentBSelect, breedable, breedable.find((slime) => slime.id !== state.selectedSlimeId)?.id);
    refreshBreedButtonState();
  }

  function renderSlimeOptions(select, slimes, preferredId) {
    const previous = select.value;
    select.textContent = "";
    for (const slime of slimes) {
      const option = document.createElement("option");
      option.value = slime.id;
      option.textContent = `${slime.name} ${slime.genome}`;
      select.append(option);
    }
    if (slimes.some((slime) => slime.id === previous)) {
      select.value = previous;
    } else if (preferredId && slimes.some((slime) => slime.id === preferredId)) {
      select.value = preferredId;
    }
  }

  function renderScientist() {
    renderVitalReadouts();
    dom.skillList.textContent = "";
    for (const skill of SKILL_DEFS) {
      const progress = skillProgress(skill.id);
      const row = document.createElement("div");
      row.className = "skill-row";

      const header = document.createElement("div");
      header.className = "skill-header";
      header.append(textEl("strong", skill.label), textEl("span", `Lvl ${progress.level}`));

      const meta = document.createElement("div");
      meta.className = "skill-meta";
      meta.textContent = progress.level >= MAX_SKILL_LEVEL
        ? `${formatXp(scientistSkill(skill.id).xp)} XP`
        : `${formatXp(progress.current)} / ${formatXp(progress.next)} XP`;

      const bar = document.createElement("div");
      bar.className = "skill-bar";
      const fill = document.createElement("div");
      fill.className = "skill-fill";
      fill.style.width = `${Math.round(progress.percent * 100)}%`;
      bar.append(fill);

      row.append(header, meta, bar);
      dom.skillList.append(row);
    }

    const stamina = scientistVital("stamina");
    dom.restFullBtn.disabled = stamina.current >= stamina.max || hasPendingRest();
    dom.restCustomBtn.disabled = hasPendingRest();
  }

  function renderVitalReadouts() {
    dom.healthReadout.textContent = formatVital(scientistVital("health"));
    dom.staminaReadout.textContent = formatVital(scientistVital("stamina"));
    dom.manaReadout.textContent = formatVital(scientistVital("mana"));
  }

  function setActionButtonState(button, disabled, reason = "") {
    button.disabled = disabled;
    button.title = reason;
    button.classList.toggle("blocked-action", reason.startsWith("Not enough stamina"));
  }

  function staminaBlockReason(cost) {
    return hasStamina(cost) ? "" : `Not enough stamina. ${cost} required.`;
  }

  function runXpCommand() {
    const command = dom.xpCommandInput.value.trim();
    const match = command.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      dom.xpCommandStatus.textContent = "Use format: observation 5000";
      return;
    }
    const skillId = SKILL_ALIASES[normalizeCommandName(match[1])];
    const amount = Number(match[2]);
    if (!skillId || !Number.isFinite(amount) || amount <= 0) {
      dom.xpCommandStatus.textContent = "Unknown skill or invalid XP amount.";
      return;
    }
    awardXp(skillId, amount, "cheat command");
    dom.xpCommandInput.value = "";
    dom.xpCommandStatus.textContent = `Added ${formatXp(amount)} XP to ${SKILL_BY_ID[skillId].label}.`;
    persist();
    render();
  }

  function renderTasks() {
    dom.taskList.textContent = "";
    renderQueueShell();
    if (state.tasks.length === 0) {
      dom.taskList.append(emptyText("Queue is clear."));
      return;
    }

    const sorted = [...state.tasks].sort((a, b) => a.dueAt - b.dueAt);
    for (const task of sorted) {
      const row = document.createElement("div");
      row.className = "task-row";
      const label = document.createElement("div");
      const remaining = textEl("span", `${formatDuration(task.dueAt - state.clock)} remaining`);
      remaining.dataset.taskRemaining = task.id;
      const meta = document.createElement("div");
      meta.className = "task-meta";
      remaining.className = "task-chip";
      meta.append(taskChip(taskCategory(task)), taskChip(formatClock(task.dueAt)), remaining);
      label.append(textEl("strong", task.label), meta);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Finish";
      button.addEventListener("click", () => {
        if (task.dueAt > state.clock) {
          advanceTime(task.dueAt - state.clock);
        }
        persist();
        render();
      });
      row.append(label, button);
      dom.taskList.append(row);
    }
  }

  function renderQueueShell() {
    const sorted = [...state.tasks].sort((a, b) => a.dueAt - b.dueAt);
    const next = sorted[0] || null;
    dom.queueDrawer.classList.toggle("collapsed", !state.queueDrawerOpen);
    document.querySelector(".app-shell")?.classList.toggle("queue-open", state.queueDrawerOpen);
    dom.queueToggleBtn.setAttribute("aria-expanded", String(state.queueDrawerOpen));
    dom.queueBadge.textContent = String(state.tasks.length);
    dom.queueSummary.textContent = next
      ? `${state.tasks.length} pending; next ${next.label} in ${formatDuration(next.dueAt - state.clock)}`
      : "No pending work";
    dom.queueNextReadout.textContent = next
      ? `Next ${formatDuration(next.dueAt - state.clock)}`
      : "Clear";
  }

  function taskCategory(task) {
    if (task.type === "synthesize") {
      return "Scientist";
    }
    if (task.type === "test") {
      return "Lab Test";
    }
    if (task.type === "breed") {
      return "Breeding";
    }
    if (task.type === "mature") {
      return "Growth";
    }
    if (task.type === "rest") {
      return "Rest";
    }
    return "Task";
  }

  function taskChip(text) {
    const element = document.createElement("span");
    element.className = "task-chip";
    element.textContent = text;
    return element;
  }

  function renderJournal() {
    dom.journalContent.textContent = "";
    if (state.journalMode === "none") {
      dom.journalContent.append(emptyText("Journal disabled."));
      return;
    }

    if (state.journalMode === "auto") {
      renderAutoJournal();
      return;
    }

    renderManualJournal();
  }

  function renderAutoJournal() {
    const wrapper = document.createElement("div");
    wrapper.className = "journal-map";
    for (const region of DISPLAY_REGION_DEFS) {
      const discoveries = Object.values(state.discoveries[region.key] || {});
      const row = document.createElement("div");
      row.className = "journal-row";
      const label = traitLabelEl(region);
      label.append(textEl("span", `(${discoveries.length})`));
      const body = document.createElement("span");
      body.textContent = discoveries.length
        ? discoveries.map((item) => `${item.codes.map((code) => code.code).join("+")} = ${formatKnownOutcome(item)}`).join("; ")
        : "No entries";
      row.append(label, body);
      wrapper.append(row);
    }
    dom.journalContent.append(wrapper);
  }

  function renderManualJournal() {
    const tools = document.createElement("div");
    tools.className = "journal-tools";
    const selected = getSelectedSlime();

    const slimeBlock = noteBlock("Selected Slime Notes", selected ? selected.id : null, state.slimeNotes, selected ? `${selected.name} notes` : "No slime selected");
    tools.append(slimeBlock);

    const genomeKey = selected ? selected.genome : state.currentGenome;
    tools.append(noteBlock("Genome Notes", genomeKey, state.genomeNotes, "Genome notes"));

    const regionGrid = document.createElement("div");
    regionGrid.className = "region-note-grid";
    for (const region of DISPLAY_REGION_DEFS) {
      regionGrid.append(noteBlock(region.label, region.key, state.regionNotes, `${region.label} notes`));
    }
    tools.append(regionGrid);
    dom.journalContent.append(tools);
  }

  function noteBlock(title, key, store, placeholder) {
    const block = document.createElement("label");
    block.className = "note-block";
    block.append(textEl("span", title));
    const area = document.createElement("textarea");
    area.placeholder = placeholder;
    area.disabled = !key;
    area.value = key ? store[key] || "" : "";
    area.addEventListener("input", () => {
      if (!key) {
        return;
      }
      store[key] = area.value;
      persist();
    });
    block.append(area);
    return block;
  }

  function renderEvents() {
    dom.eventLog.textContent = "";
    const events = state.events.slice(-8).reverse();
    if (events.length === 0) {
      dom.eventLog.append(emptyText("No events."));
      return;
    }
    for (const event of events) {
      const row = document.createElement("div");
      row.className = "event-row";
      row.append(textEl("span", formatClock(event.time)), textEl("span", event.message));
      dom.eventLog.append(row);
    }
  }

  function renderKnownEditor() {
    if (state.journalMode !== "auto") {
      dom.applyKnownBtn.disabled = true;
      dom.knownEditor.classList.add("hidden");
      return;
    }
    dom.applyKnownBtn.disabled = false;
    const previousTrait = dom.knownTraitSelect.value;
    dom.knownTraitSelect.textContent = "";
    for (const region of DISPLAY_REGION_DEFS) {
      const option = document.createElement("option");
      option.value = region.key;
      option.textContent = region.label;
      dom.knownTraitSelect.append(option);
    }
    if (REGION_BY_KEY[previousTrait]) {
      dom.knownTraitSelect.value = previousTrait;
    }
    const traitKey = dom.knownTraitSelect.value || REGION_DEFS[0].key;
    const discoveries = Object.entries(state.discoveries[traitKey] || {});
    dom.knownOutcomeSelect.textContent = "";
    if (discoveries.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No discovered outcomes";
      dom.knownOutcomeSelect.append(option);
      return;
    }
    for (const [key, item] of discoveries) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${item.codes.map((code) => code.code).join("+")} = ${formatKnownOutcome(item)}`;
      dom.knownOutcomeSelect.append(option);
    }
  }

  function formatTraitValue(slime, traitKey, outcome) {
    const label = slime.revealed?.[traitKey];
    if (!label) {
      return "Unknown";
    }
    const reading = slime.measured?.[traitKey]
      ? preciseReading(traitKey, outcome)
      : estimatedReading(traitKey, outcome, slime.genome);
    return reading ? `${label} (${reading})` : label;
  }

  function formatKnownOutcome(item) {
    const reading = item.measurement || item.estimate;
    return reading ? `${item.label} (${reading})` : item.label;
  }

  function estimatedReading(traitKey, outcome, contextKey = "") {
    const meta = outcome.meta || {};
    const baseLabel = outcome.label.split(" / ")[0];
    const index = Number.isFinite(meta.index) ? meta.index : stringHash(`${traitKey}:${outcome.label}`) % 16;
    if (traitKey === "size") {
      return estimateQuantity(SIZE_VOLUME_CM3[baseLabel] || Math.round((meta.mass || 1) * 420), "volume", traitKey, contextKey);
    }
    if (traitKey === "color") {
      return `${estimatedColor(meta.color || "#000000", traitKey, contextKey)} swatch`;
    }
    if (traitKey === "texture") {
      return estimateQuantity(120 + index * index * 95, "viscosity", traitKey, contextKey);
    }
    if (traitKey === "behavior") {
      return estimateQuantity(0.4 + index * 0.33, "latency", traitKey, contextKey);
    }
    if (traitKey === "diet") {
      return estimateQuantity(30 + index * 17, "intake", traitKey, contextKey);
    }
    if (traitKey === "byproduct") {
      return estimateQuantity(0.4 + index * 0.42, "flow", traitKey, contextKey);
    }
    if (traitKey === "element") {
      return baseLabel === "none" ? "about 0 thaum flux" : estimateQuantity(12 + index * 7, "flux", traitKey, contextKey);
    }
    if (traitKey === "stability") {
      return estimateQuantity(meta.risk, "risk", traitKey, contextKey);
    }
    if (traitKey === "movement") {
      return estimateQuantity(0.8 + index * 0.55, "speed", traitKey, contextKey);
    }
    if (traitKey === "brood") {
      return estimateQuantity(meta.count, "count", traitKey, contextKey);
    }
    if (traitKey === "growth") {
      return estimateQuantity(meta.growthMinutes, "duration", traitKey, contextKey);
    }
    if (traitKey === "lifespan") {
      return estimateQuantity(meta.lifeMinutes, "duration", traitKey, contextKey);
    }
    return "";
  }

  function preciseReading(traitKey, outcome) {
    const meta = outcome.meta || {};
    const baseLabel = outcome.label.split(" / ")[0];
    const index = Number.isFinite(meta.index) ? meta.index : stringHash(`${traitKey}:${outcome.label}`) % 16;
    if (traitKey === "size") {
      return formatVolume(SIZE_VOLUME_CM3[baseLabel] || Math.round((meta.mass || 1) * 420));
    }
    if (traitKey === "color") {
      return `${String(meta.color || "#000000").toUpperCase()} swatch`;
    }
    if (traitKey === "texture") {
      return `${formatNumber(120 + index * index * 95)} cP viscosity`;
    }
    if (traitKey === "behavior") {
      return `${formatDecimal(0.4 + index * 0.33, 1)}s response latency`;
    }
    if (traitKey === "diet") {
      return `${formatIntake(30 + index * 17)} intake`;
    }
    if (traitKey === "byproduct") {
      return `${formatFlow(0.4 + index * 0.42)} yield`;
    }
    if (traitKey === "element") {
      return baseLabel === "none" ? "0 thaum flux" : `${formatNumber(12 + index * 7)} thaum flux`;
    }
    if (traitKey === "stability") {
      return `risk ${meta.risk}/10`;
    }
    if (traitKey === "movement") {
      return formatSpeed(0.8 + index * 0.55);
    }
    if (traitKey === "brood") {
      return `${meta.count} offspring/clutch`;
    }
    if (traitKey === "growth") {
      return `${formatDuration(meta.growthMinutes)} to maturity`;
    }
    if (traitKey === "lifespan") {
      return `${formatDuration(meta.lifeMinutes)} expected lifespan`;
    }
    return "";
  }

  function estimateQuantity(value, kind, traitKey, contextKey) {
    const [low, high] = estimateBounds(value, traitKey, contextKey);
    if (kind === "volume") {
      return formatVolumeRange(low, high, value);
    }
    if (kind === "intake") {
      return `${formatIntakeRange(low, high, value)} intake`;
    }
    if (kind === "flow") {
      return `${formatFlowRange(low, high, value)} yield`;
    }
    if (kind === "speed") {
      return formatSpeedRange(low, high, value);
    }
    if (kind === "duration") {
      return `${formatDuration(low)} - ${formatDuration(high)}`;
    }
    if (kind === "risk") {
      return `risk ${Math.max(1, Math.floor(low))} - ${Math.min(10, Math.ceil(high))}/10`;
    }
    if (kind === "count") {
      return `${Math.max(1, Math.floor(low))} - ${Math.max(1, Math.ceil(high))} offspring/clutch`;
    }
    if (kind === "latency") {
      return `${formatDecimal(low, 1)} - ${formatDecimal(high, 1)}s response latency`;
    }
    if (kind === "viscosity") {
      return `${formatNumber(low)} - ${formatNumber(high)} cP viscosity`;
    }
    if (kind === "flux") {
      return `${formatNumber(low)} - ${formatNumber(high)} thaum flux`;
    }
    return `${formatNumber(low)} - ${formatNumber(high)}`;
  }

  function estimateBounds(value, traitKey, contextKey) {
    const numericValue = Number(value) || 0;
    const level = skillLevel("observation");
    const spread = 0.8 - Math.min(0.68, level * 0.0068);
    const rng = seedRng(`${state?.seed || "seed"}:estimate:${level}:${traitKey}:${contextKey}`);
    const bias = (rng() - 0.5) * spread * 0.65;
    const center = Math.max(0, numericValue * (1 + bias));
    const low = Math.max(0, center * (1 - spread));
    const high = Math.max(low, center * (1 + spread));
    return [low, high];
  }

  function estimatedColor(hex, traitKey, contextKey) {
    const level = skillLevel("observation");
    const maxShift = Math.max(8, 60 - level * 0.52);
    const rng = seedRng(`${state?.seed || "seed"}:color-estimate:${level}:${traitKey}:${contextKey}`);
    const channels = parseHexColor(hex).map((channel) => {
      const shift = Math.round((rng() - 0.5) * 2 * maxShift);
      return clamp(channel + shift, 0, 255);
    });
    return `approx. #${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }

  function parseHexColor(hex) {
    const clean = String(hex).replace(/[^0-9a-f]/gi, "").padEnd(6, "0").slice(0, 6);
    return [0, 2, 4].map((start) => parseInt(clean.slice(start, start + 2), 16));
  }

  function formatVolume(valueCm3) {
    const unit = volumeUnit(valueCm3);
    return `${formatUnitNumber(valueCm3, unit)} ${unit.label}`;
  }

  function formatVolumeRange(lowCm3, highCm3, referenceCm3) {
    const unit = volumeUnit(Math.max(referenceCm3, highCm3));
    return `${formatUnitNumber(lowCm3, unit)} - ${formatUnitNumber(highCm3, unit)} ${unit.label}`;
  }

  function volumeUnit(valueCm3) {
    if (valueCm3 >= 1000000) {
      return { factor: 1000000, label: "m^3", digits: 1 };
    }
    if (valueCm3 >= 1000) {
      return { factor: 1000, label: "L", digits: valueCm3 < 10000 ? 1 : 0 };
    }
    return { factor: 1, label: "cm^3", digits: 0 };
  }

  function formatIntake(valueGPerDay) {
    const unit = valueGPerDay >= 1000
      ? { factor: 1000, label: "kg/day", digits: 2 }
      : { factor: 1, label: "g/day", digits: 0 };
    return `${formatUnitNumber(valueGPerDay, unit)} ${unit.label}`;
  }

  function formatIntakeRange(low, high, reference) {
    const unit = Math.max(high, reference) >= 1000
      ? { factor: 1000, label: "kg/day", digits: 2 }
      : { factor: 1, label: "g/day", digits: 0 };
    return `${formatUnitNumber(low, unit)} - ${formatUnitNumber(high, unit)} ${unit.label}`;
  }

  function formatFlow(valueMlPerHour) {
    const unit = valueMlPerHour >= 1000
      ? { factor: 1000, label: "L/h", digits: 2 }
      : { factor: 1, label: "mL/h", digits: 1 };
    return `${formatUnitNumber(valueMlPerHour, unit)} ${unit.label}`;
  }

  function formatFlowRange(low, high, reference) {
    const unit = Math.max(high, reference) >= 1000
      ? { factor: 1000, label: "L/h", digits: 2 }
      : { factor: 1, label: "mL/h", digits: 1 };
    return `${formatUnitNumber(low, unit)} - ${formatUnitNumber(high, unit)} ${unit.label}`;
  }

  function formatSpeed(valueCmPerSecond) {
    const unit = valueCmPerSecond >= 100
      ? { factor: 100, label: "m/s", digits: 2 }
      : { factor: 1, label: "cm/s", digits: 1 };
    return `${formatUnitNumber(valueCmPerSecond, unit)} ${unit.label}`;
  }

  function formatSpeedRange(low, high, reference) {
    const unit = Math.max(high, reference) >= 100
      ? { factor: 100, label: "m/s", digits: 2 }
      : { factor: 1, label: "cm/s", digits: 1 };
    return `${formatUnitNumber(low, unit)} - ${formatUnitNumber(high, unit)} ${unit.label}`;
  }

  function formatUnitNumber(value, unit) {
    const scaled = value / unit.factor;
    return scaled.toLocaleString("en-US", {
      minimumFractionDigits: unit.digits,
      maximumFractionDigits: unit.digits
    });
  }

  function cycleBasePair(index, complementSide = false) {
    const region = getRegionForIndex(index);
    if (region && isRegionLocked(region.key)) {
      addEvent(`${region.label} region is locked.`);
      persist();
      render();
      return;
    }
    const currentBase = state.currentGenome[index];
    const currentVisible = complementSide ? COMPLEMENT[currentBase] : currentBase;
    const nextVisible = BASES[(BASES.indexOf(currentVisible) + 1) % BASES.length];
    const nextBase = complementSide ? COMPLEMENT[nextVisible] : nextVisible;
    state.currentGenome = `${state.currentGenome.slice(0, index)}${nextBase}${state.currentGenome.slice(index + 1)}`;
    persist();
    render();
  }

  function mutateRegion(regionKey) {
    if (isRegionLocked(regionKey)) {
      addEvent(`${getRegionLabel(regionKey)} region is locked.`);
      persist();
      render();
      return;
    }
    const rng = seedRng(`${state.seed}:mutate:${regionKey}:${Date.now()}:${Math.random()}`);
    const current = getRegionCode(state.currentGenome, regionKey);
    const next = randomRegionCode(rng, current);
    state.currentGenome = replaceRegionCode(state.currentGenome, regionKey, next);
    addEvent(`${getRegionLabel(regionKey)} region mutated.`);
    persist();
    render();
  }

  function randomizeUnlockedRegions() {
    const rng = seedRng(`${state.seed}:unlocked:${Date.now()}:${Math.random()}`);
    let nextGenome = state.currentGenome;
    let changed = 0;
    for (const region of REGION_DEFS) {
      if (isRegionLocked(region.key)) {
        continue;
      }
      const current = getRegionCode(nextGenome, region.key);
      const next = randomRegionCode(rng, current);
      nextGenome = replaceRegionCode(nextGenome, region.key, next);
      if (next !== current) {
        changed += 1;
      }
    }
    state.currentGenome = nextGenome;
    return changed;
  }

  function preserveLockedRegions(candidateGenome, sourceGenome) {
    let nextGenome = candidateGenome;
    for (const region of REGION_DEFS) {
      if (isRegionLocked(region.key)) {
        nextGenome = replaceRegionCode(nextGenome, region.key, getRegionCode(sourceGenome, region.key));
      }
    }
    return nextGenome;
  }

  function randomRegionCode(rng, avoid = "") {
    let code = avoid;
    let guard = 0;
    while (code === avoid && guard < 20) {
      code = "";
      for (let i = 0; i < 2; i += 1) {
        code += BASES[Math.floor(rng() * BASES.length)];
      }
      guard += 1;
    }
    return code;
  }

  function getRegionForIndex(index) {
    return REGION_DEFS.find((region) => index >= region.start && index < region.start + region.length) || null;
  }

  function isRegionLocked(regionKey) {
    return Boolean(state.regionLocks?.[regionKey]);
  }

  function setRegionLock(regionKey, locked) {
    state.regionLocks ||= {};
    if (locked) {
      state.regionLocks[regionKey] = true;
      return;
    }
    delete state.regionLocks[regionKey];
  }

  function findSlime(id) {
    return state.slimes.find((slime) => slime.id === id) || null;
  }

  function getSelectedSlime() {
    return findSlime(state.selectedSlimeId);
  }

  function hasPendingTest(slimeId, testId) {
    return state.tasks.some((task) => task.type === "test" && task.data.slimeId === slimeId && task.data.testId === testId);
  }

  function containedSlimeCount() {
    return state.slimes.filter((slime) => slime.status === "contained").length;
  }

  function canAddContainedSlime() {
    return containedSlimeCount() + pendingSynthesisCount() < STORAGE_CAPACITY;
  }

  function pendingSynthesisCount() {
    return state.tasks.filter((task) => task.type === "synthesize").length;
  }

  function isBreedable(slime) {
    return slime.status !== "dead" && slime.mature;
  }

  function scientistSkill(skillId) {
    state.scientist ||= defaultScientist();
    state.scientist.skills ||= {};
    state.scientist.skills[skillId] ||= { xp: 0 };
    return state.scientist.skills[skillId];
  }

  function scientistVital(key) {
    state.scientist ||= defaultScientist();
    state.scientist.vitals ||= defaultScientist().vitals;
    state.scientist.vitals[key] ||= { current: DEFAULT_VITAL_MAX, max: DEFAULT_VITAL_MAX };
    return state.scientist.vitals[key];
  }

  function adjustedDuration(baseDuration, skillId) {
    return Math.max(1, Math.ceil(baseDuration * skillReductionMultiplier(skillLevel(skillId))));
  }

  function adjustedStaminaCost(baseCost, skillIds) {
    const bestLevel = Math.max(...skillIds.filter(Boolean).map((skillId) => skillLevel(skillId)), 0);
    return Math.max(1, Math.ceil(baseCost * skillReductionMultiplier(bestLevel)));
  }

  function skillReductionMultiplier(level) {
    return 1 - Math.min(0.5, Math.max(0, level) * 0.005);
  }

  function hasStamina(cost) {
    return scientistVital("stamina").current >= cost;
  }

  function spendStamina(cost) {
    const stamina = scientistVital("stamina");
    if (stamina.current < cost) {
      return false;
    }
    stamina.current = Math.max(0, stamina.current - cost);
    return true;
  }

  function restoreStamina(amount) {
    const stamina = scientistVital("stamina");
    stamina.current = Math.min(stamina.max, stamina.current + Math.max(0, Number(amount) || 0));
  }

  function recoverVitals(minutes) {
    const beforeStamina = Math.floor(scientistVital("stamina").current);
    const beforeMana = Math.floor(scientistVital("mana").current);
    const hasWork = state.tasks.some((task) => task.type === "rest" || task.data?.staminaCost > 0);
    if (!hasWork) {
      restoreStamina(minutes / STAMINA_REGEN_MINUTES);
    }
    const mana = scientistVital("mana");
    mana.current = Math.min(mana.max, mana.current + minutes / MANA_REGEN_MINUTES);
    return Math.floor(scientistVital("stamina").current) !== beforeStamina || Math.floor(mana.current) !== beforeMana;
  }

  function hasPendingRest() {
    return state.tasks.some((task) => task.type === "rest");
  }

  function addEvent(message) {
    if (!state) {
      return;
    }
    state.events.push({ time: state.clock, message });
    state.events = state.events.slice(-80);
  }

  function cleanGenome(value) {
    return String(value).toUpperCase().replace(/[^ACGT]/g, "").slice(0, GENOME_LENGTH);
  }

  function cleanSeed(value) {
    return String(value).trim().replace(/\s+/g, "-").slice(0, 40);
  }

  function makeSeed() {
    const array = new Uint32Array(2);
    window.crypto.getRandomValues(array);
    return `RG-${array[0].toString(36)}-${array[1].toString(36)}`.toUpperCase();
  }

  function randomGenome(rng) {
    let genome = "";
    for (let i = 0; i < GENOME_LENGTH; i += 1) {
      genome += BASES[Math.floor(rng() * BASES.length)];
    }
    return genome;
  }

  function crossoverGenome(genomeA, genomeB, rng) {
    let source = rng() < 0.5 ? genomeA : genomeB;
    let result = "";
    for (let i = 0; i < GENOME_LENGTH; i += 1) {
      if (i > 0 && rng() < 0.18) {
        source = source === genomeA ? genomeB : genomeA;
      }
      result += source[i];
    }
    return result;
  }

  function pairCodes() {
    const codes = [];
    for (const a of BASES) {
      for (const b of BASES) {
        codes.push(`${a}${b}`);
      }
    }
    return codes;
  }

  function shuffle(items, rng) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function seedRng(seed) {
    return mulberry32(stringHash(seed));
  }

  function stringHash(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function rng() {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatClock(totalMinutes) {
    const minutes = Math.max(0, Math.floor(totalMinutes));
    const day = Math.floor(minutes / 1440) + 1;
    const dayMinutes = minutes % 1440;
    const hours = Math.floor(dayMinutes / 60);
    const mins = dayMinutes % 60;
    return `Day ${day} ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  function formatDuration(minutes) {
    const safe = Math.max(0, Math.ceil(minutes));
    if (safe < 60) {
      return `${safe}m`;
    }
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  function formatDecimal(value, digits) {
    return Number(value).toFixed(digits);
  }

  function formatXp(value) {
    const safe = Number(value) || 0;
    return safe >= 10 ? formatNumber(safe) : formatDecimal(safe, 1);
  }

  function formatVital(vital) {
    return `${formatNumber(Math.floor(vital.current))}/${formatNumber(vital.max)}`;
  }

  function normalizeCommandName(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function journalModeName(mode) {
    if (mode === "manual") {
      return "Manual Template";
    }
    if (mode === "none") {
      return "None";
    }
    return "Automatic";
  }

  function getRegionLabel(key) {
    return REGION_BY_KEY[key]?.label || key;
  }

  function baseClass(base) {
    const normalized = String(base).toUpperCase();
    return BASES.includes(normalized) ? `base-${normalized.toLowerCase()}` : "";
  }

  function baseSequenceEl(sequence, className = "base-sequence") {
    const element = document.createElement("span");
    element.className = `${className} base-sequence`;
    for (const base of String(sequence)) {
      const letter = document.createElement("span");
      letter.className = `base-letter ${baseClass(base)}`;
      letter.textContent = base;
      element.append(letter);
    }
    return element;
  }

  function traitLabelEl(region, outcome = null) {
    const element = document.createElement("span");
    element.className = "trait-label";
    element.append(traitMarkerEl(region.key, outcome), textEl("span", region.label));
    return element;
  }

  function traitMarkerEl(traitKey, outcome = null) {
    const marker = document.createElement("span");
    marker.className = `trait-marker trait-marker-${traitKey}`;
    marker.setAttribute("aria-hidden", "true");

    if (traitKey === "color" && outcome?.meta?.color) {
      marker.classList.add("trait-swatch");
      marker.style.backgroundColor = outcome.meta.color;
      marker.title = `${getRegionLabel(traitKey)}: ${outcome.label}`;
      return marker;
    }

    const label = outcome?.label ? outcome.label.split(" / ")[0].toLowerCase() : "";
    marker.textContent = traitKey === "element" && outcome
      ? ELEMENT_SYMBOLS[label] || TRAIT_SYMBOLS.element
      : TRAIT_SYMBOLS[traitKey] || "•";
    marker.title = outcome?.label
      ? `${getRegionLabel(traitKey)}: ${outcome.label}`
      : getRegionLabel(traitKey);
    return marker;
  }

  function textEl(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }

  function chip(text) {
    const element = document.createElement("span");
    element.className = "slime-chip";
    element.textContent = text;
    return element;
  }

  function emptyText(text) {
    const element = document.createElement("p");
    element.className = "journal-meta";
    element.textContent = text;
    return element;
  }

  function syncSetupForm() {
    dom.seedInput.value = state.seed;
    dom.journalModeSelect.value = state.journalMode;
    dom.complexitySelect.value = state.complexity;
  }

  function savePayload() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      state
    };
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savePayload()));
    } catch (error) {
      console.warn("Save failed", error);
    }
  }

  function loadLocalSave() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return normalizeState(JSON.parse(raw).state);
    } catch (error) {
      console.warn("Load failed", error);
      return null;
    }
  }

  function normalizeState(candidate) {
    const next = { ...defaultState(), ...candidate };
    next.discoveries ||= {};
    next.regionNotes ||= {};
    next.genomeNotes ||= {};
    next.slimeNotes ||= {};
    next.regionLocks = normalizeRegionLocks(next.regionLocks);
    next.scientist = normalizeScientist(next.scientist);
    next.queueDrawerOpen = next.queueDrawerOpen !== false;
    next.knownResultKeys ||= {};
    next.resultRepeats ||= {};
    next.events ||= [];
    next.tasks ||= [];
    next.slimes ||= [];
    for (const slime of next.slimes) {
      slime.revealed ||= {};
      slime.measured ||= {};
      slime.testsRun ||= [];
    }
    next.currentGenome = cleanGenome(next.currentGenome || "") || randomGenome(seedRng(`${next.seed}:starter`));
    return next;
  }

  function normalizeRegionLocks(candidate) {
    const locks = {};
    for (const region of REGION_DEFS) {
      if (candidate?.[region.key]) {
        locks[region.key] = true;
      }
    }
    return locks;
  }

  function normalizeScientist(candidate) {
    const fallback = defaultScientist();
    const scientist = {
      vitals: { ...fallback.vitals, ...(candidate?.vitals || {}) },
      skills: { ...fallback.skills, ...(candidate?.skills || {}) }
    };
    for (const key of ["health", "stamina", "mana"]) {
      const vital = scientist.vitals[key] || fallback.vitals[key];
      const rawMax = Number(vital.max);
      const rawCurrent = Number(vital.current);
      const max = Math.max(1, Number.isFinite(rawMax) ? rawMax : DEFAULT_VITAL_MAX);
      scientist.vitals[key] = {
        max,
        current: clamp(Number.isFinite(rawCurrent) ? rawCurrent : max, 0, max)
      };
    }
    for (const skill of SKILL_DEFS) {
      scientist.skills[skill.id] = {
        xp: Math.max(0, Number(scientist.skills[skill.id]?.xp) || 0)
      };
    }
    return scientist;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function downloadSave() {
    const blob = new Blob([JSON.stringify(savePayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = SAVE_FILE_NAME;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    addEvent("Save file exported.");
    persist();
    render();
  }

  async function exportToFolder() {
    const data = JSON.stringify(savePayload(), null, 2);
    try {
      if (!window.showDirectoryPicker) {
        downloadSave();
        return;
      }
      const directory = await window.showDirectoryPicker({ mode: "readwrite" });
      const file = await directory.getFileHandle(SAVE_FILE_NAME, { create: true });
      const writable = await file.createWritable();
      await writable.write(data);
      await writable.close();
      addEvent("Save exported to selected folder.");
      persist();
      render();
    } catch (error) {
      if (error.name !== "AbortError") {
        addEvent("Folder export was not available.");
        persist();
        render();
      }
    }
  }

  function importSave(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const payload = JSON.parse(String(reader.result));
        state = normalizeState(payload.state || payload);
        geneMap = buildGeneMap(state.seed, state.complexity);
        addEvent("Save imported.");
        persist();
        render();
      } catch (error) {
        window.alert("Could not import that save file.");
      } finally {
        dom.importFileInput.value = "";
      }
    });
    reader.readAsText(file);
  }

  init();
})();
