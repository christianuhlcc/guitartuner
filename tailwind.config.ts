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
                background: '#090B0E',
                surface: {
                    DEFAULT: '#111520',
                    foreground: '#E8EAF0',
                    muted: '#1D2235',
                    active: '#2A2F45',
                    selected: '#1E3A8A', // Rich Dark Blue/Navy
                },
                accent: {
                    DEFAULT: '#10B981', // Emerald
                    foreground: '#FFFFFF',
                },
                'in-tune': '#10B981',
                sharp: '#F43F5E', // Rose-pinkish red
                flat: '#3B82F6',  // Bright blue for flat (different from sharp)
                amber: '#F59E0B',
                muted: '#4B5563',
            },
            boxShadow: {
                'glass-sm': '0 0 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
                'glass-md': '0 0 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
                'glow-accent': '0 0 15px rgba(16,185,129,0.2)',
                'glow-blue': '0 0 15px rgba(30,58,138,0.4)',
            },
            animation: {
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
};

export default config;