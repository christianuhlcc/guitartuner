/** Supported instrument types */
export type InstrumentType = 'guitar' | 'bass';

/** Definition of a single string in a tuning */
export interface StringDefinition {
    /** Note name in scientific pitch notation (e.g. "E", "A") */
    note: string;
    /** Octave number (e.g. 2 for E2) */
    octave: number;
    /** Target frequency in Hz */
    frequency: number;
    /** String number: 1 = thinnest / highest-pitched */
    number: number;
}

/** Full tuning definition for one instrument */
export interface InstrumentTuning {
    type: InstrumentType;
    label: string;
    /** Strings ordered from lowest to highest pitch */
    strings: StringDefinition[];
    /** Lower bound for pitch detection (Hz) – avoids false positives */
    minFrequency: number;
    /** Upper bound for pitch detection (Hz) */
    maxFrequency: number;
}

/**
 * Standard tunings for guitar and bass.
 * Frequencies sourced from equal-temperament at A4 = 440 Hz.
 */
export const STANDARD_TUNINGS: Record<InstrumentType, InstrumentTuning> = {
    guitar: {
        type: 'guitar',
        label: 'Guitar',
        minFrequency: 70,
        maxFrequency: 360,
        strings: [
            { number: 6, note: 'E', octave: 2, frequency: 82.41 },
            { number: 5, note: 'A', octave: 2, frequency: 110.00 },
            { number: 4, note: 'D', octave: 3, frequency: 146.83 },
            { number: 3, note: 'G', octave: 3, frequency: 196.00 },
            { number: 2, note: 'B', octave: 3, frequency: 246.94 },
            { number: 1, note: 'E', octave: 4, frequency: 329.63 },
        ],
    },
    bass: {
        type: 'bass',
        label: 'Bass',
        minFrequency: 35,
        maxFrequency: 115,
        strings: [
            { number: 4, note: 'E', octave: 1, frequency: 41.20 },
            { number: 3, note: 'A', octave: 1, frequency: 55.00 },
            { number: 2, note: 'D', octave: 2, frequency: 73.42 },
            { number: 1, note: 'G', octave: 2, frequency: 98.00 },
        ],
    },
};