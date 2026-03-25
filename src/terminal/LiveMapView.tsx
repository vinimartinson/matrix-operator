'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGameStore } from '@/engine/game-state';
import { renderMap } from '@/terminal/MapView';
import { getMissionMap } from '../missions';
import { useInterval } from '@/hooks/useInterval';
import type { GameStateSlice } from '@/engine/types';

const MAP_REFRESH_MS = 3500;

export default function LiveMapView() {
  const mission = useGameStore((s: GameStateSlice) => s.mission);
  const agents = useGameStore((s: GameStateSlice) => s.agents);
  const threats = useGameStore((s: GameStateSlice) => s.threats);
  const hackableElements = useGameStore((s: GameStateSlice) => s.hackableElements);
  const phase = useGameStore((s: GameStateSlice) => s.currentPhase);
  const routePreviews = useGameStore((s: GameStateSlice) => s.routePreviews);

  const [mapLines, setMapLines] = useState<string[]>([]);
  const [refreshFlash, setRefreshFlash] = useState(false);

  const renderCurrentMap = useCallback(() => {
    if (!mission || (phase !== 'mission' && phase !== 'ship_defense')) {
      setMapLines([]);
      return;
    }

    const map = getMissionMap(mission.type);
    if (!map) return;

    const agentList = Object.values(agents);
    const newLines = renderMap(map, agentList, threats, hackableElements, routePreviews as Record<string, import('@/engine/types').Position[]>);

    setMapLines((prev) => {
      // Only flash if map actually changed
      if (prev.join('') !== newLines.join('')) {
        setRefreshFlash(true);
        setTimeout(() => setRefreshFlash(false), 200);
      }
      return newLines;
    });
  }, [mission, agents, threats, hackableElements, phase, routePreviews]);

  // Initial render
  useEffect(() => {
    renderCurrentMap();
  }, [renderCurrentMap]);

  // Auto-refresh
  useInterval(
    renderCurrentMap,
    phase === 'mission' || phase === 'ship_defense' ? MAP_REFRESH_MS : null,
  );

  if (mapLines.length === 0) return null;

  return (
    <div
      style={{
        background: 'rgba(0, 5, 0, 0.92)',
        borderBottom: '1px solid var(--green-dark)',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: '12px',
        lineHeight: '1.3',
        color: 'var(--green)',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        transition: 'opacity 0.15s ease',
        opacity: refreshFlash ? 0.85 : 1,
      }}
    >
      {/* Refresh indicator */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 8,
          fontSize: '10px',
          color: refreshFlash ? 'var(--green)' : 'var(--green-dark)',
          fontFamily: "'JetBrains Mono', monospace",
          transition: 'color 0.2s ease',
          userSelect: 'none',
          zIndex: 1,
        }}
      >
        ◉ LIVE
      </div>

      <div style={{ padding: '6px 8px', overflowX: 'auto' }}>
        {mapLines.map((line, i) => (
          <div
            key={i}
            style={{ whiteSpace: 'pre', minHeight: '1.3em' }}
            dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
          />
        ))}
      </div>
    </div>
  );
}
