/**
 * REFERENCE — McLeod Pitch Method (MPM) candidate extraction, FFT-based.
 * Validated in simulation; port to lib/fft.ts + lib/pitchDetector.ts.
 *
 * NSDF: n(τ) = 2·r(τ) / m(τ)
 *   r(τ) = Σ_{j=0}^{N-1-τ} x_j·x_{j+τ}          (autocorrelation, via FFT)
 *   m(τ) = Σ_{j=0}^{N-1-τ} (x_j² + x_{j+τ}²)     (incremental, O(N))
 * n(τ) ∈ [-1, 1]; n(τ) at a peak is the "clarity" of period τ, and — unlike
 * YIN's CMNDF — it is comparable across lags, which the tracker relies on.
 */

export interface PitchCandidate {
    /** Frequency in Hz (sub-sample refined). */
    frequency: number;
    /** NSDF peak height, 0..1. ≥0.9 clean tone, 0.5–0.8 noisy/polyphonic, <0.3 noise. */
    clarity: number;
}

/** In-place iterative radix-2 complex FFT. `re.length` must be a power of two. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            let t = re[i]; re[i] = re[j]; re[j] = t;
            t = im[i]; im[i] = im[j]; im[j] = t;
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = ((2 * Math.PI) / len) * (inverse ? 1 : -1);
        const wr = Math.cos(ang), wi = Math.sin(ang);
        const half = len >> 1;
        for (let i = 0; i < n; i += len) {
            let cr = 1, ci = 0;
            for (let k = 0; k < half; k++) {
                const a = i + k, b = a + half;
                const tr = re[b] * cr - im[b] * ci;
                const ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr; im[b] = im[a] - ti;
                re[a] += tr; im[a] += ti;
                const ncr = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = ncr;
            }
        }
    }
}

/** Linear (non-circular) autocorrelation r(0..maxLag) via zero-padded FFT. */
export function autocorrelation(buf: Float32Array, maxLag: number): Float64Array {
    const n = 1 << Math.ceil(Math.log2(2 * buf.length));
    const re = new Float64Array(n), im = new Float64Array(n);
    re.set(buf);
    fft(re, im);
    for (let i = 0; i < n; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; }
    fft(re, im, true);
    const r = new Float64Array(maxLag + 1);
    for (let t = 0; t <= maxLag; t++) r[t] = re[t] / n;
    return r;
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
