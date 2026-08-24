# Helix Heresy

Helix Heresy is a desktop-focused static browser prototype about forbidden creature genetics, laboratory discovery, and questionable science.

The current build starts with slimes as the simplest creature type. Players edit 26-base genomes, synthesize living samples, discover traits through tests, manage slime reproduction, manage corpses and Suspicion, and assign creatures to early lab jobs.

For story background, long-term systems, current design direction, and open questions, see [DESIGN_BIBLE.md](DESIGN_BIBLE.md). The approved map projection, sprite scale, modular creature assembly, and readability rules live in [VISUAL_LANGUAGE.md](VISUAL_LANGUAGE.md).

## Current Prototype

- Clickable ASCII DNA helix and seeded procedural gene mapping.
- Slime synthesis with Biomass costs, testing, longer lifespans, maturity, current mass, division pressure, condition stats, and local saves.
- Evidence-driven research projects that cite reusable observations, consume physical materials and scientist work, preserve interrupted workpieces, and unlock advanced tests or usable prototypes.
- An Experiment Notebook for player-written hypotheses, optional controls, one-to-three experimental subjects, planned-genome synthesis, immutable baseline/final snapshots, ordinary test evidence, confounder-aware comparisons, and routed workbench conclusions.
- Physical diagnostic workflows with worn Environmental Survey Kits, Thaumometers, and Assay Cases; visible routed work; calibration and condition-based uncertainty; sealed air and biological samples; reagent-consuming bench assays; and saved historical results.
- Core stockpile resources: Biomass, Genetic Material, Elemental Residue, Waste, and broad feedstocks for testing feeding systems.
- Advanced slime heredity with autonomous Natural Division, routed Induced Division and Forced Recombination, Fidelity/Balanced/Novelty priorities, optional deterministic mutation, segment-level parent contributions, strict mass conservation, and immutable lineage events.
- Longitudinal creature welfare with five qualitative derived needs, staged persistent conditions, autonomous quiescent recovery, per-creature care plans, a bounded intervention-burden ledger, knowledge-safe alerts, and a reusable physical Slime Enrichment Station.
- Scalable local slime group behavior with six-tile neighborhoods, 16-neighbor detail caps, aggregate crowd density, temporary cohorts, cohesion/separation/alignment/competition responses, personal territorial memory, and physically diffusing distress signals.
- Saved containment emergencies with Warning through Resolved stages, knowledge-safe perception or room-alarm detection, Manual/Notify and Pause/Automatic Lockdown policies, physical door work, contextual recapture/bait/retreat/cleanup/repair responses, room-level coordination, and recovery requirements derived from remaining creatures, damage, contamination, spills, and work orders.
- Map-integrated real-time combat with Strike, Guard, Shove, Retreat, Intercept, Soul Lash, last-known targeting, readable recovery, anatomy-aware persistent injuries, pain and limb impairments, nonlethal incapacitation, progressive bleeding or membrane leakage, and routed examination/stabilization/treatment that consumes physical bandages, neutralizing wash, or membrane sealant. Serious recaptured-creature injuries remain part of containment recovery.
- Discoverable physical traits such as shape, body consistency, appendages, color, element, size, weight, movement, and Sustenance.
- Sustenance traits describe a slime's primary feeding adaptation, with broad material, waste/decay, and slow environmental pathways.
- Manual feeding, best-match feeding after Sustenance discovery, and auto-feeding policies with per-slime automation exclusion.
- Main Lab room foundation with dynamic Temperature, Light, Ambient Mana, Moisture, Contamination, and Electrical Charge.
- Connected physical ventilation, drainage, electricity, mana, and clean-water networks with finite source and conduit capacity, stable consumer priorities, redundant-source failover, fuel, stored-mana, cistern-volume, and water-quality limits, deterministic service wear and faults, inspection-gated diagnosis, and routed preventive-maintenance and repair orders.
- Manufacturing bills can set a minimum component craftsmanship distinct from the maintain-stock finished-quality floor. Automatically generated prerequisite chains inherit the gate, consume the lowest qualifying fabricated stock first, retain every rejected output as a traceable physical item, and pause after three consecutive rejected attempts instead of silently exhausting materials. Saved produced, accepted, rejected, and retry state remain visible and can be deliberately resumed or reset by changing the parent requirement.
- Persistent black-market contacts, reputation referrals, expiring spot offers, and separately presented raw-material, manufactured-contraband, and living-specimen requests. Negotiated contracts reserve exact receptacles, qualifying chemical batches, or individual creatures plus a crafted transport pod; preserve quality-adjusted value, deadlines, exposure, payment, and relationship outcomes; and route every physical pickup through the Concealed Exit. Specimen transfers carry an additional saved pod-breach risk and can release the creature at the exit if containment fails.
- A lawful two-sided commodity exchange with deterministic saved supply, demand, bid/ask quotes, stock-style price-history charts, immediate and limit orders, protected-cash maintain-stock automation, partial fills, exact physical legal sale lots, quality-aware finished-product valuation, Loading Bay consignments, business reputation, and a separate legal ledger.
- A persistent front-company identity with deterministic generated or player-entered legal names, declared chemistry activities, renovation/limited/open operating states, automatic purchase/receipt/production/analysis/packaging/certification/waste/sale/maintenance records, physical-inventory reconciliation, saved unexplained-loss variances, and six-dimensional qualitative cover credibility. Seven-day books close through routed Staff Operations work and retain immutable filing snapshots.
- Corpse handling with waste drums, decay states, necropsy, dumping, external detection risk, and policy-driven Corpse Processing jobs.
- A persistent investigative-evidence ledger, separate from research evidence, records biological, chemical, documentary, and commercial traces with stable subjects, authoritative locations, exact references, deterministic aging, player knowledge, lifecycle, and immutable provenance. Records > Evidence and the knowledge-safe map overlay expose only traces the player knows.
- Physical evidence handling uses saved subject-level work orders with exact routes, tools, receptacles, workstations, qualitative risk reasons, and outcomes frozen when work begins. Cleanup produces sealed successor waste and contaminated tools; ordinary hauling updates custody provenance; real closed or locked fixtures derive Contained, Secured, and Concealed states; misleading Packaging Station labels create company contradictions; treatment and shredding leave traceable outputs; licensed Loading Bay removal charges a fee and creates a permanent manifest; and Staff Operations keeps one physical records packet per reporting period with append-only amendments. Handling never retracts reports, authority knowledge, cases, or Suspicion by itself.
- External detection uses saved abstract witnesses, intermediaries, monitoring systems, exposure opportunities, delayed reports, institutional correlation, and fading institutional memory. Suspicion is a derived qualitative measure of outside attention: hidden internal wrongdoing alone does not raise it, exact rolls and hidden sources remain private, and Records > Evidence shows only known reports or reasonably inferred signals.
- Persistent authority investigations use saved institutional intake reviews, narrow evidence-supported theories, merged reports, qualitative strength, bounded leads, review deadlines, escalation stages, authority-only evidence claims, and append-only contacts and history. Hidden cases add external pressure without appearing in normal records; disclosed cases expose only their official docket, stated concern, disclosed claims, contacts, and response-free informational notices.
- Disclosed cases can issue formal, deadline-bound institutional demands. The player composes a bounded factual claim or refusal, cites only accessible physical records and evidence, may attach a non-mechanical note, and routes the immutable response packet through Staff Operations. Authorities evaluate only their own saved knowledge and the submitted citations, then record acceptance, clarification, surveillance, corrective orders, fines, operating restrictions, follow-up inspections, or issued warrants. Overdue responses and unpaid actions escalate deterministically.
- Commercial Registry records warrants and environmental search-and-sample warrants freeze exact authorized rooms, fixtures, and subject categories when issued, then receive a short disclosed service window. A physical warrant officer presents the warrant, requests controlled access, follows ordinary map paths and locks, searches only locally reached scope, carries bounded exact packets or samples back to the lawful entrance, and files an immutable return with append-only custody. Obstruction schedules a disclosed deterministic return with a lead officer and pry-bar-equipped breach officer. Forced entry authorizes only target-blocking doors, fixtures, or constructed walls, applies real persistent condition damage and noise, honors late physical compliance, records physically observed narrow expansions separately, reuses exact seizure custody, and files an immutable supplemental return.
- High-severity law-enforcement warrants authorize deterministic named four-officer raids with saved objectives, scope, roles, equipment, communication, force causes, barrier outcomes, seizures, and history. Booking leads into a compact physical temporary jail and an evidence-linked criminal case with named court actors, exact charges, counsel, discovery, motions, claims, pleas, and custody effects. Contested bench trials preserve charge-specific theories, one exact challenge, testimony, three physical court phases, explicit legal elements, admitted support, witness contribution, proof margins, reasonable doubt, and written verdicts without a rerollable verdict roll. A separate sentencing appearance combines convictions into acquittal release, time served, fine and probation, finite or life prison, penal service, or death-row orders; money, restrictions, release, remand, jail handoff, and destination commitments are physical and saved, while a death sentence never sets game over. Jail escape uses exact observed facts, physical routes, or willing persistent contacts and remains available during the post-sentence transfer window.
- Scheduled Registry auditors, environmental/public-health inspectors, licensed waste carriers, and routine couriers arrive through disclosed lawful windows as persistent map actors. Records > Visits exposes mandates, arrival windows, requests, granted access, current activity, disclosed findings, and completed summaries; actors traverse saved tile routes, operate unlocked doors, wait at denied or physically locked boundaries, and inspect only locally reachable conditions. In-mandate denial records noncooperation without revealing contents, while confirmed inspector observations immediately create strong institution-linked reports.
- Creature Jobs panel with Idle, Corpse Processing, and Waste Disposal assignments that can affect slime condition stats.
- Actor-neutral equipment attachment points with an empty vat-start scientist loadout, routed equipping, protective clothing, persistent wear and contamination, encumbrance, optional belts and backpacks, a preserved Back Mount for specialized apparatus, and player-named loadouts.
- Scientist stamina, mana, skills, XP/resource cheats, real-time-paced hands-on tasks, physical trip-and-route hauling, 1x/5x/10x speed controls, manual skip controls, and keyboard shortcuts.
- Icon-based management windows with accessible labels, keyboard shortcuts, and right-click back/dismiss behavior shared with Escape.
- Saved player map knowledge with light-aware line-of-sight perception, physical room lighting, no magically equipped vat-start lamp, unexplored darkness, remembered terrain, stale last-known tiers, uncertain incident markers, and Debug-only omniscience.
- Seeded, lazily generated underground geology with distinct rock strata, hidden ore veins and environmental pockets, geology-aware excavation time and tool wear, physical rubble outputs, and derived room-expansion readiness.
- Data-driven, versioned starting scenarios that materialize site blueprints, physical loadouts, spawn state, identity, and liabilities into authoritative saves, with the divided Chemistry Front as the normal start and an underground-only Debug start. Older Chemistry Front saves retain their recorded provenance and topology.
- A saved bounded surface parcel above the starter laboratory with first-class outdoor terrain and a roofed chemistry-company shell divided into Public Reception, Staff Operations, Process Hall, Hazardous Storage, Loading Bay, and a Secured Basement Vestibule. Public, freight, and covert access points remain physically separate; the loading portal is a three-tile locked freight door, while the ordinary basement stair remains distinct from the Concealed Exit.
- Six inherited, worn Chemistry Front machines—wet bench, reaction vessel, fume hood, analysis station, packaging station, and waste treatment—connected through a physical paired basement riser and surface service trunk. Commissioning, startup, shutdown, calibration, cleaning, diagnostic cycles, inspection, maintenance, and repair are routed work; hard utility failures block operation while lesser deficiencies raise deterministic local spill, fume, contamination, wear, and fault risk. Diagnostic cycles deliberately produce only physical test waste, not recipe products.
- Four transparent Chemistry Front development atlases give the Canvas map exact, footprint-safe surface terrain, envelope, service-trunk, access-state, chemistry-machine, freight, observable product-form, and hazard sprites. Semantic keys remain renderer-neutral, hidden legality is not encoded in appearance, and the DOM glyph map plus procedural/category fallbacks remain intact.
- Explicit Chemistry production recipes select raw and processed inputs by physical phase and declared tags, including prohibited mutagenic primer and arcane suspension plus a controlled numbing solvent for illicit manufacture. Every intermediate and finished batch keeps a stable identity, exact direct inputs and ancestor batches, source specimens, recipe revision, workstation, operator, purity, craftsmanship, contaminants, hazards, and actual versus assayed legal classification. Assays consume reagent and a physical sample; packaging consumes a bottle; truthful certificates can only be issued from a saved assay. Utility interruption preserves the in-progress workpiece, while cancellation produces traceable unfinished chemical waste. A separate containment recipe crafts the consumable specimen transport pods required by living-creature contracts.
- Payload-aware doors and vertical connectors that validate carried mass, volume, width, length, and height. The stair accepts hand loads but rejects bulky containers and freight, while the loading portal accepts wide surface cargo. Exact room-to-room material transfers use repeated capacity-limited trips, revalidate routes, preserve carried stacks across interruption and reload, and drop the current physical load on cancellation.
- Knowledge-safe physical lighting and selected temperature, humidity, ambient-mana, light, and aggregate airborne-contamination overlays shared by the DOM and Canvas renderers.
- Renderer-neutral ground, world, and alert effects for known spills, structural failures, active abilities, incidents, and actionable task endpoints, with severity-ranked equipment status cues.
- Persistent map accessibility controls for glyph-first rendering, reduced motion, high contrast, effect intensity, readable zoom floors, and scalable markers. Color-independent shapes and glyphs remain active in every mode.
- Automatic, manual, and disabled journal modes.

