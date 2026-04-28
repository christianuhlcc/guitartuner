'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createAudioEngine, AudioEngine } from '@/lib/audioEngine';
import { detectPitch } from '@/lib/pitchDetector';
import { frequencyToCents } from '@/lib/noteUtils';
import { playBing } from '@/lib/bingSound';
import { StringDefinition, InstrumentTuning } from '@/lib/tunings';

// ─── Constants ────────────────────────────────────────────────────────────────

/** A string is "in tune" when |cents| is below this value. */
const IN_TUNE_THRESHOLD_CENTS = 5;

/** Minimum milliseconds between two consecutive bing sounds. */
const BING_COOLDOWN_MS = 2000;

/**
 * How many consecutive analysis frames must detect "in tune" before we
 * consider the note stable and play the bing (~200 ms at 60 fps / 3).
 */
const IN_TUNE_STABLE_FRAMES = 12;

/**
 * Run pitch detection on every Nth animation frame. Pitch detection is
 * CPU-intensive; 20 Hz is more than enough for a tuner.
 */
const ANALYSIS_FRAME_INTERVAL = 3;

/**
 * Exponential moving average weight for the smoothed cents display
 * (0 = never update, 1 = no smoothing).
 */
const EMA_ALPHA = 0.35;

// ─── Types ────────────────────────────────────────────────────────────────────

export type MicStatus = 'idle' | 'requesting' | 'active' | 'error';

export interface PitchState {
  /** Raw detected frequency in Hz, or null when silent. */
  frequency: number | null;
  /** Smoothed cents deviation from target, or null when silent. */
  cents: number | null;
  /** True when the current pitch is within IN_TUNE_THRESHOLD_CENTS. */
  isInTune: boolean;
  micStatus: MicStatus;
  errorMessage: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the microphone → pitch detection pipeline.
 *
 * Exposes a `toggle()` function to start/stop listening and a `PitchState`
 * describing the current detection result.
 *
 * Automatically resets smoothing state when `targetString` changes so
 * switching strings does not carry over stale readings.
 */
export function usePitchDetection(
  targetString: StringDefinition,
  instrument: InstrumentTuning,
) {
  const [state, setState] = useState<PitchState>({
    frequency: null,
    cents: null,
    isInTune: false,
    micStatus: 'idle',
    errorMessage: null,
  });

  const engineRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const consecutiveInTuneRef = useRef(0);
  const lastBingMsRef = useRef(0);
  const smoothedCentsRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  // Keep latest values accessible inside the RAF closure without re-creating it
  const targetFreqRef = useRef(targetString.frequency);
  const instrumentRef = useRef(instrument);
  useEffect(() => {
    targetFreqRef.current = targetString.frequency;
    instrumentRef.current = instrument;
    // Reset smoothing when the target string changes
    smoothedCentsRef.current = null;
    consecutiveInTuneRef.current = 0;
  }, [targetString.frequency, instrument]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    engineRef.current?.dispose();
    engineRef.current = null;
    smoothedCentsRef.current = null;
    consecutiveInTuneRef.current = 0;
    setState({
      frequency: null,
      cents: null,
      isInTune: false,
      micStatus: 'idle',
      errorMessage: null,
    });
  }, []);

  // ── Start ─────────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (engineRef.current) return; // already running

    setState((prev) => ({
      ...prev,
      micStatus: 'requesting',
      errorMessage: null,
    }));

    try {
      const engine = await createAudioEngine({ fftSize: 8192 });
      engineRef.current = engine;
      isActiveRef.current = true;

      setState((prev) => ({ ...prev, micStatus: 'active' }));

      const buffer = new Float32Array(engine.analyser.fftSize);

      const analyze = () => {
        if (!isActiveRef.current || !engineRef.current) return;

        frameCountRef.current++;

        if (frameCountRef.current % ANALYSIS_FRAME_INTERVAL === 0) {
          engine.analyser.getFloatTimeDomainData(buffer);

          const rawFreq = detectPitch(
            buffer,
            engine.audioContext.sampleRate,
            instrumentRef.current.minFrequency,
            instrumentRef.current.maxFrequency,
          );

          if (rawFreq !== null) {
            const rawCents = frequencyToCents(rawFreq, targetFreqRef.current);

            // Exponential moving average → smooth needle movement
            smoothedCentsRef.current =
              smoothedCentsRef.current === null
                ? rawCents
                : (1 - EMA_ALPHA) * smoothedCentsRef.current +
                EMA_ALPHA * rawCents;

            const inTune =
              Math.abs(rawCents) < IN_TUNE_THRESHOLD_CENTS;

            if (inTune) {
              consecutiveInTuneRef.current++;
              const now = Date.now();
              if (
                consecutiveInTuneRef.current >= IN_TUNE_STABLE_FRAMES &&
                now - lastBingMsRef.current > BING_COOLDOWN_MS
              ) {
                lastBingMsRef.current = now;
                playBing(engine.audioContext);
              }
            } else {
              consecutiveInTuneRef.current = 0;
            }

            setState((prev) => ({
              ...prev,
              frequency: rawFreq,
              cents: smoothedCentsRef.current,
              isInTune: inTune,
            }));
          } else {
            // Silence
            smoothedCentsRef.current = null;
            consecutiveInTuneRef.current = 0;
            setState((prev) => ({
              ...prev,
              frequency: null,
              cents: null,
              isInTune: false,
            }));
          }
        }

        rafRef.current = requestAnimationFrame(analyze);
      };

      rafRef.current = requestAnimationFrame(analyze);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : err instanceof Error
            ? err.message
            : 'Could not access microphone.';
      setState((prev) => ({
        ...prev,
        micStatus: 'error',
        errorMessage: message,
      }));
    }
  }, []);

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (isActiveRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => stopListening(), [stopListening]);

  return { ...state, toggle, startListening, stopListening };
}
