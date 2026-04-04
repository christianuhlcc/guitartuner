/**
 * Minimum RMS level below which the signal is considered silence.
 * Adjust if the app picks up too much background noise.
 */
const SILENCE_RMS_THRESHOLD = 0.01;

/**
 * Amplitude below which we trim the edges of the signal before
 * computing autocorrelation (improves period estimation).
 */
const EDGE_TRIM_THRESHOLD = 0.2;

/**
 * Detect the fundamental frequency of a monophonic audio signal using
 * autocorrelation with parabolic interpolation.
 *
 * Algorithm outline:
 *  1. Reject silence by checking RMS level.
 *  2. Trim transient edges to stabilise the waveform window.
 *  3. Compute normalised autocorrelation only over the lag range that
 *     corresponds to [minFrequency, maxFrequency] – this keeps the
 *     computational cost proportional to the frequency range rather
 *     than the full buffer size.
 *  4. Locate the dominant peak after the first correlation dip.
 *  5. Refine the period estimate with parabolic interpolation for
 *     sub-sample accuracy before converting to Hz.
 *
 * @param buffer        Float32Array from AnalyserNode.getFloatTimeDomainData
 * @param sampleRate    AudioContext sample rate (e.g. 44100)
 * @param minFrequency  Lowest frequency to search for in Hz (default 30)
 * @param maxFrequency  Highest frequency to search for in Hz (default 400)
 * @returns             Detected frequency in Hz, or null if signal is too
 *                      quiet or no clear pitch was found.
 */
export function detectPitch(
    buffer: Float32Array,
    sampleRate: number,
    minFrequency = 30,
    maxFrequency = 400,
): number | null {
    const size = buffer.length;

    // ── 1. Silence check ─────────────────────────────────────────────────────
    let rmsSum = 0;
    for (let i = 0; i < size; i++) rmsSum += buffer[i] * buffer[i];
    const rms = Math.sqrt(rmsSum / size);
    if (rms < SILENCE_RMS_THRESHOLD) return null;

    // ── 2. Trim silent/transient edges ───────────────────────────────────────
    let trimStart = 0;
    let trimEnd = size - 1;
    for (let i = 0; i < size / 2; i++) {
        if (Math.abs(buffer[i]) >= EDGE_TRIM_THRESHOLD) {
            trimStart = i;
            break;
        }
    }
    for (let i = 1; i < size / 2; i++) {
        if (Math.abs(buffer[size - i]) >= EDGE_TRIM_THRESHOLD) {
            trimEnd = size - i;
            break;
        }
    }
    const signal = buffer.slice(trimStart, trimEnd + 1);
    const signalLen = signal.length;

    // ── 3. Compute autocorrelation over the relevant lag range ────────────────
    const minLag = Math.max(1, Math.floor(sampleRate / maxFrequency));
    const maxLag = Math.min(
        Math.ceil(sampleRate / minFrequency),
        Math.floor(signalLen / 2),
    );
    if (maxLag <= minLag) return null;

    // Pre-allocate and fill from minLag to maxLag (inclusive)
    const correlation = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        const windowSize = signalLen - lag;
        for (let j = 0; j < windowSize; j++) {
            sum += signal[j] * signal[j + lag];
        }
        // Normalise by window size so different lags are comparable
        correlation[lag] = sum / windowSize;
    }

    // ── 4. Find the best peak ─────────────────────────────────────────────────
    // Skip the initial downward slope to find the first trough
    let d = minLag;
    while (d < maxLag - 1 && correlation[d] >= correlation[d + 1]) d++;

    // Find the absolute maximum correlation to establish a threshold
    let absoluteMax = -Infinity;
    for (let i = d; i <= maxLag; i++) {
        if (correlation[i] > absoluteMax) {
            absoluteMax = correlation[i];
        }
    }

    // Discard weak / ambiguous detections
    if (absoluteMax <= 0) return null;

    const threshold = 0.9 * absoluteMax;
    let maxPos = minLag;
    let found = false;

    // Scan for the *first* prominent local maximum
    for (let i = d + 1; i < maxLag; i++) {
        if (correlation[i] > correlation[i - 1] && correlation[i] > correlation[i + 1]) {
            if (correlation[i] >= threshold) {
                maxPos = i;
                found = true;
                break;
            }
        }
    }

    // Fallback if the peak lies precisely at the boundary edges
    // or if no strict local maximum breached the threshold
    if (!found) {
        for (let i = d; i <= maxLag; i++) {
            if (correlation[i] === absoluteMax) {
                maxPos = i;
                break;
            }
        }
    }

    // ── 5. Parabolic interpolation ────────────────────────────────────────────
    if (maxPos <= minLag || maxPos >= maxLag) {
        return sampleRate / maxPos;
    }
    const y1 = correlation[maxPos - 1];
    const y2 = correlation[maxPos];
    const y3 = correlation[maxPos + 1];
    const a = (y1 + y3 - 2 * y2) / 2;
    const b = (y3 - y1) / 2;
    const refinedLag = a !== 0 ? maxPos - b / (2 * a) : maxPos;

    return sampleRate / refinedLag;
}