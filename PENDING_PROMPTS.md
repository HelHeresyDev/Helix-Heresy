# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

When Codex asks design or clarifying questions, each question should include Codex's recommended answer and enough brief reasoning to explain that recommendation. This lets the developer answer "yes" when the recommendation is acceptable and expand only when a different direction is desired. Do not present unanswered questions without also offering a concrete recommendation unless the available information genuinely does not support one.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. World Generation Roadmap, Scope, and Data Model
2. New-Run World Parameters: Biome, City Distance, and Year
3. Starting Site and Nearest City Generation
4. Regional Biomes, Terrain, Resources, and Travel Context
5. Historical Timeline Generation
6. Factions, Institutions, Religions, and Local Law
7. Lazy World Expansion Beyond the Starting Region
8. Worldgen Integration with Markets, Inspections, and Campaign Pressure
9. Explanations, Institutional Escalation, and Consequences
10. Campaign Objectives, Milestones, and End States
11. New-Run Onboarding and Contextual Tutorial
12. Sound Design, Notifications, and Accessibility Audit
13. Production Sprite Replacement and Art-Direction Pass

The intended long-term frontend is hybrid. Canvas should render the physical map, terrain, sprites, animation, lighting, effects, and map overlays. HTML/CSS should continue to render menus, inspectors, records, policies, dialogs, tooltips, and accessibility controls. Simulation state and rules must remain independent of both renderers. Keep the DOM Compatibility Map as a persistent fallback until a future separate removal decision.

---

## 1. World Generation Roadmap, Scope, and Data Model

Design discussion: world generation roadmap, scope, and data model.

Do not make code changes yet.

I want to add Dwarf Fortress-style procedural world generation and historical context to Helix Heresy, but the first pass should not try to build the entire final world simulation at once.

The goal of this prompt is to design the foundation before implementation.

The player should eventually start a run by choosing broad world-start parameters such as:

- starting biome
- distance from the nearest city
- starting year

Example:

The player chooses desert, close to a city, and year 1500. The game then creates the player's starting site, the nearby city within the selected distance band, and enough surrounding regional and historical context for the lab, authorities, markets, laws, inspections, religions, trade, and campaign pressure to feel grounded.

Important direction:

World generation should support the current map-first illegal-lab game rather than becoming a separate disconnected lore toy.

World generation should create saved facts that other systems can cite later: institutions, local laws, city proximity, regional terrain, roads, trade routes, religious pressure, black-market access, public-health concerns, environmental constraints, and relevant historical events.

The world does not need to be fully simulated at run start. Prefer a staged approach where the starting site, nearest city, local region, and compressed historical context are generated first, while distant locations and deeper history can be lazily expanded when needed.

Questions for discussion:

Should the first pass generate only the starting region, or should it create a complete low-detail world map immediately?

Recommended answer: Generate the starting region and a lightweight world shell first. This gives the player meaningful local context without forcing the game to simulate continents before any system uses them.

Should world generation use tiles, regions, nodes, or a hybrid?

Recommended answer: Use a hybrid. Keep the actual playable lab and site tile-based, represent the local region as tiles or coarse map cells, and represent distant cities, factions, and trade routes as nodes until they become relevant.

What data should be saved at world creation?

Recommended answer: Save the world seed, world year, chosen start parameters, starting site record, nearest city record, local region record, known institutions, local laws, generated history summary, and stable IDs for any referenced factions or places.

Which parts should be mechanical immediately?

Recommended answer: Biome, city distance, year, nearest-city profile, local institutions, travel access, supply difficulty, inspection pressure, market access, and environmental constraints should become mechanical. Deep historical flavor can remain mostly descriptive until later passes.

Should history be simulated year-by-year?

Recommended answer: Not in the first pass. Generate a compressed timeline with stable events and causal tags. Later systems can expand individual events if the player encounters them.

How should this interact with existing front-company, investigation, black-market, inspection, and evidence systems?

