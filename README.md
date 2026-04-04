Built with Next.js, the Web Audio API, **Radix UI**, and **Lucide Icons** — it works beautifully on any modern browser including mobile.

---

- 🎵 **Real-time pitch detection** — listens to your instrument through the microphone and instantly shows you how close you are to pitch
- 🎸 **Guitar & bass modes** — switch between standard guitar (EADGBE) and bass (EADG) tunings using polished Radix UI ToggleGroup selectors
- 📊 **Visual needle meter** — a smooth SVG gauge with dynamic entrance animations and "in-tune" glow effects
- 🔔 **In-tune sound cue** — plays a soft "bing" when a string holds stable at the target pitch
- 📱 **Mobile-first design** — features large touch targets (48px+) and glassmorphism styling for a premium feel
- ✨ **Rich Aesthetics** — built-in support for dark mode, backdrop blurs, and smooth CSS transitions

---

## How to Use It

1. **Open the app** in your browser
2. **Select your instrument** — Guitar or Bass
3. **Pick the string** you want to tune (e.g. low E)
4. **Allow microphone access** when the browser asks
5. **Play the string** and watch the needle. Tune up or down until the meter centres and turns green ✅

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

### Coverage

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `audioEngine.ts` | 100% | 100% | 100% | 100% |
| `bingSound.ts` | 100% | 100% | 100% | 100% |
| `noteUtils.ts` | 100% | 100% | 100% | 100% |
| `pitchDetector.ts` | ~97% | ~87% | 100% | 100% |
| `tunings.ts` | 100% | 100% | 100% | 100% |

### What's tested

- **`noteUtils`** — MIDI ↔ frequency conversions, note names, octaves, cents calculation, in-tune detection
- **`pitchDetector`** — silence/noise rejection, all 10 standard strings, MPM octave-trap rejection simulations, edge cases and boundary branches
- **`usePitchDetection`** — React hook lifecycle, state transitions, smoothed frame updates, and microphone error handling
- **`UI Components`** — Integration tests for Radix UI selectors, verifying rigorous `data-[state=on]` style states
- **`tunings`** — data integrity: string count, ordering, note names, octaves, frequency bounds
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
Microphone → AudioContext → AnalyserNode → Float32 Buffer
                                                  ↓
                                        Autocorrelation algorithm
                                                  ↓
                                        Detected frequency (Hz)
                                                  ↓
                                        Cents deviation from target
                                                  ↓
                                         Needle + colour feedback
```

- **Pitch detection** uses an autocorrelation algorithm on raw audio samples — lightweight and accurate enough for stringed instruments
- **Cents** are the unit of tuning precision: ±50 cents = half a semitone. In-tune is within ~5 cents
- **Audio feedback** ("bing") fires only when the pitch has been stable and in tune for a short window, to avoid false positives

---

## Project Structure

```
guitartuner/
├── __tests__/
│   ├── audioEngine.test.ts     # Browser API mocks, setup & dispose
│   ├── bingSound.test.ts       # AudioContext mock, oscillator lifecycle
│   ├── components.test.tsx     # React Component integration tests
│   ├── noteUtils.test.ts       # Frequency/MIDI/cents math
│   ├── pitchDetector.test.ts   # Sine wave fixtures, MPM octave-trap rejection
│   ├── tunings.test.ts         # Data integrity checks
│   └── usePitchDetection.test.tsx # Hook state transitions and mic mock
├── app/
│   ├── layout.tsx              # Root layout & fonts
│   └── page.tsx                # Main page
├── components/
│   ├── Tuner.tsx               # Top-level tuner component
│   ├── TunerMeter.tsx          # SVG needle gauge
│   ├── NoteDisplay.tsx         # Current note & frequency display
│   ├── InstrumentSelector.tsx  # Guitar / Bass toggle
│   └── StringSelector.tsx      # String picker
├── hooks/
│   └── usePitchDetection.ts    # Mic + audio processing hook
└── lib/
    ├── audioEngine.ts          # AudioContext & microphone setup
    ├── pitchDetector.ts        # Autocorrelation pitch algorithm
    ├── noteUtils.ts            # Frequency → note / cents math
    ├── tunings.ts              # String frequency targets
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
