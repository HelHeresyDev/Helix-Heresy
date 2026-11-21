# Regional beast populations — implementation in progress

This is work inside the existing #3.38-D package, not a new prompt or a completion
claim. D remains active and the queue still has eleven packages. Individual
capabilities already implemented by C are described in [BEAST_BEHAVIOR.md](BEAST_BEHAVIOR.md).

## Account model

`beast-populations.js` provides a deterministic internal account model with:

- Original integer cohort membership, compact live ordinal ranges and separate
  detailed-body claims. Detailing removes the same individual from background
  consumption and mortality. Detailed corpses remain with their physical owner;
  they are not also deposited into regional food stocks.
- An explicit supplied calendar with variable month lengths. The 365-day
  demographic denominator is not imposed as the world's calendar year.
- Once-per-month intentions, staggered group departures, travel extending across
  months, residence-dependent consumption and local shortage reactions. Crossing
  a region boundary during travel changes the charged resource account before
  final arrival. The model does not reserve destination food or capacity.
- Shared seasonal transitions in `beast-seasonal-journeys.js`: actual named
  calendar windows, fixed outbound/return itineraries, immediate continuation
  through intermediate waypoints and queued return windows during unfinished
  outbound journeys. Physical obstructions and late arrivals remain failures;
  no invented approach path, teleport or hidden-food rerouting repairs them.
  Seasonal renewal changes at the actual calendar boundary. Saved half-edge
  residence, queued legs and deadlines survive normalization without replanning.
- A choice policy receiving instincts, local neighboring approaches and dated
  personal knowledge, not hidden destination stocks or incoming populations.
  An unsuitable arrival can lead to repeated exploration and real starvation.
- Cached finite resource rates and depletion/reserve-depletion boundaries, rather
  than repeated strategic planning on every call. Reads settle elapsed work but
  do not reroll intentions, change cached rates or award future renewal.
- Background hazards integrated across age bands and old-age doubling, including
  distinct queen hazards. Original small cohorts retain individual event clocks;
  large and generated cohorts use the compact demographic approximation below.
  Explicit predation/combat/scarcity losses remove membership before subsequent
  background hazard processing.
- Original body reserves, finite consumption, retained metabolic outputs and
  timed scarcity harm. Current initial scarcity tuning loses 0.4 normalized
  health per unmet reference daily water ration and 0.1 for food/minerals, after
  compatible body reserves have actually run out. This is calibration, not a new
  general creature-care owner or a change to existing laboratory upkeep.
- Original-source audits, strict saved-state validation, independent run bindings
  and copy-only continued-import rebinding. Invalid records are unavailable, not
  reconstructed as healthy replacements.

Source inputs must explicitly supply real original cohorts, actual regional
stocks/capacities, renewal, traversal edges and the calendar. Generic stock keys
in focused fixtures are not permission to feed a predator plants, renew ore,
invent a hive queen, or generate a natural formation site. The physical source
adapter must establish compatible sources and biological counting units.

## Regional execution clocks

`beast-population-scheduler.js` indexes actual regional residents, cached rates
and next events. A local loss, stock interruption, work-site change or original
body claim settles and rebuilds only the affected physical dependency component,
not every world cohort. Real connected watercourses are conservatively coupled
in both directions; original external nursery/care and named dream-participant
references also couple accounts. Departure, midpoint crossing and arrival settle
their actual endpoint accounts before changing residence. An extinct travelling
group retains its last physical residence rather than reverting to its origin.
Unrelated regions gain no refresh, knowledge, resources or replacement bodies.

The supplied calendar's monthly planning and scheduled daily demographic/food-web
pulses still visit every active original group. This is event localization, not
skipped physiology or reduced populations. A large connected river/care component can still be
expensive. Local contact resolution visits its affected accounts; the scheduled
daily contact search retains its existing bounded spatial index and budgets.

Saved `regionClocks` hold each region's `appliedAt`, `nextEventAt` and daily-work
flag. Root `clock` is processed time; root `appliedAt` is the oldest regional
settlement, **not a claim that every account has the same timestamp**.
`settleRegions` reads selected dependencies; `advance(..., true, true)` explicitly
settles a whole snapshot. Reads of active accounts do not recalculate rates or
reroll choices.
Empty native-source components may retain only original-recipe headers until a
read, arrival or actual dependency requires them. All named beast groups remain
active, including distant ones. Water-linked components, original occupied
nurseries and named dream participants are included at initialization. Before
an empty component joins execution, the same eager engine runs its original
anonymous-wildlife, water, seasonal and ecological history from the epoch to the
actual contact time. It is not reset, refilled, granted food or treated as known
to a migrant. A full diagnostic read explicitly warms every component and can
still be expensive. These headers require their validated original source loader
on restore; they are not standalone complete ecological snapshots.

JSON/continued branches restore recorded rates/times and rebuild only disposable
indexes/queues. Inconsistent coupled clocks and invalid event metadata are
rejected. The cache is a WeakMap; bounded lazy heaps retain event/clock metadata,
not a lifetime list of cohort work. Occasional heap compaction visits clock
metadata only. Whole saves/audits remain proportional to the saved account.

This pass also corrects event-partition-sensitive funding: growth and brood
funding keep their authored full rate until an exact paid target boundary,
including separately completed matter and mana. The former remaining-gap taper
could postpone a brood whenever an unrelated event refreshed its rate. No
incubation, assimilation, source requirement or lifecycle table is shortened;
funding is not a birth, and missing material still stalls recruitment. Old
recorded progress is retained on load, not backfilled. The old global scheduler
also refreshed mass-dependent maintenance whenever *any* region had an event;
the regional scheduler removes that unrelated sampling dependency. Its generated
trajectory is therefore not promised to match that old timing artifact exactly.

## Batched growth, recruitment and mortality

Ordinary insects, small animals and fish now have separate conserved background
guild accounts: see [background wildlife](BACKGROUND_WILDLIFE.md) for quantified
rates, original-matter partitions, paid recruitment, finite density-based
foraging and its approximation boundaries. They share actual regional resources
without adding catalog species or strategic victories. New proposals archive
their allocations; old worlds acquire none on load. The complete 120-day sample
still rejects ecological activation; a prey layer is not a viability certificate.

Monthly per-cohort search/handling/eating/rest budgets now replace the wildlife
layer's daily one-cohort five-minute feeding limit. Local event clocks earn
actual effort and ingest single-owner claimed carcass tissue gradually, including
longer meals and repeated bouts. Independent juveniles can grow from ingested
surplus at the existing paid assimilation rate. Sufficient land/marine prepared
habitats sustain their original feeders across the full seasonal calendar;
insufficient habitats can still cause starvation. See the same wildlife document
for exact budgets, conservation, replay measurements and remaining generated
source failures. Sparse original-beast duels retain their separate rules below.

`beast-demography.js` consumes the existing published lifecycle values without
creating a pregnancy, juvenile actor or death object for every background animal.
Work scales with groups/cohorts, supported activity and interval fragmentation,
not directly with headcount. Named local individuals remain detailed and are
excluded from these background owners.

- Each group saves its reproductive intent and attempt rate once per actual
  calendar month. Aggregate daily physiology boundaries settle earned growth,
  attempt credits and background mortality; incubation, resource depletion and
  actual interruptions add their own boundaries. This is not per-frame strategic
  replanning or an upfront monthly grant. The rate denominator stays 365 elapsed
  game days even with a different supplied calendar year.
- Maintenance has first claim on actual regional stocks/renewal. Surplus compatible
  matter funds growth and incubation gradually, with published assimilation and
  retained growth/reproductive waste. Required activity energy and reproductive
  mana also leave finite sources; energy cannot be a body-matter recipe. Mineral
  bodies require an explicit sourced material mixture rather than generic food.
  Neither age nor elapsed incubation manufactures missing body mass.
- Actual sourced nurseries declare finite receiving capacity, favorable phases
  and local mate access. Eligible original mothers/colony queens, actual mature
  same-group mates and cooldown ranges constrain integer conception batches.
  A queen additionally needs her original same-colony furnace hive. Workers do
  not reproduce. Whole colonial fragmentation partitions existing parental mass;
  environmental/artificial core families keep their existing owners and gain no
  automatic wild formation sites or parental fertility.
- Brood records hold compact parent/success intervals, paid material/mana and a
  due time, not one pregnancy object per parent. Success counts use saved seeded
  stochastic rounding of the published conditional chance. This preserves mean
  rates but deliberately does **not** reproduce independent per-animal variance.
  Newborn batches receive actual newborn mass and append ordinal ranges to stable
  per-group/role identity streams; individual IDs are derived only when needed.
- Killed parents cancel their remaining investment once. Actual destroyed egg/
  fragment nurseries dispose of affected invested material without refunds or
  replacement offspring. Losing a live-bearing nursery does not itself kill a
  mother or erase her funded gestation; missing support prevents completion.
- Compatible generated cohorts merge into age/stage, mass and condition bins.
  Counts, physical mass/stores, parent intervals, paid broods and cooldowns remain
  conserved. Representative age/condition are approximations; earliest/latest
  birth dates remain saved, and maturity/fertility and local handoff use the
  youngest bound rather than prematurely ageing an uncertain member. Already
  detailed bodies and their individual histories are never averaged together.
- Cohorts initially exceeding 128 individuals, and generated birth cohorts,
  settle continuous-hazard survival expectations in batches with a saved seeded
  fractional rounding balance. Large losses remove anonymous ordinal intervals
  and retain compact death/remains summaries, not millions of individual corpse
  records. These summaries retain first/last death dates and total physical mass,
  **not exact individual death times**. They are not omnipresent edible stocks or
  observed casualty reports. Original small-cohort clocks remain unchanged.

`claimLocal` transfers a selected parent's already paid brood progress, attempt
credit and cooldown along with its original body. Background batches immediately
exclude that member. Existing local lifecycle code can continue transferred
broods, and `registerLocalBirth` registers each genuinely emitted physical child
once against the same population. Nursery-bound broods require access to the
original nursery; they cannot teleport with a travelling parent. Missing native
source adapters hold work rather than inventing a supported site. Real nursery
destruction also invalidates its handed-off external broods. These hooks and
their focused handoff checks do not establish full generated-world adoption.

The focused benchmark is `node scripts/benchmark-beast-demography.js`; add
`--long` for 2,400 elapsed game days. It uses explicitly prepared finite supplies,
one or ten independent groups and active growth/reproduction/mortality. It is
not a full-game/world-generation benchmark or proof of ecological balance.
Representative runs of 120 days at 1,000 and 1,000,000 starting bodies each used
roughly 6,000 cohort intervals and tens of milliseconds, with two birth summary
records and four compact death records. The longer run retained hundreds rather
than millions of active cohort records. Wall-clock timing depends on hardware;
focused tests gate structural work/state growth rather than a fragile millisecond
threshold. Detailed encounters and more independent groups still cost more.

## Paid regional maintenance, decline and recovery

