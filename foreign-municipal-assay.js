(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./local-services') : root.HelixLocalServices,
    node ? require('./local-market-production') : root.HelixLocalMarketProduction,
    node ? require('./foreign-assay-workspace') : root.HelixForeignAssayWorkspace);
  if (node) module.exports = api;
  if (root) root.HelixForeignMunicipalAssay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Services, Production, Workspace) {
  'use strict';
  const FREIGHT = 8, BUDGET = Services.FEE + FREIGHT, copy = x => JSON.parse(JSON.stringify(x));
  const SCOPE = 'One supplier-consented sealed nonliving batch portion. 120 marks for a conclusive truthful report received within 48 hours; eight marks separately funded original local truck freight. Scientist supplies reagent and Assay Case. Findings are advisory, not an enforcement disposition, research license, divine endorsement or political recognition.';
  const capable = a => a?.status === 'alive' && Number.isFinite(a.health) && a.health >= 50 && Number.isFinite(a.fatigue) && a.fatigue < 80 && a.present !== false;
  function sourceFromWorld(map, cityId) {
    const g = map?.cityGovernments?.governments?.find(g => g.cityId === cityId);
    const row = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === cityId);
    const admin = g?.institutions?.find(i => i.id === g.roleAssignments.centralAdministration);
    const works = g?.institutions?.find(i => i.id === g.roleAssignments.publicWorksAndProvisioning);
    const branch = works?.branches?.find(b => b.role === 'publicWorksAndProvisioning' && b.id?.endsWith(':protected-provisioning'));
    if (!g?.charter?.id || g.sovereigntyScope !== 'cityOnly' || !row?.assetId || !Number.isFinite(row.currentPopulation) || row.currentPopulation < 8
      || row.physicalCondition === 'ruined' || ['abandoned', 'destroyed'].includes(row.habitationStatus)
      || !admin?.roles?.includes('centralAdministration') || !works?.roles?.includes('publicWorksAndProvisioning') || !branch
      || works.fundingInstitutionId !== admin.id || !admin.branches?.some(b => b.role === 'centralAdministration' && b.id?.endsWith(':treasury'))) return null;
    for (const i of [admin, works]) {
      const current = map.strategicCivicHistory?.currentInstitutionRows?.find(r => r.institutionId === i.id);
      if (!['functional', 'strong', 'exceptional'].includes(current?.currentCapacityBand || i.capacityBand)
        || map.strategicCivicHistory && (!current || ['displaced', 'disrupted'].includes(current.operationalStatus) || current.actualControlStatus !== 'localCharter')) return null;
    }
    // A bounded run-local procurement allocation from an existing funded office,
    // not its total treasury and never a replenishment on quotes, leases or loads.
    return { cityId, charterId: g.charter.id, administrationId: admin.id, institutionId: works.id, branchId: branch.id,
      name: works.publicName, populationSourceId: row.assetId, budgetSourceId: `${admin.id}:protected-provisioning-assay-allocation`, budget: BUDGET };
  }
  function create(source, w, privateAccount) {
    if (!source?.branchId || !source.populationSourceId || !source.budgetSourceId || source.budget !== BUDGET
      || source.cityId !== w?.property.cityId || source.administrationId !== w.source.administrationId || !privateAccount?.service) return null;
    return { source: copy(source), money: BUDGET, communicationSeconds: 900, quote: null, consent: null, nextNumber: 1,
      jobs: [], history: [], observation: null, bodyEpoch: null,
      actor: { id: `${source.branchId}:assay-customer`, name: ['Nera Iven', 'Soren Ash', 'Maren Holt'][[...source.branchId].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 3], institutionId: source.institutionId,
        actorKind: 'foreignMunicipalAssayRepresentative', kind: 'visitor', status: 'alive', health: 100, maxHealth: 100, fatigue: 0,
        present: true, roomId: w.roomId, mapCell: { x: w.site.entry.x - 2, y: w.site.entry.y, z: w.site.entry.z } },
      allocation: { people: 1, populationSourceId: source.populationSourceId, institutionId: source.institutionId, budgetSourceId: source.budgetSourceId, originalMarks: BUDGET } };
  }
  const sameSource = (s, c) => s && c.municipalSource && ['cityId', 'charterId', 'administrationId', 'institutionId', 'branchId', 'budgetSourceId', 'populationSourceId'].every(k => s.source[k] === c.municipalSource[k]);
  function contactReason(s, w, c, now) {
    if (!sameSource(s, c)) return 'No current source-backed municipal protected-provisioning customer supports this contract.';
    const reason = Workspace.workReason(w, c, now); if (reason) return reason;
    if (!c.atDesk || !c.municipalContact || c.busy || !capable(s.actor) || s.actor.roomId !== w.roomId
      || s.actor.id !== `${s.source.branchId}:assay-customer` || s.actor.institutionId !== s.source.institutionId
      || !Number.isFinite(s.communicationSeconds) || s.communicationSeconds < 60 || s.bodyEpoch != null && s.bodyEpoch !== c.bodyEpoch) return 'Personally attend the original municipal sample officer with the original free capable body.';
    return '';
  }
  function supplierReason(s, w, a, p, c, now) {
    if (contactReason(s, w, c, now)) return contactReason(s, w, c, now);
    if (!a || a.liaisonId !== w.actor.id || !c.contact || !capable(w.actor) || w.actor.roomId !== w.roomId
      || p?.cityId !== s.source.cityId || Services.available(a.service, p)) return 'Explicit consent requires the original supplier liaison, functioning chemical works and finite account work.';
    const f = p.facilities.find(f => f.id === a.service.client.facilityId);
    return f?.kind === 'chemicalWorks' && f.expertise?.includes('chemicalProcessing') && [f.condition, f.labour, f.utilities].every(Number.isFinite) ? '' : 'The original chemical supplier is unsupported.';
  }
  const line = (a, p) => p?.workshops?.find(l => l.facilityId === a?.service.client.facilityId && l.id === a.service.client.sampleGood);
  function note(s, at, kind, summary, sourceId = '') { s.history.push({ at, kind, summary, sourceId }); s.history = s.history.slice(-40); }
  function advance(s, a, p, now) {
    if (!s || !p) return false;
    let changed = false;
    if (s.consent?.status === 'held' && now >= s.consent.expiresAt && a?.service.client.facilityId === s.consent.supplierId && line(a, p)) {
      line(a, p).stock += s.consent.quantity; s.consent.quantity = 0; s.consent.status = 'expired'; s.quote = null; changed = true;
      note(s, now, 'consentExpired', 'Unbooked consenting supplier batch returned once; no sample or freight was created.');
    }
    for (const j of s.jobs) if (Services.active(j) && now > j.dueAt) { stop(s, j, now, 'expired'); changed = true; }
    return changed;
  }
  function stop(s, j, now, kind) {
    if (!Services.active(j)) return false;
    s.money += j.feeEscrow; j.feeEscrow = 0; j.status = kind; j.preview = null; j.lotStatus = 'supplierWithheld';
    note(s, now, kind, 'Unearned departmental fee refunded. Spent freight and shipped sample remain physical; supplier voluntarily withholds its untested remainder.', j.id); return true;
  }
  function action(s, w, a, p, c, now, kind, options = {}, wallet) {
    if (!s) return { ok: false, reason: 'No supported municipal customer exists.' };
    advance(s, a, p, now);
    const j = s.jobs.find(j => j.id === options.jobId);
    // Termination remains possible at the original retrieval desk after lease or
    // institutional support fails. It grants no work permission or fee income.
    if (kind === 'cancel' && Workspace.body(w, c) && Workspace.access(w, c, now) && c.atDesk && c.municipalContact
      && !c.busy && capable(s.actor) && s.actor.roomId === w.roomId && s.bodyEpoch === c.bodyEpoch)
      return { ok: Boolean(j && stop(s, j, now, 'cancelled')), job: j };
    const reason = contactReason(s, w, c, now); if (reason) return { ok: false, reason };
    if (kind === 'quote') {
      if (s.jobs.some(Services.active) || s.consent?.status === 'held' || !Number.isFinite(s.money) || s.money < BUDGET
        || s.communicationSeconds < 180 || a?.service.communicationSeconds < 120 || supplierReason(s, w, a, p, c, now)
        || !(line(a, p)?.stock >= 1) || !Production.serviceTruck(p) || now + Production.HOUR >= w.lease.endsAt)
        return { ok: false, reason: 'Original supplier batch, finite departmental fee/freight allocation and actual delivery capacity must all be available.' };
      s.communicationSeconds -= 60; s.actor.fatigue += .1;
      s.quote = { id: `${w.property.id}:municipal-offer-${s.nextNumber++}`, cityId: s.source.cityId, institutionId: s.source.institutionId,
        officerId: s.actor.id, propertyId: w.property.id, supplierId: a.service.client.facilityId, liaisonId: w.actor.id,
        tenant: c.tenant, bodyEpoch: c.bodyEpoch, issuedAt: now, expiresAt: now + 60, fee: Services.FEE, freight: FREIGHT,
        window: Services.WINDOW, consentId: null, scope: SCOPE };
      return { ok: true, quote: copy(s.quote) };
    }
    if (['consent', 'accept'].includes(kind)) {
      const q = s.quote;
      if (!q || now >= q.expiresAt || q.tenant !== c.tenant || q.bodyEpoch !== c.bodyEpoch || JSON.stringify(q) !== JSON.stringify(options.expected)
        || supplierReason(s, w, a, p, c, now) || s.jobs.some(Services.active)) return { ok: false, reason: 'Review the exact current supplier and municipal terms personally; no stale or substitute agreement.' };
      if (kind === 'consent') {
        if (q.consentId || !(line(a, p)?.stock >= 1)) return { ok: false, reason: 'No unreserved original supplier batch is available for this consent.' };
        const f = p.facilities.find(f => f.id === q.supplierId);
        line(a, p).stock -= 1; a.service.communicationSeconds -= 60; w.actor.fatigue += .1;
        s.consent = { id: `${q.id}:supplier-consent`, status: 'held', quantity: 1, supplierId: q.supplierId, liaisonId: q.liaisonId,
          sourceGood: line(a, p).id, burden: f.condition >= 85 ? 5 : f.condition >= 65 ? 35 : 65,
          givenAt: now, expiresAt: q.expiresAt, terms: SCOPE };
        q.consentId = s.consent.id;
        note(s, now, 'supplierConsent', 'Original supplier explicitly consents to municipal analysis of its held batch and voluntary withholding of an untested or contaminated remainder.', s.consent.id);
        return { ok: true, consent: copy(s.consent) };
      }
      const consent = s.consent;
      if (consent?.status !== 'held' || consent.id !== q.consentId || consent.supplierId !== q.supplierId || consent.quantity !== 1
        || !Number.isFinite(s.money) || s.money < BUDGET || !p.finance || p.finance.transportEarned != null && !Number.isFinite(p.finance.transportEarned)
        || !Production.serviceTruck(p) || now + Production.HOUR >= w.lease.endsAt)
        return { ok: false, reason: 'Exact supplier consent, original truck and finite city fee/freight funds are required.' };
      const sh = Production.bookServiceCargo(p, q.supplierId, 'diagnosticSample', 1, now,
        { cityId: q.cityId, propertyId: q.propertyId, endsAt: w.lease.endsAt, closed: false });
      if (!sh) return { ok: false, reason: 'Original supplier delivery could not be booked.' };
      const job = { id: `${q.id}:contract`, status: 'sampleInTransit', acceptedAt: now, dueAt: now + Services.WINDOW,
        feeEscrow: Services.FEE, sampleFreight: FREIGHT, sourceGood: consent.sourceGood, heldQuantity: .9, burden: consent.burden,
        lotStatus: 'supplierHeld', sampleAt: now, shipmentId: sh.id, consignmentId: sh.id, sampleStackId: '',
        result: null, preview: null, paidAt: null, receivedAt: null, reportReceipt: null, consent: copy(consent) };
      sh.serviceJobId = job.id; sh.sampleAt = job.sampleAt;
      s.money -= BUDGET; p.finance.transportEarned = (p.finance.transportEarned || 0) + FREIGHT; s.communicationSeconds -= 60; s.actor.fatigue += .1;
      consent.status = 'booked'; consent.quantity = 0; s.jobs.push(job); s.bodyEpoch = c.bodyEpoch; s.quote = null;
      note(s, now, 'accepted', 'City fee escrow and eight-mark freight funded separately; original supplier truck carries only the captured sealed portion.', job.id);
      return { ok: true, job };
    }
    if (kind === 'preview') return { ok: Boolean(Services.preview(s, options.jobId)) };
    if (kind === 'submit') {
      if (!j || j.status !== 'assayed' || now > j.dueAt || j.feeEscrow !== Services.FEE || !j.preview || JSON.stringify(j.preview) !== JSON.stringify(j.result)
        || !Number.isFinite(wallet?.money) || !['acceptable', 'contaminated'].includes(j.result.finding) || j.result.confidence < Services.MIN_CONFIDENCE)
        return { ok: false, reason: 'Personally review and deliver the exact conclusive funded report before the original deadline.' };
      j.reportReceipt = { at: now, reportId: j.result.id, sampleCollectedAt: j.sampleAt, institutionId: s.source.institutionId,
        officerId: s.actor.id, propertyId: w.property.id, finding: j.result.finding, scope: 'Advisory supplier batch assessment only' };
      wallet.money += j.feeEscrow; j.feeEscrow = 0; j.status = 'completed'; j.paidAt = now; j.preview = null;
      s.communicationSeconds -= 60; s.actor.fatigue += .1;
      // No government disposal command: the supplier's explicit consent already
      // specifies voluntary withholding. Even a clean report is not a civic release.
      j.lotStatus = 'supplierWithheld';
      note(s, now, 'completed', `Identified advisory ${j.result.finding} report personally received; equal 120-mark fee paid. Supplier retains its held remainder; no enforcement disposition issued.`, j.id);
      return { ok: true, job: j, amount: Services.FEE };
    }
    return { ok: false, reason: 'Unsupported municipal contract action.' };
  }
  function observe(s, w, c, now) {
    if (s && !contactReason(s, w, c, now)) s.observation = { at: now, source: copy(s.source), officerId: s.actor.id,
      quote: copy(s.quote), consent: s.consent ? { id: s.consent.id, status: s.consent.status, givenAt: s.consent.givenAt, expiresAt: s.consent.expiresAt } : null,
      jobs: s.jobs.map(j => ({ id: j.id, status: j.status, dueAt: j.dueAt, lotStatus: j.lotStatus, result: copy(j.result), reportReceipt: copy(j.reportReceipt) })), history: copy(s.history) };
    return s?.observation ? copy(s.observation) : null;
  }
  return { FREIGHT, BUDGET, SCOPE, sourceFromWorld, create, contactReason, action, advance, observe };
});
