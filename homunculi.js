(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixHomunculi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme) {
  'use strict';
  const HOUR = 3600, STEP = 60, CARE = 12 * HOUR, BUFFER = 20 * 60;
  const VOCAL_ANATOMY = Object.freeze({ larynx: true, oralArticulation: true, respiration: true });
  const MODES = Object.freeze({
    culture: { seconds: 12 * HOUR, inputs: { biomass: 4, growthMedium: 3, geneticMaterial: 1, humanTissueTemplate: 1 } },
    body: { seconds: 72 * HOUR, inputs: { biomass: 60, growthMedium: 18, geneticMaterial: 6, humanTissueTemplate: 1 } }
  });
  const copy = x => JSON.parse(JSON.stringify(x));
  const registry = Theme.createRegistry([{ id: 'non-slime.shared.human-homunculus', kind: 'nonSlimeFamily', compatibility: 'shared', contentTags: ['science', 'magic'], fallback: true, template: 'Homunculus' }]);
  function create(now = 0, options = {}) {
    const selected = Theme.selectContent(registry, { kind: 'nonSlimeFamily', worldTheme: options.theme || 'madcap', seed: options.seed || 'human-growth', required: true });
    if (!selected.ok) throw new Error('No compatible non-slime body definition.');
    return { lastAt: now, nextRun: 1, runs: [], individuals: [], observations: {}, definitionId: selected.definitionId, sourceTheme: selected.sourceTheme, registryVersion: Theme.VERSION };
  }
  function normalize(s, now = 0) { return s?.runs && s?.individuals ? copy(s) : create(now); }
  function active(s, chamberId) { return s.runs.find(r => r.chamberId === chamberId && r.status === 'growing'); }
  function requirements(mode, context) {
    if (!MODES[mode]) return 'Unknown growth procedure.';
    if (!context?.research) return 'Documented tissue-culture research is required.';
    if (mode === 'body' && !context.morphogenesis) return 'Complete evidence-backed Homunculus Morphogenesis first.';
    if (context.medicine < 101 || context.alchemy < 101) return 'Medicine and Alchemy must both reach Adept (101).';
    if (!context.template?.examined || context.template.family !== 'human') return 'An examined physical human-derived template is required; slime material is not a template.';
    if (!context.inspected || !context.chamber || context.condition < 80) return 'Physically inspect a dedicated chamber in at least 80% condition.';
    if (!context.services) return 'Connected electricity, mana, clean water and waste service are required.';
    return '';
  }
  function begin(s, mode, chamberId, context, now, load) {
    const reason = requirements(mode, context);
    if (reason || active(s, chamberId) || s.individuals.some(a => a.chamberId === chamberId)
      || s.runs.some(r => r.chamberId === chamberId && !r.cleared && r.status !== 'growing'))
      return { ok: false, reason: reason || 'The chamber still contains a procedure, individual or tissue remains.' };
    const id = `homunculus-growth-${s.nextRun}`;
    const stocks = load(id, MODES[mode].inputs); if (!stocks) return { ok: false, reason: 'Exact staged inputs could not be loaded; no growth begun.' };
    const r = { id, mode, chamberId, template: copy(context.template), quality: context.quality,
      stocks: copy(stocks), consumed: {}, status: 'growing', progress: 0, damage: Math.max(0, (80 - context.quality) / 2),
      buffer: BUFFER, careAt: now, startedAt: now, lastAt: now, personId: '', finishedAt: null, cleared: false, reason: '', history: [] };
    s.nextRun++; s.runs.push(r); return { ok: true, run: r };
  }
  function stage(r) { return r.mode === 'culture' ? 'Tissue establishment' : r.progress < 1 / 3 ? 'Tissue establishment' : r.progress < 5 / 6 ? 'Organ formation' : 'Physiological stabilization'; }
  function injury(a, damage, cause, now) {
    if (!a || a.status === 'dead' || damage <= 0) return;
    a.health = Math.max(0, a.health - damage);
    const last = a.injuries.at(-1);
    if (last?.cause === cause) last.damage += damage;
    else a.injuries.push({ cause, damage, at: now });
    if (!a.health) { a.status = 'dead'; a.diedAt = now; }
  }
  function embody(s, r, location, now) {
    const a = { id: `homunculus:${r.id}`, actorKind: 'homunculus', family: 'homunculus', name: `Homunculus ${s.individuals.length + 1}`,
      soulId: `soul:${r.id}`, soulOrigin: 'naturally-developed', donorId: r.template.donorId, runId: r.id,
      definitionId: s.definitionId, sourceTheme: s.sourceTheme,
      status: 'developing', present: true, chamberId: r.chamberId, roomId: location.roomId, mapCell: copy(location.cell),
      health: Math.max(1, 100 - r.damage), maxHealth: 100, massKg: 48, maturity: 0, skills: {}, memories: [], language: null,
      agreement: null, foodHours: 24, waterHours: 24, fatigue: 0, stress: r.damage,
      injuries: r.damage ? [{ cause: 'Developmental injury', damage: r.damage, at: now }] : [],
      vocalAnatomy: { ...VOCAL_ANATOMY }, receivedCare: [],
      senses: { vision: true, hearing: true, chemical: true, taste: true, contact: true, magic: true }, createdAt: now, diedAt: null };
    s.individuals.push(a); r.personId = a.id; return a;
  }
  function advance(s, now, hooks) {
    if (hooks.dead) return 0;
    let changes = 0;
    while (s.lastAt + STEP <= now) {
      s.lastAt += STEP; const at = s.lastAt;
      for (const r of s.runs.filter(r => r.status === 'growing')) {
        if (at <= r.lastAt) continue;
        r.lastAt = at;
        const physical = hooks.support(r, STEP), person = s.individuals.find(a => a.id === r.personId);
        const careLate = at - r.careAt > CARE;
        const supported = physical.ok && !careLate && r.quality >= 50;
        r.reason = supported ? '' : careLate ? 'Scheduled examination and corrective care are overdue.' : physical.reason || 'Prepared medium or template is unsuitable.';
        if (!supported) {
          const buffered = physical.ok || physical.destroyed ? 0 : Math.min(STEP, r.buffer); r.buffer -= buffered;
          const unprotected = careLate || r.quality < 50 || physical.destroyed ? STEP : STEP - buffered;
          const damage = unprotected / HOUR * (physical.destroyed ? 100 : 12);
          r.damage = Math.min(100, r.damage + damage); injury(person, damage, r.reason, at);
        } else {
          const next = Math.min(1, (Math.round(r.progress * MODES[r.mode].seconds) + STEP) / MODES[r.mode].seconds);
          const amounts = Object.fromEntries(Object.entries(MODES[r.mode].inputs).map(([key, total]) => [key,
            Math.max(0, (key === 'humanTissueTemplate' ? 1 : Math.floor(total * next + 1e-8)) - (r.consumed[key] || 0))]));
          if (!hooks.consume(r, amounts)) { r.reason = 'An original loaded supply is missing; no substitution or progress.'; r.damage = Math.min(100, r.damage + STEP / HOUR * 12); injury(person, STEP / HOUR * 12, r.reason, at); }
          else {
            for (const [key, amount] of Object.entries(amounts)) r.consumed[key] = (r.consumed[key] || 0) + amount;
            r.progress = next;
            if (r.mode === 'body' && next >= 5 / 6 && !person) embody(s, r, physical, at);
            if (next >= 1) {
              r.progress = 1; r.status = 'completed'; r.finishedAt = at; hooks.release(r);
              const a = s.individuals.find(a => a.id === r.personId); if (a && a.status !== 'dead') { a.status = 'stabilizing'; a.maturity = 1; }
            }
          }
        }
        if (r.damage >= 100 || person?.status === 'dead') { r.status = 'failed'; r.finishedAt = at; hooks.release(r); }
        changes++;
      }
      for (const a of s.individuals.filter(a => a.status !== 'dead')) {
        if (at <= a.createdAt) continue;
        if (a.status === 'developing' && s.runs.some(r => r.id === a.runId && r.status === 'growing')) continue;
        if (a.status === 'developing') a.status = 'injured';
        a.foodHours = Math.max(0, a.foodHours - STEP / HOUR); a.waterHours = Math.max(0, a.waterHours - STEP / HOUR);
        const env = hooks.environment(a), starving = !a.foodHours || !a.waterHours;
        const unsafe = !env.floor || env.temperature < 15 || env.temperature > 32 || env.hazard;
        if (starving || unsafe) { injury(a, STEP / HOUR * 8, starving ? 'Unmet nutrition or hydration' : 'Unsafe physical habitat', at); a.stress = Math.min(100, a.stress + STEP / HOUR * 5); }
        else { if (!env.working) a.fatigue = Math.max(0, a.fatigue - STEP / HOUR * 10); a.stress = Math.max(0, a.stress - STEP / HOUR * 2); }
        changes++;
      }
    }
    return changes;
  }
  function care(s, r, now) { if (r?.status !== 'growing') return false; r.careAt = now; return true; }
  function cancel(s, r, now, hooks) {
    if (r?.status !== 'growing' || r.personId) return false; // A living individual cannot be deleted as a work order.
    r.status = 'cancelled'; r.finishedAt = now; r.reason = 'Support ended before an individual developed; incorporated tissue remains.'; hooks.release(r); return true;
  }
  function observe(s, r, now) {
    const person = s.individuals.find(a => a.id === r.personId);
    const v = { at: now, id: r.id, mode: r.mode, stage: stage(r), status: r.status, progress: r.progress, reason: r.reason,
      condition: r.damage >= 50 ? 'Severe visible deterioration' : r.damage >= 15 ? 'Visible developmental injury' : 'No gross abnormality observed',
      person: person ? { id: person.id, name: person.name, status: person.status, healthBand: person.health < 35 ? 'Critical' : person.health < 75 ? 'Injured' : 'Stable',
        needs: person.foodHours < 6 || person.waterHours < 6 ? 'Care needed' : 'Recently nourished', injuries: copy(person.injuries) } : null };
    s.observations[r.id] = v; return copy(v);
  }
  return { HOUR, STEP, CARE, BUFFER, MODES, VOCAL_ANATOMY, create, normalize, active, requirements, begin, stage, injury, advance, care, cancel, observe };
});
