# Initial hunting habitat allocation

Implemented inside existing **3.38-D**, not a new queue entry, a balance
certificate or native encounter adoption. No biological rates, population totals,
prey counts, weather, geographic resources or migration decisions change.

## Demonstrated allocation failure

The post-drainage/post-care seasonal baseline uses source
`beast-habitat-source:a2ffef9d` and the runtime at commit `f07bfe2`.
Its Rimefang family `natural-group:beast-population:rimefang-pack:01:0`
starts in `habitat:128:shore`, with roughly 550 kg of background land animals
across three million hectares. Abundant freshwater cannot compensate for that
family's unsuccessful food acquisition. Adults exhaust their reserves and
become incapable of care; their dependent young subsequently die.

Plant-eater placement already ranks shared finite food budgets. Pure hunters
previously received random compatible homes, even when their **original
territory** contained much better supplied, temperature-compatible habitat.
This correction applies a corresponding private initial-placement preference
to creatures with the existing hunting capability and no plant-food alternative.
Carrion Lanterns are excluded: living prey is not a scavenger's meal.

## Finite initial support estimate

`beast-habitat-sources.huntingSupport` reads the same deterministic size-classed
wildlife definitions and initial local positions used by the generated source.
It retains actual realm, resting habitat, temperature and traditional-home
constraints. No animal receives these private generator estimates as knowledge.

The estimate uses the existing six-hour/day active search ceiling, body speed,
sensory range, original adult membership, authored hunt success and the shared
spatial encounter-fraction calculation. Fish require actual overlapping water
depth; land hunters cannot budget fish or prey exceeding the existing individual
size limit. No new cooperative-hunting ability is inferred from a group count.

For each compatible pool:

`remaining flesh = max(0, original body kg × 0.6 − earlier initial allocations)`

`estimated kg/day = min(remaining flesh / calendar-cycle days,
                        remaining flesh × encounter fraction × hunt success)`

The 0.6 share is the existing animal-flesh fraction. Unborn prey, future kills,
plant stocks, incompatible tissues and merely sharing a geographic hex provide
no meat credit. Estimated support ranks the existing candidate homes. The
planner apportions the selected group's cycle requirement among those same
finite pools; later hunters see the remaining planning budget. That bookkeeping
neither removes live bodies nor creates a meal, a carcass or run-time custody.

The group requirement includes active adult maintenance, dependent feeding
efficiency and existing juvenile growth inputs. This is a placement heuristic,
not an execution forecast: real searches, handling, feeding, care, reproduction,
competition and deaths must still occur on the population clock. Unsupplied
candidates remain diagnostic; this estimate cannot activate them.

## World and save continuity

New records explicitly carry `huntingHabitatAccess: true`. The original
calibration/count-selection step is retained before correcting placement.
For seed `source-small`, refinement 2, the new source is
`beast-habitat-source:6fe013ab`, with the same 56,243 strategic originals,
all 24 species and exactly the same background-wildlife allocation as `a2ffef9d`.

Unmarked archived worlds reproduce their original source, home positions and
identity. They are not moved on load, re-signed as healthy or retrofitted with
supplies. New/old source validation derives each placement from its recorded
rules; the reusable world remains immutable during run execution. Actual later
migration still uses instincts and legitimate local knowledge, not these scores.

## Focused execution controls and limits

Two deliberately isolated comparisons retain recorded local resources,
positions, original bodies, wildlife and nurseries:

- The original six-member family loses all six members by day 15 in its old
  site. At its corrected original-territory placement in `habitat:46:shore`,
  all six remain healthy after 15 days, with actual hunting and food/water care.
- All 19 groups actually coallocated to that region retain 113 living originals
  after 30 days, consume about 15,800.70 kg through actual foraging and record no
  food/water scarcity deaths. Partial saves and continued branches agree.

Neither control substitutes for the complete generated food web. In particular,
wind-driven scavenger access, seasonal travelling groups, retained flooding and
opposition/native adoption remain separate existing D requirements. No second
complete seasonal replay is implied by these local results.

