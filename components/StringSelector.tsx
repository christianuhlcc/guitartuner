'use client';

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { StringDefinition } from '@/lib/tunings';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface StringSelectorProps {
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
    strings,
    selectedIndex,
    onSelect,
}: StringSelectorProps) {
    return (
        <ToggleGroup.Root
            type="single"
            value={String(selectedIndex)}
            onValueChange={(value) => {
                if (value !== '') onSelect(parseInt(value, 10));
            }}
            className="flex flex-wrap items-center justify-center gap-3 p-2 bg-surface/30 backdrop-blur-md rounded-2xl border border-white/5 shadow-glass-md"
            aria-label="Select string/note"
        >
            {strings.map((s, i) => {
                const isSelected = i === selectedIndex;
                return (
                    <ToggleGroup.Item
                        key={`${s.note}${s.octave}-${i}`}
                        value={String(i)}
                        className={cn(
                            "group flex flex-col items-center justify-center min-w-[54px] min-h-[64px] p-2 rounded-xl border transition-all duration-300 outline-none",
                            isSelected
                                ? "bg-accent/15 border-accent text-accent shadow-glow-accent ring-1 ring-accent/30"
                                : "bg-surface-muted border-white/5 text-muted hover:border-white/20 hover:text-surface-foreground hover:bg-surface-active/30"
                        )}
                        aria-label={`${s.note}${s.octave} – ${s.frequency} Hz, string ${s.number}`}
                    >
                        <span className={cn(
                            "text-xl font-display leading-none tracking-tight transition-transform duration-300",
                            isSelected ? "scale-110" : "group-hover:scale-105"
                        )}>
                            {s.note}
                        </span>
                        <span className={cn(
                            "text-xs font-mono opacity-60 leading-none mt-0.5",
                            isSelected ? "text-accent" : "text-muted"
                        )}>
                            {subscript(s.octave)}
                        </span>
                        
                        {/* String Number badge */}
                        <div className={cn(
                            "absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center transition-all",
                            isSelected ? "bg-accent text-accent-foreground" : "bg-muted text-surface/80 opacity-0 group-hover:opacity-100"
                        )}>
                            {s.number}
                        </div>
                    </ToggleGroup.Item>
                );
            })}
        </ToggleGroup.Root>
    );
}