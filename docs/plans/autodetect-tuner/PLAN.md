# Plan: auto-detecting chromatic tuner (stable in real-world conditions)

**For:** the implementing agent (Sonnet). **Written:** 2026-10-10.
**Goal:** remove manual string selection, detect the played note automatically, and make the display as steady as commercial tuner apps, including in noisy rooms and while other strings are still ringing.

Everything in this plan was prototyped and measured in simulation first. The algorithms in `reference/` are the validated versions. **Port them faithfully; don't redesign them.** If something in the plan conflicts with what you find in the code, stop and ask rather than improvise.

---

## 1. Why the current tuner jitters

Measured with the current code (copied exactly into a simulator) on synthetic guitar plucks:

| Cause | Where | Effect |
|---|---|---|
| A low-confidence "fallback" accepts the best lag even when nothing is clearly periodic | `lib/pitchDetector.ts:16`, `:89-101` | 23–42 % octave-down errors on D3–E4 in a noisy room (half the period also fits in the 70–360 Hz search range) |
| Any dropout sets `cents = null`, and the meter draws `cents ?? 0` | `hooks/usePitchDetection.ts:180-189`, `components/TunerMeter.tsx:92` | The needle snaps to centre ("in tune") on every dropout, then jumps back |
| In-tune is computed from the **raw** reading | `hooks/usePitchDetection.ts:157-158` | Colour/glow/status flicker 3–8× per second while the needle is still |
| Linear moving average, no outlier rejection | `hooks/usePitchDetection.ts:34`, `:151-155` | One octave error moves the needle 420 cents |
| Note name and Hz come from the raw frequency | `components/NoteDisplay.tsx:24-26` | The note name flickers |
| Analysis cadence is "every 3rd animation frame" | `hooks/usePitchDetection.ts:28` | Behaves differently on 60 Hz and 120 Hz displays |
| Parabolic interpolation on YIN's normalised values, not the raw difference | `lib/pitchDetector.ts:103-112` | Small systematic bias (minor) |

Simply deleting the string selector and showing the nearest note with today's pipeline measured **50–74 % correct frames, note name flipping 2–5×/s, needle jitter 15–25 cents**. Don't do that.

---

## 2. Decisions (final, don't relitigate)

- **D1. Chromatic auto-detection.** Show the nearest equal-tempered note (A4 = 440 Hz) with octave, and cents relative to that note. Remove string selection completely.
- **D2. Keep the Guitar/Bass toggle.** It sets the detection range: **guitar 60–500 Hz, bass 30–250 Hz**. A smaller range means fewer octave mistakes, and these ranges still cover drop tunings, 7-string B1 and 5-string bass B0.
- **D3. Passive open-string hint.** When the displayed note+octave equals an open string of the instrument's standard tuning, show e.g. `String 6 · E2` under the note. Nothing is selectable.
- **D4. Detector: McLeod Pitch Method (MPM), autocorrelation via FFT.** It returns **all candidate periods with their clarity**, not a single frequency. Peak-picking factor **k = 0.8**. The textbook 0.9 shows a high E as E2 more than half the time when B3 is still ringing; 0.8 fixes that with no regressions elsewhere.
- **D5. Tracker** (new pure module), with the validated parameters in `reference/pitchTracker.mts`:
  - re-acquire on a new pluck (onset)
  - acquire only after 3 agreeing readings
  - continuity prior while locked
  - median of 5
  - clarity-weighted One-Euro smoother
  - 500 ms hold through dropouts
  - note hysteresis ±60 c
  - in-tune hysteresis: enter at 4 c, exit at 7 c
- **D6. Analysis cadence:** `setInterval` every **25 ms (40 Hz)**, timestamps from `performance.now()`. Remove the frame-count logic. Do not lower the rate: at 20 Hz the smoother lags the peg by 170–200 ms instead of 113 ms.
- **D7. Audio graph unchanged:** AnalyserNode `fftSize = 8192`. Always use `audioContext.sampleRate`; never assume 44.1 or 48 kHz.
- **D8. Display rules:**
  - Never draw `cents ?? 0` while a note is being tracked.
  - While stale (holding through a dropout), dim the needle.
  - After the 500 ms hold, show "no signal" (needle parked at centre, dimmed, as the idle state looks today).
