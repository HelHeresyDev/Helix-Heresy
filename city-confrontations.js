(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityConfrontations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const registry = Theme.createRegistry([{ id: 'confrontation.shared.abdication-demand', kind: 'cityConfrontation', compatibility: 'shared',
    contentTags: ['science', 'survival'], template: 'An incumbent rejects a physically heard abdication demand', fallback: true }]);
  const LIMITS = 'Dangerous unsanctioned confrontation, not training. No time limit, injury floor, automatic abdication, institutional obedience, arrest, conviction, divine approval or city-power completion. A personal ceasefire allows withdrawal only; sovereignty is unchanged.';
  const REPERTOIRE = 'The same defender uses personal reserves, not city-wall energy: projection absorbs at most 24 damage per hit for one mana per point; marked force pulse costs 12 mana, winds up two seconds, reaches six meters and deals 18 force damage with four-second recovery. Close strikes use ordinary accuracy and injury rules, six stamina and four-second recovery. Walking spends one stamina per step. No free recharge. The supervised demonstration did not use this full local repertoire or prove superiority over city defenses.';
  const active = s => ['fighting', 'ceasefire', 'returning'].includes(s?.phase);
  const mobile = a => a?.status === 'alive' && a.health > 0 && (a.fatigue || 0) < 100;
  const same = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  function create(succession, b, theme = 'madcap') {
    if (!succession?.ruler || succession.source.authority.kind !== 'individual'
      || succession.ruler.id !== b?.source.authority.id || succession.source.charterId !== b.source.charterId) return null;
    const content = Theme.selectContent(registry, { kind: 'cityConfrontation', worldTheme: theme, seed: b.source.cityId, required: true });
    if (!content.ok) return null;
    return { id: `${b.source.cityId}:political-confrontation`, definitionId: content.definitionId, sourceTheme: content.sourceTheme,
      cityId: b.source.cityId, charterId: b.source.charterId, rulerId: succession.ruler.id, defenderId: b.defender.id,
      phase: 'idle', encounter: null, pendingPulse: null, reports: [], outcomes: [], message: '', history: [], nextNumber: 1 };
  }
  const normalize = s => s?.rulerId && Array.isArray(s.reports) && Array.isArray(s.outcomes) ? copy(s) : null;
  function note(s, at, kind, text) { s.message = text; s.history.push({ at, kind, text }); s.history = s.history.slice(-40); }
  function witnessed(s, c, at, kind, detail, targetId) {
    for (const witnessId of c.witnessIds || []) s.reports.push({ id: `${s.encounter.id}:report:${s.reports.length + 1}`, at, kind,
      actorId: 'scientist', targetId, witnessId, cityId: s.cityId, cell: copy(c.cell), detail,
      finding: 'Personally observed conduct only; legal elements, defenses and guilt require separate proceedings.' });
  }
  function demand(s, succession, b, c, at) {
    if (!s || active(s) || !c.alive || !c.capable || c.busy || !c.local || !c.rulerPresent || !c.defenderCanHear
      || !c.charterCurrent || c.authorityId !== s.rulerId || succession.handover || succession.job || succession.ruler.officeStatus?.status === 'abdicatedUnderCoercion'
      || succession.ruler.id !== s.rulerId || b.defender.id !== s.defenderId || b.source.charterId !== s.charterId || b.source.cityId !== s.cityId
      || succession.ruler.assignment && succession.ruler.assignment !== c.rulerResistanceId || !mobile(succession.ruler) || !c.defenseAvailable
      || b.defender.assignment || b.job || !mobile(b.defender) || c.defenderIncapacitated
      || b.defender.roomId !== succession.ruler.roomId) return false;
    s.encounter = { id: `${s.id}:${s.nextNumber++}`, startedAt: at, bodyEpoch: c.bodyEpoch,
      roomId: succession.ruler.roomId, defenderPost: copy(b.defender.mapCell), lastAt: at, nextAttackAt: at + 2, nextMoveAt: at + 1,
      abdication: 'rejected', ceasefire: null, outcome: null };
    s.phase = 'fighting'; b.defender.assignment = s.encounter.id;
    witnessed(s, c, at, 'abdicationDemand', 'The scientist demanded abdication; the incumbent refused. No office was transferred.', s.rulerId);
    note(s, at, 'refusal', 'The incumbent rejects your demand. The existing defender intervenes to protect the incumbent, not to arrest you. Move away, guard or abandon the demand.');
    return true;
  }
  function ceasefire(s, b, c, at, by = 'scientist') {
    if (s?.phase !== 'fighting' || !c.alive || !c.capable || !c.local || !c.defenderCanHear || !mobile(b?.defender) || c.defenderIncapacitated) return false;
    s.phase = 'ceasefire'; s.pendingPulse = null;
    s.encounter.ceasefire = { at, by, terms: 'Stop attacks and abandon the demand; each person may physically withdraw. No obedience or political agreement.' };
    note(s, at, 'ceasefire', by === 'incumbent' ? 'The defender personally heard the incumbent request a ceasefire for recording life-preserving terms. No command was transferred.'
      : by === 'scientist' ? 'The defender accepts abandonment of the demand and a personal ceasefire. Walk away; injuries, evidence and sovereignty remain.'
      : 'The defender stops attacking and offers a personal ceasefire to preserve their own life or remaining reserves. This is not the ruler surrendering.');
    return true;
  }
  function renewedThreat(s, b, c, at) {
    if (!active(s) || !c.alive || !c.local || !c.defenderCanHear || !mobile(b.defender) || c.defenderIncapacitated
      || b.defender.assignment && b.defender.assignment !== s.encounter.id) return false;
    if (s.encounter.outcome) s.encounter = { ...s.encounter, id: `${s.id}:${s.nextNumber++}`, startedAt: at, outcome: null };
    witnessed(s, c, at, 'renewedThreatToIncumbent', 'The scientist renewed a threat to the incumbent; the existing defender resumed protection.', s.rulerId);
    s.phase = 'fighting'; s.encounter.ceasefire = null; s.encounter.nextAttackAt = at + 2; b.defender.assignment = s.encounter.id;
    note(s, at, 'renewedThreat', 'The same defender resumes incumbent protection with remaining reserves, not a new guard force.'); return true;
  }
  function attack(s, b, c, at, actionId) {
    if (!active(s) || !c.alive || !c.local || !c.defenderObserved) return false;
    if (s.encounter.outcome) s.encounter = { ...s.encounter, id: `${s.id}:${s.nextNumber++}`, startedAt: at, outcome: null, ceasefire: null };
    witnessed(s, c, at, 'attackOutsideTraining', `Observed ${actionId} against the existing defender outside training permission.`, s.defenderId);
    if (s.phase !== 'fighting' && mobile(b.defender) && !c.defenderIncapacitated) {
      s.phase = 'fighting'; s.encounter.ceasefire = null; s.encounter.nextAttackAt = at + 2;
      b.defender.assignment = s.encounter.id;
      note(s, at, 'breach', 'A new attack broke the personal ceasefire. The same defender resumes intervention with remaining reserves.');
    }
    return true;
  }
  function finish(s, b, at, outcome) {
    if (s.encounter.outcome) return false;
    s.encounter.outcome = { id: `${s.encounter.id}:outcome`, at, outcome, sovereignty: 'unchanged', limitations: LIMITS };
    s.outcomes.push(copy(s.encounter.outcome)); s.pendingPulse = null;
    s.phase = mobile(b.defender) && b.defender.assignment === s.encounter.id ? 'returning' : 'closed';
    if (s.phase === 'closed' && b.defender.assignment === s.encounter.id) b.defender.assignment = null;
    note(s, at, 'outcome', `${outcome}. ${LIMITS}`); return true;
  }
  function absorb(s, b, amount, incapacitated = false) {
    if (!active(s) || !mobile(b?.defender) || incapacitated) return { damage: amount, absorbed: 0 };
    const absorbed = Math.max(0, Math.min(amount, 24, Math.floor(b.defender.wardMana || 0)));
    b.defender.wardMana -= absorbed;
    return { damage: amount - absorbed, absorbed };
  }
  function advance(s, succession, b, c, at, effects = {}) {
    if (!active(s) || !c.alive || !s.encounter) return false;
    const d = b.defender, e = s.encounter;
    if (s.phase === 'returning') {
      if (!mobile(d) || c.defenderIncapacitated || d.assignment !== e.id || d.roomId !== e.roomId || (d.stamina || 0) < 1 || same(d.mapCell, e.defenderPost)) {
        if (d.assignment === e.id) d.assignment = null;
        s.phase = 'closed'; return true;
      }
      if (at >= e.nextMoveAt) { if (effects.move?.(d, e.defenderPost)) d.stamina--; e.nextMoveAt = at + 1; }
      return true;
    }
    if (!mobile(d) || c.defenderIncapacitated) return finish(s, b, at, d.status === 'dead' ? 'defenderDead' : 'defenderIncapacitated');
    if (c.bodyEpoch !== e.bodyEpoch || !c.sameGround || c.rulerDistance > 4 && c.distanceM > 6)
      return finish(s, b, at, 'scientistPhysicallyWithdrew');
    if (!c.capable) return finish(s, b, at, 'scientistIncapacitated'); // No custody is manufactured.
    if (!c.charterCurrent || c.authorityId !== s.rulerId || !c.defenseAvailable || succession.handover || d.assignment !== e.id
      || d.id !== s.defenderId || succession.ruler.id !== s.rulerId || b.source.charterId !== s.charterId || succession.ruler.officeStatus?.status === 'abdicatedUnderCoercion')
      return finish(s, b, at, 'interventionDutyUnavailable');
    if (s.phase === 'ceasefire') return false;
    if (d.health <= 20 || (d.wardMana || 0) < 12 && (d.stamina || 0) < 6) {
      if (c.defenderCanHear) return ceasefire(s, b, c, at, 'defender');
      return finish(s, b, at, 'defenderDisengaged');
    }
    if (s.pendingPulse && at >= s.pendingPulse.releaseAt) {
      const pulse = s.pendingPulse; s.pendingPulse = null; e.nextAttackAt = at + 4;
      if (same(c.cell, pulse.targetCell) && c.lineOfEffect && c.distanceM <= 6) effects.pulse?.(18);
      note(s, at, 'pulse', 'Unrestricted local force pulse released; leaving the marked tile, range, cover and guarding determine its effect.');
    } else if (!s.pendingPulse && at >= e.nextAttackAt && c.defenderTracksScientist && c.lineOfEffect && c.distanceM <= 6 && d.wardMana >= 12) {
      d.wardMana -= 12; s.pendingPulse = { targetCell: copy(c.cell), releaseAt: at + 2 };
      note(s, at, 'telegraph', 'Dangerous force pulse marked your tile; two seconds to move or guard.'); effects.telegraph?.(s.pendingPulse);
    } else if (!s.pendingPulse && at >= e.nextAttackAt && c.defenderTracksScientist && c.distanceM <= 1 && c.lineOfEffect && d.stamina >= 6) {
      d.stamina -= 6; e.nextAttackAt = at + 4; effects.strike?.();
      note(s, at, 'strike', 'Defender attempted an ordinary close strike, spending actual stamina.');
    }
    if (effects.alive && !effects.alive()) return true;
    if (s.phase === 'fighting' && c.defenderTracksScientist && c.distanceM > 1 && at >= e.nextMoveAt && d.stamina >= 1) {
      if (effects.move?.(d, c.cell)) d.stamina--; e.nextMoveAt = at + 1;
    }
    e.lastAt = at; return true;
  }
  function publicView(s) {
    return s ? copy({ phase: s.phase, demand: s.encounter ? { startedAt: s.encounter.startedAt, abdication: s.encounter.abdication } : null,
      pendingPulse: s.pendingPulse, ceasefire: s.encounter?.ceasefire || null, reports: s.reports, outcomes: s.outcomes,
      message: s.message, limitations: LIMITS, repertoire: REPERTOIRE }) : null;
  }
  return { LIMITS, REPERTOIRE, create, normalize, active, demand, ceasefire, renewedThreat, attack, advance, absorb, publicView };
});
