import { fft, autocorrelation } from '@/lib/fft';

function lcg(seed: number) {
    let s = seed;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

describe('fft', () => {
    it('forward + inverse round-trips to the input', () => {
        const rnd = lcg(1);
        const n = 256;
        const orig = Float64Array.from({ length: n }, rnd);
        const re = Float64Array.from(orig);
        const im = new Float64Array(n);
        fft(re, im);
        fft(re, im, true);
        for (let i = 0; i < n; i++) {
            expect(re[i] / n).toBeCloseTo(orig[i], 9);
            expect(im[i] / n).toBeCloseTo(0, 9);
        }
    });

    it('puts a pure cosine into a single bin pair', () => {
        const n = 64;
        const re = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 5 * i) / n));
        const im = new Float64Array(n);
        fft(re, im);
        expect(re[5]).toBeCloseTo(n / 2, 9);
        expect(re[n - 5]).toBeCloseTo(n / 2, 9);
        expect(Math.abs(re[7])).toBeLessThan(1e-9);
    });
});

describe('autocorrelation', () => {
    function brute(buf: Float32Array, maxLag: number) {
        const r = new Float64Array(maxLag + 1);
        for (let t = 0; t <= maxLag; t++) {
            let s = 0;
            for (let j = 0; j + t < buf.length; j++) s += buf[j] * buf[j + t];
            r[t] = s;
        }
        return r;
    }

    function expectClose(a: Float64Array, b: Float64Array) {
        const scale = Math.abs(b[0]);
        for (let i = 0; i < a.length; i++) {
            expect(Math.abs(a[i] - b[i]) / scale).toBeLessThan(1e-9);
        }
    }

    it('matches the brute-force sum on random input', () => {
        const rnd = lcg(7);
        const buf = Float32Array.from({ length: 700 }, rnd);
        expectClose(autocorrelation(buf, 300), brute(buf, 300));
    });

    it('matches the brute-force sum on a sine', () => {
        const buf = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i * 0.1));
        expectClose(autocorrelation(buf, 400), brute(buf, 400));
    });
});
