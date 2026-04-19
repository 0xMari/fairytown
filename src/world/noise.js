function xmur3(value) {
  let hash = 1779033703 ^ value.length;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return function seed() {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  let value = seed;

  return function random() {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fract(value) {
  return value - Math.floor(value);
}

function hash2D(x, z, seed) {
  const dot = x * 127.1 + z * 311.7 + seed * 0.001;
  return fract(Math.sin(dot) * 43758.5453123);
}

export function createRng(...parts) {
  const seedFactory = xmur3(parts.join(":"));
  return mulberry32(seedFactory());
}

export function valueNoise2D(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);

  const v00 = hash2D(x0, z0, seed);
  const v10 = hash2D(x1, z0, seed);
  const v01 = hash2D(x0, z1, seed);
  const v11 = hash2D(x1, z1, seed);

  const ix0 = lerp(v00, v10, tx);
  const ix1 = lerp(v01, v11, tx);

  return lerp(ix0, ix1, tz);
}

export function fbm2D(x, z, seed, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let normalizer = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise2D(x * frequency, z * frequency, seed + octave * 37) * amplitude;
    normalizer += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return total / normalizer;
}
