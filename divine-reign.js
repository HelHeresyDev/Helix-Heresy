(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./divine-bodies') : root.HelixDivineBodies,
    node ? require('./divine-submission') : root.HelixDivineSubmission,
    node ? require('./divine-capabilities') : root.HelixDivineCapabilities,
    node ? require('./strategic-divinity') : root.HelixStrategicDivinity);
  if (node) module.exports = api;
  if (root) root.HelixDivineReign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (B, S, O, D) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const bound = (s, book) => s && !s.invalid && O.bound(s, book) && !book?.invalid;
  const identity = o => ({ godId: o.godId, signature: o.god?.divineCore?.repeatableSignature,
    mortalIdentityId: o.god?.stableIdentity?.mortalIdentityId || o.god?.mortalOrigin?.id || o.godId,
    historicallyDead: o.god?.lifecycle?.lifeState === 'dead' && Boolean(o.death?.causeId) });
  function create(book, at) {
    return book && !book.invalid ? { worldId: book.worldId, runId: book.runId, lastAt: at,
      scope: book.originals.map(identity), achievedAt: null, recognizedAt: null, current: false, epochs: [], qualification: null, proven: null, review: null } : null;
  }
  function normalize(s) {
    if (!s) return null;
    const snapshot = v => v && Number.isFinite(v.at) && v.at <= s.lastAt && Number.isInteger(v.scopeSize)
      && v.scopeSize > 0 && v.scopeSize <= s.scope?.length && Array.isArray(v.proof)
      && new Set(v.proof.map(p => p?.godId)).size === v.proof.length
      && s.scope.slice(0, v.scopeSize).filter(t => !t.historicallyDead).length === v.proof.length
      && v.proof.every(p => p && s.scope.slice(0, v.scopeSize).some(t => t.godId === p.godId && t.signature === p.signature)
        && p.actorId && (p.kind === 'death' ? p.causeId : p.kind === 'submission' && Number.isInteger(p.serial)));
    if (!s.worldId || !s.runId || !Number.isFinite(s.lastAt) || !Array.isArray(s.scope) || !Array.isArray(s.epochs)
      || new Set(s.scope.map(t => t?.godId)).size !== s.scope.length || s.scope.some(t => !t?.godId || !t.signature || !t.mortalIdentityId)
      || ['achievedAt', 'recognizedAt'].some(k => s[k] != null && (!Number.isFinite(s[k]) || s[k] < 0 || s[k] > s.lastAt))
      || s.achievedAt != null && (!snapshot(s.qualification) || s.qualification.at !== s.achievedAt)
      || s.proven && (!snapshot(s.proven) || s.proven.at < s.achievedAt)
      || s.recognizedAt != null && (s.achievedAt == null || !s.proven || s.recognizedAt < s.proven.at)
      || s.review && (!Number.isFinite(s.review.at) || !Array.isArray(s.review.receipts) || typeof s.review.text !== 'string'
        || s.review.receipts.some(r => !r || !Number.isFinite(r.at) || typeof r.name !== 'string' || typeof r.state !== 'string'))) return { worldId: s.worldId, runId: s.runId, invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return s && !s.invalid && O.bound(s, from) ? { ...s, ...copy(to) } : null; }
  function assess(s, bodies, book, bodyEpoch, sources = null) {
    if (!bound(s, book) || !B.bound(bodies, book) || book.mode !== 'original' || !book.complete || book.conflict || !s.scope.length
      || s.scope.length !== book.originals.length || book.records.length !== s.scope.length) return { ok: false, reason: 'coverage' };
    if (sources && (sources.some(g => !s.scope.some(t => t.godId === g.id && t.signature === g.divineCore.repeatableSignature))
      || s.scope.some(t => !sources.some(g => g.id === t.godId) && !book.incidents.some(e => e.kind === 'mortalAscension'
        && e.godId === t.godId && e.signature === t.signature)))) return { ok: false, reason: 'coverage' };
    const proof = []; let living = 0;
    for (const t of s.scope) {
      const o = book.originals.find(o => o.godId === t.godId), r = B.owner(book, t.godId), g = r?.god;
      if (!o || JSON.stringify(identity(o)) !== JSON.stringify(t) || !O.validGod(g) || g.divineCore.repeatableSignature !== t.signature
        || g.survivingClaimants?.length || g.independentCommands?.length || g.unresolvedCommitments?.length) return { ok: false, reason: 'original' };
      if (t.historicallyDead && g.lifecycle.lifeState === 'dead') continue;
      const a = bodies.bodies.find(a => a.godId === t.godId);
      if (!a || a.actorKind !== 'divineIndividual' || !B.authentic(bodies, book, a)) return { ok: false, reason: 'body' };
      if (g.lifecycle.lifeState === 'dead') {
        if (a.health !== 0 || a.status !== 'dead' || !a.death?.permanent || a.death.signature !== t.signature
          || !book.incidents.some(e => e.id === a.death.id && e.kind === 'trueIndividualDeath')) return { ok: false, reason: 'death' };
        proof.push({ godId: t.godId, actorId: a.id, signature: a.signature, kind: 'death', causeId: a.death.id });
      } else {
        if (a.status !== 'alive' || a.health <= 0 || a.hostile || !S.valid(a) || a.submission.status !== 'accepted'
          || a.submission.bodyEpoch !== bodyEpoch) return { ok: false, reason: 'submission' };
        const accepted = a.submission.history.findLast(r => r.kind === 'accepted');
        if (!accepted) return { ok: false, reason: 'submission' };
        living++; proof.push({ godId: t.godId, actorId: a.id, signature: a.signature, kind: 'submission', serial: accepted.serial });
      }
    }
    return living ? { ok: true, proof } : { ok: false, reason: 'extermination' };
  }
  function advance(s, bodies, book, at, c) {
    if (!bound(s, book) || !c.alive || at < s.lastAt) return false;
    s.lastAt = at;
    const q = assess(s, bodies, book, c.bodyEpoch, c.sources), changed = s.current !== q.ok;
    if (changed) s.epochs.push({ at, current: q.ok, reason: q.ok ? 'actualRule' : q.reason });
    s.current = q.ok;
    if (q.ok && s.achievedAt == null) { s.achievedAt = at; s.qualification = { at, scopeSize: s.scope.length, bodyEpoch: c.bodyEpoch, proof: copy(q.proof) }; }
    if (q.ok && !s.proven && supported(q.proof, bodies, at)) s.proven = { at, scopeSize: s.scope.length, proof: copy(q.proof) };
    return changed;
  }
  function supported(proof, bodies, at) {
    return proof.every(p => {
      const a = bodies.bodies.find(a => a.id === p.actorId);
      if (!a?.identified || a.signature !== p.signature || a.identified.signature !== p.signature || a.identified.at > at) return false;
      if (p.kind === 'submission') return S.publicView(a)?.history.some(r => r.serial === p.serial && r.kind === 'accepted' && r.at <= at);
      return a.observed?.death?.id === p.causeId && (a.observed.death.confirmedAt ?? a.observed.death.observedAt) <= at;
    });
  }
  function registerAscendant(s, bodies, book, candidate, rite, home, at, c) {
    if (!c?.alive || !Number.isInteger(c.bodyEpoch) || !bound(s, book) || !B.bound(bodies, book) || !Number.isFinite(at) || at < s.lastAt || !home?.cellId || !home.placeId
      || !candidate?.mapCell || !candidate.roomId || !Number.isFinite(candidate.health) || candidate.health <= 0
      || candidate.ascendedGodId || candidate.id === 'scientist'
      || !Number.isFinite(candidate.maxHealth) || candidate.maxHealth < candidate.health
      || !Number.isFinite(candidate.stamina) || candidate.stamina < 0 || book.originals.some(o => identity(o).mortalIdentityId === candidate.id)) return false;
    let god; try { god = D.ascendMortal(candidate, rite); } catch { return false; }
    for (const field of ['independentCommands', 'unresolvedCommitments', 'survivingClaimants']) if (Array.isArray(candidate[field])) god[field] = copy(candidate[field]);
    // This consumes an actual canonical ascension result, not a title or a
    // rumor. Worship is bounded by already present original population rows.
    const old = book.records.flatMap(r => r.god?.worshipSources || []);
    if (god.worshipSources.some(w => {
      const rows = old.filter(o => o.sourcePopulationId === w.sourcePopulationId);
      return !rows.length || rows.some(o => o.sourcePopulationUnits !== w.sourcePopulationUnits)
        || rows.reduce((n, o) => n + o.followerUnits, 0) + god.worshipSources.filter(o => o.sourcePopulationId === w.sourcePopulationId)
          .reduce((n, o) => n + o.followerUnits, 0) > w.sourcePopulationUnits;
    })) return false;
    const original = { godId: god.id, god: copy(god), faith: null, death: null, bornAt: at };
    book.originals.push(original); book.records.push({ godId: god.id, god, lost: false, linked: false, contactIds: [],
      attentionInitialized: true, attentionSeconds: Math.min(900, god.divineCore.receivingCapacity), channelAvailableAt: at });
    const a = B.create(book, [{ ...copy(home), godId: god.id }], at)?.bodies[0];
    if (!a) { book.originals.pop(); book.records.pop(); return false; }
    a.mapCell = copy(candidate.mapCell); a.homeCell = copy(candidate.mapCell); a.roomId = candidate.roomId;
    a.health = a.maxHealth * candidate.health / candidate.maxHealth; a.stamina = Math.min(a.maxStamina, candidate.stamina);
    a.physicalControl.stamina = a.stamina;
    a.role = candidate.role || a.role; a.name = candidate.name || a.name;
    if (candidate.name) a.home.name = candidate.name;
    const mortalId = candidate.id;
    for (const [skill, level] of Object.entries(candidate.skills || {})) {
      if (Number.isFinite(level)) a.skills[skill] = Math.max(a.skills[skill] || 0, level);
      else if (level && typeof level === 'object') a.skills[skill] = copy(level);
    }
    Object.assign(candidate, a, { priorActorId: mortalId, ascendedGodId: god.id });
    for (const injury of c.injuries || []) if (injury.actorId === mortalId) { injury.actorId = candidate.id; injury.actorKind = 'divineIndividual'; }
    for (const stack of c.stacks || []) if (stack.carriedBy === mortalId) stack.carriedBy = candidate.id;
    bodies.bodies.push(candidate); s.scope.push(identity(original));
    book.incidents.push({ id: `${god.id}:ascension`, at, kind: 'mortalAscension', godId: god.id, mortalIdentityId: mortalId, signature: god.divineCore.repeatableSignature });
    advance(s, bodies, book, at, c);
    return candidate;
  }
  function review(s, bodies, book, at, c) {
    if (!bound(s, book) || !B.bound(bodies, book) || !c.alive || !c.capable || !c.free || at < s.lastAt) return false;
    advance(s, bodies, book, at, c);
    // Recognition uses the retained genuine qualifying instant plus personally
    // acquired evidence. It can arrive after a later loss; no new certificate.
    const historical = s.proven && supported(s.proven.proof, bodies, s.proven.at);
    if (historical && s.recognizedAt == null) s.recognizedAt = at;
    const receipts = bodies.bodies.filter(a => a.identified).flatMap(a => {
      if (a.observed?.death) return [{ name: a.home.name, at: a.observed.at, state: 'original remains confirmed' }];
      const history = S.publicView(a)?.history || [], last = history.findLast(r => ['accepted', 'refused', 'rebellion', 'release'].includes(r.kind));
      return last ? [{ name: a.home.name, at: last.at, state: last.kind === 'accepted' ? 'submission heard'
        : ['rebellion', 'release'].includes(last.kind) ? 'control lost' : 'dated personal account retained' }]
        : [{ name: a.home.name, at: a.identified.at, state: 'identified individual; no submission received' }];
    });
    s.review = { at, receipts, achievedAt: s.recognizedAt != null && s.proven?.at === s.achievedAt ? s.achievedAt : null,
      confirmedByAt: s.recognizedAt != null ? s.proven.at : null, recognizedAt: s.recognizedAt,
      knownLoss: bodies.bodies.some(a => a.identified && !a.observed?.death
        && S.publicView(a)?.history.findLast(r => ['accepted', 'rebellion', 'release'].includes(r.kind))?.kind !== 'accepted'),
      text: historical ? 'Rule over the gods — historical accomplishment recognized. Current authority can still be lost.'
        : 'Held personal accounts do not yet establish the complete accomplishment. Unknown scope and unsupported outcomes remain unresolved.' };
    return true;
  }
  function view(s) { return s && !s.invalid ? copy(s.review || { at: null, receipts: [], achievedAt: null, confirmedByAt: null, recognizedAt: null,
    text: 'No personal supremacy assessment recorded. Existing observations and heard decisions can be reviewed; no hidden roster or live global status is disclosed.' }) : null; }
  return { bound, identity, create, normalize, rebind, assess, advance, review, view, registerAscendant };
});