Trait outcomes and gene mappings are intentionally hidden during normal play so they can be discovered experimentally.

## Running Locally

No build step is required.

Open `index.html` in a browser:

```bash
xdg-open index.html
```

Alternatively, serve the folder from VS Code's integrated Ubuntu terminal:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The game is currently designed for desktop play.

For development and automation on Ubuntu, install a current Node.js LTS release, run `npm install`, and use VS Code's integrated terminal. No VS Code extension is required. Run the Chromium correctness suite and map benchmark with:

```bash
npm run test:smoke
npm test
npm run test:visual
npm run benchmark:map
npm run benchmark:map:full
```

The smoke command is the quick cross-system check for routine iteration. The full correctness command runs the complete Chromium regression suite with four workers to avoid overcommitting the Ubuntu desktop. Run the full suite before publishing substantial changes. The visual command checks committed Ubuntu/Chromium baselines without changing them; use `npm run test:visual:update` only after deliberately reviewing an intended rendering change. The quick benchmark is intended for iteration; the full mode takes more samples. Timing budgets are advisory across different computers, while visible-count and idle-frame invariants fail the command.

## Project Files

- `index.html` - Page structure and UI panels.
- `styles.css` - Visual design, layout, and responsive behavior.
- `app.js` - Game state, genetics, time simulation, saves, tests, slime reproduction, jobs, derived Suspicion, rooms, corpses, and rendering.
- `geology-field.js` - Deterministic coordinate-based strata, mineral deposits, excavation hazards, exposed-face knowledge, and physical mining yields.
- `research-system.js` - Deterministic research project definitions, evidence requirements, saved project records, and technology-unlock evaluation.
- `investigative-evidence.js` - Renderer-independent normalization, persistence, significance, lifecycle, provenance, and deterministic integrity rules for suspicious site evidence.
- `evidence-handling.js` - Renderer-independent evidence-work orders, qualitative risk assessment, frozen seeded outcomes, record packets, disposal manifests, and physically derived custody labels.
- `external-detection.js` - Renderer-independent saved sources, seeded exposure and reporting outcomes, report correlation, institutional memory, knowledge boundaries, and derived-attention scoring.
- `investigation-cases.js` - Renderer-independent institutional intake, case merging, theory selection, qualitative case strength, leads, deadlines, contacts, disclosure boundaries, and case-pressure rules.
- `institutional-responses.js` - Renderer-independent formal demands, immutable cited response packets, institution-knowledge-limited evaluation, deadlines, staged administrative actions, restrictions, and issued warrants.
- `warrant-executions.js` - Renderer-independent frozen warrant scope, service windows, search targets, exact seizures, custody transitions, obstruction, target-linked forced entry, late compliance, narrow physical expansion, violence outcomes, immutable original and supplemental returns, and law-enforcement raid handoff.
- `law-enforcement-raids.js` - Renderer-independent high-severity raid authorization, named team roles, physical custody progression, communication and force records, seizures, detention, escape, withdrawal, and death outcomes.
- `jail-custody.js` - Renderer-independent temporary-jail stays, armored transport, named custody staff, routines, delayed channel-specific communication, bounded knowledge reports, distinct security observations, and physical magic-suppressor state.
- `pretrial-proceedings.js` - Renderer-independent charges, court actors and counsel, first appearances, discovery packets, preparation, record-specific motions, structured claims, plea negotiation, custody effects, trial/sentencing handoffs, release records, and continuing fugitive cases.
- `trial-sentencing.js` - Renderer-independent bench-trial strategy, charge elements, evidence and witness proof, reasonable-doubt findings, plea sentencing, combined sentence orders, financial obligations, supervision restrictions, destination commitments, missed appearances, and physical release/remand handoffs.
- `jail-escape-rescue.js` - Renderer-independent standing extraction contingencies, contact willingness, observation-linked escape plans, opportunity windows, physical stages, deterministic detection, failure consequences, staging destinations, fugitive pursuit, and watched-return handoffs.
- `site-visits.js` - Renderer-independent visit schedules, lead and support visitor identities, mandates, agendas, access requests, route observations, local examination progress, findings, obstruction records, and completion summaries.
- `diagnostic-system.js` - Instrument, calibration, sample, confidence, uncertainty, and immutable diagnostic-result data contracts.
- `experiment-system.js` - Experiment templates, subjects, lifecycle normalization, immutable comparison records, conclusion labels, genome-difference summaries, and deterministic confidence bands.
- `heredity-system.js` - Deterministic haploid inheritance, controlled-method definitions, mutation priorities and bands, segment-based recombination, and immutable reproduction-event normalization.
- `welfare-system.js` - Renderer-independent qualitative needs, exposure histories, staged welfare conditions, care-plan definitions, bounded intervention records, and persistent consequence factors.
- `group-behavior-system.js` - Renderer-independent bounded local neighborhoods, deterministic temporary cohorts, dense-population probes, and stable group context contracts.
- `terrain-connectivity.js` - Renderer-neutral terrain adjacency, edge relations, door framing, ramp segments, and deterministic visual variation.
- `actor-visual-state.js` - Renderer-neutral four-way facing, canonical pose precedence, semantic activity families, condition cues, and sprite-key candidates derived from simulation state.
- `animation-clock.js` - Presentation-only game-time sampling plus normalized motion/action timelines; it never advances simulation.
- `map-knowledge.js` - Sparse saved cell observations, light-aware same-layer perception queries, last-observed age tiers, and knowledge records for current, stale, unknown, and Debug map presentation.
- `map-visual-state.js` - Versioned renderer-neutral map scenes, unique entities, effect planes, severity-ranked status cues, knowledge-filtered lighting/environment state, animation timelines, capped presentation-time feedback, interactions, overscan, pre-normalization culling, optional chunked spatial queries, and schema validation.
- `map-render-order.js` - Shared semantic render passes, stable depth ordering, crowded-target priority, tall-layer slicing, and occlusion policy.
- `sprite-asset-manifest.js` - Stable semantic map-sprite keys, source and logical dimensions, tile anchors, transform capabilities, aliases, and category fallbacks.
- `sprite-asset-loader.js` - Asynchronous image loading, shared atlas-source caching, validation, status diagnostics, and nonfatal fallback resolution.
- `assets/sprites/` - Generated individual and atlas-based development placeholders plus asset-maintenance notes.
- `canvas-map-renderer.js` - Primary Canvas map renderer with deterministic passes, physical lighting, airborne and hazard treatment, semantic status markers, occlusion handling, anchored multi-tile sprites, complete glyph-first rendering, knowledge-safe movement interpolation, semantic transient action feedback, accessibility presentation options, cached viewport draw plans, invalidation diagnostics, and conditional animation-frame redraws.
- `map-renderer-parity.js` - Deterministic renderer fixtures and zero-tolerance semantic parity reports shared by the actual DOM adapter and Canvas draw path.
- `map-population-benchmark.js` and `benchmarks/` - Deterministic representative, dense, and mostly-offscreen population fixtures measured in a real browser Canvas.
- `scripts/run-map-benchmark.js` - Quick/full benchmark CLI with stage timings, advisory budgets, and structural invariant checks.
- `RENDERER_PROMOTION_CHECKLIST.md` - Automated, human-review, and release gates retained as the completed promotion record and ongoing regression policy.
- `DESIGN_BIBLE.md` - Story, design goals, current direction, future systems, and open questions.
- `VISUAL_LANGUAGE.md` - Approved map projection, sprite scale, modular creature rendering, palette, and readability contract.
- `CHANGELOG.md` - Milestone-level development history.
- `package.json` - Node/Playwright metadata for local automation.
- `tests/` - Tagged Playwright smoke coverage and focused browser regression suites.

## Saves

Helix Heresy stores local progress in browser `localStorage`. Launching the game opens a new/load choice instead of automatically loading the last save. Saves can also be exported and imported as JSON files from inside the game.

## Development Notes

- Keep the game runtime dependency-free unless a feature clearly needs a library.
- Preserve the discovery loop by avoiding public documentation of exact trait outcomes or hidden gene mappings.
- Favor small commits after meaningful feature passes or bug fixes.
- This is a prototype, so systems may be renamed or reshaped as the design becomes clearer.
- Do not update the changelog for every prototype tweak; reserve it for milestone-ready versions.
