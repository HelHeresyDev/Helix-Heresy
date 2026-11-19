# Spatial wildlife carcass batches

Implemented inside the existing #3.38-D scope. No creatures, metabolic values,
resource grants or pending packages are added. `wildlife-carcasses.js` supplies
deterministic local carcass views for newly marked `wildlifeCarcasses` proposals;
their compact wildlife record also marks `carcassBatches`.

## Source, location and scale

Every carcass still starts with a real integer death. Live membership and body
matter are debited once; the existing guild/size/patch inventory remains the
aggregate conservation account. Natural mortality records compact dated batches
of cumulative dead individuals and their actual mean body mass. Starting deaths
retain the existing seven actual tissue ages. This is not extra food or a second
inventory that another consumer can spend independently.

An implicit equal-area polar hierarchy partitions those integer deaths inside
their original habitat footprint. Seeded remainder order allocates each prefix
of deaths monotonically: a later death cannot relocate an earlier corpse.
Spatial leaves have a bounding-box diagonal at most 16 m. Each has one fixed,
seeded representative position; nearby bodies share that local batch. This is
an explicit coarse positional approximation, not individually simulated bodies
or a claim that their exact sub-cell locations are known.

Only queried local leaves need expanded tissue rows. Unqueried deaths remain
compact dated records. Materialization reconstructs their actual elapsed decay
without adding bodies, depositing decomposition twice, rerolling positions or
moving remains to an animal. Subsequent real deaths update already-resolved
leaves from the same allocation. Growth cohorts dying on the same date may have
different body masses; the dated records retain those separate contributions.
Storage grows with death batches and visited occupied locations, not one object
per represented creature. It is not a constant-size infinite-history database.

Actual predator catches instead leave a point batch at the performed catch's
regional position. Positions within a 0.1 m Cartesian cell may share a row;
their maximum separation is below the smallest authored feeding reach. These
deaths do not get redistributed across the habitat's natural-mortality layout.
Predators consuming flesh leave the same organs, fluids, tough tissue and bones
for compatible scavengers. Fish remains stay at their school depth; this pass
does not invent surface flotation or make submerged fish available to Lanterns.

Spatial queries use bounded hierarchy traversal, capped at 4,096 nodes per pool
per call, with explicit `complete` results and transient truncation counters.
Immutable geometry and conservative broad-phase query caches are disposable;
exact distance/depth and current available tissue are checked after the cache.
Cache construction never grants animal knowledge or alters death allocation.
Geometry caches are cleared above 32,768 entries, and query caches above 32.
No per-animal strategic planning or per-frame corpse update is introduced.
The measured isolated replay has **zero query-budget truncations**. A truncated
query is incomplete evidence, not an empty-habitat or healthy-world certificate.

## Feeding and custody

For new spatial inventories, an actual encounter exposes locally reachable,
body-sized material rather than the fraction of a habitat-wide carrion coating
under a mouth. A scavenger's initial claim is capped by remaining per-body
material and actual contacting membership. It may take further finite meals;
discovery alone does not reserve tissue or fill its stomach.

All local reservations, consumption, reserved decay and releases reconcile with
the aggregate account, tissue by tissue. Free tissue decays once in the aggregate
and once in its reconciled local view; only the aggregate flow pays detritus or
overflow. Those are two views of the same material, not two output flows.
Validation checks provenance, integer deaths, deterministic positions, canonical
leaf sizes, starting mortality, body matter and shared tissue custody.

Lanterns use their existing local sensing, bounded approach, stamina, real wind
and feeding reach. A fixed corpse site does not steer them from afar or provide
a route oracle. Unknown or hidden destinations do not influence migration.
Statistical background hunts retain their existing paid search approximation;
their actual catches leave remains at the search's performed regional position.
Existing source species and habitat restrictions still apply.

A feeding hold may use exclusively reserved hard/tough structure from **one
corpse**, not a batch's combined weight. Remaining structure per original body
conservatively limits support, including decay. Approximate corpse dimensions
use a compact 1,000 kg/m³ body-volume reference, not a new animal physiology.
Small bodies cannot collectively anchor a large aerostat merely because many
share a row. A nearby body's support and current wind determine whether a
sixty-second handling interval is physically possible; provably unsupported
classes can be skipped without expanding their hidden corpse locations.

Handling clipped by lost contact or interruption no longer counts as completed
handling. Spent effort remains spent, custody is released and no microscopic
ingestion is awarded from an unfinished action. Handling requirements survive
saves. Uneconomic sites have a bounded, saved review map (at most 64 entries,
one-hour retry); this neither removes the corpse nor refunds effort. Actual
wind changes, leaving reach, departure, detailing and death release finite
custody through the existing pipeline.

Old unmarked source proposals and continued accounts retain their original
aggregate fields and acquire no newly reconstructed corpses. Their existing
finite quantities remain valid; the general interrupted-handling correction
also applies to newly scheduled actions. Reusable world definitions never
receive mutable corpse rows from a run or a continued branch.

## Targeted 120-day generated control

`node scripts/replay-carrion-lantern.js` uses `source-small`, refinement 2, source
`beast-habitat-source:5cddbb5e`. It retains the original 120 Lanterns, geography,
wind, water and finite wildlife; other strategic species and their kills/work
are excluded. The initial anonymous body counts and funded starting remains
are unchanged from the preceding distribution pass.

| Day | Living original Lanterns | Cumulative wet tissue eaten | Anonymous wildlife eaten |
| --- | ---: | ---: | ---: |
| 20 | 116 | 0 kg | 0 kg |
| 40 | 71 | 1.690274 kg | 0 kg |
| 60 | 71 | 1.690274 kg | 0 kg |
| 80–120 | 0 | 1.690274 kg | 0 kg |

