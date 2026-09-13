(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixCityTrial = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const CHALLENGES = Object.freeze({ identity: "Challenge attribution", observation: "Question the crossing observation", notice: "Challenge prior notice", authority: "Challenge local authority and scope", permission: "Present the historical permission record" });
  const DURATIONS = Object.freeze({ prosecution: 600, defense: 600, deliberation: 900, sentencing: 600 });
  function open(c, now) {
    const h = c.pretrial?.handoff;
    if (c.trial || c.status !== "awaitingLocalTrial" || !h?.evidencePacket) return null;
    return c.trial = { id: `${c.id}:trial`, caseId: c.id, cityId: c.cityId, personId: c.personId, openedAt: now, phase: "preparation", nextAt: null,
      packet: clone(h.evidencePacket), handoff: clone(h), officials: clone(c.pretrial.legal.proceedings[0].court), challenges: [], arguments: [], notice: null, notices: [], permit: null,
      adjournments: [], stageSeconds: 0, lastAt: now, delay: "", testimony: null, findings: [], judgment: null, sentence: null, refundDue: 0, physicalRelease: null, history: [] };
  }
  function challenge(t, kind, now) {
    if (!["preparation", "adjourned", "scheduled"].includes(t.phase) || !CHALLENGES[kind] || t.challenges.includes(kind)) return false;
    t.challenges.push(kind); t.arguments.push({ kind, at: now, packetId: t.packet.id, summary: `${CHALLENGES[kind]} using the disclosed record; this submission adds no evidence or admission.` }); return true;
  }
  function attendanceReason(f) {
    if (!f.channel) return "The local records channel is unpowered.";
    if (!f.localAccess) return "The defendant is not at this city's permitted checkpoint or temporary jail. A real return journey must be arranged before a new notice.";
    if (!f.routeAvailable) return "The physical court route is obstructed.";
    if (!f.officialsAvailable || !f.counselAvailable || !f.witnessAvailable) return "A named judicial participant, witness, counsel or escort is unavailable.";
    return "";
  }
  function serve(t, f, now) {
    if (!["preparation", "adjourned"].includes(t.phase) || attendanceReason(f)) return false;
    t.notice = { id: `${t.id}:notice-${t.notices.length + 1}`, servedAt: now, trialAt: now + 7200, windowEndsAt: now + 10800,
      cityId: t.cityId, personId: t.personId, servedById: f.clerkId, route: clone(f.route), status: "served" };
    if (!f.clerkId || !f.route?.from || !f.route?.to) { t.notice = null; return false; }
    t.notices.push(clone(t.notice)); t.permit = { id: `${t.notice.id}:attendance`, cityId: t.cityId, personId: t.personId, status: "active", scope: "supervisedCheckpointCourtAndEgressOnly", generalAdmission: false };
    t.phase = "scheduled"; t.nextAt = t.notice.trialAt; t.delay = ""; t.history.push({ at: now, action: "noticeServed", summary: "Two hours of preparation and a one-hour arrival window; physical attendance remains necessary." }); return true;
  }
  function adjourn(t, reason, now) {
    if (["completed", "sentenceHandoff", "preparation", "adjourned"].includes(t.phase)) return false;
    t.adjournments.push({ at: now, reason, previousPhase: t.phase, noticeId: t.notice?.id });
    if (t.notice) t.notice.status = "adjourned";
    if (t.permit) t.permit.status = "egressOnly";
    t.phase = "adjourned"; t.nextAt = null; t.stageSeconds = 0; t.interruptionAt = null; t.lastAt = now; t.delay = `${reason} No failure-to-appear finding, new charge or bail forfeiture has been made.`; return true;
  }
  function tick(t, f, now) {
    if (t.sentence?.kind === "supervision" && t.sentence.status === "active" && now >= t.sentence.endsAt) { t.sentence.status = "completed"; t.history.push({ at: now, action: "supervisionEnded", summary: "The finite supervision period ended; any separately witnessed new offense remains a separate case." }); return true; }
    if (t.phase === "escortPending" && now > t.notice.windowEndsAt) return adjourn(t, "The physical escort could not complete within the served arrival window.", now);
    if (t.phase !== "scheduled") return false;
    if (now > t.notice.windowEndsAt) return adjourn(t, "Attendance was not completed within the served window; its cause requires review, not an automatic evasion finding.", now);
    if (now >= t.notice.trialAt) { t.nextAt = t.notice.windowEndsAt + 1; const reason = attendanceReason(f); if (reason) return adjourn(t, reason, now); }
    return false;
  }
  function attend(t, f, now) {
    if (t.phase !== "scheduled" || now < t.notice.trialAt || now > t.notice.windowEndsAt || attendanceReason(f) || t.permit?.status !== "active") return false;
    t.phase = "escortPending"; t.nextAt = now + 1; t.lastAt = now; return true;
  }
  function present(t, f) { return f.present && f.channel && f.officialsAvailable && f.counselAvailable && f.witnessAvailable && f.judgeId === t.officials.judge.id && f.prosecutorId === t.officials.prosecutor.id && f.witnessId === t.packet.evidence.observerId; }
  function begin(t, f, now) {
    if (t.phase !== "escortPending" || !present(t, f)) return false;
    t.phase = t.judgment?.verdict === "guilty" ? "sentencingReady" : "prosecution"; t.stageSeconds = 0; t.lastAt = now; t.nextAt = t.phase === "prosecution" ? now + DURATIONS.prosecution : null; t.delay = ""; return true;
  }
  function findings(t) {
    const f = t.packet.evidence, b = f.restriction, law = f.localLaw?.rule, definition = f.localLaw?.definition, notice = f.notice, witness = t.testimony;
    const distance = f.cell && f.observerCell && f.cell.z === f.observerCell.z ? Math.abs(f.cell.x - f.observerCell.x) + Math.abs(f.cell.y - f.observerCell.y) : Infinity;
    const sourceMatches = witness?.sourcePersonId === t.personId && t.packet.sourcePersonId === t.personId;
    const scope = b?.status === "active" && b.personId === t.personId && (b.cityId === t.cityId || b.recognizedBy?.some(r => r.cityId === t.cityId && r.status === "active" && r.localOrderId && r.institutionId));
    const validRule = law?.id === f.localLaw?.id && law?.offenseId === "warrantObstruction" && law.legalStatus === "prohibited" && definition?.id === law.offenseId;
    const proof = {
      identity: [Boolean(f.identified && sourceMatches), "The crossing identification and authenticated source attribution concern this defendant."],
      obstructiveAct: [Boolean(f.crossed && f.observed && f.prohibited && f.cell?.x >= 14 && f.cell?.y >= 5 && f.cell?.y <= 10 && distance <= 8 && witness?.confirmed && witness.observerId === f.observerId), "The identified witness's saved observation establishes physical passage beyond the exclusion checkpoint, materially defeating the lawful exclusion."],
      lawfulProcess: [Boolean(validRule && scope && !f.permits?.annexAuthorized), "The contemporaneous published local rule and exclusion instrument covered the act; no historical permission authorized it."],
      knowledge: [Boolean(f.knowing && notice?.observed && notice.identified && notice.officerId && notice.personId === t.personId && notice.orderId === b?.orderId && notice.at <= t.packet.crossingAt), "Communicated notice preceded the deliberate crossing and concerned this person and order."]
    };
    const elements = [{ id: "identity", label: "Identity of the accused" }, ...(definition?.elements || [])];
    if (!definition?.elements?.length) elements.push({ id: "missingLocalElements", label: "Published offense elements" });
    return elements.map(element => { const [proven, reason] = proof[element.id] || [false, "No supported proof rule exists for this published element."]; return { id: element.id, label: element.label, proven, standard: "beyondReasonableDoubt", supportIds: [t.packet.id, t.testimony?.id].filter(Boolean), reason: proven ? reason : `Reasonable doubt: ${reason} The required corroborating facts are missing, inconsistent or contradicted.`, challengesConsidered: [...t.challenges] }; });
  }
  function conclude(t, c, verdict, now, reason) {
    if (t.judgment) return false;
    t.judgment = { id: `${t.id}:judgment`, cityId: t.cityId, caseId: c.id, at: now, judgeId: t.officials.judge.id, verdict, findings: clone(t.findings), reason };
    c.judgment = clone(t.judgment); c.reason = reason;
    if (verdict === "guilty") { t.phase = "sentencingReady"; t.nextAt = null; }
    else finish(t, c, now);
    return true;
  }
  function advance(t, c, f, now) {
    if (!Object.hasOwn(DURATIONS, t.phase)) return false;
    const elapsed = Math.max(0, now - t.lastAt); t.lastAt = now;
    if (!present(t, f)) {
      t.interruptionAt ??= now; t.delay = "Hearing work is paused while a required participant or powered records is unavailable; no completed attendance is fabricated."; t.nextAt = now + 60;
      return now - t.interruptionAt >= 1800 ? adjourn(t, "A required participant or records channel remained unavailable for thirty minutes of hearing time.", now) : false;
    }
    t.interruptionAt = null;
    if (t.delay) { t.delay = ""; t.nextAt = now + Math.max(1, DURATIONS[t.phase] - t.stageSeconds); return false; }
    t.stageSeconds += elapsed;
    if (t.stageSeconds < DURATIONS[t.phase]) { t.nextAt = now + DURATIONS[t.phase] - t.stageSeconds; return false; }
    t.stageSeconds = 0;
    if (t.phase === "prosecution") {
      t.testimony = { id: `${t.id}:testimony`, at: now, observerId: f.witnessId, confirmed: true, sourcePersonId: f.sourcePersonId, packetId: t.packet.id };
      t.phase = "defenseReady"; t.nextAt = null;
    } else if (t.phase === "defense") { t.phase = "deliberation"; t.nextAt = now + DURATIONS.deliberation; }
    else if (t.phase === "deliberation") { t.findings = findings(t); const guilty = t.findings.every(e => e.proven); conclude(t, c, guilty ? "guilty" : "notGuilty", now, guilty ? "Every local offense element was established from the admitted records and tested witness evidence. No pretrial finding supplied proof of guilt." : "The prosecution did not establish every required element beyond reasonable doubt."); }
    else if (t.phase === "sentencing") { sentence(t, c, f, now); }
    return true;
  }
  function defense(t, now) {
    if (t.phase !== "defenseReady") return false;
    t.history.push({ at: now, action: "defensePresented", summary: `The defense addressed ${t.challenges.join(", ") || "the prosecution's burden without admissions"}. Silence and contesting guilt create no false-statement offense.` });
    t.phase = "defense"; t.lastAt = now; t.stageSeconds = 0; t.nextAt = now + DURATIONS.defense; return true;
  }
  function dismiss(t, c, f, now) {
    if (!["preparation", "scheduled", "adjourned"].includes(t.phase) || !f.channel || !f.officialsAvailable || f.prosecutorId !== t.officials.prosecutor.id) return false;
    const rule = t.packet.evidence.localLaw?.rule;
    if (f.sourcePersonId === t.personId && rule?.legalStatus === "prohibited" && rule.offenseId === "warrantObstruction") return false;
    return conclude(t, c, "dismissed", now, "The receiving-city prosecution withdrew an unsupported attribution or local charge before trial; no finding of guilt was entered.");
  }
  function applyIdentityCorrection(t, c, now) {
    if (c.status !== "dismissedIdentityError" || t.judgment) return false;
    return conclude(t, c, "dismissed", now, "A completed local judicial applicability review established wrong-person attribution and withdrew the custody order before judgment.");
  }
  function requestSentence(t, kind, now) {
    if (t.phase !== "sentencingReady" || !["proportionateFine", "supervision"].includes(kind)) return false;
    t.submission = kind; t.phase = "sentencing"; t.lastAt = now; t.stageSeconds = 0; t.nextAt = now + DURATIONS.sentencing; return true;
  }
  function sentence(t, c, f, now) {
    const policy = t.packet.evidence.localLaw?.rule?.sentencing, sanctions = policy?.ordinarySanctions || [], heldSeconds = Math.max(0, f.localCustodySeconds || 0);
    const s = { id: `${t.id}:sentence`, cityId: t.cityId, judgmentId: t.judgment.id, issuedById: t.officials.judge.id, issuedAt: now, custodyCreditSeconds: heldSeconds, paid: 0, reasons: ["Only this nonviolent local gate conviction is sentenced; no old sentence, unsupported violence or presumed aggravation is included."] };
    if (sanctions.includes("supervision") && (t.submission === "supervision" || !sanctions.includes("fine"))) Object.assign(s, { kind: "supervision", status: "active", endsAt: now + 86400, conditions: "For one day comply with this city's exclusion and court-access limits. No new travel or reporting journey is required; any alleged breach needs separate witnessed process." });
    else if (sanctions.includes("fine")) { const amount = Math.min(heldSeconds >= 3600 ? 25 : 50, Math.max(0, Math.floor(f.balance / 10))); Object.assign(s, { kind: "fine", amount, status: amount ? "due" : "completed" }); s.reasons.push("The bounded discretionary fine is capped at one tenth of available funds; an hour of local custody halves the 50-credit ceiling. Inability to pay does not create detention."); }
    else if (sanctions.includes("finitePrison") && policy?.finitePrisonRangeMonths?.maximum > 0) { Object.assign(s, { kind: "finitePrison", status: "awaitingTransferProceeding", months: Math.min(policy.finitePrisonRangeMonths.maximum, Math.max(1, policy.finitePrisonRangeMonths.minimum || 1)), executionStartedAt: null }); s.reasons.push("Only a separate receiving-city sentence-execution and transfer proceeding can start this finite term and apply the saved local custody credit. No new post-conviction detention is authorized by this handoff."); }
    else { Object.assign(s, { kind: "judicialReferral", status: "awaitingTransferProceeding", executionStartedAt: null }); s.reasons.push("No supported executable sanction is available; refer for separate local sentence review, without inventing punishment or detention."); }
    t.sentence = s; finish(t, c, now);
  }
  function finish(t, c, now) {
    const p = c.pretrial.legal.proceedings[0];
    t.refundDue += p.release.escrowStatus === "held" ? p.release.bailAmount : 0;
    if (p.release.escrowStatus === "held") p.release.escrowStatus = "refunded";
    else if (p.release.escrowStatus === "due") p.release.escrowStatus = "none";
    p.release.conditions.forEach(condition => { condition.status = "lifted"; }); p.release.status = "released"; p.release.kind = "localTrialDisposition"; p.release.orderedAt = now;
    p.status = "resolved"; p.trial.status = "resolved"; p.charges.forEach(charge => { charge.status = "resolved"; });
    p.resolution = { judgmentId: t.judgment.id, enteredAt: now, outcomeKind: t.judgment.verdict, verdicts: p.charges.map(charge => ({ chargeId: charge.id, verdict: t.judgment.verdict, reason: t.judgment.reason })), sentenceOrderId: t.sentence?.id || "", summary: t.judgment.reason };
    c.status = "resolved"; c.pretrial.phase = "resolved"; c.pretrial.nextAt = null; c.pretrial.reviewAt = null;
    if (c.custodyOrder) Object.assign(c.custodyOrder, { status: "withdrawn", reviewAt: null, endedAt: now });
    if (t.permit) t.permit.status = "egressOnly";
    t.phase = t.sentence?.status === "awaitingTransferProceeding" ? "sentenceHandoff" : "completed"; t.nextAt = null; t.delay = "";
    t.history.push({ at: now, action: "finalDisposition", summary: "This case's pretrial custody and conditions ended. Bail is refundable separately from any fine. Physical release and the existing banishment remain separate." });
  }
  function refund(t) { const amount = t.refundDue; t.refundDue = 0; return amount; }
  function payFine(t, balance, now) {
    const s = t.sentence; if (s?.kind !== "fine" || s.status !== "due") return 0;
    const amount = Math.max(0, Math.min(s.amount - s.paid, balance)); s.paid += amount;
    if (s.paid === s.amount) { s.status = "completed"; s.paidAt = now; } return amount;
  }
  function released(t, record) { if (t.physicalRelease) return false; t.physicalRelease = clone(record); if (t.permit) t.permit.status = "completed"; return true; }
  return { CHALLENGES, DURATIONS, open, challenge, attendanceReason, serve, adjourn, tick, attend, present, begin, findings, advance, defense, dismiss, applyIdentityCorrection, requestSentence, refund, payFine, released };
});
