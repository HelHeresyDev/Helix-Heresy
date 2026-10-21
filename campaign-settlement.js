(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCampaignSettlement = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const DAY = 86400, DEMAND = 250, RESERVE = 1000;
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80 && a.present !== false;
  const SCOPE = 'One finite payment for vacating this original receiving frontage and no renewed obstruction or attacks there for 24 hours. Half on acceptance, half after witnessed twenty-metre withdrawal and restored access. No annexation, ongoing tribute, city admission, map, immunity, divine endorsement or domination. Existing earned property and commercial obligations remain separate. Unwithdrawn conditional funds revert on breach or expiry; already earned payment remains owed.';
  function create(o, g, at) {
    const b = g?.foreignCivic?.bargain;
    if (!o?.runId || !o.worldId || !b?.source?.authority?.id || !g.clerk?.id || !b.representative?.id || !b.representative.mapCell
      || !o.layout?.receiving || !o.layout.entry || !Number.isFinite(o.layout.linkMeters) || o.layout.linkMeters <= 0
      || o.source?.cityId !== b.source.cityId || o.source.charterId !== b.source.charterId || o.depotId !== b.depot?.id) return null;
    return { id: `${o.id}:withdrawal-settlement`, worldId: o.worldId, runId: o.runId, source: copy(b.source),
      representativeId: b.representative.id, clerkId: g.clerk.id, depotId: b.depot.id,
      home: { roomId: b.representative.roomId, cell: copy(b.representative.mapCell) },
      meeting: { ...o.layout.receiving, x: o.layout.receiving.x - 1, y: o.layout.receiving.y - 1 },
      watching: { ...o.layout.entry, x: o.layout.entry.x + 1 }, witnessTravel: null, witnessAtStaging: false, nextMoveAt: at + 1,
      phase: 'idle', job: null, returnPending: false, offer: null, mandate: null, terms: null,
      heldFunds: 0, paid: 0, history: [], report: null, serial: 0, lastAt: at, lastAggressionAt: null };
  }
  function normalize(s) {
    return s?.source?.authority?.id && s.source.charterId && s.runId && s.worldId && s.representativeId && s.clerkId
      && Number.isFinite(s.lastAt) && Number.isFinite(s.heldFunds) && s.heldFunds >= 0 && s.heldFunds <= DEMAND
      && Number.isFinite(s.paid) && s.paid >= 0 && s.paid <= DEMAND && Array.isArray(s.history) ? copy(s) : null;
  }
  function rebind(value, from, to) {
    const s = normalize(value);
    return s && s.worldId === from?.worldId && s.runId === from?.runId && to?.worldId && to.runId ? { ...s, ...copy(to) } : null;
  }
  function current(s, o, g, c) {
    const b = g?.foreignCivic?.bargain, source = c.civicSource;
    return Boolean(s && o && c.authorityCurrent && c.worldId === s.worldId && c.runId === s.runId && o.worldId === s.worldId && o.runId === s.runId
      && o.source.cityId === s.source.cityId && o.source.charterId === s.source.charterId && o.depotId === s.depotId
      && source?.authority?.id === s.source.authority.id && b?.source.authority.id === s.source.authority.id
      && ['cityId', 'charterId', 'administrationId', 'defenseId', 'populationSourceId'].every(k => source[k] === s.source[k])
      && b.representative.id === s.representativeId && g.clerk.id === s.clerkId && b.depot.id === s.depotId);
  }
  function note(s, at, kind, text) { s.history.push({ id: `${s.id}:record:${++s.serial}`, at, kind, text }); }
  const truce = (s, at) => Boolean(s?.terms && s.phase === 'active' && at < s.terms.endsAt);
  function channels(s, g, c) {
    const a = g.foreignCivic.bargain.representative;
    return able(a) && able(g.clerk) && !c.representativeIncapacitated && c.channel && g.powerSeconds >= 1
      && g.receptionWorkSeconds >= 1 && a.workSeconds >= 1 && !c.conflictingWork
      && (!a.assignment || a.assignment === s.id) && (!g.receptionAssignment || g.receptionAssignment === s.id);
  }
  function reason(s, o, g, market, c) {
    if (!current(s, o, g, c) || market?.id !== s.source.cityId) return 'The original current sovereign authority, population-backed representative and city treasury are required.';
    if (!c.alive || !c.capable || !c.free || !c.local || c.busy || !c.held || !c.atBoth || !c.clearAccess)
      return 'Maintain actual clear control of both original receiving/service points, alive, free and without other work.';
    if (!c.need) return 'No actual unfilled maintenance need or original freight is obstructed; an unused marker supplies no leverage.';
    if (c.canRestore || c.unsafe) return 'Actual remaining resistance can contest access or makes this parley unsafe; no surrender is inferred.';
    if (!channels(s, g, c)) return 'Original representative, clerk, finite duty, local communication or powered civic channel is unavailable.';
    if (!Number.isFinite(market.treasury) || market.treasury < RESERVE + 2) return 'The treasury cannot spare a payment while protecting its operating reserve and prior funded obligations.';
    return '';
  }
  function release(s, g) {
    if (g.receptionAssignment === s.id) g.receptionAssignment = null;
    s.job = null; s.returnPending = g.foreignCivic.bargain.representative.assignment === s.id;
  }
  function request(s, o, g, market, c, at) {
    if (!s || s.terms || s.job || s.returnPending || reason(s, o, g, market, c)) return false;
    const fingerprint = JSON.stringify([c.need, c.canRestore, market.treasury, c.bodyEpoch, s.lastAggressionAt]);
    if (s.phase === 'refused' && s.attempt === fingerprint) return false;
    s.attempt = fingerprint; s.offer = null; s.mandate = null; s.phase = 'requesting';
    s.job = { kind: 'negotiate', progress: 0, seconds: 120, bodyEpoch: c.bodyEpoch, startedAt: at };
    g.foreignCivic.bargain.representative.assignment = s.id; g.receptionAssignment = s.id;
    note(s, at, 'demand', 'Requested $250 for one local withdrawal agreement; original representative must physically attend and obtain a specific sovereign mandate.'); return true;
  }
  function accept(s, o, g, market, c, expected, at) {
    if (!s?.offer || s.job || s.terms || s.returnPending || at >= s.offer.expiresAt || s.offer.bodyEpoch !== c.bodyEpoch
      || JSON.stringify(expected) !== JSON.stringify(s.offer) || reason(s, o, g, market, c)
      || !c.meeting || !c.attendance || Math.floor((market.treasury - RESERVE) / 2) * 2 < s.offer.amount) return false;
    s.job = { kind: 'accept', progress: 0, seconds: 60, bodyEpoch: c.bodyEpoch, startedAt: at, quote: copy(s.offer) };
    s.phase = 'accepting'; g.receptionAssignment = s.id; g.foreignCivic.bargain.representative.assignment = s.id; return true;
  }
  function cancel(s, g, at) {
    if (!s?.job && s?.phase !== 'offered') return false;
    release(s, g); s.phase = 'interrupted'; note(s, at, 'interrupted', 'Unsigned parley ended; spent work remains spent and no money or rights transfer.'); return true;
  }
  function refundConditional(s, market) {
    if (market?.id !== s.source.cityId || !Number.isFinite(market.treasury) || s.terms?.withdrawnAt != null) return;
    market.treasury += s.heldFunds; s.heldFunds = 0;
  }
  function aggression(s, g, market, at) {
    if (!s) return;
    s.lastAggressionAt = at;
    if (s.job || s.phase === 'offered') cancel(s, g, at);
    if (!truce(s, at)) return;
    s.phase = 'breached'; s.terms.breachedAt = at; refundConditional(s, market); release(s, g);
    note(s, at, 'breach', 'Renewed actual attack or receiving obstruction breached the local promise. Paid money is not recovered; earned unpaid money remains owed. No troops, guilt or arrest are generated.');
  }
  function bodyEnded(s, g, market, at) {
    if (!s) return;
    if (s.job || s.phase === 'offered') cancel(s, g, at);
    if (s.phase === 'active' && s.terms.withdrawnAt == null) {
      s.phase = 'unperformed'; refundConditional(s, market); release(s, g);
      note(s, at, 'bodyLost', 'The contracted body was lost without witnessed withdrawal. No inherited journey, accusation or second payment.');
    }
  }
  function observe(s, c, at) {
    if (!s || !c.alive || !c.reportContact) return false;
    s.report = { at, phase: s.phase, offer: s.offer && copy(s.offer), mandate: s.mandate && copy(s.mandate), terms: s.terms && copy(s.terms),
      paid: s.paid, balanceDue: s.terms?.withdrawnAt != null ? s.heldFunds : 0, history: copy(s.history), scope: SCOPE }; return true;
  }
  function advance(s, o, g, market, economy, to, context, hooks = {}) {
    if (!s || !Number.isFinite(to) || to <= s.lastAt || !context().alive || market?.id !== s.source.cityId) return false;
    while (s.lastAt < to && context().alive) {
      const passive = !s.job && !s.returnPending && !s.witnessTravel && s.terms?.withdrawnAt != null && s.heldFunds === 0;
      const dt = Math.min(passive ? Math.max(1, (s.terms?.endsAt || to) - s.lastAt) : 1, to - s.lastAt), now = s.lastAt + dt; s.lastAt = now;
      const c = context(), a = g.foreignCivic.bargain.representative;
      const move = goal => { if (now < s.nextMoveAt || a.workSeconds < 1) return false;
        s.nextMoveAt = now + 1; if (!hooks.move?.(a, goal)) return false; a.workSeconds--; return true; };
      const valid = current(s, o, g, c), ready = valid && channels(s, g, c);
      if (s.job) {
        const j = s.job, refusal = reason(s, o, g, market, c);
        if (refusal || j.bodyEpoch !== c.bodyEpoch || j.kind === 'accept' && (now >= j.quote.expiresAt || !c.meeting || !c.attendance)) {
          release(s, g); s.phase = 'interrupted'; note(s, now, 'interrupted', refusal || 'Original body, attendance or exact offer changed.');
        } else if (!c.meeting) {
          move(s.meeting);
        } else if (c.attendance) {
          const work = Math.min(dt, j.seconds - j.progress, a.workSeconds, g.receptionWorkSeconds, g.powerSeconds);
          a.workSeconds -= work; g.receptionWorkSeconds -= work; g.powerSeconds -= work; j.progress += work;
          if (j.progress >= j.seconds) {
            if (j.kind === 'negotiate') {
              const amount = Math.min(DEMAND, Math.floor((market.treasury - RESERVE) / 2) * 2);
              s.mandate = { id: `${s.id}:mandate:${++s.serial}`, at: now, authorityId: s.source.authority.id, charterId: s.source.charterId,
                representativeId: a.id, clerkId: g.clerk.id, scope: 'This one original-frontage payment and withdrawal only; not a transfer of sovereignty.' };
              s.offer = { id: `${s.id}:offer:${++s.serial}`, mandateId: s.mandate.id, authorityId: s.source.authority.id,
                bodyEpoch: c.bodyEpoch, amount, upfront: amount / 2, withdrawal: amount / 2, issuedAt: now, expiresAt: now + 3600,
                duration: DAY, meters: o.layout.linkMeters, depotId: s.depotId, scope: SCOPE };
              s.job = null; s.phase = 'offered';
              note(s, now, 'offer', `Specific sovereign mandate received: $${amount} for the stated limited withdrawal, not surrender. Remaining city defenses are not declared defeated.`);
            } else if (market.treasury >= RESERVE + j.quote.amount && Number.isFinite(economy.money)) {
              market.treasury -= j.quote.amount; s.heldFunds = j.quote.withdrawal; economy.money += j.quote.upfront; s.paid += j.quote.upfront;
              s.terms = { ...copy(j.quote), acceptedAt: now, endsAt: now + DAY, withdrawnAt: null };
              s.job = null; s.phase = 'active'; o.hostileUntil = now; o.pendingPulse = null;
              hooks.accepted?.(now);
              note(s, now, 'accepted', `Original treasury funded $${j.quote.amount}; $${j.quote.upfront} paid, remainder city-held for actual witnessed withdrawal. Access and institutions remain independent.`);
            } else { release(s, g); s.phase = 'refused'; note(s, now, 'refused', 'The original payment account cannot fund the unchanged offer. Nothing transferred.'); }
          }
        }
      }
      if (s.phase === 'offered' && (now >= s.offer.expiresAt || !valid || !c.held || !c.local || c.bodyEpoch !== s.offer.bodyEpoch || c.unsafe)) {
        release(s, g); s.phase = 'expired'; note(s, now, 'expiry', 'Unsigned offer expired or original leverage/attendance was lost.');
      }
      if (s.terms && s.phase === 'active') {
        if (c.bodyEpoch !== s.terms.bodyEpoch && s.terms.withdrawnAt == null) bodyEnded(s, g, market, now);
        if (s.phase === 'active' && now >= s.terms.endsAt) {
          s.phase = s.terms.withdrawnAt == null ? 'unperformed' : 'honored'; refundConditional(s, market); release(s, g);
          note(s, now, s.phase, s.phase === 'honored' ? 'The finite local non-obstruction window elapsed without a recorded breach; no permanent tribute or rule follows.' : 'No witnessed withdrawal completed during the finite window; unpaid conditional funds returned, upfront payment remains spent.');
        }
      }
      if (s.phase === 'active' && now > s.terms.acceptedAt && c.obstructed) aggression(s, g, market, now);
      if (s.phase === 'active' && s.terms.withdrawnAt == null && able(a) && !c.representativeIncapacitated && a.assignment === s.id && a.workSeconds > 0) {
        if (!s.witnessTravel && !s.witnessAtStaging) {
          if (!same(a.mapCell, s.watching)) move(s.watching);
          else if (c.departureObserved) s.witnessTravel = { returning: false, progress: 0, seconds: o.layout.linkMeters, bodyEpoch: c.bodyEpoch };
        }
      }
      if (s.witnessTravel && able(a) && !c.representativeIncapacitated && a.assignment === s.id && a.workSeconds > 0) {
        const t = s.witnessTravel, work = Math.min(dt, a.workSeconds, t.seconds - t.progress);
        t.progress += work; a.workSeconds -= work;
        if (t.progress >= t.seconds && hooks.crossLink?.(a, !t.returning)) {
          s.witnessAtStaging = !t.returning; s.witnessTravel = null;
        }
      }
      if (s.phase === 'active' && s.terms.withdrawnAt == null && valid && able(a) && !c.representativeIncapacitated
        && a.assignment === s.id && a.workSeconds >= 1 && c.withdrawalWitness && !c.obstructed && c.clearAccess && c.bodyEpoch === s.terms.bodyEpoch) {
        a.workSeconds--;
        s.terms.withdrawnAt = now; s.terms.withdrawalReceiptId = c.withdrawalReceiptId;
        note(s, now, 'withdrawal', 'Original representative physically followed the measured link and witnessed completed return to staging and restored receiving access. Conditional balance is earned; the witness must return to the powered original desk to process it.');
        release(s, g);
      }
      if (s.terms?.withdrawnAt != null && s.heldFunds > 0 && ready && Number.isFinite(economy.money)) {
        const balance = s.heldFunds; s.heldFunds = 0; s.paid += balance; economy.money += balance;
        s.terms.balancePaidAt = now;
        note(s, now, 'payment', `Released the original reserved $${balance}; one materially exercised limited coercive settlement, not durable supremacy.`);
        release(s, g);
      }
      if (s.returnPending && a.assignment === s.id && able(a) && !c.representativeIncapacitated && a.workSeconds > 0) {
        if (s.witnessAtStaging && !s.witnessTravel) s.witnessTravel = { returning: true, progress: 0, seconds: o.layout.linkMeters };
        else if (!s.witnessTravel && same(a.mapCell, s.home.cell)) { a.assignment = null; s.returnPending = false; }
        else if (!s.witnessTravel) move(s.home.cell);
      }
      observe(s, context(), now);
      // Once no physical/attended work remains, deadlines need no per-second loop.
      if (!s.job && !s.returnPending && !['offered', 'active'].includes(s.phase) && !s.heldFunds) s.lastAt = to;
    }
    return true;
  }
  return { DAY, DEMAND, RESERVE, SCOPE, able, create, normalize, rebind, current, truce, reason, request, accept, cancel, aggression, bodyEnded, observe, advance };
});
