(() => {
  "use strict";

  const STORAGE_KEY = "helix-heresy-v1-save";
  const SAVE_FILE_NAME = "helix-heresy-save.json";
  const BASES = ["A", "C", "G", "T"];
  const COMPLEMENT = { A: "T", T: "A", C: "G", G: "C" };
  const STORAGE_CAPACITY = 12;
  const SYNTHESIS_TUBE_ID = "synthesisTube";
  const SYNTHESIS_TUBE_GEOMETRY = {
    shape: "tube",
    internalCm: { diameter: 18, height: 35 },
    openingCm: { diameter: 12 },
    openTop: false
  };
  const WASTE_DRUM_CAPACITY = 8;
  const OVERFLOW_EVENT_INTERVAL = 360;
  const OVERFLOW_SUSPICION = 4;
  const SUSPICION_MAX = 100;
  const SUSPICION_DECAY_DELAY = 1440;
  const SUSPICION_DECAY_INTERVAL = 360;
  const SUSPICION_BANDS = [
    { id: "quiet", label: "Quiet", min: 0 },
    { id: "suspicious", label: "Suspicious", min: 20 },
    { id: "watched", label: "Watched", min: 40 },
    { id: "investigated", label: "Investigated", min: 60 },
    { id: "critical", label: "Critical", min: 80 }
  ];
  const DUMP_SUSPICION = {
    fresh: 6,
    decaying: 8,
    spoiled: 10,
    ruined: 7
  };
  const CONTAINMENT_INCIDENT_THRESHOLD = 240;
  const CONTAINMENT_INCIDENT_COOLDOWN = 360;
  const CONTAINMENT_INCIDENT_PROGRESS_DECAY_PER_HOUR = 20;
  const CONTAINER_CONDITION_DEFAULT = 100;
  const MAIN_ROOM_ID = "mainLab";
  const MENAGERIE_ROOM_ID = "menagerie";
  const PITS_ROOM_ID = "pits";
  const BEDROOM_ROOM_ID = "bedroom";
  const STORAGE_ROOM_ID = "storageRoom";
  const DOOR_STATE_OPEN = "open";
  const DOOR_STATE_CLOSED = "closed";
  const DOOR_POLICY_DEFS = [
    { id: "leaveAsSet", label: "Leave as set", description: "Movement opens doors as needed, then returns each door to its previous state." },
    { id: "leaveOpenAfterUse", label: "Leave open after use", description: "Movement opens doors as needed and leaves them open afterward." },
    { id: "closeAfterUse", label: "Close after use", description: "Movement closes doors after passing through, even if they were already open." }
  ];
  const DOOR_POLICY_BY_ID = Object.fromEntries(DOOR_POLICY_DEFS.map((policy) => [policy.id, policy]));
  const DEFAULT_DOOR_POLICY_ID = "leaveAsSet";
  const ROOM_BASE_DEFS = [
    {
      id: MAIN_ROOM_ID,
      name: "Main Lab",
      articleName: "the Main Lab",
      role: "mainLab",
      roleLabel: "Active lab",
      description: "Synthesis, testing, and day-to-day lab work.",
      geometry: {
        shape: "rectangular",
        lengthM: 12,
        widthM: 10,
        heightM: 3,
        floorAreaM2: 120,
        volumeM3: 360
      },
      connections: [MENAGERIE_ROOM_ID, PITS_ROOM_ID, BEDROOM_ROOM_ID, STORAGE_ROOM_ID],
      attributes: {}
    },
    {
      id: MENAGERIE_ROOM_ID,
      name: "Menagerie",
      articleName: "the Menagerie",
      role: "livingStorage",
      roleLabel: "Living specimen storage",
      description: "Shelved containers and quiet observation. Stored creatures here cannot work jobs.",
      geometry: {
        shape: "rectangular",
        lengthM: 14,
        widthM: 8,
        heightM: 3,
        floorAreaM2: 112,
        volumeM3: 336
      },
      connections: [MAIN_ROOM_ID],
      attributes: {
        light: { current: 42, baseline: 42 },
        ambientMana: { current: 48, baseline: 48 },
        contamination: { current: 8, baseline: 8 },
        electricalCharge: { current: 12, baseline: 12 }
      }
    },
    {
      id: PITS_ROOM_ID,
      name: "Pits",
      articleName: "the Pits",
      role: "corpseProcessing",
      roleLabel: "Corpse storage and processing",
      description: "Deep crude pits for remains, decay, disposal, and corpse work.",
      geometry: {
        shape: "irregular pit chamber",
        lengthM: 11,
        widthM: 8,
        heightM: 4,
        floorAreaM2: 76,
        volumeM3: 340,
        notes: "uneven floor and excavated voids"
      },
      connections: [MAIN_ROOM_ID],
      attributes: {
        temperature: { current: 45, baseline: 45 },
        light: { current: 18, baseline: 18 },
        moisture: { current: 68, baseline: 68 },
        contamination: { current: 28, baseline: 28, recoveryPerHour: 0.35 }
      }
    },
    {
      id: BEDROOM_ROOM_ID,
      name: "Bedroom",
      articleName: "the Bedroom",
      role: "restRecovery",
      roleLabel: "Rest and recovery",
      description: "A small private room for sleep, recovery, and keeping the scientist away from the worst lab air.",
      geometry: {
        shape: "rectangular",
        lengthM: 5,
        widthM: 4,
        heightM: 3,
        floorAreaM2: 20,
        volumeM3: 60
      },
      connections: [MAIN_ROOM_ID],
      attributes: {
        temperature: { current: 50, baseline: 50 },
        light: { current: 35, baseline: 35 },
        ambientMana: { current: 35, baseline: 35 },
        moisture: { current: 45, baseline: 45 },
        contamination: { current: 2, baseline: 2, recoveryPerHour: 1.1 },
        electricalCharge: { current: 5, baseline: 5 }
      }
    },
    {
      id: STORAGE_ROOM_ID,
      name: "Storage Room",
      articleName: "the Storage Room",
      role: "materialStorage",
      roleLabel: "Materials storage",
      description: "A controlled supply room for jars, trays, raw materials, and anything too useful to leave in the working lab.",
      geometry: {
        shape: "rectangular",
        lengthM: 7,
        widthM: 5,
        heightM: 3,
        floorAreaM2: 35,
        volumeM3: 105
      },
      connections: [MAIN_ROOM_ID],
      attributes: {
        temperature: { current: 48, baseline: 48 },
        light: { current: 28, baseline: 28 },
        ambientMana: { current: 32, baseline: 32 },
        moisture: { current: 42, baseline: 42 },
        contamination: { current: 4, baseline: 4, recoveryPerHour: 0.9 },
        electricalCharge: { current: 6, baseline: 6 }
      }
    }
  ];
  const ROOM_SPATIAL_FEEL_BANDS = [
    { maxFloorAreaM2: 45, label: "Cramped" },
    { maxFloorAreaM2: 80, label: "Confined" },
    { maxFloorAreaM2: 130, label: "Serviceable" },
    { maxFloorAreaM2: 220, label: "Comfortable" },
    { maxFloorAreaM2: 400, label: "Expansive" },
    { maxFloorAreaM2: Infinity, label: "Cavernous" }
  ];
  const ROOM_CROWDING_BANDS = [
    { maxRatio: 0.15, label: "Clear" },
    { maxRatio: 0.30, label: "Lightly occupied" },
    { maxRatio: 0.50, label: "Busy" },
    { maxRatio: 0.75, label: "Crowded" },
    { maxRatio: Infinity, label: "Overpacked" }
  ];
  const ROOM_CONTAINER_FLOOR_LOAD_M2 = {
    synthesisTube: 4,
    openDirtPit: 5,
    gratedDirtPit: 5,
    cappedDirtPit: 5,
    default: 2
  };
  const ROOM_FREE_CREATURE_FLOOR_LOAD_M2 = 2;
  const ROOM_CORPSE_FLOOR_LOAD_M2 = 0.75;
  const ROOM_EFFECT_REFERENCE_FLOOR_AREA_M2 = 100;
  const ROOM_EFFECT_REFERENCE_VOLUME_M3 = 300;
  const SCIENTIST_DEFAULT_PHYSICAL_PRESENCE = {
    heightM: 1.75,
    shoulderWidthM: 0.55,
    floorLoadM2: 1.0
  };
  const SCIENTIST_MOVE_BASE_DURATION = 6;
  const SCIENTIST_MOVE_BASE_STAMINA = 2;
  const PHYSICAL_STATE_MAX = 100;
  const PHYSICAL_STATE_EXPOSURE_RISE_PER_HOUR = 10;
  const PHYSICAL_STATE_EXPOSURE_DECAY_PER_HOUR = 3;
  const PHYSICAL_STATE_REST_RECOVERY_MULTIPLIER = 3;
  const PHYSICAL_STATE_EVENT_INTERVAL = 60;
  const PHYSICAL_STATE_BANDS = [
    { max: 5, label: "Steady" },
    { max: 20, label: "Uneasy" },
    { max: 40, label: "Queasy" },
    { max: 65, label: "Sickened" },
    { max: 85, label: "Toxic" },
    { max: Infinity, label: "Failing" }
  ];
  const DIAGNOSTIC_CONFIDENCE_BANDS = [
    { max: 20, label: "uncertain" },
    { max: 35, label: "rough" },
    { max: 50, label: "fair" },
    { max: 70, label: "strong" },
    { max: Infinity, label: "high" }
  ];
  const PHYSICAL_DIAGNOSTIC_TESTS = [
    { id: "selfCheck", label: "Self-check", resultLabel: "Latest test", quality: 12, duration: 4, staminaCost: 1, skillIds: ["observation", "physiology"] },
    { id: "basicAssay", label: "Basic assay", resultLabel: "Latest test", quality: 38, duration: 12, staminaCost: 4, skillIds: ["arcaneChemistry", "physiology", "observation"], exactConfidence: 70 }
  ];
  const PHYSICAL_DIAGNOSTIC_TEST_BY_ID = Object.fromEntries(PHYSICAL_DIAGNOSTIC_TESTS.map((test) => [test.id, test]));
  const ROOM_EXPOSURE_BANDS = [
    { max: 8, label: "Clear", effect: "Physical State may recover here" },
    { max: 25, label: "Stale", effect: "Physical State may hold steady or recover slowly" },
    { max: 45, label: "Tainted", effect: "Physical State may worsen slowly" },
    { max: 65, label: "Fouled", effect: "Physical State may worsen steadily" },
    { max: 85, label: "Hazardous", effect: "Physical State may worsen quickly" },
    { max: Infinity, label: "Unlivable", effect: "Physical State may fail rapidly" }
  ];
  const ROOM_OBSERVATION_RELIABILITY_BANDS = [
    { min: 80, label: "High" },
    { min: 58, label: "Fair" },
    { min: 32, label: "Uncertain" },
    { min: 1, label: "Poor" },
    { min: -Infinity, label: "Unknown" }
  ];
  const TOOLTIP_DEFS = {
    steady: { body: "Steady: no Physical State stamina strain." },
    uneasy: { body: "Uneasy: something feels off, but actions are not strained yet." },
    queasy: { body: "Queasy: physical actions cost slightly more stamina." },
    sickened: { body: "Sickened: physical actions cost more stamina. Rest in a cleaner room is recommended." },
    toxic: { body: "Toxic: physical actions cost much more stamina. Risky physical actions require confirmation, and Health may suffer over time." },
    failing: { body: "Failing: risky direct containment work is blocked. Rest, move, or run diagnostics first." },
    clear: { body: "Clear: this room supports Physical State recovery." },
    stale: { body: "Stale: Physical State may hold steady or recover slowly." },
    tainted: { body: "Tainted: Physical State may worsen slowly." },
    fouled: { body: "Fouled: Physical State may worsen steadily." },
    hazardous: { body: "Hazardous: Physical State may worsen quickly." },
    unlivable: { body: "Unlivable: Physical State may fail rapidly." },
    high: { body: "High reliability: current or very dependable information." },
    fair: { body: "Fair reliability: useful, but conditions may have changed." },
    uncertain: { body: "Uncertain reliability: treat the information cautiously." },
    poor: { body: "Poor reliability: old or unstable information; expect surprises." },
    unknown: { body: "Unknown reliability: no usable observation." },
    good: { body: "Good rest quality: cleaner air and low room exposure should help Physical State recover." },
    poor: { body: "Poor rest quality: the room may slow recovery or allow Physical State to worsen." },
    unsafe: { body: "Unsafe rest quality: Physical State may continue worsening. Confirm before resting here." }
  };
  const ROOM_BASE_DEF_BY_ID = Object.fromEntries(ROOM_BASE_DEFS.map((room) => [room.id, room]));
  const CONTAINER_HAUL_BASE_DURATION = 20;
  const CONTAINER_HAUL_WITH_CONTENTS_DURATION = 35;
  // Pits hauling now moves only the container. Contents must be moved by direct interaction.
  const CONTAINER_INTERACTION_OPEN_DURATION = 8;
  const CONTAINER_INTERACTION_CLOSE_DURATION = 5;
  const CONTAINER_INTERACTION_OPEN_STAMINA = 5;
  const CONTAINER_INTERACTION_CLOSE_STAMINA = 2;
  const HANDLING_METHOD_DEFS = [
    {
      id: "bareHands",
      label: "Bare hands",
      description: "Fastest, but offers no protection.",
      protectionText: "no protection"
    },
    {
      id: "thickGloves",
      label: "Thick gloves",
      description: "Reduces contact, contamination, and corpse-handling danger.",
      protectionText: "reduced contact and contamination risk"
    },
    {
      id: "longTongs",
      label: "Long tongs",
      description: "Adds distance from bites, strikes, and contact hazards.",
      protectionText: "distance from contact and strikes"
    },
    {
      id: "hookPole",
      label: "Hook pole",
      description: "Useful for pit covers, grates, and awkward reach.",
      protectionText: "safer reach for pit covers and grates"
    },
    {
      id: "scraper",
      label: "Scraper",
      description: "Best for stuck, spoiled, ruined, or residue-like remains.",
      protectionText: "better control when removing corpse residue"
    }
  ];
  const HANDLING_METHOD_BY_ID = Object.fromEntries(HANDLING_METHOD_DEFS.map((method) => [method.id, method]));
  const DEFAULT_HANDLING_METHOD = "bareHands";
  const REMAINS_DUMP_DURATION = 10;
  const REMAINS_SCRAPE_DURATION = 16;
  const REMAINS_DUMP_STAMINA = 6;
  const REMAINS_SCRAPE_STAMINA = 9;
  const LIVE_TRANSFER_DURATION = 14;
  const LIVE_TRANSFER_STAMINA = 8;
  const OUT_OF_CONTAINER_CONTAMINATION_FLOOR = 8;
  const OUT_OF_CONTAINER_CONTAMINATION_MOVE_THRESHOLD = 4;
  const OUT_OF_CONTAINER_CONTAMINATION_CLEAN_PER_HOUR = 10;
  const OUT_OF_CONTAINER_RESIDUE_PER_HOUR = 6;
  const OUT_OF_CONTAINER_EVENT_INTERVAL = 60;
  const FREE_CREATURE_PRESSURE_HIGH_SKILL = 4;
  const CONTAINER_ENVIRONMENT_EXCHANGE_PER_HOUR = 1;
  const PIT_HOLE_TYPE_IDS = ["openDirtPit", "gratedDirtPit", "cappedDirtPit"];
  const CORPSE_HANDLING_DESTINATIONS = [
    { id: "drum", label: "Waste drums" },
    { id: "pitHole", label: "Pit holes" }
  ];
  const CORPSE_HANDLING_DESTINATION_BY_ID = Object.fromEntries(CORPSE_HANDLING_DESTINATIONS.map((destination) => [destination.id, destination]));
  const ROOM_ATTRIBUTE_DEFS = [
    {
      key: "temperature",
      label: "Temperature",
      initial: 50,
      baseline: 50,
      recoveryPerHour: 2,
      bands: [
        { min: 0, label: "Freezing" },
        { min: 20, label: "Cold" },
        { min: 40, label: "Cool" },
        { min: 45, label: "Normal" },
        { min: 65, label: "Warm" },
        { min: 82, label: "Hot" }
      ]
    },
    {
      key: "light",
      label: "Light",
      initial: 60,
      baseline: 60,
      recoveryPerHour: 2,
      bands: [
        { min: 0, label: "Dark" },
        { min: 20, label: "Dim" },
        { min: 45, label: "Lit" },
        { min: 75, label: "Bright" }
      ]
    },
    {
      key: "ambientMana",
      label: "Ambient Mana",
      initial: 50,
      baseline: 50,
      recoveryPerHour: 1,
      bands: [
        { min: 0, label: "Depleted" },
        { min: 25, label: "Thin" },
        { min: 45, label: "Normal" },
        { min: 70, label: "Rich" },
        { min: 88, label: "Saturated" }
      ]
    },
    {
      key: "moisture",
      label: "Moisture",
      initial: 50,
      baseline: 50,
      recoveryPerHour: 1.5,
      bands: [
        { min: 0, label: "Parched" },
        { min: 25, label: "Dry" },
        { min: 42, label: "Normal" },
        { min: 68, label: "Damp" },
        { min: 86, label: "Wet" }
      ]
    },
    {
      key: "contamination",
      label: "Contamination",
      initial: 10,
      baseline: 10,
      recoveryPerHour: 0.75,
      bands: [
        { min: 0, label: "Clean" },
        { min: 8, label: "Low" },
        { min: 30, label: "Tainted" },
        { min: 55, label: "Fouled" },
        { min: 78, label: "Hazardous" }
      ]
    },
    {
      key: "electricalCharge",
      label: "Electrical Charge",
      initial: 15,
      baseline: 15,
      recoveryPerHour: 1,
      bands: [
        { min: 0, label: "Dormant" },
        { min: 12, label: "Stable" },
        { min: 40, label: "Charged" },
        { min: 70, label: "Arcing" }
      ]
    }
  ];
  const ROOM_ATTRIBUTE_BY_KEY = Object.fromEntries(ROOM_ATTRIBUTE_DEFS.map((attribute) => [attribute.key, attribute]));
  const ROOM_ATTRIBUTE_ALIASES = {
    temperature: "temperature",
    temp: "temperature",
    light: "light",
    mana: "ambientMana",
    ambientmana: "ambientMana",
    ambient: "ambientMana",
    moisture: "moisture",
    humidity: "moisture",
    contamination: "contamination",
    cleanliness: "contamination",
    charge: "electricalCharge",
    electricity: "electricalCharge",
    electrical: "electricalCharge",
    electricalcharge: "electricalCharge"
  };
  const CONTAINER_BASE_TYPE_DEFS = [
    {
      id: "basicGlassJar",
      label: "Basic Glass Jar",
      geometry: {
        shape: "cylinder",
        internalCm: { diameter: 10, height: 12 },
        openingCm: { diameter: 7 },
        openTop: false
      },
      capacityCm3: 900,
      maxWeightKg: 6,
      visibility: "high",
      seal: 35,
      gap: 10,
      durability: 25,
      comfort: 40,
      resistances: { acid: 20, flame: 30, frost: 25, storm: 15, poison: 30, mana: 20 },
      environmentExchange: {
        temperature: 0.5,
        light: 1,
        ambientMana: 0.75,
        moisture: 0.5,
        contamination: 0.5,
        electricalCharge: 0.25
      },
      notes: ["High visibility", "Fragile", "Poor seal"]
    },
    {
      id: "sealedGlassTank",
      label: "Sealed Glass Tank",
      geometry: {
        shape: "box",
        internalCm: { length: 40, width: 25, height: 12 },
        openingCm: { width: 35, height: 20 },
        openTop: false
      },
      capacityCm3: 12000,
      maxWeightKg: 35,
      visibility: "high",
      seal: 85,
      gap: 0,
      durability: 35,
      comfort: 50,
      resistances: { acid: 25, flame: 35, frost: 30, storm: 20, poison: 65, mana: 25 },
      environmentExchange: {
        temperature: 0.35,
        light: 1,
        ambientMana: 0.5,
        moisture: 0.2,
        contamination: 0.2,
        electricalCharge: 0.2
      },
      notes: ["High visibility", "Good seal", "Still fragile"]
    },
    {
      id: "reinforcedTank",
      label: "Reinforced Tank",
      geometry: {
        shape: "box",
        internalCm: { length: 80, width: 50, height: 40 },
        openingCm: { width: 60, height: 35 },
        openTop: false
      },
      capacityCm3: 160000,
      maxWeightKg: 450,
      visibility: "medium",
      seal: 75,
      gap: 0,
      durability: 80,
      comfort: 55,
      resistances: { acid: 45, flame: 65, frost: 55, storm: 45, poison: 55, mana: 35 },
      environmentExchange: {
        temperature: 0.35,
        light: 0.5,
        ambientMana: 0.4,
        moisture: 0.25,
        contamination: 0.25,
        electricalCharge: 0.35
      },
      notes: ["Strong frame", "Moderate visibility", "General-purpose containment"]
    },
    {
      id: "ironCage",
      label: "Iron Cage",
      geometry: {
        shape: "cage",
        internalCm: { length: 100, width: 80, height: 78 },
        openingCm: { width: 70, height: 60 },
        openTop: false
      },
      capacityCm3: 620000,
      maxWeightKg: 800,
      visibility: "medium",
      seal: 5,
      gap: 90,
      durability: 85,
      comfort: 35,
      resistances: { acid: 15, flame: 75, frost: 65, storm: 15, poison: 10, mana: 20 },
      environmentExchange: {
        temperature: 1,
        light: 1,
        ambientMana: 1,
        moisture: 1,
        contamination: 1,
        electricalCharge: 1
      },
      notes: ["High strength", "Large gaps", "Conductive"]
    },
    {
      id: "ceramicVessel",
      label: "Ceramic Vessel",
      geometry: {
        shape: "cylinder",
        internalCm: { diameter: 24, height: 40 },
        openingCm: { diameter: 16 },
        openTop: false
      },
      capacityCm3: 18000,
      maxWeightKg: 80,
      visibility: "low",
      seal: 70,
      gap: 0,
      durability: 50,
      comfort: 45,
      resistances: { acid: 75, flame: 85, frost: 35, storm: 55, poison: 60, mana: 35 },
      environmentExchange: {
        temperature: 0.25,
        light: 0,
        ambientMana: 0.35,
        moisture: 0.25,
        contamination: 0.25,
        electricalCharge: 0.1
      },
      notes: ["Opaque", "Good corrosion resistance", "Brittle"]
    },
    {
      id: "stoneBasin",
      label: "Stone Basin",
      geometry: {
        shape: "basin",
        internalCm: { length: 100, width: 80, height: 45 },
        openingCm: { width: 100, height: 80 },
        openTop: true
      },
      capacityCm3: 360000,
      maxWeightKg: 1200,
      visibility: "low",
      seal: 40,
      gap: 0,
      durability: 85,
      comfort: 40,
      resistances: { acid: 70, flame: 90, frost: 75, storm: 45, poison: 45, mana: 30 },
      environmentExchange: {
        temperature: 0.75,
        light: 0.75,
        ambientMana: 0.75,
        moisture: 0.75,
        contamination: 0.75,
        electricalCharge: 0.4
      },
      notes: ["Very heavy", "Open top", "Handles weight well"]
    },
    {
      id: "openTray",
      label: "Open Tray",
      geometry: {
        shape: "tray",
        internalCm: { length: 100, width: 80, height: 20 },
        openingCm: { width: 100, height: 80 },
        openTop: true
      },
      capacityCm3: 160000,
      maxWeightKg: 220,
      visibility: "high",
      seal: 0,
      gap: 100,
      durability: 35,
      comfort: 30,
      resistances: { acid: 35, flame: 35, frost: 35, storm: 25, poison: 10, mana: 15 },
      environmentExchange: {
        temperature: 1,
        light: 1,
        ambientMana: 1,
        moisture: 1,
        contamination: 1,
        electricalCharge: 1
      },
      notes: ["Excellent access", "No real seal", "Testing only"]
    },
    {
      id: "softLinedBox",
      label: "Soft-Lined Containment Box",
      geometry: {
        shape: "box",
        internalCm: { length: 40, width: 30, height: 20 },
        openingCm: { width: 35, height: 25 },
        openTop: false
      },
      capacityCm3: 24000,
      maxWeightKg: 45,
      visibility: "low",
      seal: 55,
      gap: 0,
      durability: 45,
      comfort: 90,
      resistances: { acid: 25, flame: 20, frost: 60, storm: 25, poison: 45, mana: 30 },
      environmentExchange: {
        temperature: 0.3,
        light: 0,
        ambientMana: 0.35,
        moisture: 0.25,
        contamination: 0.3,
        electricalCharge: 0.15
      },
      notes: ["Soft-lined", "Good for brittle bodies", "Low visibility"]
    },
    {
      id: "sealedDrainageTank",
      label: "Sealed Drainage Tank",
      geometry: {
        shape: "cylinder",
        internalCm: { diameter: 50, height: 82 },
        openingCm: { diameter: 35 },
        openTop: false
      },
      capacityCm3: 160000,
      maxWeightKg: 300,
      visibility: "low",
      seal: 90,
      gap: 0,
      durability: 70,
      comfort: 50,
      drainage: true,
      resistances: { acid: 65, flame: 45, frost: 45, storm: 35, poison: 75, mana: 30 },
      environmentExchange: {
        temperature: 0.25,
        light: 0,
        ambientMana: 0.3,
        moisture: 0.15,
        contamination: 0.15,
        electricalCharge: 0.2
      },
      notes: ["Drainage ports", "Excellent seal", "Low visibility"]
    },
    {
      id: "openDirtPit",
      label: "Open Dirt Pit",
      geometry: {
        shape: "pit",
        internalCm: { diameter: 120, height: 220 },
        openingCm: { diameter: 120 },
        openTop: true
      },
      capacityCm3: 2488000,
      maxWeightKg: 5000,
      visibility: "low",
      seal: 0,
      gap: 100,
      durability: 25,
      comfort: 5,
      drainage: true,
      pitHole: true,
      coverType: "none",
      corpseCapacity: 8,
      resistances: { acid: 40, flame: 80, frost: 70, storm: 20, poison: 55, mana: 20 },
      environmentExchange: {
        temperature: 1,
        light: 1,
        ambientMana: 1,
        moisture: 1,
        contamination: 1,
        electricalCharge: 0.8
      },
      notes: ["Literal dirt hole", "No cover", "Best access, worst containment"]
    },
    {
      id: "gratedDirtPit",
      label: "Grated Dirt Pit",
      geometry: {
        shape: "pit",
        internalCm: { diameter: 120, height: 220 },
        openingCm: { diameter: 110 },
        openTop: false
      },
      capacityCm3: 2488000,
      maxWeightKg: 5000,
      visibility: "low",
      seal: 15,
      gap: 45,
      durability: 50,
      comfort: 5,
      drainage: true,
      pitHole: true,
      coverType: "grate",
      corpseCapacity: 7,
      resistances: { acid: 45, flame: 85, frost: 70, storm: 35, poison: 55, mana: 25 },
      environmentExchange: {
        temperature: 0.85,
        light: 0.7,
        ambientMana: 0.85,
        moisture: 0.9,
        contamination: 0.9,
        electricalCharge: 0.65
      },
      notes: ["Literal dirt hole", "Metal grate", "Balanced access and containment"]
    },
    {
      id: "cappedDirtPit",
      label: "Capped Dirt Pit",
      geometry: {
        shape: "pit",
        internalCm: { diameter: 120, height: 220 },
        openingCm: { diameter: 80 },
        openTop: false
      },
      capacityCm3: 2488000,
      maxWeightKg: 5000,
      visibility: "none",
      seal: 55,
      gap: 4,
      durability: 70,
      comfort: 3,
      drainage: true,
      pitHole: true,
      coverType: "cap",
      corpseCapacity: 6,
      resistances: { acid: 50, flame: 90, frost: 75, storm: 45, poison: 65, mana: 30 },
      environmentExchange: {
        temperature: 0.35,
        light: 0,
        ambientMana: 0.35,
        moisture: 0.45,
        contamination: 0.4,
        electricalCharge: 0.25
      },
      notes: ["Literal dirt hole", "Heavy cap", "Hardest to access, best early containment"]
    },
    {
      id: "containmentPod",
      label: "Containment Pod",
      geometry: {
        shape: "pod",
        internalCm: { diameter: 80, height: 123 },
        openingCm: { width: 60, height: 50 },
        openTop: false
      },
      capacityCm3: 620000,
      maxWeightKg: 900,
      visibility: "medium",
      seal: 85,
      gap: 0,
      durability: 90,
      comfort: 70,
      resistances: { acid: 55, flame: 55, frost: 55, storm: 55, poison: 55, mana: 55 },
      environmentExchange: {
        temperature: 0.2,
        light: 0.35,
        ambientMana: 0.2,
        moisture: 0.2,
        contamination: 0.15,
        electricalCharge: 0.2
      },
      notes: ["Purpose-built", "Ward-ready", "Strong baseline"]
    }
  ];
  const CONTAINER_BASE_TYPE_BY_ID = Object.fromEntries(CONTAINER_BASE_TYPE_DEFS.map((type) => [type.id, type]));
  const CONTAINER_BASE_TYPE_ALIASES = Object.fromEntries(CONTAINER_BASE_TYPE_DEFS.flatMap((type) => [
    [normalizeCommandName(type.id), type.id],
    [normalizeCommandName(type.label), type.id]
  ]));
  const CONTAINER_WARD_DEFS = [
    { id: "acidAbsorbing", label: "Acid-Absorbing Ward", protects: ["acid"], notes: ["Absorbs acid exposure"] },
    { id: "flameDampening", label: "Flame-Dampening Ward", protects: ["flame", "heat"], notes: ["Dampens flame and heat"] },
    { id: "frostStabilizing", label: "Frost-Stabilizing Ward", protects: ["frost", "cold"], notes: ["Buffers frost shock"] },
    { id: "stormGrounding", label: "Storm-Grounding Ward", protects: ["storm", "electric"], notes: ["Grounds storm charge"] },
    { id: "poisonSealing", label: "Poison-Sealing Ward", protects: ["poison", "toxic", "fume"], notes: ["Seals toxic traces"] },
    { id: "manaInsulating", label: "Mana-Insulating Ward", protects: ["mana", "arcane", "dream", "ether"], notes: ["Insulates arcane seepage"] },
    { id: "sealTightening", label: "Seal-Tightening Ward", protects: ["leak"], notes: ["Improves physical sealing"] },
    { id: "loadBearing", label: "Load-Bearing Ward", protects: ["weight", "gravity"], notes: ["Reinforces against heavy bodies"] }
  ];
  const CONTAINER_WARD_BY_ID = Object.fromEntries(CONTAINER_WARD_DEFS.map((ward) => [ward.id, ward]));
  const CONTAINER_WARD_ALIASES = Object.fromEntries(CONTAINER_WARD_DEFS.flatMap((ward) => [
    [normalizeCommandName(ward.id), ward.id],
    [normalizeCommandName(ward.label), ward.id],
    ...ward.protects.map((tag) => [normalizeCommandName(tag), ward.id])
  ]));
  const STARTER_CONTAINER_LOADOUT = [
    { typeId: "basicGlassJar" },
    { typeId: "sealedGlassTank" },
    { typeId: "reinforcedTank" },
    { typeId: "ironCage" },
    { typeId: "ceramicVessel" },
    { typeId: "stoneBasin" },
    { typeId: "openTray" },
    { typeId: "softLinedBox" },
    { typeId: "sealedDrainageTank" },
    { typeId: "openDirtPit", name: "Open Dirt Pit 1", roomId: PITS_ROOM_ID },
    { typeId: "gratedDirtPit", name: "Grated Dirt Pit 1", roomId: PITS_ROOM_ID },
    { typeId: "cappedDirtPit", name: "Capped Dirt Pit 1", roomId: PITS_ROOM_ID },
    { typeId: "containmentPod", wardIds: ["acidAbsorbing"] },
    { typeId: "basicGlassJar", wardIds: ["flameDampening"] },
    { typeId: "ceramicVessel", wardIds: ["frostStabilizing"] },
    { typeId: "ironCage", wardIds: ["stormGrounding"] },
    { typeId: "sealedGlassTank", wardIds: ["poisonSealing"] },
    { typeId: "reinforcedTank", wardIds: ["manaInsulating"] },
    { typeId: "containmentPod", wardIds: ["sealTightening", "loadBearing"] }
  ];
  const REAL_TICK_MS = 250;
  const DEFAULT_TIME_SPEED = "normal";
  const TIME_SPEEDS = [
    { id: "realtime", label: "1x", description: "real-time", minutesPerSecond: 1 / 60 },
    { id: "normal", label: "60x", description: "1 min/sec", minutesPerSecond: 1 },
    { id: "fast", label: "300x", description: "5 min/sec", minutesPerSecond: 5 },
    { id: "very-fast", label: "1800x", description: "30 min/sec", minutesPerSecond: 30 },
    { id: "hourly", label: "3600x", description: "1 hr/sec", minutesPerSecond: 60 }
  ];
  const MAX_SKILL_LEVEL = 100;
  const STAMINA_REGEN_MINUTES = 10;
  const MANA_REGEN_MINUTES = 10;
  const NEW_DISCOVERY_XP = 25;
  const DEFAULT_VITAL_MAX = 100;
  const BASE_ACTION_STAMINA = 10;
  const HANDLING_STAMINA = 3;
  const ELEMENT_AFFINITY_MAX_INDEX = 15;
  const DISPLAY_REGION_KEYS = [
    "size",
    "shape",
    "consistency",
    "appendages",
    "color",
    "behavior",
    "sustenance",
    "byproduct",
    "element",
    "stability",
    "brood",
    "growth",
    "lifespan"
  ];
  const TRAIT_SYMBOLS = {
    size: "□",
    shape: "#",
    appendages: "+",
    consistency: "~",
    weight: "w",
    color: "■",
    movement: "→",
    behavior: "!",
    sustenance: "◒",
    byproduct: "◆",
    element: "✦",
    stability: "◇",
    brood: "×",
    growth: "↑",
    lifespan: "⌛"
  };
  const COLOR_FAMILY_SWATCHES = {
    black: "#111111",
    white: "#F2F0E8",
    gray: "#888888",
    clear: "#D8F5FF",
    brown: "#6B4F3C",
    red: "#C83D3D",
    orange: "#D98242",
    yellow: "#E6D45F",
    green: "#75B86B",
    blue: "#6EA9D6",
    purple: "#8061C5",
    pink: "#D979A7"
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
  const SUSTENANCE_TAGS = {
    "organic feeder": ["material", "organic", "clean"],
    "carrion feeder": ["material", "corpse", "organic"],
    "decay feeder": ["waste", "decay", "organic", "corpse"],
    "filth feeder": ["waste", "organic", "contaminated"],
    "mineral feeder": ["material", "mineral"],
    "metal feeder": ["material", "metal", "mineral"],
    "silicate feeder": ["material", "silicate", "mineral"],
    "fuel feeder": ["material", "fuel", "chemical", "volatile"],
    "arcane mineral feeder": ["material", "arcane", "mana", "mineral"],
    "hazard feeder": ["waste", "chemical", "contaminated", "hazardous"],
    "heat absorber": ["environmental", "heat"],
    "light absorber": ["environmental", "light"],
    "ambient mana absorber": ["environmental", "mana", "arcane"],
    "moisture absorber": ["environmental", "moisture"],
    "electrical absorber": ["environmental", "electricity"],
    "fume absorber": ["environmental", "chemical", "fume", "contaminated"]
  };
  const ENVIRONMENTAL_SUSTENANCE_DEFS = [
    {
      id: "heat",
      matchTags: ["heat"],
      attributeKey: "temperature",
      sourceLabel: "heat",
      actionLabel: "absorbing heat",
      floor: 25,
      fullAt: 65,
      drainPerNutrition: 6
    },
    {
      id: "light",
      matchTags: ["light"],
      attributeKey: "light",
      sourceLabel: "light",
      actionLabel: "absorbing light",
      floor: 15,
      fullAt: 75,
      drainPerNutrition: 6
    },
    {
      id: "mana",
      matchTags: ["mana", "arcane"],
      attributeKey: "ambientMana",
      sourceLabel: "ambient mana",
      actionLabel: "absorbing ambient mana",
      floor: 15,
      fullAt: 70,
      drainPerNutrition: 6
    },
    {
      id: "moisture",
      matchTags: ["moisture"],
      attributeKey: "moisture",
      sourceLabel: "moisture",
      actionLabel: "absorbing moisture",
      floor: 15,
      fullAt: 68,
      drainPerNutrition: 6
    },
    {
      id: "electricity",
      matchTags: ["electricity"],
      attributeKey: "electricalCharge",
      sourceLabel: "charge",
      actionLabel: "absorbing electrical charge",
      floor: 5,
      fullAt: 40,
      drainPerNutrition: 8
    },
    {
      id: "fume",
      matchTags: ["fume"],
      attributeKey: "contamination",
      sourceLabel: "fumes",
      actionLabel: "absorbing fumes",
      floor: 8,
      fullAt: 55,
      drainPerNutrition: 5
    }
  ];
  const FEEDSTOCK_DEFS = [
    { key: "organicFeedstock", label: "Organic Feedstock", tags: ["material", "organic", "clean"], passive: true },
    { key: "mineralFeedstock", label: "Mineral Feedstock", tags: ["material", "mineral"], passive: true },
    { key: "metalFeedstock", label: "Metal Feedstock", tags: ["material", "metal", "mineral"], passive: true },
    { key: "silicateFeedstock", label: "Silicate Feedstock", tags: ["material", "silicate", "mineral"], passive: true },
    { key: "fuelReagent", label: "Fuel Reagent", tags: ["material", "fuel", "chemical", "volatile"], passive: true },
    { key: "arcaneFeedstock", label: "Arcane Feedstock", tags: ["material", "arcane", "mana"], passive: true },
    { key: "carrionFeedstock", label: "Carrion Feedstock", tags: ["material", "corpse", "organic", "decay"], passive: false },
    { key: "contaminatedFeedstock", label: "Contaminated Feedstock", tags: ["waste", "contaminated", "hazardous", "chemical"], passive: false }
  ];
  const FEEDSTOCK_BY_KEY = Object.fromEntries(FEEDSTOCK_DEFS.map((feedstock) => [feedstock.key, feedstock]));
  const PASSIVE_FEEDSTOCK_INCOME_PER_DAY = 1;
  const CARRION_FEEDSTOCK_PER_CORPSE = 2;
  const CONTAMINATED_FEEDSTOCK_PER_DIRTY_WASTE = 1;
  const AUTO_FEED_MODES = [
    { id: "disabled", label: "Disabled" },
    { id: "emergency", label: "Emergency" },
    { id: "maintenance", label: "Maintenance" },
    { id: "growth", label: "Growth" },
    { id: "reproduction", label: "Reproduction" }
  ];
  const AUTO_FEED_MODE_BY_ID = Object.fromEntries(AUTO_FEED_MODES.map((mode) => [mode.id, mode]));
  const AUTO_FEED_MASS_GOALS = [
    { id: "ignore", label: "Ignore mass" },
    { id: "maintain", label: "Maintain" },
    { id: "regrow", label: "Regrow" },
    { id: "full", label: "Push to full" }
  ];
  const AUTO_FEED_MASS_GOAL_BY_ID = Object.fromEntries(AUTO_FEED_MASS_GOALS.map((goal) => [goal.id, goal]));
  const AUTO_FEED_DEFAULTS = {
    mode: "maintenance",
    feedBelow: 40,
    feedUntil: 60,
    massGoal: "maintain",
    allowUnknownSustenance: true,
    usePreferredWhenKnown: true,
    allowPartialMatches: true,
    allowBadMatches: false,
    allowHarmfulFeeding: false,
    allowCarrion: false,
    allowContaminated: false,
    allowReproductionPressure: false,
    preserveReserve: 0
  };
  const PREFERRED_FEEDSTOCKS_BY_SUSTENANCE = {
    "organic feeder": ["organicFeedstock"],
    "carrion feeder": ["carrionFeedstock"],
    "decay feeder": ["carrionFeedstock", "contaminatedFeedstock"],
    "filth feeder": ["contaminatedFeedstock"],
    "mineral feeder": ["mineralFeedstock"],
    "metal feeder": ["metalFeedstock"],
    "silicate feeder": ["silicateFeedstock"],
    "fuel feeder": ["fuelReagent"],
    "arcane mineral feeder": ["arcaneFeedstock"],
    "hazard feeder": ["contaminatedFeedstock"]
  };
  const FEED_MATCH_EFFECTS = {
    good: { label: "good match", nutrition: 24, mass: 8, stress: -1, bodyDamage: 0, waste: 0 },
    partial: { label: "partial match", nutrition: 12, mass: 3, stress: 1, bodyDamage: 0, waste: 0 },
    bad: { label: "poor match", nutrition: 5, mass: 1, stress: 4, bodyDamage: 0, waste: 1 },
    harmful: { label: "harmful match", nutrition: 2, mass: 0, stress: 8, bodyDamage: 2, waste: 2 }
  };
  const CREATURE_JOBS = [
    { id: "idle", label: "Idle" },
    { id: "corpse", label: "Corpse Processing" },
    { id: "disposal", label: "Waste Disposal" },
    { id: "cleanup", label: "Use as Cleaner" }
  ];
  const CORPSE_STATE_POLICY_DEFS = [
    { key: "fresh", label: "Fresh", defaultTarget: false },
    { key: "decaying", label: "Decaying", defaultTarget: false },
    { key: "spoiled", label: "Spoiled", defaultTarget: true },
    { key: "ruined", label: "Ruined", defaultTarget: true }
  ];
  const CORPSE_HANDLING_DEFAULTS = {
    autoMoveToDrums: false,
    destination: "drum"
  };
  const RESOURCE_DEFS = [
    { key: "biomass", label: "Biomass", initial: 50 },
    { key: "geneticMaterial", label: "Genetic Material", initial: 0 },
    { key: "elementalResidue", label: "Elemental Residue", initial: 0 },
    { key: "waste", label: "Waste", initial: 0 },
    ...FEEDSTOCK_DEFS.map((feedstock) => ({ key: feedstock.key, label: feedstock.label, initial: feedstock.passive ? 5 : 0 }))
  ];
  const RESOURCE_BY_KEY = Object.fromEntries(RESOURCE_DEFS.map((resource) => [resource.key, resource]));
  const RESOURCE_ALIASES = {
    ...Object.fromEntries(RESOURCE_DEFS.flatMap((resource) => [
      [normalizeCommandName(resource.key), resource.key],
      [normalizeCommandName(resource.label), resource.key]
    ])),
    genetic: "geneticMaterial",
    residue: "elementalResidue",
    elemental: "elementalResidue",
    organic: "organicFeedstock",
    mineral: "mineralFeedstock",
    metal: "metalFeedstock",
    silicate: "silicateFeedstock",
    fuel: "fuelReagent",
    arcane: "arcaneFeedstock",
    carrion: "carrionFeedstock",
    contaminated: "contaminatedFeedstock"
  };
  const INVENTORY_CATEGORY_DEFS = [
    {
      id: "materials",
      label: "Materials",
      description: "Stored biological and contaminant materials. Display-only for now except prototype cheats."
    },
    {
      id: "tools",
      label: "Tools & Supplies",
      description: "Reusable lab tools and handling supplies already implied by current interaction methods. Matching handling procedures require the cataloged tool to be stocked; tools are reusable and not consumed."
    }
  ];
  const INVENTORY_CATEGORY_BY_ID = Object.fromEntries(INVENTORY_CATEGORY_DEFS.map((category) => [category.id, category]));
  const INVENTORY_ITEM_DEFS = [
    {
      key: "biomass",
      label: "Biomass",
      category: "materials",
      initial: 0,
      description: "Recovered organic mass stored for future specimen work. Inventory is lab-wide for now and assumed to be kept in the Storage Room."
    },
    {
      key: "traceSlime",
      label: "Trace slime",
      category: "materials",
      initial: 0,
      description: "Small smears, films, and residues left by slime activity. Useful later for observation, reagent work, or contamination studies."
    },
    {
      key: "contaminatedResidue",
      label: "Contaminated residue",
      category: "materials",
      initial: 0,
      description: "Tainted lab residue gathered for future experiments. Stored carefully; not a food or feedstock system yet."
    },
    {
      key: "ruinedOrganicMatter",
      label: "Ruined organic matter",
      category: "materials",
      initial: 0,
      description: "Unusable or spoiled biological matter retained because even failures can become material."
    },
    {
      key: "preservedTissue",
      label: "Preserved tissue",
      category: "materials",
      initial: 0,
      description: "Stabilized biological samples reserved for later research and processing systems."
    },
    {
      key: "thickGloves",
      label: "Thick gloves",
      category: "tools",
      initial: 1,
      description: "Reusable protective gloves required by the Thick gloves handling method. Starter stock is cataloged in the Storage Room; tools are reusable and are not consumed."
    },
    {
      key: "longTongs",
      label: "Long tongs",
      category: "tools",
      initial: 1,
      description: "Long handling tongs required by the Long tongs handling method. Starter stock is cataloged in the Storage Room; tools are reusable and are not consumed."
    },
    {
      key: "hookPole",
      label: "Hook pole",
      category: "tools",
      initial: 1,
      description: "A reach tool required by the Hook pole handling method for pit covers, grates, and awkward handling. Starter stock is cataloged in the Storage Room; tools are reusable and are not consumed."
    },
    {
      key: "scraper",
      label: "Scraper",
      category: "tools",
      initial: 1,
      description: "A scraping tool required by the Scraper handling method for stuck, spoiled, ruined, or residue-like remains. Starter stock is cataloged in the Storage Room; tools are reusable and are not consumed."
    }
  ];
  const INVENTORY_ITEM_BY_KEY = Object.fromEntries(INVENTORY_ITEM_DEFS.map((item) => [item.key, item]));
  const HANDLING_METHOD_INVENTORY_ITEM_KEYS = {
    thickGloves: "thickGloves",
    longTongs: "longTongs",
    hookPole: "hookPole",
    scraper: "scraper"
  };
  const INVENTORY_ITEM_ALIASES = {
    ...Object.fromEntries(INVENTORY_ITEM_DEFS.flatMap((item) => [
      [normalizeCommandName(item.key), item.key],
      [normalizeCommandName(item.label), item.key]
    ])),
    trace: "traceSlime",
    slime: "traceSlime",
    residue: "contaminatedResidue",
    contaminated: "contaminatedResidue",
    ruined: "ruinedOrganicMatter",
    organic: "ruinedOrganicMatter",
    tissue: "preservedTissue",
    preserved: "preservedTissue",
    glove: "thickGloves",
    gloves: "thickGloves",
    thick: "thickGloves",
    tong: "longTongs",
    tongs: "longTongs",
    long: "longTongs",
    hook: "hookPole",
    pole: "hookPole",
    scraper: "scraper",
    scrapers: "scraper"
  };

  const SLIME_STAT_DEFS = [
    { key: "bodyIntegrity", label: "Body Integrity", initial: 100, max: 100 },
    { key: "nutrition", label: "Nutrition", initial: 50, max: 100 },
    { key: "currentMass", label: "Current Mass", initial: 100, max: 100 },
    { key: "divisionPressure", label: "Division Pressure", initial: 0, max: 100 },
    { key: "stress", label: "Stress", initial: 0, max: 100 }
  ];
  const SLIME_STAT_BY_KEY = Object.fromEntries(SLIME_STAT_DEFS.map((stat) => [stat.key, stat]));
  const SLIME_LIFESPAN_MULTIPLIER = 12;
  const MASS_REGROWTH_NUTRITION_FLOOR = 15;
  const MASS_REGROWTH_NUTRITION_COST = 0.45;
  const ENVIRONMENTAL_SUSTENANCE_NUTRITION_PER_DAY = 5;
  const ENVIRONMENTAL_SUSTENANCE_AVAILABILITY_POWER = 1.25;
  const DIVISION_NUTRITION_THRESHOLD = 70;
  const DIVISION_INTEGRITY_THRESHOLD = 80;
  const DIVISION_STRESS_LIMIT = 40;
  const SYNTHESIS_BIOMASS_COST = 10;
  const CORPSE_PROCESSING_BIOMASS_GAIN = 3;
  const CORPSE_PROCESSING_WASTE_GAIN = 1;
  const WASTE_DISPOSAL_UNIT = 1;
  const WASTE_DISPOSAL_RESIDUE_INTERVAL = 3;
  const WASTE_DISPOSAL_EXPOSURE_NOTICE_LOSS = 10;
  const WASTE_DISPOSAL_SLOW_OBSERVATION = 1440;
  const WASTE_DISPOSAL_CONTAMINATION_SUSPICION = 2;
  const FRESH_NECROPSY_GENETIC_GAIN = 1;

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
    { key: "shape", label: "Shape", test: "visual" },
    { key: "behavior", label: "Behavior", test: "behavior" },
    { key: "sustenance", label: "Sustenance", test: "sustenance" },
    { key: "byproduct", label: "Byproduct", test: "byproduct" },
    { key: "element", label: "Element", test: "element" },
    { key: "stability", label: "Stability", test: "containment" },
    { key: "appendages", label: "Appendages", test: "visual" },
    { key: "brood", label: "Brood Size", test: "breeding" },
    { key: "growth", label: "Growth Speed", test: "breeding" },
    { key: "lifespan", label: "Lifespan", test: "lifespan" },
    { key: "consistency", label: "Body Consistency", test: "visual" }
  ].map((region, index) => ({
    ...region,
    start: index * 2,
    length: 2
  }));

  const GENOME_LENGTH = REGION_DEFS.length * 2;
  const REGION_BY_KEY = Object.fromEntries(REGION_DEFS.map((region) => [region.key, region]));
  const VIRTUAL_TRAIT_DEFS = {
    weight: { key: "weight", label: "Weight", virtual: true },
    movement: { key: "movement", label: "Movement", virtual: true }
  };
  const DISPLAY_REGION_DEFS = DISPLAY_REGION_KEYS.map((key) => REGION_BY_KEY[key]);
  const SLIME_DISPLAY_KEYS = [
    "size",
    "shape",
    "consistency",
    "appendages",
    "color",
    "weight",
    "movement",
    "behavior",
    "sustenance",
    "byproduct",
    "element",
    "stability",
    "brood",
    "growth",
    "lifespan"
  ];
  const SLIME_DISPLAY_DEFS = SLIME_DISPLAY_KEYS.map((key) => REGION_BY_KEY[key] || VIRTUAL_TRAIT_DEFS[key]);
  const TESTS = [
    { id: "visual", label: "Visual Survey", traits: ["size", "shape", "consistency", "appendages", "color"], duration: 4, skillId: "observation", xp: 15 },
    { id: "sustenance", label: "Sustenance Test", traits: ["sustenance"], duration: 8, skillId: "nutrition", xp: 20 },
    { id: "element", label: "Element Exposure", traits: ["element"], duration: 10, skillId: "arcaneChemistry", xp: 20 },
    { id: "containment", label: "Containment Test", traits: ["stability"], duration: 12, skillId: "physiology", xp: 25 },
    { id: "byproduct", label: "Byproduct Collection", traits: ["byproduct"], duration: 14, skillId: "materialsAnalysis", xp: 20 },
    { id: "behavior", label: "Behavior Observation", traits: ["behavior"], duration: 9, skillId: "ethology", xp: 20 },
    { id: "stress", label: "Stress Test", traits: ["stability", "lifespan"], duration: 16, skillId: "physiology", xp: 25 },
    { id: "breeding", label: "Reproduction Survey", traits: ["brood", "growth"], duration: 18, skillId: "reproductiveBiology", xp: 30 },
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
      timeSpeed: DEFAULT_TIME_SPEED,
      clock: 0,
      suspicion: 0,
      suspicionPeakBand: "quiet",
      runEnded: false,
      lastSuspicionGainAt: null,
      lastSuspicionDecayAt: null,
      rooms: defaultRooms(),
      roomObservations: {},
      doors: defaultDoors(),
      containers: defaultContainers(),
      resources: defaultResources(),
      inventory: defaultInventory(),
      inventoryHistory: defaultInventoryHistory(),
      feedstockIncomeProgress: {},
      wasteTags: {},
      containmentIncidentProgress: {},
      policies: defaultPolicies(),
      currentGenome: "",
      queueDrawerOpen: false,
      slimes: [],
      corpses: [],
      tasks: [],
      selectedSlimeId: null,
      nextSlimeNumber: 1,
      nextCorpseNumber: 1,
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
      roomId: MAIN_ROOM_ID,
      physicalPresence: { ...SCIENTIST_DEFAULT_PHYSICAL_PRESENCE },
      physicalState: defaultScientistPhysicalState(),
      vitals: {
        health: { current: DEFAULT_VITAL_MAX, max: DEFAULT_VITAL_MAX },
        stamina: { current: DEFAULT_VITAL_MAX, max: DEFAULT_VITAL_MAX },
        mana: { current: DEFAULT_VITAL_MAX, max: DEFAULT_VITAL_MAX }
      },
      skills: Object.fromEntries(SKILL_DEFS.map((skill) => [skill.id, { xp: 0 }]))
    };
  }


  function defaultInventory() {
    return Object.fromEntries(INVENTORY_ITEM_DEFS.map((item) => [item.key, item.initial]));
  }

  function defaultInventoryHistory() {
    return Object.fromEntries(INVENTORY_ITEM_DEFS.map((item) => [item.key, []]));
  }

  function defaultResources() {
    return Object.fromEntries(RESOURCE_DEFS.map((resource) => [resource.key, resource.initial]));
  }


  function defaultRooms() {
    return ROOM_BASE_DEFS.map((roomDef) => ({
      id: roomDef.id,
      name: roomDef.name,
      articleName: roomDef.articleName,
      role: roomDef.role,
      roleLabel: roomDef.roleLabel,
      description: roomDef.description,
      geometry: normalizeRoomGeometry(roomDef.geometry),
      connections: normalizeRoomConnections(roomDef.connections, roomDef.id),
      observation: null,
      attributes: defaultRoomAttributes(roomDef.attributes)
    }));
  }

  function defaultDoors() {
    const doors = {};
    for (const room of ROOM_BASE_DEFS) {
      for (const connectedId of room.connections || []) {
        const key = doorKey(room.id, connectedId);
        if (!key || doors[key]) {
          continue;
        }
        doors[key] = {
          roomIds: doorRoomIdsFromKey(key),
          state: defaultDoorState(room.id, connectedId)
        };
      }
    }
    return doors;
  }



  function defaultRoomAttributes(overrides = {}) {
    return Object.fromEntries(
      ROOM_ATTRIBUTE_DEFS.map((attribute) => {
        const override = overrides?.[attribute.key] || {};
        return [
          attribute.key,
          {
            current: clamp(Number.isFinite(Number(override.current)) ? Number(override.current) : attribute.initial, 0, 100),
            baseline: clamp(Number.isFinite(Number(override.baseline)) ? Number(override.baseline) : attribute.baseline, 0, 100),
            recoveryPerHour: Math.max(0, Number.isFinite(Number(override.recoveryPerHour)) ? Number(override.recoveryPerHour) : attribute.recoveryPerHour)
          }
        ];
      })
    );
  }


  function defaultContainerEnvironment() {
    const env = {};
    for (const def of ROOM_ATTRIBUTE_DEFS) {
      env[def.key] = {
        current: def.initial,
        baseline: def.baseline,
        recoveryPerHour: def.recoveryPerHour
      };
    }
    return env;
  }

  function defaultContainers() {
    return [
      {
        id: SYNTHESIS_TUBE_ID,
        name: "Synthesis Tube",
        type: "synthesis",
        typeId: "synthesisTube",
        wardIds: [],
        roomId: MAIN_ROOM_ID,
        condition: CONTAINER_CONDITION_DEFAULT,
        environment: defaultContainerEnvironment()
      },
      ...STARTER_CONTAINER_LOADOUT.map((entry, index) => ({
        id: `basic-${index + 1}`,
        name: entry.name || `${containerTypeLabel(entry.typeId)} ${index + 1}`,
        type: "basic",
        typeId: entry.typeId,
        wardIds: [...(entry.wardIds || [])],
        roomId: starterContainerRoomId(entry, index),
        condition: CONTAINER_CONDITION_DEFAULT,
        environment: defaultContainerEnvironment()
      }))
    ];
  }

  function starterContainerRoomId(entry, index = 0) {
    if (entry?.roomId && ROOM_BASE_DEF_BY_ID[entry.roomId]) {
      return entry.roomId;
    }
    if (entry?.typeId === "openTray" || entry?.typeId === "sealedDrainageTank" || isPitHoleTypeId(entry?.typeId)) {
      return PITS_ROOM_ID;
    }
    if (index <= 1) {
      return MAIN_ROOM_ID;
    }
    return MENAGERIE_ROOM_ID;
  }

  function defaultSlimeStats() {
    return Object.fromEntries(
      SLIME_STAT_DEFS.map((stat) => [stat.key, { current: stat.initial, max: stat.max }])
    );
  }

  function defaultPolicies() {
    return {
      corpseProcessingTargets: Object.fromEntries(
        CORPSE_STATE_POLICY_DEFS.map((stateDef) => [stateDef.key, stateDef.defaultTarget])
      ),
      corpseHandling: { ...CORPSE_HANDLING_DEFAULTS },
      handling: { method: DEFAULT_HANDLING_METHOD },
      doors: { behavior: DEFAULT_DOOR_POLICY_ID },
      feeding: { ...AUTO_FEED_DEFAULTS }
    };
  }

  function init() {
    cacheDom();
    ensureInventoryPanel();
    populateTimeSpeedSelect();
    dom.sequenceInput.maxLength = GENOME_LENGTH;
    bindEvents();
    state = defaultState();
    geneMap = buildGeneMap(state.seed, state.complexity);
    prepareCorpseState();
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
      "speedReadout",
      "seedReadout",
      "storageReadout",
      "wasteReadout",
      "suspicionReadout",
      "pauseBtn",
      "timeSpeedSelect",
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
      "synthesisTubeStatus",
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
      "wasteSummary",
      "corpseList",
      "jobSummary",
      "jobList",
      "containerSummary",
      "containerList",
      "testButtons",
      "parentASelect",
      "parentBSelect",
      "breedBtn",
      "policySummary",
      "corpsePolicyList",
      "doorPolicyList",
      "feedingPolicyList",
      "roomSummary",
      "roomList",
      "roomCommandInput",
      "roomCommandBtn",
      "roomCommandStatus",
      "containerCommandInput",
      "containerCommandBtn",
      "containerCommandStatus",
      "healthReadout",
      "staminaReadout",
      "manaReadout",
      "resourceList",
      "skillList",
      "restFullBtn",
      "restMinutesInput",
      "restCustomBtn",
      "xpCommandInput",
      "xpCommandBtn",
      "xpCommandStatus",
      "resourceCommandInput",
      "resourceCommandBtn",
      "resourceCommandStatus",
      "inventorySummary",
      "inventoryList",
      "inventoryCommandInput",
      "inventoryCommandBtn",
      "inventoryCommandStatus",
      "journalModeReadout",
      "journalContent",
      "queueDrawer",
      "queueToggleBtn",
      "queueBadge",
      "queueNextReadout",
      "queueSummary",
      "skipAmountInput",
      "skipTimeBtn",
      "skipNextEventBtn",
      "skipQueueBtn",
      "taskList",
      "eventLog",
      "setupOverlay",
      "setupForm",
      "loadLastSaveBtn",
      "loadLastSaveStatus",
      "seedInput",
      "randomSeedBtn",
      "journalModeSelect",
      "complexitySelect"
    ]) {
      dom[id] = document.getElementById(id);
    }
  }


  function ensureInventoryPanel() {
    if (!dom.inventorySummary || !dom.inventoryList) {
      const panel = document.createElement("section");
      panel.className = "panel inventory-panel";
      panel.setAttribute("aria-labelledby", "inventoryTitle");
      panel.innerHTML = `
        <div class="panel-heading">
          <div>
            <h2 id="inventoryTitle">Inventory</h2>
            <p id="inventorySummary">Storage Room ledger</p>
          </div>
        </div>
        <div id="inventoryList" class="inventory-list"></div>
      `;
      const roomPanel = document.querySelector(".room-panel");
      if (roomPanel?.parentElement) {
        roomPanel.parentElement.insertBefore(panel, roomPanel.nextSibling);
      } else {
        dom.labRoot?.append(panel);
      }
      dom.inventorySummary = document.getElementById("inventorySummary");
      dom.inventoryList = document.getElementById("inventoryList");
    }

    if (!dom.inventoryCommandInput || !dom.inventoryCommandBtn || !dom.inventoryCommandStatus) {
      const cheatGrid = document.querySelector(".cheat-grid");
      if (cheatGrid) {
        const subpanel = document.createElement("div");
        subpanel.className = "subpanel";
        subpanel.dataset.inventoryCheatPanel = "true";
        subpanel.innerHTML = `
          <div class="subpanel-title">Inventory Cheat</div>
          <div class="cheat-row">
            <input id="inventoryCommandInput" type="text" spellcheck="false" placeholder="trace slime 5">
            <button id="inventoryCommandBtn" type="button">Add Item</button>
          </div>
          <p id="inventoryCommandStatus" class="journal-meta">Use inventory item name plus amount.</p>
        `;
        cheatGrid.append(subpanel);
        dom.inventoryCommandInput = document.getElementById("inventoryCommandInput");
        dom.inventoryCommandBtn = document.getElementById("inventoryCommandBtn");
        dom.inventoryCommandStatus = document.getElementById("inventoryCommandStatus");
      }
    }
  }

  function populateTimeSpeedSelect() {
    dom.timeSpeedSelect.textContent = "";
    for (const [index, speed] of TIME_SPEEDS.entries()) {
      const option = document.createElement("option");
      option.value = speed.id;
      option.textContent = `${index + 1}: ${speed.label} (${speed.description})`;
      dom.timeSpeedSelect.append(option);
    }
  }

  function bindEvents() {
    dom.setupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = defaultState();
      next.started = true;
      next.paused = true;
      next.timeSpeed = DEFAULT_TIME_SPEED;
      next.seed = cleanSeed(dom.seedInput.value) || makeSeed();
      next.journalMode = dom.journalModeSelect.value;
      next.complexity = dom.complexitySelect.value;
      next.currentGenome = randomGenome(seedRng(`${next.seed}:starter`));
      state = next;
      geneMap = buildGeneMap(state.seed, state.complexity);
      syncRoomObservationMemory();
      observeScientistRoom();
      addEvent("Run initialized.");
      persist();
      render();
    });

    dom.loadLastSaveBtn.addEventListener("click", () => {
      const loaded = loadLocalSave();
      if (!loaded) {
        syncSetupForm();
        return;
      }
      state = loaded;
      state.started = true;
      geneMap = buildGeneMap(state.seed, state.complexity);
      prepareCorpseState();
      syncRoomObservationMemory();
      observeScientistRoom();
      addEvent("Loaded local save.");
      persist();
      render();
    });

    dom.randomSeedBtn.addEventListener("click", () => {
      dom.seedInput.value = makeSeed();
    });

    dom.pauseBtn.addEventListener("click", () => {
      togglePause();
    });

    dom.timeSpeedSelect.addEventListener("change", () => {
      setTimeSpeed(dom.timeSpeedSelect.value);
    });

    dom.newRunBtn.addEventListener("click", () => {
      if (!window.confirm("Start a new run? The current run remains available only if exported first.")) {
        return;
      }
      state = defaultState();
      geneMap = buildGeneMap(state.seed, state.complexity);
      syncSetupForm();
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
      const synthesisReason = synthesisTubeBlockReason();
      if (synthesisReason) {
        addEvent(synthesisReason);
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
        resourceCosts: { biomass: SYNTHESIS_BIOMASS_COST },
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
      const cost = adjustedStaminaCost(HANDLING_STAMINA, ["slimeHandling"]);
      if (scientistIsDead()) {
      addEvent("The scientist is dead.");
      persist();
      render();
      return;
    }
      if (slime.status !== "released" && !confirmReleaseSuitabilityIfNeeded(slime)) {
        persist();
        render();
        return;
      }
    if (!spendStamina(cost)) {
        addEvent(`Not enough stamina. ${cost} required.`);
        persist();
        render();
        return;
      }
      if (slime.status === "released") {
        const container = moveSlimeToOpenPermanentContainer(slime);
        if (!container) {
          restoreStamina(cost);
          addEvent("No open permanent container is available.");
          persist();
          render();
          return;
        }
        addEvent(`${slime.name} contained in ${container.name}.`);
      } else {
        const previousLocation = containerLabelForSlime(slime);
        releaseSlime(slime);
        addEvent(`${slime.name} moved out of containment from ${previousLocation} into ${roomName(slime.roomId)}.`);
      }
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
        addEvent("Forced recombination requires living mature slimes.");
        persist();
        render();
        return;
      }
      if (!canAddContainedSlime()) {
        addEvent("Forced recombination requires at least one open permanent container.");
        persist();
        render();
        return;
      }
      startStaminaTask({
        type: "breed",
        label: `Forced Recombination ${parentA.name} x ${parentB.name}`,
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
      const minutes = Math.ceil(missing);
      if (!confirmUnsafeRestIfNeeded(minutes)) {
        persist();
        render();
        return;
      }
      createRestTask(minutes);
    });

    dom.restCustomBtn.addEventListener("click", () => {
      const minutes = Math.max(1, Math.floor(Number(dom.restMinutesInput.value) || 1));
      if (!confirmUnsafeRestIfNeeded(minutes)) {
        persist();
        render();
        return;
      }
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

    dom.resourceCommandBtn.addEventListener("click", () => {
      runResourceCommand();
    });

    dom.resourceCommandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runResourceCommand();
      }
    });

    dom.inventoryCommandBtn?.addEventListener("click", () => {
      runInventoryCommand();
    });

    dom.inventoryCommandInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runInventoryCommand();
      }
    });

    dom.roomCommandBtn.addEventListener("click", () => {
      runRoomCommand();
    });

    dom.roomCommandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runRoomCommand();
      }
    });

    dom.containerCommandBtn.addEventListener("click", () => {
      runContainerCommand();
    });

    dom.containerCommandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runContainerCommand();
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

    dom.skipNextEventBtn.addEventListener("click", () => {
      skipToNextEvent();
    });

    dom.skipQueueBtn.addEventListener("click", () => {
      skipToNextQueueCompletion();
    });

    document.addEventListener("keydown", handleTimeShortcut);

    dom.exportFileBtn.addEventListener("click", () => {
      downloadSave();
    });

    dom.exportFolderBtn.addEventListener("click", () => {
      exportToFolder();
    });

    dom.importFileInput.addEventListener("change", importSave);
  }

  function handleTimeShortcut(event) {
    if (event.defaultPrevented || isTypingTarget(event.target) || !state?.started) {
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      togglePause();
      return;
    }
    if (event.key === "[") {
      event.preventDefault();
      changeTimeSpeed(-1);
      return;
    }
    if (event.key === "]") {
      event.preventDefault();
      changeTimeSpeed(1);
      return;
    }
    if (/^[1-5]$/.test(event.key)) {
      event.preventDefault();
      setTimeSpeedByIndex(Number(event.key));
      return;
    }
    if (event.code === "Period") {
      event.preventDefault();
      if (event.shiftKey) {
        skipToNextQueueCompletion();
      } else {
        skipToNextEvent();
      }
    }
  }

  function isTypingTarget(target) {
    const element = target instanceof Element ? target : null;
    if (!element) {
      return false;
    }
    return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
  }

  function tick() {
    const now = Date.now();
    const elapsedSeconds = (now - lastTickAt) / 1000;
    lastTickAt = now;
    if (!state?.started || state.paused) {
      return;
    }
    const changed = advanceTime(elapsedSeconds * currentTimeSpeed().minutesPerSecond, { quiet: true });
    if (changed) {
      render();
    } else {
      renderLiveReadouts();
    }
  }

  function togglePause() {
    state.paused = !state.paused;
    lastTickAt = Date.now();
    persist();
    render();
  }

  function setTimeSpeed(speedId) {
    const speed = TIME_SPEEDS.find((candidate) => candidate.id === speedId) || timeSpeedById(DEFAULT_TIME_SPEED);
    state.timeSpeed = speed.id;
    lastTickAt = Date.now();
    persist();
    render();
  }

  function currentTimeSpeed() {
    return timeSpeedById(state?.timeSpeed);
  }

  function timeSpeedById(speedId) {
    return TIME_SPEEDS.find((speed) => speed.id === speedId) || TIME_SPEEDS.find((speed) => speed.id === DEFAULT_TIME_SPEED);
  }

  function changeTimeSpeed(step) {
    const currentIndex = Math.max(0, TIME_SPEEDS.findIndex((speed) => speed.id === currentTimeSpeed().id));
    const nextIndex = clamp(currentIndex + step, 0, TIME_SPEEDS.length - 1);
    setTimeSpeed(TIME_SPEEDS[nextIndex].id);
  }

  function setTimeSpeedByIndex(index) {
    const speed = TIME_SPEEDS[index - 1];
    if (speed) {
      setTimeSpeed(speed.id);
    }
  }

  function skipToNextQueueCompletion() {
    const event = nextQueueEvent();
    skipToEvent(event, "No queued tasks are waiting.");
  }

  function skipToNextEvent() {
    const event = nextMeaningfulEvent();
    skipToEvent(event, "No upcoming events are waiting.");
  }

  function skipToEvent(event, emptyMessage) {
    if (!event) {
      addEvent(emptyMessage);
      persist();
      render();
      return;
    }
    const delta = Math.max(0, event.time - state.clock);
    advanceTime(delta, { quiet: true });
    addEvent(delta > 0 ? `Skipped to ${event.label}.` : `${event.label} was ready.`);
    persist();
    render();
  }

  function nextQueueEvent() {
    const task = [...state.tasks]
      .sort((a, b) => a.dueAt - b.dueAt)
      .find((candidate) => candidate.dueAt >= state.clock);
    return task ? { time: task.dueAt, label: task.label, type: "queue" } : null;
  }

  function nextMeaningfulEvent() {
    const events = [];
    const queueEvent = nextQueueEvent();
    if (queueEvent) {
      events.push(queueEvent);
    }
    for (const slime of state.slimes) {
      if (slime.status === "dead") {
        continue;
      }
      if (!slime.mature && slime.matureAt >= state.clock) {
        events.push({ time: slime.matureAt, label: `${slime.name} maturity`, type: "maturity" });
      }
      if (slime.deathAt >= state.clock) {
        events.push({ time: slime.deathAt, label: `${slime.name} lifespan end`, type: "death" });
      }
    }
    for (const corpse of state.corpses || []) {
      if (!corpse.ruined) {
        if (state.clock < corpse.freshUntil) {
          events.push({ time: corpse.freshUntil, label: `${corpse.name} corpse decay`, type: "corpse" });
        } else if (state.clock < corpse.spoiledAt) {
          events.push({ time: corpse.spoiledAt, label: `${corpse.name} corpse spoilage`, type: "corpse" });
        }
      }
      if (corpse.storage === "overflow" && corpse.nextOverflowEventAt && corpse.nextOverflowEventAt >= state.clock) {
        events.push({ time: corpse.nextOverflowEventAt, label: `${corpse.name} overflow contamination`, type: "overflow" });
      }
    }
    const suspicionEvent = nextSuspicionBandChangeEvent();
    if (suspicionEvent) {
      events.push(suspicionEvent);
    }
    const jobEvent = nextCreatureJobEvent();
    if (jobEvent) {
      events.push(jobEvent);
    }
    const metabolismEvent = nextSlimeMetabolismEvent();
    if (metabolismEvent) {
      events.push(metabolismEvent);
    }
    const staminaEvent = nextVitalFullEvent("stamina");
    if (staminaEvent) {
      events.push(staminaEvent);
    }
    const manaEvent = nextVitalFullEvent("mana");
    if (manaEvent) {
      events.push(manaEvent);
    }
    return events
      .filter((event) => Number.isFinite(event.time) && event.time >= state.clock)
      .sort((a, b) => a.time - b.time)[0] || null;
  }

  function nextVitalFullEvent(vitalKey) {
    const vital = scientistVital(vitalKey);
    if (vital.current >= vital.max) {
      return null;
    }
    if (vitalKey === "stamina" && state.tasks.some((task) => task.type === "rest" || task.data?.staminaCost > 0)) {
      return null;
    }
    const minutesPerPoint = vitalKey === "mana" ? MANA_REGEN_MINUTES : STAMINA_REGEN_MINUTES;
    const minutes = (vital.max - vital.current) * minutesPerPoint;
    return {
      time: state.clock + minutes,
      label: `${vitalKey} full`,
      type: "recovery"
    };
  }

  function nextSuspicionBandChangeEvent() {
    const floor = passiveSuspicionFloor();
    if (state.suspicion <= floor) {
      return null;
    }
    const currentBand = suspicionBandForValue(state.suspicion);
    if (currentBand.id === "quiet") {
      return null;
    }
    const targetSuspicion = Math.max(floor, currentBand.min - 1);
    if (targetSuspicion >= state.suspicion) {
      return null;
    }
    const lastGain = finiteTime(state.lastSuspicionGainAt, state.clock);
    const decayStart = lastGain + SUSPICION_DECAY_DELAY;
    const decayFrom = Math.max(finiteTime(state.lastSuspicionDecayAt, decayStart), decayStart);
    const pointsNeeded = Math.ceil(state.suspicion - targetSuspicion);
    return {
      time: decayFrom + pointsNeeded * SUSPICION_DECAY_INTERVAL,
      label: `Suspicion drops to ${suspicionBandForValue(targetSuspicion).label}`,
      type: "suspicion"
    };
  }

  function advanceTime(minutes, options = {}) {
    state.clock += minutes;
    const vitalsChanged = recoverVitals(minutes);
    const physicalStateChanged = updateScientistPhysicalExposure(minutes);
    const suspicionChanged = updateSuspicionDecay();
    const roomChanges = recoverRoomAttributes(minutes);
    const envChanges = exchangeContainerEnvironments(minutes);
    const expired = expireSlimes();
    const corpseChanges = updateCorpses(minutes);
    const jobChanges = updateCreatureJobs(minutes);
    const feedstockChanged = updateFeedstockIncome(minutes);
    const feedingChanged = updateAutoFeeding();
    const uncontainedBehaviorChanged = updateUncontainedSlimeBehavior(minutes);
    const metabolismChanged = updateSlimeMetabolism(minutes);
    const containmentIncidentChanges = updateContainmentIncidents(minutes);
    const jobExpired = expireSlimes();
    const completed = completeDueTasks();
    syncRoomObservationMemory();
    const observationChanged = Boolean(observeScientistRoom());
    if (!options.quiet) {
      addEvent(`Advanced ${formatDuration(minutes)}.`);
    }
    if (!options.quiet || expired || jobExpired || corpseChanges || jobChanges || roomChanges || envChanges || feedstockChanged || feedingChanged || uncontainedBehaviorChanged || metabolismChanged || containmentIncidentChanges || completed || vitalsChanged || physicalStateChanged || observationChanged || suspicionChanged) {
      persist();
    }
    return expired + jobExpired + corpseChanges + jobChanges + roomChanges + envChanges + feedstockChanged + feedingChanged + uncontainedBehaviorChanged + metabolismChanged + containmentIncidentChanges + completed + (vitalsChanged ? 1 : 0) + (physicalStateChanged ? 1 : 0) + (observationChanged ? 1 : 0) + (suspicionChanged ? 1 : 0);
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
      const tube = synthesisTube();
      if (!tube || synthesisTubeOccupied()) {
        addResources(task.data.resourceCosts || {});
        addEvent("Synthesis could not stabilize; the synthesis tube was occupied. Reserved resources recovered.");
        return;
      }
      const slime = createSlime(task.data.genome, "Synthetic", { containerId: tube.id, roomId: tube.roomId });
      const reveal = revealTraits(slime, TESTS.find((test) => test.id === "visual").traits);
      awardActionXp(task.data.skillId, task.data.baseXp, reveal, "Synthesis");
      addEvent(`${slime.name} stabilized in the synthesis tube.`);
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

    if (task.type === "necropsy") {
      completeNecropsy(task);
      return;
    }

    if (task.type === "containerHaul") {
      completeContainerHaul(task);
      return;
    }

    if (task.type === "scientistMove") {
      completeScientistMove(task);
      return;
    }

    if (task.type === "containerInteraction") {
      completeContainerInteraction(task);
      return;
    }

    if (task.type === "physicalDiagnostic") {
      completePhysicalDiagnostic(task);
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
      const quality = task.data?.restQuality || "Unknown";
      if (quality === "Unsafe") {
        addEvent(`Rest complete. Recovered ${formatNumber(task.data.restore)} stamina, but unsafe conditions may have worsened Physical State.`);
      } else {
        addEvent(`Rest complete. Rest quality ${quality}. Recovered ${formatNumber(task.data.restore)} stamina.`);
      }
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

  function startStaminaTask({ type, label, baseDuration, skillId, baseXp, baseCost, resourceCosts = {}, data }) {
    if (scientistIsDead()) {
      addEvent("The scientist is dead.");
      persist();
      render();
      return false;
    }
    const riskyLabel = riskyTaskPhysicalStateLabel(type, label);
    if (riskyLabel && !confirmPhysicalStateRiskIfNeeded(riskyLabel)) {
      return false;
    }
    const cost = adjustedStaminaCost(baseCost, [skillId, "slimeHandling"]);
    const resourceReason = resourceBlockReason(resourceCosts);
    if (resourceReason) {
      addEvent(resourceReason);
      persist();
      render();
      return false;
    }
    if (!spendStamina(cost)) {
      addEvent(`Not enough stamina. ${cost} required.`);
      persist();
      render();
      return false;
    }
    if (!spendResources(resourceCosts)) {
      restoreStamina(cost);
      addEvent(resourceBlockReason(resourceCosts) || "Resources were not available.");
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
        resourceCosts: normalizeResourceCosts(resourceCosts),
        skillId,
        baseXp,
        staminaCost: cost
      }
    });
    return true;
  }

  function createRestTask(minutes) {
    const quality = restQualityInfo();
    createTask({
      type: "rest",
      label: `Rest ${formatDuration(minutes)}`,
      duration: minutes,
      data: {
        restore: minutes,
        roomId: quality.roomId,
        restQuality: quality.label,
        exposureBandAtStart: quality.exposureBand,
        expectedEffect: quality.expectedEffect
      }
    });
  }

  function createSlime(genome, source, options = {}) {
    const evaluated = evaluateGenome(genome);
    const lifespanMinutes = slimeLifespanMinutes(evaluated);
    const slime = {
      id: `slime-${state.nextSlimeNumber}`,
      name: `RG-${String(state.nextSlimeNumber).padStart(3, "0")}`,
      genome,
      source,
      createdAt: state.clock,
      deathAt: state.clock + lifespanMinutes,
      lifecycleVersion: 1,
      matureAt: options.matureAt ?? state.clock,
      mature: options.mature ?? true,
      status: options.status || "contained",
      containerId: options.containerId ?? null,
      roomId: options.roomId || MAIN_ROOM_ID,
      automationExcluded: Boolean(options.automationExcluded),
      job: "idle",
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      stats: normalizeSlimeStats(options.stats || defaultSlimeStats()),
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: []
    };
    if (slime.status !== "released" && slime.status !== "dead") {
      const container = containerById(slime.containerId);
      if (container) {
        slime.containerId = container.id;
        slime.roomId = container.roomId || slime.roomId;
      } else {
        slime.containerId = null;
      }
    } else {
      slime.containerId = null;
    }
    state.nextSlimeNumber += 1;
    state.slimes.unshift(slime);
    return slime;
  }

  function slimeLifespanMinutes(evaluated) {
    return effectiveLifespanMinutes(evaluated.traits.lifespan.meta);
  }

  function completeBreeding(task) {
    const parentA = findSlime(task.data.parentAId);
    const parentB = findSlime(task.data.parentBId);
    if (!parentA || !parentB || !isBreedable(parentA) || !isBreedable(parentB)) {
      addEvent("Forced recombination could not complete.");
      return;
    }
    const evalA = evaluateGenome(parentA.genome);
    const evalB = evaluateGenome(parentB.genome);
    const broodAverage = (evalA.traits.brood.meta.count + evalB.traits.brood.meta.count) / 2;
    const rng = seedRng(`${state.seed}:breed:${task.id}:${state.clock}`);
    const broodCount = clamp(Math.round(broodAverage + Math.floor(rng() * 3) - 1), 1, 8);
    const openContainers = openPermanentContainers();
    const offspringCount = Math.min(broodCount, openContainers.length);
    if (offspringCount <= 0) {
      addEvent("Forced recombination could not complete; no permanent container was open.");
      return;
    }
    const growthAverage = (evalA.traits.growth.meta.growthMinutes + evalB.traits.growth.meta.growthMinutes) / 2;
    const bodyCount = offspringCount + 2;
    const massShare = (slimeStat(parentA, "currentMass").current + slimeStat(parentB, "currentMass").current) / bodyCount;
    const nutritionShare = (slimeStat(parentA, "nutrition").current + slimeStat(parentB, "nutrition").current) / bodyCount;
    const created = [];
    const revealSummary = emptyRevealSummary();
    for (let i = 0; i < offspringCount; i += 1) {
      const childGenome = forcedRecombinationGenome(parentA.genome, parentB.genome, seedRng(`${state.seed}:child:${task.id}:${i}`), parentA, parentB);
      const growthMinutes = Math.max(4, Math.round(growthAverage * (0.8 + rng() * 0.4)));
      const child = createSlime(childGenome, "Recombined", {
        mature: false,
        matureAt: state.clock + growthMinutes,
        containerId: openContainers[i]?.id || null,
        roomId: openContainers[i]?.roomId || MAIN_ROOM_ID,
        stats: {
          bodyIntegrity: { current: 90, max: 100 },
          nutrition: { current: nutritionShare, max: 100 },
          currentMass: { current: massShare, max: 100 },
          divisionPressure: { current: 0, max: 100 },
          stress: { current: 12, max: 100 }
        }
      });
      mergeRevealSummary(revealSummary, revealTraits(child, ["size", "shape", "consistency", "appendages", "color"]));
      createTask({
        type: "mature",
        label: `Mature ${child.name}`,
        duration: growthMinutes,
        data: { slimeId: child.id }
      });
      created.push(child.name);
    }
    setSlimeStat(parentA, "currentMass", massShare);
    setSlimeStat(parentB, "currentMass", massShare);
    setSlimeStat(parentA, "nutrition", nutritionShare);
    setSlimeStat(parentB, "nutrition", nutritionShare);
    setSlimeStat(parentA, "divisionPressure", 0);
    setSlimeStat(parentB, "divisionPressure", 0);
    adjustSlimeStat(parentA, "stress", 8);
    adjustSlimeStat(parentB, "stress", 8);
    awardActionXp(task.data.skillId, task.data.baseXp, revealSummary, "Forced Recombination");
    addEvent(`Forced recombination produced ${created.length} offspring and divided parent mass across ${bodyCount} bodies.`);
    if (offspringCount < broodCount) {
      addEvent(`${broodCount - offspringCount} potential offspring could not be stabilized because no permanent container was open.`);
    }
  }

  function completeNecropsy(task) {
    const corpse = findCorpse(task.data.corpseId);
    if (!corpse || corpse.ruined) {
      addEvent("Necropsy could not complete; the corpse is no longer viable for examination.");
      return;
    }
    const freshness = corpseFreshness(corpse);
    const unknownTraits = DISPLAY_REGION_KEYS.filter((traitKey) => !corpse.revealed?.[traitKey]);
    const revealKeys = necropsyRevealKeys(unknownTraits, freshness, corpse);
    const revealSummary = revealKeys.length
      ? revealTraits(corpse, revealKeys, { measured: freshness === "fresh", testId: "necropsy" })
      : emptyRevealSummary();
    corpse.necropsyReport = effectivenessReport(corpse, freshness);
    corpse.necropsyQuality = freshness;
    corpse.necropsiedAt = state.clock;
    corpse.ruined = true;
    corpse.lastFreshness = "ruined";
    corpse.harvestBlocked = true;
    awardActionXp(task.data.skillId, task.data.baseXp, revealSummary, "Necropsy");
    addEvent(`Necropsy complete for ${corpse.name}. Corpse ruined; disposal still required.`);
    if (freshness === "fresh") {
      addResource("geneticMaterial", FRESH_NECROPSY_GENETIC_GAIN);
      addEvent(`Recovered ${FRESH_NECROPSY_GENETIC_GAIN} Genetic Material from fresh tissue.`);
    }
  }

  function necropsyRevealKeys(unknownTraits, freshness, corpse) {
    if (freshness === "fresh") {
      return unknownTraits;
    }
    if (freshness === "decaying") {
      const rng = seedRng(`${state.seed}:necropsy:${corpse.id}:${corpse.genome}`);
      return shuffle([...unknownTraits], rng).slice(0, Math.max(1, Math.ceil(unknownTraits.length / 2)));
    }
    return [];
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
      const measured = Boolean(options.measured && traitKey !== "color");
      const observation = traitKey === "color" ? makeColorObservation(result) : null;
      const repeatKey = `${measured ? "measured" : "observed"}:${key}`;
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
      slime.revealed[traitKey] = observation?.label || result.label;
      if (observation) {
        slime.traitObservations ||= {};
        slime.traitObservations[traitKey] = observation;
        delete slime.measured[traitKey];
      }
      if (measured) {
        slime.measured[traitKey] = true;
      }
      recordDiscovery(slime, traitKey, evaluated, { measured, observation });
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
      label: options.observation?.label || evaluated.traits[traitKey].label,
      codes: detail.codes,
      sample: slime.genome,
      discoveredAt: state.clock
    };
    if (traitKey === "color" && options.observation) {
      const currentTier = Number.isFinite(entry.observationTier) ? entry.observationTier : -1;
      const currentLevel = Number.isFinite(entry.observationLevel) ? entry.observationLevel : -1;
      if (options.observation.tier > currentTier || options.observation.level >= currentLevel) {
        entry.label = options.observation.label;
        entry.estimate = options.observation.reading;
        entry.swatch = options.observation.swatch;
        entry.observationTier = options.observation.tier;
        entry.observationLevel = options.observation.level;
        entry.observedAt = state.clock;
      }
      return;
    }
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


  function createCorpseFromSlime(slime, deathReason) {
    state.corpses ||= [];
    const location = initialCorpseLocationForSlime(slime);
    const diedAt = Number.isFinite(Number(slime.deathAt)) ? Number(slime.deathAt) : state.clock;
    const corpse = {
      id: `corpse-${state.nextCorpseNumber++}`,
      specimenId: slime.id,
      name: slime.name,
      genome: slime.genome,
      source: slime.source,
      deathReason,
      diedAt,
      roomId: location.roomId,
      containerId: location.containerId,
      storage: location.storage,
      consumedProgress: 0,
      ruined: false,
      revealed: { ...(slime.revealed || {}) },
      measured: { ...(slime.measured || {}) },
      traitObservations: clonePlainObject(slime.traitObservations || {}),
      testsRun: [...(slime.testsRun || [])],
      necropsyReport: "",
      nextOverflowEventAt: location.storage === "overflow" ? state.clock + OVERFLOW_EVENT_INTERVAL : null
    };
    applyCorpseDecayWindows(corpse);
    corpse.lastFreshness = corpseFreshness(corpse);
    state.corpses.unshift(corpse);
    if (corpseHandlingPolicy().autoMoveToDrums) {
      tryAutoMoveCorpse(corpse, { automatic: true, quiet: true });
    }
    if (corpse.storage === "overflow") {
      addEvent(`${slime.name} could not fit in a waste drum. Overflow contamination and evidence risk increased.`);
      addSuspicion(OVERFLOW_SUSPICION);
    }
    return corpse;
  }


  function expireSlimes() {
    let expired = 0;
    const survivors = [];
    for (const slime of state.slimes) {
      if (slime.status !== "dead" && (slime.deathAt <= state.clock || slimeStat(slime, "bodyIntegrity").current <= 0)) {
        const deathReason = slimeStat(slime, "bodyIntegrity").current <= 0
          ? slime.deathCause || "body integrity failure"
          : slime.deathCause || "lifespan";
        const corpse = createCorpseFromSlime(slime, deathReason);
        const causeText = {
          "waste exposure": "succumbed to waste exposure",
          "body integrity failure": "collapsed from body integrity failure"
        }[deathReason] || "reached the end of its lifespan";
        addEvent(`${slime.name} ${causeText}; remains are now in ${corpseLocationLabel(corpse)}.`);
        expired += 1;
      } else {
        survivors.push(slime);
      }
    }
    if (expired) {
      state.slimes = survivors;
      if (!findSlime(state.selectedSlimeId)) {
        state.selectedSlimeId = state.slimes[0]?.id || null;
      }
    }
    return expired;
  }

  function applyCorpseDecayWindows(corpse) {
    const profile = corpseDecayProfile(corpse.genome);
    corpse.decayProfile = profile;
    corpse.freshUntil = corpse.diedAt + profile.freshMinutes;
    corpse.spoiledAt = corpse.freshUntil + profile.decayMinutes;
  }

  function corpseDecayProfile(genome) {
    const evaluated = evaluateGenome(genome);
    const profile = physicalProfile(genome, evaluated);
    const sizeSpeed = clamp(Math.pow((profile?.volumeCm3 || 1000) / 1000, 0.18), 0.45, 2.2);
    const element = baseOutcomeLabel(evaluated.traits.element) || "none";
    const consistency = baseOutcomeLabel(evaluated.traits.consistency) || "soft gelatin";
    const elementSpeed = {
      none: 1,
      flame: 1.6,
      frost: 0.35,
      storm: 1.15,
      stone: 0.55,
      shadow: 0.8,
      light: 0.75,
      water: 1.25,
      wind: 0.8,
      wood: 1.1,
      metal: 0.45,
      poison: 1.45,
      acid: 2.2,
      dream: 0.75,
      gravity: 0.7,
      ether: 0.6,
      null: 0.9
    }[element] || 1;
    const consistencySpeed = {
      watery: 1.75,
      "runny gel": 1.65,
      syrupy: 1.25,
      "loose jelly": 1.55,
      "soft gelatin": 1,
      mucous: 1.55,
      foamy: 1.35,
      "elastic gel": 0.75,
      rubbery: 0.62,
      "tar-like": 0.8,
      waxen: 0.58,
      "fibrous gel": 0.9,
      "grainy slurry": 1.15,
      "crystalline gel": 0.42,
      "brittle jelly": 0.85,
      "clay-like": 0.65
    }[consistency] || 1;
    const speed = Math.max(0.1, sizeSpeed * elementSpeed * consistencySpeed);
    const freshMinutes = clamp(Math.round(120 / speed), 15, 1440);
    const decayMinutes = clamp(Math.round(420 / speed), 30, 3600);
    return { freshMinutes, decayMinutes, speed, element, consistency };
  }

  function corpseFreshness(corpse) {
    if (corpse.ruined) {
      return "ruined";
    }
    if (state.clock < corpse.freshUntil) {
      return "fresh";
    }
    if (state.clock < corpse.spoiledAt) {
      return "decaying";
    }
    return "spoiled";
  }

  function corpseStateLabel(corpse) {
    return titleCase(corpseFreshness(corpse));
  }

  function corpseDecayText(corpse) {
    const freshness = corpseFreshness(corpse);
    if (freshness === "fresh") {
      return `fresh for ${formatDuration(corpse.freshUntil - state.clock)}`;
    }
    if (freshness === "decaying") {
      return `spoils in ${formatDuration(corpse.spoiledAt - state.clock)}`;
    }
    if (freshness === "ruined") {
      return "ruined; disposal needed";
    }
    return "spoiled; disposal needed";
  }

  function addSuspicion(amount) {
    const gain = Math.max(0, Number(amount) || 0);
    if (!gain) {
      return false;
    }
    const beforeBand = suspicionBandForValue(state.suspicion);
    state.suspicion = clamp(Math.round((Number(state.suspicion) || 0) + gain), 0, SUSPICION_MAX);
    const afterBand = suspicionBandForValue(state.suspicion);
    state.lastSuspicionGainAt = state.clock;
    state.lastSuspicionDecayAt = state.clock;
    const peakIndex = Math.max(suspicionBandIndex(state.suspicionPeakBand), suspicionBandIndex(afterBand.id));
    state.suspicionPeakBand = SUSPICION_BANDS[peakIndex].id;
    if (suspicionBandIndex(afterBand.id) > suspicionBandIndex(beforeBand.id)) {
      addEvent(`Suspicion rose to ${afterBand.label}.`);
    }
    return true;
  }

  function updateSuspicionDecay() {
    state.suspicion = clamp(Math.round(Number(state.suspicion) || 0), 0, SUSPICION_MAX);
    const floor = passiveSuspicionFloor();
    if (state.suspicion <= floor) {
      return false;
    }
    const lastGain = finiteTime(state.lastSuspicionGainAt, state.clock);
    const decayStart = lastGain + SUSPICION_DECAY_DELAY;
    const decayFrom = Math.max(finiteTime(state.lastSuspicionDecayAt, decayStart), decayStart);
    if (state.clock < decayFrom + SUSPICION_DECAY_INTERVAL) {
      return false;
    }
    const points = Math.floor((state.clock - decayFrom) / SUSPICION_DECAY_INTERVAL);
    if (points < 1) {
      return false;
    }
    const beforeSuspicion = state.suspicion;
    const beforeBand = suspicionBandForValue(state.suspicion);
    state.suspicion = Math.max(floor, state.suspicion - points);
    state.lastSuspicionDecayAt = decayFrom + points * SUSPICION_DECAY_INTERVAL;
    const afterBand = suspicionBandForValue(state.suspicion);
    if (suspicionBandIndex(afterBand.id) < suspicionBandIndex(beforeBand.id)) {
      addEvent(`Suspicion dropped to ${afterBand.label}.`);
    }
    return state.suspicion !== beforeSuspicion;
  }

  function passiveSuspicionFloor() {
    const peakIndex = suspicionBandIndex(state.suspicionPeakBand);
    return SUSPICION_BANDS[Math.max(0, peakIndex - 1)].min;
  }

  function suspicionBandForValue(value) {
    const suspicion = clamp(Math.round(Number(value) || 0), 0, SUSPICION_MAX);
    for (let index = SUSPICION_BANDS.length - 1; index >= 0; index -= 1) {
      if (suspicion >= SUSPICION_BANDS[index].min) {
        return SUSPICION_BANDS[index];
      }
    }
    return SUSPICION_BANDS[0];
  }

  function suspicionBandIndex(id) {
    const index = SUSPICION_BANDS.findIndex((band) => band.id === id);
    return index >= 0 ? index : 0;
  }

  function finiteTime(value, fallback) {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function recoverRoomAttributes(minutes) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!elapsed) {
      return 0;
    }
    state.rooms = normalizeRooms(state.rooms);
    let changes = 0;
    for (const room of state.rooms) {
      for (const attribute of Object.values(room.attributes)) {
        const difference = attribute.baseline - attribute.current;
        if (Math.abs(difference) < 0.01) {
          continue;
        }
        const recovery = Math.max(0, attribute.recoveryPerHour) * (elapsed / 60);
        if (!recovery) {
          continue;
        }
        attribute.current += Math.sign(difference) * Math.min(Math.abs(difference), recovery);
        changes += 1;
      }
    }
    return changes;
  }

  function containerEnvironmentExchange(container) {
    if (container.id === SYNTHESIS_TUBE_ID || container.typeId === "synthesisTube") {
      const zeroRates = {};
      for (const def of ROOM_ATTRIBUTE_DEFS) {
        zeroRates[def.key] = 0;
      }
      return zeroRates;
    }
    const type = containerTypeDef(container.typeId);
    const rates = type?.environmentExchange;
    if (rates) {
      return rates;
    }
    const zeroRates = {};
    for (const def of ROOM_ATTRIBUTE_DEFS) {
      zeroRates[def.key] = 0;
    }
    return zeroRates;
  }

  function exchangeContainerEnvironments(minutes) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!elapsed) {
      return 0;
    }
    state.containers = normalizeContainers(state.containers);
    state.rooms = normalizeRooms(state.rooms);
    let changes = 0;
    for (const container of state.containers) {
      const rates = containerEnvironmentExchange(container);
      const room = roomById(container.roomId || MAIN_ROOM_ID);
      if (!room) {
        continue;
      }
      container.environment = normalizeContainerEnvironment(container.environment);
      for (const def of ROOM_ATTRIBUTE_DEFS) {
        const key = def.key;
        const rate = Number(rates[key]);
        if (!rate || rate <= 0) {
          continue;
        }
        const roomValue = Number(room.attributes?.[key]?.current);
        const envValue = Number(container.environment[key]?.current);
        if (!Number.isFinite(roomValue) || !Number.isFinite(envValue)) {
          continue;
        }
        const diff = roomValue - envValue;
        if (Math.abs(diff) < 0.01) {
          continue;
        }
        const step = Math.min(1, rate * CONTAINER_ENVIRONMENT_EXCHANGE_PER_HOUR * (elapsed / 60));
        const delta = step * diff;
        container.environment[key].current = clamp(envValue + delta, 0, 100);
        if (Math.abs(delta) >= 0.01) {
          changes += 1;
        }
      }
    }
    return changes;
  }

  function adjustRoomAttribute(roomId, attributeKey, amount) {
    const room = roomById(roomId);
    const def = ROOM_ATTRIBUTE_BY_KEY[attributeKey];
    const attribute = room?.attributes?.[attributeKey];
    const delta = Number(amount);
    if (!room || !def || !attribute || !Number.isFinite(delta) || !delta) {
      return false;
    }
    const before = attribute.current;
    attribute.current = clamp(attribute.current + delta, 0, 100);
    return Math.abs(attribute.current - before) >= 0.01;
  }

  function roomById(roomId) {
    state.rooms = normalizeRooms(state.rooms);
    return state.rooms.find((room) => room.id === roomId) || state.rooms.find((room) => room.id === MAIN_ROOM_ID) || state.rooms[0] || null;
  }

  function roomName(roomId) {
    return roomById(roomId)?.name || "Unknown Room";
  }

  function roomArticleName(roomId) {
    const room = roomById(roomId);
    return room?.articleName || (room?.name ? `the ${room.name}` : "the room");
  }

  function roomRole(roomId) {
    return roomById(roomId)?.role || "custom";
  }

  function roomRoleLabel(roomId) {
    return roomById(roomId)?.roleLabel || "Custom room";
  }

  function doorKey(roomAId, roomBId) {
    const a = cleanRoomId(roomAId);
    const b = cleanRoomId(roomBId);
    if (!a || !b || a === b) {
      return "";
    }
    return [a, b].sort().join("::");
  }

  function doorRoomIdsFromKey(key) {
    return String(key || "").split("::").map(cleanRoomId).filter(Boolean).slice(0, 2);
  }

  function defaultDoorState(roomAId, roomBId) {
    const ids = new Set([cleanRoomId(roomAId), cleanRoomId(roomBId)]);
    const isMainRoomDoor = ids.has(MAIN_ROOM_ID);
    const startsClosed =
      isMainRoomDoor &&
      (ids.has(BEDROOM_ROOM_ID) || ids.has(STORAGE_ROOM_ID));
    return startsClosed ? DOOR_STATE_CLOSED : DOOR_STATE_OPEN;
  }

  function doorForConnection(roomAId, roomBId) {
    state.doors = normalizeDoors(state.doors);
    const key = doorKey(roomAId, roomBId);
    return state.doors[key] || null;
  }

  function doorState(roomAId, roomBId) {
    return doorForConnection(roomAId, roomBId)?.state || defaultDoorState(roomAId, roomBId);
  }

  function doorIsOpen(roomAId, roomBId) {
    return doorState(roomAId, roomBId) === DOOR_STATE_OPEN;
  }

  function doorStateLabel(roomAId, roomBId) {
    return doorIsOpen(roomAId, roomBId) ? "open" : "closed";
  }

  function doorStateTooltipText(roomAId, roomBId) {
    const connectionLabel = `${roomName(roomAId)} ↔ ${roomName(roomBId)}`;
    if (doorIsOpen(roomAId, roomBId)) {
      return `Open door: free creatures, scientist movement, and container hauling can pass through ${connectionLabel}. Free creatures may move through open doors if their behavior leads them that way. Doors currently affect movement only; they do not seal air, contamination, sound, or exposure.`;
    }
    return `Closed door: free creature movement is blocked through ${connectionLabel}. Scientist movement and container hauling can still pass through automatically, then follow the Door behavior policy. Doors currently affect movement only; they do not seal air, contamination, sound, or exposure.`;
  }

  function doorControlsTooltipText(roomOrId) {
    const room = typeof roomOrId === "string" ? roomById(roomOrId) : roomOrId;
    const entries = (room?.connections || []).map((connectedId) => doorStateTooltipText(room.id, connectedId));
    return entries.length ? entries.join("\n") : "No doors connect to this room.";
  }

  function doorPolicy() {
    state.policies = normalizePolicies(state.policies);
    return state.policies.doors;
  }

  function currentDoorPolicyDef() {
    return DOOR_POLICY_BY_ID[doorPolicy().behavior] || DOOR_POLICY_BY_ID[DEFAULT_DOOR_POLICY_ID];
  }

  function setDoorState(roomAId, roomBId, stateValue, options = {}) {
    const key = doorKey(roomAId, roomBId);
    if (!key) {
      return false;
    }
    state.doors = normalizeDoors(state.doors);
    const door = state.doors[key];
    if (!door) {
      return false;
    }
    const nextState = stateValue === DOOR_STATE_OPEN ? DOOR_STATE_OPEN : DOOR_STATE_CLOSED;
    if (door.state === nextState) {
      return false;
    }
    door.state = nextState;
    if (options.event !== false) {
      addEvent(`${roomName(roomAId)} ↔ ${roomName(roomBId)} door ${nextState === DOOR_STATE_OPEN ? "opened" : "closed"}.`);
    }
    return true;
  }

  function setDoorPolicy(policyId) {
    state.policies = normalizePolicies(state.policies);
    const nextId = DOOR_POLICY_BY_ID[policyId] ? policyId : DEFAULT_DOOR_POLICY_ID;
    state.policies.doors.behavior = nextId;
    addEvent(`Door policy set: ${DOOR_POLICY_BY_ID[nextId].label}.`);
    persist();
    render();
  }

  function doorTransitPlan(route) {
    const steps = [];
    for (let index = 0; index < (route || []).length - 1; index += 1) {
      const fromRoomId = route[index];
      const toRoomId = route[index + 1];
      const key = doorKey(fromRoomId, toRoomId);
      if (!key) {
        continue;
      }
      steps.push({
        key,
        fromRoomId,
        toRoomId,
        previousState: doorState(fromRoomId, toRoomId)
      });
    }
    return steps;
  }

  function applyDoorTransitPolicy(steps, actorLabel = "Movement") {
    const policyId = currentDoorPolicyDef().id;
    const changed = [];
    for (const step of steps || []) {
      if (!step?.key || !state.doors?.[step.key]) {
        continue;
      }
      let finalState = step.previousState === DOOR_STATE_OPEN ? DOOR_STATE_OPEN : DOOR_STATE_CLOSED;
      if (policyId === "leaveOpenAfterUse") {
        finalState = DOOR_STATE_OPEN;
      } else if (policyId === "closeAfterUse") {
        finalState = DOOR_STATE_CLOSED;
      }
      if (state.doors[step.key].state !== finalState) {
        state.doors[step.key].state = finalState;
        changed.push(`${roomName(step.fromRoomId)} ↔ ${roomName(step.toRoomId)} ${finalState}`);
      }
    }
    if (changed.length) {
      addEvent(`${actorLabel} door policy applied: ${changed.join(" · ")}.`);
    }
  }

  function roomSortRank(room) {
    const order = [MAIN_ROOM_ID, MENAGERIE_ROOM_ID, PITS_ROOM_ID, BEDROOM_ROOM_ID, STORAGE_ROOM_ID];
    const index = order.indexOf(room?.id);
    return index === -1 ? 100 + String(room?.name || "").localeCompare("zzzz") : index;
  }

  function roomBlocksJobs(roomId) {
    return roomRole(roomId) === "livingStorage";
  }


  function roomGeometry(roomOrId) {
    const room = typeof roomOrId === "string" ? roomById(roomOrId) : roomOrId;
    return normalizeRoomGeometry(room?.geometry);
  }

  function roomFloorAreaM2(roomOrId) {
    return roomGeometry(roomOrId).floorAreaM2;
  }

  function roomVolumeM3(roomOrId) {
    return roomGeometry(roomOrId).volumeM3;
  }

  function roomSpatialFeel(roomOrId) {
    const floorArea = roomFloorAreaM2(roomOrId);
    return ROOM_SPATIAL_FEEL_BANDS.find((band) => floorArea <= band.maxFloorAreaM2)?.label || "Serviceable";
  }

  function roomConnectionNames(roomOrId) {
    const room = typeof roomOrId === "string" ? roomById(roomOrId) : roomOrId;
    return (room?.connections || []).map(roomName).filter(Boolean);
  }

  function roomConnectionsLabel(roomOrId) {
    const names = roomConnectionNames(roomOrId);
    return names.length ? `Connected to: ${names.join(", ")}` : "Connected to: none";
  }

  function roomMapSummary() {
    const main = roomById(MAIN_ROOM_ID);
    if (!main) {
      return "";
    }
    const connected = roomConnectionNames(main);
    return connected.length ? `Room map: ${main.name} ↔ ${connected.join(", ")}` : `Room map: ${main.name}`;
  }

  function containerRoomFloorLoad(container) {
    if (!container) {
      return 0;
    }
    return ROOM_CONTAINER_FLOOR_LOAD_M2[container.typeId] || ROOM_CONTAINER_FLOOR_LOAD_M2.default;
  }

  function roomCrowdingLoadM2(roomId) {
    const containers = (state.containers || []).filter((container) => (container.roomId || MAIN_ROOM_ID) === roomId);
    const freeCreatures = (state.slimes || []).filter((slime) => slimeIsUncontained(slime) && slime.status !== "dead" && slimeEffectiveRoomId(slime) === roomId);
    const localCorpses = (state.corpses || []).filter((corpse) => (corpse.roomId || MAIN_ROOM_ID) === roomId);
    const containerLoad = containers.reduce((total, container) => total + containerRoomFloorLoad(container), 0);
    const scientistLoad = scientistRoomId() === roomId ? scientistFloorLoadM2() : 0;
    return containerLoad + (freeCreatures.length * ROOM_FREE_CREATURE_FLOOR_LOAD_M2) + (localCorpses.length * ROOM_CORPSE_FLOOR_LOAD_M2) + scientistLoad;
  }

  function roomCrowdingRatio(roomOrId) {
    const room = typeof roomOrId === "string" ? roomById(roomOrId) : roomOrId;
    const area = Math.max(1, roomFloorAreaM2(room));
    return roomCrowdingLoadM2(room?.id || MAIN_ROOM_ID) / area;
  }

  function roomCrowdingLabel(roomOrId) {
    const ratio = roomCrowdingRatio(roomOrId);
    return ROOM_CROWDING_BANDS.find((band) => ratio <= band.maxRatio)?.label || "Busy";
  }


  function roomCrowdingPressureScore(roomOrId) {
    const ratio = roomCrowdingRatio(roomOrId);
    if (ratio >= 0.75) return 18;
    if (ratio >= 0.5) return 12;
    if (ratio >= 0.3) return 6;
    if (ratio <= 0.08) return -2;
    return 0;
  }

  function roomCrowdingPressureReason(roomOrId) {
    const label = roomCrowdingLabel(roomOrId);
    if (["Crowded", "Overpacked"].includes(label)) {
      return `room is ${label.toLowerCase()}`;
    }
    if (label === "Busy") {
      return "room is busy";
    }
    return "";
  }

  function roomVolumeM3(roomOrId) {
    const room = typeof roomOrId === "string" ? roomById(roomOrId) : roomOrId;
    return Math.max(1, Number(roomGeometry(room).volumeM3) || ROOM_EFFECT_REFERENCE_VOLUME_M3);
  }

  function roomEffectScale(roomOrId) {
    const room = typeof roomOrId === "string" ? roomById(roomOrId) : roomOrId;
    const floorAreaScale = clamp(ROOM_EFFECT_REFERENCE_FLOOR_AREA_M2 / Math.max(1, roomFloorAreaM2(room)), 0.35, 2.25);
    const volumeScale = clamp(ROOM_EFFECT_REFERENCE_VOLUME_M3 / roomVolumeM3(room), 0.45, 2.0);
    return clamp((floorAreaScale + volumeScale) / 2, 0.4, 2.1);
  }

  function roomConnectedIds(roomId) {
    const room = roomById(roomId);
    return (room?.connections || []).filter((connectedId) => roomById(connectedId));
  }

  function roomPassableConnectedIds(roomId, options = {}) {
    return roomConnectedIds(roomId).filter((connectedId) => options.ignoreDoors || doorIsOpen(roomId, connectedId));
  }

  function roomRouteBetween(fromRoomId, toRoomId, options = {}) {
    const start = roomById(fromRoomId)?.id || MAIN_ROOM_ID;
    const target = roomById(toRoomId)?.id || MAIN_ROOM_ID;
    if (start === target) {
      return [start];
    }
    const queue = [[start]];
    const visited = new Set([start]);
    while (queue.length) {
      const route = queue.shift();
      const last = route[route.length - 1];
      for (const next of roomPassableConnectedIds(last, options)) {
        if (visited.has(next)) {
          continue;
        }
        const nextRoute = [...route, next];
        if (next === target) {
          return nextRoute;
        }
        visited.add(next);
        queue.push(nextRoute);
      }
    }
    return options.requireReachable ? [] : [start, target];
  }

  function roomRouteLabel(fromRoomId, toRoomId, options = {}) {
    const route = roomRouteBetween(fromRoomId, toRoomId, options);
    return route.length ? route.map(roomName).join(" → ") : "no open route";
  }

  function nextConnectedRoomToward(fromRoomId, toRoomId, options = {}) {
    const route = roomRouteBetween(fromRoomId, toRoomId, options);
    return route[1] || "";
  }

  function bestContaminationTargetRoom() {
    return state.rooms
      .map((room) => ({ room, contamination: roomContaminationValue(room.id) }))
      .sort((a, b) => b.contamination - a.contamination)[0] || null;
  }

  function bestReachableContaminationTargetRoom(fromRoomId) {
    return state.rooms
      .map((room) => ({
        room,
        contamination: roomContaminationValue(room.id),
        route: roomRouteBetween(fromRoomId, room.id, { requireReachable: true })
      }))
      .filter((entry) => entry.room.id === fromRoomId || entry.route.length > 0)
      .sort((a, b) => b.contamination - a.contamination)[0] || null;
  }

  function roomGeometrySummaryEl(room) {
    const panel = document.createElement("div");
    panel.className = "room-geometry-summary";
    panel.dataset.roomGeometrySummary = room.id;
    const geometry = roomGeometry(room);
    const shapeLabel = geometry.shape === "irregular pit chamber" ? "Irregular pit chamber" : titleCase(geometry.shape);
    panel.append(
      chip(`Size: ${roomSpatialFeel(room)}`),
      document.createTextNode(" · "),
      chip(`Crowding: ${roomCrowdingLabel(room)}`),
      document.createTextNode(" · "),
      chip(`Shape: ${shapeLabel}`)
    );
    const connections = document.createElement("div");
    connections.className = "room-connections";
    connections.textContent = roomConnectionsLabel(room);
    panel.append(connections);
    const doors = document.createElement("div");
    doors.className = "room-door-summary";
    doors.textContent = roomDoorSummaryLabel(room);
    doors.title = doorControlsTooltipText(room);
    panel.append(doors);
    panel.title = `Floor area and volume are tracked internally for physical simulation. Shape and crowding are player-facing estimates.`;
    return panel;
  }

  function roomDoorSummaryLabel(roomOrId) {
    const room = typeof roomOrId === "string" ? roomById(roomOrId) : roomOrId;
    const entries = (room?.connections || []).map((connectedId) => `${roomName(connectedId)} door ${doorStateLabel(room.id, connectedId)}`);
    return entries.length ? `Doors: ${entries.join(" · ")}` : "Doors: none";
  }

  function roomDoorControlsEl(room) {
    const panel = document.createElement("div");
    panel.className = "room-door-controls";
    panel.dataset.roomDoorControls = room.id;
    const connections = roomConnectedIds(room.id);
    if (!connections.length) {
      panel.append(textEl("span", "Doors: none"));
      return panel;
    }
    panel.append(textEl("strong", "Doors"));
    for (const connectedId of connections) {
      const stateLabel = doorStateLabel(room.id, connectedId);
      const row = document.createElement("div");
      row.className = "room-door-row";
      row.dataset.doorConnection = doorKey(room.id, connectedId);
      const stateText = textEl("span", `${roomName(connectedId)} door: ${titleCase(stateLabel)}`);
      stateText.classList.add("keyword-tooltip");
      stateText.dataset.doorStateLabel = doorKey(room.id, connectedId);
      stateText.title = doorStateTooltipText(room.id, connectedId);
      row.append(stateText);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.doorToggle = doorKey(room.id, connectedId);
      button.textContent = stateLabel === "open" ? "Close door" : "Open door";
      button.title = stateLabel === "open"
        ? `Close the ${roomName(room.id)} ↔ ${roomName(connectedId)} door. Closed doors block free creature movement.`
        : `Open the ${roomName(room.id)} ↔ ${roomName(connectedId)} door. Open doors allow free creature movement if behavior leads creatures through.`;
      button.addEventListener("click", () => {
        setDoorState(room.id, connectedId, stateLabel === "open" ? DOOR_STATE_CLOSED : DOOR_STATE_OPEN);
        persist();
        render();
      });
      row.append(button);
      panel.append(row);
    }
    return panel;
  }


  function slimeIsUncontained(slime) {
    return Boolean(slime && slime.status === "released");
  }

  function roomContaminationValue(roomId) {
    const room = roomById(roomId);
    return clamp(Number(room?.attributes?.contamination?.current) || 0, 0, 100);
  }

  function slimeEffectiveRoomId(slime) {
    if (!slime) return MAIN_ROOM_ID;
    if (slime.status !== "released" && slime.containerId) {
      return containerById(slime.containerId)?.roomId || slime.roomId || MAIN_ROOM_ID;
    }
    return slime.roomId || MAIN_ROOM_ID;
  }

  function slimeJobRoomBlockReason(slime) {
    const roomId = slimeEffectiveRoomId(slime);
    if (roomBlocksJobs(roomId)) {
      return `Specimens stored in ${roomArticleName(roomId)} cannot be assigned jobs.`;
    }
    return "";
  }

  function jobRequiresPits(jobId) {
    return jobId === "corpse" || jobId === "disposal";
  }

  function slimeJobSpecificBlockReason(slime, jobId) {
    if (!slime || !jobRequiresPits(jobId)) {
      return "";
    }
    if (slimeEffectiveRoomId(slime) !== PITS_ROOM_ID) {
      return `${creatureJobLabel(jobId)} requires the Pits.`;
    }
    return "";
  }

  function cleanupUseControlNote() {
    return "Simple slimes follow instincts. Use doors to limit where this creature can roam; suitable cleaners will seek contamination wherever they can reach.";
  }

  function predictionRangeText(range) {
    const low = range?.low || range?.[0] || "Unknown";
    const high = range?.high || range?.[1] || low;
    return low === high ? low : `${low}–${high}`;
  }

  function releaseInstinctControlNote() {
    return "Released simple slimes follow instincts. Doors limit where they can roam.";
  }

  function predictionSkillSummary(skillIds = []) {
    const ids = skillIds.filter((skillId) => SKILL_BY_ID[skillId]);
    if (!ids.length) {
      return { best: 0, text: "no relevant skill data" };
    }
    const parts = ids.map((skillId) => `${SKILL_BY_ID[skillId].label} ${skillLevel(skillId)}`);
    return { best: Math.max(...ids.map((skillId) => skillLevel(skillId))), text: parts.join(" · ") };
  }

  function predictionConfidenceFromContext({ unknownFactors = [], knownFactors = [], concerns = [], clearEvidence = 0, skillIds = [] } = {}) {
    const skill = predictionSkillSummary(skillIds);
    if (!knownFactors.length && !concerns.length && clearEvidence <= 0) {
      return {
        label: "Unknown",
        factors: [
          "not enough confirmed evidence to narrow the range",
          unknownFactors.length ? `unknown factors: ${unknownFactors.join(", ")}` : "relevant factors are not confirmed",
          `relevant skills: ${skill.text}`
        ]
      };
    }
    if (unknownFactors.length >= 3 || skill.best <= 1) {
      return {
        label: "Rough",
        factors: [
          unknownFactors.length ? `unknown factors widen the range: ${unknownFactors.join(", ")}` : "some important factors remain uncertain",
          `relevant skills: ${skill.text}`
        ]
      };
    }
    if (unknownFactors.length >= 1 || skill.best <= 3) {
      return {
        label: "Fair",
        factors: [
          unknownFactors.length ? `remaining unknowns: ${unknownFactors.join(", ")}` : "most immediate signs are known",
          `relevant skills: ${skill.text}`
        ]
      };
    }
    return {
      label: "Strong",
      factors: [
        "major relevant factors are known or directly observed",
        `relevant skills: ${skill.text}`
      ]
    };
  }

  function predictionRangeFromBand(bands, band, confidenceLabel, options = {}) {
    const fallback = bands[0] || "Unknown";
    const index = Math.max(0, bands.indexOf(band));
    if (confidenceLabel === "Strong") {
      return { low: band || fallback, high: band || fallback };
    }
    if (confidenceLabel === "Fair") {
      return {
        low: bands[Math.max(0, index - 1)] || fallback,
        high: bands[Math.min(bands.length - 1, index + 1)] || band || fallback
      };
    }
    if (confidenceLabel === "Rough") {
      return {
        low: bands[Math.max(0, index - 2)] || fallback,
        high: bands[Math.min(bands.length - 1, index + 2)] || band || fallback
      };
    }
    return {
      low: options.unknownLow || bands[0] || "Unknown",
      high: options.unknownHigh || bands[bands.length - 1] || "Unknown"
    };
  }

  function cleanupUseRangeTooltip(suitability) {
    const lines = [
      `Cleanup suitability range: ${predictionRangeText(suitability.range)}.`
    ];
    if (suitability.helpfulFactors?.length) {
      lines.push(`Helpful factors raising the range: ${suitability.helpfulFactors.join(" · ")}.`);
    }
    if (suitability.concerns?.length) {
      lines.push(`Concerns lowering or widening the range: ${suitability.concerns.join(" · ")}.`);
    }
    if (suitability.unknownFactors?.length) {
      lines.push(`Unknown factors widening the range: ${suitability.unknownFactors.join(", ")}.`);
    }
    lines.push(cleanupUseControlNote());
    return lines.join("\n");
  }

  function predictionConfidenceTooltip(confidence) {
    const factors = confidence?.factors || [];
    return [`${confidence?.label || "Unknown"} confidence.`, ...factors].join("\n");
  }

  function cleanupUseOptionTitle(slime) {
    const suitability = observedCleanupUseSuitability(slime);
    const lines = [
      "Marks this slime as intended for contamination cleanup. This is not an order; simple slimes still follow instincts.",
      cleanupUseControlNote(),
      `Cleanup suitability range: ${predictionRangeText(suitability.range)}.`,
      `Confidence: ${suitability.confidence.label}.`
    ];
    lines.push(cleanupUseRangeTooltip(suitability));
    lines.push(predictionConfidenceTooltip(suitability.confidence));
    return lines.join("\n");
  }

  const CLEANUP_EFFECT_BANDS = ["Trace", "Weak", "Modest", "Good", "Strong"];

  function ensureCleanupObservation(slime) {
    if (!slime) {
      return { minutes: 0, feedingMinutes: 0, residueMinutes: 0, doorMinutes: 0, seekingMinutes: 0, clearEvents: 0 };
    }
    slime.cleanupObservation ||= {};
    slime.cleanupObservation.minutes = Math.max(0, Number(slime.cleanupObservation.minutes) || 0);
    slime.cleanupObservation.feedingMinutes = Math.max(0, Number(slime.cleanupObservation.feedingMinutes) || 0);
    slime.cleanupObservation.residueMinutes = Math.max(0, Number(slime.cleanupObservation.residueMinutes) || 0);
    slime.cleanupObservation.doorMinutes = Math.max(0, Number(slime.cleanupObservation.doorMinutes) || 0);
    slime.cleanupObservation.seekingMinutes = Math.max(0, Number(slime.cleanupObservation.seekingMinutes) || 0);
    slime.cleanupObservation.clearEvents = Math.max(0, Number(slime.cleanupObservation.clearEvents) || 0);
    return slime.cleanupObservation;
  }

  function recordCleanupObservation(slime, activityType, minutes, roomId) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!slime || elapsed <= 0 || !scientistObservesRoom(roomId || slime.roomId || MAIN_ROOM_ID)) {
      return;
    }
    const observation = ensureCleanupObservation(slime);
    observation.minutes += elapsed;
    if (activityType === "feedingOnContamination") {
      observation.feedingMinutes += elapsed;
    } else if (activityType === "leavingResidue") {
      observation.residueMinutes += elapsed;
    } else if (activityType === "pressingClosedDoor") {
      observation.doorMinutes += elapsed;
    } else if (activityType === "seekingContamination") {
      observation.seekingMinutes += elapsed;
    }
  }

  function cleanupActivityPerformance(slime) {
    const observation = ensureCleanupObservation(slime);
    const activityType = slime?.roomActivity?.type || "unknown";
    const helpfulFactors = [];
    const concerns = [];
    const unknownFactors = [];
    let band = "Trace";
    let clearEvidence = Math.min(40, observation.minutes * 2);

    if (activityType === "feedingOnContamination") {
      band = "Good";
      helpfulFactors.push("observed feeding on contamination");
      clearEvidence += Math.min(40, observation.feedingMinutes * 3);
    } else if (activityType === "seekingContamination") {
      band = "Weak";
      helpfulFactors.push("observed seeking contamination");
      clearEvidence += Math.min(18, observation.seekingMinutes * 2);
      unknownFactors.push("whether it will feed when it arrives");
    } else if (activityType === "leavingResidue") {
      band = "Weak";
      concerns.push("observed leaving residue");
      clearEvidence += Math.min(18, observation.residueMinutes * 2);
      unknownFactors.push("net cleanup after residue");
    } else if (activityType === "pressingClosedDoor") {
      band = "Trace";
      concerns.push("not currently reaching the target stimulus");
      unknownFactors.push("intent beyond the closed door");
    } else {
      unknownFactors.push("current cleanup behavior");
    }

    if (observation.feedingMinutes >= 8) {
      helpfulFactors.push("sustained observed feeding");
    }
    if (observation.residueMinutes >= 3) {
      concerns.push("residue observed during cleanup");
    }
    if (observation.minutes <= 0) {
      unknownFactors.push("direct observation time");
    } else if (observation.minutes < 6) {
      unknownFactors.push("short observation window");
    }
    if (!slime?.revealed?.sustenance) {
      unknownFactors.push("sustenance");
    }
    if (!slime?.revealed?.behavior) {
      unknownFactors.push("behavior");
    }
    if (!slime?.revealed?.byproduct) {
      unknownFactors.push("byproduct");
    }

    const confidence = predictionConfidenceFromContext({
      unknownFactors,
      knownFactors: helpfulFactors,
      concerns,
      clearEvidence,
      skillIds: ["observation", "ethology", "slimeHandling"]
    });
    const range = predictionRangeFromBand(CLEANUP_EFFECT_BANDS, band, confidence.label, { unknownLow: "Trace", unknownHigh: "Strong" });
    return { range, confidence, helpfulFactors, concerns, unknownFactors, observationMinutes: observation.minutes };
  }

  function cleanupActivityPerformanceTooltip(performance) {
    const lines = [`Cleanup effect range: ${predictionRangeText(performance?.range)}.`];
    if (performance?.helpfulFactors?.length) {
      lines.push(`Observed factors raising the range: ${performance.helpfulFactors.join(" · ")}.`);
    }
    if (performance?.concerns?.length) {
      lines.push(`Concerns lowering or widening the range: ${performance.concerns.join(" · ")}.`);
    }
    if (performance?.unknownFactors?.length) {
      lines.push(`Unknown factors widening the range: ${performance.unknownFactors.join(", ")}.`);
    }
    lines.push(`Observed cleanup time: ${formatDuration(Math.max(0, performance?.observationMinutes || 0))}.`);
    lines.push(predictionConfidenceTooltip(performance?.confidence));
    return lines.join("\n");
  }

  function slimeCleanupActivityPerformanceChips(slime) {
    if (!slimeIsUncontained(slime)) {
      return [];
    }
    const type = slime?.roomActivity?.type;
    if (!["feedingOnContamination", "seekingContamination", "leavingResidue"].includes(type)) {
      return [];
    }
    const performance = cleanupActivityPerformance(slime);
    const rangeChip = chip(`Cleanup effect: ${predictionRangeText(performance.range)}`);
    rangeChip.dataset.cleanupEffectRange = slime.id;
    rangeChip.title = cleanupActivityPerformanceTooltip(performance);
    const confidenceChip = chip(`Confidence: ${performance.confidence.label}`);
    confidenceChip.dataset.cleanupEffectConfidence = slime.id;
    confidenceChip.title = predictionConfidenceTooltip(performance.confidence);
    return [rangeChip, confidenceChip];
  }

  function slimeDoorIntentAssessment(slime) {
    const info = slimeContaminationTraitInfo(slime);
    const observed = ensureCleanupObservation(slime);
    const possible = [];
    const knownFactors = [];
    const concerns = [];
    const unknownFactors = [];
    let clearEvidence = Math.min(25, observed.doorMinutes * 2);

    if (info.seeksContamination || slime?.roomActivity?.targetRoomId) {
      possible.push("seeking contamination");
      knownFactors.push("pressed against a closed route toward contamination");
      clearEvidence += 16;
    }
    if (slimeHuntingInclination(slime)) {
      possible.push("hunting");
      concerns.push("predatory or hunting signs are possible");
      clearEvidence += 8;
    }
    if (!possible.includes("roaming") && (!slime?.revealed?.behavior || possible.length < 2)) {
      possible.push("roaming");
      unknownFactors.push("exact intent at the door");
    }
    if (!slime?.revealed?.behavior) {
      unknownFactors.push("behavior");
    }
    if (!slime?.revealed?.sustenance) {
      unknownFactors.push("sustenance");
    }

    // Keep ambiguous door behavior as a range of possible intents rather than an omniscient motive.
    const text = possible.includes("seeking contamination") && possible.includes("hunting")
      ? "seeking contamination–hunting"
      : possible.slice(0, 2).join("–") || "unknown";
    const confidence = predictionConfidenceFromContext({
      unknownFactors,
      knownFactors,
      concerns,
      clearEvidence,
      skillIds: ["observation", "ethology", "slimeHandling"]
    });
    const tooltip = [
      `Possible intent: ${text}.`,
      "This is an interpretation of observed door behavior, not a command or hidden certainty."
    ];
    if (knownFactors.length) tooltip.push(`Observed factors: ${knownFactors.join(" · ")}.`);
    if (concerns.length) tooltip.push(`Concerns: ${concerns.join(" · ")}.`);
    if (unknownFactors.length) tooltip.push(`Unknown factors widening the interpretation: ${unknownFactors.join(", ")}.`);
    tooltip.push(predictionConfidenceTooltip(confidence));
    return { text, confidence, tooltip: tooltip.join("\n") };
  }

  function slimeDoorIntentChips(slime) {
    if (!slimeIsUncontained(slime) || slime?.roomActivity?.type !== "pressingClosedDoor") {
      return [];
    }
    const intent = slimeDoorIntentAssessment(slime);
    const intentChip = chip(`Possible intent: ${intent.text}`);
    intentChip.dataset.possibleIntent = slime.id;
    intentChip.title = intent.tooltip;
    const confidenceChip = chip(`Confidence: ${intent.confidence.label}`);
    confidenceChip.dataset.possibleIntentConfidence = slime.id;
    confidenceChip.title = predictionConfidenceTooltip(intent.confidence);
    return [intentChip, confidenceChip];
  }

  function fallbackReleaseFitForIdle(slime) {
    const unknownFactors = [];
    if (!slimeTraitKnown(slime, "behavior")) unknownFactors.push("behavior");
    if (!slimeTraitKnown(slime, "sustenance")) unknownFactors.push("sustenance");
    if (!slimeTraitKnown(slime, "byproduct")) unknownFactors.push("byproduct");
    if (!slimeTraitKnown(slime, "stability")) unknownFactors.push("stability");
    const concerns = ["no active intended use is selected"];
    const confidence = predictionConfidenceFromContext({ unknownFactors, concerns, skillIds: ["observation", "ethology", "slimeHandling"] });
    const range = predictionRangeFromBand(["Poor", "Acceptable", "Good", "Excellent"], "Acceptable", confidence.label, { unknownLow: "Poor", unknownHigh: "Excellent" });
    return {
      intendedUse: creatureJobLabel(slime?.job || "idle"),
      band: "Acceptable",
      range,
      confidence,
      helpfulFactors: [],
      concerns,
      unknownFactors
    };
  }

  function observedReleaseUseFit(slime) {
    if (!slime) {
      const confidence = predictionConfidenceFromContext({ concerns: ["no living slime selected"], skillIds: ["observation", "ethology", "slimeHandling"] });
      return {
        intendedUse: "Unknown",
        band: "Unknown",
        range: { low: "Poor", high: "Unknown" },
        confidence,
        helpfulFactors: [],
        concerns: ["no living slime selected"],
        unknownFactors: []
      };
    }

    normalizeSlimeJob(slime);
    const intendedUse = creatureJobLabel(slime.job);
    if (slime.job === "cleanup") {
      const suitability = observedCleanupUseSuitability(slime);
      return {
        intendedUse,
        band: suitability.band,
        range: suitability.range,
        confidence: suitability.confidence,
        helpfulFactors: suitability.helpfulFactors,
        concerns: suitability.concerns,
        unknownFactors: suitability.unknownFactors
      };
    }

    if (slime.job === "corpse") {
      const suitability = observedCorpseProcessingSuitability(slime);
      const concerns = [
        "free slimes still follow instincts",
        "formal corpse processing depends on reachable remains and room conditions"
      ];
      const helpfulFactors = suitability.reasons || [];
      const unknownFactors = suitability.known ? [] : ["corpse processing fit"];
      const band = suitability.known ? suitability.band : "Acceptable";
      const confidence = predictionConfidenceFromContext({ unknownFactors, knownFactors: helpfulFactors, concerns, skillIds: ["observation", "ethology", "slimeHandling"] });
      return {
        intendedUse,
        band,
        range: predictionRangeFromBand(["Poor", "Acceptable", "Good", "Excellent"], band, confidence.label, { unknownLow: "Poor", unknownHigh: "Excellent" }),
        confidence,
        helpfulFactors,
        concerns,
        unknownFactors
      };
    }

    if (slime.job === "disposal") {
      const suitability = observedWasteDisposalSuitability(slime);
      const concerns = [
        "free slimes still follow instincts",
        "formal waste disposal depends on accessible waste and room conditions"
      ];
      const helpfulFactors = suitability.reasons || [];
      const unknownFactors = suitability.known ? [] : ["waste disposal fit"];
      const band = suitability.known ? suitability.band : "Acceptable";
      const confidence = predictionConfidenceFromContext({ unknownFactors, knownFactors: helpfulFactors, concerns, skillIds: ["observation", "ethology", "slimeHandling"] });
      return {
        intendedUse,
        band,
        range: predictionRangeFromBand(["Poor", "Acceptable", "Good", "Excellent"], band, confidence.label, { unknownLow: "Poor", unknownHigh: "Excellent" }),
        confidence,
        helpfulFactors,
        concerns,
        unknownFactors
      };
    }

    return fallbackReleaseFitForIdle(slime);
  }

  function releaseSuitabilityTooltipText(slime) {
    const fit = observedReleaseUseFit(slime);
    const roomId = slimeEffectiveRoomId(slime) || slime?.roomId || MAIN_ROOM_ID;
    const lines = [
      "Release warning",
      `${slime?.name || "This slime"} will be released into ${roomName(roomId)}.`,
      releaseInstinctControlNote(),
      `Intended use: ${fit.intendedUse}`,
      `Possible fit after release: ${predictionRangeText(fit.range)}`,
      `Confidence: ${fit.confidence.label}`
    ];
    if (fit.helpfulFactors.length) {
      lines.push(`Helpful factors: ${fit.helpfulFactors.join(" · ")}`);
    }
    if (fit.concerns.length) {
      lines.push(`Concerns: ${fit.concerns.join(" · ")}`);
    }
    if (fit.unknownFactors.length) {
      lines.push(`Unknown factors: ${fit.unknownFactors.join(", ")}`);
    }
    lines.push(predictionConfidenceTooltip(fit.confidence));
    return lines.join("\n");
  }

  function releaseSuitabilityWarningText(slime) {
    const fit = observedReleaseUseFit(slime);
    const roomId = slimeEffectiveRoomId(slime) || slime?.roomId || MAIN_ROOM_ID;
    const lines = [
      "Release warning",
      "",
      `${slime?.name || "This slime"} will be released into ${roomName(roomId)}.`,
      releaseInstinctControlNote(),
      "",
      `Intended use: ${fit.intendedUse}`,
      `Possible fit after release: ${predictionRangeText(fit.range)}`,
      `Confidence: ${fit.confidence.label}`,
      "",
      "Continue releasing this slime?"
    ];
    return lines.join("\n");
  }

  function confirmReleaseSuitabilityIfNeeded(slime) {
    if (!slime || slime.status === "released" || slime.status === "dead") {
      return true;
    }
    const accepted = window.confirm(releaseSuitabilityWarningText(slime));
    if (!accepted) {
      addEvent(`${slime.name} release cancelled.`);
    }
    return accepted;
  }

  function roomAttributeBand(attributeKey, value) {
    const def = ROOM_ATTRIBUTE_BY_KEY[attributeKey];
    if (!def) {
      return { min: 0, label: "Unknown" };
    }
    const current = clamp(Number(value) || 0, 0, 100);
    for (let index = def.bands.length - 1; index >= 0; index -= 1) {
      if (current >= def.bands[index].min) {
        return def.bands[index];
      }
    }
    return def.bands[0];
  }

  function containerTypeDef(typeId) {
    return CONTAINER_BASE_TYPE_BY_ID[typeId] || CONTAINER_BASE_TYPE_BY_ID.basicGlassJar;
  }

  function containerTypeLabel(typeId) {
    return containerTypeDef(typeId).label;
  }

  function isPitHoleTypeId(typeId) {
    return PIT_HOLE_TYPE_IDS.includes(String(typeId || ""));
  }

  function isPitHoleContainer(container) {
    return Boolean(container && isPitHoleTypeId(container.typeId));
  }

  function pitHoleContainers() {
    return permanentContainers().filter(isPitHoleContainer);
  }

  function pitHoleCorpseCapacity(container) {
    return Math.max(1, Number(containerTypeDef(container?.typeId).corpseCapacity) || 6);
  }

  function pitHoleCorpseCount(container) {
    return containerCorpses(container?.id).length;
  }

  function availablePitHoleContainer() {
    return pitHoleContainers()
      .filter((container) => pitHoleCorpseCount(container) < pitHoleCorpseCapacity(container))
      .sort((a, b) => pitHoleCorpseCount(a) - pitHoleCorpseCount(b) || containerTypeDef(b.typeId).seal - containerTypeDef(a.typeId).seal)
      [0] || null;
  }

  function containerWardDef(wardId) {
    return CONTAINER_WARD_BY_ID[wardId] || null;
  }

  function containerWardLabels(wardIds) {
    return normalizeContainerWardIds(wardIds).map((wardId) => containerWardDef(wardId)?.label).filter(Boolean);
  }

  function normalizeContainerWardIds(candidate) {
    const seen = new Set();
    const wardIds = Array.isArray(candidate) ? candidate : [];
    return wardIds
      .map((wardId) => CONTAINER_WARD_BY_ID[wardId] ? wardId : CONTAINER_WARD_ALIASES[normalizeCommandName(wardId)])
      .filter(Boolean)
      .filter((wardId) => {
        if (seen.has(wardId)) {
          return false;
        }
        seen.add(wardId);
        return true;
      });
  }

  function starterContainerForId(containerId) {
    const match = String(containerId || "").match(/^basic-(\d+)$/);
    if (!match) {
      return null;
    }
    return STARTER_CONTAINER_LOADOUT[Number(match[1]) - 1] || null;
  }

  function containerBaseTypeIdFromCommand(value) {
    const normalized = normalizeCommandName(value);
    if (!normalized) {
      return "";
    }
    if (CONTAINER_BASE_TYPE_ALIASES[normalized]) {
      return CONTAINER_BASE_TYPE_ALIASES[normalized];
    }
    const partial = CONTAINER_BASE_TYPE_DEFS.find((type) => normalizeCommandName(type.label).includes(normalized));
    return partial?.id || "";
  }

  function containerWardIdFromCommand(value) {
    const normalized = normalizeCommandName(value);
    if (!normalized) {
      return "";
    }
    if (CONTAINER_WARD_ALIASES[normalized]) {
      return CONTAINER_WARD_ALIASES[normalized];
    }
    const partial = CONTAINER_WARD_DEFS.find((ward) => normalizeCommandName(ward.label).includes(normalized));
    return partial?.id || "";
  }

  function hasContainerWard(container, wardId) {
    return normalizeContainerWardIds(container?.wardIds).includes(wardId);
  }

  function containerEffectiveSeal(container) {
    const type = containerTypeDef(container?.typeId);
    return clamp(type.seal + (hasContainerWard(container, "sealTightening") ? 25 : 0), 0, 100);
  }

  function containerEffectiveWeightLimit(container) {
    const type = containerTypeDef(container?.typeId);
    return type.maxWeightKg * (hasContainerWard(container, "loadBearing") ? 1.6 : 1);
  }

  function containerProtectsAny(container, tags) {
    const wanted = new Set((Array.isArray(tags) ? tags : [tags]).map((tag) => normalizeCommandName(tag)));
    return normalizeContainerWardIds(container?.wardIds).some((wardId) => {
      const ward = containerWardDef(wardId);
      return ward?.protects?.some((tag) => wanted.has(normalizeCommandName(tag)));
    });
  }

  function containerProtectionLabel(container, tags) {
    const wanted = new Set((Array.isArray(tags) ? tags : [tags]).map((tag) => normalizeCommandName(tag)));
    const wardId = normalizeContainerWardIds(container?.wardIds).find((candidate) => {
      const ward = containerWardDef(candidate);
      return ward?.protects?.some((tag) => wanted.has(normalizeCommandName(tag)));
    });
    return wardId ? containerWardDef(wardId)?.label || "" : "";
  }

  function passiveContainerSuitability(slime, container) {
    if (!slime || !container) {
      return { label: "Unknown", className: "container-band-unknown", reasons: ["No specimen assigned."] };
    }
    if (container.type === "synthesis") {
      return {
        label: "Perfect Temporary Fit",
        className: "container-band-good",
        reasons: ["The synthesis tube is built for temporary universal containment."]
      };
    }

    const evaluated = evaluateGenome(slime.genome);
    const profile = physicalProfile(slime.genome, evaluated);
    const type = containerTypeDef(container.typeId);
    const condition = containerCondition(container);
    const revealed = slime.revealed || {};
    const knownTraits = ["size", "shape", "consistency", "appendages", "element", "byproduct", "stability"]
      .filter((traitKey) => revealed[traitKey]);
    if (!profile || !knownTraits.length) {
      return {
        label: "Unknown",
        className: "container-band-unknown",
        reasons: ["No relevant containment traits discovered yet."]
      };
    }

    let score = 100;
    const reasons = [];
    const addConcern = (severity, text) => {
      const weights = { minor: 8, moderate: 18, major: 34, severe: 50 };
      score -= weights[severity] || 0;
      reasons.push(text);
    };
    const addNote = (text) => {
      reasons.push(text);
    };
    const addThreat = (label, tags, resistanceKey) => {
      const wardLabel = containerProtectionLabel(container, tags);
      if (wardLabel) {
        addNote(`${wardLabel} covers ${label}.`);
        return;
      }
      const resistance = Number(type.resistances?.[resistanceKey]) || 0;
      if (resistance < 25) {
        addConcern("severe", `${type.label} has very poor ${label} resistance.`);
      } else if (resistance < 50) {
        addConcern("major", `${type.label} has weak ${label} resistance.`);
      } else if (resistance < 70) {
        addConcern("minor", `${type.label} only partly resists ${label}.`);
      }
    };

    if (revealed.size) {
      const massFraction = clamp(slimeStat(slime, "currentMass").current, 1, 100) / 100;
      const currentVolume = profile.volumeCm3 * massFraction;
      const currentWeight = profile.weightKg * massFraction;
      const weightLimit = containerEffectiveWeightLimit(container);
      if (currentVolume > type.capacityCm3) {
        addConcern("severe", `Current body volume exceeds ${type.label} capacity.`);
      } else if (currentVolume > type.capacityCm3 * 0.85) {
        addConcern("moderate", `Current body nearly fills ${type.label}.`);
      } else if (profile.volumeCm3 > type.capacityCm3) {
        addConcern("major", `Full mass would outgrow ${type.label}.`);
      }
      if (revealed.shape && currentWeight > weightLimit) {
        addConcern("severe", `Current weight exceeds the container load limit.`);
      } else if (revealed.shape && profile.weightKg > weightLimit) {
        addConcern("major", `Full mass may exceed the container load limit.`);
      }
      if (revealed.shape) {
        for (const concern of containerDimensionalSuitabilityConcerns(slime, container, profile, { consistencyKnown: Boolean(revealed.consistency) })) {
          addConcern(concern.severity, concern.text);
        }
      }
    }

    if (revealed.consistency) {
      const runny = ["watery", "runny gel", "syrupy", "loose jelly", "mucous", "foamy", "grainy slurry"];
      const brittle = ["crystalline gel", "brittle jelly", "clay-like"];
      if (runny.includes(profile.consistency)) {
        if (type.gap >= 60) {
          addConcern("severe", `Runny body can escape through the container gaps.`);
        } else if (containerEffectiveSeal(container) < 50) {
          addConcern("major", `Runny body strains the weak seal.`);
        } else if (containerEffectiveSeal(container) < 75) {
          addConcern("minor", `Runny body may seep if stressed.`);
        }
      }
      if (brittle.includes(profile.consistency) && type.comfort < 55) {
        addConcern("moderate", `Brittle body may chip against the hard interior.`);
      }
    }

    if (revealed.shape && ["puddle", "flat sheet"].includes(profile.shape)) {
      if (type.gap >= 50) {
        addConcern("major", `${profile.shape} form needs a tighter enclosure.`);
      } else if (containerEffectiveSeal(container) < 55) {
        addConcern("minor", `${profile.shape} form benefits from a better seal.`);
      }
    }

    if (revealed.appendages && profile.appendages !== "none") {
      if (type.gap >= 60) {
        addConcern("moderate", `Appendages may reach or snag through large gaps.`);
      }
      if (["spines", "hook claws"].includes(profile.appendages) && type.durability < 55) {
        addConcern("moderate", `${profile.appendages} can score fragile interiors.`);
      }
    }

    if (revealed.element) {
      const element = profile.element;
      const elementalThreats = {
        acid: ["acid exposure", ["acid"], "acid"],
        flame: ["flame exposure", ["flame", "heat"], "flame"],
        frost: ["frost exposure", ["frost", "cold"], "frost"],
        storm: ["storm charge", ["storm", "electric"], "storm"],
        poison: ["poison seepage", ["poison", "toxic", "fume"], "poison"],
        dream: ["arcane seepage", ["mana", "arcane", "dream"], "mana"],
        ether: ["ether seepage", ["mana", "arcane", "ether"], "mana"],
        gravity: ["gravity strain", ["weight", "gravity"], "mana"]
      };
      if (elementalThreats[element]) {
        addThreat(...elementalThreats[element]);
      }
      if (["metal", "stone"].includes(element) && profile.weightKg > type.maxWeightKg * 0.8 && !containerProtectsAny(container, ["weight"])) {
        addConcern("minor", `${element} affinity may become a load problem at full mass.`);
      }
    }

    if (revealed.byproduct) {
      const byproduct = baseOutcomeLabel(evaluated.traits.byproduct);
      if (["acid droplets", "sterile solvent", "alkaline foam"].includes(byproduct)) {
        addThreat("corrosive byproduct", ["acid"], "acid");
      }
      if (["smoke vapor", "numbing paste"].includes(byproduct)) {
        addThreat("toxic byproduct", ["poison", "fume"], "poison");
      }
      if (["mana dew"].includes(byproduct)) {
        addThreat("arcane byproduct", ["mana", "arcane"], "mana");
      }
      if (["cooling brine"].includes(byproduct)) {
        addThreat("cold brine", ["frost", "cold"], "frost");
      }
      if (["adhesive gel", "black resin", "grease pearls", "coagulating wax"].includes(byproduct) && !type.drainage) {
        addConcern("minor", `${byproduct} may foul containers without drainage.`);
      }
    }

    if (revealed.stability) {
      const risk = Number(evaluated.traits.stability.meta?.risk) || 5;
      if (risk >= 7 && type.durability < 50) {
        addConcern("moderate", `High containment risk and fragile material are a poor mix.`);
      } else if (risk >= 7) {
        addConcern("minor", `High containment risk warrants monitoring.`);
      }
    }

    const label = score >= 80 ? "Good Fit"
      : score >= 60 ? "Questionable"
        : score >= 35 ? "Poor Fit"
          : "Unsuitable";
    const className = score >= 80 ? "container-band-good"
      : score >= 60 ? "container-band-questionable"
        : score >= 35 ? "container-band-poor"
          : "container-band-unsuitable";
    return {
      label,
      className,
      reasons: reasons.length ? reasons.slice(0, 4) : ["No obvious conflicts among discovered traits."]
    };
  }

  function physicalContainerFitBands() {
    return ["Comfortable", "Serviceable", "Tight", "Cramped", "Strained", "Overfilled"];
  }

  function physicalContainerFitBandIndex(label) {
    const bands = physicalContainerFitBands();
    const index = bands.indexOf(label);
    return index >= 0 ? index : 1;
  }

  function physicalContainerFitWorseBand(a, b) {
    const bands = physicalContainerFitBands();
    return bands[Math.max(physicalContainerFitBandIndex(a), physicalContainerFitBandIndex(b))] || b || a || "Serviceable";
  }

  function physicalContainerFitBandFromRatio(ratio) {
    if (!Number.isFinite(ratio)) return "Serviceable";
    if (ratio > 1) return "Overfilled";
    if (ratio > 0.85) return "Strained";
    if (ratio > 0.68) return "Cramped";
    if (ratio > 0.48) return "Tight";
    if (ratio > 0.22) return "Serviceable";
    return "Comfortable";
  }

  function physicalContainerFitBandFromSeverity(severity) {
    return { minor: "Tight", moderate: "Cramped", major: "Strained", severe: "Overfilled" }[severity] || "Serviceable";
  }

  function physicalContainerFitClassName(range) {
    const highIndex = physicalContainerFitBandIndex(range?.high);
    if (highIndex >= physicalContainerFitBandIndex("Overfilled")) return "container-band-unsuitable";
    if (highIndex >= physicalContainerFitBandIndex("Strained")) return "container-band-poor";
    if (highIndex >= physicalContainerFitBandIndex("Cramped")) return "container-band-questionable";
    return "container-band-good";
  }

  function physicalContainerFitPrediction(slime, container) {
    const bands = physicalContainerFitBands();
    if (!slime || !container) {
      const confidence = predictionConfidenceFromContext({
        unknownFactors: ["specimen", "container"],
        skillIds: ["observation", "slimeHandling", "physiology", "materialsAnalysis"]
      });
      return {
        range: { low: bands[0], high: bands[bands.length - 1] },
        confidence,
        knownFactors: [],
        concerns: [],
        unknownFactors: ["specimen", "container"],
        className: "container-band-unknown"
      };
    }
    if (container.type === "synthesis") {
      const confidence = {
        label: "Strong",
        factors: [
          "the synthesis tube is built for temporary universal containment",
          "relevant skills: temporary tube design is already known"
        ]
      };
      return {
        range: { low: "Comfortable", high: "Comfortable" },
        confidence,
        knownFactors: ["synthesis tube is designed for temporary universal fit"],
        concerns: [],
        unknownFactors: [],
        className: "container-band-good"
      };
    }

    const evaluated = evaluateGenome(slime.genome);
    const profile = physicalProfile(slime.genome, evaluated);
    const type = containerTypeDef(container.typeId);
    const revealed = slime.revealed || {};
    const unknownFactors = [];
    const knownFactors = [];
    const concerns = [];
    let baseBand = type.comfort >= 75 ? "Comfortable" : type.comfort >= 50 ? "Serviceable" : type.comfort >= 30 ? "Tight" : "Cramped";

    if (!revealed.size) {
      unknownFactors.push("current body volume", "adult size");
    } else if (profile) {
      const massFraction = clamp(slimeStat(slime, "currentMass").current, 1, 100) / 100;
      const currentVolume = profile.volumeCm3 * massFraction;
      const currentRatio = currentVolume / Math.max(1, Number(type.capacityCm3) || 1);
      const fullRatio = profile.volumeCm3 / Math.max(1, Number(type.capacityCm3) || 1);
      const currentBand = physicalContainerFitBandFromRatio(currentRatio);
      const fullBand = physicalContainerFitBandFromRatio(fullRatio);
      baseBand = physicalContainerFitWorseBand(baseBand, currentBand);
      baseBand = physicalContainerFitWorseBand(baseBand, fullBand);
      knownFactors.push(`current body uses about ${formatNumber(currentRatio * 100)}% of ${type.label} capacity`);
      if (fullRatio > currentRatio + 0.15) {
        knownFactors.push(`full-size body could use about ${formatNumber(fullRatio * 100)}% of capacity`);
      }
      if (currentBand === "Overfilled") {
        concerns.push("current body exceeds container capacity");
      } else if (currentBand === "Strained") {
        concerns.push("current body nearly fills the container");
      }
      if (fullBand === "Overfilled") {
        concerns.push("full-size body could outgrow the container");
      } else if (fullBand === "Strained") {
        concerns.push("full-size body may leave little physical margin");
      }
    }

    if (!revealed.shape) {
      unknownFactors.push("body shape");
    }
    if (!revealed.consistency) {
      unknownFactors.push("body flexibility");
    }
    if (revealed.shape && profile) {
      const dimensionalConcerns = containerDimensionalSuitabilityConcerns(slime, container, profile, { consistencyKnown: Boolean(revealed.consistency) });
      for (const concern of dimensionalConcerns) {
        const band = physicalContainerFitBandFromSeverity(concern.severity);
        baseBand = physicalContainerFitWorseBand(baseBand, band);
        concerns.push(concern.text);
      }
      if (!dimensionalConcerns.length) {
        knownFactors.push("known body shape has no obvious dimensional conflict");
      }
    }

    if (revealed.size && revealed.shape && profile) {
      const massFraction = clamp(slimeStat(slime, "currentMass").current, 1, 100) / 100;
      const currentWeight = profile.weightKg * massFraction;
      const weightLimit = containerEffectiveWeightLimit(container);
      if (currentWeight > weightLimit) {
        baseBand = physicalContainerFitWorseBand(baseBand, "Overfilled");
        concerns.push("current weight exceeds the container load limit");
      } else if (profile.weightKg > weightLimit) {
        baseBand = physicalContainerFitWorseBand(baseBand, "Strained");
        concerns.push("full-size weight may exceed the container load limit");
      } else {
        knownFactors.push("known weight is within the container load limit");
      }
    }

    if (type.comfort < 35) {
      concerns.push(`${type.label} has a harsh or cramped interior`);
    } else if (type.comfort >= 75) {
      knownFactors.push(`${type.label} has a forgiving interior`);
    }

    const uniqueUnknown = [...new Set(unknownFactors)].slice(0, 6);
    const uniqueKnown = [...new Set(knownFactors)].slice(0, 6);
    const uniqueConcerns = [...new Set(concerns)].slice(0, 6);
    const confidence = predictionConfidenceFromContext({
      unknownFactors: uniqueUnknown,
      knownFactors: uniqueKnown,
      concerns: uniqueConcerns,
      clearEvidence: uniqueKnown.length * 10 + uniqueConcerns.length * 8,
      skillIds: ["observation", "slimeHandling", "physiology", "materialsAnalysis"]
    });
    const range = predictionRangeFromBand(bands, baseBand, confidence.label, {
      unknownLow: "Comfortable",
      unknownHigh: "Overfilled"
    });
    return {
      range,
      confidence,
      knownFactors: uniqueKnown,
      concerns: uniqueConcerns,
      unknownFactors: uniqueUnknown,
      className: physicalContainerFitClassName(range)
    };
  }

  function physicalContainerFitTooltip(prediction) {
    const lines = [
      `Physical fit range: ${predictionRangeText(prediction?.range)}.`,
      "Physical fit estimates size, shape, space, opening, weight, and comfort. It is not escape risk."
    ];
    if (prediction?.knownFactors?.length) {
      lines.push(`Known fit factors: ${prediction.knownFactors.join(" · ")}.`);
    }
    if (prediction?.concerns?.length) {
      lines.push(`Fit concerns lowering or widening the range: ${prediction.concerns.join(" · ")}.`);
    }
    if (prediction?.unknownFactors?.length) {
      lines.push(`Unknown factors widening the range: ${prediction.unknownFactors.join(", ")}.`);
    }
    lines.push(predictionConfidenceTooltip(prediction?.confidence));
    return lines.join("\n");
  }

  function physicalContainerFitPredictionEl(slime, container) {
    const prediction = physicalContainerFitPrediction(slime, container);
    const line = document.createElement("div");
    line.className = "container-physical-fit-prediction";
    line.title = physicalContainerFitTooltip(prediction);
    line.dataset.physicalFitRange = predictionRangeText(prediction.range);
    line.dataset.physicalFitConfidence = prediction.confidence.label;
    const rangeSpan = document.createElement("span");
    rangeSpan.className = prediction.className;
    rangeSpan.textContent = `Physical fit: ${predictionRangeText(prediction.range)}`;
    rangeSpan.title = physicalContainerFitTooltip(prediction);
    const confidenceSpan = document.createElement("span");
    confidenceSpan.textContent = `Confidence: ${prediction.confidence.label}`;
    confidenceSpan.title = predictionConfidenceTooltip(prediction.confidence);
    line.append(rangeSpan, document.createTextNode(" | "), confidenceSpan);
    return line;
  }


  function containerById(containerId) {
    state.containers = normalizeContainers(state.containers);
    return state.containers.find((container) => container.id === containerId) || null;
  }

  function synthesisTube() {
    return containerById(SYNTHESIS_TUBE_ID) || normalizeContainers(state.containers).find((container) => container.type === "synthesis") || null;
  }

  function permanentContainers() {
    state.containers = normalizeContainers(state.containers);
    return state.containers.filter((container) => container.type === "basic");
  }

  function containerOccupants(containerId) {
    return (state.slimes || [])
      .filter((slime) => slime.status !== "dead" && slime.status !== "released" && slime.containerId === containerId);
  }

  function synthesisTubeOccupants() {
    const tube = synthesisTube();
    return tube ? containerOccupants(tube.id) : [];
  }

  function synthesisTubeOccupied() {
    const tube = synthesisTube();
    return Boolean(tube && (synthesisTubeOccupants().length > 0 || containerCorpses(tube.id).length > 0));
  }

  function openPermanentContainers() {
    return permanentContainers().filter((container) => !isContainerInTransit(container.id) && containerOccupants(container.id).length === 0 && containerCorpses(container.id).length === 0);
  }

  function firstOpenPermanentContainer() {
    return openPermanentContainers()[0] || null;
  }

  function occupiedPermanentContainerCount() {
    return permanentContainers().filter((container) => containerOccupants(container.id).length > 0 || containerCorpses(container.id).length > 0).length;
  }

  function releasedSlimeCount() {
    return (state.slimes || []).filter((slime) => slime.status === "released").length;
  }

  function isInSynthesisTube(slime) {
    return Boolean(slime && slime.status !== "dead" && slime.containerId === SYNTHESIS_TUBE_ID);
  }


  function containerLabelForSlime(slime) {
    return slimeLocationLabel(slime);
  }


  function assignSlimeToContainer(slime, containerId) {
    const container = containerById(containerId);
    if (!slime || slime.status === "dead" || !container) {
      return false;
    }
    slime.status = "contained";
    slime.containerId = container.id;
    slime.roomId = container.roomId || MAIN_ROOM_ID;
    if (container.type === "synthesis") {
      slime.job = "idle";
      slime.jobProgress = 0;
      slime.jobTargetCorpseId = null;
      slime.jobNutritionGained = 0;
    }
    return true;
  }


  function releaseSlime(slime) {
    if (!slime || slime.status === "dead") {
      return false;
    }
    const previousRoomId = slimeEffectiveRoomId(slime);
    slime.status = "released";
    slime.containerId = null;
    slime.roomId = previousRoomId || slime.roomId || MAIN_ROOM_ID;
    slime.job = "idle";
    slime.jobProgress = 0;
    slime.jobTargetCorpseId = null;
    slime.jobNutritionGained = 0;
    slime.roomActivity = { type: "emerging", label: "adjusting to the room", roomId: slime.roomId, updatedAt: state.clock };
    return true;
  }






  function slimeStateLabel(slime) {
    if (!slime || slime.status === "dead") {
      return "dead";
    }
    return slimeIsUncontained(slime) ? "uncontained" : "contained";
  }

  function slimeLocationLabel(slime) {
    if (!slime || slime.status === "dead") {
      return "Dead";
    }
    if (slimeIsUncontained(slime)) {
      return `Location: ${roomName(slime.roomId || MAIN_ROOM_ID)}`;
    }
    const container = containerById(slime.containerId);
    return `Contained in ${container?.name || "unknown container"}`;
  }

  function slimeRoomLabel(slime) {
    if (!slime || slime.status === "dead" || slimeIsUncontained(slime)) {
      return "";
    }
    return `Room: ${roomName(slimeEffectiveRoomId(slime))}`;
  }


  function slimeHuntingInclination(slime) {
    const hints = slime?.roomBehavior || slime?.outOfContainerBehavior || {};
    if (hints.hunting === true || hints.seeksPrey === true || hints.predatory === true) {
      return true;
    }
    if (hints.hunting === false || hints.seeksPrey === false || hints.predatory === false) {
      return false;
    }
    if (/pred/i.test(String(slime?.name || ""))) {
      return true;
    }
    const behavior = String(evaluateGenome(slime.genome).traits.behavior?.label || "").toLowerCase();
    return /hunt|ambush|predator|prey|vibration/.test(behavior);
  }




  function slimeContaminationTraitInfo(slime) {
    const evaluated = evaluateGenome(slime.genome);
    const behavior = String(evaluated.traits.behavior?.label || "").toLowerCase();
    const byproduct = String(evaluated.traits.byproduct?.label || "").toLowerCase();
    const consistency = String(evaluated.traits.consistency?.label || "").toLowerCase();
    const stability = String(evaluated.traits.stability?.label || "").toLowerCase();
    const tags = new Set(evaluated.traits.sustenance?.meta?.tags || []);
    const profile = environmentalSustenanceProfile(slime);
    const hints = slime.roomBehavior || slime.outOfContainerBehavior || {};

    const traitSeeksContamination = Boolean(
      behavior.includes("cleaning") ||
      tags.has("contaminated") ||
      tags.has("waste") ||
      tags.has("hazardous") ||
      tags.has("chemical") ||
      tags.has("fume") ||
      profile?.attributeKey === "contamination"
    );
    const traitEatsContamination = Boolean(
      tags.has("contaminated") ||
      tags.has("waste") ||
      tags.has("hazardous") ||
      tags.has("fume") ||
      profile?.attributeKey === "contamination"
    );
    const traitSpreadsContamination = Boolean(
      /slime|mucus|tar|foam|ooze|acid|fume|poison|waste|residue|volatile|unstable/.test(`${byproduct} ${consistency} ${stability}`)
    );

    const seeksContamination = hints.seeksContamination === false || hints.contaminationSeeking === false
      ? false
      : hints.seeksContamination === true || hints.contaminationSeeking === true || traitSeeksContamination;
    const eatsContamination = hints.eatsContamination === false || hints.contaminationEating === false
      ? false
      : hints.eatsContamination === true || hints.contaminationEating === true || traitEatsContamination;
    const spreadsContamination = hints.leavesResidue === false || hints.spreadsContamination === false
      ? false
      : hints.leavesResidue === true || hints.spreadsContamination === true || traitSpreadsContamination;

    return {
      seeksContamination,
      eatsContamination,
      spreadsContamination,
      behavior,
      byproduct,
      consistency,
      stability,
      tags,
      profile
    };
  }




  function slimeActivityLabel(slime) {
    if (!slime || slime.status === "dead") {
      return "Activity: dead";
    }
    if (!slimeIsUncontained(slime)) {
      if (slime.job && slime.job !== "idle") {
        if (slime.job === "cleanup") {
          return "Activity: contained; intended cleanup use";
        }
        return `Activity: ${creatureJobLabel(slime.job)}`;
      }
      const container = containerById(slime.containerId);
      if (container && isContainerInTransit(container.id)) {
        return "Activity: in transit";
      }
      if (container) {
        const risk = activeContainmentRisk(slime, container);
        if (/Dangerous|Failing/i.test(risk.label)) {
          return "Activity: straining containment";
        }
      }
      if (slime.revealed?.sustenance && isEnvironmentalSustenance(slime) && environmentalSustenanceRate(slime) > 0) {
        return "Activity: feeding in containment";
      }
      return "Activity: contained";
    }

    if (slime.roomActivity?.label) {
      const contamination = slimeContaminationTraitInfo(slime);
      if (slime.roomActivity.type === "pressingClosedDoor") {
        return "Activity: pressing against closed door";
      }
      if ((slime.roomActivity.type === "seekingContamination" || slime.roomActivity.type === "feedingOnContamination") && !contamination.seeksContamination && !contamination.eatsContamination && slimeHuntingInclination(slime)) {
        return "Activity: hunting sensed prey";
      }
      return `Activity: ${slime.roomActivity.label}`;
    }
    const contamination = slimeContaminationTraitInfo(slime);
    if (contamination.seeksContamination && contamination.eatsContamination && roomContaminationValue(slime.roomId || MAIN_ROOM_ID) > OUT_OF_CONTAINER_CONTAMINATION_FLOOR) {
      return "Activity: feeding on contamination";
    }
    if (contamination.seeksContamination) {
      return "Activity: seeking contamination";
    }
    if (slimeHuntingInclination(slime)) {
      return "Activity: hunting sensed prey";
    }
    if (contamination.spreadsContamination) {
      return "Activity: leaving residue";
    }
    return "Activity: exploring";
  }


  function handlingPolicy() {
    state.policies = normalizePolicies(state.policies);
    return state.policies.handling;
  }

  function currentHandlingMethodId() {
    return HANDLING_METHOD_BY_ID[handlingPolicy().method] ? handlingPolicy().method : DEFAULT_HANDLING_METHOD;
  }

  function currentHandlingMethod() {
    return HANDLING_METHOD_BY_ID[currentHandlingMethodId()] || HANDLING_METHOD_BY_ID[DEFAULT_HANDLING_METHOD];
  }

  function handlingMethodInventoryInfo(methodId = currentHandlingMethodId()) {
    const itemKey = HANDLING_METHOD_INVENTORY_ITEM_KEYS[methodId];
    if (!itemKey) {
      return null;
    }
    const item = INVENTORY_ITEM_BY_KEY[itemKey];
    if (!item) {
      return null;
    }
    return {
      itemKey,
      item,
      amount: inventoryAmount(itemKey)
    };
  }

  function handlingMethodToolPreviewSummary(methodId = currentHandlingMethodId()) {
    const info = handlingMethodInventoryInfo(methodId);
    if (!info) {
      return "Tool preview: no tool expected";
    }
    return info.amount > 0
      ? `Tool preview: ${info.item.label} available`
      : `Tool preview: ${info.item.label} not stocked`;
  }

  function handlingMethodInventorySummary(methodId = currentHandlingMethodId()) {
    const info = handlingMethodInventoryInfo(methodId);
    if (!info) {
      return "Inventory: no cataloged tool";
    }
    return `Inventory: ${formatNumber(info.amount)} ${info.item.label} cataloged in Storage Room`;
  }

  function handlingMethodRequirementSummary(methodId = currentHandlingMethodId()) {
    const info = handlingMethodInventoryInfo(methodId);
    if (!info) {
      return "Requirement: none";
    }
    return info.amount > 0
      ? "Requirement: stocked"
      : "Requirement: blocked until stocked";
  }

  function handlingMethodProtocolSummary(methodId = currentHandlingMethodId()) {
    const info = handlingMethodInventoryInfo(methodId);
    if (!info) {
      return "Protocol: no tool requirement";
    }
    return info.amount > 0
      ? "Protocol: required tool stocked"
      : "Protocol: procedure blocked until tool is stocked";
  }

  function handlingMethodMissingToolReason(methodId = currentHandlingMethodId()) {
    const info = handlingMethodInventoryInfo(methodId);
    if (!info || info.amount > 0) {
      return "";
    }
    return `Procedure blocked: ${info.item.label} not stocked in Storage Room.`;
  }

  function handlingMethodInventoryTitle(methodId = currentHandlingMethodId()) {
    const method = HANDLING_METHOD_BY_ID[methodId] || HANDLING_METHOD_BY_ID[DEFAULT_HANDLING_METHOD];
    const info = handlingMethodInventoryInfo(method.id);
    if (!info) {
      return [
        "Tool preview: no tool expected.",
        `${method.label} has no Storage Room tool entry.`,
        "Protocol: no tool requirement.",
        "No inventory gate applies to this handling method."
      ].join("\n");
    }
    const lines = [
      `${handlingMethodToolPreviewSummary(method.id)}.`,
      `${info.item.label}: ${formatNumber(info.amount)} cataloged in the Storage Room.`,
      `${handlingMethodProtocolSummary(method.id)}.`,
      `${handlingMethodRequirementSummary(method.id)}.`,
      "Tool requirements are enforced for this handling method.",
      "Tools are reusable and are not consumed."
    ];
    const missing = handlingMethodMissingToolReason(method.id);
    if (missing) {
      lines.push(missing);
    }
    return lines.join("\n");
  }

  function handlingMethodActionTitle(methodId = currentHandlingMethodId()) {
    const method = HANDLING_METHOD_BY_ID[methodId] || HANDLING_METHOD_BY_ID[DEFAULT_HANDLING_METHOD];
    return `${method.label}: ${method.description}\n${handlingMethodToolPreviewSummary(method.id)}. ${handlingMethodInventorySummary(method.id)}. ${handlingMethodProtocolSummary(method.id)}. ${handlingMethodRequirementSummary(method.id)}.\n${handlingMethodInventoryTitle(method.id)}`;
  }

  function setHandlingMethod(methodId) {
    state.policies = normalizePolicies(state.policies);
    state.policies.handling.method = HANDLING_METHOD_BY_ID[methodId] ? methodId : DEFAULT_HANDLING_METHOD;
    addEvent(`Handling method set to ${currentHandlingMethod().label}.`);
    persist();
    render();
  }

  function slimeTraitKnown(slime, traitKey) {
    return Boolean(slime?.revealed?.[traitKey] || slime?.measured?.[traitKey]);
  }

  function slimeHandlingExperience(slime) {
    return Math.max(0, Number(slime?.handlingInjuryExperience) || 0);
  }

  function handlingKnowledgeConfidence(container) {
    const occupants = containerOccupants(container.id);
    const unknownFactors = [];
    const knownFactors = [];
    let unknownMajor = 0;
    let knownMajor = 0;

    const condition = containerCondition(container);
    if (condition <= 25) {
      knownFactors.push("container condition is critical");
      knownMajor += 1;
    } else if (condition <= 50) {
      knownFactors.push("container condition is damaged");
      knownMajor += 1;
    } else if (condition <= 75) {
      knownFactors.push("container condition is worn");
    }

    if (isPitHoleContainer(container)) {
      knownFactors.push("pit-hole access is awkward");
    }

    for (const slime of occupants) {
      const stress = slimeStat(slime, "stress").current;
      if (stress >= 80) {
        knownFactors.push(`${slime.name} is highly stressed`);
        knownMajor += 1;
      } else if (stress >= 50) {
        knownFactors.push(`${slime.name} is stressed`);
      }

      const evaluated = evaluateGenome(slime.genome);
      if (slimeTraitKnown(slime, "behavior")) {
        const behavior = evaluated.traits.behavior?.id || "";
        if (["predatory", "vibrational", "territorial"].includes(behavior)) {
          knownFactors.push(`${slime.name} has a dangerous known behavior`);
          knownMajor += 1;
        } else {
          knownFactors.push(`${slime.name}'s behavior has been observed`);
        }
      } else {
        unknownFactors.push("creature behavior");
        unknownMajor += 1;
      }

      if (slimeTraitKnown(slime, "appendages")) {
        const appendages = evaluated.traits.appendages?.id || "";
        if (appendages && appendages !== "none") {
          knownFactors.push("reaching appendages");
          knownMajor += 1;
        } else {
          knownFactors.push("no major appendages observed");
        }
      } else {
        unknownFactors.push("appendages");
        unknownMajor += 1;
      }

      if (slimeTraitKnown(slime, "stability")) {
        knownFactors.push("stability has been tested");
        knownMajor += 1;
      } else {
        unknownFactors.push("stability");
        unknownMajor += 1;
      }

      if (!slimeTraitKnown(slime, "element") && !slimeTraitKnown(slime, "byproduct")) {
        unknownFactors.push("contact hazards");
        unknownMajor += 1;
      } else {
        knownFactors.push("some hazard traits are known");
      }

      if (slimeHandlingExperience(slime) > 0) {
        // Prior injury from this exact slime is high-value knowledge and should
        // remain visible even when other known factors are also present.
        knownFactors.unshift(`prior handling injury from ${slime.name}`);
        knownMajor += 2;
      }
    }

    const skill = skillLevel("slimeHandling");
    const expert = skill >= 30;
    const experienced = occupants.some((slime) => slimeHandlingExperience(slime) > 0);
    let certainty = "unknown";
    if (expert || experienced || unknownMajor <= 1) {
      certainty = "high";
    } else if (unknownMajor <= 3 && knownMajor >= 1) {
      certainty = "partial";
    }

    return {
      certainty,
      skill,
      expert,
      experienced,
      unknownMajor,
      knownMajor,
      knownFactors: [...new Set(knownFactors)].slice(0, 5),
      unknownFactors: [...new Set(unknownFactors)].slice(0, 5)
    };
  }

  function handlingMethodRiskAdjustment(container, methodId) {
    const method = HANDLING_METHOD_BY_ID[methodId] || HANDLING_METHOD_BY_ID[DEFAULT_HANDLING_METHOD];
    let adjustment = 0;
    const notes = [];

    if (method.id === "thickGloves") {
      adjustment -= 8;
      notes.push("gloves reduce contact and contamination risk");
      if (containerCorpses(container.id).length) {
        adjustment -= 6;
        notes.push("gloves help with corpse contamination");
      }
    } else if (method.id === "longTongs") {
      adjustment -= 10;
      notes.push("tongs add distance from contact and strikes");
      if (containerContentsCount(container) > 1) {
        adjustment += 4;
        notes.push("tongs are awkward with crowded contents");
      }
      if (isPitHoleContainer(container)) {
        adjustment += 4;
        notes.push("tongs are awkward over deep pits");
      }
    } else if (method.id === "hookPole") {
      if (isPitHoleContainer(container)) {
        adjustment -= 12;
        notes.push("hook pole helps with pit covers and grates");
      } else {
        adjustment += 3;
        notes.push("hook pole is clumsy for ordinary containers");
      }
    } else if (method.id === "scraper") {
      if (containerCorpses(container.id).length) {
        adjustment -= 12;
        notes.push("scraper improves control over corpse residue");
      } else {
        adjustment += 4;
        notes.push("scraper is poor for live handling");
      }
    } else {
      notes.push("bare hands offer no protection");
    }

    return {
      adjustment,
      notes,
      method
    };
  }

  function qualitativeHarmEstimate(score, certainty) {
    if (certainty === "unknown") {
      return "cannot estimate safely";
    }
    if (certainty === "partial") {
      if (score >= 55) {
        return "serious to lethal harm possible";
      }
      if (score >= 35) {
        return "moderate to serious harm possible";
      }
      if (score >= 15) {
        return "minor to moderate harm possible";
      }
      return "minor harm possible";
    }
    if (score >= 55) {
      return "serious to lethal harm likely";
    }
    if (score >= 35) {
      return "serious harm possible";
    }
    if (score >= 15) {
      return "moderate harm possible";
    }
    return "no obvious harm expected";
  }

  function visibleHandlingRiskBand(score, certainty) {
    if (certainty === "unknown") {
      return "Unknown";
    }
    if (certainty === "partial") {
      return "Uncertain";
    }
    if (score >= 55) {
      return "Severe";
    }
    if (score >= 35) {
      return "Dangerous";
    }
    if (score >= 15) {
      return "Risky";
    }
    return "Low";
  }

  function containerAlwaysOpen(container) {
    return container?.typeId === "openDirtPit";
  }

  function containerAccessOpen(container) {
    if (!container || container.type === "synthesis") {
      return false;
    }
    return containerAlwaysOpen(container) || Boolean(container.isOpen);
  }

  function containerAccessLabel(container) {
    if (containerAlwaysOpen(container)) {
      return "open by design";
    }
    return containerAccessOpen(container) ? "open" : "closed";
  }

  function containerInteractionTask(containerId) {
    return (state.tasks || []).find((task) => task.type === "containerInteraction" && task.data?.containerId === containerId) || null;
  }


  function containerHandlingRisk(container, action = "open", methodId = currentHandlingMethodId()) {
    if (!container || container.type === "synthesis") {
      return {
        band: "None",
        visibleBand: "None",
        certainty: "high",
        className: "container-band-good",
        score: 0,
        damage: 0,
        harmText: "no direct handling risk",
        method: currentHandlingMethod(),
        knownFactors: ["The synthesis tube is not opened by hand in this prototype."],
        unknownFactors: [],
        methodNotes: [],
        reasons: ["The synthesis tube is not opened by hand in this prototype."]
      };
    }

    const occupants = containerOccupants(container.id);
    const corpses = containerCorpses(container.id);
    let score = 0;
    const internalReasons = [];
    const add = (points, text) => {
      score += points;
      internalReasons.push(text);
    };

    if (containerAlwaysOpen(container)) {
      add(6, "this pit is already open by design.");
    }

    if (isPitHoleContainer(container)) {
      add(12, "pit holes require awkward, close-range handling.");
    }

    if (isContainerInTransit(container.id)) {
      add(8, "the container is already in transit.");
    }

    const condition = containerCondition(container);
    if (condition <= 25) {
      add(14, "container condition is critical.");
    } else if (condition <= 50) {
      add(8, "container condition is damaged.");
    } else if (condition <= 75) {
      add(4, "container condition is worn.");
    }

    if (!occupants.length && !corpses.length) {
      add(0, "the container is empty.");
    }

    for (const slime of occupants) {
      const risk = activeContainmentRisk(slime, container);
      if (/Failing/i.test(risk.label)) {
        add(30, `${slime.name} has high active containment risk.`);
      } else if (/Dangerous/i.test(risk.label)) {
        add(22, `${slime.name} has high active containment risk.`);
      } else if (/Strained/i.test(risk.label)) {
        add(12, `${slime.name} has strained active containment risk.`);
      } else if (/Watch/i.test(risk.label)) {
        add(6, `${slime.name} needs monitoring.`);
      }
      const stress = slimeStat(slime, "stress").current;
      if (stress >= 80) {
        add(12, `${slime.name} is highly stressed.`);
      } else if (stress >= 50) {
        add(6, `${slime.name} is stressed.`);
      }
      const evaluated = evaluateGenome(slime.genome);
      const behavior = evaluated.traits.behavior?.id || "";
      if (["predatory", "vibrational", "territorial"].includes(behavior)) {
        add(10, `${slime.name} may react violently to handling.`);
      }
      const appendages = evaluated.traits.appendages?.id || "";
      if (appendages && appendages !== "none") {
        add(6, `${slime.name} has appendages that can reach the opening.`);
      }
    }

    for (const corpse of corpses) {
      const freshness = corpseFreshness(corpse);
      if (freshness === "ruined") {
        add(10, `${corpse.name} remains are ruined and hazardous.`);
      } else if (freshness === "spoiled") {
        add(7, `${corpse.name} remains are spoiled.`);
      } else if (freshness === "decaying") {
        add(4, `${corpse.name} remains are decaying.`);
      } else {
        add(2, `${corpse.name} remains still carry contamination risk.`);
      }
    }

    const methodAdjustment = handlingMethodRiskAdjustment(container, methodId);
    score = Math.max(0, score + methodAdjustment.adjustment);

    if (action === "close") {
      score = Math.max(0, Math.round(score * 0.45));
      internalReasons.unshift("Closing is safer than opening but still requires direct contact.");
    }

    let band = "Low";
    let className = "container-band-good";
    let damage = 0;
    if (score >= 55) {
      band = "Severe";
      className = "container-band-bad";
      damage = action === "close" ? 12 : 24;
    } else if (score >= 35) {
      band = "Dangerous";
      className = "container-band-bad";
      damage = action === "close" ? 6 : 12;
    } else if (score >= 15) {
      band = "Risky";
      className = "container-band-watch";
      damage = action === "close" ? 2 : 4;
    }

    const confidence = handlingKnowledgeConfidence(container);
    const visibleBand = visibleHandlingRiskBand(score, confidence.certainty);
    const harmText = qualitativeHarmEstimate(score, confidence.certainty);

    return {
      band,
      visibleBand,
      certainty: confidence.certainty,
      className,
      score,
      damage,
      harmText,
      method: methodAdjustment.method,
      knownFactors: confidence.knownFactors.length ? confidence.knownFactors : ["no major known hazards"],
      unknownFactors: confidence.unknownFactors,
      methodNotes: methodAdjustment.notes,
      reasons: internalReasons.length ? internalReasons : ["No obvious handling danger."]
    };
  }

  function handlingRiskPredictionBands() {
    return ["Low", "Risky", "Dangerous", "Severe"];
  }

  function handlingHarmPredictionBands() {
    return ["No obvious harm", "Minor", "Moderate", "Serious", "Lethal"];
  }

  function handlingHarmBandFromScore(score) {
    if (score >= 55) return "Serious";
    if (score >= 35) return "Moderate";
    if (score >= 15) return "Minor";
    return "No obvious harm";
  }

  function directHandlingRiskPrediction(risk) {
    const unknownFactors = Array.isArray(risk?.unknownFactors) ? risk.unknownFactors : [];
    const knownFactors = Array.isArray(risk?.knownFactors) ? risk.knownFactors : [];
    const methodNotes = Array.isArray(risk?.methodNotes) ? risk.methodNotes : [];
    const concerns = [];
    if (methodNotes.length) {
      concerns.push(...methodNotes);
    }
    if (risk?.certainty === "unknown") {
      concerns.push("too many handling hazards are unconfirmed");
    } else if (risk?.certainty === "partial") {
      concerns.push("some handling hazards remain uncertain");
    }
    const confidence = predictionConfidenceFromContext({
      unknownFactors,
      knownFactors,
      concerns,
      clearEvidence: (knownFactors.length * 10) + (methodNotes.length * 4),
      skillIds: ["observation", "slimeHandling", "physiology"]
    });

    let riskRange;
    let harmRange;
    if (confidence.label === "Unknown" || confidence.label === "Rough") {
      riskRange = { low: "Low", high: "Severe" };
      harmRange = { low: "No obvious harm", high: "Lethal" };
    } else {
      riskRange = predictionRangeFromBand(handlingRiskPredictionBands(), risk?.band || "Low", confidence.label, { unknownLow: "Low", unknownHigh: "Severe" });
      harmRange = predictionRangeFromBand(handlingHarmPredictionBands(), handlingHarmBandFromScore(Number(risk?.score) || 0), confidence.label, { unknownLow: "No obvious harm", unknownHigh: "Lethal" });
    }

    return {
      riskRange,
      harmRange,
      confidence,
      knownFactors,
      unknownFactors,
      methodNotes,
      concerns
    };
  }

  function directHandlingRiskTooltip(prediction, risk) {
    const lines = [
      `Handling risk range: ${predictionRangeText(prediction?.riskRange)}.`,
      `Possible harm range: ${predictionRangeText(prediction?.harmRange)}.`,
      "This is a direct handling assessment, not a guaranteed injury outcome."
    ];
    if (prediction?.knownFactors?.length) {
      lines.push(`Known influences narrowing or shifting the range: ${prediction.knownFactors.join(" · ")}.`);
    }
    if (prediction?.methodNotes?.length) {
      lines.push(`Handling method factors: ${prediction.methodNotes.join(" · ")}.`);
    }
    if (prediction?.unknownFactors?.length) {
      lines.push(`Unknown factors widening the range: ${prediction.unknownFactors.join(", ")}.`);
    }
    lines.push(predictionConfidenceTooltip(prediction?.confidence));
    if (Number.isFinite(risk?.damage)) {
      lines.push("Exact injury damage is not shown as a precise prediction.");
    }
    return lines.join("\n");
  }

  function handlingRiskSummary(container) {
    const action = containerAccessOpen(container) ? "close" : "open";
    const risk = containerHandlingRisk(container, action, currentHandlingMethodId());
    const prediction = directHandlingRiskPrediction(risk);
    return [
      `Handling risk: ${predictionRangeText(prediction.riskRange)}`,
      `Possible harm: ${predictionRangeText(prediction.harmRange)}`,
      `Confidence: ${prediction.confidence.label}`,
      `Method: ${risk.method.label}`,
      handlingMethodToolPreviewSummary(risk.method.id),
      handlingMethodInventorySummary(risk.method.id),
      handlingMethodProtocolSummary(risk.method.id),
      handlingMethodRequirementSummary(risk.method.id)
    ].join(" | ");
  }

  function handlingRiskTitle(container, action = (containerAccessOpen(container) ? "close" : "open"), methodId = currentHandlingMethodId()) {
    const risk = containerHandlingRisk(container, action, methodId);
    const prediction = directHandlingRiskPrediction(risk);
    return directHandlingRiskTooltip(prediction, risk);
  }




  function scientistIsDead() {
    return scientistVital("health").current <= 0 || Boolean(state.runEnded);
  }

  function damageScientistHealth(amount, reason = "direct handling injury") {
    const damage = Math.max(0, Math.round(Number(amount) || 0));
    if (!damage) {
      return false;
    }
    const health = scientistVital("health");
    const before = health.current;
    health.current = clamp(before - damage, 0, health.max);
    addEvent(`Scientist hurt during handling: ${reason}.`);    if (health.current <= 0 && before > 0) {
      state.runEnded = true;
      state.paused = true;
      addEvent("The scientist died. Run ended.");
    }
    return true;
  }

  function containerInteractionBlockReason(container, action) {
    if (!container) {
      return "No container selected.";
    }
    if (scientistIsDead()) {
      return "The scientist is dead.";
    }
    if (container.type === "synthesis") {
      return "The synthesis tube cannot be opened by hand.";
    }
    if (isContainerInTransit(container.id)) {
      return `${container.name} is being hauled.`;
    }
    const existing = containerInteractionTask(container.id);
    if (existing) {
      return `${container.name} is already being handled.`;
    }
    if (action === "open") {
      if (containerAccessOpen(container)) {
        return `${container.name} is already open.`;
      }
    } else if (action === "close") {
      if (containerAlwaysOpen(container)) {
        return `${container.name} has no cover to close.`;
      }
      if (!containerAccessOpen(container)) {
        return `${container.name} is already closed.`;
      }
    } else {
      return "Unknown handling action.";
    }
    return "";
  }

  function startContainerInteraction(containerId, action) {
    const container = containerById(containerId);
    const reason = containerInteractionBlockReason(container, action)
      || handlingMethodMissingToolReason(currentHandlingMethodId());
    if (reason) {
      addEvent(reason);
      persist();
      render();
      return false;
    }
    const interactionLabel = `${action === "close" ? "closing" : "opening"} ${container.name}`;
    if (!confirmPhysicalStateRiskIfNeeded(interactionLabel)) {
      return false;
    }
    const baseCost = action === "close" ? CONTAINER_INTERACTION_CLOSE_STAMINA : CONTAINER_INTERACTION_OPEN_STAMINA;
    const cost = adjustedStaminaCost(baseCost, ["slimeHandling"]);
    if (!spendStamina(cost)) {
      addEvent(`Not enough stamina. ${cost} required.`);
      persist();
      render();
      return false;
    }
    const duration = adjustedDuration(action === "close" ? CONTAINER_INTERACTION_CLOSE_DURATION : CONTAINER_INTERACTION_OPEN_DURATION, "slimeHandling");
    const task = {
      id: `task-${state.nextTaskNumber++}`,
      type: "containerInteraction",
      label: `${action === "close" ? "Close" : "Open"} ${container.name}`,
      createdAt: state.clock,
      dueAt: state.clock + duration,
      data: {
        containerId: container.id,
        action,
        methodId: currentHandlingMethodId(),
        staminaCost: cost
      }
    };
    state.tasks.push(task);
    addEvent(`${task.label} started.`);
    persist();
    render();
    return true;
  }


  function completeContainerInteraction(task) {
    const container = containerById(task.data?.containerId);
    const action = task.data?.action;
    const methodId = HANDLING_METHOD_BY_ID[task.data?.methodId] ? task.data.methodId : currentHandlingMethodId();
    const method = HANDLING_METHOD_BY_ID[methodId] || HANDLING_METHOD_BY_ID[DEFAULT_HANDLING_METHOD];
    if (!container) {
      addEvent("Handling could not complete; the container no longer exists.");
      return false;
    }
    if (action === "dumpRemains" || action === "scrapeRemains") {
      return completeRemainsHandling(task, container, action, methodId, method);
    }
    if (action === "transferLivingSlime") {
      return completeLiveSlimeTransfer(task, container, methodId, method);
    }
    if (action === "open") {
      const risk = containerHandlingRisk(container, "open", methodId);
      container.isOpen = true;
      const occupants = containerOccupants(container.id);
      for (const slime of occupants) {
        adjustSlimeStat(slime, "stress", 6 + Math.min(14, Math.round(risk.score / 5)));
      }
      if (risk.damage > 0) {
        damageScientistHealth(risk.damage, `${risk.band.toLowerCase()} handling while opening ${container.name} with ${method.label}`);
        for (const slime of occupants) {
          slime.handlingInjuryExperience = Math.max(0, Number(slime.handlingInjuryExperience) || 0) + 1;
        }
      }
      addEvent(`${container.name} opened with ${method.label}. Handling risk ${risk.visibleBand}.`);
      return true;
    }
    if (action === "close") {
      const risk = containerHandlingRisk(container, "close", methodId);
      container.isOpen = false;
      const occupants = containerOccupants(container.id);
      for (const slime of occupants) {
        adjustSlimeStat(slime, "stress", 2);
      }
      if (risk.damage > 0) {
        damageScientistHealth(risk.damage, `${risk.band.toLowerCase()} handling while closing ${container.name} with ${method.label}`);
        for (const slime of occupants) {
          slime.handlingInjuryExperience = Math.max(0, Number(slime.handlingInjuryExperience) || 0) + 1;
        }
      }
      addEvent(`${container.name} closed with ${method.label}. Handling risk ${risk.visibleBand}.`);
      return true;
    }
    addEvent("Handling could not complete; unknown action.");
    return false;
  }





  function liveTransferActionLabel() {
    return "Transfer Living Slime";
  }

  function liveTransferDestinationAcceptsLiveSlime(container) {
    if (!container || isContainerInTransit(container.id) || containerContentsCount(container) > 0) {
      return false;
    }
    // Pit holes are handled as destination sites during the transfer action.
    // Covered pits can be opened as part of the task; they should still be selectable.
    return isPitHoleContainer(container) || containerAccessOpen(container);
  }

  function liveTransferSourceAllowsDirectHandling(container) {
    if (!container) {
      return false;
    }
    // A living slime already in a pit hole can be extracted by working the pit cover/site,
    // even if the pit is not represented as a normal open container.
    return isPitHoleContainer(container) || containerAccessOpen(container);
  }

  function liveTransferDestinationCandidates(sourceContainer) {
    if (!sourceContainer) {
      return [];
    }
    const sourceRoomId = sourceContainer.roomId || MAIN_ROOM_ID;
    return permanentContainers()
      .filter((container) => container.id !== sourceContainer.id)
      .filter((container) => container.roomId === sourceRoomId)
      .filter(liveTransferDestinationAcceptsLiveSlime)
      .sort((a, b) => {
        const aPit = isPitHoleContainer(a) ? 0 : 1;
        const bPit = isPitHoleContainer(b) ? 0 : 1;
        return aPit - bPit || String(a.name).localeCompare(String(b.name));
      });
  }

  function liveTransferBlockReason(sourceContainer, destinationContainerId = "") {
    if (!sourceContainer) {
      return "No source container selected.";
    }
    if (scientistIsDead()) {
      return "The scientist is dead.";
    }
    if (sourceContainer.type === "synthesis") {
      return "Move the slime out of the synthesis tube before direct transfer.";
    }
    if (isContainerInTransit(sourceContainer.id)) {
      return `${sourceContainer.name} is being hauled.`;
    }
    if (!liveTransferSourceAllowsDirectHandling(sourceContainer)) {
      return "Open the source container before transferring a living slime.";
    }
    if (containerCorpses(sourceContainer.id).length > 0) {
      return "Remove corpse remains before transferring a living slime.";
    }
    const occupants = containerOccupants(sourceContainer.id);
    if (!occupants.length) {
      return "No living slime is in this container.";
    }
    if (occupants.length > 1) {
      return "Separate crowded contents before direct living transfer.";
    }
    if (containerInteractionTask(sourceContainer.id)) {
      return `${sourceContainer.name} is already being handled.`;
    }
    const candidates = liveTransferDestinationCandidates(sourceContainer);
    if (!candidates.length) {
      return "No open same-room destination container is available.";
    }
    const destination = containerById(destinationContainerId) || candidates[0];
    if (!destination) {
      return "No destination container selected.";
    }
    if (destination.id === sourceContainer.id) {
      return "Choose a different destination container.";
    }
    if (destination.roomId !== sourceContainer.roomId) {
      return "Direct living transfer requires a same-room destination.";
    }
    if (isContainerInTransit(destination.id)) {
      return `${destination.name} is being hauled.`;
    }
    if (!liveTransferDestinationAcceptsLiveSlime(destination)) {
      return isPitHoleContainer(destination)
        ? `${destination.name} is not empty.`
        : "Open the destination container before transfer.";
    }
    return "";
  }

  function startLiveSlimeTransfer(sourceContainerId, destinationContainerId) {
    const sourceContainer = containerById(sourceContainerId);
    const reason = liveTransferBlockReason(sourceContainer, destinationContainerId)
      || handlingMethodMissingToolReason(currentHandlingMethodId());
    if (reason) {
      addEvent(reason);
      persist();
      render();
      return false;
    }
    const slime = containerOccupants(sourceContainer.id)[0];
    const destination = containerById(destinationContainerId) || liveTransferDestinationCandidates(sourceContainer)[0];
    if (!confirmPhysicalStateRiskIfNeeded(`transferring ${slime.name} from ${sourceContainer.name} to ${destination.name}`)) {
      return false;
    }
    const cost = adjustedStaminaCost(LIVE_TRANSFER_STAMINA, ["slimeHandling"]);
    if (!spendStamina(cost)) {
      addEvent(`Not enough stamina. ${cost} required.`);
      persist();
      render();
      return false;
    }
    const duration = adjustedDuration(LIVE_TRANSFER_DURATION, "slimeHandling");
    const task = {
      id: `task-${state.nextTaskNumber++}`,
      type: "containerInteraction",
      label: `Transfer ${slime.name} from ${sourceContainer.name} to ${destination.name}`,
      createdAt: state.clock,
      dueAt: state.clock + duration,
      data: {
        containerId: sourceContainer.id,
        action: "transferLivingSlime",
        methodId: currentHandlingMethodId(),
        slimeId: slime.id,
        destinationContainerId: destination.id,
        staminaCost: cost
      }
    };
    state.tasks.push(task);
    addEvent(`${task.label} started with ${currentHandlingMethod().label}.`);
    persist();
    render();
    return true;
  }

  function foulContainerAfterLiveTransfer(container, amount = 4) {
    if (!container?.environment?.contamination) {
      return;
    }
    container.environment.contamination.current = clamp((Number(container.environment.contamination.current) || 0) + amount, 0, 100);
  }

  function completeLiveSlimeTransfer(task, sourceContainer, methodId, method) {
    const slime = findSlime(task.data?.slimeId);
    const destination = containerById(task.data?.destinationContainerId);
    if (!slime || slime.status === "dead" || slime.containerId !== sourceContainer.id) {
      addEvent("Living transfer could not complete; the slime is no longer in the source container.");
      return false;
    }
    if (!destination) {
      addEvent("Living transfer could not complete; the destination container no longer exists.");
      return false;
    }
    const reason = liveTransferBlockReason(sourceContainer, destination.id);
    if (reason) {
      addEvent(`Living transfer could not complete: ${reason}`);
      return false;
    }

    const risk = containerHandlingRisk(sourceContainer, "transferLivingSlime", methodId);
    const destinationRisk = isPitHoleContainer(destination) ? 6 : 0;
    const effectiveDamage = Math.max(1, risk.damage + Math.round(destinationRisk / 3));
    if (effectiveDamage > 0) {
      damageScientistHealth(effectiveDamage, `${risk.band.toLowerCase()} living transfer while moving ${slime.name} from ${sourceContainer.name} to ${destination.name} with ${method.label}`);
      slime.handlingInjuryExperience = Math.max(0, Number(slime.handlingInjuryExperience) || 0) + 1;
    }

    adjustSlimeStat(slime, "stress", 10 + Math.min(20, Math.round(risk.score / 4)));
    foulContainerAfterLiveTransfer(sourceContainer, 4);
    foulContainerAfterLiveTransfer(destination, isPitHoleContainer(destination) ? 6 : 4);

    if (isPitHoleContainer(destination) && !containerAlwaysOpen(destination)) {
      destination.isOpen = true;
    }

    slime.containerId = destination.id;
    slime.roomId = destination.roomId || sourceContainer.roomId || MAIN_ROOM_ID;
    slime.status = "contained";
    slime.job = "idle";
    slime.jobProgress = 0;
    slime.jobTargetCorpseId = null;
    slime.jobNutritionGained = 0;

    addEvent(`${slime.name} transferred from ${sourceContainer.name} to ${destination.name} with ${method.label}.`);
    return true;
  }

  function livingContainerOccupantCount(container) {
    return containerOccupants(container?.id).length;
  }

  function availablePitHoleForRemains(count = 1) {
    const needed = Math.max(1, Math.ceil(Number(count) || 1));
    return pitHoleContainers()
      .filter((pit) => containerOccupants(pit.id).length === 0)
      .filter((pit) => pitHoleCorpseCapacity(pit) - pitHoleCorpseCount(pit) >= needed)
      .sort((a, b) => pitHoleCorpseCount(a) - pitHoleCorpseCount(b) || containerTypeDef(b.typeId).seal - containerTypeDef(a.typeId).seal)
      [0] || null;
  }

  function remainsHandlingActionLabel(action) {
    if (action === "scrapeRemains") {
      return "Scrape Remains into Pit";
    }
    return "Dump Remains into Pit";
  }

  function remainsHandlingBlockReason(container, action) {
    if (!container) {
      return "No container selected.";
    }
    if (scientistIsDead()) {
      return "The scientist is dead.";
    }
    if (container.type === "synthesis") {
      return "Move remains out of the synthesis tube before pit disposal.";
    }
    if (isPitHoleContainer(container)) {
      return "Pit holes are already the destination for remains.";
    }
    if (container.roomId !== PITS_ROOM_ID) {
      return "Haul this container to Pits before handling remains.";
    }
    if (!containerAccessOpen(container)) {
      return "Open the container before handling remains.";
    }
    if (isContainerInTransit(container.id)) {
      return `${container.name} is being hauled.`;
    }
    if (containerInteractionTask(container.id)) {
      return `${container.name} is already being handled.`;
    }
    const corpses = containerCorpses(container.id);
    if (!corpses.length) {
      return "No corpse remains are in this container.";
    }
    if (!availablePitHoleForRemains(corpses.length)) {
      return "No pit hole has room for these remains.";
    }
    if (action !== "dumpRemains" && action !== "scrapeRemains") {
      return "Unknown remains handling action.";
    }
    return "";
  }

  function startRemainsHandling(containerId, action) {
    const container = containerById(containerId);
    const reason = remainsHandlingBlockReason(container, action)
      || handlingMethodMissingToolReason(currentHandlingMethodId());
    if (reason) {
      addEvent(reason);
      persist();
      render();
      return false;
    }
    const handlingLabel = `${remainsHandlingActionLabel(action).toLowerCase()} from ${container.name}`;
    if (!confirmPhysicalStateRiskIfNeeded(handlingLabel)) {
      return false;
    }
    const corpses = containerCorpses(container.id);
    const destinationPit = availablePitHoleForRemains(corpses.length);
    const baseCost = action === "scrapeRemains" ? REMAINS_SCRAPE_STAMINA : REMAINS_DUMP_STAMINA;
    const cost = adjustedStaminaCost(baseCost, ["slimeHandling"]);
    if (!spendStamina(cost)) {
      addEvent(`Not enough stamina. ${cost} required.`);
      persist();
      render();
      return false;
    }
    const duration = adjustedDuration(action === "scrapeRemains" ? REMAINS_SCRAPE_DURATION : REMAINS_DUMP_DURATION, "slimeHandling");
    const task = {
      id: `task-${state.nextTaskNumber++}`,
      type: "containerInteraction",
      label: `${remainsHandlingActionLabel(action)} from ${container.name}`,
      createdAt: state.clock,
      dueAt: state.clock + duration,
      data: {
        containerId: container.id,
        action,
        methodId: currentHandlingMethodId(),
        corpseIds: corpses.map((corpse) => corpse.id),
        destinationPitId: destinationPit.id,
        staminaCost: cost
      }
    };
    state.tasks.push(task);
    addEvent(`${task.label} started with ${currentHandlingMethod().label}.`);
    persist();
    render();
    return true;
  }

  function corpseHandlingRiskModifier(container, action, methodId) {
    const corpses = containerCorpses(container.id);
    let extra = 0;
    for (const corpse of corpses) {
      const freshness = corpseFreshness(corpse);
      if (freshness === "ruined") {
        extra += 10;
      } else if (freshness === "spoiled") {
        extra += 7;
      } else if (freshness === "decaying") {
        extra += 4;
      } else {
        extra += 2;
      }
    }
    if (action === "scrapeRemains") {
      extra += 6;
    }
    if (methodId === "scraper" && action === "scrapeRemains") {
      extra -= 10;
    }
    if (methodId === "thickGloves") {
      extra -= 5;
    }
    if (methodId === "bareHands") {
      extra += 8;
    }
    return Math.max(0, extra);
  }

  function foulContainerAfterRemainsHandling(container, action) {
    if (!container?.environment?.contamination) {
      return;
    }
    const increase = action === "scrapeRemains" ? 12 : 8;
    container.environment.contamination.current = clamp((Number(container.environment.contamination.current) || 0) + increase, 0, 100);
  }

  function foulPitsAfterRemainsHandling(action) {
    const room = roomById(PITS_ROOM_ID);
    if (!room?.attributes?.contamination) {
      return;
    }
    const increase = action === "scrapeRemains" ? 4 : 3;
    room.attributes.contamination.current = clamp((Number(room.attributes.contamination.current) || 0) + increase, 0, 100);
  }

  function completeRemainsHandling(task, container, action, methodId, method) {
    const destinationPit = containerById(task.data?.destinationPitId);
    if (!destinationPit || !isPitHoleContainer(destinationPit)) {
      addEvent("Remains handling could not complete; no destination pit is available.");
      return false;
    }
    const corpseIds = Array.isArray(task.data?.corpseIds) ? task.data.corpseIds : [];
    const corpses = corpseIds
      .map((corpseId) => state.corpses.find((corpse) => corpse.id === corpseId))
      .filter((corpse) => corpse?.storage === "container" && corpse.containerId === container.id);
    if (!corpses.length) {
      addEvent("Remains handling could not complete; the remains are no longer in the source container.");
      return false;
    }
    if (pitHoleCorpseCapacity(destinationPit) - pitHoleCorpseCount(destinationPit) < corpses.length) {
      addEvent("Remains handling could not complete; the destination pit no longer has room.");
      return false;
    }

    const risk = containerHandlingRisk(container, action, methodId);
    const extraRisk = corpseHandlingRiskModifier(container, action, methodId);
    const minimumRemainsDamage = corpses.length ? 1 : 0;
    const effectiveDamage = Math.max(minimumRemainsDamage, risk.damage + Math.round(extraRisk / 4));
    if (effectiveDamage > 0) {
      damageScientistHealth(effectiveDamage, `${risk.band.toLowerCase()} remains handling while ${action === "scrapeRemains" ? "scraping" : "dumping"} ${container.name} with ${method.label}`);
    }

    for (const corpse of corpses) {
      corpse.storage = "container";
      corpse.containerId = destinationPit.id;
      corpse.roomId = destinationPit.roomId || PITS_ROOM_ID;
      corpse.nextOverflowEventAt = null;
    }

    foulContainerAfterRemainsHandling(container, action);
    foulPitsAfterRemainsHandling(action);
    const verb = action === "scrapeRemains" ? "scraped" : "dumped";
    addEvent(`${corpses.length} corpse remain${corpses.length === 1 ? "" : "s"} ${verb} from ${container.name} into ${destinationPit.name} with ${method.label}.`);
    refreshCorpseProcessingTargets();
    return true;
  }

  function moveContainerToRoom(containerId, roomId) {
    return startContainerHaul(containerId, roomId);
  }


  function containerHaulTask(containerId) {
    return (state.tasks || []).find((task) => task.type === "containerHaul" && task.data?.containerId === containerId) || null;
  }

  function containerHaulDestinationLabel(containerId) {
    const task = containerHaulTask(containerId);
    return task ? roomName(task.data?.toRoomId) : "";
  }

  function isContainerInTransit(containerId) {
    return Boolean(containerHaulTask(containerId));
  }

  function containerContentsCount(container) {
    return containerOccupants(container?.id).length + containerCorpses(container?.id).length;
  }

  function containerHaulDuration(container, toRoomId) {
    const contents = containerContentsCount(container);
    const base = contents ? CONTAINER_HAUL_WITH_CONTENTS_DURATION : CONTAINER_HAUL_BASE_DURATION;
    const pitsTrip = container?.roomId === PITS_ROOM_ID || toRoomId === PITS_ROOM_ID;
    return base + (pitsTrip ? 10 : 0);
  }

  function containerHaulBlockReason(container, toRoomId) {
    if (!container) {
      return "No container selected.";
    }
    if (container.type === "synthesis") {
      return "The synthesis tube cannot be hauled.";
    }
    const physicalBlock = physicalStateRiskBlockReason(`hauling ${container.name}`);
    if (physicalBlock) {
      return physicalBlock;
    }
    if (containerAccessOpen(container) && !containerAlwaysOpen(container)) {
      return "Close the container before hauling it.";
    }
    if (isPitHoleContainer(container)) {
      return "Pit holes are built into the Pits and cannot be hauled.";
    }
    if (!roomById(toRoomId)) {
      return "Unknown destination room.";
    }
    if (container.roomId === toRoomId) {
      return `${container.name} is already in ${roomArticleName(toRoomId)}.`;
    }
    const existing = containerHaulTask(container.id);
    if (existing) {
      return `${container.name} is already being hauled to ${roomName(existing.data?.toRoomId)}.`;
    }
    return "";
  }

  function startContainerHaul(containerId, toRoomId) {
    const container = containerById(containerId);
    const room = roomById(toRoomId);
    const reason = containerHaulBlockReason(container, toRoomId);
    if (reason) {
      addEvent(reason);
      persist();
      render();
      return false;
    }

    if (!confirmPhysicalStateRiskIfNeeded(`hauling ${container.name} to ${room.name}`)) {
      return false;
    }

    const haulRoute = roomRouteBetween(container.roomId || MAIN_ROOM_ID, room.id, { ignoreDoors: true });
    const task = {
      id: `task-${state.nextTaskNumber++}`,
      type: "containerHaul",
      label: `Haul ${container.name} to ${room.name}`,
      createdAt: state.clock,
      dueAt: state.clock + containerHaulDuration(container, room.id),
      data: {
        containerId: container.id,
        fromRoomId: container.roomId || MAIN_ROOM_ID,
        toRoomId: room.id,
        route: haulRoute,
        doorTransit: doorTransitPlan(haulRoute)
      }
    };
    state.tasks.push(task);
    const closedDoors = task.data.doorTransit.filter((step) => step.previousState === DOOR_STATE_CLOSED).length;
    addEvent(`Hauling started: ${container.name} from ${roomArticleName(container.roomId || MAIN_ROOM_ID)} to ${roomArticleName(room.id)} via ${roomRouteLabel(container.roomId || MAIN_ROOM_ID, room.id, { ignoreDoors: true })}${closedDoors ? "; closed doors will be opened and handled by policy" : ""}.`);
    persist();
    render();
    return true;
  }



  function completeContainerHaul(task) {
    const container = containerById(task.data?.containerId);
    const toRoom = roomById(task.data?.toRoomId);
    if (!container || !toRoom) {
      addEvent("Container haul could not complete; the container or room no longer exists.");
      return false;
    }

    const fromRoomId = container.roomId || task.data?.fromRoomId || MAIN_ROOM_ID;
    const fromLabel = roomArticleName(fromRoomId);
    const toLabel = roomArticleName(toRoom.id);

    container.roomId = toRoom.id;
    syncContainerContentsToRoom(container, toRoom.id);
    applyDoorTransitPolicy(task.data?.doorTransit, "Container hauling");

    addEvent(`Hauling complete: ${container.name} moved from ${fromLabel} to ${toLabel} via ${roomRouteLabel(fromRoomId, toRoom.id, { ignoreDoors: true })}.`);
    refreshCorpseProcessingTargets();
    return true;
  }


  function syncContainerContentsToRoom(container, roomId = container?.roomId || MAIN_ROOM_ID) {
    if (!container) {
      return;
    }
    for (const slime of containerOccupants(container.id)) {
      slime.roomId = roomId;
      if (roomBlocksJobs(roomId) || isContainerInTransit(container.id)) {
        slime.job = "idle";
        slime.jobProgress = 0;
        slime.jobTargetCorpseId = null;
        slime.jobNutritionGained = 0;
      }
    }
    for (const corpse of containerCorpses(container.id)) {
      corpse.roomId = roomId;
    }
  }


  // Pits hauling shortcut helpers removed: use direct Dump/Scrape/Transfer interactions.

  function moveSlimeToOpenPermanentContainer(slime) {
    const container = firstOpenPermanentContainer();
    if (!container || !assignSlimeToContainer(slime, container.id)) {
      return null;
    }
    return container;
  }


  function updateCorpses(minutes = 0) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    let changes = 0;
    for (const corpse of state.corpses || []) {
      normalizeCorpseLocation(corpse);
      if (corpseHandlingPolicy().autoMoveToDrums && isLocalCorpse(corpse) && !hasPendingNecropsy(corpse.id)) {
        changes += tryAutoMoveCorpse(corpse, { automatic: true }) ? 1 : 0;
      }
      const freshness = corpseFreshness(corpse);
      if (corpse.lastFreshness && corpse.lastFreshness !== freshness) {
        addEvent(`${corpse.name} corpse is now ${corpseStateLabel(corpse).toLowerCase()} in ${corpseLocationLabel(corpse)}.`);
        changes += 1;
      }
      corpse.lastFreshness = freshness;
      if (elapsed) {
        changes += updateLocalCorpseEffects(corpse, elapsed);
        changes += updateContainerCorpseFeeding(corpse, elapsed);
      }
      if (corpse.storage === "overflow" && state.clock >= (corpse.nextOverflowEventAt || state.clock)) {
        addEvent(`${corpse.name} overflow corpse is leaking contamination and evidence.`);
        addSuspicion(OVERFLOW_SUSPICION);
        corpse.nextOverflowEventAt = state.clock + OVERFLOW_EVENT_INTERVAL;
        changes += 1;
      }
    }
    return changes;
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
      shape: [
        "cubic",
        "spherical",
        "humanoid-ish",
        "dog-shaped",
        "blob",
        "puddle",
        "worm-like",
        "columnar",
        "conical",
        "flat sheet",
        "mound",
        "disc",
        "branching",
        "star-like",
        "mushroom-shaped",
        "shell-like"
      ],
      consistency: [
        "watery",
        "runny gel",
        "syrupy",
        "loose jelly",
        "soft gelatin",
        "mucous",
        "foamy",
        "elastic gel",
        "rubbery",
        "tar-like",
        "waxen",
        "fibrous gel",
        "grainy slurry",
        "crystalline gel",
        "brittle jelly",
        "clay-like"
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
      sustenance: [
        "organic feeder",
        "carrion feeder",
        "decay feeder",
        "filth feeder",
        "mineral feeder",
        "metal feeder",
        "silicate feeder",
        "fuel feeder",
        "arcane mineral feeder",
        "hazard feeder",
        "heat absorber",
        "light absorber",
        "ambient mana absorber",
        "moisture absorber",
        "electrical absorber",
        "fume absorber"
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
      appendages: [
        "none",
        "two tendrils",
        "four tendrils",
        "grasping pseudopods",
        "stub legs",
        "limb-like arms",
        "cilia fringe",
        "spines",
        "fins",
        "wing-like membranes",
        "feeler stalks",
        "tail-like rudder",
        "rootlets",
        "hook claws",
        "asymmetrical limbs",
        "dissolving nubs"
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
    if (key === "sustenance") {
      const label = String(entry);
      return { label, meta: { index, tags: [...(SUSTENANCE_TAGS[label] || [])] } };
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
      meta: clonePlainObject(outcome.meta)
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
    renderCorpses();
    renderContainers();
    renderJobs();
    renderTests();
    renderBreeding();
    renderPolicies();
    renderRooms();
    renderInventory();
    renderScientist();
    renderTasks();
    renderJournal();
    renderEvents();
    renderKnownEditor();
    refreshActionControls();
    syncSetupForm();
    explainDisabledButtons();
  }

  function renderLiveReadouts() {
    dom.setupOverlay.classList.toggle("hidden", state.started);
    dom.clockReadout.textContent = formatClock(state.clock);
    dom.pauseReadout.textContent = state.runEnded ? "Scientist dead" : state.paused ? "Paused" : "Running";
    dom.speedReadout.textContent = `Speed ${currentTimeSpeed().label}`;
    dom.timeSpeedSelect.value = currentTimeSpeed().id;
    dom.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    dom.seedReadout.textContent = `Seed: ${state.seed}`;
    const released = releasedSlimeCount();
    const containerText = `Containers ${occupiedPermanentContainerCount()}/${permanentContainers().length}`;
    dom.storageReadout.textContent = released ? `${containerText}; Released ${released}` : containerText;
    const overflow = overflowCorpseCount();
    const localCorpses = localCorpseCount();
    const localText = localCorpses ? `; Local ${localCorpses}` : "";
    dom.wasteReadout.textContent = overflow
      ? `Drums ${drummedCorpseCount()}/${WASTE_DRUM_CAPACITY}${localText} +${overflow}`
      : `Drums ${drummedCorpseCount()}/${WASTE_DRUM_CAPACITY}${localText}`;
    const suspicionBand = suspicionBandForValue(state.suspicion);
    dom.suspicionReadout.textContent = `Suspicion: ${suspicionBand.label}`;
    dom.suspicionReadout.dataset.suspicionBand = suspicionBand.id;
    dom.suspicionReadout.title = `Suspicion is ${suspicionBand.label.toLowerCase()}. Exact Suspicion is hidden.`;
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
    for (const element of document.querySelectorAll("[data-corpse-decay]")) {
      const corpse = findCorpse(element.dataset.corpseDecay);
      if (corpse) {
        element.textContent = corpseDecayText(corpse);
      }
    }
    for (const element of document.querySelectorAll("[data-job-remaining]")) {
      const slime = findSlime(element.dataset.jobRemaining);
      if (slime && (slime.job === "corpse" || slime.job === "disposal")) {
        element.textContent = jobRemainingText(slime);
      }
    }
    for (const element of document.querySelectorAll("[data-job-fill]")) {
      const slime = findSlime(element.dataset.jobFill);
      if (slime) {
        element.style.width = `${jobProgressPercent(slime)}%`;
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
        traitLabelEl(region, known ? knownOutcomeMarker(region.key, known, evaluated.traits[region.key]) : null),
        known
          ? traitValueEl(region.key, evaluated.traits[region.key], formatKnownPrediction(region.key, known, evaluated.traits[region.key], state.currentGenome))
          : textEl("span", "Undiscovered")
      );
      dom.predictionList.append(row);
    }
  }

  function renderMutationBench() {
    const lockedCount = REGION_DEFS.filter((region) => isRegionLocked(region.key)).length;
    const selected = getSelectedSlime();
    setActionButtonState(dom.loadSelectedGenomeBtn, !selected, "Select a living sample first.");
    setActionButtonState(dom.randomUnlockedBtn, lockedCount === REGION_DEFS.length, "All genome regions are locked.");
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
      setActionButtonState(mutate, locked, `${region.label} is locked.`);
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
    const resourceCosts = { biomass: SYNTHESIS_BIOMASS_COST };
    renderSynthesisTubeStatus();
    setButtonStaminaLabel(dom.synthesizeBtn, "Synthesize Slime", BASE_ACTION_STAMINA, ["biofabrication", "slimeHandling"], { duration: formatDuration(duration), suffix: formatResourceBundle(resourceCosts) });
    const reason = synthesisTubeBlockReason()
      || resourceBlockReason(resourceCosts)
      || staminaBlockReason(cost);
    setActionButtonState(dom.synthesizeBtn, Boolean(reason), reason);
  }

  function renderSynthesisTubeStatus() {
    const occupants = synthesisTubeOccupants();
    if (!occupants.length) {
      dom.synthesisTubeStatus.textContent = pendingSynthesisCount() > 0 ? "Synthesis in progress." : "Synthesis tube empty.";
      return;
    }
    dom.synthesisTubeStatus.textContent = `Synthesis tube occupied by ${occupants.map((slime) => slime.name).join(", ")}.`;
  }

  function synthesisTubeBlockReason() {
    const tube = synthesisTube();
    const occupants = synthesisTubeOccupants();
    const corpses = tube ? containerCorpses(tube.id) : [];
    if (occupants.length) {
      return `Synthesis tube occupied by ${occupants.map((slime) => slime.name).join(", ")}.`;
    }
    if (corpses.length) {
      return `Synthesis tube blocked by ${corpses.map((corpse) => `${corpse.name} remains`).join(", ")}.`;
    }
    if (pendingSynthesisCount() > 0) {
      return "Synthesis already in progress.";
    }
    return "";
  }

  function refreshActionControls() {
    renderFoundryActionState();
    refreshReleaseButtonState();
    refreshTestButtonStates();
    refreshBreedButtonState();
    refreshCorpseActionStates();
  }

  function refreshReleaseButtonState() {
    const selected = getSelectedSlime();
    const cost = adjustedStaminaCost(HANDLING_STAMINA, ["slimeHandling"]);
    const releaseLabel = selected?.status === "released" ? "Contain Creature" : "Release into Room";
    setButtonStaminaLabel(dom.releaseBtn, releaseLabel, HANDLING_STAMINA, ["slimeHandling"]);
    const reason = !selected || selected.status === "dead"
      ? "No living slime selected."
      : selected.status === "released" && !firstOpenPermanentContainer()
        ? "No open permanent container is available."
      : staminaBlockReason(cost);
    setActionButtonState(dom.releaseBtn, Boolean(reason), reason);
    if (!reason && selected && selected.status !== "released") {
      dom.releaseBtn.title = releaseSuitabilityTooltipText(selected);
    }
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
      setButtonStaminaLabel(button, test.label, BASE_ACTION_STAMINA, [test.skillId, "slimeHandling"], { duration: formatDuration(duration) });
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
    setButtonStaminaLabel(dom.breedBtn, "Force Recombination", BASE_ACTION_STAMINA, ["reproductiveBiology", "slimeHandling"], { duration: formatDuration(duration) });
    const reason = breedable.length < 2
      ? "Forced recombination requires two mature slimes."
      : !canAddContainedSlime()
        ? "Forced recombination requires at least one open permanent container."
        : staminaBlockReason(cost);
    setActionButtonState(dom.breedBtn, Boolean(reason), reason);
  }

  function refreshCorpseActionStates() {
    for (const button of dom.corpseList?.querySelectorAll("[data-corpse-id]") || []) {
      const corpse = findCorpse(button.dataset.corpseId);
      if (corpse) {
        refreshNecropsyButton(button, corpse);
      }
    }
  }

  function renderSlimes() {
    dom.slimeList.textContent = "";
    const selected = getSelectedSlime();
    dom.selectedSlimeSummary.textContent = "";
    if (selected) {
      dom.selectedSlimeSummary.append(
        slimeNameLink(selected),
        document.createTextNode(` - ${slimeLocationLabel(selected)} - ${slimeActivityLabel(selected)}`)
      );
      const selectedContainer = selected.containerId ? containerById(selected.containerId) : null;
      if (selectedContainer && selected.status !== "dead") {
        const risk = activeContainmentRisk(selected, selectedContainer);
        const prediction = activeContainmentRiskPrediction(risk, selected, selectedContainer);
        dom.selectedSlimeSummary.append(document.createTextNode(` - Active containment risk: ${predictionRangeText(prediction.range)}`));
        dom.selectedSlimeSummary.append(activeContainmentRiskPredictionEl(risk, selected, selectedContainer));
      }
    } else {
      dom.selectedSlimeSummary.textContent = "No slime selected";
    }
    refreshReleaseButtonState();

    if (state.slimes.length === 0) {
      dom.slimeList.append(emptyText("No living samples."));
      return;
    }

    for (const slime of state.slimes) {
      const card = document.createElement("article");
      card.className = `slime-card${slime.id === state.selectedSlimeId ? " selected" : ""}${slime.status === "dead" ? " dead" : ""}`;
      card.dataset.slimeCard = slime.id;
      card.addEventListener("click", () => {
        state.selectedSlimeId = slime.id;
        persist();
        render();
      });
      const title = document.createElement("h3");
      title.append(slimeNameLink(slime, "entity-link-title"), textEl("span", slimeStateLabel(slime)));
      const meta = document.createElement("div");
      meta.className = "slime-meta";
      const evaluated = evaluateGenome(slime.genome);
      const maturity = chip(slime.mature ? "mature" : `matures in ${formatDuration(slime.matureAt - state.clock)}`);
      maturity.dataset.slimeMaturity = slime.id;
      const life = chip(`life ${formatDuration(Math.max(0, slime.deathAt - state.clock))}`);
      life.dataset.slimeLife = slime.id;
      meta.append(maturity);
      meta.append(life);
      meta.append(chip(slimeLocationLabel(slime)));
      const roomChip = slimeRoomLabel(slime);
      if (roomChip) {
        meta.append(chip(roomChip));
      }
      meta.append(chip(slimeActivityLabel(slime)));
      for (const activityChip of slimeDoorIntentChips(slime)) {
        meta.append(activityChip);
      }
      for (const activityChip of slimeCleanupActivityPerformanceChips(slime)) {
        meta.append(activityChip);
      }
      if (slime.revealed?.sustenance && isEnvironmentalSustenance(slime)) {
        meta.append(chip(environmentalSustenanceStatus(slime) || environmentalSustenanceLabel(slime)));
      }
      card.append(title, renderIdentityStrip(slime, evaluated), meta);
      if (slime.id === state.selectedSlimeId) {
        card.append(renderSlimeStats(slime));
        card.append(renderFeedingControls(slime));
        card.append(renderTraitGrid(slime, evaluated));
      }
      card.append(renderSlimeGenomeFooter(slime));
      dom.slimeList.append(card);
    }
  }


  function renderCorpses() {
    dom.corpseList.textContent = "";
    const overflow = overflowCorpseCount();
    const localCorpses = localCorpseCount();
    const baseSummary = `${drummedCorpseCount()}/${WASTE_DRUM_CAPACITY} waste drums used`;
    const localSummary = localCorpses ? `; ${localCorpses} local corpse${localCorpses === 1 ? "" : "s"}` : "";
    dom.wasteSummary.textContent = overflow
      ? `${baseSummary}${localSummary}; ${overflow} overflow specimen${overflow === 1 ? "" : "s"}`
      : `${baseSummary}${localSummary}`;

    if (!state.corpses?.length) {
      dom.corpseList.append(emptyText("No deceased specimens."));
      return;
    }

    for (const corpse of state.corpses) {
      normalizeCorpseLocation(corpse);
      const evaluated = evaluateGenome(corpse.genome);
      const card = document.createElement("article");
      card.className = `corpse-card corpse-${corpseFreshness(corpse)}${corpse.storage === "overflow" ? " overflow" : ""}`;
      card.dataset.corpseCard = corpse.id;

      const title = document.createElement("h3");
      const name = document.createElement("span");
      name.append(corpseNameLink(corpse, "entity-link-title"), document.createTextNode(" remains"));
      title.append(name, textEl("span", corpseStateLabel(corpse)));

      const meta = document.createElement("div");
      meta.className = "slime-meta";
      const storageChip = chip(corpseLocationLabel(corpse));
      if (corpse.storage === "overflow") {
        storageChip.classList.add("danger-chip");
      }
      const decay = chip(corpseDecayText(corpse));
      decay.dataset.corpseDecay = corpse.id;
      meta.append(storageChip, decay, chip(`died ${formatClock(corpse.diedAt)}`), chip(corpse.genome));

      const actions = document.createElement("div");
      actions.className = "corpse-actions";
      const necropsy = document.createElement("button");
      necropsy.type = "button";
      necropsy.dataset.corpseId = corpse.id;
      refreshNecropsyButton(necropsy, corpse);
      necropsy.addEventListener("click", () => {
        startNecropsy(corpse);
      });
      const dump = document.createElement("button");
      dump.type = "button";
      dump.className = "danger-action";
      dump.textContent = "Dump Outside";
      const dumpReason = dumpCorpseBlockReason(corpse);
      setActionButtonState(dump, Boolean(dumpReason), dumpReason);
      dump.addEventListener("click", () => {
        dumpCorpseOutside(corpse.id);
      });
      actions.append(necropsy, dump);

      card.append(title, renderIdentityStrip(corpse, evaluated), meta, actions);
      if (corpse.necropsyReport) {
        const report = document.createElement("p");
        report.className = "corpse-report";
        report.textContent = corpse.necropsyReport;
        card.append(report);
      }
      dom.corpseList.append(card);
    }
  }


  function renderContainers() {
    state.containers = normalizeContainers(state.containers);
    dom.containerList.textContent = "";
    const permanent = permanentContainers();
    const occupied = occupiedPermanentContainerCount();
    const released = releasedSlimeCount();
    dom.containerSummary.textContent = `${occupied}/${permanent.length} permanent containers occupied${released ? `; ${released} released` : ""}`;

    const tube = synthesisTube();
    if (tube) {
      dom.containerList.append(containerCardEl(tube));
    }

    for (const container of permanent) {
      dom.containerList.append(containerCardEl(container));
    }

    const releasedSlimes = (state.slimes || []).filter((slime) => slime.status === "released");
    if (releasedSlimes.length) {
      const card = document.createElement("div");
      card.className = "container-card released";
      const title = document.createElement("div");
      title.className = "container-title";
      title.append(textEl("strong", "Released Slimes"), textEl("span", `${releasedSlimes.length} loose`));
      const list = document.createElement("div");
      list.className = "released-slime-list";
      for (const slime of releasedSlimes) {
        const row = document.createElement("div");
        row.className = "container-occupant-row";
        row.append(slimeNameLink(slime), textEl("span", roomName(slime.roomId || MAIN_ROOM_ID)));
        list.append(row);
      }
      card.append(title, list);
      dom.containerList.append(card);
    }
  }

  // Helper function to generate a compact environment summary
  function containerEnvironmentSummary(container) {
    if (!container.environment) return "";
    
    const attributes = [];
    for (const def of ROOM_ATTRIBUTE_DEFS) {
      const key = def.key;
      const value = container.environment[key]?.current || 0;
      const status = value < 25 ? "low" : value > 75 ? "high" : "normal";
      attributes.push(`${def.label}: ${value}% (${status})`);
    }
    return attributes.join("; ");
  }

  // Helper function to generate environment warnings
  function containerEnvironmentWarnings(container) {
    if (!container.environment) return [];

    const warnings = [];
    const condition = containerCondition(container);
    if (condition < 25) {
      warnings.push("Container condition critical");
    } else if (condition < 50) {
      warnings.push("Container condition damaged");
    } else if (condition < 75) {
      warnings.push("Container condition worn");
    }
    for (const def of ROOM_ATTRIBUTE_DEFS) {
      const key = def.key;
      const value = container.environment[key]?.current || 0;
      
      if (value < 25) {
        warnings.push(`${def.label} low`);
      } else if (value > 75) {
        warnings.push(`${def.label} high`);
      }
    }
    return warnings;
  }


  function containerGeometry(container) {
    if (!container) return null;
    if (container.id === SYNTHESIS_TUBE_ID || container.typeId === "synthesisTube" || container.type === "synthesis") {
      return SYNTHESIS_TUBE_GEOMETRY;
    }
    return CONTAINER_BASE_TYPE_BY_ID[container.typeId]?.geometry || null;
  }

  function formatDimensionCm(value) {
    if (!Number.isFinite(value)) return "?";
    return String(Math.round(value * 10) / 10);
  }

  function formatGeometryDimensions(geometry) {
    if (!geometry?.internalCm) return "unknown size";
    const dims = geometry.internalCm;
    if (Number.isFinite(dims.diameter) && Number.isFinite(dims.height)) {
      return `${formatDimensionCm(dims.diameter)} cm diameter × ${formatDimensionCm(dims.height)} cm tall`;
    }
    if (Number.isFinite(dims.length) && Number.isFinite(dims.width) && Number.isFinite(dims.height)) {
      return `${formatDimensionCm(dims.length)} × ${formatDimensionCm(dims.width)} × ${formatDimensionCm(dims.height)} cm`;
    }
    return "unknown size";
  }

  function formatOpeningDimensions(geometry) {
    if (!geometry?.openingCm) return "";
    const opening = geometry.openingCm;
    if (Number.isFinite(opening.diameter)) {
      return `${formatDimensionCm(opening.diameter)} cm opening`;
    }
    if (Number.isFinite(opening.width) && Number.isFinite(opening.height)) {
      return `${formatDimensionCm(opening.width)} × ${formatDimensionCm(opening.height)} cm opening`;
    }
    return "";
  }

  function containerGeometrySummary(container) {
    const geometry = containerGeometry(container);
    if (!geometry) return "interior size unknown";
    const opening = formatOpeningDimensions(geometry);
    const top = geometry.openTop ? "open top" : "closed";
    return `${formatGeometryDimensions(geometry)} · ${geometry.shape} · ${top}${opening ? ` · ${opening}` : ""}`;
  }


  function containerInteriorMeasure(container) {
    const geometry = containerGeometry(container);
    const dims = geometry?.internalCm;
    if (!dims) return null;
    if (Number.isFinite(dims.diameter) && Number.isFinite(dims.height)) {
      return {
        length: dims.diameter,
        width: dims.diameter,
        height: dims.height,
        maxSpan: Math.max(dims.diameter, dims.height),
        minSpan: Math.min(dims.diameter, dims.height)
      };
    }
    if (Number.isFinite(dims.length) && Number.isFinite(dims.width) && Number.isFinite(dims.height)) {
      return {
        length: dims.length,
        width: dims.width,
        height: dims.height,
        maxSpan: Math.max(dims.length, dims.width, dims.height),
        minSpan: Math.min(dims.length, dims.width, dims.height)
      };
    }
    return null;
  }

  function containerOpeningMeasure(container) {
    const geometry = containerGeometry(container);
    const opening = geometry?.openingCm;
    if (!opening) return null;
    if (Number.isFinite(opening.diameter)) {
      return {
        width: opening.diameter,
        height: opening.diameter,
        minSpan: opening.diameter,
        maxSpan: opening.diameter
      };
    }
    if (Number.isFinite(opening.width) && Number.isFinite(opening.height)) {
      return {
        width: opening.width,
        height: opening.height,
        minSpan: Math.min(opening.width, opening.height),
        maxSpan: Math.max(opening.width, opening.height)
      };
    }
    return null;
  }

  function slimeCompressibility(profile, consistencyKnown = true) {
    const consistency = profile?.consistency || "soft gelatin";
    if (!consistencyKnown) return 0.65;
    if (["watery", "runny gel", "syrupy", "loose jelly", "mucous", "foamy", "grainy slurry"].includes(consistency)) return 0.25;
    if (["soft gelatin", "elastic gel", "bouncy rubber", "sticky taffy", "aerated mousse"].includes(consistency)) return 0.55;
    if (["dense rubber", "clay-like"].includes(consistency)) return 0.85;
    if (["crystalline gel", "brittle jelly"].includes(consistency)) return 1.05;
    return 0.75;
  }

  function slimeDimensionEstimate(profile, volumeCm3) {
    const safeVolume = Math.max(1, Number(volumeCm3) || 1);
    const root = Math.cbrt(safeVolume);
    const shape = profile?.shape || "blob";
    if (shape === "cubic") {
      return { length: root, width: root, height: root, openingNeed: root };
    }
    if (shape === "spherical") {
      const diameter = Math.cbrt((6 * safeVolume) / Math.PI);
      return { length: diameter, width: diameter, height: diameter, openingNeed: diameter };
    }
    if (shape === "humanoid-ish") {
      const height = Math.cbrt(safeVolume * 9);
      return { length: height * 0.45, width: height * 0.38, height, openingNeed: height * 0.38 };
    }
    if (shape === "dog-shaped") {
      const length = Math.cbrt(safeVolume * 5.5);
      return { length, width: length * 0.38, height: length * 0.45, openingNeed: length * 0.38 };
    }
    if (shape === "puddle" || shape === "flat sheet") {
      const depth = clamp(root * (shape === "puddle" ? 0.08 : 0.12), 1, 22);
      const spread = 2 * Math.sqrt(safeVolume / (Math.PI * depth));
      return { length: spread, width: spread, height: depth, openingNeed: Math.min(spread, 20) };
    }
    if (shape === "worm-like") {
      const length = Math.cbrt(safeVolume * 30);
      const thickness = Math.sqrt(safeVolume / (Math.PI * length)) * 2;
      return { length, width: thickness, height: thickness, openingNeed: thickness };
    }
    if (shape === "columnar") {
      const height = Math.cbrt(safeVolume * 4);
      const diameter = Math.sqrt((4 * safeVolume) / (Math.PI * height));
      return { length: diameter, width: diameter, height, openingNeed: diameter };
    }
    if (shape === "conical") {
      const height = Math.cbrt((12 * safeVolume) / Math.PI);
      const diameter = Math.sqrt((12 * safeVolume) / (Math.PI * height));
      return { length: diameter, width: diameter, height, openingNeed: diameter };
    }
    if (shape === "disc") {
      const thickness = clamp(root * 0.22, 2, 40);
      const diameter = 2 * Math.sqrt(safeVolume / (Math.PI * thickness));
      return { length: diameter, width: diameter, height: thickness, openingNeed: Math.min(diameter, Math.max(thickness, diameter * 0.35)) };
    }
    if (shape === "branching" || shape === "star-like") {
      const span = Math.cbrt(safeVolume * 8);
      const core = root * 0.34;
      return { length: span, width: span, height: core, openingNeed: core * 1.5 };
    }
    if (shape === "mushroom-shaped") {
      const height = Math.cbrt(safeVolume * 3.2);
      return { length: height * 0.72, width: height * 0.72, height, openingNeed: height * 0.72 };
    }
    if (shape === "shell-like") {
      const length = Math.cbrt(safeVolume * 3.6);
      return { length, width: length * 0.62, height: length * 0.32, openingNeed: length * 0.62 };
    }
    const height = Math.cbrt(safeVolume * 0.75);
    const width = Math.sqrt(safeVolume / height);
    return { length: width, width, height, openingNeed: width };
  }

  function containerDimensionalSuitabilityConcerns(slime, container, profile, options = {}) {
    const interior = containerInteriorMeasure(container);
    if (!interior || !profile) return [];
    const massFraction = clamp(slimeStat(slime, "currentMass").current, 1, 100) / 100;
    const currentDims = slimeDimensionEstimate(profile, profile.volumeCm3 * massFraction);
    const fullDims = slimeDimensionEstimate(profile, profile.volumeCm3);
    const compressibility = slimeCompressibility(profile, options.consistencyKnown);
    const concerns = [];
    const floorLong = Math.max(interior.length, interior.width);
    const floorShort = Math.min(interior.length, interior.width);
    const currentLong = Math.max(currentDims.length, currentDims.width);
    const currentShort = Math.min(currentDims.length, currentDims.width);
    const fullLong = Math.max(fullDims.length, fullDims.width);
    const fullShort = Math.min(fullDims.length, fullDims.width);

    if (currentDims.height > interior.height * (1.25 + (1 - compressibility) * 0.35)) {
      concerns.push({ severity: compressibility >= 0.9 ? "severe" : "major", text: `Current body height presses against the ${containerTypeLabel(container.typeId)} interior.` });
    } else if (fullDims.height > interior.height * (1.35 + (1 - compressibility) * 0.35)) {
      concerns.push({ severity: compressibility >= 0.9 ? "major" : "moderate", text: `Full-size body may become too tall for the ${containerTypeLabel(container.typeId)} interior.` });
    }

    if (currentLong > floorLong * (1.2 + (1 - compressibility) * 0.5) || currentShort > floorShort * (1.2 + (1 - compressibility) * 0.5)) {
      concerns.push({ severity: compressibility >= 0.9 ? "severe" : "major", text: `Current body dimensions strain the ${containerTypeLabel(container.typeId)} floor space.` });
    } else if (fullLong > floorLong * (1.35 + (1 - compressibility) * 0.5) || fullShort > floorShort * (1.35 + (1 - compressibility) * 0.5)) {
      concerns.push({ severity: compressibility >= 0.9 ? "major" : "moderate", text: `Full-size body may outgrow the ${containerTypeLabel(container.typeId)} interior dimensions.` });
    }

    const geometry = containerGeometry(container);
    const opening = containerOpeningMeasure(container);
    if (opening && !geometry?.openTop) {
      const openingNeed = currentDims.openingNeed * compressibility;
      const fullOpeningNeed = fullDims.openingNeed * compressibility;
      if (openingNeed > opening.minSpan * 1.1) {
        concerns.push({ severity: compressibility >= 0.9 ? "major" : "moderate", text: `Current body may be difficult to move through the ${containerTypeLabel(container.typeId)} opening.` });
      } else if (fullOpeningNeed > opening.minSpan * 1.2) {
        concerns.push({ severity: compressibility >= 0.9 ? "moderate" : "minor", text: `Full-size body may not pass cleanly through the ${containerTypeLabel(container.typeId)} opening.` });
      }
    }

    if (geometry?.openTop && ["climbing", "hopping", "scuttling", "clinging"].includes(profile.movement)) {
      concerns.push({ severity: "minor", text: `Open-top geometry may matter if this slime's movement lets it climb or hop.` });
    }

    return concerns.slice(0, 3);
  }



  function normalizeContainerCondition(value) {
    const number = Number(value);
    return clamp(Number.isFinite(number) ? number : CONTAINER_CONDITION_DEFAULT, 0, 100);
  }

  function containerCondition(container) {
    if (!container) return CONTAINER_CONDITION_DEFAULT;
    container.condition = normalizeContainerCondition(container.condition);
    return container.condition;
  }

  function adjustContainerCondition(container, delta) {
    if (!container) return false;
    const before = containerCondition(container);
    container.condition = normalizeContainerCondition(before + (Number(delta) || 0));
    return Math.abs(container.condition - before) >= 0.01;
  }

  function containerConditionLabel(container) {
    const condition = containerCondition(container);
    if (condition < 25) return `${formatNumber(condition)}% critical`;
    if (condition < 50) return `${formatNumber(condition)}% damaged`;
    if (condition < 75) return `${formatNumber(condition)}% worn`;
    return `${formatNumber(condition)}% intact`;
  }

  function normalizeContainmentIncidentProgress(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const normalized = {};
    for (const [key, value] of Object.entries(source)) {
      if (!key || !value || typeof value !== "object") {
        continue;
      }
      normalized[key] = {
        progress: Math.max(0, Number(value.progress) || 0),
        lastIncidentAt: Number.isFinite(Number(value.lastIncidentAt)) ? Number(value.lastIncidentAt) : null
      };
    }
    return normalized;
  }

  function containmentIncidentKey(slime, container) {
    return `${container?.id || "room"}:${slime?.id || "unknown"}`;
  }

  function containmentIncidentRecord(slime, container) {
    state.containmentIncidentProgress = normalizeContainmentIncidentProgress(state.containmentIncidentProgress);
    const key = containmentIncidentKey(slime, container);
    state.containmentIncidentProgress[key] ||= { progress: 0, lastIncidentAt: null };
    return state.containmentIncidentProgress[key];
  }

  function cleanupContainmentIncidentProgress() {
    if (!state?.containmentIncidentProgress) return;
    const activeKeys = new Set();
    for (const slime of state.slimes || []) {
      if (!slime || slime.status !== "contained" || !slime.containerId) {
        continue;
      }
      const container = containerById(slime.containerId);
      if (container) {
        activeKeys.add(containmentIncidentKey(slime, container));
      }
    }
    for (const key of Object.keys(state.containmentIncidentProgress)) {
      if (!activeKeys.has(key)) {
        delete state.containmentIncidentProgress[key];
      }
    }
  }

  function updateContainmentIncidents(minutes) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!elapsed || !state?.started) {
      return 0;
    }

    let changes = 0;
    cleanupContainmentIncidentProgress();

    for (const slime of state.slimes || []) {
      if (!slime || slime.status !== "contained" || slime.status === "dead" || !slime.containerId) {
        continue;
      }

      const container = containerById(slime.containerId);
      if (!container || container.type === "synthesis") {
        continue;
      }

      const risk = activeContainmentRisk(slime, container);
      const record = containmentIncidentRecord(slime, container);

      if (risk.score < 75) {
        const before = record.progress;
        record.progress = Math.max(0, record.progress - CONTAINMENT_INCIDENT_PROGRESS_DECAY_PER_HOUR * (elapsed / 60));
        if (Math.abs(record.progress - before) >= 0.01) {
          changes += 1;
        }
        continue;
      }

      const riskMultiplier = risk.score >= 110 ? 1.6 : 1 + (risk.score - 75) / 80;
      record.progress += elapsed * riskMultiplier;

      const cooldownReady = record.lastIncidentAt == null || state.clock - record.lastIncidentAt >= CONTAINMENT_INCIDENT_COOLDOWN;
      if (record.progress >= CONTAINMENT_INCIDENT_THRESHOLD && cooldownReady) {
        const incident = chooseMinorContainmentIncident(slime, container, risk);
        triggerMinorContainmentIncident(slime, container, risk, incident);
        record.progress = 0;
        record.lastIncidentAt = state.clock;
        changes += 1;
      }
    }

    return changes;
  }

  function chooseMinorContainmentIncident(slime, container, risk) {
    const evaluated = evaluateGenome(slime.genome);
    const profile = physicalProfile(slime.genome, evaluated);
    const seal = containerEffectiveSeal(container);
    const type = containerTypeDef(container.typeId);
    const byproduct = baseOutcomeLabel(evaluated.traits.byproduct);
    const runny = ["watery", "runny gel", "syrupy", "loose jelly", "mucous", "foamy", "grainy slurry"].includes(profile?.consistency);
    const foulingByproduct = ["adhesive gel", "black resin", "grease pearls", "coagulating wax", "acid droplets", "alkaline foam", "smoke vapor", "numbing paste"].includes(byproduct);

    if ((runny && (seal < 55 || type.gap >= 60)) || risk.potentialReasons.some((reason) => /gap|seal|seep/i.test(reason))) {
      return "leak";
    }

    if (foulingByproduct || risk.potentialReasons.some((reason) => /foul|mess|exposure|contamination/i.test(reason))) {
      return "fouling";
    }

    if (risk.potentialReasons.some((reason) => /damage|durability|weight|critical|damaged/i.test(reason))) {
      return "strain";
    }

    return "disturbance";
  }

  function triggerMinorContainmentIncident(slime, container, risk, incident) {
    const incidentLabel = {
      disturbance: "disturbance",
      fouling: "fouling",
      leak: "leak/seep strain",
      strain: "structural strain"
    }[incident] || "disturbance";

    let message = `Minor containment incident: ${slime.name} caused ${incidentLabel} in ${container.name}.`;
    let suspicion = 0;

    if (incident === "fouling") {
      adjustContainerEnvironment(container, "contamination", 8);
      adjustContainerCondition(container, -1);
      adjustSlimeStat(slime, "stress", 2);
      message += " Interior contamination rose.";
    } else if (incident === "leak") {
      adjustContainerEnvironment(container, "contamination", 5);
      adjustRoomAttribute(container.roomId || slime.roomId || MAIN_ROOM_ID, "contamination", 2);
      adjustContainerCondition(container, -2);
      adjustSlimeStat(slime, "stress", 3);
      suspicion = 1;
      message += " A small trace reached the room.";
    } else if (incident === "strain") {
      adjustContainerCondition(container, -4);
      adjustSlimeStat(slime, "stress", 2);
      message += " The container condition worsened.";
    } else {
      adjustContainerCondition(container, -1);
      adjustSlimeStat(slime, "stress", 3);
      message += " The disturbance raised Stress.";
    }

    if (risk.label === "Failing") {
      suspicion += 1;
    }

    if (suspicion) {
      addSuspicion(suspicion);
      message += ` Suspicion +${suspicion}.`;
    }

    addEvent(message);
    return true;
  }

  function adjustContainerEnvironment(container, attributeKey, amount) {
    if (!container) return false;
    container.environment = normalizeContainerEnvironment(container.environment);
    const attribute = container.environment?.[attributeKey];
    const delta = Number(amount);
    if (!attribute || !Number.isFinite(delta) || !delta) {
      return false;
    }
    const before = attribute.current;
    attribute.current = clamp(attribute.current + delta, 0, 100);
    return Math.abs(attribute.current - before) >= 0.01;
  }

  function activeContainmentRisk(slime, container) {
    if (!slime || !container || slime.status === "dead") {
      return {
        label: "Unknown",
        className: "container-band-unknown",
        score: 0,
        potential: 0,
        pressure: 0,
        potentialReasons: [],
        pressureReasons: ["No active containment risk can be assessed."],
        reasons: ["Pressure: No active containment risk can be assessed."]
      };
    }

    if (container.type === "synthesis") {
      return {
        label: "Suppressed by synthesis tube",
        className: "container-band-good",
        score: 5,
        potential: 5,
        pressure: 0,
        potentialReasons: ["The synthesis tube is built for temporary universal containment."],
        pressureReasons: ["Synthesis tube suppression keeps active containment risk low during temporary stabilization."],
        reasons: [
          "Potential: The synthesis tube is built for temporary universal containment.",
          "Pressure: Synthesis tube suppression keeps active containment risk low during temporary stabilization."
        ]
      };
    }

    const evaluated = evaluateGenome(slime.genome);
    const profile = physicalProfile(slime.genome, evaluated);
    const type = containerTypeDef(container.typeId);
    const condition = containerCondition(container);
    const revealed = slime.revealed || {};
    const stats = slime.stats || {};
    const fit = passiveContainerSuitability(slime, container);
    let potential = 0;
    let pressure = 0;
    const potentialReasons = [];
    const pressureReasons = [];
    const neutralReasons = [];
    const reasons = [];
    const addPotential = (points, text) => {
      potential += points;
      potentialReasons.push(text);
      reasons.push(`Potential: ${text}`);
    };
    const addPressure = (points, text) => {
      pressure += points;
      pressureReasons.push(text);
      reasons.push(`Pressure: ${text}`);
    };
    const addNeutral = (text) => {
      neutralReasons.push(text);
      reasons.push(text);
    };

    if (fit.label === "Unsuitable") {
      addPotential(55, "passive fit is unsuitable.");
    } else if (fit.label === "Poor Fit") {
      addPotential(35, "passive fit is poor.");
    } else if (fit.label === "Questionable") {
      addPotential(18, "passive fit is questionable.");
    } else if (fit.label === "Unknown") {
      addPotential(8, "containment fit is still partly unknown.");
    }

    if (condition < 25) {
      addPotential(35, "container condition is critical.");
      addPressure(16, "damaged containment is actively straining.");
    } else if (condition < 50) {
      addPotential(22, "container condition is damaged.");
      addPressure(8, "wear is making containment less reliable.");
    } else if (condition < 75) {
      addPotential(8, "container condition is worn.");
    }

    if (isPitHoleContainer(container)) {
      const coverType = containerTypeDef(container.typeId).coverType || "none";
      const coverPotential = { none: 28, grate: 18, cap: 8 }[coverType] ?? 16;
      const coverPressure = { none: 10, grate: 6, cap: 2 }[coverType] ?? 5;
      addPotential(coverPotential, `${containerTypeDef(container.typeId).label} is a crude dirt-hole containment site.`);
      if (coverPressure) {
        addPressure(coverPressure, "pit-hole covers can be challenged by living creatures.");
      }
    }

    if (isContainerInTransit(container.id)) {
      addPressure(14, "the container is currently being hauled.");
    }

    if (containerAccessOpen(container)) {
      addPressure(18, "the container is open during direct handling.");
    }

    const localCorpses = containerCorpses(container.id);
    if (localCorpses.length) {
      addPotential(10 + localCorpses.length * 4, `${localCorpses.length} corpse${localCorpses.length === 1 ? "" : "s"} sharing this container.`);
      if (!localCorpses.some((corpse) => corpseFeedingRateForSlime(slime, corpse).rate > 0)) {
        addPressure(8, "nearby remains are fouling the container.");
      }
    }

    if (revealed.size && profile) {
      const massFraction = clamp(slimeStat(slime, "currentMass").current, 1, 100) / 100;
      const currentVolume = profile.volumeCm3 * massFraction;
      if (currentVolume > type.capacityCm3) {
        addPotential(30, "current body exceeds container capacity.");
      } else if (currentVolume > type.capacityCm3 * 0.85) {
        addPotential(14, "current body nearly fills the container.");
      } else if (profile.volumeCm3 > type.capacityCm3) {
        addPotential(18, "full-size body would outgrow the container.");
      }
    }

    if (revealed.consistency && profile) {
      const runny = ["watery", "runny gel", "syrupy", "loose jelly", "mucous", "foamy", "grainy slurry"];
      if (runny.includes(profile.consistency)) {
        if (type.gap >= 60) {
          addPotential(28, "runny body can exploit large gaps.");
        } else if (containerEffectiveSeal(container) < 50) {
          addPotential(18, "runny body strains the container seal.");
        }
      }
    }

    if (revealed.appendages && profile?.appendages && profile.appendages !== "none") {
      if (type.gap >= 60) {
        addPotential(12, "appendages can reach through large gaps.");
      }
      if (["spines", "hook claws"].includes(profile.appendages) && type.durability < 55) {
        addPotential(18, `${profile.appendages} can damage weaker materials.`);
      }
    }

    if (revealed.element && profile) {
      const resistanceKey = { acid: "acid", flame: "flame", frost: "frost", storm: "storm", poison: "poison", dream: "mana", ether: "mana", gravity: "mana" }[profile.element];
      if (resistanceKey && !containerProtectsAny(container, [resistanceKey])) {
        const resistance = Number(type.resistances?.[resistanceKey]) || 0;
        if (resistance < 25) {
          addPotential(28, `${type.label} has very poor ${resistanceKey} resistance.`);
        } else if (resistance < 50) {
          addPotential(16, `${type.label} has weak ${resistanceKey} resistance.`);
        }
      }
    }

    if (revealed.byproduct) {
      const byproduct = baseOutcomeLabel(evaluated.traits.byproduct);
      if (["acid droplets", "sterile solvent", "alkaline foam", "smoke vapor", "numbing paste"].includes(byproduct)) {
        addPotential(14, `${byproduct} can turn disturbances into messes or exposure risks.`);
      }
      if (["adhesive gel", "black resin", "grease pearls", "coagulating wax"].includes(byproduct) && !type.drainage) {
        addPotential(8, `${byproduct} can foul containers without drainage.`);
      }
    }

    const stress = Number(stats.stress?.current ?? slimeStat(slime, "stress").current) || 0;
    const nutrition = Number(stats.nutrition?.current ?? slimeStat(slime, "nutrition").current) || 0;
    const integrity = Number(stats.bodyIntegrity?.current ?? slimeStat(slime, "bodyIntegrity").current) || 0;
    const division = Number(stats.divisionPressure?.current ?? slimeStat(slime, "divisionPressure").current) || 0;

    if (stress >= 75) {
      addPressure(36, "high Stress is making the slime restless.");
    } else if (stress >= 55) {
      addPressure(22, "Stress is elevated.");
    } else if (stress >= 35) {
      addPressure(10, "Stress is rising.");
    }

    if (nutrition <= 15) {
      addPressure(26, "severe hunger may push the slime to test containment.");
    } else if (nutrition <= 30) {
      addPressure(14, "low nutrition increases containment pressure.");
    }

    if (integrity <= 30) {
      addPressure(14, "poor body integrity may make behavior less predictable.");
    }

    if (division >= 80) {
      addPressure(18, "high division pressure may soon overcrowd containment.");
    } else if (division >= 55) {
      addPressure(10, "division pressure is building.");
    }

    if (revealed.behavior) {
      const behavior = baseOutcomeLabel(evaluated.traits.behavior);
      const behaviorPressure = {
        "vibration hunting": 24,
        guarding: 18,
        swarming: 18,
        burrowing: 18,
        "still ambush": 14,
        "sound following": 10,
        "tool orbiting": 10,
        "heat seeking": 8,
        "light seeking": 8,
        hiding: 6,
        circling: 6
      };
      if (behaviorPressure[behavior]) {
        addPressure(behaviorPressure[behavior], `${behavior} behavior may test containment.`);
      }
      if (behavior === "cleaning") {
        addNeutral("Pressure: cleaning behavior may reduce some mess risk.");
      }
    }

    if (revealed.stability) {
      const risk = Number(evaluated.traits.stability.meta?.risk) || 5;
      if (risk >= 8) {
        addPressure(30, "stability profile is predatory or highly dangerous.");
      } else if (risk >= 7) {
        addPressure(22, "stability profile is volatile or erratic.");
      } else if (risk >= 6) {
        addPressure(14, "stability profile is somewhat fractious.");
      } else if (risk <= 2 && pressure > 0) {
        pressure = Math.max(0, pressure - 6);
        addNeutral("Pressure: stable temperament slightly reduces active pressure.");
      }
    }

    if (potential === 0 && pressure === 0) {
      addNeutral("No active containment concerns from discovered traits or current condition.");
    }

    const score = Math.round(potential + pressure);
    const label = score >= 110 ? "Failing"
      : score >= 75 ? "Dangerous"
        : score >= 45 ? "Strained"
          : score >= 20 ? "Watch"
            : "Stable";
    const className = score >= 110 ? "container-band-unsuitable"
      : score >= 75 ? "container-band-poor"
        : score >= 45 ? "container-band-questionable"
          : score >= 20 ? "container-band-questionable"
            : "container-band-good";

    return {
      label,
      className,
      score,
      potential: Math.round(potential),
      pressure: Math.round(pressure),
      potentialReasons: potentialReasons.slice(0, 4),
      pressureReasons: pressureReasons.slice(0, 4),
      reasons: reasons.slice(0, 6)
    };
  }


  function activeContainmentRiskBands() {
    return ["Stable", "Watch", "Strained", "Dangerous", "Failing"];
  }

  function activeContainmentRiskUnknownFactors(slime) {
    const unknownFactors = [];
    if (!slime) return ["creature state"];
    const revealed = slime.revealed || {};
    if (!revealed.size) unknownFactors.push("adult size");
    if (!revealed.consistency) unknownFactors.push("body consistency");
    if (!revealed.appendages) unknownFactors.push("appendages");
    if (!revealed.element) unknownFactors.push("elemental hazards");
    if (!revealed.byproduct) unknownFactors.push("byproduct");
    if (!revealed.behavior) unknownFactors.push("behavior");
    if (!revealed.stability) unknownFactors.push("stability");
    return unknownFactors;
  }

  function activeContainmentRiskKnownFactors(risk, container) {
    const factors = [];
    const potentialReasons = Array.isArray(risk?.potentialReasons) ? risk.potentialReasons : [];
    const pressureReasons = Array.isArray(risk?.pressureReasons) ? risk.pressureReasons : [];
    factors.push(...potentialReasons.slice(0, 3));
    factors.push(...pressureReasons.slice(0, 3));
    if (container) {
      factors.push(`container condition is ${containerConditionLabel(container)}`);
      if (containerAccessOpen(container)) factors.push("container is open");
      if (isContainerInTransit(container.id)) factors.push("container is in transit");
    }
    return [...new Set(factors)].filter(Boolean).slice(0, 6);
  }

  function activeContainmentRiskPrediction(risk, slime, container) {
    if (!risk) {
      const confidence = predictionConfidenceFromContext({
        unknownFactors: ["active containment state"],
        skillIds: ["observation", "ethology", "slimeHandling"]
      });
      return {
        range: { low: "Stable", high: "Failing" },
        confidence,
        knownFactors: [],
        unknownFactors: ["active containment state"],
        concerns: []
      };
    }
    if (risk.label === "Suppressed by synthesis tube") {
      const confidence = predictionConfidenceFromContext({
        knownFactors: ["synthesis tube suppression", "temporary universal containment"],
        clearEvidence: 60,
        skillIds: ["observation", "ethology", "slimeHandling"]
      });
      return {
        range: { low: "Stable", high: "Stable" },
        confidence: { ...confidence, label: "Strong" },
        knownFactors: ["synthesis tube suppression", "temporary universal containment"],
        unknownFactors: [],
        concerns: []
      };
    }
    const unknownFactors = activeContainmentRiskUnknownFactors(slime);
    const knownFactors = activeContainmentRiskKnownFactors(risk, container);
    const concerns = [];
    if (["Strained", "Dangerous", "Failing"].includes(risk.label)) {
      concerns.push(`current active risk assessment is ${risk.label.toLowerCase()}`);
    }
    const clearEvidence = Math.max(0, (knownFactors.length * 12) + (concerns.length * 8));
    const confidence = predictionConfidenceFromContext({
      unknownFactors,
      knownFactors,
      concerns,
      clearEvidence,
      skillIds: ["observation", "ethology", "slimeHandling"]
    });
    return {
      range: predictionRangeFromBand(activeContainmentRiskBands(), risk.label, confidence.label, { unknownLow: "Stable", unknownHigh: "Failing" }),
      confidence,
      knownFactors,
      unknownFactors,
      concerns
    };
  }

  function activeContainmentRiskRangeTooltip(prediction, risk) {
    const lines = [
      `Active containment risk range: ${predictionRangeText(prediction?.range)}.`,
      "This is an assessment of possible active containment trouble, not a guaranteed escape outcome."
    ];
    if (prediction?.knownFactors?.length) {
      lines.push(`Known influences narrowing or shifting the range: ${prediction.knownFactors.join(" · ")}.`);
    }
    if (prediction?.concerns?.length) {
      lines.push(`Concerns raising or widening the range: ${prediction.concerns.join(" · ")}.`);
    }
    if (prediction?.unknownFactors?.length) {
      lines.push(`Unknown factors widening the range: ${prediction.unknownFactors.join(", ")}.`);
    }
    if (Number.isFinite(risk?.potential) || Number.isFinite(risk?.pressure)) {
      lines.push("Internal Potential and Pressure scores still drive incidents, but exact scores are not shown as precise predictions.");
    }
    return lines.join("\n");
  }

  function activeContainmentRiskPredictionEl(risk, slime, container) {
    const prediction = activeContainmentRiskPrediction(risk, slime, container);
    const details = document.createElement("div");
    details.className = "container-risk-details";
    details.dataset.activeRiskPrediction = slime?.id || container?.id || "unknown";

    const rangeSpan = document.createElement("span");
    rangeSpan.dataset.activeRiskRange = slime?.id || container?.id || "unknown";
    rangeSpan.textContent = `Active containment risk: ${predictionRangeText(prediction.range)}`;
    rangeSpan.title = activeContainmentRiskRangeTooltip(prediction, risk);

    const confidenceSpan = document.createElement("span");
    confidenceSpan.dataset.activeRiskConfidence = slime?.id || container?.id || "unknown";
    confidenceSpan.textContent = `Confidence: ${prediction.confidence.label}`;
    confidenceSpan.title = predictionConfidenceTooltip(prediction.confidence);

    details.title = `${rangeSpan.title}\n${confidenceSpan.title}`;
    details.append(rangeSpan, document.createTextNode(" | "), confidenceSpan);
    return details;
  }

  function activeContainmentRiskDetailsEl(risk) {
    const details = document.createElement("div");
    details.className = "container-risk-details";

    const addGroup = (label, value, reasons, emptyMessage) => {
      const group = document.createElement("div");
      group.className = "container-risk-group";
      group.append(textEl("strong", `${label}: `), chip(String(value)));

      const displayedReasons = reasons?.length ? reasons : [emptyMessage];
      group.append(document.createTextNode(" — "));
      displayedReasons.forEach((reason, index) => {
        if (index > 0) {
          group.append(document.createTextNode(" · "));
        }
        group.append(chip(reason));
      });

      details.append(group);
    };

    addGroup("Potential", risk?.potential ?? 0, risk?.potentialReasons || [], "no major physical mismatch identified");
    addGroup("Pressure", risk?.pressure ?? 0, risk?.pressureReasons || [], "no current active pressure identified");

    return details;
  }

  function containerCardEl(container) {
    const card = document.createElement("div");
    card.className = `container-card ${container.type}`;
    const occupants = containerOccupants(container.id);
    const corpses = containerCorpses(container.id);
    const title = document.createElement("div");
    title.className = "container-title";
    const typeLabel = container.type === "synthesis" ? "Synthesis Tube" : containerTypeLabel(container.typeId);
    title.append(
      textEl("strong", container.name),
      textEl("span", container.type === "synthesis" ? "temporary perfect containment" : `${typeLabel}; ${roomName(container.roomId)}`)
    );

    const meta = document.createElement("div");
    meta.className = "container-meta";
    if (container.type === "synthesis") {
      meta.append(chip("universal temporary containment"), chip(`condition ${containerConditionLabel(container)}`), chip(`interior ${containerGeometrySummary(container)}`));
    } else {
      const type = containerTypeDef(container.typeId);
      meta.append(chip(type.label), chip(`condition ${containerConditionLabel(container)}`), chip(`capacity ${formatVolume(type.capacityCm3)}`), chip(`load ${formatWeight(containerEffectiveWeightLimit(container))}`), chip(`interior ${containerGeometrySummary(container)}`));
      const wards = containerWardLabels(container.wardIds);
      if (wards.length) {
        for (const ward of wards) {
          meta.append(chip(ward));
        }
      } else {
        meta.append(chip("no wards"));
      }
    }
    if (container.type !== "synthesis") {
      meta.append(chip(`${roomRoleLabel(container.roomId)} room`), chip(`access ${containerAccessLabel(container)}`));
      if (isPitHoleContainer(container)) {
        meta.append(chip(`pit corpses ${pitHoleCorpseCount(container)}/${pitHoleCorpseCapacity(container)}`));
      }
      const haulTask = containerHaulTask(container.id);
      if (haulTask) {
        meta.append(chip(`hauling to ${roomName(haulTask.data?.toRoomId)}`));
      }
      const roomControl = document.createElement("div");
      roomControl.className = "container-room-control";
      roomControl.append(textEl("span", "Room: "));
      const select = document.createElement("select");
      select.className = "container-room-select";
      select.dataset.containerRoomSelect = container.id;
      for (const room of state.rooms) {
        const option = document.createElement("option");
        option.value = room.id;
        option.textContent = room.name;
        select.append(option);
      }
      select.value = roomById(container.roomId)?.id || MAIN_ROOM_ID;
      const selectorBlockedReason = haulTask
        ? `${container.name} is in transit to ${roomName(haulTask.data?.toRoomId)}.`
        : isPitHoleContainer(container)
          ? "Pit holes are built into the Pits and cannot be hauled."
          : physicalStateRiskBlockReason(`hauling ${container.name}`);
      select.disabled = Boolean(selectorBlockedReason);
      select.title = selectorBlockedReason;
      select.addEventListener("change", () => {
        const destination = select.value;
        select.value = roomById(container.roomId)?.id || MAIN_ROOM_ID;
        moveContainerToRoom(container.id, destination);
      });
      roomControl.append(select);
      meta.append(roomControl);
    }

     // Add interior environment display
    if (container.environment) {
      const interior = document.createElement("div");
      interior.className = "container-interior";
      
      // Show container environment summary
      const envSummary = containerEnvironmentSummary(container);
      if (envSummary) {
        const summaryEl = document.createElement("div");
        summaryEl.className = "container-environment-summary";
        summaryEl.textContent = `Interior: ${envSummary}`;
        interior.append(summaryEl);
        
        // Add warnings if relevant
        const warnings = containerEnvironmentWarnings(container);
        if (warnings.length > 0) {
          const warningList = document.createElement("div");
          warningList.className = "container-environment-warnings";
          for (const [index, warning] of warnings.entries()) {
            if (index > 0) {
              warningList.append(document.createTextNode(" · "));
            }
            warningList.append(chip(warning));
          }
          interior.append(warningList);
        }
      }
      
      card.append(interior);
    }

    if (container.type !== "synthesis") {
      const handling = document.createElement("div");
      handling.className = "container-handling-risk";
      const handlingAction = containerAccessOpen(container) ? "close" : "open";
      const handlingRisk = containerHandlingRisk(container, handlingAction, currentHandlingMethodId());
      const handlingPrediction = directHandlingRiskPrediction(handlingRisk);
      handling.textContent = handlingRiskSummary(container);
      handling.title = `${directHandlingRiskTooltip(handlingPrediction, handlingRisk)}
${handlingMethodInventoryTitle(handlingRisk.method.id)}`;
      handling.dataset.handlingRisk = predictionRangeText(handlingPrediction.riskRange);
      handling.dataset.handlingHarm = predictionRangeText(handlingPrediction.harmRange);
      handling.dataset.handlingConfidence = handlingPrediction.confidence.label;
      handling.dataset.handlingToolPreview = handlingMethodToolPreviewSummary(handlingRisk.method.id);
      handling.dataset.handlingInventory = handlingMethodInventorySummary(handlingRisk.method.id);
      handling.dataset.handlingProtocol = handlingMethodProtocolSummary(handlingRisk.method.id);
      handling.dataset.handlingRequirement = handlingMethodRequirementSummary(handlingRisk.method.id);
      card.append(handling);
    }

    const occupantList = document.createElement("div");
    occupantList.className = "container-occupants";
    if (!occupants.length && !corpses.length) {
      occupantList.append(emptyText(container.type === "synthesis" ? "Tube empty." : "Open."));
    } else {
      for (const corpse of corpses) {
        const row = document.createElement("div");
        row.className = "container-occupant-row corpse-row";
        row.append(corpseNameLink(corpse), textEl("span", `${corpseStateLabel(corpse)} corpse`), textEl("span", corpseDecayText(corpse)));
        occupantList.append(row);
      }
      for (const slime of occupants) {
        const row = document.createElement("div");
        row.className = "container-occupant-row";
        const physicalFit = physicalContainerFitPrediction(slime, container);
        const risk = activeContainmentRisk(slime, container);
        const statusLabel = textEl("span", slime.mature ? slime.status : "immature");
        const fitLabel = textEl("span", `physical fit ${predictionRangeText(physicalFit.range)}`);
        fitLabel.className = physicalFit.className;
        fitLabel.title = physicalContainerFitTooltip(physicalFit);
        fitLabel.dataset.physicalFitRange = predictionRangeText(physicalFit.range);
        const riskPrediction = activeContainmentRiskPrediction(risk, slime, container);
        const riskLabel = textEl("span", `active risk ${predictionRangeText(riskPrediction.range)}`);
        riskLabel.className = risk.className;
        riskLabel.title = activeContainmentRiskRangeTooltip(riskPrediction, risk);
        row.append(slimeNameLink(slime), statusLabel, fitLabel, riskLabel);
        const warnings = document.createElement("div");
        warnings.className = "container-warning-list";
        warnings.append(physicalContainerFitPredictionEl(slime, container));
        warnings.append(activeContainmentRiskPredictionEl(risk, slime, container));
        occupantList.append(row, warnings);
      }
    }

    card.append(title, meta, occupantList);

    if (container.type !== "synthesis") {
      const actions = document.createElement("div");
      actions.className = "container-actions";
      const action = containerAccessOpen(container) ? "close" : "open";
      const button = document.createElement("button");
      button.type = "button";
      const interactionBaseCost = action === "close" ? CONTAINER_INTERACTION_CLOSE_STAMINA : CONTAINER_INTERACTION_OPEN_STAMINA;
      setButtonStaminaLabel(button, action === "close" ? "Close Container" : "Open Container", interactionBaseCost, ["slimeHandling"]);
      if (action === "open") {
        button.dataset.openContainerId = container.id;
      } else {
        button.dataset.closeContainerId = container.id;
      }
      const physicalRiskLabel = `${action === "close" ? "closing" : "opening"} ${container.name}`;
      const reason = containerInteractionBlockReason(container, action)
        || physicalStateRiskBlockReason(physicalRiskLabel)
        || handlingMethodMissingToolReason(currentHandlingMethodId())
        || staminaBlockReason(adjustedStaminaCost(interactionBaseCost, ["slimeHandling"]));
      setActionButtonState(button, Boolean(reason), reason);
      const physicalRiskTitle = physicalStateRiskTitle(physicalRiskLabel);
      const directHandlingTitle = handlingRiskTitle(container, action, currentHandlingMethodId());
      button.title = reason || `${handlingMethodActionTitle(currentHandlingMethodId())}\n${physicalRiskTitle ? `${physicalRiskTitle}\n` : ""}${directHandlingTitle}\n${adjustedStaminaCostBreakdown(interactionBaseCost, ["slimeHandling"]).title}`;
      button.addEventListener("click", () => startContainerInteraction(container.id, action));
      actions.append(button);

      if (!isPitHoleContainer(container) && containerCorpses(container.id).length) {
        for (const remainsAction of ["dumpRemains", "scrapeRemains"]) {
          const remainsBtn = document.createElement("button");
          remainsBtn.type = "button";
          const baseCost = remainsAction === "scrapeRemains" ? REMAINS_SCRAPE_STAMINA : REMAINS_DUMP_STAMINA;
          setButtonStaminaLabel(remainsBtn, remainsHandlingActionLabel(remainsAction), baseCost, ["slimeHandling"]);
          remainsBtn.dataset.remainsAction = remainsAction;
          remainsBtn.dataset.remainsContainerId = container.id;
          const remainsRiskLabel = `${remainsHandlingActionLabel(remainsAction).toLowerCase()} from ${container.name}`;
          const remainsReason = remainsHandlingBlockReason(container, remainsAction)
            || physicalStateRiskBlockReason(remainsRiskLabel)
            || handlingMethodMissingToolReason(currentHandlingMethodId())
            || staminaBlockReason(adjustedStaminaCost(baseCost, ["slimeHandling"]));
          setActionButtonState(remainsBtn, Boolean(remainsReason), remainsReason);
          const remainsRiskTitle = physicalStateRiskTitle(remainsRiskLabel);
          const directRemainsHandlingTitle = handlingRiskTitle(container, remainsAction, currentHandlingMethodId());
          remainsBtn.title = remainsReason || `${handlingMethodActionTitle(currentHandlingMethodId())}\n${remainsRiskTitle ? `${remainsRiskTitle}\n` : ""}${directRemainsHandlingTitle}\n${adjustedStaminaCostBreakdown(baseCost, ["slimeHandling"]).title}`;
          remainsBtn.addEventListener("click", () => startRemainsHandling(container.id, remainsAction));
          actions.append(remainsBtn);
        }
      }

      if (containerOccupants(container.id).length) {
        const transferWrap = document.createElement("div");
        transferWrap.className = "container-live-transfer";
        const transferSelect = document.createElement("select");
        transferSelect.dataset.liveTransferSelect = container.id;
        const candidates = liveTransferDestinationCandidates(container);
        if (candidates.length) {
          for (const candidate of candidates) {
            const option = document.createElement("option");
            option.value = candidate.id;
            option.textContent = `${candidate.name} (${roomName(candidate.roomId)})`;
            transferSelect.append(option);
          }
        } else {
          const option = document.createElement("option");
          option.value = "";
          option.textContent = "No open same-room destination";
          transferSelect.append(option);
        }

        const transferBtn = document.createElement("button");
        transferBtn.type = "button";
        setButtonStaminaLabel(transferBtn, liveTransferActionLabel(), LIVE_TRANSFER_STAMINA, ["slimeHandling"]);
        transferBtn.dataset.liveTransferContainerId = container.id;
        const selectedDestinationId = transferSelect.value;
        const transferRiskLabel = "transferring a living slime";
        const transferReason = liveTransferBlockReason(container, selectedDestinationId)
          || physicalStateRiskBlockReason(transferRiskLabel)
          || handlingMethodMissingToolReason(currentHandlingMethodId())
          || staminaBlockReason(adjustedStaminaCost(LIVE_TRANSFER_STAMINA, ["slimeHandling"]));
        setActionButtonState(transferBtn, Boolean(transferReason), transferReason);
        const transferRiskTitle = physicalStateRiskTitle(transferRiskLabel);
        const directTransferHandlingTitle = handlingRiskTitle(container, "transferLivingSlime", currentHandlingMethodId());
        transferBtn.title = transferReason || `${handlingMethodActionTitle(currentHandlingMethodId())}\n${transferRiskTitle ? `${transferRiskTitle}\n` : ""}${directTransferHandlingTitle}\n${adjustedStaminaCostBreakdown(LIVE_TRANSFER_STAMINA, ["slimeHandling"]).title}`;
        transferBtn.addEventListener("click", () => startLiveSlimeTransfer(container.id, transferSelect.value));
        transferWrap.append(textEl("span", "Destination: "), transferSelect, transferBtn);
        actions.append(transferWrap);
      }

      card.append(actions);
    }

    if (container.type === "synthesis" && occupants.length) {
      const actions = document.createElement("div");
      actions.className = "container-actions";
      const moveBtn = document.createElement("button");
      moveBtn.type = "button";
      const cost = adjustedStaminaCost(HANDLING_STAMINA, ["slimeHandling"]);
      setButtonStaminaLabel(moveBtn, "Move to Open Container", HANDLING_STAMINA, ["slimeHandling"]);
      const tubeMoveRiskLabel = `moving ${occupants[0].name} from the synthesis tube`;
      const reason = !firstOpenPermanentContainer()
        ? "No open permanent container is available."
        : physicalStateRiskBlockReason(tubeMoveRiskLabel)
          || handlingMethodMissingToolReason(currentHandlingMethodId())
          || staminaBlockReason(cost);
      setActionButtonState(moveBtn, Boolean(reason), reason);
      const tubeMoveRiskTitle = physicalStateRiskTitle(tubeMoveRiskLabel);
      moveBtn.title = reason || `${tubeMoveRiskTitle ? `${tubeMoveRiskTitle}\n` : ""}${adjustedStaminaCostBreakdown(HANDLING_STAMINA, ["slimeHandling"]).title}`;
      moveBtn.addEventListener("click", () => moveTubeOccupantToOpenContainer(occupants[0].id));
      actions.append(moveBtn);
      card.append(actions);
    }

    return card;
  }

  function moveTubeOccupantToOpenContainer(slimeId) {
    const slime = findSlime(slimeId);
    if (!slime || !isInSynthesisTube(slime)) {
      addEvent("No synthesis tube occupant is ready to move.");
      persist();
      render();
      return;
    }
    const toolReason = handlingMethodMissingToolReason(currentHandlingMethodId());
    if (toolReason) {
      addEvent(toolReason);
      persist();
      render();
      return false;
    }
    if (!confirmPhysicalStateRiskIfNeeded(`moving ${slime.name} from the synthesis tube`)) {
      return false;
    }
    const cost = adjustedStaminaCost(HANDLING_STAMINA, ["slimeHandling"]);
    if (!spendStamina(cost)) {
      addEvent(`Not enough stamina. ${cost} required.`);
      persist();
      render();
      return;
    }
    const container = moveSlimeToOpenPermanentContainer(slime);
    if (!container) {
      restoreStamina(cost);
      addEvent("No open permanent container is available.");
      persist();
      render();
      return;
    }
    awardXp("slimeHandling", 5, "Slime handling");
    addEvent(`${slime.name} assigned to ${container.name}.`);
    persist();
    render();
  }

  function renderJobs() {
    dom.jobList.textContent = "";
    const living = state.slimes.filter((slime) => slime.status !== "dead");
    const active = living.filter((slime) => {
      normalizeSlimeJob(slime);
      return slime.job !== "idle";
    }).length;
    const eligibleCorpses = (state.corpses || []).filter(isCorpseProcessingTarget).length;
    const protectedCorpses = policyProtectedCorpseCount();
    const wasteUnits = resourceAmount("waste");
    dom.jobSummary.textContent = living.length
      ? `${active} active jobs; ${eligibleCorpses} eligible corpse${eligibleCorpses === 1 ? "" : "s"}${protectedCorpses ? `; ${protectedCorpses} protected by policy` : ""}; ${formatNumber(wasteUnits)} Waste`
      : "No living creatures available for jobs.";

    if (!living.length) {
      dom.jobList.append(emptyText("No living workers."));
      return;
    }

    for (const slime of living) {
      normalizeSlimeJob(slime);
      const row = document.createElement("div");
      row.className = "job-row";

      const details = document.createElement("div");
      const header = document.createElement("div");
      header.className = "job-row-header";
      header.append(slimeNameLink(slime, "entity-link-strong"), textEl("span", slime.mature ? slimeStateLabel(slime) : "immature"));

      const meta = document.createElement("div");
      meta.className = "job-meta";
      meta.append(chip(creatureJobLabel(slime.job)));
      if (slime.job === "corpse") {
        const suitability = observedCorpseProcessingSuitability(slime);
        meta.append(chip(suitability.known ? `estimated ${suitability.band.toLowerCase()}` : "suitability unknown"));
        const target = findCorpse(slime.jobTargetCorpseId);
        meta.append(target ? targetCorpseChip(target) : chip(corpseProcessingUnavailableText()));
        if (target) {
          const remainingChip = chip(jobRemainingText(slime));
          remainingChip.dataset.jobRemaining = slime.id;
          meta.append(remainingChip);
        }
      } else if (slime.job === "disposal") {
        const suitability = observedWasteDisposalSuitability(slime);
        meta.append(chip(suitability.known ? `${suitability.band.toLowerCase()} fit` : "suitability unknown"));
        meta.append(chip(wasteUnits > 0 ? `${formatNumber(wasteUnits)} Waste available` : "no Waste"));
        if (wasteUnits > 0) {
          const remainingChip = chip(jobRemainingText(slime));
          remainingChip.dataset.jobRemaining = slime.id;
          meta.append(remainingChip);
        }
      } else if (slime.job === "cleanup") {
        const suitability = observedCleanupUseSuitability(slime);
        meta.append(chip(`cleanup ${predictionRangeText(suitability.range).toLowerCase()}`));
        meta.append(chip(`${suitability.confidence.label.toLowerCase()} confidence`));
        meta.append(chip(slimeIsUncontained(slime) ? "following instincts" : "must be released to roam"));
      } else {
        const pitsReason = slimeJobSpecificBlockReason(slime, "corpse");
        meta.append(chip(isInSynthesisTube(slime) ? "in synthesis tube" : slimeJobRoomBlockReason(slime) ? "not ready" : pitsReason ? "move to Pits for jobs" : canWorkJob(slime) ? "available" : "not ready"));
      }
      details.append(header, meta);

      if (slime.job === "cleanup") {
        details.append(cleanupUseSuitabilityPanel(slime));
      }

      if (shouldShowJobProgress(slime)) {
        const bar = document.createElement("div");
        bar.className = "job-progress";
        const fill = document.createElement("div");
        fill.className = "job-progress-fill";
        fill.dataset.jobFill = slime.id;
        fill.style.width = `${jobProgressPercent(slime)}%`;
        bar.append(fill);
        details.append(bar);
      }

      const select = document.createElement("select");
      select.className = "job-select";
      select.dataset.jobSlimeId = slime.id;
      const jobReason = jobAssignmentBlockReason(slime);
      select.disabled = Boolean(jobReason);
      select.title = jobReason;
      for (const job of CREATURE_JOBS) {
        const option = document.createElement("option");
        option.value = job.id;
        option.textContent = job.label;
        const optionReason = slimeJobSpecificBlockReason(slime, job.id);
        option.disabled = Boolean(optionReason);
        option.title = optionReason || (job.id === "cleanup" ? cleanupUseOptionTitle(slime) : "");
        select.append(option);
      }
      select.value = slime.job;
      select.addEventListener("change", () => {
        assignCreatureJob(slime.id, select.value);
      });

      row.append(details, select);
      dom.jobList.append(row);
    }
  }

  function startNecropsy(corpse) {
    const duration = necropsyDuration(corpse);
    startStaminaTask({
      type: "necropsy",
      label: `Necropsy ${corpse.name}`,
      baseDuration: duration,
      skillId: "physiology",
      baseXp: 35,
      baseCost: BASE_ACTION_STAMINA,
      data: { corpseId: corpse.id }
    });
  }

  function refreshNecropsyButton(button, corpse) {
    const cost = adjustedStaminaCost(BASE_ACTION_STAMINA, ["physiology", "slimeHandling"]);
    const duration = adjustedDuration(necropsyDuration(corpse), "physiology");
    setButtonStaminaLabel(button, "Necropsy", BASE_ACTION_STAMINA, ["physiology", "slimeHandling"], { duration: formatDuration(duration) });
    const reason = necropsyBlockReason(corpse, cost);
    setActionButtonState(button, Boolean(reason), reason);
  }

  function necropsyBlockReason(corpse, cost) {
    if (!corpse || corpse.ruined) {
      return "Corpse is already ruined.";
    }
    if (hasPendingNecropsy(corpse.id)) {
      return "Necropsy already pending.";
    }
    return staminaBlockReason(cost);
  }

  function necropsyDuration(corpse) {
    const freshness = corpseFreshness(corpse);
    if (freshness === "fresh") {
      return 18;
    }
    if (freshness === "decaying") {
      return 24;
    }
    return 30;
  }

  function dumpCorpseOutside(corpseId) {
    const corpse = findCorpse(corpseId);
    const reason = dumpCorpseBlockReason(corpse);
    if (reason) {
      addEvent(reason);
      persist();
      render();
      return;
    }
    removeCorpseRecord(corpse.id);
    addEvent(`${corpse.name} was dumped outside. Evidence risk increased.`);
    addSuspicion(dumpSuspicionForCorpse(corpse));
    persist();
    render();
  }

  function dumpCorpseBlockReason(corpse) {
    if (!corpse) {
      return "Corpse not found.";
    }
    if (hasPendingNecropsy(corpse.id)) {
      return "Necropsy already pending.";
    }
    return "";
  }

  function dumpSuspicionForCorpse(corpse) {
    return DUMP_SUSPICION[corpseFreshness(corpse)] || DUMP_SUSPICION.decaying;
  }

  function assignCreatureJob(slimeId, jobId) {
    const slime = findSlime(slimeId);
    if (!slime) {
      return;
    }
    normalizeSlimeJob(slime);
    const nextJob = CREATURE_JOBS.some((job) => job.id === jobId) ? jobId : "idle";
    const jobReason = jobAssignmentBlockReason(slime);
    if (nextJob !== "idle" && jobReason) {
      addEvent(`${slime.name} cannot be assigned: ${jobReason}`);
      persist();
      render();
      return;
    }
    const jobSpecificReason = slimeJobSpecificBlockReason(slime, nextJob);
    if (nextJob !== "idle" && jobSpecificReason) {
      addEvent(`${slime.name} cannot be assigned: ${jobSpecificReason}`);
      persist();
      render();
      return;
    }
    slime.job = nextJob;
    slime.jobProgress = 0;
    slime.jobTargetCorpseId = null;
    if (nextJob === "corpse") {
      assignCorpseTarget(slime, reservedCorpseTargets(slime.id));
      addEvent(slime.jobTargetCorpseId
        ? `${slime.name} assigned to corpse processing.`
        : `${slime.name} assigned to corpse processing; ${corpseProcessingUnavailableText()} is waiting.`);
    } else if (nextJob === "disposal") {
      ensureJobKnowledge(slime, "disposal");
      addEvent(resourceAmount("waste") > 0
        ? `${slime.name} assigned to waste disposal.`
        : `${slime.name} assigned to waste disposal; no Waste is waiting.`);
    } else if (nextJob === "cleanup") {
      ensureJobKnowledge(slime, "cleanup");
      addEvent(`${slime.name} marked for cleanup use. It will still follow instincts; use doors to limit roaming.`);
    } else {
      addEvent(`${slime.name} set to idle.`);
    }
    persist();
    render();
  }

  function updateCreatureJobs(minutes) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!elapsed) {
      return 0;
    }
    return updateCorpseProcessingJobs(elapsed) + updateWasteDisposalJobs(elapsed);
  }

  function updateFeedstockIncome(minutes) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!elapsed) {
      return 0;
    }
    state.feedstockIncomeProgress = normalizeFeedstockIncomeProgress(state.feedstockIncomeProgress);
    let changes = 0;
    for (const feedstock of FEEDSTOCK_DEFS.filter((candidate) => candidate.passive)) {
      const gain = elapsed * (PASSIVE_FEEDSTOCK_INCOME_PER_DAY / 1440);
      const nextProgress = (state.feedstockIncomeProgress[feedstock.key] || 0) + gain;
      const wholeUnits = Math.floor(nextProgress);
      state.feedstockIncomeProgress[feedstock.key] = nextProgress - wholeUnits;
      if (wholeUnits > 0 && addResource(feedstock.key, wholeUnits)) {
        changes += 1;
      }
    }
    return changes;
  }

  function updateAutoFeeding() {
    state.policies = normalizePolicies(state.policies);
    const policy = state.policies.feeding;
    if (policy.mode === "disabled") {
      return 0;
    }
    let changes = 0;
    for (const slime of state.slimes || []) {
      if (!canAutoFeedSlime(slime, policy)) {
        continue;
      }
      let guard = 0;
      while (guard < 12 && shouldAutoFeedSlime(slime, policy)) {
        const feedstockKey = chooseAutoFeedstock(slime, policy);
        if (!feedstockKey) {
          break;
        }
        if (!feedSlime(slime, feedstockKey, { source: "auto" })) {
          break;
        }
        changes += 1;
        guard += 1;
        if (!canAutoFeedSlime(slime, policy)) {
          break;
        }
      }
    }
    return changes;
  }

  function canAutoFeedSlime(slime, policy) {
    return Boolean(slime && slime.status !== "dead" && !slime.automationExcluded && policy.mode !== "disabled");
  }

  function shouldAutoFeedSlime(slime, policy) {
    if (environmentCanCurrentlyFeed(slime)) {
      return false;
    }
    const nutrition = slimeStat(slime, "nutrition").current;
    const mass = slimeStat(slime, "currentMass").current;
    const target = autoFeedTargetNutrition(policy);
    if (nutrition >= target) {
      return false;
    }
    const threshold = autoFeedThreshold(policy);
    if (nutrition < threshold) {
      return true;
    }
    if (policy.mode === "emergency") {
      return false;
    }
    if (policy.mode === "reproduction" && policy.allowReproductionPressure) {
      return true;
    }
    if (["regrow", "full"].includes(policy.massGoal) && mass < 100) {
      return true;
    }
    if (policy.mode === "growth" && mass < 100) {
      return true;
    }
    return false;
  }

  function autoFeedThreshold(policy) {
    const base = clamp(Math.round(Number(policy.feedBelow) || AUTO_FEED_DEFAULTS.feedBelow), 1, 100);
    return policy.mode === "emergency" ? Math.min(base, 25) : base;
  }

  function autoFeedTargetNutrition(policy) {
    let target = clamp(Math.round(Number(policy.feedUntil) || AUTO_FEED_DEFAULTS.feedUntil), 1, 100);
    if (policy.mode === "emergency") {
      target = Math.min(target, 35);
    }
    if (policy.mode === "reproduction" && policy.allowReproductionPressure) {
      target = Math.max(target, 95);
    }
    if (!policy.allowReproductionPressure) {
      target = Math.min(target, DIVISION_NUTRITION_THRESHOLD - 1);
    }
    return target;
  }

  function chooseAutoFeedstock(slime, policy) {
    const known = Boolean(slime.revealed?.sustenance);
    if (!known && !policy.allowUnknownSustenance) {
      return "";
    }
    const available = allowedFeedstockDefs(policy);
    if (!available.length) {
      return "";
    }
    if (known && policy.usePreferredWhenKnown) {
      const preferred = preferredFeedstockKeys(slime)
        .map((key) => FEEDSTOCK_BY_KEY[key])
        .filter(Boolean)
        .filter((feedstock) => feedstockAllowedByPolicy(feedstock, policy) && feedstockAvailable(feedstock.key, policy));
      if (preferred.length) {
        return preferred[0].key;
      }
    }
    if (!known) {
      return available[0]?.key || "";
    }
    const ranked = available
      .map((feedstock) => ({ feedstock, match: feedstockMatch(slime, feedstock.key) }))
      .filter((entry) => policyAllowsFeedMatch(entry.match.quality, policy))
      .sort((a, b) => feedMatchRank(b.match.quality) - feedMatchRank(a.match.quality));
    return ranked[0]?.feedstock.key || "";
  }

  function allowedFeedstockDefs(policy) {
    return FEEDSTOCK_DEFS.filter((feedstock) => feedstockAllowedByPolicy(feedstock, policy) && feedstockAvailable(feedstock.key, policy));
  }

  function feedstockAllowedByPolicy(feedstock, policy) {
    if (feedstock.key === "carrionFeedstock" && !policy.allowCarrion) {
      return false;
    }
    if (feedstock.key === "contaminatedFeedstock" && !policy.allowContaminated) {
      return false;
    }
    return true;
  }

  function feedstockAvailable(feedstockKey, policy = null) {
    const reserve = Math.max(0, Math.floor(Number(policy?.preserveReserve) || 0));
    return resourceAmount(feedstockKey) > reserve;
  }

  function policyAllowsFeedMatch(quality, policy) {
    if (quality === "good") {
      return true;
    }
    if (quality === "partial") {
      return policy.allowPartialMatches;
    }
    if (quality === "bad") {
      return policy.allowBadMatches;
    }
    if (quality === "harmful") {
      return policy.allowHarmfulFeeding;
    }
    return false;
  }

  function feedMatchRank(quality) {
    return { harmful: 0, bad: 1, partial: 2, good: 3 }[quality] || 0;
  }

  function feedSlime(slime, feedstockKey, options = {}) {
    const feedstock = FEEDSTOCK_BY_KEY[feedstockKey];
    if (!slime || slime.status === "dead" || !feedstock || resourceAmount(feedstock.key) <= 0) {
      return false;
    }
    const match = feedstockMatch(slime, feedstock.key);
    const effects = FEED_MATCH_EFFECTS[match.quality] || FEED_MATCH_EFFECTS.bad;
    addResource(feedstock.key, -1);
    adjustSlimeStat(slime, "nutrition", effects.nutrition);
    const mass = slimeStat(slime, "currentMass");
    const massGain = Math.max(0, Math.min(effects.mass, mass.max - mass.current));
    if (massGain > 0) {
      adjustSlimeStat(slime, "currentMass", massGain);
    }
    if (effects.stress) {
      adjustSlimeStat(slime, "stress", effects.stress);
    }
    if (effects.bodyDamage) {
      if (slimeStat(slime, "bodyIntegrity").current - effects.bodyDamage <= 0) {
        slime.deathCause = "bad feeding";
      }
      adjustSlimeStat(slime, "bodyIntegrity", -effects.bodyDamage);
    }
    if (effects.waste) {
      addWaste(effects.waste, ["feeding", ...feedstock.tags]);
    }
    addEvent(`${slime.name} ${options.source === "auto" ? "auto-fed" : "fed"} ${feedstock.label}: ${effects.label}, +${effects.nutrition} Nutrition${massGain ? `, +${formatNumber(massGain)} Current Mass` : ""}.`);
    expireSlimes();
    return true;
  }

  function feedstockMatch(slime, feedstockKey) {
    const feedstock = FEEDSTOCK_BY_KEY[feedstockKey];
    const evaluated = evaluateGenome(slime.genome);
    const label = baseOutcomeLabel(evaluated.traits.sustenance);
    const preferred = preferredFeedstockKeys(slime);
    if (preferred.includes(feedstockKey)) {
      return { quality: "good", label, sharedTags: [...feedstock.tags] };
    }
    const sustenanceTags = new Set(evaluated.traits.sustenance.meta?.tags || []);
    const sharedTags = feedstock.tags.filter((tag) => sustenanceTags.has(tag) && !["material", "waste", "clean"].includes(tag));
    if (sharedTags.length) {
      return { quality: "partial", label, sharedTags };
    }
    if (feedstock.tags.some((tag) => ["hazardous", "contaminated", "volatile"].includes(tag))) {
      return { quality: "harmful", label, sharedTags: [] };
    }
    return { quality: "bad", label, sharedTags: [] };
  }

  function preferredFeedstockKeys(slime) {
    const evaluated = evaluateGenome(slime.genome);
    const label = baseOutcomeLabel(evaluated.traits.sustenance);
    return [...(PREFERRED_FEEDSTOCKS_BY_SUSTENANCE[label] || [])];
  }

  function bestAvailableFeedstockKey(slime) {
    return preferredFeedstockKeys(slime).find((key) => resourceAmount(key) > 0) || "";
  }



  function scientistRoomId() {
    state.scientist = normalizeScientist(state.scientist);
    return state.scientist.roomId || MAIN_ROOM_ID;
  }

  function scientistObservesRoom(roomId) {
    return (roomId || MAIN_ROOM_ID) === scientistRoomId();
  }


  function scientistMoveTask() {
    return (state.tasks || []).find((task) => task.type === "scientistMove") || null;
  }

  function scientistMoveBlockReason(toRoomId) {
    const target = roomById(toRoomId);
    if (!target) {
      return "No connected room selected.";
    }
    if (scientistIsDead()) {
      return "The scientist is dead.";
    }
    if (scientistMoveTask()) {
      return "The scientist is already moving.";
    }
    const fromRoomId = scientistRoomId();
    if (fromRoomId === target.id) {
      return "The scientist is already there.";
    }
    if (!roomConnectedIds(fromRoomId).includes(target.id)) {
      return "The scientist can only move to connected rooms.";
    }
    return "";
  }

  function startScientistMove(toRoomId) {
    const target = roomById(toRoomId);
    const reason = scientistMoveBlockReason(toRoomId);
    if (reason) {
      addEvent(reason);
      persist();
      render();
      return false;
    }
    const cost = adjustedStaminaCost(SCIENTIST_MOVE_BASE_STAMINA, ["observation"]);
    if (!spendStamina(cost)) {
      addEvent(`Not enough stamina. ${cost} required.`);
      persist();
      render();
      return false;
    }
    const fromRoomId = scientistRoomId();
    const duration = adjustedDuration(SCIENTIST_MOVE_BASE_DURATION, "observation");
    const route = roomRouteBetween(fromRoomId, target.id, { ignoreDoors: true });
    const task = {
      id: `task-${state.nextTaskNumber++}`,
      type: "scientistMove",
      label: `Move scientist to ${target.name}`,
      createdAt: state.clock,
      dueAt: state.clock + duration,
      data: {
        fromRoomId,
        toRoomId: target.id,
        route,
        doorTransit: doorTransitPlan(route),
        staminaCost: cost
      }
    };
    state.tasks.push(task);
    const closedDoors = task.data.doorTransit.filter((step) => step.previousState === DOOR_STATE_CLOSED).length;
    addEvent(`Scientist movement started: ${roomName(fromRoomId)} to ${target.name}${closedDoors ? "; closed doors will be opened and handled by policy" : ""}.`);
    persist();
    render();
    return true;
  }

  function completeScientistMove(task) {
    const target = roomById(task.data?.toRoomId);
    if (!target) {
      addEvent("Scientist movement could not complete; the room no longer exists.");
      return false;
    }
    const fromRoomId = state.scientist?.roomId || task.data?.fromRoomId || MAIN_ROOM_ID;
    state.scientist = normalizeScientist(state.scientist);
    state.scientist.roomId = target.id;
    applyDoorTransitPolicy(task.data?.doorTransit, "Scientist movement");
    addEvent(`Arrived in ${target.name}.`);
    observeScientistRoom({ discoverChanges: true });
    return true;
  }


  function roomExposureBand(value) {
    const score = clamp(Number(value) || 0, 0, 100);
    return ROOM_EXPOSURE_BANDS.find((band) => score <= band.max) || ROOM_EXPOSURE_BANDS[ROOM_EXPOSURE_BANDS.length - 1];
  }

  function roomExposureScore(roomOrId) {
    const room = typeof roomOrId === "string" ? roomById(roomOrId) : roomOrId;
    if (!room) {
      return 0;
    }
    const contamination = roomContaminationValue(room.id);
    const crowdingPressure = Math.max(0, roomCrowdingPressureScore(room)) * 0.65;
    const freePressure = freeCreaturesInRoom(room.id).length ? Math.min(14, freeCreaturesInRoom(room.id).length * 5) : 0;
    return clamp(contamination + crowdingPressure + freePressure, 0, 100);
  }

  function currentRoomExposureFactors(room) {
    const roomId = room?.id || MAIN_ROOM_ID;
    const contamination = roomContaminationValue(roomId);
    const knownFactors = [];
    const unknownFactors = [];
    if (contamination >= 78) {
      knownFactors.push("hazardous contamination");
    } else if (contamination >= 55) {
      knownFactors.push("fouled air");
    } else if (contamination >= 30) {
      knownFactors.push("tainted residue");
    } else if (contamination <= 8) {
      knownFactors.push("cleaner air");
    } else {
      knownFactors.push("stale air");
    }

    const crowding = roomCrowdingLabel(roomId);
    if (["Busy", "Crowded", "Overpacked"].includes(crowding)) {
      knownFactors.push(`room is ${crowding.toLowerCase()}`);
    }

    const freeCreatures = freeCreaturesInRoom(roomId);
    if (freeCreatures.length) {
      knownFactors.push(`${freeCreatures.length} uncontained creature${freeCreatures.length === 1 ? "" : "s"} observed`);
      for (const slime of freeCreatures.slice(0, 2)) {
        if (slimeHuntingInclination(slime) && (skillLevel("ethology") >= FREE_CREATURE_PRESSURE_HIGH_SKILL || slimeTraitKnown(slime, "behavior"))) {
          knownFactors.push(`${slime.name} shows hunting behavior`);
        } else if (!slimeTraitKnown(slime, "behavior") && skillLevel("ethology") < FREE_CREATURE_PRESSURE_HIGH_SKILL) {
          unknownFactors.push(`${slime.name} behavior`);
        }
        if (!slimeTraitKnown(slime, "byproduct") && skillLevel("arcaneChemistry") < FREE_CREATURE_PRESSURE_HIGH_SKILL) {
          unknownFactors.push(`${slime.name} contact hazards`);
        }
      }
    }

    return {
      knownFactors: [...new Set(knownFactors)].slice(0, 5),
      unknownFactors: [...new Set(unknownFactors)].slice(0, 5)
    };
  }

  function roomObservationReliabilityScore(room, observation) {
    if (!observation) {
      return 0;
    }
    if (scientistObservesRoom(room.id)) {
      return 100;
    }
    let score = 72;
    const age = Math.max(0, state.clock - (Number(observation.observedAt) || 0));
    if (age > 360) score -= 36;
    else if (age > 60) score -= 22;
    else if (age > 15) score -= 12;
    else if (age > 3) score -= 5;

    if (observation.freeCreatureCount > 0) {
      score -= 18;
    }
    if (observation.crowdingLabel === "Crowded" || observation.crowdingLabel === "Overpacked") {
      score -= 10;
    }
    if (observation.exposureScore >= 65) {
      score -= 8;
    }
    score += Math.min(12, skillLevel("observation") * 3);
    return clamp(score, 0, 100);
  }

  function roomObservationReliabilityLabel(score) {
    return (ROOM_OBSERVATION_RELIABILITY_BANDS.find((band) => score >= band.min) || ROOM_OBSERVATION_RELIABILITY_BANDS[ROOM_OBSERVATION_RELIABILITY_BANDS.length - 1]).label;
  }

  function roomObservationReliabilityFactors(room, observation, score) {
    if (!observation) {
      return ["no prior observation"];
    }
    if (scientistObservesRoom(room.id)) {
      return ["current observation"];
    }
    const factors = [];
    const age = Math.max(0, state.clock - (Number(observation.observedAt) || 0));
    if (age > 360) factors.push("old observation");
    else if (age > 60) factors.push("aging observation");
    else factors.push("recent observation");

    const creatureUncertaintyKnown =
      observation.freeCreatureCount > 0 ||
      (observation.knownFactors || []).some((factor) => /creature|RG-|hunting/i.test(factor)) ||
      (observation.unknownFactors || []).some((factor) => /creature|behavior|contact hazards|RG-/i.test(factor));

    if (creatureUncertaintyKnown || !scientistObservesRoom(room.id)) {
      factors.push("creature movement may have changed conditions");
    }
    if (observation.exposureScore >= 65) {
      factors.push("hazardous rooms change quickly");
    }
    if (observation.crowdingLabel === "Crowded" || observation.crowdingLabel === "Overpacked") {
      factors.push("crowded room");
    }
    if (score >= 58) {
      factors.push("stable enough to use cautiously");
    }
    return [...new Set(factors)].slice(0, 4);
  }

  function roomObservationCreatureIds(roomId, filterFn = null) {
    return freeCreaturesInRoom(roomId)
      .filter((slime) => !filterFn || filterFn(slime))
      .map((slime) => slime.id)
      .filter(Boolean);
  }

  function makeRoomObservation(room) {
    const exposureScore = roomExposureScore(room);
    const exposureBand = roomExposureBand(exposureScore);
    const factors = currentRoomExposureFactors(room);
    const contaminationValue = roomContaminationValue(room.id);
    const freeCreatureIds = roomObservationCreatureIds(room.id);
    const cleanupActorIds = roomObservationCreatureIds(room.id, (slime) =>
      ["feedingOnContamination", "seekingContamination", "leavingResidue"].includes(slime.roomActivity?.type)
    );
    const residueActorIds = roomObservationCreatureIds(room.id, (slime) =>
      slime.roomActivity?.type === "leavingResidue"
    );
    return {
      observedAt: state.clock,
      exposureScore: Math.round(exposureScore),
      exposureBand: exposureBand.label,
      effect: exposureBand.effect,
      knownFactors: factors.knownFactors,
      unknownFactors: factors.unknownFactors,
      contaminationValue: Math.round(contaminationValue * 10) / 10,
      contaminationBand: roomAttributeBand("contamination", contaminationValue).label,
      crowdingLabel: roomCrowdingLabel(room.id),
      freeCreatureCount: freeCreatureIds.length,
      freeCreatureIds,
      cleanupActorIds,
      residueActorIds
    };
  }

  function idList(value) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }

  function idListsDiffer(a, b) {
    const left = [...new Set(idList(a))].sort();
    const right = [...new Set(idList(b))].sort();
    return left.length !== right.length || left.some((id, index) => id !== right[index]);
  }

  function namesForSlimeIds(ids) {
    return idList(ids)
      .map((id) => findSlime(id)?.name || "")
      .filter(Boolean);
  }

  function formatNameList(names) {
    const clean = [...new Set((names || []).map(String).filter(Boolean))];
    if (clean.length <= 1) {
      return clean[0] || "";
    }
    if (clean.length === 2) {
      return `${clean[0]} and ${clean[1]}`;
    }
    return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
  }

  function roomChangeSentence(parts) {
    const clean = (parts || []).filter(Boolean);
    if (!clean.length) {
      return "";
    }
    if (clean.length === 1) {
      return clean[0];
    }
    if (clean.length === 2) {
      return `${clean[0]}, but ${clean[1]}`;
    }
    return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
  }

  function roomChangeDiscoveryMessage(room, previousObservation, currentObservation) {
    const previous = normalizeRoomObservation(previousObservation);
    const current = normalizeRoomObservation(currentObservation);
    if (!room || !previous || !current || current.observedAt <= previous.observedAt) {
      return "";
    }

    const changes = [];
    const previousContamination = Number(previous.contaminationValue);
    const currentContamination = Number(current.contaminationValue);
    if (Number.isFinite(previousContamination) && Number.isFinite(currentContamination)) {
      const delta = currentContamination - previousContamination;
      if (delta <= -2) {
        changes.push("the contamination is lower");
      } else if (delta >= 2) {
        changes.push("the contamination is higher");
      }
    }

    if (idListsDiffer(previous.residueActorIds, current.residueActorIds) && current.residueActorIds.length) {
      changes.push("there is more trace slime");
    }

    if (idListsDiffer(previous.freeCreatureIds, current.freeCreatureIds)) {
      changes.push("free creature presence changed");
    }

    if (!changes.length) {
      return "";
    }

    const details = [];
    const cleanupNames = namesForSlimeIds(current.cleanupActorIds);
    const residueNames = namesForSlimeIds(current.residueActorIds);
    const freeNames = namesForSlimeIds(current.freeCreatureIds);
    const contaminationLower = changes.includes("the contamination is lower");
    const traceHigher = changes.includes("there is more trace slime");

    if (contaminationLower && cleanupNames.length) {
      const names = formatNameList(cleanupNames.slice(0, 3));
      details.push(`${names} ${cleanupNames.length === 1 ? "is" : "are"} present; biological cleanup is a plausible cause.`);
    } else if (contaminationLower && freeNames.length) {
      const names = formatNameList(freeNames.slice(0, 3));
      details.push(`${names} ${freeNames.length === 1 ? "is" : "are"} present; involvement uncertain.`);
    } else if (contaminationLower) {
      details.push("Cause uncertain.");
    }

    if (traceHigher && residueNames.length) {
      const names = formatNameList(residueNames.slice(0, 3));
      details.push(`${names} may be leaving residue.`);
    }

    return [`This room changed: ${roomChangeSentence(changes)}.`, ...details].join(" ");
  }

  function observeScientistRoom(options = {}) {
    const room = roomById(scientistRoomId());
    if (!room) {
      return null;
    }
    const previous = normalizeRoomObservation(room.observation || state.roomObservations?.[room.id]);
    const observation = normalizeRoomObservation(makeRoomObservation(room));
    if (options.discoverChanges) {
      const message = roomChangeDiscoveryMessage(room, previous, observation);
      if (message && state.events.at(-1)?.message !== message) {
        addEvent(message);
      }
    }
    room.observation = observation;
    state.roomObservations ||= {};
    state.roomObservations[room.id] = observation;
    return observation;
  }

  function roomExposurePanelEl(room) {
    const panel = document.createElement("div");
    panel.className = "room-exposure-panel";
    panel.dataset.roomExposurePanel = room.id;

    if (scientistObservesRoom(room.id)) {
      const observation = room.observation || makeRoomObservation(room);
      const exposureLine = document.createElement("strong");
      exposureLine.append(document.createTextNode("Room exposure: "), tooltipKeywordEl(observation.exposureBand));
      panel.append(exposureLine);
      panel.append(textEl("div", "Information: Current observation"));
      const reliabilityLine = document.createElement("div");
      reliabilityLine.append(document.createTextNode("Reliability: "), tooltipKeywordEl("High"));
      panel.append(reliabilityLine);
      if (observation.knownFactors?.length) {
        panel.append(textEl("div", `Known factors: ${observation.knownFactors.join(" · ")}`));
      }
      if (observation.unknownFactors?.length) {
        panel.append(textEl("div", `Unknown factors: ${observation.unknownFactors.join(", ")}`));
      }
      panel.append(textEl("div", `Effect: ${observation.effect}`));
      return panel;
    }

    const observation = room.observation || state.roomObservations?.[room.id] || null;
    if (!observation) {
      const unknownLine = document.createElement("strong");
      unknownLine.append(document.createTextNode("Room exposure: "), tooltipKeywordEl("Unknown"));
      panel.append(unknownLine);
      panel.append(textEl("div", "Information: No observation"));
      const unknownReliability = document.createElement("div");
      unknownReliability.append(document.createTextNode("Reliability: "), tooltipKeywordEl("Unknown"));
      panel.append(unknownReliability);
      panel.append(textEl("div", "Unknown factors: current contamination, creature movement, residue"));
      panel.append(textEl("div", "Effect: cannot assess from here"));
      return panel;
    }

    const score = roomObservationReliabilityScore(room, observation);
    const reliability = roomObservationReliabilityLabel(score);
    const factors = roomObservationReliabilityFactors(room, observation, score);

    const thenLine = document.createElement("strong");
    thenLine.append(document.createTextNode("Room exposure then: "), tooltipKeywordEl(observation.exposureBand));
    panel.append(thenLine);
    panel.append(textEl("div", "Information: Previously observed"));
    const previousReliability = document.createElement("div");
    previousReliability.append(document.createTextNode("Reliability: "), tooltipKeywordEl(reliability));
    panel.append(previousReliability);
    if (observation.knownFactors?.length) {
      panel.append(textEl("div", `Known factors then: ${observation.knownFactors.join(" · ")}`));
    }
    const uncertainFactors = [
      ...(observation.unknownFactors || []),
      "current contamination",
      "current creature movement"
    ];
    panel.append(textEl("div", `Uncertain factors: ${[...new Set(uncertainFactors)].slice(0, 5).join(", ")}`));
    panel.append(textEl("div", `Reliability factors: ${factors.join(" · ")}`));
    panel.append(textEl("div", `Effect then: ${observation.effect}`));
    return panel;
  }

  function roomMoveWarningText(roomId) {
    const room = roomById(roomId);
    if (!room) {
      return "Unknown destination.";
    }
    if (scientistObservesRoom(room.id)) {
      const observation = room.observation || makeRoomObservation(room);
      return `Current observation. Room exposure: ${observation.exposureBand}. Reliability: High.`;
    }
    const observation = room.observation || state.roomObservations?.[room.id];
    if (!observation) {
      return "No observation. Room exposure unknown. Current contamination, creature movement, and residue are unknown.";
    }
    const score = roomObservationReliabilityScore(room, observation);
    const reliability = roomObservationReliabilityLabel(score);
    return `Previously observed. Room exposure then: ${observation.exposureBand}. Reliability: ${reliability}. Current contamination and creature movement may have changed.`;
  }

  function restQualityInfo(roomId = scientistRoomId()) {
    const room = roomById(roomId);
    const exposureScore = roomExposureScore(room || roomId);
    const exposureBand = roomExposureBand(exposureScore);
    const contamination = roomContaminationValue(roomId);
    const knownFactors = [];
    const freeCount = freeCreaturesInRoom(roomId).length;

    if (contamination <= 8) {
      knownFactors.push("cleaner air");
    } else if (contamination < 30) {
      knownFactors.push("low room exposure");
    } else if (contamination < 55) {
      knownFactors.push("tainted residue");
    } else if (contamination < 78) {
      knownFactors.push("fouled air");
    } else {
      knownFactors.push("hazardous contamination");
    }

    const crowding = roomCrowdingLabel(roomId);
    if (["Crowded", "Overpacked"].includes(crowding)) {
      knownFactors.push(`room is ${crowding.toLowerCase()}`);
    }

    if (freeCount > 0) {
      knownFactors.push("uncontained creature activity");
    }

    let label = "Good";
    let expectedEffect = "Physical State may improve";
    if (exposureBand.label === "Hazardous" || exposureBand.label === "Unlivable" || contamination >= 78 || freeCount > 0) {
      label = "Unsafe";
      expectedEffect = "Physical State may continue worsening";
    } else if (["Tainted", "Fouled"].includes(exposureBand.label) || contamination >= 30) {
      label = "Poor";
      expectedEffect = "Physical State recovery may be weak";
    }

    const title = `${label}\nKnown factors: ${[...new Set(knownFactors)].join(" · ") || "no major hazards observed"}\nExpected effect: ${expectedEffect}`;
    return {
      label,
      exposureBand: exposureBand.label,
      exposureScore: Math.round(exposureScore),
      knownFactors: [...new Set(knownFactors)],
      expectedEffect,
      title,
      unsafe: label === "Unsafe",
      roomId
    };
  }

  function restQualityPanelEl() {
    const info = restQualityInfo();
    const panel = document.createElement("div");
    panel.className = "rest-quality-panel";
    panel.dataset.restQualityPanel = "scientist";
    const line = document.createElement("div");
    line.append(document.createTextNode("Rest quality: "), tooltipKeywordEl(info.label, info.title));
    line.dataset.restQuality = info.label;
    panel.append(line);
    return panel;
  }

  function confirmUnsafeRestIfNeeded(minutes) {
    const info = restQualityInfo();
    if (!info.unsafe) {
      return true;
    }
    const message = `Resting here is unsafe.\n${info.expectedEffect}.\n\nContinue resting?`;
    const accepted = window.confirm(message);
    if (accepted) {
      addEvent(`Unsafe rest confirmed in ${roomName(info.roomId)}. Physical State may continue worsening.`);
    } else {
      addEvent("Unsafe rest cancelled.");
    }
    return accepted;
  }




  function scientistLocationPanelEl(room) {
    const panel = document.createElement("div");
    panel.className = "scientist-location-panel";
    panel.dataset.scientistLocationPanel = room.id;
    if (scientistRoomId() === room.id) {
      panel.append(textEl("strong", "Scientist present"));
      const moveTargets = roomConnectedIds(room.id);
      if (moveTargets.length) {
        const moves = document.createElement("div");
        moves.className = "scientist-move-actions";
        moves.append(textEl("span", "Move to: "));
        for (const [index, targetId] of moveTargets.entries()) {
          const target = roomById(targetId);
          const button = document.createElement("button");
          button.type = "button";
          const moveCost = setButtonStaminaLabel(button, target.name, SCIENTIST_MOVE_BASE_STAMINA, ["observation"]);
          button.dataset.scientistMoveRoomId = target.id;
          const reason = scientistMoveBlockReason(target.id) || staminaBlockReason(moveCost);
          setActionButtonState(button, Boolean(reason), reason);
          if (!reason) {
            button.title = `${roomMoveWarningText(target.id)}\n${adjustedStaminaCostBreakdown(SCIENTIST_MOVE_BASE_STAMINA, ["observation"]).title}`;
          }
          button.addEventListener("click", () => startScientistMove(target.id));
          if (index > 0) {
            moves.append(document.createTextNode(" · "));
          }
          moves.append(button);
        }
        panel.append(moves);
      }
    } else {
      panel.append(textEl("span", "Scientist absent"));
    }
    return panel;
  }


  function freeCreaturesInRoom(roomId) {
    return (state.slimes || []).filter((slime) => slimeIsUncontained(slime) && slime.status !== "dead" && slimeEffectiveRoomId(slime) === roomId);
  }

  function freeCreatureActualPressureScore(slime) {
    let score = 6;
    const stress = slimeStat(slime, "stress").current;
    if (stress >= 85) score += 18;
    else if (stress >= 60) score += 10;

    if (slimeHuntingInclination(slime)) score += 20;
    const info = slimeContaminationTraitInfo(slime);
    if (info.spreadsContamination) score += 10;

    const evaluated = evaluateGenome(slime.genome);
    const appendages = String(evaluated.traits.appendages?.id || "");
    if (appendages && appendages !== "none") score += 8;

    const stability = String(evaluated.traits.stability?.label || "").toLowerCase();
    if (/unstable|volatile|fragile|failing/.test(stability)) score += 8;

    return score;
  }

  function freeCreaturePressureBand(score) {
    if (score >= 50) return "Severe";
    if (score >= 32) return "Dangerous";
    if (score >= 16) return "Watch";
    return "Low";
  }

  function observedFreeCreaturePressure(room) {
    const roomId = room?.id || MAIN_ROOM_ID;
    if (!scientistObservesRoom(roomId)) {
      return {
        label: "Unobserved",
        className: "container-band-unknown",
        knownFactors: [],
        unknownFactors: ["scientist is not in this room"],
        estimate: "cannot assess from here",
        observed: false
      };
    }

    const creatures = freeCreaturesInRoom(roomId);
    if (!creatures.length) {
      return {
        label: "None",
        className: "container-band-good",
        knownFactors: ["no uncontained creatures observed"],
        unknownFactors: [],
        estimate: "no free-creature pressure observed",
        observed: true
      };
    }

    let score = creatures.length * 4 + roomCrowdingPressureScore(room);
    let unknownMajor = 0;
    const knownFactors = [`${creatures.length} uncontained creature${creatures.length === 1 ? "" : "s"} observed`];
    const crowdingReason = roomCrowdingPressureReason(room);
    if (crowdingReason) {
      knownFactors.push(crowdingReason);
    }
    const unknownFactors = [];
    const skill = Math.max(skillLevel("observation"), skillLevel("ethology"), skillLevel("slimeHandling"));
    const highSkill = skill >= FREE_CREATURE_PRESSURE_HIGH_SKILL;

    for (const slime of creatures) {
      score += freeCreatureActualPressureScore(slime);
      const stress = slimeStat(slime, "stress").current;
      if (stress >= 80) {
        knownFactors.push(`${slime.name} appears highly stressed`);
      } else if (stress >= 55) {
        knownFactors.push(`${slime.name} appears agitated`);
      }

      if (highSkill || slimeTraitKnown(slime, "behavior")) {
        if (slimeHuntingInclination(slime)) {
          knownFactors.push(`${slime.name} shows hunting behavior`);
        } else {
          knownFactors.push(`${slime.name}'s behavior has been observed`);
        }
      } else {
        unknownFactors.push(`${slime.name} behavior`);
        unknownMajor += 1;
      }

      if (highSkill || slimeTraitKnown(slime, "appendages")) {
        const appendages = String(evaluateGenome(slime.genome).traits.appendages?.id || "");
        if (appendages && appendages !== "none") {
          knownFactors.push(`${slime.name} has reaching appendages`);
        }
      } else {
        unknownFactors.push(`${slime.name} appendages`);
        unknownMajor += 1;
      }

      if (highSkill || slimeTraitKnown(slime, "element") || slimeTraitKnown(slime, "byproduct")) {
        const info = slimeContaminationTraitInfo(slime);
        if (info.spreadsContamination) {
          knownFactors.push(`${slime.name} may leave residue`);
        }
      } else {
        unknownFactors.push(`${slime.name} contact hazards`);
        unknownMajor += 1;
      }
    }

    const band = freeCreaturePressureBand(score);
    let label = band;
    let estimate = `${band.toLowerCase()} pressure`;
    if (!highSkill && unknownMajor >= 3) {
      label = "Unknown";
      estimate = "cannot assess safely";
    } else if (!highSkill && unknownMajor > 0) {
      label = `Estimated ${band}`;
      estimate = `${band.toLowerCase()} pressure estimate`;
    }

    return {
      label,
      className: band === "Severe" || band === "Dangerous" ? "container-band-bad" : band === "Watch" ? "container-band-watch" : "container-band-good",
      knownFactors: [...new Set(knownFactors)].slice(0, 5),
      unknownFactors: [...new Set(unknownFactors)].slice(0, 5),
      estimate,
      observed: true
    };
  }

  function freeCreaturePressureEl(room) {
    const pressure = observedFreeCreaturePressure(room);
    const panel = document.createElement("div");
    panel.className = "room-free-pressure";
    panel.dataset.freeCreaturePressureRoom = room.id;
    panel.append(textEl("strong", `Free creature pressure: ${pressure.label}`));
    if (pressure.knownFactors.length) {
      panel.append(textEl("div", `Known factors: ${pressure.knownFactors.join(" · ")}`));
    }
    if (pressure.unknownFactors.length) {
      panel.append(textEl("div", `Unknown factors: ${pressure.unknownFactors.join(", ")}`));
    }
    if (pressure.estimate) {
      panel.append(textEl("div", `Estimate: ${pressure.estimate}`));
    }
    return panel;
  }


  function updateUncontainedSlimeBehavior(minutes) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!elapsed) {
      return 0;
    }

    let changes = 0;
    for (const slime of state.slimes || []) {
      if (!slimeIsUncontained(slime) || slime.status === "dead") {
        continue;
      }
      slime.roomId ||= MAIN_ROOM_ID;
      const info = slimeContaminationTraitInfo(slime);
      const currentRoom = roomById(slime.roomId);
      if (!currentRoom) {
        slime.roomId = MAIN_ROOM_ID;
      }

      if (info.seeksContamination) {
        const bestRoom = bestReachableContaminationTargetRoom(slime.roomId);

        if (bestRoom && bestRoom.room.id !== slime.roomId && bestRoom.contamination >= roomContaminationValue(slime.roomId) + OUT_OF_CONTAINER_CONTAMINATION_MOVE_THRESHOLD) {
          const fromRoomId = slime.roomId;
          const fromRoom = roomName(fromRoomId);
          const nextRoomId = nextConnectedRoomToward(fromRoomId, bestRoom.room.id, { requireReachable: true });
          if (!nextRoomId || !doorIsOpen(fromRoomId, nextRoomId)) {
            slime.roomActivity = {
              type: "pressingClosedDoor",
              label: "pressing against closed door",
              roomId: slime.roomId,
              targetRoomId: bestRoom.room.id,
              updatedAt: state.clock
            };
            recordCleanupObservation(slime, "pressingClosedDoor", elapsed, slime.roomId);
            continue;
          }
          slime.roomId = nextRoomId;
          slime.roomActivity = {
            type: "seekingContamination",
            label: "seeking contamination",
            roomId: slime.roomId,
            targetRoomId: bestRoom.room.id,
            updatedAt: state.clock
          };
          recordCleanupObservation(slime, "seekingContamination", elapsed, slime.roomId);
          changes += 1;
        }

        const room = roomById(slime.roomId);
        const contamination = room?.attributes?.contamination;
        const current = Number(contamination?.current) || 0;
        if (room && contamination && info.eatsContamination && current > OUT_OF_CONTAINER_CONTAMINATION_FLOOR) {
          const eatRate = OUT_OF_CONTAINER_CONTAMINATION_CLEAN_PER_HOUR * roomEffectScale(room) * (elapsed / 60);
          const drained = Math.min(eatRate, current - OUT_OF_CONTAINER_CONTAMINATION_FLOOR);
          if (drained > 0) {
            const before = contamination.current;
            contamination.current = clamp(contamination.current - drained, 0, 100);
            adjustSlimeStat(slime, "nutrition", drained * 0.4);
            adjustSlimeStat(slime, "stress", -drained * 0.05);
            slime.roomActivity = {
              type: "feedingOnContamination",
              label: "feeding on contamination",
              roomId: slime.roomId,
              updatedAt: state.clock
            };
            recordCleanupObservation(slime, "feedingOnContamination", elapsed, room.id);
            if (before > OUT_OF_CONTAINER_CONTAMINATION_FLOOR && contamination.current <= OUT_OF_CONTAINER_CONTAMINATION_FLOOR && !room.biologicalCleanupClearedNotifiedAt) {
              const observation = ensureCleanupObservation(slime);
              observation.clearEvents += 1;
              room.biologicalCleanupClearedNotifiedAt = state.clock;
              if (scientistObservesRoom(room.id)) {
                addEvent(`${room.name} visible contamination cleared by biological cleanup.`);
              }
            } else if (contamination.current > OUT_OF_CONTAINER_CONTAMINATION_FLOOR + 0.5) {
              room.biologicalCleanupClearedNotifiedAt = 0;
            }
            if (Math.abs(before - contamination.current) >= 0.01) {
              changes += 1;
            }
          }
        } else {
          slime.roomActivity ||= {
            type: "seekingContamination",
            label: "seeking contamination",
            roomId: slime.roomId,
            updatedAt: state.clock
          };
        }
        continue;
      }

      if (slimeHuntingInclination(slime)) {
        slime.roomActivity = {
          type: "hunting",
          label: "hunting sensed prey",
          roomId: slime.roomId,
          updatedAt: state.clock
        };
        changes += 1;
        continue;
      }

      if (info.spreadsContamination) {
        const room = roomById(slime.roomId);
        const contamination = room?.attributes?.contamination;
        if (room && contamination) {
          const before = contamination.current;
          const residue = OUT_OF_CONTAINER_RESIDUE_PER_HOUR * roomEffectScale(room) * (elapsed / 60);
          contamination.current = clamp(contamination.current + residue, 0, 100);
          slime.roomActivity = {
            type: "leavingResidue",
            label: "leaving residue",
            roomId: slime.roomId,
            updatedAt: state.clock
          };
          recordCleanupObservation(slime, "leavingResidue", elapsed, room.id);
          if (contamination.current > OUT_OF_CONTAINER_CONTAMINATION_FLOOR + 0.5) {
            room.biologicalCleanupClearedNotifiedAt = 0;
          }
          if (Math.abs(before - contamination.current) >= 0.01) {
            changes += 1;
          }
        }
        continue;
      }

      slime.roomActivity ||= {
        type: "exploring",
        label: "exploring",
        roomId: slime.roomId,
        updatedAt: state.clock
      };
    }
    return changes;
  }

  function updateSlimeMetabolism(minutes) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!elapsed) {
      return 0;
    }
    let changes = 0;
    for (const slime of [...(state.slimes || [])]) {
      if (!slime || slime.status === "dead") {
        continue;
      }
      const massBefore = slimeStat(slime, "currentMass").current;
      const pressureBefore = slimeStat(slime, "divisionPressure").current;
      const sustained = updateEnvironmentalSustenance(slime, elapsed);
      const regrew = updateSlimeMassRegrowth(slime, elapsed);
      const pressureChanged = updateDivisionPressure(slime, elapsed, massBefore >= 100);
      const split = tryNaturalSplit(slime);
      if (sustained || regrew || pressureChanged || split) {
        changes += 1;
      }
      const massAfter = slimeStat(slime, "currentMass").current;
      const pressureAfter = slimeStat(slime, "divisionPressure").current;
      if (massBefore < 100 && massAfter >= 100 && pressureAfter <= pressureBefore) {
        addEvent(`${slime.name} regrew to full mass.`);
      }
    }
    return changes;
  }

  /*  ─────────────────────────────────────────────────────────────
   *  Phase 4: Immediate-environment source for environmental feeding
   *  Released slime  → room.attributes
   *  Contained slime → container.environment (including synthesis tube)
   *  ─────────────────────────────────────────────────────────────
   */

  function environmentalSustenanceSource(slime) {
    if (!slime) return null;
    const room = roomById(slime.roomId || MAIN_ROOM_ID);
    if (!room) return null;

    if (slime.status === "contained" && slime.containerId) {
      const container = containerById(slime.containerId);
      if (container) {
        if (!container.environment || Object.keys(container.environment).length === 0) {
          container.environment = normalizeContainerEnvironment(container.environment);
        }
        return {
          type: "container",
          label: container.name || container.type || "container",
          attributes: container.environment,
          container,
          room
        };
      }
    }

    return {
      type: "room",
      label: room.name || "room",
      attributes: room.attributes,
      room
    };
  }

  function updateEnvironmentalSustenance(slime, minutes) {
    const profile = environmentalSustenanceProfile(slime);
    const source = profile ? environmentalSustenanceSource(slime) : null;
    const room = source?.room || null;
    const supply = source ? environmentalSustenanceSupply({ attributes: source.attributes }, profile) : null;
    const rate = supply?.rate || 0;
    const nutrition = slimeStat(slime, "nutrition");
    const mass = slimeStat(slime, "currentMass");
    if (!profile || !source || !room || !supply || rate <= 0 || (nutrition.current >= nutrition.max && mass.current >= mass.max)) {
      return false;
    }
    const before = nutrition.current;
    const attribute = source.attributes[profile.attributeKey];
    if (!attribute) {
      return false;
    }
    const beforeBand = roomAttributeBand(profile.attributeKey, attribute.current);
    const possibleGain = Math.min(nutrition.max - nutrition.current, minutes * rate);
    const maxDrain = Math.max(0, attribute.current - profile.floor);
    const drainPerNutrition = Math.max(0.1, profile.drainPerNutrition);
    const roomLimitedGain = Math.min(possibleGain, maxDrain / drainPerNutrition);
    const gain = Math.max(0, roomLimitedGain);
    if (gain <= 0) {
      return false;
    }
    adjustSlimeStat(slime, "nutrition", gain);
    const drained = gain * drainPerNutrition;
    if (source.type === "room") {
      adjustRoomAttribute(room.id, profile.attributeKey, -drained);
    } else {
      /* Contained slime: drain container interior, not the room */
      source.attributes[profile.attributeKey].current = clamp(
        (source.attributes[profile.attributeKey].current || 0) - drained,
        0, 100
      );
    }
    const changed = slimeStat(slime, "nutrition").current !== before;
    const afterAttribute = source.attributes[profile.attributeKey];
    const afterBand = roomAttributeBand(profile.attributeKey, afterAttribute.current);
    if (changed && slime.revealed?.sustenance && beforeBand.label !== afterBand.label) {
      const def = ROOM_ATTRIBUTE_BY_KEY[profile.attributeKey];
      addEvent(`${slime.name} ${profile.actionLabel} from ${source.label}. ${def.label} dropped to ${afterBand.label}.`);
    }
    return changed;
  }

  function environmentalSustenanceRate(slime) {
    const profile = environmentalSustenanceProfile(slime);
    if (!profile) return 0;
    const source = environmentalSustenanceSource(slime);
    if (!source) return 0;
    /* Pass a room-like object with the correct environment (container interior or room) */
    return environmentalSustenanceSupply({ attributes: source.attributes }, profile).rate;
  }

  function environmentalSustenanceProfile(slime) {
    if (!slime?.genome) {
      return null;
    }
    const tags = new Set(evaluateGenome(slime.genome).traits.sustenance.meta?.tags || []);
    if (!tags.has("environmental")) {
      return null;
    }
    return ENVIRONMENTAL_SUSTENANCE_DEFS.find((profile) => profile.matchTags.some((tag) => tags.has(tag))) || null;
  }

  function environmentalSustenanceSupply(room, profile) {
    const attribute = room?.attributes?.[profile?.attributeKey];
    if (!attribute) {
      return { availability: 0, rate: 0 };
    }
    const current = clamp(Number(attribute.current) || 0, 0, 100);
    const floor = clamp(Number(profile.floor) || 0, 0, 100);
    const fullAt = Math.max(floor + 1, clamp(Number(profile.fullAt) || 100, 0, 100));
    const rawAvailability = clamp((current - floor) / (fullAt - floor), 0, 1);
    if (rawAvailability <= 0) {
      return { availability: 0, rate: 0 };
    }
    const availability = Math.pow(rawAvailability, ENVIRONMENTAL_SUSTENANCE_AVAILABILITY_POWER);
    return {
      availability,
      rate: (ENVIRONMENTAL_SUSTENANCE_NUTRITION_PER_DAY / 1440) * availability
    };
  }

  function hasAvailableEnvironmentalSustenance(slime) {
    const nutrition = slimeStat(slime, "nutrition");
    const mass = slimeStat(slime, "currentMass");
    if (nutrition.current >= nutrition.max && mass.current >= mass.max) {
      return true;
    }
    return environmentalSustenanceRate(slime) > 0;
  }


  function environmentalSustenanceStatus(slime) {
    const profile = environmentalSustenanceProfile(slime);
    if (!profile) {
      return "";
    }
    const source = environmentalSustenanceSource(slime);
    if (!source) {
      return "";
    }
    const def = ROOM_ATTRIBUTE_BY_KEY[profile.attributeKey];
    const attribute = source.attributes[profile.attributeKey];
    const band = roomAttributeBand(profile.attributeKey, attribute.current);
    /* Pass a room-like object with the correct environment (container interior or room) */
    const supply = environmentalSustenanceSupply({ attributes: source.attributes }, profile);
    if (supply.rate <= 0) {
      return `${def.label}: depleted`;
    }
    if (supply.availability < 0.2) {
      return `${def.label}: barely feeding`;
    }
    // Check if we're dealing with a container interior
    if (source.type === "container") {
      // For contained slimes, show "from {container} interior"
      return `Absorbing ${def.label.toLowerCase()} from ${source.label || source.container?.name || "container"} interior.`;
    } else {
      // For room-based slimes, show "from {room name}"
      return `Absorbing ${def.label.toLowerCase()} from ${source.label || source.room?.name || "room"}.`;
    }
  }

  function environmentalSustenanceLabel(slime) {
    const profile = environmentalSustenanceProfile(slime);
    if (!profile) {
      return "";
    }
    return `${profile.sourceLabel} feeder`;
  }

  function isEnvironmentalSustenance(slime) {
    return Boolean(environmentalSustenanceProfile(slime));
  }

  function environmentalSustenanceIsFull(slime) {
    const nutrition = slimeStat(slime, "nutrition");
    const mass = slimeStat(slime, "currentMass");
    return nutrition.current >= nutrition.max && mass.current >= mass.max;
  }

  function environmentCanCurrentlyFeed(slime) {
    if (!isEnvironmentalSustenance(slime)) {
      return false;
    }
    if (environmentalSustenanceIsFull(slime)) {
      return true;
    }
    return hasAvailableEnvironmentalSustenance(slime);
  }

  function updateSlimeMassRegrowth(slime, minutes) {
    const mass = slimeStat(slime, "currentMass");
    const nutrition = slimeStat(slime, "nutrition");
    if (mass.current >= mass.max || nutrition.current <= MASS_REGROWTH_NUTRITION_FLOOR) {
      return false;
    }
    const evaluated = evaluateGenome(slime.genome);
    const growthMinutes = Math.max(1, Number(evaluated.traits.growth.meta?.growthMinutes) || 12);
    const growthRate = mass.max / (growthMinutes * 12);
    const availableNutrition = Math.max(0, nutrition.current - MASS_REGROWTH_NUTRITION_FLOOR);
    const gain = Math.min(
      mass.max - mass.current,
      minutes * growthRate,
      availableNutrition / MASS_REGROWTH_NUTRITION_COST
    );
    if (gain <= 0) {
      return false;
    }
    adjustSlimeStat(slime, "currentMass", gain);
    adjustSlimeStat(slime, "nutrition", -gain * MASS_REGROWTH_NUTRITION_COST);
    return true;
  }

  function updateDivisionPressure(slime, minutes, startedAtFullMass) {
    const pressure = slimeStat(slime, "divisionPressure");
    const conditions = divisionReadiness(slime);
    const required = divisionPressureMinutes(slime);
    if (conditions.ready && startedAtFullMass) {
      slime.splitBlocked = false;
      const gain = minutes * (pressure.max / required);
      const before = pressure.current;
      adjustSlimeStat(slime, "divisionPressure", gain);
      const after = slimeStat(slime, "divisionPressure").current;
      if (before < pressure.max && after >= pressure.max) {
        addEvent(`${slime.name} reached natural division pressure.`);
      }
      return after !== before;
    }
    if (pressure.current <= 0) {
      slime.splitBlocked = false;
      return false;
    }
    const decay = minutes * (pressure.max / Math.max(60, required / 2));
    adjustSlimeStat(slime, "divisionPressure", -decay);
    slime.splitBlocked = false;
    return true;
  }

  function divisionReadiness(slime) {
    if (!slime || slime.status === "dead" || !slime.mature) {
      return { ready: false, reason: "immature" };
    }
    if (slimeStat(slime, "currentMass").current < 100) {
      return { ready: false, reason: "not full mass" };
    }
    if (slimeStat(slime, "nutrition").current < DIVISION_NUTRITION_THRESHOLD) {
      return { ready: false, reason: "not fed enough" };
    }
    if (slimeStat(slime, "bodyIntegrity").current < DIVISION_INTEGRITY_THRESHOLD) {
      return { ready: false, reason: "body integrity too low" };
    }
    if (slimeStat(slime, "stress").current > DIVISION_STRESS_LIMIT) {
      return { ready: false, reason: "too stressed" };
    }
    return { ready: true, reason: "" };
  }

  function divisionPressureMinutes(slime) {
    const evaluated = evaluateGenome(slime.genome);
    const brood = Math.max(1, Number(evaluated.traits.brood.meta?.count) || 1);
    const growth = Math.max(1, Number(evaluated.traits.growth.meta?.growthMinutes) || 12);
    const stabilityRisk = Math.max(1, Number(evaluated.traits.stability.meta?.risk) || 5);
    return clamp(Math.round(360 + brood * 90 + growth * 4 + Math.max(0, stabilityRisk - 3) * 30), 360, 2880);
  }

  function tryNaturalSplit(slime) {
    if (slimeStat(slime, "divisionPressure").current < 100 || !divisionReadiness(slime).ready) {
      return false;
    }
    const evaluated = evaluateGenome(slime.genome);
    const broodCount = Math.max(1, Number(evaluated.traits.brood.meta?.count) || 1);
    const bodyCount = broodCount + 1;
    const massShare = slimeStat(slime, "currentMass").current / bodyCount;
    const nutritionShare = slimeStat(slime, "nutrition").current / bodyCount;
    const parentIntegrity = slimeStat(slime, "bodyIntegrity").current;
    const parentStress = slimeStat(slime, "stress").current;
    const rng = seedRng(`${state.seed}:split:${slime.id}:${state.clock}:${state.nextSlimeNumber}`);
    const growthMinutes = Math.max(4, Number(evaluated.traits.growth.meta?.growthMinutes) || 12);
    const created = [];
    for (let i = 0; i < broodCount; i += 1) {
      const childGenome = naturalSplitGenome(slime, rng, i);
      const child = createSlime(childGenome, "Split", {
        mature: false,
        matureAt: state.clock + Math.round(growthMinutes * (0.75 + rng() * 0.5)),
        status: slime.status,
        containerId: slime.containerId,
        roomId: slime.roomId,
        stats: {
          bodyIntegrity: { current: clamp(parentIntegrity - 5, 20, 100), max: 100 },
          nutrition: { current: nutritionShare, max: 100 },
          currentMass: { current: massShare, max: 100 },
          divisionPressure: { current: 0, max: 100 },
          stress: { current: clamp(parentStress + 5, 0, 100), max: 100 }
        }
      });
      created.push(child);
      createTask({
        type: "mature",
        label: `Mature ${child.name}`,
        duration: Math.max(1, child.matureAt - state.clock),
        data: { slimeId: child.id }
      });
    }
    setSlimeStat(slime, "currentMass", massShare);
    setSlimeStat(slime, "nutrition", nutritionShare);
    adjustSlimeStat(slime, "stress", Math.min(20, 4 + broodCount));
    setSlimeStat(slime, "divisionPressure", 0);
    slime.splitBlocked = false;
    addEvent(`${slime.name} split into ${broodCount} offspring, dividing its mass across ${bodyCount} bodies.`);
    return created.length > 0;
  }

  function naturalSplitGenome(slime, rng, offset) {
    const evaluated = evaluateGenome(slime.genome);
    const brood = Math.max(1, Number(evaluated.traits.brood.meta?.count) || 1);
    const stabilityRisk = Math.max(1, Number(evaluated.traits.stability.meta?.risk) || 5);
    let mutationCount = 1;
    if (rng() < 0.25 + stabilityRisk * 0.035) {
      mutationCount += 1;
    }
    if (brood >= 5 && rng() < 0.35) {
      mutationCount += 1;
    }
    return mutateGenome(slime.genome, rng, mutationCount + (offset % 2 === 0 && rng() < 0.2 ? 1 : 0));
  }

  function corpseProcessingInventoryRecovery(corpse) {
    const freshness = corpseFreshness(corpse);
    if (freshness === "ruined") {
      return { key: "ruinedOrganicMatter", amount: 1, source: "corpse processing" };
    }
    return { key: "biomass", amount: 1, source: "corpse processing" };
  }

  function addCorpseProcessingInventoryRecovery(corpse) {
    const recovery = corpseProcessingInventoryRecovery(corpse);
    return addInventoryItem(recovery.key, recovery.amount, recovery.source);
  }

  function updateCorpseProcessingJobs(elapsed) {
    let changes = 0;
    const workers = state.slimes.filter((slime) => {
      normalizeSlimeJob(slime);
      return slime.job === "corpse" && canWorkJob(slime);
    });
    const reserved = new Set();
    for (const slime of workers) {
      if (isCorpseProcessingTarget(findCorpse(slime.jobTargetCorpseId)) && !reserved.has(slime.jobTargetCorpseId)) {
        reserved.add(slime.jobTargetCorpseId);
      } else {
        slime.jobTargetCorpseId = null;
        slime.jobProgress = 0;
      }
    }
    for (const slime of workers) {
      if (!slime.jobTargetCorpseId && assignCorpseTarget(slime, reserved)) {
        changes += 1;
      }
      if (!slime.jobTargetCorpseId) {
        continue;
      }
      let remaining = elapsed;
      while (remaining > 0 && slime.jobTargetCorpseId) {
        const target = findCorpse(slime.jobTargetCorpseId);
        if (!isCorpseProcessingTarget(target)) {
          reserved.delete(slime.jobTargetCorpseId);
          slime.jobTargetCorpseId = null;
          slime.jobProgress = 0;
          slime.jobNutritionGained = 0;
          changes += 1;
          break;
        }
        const suitability = corpseProcessingSuitability(slime);
        const effects = corpseProcessingEffects(slime, target, suitability);
        const duration = corpseProcessingDuration(slime);
        const needed = Math.max(0, duration - slime.jobProgress);
        if (remaining < needed) {
          const fromProgress = slime.jobProgress;
          slime.jobProgress += remaining;
          applyCorpseProcessingNutrition(slime, effects, fromProgress, slime.jobProgress, duration);
          remaining = 0;
          changes += 1;
          break;
        }
        applyCorpseProcessingNutrition(slime, effects, slime.jobProgress, duration, duration);
        remaining -= needed;
        const nutritionGained = slime.jobNutritionGained || 0;
        addCorpseProcessingInventoryRecovery(target);
        removeCorpseRecord(target.id);
        reserved.delete(target.id);
        addResources({ biomass: CORPSE_PROCESSING_BIOMASS_GAIN });
        addResource("carrionFeedstock", CARRION_FEEDSTOCK_PER_CORPSE);
        addWaste(CORPSE_PROCESSING_WASTE_GAIN + effects.extraWaste, corpseWasteTags(target));
        applyCorpseProcessingEffects(slime, target, suitability, effects);
        addEvent(`${slime.name} processed ${target.name} remains${nutritionGained ? ` after gaining ${formatNumber(nutritionGained)} Nutrition` : ""}.`);
        slime.jobProgress = 0;
        slime.jobTargetCorpseId = null;
        slime.jobNutritionGained = 0;
        changes += 1;
        if (!canWorkJob(slime)) {
          break;
        }
        assignCorpseTarget(slime, reserved);
      }
    }
    return changes;
  }

  function updateWasteDisposalJobs(elapsed) {
    let changes = 0;
    const workers = state.slimes.filter((slime) => {
      normalizeSlimeJob(slime);
      return slime.job === "disposal" && canWorkJob(slime);
    });
    for (const slime of workers) {
      if (resourceAmount("waste") <= 0) {
        slime.jobProgress = 0;
        continue;
      }
      const knowledge = ensureJobKnowledge(slime, "disposal");
      const suitability = wasteDisposalSuitability(slime);
      let remaining = elapsed;
      while (remaining > 0 && resourceAmount("waste") > 0 && canWorkJob(slime)) {
        const duration = wasteDisposalDuration(slime);
        const needed = Math.max(0, duration - slime.jobProgress);
        if (needed <= 0) {
          slime.jobProgress = 0;
          if (!spendWaste(WASTE_DISPOSAL_UNIT)) {
            break;
          }
          completeWasteDisposalUnit(slime, suitability);
          continue;
        }
        const step = Math.min(remaining, needed || duration);
        if (step <= 0) {
          break;
        }
        slime.jobProgress += step;
        knowledge.observedMinutes = Math.max(0, Number(knowledge.observedMinutes) || 0) + step;
        applyWasteDisposalExposure(slime, suitability, step);
        observeSlowWasteDisposal(slime, suitability);
        remaining -= step;
        changes += 1;
        if (!canWorkJob(slime)) {
          break;
        }
        if (slime.jobProgress < duration) {
          continue;
        }
        slime.jobProgress = 0;
        if (!spendWaste(WASTE_DISPOSAL_UNIT)) {
          break;
        }
        completeWasteDisposalUnit(slime, suitability);
      }
    }
    return changes;
  }

  function nextCreatureJobEvent() {
    const events = [];
    for (const slime of state.slimes) {
      normalizeSlimeJob(slime);
      if (slime.job === "corpse" && canWorkJob(slime) && isCorpseProcessingTarget(findCorpse(slime.jobTargetCorpseId))) {
        events.push({
          time: state.clock + Math.max(0, corpseProcessingDuration(slime) - slime.jobProgress),
          label: `${slime.name} corpse processing`,
          type: "job"
        });
      }
      if (slime.job === "disposal" && canWorkJob(slime) && resourceAmount("waste") > 0) {
        const completion = state.clock + Math.max(0, wasteDisposalDuration(slime) - slime.jobProgress);
        events.push({
          time: completion,
          label: `${slime.name} waste disposal`,
          type: "job"
        });
        const exposure = nextWasteExposureEvent(slime);
        if (exposure) {
          events.push(exposure);
        }
      }
    }
    return events
      .filter((event) => Number.isFinite(event.time) && event.time >= state.clock)
      .sort((a, b) => a.time - b.time)[0] || null;
  }

  function nextSlimeMetabolismEvent() {
    const events = [];
    for (const slime of state.slimes || []) {
      if (!slime || slime.status === "dead") {
        continue;
      }
      const massEvent = nextSlimeFullMassEvent(slime);
      if (massEvent) {
        events.push(massEvent);
      }
      const sustenanceEvent = nextEnvironmentalSustenanceEvent(slime);
      if (sustenanceEvent) {
        events.push(sustenanceEvent);
      }
      const divisionEvent = nextDivisionPressureEvent(slime);
      if (divisionEvent) {
        events.push(divisionEvent);
      }
    }
    return events
      .filter((event) => Number.isFinite(event.time) && event.time >= state.clock)
      .sort((a, b) => a.time - b.time)[0] || null;
  }

  function nextSlimeFullMassEvent(slime) {
    const mass = slimeStat(slime, "currentMass");
    const nutrition = slimeStat(slime, "nutrition");
    if (mass.current >= mass.max || nutrition.current <= MASS_REGROWTH_NUTRITION_FLOOR) {
      const envRate = environmentalSustenanceRate(slime);
      if (mass.current >= mass.max || envRate <= 0) {
        return null;
      }
    }
    const evaluated = evaluateGenome(slime.genome);
    const growthMinutes = Math.max(1, Number(evaluated.traits.growth.meta?.growthMinutes) || 12);
    const growthRate = mass.max / (growthMinutes * 12);
    const availableNutrition = Math.max(0, nutrition.current - MASS_REGROWTH_NUTRITION_FLOOR);
    const possibleGain = availableNutrition / MASS_REGROWTH_NUTRITION_COST;
    const needed = mass.max - mass.current;
    if (possibleGain < needed) {
      const envRate = environmentalSustenanceRate(slime);
      const sustainedMassRate = envRate / MASS_REGROWTH_NUTRITION_COST;
      if (envRate <= 0 || sustainedMassRate <= 0) {
        return null;
      }
      const startDelay = Math.max(0, MASS_REGROWTH_NUTRITION_FLOOR - nutrition.current) / envRate;
      const fastMass = Math.max(0, possibleGain);
      const fastTime = fastMass / growthRate;
      const remainingMass = Math.max(0, needed - fastMass);
      const sustainedTime = remainingMass / Math.min(growthRate, sustainedMassRate);
      return {
        time: state.clock + startDelay + fastTime + sustainedTime,
        label: `${slime.name} full mass`,
        type: "metabolism"
      };
    }
    return {
      time: state.clock + needed / growthRate,
      label: `${slime.name} full mass`,
      type: "metabolism"
    };
  }

  function nextEnvironmentalSustenanceEvent(slime) {
    const rate = environmentalSustenanceRate(slime);
    if (rate <= 0 || slimeStat(slime, "currentMass").current < 100) {
      return null;
    }
    const nutrition = slimeStat(slime, "nutrition");
    if (nutrition.current >= DIVISION_NUTRITION_THRESHOLD) {
      return null;
    }
    return {
      time: state.clock + (DIVISION_NUTRITION_THRESHOLD - nutrition.current) / rate,
      label: `${slime.name} sustenance threshold`,
      type: "metabolism"
    };
  }

  function nextDivisionPressureEvent(slime) {
    const pressure = slimeStat(slime, "divisionPressure");
    if (pressure.current >= pressure.max || !divisionReadiness(slime).ready) {
      return null;
    }
    const required = divisionPressureMinutes(slime);
    const minutes = (pressure.max - pressure.current) / (pressure.max / required);
    return {
      time: state.clock + minutes,
      label: `${slime.name} division pressure`,
      type: "metabolism"
    };
  }

  function assignCorpseTarget(slime, reserved = reservedCorpseTargets(slime.id)) {
    const target = chooseCorpseProcessingTarget(reserved);
    if (!target) {
      slime.jobTargetCorpseId = null;
      slime.jobProgress = 0;
      return false;
    }
    slime.jobTargetCorpseId = target.id;
    slime.jobProgress = 0;
    slime.jobNutritionGained = 0;
    reserved.add(target.id);
    return true;
  }

  function reservedCorpseTargets(exceptSlimeId = null) {
    const reserved = new Set();
    for (const slime of state.slimes || []) {
      if (slime.id === exceptSlimeId) {
        continue;
      }
      normalizeSlimeJob(slime);
      if (slime.job === "corpse" && isCorpseProcessingTarget(findCorpse(slime.jobTargetCorpseId))) {
        reserved.add(slime.jobTargetCorpseId);
      }
    }
    return reserved;
  }

  function chooseCorpseProcessingTarget(reserved = new Set()) {
    return [...(state.corpses || [])]
      .filter((corpse) => isCorpseProcessingTarget(corpse) && !reserved.has(corpse.id))
      .sort((a, b) => wasteTargetPriority(a) - wasteTargetPriority(b) || a.diedAt - b.diedAt)
      [0] || null;
  }

  function wasteTargetPriority(corpse) {
    const priority = { ruined: 0, spoiled: 1, decaying: 2, fresh: 3 };
    return priority[corpseFreshness(corpse)] ?? 4;
  }

  function isCorpseProcessingTarget(corpse) {
    if (!isCorpseProcessingCandidate(corpse)) {
      return false;
    }
    return Boolean(corpseProcessingTargets()[corpseFreshness(corpse)]);
  }


  function isCorpseProcessingCandidate(corpse) {
    if (!corpse || !CORPSE_STATE_POLICY_DEFS.some((stateDef) => stateDef.key === corpseFreshness(corpse))) {
      return false;
    }
    if (corpse.storage === "drum") {
      return true;
    }
    if (corpse.storage === "container" && isPitHoleContainer(containerById(corpse.containerId))) {
      return true;
    }
    return false;
  }


  function policyProtectedCorpseCount() {
    return (state.corpses || []).filter((corpse) => isCorpseProcessingCandidate(corpse) && !isCorpseProcessingTarget(corpse)).length;
  }

  function corpseProcessingUnavailableText() {
    return policyProtectedCorpseCount() ? "no policy-approved corpse" : "no eligible corpse";
  }

  function refreshCorpseProcessingTargets() {
    for (const slime of state.slimes || []) {
      normalizeSlimeJob(slime);
      if (slime.job === "corpse" && !isCorpseProcessingTarget(findCorpse(slime.jobTargetCorpseId))) {
        slime.jobTargetCorpseId = null;
        slime.jobProgress = 0;
        slime.jobNutritionGained = 0;
      }
    }
    const reserved = reservedCorpseTargets();
    for (const slime of state.slimes || []) {
      if (slime.job === "corpse" && canWorkJob(slime) && !slime.jobTargetCorpseId) {
        assignCorpseTarget(slime, reserved);
      }
    }
  }

  function removeCorpseRecord(corpseId) {
    state.corpses = (state.corpses || []).filter((corpse) => corpse.id !== corpseId);
    for (const slime of state.slimes || []) {
      if (slime.job === "corpse" && slime.jobTargetCorpseId === corpseId) {
        slime.jobTargetCorpseId = null;
        slime.jobProgress = 0;
        slime.jobNutritionGained = 0;
      }
    }
  }

  function normalizeSlimeJob(slime) {
    if (!slime) {
      return;
    }
    if (slime.job === "waste") {
      slime.job = "corpse";
    }
    if (!CREATURE_JOBS.some((job) => job.id === slime.job)) {
      slime.job = "idle";
    }
    if (isInSynthesisTube(slime) || slimeJobRoomBlockReason(slime) || (slime.containerId && isContainerInTransit(slime.containerId))) {
      slime.job = "idle";
    }
    slime.jobProgress = Math.max(0, Number(slime.jobProgress) || 0);
    slime.jobNutritionGained = Math.max(0, Number(slime.jobNutritionGained) || 0);
    slime.jobTargetCorpseId ||= null;
    slime.jobKnowledge = normalizeJobKnowledge(slime.jobKnowledge);
    if (slime.job !== "corpse") {
      slime.jobTargetCorpseId = null;
      slime.jobNutritionGained = 0;
    }
    if (slime.job === "idle") {
      slime.jobProgress = 0;
      slime.jobTargetCorpseId = null;
      slime.jobNutritionGained = 0;
    }
  }




  function canWorkJob(slime) {
    return Boolean(slime && slime.status !== "dead" && slime.mature && !isInSynthesisTube(slime) && !(slime.containerId && isContainerInTransit(slime.containerId)) && !slimeJobRoomBlockReason(slime) && slimeStat(slime, "bodyIntegrity").current > 0);
  }






  function jobAssignmentBlockReason(slime) {
    if (!slime || slime.status === "dead") {
      return "No living slime available.";
    }
    if (isInSynthesisTube(slime)) {
      return "Specimens in the synthesis tube cannot be assigned jobs.";
    }
    if (slime.containerId && isContainerInTransit(slime.containerId)) {
      return `${slime.name}'s container is being hauled.`;
    }
    const roomReason = slimeJobRoomBlockReason(slime);
    if (roomReason) {
      return roomReason;
    }
    if (!slime.mature) {
      return "Immature slimes cannot be assigned jobs.";
    }
    if (slimeStat(slime, "bodyIntegrity").current <= 0) {
      return "Body Integrity is too low for job assignment.";
    }
    return "";
  }



  function corpseProcessingDuration(slime) {
    const score = corpseProcessingSuitability(slime).score;
    return Math.round(clamp(240 - score * 1.8, 45, 240));
  }

  function jobRemainingText(slime) {
    if (slime.job === "corpse" && corpseProcessingTimingKnown(slime)) {
      return `${formatDuration(Math.max(0, corpseProcessingDuration(slime) - slime.jobProgress))} remaining`;
    }
    if (slime.job === "disposal" && wasteDisposalTimingKnown(slime)) {
      return `${formatDuration(Math.max(0, wasteDisposalDuration(slime) - slime.jobProgress))} remaining`;
    }
    return slime.jobProgress > 0 ? "processing underway" : "processing";
  }

  function jobProgressPercent(slime) {
    if (slime.job === "corpse" && isCorpseProcessingTarget(findCorpse(slime.jobTargetCorpseId))) {
      return Math.round(clamp((slime.jobProgress / corpseProcessingDuration(slime)) * 100, 0, 100));
    }
    if (slime.job === "disposal" && resourceAmount("waste") > 0) {
      return Math.round(clamp((slime.jobProgress / wasteDisposalDuration(slime)) * 100, 0, 100));
    }
    return 0;
  }

  function shouldShowJobProgress(slime) {
    if (slime.job === "corpse") {
      return isCorpseProcessingTarget(findCorpse(slime.jobTargetCorpseId)) && corpseProcessingTimingKnown(slime);
    }
    if (slime.job === "disposal") {
      return resourceAmount("waste") > 0 && wasteDisposalTimingKnown(slime);
    }
    return false;
  }

  function corpseProcessingSuitability(slime) {
    const evaluated = evaluateGenome(slime.genome);
    const traits = evaluated.traits;
    const profile = physicalProfile(slime.genome, evaluated);
    const tags = new Set(traits.sustenance.meta?.tags || []);
    let score = 0;
    const reasons = [];
    const element = baseOutcomeLabel(traits.element);
    const consistency = baseOutcomeLabel(traits.consistency);
    const behavior = baseOutcomeLabel(traits.behavior);
    const stabilityRisk = Number(traits.stability.meta?.risk) || 5;

    const elementScores = {
      acid: 42,
      flame: 30,
      poison: 28,
      water: 18,
      metal: 12,
      stone: 12,
      null: 8
    };
    if (elementScores[element]) {
      score += elementScores[element];
      reasons.push(`${element} affinity`);
    }
    const consistencyScores = {
      watery: 18,
      "runny gel": 20,
      "loose jelly": 16,
      mucous: 18,
      "tar-like": 14,
      "grainy slurry": 10,
      "soft gelatin": 8
    };
    if (consistencyScores[consistency]) {
      score += consistencyScores[consistency];
      reasons.push(consistency);
    }
    if (tags.has("corpse")) {
      score += 32;
      reasons.push("corpse-compatible sustenance");
    }
    if (tags.has("waste")) {
      score += 26;
      reasons.push("waste sustenance");
    }
    if (tags.has("decay")) {
      score += 12;
      reasons.push("decay sustenance");
    }
    if (tags.has("contaminated") || tags.has("hazardous")) {
      score += 8;
      reasons.push("hazard-tolerant sustenance");
    }
    if (behavior === "cleaning") {
      score += 16;
      reasons.push("cleaning behavior");
    } else if (behavior === "burrowing" || behavior === "swarming") {
      score += 8;
      reasons.push(`${behavior} behavior`);
    }
    if ((profile?.weightKg || 0) >= 20) {
      score += 8;
    }
    if ((profile?.weightKg || 0) < 1) {
      score -= 8;
    }
    score -= Math.max(0, stabilityRisk - 5) * 4;
    score = clamp(Math.round(score), 0, 100);
    return {
      score,
      band: jobSuitabilityBand(score),
      reasons
    };
  }

  function wasteDisposalSuitability(slime) {
    const evaluated = evaluateGenome(slime.genome);
    const traits = evaluated.traits;
    const profile = physicalProfile(slime.genome, evaluated);
    const tags = new Set(traits.sustenance.meta?.tags || []);
    let score = 0;
    const reasons = [];
    const element = baseOutcomeLabel(traits.element);
    const consistency = baseOutcomeLabel(traits.consistency);
    const behavior = baseOutcomeLabel(traits.behavior);
    const stabilityRisk = Number(traits.stability.meta?.risk) || 5;

    const elementScores = {
      acid: 36,
      poison: 30,
      flame: 24,
      stone: 18,
      metal: 14,
      light: 14,
      water: 12,
      frost: 8,
      null: 6
    };
    if (elementScores[element]) {
      score += elementScores[element];
      reasons.push(`${element} affinity`);
    }
    const consistencyScores = {
      watery: 14,
      "runny gel": 18,
      "loose jelly": 16,
      mucous: 20,
      "tar-like": 18,
      "grainy slurry": 14,
      "soft gelatin": 8,
      crystalline: -12,
      brittle: -16
    };
    if (consistencyScores[consistency]) {
      score += consistencyScores[consistency];
      reasons.push(consistency);
    }
    if (tags.has("waste")) {
      score += 38;
      reasons.push("waste sustenance");
    }
    if (tags.has("contaminated") || tags.has("hazardous")) {
      score += 20;
      reasons.push("hazard-tolerant sustenance");
    }
    if (tags.has("decay")) {
      score += 10;
      reasons.push("decay sustenance");
    }
    if (tags.has("clean")) {
      score -= 14;
    }
    if (behavior === "cleaning") {
      score += 20;
      reasons.push("cleaning behavior");
    } else if (behavior === "skittish" || behavior === "territorial") {
      score -= 10;
    } else if (behavior === "burrowing" || behavior === "swarming") {
      score += 6;
    }
    if ((profile?.weightKg || 0) >= 20) {
      score += 6;
    }
    if ((profile?.weightKg || 0) < 1) {
      score -= 8;
    }
    score -= Math.max(0, stabilityRisk - 5) * 6;
    score = clamp(Math.round(score), 0, 100);
    return {
      score,
      band: jobSuitabilityBand(score),
      reasons
    };
  }

  function wasteDisposalDuration(slime) {
    const score = wasteDisposalSuitability(slime).score;
    if (score >= 75) {
      return Math.round(clamp(480 - (score - 75) * 12, 120, 480));
    }
    if (score >= 50) {
      return Math.round(1440 - (score - 50) * 38.4);
    }
    if (score >= 25) {
      return Math.round(4320 - (score - 25) * 115.2);
    }
    return Math.round(10080 - score * 230.4);
  }

  function cleanupUseSuitabilityBand(score, hasSevereConcern = false) {
    if (hasSevereConcern && score >= 40) {
      return "Risky";
    }
    if (score >= 80) {
      return "Excellent";
    }
    if (score >= 55) {
      return "Good";
    }
    if (score >= 30) {
      return "Risky";
    }
    return "Poor";
  }

  function cleanupUsePredictionBands() {
    return ["Poor", "Risky", "Good", "Excellent"];
  }

  function buildCleanupUseSuitabilityResult({ known, score = 0, band = "Unknown", helpfulFactors = [], concerns = [], unknownFactors = [], clearEvidence = 0, severeConcern = false }) {
    const confidence = predictionConfidenceFromContext({
      unknownFactors,
      knownFactors: helpfulFactors,
      concerns,
      clearEvidence,
      skillIds: ["observation", "ethology", "slimeHandling"]
    });
    let range;
    if (!known || band === "Unknown") {
      range = predictionRangeFromBand(cleanupUsePredictionBands(), "Risky", "Unknown", { unknownLow: "Poor", unknownHigh: "Excellent" });
    } else {
      range = predictionRangeFromBand(cleanupUsePredictionBands(), band, confidence.label, { unknownLow: "Poor", unknownHigh: "Excellent" });
      if (severeConcern && range.high === "Excellent") {
        range.high = "Good";
      }
    }
    return { known, score, band, range, confidence, helpfulFactors, concerns, unknownFactors };
  }

  function observedCleanupUseSuitability(slime) {
    const learned = ensureJobKnowledge(slime, "cleanup");
    if (learned.band) {
      return buildCleanupUseSuitabilityResult({
        known: true,
        band: learned.band,
        helpfulFactors: learned.reason ? [learned.reason] : [],
        clearEvidence: learned.reason ? 40 : 10
      });
    }

    if (!slime) {
      return buildCleanupUseSuitabilityResult({
        known: false,
        band: "Unknown",
        concerns: ["no living slime selected"]
      });
    }

    const evaluated = evaluateGenome(slime.genome);
    const traits = evaluated.traits;
    const revealed = slime.revealed || {};
    const helpfulFactors = [];
    const concerns = [];
    const unknownFactors = [];
    let score = 0;
    let clearEvidence = 0;
    let severeConcern = false;

    if (revealed.sustenance) {
      const tags = new Set(traits.sustenance?.meta?.tags || []);
      const profile = environmentalSustenanceProfile(slime);
      if (tags.has("contaminated") || tags.has("waste") || tags.has("hazardous") || tags.has("fume") || profile?.attributeKey === "contamination") {
        score += 38;
        clearEvidence += 38;
        helpfulFactors.push("feeds on contamination");
      } else {
        score -= 16;
        concerns.push("contamination feeding not confirmed");
      }
    } else {
      unknownFactors.push("sustenance");
    }

    if (revealed.behavior) {
      const behavior = baseOutcomeLabel(traits.behavior);
      const behaviorText = String(behavior || "").toLowerCase();
      if (behaviorText === "cleaning" || /clean|scavenge|forage/.test(behaviorText)) {
        score += 30;
        clearEvidence += 30;
        helpfulFactors.push("seeks contamination");
      } else if (/pred|hunt|ambush|prey|vibration/.test(behaviorText)) {
        score -= 45;
        severeConcern = true;
        concerns.push("predatory behavior");
      } else if (/territorial|aggressive|swarming/.test(behaviorText)) {
        score -= 22;
        severeConcern = true;
        concerns.push(`${behaviorText} behavior`);
      } else if (/docile|calm|placid/.test(behaviorText)) {
        score += 16;
        helpfulFactors.push("calm behavior");
      }
    } else {
      unknownFactors.push("behavior");
    }

    const visibleResidueText = [];
    if (revealed.byproduct) {
      visibleResidueText.push(baseOutcomeLabel(traits.byproduct));
    } else {
      unknownFactors.push("byproduct");
    }
    if (revealed.consistency) {
      visibleResidueText.push(baseOutcomeLabel(traits.consistency));
    } else {
      unknownFactors.push("body consistency");
    }
    if (revealed.stability) {
      visibleResidueText.push(baseOutcomeLabel(traits.stability));
      const stabilityRisk = Number(traits.stability?.meta?.risk) || 5;
      if (stabilityRisk <= 3) {
        score += 14;
        helpfulFactors.push("stable body profile");
      } else if (stabilityRisk >= 7) {
        score -= 24;
        severeConcern = true;
        concerns.push("unstable body profile");
      }
    } else {
      unknownFactors.push("stability");
    }

    const residueText = visibleResidueText.join(" ").toLowerCase();
    if (/slime|mucus|tar|foam|ooze|acid|fume|poison|waste|residue|volatile|unstable/.test(residueText)) {
      score -= 32;
      severeConcern = true;
      concerns.push("may leave residue");
    } else if (revealed.byproduct && revealed.consistency && revealed.stability) {
      score += 12;
      helpfulFactors.push("no known residue risk");
    }

    const stress = slimeStat(slime, "stress").current;
    if (stress <= 20) {
      score += 10;
      helpfulFactors.push("calm condition");
    } else if (stress >= 70) {
      score -= 20;
      severeConcern = true;
      concerns.push("high Stress");
    }

    const bodyIntegrity = slimeStat(slime, "bodyIntegrity").current;
    if (bodyIntegrity <= 35) {
      score -= 12;
      concerns.push("poor Body Integrity");
    }

    score = clamp(Math.round(score), 0, 100);
    const known = clearEvidence > 0 || concerns.length > 0 || helpfulFactors.length >= 2;
    if (!known) {
      return buildCleanupUseSuitabilityResult({
        known: false,
        score: 0,
        band: "Unknown",
        helpfulFactors,
        concerns,
        unknownFactors
      });
    }

    return buildCleanupUseSuitabilityResult({
      known: true,
      score,
      band: cleanupUseSuitabilityBand(score, severeConcern),
      helpfulFactors,
      concerns,
      unknownFactors,
      clearEvidence,
      severeConcern
    });
  }

  function cleanupUseSuitabilityPanel(slime) {
    const suitability = observedCleanupUseSuitability(slime);
    const panel = document.createElement("div");
    panel.className = "job-note";
    panel.dataset.cleanupUseSuitability = slime.id;
    panel.title = cleanupUseOptionTitle(slime);

    const rangeSpan = document.createElement("span");
    rangeSpan.dataset.cleanupSuitabilityRange = slime.id;
    rangeSpan.textContent = `Cleanup suitability: ${predictionRangeText(suitability.range)}`;
    rangeSpan.title = cleanupUseRangeTooltip(suitability);

    const confidenceSpan = document.createElement("span");
    confidenceSpan.dataset.cleanupSuitabilityConfidence = slime.id;
    confidenceSpan.textContent = `Confidence: ${suitability.confidence.label}`;
    confidenceSpan.title = predictionConfidenceTooltip(suitability.confidence);

    panel.append(rangeSpan, document.createTextNode(" | "), confidenceSpan);
    return panel;
  }

  function observedCorpseProcessingSuitability(slime) {
    const learned = ensureJobKnowledge(slime, "corpse");
    if (learned.band) {
      return {
        known: true,
        score: 0,
        band: learned.band,
        reasons: learned.reason ? [learned.reason] : []
      };
    }
    const evaluated = evaluateGenome(slime.genome);
    const traits = evaluated.traits;
    const knownKeys = ["element", "consistency", "sustenance", "behavior", "stability", "size", "shape"]
      .filter((traitKey) => slime.revealed?.[traitKey]);
    if (!knownKeys.length) {
      return { known: false, score: 0, band: "Unknown", reasons: [] };
    }

    let score = 0;
    const reasons = [];
    let clearPositiveEvidence = 0;
    let clearNegativeEvidence = 0;
    if (slime.revealed?.element) {
      const element = baseOutcomeLabel(traits.element);
      const elementScores = {
        acid: 42,
        flame: 30,
        poison: 28,
        water: 18,
        metal: 12,
        stone: 12,
        null: 8
      };
      if (elementScores[element]) {
        score += elementScores[element];
        if (["acid", "flame", "poison"].includes(element)) {
          clearPositiveEvidence += elementScores[element];
        }
        reasons.push(`${element} affinity`);
      }
    }
    if (slime.revealed?.consistency) {
      const consistency = baseOutcomeLabel(traits.consistency);
      const consistencyScores = {
        watery: 18,
        "runny gel": 20,
        "loose jelly": 16,
        mucous: 18,
        "tar-like": 14,
        "grainy slurry": 10,
        "soft gelatin": 8
      };
      if (consistencyScores[consistency]) {
        score += consistencyScores[consistency];
        if (consistencyScores[consistency] >= 20) {
          clearPositiveEvidence += consistencyScores[consistency];
        }
        reasons.push(consistency);
      }
    }
    if (slime.revealed?.sustenance) {
      const tags = new Set(traits.sustenance.meta?.tags || []);
      if (tags.has("corpse")) {
        score += 32;
        clearPositiveEvidence += 32;
        reasons.push("corpse-compatible sustenance");
      }
      if (tags.has("waste")) {
        score += 26;
        clearPositiveEvidence += 26;
        reasons.push("waste sustenance");
      }
      if (tags.has("decay")) {
        score += 12;
        reasons.push("decay sustenance");
      }
      if (tags.has("contaminated") || tags.has("hazardous")) {
        score += 8;
        reasons.push("hazard-tolerant sustenance");
      }
    }
    if (slime.revealed?.behavior) {
      const behavior = baseOutcomeLabel(traits.behavior);
      if (behavior === "cleaning") {
        score += 16;
        clearPositiveEvidence += 16;
        reasons.push("cleaning behavior");
      } else if (behavior === "burrowing" || behavior === "swarming") {
        score += 8;
        reasons.push(`${behavior} behavior`);
      }
    }
    if (slime.revealed?.size && slime.revealed?.shape) {
      const profile = physicalProfile(slime.genome, evaluated);
      if ((profile?.weightKg || 0) >= 20) {
        score += 8;
      }
      if ((profile?.weightKg || 0) < 1) {
        score -= 8;
        clearNegativeEvidence += 8;
      }
    }
    if (slime.revealed?.stability) {
      const stabilityRisk = Number(traits.stability.meta?.risk) || 5;
      const penalty = Math.max(0, stabilityRisk - 5) * 4;
      score -= penalty;
      if (penalty >= 8) {
        clearNegativeEvidence += penalty;
      }
    }
    score = clamp(Math.round(score), 0, 100);
    if (score < 25 && clearPositiveEvidence < 25 && clearNegativeEvidence < 8) {
      return { known: false, score: 0, band: "Unknown", reasons: [] };
    }
    return {
      known: true,
      score,
      band: jobSuitabilityBand(score),
      reasons
    };
  }

  function corpseProcessingEffects(slime, corpse, suitability) {
    const tags = new Set(evaluateGenome(slime.genome).traits.sustenance.meta?.tags || []);
    const freshness = corpseFreshness(corpse);
    const quality = {
      fresh: 1.2,
      decaying: 0.8,
      spoiled: 0.35,
      ruined: 0.25
    }[freshness] || 0.25;
    let baseNutrition = 1;
    if (tags.has("corpse")) {
      baseNutrition = 8;
    } else if (tags.has("decay")) {
      baseNutrition = 5;
    } else if (tags.has("organic")) {
      baseNutrition = 3;
    } else if (tags.has("waste")) {
      baseNutrition = 2;
    }
    const nutrition = Math.max(0, Math.round(baseNutrition * quality * (0.4 + suitability.score / 90)));
    const materialStress = { fresh: 1, decaying: 2, spoiled: 5, ruined: 2 }[freshness] || 2;
    const materialDamage = { fresh: 0, decaying: 1, spoiled: 2, ruined: 0 }[freshness] || 0;
    const stress = Math.max(0, Math.round(Math.max(0, 55 - suitability.score) / 12 + materialStress - (nutrition >= 6 ? 1 : 0)));
    const bodyDamage = Math.max(0, Math.round(Math.max(0, 45 - suitability.score) / 15 + materialDamage));
    const extraWaste = Math.max(0, (suitability.score < 25 ? 1 : 0) + (freshness === "spoiled" ? 1 : 0) + (nutrition === 0 ? 1 : 0));
    return { nutrition, stress, bodyDamage, extraWaste };
  }

  function applyCorpseProcessingNutrition(slime, effects, fromProgress, toProgress, duration) {
    const totalNutrition = Math.max(0, Number(effects?.nutrition) || 0);
    const safeDuration = Math.max(1, Number(duration) || 1);
    const start = clamp(Number(fromProgress) || 0, 0, safeDuration);
    const end = clamp(Number(toProgress) || 0, 0, safeDuration);
    if (!totalNutrition || end <= start) {
      return 0;
    }
    const alreadyGained = Math.max(0, Number(slime.jobNutritionGained) || 0);
    const expectedGained = totalNutrition * (end / safeDuration);
    const gained = Math.max(0, Math.min(totalNutrition - alreadyGained, expectedGained - alreadyGained));
    if (gained > 0) {
      adjustSlimeStat(slime, "nutrition", gained);
      slime.jobNutritionGained = alreadyGained + gained;
    }
    return gained;
  }

  function applyCorpseProcessingEffects(slime, corpse, suitability, effects) {
    const knowledge = ensureJobKnowledge(slime, "corpse");
    knowledge.completedUnits = Math.max(0, Number(knowledge.completedUnits) || 0) + 1;
    if (effects.stress) {
      adjustSlimeStat(slime, "stress", effects.stress);
    } else if (suitability.score >= 70 && effects.nutrition >= 4) {
      adjustSlimeStat(slime, "stress", -1);
    }
    if (effects.bodyDamage) {
      adjustSlimeStat(slime, "bodyIntegrity", -effects.bodyDamage);
      learnJobFit(slime, "corpse", suitability.score < 25 ? "Hazardous" : "Poor", `${corpseStateLabel(corpse).toLowerCase()} corpse strain`);
      addEvent(`${slime.name} lost ${effects.bodyDamage} Body Integrity processing ${corpse.name}.`);
    } else if (suitability.score >= 70 && knowledge.completedUnits >= 2) {
      learnJobFit(slime, "corpse", "Good", "clean corpse processing");
    } else if (suitability.score >= 40 && knowledge.completedUnits >= 2) {
      learnJobFit(slime, "corpse", "Adequate", "completed corpse processing");
    } else if (suitability.score < 25) {
      learnJobFit(slime, "corpse", "Poor", "messy corpse processing");
    }
    if (effects.extraWaste) {
      learnJobFit(slime, "corpse", "Poor", "messy corpse processing");
    }
  }

  function observedWasteDisposalSuitability(slime) {
    const knowledge = ensureJobKnowledge(slime, "disposal");
    if (!knowledge.band) {
      return { known: false, score: 0, band: "Unknown", reasons: [] };
    }
    return {
      known: true,
      score: 0,
      band: knowledge.band,
      reasons: knowledge.reason ? [knowledge.reason] : []
    };
  }

  function applyWasteDisposalExposure(slime, suitability, minutes) {
    const damageRate = wasteDisposalExposureRate(slime, suitability);
    const stressRate = wasteDisposalStressRate(slime, suitability);
    const damage = Math.max(0, minutes * damageRate);
    const stress = Math.max(0, minutes * stressRate);
    if (damage <= 0 && stress <= 0) {
      return 0;
    }
    if (damage > 0) {
      if (slimeStat(slime, "bodyIntegrity").current - damage <= 0) {
        slime.deathCause = "waste exposure";
      }
      adjustSlimeStat(slime, "bodyIntegrity", -damage);
    }
    if (stress > 0) {
      adjustSlimeStat(slime, "stress", stress);
    }
    const knowledge = ensureJobKnowledge(slime, "disposal");
    knowledge.exposureLoss = Math.max(0, Number(knowledge.exposureLoss) || 0) + damage;
    knowledge.nextExposureNoticeLoss ||= WASTE_DISPOSAL_EXPOSURE_NOTICE_LOSS;
    if (knowledge.exposureLoss >= knowledge.nextExposureNoticeLoss) {
      learnWasteDisposalFit(slime, suitability.score < 25 ? "Hazardous" : "Poor", "waste exposure");
      addEvent(`${slime.name} is taking body damage from waste exposure.`);
      knowledge.nextExposureNoticeLoss += WASTE_DISPOSAL_EXPOSURE_NOTICE_LOSS;
    }
    return damage;
  }

  function wasteDisposalExposureRate(slime, suitability = wasteDisposalSuitability(slime)) {
    const score = suitability.score;
    const evaluated = evaluateGenome(slime.genome);
    const stabilityRisk = Number(evaluated.traits.stability.meta?.risk) || 5;
    const badness = Math.max(0, 55 - score) / 55;
    const instability = Math.max(0, stabilityRisk - 5);
    return badness * 0.015 + instability * 0.002;
  }

  function wasteDisposalStressRate(slime, suitability = wasteDisposalSuitability(slime)) {
    const score = suitability.score;
    const stabilityRisk = wasteDisposalStabilityRisk(slime);
    const badness = Math.max(0, 60 - score) / 60;
    const instability = Math.max(0, stabilityRisk - 5);
    return badness * 0.025 + instability * 0.003;
  }

  function observeSlowWasteDisposal(slime, suitability) {
    const knowledge = ensureJobKnowledge(slime, "disposal");
    if (knowledge.slowObserved || suitability.score >= 50) {
      return;
    }
    if ((Number(knowledge.observedMinutes) || 0) < WASTE_DISPOSAL_SLOW_OBSERVATION) {
      return;
    }
    knowledge.slowObserved = true;
    learnWasteDisposalFit(slime, "Poor", "slow waste digestion");
    addEvent(`${slime.name} is proving slow at waste disposal.`);
  }

  function completeWasteDisposalUnit(slime, suitability) {
    const knowledge = ensureJobKnowledge(slime, "disposal");
    knowledge.completedUnits = Math.max(0, Number(knowledge.completedUnits) || 0) + 1;
    knowledge.residueProgress = Math.max(0, Number(knowledge.residueProgress) || 0) + (suitability.score >= 75 ? 2 : 1);
    const nutrition = wasteDisposalNutritionGain(slime, suitability);
    if (nutrition) {
      adjustSlimeStat(slime, "nutrition", nutrition);
    }
    if (suitability.score >= 60 && nutrition) {
      adjustSlimeStat(slime, "stress", -1);
    } else if (suitability.score < 25) {
      adjustSlimeStat(slime, "stress", 2);
    }
    let residue = 0;
    while (knowledge.residueProgress >= WASTE_DISPOSAL_RESIDUE_INTERVAL) {
      residue += 1;
      knowledge.residueProgress -= WASTE_DISPOSAL_RESIDUE_INTERVAL;
    }
    if (residue) {
      addResource("elementalResidue", residue);
    }
    if (suitability.score >= 70 && knowledge.completedUnits >= 2) {
      learnWasteDisposalFit(slime, "Good", "clean waste disposal");
    } else if (suitability.score >= 40 && knowledge.completedUnits >= 2) {
      learnWasteDisposalFit(slime, "Adequate", "completed waste disposal");
    } else if (suitability.score < 25) {
      learnWasteDisposalFit(slime, "Poor", "rough waste disposal");
    }
    if (suitability.score < 20 && wasteDisposalStabilityRisk(slime) >= 7) {
      addSuspicion(WASTE_DISPOSAL_CONTAMINATION_SUSPICION);
      learnWasteDisposalFit(slime, "Hazardous", "contamination during disposal");
      addEvent(`${slime.name} leaked contamination during waste disposal.`);
    }
    addEvent(`${slime.name} disposed of 1 Waste${residue ? ` and left ${residue} Elemental Residue` : ""}${nutrition ? `, gaining ${nutrition} Nutrition` : ""}.`);
  }

  function wasteDisposalNutritionGain(slime, suitability) {
    const tags = new Set(evaluateGenome(slime.genome).traits.sustenance.meta?.tags || []);
    let base = 0;
    if (tags.has("waste")) {
      base += 4;
    }
    if (tags.has("contaminated") || tags.has("hazardous")) {
      base += 2;
    }
    if (tags.has("decay")) {
      base += 1;
    }
    if (!base || suitability.score < 25) {
      return 0;
    }
    return Math.max(0, Math.round(base * (0.45 + suitability.score / 120)));
  }

  function wasteDisposalStabilityRisk(slime) {
    const evaluated = evaluateGenome(slime.genome);
    return Number(evaluated.traits.stability.meta?.risk) || 5;
  }

  function nextWasteExposureEvent(slime) {
    const suitability = wasteDisposalSuitability(slime);
    const rate = wasteDisposalExposureRate(slime, suitability);
    if (rate <= 0) {
      return null;
    }
    const knowledge = ensureJobKnowledge(slime, "disposal");
    const currentDamage = Math.max(0, Number(knowledge.exposureLoss) || 0);
    const nextDamage = Math.max(knowledge.nextExposureNoticeLoss || WASTE_DISPOSAL_EXPOSURE_NOTICE_LOSS, currentDamage + 0.01);
    return {
      time: state.clock + (nextDamage - currentDamage) / rate,
      label: `${slime.name} waste exposure`,
      type: "job"
    };
  }

  function learnJobFit(slime, jobId, band, reason) {
    const knowledge = ensureJobKnowledge(slime, jobId);
    const rank = { Poor: 1, Adequate: 2, Good: 3, Hazardous: 4 };
    const current = rank[knowledge.band] || 0;
    const next = rank[band] || 0;
    if (!knowledge.band || band === "Hazardous" || (knowledge.band !== "Hazardous" && next > current)) {
      knowledge.band = band;
      knowledge.reason = reason;
    }
  }

  function learnWasteDisposalFit(slime, band, reason) {
    learnJobFit(slime, "disposal", band, reason);
  }

  function jobSuitabilityBand(score) {
    if (score >= 75) {
      return "Excellent";
    }
    if (score >= 50) {
      return "Good";
    }
    if (score >= 25) {
      return "Adequate";
    }
    return "Poor";
  }

  function creatureJobLabel(jobId) {
    return CREATURE_JOBS.find((job) => job.id === jobId)?.label || CREATURE_JOBS[0].label;
  }

  function corpseProcessingTimingKnown(slime) {
    return ["element", "consistency", "sustenance", "behavior", "stability", "size", "shape"]
      .every((traitKey) => slime.revealed?.[traitKey]);
  }

  function wasteDisposalTimingKnown(slime) {
    return Boolean(ensureJobKnowledge(slime, "disposal").band);
  }

  function ensureJobKnowledge(slime, jobId) {
    slime.jobKnowledge = normalizeJobKnowledge(slime.jobKnowledge);
    slime.jobKnowledge[jobId] ||= {};
    return slime.jobKnowledge[jobId];
  }

  function normalizeJobKnowledge(candidate) {
    const normalized = {};
    for (const [jobId, knowledge] of Object.entries(candidate || {})) {
      if (!knowledge || typeof knowledge !== "object") {
        continue;
      }
      normalized[jobId] = {
        ...knowledge,
        observedMinutes: Math.max(0, Number(knowledge.observedMinutes) || 0),
        exposureLoss: Math.max(0, Number(knowledge.exposureLoss) || 0),
        completedUnits: Math.max(0, Number(knowledge.completedUnits) || 0),
        residueProgress: Math.max(0, Number(knowledge.residueProgress) || 0),
        nextExposureNoticeLoss: Math.max(WASTE_DISPOSAL_EXPOSURE_NOTICE_LOSS, Number(knowledge.nextExposureNoticeLoss) || WASTE_DISPOSAL_EXPOSURE_NOTICE_LOSS)
      };
    }
    return normalized;
  }

  function renderIdentityStrip(slime, evaluated) {
    const strip = document.createElement("div");
    strip.className = "identity-strip";
    strip.setAttribute("aria-label", "Discovered identity traits");
    for (const traitKey of ["color", "element", "shape", "byproduct"]) {
      strip.append(identitySlotEl(slime, traitKey, evaluated.traits[traitKey]));
    }
    return strip;
  }

  function identitySlotEl(slime, traitKey, outcome) {
    const slot = document.createElement("span");
    slot.className = `identity-slot identity-slot-${traitKey}`;
    const markerOutcome = slimeTraitMarkerOutcome(slime, traitKey, outcome);
    if (!markerOutcome) {
      slot.classList.add("identity-slot-unknown");
      slot.textContent = "?";
      slot.title = `${getRegionLabel(traitKey)} unknown`;
      return slot;
    }

    const icon = traitIdentityIconEl(traitKey, markerOutcome);
    if (icon) {
      slot.append(icon);
    } else {
      slot.textContent = "none";
    }
    slot.title = `${getRegionLabel(traitKey)}: ${markerOutcome.label}`;
    return slot;
  }

  function renderSlimeGenomeFooter(slime) {
    const footer = document.createElement("div");
    footer.className = "slime-genome-footer";
    footer.append(textEl("span", "Sequence"), baseSequenceEl(slime.genome, "slime-genome-sequence"));
    return footer;
  }

  function renderSlimeStats(slime) {
    const section = document.createElement("div");
    section.className = "slime-stats subpanel";
    const title = document.createElement("div");
    title.className = "subpanel-title";
    title.textContent = "Condition";
    const grid = document.createElement("div");
    grid.className = "slime-stat-grid";
    for (const stat of SLIME_STAT_DEFS) {
      const value = slimeStat(slime, stat.key);
      const row = document.createElement("div");
      row.className = "slime-stat-row";
      row.append(
        textEl("span", stat.label),
        textEl("strong", formatSlimeStatValue(stat.key, value)),
        textEl("em", slimeStatBand(stat.key, value))
      );
      grid.append(row);
    }
    section.append(title, grid);
    return section;
  }

  function renderFeedingControls(slime) {
    const section = document.createElement("div");
    section.className = "feeding-controls subpanel";
    section.addEventListener("click", (event) => event.stopPropagation());
    const title = document.createElement("div");
    title.className = "subpanel-title";
    title.textContent = "Feeding";

    const automationLabel = document.createElement("label");
    automationLabel.className = "policy-option";
    const automationInput = document.createElement("input");
    automationInput.type = "checkbox";
    automationInput.checked = Boolean(slime.automationExcluded);
    automationInput.addEventListener("change", () => {
      slime.automationExcluded = automationInput.checked;
      addEvent(`${slime.name} ${slime.automationExcluded ? "excluded from" : "returned to"} automation.`);
      persist();
      render();
    });
    automationLabel.append(automationInput, textEl("span", "Exclude from automation"));

    const row = document.createElement("div");
    row.className = "feeding-row";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Feedstock");
    for (const feedstock of FEEDSTOCK_DEFS) {
      const option = document.createElement("option");
      option.value = feedstock.key;
      option.textContent = `${feedstock.label} (${formatNumber(resourceAmount(feedstock.key))})${slime.revealed?.sustenance ? ` - ${FEED_MATCH_EFFECTS[feedstockMatch(slime, feedstock.key).quality].label}` : ""}`;
      select.append(option);
    }

    const feedButton = document.createElement("button");
    feedButton.type = "button";
    feedButton.textContent = "Feed";
    const feedReason = manualFeedBlockReason(slime, select.value);
    setActionButtonState(feedButton, Boolean(feedReason), feedReason);
    select.addEventListener("change", () => {
      const reason = manualFeedBlockReason(slime, select.value);
      setActionButtonState(feedButton, Boolean(reason), reason);
    });
    feedButton.addEventListener("click", () => {
      if (feedSlime(slime, select.value, { source: "manual" })) {
        persist();
        render();
      }
    });

    const bestButton = document.createElement("button");
    bestButton.type = "button";
    bestButton.textContent = "Feed Best Match";
    const bestReason = bestFeedBlockReason(slime);
    setActionButtonState(bestButton, Boolean(bestReason), bestReason);
    bestButton.addEventListener("click", () => {
      const feedstockKey = bestAvailableFeedstockKey(slime);
      if (feedstockKey && feedSlime(slime, feedstockKey, { source: "manual" })) {
        persist();
        render();
      }
    });

    row.append(select, feedButton, bestButton);
    section.append(title, automationLabel, row);
    return section;
  }

  function manualFeedBlockReason(slime, feedstockKey) {
    if (!slime || slime.status === "dead") {
      return "No living slime selected.";
    }
    const feedstock = FEEDSTOCK_BY_KEY[feedstockKey];
    if (!feedstock) {
      return "Choose a feedstock.";
    }
    return resourceAmount(feedstock.key) > 0 ? "" : `No ${feedstock.label} available.`;
  }

  function bestFeedBlockReason(slime) {
    if (!slime || slime.status === "dead") {
      return "No living slime selected.";
    }
    if (!slime.revealed?.sustenance) {
      return "Discover Sustenance first.";
    }
    if (!preferredFeedstockKeys(slime).length) {
      return "Environmental Sustenance has no stockpile feedstock.";
    }
    return bestAvailableFeedstockKey(slime) ? "" : "No preferred feedstock available.";
  }

  function renderTraitGrid(slime, evaluated = evaluateGenome(slime.genome)) {
    const grid = document.createElement("div");
    grid.className = "trait-grid subpanel";
    for (const region of SLIME_DISPLAY_DEFS) {
      const outcome = region.virtual ? null : slimeTraitMarkerOutcome(slime, region.key, evaluated.traits[region.key]);
      const row = document.createElement("div");
      row.className = "trait-row";
      row.append(
        traitLabelEl(region, outcome),
        traitValueEl(region.key, evaluated.traits[region.key], formatTraitValue(slime, region.key, evaluated.traits[region.key], evaluated))
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
      setButtonStaminaLabel(button, test.label, BASE_ACTION_STAMINA, [test.skillId, "slimeHandling"], { duration: formatDuration(duration) });
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



  function renderPolicies() {
    state.policies = normalizePolicies(state.policies);
    dom.corpsePolicyList.textContent = "";
    dom.doorPolicyList.textContent = "";

    const corpseControls = document.createElement("div");
    corpseControls.className = "policy-control-list corpse-policy-controls";
    corpseControls.dataset.corpsePolicyControls = "true";
    const corpseTargets = document.createElement("div");
    corpseTargets.className = "policy-target-list";
    corpseTargets.dataset.corpsePolicyTargets = "true";

    const methodLabel = document.createElement("label");
    methodLabel.className = "policy-field policy-select-field";
    methodLabel.append(textEl("span", "Handling method"));
    const methodSelect = document.createElement("select");
    methodSelect.dataset.handlingMethodSelect = "true";
    for (const method of HANDLING_METHOD_DEFS) {
      const option = document.createElement("option");
      option.value = method.id;
      option.textContent = method.label;
      methodSelect.append(option);
    }
    methodSelect.value = currentHandlingMethodId();
    methodSelect.title = handlingMethodActionTitle(currentHandlingMethodId());
    methodSelect.addEventListener("change", () => setHandlingMethod(methodSelect.value));
    methodLabel.append(methodSelect);
    corpseControls.append(methodLabel);

    const methodInventoryNote = document.createElement("div");
    methodInventoryNote.className = "policy-inventory-note";
    methodInventoryNote.dataset.handlingInventoryNote = "true";
    methodInventoryNote.textContent = `${handlingMethodToolPreviewSummary(currentHandlingMethodId())}. ${handlingMethodInventorySummary(currentHandlingMethodId())}. ${handlingMethodProtocolSummary(currentHandlingMethodId())}. ${handlingMethodRequirementSummary(currentHandlingMethodId())}.`;
    methodInventoryNote.title = handlingMethodInventoryTitle(currentHandlingMethodId());
    corpseControls.append(methodInventoryNote);

    const doorPolicyLabel = document.createElement("label");
    doorPolicyLabel.className = "policy-option";
    doorPolicyLabel.title = "Controls what happens after scientist movement or container hauling automatically uses a door.";
    doorPolicyLabel.append(textEl("span", "Door behavior"));
    const doorPolicySelect = document.createElement("select");
    doorPolicySelect.dataset.doorPolicySelect = "true";
    for (const policyDef of DOOR_POLICY_DEFS) {
      const option = document.createElement("option");
      option.value = policyDef.id;
      option.textContent = policyDef.label;
      doorPolicySelect.append(option);
    }
    doorPolicySelect.value = currentDoorPolicyDef().id;
    doorPolicySelect.title = currentDoorPolicyDef().description;
    doorPolicySelect.addEventListener("change", () => setDoorPolicy(doorPolicySelect.value));
    doorPolicyLabel.append(doorPolicySelect);
    dom.doorPolicyList.append(doorPolicyLabel);

    const targets = state.policies.corpseProcessingTargets;
    const handling = corpseHandlingPolicy();
    const enabled = CORPSE_STATE_POLICY_DEFS.filter((stateDef) => targets[stateDef.key]).map((stateDef) => stateDef.label);
    const corpseSummary = enabled.length
      ? `Corpse Processing targets ${enabled.join(", ").toLowerCase()} corpses.`
      : "Corpse Processing has no automatic targets.";
    const handlingSummary = handling.autoMoveToDrums
      ? `Corpse handling auto-moves local remains to ${corpseHandlingDestinationLabel(handling).toLowerCase()} when space is available.`
      : "Corpses remain where they fall unless moved later.";
    const feedingMode = AUTO_FEED_MODE_BY_ID[state.policies.feeding.mode]?.label || "Maintenance";
    dom.policySummary.textContent = `${corpseSummary} ${handlingSummary} Auto-feeding: ${feedingMode.toLowerCase()}. Door behavior: ${currentDoorPolicyDef().label.toLowerCase()}.`;

    const autoMoveLabel = document.createElement("label");
    autoMoveLabel.className = "policy-option";
    const autoMoveInput = document.createElement("input");
    autoMoveInput.type = "checkbox";
    autoMoveInput.checked = Boolean(handling.autoMoveToDrums);
    autoMoveInput.addEventListener("change", () => {
      state.policies.corpseHandling.autoMoveToDrums = autoMoveInput.checked;
      const moved = autoMoveLocalCorpses();
      addEvent(autoMoveInput.checked
        ? `Corpse handling policy enabled: local corpses will move to ${corpseHandlingDestinationLabel().toLowerCase()} when space is available${moved ? `; moved ${moved} now` : ""}.`
        : "Corpse handling policy disabled: new corpses will remain where they fall.");
      refreshCorpseProcessingTargets();
      persist();
      render();
    });
    autoMoveLabel.append(autoMoveInput, textEl("span", "Auto-move local corpses"));

    const destinationLabel = document.createElement("label");
    destinationLabel.className = "policy-field policy-select-field";
    destinationLabel.append(textEl("span", "Corpse destination"));
    const destinationSelect = document.createElement("select");
    destinationSelect.dataset.corpseDestinationSelect = "true";
    for (const destination of CORPSE_HANDLING_DESTINATIONS) {
      const option = document.createElement("option");
      option.value = destination.id;
      option.textContent = destination.label;
      destinationSelect.append(option);
    }
    destinationSelect.value = corpseHandlingDestination(handling);
    destinationSelect.addEventListener("change", () => {
      state.policies.corpseHandling.destination = CORPSE_HANDLING_DESTINATION_BY_ID[destinationSelect.value] ? destinationSelect.value : CORPSE_HANDLING_DEFAULTS.destination;
      const moved = state.policies.corpseHandling.autoMoveToDrums ? autoMoveLocalCorpses() : 0;
      addEvent(`Corpse handling destination set to ${corpseHandlingDestinationLabel().toLowerCase()}${moved ? `; moved ${moved} now` : ""}.`);
      refreshCorpseProcessingTargets();
      persist();
      render();
    });
    destinationLabel.append(destinationSelect);
    corpseControls.append(destinationLabel);
    corpseControls.append(autoMoveLabel);

    dom.corpsePolicyList.append(corpseControls);

    const targetTitle = document.createElement("div");
    targetTitle.className = "policy-target-title";
    targetTitle.textContent = "Targets";
    dom.corpsePolicyList.append(targetTitle);

    for (const stateDef of CORPSE_STATE_POLICY_DEFS) {
      const label = document.createElement("label");
      label.className = "policy-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(targets[stateDef.key]);
      input.addEventListener("change", () => {
        state.policies.corpseProcessingTargets[stateDef.key] = input.checked;
        refreshCorpseProcessingTargets();
        addEvent(`${stateDef.label} corpses ${input.checked ? "allowed" : "protected"} by Corpse Processing policy.`);
        persist();
        render();
      });
      label.append(input, textEl("span", stateDef.label));
      corpseTargets.append(label);
    }
    dom.corpsePolicyList.append(corpseTargets);
    renderFeedingPolicies();
  }



  function renderFeedingPolicies() {
    const policy = state.policies.feeding;
    dom.feedingPolicyList.textContent = "";
    dom.feedingPolicyList.append(
      policySelectControl("Mode", "mode", AUTO_FEED_MODES),
      policyNumberControl("Feed below", "feedBelow", 1, 100),
      policyNumberControl("Feed until", "feedUntil", 1, 100),
      policySelectControl("Current Mass goal", "massGoal", AUTO_FEED_MASS_GOALS),
      policyNumberControl("Preserve reserve", "preserveReserve", 0, 999),
      policyCheckboxControl("Feed unknown Sustenance", "allowUnknownSustenance"),
      policyCheckboxControl("Use preferred when known", "usePreferredWhenKnown"),
      policyCheckboxControl("Allow partial matches", "allowPartialMatches"),
      policyCheckboxControl("Allow bad matches", "allowBadMatches"),
      policyCheckboxControl("Allow harmful feeding", "allowHarmfulFeeding"),
      policyCheckboxControl("Allow carrion", "allowCarrion"),
      policyCheckboxControl("Allow contaminated", "allowContaminated"),
      policyCheckboxControl("Allow reproduction pressure", "allowReproductionPressure")
    );
    function updatePolicy(key, value) {
      state.policies.feeding[key] = value;
      state.policies = normalizePolicies(state.policies);
      addEvent(`Auto-feeding policy updated: ${key}.`);
      persist();
      render();
    }
    function policySelectControl(labelText, key, options) {
      const label = document.createElement("label");
      label.className = "policy-field";
      label.append(textEl("span", labelText));
      const select = document.createElement("select");
      select.setAttribute("aria-label", labelText);
      for (const optionDef of options) {
        const option = document.createElement("option");
        option.value = optionDef.id;
        option.textContent = optionDef.label;
        select.append(option);
      }
      select.value = policy[key];
      select.addEventListener("change", () => updatePolicy(key, select.value));
      label.append(select);
      return label;
    }
    function policyNumberControl(labelText, key, min, max) {
      const label = document.createElement("label");
      label.className = "policy-field";
      label.append(textEl("span", labelText));
      const input = document.createElement("input");
      input.type = "number";
      input.setAttribute("aria-label", labelText);
      input.min = String(min);
      input.max = String(max);
      input.value = String(policy[key]);
      input.addEventListener("change", () => updatePolicy(key, clamp(Math.round(Number(input.value) || 0), min, max)));
      label.append(input);
      return label;
    }
    function policyCheckboxControl(labelText, key) {
      const label = document.createElement("label");
      label.className = "policy-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("aria-label", labelText);
      input.checked = Boolean(policy[key]);
      input.addEventListener("change", () => updatePolicy(key, input.checked));
      label.append(input, textEl("span", labelText));
      return label;
    }
  }


  function physicalStatePanelEl() {
    const physicalState = scientistPhysicalState();
    const exposure = scientistExposureTrack();
    const panel = document.createElement("div");
    panel.className = "physical-state-panel";
    panel.dataset.physicalStatePanel = "scientist";
    const stateLine = document.createElement("strong");
    const physicalBand = physicalStateBand(exposure.current).label;
    stateLine.append(document.createTextNode("Physical State: "), tooltipKeywordEl(physicalBand));
    panel.append(stateLine);

    const latest = physicalState.latestTest;
    const latestLine = document.createElement("div");
    latestLine.dataset.physicalLatestTest = "summary";
    latestLine.textContent = latest
      ? `${latest.label || "Latest test"}: ${latest.summary}`
      : "Latest test: none";
    panel.append(latestLine);

    const confidenceLine = document.createElement("div");
    confidenceLine.dataset.physicalLatestTestConfidence = "confidence";
    confidenceLine.textContent = latest
      ? `Confidence: ${latest.confidence}`
      : "Confidence: none";
    panel.append(confidenceLine);

    if (latest?.likelySource) {
      const sourceLine = document.createElement("div");
      sourceLine.dataset.physicalLatestTestSource = "source";
      sourceLine.textContent = `Likely source: ${latest.likelySource}`;
      panel.append(sourceLine);
    }

    const actionRow = document.createElement("div");
    actionRow.className = "physical-state-actions";
    for (const [index, test] of PHYSICAL_DIAGNOSTIC_TESTS.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      setButtonStaminaLabel(button, test.label, test.staminaCost, test.skillIds || ["observation"]);
      button.dataset.physicalDiagnosticTestId = test.id;
      const reason = physicalDiagnosticBlockReason(test);
      setActionButtonState(button, Boolean(reason), reason);
      button.addEventListener("click", () => startPhysicalDiagnostic(test.id));
      if (index > 0) {
        actionRow.append(document.createTextNode(" · "));
      }
      actionRow.append(button);
    }
    panel.append(actionRow);
    return panel;
  }


  function renderInventory() {
    state.inventory = normalizeInventory(state.inventory);
    if (!dom.inventoryList) {
      return;
    }
    const items = INVENTORY_ITEM_DEFS;
    const nonzeroCount = items.filter((item) => inventoryAmount(item.key) > 0).length;
    dom.inventorySummary.textContent = "Storage Room ledger · Lab-wide prototype";
    dom.inventorySummary.title = "Inventory is tracked lab-wide for now and is assumed to be stored in the Storage Room. Starter tools are required by matching handling methods, are reusable, and are not consumed. No capacity, hauling, crafting, recipes, durability, or room-local storage is implemented yet.";
    dom.inventoryList.textContent = "";
    for (const category of INVENTORY_CATEGORY_DEFS) {
      const categoryItems = items.filter((item) => item.category === category.id);
      if (!categoryItems.length) continue;
      const section = document.createElement("section");
      section.className = "inventory-section";
      section.dataset.inventoryCategory = category.id;
      const heading = document.createElement("h3");
      heading.className = "subpanel-title inventory-section-title";
      heading.textContent = category.label;
      heading.title = category.description;
      section.append(heading);
      for (const item of categoryItems) {
        const row = document.createElement("div");
        row.className = "inventory-row";
        row.dataset.inventoryItemKey = item.key;
        row.dataset.inventoryCategory = item.category;
        row.title = inventoryItemTooltip(item);
        row.append(textEl("span", item.label), textEl("strong", formatNumber(inventoryAmount(item.key))));
        section.append(row);
      }
      dom.inventoryList.append(section);
    }
    if (!items.length) {
      dom.inventoryList.append(emptyText("No inventory items defined."));
    } else if (!nonzeroCount) {
      const note = document.createElement("p");
      note.className = "journal-meta inventory-note";
      note.textContent = "No stored materials or tools yet. Cheats can add any defined inventory item for testing.";
      dom.inventoryList.append(note);
    }
  }

  function renderScientist() {
    renderVitalReadouts();
    renderResources();
    dom.resourceList.append(physicalStatePanelEl(), restQualityPanelEl());
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
    const restFullReason = hasPendingRest()
      ? "Rest is already in progress."
      : stamina.current >= stamina.max
        ? "Stamina is already full."
        : "";
    setActionButtonState(dom.restFullBtn, Boolean(restFullReason), restFullReason);
    const restQuality = restQualityInfo();
    dom.restFullBtn.title = restFullReason || restQuality.title;
    const restCustomReason = hasPendingRest() ? "Rest is already in progress." : "";
    setActionButtonState(dom.restCustomBtn, Boolean(restCustomReason), restCustomReason);
    dom.restCustomBtn.title = restCustomReason || restQuality.title;
  }


  function renderVitalReadouts() {
    const health = scientistVital("health");
    dom.healthReadout.textContent = `${formatVital(health)}${state.runEnded ? " — DEAD" : ""}`;
    dom.healthReadout.dataset.healthState = state.runEnded || health.current <= 0
      ? "dead"
      : health.current <= health.max * 0.25
        ? "critical"
        : health.current <= health.max * 0.5
          ? "hurt"
          : "healthy";
    dom.healthReadout.title = state.runEnded
      ? "The scientist is dead. The run has ended."
      : "Scientist Health. Direct creature handling can damage this.";
    dom.staminaReadout.textContent = formatVital(scientistVital("stamina"));
    dom.manaReadout.textContent = formatVital(scientistVital("mana"));
  }


  function renderResources() {
    dom.resourceList.textContent = "";
    for (const resource of RESOURCE_DEFS) {
      const row = document.createElement("div");
      row.className = "resource-row";
      row.append(textEl("span", resource.label), textEl("strong", formatNumber(resourceAmount(resource.key))));
      dom.resourceList.append(row);
    }
  }


  function renderRooms() {
    state.rooms = normalizeRooms(state.rooms);
    syncRoomObservationMemory();
    observeScientistRoom();
    dom.roomList.textContent = "";
    const mapSummary = roomMapSummary();
    dom.roomSummary.textContent = `${state.rooms.length} room${state.rooms.length === 1 ? "" : "s"} active · Current location: ${roomName(scientistRoomId())}${mapSummary ? ` · ${mapSummary}` : ""}`;
    for (const room of state.rooms) {
      const card = document.createElement("div");
      card.className = `room-card room-${room.role || "custom"}`;
      const title = document.createElement("div");
      title.className = "room-title";
      title.append(textEl("strong", room.name), textEl("span", roomOccupancySummary(room.id)));

      const meta = document.createElement("div");
      meta.className = "room-meta";
      const metaChips = [chip(room.roleLabel || "Custom room")];
      if (roomBlocksJobs(room.id)) {
        metaChips.push(chip("stored creatures cannot work"));
      }
      if (room.id === PITS_ROOM_ID) {
        metaChips.push(chip("corpse work"));
      }
      for (const cleanupTag of roomBiologicalCleanupTags(room)) {
        metaChips.push(cleanupTag);
      }
      metaChips.forEach((metaChip, index) => {
        if (index > 0) {
          meta.append(document.createTextNode(" · "));
        }
        meta.append(metaChip);
      });

      const description = document.createElement("p");
      description.className = "room-description";
      description.textContent = room.description || "";

      const attributes = document.createElement("div");
      attributes.className = "room-attribute-grid";
      for (const def of ROOM_ATTRIBUTE_DEFS) {
        const attribute = room.attributes[def.key];
        const band = roomAttributeBand(def.key, attribute.current);
        const row = document.createElement("div");
        row.className = "room-attribute-row";
        row.title = `${def.label}: ${formatDecimal(attribute.current, 1)} / baseline ${formatDecimal(attribute.baseline, 1)}`;
        row.append(textEl("span", def.label), textEl("strong", band.label));
        attributes.append(row);
      }
      card.append(title, meta, roomGeometrySummaryEl(room), roomDoorControlsEl(room), scientistLocationPanelEl(room), roomExposurePanelEl(room));
      if (description.textContent) {
        card.append(description);
      }
      card.append(attributes);
      card.append(freeCreaturePressureEl(room));
      const freeCreatures = freeCreaturesInRoom(room.id);
      if (freeCreatures.length) {
        const freeList = document.createElement("div");
        freeList.className = "room-free-creatures";
        freeList.append(textEl("strong", "Creatures in room"));
        if (scientistObservesRoom(room.id)) {
          for (const slime of freeCreatures) {
            const row = document.createElement("div");
            row.className = "room-free-creature-row";
            row.append(slimeNameLink(slime), document.createTextNode(" — "), textEl("span", slimeActivityLabel(slime)));
            const extraTags = [...slimeDoorIntentChips(slime), ...slimeCleanupActivityPerformanceChips(slime)];
            if (extraTags.length) {
              row.append(document.createTextNode(" — "));
              extraTags.forEach((tag, index) => {
                if (index > 0) row.append(document.createTextNode(" "));
                row.append(tag);
              });
            }
            freeList.append(row);
          }
        } else {
          freeList.append(textEl("div", "Unobserved from current location."));
        }
        card.append(freeList);
      }
      dom.roomList.append(card);
    }
  }



  function biologicalCleanupActiveInRoom(roomId) {
    if (!scientistObservesRoom(roomId)) {
      return [];
    }
    return (state.slimes || []).filter((slime) => {
      if (!slimeIsUncontained(slime) || slime.status === "dead" || slime.roomId !== roomId) {
        return false;
      }
      return ["feedingOnContamination", "seekingContamination", "leavingResidue"].includes(slime.roomActivity?.type);
    });
  }

  function roomBiologicalCleanupTags(room) {
    const cleaners = biologicalCleanupActiveInRoom(room.id);
    if (!cleaners.length) {
      return [];
    }
    const tag = chip("Biological cleanup active");
    tag.dataset.biologicalCleanupActive = room.id;
    tag.title = "A free creature in this observed room is interacting with contamination. Ongoing cleanup is shown as room and creature activity, not repeated event log messages.";
    return [tag];
  }

  function roomOccupancySummary(roomId) {
    const containers = (state.containers || []).filter((container) => (container.roomId || MAIN_ROOM_ID) === roomId).length;
    const living = (state.slimes || []).filter((slime) => slime.status !== "dead" && slimeEffectiveRoomId(slime) === roomId).length;
    const corpses = (state.corpses || []).filter((corpse) => (corpse.roomId || MAIN_ROOM_ID) === roomId).length;
    return `${containers} container${containers === 1 ? "" : "s"}; ${living} living; ${corpses} corpse${corpses === 1 ? "" : "s"}`;
  }


  function setActionButtonState(button, disabled, reason = "") {
    button.disabled = disabled;
    const disabledReason = disabled ? reason || "This action is unavailable right now." : "";
    button.title = disabledReason;
    if (disabledReason) {
      button.setAttribute("aria-label", `${button.textContent.trim()}: ${disabledReason}`);
      button.dataset.disabledReason = disabledReason;
    } else {
      button.removeAttribute("aria-label");
      delete button.dataset.disabledReason;
    }
    button.classList.toggle("blocked-action", disabledReason.startsWith("Not enough"));
  }

  function explainDisabledButtons() {
    for (const button of document.querySelectorAll("button:disabled")) {
      if (button.title) {
        continue;
      }
      setActionButtonState(button, true, "This action is unavailable right now.");
    }
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

  function runResourceCommand() {
    const command = dom.resourceCommandInput.value.trim();
    const match = command.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      dom.resourceCommandStatus.textContent = "Use format: biomass 100";
      return;
    }
    const resourceKey = RESOURCE_ALIASES[normalizeCommandName(match[1])];
    const amount = Math.floor(Number(match[2]));
    if (!resourceKey || !Number.isFinite(amount) || amount <= 0) {
      dom.resourceCommandStatus.textContent = "Unknown resource or invalid amount.";
      return;
    }
    if (resourceKey === "waste") {
      addWaste(amount, ["cheat"]);
    } else {
      addResource(resourceKey, amount);
    }
    dom.resourceCommandInput.value = "";
    dom.resourceCommandStatus.textContent = `Added ${formatNumber(amount)} ${resourceLabel(resourceKey)}.`;
    addEvent(`${resourceLabel(resourceKey)} increased by ${formatNumber(amount)} via cheat command.`);
    persist();
    render();
  }


  function runInventoryCommand() {
    const command = dom.inventoryCommandInput?.value.trim() || "";
    const match = command.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      dom.inventoryCommandStatus.textContent = "Use format: trace slime 5";
      return;
    }
    const itemKey = INVENTORY_ITEM_ALIASES[normalizeCommandName(match[1])];
    const amount = Math.floor(Number(match[2]));
    if (!itemKey || !Number.isFinite(amount) || amount === 0) {
      dom.inventoryCommandStatus.textContent = "Unknown inventory item or invalid amount.";
      return;
    }
    const actualDelta = addInventoryItem(itemKey, amount, "cheat adjustment");
    if (!actualDelta) {
      dom.inventoryCommandStatus.textContent = `${inventoryItemLabel(itemKey)} unchanged.`;
      return;
    }
    dom.inventoryCommandInput.value = "";
    dom.inventoryCommandStatus.textContent = `${actualDelta > 0 ? "Added" : "Removed"} ${formatNumber(Math.abs(actualDelta))} ${inventoryItemLabel(itemKey)}.`;
    persist();
    render();
  }

  function runRoomCommand() {
    const command = dom.roomCommandInput.value.trim();
    const match = command.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      dom.roomCommandStatus.textContent = "Use format: temperature -10";
      return;
    }
    const attributeKey = ROOM_ATTRIBUTE_ALIASES[normalizeCommandName(match[1])];
    const amount = Number(match[2]);
    if (!attributeKey || !Number.isFinite(amount) || !amount) {
      dom.roomCommandStatus.textContent = "Unknown room attribute or invalid amount.";
      return;
    }
    const room = roomById(MAIN_ROOM_ID);
    const roomId = room?.id || MAIN_ROOM_ID;
    if (!adjustRoomAttribute(roomId, attributeKey, amount)) {
      dom.roomCommandStatus.textContent = "Room attribute did not change.";
      return;
    }
    const updatedRoom = roomById(roomId);
    const def = ROOM_ATTRIBUTE_BY_KEY[attributeKey];
    const attribute = updatedRoom.attributes[attributeKey];
    const band = roomAttributeBand(attributeKey, attribute.current);
    dom.roomCommandInput.value = "";
    dom.roomCommandStatus.textContent = `${def.label} adjusted to ${band.label}.`;
    addEvent(`${updatedRoom.name} ${def.label.toLowerCase()} adjusted to ${band.label} via cheat command.`);
    persist();
    render();
  }

  function runContainerCommand() {
    const command = dom.containerCommandInput.value.trim();
    const match = command.match(/^(\S+)\s+(\S+)(?:\s+(.+))?$/);
    if (!match) {
      dom.containerCommandStatus.textContent = "Use format: basic-1 type iron cage";
      return;
    }
    const [, containerId, actionText, valueText = ""] = match;
    const container = containerById(containerId);
    if (!container || container.type === "synthesis") {
      dom.containerCommandStatus.textContent = "Choose a permanent container, such as basic-1.";
      return;
    }
    const action = normalizeCommandName(actionText);
    const value = valueText.trim();
    if (["type", "base", "material"].includes(action)) {
      const typeId = containerBaseTypeIdFromCommand(value);
      if (!typeId) {
        dom.containerCommandStatus.textContent = "Unknown container type.";
        return;
      }
      container.typeId = typeId;
      container.name = `${containerTypeLabel(typeId)} ${numericSuffix(container.id) || ""}`.trim();
      dom.containerCommandInput.value = "";
      dom.containerCommandStatus.textContent = `${container.id} changed to ${containerTypeLabel(typeId)}.`;
      addEvent(`${container.id} changed to ${containerTypeLabel(typeId)} via cheat command.`);
      persist();
      render();
      return;
    }
    if (action === "open") {
      container.typeId = "openTray";
      container.name = `${containerTypeLabel(container.typeId)} ${numericSuffix(container.id) || ""}`.trim();
      dom.containerCommandInput.value = "";
      dom.containerCommandStatus.textContent = `${container.id} changed to ${containerTypeLabel(container.typeId)}.`;
      addEvent(`${container.id} changed to ${containerTypeLabel(container.typeId)} via cheat command.`);
      persist();
      render();
      return;
    }
    if (["add", "ward"].includes(action)) {
      const wardId = containerWardIdFromCommand(value);
      if (!wardId) {
        dom.containerCommandStatus.textContent = "Unknown ward.";
        return;
      }
      container.wardIds = normalizeContainerWardIds([...(container.wardIds || []), wardId]);
      dom.containerCommandInput.value = "";
      dom.containerCommandStatus.textContent = `${containerWardDef(wardId).label} added to ${container.id}.`;
      addEvent(`${containerWardDef(wardId).label} added to ${container.id} via cheat command.`);
      persist();
      render();
      return;
    }
    if (action === "remove") {
      const wardId = containerWardIdFromCommand(value);
      if (!wardId) {
        dom.containerCommandStatus.textContent = "Unknown ward.";
        return;
      }
      container.wardIds = normalizeContainerWardIds(container.wardIds).filter((candidate) => candidate !== wardId);
      dom.containerCommandInput.value = "";
      dom.containerCommandStatus.textContent = `${containerWardDef(wardId).label} removed from ${container.id}.`;
      addEvent(`${containerWardDef(wardId).label} removed from ${container.id} via cheat command.`);
      persist();
      render();
      return;
    }
    if (action === "clear") {
      container.wardIds = [];
      dom.containerCommandInput.value = "";
      dom.containerCommandStatus.textContent = `Wards cleared from ${container.id}.`;
      addEvent(`Wards cleared from ${container.id} via cheat command.`);
      persist();
      render();
      return;
    }
    dom.containerCommandStatus.textContent = "Use action: type, add, remove, clear, or open.";
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
      const title = document.createElement("strong");
      appendLinkedEntityText(title, task.label);
      const remaining = textEl("span", `${formatDuration(task.dueAt - state.clock)} remaining`);
      remaining.dataset.taskRemaining = task.id;
      const meta = document.createElement("div");
      meta.className = "task-meta";
      remaining.className = "task-chip";
      meta.append(taskChip(taskCategory(task)), taskChip(formatClock(task.dueAt)), remaining);
      label.append(title, meta);
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
    if (task.type === "physicalDiagnostic") {
      return "Diagnostic";
    }
    if (task.type === "scientistMove") {
      return "Scientist";
    }
    if (task.type === "synthesize") {
      return "Scientist";
    }
    if (task.type === "test") {
      return "Lab Test";
    }
    if (task.type === "breed") {
      return "Recombination";
    }
    if (task.type === "necropsy") {
      return "Necropsy";
    }
    if (task.type === "containerHaul") {
      return "Hauling";
    }
    if (task.type === "containerInteraction") {
      return "Handling";
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
      if (discoveries.length) {
        body.className = "journal-entry-list";
        for (const [index, item] of discoveries.entries()) {
          if (index > 0) {
            body.append(textEl("span", "; "));
          }
          const entry = document.createElement("span");
          entry.className = "journal-entry";
          entry.append(
            textEl("span", `${item.codes.map((code) => code.code).join("+")} = `),
            traitValueEl(region.key, item, formatKnownOutcome(item))
          );
          body.append(entry);
        }
      } else {
        body.textContent = "No entries";
      }
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
      const message = document.createElement("span");
      appendLinkedEntityText(message, event.message);
      row.append(textEl("span", formatClock(event.time)), message);
      dom.eventLog.append(row);
    }
  }

  function renderKnownEditor() {
    if (state.journalMode !== "auto") {
      setActionButtonState(dom.applyKnownBtn, true, "Known outcomes require Automatic journal mode.");
      dom.knownEditor.classList.add("hidden");
      return;
    }
    setActionButtonState(dom.applyKnownBtn, false);
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

  function formatTraitValue(slime, traitKey, outcome, evaluated = null) {
    if (traitKey === "weight") {
      return formatDerivedWeight(slime, evaluated);
    }
    if (traitKey === "movement") {
      return formatDerivedMovement(slime, evaluated);
    }
    const label = slime.revealed?.[traitKey];
    if (!label) {
      return "Unknown";
    }
    if (traitKey === "color" && !slime.measured?.[traitKey]) {
      const observation = slime.traitObservations?.[traitKey];
      const reading = observation?.reading || "";
      return reading ? `${label} (${reading})` : label;
    }
    const reading = slime.measured?.[traitKey]
      ? preciseReading(traitKey, outcome)
      : estimatedReading(traitKey, outcome, slime.genome);
    return reading ? `${label} (${reading})` : label;
  }

  function traitValueEl(traitKey, outcome, value) {
    const wrapper = document.createElement("span");
    wrapper.className = "trait-value";
    if (value !== "Unknown") {
      const icon = traitRowValueIconEl(traitKey, outcome);
      if (icon) {
        wrapper.append(icon);
      }
    }
    wrapper.append(textEl("span", value));
    return wrapper;
  }

  function traitRowValueIconEl(traitKey, outcome) {
    if (traitKey === "element") {
      return elementIconEl(outcome);
    }
    if (traitKey === "shape" || traitKey === "byproduct") {
      return traitIdentityIconEl(traitKey, outcome);
    }
    return null;
  }

  function traitIdentityIconEl(traitKey, outcome) {
    if (traitKey === "color" && outcome?.meta?.color) {
      const icon = document.createElement("span");
      icon.className = "identity-icon identity-swatch";
      icon.style.backgroundColor = outcome.meta.color;
      icon.setAttribute("aria-hidden", "true");
      return icon;
    }
    if (traitKey === "element") {
      const icon = elementIconEl(outcome);
      if (icon) {
        icon.classList.add("identity-icon");
      }
      return icon;
    }
    const category = traitIconCategory(traitKey, outcome);
    if (!category) {
      return null;
    }
    const icon = document.createElement("span");
    icon.className = `trait-category-icon ${traitKey}-icon ${traitKey}-icon-${category}`;
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function elementIconEl(outcome) {
    const label = baseOutcomeLabel(outcome);
    if (!label || label === "none") {
      return null;
    }
    const icon = document.createElement("span");
    icon.className = `element-icon element-icon-${label.replace(/[^a-z0-9]+/g, "-")}`;
    icon.title = label;
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function traitIconCategory(traitKey, outcome) {
    const label = baseOutcomeLabel(outcome);
    if (traitKey === "shape") {
      return shapeIconCategory(label);
    }
    if (traitKey === "byproduct") {
      return byproductIconCategory(label);
    }
    return "";
  }

  function shapeIconCategory(label) {
    const categories = {
      cubic: "cube",
      spherical: "sphere",
      "humanoid-ish": "humanoid",
      "dog-shaped": "animal",
      blob: "blob",
      puddle: "flat",
      "worm-like": "worm",
      columnar: "column",
      conical: "cone",
      "flat sheet": "flat",
      mound: "blob",
      disc: "disc",
      branching: "branching",
      "star-like": "radial",
      "mushroom-shaped": "capped",
      "shell-like": "shell"
    };
    return categories[label] || "";
  }

  function byproductIconCategory(label) {
    if (label.includes("droplet") || label.includes("dew")) {
      return "droplet";
    }
    if (label.includes("brine") || label.includes("water") || label.includes("solvent")) {
      return "liquid";
    }
    if (label.includes("mucus") || label.includes("gel") || label.includes("paste")) {
      return "gel";
    }
    if (label.includes("foam") || label.includes("vapor")) {
      return "vapor";
    }
    if (label.includes("resin") || label.includes("wax")) {
      return "resin";
    }
    if (label.includes("crystal") || label.includes("flakes") || label.includes("silt")) {
      return "mineral";
    }
    if (label.includes("pearl")) {
      return "pearl";
    }
    return "";
  }

  function formatKnownOutcome(item) {
    const reading = item.measurement || item.estimate;
    return reading ? `${item.label} (${reading})` : item.label;
  }

  function formatKnownPrediction(traitKey, item, outcome, genome) {
    if (traitKey === "size") {
      const reading = estimatedReading(traitKey, outcome, genome);
      return reading ? `${item.label} (${reading})` : item.label;
    }
    return formatKnownOutcome(item);
  }

  function formatDerivedWeight(slime, evaluated = null) {
    if (!slime.revealed?.size || !slime.revealed?.shape) {
      return "Unknown";
    }
    const profile = physicalProfile(slime.genome, evaluated);
    if (!profile) {
      return "Unknown";
    }
    const [low, high] = estimateBounds(profile.weightKg, "weight", slime.genome);
    return `${formatWeight(low)} - ${formatWeight(high)}`;
  }

  function formatDerivedMovement(slime, evaluated = null) {
    if (!slime.revealed?.shape || !slime.revealed?.consistency || !slime.revealed?.appendages) {
      return "Unknown";
    }
    const profile = physicalProfile(slime.genome, evaluated);
    return profile?.movement || "Unknown";
  }

  function effectivenessReport(specimen, freshness) {
    const evaluated = evaluateGenome(specimen.genome);
    const profile = physicalProfile(specimen.genome, evaluated);
    const risk = evaluated.traits.stability.meta.risk;
    const quality = freshness === "fresh"
      ? "Fresh-tissue analysis"
      : freshness === "decaying"
        ? "Degraded-tissue analysis"
        : "Spoiled-tissue analysis";
    const shape = visibleTraitLabel(specimen, "shape", evaluated);
    const consistency = visibleTraitLabel(specimen, "consistency", evaluated);
    const appendages = visibleTraitLabel(specimen, "appendages", evaluated);
    const byproduct = visibleTraitLabel(specimen, "byproduct", evaluated);
    const element = visibleTraitLabel(specimen, "element", evaluated);
    const behavior = visibleTraitLabel(specimen, "behavior", evaluated);
    const sustenance = visibleTraitLabel(specimen, "sustenance", evaluated);
    const stability = visibleTraitLabel(specimen, "stability", evaluated);
    const mobility = specimen.revealed?.shape && specimen.revealed?.consistency && specimen.revealed?.appendages
      ? profile?.movement || "unknown movement"
      : "mobility unclear";
    const weight = specimen.revealed?.size && specimen.revealed?.shape && profile
      ? formatWeight(profile.weightKg)
      : "unknown mass";
    const riskNote = specimen.revealed?.stability
      ? risk >= 7 ? "high containment risk" : risk >= 4 ? "moderate containment risk" : "low containment risk"
      : "containment risk unclear";
    const utilityNote = byproduct === "unknown" ? "utility unclear" : `useful output: ${byproduct}`;
    const physiologyNote = `${shape}, ${consistency}, ${appendages}; ${weight}`;
    return `${quality}: ${physiologyNote}. Mobility: ${mobility}. Behavior: ${behavior}; sustenance: ${sustenance}. Affinity: ${element}. Stability: ${stability} (${riskNote}). ${utilityNote}.`;
  }

  function visibleTraitLabel(specimen, traitKey, evaluated) {
    return specimen.revealed?.[traitKey] || "unknown";
  }

  function estimatedSizeReading(outcome, genome = "") {
    const volume = sizeVolumeCm3(outcome);
    const shape = shapeLabelForGenome(genome);
    const [low, high] = estimateBounds(volume, "size", genome);
    const estimatedVolume = (low + high) / 2;
    return `about ${formatShapeDimensions(shape, estimatedVolume)}`;
  }

  function exactSizeReading(outcome) {
    return formatShapeDimensions("blob", sizeVolumeCm3(outcome));
  }

  function physicalProfile(genome, evaluated = null) {
    const cleaned = cleanGenome(genome || "");
    if (cleaned.length !== GENOME_LENGTH) {
      return null;
    }
    const traits = evaluated?.traits || evaluateGenome(cleaned).traits;
    const shape = baseOutcomeLabel(traits.shape) || "blob";
    const consistency = baseOutcomeLabel(traits.consistency) || "soft gelatin";
    const appendages = baseOutcomeLabel(traits.appendages) || "none";
    const element = baseOutcomeLabel(traits.element) || "none";
    const volumeCm3 = sizeVolumeCm3(traits.size);
    const density = elementDensity(traits.element);
    const weightKg = (volumeCm3 * density) / 1000;
    return {
      shape,
      consistency,
      appendages,
      element,
      volumeCm3,
      density,
      weightKg,
      movement: derivedMovement(cleaned, { shape, consistency, appendages, element, weightKg, elementOutcome: traits.element })
    };
  }

  function shapeLabelForGenome(genome) {
    const cleaned = cleanGenome(genome || "");
    if (cleaned.length !== GENOME_LENGTH || !geneMap?.traitMaps?.shape) {
      return "blob";
    }
    return baseOutcomeLabel(evaluateGenome(cleaned).traits.shape) || "blob";
  }

  function sizeVolumeCm3(outcome) {
    const baseLabel = baseOutcomeLabel(outcome);
    return SIZE_VOLUME_CM3[baseLabel] || Math.round((outcome?.meta?.mass || 1) * 420);
  }

  function elementDensity(outcome) {
    const label = baseOutcomeLabel(outcome);
    const affinity = elementAffinity(outcome) / 100;
    const targets = {
      none: 1,
      flame: 0.55,
      frost: 0.9,
      storm: 0.65,
      stone: 2.4,
      shadow: 0.55,
      light: 0.25,
      water: 1.05,
      wind: 0.3,
      wood: 0.75,
      metal: 3.8,
      poison: 1.2,
      acid: 1.15,
      dream: 0.2,
      gravity: 3,
      ether: 0.15,
      null: 1.8
    };
    const target = targets[label] ?? 1;
    return Math.max(0.05, 1 + (target - 1) * affinity);
  }

  function formatShapeDimensions(shape, volumeCm3) {
    const safeVolume = Math.max(1, Number(volumeCm3) || 1);
    const root = Math.cbrt(safeVolume);
    if (shape === "cubic") {
      const side = root;
      return `${formatLength(side)} tall x ${formatLength(side)} wide x ${formatLength(side)} long`;
    }
    if (shape === "spherical") {
      const diameter = Math.cbrt((6 * safeVolume) / Math.PI);
      return `${formatLength(diameter)} diameter`;
    }
    if (shape === "humanoid-ish") {
      const height = Math.cbrt(safeVolume * 9);
      return `${formatLength(height)} tall, ${formatLength(height * 0.38)} arms, ${formatLength(height * 0.48)} legs`;
    }
    if (shape === "dog-shaped") {
      const length = Math.cbrt(safeVolume * 5.5);
      return `${formatLength(length * 0.45)} shoulder height, ${formatLength(length)} body length`;
    }
    if (shape === "puddle" || shape === "flat sheet") {
      const depth = clamp(root * (shape === "puddle" ? 0.08 : 0.12), 1, 22);
      const spread = 2 * Math.sqrt(safeVolume / (Math.PI * depth));
      return `${formatLength(spread)} spread, ${formatLength(depth)} deep`;
    }
    if (shape === "worm-like") {
      const length = Math.cbrt(safeVolume * 30);
      const thickness = Math.sqrt(safeVolume / (Math.PI * length)) * 2;
      return `${formatLength(length)} long, ${formatLength(thickness)} thick`;
    }
    if (shape === "columnar") {
      const height = Math.cbrt(safeVolume * 4);
      const diameter = Math.sqrt((4 * safeVolume) / (Math.PI * height));
      return `${formatLength(height)} tall, ${formatLength(diameter)} across`;
    }
    if (shape === "conical") {
      const height = Math.cbrt((12 * safeVolume) / Math.PI);
      const diameter = Math.sqrt((12 * safeVolume) / (Math.PI * height));
      return `${formatLength(height)} tall, ${formatLength(diameter)} base`;
    }
    if (shape === "disc") {
      const thickness = clamp(root * 0.22, 2, 40);
      const diameter = 2 * Math.sqrt(safeVolume / (Math.PI * thickness));
      return `${formatLength(diameter)} across, ${formatLength(thickness)} thick`;
    }
    if (shape === "branching" || shape === "star-like") {
      const span = Math.cbrt(safeVolume * 8);
      return `${formatLength(span)} span, ${formatLength(root * 0.34)} core thickness`;
    }
    if (shape === "mushroom-shaped") {
      const height = Math.cbrt(safeVolume * 3.2);
      return `${formatLength(height)} tall, ${formatLength(height * 0.72)} cap width`;
    }
    if (shape === "shell-like") {
      const length = Math.cbrt(safeVolume * 3.6);
      return `${formatLength(length)} long, ${formatLength(length * 0.62)} wide, ${formatLength(length * 0.32)} high`;
    }
    const height = Math.cbrt(safeVolume * 0.75);
    const width = Math.sqrt(safeVolume / height);
    return `${formatLength(height)} tall, ${formatLength(width)} wide`;
  }

  function derivedMovement(genome, profile) {
    const shapePools = {
      "cubic": ["rocks from edge to edge", "drags one face forward", "tips and settles"],
      "spherical": ["rolls", "wobbles", "bounces", "pulses forward"],
      "humanoid-ish": ["lurches", "stagger-walks", "crawls", "hops"],
      "dog-shaped": ["pads along", "scuttles", "bounds", "crawls low"],
      "blob": ["oozes", "pulses", "slumps forward", "heaves"],
      "puddle": ["seeps", "spreads", "oozes", "drips"],
      "worm-like": ["slithers", "inches forward", "coils and pulls", "wriggles"],
      "columnar": ["leans and slides", "pivots", "topples forward"],
      "conical": ["spins slowly", "scrapes forward", "tips and rights itself"],
      "flat sheet": ["ripples", "slides", "folds forward", "spreads"],
      "mound": ["slumps", "heaves", "oozes"],
      "disc": ["rolls on edge", "slides", "wobbles"],
      "branching": ["pulls by branches", "crawls unevenly", "anchors and reaches"],
      "star-like": ["pulls point by point", "skitters unevenly", "sprawls forward"],
      "mushroom-shaped": ["wobbles", "hops", "totters"],
      "shell-like": ["scrapes forward", "drags its shell", "slides"]
    };
    const consistencyPools = {
      "watery": ["runs along cracks", "spills forward"],
      "runny gel": ["sags forward", "runs in slow ropes"],
      "syrupy": ["drizzles forward", "stretches and recoils"],
      "loose jelly": ["wobbles apart and gathers"],
      "soft gelatin": ["quivers forward"],
      "mucous": ["slides in slick pulses"],
      "foamy": ["bubbles forward"],
      "elastic gel": ["stretches and snaps forward"],
      "rubbery": ["bounces stiffly"],
      "tar-like": ["creeps in sticky pulls"],
      "waxen": ["slides in soft folds"],
      "fibrous gel": ["tugs itself by strands"],
      "grainy slurry": ["scrapes in loose clumps"],
      "crystalline gel": ["scrapes with brittle clicks"],
      "brittle jelly": ["cracks and reforms forward"],
      "clay-like": ["lumps forward"]
    };
    const appendagePools = {
      "two tendrils": ["pulls itself by tendrils", "grapples forward"],
      "four tendrils": ["tendril-walks", "climbs by tendrils"],
      "grasping pseudopods": ["knuckle-pulls", "grasps and drags"],
      "stub legs": ["stump-hops", "shuffles"],
      "limb-like arms": ["crawls on arm-masses", "hauls itself forward"],
      "cilia fringe": ["ripples on cilia", "glides"],
      "spines": ["ratchets forward", "anchors and jerks"],
      "fins": ["flutters", "paddles"],
      "wing-like membranes": ["strained-flutters", "glides"],
      "feeler stalks": ["probes before moving", "feeler-crawls"],
      "tail-like rudder": ["tail-pushes", "sways forward"],
      "rootlets": ["roots and creeps", "anchors and slides"],
      "hook claws": ["hooks and pulls", "clambers"],
      "asymmetrical limbs": ["limps unevenly", "lurches sideways"],
      "dissolving nubs": ["tries to crawl", "smears forward"]
    };
    const elementPools = {
      flame: ["flickers forward"],
      frost: ["slides on frost"],
      storm: ["jolts forward"],
      stone: ["grinds forward"],
      shadow: ["slips between shadows"],
      light: ["drifts"],
      water: ["flows"],
      wind: ["drifts"],
      wood: ["roots and creeps"],
      metal: ["drags heavily"],
      poison: ["seeps"],
      acid: ["sizzles forward"],
      dream: ["wanders dreamily"],
      gravity: ["anchors and drags"],
      ether: ["floats"],
      null: ["stutters through wards"]
    };
    const options = [...(shapePools[profile.shape] || shapePools.blob)];
    if (consistencyPools[profile.consistency]) {
      options.push(...consistencyPools[profile.consistency]);
    }
    if (appendagePools[profile.appendages]) {
      options.push(...appendagePools[profile.appendages]);
    }
    if (elementAffinity(profile.elementOutcome) >= 65 && elementPools[profile.element]) {
      options.push(...elementPools[profile.element]);
    }
    if (profile.weightKg >= 80) {
      options.push("drags heavily", "slumps under its mass");
    }
    if ((profile.shape === "puddle" || profile.shape === "flat sheet") && profile.appendages !== "none") {
      options.push("tries to crawl while smearing");
    }
    const rng = seedRng(`${state.seed}:movement:${genome}:${profile.shape}:${profile.consistency}:${profile.appendages}:${profile.element}`);
    return options[Math.floor(rng() * options.length)] || "oozes";
  }

  function estimatedReading(traitKey, outcome, contextKey = "") {
    const meta = outcome.meta || {};
    const baseLabel = outcome.label.split(" / ")[0];
    const index = Number.isFinite(meta.index) ? meta.index : stringHash(`${traitKey}:${outcome.label}`) % 16;
    if (traitKey === "size") {
      return estimatedSizeReading(outcome, contextKey);
    }
    if (traitKey === "color") {
      return makeColorObservation(outcome).reading;
    }
    if (traitKey === "shape" || traitKey === "consistency" || traitKey === "appendages") {
      return "";
    }
    if (traitKey === "behavior") {
      return estimateQuantity(0.4 + index * 0.33, "latency", traitKey, contextKey);
    }
    if (traitKey === "sustenance") {
      return "";
    }
    if (traitKey === "byproduct") {
      return estimateQuantity(0.4 + index * 0.42, "flow", traitKey, contextKey);
    }
    if (traitKey === "element") {
      return baseLabel === "none" ? "0 thaums" : estimateQuantity(elementAffinity(outcome), "thaums", traitKey, contextKey);
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
      return estimateQuantity(effectiveLifespanMinutes(meta), "duration", traitKey, contextKey);
    }
    return "";
  }

  function preciseReading(traitKey, outcome) {
    const meta = outcome.meta || {};
    const baseLabel = outcome.label.split(" / ")[0];
    const index = Number.isFinite(meta.index) ? meta.index : stringHash(`${traitKey}:${outcome.label}`) % 16;
    if (traitKey === "size") {
      return exactSizeReading(outcome);
    }
    if (traitKey === "color") {
      return `${String(meta.color || "#000000").toUpperCase()} swatch`;
    }
    if (traitKey === "shape" || traitKey === "consistency" || traitKey === "appendages") {
      return "";
    }
    if (traitKey === "behavior") {
      return `${formatDecimal(0.4 + index * 0.33, 1)}s response latency`;
    }
    if (traitKey === "sustenance") {
      return "";
    }
    if (traitKey === "byproduct") {
      return `${formatFlow(0.4 + index * 0.42)} yield`;
    }
    if (traitKey === "element") {
      return `${formatNumber(elementAffinity(outcome))} thaums`;
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
      return `${formatDuration(effectiveLifespanMinutes(meta))} expected lifespan`;
    }
    return "";
  }

  function effectiveLifespanMinutes(meta = {}) {
    return Math.max(1, Math.round((Number(meta.lifeMinutes) || 240) * SLIME_LIFESPAN_MULTIPLIER));
  }

  function estimateQuantity(value, kind, traitKey, contextKey) {
    const [low, high] = estimateBounds(value, traitKey, contextKey);
    if (kind === "volume") {
      return formatVolumeRange(low, high, value);
    }
    if (kind === "intake" || kind === "uptake") {
      return `${formatIntakeRange(low, high, value)} ${kind}`;
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
    if (kind === "thaums") {
      return `${formatNumber(clamp(low, 0, 100))} - ${formatNumber(clamp(high, 0, 100))} thaums`;
    }
    return `${formatNumber(low)} - ${formatNumber(high)}`;
  }

  function elementAffinity(outcome) {
    const label = baseOutcomeLabel(outcome);
    if (label === "none") {
      return 0;
    }
    const index = Number.isFinite(outcome?.meta?.index) ? outcome.meta.index : stringHash(`element:${outcome?.label || ""}`) % 16;
    const normalized = clamp(index, 0, ELEMENT_AFFINITY_MAX_INDEX) / ELEMENT_AFFINITY_MAX_INDEX;
    return Math.round(1 + normalized * 99);
  }

  function baseOutcomeLabel(outcome) {
    return String(outcome?.label || "").split(" / ")[0].toLowerCase();
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

  function makeColorObservation(outcome) {
    const level = skillLevel("observation");
    const tier = colorObservationTier(level);
    const hex = outcome.meta?.color || "#000000";
    const rgb = parseHexColor(hex);
    const hsl = rgbToHsl(rgb);
    const family = basicColorFamily(hsl, outcome.label);
    const refined = refinedColorFamily(hsl, family);
    const label = colorObservationLabel(tier, outcome.label, family, refined, hsl);
    const swatch = colorObservationSwatch(hex, family, tier);
    return {
      label,
      swatch,
      tier,
      level,
      reading: colorObservationReading(tier)
    };
  }

  function colorObservationTier(level) {
    if (level >= 90) {
      return 5;
    }
    if (level >= 75) {
      return 4;
    }
    if (level >= 50) {
      return 3;
    }
    if (level >= 25) {
      return 2;
    }
    if (level >= 10) {
      return 1;
    }
    return 0;
  }

  function colorObservationLabel(tier, exactLabel, family, refined, hsl) {
    if (tier <= 0) {
      return family;
    }
    if (tier === 1) {
      return modifiedColorName(broadColorModifier(hsl, family), family);
    }
    if (tier === 2) {
      return refined;
    }
    if (tier === 3) {
      return modifiedColorName(nuancedColorModifier(hsl, family), refined);
    }
    if (tier === 4) {
      return `close to ${exactLabel}`;
    }
    return exactLabel;
  }

  function colorObservationReading(tier) {
    if (tier >= 5) {
      return "high-confidence visual swatch";
    }
    if (tier >= 4) {
      return "trained visual swatch";
    }
    if (tier >= 3) {
      return "approximate visual swatch";
    }
    return "";
  }

  function basicColorFamily(hsl, label) {
    if (/\bclear\b/i.test(label)) {
      return "clear";
    }
    if (hsl.l <= 0.12) {
      return "black";
    }
    if (hsl.l >= 0.88 && hsl.s <= 0.28) {
      return "white";
    }
    if (hsl.s <= 0.14) {
      return "gray";
    }
    if (hsl.h >= 22 && hsl.h <= 52 && hsl.l <= 0.42 && hsl.s <= 0.72) {
      return "brown";
    }
    if (hsl.h < 16 || hsl.h >= 344) {
      return "red";
    }
    if (hsl.h < 45) {
      return "orange";
    }
    if (hsl.h < 70) {
      return "yellow";
    }
    if (hsl.h < 165) {
      return "green";
    }
    if (hsl.h < 255) {
      return "blue";
    }
    if (hsl.h < 304) {
      return "purple";
    }
    if (hsl.h < 344) {
      return "pink";
    }
    return "red";
  }

  function refinedColorFamily(hsl, family) {
    if (["black", "white", "gray", "clear"].includes(family)) {
      return neutralColorName(hsl, family);
    }
    if (family === "brown") {
      return hsl.h < 32 ? "red-brown" : "orange-brown";
    }
    if (family === "orange") {
      return hsl.h < 28 ? "red-orange" : "yellow-orange";
    }
    if (family === "yellow") {
      return hsl.h > 58 ? "yellow-green" : "golden yellow";
    }
    if (family === "green") {
      if (hsl.h < 92) {
        return "yellow-green";
      }
      if (hsl.h > 145) {
        return "blue-green";
      }
      return "green";
    }
    if (family === "blue") {
      if (hsl.h < 190) {
        return "blue-green";
      }
      if (hsl.h > 238) {
        return "violet-blue";
      }
      return "blue";
    }
    if (family === "purple") {
      return hsl.h < 280 ? "violet" : "purple";
    }
    if (family === "pink") {
      return hsl.h < 326 ? "rose pink" : "red-pink";
    }
    return family;
  }

  function neutralColorName(hsl, family) {
    if (family === "clear") {
      return "clear";
    }
    if (family === "white" && hsl.s > 0.08) {
      return "off-white";
    }
    if (family === "gray") {
      if (hsl.l > 0.68) {
        return "light gray";
      }
      if (hsl.l < 0.34) {
        return "dark gray";
      }
    }
    return family;
  }

  function broadColorModifier(hsl, family) {
    if (["black", "white", "clear"].includes(family)) {
      return "";
    }
    if (hsl.l <= 0.28) {
      return "dark";
    }
    if (hsl.l >= 0.74) {
      return "pale";
    }
    if (hsl.s <= 0.32) {
      return "dull";
    }
    if (hsl.s >= 0.68 && hsl.l >= 0.42) {
      return "bright";
    }
    return "";
  }

  function nuancedColorModifier(hsl, family) {
    if (["black", "white", "gray", "clear"].includes(family)) {
      return "";
    }
    if (hsl.l <= 0.3 && hsl.s >= 0.45) {
      return "deep";
    }
    if (hsl.l >= 0.72) {
      return "pale";
    }
    if (hsl.s >= 0.72) {
      return "vivid";
    }
    if (hsl.s <= 0.36) {
      return "muted";
    }
    return "";
  }

  function modifiedColorName(modifier, colorName) {
    if (!modifier || colorName.startsWith(`${modifier} `)) {
      return colorName;
    }
    return `${modifier} ${colorName}`;
  }

  function colorObservationSwatch(hex, family, tier) {
    const trueRgb = parseHexColor(hex);
    const baseRgb = parseHexColor(COLOR_FAMILY_SWATCHES[family] || "#888888");
    const blendAmount = [0, 0.22, 0.42, 0.62, 0.78, 0.9][tier] ?? 0;
    return rgbToHex(baseRgb.map((channel, index) => {
      return Math.round(channel + (trueRgb[index] - channel) * blendAmount);
    }));
  }

  function rgbToHsl([red, green, blue]) {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;
    if (delta === 0) {
      return { h: 0, s: 0, l: lightness };
    }
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    let hue;
    if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2);
    } else {
      hue = 60 * ((r - g) / delta + 4);
    }
    return { h: (hue + 360) % 360, s: saturation, l: lightness };
  }

  function rgbToHex(channels) {
    return `#${channels.map((channel) => {
      return clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0");
    }).join("").toUpperCase()}`;
  }

  function parseHexColor(hex) {
    const clean = String(hex).replace(/[^0-9a-f]/gi, "").padEnd(6, "0").slice(0, 6);
    return [0, 2, 4].map((start) => parseInt(clean.slice(start, start + 2), 16));
  }

  function formatLength(valueCm) {
    const safe = Math.max(0, Number(valueCm) || 0);
    if (safe >= 100) {
      const meters = safe / 100;
      return `${formatDecimal(meters, meters >= 10 ? 1 : 2)} m`;
    }
    if (safe < 1) {
      return `${formatDecimal(safe * 10, 1)} mm`;
    }
    return `${formatDecimal(safe, safe >= 10 ? 0 : 1)} cm`;
  }

  function formatWeight(valueKg) {
    const safe = Math.max(0, Number(valueKg) || 0);
    if (safe >= 1000) {
      return `${formatDecimal(safe / 1000, 2)} t`;
    }
    if (safe >= 1) {
      return `${formatDecimal(safe, safe >= 10 ? 1 : 2)} kg`;
    }
    return `${formatNumber(safe * 1000)} g`;
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

  function findCorpse(id) {
    return (state.corpses || []).find((corpse) => corpse.id === id) || null;
  }

  function getSelectedSlime() {
    return findSlime(state.selectedSlimeId);
  }

  function hasPendingTest(slimeId, testId) {
    return state.tasks.some((task) => task.type === "test" && task.data.slimeId === slimeId && task.data.testId === testId);
  }

  function hasPendingNecropsy(corpseId) {
    return state.tasks.some((task) => task.type === "necropsy" && task.data.corpseId === corpseId);
  }

  function containedSlimeCount() {
    return state.slimes.filter((slime) => slime.status === "contained").length;
  }

  function drummedCorpseCount() {
    return (state.corpses || []).filter((corpse) => corpse.storage === "drum").length;
  }

  function overflowCorpseCount() {
    return (state.corpses || []).filter((corpse) => corpse.storage === "overflow").length;
  }


  function localCorpseCount() {
    return (state.corpses || []).filter(isLocalCorpse).length;
  }

  function corpseHandlingPolicy() {
    state.policies = normalizePolicies(state.policies);
    return state.policies.corpseHandling;
  }

  function isLocalCorpse(corpse) {
    return Boolean(corpse && (corpse.storage === "container" || corpse.storage === "room"));
  }

  function containerCorpses(containerId) {
    return (state.corpses || []).filter((corpse) => corpse.storage === "container" && corpse.containerId === containerId);
  }

  function initialCorpseLocationForSlime(slime) {
    if (slime?.status === "contained" && slime.containerId && containerById(slime.containerId)) {
      const container = containerById(slime.containerId);
      return {
        storage: "container",
        containerId: container.id,
        roomId: container.roomId || slime.roomId || MAIN_ROOM_ID
      };
    }
    return {
      storage: "room",
      containerId: null,
      roomId: slime?.roomId || MAIN_ROOM_ID
    };
  }

  function normalizeCorpseLocation(corpse) {
    const allowed = new Set(["drum", "overflow", "container", "room"]);
    if (!allowed.has(corpse.storage)) {
      corpse.storage = "drum";
    }
    if (corpse.storage === "container") {
      const container = containerById(corpse.containerId);
      if (container) {
        corpse.containerId = container.id;
        corpse.roomId = container.roomId || corpse.roomId || MAIN_ROOM_ID;
      } else {
        corpse.storage = "room";
        corpse.containerId = null;
      }
    }
    if (corpse.storage === "room") {
      corpse.containerId = null;
      corpse.roomId = roomById(corpse.roomId)?.id || MAIN_ROOM_ID;
    }
    if (corpse.storage === "drum" || corpse.storage === "overflow") {
      corpse.containerId = null;
      corpse.roomId = roomById(corpse.roomId)?.id || MAIN_ROOM_ID;
    }
    if (corpse.storage !== "overflow") {
      corpse.nextOverflowEventAt = null;
    } else {
      corpse.nextOverflowEventAt ||= state.clock + OVERFLOW_EVENT_INTERVAL;
    }
    return corpse;
  }

  function corpseLocationLabel(corpse) {
    normalizeCorpseLocation(corpse);
    if (corpse.storage === "drum") {
      return "waste drum";
    }
    if (corpse.storage === "overflow") {
      return "overflow";
    }
    if (corpse.storage === "container") {
      return containerById(corpse.containerId)?.name || "unknown container";
    }
    return roomName(corpse.roomId || MAIN_ROOM_ID);
  }

  function corpseHandlingDestination(policy = corpseHandlingPolicy()) {
    return CORPSE_HANDLING_DESTINATION_BY_ID[policy.destination] ? policy.destination : CORPSE_HANDLING_DEFAULTS.destination;
  }

  function corpseHandlingDestinationLabel(policy = corpseHandlingPolicy()) {
    return CORPSE_HANDLING_DESTINATION_BY_ID[corpseHandlingDestination(policy)]?.label || "Waste drums";
  }

  function tryAutoMoveCorpse(corpse, options = {}) {
    const destination = corpseHandlingDestination();
    if (destination === "pitHole") {
      return tryMoveCorpseToPitHole(corpse, options);
    }
    return tryMoveCorpseToDrum(corpse, options);
  }

  function tryMoveCorpseToPitHole(corpse, options = {}) {
    if (!corpse || corpse.storage === "overflow") {
      return false;
    }
    if (corpse.storage === "container" && isPitHoleContainer(containerById(corpse.containerId))) {
      return false;
    }
    if (hasPendingNecropsy(corpse.id)) {
      return false;
    }
    const pit = availablePitHoleContainer();
    if (!pit) {
      if (options.automatic && !options.quiet) {
        addEvent(`${corpse.name} remains in ${corpseLocationLabel(corpse)}; no pit hole has room.`);
      }
      return false;
    }
    const from = corpseLocationLabel(corpse);
    corpse.storage = "container";
    corpse.containerId = pit.id;
    corpse.roomId = pit.roomId || PITS_ROOM_ID;
    corpse.nextOverflowEventAt = null;
    if (!options.quiet) {
      addEvent(`${corpse.name} remains moved from ${from} to ${pit.name}.`);
    }
    refreshCorpseProcessingTargets();
    return true;
  }

  function tryMoveCorpseToDrum(corpse, options = {}) {
    if (!corpse || corpse.storage === "drum" || corpse.storage === "overflow") {
      return false;
    }
    if (hasPendingNecropsy(corpse.id)) {
      return false;
    }
    if (drummedCorpseCount() >= WASTE_DRUM_CAPACITY) {
      if (options.automatic && !options.quiet) {
        addEvent(`${corpse.name} remains in ${corpseLocationLabel(corpse)}; no waste drum is available.`);
      }
      return false;
    }
    const from = corpseLocationLabel(corpse);
    corpse.storage = "drum";
    corpse.containerId = null;
    corpse.roomId = roomById(corpse.roomId)?.id || MAIN_ROOM_ID;
    corpse.nextOverflowEventAt = null;
    if (!options.quiet) {
      addEvent(`${corpse.name} remains moved from ${from} to a waste drum.`);
    }
    refreshCorpseProcessingTargets();
    return true;
  }


  function autoMoveLocalCorpsesToDrums() {
    return autoMoveLocalCorpses();
  }

  function autoMoveLocalCorpses() {
    let moved = 0;
    for (const corpse of state.corpses || []) {
      if (isLocalCorpse(corpse) && tryAutoMoveCorpse(corpse, { automatic: true, quiet: true })) {
        moved += 1;
      }
    }
    return moved;
  }


  function updateLocalCorpseEffects(corpse, elapsed) {
    if (!isLocalCorpse(corpse) || corpse.ruined) {
      return 0;
    }
    const freshness = corpseFreshness(corpse);
    const contaminationPerDay = {
      fresh: 0.8,
      decaying: 3,
      spoiled: 6,
      ruined: 4
    }[freshness] || 2;
    const delta = contaminationPerDay * (elapsed / 1440);
    let changed = 0;
    if (corpse.storage === "container") {
      const container = containerById(corpse.containerId);
      changed += adjustContainerEnvironment(container, "contamination", delta) ? 1 : 0;
      const incompatible = containerOccupants(corpse.containerId)
        .filter((slime) => !corpseFeedingRateForSlime(slime, corpse).rate);
      for (const slime of incompatible) {
        adjustSlimeStat(slime, "stress", 0.5 * (elapsed / 1440));
      }
    } else if (corpse.storage === "room") {
      changed += adjustRoomAttribute(corpse.roomId || MAIN_ROOM_ID, "contamination", delta) ? 1 : 0;
    }
    return changed;
  }

  function updateContainerCorpseFeeding(corpse, elapsed) {
    if (corpse.storage !== "container" || corpse.ruined) {
      return 0;
    }
    const occupants = containerOccupants(corpse.containerId)
      .filter((slime) => slime.id !== corpse.specimenId);
    if (!occupants.length) {
      return 0;
    }

    let changes = 0;
    for (const slime of occupants) {
      const feeding = corpseFeedingRateForSlime(slime, corpse);
      if (feeding.rate <= 0) {
        continue;
      }
      const nutritionGain = feeding.rate * (elapsed / 1440);
      if (nutritionGain <= 0) {
        continue;
      }
      adjustSlimeStat(slime, "nutrition", nutritionGain);
      adjustSlimeStat(slime, "currentMass", nutritionGain * 0.2);
      adjustSlimeStat(slime, "stress", -nutritionGain * 0.1);
      corpse.consumedProgress = clamp((Number(corpse.consumedProgress) || 0) + nutritionGain * feeding.consumption, 0, 100);
      if (!corpse.feedingNoticed) {
        corpse.feedingNoticed = true;
        addEvent(`${slime.name} began feeding on ${corpse.name} remains in ${corpseLocationLabel(corpse)}.`);
      }
      changes += 1;
      if (corpse.consumedProgress >= 100) {
        addEvent(`${corpse.name} remains were fully consumed in ${corpseLocationLabel(corpse)}.`);
        removeCorpseRecord(corpse.id);
        return changes + 1;
      }
    }
    return changes;
  }

  function corpseFeedingRateForSlime(slime, corpse) {
    if (!slime || slime.status === "dead") {
      return { rate: 0, consumption: 0 };
    }
    const evaluated = evaluateGenome(slime.genome);
    const tags = new Set(evaluated.traits.sustenance.meta?.tags || []);
    const freshness = corpseFreshness(corpse);
    let rate = 0;
    let consumption = 3;
    if (tags.has("corpse")) {
      rate = 18;
      consumption = 5;
    } else if (tags.has("decay") && freshness !== "fresh") {
      rate = 12;
      consumption = 4;
    } else if (tags.has("organic")) {
      rate = 5;
      consumption = 2;
    } else if ((tags.has("waste") || tags.has("contaminated")) && (freshness === "spoiled" || freshness === "ruined")) {
      rate = 8;
      consumption = 3;
    }
    return { rate, consumption };
  }


  function canAddContainedSlime() {
    return openPermanentContainers().length > 0;
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


  function scientistPhysicalState() {
    state.scientist = normalizeScientist(state.scientist);
    return state.scientist.physicalState;
  }

  function scientistExposureTrack() {
    const physicalState = scientistPhysicalState();
    physicalState.tracks.exposure ||= defaultScientistPhysicalState().tracks.exposure;
    return physicalState.tracks.exposure;
  }

  function physicalStateBand(value = scientistExposureTrack().current) {
    const current = clamp(Number(value) || 0, 0, PHYSICAL_STATE_MAX);
    return PHYSICAL_STATE_BANDS.find((band) => current <= band.max) || PHYSICAL_STATE_BANDS[PHYSICAL_STATE_BANDS.length - 1];
  }

  function exposureSeverityLabel(value = scientistExposureTrack().current) {
    const current = clamp(Number(value) || 0, 0, PHYSICAL_STATE_MAX);
    if (current <= 5) return "no meaningful";
    if (current <= 20) return "mild";
    if (current <= 40) return "moderate";
    if (current <= 65) return "serious";
    if (current <= 85) return "severe";
    return "critical";
  }

  function diagnosticConfidenceScore(test) {
    const skillLevelBest = Math.max(...(test.skillIds || ["observation"]).map((skillId) => skillLevel(skillId)), 0);
    return clamp((Number(test.quality) || 0) + skillLevelBest * 10, 0, 100);
  }

  function diagnosticConfidenceLabel(score) {
    return (DIAGNOSTIC_CONFIDENCE_BANDS.find((band) => score <= band.max) || DIAGNOSTIC_CONFIDENCE_BANDS[DIAGNOSTIC_CONFIDENCE_BANDS.length - 1]).label;
  }

  function currentExposureLikelySource(room) {
    const contamination = roomContaminationValue(room?.id || scientistRoomId());
    if (contamination >= 78) return `hazardous contamination in ${roomName(room?.id || scientistRoomId())}`;
    if (contamination >= 55) return `fouled room air in ${roomName(room?.id || scientistRoomId())}`;
    if (contamination >= 30) return `tainted residue in ${roomName(room?.id || scientistRoomId())}`;
    return "recent contaminated-room exposure";
  }

  function updateScientistPhysicalExposure(minutes) {
    const elapsed = Math.max(0, Number(minutes) || 0);
    if (!elapsed || scientistIsDead()) {
      return false;
    }

    state.scientist = normalizeScientist(state.scientist);
    const physicalState = state.scientist.physicalState;
    physicalState.tracks ||= {};
    physicalState.tracks.exposure ||= defaultScientistPhysicalState().tracks.exposure;
    const exposure = physicalState.tracks.exposure;

    const room = roomById(scientistRoomId());
    const contamination = roomContaminationValue(room?.id || MAIN_ROOM_ID);
    const before = Number(exposure.current) || 0;
    const max = Math.max(1, Number(exposure.max) || PHYSICAL_STATE_MAX);
    let delta = 0;

    if (contamination >= 30) {
      const contaminationPressure = (contamination - 25) / 75;
      delta = PHYSICAL_STATE_EXPOSURE_RISE_PER_HOUR * contaminationPressure * roomEffectScale(room) * (elapsed / 60);
      exposure.sourceType = "contamination exposure";
      exposure.likelySource = currentExposureLikelySource(room);
    } else {
      const cleanBonus = contamination <= 8 ? 1.35 : contamination <= 20 ? 1 : 0.55;
      const restBonus = hasPendingRest() ? PHYSICAL_STATE_REST_RECOVERY_MULTIPLIER : 1;
      delta = -PHYSICAL_STATE_EXPOSURE_DECAY_PER_HOUR * cleanBonus * restBonus * (elapsed / 60);
    }

    const nextExposure = clamp(before + delta, 0, max);
    exposure.current = nextExposure;
    exposure.max = max;
    state.scientist.physicalState = physicalState;

    const stamina = scientistVital("stamina");
    let staminaChanged = false;
    if (nextExposure >= 40 && !hasPendingRest()) {
      const staminaDrain = ((nextExposure - 35) / 65) * 3 * (elapsed / 60);
      const staminaBefore = stamina.current;
      stamina.current = clamp(stamina.current - staminaDrain, 0, stamina.max);
      staminaChanged = Math.abs(stamina.current - staminaBefore) >= 0.01;
    }

    let healthChanged = false;
    if (nextExposure >= 65) {
      const damage = ((nextExposure - 60) / 40) * 2.5 * (elapsed / 60);
      if (damage > 0) {
        const health = scientistVital("health");
        const healthBefore = health.current;
        health.current = clamp(health.current - damage, 0, health.max);
        healthChanged = Math.abs(health.current - healthBefore) >= 0.01;
        if (health.current <= 0 && healthBefore > 0) {
          state.runEnded = true;
          state.paused = true;
          addEvent("The scientist collapsed from untreated exposure. Run ended.");
        }
      }
    }

    if (Math.abs(nextExposure - before) >= 0.1) {
      const direction = nextExposure > before ? "rising" : "falling";
      if ((state.clock - physicalState.lastExposureEventAt) >= PHYSICAL_STATE_EVENT_INTERVAL) {
        const roomLabel = roomName(room?.id || MAIN_ROOM_ID);
        if (direction === "rising") {
          addEvent(`The air in ${roomLabel} leaves the scientist feeling ${physicalStateBand(nextExposure).label.toLowerCase()}. Physical State pressure is rising.`);
        } else if (hasPendingRest()) {
          addEvent(`Rest helps the scientist's body clear lingering exposure. Physical State is improving.`);
        } else {
          addEvent(`Cleaner air helps the scientist recover. Physical State is improving.`);
        }
        physicalState.lastExposureEventAt = state.clock;
      }
    }

    if ((staminaChanged || healthChanged) && (state.clock - physicalState.lastSymptomEventAt) >= PHYSICAL_STATE_EVENT_INTERVAL) {
      addEvent(`The scientist's ${physicalStateBand(nextExposure).label.toLowerCase()} condition takes a toll.`);
      physicalState.lastSymptomEventAt = state.clock;
    }

    state.scientist.physicalState = physicalState;
    return Math.abs(nextExposure - before) >= 0.01 || staminaChanged || healthChanged;
  }

  function physicalDiagnosticTask() {
    return (state.tasks || []).find((task) => task.type === "physicalDiagnostic") || null;
  }

  function physicalDiagnosticBlockReason(test) {
    if (!test) {
      return "Unknown physical-state test.";
    }
    if (scientistIsDead()) {
      return "The scientist is dead.";
    }
    if (physicalDiagnosticTask()) {
      return "A physical-state test is already in progress.";
    }
    const cost = adjustedStaminaCost(test.staminaCost, test.skillIds || ["observation"]);
    if (!hasStamina(cost)) {
      return `Not enough stamina. ${cost} required.`;
    }
    return "";
  }

  function startPhysicalDiagnostic(testId) {
    const test = PHYSICAL_DIAGNOSTIC_TEST_BY_ID[testId];
    const reason = physicalDiagnosticBlockReason(test);
    if (reason) {
      addEvent(reason);
      persist();
      render();
      return false;
    }
    const cost = adjustedStaminaCost(test.staminaCost, test.skillIds || ["observation"]);
    if (!spendStamina(cost)) {
      addEvent(`Not enough stamina. ${cost} required.`);
      persist();
      render();
      return false;
    }
    const skillId = test.skillIds?.[0] || "observation";
    const task = {
      id: `task-${state.nextTaskNumber++}`,
      type: "physicalDiagnostic",
      label: `${test.label}: physical state`,
      createdAt: state.clock,
      dueAt: state.clock + adjustedDuration(test.duration, skillId),
      data: {
        testId: test.id,
        staminaCost: cost,
        skillId,
        baseXp: test.id === "basicAssay" ? 18 : 6
      }
    };
    state.tasks.push(task);
    addEvent(`${test.label} started.`);
    persist();
    render();
    return true;
  }

  function completePhysicalDiagnostic(task) {
    const test = PHYSICAL_DIAGNOSTIC_TEST_BY_ID[task.data?.testId] || PHYSICAL_DIAGNOSTIC_TEST_BY_ID.selfCheck;
    const exposure = scientistExposureTrack();
    const score = diagnosticConfidenceScore(test);
    const confidence = diagnosticConfidenceLabel(score);
    const exact = Boolean(test.exactConfidence && score >= test.exactConfidence);
    const severity = exposureSeverityLabel(exposure.current);
    const sourceType = exposure.sourceType || "exposure";
    const likelySource = exposure.likelySource || "source unclear";
    let summary;
    if (exact) {
      summary = `${sourceType} ${Math.round(exposure.current)}/${Math.round(exposure.max)}`;
    } else if (score < 20) {
      summary = `cause unclear; ${severity} exposure signs possible`;
    } else if (score < 35) {
      summary = `${severity} exposure signs detected`;
    } else {
      summary = `${severity} ${sourceType} likely`;
    }
    const latestTest = {
      testId: test.id,
      label: test.resultLabel || "Latest test",
      summary,
      confidence,
      sourceType,
      likelySource,
      exactValue: exact ? Math.round(exposure.current) : null,
      testedAt: state.clock
    };
    scientistPhysicalState().latestTest = latestTest;
    awardActionXp(task.data?.skillId || test.skillIds?.[0] || "observation", task.data?.baseXp || 6, emptyRevealSummary(), test.label);
    addEvent(`${test.label} complete. ${summary}. Confidence: ${confidence}.`);
    return true;
  }


  function slimeStats(slime) {
    slime.stats = normalizeSlimeStats(slime.stats);
    return slime.stats;
  }

  function slimeStat(slime, key) {
    return slimeStats(slime)[key] || normalizeSlimeStats()[key];
  }

  function setSlimeStat(slime, key, value) {
    const def = SLIME_STAT_BY_KEY[key];
    if (!slime || !def) {
      return null;
    }
    const stats = slimeStats(slime);
    const current = clamp(Number(value) || 0, 0, stats[key].max);
    stats[key].current = current;
    if (key === "bodyIntegrity" && current <= 0) {
      slime.deathCause ||= "body integrity failure";
    }
    return stats[key];
  }

  function adjustSlimeStat(slime, key, delta) {
    const current = slimeStat(slime, key);
    return setSlimeStat(slime, key, current.current + (Number(delta) || 0));
  }

  function normalizeSlimeStats(candidate = {}) {
    const normalized = {};
    for (const stat of SLIME_STAT_DEFS) {
      const raw = candidate?.[stat.key];
      if (raw && typeof raw === "object") {
        const max = Math.max(1, Math.floor(Number(raw.max) || stat.max));
        const current = clamp(Number(raw.current) || 0, 0, max);
        normalized[stat.key] = { current, max };
      } else {
        const value = Number(raw);
        normalized[stat.key] = {
          current: clamp(Number.isFinite(value) ? value : stat.initial, 0, stat.max),
          max: stat.max
        };
      }
    }
    return normalized;
  }

  function formatSlimeStatValue(key, value) {
    if (key === "currentMass" || key === "divisionPressure") {
      return `${formatNumber(value.current)}%`;
    }
    return `${formatNumber(value.current)}/${formatNumber(value.max)}`;
  }

  function slimeStatBand(key, value) {
    const current = Number(value?.current) || 0;
    const max = Math.max(1, Number(value?.max) || 100);
    const percent = (current / max) * 100;
    if (key === "bodyIntegrity") {
      if (percent >= 85) return "Pristine";
      if (percent >= 60) return "Stable";
      if (percent >= 30) return "Damaged";
      return "Failing";
    }
    if (key === "nutrition") {
      if (percent <= 10) return "Starved";
      if (percent <= 35) return "Hungry";
      if (percent <= 75) return "Steady";
      if (percent <= 95) return "Sated";
      return "Saturated";
    }
    if (key === "currentMass") {
      if (percent >= 100) return "Full";
      if (percent >= 75) return "Regrowing";
      if (percent >= 40) return "Reduced";
      return "Fragmented";
    }
    if (key === "divisionPressure") {
      if (percent >= 100) return "Ready";
      if (percent >= 70) return "Rising";
      if (percent >= 25) return "Building";
      return "Dormant";
    }
    if (key === "stress") {
      if (percent < 20) return "Calm";
      if (percent < 50) return "Uneasy";
      if (percent < 80) return "Strained";
      return "Panicked";
    }
    return "Unknown";
  }


  function inventoryAmount(key) {
    return ensureInventory()[key] || 0;
  }

  function addInventoryItem(key, amount, source = "manual adjustment") {
    if (!INVENTORY_ITEM_BY_KEY[key]) {
      return 0;
    }
    const requestedDelta = Math.trunc(Number(amount) || 0);
    if (!requestedDelta) {
      return 0;
    }
    const inventory = ensureInventory();
    const before = inventory[key] || 0;
    const after = Math.max(0, before + requestedDelta);
    const actualDelta = after - before;
    inventory[key] = after;
    if (actualDelta) {
      recordInventoryChange(key, actualDelta, source);
    }
    return actualDelta;
  }

  function recordInventoryChange(key, amount, source = "adjustment") {
    if (!INVENTORY_ITEM_BY_KEY[key]) {
      return false;
    }
    const delta = Math.trunc(Number(amount) || 0);
    if (!delta) {
      return false;
    }
    const history = ensureInventoryHistory();
    const entries = history[key] ||= [];
    entries.unshift({ amount: delta, source: String(source || "adjustment") });
    history[key] = entries.slice(0, 10);
    return true;
  }

  function inventoryItemTooltip(item) {
    const lines = [
      item.label,
      item.description,
      `Current amount: ${formatNumber(inventoryAmount(item.key))}.`,
      "",
      "Recent changes:"
    ];
    const history = inventoryChangeHistory(item.key);
    if (!history.length) {
      lines.push("No recorded changes.");
    } else {
      for (const entry of history.slice(0, 10)) {
        const amount = Number(entry.amount) || 0;
        const prefix = amount > 0 ? "+" : "-";
        lines.push(`${prefix}${formatNumber(Math.abs(amount))} ${entry.source || "adjustment"}`);
      }
    }
    return lines.join("\n");
  }

  function inventoryChangeHistory(key) {
    return ensureInventoryHistory()[key] || [];
  }

  function inventoryItemLabel(key) {
    return INVENTORY_ITEM_BY_KEY[key]?.label || key;
  }

  function ensureInventory() {
    state.inventory = normalizeInventory(state.inventory);
    return state.inventory;
  }

  function ensureInventoryHistory() {
    state.inventoryHistory = normalizeInventoryHistory(state.inventoryHistory);
    return state.inventoryHistory;
  }

  function normalizeInventory(candidate) {
    const fallback = defaultInventory();
    const normalized = {};
    for (const item of INVENTORY_ITEM_DEFS) {
      const value = Number(candidate?.[item.key]);
      normalized[item.key] = Math.max(0, Math.floor(Number.isFinite(value) ? value : fallback[item.key]));
    }
    return normalized;
  }

  function normalizeInventoryHistory(candidate) {
    const normalized = defaultInventoryHistory();
    for (const item of INVENTORY_ITEM_DEFS) {
      const entries = Array.isArray(candidate?.[item.key]) ? candidate[item.key] : [];
      normalized[item.key] = entries
        .map((entry) => ({
          amount: Math.trunc(Number(entry?.amount) || 0),
          source: String(entry?.source || "adjustment")
        }))
        .filter((entry) => entry.amount)
        .slice(0, 10);
    }
    return normalized;
  }

  function resourceAmount(key) {
    return ensureResources()[key] || 0;
  }

  function addResource(key, amount) {
    if (!RESOURCE_BY_KEY[key]) {
      return false;
    }
    const delta = Math.trunc(Number(amount) || 0);
    if (!delta) {
      return false;
    }
    const resources = ensureResources();
    resources[key] = Math.max(0, (resources[key] || 0) + delta);
    return true;
  }

  function addResources(changes) {
    let changed = false;
    for (const [key, amount] of Object.entries(normalizeResourceChanges(changes))) {
      changed = addResource(key, amount) || changed;
    }
    return changed;
  }

  function addWaste(amount, tags = []) {
    const units = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!units) {
      return false;
    }
    addResource("waste", units);
    addWasteTags(tags, units);
    if (wasteTagsAreDirty(tags)) {
      addResource("contaminatedFeedstock", units * CONTAMINATED_FEEDSTOCK_PER_DIRTY_WASTE);
    }
    return true;
  }

  function wasteTagsAreDirty(tags) {
    return (tags || [])
      .map(normalizeWasteTag)
      .some((tag) => ["contaminated", "hazardous", "chemical", "toxic", "spoiled", "ruined"].includes(tag));
  }

  function spendWaste(amount) {
    const units = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!units || resourceAmount("waste") < units) {
      return false;
    }
    addResource("waste", -units);
    consumeWasteTags(units);
    return true;
  }

  function addWasteTags(tags, amount) {
    state.wasteTags = normalizeWasteTags(state.wasteTags);
    const units = Math.max(0, Math.trunc(Number(amount) || 0));
    for (const tag of tags) {
      const key = normalizeWasteTag(tag);
      if (!key) {
        continue;
      }
      state.wasteTags[key] = (state.wasteTags[key] || 0) + units;
    }
  }

  function consumeWasteTags(amount) {
    state.wasteTags = normalizeWasteTags(state.wasteTags);
    const units = Math.max(0, Math.trunc(Number(amount) || 0));
    if (resourceAmount("waste") <= 0) {
      state.wasteTags = {};
      return;
    }
    for (const key of Object.keys(state.wasteTags)) {
      state.wasteTags[key] -= units;
      if (state.wasteTags[key] <= 0) {
        delete state.wasteTags[key];
      }
    }
  }

  function corpseWasteTags(corpse) {
    const tags = ["corpse", "biological"];
    const freshness = corpseFreshness(corpse);
    if (freshness === "spoiled" || freshness === "ruined") {
      tags.push("contaminated", freshness);
    }
    const element = baseOutcomeLabel(evaluateGenome(corpse.genome).traits.element);
    if (element && element !== "none") {
      tags.push(`${element}-tainted`);
    }
    return tags;
  }

  function spendResources(costs) {
    if (resourceBlockReason(costs)) {
      return false;
    }
    for (const [key, amount] of Object.entries(normalizeResourceCosts(costs))) {
      addResource(key, -amount);
    }
    return true;
  }

  function resourceBlockReason(costs) {
    for (const [key, amount] of Object.entries(normalizeResourceCosts(costs))) {
      if (amount > resourceAmount(key)) {
        return `Not enough ${resourceLabel(key)}. ${formatNumber(amount)} required.`;
      }
    }
    return "";
  }

  function resourceLabel(key) {
    return RESOURCE_BY_KEY[key]?.label || key;
  }

  function formatResourceBundle(costs) {
    return Object.entries(normalizeResourceCosts(costs))
      .map(([key, amount]) => `${formatNumber(amount)} ${resourceLabel(key)}`)
      .join(", ");
  }

  function ensureResources() {
    state.resources = normalizeResources(state.resources);
    return state.resources;
  }

  function normalizeResources(candidate) {
    const fallback = defaultResources();
    const normalized = {};
    for (const resource of RESOURCE_DEFS) {
      const value = Number(candidate?.[resource.key]);
      normalized[resource.key] = Math.max(0, Math.floor(Number.isFinite(value) ? value : fallback[resource.key]));
    }
    return normalized;
  }



  function normalizeRooms(candidate) {
    const rooms = Array.isArray(candidate) ? candidate : [];
    const normalized = rooms
      .map(normalizeRoom)
      .filter(Boolean);
    for (const required of defaultRooms()) {
      if (!normalized.some((room) => room.id === required.id)) {
        normalized.push(required);
      }
    }
    const roomIds = new Set(normalized.map((room) => room.id));
    for (const room of normalized) {
      room.connections = normalizeRoomConnections(room.connections, room.id)
        .filter((roomId) => roomIds.has(roomId));
    }
    for (const room of normalized) {
      for (const connectionId of room.connections) {
        const connected = normalized.find((candidateRoom) => candidateRoom.id === connectionId);
        if (connected && !connected.connections.includes(room.id)) {
          connected.connections.push(room.id);
        }
      }
    }
    normalized.sort((a, b) => roomSortRank(a) - roomSortRank(b));
    return normalized;
  }



  function normalizeContainers(candidate) {
    const fallback = defaultContainers();
    const seen = new Set();
    const containers = (Array.isArray(candidate) ? candidate : [])
      .map(normalizeContainer)
      .filter(Boolean)
      .filter((container) => {
        if (seen.has(container.id)) {
          return false;
        }
        seen.add(container.id);
        return true;
      });
    for (const required of fallback) {
      if (!containers.some((container) => container.id === required.id)) {
        containers.push(required);
      }
    }
    containers.sort((a, b) => containerSortRank(a) - containerSortRank(b));
    return containers;
  }

  function normalizeContainer(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }
    const id = cleanContainerId(candidate.id) || "";
    const type = candidate.type === "synthesis" ? "synthesis" : "basic";
    if (!id) {
      return null;
    }
    const starter = starterContainerForId(id);
    const rawTypeId = String(candidate.typeId || "");
    const typeId = type === "synthesis"
      ? "synthesisTube"
      : CONTAINER_BASE_TYPE_BY_ID[rawTypeId]
        ? rawTypeId
        : starter?.typeId || "basicGlassJar";
    const suffix = numericSuffix(id);
    const fallbackName = type === "synthesis"
      ? "Synthesis Tube"
      : `${containerTypeLabel(typeId)}${suffix ? ` ${suffix}` : ""}`;
    const rawName = String(candidate.name || "").trim();
    const staleName = /^Basic Container \d+$/i.test(rawName) || rawName === titleCase(id);
    return {
      id,
      name: staleName ? fallbackName : rawName || fallbackName,
      type,
      typeId,
      wardIds: type === "synthesis" ? [] : normalizeContainerWardIds(candidate.wardIds || starter?.wardIds || []),
      roomId: type === "synthesis"
        ? MAIN_ROOM_ID
        : cleanRoomId(candidate.roomId) || starterContainerRoomId(starter || {}, Math.max(0, (numericSuffix(id) || 1) - 1)),
      condition: normalizeContainerCondition(candidate.condition),
      isOpen: normalizeContainerOpenState(candidate),
      environment: normalizeContainerEnvironment(candidate.environment)
    };
  }

  function normalizeContainerOpenState(candidate) {
    if (candidate?.type === "synthesis") {
      return false;
    }
    const typeId = String(candidate?.typeId || "");
    if (typeId === "openDirtPit") {
      return true;
    }
    return Boolean(candidate?.isOpen);
  }

  function cleanContainerId(value) {
    return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  function containerSortRank(container) {
    if (container.id === SYNTHESIS_TUBE_ID || container.type === "synthesis") {
      return -1000;
    }
    const match = String(container.id).match(/(\d+)$/);
    return match ? Number(match[1]) : 1000;
  }



  function normalizeRoom(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }
    const id = cleanRoomId(candidate.id) || MAIN_ROOM_ID;
    const base = ROOM_BASE_DEF_BY_ID[id] || null;
    const rawName = String(candidate.name || "").trim();
    const name = rawName || base?.name || (id === MAIN_ROOM_ID ? "Main Lab" : titleCase(id));
    return {
      id,
      name,
      articleName: String(candidate.articleName || base?.articleName || `the ${name}`).trim(),
      role: String(candidate.role || base?.role || "custom").trim(),
      roleLabel: String(candidate.roleLabel || base?.roleLabel || "Custom room").trim(),
      description: String(candidate.description || base?.description || "").trim(),
      geometry: normalizeRoomGeometry(candidate.geometry || base?.geometry),
      connections: normalizeRoomConnections(candidate.connections || base?.connections, id),
      observation: normalizeRoomObservation(candidate.observation),
      attributes: normalizeRoomAttributes(candidate.attributes || base?.attributes)
    };
  }




  function normalizeRoomObservation(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }
    const exposureScore = clamp(Number(candidate.exposureScore) || 0, 0, 100);
    const observedAt = Number.isFinite(Number(candidate.observedAt)) ? Number(candidate.observedAt) : 0;
    const exposureBand = String(candidate.exposureBand || roomExposureBand(exposureScore).label);
    const effect = String(candidate.effect || roomExposureBand(exposureScore).effect);
    const knownFactors = Array.isArray(candidate.knownFactors) ? candidate.knownFactors.map(String).filter(Boolean).slice(0, 6) : [];
    const unknownFactors = Array.isArray(candidate.unknownFactors) ? candidate.unknownFactors.map(String).filter(Boolean).slice(0, 6) : [];
    const freeCreatureIds = idList(candidate.freeCreatureIds);
    const cleanupActorIds = idList(candidate.cleanupActorIds);
    const residueActorIds = idList(candidate.residueActorIds);
    const contaminationValue = Number.isFinite(Number(candidate.contaminationValue))
      ? Math.round(Number(candidate.contaminationValue) * 10) / 10
      : null;
    return {
      observedAt,
      exposureScore,
      exposureBand,
      effect,
      knownFactors,
      unknownFactors,
      contaminationValue,
      contaminationBand: String(candidate.contaminationBand || "Unknown"),
      crowdingLabel: String(candidate.crowdingLabel || "Unknown"),
      freeCreatureCount: Math.max(0, Math.floor(Number(candidate.freeCreatureCount) || freeCreatureIds.length || 0)),
      freeCreatureIds,
      cleanupActorIds,
      residueActorIds
    };
  }


  function normalizeRoomObservations(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const normalized = {};
    for (const [roomId, observation] of Object.entries(source)) {
      const cleanId = cleanRoomId(roomId);
      const normalizedObservation = normalizeRoomObservation(observation);
      if (cleanId && normalizedObservation) {
        normalized[cleanId] = normalizedObservation;
      }
    }
    return normalized;
  }

  function syncRoomObservationMemory() {
    state.roomObservations = normalizeRoomObservations(state.roomObservations);
    for (const room of state.rooms || []) {
      if (room.observation) {
        state.roomObservations[room.id] = normalizeRoomObservation(room.observation);
      } else if (state.roomObservations[room.id]) {
        room.observation = normalizeRoomObservation(state.roomObservations[room.id]);
      }
    }
  }

  function normalizeRoomGeometry(candidate = {}) {
    const shape = String(candidate?.shape || "irregular").trim() || "irregular";
    const lengthM = Math.max(1, Number(candidate?.lengthM) || Number(candidate?.approximateLengthM) || 8);
    const widthM = Math.max(1, Number(candidate?.widthM) || Number(candidate?.approximateWidthM) || 6);
    const heightM = Math.max(1, Number(candidate?.heightM) || 3);
    const computedArea = lengthM * widthM;
    const floorAreaM2 = Math.max(1, Number(candidate?.floorAreaM2) || computedArea);
    const volumeM3 = Math.max(1, Number(candidate?.volumeM3) || floorAreaM2 * heightM);
    const notes = String(candidate?.notes || "").trim();
    return {
      shape,
      lengthM,
      widthM,
      heightM,
      floorAreaM2,
      volumeM3,
      notes
    };
  }

  function normalizeRoomConnections(candidate, selfId = "") {
    const seen = new Set();
    const values = Array.isArray(candidate) ? candidate : [];
    return values
      .map(cleanRoomId)
      .filter(Boolean)
      .filter((roomId) => roomId !== selfId)
      .filter((roomId) => {
        if (seen.has(roomId)) {
          return false;
        }
        seen.add(roomId);
        return true;
      });
  }

  function cleanRoomId(value) {
    const cleaned = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");
    return cleaned || "";
  }

  function normalizeRoomAttributes(candidate) {
    const normalized = {};
    for (const def of ROOM_ATTRIBUTE_DEFS) {
      const current = Number(candidate?.[def.key]?.current);
      const baseline = Number(candidate?.[def.key]?.baseline);
      const recoveryPerHour = Number(candidate?.[def.key]?.recoveryPerHour);
      normalized[def.key] = {
        current: clamp(Number.isFinite(current) ? current : def.initial, 0, 100),
        baseline: clamp(Number.isFinite(baseline) ? baseline : def.baseline, 0, 100),
        recoveryPerHour: Math.max(0, Number.isFinite(recoveryPerHour) ? recoveryPerHour : def.recoveryPerHour)
      };
    }
    return normalized;
  }

  function normalizeContainerEnvironment(candidate) {
    const env = {};
    for (const def of ROOM_ATTRIBUTE_DEFS) {
      const raw = candidate?.[def.key];
      const current = Number(raw?.current);
      const baseline = Number(raw?.baseline);
      const recoveryPerHour = Number(raw?.recoveryPerHour);
      env[def.key] = {
        current: clamp(Number.isFinite(current) ? current : def.initial, 0, 100),
        baseline: clamp(Number.isFinite(baseline) ? baseline : def.baseline, 0, 100),
        recoveryPerHour: Math.max(0, Number.isFinite(recoveryPerHour) ? recoveryPerHour : def.recoveryPerHour)
      };
    }
    return env;
  }

  function normalizeFeedstockIncomeProgress(candidate) {
    const normalized = {};
    for (const feedstock of FEEDSTOCK_DEFS.filter((item) => item.passive)) {
      const value = Number(candidate?.[feedstock.key]);
      normalized[feedstock.key] = clamp(Number.isFinite(value) ? value : 0, 0, 1);
    }
    return normalized;
  }

  function normalizeResourceCosts(costs) {
    const normalized = {};
    for (const [key, amount] of Object.entries(costs || {})) {
      if (!RESOURCE_BY_KEY[key]) {
        continue;
      }
      const value = Math.trunc(Number(amount) || 0);
      if (value > 0) {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  function normalizeResourceChanges(changes) {
    const normalized = {};
    for (const [key, amount] of Object.entries(changes || {})) {
      if (!RESOURCE_BY_KEY[key]) {
        continue;
      }
      const value = Math.trunc(Number(amount) || 0);
      if (value) {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  function normalizeWasteTags(candidate) {
    const normalized = {};
    for (const [tag, amount] of Object.entries(candidate || {})) {
      const key = normalizeWasteTag(tag);
      const value = Math.max(0, Math.floor(Number(amount) || 0));
      if (key && value > 0) {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  function normalizeWasteTag(tag) {
    return String(tag || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  function normalizeDoors(candidate, roomsOverride = null) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const rooms = Array.isArray(roomsOverride) && roomsOverride.length
      ? roomsOverride
      : Array.isArray(state?.rooms) && state.rooms.length
        ? state.rooms
        : defaultRooms();
    const normalized = {};
    const roomIds = new Set(rooms.map((room) => room.id));
    for (const room of rooms) {
      for (const connectedId of room.connections || []) {
        if (!roomIds.has(connectedId)) {
          continue;
        }
        const key = doorKey(room.id, connectedId);
        if (!key || normalized[key]) {
          continue;
        }
        const existing = source[key];
        const roomIdsForDoor = doorRoomIdsFromKey(key);
        const stateValue = existing?.state === DOOR_STATE_CLOSED || existing === DOOR_STATE_CLOSED
          ? DOOR_STATE_CLOSED
          : existing?.state === DOOR_STATE_OPEN || existing === DOOR_STATE_OPEN
            ? DOOR_STATE_OPEN
            : defaultDoorState(room.id, connectedId);
        normalized[key] = {
          roomIds: roomIdsForDoor,
          state: stateValue
        };
      }
    }
    return normalized;
  }

  function corpseProcessingTargets() {
    state.policies = normalizePolicies(state.policies);
    return state.policies.corpseProcessingTargets;
  }


  function normalizePolicies(candidate) {
    const fallback = defaultPolicies();
    const feeding = {
      ...AUTO_FEED_DEFAULTS,
      ...(candidate?.feeding || {})
    };
    feeding.mode = AUTO_FEED_MODE_BY_ID[feeding.mode] ? feeding.mode : AUTO_FEED_DEFAULTS.mode;
    feeding.massGoal = AUTO_FEED_MASS_GOAL_BY_ID[feeding.massGoal] ? feeding.massGoal : AUTO_FEED_DEFAULTS.massGoal;
    feeding.feedBelow = clamp(Math.round(Number(feeding.feedBelow) || AUTO_FEED_DEFAULTS.feedBelow), 1, 100);
    feeding.feedUntil = clamp(Math.round(Number(feeding.feedUntil) || AUTO_FEED_DEFAULTS.feedUntil), 1, 100);
    feeding.preserveReserve = Math.max(0, Math.floor(Number(feeding.preserveReserve) || 0));
    for (const key of [
      "allowUnknownSustenance",
      "usePreferredWhenKnown",
      "allowPartialMatches",
      "allowBadMatches",
      "allowHarmfulFeeding",
      "allowCarrion",
      "allowContaminated",
      "allowReproductionPressure"
    ]) {
      feeding[key] = Boolean(feeding[key]);
    }
    const corpseHandling = {
      ...CORPSE_HANDLING_DEFAULTS,
      ...(candidate?.corpseHandling || {})
    };
    corpseHandling.autoMoveToDrums = Boolean(corpseHandling.autoMoveToDrums);
    corpseHandling.destination = CORPSE_HANDLING_DESTINATION_BY_ID[corpseHandling.destination] ? corpseHandling.destination : CORPSE_HANDLING_DEFAULTS.destination;
    const handling = {
      method: HANDLING_METHOD_BY_ID[candidate?.handling?.method] ? candidate.handling.method : DEFAULT_HANDLING_METHOD
    };
    const doors = {
      behavior: DOOR_POLICY_BY_ID[candidate?.doors?.behavior] ? candidate.doors.behavior : DEFAULT_DOOR_POLICY_ID
    };
    return {
      ...fallback,
      ...(candidate || {}),
      feeding,
      corpseHandling,
      handling,
      doors,
      corpseProcessingTargets: Object.fromEntries(
        CORPSE_STATE_POLICY_DEFS.map((stateDef) => [
          stateDef.key,
          Boolean(candidate?.corpseProcessingTargets?.[stateDef.key] ?? fallback.corpseProcessingTargets[stateDef.key])
        ])
      )
    };
  }


  function adjustedDuration(baseDuration, skillId) {
    return Math.max(1, Math.ceil(baseDuration * skillReductionMultiplier(skillLevel(skillId))));
  }

  function adjustedStaminaCost(baseCost, skillIds, options = {}) {
    return adjustedStaminaCostBreakdown(baseCost, skillIds, options).finalCost;
  }

  function physicalStateActionStrain(label = physicalStateBandSafe().label) {
    const normalized = String(label || "Steady").toLowerCase();
    if (normalized === "queasy") {
      return { label: "Queasy", modifier: 1, text: "Physical actions cost slightly more stamina." };
    }
    if (normalized === "sickened") {
      return { label: "Sickened", modifier: 2, text: "Physical actions cost more stamina." };
    }
    if (normalized === "toxic") {
      return { label: "Toxic", modifier: 4, text: "Physical actions cost much more stamina and Health may suffer over time." };
    }
    if (normalized === "failing") {
      return { label: "Failing", modifier: 6, text: "Most risky physical work is extremely difficult." };
    }
    if (normalized === "uneasy") {
      return { label: "Uneasy", modifier: 0, text: "Something feels off, but actions are not strained yet." };
    }
    return { label: "Steady", modifier: 0, text: "No Physical State stamina strain." };
  }

  function physicalStateBandSafe() {
    try {
      return physicalStateBand(scientistExposureTrack().current);
    } catch {
      return { label: "Steady" };
    }
  }

  function physicalStateRiskGateInfo(actionLabel, options = {}) {
    const band = physicalStateBandSafe().label;
    const label = actionLabel || "this action";
    if (band === "Failing" && !options.allowFailing) {
      return {
        band,
        blocked: true,
        requiresConfirm: false,
        message: `The scientist is Failing. They cannot safely perform ${label}. Rest, move, or run a diagnostic first.`
      };
    }
    if (band === "Toxic" && !options.skipToxicConfirm) {
      return {
        band,
        blocked: false,
        requiresConfirm: true,
        message: `The scientist is Toxic.\n${label} may worsen their condition or cause injury.\n\nContinue?`
      };
    }
    return { band, blocked: false, requiresConfirm: false, message: "" };
  }

  function physicalStateRiskBlockReason(actionLabel, options = {}) {
    const gate = physicalStateRiskGateInfo(actionLabel, options);
    return gate.blocked ? gate.message : "";
  }

  function physicalStateRiskTitle(actionLabel, options = {}) {
    const gate = physicalStateRiskGateInfo(actionLabel, options);
    if (gate.blocked) {
      return gate.message;
    }
    if (gate.requiresConfirm) {
      return `Toxic Physical State: confirmation required before ${actionLabel}.`;
    }
    return "";
  }

  function confirmPhysicalStateRiskIfNeeded(actionLabel, options = {}) {
    const gate = physicalStateRiskGateInfo(actionLabel, options);
    if (gate.blocked) {
      addEvent(gate.message);
      persist();
      render();
      return false;
    }
    if (!gate.requiresConfirm) {
      return true;
    }
    const accepted = window.confirm(gate.message);
    const eventMessage = accepted
      ? `Toxic Physical State confirmed: ${actionLabel}.`
      : `Toxic Physical State action cancelled: ${actionLabel}.`;
    if (state.events.at(-1)?.message !== eventMessage) {
      addEvent(eventMessage);
    }
    persist();
    render();
    return accepted;
  }

  function riskyTaskPhysicalStateLabel(type, label) {
    if (type === "necropsy") {
      return label || "necropsy";
    }
    if (type === "synthesize") {
      return label || "synthesis work";
    }
    if (type === "breed") {
      return label || "forced recombination";
    }
    return "";
  }

  function adjustedStaminaCostBreakdown(baseCost, skillIds = [], options = {}) {
    const base = Math.max(0, Number(baseCost) || 0);
    const bestLevel = Math.max(...(skillIds || []).filter(Boolean).map((skillId) => skillLevel(skillId)), 0);
    const multiplierAdjusted = Math.max(1, Math.ceil(base * skillReductionMultiplier(bestLevel)));
    const levelStepDiscount = Math.floor(bestLevel / 5);
    const skillAdjusted = Math.max(1, Math.min(multiplierAdjusted, base - levelStepDiscount));
    const skillDelta = skillAdjusted - base;
    const strain = options.includePhysicalState === false
      ? { label: "Steady", modifier: 0, text: "No Physical State stamina strain." }
      : physicalStateActionStrain();
    const finalCost = Math.max(1, skillAdjusted + strain.modifier);
    const netDelta = finalCost - base;
    const skillLabels = (skillIds || [])
      .filter(Boolean)
      .map((skillId) => SKILL_BY_ID[skillId]?.label || skillId);
    const lines = [`Base cost: ${base} STA`];
    if (skillDelta < 0) {
      lines.push(`Skill${skillLabels.length ? ` (${skillLabels.join(", ")})` : ""}: ${skillDelta} STA`);
    } else if (skillDelta > 0) {
      lines.push(`Skill adjustment: +${skillDelta} STA`);
    } else {
      lines.push("Skill adjustment: +0 STA");
    }
    if (strain.modifier > 0) {
      lines.push(`Physical State: ${strain.label} +${strain.modifier} STA`);
    } else {
      lines.push(`Physical State: ${strain.label} +0 STA`);
    }
    lines.push(`Final cost: ${finalCost} STA`);
    return {
      baseCost: base,
      bestLevel,
      skillDelta,
      physicalStateDelta: strain.modifier,
      physicalStateLabel: strain.label,
      physicalStateText: strain.text,
      finalCost,
      netDelta,
      direction: netDelta > 0 ? "negative" : netDelta < 0 ? "positive" : "neutral",
      title: lines.join("\n")
    };
  }

  function staminaCostEl(baseCost, skillIds = [], options = {}) {
    const breakdown = adjustedStaminaCostBreakdown(baseCost, skillIds, options);
    const element = document.createElement("span");
    element.className = "modified-stamina-cost";
    if (breakdown.direction === "negative") {
      element.classList.add("modified-stamina-negative");
    } else if (breakdown.direction === "positive") {
      element.classList.add("modified-stamina-positive");
    } else {
      element.classList.add("modified-stamina-neutral");
    }
    element.setAttribute("data-stamina-cost-direction", breakdown.direction);
    element.dataset.baseStaminaCost = String(breakdown.baseCost);
    element.dataset.finalStaminaCost = String(breakdown.finalCost);
    element.textContent = `${breakdown.finalCost} STA`;
    element.title = breakdown.title;
    if (breakdown.direction === "negative") {
      element.style.color = "#b42318";
    } else if (breakdown.direction === "positive") {
      element.style.color = "#287d3c";
    }
    return element;
  }

  function setButtonStaminaLabel(button, label, baseCost, skillIds = [], options = {}) {
    const duration = options.duration ? `${options.duration}, ` : "";
    const suffix = options.suffix ? `, ${options.suffix}` : "";
    button.textContent = "";
    button.append(document.createTextNode(`${label} (${duration}`), staminaCostEl(baseCost, skillIds, options), document.createTextNode(`${suffix})`));
    const breakdown = adjustedStaminaCostBreakdown(baseCost, skillIds, options);
    button.setAttribute("data-stamina-cost-direction", breakdown.direction);
    button.dataset.baseStaminaCost = String(breakdown.baseCost);
    button.dataset.finalStaminaCost = String(breakdown.finalCost);
    if (!button.title) {
      button.title = breakdown.title;
    }
    return breakdown.finalCost;
  }

  function tooltipKeywordEl(label, keyOrText) {
    const element = document.createElement("span");
    element.className = "keyword-tooltip";
    element.dataset.tooltipKeyword = normalizeCommandName(label);
    element.textContent = label;
    element.title = tooltipTextFor(label, keyOrText);
    return element;
  }

  function tooltipTextFor(label, keyOrText = "") {
    if (keyOrText && !TOOLTIP_DEFS[keyOrText]) {
      return String(keyOrText);
    }
    const key = keyOrText || normalizeCommandName(label);
    return TOOLTIP_DEFS[key]?.body || TOOLTIP_DEFS[normalizeCommandName(label)]?.body || String(label);
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

  function normalizeGenomeLength(value, seed, contextKey = "genome") {
    const cleaned = cleanGenome(value);
    if (!cleaned) {
      return "";
    }
    if (cleaned.length === GENOME_LENGTH) {
      return cleaned;
    }
    const rng = seedRng(`${seed}:genome-migration:${contextKey}:${cleaned}`);
    let normalized = cleaned;
    while (normalized.length < GENOME_LENGTH) {
      normalized += BASES[Math.floor(rng() * BASES.length)];
    }
    return normalized.slice(0, GENOME_LENGTH);
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
    const parentA = normalizeGenomeLength(genomeA, state.seed, "breed:a");
    const parentB = normalizeGenomeLength(genomeB, state.seed, "breed:b");
    let source = rng() < 0.5 ? parentA : parentB;
    let result = "";
    for (let i = 0; i < GENOME_LENGTH; i += 1) {
      if (i > 0 && rng() < 0.18) {
        source = source === parentA ? parentB : parentA;
      }
      result += source[i];
    }
    return result;
  }

  function forcedRecombinationGenome(genomeA, genomeB, rng, parentA, parentB) {
    const crossed = crossoverGenome(genomeA, genomeB, rng);
    const riskA = Number(evaluateGenome(parentA.genome).traits.stability.meta?.risk) || 5;
    const riskB = Number(evaluateGenome(parentB.genome).traits.stability.meta?.risk) || 5;
    let mutationCount = rng() < 0.35 + ((riskA + riskB) / 2) * 0.035 ? 1 : 0;
    if (rng() < 0.12) {
      mutationCount += 1;
    }
    return mutateGenome(crossed, rng, mutationCount);
  }

  function mutateGenome(genome, rng, mutationCount) {
    const bases = normalizeGenomeLength(genome, state.seed, "mutate") || randomGenome(rng);
    const chars = bases.split("");
    const count = Math.max(0, Math.floor(Number(mutationCount) || 0));
    for (let i = 0; i < count; i += 1) {
      const index = Math.floor(rng() * chars.length);
      const choices = BASES.filter((base) => base !== chars[index]);
      chars[index] = choices[Math.floor(rng() * choices.length)];
    }
    return chars.join("");
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

  function titleCase(value) {
    const text = String(value || "");
    return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
  }

  function clonePlainObject(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function numericSuffix(value) {
    const match = String(value || "").match(/(\d+)$/);
    return match ? Number(match[1]) || 0 : 0;
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

  function slimeTraitMarkerOutcome(slime, traitKey, outcome) {
    if (!slime.revealed?.[traitKey]) {
      return null;
    }
    if (traitKey === "color" && !slime.measured?.[traitKey]) {
      const observation = slime.traitObservations?.[traitKey];
      if (observation?.swatch) {
        return {
          label: observation.label,
          meta: { color: observation.swatch }
        };
      }
    }
    return outcome;
  }

  function knownOutcomeMarker(traitKey, item, outcome) {
    if (traitKey === "color" && item?.swatch && !item.measurement) {
      return {
        label: item.label,
        meta: { color: item.swatch }
      };
    }
    return outcome;
  }

  function traitMarkerEl(traitKey, outcome = null) {
    const marker = document.createElement("span");
    marker.className = `trait-marker trait-marker-${traitKey}`;
    marker.setAttribute("aria-hidden", "true");

    if (!outcome) {
      const hiddenIcon = ["color", "element", "shape", "byproduct"].includes(traitKey);
      if (hiddenIcon) {
        marker.classList.add("trait-marker-unknown");
      }
      marker.textContent = hiddenIcon ? "?" : TRAIT_SYMBOLS[traitKey] || "?";
      marker.title = `${getRegionLabel(traitKey)} unknown`;
      return marker;
    }

    if (traitKey === "color" && outcome?.meta?.color) {
      marker.classList.add("trait-swatch");
      marker.style.backgroundColor = outcome.meta.color;
      marker.title = `${getRegionLabel(traitKey)}: ${outcome.label}`;
      return marker;
    }

    if (traitKey === "shape" || traitKey === "byproduct") {
      const icon = traitIdentityIconEl(traitKey, outcome);
      if (icon) {
        marker.classList.add("trait-marker-category");
        marker.append(icon);
        marker.title = `${getRegionLabel(traitKey)}: ${outcome.label}`;
        return marker;
      }
    }

    marker.textContent = TRAIT_SYMBOLS[traitKey] || "•";
    marker.title = outcome?.label
      ? `${getRegionLabel(traitKey)}: ${outcome.label}`
      : getRegionLabel(traitKey);
    return marker;
  }

  function slimeNameLink(slime, extraClass = "") {
    return entityLink(slime.name, `Open ${slime.name}`, extraClass, () => {
      focusSlime(slime.id);
    });
  }

  function corpseNameLink(corpse, extraClass = "") {
    return entityLink(corpse.name, `Find ${corpse.name} remains`, extraClass, () => {
      focusCorpse(corpse.id);
    });
  }

  function entityLink(label, title, extraClass, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `entity-link${extraClass ? ` ${extraClass}` : ""}`;
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      action();
    });
    return button;
  }

  function targetCorpseChip(corpse) {
    const element = document.createElement("span");
    element.className = "slime-chip";
    element.append(document.createTextNode("target "), corpseNameLink(corpse, "entity-link-chip"));
    return element;
  }

  function appendLinkedEntityText(parent, text) {
    const refs = linkableEntityRefs();
    let cursor = 0;
    const message = String(text || "");
    while (cursor < message.length) {
      const next = nextEntityReference(message, cursor, refs);
      if (!next) {
        parent.append(document.createTextNode(message.slice(cursor)));
        break;
      }
      if (next.index > cursor) {
        parent.append(document.createTextNode(message.slice(cursor, next.index)));
      }
      parent.append(next.ref.kind === "slime"
        ? entityLink(next.ref.name, `Open ${next.ref.name}`, "", () => focusSlime(next.ref.id))
        : entityLink(next.ref.name, `Find ${next.ref.name} remains`, "", () => focusCorpse(next.ref.id)));
      cursor = next.index + next.ref.name.length;
    }
  }

  function linkableEntityRefs() {
    const refs = [];
    const seen = new Set();
    for (const slime of state.slimes || []) {
      if (!slime?.name || seen.has(`slime:${slime.name}`)) {
        continue;
      }
      seen.add(`slime:${slime.name}`);
      refs.push({ kind: "slime", id: slime.id, name: slime.name });
    }
    for (const corpse of state.corpses || []) {
      if (!corpse?.name || seen.has(`corpse:${corpse.name}`)) {
        continue;
      }
      seen.add(`corpse:${corpse.name}`);
      refs.push({ kind: "corpse", id: corpse.id, name: corpse.name });
    }
    return refs.sort((a, b) => b.name.length - a.name.length);
  }

  function nextEntityReference(message, cursor, refs) {
    let best = null;
    for (const ref of refs) {
      const index = message.indexOf(ref.name, cursor);
      if (index < 0) {
        continue;
      }
      if (!best || index < best.index || (index === best.index && ref.name.length > best.ref.name.length)) {
        best = { index, ref };
      }
    }
    return best;
  }

  function focusSlime(slimeId, options = {}) {
    const slime = findSlime(slimeId);
    if (!slime) {
      return;
    }
    state.selectedSlimeId = slime.id;
    persist();
    render();
    requestAnimationFrame(() => {
      const card = elementByDataset("slimeCard", slime.id);
      focusEntityCard(card, options);
    });
  }

  function focusCorpse(corpseId, options = {}) {
    const corpse = findCorpse(corpseId);
    if (!corpse) {
      return;
    }
    requestAnimationFrame(() => {
      const card = elementByDataset("corpseCard", corpse.id);
      focusEntityCard(card, options);
    });
  }

  function focusEntityCard(card, options = {}) {
    if (!card) {
      return;
    }
    const container = card.closest(".slime-list, .corpse-list");
    const behavior = options.animate === false ? "auto" : "smooth";
    if (container) {
      scrollCardWithinContainer(container, card, behavior);
    } else {
      card.scrollIntoView({ block: "start", inline: "nearest", behavior });
    }
    if (options.animate === false) {
      return;
    }
    card.classList.remove("focus-pulse");
    void card.offsetWidth;
    card.classList.add("focus-pulse");
    window.setTimeout(() => {
      card.classList.remove("focus-pulse");
    }, 1400);
  }

  function scrollCardWithinContainer(container, card, behavior) {
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const margin = parseFloat(window.getComputedStyle(card).scrollMarginTop) || 0;
    const targetTop = container.scrollTop + cardRect.top - containerRect.top - margin;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior
    });
  }

  function elementByDataset(key, value) {
    return [...document.querySelectorAll(`[data-${kebabCase(key)}]`)]
      .find((element) => element.dataset[key] === value) || null;
  }

  function kebabCase(value) {
    return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
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
    const hasSave = hasLocalSave();
    setActionButtonState(dom.loadLastSaveBtn, !hasSave, "No local save found.");
    dom.loadLastSaveStatus.textContent = hasSave
      ? "A local save is available."
      : "No local save found.";
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
      const payload = JSON.parse(raw);
      const loaded = normalizeState(payload.state || payload);
      const previousState = state;
      state = loaded;
      syncRoomObservationMemory();
      observeScientistRoom();
      const observed = state;
      state = previousState;
      return observed;
    } catch (error) {
      console.warn("Load failed", error);
      return null;
    }
  }

  function hasLocalSave() {
    try {
      return Boolean(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return false;
    }
  }

  function normalizeState(candidate) {
    const next = { ...defaultState(), ...candidate };
    next.discoveries ||= {};
    next.regionNotes ||= {};
    next.genomeNotes ||= {};
    next.slimeNotes ||= {};
    next.corpses ||= [];
    next.regionLocks = normalizeRegionLocks(next.regionLocks);
    next.scientist = normalizeScientist(next.scientist);
    next.runEnded = Boolean(next.runEnded) || next.scientist.vitals.health.current <= 0;
    if (next.runEnded) {
      next.paused = true;
    }
    next.roomObservations = normalizeRoomObservations(next.roomObservations);
    next.rooms = normalizeRooms(next.rooms);
    next.doors = normalizeDoors(next.doors, next.rooms);
    for (const room of next.rooms) {
      if (room.observation) {
        next.roomObservations[room.id] = normalizeRoomObservation(room.observation);
      } else if (next.roomObservations[room.id]) {
        room.observation = normalizeRoomObservation(next.roomObservations[room.id]);
      }
    }
    next.containers = normalizeContainers(next.containers);
    for (const container of next.containers) {
      container.roomId = next.rooms.some((room) => room.id === container.roomId) ? container.roomId : MAIN_ROOM_ID;
    }
    next.resources = normalizeResources(next.resources);
    next.inventory = normalizeInventory(next.inventory);
    next.inventoryHistory = normalizeInventoryHistory(next.inventoryHistory);
    next.feedstockIncomeProgress = normalizeFeedstockIncomeProgress(next.feedstockIncomeProgress);
    next.wasteTags = normalizeWasteTags(next.wasteTags);
    next.containmentIncidentProgress = normalizeContainmentIncidentProgress(next.containmentIncidentProgress);
    next.policies = normalizePolicies(next.policies);
    next.queueDrawerOpen = next.queueDrawerOpen !== false;
    next.timeSpeed = timeSpeedById(next.timeSpeed).id;
    next.knownResultKeys ||= {};
    next.resultRepeats ||= {};
    next.events ||= [];
    next.tasks ||= [];
    next.slimes ||= [];
    next.suspicion = clamp(Math.round(Number(next.suspicion) || 0), 0, SUSPICION_MAX);
    const currentSuspicionBand = suspicionBandForValue(next.suspicion);
    const peakIndex = Math.max(suspicionBandIndex(next.suspicionPeakBand), suspicionBandIndex(currentSuspicionBand.id));
    next.suspicionPeakBand = SUSPICION_BANDS[peakIndex].id;
    if (next.suspicion > 0) {
      next.lastSuspicionGainAt = Math.min(finiteTime(next.lastSuspicionGainAt, next.clock), next.clock);
      next.lastSuspicionDecayAt = Math.min(finiteTime(next.lastSuspicionDecayAt, next.lastSuspicionGainAt), next.clock);
    } else {
      next.lastSuspicionGainAt = null;
      next.lastSuspicionDecayAt = null;
    }
    next.nextCorpseNumber = Math.max(
      Number(next.nextCorpseNumber) || 1,
      next.corpses.reduce((max, corpse) => Math.max(max, numericSuffix(corpse.id)), 0) + 1
    );
    next.currentGenome = normalizeGenomeLength(next.currentGenome || "", next.seed, "current") || randomGenome(seedRng(`${next.seed}:starter`));
    geneMap = buildGeneMap(next.seed, next.complexity);
    for (const task of next.tasks) {
      if (task?.data?.genome) {
        task.data.genome = normalizeGenomeLength(task.data.genome, next.seed, `task:${task.id}`);
      }
    }
    normalizeElementDiscoveries(next);
    const validContainerIds = new Set(next.containers.map((container) => container.id));
    const basicContainerIds = next.containers.filter((container) => container.type === "basic").map((container) => container.id);
    const existingBasicAssignments = new Set(
      next.slimes
        .filter((slime) => slime.status !== "dead" && slime.status !== "released" && basicContainerIds.includes(slime.containerId))
        .map((slime) => slime.containerId)
    );
    for (const slime of next.slimes) {
      const previousGenome = slime.genome;
      slime.genome = normalizeGenomeLength(slime.genome || "", next.seed, `slime:${slime.id}`) || randomGenome(seedRng(`${next.seed}:slime:${slime.id}`));
      if (previousGenome && previousGenome !== slime.genome && next.genomeNotes?.[previousGenome] && !next.genomeNotes[slime.genome]) {
        next.genomeNotes[slime.genome] = next.genomeNotes[previousGenome];
      }
      slime.revealed ||= {};
      slime.measured ||= {};
      slime.traitObservations ||= {};
      slime.testsRun ||= [];
      slime.roomId = next.rooms.some((room) => room.id === slime.roomId) ? slime.roomId : MAIN_ROOM_ID;
      if (slime.status === "dead") {
        slime.containerId = null;
      } else if (slime.status === "released") {
        slime.containerId = null;
      } else {
        slime.status = "contained";
        if (!validContainerIds.has(slime.containerId)) {
          const openContainerId = basicContainerIds.find((id) => !existingBasicAssignments.has(id));
          slime.containerId = openContainerId || basicContainerIds[0] || SYNTHESIS_TUBE_ID;
        }
        if (basicContainerIds.includes(slime.containerId)) {
          existingBasicAssignments.add(slime.containerId);
        }
        const container = next.containers.find((candidate) => candidate.id === slime.containerId);
        if (container) {
          slime.roomId = container.roomId;
        }
      }
      slime.automationExcluded = Boolean(slime.automationExcluded);
      slime.stats = normalizeSlimeStats(slime.stats);
      normalizeSlimeLifecycle(slime);
      normalizeSlimeJob(slime);
    }
    return next;
  }

  function normalizeSlimeLifecycle(slime) {
    const evaluated = evaluateGenome(slime.genome);
    const targetDeathAt = (Number(slime.createdAt) || 0) + slimeLifespanMinutes(evaluated);
    if ((Number(slime.lifecycleVersion) || 0) < 1) {
      slime.deathAt = Math.max(Number(slime.deathAt) || 0, targetDeathAt);
      slime.lifecycleVersion = 1;
    }
    slime.splitBlocked = Boolean(slime.splitBlocked);
  }

  function prepareCorpseState() {
    state.corpses ||= [];
    normalizeCorpseRecords();
    migrateDeadSlimesToCorpses();
    state.nextCorpseNumber = Math.max(
      Number(state.nextCorpseNumber) || 1,
      state.corpses.reduce((max, corpse) => Math.max(max, numericSuffix(corpse.id)), 0) + 1
    );
  }


  function normalizeCorpseRecords() {
    let drumCount = 0;
    for (const corpse of state.corpses) {
      corpse.genome = normalizeGenomeLength(corpse.genome || "", state.seed, `corpse:${corpse.id}`) || randomGenome(seedRng(`${state.seed}:corpse:${corpse.id}`));
      corpse.revealed ||= {};
      corpse.measured ||= {};
      corpse.traitObservations ||= {};
      corpse.testsRun ||= [];
      corpse.diedAt = Number.isFinite(Number(corpse.diedAt)) ? Number(corpse.diedAt) : state.clock;
      corpse.ruined = Boolean(corpse.ruined);
      corpse.consumedProgress = clamp(Number(corpse.consumedProgress) || 0, 0, 100);
      corpse.storage = corpse.storage || (drumCount < WASTE_DRUM_CAPACITY ? "drum" : "overflow");
      normalizeCorpseLocation(corpse);
      if (corpse.storage === "drum") {
        drumCount += 1;
      }
      if (!Number.isFinite(Number(corpse.freshUntil)) || !Number.isFinite(Number(corpse.spoiledAt))) {
        applyCorpseDecayWindows(corpse);
      }
      corpse.lastFreshness ||= corpseFreshness(corpse);
      if (corpse.storage === "overflow" && !corpse.nextOverflowEventAt) {
        corpse.nextOverflowEventAt = state.clock + OVERFLOW_EVENT_INTERVAL;
      }
    }
  }


  function migrateDeadSlimesToCorpses() {
    const survivors = [];
    let moved = 0;
    for (const slime of state.slimes || []) {
      if (slime.status === "dead") {
        createCorpseFromSlime(slime, "lifespan");
        moved += 1;
      } else {
        survivors.push(slime);
      }
    }
    if (moved) {
      state.slimes = survivors;
      if (!findSlime(state.selectedSlimeId)) {
        state.selectedSlimeId = state.slimes[0]?.id || null;
      }
    }
  }

  function normalizeElementDiscoveries(next) {
    const entries = Object.values(next.discoveries?.element || {});
    if (!entries.length) {
      return;
    }
    const map = buildGeneMap(next.seed, next.complexity);
    for (const entry of entries) {
      const outcome = elementOutcomeForDiscovery(map, entry);
      if (entry.measurement && outcome) {
        entry.measurement = preciseReading("element", outcome);
      }
      if (entry.estimate) {
        entry.estimate = normalizeThaumUnit(entry.estimate);
      }
    }
  }

  function elementOutcomeForDiscovery(map, entry) {
    const explicitCode = entry.codes?.find((code) => code.region === "element")?.code;
    if (explicitCode && map.traitMaps.element[explicitCode]) {
      return map.traitMaps.element[explicitCode];
    }
    const genome = cleanGenome(entry.sample || "");
    const genomeCode = genome ? getRegionCode(genome, "element") : "";
    return genomeCode ? map.traitMaps.element[genomeCode] || null : null;
  }

  function normalizeThaumUnit(reading) {
    return String(reading)
      .replace(/\babout 0 thaum flux\b/g, "0 thaums")
      .replace(/\bthaum flux\b/g, "thaums")
      .replace(/\bflux\b/g, "thaums");
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

  function defaultScientistPhysicalState() {
    return {
      tracks: {
        exposure: {
          current: 0,
          max: PHYSICAL_STATE_MAX,
          sourceType: "contamination exposure",
          likelySource: "no clear source"
        }
      },
      latestTest: null,
      lastExposureEventAt: -999999,
      lastSymptomEventAt: -999999
    };
  }

  function normalizeScientistPhysicalState(candidate) {
    const fallback = defaultScientistPhysicalState();
    const exposureCandidate = candidate?.tracks?.exposure || candidate?.exposure || {};
    const rawCurrent = Number(exposureCandidate.current);
    const rawMax = Number(exposureCandidate.max);
    const max = Math.max(1, Number.isFinite(rawMax) ? rawMax : PHYSICAL_STATE_MAX);
    const latestTest = candidate?.latestTest && typeof candidate.latestTest === "object"
      ? { ...candidate.latestTest }
      : null;
    return {
      tracks: {
        exposure: {
          current: clamp(Number.isFinite(rawCurrent) ? rawCurrent : 0, 0, max),
          max,
          sourceType: String(exposureCandidate.sourceType || fallback.tracks.exposure.sourceType),
          likelySource: String(exposureCandidate.likelySource || fallback.tracks.exposure.likelySource)
        }
      },
      latestTest,
      lastExposureEventAt: Number.isFinite(Number(candidate?.lastExposureEventAt)) ? Number(candidate.lastExposureEventAt) : -999999,
      lastSymptomEventAt: Number.isFinite(Number(candidate?.lastSymptomEventAt)) ? Number(candidate.lastSymptomEventAt) : -999999
    };
  }

  function normalizeScientistPhysicalPresence(candidate) {
    const fallback = SCIENTIST_DEFAULT_PHYSICAL_PRESENCE;
    const heightM = Number(candidate?.heightM);
    const shoulderWidthM = Number(candidate?.shoulderWidthM);
    const floorLoadM2 = Number(candidate?.floorLoadM2);
    return {
      heightM: clamp(Number.isFinite(heightM) ? heightM : fallback.heightM, 0.5, 3),
      shoulderWidthM: clamp(Number.isFinite(shoulderWidthM) ? shoulderWidthM : fallback.shoulderWidthM, 0.2, 2),
      floorLoadM2: clamp(Number.isFinite(floorLoadM2) ? floorLoadM2 : fallback.floorLoadM2, 0.25, 4)
    };
  }

  function scientistFloorLoadM2() {
    state.scientist = normalizeScientist(state.scientist);
    return Math.max(0, Number(state.scientist.physicalPresence?.floorLoadM2) || SCIENTIST_DEFAULT_PHYSICAL_PRESENCE.floorLoadM2);
  }

  function normalizeScientist(candidate) {
    const fallback = defaultScientist();
    const scientist = {
      roomId: state?.rooms?.some?.((room) => room.id === candidate?.roomId) ? candidate.roomId : (candidate?.roomId || fallback.roomId || MAIN_ROOM_ID),
      physicalPresence: normalizeScientistPhysicalPresence(candidate?.physicalPresence),
      physicalState: normalizeScientistPhysicalState(candidate?.physicalState),
      vitals: { ...fallback.vitals, ...(candidate?.vitals || {}) },
      skills: { ...fallback.skills, ...(candidate?.skills || {}) }
    };
    if (!state?.rooms?.some?.((room) => room.id === scientist.roomId)) {
      scientist.roomId = MAIN_ROOM_ID;
    }
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
        prepareCorpseState();
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
