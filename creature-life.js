(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./creature-biology') : root.HelixCreatureBiology);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixCreatureLife = api;
})(globalThis, function (Data) {
  'use strict';
  const DAY = 86400, copy = x => JSON.parse(JSON.stringify(x));
  const finite = x => Number.isFinite(x) && x >= 0;
  const profile = a => Data.lifecycle[a?.speciesId || a?.family || a?.actorKind];
  // Existing human/laboratory care remains its owner. This engine does not
  // charge a second Duskcat ration, slime lifespan or homunculus growth bill.
  const existingOwners = Object.freeze({ human: 'scientist/civic needs', slime: 'genome metabolism/division', mudlet: 'creature-formation',
    homunculus: 'homunculi', cinderling: 'creature-formation', zephyrMote: 'creature-formation', rootling: 'creature-formation',
    sporecap: 'creature-formation', hauntbound: 'hauntbound', quartzShardling: 'shardlings', duskcat: 'duskcats', lanternWisp: 'lantern-wisps' });
  function attach(a, at, source = {}) {
    const p = profile(a), b = a?.bodyPhysics;
    if (!p || !b || a.life) return a;
    const ageDays = finite(source.ageDays) ? source.ageDays : p.adultDays;
    const fatKg = Math.min(b.massKg * .1, p.foodKgDay * (p.foodReserveDays || 0));
    const waterL = Math.min(b.massKg * .1, p.waterLDay * (p.waterReserveDays || 0));
    a.life = { bornAt: at - ageDays * DAY, lastAt: at, wasLocal: true,
      ageDays, structuralKg: b.massKg - fatKg - waterL, referenceKg: b.massKg,
      stores: { foodKg: 0, waterL, mineralsKg: 0, fatKg }, fatCapacityKg: fatKg,
      foodCapacityKg: Math.min(b.massKg * .25, Math.max(p.foodKgDay * (p.foodReserveDays || 1), p.newbornKg || 0)),
      waterCapacityL: waterL, consumed: {}, emitted: {}, restSeconds: 0,
      will: source.will !== false, willing: source.willing !== false, role: source.role || 'individual', colonyId: source.colonyId || null,
      memories: [], knownCells: [], opportunities: 0, attemptSerial: 0, reproduction: null, lastAttemptAt: null,
      seed: `${a.id}:${a.populationId}:life`, activity: 'idle', activityAt: at, action: null, events: [],
      heads: Object.fromEntries(Object.keys(b.parts).filter(k => /^head \d/.test(k)).map(k => [k, { generation: 0, lost: false, memory: [] }])) };
    if (source.role === 'queen' && p.breederKg) a.life.role = 'queen';
    return a;
  }
  function valid(a) {
    const l = a?.life;
    return Boolean(l && profile(a) && Number.isFinite(l.bornAt) && finite(l.lastAt) && finite(l.ageDays)
      && finite(l.structuralKg) && Object.values(l.stores || {}).every(finite) && l.events && Array.isArray(l.memories));
  }
  function emit(a, amounts, ctx) {
    for (const [k, n] of Object.entries(amounts)) {
      a.life.emitted[k] = (a.life.emitted[k] || 0) + n;
      ctx?.waste?.(a, k, n);
    }
  }
  function changeMass(a, amount) {
    const b = a.bodyPhysics; b.massKg = Math.max(.0000001, b.massKg + amount);
  }
  function demand(a, seconds, travelling = false) {
    const p = profile(a); if (!p || !valid(a)) return null;
    const juvenile = a.life.ageDays < p.adultDays;
    const mass = a.bodyPhysics.massKg / p.adultKg;
    const factor = mass ** .75 * (juvenile ? p.juvenileMultiplier : 1) * (travelling ? p.travelMultiplier : 1) * seconds / DAY;
    return { foodKg: p.foodKgDay * factor, waterL: p.waterLDay * factor, mineralsKg: p.mineralsKgDay * factor,
      mana: p.manaDay * factor, other: p.otherDay * factor };
  }
  function feed(a, resource, amount) {
    if (!valid(a) || !finite(amount) || !['foodKg', 'waterL', 'mineralsKg'].includes(resource)) return 0;
    const p = profile(a), l = a.life;
    const capacity = resource === 'foodKg' ? l.foodCapacityKg : resource === 'waterL' ? l.waterCapacityL : Math.max(p.mineralsKgDay * 10, p.newbornKg || 0);
    const used = Math.min(amount, Math.max(0, capacity - l.stores[resource]));
    l.stores[resource] += used; changeMass(a, used); return used;
  }
  function payMatter(a, kg, ctx) {
    if (!valid(a) || !finite(kg) || a.life.stores.foodKg + 1e-10 < kg) return false;
    a.life.stores.foodKg = Math.max(0, a.life.stores.foodKg - kg); changeMass(a, -kg);
    return true;
  }
  function advance(a, at, ctx) {
    if (!valid(a) || !finite(at) || at <= a.life.lastAt) return false;
    const l = a.life, p = profile(a), seconds = at - l.lastAt; l.lastAt = at;
    if (!ctx.alive || a.status === 'dead') return false;
    if (!ctx.local) { l.wasLocal = false; return false; }
    if (!l.wasLocal) { l.wasLocal = true; return false; }
    l.ageDays = Math.max(l.ageDays, (at - l.bornAt) / DAY);
    const needs = demand(a, seconds, ctx.travelling), b = a.bodyPhysics;
    l.foodCapacityKg = Math.min(b.massKg * .25, Math.max(p.foodKgDay * (p.foodReserveDays || 1), p.newbornKg || 0));
    l.fatCapacityKg = Math.min(b.massKg * .1, p.foodKgDay * (p.foodReserveDays || 0));
    for (const resource of ['foodKg', 'waterL', 'mineralsKg']) {
      const wanted = needs[resource]; let used = Math.min(l.stores[resource], wanted); l.stores[resource] -= used;
      if (resource === 'foodKg' && used < wanted) {
        const fat = Math.min(l.stores.fatKg, wanted - used); l.stores.fatKg -= fat; used += fat;
      }
      l.consumed[resource] = (l.consumed[resource] || 0) + used;
      changeMass(a, -used); emit(a, { [resource === 'waterL' ? 'waterVaporKg' : 'metabolicWasteKg']: used }, ctx);
      const missing = wanted - used;
      if (missing > 1e-10) {
        l.shortages ||= {}; l.shortages[resource] = (l.shortages[resource] || 0) + missing;
        const daily = resource === 'foodKg' ? p.foodKgDay : resource === 'waterL' ? p.waterLDay : p.mineralsKgDay;
        if (daily > 0) ctx.damage?.(a, missing / daily * (resource === 'waterL' ? 20 : 5), `Unmet ${resource} demand`);
      }
    }
    // Mirror Ape mana belongs to its existing paid-imitation owner; no passive
    // regeneration or second 48-unit pool is introduced here.
    if (a.speciesId !== 'beast:mirror-ape' && needs.mana > 0) {
      const paid = Math.min(b.mana, needs.mana); b.mana -= paid; b.spentMana += paid;
      l.energyStarved = paid + 1e-10 < needs.mana;
    }
    if (ctx.resting && !b.motion && !b.turn && !['flight', 'levitation', 'falling', 'landing'].includes(b.mode)) {
      const nourishment = p.foodKgDay === 0 || l.stores.fatKg + l.stores.foodKg > 0;
      const hydrated = p.waterLDay === 0 || l.stores.waterL > 0;
      if (nourishment && hydrated) {
        b.stamina = Math.min(300, b.stamina + seconds * .5); l.restSeconds += seconds;
        if (finite(a.climbStamina)) a.climbStamina = Math.min(120, a.climbStamina + seconds * .1);
      }
    }
    // Growth partitions actually eaten mass; maintenance gets first use. No
    // size milestone is awarded just because an age threshold was crossed.
    if (l.structuralKg < p.adultKg * .8 && l.stores.foodKg > 0 && l.ageDays < p.adultDays * 2) {
      const eaten = Math.min(l.stores.foodKg, p.adultKg / Math.max(1, p.adultDays) * seconds / DAY / p.assimilation);
      const gained = Math.min(p.adultKg * .8 - l.structuralKg, eaten * p.assimilation), previousStructure = l.structuralKg;
      l.stores.foodKg -= eaten; l.structuralKg += gained; changeMass(a, -(eaten - gained)); emit(a, { growthWasteKg: eaten - gained }, ctx);
      if (gained > 0 && previousStructure > 0) {
        const scale = (l.structuralKg / previousStructure) ** (1 / 3);
        for (const k of ['lengthM', 'widthM', 'heightM', 'wingSpanM']) b.dimensions[k] *= scale;
      }
    }
    if (l.stores.foodKg > p.foodKgDay * .05 && l.stores.fatKg < l.fatCapacityKg) {
      const food = Math.min(l.stores.foodKg - p.foodKgDay * .05, seconds / DAY * p.foodKgDay,
        (l.fatCapacityKg - l.stores.fatKg) / p.assimilation);
      const stored = food * p.assimilation; l.stores.foodKg -= food; l.stores.fatKg += stored;
      changeMass(a, -(food - stored)); emit(a, { metabolicWasteKg: food - stored }, ctx);
    }
    advanceReproduction(a, at, seconds, ctx);
    return true;
  }
  function mature(a) { const p = profile(a); return valid(a) && a.life.ageDays >= p.adultDays && a.life.structuralKg >= p.adultKg * .75; }
  function eligible(a, asMate = false) {
    const p = profile(a);
    if (!p || (!p.massSource.startsWith('Partition') && !/propagule/i.test(p.method)
      && (a.life?.role === 'male' && !asMate || a.life?.role === 'female' && asMate))) return false;
    return mature(a) && a.status !== 'dead' && a.health >= a.maxHealth * .6 && p.fertileDays !== null && a.life.ageDays >= p.fertileDays
      && a.life.will && p.offspring > 0 && (a.speciesId !== 'beast:ember-ant'
        || (asMate ? a.life.role === 'male' : a.life.role === 'queen' && a.life.colonyId && a.bodyPhysics.massKg >= p.breederKg * .8));
  }
  function random(seed) { let n = 2166136261; for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967296; }
  function beginReproduction(a, mate, at, ctx) {
    const p = profile(a), l = a?.life;
    if (!ctx.alive || !ctx.local || !eligible(a) || l.reproduction || l.populationBroods?.length && !/egg|clutch|propagule|fragment/i.test(p.method)
      || !ctx.seasonSuitable || !ctx.habitatSuitable
      || !ctx.recruit || l.opportunities < 1 || l.lastAttemptAt !== null && at - l.lastAttemptAt < p.cooldownDays * DAY) return false;
    if (a.speciesId === 'beast:ember-ant' && !(ctx.patch?.(a.mapCell)?.resources?.furnaceKg > 0)) return false;
    const fragment = p.massSource.startsWith('Partition');
    // Site-forming core kinds retain their formation owner, not a fertile adult
    // or an unverified boolean claiming regional substrate was paid.
    if (!fragment && (!eligible(mate, true) || mate.speciesId !== a.speciesId || mate.id === a.id || !ctx.mateReachable?.(a, mate))) return false;
    l.opportunities -= 1; l.lastAttemptAt = at; l.attemptSerial++;
    l.reproduction = { id: `birth:${a.id}:${l.attemptSerial}`, startedAt: at, dueAt: at + p.incubationDays * DAY,
      parentIds: [a.id, ...(mate ? [mate.id] : [])], investedKg: 0, requiredKg: fragment ? p.newbornKg * p.offspring : p.birthMaterialKg,
      investedMana: 0, requiredMana: p.reproductiveMana,
      fragment, success: random(`${l.seed}:${l.attemptSerial}`) < p.success, emitted: [], ready: false };
    return true;
  }
  function advanceReproduction(a, at, seconds, ctx) {
    if (!valid(a) || !ctx.alive || !ctx.local) return;
    const local = a.life.reproduction;
    if (local) advanceOneReproduction(a, at, seconds, ctx);
    const remainingLocal = a.life.reproduction;
    const retained = [];
    for (const brood of a.life.populationBroods || []) {
      if (brood.disposedAt != null) continue;
      if (brood.externalNursery && !ctx.populationNurseryAccessible?.(brood, a)) { retained.push(brood); continue; }
      a.life.reproduction = brood; advanceOneReproduction(a, at, seconds, ctx);
      if (a.life.reproduction) retained.push(a.life.reproduction);
    }
    a.life.populationBroods = retained;
    a.life.reproduction = remainingLocal;
  }
  function advanceOneReproduction(a, at, seconds, ctx) {
    const r = a.life.reproduction, p = profile(a); if (!r) return;
    const viable = a.status !== 'dead' && ctx.habitatSuitable && a.health > a.maxHealth * .3;
    if (!viable) { r.interruptedAt = at; return; }
    if (r.fragment) {
      if (r.investedKg === 0 && a.life.structuralKg >= r.requiredKg * 2) {
        a.life.structuralKg -= r.requiredKg; changeMass(a, -r.requiredKg); r.investedKg = r.requiredKg;
      }
    } else if (r.materialRecipe) {
      const storeFor = key => ['waterL', 'mineralsKg'].includes(key) ? key
        : ['foodKg', 'forageKg', 'organicKg', 'meatKg', 'carrionKg', 'detritusKg', 'planktonKg'].includes(key) ? 'foodKg' : null;
      const wanted = Math.min(r.requiredKg - r.investedKg, r.requiredKg * seconds / Math.max(1, p.incubationDays * DAY));
      let paid = wanted;
      for (const [key, fraction] of Object.entries(r.materialRecipe)) if (fraction > 0) {
        const store = storeFor(key);
        paid = Math.min(paid, store ? (a.life.stores[store] || 0) / fraction : 0);
      }
      if (paid > 0) {
        for (const [key, fraction] of Object.entries(r.materialRecipe)) {
          const store = storeFor(key);
          if (store) a.life.stores[store] -= paid * fraction;
        }
        changeMass(a, -paid); r.investedKg += paid;
      }
    } else {
      const payment = Math.min(r.requiredKg - r.investedKg, a.life.stores.foodKg,
        r.requiredKg * seconds / Math.max(1, p.incubationDays * DAY));
      if (payment > 0 && payMatter(a, payment, ctx)) r.investedKg += payment;
    }
    const manaStore = a.speciesId === 'beast:mirror-ape' ? a.spellImitation : a.bodyPhysics;
    const manaPayment = Math.min(r.requiredMana - r.investedMana, manaStore?.mana || 0,
      r.requiredMana * seconds / Math.max(1, p.incubationDays * DAY));
    if (manaPayment > 0) { manaStore.mana -= manaPayment; r.investedMana += manaPayment; }
    if (at < r.dueAt || r.investedKg + 1e-8 < r.requiredKg || r.investedMana + 1e-8 < r.requiredMana) return;
    r.ready = true;
    if (!r.success) { emit(a, { failedRecruitmentKg: r.investedKg }, ctx); a.life.events.push({ kind: 'recruitmentFailed', at, id: r.id }); a.life.reproduction = null; return; }
    for (let i = 0; i < p.offspring; i++) {
      const id = `${r.id}:${i}`; if (r.emitted.includes(id)) continue;
      const child = { id, speciesId: a.speciesId, massKg: p.newbornKg, ageDays: 0, bornAt: at,
        parentIds: copy(r.parentIds), origin: 'naturalBirth', parentPopulationId: a.populationId,
        role: a.speciesId === 'beast:ember-ant' ? 'worker' : 'individual', colonyId: a.life.colonyId };
      // A blocked physical birth keeps its original embryo/fragment and mass.
      if (!ctx.recruit(child, a)) return;
      r.emitted.push(id);
    }
    emit(a, { reproductiveWasteKg: Math.max(0, r.investedKg - p.newbornKg * p.offspring) }, ctx);
    a.life.events.push({ kind: 'recruited', at, id: r.id, childIds: copy(r.emitted) }); a.life.reproduction = null;
  }
  function remember(a, observation, head = null) {
    if (!valid(a) || !observation?.cell || !finite(observation.at)) return false;
    const memory = head ? a.life.heads[head]?.memory : a.life.memories;
    if (!memory || head && a.life.heads[head].lost) return false;
    const old = memory.findIndex(m => m.id === observation.id); if (old >= 0) memory.splice(old, 1);
    memory.push(copy(observation)); if (memory.length > 24) memory.shift(); return true;
  }
  function migrationChoice(a, choices) {
    const l = a?.life; if (!valid(a) || !l.will || !choices.length) return null;
    // This API deliberately accepts observations/instinct only, never region
    // carrying capacity, hidden food or a private destination census.
    if (l.migration?.mode === 'instinctive') return l.migration.traditionalDestination || null;
    const learned = l.migration?.mode === 'informed' ? choices.filter(c => l.memories.some(m => m.destinationId === c.id && m.at <= l.lastAt)) : [];
    const pool = learned.length ? learned : choices;
    const n = l.migrationSerial || 0; l.migrationSerial = n + 1;
    return pool[Math.floor(random(`${l.seed}:migration:${n}`) * pool.length)].id;
  }
  return { DAY, profile, existingOwners, attach, valid, demand, feed, payMatter, changeMass, advance,
    mature, eligible, beginReproduction, advanceReproduction, random, remember, migrationChoice };
});