- **D9. Bing:** play it when `isInTune` has stayed true for **≥ 600 ms on the same note**. Keep the 2 s cooldown. Re-arm after the note changes or leaves tune.
- **D10. No new runtime dependencies.** The FFT is ~40 lines; port it from `reference/mpm.mts`.

---

## 3. Target numbers (simulation, reference implementation)

Re-run them at any time from the repo root with `node docs/plans/autodetect-tuner/reference/evaluate.mts` (Node ≥ 23, ~90 s).

| Scenario | Correct (±20 c, right octave) | Right note | Note flips/s | In-tune flips/s | Needle jitter (c per 50 ms) | New-note pickup (median) |
|---|---|---|---|---|---|---|
| Guitar single notes, quiet | 100 % | 100 % | 0.00 | 0.27 | 0.32 | 79 ms |
| Guitar single notes, normal room | 100 % | 100 % | 0.00 | 0.31 | 0.48 | 79 ms |
| Guitar single notes, noisy room | 99 % | 99 % | 0.04 | 0.62 | 1.09 | 79 ms |
| Bass single notes + mains hum | 100 % | 100 % | 0.00 | 0.27 | 0.50 | 111 ms |
| Session E2→E4, earlier strings ring on | 99 % | 100 % | 0.04 | 0.44 | 2.87 | 108 ms |
| Session E4→E2 | 100 % | 100 % | 0.00 | 0.59 | 1.81 | 96 ms |
| Session E2→E4, noisy room | 98 % | 100 % | 0.04 | 0.44 | 2.86 | 108 ms |
| Bass session E1→G2 + hum | 100 % | 100 % | 0.00 | 0.56 | 1.29 | 146 ms |

- **Lag behind a turning peg:** 113 ms; today's code is 124 ms.
- **Ghost readings** (anything shown while only room noise is present): 0 % in all scenarios.
- **Known limitation:** a neighbouring string ringing nearly as loud as the played one, a fourth away, can pull the reading 10–30 c. Every tuner of this kind has this limit. Out of scope.

---

## 4. Target architecture

```
mic → AnalyserNode (8192 samples) ──every 25 ms──▶ usePitchDetection
          buffer ─▶ detectPitchCandidates(buffer, sampleRate, min, max)   lib/pitchDetector.ts
                    rms(buffer, last 1024 samples)  (onset input)           lib/pitchDetector.ts
                 ─▶ PitchTracker.push(timeSec, candidates, shortRms)       lib/pitchTracker.ts
                 ─▶ { frequency, midi, cents, isInTune, isStale }
                 ─▶ React state → TunerMeter / NoteDisplay
```

### Module APIs

```ts
// lib/fft.ts (new)
export function fft(re: Float64Array, im: Float64Array, inverse?: boolean): void;
export function autocorrelation(buf: Float32Array, maxLag: number): Float64Array;

// lib/pitchDetector.ts (rewritten; YIN removed)
export interface PitchCandidate { frequency: number; clarity: number }
export const SILENCE_RMS = 0.002;
export function rms(buf: Float32Array, from?: number, to?: number): number;
/** NSDF key maxima in ascending-lag (= descending-frequency) order. */
export function detectPitchCandidates(buf: Float32Array, sampleRate: number,
    minFrequency: number, maxFrequency: number): PitchCandidate[];
export function pickMpm(cands: PitchCandidate[], k?: number, minClarity?: number): PitchCandidate | null;
/** Convenience wrapper: pickMpm(detectPitchCandidates(...))?.frequency ?? null. */
export function detectPitch(buf: Float32Array, sampleRate: number,
    minFrequency?: number, maxFrequency?: number): number | null;

// lib/pitchTracker.ts (new)
export interface TrackerOptions { /* exactly as reference */ }
export const DEFAULT_TRACKER_OPTIONS: TrackerOptions;
export interface TrackerOutput { frequency: number | null; midi: number | null;
    cents: number | null; isInTune: boolean; isStale: boolean }
export class PitchTracker {
    constructor(options?: Partial<TrackerOptions>);
    push(timeSec: number, candidates: PitchCandidate[], shortRms: number): TrackerOutput;
    reset(): void;
}

// lib/noteUtils.ts (additions; keep existing exports)
export function midiToLabel(midi: number): { name: string; octave: number }; // { name: 'C#', octave: 4 }

// lib/tunings.ts (changes)
// guitar: minFrequency 60, maxFrequency 500; bass: minFrequency 30, maxFrequency 250
export function findOpenString(tuning: InstrumentTuning, midi: number): StringDefinition | null;

// hooks/usePitchDetection.ts (new signature)
export interface PitchState {
    frequency: number | null; midi: number | null; noteName: string | null; octave: number | null;
    cents: number | null; isInTune: boolean; isStale: boolean;
    micStatus: MicStatus; errorMessage: string | null;
}
export function usePitchDetection(instrument: InstrumentTuning):
    PitchState & { toggle(): void; startListening(): Promise<void>; stopListening(): void };
```

