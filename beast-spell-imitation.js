(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixBeastSpellImitation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SPECIES = 'beast:mirror-ape', MANA = 48, SKILL = 1, PREPARE = 2, RECOVERY = 8;
  const SPELL = Object.freeze({ id: 'soulLash', label: 'Soul Lash', manaCost: 12, baseDamage: 14, rangeM: 5 });
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const finite = n => Number.isFinite(n) && n >= 0;
  const id = s => typeof s === 'string' && s.length > 0;
  const cell = p => p && ['x', 'y', 'z'].every(k => Number.isInteger(p[k]));
  const same = (a, b) => cell(a) && cell(b) && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  function create(actorId, populationId, at) {
    return { actorId, populationId, allocatedAt: at, mana: MANA, spent: 0, animancy: SKILL, known: [], casts: [],
      pending: null, nextCastAt: at, serial: 0, lastEvent: null };
  }
  function valid(a) {
    const s = a?.spellImitation;
    return Boolean(a?.actorKind === 'wildernessBeast' && a.speciesId === SPECIES && !a.genome && s && !s.invalid
      && s.actorId === a.id && s.populationId === a.populationId && finite(s.mana) && finite(s.spent)
      && finite(s.allocatedAt)
      && s.mana + s.spent === MANA && s.spent % SPELL.manaCost === 0 && s.animancy === SKILL
      && Array.isArray(s.known) && s.known.length <= 1 && s.known.every(k => k?.spellId === SPELL.id && id(k.castId)
        && id(k.casterId) && id(k.roomId) && cell(k.casterCell) && finite(k.observedAt) && k.observedAt >= s.allocatedAt)
      && Array.isArray(s.casts) && s.casts.length * SPELL.manaCost === s.spent
      && new Set(s.casts.map(c => c?.id)).size === s.casts.length
      && s.casts.every(c => id(c?.id) && finite(c.at) && id(c.targetId) && ['preparing', 'released', 'interrupted'].includes(c.state))
      && (!s.casts.length || s.known.length === 1)
      && finite(s.nextCastAt) && Number.isSafeInteger(s.serial) && s.serial >= 0
      && s.casts.filter(c => c.state === 'preparing').length === (s.pending ? 1 : 0)
      && (!s.pending || id(s.pending.id) && id(s.pending.roomId) && finite(s.pending.at) && cell(s.pending.casterCell) && cell(s.pending.targetCell)
        && finite(s.pending.casterHeightM) && finite(s.pending.targetHeightM) && finite(s.pending.bodyEpoch)
        && finite(s.pending.visitAt)
        && s.pending.releaseAt === s.pending.at + PREPARE && s.pending.spellId === SPELL.id
        && s.casts.some(c => c.id === s.pending.id && c.state === 'preparing' && c.targetId === s.pending.targetId))
      && (!s.lastEvent || finite(s.lastEvent.at) && s.lastEvent.spellId === SPELL.id
        && s.casts.some(c => c.id === s.lastEvent.id && c.state === s.lastEvent.kind)));
  }
  function normalizeActor(a) {
    if (a?.speciesId === SPECIES && a.spellImitation && !valid(a))
      a.spellImitation = { ...(typeof a.spellImitation === 'object' ? a.spellImitation : {}), invalid: true };
    return a;
  }
  function able(a, c) {
    return valid(a) && c.alive && c.sourceCurrent && c.local && a.status === 'alive' && a.health >= a.maxHealth * .3
      && !c.incapacitated && c.visual !== false && c.conscious !== false;
  }
  function observe(a, event, c) {
    if (!able(a, c) || !event || event.spellId !== SPELL.id || !event.released || !event.paid
      || !id(event.id) || !id(event.casterId) || event.casterId === a.id || !id(event.roomId) || !cell(event.casterCell)
      || !finite(event.at) || event.at < a.spellImitation.allocatedAt || !c.casterVisible || !c.releaseVisible || a.roomId !== event.roomId
      || a.spellImitation.known.some(k => k.spellId === SPELL.id)) return false;
    // Deliberately copy neither reserves, equipment, skill, damage modifiers,
    // caster memories nor a command. One complete observed release suffices.
    a.spellImitation.known.push({ spellId: SPELL.id, castId: event.id, casterId: event.casterId,
      casterCell: copy(event.casterCell), roomId: event.roomId, observedAt: event.at }); return true;
  }
  function canCast(a, c) {
    return able(a, c) && a.spellImitation.known.some(k => k.spellId === SPELL.id) && c.handsFree && !c.suppressed && !c.dialogue
      && (!a.climbing || a.climbing.mode === 'perched') && !a.climbingInvalid
      && c.targetVisible && c.lineOfEffect && finite(c.distanceM) && c.distanceM <= SPELL.rangeM && c.targetAlive && c.targetSouled
      && c.targetKind === 'creature' && !c.protectedTarget;
  }
  function begin(a, targetId, c, at) {
    const s = a?.spellImitation;
    if (!canCast(a, c) || !finite(at) || !id(targetId) || s.pending || at < s.nextCastAt || at < (a.nextAttackAt || 0)
      || s.mana < SPELL.manaCost || c.decision !== 'pursue' || !cell(a.mapCell) || !cell(c.targetCell)
      || !finite(c.bodyEpoch) || !finite(c.casterHeightM) || !finite(c.targetHeightM) || !finite(c.visitAt)) return false;
    const castId = `${a.id}:imitated-cast:${++s.serial}`;
    s.mana -= SPELL.manaCost; s.spent += SPELL.manaCost;
    s.pending = { id: castId, spellId: SPELL.id, at, releaseAt: at + PREPARE, targetId,
      roomId: a.roomId, casterCell: copy(a.mapCell), targetCell: copy(c.targetCell),
      casterHeightM: c.casterHeightM, targetHeightM: c.targetHeightM, bodyEpoch: c.bodyEpoch, visitAt: c.visitAt };
    s.casts.push({ id: castId, targetId, at, casterHeightM: c.casterHeightM, state: 'preparing' });
    s.nextCastAt = at + RECOVERY; a.nextAttackAt = at + RECOVERY;
    s.lastEvent = { id: castId, at, kind: 'preparing', spellId: SPELL.id }; return true;
  }
  function interrupt(a, reason, at, alive = true) {
    if (!alive || !finite(at) || !valid(a) || !a.spellImitation.pending) return false;
    const s = a.spellImitation, p = s.pending, cast = s.casts.find(c => c.id === p.id);
    cast.state = 'interrupted'; cast.endedAt = at; cast.reason = reason;
    s.lastEvent = { id: p.id, at, kind: 'interrupted', spellId: SPELL.id }; s.pending = null; return true;
  }
  function advance(a, c, at) {
    if (!c.alive || !finite(at) || !valid(a) || !a.spellImitation.pending || at < a.spellImitation.pending.at) return null;
    const s = a.spellImitation, p = s.pending;
    if (!canCast(a, c) || p.roomId !== a.roomId || p.bodyEpoch !== c.bodyEpoch || p.visitAt !== c.visitAt || !same(a.mapCell, p.casterCell)
      || !same(c.targetCell, p.targetCell) || c.casterHeightM !== p.casterHeightM || c.targetHeightM !== p.targetHeightM) {
      interrupt(a, 'Original target, caster, casting limbs or channel changed', at); return null;
    }
    if (at < p.releaseAt) return null;
    const cast = s.casts.find(c => c.id === p.id); cast.state = 'released'; cast.endedAt = at;
    s.pending = null; s.lastEvent = { id: p.id, at, kind: 'released', spellId: SPELL.id };
    return copy(p);
  }
  // Called only after actual player visibility. Merely looking at a learner
  // never exposes its private learned spells, source observations or reserves.
  function observedEvent(a, previous, at) {
    const e = a?.spellImitation?.lastEvent;
    return copy(valid(a) && e?.at === at && e.kind === 'released' ? { at, spell: SPELL.label, kind: 'released' } : previous?.spellEvent || null);
  }
  function visiblePreparation(a) { return valid(a) && a.spellImitation.pending ? 'Preparing a familiar arcane lashing pattern' : null; }
  return { SPECIES, MANA, SKILL, PREPARE, RECOVERY, SPELL, create, valid, normalizeActor, able, observe, canCast, begin, advance,
    interrupt, observedEvent, visiblePreparation };
});