`beast-regional-ecology.js` adds an opt-in ecological account to the internal
population model. Ironroot rooting, Thunderback grazing and all eight additional
approved work adapters below now execute against this shared account. Other
species' local C abilities remain intact. Generated-source adoption,
natural formation, ecological opposition and whole-food-web viability are not
established by these workface demonstrations.

Every participating region supplies all six independent condition ledgers:
soil/cover, freshwater quantity, freshwater quality, wetland/reef habitat,
renewable biomass and arcane stability. It also supplies its actual affected
hectares, natural reference conditions, applicable viability floors, original
physical renewal sites and explicit dependencies of usable renewable supplies on
condition. Zero-reference natural terrain does not become exhausted merely for
being a desert or polar region. Missing ecological declarations leave legacy
accounts unchanged, rather than inventing a healthy starting ecology.

Monthly ecological intent names an already known workface, not a hidden future
destination. Actual location, mature physical body, health, willingness, intact
rootable substrate and original shared work-site capacity gate performed work.
Travelling or detailed individuals cannot simultaneously restore the regional
account. The seven local physical recipes are shared through
`beast-habitat.js::workSpec`; filter channels are shared through `filterSpec`.
Rooting consumes water, minerals and organic matter and retains actual rooted
biomass/atmospheric-water outputs. Those outputs are physical retained matter,
not automatically edible regional stock or a replacement renewal site.

Maintenance has first claim on supply. Growth, funded reproduction and ecological
work share a normalized cohort effort budget. There is one work-energy request
per working cohort, shared with demographic work; missing mana/charge cannot
fund an effect. The published daily throughput is the coarse ordinary-rest
approximation, not an extra full day of work added to rest. This is not a native
per-body stamina or combat simulator: detailing transfers the original out of
background work, and native interruptions still need source-backed integration.
The activity request spends real regional energy supply; it does not create a
fresh personal mana reservoir for a subsequent local-body claim.

Grazing pressure uses actual compatible forage consumption and its paid activity,
without consuming that food a second time or granting a positive disposition
bonus. Rooting earns nurturing and incurs its authored destructive side effects
only in the channels its actual recipe supports. Natural renewal, performed
nurturing and destruction have separate cumulative receipts; their net changes
condition per affected hectare. Rates are cached between calendar, daily
physiological, depletion, loss, journey and condition-boundary events. Reads
settle only elapsed effects; they do not replan or award a month's future work.

Explicit condition/reference ratios can reduce subsequent usable food/water
renewal, never increase it above the original source ceiling. Lost productivity
is foregone food production. Incoming water rejected from the usable account
remains recorded as unusable/diverted water. Destroying an original catchment
debits its actual material once and disables only its original renewal shares;
the original incoming flow is diverted, not conjured as drinking water. EP never
regenerates ore, creates meat, repairs a destroyed site or fabricates a worker.

Exhaustion requires a recorded actual original contributor/renewal-site loss,
subsequent performed destruction in a supported affected channel, a condition
decline from the loss-time buffer and crossing that region's applicable floor.
A contributor needs prior paid work there: its species label or an unperformed
order is insufficient. Original deaths still own their existing loss/remains
accounts. Ecological causal summaries pool repeated losses by original stream,
region and cause, retaining first/last times and counts rather than creating a
record per background individual. Cohorts with different sets of worked regions
cannot merge and lend unearned contributor provenance to unworked originals.
Historical exhaustion/recovery episodes remain
saved even after current condition recovers. Bad initial allocation, shortage,
winter, an unrelated source loss or missing facts cannot certify exhaustion.

Recovery needs actual surviving/returning original support, usable substrate,
paid inputs and elapsed work above the applicable floors. A source loss does
not spawn a rescuer, restore destroyed material or teleport a tree. Detailed
native-body losses and pre-city histories are not automatically projected back
onto regions from an old location snapshot; that native provenance remains D
integration work. The source-proposal feasibility assessor is unchanged and
still rejects unaccepted generated allocations.

The prepared endpoint uses a 10-hectare **maintenance workface**, not a complete
species territory or a healthy generated region. One original Ironroot supports
ten original grazers through a full seasonal cycle. Killing that tree produces
gradual soil decline and later exhaustion; a separately surviving original must
travel back along the real edge before paid restoration can recover the workface.
Finite buffer/input quantities are explicit in
`scripts/benchmark-beast-regional-ecology.js`; they do not certify territorial
space, the complete diet of every species, natural formation or ecological defense.
An original catchment-loss check also exercises discovered shortage, dispersal
and dehydration at an equally poor destination without destination clairvoyance.

Run `node scripts/benchmark-beast-regional-ecology.js` for the focused scaling
check. A representative 120-day run at 12, 12,000 and 1,200,000 starting bodies
retained three cohorts and **372–375 cohort intervals**, about 14–18 KB
of serialized state and roughly 11–16 ms locally. Timings are illustrative, not a
test threshold. More regions, independent groups and detailed bodies cost more;
this is not a full-game benchmark or ecological balance certificate.

### Existing work adapters

`beast-regional-work.js` supplies the fixed approved set, without adding species,
abilities or authored rate changes:

| Original creature | Performed regional action and physical limits |
| --- | --- |
| Mire Choir | Detritus-supported wetland tending requires a surviving wetland bed and an actual adequate water column. Nutrients remain physical outputs. |
| Reef Wyrm | Actual calcium/organic inputs and ordinary prey/mineral upkeep fund growth of an existing living reef, stopping at its finite receiving capacity. |
| Rivercoil | Construction material becomes a finite shared dam; actual connected flow bounds work, retention, passage and spill. |
| Gravebloom Elk | Actual carrion and water grow an existing bloom in its original favorable phases; new bloom enters the same finite edible stock once. |
| Ember Ant | Only adult workers of the original site colony build its furnace from actual metal/fuel. Queens, brood and other colonies do not supply worker credits. |
| Dreaming Tortoise | The original tortoise and identified original participant groups must actually be present, alive, willing, sleeping and consenting. Existing atmospheric water becomes rain; mana is charged once. |
| Ley Manta | Credits only the actual excess-mana intake used by its shared paid physiological/work bill. No second mana debit or invented personal reservoir is supplied. |
| Brine Cathedral | Original surviving feeding-tower fractions constrain actual plankton intake and whole-superorganism throughput once; absent marine medium or destroyed towers cannot feed or filter. |

Regional sites declare actual affected area, shared worker capacity, original
physical substrate/structures and applicable seasonal/medium facts. Aquatic
work uses actual water volume and area, plus the existing shared body's minimum
depth and footprint; declaring an arbitrarily shallow or tiny patch cannot make
a colossal organism fit. Finite structure receiving capacity is shared across
all cohorts, not allocated afresh to each worker batch. Reef/bloom outputs enter
declared physical stocks, not a second inventory or automatic formation site;
furnace output belongs to its original colony's site. It does not automatically
grant another nursery, queen or hive.

The explicit adjacent watercourse uses one finite original flow account, processed
upstream before downstream consumption. A dam cannot reserve downstream drinking
water and also retain it upstream. Banks fill at actual event times, unretained
flow/spill passes to the adjoining account, and declared floodable ground can
suffer actual overflow damage. All overflow remains physical output rather than
being discarded by a stock clamp. Constructed dams retain hydraulic effects after
their builder is lost, but receive no ongoing labor credit. A captured-water
provenance tag is part of the same water stock, **not additional water**; the
aggregate account spends tagged water first. Breach releases only surviving
tagged water and retains real structure debris. Destroyed beds/sites do not
automatically repair. Cyclic or nonadjoining flow and duplicate outlets are
rejected; this is coarse adjacent flux, not a whole-world hydrodynamics model or
instant long-range logistics.

Dream participants refer to original groups, not a site-level consent assertion.
Absence, travel, loss, detailing, wakefulness or refusal interrupts future work
after settling what was already paid. The source-owner activity and tower-damage
hooks settle at the exact event time; they are not automatic consent, combat
projection or native-world source adoption. Tower damage applies uniformly to
the named cohort; a uniquely injured original must be detailed or represented
in its own compatible cohort. Distinct tower injuries cannot be averaged into
repaired structures during compaction, and a local original-body handoff retains
those injuries rather than creating intact replacement towers.

The manta adapter does not assume an unknown personal pool has space to fill.
It credits only measured shared-bill intake against the existing local
one-mana-per-second filtration ceiling. Thus sixty actually filtered/spent mana
over a day earns only `60 / 86400` of a fully supported daily EP ceiling, not a
free full day of repair. The intake is already charged by the shared activity
request; no body mass or stored mana is manufactured. Brine food is likewise
charged by the ordinary intake account once. Reduced intake can drain the same
original body reserves and cause real hunger rather than reducing upkeep needs.

Discrete burns, excavation, attacks and predation remain actual C/physical
events. Merely owning an Ashhorn or predator adds no assumed daily horn casts,
kills or restoration. No new regional combat AI or magical powers are introduced.
Monthly intent, shared growth/reproduction effort, cached rates, partial-work
reloads, continued branches, original identities and final-death freeze remain
the existing account contract. These adapters close this approved work-action
set, not D's remaining generated-population, formation or encounter acceptance.

## Local predation and original-body handoff

`beast-predation.js` supplies shared local prey selection and corpse accounting,
consumed by the existing native creature behavior/attack pipeline. A hungry,
capable hunter needs an actually sensed compatible prey body. The initial attempt
budget is five game minutes, followed by a five-minute retry cooldown; lost
contact expires after twelve seconds without updating unseen target coordinates.
Injury, incapacity, depleted effort and local diplomatic constraints can stop the
attempt. Attacks, misses, escape, wounds and deaths still belong to ordinary
physical combat, not a monthly kill percentage. Nearby willing, hungry pack
members must actually hear one another and sense the same prey to contribute
their body scale; known distinct original packs cannot pool their numbers.
An exposed calf is not a license to hunt its fortress-sized adult counterpart.

Carrion Lanterns do not initiate hunts. Detectable real carcasses support local
feeding/approach; an airborne scavenger must physically descend to reach ground
remains. Each corpse retains one finite ledger of initial edible tissue, tissue
eaten and tissue decomposed. Eating and decomposition also reduce that same
physical body's mass. Neither creates a second regional meat/carrion stock.

The approved [tissue-class extension](CARCASS_TISSUES.md) now separates flesh,
named organs, fluids, tough tissues and hard remains in that same inventory.
Ordinary meat eaters leave non-flesh remains; Lanterns consume all animal
classes, excluding wood, equipment and non-biological minerals. Specific tissue
claims and decaying structural hold reservations prevent competing owners from
spending the same matter. New deaths use typed quantities; old untyped remains
retain only their disclosed remainder, without reconstructed bones or refills.
The existing generated-control measurements below predate this extension and
are not a new ecosystem-viability result.
Freezing suspends only actual frozen time; thaw, chunked updates and repeated
reads cannot recreate meat. Per-eater feeding timestamps prevent duplicate
elapsed feeding across both repeated calls and different corpses. Existing
Carrion Lantern light-substrate transfers still come from its actual meal.

