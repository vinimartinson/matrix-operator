'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MatrixRain from '@/terminal/MatrixRain';

// ---------------------------------------------------------------------------
// Typed text hook — simulates terminal typing with cursor
// ---------------------------------------------------------------------------
function useTypedText(text: string, speed = 45, startDelay = 0) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let timeout: NodeJS.Timeout;

    const startTimeout = setTimeout(() => {
      const tick = () => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
          timeout = setTimeout(tick, speed + Math.random() * 30);
        } else {
          setDone(true);
        }
      };
      tick();
    }, startDelay);

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(timeout);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

// ---------------------------------------------------------------------------
// Glitch text component
// ---------------------------------------------------------------------------
function GlitchText({ children, className = '' }: { children: string; className?: string }) {
  return (
    <span className={`glitch-text ${className}`} data-text={children}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Scramble-in text — characters scramble before resolving
// ---------------------------------------------------------------------------
function ScrambleText({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
  const [display, setDisplay] = useState('');
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';

  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const duration = text.length * 50 + 400;

    const delayTimeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / duration, 1);

        let result = '';
        for (let i = 0; i < text.length; i++) {
          const charProgress = Math.max(0, (progress - i / text.length / 1.5) * 2.5);
          if (charProgress >= 1 || text[i] === ' ') {
            result += text[i];
          } else {
            result += chars[Math.floor(Math.random() * chars.length)];
          }
        }
        setDisplay(result);

        if (progress < 1) {
          frame = requestAnimationFrame(animate);
        }
      };
      frame = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(delayTimeout);
      cancelAnimationFrame(frame);
    };
  }, [text, delay]);

  return <span className={className}>{display || '\u00A0'.repeat(text.length)}</span>;
}

// ---------------------------------------------------------------------------
// Reveal on scroll
// ---------------------------------------------------------------------------
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ASCII Logo
// ---------------------------------------------------------------------------
const ASCII_LOGO = `
 ███╗   ███╗ █████╗ ████████╗██████╗ ██╗██╗  ██╗
 ████╗ ████║██╔══██╗╚══██╔══╝██╔══██╗██║╚██╗██╔╝
 ██╔████╔██║███████║   ██║   ██████╔╝██║ ╚███╔╝
 ██║╚██╔╝██║██╔══██║   ██║   ██╔══██╗██║ ██╔██╗
 ██║ ╚═╝ ██║██║  ██║   ██║   ██║  ██║██║██╔╝ ██╗
 ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
`;

