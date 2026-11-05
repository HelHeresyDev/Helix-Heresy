# Pending Prompts

This is the finite remaining queue, not an implementation diary or a source of automatically expanding prerequisites. Completed-work details are preserved in [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md), [README.md](README.md) and [DOMINATION_COMPLETION_PATH.md](DOMINATION_COMPLETION_PATH.md). Worldbuilding remains in [the design bible](reference/DESIGN_BIBLE.md). Historical “next discussion” instructions are superseded by this file.

## Queue rules and stopping conditions

- Discuss the selected work package before implementing gameplay, and wait for explicit developer approval. Questions should include a recommended answer and brief reasoning. This queue update does not approve the gameplay designs below.
- The queue retains **17 work packages: 6 proposed Tier 0 creature packages awaiting design approval, 11 indefinitely deferred packages, and separately 6 conditional/optional packages**. IDs identify work, not software versions. A package can take several sessions; continuing it does not create another pending prompt.
- **Do not append or subdivide the queue automatically.** Bugs, interruption cases, missing adapters, documentation and focused tests needed to deliver an entry stay inside that entry. Do not turn each official, material, species, spell, report, permission or save edge case into another prompt.
- A genuine scope change requires a concrete explanation and explicit developer approval to replace, expand or defer a named entry. Record the tradeoff here; do not silently add a follow-up or claim unfinished work is complete. There is no automatic discovery backlog.
- Freeze each package's acceptance checklist during its design discussion. Once it passes, remove the package from this active file, update remaining counts/dependencies, and put useful completion notes in the history or feature documentation. Do not append another “completed bounded slice, but next…” paragraph here.
- Completed systems are inputs, not prerequisites to implement again. Extend shared behavior rather than inventing another certificate, confirmation hearing or upkeep variant. No additional review/certification stage may be inserted after final acceptance.
- Optional routes stay optional. If a particular generated original genuinely makes one necessary, name that dependency within the existing packages; do not make every optional branch compulsory for every run.
- Missing facts remain unverified. A finite roadmap is not permission to delete original powers, trim the world, invent consent, equate silence with safety or award an unobtainable accomplishment. If a fixed checklist cannot be met, report the exact blocker and request a scope decision instead of minting another prompt.
- Follow `AGENTS.md`: focused tests only, including before commits/pushes. Use deterministic model checks and actual relevant gameplay/save-load checks; Canvas/DOM coverage is required where physical presentation changes. Do not require the full suite.
- Keep simulation renderer-neutral, Canvas physical/strategic rendering and HTML interfaces, with the DOM Compatibility Map retained. Prototype legacy-save compatibility is not a default requirement; new state must still survive normal saves and continued imports correctly.

## World and run constraints

These apply to every package; they are not additional work items.

- Reuse the named finite geodesic world and its causal pre-run history. New runs in the same world are independent branches; mutable laboratories, people, losses, authority and discoveries never write back into the reusable world.
- Preserve independent sovereign anchor cities. Joint route strongholds have exactly two sponsors, local administration and no independent sovereignty. Internet connectivity does not provide physical logistics, consent, knowledge, police powers or government.
- Preserve original identities, actual people/property, finite resources, source provenance, physical reach, independent agency, ordinary combat and persistent consequences. Orders and signatures are not performed work or permanent allegiance.
- The fixed authored beast catalog exists in every world; populations and distribution vary. Slimes cannot communicate or cooperate. Homunculi remain difficult, risky stage-two/three creations, not early armies.
- Gods are real; the heretical scientist rarely receives endorsement. Practical nonintervention, endorsement and submission are different. Descent is not death; living descended individuals remain powerful. True death, new ascendants and independent obligations retain their actual causes and identities.
- Preserve Madcap, Grim and Unbound content selection without turning theme into a legality or difficulty score. Keep player knowledge separate from private simulation; no hidden rosters, census, qualification timer or unrestricted maps may leak through UI.
- Ambitions overlap, rather than forming compulsory chapters. Only irreversible death ends a run; supported late-game soul-beacon recovery remains distinct from permanent soul storage and cannot undo soul destruction. Custody, lost cities, failed foundations and defeated campaigns do not end a living run.

## Order and current state

