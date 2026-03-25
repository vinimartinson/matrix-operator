'use client';

import { useEffect, useRef, useCallback } from 'react';

type Intensity = 'low' | 'medium' | 'high';

interface MatrixRainProps {
  intensity?: Intensity;
}

const KATAKANA =
  'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロワヰヱヲン';
const DIGITS = '0123456789';
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CHARS = KATAKANA + DIGITS + LATIN;

const INTENSITY_CONFIG: Record<Intensity, { columnDensity: number; speedMin: number; speedMax: number; opacity: number }> = {
  low:    { columnDensity: 0.3,  speedMin: 0.3, speedMax: 0.8, opacity: 0.12 },
  medium: { columnDensity: 0.55, speedMin: 0.5, speedMax: 1.2, opacity: 0.18 },
  high:   { columnDensity: 0.85, speedMin: 0.8, speedMax: 1.8, opacity: 0.25 },
};

const FONT_SIZE = 16;
const TRAIL_LENGTH = 20;

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface Drop {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  switchTimer: number;
}

export default function MatrixRain({ intensity = 'medium' }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const dropsRef = useRef<Drop[]>([]);
  const configRef = useRef(INTENSITY_CONFIG[intensity]);

  // Update config when intensity changes
  useEffect(() => {
    configRef.current = INTENSITY_CONFIG[intensity];
  }, [intensity]);

  const initDrops = useCallback((width: number, height: number) => {
    const config = configRef.current;
    const totalColumns = Math.floor(width / FONT_SIZE);
    const activeColumns = Math.max(1, Math.floor(totalColumns * config.columnDensity));
    const columnIndices: number[] = [];

    // Select random columns
    const all = Array.from({ length: totalColumns }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    for (let i = 0; i < activeColumns; i++) {
      columnIndices.push(all[i]);
    }

    const drops: Drop[] = columnIndices.map((col) => {
      const chars: string[] = [];
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        chars.push(randomChar());
      }
      return {
        x: col * FONT_SIZE,
        y: Math.random() * height * -1, // start above screen
        speed: config.speedMin + Math.random() * (config.speedMax - config.speedMin),
        chars,
        switchTimer: Math.random() * 10,
      };
    });

    dropsRef.current = drops;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initDrops(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    let lastTime = 0;

    const draw = (timestamp: number) => {
      const delta = timestamp - lastTime;
      lastTime = timestamp;
      const dt = Math.min(delta, 50); // cap at 50ms to avoid jumps

      const config = configRef.current;
      const w = canvas.width;
      const h = canvas.height;

      // Semi-transparent black to create trail effect
      ctx.fillStyle = `rgba(0, 0, 0, 0.05)`;
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${FONT_SIZE}px 'JetBrains Mono', 'Courier New', monospace`;

      const drops = dropsRef.current;

      for (const drop of drops) {
        // Update position
        drop.y += drop.speed * (dt * 0.06);

        // Randomly swap a character
        drop.switchTimer -= dt * 0.01;
        if (drop.switchTimer <= 0) {
          const idx = Math.floor(Math.random() * drop.chars.length);
          drop.chars[idx] = randomChar();
          drop.switchTimer = 2 + Math.random() * 6;
        }

        // Draw trail
        for (let i = 0; i < TRAIL_LENGTH; i++) {
          const charY = drop.y - i * FONT_SIZE;
          if (charY < -FONT_SIZE || charY > h + FONT_SIZE) continue;

          if (i === 0) {
            // Leading character: bright white-green
            ctx.fillStyle = `rgba(220, 255, 220, ${config.opacity * 3.5})`;
            ctx.shadowColor = '#00ff41';
            ctx.shadowBlur = 8;
          } else {
            // Trailing: fade from bright green to dark green
            const fade = 1 - i / TRAIL_LENGTH;
            const g = Math.floor(100 + 155 * fade);
            const alpha = config.opacity * (2.5 * fade);
            ctx.fillStyle = `rgba(0, ${g}, ${Math.floor(20 * fade)}, ${alpha})`;
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }

          ctx.fillText(drop.chars[i], drop.x, charY);
        }

        // Reset shadow
        ctx.shadowBlur = 0;

        // Reset drop when it goes offscreen
        if (drop.y - TRAIL_LENGTH * FONT_SIZE > h) {
          drop.y = Math.random() * -200 - FONT_SIZE;
          drop.speed =
            config.speedMin +
            Math.random() * (config.speedMax - config.speedMin);
          for (let i = 0; i < TRAIL_LENGTH; i++) {
            drop.chars[i] = randomChar();
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [initDrops]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
