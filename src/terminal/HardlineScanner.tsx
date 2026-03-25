'use client';
// ---------------------------------------------------------------------------
// HardlineScanner – Frequency spectrum analyzer scanning for phone hardlines.
// Matrix lore: a landline phone is the only extraction point. The operator
// monitors frequencies to lock Trinity's exit route. Smith proximity causes
// interference. Beat = 'extraction' locks the target frequency in bright.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/engine/game-state';

const CW = 168;   // canvas width
const CH = 138;   // canvas height

const NUM_BARS  = 42;          // frequency bins
const TARGET    = 27;          // index of the target hardline frequency
const BAR_W     = CW / NUM_BARS - 0.8;
const LOCK_BEATS = new Set(['phone_approach', 'extraction', 'complete']);

// Stable per-bin base noise heights (normalised 0–1)
const BASE_NOISE = Array.from({ length: NUM_BARS }, (_, i) =>
  0.06 + 0.18 * Math.abs(Math.sin(i * 3.17 + 0.9)),
);

/** Mirror of ship-systems depthSignalFactor — kept local to avoid server-module import. */
function depthSignalMult(depth: number): number {
  const d = Math.max(1, Math.min(5, depth));
  if (d <= 2) return 1.00 - 0.10 * (d - 1);
  if (d <= 3) return 0.90 - 0.15 * (d - 2);
  if (d <= 4) return 0.75 - 0.20 * (d - 3);
  return       0.55 - 0.25 * (d - 4);
}