Recommended answer: Worldgen should provide their context: who the institutions are, why they care, how strict they are, how close they are, what legal cover is plausible, what buyers exist nearby, and how quickly outside pressure can travel.

What should remain out of scope for the first pass?

Recommended answer: Full civilizations, armies, migration, dynasties, individual historical figures, complete world maps, war simulation, full religion simulation, and pathfinding across the entire world should remain out of scope unless they directly affect the starting region.

Design goals:

- Make each run feel like it belongs to a specific place and time.
- Let biome, city distance, and year matter mechanically.
- Create reusable saved world facts instead of one-off flavor text.
- Support markets, inspections, authority pressure, local law, religion, resources, and campaign objectives.
- Build a foundation that can grow toward Dwarf Fortress-style world history without trying to implement the whole thing in one pass.
- Keep the first implementation small enough to test and revise.

Do not modify files until we have agreed on the design and scope.

## 2. New-Run World Parameters: Biome, City Distance, and Year

Design discussion: new-run world parameters.

Do not make code changes yet.

Focus on the start-of-run choices the player should make before the world is generated.

The first player-facing parameters should be:

- starting biome
- distance from the nearest city
- starting year

Biome examples may include desert, forest, swamp, grassland, mountain, tundra, coast, badlands, volcanic region, underground-heavy region, or other fantasy-biological variants.

City distance should use broad readable bands rather than exact micromanagement. For example:

- Inside or adjacent to a city
- Close, roughly 1-10 miles away
- Near, roughly 10-30 miles away
- Remote, roughly 30-100 miles away
- Isolated, more than 100 miles away

Starting year should affect the generated world state, available institutions, legal conditions, technology assumptions, regional history, market maturity, religious pressure, and campaign framing.

Questions for discussion:

Which biome choices should exist in the first implementation?

Recommended answer: Start with a small set that strongly affects gameplay: desert, forest, swamp, mountain, coast, and badlands. Add stranger fantasy biomes later once basic generation works.

Should the player pick an exact year or an era band?

Recommended answer: Let the player type or choose an exact year, but internally map it into era bands for mechanics. This preserves the fantasy of choosing year 1500 without requiring every single year to have unique content.

Should city distance be selected as miles, a band, or both?

Recommended answer: Use bands in the UI, then roll a saved exact distance inside the band. Show both the band and the rolled distance after generation.

Should these parameters replace starting scenarios?

Recommended answer: No. Starting scenarios should remain data-driven packages. World parameters should feed into or modify a scenario rather than replacing the scenario system.

Do not modify files until we have agreed on the design and scope.

## 3. Starting Site and Nearest City Generation

Design discussion: starting site and nearest city generation.

Do not make code changes yet.

Focus on generating the player's starting site and the closest city after the player chooses biome, city distance, and year.

The game should first create the starting tile, then generate the nearest city that fits the chosen distance band. The starting tile should preserve the current playable lab/site model while gaining world context.

Starting site data may include:

- site name or codename
- biome and local terrain
- surface parcel traits
- geology hints
- water access
- road or trail access
- concealment quality
- heat, humidity, light, mana, and contamination background tendencies
- legal cover plausibility
- public visibility
- freight access
- nearest-city direction and distance

Nearest city data may include:

- city name
- population band
- distance and direction from the lab
- dominant institutions
- economic role
- religious character
- law-enforcement strictness
- public-health capacity
- registry bureaucracy
- black-market access
- trade goods and shortages
- recent history relevant to the lab

Questions for discussion:

Should the city be generated before the site, or should the site constrain the city?

Recommended answer: Generate the chosen site first, then generate the nearest city that satisfies the distance band and biome/regional logic. The player's start choice should remain authoritative.

Should the city appear on a world map immediately?

Recommended answer: Show a simple local-region/world-context card first. A visual world map can come later unless the first pass already has a clean place to display it.

Should city distance affect task timing?

