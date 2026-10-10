import { PitchTracker, TrackerOutput } from '@/lib/pitchTracker';
import type { PitchCandidate } from '@/lib/pitchDetector';

const DT = 0.025;
const A2 = 110;
const A0 = 27.5;
const cand = (frequency: number, clarity = 0.95): PitchCandidate => ({ frequency, clarity });
const shift = (f: number, cents: number) => f * Math.pow(2, cents / 1200);

/** Drives a tracker with a running clock; RMS stays flat unless given. */
function harness() {
    const tracker = new PitchTracker();
    let t = 1;
    let last: TrackerOutput;
    return {
        tracker,
        get t() { return t; },
        step(cands: PitchCandidate[], rms = 0.05): TrackerOutput {
            t += DT;
            last = tracker.push(t, cands, rms);
            return last;
        },
        run(n: number, cands: PitchCandidate[], rms = 0.05): TrackerOutput {
            for (let i = 0; i < n; i++) this.step(cands, rms);
            return last;
        },
    };
}

describe('PitchTracker acquisition', () => {
    it('shows nothing until 3 agreeing frames, then locks', () => {
        const h = harness();
        expect(h.step([cand(A2)]).frequency).toBeNull();
        expect(h.step([cand(A2)]).frequency).toBeNull();
        const out = h.step([cand(A2)]);
        expect(out.frequency).toBeCloseTo(A2, 3);
        expect(out.midi).toBe(45);
        expect(out.cents).toBeCloseTo(0, 3);
    });

    it('does not lock on 3 disagreeing frames', () => {
        const h = harness();
        h.step([cand(A2)]);
        h.step([cand(shift(A2, 50))]);
        expect(h.step([cand(shift(A2, 100))]).frequency).toBeNull();
    });

    it('expires acquisition evidence older than 0.2 s', () => {
        const h = harness();
        h.step([cand(A2)]);
        h.step([cand(A2)]);
        h.run(12, []); // 0.3 s of nothing
        expect(h.step([cand(A2)]).frequency).toBeNull();
        expect(h.step([cand(A2)]).frequency).toBeNull();
        expect(h.step([cand(A2)]).frequency).not.toBeNull();
    });
});

describe('PitchTracker while locked', () => {
    it('ignores a single +1200 c outlier frame', () => {
        const h = harness();
        const before = h.run(10, [cand(A2)]);
        const out = h.step([cand(A2 * 2, 0.6)]);
        expect(Math.abs(1200 * Math.log2(out.frequency! / before.frequency!))).toBeLessThan(1);
    });

    it('keeps A2 when the far candidate is below the re-lock clarity', () => {
        const h = harness();
        h.run(10, [cand(A2)]);
        // descending frequency order: A2 (shorter lag) first? A0 is lower freq → later
        const out = h.run(40, [cand(A2, 0.6), cand(A0, 0.75)]);
        expect(out.midi).toBe(45);
    });

    it('re-locks to a confident far note on the 3rd frame', () => {
        const h = harness();
        h.run(10, [cand(A2)]);
        const frames = [cand(A2, 0.7), cand(A0, 0.99)];
        expect(h.step(frames).midi).toBe(45);
        expect(h.step(frames).midi).toBe(45);
        const out = h.step(frames);
        expect(out.midi).toBe(21);
    });

    it('re-locks without onset after 3 confident agreeing frames, not with low-clarity ones', () => {
        const h = harness();
        h.run(10, [cand(A2)]);
        const e3 = 164.81;
        h.run(10, [cand(e3, 0.7)]);
        expect(h.step([cand(e3, 0.7)]).midi).toBe(45);
        h.run(2, [cand(e3, 0.9)]);
        expect(h.step([cand(e3, 0.9)]).midi).toBe(52);
    });
});

describe('PitchTracker dropouts', () => {
    it('holds for 500 ms, goes stale after 150 ms, then clears', () => {
        const h = harness();
        h.run(10, [cand(A2)]);
        let out = h.step([]); // 25 ms
        expect(out.isStale).toBe(false);
        expect(out.frequency).not.toBeNull();
        out = h.run(4, []); // 125 ms
        expect(out.isStale).toBe(false);
        out = h.run(2, []); // 175 ms
        expect(out.isStale).toBe(true);
        expect(out.frequency).not.toBeNull();
        out = h.run(12, []); // 475 ms
        expect(out.frequency).not.toBeNull();
        out = h.run(2, []); // 525 ms
        expect(out).toEqual({ frequency: null, midi: null, cents: null, isInTune: false, isStale: false });
    });
});