**#1, #4, #6, #7 and #8-A–D are complete and removed. Next discussion: #8-E Sporecap.** Existing formation behavior is in [CREATURE_FORMATION.md](CREATURE_FORMATION.md); the current-inventory art contract is in `assets/sprites/production/README.md` and accessibility limits remain in `ACCESSIBILITY.md`. The six packages below do not reactivate #2/#3, the natural-beast workstream or #5 tutorial. Those remain indefinitely deferred; conditional/optional routes require explicit selection. Completed art is not reopened and new cosmetic prompts are not automatic.

**#2/#3 and the associated beast workstream remain deferred indefinitely, not complete.** The developer explicitly rejected continuing domination. Preserve existing implementation, but do not resume its requirements, preparation or acceptance checks unless explicitly asked. Completing #1 neither closes domination nor authorizes returning to it. The old domination-first order is superseded.

Already complete: existing civic/succession/upkeep routes, concurrent home/regional government, bounded institutional outcomes, confirmed-branch and descended ordinary correspondence, private three-day qualification history, laboratory records assessment, historical city-rule evidence, and the implemented Rimefang/Gravebloom Elk/Mirror Ape consumers. Do not repeat these. **World domination is still not an obtainable full-game accomplishment.**

## 8. Tier 0 creature research and synthesis — six remaining proposed packages

**E–J remain proposals requiring their own discussions.** Source ideas were reviewed from `CREATURE_TIER0_PENDING_PROMPTS(1).md`; its old ten-item queue assumptions and automatic-splitting directions do not apply. Keep these packages finite: necessary infrastructure, testing, fixes and identification cues stay inside their owning entry, without automatic subprompts, framework demos, certification passes or a new art queue.

Reuse the existing shared formation contracts and appropriate existing apparatus; the remaining six creatures retain their own endpoints. **Every creatable creature has a naturally existing base form and a natural formation/development process. No one, not even a god, can invent new kinds of creatures at will.** The scientist manipulates those natural processes. Engineered variants need not occur naturally: a ten-legged, saber-toothed dog is a modification of a naturally existing dog family, not life invented from nothing. This also settles natural existence for any approved Ragkin, Bone Skitter and other construct; an existing crafting tradition alone is not enough. Each row owns its natural base-family/world-context and formation-method definition, including the actual conditions under which cloth or bones naturally animate. Integrate the minimum approved authored base-family representation without turning these rows into the deferred 24-species strategic encounter/ecosystem program or inventing sightings/populations in immutable archived worlds. Proposed names and research ratings remain subject to their design discussions.

### Shared scope and guardrails

