// Developer-reference life histories. No game/browser imports this module.
// Authored numbers are initial tuning unless an implemented source is named.
const EcologyDesign = require('./creature-ecology-design');
const H = require('../homunculi');
const DAY = 86400;
const INITIAL = 'Initial lifecycle balance values; not implemented population behavior';
const MIXED = 'Implemented care values plus initial lifecycle tuning; see notes';

function base(id, values) {
  return {
    id, status: INITIAL, basis: 'One healthy ordinary adult; not a pack/colony',
    diet: 'Compatible actual food', adultKg: 1, newbornKg: 0.05,
    foodKgDay: 0, waterLDay: 0, mineralsKgDay: 0, fuelUnitsDay: 0, manaDay: 0,
    otherDay: 0, otherUnit: 'N/A', juvenileMultiplier: 1.5,
    independentDays: 30, adultDays: 365, fertileDays: 365,
    method: 'live birth', breeder: 'One eligible adult mother with actual mate access',
    attempts365: 1, success: 0.7, offspring: 1, incubationDays: 90, cooldownDays: 180,
    season: 'Species-appropriate local favorable season; not a global calendar month',
    assimilation: 0.35, reproductiveMana: 0, massSource: 'Additional compatible parental food/material investment',
    juvenileMortality: 0.2, adultMortality: 0.03, ageingDays: 3650, doublingDays: 730,
    foodReserveDays: 7, waterReserveDays: 2, manaCapacity: 0,
    travelMultiplier: 1.5, travelKmDay: 10, territoryHa: 10,
    minC: 0, maxC: 35, shelter: 'Actual suitable habitat and refuge',
    prey: 'N/A', huntsDay: 0, huntSuccess: 0, mealKg: 0,
    labDays: null, notes: '', source: 'scripts/creature-lifecycle-data.js (initial tuning)', ...values
  };
}
// Compact terrestrial/marine life-history authoring. Every number is exported.
// mass: adult/newborn kg; intake: food kg/day, direct drinking L/day, minerals kg/day;
// ages: independence/adult/fertile days; birth: attempts per 365 days, success,
// offspring, incubation days, cooldown days; death: juvenile/adult hazards per
// 1000 individual-days, ageing onset days, hazard-doubling days.
function animal(id, mass, intake, ages, birth, death, movement, values = {}) {
  return base(`beast:${id}`, {
    adultKg: mass[0], newbornKg: mass[1], foodKgDay: intake[0], waterLDay: intake[1], mineralsKgDay: intake[2],
    independentDays: ages[0], adultDays: ages[1], fertileDays: ages[2],
    attempts365: birth[0], success: birth[1], offspring: birth[2], incubationDays: birth[3], cooldownDays: birth[4],
    juvenileMortality: death[0], adultMortality: death[1], ageingDays: death[2], doublingDays: death[3],
    travelKmDay: movement[0], territoryHa: movement[1], ...values
  });
}
const profiles = [
  base('human', { adultKg: 70, newbornKg: 3.5, foodKgDay: 1.5, waterLDay: 3,
    independentDays: 6570, adultDays: 6570, fertileDays: 6570,
    attempts365: 0.5, success: 0.75, offspring: 1, incubationDays: 280, cooldownDays: 365,
    juvenileMortality: 0.02, adultMortality: 0.01, ageingDays: 18250, doublingDays: 3650,
    foodReserveDays: 14, waterReserveDays: 2, travelKmDay: 20, territoryHa: 0.2, minC: 10, maxC: 32,
    shelter: 'Actual shelter, clothing, sanitation and supported food supply; exposed travel differs',
    notes: 'Human food/water masses and demographics are initial reference tuning, not overrides of existing hunger meters, exceptional individuals, consent, body skills or city ledgers. Independence is ordinary self-sufficiency, not a legal status or automatic employment.',
    source: 'reference/DESIGN_BIBLE.md; app.js (existing needs); initial demographic tuning' }),
  base('slime', { status: MIXED, adultKg: 1, newbornKg: 0.5, foodKgDay: 0.02, waterLDay: 0,
    independentDays: 0, adultDays: 12 / 1440, fertileDays: 12 / 1440,
    method: 'Natural division; existing genome-dependent conserved parent partition', breeder: 'One mature full-mass parent meeting actual division-readiness conditions',
    attempts365: 365 * 1440 / 558, success: 1, offspring: 1, incubationDays: 0, cooldownDays: 558 / 1440,
    juvenileMortality: 0, adultMortality: 0, ageingDays: null, doublingDays: null,
    massSource: 'Partition existing parent mass; no additional birth mass or copied soul',
    foodReserveDays: 3, waterReserveDays: null, travelKmDay: 1, territoryHa: 0.01, minC: 5, maxC: 35,
    labDays: 8 / 1440, shelter: 'Genome-compatible actual substrate/habitat; no communication or cooperation',
    notes: '1 kg is a reference normalization, not universal slime mass. Proposed kg/day does not replace genome-dependent nutrition/feeding units. Existing reference: growth 12 minutes (natural jitter 0.75–1.25), brood 1, stability risk 5 gives 558-minute division pressure, plus regrowth/readiness delay. Actual genomes override all reference clocks; existing genomic life budget (120–7200 minutes) remains explicit and is NOT replaced by a second mortality hazard. Eight-minute lab synthesis is a skill-adjusted base, not gestation.',
    source: 'app.js: growth/brood/lifespan pools, divisionPressureMinutes, tryNaturalSplit; initial kg/day reference' }),
  base('mudlet', { status: MIXED, adultKg: 2, newbornKg: 2, diet: 'Moist clay/mineral pattern; no biological food', waterLDay: 1.8,
    juvenileMultiplier: 1, independentDays: 0, adultDays: 0, fertileDays: null,
    method: 'Environmental formation, not parental reproduction', breeder: 'One actual stable water/earth-pattern site with finite clay and water',
    attempts365: 4, success: 0.25, offspring: 1, incubationDays: 2, cooldownDays: 30,
    juvenileMortality: 0.01, adultMortality: 0.01, ageingDays: null, doublingDays: null,
    massSource: 'Actual deposited clay and retained water; not new matter', foodReserveDays: null, waterReserveDays: 2 / 1.8,
    travelKmDay: 0.2, territoryHa: 0.001, minC: 1, maxC: 45, labDays: 600 / DAY,
    notes: 'Implemented body: 2 kg clay plus initial 2 L retained water, kept separate from structural mass. Nominal evaporation at 20 C / 50% humidity is 0.075 L/hour = 1.8 L/day; actual humidity/heat change it. No invented food need; reserve days are a reference depletion budget, not guaranteed survival. Natural site recruitment is new tuning, not a population-per-parent multiplier.',
    source: 'creature-formation.js: Mudlet body and evaporation; initial natural formation/demographic tuning' }),
  base('homunculus', { status: MIXED, adultKg: 48, newbornKg: 48, foodKgDay: 1.2, waterLDay: 2.5,
    independentDays: 30, adultDays: 3, fertileDays: null, method: 'Existing advanced artificial growth only; natural fertility unestablished',
    breeder: 'N/A — not a natural breeding unit; artificial procedure uses original apparatus/inputs',
    attempts365: 0, success: 0, offspring: 0, incubationDays: 0, cooldownDays: 0,
    juvenileMortality: 0.02, adultMortality: 0.01, ageingDays: 18250, doublingDays: 3650,
    foodReserveDays: 1, waterReserveDays: 1, travelKmDay: 15, territoryHa: 0.2, minC: 15, maxC: 32,
    labDays: H.MODES.body.seconds / DAY,
    notes: 'Implemented: 72-hour growth, 48 kg embodiment, maturity flag at completion, 24 food-hours and 24 water-hours per care. Proposed kg/L demands are reference conversions, not implemented physical ration amounts. Thirty-day independent-care learning is initial tuning and never grants speech, consent or skills by timer. Fertility is unestablished: zero modeled natural recruitment is not a claim of biological sterility. Growth inputs/utilities remain in Production detail, not adult upkeep.',
    source: 'homunculi.js: MODES, embody, advance; app.js: nourishment; initial kg/day conversion and learning/ageing tuning' }),
  base('cinderling', { status: MIXED, adultKg: 1, newbornKg: 1, diet: 'Actual carbonaceous fuel; fuel units are not assumed kg', fuelUnitsDay: 24,
    juvenileMultiplier: 1, independentDays: 0, adultDays: 0, fertileDays: null,
    method: 'Environmental formation, not parental reproduction', breeder: 'One actual stable flame-pattern site with finite burning carbonaceous matter',
    attempts365: 6, success: 0.2, offspring: 1, incubationDays: 1, cooldownDays: 14,
    juvenileMortality: 0.02, adultMortality: 0.02, ageingDays: null, doublingDays: null,
    massSource: 'Actual carbonaceous core/fuel; no energy-to-matter grant', foodReserveDays: 4 / 24, waterReserveDays: null,
    travelKmDay: 0.3, territoryHa: 0.001, minC: 60, maxC: 360, labDays: 600 / DAY,
    notes: 'Implemented bright burn 1 fuel unit/hour = 24/day, smolder 0.25/hour = 6/day; capacity 4, initially 2. No hydration need: quenching harms. Structural kg is proposed because fuel units have no authored kg conversion. Listed temperatures refer to core, not ambient temperature. No extra natural death hazard is charged for already explicit starvation/cold damage.',
    source: 'creature-formation.js: advanceCinderling, feed, formation; initial structural mass/site recruitment tuning' }),
  base('zephyrMote', { status: MIXED, adultKg: 0.12, newbornKg: 0.12, diet: 'Finite coherent air parcel and mana', manaDay: 24,
    juvenileMultiplier: 1, independentDays: 0, adultDays: 0, fertileDays: null,
    method: 'Environmental formation, not parental reproduction', breeder: 'One actual stable air-pattern site with a finite captured air parcel',
    attempts365: 12, success: 0.2, offspring: 1, incubationDays: 0.5, cooldownDays: 7,
    juvenileMortality: 0.02, adultMortality: 0.02, ageingDays: null, doublingDays: null,
    massSource: 'Actual captured 0.1 cubic metre air parcel; not matter created from mana', foodReserveDays: null, waterReserveDays: null,
    manaCapacity: 16, travelKmDay: 0.5, territoryHa: 0.001, minC: -20, maxC: 50, labDays: 600 / DAY,
    notes: 'Implemented sealed 1 mana/hour = 24/day, gentle 2/hour = 48/day, strong 4/hour = 96/day; capacity 16, initially 2. The 0.12 kg air mass is a proposed reference conversion for the existing 0.1 cubic metre parcel, not a tracked runtime mass. Does not eat biomass, drink or neutralize contaminants. Listed reserve is mana, not food.',
    source: 'creature-formation.js: advanceZephyr, rechargeMote, takeAir; initial density/site/temperature tuning' }),
  base('rootling', { status: MIXED, basis: 'One mature rooted plant; dry structural mass excludes substrate/stores', adultKg: 1.25, newbornKg: 0.02,
    diet: 'Contacting organic medium, minerals, water and real light', foodKgDay: 0.48, waterLDay: 1.2, mineralsKgDay: 0.024,
    independentDays: 14, adultDays: 90, fertileDays: 180, method: 'Natural sourced propagation; no spontaneous new plant',
    breeder: 'One mature propagule-producing plant with suitable receiving substrate', attempts365: 4, success: 0.5, offspring: 2,
    incubationDays: 14, cooldownDays: 60, juvenileMortality: 0.5, adultMortality: 0.03, ageingDays: 1825, doublingDays: 365,
    foodReserveDays: 0.35 / 0.24, waterReserveDays: 2 / 1.2, travelMultiplier: 1, travelKmDay: 0, territoryHa: 0.0001,
    minC: 8, maxC: 40, labDays: 21600 / DAY, shelter: 'Rooted moist substrate, light at least 20, no waterlogging; stationary body',
    notes: 'Implemented nominal at 20 C/full light: organic uptake 0.02 kg/hour, minerals 0.001/hour, water 0.05 L/hour; respiration 0.01 kg/hour lit or 0.03 dark. Initial live structure 0.75 kg stem + 0.15 roots; roots cap 0.5 kg and extend at up to 0.02 kg/hour, so formed-body remaining root growth can be 17.5 hours, not a 90-day artificial delay. Natural seedling clocks and fertility are new tuning; medium and waste remain conserved.',
    source: 'rootlings.js: body, step; creature-formation.js: required; initial natural life history' }),
  base('sporecap', { status: MIXED, basis: 'One cap plus its bounded mat; dry structure excludes food/substrate', adultKg: 0.5, newbornKg: 0.001,
    diet: 'Contacting moist plant detritus', foodKgDay: 1.2, waterLDay: 0.48,
    independentDays: 7, adultDays: 30, fertileDays: 45, method: 'Natural spores establishing a new bounded mat',
    breeder: 'One mature fruiting body with actual spores and suitable unoccupied substrate',
    attempts365: 12, success: 0.1, offspring: 4, incubationDays: 7, cooldownDays: 14,
    juvenileMortality: 2, adultMortality: 0.1, ageingDays: 365, doublingDays: 180,
    foodReserveDays: 0.5 / 0.36, waterReserveDays: 1 / 0.48, travelMultiplier: 1, travelKmDay: 0, territoryHa: 0.0001,
    minC: 8, maxC: 35, labDays: 14400 / DAY, shelter: 'Moist contacting detritus, no waterlogging; stationary cap/mat',
    notes: 'Implemented digestion ceiling 0.05 kg/hour = 1.2/day, evaporation 0.02 L/hour = 0.48/day at 20 C/humidity >=35. Material yield 25% reserve, 25% spent substrate, 50% respiratory loss; respiration 0.01 kg/hour and open spore production up to 0.005/hour spend reserves. Listed reserve assumes open spores; cover/gill state changes expenditure. New recruitment tuning counts established caps/mats, not every emitted spore; current runtime spores do not automatically spawn offspring.',
    source: 'sporecaps.js: body, step; creature-formation.js: required; initial natural recruitment tuning' }),
  base('hauntbound', { status: MIXED, basis: 'One existing deceased soul in the current cloth doll', adultKg: 0.5, newbornKg: null,
    diet: 'No food, water or biological metabolism', juvenileMultiplier: 1,
    independentDays: 0, adultDays: 0, fertileDays: null, method: 'Nonreproductive; existing attachment, not artificial production',
    breeder: 'N/A — no offspring or creation recipe', attempts365: 0, success: 0, offspring: 0, incubationDays: 0, cooldownDays: 0,
    assimilation: 0, juvenileMortality: 0, adultMortality: 0, ageingDays: null, doublingDays: null,
    foodReserveDays: null, waterReserveDays: null, travelMultiplier: 1, travelKmDay: 1, territoryHa: 0.001,
    minC: null, maxC: null, shelter: 'Intact actual object and surviving soul; repair/exertion limits and willingness remain',
    massSource: 'N/A — no birth; object and original soul already exist',
    notes: 'Implemented: 0.5 kg doll, no meals/water/sleep, 20 N soul force and finite exertion/recovery. No biological ageing hazard or fertility. Zero baseline mortality does not prevent object destruction or soul injury/death; voluntary reincarnation is departure, not a birth/death timer. Travel is proposed mechanical capacity, never automatic work consent. No universal temperature death threshold for all inhabited objects.',
    source: 'hauntbound.js: DEFINITION, create; HAUNTBOUND.md; initial travel capacity only' }),
  base('quartzShardling', { status: MIXED, adultKg: 2, newbornKg: 0.1, diet: 'Compatible minerals; only quartz grows/repairs this subtype', mineralsKgDay: 0.24,
    independentDays: 1, adultDays: 365, fertileDays: null, method: 'Natural mineral-lattice deposition, not parental breeding',
    breeder: 'One actual quartz-bearing deposition site with suitable earth-pattern conditions',
    attempts365: 1, success: 0.3, offspring: 1, incubationDays: 90, cooldownDays: 180,
    assimilation: 0.25, juvenileMortality: 0.01, adultMortality: 0.005, ageingDays: null, doublingDays: null,
    massSource: 'Actual deposited quartz/mineral substrate', foodReserveDays: 2, waterReserveDays: null,
    travelMultiplier: 1, travelKmDay: 0.288, territoryHa: 0.01, minC: -50, maxC: 180, labDays: 3600 / DAY,
    notes: 'Implemented 10 g/hour bite ceiling = 0.24 kg/day, only 25% of consumed quartz assimilates, max body 2 kg, formed body 1 kg. Actual reserve initially 48 hours/cap 72; ingestion refills at 400 reserve-hours per kg, so maintenance can be 0.06 kg/day rather than always eating the ceiling. Fed formed-body gain of 1 kg can take 16.67 days; natural 365-day juvenile history is new tuning, not a replacement. Travel uses a proposed 1 m reference tile and five minutes/tile at uninterrupted slow movement; digging/obstacles reduce it.',
    source: 'shardlings.js: MATERIALS, body, eat, step; creature-formation.js: required; initial natural deposition history' }),
  base('duskcat', { status: MIXED, adultKg: 2.5, newbornKg: 0.1, diet: 'Actual compatible meat/feline ration', foodKgDay: 0.288, waterLDay: 0.6,
    independentDays: 60, adultDays: 180, fertileDays: 240, attempts365: 2, success: 0.7, offspring: 3, incubationDays: 65, cooldownDays: 90,
    juvenileMortality: 0.5, adultMortality: 0.08, ageingDays: 2920, doublingDays: 730,
    foodReserveDays: 0.6 / 0.288, waterReserveDays: 1 / 0.6, manaCapacity: 16,
    travelKmDay: 8, territoryHa: 25, minC: 5, maxC: 38, prey: 'Actually perceived small living prey; no new prey species registry', huntsDay: 4, huntSuccess: 0.4, mealKg: 0.2,
    labDays: 28800 / DAY, shelter: 'Shaded cover and ordinary paths; bright light breaks blending but does not burn flesh',
    notes: 'Implemented 12 g food and 25 mL water/hour, initial 2 kg body, growth capped at +0.5 kg with 25% of eaten food; fed remaining growth can take 6.94 days, not 180 days after formation. Baseline mana idle cost is zero; concealment costs 1/hour while active and assisted pounce +1 per event. Capacity 16, formed reserve 2. Existing physical rest/training/needs persist; natural birth/fertility, hunting averages and ageing are new tuning.',
    source: 'duskcats.js: body, step, pendingPounce; creature-formation.js: required; initial natural life history' }),
  base('lanternWisp', { status: MIXED, adultKg: 0.1, newbornKg: 0.1, diet: 'Finite mana in a real mineral core', manaDay: 48,
    juvenileMultiplier: 1, independentDays: 0, adultDays: 0, fertileDays: null,
    method: 'Natural mineral-core formation; not a deceased spirit or parental breeding', breeder: 'One actual luminous-mineral deposition site with suitable light-aspected conditions',
    attempts365: 2, success: 0.2, offspring: 1, incubationDays: 30, cooldownDays: 90,
    juvenileMortality: 0.02, adultMortality: 0.01, ageingDays: null, doublingDays: null,
    massSource: 'Actual luminous mineral substrate; no matter from mana', foodReserveDays: null, waterReserveDays: null, manaCapacity: 16,
    travelMultiplier: 1, travelKmDay: 1, territoryHa: 0.01, minC: -20, maxC: 80, labDays: 600 / DAY,
    notes: 'Implemented bright 2 mana/hour = 48/day, voluntary low-reserve dim 0.5/hour = 12/day; capacity 16, initial reserve 2. A shutter hides light without saving fuel. No biological food/water/sleep or passive reproduction; natural recruitment is new source-limited tuning. Starvation/disruption and core damage remain explicit, not duplicated as background deaths.',
    source: 'lantern-wisps.js: body, step; creature-formation.js: required; initial natural deposition history' }),
  animal('ashhorn-behemoth', [400000, 2500], [2000, 12000, 2000], [365, 3650, 5475], [0.25, 0.7, 1, 540, 730], [0.08, 0.005, 36500, 7300], [12, 100000], { diet: 'Minerals and actual compatible forage', foodReserveDays: 30, waterReserveDays: 5, minC: -5, maxC: 45, notes: 'Huge mature mass/food demand is initial tuning, not a one-tile body. Recruitment is slow; calving grounds and actual maternal reserves constrain births.' }),
  animal('glasswing-roc', [30000, 200], [600, 120, 0], [180, 1095, 1825], [0.5, 0.65, 2, 120, 365], [0.2, 0.01, 21900, 3650], [180, 250000], { diet: 'Actual meat/prey', method: 'Egg clutch', prey: 'Exposed juvenile Ashhorn/Furnace and other actual suitable large prey; not free adult-behemoth kills', huntsDay: 1.2, huntSuccess: 0.65, mealKg: 900, foodReserveDays: 10, waterReserveDays: 3, shelter: 'Real eyrie, landing clearance and viable wind/flight conditions', minC: -15, maxC: 45 }),
  animal('mire-choir', [60, 0.05], [2, 2, 0], [30, 180, 365], [2, 0.6, 40, 20, 120], [5, 0.08, 3650, 730], [5, 100], { basis: 'One amphibious adult member; not the whole choir', diet: 'Wetland omnivory', method: 'Aquatic egg clutch', breeder: 'One eligible adult spawning member with actual mate/choir access', shelter: 'Actual wet spawning beds and air/water acoustic access', minC: 8, maxC: 35, foodReserveDays: 5, waterReserveDays: 1 }),
  animal('nullmaw-stalker', [500, 10], [12, 20, 0], [180, 730, 1095], [1, 0.6, 2, 120, 180], [0.3, 0.04, 7300, 1460], [15, 2000], { diet: 'Actual meat/prey', prey: 'Actual reachable land prey; existing null terrain does not grant new powers', huntsDay: 1, huntSuccess: 0.35, mealKg: 40, shelter: 'Real den, oxygen and diggable ground', minC: -5, maxC: 45 }),
  animal('thunderback-grazer', [2500, 80], [70, 160, 0], [180, 730, 1095], [1, 0.75, 1, 300, 365], [0.2, 0.02, 9125, 1825], [20, 2000], { diet: 'Actual forage', otherDay: 5, otherUnit: 'MJ atmospheric electrical charge; only while actually available', minC: -10, maxC: 40, notes: 'Charge use/feeding cannot refill without actual electrical supply. Herd members consume forage individually; panic fire losses are not duplicate ordinary mortality.' }),
  animal('candlecap-myriapod', [0.3, 0.0003], [0.015, 0.01, 0], [2, 45, 60], [4, 0.4, 80, 10, 60], [30, 1, 365, 90], [0.2, 0.05], { basis: 'One adult myriapod, not a warren', diet: 'Contacting detritus', method: 'Egg clutch', foodReserveDays: 10, waterReserveDays: 1, minC: 5, maxC: 35, shelter: 'Moist actual detritus/oxygen and burrow refuge' }),
  animal('ironroot-colossus', [300000, 1], [300, 6000, 1200], [90, 18250, 36500], [0.2, 0.4, 1, 365, 1095], [0.05, 0.002, 182500, 36500], [1, 50000], { diet: 'Actual organic substrates, minerals and water', manaDay: 40, method: 'Sourced propagule developing in suitable ground', breeder: 'One mature propagule-bearing individual and actual receiving site', foodReserveDays: 60, waterReserveDays: 14, manaCapacity: 800, minC: -15, maxC: 40, shelter: 'Actual deep root/mineral/water access; rooting competes with travel/defense', notes: 'All physical mass must be supplied by conserved substrates; magic and age cannot manufacture a colossal body. Earliest maturity requires enough accumulated growth.' }),
  animal('gloam-prowler', [250, 3], [8, 12, 0], [120, 540, 730], [1, 0.65, 3, 90, 180], [0.5, 0.05, 4380, 1095], [25, 1500], { basis: 'One adult hunting-pack member', diet: 'Actual meat/prey', prey: 'Actual locally perceived reachable prey', huntsDay: 1, huntSuccess: 0.4, mealKg: 25, manaCapacity: 48, minC: -15, maxC: 38, notes: 'Short-blink mana is paid per actual use, not a mandatory daily ambient drain or wall bypass.' }),
  animal('rimefang-pack', [120, 1.5], [4, 5, 0], [90, 365, 730], [1, 0.7, 4, 70, 180], [0.8, 0.06, 3650, 730], [25, 1000], { basis: 'One adult pack member', diet: 'Actual meat/prey', prey: 'Actual reachable cold-region prey', huntsDay: 0.8, huntSuccess: 0.4, mealKg: 15, manaCapacity: 32, minC: -40, maxC: 20, shelter: 'Cold refuge and actual shared kill custody; a shared carcass is not multiplied by pack size', notes: 'Existing local health/combat/identity stay unchanged. Cold expenditure is conditional actual use; freezing does not create drinking water.' }),
  animal('sunspine-basilisk', [400, 0.3], [5, 3, 0], [7, 730, 1095], [1, 0.6, 8, 90, 240], [2, 0.03, 10950, 2190], [8, 1200], { diet: 'Actual meat/prey', method: 'Egg clutch', prey: 'Actual reachable arid-land prey', huntsDay: 0.5, huntSuccess: 0.3, mealKg: 40, foodReserveDays: 30, waterReserveDays: 7, manaCapacity: 60, minC: 10, maxC: 50, shelter: 'Burrow refuge and radiant-fan clearance' }),
  animal('ley-manta', [2000, 10], [0.2, 0, 0.02], [90, 730, 1095], [0.5, 0.6, 1, 180, 365], [0.3, 0.02, 10950, 2190], [100, 100000], { diet: 'Actual mana currents; incidental physical organic/mineral substrates maintain body matter', manaDay: 60, manaCapacity: 1200, waterReserveDays: null, reproductiveMana: 500, minC: -10, maxC: 40, shelter: 'Actual ley-current access and a safe landing/refuge', notes: 'Mana feeding supplies energy, not matter. Offspring require actual parental/material mass investment; direct drinking is zero, not permission to create body water or ignore source moisture.' }),
  animal('carrion-lantern', [30, 0.2], [1.5, 0.3, 0], [14, 90, 120], [3, 0.5, 6, 20, 60], [3, 0.15, 1095, 365], [30, 500], { basis: 'One adult biological aerostat, not the flock', diet: 'Actual carrion', method: 'Egg clutch', foodReserveDays: 5, waterReserveDays: 2, minC: 0, maxC: 40, shelter: 'Real carrion access, intact bladder and tolerable wind', notes: 'Travel is a wind-dependent reference, never guaranteed directed flight. Corpse-light spends actual carrion-derived substrate; no ghosts, soul feeding or resurrection.' }),
  animal('brine-cathedral', [2000000, 100], [40000, 0, 200], [365, 3650, 7300], [0.1, 0.5, 1, 365, 1825], [0.1, 0.002, 182500, 36500], [5, 200000], { basis: 'One whole mature superorganism; never a polyp', diet: 'Actual filtered plankton/organic matter and dissolved minerals', method: 'Viable colonial fragment separation', breeder: 'One mature whole colony with a viable supported fragment and actual receiving habitat', massSource: 'Partition existing parent colony mass; no duplicated polyps or new birth matter', foodReserveDays: 30, waterReserveDays: null, minC: 8, maxC: 32, shelter: 'Actual compatible seawater flow, oxygen and feeding-tower capacity', notes: 'Zero freshwater drinking is not zero seawater dependence. Flowing/processed seawater is not consumed freshwater. Module/member damage reduces actual throughput; one polyp does not carry a whole colony reproductive rate.' }),
  animal('reef-wyrm', [50000, 30], [800, 0, 20], [90, 1825, 3650], [0.5, 0.6, 4, 120, 365], [1, 0.01, 36500, 7300], [30, 50000], { diet: 'Actual marine prey plus reef-growth minerals', method: 'Egg clutch', prey: 'Actual reachable marine prey or intruding feeding modules', huntsDay: 1, huntSuccess: 0.4, mealKg: 2500, waterReserveDays: null, foodReserveDays: 14, minC: 12, maxC: 32, shelter: 'Real living reef and marine oxygen/turning clearance' }),
  animal('abyssal-bell', [80000, 100], [600, 0, 0], [30, 3650, 5475], [0.25, 0.5, 10, 180, 730], [2, 0.008, 54750, 10950], [12, 100000], { diet: 'Actual deep-water prey', method: 'Deep-water egg clutch', prey: 'Actual reachable depth-compatible prey', huntsDay: 0.5, huntSuccess: 0.3, mealKg: 5000, waterReserveDays: null, foodReserveDays: 45, manaCapacity: 1000, minC: -2, maxC: 12, shelter: 'Actual compatible depth/pressure, seawater and oxygen' }),
  animal('frostwake-leviathan', [200000, 3000], [4000, 0, 0], [365, 5475, 7300], [0.2, 0.7, 1, 540, 1095], [0.1, 0.005, 36500, 7300], [60, 200000], { basis: 'One adult pod member', diet: 'Actual cold-water prey', prey: 'Actual reachable cold-water prey', huntsDay: 1, huntSuccess: 0.5, mealKg: 10000, foodReserveDays: 60, waterReserveDays: null, manaCapacity: 2000, minC: -2, maxC: 12, shelter: 'Actual polar marine habitat, breathing/oxygen access and nursery', notes: 'Ice wake/body mass consumes finite reserves. Zero direct freshwater drinking does not imply water-free biology or permanent ice creation.' }),
  animal('marsh-hydra', [1500, 2], [40, 20, 0], [14, 730, 1095], [1, 0.5, 6, 90, 240], [1, 0.02, 18250, 3650], [8, 1500], { basis: 'One whole adult body, not a head', diet: 'Actual wetland prey', method: 'Egg clutch', prey: 'Actual reachable wetland prey', huntsDay: 1, huntSuccess: 0.4, mealKg: 120, manaCapacity: 200, minC: 8, maxC: 38, shelter: 'Actual wetland water, nest and oxygen', notes: 'Regenerating a head is repair funded by extra food/mana, not reproduction, a new individual or a refund of consumed biomass.' }),
  animal('rivercoil', [40000, 50], [600, 0, 10], [60, 1460, 2190], [1, 0.6, 8, 90, 180], [1, 0.015, 18250, 3650], [15, 10000], { diet: 'Actual aquatic/land omnivory', method: 'Aquatic egg clutch', prey: 'Actually reachable aquatic prey when hunting', huntsDay: 0.5, huntSuccess: 0.4, mealKg: 1000, foodReserveDays: 14, waterReserveDays: null, minC: 5, maxC: 35, shelter: 'Actual river flow and spawning lake; water is a habitat prerequisite, not infinite stock' }),
  animal('ember-ant', [0.001, 0.000002], [0.0002, 0.0001, 0.00002], [30, 45, 180], [365, 0.8, 2000, 10, 1], [20, 3, 90, 30], [0.1, 10], { basis: 'One active adult worker for mass/intake/death; reproduction is per actual queen',
    diet: 'Actual organic food and supplied mound metal/minerals', method: 'Queen egg laying; worker reproduction rate is zero', breeder: 'One actual fertile queen in a viable supplied hive; never every worker',
    foodReserveDays: 2, waterReserveDays: 1, minC: 15, maxC: 55, territoryHa: 0.0001,
    breederKg: 0.05, breederMortality: 0.02, breederAgeingDays: 1825, breederDoublingDays: 730,
    shelter: 'Per-worker space allocation in a real shared furnace hive; one hive footprint is not multiplied per worker',
    notes: 'The 180-day reproductive clock applies only to queen development; ordinary workers never become fertile on that timer. Queen reference body 0.05 kg; queen background hazard 0.02/1000 days, ageing onset 1825 days, doubling 730 days (not worker mortality). Her extra egg investment is supplied by actual colony food. No queen, mate supply or brood appears from populationIndex or divine units.' }),
  animal('dreaming-tortoise', [100000, 20], [700, 1500, 0], [30, 7300, 14600], [0.1, 0.6, 3, 180, 1825], [0.2, 0.001, 182500, 36500], [3, 100000], { diet: 'Actual forage', method: 'Egg clutch', manaDay: 20, manaCapacity: 2000, foodReserveDays: 90, waterReserveDays: 30, minC: 0, maxC: 40, shelter: 'Real safe sleeping ground and reachable forage/moisture', notes: 'Sapience/consent remains independent. Weather/dream actions spend actual sleep/mana/available moisture; neither age nor nature role grants infinite restoration.' }),
  animal('mirror-ape', [90, 1], [2, 3, 0], [730, 1460, 1825], [0.5, 0.7, 1, 200, 365], [0.15, 0.025, 9125, 1825], [10, 250], { basis: 'One adult troop member', diet: 'Actual forest omnivory', foodReserveDays: 7, waterReserveDays: 2, manaCapacity: 48, minC: 10, maxC: 35, shelter: 'Actual canopy hold/ground refuge and reachable food', notes: 'Adult mass preserves the existing original 90 kg climbing body; the earlier 60 kg reference was corrected, not applied to resize existing individuals. Implemented original imitation reserve is 48 mana, Soul Lash 12 per paid release; zero mandatory daily casting cost. Capacity does not invent natural regeneration, copied skills, consent or species-wide knowledge.' }),
  animal('gravebloom-elk', [350, 12], [10, 20, 0], [120, 545, 730], [1, 0.75, 1, 230, 365], [0.3, 0.03, 4380, 1095], [20, 1000], { basis: 'One adult herd member', diet: 'Actual forage/blooms; carrion nutrients feed the associated bloom substrate', foodReserveDays: 10, waterReserveDays: 3, minC: -30, maxC: 28, shelter: 'Actual seasonal forage, carrion-supported bloom sites and refuge', notes: 'Do not turn the herbivore into a direct carrion eater. Bloom nutrient investment and seasonal habitat remain conserved; ecological points are not kg of edible flowers.' }),
  animal('storm-kite', [0.08, 0.002], [0.0005, 0, 0.0002], [7, 45, 90], [4, 0.6, 6, 10, 30], [5, 0.5, 730, 180], [60, 100], { basis: 'One adult small winged body, not a swarm', diet: 'Actual electrical energy plus trace physical body-maintenance substrates', otherDay: 0.2, otherUnit: 'MJ actually acquired electrical charge', method: 'Egg clutch', foodReserveDays: 3, waterReserveDays: null, minC: -10, maxC: 40, shelter: 'Actual charge-bearing weather and physical roost', notes: 'Charge energy is not new body matter; eggs/growth need conserved materials. Calm grounds and agitates the swarm. Travel is weather-limited; a random/instinctive destination may lack charge.' }),
  animal('burrowing-furnace', [6000, 5], [0, 20, 120], [30, 730, 1095], [0.5, 0.5, 2, 180, 365], [0.2, 0.02, 10950, 2190], [2, 3000], { diet: 'Actual compatible minerals/geological substrates', otherDay: 200, otherUnit: 'MJ geological/chemical thermal energy, only where actually available', method: 'Mineral-shelled eggs using actual parental mineral investment', massSource: 'Additional compatible mineral/water parental investment', foodReserveDays: 30, waterReserveDays: 5, minC: 20, maxC: 300, shelter: 'Real diggable geology, oxygen, thermal supply and ventilation', notes: 'Temperature interval is occupied tunnel/body-adjacent thermal niche, not universal surface weather. No generic biomass diet or conjured geological gas. Earliest juvenile growth needs actual assimilated mineral mass.' })
];

