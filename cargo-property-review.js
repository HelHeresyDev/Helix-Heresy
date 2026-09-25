(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoPropertyReview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  // Authored named goods, not a mapping from arbitrary market or creature tags to offenses.
  const PRODUCTS = [
    ['unlicensedMutagenicPrimer', 'Unlicensed Mutagenic Primer'],
    ['arcaneCatalyticSuspension', 'Arcane Catalytic Suspension']
  ];
  function publish(gate, code, court, at) {
    if (gate.propertyRules || !court?.institutionId || !['prohibited', 'restricted'].includes(code?.legalStatus)) return;
    gate.judiciary = { ...copy(court), cityId: gate.cityId, active: true };
    gate.authorizations = [];
    gate.propertyRules = PRODUCTS.map(([productId, label]) => ({ id: `${gate.cityId}:cargo:${productId}`, cityId: gate.cityId,
      productId, label, offenseId: 'contrabandCommerce', publishedAt: at, effectiveAt: at, active: true,
      sourceCodeId: `city-code:${gate.cityId}`, authority: 'publishedCityCode', scope: 'destinationGateCargo', permitsSpecificAuthorization: true,
      text: `Published cargo schedule: ${label} is restricted at this city's gate unless specifically authorized. An identified consignment may be preserved for up to 24 hours for judicial verification. This does not prove knowing unlawful commerce.` }));
  }
  const ready = gate => gate?.active && gate.jurisdiction === 'city' && gate.judiciary?.active && gate.judiciary.cityId === gate.cityId && gate.judiciary.institutionId;
  function grounds(gate, sh, at) {
    if (!ready(gate) || gate.cityId !== sh.destinationId || sh.positionKm < sh.distanceKm - 1e-8) return null;
    for (const rule of gate.propertyRules || []) {
      if (!rule.active || rule.cityId !== gate.cityId || rule.scope !== 'destinationGateCargo' || rule.effectiveAt > at || rule.publishedAt > at) continue;
      // Only the physically readable label is observed. No hidden classification, genome, assay or culpability access.
      const entry = sh.manifest?.entries.find(e => e.stack?.chemicalBatch?.packaging?.state === 'packaged' && e.stack.chemicalBatch.label === rule.label && e.amount > 0);
      if (entry) return { rule, entry };
    }
    return null;
  }
  function issue(gate, sh, at) {
    if (sh.propertyOrder || !sh.inspection?.observations?.length) return false;
    const g = grounds(gate, sh, at); if (!g) return false;
    sh.propertyOrder = { id: `${sh.id}:property-order`, cityId: gate.cityId, institutionId: gate.judiciary.institutionId,
      institutionName: gate.judiciary.name || gate.judiciary.institutionId, officerId: sh.inspection.officerId,
      issuedAt: at, expiresAt: at + 86400, status: 'active', rule: copy(g.rule),
      purpose: 'Preserve the identified consignment for bounded verification of a published product restriction.',
      propertyIds: sh.manifest.entries.map(e => e.stack?.id || e.creature?.id || e.sourceReceptacleId),
      evidence: { at, observerId: sh.inspection.officerId, gateId: gate.id, cellId: gate.cellId,
        stackId: g.entry.stack.id, label: g.entry.stack.chemicalBatch.label, quantity: g.entry.amount,
        finding: 'Readable package label at the gate supports inquiry, not verified composition, knowledge or criminal guilt.' },
      owner: sh.owner, vehicleSeized: false, crewDetained: false, handlerCareAccess: true, petitions: [], decisions: [] };
    return true;
  }
  function petition(sh, kind, at, documentIds = []) {
    const order = sh?.propertyOrder;
    if (!order || order.status !== 'active' || at >= order.expiresAt || !['identity', 'jurisdiction', 'applicability', 'authorization'].includes(kind)
      || order.petitions.some(p => p.status === 'pending')) return false;
    order.petitions.push({ id: `${order.id}:petition:${order.petitions.length + 1}`, kind, submittedAt: at, reviewAt: at + 1800,
      status: 'pending', documentIds: [...new Set(documentIds)], channel: 'authenticatedRemotePropertyFiling' });
    return true;
  }
  function basis(gate, sh, order, petition, at) {
    if (!ready(gate) || gate.cityId !== order.cityId || gate.cityId !== sh.destinationId || gate.judiciary.institutionId !== order.institutionId) return 'No competent current local authority for this order.';
    const rule = gate.propertyRules?.find(r => r.id === order.rule.id);
    if (!rule?.active || rule.cityId !== order.cityId || rule.scope !== 'destinationGateCargo' || rule.publishedAt > order.issuedAt || rule.effectiveAt > order.issuedAt) return 'The cited published rule does not apply to this order.';
    const entry = sh.manifest?.entries.find(e => e.stack?.id === order.evidence.stackId);
    if (!entry || entry.stack.chemicalBatch?.packaging?.state !== 'packaged' || entry.stack.chemicalBatch.label !== order.evidence.label || rule.label !== order.evidence.label || entry.amount !== order.evidence.quantity) return 'The recorded property identification is not supported by the retained consignment.';
    const permit = (gate.authorizations || []).find(d => petition?.documentIds.includes(d.id) && d.status === 'active'
      && d.cityId === order.cityId && d.issuerId === order.institutionId && d.holderId === sh.owner && d.productId === rule.productId
      && d.scope === 'destinationGateCargo' && d.validFrom <= order.evidence.at && d.expiresAt > at && d.quantity >= entry.amount);
    return permit && rule.permitsSpecificAuthorization ? `Existing specific cargo authorization ${permit.id} covers this property.` : '';
  }
  function tick(gate, sh, at) {
    const o = sh.propertyOrder; if (!o || o.status !== 'active') return false;
    const p = o.petitions.find(p => p.status === 'pending' && p.reviewAt <= at);
    const reason = basis(gate, sh, o, p, at);
    if (p || reason || at >= o.expiresAt) {
      const release = Boolean(reason) || at >= o.expiresAt;
      const decision = { at, petitionId: p?.id || null, institutionId: gate?.judiciary?.institutionId || o.institutionId,
        result: release ? 'release' : 'upholdBoundedCustody',
        reason: reason || (release ? 'Temporary order expired; no renewal or forfeiture authority exists.' : 'Recorded label, exact property, applicable published restriction and local jurisdiction support temporary verification only. No criminal guilt determined.'),
        expiresAt: o.expiresAt };
      o.decisions.push(decision); if (p) p.status = 'decided';
      if (release) { o.status = 'released'; o.releasedAt = at; o.reason = decision.reason; for (const pending of o.petitions.filter(p => p.status === 'pending')) pending.status = 'moot'; return false; }
    }
    sh.phase = 'detained'; sh.custodian = gate.id; sh.inspection.status = 'propertySeized';
    sh.reason = `${o.id}: temporary cargo custody until ${o.expiresAt}; ownership unchanged, handler care permitted. Remote factual review available.`;
    sh.inspection.reason = sh.reason; return true;
  }
  return { publish, issue, petition, tick, grounds };
});
