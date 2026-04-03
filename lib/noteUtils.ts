const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Reference: A4 = 440 Hz = MIDI note 69 */
const A4_FREQUENCY = 440.0;
const A4_MIDI = 69;

/**
 * Convert a frequency in Hz to the nearest MIDI note number.
 * A4 (440 Hz) → 69, middle C (261.63 Hz) → 60.
 */
export function frequencyToMidi(frequency: number): number {
    return Math.round(12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI);
}

/**
 * Convert a MIDI note number to its exact frequency in Hz.
 */
export function midiToFrequency(midi: number): number {
    return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Get the note name (C, C#, D, …) for a MIDI note number.
 */
export function midiToNoteName(midi: number): string {
    return NOTE_NAMES[((midi % 12) + 12) % 12];
}

/**
 * Get the octave number for a MIDI note number.
 * Middle C (MIDI 60) is in octave 4.
 */
export function midiToOctave(midi: number): number {
    return Math.floor(midi / 12) - 1;
}

/**
 * Calculate the deviation in cents between a detected and a target frequency.
 * Returns 0 when equal, positive when detected is sharp, negative when flat.
 * 100 cents = 1 semitone, 1200 cents = 1 octave.
 */
export function frequencyToCents(
    detectedFrequency: number,
    targetFrequency: number,
): number {
    return 1200 * Math.log2(detectedFrequency / targetFrequency);
}

/**
 * Check whether a detected frequency is within a given cent tolerance of
 * a target frequency. Default tolerance is ±5 cents.
 */
export function isInTune(
    detectedFrequency: number,
    targetFrequency: number,
    toleranceCents = 5,
): boolean {
    return (
        Math.abs(frequencyToCents(detectedFrequency, targetFrequency)) <=
        toleranceCents
    );
}