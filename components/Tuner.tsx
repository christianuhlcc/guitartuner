'use client';

import { useState, useMemo } from 'react';
import { STANDARD_TUNINGS, InstrumentType } from '@/lib/tunings';
import { usePitchDetection } from '@/hooks/usePitchDetection';
import InstrumentSelector from './InstrumentSelector';
import StringSelector from './StringSelector';
import TunerMeter from './TunerMeter';
import NoteDisplay from './NoteDisplay';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function Tuner() {
    const [instrument, setInstrument] = useState<InstrumentType>('guitar');
    const [stringIndex, setStringIndex] = useState(0);

    const tuning = useMemo(() => STANDARD_TUNINGS[instrument], [instrument]);
    const targetString = tuning.strings[stringIndex];

    const { frequency, cents, isInTune, micStatus, errorMessage, toggle } =
        usePitchDetection(targetString, tuning);

    const handleInstrumentChange = (type: InstrumentType) => {
        setInstrument(type);
        setStringIndex(0); // reset to lowest string
    };

    const isListening = micStatus === 'active';
    const isRequesting = micStatus === 'requesting';

    return (
        <main className="min-h-[100dvh] bg-background flex flex-col items-center px-6 pt-10 pb-8 font-ui overflow-x-hidden">
            {/* Header / Brand */}
            <header className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <span className="w-8 h-1 bg-accent/30 rounded-full mb-4" />
                <h1 className="font-display text-2xl tracking-[0.2em] text-surface-foreground/40 uppercase">
                    Chromatic Tuner
                </h1>
            </header>

            {/* Selectors Container */}
            <div className="w-full max-w-sm flex flex-col items-center gap-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                <InstrumentSelector
                    selected={instrument}
                    onChange={handleInstrumentChange}
                />
                
                <StringSelector
                    instrument={instrument}
                    strings={tuning.strings}
                    selectedIndex={stringIndex}
                    onSelect={setStringIndex}
                />
            </div>

            {/* Visual Analyzer Section */}
            <div className="relative w-full max-w-[340px] aspect-square flex flex-col items-center justify-center animate-in zoom-in-95 duration-1000 delay-300">
                {/* Background glow when in tune */}
                <div className={cn(
                    "absolute inset-0 rounded-full blur-[60px] transition-all duration-700 opacity-20",
                    isListening && isInTune ? "bg-accent scale-110" : "bg-surface scale-90"
                )} />

                <div className="relative w-full">
                    <TunerMeter
                        cents={cents}
                        isActive={isListening}
                        isInTune={isInTune}
                    />
                </div>

                <div className="mt-8">
                    <NoteDisplay
                        frequency={frequency}
                        cents={cents}
                        targetString={targetString}
                        isInTune={isInTune}
                        isActive={isListening}
                    />
                </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
                <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl mt-6 animate-in shake duration-500">
                    <AlertCircle size={14} className="text-rose-500" />
                    <p className="font-mono text-xs text-rose-400">
                        {errorMessage}
                    </p>
                </div>
            )}

            {/* Bottom Spacer */}
            <div className="flex-1 min-h-[40px]" />

            {/* Action Bar */}
            <footer className="w-full max-w-xs flex flex-col items-center gap-4">
                {/* Target Metadata Bubble */}
                <div className="px-4 py-1.5 rounded-full bg-surface-muted border border-white/5 shadow-inner">
                    <p className="font-mono text-[10px] text-muted tracking-wider uppercase">
                        Target: <span className="text-surface-foreground/80">{targetString.note}{targetString.octave}</span>
                        <span className="mx-2 opacity-30">|</span>
                        <span className="text-surface-foreground/80">{targetString.frequency.toFixed(2)} Hz</span>
                    </p>
                </div>

                {/* Primary Mic Toggle */}
                <button
                    onClick={toggle}
                    disabled={isRequesting}
                    className={cn(
                        "group relative w-full h-16 rounded-2xl font-ui font-bold tracking-[0.1em] text-sm uppercase transition-all duration-500 overflow-hidden",
                        isListening 
                            ? "bg-surface-muted text-muted border border-white/10 hover:border-white/20"
                            : "bg-accent text-accent-foreground shadow-glow-accent hover:scale-[1.02] active:scale-95"
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex items-center justify-center gap-3">
                        {isRequesting ? (
                            <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                        ) : isListening ? (
                            <MicOff size={18} />
                        ) : (
                            <Mic size={18} />
                        )}
                        
                        <span>
                            {micStatus === 'idle' && 'Start Tuning'}
                            {micStatus === 'requesting' && 'Initializing...'}
                            {micStatus === 'active' && 'Stop'}
                            {micStatus === 'error' && 'Retry Setup'}
                        </span>
                    </div>
                </button>

                {micStatus === 'idle' && (
                    <p className="font-ui text-[10px] text-muted/60 tracking-widest uppercase animate-pulse-slow">
                        Ready to listen
                    </p>
                )}
            </footer>
        </main>
    );
}