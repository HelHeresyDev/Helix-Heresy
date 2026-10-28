(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./religious-recognition') : root.HelixReligiousRecognition,
    node ? require('./divine-capabilities') : root.HelixDivineCapabilities);
  if (node) module.exports = api;
  if (root) root.HelixDivineContacts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Religion, Owners) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const all = book => book && !book.invalid ? book.contacts || [] : [];
  const find = (book, id) => all(book).find(c => c.id === id);
  // Local jobs and replies; run-owned seals, promises, reports and finite accounts.
  function scope(book, contact) {
    return new Proxy(book, {
      get: (s, key) => ['job', 'reply'].includes(key) ? contact[key] : s[key],
      set: (s, key, value) => { if (['job', 'reply'].includes(key)) contact[key] = value; else s[key] = value; return true; }
    });
  }
  function open(book, source, office, ground, c, at, availableCell, homeReligion = null, theme = 'madcap') {
    if (!book || book.invalid || !c.alive || !c.capable || !c.receiveAtCounter || !c.free || c.busy
      || !c.sourceCurrent || !c.serviceAvailable || !office?.active || !office.channelPowered
      || office.maintenanceReady === false || office.assignment || office.clerk?.assignment
      || office.clerk?.status !== 'alive' || office.clerk.health < 50 || !ground?.roomId || !ground.counter
      || source?.branch?.id === homeReligion?.source.branch.id) return null;
    const id = `${source?.branch?.id}:patron-petition`, existing = find(book, id);
    if (existing) return existing.invalid ? null : existing;
    if (book.records.some(r => r.contactIds?.includes(id))) return null;
    const religion = Religion.create(source, office, theme);
    if (!religion) return null;
    const post = availableCell(religion.actor);
    if (!post || post.z !== ground.counter.z) return null;
    religion.actor.roomId = ground.roomId; religion.actor.mapCell = copy(post); religion.contactProcedure = true;
    religion.actor.physicalControl = { strength: 20, stamina: 40, staminaCapacity: 40 };
    religion.actor.skills = { striking: 1, guarding: 4, evasion: 5, perception: 10 };
    if (!Owners.link(book, religion, { newContact: true })) return null;
    const contact = { id, religion, officeId: office.id, cityId: source.cityId, gateId: ground.gateId || null,
      ground: copy(ground), openedAt: at, job: null, reply: null };
    book.contacts.push(contact); return contact;
  }
  function hydrate(book, homeReligion = null) {
    if (!book || book.invalid) return;
    const seen = new Set(homeReligion ? [homeReligion.id] : []);
    for (const c of all(book)) {
      const r = Religion.normalize(c?.religion);
      if (!c || c.invalid || !r?.godRef || c.id !== r.id || seen.has(c.id) || c.cityId !== r.source.cityId
        || c.officeId !== r.officeId || r.id !== `${r.source.branch.id}:patron-petition`
        || r.actor.id !== `${r.source.branch.id}:representative` || r.actor.institutionId !== r.source.branch.id
        || r.actor.locationId !== r.officeId || r.allocation?.people !== 1 || r.allocation.branchId !== r.source.branch.id
        || !book.records.some(o => o.godId === r.godRef.godId && o.contactIds?.includes(c.id))
        || !c.ground?.roomId || !['x', 'y', 'z'].every(k => Number.isFinite(c.ground.counter?.[k]))
        || !Number.isFinite(c.openedAt) || c.job && (!c.job.proposal || !c.job.id || !Number.isFinite(c.job.progress) || !Number.isFinite(c.job.lastAt))) {
        if (c) c.invalid = true;
        continue;
      }
      seen.add(c.id); c.religion = r; r.contactProcedure = true;
      if (!Owners.link(book, r)) c.invalid = true;
    }
  }
  const actors = book => all(book).filter(c => !c.invalid).map(c => c.religion.actor);
  const jobs = book => all(book).filter(c => !c.invalid && c.job).map(c => c.job);
  const known = book => all(book).filter(c => !c.invalid).map(c => ({ id: c.id, cityId: c.cityId,
    branchName: c.religion.source.branch.publicName, godName: c.religion.source.godName,
    representativeName: c.religion.actor.name, openedAt: c.openedAt, reply: copy(c.reply || null) }));
  return { all, find, scope, open, hydrate, actors, jobs, known };
});