The later [integrated 120-day control](SEASONAL_VIABILITY.md#historical-pre-shelter-integrated-120-day-control)
does execute all species together using source `e8a02b1f`, including this
placement rule. It retains 124 of 125 original Rimefangs (one background death,
no scarcity deaths) and all twelve Nullmaws, with actual foraging and Rimefang
care. However, five other species retain scarcity losses, including three
complete marine-predator losses and Lantern extinction. Placement is not a
universal feeding-access certificate; the integrated source remains rejected.

The focused source/binding/hunting files pass **43 unit checks**. Two named
Chromium checks cover generated compressed-world storage/reload/continued
execution and actual default-resolution 10,242-cell storage. The full suite is
not run under `AGENTS.md`.

## Finite Reef Wyrm nursery schools

On the generated `native-encounters` reef shelf (`habitat:88:waterColumn`),
the mapped nursery put two original Wyrms on a real coastal reef, but the
closest concentrated fish ground started over 229 km away. The existing
regional search caught a handful of diffuse fish; the pair ate only 3.45 kg
before starving. A mapped reef and fish elsewhere in the same hex are not a
usable feeding ground.

At established mapped Wyrm nurseries in new worlds, generation can allocate
an original fish school wholly on the wet side of the coastal transect. Each
size class draws from its own diffuse background pool in that same water
column: at most 2% of its original fish, further bounded by a 200 m maximum
school radius and a combined 1,200 kg of original fish per hectare. The
same proportion of spare carrying capacity is moved with the fish. The original
headcount, body matter, regional food resources and Wyrm locations are
unchanged. The archived geography chooses the site; the Wyrm receives no
school coordinates or special steering. Saved worlds without a reef school
keep their prior layout.

The existing regional search, depth overlap, finite catch, handling and
ingestion path now feeds the same original on separate days at that site.
In an isolated replay, the pair ate about 4,142 kg by day 4 and 5,648 kg by
day 6. Catches debit each school, and a continued save preserves both the
Wyrms and the fish accounts. With the same fish outside paid search reach,
the Wyrms still searched but caught and ate nothing. The nearby school can
be depleted: the pair in this isolated replay was already losing health by
day 15. This is not a seasonal viability result, Brine Cathedral
opposition, or detailed local-map hunting.

## Abyssal Bell search pacing

Abyssal Bells still plan once per game-calendar month, with the same
six-hours-per-day equivalent search allowance and the same monthly handling,
eating, and total activity ceilings. Only a day's share is released at a time.
They can carry up to one day's unused search into the next day; they cannot
bank an entire idle stretch or borrow from future days. Search finishes at
the release boundary and an otherwise eligible hungry Bell can try again
after the refill. Elapsed movement, rest, catch, finite prey custody,
handling, and ingestion are unchanged. No other species uses this rule.

A saved legacy plan keeps its search already spent and finishes any pending
action at the archived time. When starting another search it paces the
remaining allowance over the remaining month, releasing no more than the
ordinary daily share. The saved pacing state and partial actions survive
normalization; reloading does not give a second allowance.

The retained day-40 checkpoint of source `43996615` was replayed through
day 52 with the prior and paced kernels. Both started with the same original
Bell (`natural-group:beast-population:abyssal-bell:01:2:males`), 111 spent
search hours, and the same all-species account and prey inventories. Both
end accounts normalized. No fish or search allowance was added.

| Same Bell, day-40–52 replay | Unpaced | Paced |
| --- | ---: | ---: |
| Monthly search allowance | 180 h | 180 h |
| Total month-to-date search at day 52 | 180 h | 152.44 h |
| Additional search after day 50 | 0 h | 6.90 h |
| Fish tissue eaten after day 50 | 0 kg | 477.84 kg |
| Fish tissue eaten across the replay | 4,595.46 kg | 2,828.71 kg |
| First food shortfall | Day 49.51 | Day 44.56 |
| Health at day 52 | 75.1% | 51.1% |

The unpaced Bell ran out of search hours by day 48. Pacing preserved a real
later opportunity, but the later meals did not make up for the lower early
intake in this saved-plan continuation. Neither branch met the Bell's needs
through the window. This demonstrates scheduling behavior and its tradeoff,
not a survival improvement or seasonal acceptance. The two branches do not
establish how a Bell paced from the beginning of its first month would fare.

```sh
node scripts/replay-bell-search-pacing.js \
  .replay-checkpoints/current-source-small-VaeaU47X/day-40.json 52
git show 8571f30:beast-foraging.js | node scripts/replay-bell-search-pacing.js \
  .replay-checkpoints/current-source-small-VaeaU47X/day-40.json 52 --baseline-stdin
```
