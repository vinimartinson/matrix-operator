// ---------------------------------------------------------------------------
// Matrix Operator – Autonomous Smith AI
// Each Smith is driven by Claude Haiku, responding to system anomalies,
// failed hacks, camera alerts, and lure signals.
// ---------------------------------------------------------------------------

import type {
  AgentName,
  GameMap,
  GameStateSlice,
  Position,
  Threat,
} from './types';
import { aiCallQueue } from './ai-call-queue';
import { callHaiku } from '@/ai/haiku-client';
import { getMissionMap } from '../missions';
import { advanceSmith } from './threat-engine';
import { isWalkable } from './agent-manager';
import { computeDirectionalPath } from './pathfinding';

// -- Constants --------------------------------------------------------------

/** How often (in ticks) to call Haiku per Smith */
const SMITH_AI_TICK_INTERVAL = 4;

/** Manhattan distance for Smith to detect agents directly */
const SMITH_DETECTION_RADIUS = 2;

// -- Core functions ---------------------------------------------------------

/**
 * Called every game tick for each active Smith.
 * - Between Haiku calls: uses deterministic advanceSmith fallback
 * - Every SMITH_AI_TICK_INTERVAL: calls Haiku for AI decision
 */
export function tickSmithAI(smith: Threat, store: GameStateSlice): void {
  if (!smith.active || smith.type !== 'smith') return;

  const mission = store.mission;
  if (!mission) return;

  const map = getMissionMap(mission.type);
  if (!map) return;

  const currentTick = store.tickCount;
  const lastAITick = smith.aiState?.lastAITick ?? 0;
  const shouldCallAI = currentTick - lastAITick >= SMITH_AI_TICK_INTERVAL;

  if (shouldCallAI) {
    // Queue Haiku call for AI decision
    const smithId = smith.id;
    aiCallQueue.enqueue(async () => {
      await makeSmithDecision(smithId, store, map);
    });
  } else {
    // Between AI ticks: execute planned movement (1 tile toward target)
    // Re-read smith from the live store to get the latest aiState (e.g. updated currentTarget)
    const freshSmith = store.threats.find((t) => t.id === smith.id) ?? smith;
    const target = freshSmith.aiState?.currentTarget;
    if (target) {
      const dx = Math.sign(target.x - freshSmith.position.x);
      const dy = Math.sign(target.y - freshSmith.position.y);
      const next: Position = Math.abs(target.x - freshSmith.position.x) >= Math.abs(target.y - freshSmith.position.y)
        ? { x: freshSmith.position.x + dx, y: freshSmith.position.y }
        : { x: freshSmith.position.x, y: freshSmith.position.y + dy };

      if (isWalkable(map, next, store.hackableElements)) {
        // Update threat position in store
        const updatedThreats = store.threats.map((t) =>
          t.id === smith.id ? { ...t, position: next } : t,
        );
        // Use setState directly since we need to update threats array
        const { useGameStore } = require('./game-state');
        useGameStore.setState({ threats: updatedThreats });
      }
    }
  }
}

// -- Internal ---------------------------------------------------------------