- Separate **Research Tier** (difficulty of discovering a reproducible formation method) from **Synthesis Tier** (practical production complexity once that method is known). The six remaining proposed additions are Synthesis Tier 0; the research ratings below are tentative. Neither tier measures combat power, cognition, rarity, morality, obedience or allegiance. Actual evidence, skills, supplies, apparatus and environment determine readiness rather than compulsory campaign chapters.
- Tier 0 means affordable, comparatively simple repeatable production, not free construction or zero upkeep. Distinguish production equipment cost, recipe consumables and continuing care. Biological, botanical, fungal, elemental, umbral, luminous and construct methods need not share biomass, genes or machinery. Preserve the established slime genome, synthesis tube and discovery pathway; do not relabel arcane patterns as 26-base genomes or force every nonbiological species through an elemental chamber.
- An arcane pattern is a saved researched formation procedure with a small finite set of experimentally testable properties, revisions, observations and uncertainty, not unlimited designer sliders or an instantly known recipe. Its formation and maintenance obey the family's authored material/energy rules. Reuse current utilities, physical stock/custody, research, tasks, environmental readings, bodies, perception, injury and containment wherever compatible; do not make each creature contingent on a complete global fluid, optical, disease or ecosystem simulator.
- **Confirmed creation-window soul rule:** future artificial formation, including slimes and homunculi, requires a sufficiently supplied animancy device gathering the requisite soul energy during formation for the creature to acquire its own soul. Without that participation the artificial result is soulless; a completed soulless creature cannot receive its own soul afterward. No captured donor identity, targeted soul selection, obedience switch or unexplained acceptance roll is implied. Preserve the original formation record; current soul damage, loss or destruction is distinct from changing that historical record. Existing individuals retain their identities, souls and earned history. Ordinary modification of an already living creature is not creation of a replacement identity or a soul retrofit.
- **Confirmed starting equipment:** the original scientist left the creation-time animancy device in the starting laboratory. It is available from the beginning, not a later invention, purchase or research unlock for the clone. Reuse its implemented ordinary operation and finite fuel; do not introduce a contrived broken-device/reconstruction prerequisite. Inherited capability does not grant full theoretical understanding, advanced creature methods or late-game resurrection; the creation device is distinct from soul beacons and transfer apparatus.
- **Confirmed will/control distinction:** soulless constructs can follow orders, but cannot initiate independent action, choose their own goals, develop motivation or level up. Hunger does not make an unordered construct seek food or eat; it can starve despite accessible food. Feeding, movement, maintenance and other actions must be traceable to actual received orders and the supported controller/execution mechanism. Do not silently add self-care, idle wandering, autonomous work or self-preservation. Passive physics, metabolism and damage still occur without being voluntary actions. Resolve any standing/conditional-order syntax within the relevant design, not through unapproved autonomous AI. Soul-bearing creatures have independent will and leveling eligibility, not automatic speech, intellect, loyalty, consent or tools. Slimes remain incapable of communication/cooperation; construct order-following is not permission to command slimes.
- Astral projection/possession is conceptually distinct from a host acquiring its own soul. Do not assume this is an already implemented player power or make a new possession system a prerequisite to these packages. Existing late-game soul-beacon resurrection is not ordinary creature creation, and an empty receiving body is not a license to overwrite a person.
- The proposed divine ban must be distinguished from actual city-local legal classification, offenses and enforcement. Reuse supported laws, authenticated reports, witnesses and jurisdiction; do not automatically notify gods/authorities about hidden creation, infer criminal guilt from species/material alone, or invent universal penalties. Do not turn theme into legality or change generated law by assertion.
- Each creature needs one persistent physical identity/body or bounded coherent structure, finite inputs and sustenance, a supported manipulation of its natural creation process, observable evidence, meaningful containment/hazards, and at least one distinctive player-observable interaction. Synthesis supplies neither a new life principle nor matter/energy from nothing. Useful physical effects do not grant worker status or permission. Any cooperation or ordered handling included in an entry must fit that entry's explicitly approved cognition/control design, not create an automatic later jobs prompt.
- No automatic infinite reproduction, free material/energy, automatic new populations, omniscient detection or unrestricted phasing/hauling. Growth/repair uses actual sources. "No biomass" means no mandatory generic biological-growth feedstock, **not** that cloth, charcoal, plants or animal bones have no material/biological provenance. Bone Skitter uses real animal remains and does not resurrect their former owner.

### Shared contracts and remaining family-specific decisions

The shared decisions above are settled; do not reopen them as unanswered acquisition, lab-only-population or autonomous-reflex questions. Reuse the implemented creation-window, will-dependent progression and inherited-animancy contracts without stripping existing individuals. Keep advanced homunculus growth and late soul-beacon recovery difficult and distinct; a receiving body must not acquire an independent new soul merely because the inherited creation device exists nearby.

Natural existence is settled for every creatable base form, including constructs; do not reopen it as an unanswered natural-versus-man-made-origin question or add an exception for divine creators. The specific natural formation conditions, per-family order channels, executable instructions, physical constraints and any standing-order form still need their ordinary design approval. Those are details inside the six remaining packages, not new origin-approval or ecosystem prerequisites.

### Finite package order and endpoints

Every row requires its own design discussion and explicit implementation approval. Reuse existing foundation/apparatus behavior; there are no additional standalone foundation/apparatus packages.

