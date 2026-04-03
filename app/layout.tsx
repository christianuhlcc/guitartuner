import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, JetBrains_Mono, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const bebasNeue = Bebas_Neue({
    weight: '400',
    subsets: ['latin'],
    variable: '--font-bebas-neue',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-jetbrains-mono',
    display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
    weight: ['400', '600', '700'],
    subsets: ['latin'],
    variable: '--font-barlow-condensed',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Chromatic Tuner | Precision Guitar & Bass',
    description: 'A professional-grade, mobile-friendly tuner in your browser. Features sub-cent pitch detection and standard tunings.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Tuner',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#090B0E',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="en"
            className={`${bebasNeue.variable} ${jetbrainsMono.variable} ${barlowCondensed.variable}`}
        >
            <body className="antialiased selection:bg-emerald-500/30">{children}</body>
        </html>
    );
}