// Read-only export of authored definitions plus explicitly labelled design notes.
// This is a developer reference, not a new runtime registry or balancing change.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const Ecology = require('../strategic-beast-ecology');
const Environment = require('../climate-hydrology-biomes');
const Arcane = require('../strategic-arcane-geography');
const Formation = require('../creature-formation');
const Homunculi = require('../homunculi');
const Wilderness = require('../wilderness-beasts');
const resolveSource = file => file === 'DESIGN_BIBLE.md' && !fs.existsSync(path.join(root, file)) ? 'reference/DESIGN_BIBLE.md' : file;
const text = file => fs.readFileSync(path.join(root, resolveSource(file)), 'utf8');
const humanize = s => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
function source(file, marker) {
  const content = text(file), offset = content.indexOf(marker);
  if (offset < 0) throw Error(`Missing source marker: ${file}: ${marker}`);
  return `${resolveSource(file)}:${content.slice(0, offset).split('\n').length}`;
}
function bundle(costs) {
  const names = { biomass: 'biomass', drinkingWater: 'drinking water', clay: 'common clay',
    growthMedium: 'prepared growth medium', geneticMaterial: 'genetic material', humanTissueTemplate: 'examined human tissue template',
    arcaneFeedstock: 'arcane feedstock', assayReagent: 'assay reagent' };
  return Object.entries(costs).map(([key, n]) => `${n} ${names[key] || humanize(key).toLowerCase()}`).join(' + ');
}
const HEADERS = ['Creature', 'Group', 'Implementation / availability', 'Research tier', 'Production tier',
  'Material cost per creature', 'Biome / habitat', 'Rarity / prevalence', 'Threat / hazards',
  'Intelligence / communication', 'Movement', 'Diet / upkeep', 'Production / identity notes', 'Source', 'Stable ID'];