| ID | Proposed creature / research tier | Creation basis and fixed distinctive endpoint |
| --- | --- | --- |
| 8-E | **Sporecap** — Research 0 | Use spores, damp compost, water and fungal material. Start with one persistent fruiting body and bounded connected mycelial support. Consume a real small organic-waste portion into traceable decomposition products and produce an observable local spore/cleanliness consequence. Distinguish spore residue from viable offspring; no automatic colony expansion, disease system or reproduction program. |
| 8-F | **Ragkin** — Research 1 | Physically assemble fabric, thread and stuffing with a researched animation sigil/process, not elemental convergence or retroactive soul imbuement. Demonstrate cloth-specific movement and persistent seam wear/repair, carrying limits and flammability. A tiny-object interaction is allowed only within explicitly approved automatic control or cognition/consent limits. No cheap intelligent workforce inferred from its silhouette. |
| 8-G | **Shardling** — Research 1 | Assemble common quartz/minerals, salts and finite mana into a rigid faceted articulated structure. Demonstrate a bounded local light/refraction interaction and persistent impact/fracture consequences. Repair/accretion requires actual mineral stock, time and suitable conditions. No free mineral growth, global ray-tracing prerequisite or undiscovered-map illumination. |
| 8-H | **Shadelet** — Research 2 | Research a stable umbral pattern and create it from modest mana in a suitably dark field, with no required biomass, corpse or captured soul. Demonstrate testable low-light stability/concealment and illumination/mana-disruption limits, normal spatial boundaries and finite sustenance. It is not automatically a ghost, a reclaimed dead identity, a wall-phasing unit or perfectly invisible. |
| 8-I | **Lantern Wisp** — Research 2 | Use common luminous reagent, mana and a suitable inexpensive focusing process; approve its own method rather than declaring every magical being elemental. Demonstrate local light, finite stored/sustaining energy, depletion and physical fragility/exposure risk. Walls, perception and known information still constrain its usefulness; no free permanent lantern, automatic guiding agreement or ghost origin. |
| 8-J | **Bone Skitter** — Research 1 | Assemble sourced cleaned animal bones, credible joints/bindings and an animation sigil/process. Demonstrate articulated movement, distinctive blunt-force joint breakage and repair using real replacement elements. Preserve remains provenance and physical custody; animation does not restore the animal's identity/soul or automatically establish a universal necromancy offense. Any programmed or cooperative interaction stays within its approved control model. |

### Common acceptance and stopping condition

For each approved row, finish its real research/creation/care/containment loop and the listed distinctive behavior using saved original inputs, finite apparatus/services, ordinary physical custody and player-observed evidence. Identify its world-existing base family, manipulated natural formation process and distinction between natural and engineered variants. Check successful formation, interruption/failure and retained physical consequences, the creation-window and will distinction, injury/death where supported, save/load/continued import, and appropriate Canvas/DOM identification. Include an inherited-device soul-bearing formation and an unassisted soulless result; order-capable soulless constructs must remain inactive without orders and fail to feed themselves despite hunger/available food unless ordered. Save received instructions and interrupted execution, not fabricated independent intent. Soul-bearing checks require the actual animancy process, not injected success; a deferred or unsupported path must be disclosed rather than claimed complete. Existing slime communication/cooperation limits and late homunculus difficulty remain intact.

Focused checks and necessary fixes belong to that row. Close and remove the row when its frozen scope passes; completing 8-J closes this ten-package program without an automatic second roster, general ecosystem integration, species-specific certificate or post-roster art/tutorial pass. Future scope changes require explicit developer direction.

## 2. Organized opposition and occupation — deferred with #3

**Stopped by developer direction.** The former approved scope below is retained as unfinished reference, not authorization to continue. Do not resume this work through #1 or create replacement prompts for it.

Activate only for a concrete city-control route required by 3.35d-A or explicitly selected by the developer. Complete a shared continuing-control loop: source-backed opposing actors, actual capable consenting enforcement, ordinary combat/withdrawal, supplied occupation where used, and consequential revolt/recovery. Reuse existing civic people, duties, upkeep, religious interests, laws and role-specific objections; passive installation-access orders grant no armed powers.

Done when the selected route can actually gain, maintain and lose enforceable control while retaining people, injuries, rights, stock and dated knowledge. No free army, automatic surrender, nation-state, universal religious approval or repeated office-by-office prerequisite chain.

Former approved scope: address the original collective-government refusal demonstrated at Lumenwell/Lumengate. Refusal persists independently of coercive control. Personal force or a separately consented offensive agreement must use actual finite original people, equipment, wages, transport and supplies; existing defensive contracts gain no assault authority. Relevant original government/defense capabilities constrain city control, not merely a reception guard. Occupation preserves independent civic staffing, property, faith, casualties and surviving opposition; actual supplied enforceability can be lost and recovered. No beast development, general army-management expansion or compulsory god-killing; this does not replace the separate nonmilitary acceptance route. Do not use this deferred scope to expand the independently selected #1.

Frozen acceptance: (1) earn and physically assemble a capable force through ordinary play in a normally generated world; (2) gain and sustain control of a refusing collective city without deleting its original people/resources/relevant defenses; (3) demonstrate concurrent operation and consequential loss/recovery; (4) preserve refusal, casualties, spending and control through saves/continued imports, with focused model and DOM/Canvas checks. Do not remove this entry or close A on model-only or prepared-source evidence.

