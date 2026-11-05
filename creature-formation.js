(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCreatureFormation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const FAMILIES = Object.freeze({
    slime: { name: 'Slime', researchTier: 0, synthesisTier: 0, natural: true, communication: false },
    mudlet: { name: 'Mudlet', researchTier: 0, synthesisTier: 0, natural: true, communication: false,
      habitat: 'Wet clay deposits with sustained earth/water mana convergence',
      formation: 'A coherent mineral-water body develops under a stable naturally occurring elemental pattern.' },
    cinderling: { name: 'Cinderling', researchTier: 0, synthesisTier: 0, natural: true, communication: false,
      habitat: 'Charred burn sites or volcanic vents with combustible material and sustained flame-aspected mana',
      formation: 'A naturally coherent ember core and flame develop from burning carbonaceous material under a stable flame pattern.' },
    zephyrMote: { name: 'Zephyr Mote', researchTier: 1, synthesisTier: 0, natural: true, communication: false,
      habitat: 'Wind-scoured mountain passes and exposed cliffs with persistent air-aspected mana',
      formation: 'A stable natural vortex binds a finite parcel of surrounding air; excessive circulation tears its coherence.' },
    homunculus: { name: 'Human-derived homunculus', researchTier: null, synthesisTier: null, natural: true,
      formation: 'Modified human tissue development; advanced methods, not an early workforce.' }
  });
  const COSTS = Object.freeze({ notes: {}, characterize: { clay: 1, drinkingWater: 1 },
    stability: { clay: 1, drinkingWater: 1 }, document: { assayReagent: 1 },
    grow: { clay: 2, drinkingWater: 2 }, charge: { arcaneFeedstock: 1 },
    wet: { drinkingWater: 1 }, fillLeak: { drinkingWater: 4 }, drainLeak: {}, examine: {}, position: {}, release: {}, pressure: {}, clear: {},
    fireCharacterize: { charcoal: 1 }, fireStability: { charcoal: 1 }, fireDocument: { assayReagent: 1 },
    growCinderling: { charcoal: 2 }, feedCinderling: { charcoal: 1 }, quenchCinderling: { drinkingWater: 1 }, brazier: {},
    airCharacterize: {}, airLow: {}, airHigh: {}, airDocument: { assayReagent: 1 }, growZephyr: {},
    rechargeMote: { arcaneFeedstock: 1 }, vesselMote: {}, sealMote: {}, gentleMote: {}, strongMote: {}, orientMote: {} });
  const SECONDS = Object.freeze({ notes: 60, characterize: 120, stability: 300, document: 180,
    grow: 60, charge: 60, wet: 30, fillLeak: 60, drainLeak: 60, examine: 30, position: 30, release: 30, pressure: 30, clear: 60,
    fireCharacterize: 120, fireStability: 300, fireDocument: 180, growCinderling: 60, feedCinderling: 30, quenchCinderling: 30, brazier: 30,
    airCharacterize: 120, airLow: 300, airHigh: 300, airDocument: 180, growZephyr: 60,
    rechargeMote: 60, vesselMote: 30, sealMote: 30, gentleMote: 30, strongMote: 30, orientMote: 30 });
  function soulWindow(requested, deviceId = '', required = 2) {
    return { requested: Boolean(requested), deviceId: requested ? deviceId : '', required: requested ? required : 0,
      gathered: 0, sealed: false, result: null };
  }
  function supplySoul(window, energy) {
    if (!window || window.sealed || !window.requested) return 0;
    const used = Math.max(0, Math.min(Number(energy) || 0, window.required - window.gathered));
    window.gathered += used; return used;
  }
  function soulReady(window) { return !window?.requested || window.gathered >= window.required - 1e-8; }
  function sealSoul(window, id, at) {
    if (!window || !soulReady(window)) return null;
    if (!window.sealed) {
      window.sealed = true;
      window.result = { id: window.requested ? `soul:${id}` : null, present: window.requested,
        origin: window.requested ? 'creation-time-animancy' : 'unassisted-artificial-formation',
        deviceId: window.deviceId, gathered: window.gathered, formedAt: at };
    }
    return copy(window.result);
  }
  function hasWill(actor) {
    // Missing provenance belongs to an existing individual, not permission to
    // silently strip its established soul, learning or independent history.
    return actor?.formationSoul ? actor.formationSoul.present === true : true;
  }
  function sealBrood(window, count, id, at) {
    if (window?.broodResult) return copy(window.broodResult);
    if (!window || window.sealed || !Number.isInteger(count) || count < 1 || !soulReady(window)) return null;
    const result = Array.from({ length: count }, (_, index) => sealSoul({ ...window, sealed: false, result: null,
      required: window.required / count, gathered: window.gathered / count }, `${id}:child:${index}`, at));
    window.sealed = true; window.broodResult = result; return copy(result);
  }
  function create(now = 0) {
    return { lastAt: now, nextId: 1, knowledge: { notes: false, characterized: false, stability: false, documented: false },
      evidence: [], pattern: null, fireKnowledge: { characterized: false, stability: false, documented: false }, firePattern: null,
      airKnowledge: { characterized: false, low: false, high: false, documented: false }, airPattern: null,
      runs: [], creatures: [], leaks: {}, observations: {}, useAnimancy: true, ignitions: {} };
  }
  function normalize(s, now = 0) { return s?.creatures && s?.runs ? { ...create(now), ...copy(s) } : create(now); }
  function research(s, method, receipt, now) {
    if (['airCharacterize', 'airLow', 'airHigh', 'airDocument'].includes(method)) {
      const k = s.airKnowledge ||= { characterized: false, low: false, high: false, documented: false };
      if (!s.knowledge.notes || ['airLow', 'airHigh'].includes(method) && !k.characterized
        || method === 'airDocument' && (!k.low || !k.high)) return false;
      k[{ airCharacterize: 'characterized', airLow: 'low', airHigh: 'high', airDocument: 'documented' }[method]] = true;
      s.evidence.push({ method, receipt: copy(receipt), at: now });
      if (method === 'airDocument') s.airPattern = { id: 'stable-vortex-zephyr', family: 'zephyrMote',
        source: 'Personally compared gentle and disruptive circulation in captured local air',
        properties: { volumeM3: .1, gentleFlowM3PerHour: 1, strongFlowM3PerHour: 3 },
        evidenceIds: s.evidence.filter(e => e.method.startsWith('air')).map(e => e.receipt.taskId) };
      return true;
    }
    if (['fireCharacterize', 'fireStability', 'fireDocument'].includes(method)) {
      s.fireKnowledge ||= { characterized: false, stability: false, documented: false };
      const k = s.fireKnowledge;
      if (!s.knowledge.notes || method === 'fireStability' && !k.characterized || method === 'fireDocument' && !k.stability) return false;
      k[method === 'fireCharacterize' ? 'characterized' : method === 'fireDocument' ? 'documented' : 'stability'] = true;
      s.evidence.push({ method, receipt: copy(receipt), at: now });
      if (method === 'fireDocument') s.firePattern = { id: 'flame-ember-cinderling', revision: 1, family: 'cinderling',
        source: 'Performed charcoal characterization and contained ignition/stability trial',
        properties: { body: 'finite carbonaceous ember core', emission: 'fuel-driven local warmth/light' },
        evidenceIds: s.evidence.filter(e => e.method.startsWith('fire')).map(e => e.receipt.taskId) };
      return true;
    }
    if (!['notes', 'characterize', 'stability', 'document'].includes(method)) return false;
    if (method === 'characterize' && !s.knowledge.notes || method === 'stability' && !s.knowledge.characterized
      || method === 'document' && !s.knowledge.stability) return false;
    s.knowledge[method === 'characterize' ? 'characterized' : method === 'document' ? 'documented' : method] = true;
    s.evidence.push({ method, receipt: copy(receipt), at: now });
    if (method === 'document') s.pattern = { id: 'earth-water-mudlet', revision: 1,
      family: 'mudlet', source: 'Original earth/water working notes and performed material/stabilization trials',
      properties: { binding: 'coherent clay', hydration: 'two litres per two kilograms of clay' }, evidenceIds: s.evidence.map(e => e.receipt.taskId) };
    return true;
  }
  function recipe(family) { return family === 'zephyrMote' ? COSTS.growZephyr : family === 'cinderling' ? COSTS.growCinderling : COSTS.grow; }
  function begin(s, chamberId, stocks, window, location, now, family = 'mudlet', airParcel = null) {
    const pattern = family === 'zephyrMote' ? s.airPattern : family === 'cinderling' ? s.firePattern : family === 'mudlet' ? s.pattern : null;
    if (!pattern || family === 'zephyrMote' && (!airParcel || airParcel.released || airParcel.volumeM3 < .1)
      || s.runs.some(r => r.chamberId === chamberId && !r.cleared)) return null;
    const r = { id: `convergence-${s.nextId++}`, family, chamberId, pattern: copy(pattern), stocks: copy(stocks),
      consumed: Object.fromEntries(Object.keys(recipe(family)).map(k => [k, 0])), soulWindow: copy(window), location: copy(location), progress: 0,
      ...(family === 'zephyrMote' ? { airParcel: copy(airParcel), manaReceived: 0 } : {}),
      required: 600, buffer: 120, status: 'forming', reason: '', startedAt: now, lastAt: now, creatureId: '', cleared: false };
    s.runs.push(r); return r;
  }
  function finish(s, r, now) {
    if (r.family === 'zephyrMote' && (r.manaReceived < 4 - 1e-8 || !r.airParcel || r.airParcel.released)) return false;
    const formationSoul = sealSoul(r.soulWindow, r.id, now); if (!formationSoul) return false;
    const family = r.family || 'mudlet';
    const a = { id: `${family}:${r.id}`, actorKind: family, family, name: `${FAMILIES[family].name} ${s.creatures.filter(a => a.family === family).length + 1}`,
      runId: r.id, chamberId: r.chamberId, mapCell: copy(r.location.bodyCell), roomId: r.location.roomId,
      status: 'alive', present: true, health: 100, maxHealth: 100,
      ...(family === 'cinderling' ? { fuelUnits: 2, fuelReceived: 2, burnedUnits: 0, ashUnits: 0, emittedUnits: 0,
        temperatureC: 360, burning: true, heatEmitted: 0, waterVaporL: 0, quenchWaterL: 0, brazierId: '' }
        : family === 'zephyrMote' ? { airParcel: r.airParcel, manaReserve: 2, manaReceived: 2, manaSpent: 0,
          formationManaSpent: 2, vesselId: '', aperture: 'sealed', direction: 0, circulatedM3: 0, coherence: 100, airReturned: false }
          : { clayKg: 2, waterL: 2, evaporatedL: 0 }),
      formationSoul, skills: {}, independentIntent: '', createdAt: now, injuries: [], lastMoveAt: now };
    if (family === 'zephyrMote') { r.airParcel = null; r.airTransferred = true; }
    s.creatures.push(a); r.creatureId = a.id; r.status = 'completed'; r.finishedAt = now; return true;
  }
  function consistency(a) {
    if (a.family === 'zephyrMote') return a.status === 'dead' ? 'irreversibly collapsed vortex' : a.coherence < 40 ? 'fraying vortex' : 'coherent air vortex';
    if (a.family === 'cinderling') return a.status === 'dead' ? 'extinguished ember/ash remains' : a.burning ? a.temperatureC >= 120 ? 'brightly burning' : 'smoldering' : 'cooling and fuel-starved';
    return a.waterL < .35 ? 'dry and stiff' : a.waterL > 1.6 ? 'wet and yielding' : 'cohesive damp clay';
  }
  function light(a) { return a.family === 'cinderling' && a.status !== 'dead' && a.burning && a.fuelUnits > 0 ? Math.min(50, 20 + a.temperatureC / 12) : 0; }
  function feed(a, units = 1) {
    if (!a || a.family !== 'cinderling' || a.status === 'dead' || units <= 0 || a.fuelUnits + units > 4) return false;
    a.fuelUnits += units; a.fuelReceived += units; return true;
  }
  function quench(a, water, now) {
    if (!a || a.family !== 'cinderling' || water <= 0 || a.status === 'dead' && a.temperatureC <= 0) return false;
    const vapor = a.temperatureC > 120 ? Math.min(water, water * .25) : 0;
    a.waterVaporL += vapor; a.quenchWaterL += water - vapor;
    a.temperatureC = Math.max(0, a.temperatureC - water * 500); a.burning = false;
    damage(a, water * 100, 'Water quenching fractured and extinguished the coherent ember core', now);
    return { vapor };
  }
  function advanceCinderling(a, env, seconds, at, hooks) {
    const hours = seconds / 3600;
    if (a.status === 'dead') {
      const cooling = Math.max(0, a.temperatureC - (env.temperature ?? 20)) * Math.min(1, hours * .35);
      a.temperatureC -= cooling; a.heatEmitted += cooling * .01;
      hooks.emitFire?.(a, { burned: 0, heat: cooling * .01, smoke: 0, seconds, at }); return;
    }
    if (!a.chamberId && !a.brazierId && hasWill(a) && a.fuelUnits < .75) {
      if (at - a.lastMoveAt >= 60 && env.fuelDestination && hooks.move(a, env.fuelDestination)) {
        a.lastMoveAt = at; a.independentIntent = 'Seeking directly sensed exposed fuel';
      }
      // Only received physical charcoal is credited. Soulless fire may damage
      // nearby stock passively, but cannot choose to ingest it as its own fuel.
      if (a.fuelUnits <= 3 && hooks.takeFuel?.(a)) feed(a);
    }
    const rate = env.air === false ? 0 : a.temperatureC >= 120 ? 1 : .25;
    const burned = Math.min(a.fuelUnits, hours * rate);
    a.fuelUnits = Math.max(0, a.fuelUnits - burned); a.burnedUnits += burned;
    a.ashUnits += burned * .1; a.emittedUnits += burned * .9;
    const cooling = Math.max(0, a.temperatureC - (env.temperature ?? 20)) * Math.min(1, hours * .35);
    a.temperatureC = Math.max(0, Math.min(360, a.temperatureC - cooling + burned * 240));
    a.burning = burned > 0 && a.fuelUnits > 1e-8;
    const heat = burned * 12 + cooling * .01;
    a.heatEmitted += heat;
    if (a.fuelUnits <= 1e-8 || env.air === false) damage(a, hours * 12, 'Fuel starvation or suffocation destabilized the ember', at);
    if (a.temperatureC < 60) damage(a, hours * 20, 'Cold fragmented the coherent ember core', at);
    if (env.hazard) damage(a, hours * 20, 'Unsafe physical environment', at);
    hooks.emitFire?.(a, { burned, heat, smoke: burned * .9, seconds, at });
  }
  // Small finite gas parcels, not a global pressure/oxygen simulation. Airborne
  // quantities retain exact identities; exchanging air never neutralizes them.
  function takeAir(env, volumeM3, tileVolumeM3) {
    const available = tileVolumeM3 + (env?.airVolumeDeltaM3 || 0);
    if (!env || !Number.isFinite(volumeM3) || volumeM3 <= 0 || available + 1e-8 < volumeM3) return null;
    const airborne = {}; env.airborne ||= {};
    for (const [id, amount] of Object.entries(env.airborne)) {
      // Room entries are concentration per nominal tile volume; parcel entries
      // are retained amounts. The small withdrawal ledger is not gas pressure.
      const n = amount * tileVolumeM3 * volumeM3 / available; airborne[id] = n; env.airborne[id] -= n / tileVolumeM3;
    }
    env.airVolumeDeltaM3 = (env.airVolumeDeltaM3 || 0) - volumeM3;
    return { volumeM3, airborne, released: false };
  }
  function returnAir(env, parcel, tileVolumeM3 = 1) {
    if (!env || !parcel || parcel.released) return false;
    env.airborne ||= {};
    for (const [id, n] of Object.entries(parcel.airborne)) env.airborne[id] = (env.airborne[id] || 0) + n / tileVolumeM3;
    env.airVolumeDeltaM3 = (env.airVolumeDeltaM3 || 0) + parcel.volumeM3;
    parcel.released = true; return true;
  }
  function exchangeAir(left, right, requestedM3, leftVolumeM3, rightVolumeM3) {
    if (!left || !right || left === right || !(requestedM3 > 0) || !(leftVolumeM3 > 0) || !(rightVolumeM3 > 0)) return 0;
    const volume = Math.min(requestedM3, leftVolumeM3 * .24, rightVolumeM3 * .24);
    left.airborne ||= {}; right.airborne ||= {};
    for (const id of new Set([...Object.keys(left.airborne), ...Object.keys(right.airborne)])) {
      const a = left.airborne[id] || 0, b = right.airborne[id] || 0;
      const moved = volume * (a - b);
      left.airborne[id] = a - moved / leftVolumeM3; right.airborne[id] = b + moved / rightVolumeM3;
    }
    return volume;
  }
  function rechargeMote(a) {
    if (!a || a.family !== 'zephyrMote' || a.status === 'dead' || a.manaReserve > 8 + 1e-8) return false;
    a.manaReserve += 8; a.manaReceived += 8; return true;
  }
  function advanceZephyr(a, env, seconds, at, hooks) {
    a.independentIntent = '';
    if (a.status === 'dead') { if (!a.airReturned && hooks.disperseAir?.(a)) a.airReturned = true; return; }
    if (!a.chamberId && !a.vesselId && hasWill(a) && env.disruption > 0 && env.shelter
      && at - a.lastMoveAt >= 60 && hooks.move(a, env.shelter)) {
      a.lastMoveAt = at; a.independentIntent = 'Avoiding directly sensed disruptive airflow';
    }
    const open = !a.chamberId && (!a.vesselId || a.aperture !== 'sealed');
    const strong = open && a.aperture === 'strong', rate = open ? strong ? 4 : 2 : 1;
    const required = seconds / 3600 * rate, used = Math.min(a.manaReserve, required);
    a.manaReserve = Math.max(0, a.manaReserve - used); a.manaSpent += used;
    const active = required > 0 ? used / required : 0;
    if (open && active > 0) a.circulatedM3 += Math.max(0, hooks.circulateAir?.(a, seconds / 3600 * (strong ? 3 : 1) * active) || 0);
    const loss = (1 - active) * seconds / 3600 * 40 + ((env.disruption || 0) + (strong ? .5 : 0)) * seconds / 3600 * 30;
    if (loss > 0) { a.coherence = Math.max(0, a.coherence - loss); damage(a, loss, 'Vortex depletion or opposing ventilation tore coherence', at); }
    if (a.status === 'dead' && !a.airReturned && hooks.disperseAir?.(a)) a.airReturned = true;
  }
  function advance(s, now, hooks) {
    if (hooks.dead || now <= s.lastAt) return 0;
    let changes = 0;
    while (s.lastAt < now) {
      const seconds = Math.min(60, now - s.lastAt); s.lastAt += seconds; const at = s.lastAt;
      for (const r of s.runs.filter(r => r.status === 'forming')) {
        if (r.lastAt >= at) continue;
        const elapsed = Math.min(seconds, at - r.lastAt); r.lastAt = at;
        const used = Math.min(elapsed, r.required - r.progress), support = hooks.support(r, used);
        if (!support.ok) {
          r.reason = support.reason; r.buffer -= support.destroyed ? 120 : elapsed;
          if (r.buffer <= 0) { r.status = 'failed'; r.finishedAt = at; hooks.release(r); }
          changes++; continue;
        }
        const next = r.progress + used;
        const amounts = Object.fromEntries(Object.entries(recipe(r.family)).map(([k, n]) => [k, Math.max(0, Math.floor(n * next / r.required + 1e-8) - r.consumed[k])]));
        if (!hooks.consume(r, amounts)) {
          r.reason = 'Original loaded material is missing.'; r.buffer -= elapsed;
          if (r.buffer <= 0) { r.status = 'failed'; r.finishedAt = at; hooks.release(r); }
          changes++; continue;
        }
        for (const [k, n] of Object.entries(amounts)) r.consumed[k] += n;
        supplySoul(r.soulWindow, support.soulEnergy || 0);
        if (r.family === 'zephyrMote') r.manaReceived += Math.max(0, support.manaEnergy || 0);
        r.progress = next; r.reason = '';
        if (r.progress >= r.required - 1e-8) {
          if (finish(s, r, at)) hooks.release(r);
          else { r.progress = r.required - 1e-6; r.buffer -= elapsed; r.reason = 'Formation must retain sufficient concurrent animancy; no soulless substitution.';
            if (r.buffer <= 0) { r.status = 'failed'; r.finishedAt = at; hooks.release(r); } }
        }
        changes++;
      }
      for (const a of s.creatures.filter(a => a.status !== 'dead' || a.family === 'cinderling' && a.temperatureC > 25 || a.family === 'zephyrMote' && !a.airReturned)) {
        if (a.createdAt >= at) continue;
        const env = hooks.environment(a, seconds), hours = seconds / 3600;
        if (a.family === 'zephyrMote') { advanceZephyr(a, env, seconds, at, hooks); changes++; continue; }
        if (a.family === 'cinderling') { a.independentIntent = ''; advanceCinderling(a, env, seconds, at, hooks); changes++; continue; }
        const evaporation = Math.min(a.waterL, hours * Math.max(.03, .15 * (1 - (env.humidity ?? 50) / 100) + Math.max(0, (env.temperature ?? 20) - 25) * .02));
        a.waterL -= evaporation; a.evaporatedL += evaporation;
        if (a.waterL < .15) damage(a, hours * 10, 'Desiccation', at);
        if (env.hazard) damage(a, hours * 20, 'Unsafe physical environment', at);
        a.independentIntent = '';
        if (!a.chamberId && hasWill(a) && a.waterL < 1 && at - a.lastMoveAt >= 60 && env.moistDestination) {
          if (hooks.move(a, env.moistDestination)) { a.independentIntent = 'Seeking directly sensed moisture'; a.lastMoveAt = at; }
        }
        if (env.absorb && a.waterL < 2) { const absorbed = Math.max(0, Math.min(2 - a.waterL, env.absorb)); a.waterL += absorbed; a.absorbedL = (a.absorbedL || 0) + absorbed; }
        changes++;
      }
      for (const leak of Object.values(s.leaks)) {
        if (leak.remainingL <= 0 || !hooks.leakPresent(leak)) continue;
        const a = s.creatures.find(a => a.family === 'mudlet' && a.status !== 'dead' && !a.chamberId && sameCell(a.mapCell, leak.cell));
        const sealed = Boolean(a && a.waterL >= .35 && a.waterL <= 2 && leak.pressure === 'low');
        const flow = Math.max(0, Math.min(leak.remainingL, 8 - leak.caughtL, seconds / 60 * (leak.pressure === 'high' ? .2 : .05) * (sealed ? .1 : 1)));
        leak.remainingL -= flow; leak.caughtL += flow; leak.sealed = sealed;
        if (a && leak.pressure === 'high' && flow > 0) damage(a, flow / .2, 'Test-fitting pressure erosion', at);
      }
    }
    return changes;
  }
  function sameCell(a, b) { return a && b && a.x === b.x && a.y === b.y && a.z === b.z; }
  function damage(a, amount, cause, now) {
    if (!a || a.status === 'dead' || !(amount > 0)) return false;
    a.health = Math.max(0, a.health - amount);
    const last = a.injuries.at(-1);
    if (last?.cause === cause) last.amount += amount; else a.injuries.push({ cause, amount, at: now });
    if (!a.health) { a.status = 'dead'; a.diedAt = now; a.independentIntent = ''; if (a.family === 'cinderling') a.burning = false;
      if (a.family === 'zephyrMote') a.coherence = 0; }
    return true;
  }
  function observe(s, a, now) {
    const v = { id: a.id, at: now, name: a.name, status: a.status, cell: copy(a.mapCell), chamberId: a.chamberId,
      family: a.family, brazierId: a.brazierId || '', consistency: consistency(a), waterL: a.waterL,
      fuelUnits: a.fuelUnits, temperatureC: a.temperatureC, ashUnits: a.ashUnits,
      vesselId: a.vesselId || '', aperture: a.aperture, direction: a.direction, manaReserve: a.manaReserve,
      coherence: a.coherence, circulatedM3: a.circulatedM3, airReturned: a.airReturned,
      health: a.health, formationSoul: copy(a.formationSoul), independentIntent: a.independentIntent };
    s.observations[a.id] = v; return copy(v);
  }
  return { FAMILIES, COSTS, SECONDS, soulWindow, supplySoul, soulReady, sealSoul, sealBrood, hasWill, create, normalize, research,
    begin, advance, consistency, light, feed, quench, sameCell, damage, observe, takeAir, returnAir, exchangeAir, rechargeMote };
});
