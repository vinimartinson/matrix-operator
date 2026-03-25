'use client';

import { useEffect, useMemo } from 'react';
import { useGameStore } from '@/engine/game-state';
import type { AgentName, GameStateSlice } from '@/engine/types';
import AgentTab from './AgentTab';
import AgentChatFeed from './AgentChatFeed';
import AgentChatInput from './AgentChatInput';

const ALL_AGENTS: AgentName[] = ['neo', 'trinity', 'morpheus', 'niobe', 'ghost'];

const DISPLAY_NAMES: Record<AgentName, string> = {
  neo: 'Neo',
  trinity: 'Trinity',
  morpheus: 'Morpheus',
  niobe: 'Niobe',
  ghost: 'Ghost',
};

export default function AgentCommPanel() {
  const agents = useGameStore((s: GameStateSlice) => s.agents);
  const threats = useGameStore((s: GameStateSlice) => s.threats);
  const activeAgentTab = useGameStore((s: GameStateSlice) => s.activeAgentTab);
  const setActiveAgentTab = useGameStore((s: GameStateSlice) => s.setActiveAgentTab);
  const agentChatHistories = useGameStore((s: GameStateSlice) => s.agentChatHistories);
  const phase = useGameStore((s: GameStateSlice) => s.currentPhase);

  // Agents currently jacked in
  const jackedInAgents = useMemo(
    () => ALL_AGENTS.filter((name) => agents[name].status === 'in_matrix'),
    [agents],
  );

  // Auto-select first jacked-in agent if none selected
  useEffect(() => {
    if (activeAgentTab && agents[activeAgentTab].status === 'in_matrix') return;
    if (jackedInAgents.length > 0) {
      setActiveAgentTab(jackedInAgents[0]);
    } else {
      setActiveAgentTab(null);
    }
  }, [jackedInAgents, activeAgentTab, agents, setActiveAgentTab]);

  // Compute threat proximity per agent
  const threatProximity = useMemo(() => {
    const result: Record<AgentName, 'none' | 'near' | 'contact'> = {
      neo: 'none', trinity: 'none', morpheus: 'none', niobe: 'none', ghost: 'none',
    };
    for (const name of jackedInAgents) {
      const agent = agents[name];
      const activeThreats = threats.filter((t) => t.active);
      if (activeThreats.length === 0) continue;

      let minDist = Infinity;
      for (const t of activeThreats) {
        const d = Math.abs(t.position.x - agent.position.x) + Math.abs(t.position.y - agent.position.y);
        if (d < minDist) minDist = d;
      }

      if (minDist === 0) result[name] = 'contact';
      else if (minDist <= 4) result[name] = 'near';
    }
    return result;
  }, [jackedInAgents, agents, threats]);

  // Count unread messages (messages after last seen)
  const unreadCounts = useMemo(() => {
    const counts: Record<AgentName, number> = {
      neo: 0, trinity: 0, morpheus: 0, niobe: 0, ghost: 0,
    };
    for (const name of jackedInAgents) {
      if (name !== activeAgentTab) {
        // Count agent messages since last viewed
        const msgs = agentChatHistories[name];
        counts[name] = msgs.filter((m) => m.sender === 'agent').length % 10;
      }
    }
    return counts;
  }, [jackedInAgents, agentChatHistories, activeAgentTab]);

  const activeAgent = activeAgentTab ? agents[activeAgentTab] : null;

  // No agents in matrix
  if (jackedInAgents.length === 0 || (phase !== 'mission' && phase !== 'ship_defense')) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'rgba(0, 5, 0, 0.85)',
          borderLeft: '1px solid var(--green-dark)',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          color: 'var(--green-dark)',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ lineHeight: '1.8' }}>
          <div>╔══════════════════════╗</div>
          <div>║  COMM SYSTEM OFFLINE ║</div>
          <div>╠══════════════════════╣</div>
          <div>║  No agents jacked in ║</div>
          <div>╚══════════════════════╝</div>
          <div style={{ marginTop: '12px', fontSize: '11px' }}>
            Jack in an agent to open a comm channel.
          </div>
          <div style={{ fontSize: '11px' }}>
            Use: jack &lt;agent&gt; in
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(0, 5, 0, 0.9)',
        borderLeft: '1px solid var(--green-dark)',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar — tmux style */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          background: 'rgba(0, 8, 0, 0.95)',
          borderBottom: '1px solid var(--green-dark)',
          overflowX: 'auto',
          flexShrink: 0,
          height: '30px',
        }}
      >
        {jackedInAgents.map((name) => (
          <AgentTab
            key={name}
            agentName={name}
            displayName={DISPLAY_NAMES[name]}
            isActive={activeAgentTab === name}
            threatProximity={threatProximity[name]}
            unreadCount={unreadCounts[name]}
            onClick={() => setActiveAgentTab(name)}
          />
        ))}

        {/* Spacer */}
        <div style={{ flex: 1, borderBottom: '2px solid transparent' }} />

        {/* Comm indicator */}
        <div
          style={{
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '10px',
            color: 'var(--green-dark)',
            flexShrink: 0,
          }}
        >
          COMMS
        </div>
      </div>

      {/* Agent skills display */}
      {activeAgent && (
        <div
          style={{
            padding: '3px 10px',
            borderBottom: '1px solid var(--green-dark)',
            display: 'flex',
            gap: '8px',
            fontSize: '10px',
            color: 'var(--green-dim)',
            background: 'rgba(0, 10, 0, 0.7)',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--green-dark)' }}>SKILLS:</span>
          {activeAgent.skills.length === 0 ? (
            <span>none — use /download</span>
          ) : (
            activeAgent.skills.map((skill) => (
              <span key={skill} style={{ color: 'var(--cyan)' }}>
                [{skill}]
              </span>
            ))
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--green-dark)' }}>
            HP:{activeAgent.health}% FTG:{activeAgent.fatigue}%
          </span>
        </div>
      )}

      {/* Chat feed */}
      {activeAgentTab && (
        <AgentChatFeed
          agentName={activeAgentTab}
          displayName={DISPLAY_NAMES[activeAgentTab]}
          messages={agentChatHistories[activeAgentTab]}
        />
      )}

      {/* Chat input */}
      {activeAgentTab && (
        <AgentChatInput
          agentName={activeAgentTab}
          displayName={DISPLAY_NAMES[activeAgentTab]}
        />
      )}
    </div>
  );
}
