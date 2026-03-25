'use client';
// ---------------------------------------------------------------------------
// DepthGauge – Circular proximity sonar.
// Neb sits at centre in the green safe zone; sentinels orbit in the outer
// red danger ring. A sonar ping sweeps outward every 4 s — contacts light
// up as the ring passes through them, then slowly fade.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/engine/game-state';

// ── Canvas / sonar geometry ──────────────────────────────────────────────────
const CW     = 172;          // canvas width  (px)
const CH     = 130;          // canvas height (px)
const CX     = CW / 2;       // 86
const CY     = CH / 2;       // 65
const MAX_R  = 60;           // outer radius of sonar disc
const PING_S = 4;            // ping period (seconds)

// Zone thresholds (fraction of MAX_R)
const SAFE_FRAC  = 0.42;     // 0 – 42 % → green
const TRACE_FRAC = 0.68;     // 42 – 68 % → amber
// > 68 %  → red danger

const SAFE_R  = MAX_R * SAFE_FRAC;   // ~20 px
const TRACE_R = MAX_R * TRACE_FRAC;  // ~33 px

// ── Deterministic sentinel contacts ─────────────────────────────────────────
// All placed in the red danger ring (radiusFrac 0.72 – 0.91).
// Very slow angular + radial drift keeps the display alive.
const PATROLS = [
  { angle: 0.30, radiusFrac: 0.78, driftPeriod: 25, driftPhase: 0.0 },
  { angle: 1.80, radiusFrac: 0.85, driftPeriod: 30, driftPhase: 1.2 },
  { angle: 3.50, radiusFrac: 0.73, driftPeriod: 20, driftPhase: 2.4 },
  { angle: 4.90, radiusFrac: 0.91, driftPeriod: 35, driftPhase: 0.8 },
  { angle: 5.75, radiusFrac: 0.80, driftPeriod: 28, driftPhase: 3.1 },
] as const;

// ── Tiny Neb hovership icon ───────────────────────────────────────────────────
function drawNeb(ctx: CanvasRenderingContext2D) {
  const x = CX, y = CY;
  ctx.save();
  ctx.strokeStyle = '#00ff41';
  ctx.fillStyle   = 'rgba(0,14,3,0.97)';
  ctx.lineWidth   = 1;

  // Angular hull body
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 2);
  ctx.lineTo(x + 5, y - 2);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x + 5, y + 2);
  ctx.lineTo(x - 8, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Downward thruster glow lines (3 pods)
  ctx.strokeStyle = 'rgba(0,210,170,0.75)';
  ctx.lineWidth   = 1.5;
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y + 2);
    ctx.lineTo(x + dx, y + 5);
    ctx.stroke();
  }

  // NEB label above
  ctx.fillStyle = 'rgba(0,255,65,0.45)';
  ctx.font      = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NEB', x, y - 5);

  ctx.restore();
}

// EMP animation constants
const EMP_ANIM_MS = 2200;
const EMP_RINGS   = 3;

