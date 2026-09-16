(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPenalDesertion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PHASES = ['desertionAttempt', 'deserted', 'desertionEscort'];
  function begin(s, now) {
    if (!['field', 'withdrawal'].includes(s.phase) || s.serviceEndedAt != null || s.desertion?.restrained) return false;
    s.desertionHistory ||= [];
    if (s.desertion) s.desertionHistory.push(JSON.parse(JSON.stringify(s.desertion)));
    s.desertion = { id: `${s.id}:separation:${s.desertionHistory.length + 1}`, status: 'attempting', startedAt: now, observations: [], contacts: {}, pursuitUntil: null, restraint: 0, restrained: false, surrender: false, lastSeenAt: null, lastKnown: null, escapedAt: null, newConviction: false, property: [], noticeSerial: 0 };
    s.phase = 'desertionAttempt'; return true;
  }
  function observe(d, observerId, cell, now, voluntary = false) {
    if (!d || !['attempting', 'escaped'].includes(d.status) || (!voluntary && cell.x < 39)) return false;
    if (d.lastSeenAt == null || d.status === 'escaped' && now - d.lastSeenAt > 20) { d.pursuitUntil = now + 120; d.noticeSerial++; }
    d.lastSeenAt = now; d.lastKnown = { ...cell }; d.contacts[observerId] = { cell: { ...cell }, at: now };
    if (!d.observations.some(r => r.observerId === observerId && r.kind === (voluntary ? 'offeredSurrender' : 'departedOperationalPerimeter'))) {
      d.observations.push({ observerId, at: now, cell: { ...cell }, kind: voluntary ? 'offeredSurrender' : 'departedOperationalPerimeter', allegationOnly: true }); d.noticeSerial++;
    }
    return true;
  }
  function searchTarget(d, now) { return d.lastKnown && now <= d.pursuitUntil && now - d.lastSeenAt <= 20 ? d.lastKnown : null; }
  function canEscape(s, now, facts) {
    const d = s.desertion;
    return s.phase === 'desertionAttempt' && d?.status === 'attempting' && !d.surrender && s.serviceEndedAt == null && facts.mobile && facts.atExit && !facts.controlled && (d.lastSeenAt == null || now - d.lastSeenAt >= 10);
  }
  function restraint(d, elapsed, facts) {
    if (!facts.authorized || !facts.capable || !facts.adjacent || !facts.observed || facts.threatened) { d.restraint = 0; d.restraintActorId = null; return false; }
    if (d.restraintActorId !== facts.actorId) { d.restraint = 0; d.restraintActorId = facts.actorId; }
    d.restraint += Math.max(0, elapsed); return d.restraint >= 10;
  }
  function conduct(s, kind, targetId, witnesses, now, receipt) {
    s.squadConduct ||= [];
    const id = receipt || `${kind}:${targetId}:${now}`;
    if (!witnesses.length || s.squadConduct.some(r => r.id === id)) return false;
    s.squadConduct.push({ id, kind, targetId, witnesses: [...witnesses], at: now, reaction: kind === 'aid' ? 'Acknowledges the aid; military obligations remain.' : kind === 'threat' ? 'Wary after the witnessed threat.' : kind === 'attack' ? 'Hostile after the witnessed attack; no automatic lethal-force authority.' : 'Remembers being left behind; no automatic conviction.' }); return true;
  }
  return { PHASES, begin, observe, searchTarget, canEscape, restraint, conduct };
});
