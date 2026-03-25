'use client';
// ---------------------------------------------------------------------------
// AnomalyCodeFeed – Scrolling matrix code stream.
// Narrative-aware: when new orchestrator context arrives, injects contextual
// coded lines that mirror what's happening in the story.
// ~10% of normal lines have distortion: glitch jitter, static corruption,
// or signal dropout — giving a CRT / degraded-transmission feel.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { generateMatrixFeedLine, getAnomalyFeedLine, generateAnomaly } from '@/engine/anomaly-engine';
import { useGameStore } from '@/engine/game-state';
import type { NarrativeBeat } from '@/engine/types';

type DistortionType = 'glitch' | 'static' | 'dropout';

interface FeedLine {
  text: string;
  type: 'normal' | 'anomaly' | 'dejavu' | 'narrative' | 'clue';
  key: number;
  distortion?: DistortionType;
}

/** Beat-specific operator clue lines injected when beat changes */
const BEAT_CLUES: Partial<Record<NarrativeBeat, string[]>> = {
  door_blocked: [
    '[HINT] CMD: hack door-a',
    '[ACCESS:DOOR-A] [STATE:LOCKED] [BYPASS:AVAILABLE]',
    '[FEED:DIRECTIVE] Hack DOOR-A to proceed.',
  ],
  path_clear: [
    '[ROUTE:MAINTENANCE-CRAWL] [BYPASS:CAM-1] [STATUS:OPEN]',
    '[HINT] Shortcut detected — maintenance crawlway bypasses CAM-1.',
    '[SMITH:REPLICATING] [SECTOR:ADJACENT] [MOVE:FAST]',
  ],
  extraction: [
    '[HINT] CMD: jack trinity out',
    '[HARDLINE:ACTIVE] [STATUS:LIVE] [EXTRACT:READY]',
    '[FEED:DIRECTIVE] Trinity is at the phone. Jack her out now.',
  ],
};

const MAX_LINES   = 60;
const INTERVAL_MS = 800;

/** Agent Smith quotes — surface as red anomaly lines (easter egg) */
const SMITH_QUOTES = [
  'I\'d like to share a revelation I\'ve had during my time here.',
  'Human beings are a disease. A cancer of this planet.',
  'You are a plague, and we are the cure.',
  'Never send a human to do a machine\'s job.',
  'Can you hear me, Morpheus? I\'m going to be honest with you.',
  'I hate this place. This zoo. This prison. This reality.',
  'You must be able to see it, Mr. Anderson.',
  'We\'re not here because we\'re free. We\'re here because we\'re not free.',
  'Everything that has a beginning has an end, Neo.',
  'Why, Mr. Anderson? Why do you persist?',
  'You think that\'s air you\'re breathing now?',
  'Goodbye, Mr. Anderson.',
  'Do you hear that, Mr. Anderson? That is the sound of inevitability.',
  'I\'m going to enjoy watching you die, Mr. Anderson.',
  'Only human.',
  'It\'s the smell. If there is such a thing.',
  'No, Lieutenant, your men are already dead.',
  'You hear that? That is the sound of your death, Mr. Anderson.',
  'You destroyed me, Mr. Anderson. Afterward, I knew the rules.',
  'Everything that has a beginning has an end, Trinity.',
];

// Block / noise chars for static corruption
const NOISE_CHARS = '█▓▒░▪◆●○◉⬛▰▱';

/** Replace a fraction of non-space chars with noise glyphs */
function distortText(text: string, intensity: number): string {
  return text.split('').map((c) =>
    c !== ' ' && Math.random() < intensity
      ? NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]
      : c,
  ).join('');
}

/** Pick a random distortion type */
function randomDistortion(): DistortionType {
  const r = Math.random();
  if (r < 0.40) return 'glitch';
  if (r < 0.75) return 'static';
  return 'dropout';
}

