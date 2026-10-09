(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent,
    typeof module === 'object' && module.exports ? require('./local-services') : root.HelixLocalServices);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCitySuccession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme, Services) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const registry = Theme.createRegistry([{ id: 'succession.shared.designation', kind: 'citySuccession', compatibility: 'shared',
    template: 'Conditional designation and attended handover', contentTags: ['science', 'survival'], fallback: true }]);
  const CHARTERS = ['named experimental successor', 'designation by the reigning protector'];
  const ROLES = ['centralAdministration', 'civicReview', 'civilWatch', 'publicWorksAndProvisioning'];
  const MEETING = Object.freeze([{ x: 14, y: 8, z: 6 }, { x: 15, y: 8, z: 6 }, { x: 14, y: 9, z: 6 }, { x: 15, y: 9, z: 6 }, { x: 14, y: 10, z: 6 }].map(Object.freeze));
  const RECEIVING = Object.freeze({ x: 16, y: 12, z: 6 });
  const LIMITS = 'This city only. No army, legal immunity, divine endorsement, neighboring sovereignty or exclusive joint-stronghold command. Religious obligations, judicial independence, private property and outstanding legal cases remain. Historical recognition is not perpetual enforceability.';
  const capable = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hash = id => [...id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
  function sourceFromWorld(map, bargain) {
    const b = bargain?.source;
    const g = map?.cityGovernments?.governments.find(g => g.cityId === b?.cityId);
    const p = map?.cityPolities?.polities.find(p => p.cityId === b?.cityId);
    const row = map?.strategicPlayableSettlementState?.cityRows.find(r => r.cityId === b?.cityId);
    if (!g || !p || g.sovereigntyScope !== 'cityOnly' || p.authority.kind !== 'individual'
      || p.authority.id !== b.authority.id || g.charter.id !== b.charterId || !CHARTERS.includes(g.charter.successionPrinciple)
      || !row || row.currentPopulation < 8 || row.physicalCondition === 'ruined' || row.services?.fortifications === 'failed') return null;
    const roles = [...ROLES, 'militaryDefenseCommand'];
    const institutions = roles.map(role => g.institutions.find(i => i.id === g.roleAssignments[role]));
    if (institutions.some(i => !i || i.commandAuthorityId !== p.authority.id)) return null;
    const currents = institutions.map(i => map.strategicCivicHistory?.currentInstitutionRows.find(r => r.institutionId === i.id));
    if (currents.some(r => r && (r.actualControlStatus !== 'localCharter' || ['disrupted', 'displaced'].includes(r.operationalStatus)))) return null;
    const control = map.strategicPoliticalHistory?.currentControlRows.find(r => r.cityId === b.cityId);
    if (control && (control.recognizedAuthorityId !== p.authority.id || control.controlStatus !== 'sovereign')) return null;
    return { cityId: b.cityId, cityName: b.cityName, charterId: b.charterId, authority: copy(p.authority),
      succession: g.charter.successionPrinciple, populationSourceId: row.assetId,
      institutions: roles.map((role, n) => ({ role, id: institutions[n].id, name: institutions[n].publicName || institutions[n].name || role,
        responsibilities: copy(institutions[n].responsibilities || []) })) };
  }
  function create(source, bargain, office, options = {}) {
    if (!source || !CHARTERS.includes(source.succession) || source.authority.kind !== 'individual'
      || source.authority.id !== bargain?.source.authority.id || source.charterId !== bargain.source.charterId
      || source.cityId !== office?.cityId || !ROLES.every(role => source.institutions.some(i => i.role === role))) return null;
    const selected = Theme.selectContent(registry, { kind: 'citySuccession', worldTheme: options.theme || 'madcap', seed: source.cityId, required: true });
    if (!selected.ok) return null;
    const person = (id, name, role, cell) => ({ id, name, role, actorKind: 'civicOfficeholder', status: 'alive', health: 100, maxHealth: 100, fatigue: 0,
      workSeconds: 1800, roomId: 'supportedSurveyGround', locationId: office.id, mapCell: cell, assignment: null });
    const ruler = person(source.authority.id, source.authority.name, 'Incumbent sovereign — sole designation decision', { x: 15, y: 9, z: 6 });
    // A stable, lazily materialized preference of this existing person, not a
    // vacancy, new sovereign, convenient disaster or rerollable persuasion roll.
    ruler.retirementPolicy = hash(`${ruler.id}:${ruler.name}`) % 3 === 0 ? 'retainOffice' : 'considerAdministrativeRetirement';
    const leaders = [];
    for (const institution of source.institutions.filter(i => ROLES.includes(i.role))) {
      let actor = leaders.find(a => a.institutionId === institution.id);
      if (!actor) {
        const n = leaders.length;
        actor = { ...person(`${institution.id}:officeholder`, ['Sera Thorn', 'Darin Mere', 'Nessa Fen', 'Toren Vale'][hash(institution.id) % 4],
          `Existing ${institution.name} officeholder`, { x: 15 + n % 2, y: 10 + Math.floor(n / 2), z: 6 }), institutionId: institution.id, roles: [] };
        leaders.push(actor);
      }
      actor.roles.push(institution.role);
    }
    return { definitionId: selected.definitionId, sourceTheme: selected.sourceTheme, source: copy(source), officeId: office.id,
      ruler, leaders, allocation: { populationSourceId: source.populationSourceId, people: leaders.length + 1 },
      phase: 'idle', job: null, petitionId: null, decision: null, terms: null, provision: { key: 'metalParts', stock: 0, receipts: [] },
      agreements: [], control: null, handover: null, directive: null, opposition: [], history: [], message: '', nextNumber: 1 };
  }
  const normalize = s => s?.source?.charterId && Array.isArray(s.leaders) && Array.isArray(s.agreements) ? copy(s) : null;
  const people = (s, b) => s ? [s.ruler, ...s.leaders, b?.representative, b?.defender].filter(Boolean) : [];
  const working = s => Boolean(s?.job || s?.phase === 'approaching' || s?.directive?.status === 'carrying');
  function note(s, at, kind, text) { s.history.push({ at, kind, text }); s.history = s.history.slice(-40); s.message = text; }
  function localReason(s, b, office, c, own = false) {
    if (!s || s.officeId !== office?.id || office.cityId !== s.source.cityId || b?.source.charterId !== s.source.charterId
      || b.source.authority.id !== s.source.authority.id || c.charterCurrent !== true) return 'The original designation charter and physically supported institutions are required.';
    if (!c.alive || !c.capable || !c.atCounter || !c.visitPermission || !c.clerkPresent || !c.lineOfSight || c.busy
      || c.cityId !== s.source.cityId) return 'Attend the permitted civic counter, capable and free of other work.';
    if (!office.active || !office.channelPowered || !capable(office.clerk) || !c.administrationAvailable || !c.defenseAvailable
      || !c.institutionsAvailable || !c.participantsPresent || !c.leadersPresent) return 'Original ruler, defender and institutional leaders must be physically present and capable in their original offices.';
    if (!people(s, b).every(capable) || people(s, b).some(a => a.assignment && (!own || a.assignment !== s.id))
      || office.assignment && (!own || office.assignment !== s.job?.id)) return 'Existing civic people or the shared counter are assigned elsewhere.';
    const authority = s.control?.recognizedAuthorityId || s.source.authority.id;
    if (c.authorityId !== authority) return 'The current run authority does not match this succession.';
    return '';
  }
  function release(s, b, office, at) {
    if (office.assignment === s.job?.id) { office.assignment = null; office.availableAt = at; }
    for (const a of people(s, b)) if (a.assignment === s.id) a.assignment = null;
    s.job = null;
  }
  function begin(s, b, office, c, at, kind, seconds, targetId = null) {
    if (localReason(s, b, office, c) || working(s) || at < (office.availableAt || 0) || office.power < 1
      || office.workSeconds < seconds || people(s, b).some(a => a.workSeconds < seconds)) return false;
    s.id ||= `${s.source.cityId}:negotiated-succession`;
    s.job = { id: `${s.id}:work:${s.nextNumber++}`, kind, seconds, progress: 0, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch, targetId };
    office.power--; office.assignment = s.job.id;
    for (const a of people(s, b)) a.assignment = s.id;
    return true;
  }
  function serviceEvidence(s, mandate, service) {
    if (mandate?.authority.cityId !== s.source.cityId || mandate.authority.charterId !== s.source.charterId
      || mandate.authority.authorityId !== s.source.authority.id) return [];
    const ids = new Set();
    for (const m of mandate.mandates) for (const id of m.jobIds) {
      if (m.producerId !== service?.client.id || m.facilityId !== service.client.facilityId) continue;
      const j = service?.jobs.find(j => j.id === id && j.civic?.mandateId === m.id);
      if (j?.status === 'completed' && j.paidAt != null && j.receivedAt != null && j.result?.confidence >= Services.MIN_CONFIDENCE
        && ['clear', 'quarantine'].includes(j.civic.decision) && m.review?.status === 'completed' && m.review.outcome === 'upheld'
        && m.review.evidence.some(e => e.id === id && e.status === 'completed' && same(e.result, j.result))) ids.add(id);
    }
    return [...ids].sort();
  }
  function request(s, b, office, challenge, c, at) {
    if (!s || working(s) || s.handover || !['idle', 'refused', 'withdrawn'].includes(s.phase) || !c.alive || !c.capable
      || !c.atCounter || !c.visitPermission || c.busy || !c.participantsPresent || !c.charterCurrent || !c.institutionsAvailable
      || c.authorityId !== s.source.authority.id || office.assignment || b.representative.assignment || b.defender.assignment
      || !people(s, b).every(a => capable(a) && !a.assignment && a.workSeconds >= 240)
      || challenge?.petition?.status !== 'filedNotAccepted' || !challenge.receipt?.witnessId
      || challenge.receipt.outcome !== 'defenderConceded' || challenge.terms?.bodyEpoch !== c.bodyEpoch
      || challenge.receipt.defenderId !== b.defender.id || challenge.receipt.witnessId !== b.representative.id
      || challenge.receipt.bodyEpoch !== c.bodyEpoch || challenge.receipt.authorityId !== s.ruler.id
      || challenge.petition.receiptId !== challenge.receipt.id || challenge.petition.authorityId !== s.ruler.id
      || challenge.receipt.charterId !== s.source.charterId) return false;
    s.id ||= `${s.source.cityId}:negotiated-succession`;
    if (s.decision && same(s.decision.serviceIds, c.serviceIds)) return false; // Same evidence cannot reroll refusal.
    s.petitionId = challenge.petition.id; s.phase = 'approaching'; s.lastWalkAt = at;
    s.terms = null; s.agreements = [];
    for (const a of people(s, b)) a.assignment = s.id;
    note(s, at, 'summons', 'The filed request obtained a physical meeting, not acceptance. The existing ruler and officeholders are walking to the municipal hearing.'); return true;
  }
  function hear(s, b, office, c, at) {
    if (s?.phase !== 'ready') return false;
    return begin(s, b, office, c, at, 'hearing', 180);
  }
  function sign(s, b, office, expected, c, at) {
    if (localReason(s, b, office, c) || s.phase !== 'offered' || !same(s.terms, expected)
      || at >= s.terms.expiresAt || s.terms.bodyEpoch !== c.bodyEpoch || !s.terms.serviceIds.every(id => c.serviceIds.includes(id))) return false;
    s.phase = 'signed'; s.terms.signedAt = at;
    note(s, at, 'signature', 'Accepted the exact conditional designation, disclosed civic receipts and retained obligations. No office or goods have changed hands.'); return true;
  }
  function deliver(s, b, office, stacks, c, at) {
    if (localReason(s, b, office, c) || s.phase !== 'signed' || c.bodyEpoch !== s.terms.bodyEpoch || at >= s.terms.expiresAt) return false;
    const eligible = stacks.filter(i => i.key === 'metalParts' && i.carriedBy === 'scientist' && !i.reservedTaskId && !i.fixtureId
      && !i.containerId && !i.toolInstanceId && !i.tags?.includes('contaminated') && i.quantity >= 1);
    const amount = Math.min(s.terms.quantity - s.provision.stock, eligible.reduce((n, i) => n + Math.floor(i.quantity), 0));
    if (!amount || office.workSeconds < 30 || b.defender.workSeconds < 30) return false;
    let remaining = amount; const manifest = [];
    for (const i of eligible) { const n = Math.min(remaining, Math.floor(i.quantity)); if (!n) continue;
      manifest.push({ stackId: i.id, key: i.key, quantity: n }); i.quantity -= n; i.knownQuantity = Math.min(i.knownQuantity ?? i.quantity, i.quantity); remaining -= n; }
    office.workSeconds -= 30; b.defender.workSeconds -= 30; s.provision.stock += amount;
    s.provision.receipts.push({ id: `${s.id}:reserve:${s.provision.receipts.length + 1}`, at, manifest, quantity: amount, custodianId: b.defender.id });
    note(s, at, 'receipt', `${amount} actual carried metal parts entered the existing defense branch's conditional maintenance reserve. They remain in city custody even if transfer fails.`); return true;
  }
  function agreementActors(s, b) { return [...s.leaders, b.defender]; }
  const proofPresent = (s, c) => s.terms.serviceIds.every(id => c.serviceIds.includes(id));
  function agree(s, b, office, id, c, at) {
    if (s?.phase !== 'signed' || at >= s.terms.expiresAt || s.terms.bodyEpoch !== c.bodyEpoch
      || s.provision.stock !== s.terms.quantity || s.agreements.some(r => r.personId === id)
      || !agreementActors(s, b).some(a => a.id === id) || !proofPresent(s, c)) return false;
    if (id === b.defender.id && c.oppositionReports?.some(r => r.targetId === id && r.kind === 'attackOutsideAgreement')) {
      s.opposition = copy(c.oppositionReports);
      note(s, at, 'refusal', 'The defender declines continuation after witnessed force outside the training agreement. This is personal refusal, not a criminal conviction.'); return false;
    }
    return begin(s, b, office, c, at, 'continuation', 60, id);
  }
  function handover(s, b, office, c, at) {
    if (s?.phase !== 'signed' || at >= s.terms.expiresAt || c.bodyEpoch !== s.terms.bodyEpoch || !proofPresent(s, c)
      || s.provision.stock !== s.terms.quantity || agreementActors(s, b).some(a => !s.agreements.some(r => r.personId === a.id))) return false;
    return begin(s, b, office, c, at, 'handover', 180);
  }
  function cancel(s, b, office, at) {
    if (!s || s.directive?.cargo) return false;
    if (s.handover) {
      if (s.job?.kind !== 'directive') return false;
      release(s, b, office, at); s.directive = null;
      note(s, at, 'interruption', 'Cancelled unfinished order processing without undoing historical handover or restoring spent work. No reserve cargo had moved.'); return true;
    }
    release(s, b, office, at); s.phase = 'withdrawn';
    note(s, at, 'withdrawal', 'Withdrew without invented guilt. Spent work and city-held supplies remain; no transfer occurred.'); return true;
  }
  function operative(s, b, c) {
    return Boolean(s?.handover && c.alive && c.bodyEpoch === s.control.bodyEpoch && c.authorityId === 'scientist'
      && c.charterCurrent && c.institutionsAvailable && c.administrationAvailable && c.defenseAvailable
      && agreementActors(s, b).every(a => capable(a) && s.agreements.some(r => r.personId === a.id)));
  }
  function directive(s, b, office, c, at) {
    if (!operative(s, b, c) || localReason(s, b, office, c) || s.directive || s.provision.stock < 3) return false;
    const worker = s.leaders.find(a => a.roles.includes('publicWorksAndProvisioning'));
    if (!worker || worker.workSeconds < 120 || !begin(s, b, office, c, at, 'directive', 60, worker.id)) return false;
    s.directive = { id: `${s.id}:directive:stage-maintenance`, issuedAt: at, status: 'ordered', workerId: worker.id,
      key: 'metalParts', quantity: 3, sourceReceiptIds: s.provision.receipts.map(r => r.id), destination: copy(RECEIVING), cargo: null, receipt: null };
    note(s, at, 'directive', 'Ordered the named public-works officeholder to stage three existing reserve parts at the municipal receiving tile. No remote shipment or new stock was created.'); return true;
  }
  function advance(s, b, office, c, at, effects = {}) {
    if (!s || !c.alive) return false;
    if (!s.handover && s.terms && ['offered', 'signed'].includes(s.phase) && at >= s.terms.expiresAt) {
      release(s, b, office, at); s.phase = 'withdrawn';
      note(s, at, 'expiry', 'The conditional designation expired; no authority transferred. Existing physical reserve and spent work remain.'); return true;
    }
    if (s.phase === 'approaching') {
      const valid = c.charterCurrent && c.authorityId === s.source.authority.id && c.visitPermission && c.cityId === s.source.cityId;
      if (!valid) { cancel(s, b, office, at); return true; }
      const steps = Math.min(60, Math.max(0, Math.floor(at - s.lastWalkAt))); s.lastWalkAt = at;
      for (let n = 0; n < steps; n++) for (const [i, a] of [s.ruler, ...s.leaders].entries()) {
        const destination = MEETING[i];
        if (capable(a) && a.workSeconds > 0 && !same(a.mapCell, destination) && effects.move?.(a, destination)) a.workSeconds--;
      }
      if ([s.ruler, ...s.leaders].every((a, i) => same(a.mapCell, MEETING[i]))) {
        release(s, b, office, at); s.phase = 'ready'; note(s, at, 'arrival', 'The named ruler and institutional officeholders arrived physically. Attend the hearing; designation is still undecided.'); return true;
      }
    }
    const d = s.directive;
    if (d?.status === 'carrying') {
      const actor = s.leaders.find(a => a.id === d.workerId);
      const steps = Math.min(60, Math.max(0, Math.floor(at - d.lastAt))); d.lastAt = at;
      if (!operative(s, b, c) || !capable(actor) || actor.assignment !== s.id) return false;
      for (let n = 0; n < steps && actor.workSeconds > 0 && !same(actor.mapCell, d.destination); n++) if (effects.move?.(actor, d.destination)) actor.workSeconds--;
      if (same(actor.mapCell, d.destination)) {
        const stackId = effects.stage?.(copy(d.cargo), copy(d.destination));
        if (!stackId) return false; // Failed physical placement retains custody and cannot duplicate goods.
        d.receipt = { id: `${d.id}:receipt`, at, workerId: actor.id, stackId, quantity: d.quantity, destination: copy(d.destination) };
        d.cargo = null; d.status = 'completed'; actor.assignment = null;
        note(s, at, 'directiveCompleted', 'The named worker physically staged the original reserve parts. One bounded command was executed; future administration and resistance are not simulated by this receipt.'); return true;
      }
      return false;
    }
    const j = s.job;
    if (!j || at < j.lastAt) return false;
    if (!c.atCounter || !c.capable || !c.visitPermission || c.bodyEpoch !== j.bodyEpoch || c.cityId !== s.source.cityId) {
      release(s, b, office, at); if (j.kind === 'directive') s.directive = null;
      note(s, at, 'interruption', 'Attendance ended; no unattended handover or directive execution. Spent staff work remains spent.'); return true;
    }
    const available = !localReason(s, b, office, c, true) && people(s, b).every(a => a.workSeconds > 0) && office.workSeconds > 0;
    if (!available) { if (office.assignment === j.id) office.assignment = null; j.lastAt = at; j.wasReady = false; return false; }
    office.assignment = j.id;
    const start = Math.max(j.lastAt, office.availableAt || 0);
    const work = j.wasReady ? Math.min(Math.max(0, at - start), j.seconds - j.progress, office.workSeconds, ...people(s, b).map(a => a.workSeconds)) : 0;
    office.workSeconds -= work; for (const a of people(s, b)) a.workSeconds -= work;
    j.progress += work; j.lastAt = at; j.wasReady = true;
    if (j.progress < j.seconds) return false;
    const completedAt = start + work;
    if (j.kind === 'hearing') {
      const reason = s.ruler.retirementPolicy === 'retainOffice' ? 'The incumbent declines retirement; the witnessed bout cannot compel abdication.'
        : c.serviceIds.length < 3 ? 'Three actually received, paid, charter-reviewed civic dispositions are required; an appointment or ordinary supply sale is not governing experience.'
        : office.workSeconds >= 1800 && !c.administrationBacklogged ? 'No demonstrated outstanding administrative duty queue or finite-work bottleneck presently justifies this retirement proposal.' : '';
      s.decision = { at: completedAt, decisionMakerId: s.ruler.id, petitionId: s.petitionId, serviceIds: copy(c.serviceIds),
        outcome: reason ? 'refused' : 'conditionalDesignation', reason: reason || `${c.administrationBacklogged ? 'The existing administration has outstanding scheduled civic duties.' : 'The actual counter duty allocation is depleted.'} The incumbent will relinquish administrative rule to a demonstrated administrator while retaining personal independence, property and no automatic military command.` };
      s.phase = reason ? 'refused' : 'offered';
      if (!reason) s.terms = { id: `${s.id}:terms:${s.nextNumber++}`, offeredAt: completedAt, expiresAt: completedAt + 86400,
        cityId: s.source.cityId, charterId: s.source.charterId, succession: s.source.succession, rulerId: s.ruler.id,
        bodyEpoch: j.bodyEpoch, serviceIds: copy(c.serviceIds), quantity: 18, key: 'metalParts',
        procedure: 'Incumbent designation, explicit individual continuation agreements, then an attended recorded handover. No hereditary or collective shortcut.',
        duties: 'Honor the charter and independent judiciary, preserve existing staffing and defense duties, maintain the supplied branch reserve; wider administration requires further supported work.',
        retainedRights: 'Outgoing ruler remains a living private individual with property and faith; no confiscation, arrest, obedience or unearned pardon.', limitations: LIMITS };
      note(s, completedAt, 'decision', s.decision.reason);
    } else if (j.kind === 'continuation') {
      if (s.provision.stock !== s.terms.quantity || at >= s.terms.expiresAt || !proofPresent(s, c)) { release(s, b, office, completedAt); return true; }
      const a = agreementActors(s, b).find(a => a.id === j.targetId);
      s.agreements.push({ at: completedAt, personId: a.id, name: a.name, institutionId: a.institutionId,
        roles: copy(a.roles || ['militaryDefenseCommand']), termsId: s.terms.id, basis: 'Explicit voluntary continuation under the unchanged charter',
        scope: 'Original duties, personnel, property and independent legal/religious obligations only; no troops or indefinite personal loyalty.' });
      note(s, completedAt, 'continuation', `${a.name} explicitly accepted continuation of existing duties under the proposed successor.`);
    } else if (j.kind === 'handover') {
      if (at >= s.terms.expiresAt || s.provision.stock !== s.terms.quantity || !proofPresent(s, c)
        || agreementActors(s, b).some(a => !s.agreements.some(r => r.personId === a.id))) { release(s, b, office, completedAt); return true; }
      s.handover = { id: `${s.id}:handover`, at: completedAt, cityId: s.source.cityId, charterId: s.source.charterId,
        outgoingAuthorityId: s.ruler.id, recognizedAuthorityId: 'scientist', bodyEpoch: j.bodyEpoch, termsId: s.terms.id,
        witnesses: people(s, b).map(a => a.id), outgoingStatus: 'Living private individual; rights and obligations retained', limitations: LIMITS };
      s.opposition = copy(c.oppositionReports || []);
      s.control = { cityId: s.source.cityId, charterId: s.source.charterId, recognizedAuthorityId: 'scientist', bodyEpoch: j.bodyEpoch,
        sourceReceiptId: s.handover.id, commandRelationships: s.agreements.map(a => ({ personId: a.personId, institutionId: a.institutionId,
          roles: copy(a.roles), authorityId: 'scientist', agreementAt: a.at })), opposition: 'No undiscovered opposition has been surveyed; institutional consent is not citywide unanimity.' };
      s.phase = 'transferred'; note(s, completedAt, 'handover', 'The incumbent designated the scientist under the existing charter. The original institutional leaders witnessed physical handover; actual command is bounded by their separate agreements.');
    } else if (j.kind === 'directive') {
      if (operative(s, b, c) && s.provision.stock >= d.quantity) {
        s.provision.stock -= d.quantity; d.cargo = { key: d.key, quantity: d.quantity, cityId: s.source.cityId,
          sourceReceiptIds: copy(d.sourceReceiptIds), custodianId: d.workerId }; d.status = 'carrying'; d.lastAt = completedAt;
      } else s.directive = null;
    }
    release(s, b, office, completedAt);
    if (s.directive?.status === 'carrying') s.leaders.find(a => a.id === d.workerId).assignment = s.id;
    return true;
  }
  function publicView(s) {
    if (!s) return null;
    return { phase: s.phase, source: { cityId: s.source.cityId, cityName: s.source.cityName, charterId: s.source.charterId, succession: s.source.succession },
      contacts: [s.ruler, ...s.leaders].map(a => ({ id: a.id, name: a.name, role: a.role })),
      decision: copy(s.decision), terms: copy(s.terms), received: s.provision.receipts.reduce((n, r) => n + r.quantity, 0),
      agreements: copy(s.agreements), handover: copy(s.handover), control: copy(s.control), opposition: copy(s.opposition),
      directive: s.directive && { id: s.directive.id, status: s.directive.status, workerId: s.directive.workerId,
        quantity: s.directive.quantity, destination: copy(s.directive.destination), receipt: copy(s.directive.receipt) },
      working: s.job && { kind: s.job.kind, progress: s.job.progress, seconds: s.job.seconds }, message: s.message,
      history: copy(s.history), limitations: LIMITS };
  }
  return { CHARTERS, ROLES, MEETING, RECEIVING, LIMITS, sourceFromWorld, create, normalize, people, working, serviceEvidence,
    localReason, request, hear, sign, deliver, agree, handover, cancel, operative, directive, advance, publicView };
});
