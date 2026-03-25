'use client';

import { useGameStore } from '@/engine/game-state';
import type { GameStateSlice, Threat } from '@/engine/types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function StatusBar() {
  const phase = useGameStore((s: GameStateSlice) => s.currentPhase);
  const rank = useGameStore((s: GameStateSlice) => s.rank);
  const totalScore = useGameStore((s: GameStateSlice) => s.totalScore);
  const mission = useGameStore((s: GameStateSlice) => s.mission);
  const threats = useGameStore((s: GameStateSlice) => s.threats);
  const ship = useGameStore((s: GameStateSlice) => s.ship);

  const activeThreats = threats.filter((t: Threat) => t.active);

  const renderIdleBar = () => (
    <div className="flex flex-wrap gap-4 items-center">
      <span style={{ color: 'var(--green)' }}>
        [RANK: {rank.title}]
      </span>
      <span style={{ color: 'var(--green)' }}>
        [SCORE: {totalScore}]
      </span>
      <span style={{ color: 'var(--cyan)' }}>
        [DEPTH: {ship.depth}km]
      </span>
      {activeThreats.length > 0 && (
        <span style={{ color: 'var(--yellow)' }}>
          [THREATS: {activeThreats.length}]
        </span>
      )}
    </div>
  );

  const renderMissionBar = () => {
    if (!mission) return renderIdleBar();
    const remaining = Math.max(0, mission.timeLimit - mission.elapsedTime);
    const isUrgent = remaining < 10;

    return (
      <div className="flex flex-wrap gap-4 items-center">
        <span style={{ color: 'var(--green)' }}>
          [RANK: {rank.title}]
        </span>
        <span style={{ color: 'var(--green)' }}>
          [SCORE: {totalScore}]
        </span>
        <span style={{ color: 'var(--cyan)' }}>
          [MISSION: {mission.title}]
        </span>
        <span style={{ color: 'var(--yellow)' }}>
          [THREATS: {activeThreats.length}]
        </span>
        <span
          className={isUrgent ? 'alert-flash' : ''}
          style={{ color: isUrgent ? 'var(--red)' : 'var(--green)' }}
        >
          [TIME: {formatTime(remaining)}]
        </span>
        <span style={{ color: 'var(--green-dim)' }}>
          [ELAPSED: {formatTime(mission.elapsedTime)}]
        </span>
      </div>
    );
  };

  const renderShipDefenseBar = () => {
    const hullPct = ship.hull.level;
    const hullColor =
      hullPct > 70 ? 'var(--green)' : hullPct > 40 ? 'var(--yellow)' : 'var(--red)';
    const isHullCritical = hullPct < 25;
    const isSentinelClose = ship.sentinelDistance < 500;

    return (
      <div className="flex flex-wrap gap-4 items-center">
        <span
          className="alert-flash"
          style={{ color: 'var(--red)', fontWeight: 'bold' }}
        >
          [SENTINEL ALERT]
        </span>
        <span
          className={isSentinelClose ? 'alert-flash' : ''}
          style={{ color: isSentinelClose ? 'var(--red)' : 'var(--yellow)' }}
        >
          [DISTANCE: {ship.sentinelDistance}m]
        </span>
        <span style={{ color: 'var(--cyan)' }}>
          [EMP: {ship.empCharge}%]
        </span>
        <span
          className={isHullCritical ? 'alert-flash' : ''}
          style={{ color: hullColor }}
        >
          [HULL: {hullPct}%]
        </span>
        {mission && (
          <span style={{ color: 'var(--green-dim)' }}>
            [TIME: {formatTime(Math.max(0, mission.timeLimit - mission.elapsedTime))}]
          </span>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (phase) {
      case 'mission':
        return renderMissionBar();
      case 'ship_defense':
        return renderShipDefenseBar();
      case 'idle':
      case 'boot':
      default:
        return renderIdleBar();
    }
  };

  // Don't show during boot
  if (phase === 'boot') return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 px-4 py-2 text-xs sm:text-sm font-mono"
      style={{
        zIndex: 50,
        background: 'rgba(0, 10, 0, 0.92)',
        borderBottom: '1px solid var(--green-dark)',
        color: 'var(--green)',
      }}
    >
      {renderContent()}
    </div>
  );
}
