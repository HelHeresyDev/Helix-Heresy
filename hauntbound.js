/* A deceased individual's lingering soul, not an artificial formation recipe. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HelixHauntbound = factory();
})(globalThis, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const SAFE = ['cloth', 'glass', 'metalParts', 'rubber', 'emptyVial', 'glassVial', 'emptyJar'];
  const DEFINITION = { name: 'Hauntbound', researchTier: null, productionTier: null, producible: false,
    origin: 'A deceased individual inhabits a personally significant object after missing reincarnation.',
    maxForceN: 20, bodyMassKg: .5, carryMassKg: 1, carryVolumeL: 3, contactMana: 1,
    enchantCapacity: 20, chargePerFeedstock: 8 };
  function create(at, location, objectId, letterId, identity = 'inherited-haunting') {
    return { initialized: true, lastAt: at, objectId, letterId, discovered: false, contact: false,
      evidenceRead: false, farewellHeard: false, agreement: false, withdrawn: false, observations: null,
      journal: [], orders: [], enchantment: { kind: 'protective-cushion', charge: 0, imprinted: 0, spent: 0, supplied: 0 },
      actor: { id: `${identity}:inhabitant`, actorKind: 'hauntbound', family: 'hauntbound',
        name: 'Unexamined cloth keepsake', present: true, status: 'bound', health: 100, maxHealth: 100,
        soul: { id: `${identity}:surviving-soul`, origin: 'natural-lingering-deceased', integrity: 100 },
        formerName: 'Mara', personality: 'Patient, meticulous, protective; dislikes waste and dangerous work.',
        obsession: 'Keep watch until someone tells me the people who left no longer need me to wait.',
        memories: 'A departure, a cloth doll held tightly, a promise to wait. No complete autobiography or former expertise.',
        forceN: DEFINITION.maxForceN, soulReserve: 100, bodyMassKg: DEFINITION.bodyMassKg,
        seamWear: 0, wetKg: 0, waterAbsorbedKg: 0, waterEvaporatedKg: 0, workSeconds: 0, experience: 0, independentIntent: '',
        mapCell: copy(location.cell), roomId: location.roomId, navigationFootprint: { width: 1, height: 1 },
        inventory: { maxMassKg: DEFINITION.carryMassKg, maxVolumeL: DEFINITION.carryVolumeL },
        injuries: [], repairs: [] } };
  }
  function communicationReason(s, context) {
    if (!s.discovered) return 'Examine the original keepsake first.';
    if (!context.local) return 'Meet the original inhabitant in person; no remote spirit telemetry.';
    if (context.dead || context.incapacitated) return 'The scientist cannot make contact.';
    if (context.suppressed) return 'Magic suppression prevents direct spirit communication.';
    if (!(context.animancy >= 1)) return 'Direct spirit communication requires Animancy [Initiate].';
    if (s.actor.soul.integrity <= 0) return 'The original soul was destroyed; repair cannot recreate it.';
    if (s.actor.status === 'departed') return 'The original soul has entered reincarnation.';
    return '';
  }
  function record(s, action, at, text) { s.journal.push({ action, at, text }); return { ok: true, text }; }
  function interact(s, action, context, at) {
    if (action === 'examine') {
      if (!context.local || context.dead || context.incapacitated) return { ok: false, reason: 'Physically approach the original keepsake.' };
      s.discovered = true;
      return record(s, action, at, 'The doll shifts without a mechanism. An old folded personal letter lies beside it; this is an existing haunting, not a new creation.');
    }
    if (action === 'letter') {
      if (!s.discovered || !context.letterLocal || context.dead || context.incapacitated) return { ok: false, reason: 'Physically examine the original folded letter.' };
      s.evidenceRead = true;
      return record(s, action, at, 'The dated farewell reads: “Mara, we reached shelter. You kept your promise. Please do not spend the rest of your life waiting for us.” It predates this laboratory; no surviving recipient is invented.');
    }
    const reason = communicationReason(s, context);
    if (reason) return { ok: false, reason };
    if (action === 'contact') {
      s.contact = true; s.actor.name = 'Mara, the Hauntbound';
      return record(s, action, at, '“I remember waiting. Were they safe? I can help you put things in order, but I will not help hurt anyone.” Fragmented testimony, not recovered human expertise.');
    }
    if (!s.contact) return { ok: false, reason: 'Establish personal spirit contact first.' };
    if (action === 'agreement') {
      if (s.actor.health < 30 || s.actor.soul.integrity < 30 || !context.letterExists)
        return { ok: false, reason: 'Mara declines: repair the body, preserve the letter and do not exploit a damaged soul.' };
      s.agreement = true; s.withdrawn = false;
      return record(s, action, at, 'Mara voluntarily agrees to repeatable light materials work. Keep the letter safe; no weapons, harmful specimens or hazardous work. No food, sleep, wages or obedience enchantment.');
    }
    if (action === 'farewell') {
      if (!s.evidenceRead || !context.letterLocal) return { ok: false, reason: 'Bring and read the actual original farewell letter; testimony is not a replacement.' };
      s.farewellHeard = true;
      return record(s, action, at, '“They were safe. Then I can stop waiting. But I could stay here and do something useful. Ask me when you are ready to say goodbye.” Understanding does not automatically dismiss the worker.');
    }
    if (action === 'release') {
      if (!s.farewellHeard) return { ok: false, reason: 'Mara is not ready to leave; an order cannot manufacture acceptance.' };
      if (s.orders.some(o => !['completed', 'canceled'].includes(o.status))) return { ok: false, reason: 'Finish or cancel the agreed work and put down its actual cargo before saying goodbye.' };
      s.actor.status = 'departed'; s.actor.present = false; s.agreement = false;
      s.actor.departedAt = at; s.actor.independentIntent = 'Voluntarily entered reincarnation; no inhabitant remains in the enchantment.';
      return record(s, action, at, 'Mara chooses reincarnation. The same repaired or damaged doll retains its accumulated protective imprint, not an imprisoned or consumed soul.');
    }
    return { ok: false, reason: 'Unsupported interaction; no binding or production recipe exists.' };
  }
  function eligible(stack) {
    return Boolean(stack && stack.section === 'resources' && SAFE.includes(stack.key) && stack.quantity >= 1
      && !stack.carriedBy && !stack.containerId && !stack.fixtureId && !stack.reservedTaskId
      && !stack.form?.includes('spill') && !stack.biology && !(stack.substances && Object.keys(stack.substances).length)
      && !(stack.tags || []).some(t => ['hazardous', 'contaminated', 'evidence', 'weapon'].includes(t))
      && stack.unitMassKg <= DEFINITION.carryMassKg && stack.unitVolumeL <= DEFINITION.carryVolumeL);
  }
  function canMove(a, loadKg = 0) {
    return loadKg >= 0 && loadKg <= DEFINITION.carryMassKg
      && (a.bodyMassKg + a.wetKg + loadKg) * 9.81 <= a.forceN;
  }
  function assign(s, order, context, at) {
    const reason = communicationReason(s, context);
    if (reason || !s.agreement || s.actor.status !== 'bound') return { ok: false, reason: reason || 'No current voluntary work agreement.' };
    if (!eligible(context.source)) return { ok: false, reason: 'Select an original accessible safe light-material lot; no hazardous or oversized work.' };
    if (s.orders.some(o => !['completed', 'canceled'].includes(o.status))) return { ok: false, reason: 'Finish or cancel the current assignment first.' };
    if (!Number.isInteger(order.amount) || order.amount <= 0 || order.amount > context.source.quantity) return { ok: false, reason: 'Select an available whole quantity.' };
    if (!order.toCell || !order.toRoomId) return { ok: false, reason: 'Select a physically known destination.' };
    s.orders.push({ ...copy(order), delivered: 0, stage: 'pickup', carriedStackId: '', status: 'claimed',
      receivedAt: at, receivedVia: 'personal-animancy', progress: 0, blockedReason: '' });
    s.actor.independentIntent = 'Perform the agreed materials assignment using judgment, not a single-step puppet instruction.';
    return { ok: true };
  }
  function cancel(s, id, at, hooks) {
    const order = s.orders.find(o => o.id === id && !['completed', 'canceled'].includes(o.status));
    if (!order) return false;
    if (hooks.release(order) === false) return false;
    order.status = 'canceled'; order.completedAt = at; order.blockedReason = '';
    s.actor.independentIntent = ''; return true;
  }
  function damage(s, amount, kind, at) {
    const a = s.actor, n = Math.max(0, amount);
    if (kind === 'soul') {
      a.soul.integrity = Math.max(0, a.soul.integrity - n);
      if (!a.soul.integrity) { a.status = 'soul-destroyed'; a.present = false; s.agreement = false; }
    } else {
      a.health = Math.max(0, a.health - n); a.seamWear = Math.min(100, a.seamWear + n / 2);
      if (!a.health && a.status === 'bound') { a.status = 'bound-remains'; s.agreement = false; }
    }
    const last = a.injuries.at(-1);
    if (last?.kind === kind) { last.amount += n; last.lastAt = at; }
    else a.injuries.push({ at, amount: n, kind });
    return n;
  }
  function repair(s, receipt, at) {
    if (!receipt?.sourceStackIds?.length || !receipt.cloth) return false;
    s.actor.health = Math.min(100, s.actor.health + 35); s.actor.seamWear = Math.max(0, s.actor.seamWear - 40);
    if (s.actor.status === 'bound-remains' && s.actor.soul.integrity > 0) s.actor.status = 'bound';
    s.actor.repairs.push({ ...copy(receipt), at }); return true;
  }
  // Small fixed steps make coarse waits, saves and ordinary real-time updates equivalent.
  function advance(s, at, hooks = {}) {
    if (!s || hooks.dead || at <= s.lastAt) return 0;
    let changed = 0;
    while (s.lastAt < at) {
      const dt = Math.min(3, at - s.lastAt); s.lastAt += dt;
      const a = s.actor, env = hooks.environment?.(a, dt) || {};
      if (env.missing) { s.agreement = false; continue; }
      if (env.wet) { const water = Math.min(.5 - a.wetKg, Math.max(0, env.waterKg || 0)); a.wetKg += water; a.waterAbsorbedKg += water; }
      else { const loss = Math.min(a.wetKg, dt * .0001); a.wetKg -= loss; a.waterEvaporatedKg += loss; }
      if (env.fire) damage(s, dt * 2, 'fire', s.lastAt);
      if (a.soul.integrity > 0 && !['departed', 'soul-destroyed'].includes(a.status)) {
        const gain = Math.min(DEFINITION.enchantCapacity - s.enchantment.charge, dt / 3600);
        s.enchantment.charge += gain; s.enchantment.imprinted += gain;
      }
      const o = s.orders.find(o => !['completed', 'canceled'].includes(o.status));
      if (!o) { a.soulReserve = Math.min(100, a.soulReserve + dt * .05); changed++; continue; }
      const danger = env.fire || env.unsafe, refusal = !s.agreement || !env.letterExists || a.health < 30 || a.soul.integrity < 30;
      if (danger || refusal || a.status !== 'bound' || a.seamWear >= 80 || a.wetKg >= .4 || env.carried) {
        o.status = 'blocked'; o.blockedReason = danger ? 'Mara refuses a directly sensed dangerous work site.'
          : 'Original body, safe letter, consent or usable seams are unavailable; no replacement worker.';
        if (danger || !env.letterExists) { s.agreement = false; s.withdrawn = true; }
        if (a.status !== 'bound') hooks.release?.(o);
        a.soulReserve = Math.min(100, a.soulReserve + dt * .05); changed++; continue;
      }
      if (a.soulReserve < 1 || o.recovering && a.soulReserve < 20) {
        o.recovering = true; a.soulReserve = Math.min(100, a.soulReserve + dt * .05);
        o.status = 'blocked'; o.blockedReason = 'Limited soul exertion: voluntarily recovering, not sleeping or eating.'; changed++; continue;
      }
      o.recovering = false;
      const result = hooks.work?.(a, o, dt) || { reason: 'Physical work adapter unavailable.' };
      if (result.reason) { o.status = 'blocked'; o.blockedReason = result.reason; a.soulReserve = Math.min(100, a.soulReserve + dt * .05); }
      else {
        o.status = 'claimed'; o.blockedReason = ''; a.soulReserve = Math.max(0, a.soulReserve - dt * .01 * (1 + (result.loadKg || 0)));
        a.workSeconds += dt; a.experience += dt / 60; a.seamWear = Math.min(100, a.seamWear + dt / 7200);
        o.progress = o.delivered / o.amount;
        if (o.delivered >= o.amount) { o.status = 'completed'; o.completedAt = s.lastAt; o.progress = 1; a.independentIntent = 'Await another agreed assignment; no invented work.'; }
      }
      changed++;
    }
    return changed;
  }
  function absorb(s, amount, types, usable) {
    if (!s || !usable || s.actor.status !== 'departed' || s.actor.health <= 0 || !types?.length || types.some(t => t !== 'physical')) return { damage: amount, absorbed: 0 };
    const n = Math.min(3, Math.floor(amount * .3), Math.floor(s.enchantment.charge));
    s.enchantment.charge -= n; s.enchantment.spent += n; return { damage: amount - n, absorbed: n };
  }
  function recharge(s, receipt) {
    if (s.actor.status !== 'departed' || s.actor.health <= 0 || !receipt?.sourceStackIds?.length
      || s.enchantment.charge + DEFINITION.chargePerFeedstock > DEFINITION.enchantCapacity + 1e-8) return false;
    s.enchantment.charge += DEFINITION.chargePerFeedstock; s.enchantment.supplied += DEFINITION.chargePerFeedstock;
    (s.enchantment.receipts ||= []).push(copy(receipt)); return true;
  }
  function observe(s, at) {
    s.observations = { at, discovered: s.discovered, contact: s.contact, evidenceRead: s.evidenceRead,
      farewellHeard: s.farewellHeard, agreement: s.agreement, actor: copy(s.actor), orders: copy(s.orders), enchantment: copy(s.enchantment) };
    return copy(s.observations);
  }
  return { DEFINITION, create, communicationReason, interact, eligible, canMove, assign, cancel, damage, repair, advance, absorb, recharge, observe };
});
