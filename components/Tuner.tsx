'use client';

import { useState } from 'react';
import { STANDARD_TUNINGS, InstrumentType } from '@/lib/tunings';
import { usePitchDetection } from '@/hooks/usePitchDetection';
import InstrumentSelector from './InstrumentSelector';
import StringSelector from './StringSelector';
import TunerMeter from './TunerMeter';
import NoteDisplay from './NoteDisplay';

export default function Tuner() {
    const [instrument, setInstrument] = useState<InstrumentType>('guitar');
    const [stringIndex, setStringIndex] = useState(0);

    const tuning = STANDARD_TUNINGS[instrument];
    const targetString = tuning.strings[stringIndex];

    const { frequency, cents, isInTune, micStatus, errorMessage, toggle } =
        usePitchDetection(targetString, tuning);

    const handleInstrumentChange = (type: InstrumentType) => {
        setInstrument(type);
        setStringIndex(0); // reset to lowest string
    };

    const isListening = micStatus === 'active';

    return (
        <main className="min-h-[100dvh] bg-[#090B0E] flex flex-col items-center px-4 pt-8 pb-6 font-ui">
            {/* App wordmark */}
            <h1 className="font-ui text-xs tracking-[0.4em] text-gray-600 uppercase mb-6">
                Chromatic Tuner
            </h1>

            {/* Instrument toggle */}
            <InstrumentSelector
                selected={instrument}
                onChange={handleInstrumentChange}
            />

            {/* String selector */}
            <StringSelector
                strings={tuning.strings}
                selectedIndex={stringIndex}
                onSelect={setStringIndex}
            />

            {/* ── Main gauge ── */}
            <div className="w-full max-w-[320px] mt-4">
                <TunerMeter
                    cents={cents}
                    isActive={isListening}
                    isInTune={isInTune}
                />
            </div>

            {/* ── Note + frequency display ── */}
            <NoteDisplay
                frequency={frequency}
                cents={cents}
                targetString={targetString}
                isInTune={isInTune}
                isActive={isListening}
            />

            {/* Error message */}
            {errorMessage && (
                <p className="font-mono text-xs text-red-400 mt-3 text-center max-w-[260px]">
                    {errorMessage}
                </p>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Target frequency reminder */}
            <p className="font-mono text-xs text-gray-700 mb-4">
                Target: {targetString.note}
                {targetString.octave} = {targetString.frequency.toFixed(2)} Hz
            </p>

            {/* Mic toggle button */}
            <button
                onClick={toggle}
                disabled={micStatus === 'requesting'}
                aria-label={isListening ? 'Stop tuner' : 'Start tuner'}
                className="w-full max-w-[280px] py-4 rounded-2xl font-ui font-semibold tracking-widest text-sm uppercase transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    backgroundColor: isListening ? '#1D2235' : '#10B981',
                    color: isListening ? '#6B7280' : '#022c22',
                    border: isListening ? '1px solid #374151' : 'none',
                    boxShadow: isListening
                        ? 'none'
                        : '0 0 24px rgba(16,185,129,0.35)',
                }}
            >
                {micStatus === 'idle' && '⏵  Start Tuning'}
                {micStatus === 'requesting' && 'Requesting mic…'}
                {micStatus === 'active' && '⏹  Stop'}
                {micStatus === 'error' && '↺  Try Again'}
            </button>

            {/* Mic hint */}
            {micStatus === 'idle' && (
                <p className="font-ui text-xs text-gray-700 mt-3 text-center">
                    Microphone access required
                </p>
            )}
        </main>
    );
}