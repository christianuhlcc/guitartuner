import { STANDARD_TUNINGS } from '@/lib/tunings';

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
