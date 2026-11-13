# Individual beast behavior

Completed #3.38-C consumes the fixed 24-species capability matrix through shared
combat, perception, physical movement, injury, needs and finite environmental
work. It adds no species, creation recipe, blanket allegiance or replacement
encounters. [BEAST_BODIES.md](BEAST_BODIES.md) defines the physical foundation.

## Authored capabilities

| Creature | Consumed individual behavior and limits |
| --- | --- |
| Ashhorn Behemoth | Effort-limited charge; finite hot horns vitrify actual contacting soil. |
| Glasswing Roc | Sunlight or genuinely witnessed radiant releases fund bounded pinion focusing; ordinary talon hunting. |
| Mire Choir | Actual nearby audible members each fund a resisted temporary chorus; finite wetland tending. |
| Nullmaw Stalker | Perceived-prey hunting in existing null conditions, not a newly emitted null aura. |
| Thunderback Grazer | Physical charge and finite stored electrical discharge; grounding dissipates energy. |
| Candlecap Myriapod | Disturbance burns actual crown tissue with oxygen, heat, smoke, ash and short paid light. |
| Ironroot Colossus | Rooted water/mineral/biomass transfers stabilize soil and grow cover; actual armor and territorial defense. |
| Gloam Prowler | Paid short blinks to personally known clear ground; full body, intervening barriers and wards matter. |
| Rimefang Pack | Paid cold strikes, finite freezing tracks and iced real kills; thaw and spoilage remain consequential. |
| Sunspine Basilisk | Interrupted or paid radiant fan display applies shared heat injury and resisted temporary paralysis, not petrification. |
| Ley Manta | Finite excess-mana filtering and defended local lanes against actually sensed incursions. |
| Carrion Lantern | Real scavenging supplies finite corpse-light; uncertain attention cues for vulnerable observers, never soul theft or compulsory player movement. |
| Brine Cathedral | Actual plankton filtration and shelter; surviving feeding towers scale one superorganism's throughput, not cloned polyp populations. |
| Reef Wyrm | Real reef substrate/calcium/organic growth and defended local nesting habitat. |
| Abyssal Bell | Paid underwater pressure pulse and depth lure; autonomous swimmers can investigate, suffer actual pressure and learn to escape. The player is not forcibly moved. |
| Frostwake Leviathan | Finite paid ice wake from existing water, later thaw; existing physical ice-breaking remains. |
| Marsh Hydra | Separate head sensing/memories; days of food/mana-funded regrowth, without copying destroyed memories or resurrecting a dead whole body. |
| Rivercoil | Existing flow and construction material fund dams, retained water, spill and possible downstream/flood damage. |
| Ember Ant | Actual foraging, local chemical trails, paid furnace materials and original colony/queen/male roles. Workers do not reproduce. |
| Dreaming Tortoise | Consenting actual sleepers and finite atmospheric moisture fund local weather tending; shared rest can be refused and gives no allegiance. |
| Mirror Ape | Original climbing, one-observation paid Soul Lash imitation and compacts; physical carried tools add bounded strikes and wear into real remnants. |
| Gravebloom Elk | Existing carrion, water and living bloom sites fund growth, nutrients and finite real illumination. |
| Storm Kite | Actual atmospheric electrical intake and finite discharge; known calm grounds and agitates rather than pacifies it. |
| Burrowing Furnace | Finite heat, actual geological gas/materials, bearing loss and possible collapse; no invented ore or infinite tunnel. |

The runtime action registry is consumed by local AI, not merely displayed in the
catalog. Shared damage, guarding, accuracy, incapacity, movement, map lighting and
environmental effects use actual outcomes. A severed required part, blocked reach,
wrong medium, missing supply, distraction or interrupted preparation can prevent
release; already spent costs are not refunded. Ordinary physical strikes remain
available where appropriate. Existing Soul Lash still has its separate 48-point
pool and twelve-point releases, with no passive replenishment here.

## Needs, growth and recruitment

