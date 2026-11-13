(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./creature-life') : root.HelixCreatureLife,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-habitat') : root.HelixBeastHabitat,
    node ? require('./beast-predation') : root.HelixBeastPredation);
  if (node) module.exports = api;
  root.HelixBeastBehavior = api;
})(globalThis, function (Data, Life, Bodies, Habitat, Predation) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), DAY = 86400;
  const alive = a => a && a.status !== 'dead' && a.health > 0;
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
  const distance = (a, b, ctx) => {
    if (!a?.mapCell || !b?.mapCell || a.mapCell.z !== b.mapCell.z) return Infinity;
    const ah = Bodies.height(a), bh = Bodies.height(b), az = a.bodyPhysics?.dimensions.heightM || 1.8, bz = b.bodyPhysics?.dimensions.heightM || 1.8;
    const gap = Math.max(0, ah - bh - bz, bh - ah - az);
    const bounds = entity => {
      const body = entity.bodyPhysics, d = body?.dimensions;
      if (!d) return { x: 1, y: 1 };
      const width = body.wingsSpread ? Math.max(d.widthM, d.wingSpanM) : d.widthM;
      return body.heading ? { x: width, y: d.lengthM } : { x: d.lengthM, y: width };
    };
    const ad = bounds(a), bd = bounds(b), tile = ctx.tileSizeM || 1;
    const x = Math.max(0, (a.mapCell.x - b.mapCell.x) * tile - bd.x, (b.mapCell.x - a.mapCell.x) * tile - ad.x);
    const y = Math.max(0, (a.mapCell.y - b.mapCell.y) * tile - bd.y, (b.mapCell.y - a.mapCell.y) * tile - ad.y);
    return Math.hypot(x, y, gap);
  };
  const definitions = {
    charge: { label: 'Charge', seconds: 3, range: 8, stamina: 15, mobile: true, parts: /leg|limb/ },
    hornVitrify: { label: 'Heated horn contact', seconds: 2, heatMJ: 24, parts: /horn|head/ },
    focusPinions: { label: 'Pinion focusing', seconds: 2, range: 16, focus: 2, stamina: 4, mobile: true, parts: /wing/ },
    chorus: { label: 'Hypnotic chorus', seconds: 3, range: 6, stamina: 8, parts: /head/ },
    discharge: { label: 'Stored-charge discharge', seconds: 1, range: 4, chargeMJ: .1, stamina: 2 },
    crownIgnite: { label: 'Disturbed crown ignition', seconds: .5, crownKg: .002, parts: /fungal crown/ },
    rootStabilize: { label: 'Root stabilization', work: true, parts: /root/ },
    tendWetland: { label: 'Wetland tending', work: true, parts: /limb/ },
    cultivateReef: { label: 'Reef cultivation', work: true, parts: /head|forebody/ },
    buildDam: { label: 'Watercourse engineering', work: true, parts: /limb|tail/ },
    growBlooms: { label: 'Carrion-supported bloom growth', work: true },
    buildFurnace: { label: 'Colony furnace construction', work: true },
    dreamWeather: { label: 'Shared-dream weather tending', work: true, manaPerDay: 20 },
    blink: { label: 'Short blink', seconds: .5, range: 3, mana: 8, parts: /head|torso/ },
    frostTrail: { label: 'Freezing tracks', seconds: 1, mana: 1 },
    iceCache: { label: 'Iced kill cache', seconds: 2, mana: 2, range: 2 },
    radiantFan: { label: 'Radiant fan display', seconds: 2, range: 6, mana: 12, parts: /radiant fan|head/ },
    filterMana: { label: 'Mana-current feeding', work: true },
    laneInterference: { label: 'Local lane defense', seconds: 2, range: 4, mana: 8, stamina: 2 },
    corpseLight: { label: 'Corpse-light display', seconds: 1, lightKg: .001 },
    filterPlankton: { label: 'Feeding towers', work: true },
    pressurePulse: { label: 'Underwater pressure pulse', seconds: 2, range: 8, mana: 20, stamina: 4, parts: /pressure organs|bell/ },
    etherLure: { label: 'Depth-bound ether lure', seconds: 2, range: 10, mana: 10, parts: /pressure organs/ },
    iceWake: { label: 'Temporary ice wake', seconds: 2, mana: 4, mobile: true },
    regenerateHead: { label: 'Head regrowth', work: true, parts: /torso/ },
    forage: { label: 'Compatible feeding', work: true },
    hunt: { label: 'Perceived-prey hunting', work: true },
    toolUse: { label: 'Actual carried tool use', work: true },
    hotTunnel: { label: 'Superheated tunnel', seconds: 2, heatMJ: 20, parts: /digging|torso/ }
  };
  const capabilities = Object.fromEntries([
    ['ashhorn-behemoth', ['charge', 'hornVitrify', 'forage']], ['glasswing-roc', ['focusPinions', 'hunt']],
    ['mire-choir', ['chorus', 'tendWetland', 'forage']], ['nullmaw-stalker', ['hunt']],
    ['thunderback-grazer', ['charge', 'discharge', 'forage']], ['candlecap-myriapod', ['crownIgnite', 'forage']],
    ['ironroot-colossus', ['rootStabilize', 'forage']], ['gloam-prowler', ['blink', 'hunt']],
    ['rimefang-pack', ['frostTrail', 'iceCache', 'hunt']], ['sunspine-basilisk', ['radiantFan', 'hunt']],
    ['ley-manta', ['filterMana', 'laneInterference', 'forage']], ['carrion-lantern', ['corpseLight', 'forage']],
    ['brine-cathedral', ['filterPlankton']], ['reef-wyrm', ['cultivateReef', 'hunt']],
    ['abyssal-bell', ['pressurePulse', 'etherLure', 'hunt']], ['frostwake-leviathan', ['iceWake', 'hunt']],
    ['marsh-hydra', ['regenerateHead', 'hunt']], ['rivercoil', ['buildDam', 'forage']],
    ['ember-ant', ['buildFurnace', 'forage']], ['dreaming-tortoise', ['dreamWeather', 'forage']],
    ['mirror-ape', ['toolUse', 'forage']], ['gravebloom-elk', ['growBlooms', 'forage']],
    ['storm-kite', ['discharge', 'forage']], ['burrowing-furnace', ['hotTunnel', 'forage']]
  ].map(([id, actions]) => [`beast:${id}`, actions]));
  function attach(a, at, source = {}) {
    const existed = Boolean(a.life); Life.attach(a, at, source);
    if (!Life.valid(a) || existed) return a;
    const l = a.life, kg = a.bodyPhysics.massKg;
    l.energy = { heatMJ: a.speciesId === 'beast:ashhorn-behemoth' ? kg * .01 * .98
      : a.speciesId === 'beast:burrowing-furnace' ? kg * .28 : 0,
      chargeMJ: a.speciesId === 'beast:thunderback-grazer' ? 5 : a.speciesId === 'beast:storm-kite' ? .2 : 0,
      focus: a.speciesId === 'beast:glasswing-roc' ? 10 : 0,
      crownKg: a.speciesId === 'beast:candlecap-myriapod' ? kg * .05 : 0, lightKg: 0 };
    const stage = Math.min(1, kg / Life.profile(a).adultKg);
    l.energy.chargeMJ *= stage; l.energy.focus *= stage;
    l.energyCapacity = copy(l.energy); l.cooldowns = {}; l.actedAt = at; l.pending = null;
    if (source.origin === 'naturalBirth') for (const k of ['heatMJ', 'chargeMJ', 'focus', 'lightKg']) l.energy[k] = 0;
    l.armourKg = ['beast:ironroot-colossus', 'beast:reef-wyrm', 'beast:burrowing-furnace'].includes(a.speciesId) ? kg * .02 : 0;
    return a;
  }
  function mana(a) { return a.speciesId === 'beast:mirror-ape' ? a.spellImitation : a.bodyPhysics; }
  function affordable(a, costs) {
    const b = a.bodyPhysics, e = a.life.energy;
    return b.stamina >= (costs.stamina || 0) && (mana(a)?.mana || 0) >= (costs.mana || 0)
      && ['heatMJ', 'chargeMJ', 'focus', 'crownKg', 'lightKg'].every(k => e[k] + 1e-10 >= (costs[k] || 0));
  }
  function pay(a, costs) {
    if (!affordable(a, costs)) return false;
    a.bodyPhysics.stamina -= costs.stamina || 0; a.bodyPhysics.spentStamina += costs.stamina || 0;
    const m = mana(a); if (costs.mana) { m.mana -= costs.mana; m.spentMana = (m.spentMana || 0) + costs.mana; }
    for (const k of ['heatMJ', 'chargeMJ', 'focus', 'crownKg', 'lightKg']) a.life.energy[k] -= costs[k] || 0;
    return true;
  }
  function event(a, kind, at, detail = {}) {
    const e = { id: `${a.id}:behavior:${a.life.events.length}:${at}`, kind, at, ...detail };
    a.life.events.push(e); if (a.life.events.length > 96) a.life.events.shift(); return e;
  }
  function activeConditions(a, at) { return (a?.beastConditions || []).filter(c => c.until > at); }
  function condition(a, kind, from, at, seconds, potency = 1) {
    a.beastConditions ||= [];
    const old = a.beastConditions.find(c => c.kind === kind && c.from === from);
    if (old) { old.until = Math.max(old.until, at + seconds); old.potency = Math.max(old.potency, potency); }
    else a.beastConditions.push({ kind, from, startedAt: at, until: at + seconds, potency });
  }
  function modifiers(a, at) {
    const result = { movement: 0, attack: 0, work: 0, incapacitated: false };
    for (const c of activeConditions(a, at)) {
      if (c.kind === 'paralysis') result.incapacitated = true;
      if (['hypnotic', 'misled', 'etherLure', 'dreamDrowsy'].includes(c.kind)) { result.attack += c.potency * 5; result.work += c.potency * .1; result.movement += c.potency * .1; }
    }
    return result;
  }
  function conscious(a, at) { return alive(a) && !modifiers(a, at).incapacitated; }
  function permitted(a, ctx) { return a.life.will || ctx.receivedOrder?.actorId === a.id && ctx.receivedOrder.kind === ctx.actionId; }
  function canSense(a, target, channel, ctx, head = null) {
    return alive(target) && Boolean(ctx.signal?.(a, target, channel, head)) && Bodies.perceive(a, target, channel,
      { tileSizeM: ctx.tileSizeM || 1, light: channel === 'sight' ? ctx.lightAt?.(target.mapCell) ?? 100 : 100, signal: () => true });
  }
  const channels = {
    'beast:nullmaw-stalker': ['vibration', 'scent', 'sight'], 'beast:burrowing-furnace': ['vibration'],
    'beast:abyssal-bell': ['pressure', 'hearing'], 'beast:ley-manta': ['mana', 'sight'],
    'beast:ember-ant': ['scent', 'vibration'], 'beast:carrion-lantern': ['scent', 'sight']
  };
  function observe(a, at, ctx) {
    const seen = [];
    for (const target of ctx.actors || []) {
      if (target.id === a.id || !alive(target)) continue;
      const channel = (channels[a.speciesId] || ['sight', 'hearing', 'scent']).find(c => canSense(a, target, c, ctx));
      if (!channel) continue;
      const record = { id: target.id, cell: copy(target.mapCell), at, channel, speciesId: target.speciesId || null };
      Life.remember(a, record); seen.push(target);
      for (const [head, data] of Object.entries(a.life.heads)) if (!data.lost && ctx.signal?.(a, target, 'sight', head)) Life.remember(a, record, head);
    }
    return seen;
  }
  function biologicalOpponents(a, at, ctx) {
    const seen = observe(a, at, ctx), p = ctx.patch(a.mapCell);
    if (!p) return [];
    const harms = (p.events || []).filter(e => at - e.at <= 60 && ['hornVitrify', 'hotTunnel', 'combustion', 'feeding'].includes(e.kind));
    return seen.filter(t => Data.antagonisms.some(edge => edge.nurturer === a.speciesId && edge.destroyer === t.speciesId)
      && !(a.speciesId === 'beast:glasswing-roc' && ['beast:ashhorn-behemoth', 'beast:burrowing-furnace'].includes(t.speciesId)
        && t.life.ageDays >= Life.profile(t).adultDays)
      && harms.some(e => e.actorId === t.id) && !ctx.protectedTarget?.(a, t));
  }
  function packContact(a, at, ctx) {
    if (!['beast:gloam-prowler', 'beast:rimefang-pack'].includes(a.speciesId) || !a.life.will) return;
    for (const member of ctx.actors || []) if (member.id !== a.id && member.speciesId === a.speciesId && member.populationId === a.populationId
      && member.life?.will && canSense(a, member, 'hearing', ctx)) {
      const report = member.life.memories.filter(m => at - m.at <= 5 && m.channel !== 'received').at(-1);
      if (report) Life.remember(a, { ...report, channel: 'received', receivedAt: at, sourceId: member.id });
    }
  }
  function interrupt(a, at, reason) {
    if (!Life.valid(a)) return;
    if (a.life.pending) event(a, 'interrupted', at, { action: a.life.pending.action, reason });
    a.life.pending = null; a.life.lastDamageAt = at;
    for (const [part, h] of Object.entries(a.life.heads)) if (!h.lost && a.bodyPhysics.parts[part] <= 0) {
      h.lost = true; h.memory = []; h.regrowth = 0;
    }
  }
  function begin(a, action, target, at, ctx) {
    const d = definitions[action];
    if (!d || d.work || !capabilities[a.speciesId]?.includes(action) || !Life.valid(a) || !conscious(a, at)
      || !ctx.alive || !ctx.local || !permitted(a, { ...ctx, actionId: action }) || a.life.pending
      || (a.life.cooldowns[action] || 0) > at || ctx.incapacitated || a.magicSuppressed && d.mana
      || d.parts && Bodies.wounded(a, d.parts) >= .65 || !affordable(a, d)) return { ok: false, reason: 'Body, agency, preparation or finite reserve unavailable' };
    if (a.bodyPhysics.motion && !d.mobile) return { ok: false, reason: 'Moving limbs cannot start that preparation' };
    if (d.range && action !== 'blink' && (!target || distance(a, target, ctx) > d.range || !ctx.effectLine?.(a, target, action)))
      return { ok: false, reason: 'No actual perceived reachable target' };
    if (action === 'blink') {
      if (!target?.mapCell || !ctx.destinationSeen?.(a, target.mapCell)
        || Math.hypot(a.mapCell.x - target.mapCell.x, a.mapCell.y - target.mapCell.y) * (ctx.tileSizeM || 1) > d.range
        || target.mapCell.z !== a.mapCell.z) return { ok: false, reason: 'No personally perceived blink destination' };
      for (const c of path(a.mapCell, target.mapCell)) if (Bodies.habitatReason(a, c, 'walking', 0, ctx)) return { ok: false, reason: 'Blink cannot bypass solid/occupied/protected space' };
    }
    if (action === 'chorus') {
      const members = (ctx.actors || []).filter(m => m.speciesId === a.speciesId && alive(m) && m.life?.will
        && !(m.life.chorusUntil > at)
        && m.bodyPhysics.stamina >= 8 && Bodies.wounded(m, /head/) < .65 && distance(a, m, ctx) <= 4
        && (ctx.patch(m.mapCell)?.waterDepthM > 0 || ctx.patch(m.mapCell)?.wetness > .5) && ctx.signal?.(a, m, 'hearing'));
      if (members.length < 3 || ctx.noise > .7) return { ok: false, reason: 'No viable audible wet chorus' };
      for (const member of members) { if (member.id !== a.id) pay(member, { stamina: 8 }); member.life.chorusUntil = at + d.seconds; }
      ctx.chorusMemberIds = members.map(m => m.id);
    }
    if (['pressurePulse', 'etherLure'].includes(action) && (!(ctx.patch(a.mapCell)?.waterDepthM >= 16) || Bodies.height(target) >= 0)) return { ok: false, reason: 'No connected deep-water pressure medium' };
    if (action === 'laneInterference' && target?.speciesId !== 'beast:storm-kite') return { ok: false, reason: 'No actual storm-swarm incursion' };
    if (['frostTrail', 'iceCache', 'iceWake'].includes(action) && !(ctx.patch(a.mapCell)?.resources?.waterL > 0)) return { ok: false, reason: 'No actual water to freeze' };
    if (action === 'crownIgnite' && (ctx.patch(a.mapCell)?.waterDepthM > .1 || ctx.patch(a.mapCell)?.wetness > .8 || ctx.patch(a.mapCell)?.oxygen === false)) return { ok: false, reason: 'Wetness or oxygen prevents crown ignition' };
    pay(a, d);
    a.life.pending = { action, startedAt: at, dueAt: at + d.seconds, from: copy(a.mapCell), targetId: target?.id || null,
      targetCell: target?.mapCell && copy(target.mapCell), paid: copy(d), startDistanceM: a.bodyPhysics.distanceM,
      chorusMemberIds: ctx.chorusMemberIds || [], capturedSunMJ: 0 };
    event(a, 'preparing', at, { action }); return { ok: true };
  }
  function path(from, to) {
    const result = []; let p = copy(from);
    for (let n = 0; n < 16 && !same(p, to); n++) { p = p.x !== to.x ? { ...p, x: p.x + Math.sign(to.x - p.x) } : { ...p, y: p.y + Math.sign(to.y - p.y) }; result.push(p); }
    return result;
  }
  function resist(target, a, kind, at, ctx) {
    const score = ctx.resistance?.(target, kind) ?? .5;
    return Life.random(`${a.id}:${target.id}:${kind}:${a.life.pending?.startedAt ?? at}`) < Math.max(0, Math.min(1, score));
  }
  function radialTargets(a, target, range, ctx) {
    return [...new Map([target, ...(ctx.actors || [])].filter(t => t && t.id !== a.id && alive(t) && distance(a, t, ctx) <= range
      && !ctx.protectedTarget?.(a, t) && ctx.effectLine?.(a, t, 'discharge')).map(t => [t.id, t])).values()];
  }
  function release(a, pending, target, at, ctx) {
    const action = pending.action, p = ctx.patch(a.mapCell), d = definitions[action];
    if (action === 'charge') {
      if (a.bodyPhysics.distanceM - pending.startDistanceM < 2 || !target || distance(a, target, ctx) > Bodies.profiles[a.speciesId].reachM + 1) return false;
      ctx.strike?.(a, target, { damage: Math.min(100, Math.sqrt(a.bodyPhysics.massKg)), type: 'physical', cause: 'Actual charge contact' });
    } else if (action === 'hornVitrify' || action === 'hotTunnel') {
      if (!Habitat.thermal(a, action, pending.paid.heatMJ, at, ctx)) return false;
    } else if (action === 'focusPinions') {
      const energy = pending.capturedSunMJ + (a.life.capturedRadiance?.energyMJ || 0);
      a.life.capturedRadiance = null;
      if (!(energy > 0) || ctx.cloudCover >= .9 || ctx.focusAngle <= 0) return false;
      ctx.strike?.(a, target, { damage: Math.min(20, energy * 200), type: 'heat', energyMJ: energy, cause: 'Focused existing radiance', radiant: true });
    } else if (action === 'chorus') {
      const members = pending.chorusMemberIds.map(id => (ctx.actors || []).find(t => t.id === id));
      if (ctx.noise > .7 || members.some(m => !alive(m) || Bodies.wounded(m, /head/) >= .65 || distance(a, m, ctx) > 4 || !ctx.signal?.(a, m, 'hearing'))) return false;
      if (!resist(target, a, action, at, ctx)) condition(target, 'hypnotic', a.id, at, 6, Math.min(3, members.length / 3));
    } else if (action === 'blink') {
      if (!ctx.destinationSeen?.(a, pending.targetCell)) return false;
      for (const c of path(a.mapCell, pending.targetCell)) if (Bodies.habitatReason(a, c, 'walking', 0, ctx)) return false;
      const metres = Math.hypot(a.mapCell.x - pending.targetCell.x, a.mapCell.y - pending.targetCell.y) * (ctx.tileSizeM || 1);
      a.mapCell = copy(pending.targetCell); a.bodyPhysics.distanceM += metres; a.bodyPhysics.motion = null;
    } else if (action === 'discharge') {
      let energy = pending.paid.chargeMJ;
      if (p.grounded) { p.heatMJ = (p.heatMJ || 0) + energy; ctx.native?.(a.mapCell, { kind: 'heat', heatMJ: energy }); }
      else for (const t of radialTargets(a, target, d.range, ctx)) {
        if (distance(a, t, ctx) > 2 && !(p.waterDepthM > 0) && !ctx.conductive?.(a, t)) continue;
        const delivered = energy * .5; energy -= delivered;
        ctx.strike?.(a, t, { damage: Math.min(12, delivered * 100), type: 'electrical', cause: 'Finite stored charge', energyMJ: delivered });
      }
      p.heatMJ = (p.heatMJ || 0) + energy;
    } else if (action === 'crownIgnite') {
      // The burnt crown is original body tissue, not newly spawned fuel.
      Life.changeMass(a, -pending.paid.crownKg); Habitat.put(p, { fuelKg: pending.paid.crownKg });
      if (!Habitat.burn(p, a, pending.paid.crownKg, at, e => ctx.native?.(a.mapCell, e))) return false;
      a.life.display = { kind: 'crownFire', until: at + 1 };
      for (const t of radialTargets(a, null, 1.5, ctx)) ctx.strike?.(a, t, { damage: 2, type: 'heat', cause: 'Contact crown fire' });
    } else if (action === 'frostTrail' || action === 'iceWake') {
      if (!Habitat.freeze(p, a, action === 'iceWake' ? Math.min(20, p.resources.waterL || 0) : .01, at, e => ctx.native?.(a.mapCell, e))) return false;
      a.life.lastTrailDistanceM = a.bodyPhysics.distanceM;
    } else if (action === 'iceCache') {
      if (!target || target.status !== 'dead' || !same(target.mapCell, a.mapCell) && distance(a, target, ctx) > 2
        || !Habitat.freeze(p, a, .1, at)) return false;
      Predation.decay(target, at, ctx);
      Predation.remains(target, at).frozenUntil = at + 3600 / Math.max(1, (p.temperatureC || 0) / 10);
    } else if (action === 'radiantFan') {
      ctx.strike?.(a, target, { damage: 6, type: 'heat', cause: 'Radiant fan flash', radiant: true, energyMJ: 2.4 });
      if (!resist(target, a, action, at, ctx)) condition(target, 'paralysis', a.id, at, 3);
    } else if (action === 'laneInterference') {
      if (target?.speciesId !== 'beast:storm-kite') return false;
      condition(target, 'misled', a.id, at, 6, 1); target.life.disturbedUntil = at + 12;
      const charge = Math.min(.1, target.life.energy.chargeMJ); target.life.energy.chargeMJ -= charge;
      p.heatMJ = (p.heatMJ || 0) + charge;
    } else if (action === 'corpseLight') {
      Life.changeMass(a, -pending.paid.lightKg); Habitat.put(p, { airborneCarbonKg: pending.paid.lightKg });
      a.life.display = { kind: 'corpseLight', startedAt: at, until: at + 10, originalMassKg: pending.paid.lightKg };
    } else if (action === 'pressurePulse') {
      const attenuation = Math.max(0, 1 - distance(a, target, ctx) / 10);
      ctx.strike?.(a, target, { damage: 12 * attenuation, type: 'physical', cause: 'Connected deep-water pressure pulse' });
    } else if (action === 'etherLure') {
      if (!resist(target, a, action, at, ctx)) condition(target, 'etherLure', a.id, at, 8);
    } else return false;
    ctx.changed?.(a.mapCell, p); return true;
  }
  function advanceAction(a, at, seconds, ctx) {
    const pending = a.life.pending; if (!pending) return false;
    const d = definitions[pending.action], target = (ctx.actors || []).find(t => t.id === pending.targetId);
    if (!conscious(a, at) || !permitted(a, { ...ctx, actionId: pending.action }) || ctx.incapacitated || a.magicSuppressed && d.mana || d.parts && Bodies.wounded(a, d.parts) >= .65
      || !d.mobile && !same(pending.from, a.mapCell)) { interrupt(a, at, 'Bodily/positional interruption'); return true; }
    if (pending.action === 'charge') ctx.chargeStep?.(a, target, at);
    if (pending.action === 'focusPinions') pending.capturedSunMJ += Math.max(0, ctx.sunlightFluxMJ || 0) * Math.min(seconds, Math.max(0, pending.dueAt - Math.max(pending.startedAt, at - seconds)))
      * a.bodyPhysics.dimensions.lengthM * a.bodyPhysics.dimensions.widthM;
    if (at < pending.dueAt) return true;
    const targetValid = !d.range || pending.action === 'blink' || target && (alive(target) || pending.action === 'iceCache')
      && distance(a, target, ctx) <= d.range && ctx.effectLine?.(a, target, pending.action) && !ctx.protectedTarget?.(a, target);
    const ok = targetValid && release(a, pending, target, at, ctx);
    a.life.pending = null; a.life.cooldowns[pending.action] = at + (pending.action === 'blink' ? 8 : 12);
    event(a, ok ? 'released' : 'failedRelease', at, { action: pending.action }); return true;
  }
  function receiveRadiance(a, emission, at, ctx) {
    if (a.speciesId !== 'beast:glasswing-roc' || !Life.valid(a) || !alive(a) || !emission?.id || !(emission.energyMJ > 0)
      || emission.kind !== 'radiant' || !ctx.incomingLine || ctx.focusAngle <= 0 || Bodies.wounded(a, /wing/) >= .5 || a.life.energy.focus < 1) return 0;
    a.life.radianceReceipts ||= []; if (a.life.radianceReceipts.includes(emission.id)) return 0;
    const captured = emission.energyMJ * .5;
    a.life.energy.focus -= 1; emission.energyMJ -= captured; a.life.radianceReceipts.push(emission.id);
    a.life.capturedRadiance = { sourceId: emission.id, energyMJ: captured, until: at + 3 };
    return captured;
  }
  function absorb(a, damage, type, at, ctx) {
    if (!Life.valid(a) || !(a.life.armourKg > 0)) return damage;
    const suitable = type === 'physical' || a.speciesId === 'beast:burrowing-furnace' && type === 'heat';
    if (!suitable) return damage;
    const reduction = Math.min(damage * .35, a.life.armourKg * 10), spent = reduction / 10;
    a.life.armourKg -= spent; Life.changeMass(a, -spent); ctx.waste?.(a, 'shedArmourKg', spent);
    return damage - reduction;
  }
  const diets = {
    mineralGrazer: ['forageKg', 'organicKg'], herbivore: ['forageKg', 'bloomKg'],
    carnivore: ['meatKg'], apexPredator: ['meatKg'], scavenger: ['meatKg', 'carrionKg'],
    omnivore: ['forageKg', 'meatKg', 'detritusKg'], detritivore: ['detritusKg'], filterFeeder: ['planktonKg'],
    manaFilterFeeder: ['organicKg'], energyFeeder: ['organicKg']
  };
  function foodKeys(a) {
    const p = Life.profile(a), diet = requireDiet(a);
    if (a.speciesId === 'beast:ironroot-colossus') return ['organicKg'];
    if (a.speciesId === 'beast:burrowing-furnace') return [];
    return diets[diet] || (p.foodKgDay > 0 ? ['forageKg'] : []);
  }
  function requireDiet(a) { return ({ 'beast:glasswing-roc': 'apexPredator', 'beast:nullmaw-stalker': 'apexPredator', 'beast:abyssal-bell': 'apexPredator',
    'beast:brine-cathedral': 'filterFeeder', 'beast:carrion-lantern': 'scavenger', 'beast:ley-manta': 'manaFilterFeeder', 'beast:storm-kite': 'energyFeeder',
    'beast:candlecap-myriapod': 'detritivore', 'beast:thunderback-grazer': 'herbivore', 'beast:gravebloom-elk': 'herbivore', 'beast:dreaming-tortoise': 'herbivore',
    'beast:mire-choir': 'omnivore', 'beast:mirror-ape': 'omnivore', 'beast:rivercoil': 'omnivore', 'beast:ember-ant': 'omnivore',
    'beast:ashhorn-behemoth': 'mineralGrazer' })[a.speciesId] || 'carnivore'; }
  function feed(a, seconds, at, ctx) {
    const p = ctx.patch(a.mapCell), l = a.life, lp = Life.profile(a); if (!p || p.protected) return false;
    if (p.oxygen === false || a.speciesId === 'beast:brine-cathedral' && !(p.waterDepthM > 0)) return false;
    let fed = 0;
    const towers = a.speciesId === 'beast:brine-cathedral' ? Object.entries(a.bodyPhysics.parts).filter(([k]) => /feeding tower/.test(k)).reduce((n, [, health]) => n + health / 100, 0) / 4 : 1;
    const ceiling = Math.max(lp.foodKgDay, a.bodyPhysics.massKg * .001) * seconds / 600 * towers;
    for (const key of foodKeys(a)) {
      const amount = Math.min(p.resources[key] || 0, ceiling, Math.max(0, l.foodCapacityKg - l.stores.foodKg));
      if (amount > 0 && Habitat.take(p, { [key]: amount })) {
        let food = amount;
        if (a.speciesId === 'beast:carrion-lantern' && ['meatKg', 'carrionKg'].includes(key)) { const light = amount * .05; l.energy.lightKg += light; Life.changeMass(a, light); food -= light; }
        Life.feed(a, 'foodKg', food); fed += amount;
      }
    }
    const water = Math.min(p.resources.waterL || 0, lp.waterLDay * seconds / 600, Math.max(0, l.waterCapacityL - l.stores.waterL));
    if (water > 0 && Habitat.take(p, { waterL: water })) { Life.feed(a, 'waterL', water); fed += water; }
    const mineral = Math.min(p.resources.mineralsKg || 0, lp.mineralsKgDay * seconds / 600,
      Math.max(0, Math.max(lp.mineralsKgDay * 10, lp.newbornKg || 0) - l.stores.mineralsKg));
    if (mineral > 0 && Habitat.take(p, { mineralsKg: mineral })) { Life.feed(a, 'mineralsKg', mineral); fed += mineral; }
    if (lp.otherDay > 0) {
      const kind = a.speciesId === 'beast:burrowing-furnace' ? 'heatMJ' : 'chargeMJ', stock = kind === 'heatMJ' ? 'geologicalHeatMJ' : 'electricalMJ';
      const amount = Math.min(p.resources[stock] || 0, lp.otherDay * seconds / 600, Math.max(0, l.energyCapacity[kind] - l.energy[kind]));
      if (amount > 0 && Habitat.take(p, { [stock]: amount })) { l.energy[kind] += amount; fed += amount; }
    }
    if (a.speciesId === 'beast:ley-manta') {
      const capacity = Life.profile(a).manaCapacity * Math.min(1, a.bodyPhysics.massKg / lp.adultKg);
      const amount = Math.min(p.resources.excessMana || 0, seconds, Math.max(0, capacity - a.bodyPhysics.mana));
      if (amount > 0 && Habitat.take(p, { excessMana: amount })) { a.bodyPhysics.mana += amount; fed += amount; Habitat.ledger(p, a, seconds, Math.min(1, amount / Math.max(.001, seconds)), ['arcaneStability'], 'filterMana'); }
    }
    if (fed) {
      if (a.speciesId === 'beast:ember-ant') a.life.lastForageCell = copy(a.mapCell);
      if (a.speciesId === 'beast:brine-cathedral') {
        p.shelterBodies ||= {}; p.shelterBodies[a.id] = Bodies.cells(a, a.mapCell, ctx.tileSizeM || 1).length * (ctx.tileSizeM || 1) ** 2 * towers;
        Habitat.ledger(p, a, seconds, towers, ['wetlandReefHabitat', 'renewableBiomass'], 'filterPlankton');
      }
      Habitat.receipt(p, a, 'feeding', at, { transferred: fed });
      event(a, 'fed', at, { transferred: fed }); ctx.changed?.(a.mapCell, p);
    }
    return fed > 0;
  }
  function consumeRemains(a, corpse, seconds, at, ctx) {
    if (!(seconds > 0) || !conscious(a, at) || !ctx.alive || !ctx.local
      || !permitted(a, { ...ctx, actionId: 'feed' })
      || !corpse?.life || corpse.status !== 'dead' || distance(a, corpse, ctx) > 2
      || ctx.protectedTarget?.(a, corpse) || !Predation.sensed(a, corpse, ctx, true) || !ctx.effectLine?.(a, corpse, 'feed')) return false;
    if (!foodKeys(a).some(k => ['meatKg', 'carrionKg'].includes(k))) return false;
    if (corpse.speciesId === 'beast:ironroot-colossus') return false;
    Predation.decay(corpse, at, ctx);
    const r = Predation.remains(corpse, at);
    r.feedingAt ||= {};
    // A second update/read at the same instant cannot pay the same feeding
    // interval twice. Partial elapsed feeding cannot borrow future throughput.
    const elapsed = Math.min(seconds, Math.max(0, at - Math.max(r.feedingAt[a.id] ?? at - seconds,
      a.life.remainsFedAt ?? at - seconds, corpse.diedAt ?? at - seconds)));
    r.feedingAt[a.id] = Math.max(at, r.feedingAt[a.id] || 0);
    a.life.remainsFedAt = Math.max(at, a.life.remainsFedAt || 0);
    const amount = Math.min(r.edibleKg, Life.profile(a).foodKgDay * elapsed / 600, a.life.foodCapacityKg - a.life.stores.foodKg);
    if (!(amount > 0)) return false;
    r.edibleKg -= amount; r.consumedKg += amount; Life.changeMass(corpse, -amount);
    let food = amount;
    if (a.speciesId === 'beast:carrion-lantern') { const light = amount * .05; food -= light; a.life.energy.lightKg += light; Life.changeMass(a, light); }
    Life.feed(a, 'foodKg', food); event(a, 'fedFromRemains', at, { corpseId: corpse.id, kg: amount }); return true;
  }
  function regenerate(a, seconds, at, ctx) {
    const part = Object.keys(a.life.heads).find(k => a.life.heads[k].lost); if (!part || !alive(a)) return false;
    const h = a.life.heads[part], needed = Life.profile(a).adultKg * .01, rate = needed / DAY;
    const kg = Math.min(needed - (h.regrowth || 0), seconds * rate, a.life.stores.foodKg * .5, a.bodyPhysics.mana / 2);
    if (!(kg > 0) || !Life.payMatter(a, kg * 2)) return false;
    a.bodyPhysics.mana -= kg * 2; a.bodyPhysics.spentMana += kg * 2; h.regrowth = (h.regrowth || 0) + kg;
    Life.changeMass(a, kg); ctx.waste?.(a, 'regenerationWasteKg', kg);
    if (h.regrowth + 1e-8 >= needed) { h.lost = false; h.generation++; h.memory = []; a.bodyPhysics.parts[part] = 100; event(a, 'headRegrown', at, { part, generation: h.generation }); }
    return true;
  }
  function advanceVitals(a, at, seconds, ctx) {
    if (!Life.valid(a)) return false;
    if (!ctx.alive) return false;
    if (!ctx.local || !a.life.wasLocal) {
      // Absence is not deferred local work or an accumulated corpse-decay bill.
      a.life.physicalAt = at;
      if (a.life.remains) a.life.remains.lastAt = at;
      Life.advance(a, at, ctx); a.life.wasLocal = Boolean(ctx.local); return false;
    }
    const p = ctx.patch?.(a.mapCell);
    const physicalSeconds = Math.max(0, at - (a.life.physicalAt ?? a.life.lastAt)); a.life.physicalAt = at;
    if (a.life.energy.heatMJ > 0 && physicalSeconds > 0) {
      const heat = a.life.energy.heatMJ * -Math.expm1(-physicalSeconds / DAY);
      a.life.energy.heatMJ -= heat; ctx.native?.(a.mapCell, { kind: 'heat', heatMJ: heat });
    }
    if (p) Habitat.thaw(p, at, e => ctx.native?.(a.mapCell, e));
    if (p) Habitat.advanceBlooms(p, at);
    if (a.life.capturedRadiance?.until <= at) a.life.capturedRadiance = null;
    if (a.status === 'dead') {
      if (a.life.reproduction && !a.life.reproduction.disposedAt) {
        const r = a.life.reproduction;
        ctx.waste?.(a, 'failedRecruitmentKg', Math.max(0, r.investedKg - Life.profile(a).newbornKg * r.emitted.length));
        a.life.reproduction.disposedAt = at;
      }
      Predation.decay(a, at, ctx);
      return false;
    }
    const resting = ['rest', 'dreamWeather'].includes(a.life.activity), travelling = Boolean(a.bodyPhysics.motion || a.climbing && a.climbing.mode !== 'perched');
    const changed = Life.advance(a, at, { ...ctx, resting, travelling });
    if (!changed) return false;
    const needs = Life.demand(a, seconds, travelling), lp = Life.profile(a);
    if (Life.eligible(a) && !a.life.reproduction) a.life.opportunities = Math.min(1, a.life.opportunities + lp.attempts365 * seconds / (365 * DAY));
    if (lp.otherDay > 0) {
      const k = a.speciesId === 'beast:burrowing-furnace' ? 'heatMJ' : 'chargeMJ', used = Math.min(a.life.energy[k], needs.other);
      a.life.energy[k] -= used; if (used < needs.other) a.life.energyStarved = true;
    }
    if (p?.oxygen === false) ctx.damage?.(a, seconds / 60, 'Actual oxygen shortage');
    if (p?.waterDepthM > 0 && -Bodies.height(a) > Bodies.profiles[a.speciesId].depthToleranceM) {
      const excess = -Bodies.height(a) - Bodies.profiles[a.speciesId].depthToleranceM;
      ctx.damage?.(a, excess / 10 * seconds / 60, 'Actual crushing pressure');
      a.life.pressureDangerAt = at;
    }
    if (p && Number.isFinite(p.temperatureC) && (p.temperatureC < lp.minC || p.temperatureC > lp.maxC)) ctx.damage?.(a, seconds / 600, 'Unsuitable physical temperature');
    if (resting && a.life.stores.fatKg + a.life.stores.foodKg > 0) a.life.energy.focus = Math.min(a.life.energyCapacity.focus, a.life.energy.focus + seconds / 60);
    if (resting && a.speciesId !== 'beast:mirror-ape' && lp.manaCapacity > a.bodyPhysics.mana && a.life.stores.foodKg > 0) {
      const units = Math.min(lp.manaCapacity - a.bodyPhysics.mana, seconds / 10, a.life.stores.foodKg / .01);
      if (Life.payMatter(a, units * .01)) { a.bodyPhysics.mana += units; ctx.waste?.(a, 'metabolicWasteKg', units * .01); }
    }
    if (resting && a.life.energyCapacity.heatMJ > a.life.energy.heatMJ && a.life.stores.foodKg > 0) {
      const kg = Math.min(a.life.stores.foodKg, seconds * .001, (a.life.energyCapacity.heatMJ - a.life.energy.heatMJ) / 18);
      if (Life.payMatter(a, kg)) { a.life.energy.heatMJ += kg * 18; ctx.waste?.(a, 'metabolicWasteKg', kg); }
    }
    if (a.speciesId === 'beast:storm-kite' && p?.wind && Math.hypot(p.wind.x, p.wind.y) < 1) {
      a.life.disturbedUntil = at + 30;
      if (Bodies.height(a) > 0 && a.bodyPhysics.mode === 'flight') { a.bodyPhysics.mode = 'landing'; a.bodyPhysics.motion = null; }
    }
    if (a.speciesId === 'beast:ember-ant' && a.life.colonyId && p && a.life.lastForageCell) {
      if (a.life.previousTrailCell && !same(a.life.previousTrailCell, a.mapCell)) p.chemicalTrail = {
        colonyId: a.life.colonyId, emitterId: a.id, nextCell: copy(a.life.previousTrailCell), until: at + 600 };
      a.life.previousTrailCell = copy(a.mapCell);
      if (p.waterDepthM > .01 || p.wetness > .8) p.chemicalTrail = null;
    }
    if (a.life.display?.until > at) for (const t of ctx.actors || []) if (t.id !== a.id && alive(t) && distance(a, t, ctx) <= 6
      && ctx.lightAt?.(t.mapCell) < 30 && ctx.effectLine?.(a, t, 'corpseLight') && ctx.vulnerable?.(t)) condition(t, 'misled', a.id, at, 3);
    return true;
  }
  function step(a, decision, target, at, seconds, ctx) {
    if (!Life.valid(a) || !alive(a) || !ctx.alive || !ctx.local || !(seconds > 0) || a.life.actedAt >= at) return false;
    a.life.actedAt = at;
    if (a.life.pending) { a.life.activity = 'preparing'; return advanceAction(a, at, seconds, ctx); }
    if (a.life.chorusUntil > at) { a.life.activity = 'chorusSupport'; return true; }
    if (!conscious(a, at) || ctx.incapacitated) return false;
    if (!a.life.will) { a.life.activity = 'awaitingReceivedOrder'; return true; }
    if (a.spellImitation?.pending || a.climbing && a.climbing.mode !== 'perched') return false;
    const seen = observe(a, at, ctx), actions = capabilities[a.speciesId], p = ctx.patch(a.mapCell);
    packContact(a, at, ctx);
    const danger = target && decision?.behavior === 'pursue';
    if (!danger && (a.bodyPhysics.stamina < 100 || a.life.activity === 'rest' && a.bodyPhysics.stamina < 250)) { a.life.activity = 'rest'; return true; }
    if (!p) return false;
    const lure = activeConditions(a, at).find(effect => effect.kind === 'etherLure');
    const source = lure && (ctx.actors || []).find(t => t.id === lure.from && alive(t));
    if (a.bodyPhysics.mode === 'swimming' && (!a.bodyPhysics.motion || a.life.pressureDangerAt && at - a.life.pressureDangerAt <= 10 && a.bodyPhysics.motion.transition?.dive)) {
      if (a.life.pressureDangerAt && at - a.life.pressureDangerAt <= 10) {
        const safe = -Math.min(Bodies.profiles[a.speciesId].depthToleranceM, p.waterDepthM);
        a.bodyPhysics.motion = null;
        if (Bodies.dive(a, Math.min(-a.bodyPhysics.dimensions.heightM, safe), ctx).ok) {
          a.life.activity = 'escapePressure'; Bodies.advance(a, at, ctx); return true;
        }
      } else if (source && ['hearing', 'pressure', 'sight'].some(channel => canSense(a, source, channel, ctx))) {
        decision.behavior = 'investigate'; decision.goal = copy(source.mapCell);
        if (distance(a, source, ctx) <= 4 && Bodies.height(source) < Bodies.height(a)
          && Bodies.dive(a, Bodies.height(source), ctx).ok) {
          a.life.activity = 'investigateLure'; Bodies.advance(a, at, ctx); return true;
        }
      }
    }
    if (!danger && a.speciesId === 'beast:ember-ant' && p.chemicalTrail?.colonyId === a.life.colonyId && p.chemicalTrail.until > at
      && !same(p.chemicalTrail.nextCell, a.mapCell) && !Bodies.habitatReason(a, p.chemicalTrail.nextCell, a.bodyPhysics.mode, Bodies.height(a), ctx)) {
      decision.behavior = 'investigate'; decision.goal = copy(p.chemicalTrail.nextCell);
    }
    if (!danger) {
      const corpse = Predation.carcass(a, at, { ...ctx, foodKeys });
      if (corpse && actions.includes('iceCache') && !(corpse.life?.remains?.frozenUntil > at)
        && begin(a, 'iceCache', corpse, at, ctx).ok) return true;
      if (corpse && consumeRemains(a, corpse, seconds, at, ctx)) { a.life.activity = 'feed'; return true; }
      if (corpse) {
        if (['flight', 'levitation'].includes(a.bodyPhysics.mode) && Bodies.height(a) > Bodies.height(corpse) + 2
          && Math.hypot(a.mapCell.x - corpse.mapCell.x, a.mapCell.y - corpse.mapCell.y) * (ctx.tileSizeM || 1) <= 2) {
          a.bodyPhysics.mode = 'landing'; a.bodyPhysics.motion = null; a.bodyPhysics.goal = null;
          a.life.activity = 'approachCarrion'; return false;
        }
        decision.behavior = 'investigate'; decision.goal = copy(corpse.mapCell);
        a.bodyPhysics.goal = copy(corpse.mapCell);
        decision.carcassId = corpse.id; a.life.activity = 'seekCarrion'; return false;
      }
      const lp = Life.profile(a), hungry = a.life.stores.fatKg < a.life.fatCapacityKg * .5 && a.life.stores.foodKg < lp.foodKgDay * .25,
        thirsty = lp.waterLDay > 0 && a.life.stores.waterL < a.life.waterCapacityL * .5;
      const selectiveFeeder = ['beast:ley-manta', 'beast:brine-cathedral', 'beast:burrowing-furnace'].includes(a.speciesId);
      if ((hungry || thirsty || selectiveFeeder) && feed(a, seconds, at, ctx)) { a.life.activity = 'feed'; return true; }
      if (a.bodyPhysics.stamina < 100 || a.life.activity === 'rest' && a.bodyPhysics.stamina < 250) { a.life.activity = 'rest'; return true; }
      if (actions.includes('regenerateHead') && regenerate(a, seconds, at, ctx)) { a.life.activity = 'regenerate'; return true; }
      if (actions.includes('toolUse') && ctx.acquireTool?.(a)) { a.life.activity = 'handleTool'; return true; }
      if (a.life.opportunities >= 1 && !a.life.reproduction) {
        const mate = seen.find(t => t.speciesId === a.speciesId && t.id !== a.id);
        if (Life.beginReproduction(a, mate, at, ctx)) { a.life.activity = 'breed'; return true; }
      }
      const work = actions.find(id => ['rootStabilize', 'tendWetland', 'cultivateReef', 'buildDam', 'growBlooms', 'buildFurnace', 'dreamWeather'].includes(id));
      if (work && a.life.willing) {
        if (work === 'rootStabilize' && a.bodyPhysics.mode !== 'rooting') Bodies.request(a, 'rooting', null, ctx);
        const usable = Math.min(seconds, a.bodyPhysics.stamina * 10);
        const cost = work === 'dreamWeather' ? usable / DAY * definitions[work].manaPerDay : 0;
        if (a.bodyPhysics.mana >= cost && !(a.life.energyStarved && ['rootStabilize', 'dreamWeather'].includes(work))) {
          const result = Habitat.work(a, work, usable, at, { ...ctx, healthFactor: a.health / a.maxHealth });
          if (result) { pay(a, { stamina: result.seconds * .1, mana: cost }); a.life.activity = work; event(a, 'ecologicalWork', at, { action: work, effectId: result.id }); return true; }
        }
      }
    }
    const chosen = danger ? actions.find(id => ['charge', 'focusPinions', 'chorus', 'discharge', 'radiantFan', 'pressurePulse', 'etherLure', 'laneInterference'].includes(id)
      && !(a.life.cooldowns[id] > at) && affordable(a, definitions[id]))
      : actions.find(id => ['hornVitrify', 'hotTunnel', 'iceWake', 'frostTrail', 'corpseLight'].includes(id)
        && (!(id === 'frostTrail') || a.bodyPhysics.distanceM > (a.life.lastTrailDistanceM || 0))
        && !(a.life.cooldowns[id] > at) && affordable(a, definitions[id]));
    if (chosen && begin(a, chosen, target, at, ctx).ok) { a.life.activity = 'preparing'; return true; }
    if (danger && actions.includes('blink') && target) {
      const dest = ctx.blinkDestination?.(a, target);
      if (dest && begin(a, 'blink', { mapCell: dest }, at, ctx).ok) { a.life.activity = 'preparing'; return true; }
    }
    // Predation and ecological antagonism require actual sensed prey, compatible
    // body scale and shared medium, never a species-wide location oracle.
    const prey = huntingTarget(a, at, ctx);
    if (!danger && prey) { decision.behavior = 'pursue'; decision.goal = copy(prey.mapCell); decision.preyId = prey.id; a.life.activity = 'hunt'; }
    else a.life.activity = a.life.hunt && target?.id === a.life.hunt.targetId && a.life.hunt.endedAt == null ? 'hunt' : decision?.behavior || 'idle';
    return false;
  }
  function publicEvent(a) {
    if (!Life.valid(a)) return null;
    const e = [...a.life.events].reverse().find(e => ['released', 'ecologicalWork', 'headRegrown', 'fedFromRemains'].includes(e.kind));
    return e ? { at: e.at, kind: e.kind, action: e.action && definitions[e.action]?.label, part: e.part } : null;
  }
  function huntingTarget(a, at, ctx) {
    return Predation.huntingTarget(a, at, { ...ctx, foodKeys, canHunt: body => capabilities[body.speciesId]?.includes('hunt'),
      incapacitated: !conscious(a, at) || ctx.incapacitated });
  }
  return { definitions, capabilities, attach, mana, affordable, pay, activeConditions, condition, modifiers, canSense, observe, biologicalOpponents, huntingTarget,
    interrupt, begin, advanceAction, receiveRadiance, absorb, foodKeys, feed, consumeRemains, regenerate, advanceVitals, step, publicEvent };
});
