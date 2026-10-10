/**
 * REFERENCE — synthetic plucked-string signals for tuner tests. Port to
 * __tests__/helpers/synth.ts. Models: harmonics with pluck-position weighting,
 * inharmonicity (B), per-harmonic decay, pitch glide after the attack
 * (+8 c decaying over 0.3 s), pick-noise burst, pink room noise, optional
 * 50 Hz hum, and a 2nd-order high-pass at 120 Hz imitating phone/laptop mics.
 * Signals are normalised to ~-20 dBFS RMS at the attack.
 */
export const SR = 48000;
/** Reference uses 40; 20 cuts the synthesis time and passes the same thresholds. */
const MAX_HARMONICS = 20;
/** Notes in a sequence stop sounding this long after their pluck (keeps synthesis fast). */
const MAX_NOTE_SEC = 5;

export function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function gaussian(rng: () => number) {
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 2nd-order Butterworth high-pass (RBJ cookbook), in place. */
function highpass(x: Float64Array, fc: number) {
    const w0 = (2 * Math.PI * fc) / SR;
    const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
    const cos = Math.cos(w0);
    const a0 = 1 + alpha;
    const b0 = (1 + cos) / 2 / a0, b1 = -(1 + cos) / a0, b2 = (1 + cos) / 2 / a0;
    const a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
        const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
        x[i] = y;
    }
}

export interface PluckOpts {
    f0: number;            // nominal target frequency
    detuneCents: number;   // actual string offset from target
    noteDur: number;       // seconds of note after pluck
    leadIn: number;        // seconds of noise before pluck
    glideCents: number;    // initial sharpness right after attack (tension modulation)
    glideTau: number;      // seconds for glide to decay
    decay1: number;        // fundamental amplitude decay time constant (s)
    B: number;             // inharmonicity coefficient
    pluckPos: number;      // relative pluck position (0..0.5)
    noiseDb: number;       // room noise level relative to initial note RMS
    micHpHz: number;       // mic low-frequency roll-off (phones/laptops)
    seed: number;
    /** Optional time-varying offset (cents) — simulates turning the peg. */
    detuneFn?: (t: number) => number;
    /** Other open strings ringing sympathetically: frequency + level re: note. */
    sympathetic?: { f: number; db: number }[];
    /** Mains hum (50 Hz + harmonics) level re: initial note RMS. */
    humDb?: number;
}

export function synthPluck(o: PluckOpts) {
    const rng = mulberry32(o.seed);
    const nLead = Math.round(o.leadIn * SR);
    const nNote = Math.round(o.noteDur * SR);
    const n = nLead + nNote;
    const note = new Float64Array(nNote);
    const detune = o.detuneFn ?? (() => o.detuneCents);
    const voices = [{ f: o.f0, gain: 1, glide: o.glideCents, ownDetune: true }]
        .concat((o.sympathetic ?? []).map((v) => ({ f: v.f, gain: Math.pow(10, v.db / 20), glide: 0, ownDetune: false })));

    for (const v of voices) {
        // Pitch-bend ratio is common to all harmonics of a voice: compute once per sample.
        const ratio = new Float64Array(nNote);
        for (let i = 0; i < nNote; i++) {
            const t = i / SR;
            const c = (v.ownDetune ? detune(t) : 0) + v.glide * Math.exp(-t / o.glideTau);
            ratio[i] = Math.exp((c * Math.LN2) / 1200);
        }
        for (let k = 1; k <= MAX_HARMONICS; k++) {
            const inh = k * Math.sqrt(1 + o.B * k * k);
            if (inh * v.f > 5000) break;
            const amp = v.gain * (Math.abs(Math.sin(k * Math.PI * o.pluckPos)) + 0.05) / Math.pow(k, 1.2)
                * (0.7 + 0.6 * rng());
            const tauK = o.decay1 / (1 + 0.3 * (k - 1));
            const step = Math.exp(-1 / SR / tauK);
            const w = (2 * Math.PI * inh * v.f) / SR;
            let phase = rng() * 2 * Math.PI;
            let env = amp;
            for (let i = 0; i < nNote; i++) {
                phase += w * ratio[i];
                note[i] += env * Math.sin(phase);
                env *= step;
            }
        }
    }
    // Pick attack noise burst
    for (let i = 0; i < nNote; i++) note[i] += 0.8 * gaussian(rng) * Math.exp(-i / SR / 0.006);

    // Normalise note so its first 100 ms RMS = 0.1 (≈ -20 dBFS, typical mic level)
    let s = 0;
    const m = Math.round(0.1 * SR);
    for (let i = 0; i < m; i++) s += note[i] * note[i];
    const g = 0.1 / Math.sqrt(s / m);

    // Pink-ish room noise (Paul Kellet's economy filter) at noiseDb re: 0.1
    const x = new Float64Array(n);
    let b0 = 0, b1 = 0, b2 = 0;
    const pink = new Float64Array(n);
    let ps = 0;
    for (let i = 0; i < n; i++) {
        const w = gaussian(rng);
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        pink[i] = b0 + b1 + b2 + w * 0.1848;
        ps += pink[i] * pink[i];
    }
    const pg = (0.1 * Math.pow(10, o.noiseDb / 20)) / Math.sqrt(ps / n);
    for (let i = 0; i < n; i++) x[i] = pink[i] * pg;
    if (o.humDb !== undefined) {
        const hg = 0.1 * Math.pow(10, o.humDb / 20);
        for (let i = 0; i < n; i++) {
            const t = i / SR;
            x[i] += hg * (Math.sin(2 * Math.PI * 50 * t) + 0.5 * Math.sin(2 * Math.PI * 100 * t + 1) + 0.3 * Math.sin(2 * Math.PI * 150 * t + 2));
        }
    }
    for (let i = 0; i < nNote; i++) x[nLead + i] += note[i] * g;

    highpass(x, o.micHpHz);

    const trueCents = (tSincePluck: number) =>
        detune(Math.max(0, tSincePluck)) + o.glideCents * Math.exp(-Math.max(0, tSincePluck) / o.glideTau);

    return { x: Float32Array.from(x), pluckTime: o.leadIn, trueCents };
}

