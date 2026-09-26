(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-examination') : root.HelixCargoExamination,
    typeof module === 'object' && module.exports ? require('./cargo-investigations') : root.HelixCargoInvestigations);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoCriminalReferrals = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Exam, Investigations) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const PRODUCTS = ['unlicensedMutagenicPrimer', 'arcaneCatalyticSuspension'];
  const ELEMENTS = ['transaction', 'contraband', 'knowledge'];
  function provision(gate, law, prosecution, at) {
    if (!gate.criminalIntake && prosecution?.institutionId && gate.jurisdiction === 'city') {
      gate.criminalIntake = { institutionId: prosecution.institutionId, cityId: gate.cityId,
        reviewer: { id: `${gate.id}:intake-reviewer`, name: `${prosecution.name || prosecution.institutionId} intake reviewer`, status: 'alive', health: 100 },
        active: true, channelPowered: true, power: 12, lastAt: at, wasReady: false, referrals: [] };
    }
    Investigations.provision(gate, at);
    // Explicit criminal commerce schedule, separate from possession/property powers.
    if (!gate.criminalRule && law?.id && law.offenseId === 'contrabandCommerce' && law.legalStatus === 'prohibited'
      && ELEMENTS.every(id => law.elements?.some(e => e.id === id))) {
      gate.criminalRule = { id: `${gate.id}:criminal-commerce`, sourceLawId: law.id, cityId: gate.cityId,
        offenseId: law.offenseId, active: true, publishedAt: at, effectiveAt: at, products: [...PRODUCTS], elements: copy(law.elements),
        text: 'Knowing contraband commerce: a transfer, sale, purchase or delivery of a scheduled chemical, prohibited by this published city rule, with knowledge or deliberate disregard of its status. Presence or possession alone is not a transaction. Specific lawful authorization remains a defense.' };
    }
  }
  function packet(gate, sh) {
    const e = sh.examination, o = sh.propertyOrder;
    // Whitelist authority-visible sources. Never copy private chemistry, contract,
    // customer, scientist, owner ID, vehicle crew IDs, or internal financial records.
    return copy({ cityId: gate.cityId, arrivedAt: sh.inspection.arrivedAt, observation: o.evidence, productId: o.rule.productId,
      observations: sh.inspection.observations, personObservations: sh.inspection.personObservations || [], law: gate.criminalRule || null,
      reports: e.reports, challenges: e.challenges, examinationAuthority: e.authorization,
      samples: e.samples.map(s => ({ id: s.id, sourceStackId: s.sourceStackId, sourceBatchId: s.sourceBatchId,
        quantity: s.quantity, locationId: s.locationId, examinerId: s.examinerId, labId: s.labId,
        sealId: s.sealId, status: s.status, custody: s.custody, representation: s.representation || null })),
      authorization: Array.isArray(gate.authorizations) ? { checked: true, covering: gate.authorizations.filter(d => d.status === 'active'
        && d.cityId === o.cityId && d.issuerId === o.institutionId && d.holderId === o.owner && d.productId === o.rule.productId
        && d.scope === 'destinationGateCargo' && d.validFrom <= o.evidence.at && d.expiresAt > o.evidence.at && d.quantity >= o.evidence.quantity).map(d => d.id) } : { checked: false, covering: [] },
      property: { orderId: o.id, status: o.status, decisions: o.decisions,
        forfeiture: sh.forfeiture ? { id: sh.forfeiture.id, status: sh.forfeiture.status, decisions: sh.forfeiture.decisions } : null },
      actors: { identifiedSubjects: [], unresolvedRoles: ['sender', 'buyer', 'carrier', 'handler'],
        witnesses: [...new Set([o.evidence.observerId, ...e.reports.map(r => r.examinerId)])] } });
  }
  function capture(gate, sh, at) {
    const office = gate?.criminalIntake;
    if (!office || !sh.propertyOrder || !sh.examination || sh.living) return;
    let r = office.referrals.find(r => r.sourceOrderId === sh.propertyOrder.id);
    if (!r && !sh.examination.reports.some(p => p.method === 'sealedSampleConfirmatoryAssay' && p.supported && p.result === 'targetDetected')) return;
    const evidence = packet(gate, sh), signature = JSON.stringify(evidence);
    if (r?.signature === signature) return;
    if (!r) {
      r = { id: `${sh.propertyOrder.id}:criminal-referral`, sourceOrderId: sh.propertyOrder.id, submittedAt: at,
        status: 'queued', revisions: [], reviews: [], disclosed: [], reviewedRevision: 0 };
      office.referrals.push(r);
      sh.criminalReferralId = r.id; // Pointer only; no property or criminal-process mutation.
    }
    r.signature = signature; r.revisions.push({ at, evidence }); r.status = 'queued';
    r.progress = 0; r.startedAt = null;
  }
  function findings(e) {
    const law = e.law, at = e.arrivedAt;
    const applicable = law?.active && law.cityId === e.cityId && law.offenseId === 'contrabandCommerce'
      && law.sourceLawId && law.publishedAt <= at && law.effectiveAt <= at && law.products.includes(e.productId)
      && ELEMENTS.every(id => law.elements.some(el => el.id === id));
    const report = e.reports.find(r => r.method === 'sealedSampleConfirmatoryAssay' && r.result === 'targetDetected' && r.supported);
    const authority = e.examinationAuthority;
    const sample = e.samples.find(s => s.id === report?.sampleId);
    const confirmed = Boolean(report && sample && report.chainIntact && Exam.validChain(sample)
      && report.sourceStackId === e.observation.stackId && report.sourceBatchId === sample.sourceBatchId
      && sample.sourceStackId === report.sourceStackId && report.locationId === e.observation.gateId
      && sample.locationId === e.observation.gateId && authority?.scope === 'chemicalIdentification'
      && authority.cityId === e.cityId && authority.stackId === report.sourceStackId && authority.batchId === report.sourceBatchId
      && authority.institutionId === report.institutionId && report.at >= authority.issuedAt && report.at < authority.expiresAt
      && report.quality.skill >= 60 && report.quality.calibration >= 60);
    const observed = e.observations.some(o => o.observerId === e.observation.observerId && o.locationId === e.observation.gateId
      && o.at >= at && o.at <= e.observation.at && o.entryIds.includes(e.observation.stackId));
    const elements = [
      { id: 'transaction', support: [], missing: 'Gate presence is not evidence of a completed transfer, sale, purchase or delivery.' },
      { id: 'contraband', support: applicable && confirmed ? [report.id, law.id] : [], missing: 'Sample-scoped finding only; applicable authorization and any transaction scope require separate proof.' },
      { id: 'knowledge', support: [], missing: 'No authority-visible evidence attributes knowing participation to any person.' }
    ];
    if (!applicable) return { status: 'declined', reason: 'No prospective published local criminal offense covers this referral. Property powers cannot supply it.', elements };
    if (e.authorization.covering.length) return { status: 'declined', reason: 'The local registry records a covering specific authorization; no supported unlawful-commerce lead remains.', elements };
    if (!confirmed || !observed || !e.authorization.checked) return { status: 'awaitingCorroboration', reason: 'Awaiting reliable confirmation, attributable gate observation or authorization-registry verification. No missing evidence is generated.', elements };
    return { status: 'acceptedForInvestigation', reason: 'Accepted only as a sample-linked local lead. Transaction, actor attribution and knowledge remain unproved; no charges, warrant or arrest authorized.', elements };
  }
  function advanceGate(gate, at) {
    const o = gate?.criminalIntake; if (!o || at < o.lastAt) return;
    const ready = gate.active && gate.jurisdiction === 'city' && o.cityId === gate.cityId && o.active
      && o.channelPowered && o.reviewer.status === 'alive' && o.reviewer.health >= 50;
    let cursor = o.lastAt;
    const elapsedReady = ready && o.wasReady;
    o.lastAt = at; o.wasReady = Boolean(ready);
    if (!ready) return;
    for (const r of o.referrals.filter(r => r.reviewedRevision < r.revisions.length)) {
      const rev = r.revisions.at(-1);
      if (r.startedAt == null) {
        if (o.power < 1) return;
        o.power--; r.startedAt = Math.max(cursor, rev.at); r.progress = 0;
      }
      const start = Math.max(cursor, rev.at, r.startedAt), available = elapsedReady ? Math.max(0, at - start) : 0;
      const work = Math.min(1800 - r.progress, available); r.progress += work;
      if (r.progress < 1800) return;
      cursor = start + work;
      const result = findings(rev.evidence), review = { at: cursor, reviewerId: o.reviewer.id, institutionId: o.institutionId,
        revision: r.revisions.length, ...result };
      r.reviews.push(review); r.reviewedRevision = r.revisions.length; r.status = result.status;
      // A served informational notice is the only normal-player projection.
      r.disclosed.push({ at: cursor, reviewerName: o.reviewer.name, institutionId: o.institutionId, status: result.status,
        reason: result.reason, elements: copy(result.elements), revision: r.revisions.length,
        obligation: 'Informational notice only. No response or appearance required. No charge, custody authority or finding of guilt.' });
    }
  }
  function tick(gate, sh, at, state) {
    capture(gate, sh, at); advanceGate(gate, at);
    Investigations.advance(gate, at, state?.operators || [], state?.buyers || [], state?.witnessOffices || []);
  }
  function advance(state, at) {
    for (const gate of state.checkpoints || []) {
      for (const sh of state.shipments.filter(s => s.inspection?.gateId === gate.id)) capture(gate, sh, at);
      advanceGate(gate, at);
      Investigations.advance(gate, at, state.operators, state.buyers, state.witnessOffices || []);
    }
  }
  return { provision, tick, advance, findings };
});
