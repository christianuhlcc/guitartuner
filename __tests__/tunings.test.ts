import { STANDARD_TUNINGS, findOpenString } from '@/lib/tunings';

describe('STANDARD_TUNINGS – guitar', () => {
    const guitar = STANDARD_TUNINGS.guitar;

    it('has the correct type and label', () => {
        expect(guitar.type).toBe('guitar');
        expect(guitar.label).toBe('Guitar');
    });

    it('has 6 strings', () => {
        expect(guitar.strings).toHaveLength(6);
    });

    it('string numbers run 6 down to 1 (thickest to thinnest)', () => {
        const numbers = guitar.strings.map((s) => s.number);
        expect(numbers).toEqual([6, 5, 4, 3, 2, 1]);
    });

    it('strings are ordered from lowest to highest frequency', () => {
        const freqs = guitar.strings.map((s) => s.frequency);
        const sorted = [...freqs].sort((a, b) => a - b);
        expect(freqs).toEqual(sorted);
    });

    it('has correct notes in standard EADGBE tuning', () => {
        const notes = guitar.strings.map((s) => s.note);
        expect(notes).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    });

    it('has correct octaves', () => {
        const octaves = guitar.strings.map((s) => s.octave);
        expect(octaves).toEqual([2, 2, 3, 3, 3, 4]);
    });

    it('frequencies are all within minFrequency and maxFrequency bounds', () => {
        guitar.strings.forEach((s) => {
            expect(s.frequency).toBeGreaterThanOrEqual(guitar.minFrequency);
            expect(s.frequency).toBeLessThanOrEqual(guitar.maxFrequency);
        });
    });

    it('has positive minFrequency and maxFrequency with min < max', () => {
        expect(guitar.minFrequency).toBeGreaterThan(0);
        expect(guitar.maxFrequency).toBeGreaterThan(guitar.minFrequency);
    });
});

describe('STANDARD_TUNINGS – bass', () => {
    const bass = STANDARD_TUNINGS.bass;

    it('has the correct type and label', () => {
        expect(bass.type).toBe('bass');
        expect(bass.label).toBe('Bass');
    });

    it('has 4 strings', () => {
        expect(bass.strings).toHaveLength(4);
    });

    it('string numbers run 4 down to 1', () => {
        const numbers = bass.strings.map((s) => s.number);
        expect(numbers).toEqual([4, 3, 2, 1]);
    });

    it('strings are ordered from lowest to highest frequency', () => {
        const freqs = bass.strings.map((s) => s.frequency);
        const sorted = [...freqs].sort((a, b) => a - b);
        expect(freqs).toEqual(sorted);
    });

    it('has correct notes in standard EADG tuning', () => {
        const notes = bass.strings.map((s) => s.note);
        expect(notes).toEqual(['E', 'A', 'D', 'G']);
    });

    it('all frequencies are within minFrequency and maxFrequency bounds', () => {
        bass.strings.forEach((s) => {
            expect(s.frequency).toBeGreaterThanOrEqual(bass.minFrequency);
            expect(s.frequency).toBeLessThanOrEqual(bass.maxFrequency);
        });
    });

    it('bass max frequency is lower than guitar max frequency', () => {
        expect(bass.maxFrequency).toBeLessThan(STANDARD_TUNINGS.guitar.maxFrequency);
    });
});

describe('findOpenString', () => {
    it('finds guitar E2 as string 6', () => {
        expect(findOpenString(STANDARD_TUNINGS.guitar, 40)?.number).toBe(6);
    });

    it('returns null for F2', () => {
        expect(findOpenString(STANDARD_TUNINGS.guitar, 41)).toBeNull();
    });

    it('finds bass E1 as string 4', () => {
        expect(findOpenString(STANDARD_TUNINGS.bass, 28)?.number).toBe(4);
    });
});

describe('detection ranges', () => {
    it('guitar 60–500 Hz, bass 30–250 Hz', () => {
        expect([STANDARD_TUNINGS.guitar.minFrequency, STANDARD_TUNINGS.guitar.maxFrequency]).toEqual([60, 500]);
        expect([STANDARD_TUNINGS.bass.minFrequency, STANDARD_TUNINGS.bass.maxFrequency]).toEqual([30, 250]);
    });
});
