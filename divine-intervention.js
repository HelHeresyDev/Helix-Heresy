(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./strategic-world') : root.HelixStrategicWorld);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixDivineIntervention = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (World) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const REPORT_SECONDS = 120, ATTENTION = 120, DURATION = 600;
  const TERMS = 'Do not attack the named faithful representative or this protecting manifestation. No worship, conversion, divine sovereignty, research concession or surrender of civic authority is promised. Renewed witnessed aggression ends this local nonaggression arrangement.';
  const LIMITS = 'One local protecting avatar, not the god’s true individual, a new civic ruler or a planetary counterpower. Defeat or expiry proves neither divine death nor permanent safety. Loss of worship causes descent, not death. Original cases, people, civic agreements and rights remain independent.';
  const divine = r => r?.god?.lifecycle?.lifeState === 'living' && r.god.lifecycle.divinityState === 'divine'
    && r.god.divineCore?.identityBound && r.god.divineCore.repeatableSignature && r.god.divineCore.receivingCapacity > 0;
  function motive(r) {
    const faith = r?.source?.faith;
    if (faith?.confirmation?.state !== 'activelyConfirmed' || faith.godId !== r?.god?.id) return null;
    const position = faith.topicPositions?.warfare;
    // An anti-heretic endorsement policy, alignment or personality is not a license to attack.
    if (!['defensiveWarAsDuty', 'defensiveOnly', 'pacifistExceptImmediateDefense'].includes(position)) return null;
    if (!faith.acceptableMethods?.some(m => m.tags?.includes('proportionality'))) return null;
    return { position, reason: 'Defend this faith’s actual representative against received evidence of immediate armed coercion; no claim of church sovereignty.' };
  }
  function create(r, binding, at) {
    if (!divine(r) || !motive(r) || !binding?.worldId || !binding.runId || !r.actor?.mapCell) return null;
    return { ...copy(binding), id: `${r.id}:terrestrial-protection`, religionId: r.id, godId: r.god.id,
      faithId: r.source.faith.id, branchId: r.source.branch.id, cityId: r.source.cityId, officeId: r.officeId,
      protectedId: r.actor.id, anchor: copy(r.actor.mapCell), roomId: r.actor.roomId,
      motive: motive(r), lastAt: at, nextNumber: 1, reports: [], job: null, authorizations: [],
      avatars: [], activeId: null, observed: null, message: '' };
  }
  function normalize(s) {
    if (!s?.worldId || !s.runId || !s.religionId || !s.protectedId || !s.anchor || !Number.isFinite(s.lastAt)
      || !Array.isArray(s.reports) || !Array.isArray(s.authorizations) || !Array.isArray(s.avatars)
      || s.avatars.some(a => a.actorKind !== 'divineAvatar' || !a.id || !Number.isFinite(a.health) || !Number.isFinite(a.expiresAt))) return null;
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return s && s.worldId === from.worldId && s.runId === from.runId ? { ...s, ...copy(to) } : null; }
  const actor = s => s?.avatars.find(a => a.id === s.activeId) || null;
  const present = a => a?.status === 'alive' && a.manifested === true;
  const capable = (s, c) => present(actor(s)) && actor(s).health > 12 && !c.avatarIncapacitated && !c.avatarSuppressed;
  function bound(s, r, office, c) {
    return Boolean(s && r && c.sourceCurrent && c.branchAvailable && divine(r) && motive(r)
      && s.religionId === r.id && s.godId === r.god.id && s.faithId === r.source.faith.id
      && s.branchId === r.source.branch.id && s.cityId === r.source.cityId
      && s.protectedId === r.actor.id && office?.id === s.officeId && r.officeId === s.officeId
      && office.clerk?.id === r.clerkId);
  }
  function observe(s, r, event, c, at) {
    if (!s || !c.alive || !c.expansionActive || !c.sourceCurrent
      || event.actorId !== 'scientist' || !event.id || !event.actionId
      || ![s.protectedId, actor(s)?.id].includes(event.targetId)
      || s.reports.some(e => e.id === event.id)) return false;
    const current = actor(s);
    if (!c.representativeWitness) {
      if (event.targetId !== current?.id || !present(current) || !c.avatarWitness) return false;
      current.truce = null; current.pending = null; current.hostile = true;
      current.renewedAggressionAt = at;
      s.message = 'The avatar personally perceived renewed aggression. Its local nonaggression ended; no unobserved representative report or renewed allocation was invented.';
      return true;
    }
    const report = { id: event.id, at, actorId: 'scientist', actionId: event.actionId, targetId: event.targetId,
      witnessId: r.actor.id, cityId: s.cityId, cell: copy(c.cell), receivedAt: null };
    s.reports.push(report);
    const a = actor(s);
    if (present(a)) { a.truce = null; a.pending = null; a.hostile = true; if (c.avatarWitness) a.renewedAggressionAt = at; }
    s.message = 'The original faithful representative witnessed aggression. The god has not received this untransmitted report.';
    return true;
  }
  function channel(s, r, office, c, own = null) {
    return bound(s, r, office, c) && c.representativeAtChannel && c.representativeAble && c.clerkAtChannel
      && office.active && office.channelPowered && office.maintenanceReady !== false && c.channelAvailable
      && r.actor.status === 'alive' && office.clerk.status === 'alive' && office.clerk.health >= 50 && (office.clerk.fatigue || 0) < 80
      && ![office.assignment, office.clerk.assignment, r.actor.assignment, r.job?.id].some(id => id && id !== own);
  }
  function release(s, r, office) {
    const id = s.job?.id;
    if (id) for (const a of [office, office?.clerk, r?.actor]) if (a?.assignment === id) a.assignment = null;
    s.job = null;
  }
  function beginReport(s, r, office, c, at) {
    const e = s.reports.find(e => e.receivedAt == null && !e.allocated && e.resolvedByNonaggressionAt == null);
    const cost = Math.max(1, r.god.expenditures?.communication || 0);
    if (!e || s.job || present(actor(s)) || !channel(s, r, office, c) || at < r.channelAvailableAt || at < (office.availableAt || 0)
      || office.power < 1 || office.workSeconds < REPORT_SECONDS || r.actor.workSeconds < REPORT_SECONDS
      || r.attentionSeconds < 60 || r.god.power.reserve < cost) return false;
    const id = `${s.id}:report:${s.nextNumber++}`;
    e.allocated = id; office.power--; r.god.power.reserve -= cost; r.attentionSeconds -= 60;
    r.channelAvailableAt = at + REPORT_SECONDS;
    s.job = { id, reportId: e.id, progress: 0, wasReady: true, startedAt: at };
    office.assignment = office.clerk.assignment = r.actor.assignment = id;
    return true;
  }
  function authorize(s, r, e, at) {
    const cost = Math.max(1, r.god.expenditures?.avatars || 0) + Math.max(1, r.god.expenditures?.protection || 0);
    const supported = divine(r) && motive(r) && r.attentionSeconds >= ATTENTION && r.god.power.reserve >= cost;
    const payload = { id: `${s.id}:response:${s.nextNumber++}`, at, reportId: e.id, godId: s.godId, faithId: s.faithId,
      protectedId: s.protectedId, outcome: supported ? 'boundedProtection' : 'capacityUnavailable',
      motive: copy(s.motive), terms: TERMS, expiresAt: at + DURATION };
    if (supported) { r.god.power.reserve -= cost; r.attentionSeconds -= ATTENTION; }
    s.authorizations.push({ payload, seal: World.stableHash(`${r.god.divineCore.repeatableSignature}:${World.stableHash(payload)}`),
      allocatedPower: supported ? cost : 0, manifested: false });
    s.message = supported ? 'An authenticated finite protecting manifestation was authorized; actual clear receiving ground is still required.'
      : 'The god received this report but lacks the available finite allocation for a protecting manifestation.';
  }
  function manifest(s, r, office, c, at, effects) {
    const auth = s.authorizations.find(a => !a.manifested && a.payload.outcome === 'boundedProtection' && at < a.payload.expiresAt
      && a.payload.godId === s.godId && a.payload.faithId === s.faithId && a.payload.protectedId === s.protectedId
      && s.reports.some(e => e.id === a.payload.reportId && e.receivedAt === a.payload.at)
      && a.seal === World.stableHash(`${r.god.divineCore.repeatableSignature}:${World.stableHash(a.payload)}`));
    if (!auth || present(actor(s)) || !bound(s, r, office, c) || r.actor.status !== 'alive') return false;
    const a = { id: `${auth.payload.id}:avatar`, name: `${r.source.godName} — protecting avatar`, role: 'Bounded divine manifestation',
      actorKind: 'divineAvatar', godId: s.godId, authorizationId: auth.payload.id, status: 'alive', manifested: true,
      health: 120, maxHealth: 120, fatigue: 0, stamina: 40, wardMana: 60, expiresAt: auth.payload.expiresAt,
      roomId: s.roomId, mapCell: null, physicalControl: { strength: 45, stamina: 40, staminaCapacity: 40 },
      skills: { striking: 12, guarding: 12, evasion: 8, perception: 12 }, hostile: true, truce: null,
      nextMoveAt: at + 1, nextAttackAt: at + 2, pending: null };
    const cell = effects.receivingCell?.(a, s.anchor); if (!cell) return false;
    a.mapCell = copy(cell); auth.manifested = true; s.avatars.push(a); s.activeId = a.id;
    s.message = 'A protecting avatar physically manifested. It guards the named representative, not the whole city. Withdrawal and a local nonaggression arrangement remain possible.';
    return true;
  }
  function advance(s, r, office, context, at, effects = {}) {
    if (!s || !Number.isFinite(at) || at < s.lastAt) return false;
    let c = context(); if (!c.alive) return false;
    const start = s.lastAt; s.lastAt = at;
    const a = actor(s);
    if (a?.manifested && (at >= a.expiresAt || !bound(s, r, office, c) || r.actor.status !== 'alive')) {
      a.manifested = false; a.endedAt = at; a.endReason = at >= a.expiresAt ? 'allocationExpired' : 'channelSourceLost'; a.pending = null;
      s.message = 'The original protecting manifestation ended. This alone establishes neither divine death nor permanent deterrence.';
    }
    if (s.job) {
      if (!c.representativeAble || r.actor.status !== 'alive' || !c.sourceCurrent) {
        const e = s.reports.find(e => e.id === s.job.reportId); e.interruptedAt = at; release(s, r, office);
      } else {
        const ready = channel(s, r, office, c, s.job.id);
        const dt = ready && s.job.wasReady ? Math.min(at - start, REPORT_SECONDS - s.job.progress,
          office.workSeconds, r.actor.workSeconds) : 0;
        s.job.wasReady = ready; s.job.progress += dt; office.workSeconds -= dt; r.actor.workSeconds -= dt;
        if (s.job.progress >= REPORT_SECONDS) {
          const e = s.reports.find(e => e.id === s.job.reportId); e.receivedAt = at;
          release(s, r, office); authorize(s, r, e, at);
        }
      }
    }
    c = context(); manifest(s, r, office, c, at, effects);
    const current = actor(s);
    if (present(current) && current.status === 'alive') {
      if (capable(s, c) && current.hostile && c.sameGround && c.tracksScientist && c.scientistNearAnchor) {
        if (current.pending && at >= current.pending.releaseAt) {
          current.pending = null;
          if (c.distanceM <= 1 && c.lineOfEffect && current.stamina >= 6) {
            current.stamina -= 6; effects.strike?.(current);
          }
          current.nextAttackAt = at + 4;
        } else if (!current.pending && at >= current.nextAttackAt && c.distanceM <= 1 && c.lineOfEffect && current.stamina >= 6) {
          current.pending = { releaseAt: at + 2, targetCell: copy(c.cell) }; effects.telegraph?.(current);
        }
        if (!current.pending && c.distanceM > 1 && at >= current.nextMoveAt && current.stamina >= 1) {
          if (effects.approach?.(current, c.cell, s.anchor)) current.stamina--;
          current.nextMoveAt = at + Math.max(1, c.moveSeconds || 1);
        }
      } else {
        current.pending = null;
        if (capable(s, c) && c.avatarAway && current.stamina > 0 && at >= current.nextMoveAt) {
          if (effects.returnToPost?.(current, s.anchor)) current.stamina--;
          current.nextMoveAt = at + Math.max(1, c.moveSeconds || 1);
        }
      }
    }
    if (c.alive && !present(actor(s))) beginReport(s, r, office, c, at);
    return at > start;
  }
  function absorb(s, c, targetId, damage, types) {
    const a = actor(s);
    if (!capable(s, c) || ![s.protectedId, a.id].includes(targetId) || !c.protectsRepresentative
      || !types.some(t => ['physical', 'force'].includes(t))) return damage;
    const absorbed = Math.min(12, damage, a.wardMana); a.wardMana -= absorbed;
    return damage - absorbed;
  }
  function agree(s, c, expected, at) {
    const a = actor(s);
    if (!capable(s, c) || !c.alive || !c.capable || !c.sameGround || !c.canHear || !c.free
      || expected !== TERMS || a.truce || at >= a.expiresAt) return false;
    a.truce = { at, protectedId: s.protectedId, terms: TERMS }; a.hostile = false; a.pending = null;
    // The god speaks through this actual manifestation. A settled witnessed
    // incident cannot later be recycled into a fresh intervention on expiry.
    for (const e of s.reports) if (e.receivedAt == null && !e.allocated && e.at <= at) e.resolvedByNonaggressionAt = at;
    s.message = 'Local nonaggression agreed. No conversion or divine sovereignty; original civic agreements remain independent.'; return true;
  }
  function publicView(s) { return copy(s?.observed || null); }
  function receive(s, r, c, at) {
    if (!s || !c.alive || !(c.avatarVisible || c.receiveAtCounter)) return false;
    const a = actor(s);
    s.observed = { at, godName: r.source.godName, protectedName: r.actor.name, motive: copy(s.motive),
      response: s.authorizations.length ? { at: s.authorizations.at(-1).payload.at, outcome: s.authorizations.at(-1).payload.outcome } : null,
      avatar: c.avatarVisible ? { id: a.id, name: a.name, cell: copy(a.mapCell),
        condition: a.status === 'dead' ? 'manifestation defeated; god unverified' : a.manifested ? 'physically present' : 'manifestation ended; god unverified',
        truce: copy(a.truce) } : null,
      receivedReports: c.receiveAtCounter ? s.reports.filter(e => e.receivedAt != null).map(e => ({ at: e.at, receivedAt: e.receivedAt, actionId: e.actionId })) : [],
      terms: TERMS, message: s.message, limitations: LIMITS };
    return true;
  }
  return { REPORT_SECONDS, DURATION, ATTENTION, TERMS, LIMITS, divine, motive, create, normalize, rebind,
    actor, present, capable, bound, observe, advance, absorb, agree, receive, publicView };
});
