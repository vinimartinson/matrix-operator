'use client';
// ---------------------------------------------------------------------------
// ThreatRadar – 3D isometric wireframe terrain height-map.
// Smith proximity drives a Gaussian disturbance peak (closer = taller + redder).
// EMP discharge triggers a radial pulse animation across the terrain.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/engine/game-state';

// ── Grid & projection constants ────────────────────────────────────────────
const N      = 12;           // grid points per side
const HALF   = (N - 1) / 2; // 5.5
const DX     = 7.2;          // isometric x-step per grid unit (px)
const DY     = 3.0;          // isometric y-step per grid unit (px)
const EL_SCL = 3.8;          // elevation → pixel height
const CW     = 230;          // canvas width
const CH     = 138;          // canvas height
const BASE_Y = 94;           // screen-Y at zero elevation, grid centre

// ── Stable per-point base noise ────────────────────────────────────────────
const BASE: number[][] = Array.from({ length: N }, (_, gy) =>
  Array.from({ length: N }, (_, gx) =>
    0.25 + 0.5 * Math.abs(Math.sin(gx * 5.31 + gy * 11.73 + 1.17)),
  ),
);

// ── Isometric projection ───────────────────────────────────────────────────
function project(gx: number, gy: number, elev: number): [number, number] {
  const wx = gx - HALF, wy = gy - HALF;
  return [
    CW / 2 + (wx - wy) * DX,
    BASE_Y + (wx + wy) * DY - elev * EL_SCL,
  ];
}

// ── Elevation → colour ramp ────────────────────────────────────────────────
function elevColor(e: number): string {
  const t = Math.min(e, 10);
  if (t < 2)   return `rgba(0,${Math.round(120 + 115 * (t / 2))},10,${(0.55 + 0.30 * (t / 2)).toFixed(2)})`;
  if (t < 4)   return `rgba(${Math.round(40 * ((t - 2) / 2))},230,20,0.88)`;
  if (t < 6.5) { const f = (t - 4) / 2.5; return `rgba(${Math.round(40 + 215 * f)},${Math.round(230 - 160 * f)},0,${(0.90 + 0.08 * f).toFixed(2)})`; }
  const f = Math.min((t - 6.5) / 3.5, 1);
  return `rgba(255,${Math.round(70 - 70 * f)},0,${(0.95 + 0.05 * f).toFixed(2)})`;
}

// ── EMP pulse constants ────────────────────────────────────────────────────
const EMP_ANIM_MS = 2400;   // total animation duration
const EMP_RINGS   = 4;      // number of expanding rings

// ── Sentinel blip constants ────────────────────────────────────────────────
// Stable base angles and slow orbital drift rates (rad/ms) for up to 4 blips
const SENT_BASE_ANGLES = [0.52, 2.18, 3.85, 5.40];
const SENT_DRIFT       = [0.00025, -0.00020, 0.00015, -0.00030];


