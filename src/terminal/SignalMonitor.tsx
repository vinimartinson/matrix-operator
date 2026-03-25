'use client';
// ---------------------------------------------------------------------------
// SignalMonitor – Left panel for Mission 1 (narrative mode).
// Contains BroadcastWave, AnomalyCodeFeed, ThreatRadar, DepthGauge.
// Replaces the LiveMapView when mission.type === 'trinitys_escape'.
// ---------------------------------------------------------------------------

import { useMemo, useEffect, useState } from 'react';
import { useGameStore } from '@/engine/game-state';
import { BroadcastWave, type SpikeType } from './BroadcastWave';
import { AnomalyCodeFeed } from './AnomalyCodeFeed';
import { ThreatRadar } from './ThreatRadar';
import { DepthGauge } from './DepthGauge';
import { TrinityVitals } from './TrinityVitals';
import { HardlineScanner } from './HardlineScanner';

export function SignalMonitor() {
  const beat = useGameStore((s) => s.missionBeat);
  const events = useGameStore((s) => s.events);
  const smithDist = useGameStore((s) => s.smithDistance);
  const shipDepth = useGameStore((s) => s.ship.depth);

  // EMP active for exactly 2s after firing — useState+useEffect so it clears on a timer
  const [empActive, setEmpActive] = useState(false);
  useEffect(() => {
    const lastEmp = [...events].reverse().find((e) => e.type === 'emp_fired');
    if (!lastEmp) return;
    const remaining = 2000 - (Date.now() - lastEmp.timestamp);
    if (remaining <= 0) return;
    setEmpActive(true);
    const id = setTimeout(() => setEmpActive(false), remaining);
    return () => clearTimeout(id);
  }, [events]);

  // Derive spike type from the most recent high-priority event (last 5s)
  const spikeType = useMemo<SpikeType>(() => {
    if (smithDist <= 1) return 'smith';
    const cutoff5s  = Date.now() - 5000;
    const recent    = events.filter((e) => e.timestamp > cutoff5s);
    if (recent.some((e) => e.type === 'smith_contact')) return 'smith';
    // EMP discharge: highest-amplitude spike, clears exactly 2s after firing
    if (empActive) return 'emp';
    if (recent.some((e) => e.type === 'camera_alert')) return 'threat';
    if (smithDist <= 3) return 'threat';
    if (recent.some((e) => e.type === 'deja_vu')) return 'dejavu';
    if (recent.some((e) => e.type === 'anomaly_spawn')) return 'anomaly';
    if (beat === 'extraction' || beat === 'phone_approach') return 'threat';
    if (beat === 'door_blocked') return 'anomaly';
    return 'none';
  }, [events, smithDist, beat, empActive]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '8px 6px',
      background: 'rgba(0,3,0,0.96)',
      overflow: 'hidden',
    }}>
      {/* Broadcast Waveform */}
      <BroadcastWave spikeType={spikeType} depth={shipDepth} />

      {/* Matrix Code Feed — fills remaining space */}
      <AnomalyCodeFeed />

      {/* Bottom row: Threat Radar + Depth Gauge + Hardline Scanner + Trinity Vitals + Mission Status */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, overflowX: 'auto' }}>
        <ThreatRadar />
        <DepthGauge />
        <HardlineScanner />
        <TrinityVitals />
        <NarrativeBeatDisplay beat={beat} />
      </div>
    </div>
  );
}

// Small status display showing current narrative beat + live Trinity status
function NarrativeBeatDisplay({ beat }: { beat: string }) {
  const trinityStatus = useGameStore((s) => s.agents.trinity.status);
  const smithDist = useGameStore((s) => s.smithDistance);

  const beatLabels: Record<string, { label: string; color: string }> = {
    awakening:       { label: 'SIGNAL LOCK', color: '#00ff41' },
    guidance_needed: { label: 'AWAITING OPERATOR', color: '#ffcc00' },
    en_route:        { label: 'MOVING', color: '#00ff41' },
    door_blocked:    { label: 'BLOCKED', color: '#ff8800' },
    path_clear:      { label: 'PATH CLEAR', color: '#00ff41' },
    phone_approach:  { label: 'APPROACHING', color: '#00ccff' },
    extraction:      { label: 'EXTRACTION READY', color: '#ff4444' },
    complete:        { label: 'EXTRACTED', color: '#00ff41' },
  };

  const { label, color } = beatLabels[beat] ?? { label: String(beat).toUpperCase(), color: '#00ff41' };

  const trinityLabel =
    trinityStatus === 'in_matrix' ? 'TRINITY: JACKED IN' :
    trinityStatus === 'resting'   ? 'TRINITY: EXTRACTED' :
    trinityStatus === 'ready'     ? 'TRINITY: ON SHIP' :
    trinityStatus === 'injured'   ? 'TRINITY: INJURED' :
    trinityStatus === 'dead'      ? 'TRINITY: FLATLINE' :
    `TRINITY: ${String(trinityStatus).toUpperCase()}`;

  const trinityColor =
    trinityStatus === 'in_matrix' ? '#00ff41' :
    trinityStatus === 'dead'      ? '#ff0000' :
    trinityStatus === 'injured'   ? '#ff8800' :
    'rgba(0,255,65,0.45)';

  const smithLabel =
    smithDist <= 1 ? '!! CONTACT !!' :
    smithDist <= 3 ? `SMITH: ${smithDist * 10}m ⚠` :
    smithDist <= 6 ? `SMITH: ~${smithDist * 10}m` :
    `SMITH: DISTANT`;

  const smithColor =
    smithDist <= 1 ? '#ff0000' :
    smithDist <= 3 ? '#ff4444' :
    smithDist <= 6 ? '#ff8800' :
    'rgba(0,255,65,0.35)';

  return (
    <div style={{
      flex: 1,
      background: 'rgba(0,5,0,0.85)',
      border: '1px solid rgba(0,255,65,0.2)',
      borderRadius: 2,
      padding: '6px 8px',
      fontFamily: 'var(--font-mono, monospace)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{
        fontSize: 9,
        color: 'rgba(0,255,65,0.5)',
        letterSpacing: '0.15em',
        marginBottom: 6,
      }}>
        MISSION STATUS
      </div>
      <div style={{
        fontSize: 11,
        color,
        fontWeight: 'bold',
        letterSpacing: '0.1em',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 9,
        color: trinityColor,
        marginTop: 4,
        letterSpacing: '0.08em',
      }}>
        {trinityLabel}
      </div>
      <div style={{
        fontSize: 9,
        color: smithColor,
        marginTop: 2,
        letterSpacing: '0.08em',
        animation: smithDist <= 2 ? 'alert-flash 1s infinite' : undefined,
      }}>
        {smithLabel}
      </div>
    </div>
  );
}