---

## 5. Implementation steps

Work on a branch: `git checkout -b feat/autodetect-tuner`. Each phase ends with `npm test` green and one commit.

- The pre-commit hook runs `npm run test` and `npm run test:coverage`, which enforces 90 % coverage on `lib/` + `hooks/`, then stages the badge. **Never use `--no-verify`.**
- Follow `Gemini.md`: tests pass, then commit, keep coverage ≥ 90 %, and update README.md + architecture.md (Phase 7).
- Don't push.

### Phase 1: FFT + MPM detector
1. Create `lib/fft.ts` from `reference/mpm.mts` (`fft`, `autocorrelation`).
2. Rewrite `lib/pitchDetector.ts` from `reference/mpm.mts` (`PitchCandidate`, `SILENCE_RMS`, `rms`, `detectPitchCandidates`, `pickMpm`). Add the `detectPitch` wrapper. Delete all YIN code and constants.
3. Optional: avoid per-frame allocations by reusing scratch arrays in module-level caches keyed by size. Keep the function signatures pure.
4. Tests:
   - **New `__tests__/fft.test.ts`:**
     - FFT round-trip (forward + inverse ≈ input)
     - `autocorrelation` equals a brute-force O(N·L) sum within 1e-9 relative, on random and sine input
   - **Rewrite `__tests__/pitchDetector.test.ts`:**
     - Keep the sine tests for all 10 strings. Switch them to the instrument ranges (60–500 guitar, 30–250 bass) and tighten the tolerance to ±2 cents (±3 Hz is far too loose for a tuner).
     - Keep the silence and sub-threshold-noise tests.
     - Delete the YIN fallback tests.
     - Add: candidates are in descending-frequency order; clarity ∈ [0, 1]; a clean harmonic tone has clarity > 0.9; `pickMpm` returns null when nothing reaches 0.5; `pickMpm` picks the shortest lag within k of the best.
     - Run at both 44100 and 48000 Hz.

### Phase 2: PitchTracker
1. Create `lib/pitchTracker.ts` from `reference/pitchTracker.mts`. Same logic, same defaults, same order of steps.
2. Unit tests in `__tests__/pitchTracker.test.ts`. Drive it with hand-made candidate lists and timestamps 25 ms apart; no audio needed. Cover at least:
   - nothing is shown until 3 agreeing frames (2 frames → EMPTY; 3rd → locked);
   - 3 disagreeing frames (spread > 35 c) do not lock;
   - acquisition evidence older than 0.2 s expires;
   - a single +1200 c outlier frame while locked does not move the output by more than 1 c;
   - continuity prior vs. re-lock (both verified against the reference):
     - locked on A2, then frames with {A2 @ 0.6, A0 @ 0.75}: stays on A2 indefinitely (the far candidate is below the 0.8 re-lock clarity);
     - locked on A2, then frames with {A2 @ 0.7, A0 @ 0.99}: stays on A2 for 2 frames and re-locks to the far note on the 3rd. This is intended: a confident new note played without a clear onset;
   - dropout: output holds for 500 ms; `isStale` is false before 150 ms and true after; output is EMPTY after 500 ms;
   - onset (shortRms jumps ≥ 6 dB): re-acquires a new note within 3 frames, and the old value stays displayed until then;
   - re-lock without onset: 3 confident (≥ 0.8) agreeing frames on another note re-lock; low-clarity ones don't;
   - note hysteresis: a pitch drifting from +45 c to +55 c keeps the same note; beyond +60 c the note changes;
   - in-tune hysteresis: enters at ≤ 4 c, stays at 6 c, leaves at > 7 c, and resets when the note changes;
   - smoothing: a steady input with ±3 c alternating noise gives a frame-to-frame output change < 1 c (reference: 0.47 c); a 20 c/s ramp is followed with < 150 ms lag (reference: 107 ms with ideal candidates);
   - `reset()` clears everything.

