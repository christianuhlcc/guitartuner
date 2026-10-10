import { autocorrelation } from './fft';

export interface PitchCandidate {
    /** Frequency in Hz (sub-sample refined). */
    frequency: number;
    /** NSDF peak height, 0..1. ≥0.9 clean tone, 0.5–0.8 noisy/polyphonic, <0.3 noise. */
    clarity: number;
}

/** Signal RMS. */
export function rms(buf: Float32Array, from = 0, to = buf.length): number {
    let s = 0;
    for (let i = from; i < to; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / Math.max(1, to - from));
}

/** Below this RMS the buffer is treated as silence (clarity does the real gating). */
export const SILENCE_RMS = 0.002;

/**
 * All NSDF key maxima with period in [1/maxF, 1/minF], in ASCENDING LAG order
 * (i.e. descending frequency). A key maximum is the highest NSDF value between
 * a positive-going zero crossing and the next negative-going one.
 */
export function detectPitchCandidates(
    buf: Float32Array, sampleRate: number, minFrequency: number, maxFrequency: number,
): PitchCandidate[] {
    const N = buf.length;
    if (rms(buf) < SILENCE_RMS) return [];
    const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
    const maxLag = Math.min(Math.ceil(sampleRate / minFrequency) + 1, N - 2);
    if (maxLag <= minLag) return [];

    const r = autocorrelation(buf, maxLag + 1);
    const nsdf = new Float64Array(maxLag + 2);
    let m = 2 * r[0];
    for (let tau = 0; tau <= maxLag + 1; tau++) {
        if (tau > 0) m -= buf[tau - 1] * buf[tau - 1] + buf[N - tau] * buf[N - tau];
        nsdf[tau] = m > 0 ? (2 * r[tau]) / m : 0;
    }

    const out: PitchCandidate[] = [];
    let t = 1;
    while (t < maxLag && nsdf[t] > 0) t++;          // skip the lobe around τ = 0
    while (t <= maxLag) {
        while (t <= maxLag && nsdf[t] <= 0) t++;
        let best = -1;
        while (t <= maxLag && nsdf[t] > 0) {
            if (best < 0 || nsdf[t] > nsdf[best]) best = t;
            t++;
        }
        if (best >= minLag && best <= maxLag) {
            // Parabolic interpolation of the peak (abscissa → period, ordinate → clarity)
            const y1 = nsdf[best - 1], y2 = nsdf[best], y3 = nsdf[best + 1];
            const den = y1 + y3 - 2 * y2;
            let lag = best, clarity = y2;
            if (den < 0) {
                const delta = (y1 - y3) / (2 * den);
                lag = best + delta;
                clarity = y2 - ((y1 - y3) * delta) / 4;
            }
            out.push({ frequency: sampleRate / lag, clarity: Math.min(1, clarity) });
        }
    }
    return out;
}

/**
 * MPM's own selection rule: the first (shortest-lag) candidate whose clarity is
 * ≥ k × the best clarity. k = 0.8 (not the textbook 0.9): with 0.9, a high E
 * plucked while B3 still rings is shown as E2 >50% of the time (their common
 * period is E2's); 0.8 brings that to <10% without adding overtone errors.
 */
export function pickMpm(cands: PitchCandidate[], k = 0.8, minClarity = 0.5): PitchCandidate | null {
    let hi = 0;
    for (const c of cands) if (c.clarity >= minClarity && c.clarity > hi) hi = c.clarity;
    if (hi === 0) return null;
    return cands.find((c) => c.clarity >= minClarity && c.clarity >= k * hi) ?? null;
}

/** Convenience wrapper: the MPM-picked frequency, or null when nothing is clear. */
export function detectPitch(
    buf: Float32Array,
    sampleRate: number,
    minFrequency = 60,
    maxFrequency = 500,
): number | null {
    return pickMpm(detectPitchCandidates(buf, sampleRate, minFrequency, maxFrequency))?.frequency ?? null;
}
