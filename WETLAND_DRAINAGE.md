# Wetland drainage and flood damage

Implemented within **3.38-D**, without adding a queue package, species, animal
population adjustment or nurturing-rate change. The correction distinguishes
ordinary drainage from retained overbank flooding and fixes area scaling.

## Finite original outlets

New generated records carry `wetlandDrainage: true` and `catchmentDrainage: true`.
Existing canonical adjacent watercourses receive explicit width, depth, grade
and velocity. These are coarse generator calibrations, independent of animal
headcount or food demand:

- Initial channel template: 2% of the square root of wetland square metres,
  capped at 100 m. This remains the complete width rule for archived records
  **without** `catchmentDrainage`.
- Depth: the lesser of actual wetland depth and 2 m.
- Grade: nonnegative canonical flow-surface drop divided by actual edge distance.
- Velocity: `min(2, 0.05 + 100 × grade)` m/s.
- Capacity: width × depth × velocity × 1,000 × 86,400 litres per game day.

The former 100 m cap applied equally to a small pond catchment and a wetland
hundreds of kilometres across. It also ignored the upstream tributary load.
New catchment sizing follows the original bound watercourse DAG once, upstream
to downstream, and records the resulting finite geometry:

1. Each seasonal local contribution is the original bank-water renewal after
   the **sequential** atmospheric/river rainfall partitions, plus that course's
   original daily river flux. Surplus river-stock renewal is not a second bank
   inflow. No raw strategic runoff-accumulation score is converted into extra
   water, and unconnected surface/subsurface water is not silently routed here.
2. Add the seasonal contributions of original connected tributaries once.
   Use the actual month lengths to calculate the annual mean. This unconsumed
   natural runoff potential sizes the catchment, not current animal withdrawals,
   seasonal peaks, hypothetical nurturing or a future flood's measured demand.
3. Required width is mean litres/day divided by the unchanged depth, velocity,
   1,000 and 86,400. Keep the initial channel where already sufficient; otherwise
   round required width upward to the next millimetre. There is no added storm
   safety factor.
4. Bound aggregate width by the **least** of the upstream patch span, receiving
   patch span (square roots of their square metres), and original connecting
   edge distance in metres. Insufficient geometry stays finite and records
   `unsupportedCatchmentDrainage`; it is not certified healthy or widened beyond
   that envelope. Closed/unbound basins never acquire an outlet.

Width represents a coarse **aggregate cross-section**, potentially several
parallel wetland channels, not a surveyed single river. In the small-map control
50 outlets widen and 12 retain 100 m; the largest aggregate is about 173.9 km
within a 293.3 km patch span. This is an explicit generated drainage-field
calibration, not evidence of a real measured spillway. No extra depth, velocity,
rainfall, animal bodies or maintenance rates fund the correction. A finer
backwater, channel-bed or sediment model is not implied.

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

## Historical generated hydrology control

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

One capacity-limited modeled region, `habitat:117:wetland`, still
crosses its soil floor. Its outlet carries about 944 million L/day while final
flood growth is about 8.68 billion L/day. No dimension or velocity was retuned
to erase that outcome in that pass. The catchment correction below subsequently
identifies the undersized generated outlet; this historical failure remains
recorded, not automatic proof of nurturer defeat or a new pending prompt.

The historical [all-species seasonal result](SEASONAL_VIABILITY.md) belongs to
pre-drainage source `9b62d184`; its 51 wetland failures must not be presented as
new-source measurements. The complete food-web replay was not repeated in the
drainage-only pass. The subsequent [post-drainage/post-care baseline](SEASONAL_VIABILITY.md)
records one floor breach and 37 negative soil-maintenance balances in the full
food web. Feeding/access failures and native adoption remain unresolved; the
separate hydrology-only numbers above are not relabeled as full-world results.

## Catchment-sized generated control and the 37 deficits

The [catchment control](reference/catchment-drainage-control.json) records new
source `beast-habitat-source:e8a02b1f`, the same seed/refinement, original geography,
334 regions and 62 wetlands over 120 days. Original population selection is
unchanged: 24 species, 89 populations and 56,243 strategic originals. The control
still excludes animals/wildlife **only from its private hydrology copy**, keeps
starting dams and includes ordinary natural soil renewal but no ongoing animal
nurturing. It is not an all-species replay or source-adoption result.