const RANKS_DATA = [
  { level: 1, title: 'Coppertop', points: '0' },
  { level: 2, title: 'Bluepill', points: '500' },
  { level: 3, title: 'Awakened', points: '1,500' },
  { level: 4, title: 'Potential', points: '3,000' },
  { level: 5, title: 'Operator', points: '5,000' },
  { level: 6, title: 'First Mate', points: '8,000' },
  { level: 7, title: 'Crew Chief', points: '12,000' },
  { level: 8, title: 'Ship Captain', points: '18,000' },
  { level: 9, title: 'Zion Commander', points: '25,000' },
  { level: 10, title: 'The One', points: '35,000' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function LandingPage() {
  const { displayed: subtitle, done: subtitleDone } = useTypedText(
    'OPERATOR TERMINAL v4.7.2 — CLASSIFIED — ZION COMMAND',
    35,
    800
  );

  const { displayed: tagline, done: taglineDone } = useTypedText(
    'They need you on the line. Neo, Trinity, Morpheus — in the field. You — at the terminal. Every second counts.',
    28,
    3200
  );

  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    if (taglineDone) {
      const t = setTimeout(() => setShowCTA(true), 400);
      return () => clearTimeout(t);
    }
  }, [taglineDone]);

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] overflow-y-auto overflow-x-hidden scanlines">
      {/* Matrix rain background */}
      <MatrixRain intensity="low" />

      {/* ======================== HERO ======================== */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Vignette overlay */}
        <div
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
          }}
        />

        <div className="relative z-10 max-w-4xl w-full text-center">
          {/* Transmission header */}
          <div
            className="mb-6 text-[11px] tracking-[0.35em] uppercase"
            style={{ color: '#00cc33', opacity: 0.5 }}
          >
            ▸ INCOMING TRANSMISSION — ENCRYPTED CHANNEL 7.ALPHA ▸
          </div>

          {/* ASCII Art Logo */}
          <pre
            className="text-glow mx-auto text-[8px] sm:text-[10px] md:text-[13px] lg:text-[15px] leading-[1.1] font-bold select-none mb-2"
            style={{ color: '#00ff41', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {ASCII_LOGO}
          </pre>

          {/* OPERATOR subtitle */}
          <div className="relative mb-8">
            <h2
              className="text-[28px] sm:text-[36px] md:text-[48px] font-bold tracking-[0.2em] uppercase"
              style={{
                color: '#00ff41',
                textShadow: '0 0 30px rgba(0,255,65,0.4), 0 0 60px rgba(0,255,65,0.15)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <GlitchText>OPERATOR</GlitchText>
            </h2>
            <div className="h-[1px] mx-auto mt-3" style={{ maxWidth: 300, background: 'linear-gradient(90deg, transparent, #00ff41, transparent)' }} />
          </div>

          {/* Typed subtitle */}
          <div
            className="h-6 mb-8 text-[11px] sm:text-xs tracking-[0.2em] uppercase"
            style={{ color: '#00cc33', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {subtitle}
            {!subtitleDone && <span className="cursor-blink">█</span>}
          </div>

          {/* Typed tagline */}
          <div
            className="max-w-2xl mx-auto mb-12 text-sm sm:text-base leading-relaxed min-h-[3em]"
            style={{ color: '#8fbc8f' }}
          >
            {tagline}
            {!taglineDone && subtitleDone && <span className="cursor-blink" style={{ color: '#00ff41' }}>█</span>}
          </div>

          {/* CTA */}
          <div
            className="flex flex-col items-center gap-4"
            style={{
              opacity: showCTA ? 1 : 0,
              transform: showCTA ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Link
              href="/play"
              className="group relative inline-flex items-center gap-3 px-10 py-4 text-base font-bold tracking-[0.15em] uppercase transition-all duration-300"
              style={{
                color: '#0a0a0a',
                background: '#00ff41',
                boxShadow: '0 0 30px rgba(0,255,65,0.3), inset 0 0 30px rgba(0,255,65,0.1)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 0 50px rgba(0,255,65,0.6), inset 0 0 30px rgba(0,255,65,0.2)';
                e.currentTarget.style.transform = 'scale(1.03)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,65,0.3), inset 0 0 30px rgba(0,255,65,0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span style={{ fontSize: 18 }}>⟩</span>
              JACK IN
              <span style={{ fontSize: 18 }}>⟨</span>
            </Link>
            <span
              className="text-[11px] tracking-[0.2em] uppercase"
              style={{ color: '#336633' }}
            >
              [ NO ACCOUNT REQUIRED — PLAY INSTANTLY ]
            </span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{
            opacity: showCTA ? 0.4 : 0,
            transition: 'opacity 1s ease 0.5s',
          }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: '#336633' }}>
            SCROLL FOR INTEL
          </span>
          <span className="text-lg" style={{ color: '#336633', animation: 'pulse 2s ease-in-out infinite' }}>
            ▾
          </span>
        </div>
      </section>

      {/* ======================== TERMINAL DEMO ======================== */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div
              className="text-[10px] tracking-[0.3em] uppercase mb-4"
              style={{ color: '#336633' }}
            >
              ▸ SYSTEM PREVIEW
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h3
              className="text-2xl sm:text-3xl font-bold mb-8 tracking-[0.05em]"
              style={{ color: '#00ff41', textShadow: '0 0 20px rgba(0,255,65,0.3)' }}
            >
              Your Terminal. Their Lives.
            </h3>
          </Reveal>

          <Reveal delay={200}>
            <div
              className="rounded-sm overflow-hidden"
              style={{
                border: '1px solid #1a3a1a',
                background: 'rgba(0, 10, 0, 0.85)',
                boxShadow: '0 0 40px rgba(0,255,65,0.05), inset 0 0 80px rgba(0,0,0,0.5)',
              }}
            >
              {/* Terminal title bar */}
              <div
                className="flex items-center gap-2 px-4 py-2 text-[10px] tracking-widest uppercase"
                style={{ borderBottom: '1px solid #1a3a1a', color: '#336633' }}
              >
                <span style={{ color: '#00ff41' }}>●</span>
                <span>operator@nebuchadnezzar — mission active</span>
              </div>

              {/* Terminal content */}
              <div className="p-5 sm:p-6 font-mono text-[12px] sm:text-[13px] leading-[1.8]">
                <TerminalLine color="#336633" text="[SYSTEM] Mission briefing loaded — Extraction Omega" />
                <TerminalLine color="#336633" text="[SYSTEM] 3 agents in the field. Time limit: 4:00" />
                <TerminalLine color="#00cc33" text="operator@neb:~$ scan" prefix />
                <TerminalLine color="#8fbc8f" text="▸ Anomaly #47 detected — Pattern break at sector 7-G" />
                <TerminalLine color="#8fbc8f" text="▸ Anomaly #48 detected — Hidden coordinates in feed" />
                <TerminalLine color="#00cc33" text="operator@neb:~$ analyze 47" prefix />
                <TerminalLine color="#ff3333" text="⚠ CRITICAL: Agent Smith detected — ETA 45 seconds to Neo's position" />
                <TerminalLine color="#00cc33" text="operator@neb:~$ route neo exit-alpha" prefix />
                <TerminalLine color="#8fbc8f" text="▸ Neo rerouted. Estimated arrival: 30 seconds" />
                <TerminalLine color="#00cc33" text="operator@neb:~$ alert trinity &quot;Cover Neo — Smith incoming from east&quot;" prefix />
                <TerminalLine color="#00ccff" text='[COMMS] Trinity: "Copy that. Moving to intercept."' />
                <TerminalLine color="#ff3333" text="[INTERCEPTED] Smith: &quot;Why do you persist, Operator?&quot;" />
                <TerminalLine color="#00cc33" text="operator@neb:~$ exit neo phone-3" prefix />
                <TerminalLine color="#00ff41" text="✓ Hardline connected. Neo is out. 2 agents remaining." />
                <div className="mt-2 flex items-center gap-1">
                  <span style={{ color: '#00cc33' }}>operator@neb:~$&nbsp;</span>
                  <span className="cursor-blink" style={{ color: '#00ff41' }}>█</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================== HOW IT WORKS ======================== */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: '#336633' }}>
              ▸ OPERATOR TRAINING PROTOCOL
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h3
              className="text-2xl sm:text-3xl font-bold mb-16 tracking-[0.05em]"
              style={{ color: '#00ff41', textShadow: '0 0 20px rgba(0,255,65,0.3)' }}
            >
              How It Works
            </h3>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                step: '01',
                title: 'READ THE CODE',
                desc: 'Monitor the Matrix feed — a stream of green code rain. Spot anomalies that signal threats. Miss one, and your crew pays the price.',
                icon: '⟨ SCAN ⟩',
              },
              {
                step: '02',
                title: 'GUIDE YOUR CREW',
                desc: 'Route Neo, Trinity, and Morpheus through the Matrix. Find exits, bypass security, coordinate extractions — all from your terminal.',
                icon: '⟨ ROUTE ⟩',
              },
              {
                step: '03',
                title: 'MANAGE THE SHIP',
                desc: 'The Nebuchadnezzar needs you. Allocate power, repair systems, dive to escape Sentinels, and time the EMP for when it matters most.',
                icon: '⟨ STATUS ⟩',
              },
              {
                step: '04',
                title: 'SURVIVE THE CLOCK',
                desc: 'Everything runs in real time. Smith is replicating. Sentinels are closing in. Your agents need an exit. How do you prioritize?',
                icon: '⟨ EMP ⟩',
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={150 + i * 100}>
                <div
                  className="group relative p-6 sm:p-8 transition-all duration-500"
                  style={{
                    background: 'rgba(0, 20, 0, 0.4)',
                    border: '1px solid #0a2a0a',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#1a4a1a';
                    e.currentTarget.style.background = 'rgba(0, 30, 0, 0.5)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,65,0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#0a2a0a';
                    e.currentTarget.style.background = 'rgba(0, 20, 0, 0.4)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="flex items-start gap-5">
                    <div>
                      <span
                        className="text-[40px] font-bold leading-none"
                        style={{ color: '#0d3d0d', fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {item.step}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[10px] tracking-[0.3em] mb-2"
                        style={{ color: '#336633' }}
                      >
                        {item.icon}
                      </div>
                      <h4
                        className="text-base font-bold tracking-[0.1em] mb-3"
                        style={{ color: '#00ff41' }}
                      >
                        {item.title}
                      </h4>
                      <p className="text-sm leading-relaxed" style={{ color: '#6b8f6b' }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================== FEATURES ======================== */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: '#336633' }}>
              ▸ SYSTEM CAPABILITIES
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h3
              className="text-2xl sm:text-3xl font-bold mb-16 tracking-[0.05em]"
              style={{ color: '#00ff41', textShadow: '0 0 20px rgba(0,255,65,0.3)' }}
            >
              Why Operators Don&apos;t Sleep
            </h3>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: '#0d2a0d' }}>
            {[
              {
                label: 'AI-DRIVEN',
                title: 'Every Mission is Unique',
                desc: 'Claude AI generates dynamic dialogue, mission complications, and threat behavior. No two sessions play the same.',
              },
              {
                label: 'REAL-TIME',
                title: '3-Second Tick System',
                desc: 'Threats advance. Agents move. Anomalies escalate. Every tick is a decision point. Ignore a problem — it cascades.',
              },
              {
                label: '6 MISSION TYPES',
                title: 'From Stealth to Chaos',
                desc: 'Extraction. Infiltration. Rescue. Data Heist. Smith Containment. Ship Defense. Each demands different tactics.',
              },
              {
                label: 'MULTI-SYSTEM',
                title: 'Split Your Attention',
                desc: 'Matrix feed, ASCII map, agent comms, ship status — four systems need you simultaneously. Triage is survival.',
              },
              {
                label: 'COMPETITIVE',
                title: 'Daily Challenges',
                desc: 'Same mission for every operator. Leaderboards, survival mode, speedruns. Share your score card.',
              },
              {
                label: 'DEEP',
                title: 'Crew & Ship Management',
                desc: 'Agent fatigue, ship repairs, power allocation, dive depth. Strategic decisions between the firefights.',
              },
            ].map((feat, i) => (
              <Reveal key={feat.label} delay={100 + i * 80}>
                <div
                  className="p-6 sm:p-8 transition-all duration-500"
                  style={{ background: 'rgba(0, 10, 0, 0.85)' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(0, 20, 0, 0.9)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(0, 10, 0, 0.85)';
                  }}
                >
                  <div
                    className="text-[9px] tracking-[0.3em] uppercase mb-3"
                    style={{ color: '#00cc33', opacity: 0.7 }}
                  >
                    {feat.label}
                  </div>
                  <h4
                    className="text-[15px] font-bold tracking-[0.05em] mb-3"
                    style={{ color: '#c0c0c0' }}
                  >
                    {feat.title}
                  </h4>
                  <p className="text-[13px] leading-relaxed" style={{ color: '#5a7a5a' }}>
                    {feat.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================== RANKS ======================== */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: '#336633' }}>
              ▸ PROGRESSION HIERARCHY
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h3
              className="text-2xl sm:text-3xl font-bold mb-4 tracking-[0.05em]"
              style={{ color: '#00ff41', textShadow: '0 0 20px rgba(0,255,65,0.3)' }}
            >
              Climb the Ranks
            </h3>
          </Reveal>

          <Reveal delay={150}>
            <p className="text-sm mb-12 leading-relaxed" style={{ color: '#6b8f6b' }}>
              Every mission, every anomaly detected, every agent extracted alive pushes you higher.
              10 ranks separate a Coppertop from The One.
            </p>
          </Reveal>

          <div className="space-y-[2px]">
            {RANKS_DATA.map((rank, i) => {
              const progress = ((i + 1) / RANKS_DATA.length) * 100;
              const isTop = i >= 8;
              const isMid = i >= 4 && i < 8;
              return (
                <Reveal key={rank.level} delay={100 + i * 60}>
                  <div
                    className="flex items-center gap-4 px-5 py-3 transition-all duration-300"
                    style={{
                      background: isTop
                        ? 'rgba(0, 40, 0, 0.5)'
                        : isMid
                        ? 'rgba(0, 20, 0, 0.4)'
                        : 'rgba(0, 10, 0, 0.3)',
                      borderLeft: `2px solid ${isTop ? '#00ff41' : isMid ? '#0a5a0a' : '#0a2a0a'}`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderLeftColor = '#00ff41';
                      e.currentTarget.style.background = 'rgba(0, 30, 0, 0.5)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderLeftColor = isTop ? '#00ff41' : isMid ? '#0a5a0a' : '#0a2a0a';
                      e.currentTarget.style.background = isTop
                        ? 'rgba(0, 40, 0, 0.5)'
                        : isMid
                        ? 'rgba(0, 20, 0, 0.4)'
                        : 'rgba(0, 10, 0, 0.3)';
                    }}
                  >
                    <span
                      className="text-[11px] font-bold w-6 text-right"
                      style={{ color: '#336633' }}
                    >
                      {String(rank.level).padStart(2, '0')}
                    </span>

                    <span
                      className="text-[13px] font-bold tracking-[0.1em] uppercase flex-1"
                      style={{
                        color: isTop ? '#00ff41' : isMid ? '#00cc33' : '#5a7a5a',
                        textShadow: isTop ? '0 0 10px rgba(0,255,65,0.3)' : 'none',
                      }}
                    >
                      {rank.title}
                    </span>

                    {/* Progress bar */}
                    <div className="hidden sm:flex items-center gap-3 w-48">
                      <div className="flex-1 h-[3px] rounded-full" style={{ background: '#0d1a0d' }}>
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${progress}%`,
                            background: isTop
                              ? '#00ff41'
                              : isMid
                              ? '#0a5a0a'
                              : '#0a3a0a',
                            boxShadow: isTop ? '0 0 6px rgba(0,255,65,0.4)' : 'none',
                          }}
                        />
                      </div>
                      <span className="text-[10px] w-14 text-right" style={{ color: '#336633' }}>
                        {rank.points}
                      </span>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======================== FINAL CTA ======================== */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <div
              className="text-[10px] tracking-[0.3em] uppercase mb-6"
              style={{ color: '#336633' }}
            >
              ▸ TRANSMISSION ENDS
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h3
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-[0.05em]"
              style={{ color: '#00ff41', textShadow: '0 0 30px rgba(0,255,65,0.3)' }}
            >
              <ScrambleText text="The Matrix has you." delay={200} />
            </h3>
          </Reveal>

          <Reveal delay={200}>
            <p className="text-base mb-12 leading-relaxed" style={{ color: '#6b8f6b' }}>
              Your crew is in the field. The feed is scrolling. Smith is moving.<br />
              The only question is — are you ready to operate?
            </p>
          </Reveal>

          <Reveal delay={300}>
            <Link
              href="/play"
              className="inline-flex items-center gap-3 px-12 py-5 text-lg font-bold tracking-[0.15em] uppercase transition-all duration-300"
              style={{
                color: '#0a0a0a',
                background: '#00ff41',
                boxShadow: '0 0 40px rgba(0,255,65,0.3), 0 0 80px rgba(0,255,65,0.1)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 0 60px rgba(0,255,65,0.6), 0 0 120px rgba(0,255,65,0.2)';
                e.currentTarget.style.transform = 'scale(1.03)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 0 40px rgba(0,255,65,0.3), 0 0 80px rgba(0,255,65,0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span>⟩</span> JACK IN <span>⟨</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ======================== FOOTER ======================== */}
      <footer className="relative z-10 py-12 px-6" style={{ borderTop: '1px solid #0d1a0d' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[11px] tracking-[0.15em]" style={{ color: '#2a4a2a' }}>
            MATRIX OPERATOR — A TERMINAL STRATEGY GAME
          </div>
          <div className="text-[11px] tracking-[0.15em]" style={{ color: '#1a3a1a' }}>
            BUILT FOR THE RESISTANCE. POWERED BY AI.
          </div>
        </div>
      </footer>

      {/* Glitch CSS */}
      <style jsx global>{`
        .glitch-text {
          position: relative;
          display: inline-block;
        }
        .glitch-text::before,
        .glitch-text::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .glitch-text::before {
          color: #00ff41;
          animation: glitch-1 3s infinite linear alternate-reverse;
          clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%);
        }
        .glitch-text::after {
          color: #00cc33;
          animation: glitch-2 2.5s infinite linear alternate-reverse;
          clip-path: polygon(0 65%, 100% 65%, 100% 100%, 0 100%);
        }
        @keyframes glitch-1 {
          0%, 92% { transform: translate(0); }
          93% { transform: translate(-3px, 1px); }
          94% { transform: translate(2px, -1px); }
          95% { transform: translate(-1px, 2px); }
          96%, 100% { transform: translate(0); }
        }
        @keyframes glitch-2 {
          0%, 94% { transform: translate(0); }
          95% { transform: translate(2px, 1px); }
          96% { transform: translate(-2px, -1px); }
          97% { transform: translate(1px, 2px); }
          98%, 100% { transform: translate(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translateY(0) translateX(-50%); }
          50% { opacity: 0.7; transform: translateY(4px) translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal line helper
// ---------------------------------------------------------------------------
function TerminalLine({ text, color, prefix = false }: { text: string; color: string; prefix?: boolean }) {
  return (
    <div style={{ color }}>
      {prefix && <span style={{ color: '#00cc33' }}></span>}
      {text}
    </div>
  );
}