const names = new Map(EcologyDesign.rows.map(row => [row.id, row.name]));
for (const p of profiles) {
  p.name = names.get(p.id);
  if (!p.name) throw Error(`Unknown lifecycle creature ${p.id}`);
  p.notes ||= 'Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints.';
  p.birthMaterialKg = p.massSource.startsWith('Partition') || p.offspring === 0 ? 0 : p.newbornKg * p.offspring / p.assimilation;
  p.preyPreferences = p.prey;
  // These override worker/body hazards for actual queens, never fabricate a queen.
  const parental = p.fertileDays !== null && p.offspring > 0;
  p.breederKg ??= parental ? p.adultKg : null;
  p.breederMortality ??= parental ? p.adultMortality : null;
  p.breederAgeingDays ??= parental ? p.ageingDays : null;
  p.breederDoublingDays ??= parental ? p.doublingDays : null;
}
const byId = new Map(profiles.map(p => [p.id, p]));

// Reference math only: continuous hazards avoid multiplying a monthly percentage
// by arbitrary month length or charging explicit combat/starvation a second time.
function mortalityProbability(p, ageDays, elapsedDays) {
  if (!p || ![ageDays, elapsedDays].every(n => Number.isFinite(n) && n >= 0)) throw Error('Invalid mortality interval');
  const end = ageDays + elapsedDays;
  if (!Number.isFinite(end) || elapsedDays > 0 && end === ageDays) throw Error('Invalid mortality interval');
  let t = ageDays, hazard = 0;
  while (t < end) {
    let stop;
    if (t < p.adultDays) {
      stop = Math.min(end, p.adultDays); hazard += (stop - t) * p.juvenileMortality / 1000;
    } else if (p.ageingDays === null || t < p.ageingDays) {
      stop = Math.min(end, p.ageingDays ?? end); hazard += (stop - t) * p.adultMortality / 1000;
    } else {
      stop = end;
      const k = Math.LN2 / p.doublingDays;
      if (p.adultMortality > 0) hazard += p.adultMortality / 1000 * Math.exp(k * (t - p.ageingDays)) * Math.expm1(k * (stop - t)) / k;
    }
    if (!(stop > t)) throw Error('Invalid lifecycle age boundaries');
    t = stop;
  }
  return -Math.expm1(-hazard);
}

