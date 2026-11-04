(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixNotifications = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KINDS = Object.freeze(['completion', 'discovery', 'warning', 'danger']);
  const LABELS = Object.freeze({ completion: 'Work completed', discovery: 'Discovery', warning: 'Warning', danger: 'Immediate danger' });
  const rank = k => KINDS.indexOf(k);
  const COPY = v => JSON.parse(JSON.stringify(v));
  const COOLDOWN = 2500, CATEGORY_COOLDOWN = 6000, WINDOW = 30000, LIMIT = 8;
  function preferences(v) {
    return { muted: v?.muted !== false,
      volume: Number.isFinite(v?.volume) ? Math.max(0, Math.min(1, v.volume)) : .25,
      categories: Object.fromEntries(KINDS.map(k => [k, v?.categories?.[k] !== false])) };
  }
  function kind(e) {
    if (e?.cue === 'none') return null;
    if (KINDS.includes(e?.cue)) return e.cue;
    if (e?.severity === 'critical') return 'danger';
    // Per-hit chatter and routine travel/hauling/XP are not audible work.
    if (e?.category === 'combat') return null;
    if (['warning', 'serious'].includes(e?.severity)) return 'warning';
    const text = String(e?.message || '');
    if (/\b(movement|hauling|transferred|arrived|queued|started|xp|level)\b/i.test(text)) return null;
    if (e?.category === 'discovery' && /\b(discover(?:y|ed)|revealed|identified|new trait)\b/i.test(text)) return 'discovery';
    if (/\b(complete(?:d)?|finished|delivered|settled)\b/i.test(text) && !/\b(could not|cannot|failed|no .* completed)\b/i.test(text)) return 'completion';
    return null;
  }
  function key(e) {
    return JSON.stringify([e.sourceKind || e.category || 'system', e.incidentId || e.sourceId || e.roomId || kind(e)]);
  }
  function createQueue() {
    let groups = [], pending = [], last = -Infinity, lastRank = -1, categoryTimes = {};
    function clear() { groups = []; pending = []; last = -Infinity; lastRank = -1; categoryTimes = {}; }
    function offer(event, eligible = true) {
      if (!eligible || !kind(event)) return false;
      // A reference is deliberately retained only until the next presentation
      // flush, so knowledge can be checked again before delivery.
      const id = key(event), old = pending.find(p => p.key === id);
      if (old) { old.count++; if (rank(kind(event)) >= rank(kind(old.event))) old.event = event; }
      else { pending.push({ key: id, event, count: 1 }); if (pending.length > 64) pending.shift(); }
      return true;
    }
    function prune(now, eligible) {
      groups = groups.filter(g => eligible(g.event) && (g.kind === 'danger' || now - g.updatedAt <= WINDOW));
    }
    function flush(now, prefs, eligible = () => true, foreground = true) {
      prune(now, eligible);
      const fresh = pending; pending = [];
      if (!foreground) return { groups: COPY(groups), notice: null, sound: null };
      let strongest = null;
      for (const item of fresh.filter(p => eligible(p.event))) {
        const e = item.event;
        const k = kind(e), id = key(e); if (!k) continue;
        let g = groups.find(g => g.key === id);
        if (!g) { g = { key: id, kind: k, event: COPY(e), count: 0, updatedAt: now }; groups.push(g); }
        g.count += item.count; g.updatedAt = now;
        if (rank(k) >= rank(g.kind)) { g.kind = k; g.event = COPY(e); }
        if (!strongest || rank(k) > rank(strongest.kind)) strongest = { kind: k, event: COPY(e) };
      }
      groups.sort((a, b) => rank(b.kind) - rank(a.kind) || b.updatedAt - a.updatedAt);
      groups = groups.slice(0, LIMIT);
      let notice = null;
      if (strongest && (now - last >= COOLDOWN && now - (categoryTimes[strongest.kind] ?? -Infinity) >= CATEGORY_COOLDOWN
        || rank(strongest.kind) > lastRank)) {
        notice = strongest; last = now; lastRank = rank(strongest.kind); categoryTimes[strongest.kind] = now;
      }
      const p = preferences(prefs);
      return { groups: COPY(groups), notice, sound: notice && !p.muted && p.volume > 0 && p.categories[notice.kind] ? notice.kind : null };
    }
    return { clear, offer, flush, dismiss: id => { groups = groups.filter(g => g.key !== id); }, snapshot: () => COPY(groups) };
  }
  function createAudio(host) {
    let context = null, status = 'Enable sound for this page, or use a normal game control, to allow browser playback. Text notifications remain available.', generation = 0;
    const voices = new Set();
    function stop() {
      generation++;
      for (const voice of voices) { try { voice.stop(); } catch {} }
      voices.clear();
    }
    async function unlock() {
      try {
        const Constructor = host.AudioContext || host.webkitAudioContext;
        if (!Constructor) throw Error('unavailable');
        if (!context || context.state === 'closed') context = new Constructor();
        if (context.state !== 'running') await context.resume();
        if (context.state !== 'running') throw Error('blocked');
        status = 'Sound enabled for this page. Text notifications always remain available.'; return true;
      } catch { status = 'Browser audio is unavailable or blocked. Text notifications remain available.'; return false; }
    }
    function play(k, volume) {
      if (!KINDS.includes(k) || !context || context.state !== 'running' || host.document?.hidden || !(volume > 0)) return false;
      stop(); const ownGeneration = generation;
      try {
        const notes = { completion: [440, 660], discovery: [523, 659, 784], warning: [330, 262], danger: [196, 294, 196] }[k];
        const start = context.currentTime;
        notes.forEach((frequency, i) => {
          const oscillator = context.createOscillator(), gain = context.createGain(), at = start + i * .11;
          oscillator.type = 'sine'; oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(Math.min(1, volume) * .12, at + .015);
          gain.gain.exponentialRampToValueAtTime(.0001, at + .105);
          oscillator.connect(gain); gain.connect(context.destination); voices.add(oscillator);
          oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
          if (ownGeneration === generation) { oscillator.start(at); oscillator.stop(at + .11); }
        });
        return true;
      } catch { stop(); status = 'Browser audio failed. Text notifications remain available.'; return false; }
    }
    return { unlock, play, stop, status: () => status, ready: () => context?.state === 'running' };
  }
  return { KINDS, LABELS, COOLDOWN, CATEGORY_COOLDOWN, WINDOW, LIMIT, preferences, kind, key, createQueue, createAudio };
});