// ── Component ──────────────────────────────────────────────────────────────
export function ThreatRadar() {
  const smithDist  = useGameStore((s) => s.smithDistance);
  const smithRef   = useRef(smithDist);
  smithRef.current = smithDist;

  const empFired    = useGameStore((s) => s.empFired);
  const setEmpFired = useGameStore((s) => s.setEmpFired);
  const empAnimRef  = useRef<number | null>(null);
  const [empPulsing, setEmpPulsing] = useState(false);

  // Ship fields read directly from store inside the canvas loop (getState bypasses
  // React scheduler timing, guaranteeing the RAF always sees the latest values)
  const sentDistM  = useGameStore((s) => s.ship.sentinelDistance); // for React header only
  const sentCount  = useGameStore((s) => s.ship.sentinelCount);    // for React header only
  const shipDepth  = useGameStore((s) => s.ship.depth);            // for React header only
  const empCharging = useGameStore((s) => s.ship.empCharging);     // for React header only
  const empCharge   = useGameStore((s) => s.ship.empCharge);       // for React header only

  // Sentinel orbital angles — slowly drift each frame
  const sentAnglesRef = useRef([...SENT_BASE_ANGLES]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const angleRef  = useRef(Math.PI * 0.28);

  // When empFired becomes true, record start timestamp then clear the flag
  useEffect(() => {
    if (empFired) {
      empAnimRef.current = performance.now();
      setEmpFired(false);
      setEmpPulsing(true);
      setTimeout(() => setEmpPulsing(false), EMP_ANIM_MS + 200);
    }
  }, [empFired, setEmpFired]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;
    let lastTs = performance.now();

    function frame(ts: number) {
      const dt   = Math.min(ts - lastTs, 80);
      lastTs     = ts;
      const dist = smithRef.current;
      angleRef.current += dt * 0.00028;
      const angle = angleRef.current;

      // Smith grid-world position
      const smithR = (dist / 10) * (HALF - 0.5);
      const smithX = smithR * Math.cos(angle);
      const smithY = smithR * Math.sin(angle);

      const strength = ((10 - dist) / 10) * 12 + 0.4;
      const sigma    = 1.1 + dist * 0.16;
      const t        = ts / 1000;

      // EMP animation progress (0→1 during pulse, null outside)
      const empStart   = empAnimRef.current;
      const empElapsed = empStart !== null ? ts - empStart : -1;
      const empProgress = (empElapsed >= 0 && empElapsed < EMP_ANIM_MS)
        ? empElapsed / EMP_ANIM_MS
        : -1;
      if (empElapsed >= EMP_ANIM_MS) empAnimRef.current = null;

      // Build elevation — flatten terrain during EMP pulse for visual clarity
      const flattenFactor = empProgress >= 0 ? Math.max(0, 1 - empProgress * 3) : 1;
      const elev: number[][] = [];
      for (let gy = 0; gy < N; gy++) {
        elev[gy] = [];
        for (let gx = 0; gx < N; gx++) {
          const wx = gx - HALF, wy = gy - HALF;
          const ddx = wx - smithX, ddy = wy - smithY;
          const smith = strength * Math.exp(-(ddx * ddx + ddy * ddy) / (2 * sigma * sigma));
          const wave  = 0.55 * Math.sin(wx * 0.85 + t * 1.9) * Math.cos(wy * 0.65 + t * 1.35)
                      + 0.22 * Math.sin(wx * 1.5 - t * 0.8 + wy * 0.8);
          elev[gy][gx] = Math.max(0, (smith + wave + BASE[gy][gx]) * flattenFactor);
        }
      }

      // Read ship state directly from store — avoids any React scheduler stale-ref risk
      const ship         = useGameStore.getState().ship;
      const depth        = ship.depth;
      const empCharging  = ship.empCharging;
      const empChargePct = ship.empCharge;

      // Signal quality factor: 1-2km strong, >3km weak
      const signalAlpha = depth <= 2 ? 1.0
                        : depth <= 3 ? 0.85 - 0.15 * (depth - 2)
                        : depth <= 4 ? 0.70 - 0.15 * (depth - 3)
                        : 0.55 - 0.15 * (depth - 4);  // 0.40 at 5km

      ctx.fillStyle = '#000400';
      ctx.fillRect(0, 0, CW, CH);

      // Deep-water noise: faint static dots scattered across the grid
      if (depth > 3) {
        const noiseIntensity = Math.min(1, (depth - 3) / 2); // 0 at 3km → 1 at 5km
        const noiseDots = Math.round(noiseIntensity * 40);
        ctx.fillStyle = `rgba(0,200,80,${(0.08 * noiseIntensity).toFixed(2)})`;
        for (let n = 0; n < noiseDots; n++) {
          const nx = Math.random() * CW;
          const ny = Math.random() * CH;
          ctx.fillRect(nx, ny, 1.5, 1.5);
        }
      }

      // Apply signal alpha to terrain rendering
      ctx.globalAlpha = signalAlpha;

      // Painter's order: ascending (gx+gy) depth sum
      for (let sum = 0; sum <= (N - 1) * 2 - 1; sum++) {
        for (let gx = Math.max(0, sum - (N - 1)); gx <= Math.min(sum, N - 1); gx++) {
          const gy = sum - gx;
          if (gy < 0 || gy >= N) continue;

          // Tint grid cyan during EMP
          const empTint = empProgress >= 0 ? Math.max(0, 0.6 - empProgress) : 0;

          // Horizontal edge
          if (gx + 1 < N) {
            const e1 = elev[gy][gx], e2 = elev[gy][gx + 1], em = (e1 + e2) / 2;
            const [x1, y1] = project(gx, gy, e1);
            const [x2, y2] = project(gx + 1, gy, e2);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            ctx.strokeStyle = empTint > 0
              ? `rgba(0, ${Math.round(180 + 75 * empTint)}, 255, ${(0.7 + 0.3 * empTint).toFixed(2)})`
              : elevColor(em);
            ctx.lineWidth = em > 6 ? 2.4 : em > 3 ? 1.6 : 1.1;
            if (em > 4 && empTint <= 0) { ctx.shadowBlur = em > 6 ? 12 : 6; ctx.shadowColor = em > 6 ? '#ff3300' : '#44ff44'; }
            ctx.stroke(); ctx.shadowBlur = 0;
          }

          // Vertical edge
          if (gy + 1 < N) {
            const e1 = elev[gy][gx], e2 = elev[gy + 1][gx], em = (e1 + e2) / 2;
            const [x1, y1] = project(gx, gy, e1);
            const [x2, y2] = project(gx, gy + 1, e2);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            ctx.strokeStyle = empTint > 0
              ? `rgba(0, ${Math.round(180 + 75 * empTint)}, 255, ${(0.7 + 0.3 * empTint).toFixed(2)})`
              : elevColor(em);
            ctx.lineWidth = em > 6 ? 2.4 : em > 3 ? 1.6 : 1.1;
            if (em > 4 && empTint <= 0) { ctx.shadowBlur = em > 6 ? 12 : 6; ctx.shadowColor = em > 6 ? '#ff3300' : '#44ff44'; }
            ctx.stroke(); ctx.shadowBlur = 0;
          }
        }
      }

      ctx.globalAlpha = 1.0;

      // ── Sentinel blips ──────────────────────────────────────────────────
      const sentDist   = ship.sentinelDistance;
      const sentNum    = ship.sentinelCount ?? 0;
      const sentNorm   = Math.min(1, Math.max(0, sentDist / 1000));
      // Grid radius: close sentinels near center, far near edge
      const sentR      = sentNorm * (HALF - 0.5) * 0.88;
      const pulse      = 0.65 + 0.35 * Math.sin(ts * 0.0035);
      // Killed sentinels are already removed from sentNum (count decreased in store
      // before the animation fires), so just draw current survivors at full alpha.
      const blipAlpha  = 1;

      // Advance orbital angles
      for (let i = 0; i < 4; i++) {
        sentAnglesRef.current[i] += dt * SENT_DRIFT[i];
      }

      for (let i = 0; i < sentNum; i++) {
        const ang  = sentAnglesRef.current[i];
        const sgx  = HALF + sentR * Math.cos(ang);
        const sgy  = HALF + sentR * Math.sin(ang);
        const egx  = Math.round(Math.min(N - 1, Math.max(0, sgx)));
        const egy  = Math.round(Math.min(N - 1, Math.max(0, sgy)));
        const elevS = elev[egy]?.[egx] ?? 0;
        const [sx, sy] = project(sgx, sgy, elevS + 0.3);

        if (blipAlpha <= 0) continue;

        const r  = 4 * pulse;
        const a  = blipAlpha;

        // Outer ring glow
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 80, 0, ${(a * 0.25 * pulse).toFixed(2)})`;
        ctx.lineWidth   = 1;
        ctx.shadowBlur  = 0;
        ctx.stroke();

        // Diamond marker
        ctx.beginPath();
        ctx.moveTo(sx,          sy - r * 1.6);
        ctx.lineTo(sx + r,      sy);
        ctx.lineTo(sx,          sy + r * 1.6);
        ctx.lineTo(sx - r,      sy);
        ctx.closePath();
        ctx.strokeStyle = `rgba(255, 100, 20, ${a.toFixed(2)})`;
        ctx.lineWidth   = 1.2;
        ctx.stroke();

        // Core fill
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.65, 0, Math.PI * 2);
        ctx.fillStyle   = `rgba(255, 60, 0, ${(a * 0.9 * pulse).toFixed(2)})`;
        ctx.shadowBlur  = 10 * pulse * a;
        ctx.shadowColor = 'rgba(255, 80, 0, 0.9)';
        ctx.fill();
        ctx.shadowBlur  = 0;
      }

      // ── EMP charge arc ──────────────────────────────────────────────────
      if (empCharging && empChargePct > 0) {
        const ox    = CW / 2;
        const oy    = BASE_Y - 18;
        const arcR  = 22;
        const fill  = empChargePct / 100;
        // Colour interpolates green → cyan as charge rises
        const g     = Math.round(255 * (1 - fill * 0.14));
        const b     = Math.round(255 * fill);
        const arcColor = `rgba(0,${g},${b},0.85)`;

        // Dim background ring
        ctx.beginPath();
        ctx.arc(ox, oy, arcR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,255,65,0.08)';
        ctx.lineWidth   = 4;
        ctx.stroke();

        // Filled charge arc (sweeps clockwise from top)
        ctx.beginPath();
        ctx.arc(ox, oy, arcR, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
        ctx.strokeStyle = arcColor;
        ctx.lineWidth   = 3;
        ctx.shadowBlur  = 10;
        ctx.shadowColor = arcColor;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Pulsing center dot
        const dotA = 0.5 + 0.5 * Math.sin(ts * 0.008);
        ctx.beginPath();
        ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle   = `rgba(0,${g},${b},${dotA.toFixed(2)})`;
        ctx.shadowBlur  = 8 * dotA;
        ctx.shadowColor = arcColor;
        ctx.fill();
        ctx.shadowBlur  = 0;
      }

      // EMP screen flash — drawn AFTER terrain so it's visible on top
      if (empProgress >= 0 && empProgress < 0.10) {
        const flashAlpha = (1 - empProgress / 0.10) * 0.65;
        ctx.fillStyle = `rgba(0, 220, 255, ${flashAlpha.toFixed(2)})`;
        ctx.fillRect(0, 0, CW, CH);
      }

      // EMP expanding ring pulses — drawn on top of everything
      if (empProgress >= 0) {
        const originX = CW / 2;
        const originY = BASE_Y - 18;
        const maxR    = Math.sqrt(CW * CW + CH * CH) * 0.72;

        for (let ring = 0; ring < EMP_RINGS; ring++) {
          const delay = ring / EMP_RINGS;
          const rp    = Math.max(0, (empProgress - delay) / (1 - delay));
          if (rp <= 0) continue;

          const radius = rp * maxR;
          const alpha  = Math.max(0, (1 - rp) * 0.9);
          const width  = (1 - rp) * 4 + 0.5;

          ctx.beginPath();
          ctx.ellipse(originX, originY, radius, radius * 0.42, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 230, 255, ${alpha.toFixed(2)})`;
          ctx.lineWidth   = width;
          ctx.shadowBlur  = 18 * alpha;
          ctx.shadowColor = 'rgba(0, 230, 255, 0.9)';
          ctx.stroke();
          ctx.shadowBlur  = 0;
        }
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const isContact  = smithDist <= 1;
  const isClose    = smithDist <= 3;
  const sentNear   = sentDistM < 400;
  const depthSafe  = shipDepth <= 2;
  const depthDanger = shipDepth > 3;
  const depthLabel = depthSafe    ? `${shipDepth.toFixed(1)}km ✓`
                   : depthDanger  ? `${shipDepth.toFixed(1)}km ⚠`
                   :                `${shipDepth.toFixed(1)}km`;
  const depthColor = depthSafe    ? 'rgba(0,255,65,0.55)'
                   : depthDanger  ? '#ff8800'
                   :                'rgba(0,255,65,0.35)';

  return (
    <div style={{
      background: 'rgba(0,5,0,0.85)',
      border: `1px solid ${empPulsing ? 'rgba(0,220,255,0.6)' : isContact ? 'rgba(255,0,0,0.5)' : sentNear ? 'rgba(255,80,0,0.4)' : 'rgba(0,255,65,0.2)'}`,
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
        <span style={{ color: empPulsing ? 'rgba(0,220,255,0.9)' : isClose ? 'rgba(255,80,80,0.8)' : 'rgba(0,255,65,0.5)' }}>
          {empPulsing ? 'EMP PULSE ACTIVE' : 'SPATIAL ANALYSIS'}
        </span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Depth indicator */}
          <span style={{
            color: depthColor,
            animation: depthDanger ? 'alert-flash 1.2s infinite' : undefined,
          }}>
            {depthLabel}
          </span>
          {empCharging && !empPulsing && (
            <span style={{ color: '#00ff41', animation: 'alert-flash 0.5s infinite' }}>
              ⚡ {Math.round(empCharge)}%
            </span>
          )}
          {sentCount > 0 && !empPulsing && !empCharging && (
            <span style={{
              color: sentNear ? '#ff5000' : '#ff8800',
              animation: sentNear ? 'alert-flash 0.7s infinite' : undefined,
            }}>
              {sentCount}▲ SENT
            </span>
          )}
          {sentCount === 0 && !empPulsing && !empCharging && (
            <span style={{ color: 'rgba(0,255,65,0.3)' }}>CLEAR</span>
          )}
          <span style={{
            color: empPulsing ? '#00dcff' : isContact ? '#ff0000' : isClose ? '#ff4444' : 'rgba(0,255,65,0.4)',
            animation: empPulsing ? 'alert-flash 0.4s infinite' : isContact ? 'alert-flash 0.5s infinite' : undefined,
          }}>
            {empPulsing ? '⚡ DISCHARGE ⚡' : isContact ? 'CONTACT' : isClose ? `${smithDist * 10}m ⚠` : `~${smithDist * 10}m`}
          </span>
        </span>
      </div>
      <canvas ref={canvasRef} width={CW} height={CH}
        style={{ display: 'block', width: CW, height: CH, flexShrink: 0 }} />
    </div>
  );
}
