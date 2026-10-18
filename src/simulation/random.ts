/** Uniform numbers in [0, 1) from a 32-bit seed (mulberry32), so maps and noise can be replayed. */
export type Random = () => number;

export const createRandom = (seed: number): Random => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export const randomInt = (random: Random, min: number, maxInclusive: number): number =>
    min + Math.floor(random() * (maxInclusive - min + 1));

/** Standard normal sample (Box-Muller). */
export const gaussian = (random: Random): number => {
    const u = 1 - random();
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Fills `out` with standard normal samples drawn from `seed`. */
export const fillGaussian = (out: Float32Array, seed: number): Float32Array => {
    const random = createRandom(seed);
    for (let i = 0; i < out.length; i++) out[i] = gaussian(random);
    return out;
};