Implementation is partial, not complete: separately consented original-team local preparation/muster, finite escrow/duty/provisions, heard hold/follow/withdrawal, physical return and source-account persistence are implemented. This supplies no executable city assault or control grant. Whole-city defense/control, supplied enforceability and the remaining acquisition/acceptance requirements are deferred. Do not continue them without an explicit developer request to resume #2/#3.

## 3. Strategic Expansion and World Domination — deferred indefinitely

**Not active.** All six closeout packages and their unfinished acceptance requirements below are retained only as reference. They neither block #1 nor authorize further implementation, audits, discussions or prerequisite work. Resume only on explicit developer request.

The scope is the **current generator's original sovereign cities and strategic beast, institutional and divine sources**, including supported run-time additions. It is not every imaginable future creature, spell, vehicle, office or mission. During A–D design, bind every current source family and known coverage gap to these existing entries. That is an acceptance matrix inside the work, not another audit prompt or an excuse to restart completed consumers.

Durable supremacy still requires three continuous game days of actual viable government and resolved capable/willing counterpressure, concurrent with local operation. Empty wilderness need not be occupied; forts/satellites are not extra sovereign targets. At least one functioning governed city must remain. Direct government, enforceable client/tribute arrangements or genuine voluntary submission can qualify; trade, popularity, temporary mutual defense and technical influence alone cannot. Divine supremacy is not required.

### 3.35d-A. Close remaining sovereign-city coverage

Finish integration of original city/government states not handled by the completed direct-government bridge: applicable collective/combined authority, contested or displaced claimants, and supported lifecycle changes. The former #1 civic appointment package is closed; do not reopen it or create replacement appointment prompts automatically. #2 remains deferred. Preserve each city's identity, local provisioning, defense, opposition and continuity; do not require every optional takeover method.

Done when every city family emitted by the current generator has an actual governable/control or genuinely supported lifecycle path, and missing/contested authority cannot qualify. Demonstrate concurrent operation and loss/recovery through real source-backed city work. Do not rebuild the existing multi-city bridge or historical city-report system.

**Deferred and incomplete; do not continue unless the developer explicitly resumes #3.** Paid original city/institution/satellite recovery and source-backed local transport address the tested generated world's operating-adapter gaps. Current claimant channels derive from real refugee admissions and finite host resources. Ordinary political reception, separate controller releases and supported client-to-direct handovers preserve original accounts, spending and historical receipts; actual current role consent remains necessary. Cities without usable agricultural satellites can now operate from their finite original buffer and actually carried/admitted food, with shared commercial harvest excluded once and real shortage/recovery. Approved staged bulk procurement now connects supported governed neighbors through their actual jointly sponsored forts: finite supplier surplus, price/prepaid limits, the same original fleet/relief drivers, physical paid fuel custody, supplied rest, intake and return; cancellation retains paid cargo. This closes that bounded implementation, not universal logistical reach. Remaining generated-family reachability/control, wider supply reach/capacity and source-required officeholder integration are unverified and deferred. Missing host/contact support remains unresolved; a historical broadcast hook is not a current allocation. The fourteen-city source-recovery matrix, bounded bulk corridor and prepared-source native scenarios do not establish every generated family's full-game route. These deferred checks do not reopen completed #1.

**Former dependency—now deferred:** #2 previously owned the collective-refusal control case. The normal `charter-foundation` world has four initially supported municipal Chemistry Front starts, all in Lumengate or Lumenwell. Both original collective governments refuse voluntary submission, and neither supports the existing individual-ruler designation route. Actual zero-cash laboratory play earned the municipal fare and physically reached Lumenwell's original counter, where attended deliberation confirmed refusal without creating control. The earlier bulk corridor's prepared counter inputs do not establish ordinary-play acquisition. These unfinished requirements are deferred; #1 was completed independently and does not finish A.

### 3.35d-B. Close institutional strategic-capability coverage

Complete existing organizational outcome adapters for the current network/asset families, independent commands, claims and exceptional means. Separate real owner allocations and current ability/willingness/reach from advertised capability sites. Missing original manifests needed for assessment are part of this package, not a new mission-per-asset series. Reuse actual service, withdrawal, deployment and physical-counter consumers; advanced optional mission content remains 3.37.