Recommended answer: Yes, but gently at first. It should affect market travel, inspection arrival windows, courier timing, emergency response, and supply delivery rather than requiring full world pathfinding.

Do not modify files until we have agreed on the design and scope.

## 4. Regional Biomes, Terrain, Resources, and Travel Context

Design discussion: regional biomes, terrain, resources, and travel context.

Do not make code changes yet.

Focus on how the generated local region affects practical play.

Biome should not be only flavor. It should influence environmental conditions, geology, water access, surface concealment, waste risk, travel reliability, supply availability, legal cover, local species expectations, and evidence persistence.

Examples:

- Desert starts may have heat, water scarcity, visible dust trails, strong sunlight, sparse witnesses, and easier concealment away from roads.
- Swamp starts may have water abundance, decay, disease/public-health concerns, poor roads, strong biological contamination risk, and hidden disposal routes.
- Mountain starts may have strong geology, mining cover, difficult freight, isolated access, and slower inspection response.
- Coastal starts may have trade access, humidity, drainage scrutiny, and smuggling opportunities.
- Forest starts may have biomass, concealment, wildlife cover, fire risk, and seasonal travel problems.

Questions for discussion:

Which biome effects should be implemented first?

Recommended answer: Start with broad modifiers to environment, travel, market access, inspection response, legal cover, and resource abundance. Avoid detailed weather and seasons until later.

Should regional terrain generate exact tiles outside the lab?

Recommended answer: Not yet. Save regional traits and abstract route context first. Generate exact local map tiles only when a system needs them.

How should biome interact with underground geology?

Recommended answer: Biome should influence surface conditions and broad regional geology, while the existing geology system remains the authority for excavated underground details.

Do not modify files until we have agreed on the design and scope.

## 5. Historical Timeline Generation

Design discussion: historical timeline generation.

Do not make code changes yet.

Focus on creating a saved compressed history for the generated world and local region.

The goal is not to simulate every year. The goal is to create enough historical structure that the city, institutions, local laws, religions, market conditions, ruins, old scandals, wars, plagues, forbidden research panics, divine conflicts, and public attitudes feel like they came from a real past.

Timeline events may include:

- city founding
- wars or raids
- religious campaigns
- plague years
- monster outbreaks
- mining booms
- alchemical disasters
- forbidden-biotech scandals
- black-market crackdowns
- registry reforms
- environmental disasters
- divine omens or miracles
- political turnover
- public-health crises
- trade-route changes

Questions for discussion:

Should timeline events be global, regional, local, or all three?

Recommended answer: Use all three labels, but generate only a few events at each scale for the first pass. Local and regional events should matter most.

Should history directly affect gameplay?

Recommended answer: Some events should. For example, a recent monster outbreak can raise inspection aggression, a past alchemical disaster can make public health stricter, and a religious campaign can make animancy suspicion worse.

Should the player see the whole history at start?

Recommended answer: Show a brief known regional history summary. Deeper details can appear in records, rumors, institutional references, and future research.

Do not modify files until we have agreed on the design and scope.

## 6. Factions, Institutions, Religions, and Local Law

Design discussion: factions, institutions, religions, and local law.

Do not make code changes yet.

Focus on generating the organizations and rule systems that make the world react to the player.

Worldgen should create or select local versions of:

- city government
- commercial registry
- public-health authority
- environmental authority
- law enforcement
- religious powers
- licensed waste carriers
- black-market intermediaries
- trade guilds or industrial groups
- nearby noble, civic, or imperial power structures

Local law should explain what is legal, restricted, licensed, suspicious, or heretical in the generated region and year.

Questions for discussion:

Should institutions be unique named entities or generic categories?

Recommended answer: Both. Systems should keep generic roles for mechanics, while worldgen gives each role a generated local name, temperament, jurisdiction, and history.

Should religion be generated now?

