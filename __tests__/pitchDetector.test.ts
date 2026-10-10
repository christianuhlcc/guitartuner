import {
    detectPitch,
    detectPitchCandidates,
    pickMpm,
    rms,
    PitchCandidate,
} from '@/lib/pitchDetector';
import { STANDARD_TUNINGS } from '@/lib/tunings';
import { frequencyToCents } from '@/lib/noteUtils';

const RATES = [44100, 48000];
const GUITAR = { min: 60, max: 500 };
const BASS = { min: 30, max: 250 };

function sineWave(frequency: number, sampleRate: number, numSamples = 8192, amplitude = 0.5): Float32Array {
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
    return buffer;
}

function harmonicTone(frequency: number, sampleRate: number, numSamples = 8192): Float32Array {
    const buffer = new Float32Array(numSamples);
    for (let h = 1; h <= 6; h++) {
        for (let i = 0; i < numSamples; i++) {
            buffer[i] += (0.4 / h) * Math.sin((2 * Math.PI * frequency * h * i) / sampleRate);
        }
    }
    return buffer;
}

describe.each(RATES)('detectPitch at %i Hz', (sr) => {
    describe.each([
        ['guitar', STANDARD_TUNINGS.guitar, GUITAR],
        ['bass', STANDARD_TUNINGS.bass, BASS],
    ] as const)('%s strings', (_name, tuning, range) => {
        it.each(tuning.strings.map((s) => [`${s.note}${s.octave}`, s.frequency] as const))(
            'detects %s within ±2 cents',
            (_label, freq) => {
                const detected = detectPitch(sineWave(freq, sr), sr, range.min, range.max);
                expect(detected).not.toBeNull();
                expect(Math.abs(frequencyToCents(detected!, freq))).toBeLessThan(2);
            },
        );
    });
});

describe('detectPitch – silence / noise rejection', () => {
    it('returns null for a silent buffer', () => {
        expect(detectPitch(new Float32Array(8192), 44100)).toBeNull();
    });

    it('returns null for a sub-threshold buffer', () => {
        const buf = new Float32Array(8192);
        for (let i = 0; i < buf.length; i++) buf[i] = Math.sin(i * 1.234) * 0.001;
        expect(detectPitch(buf, 44100)).toBeNull();
        expect(detectPitchCandidates(buf, 44100, 60, 500)).toEqual([]);
    });

    it('returns no candidates for an impossible lag range', () => {
        expect(detectPitchCandidates(sineWave(110, 44100, 64), 44100, 60, 500)).toEqual([]);
    });

    it('uses default range when none is passed', () => {
        const d = detectPitch(sineWave(196, 44100), 44100);
        expect(d).toBeCloseTo(196, 0);
    });
});

describe('detectPitchCandidates', () => {
    const sr = 44100;

    it('returns candidates in descending-frequency order with clarity in [0, 1]', () => {
        const cands = detectPitchCandidates(harmonicTone(110, sr), sr, 60, 500);
        expect(cands.length).toBeGreaterThan(1);
        for (let i = 1; i < cands.length; i++) {
            expect(cands[i].frequency).toBeLessThan(cands[i - 1].frequency);
        }
        for (const c of cands) {
            expect(c.clarity).toBeGreaterThanOrEqual(0);
            expect(c.clarity).toBeLessThanOrEqual(1);
        }
    });

    it('reports clarity > 0.9 for a clean harmonic tone', () => {
        const cands = detectPitchCandidates(harmonicTone(146.83, sr), sr, 60, 500);
        const best = pickMpm(cands)!;
        expect(best.clarity).toBeGreaterThan(0.9);
        expect(Math.abs(frequencyToCents(best.frequency, 146.83))).toBeLessThan(2);
    });
});

describe('pickMpm', () => {
    const c = (frequency: number, clarity: number): PitchCandidate => ({ frequency, clarity });

    it('returns null when nothing reaches 0.5', () => {
        expect(pickMpm([c(200, 0.4), c(100, 0.49)])).toBeNull();
        expect(pickMpm([])).toBeNull();
    });

    it('picks the shortest lag within k of the best', () => {
        const cands = [c(400, 0.7), c(200, 0.9), c(100, 0.95)];
        expect(pickMpm(cands, 0.8)!.frequency).toBe(200);
        expect(pickMpm(cands, 0.7)!.frequency).toBe(400);
    });
});

describe('rms', () => {
    it('computes RMS over a sub-range', () => {
        const buf = new Float32Array([0, 0, 1, -1]);
        expect(rms(buf)).toBeCloseTo(Math.sqrt(0.5), 9);
        expect(rms(buf, 2)).toBeCloseTo(1, 9);
    });
});