### Phase 3: Realistic regression tests
1. Port `reference/synth.mts` to `__tests__/helpers/synth.ts` (export `SR`, `mulberry32`, `synthPluck`, `synthSequence`). Check that `jest.config.ts` `testMatch` (`**/__tests__/**/*.test.{ts,tsx}`) does not treat helpers as tests; it doesn't, because there is no `.test.` in the name.
2. Create `__tests__/pitchPipeline.test.ts`. Port the metric loop from `reference/evaluate.mts`, using the real `lib/` modules, and assert these thresholds (reference values minus a safety margin):

   | Scenario | Assertions |
   |---|---|
   | Guitar single notes, normal room (6 strings × 1 seed) | correct ≥ 97 %, note flips ≤ 0.1/s, ghost = 0 |
   | Guitar single notes, noisy (-20 dB): D3, G3, E4 | correct ≥ 95 % |
   | Session E2→E4, normal room (1 seed) | correct ≥ 95 %, right note ≥ 98 %, median pickup ≤ 200 ms |
   | Session E4→E2, normal room | correct ≥ 97 % |
   | Bass session + hum | correct ≥ 95 % |
   | Peg turn (A2) | lag ≤ 160 ms |

   Signal synthesis dominates the runtime (~2 s for a 3-note session; detection is ~1.4 ms per frame). Keep this file under ~30 s and set `jest.setTimeout(60_000)` in it. Synthesise each signal once per file (`beforeAll`). If it's still too slow, reduce harmonics to 20 in the test helper and re-check the thresholds. Don't loosen the thresholds without saying so in the commit message.

### Phase 4: Note and tuning helpers
1. `lib/noteUtils.ts`: add `midiToLabel`. Keep the existing functions; tests already cover them.
2. `lib/tunings.ts`: change the ranges per D2 and add `findOpenString`. Update `__tests__/tunings.test.ts`. The existing "strings within bounds" and "bass max < guitar max" tests should still pass; add tests for `findOpenString` (E2 → string 6, F2 → null, bass E1 → string 4).

### Phase 5: Hook rewrite (`hooks/usePitchDetection.ts`)
1. New signature `usePitchDetection(instrument)`. Remove `targetString`, the moving average, the frame counter and the raw in-tune logic.
2. Loop: after the engine starts, `setInterval(analyze, 25)`. Each tick:
   - `getFloatTimeDomainData(buffer)`
   - `detectPitchCandidates(buffer, sampleRate, instrument.minFrequency, instrument.maxFrequency)`
   - `shortRms = rms(buffer, buffer.length - 1024)` (the end of the buffer is the newest audio)
   - `tracker.push(now() / 1000, candidates, shortRms)`
   - map to `PitchState` (`midiToLabel` for the name and octave)
   - `setState` only when something changed
3. `now` defaults to `performance.now`; accept an injectable clock (module-level or optional second argument) so tests don't depend on fake-timer support for `performance`.
4. Bing per D9, using the timestamps (not frame counts).
5. Reset the tracker when `instrument` changes, and on stop. Clear the interval on stop and unmount.
6. Rewrite `__tests__/usePitchDetection.test.tsx`:
   - Mock `createAudioEngine` and `bingSound` as today.
   - Mock `lib/pitchDetector` so `detectPitchCandidates` returns controlled candidates and `rms` returns a controlled level. Use the **real** tracker.
   - Cover: idle state; mic errors (keep the three existing cases); lock after 3 ticks; note name/octave/cents mapping; hold then clear on silence; bing after ≥ 600 ms in tune and cooldown respected; instrument change resets; stop clears state and calls `dispose`.

### Phase 6: UI
1. **`components/Tuner.tsx`:**
   - Remove `stringIndex` state and `StringSelector`. The instrument change no longer resets a string.
   - Pass the new hook output down.
   - Replace the footer "Target: …" bubble with a static `A4 = 440 Hz` label in the same style.
2. **Delete `components/StringSelector.tsx`** and its block in `__tests__/components.test.tsx`; keep the InstrumentSelector tests.
3. **`components/NoteDisplay.tsx`:**
   - Props: `noteName`, `octave`, `frequency`, `cents`, `isInTune`, `isActive`, `isStale`, `openString` (`StringDefinition | null`).
   - Big note name with the octave as a subscript (`C♯₄` style; render `#` as `♯`), then Hz with 1 decimal, then signed integer cents, then the FLAT/SHARP/IN TUNE label. Show `String N · E2` when `openString` is set.
   - When active with no signal, show a muted "—" and "Play a string". When idle, keep today's dim placeholder look.
   - Remove the "→ target" reminder and the detected-vs-target red colouring.
   - Colours: in tune `#10B981`; |cents| ≤ 20 amber `#F59E0B`; otherwise red `#EF4444` (same palette as today).
