'use client';

import { useState, useEffect } from 'react';
import type { AgentSkill } from '@/engine/types';

interface DownloadAnimationProps {
  skill: AgentSkill;
  agentName: string;
  onComplete: () => void;
}

const SKILL_LABELS: Record<AgentSkill, string> = {
  'kung-fu': 'JIU JITSU / KUNG FU / JUDO PROGRAMS',
  'hacking': 'ICE-BREAKING / BYPASS PROTOCOLS',
  'stealth': 'GHOST-WALK / STEALTH SUBROUTINES',
  'lockpick': 'ELECTROMAGNETIC BYPASS SEQUENCES',
  'combat': 'TACTICAL FIREARMS / CQC PROTOCOLS',
  'pilot': 'APU / HOVERCRAFT NEURAL INTERFACE',
};

const TOTAL_STEPS = 12;
const STEP_DURATION = 200; // ms per step

export default function DownloadAnimation({
  skill,
  agentName,
  onComplete,
}: DownloadAnimationProps) {
  const [step, setStep] = useState(0);
  const label = SKILL_LABELS[skill] ?? skill.toUpperCase();

  useEffect(() => {
    if (step >= TOTAL_STEPS) {
      onComplete();
      return;
    }
    const timeout = setTimeout(() => setStep((s) => s + 1), STEP_DURATION);
    return () => clearTimeout(timeout);
  }, [step, onComplete]);

  const filled = Math.floor((step / TOTAL_STEPS) * 10);
  const empty = 10 - filled;
  const percent = Math.floor((step / TOTAL_STEPS) * 100);
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: '12px',
        padding: '6px 10px',
        background: 'rgba(0, 20, 0, 0.8)',
        border: '1px solid var(--green-dark)',
        borderRadius: '4px',
        color: 'var(--green)',
        margin: '4px 0',
      }}
    >
      <div style={{ color: 'var(--cyan)', marginBottom: '3px' }}>
        ▸ LOADING {label}
      </div>
      <div style={{ color: '#00ff41' }}>
        [{bar}] {percent}%
      </div>
      {step >= TOTAL_STEPS && (
        <div style={{ color: '#00ff41', marginTop: '3px' }}>
          ✓ DOWNLOAD COMPLETE — {agentName.toUpperCase()} UPDATED
        </div>
      )}
    </div>
  );
}