Done when all current institutional source families can produce source-backed strategic facts, including real constraints or supported incapacity where applicable, with meaningful player actions to resolve actual opposition. Unsupported evidence stays unknown. Site labels, missing data, ordinary contracts and silence never certify harmlessness; resolving this package must not depend on implementing every optional space mission.

### 3.35d-C. Close divine terrestrial-counterpressure coverage

Complete remaining human-known, beast-only/no-contact and living-descended source cases as one shared strategic-capability/constraint system. Reuse original reserves, attention, communication and actual reach, existing offers/refusals, witnessed incidents and independent prior obligations. Supported inability or unwillingness must have a real cause; not every god needs a human mailbox, protective avatar or a personal bargain with the scientist.

Done when current original divine source families have actual supported terrestrial counterpressure outcomes and actionable responses/constraints, without a separate contact mission for each individual. Rare vengeful/oppressed/nihilistic support stays possible, not universal. No friendly-silence proof, automatic endorsement, god-killing prerequisite or private pantheon disclosure. Divine true-body domination remains #4, not an endlessly expanding prerequisite here.

### 3.35d-D. Integrate completed natural-beast strategic outcomes

**Blocked on the approved completion of 3.38-A–D below; no beast creation/encounter implementation occurs in this package.** Connect that work's actual population identity, movement/reach, ability/willingness and supported military/nonmilitary outcomes to the existing evaluator and source continuity.

Done when the fixed catalog's original populations remain conserved and assessable on their actual strategic means. Individual victories, safe deliveries, habitat boundaries, small contact groups and species labels cannot stand for a whole population. This is one integration package, not another series of species, movement, spell or encounter prompts.

### 3.35d-E. Complete legitimate common-interval evidence

Extend the completed historical-city record pattern to B–D's actual supported source accounts and A's remaining applicable city cases. Reports must identify issuer, exact scope, performed interval, observation and receipt dates, gaps and contradictions. Use existing legitimate physical observation/communications and the existing held-record review/workbench; no global clerk, certification quest, hidden-roster disclosure or universal information purchase.

Done when acquired accounts can substantiate the same real qualifying interval across the required original scope, including late receipt after later loss. Promised treaty duration, spaced snapshots and the private evaluator archive do not supply performance evidence. Identical held records must yield identical knowledge despite opposite hidden states. Do not redo completed city-history retention or add separate report/certification prompts after this package.

### 3.35d-F. Award, continued play and final acceptance; close #3

Depends on A–E and required 3.38 outcomes. Connect genuine supported private qualification plus E's legitimate knowledge handoff to one campaign accomplishment with separate achieved/recognized dates and theme-selected narration. Later loss changes current operability without deleting the past achievement; ordinary management, diplomacy, opposition and recovery continue. Divine supremacy remains separate and no victory ends a living run.

The fixed acceptance checklist is:

1. A complete military qualifying route in a normally generated world, through actual owner actions rather than injected success flags.
2. A complete nonmilitary qualifying route in a normally generated world, without mandatory god endorsement, homunculi, new-city founding or every optional mission.
3. Supply, authority, strategic counterpower and evidence-gap failures prevent premature recognition; no empty-world, deleted-source or trimmed-roster success.
4. Delayed legitimate recognition, subsequent loss/recovery and continued play retain the correct historical accomplishment and current condition separately.
5. Real save/load, continued import, independent same-world restart and irreversible-death/postmortem behavior work. Soul-beacon recovery retains its existing rules.

Run named focused checks for those outcomes, not the full suite. **Passing this checklist closes #3. There is no follow-up generic audit, certification stage or “one more consumer” prompt.** A failed check is unfinished work in its owning A–F package, not a new queue entry.

## 3.38. Natural beast creation and encounters — deferred with the #3 workstream

This remains the separately discussed beast workstream requested by the developer, not authorization to resume Carrion Lantern work now. The boundary is the **24 currently authored species in `strategic-beast-ecology.js`**, preserving completed Rimefang, Gravebloom Elk and Mirror Ape behavior. New species or unrelated abilities require an explicit later scope decision, not automatic additions here. Every species still exists in every newly generated world with randomized populations/distribution.

### 3.38-A. Approve the fixed biology and capability matrix

Discuss all current species together: body/scale, locomotion, senses, needs, social intelligence, finite resources, authored core abilities, ecological behavior and encounter/strategic relevance. Include the deferred Carrion Lantern corpse-light/scavenging design. Freeze the finite trait/ability checklist and map it to B–D; do not create one prompt per species or power. This is a design deliverable, not permission to invent endless extra biology.