The population model now offers `claimLocal`: an adapter must provide the exact
original member's established local position and compatible full-body terrain.
A shared regional range or centroid alone is insufficient. Original effort and
magical/other reserve provenance is required too: the background model cannot
replace missing history with freshly full or fabricated empty pools. It removes that
member from background intake/mortality and retains its actual local actor with
the original claim, including depleted stores, age and health. A local death
settles that claim once; its sole corpse remains with the actor, not also in
background edible stocks. Saves and continued-run copies retain the body and
partial hunt/carcass state without reattachment refills.

This is **not completed generated-population encounter integration**. Existing
native local actors now perform the food-web sequence, and focused source-claim
checks exercise the handoff, but ordinary travel/logistics do not yet adopt all
generated populations through this adapter. Unlocated originals stay unresolved.
Background populations receive no automatic kills, meals, corpse discoveries or
restoration credit. Generated source diagnostics still cannot count hypothetical
prey allocations as performed hunts or a sustainable food web.

## Generated habitat proposals and feasibility diagnostics

`beast-habitat-sources.js` now runs during new world generation where canonical
beast ecology exists. Its private `beastHabitatSources` record is saved with the
reusable world and validated during normal storage/import roundtrips. It is a
proposal, **not an accepted active ecology account**. Older archived worlds
without that record remain unchanged; loading never rerolls missing sources.

The record contains compact population/patch arrays and explicit physical bindings:

- `patchRows`: cell index, habitat-kind index and affected hectares. Spherical
  polygon areas come from the actual geodesic globe. Surface, wetland and shore
  fractions partition land; an ocean cell has its actual water-column habitat.
  Subsurface habitat is a separate volume, not duplicated surface food/rainfall.
- `groupRows`: canonical population index, group ordinal, patch index, adult and
  young counts. A hive row instead records workers and brood; its one original
  queen and two males are explicit separate cohorts. A Brine Cathedral remains
  one whole organism, not a multiplied polyp population. Adult sex/eligibility
  and original juvenile mass are recorded without granting growth or births.
- Population counting provenance and separate located/unlocated counts. Existing
  authoritative Rimefang, Gravebloom Elk and Mirror Ape individual totals are
  preserved. Other counts use seeded biological group/density calibration,
  **not** abundance indices or religious group units. An unsupported count stays
  unknown/unlocated, never zero or a fabricated replacement body.
- Traditional migration paths, original destinations and phases from canonical
  ecology. These do not change when destination food is absent. They contain no
  received map, food reservation or knowledge of another group's intentions.
- `physicalBinding`: explicit original material transfers, capacities, rainfall
  shares, condition/reference/renewal-source definitions, adjacent watercourses,
  work sites, finite nurseries and group assignments. These records belong to the
  reusable world, not to a particular diagnostic or run.

Expanded inputs keep forage, organic matter, detritus, plankton, freshwater,
minerals, heat, charge and excess mana separate. Plant/plankton shares partition
their production rather than duplicating it. Plant water use is deducted from
rainfall. Seawater is not freshwater drinking stock. Weathered substrate and
original dissolved salts are finite, with **zero mineral/ore replenishment**.
There is no automatic meat/carrion income or new naturally occurring species.

These are explicit initial physical calibrations: supported wetland fractions
are 12% of a land cell and shore fractions 4%; remaining surface area is not
duplicated. Accessible weathered depth is 2 mm for exposed bedrock, otherwise
2 cm at the surface and 0.5 m underground. Dissolved marine minerals use only
the original upper 200 m or shallower actual depth. Stock capacities and daily
inputs depend on those volumes, existing climate/geology/arcane fields and the
existing four seasonal phases; they are not measured final balance values.
New bound sources use actual conditioned lake depth where available, otherwise
the existing four-metre wetland calibration, with an initially full finite wetland
column. Marine bodies use the real seawater column volume, not a freshwater tank.
Older unbound archives retain their original geometry/stock calibration.

The generator tries at most three seeded candidate calibrations before keeping
its best **diagnostic** result. This only changes uncommitted proposals, not
existing actors or saved original counts. Edible stock compatibility comes from
the existing C behavior's diet rules. Initial plant/detritus feeding locations
prefer supported physical supply where available; that generator preference is
not a creature migration adviser. New proposals start migratory originals at
their actual traditional home where compatible original habitat exists. Flying
over sea permits passage through air, not a new ocean home or extra population.
Checks include timed resource shortfalls and separate environmental ledgers, compatible reachable prey,
integer prey-body budgets shared once, and geometrically possible opposition.
Scavengers cannot kill living prey to fund their own food. Food-web allocations
are generator-only feasibility budgets; they neither kill source animals nor
become real meat stocks, reserved meals or creature knowledge.

Seasonal feasibility now replays the **same month/edge transitions consumed by
the account model**, rather than emitting a blanket unverified label. It charges
travel effort and resident individual-days to each actual route region. All
groups share one finite regional stock; renewal accrues only over elapsed time,
with capacity-limited carryover between seasons. Later rain or forage cannot pay
an earlier shortage. Diagnostics retain exact depletion intervals, missing
amounts, blocked routes, late arrivals (including still-unfinished journeys), and
per-group travel summaries. This is a conservative initial-cycle supply replay,
not a substitute for population biology or performed ecological work: it grants
no hypothetical prey kills, paid nurturing, future recruits or successful escape
from scarcity. The account model separately consumes actual body reserves and
can lose originals to starvation.

The tested generated allocation is still **rejected**, with concrete seasonal/
prey shortages, unverified opposition and unresolved original habitat. Recorded
generated work and nursery sources now execute in the same account model;
successful allocation repair and live regional integration remain unfinished D
work. Checks omit unimplemented benefits
instead of inventing their capacity. Rejection is not evidence of historical
ecological defeat or exhausted territory.

Condition values in these proposals are relative initial calibration, not a
satellite observation. Bound desert soil starts at 10, while polar ice, marine
and underground patches have no surface-soil ledger. Wetland/reef and freshwater
references apply only to their actual original habitat.
The diagnostic compares conservative potential pressure, not measured performed
work, and cannot substitute for the account model's paid maintenance execution.

`runtimeSource` now checks exact archived source integrity and recorded physical
bindings independently of ecological viability. It explicitly returns
`nativeEncounters: true` with `ecologicalStatus: 'unverified'`; this does not
change the archived assessment or certify a healthy/exhausted ecosystem.
Raw diagnostic expansion is marked `diagnosticOnly`, which `beast-populations.create` still refuses. Source
validation reconstructs physical areas and initial counts from the world, so
re-signing an inflated table cannot create extra supply. Valid original habitat
placements and advisory diagnostics from older archives remain immutable rather
than being regenerated by improved checks. Each actual body handoff checks its
position, full footprint, medium and physical constraints; an old advisory success cannot bypass these. No proposal or failure
detail is copied into public beast reports or the world-library interface.

### Recorded physical source execution

New [finite wetland drainage](WETLAND_DRAINAGE.md) shares original outlet
capacity between river flow and bank/overbank discharge. Excess water remains
conserved; area-scaled erosion distinguishes ordinary drainage from damaging
inundation. The original animal roster and nurturing rates are unchanged.
The focused generated hydrology control is not a complete food-web replay.

New [established work-site bindings](ESTABLISHED_HABITATS.md) share finite
positioned work faces and site-local construction/metal/fuel accounts, reuse
original nurseries and support paid construction-only starting history. Dam
outlets may use actual drainage below the visible-river threshold, never an
invented terminal-basin outlet. Dream sites remain dormant without actual
participants and independently recorded sleep/consent. The source-small control
has no missing physical sites, but eight hives still lack refined metal and 32
tortoise groups have no recorded participants. Its generated assessment remains
rejected. Earlier complete seasonal measurements below are historical controls,
not a seasonal replay of this new allocation.

`beast-habitat-bindings.js` partitions existing pools rather than creating another
material budget. Supporting substrate receives 0.1% of original minerals; marine
calcium receives 1% of remaining dissolved salts. Rootable soil and loose
construction stone receive small finite mineral shares. Existing wetland beds,
dry fuel, reef-shelf carbonate/organic structure and bloom-bearing forage come
from their original compatible stocks. These are explicit generation
calibrations, not extra ore deposits or automatic replenishment. Atmospheric
water and river flow partition original catchment water and rainfall. River
outlets must follow a real adjacent canonical drainage edge; upstream runoff is
not regenerated at each downstream cell.

Work assignments require the actual species, original group, medium/body
clearance, area and material/source structure. Missing refined furnace metal is
not inferred from raw stone. Original Dreaming Tortoises do not acquire invented
willing sleepers. Reef structure is seeded only in original reef-shelf geography;
other sea floor is not silently converted to reef. Original Brine Cathedrals are
whole organisms with four healthy feeding towers, not multiplied colonies.
Original Thunderback grazing also uses the existing consumed-forage pressure
adapter; its food is not billed twice as an engineering recipe.

Nurseries share at most 5% of each original patch's area. Receiving slots use
newborn-scaled footprints and original eligible breeders, not worker fertility.
Original dependent young already occupy their recorded nursery; creating a new
account cannot free their slots. Actual local mates, temperature phases, body
mass and paid incubation/growth still apply. Queen recruitment reads only its
living same-colony furnace. No parental fertility or new natural formation site
is granted to core/lab environmental families.

`replay(record, map, { binding, account, until })` explicitly runs these generated
sources through `beast-populations.createDiagnostic` and the real elapsed-time
model. It is separate from world creation and ordinary runtime activation. It
records performed work, accumulated unmet resources (including those of animals
that subsequently die), births and conserved original membership. An incomplete
cycle with no known failure stays incomplete; actual shortfalls can reject even
a partial replay. [Measured seasonal viability](SEASONAL_VIABILITY.md) separates
archived preliminary warnings from observed feeding, paid nurturing, transient
habitat lows and completed-cycle maintenance deficits. Its current all-species
120-day control remains rejected, with the exact causes recorded separately
from the old forecast's pessimistic stock assumptions.
Performed bounded regional contacts are reported separately from still-unverified
sustained all-species food-web/opposition viability. Potential benefits are not
credited as executed. Rejection cannot imply historical
nurturer defeat or exhausted territory.

Diagnostic accounts retain their flag and world/run ownership through JSON
normalization and continued rebinding. Independent accounts copy their inputs;
they cannot mutate canonical originals or become active encounter accounts.
Loading does not replenish resources, reroll choices or create missing sites.
Unbound archived records remain unbound and cannot silently acquire this bridge.
Validation reconstructs expected allocations to reject changed source records,
but does not rewrite the archive.

Generated populations over 128 originals reuse the existing seeded, integer
batched background-hazard method across their compact cohorts; small populations
retain exact death clocks. This is a demographic approximation, not an allocation
of one persistent record per animal. `scripts/benchmark-generated-beast-habitats.js`
runs a normally generated globe through its actual 120-day calendar with all
original groups. The source-small/refinement-2 sample has 275 patches, 2,600
groups and 56,186 located original bodies. A measured complete run took about
six minutes and serialized roughly 24 MB of diagnostic account state before
regional contacts were added: this is
**not** a claim of acceptable native-game scaling. Expensive replay is opt-in,
not a world-creation or ordinary-save operation.

