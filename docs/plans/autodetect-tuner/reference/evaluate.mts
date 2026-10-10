/**
 * REFERENCE — benchmark harness. Run from the repo root with Node ≥ 23:
 *   node docs/plans/autodetect-tuner/reference/evaluate.mts
 * Runs the reference detector + tracker over synthetic scenarios and prints
 * the metrics quoted in PLAN.md. Use it to sanity-check the ported code.
 */
import { SR, synthPluck, synthSequence, mulberry32 } from './synth.mts';
import type { SeqNote } from './synth.mts';
import { detectPitchCandidates, rms } from './mpm.mts';
import { PitchTracker } from './pitchTracker.mts';

const BUF = 8192, HOP = 1200;   // 8192-sample window, analysed every 25 ms (40 Hz)
const GUITAR = [
    { name: 'E2', f: 82.41, decay1: 3.0, B: 1.5e-4 }, { name: 'A2', f: 110.0, decay1: 2.8, B: 1.2e-4 },
    { name: 'D3', f: 146.83, decay1: 2.5, B: 1.0e-4 }, { name: 'G3', f: 196.0, decay1: 2.0, B: 0.6e-4 },
    { name: 'B3', f: 246.94, decay1: 1.7, B: 0.5e-4 }, { name: 'E4', f: 329.63, decay1: 1.4, B: 0.4e-4 },
];
const BASS = [
    { name: 'E1', f: 41.2, decay1: 3.5, B: 2.5e-4 }, { name: 'A1', f: 55.0, decay1: 3.2, B: 2.0e-4 },
    { name: 'D2', f: 73.42, decay1: 3.0, B: 1.5e-4 }, { name: 'G2', f: 98.0, decay1: 2.8, B: 1.2e-4 },
];
const RANGE = { guitar: [60, 500], bass: [30, 250] } as const;

interface Run { x: Float32Array; truth: (t: number) => number | null; onsets: number[]; end: number; range: readonly [number, number] }
interface Metrics { correct: number; rightNote: number; coverage: number; noteFlips: number; tuneFlips: number; jitter: number; relockMs: number; ghost: number }

function evaluate(r: Run): Metrics {
    const tracker = new PitchTracker();
    let frames = 0, shown = 0, ok = 0, pcOk = 0, noteFlips = 0, tuneFlips = 0, ghostF = 0, ghostS = 0, time = 0;
    let prevMidi: number | null | undefined, prevIn: boolean | undefined;
    let jit = 0, jitN = 0, prevNeedle: number | null = null, lastSample = -1;
    const relocks: number[] = [];
    const relocked = new Set<number>();
    for (let e = BUF; e <= r.x.length; e += HOP) {
        const t = e / SR;
        if (t > r.end) break;
        const buf = r.x.subarray(e - BUF, e);
        const out = tracker.push(t, detectPitchCandidates(buf, SR, r.range[0], r.range[1]), rms(buf, BUF - 1024));
        const onset = Math.max(-1, ...r.onsets.filter((o) => o <= t));
        if (onset < 0) { ghostF++; if (out.frequency !== null) ghostS++; continue; }
        const truthNow = r.truth(Math.max(onset, t - 0.085));      // window centre, never before the onset
        const err = out.frequency === null || truthNow === null ? Infinity : 1200 * Math.log2(out.frequency / truthNow);
        if (!relocked.has(onset) && Math.abs(err) <= 20) { relocked.add(onset); relocks.push(t - onset); }
        if (t - onset < 0.25) { prevMidi = undefined; continue; }
        frames++; time += HOP / SR;
        if (out.frequency !== null) {
            shown++;
            if (Math.abs(err) <= 20) ok++;
            if (Math.abs((((err % 1200) + 1800) % 1200) - 600) <= 20) pcOk++;
        }
        if (prevMidi !== undefined && out.midi !== prevMidi) noteFlips++;
        prevMidi = out.midi;
        if (prevIn !== undefined && out.isInTune !== prevIn) tuneFlips++;
        prevIn = out.isInTune;
        if (t - lastSample >= 0.05 - 1e-9) {
            const needle = Math.max(-50, Math.min(50, out.cents ?? 0));
            if (prevNeedle !== null) { jit += (needle - prevNeedle) ** 2; jitN++; }
            prevNeedle = needle; lastSample = t;
        }
    }
    relocks.sort((a, b) => a - b);
    return {
        correct: (100 * ok) / frames, rightNote: (100 * pcOk) / frames, coverage: (100 * shown) / frames,
        noteFlips: noteFlips / time, tuneFlips: tuneFlips / time, jitter: Math.sqrt(jit / Math.max(1, jitN)),
        relockMs: relocks.length ? 1000 * relocks[Math.floor(relocks.length / 2)] : NaN,
        ghost: ghostF ? (100 * ghostS) / ghostF : 0,
    };
}

