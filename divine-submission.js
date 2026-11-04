(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./divine-bodies') : root.HelixDivineBodies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixDivineSubmission = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Bodies) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const TERMS = 'Recognize the scientist as personal overlord, not as a divinely endorsed prophet. Retain your faithful, religion, cities, property and independent obligations. Accept only heard stand-down, hold, return-home withdrawal and two-minute same-ground personal protection orders within actual capacity. No assault army, conversion, healing or replenishment. An attack by the scientist breaks these terms; release ends the relationship.';
  const LIMITS = 'Submission is breakable personal political obedience, not endorsement or worship. A conscious original may refuse even demonstrated lethal force. Protection needs two-meter proximity and clear effect: at most 20 physical/force damage per hit, two original divine reserve per point plus one reserve and one endurance per active second; no soul ward or immunity.';
  const COMMANDS = ['standDown', 'hold', 'withdraw', 'protect'];
  function valid(a) {
    const s = a?.submission;
    return Boolean(s && s.signature === a.signature && s.mortalIdentityId === a.mortalIdentityId && s.terms === TERMS
      && ['accepted', 'refused', 'rebelled', 'released', 'dead'].includes(s.status)
      && Number.isInteger(s.bodyEpoch) && s.bodyEpoch >= 0 && Number.isInteger(s.forceSerial) && s.forceSerial >= 0
      && Number.isInteger(s.aggressionSerial) && s.aggressionSerial >= 0 && Number.isFinite(s.lastAt)
      && Array.isArray(s.history) && s.history.every((r, i) => r.serial === i + 1 && Number.isFinite(r.at) && typeof r.message === 'string')
      && (!s.command || COMMANDS.includes(s.command.kind) && Number.isFinite(s.command.at)
        && ['x', 'y', 'z'].every(k => Number.isInteger(s.command.post?.[k]))
        && Number.isFinite(s.command.progress) && s.command.progress >= 0 && s.command.progress <= 120
        && Number.isFinite(s.command.absorbed) && s.command.absorbed >= 0
        && ['active', 'complete', 'unavailable'].includes(s.command.status)));
  }
  function record(a, at, kind, message, extra = {}) {
    const s = a.submission;
    s.history.push({ serial: s.history.length + 1, at, kind, message, ...copy(extra) });
    return true;
  }
  function contact(s, book, a, c) {
    return Bodies.authentic(s, book, a) && Bodies.visible(a, c) && a.identified && a.status === 'alive' && a.health > 0
      && Bodies.owner(book, a.godId).god.lifecycle.lifeState === 'living'
      && !c.incapacitated && c.capable && c.distance <= 4 && c.tracks;
  }
  function leverage(s, book, a, stacks, c) {
    if (!contact(s, book, a, c) || !c.free || !c.lineOfEffect || !c.combatReady || !Number.isFinite(c.mana) || c.mana < 30
      || !Number.isFinite(c.resonanceDamage) || !Number.isInteger(c.bodyEpoch) || c.bodyEpoch < 0
      || Bodies.resonanceReason(s, book, a, stacks, c)) return false;
    const wound = a.lastDamage, g = Bodies.owner(book, a.godId).god;
    return Boolean(wound?.attackerId === 'scientist' && wound.bodyEpoch === c.bodyEpoch && wound.amount > 0
      && Number.isInteger(wound.serial) && wound.serial > 0
      && c.resonanceDamage - (g.lifecycle.divinityState === 'divine' ? Math.min(g.divineCore.innateCapacity, g.power.reserve) : 0) >= a.health);
  }
  function willing(book, a) {
    const g = Bodies.owner(book, a.godId).god;
    // Original motives are stable, not a per-demand persuasion roll. These
    // individuals prefer defiance or their prior obligations to a new overlord.
    return g.privateObjective !== 'opposeRivals' && !(g.objectives || []).some(o => /independence|never.?submit|reject.?rule/i.test(o))
      && !g.unresolvedCommitments?.length && !g.independentCommands?.length;
  }
  function lose(a, c, at, message) {
    const s = a.submission;
    s.status = 'rebelled'; s.command = null; s.forceSerial = a.lastDamage?.serial || 0;
    s.aggressionSerial = a.aggressionSerial || 0; s.lastAt = at;
    a.hostile = true; a.pending = null;
    record(a, at, 'rebellion', message);
  }
  function reconcile(s, book, a, c, at) {
    if (!Bodies.authentic(s, book, a) || !valid(a) || !c.alive) return;
    const r = a.submission;
    if (a.status === 'dead' && r.status !== 'dead' && Bodies.visible(a, c)) {
      r.status = 'dead'; r.command = null; record(a, at, 'death', 'Personally observed the original remains; no obedience or service remains.');
    }
    if (r.status !== 'accepted' || !Bodies.local(a, c) || !c.tracks || c.incapacitated) return;
    if ((a.aggressionSerial || 0) > r.aggressionSerial) lose(a, c, at, 'You attacked me in breach of the exact terms. I reject your rule.');
    else if (!c.capable || c.suppressed || c.bodyEpoch !== r.bodyEpoch)
      lose(a, c, at, 'I see an opening in your personal enforcement. I no longer obey.');
  }
  function demand(s, book, a, stacks, c, at) {
    if (!c.alive) return false;
    reconcile(s, book, a, c, at);
    if (!leverage(s, book, a, stacks, c) || a.submission && !valid(a)) return false;
    if (a.submission?.status === 'accepted' || a.submission?.status === 'refused') return false;
    if (a.submission && a.lastDamage.serial <= a.submission.forceSerial) return false;
    if (!a.submission) a.submission = { signature: a.signature, mortalIdentityId: a.mortalIdentityId, terms: TERMS,
      status: 'refused', bodyEpoch: c.bodyEpoch, forceSerial: 0, aggressionSerial: 0, history: [], command: null, lastAt: at };
    const r = a.submission;
    r.status = willing(book, a) ? 'accepted' : 'refused'; r.bodyEpoch = c.bodyEpoch;
    r.forceSerial = a.lastDamage.serial; r.aggressionSerial = a.aggressionSerial || 0; r.command = null; r.lastAt = at;
    if (r.status === 'accepted') { a.hostile = false; a.pending = null; }
    record(a, at, r.status, r.status === 'accepted'
      ? 'Your actual wound and present lethal capability compel my personal submission on these terms. This is not endorsement.'
      : 'I recognize the danger. My own opposition or independent obligations matter more; I refuse your rule.',
    { demonstration: copy(a.lastDamage), bodyEpoch: c.bodyEpoch, terms: TERMS });
    return true;
  }
  function command(s, book, a, c, kind, at) {
    if (!c.alive) return false;
    reconcile(s, book, a, c, at);
    if (!contact(s, book, a, c) || !c.free || !valid(a) || a.submission.status !== 'accepted'
      || a.submission.bodyEpoch !== c.bodyEpoch || ![...COMMANDS, 'release'].includes(kind)) return false;
    const r = a.submission, g = Bodies.owner(book, a.godId).god;
    if (kind === 'release') { r.status = 'released'; r.command = null; record(a, at, 'release', 'Released from personal submission.'); return true; }
    if (kind === 'protect' && (a.stamina < 1 || c.magicSuppressed || g.lifecycle.divinityState !== 'divine' || g.power.reserve < 1)) {
      record(a, at, 'unavailable', 'I cannot supply divine protection with my current body, suppression or original reserve.'); return false;
    }
    if (['protect', 'withdraw'].includes(kind) && (g.unresolvedCommitments?.length || g.independentCommands?.length)) {
      record(a, at, 'refusedOrder', 'My independent obligations conflict with leaving my post; submission did not erase them.'); return false;
    }
    r.command = { kind, at, progress: 0, absorbed: 0, status: 'active', post: copy(a.mapCell) }; r.lastAt = at;
    a.pending = null; a.hostile = false;
    record(a, at, 'command', `Heard ${kind}; finite original capacity and exact limits apply.`); return true;
  }
  function control(s, book, a, c, at, dt, move) {
    if (!c.alive || !Bodies.authentic(s, book, a)) return false;
    reconcile(s, book, a, c, at);
    if (!valid(a) || a.submission.status !== 'accepted' || a.status !== 'alive') return false;
    const r = a.submission, d = r.command, g = Bodies.owner(book, a.godId).god;
    // No absent-time service/backfill or off-ground tracking. advance() supplies
    // physical one-second steps, but clamp here as a second safety boundary.
    const seconds = Math.min(1, Math.max(0, dt)); r.lastAt = at;
    a.pending = null; a.hostile = false; a.retreating = false;
    if (!d || d.status !== 'active' || !seconds || !Bodies.local(a, c)) return true;
    if (c.incapacitated) {
      if (d.kind === 'protect') { d.status = 'unavailable'; if (Bodies.visible(a, c)) record(a, at, 'unavailable', 'Protective duty stopped: the original body is incapacitated.'); }
      return true;
    }
    if (d.kind === 'standDown') { d.status = 'complete'; return true; }
    if (d.kind === 'protect') {
      if (c.magicSuppressed || g.lifecycle.divinityState !== 'divine' || g.power.reserve < seconds || a.stamina < seconds) {
        d.status = 'unavailable';
        if (Bodies.visible(a, c)) record(a, at, 'unavailable', 'Protective duty stopped: original power or endurance unavailable.');
        return true;
      }
      if (!c.tracks) return true;
      g.power.reserve -= seconds; a.stamina -= seconds; d.progress = Math.min(120, d.progress + seconds);
      if (d.progress >= 120) { d.status = 'complete'; record(a, at, 'service', 'Two-minute personal protection ended; spending and wounds remain.', { absorbed: d.absorbed }); }
    }
    const target = d.kind === 'protect' ? c.cell : d.kind === 'withdraw' ? a.homeCell : d.post;
    const distance = Math.hypot(a.mapCell.x - target.x, a.mapCell.y - target.y, a.mapCell.z - target.z);
    if ((d.kind === 'protect' ? distance > 2 : distance > 0) && a.stamina >= 1 && at >= a.nextMoveAt) {
      if (move?.(a, target, false, d.kind !== 'protect')) a.stamina--;
      a.nextMoveAt = at + Math.max(1, c.moveSeconds || 1);
    }
    if (d.kind === 'withdraw' && ['x', 'y', 'z'].every(k => a.mapCell[k] === a.homeCell[k])) d.status = 'complete';
    return true;
  }
  function absorb(s, book, a, c, amount, types, at, attackerId) {
    if (!c.alive || !Number.isFinite(amount) || amount <= 0) return 0;
    reconcile(s, book, a, c, at);
    const d = a?.submission?.command, g = Bodies.owner(book, a?.godId)?.god;
    if (!contact(s, book, a, c) || !valid(a) || a.submission.status !== 'accepted' || a.submission.bodyEpoch !== c.bodyEpoch || !d || d.kind !== 'protect' || d.status !== 'active'
      || d.progress >= 120 || c.distance > 2 || !c.lineOfEffect || c.magicSuppressed || a.stamina < 1
      || g.lifecycle.divinityState !== 'divine' || attackerId === a.id
      || !types?.length || types.some(t => !['physical', 'force'].includes(t))) return 0;
    const absorbed = Math.min(amount, 20, Math.floor(g.power.reserve / 2));
    if (absorbed > 0) {
      g.power.reserve -= absorbed * 2; d.absorbed += absorbed;
      record(a, at, 'ward', `Personally intercepted ${absorbed} damage using ${absorbed * 2} original reserve.`, { absorbed, attackerId });
    }
    return absorbed;
  }
  function publicView(a) {
    // Only personally heard decisions and orders, not private motive, remaining
    // reserve, distant status or a list of undiscovered gods.
    return valid(a) ? copy({ terms: TERMS, history: a.submission.history }) : null;
  }
  return { TERMS, LIMITS, COMMANDS, valid, contact, leverage, demand, command, control, absorb, publicView, witnessAttack: reconcile };
});