### 3.38-B. Implement shared bodies, movement and environmental reach

Implement the matrix's remaining physical families together: flight/levitation, aquatic/amphibious/drifting movement, burrowing, colossal footprints, colonies/swarms/superorganisms and necessary habitat/terrain interactions. Extend existing grounded/climbing behavior rather than replacing it. Actual anatomy, occupancy, carrying/reach, perception, fatigue and persistent injury constrain action.

Done when every matrix row uses its real supported physical family with focused representative and catalog-wide contract checks. Shared movement does not require another species-specific movement prompt.

### 3.38-C. Implement authored abilities and ecological/individual behavior

Implement the finite A checklist through shared combat, perception, environmental effects, needs and finite costs, retaining individual learning, agency and supported communication limits. Reuse completed Soul Lash imitation and territorial compacts. Do not expand into every conceivable spell, engineered creation, magical technology or a new mythology catalog.

Done when each approved matrix capability has a working consumed behavior, meaningful limitations and persistence. A missing listed ability remains unfinished C work, not a newly appended prompt.

### 3.38-D. Complete population-backed encounters and strategic outputs

Connect B/C to actual habitat, conserved original populations, appropriate groups/colonies, ordinary travel and supported human logistics. Provide actual military/nonmilitary consequences and legitimate received observations for 3.35d-D/E. Preserve fixed identities, wounds, remains, losses and unlocated capacity; no endless replacement encounters, omniscient census or collective allegiance inferred from one individual.

Done when all current species are represented by the approved matrix, representative physical encounters consume each shared family, strategic outputs cover original source classes, and persistence/death/knowledge boundaries pass focused checks. **Close 3.38 here; remaining integration belongs to the already listed 3.35d-D/E, not new beast prompts.**

## 5. New-run onboarding and contextual tutorial — deferred indefinitely

**Stopped by developer direction, not complete.** Do not build a tutorial before the game systems are implemented. Preserve the scope below for later reconsideration, but do not resume its design, implementation or acceptance work unless the developer explicitly reactivates #5. Completion of other packages does not automatically reactivate it. This deferral neither resumes #2/#3 nor creates additional system-completion prompts.

Implement optional contextual guidance for existing world/site/start choice, discovery, containment, physical map/tasks, research, company/legal and black markets, secrecy, death/recovery/postmortem and independent restart. Use existing actions and knowledge; no free resources, compulsory campaign chapters or artificial unlocks.

Done when a new player can follow and dismiss/resume that fixed introductory path with persistent preferences, keyboard support and correct knowledge limits. Wider feature-specific tutorials are not automatic follow-up prompts.

## Conditional/optional expansion routes — five packages, not the critical path

These preserve existing requested ideas without making them campaign prerequisites. Activate only by explicit developer choice. Each has one endpoint; continuing work inside it does not create more queue entries.

| Existing ID | Fixed scope | Done when |
| --- | --- | --- |
| 3.5 | Extend the existing porter's exact loose-owned-cargo order to an inspected adjoining patch within the existing four-patch graph; unchanged shift, wages, duty, capacity and return rules. | One actual retrieval, interruption and original-person return/report work without new standing labor rights or another engagement ceremony. |
| 3.6 | One physically crafted, carried and deployed ordinary field cache using existing storage/custody. | Later personal retrieval or genuine loss preserves actual contents; no remote inventory, land title, safety, free stock or beacon. |
| 3.31d | Finish successful city founding beyond the completed camp/works/failure branch: real resource purpose, dependable water/food, city-scale construction, lasting protection, finite consenting migration, actual governance and practical support links or a genuine refuge exception. | One genuinely operating run-owned city integrates with existing strategy and can lose support; no miniature-compound city label, spawned citizens or canonical-world mutation. |
| 3.36 | One existing intelligent creation's demonstrated voluntary field duty, actual transport/care and refusal, using current cognition and party-custody systems. | The original creation can perform/refuse that duty with saved needs, training and consequences; no slime cooperation, free seats or early homunculus army. |
| 3.37 | One explicitly selected exceptional mission family using original hardware/body/control manifests, such as an actual launch/payload or exceptional traveler/interception route. | That selected mission has real actors, finite resources, reach, permission and outcomes. It does not require every space technology or become a universal certificate. Minimum institutional assessment gaps are owned by 3.35d-B, not deferred here indefinitely. |
