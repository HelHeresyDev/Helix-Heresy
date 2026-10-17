(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCivicFoothold = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = 'Dated assessment of this municipal counter and received civic relationships only. Historical recognition is not perpetual command. No citywide control, army, immunity, divine assent, territorial claim or campaign accomplishment follows. Unknown opposition remains unknown.';
  const STATUSES = ['recorded', 'supported', 'blocked', 'withdrawn', 'exhausted', 'underway', 'unverified', 'disputed'];
  const text = x => typeof x === 'string' ? x.slice(0, 900) : '';
  const date = x => Number.isFinite(x) && x >= 0 ? x : null;
  const fact = x => x && date(x.at) != null && text(x.sourceId) && STATUSES.includes(x.status)
    ? { id: text(x.id), status: x.status, text: text(x.text), sourceId: text(x.sourceId), source: text(x.source), at: x.at } : null;
  const facts = xs => (Array.isArray(xs) ? xs : []).map(fact).filter(Boolean);
  function normalize(value) {
    if (!value || !text(value.worldId) || !text(value.cityId) || !text(value.officeId) || !text(value.installationId) || date(value.at) == null) return null;
    const dated = xs => facts(xs).filter(r => r.at <= value.at);
    return { worldId: text(value.worldId), cityId: text(value.cityId), cityName: text(value.cityName), officeId: text(value.officeId),
      installationId: text(value.installationId), bodyEpoch: Number.isInteger(value.bodyEpoch) ? value.bodyEpoch : null, at: value.at,
      recognition: dated(value.recognition), commands: dated(value.commands), access: dated([value.access])[0] || null, support: dated(value.support),
      opposition: dated(value.opposition), conclusion: ['limited', 'blocked', 'unverified'].includes(value.conclusion) ? value.conclusion : 'unverified', limitations: LIMITS };
  }
  function reason(site, c) {
    if (!site?.worldId || !site.cityId || !site.officeId || !site.installationId || !c.knownSite) return 'No personally known original civic foothold is available.';
    if (!c.alive || !c.capable || !c.free || !c.local || !c.atCounter || !c.visible || !c.supported || !c.visitPermission
      || c.cityId !== site.cityId || c.officeId !== site.officeId) return 'Physically attend the known accessible municipal counter, alive, capable and free. No clerk, fee or powered service is required to assess your own evidence.';
    return '';
  }
  function assess(previous, site, k, observed, c, now) {
    const old = normalize(previous);
    if (reason(site, c) || date(now) == null) return old;
    if (old && old.worldId === site.worldId && old.officeId === site.officeId && now < old.at) return old;
    const rows = { recognition: [], commands: [], support: [], opposition: [] };
    const valid = r => r?.id && date(r.at) != null && r.at <= now && (!r.cityId || r.cityId === site.cityId) && (!r.officeId || r.officeId === site.officeId);
    const add = (kind, id, status, description, sourceId, source, at) => {
      const row = fact({ id, status, text: description, sourceId, source, at });
      if (row && row.at <= now) rows[kind].push(row);
    };
    // Only received projections enter this function, never canonical actors,
    // their private dispositions, exact reserves or uncommunicated reports.
    const s = k.succession?.source?.cityId === site.cityId ? k.succession : null;
    const h = s?.handover, a = k.charter, u = k.administration?.installation?.id === site.installationId ? k.administration : null;
    const receivedNotice = u?.resistance?.notice?.receivedAt != null && u.resistance.notice.receivedAt <= now ? u.resistance.notice : null;
    const withdrawn = receivedNotice && u.resistance.commandStatus === 'suspended';
    if (valid(h)) {
      add('recognition', h.id, 'recorded', 'Received charter-backed successor handover; city-wide enforceability has not been established by this assessment.', h.id, 'Personally received handover', h.at);
      for (const agreement of s.agreements || []) {
        if (date(agreement.at) == null || agreement.at > now) continue;
        add('commands', `continuation:${agreement.personId}`, 'recorded', `${(agreement.roles || []).join(', ')}: ${agreement.scope || 'Original duties only'}. This continuation is historical, not verification that every duty is executable now.`,
          h.id, 'Received institutional continuation', agreement.at);
      }
      if (s.directive) add('commands', 'successionDirective', s.directive.status === 'completed' ? 'exhausted' : 'underway',
        'One original reserve-staging directive only; a completed instruction does not create a repeat queue.', h.id, 'Personally observed directive', s.reportedAt);
    }
    if (valid(k.abdication?.receipt)) add('recognition', k.abdication.receipt.id, 'disputed',
      'Received coerced personal declaration: a disputed claim, not recognized command or institutional handover.', k.abdication.receipt.id, 'Personally witnessed declaration', k.abdication.receipt.at);
    if (valid(a?.recognition)) {
      add('recognition', a.recognition.id, 'recorded', 'Received central-administration-only recognition; other institutions remain separate.', a.recognition.id, 'Received administrative recognition', a.recognition.at);
      const current = a.recordsPermissionCurrent;
      const reaffirmed = a.reaffirmation?.receipt, hasReconsideration = Boolean(a.reconsideration);
      const used = hasReconsideration ? Boolean(a.reaffirmation?.addendum) : Boolean(a.instruction);
      const receipt = valid(reaffirmed) ? reaffirmed : a.recognition;
      add('commands', 'centralAdministration', used ? 'exhausted' : current === true ? 'supported' : current === false ? 'blocked' : 'unverified',
        hasReconsideration ? 'One linked register addendum requires separate current records-only reaffirmation; an eligible hearing alone renews no assent.'
          : 'One scoped original-register memorandum only; no command of courts, watch, defense or public works.', receipt.id, 'Received records-duty authorization', a.reportedAt);
      if (a.originalFindingCurrent === false || a.personalReaffirmationRequired) add('recognition', 'findingCurrency', 'disputed',
        'Received evidence/reconsideration means the old finding or assent cannot be assumed current; original signatures remain history.', a.recognition.id, 'Received charter review status', a.reportedAt);
    }
    for (const [key, role, scope] of [
      ['works', 'publicWorksAndProvisioning', 'Existing counter public-works duties only; essential remediation remains separately available, not renewed discretionary consent.'],
      ['watch', 'civilWatch', 'One finite local observation/report duty only; no arrest, army or general enforcement.'],
      ['defense', 'militaryDefenseCommand', 'One finite protective ward-cover duty only; no army, replenished mana or standing city-defense command.']
    ]) {
      const v = k[key];
      if (v?.response?.decision === 'refused') add('opposition', `refusal:${role}:${v.response.at}`, 'recorded',
        v.response.reason || `The original ${role} officeholder personally declined this limited agreement.`, `${site.officeId}:${role}`, 'Received role-specific refusal', v.response.at);
      if (!valid(v?.receipt)) continue;
      add('recognition', v.receipt.id, 'recorded', `Received separate ${role} agreement; scope does not transfer to other roles.`, v.receipt.id, 'Received role-specific signature', v.receipt.at);
      const used = Boolean(v.duty && !['active', 'walking', 'returning', 'observing', 'covering'].includes(v.duty.status)) || (v.completions || []).length > 0;
      const status = role === 'publicWorksAndProvisioning' && withdrawn ? 'withdrawn' : used ? 'exhausted'
        : v.duty ? 'underway' : v.permissionCurrent === true ? 'supported' : v.permissionCurrent === false ? 'blocked' : 'unverified';
      add('commands', role, status, scope, v.receipt.id, 'Received role-specific permission status', v.reportedAt);
    }
    if (valid(h) && u) add('commands', 'publicWorksMaintenance', withdrawn ? 'withdrawn' : s.operative === true ? 'supported' : s.operative === false ? 'blocked' : 'unverified',
      withdrawn ? 'New discretionary public-works commands withdrawn according to the received notice. Accepted safe work and essential remediation retain their own rules.'
        : 'Original counter upkeep relationship recorded; actual supplies, attendance and continuing consent are still required.', h.id, 'Received local public-works account', u.reportedAt);
    if (u) add('support', 'reportedService', u.availability === 'Counter service available' ? 'recorded' : 'blocked',
      u.availability || 'Current service capacity not reported.', site.installationId, 'Dated received counter-service report', u.reportedAt);
    if (receivedNotice) add('opposition', receivedNotice.id, withdrawn ? 'withdrawn' : 'recorded',
      receivedNotice.finding || 'A factual public-works objection was personally received; it is not a criminal verdict or citywide revolt.', receivedNotice.id, 'Personally received objection', receivedNotice.receivedAt);
    for (const r of u?.resistance?.renewals || []) if (date(r.at) != null) add('opposition', r.id || `renewal:${r.at}`, 'recorded',
      'Separately received renewal of this public-works relationship; older objection history is retained.', r.id || site.installationId, 'Received renewal', r.at);
    for (const r of k.watch?.reports || []) if (r.communicatedAt != null) add('opposition', r.id, 'recorded',
      r.detail || r.finding || 'Received dated local witness report; no criminal guilt or unseen opposition is inferred.', r.id, 'Communicated watch report', r.communicatedAt);
    for (const r of k.abdication?.reports || []) add('opposition', r.id, 'recorded', r.detail || r.finding || 'Personally received witnessed conduct.', r.id, 'Received witnessed conduct', r.at);
    for (const r of s?.opposition || []) add('opposition', r.id || `conduct:${r.at}:${r.witnessId}`, 'recorded',
      r.detail || r.finding || 'Witnessed conduct retained in the original succession account.', r.id || h?.id, 'Received succession conduct account', r.at);
    if (a?.response?.decision === 'refused') add('opposition', `refusal:administration:${a.response.at}`, 'recorded',
      a.response.reason || 'The original administrator personally declined this limited agreement.', `${site.officeId}:administration`, 'Received administrative refusal', a.response.at);
    const protest = k.appointments?.opposition;
    if (protest?.formed && date(protest.reportedAt) != null) add('opposition', `receiving-approach:${protest.formed.at}`, 'recorded',
      `Personally observed receiving-approach opposition: ${protest.formed.objective || 'local installation access disputed'}. Last observed phase: ${protest.phase || 'unverified'}.`,
      `${site.officeId}:receiving-approach`, 'Dated direct observation of local opposition', protest.reportedAt);
    for (const r of k.appointments?.previousObjections || []) add('opposition', `archived-objection:${r.at}`, 'recorded',
      r.finding || 'A personally received earlier custodian objection remains historical evidence.', `${site.officeId}:previous-objection`, 'Received archived objection', r.at);
    // A fresh physical observation never re-dates an older political report.
    add('support', 'visiblePower', observed.powered === true ? 'supported' : observed.powered === false ? 'blocked' : 'unverified',
      observed.powered === true ? 'Counter power indicator is lit; exact battery reserves and staff capacity are not established.'
        : observed.powered === false ? 'Counter power indicator is unavailable; recognition and consent records remain unchanged.' : 'Counter power could not be established.',
      site.installationId, 'Direct local observation', now);
    add('support', 'visibleCondition', observed.serviceable === true ? 'supported' : observed.serviceable === false ? 'blocked' : 'unverified',
      observed.serviceable === true ? 'Local service installation appears available; this does not verify supplies, staff endurance or the rest of the city.'
        : observed.serviceable === false ? 'Local installation/service is visibly unavailable; restoration cannot renew withdrawn cooperation.' : 'Current installation condition is unverified.',
      site.installationId, 'Direct local observation', now);
    if (old && old.worldId === site.worldId && old.cityId === site.cityId && old.officeId === site.officeId) {
      for (const kind of ['recognition', 'opposition']) {
        const ids = new Set(rows[kind].map(r => r.id));
        rows[kind].push(...old[kind].filter(r => !ids.has(r.id)));
      }
    }
    const bodyChanged = rows.recognition.length && [h, a?.recognition].filter(valid).some(r => r.bodyEpoch != null && r.bodyEpoch !== c.bodyEpoch);
    if (bodyChanged) for (const row of rows.commands) if (row.status === 'supported') { row.status = 'unverified'; row.text += ' Original body authorization cannot be inherited by a changed body.'; }
    return normalize({ ...site, bodyEpoch: c.bodyEpoch, at: now, ...rows,
      access: { id: 'access', status: 'supported', text: 'Physically reached the known counter through ordinary permitted access.', sourceId: site.installationId, source: 'Direct local observation', at: now },
      conclusion: observed.powered === false || observed.serviceable === false ? 'blocked' : rows.commands.some(r => r.status === 'supported' && r.at === now) ? 'limited' : 'unverified' });
  }
  return { LIMITS, normalize, reason, assess };
});
