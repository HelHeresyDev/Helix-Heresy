(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent,
    typeof module === 'object' && module.exports ? require('./city-succession') : root.HelixCitySuccession);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixIncumbentResistance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme, Succession) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const hash = id => [...id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const registry = Theme.createRegistry([{ id: 'abdication.shared.witnessed-declaration', kind: 'coercedAbdication', compatibility: 'shared',
    template: 'A physically recorded declaration under coercion', contentTags: ['science', 'survival'], fallback: true }]);
  const ESCAPE = Object.freeze({ x: 9, y: 16, z: 6 });
  const LIMITS = 'Witnessed coercion and a disputed successor claim only. Authentication is not legality or institutional recognition. No command, troops, immunity, confiscation, pardon, personal obedience, divine consent, neighboring sovereignty or city-power completion.';
  const REPERTOIRE = 'The incumbent has their own finite personal defenses, not the defender\'s city-scale powers: a projection absorbs at most ten damage for two mana per point; a marked pulse costs twelve mana, winds up two seconds, reaches four meters and deals twelve force damage with five-second recovery. Close strikes use ordinary damage and accuracy, six stamina and four-second recovery. Actual escape steps cost one stamina. No training cutoff, injury floor, free recharge or new guards.';
  const active = s => ['resisting', 'escaping', 'offered', 'recording'].includes(s?.phase);
  const dangerous = s => ['resisting', 'escaping'].includes(s?.phase);
  function prepareRuler(ruler) {
    if (!ruler || ruler.personalDefense) return Boolean(ruler);
    // Elaborate the current officeholder once, never a resurrected founder or
    // convenient replacement. Existing bodily damage and duty work are retained.
    ruler.actorKind = 'cityIncumbent';
    ruler.personalDefense = { mana: 90, capacity: 90, stamina: 80, staminaCapacity: 80,
      policy: hash(`${ruler.id}:${ruler.name}`) % 4 === 0 ? 'holdOffice' : 'preserveLife',
      skills: { striking: 25, guarding: 30, evasion: 25, perception: 30, animancy: 40 } };
    return true;
  }
  function create(succession, bargain, office, theme = 'madcap') {
    if (!succession?.ruler || succession.source.authority.kind !== 'individual' || !Succession.CHARTERS.includes(succession.source.succession)
      || succession.ruler.id !== bargain?.source.authority.id || succession.source.charterId !== bargain.source.charterId
      || office?.id !== succession.officeId || !office.clerk?.id) return null;
    const selected = Theme.selectContent(registry, { kind: 'coercedAbdication', worldTheme: theme, seed: succession.ruler.id, required: true });
    if (!selected.ok) return null;
    prepareRuler(succession.ruler);
    return { id: `${succession.ruler.id}:resistance`, definitionId: selected.definitionId, sourceTheme: selected.sourceTheme,
      cityId: succession.source.cityId, charterId: succession.source.charterId, rulerId: succession.ruler.id,
      officeId: office.id, administrationId: succession.source.institutions.find(i => i.role === 'centralAdministration')?.id,
      clerkId: office.clerk.id, phase: 'idle', encounter: null, pendingPulse: null, terms: null,
      job: null, receipt: null, reports: [], history: [], message: '', nextNumber: 1 };
  }
  const normalize = s => s?.rulerId && s.clerkId && Array.isArray(s.reports) && Array.isArray(s.history) ? copy(s) : null;
  const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
  const sameTerms = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function note(s, at, kind, text) { s.message = text; s.history.push({ at, kind, text }); s.history = s.history.slice(-50); }
  function current(s, succession, c) {
    return Boolean(s && succession && c.charterCurrent && c.authorityId === s.rulerId && !succession.handover
      && succession.ruler.id === s.rulerId && succession.source.charterId === s.charterId && c.cityId === s.cityId);
  }
  function canDemand(s, succession, c) {
    return Boolean(current(s, succession, c) && !s.receipt && c.alive && c.capable && c.local && c.rulerPresent && !c.busy
      && !c.rulerIncapacitated && succession.ruler.status === 'alive' && !succession.job
      && (!succession.ruler.assignment || succession.ruler.assignment === s.id) && s.phase !== 'recording');
  }
  function report(s, c, at, kind, detail) {
    for (const witnessId of c.witnessIds || []) s.reports.push({ id: `${s.id}:report:${s.reports.length + 1}`, at, kind,
      actorId: 'scientist', targetId: s.rulerId, witnessId, cityId: s.cityId, cell: copy(c.cell), detail,
      finding: 'Observed coercion only; guilt, legality and institutional recognition require separate proceedings.' });
  }
  function offer(s, succession, c, at) {
    const r = succession.ruler;
    // Actual threat and this person's actual bodily danger, not reputation, a
    // defender's defeat, a random persuasion roll or a numerical loyalty meter.
    if (r.personalDefense.policy !== 'preserveLife' || r.health > 35 || c.rulerIncapacitated || !c.rulerPresent
      || !c.capable || c.rulerDistanceM > 1 || !c.rulerLineOfEffect) return false;
    s.phase = 'offered'; s.pendingPulse = null;
    s.terms = { id: `${s.id}:terms:${s.nextNumber++}`, offeredAt: at, expiresAt: at + 3600,
      cityId: s.cityId, charterId: s.charterId, rulerId: s.rulerId, successorId: 'scientist', bodyEpoch: c.bodyEpoch,
      successionPrinciple: succession.source.succession,
      declaration: 'Relinquish the office and designate the scientist under the existing designation procedure; recognition remains disputed.',
      retainedRights: 'Living private individual retains personal freedom, property and faith. No confiscation, arrest, pardon or personal obedience is promised or awarded.',
      consideration: 'The scientist stops attacking and allows the incumbent to withdraw. Existing law, legal cases, appointments and independent religious duties remain.',
      origin: 'Offered under personally experienced threat and injury; coercion is explicitly recorded, not disguised as voluntary retirement.', limitations: LIMITS };
    note(s, at, 'offer', 'The injured incumbent offers exact life-preserving abdication terms. Only their own attacks stop; no institution has recognized you.');
    return true;
  }
  function demand(s, succession, c, at) {
    if (!canDemand(s, succession, c)) return false;
    if (s.phase === 'offered') return true; // Unchanged demands never reroll or refresh expiry.
    s.encounter ||= { id: `${s.id}:encounter:${s.nextNumber++}`, startedAt: at, bodyEpoch: c.bodyEpoch,
      roomId: succession.ruler.roomId, nextMoveAt: at + 1, nextAttackAt: at + 2, attacks: 0 };
    if (s.encounter.bodyEpoch !== c.bodyEpoch) return false;
    report(s, c, at, 'renewedAbdicationDemand', 'A renewed abdication demand was physically heard by the actual incumbent.');
    succession.ruler.assignment = s.id;
    if (offer(s, succession, c, at)) return true;
    s.phase = c.escapeReachable ? 'escaping' : 'resisting';
    note(s, at, 'refusal', 'The incumbent refuses the demand and attempts their own supported defense or physical escape. Unchanged circumstances cannot reroll their decision.');
    return true;
  }
  function attack(s, succession, office, c, at, actionId) {
    if (!s || s.receipt || !current(s, succession, c) || !c.alive || !c.local || !c.rulerObserved) return false;
    if (!s.encounter && !demand(s, succession, { ...c, busy: false }, at)) return false;
    report(s, c, at, 'attackOnIncumbent', `Observed ${actionId} against the incumbent; this is not a training permission.`);
    if (s.job) { release(s, succession, office); succession.ruler.assignment = s.id; }
    s.encounter.attacks++;
    s.terms = null; s.phase = c.escapeReachable ? 'escaping' : 'resisting';
    note(s, at, 'attack', 'The actual attack interrupts any unsigned offer or declaration; retained injuries and evidence are not erased.');
    return true;
  }
  function release(s, succession, office) {
    if (s.job && office?.assignment === s.job.id) office.assignment = null;
    if (s.job && office?.clerk.assignment === s.job.id) office.clerk.assignment = null;
    if (succession.ruler.assignment === s.id) succession.ruler.assignment = null;
    s.job = null; s.pendingPulse = null;
  }
  function terminate(s, succession, office, at, phase, message) { release(s, succession, office); s.phase = phase; note(s, at, phase, message); return true; }
  function recordReady(s, succession, office, c, at, own = false) {
    return Boolean(s?.terms && current(s, succession, c) && c.alive && c.capable && c.local && c.atCounter && c.rulerPresent
      && !c.rulerIncapacitated && !c.activeViolence && !c.busy && c.bodyEpoch === s.terms.bodyEpoch && at < s.terms.expiresAt
      && office?.id === s.officeId && office.clerk.id === s.clerkId && office.institutionId === s.administrationId
      && office.active && office.channelPowered && office.clerk.status === 'alive' && office.clerk.health >= 50
      && (office.clerk.fatigue || 0) < 80 && c.clerkPresent && c.recordWitnesses?.includes(s.clerkId)
      && succession.ruler.status === 'alive' && (!office.assignment || own && office.assignment === s.job?.id)
      && (!office.clerk.assignment || own && office.clerk.assignment === s.job?.id)
      && succession.ruler.assignment === s.id && at >= (office.availableAt || 0));
  }
  function canAccept(s, succession, office, c, at, expected = s?.terms) {
    return Boolean(s?.phase === 'offered' && !s.receipt && sameTerms(s.terms, expected) && recordReady(s, succession, office, c, at)
      && office.power >= 1 && office.workSeconds >= 60 && succession.ruler.workSeconds >= 60);
  }
  function accept(s, succession, office, expected, c, at) {
    if (!canAccept(s, succession, office, c, at, expected)) return false;
    s.job = { id: `${s.id}:declaration:${s.nextNumber++}`, progress: 0, seconds: 60, lastAt: at, wasReady: true, terms: copy(s.terms) };
    office.power--; office.assignment = office.clerk.assignment = s.job.id; s.phase = 'recording';
    note(s, at, 'recording', 'Attend one actual minute with the capable incumbent and original authorized clerk. Authentication records coercion and grants no command.'); return true;
  }
  function withdraw(s, succession, office, c, at) {
    if (!active(s) || !c.alive || !c.local || !c.rulerPresent) return false;
    return terminate(s, succession, office, at, 'withdrawn', 'The scientist abandoned this demand. Spent work, energy, injuries and reports remain; no declaration was completed.');
  }
  function absorb(ruler, amount, incapacitated = false) {
    if (!ruler?.personalDefense || ruler.status !== 'alive' || incapacitated) return { damage: amount, absorbed: 0 };
    const absorbed = Math.max(0, Math.min(amount, 10, Math.floor(ruler.personalDefense.mana / 2)));
    ruler.personalDefense.mana -= absorbed * 2; return { damage: amount - absorbed, absorbed };
  }
  function advance(s, succession, office, c, at, effects = {}) {
    if (!active(s) || !c.alive) return false;
    const r = succession.ruler, p = r.personalDefense, e = s.encounter;
    if (r.status !== 'alive' || c.rulerIncapacitated) return terminate(s, succession, office, at, 'unresolvedSuccession',
      'The incumbent is dead or incapable of declaration. No signature, designation or recognition is manufactured; succession remains unresolved.');
    if (!current(s, succession, c) || c.bodyEpoch !== e.bodyEpoch || r.assignment !== s.id)
      return terminate(s, succession, office, at, 'interrupted', 'Original authority, charter, body or existing-person availability changed. No declaration was completed.');
    if (s.phase === 'offered' || s.phase === 'recording') {
      if (at >= s.terms.expiresAt) return terminate(s, succession, office, at, 'expired', 'Unsigned declaration terms expired without renewed energy, recognition or a fabricated signature.');
      if (s.phase === 'offered') return false;
      const j = s.job, ready = recordReady(s, succession, office, c, at, true) && sameTerms(s.terms, j.terms);
      if (!ready) { j.wasReady = false; j.lastAt = at; return false; }
      const start = j.lastAt;
      const work = j.wasReady ? Math.max(0, Math.min(Math.max(0, at - start), j.seconds - j.progress, office.workSeconds, r.workSeconds)) : 0;
      // The original office budget is its clerk's duty pool, not a second free
      // worker. Charge it once alongside the incumbent's actual attended work.
      j.lastAt = at; j.wasReady = true; j.progress += work; office.workSeconds -= work; r.workSeconds -= work;
      if (j.progress < j.seconds) return Boolean(work);
      const completedAt = start + work;
      s.receipt = { id: `${s.id}:abdication`, at: completedAt, cityId: s.cityId, charterId: s.charterId,
        declarantId: r.id, successorId: 'scientist', bodyEpoch: e.bodyEpoch, terms: copy(j.terms),
        recorderId: office.clerk.id, recorderInstitutionId: office.institutionId, witnesses: [...new Set(c.recordWitnesses)],
        conductReportIds: s.reports.map(r => r.id), origin: 'coerced', authentication: 'Physically heard and recorded declaration of the living capable incumbent',
        recognition: 'disputedSuccessorClaim', institutionalCommand: [], outgoingStatus: 'Living private individual; personal rights retained', limitations: LIMITS };
      // Only personal relinquishment is stored here. Existing recognized city
      // control, appointments, world facts and voluntary handover remain intact.
      r.officeStatus = { at: completedAt, status: 'abdicatedUnderCoercion', sourceReceiptId: s.receipt.id };
      release(s, succession, office); s.phase = 'claimed';
      note(s, completedAt, 'abdication', 'The living incumbent personally relinquished the office and designated the scientist under coercion. The authenticated record is a disputed claim; institutions have not recognized or obeyed it.'); return true;
    }
    if (!c.local || !c.capable || !c.sameGround || c.rulerDistanceM > 6)
      return terminate(s, succession, office, at, 'withdrawn', 'The local threat ended through actual departure or scientist incapacity. No custody or signature was created.');
    if (offer(s, succession, c, at)) return true;
    if (s.pendingPulse && at >= s.pendingPulse.releaseAt) {
      const pulse = s.pendingPulse; s.pendingPulse = null; e.nextAttackAt = at + 5;
      if (sameCell(c.cell, pulse.targetCell) && c.rulerLineOfEffect && c.rulerDistanceM <= 4) effects.pulse?.(12);
    } else if (!s.pendingPulse && c.rulerTracksScientist && c.rulerLineOfEffect && at >= e.nextAttackAt) {
      if (c.rulerDistanceM <= 4 && p.mana >= 12) {
        p.mana -= 12; s.pendingPulse = { targetCell: copy(c.cell), releaseAt: at + 2 };
        note(s, at, 'telegraph', 'The incumbent marked a personal force pulse: two seconds to move or guard.'); effects.telegraph?.(s.pendingPulse);
      } else if (c.rulerDistanceM <= 1 && p.stamina >= 6) { p.stamina -= 6; e.nextAttackAt = at + 4; effects.strike?.(); }
    }
    if (effects.alive && !effects.alive()) return true;
    if (c.escapeReachable && p.stamina >= 1 && at >= e.nextMoveAt) {
      if (effects.move?.(r, ESCAPE)) p.stamina--; e.nextMoveAt = at + 1; s.phase = 'escaping';
      if (sameCell(r.mapCell, ESCAPE) && c.rulerDistanceM > 4) return terminate(s, succession, office, at, 'escapedLocalEncounter',
        'The incumbent physically withdrew to existing municipal ground. No citywide escape, new guard force or abdication is implied.');
    } else s.phase = 'resisting';
    return true;
  }
  function publicView(s) {
    return s ? copy({ phase: s.phase, pendingPulse: s.pendingPulse, terms: s.terms, receipt: s.receipt, reports: s.reports,
      recording: s.job ? { progress: s.job.progress, seconds: s.job.seconds } : null, message: s.message, history: s.history,
      limitations: LIMITS, repertoire: REPERTOIRE }) : null;
  }
  return { ESCAPE, LIMITS, REPERTOIRE, active, dangerous, prepareRuler, create, normalize, canDemand, canAccept, demand, attack, accept, withdraw, absorb, advance, publicView };
});
