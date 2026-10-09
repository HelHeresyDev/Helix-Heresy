(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixSoulBeacons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme) {
  'use strict';
  const HOUR = 3600, STEP = 60, GROWTH = 7 * 24 * HOUR, CARE = 12 * HOUR, CHARGE = 6 * HOUR;
  const INPUTS = Object.freeze({ biomass: 80, growthMedium: 24, geneticMaterial: 10, humanTissueTemplate: 1 });
  const copy = v => JSON.parse(JSON.stringify(v));
  const fail = reason => ({ ok: false, reason });
  const registry = Theme.createRegistry([{ id: 'resurrection.shared.imperfect-soul-beacon', kind: 'resurrection', compatibility: 'shared', contentTags: ['science', 'magic'], fallback: true, template: 'Imperfect soul-beacon reconstruction' }]);
  function create(now = 0, options = {}) {
    const selected = Theme.selectContent(registry, { kind: 'resurrection', worldTheme: options.theme || 'madcap', seed: options.seed || 'soul-beacon', required: true });
    if (!selected.ok) throw new Error('No compatible soul-beacon definition.');
    return { soul: { id: 'scientist-soul', integrity: 100, injuries: [] }, lastAt: now, nextNumber: 1,
      definitionId: selected.definitionId, sourceTheme: selected.sourceTheme,
      apparatusExamined: false, inspections: {}, observations: {}, receivers: [], beacons: [], handoff: null, transfers: [] };
  }
  function normalize(s, now = 0) { return s?.soul && Array.isArray(s.receivers) && Array.isArray(s.beacons) ? copy(s) : create(now); }
  function qualifications(c) {
    return c.dead ? 'Bodily work is impossible after death.' : !c.local ? 'Attend the actual laboratory work position.'
      : c.animancy < 151 || c.medicine < 151 || c.alchemy < 151 || c.fabrication < 101
        ? 'Master Animancy, Medicine and Alchemy (151) and Adept Fabrication (101) are required.'
        : c.suppressed ? 'Magic suppression prevents animantic work.' : '';
  }
  function perfectedQualifications(c) {
    const reason = qualifications({ ...c, medicine: c.medicineKnowledge ?? c.medicine, alchemy: c.alchemyKnowledge ?? c.alchemy, fabrication: c.fabricationKnowledge ?? c.fabrication });
    return reason || (c.animancy < 201 || (c.medicineKnowledge ?? c.medicine) < 201 || (c.alchemyKnowledge ?? c.alchemy) < 201 || (c.fabricationKnowledge ?? c.fabrication) < 151
      ? 'Heroic Animancy, Medicine and Alchemy (201) and Master Fabrication (151) knowledge are required.' : '');
  }
  function preparationReason(s, b, r, c) {
    return !b || b.status !== 'charged' || b.charge < 24 || b.chamberId !== r?.chamberId ? 'Use the actual fully charged beacon and its paired receiver.'
      : !r || r.status !== 'ready' || r.health < 90 || r.soulId || r.soulFormationPrevented !== true || r.donorSoulId !== s.soul.id
        ? 'A compatible ready soul-free receiver in at least 90 health is required.'
        : !c.siteIntact || !c.siteControlled || !c.space || !c.paired || !c.services || c.condition < 90 || !c.upkeep
          ? 'Perfected preparation needs the actual controlled paired site, upkeep, exit and full utilities, with both fixtures in at least 90% condition.' : '';
  }
  function preparePerfected(s, beaconId, receiverId, c, now) {
    const b = s.beacons.find(b => b.id === beaconId), r = s.receivers.find(r => r.id === receiverId);
    const reason = perfectedQualifications(c) || (!c.perfectedResearch ? 'Complete both advanced continuity projects first.' : '')
      || (b?.armed ? 'Disarm this contingency before modifying it.' : '') || preparationReason(s, b, r, c);
    if (reason) return fail(reason);
    b.preparation = { receiverId, chamberId: r.chamberId, fixtureId: b.fixtureId, preparedAt: now, validatedAt: null };
    b.memoryTier = 'imperfect'; return { ok: true };
  }
  function validatePerfected(s, beaconId, c, now) {
    const b = s.beacons.find(b => b.id === beaconId), p = b?.preparation, r = s.receivers.find(r => r.id === p?.receiverId);
    const reason = perfectedQualifications(c) || (!c.perfectedResearch ? 'Complete both advanced continuity projects first.' : '')
      || (!p || p.fixtureId !== b.fixtureId || p.chamberId !== b.chamberId ? 'Physically prepare this actual pairing first.' : '')
      || (b?.armed ? 'Disarm before direct validation.' : '') || preparationReason(s, b, r, c);
    if (reason) return fail(reason);
    p.validatedAt = now; b.memoryTier = 'perfected'; return { ok: true, receiver: r };
  }
  function damageSoul(s, amount, cause, now, sourceId) {
    if (!sourceId || !cause || !(amount > 0) || s.soul.injuries.some(i => i.sourceId === sourceId)) return false;
    const damage = Math.min(s.soul.integrity, amount);
    s.soul.integrity = Math.max(0, s.soul.integrity - damage);
    s.soul.injuries.push({ sourceId, cause, damage, at: now }); return true;
  }
  const occupied = (s, id) => s.receivers.some(r => r.chamberId === id && !r.cleared);
  function begin(s, chamberId, c, now, load) {
    const reason = qualifications(c);
    if (reason) return fail(reason);
    if (!c.research || !c.inspected || c.condition < 80 || !c.services || occupied(s, chamberId))
      return fail('Completed receiving-body research, recent inspection, an empty dedicated chamber in 80% condition and full physical services are required.');
    if (c.template?.family !== 'human' || !c.template.examined || c.template.donorId !== 'scientist' || c.quality < 75)
      return fail('An examined self-donated template and uncontaminated compatible medium of at least 75 quality are required.');
    const id = `receiver-${s.nextNumber}`, stocks = load(id, INPUTS);
    if (!stocks) return fail('The exact staged original lots are unavailable.');
    const r = { id, chamberId, donorSoulId: s.soul.id, template: copy(c.template), location: copy(c.location), stocks: copy(stocks),
      consumed: {}, status: 'growing', progressSeconds: 0, health: 100, careAt: now, startedAt: now, buffer: 20 * 60,
      soulFormationPrevented: true, soulId: null, supportStocks: [], supportConsumed: 0, supportSeconds: 0, reason: '', cleared: false };
    s.nextNumber++; s.receivers.push(r); return { ok: true, receiver: r };
  }
  function advance(s, now, hooks) {
    if (hooks.dead || s.handoff?.status === 'pending') return 0;
    let changed = 0;
    while (s.lastAt + STEP <= now) {
      s.lastAt += STEP; const at = s.lastAt;
      for (const r of s.receivers.filter(r => ['growing', 'ready'].includes(r.status))) {
        if (at <= r.startedAt) continue;
        const growing = r.status === 'growing', support = hooks.support(r, STEP), late = growing && at - r.careAt > CARE;
        let ok = support.ok && !late;
        if (ok && growing) {
          const next = Math.min(GROWTH, r.progressSeconds + STEP);
          const amounts = Object.fromEntries(Object.entries(INPUTS).map(([key, total]) => [key,
            Math.max(0, (key === 'humanTissueTemplate' ? 1 : Math.floor(total * next / GROWTH + 1e-8)) - (r.consumed[key] || 0))]));
          ok = hooks.consume(r, amounts);
          if (ok) {
            for (const [key, amount] of Object.entries(amounts)) r.consumed[key] = (r.consumed[key] || 0) + amount;
            r.progressSeconds = next;
            if (next === GROWTH) { r.status = 'ready'; r.readyAt = at; }
          }
        } else if (ok) {
          // Maintenance medium is independently loaded; incorporated growth inputs never regenerate.
          // Physical packets are integral stocks. Prepay one genuine packet for
          // a day's support, then save and consume its finite duration.
          r.supportSeconds = Math.max(0, r.supportSeconds || 0);
          if (r.supportSeconds < STEP) {
            ok = hooks.upkeep(r, 1);
            if (ok) { r.supportSeconds += 24 * HOUR; r.supportConsumed++; }
          }
          if (ok) r.supportSeconds -= STEP;
        }
        r.reason = ok ? '' : late ? 'Twelve-hour growth examination and corrective care are overdue.'
          : support.reason || 'An original growth lot or finite maintenance medium is unavailable.';
        if (!ok) {
          const buffered = late || support.destroyed ? 0 : Math.min(r.buffer, STEP); r.buffer -= buffered;
          r.health = Math.max(0, r.health - (STEP - buffered) / HOUR * (support.destroyed ? 100 : 12));
          if (!r.health) { r.status = 'failed'; r.failedAt = at; hooks.release(r); }
        }
        changed++;
      }
      for (const b of s.beacons.filter(b => b.status === 'charging')) {
        if (at <= b.startedAt) continue;
        const support = hooks.chargeSupport(b, STEP);
        b.reason = support.ok ? '' : support.reason || 'Actual electricity or mana cannot sustain charging.';
        if (!support.ok) continue;
        b.progressSeconds = Math.min(CHARGE, b.progressSeconds + STEP);
        b.charge = 24 * b.progressSeconds / CHARGE;
        if (b.progressSeconds === CHARGE) { b.status = 'charged'; b.chargedAt = at; }
        changed++;
      }
      if (hooks.work) changed += hooks.work(at, STEP) || 0;
    }
    return changed;
  }
  function care(s, id, now) {
    const r = s.receivers.find(r => r.id === id);
    if (!r || r.status !== 'growing') return fail('No growing receiver needs this care.');
    r.careAt = now; return { ok: true }; // No healing, deadline reset through inspection alone, or replenished buffer.
  }
  function loadSupport(s, id, stocks) {
    const r = s.receivers.find(r => r.id === id);
    if (!r || !['growing', 'ready'].includes(r.status) || !stocks?.length) return fail('No viable receiver can accept original maintenance lots.');
    r.supportStocks.push(...copy(stocks)); return { ok: true };
  }
  function charge(s, fixtureId, chamberId, c, now) {
    const reason = qualifications(c); if (reason) return fail(reason);
    if (!c.beaconResearch || !c.services || c.condition < 80 || !c.paired) return fail('A functioning researched beacon, compatible nearby receiving chamber and physical utilities are required.');
    let b = s.beacons.find(b => b.fixtureId === fixtureId);
    if (b && b.status !== 'spent') return fail('This apparatus already holds a charging cycle or charge.');
    if (!b) { b = { id: `soul-beacon:${fixtureId}`, fixtureId }; s.beacons.push(b); }
    Object.assign(b, { chamberId, status: 'charging', armed: false, receiverId: '', charge: 0,
      progressSeconds: 0, startedAt: now, reason: '', siteId: c.siteId, location: copy(c.location), label: c.label,
      memoryTier: 'imperfect', preparation: null });
    return { ok: true, beacon: b };
  }
  function eligibility(s, b, c) {
    const r = b && s.receivers.find(r => r.id === b.receiverId);
    return s.soul.integrity < 75 ? (s.soul.integrity <= 0 ? 'The soul is destroyed.' : 'Soul integrity is below this apparatus’s 75 threshold.')
      : !b?.armed || b.status !== 'charged' || b.charge < 24 ? 'No armed, fully charged beacon.'
        : !r || r.status !== 'ready' || r.health < 75 || r.soulId || r.soulFormationPrevented !== true || r.donorSoulId !== s.soul.id
          ? 'No healthy compatible soul-free receiver.'
          : !c?.siteIntact || !c.siteControlled || !c.space || !c.paired || !c.services || c.condition < 80
            ? 'The actual receiving site, equipment, utilities or exit position is unavailable.'
            : !c.upkeep ? 'The prepared receiver lacks actual remaining maintenance medium.'
              : b.memoryTier === 'perfected' && (!b.preparation || b.preparation.validatedAt == null || b.preparation.receiverId !== r.id
                || b.preparation.fixtureId !== b.fixtureId || b.preparation.chamberId !== b.chamberId || c.condition < 90 || r.health < 90)
                ? 'The exact validated perfected pairing or its 90% receiving conditions are unavailable; no silent imperfect fallback.' : '';
  }
  function arm(s, beaconId, receiverId, c, now) {
    const reason = qualifications(c); if (reason) return fail(reason);
    const b = s.beacons.find(b => b.id === beaconId), r = s.receivers.find(r => r.id === receiverId);
    if (!c.integration || !b || !r || b.chamberId !== r.chamberId) return fail('Completed transfer-integration research and this apparatus’s actual receiver are required.');
    const probe = { ...b, armed: true, receiverId };
    const unavailable = eligibility(s, probe, c); if (unavailable) return fail(unavailable);
    b.armed = true; b.receiverId = receiverId; b.armedAt = now; return { ok: true };
  }
  function examine(s, id, now) {
    const r = s.receivers.find(r => r.id === id), b = s.beacons.find(b => b.id === id);
    const view = r ? { id, at: now, kind: 'receiver', status: r.status, progress: r.progressSeconds / GROWTH,
      health: r.health >= 75 ? 'compatible condition' : 'severe developmental injury', reason: r.reason, soulId: r.soulId,
      soulFormationPrevented: r.soulFormationPrevented } : b ? { id, at: now, kind: 'beacon', status: b.status, armed: b.armed,
        progress: b.progressSeconds / CHARGE, reason: b.reason, memoryTier: b.memoryTier || 'imperfect',
        preparedAt: b.preparation?.preparedAt ?? null, validatedAt: b.preparation?.validatedAt ?? null } : null;
    if (view) s.observations[id] = view; return view;
  }
  function choices(s, contexts) {
    return s.beacons.filter(b => !eligibility(s, b, contexts(b))).map(b => ({ id: b.id, label: b.label,
      siteId: b.siteId, roomId: b.location.roomId, receiverId: b.receiverId,
      memoryTier: b.memoryTier || 'imperfect', receivingConditions: b.memoryTier === 'perfected'
        ? 'Validated maintained neural receiver; charged apparatus and working local utilities. Personal memory and knowledge retained; bodily competence requires retraining.'
        : 'Compatible maintained receiver; intact charged apparatus and working local utilities. Imperfect memory transfer: personal memory and practiced expertise lost.' }));
  }
  function prepareHandoff(s, deathId, now, contexts) {
    const available = choices(s, contexts);
    s.handoff = { deathId, status: available.length ? 'pending' : 'unavailable', at: now, choices: available, selectedId: '' };
    return available;
  }
  function select(s, deathId, id) {
    if (s.handoff?.status !== 'pending' || s.handoff.deathId !== deathId || !s.handoff.choices.some(c => c.id === id)) return fail('No saved eligible destination matches this death.');
    s.handoff.selectedId = id; return { ok: true };
  }
  function recover(s, deathId, now, contexts) {
    const h = s.handoff;
    if (h?.status !== 'pending' || h.deathId !== deathId || !h.selectedId || !h.choices.some(c => c.id === h.selectedId)) return fail('Select a saved destination for this death before confirming.');
    const b = s.beacons.find(b => b.id === h.selectedId), reason = eligibility(s, b, contexts(b));
    if (reason) { h.choices = choices(s, contexts); h.selectedId = ''; if (!h.choices.length) h.status = 'unavailable'; return fail(reason); }
    const r = s.receivers.find(r => r.id === b.receiverId);
    const receipt = { deathId, beaconId: b.id, bodyId: r.id, soulId: s.soul.id, soulIntegrity: s.soul.integrity,
      at: now, location: copy(contexts(b).destination), health: r.health, memoryTier: b.memoryTier || 'imperfect' };
    r.status = 'embodied'; r.embodiedAt = now; r.soulId = s.soul.id;
    b.status = 'spent'; b.charge = 0; b.armed = false;
    h.status = 'recovered'; h.recoveredAt = now; s.transfers.push(receipt);
    return { ok: true, receipt };
  }
  return { GROWTH, CARE, CHARGE, INPUTS, create, normalize, qualifications, perfectedQualifications, preparationReason, preparePerfected, validatePerfected, damageSoul, occupied,
    begin, advance, care, loadSupport, charge, eligibility, arm, examine, choices, prepareHandoff, select, recover };
});
