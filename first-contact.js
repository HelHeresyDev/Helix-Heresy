(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFirstContact = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SESSION = 600, REST = 3600;
  const ACTIONS = ['demonstrate', 'probe', 'ask'];
  const CONTEXTS = ['pause during hand movement', 'pause during a changed posture'];
  const copy = x => JSON.parse(JSON.stringify(x));
  function create() { return { subjects: {}, journal: [] }; }
  function normalize(s) { return s?.subjects && Array.isArray(s.journal) ? copy(s) : create(); }
  function subject(s, id) {
    return s.subjects[id] ||= { demonstrations: 0, testedContexts: [], understood: false, lastSessionAt: null, restUntil: 0 };
  }
  function session(s, actor, action, now, context = {}) {
    if (context.dead || !actor || !context.local || !ACTIONS.includes(action)) return null;
    const r = subject(s, actor.id);
    const record = (outcome, summary, response = null) => {
      const entry = { actorId: actor.id, name: actor.name || 'Specimen', at: now, action, outcome, summary, response };
      s.journal.push(entry); s.journal = s.journal.slice(-64); return copy(entry);
    };
    if (actor.status === 'dead' || !context.vision || !context.gesture || !context.safe)
      return record('unavailable', 'No usable local visual-gesture exchange: bodily state, visibility, movement or surroundings prevent it.');
    // Biological responses to stimuli are never a communication code, regardless
    // of modifications, repetition, labels or caller-provided cognitive metadata.
    if (actor.genome || actor.family !== 'homunculus' || actor.actorKind !== 'homunculus')
      return record('notDemonstrated', 'No understanding demonstrated. Any specimen reaction is biological, not a reply or agreement.');
    if (actor.status === 'developing' || actor.maturity < 1)
      return record('unavailable', 'Physiological stabilization must finish before meaningful first contact.');
    const wantsRest = actor.health < 75 || actor.foodHours < 6 || actor.waterHours < 6 || actor.fatigue >= 20 || actor.stress >= 30;
    if (now < r.restUntil || r.lastSessionAt != null && now - r.lastSessionAt < REST)
      return record('recovering', 'The session has ended; allow recovery before another attempt. Repetition supplies no new learning.');
    if (actor.health < 35 || actor.foodHours <= 0 || actor.waterHours <= 0)
      return record('unavailable', 'Pain or unmet bodily needs prevent a meaningful exchange.');
    if (wantsRest) {
      if (r.understood) {
        r.restUntil = now + REST; r.lastSessionAt = now;
        return record('refused', 'The individual uses the learned stop/rest gesture and declines this session.', 'stop');
      }
      return record('notDemonstrated', 'The individual does not engage consistently; understanding has not been demonstrated. Attend to bodily care.');
    }
    r.lastSessionAt = now;
    actor.fatigue = Math.min(100, actor.fatigue + 8);
    if (action === 'demonstrate') {
      r.demonstrations = Math.min(3, r.demonstrations + 1);
      return record('practiced', 'Demonstrated open-hand continue and raised-hand stop gestures during pauses and resumptions. Familiar responses alone do not prove understanding.');
    }
    if (action === 'probe') {
      if (r.demonstrations < (actor.injuries?.some(i => i.cause === 'Developmental injury') ? 3 : 2))
        return record('notDemonstrated', 'Responses are inconsistent without guidance; retained understanding is not yet demonstrated.');
      const next = CONTEXTS.find(c => !r.testedContexts.includes(c));
      if (!next) return record('understood', 'The individual again distinguishes continue from stop; this repeats existing evidence rather than adding a new context.');
      r.testedContexts.push(next); r.understood = r.testedContexts.length === CONTEXTS.length;
      return record(r.understood ? 'understood' : 'retained', `Without a simultaneous demonstration, the individual correctly responds to both cues in ${next}. ${r.understood ? 'Understanding demonstrated across distinct contexts.' : 'One retained response check; a second context is still needed.'}`);
    }
    if (!r.understood) return record('notDemonstrated', 'No interpretable preference: a shared continue/stop channel has not been demonstrated.');
    return record('preference', 'The individual uses the continue gesture for another brief interaction. This is not permission for work or future sessions.', 'continue');
  }
  return { SESSION, REST, ACTIONS, create, normalize, session };
});
