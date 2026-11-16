(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./strategic-beast-ecology') : root.HelixStrategicBeastEcology,
    typeof module === 'object' && module.exports ? require('./creature-biology') : root.HelixCreatureBiology);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixBeastBodies = api;
})(globalThis, function (Ecology, Biology) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const key = p => `${p.x},${p.y},${p.z}`;
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
  const finite = n => Number.isFinite(n) && n >= 0;
  const cell = p => p && ['x', 'y', 'z'].every(k => Number.isInteger(p[k]));
  // Authored reference dimensions, not new populations or abilities. Existing
  // recorded dimensions/mass are never overwritten on load or reattachment.
  // suffix, length/width/height m, kg, m/s, anatomy, wing span m (zero if none).
  const definitions = [
    ['ashhorn-behemoth', 35, 14, 14, 400000, .8, 'quadruped', 0],
    ['glasswing-roc', 8, 3, 4, 30000, 6, 'winged', 20],
    ['mire-choir', 1, .7, 1.5, 60, .6, 'amphibian', 0],
    ['nullmaw-stalker', 3, 1.2, 1.3, 500, .6, 'burrower', 0],
    ['thunderback-grazer', 5, 2.5, 3, 2500, .7, 'quadruped', 0],
    ['candlecap-myriapod', .5, .2, .15, .3, .1, 'manyLegged', 0],
    ['ironroot-colossus', 18, 14, 30, 300000, .15, 'rooted', 0],
    ['gloam-prowler', 2.5, 1, 1.2, 250, .8, 'quadruped', 0],
    ['rimefang-pack', 1, .7, 1.1, 120, 1 / 1.5, 'quadruped', 0],
    ['sunspine-basilisk', 3, 1.2, 1, 400, .5, 'burrower', 0],
    ['ley-manta', 4, 5, .8, 2000, 2, 'finned', 0],
    ['carrion-lantern', 1.4, 1.4, 2, 30, .5, 'aerostat', 0],
    ['brine-cathedral', 90, 70, 20, 2000000, .1, 'superorganism', 0],
    ['reef-wyrm', 25, 4, 4, 50000, 1, 'serpentine', 0],
    ['abyssal-bell', 18, 18, 16, 80000, .5, 'bell', 0],
    ['frostwake-leviathan', 40, 10, 10, 200000, 1.5, 'finned', 0],
    ['marsh-hydra', 5, 2, 2.5, 1500, .6, 'hydra', 0],
    ['rivercoil', 14, 3, 3, 40000, 1, 'amphibian', 0],
    ['ember-ant', .05, .02, .02, .001, .04, 'insect', 0],
    ['dreaming-tortoise', 15, 12, 8, 100000, .15, 'quadruped', 0],
    ['mirror-ape', .8, .65, 1.8, 90, .5, 'primate', 0],
    ['gravebloom-elk', 2, 1, 2, 350, .5, 'quadruped', 0],
    ['storm-kite', .2, .1, .1, .08, 1, 'winged', .6],
    ['burrowing-furnace', 6, 2, 2, 6000, .1, 'burrower', 0]
  ];
  const anatomy = {
    quadruped: ['head', 'torso', 'left foreleg', 'right foreleg', 'left hindleg', 'right hindleg'],
    winged: ['head', 'torso', 'left wing', 'right wing', 'left leg', 'right leg'],
    amphibian: ['head', 'torso', 'left forelimb', 'right forelimb', 'left hindlimb', 'right hindlimb', 'tail'],
    burrower: ['head', 'torso', 'left digging limb', 'right digging limb', 'tail'],
    manyLegged: ['head', 'torso', 'left leg bank', 'right leg bank', 'fungal crown'],
    rooted: ['crown', 'trunk', 'left limb', 'right limb', 'root bank'],
    finned: ['head', 'torso', 'left fin', 'right fin', 'tail'],
    aerostat: ['feeding organs', 'bladder', 'membrane', 'buoyancy organs'],
    superorganism: ['core', 'feeding tower 1', 'feeding tower 2', 'feeding tower 3', 'feeding tower 4', 'reef base'],
    serpentine: ['head', 'forebody', 'midbody', 'tail'],
    bell: ['bell', 'feeding rim', 'pressure organs'],
    hydra: ['head 1', 'head 2', 'head 3', 'torso', 'left leg bank', 'right leg bank', 'tail'],
    insect: ['head', 'thorax', 'abdomen', 'left leg bank', 'right leg bank', 'antennae'],
    primate: ['head', 'torso', 'left arm', 'right arm', 'left hand', 'right hand', 'left leg', 'right leg']
  };
  const profiles = Object.fromEntries(definitions.map(([suffix, lengthM, widthM, heightM, massKg, speed, form, wingSpanM]) => {
    const species = Ecology.BEAST_SPECIES.find(s => s.id === `beast:${suffix}`);
    if (!species) throw Error(`Unknown beast body ${suffix}`);
    return [species.id, Object.freeze({ id: species.id, name: species.name, lengthM, widthM, heightM, massKg, speed, form, wingSpanM,
      modes: species.movementModes, organization: species.socialPattern, parts: Object.freeze([...anatomy[form],
        ...(suffix === 'sunspine-basilisk' ? ['radiant fan'] : suffix === 'ashhorn-behemoth' ? ['left horn', 'right horn'] : [])]),
      sightM: suffix === 'glasswing-roc' ? 80 : suffix === 'nullmaw-stalker' ? 5 : 12,
      hearingM: 16, scentM: suffix === 'carrion-lantern' ? 40 : 12,
      vibrationM: ['burrower', 'manyLegged', 'rooted', 'amphibian', 'quadruped'].includes(form) ? 6 : 0,
      pressureM: form === 'bell' ? 30 : 0, manaSenseM: suffix === 'ley-manta' ? 20 : 0,
      stamina: 300, mana: suffix === 'mirror-ape' ? 0 : Biology.lifecycle[species.id].manaCapacity,
      airCost: form === 'aerostat' ? .1 : 2, levitationCost: .2,
      minWaterDepthM: Math.max(.1, heightM), reachM: Math.max(.25, Math.min(6, lengthM / 3)),
      depthToleranceM: suffix === 'abyssal-bell' ? 12000 : suffix === 'frostwake-leviathan' ? 4000 : suffix === 'reef-wyrm' ? 200 : suffix === 'brine-cathedral' ? 100 : 30 })];
  }));
  function attach(a, at = 0) {
    const p = profiles[a?.speciesId];
    if (!p || a.bodyPhysics) return a;
    a.bodyPhysics = { dimensions: { lengthM: p.lengthM, widthM: p.widthM, heightM: p.heightM, wingSpanM: p.wingSpanM },
      massKg: finite(a.climbMassKg) ? a.climbMassKg : p.massKg, stamina: p.stamina, mana: p.mana,
      parts: Object.fromEntries(p.parts.map(part => [part, 100])), injuries: [],
      mode: p.modes.includes('walking') || p.modes.includes('charging') ? 'walking' : p.modes.includes('swimming') ? 'swimming'
        : p.modes.includes('burrowing') ? 'burrowing' : p.modes.includes('levitation') ? 'levitation' : 'flight',
      altitudeM: p.modes.includes('swimming') && !p.modes.includes('walking') ? -p.heightM
        : p.modes.includes('burrowing') && !p.modes.includes('walking') ? -p.heightM - .2 : 0,
      lastAt: at, wasLocal: true, motion: null, distanceM: 0, spentStamina: 0, spentMana: 0,
      pendingFallM: 0, lastEvent: null, blockedReason: '', rooted: false, heading: 0, turn: null, wingsSpread: false };
    return a;
  }
  function valid(a) {
    const b = a?.bodyPhysics, p = profiles[a?.speciesId];
    return Boolean(b && p && b.dimensions && ['lengthM', 'widthM', 'heightM', 'wingSpanM'].every(k => finite(b.dimensions[k]))
      && b.dimensions.lengthM > 0 && b.dimensions.widthM > 0 && b.dimensions.heightM > 0 && b.massKg > 0 && finite(b.massKg)
      && finite(b.stamina) && finite(b.mana) && Number.isFinite(b.altitudeM) && finite(b.lastAt)
      && p.parts.every(part => finite(b.parts?.[part]) && b.parts[part] <= 100)
      && [0, 1].includes(b.heading ?? 0)
      && (!b.turn || [0, 1].includes(b.turn.to) && finite(b.turn.progress) && b.turn.progress < b.turn.seconds && b.turn.seconds > 0 && !b.motion)
      && ['walking', 'flight', 'levitation', 'swimming', 'drifting', 'burrowing', 'rooting', 'falling', 'landing', 'grounded'].includes(b.mode)
      && (!b.motion || cell(b.motion.from) && cell(b.motion.to) && b.motion.from.z === b.motion.to.z
        && same(a.mapCell, b.motion.from) && finite(b.motion.progressM) && b.motion.progressM < b.motion.distanceM
        && b.motion.distanceM > 0 && (Math.abs(b.motion.to.x - b.motion.from.x) + Math.abs(b.motion.to.y - b.motion.from.y) === 1
          || b.motion.transition?.vertical && same(b.motion.to, b.motion.from))));
  }
  const height = a => a?.bodyPhysics ? valid(a) ? a.bodyPhysics.altitudeM : Infinity : 0;
  const maskCache = new Map();
  function footprint(a, tileSizeM = 1, mode = a?.bodyPhysics?.mode) {
    const b = a?.bodyPhysics, p = profiles[a?.speciesId];
    if (!b || !p || !valid(a)) return { width: 1, height: 1, heightLayers: 1, mask: [{ x: 0, y: 0 }], exclusive: true, loadM2: 1 };
    const d = b.dimensions, spread = (b.wingsSpread || ['flight', 'falling', 'landing'].includes(mode)) && d.wingSpanM > 0;
    const length = Math.ceil(d.lengthM / tileSizeM), breadth = Math.ceil((spread ? Math.max(d.widthM, d.wingSpanM) : d.widthM) / tileSizeM);
    const width = b.turn ? Math.max(length, breadth) : b.heading ? breadth : length;
    const h = b.turn ? width : b.heading ? length : breadth;
    const cacheKey = `${width}:${h}:${p.form}:${Boolean(b.turn)}`;
    let mask = maskCache.get(cacheKey);
    if (!mask) {
      mask = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) {
        if (b.turn || width <= 2 || h <= 2 || ((x + .5 - width / 2) / (width / 2)) ** 2 + ((y + .5 - h / 2) / (h / 2)) ** 2 <= 1.05) mask.push({ x, y });
      }
      maskCache.set(cacheKey, mask);
    }
    return { width, height: h, heightLayers: Math.max(1, Math.ceil(d.heightM / 4)), mask: mask.map(c => ({ ...c })),
      exclusive: true, rotatable: false, loadM2: Math.min(tileSizeM ** 2, b.massKg / 1000 / mask.length) };
  }
  function cells(a, anchor = a.mapCell, tileSizeM = 1, mode) {
    return footprint(a, tileSizeM, mode).mask.map(offset => ({ x: anchor.x + offset.x, y: anchor.y + offset.y, z: anchor.z }));
  }
  function occupied(a, tileSizeM = 1) {
    const current = cells(a, a.mapCell, tileSizeM), next = a.bodyPhysics?.motion && cells(a, a.bodyPhysics.motion.to, tileSizeM);
    return [...new Map([...current, ...(next || [])].map(p => [key(p), p])).values()];
  }
  function wounded(a, pattern) {
    if (!valid(a)) return 1;
    const parts = Object.entries(a.bodyPhysics.parts).filter(([part]) => pattern.test(part));
    return parts.length ? 1 - Math.min(...parts.map(([, health]) => health)) / 100 : 0;
  }
  function capable(a, mode) {
    if (!valid(a) || a.status === 'dead' || a.health <= 0) return false;
    const p = profiles[a.speciesId], b = a.bodyPhysics;
    if (wounded(a, /torso|core|thorax|trunk|^bell$|bladder|forebody/) >= .95) return false;
    if (mode === 'walking' && !(p.modes.includes('walking') || p.modes.includes('charging'))) return false;
    if (mode === 'rooting') return p.modes.includes('rooting') && wounded(a, /root/) < .7;
    if (mode === 'flight') return p.modes.includes('flight') && wounded(a, p.form === 'aerostat' ? /bladder|membrane|buoyancy/ : /wing|fin/) < .6 && (p.form === 'aerostat' || b.stamina > 0);
    if (mode === 'levitation') return p.modes.includes('levitation') && b.mana > 0 && !a.magicSuppressed;
    if (mode === 'swimming') return p.modes.includes('swimming') && wounded(a, /fin|tail|limb|rim/) < .8 && b.stamina > 0;
    if (mode === 'drifting') return p.modes.includes('drifting') && wounded(a, /core|reef base/) < .9;
    if (mode === 'burrowing') return p.modes.includes('burrowing') && wounded(a, /digging|leg/) < .6 && b.stamina > 0;
    return mode === 'walking' && wounded(a, /leg|limb/) < .75 && b.stamina > 0;
  }
  function habitatReason(a, anchor, mode, altitudeM, ctx) {
    if (!valid(a) || !cell(anchor) || anchor.z !== a.mapCell.z) return 'Unsupported body or disconnected map layer';
    const b = a.bodyPhysics, p = profiles[a.speciesId], tileSize = ctx.tileSizeM || 1;
    const cargoKg = ctx.cargoKg?.(a) ?? 0;
    if (!finite(cargoKg) || cargoKg > b.massKg * .25 * (1 - wounded(a, /leg|limb|wing|fin/) * .8)) return 'Actual carried mass exceeds bodily capacity';
    const bodyCells = cells(a, anchor, tileSize, mode);
    for (const part of bodyCells) {
      const t = ctx.terrain(part);
      if (!t || t.known === false) return 'No supported physical terrain';
      if (t.warded || t.protected) return 'Protected physical boundary';
      const low = altitudeM, high = altitudeM + b.dimensions.heightM;
      if (Number.isFinite(t.ceilingM) && high > t.ceilingM) return 'Insufficient overhead clearance';
      if (t.obstacleHeightM > low && (t.obstacleBaseM ?? 0) < high) return 'Solid obstruction in body volume';
      if (ctx.blocked?.(part, low, high, a)) return 'Another body occupies the swept volume';
      if (['walking', 'rooting'].includes(mode)) {
        if (!t.floor || t.solid || (t.waterDepthM || 0) > b.dimensions.heightM * .5) return 'No supported walkable ground';
        if (Number.isFinite(t.supportKg) && t.supportKg < (b.massKg + cargoKg) / bodyCells.length) return 'Ground cannot support actual body load';
      } else if (['swimming', 'drifting'].includes(mode)) {
        if (!(t.waterDepthM >= p.minWaterDepthM) || -low > t.waterDepthM || low > 0) return 'Insufficient connected water/depth';
        if (t.oxygen === false) return 'Unavailable aquatic oxygen';
        if (t.iceThicknessM > 0 && high > -t.iceThicknessM) return 'Solid ice obstructs the surface body volume';
      } else if (mode === 'burrowing') {
        if (!(t.soilDepthM >= b.dimensions.heightM + .2) || t.foundation || t.waterDepthM > 0 || t.oxygen === false) return 'Burrow depth, foundation, flooding or oxygen constraint';
        if (!finite(t.hardness) || t.hardness > 5 || !(t.densityKgM3 > 0)) return 'Unsupported or impenetrable excavation material';
      } else if (mode === 'flight' || mode === 'levitation') {
        if (t.oxygen === false && mode === 'flight') return 'Insufficient flight medium';
        if (low < 0) return 'Air movement cannot pass through ground or water';
      }
    }
    return '';
  }
  function request(a, mode, goal, ctx) {
    if (!capable(a, mode)) return { ok: false, reason: 'Body, injury or finite reserve cannot support that movement' };
    const b = a.bodyPhysics;
    if (b.motion || b.turn) return { ok: false, reason: 'Original motion remains in progress' };
    const altitude = mode === 'swimming' || mode === 'drifting' ? -b.dimensions.heightM : mode === 'burrowing' ? -b.dimensions.heightM - .2
      : ['flight', 'levitation'].includes(mode) ? Math.max(0, b.altitudeM) : 0;
    const reason = habitatReason(a, a.mapCell, mode, altitude, ctx);
    if (reason) return { ok: false, reason };
    if (mode === 'flight' && profiles[a.speciesId].form !== 'aerostat' && !cell(goal)) return { ok: false, reason: 'Winged flight requires forward motion; hovering is not supported' };
    if (goal && (!cell(goal) || goal.z !== a.mapCell.z)) return { ok: false, reason: 'No physically connected movement target' };
    if (b.altitudeM !== altitude && !['flight', 'levitation'].includes(mode)) return { ok: false, reason: 'A change of medium requires a supported physical transition' };
    b.mode = mode; b.goal = goal ? copy(goal) : null; b.rooted = mode === 'rooting';
    b.wingsSpread = mode === 'flight' && b.dimensions.wingSpanM > 0;
    b.blockedReason = ''; return { ok: true };
  }
  function turn(a, heading, ctx) {
    if (!valid(a) || ![0, 1].includes(heading) || heading === (a.bodyPhysics.heading || 0)
      || a.bodyPhysics.motion || a.bodyPhysics.turn || !['walking', 'swimming'].includes(a.bodyPhysics.mode)
      || !capable(a, a.bodyPhysics.mode)) return { ok: false, reason: 'No supported bodily turn' };
    const b = a.bodyPhysics;
    // Reserve the entire swept rectangle, not just the final orientation.
    const candidate = copy(a); candidate.bodyPhysics.turn = { to: heading, progress: 0,
      seconds: Math.max(.5, Math.max(b.dimensions.lengthM, b.dimensions.widthM) / profiles[a.speciesId].speed / 4) };
    const reason = habitatReason(candidate, a.mapCell, b.mode, b.altitudeM, ctx);
    if (reason) return { ok: false, reason };
    b.turn = candidate.bodyPhysics.turn; return { ok: true };
  }
  function transition(a, mode, to, ctx) {
    const b = a?.bodyPhysics, p = profiles[a?.speciesId];
    if (!valid(a) || b.motion || b.turn || !cell(to) || to.z !== a.mapCell.z || b.mode === mode || !capable(a, mode)) return { ok: false, reason: 'No supported physical transition' };
    const distance = Math.abs(to.x - a.mapCell.x) + Math.abs(to.y - a.mapCell.y);
    const vertical = mode === 'burrowing' && b.mode === 'walking' && p.modes.includes('burrowing') && distance === 0;
    const emergence = mode === 'walking' && b.mode === 'burrowing' && distance === 1;
    const shore = ['walking', 'swimming'].includes(mode) && p.modes.includes('walking') && p.modes.includes('swimming') && distance === 1;
    if (!vertical && !emergence && !shore) return { ok: false, reason: 'No supported adjacent shore or tunnel transition' };
    const altitude = mode === 'swimming' ? -b.dimensions.heightM : mode === 'burrowing' ? -b.dimensions.heightM - .2 : 0;
    const reason = habitatReason(a, to, mode, altitude, ctx);
    if (reason) return { ok: false, reason };
    if (vertical && !ctx.excavate) return { ok: false, reason: 'Actual entry excavation is unavailable' };
    b.motion = { from: copy(a.mapCell), to: copy(to), progressM: 0,
      distanceM: vertical ? -altitude : Math.hypot(ctx.tileSizeM || 1, altitude - b.altitudeM),
      transition: { mode, vertical, fromAltitude: b.altitudeM, toAltitude: altitude } };
    return { ok: true };
  }
  function dive(a, altitudeM, ctx) {
    if (!valid(a) || !Number.isFinite(altitudeM) || a.bodyPhysics.mode !== 'swimming' || a.bodyPhysics.motion || a.bodyPhysics.turn
      || !capable(a, 'swimming') || altitudeM === a.bodyPhysics.altitudeM || altitudeM + a.bodyPhysics.dimensions.heightM > 0) return { ok: false, reason: 'No supported swimming depth transition' };
    const reason = habitatReason(a, a.mapCell, 'swimming', altitudeM, ctx);
    if (reason) return { ok: false, reason };
    const b = a.bodyPhysics;
    b.motion = { from: copy(a.mapCell), to: copy(a.mapCell), progressM: 0, distanceM: Math.abs(altitudeM - b.altitudeM),
      transition: { mode: 'swimming', vertical: true, dive: true, fromAltitude: b.altitudeM, toAltitude: altitudeM } };
    return { ok: true };
  }
  function breakIce(a, at, ctx) {
    if (!valid(a) || a.status === 'dead' || !profiles[a.speciesId].modes.includes('iceBreaking') || !ctx.breakIce) return { ok: false, reason: 'No actual ice-breaking body or terrain consumer' };
    const b = a.bodyPhysics, footprint = cells(a, a.mapCell, ctx.tileSizeM || 1);
    const ice = footprint.map(c => ({ cell: c, t: ctx.terrain(c) })).filter(p => p.t?.iceThicknessM > 0);
    if (!ice.length) return { ok: false, reason: 'No actual contacting ice' };
    if (ice.some(({ t }) => t.protected || t.warded || !(t.iceDensityKgM3 > 0))) return { ok: false, reason: 'Unsupported or protected ice source' };
    const cost = ice.reduce((n, { t }) => n + t.iceThicknessM * 2, 0);
    if (b.stamina < cost || wounded(a, /head|torso/) >= .7) return { ok: false, reason: 'Insufficient actual body/effort' };
    let kg = 0;
    for (const { cell, t } of ice) {
      const mass = ctx.breakIce(a, cell, t.iceThicknessM * (ctx.tileSizeM || 1) ** 2, t);
      if (!finite(mass)) return { ok: false, reason: 'Original ice could not be broken' };
      kg += mass;
    }
    b.stamina -= cost; b.spentStamina += cost; b.lastEvent = { kind: 'iceBroken', at, kg };
    return { ok: true, kg };
  }
  function damagePart(a, part, amount, at) {
    if (!valid(a) || !Object.hasOwn(a.bodyPhysics.parts, part) || !finite(amount) || amount === 0 || a.status === 'dead') return false;
    const b = a.bodyPhysics, used = Math.min(b.parts[part], amount);
    b.parts[part] -= used; b.injuries.push({ part, amount: used, at });
    if (['flight', 'levitation'].includes(b.mode) && !capable(a, b.mode)) {
      b.pendingFallM = Math.max(b.pendingFallM, b.altitudeM); b.mode = 'falling'; b.motion = null; b.turn = null;
    }
    return true;
  }
  function next(a, ctx) {
    const b = a.bodyPhysics, p = profiles[a.speciesId], from = a.mapCell, t = ctx.terrain(from);
    let choices;
    if (b.mode === 'drifting' || b.mode === 'flight' && p.form === 'aerostat') {
      const flow = b.mode === 'drifting' ? t?.current : t?.wind;
      if (!flow || Math.hypot(flow.x, flow.y) <= .001) return null;
      choices = [{ x: from.x + (Math.abs(flow.x) >= Math.abs(flow.y) ? Math.sign(flow.x) : 0), y: from.y + (Math.abs(flow.y) > Math.abs(flow.x) ? Math.sign(flow.y) : 0), z: from.z }];
    } else {
      choices = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => ({ x: from.x + x, y: from.y + y, z: from.z }));
      // Only an actual chosen/remembered goal steers a body. No habitat search.
      if (!b.goal || same(b.goal, from)) return null;
      choices.sort((x, y) => Math.hypot(x.x - b.goal.x, x.y - b.goal.y) - Math.hypot(y.x - b.goal.x, y.y - b.goal.y));
      choices = choices.filter(x => Math.hypot(x.x - b.goal.x, x.y - b.goal.y) < Math.hypot(from.x - b.goal.x, from.y - b.goal.y));
    }
    return choices.find(c => !habitatReason(a, c, b.mode, b.altitudeM, ctx)) || null;
  }
  // The same cardinal local-grid advection used by passive body steps. Unknown
  // flow is not calm, and neither a goal nor food can choose this direction.
  function flowVelocity(a, flow) {
    if (!flow || !Number.isFinite(flow.x) || !Number.isFinite(flow.y)) return null;
    if (!valid(a) || !(a.bodyPhysics.mode === 'drifting'
      || a.bodyPhysics.mode === 'flight' && profiles[a.speciesId].form === 'aerostat')) return null;
    if (!capable(a, a.bodyPhysics.mode)) return { x: 0, y: 0 };
    const magnitude = Math.hypot(flow.x, flow.y);
    if (magnitude <= .001) return { x: 0, y: 0 };
    const speed = Math.min(profiles[a.speciesId].speed, magnitude);
    return Math.abs(flow.x) >= Math.abs(flow.y) ? { x: Math.sign(flow.x) * speed, y: 0 } : { x: 0, y: Math.sign(flow.y) * speed };
  }
  function advance(a, at, ctx) {
    if (!valid(a) || !finite(at) || at <= a.bodyPhysics.lastAt) return false;
    const b = a.bodyPhysics, p = profiles[a.speciesId], dt = at - b.lastAt; b.lastAt = at;
    if (!ctx.alive || a.status === 'dead' && b.mode !== 'falling') return false;
    if (!ctx.local) { b.wasLocal = false; return false; }
    if (!b.wasLocal) { b.wasLocal = true; return false; }
    let remaining = dt, changed = false;
    if (['flight', 'levitation'].includes(b.mode) && (ctx.incapacitated || !capable(a, b.mode))) {
      b.pendingFallM = b.altitudeM; b.mode = 'falling'; b.motion = null; b.turn = null;
    }
    if (b.turn) {
      const reason = habitatReason(a, a.mapCell, b.mode, b.altitudeM, ctx);
      if (reason || !capable(a, b.mode) || ctx.incapacitated) { b.blockedReason = reason || 'Bodily turn interrupted'; return false; }
      const seconds = Math.min(dt, b.turn.seconds - b.turn.progress, b.stamina / .25);
      b.turn.progress += seconds; b.stamina -= seconds * .25; b.spentStamina += seconds * .25;
      if (b.turn.progress + 1e-8 >= b.turn.seconds) { b.heading = b.turn.to; b.turn = null; b.lastEvent = { kind: 'turn', at }; }
      return seconds > 0;
    }
    if (b.motion?.transition) {
      const m = b.motion, tr = m.transition, reason = habitatReason(a, m.to, tr.mode, tr.toAltitude, ctx);
      if (reason || !capable(a, tr.mode) || ctx.incapacitated) { b.blockedReason = reason || 'Transition interrupted by body incapacity'; return false; }
      const step = Math.min(p.speed * dt, m.distanceM - m.progressM, b.stamina);
      if (tr.vertical && !tr.dive) {
        const parts = cells(a, a.mapCell, ctx.tileSizeM || 1), volume = b.dimensions.lengthM * b.dimensions.widthM * step;
        for (const part of parts) if (!finite(ctx.excavate(a, part, volume / parts.length, ctx.terrain(part)))) { b.blockedReason = 'Original entry excavation unavailable'; return false; }
      }
      m.progressM += step; b.stamina -= step; b.spentStamina += step; b.distanceM += step;
      b.altitudeM = tr.fromAltitude + (tr.toAltitude - tr.fromAltitude) * m.progressM / m.distanceM;
      if (m.progressM + 1e-8 >= m.distanceM) { a.mapCell = copy(m.to); b.mode = tr.mode; b.altitudeM = tr.toAltitude; b.motion = null; b.lastEvent = { kind: 'shoreTransition', at, cell: copy(a.mapCell) }; }
      return step > 0;
    }
    if (b.mode === 'levitation' && (a.magicSuppressed || b.mana <= 0)) { b.pendingFallM = b.altitudeM; b.mode = 'falling'; b.motion = null; }
    if (b.mode === 'falling' || b.mode === 'landing') {
      const terrain = cells(a, a.mapCell, ctx.tileSizeM || 1).map(ctx.terrain);
      if (terrain.some(t => !t || !t.floor && !(t.obstacleHeightM > 0))) { b.blockedReason = 'No known physical landing surface'; return false; }
      const surface = Math.max(0, ...terrain.map(t => t.obstacleHeightM || 0));
      const falling = b.mode === 'falling', low = Math.max(surface, b.altitudeM - remaining * (falling ? 4 : .5));
      const reason = habitatReason(a, a.mapCell, 'flight', low, ctx);
      if (reason) { b.blockedReason = `Descent obstructed: ${reason}`; return false; }
      b.altitudeM = low;
      if (b.altitudeM === surface) { const metres = Math.max(0, b.pendingFallM - surface); b.pendingFallM = 0; b.mode = surface === 0 && p.modes.includes('walking') ? 'walking' : 'grounded';
        b.lastEvent = { kind: falling ? 'fall' : 'landed', at, metres }; if (falling) ctx.damage?.(a, Math.ceil(metres * 5), 'Physical fall'); }
      return true;
    }
    if (b.mode === 'rooting') { b.blockedReason = habitatReason(a, a.mapCell, 'rooting', 0, ctx); return false; }
    if (!capable(a, b.mode) || ctx.incapacitated) { b.blockedReason = 'Bodily incapacity or reserve exhausted'; return false; }
    // A finite caller-supplied elapsed interval is integrated in <=1 m steps;
    // interrupted segments retain earned progress, never jump through barriers.
    for (let iterations = 0; remaining > 1e-8 && iterations < 4096; iterations++) {
      if (!b.motion) {
        const to = next(a, ctx);
        if (!to) {
          if (b.mode === 'levitation') {
            const used = Math.min(b.mana, remaining * p.levitationCost); b.mana -= used; b.spentMana += used;
            if (b.mana === 0 && b.altitudeM > 0) { b.pendingFallM = b.altitudeM; b.mode = 'falling'; }
          }
          if (b.mode === 'flight' && p.form !== 'aerostat' && b.altitudeM > 0) b.mode = 'landing';
          b.blockedReason = 'No supported immediate movement or reached current goal'; break;
        }
        b.motion = { from: copy(a.mapCell), to, progressM: 0, distanceM: ctx.tileSizeM || 1, excavatedKg: 0 };
      }
      const m = b.motion;
      const reason = habitatReason(a, m.to, b.mode, b.altitudeM, ctx);
      if (reason) { b.blockedReason = reason; break; }
      let speed = p.speed * Math.max(.1, 1 - wounded(a, /leg|limb|fin|tail|wing/) * .8)
        / (Math.max(1, ctx.movementFactor || 1) * (1 + (ctx.cargoKg?.(a) || 0) / b.massKg));
      speed *= Math.max(1, Math.min(2, ctx.speedMultiplier || 1));
      if (b.mode === 'burrowing') speed /= Math.max(1, ctx.terrain(m.to).hardness);
      if (b.mode === 'drifting' || p.form === 'aerostat' && b.mode === 'flight') {
        const flow = b.mode === 'drifting' ? ctx.terrain(a.mapCell).current : ctx.terrain(a.mapCell).wind;
        speed = Math.min(speed, Math.hypot(flow?.x || 0, flow?.y || 0));
      }
      if (!(speed > 0)) break;
      const passive = b.mode === 'drifting' || b.mode === 'flight' && p.form === 'aerostat';
      const rate = passive ? 0 : (b.mode === 'flight' ? p.airCost : b.mode === 'burrowing' ? 3 : .5) * Math.max(1, Math.min(2, ctx.speedMultiplier || 1));
      const manaRate = b.mode === 'levitation' ? p.levitationCost : 0;
      const seconds = Math.min(remaining, (m.distanceM - m.progressM) / speed, rate ? b.stamina / rate : Infinity, manaRate ? b.mana / manaRate : Infinity);
      if (!(seconds > 1e-8)) break;
      const altitude = ['flight', 'levitation'].includes(b.mode) ? Math.min(6, b.altitudeM + seconds * .5) : b.altitudeM;
      if (habitatReason(a, m.to, b.mode, altitude, ctx)) { b.blockedReason = 'Vertical sweep lacks physical clearance'; break; }
      if (b.mode === 'burrowing') {
        const old = new Set(cells(a, m.from, ctx.tileSizeM || 1).map(key));
        const front = cells(a, m.to, ctx.tileSizeM || 1).filter(c => !old.has(key(c)));
        if (!ctx.excavate || !front.length) { b.blockedReason = 'Actual excavation cannot be performed'; break; }
        const crossSectionM2 = front.length * (ctx.tileSizeM || 1) * b.dimensions.heightM;
        const volume = Math.min(speed * seconds * crossSectionM2,
          Math.max(0, (ctx.tileSizeM || 1) * crossSectionM2 - (m.excavatedVolumeM3 || 0)));
        let kg = 0, failed = false;
        for (const c of front) {
          const result = ctx.excavate(a, c, volume / front.length, ctx.terrain(c));
          if (!finite(result)) { failed = true; break; }
          kg += result;
        }
        if (failed) { b.blockedReason = 'Actual excavation cannot be performed'; break; }
        m.excavatedVolumeM3 = (m.excavatedVolumeM3 || 0) + volume; m.excavatedKg += kg;
      }
      m.progressM += speed * seconds; remaining -= seconds; b.distanceM += speed * seconds;
      b.stamina = Math.max(0, b.stamina - rate * seconds); b.spentStamina += rate * seconds;
      b.mana = Math.max(0, b.mana - manaRate * seconds); b.spentMana += manaRate * seconds;
      b.altitudeM = altitude;
      changed = true; b.blockedReason = '';
      if (m.progressM + 1e-8 >= m.distanceM) { a.mapCell = copy(m.to); b.motion = null; b.lastEvent = { kind: b.mode, at, cell: copy(a.mapCell) }; }
      if (!capable(a, b.mode)) {
        if (b.altitudeM > 0) { b.pendingFallM = b.altitudeM; b.mode = 'falling'; b.motion = null; } break;
      }
    }
    return changed;
  }
  function perceive(observer, target, channel, ctx) {
    if (!valid(observer) || !target?.mapCell || observer.status === 'dead' || observer.mapCell.z !== target.mapCell.z) return false;
    const p = profiles[observer.speciesId], b = observer.bodyPhysics;
    const organs = { sight: /head|crown|antennae|feeding organs/, hearing: /head|antennae/,
      scent: /head|feeding organs|antennae/, vibration: /leg|limb|root/, pressure: /pressure organs|bell/,
      mana: /head|torso/ };
    const hydraSenses = observer.speciesId === 'beast:marsh-hydra' && ['sight', 'hearing', 'scent'].includes(channel);
    if (!organs[channel] || (hydraSenses ? !Object.entries(b.parts).some(([k, health]) => /^head \d/.test(k) && health > 25)
      : wounded(observer, organs[channel]) >= .75)) return false;
    const range = channel === 'sight' ? p.sightM : channel === 'hearing' ? p.hearingM : channel === 'scent' ? p.scentM
      : channel === 'vibration' ? p.vibrationM : channel === 'pressure' ? p.pressureM : channel === 'mana' ? p.manaSenseM : 0;
    if (Math.hypot((observer.mapCell.x - target.mapCell.x) * (ctx.tileSizeM || 1),
      (observer.mapCell.y - target.mapCell.y) * (ctx.tileSizeM || 1), height(observer) - height(target)) > range) return false;
    if ((height(observer) < 0) !== (height(target) < 0) && !['sight', 'vibration'].includes(channel)) return false;
    if (channel === 'sight' && (ctx.light ?? 100) <= 0) return false;
    return Boolean(range && ctx.signal?.(observer, target, channel, b.altitudeM, height(target)));
  }
  function observed(a) {
    if (!valid(a)) return null;
    return { mode: a.bodyPhysics.mode, altitudeM: height(a), dimensions: copy(a.bodyPhysics.dimensions),
      heading: a.bodyPhysics.heading || 0, turning: Boolean(a.bodyPhysics.turn),
      motion: a.bodyPhysics.motion ? { from: copy(a.bodyPhysics.motion.from), to: copy(a.bodyPhysics.motion.to), fraction: a.bodyPhysics.motion.progressM / a.bodyPhysics.motion.distanceM } : null };
  }
  return { profiles, anatomy, attach, valid, height, footprint, cells, occupied, wounded, capable, habitatReason, request, turn, transition, dive, breakIce, damagePart, advance, perceive, observed, key, flowVelocity };
});