const fields = [
  ['name', 'Creature', 29], ['basis', 'Counting / body basis', 60], ['status', 'Value status', 55], ['diet', 'Compatible intake', 65],
  ['adultKg', 'Reference adult body (kg)', 27], ['newbornKg', 'Newborn / recruit body (kg)', 28],
  ['foodKgDay', 'Food / organic substrate (kg/day)', 29], ['waterLDay', 'Direct water demand (L/day)', 28],
  ['mineralsKgDay', 'Mineral intake ceiling (kg/day)', 28], ['fuelUnitsDay', 'Fuel demand (game units/day)', 28], ['manaDay', 'Routine mana demand (units/day)', 28],
  ['otherDay', 'Other energy / demand per day', 28], ['otherUnit', 'Other demand units / conditions', 75],
  ['juvenileMultiplier', 'Juvenile per-mass intake multiplier', 30],
  ['independentDays', 'Birth to independent care (days)', 30], ['adultDays', 'Birth to adult body (days)', 29], ['fertileDays', 'Birth to first reproductive eligibility (days)', 34],
  ['method', 'Recruitment / reproduction method', 70], ['breeder', 'Reproductive rate counting unit', 85],
  ['breederKg', 'Actual parental breeder reference mass (kg)', 35],
  ['breederMortality', 'Parental breeder background hazard / 1000 days', 37],
  ['breederAgeingDays', 'Parental breeder ageing begins (days)', 33],
  ['breederDoublingDays', 'Parental breeder hazard doubling (days)', 33],
  ['attempts365', 'Attempts per reproductive unit / 365 days', 32], ['success', 'Baseline establishment / reproductive success (0–1)', 38],
  ['offspring', 'Established offspring per successful event', 35], ['incubationDays', 'Gestation / incubation / establishment (days)', 35], ['cooldownDays', 'Minimum between attempt starts (days)', 32],
  ['season', 'Breeding / establishment season rule', 80], ['assimilation', 'Reproductive material assimilation (0–1)', 32],
  ['birthMaterialKg', 'Extra compatible birth investment (kg/event)', 35], ['massSource', 'Birth mass / resource source', 85], ['reproductiveMana', 'Extra reproduction mana (units/event)', 32],
  ['juvenileMortality', 'Background juvenile hazard / 1000 individual-days', 37], ['adultMortality', 'Background adult hazard / 1000 individual-days', 37],
  ['ageingDays', 'Ageing begins at age (days)', 28], ['doublingDays', 'Old-age hazard doubling interval (days)', 32],
  ['foodReserveDays', 'Reference food / energy reserve (days)', 32], ['waterReserveDays', 'Reference water reserve (days)', 30], ['manaCapacity', 'Stored mana capacity (units)', 29],
  ['travelMultiplier', 'Travelling intake multiplier', 27], ['travelKmDay', 'Sustainable travel ceiling (km/day)', 32], ['territoryHa', 'Reference habitat area (ha/individual)', 34],
  ['minC', 'Lower reference temperature (C)', 29], ['maxC', 'Upper reference temperature (C)', 29],
  ['shelter', 'Habitat / shelter constraints', 100], ['preyPreferences', 'Actual prey preferences', 90], ['huntsDay', 'Hunt attempts / active hunter-day', 30],
  ['huntSuccess', 'Reference hunt success (0–1)', 28], ['mealKg', 'Usable meal / successful hunt (kg)', 30],
  ['labDays', 'Current artificial formation base (days)', 34], ['notes', 'Implemented values / tuning / exceptions', 150], ['source', 'Source / authority', 100], ['id', 'Stable ID', 35]
];
const headers = fields.map(([, label]) => label);
const widths = fields.map(([, , width]) => width);
const rows = () => profiles.map(p => fields.map(([key]) => p[key] === null ? 'N/A' : p[key]));
const cell = x => String(x ?? 'N/A').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head, data) => [head, head.map(() => '---'), ...data].map(row => `| ${row.map(cell).join(' | ')} |`).join('\n');
function renderReference() {
  return '# Creature lifecycle and resource-use reference\n\n' +
    '> All 36 current entries. Numeric initial balance values with explicitly preserved implemented care values. Not an implemented regional population simulation.\n\n' +
    'Generated from `scripts/creature-lifecycle-data.js` by the existing creature-catalog builder. Open **Lifecycle & resource use** in the ODS/XLSX workbook for separate numeric columns. `N/A` means inapplicable/unestablished, not a missing zero. No new species, production recipe or queue entry is created.\n\n' +
    '## Units and monthly application\n\n' +
    '- Intake is per stated reference body per game day under stated nominal conditions. kg/L/MJ/mana/game fuel units are distinct; ecological points are not food mass. Zero direct water intake for marine bodies is not independence from seawater, oxygen or dietary water. Air, substrate, mineral and mana-fed bodies still require conserved physical body matter.\n' +
    '- Counts refer to actual individuals. Reproduction has its own explicit counting unit: an eligible parent, a viable queen/hive, a whole supported colonial fragment or a real finite formation site. Do not multiply queen recruitment by worker count, whole-superorganism reproduction by polyp count or Hydra reproduction by heads. No site means no site recruitment, regardless of adult headcount.\n' +
    '- Attempts are per **365 elapsed game days**, a standardized rate denominator, not a claim every game-calendar year has 365 days. Expected attempts over a month = eligible actual reproductive units × attempts365 × elapsed days / 365, limited by season, cooldown, mate access, health and paid materials. Actual decisions use only individual instincts/observations/memory/received information. Birth/establishment is scheduled after its own incubation/gestation, not immediately on attempt or at month end. Success is a tuning reference under eligible supported conditions, not a guaranteed fraction of immortal offspring.\n' +
    '- Earliest independence, body maturity and fertility are separate and do not guarantee knowledge, speech, willingness or self-care. Independence may follow body maturity for an artificially grown human-derived body. Food/resource-limited growth cannot meet a mass milestone merely because the calendar elapsed. Juvenile per-body intake starts from adult intake × (actual mass / reference adult mass)^0.75 × juvenile multiplier as initial tuning; actual metabolic and growth inputs remain capped by available compatible resources. Formation clocks are separate from natural birth clocks.\n' +
    '- Extra birth investment = newborn mass × offspring / reproductive assimilation, paid in actual compatible materials over the attempt. Division/fragmentation instead partitions existing parent mass and counts no duplicate added birth mass. Growing afterward still needs intake. Unassisted artificial bodies keep the existing creation-time soul rules; natural recruitment is not a soul retrofit, copied parent soul or free life recipe.\n' +
    '- Background mortality is a **continuous hazard per 1000 individual-days**, not a monthly kill percentage or life-expiration timer. For a constant hazard h over d days, probability = 1 − exp(−h × d / 1000). Juvenile/adult bands split at adultDays; old-age hazard doubles every stated interval after ageing onset. Median/expected lifespan follows the curve and actual hazards rather than a separate contradictory fixed expiry. Explicit combat, predation, starvation, drowning, disease already modeled, soul destruction and existing genomic life budgets are excluded from a second background death charge. No finite ageing onset is not invulnerability.\n' +
    '- Monthly expectations are aggregated into conserved integer age cohorts and scheduled actual events, not fractional bodies or always rounding small cohorts to zero. Use persistent seeded choices/fractional event budgets without rerolling saves; no births before actual gestation or applying an entire month of deaths immediately. Cohort splits and lazy interval evaluation preserve the same resources, members and age-band hazards.\n' +
    '- Reserve days describe stored usable resource at nominal demand, not a guaranteed time-to-death. Starvation/dehydration affect work, fertility, wounds and survival under actual care rules. Travel costs share the same reserves and travel ceilings are not safe-route or migration-knowledge grants. Stationary bodies do not migrate themselves. Habitat area is a reference space allocation, not food capacity, a global destination oracle or authority over a territory. Temperature columns are unprotected/reference niches; body/core exceptions are explicit.\n' +
    '- Predation attempts, success and usable meal size are conditional averages, capped by real perceived reachable prey, effort and existing combat. Derive actual food from actual killed/captured bodies, retaining remains. Do not guarantee hunter food or also charge the same prey a second biomass/death debit. Species can fail to meet maintenance even where average hunting yield appears sufficient.\n\n' +
    '## Consumption and body reference\n\n' + table(['Creature', 'Adult / newborn kg', 'Food kg/day', 'Direct water L/day', 'Minerals kg/day', 'Fuel units/day', 'Mana/day', 'Other demand/day'], profiles.map(p => [p.name, `${p.adultKg} / ${cell(p.newbornKg)}`, p.foodKgDay, p.waterLDay, p.mineralsKgDay, p.fuelUnitsDay, p.manaDay, `${p.otherDay} ${p.otherUnit}`])) + '\n\n' +
    '## Maturation and recruitment\n\n' + table(['Creature', 'Independent / adult / fertile days', 'Method / counting unit', 'Attempts / 365 days', 'Success', 'Offspring / success', 'Gestation / incubation days', 'Cooldown days', 'Birth investment kg/event'], profiles.map(p => [p.name, `${p.independentDays} / ${p.adultDays} / ${cell(p.fertileDays)}`, `${p.method}; ${p.breeder}`, p.attempts365, p.success, p.offspring, p.incubationDays, p.cooldownDays, p.birthMaterialKg])) + '\n\n' +
    '## Mortality, reserves and travel\n\n' + table(['Creature', 'Juvenile / adult hazard per 1000 days', 'Ageing onset / doubling days', 'Food / water reserve days', 'Travel km/day / intake multiplier', 'Reference area ha', 'Reference C range'], profiles.map(p => [p.name, `${p.juvenileMortality} / ${p.adultMortality}`, `${cell(p.ageingDays)} / ${cell(p.doublingDays)}`, `${cell(p.foodReserveDays)} / ${cell(p.waterReserveDays)}`, `${p.travelKmDay} / ${p.travelMultiplier}`, p.territoryHa, `${cell(p.minC)} / ${cell(p.maxC)}`])) + '\n\n' +
    '## Source preservation and exceptions\n\n' + table(['Creature', 'Value status', 'Artificial base formation days', 'Notes', 'Source'], profiles.map(p => [p.name, p.status, p.labDays, p.notes || 'Initial life-history tuning; no existing physical/agency/knowledge rules are replaced.', p.source])) + '\n\n' +
    '## Existing implementation ownership\n\n' +
    'C owns consumed needs/growth/reproductive behavior and calibration against actual original bodies/resources; D owns conserved cohorts, food production/edibility/renewal, timed recruitment/mortality/migration and saved monthly outcomes. Real regional edible stocks and replenishment are required separately; neither habitat hectares nor ecological points automatically feed animals. Remaining puberty/fertility, reference transport and source-site mechanics are not silently claimed implemented by publishing this table. The active queue does not grow or close C/D here.\n';
}
module.exports = { profiles, byId, fields, headers, widths, rows, mortalityProbability, renderReference, DAY };