### Habitat placement and location continuity

New sources also apply [finite hunting-habitat allocation](HUNTING_HABITATS.md)
to pure hunters. Actual compatible original wildlife, local encounter density
and shared finite flesh budgets rank homes within the existing territory and
thermal/traditional-home constraints. Calibration, original counts and prey
allocations remain unchanged; archived worlds retain their original positions.
Living prey never funds Carrion Lantern placement. The supplied local execution
controls are not a new complete seasonal measurement or native adoption.

New pristine populations select usable temperature/water settings before human
history is generated. Their original rows, identities and counts then remain
authoritative. Physical source placement filters those ranges for usable medium,
rootable ground and a receiving season, preferring year-round habitat where it
exists. It does not move an archived population or change an animal's traditional
itinerary using hidden destination food. When no compatible allocation exists,
its original count stays explicitly unlocated; it is not deleted to pass a test.

Approved catchment-funded ponds can occupy 0.1% of a rainy land cell lacking a
mapped wetland. This area is deducted from the surface partition; the globe's
biome/hydrology labels do not change. A four-metre basin starts with only its
original 15 L/m² surface-water share. Filling it debits the neighboring surface
catchment for the remainder before nurseries or wildlife use it. Rainfall is
partitioned over the same area, not copied, and material/receiving capacities
remain finite. These are explicit initial sub-hex allocations, not runtime ponds
created to rescue a starving population or discoveries automatically given to
the scientist. Sources without the new placement declaration load unchanged.

New proposals also record `habitatAccess: true` and compact `feedingRows`.
Winged passage over a deep wetland is not a dry resting/nesting place for the
original adults and young. Initial plant/organic-feeding placement spends a
shared estimate of the actual seasonal food budget across candidate regions,
compatible foods and previously allocated groups instead of repeatedly filling
one small pond. The estimate includes young maintenance and growth; it neither
credits food nor certifies sustained viability. Original source counts remain
unchanged, and insufficient habitat stays unavailable/rejected. Sources without
this declaration reproduce their former placement/food selection exactly;
validation, import and ordinary reads do not relocate archived groups.

Hatched cohorts with a real positioned nursery retain a compact ordinal grid
at that nursery; live births retain snapshots of their actual maternal family
formations. Neither creates one actor per birth or puts all offspring at the
group's centre. Missing receiving positions remain unknown. Different formation histories
cannot be averaged together by cohort compaction. The existing detailed-body
handoff can claim that same original child with its paid mass, needs and wounds;
its corpse stays with the detailed owner rather than being copied regionally.

Authored regional edges retain departure/arrival frames. Journeys pay for the
original local approach, the edge and any familiar final home approach. Their
partial route progress survives saves, with no stationary encounter while still
in transit. Arrival translates the same formations and individual retreat
positions after the actual travel time; it grants neither food nor a new nursery.
An unpositioned or blocked edge cannot grant coordinates. Diagnostics now report
positioned travelling bodies separately instead of counting all travellers as
unlocated. This remains a coarse regional geometry, not a claim that every body
can simultaneously fit on the native local grid.