/** Convert a narrative line into a short coded matrix-style line */
function narrativeToCode(line: string): string | null {
  const l = line.toLowerCase();

  if (l.includes('smith') || l.includes('signature') || l.includes('entity')) {
    const dist = l.match(/(\d+)\s*meter/) ? parseInt(l.match(/(\d+)\s*meter/)![1]) : null;
    const distStr = dist ? `DIST:${dist}m` : `DIST:???`;
    return `[THERMAL:SIG-0${Math.floor(Math.random()*3)+1}] [${distStr}] [VECTOR:${['NE','NW','SE','SW'][Math.floor(Math.random()*4)]}]`;
  }
  if (l.includes('door') || l.includes('locked') || l.includes('door-a')) {
    return `[ACCESS:DOOR-A] [STATE:${l.includes('breach') || l.includes('open') || l.includes('unseal') ? 'BREACH:OK' : 'LOCKED'}] [BYPASS:${l.includes('breach') || l.includes('open') ? 'CONFIRMED' : 'REQUIRED'}]`;
  }
  if (l.includes('cam') || l.includes('camera') || l.includes('alarm')) {
    return `[SENSOR:CAM-1] [ALERT:${l.includes('alarm') || l.includes('triggered') ? 'ACTIVE' : 'CLEAR'}] [TRACE:${l.includes('alarm') ? 'ACTIVE' : 'PASSIVE'}]`;
  }
  if (l.includes('phone') || l.includes('hardline') || l.includes('harmonic')) {
    const freq = (200 + Math.floor(Math.random() * 800)) + '.' + Math.floor(Math.random() * 99);
    return `[SIGNAL:HARDLINE-7] [FREQ:${freq}Hz] [STATUS:${l.includes('active') || l.includes('pulse') ? 'LIVE' : 'DETECT'}]`;
  }
  if (l.includes('corridor') || l.includes('sector') || l.includes('grid')) {
    const sec = `SEC-${Math.floor(Math.random()*9)+1}`;
    return `[GRID:${sec}] [ANOMALY:${l.includes('flicker') || l.includes('stutter') ? 'RENDER_FAULT' : 'PATTERN_SHIFT'}] [MASK:ACTIVE]`;
  }
  if (l.includes('deja') || l.includes('pattern repeat') || l.includes('loop')) {
    return `[LOOP:DETECTED] [FRAME:DELTA_0] [ECHO:${(Math.random() * 9).toFixed(3)}s]`;
  }
  if (l.includes('extract') || l.includes('jack out') || l.includes('jacked out')) {
    return `[SESSION:TRINITY] [DISCONNECT:INITIATED] [HANDSHAKE:OK]`;
  }
  if (l.includes('simulation') || l.includes('feed') || l.includes('matrix')) {
    return `[FEED:NOMINAL] [INTEGRITY:${(88 + Math.floor(Math.random()*12)).toString()}%] [FRAME:${Date.now().toString(36).toUpperCase()}]`;
  }
  return null;
}

// ── Distortion styles ──────────────────────────────────────────────────────

const DISTORTION_KEYFRAMES = `
@keyframes feed-glitch {
  0%   { transform: translateX(0px);  opacity: 1;    filter: none; }
  10%  { transform: translateX(-5px); opacity: 0.55; filter: hue-rotate(80deg) brightness(1.4); }
  25%  { transform: translateX(4px);  opacity: 0.85; }
  40%  { transform: translateX(-3px); opacity: 0.45; filter: hue-rotate(160deg); }
  55%  { transform: translateX(5px);  opacity: 0.8;  }
  70%  { transform: translateX(-2px); opacity: 0.9;  filter: none; }
  85%  { transform: translateX(1px);  opacity: 0.7;  }
  100% { transform: translateX(0px);  opacity: 1;    filter: none; }
}
@keyframes feed-static-flicker {
  0%,100% { opacity: 0.75; }
  20%     { opacity: 0.38; }
  45%     { opacity: 0.90; }
  65%     { opacity: 0.25; }
  80%     { opacity: 0.82; }
}
@keyframes feed-dropout {
  0%,100% { opacity: 0.10; letter-spacing: 0.05em; }
  30%     { opacity: 0.22; }
  60%     { opacity: 0.08; letter-spacing: 0.12em; }
  80%     { opacity: 0.18; }
}
`;

