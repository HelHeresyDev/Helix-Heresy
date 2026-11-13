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
- A choice policy receiving instincts, local neighboring approaches and dated
  personal knowledge, not hidden destination stocks or incoming populations.
  An unsuitable arrival can lead to repeated exploration and real starvation.
- Cached finite resource rates and depletion/reserve-depletion boundaries, rather
  than repeated strategic planning on every call. Reads settle elapsed work but
  do not reroll intentions, change cached rates or award future renewal.
- Continuous background hazards integrated across actual age bands and old-age
  doubling, including distinct queen hazards. Saved exposure and event thresholds
  preserve risk for small populations. Explicit predation/combat/scarcity losses
  remove membership before later background hazard processing.
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

## Fixed D acceptance still unfinished

1. Generated physical sources and seasonal initial viability, including viable
   ecological opposition and original source adoption without duplicating the
   existing Rimefang/Elk/Mirror Ape consumers.
2. Funded growth/recruitment, finite natural formation sites, performed ecological
   work, predation and causal exhaustion/recovery using the existing data and C
   behavior. The account model currently exposes explicit losses and finite stock
   interruptions; that alone does not implement those broader consumers.
3. Native integration with world/run persistence, ordinary travel, supported human
   logistics, correctly sized/mediated physical encounters and legitimate dated
   observations. The model is not loaded into the game yet and does not remove
   existing contact-only encounter restrictions.
4. Focused native DOM/Canvas, source-class, save/import, death/knowledge and
   strategic-output acceptance for the whole package. World-domination evaluator
   integration remains in the already-listed 3.35d-D/E, not this package.

Do not remove D, lower the queue count, or present the account model as completed
regional gameplay until these existing acceptance requirements pass. No species,
follow-up prompt or additional certification gate is authorized by this document.

## Focused checks

```sh
node tests/beast-populations.unit.test.js
```

The sixteen current model checks cover source typing/all 36 profile identities,
calendar boundaries, conserved claims, continuous hazards, resource depletion,
knowledge-independent choices, staggered journeys, failed arrivals and starvation,
interrupted supplies, duplicate-death exclusion, save validation and independent
copies. They do not claim ordinary-play acquisition, world-level balance or native
browser coverage. The full suite has not been run under repository policy.
