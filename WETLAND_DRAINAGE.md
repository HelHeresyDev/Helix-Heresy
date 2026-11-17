# Wetland drainage and flood damage

Implemented within **3.38-D**, without adding a queue package, species, animal
population adjustment or nurturing-rate change. The correction distinguishes
ordinary drainage from retained overbank flooding and fixes area scaling.

## Finite original outlets

New generated records carry `wetlandDrainage: true`. Existing canonical adjacent
watercourses receive explicit width, depth, grade and velocity. These are coarse
generator calibrations, independent of animal headcount or food demand:

- Width: 2% of the square root of wetland square metres, capped at 100 m.
- Depth: the lesser of actual wetland depth and 2 m.
- Grade: nonnegative canonical flow-surface drop divided by actual edge distance.
- Velocity: `min(2, 0.05 + 100 × grade)` m/s.
- Capacity: width × depth × velocity × 1,000 × 86,400 litres per game day.

This is an explicit provisional flux model, not a surveyed channel or a full
hydrodynamic/backwater solver. It grants no new outlet to a terminal basin.
Re-signed geometry changes cannot validate against the original source.
Unmarked archived sources retain their original geometry and source identity;
an old flow-only course proves that existing flow, not unlimited bank drainage.

River flow and bank/flood drainage share the same finite outlet capacity.
Actual dam capture first consumes its existing source-water allocation and bank
headroom. Unretained river water receives discharge capacity first; existing
floodwater then drains through remaining capacity, followed by new bank excess.
Water reaching the next region is added once, in canonical downstream order.
Connected regional clocks already include those same original watercourse edges.

This preserves the existing coarse inter-region flux abstraction; it adds no
detailed channel travel-time or terrain-fluid simulation. Closed or unverified
basins have no assumed bank drain. An internal `setDrainageObstruction` event can
record a genuinely performed blockage/clearance with its cause and time; it is
not a player construction action or free blockage/survey ability.

## Conserved overbank water

Bank capacity remains the usable regional inventory. Excess that cannot leave
through a recorded outlet remains in a separate `flood.waterL` account rather
than disappearing as a generic overflow output. River water blocked by capacity
joins that same account. It cannot also arrive downstream.

The ledger retains original/past receipts, incoming litres, actual discharge,
blocked-river and breach contributions, bank discharge and erosion. Its balance
is `waterL = receivedL − dischargedL`; bank discharge never entered the overbank
pool and is recorded separately. Normalization rejects incompatible ledgers,
forged cached capacities/discharge and invented water from an empty flood pool.
Tiny floating-point residues remain accounted water, not free downstream supply.

Terminal non-floodable receiving accounts retain explicit water-overflow outputs
for water leaving their usable inventory, including freshwater entering the sea.
They do not become a second freshwater stock. Floodwater is likewise not secretly
made available for drinking or care; no new pumping/collection mechanic is added.

Depletion, bank-fill and shallow-flood-buffer boundaries end cached intervals.
Opening an outlet takes elapsed time to discharge existing water. Saved original
flood inventories, partial flux, obstruction, dam structures and receipts survive
reload and continued import. Independent starts do not inherit run mutations;
irreversible scientist death advances no further flux.

## Area-scaled erosion and breaches

The default shallow-inundation buffer is 100 mm over the recorded floodplain.
The erosion calibration is **0.01 local condition points per newly accumulating
millimetre above that buffer**. These are stated tuning values, not empirical
flood predictions. They are recorded in new source definitions; prepared controls
may explicitly specify other finite buffer depths.

One litre per square metre is one millimetre. For an excess volume `V` in litres
over `A` affected hectares:

`depthMm = V / (A × 10,000)`

`erosionEP = depthMm × 0.01 × A = V × 0.01 / 10,000`

Regional condition loss is erosion EP divided by the region's affected hectares.
The old additional multiplication by regional area is gone. Twice the area with
the same water volume has half the condition loss; equal depths have equal loss.
Ordinary discharge within outlet capacity produces no overbank erosion.

Damage is charged when excessive inundation grows, not repeatedly every day for
the same standing litre. Recession does not restore already-eroded cover. This
bounded correction does not model sediment transport, erosion within the safe
channel, long-term waterlogging, or expansion of the flooded terrain footprint.

A breach releases only surviving tagged dam-retained water. It fills actual
downstream bank room; the remainder enters real overbank storage. Above-buffer
damage occurs at that event, once. Further downstream drainage remains finite
and elapsed rather than teleporting the pulse through the entire network.
An already-obstructed outlet traps the released water locally and retires the
dam-retention tag once; `blockedReleaseL` records that subset without supplying
the downstream account through a known blockage.
Real structure debris, prior resource use, paid nurturer losses and resulting
causal exhaustion remain distinct. Flood damage alone does not invent a defeated
nurturer or automatically certify an exhausted territory.

## Generated hydrology control

The [recorded control](reference/wetland-drainage-control.json) uses new source
`beast-habitat-source:a2ffef9d`, seed `source-small`, refinement 2. It retains all
334 geographic regions and the 62 wetland/outlet accounts for 120 actual days.
All ten-day normalization checkpoints pass.

This deliberately isolated control excludes the 56,243 original strategic bodies
and anonymous wildlife from its **private copy**, so no animal consumption or
ongoing nurturing is simulated. Original dam structures remain. The immutable
world, full roster and population definitions are unchanged. The control is not
eligible for normal source replay/adoption and is not a reduced-roster ecology
success. Its totals are not directly comparable to the earlier full food-web run.

| Hydrology-only outcome | Result |
| --- | ---: |
| Recorded finite outlets | 62 |
| Wetlands with remaining floodwater | 50 |
| Wetlands with some modeled erosion | 46 |
| Soil-floor breaches | 1 |
| Water-account arithmetic residual | 48 L across approximately 5.93 × 10¹⁶ L |

One genuinely capacity-limited modeled region, `habitat:117:wetland`, still
crosses its soil floor. Its outlet carries about 944 million L/day while final
flood growth is about 8.68 billion L/day. No dimension or velocity was retuned
to erase that outcome. It is a remaining habitat/calibration result to assess
within D, not automatic proof of nurturer defeat or a new pending prompt.

The historical [all-species seasonal result](SEASONAL_VIABILITY.md) belongs to
pre-drainage source `9b62d184`; its 51 wetland failures must not be presented as
new-source measurements. The complete food-web replay was not repeated in this
pass, and feeding/access failures and native adoption remain unresolved.

## Focused verification

**120 distinct unit checks** cover the named flood, drainage-source, regional-work,
regional-ecology, habitat-assessment, habitat-source, habitat-binding and generated
benchmark files. They include conservation, area scaling, shared capacity,
closed basins, obstruction/clearance, bank and buffer boundaries, original flood
inventory, dam retention/breach, causal losses, import validation and immutable
world/source continuity. Supplied and damaging cases both remain testable.

Three named Chromium cases cover generated source storage/reload, the actual
10,242-cell default-resolution compressed-world storage case, and partial flood
water plus obstruction/clearance through browser reload and continued import.
Only a script dependency was added to the entry page; no renderer changed.
The full test suite was not run under `AGENTS.md`.

Reproduce the focused generated control with
`node scripts/benchmark-wetland-drainage.js`. It does not execute the full animal
food web or alter the canonical reusable world.