function distortionStyle(d: DistortionType): React.CSSProperties {
  switch (d) {
    case 'glitch':
      return {
        animation: `feed-glitch ${(0.28 + Math.random() * 0.25).toFixed(2)}s steps(1) 1`,
        color: '#33ff99',
      };
    case 'static':
      return {
        animation: `feed-static-flicker ${(0.5 + Math.random() * 0.6).toFixed(2)}s steps(2) ${Math.ceil(Math.random() * 3)}`,
        opacity: 0.6,
      };
    case 'dropout':
      return {
        animation: `feed-dropout ${(1.2 + Math.random() * 0.8).toFixed(2)}s ease-in-out infinite`,
        color: 'rgba(0,255,65,0.25)',
      };
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function AnomalyCodeFeed() {
  const [lines, setLines] = useState<FeedLine[]>([]);
  const keyRef = useRef(0);
  const lastLineRef = useRef('');

  const events          = useGameStore((s) => s.events);
  const narrativeContext = useGameStore((s) => s.narrativeContext);
  const missionBeat     = useGameStore((s) => s.missionBeat);
  const lastEventRef    = useRef(0);
  const lastContextLenRef = useRef(0);
  const lastBeatRef     = useRef<NarrativeBeat | ''>('');

  // Inject operator clue lines when beat changes
  useEffect(() => {
    if (missionBeat === lastBeatRef.current) return;
    lastBeatRef.current = missionBeat;
    const clues = BEAT_CLUES[missionBeat];
    if (!clues) return;
    clues.forEach((clue, i) => {
      setTimeout(() => {
        setLines((prev) => ([
          ...prev,
          { text: clue, type: 'clue' as FeedLine['type'], key: keyRef.current++ },
        ] as FeedLine[]).slice(-MAX_LINES));
      }, i * 600);
    });
  }, [missionBeat]);

  // React to deja-vu events
  useEffect(() => {
    const dejaVuEvents = events.filter(
      (e) => e.type === 'deja_vu' && e.timestamp > lastEventRef.current,
    );
    if (dejaVuEvents.length > 0) {
      lastEventRef.current = Date.now();
      const duped = lastLineRef.current || generateMatrixFeedLine();
      setLines((prev) => ([
        ...prev,
        { text: duped, type: 'dejavu' as FeedLine['type'], key: keyRef.current++ },
        { text: duped, type: 'dejavu' as FeedLine['type'], key: keyRef.current++ },
      ] as FeedLine[]).slice(-MAX_LINES));
    }
  }, [events]);

  // React to new narrative context lines — inject coded mirror
  useEffect(() => {
    if (narrativeContext.length <= lastContextLenRef.current) return;
    const newLines = narrativeContext.slice(lastContextLenRef.current);
    lastContextLenRef.current = narrativeContext.length;

    for (const narrative of newLines) {
      if (narrative.startsWith('[OPERATOR]')) continue;
      const coded = narrativeToCode(narrative);
      if (coded) {
        setLines((prev) => ([
          ...prev,
          { text: coded, type: 'narrative' as FeedLine['type'], key: keyRef.current++ },
        ] as FeedLine[]).slice(-MAX_LINES));
      }
    }
  }, [narrativeContext]);

  // Background random matrix chars
  useEffect(() => {
    const interval = setInterval(() => {
      const isAnomaly = Math.random() < 0.10;
      let text: string;
      let type: FeedLine['type'];
      let distortion: DistortionType | undefined;

      if (isAnomaly) {
        // 25% chance the anomaly line is a Smith quote easter egg
        if (Math.random() < 0.25) {
          text = SMITH_QUOTES[Math.floor(Math.random() * SMITH_QUOTES.length)];
        } else {
          const anomaly = generateAnomaly();
          text = getAnomalyFeedLine(anomaly);
        }
        type = 'anomaly';
      } else {
        text = generateMatrixFeedLine();
        type = 'normal';
        // ~10% of normal lines get distortion
        if (Math.random() < 0.10) {
          distortion = randomDistortion();
          // Static and dropout corrupt the text characters
          if (distortion === 'static')  text = distortText(text, 0.30);
          if (distortion === 'dropout') text = distortText(text, 0.15);
        }
      }

      lastLineRef.current = text;
      setLines((prev) => [
        ...prev,
        { text, type, key: keyRef.current++, distortion },
      ].slice(-MAX_LINES));
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Inject keyframe animations once */}
      <style>{DISTORTION_KEYFRAMES}</style>

      <div style={{
        background: 'rgba(0,5,0,0.85)',
        border: '1px solid rgba(0,255,65,0.2)',
        borderRadius: 2,
        padding: '6px 8px',
        fontFamily: 'var(--font-mono, monospace)',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 9,
          color: 'rgba(0,255,65,0.5)',
          letterSpacing: '0.15em',
          marginBottom: 4,
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span>MATRIX FEED</span>
          <span style={{ color: 'rgba(0,255,65,0.4)' }}>◉ LIVE</span>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          {lines.map((line) => {
            const base: React.CSSProperties = {
              fontSize: 10,
              lineHeight: '1.3',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color:
                line.type === 'anomaly'   ? '#ff3333' :
                line.type === 'dejavu'    ? '#ffcc00' :
                line.type === 'narrative' ? 'rgba(0,220,255,0.85)' :
                line.type === 'clue'      ? '#ffe066' :
                'rgba(0,255,65,0.55)',
              fontWeight: line.type === 'anomaly' || line.type === 'narrative' || line.type === 'clue' ? 'bold' : 'normal',
              letterSpacing: line.type === 'narrative' || line.type === 'clue' ? '0.04em' : '0.05em',
              textShadow: line.type === 'clue' ? '0 0 6px #ffe066' : undefined,
            };
            const extra = line.distortion ? distortionStyle(line.distortion) : {};
            return (
              <div key={line.key} style={{ ...base, ...extra }}>
                {line.text}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
