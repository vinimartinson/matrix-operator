'use client';

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { useGameStore } from '@/engine/game-state';
import { sendOperatorGuidance } from '@/engine/agent-ai';
import { callOrchestrator } from '@/engine/mission-orchestrator';
import type { AgentName, AgentSkill, ChatMessage, GameStateSlice } from '@/engine/types';
import DownloadAnimation from './DownloadAnimation';

const VALID_SKILLS: AgentSkill[] = ['kung-fu', 'hacking', 'stealth', 'lockpick', 'combat', 'pilot'];

const AGENT_COLORS: Record<AgentName, string> = {
  neo: '#00ff41',
  trinity: 'var(--cyan)',
  morpheus: 'var(--yellow)',
  niobe: 'var(--orange)',
  ghost: '#aaa',
};

interface AgentChatInputProps {
  agentName: AgentName;
  displayName: string;
}

function makeId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function AgentChatInput({ agentName, displayName }: AgentChatInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [downloadSkill, setDownloadSkill] = useState<AgentSkill | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-focus when the active agent tab switches
  useEffect(() => {
    inputRef.current?.focus();
  }, [agentName]);

  const addChatMessage = useGameStore((s: GameStateSlice) => s.addChatMessage);
  const agentSkills = useGameStore((s: GameStateSlice) => s.agents[agentName].skills);
  const updateAgentSkills = useGameStore((s: GameStateSlice) => s.updateAgentSkills);
  const missionType = useGameStore((s: GameStateSlice) => s.mission?.type);
  const isNarrativeMission = missionType === 'trinitys_escape';

  const agentColor = AGENT_COLORS[agentName];

  const callSkillDownload = useCallback(async (skill: AgentSkill): Promise<string> => {
    const res = await fetch('/api/haiku', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptType: 'skillDownload',
        context: { agentName, skill, currentSkills: agentSkills },
      }),
    });
    if (!res.ok) return `${displayName}: Program loaded.`;
    const data = await res.json();
    return data.text || `${displayName}: I feel different.`;
  }, [agentName, displayName, agentSkills]);

  const handleDownloadComplete = useCallback(async () => {
    if (!downloadSkill) return;
    const newSkills = agentSkills.includes(downloadSkill)
      ? agentSkills
      : [...agentSkills, downloadSkill];
    updateAgentSkills(agentName, newSkills);

    let flavorText = `${displayName}: Program assimilated.`;
    try {
      flavorText = await callSkillDownload(downloadSkill);
    } catch {
      // fallback text already set
    }

    addChatMessage(agentName, {
      id: makeId(),
      timestamp: Date.now(),
      sender: 'agent',
      text: flavorText,
    });

    setDownloadSkill(null);
  }, [downloadSkill, agentSkills, agentName, displayName, addChatMessage, updateAgentSkills, callSkillDownload]);

  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput('');
    setHistory((prev) => {
      const next = prev.filter((h) => h !== trimmed);
      next.push(trimmed);
      return next.slice(-50);
    });
    setHistoryIndex(-1);

    // Handle /download slash command
    if (trimmed.toLowerCase().startsWith('/download')) {
      const parts = trimmed.split(/\s+/);
      const skillArg = parts[1]?.toLowerCase() as AgentSkill | undefined;

      if (!skillArg) {
        addChatMessage(agentName, {
          id: makeId(),
          timestamp: Date.now(),
          sender: 'system',
          text: `Usage: /download <skill>  |  Skills: ${VALID_SKILLS.join(', ')}`,
        });
        return;
      }

      if (!VALID_SKILLS.includes(skillArg)) {
        addChatMessage(agentName, {
          id: makeId(),
          timestamp: Date.now(),
          sender: 'system',
          text: `Unknown program: "${skillArg}". Valid: ${VALID_SKILLS.join(', ')}`,
        });
        return;
      }

      if (agentSkills.includes(skillArg)) {
        addChatMessage(agentName, {
          id: makeId(),
          timestamp: Date.now(),
          sender: 'system',
          text: `${displayName} already has ${skillArg}.`,
        });
        return;
      }

      addChatMessage(agentName, {
        id: makeId(),
        timestamp: Date.now(),
        sender: 'operator',
        text: trimmed,
      });
      setDownloadSkill(skillArg);
      return;
    }

    // Add operator message to chat
    addChatMessage(agentName, {
      id: makeId(),
      timestamp: Date.now(),
      sender: 'operator',
      text: trimmed,
    });

    setLoading(true);
    try {
      if (isNarrativeMission) {
        // Narrative mission — route to Sonnet orchestrator.
        // Orchestrator applies narrative line + Trinity response directly to store.
        await callOrchestrator(trimmed, false);
      } else {
        // Standard mission — send guidance to agent AI + immediate Haiku dialogue.
        const store = useGameStore.getState();
        sendOperatorGuidance(agentName, trimmed, store);

        const res = await fetch('/api/haiku', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptType: 'agentDialogue',
            context: {
              agentName,
              situation: store.mission?.title ?? 'In the Matrix',
              playerCommand: trimmed,
              agentStatus: store.agents[agentName].status,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const response = data.text || `${displayName}: Copy that.`;
          addChatMessage(agentName, {
            id: makeId(),
            timestamp: Date.now(),
            sender: 'agent',
            text: response,
          });
        }
      }
    } catch {
      if (!isNarrativeMission) {
        addChatMessage(agentName, {
          id: makeId(),
          timestamp: Date.now(),
          sender: 'agent',
          text: `${displayName}: Copy that.`,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [agentName, displayName, loading, isNarrativeMission, agentSkills, addChatMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSubmit(input);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length === 0) return;
        const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(idx);
        setInput(history[idx]);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === -1) return;
        const idx = historyIndex + 1;
        if (idx >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(idx);
          setInput(history[idx]);
        }
        return;
      }
    },
    [input, history, historyIndex, handleSubmit],
  );

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Download animation */}
      {downloadSkill && (
        <div style={{ padding: '4px 10px' }}>
          <DownloadAnimation
            skill={downloadSkill}
            agentName={displayName}
            onComplete={handleDownloadComplete}
          />
        </div>
      )}

      {/* Input bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          borderTop: '1px solid var(--green-dark)',
          background: 'rgba(0, 8, 0, 0.95)',
          gap: '6px',
        }}
      >
        <span
          style={{
            color: agentColor,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 'bold',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          OPR›
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || !!downloadSkill}
          placeholder={
            downloadSkill
              ? 'Downloading program...'
              : loading
              ? `${displayName} responding...`
              : `Guide ${displayName} or /download <skill>`
          }
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--green)',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            fontSize: '12px',
            opacity: loading || downloadSkill ? 0.5 : 1,
            caretColor: agentColor,
          }}
        />
        {loading && (
          <span
            style={{ color: agentColor, fontSize: '11px', flexShrink: 0 }}
            className="cursor-blink"
          >
            ···
          </span>
        )}
      </div>
    </div>
  );
}