// ─── Sequences: a tuning session (strings plucked in turn, earlier ones ring on) ─

export interface SeqNote { f: number; start: number; detune: number; velocityDb?: number; decay1: number; B: number }

export function synthSequence(notes: SeqNote[], dur: number, noiseDb: number, micHpHz: number, seed: number, humDb?: number) {
    const rng = mulberry32(seed);
    const n = Math.round(dur * SR);
    const x = new Float64Array(n);
    for (const nt of notes) {
        const i0 = Math.round(nt.start * SR);
        const len = Math.min(n - i0, Math.round(MAX_NOTE_SEC * SR));
        const note = new Float64Array(len);
        const f = nt.f * Math.pow(2, nt.detune / 1200);
        const glideCents = 8, glideTau = 0.3, pluckPos = 0.12 + 0.12 * rng();
        const ratio = new Float64Array(len);
        for (let i = 0; i < len; i++) ratio[i] = Math.exp(((glideCents * Math.exp(-i / SR / glideTau)) * Math.LN2) / 1200);
        for (let k = 1; k <= MAX_HARMONICS; k++) {
            const inh = k * Math.sqrt(1 + nt.B * k * k);
            if (inh * f > 5000) break;
            const amp = (Math.abs(Math.sin(k * Math.PI * pluckPos)) + 0.05) / Math.pow(k, 1.2) * (0.7 + 0.6 * rng());
            const tauK = nt.decay1 / (1 + 0.3 * (k - 1));
            const step = Math.exp(-1 / SR / tauK);
            const w = (2 * Math.PI * inh * f) / SR;
            let phase = rng() * 2 * Math.PI;
            let env = amp;
            for (let i = 0; i < len; i++) {
                phase += w * ratio[i];
                note[i] += env * Math.sin(phase);
                env *= step;
            }
        }
        for (let i = 0; i < Math.min(len, 2000); i++) note[i] += 0.8 * gaussian(rng) * Math.exp(-i / SR / 0.006);
        let s = 0; const m = Math.round(0.1 * SR);
        for (let i = 0; i < m; i++) s += note[i] * note[i];
        const g = (0.1 * Math.pow(10, (nt.velocityDb ?? 0) / 20)) / Math.sqrt(s / m);
        for (let i = 0; i < len; i++) x[i0 + i] += note[i] * g;
    }
    let b0 = 0, b1 = 0, b2 = 0, ps = 0;
    const pink = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const w = gaussian(rng);
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        pink[i] = b0 + b1 + b2 + w * 0.1848; ps += pink[i] * pink[i];
    }
    const pg = (0.1 * Math.pow(10, noiseDb / 20)) / Math.sqrt(ps / n);
    for (let i = 0; i < n; i++) x[i] += pink[i] * pg;
    if (humDb !== undefined) {
        const hg = 0.1 * Math.pow(10, humDb / 20);
        for (let i = 0; i < n; i++) { const t = i / SR; x[i] += hg * (Math.sin(2 * Math.PI * 50 * t) + 0.5 * Math.sin(2 * Math.PI * 100 * t + 1) + 0.3 * Math.sin(2 * Math.PI * 150 * t + 2)); }
    }
    highpass(x, micHpHz);
    /** Truth = most recently plucked note (Hz), or null before the first pluck. */
    const truth = (t: number): number | null => {
        let cur: SeqNote | null = null;
        for (const nt of notes) if (nt.start <= t) cur = nt;
        if (!cur) return null;
        return cur.f * Math.pow(2, (cur.detune + 8 * Math.exp(-(t - cur.start) / 0.3)) / 1200);
    };
    return { x: Float32Array.from(x), truth, notes };
}
