'use client';
// ---------------------------------------------------------------------------
// TrinityVitals – Brain scan animation + scrolling EKG heartbeat sensor.
// Health drives brain glow; fatigue drives heart rate and EKG amplitude.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/engine/game-state';

// ── EKG ────────────────────────────────────────────────────────────────────

/** Generate PQRST ECG y-value for a beat phase p ∈ [0,1] */
function ekgSample(p: number, mid: number, amp: number): number {
  if (p < 0.08) return mid - amp * 0.12 * Math.sin((p / 0.08) * Math.PI);  // P wave
  if (p < 0.28) return mid;                                                   // isoelectric
  if (p < 0.32) return mid + amp * 0.09 * ((p - 0.28) / 0.04);             // Q (small dip)
  if (p < 0.36) return mid - amp * ((p - 0.32) / 0.04);                     // R (spike up)
  if (p < 0.40) return mid - amp + amp * 1.14 * ((p - 0.36) / 0.04);       // S (sharp recovery)
  if (p < 0.43) return mid + amp * 0.07 * (1 - ((p - 0.40) / 0.03));       // return to baseline
  if (p < 0.62) return mid - amp * 0.22 * Math.sin(((p - 0.43) / 0.19) * Math.PI); // T wave
  return mid;
}

// ── Brain SVG ──────────────────────────────────────────────────────────────
// Top-down cross-section view (60 × 52 viewport)

/** Closed outer brain outline — used for clip path */
const BRAIN_CLIP =
  'M30,3 C16,3 5,13 5,25 C5,38 15,49 30,50 C45,49 55,38 55,25 C55,13 44,3 30,3 Z';

/** Visible outlines split into two hemispheres */
const LEFT_HEMI  = 'M30,3  C16,3  5,13  5,25  C5,38  15,49 30,50';
const RIGHT_HEMI = 'M30,3  C44,3  55,13 55,25 C55,38 45,49 30,50';

/** Gyri (fold) lines */
const GYRI: string[] = [
  'M10,16 C17,11 24,13 29,19',   // left frontal
  'M7,28  C15,22 22,25 29,30',   // left parietal
  'M12,40 C18,35 24,37 29,43',   // left occipital
  'M50,16 C43,11 36,13 31,19',   // right frontal
  'M53,28 C45,22 38,25 31,30',   // right parietal
  'M48,40 C42,35 36,37 31,43',   // right occipital
];

/** Bright neural nodes (x, y) */
const NODES = [
  { x: 17, y: 20 }, { x: 14, y: 32 }, { x: 22, y: 43 },
  { x: 43, y: 20 }, { x: 46, y: 32 }, { x: 38, y: 43 },
  { x: 30, y: 14 }, { x: 30, y: 38 },
];

// ── Colours ────────────────────────────────────────────────────────────────

function healthColor(h: number) {
  return h <= 20 ? '#ff3333' : h <= 40 ? '#ffcc00' : '#00ff41';
}
function stressColor(s: number) {
  return s >= 85 ? '#ff3333' : s >= 60 ? '#ff8800' : '#00ccff';
}
function ekgColor(s: number) {
  return s >= 85 ? '#ff3333' : s >= 60 ? '#ffcc00' : '#00ff41';
}
function brainColor(h: number, s: number) {
  return h <= 20 ? '#ff3333' : s >= 85 ? '#ffcc00' : '#00ff41';
}

// ── Component ──────────────────────────────────────────────────────────────

