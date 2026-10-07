(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixSurfaceWorkers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme) {
  'use strict';
  const HOUR = 3600, STEP = 10, FEE = 40, HOURLY = 12;
  const GOODS = Object.freeze(['stoneBlocks', 'lumber', 'steelPanels', 'metalParts', 'bricks', 'glass', 'cloth', 'rubber']);
  const registry = Theme.createRegistry([{ id: 'surfacePorter', kind: 'employmentRole', label: 'Surface stores worker',
    template: 'Voluntary paid hauling of ordinary surface supplies; no underground, hazardous or specimen work.',
    compatibility: 'shared', contentTags: ['scarcity', 'survival'] },
    { id: 'laboratoryTechnician', kind: 'employmentRole', label: 'Laboratory assay technician',
      template: 'Voluntary finite laboratory employment for disclosed sealed nonliving sample analysis; no living-specimen work.',
      compatibility: 'shared', contentTags: ['scarcity', 'survival'] }]);
  const copy = x => JSON.parse(JSON.stringify(x));
  const num = x => Math.max(0, Number.isFinite(Number(x)) ? Number(x) : 0);
  const active = c => c && ['arriving', 'onSite', 'departing', 'returning'].includes(c.status);
  function normalize(value) {
    if (!value?.actor?.id) return null;
    return { actor: copy(value.actor), contract: value.contract ? copy(value.contract) : null,
      quote: value.quote ? copy(value.quote) : null, orders: copy(value.orders || []), history: copy(value.history || []).slice(-60),
      nextContract: Math.max(1, Math.floor(num(value.nextContract))), nextOrder: Math.max(1, Math.floor(num(value.nextOrder))),
      lastAt: num(value.lastAt) };
  }
  function create(seed, city, theme, at = 0, role = 'surfacePorter') {
    if (!city?.id || !city.supported || !Theme.eligibleDefinitions(registry, { kind: 'employmentRole', worldTheme: theme }).some(d => d.id === role)) return null;
    const technician = role === 'laboratoryTechnician';
    let hash = 0; for (const c of `${seed}:${city.id}:${technician ? 'laboratory-assistant' : 'surface-worker'}`) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
    const name = `${['Mira', 'Ren', 'Tamsin', 'Dara', 'Ilya', 'Soren'][hash % 6]} ${['Arden', 'Vale', 'Neri', 'Voss'][Math.floor(hash / 6) % 4]}`;
    return normalize({ actor: { id: `${technician ? 'laboratory-assistant' : 'surface-worker'}:${city.id}`, actorKind: technician ? 'laboratoryAssistant' : 'surfaceWorker', name, cityId: city.id,
      affiliation: `${city.name} independent ${technician ? 'assay technician' : 'stores worker'}`, status: 'alive', health: 100, maxHealth: 100, present: false,
      accessPolicyAware: true, skills: technician ? { analysis: 6, alchemy: 5, perception: 5 } : { hauling: 8, perception: 5 }, fatigue: 0, food: 2, water: 4, money: 0, trust: 50,
      roomId: '', mapCell: null, observations: [], reason: '', availableAt: at }, lastAt: at, nextContract: 1, nextOrder: 1 });
  }
  function routeReason(state, route) {
    return !route?.ok || route.cityId !== state.actor.cityId || !Number.isFinite(route.distanceKm) || route.distanceKm <= 0
      || route.distanceKm > 5 || !route.municipal ? route?.reason || 'Only a supported municipal walking route of at most five kilometres is available.' : '';
  }
  function quote(state, route, hours, now) {
    if (!state) return { ok: false, reason: 'No supported local applicant directory.' };
    const a = state.actor, reason = routeReason(state, route);
    if (reason) return { ok: false, reason };
    if (active(state.contract) || a.present) return { ok: false, reason: 'The existing engagement and physical return must finish first.' };
    if (a.status === 'dead' || a.health < 35 || a.fatigue >= 35 || now < a.availableAt) return { ok: false, reason: 'The original worker is unavailable, wounded or still resting; no replacement is generated.' };
    if (![2, 4, 8].includes(Number(hours))) return { ok: false, reason: 'Choose a two-, four- or eight-hour shift.' };
    const duration = Number(hours), tripHours = route.distanceKm / 4 * 2;
    if (a.food < (duration + tripHours) * .125 || a.water < (duration + tripHours) * .25)
      return { ok: false, reason: 'The worker lacks personal provisions for the shift and both walking legs. Resupply requires a physical handoff.' };
    const hourly = a.actorKind === 'laboratoryAssistant' ? 24 : HOURLY;
    return { ok: true, actorId: a.id, cityId: a.cityId, hours: duration, fee: FEE, hourly,
      reserve: duration * hourly, upfront: FEE + duration * hourly, distanceKm: route.distanceKm, expiresAt: now + HOUR };
  }
  function request(state, route, hours, now) { const q = quote(state, route, hours, now); if (state) state.quote = q.ok ? q : null; return q; }
  function note(s, at, summary) { s.history.push({ at, summary }); s.history = s.history.slice(-60); }
  function hire(state, route, expected, wallet, now) {
    const fresh = quote(state, route, expected?.hours, now);
    if (!fresh.ok) return fresh;
    if (!expected || JSON.stringify(expected) !== JSON.stringify(state.quote) || now > expected.expiresAt
      || ['actorId', 'cityId', 'hours', 'upfront', 'distanceKm'].some(k => fresh[k] !== expected[k])) return { ok: false, reason: 'Review fresh exact terms before hiring.' };
    if (wallet.money < fresh.upfront) return { ok: false, reason: 'The engagement fee and complete wage reserve must be prepaid.' };
    wallet.money -= fresh.upfront; state.actor.money += FEE;
    state.contract = { id: `surface-shift-${state.nextContract++}`, status: 'arriving', bookedAt: now, lastAt: now,
      hours: fresh.hours, hourly: fresh.hourly, reserve: fresh.reserve, earned: 0, refund: 0, settled: false,
      distanceKm: fresh.distanceKm, positionKm: 0, startedAt: null, reason: '', completedAt: null };
    state.lastAt = now; state.quote = null;
    note(state, now, `Accepted voluntary ${state.actor.actorKind === 'laboratoryAssistant' ? 'disclosed laboratory' : 'surface'} employment. Paid travel fee; wages held in finite escrow. Worker walking from the local city.`);
    return { ok: true, contract: state.contract };
  }
  function eligible(stack) {
    return stack?.section === 'resources' && GOODS.includes(stack.key) && stack.quantity > 0 && !stack.chemicalBatch
      && !stack.creature && !stack.carriedBy && !stack.containerId && !stack.fixtureId
      && !(stack.tags || []).some(t => /living|soul|toxic|hazard|contaminat|volatile|waste/i.test(t));
  }
  function assign(state, stack, amount, destination, context, now) {
    if (!state || state.actor.status === 'dead' || state.actor.health < 35 || state.contract?.status !== 'onSite' || state.orders.some(o => o.status === 'active')) return { ok: false, reason: 'A capable on-site worker with no active assignment is required.' };
    if (!eligible(stack) || stack.reservedTaskId || !Number.isInteger(amount) || amount <= 0 || amount > stack.quantity
      || !context.surfaceRooms.includes(stack.roomId) || !context.surfaceRooms.includes(destination) || destination === stack.roomId)
      return { ok: false, reason: 'Select an exact available ordinary loose supply stack and a different permitted surface room.' };
    if (!context.routeOk || !context.carryOk) return { ok: false, reason: context.reason || 'Access, route or carrying capacity is insufficient.' };
    const order = { id: `surface-haul-${state.nextOrder++}`, sourceStackId: stack.id, key: stack.key, amount,
      fromRoomId: stack.roomId, toRoomId: destination, delivered: 0, status: 'active', stage: 'pickup', carriedStackId: '',
      createdAt: now, completedAt: null, reason: '' };
    stack.reservedTaskId = order.id; state.orders.push(order);
    note(state, now, `Authorized ${amount} ${stack.key} from ${stack.roomId} to ${destination}; no research or underground access granted.`);
    return { ok: true, order };
  }
  function cancel(state, hooks, now) {
    const order = state?.orders.find(o => o.status === 'active'); if (!order) return false;
    hooks.release(order); order.status = 'cancelled'; order.reason = order.kind === 'assay' ? 'Assay cancelled; unused supplies and instrument left at the technician. No result invented or incorporated input refunded.' : 'Assignment cancelled; current load dropped at the worker, earlier deliveries preserved.';
    note(state, now, order.reason); return true;
  }
  function withdraw(state, hooks, now, reason = 'Employer ended the shift') {
    const c = state?.contract; if (!active(c) || ['departing', 'returning'].includes(c.status)) return false;
    cancel(state, hooks, now); c.reason = reason; c.status = state.actor.present ? 'departing' : 'returning';
    note(state, now, `${reason}. Physical exit and return are still required; unused wages are not yet refunded.`); return true;
  }
  function advance(state, route, wallet, now, hooks) {
    if (!state || hooks.dead) return 0;
    const a = state.actor, c = state.contract;
    if (!active(c)) { a.fatigue = Math.max(0, a.fatigue - Math.max(0, now - state.lastAt) / HOUR * 15); state.lastAt = Math.max(state.lastAt, now); return 0; }
    let changes = 0;
    while (state.lastAt + STEP <= now && active(c)) {
      state.lastAt += STEP; const at = state.lastAt;
      if (a.status === 'dead' || a.health <= 0) {
        a.status = 'dead'; cancel(state, hooks, at); c.status = 'fatality'; c.reason = 'Worker died. Employer goods remain at the actual site; unspent wage escrow is retained pending recovery, not paid or erased.';
        a.reason = c.reason; note(state, at, c.reason); changes++; break;
      }
      if (a.health <= 10 || hooks.incapacitated?.()) { a.reason = 'Worker cannot move or work. Physical actor, load and escrow remain; no replacement or automatic rescue.'; continue; }
      a.food = Math.max(0, a.food - STEP / HOUR * .125); a.water = Math.max(0, a.water - STEP / HOUR * .25);
      if ((a.food <= 0 || a.water <= 0) && ['arriving', 'onSite'].includes(c.status)) withdraw(state, hooks, at, 'Personal provisions exhausted');
      if (a.health < 35 && ['arriving', 'onSite'].includes(c.status)) withdraw(state, hooks, at, 'Serious wounds require withdrawal');
      if (c.status === 'onSite') { const danger = hooks.danger?.(a); if (danger) withdraw(state, hooks, at, danger); }
      if (c.startedAt !== null && a.present) {
        const earned = Math.min(c.reserve, Math.max(0, at - c.startedAt) / HOUR * (c.hourly || HOURLY));
        a.money += earned - c.earned; c.earned = earned;
        if (earned >= c.reserve && c.status === 'onSite') withdraw(state, hooks, at, 'Agreed shift and wage reserve exhausted');
      }
      a.reason = '';
      if (['arriving', 'returning'].includes(c.status)) {
        const reason = routeReason(state, route);
        if (reason || route.distanceKm !== c.distanceKm) { a.reason = reason || 'Original municipal walking route changed; saved position retained.'; continue; }
        a.fatigue = Math.min(100, a.fatigue + STEP / HOUR * 8);
        c.positionKm = Math.max(0, Math.min(c.distanceKm, c.positionKm + (c.status === 'arriving' ? 1 : -1) * STEP / HOUR * 4));
        if (c.status === 'arriving' && c.positionKm >= c.distanceKm - 1e-8) {
          const entry = hooks.enter(a);
          if (!entry || entry.ok === false) { a.reason = entry?.reason || 'Loading Bay entrance unavailable; waiting outside, no teleport through a closed portal.'; continue; }
          a.present = true; c.status = 'onSite'; c.startedAt = at; note(state, at, 'Worker physically arrived at the Loading Bay; prepaid on-site shift started.');
        } else if (c.status === 'returning' && c.positionKm <= 1e-8) {
          c.status = 'completed'; c.completedAt = at;
          if (!c.settled) { c.refund = Math.max(0, c.reserve - c.earned); wallet.money += c.refund; c.settled = true; }
          a.availableAt = at + HOUR; note(state, at, 'Worker physically returned to the city; unused wage escrow refunded once. Provisions and condition retained.');
        }
      } else if (c.status === 'departing') {
        const result = hooks.exit(a); a.reason = result.reason || '';
        if (result.done) { a.present = false; a.mapCell = null; a.roomId = ''; c.status = 'returning'; }
      } else {
        const order = state.orders.find(o => o.status === 'active');
        if (a.fatigue >= 60 || a.resting && a.fatigue > 30) { a.resting = true; a.fatigue = Math.max(0, a.fatigue - STEP / HOUR * 18); a.reason = 'Resting; paid shift time continues.'; }
        else {
          a.resting = false;
          if (order) {
            const result = hooks.haul(a, order); order.reason = result.reason || ''; a.reason = order.reason;
            a.fatigue = Math.min(100, a.fatigue + STEP / HOUR * (result.reason ? 2 : 12));
            if (result.withdraw) withdraw(state, hooks, at, result.reason);
            else if (order.delivered >= order.amount) { hooks.release(order); order.status = 'completed'; order.completedAt = at;
              a.trust = Math.min(100, a.trust + 1); note(state, at, order.kind === 'assay' ? 'Completed the authorized assay; a physical local analytical record awaits receipt, not automatic discovery or loyalty.' : `Completed ${order.amount} ${order.key} hauling; ordinary cooperation, not loyalty.`); }
          } else a.fatigue = Math.max(0, a.fatigue - STEP / HOUR * 18);
        }
      }
      changes++;
    }
    return changes;
  }
  function publicView(state, now) {
    if (!state) return null;
    const a = state.actor;
    return { reportedAt: now, applicant: { id: a.id, name: a.name, affiliation: a.affiliation, skills: copy(a.skills),
      condition: a.status === 'dead' ? 'Dead' : a.health < 35 ? 'Seriously wounded' : 'Fit for ordinary work',
      fatigue: a.fatigue, food: a.food, water: a.water, reason: a.reason, trust: a.trust, present: a.present },
      quote: state.quote ? copy(state.quote) : null, contract: state.contract ? copy(state.contract) : null,
      orders: copy(state.orders), history: copy(state.history) };
  }
  return { FEE, HOURLY, GOODS, STEP, active, normalize, create, quote, request, hire, eligible, assign, cancel, withdraw, advance, publicView };
});
