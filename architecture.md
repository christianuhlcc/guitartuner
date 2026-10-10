# Chromatic Tuner Architecture

## Overview
A mobile-first web application for tuning guitars and basses, built with Next.js (App Router), React, and TailwindCSS. The app uses the Web Audio API to capture microphone input and processes the audio buffer with the McLeod Pitch Method (FFT-based autocorrelation); a pitch tracker turns the per-frame candidates into a steady, auto-detected chromatic reading (no manual string selection).

## Technology Stack
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS + **Radix UI Primitives** + **Lucide React Icons**
- **Audio Processing**: Web Audio API (`getUserMedia`, `AnalyserNode`)
- **Testing**: Jest + ts-node, with 90% coverage threshold enforced on `lib/`
- **Deployment**: Vercel ready

## Directory Structure
- `__tests__/`
  - `noteUtils.test.ts`: Pure math functions — full coverage via straightforward value assertions.
  - `fft.test.ts`: FFT round-trip and autocorrelation against a brute-force sum.
  - `pitchDetector.test.ts`: MPM candidates — sine buffers for all 10 guitar/bass strings (±2 cents, 44.1 and 48 kHz), candidate order and clarity, `pickMpm`, silence rejection.
  - `pitchTracker.test.ts`: Tracker behaviour driven by hand-made candidate lists and timestamps.
  - `pitchPipeline.test.ts`: Regression suite — synthetic plucked strings (`helpers/synth.ts`) through the real detector + tracker with thresholds on accuracy, note flips, pickup time and peg lag.
  - `tunings.test.ts`: Data integrity checks — string count, ordering, note names, octaves, frequency bounds, detection ranges, `findOpenString`.
  - `bingSound.test.ts`: Oscillator lifecycle and gain envelope — validated via a hand-rolled `AudioContext` mock.
  - `audioEngine.test.ts`: Full setup and dispose lifecycle — mocks `navigator.mediaDevices` and `AudioContext` to test without real browser APIs.
  - `usePitchDetection.test.tsx`: Mic state transitions, lock/hold/clear, bing timing and instrument reset, using fake timers, an injected clock, a mocked detector and the real tracker.
  - `components.test.tsx`: React Testing Library tests for the instrument selector, `NoteDisplay` and `TunerMeter`.
  - `helpers/synth.ts`: Synthetic plucked-string generator (harmonics, inharmonicity, pitch glide, room noise, hum, phone-mic high-pass).
- `app/`
  - `layout.tsx`: Root layout, injecting global fonts and managing root metadata.
  - `page.tsx`: Main page rendering the Tuner application.
  - `globals.css`: Global tailwind styles.
- `components/`
  - `Tuner.tsx`: The main orchestration component. Manages the instrument state, integrates the pitch detection hook and looks up the passive open-string hint.
  - `TunerMeter.tsx`: The visualization gauge using SVG path math to display cents deviation interactively.
  - `NoteDisplay.tsx`: High-contrast display of the detected note with octave subscript, Hz, signed cents, status label and open-string hint.
  - `InstrumentSelector.tsx`: Toggle for switching between guitar and bass mode.
- `hooks/`
  - `usePitchDetection.ts`: The core React hook that manages microphone permissions, starts the `AudioEngine`, and every 25 ms (`setInterval`, timestamps from an injectable `performance.now`) reads `floatTimeDomainData`, extracts candidates, feeds the `PitchTracker` and exposes note, octave, cents, in-tune and stale state. It also plays the bing after 600 ms in tune and resets the tracker on instrument change.