All ingested material is from actual original Lantern corpses. There are
37 approach starts and 2,445.1604 individual-seconds of paid approach. No
Lanterns are born. Original losses reconcile as 96 starvation, nineteen
dehydration and five background deaths; atmospheric intake is 151.818840 L.
Every twenty-day normalization checkpoint passes.

The final account has 698,085 compact natural-death batches and 5,519 resolved
local sites, representing 106,998,114,155 actual anonymous deaths over the run
and its starting history. Resolved sites retain 26.031286 kg; 96,234,272.218540 kg
remains in the implicit spatial account. There are 3,726,240 query calls, many
cache hits, 1,843,484 actual hierarchy-node visits and zero truncations. These
transient work counters are not biological save state and reset on a fresh
process/import.

The measured run takes about 68.1 s while other focused work executes:
60,593 boundaries, 522,280 cohort integrations, 110,211 regional rebuilds and
45 final strategic cohorts. Earlier density-field ingestion figures are
historical results of that approximation, not evidence of actual corpse access
under the new model. Concentrating remains does **not** make this generated
scavenger allocation viable, and isolated survival does not establish complete
food-web balance. No reserve, corpse, wind strength or sensing range was tuned
to force a survivor.

## Complete food-web replay

`node scripts/benchmark-generated-beast-habitats.js --days=120` completes the
same source with all 24 authored species, 89 original populations and 334
regions, including actual competition, paid care, ecological work, travel and
predator leftovers. All ten-day normalization checkpoints and the final private
replay validate. Its assessment is **rejected**, not normal or exhausted.

| Account | Original | Paid births | Living | Dead | Hunted separately |
| --- | ---: | ---: | ---: | ---: | ---: |
| Strategic bodies | 56,243 | 190,892 | 130,872 | 116,263 | Included in dead |
| Anonymous wildlife | 97,503,071,748 | 76,667,472,436 | 67,161,349,570 | 106,998,479,541 | 10,715,073 |

Strategic losses are 116,029 background, 205 starvation and 29 dehydration.
All 120 original Lanterns are accounted for as dead: 96 starvation, nineteen
dehydration and five background. Including the other species and their
leftovers has not established viable generated Lantern access.

Actual anonymous-carcass ingestion is 503,446.300525 kg; original strategic
remains supply 5,250.808730 kg across the model's feeding consumers. These
are whole-food-web totals, **not Lantern-specific intake**. There are zero
original-beast duel contacts/kills, so this cannot certify representative
military encounters. All 21,215 travelling survivors remain positioned, with
zero unlocated living bodies; 68,382.926234 kg of original strategic remains
still lacks a usable position and is not treated as accessible food.

The assessment reports 61 performed resource-shortfall records, totalling
574,116.423535 kg of meat/food-account shortfall and 2,139.661303 L of water
shortfall. Source availability still records 38 missing physical work sites,
eight unverified original furnace-metal sources and 32 unverified dream
participant sources. These are the existing D constraints, not new prompts.

The measured execution takes 1,696.1 s (about 28.3 minutes) while other focused
work also runs: 511,560 boundaries, 100,745,850 cohort integrations and 677,945
regional rebuilds. The final expanded account is 115,047,958 bytes, with 2,664
groups and 14,127 strategic cohorts. This is not an isolated performance
comparison or evidence that expanded accounts fit native browser-save quotas.
Compact reusable world storage and independent partial browser continuation
have separate focused coverage. Traversal counters were added after this
complete-food-web process started; its report does not supply those counters.

## Verification and acceptance boundary

Focused checks cover actual death/age/tissue conservation, whole-body local
encounters, query-order independence, million-fold headcount scaling, bounded
queries, exclusive custody, predator leftovers, single-body anchoring, interrupted
handling, wind changes, import corruption and independent continued branches.
Browser checks exercise partial held feeding across a real reload and continue
existing generated-world storage and native/regional approach coverage.

Verification passes 117 focused unit checks in the wildlife, foraging, habitat
source, approach and wind files, plus three selected Chromium cases. The full
test suite was not run under repository policy. The two 120-day replays are
targeted model diagnostics for this change, not a broad regression-suite run.

This completes the approved spatial-carcass correction, not all of #3.38-D.
The generated source remains rejected until the existing food-web, formation,
native-adoption and strategic-output requirements actually pass. Failure is
not automatically exhaustion. The queue remains at eleven active packages;
the tutorial stays deferred and no replacement prompt is added. No species or
lifecycle spreadsheet values change in this pass.

## Visited native terrain

When the scientist visits a population-backed wilderness window, a forager can
encounter only existing carcasses at actual positions in that window's mapped
terrain: the right layer and depth, unobstructed and outside protected
ground. Sight or scent can attract a beast, but feeding also requires its own
reach and a clear line of effect. The scientist's encounter panel lists only
remains in sight, not unsensed bodies, held tissue or regional food totals.

The local target is a transient view of a regional row, not a new corpse actor.
A bite debits the same spatial row and its aggregate pool and cannot spend
tissues reserved by a regional feeder. Regional decay remains the sole owner of
decay for that row; local wildlife remains are not separately decay-ticked or
placeable in ice caches. Re-entering or overlapping a window does not regenerate
matter; a continued branch inherits the saved remainder and then spends it
independently. Unpositioned legacy stock remains unavailable and this doesn't
spawn live wildlife.

A local Carrion Lantern needs sixty seconds of continuous supported handling
before it can ingest. Current wind, bodily effort and what remains of at most
one body's unreserved structure determine whether it can hold. This does not
change regional starting supply or seasonal viability.
