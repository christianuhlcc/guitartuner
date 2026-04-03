import {
    frequencyToMidi,
    midiToFrequency,
    midiToNoteName,
    midiToOctave,
    frequencyToCents,
    isInTune,
} from '@/lib/noteUtils';

// ─── frequencyToMidi ────────────────────────────────────────────────────────

describe('frequencyToMidi', () => {
    it('maps A4 (440 Hz) → MIDI 69', () => {
        expect(frequencyToMidi(440)).toBe(69);
    });

    it('maps middle C (≈261.63 Hz) → MIDI 60', () => {
        expect(frequencyToMidi(261.63)).toBe(60);
    });

    it('maps E2 (≈82.41 Hz) → MIDI 40 (guitar low E)', () => {
        expect(frequencyToMidi(82.41)).toBe(40);
    });

    it('maps A5 (880 Hz) → MIDI 81', () => {
        expect(frequencyToMidi(880)).toBe(81);
    });

    it('maps A3 (220 Hz) → MIDI 57', () => {
        expect(frequencyToMidi(220)).toBe(57);
    });
});

// ─── midiToFrequency ────────────────────────────────────────────────────────

describe('midiToFrequency', () => {
    it('maps MIDI 69 → 440 Hz (A4)', () => {
        expect(midiToFrequency(69)).toBeCloseTo(440, 2);
    });

    it('maps MIDI 60 → ~261.63 Hz (middle C)', () => {
        expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
    });

    it('maps MIDI 81 → 880 Hz (A5)', () => {
        expect(midiToFrequency(81)).toBeCloseTo(880, 2);
    });

    it('is the inverse of frequencyToMidi for A4', () => {
        const midi = frequencyToMidi(440);
        expect(midiToFrequency(midi)).toBeCloseTo(440, 2);
    });
});

// ─── midiToNoteName ─────────────────────────────────────────────────────────

describe('midiToNoteName', () => {
    it('returns "A" for MIDI 69 (A4)', () => {
        expect(midiToNoteName(69)).toBe('A');
    });

    it('returns "C" for MIDI 60 (middle C)', () => {
        expect(midiToNoteName(60)).toBe('C');
    });

    it('returns "C#" for MIDI 61', () => {
        expect(midiToNoteName(61)).toBe('C#');
    });

    it('returns "E" for MIDI 40 (guitar low E)', () => {
        expect(midiToNoteName(40)).toBe('E');
    });

    it('handles negative MIDI values without crashing', () => {
        // MIDI 0 = C-1, MIDI -1 wraps to B
        expect(midiToNoteName(-1)).toBe('B');
    });
});

// ─── midiToOctave ───────────────────────────────────────────────────────────

describe('midiToOctave', () => {
    it('returns 4 for MIDI 69 (A4)', () => {
        expect(midiToOctave(69)).toBe(4);
    });

    it('returns 4 for MIDI 60 (middle C, C4)', () => {
        expect(midiToOctave(60)).toBe(4);
    });

    it('returns 2 for MIDI 40 (E2, guitar low E)', () => {
        expect(midiToOctave(40)).toBe(2);
    });

    it('returns 5 for MIDI 81 (A5)', () => {
        expect(midiToOctave(81)).toBe(5);
    });
});

// ─── frequencyToCents ───────────────────────────────────────────────────────

describe('frequencyToCents', () => {
    it('returns 0 when detected === target', () => {
        expect(frequencyToCents(440, 440)).toBe(0);
    });

    it('returns +1200 when detected is one octave higher', () => {
        expect(frequencyToCents(880, 440)).toBeCloseTo(1200, 5);
    });

    it('returns -1200 when detected is one octave lower', () => {
        expect(frequencyToCents(220, 440)).toBeCloseTo(-1200, 5);
    });

    it('returns +100 when detected is one semitone sharp', () => {
        // A#4 ≈ 466.16 Hz is one semitone above A4 440 Hz
        expect(frequencyToCents(466.16, 440)).toBeCloseTo(100, 0);
    });

    it('returns -100 when detected is one semitone flat', () => {
        // G#4 ≈ 415.30 Hz is one semitone below A4 440 Hz
        expect(frequencyToCents(415.3, 440)).toBeCloseTo(-100, 0);
    });

    it('returns a positive number when detected > target', () => {
        expect(frequencyToCents(450, 440)).toBeGreaterThan(0);
    });

    it('returns a negative number when detected < target', () => {
        expect(frequencyToCents(430, 440)).toBeLessThan(0);
    });
});

// ─── isInTune ────────────────────────────────────────────────────────────────

describe('isInTune', () => {
    it('returns true when frequencies are identical', () => {
        expect(isInTune(440, 440)).toBe(true);
    });

    it('returns true within the default ±5 cent tolerance', () => {
        // ~1 cent sharp – well within default tolerance
        const slightlySharp = 440 * Math.pow(2, 1 / 1200); // +1 cent
        expect(isInTune(slightlySharp, 440)).toBe(true);
    });

    it('returns false just outside the default ±5 cent tolerance', () => {
        // +10 cents sharp – outside default tolerance
        const tenCentsSharp = 440 * Math.pow(2, 10 / 1200);
        expect(isInTune(tenCentsSharp, 440)).toBe(false);
    });

    it('returns true within a custom tolerance', () => {
        const twentyCentsSharp = 440 * Math.pow(2, 20 / 1200);
        expect(isInTune(twentyCentsSharp, 440, 25)).toBe(true);
    });

    it('returns false outside a custom tolerance', () => {
        const twentyCentsSharp = 440 * Math.pow(2, 20 / 1200);
        expect(isInTune(twentyCentsSharp, 440, 15)).toBe(false);
    });

    it('handles flat notes symmetrically', () => {
        const slightlyFlat = 440 * Math.pow(2, -3 / 1200); // -3 cents
        expect(isInTune(slightlyFlat, 440)).toBe(true);
    });
});
