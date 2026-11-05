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
    homunculus: { name: 'Human-derived homunculus', researchTier: null, synthesisTier: null, natural: true,
      formation: 'Modified human tissue development; advanced methods, not an early workforce.' }
  });
  const COSTS = Object.freeze({ notes: {}, characterize: { clay: 1, drinkingWater: 1 },
    stability: { clay: 1, drinkingWater: 1 }, document: { assayReagent: 1 },
    grow: { clay: 2, drinkingWater: 2 }, charge: { arcaneFeedstock: 1 },
    wet: { drinkingWater: 1 }, fillLeak: { drinkingWater: 4 }, drainLeak: {}, examine: {}, position: {}, release: {}, pressure: {}, clear: {} });
  const SECONDS = Object.freeze({ notes: 60, characterize: 120, stability: 300, document: 180,
    grow: 60, charge: 60, wet: 30, fillLeak: 60, drainLeak: 60, examine: 30, position: 30, release: 30, pressure: 30, clear: 60 });
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
      evidence: [], pattern: null, runs: [], creatures: [], leaks: {}, observations: {}, useAnimancy: true };
  }
  function normalize(s, now = 0) { return s?.creatures && s?.runs ? copy(s) : create(now); }
  function research(s, method, receipt, now) {
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
  function begin(s, chamberId, stocks, window, location, now) {
    if (!s.pattern || s.runs.some(r => r.chamberId === chamberId && !r.cleared)) return null;
    const r = { id: `convergence-${s.nextId++}`, family: 'mudlet', chamberId, pattern: copy(s.pattern), stocks: copy(stocks),
      consumed: { clay: 0, drinkingWater: 0 }, soulWindow: copy(window), location: copy(location), progress: 0,
      required: 600, buffer: 120, status: 'forming', reason: '', startedAt: now, lastAt: now, creatureId: '', cleared: false };
    s.runs.push(r); return r;
  }
  function finish(s, r, now) {
    const formationSoul = sealSoul(r.soulWindow, r.id, now); if (!formationSoul) return false;
    const a = { id: `mudlet:${r.id}`, actorKind: 'mudlet', family: 'mudlet', name: `Mudlet ${s.creatures.length + 1}`,
      runId: r.id, chamberId: r.chamberId, mapCell: copy(r.location.bodyCell), roomId: r.location.roomId,
      status: 'alive', present: true, health: 100, maxHealth: 100, clayKg: 2, waterL: 2, evaporatedL: 0,
      formationSoul, skills: {}, independentIntent: '', createdAt: now, injuries: [], lastMoveAt: now };
    s.creatures.push(a); r.creatureId = a.id; r.status = 'completed'; r.finishedAt = now; return true;
  }
  function consistency(a) { return a.waterL < .35 ? 'dry and stiff' : a.waterL > 1.6 ? 'wet and yielding' : 'cohesive damp clay'; }
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
        const amounts = Object.fromEntries(Object.entries(COSTS.grow).map(([k, n]) => [k, Math.max(0, Math.floor(n * next / r.required + 1e-8) - r.consumed[k])]));
        if (!hooks.consume(r, amounts)) {
          r.reason = 'Original loaded material is missing.'; r.buffer -= elapsed;
          if (r.buffer <= 0) { r.status = 'failed'; r.finishedAt = at; hooks.release(r); }
          changes++; continue;
        }
        for (const [k, n] of Object.entries(amounts)) r.consumed[k] += n;
        supplySoul(r.soulWindow, support.soulEnergy || 0);
        r.progress = next; r.reason = '';
        if (r.progress >= r.required - 1e-8) {
          if (finish(s, r, at)) hooks.release(r);
          else { r.progress = r.required - 1e-6; r.buffer -= elapsed; r.reason = 'Formation must retain sufficient concurrent animancy; no soulless substitution.';
            if (r.buffer <= 0) { r.status = 'failed'; r.finishedAt = at; hooks.release(r); } }
        }
        changes++;
      }
      for (const a of s.creatures.filter(a => a.status !== 'dead')) {
        if (a.createdAt >= at) continue;
        const env = hooks.environment(a, seconds), hours = seconds / 3600;
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
        const a = s.creatures.find(a => a.status !== 'dead' && !a.chamberId && sameCell(a.mapCell, leak.cell));
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
    if (!a.health) { a.status = 'dead'; a.diedAt = now; a.independentIntent = ''; }
    return true;
  }
  function observe(s, a, now) {
    const v = { id: a.id, at: now, name: a.name, status: a.status, cell: copy(a.mapCell), chamberId: a.chamberId,
      consistency: consistency(a), waterL: a.waterL, health: a.health, formationSoul: copy(a.formationSoul), independentIntent: a.independentIntent };
    s.observations[a.id] = v; return copy(v);
  }
  return { FAMILIES, COSTS, SECONDS, soulWindow, supplySoul, soulReady, sealSoul, sealBrood, hasWill, create, normalize, research,
    begin, advance, consistency, sameCell, damage, observe };
});
