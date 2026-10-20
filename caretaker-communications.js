(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCaretakerCommunications = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const TTL = 3600;
  const SCOPE = 'Personally paired original communicators and resident agreement only. Request a dated caretaker report or end residence and request physical withdrawal. Requests expire after one hour; upload is not acknowledgment. Handling requires a capable, available worker during paid duty. Original wages, duty, provisions, refusal, physical return and personal settlement remain unchanged. No purchases, production, hauling, recruitment, remote power switching, stock access or new-body recognition.';
  const state = s => s.resident.communications ||= { next: 1, link: null, messages: [], received: [], observations: {} };
  const device = (r, id) => Boolean(r && r.stackId === id && r.held);
  const online = (r, id, network) => Boolean(network && device(r, id) && r.powered && r.charge > 0);
  function attendBattery(work, now, available) {
    if (!Number.isFinite(now) || now <= work.lastAt) return false;
    const dt = now - work.lastAt; work.lastAt = now;
    if (available && work.attended) work.progress = Math.min(work.required, work.progress + dt);
    work.attended = Boolean(available); return work.progress >= work.required;
  }
  function pair(s, c, now) {
    if (!c.alive || !c.personal || !c.authorized || !c.willing || !Number.isFinite(now) || !Number.isInteger(c.bodyEpoch) || c.bodyEpoch < 0
      || !s.resident || s.actor.id !== s.resident.actorId || !c.sender?.held || !c.receiver?.held
      || c.sender.stackId === c.receiver.stackId) return false;
    const t = state(s);
    if (t.link) for (const m of t.messages) if (m.receivedAt == null) m.locallyRevokedAt = now;
    t.link = { id: `caretaker-link:${s.resident.id}:${t.next++}`, actorId: s.actor.id, agreementId: s.resident.id,
      bodyEpoch: c.bodyEpoch, senderId: c.sender.stackId, receiverId: c.receiver.stackId, at: now, scope: SCOPE };
    t.lastAt = now; return true;
  }
  function senderAuthorized(s, c) {
    const p = s?.resident?.communications?.link;
    return Boolean(p && c.alive && c.free && c.capable && !c.busy && c.bodyEpoch === p.bodyEpoch
      && device(c.sender, p.senderId));
  }
  function enqueue(s, c, kind, now) {
    if (!['report', 'withdraw'].includes(kind) || !Number.isFinite(now) || !senderAuthorized(s, c)) return false;
    const t = state(s);
    if (t.messages.some(m => m.kind === kind && !m.receivedAt && !m.locallyRevokedAt && now < m.expiresAt)) return false;
    const m = { id: `${t.link.id}:message-${t.next++}`, link: copy(t.link), kind, queuedAt: now, expiresAt: now + TTL,
      sentAt: null, deliveredAt: null, handledAt: null, replySentAt: null, receivedAt: null, reply: null };
    t.messages.push(m); return copy(m);
  }
  function authenticated(s, m) {
    const p = s.resident.communications.link;
    return p && JSON.stringify(m.link) === JSON.stringify(p) && p.scope === SCOPE && p.actorId === s.actor.id
      && p.agreementId === s.resident.id && p.bodyEpoch === s.resident.recognizedBodyEpoch;
  }
  function advance(s, c, h, now) {
    const t = s?.resident?.communications;
    if (!t || !c.alive || !Number.isFinite(now) || now <= t.lastAt) return false;
    t.lastAt = now;
    let changed = false;
    for (const m of t.messages) {
      if (m.receivedAt != null || m.locallyRevokedAt != null) continue;
      const tx = online(c.sender, m.link.senderId, c.network), rx = online(c.receiver, m.link.receiverId, c.network);
      if (m.sentAt == null) {
        if (tx && now > m.queuedAt && now < m.expiresAt && senderAuthorized(s, { ...c, busy: false })) { m.sentAt = now; changed = true; }
      } else if (m.deliveredAt == null) {
        if (rx && now > m.sentAt) { m.deliveredAt = now; changed = true; }
      } else if (m.handledAt == null) {
        if (!rx || !c.available || now <= m.deliveredAt) continue;
        m.handledAt = now; changed = true;
        const valid = authenticated(s, m) && c.willing;
        let outcome = now >= m.expiresAt ? 'expired' : !valid ? 'refused' : 'reported';
        if (outcome === 'reported' && m.kind === 'withdraw') outcome = h.withdraw(now) ? 'withdrawal accepted' : 'withdrawal not applicable';
        m.reply = { messageId: m.id, kind: m.kind, observedAt: now, outcome,
          account: valid && now < m.expiresAt ? copy(h.report(now)) : null };
      } else if (m.replySentAt == null) {
        if (rx && now > m.handledAt) { m.replySentAt = now; changed = true; }
      } else if (tx && now > m.replySentAt && senderAuthorized(s, { ...c, busy: false })) {
        m.receivedAt = now; t.received.push({ ...copy(m.reply), sentAt: m.sentAt, receivedAt: now }); changed = true;
      }
    }
    return changed;
  }
  function publicView(s, now) {
    const t = s?.resident?.communications;
    if (!t) return { link: null, issued: [], received: [] };
    return { link: copy(t.link), issued: t.messages.map(m => ({ id: m.id, kind: m.kind, queuedAt: m.queuedAt, sentAt: m.sentAt,
      expiresAt: m.expiresAt, locallyRevokedAt: m.locallyRevokedAt ?? null,
      status: m.locallyRevokedAt != null ? 'Revoked by personal re-pairing' : m.receivedAt != null ? 'Reply received'
        : now >= m.expiresAt ? m.sentAt == null ? 'Expired locally before upload; not sent' : 'Expiry reached; no reply, outcome unknown'
          : m.sentAt == null ? 'Queued on own device' : 'Uploaded; awaiting reply' })), received: copy(t.received) };
  }
  return { TTL, SCOPE, state, pair, senderAuthorized, enqueue, advance, publicView, attendBattery };
});
