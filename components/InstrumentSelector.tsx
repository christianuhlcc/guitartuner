'use client';

import { InstrumentType, STANDARD_TUNINGS } from '@/lib/tunings';

interface InstrumentSelectorProps {
    selected: InstrumentType;
    onChange: (instrument: InstrumentType) => void;
}

const INSTRUMENTS: InstrumentType[] = ['guitar', 'bass'];

export default function InstrumentSelector({
    selected,
    onChange,
}: InstrumentSelectorProps) {
    return (
        <div
            className="flex bg-surface rounded-full p-1 gap-1"
            role="radiogroup"
            aria-label="Instrument selection"
        >
            {INSTRUMENTS.map((type) => {
                const isActive = selected === type;
                return (
                    <button
                        key={type}
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onChange(type)}
                        className="relative px-6 py-2 rounded-full font-ui font-semibold text-sm tracking-widest uppercase transition-all duration-200"
                        style={{
                            backgroundColor: isActive ? '#1D2235' : 'transparent',
                            color: isActive ? '#E8EAF0' : '#4B5563',
                            boxShadow: isActive
                                ? '0 0 0 1px rgba(255,255,255,0.07)'
                                : undefined,
                        }}
                    >
                        {STANDARD_TUNINGS[type].label}
                    </button>
                );
            })}
        </div>
    );
}