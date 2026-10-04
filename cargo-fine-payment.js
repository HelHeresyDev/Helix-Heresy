(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-trial') : root.HelixCargoTrial);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoFinePayment = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Trial) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const free = (job, id) => !job || job === id;
  const credits = n => Number.isSafeInteger(n) && n >= 0;
  const paid = f => f.receipts.reduce((sum, r) => sum + r.credits, 0);
  function basis(g, d) {
    const v = d.judgmentReview, x = v?.decision, sentence = d.sentencing?.sentence, judgment = d.trial?.judgment;
    const disclosure = v?.disclosures?.find(r => r.id === x?.disclosureId), input = disclosure?.input, proposed = disclosure?.proposed;
    if (!Trial.local(g) || v?.phase !== 'decided' || v.stayActive !== false || v.disposition !== 'finalAwaitingSeparateEnforcement'
      || v.handoff || !['affirmed', 'sentenceCorrected'].includes(x?.outcome) || x.sanction?.kind !== 'fine' || !credits(x.sanction.credits)
      || !input || !proposed || !same(input.sentence, sentence) || !same(input.judgment, judgment)
      || judgment?.outcome !== 'convicted' || sentence?.trialId !== d.trial.id || sentence.actorId !== d.actorId || judgment.actorId !== d.actorId
      || x.trialId !== d.trial.id || x.sentenceId !== sentence.id || x.personId !== sentence.personId || x.personId !== judgment.personId
      || x.cityId !== g.cityId || sentence.cityId !== g.cityId || judgment.cityId !== g.cityId || x.institutionId !== g.cargoCourt.institutionId
      || x.outcome !== proposed.outcome || !same(x.sanction, proposed.sanction) || x.lawId !== proposed.lawId || x.sourceLawId !== proposed.sourceLawId
      || !Number.isFinite(x.at) || x.at < sentence.at) return null;
    const proposal = input.trial?.proposal;
    const address = proposal?.disclosure?.assessment?.recipientFindings?.flatMap(f => (f.events || []).filter(e =>
      f.comparisons?.some(c => c.recordId === e.id && c.result === 'matchesCarrierCopy'))).find(e =>
      e.kind === 'chemicalDisclosure' && e.observationId === d.actorId)?.serviceLocation;
    if (!proposal?.subjectDocument || !address || address.cityId !== g.cityId) return null;
    return copy({ reviewDecisionId: x.id, reviewAt: x.at, sentenceId: sentence.id, trialId: x.trialId,
      personId: x.personId, cityId: x.cityId, institutionId: x.institutionId, lawId: x.lawId, sourceLawId: x.sourceLawId,
      totalCredits: x.sanction.credits, document: proposal.subjectDocument, address });
  }
  function tell(b, p, f, at, text) {
    if (f.events.at(-1)?.text === text) return;
    f.events.push({ at, text });
    if (p?.courtPreferences?.shareNotices && b?.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.finePaymentNotices ||= []).push({ at, fineId: f.id, text,
        scope: 'Receiver-consented fine notice; no access to private balances or authority over this person.' });
  }
  function release(o, s, f) {
    if (o?.job === f.id) o.job = null;
    if (s?.job === f.id) s.job = null;
    f.wasReady = false;
  }
  function advance(state, g, at) {
    if (!g.cargoCourt || !Number.isFinite(at)) return;
    for (const d of g.cargoCourt.dockets) {
      let f = d.finePayment;
      if (f?.satisfaction || at < (f?.lastAt ?? 0)) continue;
      const input = basis(g, d);
      if (!f && (!input || at < input.reviewAt)) continue;
      if (!f) f = d.finePayment = { id: `${input.reviewDecisionId}:fine`, basis: input, phase: 'checking',
        lastAt: at, progress: 0, wasReady: false, authorizations: [], notices: [], grants: [], receipts: [], events: [] };
      const dt = Math.max(0, at - f.lastAt); f.lastAt = at;
      const matches = state.buyers.filter(b => b.buyerService?.representatives.some(p => p.id === f.basis.personId));
      const b = matches.length === 1 ? matches[0] : null, bs = b?.buyerService, s = bs?.fineSponsor;
      const p = bs?.representatives.find(p => p.id === f.basis.personId), o = g.cargoCourt.fineOffice;
      const pause = text => { release(o, s, f); f.status = 'paused'; tell(b, p, f, at, `${text} Unpaid fine creates no interest, debt to a sponsor, arrest or imprisonment.`); };
      const officerReady = o?.active && o.cityId === g.cityId && o.institutionId === g.cargoCourt.institutionId
        && o.locationId === g.cargoCourt.id && o.channelPowered && able(o.officer) && o.officer.locationId === o.locationId
        && o.officer.role === 'voluntaryFineSettlement' && !o.officer.assignment && free(o.job, f.id)
        && o.power >= 1 && Number.isFinite(o.money) && o.money >= 0;
      if (!input || !same(input, f.basis) || !b || b.cityId !== g.cityId || !officerReady
        || [p?.id, s?.controller?.id].includes(o.officer.id)) {
        pause('Payment blocked: current local authority, unchanged final reviewed fine or settlement officer unavailable.'); continue;
      }
      f.status = 'active';
      const work = (seconds, actors) => {
        const available = Math.min(...actors.map(a => a.workSeconds));
        if (!Number.isFinite(available) || available <= 0) { pause('Finite settlement work unavailable.'); return false; }
        for (const actor of actors) actor.job = f.id;
        const amount = f.wasReady ? Math.min(dt, seconds - f.progress, available) : 0;
        f.wasReady = true; f.progress += amount;
        for (const actor of actors) actor.workSeconds -= amount;
        return f.progress >= seconds;
      };
      if (f.phase === 'checking') {
        if (f.checkerId !== o.officer.id) { f.checkerId = o.officer.id; f.progress = 0; f.wasReady = false; }
        if (!work(600, [o])) continue;
        f.authorizations.push({ id: `${f.id}:authority:${f.authorizations.length + 1}`, at, officerId: o.officer.id,
          officeId: o.id, institutionId: o.institutionId, ...copy(input),
          scope: 'Receive voluntary local contributions to this exact fine only.', seizureAuthorized: false, custodyAuthorized: false });
        o.power--; release(o, s, f); f.progress = 0; f.phase = 'notice'; continue;
      }
      const authority = f.authorizations.at(-1);
      if (authority?.officerId !== o.officer.id || authority.officeId !== o.id) {
        release(o, s, f); f.phase = 'checking'; f.progress = 0; continue;
      }
      const reachable = Trial.identified(state, p, input.document, at) && p.locationId === g.cityId && !p.assignment
        && (p.availableAt || 0) <= at && bs.locationId === g.cityId && bs.premises?.id === input.address.siteId
        && bs.channelPowered && bs.credentialActive && !bs.assignment
        && s?.active && s.cityId === g.cityId && s.channelPowered && s.power >= 1 && free(s.job, f.id);
      if (!reachable) { pause('Authenticated local defendant contact or allocated settlement channel unavailable.'); continue; }
      const prefs = p.finePaymentPreferences;
      if (f.phase === 'notice') {
        if (prefs?.acceptNotice !== true) { pause('Defendant has not accepted fresh payment notice.'); continue; }
        const notice = { id: `${f.id}:notice:${f.notices.length + 1}`, at, authorizationId: authority.id,
          personId: p.id, totalCredits: input.totalCredits, outstandingCredits: input.totalCredits - paid(f), officeId: o.id,
          dueAt: null, terms: 'Voluntary local full or partial payment only. No fees, interest, seizure, detention or automatic punishment for nonpayment.' };
        f.notices.push(notice); o.power--; s.power--; f.phase = 'funding';
        tell(b, p, f, at, `Fine payment notice: ${notice.outstandingCredits} of ${notice.totalCredits} credits outstanding, payable to ${o.id}. ${notice.terms}`);
        if (notice.outstandingCredits === 0) {
          f.satisfaction = { at, reviewDecisionId: input.reviewDecisionId, totalCredits: input.totalCredits, receiptIds: f.receipts.map(r => r.id) };
          f.phase = 'satisfied'; tell(b, p, f, at, 'Fine satisfied: no outstanding amount. No funds transferred or custody authorized.');
        }
        continue;
      }
      const account = s.account, employment = s.employment, controller = s.controller, policy = s.preferences;
      const fundingReady = prefs?.acceptEmployerContribution === true && prefs.discloseToEmployer === true && policy?.sponsorFines === true
        && able(controller) && controller.role === 'businessTreasurer' && controller.locationId === bs.premises.id && !controller.assignment
        && controller.id !== p.id && controller.id !== o.officer.id
        && account?.status === 'active' && account.buyerId === b.id && account.cityId === g.cityId && account.balanceKey === 'money'
        && account.controllerId === controller.id && Number.isFinite(account.establishedAt) && account.establishedAt <= at
        && employment?.status === 'active' && employment.personId === p.id && employment.employerId === b.id
        && Number.isFinite(employment.establishedAt) && employment.establishedAt <= at
        && credits(policy.maximumPerFineCredits) && credits(policy.reserveCredits) && Number.isFinite(b.money) && b.money >= 0;
      if (!fundingReady) { pause('No current defendant consent and independently authorized local employer sponsorship.'); continue; }
      if (f.phase === 'funding') {
        // A new official may re-serve notice, but cannot create a fresh spending cap.
        if (f.grants.length) { f.phase = 'payment'; f.progress = 0; release(o, s, f); continue; }
        const grantBasis = { account: copy(account), employment: copy(employment), policy: copy(policy), controllerId: controller.id };
        if (!same(f.grantBasis, grantBasis)) { release(o, s, f); f.grantBasis = grantBasis; f.progress = 0; }
        if (!work(300, [s])) continue;
        f.grants.push({ id: `${f.id}:employer-grant`, at, status: 'active', personId: p.id, buyerId: b.id,
          noticeId: f.notices.at(-1).id, controllerId: controller.id, fundingSource: copy(account), employment: copy(employment),
          maximumCredits: Math.min(input.totalCredits, policy.maximumPerFineCredits), reserveCredits: policy.reserveCredits,
          defendantConsent: { at, personId: p.id, employerId: b.id, disclosure: true, contribution: true },
          terms: 'Voluntary gift from business funds; no reimbursement, service obligation, loyalty reward or transfer of liability.' });
        s.power--; release(o, s, f); f.progress = 0; f.phase = 'payment'; continue;
      }
      if (f.phase !== 'payment') continue;
      const grant = f.grants.at(-1), totalPaid = paid(f);
      if (grant?.status !== 'active' || !same(grant.fundingSource, account) || !same(grant.employment, employment)
        || grant.controllerId !== controller.id || !credits(totalPaid) || totalPaid > input.totalCredits) {
        pause('Original sponsorship mandate or payment ledger unavailable; no new mandate is inferred.'); continue;
      }
      const reserve = Math.max(grant.reserveCredits, policy.reserveCredits);
      const available = Math.floor(Math.min(input.totalCredits - totalPaid,
        Math.min(grant.maximumCredits, policy.maximumPerFineCredits) - totalPaid, Math.max(0, b.money - reserve)));
      if (!credits(available) || available === 0) {
        f.offer = null; f.progress = 0; pause(`Fine remains unpaid: ${input.totalCredits - totalPaid} credits outstanding; no authorized contribution currently available.`); continue;
      }
      if (f.offer && (f.offer.credits > available || f.offer.officerId !== o.officer.id || f.offer.grantId !== grant.id)) {
        f.offer = null; f.progress = 0; release(o, s, f);
      }
      if (!f.offer) { f.offer = { credits: available, officerId: o.officer.id, grantId: grant.id }; f.progress = 0; f.wasReady = false; }
      if (!work(300, [o, s])) continue;
      // Every source, balance, actor, consent and legal stay was rechecked above.
      // Debit, treasury credit and all receipt copies commit in this synchronous step.
      const amount = f.offer.credits;
      if (!Number.isFinite(o.money + amount) || o.money + amount > Number.MAX_SAFE_INTEGER) { pause('Treasury balance cannot accept this transfer.'); continue; }
      const receipt = { id: `${f.id}:receipt:${f.receipts.length + 1}`, at, fineId: f.id, reviewDecisionId: input.reviewDecisionId,
        sentenceId: input.sentenceId, personId: p.id, payerBuyerId: b.id, accountId: account.id, grantId: grant.id,
        authorizationId: authority.id, officerId: o.officer.id, controllerId: controller.id, officeId: o.id, cityId: g.cityId,
        credits: amount, remainingCredits: input.totalCredits - totalPaid - amount,
        scope: 'Payment of this fine only; no inference of personal ownership, guilt, debt, loyalty or custody authority.' };
      b.money -= amount; o.money += amount; o.power--; s.power--;
      f.receipts.push(receipt); o.receipts.push(copy(receipt)); s.receipts.push(copy(receipt));
      f.offer = null; f.progress = 0; release(o, s, f);
      tell(b, p, f, at, `Fine payment receipt: ${amount} credits paid voluntarily; ${receipt.remainingCredits} credits outstanding. No reimbursement debt or custody authority.`);
      if (receipt.remainingCredits === 0) {
        f.satisfaction = { at, reviewDecisionId: input.reviewDecisionId, totalCredits: input.totalCredits, receiptIds: f.receipts.map(r => r.id) };
        f.phase = 'satisfied'; tell(b, p, f, at, 'Fine satisfied in full. Original judgment and review remain unchanged; no custody or foreign enforcement authorized.');
      }
    }
  }
  return { advance, basis };
});
