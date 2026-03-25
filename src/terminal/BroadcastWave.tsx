'use client';
// ---------------------------------------------------------------------------
// BroadcastWave – Animated SVG sine wave.
// Reacts to threats, anomalies, deja-vu, and beat changes with distinct
// frequency, amplitude, and color signatures.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';

export type SpikeType = 'none' | 'threat' | 'anomaly' | 'dejavu' | 'smith' | 'emp';

interface Props {
  spikeType: SpikeType;
  depth?: number;  // ship depth in km (1–5); affects amplitude & frequency
}

/** Mirror of ship-systems depthSignalFactor — kept local to avoid server-module import. */
function depthSignalMult(depth: number): number {
  const d = Math.max(1, Math.min(5, depth));
  if (d <= 2) return 1.00 - 0.10 * (d - 1);   // 1.00 → 0.90
  if (d <= 3) return 0.90 - 0.15 * (d - 2);   // 0.90 → 0.75
  if (d <= 4) return 0.75 - 0.20 * (d - 3);   // 0.75 → 0.55
  return       0.55 - 0.25 * (d - 4);          // 0.55 → 0.30
}

const WIDTH = 400;
const HEIGHT = 60;

// Per-type visual parameters
const SPIKE_PARAMS: Record<SpikeType, { amp: number; freq: number; speed: number; color: string; label: string }> = {
  none:    { amp: 6,  freq: 0.040, speed: 0.06, color: '#00ff41', label: '◉ ONLINE' },
  anomaly: { amp: 18, freq: 0.028, speed: 0.05, color: '#00ccff', label: '⚡ ANOMALY' },
  threat:  { amp: 22, freq: 0.055, speed: 0.10, color: '#ff4444', label: '⚠ THREAT' },
  smith:   { amp: 28, freq: 0.065, speed: 0.13, color: '#ff0000', label: '!! SMITH CONTACT' },
  dejavu:  { amp: 14, freq: 0.032, speed: 0.04, color: '#ffcc00', label: '↺ DEJA-VU' },
  emp:     { amp: 36, freq: 0.085, speed: 0.22, color: '#00dcff', label: '⚡ EMP DISCHARGE' },
};

export function BroadcastWave({ spikeType, depth = 2.5 }: Props) {
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const phase2Ref = useRef(Math.PI); // second wave for deja-vu distortion
  const ampRef = useRef(SPIKE_PARAMS.none.amp);
  const freqRef = useRef(SPIKE_PARAMS.none.freq);
  const speedRef = useRef(SPIKE_PARAMS.none.speed);
  const [pathD, setPathD] = useState('');
  const [path2D, setPath2D] = useState('');

  useEffect(() => {
    const params = SPIKE_PARAMS[spikeType];
    // Scale amplitude and frequency by signal strength at current depth.
    // Exponential curve for dramatic contrast: depth 1→loud/fast, depth 5→nearly flat/slow.
    // signal ∈ [0.30, 1.00] → ampMult ∈ [0.45, 5.00] (~11:1 ratio), freqMult ∈ [0.88, 2.00]
    const signal   = depthSignalMult(depth);
    const ampMult  = Math.pow(signal, 2) * 5;    // depth 1→5.0×, depth 5→0.45×
    const freqMult = 0.40 + signal * 1.60;        // depth 1→2.0×, depth 5→0.88×

    const targetAmp  = params.amp  * ampMult;
    const targetFreq = params.freq * freqMult;

    function buildPath(amp: number, freq: number, phase: number): string {
      const midY = HEIGHT / 2;
      const pts: string[] = [];
      for (let x = 0; x <= WIDTH; x += 2) {
        const y = midY + amp * Math.sin(freq * x + phase);
        pts.push(`${x},${y.toFixed(1)}`);
      }
      return `M ${pts.join(' L ')}`;
    }

    function animate() {
      // Smoothly interpolate toward target params
      ampRef.current   += (targetAmp  - ampRef.current)  * 0.1;
      freqRef.current  += (targetFreq - freqRef.current) * 0.08;
      speedRef.current  = params.speed;

      phaseRef.current  += speedRef.current;
      phase2Ref.current += speedRef.current * 0.7; // slightly different speed for deja-vu

      setPathD(buildPath(ampRef.current, freqRef.current, phaseRef.current));

      // Second ghost wave only for dejavu
      if (spikeType === 'dejavu') {
        setPath2D(buildPath(ampRef.current * 0.6, freqRef.current * 1.3, phase2Ref.current));
      } else {
        setPath2D('');
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [spikeType, depth]);

  const params = SPIKE_PARAMS[spikeType];
  const isActive = spikeType !== 'none';

  return (
    <div style={{
      background: 'rgba(0,5,0,0.85)',
      border: `1px solid ${isActive ? params.color + '55' : 'rgba(0,255,65,0.2)'}`,
      borderRadius: 2,
      padding: '6px 8px',
      fontFamily: 'var(--font-mono, monospace)',
      transition: 'border-color 0.4s',
    }}>
      <div style={{
        fontSize: 9,
        color: 'rgba(0,255,65,0.5)',
        letterSpacing: '0.15em',
        marginBottom: 4,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>BROADCAST ARRAY</span>
        <span style={{
          color: params.color,
          animation: spikeType === 'smith' ? 'alert-flash 0.5s infinite' : undefined,
        }}>
          {params.label}
        </span>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        style={{ display: 'block', height: 48 }}
      >
        <line x1={0} y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2}
          stroke="rgba(0,255,65,0.08)" strokeWidth={0.5} />

        {/* Ghost wave (deja-vu only) */}
        {path2D && (
          <path d={path2D} fill="none"
            stroke={params.color} strokeWidth={0.8} opacity={0.35}
            style={{ filter: `drop-shadow(0 0 2px ${params.color})` }}
          />
        )}

        {/* Primary wave */}
        <path d={pathD} fill="none"
          stroke={params.color}
          strokeWidth={isActive ? 1.5 : 1}
          style={{
            filter: isActive
              ? `drop-shadow(0 0 5px ${params.color})`
              : 'drop-shadow(0 0 2px rgba(0,255,65,0.4))',
            transition: 'stroke 0.4s',
          }}
        />
      </svg>
    </div>
  );
}
