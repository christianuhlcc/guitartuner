/**
 * Realistic regression tests: synthetic plucked strings (harmonics, inharmonicity,
 * pitch glide, room noise, hum, phone-mic high-pass) run through the real
 * detector + tracker at 40 Hz. Thresholds are the reference values minus a margin.
 */
import { SR, synthPluck, synthSequence, mulberry32 } from './helpers/synth';
import type { SeqNote } from './helpers/synth';
import { detectPitchCandidates, rms } from '@/lib/pitchDetector';
import { PitchTracker } from '@/lib/pitchTracker';

jest.setTimeout(60_000);

const BUF = 8192;
const HOP = 1200; // 25 ms at 48 kHz
const GUITAR = [
    { name: 'E2', f: 82.41, decay1: 3.0, B: 1.5e-4 }, { name: 'A2', f: 110.0, decay1: 2.8, B: 1.2e-4 },
    { name: 'D3', f: 146.83, decay1: 2.5, B: 1.0e-4 }, { name: 'G3', f: 196.0, decay1: 2.0, B: 0.6e-4 },
    { name: 'B3', f: 246.94, decay1: 1.7, B: 0.5e-4 }, { name: 'E4', f: 329.63, decay1: 1.4, B: 0.4e-4 },
];
const BASS = [
    { name: 'E1', f: 41.2, decay1: 3.5, B: 2.5e-4 }, { name: 'A1', f: 55.0, decay1: 3.2, B: 2.0e-4 },
    { name: 'D2', f: 73.42, decay1: 3.0, B: 1.5e-4 }, { name: 'G2', f: 98.0, decay1: 2.8, B: 1.2e-4 },
];
const GUITAR_RANGE = [60, 500] as const;
const BASS_RANGE = [30, 250] as const;

type StringSpec = (typeof GUITAR)[number];
interface Run {
    x: Float32Array;
    truth: (t: number) => number | null;
    onsets: number[];
    end: number;
    range: readonly [number, number];
}

function evaluate(r: Run) {
    const tracker = new PitchTracker();
    let frames = 0, ok = 0, pcOk = 0, noteFlips = 0, time = 0, ghostF = 0, ghostS = 0;
    let prevMidi: number | null | undefined;
    const relocks: number[] = [];
    const relocked = new Set<number>();
    for (let e = BUF; e <= r.x.length; e += HOP) {
        const t = e / SR;
        if (t > r.end) break;
        const buf = r.x.subarray(e - BUF, e);
        const out = tracker.push(t, detectPitchCandidates(buf, SR, r.range[0], r.range[1]), rms(buf, BUF - 1024));
        const onset = Math.max(-1, ...r.onsets.filter((o) => o <= t));
        if (onset < 0) { ghostF++; if (out.frequency !== null) ghostS++; continue; }
        const truthNow = r.truth(Math.max(onset, t - 0.085));
        const err = out.frequency === null || truthNow === null ? Infinity : 1200 * Math.log2(out.frequency / truthNow);
        if (!relocked.has(onset) && Math.abs(err) <= 20) { relocked.add(onset); relocks.push(t - onset); }
        if (t - onset < 0.25) { prevMidi = undefined; continue; }
        frames++; time += HOP / SR;
        if (Math.abs(err) <= 20) ok++;
        if (out.frequency !== null && Math.abs((((err % 1200) + 1800) % 1200) - 600) <= 20) pcOk++;
        if (prevMidi !== undefined && out.midi !== prevMidi) noteFlips++;
        prevMidi = out.midi;
    }
    relocks.sort((a, b) => a - b);
    return {
        correct: (100 * ok) / frames,
        rightNote: (100 * pcOk) / frames,
        noteFlips: noteFlips / time,
        pickupMs: relocks.length ? 1000 * relocks[Math.floor(relocks.length / 2)] : Infinity,
        ghost: ghostF ? (100 * ghostS) / ghostF : 0,
    };
}

function pluckRun(s: StringSpec, noiseDb: number, range: readonly [number, number], seed = 1, humDb?: number): Run {
    const sg = synthPluck({ f0: s.f, detuneCents: 0, noteDur: 3, leadIn: 1.0, glideCents: 8, glideTau: 0.3,
        decay1: s.decay1, B: s.B, pluckPos: 0.18, noiseDb, micHpHz: 120, seed, humDb });
    return {
        x: sg.x,
        truth: (t) => (t < sg.pluckTime ? null : s.f * Math.pow(2, sg.trueCents(t - sg.pluckTime) / 1200)),
        onsets: [sg.pluckTime], end: 4.0, range,
    };
}

