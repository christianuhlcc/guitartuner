/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstrumentSelector from '../components/InstrumentSelector';
import NoteDisplay from '../components/NoteDisplay';
import TunerMeter from '../components/TunerMeter';
import { STANDARD_TUNINGS, findOpenString } from '../lib/tunings';

describe('Instrument selector UI', () => {
    describe('InstrumentSelector', () => {
        it('applies navy blue styling (bg-[#1e3a8a]) to the active instrument', () => {
            const onChange = jest.fn();
            render(<InstrumentSelector selected="guitar" onChange={onChange} />);

            const guitarBtn = screen.getByRole('radio', { name: /guitar/i });
            const bassBtn = screen.getByRole('radio', { name: /bass/i });

            // In Radix UI ToggleGroup, the active item has aria-checked="true" and data-state="on"
            expect(guitarBtn).toHaveAttribute('data-state', 'on');
            expect(bassBtn).toHaveAttribute('data-state', 'off');

            // The className should include our explicit tailwind classes for the active state
            expect(guitarBtn.className).toContain('data-[state=on]:bg-[#1e3a8a]');
        });

        it('calls onChange when clicking a different instrument', async () => {
            const onChange = jest.fn();
            render(<InstrumentSelector selected="guitar" onChange={onChange} />);
            
            const bassBtn = screen.getByRole('radio', { name: /bass/i });
            await userEvent.click(bassBtn);

            expect(onChange).toHaveBeenCalledWith('bass');
        });
    });
});

describe('NoteDisplay', () => {
    const base = {
        noteName: 'C#' as string | null,
        octave: 4 as number | null,
        frequency: 277.2 as number | null,
        cents: 12 as number | null,
        isInTune: false,
        isActive: true,
        isStale: false,
        openString: null,
    };

    it('renders the note with a sharp sign and octave', () => {
        render(<NoteDisplay {...base} />);
        const note = screen.getByTestId('note-name');
        expect(note).toHaveTextContent('C♯');
        expect(screen.getByTestId('note-octave')).toHaveTextContent('4');
        expect(screen.getByText('277.2 Hz')).toBeInTheDocument();
        expect(screen.getByText('+12 cents')).toBeInTheDocument();
        expect(screen.getByText(/SHARP/)).toBeInTheDocument();
    });

    it('shows FLAT for negative cents', () => {
        render(<NoteDisplay {...base} cents={-30} />);
        expect(screen.getByText('-30 cents')).toBeInTheDocument();
        expect(screen.getByText(/FLAT/)).toBeInTheDocument();
    });

    it('shows the open-string hint when given', () => {
        const e2 = findOpenString(STANDARD_TUNINGS.guitar, 40);
        render(<NoteDisplay {...base} noteName="E" octave={2} openString={e2} />);
        expect(screen.getByTestId('open-string')).toHaveTextContent('String 6 · E2');
    });

    it('hides the open-string hint otherwise', () => {
        render(<NoteDisplay {...base} />);
        expect(screen.queryByTestId('open-string')).not.toBeInTheDocument();
    });

    it('shows "Play a string" when active without signal', () => {
        render(
            <NoteDisplay {...base} noteName={null} octave={null} frequency={null} cents={null} />,
        );
        expect(screen.getByText('Play a string')).toBeInTheDocument();
        expect(screen.getByTestId('note-name')).toHaveTextContent('—');
    });

    it('shows a dim placeholder and no prompt when idle', () => {
        render(
            <NoteDisplay
                {...base}
                isActive={false}
                noteName={null}
                octave={null}
                frequency={null}
                cents={null}
            />,
        );
        expect(screen.queryByText('Play a string')).not.toBeInTheDocument();
        expect(screen.getByTestId('note-name')).toHaveStyle({ color: '#2A2F3A' });
    });

    it('uses green when in tune, amber when close, red when far', () => {
        const { rerender } = render(<NoteDisplay {...base} isInTune cents={1} />);
        expect(screen.getByTestId('note-name')).toHaveStyle({ color: '#10B981' });
        expect(screen.getByText(/IN TUNE/)).toBeInTheDocument();
        rerender(<NoteDisplay {...base} cents={15} />);
        expect(screen.getByTestId('cents')).toHaveStyle({ color: '#F59E0B' });
        rerender(<NoteDisplay {...base} cents={40} />);
        expect(screen.getByTestId('cents')).toHaveStyle({ color: '#EF4444' });
    });

    it('dims the readout while stale', () => {
        render(<NoteDisplay {...base} isStale />);
        expect(screen.getByTestId('note-display')).toHaveStyle({ opacity: '0.5' });
    });
});

describe('TunerMeter', () => {
    it('dims the needle while stale and keeps its position', () => {
        const { container, rerender } = render(<TunerMeter cents={20} isActive isInTune={false} isStale={false} />);
        const needle = container.querySelector('line[stroke-linecap="round"][opacity]') as SVGLineElement;
        expect(needle.getAttribute('opacity')).toBe('1');
        rerender(<TunerMeter cents={20} isActive isInTune={false} isStale />);
        const stale = container.querySelector('line[stroke-linecap="round"][opacity]') as SVGLineElement;
        expect(stale.getAttribute('opacity')).toBe('0.5');
    });

    it('parks the needle dimmed at centre without signal', () => {
        const { container } = render(<TunerMeter cents={null} isActive isInTune={false} isStale={false} />);
        const needle = container.querySelector('line[stroke-linecap="round"][opacity]') as SVGLineElement;
        expect(needle.getAttribute('opacity')).toBe('0.3');
        expect(needle.parentElement?.getAttribute('transform')).toContain('rotate(0,');
    });
});