export function HardlineScanner() {
  const missionBeat = useGameStore((s) => s.missionBeat);
  const smithDist   = useGameStore((s) => s.smithDistance);
  const shipDepth   = useGameStore((s) => s.ship.depth);

  const beatRef    = useRef(missionBeat);
  const smithRef   = useRef(smithDist);
  const depthRef   = useRef(shipDepth);
  const empStartRef = useRef(0); // performance.now() when last EMP fired, 0 = none
  useEffect(() => {
    beatRef.current  = missionBeat;
    smithRef.current = smithDist;
    depthRef.current = shipDepth;
  }, [missionBeat, smithDist, shipDepth]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    // Per-bin phase offsets for independent oscillation
    const phases = Array.from({ length: NUM_BARS }, (_, i) => i * 0.43 + 1.1);

    // Detect new emp_fired events via store subscription (no selector middleware needed)
    let lastSeenEmpCount = useGameStore.getState().events.filter((e) => e.type === 'emp_fired').length;
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      const count = state.events.filter((e) => e.type === 'emp_fired').length;
      const prevCount = prevState.events.filter((e) => e.type === 'emp_fired').length;
      if (count > prevCount) {
        lastSeenEmpCount = count;
        empStartRef.current = performance.now();
      }
    });

    function frame(ts: number) {
      const t        = ts / 1000;
      const beat     = beatRef.current;
      const smith    = smithRef.current;
      const locking  = LOCK_BEATS.has(beat);
      const locked   = beat === 'extraction' || beat === 'complete';

      // Depth: shallow = strong clean signal, deep = weak + noisy
      const signal    = depthSignalMult(depthRef.current);
      // signal^1.5 gives ~6:1 contrast between depth 1 and depth 5
      const barScale  = Math.pow(signal, 1.5) * 1.5;   // depth 1→1.50×, depth 5→0.25×
      // Extra static noise floor at deep depths (inverted signal)
      const noiseFloor = Math.max(0, (1 - signal) * 0.22);

      // EMP surge: all bars spike to near-max in cyan for 2s then decay
      const empElapsed = empStartRef.current > 0 ? performance.now() - empStartRef.current : Infinity;
      const empIntensity = empElapsed < 2000 ? Math.max(0, 1 - empElapsed / 2000) : 0;

      // How strongly the target signal is showing (0 → 1)
      const targetStrength =
        locked   ? 0.82 + 0.18 * Math.sin(t * 4.2) :
        locking  ? 0.45 + 0.25 * Math.sin(t * 2.8) :
        0.15 + 0.10 * Math.sin(t * 1.1);

      // Smith interference: nearby Smiths add random spikes to random bins
      const interference = Math.max(0, (8 - smith) / 8);  // 0 (far) → 1 (contact)

      ctx.fillStyle = '#000400';
      ctx.fillRect(0, 0, CW, CH);

      // Frequency axis line
      ctx.strokeStyle = 'rgba(0,255,65,0.12)';
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, CH - 12);
      ctx.lineTo(CW, CH - 12);
      ctx.stroke();

      // Draw bars
      for (let i = 0; i < NUM_BARS; i++) {
        const isTarget = i === TARGET;

        // Base oscillation for this bin
        const osc  = Math.sin(t * (0.8 + i * 0.07) + phases[i]) * 0.5 + 0.5;
        let h      = BASE_NOISE[i] * osc * barScale;

        // Deep-depth static: random noise floor when signal is weak
        if (noiseFloor > 0.01) {
          const staticSeed = Math.sin(i * 7.91 + Math.floor(t * 12) * 1.3) * 0.5 + 0.5;
          h += noiseFloor * staticSeed;
        }

        // Smith interference: random bins spike
        if (interference > 0.02) {
          const seed    = Math.sin(i * 17.3 + Math.floor(t * 6) * 0.9) * 0.5 + 0.5;
          const spikeFn = seed < interference * 0.6;
          if (spikeFn) h += interference * 0.35 * seed;
        }

        // Target hardline signal — also attenuated at depth
        if (isTarget) {
          h = (targetStrength + (locked ? 0.05 * Math.sin(t * 8) : 0.04 * osc)) * barScale;
        }

        // Adjacent bins bleed a little from target (realistic sidelobes)
        if (Math.abs(i - TARGET) === 1) h += targetStrength * 0.22;
        if (Math.abs(i - TARGET) === 2) h += targetStrength * 0.09;

        // EMP surge overrides bar height
        if (empIntensity > 0) {
          const surge = 0.55 + 0.43 * Math.abs(Math.sin(i * 1.7 + ts * 0.003));
          h = Math.max(h, surge * empIntensity + h * (1 - empIntensity));
        }

        h = Math.min(h, 0.98);

        const barH  = Math.max(1, h * (CH - 16));
        const x     = i * (BAR_W + 0.8);
        const y     = CH - 12 - barH;

        if (empIntensity > 0.05 && !isTarget) {
          // EMP surge: all non-target bars go cyan/white
          const alpha = (0.5 + 0.5 * empIntensity).toFixed(2);
          const g = Math.round(200 + 55 * empIntensity);
          ctx.fillStyle = `rgba(0,${g},${Math.round(200 + 55 * empIntensity)},${alpha})`;
          if (empIntensity > 0.6) {
            ctx.shadowBlur  = 6 * empIntensity;
            ctx.shadowColor = '#00dcff';
          }
          ctx.fillRect(x, y, BAR_W, barH);
          ctx.shadowBlur = 0;
        } else if (isTarget) {
          // Target: cyan/green glow, colour shifts on lock
          const tc = locked ? '#00ffcc' : locking ? '#00ddff' : 'rgba(0,200,255,0.7)';
          ctx.fillStyle = tc;
          if (locked || locking) {
            ctx.shadowBlur  = locked ? 14 : 7;
            ctx.shadowColor = tc;
          }
          ctx.fillRect(x, y, BAR_W, barH);
          ctx.shadowBlur = 0;
        } else if (interference > 0.35 && h > 0.28) {
          // Interference spike: amber/red
          const f = Math.min((h - 0.28) / 0.6, 1);
          ctx.fillStyle = `rgba(${Math.round(180 + 75 * f)},${Math.round(80 - 60 * f)},0,0.75)`;
          ctx.fillRect(x, y, BAR_W, barH);
        } else {
          // Normal noise: dim green
          const alpha = 0.18 + h * 0.45;
          ctx.fillStyle = `rgba(0,${Math.round(180 + 55 * h)},30,${alpha.toFixed(2)})`;
          ctx.fillRect(x, y, BAR_W, barH);
        }

        // Tick mark at base
        ctx.fillStyle = 'rgba(0,255,65,0.12)';
        ctx.fillRect(x + BAR_W / 2 - 0.4, CH - 12, 0.8, 3);
      }

      // Frequency label under target bin
      const targetX = TARGET * (BAR_W + 0.8) + BAR_W / 2;
      const labelColor = locked ? '#00ffcc' : locking ? '#00ddff' : 'rgba(0,180,255,0.55)';
      ctx.fillStyle = labelColor;
      ctx.font      = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▲', targetX, CH - 1);

      // Sweep cursor: a thin vertical line that scans left→right every 3s
      const sweepX = ((t % 3) / 3) * CW;
      ctx.strokeStyle = 'rgba(0,255,65,0.08)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(sweepX, 0);
      ctx.lineTo(sweepX, CH - 12);
      ctx.stroke();

      // Status text top-right
      const statusText =
        locked   ? 'LOCKED' :
        locking  ? 'ACQUIRING' :
        'SCANNING';
      const statusColor =
        locked  ? '#00ffcc' :
        locking ? '#00ddff' :
        'rgba(0,255,65,0.4)';
      ctx.fillStyle = statusColor;
      ctx.font      = '6px monospace';
      ctx.textAlign = 'right';
      if (locked) {
        ctx.shadowBlur  = 8;
        ctx.shadowColor = '#00ffcc';
      }
      ctx.fillText(statusText, CW - 2, 9);
      ctx.shadowBlur = 0;

      // Frequency range label bottom-left
      ctx.fillStyle = 'rgba(0,255,65,0.20)';
      ctx.font      = '6px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('0.1 kHz', 2, CH - 1);
      ctx.textAlign = 'right';
      ctx.fillText('9.9 kHz', CW - 2, CH - 1);

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animRef.current);
      unsubscribe();
    };
  }, []);

  const isLocked  = missionBeat === 'extraction' || missionBeat === 'complete';
  const isLocking = LOCK_BEATS.has(missionBeat);

  return (
    <div style={{
      background: 'rgba(0,5,0,0.85)',
      border: `1px solid ${isLocked ? 'rgba(0,255,200,0.35)' : 'rgba(0,255,65,0.2)'}`,
      borderRadius: 2,
      padding: '5px 7px',
      fontFamily: 'var(--font-mono, monospace)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        fontSize: 9,
        color: isLocked ? 'rgba(0,255,200,0.7)' : 'rgba(0,255,65,0.5)',
        letterSpacing: '0.15em',
        marginBottom: 3,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>FREQUENCY ARRAY</span>
        <span style={{
          color: isLocking ? (isLocked ? '#00ffcc' : '#00ddff') : 'rgba(0,255,65,0.4)',
          animation: isLocked ? 'alert-flash 1.2s infinite' : undefined,
        }}>
          {isLocked ? '◈ HARDLINE' : '◈ SCANNING'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        style={{ display: 'block', width: CW, height: CH, flexShrink: 0 }}
      />
    </div>
  );
}
