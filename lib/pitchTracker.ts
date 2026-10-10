import type { PitchCandidate } from './pitchDetector';
import { pickMpm } from './pitchDetector';

export interface TrackerOptions {
    minClarity: number;      // candidates below this are ignored
    k: number;               // MPM k-rule factor for acquisition
    lambda: number;          // continuity penalty, clarity units per octave
    minScore: number;        // continuity candidate must score ≥ this
    medianSize: number;      // readings in the median window
    medianMaxAgeSec: number; // drop readings older than this from the median
    holdMs: number;          // keep showing last value through dropouts
    staleAfterMs: number;    // flag isStale (UI dims) once no reading for this long
    minCutoffHz: number;     // One-Euro: cutoff when pitch is steady
    beta: number;            // One-Euro: cutoff increase per (cents/s)
    derivCutoffHz: number;   // One-Euro: smoothing of the speed estimate
    confirmFrames: number;   // agreeing frames needed to acquire / re-lock
    agreeCents: number;      // max spread of those frames
    pendingMaxAgeSec: number;// acquisition evidence older than this is discarded
    relockMinClarity: number;// each re-lock frame needs at least this clarity
    jumpCents: number;       // "different note" threshold
    nearJumpCents: number;   // jumps up to this far are suspicious (tuning drift / transient), not a new string
    nearConfirmFrames: number;// agreeing frames needed to accept such a near jump
    onsetDb: number;         // short-window energy rise that counts as a pluck
    onsetMinRms: number;     // ignore onsets below this level
    noteHysteresisCents: number;
    inTuneEnterCents: number;
    inTuneExitCents: number;
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
    minClarity: 0.5, k: 0.8, lambda: 1.0, minScore: 0.25,
    medianSize: 5, medianMaxAgeSec: 0.4, holdMs: 500, staleAfterMs: 150,
    minCutoffHz: 0.8, beta: 0.03, derivCutoffHz: 1.0,
    confirmFrames: 3, agreeCents: 35, pendingMaxAgeSec: 0.2, relockMinClarity: 0.8, jumpCents: 80,
    nearJumpCents: 250, nearConfirmFrames: 7,
    onsetDb: 6, onsetMinRms: 0.003,
    noteHysteresisCents: 60, inTuneEnterCents: 4, inTuneExitCents: 7,
};

export interface TrackerOutput {
    /** Smoothed frequency in Hz, null when nothing is being tracked. */
    frequency: number | null;
    /** MIDI note number of the displayed note (A4 = 69). */
    midi: number | null;
    /** Deviation from that note in cents (≈ ±60 because of note hysteresis). */
    cents: number | null;
    isInTune: boolean;
    /** True while holding the last value through a dropout (>150 ms without a reading). */
    isStale: boolean;
}

const EMPTY: TrackerOutput = { frequency: null, midi: null, cents: null, isInTune: false, isStale: false };
const toAbsCents = (f: number) => 1200 * Math.log2(f / 440);
const fromAbsCents = (c: number) => 440 * Math.pow(2, c / 1200);
const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
const smoothingAlpha = (cutoffHz: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoffHz * dt));

export class PitchTracker {
    private o: TrackerOptions;
    private x: number | null = null;                 // smoothed abs cents
    private dx = 0;                                   // smoothed speed (cents/s)
    private lastUpdate = 0;
    private lastUsed = -Infinity;
    private history: { t: number; c: number }[] = [];
    private pending: { t: number; c: number; q: number }[] = [];
    private acquiring = true;
    private prevShortRms = 0;
    private midi: number | null = null;
    private inTune = false;

    constructor(options: Partial<TrackerOptions> = {}) {
        this.o = { ...DEFAULT_TRACKER_OPTIONS, ...options };
    }

    reset(): void {
        this.x = null; this.dx = 0; this.lastUpdate = 0; this.lastUsed = -Infinity;
        this.history = []; this.pending = []; this.acquiring = true;
        this.prevShortRms = 0; this.midi = null; this.inTune = false;
    }

