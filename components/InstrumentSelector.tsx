'use client';

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { InstrumentType, STANDARD_TUNINGS } from '@/lib/tunings';
import { Guitar, Music } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InstrumentSelectorProps {
    selected: InstrumentType;
    onChange: (instrument: InstrumentType) => void;
}

const INSTRUMENTS: { type: InstrumentType; icon: any }[] = [
    { type: 'guitar', icon: Guitar },
    { type: 'bass', icon: Music },
];

export default function InstrumentSelector({
    selected,
    onChange,
}: InstrumentSelectorProps) {
    return (
        <ToggleGroup.Root
            type="single"
            value={selected}
            onValueChange={(value) => {
                if (value) onChange(value as InstrumentType);
            }}
            className="flex w-full bg-surface-muted p-1 rounded-2xl border border-white/5 shadow-glass-sm"
            aria-label="Select instrument"
        >
            {INSTRUMENTS.map(({ type, icon: Icon }) => {
                const isActive = selected === type;
                return (
                    <ToggleGroup.Item
                        key={type}
                        value={type}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-ui font-bold text-xs tracking-widest uppercase transition-all duration-300 outline-none",
                            "hover:bg-surface-active/50 focus-visible:ring-2 focus-visible:ring-accent",
                            isActive 
                                ? "bg-accent text-accent-foreground shadow-glow-accent ring-1 ring-accent" 
                                : "text-muted hover:text-surface-foreground/80"
                        )}
                    >
                        <Icon size={16} className={cn("transition-colors", isActive ? "text-accent-foreground" : "text-muted")} />
                        {STANDARD_TUNINGS[type].label}
                    </ToggleGroup.Item>
                );
            })}
        </ToggleGroup.Root>
    );
}