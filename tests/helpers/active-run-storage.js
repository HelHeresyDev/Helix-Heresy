// @ts-check

const MANIFEST_KEY = 'helix-heresy-v2-library';
const RUN_KEY_PREFIX = 'helix-heresy-v2-run:';

async function activeRunStorageKey(page) {
  return page.evaluate(({ manifestKey, runKeyPrefix }) => {
    const manifest = JSON.parse(window.localStorage.getItem(manifestKey) || '{}');
    if (!manifest.activeRunId) throw new Error('No active world-backed run is saved.');
    return `${runKeyPrefix}${manifest.activeRunId}`;
  }, { manifestKey: MANIFEST_KEY, runKeyPrefix: RUN_KEY_PREFIX });
}

module.exports = { activeRunStorageKey };
