'use client';

import { frequencyToMidi, midiToNoteName } from '@/lib/noteUtils';
import { StringDefinition } from '@/lib/tunings';

interface NoteDisplayProps {
    frequency: number | null;
    cents: number | null;
    targetString: StringDefinition;
    isInTune: boolean;
    isActive: boolean;
}

export default function NoteDisplay({
    frequency,
    cents,
    targetString,
    isInTune,
    isActive,
}: NoteDisplayProps) {
    const hasSignal = isActive && frequency !== null && cents !== null;

    // Detected note name (may differ from target when badly detuned)
    const detectedNote = hasSignal
        ? midiToNoteName(frequencyToMidi(frequency!))
        : null;

    // Status label
    let statusLabel = '';
    let statusColor = 'text-muted';
    if (hasSignal && cents !== null) {
        if (isInTune) {
            statusLabel = '● IN TUNE';
            statusColor = 'text-in-tune';
        } else if (cents < 0) {
            statusLabel = '▼ FLAT';
            statusColor = 'text-flat';
        } else {
            statusLabel = '▲ SHARP';
            statusColor = 'text-sharp';
        }
    }

    const centsDisplay =
        hasSignal && cents !== null
            ? `${cents >= 0 ? '+' : ''}${Math.round(cents)} cents`
            : '';

    return (
        <div className="flex flex-col items-center gap-1 mt-1">
            {/* Big note name */}
            <div className="relative flex items-baseline gap-2">
                <span
                    className="font-display text-9xl leading-none tracking-widest"
                    style={{
                        color: hasSignal
                            ? isInTune
                                ? '#10B981'
                                : detectedNote !== targetString.note
                                    ? '#EF4444'
                                    : '#E8EAF0'
                            : '#2A2F3A',
                        transition: 'color 0.2s',
                    }}
                >
                    {hasSignal ? detectedNote : targetString.note}
                </span>
                {/* Target string reminder */}
                <span className="font-ui text-sm text-gray-600 self-start mt-4">
                    → {targetString.note}
                    <sub>{targetString.octave}</sub>
                </span>
            </div>

            {/* Frequency readout */}
            <span
                className="font-mono text-sm"
                style={{ color: hasSignal ? '#9CA3AF' : '#374151' }}
            >
                {hasSignal ? `${frequency!.toFixed(1)} Hz` : '— Hz'}
            </span>

            {/* Cents readout */}
            <span
                className="font-mono text-xs tracking-widest"
                style={{
                    color: hasSignal
                        ? isInTune
                            ? '#10B981'
                            : Math.abs(cents!) <= 20
                                ? '#F59E0B'
                                : '#EF4444'
                        : '#374151',
                    transition: 'color 0.15s',
                }}
            >
                {centsDisplay}
            </span>

            {/* Status label */}
            <span
                className={`font-ui text-xs font-semibold tracking-[0.25em] mt-1 ${statusColor}`}
                style={{ minHeight: '1.2em' }}
            >
                {statusLabel}
            </span>
        </div>
    );
}