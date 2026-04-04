/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { usePitchDetection } from '../hooks/usePitchDetection';
import { STANDARD_TUNINGS } from '../lib/tunings';

// Mock the dependencies
jest.mock('../lib/audioEngine', () => ({
    createAudioEngine: jest.fn(),
}));

jest.mock('../lib/pitchDetector', () => ({
    detectPitch: jest.fn(),
}));

jest.mock('../lib/bingSound', () => ({
    playBing: jest.fn(),
}));

const { createAudioEngine } = require('../lib/audioEngine');
const { detectPitch } = require('../lib/pitchDetector');
const { playBing } = require('../lib/bingSound');

describe('usePitchDetection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => 
            usePitchDetection(STANDARD_TUNINGS.guitar.strings[0], STANDARD_TUNINGS.guitar)
        );

        expect(result.current.micStatus).toBe('idle');
        expect(result.current.frequency).toBeNull();
        expect(result.current.cents).toBeNull();
        expect(result.current.isInTune).toBe(false);
        expect(result.current.errorMessage).toBeNull();
    });

    it('handles successful mic request', async () => {
        const mockAudioContext = {} as AudioContext;
        const mockAnalyser = {
            fftSize: 4096,
            getFloatTimeDomainData: jest.fn(),
        };

        createAudioEngine.mockResolvedValueOnce({
            audioContext: mockAudioContext,
            analyser: mockAnalyser,
            dispose: jest.fn(),
        });

        const { result } = renderHook(() => 
            usePitchDetection(STANDARD_TUNINGS.guitar.strings[0], STANDARD_TUNINGS.guitar)
        );

        // Initiate toggle
        await act(async () => {
            result.current.toggle();
        });

        // Try to start listening again when already active (should return immediately)
        await act(async () => {
            result.current.startListening();
        });

        expect(createAudioEngine).toHaveBeenCalledTimes(1);
        expect(result.current.micStatus).toBe('active');
    });

    it('handles mic request rejection (Error)', async () => {
        createAudioEngine.mockRejectedValueOnce(new Error('Permission denied'));

        const { result } = renderHook(() => 
            usePitchDetection(STANDARD_TUNINGS.guitar.strings[0], STANDARD_TUNINGS.guitar)
        );

        await act(async () => {
            result.current.toggle();
        });

        expect(result.current.micStatus).toBe('error');
        expect(result.current.errorMessage).toBe('Permission denied');
    });

    it('handles mic request rejection (DOMException NotAllowedError)', async () => {
        const domException = new DOMException('Not allowed', 'NotAllowedError');
        createAudioEngine.mockRejectedValueOnce(domException);

        const { result } = renderHook(() => 
            usePitchDetection(STANDARD_TUNINGS.guitar.strings[0], STANDARD_TUNINGS.guitar)
        );

        await act(async () => {
            result.current.startListening();
        });

        expect(result.current.micStatus).toBe('error');
        expect(result.current.errorMessage).toBe('Microphone permission denied.');
    });

    it('handles mic request rejection (Unknown error)', async () => {
        createAudioEngine.mockRejectedValueOnce('string error');

        const { result } = renderHook(() => 
            usePitchDetection(STANDARD_TUNINGS.guitar.strings[0], STANDARD_TUNINGS.guitar)
        );

        await act(async () => {
            result.current.startListening();
        });

        expect(result.current.micStatus).toBe('error');
        expect(result.current.errorMessage).toBe('Could not access microphone.');
    });

    it('processes pitch detection over frames', async () => {
        const mockAudioContext = { sampleRate: 48000 } as AudioContext;
        const mockAnalyser = {
            fftSize: 4096,
            getFloatTimeDomainData: jest.fn(),
        };

        const mockDispose = jest.fn();

        createAudioEngine.mockResolvedValueOnce({
            audioContext: mockAudioContext,
            analyser: mockAnalyser,
            dispose: mockDispose,
        });

        // 1) First simulate being IN TUNE
        const targetFreq = STANDARD_TUNINGS.guitar.strings[0].frequency; // 82.41 Hz
        detectPitch.mockReturnValue(targetFreq);

        const { result } = renderHook(() => 
            usePitchDetection(STANDARD_TUNINGS.guitar.strings[0], STANDARD_TUNINGS.guitar)
        );

        await act(async () => {
            result.current.toggle(); // starts listening
        });

        expect(result.current.micStatus).toBe('active');

        // Fast forward 3 frames (ANALYSIS_FRAME_INTERVAL = 3)
        await act(async () => {
            jest.advanceTimersByTime(16 * 4);
        });

        expect(detectPitch).toHaveBeenCalled();
        expect(result.current.frequency).toBe(targetFreq);
        expect(result.current.isInTune).toBe(true);

        // Advance to trigger bing cooldown (IN_TUNE_STABLE_FRAMES = 12)
        await act(async () => {
            jest.advanceTimersByTime(16 * 40);
        });

        expect(playBing).toHaveBeenCalledWith(mockAudioContext);

        // 2) Simulate OUT OF TUNE (e.g. 50 cents sharp -> frequency = targetFreq * 2^(50/1200))
        const sharpFreq = targetFreq * Math.pow(2, 50 / 1200);
        detectPitch.mockReturnValue(sharpFreq);

        await act(async () => {
            jest.advanceTimersByTime(16 * 4);
        });

        expect(result.current.isInTune).toBe(false);

        // 3) Simulate SILENCE (returns null)
        detectPitch.mockReturnValue(null);

        await act(async () => {
            jest.advanceTimersByTime(16 * 4);
        });

        expect(result.current.frequency).toBeNull();
        expect(result.current.cents).toBeNull();
        expect(result.current.isInTune).toBe(false);

        // 4) Verify `toggle` to STOP functionality
        await act(async () => {
            result.current.toggle();
        });

        expect(result.current.micStatus).toBe('idle');
        expect(mockDispose).toHaveBeenCalled();
    });
});
