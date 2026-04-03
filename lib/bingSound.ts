/**
 * Partial definition for the synthetic bell sound.
 * Three harmonics give a satisfying "bing" without sounding harsh.
 */
const PARTIALS: { freqMultiplier: number; gain: number }[] = [
    { freqMultiplier: 1, gain: 0.35 },   // fundamental
    { freqMultiplier: 2, gain: 0.15 },   // octave
    { freqMultiplier: 3, gain: 0.07 },   // fifth above octave
];

/** Fundamental frequency of the bing (A5 = 880 Hz). */
const BING_FUNDAMENTAL_HZ = 880;

/** Total duration of the bing in seconds. */
const BING_DURATION_S = 1.8;

/**
 * Play a bell-like "bing" sound using the provided AudioContext.
 * Each call creates short-lived oscillator nodes that clean themselves up
 * automatically once the sound has decayed.
 *
 * Pass the same AudioContext that is used for microphone input so the
 * browser only needs one audio graph.
 */
export function playBing(audioContext: AudioContext): void {
    const now = audioContext.currentTime;

    PARTIALS.forEach(({ freqMultiplier, gain }) => {
        const osc = audioContext.createOscillator();
        const env = audioContext.createGain();

        osc.connect(env);
        env.connect(audioContext.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(BING_FUNDAMENTAL_HZ * freqMultiplier, now);

        // Sharp attack → exponential decay (classic bell envelope)
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(gain, now + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, now + BING_DURATION_S);

        osc.start(now);
        osc.stop(now + BING_DURATION_S);
    });
}