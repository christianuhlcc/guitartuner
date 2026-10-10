/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { usePitchDetection } from '../hooks/usePitchDetection';
import { STANDARD_TUNINGS } from '../lib/tunings';

jest.mock('../lib/audioEngine', () => ({
    createAudioEngine: jest.fn(),
}));

// Keep the real pickMpm / rms-free helpers the tracker needs; control the rest.
jest.mock('../lib/pitchDetector', () => ({
    ...jest.requireActual('../lib/pitchDetector'),
    detectPitchCandidates: jest.fn(),
    rms: jest.fn(),
}));

jest.mock('../lib/bingSound', () => ({
    playBing: jest.fn(),
}));

const { createAudioEngine } = require('../lib/audioEngine');
const { detectPitchCandidates, rms } = require('../lib/pitchDetector');
const { playBing } = require('../lib/bingSound');

const GUITAR = STANDARD_TUNINGS.guitar;
const BASS = STANDARD_TUNINGS.bass;
const A2 = 110;
const shift = (f: number, cents: number) => f * Math.pow(2, cents / 1200);

let clock = 0;
const nowFn = () => clock;

function mockEngine() {
    const audioContext = { sampleRate: 48000 } as AudioContext;
    const analyser = { fftSize: 8192, getFloatTimeDomainData: jest.fn() };
    const dispose = jest.fn();
    createAudioEngine.mockResolvedValueOnce({ audioContext, analyser, dispose });
    return { audioContext, analyser, dispose };
}

/** Advance both the injected clock and the fake timers by n analysis ticks. */
async function tick(n: number) {
    for (let i = 0; i < n; i++) {
        clock += 25;
        await act(async () => {
            jest.advanceTimersByTime(25);
        });
    }
}

function hear(frequency: number | null, clarity = 0.95) {
    detectPitchCandidates.mockReturnValue(frequency === null ? [] : [{ frequency, clarity }]);
}

async function start(instrument = GUITAR) {
    const engine = mockEngine();
    const hook = renderHook(({ inst }) => usePitchDetection(inst, nowFn), {
        initialProps: { inst: instrument },
    });
    await act(async () => {
        hook.result.current.toggle();
    });
    return { ...hook, ...engine };
}