async function makeSmithDecision(
  smithId: string,
  store: GameStateSlice,
  map: GameMap,
): Promise<void> {
  // Re-read state to get latest
  const { useGameStore } = require('./game-state');
  const currentStore = useGameStore.getState() as GameStateSlice;
  const smith = currentStore.threats.find((t: Threat) => t.id === smithId);
  if (!smith || !smith.active) return;

  const agentNames: AgentName[] = ['neo', 'trinity', 'morpheus', 'niobe', 'ghost'];

  // Detect nearby agents (within 2 tiles)
  const nearbyAgents: string[] = [];
  for (const name of agentNames) {
    const agent = currentStore.agents[name];
    if (agent.status !== 'in_matrix') continue;
    const dist = Math.abs(agent.position.x - smith.position.x) + Math.abs(agent.position.y - smith.position.y);
    if (dist <= SMITH_DETECTION_RADIUS) {
      nearbyAgents.push(`${agent.displayName} at (${agent.position.x},${agent.position.y})`);
    }
  }

  // Gather known alerts (alarmed cameras, alarmed elements)
  const knownAlerts = currentStore.hackableElements
    .filter((el) => el.state === 'alarmed')
    .map((el) => `${el.label} (${el.type}) at (${el.position.x},${el.position.y})`);

  // Gather known failed hacks
  const knownFailedHacks = smith.aiState?.knownFailedHacks ?? [];

  // Gather lure signals (breached lure systems)
  const lureSignals = currentStore.hackableElements
    .filter((el) => el.type === 'lure_system' && el.state === 'breached')
    .map((el) => `Strong signal at (${el.position.x},${el.position.y})`);

  const context: Record<string, unknown> = {
    position: `(${smith.position.x}, ${smith.position.y})`,
    level: smith.level,
    knownAlerts,
    knownFailedHacks,
    nearbyAgents,
    lureSignals,
    mapWidth: map.width,
    mapHeight: map.height,
  };

  const response = await callHaiku('smithAutonomousTick', context);

  // Parse the action
  const action = parseSmithResponse(response);

  // Update Smith AI state
  currentStore.updateThreatAIState(smithId, {
    lastAITick: currentStore.tickCount,
    anomalyAware: knownAlerts.length > 0 || lureSignals.length > 0,
    knownFailedHacks: [
      ...knownFailedHacks,
      ...currentStore.hackableElements
        .filter((el) => el.state === 'alarmed')
        .map((el) => el.id)
        .filter((id) => !knownFailedHacks.includes(id)),
    ],
  });

  if (action) {
    executeSmithAction(smithId, action, currentStore, map);
  }
}

interface SmithAction {
  type: 'patrol' | 'investigate' | 'hunt' | 'replicate';
  target?: string;
  steps?: number;
}

function parseSmithResponse(response: string): SmithAction | null {
  const actionMatch = response.match(/<action>([\s\S]*?)<\/action>/);
  if (!actionMatch) return null;

  try {
    return JSON.parse(actionMatch[1]);
  } catch {
    return null;
  }
}

function executeSmithAction(
  smithId: string,
  action: SmithAction,
  store: GameStateSlice,
  map: GameMap,
): void {
  const smith = store.threats.find((t) => t.id === smithId);
  if (!smith) return;

  const { useGameStore } = require('./game-state');

  if (action.type === 'replicate' && smith.level >= 3) {
    // Replicate Smith
    const { replicateSmith } = require('./threat-engine');
    const copy = replicateSmith(smith);
    if (copy) {
      store.addThreat(copy);
      store.addTerminalLine('[THREAT] Smith is replicating...', 'critical');
    }
    return;
  }

  // For patrol/investigate/hunt, resolve the target position
  const target = action.target?.toLowerCase() ?? '';
  const steps = action.steps ?? 1;

  // Directional movement
  const directions = ['north', 'south', 'east', 'west'] as const;
  const matchedDir = directions.find((d) => target.includes(d));

  let newTarget: Position | null = null;

  if (matchedDir) {
    const path = computeDirectionalPath(smith.position, matchedDir, steps, map, store.hackableElements);
    if (path.length > 0) {
      newTarget = path[path.length - 1];
    }
  } else {
    // Coordinate target
    const coordMatch = target.match(/\(?\s*(\d+)\s*,\s*(\d+)\s*\)?/);
    if (coordMatch) {
      newTarget = { x: parseInt(coordMatch[1]), y: parseInt(coordMatch[2]) };
    }
  }

  if (newTarget) {
    store.updateThreatAIState(smithId, { currentTarget: newTarget });

    // Move 1 step toward target immediately
    const dx = Math.sign(newTarget.x - smith.position.x);
    const dy = Math.sign(newTarget.y - smith.position.y);
    const next: Position = Math.abs(newTarget.x - smith.position.x) >= Math.abs(newTarget.y - smith.position.y)
      ? { x: smith.position.x + dx, y: smith.position.y }
      : { x: smith.position.x, y: smith.position.y + dy };

    if (isWalkable(map, next, store.hackableElements)) {
      const updatedThreats = store.threats.map((t) =>
        t.id === smithId ? { ...t, position: next } : t,
      );
      useGameStore.setState({ threats: updatedThreats });
    }
  }
}
