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
    { type: 'bass', icon: Music }, // Bass often represented by general music icon or I can stick to labels
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
            className="inline-flex bg-surface-muted p-1 rounded-2xl shadow-glass-sm"
            aria-label="Select instrument"
        >
            {INSTRUMENTS.map(({ type, icon: Icon }) => {
                const isActive = selected === type;
                return (
                    <ToggleGroup.Item
                        key={type}
                        value={type}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 rounded-xl font-ui font-bold text-xs tracking-widest uppercase transition-all duration-300 outline-none",
                            "hover:bg-surface-active/50 focus-visible:ring-2 focus-visible:ring-accent",
                            isActive 
                                ? "bg-surface-active text-surface-foreground shadow-glass-md ring-1 ring-white/10" 
                                : "text-muted hover:text-surface-foreground/80"
                        )}
                    >
                        <Icon size={16} className={cn("transition-colors", isActive ? "text-accent" : "text-muted")} />
                        {STANDARD_TUNINGS[type].label}
                    </ToggleGroup.Item>
                );
            })}
        </ToggleGroup.Root>
    );
}