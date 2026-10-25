(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./city-succession') : root.HelixCitySuccession,
    node ? require('./city-rule') : root.HelixCityRule, node ? require('./defender-challenges') : root.HelixDefenderChallenges,
    node ? require('./city-defense') : root.HelixCityDefense);
  if (node) module.exports = api;
  if (root) root.HelixRegionalGovernment = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Succession, Rule, Challenges, Defense) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const bound = (a, b) => a && b && a.worldId === b.worldId && a.runId === b.runId;
  const SCOPE = 'One original foreign city under its existing individual-designation charter. A received governing record supports a request, not acceptance. Original ruler, staff, defender, stock and finite power remain separate from every other city. No army, immunity, general city access, divine approval or automatic world-domination accomplishment.';
  function evidence(rule, bodyEpoch) {
    const r = rule?.report, a = r?.accomplishment;
    return a && r.sourceId === rule.id && r.cityId === rule.source.cityId && r.at >= a.at && a.at >= a.since + Rule.INTERVAL
      && rule.bodyEpoch === bodyEpoch ? { worldId: rule.worldId, runId: rule.runId, bodyEpoch, cityId: r.cityId,
        sourceId: r.sourceId, proofId: `${r.sourceId}:received:${r.at}:${a.at}`, reportAt: r.at, since: a.since, establishedAt: a.at } : null;
  }
  function layout(g, source) {
    const count = 1 + new Set(source.institutions.filter(i => Succession.ROLES.includes(i.role)).map(i => i.id)).size;
    const points = rows => rows.slice(0, count).map(([x, y]) => ({ x, y, z: g.z }));
    return { roomId: g.checkpointRoomId,
      homes: points([[6, 6], [6, 9], [7, 9], [8, 9], [12, 9]]),
      meeting: points([[8, 6], [8, 7], [8, 8], [9, 9], [11, 9]]) };
  }
  function create(g, sources, record, binding, at, occupiedIds = [], options = {}) {
    const b = g?.foreignCivic?.bargain, source = sources?.succession, operation = sources?.operation, defense = sources?.defense;
    if (!binding?.worldId || !binding.runId || !g?.materialized || !b || !source || !Rule.validSource(operation)
      || source.cityId !== g.cityId || operation.cityId !== g.cityId || source.charterId !== operation.charterId
      || source.authority.id !== b.source.authority.id || source.populationSourceId !== operation.populationSourceId
      || source.designationReview?.requiredAuthorizationIds?.length || !Defense.validSource(defense)
      || defense.cityId !== g.cityId || defense.charterId !== source.charterId || defense.populationSourceId !== operation.populationSourceId
      || defense.institutionId !== b.defender.institutionId || defense.population !== operation.population
      || !bound(record, binding) || !Succession.governingEvidence(record, g.cityId, record.bodyEpoch, at)) return null;
    const ground = layout(g, source), s = Succession.create(source, b, { id: `${g.id}:foreign-civic-counter`, cityId: g.cityId }, { ...options, layout: ground });
    if (!s || new Set([s.ruler.id, ...s.leaders.map(a => a.id)]).size !== s.leaders.length + 1
      || [s.ruler, ...s.leaders].some(a => occupiedIds.includes(a.id))) return null;
    const originals = [s.ruler, ...s.leaders, b.representative, b.defender, g.clerk, g.guard].filter(Boolean);
    if (new Set(originals.map(a => a.id)).size > operation.population) return null;
    Challenges.prepareDefender(b);
    return { ...binding, id: `${g.cityId}:regional-government`, gateId: g.id, cityId: g.cityId,
      originalClerkId: g.clerk.id, defenderId: b.defender.id, representativeId: b.representative.id,
      source: copy(operation), designation: copy(source), defense: copy(defense), layout: ground,
      evidence: copy(record), succession: s, rule: null, createdAt: at, lastAt: at, knowledge: null };
  }
  function normalize(v) {
    if (!v?.worldId || !v.runId || !v.gateId || !v.cityId || !v.originalClerkId || !v.defenderId || !v.representativeId
      || !Rule.validSource(v.source) || v.source.cityId !== v.cityId || !Defense.validSource(v.defense)
      || v.defense.cityId !== v.cityId || v.designation?.charterId !== v.source.charterId || !bound(v.evidence, v)
      || !Number.isFinite(v.createdAt) || !Number.isFinite(v.lastAt) || v.lastAt < v.createdAt
      || !Array.isArray(v.layout?.meeting) || !Array.isArray(v.layout?.homes)) return null;
    const s = Succession.normalize(v.succession), r = v.rule ? Rule.normalize(v.rule) : null;
    if (!s || s.source.cityId !== v.cityId || v.rule && !r || r && (!bound(r, v) || r.handoverId !== s.handover?.id)) return null;
    return { ...copy(v), succession: s, rule: r };
  }
  function office(g) {
    return { id: `${g.id}:foreign-civic-counter`, cityId: g.cityId, institutionId: g.institutionId,
      active: g.clerk.status === 'alive', channelPowered: g.powerSeconds > 0, maintenanceReady: true, clerk: g.clerk,
      workSeconds: Math.max(0, Math.min(g.receptionWorkSeconds, g.powerSeconds)), power: g.powerSeconds,
      assignment: g.receptionAssignment || null, availableAt: 0 };
  }
  function useOffice(g, fn) {
    const o = office(g), work = o.workSeconds, power = o.power, result = fn(o);
    const spent = Math.max(0, work - o.workSeconds); g.receptionWorkSeconds -= spent;
    g.powerSeconds = Math.max(0, g.powerSeconds - spent - Math.max(0, power - o.power)); g.receptionAssignment = o.assignment;
    return result;
  }
  function context(n, g, c) {
    const b = g?.foreignCivic?.bargain;
    const valid = bound(n, c) && n.gateId === g.id && n.originalClerkId === g.clerk.id && n.defenderId === b?.defender.id
      && n.representativeId === b?.representative.id && c.sourceCurrent === true && b.source.cityId === n.cityId
      && b.source.charterId === n.designation.charterId && b.source.populationSourceId === n.source.populationSourceId
      && b.source.authority.id === n.designation.authority.id;
    const own = Boolean(valid && n.succession.handover?.bodyEpoch === c.bodyEpoch && n.succession.control?.recognizedAuthorityId === 'scientist');
    const excluded = (c.bans || []).some(b => b.status === 'active' && (b.cityId === n.cityId || b.recognizedBy?.some(r => r.cityId === n.cityId && r.localOrderId && r.institutionId && r.status === 'active')));
    const permission = valid && !excluded && c.free && (c.visitorPermission || own);
    return { ...c, charterCurrent: valid, sourceCurrent: valid, visitPermission: permission,
      authorityId: own ? 'scientist' : n.designation.authority.id,
      governingEvidence: n.evidence, serviceIds: [], positionDisclosed: c.positionDisclosed === true,
      oppositionReports: n.incidents || [],
      administrationAvailable: valid && !n.consentWithdrawn && c.institutionsAvailable && g.powerSeconds > 0 && g.receptionWorkSeconds > 0,
      institutionsAvailable: c.institutionsAvailable && !n.consentWithdrawn,
      participantsPresent: c.originalPeoplePresent === true, leadersPresent: c.leadersPresent === true,
      busy: c.otherBusy === true, local: c.local === true, atCounter: c.atDesk === true,
      clerkPresent: c.clerkPresent && g.clerk.status === 'alive' && g.clerk.health >= 50,
      free: c.free === true && !c.otherBusy && permission, reportersPresent: permission && c.clerkPresent
        && g.clerk.status === 'alive' && g.clerk.health >= 50 && c.originalPeoplePresent && c.leadersPresent,
      coverageVerified: valid, counterpower: !valid || c.counterpowerUnknown ? 'unverified'
        : c.actualOpposition ? 'capableOpposition' : 'noEstablishedChallenge' };
  }
  function people(n, g) { return [...n.succession.leaders, g.foreignCivic.bargain.defender]; }
  function observe(n, g, c, at) {
    if (!c.alive || !c.capable || !c.local || !c.atCounter || !c.visitPermission || !c.clerkPresent || !c.lineOfSight
      || !c.originalPeoplePresent || !c.leadersPresent) return false;
    n.knowledge = { at, cityId: n.cityId, succession: Succession.publicView(n.succession), report: copy(n.rule?.report || null) }; return true;
  }
  function advance(n, g, c, at, effects = {}) {
    if (!n || !c.alive || !Number.isFinite(at) || at < n.lastAt) return false;
    let ctx = context(n, g, c), changed = useOffice(g, o => Succession.advance(n.succession, g.foreignCivic.bargain, o, ctx, at, effects));
    if (n.succession.handover && !n.rule) {
      n.rule = Rule.createAggregate(n.source, n.succession, { worldId: n.worldId, runId: n.runId }, n.succession.handover.at,
        { id: n.defense.installationId, initialEnergy: n.defense.baselineEnergy });
      changed ||= Boolean(n.rule);
    }
    ctx = context(n, g, c);
    if (n.rule) changed = Rule.advance(n.rule, n.succession, people(n, g), () => ctx, at) || changed;
    n.lastAt = at; return changed;
  }
  function action(n, g, c, action, expected, at, stacks = []) {
    if (!n || !c.alive || !c.capable) return false;
    const ctx = context(n, g, c), b = g.foreignCivic.bargain;
    let ok = false;
    useOffice(g, o => {
      if (action === 'request') ok = Succession.requestDesignation(n.succession, b, o, ctx, at);
      if (action === 'hear') ok = Succession.hear(n.succession, b, o, ctx, at);
      if (action === 'sign') ok = Succession.sign(n.succession, b, o, expected, ctx, at);
      if (action === 'deliver') ok = Succession.deliver(n.succession, b, o, stacks.filter(i => !i.cityOwnerId && !i.civicCustody
        && (!i.legalOwnerId || i.legalOwnerId === 'scientist') && (!i.ownerId || i.ownerId === 'scientist')), ctx, at);
      if (action === 'agree') ok = Succession.agree(n.succession, b, o, expected, ctx, at);
      if (action === 'handover') ok = Succession.handover(n.succession, b, o, ctx, at);
      if (action === 'cancel') ok = Succession.cancel(n.succession, b, o, at);
    });
    if (n.rule) {
      if (action === 'operate') ok = Rule.order(n.rule, n.succession, people(n, g), ctx, at);
      if (action === 'recharge') ok = Rule.recharge(n.rule, n.succession, people(n, g), ctx, stacks, at, expected == null ? 1 : expected);
      if (action === 'report') ok = Rule.receive(n.rule, n.succession, people(n, g), ctx, at);
    } else if (action === 'report') ok = observe(n, g, ctx, at);
    if (ok) observe(n, g, ctx, at); return ok;
  }
  function publicView(n) { return { knowledge: copy(n?.knowledge || null), scope: SCOPE }; }
  function aggression(n, g, c, targetId, actionId, at) {
    const targets = [n.succession.ruler, ...people(n, g), g.foreignCivic.bargain.representative, g.clerk];
    if (!c.alive || !c.local || !c.witnessed || !targets.some(a => a.id === targetId)) return false;
    n.incidents ||= [];
    n.incidents.push({ at, targetId, actionId, kind: 'attackOutsideAgreement', witnessed: true });
    const a = n.succession.agreements.find(a => a.personId === targetId);
    if (a) a.suspendedRoles = copy(a.roles);
    // A witnessed attack ends this voluntary route, not a legal conviction or
    // automatic coup. Death/incapacity also removes actual authority via Rule.
    n.consentWithdrawn = true;
    if (!n.succession.handover) useOffice(g, o => Succession.cancel(n.succession, g.foreignCivic.bargain, o, at));
    return true;
  }
  function rebind(v, from, to) {
    const n = normalize(v); if (!bound(n, from) || !to?.worldId || !to.runId) return null;
    Object.assign(n, to); if (n.rule) Object.assign(n.rule, to);
    for (const e of [n.evidence, n.succession.governingEvidence, n.succession.terms?.governingEvidence,
      n.knowledge?.succession?.terms?.governingEvidence]) if (bound(e, from)) Object.assign(e, to);
    return n;
  }
  return { SCOPE, evidence, layout, create, normalize, office, context, people, action, advance, observe, aggression, publicView, rebind };
});
