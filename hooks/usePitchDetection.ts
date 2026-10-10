'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createAudioEngine, AudioEngine } from '@/lib/audioEngine';
import { detectPitchCandidates, rms } from '@/lib/pitchDetector';
import { PitchTracker } from '@/lib/pitchTracker';
import { midiToLabel } from '@/lib/noteUtils';
import { playBing } from '@/lib/bingSound';
import { InstrumentTuning } from '@/lib/tunings';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Analysis cadence: 40 Hz, independent of the display refresh rate. */
const ANALYSIS_INTERVAL_MS = 25;

/** Samples at the end of the buffer (newest audio) used for onset detection. */
const ONSET_WINDOW_SAMPLES = 1024;

/** The note must stay in tune this long before the bing plays. */
const IN_TUNE_HOLD_MS = 600;

/** Minimum milliseconds between two consecutive bing sounds. */
const BING_COOLDOWN_MS = 2000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type MicStatus = 'idle' | 'requesting' | 'active' | 'error';

export interface PitchState {
  /** Smoothed frequency in Hz, or null when nothing is tracked. */
  frequency: number | null;
  /** MIDI note number of the displayed note. */
  midi: number | null;
  /** Note name (e.g. "C#"). */
  noteName: string | null;
  octave: number | null;
  /** Deviation from the displayed note in cents. */
  cents: number | null;
  isInTune: boolean;
  /** True while holding the last value through a short dropout. */
  isStale: boolean;
  micStatus: MicStatus;
  errorMessage: string | null;
}

const INITIAL_STATE: PitchState = {
  frequency: null,
  midi: null,
  noteName: null,
  octave: null,
  cents: null,
  isInTune: false,
  isStale: false,
  micStatus: 'idle',
  errorMessage: null,
};

const defaultNow = () => performance.now();

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the microphone → pitch detection → tracker pipeline.
 *
 * The played note is detected automatically (chromatic); `instrument` only
 * selects the frequency search range. `now` is an injectable millisecond clock
 * (defaults to `performance.now`).
 */
export function usePitchDetection(
  instrument: InstrumentTuning,
  now: () => number = defaultNow,
) {
  const [state, setState] = useState<PitchState>(INITIAL_STATE);

  const engineRef = useRef<AudioEngine | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackerRef = useRef<PitchTracker>(new PitchTracker());
  const isActiveRef = useRef(false);

  // In-tune streak bookkeeping for the bing
  const inTuneSinceRef = useRef<number | null>(null);
  const inTuneMidiRef = useRef<number | null>(null);
  const bungRef = useRef(false);
  const lastBingMsRef = useRef(-Infinity);

  const instrumentRef = useRef(instrument);
  const nowRef = useRef(now);
  nowRef.current = now;

  const resetStreak = useCallback(() => {
    inTuneSinceRef.current = null;
    inTuneMidiRef.current = null;
    bungRef.current = false;
  }, []);

  // Reset tracking when the instrument (search range) changes
  useEffect(() => {
    instrumentRef.current = instrument;
    trackerRef.current.reset();
    resetStreak();
    setState((prev) => ({
      ...prev,
      frequency: null,
      midi: null,
      noteName: null,
      octave: null,
      cents: null,
      isInTune: false,
      isStale: false,
    }));
  }, [instrument, resetStreak]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    engineRef.current?.dispose();
    engineRef.current = null;
    trackerRef.current.reset();
    resetStreak();
    setState(INITIAL_STATE);
  }, [resetStreak]);

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
      trackerRef.current.reset();
      resetStreak();

      setState((prev) => ({ ...prev, micStatus: 'active' }));

      const buffer = new Float32Array(engine.analyser.fftSize);

      const analyze = () => {
        if (!isActiveRef.current) return;

        engine.analyser.getFloatTimeDomainData(buffer);
        const { minFrequency, maxFrequency } = instrumentRef.current;
        const candidates = detectPitchCandidates(
          buffer,
          engine.audioContext.sampleRate,
          minFrequency,
          maxFrequency,
        );
        // The end of the buffer is the newest audio
        const shortRms = rms(buffer, buffer.length - ONSET_WINDOW_SAMPLES);

        const nowMs = nowRef.current();
        const out = trackerRef.current.push(nowMs / 1000, candidates, shortRms);

        // ── Bing: in tune ≥ 600 ms on the same note ─────────────────────
        if (out.isInTune && out.midi !== null) {
          if (inTuneMidiRef.current !== out.midi) {
            inTuneMidiRef.current = out.midi;
            inTuneSinceRef.current = nowMs;
            bungRef.current = false;
          } else if (
            !bungRef.current &&
            inTuneSinceRef.current !== null &&
            nowMs - inTuneSinceRef.current >= IN_TUNE_HOLD_MS &&
            nowMs - lastBingMsRef.current > BING_COOLDOWN_MS
          ) {
            bungRef.current = true;
            lastBingMsRef.current = nowMs;
            playBing(engine.audioContext);
          }
        } else {
          resetStreak();
        }

        const label = out.midi !== null ? midiToLabel(out.midi) : null;
        setState((prev) => {
          if (
            prev.frequency === out.frequency &&
            prev.midi === out.midi &&
            prev.cents === out.cents &&
            prev.isInTune === out.isInTune &&
            prev.isStale === out.isStale
          ) {
            return prev;
          }
          return {
            ...prev,
            frequency: out.frequency,
            midi: out.midi,
            noteName: label?.name ?? null,
            octave: label?.octave ?? null,
            cents: out.cents,
            isInTune: out.isInTune,
            isStale: out.isStale,
          };
        });
      };

      intervalRef.current = setInterval(analyze, ANALYSIS_INTERVAL_MS);
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
  }, [resetStreak]);

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