    /**
     * @param t          time in seconds (monotonic, e.g. performance.now()/1000)
     * @param candidates output of detectPitchCandidates for this frame
     * @param shortRms   RMS of the newest ~20 ms of the buffer (onset detection)
     */
    push(t: number, candidates: PitchCandidate[], shortRms: number): TrackerOutput {
        const o = this.o;

        // 1. Onset → re-acquire (display keeps the old value meanwhile)
        if (shortRms > o.onsetMinRms && shortRms > this.prevShortRms * Math.pow(10, o.onsetDb / 20)) {
            this.acquiring = true;
            this.pending = [];
        }
        this.prevShortRms = shortRms;

        const mpm = pickMpm(candidates, o.k, o.minClarity);
        let used: { c: number; q: number } | null = null;

        if (this.x !== null && !this.acquiring) {
            // 3a. Continuity prior: best clarity − λ·octaves from the tracked pitch
            let best: PitchCandidate | null = null, bestScore = -Infinity;
            for (const cd of candidates) {
                if (cd.clarity < o.minClarity) continue;
                const score = cd.clarity - (o.lambda * Math.abs(toAbsCents(cd.frequency) - this.x)) / 1200;
                if (score > bestScore) { bestScore = score; best = cd; }
            }
            if (bestScore < o.minScore) best = null;

            // 3b. MPM confidently and consistently elsewhere → a new note without a clear onset
            if (mpm && Math.abs(toAbsCents(mpm.frequency) - this.x) > o.jumpCents) {
                this.pending.push({ t, c: toAbsCents(mpm.frequency), q: mpm.clarity });
                const agreed = this.agreed();
                if (agreed !== null && this.confident(this.o.confirmFrames) && (!best || Math.abs(agreed - this.x) > o.jumpCents)) {
                    // Sticky note: a nearby note (a semitone or two away) must persist longer,
                    // and only wins once the tracked pitch itself has no support any more.
                    const near = Math.abs(agreed - this.x) <= o.nearJumpCents;
                    const agreedNear = near ? this.agreed(o.nearConfirmFrames) : agreed;
                    if (agreedNear !== null && (!near || (!best && this.confident(o.nearConfirmFrames)))) {
                        this.lockTo(agreedNear, t);
                        best = null;
                    }
                }
            } else {
                this.pending = [];
            }
            if (best) used = { c: toAbsCents(best.frequency), q: best.clarity };
        } else if (mpm) {
            // 2. Acquire
            this.pending.push({ t, c: toAbsCents(mpm.frequency), q: mpm.clarity });
            let agreed = this.agreed();
            if (agreed !== null && this.x !== null && Math.abs(agreed - this.x) <= o.nearJumpCents
                && Math.abs(agreed - this.x) > o.jumpCents) {
                // Re-pluck transients often read a semitone or two off: keep the displayed note
                // until the new reading has persisted.
                agreed = this.agreed(o.nearConfirmFrames);
            }
            if (agreed !== null) this.lockTo(agreed, t);
        }

        if (used && this.x !== null) {
            // 4. Median → clarity-weighted One-Euro
            this.history.push({ t, c: used.c });
            this.history = this.history.filter((h) => t - h.t < o.medianMaxAgeSec).slice(-o.medianSize);
            const med = median(this.history.map((h) => h.c));
            const dt = Math.max(1e-3, t - this.lastUpdate);
            if (Math.abs(med - this.x) > o.jumpCents) {
                this.x = med; this.dx = 0;
            } else {
                this.dx += smoothingAlpha(o.derivCutoffHz, dt) * ((med - this.x) / dt - this.dx);
                const weight = Math.min(1, Math.max(0.15, (used.q - 0.5) / 0.4));
                this.x += weight * smoothingAlpha(o.minCutoffHz + o.beta * Math.abs(this.dx), dt) * (med - this.x);
            }
            this.lastUpdate = t;
            this.lastUsed = t;
        } else if (this.x !== null && t - this.lastUsed > o.holdMs / 1000) {
            // 5. Dropout longer than the hold → clear (pending acquisition evidence survives)
            this.x = null; this.dx = 0; this.history = [];
            this.acquiring = true; this.midi = null; this.inTune = false;
        }

        if (this.x === null) return EMPTY;

        // 6. Note (hysteresis) + in-tune (hysteresis)
        const nearest = Math.round(this.x / 100) + 69;
        if (this.midi === null || Math.abs(this.x - (this.midi - 69) * 100) > o.noteHysteresisCents) {
            if (this.midi !== nearest) this.inTune = false;
            this.midi = nearest;
        }
        const cents = this.x - (this.midi - 69) * 100;
        this.inTune = this.inTune ? Math.abs(cents) <= o.inTuneExitCents : Math.abs(cents) <= o.inTuneEnterCents;
        return {
            frequency: fromAbsCents(this.x),
            midi: this.midi,
            cents,
            isInTune: this.inTune,
            isStale: t - this.lastUsed > o.staleAfterMs / 1000,
        };
    }

    private confident(n: number): boolean {
        return this.pending.slice(-n).every((p) => p.q >= this.o.relockMinClarity);
    }

    private agreed(n: number = this.o.confirmFrames): number | null {
        const now = this.pending.length ? this.pending[this.pending.length - 1].t : 0;
        this.pending = this.pending.filter((p) => now - p.t <= this.o.pendingMaxAgeSec);
        const recent = this.pending.slice(-n);
        if (recent.length < n) return null;
        const cs = recent.map((p) => p.c);
        return Math.max(...cs) - Math.min(...cs) <= this.o.agreeCents ? median(cs) : null;
    }

    private lockTo(c: number, t: number): void {
        this.x = c;
        this.dx = 0;
        this.history = this.pending.slice(-this.o.confirmFrames).map((p) => ({ t: p.t, c: p.c }));
        this.pending = [];
        this.acquiring = false;
        this.lastUpdate = t;
        this.lastUsed = t;
    }
}