// ── Component ────────────────────────────────────────────────────────────────
export function DepthGauge() {
  const depth         = useGameStore((s) => s.ship.depth);
  const sentinelDistM = useGameStore((s) => s.ship.sentinelDistance);
  const empFired      = useGameStore((s) => s.empFired);

  const depthRef   = useRef(depth);
  depthRef.current = depth;
  const sentRef    = useRef(sentinelDistM);
  sentRef.current  = sentinelDistM;

  const empAnimRef = useRef<number | null>(null);
  const [empPulsing, setEmpPulsing] = useState(false);

  // When empFired becomes true, start EMP animation
  useEffect(() => {
    if (empFired) {
      empAnimRef.current = performance.now();
      setEmpPulsing(true);
      setTimeout(() => setEmpPulsing(false), EMP_ANIM_MS + 200);
    }
  }, [empFired]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    function frame(ts: number) {
      const t         = ts / 1000;
      const ship      = useGameStore.getState().ship;
      const sentDist  = ship.sentinelDistance;
      const sentNum   = ship.sentinelCount ?? 0;
      const pingPhase = (t % PING_S) / PING_S;  // 0 → 1
      const pingR     = pingPhase * MAX_R;
      const pingAlpha = Math.max(0, 1 - pingPhase) * 0.70;

      // EMP animation progress
      const empStart   = empAnimRef.current;
      const empElapsed = empStart !== null ? ts - empStart : -1;
      const empProgress = (empElapsed >= 0 && empElapsed < EMP_ANIM_MS)
        ? empElapsed / EMP_ANIM_MS
        : -1;
      if (empElapsed >= EMP_ANIM_MS) empAnimRef.current = null;

      ctx.fillStyle = '#000300';
      ctx.fillRect(0, 0, CW, CH);

      // ── Zone filled discs (draw outside-in for correct painter order) ─────
      ctx.beginPath();
      ctx.arc(CX, CY, MAX_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(38,4,0,0.88)';       // red outer
      ctx.fill();

      ctx.beginPath();
      ctx.arc(CX, CY, TRACE_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(30,18,0,0.88)';       // amber mid
      ctx.fill();

      ctx.beginPath();
      ctx.arc(CX, CY, SAFE_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,22,6,0.90)';        // green inner
      ctx.fill();

      // ── Concentric grid lines ─────────────────────────────────────────────
      ctx.lineWidth   = 0.35;
      ctx.strokeStyle = 'rgba(0,255,65,0.09)';
      for (let r = 10; r < MAX_R; r += 10) {
        ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
      }

      // ── Crosshair ─────────────────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(0,255,65,0.09)';
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(CX - MAX_R, CY); ctx.lineTo(CX + MAX_R, CY);
      ctx.moveTo(CX, CY - MAX_R); ctx.lineTo(CX, CY + MAX_R);
      ctx.stroke();

      // ── Zone boundary rings (dashed) ──────────────────────────────────────
      ctx.setLineDash([4, 4]);
      ctx.lineWidth   = 0.7;
      ctx.strokeStyle = 'rgba(255,190,0,0.22)';
      ctx.beginPath(); ctx.arc(CX, CY, TRACE_R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,50,0,0.28)';
      ctx.beginPath(); ctx.arc(CX, CY, MAX_R, 0, Math.PI * 2);   ctx.stroke();
      ctx.setLineDash([]);

      // ── Sonar ping ring ───────────────────────────────────────────────────
      if (pingAlpha > 0.01) {
        ctx.strokeStyle = `rgba(0,255,65,${pingAlpha.toFixed(3)})`;
        ctx.lineWidth   = 1.1;
        ctx.shadowBlur  = 6;
        ctx.shadowColor = '#00ff41';
        ctx.beginPath();
        ctx.arc(CX, CY, pingR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Sentinel contacts — only draw sentNum (alive) blips ──────────────
      for (let i = 0; i < sentNum && i < PATROLS.length; i++) {
        const p = PATROLS[i];
        // Slow drift: ±0.14 rad angular, ±3% radial
        const curAngle  = p.angle + Math.sin(t / p.driftPeriod + p.driftPhase) * 0.14;
        const curR      = p.radiusFrac * MAX_R
                        + Math.cos(t / p.driftPeriod * 1.3 + p.driftPhase) * MAX_R * 0.03;
        const sx = CX + Math.cos(curAngle) * curR;
        const sy = CY + Math.sin(curAngle) * curR;

        const distFromCenter = Math.sqrt((sx - CX) ** 2 + (sy - CY) ** 2);
        const scanned = Math.abs(distFromCenter - pingR) < 7 && pingAlpha > 0.04;

        const R     = 4;
        const color = scanned ? '#ff2222' : 'rgba(255,55,0,0.48)';

        ctx.save();
        ctx.lineWidth   = 0.9;
        ctx.strokeStyle = color;

        // Diamond marker
        ctx.beginPath();
        ctx.moveTo(sx,     sy - R);
        ctx.lineTo(sx + R, sy);
        ctx.lineTo(sx,     sy + R);
        ctx.lineTo(sx - R, sy);
        ctx.closePath();
        if (scanned) {
          ctx.fillStyle  = 'rgba(255,0,0,0.22)';
          ctx.fill();
          ctx.shadowBlur  = 9;
          ctx.shadowColor = '#ff0000';
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Centre dot
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2); ctx.fill();

        // Label — avoid clipping near edges of disc
        const nearRight = sx + R + 28 > CX + MAX_R + 4;
        ctx.fillStyle  = color;
        ctx.font       = '6px monospace';
        ctx.textAlign  = nearRight ? 'right' : 'left';
        ctx.fillText('SENT', nearRight ? sx - R - 2 : sx + R + 2, sy + 2);

        ctx.restore();
      }

      // ── Neb at centre (drawn last — always on top) ────────────────────────
      drawNeb(ctx);

      // ── EMP discharge animation ───────────────────────────────────────────
      if (empProgress >= 0) {
        // Bright cyan flash at start
        if (empProgress < 0.12) {
          const flashAlpha = (1 - empProgress / 0.12) * 0.55;
          ctx.fillStyle = `rgba(0, 220, 255, ${flashAlpha.toFixed(2)})`;
          ctx.fillRect(0, 0, CW, CH);
        }

        // Expanding sonar-style EMP rings from center
        for (let ring = 0; ring < EMP_RINGS; ring++) {
          const delay = ring / EMP_RINGS;
          const rp    = Math.max(0, (empProgress - delay) / (1 - delay));
          if (rp <= 0) continue;

          const radius = rp * MAX_R * 1.3;
          const alpha  = Math.max(0, (1 - rp) * 0.85);
          const width  = (1 - rp) * 3 + 0.5;

          ctx.beginPath();
          ctx.arc(CX, CY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 230, 255, ${alpha.toFixed(2)})`;
          ctx.lineWidth   = width;
          ctx.shadowBlur  = 14 * alpha;
          ctx.shadowColor = 'rgba(0, 230, 255, 0.9)';
          ctx.stroke();
          ctx.shadowBlur  = 0;
        }

        // "EMP" text flash at center
        if (empProgress < 0.35) {
          const textAlpha = Math.max(0, 1 - empProgress / 0.35);
          ctx.fillStyle   = `rgba(0, 230, 255, ${textAlpha.toFixed(2)})`;
          ctx.font        = 'bold 10px monospace';
          ctx.textAlign   = 'center';
          ctx.shadowBlur  = 12;
          ctx.shadowColor = '#00dcff';
          ctx.fillText('⚡ EMP ⚡', CX, CY + 20);
          ctx.shadowBlur  = 0;
        }
      }

      // ── Corner HUD ────────────────────────────────────────────────────────
      const d          = depthRef.current;
      const sentClose  = sentDist < 300;
      ctx.fillStyle    = sentClose ? '#ff4444' : 'rgba(0,255,65,0.60)';
      ctx.font         = 'bold 7px monospace';
      ctx.textAlign    = 'left';
      ctx.fillText(sentClose ? `⚠ SENT ${Math.round(sentDist)}m` : `${d.toFixed(1)} km`, 4, 10);

      const zoneLabel = d < 4 ? 'SAFE' : d < 7 ? 'TRACE' : 'DANGER';
      const zoneFill  = d < 4 ? 'rgba(0,255,65,0.45)' : d < 7 ? 'rgba(255,190,0,0.65)' : 'rgba(255,60,0,0.80)';
      ctx.fillStyle   = zoneFill;
      ctx.font        = '7px monospace';
      ctx.textAlign   = 'right';
      ctx.fillText(zoneLabel, CW - 4, 10);

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const sentCount = useGameStore((s) => s.ship.sentinelCount);

  return (
    <div style={{
      background: 'rgba(0,5,0,0.85)',
      border: `1px solid ${empPulsing ? 'rgba(0,220,255,0.6)' : 'rgba(0,255,65,0.2)'}`,
      borderRadius: 2,
      padding: '5px 7px',
      fontFamily: 'var(--font-mono, monospace)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        fontSize: 9,
        letterSpacing: '0.15em',
        marginBottom: 3,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: empPulsing ? 'rgba(0,220,255,0.9)' : 'rgba(0,255,65,0.5)' }}>
          {empPulsing ? 'EMP ACTIVE' : 'PROXIMITY SONAR'}
        </span>
        <span style={{
          color: empPulsing ? '#00dcff' : sentCount > 0 ? '#ff8800' : 'rgba(0,255,65,0.35)',
          animation: empPulsing ? 'alert-flash 0.4s infinite' : undefined,
        }}>
          {empPulsing ? '⚡' : sentCount > 0 ? `${sentCount}▲` : '✓'}
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