The ongoing D integration also consumes shared local predation rules in
`beast-predation.js`: finite sensed-prey pursuits use ordinary physical combat;
Carrion Lanterns scavenge rather than initiate hunts. Actual carcasses share one
eating/decomposition ledger, with timed feeding, physical approach/descent and
no duplicate meat stock. See [population status](BEAST_POPULATIONS.md) for the
original-body handoff and the still-unfinished generated regional integration.

`creature-life.js` consumes the approved numeric life histories. Actual compatible
food, water and minerals leave finite local stocks, enter body stores/mass and
become recorded outputs. Fat and water initially belong to the original body,
not extra source mass. Unsupplied needs cause harm; supplied stationary rest
recovers finite stamina. Growth partitions actually eaten matter and changes
physical dimensions; merely reaching an age threshold does not supply an adult
body. Juveniles do not inherit free adult mana, charge or memories.

Natural reproductive opportunities accrue over eligible attended time. Age,
actual structure, health, willingness, season, habitat, real reachable mates or
colony roles, cooldown and incubation constrain attempts. Saved seeded outcomes
do not reroll on reload. Incubation transfers actual parent matter/mana; blocked
births retain unfinished investment. Stable child identities and source/parent
references survive saves; fragments partition existing mass, not cloned adults.

The full 36-entry dataset remains in the spreadsheet. Existing scientist/civic,
slime/genome and laboratory-family care/formation retain their original owners;
this engine does not charge them again or invent homunculus fertility. Hauntbound
are nonreproductive. Natural elemental/mineral recruitment requires finite actual
formation sites, not adult-parent fertility: original regional site allocation,
cohorts and background hazards belong to D. No new automatic core-family wild
population or natural formation recipe is supplied by C.

## Ecology, knowledge and persistence

`beast-habitat.js` transfers actual water, nutrients, biomass, construction matter,
heat and pollutants. Published daily ecological coefficients are initial
throughput ceilings, never free restoration. Applicable condition ledgers also
need an actual affected area; local work without that account still transfers
physical stocks, not imaginary regional points. Tower/member throughput is
counted once. Hunting changes real prey pressure without duplicate repair credit.
Ecological opponents require perceived actual local harmful activity and a viable
matchup, not two friendly/moral factions or automatic remote defense.

Memories belong to the sensing individual or surviving head. Pack reports require
actual local communication and retain their source/date. Instinctive migration
choices retain traditional destinations despite hidden shortages; forced
nonmigratory dispersal has no destination-capacity oracle. The choice helper
does not itself spawn or relocate a regional group. Soulless bodies can execute
received orders but do not initiate hunting, feeding, learning or cooperation.
Slimes' existing noncommunication/noncooperation remains unchanged.

Partial actions, spent energy, bodily conditions, private memories, material
transfers, regrowth and local offspring persist through save/load and continued
imports. Observations reveal only actually witnessed, dated outcomes, not private
reserves. Reads do not perform work. Unattended local actors do not receive
catch-up work or attacks; irreversible scientist death freezes these consumers.

## Boundary and verification

Only the existing Rimefang, Gravebloom Elk and Mirror Ape sources currently have
their original population-encounter consumers. The other local profiles remain
contact-only until D allocates conserved original populations and appropriate
habitats/groups. Original-source test preparation is not ordinary-play acquisition.
D also owns once-per-calendar-month planning, gradual resident effects, source-backed
integer cohorts, staggered knowledge-limited migration, seasonal regional balancing,
actual defeat/exhaustion/recovery and strategic outcomes. No new prompt is needed.

Authored sources are `scripts/creature-lifecycle-data.js` and
`scripts/creature-ecology-design.js`. Run `node scripts/build-creature-biology.js`
to publish their dependency-free browser snapshot, then the documented
[spreadsheet build](reference/README.md) for ODS/XLSX/CSV and reference tables.
Model parity tests reject a stale browser snapshot.

Focused coverage includes all 24 capability registrations, all 36 data profiles,
finite costs/transfers, actual consumed abilities, interruption, agency, private
knowledge, starvation, growth/recruitment, persistent damage and source identity.
DOM and Canvas browser cases run autonomous paid fan preparation/release, actual
shared hits, resource-backed bloom work, partial saves/continued imports and final
death freeze; shared physical and existing wilderness cases cover integration.
These are focused checks, not a full regression-suite claim.
