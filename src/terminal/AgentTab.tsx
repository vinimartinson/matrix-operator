'use client';

import type { AgentName } from '@/engine/types';

const AGENT_COLORS: Record<AgentName, string> = {
  neo: '#00ff41',
  trinity: 'var(--cyan)',
  morpheus: 'var(--yellow)',
  niobe: 'var(--orange)',
  ghost: '#aaa',
};

interface AgentTabProps {
  agentName: AgentName;
  displayName: string;
  isActive: boolean;
  threatProximity: 'none' | 'near' | 'contact';
  unreadCount: number;
  onClick: () => void;
}

export default function AgentTab({
  agentName,
  displayName,
  isActive,
  threatProximity,
  unreadCount,
  onClick,
}: AgentTabProps) {
  const color = AGENT_COLORS[agentName];
  const hasThreat = threatProximity !== 'none';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        background: isActive ? 'rgba(0, 30, 0, 0.95)' : 'rgba(0, 10, 0, 0.7)',
        border: 'none',
        borderTop: isActive ? `2px solid ${color}` : '2px solid transparent',
        borderRight: '1px solid var(--green-dark)',
        color: isActive ? color : 'var(--green-dim)',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: '12px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, color 0.15s',
        position: 'relative',
        flexShrink: 0,
      }}
      title={`${displayName} channel`}
    >
      {/* Color dot */}
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: isActive ? `0 0 5px ${color}` : 'none',
        }}
      />

      {displayName.toUpperCase()}

      {/* Threat badge */}
      {hasThreat && (
        <span
          className={threatProximity === 'contact' ? 'alert-flash' : ''}
          style={{
            color: 'var(--red)',
            fontWeight: 'bold',
            fontSize: '11px',
            marginLeft: '2px',
          }}
        >
          !
        </span>
      )}

      {/* Unread badge */}
      {unreadCount > 0 && !isActive && (
        <span
          style={{
            background: color,
            color: '#000',
            borderRadius: '3px',
            padding: '0 3px',
            fontSize: '10px',
            fontWeight: 'bold',
            minWidth: '16px',
            textAlign: 'center',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
