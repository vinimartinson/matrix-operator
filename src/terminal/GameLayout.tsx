'use client';

import LiveMapView from './LiveMapView';
import Terminal from './Terminal';
import AgentCommPanel from './AgentCommPanel';
import { SignalMonitor } from './SignalMonitor';
import { useGameStore } from '@/engine/game-state';

interface GameLayoutProps {
  onCommand: (command: string) => void;
}

/**
 * New game layout — map-prominent design.
 *
 * +--------------------------------------------------+
 * |                               |  Agent Comms     |
 * |     LIVE MAP (70%)            |  (30%)           |
 * |     (big, prominent)          |  [Trinity] tabs  |
 * |                               |  Chat feed       |
 * +-------------------------------+------------------+
 * |  Operator Terminal (full width, ~30% height)      |
 * |  operator@neb:~$ hack cam-1                       |
 * +--------------------------------------------------+
 */
export default function GameLayout({ onCommand }: GameLayoutProps) {
  const mission = useGameStore((s) => s.mission);
  const isMissionActive = mission?.status === 'active';
  const isNarrativeMission = isMissionActive && mission?.type === 'trinitys_escape';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
      onMouseDown={(e) => {
        // Prevent non-interactive clicks from stealing focus away from the
        // active input (terminal or agent chat).
        const target = e.target as HTMLElement;
        if (!target.closest('input, textarea, button, a, select, [contenteditable]')) {
          e.preventDefault();
        }
      }}
    >
      {/* Top area: Map + Agent Comms side by side */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flex: '1 1 70%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left panel: Signal Monitor (narrative missions) or Live Map (others) */}
        <div
          style={{
            flex: '0 0 70%',
            minWidth: 0,
            height: '100%',
            overflow: isNarrativeMission ? 'hidden' : 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {isNarrativeMission ? <SignalMonitor /> : <LiveMapView />}
        </div>

        {/* Agent Comm Panel — right side (30% of top area) */}
        <div
          style={{
            flex: '0 0 30%',
            minWidth: 0,
            height: '100%',
            overflow: 'hidden',
            borderLeft: '1px solid var(--green-dark)',
          }}
        >
          <AgentCommPanel />
        </div>
      </div>

      {/* Bottom: Operator Terminal — full width, ~30% height */}
      <div
        style={{
          flex: '0 0 30%',
          minHeight: '200px',
          overflow: 'hidden',
          borderTop: '1px solid var(--green-dark)',
        }}
      >
        <Terminal onCommand={onCommand} />
      </div>
    </div>
  );
}
