(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixInstitutionalEvidence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const text = s => typeof s === 'string' && s.length > 0 && s.length <= 1000;
  const date = t => Number.isFinite(t) && t >= 0;
  function entry(id, sourceId, label, observedAt, receivedAt, seriesId, issuer, scope, findings, limits) {
    if (![id, sourceId, label, issuer, scope, limits].every(text) || !date(observedAt) || !date(receivedAt) || observedAt > receivedAt) return [];
    return [{ id, sourceId, label, status: 'unverified', observedAt, receivedAt, seriesId,
      account: { issuer, scope, findings: findings.filter(text).slice(0, 8), limits } }];
  }
  // Inputs are RELEASED reports only. Never pass a run, owner inventory,
  // private assessment or provider's current resources into this projection.
  function network(r) {
    if (!r || !Array.isArray(r.replies)) return [];
    const capability = r.purpose === 'institutionalCapabilityAccount', supply = r.purpose === 'municipalSupplyInterdiction';
    const limits = 'Only replying offices and exact terms. No complete institution, hidden ownership, military readiness, maps or worldwide nonintervention is established.';
    const result = entry(r.id, r.networkId, capability ? 'Received limited institutional capability accounts — wider powers unverified'
      : 'Received scoped network accessions/refusals — other capacities unverified', r.observedAt ?? r.at, r.at,
    `network-replies:${r.purpose || 'armedReceivingContest'}`, 'Replying offices through attended correspondence',
    'The received office correspondence only', [r.replies.length ? 'Individual dated office replies retain their own scopes and limits.' : 'No office reply is supplied by this received account.'], limits);
    for (const reply of r.replies || []) {
      if (!reply || !text(reply.branchId) || typeof reply.accepts !== 'boolean') continue;
      const s = reply.statement, findings = capability
        ? s?.disclosure === 'limited' ? ['This office supplied a limited account of its own functions.', ...(Array.isArray(s.functions) ? s.functions : [])]
          : ['This office did not disclose a complete capability account; withheld information does not establish hostility.']
        : [reply.accepts ? 'The reply records agreement to the named prospective restriction.' : 'The reply does not record acceptance of the proposed restriction.',
          supply ? 'A prospective deployment restriction and stand-down instruction are distinct from field radio receipt and physical withdrawal.'
            : 'Prospective discretionary finance/new-contract restrictions do not discharge earlier obligations or civilian protection.'];
      result.push(...entry(`${r.id}:office:${reply.branchId}`, reply.branchId, 'Received office-specific institutional reply', reply.at, r.at,
        `office-reply:${r.purpose || 'armedReceivingContest'}`, reply.label || 'Named replying office',
        capability ? 'Own-office function disclosure' : supply ? 'Named prospective municipal-interdiction restriction' : 'Named prospective discretionary-finance restriction', findings, limits));
    }
    return result;
  }
  function ground(r) {
    return !r || !text(r.id) ? [] : entry(r.id, r.branchId, 'Personally observed original receiving post', r.at, r.at,
      `ground-post:${r.id.split(':observed:')[0]}`, 'Personal observation at the original post', 'The named post and observation date', [r.text],
      'Own-premises defensive duty only. No whole-organization readiness, offensive command or permanent incapacity is established.');
  }
  function covert(r) {
    return !r ? [] : entry(r.id, r.ownerId, 'Received prospective local collection introduction', r.observedAt ?? r.at, r.at,
      `collection-introduction:${r.contractId}`, r.label || 'Named local broker', 'The exact nonliving collection request and dated quote',
      [r.available ? 'A prospective collection quote was received; no carrier or cargo was reserved.' : 'The dated introduction did not establish available collection support.'],
      'No government credential, carrier command, hidden-parent disclosure or governing leverage. Paid cargo and direct collection retain separate terms.');
  }
  function protection(r) {
    if (!r) return [];
    const findings = [];
    if (r.professional) findings.push(`Personally observed professional: ${r.professional.condition}.`);
    if (r.client) findings.push(`Personally observed client: ${r.client.condition}.`);
    if (r.phase && r.phase !== 'Local commitment status unverified') findings.push(`Personally observed local commitment: ${r.phase}.`);
    if (text(r.promise?.id)) findings.push('The held personal promise covers only its named people, body and receiving-approach terms.');
    return entry(`chapter-observation:${r.branchId}:${r.at}`, r.branchId, 'Received or observed local protective commitment', r.at, r.at,
      'personal-protection-observation', r.branch || 'Named local protective office', 'Named-person protection and the witnessed local scene', findings,
      'Neither a promise nor one observed withdrawal certifies the network, other bodies, supply field teams or permanent nonintervention.');
  }
  function charter(r) {
    return !r?.charter || !text(r.tripId) || !text(r.status) ? [] : entry(`flight-scope:${r.tripId}:${r.at}`, r.charter.ownerId, 'Received independent civilian aircraft charter', r.at, r.at,
      `civilian-flight:${r.tripId}`, 'Named pilot / receiving-point instructions or personal observation', 'The named independent aircraft, pilot and civilian round trip',
      ['The dated charter records this civilian trip, not institutional aircraft ownership.', `Received expedition account: ${r.status}.`],
      'No military passage, city admission, land title, orbital command or guaranteed future rescue. Unobserved fuel, readiness and ownership changes remain unknown.');
  }
  function service(kind, r, cityId, sourceId) {
    if (!r || !text(cityId) || !text(sourceId)) return [];
    const prefix = `city-service:${sourceId}:${kind}`, issuer = `Personally received ${kind} account — ${cityId}`;
    const make = (suffix, observedAt, scope, findings, limits) => entry(`${prefix}:${suffix}`, sourceId, `${issuer} — ${scope}`, observedAt, r.at,
      `${kind}:${scope}`, issuer, scope, findings, limits);
    if (kind === 'technical') {
      if (!text(r.powerId)) return [];
      const rows = [], inspection = r.inspection, method = r.method;
      if (inspection && inspection.powerId === r.powerId && date(inspection.at) && Number.isFinite(inspection.condition))
        rows.push(...make(`inspection:${inspection.at}`, inspection.at, 'Original plant regulator inspection',
          [`Measured regulator condition: ${inspection.condition}.`], 'A dated measurement of this plant only; not current remote condition, service independence or an institution-wide finding.'));
      if (method && method.powerId === r.powerId && date(method.at)) rows.push(...make(`method:${method.at}`, method.at, 'Retained original-plant regulator method',
        ['The scientist acquired inspection and material-backed repair knowledge for this specific plant; a fresh provider blessing is not required.'],
        'Retained knowledge is not bodily skill, spare parts, working tools, fuel, another plant\'s method, certification or sovereignty.'));
      return rows.length ? rows : make(`account:${r.at}`, r.at, 'Limited technical-service account',
        ['No plant-specific inspection or acquired method is established by this received account.'], 'No current remote condition or broader institutional resolution is established.');
    }
    if (kind === 'parts' && Array.isArray(r.assessments) && Array.isArray(r.policies)) return make(`account:${r.at}`, r.at, 'Original-plant parts policy and measured lots',
      [r.policy ? 'The received account records an adopted local parts standard; independent local measurement remains permitted.' : 'The received account records no adopted parts policy.',
        r.assessments?.length ? 'Dated assessments apply only to their measured lots, not all future material.' : 'No measured-lot assessment is supplied by this account.'],
      'A local standard is not a mandatory institutional blessing, general material guarantee, sovereignty or a network-wide veto.');
    if (kind === 'fuel') {
      if (!text(r.sourceLabel) || !date(r.contractAt) || !Array.isArray(r.deliveries) || !Array.isArray(r.notices)) return [];
      const findings = [r.cancelledAt != null ? 'The received account records cancellation of new procurement; paid cargo retains its existing terms.'
        : 'The received account records a standing procurement contract, subject to its price, funding and physical delivery terms.'];
      if (r.deliveries?.length) findings.push('Dated delivery receipts record fuel handed to this plant, not a permanent independent pipeline.');
      if (r.procurementHold) findings.push(`Reported procurement hold: ${r.procurementHold}`);
      return make(`account:${r.at}`, r.at, 'Original-plant fuel contract and delivery receipts', findings,
        'A contract or current buffer is not future delivery, producer ownership, a working replacement pipeline or worldwide institutional submission.');
    }
    if (kind === 'communications' && r.cityId === cityId && Array.isArray(r.purposes) && Array.isArray(r.acknowledgements)) return make(`account:${r.at}`, r.at, 'Enrolled municipal message classes',
      [r.adoptedAt != null ? `The received account records a selected path: ${r.pathLabel}.` : 'The received account records no new routing agreement.',
        r.acknowledgements?.length ? 'Dated acknowledgements establish only the recorded message work.' : 'No message acknowledgements are supplied by this account.'],
      'Enrollment is not delivery of a later order, current link availability, machine operation, satellite ownership or military/orbital command.');
    return [];
  }
  function city(r) {
    if (!r) return [];
    const rows = entry(`city-rule:${r.sourceId}:${r.at}`, r.sourceId, `Received city operating account — ${r.cityId}`, r.at, r.at,
      `city-control:${r.cityId}`, `Municipal operating account — ${r.cityId}`, 'Named city operating control',
      [`The dated operating account reports: ${r.status}.`], 'This received account is not a current remote observation, worldwide coverage, institutional submission or divine nonintervention.');
    if (rows.length) rows[0].status = r.status === 'established' && r.foodKg > 0 && r.waterLiters > 0 && r.energy > 0 ? 'control'
      : r.status === 'contested' ? 'challenge' : 'unverified';
    return rows;
  }
  return { network, ground, covert, protection, charter, service, city };
});
