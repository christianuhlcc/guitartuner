export interface AudioEngineOptions {
    /**
     * FFT size used by the AnalyserNode (= number of time-domain samples).
     * Must be a power of two between 32 and 32768.
     * 4096 is a good default: gives ~93 ms of signal at 44100 Hz, which is
     * sufficient to detect the lowest bass note (E1 ≈ 41 Hz, period ≈ 24 ms).
     */
    fftSize?: number;
    /**
     * Smoothing applied to the frequency-domain data (0 = off, 1 = maximum).
     * We leave it at 0 because we do our own smoothing in the hook.
     */
    smoothingTimeConstant?: number;
}

export interface AudioEngine {
    audioContext: AudioContext;
    analyser: AnalyserNode;
    stream: MediaStream;
    /** Clean up all resources (stop mic, close context). */
    dispose: () => void;
}

/**
 * Request microphone access and initialise the Web Audio API pipeline:
 *   MediaStream → MediaStreamSourceNode → AnalyserNode
 *
 * Disables echo-cancellation, auto-gain and noise-suppression so the raw
 * instrument signal reaches the analyser unchanged.
 *
 * @throws If the user denies microphone permission or the browser does not
 *         support getUserMedia / AudioContext.
 */
export async function createAudioEngine(
    options: AudioEngineOptions = {},
): Promise<AudioEngine> {
    const { fftSize = 4096, smoothingTimeConstant = 0 } = options;

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
        },
    });

    // AudioContext must be created (or resumed) after a user gesture.
    const audioContext = new AudioContext();
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothingTimeConstant;

    source.connect(analyser);
    // Do NOT connect analyser to destination – we only read from it.

    const dispose = () => {
        source.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        if (audioContext.state !== 'closed') audioContext.close();
    };

    return { audioContext, analyser, stream, dispose };
}