describe('usePitchDetection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        clock = 10_000;
        rms.mockReturnValue(0.05);
        hear(null);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('initializes idle', () => {
        const { result } = renderHook(() => usePitchDetection(GUITAR, nowFn));
        expect(result.current).toMatchObject({
            micStatus: 'idle',
            frequency: null,
            midi: null,
            noteName: null,
            octave: null,
            cents: null,
            isInTune: false,
            isStale: false,
            errorMessage: null,
        });
    });

    it('starts the engine with an 8192 FFT and ignores a second start', async () => {
        const { result } = await start();
        await act(async () => {
            result.current.startListening();
        });
        expect(createAudioEngine).toHaveBeenCalledTimes(1);
        expect(createAudioEngine).toHaveBeenCalledWith({ fftSize: 8192 });
        expect(result.current.micStatus).toBe('active');
    });

    it('works with the default clock', async () => {
        mockEngine();
        const { result } = renderHook(() => usePitchDetection(GUITAR));
        await act(async () => {
            result.current.toggle();
        });
        hear(A2);
        await act(async () => {
            jest.advanceTimersByTime(25 * 4);
        });
        expect(result.current.micStatus).toBe('active');
    });

    it('handles mic rejection (Error)', async () => {
        createAudioEngine.mockRejectedValueOnce(new Error('Permission denied'));
        const { result } = renderHook(() => usePitchDetection(GUITAR, nowFn));
        await act(async () => {
            result.current.toggle();
        });
        expect(result.current.micStatus).toBe('error');
        expect(result.current.errorMessage).toBe('Permission denied');
    });

    it('handles mic rejection (NotAllowedError)', async () => {
        createAudioEngine.mockRejectedValueOnce(new DOMException('Not allowed', 'NotAllowedError'));
        const { result } = renderHook(() => usePitchDetection(GUITAR, nowFn));
        await act(async () => {
            result.current.startListening();
        });
        expect(result.current.errorMessage).toBe('Microphone permission denied.');
    });

    it('handles mic rejection (unknown)', async () => {
        createAudioEngine.mockRejectedValueOnce('string error');
        const { result } = renderHook(() => usePitchDetection(GUITAR, nowFn));
        await act(async () => {
            result.current.startListening();
        });
        expect(result.current.errorMessage).toBe('Could not access microphone.');
    });

    it('passes the instrument range and sample rate to the detector', async () => {
        const { audioContext } = await start(BASS);
        await tick(1);
        expect(detectPitchCandidates).toHaveBeenCalledWith(
            expect.any(Float32Array),
            audioContext.sampleRate,
            BASS.minFrequency,
            BASS.maxFrequency,
        );
        expect(rms).toHaveBeenCalledWith(expect.any(Float32Array), 8192 - 1024);
    });

    it('locks after 3 ticks and maps note, octave and cents', async () => {
        const { result } = await start();
        hear(shift(A2, 12));
        await tick(2);
        expect(result.current.frequency).toBeNull();
        await tick(1);
        expect(result.current.midi).toBe(45);
        expect(result.current.noteName).toBe('A');
        expect(result.current.octave).toBe(2);
        expect(result.current.cents).toBeCloseTo(12, 1);
        expect(result.current.isInTune).toBe(false);
    });

    it('holds through a dropout, goes stale, then clears', async () => {
        const { result } = await start();
        hear(A2);
        await tick(10);
        expect(result.current.noteName).toBe('A');

        hear(null);
        await tick(3); // 75 ms
        expect(result.current.noteName).toBe('A');
        expect(result.current.isStale).toBe(false);
        await tick(5); // 200 ms
        expect(result.current.isStale).toBe(true);
        expect(result.current.noteName).toBe('A');
        await tick(14); // > 500 ms
        expect(result.current.frequency).toBeNull();
        expect(result.current.noteName).toBeNull();
        expect(result.current.octave).toBeNull();
        expect(result.current.isStale).toBe(false);
    });

    it('plays the bing once after ≥ 600 ms in tune and respects the cooldown', async () => {
        const { result, audioContext } = await start();
        hear(A2);
        await tick(10);
        expect(result.current.isInTune).toBe(true);
        expect(playBing).not.toHaveBeenCalled();
        await tick(30); // ~ 1 s in tune
        expect(playBing).toHaveBeenCalledTimes(1);
        expect(playBing).toHaveBeenCalledWith(audioContext);

        // still in tune: no repeat
        await tick(120);
        expect(playBing).toHaveBeenCalledTimes(1);

        // Leave tune and return within the cooldown window → blocked
        hear(shift(A2, 30));
        await tick(80); // 2 s out of tune
        hear(A2);
        await tick(20); // back in tune, 0.5 s… not yet 600 ms
        expect(playBing).toHaveBeenCalledTimes(1);
        await tick(20);
        expect(playBing).toHaveBeenCalledTimes(2); // cooldown long expired by now
    });

    it('does not bing again within the 2 s cooldown after re-arming', async () => {
        const { result } = await start();
        hear(A2);
        await tick(40);
        expect(playBing).toHaveBeenCalledTimes(1);
        // Quick wobble out of tune (> 7 c) and back
        hear(shift(A2, 12));
        await tick(8);
        hear(A2);
        await tick(30); // 750 ms in tune again, but < 2 s since the first bing
        expect(result.current.isInTune).toBe(true);
        expect(playBing).toHaveBeenCalledTimes(1);
    });

    it('re-arms after the note changes', async () => {
        await start();
        hear(A2);
        await tick(40);
        expect(playBing).toHaveBeenCalledTimes(1);
        const d3 = 146.83;
        hear(d3);
        rms.mockReturnValue(0.5); // onset
        await tick(1);
        rms.mockReturnValue(0.5);
        await tick(100);
        expect(playBing).toHaveBeenCalledTimes(2);
    });

    it('resets tracking when the instrument changes', async () => {
        const { result, rerender } = await start();
        hear(A2);
        await tick(10);
        expect(result.current.noteName).toBe('A');
        rerender({ inst: BASS });
        expect(result.current.frequency).toBeNull();
        expect(result.current.noteName).toBeNull();
        expect(result.current.micStatus).toBe('active');
        // needs fresh acquisition
        await tick(2);
        expect(result.current.frequency).toBeNull();
        await tick(1);
        expect(result.current.noteName).toBe('A');
    });

    it('stop clears state, disposes the engine and stops analysing', async () => {
        const { result, dispose } = await start();
        hear(A2);
        await tick(10);
        await act(async () => {
            result.current.toggle();
        });
        expect(result.current.micStatus).toBe('idle');
        expect(result.current.frequency).toBeNull();
        expect(dispose).toHaveBeenCalled();
        detectPitchCandidates.mockClear();
        await tick(5);
        expect(detectPitchCandidates).not.toHaveBeenCalled();
    });

    it('clears the interval on unmount', async () => {
        const { unmount, dispose } = await start();
        unmount();
        expect(dispose).toHaveBeenCalled();
        detectPitchCandidates.mockClear();
        await tick(5);
        expect(detectPitchCandidates).not.toHaveBeenCalled();
    });

    it('does not re-render when nothing changed', async () => {
        let renders = 0;
        mockEngine();
        const { result } = renderHook(() => {
            renders++;
            return usePitchDetection(GUITAR, nowFn);
        });
        await act(async () => {
            result.current.toggle();
        });
        await tick(5);
        const before = renders;
        await tick(10); // silence → identical output every tick
        expect(renders).toBe(before);
    });
});
