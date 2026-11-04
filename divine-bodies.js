(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./strategic-world') : root.HelixStrategicWorld);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixDivineBodies = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (World) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const ROOM = 'supportedSurveyGround', WORK = 120, UNLOCK = 'procedure:divineResonance';
  const LIMITS = 'The original physical individual, not an avatar. Silence, descent, a depleted reserve or a lost encounter is not death. No worship, religion, city, submission or ambition is awarded. Reports are dated personal observations; unseen originals and totals remain private.';
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const bound = (s, book) => s && book && !s.invalid && !book.invalid && s.worldId === book.worldId && s.runId === book.runId;
  const owner = (book, godId) => book?.records?.find(r => r.godId === godId && !r.lost);
  const validGod = g => g?.lifecycle?.lifeState === 'living' && g.divineCore?.identityBound
    && Number.isFinite(g.divineCore.innateCapacity) && g.divineCore.innateCapacity > 0 && g.divineCore.repeatableSignature;
  function homes(map, book) {
    return (book?.originals || []).flatMap(o => {
      const faithId = o.faith?.id;
      const branch = (map?.publicReligiousInstitutionHistoryDirectory?.currentBranchRows || [])
        .filter(b => b.traditionId === faithId && b.originalCityId === b.currentCityId && b.publicPhysicalPresence
          && ['active', 'strained', 'reestablished', 'reconciled'].includes(b.operationalStatus))
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      const cities = map?.humanGeography?.cities || map?.humanGeography?.cityRows || [];
      const branchCity = branch && cities.find(c => c.id === branch.currentCityId || c.cityId === branch.currentCityId);
      const sites = map?.strategicDivineHistory?.holySiteStateRows || [];
      const site = sites.find(r => r.originPatronGodId === o.godId && !['destroyed', 'dead'].includes(r.state))
        || sites.find(r => r.originPatronGodId === o.godId);
      const event = (map?.strategicDivineHistory?.eventRows || []).filter(e => e.participantIds?.includes(o.godId) && e.cellId).at(-1);
      const city = branchCity || event?.cityId && cities.find(c => c.id === event.cityId || c.cityId === event.cityId);
      // A city-hosted original sanctuary or an actual original holy site, never
      // the latest contact desk, a new realm, or an invented remote location.
      const cellId = city?.cellId || event?.cellId || site?.cellId;
      if (!cellId) return [];
      return [{ godId: o.godId, cityId: city ? city.id || city.cityId : null, cellId,
        placeId: city ? `city:${city.id || city.cityId}` : event ? event.siteId || `divine-ground:${cellId}` : site.siteId,
        name: map?.publicReligionDirectory?.gods?.find(g => g.id === o.godId)?.name || 'Unidentified extraordinary individual' }];
    });
  }
  function create(book, locations, at) {
    if (!book || book.invalid || book.mode !== 'original' || !Array.isArray(locations)) return null;
    const slots = new Map(), bodies = [];
    for (const o of book.originals) {
      const g = owner(book, o.godId)?.god, home = locations.find(h => h.godId === o.godId);
      if (!validGod(g) || !home?.cellId || !home.placeId) continue;
      const key = home.cityId || home.placeId, slot = slots.get(key) || 0;
      if (slot >= 36) continue; // Unsupported ground is not permission to overlap originals.
      slots.set(key, slot + 1);
      const innate = g.divineCore.innateCapacity, health = 200 + innate * 4;
      const cell = { x: 8 + slot % 12, y: [16, 17, 15][Math.floor(slot / 12)], z: 6 };
      bodies.push({ id: `${o.godId}:true-individual`, godId: o.godId, signature: g.divineCore.repeatableSignature,
        mortalIdentityId: g.stableIdentity?.mortalIdentityId || g.mortalOrigin?.id || o.godId,
        actorKind: 'divineIndividual', name: 'Unidentified extraordinary individual', role: 'Original ascended physical individual',
        home: copy(home), homeCell: cell, roomId: ROOM, mapCell: copy(cell), status: 'alive', health, maxHealth: health,
        fatigue: 0, stamina: 100 + innate, maxStamina: 100 + innate,
        physicalControl: { strength: innate, stamina: 100 + innate, staminaCapacity: 100 + innate },
        skills: { striking: innate / 3, guarding: innate / 3, evasion: innate / 4, perception: innate / 3, animancy: innate / 3 },
        domains: copy(g.domains || []), hostile: false, pending: null, nextMoveAt: at, nextAttackAt: at,
        lastAt: at, retreating: false, observed: null, identified: null, death: null });
    }
    return { worldId: book.worldId, runId: book.runId, allocatedAt: at, lastAt: at, bodies, job: null, reports: [], payments: [] };
  }
  function normalize(s) {
    if (!s) return null;
    if (!s.worldId || !s.runId || !Array.isArray(s.bodies) || !Array.isArray(s.reports) || !Array.isArray(s.payments) || !Number.isFinite(s.lastAt)
      || new Set(s.bodies.map(a => a.godId)).size !== s.bodies.length
      || s.bodies.some(a => a.actorKind !== 'divineIndividual' || a.id !== `${a.godId}:true-individual`
        || !a.home?.cellId || !a.home.placeId || !a.signature || !a.mortalIdentityId
        || !['alive', 'dead'].includes(a.status) || !Number.isFinite(a.health) || a.health < 0 || a.health > a.maxHealth
        || !Number.isFinite(a.stamina) || a.stamina < 0 || a.stamina > a.maxStamina
        || !['x', 'y', 'z'].every(k => Number.isInteger(a.mapCell?.[k]) && Number.isInteger(a.homeCell?.[k])))
      || s.payments.some((p, i) => p.id !== `resonance:${i + 1}` || p.quantity !== 3 || !Number.isFinite(p.at)
        || !Number.isInteger(p.bodyEpoch) || p.bodyEpoch < 0 || p.usedAt != null && (!Number.isFinite(p.usedAt) || p.usedAt < p.at)
        || !s.bodies.some(a => a.id === p.actorId && a.signature === p.signature))
      || s.job && (!s.bodies.some(a => a.id === s.job.actorId) || !Number.isFinite(s.job.progress) || s.job.progress < 0 || s.job.progress > WORK))
      return { worldId: s.worldId, runId: s.runId, invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return s && !s.invalid && s.worldId === from.worldId && s.runId === from.runId ? { ...s, ...copy(to) } : null; }
  function authentic(s, book, a) {
    const g = owner(book, a?.godId)?.god;
    return Boolean(bound(s, book) && s.bodies.includes(a) && g?.divineCore?.repeatableSignature === a.signature
      && a.maxHealth === 200 + g.divineCore.innateCapacity * 4 && a.maxStamina === 100 + g.divineCore.innateCapacity
      && g.id === a.godId && (g.stableIdentity?.mortalIdentityId || g.mortalOrigin?.id || g.id) === a.mortalIdentityId);
  }
  function local(a, c) {
    return Boolean(c.alive && c.field && c.roomId === a.roomId
      && (a.home.cityId ? c.cityId === a.home.cityId && c.cellId === a.home.cellId && c.placeId === `survey:${a.home.cityId}`
        : c.cellId === a.home.cellId && c.placeId === a.home.placeId));
  }
  function visible(a, c) { return local(a, c) && c.visible === true; }
  function observe(s, book, a, c, at) {
    if (!authentic(s, book, a) || !visible(a, c)) return false;
    if (a.death && a.identified && a.death.at === at) a.death.witnessedAt ??= at;
    if (a.death && a.identified) a.death.confirmedAt ??= at;
    a.observed = { at, id: a.id, name: a.identified ? a.home.name : 'Unidentified extraordinary individual',
      cell: copy(a.mapCell), condition: a.status === 'dead' ? 'physical remains' : c.incapacitated ? 'incapacitated'
        : a.health < a.maxHealth / 4 ? 'severely wounded' : 'living',
      identified: Boolean(a.identified), hostile: a.hostile, retreating: a.retreating,
      pending: a.pending && { action: a.pending.action, releaseAt: a.pending.releaseAt },
      death: a.identified && a.death ? { id: a.death.id, godId: a.godId, remainsId: a.id, permanent: true,
        at: a.death.witnessedAt != null ? a.death.at : null, confirmedAt: a.death.confirmedAt, observedAt: at, cell: copy(a.mapCell) } : null };
    return true;
  }
  function reagents(stacks, n, c, consume = false) {
    const lots = stacks.filter(i => i.key === 'arcaneFeedstock' && i.quantity > 0 && i.carriedBy === 'scientist'
      && !i.reservedTaskId && !i.cityOwnerId && !i.fixtureId && !i.containerId && !i.tags?.includes('contaminated') && same(i.cell, c.cell));
    if (lots.reduce((v, i) => v + i.quantity, 0) < n) return false;
    if (consume) for (const i of lots) { const used = Math.min(n, i.quantity); i.quantity -= used; i.knownQuantity = Math.min(i.knownQuantity ?? i.quantity, i.quantity); n -= used; if (!n) break; }
    return true;
  }
  function begin(s, book, a, stacks, c, at) {
    if (!authentic(s, book, a) || !visible(a, c) || a.identified || a.status !== 'alive' || a.hostile || s.job
      || !c.capable || !c.free || !c.researched || !c.instrument || c.distance > 4 || c.suppressed
      || !reagents(stacks, 2, c, true)) return false;
    s.job = { actorId: a.id, progress: 0, lastAt: at, ready: true, cell: copy(c.cell), signature: a.signature };
    return true;
  }
  function resonanceReason(s, book, a, stacks, c) {
    if (!authentic(s, book, a) || !visible(a, c) || a.status !== 'alive' || !a.identified) return 'Personally identify this living true individual first; an avatar or a dated name is not a target.';
    if (!c.researched || c.animancy < 201) return 'Divine Core Resonance research and Animancy knowledge 201 are required.';
    if (!c.instrument || c.suppressed) return 'A carried functioning thaumometer and unsuppressed magic are required.';
    if (!reagents(stacks, 3, c)) return 'Three clean, unreserved, personally carried arcane feedstock are required per attempt.';
    return '';
  }
  function payResonance(s, book, a, stacks, c, at) {
    if (resonanceReason(s, book, a, stacks, c) || !reagents(stacks, 3, c, true)) return null;
    const receipt = { id: `resonance:${s.payments.length + 1}`, at, actorId: a.id, signature: a.signature, bodyEpoch: c.bodyEpoch, quantity: 3 };
    s.payments.push(receipt); return receipt;
  }
  function release(s, book, a, pending, c, at) {
    const p = s?.payments?.find(p => p.id === pending?.resonancePaymentId);
    if (!p || p.usedAt != null || !authentic(s, book, a) || !visible(a, c) || !a.identified || a.status !== 'alive'
      || p.actorId !== a.id || p.signature !== a.signature || p.bodyEpoch !== c.bodyEpoch || p.at !== pending.startedAt
      || pending.target?.id !== a.id || pending.actionId !== 'divineResonance' || pending.manaPaid < 30
      || at < pending.releaseAt || !c.researched || c.animancy < 201 || c.suppressed || !c.instrument) return false;
    p.usedAt = at; return true;
  }
  function attack(s, book, a, c, at) {
    if (!authentic(s, book, a) || !visible(a, c) || a.status !== 'alive') return false;
    a.hostile = true; a.aggressionAt = at; a.aggressionSerial = (a.aggressionSerial || 0) + 1; return true;
  }
  function absorb(s, book, a, amount, c) {
    const g = owner(book, a?.godId)?.god;
    if (!authentic(s, book, a) || g.lifecycle.divinityState !== 'divine' || c.incapacitated || c.magicSuppressed || a.status !== 'alive') return amount;
    const ward = Math.min(amount, g.divineCore.innateCapacity, g.power.reserve);
    g.power.reserve -= ward; return amount - ward;
  }
  function death(s, book, a, at, cause) {
    if (!authentic(s, book, a) || a.health > 0 || a.death || owner(book, a.godId).god.lifecycle.lifeState !== 'living') return false;
    const g = owner(book, a.godId).god;
    a.status = 'dead'; a.pending = null; a.hostile = false;
    a.death = { id: `${a.id}:death`, godId: a.godId, mortalIdentityId: a.mortalIdentityId,
      signature: a.signature, at, cause, lastInjury: copy(a.lastDamage || null), cell: copy(a.mapCell), placeId: a.home.placeId, remainsId: a.id, permanent: true };
    Object.assign(g.lifecycle, { lifeState: 'dead', divinityState: 'none', publicStatus: 'dead', deathPermanent: true });
    g.divineCore.state = 'destroyed';
    book.incidents ||= []; book.incidents.push({ id: a.death.id, at, godId: a.godId, kind: 'trueIndividualDeath', evidence: copy(a.death) });
    // The spent reserve/remnant power and all worship/faith ownership remain
    // original. Neither killing nor continued worship reallocates the identity.
    return true;
  }
  function advance(s, book, at, context, effects = {}) {
    if (!bound(s, book) || !Number.isFinite(at) || at < s.lastAt || !context(null).alive) return false;
    const start = s.lastAt; s.lastAt = at; let changed = false;
    if (s.job) {
      const j = s.job, a = s.bodies.find(a => a.id === j.actorId), c = context(a);
      const ready = authentic(s, book, a) && visible(a, c) && c.capable && c.researched && c.instrument && !c.suppressed
        && c.distance <= 4 && same(c.cell, j.cell) && !a.hostile && a.status === 'alive' && c.free;
      if (ready && j.ready) j.progress += Math.min(WORK - j.progress, Math.max(0, at - j.lastAt));
      j.ready = ready; j.lastAt = at;
      if (j.progress >= WORK) {
        a.identified = { at, godId: a.godId, signature: a.signature, observerId: 'scientist', cell: copy(a.mapCell) };
        if (!a.home.name || a.home.name === 'Unidentified extraordinary individual') a.home.name = `Personally identified ascended individual ${s.reports.length + 1}`;
        a.name = a.home.name; s.reports.push(copy(a.identified)); s.job = null; changed = true;
      }
    }
    for (const a of s.bodies) {
      if (!authentic(s, book, a)) continue;
      const c = context(a), g = owner(book, a.godId).god;
      if (a.health <= 0) changed = death(s, book, a, at, 'actual bodily injury') || changed;
      if (a.status === 'alive' && g.lifecycle.lifeState === 'dead') { a.health = 0; a.status = 'dead'; a.pending = null; }
      const dt = at - a.lastAt; a.lastAt = at;
      const controlled = effects.control?.(a, c, at, dt);
      if (!local(a, c) || a.status !== 'alive' || c.incapacitated || dt <= 0) { a.pending = null; continue; }
      a.retreating = a.health < a.maxHealth / 4;
      if (controlled) { a.retreating = false; changed = observe(s, book, a, context(a), at) || changed; continue; }
      if (a.hostile && c.tracks && c.distance <= 6) {
        if (a.pending && at >= a.pending.releaseAt) {
          const p = a.pending; a.pending = null;
          if (c.distance <= p.range && c.lineOfEffect) effects.strike?.(a, p);
          a.nextAttackAt = at + 5; changed = true;
        } else if (!a.pending && at >= a.nextAttackAt) {
          const divine = g.lifecycle.divinityState === 'divine' && !c.magicSuppressed;
          const cost = Math.max(20, (g.expenditures?.communication || 0) + (g.expenditures?.miracles || 0) + (g.expenditures?.protection || 0));
          const spell = divine && g.power.reserve >= cost && c.distance <= 4;
          if (spell || c.distance <= 1 && a.stamina >= 10) {
            if (spell) g.power.reserve -= cost; else a.stamina -= 10;
            const elemental = a.domains.some(d => /fire|sun|light/i.test(d)) ? 'heat' : a.domains.some(d => /winter|ice|cold/i.test(d)) ? 'cold' : 'arcane';
            a.pending = { action: spell ? 'soulLash' : 'strike', range: spell ? 4 : 1,
              damage: Math.max(12, Math.round(g.divineCore.innateCapacity / 12)) + a.domains.length,
              types: spell ? ['arcane', elemental] : ['physical'], releaseAt: at + 3 };
            effects.telegraph?.(a); changed = true;
          }
        }
        if (!a.pending && at >= a.nextMoveAt && a.stamina > 0) {
          if (effects.move?.(a, c.cell, a.retreating)) { a.stamina--; changed = true; }
          a.nextMoveAt = at + Math.max(1, c.moveSeconds || 1);
        }
      } else a.pending = null; // No omniscient pursuit or off-screen attack.
      changed = observe(s, book, a, context(a), at) || changed;
    }
    return changed || at > start;
  }
  function known(s) { return !s || s.invalid ? [] : s.bodies.filter(a => a.observed).map(a => copy(a.observed)); }
  return { ROOM, WORK, UNLOCK, LIMITS, owner, homes, create, normalize, rebind, bound, authentic, local, visible,
    observe, begin, reagents, resonanceReason, payResonance, release, attack, absorb, death, advance, known };
});