Recommended answer: Yes at a light level. Since gods and animancy are central to the premise, local religious pressure should influence law, heresy risk, inspections, rumors, and campaign pressure.

Should laws be exact rule lists?

Recommended answer: Not yet. Start with broad legal pressure tags and institution priorities, then let later systems turn specific tags into formal laws.

Do not modify files until we have agreed on the design and scope.

## 7. Lazy World Expansion Beyond the Starting Region

Design discussion: lazy world expansion beyond the starting region.

Do not make code changes yet.

Focus on how the world should expand after the starting region exists.

The game should not need to generate every city, faction, trade route, religion, and historical figure before the player starts. Distant world details can be generated when they become relevant, as long as they remain deterministic and compatible with already saved facts.

Lazy expansion triggers may include:

- a black-market buyer from another region
- a referral to a new contact
- a regulatory escalation to a higher authority
- a rumor about another city
- a trade shortage
- a future expedition
- a generated historical reference that needs details
- campaign expansion beyond the starting site

Questions for discussion:

Should lazy generation depend only on the world seed?

Recommended answer: It should depend on the world seed plus saved parent context. Once generated, the new location or faction should be saved so later changes do not rewrite history.

How should contradictions be avoided?

Recommended answer: Save generated facts when first referenced, use stable IDs, and require new generation to respect already saved facts.

Should distant regions be visible to the player?

Recommended answer: Only when discovered, referenced, or mechanically relevant. The player does not need a complete atlas on day one.

Do not modify files until we have agreed on the design and scope.

## 8. Worldgen Integration with Markets, Inspections, and Campaign Pressure

Design discussion: worldgen integration with markets, inspections, and campaign pressure.

Do not make code changes yet.

Focus on making generated world facts feed existing systems.

Worldgen should influence:

- black-market contact pools
- lawful commodity demand
- raw material availability
- freight and courier timing
- inspection schedules and strictness
- external detection sources
- authority case thresholds
- religious or heresy scrutiny
- city response time
- cover-company plausibility
- campaign objectives and endings

Questions for discussion:

Which existing systems should worldgen affect first?

Recommended answer: Start with black-market contacts, inspection pressure, legal cover credibility, travel timing, and authority temperament. These already exist and can benefit from generated context without requiring a full world map.

Should worldgen modifiers be hidden?

Recommended answer: Exact numbers should stay hidden, but the player should see qualitative context such as "near a strict registry city," "remote desert freight delays," or "local temple pressure makes animancy rumors dangerous."

Should worldgen change difficulty?

Recommended answer: Yes, but it should be transparent enough that players understand why a chosen start is easier or harder.

Do not modify files until we have agreed on the design and scope.

## 9. Explanations, Institutional Escalation, and Consequences

Let the player answer inquiries with structured factual claims supported or contradicted by saved records, physical conditions, witnesses, and prior statements, with an optional player note that is not mechanically interpreted. Escalate proportionally through follow-up demands, surveillance, fines, restrictions, warrants, seizures, and raids while providing warnings and response windows; reserve final campaign success and failure rules for the campaign-objectives pass.

## 10. Campaign Objectives, Milestones, and End States

Define short-, medium-, and long-term objectives, meaningful setbacks, branching milestones, success states, failure states, and reasons to begin another seeded run.

## 11. New-Run Onboarding and Contextual Tutorial

Teach the core discovery, containment, map, task, and research loops through optional contextual guidance that responds to player actions without obscuring the interface.

## 12. Sound Design, Notifications, and Accessibility Audit

Establish restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard and screen-reader coverage, and a complete accessibility review.

## 13. Production Sprite Replacement and Art-Direction Pass

Replace development placeholders with a coherent first production-quality sprite set while preserving semantic keys, footprint anchors, transforms, glyph fallbacks, and the approved visual language.

This is intentionally deferred until late production. Continue creating coherent placeholder assets when new semantic map objects need them; do not begin the final art-replacement pass merely because placeholders expand.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
