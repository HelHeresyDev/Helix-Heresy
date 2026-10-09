(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent,
    typeof module === 'object' && module.exports ? require('./sovereign-bargains') : root.HelixSovereignBargains);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixDefenderChallenges = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme, Bargains) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const registry = Theme.createRegistry([{ id: 'challenge.shared.ward-bout', kind: 'defenderChallenge', compatibility: 'shared',
    contentTags: ['science', 'survival'], template: 'Supervised limited ward-defense bout', fallback: true }]);
  const GROUND = Object.freeze({ x: 10, y: 12, z: 6, width: 5, height: 4 });
  const START = Object.freeze({ x: 12, y: 12, z: 6 });
  const DEFENDER = Object.freeze({ x: 14, y: 12, z: 6 });
  const WITNESS = Object.freeze({ x: 16, y: 11, z: 6 });
  const PREP_SECONDS = 300, BOUT_SECONDS = 120, OFFER_SECONDS = 3600;
  const LIMITS = 'One limited supervised bout, not unrestricted combat or proof of city-defense superiority. No command, succession, soldiers, immunity, divine approval, neighboring sovereignty or joint-stronghold control. Wounds and spent energy persist; no free healing or equipment.';
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
  const inside = c => c?.z === GROUND.z && c.x >= GROUND.x && c.x < GROUND.x + GROUND.width && c.y >= GROUND.y && c.y < GROUND.y + GROUND.height;
  const able = a => a?.status === 'alive' && a.health > 35 && (a.fatigue || 0) < 80;
  const reserved = s => ['preparing', 'outward', 'ready', 'active', 'returning', 'petitioning'].includes(s?.phase);
  function create(b, theme = 'madcap', seed = '') {
    if (!b?.source?.charterId || !b.defender || !b.representative) return null;
    const content = Theme.selectContent(registry, { kind: 'defenderChallenge', worldTheme: theme, seed: seed || b.source.cityId, required: true });
    if (!content.ok) return null;
    // Elaborate the already allocated rare defender, not a new recruit or founder.
    if (!b.defender.actorKind) Object.assign(b.defender, { actorKind: 'cityDefender', maxHealth: 100,
      skills: { striking: 35, guarding: 50, evasion: 20, perception: 40, animancy: 60 },
      wardMana: 120, wardManaCapacity: 120 });
    return { id: `${b.defender.id}:sanctioned-challenge`, definitionId: content.definitionId, sourceTheme: content.sourceTheme,
      phase: 'idle', terms: null, job: null, bout: null, receipt: null, petition: null, conduct: [], message: '', log: [], nextNumber: 1 };
  }
  function normalize(s) { return s?.id && typeof s.phase === 'string' && Array.isArray(s.log) ? copy(s) : null; }
  function note(s, at, kind, text) { s.message = text; s.log.push({ at, kind, text }); s.log = s.log.slice(-60); }
  function current(s, b, c) {
    return Boolean(s && b && c.alive && c.bodyEpoch === s.terms?.bodyEpoch && c.cityId === b.source.cityId && c.visitPermission
      && c.administrationAvailable && c.defenseAvailable && c.authorityId === b.source.authority.id
      && s.terms.charterId === b.source.charterId && s.terms.defenderId === b.defender.id && s.terms.representativeId === b.representative.id);
  }
  function request(s, b, office, c, at) {
    const reason = Bargains.localReason(b, office, c);
    if (!s || !['idle', 'offered', 'expired', 'declined'].includes(s.phase) || reason || b.job || b.defender.assignment || b.representative.assignment
      || b.defender.health < 80 || c.health < 70 || c.incapacitated || b.defender.wardMana < 24 || b.defender.workSeconds < PREP_SECONDS + BOUT_SECONDS
      || b.representative.workSeconds < PREP_SECONDS + BOUT_SECONDS || office.workSeconds < PREP_SECONDS || office.power < 1 || at < (office.availableAt || 0)
      || !c.groundAvailable) {
      if (s) note(s, at, 'refusal', reason || 'Defender refuses: existing duties, wounds, finite ward energy, supervision or reachable ground prevent this challenge. No crime or civic exclusion follows.');
      return false;
    }
    s.phase = 'offered';
    s.terms = { id: `${s.id}:terms:${s.nextNumber++}`, offeredAt: at, expiresAt: at + OFFER_SECONDS, bodyEpoch: c.bodyEpoch,
      charterId: b.source.charterId, authorityId: b.source.authority.id, institutionId: b.source.defenseId,
      representativeId: b.representative.id, defenderId: b.defender.id, officeId: office.id,
      authorization: 'Existing defense branch authorizes this one supervised training demonstration; no succession rule is amended.',
      ground: copy(GROUND), preparationSeconds: PREP_SECONDS, durationSeconds: BOUT_SECONDS, permittedActions: ['strike', 'soulLash', 'guard', 'withdraw'],
      stop: 'Surrender, departure, incapacity, health at or below 35, 25 actual defender health lost, 20 scientist health lost, or two minutes. No health floor prevents lethal injury.',
      repertoire: 'Limited projection ward: absorbs up to 12 damage per hit, costs two personal mana per absorbed point. Telegraphic force pulse: eight personal mana, two-second windup at an observed tile, four-meter reach, six damage, six-second recovery. Step away or guard. No city wall-energy draw.',
      stakes: 'A witnessed demonstration and, on defender concession, eligibility to file one request for political negotiation. Acceptance of that future negotiation and any transfer of power remain undecided.', limitations: LIMITS };
    note(s, at, 'offer', 'Exact optional training terms offered. Civic services and ordinary audiences do not require a bout.'); return true;
  }
  function beginJob(s, b, office, c, at, kind, seconds) {
    if (Bargains.localReason(b, office, c) || b.job || office.power < 1 || office.workSeconds < seconds
      || b.defender.workSeconds < seconds || b.representative.workSeconds < seconds || at < (office.availableAt || 0)) return false;
    s.job = { id: `${s.id}:${kind}`, kind, progress: 0, seconds, lastAt: at, wasReady: true };
    office.power--; office.assignment = s.job.id;
    b.defender.assignment = b.representative.assignment = s.id;
    s.phase = kind === 'preparation' ? 'preparing' : 'petitioning'; return true;
  }
  function accept(s, b, office, expected, c, at) {
    if (s?.phase !== 'offered' || at >= s.terms.expiresAt || JSON.stringify(expected) !== JSON.stringify(s.terms)
      || !current(s, b, c) || !c.groundAvailable || c.health < 70 || b.defender.health < 80 || b.defender.wardMana < 24
      || b.defender.assignment || b.representative.assignment || b.defender.workSeconds < PREP_SECONDS + BOUT_SECONDS
      || b.representative.workSeconds < PREP_SECONDS + BOUT_SECONDS) return false;
    return beginJob(s, b, office, c, at, 'preparation', PREP_SECONDS);
  }
  function releaseJob(s, office) { if (office?.assignment === s.job?.id) office.assignment = null; s.job = null; }
  function releasePeople(s, b) {
    for (const a of [b.defender, b.representative]) if (a.assignment === s.id) a.assignment = null;
  }
  function finish(s, b, at, outcome, witnessed, detail) {
    if (s.receipt) return false;
    s.receipt = { id: `${s.id}:receipt`, at, outcome, witnessed, witnessId: witnessed ? b.representative.id : null,
      defenderId: b.defender.id, charterId: b.source.charterId, authorityId: b.source.authority.id, bodyEpoch: s.terms.bodyEpoch,
      boutStartedAt: s.bout?.startedAt ?? null, actions: s.bout?.actions || 0, detail, limitations: LIMITS };
    s.phase = 'returning'; s.pendingPulse = null; s.nextMoveAt = at;
    note(s, at, 'outcome', `${outcome}: ${detail} ${LIMITS}`); return true;
  }
  function withdraw(s, b, office, c, at) {
    if (!s || !['offered', 'preparing', 'outward', 'ready', 'active', 'petitioning'].includes(s.phase)) return false;
    if (['offered', 'preparing'].includes(s.phase)) {
      releaseJob(s, office); releasePeople(s, b); s.phase = 'declined';
      note(s, at, 'withdrawal', 'Declined or interrupted preparation. Spent staff work and power remain spent; no criminal allegation.'); return true;
    }
    if (s.phase === 'petitioning') { releaseJob(s, office); releasePeople(s, b); s.phase = 'closed'; return true; }
    return finish(s, b, at, 'withdrawn', Boolean(c.witnessPresent), 'Scientist withdrew; no command, guilt or automatic defeat.');
  }
  function start(s, b, c, at) {
    if (s?.phase !== 'ready' || !current(s, b, c) || !c.capable || c.busy || !inside(c.cell) || !c.witnessPresent || !c.defenderPresent
      || !able(b.defender) || !able(b.representative) || c.health < 70 || b.defender.health < 80 || !c.groundAvailable) return false;
    s.phase = 'active'; s.bout = { startedAt: at, endsAt: at + BOUT_SECONDS, scientistHealth: c.health,
      defenderHealth: b.defender.health, nextPulseAt: at + 3, lastAt: at, actions: 0 };
    note(s, at, 'start', 'Supervised bout started. The defender will signal each force pulse; move away from its marked tile or guard.'); return true;
  }
  function authorized(s, b, c, action, at) {
    return Boolean(s?.phase === 'active' && current(s, b, c) && at < s.bout.endsAt && inside(c.cell)
      && c.witnessPresent && c.defenderPresent && c.capable && able(b.defender) && able(b.representative)
      && b.defender.health > 35 && c.health > 35 && s.bout.defenderHealth - b.defender.health < 25
      && s.bout.scientistHealth - c.health < 20 && ['strike', 'soulLash'].includes(action));
  }
  function absorb(s, b, amount) {
    // A real finite projection, not armor/HP inflation or an invulnerable floor.
    if (!b?.defender || !able(b.defender)) return { damage: amount, absorbed: 0 };
    const absorbed = Math.min(amount, 12, Math.floor(b.defender.wardMana / 2));
    b.defender.wardMana -= absorbed * 2;
    return { damage: amount - absorbed, absorbed };
  }
  function filePetition(s, b, office, c, at) {
    if (s?.phase !== 'closed' || s.receipt?.outcome !== 'defenderConceded' || !s.receipt.witnessed || s.petition
      || !current(s, b, c) || b.defender.assignment || b.representative.assignment) return false;
    return beginJob(s, b, office, c, at, 'petition', 60);
  }
  function advance(s, b, office, c, at, effects = {}) {
    if (!s || !b || !c.alive) return false;
    if (s.phase === 'offered' && at >= s.terms.expiresAt) { s.phase = 'expired'; note(s, at, 'expiry', 'Unsigned training terms expired without crime or loss of civic access.'); }
    if (s.job) {
      const j = s.job;
      if (!current(s, b, c) || !c.atCounter || !c.capable) return withdraw(s, b, office, c, at);
      // Own reservations are not outside jobs; shared office/people still must be available.
      const local = { ...c, busy: c.otherBusy };
      const actors = [b.defender, b.representative];
      const available = office?.active && office.channelPowered && office.clerk?.status === 'alive' && office.clerk.health >= 50
        && c.clerkPresent && c.lineOfSight && c.participantsPresent && !local.busy && actors.every(able) && actors.every(a => a.assignment === s.id && a.locationId === office.id)
        && (!office.assignment || office.assignment === j.id) && office.workSeconds > 0 && actors.every(a => a.workSeconds > 0);
      const work = available && j.wasReady ? Math.min(Math.max(0, at - Math.max(j.lastAt, office.availableAt || 0)), j.seconds - j.progress,
        office.workSeconds, ...actors.map(a => a.workSeconds)) : 0;
      j.lastAt = at; j.wasReady = available;
      if (!available) { if (office?.assignment === j.id) office.assignment = null; s.message = 'Preparation paused: original people or shared office unavailable. No retroactive work.'; return false; }
      office.assignment = j.id; office.workSeconds -= work; for (const a of actors) a.workSeconds -= work; j.progress += work;
      if (j.progress < j.seconds) return work > 0;
      if (j.kind === 'petition') {
        s.petition = { id: `${s.id}:political-request`, at, receiptId: s.receipt.id, receivedBy: b.representative.id,
          authorityId: b.source.authority.id, status: 'filedNotAccepted', scope: 'Request to negotiate based only on the witnessed limited demonstration; no transfer or divine assent.' };
        releaseJob(s, office); releasePeople(s, b); s.phase = 'closed'; note(s, at, 'petition', 'Performance-backed political request physically filed. A negotiation or transfer has not been accepted.');
      } else { releaseJob(s, office); s.phase = 'outward'; s.nextMoveAt = at; note(s, at, 'preparation', 'Original defender and representative walk to the designated existing open ground. Walk there yourself; no teleport or equipment issue.'); }
      return true;
    }
    if (['outward', 'ready', 'active'].includes(s.phase) && (!current(s, b, c) || !able(b.defender) || !able(b.representative)))
      return finish(s, b, at, 'interrupted', Boolean(c.witnessPresent), 'Original authority, participant, body or permission unavailable.');
    if (['outward', 'returning'].includes(s.phase) && at >= (s.nextMoveAt || 0)) {
      s.nextMoveAt = at + 1; const returning = s.phase === 'returning';
      const targets = returning ? [{ x: 19, y: 9, z: 6 }, { x: 18, y: 9, z: 6 }] : [DEFENDER, WITNESS];
      let arrived = true;
      for (const [i, a] of [b.defender, b.representative].entries()) {
        if (same(a.mapCell, targets[i])) continue;
        arrived = false; if (able(a) && a.workSeconds > 0 && effects.move) {
          if (effects.move(a, targets[i])) a.workSeconds--;
        }
      }
      if (arrived) {
        s.phase = returning ? 'closed' : 'ready';
        if (returning) releasePeople(s, b);
        else s.readyUntil = at + OFFER_SECONDS;
        note(s, at, 'arrival', returning ? 'Original participants returned physically to the counter; spent energy and wounds remain.' : 'Defender and representative reached the training ground. Join them to begin within one hour.');
      }
      return true;
    }
    if (s.phase === 'ready' && at >= s.readyUntil) return finish(s, b, at, 'missed', false, 'Attendance window elapsed; no guilt or surrender.');
    if (s.phase !== 'active') return false;
    if (!inside(c.cell) || !c.witnessPresent || !c.defenderPresent || c.busy) return finish(s, b, at, 'withdrawn', Boolean(c.witnessPresent), 'Scientist left the supervised ground or supervision ended.');
    const elapsed = Math.max(0, Math.min(at, s.bout.endsAt) - s.bout.lastAt); s.bout.lastAt = at;
    const work = Math.min(elapsed, b.defender.workSeconds, b.representative.workSeconds);
    b.defender.workSeconds -= work; b.representative.workSeconds -= work;
    if (work < elapsed) return finish(s, b, at, 'interrupted', true, 'Finite supervision or defender duty allocation exhausted.');
    if (!c.capable || c.health <= 35 || s.bout.scientistHealth - c.health >= 20)
      return finish(s, b, at, 'scientistStopped', true, 'Supervisor stopped the bout for actual scientist injury or incapacity; no free treatment.');
    if (s.bout.defenderHealth - b.defender.health >= 25)
      return finish(s, b, at, 'defenderConceded', true, 'Defender conceded after 25 actual health lost under the agreed restrictions.');
    if (at >= s.bout.endsAt) return finish(s, b, at, 'timeLimit', true, 'Limited bout ended without defender concession.');
    if (!b.defender.workSeconds || !b.representative.workSeconds) return finish(s, b, at, 'interrupted', true, 'Finite supervision or defender duty allocation exhausted.');
    if (s.pendingPulse && at >= s.pendingPulse.releaseAt) {
      const pulse = s.pendingPulse; s.pendingPulse = null; s.bout.nextPulseAt = at + 6;
      if (same(c.cell, pulse.targetCell) && c.lineOfEffect && c.distanceM <= 4 && effects.pulse) effects.pulse(6);
      note(s, at, 'pulse', same(c.cell, pulse.targetCell) ? 'Marked force pulse released; cover, range and guarding determine its effect.' : 'Scientist moved off the marked tile; pulse missed.');
    } else if (!s.pendingPulse && at >= s.bout.nextPulseAt && b.defender.wardMana >= 8 && c.lineOfEffect && c.distanceM <= 4) {
      b.defender.wardMana -= 8; s.pendingPulse = { targetCell: copy(c.cell), releaseAt: at + 2 };
      note(s, at, 'telegraph', `Force pulse marked ${c.cell.x},${c.cell.y},${c.cell.z}; release in two seconds. Step away or guard.`);
      effects.telegraph?.(s.pendingPulse);
    }
    return true;
  }
  function publicView(s) {
    if (!s) return null;
    return copy({ phase: s.phase, terms: s.terms, preparing: s.job ? { kind: s.job.kind, progress: s.job.progress, seconds: s.job.seconds } : null,
      bout: s.bout ? { startedAt: s.bout.startedAt, endsAt: s.bout.endsAt, actions: s.bout.actions } : null,
      pendingPulse: s.pendingPulse || null, receipt: s.receipt, petition: s.petition, message: s.message, log: s.log, limitations: LIMITS });
  }
  return { GROUND, START, DEFENDER, WITNESS, PREP_SECONDS, BOUT_SECONDS, LIMITS, inside, reserved, create, normalize, request,
    accept, withdraw, start, authorized, absorb, filePetition, advance, publicView };
});
