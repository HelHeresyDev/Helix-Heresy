// @ts-check

const BASES = ['A', 'C', 'G', 'T'];
const REGION_KEYS = [
  'size',
  'color',
  'shape',
  'behavior',
  'sustenance',
  'byproduct',
  'element',
  'stability',
  'appendages',
  'brood',
  'growth',
  'lifespan',
  'consistency',
];

const REGION_STARTS = Object.fromEntries(REGION_KEYS.map((key, index) => [key, index * 2]));

const TRAIT_POOLS = {
  element: [
    'none',
    'flame',
    'frost',
    'storm',
    'stone',
    'shadow',
    'light',
    'water',
    'wind',
    'wood',
    'metal',
    'poison',
    'acid',
    'dream',
    'gravity',
    'ether',
  ],
  consistency: [
    'watery',
    'runny gel',
    'syrupy',
    'loose jelly',
    'soft gelatin',
    'mucous',
    'foamy',
    'elastic gel',
    'rubbery',
    'tar-like',
    'waxen',
    'fibrous gel',
    'grainy slurry',
    'crystalline gel',
    'brittle jelly',
    'clay-like',
  ],
  behavior: [
    'idle pooling',
    'edge following',
    'light seeking',
    'light avoiding',
    'heat seeking',
    'cold nesting',
    'tool orbiting',
    'sound following',
    'vibration hunting',
    'hiding',
    'guarding',
    'cleaning',
    'swarming',
    'burrowing',
    'circling',
    'still ambush',
  ],
  sustenance: [
    'organic feeder',
    'carrion feeder',
    'decay feeder',
    'filth feeder',
    'mineral feeder',
    'metal feeder',
    'silicate feeder',
    'fuel feeder',
    'arcane mineral feeder',
    'hazard feeder',
    'heat absorber',
    'light absorber',
    'ambient mana absorber',
    'moisture absorber',
    'electrical absorber',
    'fume absorber',
  ],
  stability: [
    'placid',
    'steady',
    'docile',
    'nervous',
    'flickering',
    'volatile',
    'fractious',
    'apathetic',
    'hungry',
    'territorial',
    'obedient',
    'fragile',
    'self-knitting',
    'erratic',
    'predatory',
    'dormant',
  ],
};

const BYPRODUCT_SLOT_CODES = ['AA', 'AC', 'CC', 'CT'];

function pairCodes() {
  const codes = [];
  for (const a of BASES) {
    for (const b of BASES) {
      codes.push(`${a}${b}`);
    }
  }
  return codes;
}

function shuffle(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function stringHash(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedRng(seed) {
  return mulberry32(stringHash(seed));
}

function buildTraitMaps(seed, complexity = 'clean') {
  const rng = seedRng(`${seed}:gene-map:${complexity}`);
  const codes = pairCodes();
  const traitMaps = {};
  for (const key of REGION_KEYS) {
    if (key === 'byproduct') {
      continue;
    }
    const pool = TRAIT_POOLS[key] || Array.from({ length: 16 }, (_, index) => `${key}-${index}`);
    const shuffledCodes = shuffle([...codes], rng);
    const madeOutcomes = shuffle([...pool], rng);
    const outcomes = shuffle(madeOutcomes, rng);
    traitMaps[key] = {};
    for (let i = 0; i < shuffledCodes.length; i += 1) {
      traitMaps[key][shuffledCodes[i]] = outcomes[i];
    }
  }
  return traitMaps;
}

function codeForTraitLabel(traitMaps, traitKey, label) {
  const match = Object.entries(traitMaps[traitKey] || {}).find(([, outcome]) => outcome === label);
  if (!match) {
    throw new Error(`No ${traitKey} code found for ${label}`);
  }
  return match[0];
}

function replaceRegionCode(genome, traitKey, code) {
  const start = REGION_STARTS[traitKey];
  if (typeof start !== 'number') {
    throw new Error(`Unknown region ${traitKey}`);
  }
  return `${genome.slice(0, start)}${code}${genome.slice(start + 2)}`;
}

function byproductSlotCode(slot) {
  const code = BYPRODUCT_SLOT_CODES[slot];
  if (!code) {
    throw new Error(`Unknown byproduct slot ${slot}`);
  }
  return code;
}

function genomeForTraits({ seed, complexity = 'clean', baseGenome = 'A'.repeat(REGION_KEYS.length * 2), traits = {}, byproductSlot = null }) {
  const traitMaps = buildTraitMaps(seed, complexity);
  let genome = String(baseGenome).slice(0, REGION_KEYS.length * 2).padEnd(REGION_KEYS.length * 2, 'A');
  for (const [traitKey, label] of Object.entries(traits)) {
    genome = replaceRegionCode(genome, traitKey, codeForTraitLabel(traitMaps, traitKey, label));
  }
  if (byproductSlot !== null) {
    genome = replaceRegionCode(genome, 'byproduct', byproductSlotCode(Number(byproductSlot)));
  }
  return genome;
}

module.exports = {
  genomeForTraits,
};
