'use client';

import { StringDefinition } from '@/lib/tunings';

interface NoteDisplayProps {
    noteName: string | null;
    octave: number | null;
    frequency: number | null;
    cents: number | null;
    isInTune: boolean;
    isActive: boolean;
    /** Holding the last value through a short dropout. */
    isStale: boolean;
    /** Open string of the instrument matching the displayed note, if any. */
    openString: StringDefinition | null;
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

function toSubscript(n: number): string {
    return String(n)
        .split('')
        .map((ch) => (ch === '-' ? '₋' : SUBSCRIPT_DIGITS[Number(ch)]))
        .join('');
}

export default function NoteDisplay({
    noteName,
    octave,
    frequency,
    cents,
    isInTune,
    isActive,
    isStale,
    openString,
}: NoteDisplayProps) {
    const hasSignal =
        isActive && noteName !== null && octave !== null && frequency !== null && cents !== null;

    // Status label
    let statusLabel = '';
    let statusColor = 'text-muted';
    if (hasSignal) {
        if (isInTune) {
            statusLabel = '● IN TUNE';
            statusColor = 'text-in-tune';
        } else if (cents! < 0) {
            statusLabel = '▼ FLAT';
            statusColor = 'text-flat';
        } else {
            statusLabel = '▲ SHARP';
            statusColor = 'text-sharp';
        }
    }

    const centsDisplay = hasSignal
        ? `${cents! >= 0 ? '+' : ''}${Math.round(cents!)} cents`
        : '';

    const noteColor = hasSignal ? (isInTune ? '#10B981' : '#E8EAF0') : '#2A2F3A';

    return (
        <div
            data-testid="note-display"
            className="flex flex-col items-center gap-1 mt-1"
            style={{ opacity: hasSignal && isStale ? 0.5 : 1, transition: 'opacity 0.2s' }}
        >
            {/* Big note name with octave subscript */}
            <div className="relative flex items-baseline">
                <span
                    data-testid="note-name"
                    className="font-display text-9xl leading-none tracking-widest"
                    style={{ color: noteColor, transition: 'color 0.2s' }}
                >
                    {hasSignal ? noteName!.replace('#', '♯') : '—'}
                </span>
                {hasSignal && (
                    <span
                        data-testid="note-octave"
                        aria-label={`octave ${octave}`}
                        className="font-display text-4xl leading-none"
                        style={{ color: noteColor, transition: 'color 0.2s' }}
                    >
                        <span aria-hidden="true">{toSubscript(octave!)}</span>
                        <span className="sr-only">{octave}</span>
                    </span>
                )}
            </div>

            {/* Passive open-string hint */}
            <span
                data-testid={hasSignal && openString ? 'open-string' : undefined}
                className="font-ui text-xs tracking-widest text-surface-foreground/60"
                style={{ minHeight: '1.2em' }}
            >
                {hasSignal && openString
                    ? `String ${openString.number} · ${openString.note}${openString.octave}`
                    : ''}
            </span>

            {/* Frequency readout */}
            <span
                className="font-mono text-sm"
                style={{ color: hasSignal ? '#9CA3AF' : '#374151' }}
            >
                {hasSignal ? `${frequency!.toFixed(1)} Hz` : '— Hz'}
            </span>

            {/* Cents readout */}
            <span
                data-testid="cents"
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

            {/* Status label / prompt */}
            <span
                className={`font-ui text-xs font-semibold tracking-[0.25em] mt-1 ${statusColor}`}
                style={{ minHeight: '1.2em' }}
            >
                {hasSignal ? statusLabel : isActive ? 'Play a string' : ''}
            </span>
        </div>
    );
}
