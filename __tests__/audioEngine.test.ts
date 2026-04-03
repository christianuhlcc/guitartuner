import { createAudioEngine } from '@/lib/audioEngine';

// ─── Browser API mocks ────────────────────────────────────────────────────────

function makeTrackMock() {
    return { stop: jest.fn() };
}

function makeStreamMock(tracks = [makeTrackMock()]) {
    return {
        getTracks: jest.fn(() => tracks),
    };
}

function makeSourceMock() {
    return {
        connect: jest.fn(),
        disconnect: jest.fn(),
    };
}

function makeAnalyserMock() {
    return {
        fftSize: 0,
        smoothingTimeConstant: 0,
    };
}

function makeAudioContextMock(state: AudioContextState = 'running') {
    const source = makeSourceMock();
    const analyser = makeAnalyserMock();

    return {
        state,
        resume: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        createMediaStreamSource: jest.fn(() => source),
        createAnalyser: jest.fn(() => analyser),
        _source: source,
        _analyser: analyser,
    };
}

// ─── Setup global mocks ───────────────────────────────────────────────────────

let mockAudioContext: ReturnType<typeof makeAudioContextMock>;
let mockStream: ReturnType<typeof makeStreamMock>;

beforeEach(() => {
    mockStream = makeStreamMock();
    mockAudioContext = makeAudioContextMock();

    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(global, 'navigator', {
        value: {
            mediaDevices: {
                getUserMedia: jest.fn().mockResolvedValue(mockStream),
            },
        },
        writable: true,
        configurable: true,
    });

    // Mock AudioContext constructor
    (global as Record<string, unknown>).AudioContext = jest
        .fn()
        .mockImplementation(() => mockAudioContext);
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ─── createAudioEngine ────────────────────────────────────────────────────────

describe('createAudioEngine', () => {
    it('requests microphone access with the correct constraints', async () => {
        await createAudioEngine();
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
            audio: {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false,
            },
        });
    });

    it('creates an AudioContext', async () => {
        await createAudioEngine();
        expect(global.AudioContext).toHaveBeenCalledTimes(1);
    });

    it('creates an AnalyserNode', async () => {
        await createAudioEngine();
        expect(mockAudioContext.createAnalyser).toHaveBeenCalledTimes(1);
    });

    it('applies default fftSize of 4096', async () => {
        await createAudioEngine();
        expect(mockAudioContext._analyser.fftSize).toBe(4096);
    });

    it('applies a custom fftSize when provided', async () => {
        await createAudioEngine({ fftSize: 2048 });
        expect(mockAudioContext._analyser.fftSize).toBe(2048);
    });

    it('sets smoothingTimeConstant to 0 by default', async () => {
        await createAudioEngine();
        expect(mockAudioContext._analyser.smoothingTimeConstant).toBe(0);
    });

    it('applies a custom smoothingTimeConstant when provided', async () => {
        await createAudioEngine({ smoothingTimeConstant: 0.8 });
        expect(mockAudioContext._analyser.smoothingTimeConstant).toBe(0.8);
    });

    it('connects the media stream source to the analyser', async () => {
        await createAudioEngine();
        expect(mockAudioContext._source.connect).toHaveBeenCalledWith(
            mockAudioContext._analyser,
        );
    });

    it('returns the audioContext, analyser, stream, and dispose function', async () => {
        const engine = await createAudioEngine();
        expect(engine).toHaveProperty('audioContext');
        expect(engine).toHaveProperty('analyser');
        expect(engine).toHaveProperty('stream');
        expect(engine).toHaveProperty('dispose');
        expect(typeof engine.dispose).toBe('function');
    });

    it('resumes a suspended AudioContext', async () => {
        mockAudioContext = makeAudioContextMock('suspended');
        (global as Record<string, unknown>).AudioContext = jest
            .fn()
            .mockImplementation(() => mockAudioContext);

        await createAudioEngine();
        expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
    });

    it('does not resume a running AudioContext', async () => {
        // default mock state is 'running'
        await createAudioEngine();
        expect(mockAudioContext.resume).not.toHaveBeenCalled();
    });
});

// ─── dispose ─────────────────────────────────────────────────────────────────

describe('createAudioEngine – dispose()', () => {
    it('disconnects the source node', async () => {
        const engine = await createAudioEngine();
        engine.dispose();
        expect(mockAudioContext._source.disconnect).toHaveBeenCalledTimes(1);
    });

    it('stops all media stream tracks', async () => {
        const tracks = [makeTrackMock(), makeTrackMock()];
        mockStream = makeStreamMock(tracks);
        Object.defineProperty(global, 'navigator', {
            value: { mediaDevices: { getUserMedia: jest.fn().mockResolvedValue(mockStream) } },
            writable: true,
            configurable: true,
        });

        const engine = await createAudioEngine();
        engine.dispose();

        tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });

    it('closes the AudioContext when it is not already closed', async () => {
        const engine = await createAudioEngine();
        engine.dispose();
        expect(mockAudioContext.close).toHaveBeenCalledTimes(1);
    });

    it('does not close the AudioContext when it is already closed', async () => {
        mockAudioContext = makeAudioContextMock('closed' as AudioContextState);
        (global as Record<string, unknown>).AudioContext = jest
            .fn()
            .mockImplementation(() => mockAudioContext);

        const engine = await createAudioEngine();
        engine.dispose();
        expect(mockAudioContext.close).not.toHaveBeenCalled();
    });
});
