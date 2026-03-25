'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/engine/game-state';
import { commandRegistry } from '@/engine/command-registry';
import { gameLoop } from '@/engine/game-loop';
import { registerAllCommands } from '@/data/commands';
import MatrixRain from '@/terminal/MatrixRain';
import StatusBar from '@/terminal/StatusBar';
import GameLayout from '@/terminal/GameLayout';
import type { AgentName, GamePhase, GameStateSlice } from '@/engine/types';

const AGENT_NAMES: AgentName[] = ['neo', 'trinity', 'morpheus', 'niobe', 'ghost'];

// ---------------------------------------------------------------------------
// Boot sequence text
// ---------------------------------------------------------------------------

const BOOT_LINES: { text: string; delay: number; className?: string }[] = [
  { text: '', delay: 300 },
  { text: 'NEBUCHADNEZZAR OS v4.7.2', delay: 100, className: 'system' },
  { text: 'Initializing operator console...', delay: 400 },
  { text: '', delay: 200 },
  { text: 'Establishing broadcast signal.......... OK', delay: 600 },
  { text: 'Matrix feed synchronization............ OK', delay: 500 },
  { text: 'Crew status check...................... OK', delay: 400 },
  { text: 'Ship diagnostics....................... [2 WARNINGS]', delay: 500, className: 'warning' },
  { text: 'Sentinel proximity scan................ CLEAR', delay: 700 },
  { text: '', delay: 300 },
  { text: '=== DAILY BRIEFING ===', delay: 200, className: 'cyan' },
  { text: 'Date: Day 47 of the Resistance', delay: 100 },
  { text: 'Ship Location: Tunnel Section 7-Alpha, Depth 2.4km', delay: 100 },
  { text: 'Crew Status: All hands operational', delay: 100 },
  { text: '', delay: 200 },
  { text: 'Type "help" for commands. Type "missions" to begin.', delay: 100, className: 'system' },
  { text: '', delay: 100 },
];

// ---------------------------------------------------------------------------
// Play page component
// ---------------------------------------------------------------------------

export default function PlayPage() {
  const initialized = useRef(false);
  const bootRunning = useRef(false);

  const phase = useGameStore((s: GameStateSlice) => s.currentPhase);
  const bootComplete = useGameStore((s: GameStateSlice) => s.bootComplete);
  const narrativeQueue = useGameStore((s: GameStateSlice) => s.narrativeQueue);

  // -------------------------------------------------------------------------
  // Drain narrativeQueue into terminal
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (narrativeQueue.length === 0) return;
    const store = useGameStore.getState();
    for (const line of narrativeQueue) {
      store.addTerminalLine(`▸ ${line}`, 'system');
    }
    store.clearNarrativeQueue();
  }, [narrativeQueue]);

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Register all commands
    registerAllCommands(commandRegistry);

    // Try to load saved state
    const store = useGameStore.getState();
    const loaded = store.loadFromLocalStorage();

    if (loaded && store.bootComplete) {
      // Resume from saved state — skip boot
      store.setPhase('idle');
      store.setInputEnabled(true);
      store.addTerminalLine('Session restored. Welcome back, Operator.', 'system');
      store.addTerminalLine('Type "help" for commands. Type "missions" to begin.', 'system');
      store.addTerminalLine('', undefined);
    } else {
      // Run boot sequence
      runBootSequence();
    }

    // Start game loop
    gameLoop.start();

    return () => {
      gameLoop.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Boot sequence
  // -------------------------------------------------------------------------

  const runBootSequence = useCallback(async () => {
    if (bootRunning.current) return;
    bootRunning.current = true;

    const store = useGameStore.getState();
    store.setPhase('boot');
    store.setInputEnabled(false);
    store.clearTerminal();

    for (const line of BOOT_LINES) {
      await sleep(line.delay);
      useGameStore.getState().addTerminalLine(line.text, line.className);
    }

    // Boot complete
    await sleep(300);
    const finalStore = useGameStore.getState();
    finalStore.setBootComplete(true);
    finalStore.setPhase('idle');
    finalStore.setInputEnabled(true);

    bootRunning.current = false;
  }, []);

  // -------------------------------------------------------------------------
  // Command handler
  // -------------------------------------------------------------------------

  const handleCommand = useCallback((input: string) => {
    const store = useGameStore.getState();

    // Echo the command
    store.addTerminalLine(`operator@neb:~$ ${input}`, 'dim');

    // Execute via registry
    const result = commandRegistry.execute(input, store);

    // Add output lines
    for (const line of result.output) {
      store.addTerminalLine(line, result.className);
    }

    // Add empty line after output
    if (result.output.length > 0) {
      store.addTerminalLine('', undefined);
    }

    // Bridge: `call <agent>` auto-switches to that agent's chat tab
    const parts = input.trim().toLowerCase().split(/\s+/);
    if (parts[0] === 'call' && parts[1]) {
      const agentName = AGENT_NAMES.find((n) => n === parts[1] || parts[1].startsWith(n.slice(0, 3)));
      if (agentName && store.agents[agentName].status === 'in_matrix') {
        store.setActiveAgentTab(agentName);
      }
    }

    // Auto-save after each command
    store.saveToLocalStorage();
  }, []);

  // -------------------------------------------------------------------------
  // Matrix rain intensity based on game phase
  // -------------------------------------------------------------------------

  const getRainIntensity = (): 'low' | 'medium' | 'high' => {
    switch (phase) {
      case 'boot':
        return 'low';
      case 'idle':
        return 'low';
      case 'mission':
        return 'medium';
      case 'ship_defense':
        return 'high';
      case 'game_over':
        return 'high';
      default:
        return 'low';
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: '#000' }}
    >
      {/* Matrix rain background */}
      <MatrixRain intensity={getRainIntensity()} />

      {/* Status bar */}
      <StatusBar />

      {/* Main content — split layout */}
      <div
        className="relative w-full h-full flex flex-col"
        style={{
          paddingTop: phase === 'boot' ? '0' : '40px',
          zIndex: 10,
        }}
      >
        <GameLayout onCommand={handleCommand} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
