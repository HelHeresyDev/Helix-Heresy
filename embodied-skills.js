(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixEmbodiedSkills = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Knowledge is not muscle memory. These domains have explicit components,
  // rather than a percentage of an old body magically becoming usable again.
  const COMPONENTS = Object.freeze({
    analysis: { knowledge: 'Interpretation and analytical methods', body: '' },
    animancy: { knowledge: 'Animantic understanding and learned soul technique', body: '' },
    creatureLore: { knowledge: 'Creature biology and learned behaviour', body: '' },
    perception: { knowledge: 'Recognition and interpretation', body: 'Sensory calibration and attention coordination' },
    arcaneSenses: { knowledge: 'Recognition of magical signals', body: 'New-body magical sensory calibration' },
    medicine: { knowledge: 'Anatomy, diagnosis and treatment theory', body: 'Clinical manipulation and surgical precision' },
    alchemy: { knowledge: 'Reactions, protocols and magical chemistry', body: 'Reagent handling and procedural precision' },
    fabrication: { knowledge: 'Designs and fabrication methods', body: 'Tool control and manual adaptations' },
    materialsScience: { knowledge: 'Material properties and test interpretation', body: 'Sample preparation and instrument handling' },
    husbandry: { knowledge: 'Nutrition, breeding and care methods', body: 'Hands-on biological care' },
    creatureHandling: { knowledge: 'Handling methods and hazard recognition', body: 'Timing and physical specimen control' },
    striking: { knowledge: 'Remembered attack techniques and tactics', body: 'Strength, timing and strike execution' },
    guarding: { knowledge: 'Defensive techniques and tactics', body: 'Conditioning, stance and reflex calibration' },
    evasion: { knowledge: 'Escape techniques and threat assessment', body: 'Footwork, conditioning and reflex calibration' },
    grappling: { knowledge: 'Holds and restraint techniques', body: 'Strength, leverage and coordinated execution' }
  });
  const copy = v => JSON.parse(JSON.stringify(v));
  const safe = n => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
  function restore(skills, baselines, bodyId, now, earnedXp) {
    const result = copy(baselines);
    for (const [id, components] of Object.entries(COMPONENTS)) {
      const entry = skills?.[id] || baselines[id];
      if (!entry && !components.body) continue;
      result[id] = entry ? copy(entry) : { xp: 0, practiceTags: {}, evolvedLabel: '', evolvedTierId: '', lastPracticedAt: now, lastBreakthroughDecayAt: now };
      // A previous body's low practice does not erase remembered knowledge.
      // No old physical capabilities, inventories, senses or injuries transfer.
      delete result[id].embodiment;
      if (components.body) result[id].embodiment = {
        bodyId, xp: safe(baselines[id]?.xp), retainedXp: safe(earnedXp(safe(entry?.xp))),
        lastPracticedAt: now, lastBreakthroughDecayAt: now
      };
    }
    return result;
  }
  function normalize(entry, id, bodyId) {
    if (!COMPONENTS[id]?.body || !entry?.embodiment) return null;
    const e = entry.embodiment;
    return { bodyId, xp: e.bodyId === bodyId ? safe(e.xp) : 0,
      retainedXp: safe(e.retainedXp), lastPracticedAt: safe(e.lastPracticedAt), lastBreakthroughDecayAt: safe(e.lastBreakthroughDecayAt) };
  }
  function executionXp(entry, id) {
    return COMPONENTS[id]?.body && entry?.embodiment ? Math.min(safe(entry.xp), safe(entry.embodiment.xp)) : safe(entry?.xp);
  }
  function practice(entry, amount, now, applyXp, physical = false) {
    const e = entry?.embodiment, base = safe(amount);
    if (!e || !physical || !base) return null;
    // Apply 4x only to the part below the earned pre-death level. The part
    // beyond it learns normally; the existing breakthrough/overflow rules apply.
    const assistedBase = Math.min(base, Math.max(0, e.retainedXp - e.xp) / 4);
    const award = applyXp(e.xp, assistedBase * 4 + base - assistedBase);
    e.xp = award.xp; e.lastPracticedAt = now; e.lastBreakthroughDecayAt = now;
    return { ...award, assisted: assistedBase > 0 };
  }
  return { COMPONENTS, restore, normalize, executionXp, practice };
});
