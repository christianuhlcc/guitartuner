# Chromatic Tuner Architecture

## Overview
A mobile-first web application for tuning guitars and basses, built with Next.js (App Router), React, and TailwindCSS. The app uses the Web Audio API to capture microphone input and processes the audio buffer to detect the fundamental pitch using an autocorrelation algorithm.

## Technology Stack
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS + **Radix UI Primitives** + **Lucide React Icons**
- **Audio Processing**: Web Audio API (`getUserMedia`, `AnalyserNode`)
- **Testing**: Jest + ts-node, with 90% coverage threshold enforced on `lib/`
- **Deployment**: Vercel ready

## Directory Structure
- `__tests__/`
  - `noteUtils.test.ts`: Pure math functions — full coverage via straightforward value assertions.
  - `pitchDetector.test.ts`: Autocorrelation algorithm — tested with synthetic sine wave buffers for all 10 guitar/bass strings, plus silence rejection and edge cases.
  - `tunings.test.ts`: Data integrity checks — string count, ordering, note names, octaves, and frequency bounds.
  - `bingSound.test.ts`: Oscillator lifecycle and gain envelope — validated via a hand-rolled `AudioContext` mock.
  - `audioEngine.test.ts`: Full setup and dispose lifecycle — mocks `navigator.mediaDevices` and `AudioContext` to test without real browser APIs.
  - `usePitchDetection.test.tsx`: Validates mic state transitions and frame-by-frame pitch smoothing using fake timers, including silence and octave traps.
  - `components.test.tsx`: Integration tests via React Testing Library for Radix UI selectors, verifying active state visual data properties.
- `app/`
  - `layout.tsx`: Root layout, injecting global fonts and managing root metadata.
  - `page.tsx`: Main page rendering the Tuner application.
  - `globals.css`: Global tailwind styles.
- `components/`
  - `Tuner.tsx`: The main orchestration component. Manages instrument state, selected string, and integrates pitch detection hook.
  - `TunerMeter.tsx`: The visualization gauge using SVG path math to display cents deviation interactively.
  - `NoteDisplay.tsx`: High-contrast display for current note and exact frequency numbers.
  - `InstrumentSelector.tsx`: Toggle for switching between guitar and bass mode.
  - `StringSelector.tsx`: UI for selecting which string on the given instrument to tune.
- `hooks/`
  - `usePitchDetection.ts`: The core React hook that manages microphone permissions, starts the `AudioEngine`, reads `floatTimeDomainData` frames, runs it through the pitch detector, and maps it to target cents based on currently selected note.
- `lib/`
  - `audioEngine.ts`: Sets up `AudioContext`, `AnalyserNode`, and microphone streams.
  - `pitchDetector.ts`: Provides `detectPitch` – an autocorrelation algorithm combined with McLeod Pitch Method (MPM) peak-picking and parabolic interpolation to avoid subharmonic octave errors on transient high-frequency signals.
  - `bingSound.ts`: Generates a synthetic audio feedback "bing" when a note is stable and "in-tune".
  - `noteUtils.ts`: Math utilities for mapping frequency to MIDI numbers, notes, and calculating cents deviation.
  - `tunings.ts`: Data definitions of standard tunings (e.g., EADGBE and EADG) and frequency targets.

## Core Workflows
### Audio Pipeline
1. `usePitchDetection` toggle initiates `createAudioEngine`.
2. Browser asks for microphone permission.
3. An `AnalyserNode` connects to the `MediaStreamSource`.
4. A `requestAnimationFrame` loop polls `getFloatTimeDomainData`.
5. The raw audio buffer is passed to `detectPitch`.
6. Resulting frequency is processed in `frequencyToCents` to calculate the tuning offset in cents against the selected target string target.

### Styling & UX
- Modern, dynamic UI with dark mode, high contrast indicators (`#10B981` for in-tune, `#F43F5E` for sharp, `#3B82F6` for flat).
- **Navy Blue Selection Language**: Active button states use a professional **Dark Blue/Navy** (`#1E3A8A`) to align with the visual language of the tuning gauge.
- **Radix UI**: Uses `@radix-ui/react-toggle-group` for robust, accessible instrument and string selection.
- **Responsive Layout**:
    - **Guitar**: A clean **3-column grid** (3x2) for symmetrical string selection.
    - **Bass**: A clean **2-column grid** (2x2) for large, easy-to-tap targets.
    - Selectors are full-width (`w-full`) to maximize touch accuracy on mobile.
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
- Synthetic sine wave buffers replace real microphone input for deterministic pitch detection tests
- Frequency windows are kept tight (per-string) to prevent the autocorrelation algorithm from latching onto sub-octave harmonics
- No snapshot tests — all assertions are value-based for resilience to refactoring
