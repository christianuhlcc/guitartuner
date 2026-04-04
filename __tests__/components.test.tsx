/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstrumentSelector from '../components/InstrumentSelector';
import StringSelector from '../components/StringSelector';
import { STANDARD_TUNINGS } from '../lib/tunings';

describe('Selectors UI', () => {
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

    describe('StringSelector', () => {
        it('applies navy blue styling (bg-[#1e3a8a]) to the active string', () => {
            const onSelect = jest.fn();
            const strings = STANDARD_TUNINGS['guitar'].strings;
            
            render(
                <StringSelector 
                    instrument="guitar" 
                    strings={strings} 
                    selectedIndex={0} 
                    onSelect={onSelect} 
                />
            );

            // Get the first item by test id
            const firstStringBtn = screen.getByTestId('string-0');
            const secondStringBtn = screen.getByTestId('string-1');

            expect(firstStringBtn).toHaveAttribute('data-state', 'on');
            expect(secondStringBtn).toHaveAttribute('data-state', 'off');

            // Verify our custom tailwind classes for the active state are present
            expect(firstStringBtn.className).toContain('data-[state=on]:bg-[#1e3a8a]');
        });

        it('calls onSelect when clicking a different string', async () => {
            const onSelect = jest.fn();
            const strings = STANDARD_TUNINGS['guitar'].strings;
            
            render(
                <StringSelector 
                    instrument="guitar" 
                    strings={strings} 
                    selectedIndex={0} 
                    onSelect={onSelect} 
                />
            );
            
            const secondStringBtn = screen.getByTestId('string-1');
            await userEvent.click(secondStringBtn);

            expect(onSelect).toHaveBeenCalledWith(1);
        });
    });
});