4. **`components/TunerMeter.tsx`:**
   - Add an `isStale` prop. While stale, needle opacity is 0.5. It keeps the last position; the hook keeps passing the held cents.
   - Change the needle transition to `transform 100ms linear` to match the 25 ms update rate.
   - Keep the geometry, the zones (±5 c green) and the colours.
5. Add component tests for NoteDisplay: note label rendering with sharp and octave, open-string hint shown/hidden, the "Play a string" state, and the colour class/style for in-tune.

### Phase 7: Docs and wrap-up
1. Update `README.md`:
   - features: auto-detect, no string picking
   - "How to Use": pick an instrument, play any string
   - "How It Works" diagram: MPM + tracker
   - "What's tested" list
2. Update `architecture.md`: directory structure (new `lib/fft.ts`, `lib/pitchTracker.ts`, `__tests__/helpers/synth.ts`; `StringSelector` removed), the audio pipeline description, the testing strategy (synthetic regression suite). It currently says "autocorrelation" / "MPM peak-picking"; make it accurate.
3. Run `npm run lint`, `npm run build` and `npm run test:coverage`; all must pass, with coverage ≥ 90 %.
4. Leave `docs/plans/autodetect-tuner/` in place (it documents why the parameters are what they are).

### Phase 8: Manual check (for the human; list it in your final summary)
Run `npm run dev` on a phone or laptop, in a quiet room and then with background noise (TV or music):
- [ ] Each open string shows the right note and octave within ~0.1 s of plucking.
- [ ] The needle is steady on a sustained note (no jumps to centre as the note decays).
- [ ] Turning a peg moves the needle smoothly with no visible lag.
- [ ] Pluck the next string while the previous one still rings: the display switches to the new string.
- [ ] Nothing is shown while not playing.
- [ ] The bing plays once when a string is held in tune.

---

## 6. Pitfalls

- **Candidate order matters.** `pickMpm` relies on candidates being in ascending-lag (descending-frequency) order.
- **The FFT must be zero-padded** to a power of two ≥ 2N (16384 for 8192 samples). Otherwise you get *circular* autocorrelation and wrong low-frequency results.
- **NSDF denominator** `m(τ)` starts at `2·r(0)` and is updated incrementally. Copy it exactly from the reference.
- **Parabolic interpolation goes on the NSDF peak** (lag), then convert lag → Hz. Do not interpolate in Hz.
- **Tracker time is in seconds.** Units mix-ups (ms vs s) silently break the smoother and the hold.
- **The tracker's dropout branch must only clear when something is displayed** (`x !== null`). Clearing unconditionally wipes acquisition evidence, and nothing ever locks. The prototype had exactly this bug.
- **`getFloatTimeDomainData` order:** index 0 is oldest, the last index is newest. The onset RMS must use the *end* of the buffer.
- **Re-render rate:** 40 state updates per second is fine. Don't add CSS transitions longer than ~150 ms on the needle, or it will feel laggy again.
- **The existing hook test relies on `requestAnimationFrame` + fake timers.** After switching to `setInterval`, use `jest.advanceTimersByTime(25 * n)`.

## 7. Definition of done
- String selection is gone. The note is auto-detected per the D1–D10 decisions.
- All phases are committed on `feat/autodetect-tuner`, and `npm test`, `npm run lint` and `npm run build` pass.
- Coverage ≥ 90 % on `lib/` and `hooks/`.
- The regression thresholds in Phase 3 hold.
- README.md and architecture.md describe the new behaviour.
- The final summary includes the Phase 8 manual checklist for the human.

## Appendix: reference files
- `reference/mpm.mts`: FFT, autocorrelation, MPM candidates, `pickMpm` (k = 0.8). Matches a brute-force NSDF to 1e-10.
- `reference/pitchTracker.mts`: the validated tracker, with all parameters documented.
- `reference/synth.mts`: synthetic plucks and tuning sessions (overtones, inharmonicity, pitch glide, decay, pink noise, hum, phone-mic high-pass).
- `reference/evaluate.mts`: benchmark harness that prints the table in §3.