The report retains a separate row for every wetland and the old full-food-web
measurements for all 37 soil-deficit regions. Closer ledger reconciliation
corrects the earlier suggestion that every destruction point was flood erosion:

- 35 regions have only flood erosion in their soil-destruction account.
- `habitat:45:wetland` also has 1,670.022 EP and `habitat:100:wetland` 831.797 EP
  of non-flood soil costs. These match paid Mire Choir work (0.01 soil cost per
  worker-day, against 0.08 soil nurturing). Their recorded natural/nurturing
  supply more than covers those costs.
- In **all 37** regions the recorded balance is positive when only the recorded
  flood charge is subtracted from destruction. That is diagnostic arithmetic
  on the old ledger, not a counterfactual full-food-web simulation or an erasure
  of historical losses.

| New-source hydrology-only outcome | Result |
| --- | ---: |
| Recorded finite outlets / geographically unsupported catchments | 62 / 0 |
| Wetlands with retained seasonal water | 17 |
| Flood-erosion records / soil-maintenance deficits / soil-floor breaches | 0 / 0 / 0 |
| Former deficit regions with no erosion/deficit in this control | 37 / 37 |
| Minimum soil condition among regions with an actual soil floor | 10 |
| Water-account arithmetic residual | 56 L across approximately 5.93 × 10¹⁶ L |

The largest ending inundation is only about 0.0128 mm, below the unchanged
100 mm damage buffer. Initially zero-cover ice/alpine patches still report
zero condition, not a new floor breach. In `habitat:117:wetland`, the old
944 million L/day outlet becomes a fixed 1,572.768 m aggregate outlet carrying
14.854 billion L/day, within its 26.060 km geographic width bound. Its sizing
includes the upstream `habitat:9:wetland` catchment, whose own former bottleneck
also prevented that water reaching 117. The new control's minimum stays at its
original soil condition of 10 rather than falling to zero.

The 37 hydraulic explanations are covered; none requires invented nurturing or
nurturer defeat. This sample has no unsupported catchment after fitting, but
prepared limited-width/low-velocity cases remain unsupported and erode. Seasonal
water still accumulates and recedes over elapsed time. A blockage, breach or
unaccommodated catchment still floods: runtime geometry never resizes itself.
Source IDs `9b62d184`, `a2ffef9d` and `6fe013ab` continue validating with their old
rules; archived worlds and existing run ledgers are not repaired in place.
Current whole-food-web feeding/access, opposition and adoption remain unfinished
inside D. This control does not replace the rejected full-season baseline.

The subsequent [integrated 120-day replay](SEASONAL_VIABILITY.md#current-integrated-120-day-control)
does run all species together on `e8a02b1f`. It records zero flood erosion,
habitat-floor breaches and completed-cycle maintenance deficits, confirming the
drainage result in the complete ecosystem rather than only its isolated copy.
Actual feeding failures in five species and missing opposition/native adoption
still reject that source; passing habitat maintenance does not hide those losses.

## Focused verification

The catchment correction passes **43 focused unit checks**: outlet generation,
weighted catchment/tributary accounting, geographic bottlenecks, ordinary seasonal
inundation, erosion, conservation, obstruction/clearance, actual dam retention
and breach, partial saved hydraulics, original material/rainfall partitions,
source provenance and immutable archive validation. Three named Chromium cases
cover generation/storage/reload, actual default-resolution compressed-world
storage, and obstruction/partial-discharge reload and continued import.
The full suite and all-species seasonal replay were not run under `AGENTS.md`.

The earlier area-scaling/drainage pass separately recorded 120 focused unit
checks and three Chromium cases; those are historical verification, not extra
tests claimed for this catchment correction. Neither pass ran the full suite.

Reproduce the **current** focused generated control with
`node scripts/benchmark-wetland-drainage.js`. It does not execute the full animal
food web or alter the canonical reusable world.
To include the retained full-food-web comparison, add
`--baseline /path/to/day-120.json`; `--output /path/to/new-report.json` creates a
new report and refuses to overwrite an existing file. The committed old reports
remain historical; rerunning current generation does not recreate their source.
