# Chromatic Tuner

![Coverage](./badges/coverage.svg)

Visit [https://guitartuner.vercel.app/](https://guitartuner.vercel.app/)

Built with Next.js, the Web Audio API, **Radix UI**, and **Lucide Icons** — it works beautifully on any modern browser including mobile.

---

- 🎵 **Auto-detecting chromatic tuner** — no string picking: play any string and the nearest note (with octave) and how many cents off you are appear automatically
- 🎸 **Guitar & bass modes** — the toggle sets the detection range (guitar 60–500 Hz, bass 30–250 Hz), which also covers drop tunings, 7-string guitars and 5-string basses; open strings of standard tuning get a passive `String 6 · E2` hint
- 🧘 **Steady display** — a pitch tracker rejects octave errors, holds through short dropouts, and smooths the needle like commercial tuner apps, even in noisy rooms or while other strings still ring
- 📊 **Visual needle meter** — a smooth SVG gauge with dynamic entrance animations and "in-tune" glow effects
- 🔔 **In-tune sound cue** — plays a soft "bing" once the note has stayed in tune for 600 ms
- 📱 **Mobile-first design** — features large touch targets (48px+) and glassmorphism styling for a premium feel
- ✨ **Rich Aesthetics** — built-in support for dark mode, backdrop blurs, and smooth CSS transitions

---

## How to Use It

1. **Open the app** in your browser
2. **Select your instrument** — Guitar or Bass
3. **Allow microphone access** when the browser asks
4. **Play any string** — the detected note appears automatically. Tune up or down until the meter centres and turns green ✅

> **Tip:** Play in a quiet room and pluck single strings cleanly for the most accurate readings.

---

## Running Locally

**Prerequisites:** Node.js 18+ and npm

```bash
# Clone the repo
git clone <your-repo-url>
cd guitartuner

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

> ⚠️ Microphone access requires a **secure context** (HTTPS or localhost). The dev server satisfies this automatically.

---

## Other Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm test` | Run the test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## Testing

The project uses **Jest** and **React Testing Library** with a minimum **90% coverage threshold** enforced across all `lib/` and `hooks/` modules.

```bash
# Run all tests
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Full coverage report (terminal + HTML in coverage/)
npm run test:coverage
```

### What's tested

- **`noteUtils`** — MIDI ↔ frequency conversions, note names, octaves, cents calculation, in-tune detection
- **`fft`** — FFT round-trip and autocorrelation vs. a brute-force sum
- **`pitchDetector`** — MPM candidates: silence/noise rejection, all 10 standard strings within ±2 cents at 44.1 and 48 kHz, candidate ordering, clarity, `pickMpm` rule
- **`pitchTracker`** — acquisition, outlier rejection, continuity vs. re-lock, dropout hold, onset re-acquisition, note and in-tune hysteresis, smoothing, reset
- **`pitchPipeline`** — regression suite on synthetic plucked strings (harmonics, inharmonicity, room noise, hum, ringing strings, turning peg) through the real detector + tracker (~40 s)
- **`usePitchDetection`** — React hook lifecycle with fake timers and an injected clock, lock/hold/clear, bing timing, instrument change, microphone error handling
- **`UI Components`** — instrument selector, `NoteDisplay` (note label, open-string hint, states, colours) and `TunerMeter` (stale needle)
- **`tunings`** — data integrity, detection ranges, `findOpenString`
- **`bingSound`** — oscillator lifecycle, gain envelopes, and harmonic frequencies via a full `AudioContext` mock
- **`audioEngine`** — mic constraints, AudioContext wiring, `fftSize`/`smoothingTimeConstant` options, suspended context resume, and `dispose()` cleanup via browser API mocks

---

## Deploying to Vercel

The app is Vercel-ready out of the box. Just connect your GitHub repo to a Vercel project and it will deploy automatically on every push to `main`.

For manual deploys:

```bash
npx vercel
```

---

## How It Works (Technical Overview)

```
Microphone → AudioContext → AnalyserNode (8192 samples)
                                  ↓  every 25 ms (40 Hz)
                  detectPitchCandidates  (MPM: FFT autocorrelation → NSDF peaks)
                                  ↓  candidates + clarity, onset energy
                              PitchTracker
        (acquire → continuity prior → median → One-Euro smoother → hold → hysteresis)
                                  ↓
                  note + octave, cents, in-tune, stale
                                  ↓
                         Needle + colour feedback
```

- **Pitch detection** uses the McLeod Pitch Method: an FFT-based autocorrelation, normalised (NSDF), returning all candidate periods with their *clarity*. Peak picking uses k = 0.8
- **Tracking** (`lib/pitchTracker.ts`) turns the noisy per-frame candidates into a steady reading: re-acquires on a new pluck, needs 3 agreeing frames, prefers candidates near the tracked pitch, takes a median of 5, smooths with a clarity-weighted One-Euro filter, and holds the last value for 500 ms through dropouts
- **Cents** are relative to the nearest equal-tempered note (A4 = 440 Hz); the note changes only after drifting 60 cents past it. In-tune is entered at ±4 cents and left at ±7
- **Audio feedback** ("bing") fires after the note has stayed in tune for 600 ms, at most once per 2 s

---

## Project Structure

```
guitartuner/
├── __tests__/
│   ├── audioEngine.test.ts     # Browser API mocks, setup & dispose
│   ├── bingSound.test.ts       # AudioContext mock, oscillator lifecycle
│   ├── components.test.tsx     # React Component integration tests
│   ├── noteUtils.test.ts       # Frequency/MIDI/cents math
│   ├── fft.test.ts             # FFT / autocorrelation vs. brute force
│   ├── helpers/synth.ts        # Synthetic plucked-string signals
│   ├── pitchDetector.test.ts   # Sine fixtures, candidates, pickMpm
│   ├── pitchPipeline.test.ts   # Realistic synthetic regression suite
│   ├── pitchTracker.test.ts    # Tracker unit tests (hand-made candidates)
│   ├── tunings.test.ts         # Data integrity checks
│   └── usePitchDetection.test.tsx # Hook state transitions and mic mock
├── app/
│   ├── layout.tsx              # Root layout & fonts
│   └── page.tsx                # Main page
├── components/
│   ├── Tuner.tsx               # Top-level tuner component
│   ├── TunerMeter.tsx          # SVG needle gauge
│   ├── NoteDisplay.tsx         # Detected note, octave, cents, open-string hint
│   └── InstrumentSelector.tsx  # Guitar / Bass toggle
├── hooks/
│   └── usePitchDetection.ts    # Mic + audio processing hook
└── lib/
    ├── audioEngine.ts          # AudioContext & microphone setup
    ├── fft.ts                  # Radix-2 FFT + autocorrelation
    ├── pitchDetector.ts        # MPM candidate extraction
    ├── pitchTracker.ts         # Stable chromatic tracker
    ├── noteUtils.ts            # Frequency → note / cents math
    ├── tunings.ts              # Standard tunings, detection ranges, open-string lookup
    └── bingSound.ts            # In-tune audio feedback
```

---

## Browser Support

Works in all modern browsers that support the Web Audio API and `getUserMedia`:

- ✅ Chrome / Edge (desktop & Android)
- ✅ Safari (desktop & iOS 14.5+)
- ✅ Firefox

---

## License

MIT — free to use, modify, and distribute.