function sessionRun(order: StringSpec[], noiseDb: number, range: readonly [number, number], humDb?: number): Run {
    const seed = 1;
    const rng = mulberry32(seed * 7919);
    const notes: SeqNote[] = order.map((s, i) => ({ f: s.f, start: 1.0 + i * 2.5, detune: (rng() - 0.5) * 40,
        velocityDb: (rng() - 0.5) * 6, decay1: s.decay1, B: s.B }));
    const end = 1.0 + order.length * 2.5;
    const sg = synthSequence(notes, end + 0.3, noiseDb, 120, seed, humDb);
    return { x: sg.x, truth: sg.truth, onsets: notes.map((n) => n.start), end, range };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('pitch pipeline (synthetic plucks)', () => {
    let normal: ReturnType<typeof evaluate>[];
    let noisy: ReturnType<typeof evaluate>[];
    let sessionUp: ReturnType<typeof evaluate>;
    let sessionDown: ReturnType<typeof evaluate>;
    let bassSession: ReturnType<typeof evaluate>;
    let pegRun: ReturnType<typeof synthPluck>;
    const a2 = GUITAR[1];
    const ramp = (t: number) => (t < 0.5 ? -40 : t < 2.5 ? -40 + 20 * (t - 0.5) : 0);

    beforeAll(() => {
        normal = GUITAR.map((s) => evaluate(pluckRun(s, -28, GUITAR_RANGE)));
        noisy = [GUITAR[2], GUITAR[3], GUITAR[5]].map((s) => evaluate(pluckRun(s, -20, GUITAR_RANGE)));
        sessionUp = evaluate(sessionRun(GUITAR, -28, GUITAR_RANGE));
        sessionDown = evaluate(sessionRun([...GUITAR].reverse(), -28, GUITAR_RANGE));
        bassSession = evaluate(sessionRun(BASS, -28, BASS_RANGE, -26));
        pegRun = synthPluck({ f0: a2.f, detuneCents: 0, noteDur: 4, leadIn: 0.5, glideCents: 6, glideTau: 0.3,
            decay1: a2.decay1 * 1.5, B: a2.B, pluckPos: 0.18, noiseDb: -28, micHpHz: 120, seed: 1, detuneFn: ramp });
    });

    it('guitar single notes, normal room', () => {
        expect(mean(normal.map((m) => m.correct))).toBeGreaterThanOrEqual(97);
        expect(mean(normal.map((m) => m.noteFlips))).toBeLessThanOrEqual(0.1);
        expect(Math.max(...normal.map((m) => m.ghost))).toBe(0);
    });

    it('guitar single notes, noisy room', () => {
        expect(mean(noisy.map((m) => m.correct))).toBeGreaterThanOrEqual(95);
    });

    it('session E2→E4 with earlier strings ringing', () => {
        expect(sessionUp.correct).toBeGreaterThanOrEqual(95);
        expect(sessionUp.rightNote).toBeGreaterThanOrEqual(98);
        expect(sessionUp.pickupMs).toBeLessThanOrEqual(200);
    });

    it('session E4→E2', () => {
        expect(sessionDown.correct).toBeGreaterThanOrEqual(97);
    });

    it('bass session with mains hum', () => {
        expect(bassSession.correct).toBeGreaterThanOrEqual(95);
    });

    it('follows a turning peg with ≤ 160 ms lag', () => {
        const tracker = new PitchTracker();
        let lag = 0, n = 0;
        for (let e = BUF; e <= pegRun.x.length; e += HOP) {
            const t = e / SR, since = t - pegRun.pluckTime;
            const buf = pegRun.x.subarray(e - BUF, e);
            const out = tracker.push(t, detectPitchCandidates(buf, SR, 60, 500), rms(buf, BUF - 1024));
            if (since > 0.9 && since < 2.5 && out.frequency !== null) {
                lag += (pegRun.trueCents(since) - 1200 * Math.log2(out.frequency / a2.f)) / 20;
                n++;
            }
        }
        expect((1000 * lag) / n).toBeLessThanOrEqual(160);
    });
});