export function TrinityVitals() {
  const health  = useGameStore((s) => s.agents.trinity.health);
  const stress  = useGameStore((s) => s.agents.trinity.fatigue);
  const shockAt = useGameStore((s) => s.trinityShockAt);

  // Scan line: 0 → 52 then back to 0
  const [scanY, setScanY] = useState(0);
  // Random node pulse: index of which node is lit
  const [litNode, setLitNode] = useState(0);

  // EKG canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  // Refs read directly by animation loop (no stale-closure risk)
  const stressRef        = useRef(stress);
  const baseBpmRef       = useRef(55);
  // perf.now() timestamp of last shock — set when shockAt changes
  const shockStartRef    = useRef<number>(0);

  // baseBpm is the fatigue-derived BPM (without shock)
  const baseBpm = Math.round(55 + (stress / 100) * 90);

  useEffect(() => {
    stressRef.current  = stress;
    baseBpmRef.current = baseBpm;
  }, [stress, baseBpm]);

  // When a shock fires, record performance.now() for smooth in-loop decay
  useEffect(() => {
    if (shockAt > 0) {
      shockStartRef.current = performance.now();
    }
  }, [shockAt]);

  // Displayed BPM — adds decaying boost. scanY updates every 28ms so this re-renders often.
  const shockAgeDisplayMs = shockAt > 0 ? Math.max(0, Date.now() - shockAt) : Infinity;
  const SHOCK_BPM_DECAY   = 20_000; // 20 s
  const shockBpmBoost     = shockAgeDisplayMs < SHOCK_BPM_DECAY
    ? Math.round(65 * (1 - shockAgeDisplayMs / SHOCK_BPM_DECAY))
    : 0;
  const bpm = baseBpm + shockBpmBoost;

  const hc = healthColor(health);
  const sc = stressColor(stress);
  const ec = ekgColor(stress);
  const bc = brainColor(health, stress);

  // ── EKG canvas animation ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    const W   = canvas.width;
    const H   = canvas.height;
    const mid = H / 2;
    const buf = new Float32Array(W).fill(mid);
    let beatPhase = 0;
    let lastTs    = performance.now();
    let wHead     = 0;

    function frame(ts: number) {
      const dt = Math.min(ts - lastTs, 80);
      lastTs = ts;

      // Shock age in ms (perf.now-based so syncs with rAF `ts`)
      const shockAge = shockStartRef.current > 0 ? ts - shockStartRef.current : Infinity;

      // BPM boost: +65 at moment of shock → 0 over 20 s
      const bpmBoost    = shockAge < 20_000 ? 65 * Math.max(0, 1 - shockAge / 20_000) : 0;
      const effectiveBpm = baseBpmRef.current + bpmBoost;
      const msPerBeat    = 60_000 / Math.max(effectiveBpm, 30);

      // Amplitude boost: 2.5× at shock → 1× over first 2 s
      const ampBoost = shockAge < 2_000 ? 1 + 1.5 * Math.max(0, 1 - shockAge / 2_000) : 1;
      const amp      = H * 0.42 * (0.55 + (stressRef.current / 100) * 0.45) * ampBoost;

      // Scroll speed driven by effective BPM: 45 px/s (55 BPM) → 220 px/s (145+ BPM)
      const pxPerSec     = 45 + ((effectiveBpm - 55) / 90) * 175;
      const steps        = Math.max(1, Math.round((dt / 1000) * pxPerSec));
      const phasePerStep = (dt / steps) / msPerBeat;

      for (let i = 0; i < steps; i++) {
        beatPhase  = (beatPhase + phasePerStep) % 1;
        buf[wHead] = ekgSample(beatPhase, mid, amp);
        wHead      = (wHead + 1) % W;
      }

      // Background
      ctx.fillStyle = '#000500';
      ctx.fillRect(0, 0, W, H);

      // Centre line
      ctx.strokeStyle = 'rgba(0,255,65,0.07)';
      ctx.lineWidth   = 0.5;
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();

      // Colour: red during first 2 s of shock, yellow 2-5 s, then normal
      const color = shockAge < 2_000 ? '#ff3333'
        : shockAge < 5_000 ? '#ffaa00'
        : ekgColor(stressRef.current);
      ctx.strokeStyle = color;
      ctx.lineWidth   = shockAge < 2_000 ? 2.4 : 1.5;
      ctx.shadowBlur  = shockAge < 5_000 ? 16 : 6;
      ctx.shadowColor = color;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const s = (wHead + x) % W;
        if (x === 0) ctx.moveTo(x, buf[s]);
        else          ctx.lineTo(x, buf[s]);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Erase gap
      ctx.fillStyle = '#000500';
      ctx.fillRect(wHead % W, 0, 6, H);

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, []); // stable — reads everything via refs

  // ── Brain scan line ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setScanY((y) => (y + 1) % 54), 28);
    return () => clearInterval(id);
  }, []);

  // ── Neural node pulse ────────────────────────────────────────────────────
  useEffect(() => {
    const delay = Math.round(1500 - (stress / 100) * 900); // 1500ms (calm) → 600ms (max stress)
    const id = setInterval(
      () => setLitNode(Math.floor(Math.random() * NODES.length)),
      delay,
    );
    return () => clearInterval(id);
  }, [stress]);

  return (
    <div style={{
      background: 'rgba(0,5,0,0.85)',
      border: `1px solid ${health <= 20 ? 'rgba(255,0,0,0.4)' : 'rgba(0,255,65,0.2)'}`,
      borderRadius: 2,
      padding: '5px 7px',
      fontFamily: 'var(--font-mono, monospace)',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      {/* Header */}
      <div style={{
        fontSize: 9,
        color: 'rgba(0,255,65,0.5)',
        letterSpacing: '0.15em',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span>TRINITY BIOMETRICS</span>
        <span style={{
          color: ec,
          fontSize: 9,
          animation: bpm > 110 ? 'alert-flash 0.6s infinite' : undefined,
        }}>
          ♥ {bpm} BPM
        </span>
      </div>

      {/* Content row */}
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0, alignItems: 'stretch' }}>

        {/* ── Brain SVG ── */}
        <svg
          width={62}
          viewBox="0 0 60 54"
          preserveAspectRatio="xMidYMid meet"
          style={{
            flexShrink: 0,
            overflow: 'visible',
            filter: `drop-shadow(0 0 5px ${bc}44)`,
          }}
        >
          <defs>
            <clipPath id="bclip">
              <path d={BRAIN_CLIP} />
            </clipPath>
            <radialGradient id="scangrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={bc} stopOpacity="0.18" />
              <stop offset="100%" stopColor={bc} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Hemispheres */}
          <path d={LEFT_HEMI}  fill="none" stroke={bc} strokeWidth="1.2" opacity="0.75" />
          <path d={RIGHT_HEMI} fill="none" stroke={bc} strokeWidth="1.2" opacity="0.75" />

          {/* Central fissure */}
          <line x1="30" y1="3" x2="30" y2="50" stroke={bc} strokeWidth="0.5" opacity="0.3" />

          {/* Gyri */}
          {GYRI.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={bc} strokeWidth="0.7" opacity="0.4" />
          ))}

          {/* Neural nodes */}
          {NODES.map((n, i) => (
            <circle
              key={i}
              cx={n.x} cy={n.y} r={i === litNode ? 2 : 1}
              fill={bc}
              opacity={i === litNode ? 0.9 : 0.25}
              style={{
                filter: i === litNode ? `drop-shadow(0 0 3px ${bc})` : undefined,
                transition: 'opacity 0.15s, r 0.15s',
              }}
            />
          ))}

          {/* Scan glow halo */}
          <rect
            x="5" y={Math.max(3, scanY - 5)} width="50" height="10"
            fill={bc}
            opacity="0.06"
            clipPath="url(#bclip)"
          />

          {/* Scan line */}
          <line
            x1="5"  y1={scanY}
            x2="55" y2={scanY}
            stroke={bc}
            strokeWidth="0.9"
            opacity="0.65"
            clipPath="url(#bclip)"
            style={{ filter: `drop-shadow(0 0 2px ${bc})` }}
          />
        </svg>

        {/* ── Right panel: EKG + stat bars ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          {/* EKG canvas — fills flex space */}
          <div style={{ flex: 1, minHeight: 28, position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={240}
              height={60}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                borderRadius: 1,
              }}
            />
          </div>

          {/* Stat bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
            <SegBar label="HP" value={health} color={hc} segments={10} />
            <SegBar label="ST" value={stress}  color={sc} segments={10} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SegBar({ label, value, color, segments }: {
  label: string; value: number; color: string; segments: number;
}) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 8, color: 'rgba(0,255,65,0.45)', width: 14, letterSpacing: '0.05em' }}>
        {label}
      </span>
      {Array.from({ length: segments }, (_, i) => (
        <div key={i} style={{
          flex: 1,
          height: 5,
          background: i < filled ? color : 'rgba(0,255,65,0.07)',
          boxShadow: i < filled ? `0 0 3px ${color}88` : 'none',
        }} />
      ))}
      <span style={{ fontSize: 8, color, marginLeft: 3, minWidth: 26, textAlign: 'right' }}>
        {value}%
      </span>
    </div>
  );
}
