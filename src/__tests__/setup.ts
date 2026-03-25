import { vi, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all outbound AI / API calls so tests run offline and deterministically
// ---------------------------------------------------------------------------

vi.mock('@/engine/mission-orchestrator', () => ({
  callOrchestrator: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/ai/dialogue-generator', () => ({
  generateAgentDialogue: vi.fn().mockResolvedValue('Operator. Standing by.'),
}));

// Silence localStorage errors in Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    },
  });
}

// ---------------------------------------------------------------------------
// Register commands once for the entire test suite
// ---------------------------------------------------------------------------

import { commandRegistry } from '@/engine/command-registry';
import { registerAllCommands } from '@/data/commands';

beforeAll(() => {
  registerAllCommands(commandRegistry);
});

// ---------------------------------------------------------------------------
// Reset store to a clean, post-boot idle state before every test
// ---------------------------------------------------------------------------

import { useGameStore } from '@/engine/game-state';

beforeEach(() => {
  useGameStore.getState().reset();
  useGameStore.setState({
    currentPhase: 'idle',
    inputEnabled: true,
    bootComplete: true,
  });
});
