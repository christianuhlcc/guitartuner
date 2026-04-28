/**
 * Minimum RMS level below which the signal is considered silence.
 */
const SILENCE_RMS_THRESHOLD = 0.01;

/**
 * YIN CMNDF threshold: d'(τ) below this value is accepted as a strong pitch
 * match. 0.10 means >90% of the signal energy is periodic at that lag.
 */
const YIN_THRESHOLD = 0.10;

/**
 * Fallback confidence limit. When no lag clears YIN_THRESHOLD we still return
 * the global minimum if it is below this value, otherwise null.
 */
const YIN_FALLBACK_THRESHOLD = 0.35;

/**
 * Detect the fundamental frequency of a monophonic audio signal using the
 * YIN algorithm (Cheveigné & Kawahara, 2002).
 *
 * Algorithm outline:
 *  1. Reject silence by checking RMS level.
 *  2. Compute the difference function d(τ) over [1, maxLag].
 *  3. Compute the Cumulative Mean Normalised Difference Function (CMNDF)
 *     d'(τ) = d(τ) · τ / Σ_{j=1}^{τ} d(j), with d'(0) = 1.
 *     Normalisation prevents the trivial τ=0 solution from dominating and
 *     naturally discourages the algorithm from picking a subharmonic lag.
 *  4. Find the first local minimum of d' below YIN_THRESHOLD in [minLag, maxLag].
 *     Fall back to the global minimum when no confident minimum is found.
 *  5. Refine with parabolic interpolation for sub-sample accuracy.
 *
 * Compared to plain autocorrelation this eliminates the octave-error trap that
 * makes lower strings unreliable, because the CMNDF penalises longer lags even
 * when their raw correlation is high.
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
    const halfSize = Math.floor(size / 2);

    // ── 1. Silence check ─────────────────────────────────────────────────────
    let rmsSum = 0;
    for (let i = 0; i < size; i++) rmsSum += buffer[i] * buffer[i];
    if (Math.sqrt(rmsSum / size) < SILENCE_RMS_THRESHOLD) return null;

    // ── Lag bounds ───────────────────────────────────────────────────────────
    const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
    const maxLag = Math.min(Math.ceil(sampleRate / minFrequency), halfSize - 1);
    if (maxLag <= minLag) return null;

    // ── 2 & 3. Difference function + CMNDF in one pass ───────────────────────
    // d(τ)  = Σ_{j=0}^{halfSize-1} (x_j − x_{j+τ})²
    // d'(τ) = d(τ) · τ / Σ_{j=1}^{τ} d(j)   (CMNDF)
    const yinBuffer = new Float32Array(maxLag + 1);
    let runningSum = 0;
    for (let tau = 1; tau <= maxLag; tau++) {
        let delta = 0;
        for (let j = 0; j < halfSize; j++) {
            const diff = buffer[j] - buffer[j + tau];
            delta += diff * diff;
        }
        runningSum += delta;
        yinBuffer[tau] = runningSum > 0 ? (delta * tau) / runningSum : 1.0;
    }

    // ── 4. Find the first local minimum below the threshold ──────────────────
    let tau = minLag;
    while (tau <= maxLag) {
        if (yinBuffer[tau] < YIN_THRESHOLD) {
            // Slide to the valley bottom
            while (tau + 1 <= maxLag && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
            break;
        }
        tau++;
    }

    // Fallback: use the global minimum when no confident detection found
    if (tau > maxLag) {
        let minVal = Infinity;
        let minPos = minLag;
        for (let i = minLag; i <= maxLag; i++) {
            if (yinBuffer[i] < minVal) {
                minVal = yinBuffer[i];
                minPos = i;
            }
        }
        if (minVal > YIN_FALLBACK_THRESHOLD) return null;
        tau = minPos;
    }

    // ── 5. Parabolic interpolation ────────────────────────────────────────────
    if (tau > minLag && tau < maxLag) {
        const y1 = yinBuffer[tau - 1];
        const y2 = yinBuffer[tau];
        const y3 = yinBuffer[tau + 1];
        const a = (y1 + y3 - 2 * y2) / 2;
        const b = (y3 - y1) / 2;
        const refined = a !== 0 ? tau - b / (2 * a) : tau;
        return sampleRate / refined;
    }

    return sampleRate / tau;
}
