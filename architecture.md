# Chromatic Tuner Architecture

## Overview
A mobile-first web application for tuning guitars and basses, built with Next.js (App Router), React, and TailwindCSS. The app uses the Web Audio API to capture microphone input and processes the audio buffer to detect the fundamental pitch using an autocorrelation algorithm.

## Technology Stack
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS with custom font tokens (`ui`, `display`, `mono`)
- **Audio Processing**: Web Audio API (`getUserMedia`, `AnalyserNode`)
- **Deployment**: Vercel ready

## Directory Structure
- `app/`
  - `layout.tsx`: Root layout, injecting global fonts and managing root metadata.
  - `page.tsx`: Main page rendering the Tuner application (to be created).
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
  - `pitchDetector.ts`: Provides `detectPitch` – a vanilla JS autocorrelation algorithm for efficient frequency detection on short buffers.
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
- Modern, dynamic UI with dark mode, high contrast indicators (`#10B981` for in-tune, `#EF4444` for red/sharp/flat).
- Uses `Bebas Neue` for large displays, `JetBrains Mono` for precise numbers, and `Barlow Condensed` for UI.
- Feedback loops: needle animations, color shifts, and an auditory reward (`bingSound`) when tuning successfully matches target frequency and stabilizes.