describe('PitchTracker onset', () => {
    it('re-acquires a new note within 3 frames, old value stays until then', () => {
        const h = harness();
        h.run(10, [cand(A2)], 0.01);
        const e3 = 164.81;
        const big = [cand(e3, 0.95)];
        let out = h.step(big, 0.2); // onset
        expect(out.midi).toBe(45);
        out = h.step(big, 0.2);
        expect(out.midi).toBe(45);
        out = h.step(big, 0.2);
        expect(out.midi).toBe(52);
    });
});

describe('PitchTracker hysteresis', () => {
    it('keeps the note between +45 and +55 c and changes beyond +60 c', () => {
        const h = harness();
        h.run(10, [cand(shift(A2, 45))]);
        let out = h.run(60, [cand(shift(A2, 55))]);
        expect(out.midi).toBe(45);
        expect(out.cents!).toBeGreaterThan(50);
        out = h.run(80, [cand(shift(A2, 65))]);
        expect(out.midi).toBe(46);
        expect(out.cents!).toBeLessThan(-30);
    });

    it('in-tune enters at 4 c, stays at 6 c, leaves above 7 c and resets on note change', () => {
        const h = harness();
        let out = h.run(10, [cand(shift(A2, 8))]);
        expect(out.isInTune).toBe(false);
        out = h.run(80, [cand(shift(A2, 3))]);
        expect(out.isInTune).toBe(true);
        out = h.run(80, [cand(shift(A2, 6))]);
        expect(out.isInTune).toBe(true);
        out = h.run(80, [cand(shift(A2, 9))]);
        expect(out.isInTune).toBe(false);
        out = h.run(80, [cand(shift(A2, 5))]);
        expect(out.isInTune).toBe(false); // needs ≤ 4 to re-enter
        out = h.run(80, [cand(shift(A2, 2))]);
        expect(out.isInTune).toBe(true);
        out = h.run(80, [cand(shift(A2, 105))]);
        expect(out.midi).toBe(46);
        expect(out.isInTune).toBe(false);
    });
});

describe('PitchTracker smoothing', () => {
    it('steady input with ±3 c alternating noise moves the output < 1 c per frame', () => {
        const h = harness();
        h.run(40, [cand(A2)]);
        let prev = h.step([cand(A2)]).cents!;
        let maxStep = 0;
        for (let i = 0; i < 80; i++) {
            const out = h.step([cand(shift(A2, i % 2 ? 3 : -3))]);
            maxStep = Math.max(maxStep, Math.abs(out.cents! - prev));
            prev = out.cents!;
        }
        expect(maxStep).toBeLessThan(1);
    });

    it('follows a 20 c/s ramp with < 150 ms lag', () => {
        const h = harness();
        h.run(40, [cand(A2)]);
        let ideal = 0;
        let out = h.step([cand(A2)]);
        for (let i = 0; i < 80; i++) {
            ideal += 20 * DT;
            out = h.step([cand(shift(A2, ideal))]);
        }
        const lagMs = ((ideal - out.cents!) / 20) * 1000;
        expect(lagMs).toBeLessThan(150);
        expect(lagMs).toBeGreaterThanOrEqual(0);
    });
});

describe('PitchTracker.reset', () => {
    it('clears everything', () => {
        const h = harness();
        h.run(10, [cand(A2)]);
        h.tracker.reset();
        const out = h.step([cand(A2)]);
        expect(out.frequency).toBeNull();
        h.step([cand(A2)]);
        expect(h.step([cand(A2)]).midi).toBe(45);
    });
});

describe('PitchTracker sticky note', () => {
    const G3 = 196;
    const F3 = G3 * Math.pow(2, -200 / 1200);

    it('does not jump to a nearby note on a brief re-pluck misreading', () => {
        const h = harness();
        h.run(20, [cand(G3)], 0.01);
        h.step([cand(F3, 0.95)], 0.2); // onset
        const out = h.run(4, [cand(F3, 0.95)], 0.2);
        expect(out.midi).toBe(55);
        const back = h.run(10, [cand(G3)], 0.2);
        expect(back.midi).toBe(55);
    });

    it('does not jump while the tracked pitch still has support', () => {
        const h = harness();
        h.run(20, [cand(G3)]);
        const out = h.run(30, [cand(G3, 0.85), cand(F3, 0.95)]);
        expect(out.midi).toBe(55);
    });

    it('still re-locks to a persistent nearby note', () => {
        const h = harness();
        h.run(20, [cand(G3)], 0.01);
        h.step([cand(F3)], 0.2);
        const out = h.run(8, [cand(F3)], 0.2);
        expect(out.midi).toBe(53);
    });
});
