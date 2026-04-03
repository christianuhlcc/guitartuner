'use client';

import { StringDefinition } from '@/lib/tunings';

interface StringSelectorProps {
    strings: StringDefinition[];
    selectedIndex: number;
    onSelect: (index: number) => void;
}

/** Unicode subscript digits for octave labels */
const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function subscript(n: number): string {
    return String(n)
        .split('')
        .map((d) => SUBSCRIPTS[Number(d)])
        .join('');
}

export default function StringSelector({
    strings,
    selectedIndex,
    onSelect,
}: StringSelectorProps) {
    return (
        <div
            className="flex gap-2 mt-4"
            role="radiogroup"
            aria-label="String selection"
        >
            {strings.map((s, i) => {
                const isSelected = i === selectedIndex;
                return (
                    <button
                        key={`${s.note}${s.octave}-${i}`}
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => onSelect(i)}
                        className="flex flex-col items-center justify-center w-11 h-12 rounded-lg font-ui font-semibold transition-all duration-150"
                        style={{
                            backgroundColor: isSelected ? '#1D2235' : 'transparent',
                            color: isSelected ? '#E8EAF0' : '#4B5563',
                            border: isSelected
                                ? '1px solid rgba(255,255,255,0.1)'
                                : '1px solid transparent',
                            boxShadow: isSelected
                                ? '0 0 10px rgba(16,185,129,0.15)'
                                : undefined,
                        }}
                        aria-label={`${s.note}${s.octave} – ${s.frequency} Hz, string ${s.number}`}
                    >
                        <span className="text-base leading-tight">{s.note}</span>
                        <span className="text-[10px] opacity-60">{subscript(s.octave)}</span>
                    </button>
                );
            })}
        </div>
    );
}