function single(strings: typeof GUITAR, noiseDb: number, range: readonly [number, number], humDb?: number): Run[] {
    return strings.flatMap((s) => [1, 2].map((seed) => {
        const sg = synthPluck({ f0: s.f, detuneCents: 0, noteDur: 4, leadIn: 1.0, glideCents: 8, glideTau: 0.3,
            decay1: s.decay1, B: s.B, pluckPos: 0.18, noiseDb, micHpHz: 120, seed, humDb });
        return { x: sg.x, truth: (t: number) => (t < sg.pluckTime ? null : s.f * Math.pow(2, sg.trueCents(t - sg.pluckTime) / 1200)),
            onsets: [sg.pluckTime], end: 5.0, range };
    }));
}

function session(order: typeof GUITAR, noiseDb: number, range: readonly [number, number], humDb?: number): Run[] {
    return [1, 2].map((seed) => {
        const rng = mulberry32(seed * 7919);
        const notes: SeqNote[] = order.map((s, i) => ({ f: s.f, start: 1.0 + i * 2.5, detune: (rng() - 0.5) * 40,
            velocityDb: (rng() - 0.5) * 6, decay1: s.decay1, B: s.B }));
        const end = 1.0 + order.length * 2.5;
        const sg = synthSequence(notes, end + 0.3, noiseDb, 120, seed, humDb);
        return { x: sg.x, truth: sg.truth, onsets: notes.map((n) => n.start), end, range };
    });
}

/** Peg turn: string rises −40 c → 0 c over 2 s. Returns tracking lag in ms. */
function pegLag(): number {
    let lag = 0, n = 0;
    for (const s of [GUITAR[1], GUITAR[3]]) for (const seed of [1, 2]) {
        const ramp = (t: number) => (t < 0.5 ? -40 : t < 2.5 ? -40 + 20 * (t - 0.5) : 0);
        const sg = synthPluck({ f0: s.f, detuneCents: 0, noteDur: 4, leadIn: 0.5, glideCents: 6, glideTau: 0.3,
            decay1: s.decay1 * 1.5, B: s.B, pluckPos: 0.18, noiseDb: -28, micHpHz: 120, seed, detuneFn: ramp });
        const tracker = new PitchTracker();
        for (let e = BUF; e <= sg.x.length; e += HOP) {
            const t = e / SR, since = t - sg.pluckTime;
            const buf = sg.x.subarray(e - BUF, e);
            const out = tracker.push(t, detectPitchCandidates(buf, SR, 60, 500), rms(buf, BUF - 1024));
            if (since > 0.9 && since < 2.5 && out.frequency !== null) {
                lag += (sg.trueCents(since) - 1200 * Math.log2(out.frequency / s.f)) / 20; n++;
            }
        }
    }
    return (1000 * lag) / n;
}

const avg = (ms: Metrics[]) => Object.fromEntries(Object.keys(ms[0]).map((k) =>
    [k, ms.reduce((a, m) => a + (m as unknown as Record<string, number>)[k], 0) / ms.length])) as unknown as Metrics;
const fmt = (m: Metrics) => `correct ${m.correct.toFixed(0).padStart(3)}%  rightNote ${m.rightNote.toFixed(0).padStart(3)}%  ` +
    `cover ${m.coverage.toFixed(0).padStart(3)}%  noteFlips ${m.noteFlips.toFixed(2)}/s  inTuneFlips ${m.tuneFlips.toFixed(2)}/s  ` +
    `jitter ${m.jitter.toFixed(2)}c  relock ${isNaN(m.relockMs) ? '—' : m.relockMs.toFixed(0)}ms  ghost ${m.ghost.toFixed(0)}%`;

const SCENARIOS: Record<string, () => Run[]> = {
    'guitar single notes, quiet (-40 dB)': () => single(GUITAR, -40, RANGE.guitar),
    'guitar single notes, normal (-28 dB)': () => single(GUITAR, -28, RANGE.guitar),
    'guitar single notes, noisy (-20 dB)': () => single(GUITAR, -20, RANGE.guitar),
    'bass single notes + hum': () => single(BASS, -28, RANGE.bass, -26),
    'session E2→E4 (earlier strings ring on), normal': () => session(GUITAR, -28, RANGE.guitar),
    'session E4→E2, normal': () => session([...GUITAR].reverse(), -28, RANGE.guitar),
    'session E2→E4, noisy': () => session(GUITAR, -20, RANGE.guitar),
    'bass session E1→G2 + hum': () => session(BASS, -28, RANGE.bass, -26),
};
const only = process.argv[2];
for (const [name, mk] of Object.entries(SCENARIOS)) {
    if (only && !name.includes(only)) continue;
    console.log(`${name.padEnd(48)} ${fmt(avg(mk().map(evaluate)))}`);
}
if (!only || 'peg'.includes(only)) console.log(`${'peg turn −40→0 c over 2 s'.padEnd(48)} lag behind peg ${pegLag().toFixed(0)} ms`);
