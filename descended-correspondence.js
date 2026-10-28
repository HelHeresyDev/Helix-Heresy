(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./divine-capabilities') : root.HelixDivineCapabilities,
    node ? require('./divine-nonintervention') : root.HelixDivineNonintervention,
    node ? require('./strategic-faiths') : root.HelixStrategicFaiths);
  if (node) module.exports = api;
  if (root) root.HelixDescendedCorrespondence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Owners, Restraint, Faiths) {
  'use strict';
  const WORK = 60, ANSWER = 120, ATTENTION = 600, OFFER = 600, DURATION = 4 * 86400;
  const TERMS = 'For four days the named living individual will not initiate or commission attempts to overthrow the scientist’s actual terrestrial governments through their own body, manifestations or personally commanded means. The scientist will not attack the named original address custodian. Received eyewitness aggression against that custodian suspends this commitment. Independent faithful, prior promises, commands, property and obligations remain independent. This ordinary personal agreement grants no divine confirmation, conversion, endorsement, sovereignty, submission, killing promise or control of other gods. Reascension neither cancels nor renews it.';
  const LIMITS = 'Ordinary correspondence with one original living individual, not their present whereabouts, divine confirmation or world domination. Silence proves nothing. Independent commands, claims and earlier obligations remain unresolved.';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const finite = n => Number.isFinite(n) && n >= 0;
  const hash = s => [...s].reduce((n, ch) => (Math.imul(n, 31) + ch.charCodeAt(0)) >>> 0, 0);
  const row = (s, id) => s?.endpoints?.find(e => e.source.id === id);
  const account = (s, id) => s?.accounts?.find(a => a.godId === id);
  const original = (book, id) => book?.records?.find(r => r.godId === id && !r.lost);
  // Explicit retained INTERNET custody, original confirmed identity and a real
  // original uplink are all required. Historical event locations are not read.
  function sources(map, paths) {
    const faiths = Faiths.publicFaithDirectory(map)?.faiths || [];
    return (map?.publicReligiousInstitutionHistoryDirectory?.currentBranchRows || []).flatMap(b => {
      const f = faiths.find(f => f.id === b.traditionId && f.kind === 'confirmedDivineFaithIdentity');
      const g = map?.strategicDivineHistory?.currentGodRows?.find(g => g.id === f?.godId);
      const known = map?.publicReligionDirectory?.gods?.find(g => g.id === f?.godId);
      const tradition = map?.publicReligiousInstitutionHistoryDirectory?.traditionRows?.find(t => t.id === f?.id && t.kind === 'confirmedDivineFaith');
      const path = paths?.filter(p => p.kind === 'municipal' && p.cityId === b.currentCityId).sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!path || !known?.name || !tradition || !Owners.validGod(g) || g.lifecycle.lifeState !== 'living' || g.lifecycle.divinityState !== 'descended'
        || !b.publicPhysicalPresence || !b.internetContinuity || b.originalCityId !== b.currentCityId
        || !['active', 'strained', 'reestablished', 'reconciled'].includes(b.operationalStatus)
        || !['historicallyConfirmed', 'authenticated', 'reconciled'].includes(b.divineRelationship)
        || ['proscribed', 'censured', 'expelled'].includes(b.currentStanding)) return [];
      return [{ id: `${b.id}:retained-personal-mailbox`, godId: g.id, godName: known.name, cityId: b.currentCityId,
        branchId: b.id, branchName: b.publicName, pathId: path.id, populationSourceId: path.populationSourceId,
        signature: g.divineCore.repeatableSignature, faith: Faiths.projectFaithConfirmation(f, g.lifecycle),
        patronInterest: Faiths.patronInterestFor(f, map.publicDivineHistoryDirectory),
        address: `${b.id}/original-individual/${g.id}`,
        custody: 'Original retained branch internet mailbox; municipal message desk holds its scoped routing record, not the individual’s location.',
        disclosure: hash(`${b.id}:original-address-custody`) % 3 === 0 ? 'releaseScopedAddress' : 'withholdAddress' }];
    }).sort((a, b) => a.id.localeCompare(b.id));
  }
  function validSource(r) {
    return r && ['id', 'godId', 'godName', 'cityId', 'branchId', 'branchName', 'pathId', 'populationSourceId', 'signature', 'address', 'custody'].every(k => typeof r[k] === 'string' && r[k])
      && r.faith?.godId === r.godId && r.faith.kind === 'confirmedDivineFaithIdentity' && r.faith.confirmation?.state === 'historicallyConfirmed'
      && ['releaseScopedAddress', 'withholdAddress'].includes(r.disclosure);
  }
  function validOffer(e, contact, p) {
    return Boolean(p && p.id && p.endpointId === e.source.id && p.godId === e.source.godId && p.branchId === e.source.branchId
      && p.protectedId === contact.clerkId && p.protectedName === contact.protectedName && p.bodyEpoch === contact.bodyEpoch
      && p.scope === 'ownTerrestrialIntervention' && p.duration === DURATION && p.terms === TERMS
      && finite(p.at) && p.offerExpiresAt === p.at + OFFER && typeof p.motive === 'string');
  }
  function create(rows, book, communications, at) {
    if (!book || book.invalid || book.mode !== 'original' || !Owners.bound(book, communications) || communications.invalid
      || !finite(at) || !Array.isArray(rows) || new Set(rows.map(r => r.id)).size !== rows.length
      || rows.some(r => !validSource(r) || original(book, r.godId)?.god?.lifecycle.divinityState !== 'descended'
        || original(book, r.godId).god.divineCore.repeatableSignature !== r.signature
        || !communications.sources.some(p => p.id === r.pathId && p.kind === 'municipal' && p.cityId === r.cityId && p.populationSourceId === r.populationSourceId))) return null;
    return { worldId: book.worldId, runId: book.runId, allocatedAt: at, lastAt: at, serial: 0,
      endpoints: rows.map(source => ({ source: copy(source), seal: Owners.seal(book, source.godId, source), contact: null })),
      accounts: [...new Set(rows.map(r => r.godId))].map(godId => ({ godId, attentionSeconds: ATTENTION, spentAttention: 0, job: null })),
      reports: [], incidents: [] };
  }
  function normalize(s, book, communications) {
    if (s == null) return null;
    const invalid = () => ({ worldId: s.worldId || '', runId: s.runId || '', invalid: true });
    if (s.invalid || !Owners.bound(s, book) || !Owners.bound(s, communications) || book.invalid || communications.invalid
      || !Array.isArray(s.endpoints) || !Array.isArray(s.accounts) || !Array.isArray(s.reports) || !Array.isArray(s.incidents)
      || s.endpoints.some(e => !e || !e.source) || s.accounts.some(a => !a || typeof a.godId !== 'string')
      || s.reports.some(r => !r || !r.payload) || s.incidents.some(i => !i || !i.id || !finite(i.at))
      || !finite(s.lastAt) || !finite(s.allocatedAt) || s.lastAt < s.allocatedAt || !Number.isInteger(s.serial) || s.serial < 0
      || new Set(s.endpoints.map(e => e.source?.id)).size !== s.endpoints.length
      || new Set(s.accounts.map(a => a.godId)).size !== s.accounts.length
      || s.accounts.length !== new Set(s.endpoints.map(e => e.source?.godId)).size) return invalid();
    for (const e of s.endpoints) {
      const r = e.source, g = original(book, r?.godId)?.god;
      if (!validSource(r) || !g || g.divineCore.repeatableSignature !== r.signature || e.seal !== Owners.seal(book, r.godId, r)
        || !communications.sources.some(p => p.id === r.pathId && p.cityId === r.cityId && p.populationSourceId === r.populationSourceId)
        || !account(s, r.godId)) return invalid();
      const c = e.contact;
      if (c && (!c.officeId || !c.clerkId || !c.ground?.counter || c.ground.cityId !== r.cityId || !finite(c.bodyEpoch)
        || !['inquiring', 'withheld', 'known', 'requestSent', 'replyReady', 'offered', 'refused', 'acceptSent', 'assentReady', 'agreed'].includes(c.state)
        || c.offer && !validOffer(e, c, c.offer))) return invalid();
    }
    for (const a of s.accounts) {
      const j = a.job;
      if (!s.endpoints.some(e => e.source.godId === a.godId) || !finite(a.attentionSeconds) || !finite(a.spentAttention)
        || a.attentionSeconds + a.spentAttention !== ATTENTION || j && (!row(s, j.endpointId)?.contact || row(s, j.endpointId).source.godId !== a.godId
          || !['discover', 'request', 'answer', 'receive', 'accept', 'assent', 'breach'].includes(j.kind)
          || !finite(j.progress) || j.progress >= duration(j.kind) || !finite(j.lastAt) || !j.id || typeof j.wasReady !== 'boolean'
          || j.bodyEpoch !== row(s, j.endpointId).contact.bodyEpoch
          || ['accept', 'assent'].includes(j.kind) && !row(s, j.endpointId).contact.offer)) return invalid();
    }
    if (s.reports.some(r => !row(s, r.endpointId)?.contact || !finite(r.receivedAt) || !finite(r.observedAt)
      || r.receivedAt < r.observedAt || r.seal !== Owners.seal(book, r.godId, r.payload)
      || Object.keys(r.payload || {}).some(k => JSON.stringify(r[k]) !== JSON.stringify(r.payload[k])))) return invalid();
    return copy(s);
  }
  function rebind(s, from, to) { return Owners.bound(s, from) ? { ...copy(s), worldId: to.worldId, runId: to.runId } : null; }
  const duration = kind => ['answer', 'assent', 'breach'].includes(kind) ? ANSWER : WORK;
  const remote = kind => ['answer', 'assent', 'breach'].includes(kind);
  function channel(s, book, communications, e, office, c, own = null) {
    const r = e?.source, g = original(book, r?.godId)?.god, p = communications?.ports?.find(p => p.id === r?.pathId),
      path = communications?.sources?.find(p => p.id === r?.pathId), backbone = communications?.backbones?.find(b => b.id === path?.siteId);
    return Boolean(s && !s.invalid && Owners.bound(s, book) && Owners.bound(s, communications) && !communications.invalid
      && e.seal === Owners.seal(book, r.godId, r) && g?.lifecycle.lifeState === 'living' && g.divineCore.repeatableSignature === r.signature
      && ['descended', 'divine'].includes(g.lifecycle.divinityState) && c.alive && c.sourceCurrent && c.serviceAvailable && c.clerkAtChannel
      && office?.cityId === r.cityId && office.active && office.channelPowered && office.maintenanceReady !== false
      && office.clerk?.status === 'alive' && office.clerk.health >= 50 && (office.clerk.fatigue || 0) < 80
      && (!e.contact || e.contact.officeId === office.id && e.contact.clerkId === office.clerk.id)
      && ![office.assignment, office.clerk.assignment, p?.assignment].some(id => id && id !== own)
      && (!own || [office.assignment, office.clerk.assignment, p?.assignment].every(id => id === own))
      && p && !p.outage && p.condition >= 50 && p.powerSeconds > 0 && backbone && !backbone.outage && backbone.condition >= 50);
  }
  const attended = c => Boolean(c.alive && c.capable && c.receiveAtCounter && c.free && !c.busy);
  function start(s, e, office, communications, c, kind, at) {
    const a = account(s, e.source.godId), id = `ordinary-mail:${++s.serial}`;
    a.job = { id, endpointId: e.source.id, kind, progress: 0, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch };
    office.assignment = office.clerk.assignment = id;
    communications.ports.find(p => p.id === e.source.pathId).assignment = id;
    return true;
  }
  function begin(s, book, communications, id, office, c, kind, at, expected = null, ground = null) {
    const e = row(s, id), a = account(s, e?.source.godId), contact = e?.contact;
    if (!a || a.job || !finite(at) || at < s.lastAt || !attended(c) || !channel(s, book, communications, e, office, c)
      || office.workSeconds < WORK || office.power < 1) return false;
    if (kind === 'discover') {
      if (contact || !ground || ground.cityId !== e.source.cityId) return false;
      e.contact = { officeId: office.id, clerkId: office.clerk.id, protectedName: office.clerk.name,
        gateId: ground.gateId, ground: copy(ground), bodyEpoch: c.bodyEpoch, state: 'inquiring', reply: null, offer: null, pending: null };
    } else {
      if (!contact || contact.bodyEpoch !== c.bodyEpoch) return false;
      if (kind === 'request') {
        const active = Owners.currentAgreement(book, e.source.godId, c.bodyEpoch, at);
        if (!['known', 'refused', 'agreed', 'offered'].includes(contact.state) || active && active.payload.expiresAt - at > 86400 || a.attentionSeconds < ANSWER) return false;
      } else if (kind === 'receive') {
        if (!contact.pending && !book.agreements.some(a => a.payload.endpointId === id)) return false;
      } else if (kind === 'accept') {
        if (contact.state !== 'offered' || !validOffer(e, contact, contact.offer) || JSON.stringify(expected) !== JSON.stringify(contact.offer)
          || expected.at > at || at >= expected.offerExpiresAt || expected.bodyEpoch !== c.bodyEpoch || expected.motive !== motive(book, e.source)
          || a.attentionSeconds < ANSWER) return false;
      } else return false;
    }
    office.power--; return start(s, e, office, communications, c, kind, at);
  }
  function release(a, office, communications, e) {
    const id = a.job?.id;
    for (const x of [office, office?.clerk, communications?.ports?.find(p => p.id === e.source.pathId)]) if (x?.assignment === id) x.assignment = null;
    a.job = null;
  }
  function motive(book, source) { return Restraint.independentMotive(original(book, source.godId)?.god, source.faith, source.patronInterest); }
  function advance(s, book, communications, id, office, c, at) {
    const e = row(s, id), a = account(s, e?.source.godId), j = a?.job;
    if (!s || s.invalid || !c.alive || !e || !a || j && j.endpointId !== id || at < s.lastAt) return false;
    s.lastAt = at;
    if (!j) return false;
    const dt = at - j.lastAt; if (dt <= 0) return false;
    j.lastAt = at;
    if (c.bodyEpoch !== j.bodyEpoch || !c.sourceCurrent || original(book, e.source.godId)?.god?.lifecycle.lifeState !== 'living') {
      release(a, office, communications, e); return true;
    }
    const ready = channel(s, book, communications, e, office, c, j.id) && (remote(j.kind) || attended(c)),
      p = communications?.ports?.find(p => p.id === e.source.pathId),
      work = ready && j.wasReady && p.usedAt !== at ? Math.min(dt, duration(j.kind) - j.progress, office.workSeconds, p.powerSeconds) : 0;
    j.wasReady = ready;
    if (!work) return false;
    office.workSeconds -= work; p.powerSeconds -= work; p.spentSeconds += work; p.usedAt = at; p.usedThisSecond = 4;
    j.progress += work;
    if (j.progress < duration(j.kind)) return true;
    const contact = e.contact, r = e.source, kind = j.kind, completedAt = at - Math.max(0, dt - work);
    if (kind === 'discover') {
      contact.state = r.disclosure === 'releaseScopedAddress' ? 'known' : 'withheld'; contact.disclosedAt = completedAt;
      contact.reply = { at: completedAt, text: contact.state === 'known'
        ? `Original custodian releases this retained ordinary mailbox: ${r.address}. It is not the individual’s location or a divine channel.`
        : 'The original custodian withholds its routing record. No address, personal reply or location was received.' };
    } else if (['request', 'accept'].includes(kind)) {
      if (kind === 'accept' && completedAt >= contact.offer.offerExpiresAt) {
        contact.state = 'known'; contact.reply = { at: completedAt, text: 'The exact offer expired before transmission completed. No acceptance was sent.' };
      } else {
        // One original ordinary attention account, never the dormant divine
        // receiving reserve and never another allocation for another branch.
        a.attentionSeconds -= ANSWER; a.spentAttention += ANSWER;
        contact.state = kind === 'request' ? 'requestSent' : 'acceptSent';
        release(a, office, communications, e);
        start(s, e, office, communications, c, kind === 'request' ? 'answer' : 'assent', completedAt);
        a.job.wasReady = ready; return true;
      }
    } else if (kind === 'answer') {
      const reason = motive(book, r);
      contact.pending = reason ? { kind: 'offer', at: completedAt, motive: reason } : { kind: 'refusal', at: completedAt };
      contact.state = 'replyReady';
    } else if (kind === 'assent') {
      const offer = contact.offer;
      if (!validOffer(e, contact, offer) || offer.motive !== motive(book, r) || completedAt >= offer.offerExpiresAt) contact.pending = { kind: 'refusal', at: completedAt };
      else {
        const payload = { ...copy(offer), at: completedAt, expiresAt: completedAt + DURATION };
        const agreement = { payload, seal: Owners.seal(book, r.godId, payload), breachedAt: null };
        book.agreements.push(agreement); contact.pending = { kind: 'agreement', at: completedAt, agreementId: payload.id };
      }
      contact.state = 'assentReady';
    } else if (kind === 'breach') {
      const incident = s.incidents.find(i => i.id === j.incidentId);
      if (incident) {
        incident.receivedAt = completedAt;
        for (const agreement of book.agreements.filter(a => a.payload.godId === r.godId && a.payload.protectedId === contact.clerkId
          && a.payload.bodyEpoch === contact.bodyEpoch && a.payload.at <= incident.at && incident.at < a.payload.expiresAt && a.breachedAt == null
          && a.seal === Owners.seal(book, r.godId, a.payload))) { agreement.breachedAt = completedAt; agreement.causeId = incident.id; }
      }
    } else if (kind === 'receive') {
      const pending = contact.pending;
      if (pending?.kind === 'offer') {
        contact.offer = { id: `ordinary-restraint:${r.godId}:${++s.serial}`, endpointId: id, godId: r.godId, branchId: r.branchId,
          protectedId: contact.clerkId, protectedName: contact.protectedName, bodyEpoch: c.bodyEpoch,
          at: completedAt, offerExpiresAt: completedAt + OFFER, scope: 'ownTerrestrialIntervention', duration: DURATION,
          terms: TERMS, motive: pending.motive };
        contact.state = 'offered'; contact.reply = { at: completedAt, text: 'Received the original individual’s exact conditional offer. Assent has not yet been given.' };
      } else if (pending?.kind === 'refusal') {
        contact.offer = null; contact.state = 'refused'; contact.reply = { at: completedAt, text: 'The original individual refuses personal terms with the heretic scientist. Descent creates no friendship or duty to help.' };
      } else {
        const agreement = book.agreements.findLast(a => a.payload.endpointId === id && a.payload.bodyEpoch === c.bodyEpoch);
        if (agreement && agreement.seal === Owners.seal(book, r.godId, agreement.payload)) {
          const payload = { id: `${agreement.payload.id}:received:${completedAt}`, endpointId: id, godId: r.godId, godName: r.godName,
            observedAt: agreement.breachedAt ?? (completedAt >= agreement.payload.expiresAt ? agreement.payload.expiresAt : agreement.payload.at), receivedAt: completedAt,
            expiresAt: agreement.payload.expiresAt, terms: TERMS, motive: agreement.payload.motive, limits: LIMITS,
            state: agreement.breachedAt != null ? 'receivedBreach' : completedAt >= agreement.payload.expiresAt ? 'receivedExpiredTerms' : 'receivedConditionalPersonalCommitment' };
          s.reports.push({ ...copy(payload), payload, seal: Owners.seal(book, r.godId, payload) });
          contact.state = 'agreed'; contact.reply = { at: completedAt, text: `${payload.state}. This is a dated received ordinary account, not divine confirmation or an endorsement.` };
        }
      }
      contact.pending = null;
    }
    release(a, office, communications, e); return true;
  }
  function observe(s, book, event, c, at) {
    if (!s || s.invalid || !c.alive || !c.witness || event.actorId !== 'scientist' || !event.id) return false;
    const e = s.endpoints.find(e => (!event.endpointId || e.source.id === event.endpointId) && e.contact?.clerkId === event.targetId && book.agreements.some(a => a.payload.endpointId === e.source.id
      && a.payload.bodyEpoch === c.bodyEpoch && a.payload.at <= at && at < a.payload.expiresAt && a.breachedAt == null));
    if (!e || s.incidents.some(i => i.id === event.id && i.godId === e.source.godId)) return false;
    s.incidents.push({ ...copy(event), godId: e.source.godId, endpointId: e.source.id, at, receivedAt: null }); return true;
  }
  function beginBreach(s, book, communications, id, office, c, at) {
    const e = row(s, id), a = account(s, e?.source.godId), incident = s?.incidents.find(i => i.endpointId === id && i.receivedAt == null && !i.allocated);
    if (!e || !a || a.job || !incident || a.attentionSeconds < ANSWER || office?.power < 1 || office?.workSeconds < ANSWER
      || !channel(s, book, communications, e, office, c)) return false;
    office.power--; a.attentionSeconds -= ANSWER; a.spentAttention += ANSWER;
    start(s, e, office, communications, c, 'breach', at); a.job.incidentId = incident.id; incident.allocated = a.job.id; return true;
  }
  function publicView(s) {
    if (!s || s.invalid) return [];
    return s.endpoints.filter(e => e.contact?.reply).map(e => ({ id: e.source.id, godName: e.source.godName,
      branchName: e.source.branchName, cityId: e.source.cityId, disclosedAt: e.contact.disclosedAt, reply: copy(e.contact.reply),
      address: e.source.disclosure === 'releaseScopedAddress' ? e.source.address : null,
      offer: e.contact.state === 'offered' ? copy(e.contact.offer) : null }));
  }
  function evidence(s) {
    return (s && !s.invalid ? s.reports : []).map(r => ({ id: r.id, sourceId: r.godId, seriesId: `ordinary-personal-restraint:${r.godId}:${r.endpointId}`,
      label: 'Received ordinary personal nonintervention account', status: 'unverified', observedAt: r.observedAt, receivedAt: r.receivedAt,
      account: { issuer: r.godName, scope: 'Named original individual’s conditional terrestrial nonintervention',
        findings: [r.state, r.terms, r.motive, `Disclosed deadline: ${r.expiresAt} game seconds.`], limits: LIMITS } }));
  }
  return { WORK, ANSWER, ATTENTION, OFFER, DURATION, TERMS, LIMITS, sources, create, normalize, rebind, channel, begin, advance,
    beginBreach, observe, publicView, evidence, duration, remote, row, account };
});
