'use client';

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { StringDefinition, InstrumentType } from '@/lib/tunings';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface StringSelectorProps {
    instrument: InstrumentType;
    strings: StringDefinition[];
    selectedIndex: number;
    onSelect: (index: number) => void;
}

const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const;

function subscript(n: number): string {
    return String(n)
        .split('')
        .map((d) => SUBSCRIPTS[Number(d)] ?? d)
        .join('');
}

export default function StringSelector({
    instrument,
    strings,
    selectedIndex,
    onSelect,
}: StringSelectorProps) {
    const isGuitar = instrument === 'guitar';

    return (
        <ToggleGroup.Root
            type="single"
            value={String(selectedIndex)}
            onValueChange={(value) => {
                if (value !== '') onSelect(parseInt(value, 10));
            }}
            className={cn(
                "grid w-full gap-3 p-4 bg-surface/30 backdrop-blur-md rounded-2xl border border-white/5 shadow-glass-md",
                isGuitar ? "grid-cols-3" : "grid-cols-2"
            )}
            aria-label="Select string/note"
        >
            {strings.map((s, i) => {
                const isSelected = i === selectedIndex;
                return (
                    <ToggleGroup.Item
                        key={`${s.note}${s.octave}-${i}`}
                        value={String(i)}
                        className={cn(
                            "group flex flex-col items-center justify-center h-16 rounded-xl border transition-all duration-300 outline-none",
                            isSelected
                                ? "bg-surface-selected border-white/20 text-white shadow-glow-blue scale-[1.05]"
                                : "bg-surface-muted border-white/5 text-muted hover:border-white/20 hover:text-surface-foreground hover:bg-surface-active/30"
                        )}
                        aria-label={`${s.note}${s.octave} – ${s.frequency} Hz, string ${s.number}`}
                    >
                        <span className={cn(
                            "text-xl font-display leading-none tracking-tight transition-transform duration-300",
                            isSelected ? "font-bold text-blue-100" : "group-hover:scale-105"
                        )}>
                            {s.note}
                        </span>
                        <span className={cn(
                            "text-[10px] font-mono leading-none mt-1 uppercase",
                            isSelected ? "text-blue-200/60" : "text-muted"
                        )}>
                            {s.note}{subscript(s.octave)}
                        </span>
                        
                        <div className={cn(
                            "absolute top-2 right-2 text-[8px] font-bold opacity-30",
                            isSelected ? "text-blue-100" : "text-muted"
                        )}>
                            #{s.number}
                        </div>
                    </ToggleGroup.Item>
                );
            })}
        </ToggleGroup.Root>
    );
}