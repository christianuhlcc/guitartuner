import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['var(--font-bebas-neue)', 'sans-serif'],
                mono: ['var(--font-jetbrains-mono)', 'monospace'],
                ui: ['var(--font-barlow-condensed)', 'sans-serif'],
            },
            colors: {
                surface: '#111520',
                'in-tune': '#10B981',
                sharp: '#EF4444',
                flat: '#EF4444',
                amber: '#F59E0B',
                muted: '#3A3F4A',
            },
        },
    },
    plugins: [],
};

export default config;