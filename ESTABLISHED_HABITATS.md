# Established habitat work sites

This implements the approved generated-work-site correction inside **3.38-D**.
It is not generated ecosystem acceptance, native encounter adoption or another
queue package. Optional powers need not operate continuously; only performed,
supplied work contributes to ecological maintenance.

## Geography, capacity and materials

New source records carry `establishedHabitats: true`. Their physical bindings
retain finite work faces, actual original group assignments, reused nurseries,
input partitions, availability reasons and construction receipts. Unmarked
archives reconstruct their original allocations unchanged.

- Rivercoil sites follow actual adjacent canonical downhill drainage, including
  runoff below the map's visible-river threshold. Terminal basins get no invented
  outlet. Flow still partitions original water and rainfall; it is not regenerated
  downstream or multiplied for each group.
- A region/action shares one feature-first work face. Its position depends on
  geography and feature identity, not hungry animals or group headcount. Existing
  originals are allocated at that feature during generation; runtime workers
  do not teleport back after departing. Dam faces use the actual outlet approach.
- Each face occupies at most one hectare or 1% of its patch, whichever is
  smaller. Its footprint and body dimensions cap concurrent workforce. Groups
  share that cap, not copies of it. These are explicit allocation calibrations,
  not newly discovered biome properties.
- Furnaces remain separate, same-colony structures. Hives sharing a feature
  split its space and original material share. Construction stone, refined metal
  and fuel receive finite proportional site-local stock accounts. The remainder
  stays regional. Recipes cannot silently use that remainder or another site's
  stock; no construction/metal/fuel renewal is added.
- Water, nutrients, air and other existing regional accounts retain their
  established shared supply/depth constraints. A positioned site does not turn
  the whole patch into reachable workers: execution uses the existing body,
  personal, maternal and arrival formations. Conservative cohort bounds must fit
  inside the face; there is no per-animal work loop or automatic subdivision.

Destroying a face records its remaining local material and actual structure as
debris outputs once. It does not delete unrelated regional reserves. Departure,
injury, refusal, depleted inputs and lost medium stop unsupported future work.
An existing dam retains only its actual hydraulic effects after its builder dies.

## Paid pre-run construction

An original dam or furnace may start partly built, but only with a recorded
construction-only history. The allocator considers at most the preceding game
month, checks its temperature, and caps labor by original mature cohort ages,
membership and physical workforce capacity. Only same-colony ant workers build
furnaces. It debits the authored construction recipe plus actual worker food,
water, mineral and energy maintenance from existing supplies, then records the
structure and maintenance outputs.

The initial target is at most 25% of structural capacity, reduced by whichever
input or labor constraint binds first. Receipts name the original cohorts,
worker-days, before-start interval, exact input accounts and built mass. They do
not credit past nurturing, rain, births, future smelting or future mining.
Runtime performed-work counters start at zero. These receipts are a bounded
construction account, not a replay of the world's entire pre-run ecosystem.

Raw stone and geological potential are **not refined metal**. No refining
ability, human supplier or abandoned metal cache is invented to fund ant hives.
Prepared original sources with real metal and mature workers can fund a furnace;
the current canonical sample has no such metal supply and its hives stay dormant.

## Dream participants and consent

Generated dream sites may be dormant with an empty participant list. No person
is moved, spawned, put to sleep or made willing to fill it.

The internal `setDreamParticipants(account, regionId, siteId, groupIds, at, cause)`
event records actual surviving, capable, present groups within physical reach.
It does not grant sleep or consent. Existing `setEcologicalActivity` records
those independent states. The tortoise and every selected other participant
must actually be sleeping and consenting before the existing paid weather recipe
can run. Unwilling, departed, dead or out-of-reach participants cannot support it.
Withdrawal interrupts only future work; spent atmospheric water/mana and prior
rain remain spent/produced. Serialization and continued branches preserve this
state rather than renewing participation or consent. This is an internal account
adapter, not a new player-facing consent interface or weather system.

## Measured generated control and limits

For seed `source-small`, refinement 2, source
`beast-habitat-source:9b62d184` retains all 24 species, 89 original populations,
334 regions and 56,243 located strategic originals.

| Account | Result |
| --- | ---: |
| Missing physical work-site assignments | 0, previously 38 |
| Shared dam sites | 5 |
| All finite work sites | 37 |
| Reused original nurseries | 2,615 |
| Paid initial construction | 399.2004 kg across 5 dams |
| Original construction labor | 3.992004 worker-days |
| Hives without refined metal | 8, dormant |
| Tortoise groups without recorded willing sleepers | 32, dormant |

A fresh quarter-day execution normalizes successfully and conserves all 56,243
original strategic bodies with no births/deaths. It records 10.6452024 dam
worker-days, plus paid grazing, wetland tending, rooting and both filters; it
grants no furnace or dream-weather work. This short execution is **incomplete**,
not a seasonal viability result. Construction history and wildlife allocation
both debit original stocks; history is not a second starting material budget.

The seasonal allocation assessment remains **rejected**: 57 late-arrival,
1,333 seasonal-resource-deficit, 242 seasonal-deficit, 142 unfunded-prey and five
unverified-opposition records. Ability availability is not a health certificate;
none of those failures is excused or relabeled as exhausted territory.

The earlier complete and isolated 120-day results in
[spatial carcasses](WILDLIFE_CARCASSES.md) belong to source `5cddbb5e`, before
this allocation correction. They are not current-source seasonal measurements.
The all-species 120-day replay was not repeated in this pass. A focused prepared
four-month control covers finite dam-material exhaustion and a 31-day consenting
dream interval followed by withdrawal, with identical normalized continuation.
It does not establish generated food-web balance.

## Focused verification

The five unit files `tests/established-habitats.unit.test.js`,
`tests/beast-habitat-bindings.unit.test.js`, `tests/beast-habitat-sources.unit.test.js`,
`tests/beast-regional-work.unit.test.js` and
`tests/beast-regional-ecology.unit.test.js` pass **104 checks**. These cover
conservation, sourced construction, physical reach, shared capacity, dormant
inputs, explicit participation, interruptions, seasonal boundaries, tampering,
legacy archives, normalized saves and independent/continued source ownership.

Three named Chromium checks cover generated compressed-world storage/reload,
the 10,242-cell default-resolution storage case, and local work material plus
withdrawn dream consent through browser storage. No renderer changed. The full
test suite was not run under `AGENTS.md`.
