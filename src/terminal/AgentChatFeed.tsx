'use client';

import { useEffect, useRef } from 'react';
import type { AgentName, ChatMessage } from '@/engine/types';

const AGENT_COLORS: Record<AgentName, string> = {
  neo: '#00ff41',
  trinity: 'var(--cyan)',
  morpheus: 'var(--yellow)',
  niobe: 'var(--orange)',
  ghost: '#aaa',
};

interface AgentChatFeedProps {
  agentName: AgentName;
  displayName: string;
  messages: ChatMessage[];
}

export default function AgentChatFeed({
  agentName,
  displayName,
  messages,
}: AgentChatFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const agentColor = AGENT_COLORS[agentName];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: '12px',
      }}
    >
      {messages.length === 0 && (
        <div
          style={{
            color: 'var(--green-dark)',
            textAlign: 'center',
            marginTop: '20px',
            lineHeight: '1.6',
          }}
        >
          <div>╔══════════════════════════╗</div>
          <div>║  {displayName.toUpperCase().padEnd(24)}║</div>
          <div>║  COMM CHANNEL OPEN       ║</div>
          <div>╚══════════════════════════╝</div>
          <div style={{ marginTop: '8px', fontSize: '11px' }}>
            Send instructions via chat below.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--green-dark)' }}>
            Type /download &lt;skill&gt; to upload programs.
          </div>
        </div>
      )}

      {messages.map((msg) => {
        if (msg.sender === 'operator') {
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <span style={{ color: '#444', fontSize: '10px' }}>{formatTime(msg.timestamp)}</span>
                <span style={{ color: 'var(--green-dim)', fontWeight: 'bold' }}>OPR</span>
              </div>
              <div
                style={{
                  background: 'rgba(0, 30, 0, 0.6)',
                  border: '1px solid var(--green-dark)',
                  borderRadius: '4px 4px 0 4px',
                  padding: '4px 8px',
                  maxWidth: '85%',
                  color: 'var(--green)',
                  lineHeight: '1.4',
                  wordBreak: 'break-word',
                }}
              >
                {msg.text}
              </div>
            </div>
          );
        }

        if (msg.sender === 'system') {
          return (
            <div
              key={msg.id}
              style={{
                textAlign: 'center',
                color: 'var(--yellow)',
                fontSize: '11px',
                padding: '2px 0',
                borderTop: '1px solid rgba(255,200,0,0.2)',
                borderBottom: '1px solid rgba(255,200,0,0.2)',
              }}
            >
              ⚡ {msg.text}
            </div>
          );
        }

        // Agent message
        return (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span
                style={{
                  color: agentColor,
                  fontWeight: 'bold',
                  textShadow: `0 0 6px ${agentColor}`,
                }}
              >
                {displayName.toUpperCase()}
              </span>
              <span style={{ color: '#444', fontSize: '10px' }}>{formatTime(msg.timestamp)}</span>
            </div>
            <div
              style={{
                background: 'rgba(0, 15, 0, 0.5)',
                border: `1px solid ${agentColor}33`,
                borderRadius: '0 4px 4px 4px',
                padding: '4px 8px',
                maxWidth: '85%',
                color: agentColor,
                lineHeight: '1.4',
                wordBreak: 'break-word',
              }}
            >
              {msg.text}
              {msg.action && msg.action.type !== 'none' && (
                <div
                  style={{
                    marginTop: '3px',
                    fontSize: '10px',
                    color: msg.action.success ? '#00ff41' : 'var(--red)',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: '2px',
                  }}
                >
                  [{msg.action.type.toUpperCase()}{msg.action.target ? ` → ${msg.action.target}` : ''}
                  {msg.action.success !== undefined ? (msg.action.success ? ' ✓' : ' ✗') : ''}]
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
