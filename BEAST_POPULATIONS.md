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
pulses still visit the world. This is event localization, not skipped physiology
or reduced populations. A large connected river/care component can still be
expensive. Local contact resolution visits its affected accounts; the scheduled
daily contact search retains its existing bounded spatial index and budgets.

Saved `regionClocks` hold each region's `appliedAt`, `nextEventAt` and daily-work
flag. Root `clock` is processed time; root `appliedAt` is the oldest regional
settlement, **not a claim that every account has the same timestamp**.
`settleRegions` reads selected dependencies; `advance(..., true, true)` explicitly
settles a whole snapshot. Neither read recalculates rates or rerolls choices.
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

`runtimeSource` refuses these rejected/unverified proposals. Diagnostic expansion
is marked `diagnosticOnly`, which `beast-populations.create` also refuses. Source
validation reconstructs physical areas and initial counts from the world, so
re-signing an inflated table cannot create extra supply. Valid original habitat
placements and advisory diagnostics from older archives remain immutable rather
than being regenerated by improved checks. Activation also reruns current
physical feasibility; an old advisory success cannot bypass it. No proposal or failure
detail is copied into public beast reports or the world-library interface.

### Recorded physical source execution

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
cycle stays incomplete; a completed replay with shortfalls stays rejected.
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

## Fixed D acceptance still unfinished

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
   observations. New-world source generation is wired into the library, but the
   account model is not connected to live encounters and does not remove existing
   contact-only restrictions.
4. Focused native DOM/Canvas, source-class, save/import, death/knowledge and
   strategic-output acceptance for the whole package. World-domination evaluator
   integration remains in the already-listed 3.35d-D/E, not this package.

Do not remove D, lower the queue count, or present the account model as completed
regional gameplay until these existing acceptance requirements pass. No species,
follow-up prompt or additional certification gate is authorized by this document.

## Focused checks

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
