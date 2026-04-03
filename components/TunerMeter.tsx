'use client';

import React from 'react';

// ─── Gauge geometry ───────────────────────────────────────────────────────────

const CX = 150;           // SVG centre x
const CY = 175;           // SVG centre y (near bottom so arc curves upward)
const R = 130;            // Arc radius
const NEEDLE_LEN = 112;   // Needle length (px, < R)
const MIN_ANGLE = 215;    // Degrees at -50 cents (upper-left)
const MAX_ANGLE = 325;    // Degrees at +50 cents (upper-right)
const ANGLE_RANGE = MAX_ANGLE - MIN_ANGLE; // 110°

// ─── Helpers ─────────────────────────────────────────────────────────────────

function polarToCartesian(r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** Returns an SVG arc path string. Angles are in degrees (SVG convention). */
function arcPath(r: number, startAngle: number, endAngle: number): string {
    const s = polarToCartesian(r, startAngle);
    const e = polarToCartesian(r, endAngle);
    const span = endAngle - startAngle;
    const large = Math.abs(span) > 180 ? 1 : 0;
    const sweep = span > 0 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/** Map a cents value (-50…+50) to an SVG rotation angle (degrees). */
function centsToRotation(cents: number): number {
    const clamped = Math.max(-50, Math.min(50, cents));
    // Map -50…+50 → MIN_ANGLE…MAX_ANGLE, then offset from straight-up (270°)
    const targetAngle = MIN_ANGLE + ((clamped + 50) / 100) * ANGLE_RANGE;
    return targetAngle - 270;
}

// ─── Zone arc segments ────────────────────────────────────────────────────────
// Defined as [startCents, endCents, color] triples for decorative zones.

type Zone = { start: number; end: number; color: string };

const ZONES: Zone[] = [
    { start: -50, end: -20, color: '#EF444488' },   // flat – red
    { start: -20, end: -5, color: '#F59E0B88' },   // close – amber
    { start: -5, end: 5, color: '#10B98188' },   // in-tune – green
    { start: 5, end: 20, color: '#F59E0B88' },   // close – amber
    { start: 20, end: 50, color: '#EF444488' },   // sharp – red
];

function zoneAngle(cents: number): number {
    return MIN_ANGLE + ((cents + 50) / 100) * ANGLE_RANGE;
}

// ─── Tick marks ───────────────────────────────────────────────────────────────

const TICKS: { cents: number; major: boolean }[] = [
    { cents: -50, major: true },
    { cents: -40, major: false },
    { cents: -30, major: false },
    { cents: -20, major: true },
    { cents: -10, major: false },
    { cents: 0, major: true },
    { cents: 10, major: false },
    { cents: 20, major: true },
    { cents: 30, major: false },
    { cents: 40, major: false },
    { cents: 50, major: true },
];

// ─── Needle colour based on cents deviation ───────────────────────────────────

function needleColor(cents: number | null, isInTune: boolean): string {
    if (cents === null) return '#3A3F4A';
    if (isInTune) return '#10B981';
    if (Math.abs(cents) <= 20) return '#F59E0B';
    return '#EF4444';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TunerMeterProps {
    /** Smoothed cents deviation in range -50…+50 (null = no signal). */
    cents: number | null;
    isActive: boolean;
    isInTune: boolean;
}

export default function TunerMeter({ cents, isActive, isInTune }: TunerMeterProps) {
    const rotation = centsToRotation(cents ?? 0);
    const color = needleColor(cents, isInTune);
    const hasSignal = isActive && cents !== null;

    return (
        <svg
            viewBox="0 0 300 190"
            className="w-full select-none"
            aria-label="Tuning meter"
            role="img"
        >
            <defs>
                {/* Glow filter for in-tune state */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                {/* Subtle glow for needle */}
                <filter id="needle-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* ── Background track arc ─────────────────────────────────────── */}
            <path
                d={arcPath(R, MIN_ANGLE, MAX_ANGLE)}
                fill="none"
                stroke="#1E2535"
                strokeWidth={18}
                strokeLinecap="round"
            />

            {/* ── Coloured zone arcs (overlay on track) ───────────────────── */}
            {hasSignal &&
                ZONES.map((z, i) => (
                    <path
                        key={i}
                        d={arcPath(R, zoneAngle(z.start), zoneAngle(z.end))}
                        fill="none"
                        stroke={z.color}
                        strokeWidth={18}
                    />
                ))}

            {/* ── Tick marks ──────────────────────────────────────────────── */}
            {TICKS.map(({ cents: tc, major }) => {
                const angle = zoneAngle(tc);
                const inner = polarToCartesian(major ? R - 20 : R - 12, angle);
                const outer = polarToCartesian(R + 1, angle);
                return (
                    <line
                        key={tc}
                        x1={inner.x}
                        y1={inner.y}
                        x2={outer.x}
                        y2={outer.y}
                        stroke={tc === 0 ? '#6B7280' : '#374151'}
                        strokeWidth={major ? 2 : 1.2}
                        strokeLinecap="round"
                    />
                );
            })}

            {/* ── Centre tick label ────────────────────────────────────────── */}
            {(() => {
                const top = polarToCartesian(R - 30, 270);
                return (
                    <text
                        x={top.x}
                        y={top.y + 5}
                        textAnchor="middle"
                        fill="#4B5563"
                        fontSize="10"
                        fontFamily="var(--font-jetbrains-mono, monospace)"
                    >
                        0
                    </text>
                );
            })()}

            {/* ── "FLAT" / "SHARP" labels ──────────────────────────────────── */}
            {(() => {
                const leftPt = polarToCartesian(R - 26, MIN_ANGLE);
                const rightPt = polarToCartesian(R - 26, MAX_ANGLE);
                return (
                    <>
                        <text
                            x={leftPt.x - 6}
                            y={leftPt.y + 4}
                            textAnchor="end"
                            fill="#374151"
                            fontSize="9"
                            fontFamily="var(--font-barlow-condensed, sans-serif)"
                            letterSpacing="0.5"
                        >
                            FLAT
                        </text>
                        <text
                            x={rightPt.x + 6}
                            y={rightPt.y + 4}
                            textAnchor="start"
                            fill="#374151"
                            fontSize="9"
                            fontFamily="var(--font-barlow-condensed, sans-serif)"
                            letterSpacing="0.5"
                        >
                            SHARP
                        </text>
                    </>
                );
            })()}

            {/* ── Needle (rotates around pivot) ───────────────────────────── */}
            <g
                transform={`rotate(${rotation}, ${CX}, ${CY})`}
                style={{ transition: 'transform 0.08s ease-out' }}
                filter={isInTune ? 'url(#needle-glow)' : undefined}
            >
                {/* Needle line */}
                <line
                    x1={CX}
                    y1={CY + 10}
                    x2={CX}
                    y2={CY - NEEDLE_LEN}
                    stroke={color}
                    strokeWidth={hasSignal ? 2.5 : 1.5}
                    strokeLinecap="round"
                    opacity={hasSignal ? 1 : 0.3}
                    style={{ transition: 'stroke 0.15s, opacity 0.2s' }}
                />
                {/* Needle tip diamond */}
                <polygon
                    points={`${CX},${CY - NEEDLE_LEN - 6} ${CX - 3},${CY - NEEDLE_LEN + 4} ${CX + 3},${CY - NEEDLE_LEN + 4}`}
                    fill={color}
                    opacity={hasSignal ? 1 : 0.3}
                    style={{ transition: 'fill 0.15s, opacity 0.2s' }}
                />
            </g>

            {/* ── Pivot circle ─────────────────────────────────────────────── */}
            <circle
                cx={CX}
                cy={CY}
                r={7}
                fill="#0A0C10"
                stroke={hasSignal ? color : '#374151'}
                strokeWidth={2}
                style={{ transition: 'stroke 0.15s' }}
                filter={isInTune && hasSignal ? 'url(#glow)' : undefined}
            />
            <circle cx={CX} cy={CY} r={2.5} fill={hasSignal ? color : '#374151'} />
        </svg>
    );
}