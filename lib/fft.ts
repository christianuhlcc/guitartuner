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