- `lib/`
  - `audioEngine.ts`: Sets up `AudioContext`, `AnalyserNode`, and microphone streams.
  - `fft.ts`: Radix-2 FFT and zero-padded (non-circular) autocorrelation.
  - `pitchDetector.ts`: McLeod Pitch Method — `detectPitchCandidates` returns every NSDF key maximum (ascending lag) with parabolic-interpolated frequency and clarity; `pickMpm` applies the k = 0.8 rule; `detectPitch` is a convenience wrapper; `rms` feeds onset detection.
  - `pitchTracker.ts`: Pure `PitchTracker` — onset re-acquisition, 3-frame acquisition, continuity prior, median of 5, clarity-weighted One-Euro smoothing, 500 ms hold, note (±60 c) and in-tune (4 c in / 7 c out) hysteresis.
  - `bingSound.ts`: Generates a synthetic audio feedback "bing" when a note is stable and "in-tune".
  - `noteUtils.ts`: Math utilities for mapping frequency to MIDI numbers, notes, and calculating cents deviation.
  - `tunings.ts`: Standard tunings (EADGBE, EADG), detection ranges (guitar 60–500 Hz, bass 30–250 Hz) and `findOpenString`.

## Core Workflows
### Audio Pipeline
1. `usePitchDetection` toggle initiates `createAudioEngine`.
2. Browser asks for microphone permission.
3. An `AnalyserNode` connects to the `MediaStreamSource`.
4. A 25 ms `setInterval` (40 Hz) polls `getFloatTimeDomainData` (8192 samples, always at `audioContext.sampleRate`).
5. `detectPitchCandidates` returns all NSDF candidates (frequency + clarity) within the instrument range; `rms` of the newest 1024 samples feeds onset detection.
6. `PitchTracker.push` returns the smoothed frequency, nearest MIDI note, cents, in-tune and stale flags.
7. The hook maps these to React state; the UI never draws a centred needle for a missing reading — it dims while stale and parks only after the 500 ms hold.

### Styling & UX
- Modern, dynamic UI with dark mode, high contrast indicators (`#10B981` for in-tune, `#F43F5E` for sharp, `#3B82F6` for flat).
- **Colour semantics**: in tune `#10B981`, within 20 cents amber `#F59E0B`, otherwise red `#EF4444`.
- **Navy Blue Selection Language**: Active button states use a professional **Dark Blue/Navy** (`#1E3A8A`) to align with the visual language of the tuning gauge.
- **Radix UI**: Uses `@radix-ui/react-toggle-group` for the accessible instrument selector.
- **Responsive Layout**: the instrument selector is full-width (`w-full`) to maximize touch accuracy on mobile.
- **Glassmorphism**: UI components use `backdrop-blur` and semi-transparent `surface` backgrounds (`#111520/40`) for a premium "app-like" feel.
- **Micro-animations**: Dynamic entrance animations (`fade-in`, `slide-in`, `zoom-in`) and active-state scaling improve perceived performance and engagement.
- **Typography**: Uses `Bebas Neue` for displays, `JetBrains Mono` for data, and `Barlow Condensed` for UI labels.
- **Feedback Loops**: Needle meter animations, color-shifting glows (`glow-blue` for selection, `glow-accent` for in-tune), and auditory rewards (`bingSound`) provide multi-modal user feedback.

## Testing Strategy

### Tooling
- **Jest** with `ts-node` for TypeScript config support
- **React Testing Library** for integration tests over UI components and React Hooks
- **`jest-environment-jsdom`** for DOM-dependent tests; `node` environment for pure logic
- **Coverage** collected from `lib/**/*.ts` and `hooks/**/*.ts`, with 90% minimum thresholds on statements, branches, functions, and lines enforced via `coverageThreshold`
- HTML + LCOV reports generated in `coverage/` on every `npm run test:coverage` run

### Philosophy
- `lib/` modules are pure functions or thin wrappers — tested in isolation with no framework overhead
- Browser APIs (`AudioContext`, `navigator.mediaDevices`) are mocked at the `global` level per test file, not monkey-patched globally
- Synthetic sine buffers give deterministic unit tests for the detector (±2 cents); the tracker is tested with hand-made candidate lists, no audio
- A synthetic regression suite (`pitchPipeline.test.ts`) runs realistic plucked-string signals — noise, hum, ringing strings, turning pegs — through the real detector and tracker with accuracy/flip-rate/lag thresholds
- No snapshot tests — all assertions are value-based for resilience to refactoring