The preceding care-and-route-stop `source-small` 120-day replay retains all 24 species, 89 source
populations and 56,243 located original individuals, with no unlocated original
source rows. Its 190,892 paid births reconcile to 130,906 living and 116,229
dead. All living bodies have a stationary formation or a positioned journey
(20,808 travelling at the endpoint). Approved size-classed herds/schools provide
4.94 million kg of actual ingested wildlife. Marine filtration accepts an
exactly deep-enough original seawater column, consistent with body physics,
without requiring or consuming imaginary extra seawater. Freshwater work still
stops at its consumptive depth boundary. See [baseline and wind replay accounting](BACKGROUND_WILDLIFE.md#verification-and-limits).

**This is not D acceptance.** The replay records 191 starvation and ten
dehydration deaths, 32 resource-shortfall records and no original-beast duels;
source repair, effective ecological opposition and native integration remain
unfinished. Dependent scarcity deaths fall from 636 in the previous care/stop
baseline to thirteen; Thunderback scarcity deaths fall from 562 to zero, and
Rivercoil starvation disappears. Those improvements do not certify healthy
starts or excuse the remaining failures. Unsupported work-medium/nursery
warnings are gone; 38 missing work sites, eight unverified furnace-metal sources
and 32 unverified dream-participant sources remain unavailable. The roughly
52.9 MB expanded account and lengthy replay are not native-game performance
acceptance; checkpoint/timing details are in the linked accounting. Browser
checks use the account/shared-body APIs, not ordinary play or native game-save
adoption.

### Route feeding and dependent care

`beast-seasonal-journeys.js` retains the original destination/path while hungry,
thirsty or fatigued travellers can stop at an established local route position.
New physical edge geometry uses actual neighbor bearings and typed source-side
and destination-side frames. Route fractions without physical frames cannot
become feeding coordinates. The midpoint still transfers actual residence;
an approach, route leg or final home approach is not a teleport to a prey field.

Travel reviews occur at most six hours apart, earlier when a dependent body's
own reserves require it, with a one-minute scheduling floor. Initial stops last
at most six hours. An essential unfinished local feeding can extend that same
positioned stop in ten-minute increments while an actual local, capable
guardian, compatible material and care time remain available. All stopped time
is bounded by the actual remaining month's 16-hours/day stop ceiling. These are
time ceilings, not free rest or food. Progress freezes while stopped; resumption
adds exactly elapsed stop time to crossing/arrival clocks. Arrival windows can
be missed. A stop uses current bodily needs and actual local medium, never
destination food, incoming populations or hidden future capacity. Unknown or
empty stopping places can still fail. Searches, handling, ingestion and rest
reuse their existing monthly budgets and the same finite prey/corpse owners.
Resumption releases unfinished meals locally. Winged bodies cannot regain
stamina by resting in unsupported air over deep water; aquatic bodies and real
buoyant aerostats retain their appropriate resting media.
Only actual movement advances the no-rest clock. Non-foraging grazers stopped
on supported supplied ground accrue real rest before they can provide care;
retaining a transit record does not itself erase those earned intervals.

Departures wait for already-started care to finish without changing the chosen
destination. Each new positioned leg records its actual member pace snapshots:
juvenile pace is conservatively body-length-scaled from its current mass, and
limb/wing injuries use the shared mobility reduction. The slowest member caps
the group's authored regional pace. Paid older legs retain their saved pace;
growth, reloads and arbitrary reads cannot retrospectively shorten them. This
is a coarse regional pace ceiling, not proof of native per-step locomotion,
available wind/current or safe terrain along every metre of a traditional route.

`beast-parental-care.js` distinguishes food-provisioning modes for the fixed
strategic roster. This does not replace human/laboratory care or add populations:

| Mode | Strategic families |
| --- | --- |
| Family provisioning | Ashhorn, Glasswing Roc, Nullmaw, Thunderback, Gloam Prowler, Rimefang, Frostwake, Mirror Ape, Gravebloom Elk |
| Same-colony worker provisioning | Ember Ant larvae; a queen's maternity does not make her the larval workforce |
| Self-feeding young / source-supported establishment | The other fourteen strategic families, including aquatic self-feeding hatchlings, detritivores, rooted propagules and colonial fragments |

Food independence is distinct from adult mass, fertility and the broader
independent-care milestone. Self-feeding young still need real compatible
resources, medium and accumulated growth. Dependent young do not receive
regional food/water directly or independently join hunts, scavenging or pack
attacks before their existing independence age. Original newborn family layouts
use actual maternal formations where the recorded nursery supports them; they
do not fabricate caregivers or alter original counts. Newborn colony larvae
link to actual living same-colony workers, not merely the queen/mate origins.

An actual willing, conscious and physically capable caregiver must be present.
Conservative whole-cohort position envelopes must fit local reach; missing
positions, unresolved barriers, sleep, incapacitation, lost guardians or an
unsuitable medium cannot supply remote care. Each caregiver has a remaining-
month budget of two hours/day per actual member. Provisioning actions last at
most ten minutes, cost 0.1 stamina/second and exclude simultaneous hunting,
eating or resting. Tiny rations still cost at least one minute of handling when
that much time is available; their material amount is not rounded away.

Family food comes from compatible finite regional material or an actual
caregiver's ingested surplus above its protected own ration. Freshwater uses
its real source, never seawater. Initial processing efficiency is 80% for food
and 95% for water; the remainder is recorded waste. All donor/recipient mass,
water, effort and elapsed time are charged once. Delivered flow, not a future
feeding promise, offsets missing maintenance. Supplied surplus can fund growth;
age alone cannot. Caregivers finish a useful feeding and wait for real hunger
or thirst instead of repeatedly topping up microscopic gaps. Family feeding
demand can motivate additional hunting but supplies neither knowledge nor food.

New provisioning actions fund food and water independently. Each has its own
finite material request and cached funding factor: missing food does not stop
available water, nor does missing water stop available food. Both share one
handling interval, monthly care budget, stamina cost and ordinary active-body
maintenance bill; splitting the material requests does not double any of these.
Stored food transfers stop at the caregiver's protected ration. The depletion
boundary includes the caregiver's own unmet intake, even if regional food exists
but this body cannot consume it directly. Water can continue after that boundary.

Care does not require the nutritional conditions needed to recover by resting.
A hungry caregiver can still deliver while actual health, stamina, body parts,
medium, proximity and willingness permit it. Empty reserves earn no unfed rest
recovery; starvation/dehydration still damage the caregiver normally. Declining
health interrupts care at its existing 30% incapacity threshold; reduced stamina
clips the remaining interval at actual exhaustion. Separation, blocked access,
sleep, travel or incapacity interrupts both transfers without refunding delivery.
Resource identities, exact inputs and independent funding factors survive partial
saves and continued branches; duplicate or missing material requests are rejected.
Previously saved mixed actions retain their cached paid interval and are not
retroactively split or refunded. Their next newly started action uses independent
funding. These are focused care corrections, not a new all-species viability
measurement or an upgrade of archived source availability.

Completed foraging actions yield before another bout starts so nearby young
can actually receive care. Handling/captures already earned remain owned once;
an unfinished search is not completed early. Care targets schedule reviews
before the dependent's food/water stores empty, rather than waiting for health
damage to reveal the need. Reviews have a one-minute floor to avoid numerical
micro-events as a growing body's target changes. Missing food cannot trigger
endless tiny water top-ups that occupy the caregiver. A parent's next hunt
accounts for its shareable ration and actual provisioning demand: personal fat
can sustain the adult but cannot feed a child by proxy. Monthly search ceilings
also clip the actual active/rest waveform, not its mean duty fraction.
Food-to-mana and shared-charge recovery debit bounded original material totals
before converting or dividing them among members. Spending the last real ration
cannot leave a negative store through divide/multiply rounding; save validation
still rejects negative stores rather than silently repairing them.

Actual shortages damage health in proportion to the individual's own scaled
requirement, not a full adult's ration. Losing a caregiver can therefore kill
an orphan even when inaccessible regional food remains. Interrupted work keeps
spent resources and releases only future work. Nursery provenance, dependency,
partial provisioning and route stops survive saves and continued branches;
detailing a caregiver removes that original member and interrupts background
care without creating another food owner. Final death freezes the run.

Private scarcity diagnostics retain first failure, age/dependence, current
travel/stop phase, personal-arrival history and known living caregivers. For a
dependent death they also snapshot actual local/capable/free guardians,
remaining member-time, accessible food/water, willingness and sleep before the
lost child's membership is removed. Orphaning, separation, unavailable material
and an available-but-unserved family are distinguishable circumstances, not
automatic verdicts that a death was justified or an implementation bug.
They distinguish causes to investigate; they do not automatically certify a
bad starting allocation, excuse a failure as normal migration, relabel a region
exhausted or expose a public census. The generated source remains diagnostic
until existing ecological/opposition, natural-formation and native-adoption
requirements actually pass. Prepared care/journey browser checks exercise model
saves, not ordinary-game encounter adoption.

In that preceding 120-day generated replay, caregivers spend 240.2 million actual
member-seconds and process 12.17 million kg of food plus 19.81 million litres of
water, delivering 9.73 million kg and 18.82 million litres after recorded waste.
Thirteen dependent scarcity deaths remain, among Rimefang and Frostwake groups
with missing food and/or no currently capable caregiver. Carrion Lantern,
Rimefang, Reef Wyrm, Frostwake and two travelling Glasswing Roc starvation
failures still require investigation inside D. Neither surviving caregivers nor
aggregate regional food prove that an individual could actually receive a meal,
drink or safe resting place, and no failed region is automatically exhausted.

### Wind-driven Carrion Lanterns

New habitat proposals explicitly record `windTransport`. Their Carrion Lantern
cohorts use actual regional airflow rather than the authored travel-reference
speed as directed flight. Canonical prevailing bearing points **toward** travel
(0° north, 90° east); strength maps to 10 m/s at 1,000 permille. This is a stated
simulation conversion, not a measured weather speed. Seasonal wind overrides
are consumed when present. Unknown flow and known calm remain distinct; neither
creates passive movement. Known calm can support actual paid propulsion toward
sensed carrion; unknown flow cannot be assumed calm. This is not yet an adapter
for native local weather.

`beast-wind-drift.js` saves absolute anchor/time/velocity segments of at most an
hour, ending sooner at monthly changes or real adjoining-cell separating planes.
Horizontal direction and the 0.5 m/s ceiling follow the existing native passive
body rule. Passive segments cannot steer toward carcass locations or hidden
destination food. The approved [local approach controller](CARRION_LANTERN_APPROACH.md)
now supplies separate, paid segments of at most five seconds toward actually
sensed nearby carrion. Its weak thrust, descent, time/effort budgets and saved
last observation do not grant intentional long-distance migration.
Original ordinal spacing is retained. Actual edge crossings translate the local
position frame, partition existing cohorts where needed and settle receiving
accounts before transferring ownership. They do not create new individuals,
reserve unknown food, teleport to a habitat centre or start an intentional route.
These tangent-plane edges are a coarse physical transport model, not a detailed
globe surface path or vertical buoyancy/fall simulation.
Crossing time belongs to the cohort anchor; retained formation offsets are not
individually tiled edge passages. This does not certify native terrain, drinking
access or every member's fine-scale travel residence.

Point corpses can separate one actually sensing original from a spatially
extended formation through existing contact custody, with bounded retries for
the remainder. A snapshot cohort loop prevents recursive per-animal expansion.
Actual arrival, not merely arrival of a large formation's anchor, gates feeding.
New claims/pursuits wait for half-empty food stores, preventing minute-by-minute
microscopic ration handling. Saved approach effort and all original membership
remain conserved. The current [spatial-carcass control](WILDLIFE_CARCASSES.md#targeted-120-day-generated-control)
eats 1.690274 kg from actual original Lantern remains and zero anonymous
wildlife, and still loses all 120 originals by day 80; this is not source
acceptance. Earlier field-based feeding measurements remain historical results.
Saved airflow segments retain the actual last represented ordinal so a dead
cohort's historical frontier is not invalidated by its now-empty formation.

Lantern sensing earns elapsed observation, not active-search exertion. Only tissue within the body's current feeding
reach can be claimed. Anonymous carcass fields retain their finite spatial
footprints; a whole cohort must fit before receiving a shared meal. Leaving the
field, cancelling a foraging action, crossing an edge or detailing releases unconsumed
claims at their original source. A large dead animal can be scavenged without
making it legal live prey. No living wildlife is killed by this scavenger.

New `wildlifeCarcasses` proposals use conserved, locally positioned wildlife
carcass batches instead of the old anonymous fields. Actual deaths, tissue
ages, specific class custody and aggregate matter reconcile; no new corpse is
funded by the query itself. Local scent/feeding reach and existing effort
limits gate encounters. Only one corpse's structural support may anchor a
mouth, never the total batch weight. A clipped handling action releases its
claim without awarding ingestion. New sites/history are not reconstructed
into unmarked archived accounts. The full contract and focused verification
are in [spatial carcasses](WILDLIFE_CARCASSES.md).

A mouth can hold a **positioned original corpse**, not the combined mass of an
anonymous field. The model requires a real floor, contacting cohort geometry,
surviving feeding organs and finite stamina. Drag uses 1.225 kg/m³ air density,
coefficient 1, body-scaled frontal area and squared actual wind speed. Per-mouth
grip is limited to a quarter of body weight scaled by organ integrity; corpse
friction is limited to half the weight of its surviving inedible structure.
These are explicit initial balance constants, not extra magic or soul powers.
Holding costs `0.1 × drag / body weight` stamina per second. Gusts, lost contact
or exhausted effort end support, with eating clipped to actual contact time.
Ingestion still takes time, spends the one owned tissue stock and retains the
existing 5% light-substrate allocation. Body wounds, energy, food and exact
original membership survive local handoff without a fresh meal or reserve pool.

Moving cohorts cannot remotely breed at their old nursery. Calm bodies still
need actual contact with the recorded receiving site. Stationary proxy duels
are not applied to advected cohorts; native encounter adoption remains D work.
Archived sources without the new declaration keep their original interpretation
and identity rather than being silently upgraded on load.

Focused wind checks cover actual/contrary/calm/unknown flow, corpse contact,
strong gusts, damaged buoyancy, finite effort/custody, crossings, formation
spacing, million-member batching, malformed saves and independent continuations.
A browser case reloads partial drift through the actual index dependency order,
continues a finite meal independently and checks the final-death freeze.
That initial full-ecosystem replay preceded the approved passive-metabolism
correction. Its totals remain historical evidence, not a current survival claim.
See [the recorded replays](BACKGROUND_WILDLIFE.md#wind-enabled-replay).

### Passive metabolism and finite moisture

`carrion-lantern-biology.js` shares the corrected biology across native bodies,
regional cohorts and authored reference data. Adult basal demand is 0.05 kg
food-equivalent and 0.03 L water per day. A full 3 kg adult fat reserve is a
nominal 60-day fasting budget; mass scaling, youth, exertion and existing reserve
loss still matter. No saved body receives a refill. Ordinary drift and passive
carrion sensing stay at basal metabolism; actual feeding/holding uses the 8×
active multiplier and retains its separate finite gripping-stamina bill.

Passive observation is saved as elapsed sensing, with zero active-search seconds
and no search-effort debit. It cannot capture future tissue or steer toward
unseen food. Contact, handling, ingestion and actual custody still constrain
meals. Wet-tissue ingestion has its own 3 kg/600 s ceiling, independent of basal
demand: 45% becomes food, 5% light substrate and up to 50% stored water. Excess
water is recorded waste. The tissue is debited once; water does not also enter
the food store. Simultaneous drinking/maintenance at a full store does not create
geometrically shrinking refill events.

Atmospheric uptake has a 0.06 L/day adult ceiling at 70% relative humidity and
20°C. Initial tuning multiplies body surface scaling, intact membrane fraction,
`clamp((RH − 20)/50, 0, 1)` and `clamp((temperature + 5)/25, 0, 1)`.
Unknown humidity/temperature or missing actual inventory supplies nothing.
Collectors share and debit the existing finite `atmosphericWaterL` pool with
other users; regional airborne bodies do not remotely drink ground water.
Native patches use their actual humidity and existing finite atmospheric stock,
including attributable vapour outputs, without inventing an inventory from a
humidity label. Store replenishment, maintenance, mass and receipts remain saved.

New proposals explicitly declare `lanternMoisture`; old reusable worlds receive
no new pools or humidity on load. New regional humidity is a stated climate proxy:
75% over marine columns, otherwise clamped `20 + 0.04 × aridityIndexPermille`.
Existing land atmospheric inventories/rainfall shares remain shared. Marine
initial vapour partitions at most 0.001 L/m² from original seawater, bounded by
surplus above original inhabitants' minimum depth. No marine renewal or fresh
spring is added. The narrow legacy-biology digest projection validates older
source identities without rewriting them. Old earned meal clocks retain their
slower throughput; the next action uses the corrected ceiling.

Longer survival exposed a pre-existing discontinuous-wind boundary loop.
Crossings now rotate the anchor's tangential offset into the receiving frame.
Opposing normal flows form a saved coarse convergence front rather than repeated
0.0001-second crossings. New vector segments retain the averaged tangential wind
in the actual shared frame; exactly head-on fronts and nonparallel convergent
corners can still trap bodies. Every participating wind source is a scheduler
dependency; changed wind can release it. First-survivor rebasing stays within retained formation
width, without moving surviving bodies, steering toward food or granting effort.
This is coarse regional flow handling, not resolved atmospheric turbulence.
The [two one-day retained-checkpoint controls](reference/lantern-vector-windows.json)
verify saved vector motion and tangential fronts without replacing the recorded
full-season failure with a new viability claim. Native fractional pose and
unchanged thrust/feeding restrictions are in [the approach contract](CARRION_LANTERN_APPROACH.md).

### Regional feeding and ecological conflict

`beast-regional-foodweb.js` connects generated bound sources to the same conserved
population account. Prepared model sources opt in with `regionalFoodWeb: true`;
existing core-care families do not acquire a second owner. This is internal
regional execution, not ordinary-play source adoption or public census data.

Monthly plans retain a finite hunt-attempt allowance from the authored
per-individual rate and actual original membership. Daily local contact pulses
consume at most one discovered opportunity per group, not one loop per member.
They do not award a month's kills or food upfront. A 128-metre spatial index
examines at most sixteen entries per neighboring bin; dense unexamined entries
are recorded as deferred, not absent or safe. There is no global predator/prey
pair search or relocation toward secretly available food.

Original source cohorts get fixed, body-scaled formation spacing and immutable
ordinal positions relative to their recorded home. One nearby original is not
proof that all members occupy its coordinates. Injury cohorts retain their own
actual retreat positions. A departed group, unresolved arrival or newborn stream
without established local formation cannot acquire an encounter position from
its region label alone. These bodies remain conserved and explicitly unlocated
for contact purposes; they are not deleted or deemed harmless. These coarse
source formations are not a native local-map placement certificate.

Contacts require the existing sensory organs/ranges, compatible full-body medium,
physical reach and unobstructed lines. Solid rock does not become a sight or
attack corridor. Published hunting success is an opportunity ceiling, never a
guaranteed kill. Heard, willing original pack/choir members may participate, with
at most eight actual same-group attackers in a contact; every participant has
its own membership claim, body and finite effort. Distant population totals
provide neither pack mass nor combined damage. A single duel's result is never
multiplied across a population.

A contact lasts at most five elapsed minutes and resolves sparse movement,
recovery/preparation and strike events rather than strategic per-frame AI.
Existing body dimensions, wound/capability checks, natural strike profiles,
paid applicable abilities, conditions and armour consumption constrain outcomes.
Unknown radiance, unlearned blink destinations and missing reserves grant no
ability effects. Faster prey can escape, injured animals can retreat, attempts
can lose contact, and either participant can fail or die. Fighting originals
cannot simultaneously supply regional work/growth. Their actual kills, wounds,
feeding-tower damage and interrupted original contribution feed the existing
decline/exhaustion accounting; a failed forecast is still not exhaustion.

The directed authored antagonisms are motives only when the nurturer actually
senses the opponent's recent nearby feeding damage. A species label, damage
elsewhere or private regional destruction total cannot trigger defense. Existing
adult-behemoth/deep-furnace limits remain; guardians receive no remote protection
credit. This does not establish that every generated opposition matchup succeeds.

Unengaged originals retain compact cohorts. Supported contacts split only the
claimed ordinal ranges, preserving brood investment, original identity and
saved hazard state. Wounded ranges keep their actual parts/conditions/effort;
empty contact splits are discarded, not kept as another actor registry. The
remaining exact hazard stream keeps its clock; a separated original receives a
once-seeded memoryless residual clock. Pooled mortality balances partition
proportionally. Reloading never resamples the split or replenishes effort.

Personal effort begins with an attributable lower bound, not a newly full pool.
Actual supplied rest establishes stamina; compatible food paid at the existing
food-to-mana ratio restores mana. Heat/charge uptake debits finite original
regional sources. Armour and crown tissue are already part of the original body
mass and cannot be reminted on load. Mirror Apes do not receive a second passive
mana owner. These are conservative owned-reserve accounts, not claims to know
unrecorded prior personal magic histories.

Every background corpse has one source-loss key and conserved body/edible mass.
Located individual remains can feed an actually sensing, reaching predator or
scavenger. Only the contact member receives the meal; it is not broadcast into
generic regional meat or other members' stomachs. Carrion Lantern light retains
the existing five-percent tissue allocation. Decomposition uses the shared local
0.1/day exponential hazard and returns only actual tissue to detritus, with
receiving overflow retained separately. Consumers, freezing and decay share the
same remaining edible inventory. Detailed corpses stay with their local actor.
Distributed batched deaths without resolved individual positions remain
unlocated remains, not one convenient carcass pile at a group centroid.

Pending contacts, consumed tissue, source provenance and wounds survive ordinary
JSON normalization and independent/continued binding. An original lost to a
different cause cancels its pending contact; local handoff settles only elapsed
contact before transferring that original's current body. It does not copy the
body or corpse. Final death freezes further execution. Food-web summaries expose
unlocated living/remains capacity only to private diagnostics, never the UI.

Focused million-member and dense-group checks demonstrate bounded contact work
with respect to headcount, not constant cost for unlimited groups/history or
acceptable native-game performance. The regional scheduler reduces the measured
diagnostic cost below, but does not certify native-game scaling. No all-world equilibrium, automatic historical exhaustion,
formation-site completion or native encounter adoption is implied.

The focused 35-day `source-small` replay uses the same original source
`beast-habitat-source:60cb5545`: 275 regions, all 2,600 groups and 56,186 originals.
On the same machine, comparing the committed global kernel at `59174aa` with the
regional scheduler, **both using the corrected funding math**, gave:

| Measure | Global scheduler | Regional scheduler |
| --- | ---: | ---: |
| Execution time, excluding setup/report | 61.731 s | 8.097 s |
| Cohort integration visits | 5,923,138 | 359,269 |
| Born / living / dead | 19,604 / 66,721 / 9,069 | 19,604 / 66,720 / 9,070 |

That is about 7.6× faster and 94% fewer cohort integration visits, without
dropping groups or bodies. Birth totals agree after the funding correction;
one death and contact opportunities differ under the maintenance-refresh change
described above. This is not bit-for-bit global-kernel equivalence. The regional
sample recorded 1,245 attempts, six contacts, four escapes, 109.9 kg consumed
from real remains and **no contact kills**. Prepared physical checks separately
exercise successful kills and original nurturer loss. Its saved account is about
27 MB and its status remains incomplete, not initial-cycle success.

Reproduce the comparison serially, supplying a trusted committed kernel through
stdin so both engines import the same current biology/support modules:

```sh
git show 59174aa:beast-populations.js | node scripts/benchmark-generated-beast-habitats.js --baseline-stdin --days=35
node scripts/benchmark-generated-beast-habitats.js --days=35
```

The earlier uncorrected 35-day run took about 66 seconds with 6,324 delayed
births. Its longer profiling run was stopped at day 80, not a completed seasonal
check. Neither those old observations nor the new bounded comparison establishes
full-cycle viability, acceptable default-world/native cost or resolved body
positions. Those remain existing D limitations, not new queue entries.

## Bounded native encounter adapter

`beast-native-populations.js` connects original regional membership to existing
field bodies and the real run save. Encounter activation is explicitly separate
from ecological viability: the five feeding failures in the integrated control
are unchanged. The adapter does not repair or relocate an invalid original.

At an actually materialized boundary, remote or foreign wilderness patch, the
adapter queries the original region/kind and geographic window. It bisects live
ordinal ranges (at most 4,096 query nodes) rather than visiting every animal.
At most eight nearby originals enter detail. A claim removes those ordinals
from background consumption/mortality and retains their age, mass, health,
anatomy, conditions, brood history and attributable mana/stamina/energy. Factory
full reserves are replaced, not awarded. Original grid positions map into the
existing one-metre field grid; bodies must fit the real medium, full footprint,
rocks, property and other occupants. Existing sectors are not enlarged and
colossal bodies are not shrunk to fit. Invalid underwater aerial placement and
missing deep burrow material remain unavailable.

Finite local terrain parcels debit their source region exactly once. Overlapping
windows share custody; reload binds local terrain back to those same parcels.
Reserved renewal-site material and named workface inventories remain with their
original owner, not spread across unrelated tiles. Water columns retain separate
seawater and freshwater accounts. Excavation moves available mineral matter to
rubble rather than leaving a second edible/minable copy. Moving the same parcel
into detail does not grant extraction rights or reveal a private regional census.

Saved native state contains sparse changes against the unchanged original source,
plus visited parcels. New saves share repeated delta paths in a prefix tree;
existing path-row saves remain readable. Every assigned value and deletion is
retained exactly, without rounding or skipping cached earned work. It does not
embed the expanded diagnostic account. Reload
reconstructs the exact source and validates changed history; continued import
rebinds the copied run only. Existing bodies, depleted reserves and actual dead
members persist without a new claim or healthy replacement. Independent starts
inherit none. Saving after death can retain already-earned body changes but does
not create encounters or execute more behavior. Legacy-owned encountered
populations are not claimed again, and native-claimed populations cannot receive
new legacy representatives. Full legacy census/source reconciliation remains
unfinished; these safeguards are not a completed migration of those consumers.

**Default-world activation and remaining scope.** The former 512-patch gate is
removed. On the measured default source (10,242 cells, 18,526 habitat regions,
2,683 groups), 712 initially occupied/dependent regions are initialized; other
regions retain their unchanged original recipes. Zero-time opening/packing took
about six seconds and added about 466 MB of live heap. This is incremental heap,
**not total process RSS**: world generation had already reserved substantial
memory. The former eager native opening/packing took about 54 seconds, with
3.41 GB total RSS and 736,671,943 bytes of expanded region JSON. These are
zero-time controls, not a demonstrated season-long default-world memory bound.
Growing visited/dependency coverage can still expand the active account.

First activation paints an explicit paused elapsed-history notice before source
initialization. Earned event work then resumes in bounded event batches; loading
does not advance the game clock, manufacture a replacement or certify safety.
New runs use a `deferredHabitats` storage-strategy marker. Older eager sparse
deltas retain their original baseline instead of being interpreted as lazy saves.
An unopened account can be saved without synchronously expanding its source.

The actual default-world continued-import control also exposed browser storage
quota pressure, not just an upload-size limit in the test harness. Large library
records now use a lossless variable-width packed LZW dictionary; small records
keep the existing encoding. Plain JSON and old `lz16:` records remain readable.
Saving a run may losslessly re-encode only its referenced large legacy world;
canonical bytes after decompression, world identities and other runs are retained.
This is a storage representation change, not world regeneration or permission to
delete branches. Finite browser quota still exists; no season-long storage bound
or unlimited number of independent runs is claimed.

When the last attendant leaves a native wilderness site, free animals return
to the regional account. A returned original is one sparse cohort entry with its
individual memories and learned abilities; unencountered animals remain batched.
Regional work consumes finite supplies, ages the animal, and can move or kill it.
Revisiting claims the same original only if its current position and body fit the
visited window. Its injuries, reserves, funded brood and cooldowns carry forward;
no pending local attack or spell is replayed as a catch-up action. Staff actually
present and existing physical custody keep their respective bodies local.

An unattended corpse transfers its remaining tissues to the regional food web.
Regional feeding and decay debit that inventory, and a revisit can take local
ownership only of what remains physically present and unreserved. Previous
player sightings remain dated observations, not a feed of remote health, deaths
or movements. Native terrain parcels are not redebited or refilled on reentry.

Within a visited native window, [positioned anonymous wildlife remains](WILDLIFE_CARCASSES.md#visited-native-terrain)
are available to local scavengers that sense and physically reach them. Local
feeding spends the same unreserved tissues regional feeders use. Overlapping
windows, reloads and continued runs preserve the depletion without spawning a
local copy. The scientist sees only remains actually in sight.

Larger real encounter geometry, ordinary marine/subsurface access,
route/logistics and strategic consumers remain in the existing D acceptance.
The bounded adapter is **not completion of catalog-wide ordinary-play encounters**.

### Foreign survey ground and adjoining seams

The foreign survey uses one metre-based regional frame and one native owner for
its existing connected local patches. An entrance with a recorded approach
position uses it. Where the route specifies only neighboring hexes, the
entrance uses a fixed interior offset on the approach-facing side of the land
habitat. That calculation depends on geography, not animal positions. The frame
is saved at the original entrance; the next patch does not choose a new origin.

Opening a seam to walk across does not expose the next patch's terrain or
inhabitants. After the physical crossing, the materialized floors join the
same site and only newly visited terrain draws from the original habitat
parcel budget. A full-size beast may occupy both sides once its footprint has
ground support and clearance throughout. Existing local actors keep their
timers and condition, and regional remains are not made into new corpses.
Withdrawal returns unattended individuals to the regional account. Reload and
return keep the original site and terrain; encounters still depend on who is
actually there. This is terrestrial access along the existing survey itinerary,
not all-family travel access, live background wildlife spawning or a new
strategic safety report.

The focused browser itinerary books and rides the survey vehicle, walks the
recorded entrance and eastern seam, and shows the original roughly 500 kg
Nullmaw in both Canvas and DOM. It also checks reload, withdrawal and return.
The recorded-entrance fixture makes that contact repeatable; it does not
measure how often an unspecified ordinary entrance yields a sighting.

### Wetland banks on ordinary foreign surveys

A mapped wetland can supply a dry-bank approach to the existing on-foot
survey. The approach uses the original area and the bank of an archived
wetland bed where present, otherwise the mapped basin's west rim. It does
not query residents or relocate them. Recorded arrivals and previously
visited frames take precedence. Uncharted catchment ponds do not reroute a
survey.

Visited bank and water tiles share the same local metre frame but each
draws only from its own source account. The wet side takes actual water
from the wetland; it does not refill when revisited or overlap the dry
parcel debit. Unfunded or insufficiently deep water cannot take custody of
a swimmer. Existing navigation treats deep water as unwalkable to the
scientist. The encounter does not add a swimming mode, boats or new
strategic connections.

The swimmer must fit its original water, depth and full visited footprint.
It stays in the wetland account on withdrawal; this pass does not support
inter-habitat movement across the bank. Study views mark only perceived
water and bodies. Light, cover and the parcel's freshwater condition
constrain sighting; a submerged animal does not create dry tracks. An empty,
unvisited, dry or obscured window is not a population or safety report.

The focused Chromium itinerary reaches an original Mire Choir bed without
a local arrival override, refuses a walk into deep water, and shows the
original swimmer and observed water in Canvas and DOM. Reload, withdrawal
and return retain the same original identity. The matching terrain check
claims no swimmer from dry or unvisited tiles and does not debit water
again when those tiles are revisited.

#### Private field notes and received copies

An original creature actually seen on an ordinary foreign survey supplies a
private, dated field note. It records the scientist's witnessing body, the
survey trip, the visited patch and a visible point on the creature, and its
observed condition or activity. The Journal retains the latest note per
original and patch when the scientist returns home. A note is not a trail:
leaving sight, leaving the site, or loading a save does not advance its date.
Hidden beasts, tracks alone, and quiet or unvisited ground create no sighting
and cannot certify safety. Older surveys are not backfilled from saved
population facts.

The original witness can share a chosen copy in person with the existing
municipal sampling clerk at the powered desk. No sampling permit is needed
to give the clerk an old note. This spends existing reception work and
power and stores the exact observed account at the receiving institution
with a separate receipt date. No recipient sees private notes or their
updates before handoff, and future sightings cannot alter a received copy.
Original population, source and member keys bind the account internally;
the readable note does not reveal a hidden position, reserves, a census, or
anything about the rest of that population. Authority responses and victory
evaluation remain outside this handoff.

### Mapped shoreline encounters

The ordinary on-foot foreign survey can open a bounded dry shore beside a
mapped ocean hex. The local transect refines the existing land–sea edge from
globe geography, not from wild population positions. Saved approaches and
mapped freshwater banks keep their own layouts. Dry ground debits the
original shore account; the adjoining water debits the original saltwater
column. The sea frame projects back into that column's original metre grid,
including turns, withdrawal, and reload. A revisit does not refill either
account. The scientist cannot enter those seawater tiles, and the survey
does not create a boat, a route past the coast, or a dive.

An original body must fit entirely in the funded water and retain its real
depth and dimensions. From dry ground the scientist can mark one actually
visible point on a creature that breaches or lies within the local clear
column, subject to light and line of sight. The sighting or field note is
dated and refers to the marine hex. It does not record the hidden anchor,
body footprint, tracks, nest, family, or ongoing safety. A deeper figure can
remain unobserved even when it physically occupies water near the shore.

New-world generation can bind an already allocated Reef Wyrm group and
its existing reef workface to a mapped shallow shelf in its own sea cell.
This does not change individual counts, stock budgets, or the distribution of
archived worlds. No survey searches for a beast or moves one to shore; an
empty or unsuitable coast can stay empty. Marine anonymous carcass recovery
and other marine survey methods are not opened by this encounter.

The focused Chromium itinerary reached one generated shelf on foot, denied a
step into seawater, showed the original Reef Wyrm in both renderers, and
preserved its identity and dated note through withdrawal, reload, and return.
Focused native checks also cover a rotated shoreline, no refill, depth and
clarity limits, and unmodified archived source counts and budgets.

### Burrow mouths on dry-ground surveys

A foreign surface survey can reach a volcanic fissure where the original
geology supports an open dry rim. The cut and its rock screen come from the
geographic site, not a lookup of nearby originals. The dry approach uses
surface parcels; only the aperture can expose finite parcels of that cell's
subsurface account. Solid or unstable geology does not open a view. No
walkable tunnel, mining access, or new mineral reserves are granted.

Only a body that physically fits the reached aperture can appear at that
opening. The scientist must have light and a clear line to an exposed part
above the lip. A visible fissure is a geological observation, not a report
of occupancy. A blocked line, covered opening or entirely buried original
does not earn a creature note. A sighting does not expose a body anchor,
unseen brood, colony size, or the tunnels below.

New worlds can place one already allocated Burrowing Furnace group near
such an aperture in its original habitat. This positions the original group
at world creation without adding individuals or mineral stock. Existing
worlds and already established survey windows retain their placements.
Visits do not pull residents toward the rim or move them through rock.

The focused Chromium trip observed no creature behind the rock screen, then
recorded one exposed original from the dry rim. The opening refused walking;
withdrawal and reload retained the dated note, and the return used the same
individual. Native checks also cover unsupported and covered openings,
conserved minerals, and archived source compatibility.

### Population-backed local walking encounters

The home-side leg of the existing local municipal survey walk can now read the
same surface account as wilderness visits. It uses the saved measured route
and a recorded approach position when supplied. A distance-only leg inside its
origin habitat uses a fixed east–west transect on the habitat's metre grid.
An unplaced leg is not a search for a nearby group. Intercity marches, charter
vehicles, the other leg, and roads already carrying legacy originals do not
transfer ownership under this adapter.

Travel samples only distance actually walked. A fresh roadside stop requires a
lit, unobstructed sighting or a body occupying the traveler's immediate forward
lane. An off-lane hidden beast is not a stop, sound cue, scouting report or
known location. Existing known camps and other ordinary stopping reasons still
work. The private check uses the reached habitat's group index and skips empty
formation envelopes. It does not materialize a preview body, charge terrain or
write a sighting when there is no contact.

At a physical stop the encounter claims the actual original with the same
habitat ledger, body footprint and reserves as a wilderness claim. Adjacent
roadside views share terrain parcels. Withdrawing returns unattended animals
at their last actual positions, keeping wounds and elapsed history. The local
map shows only current observations; a known stopping point is no guarantee of
recontact or road safety. Existing legacy owners and identities stay intact.

The focused Chromium itinerary used a recorded approach in a generated world.
It passed unseen ground without registering a site, then encountered the
original Nullmaw, saved its wound, withdrew, and met the same wounded body on
the return. This verifies custody and observation, not ordinary sighting rates.

### Native encounters on the municipal grain road

One bounded interior land span of a supported agricultural quota road uses the
same native population owner as wilderness and walking encounters. Its metres
come from the ordered original city–farm cell path and a recorded approach
anchor where present. Distance-only records use one fixed local transect in the
selected source habitat. Endpoint cities, other legs, and routes already using
legacy suppression or Mirror Ape encounters are not converted by this adapter.

The existing truck checks only ground it actually reaches, in chronological
metre steps inside the span. A visible off-lane animal does not hold the truck
or materialize a roadside visit. A body occupying its forward lane can hold the
original truck and driver with their original load. The actual animal is claimed
at its position, can move using its real body and reserves, and returns to the
regional account when the last actual attendant leaves. A neutral animal that
still sees the stopped truck waits on the verge instead of immediately resuming
its patrol across the lane. Tired walkers settle a committed stride or turn
before resting; a blocked movement earns no refund. A short clear interval
lets an operable original carrier resume without backfilled distance, fuel or
cargo credit. There is no new detour, contact teleporter or roadwide guarantee.

The witnessed position, wait and observed cargo outcome belong to the driver's
dated account. The report becomes available through the existing received dock
receipt only after actual return. Neither a held truck nor a late truck exposes
a live beast position, driver health, cargo verdict or city-power conclusion.
The scene itself is not added to the scientist's known roads unless personally
reached. Legacy contacts, military consequences and authority consumers retain
their previous ownership and scope.

The focused Chromium trip passed a visible original Nullmaw without stopping,
reloaded an actual hold for that animal, and delivered the full original load
with the same truck and driver. Its dated road account was only exposed after
receipt at the dock and survived a second reload.

#### Missed grain delivery windows

New municipal quota orders post a fixed dock deadline at issue: the planned
original road legs, a depot and boarding allowance, and the per-crate load
and unload times for the requested amount. Road holds, recovery and changes
to a journey's live ETA do not move the dock deadline. Orders saved before
this rule are not assigned a retroactive deadline.

At the deadline the dock records only requested grain, actual unloads by
then, the resulting shortfall, and the state of this quota contribution.
A crate unloaded at the deadline counts as on time. A hold alone neither
feeds the city nor spoils the load. Only actual stock covers continuing
demand, and this small municipal buffer does not represent the whole city.
Late unloading adds the same conserved cargo to the buffer and does not
erase the missed window. Cancelling the instruction before departure can
waive the outstanding deadline, but cannot erase a miss already recorded.

The player must receive the existing dated counter report to see the dock
entry. The deadline entry never claims a cause or remote position. A driver
account of the road contact is separately available only after physical
return and receipt. The original order links the two records without giving
the city, the strategic evaluator, or the player a live report from the road.

The focused native-road case holds a loaded inbound carrier past its
deadline, restores the saved hold, and checks exact late cargo credit and
separate cause reporting. The Chromium trip independently blocks the dock,
reloads the missed window, and verifies that the player sees it only on
receipt and still sees it after the full load arrives.

### Refuge defense against a native original

The existing two-person refuge watch can record a local defensive outcome
against a population-owned individual. The guard must identify a real,
resolved attack on a guard near the signed posts, inflict actual health
loss that crosses the existing wound-driven flight threshold, and see that
same original physically move its footprint outside the defended area while
fleeing. A missed blow, an already fleeing or passing beast, or later
unwitnessed movement does not qualify. Loss of sight leaves the outcome
unconfirmed. A retreat uses the ordinary body movement and finite original
effort; wounded flight is not replaced by a fresh hunt or work decision.

When the existing operation has to withdraw during a witnessed attack, a
surviving witness can report their own physical withdrawal after crossing
the defended area. An order, an incapacitated guard stuck at a post, and the
usual completed-watch return do not count. Existing injuries, cost, duty
and custody remain unchanged. The original beast carries its wounds back
to the same native account when unattended; there is no new encounter body.

Only personally received guard accounts expose a dated account of the
episode. One guard does not stand in for the other, and no observation
refreshes the received copy on its own. Neither outcome certifies future
refuge safety, strategic control, or suppression of the original population.

### Original encounter ownership

Survey, walking and grain encounters now check the same run-local ownership
boundary. A native claim comes from an original individual whose body was
actually allocated from the exact archived habitat source, not from opening
the regional ecology or sighting an unclaimed body. The claim persists after
the last attendant leaves. Older saves recover it from original actor custody,
including a returned individual stored in a regional cohort. This does not
require loading or replaying the whole globe.

An original Rimefang or Gravebloom Elk ledger and a Mirror Ape troop reservation
block new native allocations of the same population, even if the reserved apes
are not on the map. A prior native claim likewise blocks legacy registration.
Existing bodies, health, losses and dated reports stay with the account that
recorded them. If both claims already exist, or the only record is an
unattributed reservation, new allocations are blocked; the disputed legacy
roster cannot supply current strategic proof. A route link by itself does not
own a population. No historical records are merged, no dormant capacity is
counted as a casualty, and this does not establish ecological viability or full
cross-engine demographic integration.

Focused native unit controls exercise actual originals across all 24 body
families using suitable source regions and explicitly supplied physical contexts;
they do not establish that ordinary travel reaches every family. Browser controls
use a Node-generated source, an authored public test starting parcel and a
controlled geographic window, then the actual field/render/save/import paths.
The DOM control uses the default 10,242-cell globe; Canvas uses a compact globe.
Both preserve the observed body and terrain through reload and continued import,
and initialization itself earns no game time.
Neither kind of control certifies the generated ecosystem or all itineraries.
Already materialized legacy sites keep their actual bodies on load. Node/browser
portability validation allows only derived east/north coordinate roundoff: ten
nanometres near zero, or two floating-point epsilons for large coordinates. It
does not change the archived values or source hash. Counts, resource budgets,
areas, membership and non-coordinate fields remain exact. Original positional
anchors use recorded nursery coordinates rather than recomputed trigonometry.
Focused controls compare eager/lazy generated history for one day, empty wildlife
and hydraulic components across a monthly boundary, actual migration, partial
event saves, cancellation and legacy eager deltas. They are execution-equivalence
checks, not new ecological viability certificates.

## Fixed D acceptance still unfinished

The [current integrated seasonal control](SEASONAL_VIABILITY.md#current-integrated-120-day-control)
executes all 24 species for 120 days on source `e8a02b1f`, with conserved
membership, reconciled species-level intake and twelve validated checkpoints.
Habitat maintenance now passes in this sample, but five species retain feeding
losses (including Lantern extinction), original-beast contacts remain zero and
native adoption is only partially connected as described above. It remains rejected. The following four existing
requirements are unchanged, not replaced with another prompt sequence.

1. Successful source allocation repair and full seasonal initial viability,
   including supplied ecological opposition and original source adoption without
   duplicating the existing Rimefang/Elk/Mirror Ape consumers. Generated proposals
   and strict diagnostics now exist; their tested rejection is not completion.
2. Finite natural formation sites and sustained food-web/source integration using
   the existing data and C behavior. The approved eight additional work adapters,
   paid Ironroot work/Thunderback pressure and causal decline/exhaustion/recovery
   now execute in supplied workfaces, alongside batched growth/recruitment, local
   hunts, shared carcasses and original-body handoff. This does not establish
   all-species regional viability, ecological opposition/defense or actual
   generated-source adoption.
3. Native integration with world/run persistence, ordinary travel, supported human
   logistics, correctly sized/mediated physical encounters and legitimate dated
   observations. The bounded wilderness adapter above connects original claims
   and run persistence with default-globe opening, but long-run default-world
   execution, ordinary all-family access,
   route/logistics, source-owner reconciliation and strategic outputs are unfinished.
4. Focused native DOM/Canvas, source-class, save/import, death/knowledge and
   strategic-output acceptance for the whole package. World-domination evaluator
   integration remains in the already-listed 3.35d-D/E, not this package.

Do not remove D, lower the queue count, or present the account model as completed
regional gameplay until these existing acceptance requirements pass. No species,
follow-up prompt or additional certification gate is authorized by this document.

## Focused checks

For changes to the bounded native adapter, select its named cases rather than
running every command below:

```sh
node --test --test-isolation=none tests/beast-native-populations.unit.test.js tests/beast-populations.unit.test.js
npx playwright test tests/beast-native-populations-browser.spec.js tests/beast-habitat-sources-browser.spec.js --project=chromium --workers=1
```

The current native/source browser selection has four passing cases, including
actual DOM/Canvas observation, normal reload, continued file import, immutable
world identity and guarded default-resolution compressed storage. Native unit
coverage also includes all 24 body-family controls, depleted bodies, original
deaths, independent runs, blocked volumes, finite shared parcels, invalid custody,
unfunded-child refusal and a million-member range query. These focused checks do
not imply a full-suite run or completion of the remaining D requirements.

```sh
node tests/beast-populations.unit.test.js
node tests/beast-population-scheduler.unit.test.js
node tests/beast-demography.unit.test.js
node tests/beast-regional-ecology.unit.test.js
node tests/beast-regional-work.unit.test.js
node tests/beast-predation.unit.test.js
node tests/beast-behavior.unit.test.js
node tests/beast-seasonal-journeys.unit.test.js
node tests/beast-habitat-sources.unit.test.js
node tests/beast-habitat-bindings.unit.test.js
node tests/beast-regional-foodweb.unit.test.js
node scripts/benchmark-generated-beast-habitats.js
npx playwright test tests/beast-habitat-sources-browser.spec.js --project=chromium --workers=1
npx playwright test tests/beast-regional-foodweb-browser.spec.js --project=chromium --workers=1
npx playwright test tests/beast-regional-ecology-browser.spec.js --project=chromium --workers=1
npx playwright test tests/beast-predation-browser.spec.js --project=chromium --workers=1
```

The sixteen current model checks cover source typing/all 36 profile identities,
calendar boundaries, conserved claims, continuous hazards, resource depletion,
knowledge-independent choices, staggered journeys, failed arrivals and starvation,
interrupted supplies, duplicate-death exclusion, save validation and independent
copies. Eight shared-seasonal checks cover multi-edge timing, midpoint billing,
queued returns and lateness, hidden-truth-independent routes, obstructions,
half-edge reloads, actual renewal boundaries and no-will/mid-month starts.
Seventeen additional source checks cover geodesic area/volume, all 24
species, counting units, finite stocks and prey allocation, seasonal failures,
knowledge-isolated traditional routes, shared supply competition, early depletion,
unfinished late journeys, refusal of invalid proposals and canonical world
preservation. Two source browser cases cover actual browser generation,
compressed world storage/reload (including the default-resolution globe), private
diagnostics and refusal to activate a rejected proposal. Fourteen local food-web checks cover original claims, death/corpse custody,
perception/scale/pack limits, failed/interrupted hunts, shared feeding/decomposition,
starvation, unseen prey death, reload/continued copies and final-death boundaries. Native DOM/Canvas
cases perform a sensed Rimefang hunt, actual combat kill and feeding, retaining
partial pursuit and corpse state across reload without private-state disclosure.
They use prepared original local sources, not proof of generated regional source
adoption. No check claims completed world-level balance or universal encounter
coverage. The full suite remains opt-in under repository policy.

Twenty-one demographic checks additionally cover matter/energy conservation,
maintenance priority, real incubation, elapsed-day attempt rates, original colony
roles, fragmentation, interruption, compact large losses, cohort merging, arbitrary
read/reload chunking, malformed records, moving gestation, original nursery
occupancy, same-colony live furnace binding and paid local maternal/offspring handoff.
The focused headcount and longer-history benchmarks are reported separately from
native play. No full-suite run is implied by the commands listed here.

Nineteen regional ecology checks cover original source/area declarations, paid
work and shared effort, real material/energy interruption, independent channels,
no duplicated food credit, seasonal lows, causal contributor/site loss,
shortage/dispersal/death, gradual original-body return/recovery, detailing,
partial-work serialization/continued binding, final-death freeze, contributor
provenance under merging and compact
million-body scaling. A browser check uses the actual index dependency order and
internal model serializer across a reload. It deliberately does **not** claim
native game-save adoption or ordinary-play regional encounters.

Thirty-four regional-work checks cover the complete eight-adapter set, physical
inputs and receiving limits, shared colony capacity, consent withdrawal, marine
body geometry, finite connected flow, downstream scarcity/flooding, breach and
debris, paid bed destruction, damaged towers and original-body handoff, arbitrary
read chunking, partial-work saves, independent/continued branches, final-death
freeze and million-member batch scaling. A second browser case executes all
eight adapters through the actual index dependencies and reloads partial work;
these remain internal-model checks rather than claims of native source adoption.

Thirteen generated-binding checks cover original material/rainfall conservation,
marine geometry, finite shared nursery area, preserved counting units, real
drainage, missing metal/consent, compact mortality, source tampering, unchanged
legacy archives and paid execution with saved/continued/independent copies. The
source browser case also checks the recorded bindings through compressed world
storage and partial diagnostic continuation using the actual index dependencies.

Twenty regional food-web checks cover elapsed original hunts, failed/blocked
opportunities, escape and finite effort, heard same-group support, personally
observed antagonism, real contributor death, single-owner feeding/decomposition,
distributed/unlocated remains, source matter/provenance validation, paid reserve
recovery, partial handoff, save/continued/independent copies and final-death freeze.
They also compare sparse work at ten versus one million original members and
bound dense-bin candidate work. The browser check reloads an actual pending
contact and consumes its resulting corpse without disclosing private records.

Thirteen regional scheduler checks cover fixed local visit counts at 2 versus
300 unrelated regions, unchanged unrelated trajectories, scoped/full read
idempotence, asynchronous save/continued branches, corrupt clocks, empty worlds,
hydraulic/care/dream dependencies, midpoint mortality residence, bounded heap
metadata, exact paid growth/matter/mana targets and regional pending-contact
continuation. They gate structural locality and conservation, not a hardware
millisecond threshold or generated-world viability.
The additional browser reload case preserves unequal regional clocks and proves
that a scoped read neither settles unrelated ground nor rebuilds cached rates.
