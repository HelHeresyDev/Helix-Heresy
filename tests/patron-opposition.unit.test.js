const { test } = require('node:test');
const assert = require('node:assert/strict');
const Faiths = require('../strategic-faiths');
const copy = v => JSON.parse(JSON.stringify(v));

test('exceptional teachings are a stable rare minority in each theme, with no guaranteed accommodating patron', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const teachings = Array.from({ length: 2000 }, (_, i) => Faiths.createHereticTeaching('opposition-world', `god:${i}`, theme));
    assert.deepEqual(teachings, Array.from({ length: 2000 }, (_, i) => Faiths.createHereticTeaching('opposition-world', `god:${i}`, theme)));
    const exceptional = teachings.filter(t => t.position !== 'reject');
    assert.ok(exceptional.length > 0 && exceptional.length < 160);
    assert.deepEqual(new Set(exceptional.map(t => t.position)), new Set(['mortalAutonomy', 'vengeance', 'liberation', 'nihilism']));
    assert.ok(teachings.every(t => t.sourceTheme === 'shared' && t.grantsResearchApproval === false));
    assert.equal(JSON.stringify(teachings).includes('alignment'), false);
  }
});

function history() {
  return { currentGodRows: [['god:a', 0, 0], ['god:rival', 0, 0]],
    eventRows: [{ id: 'known-injury', year: 100, kind: 'holySiteContest', siteId: 'site:a',
      participantIds: ['god:a', 'god:rival'], conflict: { winnerId: 'god:rival', loserId: 'god:a' },
      evidence: ['boundedAvatarManifestations', 'siteCustodyRecord'], account: 'The rival seized the holy site.' }],
    siteRows: [{ siteId: 'site:a', originPatronGodId: 'god:a', currentControllerGodId: 'god:rival' }] };
}

test('a vengeance doctrine needs a received specific injury with an identified still-living rival', () => {
  const faith = { godId: 'god:a', hereticTeaching: Faiths.hereticTeachingFor('vengeance') }, h = history();
  assert.deepEqual(Faiths.patronInterestFor(faith, h), { kind: 'vengeance', godId: 'god:a', targetGodId: 'god:rival',
    eventId: 'known-injury', year: 100, basis: 'publishedDivineInjury', summary: 'The rival seized the holy site.' });
  for (const change of [h => h.eventRows = [], h => delete h.eventRows[0].conflict,
    h => h.currentGodRows[1][2] = 1, h => h.currentGodRows.pop(), h => h.eventRows[0].conflict.loserId = 'other']) {
    const absent = copy(h); change(absent); assert.equal(Faiths.patronInterestFor(faith, absent), null);
  }
  assert.equal(Faiths.patronInterestFor(faith, null), null);
});

test('liberation requires an actual continuing seized site, not minor status or a past defeat alone', () => {
  const faith = { godId: 'god:a', hereticTeaching: Faiths.hereticTeachingFor('liberation') }, h = history();
  assert.equal(Faiths.patronInterestFor(faith, h).targetGodId, 'god:rival');
  for (const change of [h => h.siteRows = [], h => h.siteRows[0].currentControllerGodId = 'god:a',
    h => h.siteRows[0].originPatronGodId = 'other', h => h.currentGodRows[1][2] = 1,
    h => h.eventRows[0].siteId = 'different', h => delete h.eventRows[0].conflict]) {
    const absent = copy(h); change(absent); assert.equal(Faiths.patronInterestFor(faith, absent), null);
  }
  assert.equal(Faiths.patronInterestFor(faith, null), null);
});

test('a supported injury or seizure does not itself create willingness or reveal unrelated history', () => {
  const h = history(); h.privateCombat = { reserve: 9999, secretVictim: 'hidden-god' };
  for (const position of ['reject', 'mortalAutonomy', 'nihilism'])
    assert.equal(Faiths.patronInterestFor({ godId: 'god:a', hereticTeaching: Faiths.hereticTeachingFor(position) }, h), null);
  const result = Faiths.patronInterestFor({ godId: 'god:a', hereticTeaching: Faiths.hereticTeachingFor('vengeance') }, h);
  assert.equal(JSON.stringify(result).includes('reserve'), false); assert.equal(JSON.stringify(result).includes('hidden-god'), false);
});
