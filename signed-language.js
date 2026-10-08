(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixSignedLanguage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const INSTRUCTION = 1200, CHECK = 600, CONVERSATION = 60, REST = 3600;
  const GROUPS = {
    references: ['self', 'you', 'food', 'water'],
    preferences: ['rest', 'want', 'not', 'unknown'],
    pain: ['pain']
  };
  const QUESTIONS = ['want', 'wantFood', 'wantWater', 'wantRest', 'pain'];
  const copy = x => JSON.parse(JSON.stringify(x));
  const eligible = a => Boolean(a && !a.genome && a.family === 'homunculus' && a.actorKind === 'homunculus'
    && a.status !== 'dead' && a.status !== 'developing' && a.maturity >= 1 && !a.chamberId);
  const willing = a => eligible(a) && a.health >= 75 && a.foodHours >= 6 && a.waterHours >= 6 && a.fatigue < 20 && a.stress < 30;
  function create() { return { subjects: {}, journal: [] }; }
  function normalize(s) { return s?.subjects && Array.isArray(s.journal) ? copy(s) : create(); }
  function subject(s, id) { return s.subjects[id] ||= { lexicon: {}, groups: {}, restUntil: 0, lastLessonAt: null }; }
  function mastered(r, group) { return Boolean(r?.groups[group]?.checks.length >= 2); }
  function frame(c) { return JSON.stringify([c.food, c.water, c.scientistCell, c.actorCell]); }
  function session(s, a, action, group, now, c = {}) {
    if (c.dead || !a || !['instruct', 'check', 'talk'].includes(action)) return null;
    const record = (outcome, summary, extra = {}) => {
      const entry = { actorId: a.id, name: a.name || 'Specimen', at: now, action, group, outcome, summary, ...extra };
      s.journal.push(entry); s.journal = s.journal.slice(-64); return copy(entry);
    };
    if (!c.local || !c.vision || !c.gesture || !c.safe || c.interrupted || a.status === 'dead')
      return record('unavailable', 'No completed physical signed exchange: attendance, sight, lighting, movement or safety was lost.');
    if (!eligible(a)) return record('notDemonstrated', 'No language demonstrated. Slime reactions never establish communication.');
    if (!c.contactUnderstood) return record('notDemonstrated', 'Establish local continue/stop understanding first; bodily capacity supplies no language.');
    const r = subject(s, a.id);
    if (now < Math.max(r.restUntil, c.restUntil || 0)) return record('recovering', 'The individual requested recovery; repeated questions cannot override it.');
    if (a.health < 35 || a.foodHours <= 0 || a.waterHours <= 0)
      return record('unavailable', 'Severe pain or unmet bodily needs prevents an interpretable exchange.');
    if (action === 'talk') {
      if (!QUESTIONS.includes(c.question)) return record('misunderstood', 'That question is outside this small shared signed language.');
      if (c.attended < CONVERSATION) return record('unavailable', 'The actual conversation did not finish.');
      const required = ['references', 'preferences', ...(c.question === 'pain' ? ['pain'] : [])];
      if (!required.every(g => mastered(r, g))) {
        const understoodUnknown = mastered(r, 'preferences');
        return record('misunderstood', understoodUnknown ? '“I don’t understand.”' : 'No interpretable reply; the required shared meanings are not demonstrated.',
          understoodUnknown ? { utterance: ['self', 'unknown'] } : {});
      }
      let utterance, summary;
      const wantsRest = a.fatigue >= 20 || a.stress >= 30 || a.health < 75;
      const wantsFood = a.foodHours < 12, wantsWater = a.waterHours < 12;
      if (c.question === 'pain') { utterance = ['self', ...(c.ownPain ? [] : ['not']), 'pain']; summary = c.ownPain ? '“I have pain.”' : '“I do not have pain.”'; }
      else if (c.question === 'want') {
        const object = wantsRest ? 'rest' : wantsWater ? 'water' : wantsFood ? 'food' : null;
        utterance = object ? ['self', 'want', object] : ['self', 'not', 'want', 'food', 'water'];
        summary = object ? `“I want ${object}.”` : '“I don’t want food or water now.”';
      } else {
        const object = { wantFood: 'food', wantWater: 'water', wantRest: 'rest' }[c.question];
        const wants = { food: wantsFood, water: wantsWater, rest: wantsRest }[object];
        utterance = ['self', ...(wants ? [] : ['not']), 'want', object]; summary = `“I ${wants ? 'want' : 'do not want'} ${object}.”`;
      }
      // Distress is a communicated refusal, not a demand for further training.
      if (wantsRest) { r.restUntil = now + REST; utterance = ['self', 'want', 'rest']; summary = '“I want rest.” The individual ends this conversation.'; }
      a.fatigue = Math.min(100, a.fatigue + 1);
      return record(wantsRest ? 'refused' : 'reply', summary, { utterance });
    }
    if (!GROUPS[group]) return record('notDemonstrated', 'No supported lesson was selected.');
    if (r.lastLessonAt != null && now - r.lastLessonAt < REST || c.lastSessionAt != null && now - c.lastSessionAt < REST)
      return record('recovering', 'Allow an hour after instruction, checks or other meaningful interactions.');
    if (c.refused || !willing(a)) {
      r.restUntil = now + REST;
      return record('refused', 'The learned stop/rest cue declines teaching. Attend to bodily care; no learning is credited.');
    }
    if (c.attended < (action === 'instruct' ? INSTRUCTION : CHECK)) return record('unavailable', 'The attended teaching or check did not finish.');
    if (!c.food?.id || !c.water?.id || !c.examplesValid)
      return record('unavailable', 'Show real distinct ordinary food and water examples within the usable physical channel.');
    if (group !== 'references' && !mastered(r, 'references')) return record('notDemonstrated', 'Demonstrate retained self/you and food/water distinctions before combining meanings.');
    if (group === 'pain' && !c.painExample) return record('unavailable', 'Pain needs a real existing injury example; never create an injury for teaching.');
    const current = frame(c), lesson = r.groups[group];
    if (action === 'instruct') {
      if (lesson) return record('repeated', 'This repeats the existing demonstration, not new comprehension evidence.');
      for (const meaning of GROUPS[group]) r.lexicon[`sign:${meaning}`] = meaning;
      r.groups[group] = { demonstration: copy({ food: c.food, water: c.water, scientistCell: c.scientistCell, actorCell: c.actorCell,
        painExample: c.painExample || null }), checks: [] };
      r.lastLessonAt = now; a.fatigue = Math.min(100, a.fatigue + 8);
      return record('practiced', group === 'references'
        ? 'Pointed to each participant and actual food/water, contrasting identity and object meanings.'
        : group === 'preferences' ? 'Practiced voluntary pauses, want/not contrasts and acknowledging an unfamiliar sign. Examples are not general work terms.'
          : 'Linked the pain sign to the existing injury and contrasted a painless condition. No injury or treatment is manufactured.');
    }
    if (!lesson) return record('notDemonstrated', 'Teach these meanings through actual examples first.');
    if (mastered(r, group)) return record('repeated', 'These meanings already passed two independent checks; repetition grants no new competence.');
    const d = lesson.demonstration;
    if (group !== 'pain' && (c.food.id === d.food.id || c.water.id === d.water.id))
      return record('notDemonstrated', 'Use different real food and water lots for unguided transfer, not the demonstrated objects again.');
    if (current === frame(d) || lesson.checks.some(e => e.frame === current)) return record('repeated', 'This repeats a known physical context; no new independent evidence.');
    if (lesson.checks.length && JSON.stringify([c.food.cell, c.water.cell, c.scientistCell, c.actorCell]) ===
      JSON.stringify([lesson.checks[0].food.cell, lesson.checks[0].water.cell, lesson.checks[0].scientistCell, lesson.checks[0].actorCell]))
      return record('repeated', 'Change the actual positions for a second context; replacing labels alone is not transfer.');
    // No concurrent cue: decode retained sign meanings in new, untaught combinations.
    const meanings = group === 'references' ? lesson.checks.length ? [['self', 'food'], ['you', 'water']] : [['you', 'food'], ['self', 'water']]
      : group === 'preferences' ? lesson.checks.length ? [['self', 'not', 'want', 'rest'], ['you', 'want', 'food'], ['you', 'unknown']]
        : [['you', 'not', 'want', 'water'], ['self', 'want', 'rest'], ['self', 'unknown']]
        : [['self', 'not', 'pain'], ['you', 'pain']];
    const referent = m => ({ self: 'scientist', you: a.id, food: c.food.id, water: c.water.id }[m] || m);
    const trials = meanings.map(expected => ({ signs: expected.map(m => `sign:${m}`), expected: expected.map(referent),
      response: expected.map(m => referent(r.lexicon[`sign:${m}`] || null)) }));
    if (!trials.every(t => JSON.stringify(t.response) === JSON.stringify(t.expected)))
      return record('notDemonstrated', 'Unguided sign distinctions or combinations were misunderstood; no comprehension evidence is credited.');
    lesson.checks.push({ at: now, frame: current, food: copy(c.food), water: copy(c.water), scientistCell: copy(c.scientistCell), actorCell: copy(c.actorCell),
      painExample: copy(c.painExample || null), trials });
    r.lastLessonAt = now; a.fatigue = Math.min(100, a.fatigue + 4);
    a.language = { channel: 'local-sign', concepts: Object.keys(GROUPS).filter(g => mastered(r, g)).flatMap(g => GROUPS[g]) };
    return record(mastered(r, group) ? 'understood' : 'retained', `${group}: unguided distinctions and new combinations retained in a changed physical context. ${mastered(r, group) ? 'Understanding demonstrated in two contexts.' : 'A second context is still needed.'}`);
  }
  return { INSTRUCTION, CHECK, CONVERSATION, REST, GROUPS, QUESTIONS, create, normalize, eligible, willing, mastered, session };
});
