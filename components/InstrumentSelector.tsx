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
                return (
                    <ToggleGroup.Item
                        key={type}
                        value={type}
                        className={cn(
                            "group flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-ui font-bold text-xs tracking-widest uppercase transition-all duration-300 outline-none",
                            "text-muted hover:text-surface-foreground hover:bg-surface-active/50 focus-visible:ring-2 focus-visible:ring-accent",
                            "data-[state=on]:bg-[#1e3a8a] data-[state=on]:text-white data-[state=on]:shadow-glow-blue data-[state=on]:ring-1 data-[state=on]:ring-white/20 data-[state=on]:scale-[1.02]"
                        )}
                        data-testid={`instrument-${type}`}
                    >
                        <Icon size={16} className="transition-colors text-muted group-data-[state=on]:text-blue-200" />
                        {STANDARD_TUNINGS[type].label}
                    </ToggleGroup.Item>
                );
            })}
        </ToggleGroup.Root>
    );
}