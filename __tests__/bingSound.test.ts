import { playBing } from '@/lib/bingSound';

/**
 * Build a minimal AudioContext mock that tracks what was created and connected.
 * We verify behaviour (oscillators started, gain envelope scheduled) rather
 * than audio output, which is impossible to capture in a unit test.
 */
function makeAudioContextMock() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oscillators: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gainNodes: any[] = [];

    const mockContext = {
        currentTime: 0,
        destination: {},
        createOscillator: jest.fn(() => {
            const osc = {
                type: 'sine',
                frequency: { setValueAtTime: jest.fn() },
                connect: jest.fn(),
                start: jest.fn(),
                stop: jest.fn(),
            };
            oscillators.push(osc);
            return osc;
        }),
        createGain: jest.fn(() => {
            const gainNode = {
                gain: {
                    setValueAtTime: jest.fn(),
                    linearRampToValueAtTime: jest.fn(),
                    exponentialRampToValueAtTime: jest.fn(),
                },
                connect: jest.fn(),
            };
            gainNodes.push(gainNode);
            return gainNode;
        }),
        _oscillators: oscillators,
        _gainNodes: gainNodes,
    };

    return mockContext;
}

describe('playBing', () => {
    it('creates 3 oscillators (one per harmonic partial)', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('creates 3 gain nodes (one envelope per partial)', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        expect(ctx.createGain).toHaveBeenCalledTimes(3);
    });

    it('starts all oscillators', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        ctx._oscillators.forEach((osc) => {
            expect(osc.start).toHaveBeenCalledTimes(1);
        });
    });

    it('stops all oscillators with a future time (decay duration)', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        ctx._oscillators.forEach((osc) => {
            expect(osc.stop).toHaveBeenCalledTimes(1);
            const stopTime = osc.stop.mock.calls[0][0];
            expect(stopTime).toBeGreaterThan(ctx.currentTime);
        });
    });

    it('schedules a gain envelope on every gain node', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        ctx._gainNodes.forEach((gainNode) => {
            expect(gainNode.gain.setValueAtTime).toHaveBeenCalled();
            expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalled();
            expect(gainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
        });
    });

    it('sets oscillator type to "sine" for all partials', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        ctx._oscillators.forEach((osc) => {
            expect(osc.type).toBe('sine');
        });
    });

    it('sets different frequencies for each harmonic partial', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        const freqs = ctx._oscillators.map(
            (osc) => osc.frequency.setValueAtTime.mock.calls[0][0],
        );
        // All three frequencies should be distinct (fundamental, octave, fifth)
        const unique = new Set(freqs);
        expect(unique.size).toBe(3);
    });

    it('connects each oscillator to a gain node', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        ctx._oscillators.forEach((osc) => {
            expect(osc.connect).toHaveBeenCalledTimes(1);
        });
    });

    it('connects each gain node to the audio destination', () => {
        const ctx = makeAudioContextMock();
        playBing(ctx as unknown as AudioContext);
        ctx._gainNodes.forEach((gainNode) => {
            expect(gainNode.connect).toHaveBeenCalledWith(ctx.destination);
        });
    });
});