const UNKNOWN = 'Not defined';
function buildCatalog() {
  const app = text('app.js');
  const match = app.match(/const SYNTHESIS_BIOMASS_COST = (\d+);/);
  if (!match) throw Error('Slime synthesis cost no longer matches its source definition.');
  const slimeCost = Number(match[1]);
  const formationSource = source('creature-formation.js', 'const FAMILIES');
  const homunculusSource = source('homunculi.js', 'const MODES');
  const soulRule = 'Artificial formation: inherited animancy during formation for an own soul; unassisted bodies are soulless. No later own-soul retrofit.';
  const rows = [
    ['Human', 'Biological / human', 'Implemented: scientist and human NPCs', 'N/A — natural human', 'N/A — natural human',
      'N/A — no ordinary-human production recipe; see human-derived homunculus',
      'Fortified cities, dependent settlements and supported routes; no species-specific biome mask',
      'No authored species rarity rank; population varies by generated world', 'Varies by individual, skills, equipment and status',
      'Human language and independent agency; consent is not automatic', 'Walking; transport and exceptional abilities depend on the individual',
      'Food, water, rest, medicine and a survivable environment',
      'Includes scientist, guards, workers and other human roles. Roles are not species. Human-derived engineered bodies are a separate row.',
      source('DESIGN_BIBLE.md', 'The Scientist') + '; ' + source('app.js', 'function normalizeScientist'), 'human'],
    ['Slime', 'Biological / slime', 'Implemented: synthesis, genetics and natural division', Formation.FAMILIES.slime.researchTier,
      Formation.FAMILIES.slime.synthesisTier, `${slimeCost} biomass (tube synthesis; reproduction is a separate procedure)`,
      'Natural base form confirmed; precise natural biome and prevalence are not authored. Laboratory habitat is genome-dependent.',
      UNKNOWN, 'Genome-dependent containment, chemical, elemental and handling hazards',
      'Cannot communicate or cooperate under any modification; a soul does not change this', 'Genome-dependent; soulless bodies initiate no movement',
      'Genome-compatible feedstock and habitat; metabolism/byproducts vary by genome',
      `${soulRule} The existing 26-base genome generates variants, not separate catalog species.`,
      formationSource + '; ' + source('app.js', 'const SYNTHESIS_BIOMASS_COST'), 'slime'],
    ['Mudlet', 'Earth / water elemental', 'Implemented: research, chamber formation and physical care', Formation.FAMILIES.mudlet.researchTier,
      Formation.FAMILIES.mudlet.synthesisTier, bundle(Formation.COSTS.grow), Formation.FAMILIES.mudlet.habitat,
      'Not defined; authored natural habitat, no wild encounter/population integration',
      'Desiccation; pressure erosion; a moist body obstructs only a small low-pressure test leak',
      'No communication channel; souled bodies may seek directly sensed moisture; no automatic worker role',
      'Small local floor movements toward adjacent exposed moisture if souled; scientist can physically handle it',
      'Real water; temperature/humidity drive evaporation; surplus water remains physical runoff',
      `${soulRule} Fixed 2 kg clay / initially 2 L water body. Shared elemental chamber is reusable.`,
      formationSource + '; CREATURE_FORMATION.md', 'mudlet'],
    ['Human-derived homunculus', 'Human-derived engineered body', 'Implemented: advanced growth, care and non-slime learning',
      'Not defined — advanced', 'Not defined — advanced', bundle(Homunculi.MODES.body.inputs),
      'Naturally existing human base; laboratory-grown variant. Growth requires 15–32 °C and actual services; no dedicated natural biome mask.',
      'No authored rarity rank; advanced laboratory creation, not an early/common workforce',
      'Contaminated medium, missed care, failed services, starvation, injury and death',
      'Humanlike bodily capacity; souled individuals must learn communication; no initial memories, skill or loyalty',
      'Physical human-derived body; supported walking/handling and individually agreed work',
      'Growth utilities and scheduled care; food, water, rest and safe habitat after growth',
      `${soulRule} Requires tissue-culture and morphogenesis research, Medicine/Alchemy 101, an examined template and a suitable chamber. Numeric tiers are deliberately unassigned, not inferred from campaign stage.`,
      homunculusSource + '; ' + source('app.js', 'function homunculusContext'), 'homunculus']
  ];
  rows.push(['Cinderling', 'Fire elemental', 'Implemented: research, chamber formation, finite fuel and physical care',
    Formation.FAMILIES.cinderling.researchTier, Formation.FAMILIES.cinderling.synthesisTier,
    bundle(Formation.COSTS.growCinderling), Formation.FAMILIES.cinderling.habitat,
    'Not defined; authored natural habitat, no wild encounter/population integration',
    'Contact burns and exposed-stock ignition; quenching, cold, starvation and lost ventilation can kill',
    'No communication or order channel; souled bodies may seek directly sensed adjacent exposed charcoal',
    'Small local floor movements if souled and hungry; hot physical handling requires original usable long tongs',
    'Finite charcoal reserve, capacity 4 units; nominal burn 1 unit/hour; ash and emissions conserved; no free permanent heat/light',
    `${soulRule} Two original charcoal units form the body; reusable chamber or local fire-resistant brazier contains contact ignition. Dead remains cannot be relit into the same individual.`,
    formationSource + '; CREATURE_FORMATION.md', 'cinderling']);
  rows.push(['Zephyr Mote', 'Air elemental', 'Implemented: researched vortex, shared chamber, finite air/mana and vessel care',
    Formation.FAMILIES.zephyrMote.researchTier, Formation.FAMILIES.zephyrMote.synthesisTier,
    '0.1 m³ captured surrounding air (no biomass)', Formation.FAMILIES.zephyrMote.habitat,
    'Not defined; natural habitat authored, no wild encounter/population integration',
    'Spreads existing airborne contamination; opposing ventilation, strong circulation or mana depletion can collapse the vortex',
    'No language/order channel; soul permits local avoidance of directly sensed disruptive airflow, not automatic obedience',
    'Adjacent ordinary floor-space movement if souled; walls/closed doors block body, ducts grant no travel access',
    'Finite mana: 1/hour sealed, 2/hour gentle, 4/hour strong; 1 feedstock supplies 8, capacity 16; no autonomous feeding',
    `${soulRule} Four chamber mana form the body: two expended, two retained. Physical vessel controls exchange adjacent air, preserving substance amounts; no neutralization. Collapse retains the original identity and releases its captured air only when physically unsealed.`,
    formationSource + '; CREATURE_FORMATION.md', 'zephyrMote']);
  rows.push(['Rootling', 'Botanical creature', 'Implemented: original-tube propagation, planter care and finite air/liquid filtration',
    Formation.FAMILIES.rootling.researchTier, Formation.FAMILIES.rootling.synthesisTier,
    bundle(Formation.COSTS.growRootling), Formation.FAMILIES.rootling.habitat,
    'Not defined; natural family authored, no wild encounter/population integration',
    'Desiccation, darkness, waterlogging, phytotoxic accumulation and constrained root/drain obstruction',
    'No language/order channel; souled plants can direct a root tip toward directly sensed adjacent moisture',
    'Stationary body; bounded adjacent root extension through a real opening; physical guides also support passive soulless growth',
    'Finite water and organic/mineral medium, light and safe temperature; captured pollutants saturate leaves, tissue and substrate',
    `${soulRule} New propagated individual, not a soul retrofit to its source. Existing synthesis tube forms the body; ordinary planter supports care, bounded filtration and retained contaminated maintenance waste. Treated liquid is nonpotable; no free crops or universal purification.`,
    formationSource + '; rootlings.js; CREATURE_FORMATION.md', 'rootling']);
  rows.push(['Sporecap', 'Fungal creature', 'Implemented: original-tube development, covered planter, finite decomposition and spores',
    Formation.FAMILIES.sporecap.researchTier, Formation.FAMILIES.sporecap.synthesisTier,
    bundle(Formation.COSTS.growSporecap), Formation.FAMILIES.sporecap.habitat,
    'Not defined; natural family authored, no wild encounter/population integration',
    'Desiccation, waterlogging, unsafe temperature, retained pollutants and local spore contamination',
    'No language/order channel; souled individuals can deliberately close gills against directly sensed disturbance',
    'Stationary cap and bounded connected mycelial mat; no autonomous gathering or colony expansion',
    'Finite contacting plant waste and water; no sunlight required; real cover maintenance and waste collection',
    `${soulRule} One cap and its connected mat are one individual. Decomposition retains spent substrate, pollutants and respiratory losses; spores spend body reserves. No automatic offspring, edible harvest, universal detoxification or workforce.`,
    formationSource + '; sporecaps.js; CREATURE_FORMATION.md', 'sporecap']);
  const ecologyRows = [];
  for (const s of Ecology.BEAST_SPECIES) {
    const biome = s.biomeCodes.map(c => {
      if (!Environment.BIOME_CLASS_LEGEND[c]) throw Error(`Unknown biome code ${c}`);
      return humanize(Environment.BIOME_CLASS_LEGEND[c]);
    }).join('; ');
    const aspects = s.aspectCodes.map(c => humanize(Arcane.ASPECT_CLASS_LEGEND[c])).join('; ');
    const local = Wilderness.PROFILES[s.id];
    const status = !local ? 'Implemented strategic ecology; local encounters not implemented'
      : local.contactOnly ? 'Strategic ecology + bounded local contact/climbing/spell-imitation consumers'
        : 'Strategic ecology + supported local encounters';
    const rarity = `Baseline prevalence ${s.prevalenceRank}/4; seeded population and distribution vary`;
    const src = source('strategic-beast-ecology.js', `id: "${s.id}"`);
    rows.push([s.name, 'Natural beast', status, UNKNOWN, UNKNOWN,
      'Not defined — no implemented player-production recipe', biome, rarity,
      `${humanize(Ecology.THREAT_BANDS[s.threatRank - 1])} (${s.threatRank}/4); descriptive baseline, not a combat outcome`,
      `${humanize(s.intelligenceBand)}; actual communication/cooperation requires a supported channel`,
      s.movementModes.map(humanize).join('; '), humanize(s.diet),
      `${s.description} Every newly generated world includes this species; no guaranteed nearby individual. Named traits describe the species, not proof every local ability is implemented.`,
      src + (local ? '; wilderness-beasts.js:PROFILES' : ''), s.id]);
    ecologyRows.push([s.name, s.id, biome, s.biomeCodes.join(', '), s.realm, aspects, s.prevalenceRank,
      ({ 1: '1–2', 2: '2–3', 3: '3–5', 4: '4–6' })[s.prevalenceRank],
      s.threatRank, humanize(Ecology.THREAT_BANDS[s.threatRank - 1]), humanize(s.sizeBand),
      humanize(s.intelligenceBand), s.movementModes.map(humanize).join('; '), humanize(s.diet),
      humanize(s.ecologicalRole), humanize(s.socialPattern), humanize(s.lairKind),
      local ? local.contactOnly ? 'Bounded contact consumers; not generic wilderness spawning' : 'Supported local profile' : 'Strategic only',
      s.description, src]);
  }
  const pending = text('PENDING_PROMPTS.md');
  const plannedData = {
    '8-F': ['Cloth construct', 'Fabric + thread + stuffing + animation sigil/process; quantities not defined', 'Naturally occurring base form required; exact natural animation conditions and biomes not designed', 'Seam wear, repair, carrying limits and high flammability'],
    '8-G': ['Mineral construct', 'Common quartz/minerals + salts + finite mana; quantities not defined', 'Naturally occurring base form required; exact formation conditions and biomes not designed', 'Refraction/light interaction, impact fractures and material-consuming repairs'],
    '8-H': ['Umbral creature', 'Stable umbral pattern + modest mana + suitably dark field; quantities not defined', 'Formation environment: darkness and suitable mana; natural map biomes not authored', 'Illumination and mana-disruption limits; no presumed wall phasing or ghost identity'],
    '8-I': ['Luminous creature', 'Common luminous reagent + mana + inexpensive focusing process; quantities not defined', 'Naturally occurring base form required; exact formation method and biomes not designed', 'Finite emission energy, depletion, fragility and exposure; no presumed ghost origin'],
    '8-J': ['Osteal construct', 'Sourced cleaned animal bones + bindings + animation sigil/process; quantities not defined', 'Naturally occurring base form required; exact natural animation conditions and biomes not designed', 'Joint breakage, blunt-force damage and repairs requiring real replacement bones/bindings']
  };
  const planned = [];
  for (const line of pending.split('\n')) {
    const m = line.match(/^\| (8-[B-J]) \| \*\*([^*]+)\*\* — Research (\d+) \|/);
    if (!m) continue;
    if (!plannedData[m[1]]) continue; // Implemented families live in the current catalog.
    const [id, name, tier] = m.slice(1), [group, materials, habitat, upkeep] = plannedData[id];
    planned.push([name, group, `Proposed only — ${id}; design approval still required`, Number(tier), 0, materials,
      habitat, UNKNOWN, 'Not numerically defined; see planned upkeep/risks', 'Not approved; soul presence does not establish cognition or obedience',
      'Family-specific movement/control not yet implemented', upkeep,
      'Research rating is tentative; Production Tier 0 is a proposal, not an existing recipe. Own-soul formation must use the inherited device. No soul retrofit or unapproved autonomous workforce.',
      source('PENDING_PROMPTS.md', `| ${id} |`), id]);
  }
  if (planned.length !== Object.keys(plannedData).length) throw Error('Planned-creature queue changed; update the reference annotations.');
  const production = [
    ['Slime — tube synthesis', 'Slime', 'Per creature', `${slimeCost} biomass`, 'Optional soul-bearing attempt: 2 inherited-device mana during formation',
      '8 base minutes, skill-adjusted; actual routing/attendance adds time', 'Existing synthesis tube + inherited animancy device',
      'Valid genome, tube availability, stamina and actual biomass', 'Upkeep and hazards remain genome-dependent. Equipment and fuel charging are separate from biomass cost.', source('app.js', 'function startSynthesisFromCurrentGenome')],
    ['Slime — induced division / forced recombination', 'Slime offspring', 'Per procedure, not per child',
      '1 genetic material + conserved parent body mass/nutrition; original parent(s) required',
      'Optional soul-bearing brood: 2 inherited-device mana per child, yielding distinct child souls',
      'Base work: induced division 24 + 4 × child count minutes; recombination 36 + 4 × child count; skill-adjusted + travel',
      'Synthesis tube, physical parent access and reserved destination containers',
      'Living mature parent(s), sufficient mass/integrity, permitted care state and independent readiness',
      'No free parent mass, no copied parent soul; ordinary natural division is a separate biological path.', source('app.js', 'const workBase = clean.methodId')],
    ['Mudlet — formation', 'Mudlet', 'Per creature', bundle(Formation.COSTS.grow),
      '2 chamber mana; +2 inherited-device mana if a soul is requested', '60 seconds loading + 600 seconds formation; travel/attendance as applicable',
      'Reusable elemental chamber; inherited device in the same room, within eight tiles and line of sight for requested animancy',
      'Documented observed pattern, original input lots, chamber condition/fuel; nonrenewable 120-second outage buffer',
      'One body initially holds 2 kg clay and 2 L water. Wetting, leakage and evaporation consume/redistribute actual water.', 'creature-formation.js:COSTS/SECONDS/begin; CREATURE_FORMATION.md'],
    ['Cinderling — formation', 'Cinderling', 'Per creature', bundle(Formation.COSTS.growCinderling),
      '2 chamber mana; +2 inherited-device mana if a soul is requested', '60 seconds loading + 600 seconds formation; travel/attendance extra',
      'Same reusable elemental chamber and optional inherited animancy device', 'Documented fire pattern; original charcoal lots; nonrenewable 120-second outage buffer',
      'Starts with 2 fuel units; no biomass or second elemental apparatus.', 'creature-formation.js:COSTS/SECONDS/begin; CREATURE_FORMATION.md'],
    ['Cinderling — method discovery', 'Cinderling', 'Research setup; not per repeated creature',
      'Characterization: 1 charcoal; contained ignition/stability: 1 charcoal; documentation: 1 assay reagent',
      '1 chamber mana during stability observation', 'Notes 60 s; characterization 120 s; stability 300 s; documentation 180 s',
      'Inherited notes, workbench and shared chamber', 'Actual attended trials and original evidence; no mandatory Mudlet discovery',
      'Consumed trials leave actual residue/ash and smoke; documentation does not grant a body.', 'CREATURE_FORMATION.md'],
    ['Cinderling — care and containment', 'Cinderling', 'Per care action / reusable holder separately',
      'Feed: 1 charcoal; quench: 1 drinking water; reusable brazier: 2 stone blocks + 2 metal parts',
      'Finite fuel capacity 4; nominal burn 1/hour, slower smoldering when cold', 'Feeding 30 s; quenching 30 s; transfer 30 s; brazier construction 5 minutes',
      'Original usable long tongs for hot feeding/handling; actual nearby empty brazier for transfer',
      'Real local inputs and reach; hot handling wears the same tongs',
      'Quenching can permanently kill. Ash/emissions remain; a soulless body never chooses to feed itself.', 'CREATURE_FORMATION.md'],
    ['Zephyr Mote — formation', 'Zephyr Mote', 'Per creature', '0.1 m³ captured actual surrounding air; no biomass',
      '4 chamber mana: 2 spent stabilizing + 2 retained; +2 inherited-device mana if its own soul is requested',
      '60 seconds loading + 600 seconds formation; travel/attendance extra', 'Same reusable convergence chamber and optional inherited animancy',
      'Compared gentle/disruptive air trials and documented pattern; original captured parcel; finite 120-second outage buffer',
      'Captured airborne substances remain with the parcel. Failed formation returns them; no clean-air grant or free energy.', 'creature-formation.js:begin/finish; CREATURE_FORMATION.md'],
    ['Zephyr Mote — method discovery', 'Zephyr Mote', 'One-time research setup; not per repeated creature',
      'Reusable 0.1 m³ air samples for characterization and trials; 1 assay reagent for documentation',
      '1 chamber mana per gentle/disruptive trial (2 total)', 'Notes 60 s; characterization 120 s; low/high trials 300 s each; document 180 s',
      'Inherited notes, workbench and shared chamber; no mandatory Mudlet/Cinderling discovery',
      'Both original trial receipts required; high circulation damages trial coherence rather than discovering a free recipe',
      'Captured air/contaminants return on completion or cancellation; spent mana remains spent.', 'CREATURE_FORMATION.md'],
    ['Zephyr Mote — vessel and upkeep', 'Zephyr Mote', 'Reusable equipment / per charge separately',
      'Vessel: 2 glass + 1 metal part; recharge: 1 arcane feedstock',
      'Charge +8 mana if whole charge fits, capacity 16; sealed upkeep 1/h, gentle 2/h, strong 4/h',
      'Vessel construction 5 min; physical transfer/seal/orient/mode 30 s; recharge 60 s; travel extra',
      'Intact nearby original sealable vessel; physical operator access, not creature commands',
      'Gentle exchanges 1 m³/h, strong 3 m³/h; barriers/permeability apply; strong mode tears coherence',
      'Conserves individual airborne substance amounts; no room-wide cleaning, filter substitute, autonomous feeding or revival.', 'CREATURE_FORMATION.md'],
    ['Rootling — propagation', 'Rootling', 'Per new individual', bundle(Formation.COSTS.growRootling),
      '2 original synthesis-tube mana; +2 concurrent inherited-device mana for an own soul',
      '60 seconds loading + 6 supported hours; nonrenewable 30-minute outage buffer', 'Original synthesis tube; no elemental chamber or new propagation apparatus',
      'Documented botanical method; real light ≥20, 15–32 °C, original input lots and exclusive tube occupancy',
      'One propagule represents 1 kg sourced plant material; one medium is 1 kg organic/mineral substrate; water is in litres. Failure retains incorporated material, not a replacement creature.', 'creature-formation.js:COSTS/SECONDS/begin/finish; CREATURE_FORMATION.md'],
    ['Rootling — method discovery', 'Rootling', 'Research setup; not per repeated creature',
      'Characterization: 1 propagule + 1 water + 1 assay reagent; illuminated and shaded trials: each 1 propagule + 1 water + 1 medium; documentation: 1 assay reagent',
      'Original bench light and performed, physically shaded comparison; no elemental chamber trial',
      'Notes 60 s; characterization 120 s; each trial 600 s; document 180 s', 'Inherited notes and original research bench',
      'Characterize sourced material, perform both actual controls, retain dated evidence and document',
      'Consumed trial inputs become physical spent tissue, medium and wastewater; documentation grants a method, not a body.', 'CREATURE_FORMATION.md'],
    ['Rootling — planter and care', 'Rootling', 'Reusable planter / per maintenance action separately',
      'Planter: 2 lumber + 2 glass + 1 metal part; water: 1 water; nourish or replace substrate: 1 nutrient medium; wash: 1 water',
      'Tube charge: 1 arcane feedstock adds 8 mana, capacity 24; no passive refill',
      'Planter construction 5 min; transplant 60 s; water/nourish/mode 30 s; load/drain/wash/prune/guide 60 s; replace 120 s',
      'Original nearby empty planter, light/water/medium and physical reach; pruning uses and wears the original scraper',
      'Tray holds ≤2 L of a real supplied botanical liquid batch; capture is profile-specific, finite and saturating',
      'Washing yields contaminated water; replacement yields spent substrate; pruning wounds the plant and yields contaminated cuttings. Root barriers/real drain openings constrain growth; dead roots continue obstructing until cut.', 'rootlings.js; CREATURE_FORMATION.md'],
    ['Sporecap — development', 'Sporecap', 'Per new individual', bundle(Formation.COSTS.growSporecap),
      '2 original synthesis-tube mana; +2 concurrent inherited-device mana for an own soul',
      '60 seconds loading + 4 supported hours; cumulative nonrenewable 30-minute support-loss buffer',
      'Original synthesis tube, shared exclusively with slime and Rootling formation',
      'Documented actual damp/dry comparison; 15–32 °C, original stocks and intact unmoved apparatus; no light requirement',
      'Starter = 1 kg sourced spores/fungal tissue; compost = 1 kg plant-derived organic substrate; water = 1 L. One cap plus its connected mat, not multiple individuals.', 'creature-formation.js:COSTS/begin/advance; CREATURE_FORMATION.md'],
    ['Sporecap — method discovery', 'Sporecap', 'One-time research setup',
      'Characterize: 1 fungal starter + 1 assay reagent; damp trial: 1 starter + 1 compost + 1 water; dry control: 1 starter + 1 compost; document: 1 reagent',
      'Actual local temperature; dry control receives no supplied water; no Rootling research or elemental-chamber dependency',
      'Notes 60 s; characterization 120 s; controls 300 s each; document 180 s', 'Inherited notes and actual research bench',
      'Personally performed controls and saved evidence, not a free known recipe',
      'Consumed trial solids and supplied water remain physical outputs; assay pollutants stay in characterized substrate.', 'CREATURE_FORMATION.md'],
    ['Sporecap — care and spore control', 'Sporecap', 'Reusable equipment / per care action separately',
      'Reuse planter: 2 lumber + 2 glass + 1 metal part; cover: 1 cloth; water or each washing: 1 water; feeding: original compatible plant waste',
      'Nominal decomposition 0.05 kg/h; 25% reserve, 25% spent substrate, 50% recorded respiratory loss; ongoing reserve respiration separate',
      'Planter construction 5 min; transfer/feed/fit/wash/collect 60 s; cover controls/water 30 s',
      'One individual per planter; bounded connected mat, real reach and original reserved feed portions',
      'Exposed spores spend up to 0.005 kg/h of reserves; fitted cover holds 0.02 kg before saturation stops further covered release',
      'Spores become real airborne/deposited material, never automatic offspring. Cover/floor washing retains spores in nonpotable wastewater. Spent substrate is not automatically fresh nutrient medium or food.', 'sporecaps.js; CREATURE_FORMATION.md'],
    ['Elemental chamber — construction', 'Mudlet / Cinderling / Zephyr Mote', 'Reusable equipment; not per creature',
      '4 metal parts + 2 glass + 2 arcane feedstock', 'Charge chamber separately; maximum stored mana 24', '20 base construction minutes + normal construction logistics',
      '2 × 1 floor footprint with accessible operator/test fitting', 'Read inherited notes and physically characterize clay/water, charcoal or airflow first',
      'Do not add this full equipment bill to each repeated Mudlet.', source('app.js', "id: 'elementalChamber'")],
    ['Mudlet — method discovery', 'Mudlet', 'Research setup; not per repeated creature',
      'Characterization: 1 clay + 1 drinking water; stabilization: 1 clay + 1 drinking water; documentation: 1 assay reagent',
      '1 chamber mana for stabilization', 'Notes 60 s; characterization 120 s; stabilization 300 s; documentation 180 s; travel extra',
      'Inherited notes/device, workbench and constructed elemental chamber', 'Personally performed trials/evidence; actual original input custody',
      'An observed fixed pattern, not a free designer slider. Trials leave physical residue.', 'creature-formation.js:COSTS/SECONDS; CREATURE_FORMATION.md'],
    ['Animancy / chamber — fuel charging', 'Artificial formation apparatus', 'Per charge batch', bundle(Formation.COSTS.charge),
      '+8 mana, capacity 24; fuel is not stored souls', '60 seconds + actual travel', 'Original reachable apparatus with room for the whole charge',
      'Staged original feedstock and usable apparatus', 'Keep charge batch cost separate from each creature’s mana consumption. The creation device is inherited, not freely duplicable.', 'creature-formation.js:COSTS; app.js:finishElementalWork'],
    ['Homunculus — body growth', 'Human-derived homunculus', 'Per new body', bundle(Homunculi.MODES.body.inputs),
      'Connected power 4 units/h, mana 2/h, clean water 1/h and drainage 1/h; optional own-soul gathering requires 2 device mana during pre-embodiment growth',
      '72 hours growth + 30-minute loading task; scheduled attended care',
      'Dedicated growth chamber, usable utilities, examined self-derived template and suitable medium',
      'Tissue-culture + morphogenesis research; Medicine/Alchemy 101; inspected chamber ≥80% at loading; 15–32 °C; care every 12 hours',
      'Per-body direct inputs, not all prior research or medium-preparation costs. Numeric research/production tiers remain unassigned.', homunculusSource + '; app.js:homunculusHooks'],
    ['Homunculus — culture trial', 'Human-derived tissue; not a separate creature', 'Per prerequisite trial', bundle(Homunculi.MODES.culture.inputs),
      'Connected growth utilities and attended care; no independent soul/person', '12 hours + 30-minute loading task',
      'Inspected growth chamber and examined human template', 'Tissue-culture research and advanced execution skills',
      'A culture trial is evidence/tissue, not a homunculus or a cheap workforce.', homunculusSource],
    ['Homunculus — medium preparation', 'Prepared growth medium', 'Per 20-unit batch', '20 biomass + 4 assay reagent + 8 drinking water',
      'Safe physical preparation environment; suitable equipment condition affects quality', '20-minute task + travel', 'Actual workbench and staged original supplies',
      'Preparation quality/contamination matters; growth loads actual prepared lots', 'An 18-medium body recipe uses prepared output. Do not also charge every body a full batch without accounting for leftovers.', source('app.js', 'const costs = action === "sample"')],
    ['Homunculus — chamber construction', 'Reusable advanced apparatus', 'Reusable equipment; not per creature', '12 steel panels + 8 metal parts + 8 glass + 6 rubber',
      'Electricity, mana, clean-water and drain connections', '180 base construction minutes + normal logistics', '2 × 2 floor footprint, operator access and connected life support',
      'Tissue-culture research and Adept Fabrication (101)', 'Still an advanced apparatus; inherited animancy does not unlock growth research or skills.', source('app.js', 'id: "homunculusChamber"')],
    ['Human — ordinary reproduction', 'Human', 'Natural biological process, not a production recipe', 'Not represented as a player crafting cost',
      'Not defined as a recipe', 'Not defined as a production timer', 'N/A — no human-production apparatus defined',
      'Human characters are not manufactured inventory or implicitly consenting workers', 'Do not substitute the homunculus recipe for all humans.', source('DESIGN_BIBLE.md', 'The Scientist')]
  ];
  const forms = [
    ['Dog', 'Explicit worldbuilding base creature', 'Lore-confirmed; no dedicated actor/recipe/tier definition', UNKNOWN, UNKNOWN, UNKNOWN,
      'Natural dogs exist; exact biomes and prevalence not authored',
      'The ten-legged saber-toothed dog is an example of an engineered variant, not a new implemented species or recipe.', source('DESIGN_BIBLE.md', 'Dogs exist in the world')],
    ['God / ascended human or beast', 'Divine state, not a species', 'Implemented world-history/divine systems', 'N/A — not a creature-production tier', 'N/A — not a creature-production tier', 'No player mass-production recipe',
      'Original human/beast kind and actual divine history determine context; no single god biome or rarity rank',
      'Faith supports divinity; humans and beasts may ascend. Generated gods are world-specific individuals, not a fixed species list.', source('DESIGN_BIBLE.md', 'Divinity is an attainable') + '; strategic-divine-history.js'],
    ['Descended former god', 'Same individual after loss of divinity', 'Implemented divine-history/body systems', 'N/A — state change', 'N/A — state change', 'N/A — not a newly produced creature',
      'Existing individual’s location and original kind', 'Losing followers/divinity does not cause automatic death. The powerful living individual remains.', source('DESIGN_BIBLE.md', 'Divinity is an attainable') + '; divine-bodies.js'],
    ['Divine avatar', 'Manifestation, not a new base species', 'Implemented divine manifestations', 'N/A — manifestation', 'N/A — manifestation', 'Not defined as a player creature recipe',
      'Actual divine reach/manifestation context; no independent species biome or rarity', 'An avatar is not the god’s original physical body; defeating it does not automatically kill the god.', 'divine-intervention.js; DESIGN_BIBLE.md'],
    ['Prepared resurrection receiving body', 'Empty human-derived receiver; not an independent person', 'Implemented late-game soul-beacon receiver', 'N/A — receiver procedure; numeric creature tier not assigned',
      'N/A — receiver procedure; numeric creature tier not assigned', 'Separate late-game receiver recipe, not the ordinary homunculus recipe',
      'Physically supplied laboratory or separately supported receiving site', 'No independent new soul is formed. Receives the scientist’s existing surviving soul; late research, supplies, integrity and readiness remain necessary.', 'soul-beacons.js; CREATURE_FORMATION.md'],
    ['Scientist clone / rebodied scientist', 'Human body/identity state', 'Implemented protagonist / supported late recovery', 'N/A — not a separate species', 'N/A — not a separate species',
      'Inherited start or separately supplied late-game recovery; not a repeatable ordinary-human recipe',
      'Scientist’s actual starting/receiving location', 'Memory continuity and body-tied expertise depend on the actual mechanism; neither cloning nor rebinding invents a new species.', 'DESIGN_BIBLE.md; soul-beacons.js']
  ];
  const guide = [
    ['Purpose', 'Developer reference for authored creature definitions and current design proposals. This is not the scientist’s in-game knowledge or a live world census.'],
    ['Coverage', `${rows.length} current catalog entries: humans, slime, Mudlet, human-derived homunculus, Cinderling, Zephyr Mote, Rootling, Sporecap, and all ${Ecology.BEAST_SPECIES.length} strategic beast species. ${planned.length} proposed creatures are on a separate tab. Explicit dog lore and divine/receiver states are separate from species.`],
    ['Research tier', 'Difficulty of discovering a reproducible formation method. Numeric values appear only where authored; they are not combat ratings or compulsory campaign chapters.'],
    ['Production tier', 'The code calls this Synthesis Tier: practical production complexity after the method is known. Tier 0 is inexpensive/simple, not free or upkeep-free.'],
    ['Not defined', 'The current source has no authored number, recipe or classification. This is not zero, impossible, universally unavailable, or approval to invent one.'],
    ['N/A', 'The field is inapplicable, such as an ordinary human or an ascended/descended state rather than a player crafting recipe.'],
    ['Rarity', 'Beasts have authored prevalence ranks 1–4: higher ranks generate more populations and contribute to abundance. These are not official Rare/Common labels, percentages, guaranteed local encounters or fixed world populations.'],
    ['Every world', 'All 24 authored strategic beast species exist in every newly generated world. Population, abundance, territory and migration are randomized. No particular run/world census was supplied.'],
    ['Population bands', 'The Beast ecology tab’s seeded population-count ranges are the number of generated population records, not animal counts. They come directly from populationCount().'],
    ['Biome and threat', 'Beast biome and mana-aspect codes are decoded from the authored legends. Threat rank maps to the authored threat bands, not a predicted fight result. Other habitats are labelled lore/formation conditions, not invented map biomes.'],
    ['Implementation status', 'Strategic ecology does not mean a fully implemented local creature, combat ability, player production recipe or encounter. Only current WildernessBeasts.PROFILES are identified as local profiles.'],
    ['Costs', 'Materials are in game inventory units unless explicitly stated otherwise. They are not market currency quotes. Production detail separates per-creature input, per-procedure cost, reusable equipment, research setup and upkeep.'],
    ['Soul and will', 'Artificial own-soul formation needs concurrent inherited animancy; unassisted bodies have no independent will/leveling. No later own-soul retrofit. Slimes never communicate or cooperate. A soul does not guarantee consent or obedience.'],
    ['Origins', 'Every creatable base form exists naturally. Engineered variants need not occur naturally. Even gods cannot invent arbitrary creature kinds or life from nothing.'],
    ['Humans and homunculi', 'Humans are included. Human occupations are not species. Homunculi are advanced human-derived engineered bodies with unassigned numeric tiers; campaign-stage descriptions must not be silently converted to tier numbers.'],
    ['Planned tab', `All ${planned.length} pending creatures are proposals. Proposed numeric tiers and qualitative ingredients are not final balancing values or implemented recipes. Exact quantities, biomes, rarity and control channels still require ordinary design.`],
    ['Variants and scope', 'One row per authored base kind/implemented human-derived family, not every generated name, slime genotype, occupation, avatar or soul condition. Implied generic fauna/mounts are not invented catalog species.'],
    ['Authority', 'Runtime definitions win for implemented values. Current PENDING_PROMPTS.md wins for future scope; the original untracked creature-ideas file is not silently treated as implemented content.'],
    ['Editing / rebuild', 'The workbook is editable. Generated files are snapshots; rebuilding replaces them. To retain design annotations across rebuilds, update scripts/creature-catalog-data.js. Run python3 scripts/build-creature-catalog.py. No gameplay definitions are changed.']
  ];
  return { headers: HEADERS, creatures: rows, planned, ecology: ecologyRows, production, forms, guide,
    legends: { biomes: Environment.BIOME_CLASS_LEGEND, aspects: Arcane.ASPECT_CLASS_LEGEND },
    revision: process.env.CREATURE_CATALOG_REVISION || 'Working-tree snapshot' };
}
if (require.main === module) process.stdout.write(JSON.stringify(buildCatalog()));
module.exports = { buildCatalog, HEADERS };
