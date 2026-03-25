// ---------------------------------------------------------------------------
// Matrix Operator – Autonomous Agent AI
// Each jacked-in agent is driven by Claude Haiku, making their own movement
// decisions based on operator guidance and local awareness.
// ---------------------------------------------------------------------------

import type {
  AgentName,
  GameMap,
  GameStateSlice,
  HackableElement,
  Position,
  Threat,
} from './types';
import { isWalkable } from './agent-manager';
import { findPath, computeDirectionalPath, getTilesInRadius } from './pathfinding';
import { aiCallQueue } from './ai-call-queue';
import { callHaiku } from '@/ai/haiku-client';
import { getMissionMap } from '../missions';

// -- Constants --------------------------------------------------------------

/** How often (in ticks) to call Haiku for an agent decision */
const AI_TICK_INTERVAL = 3;

/** Manhattan distance for agent visibility */
const AGENT_VISION_RADIUS = 2;

// -- Types ------------------------------------------------------------------

export interface AgentAwareness {
  agentPosition: Position;
  visibleTiles: Position[];
  visibleThreats: Threat[];
  visibleHackables: HackableElement[];
  adjacentWalls: { north: boolean; south: boolean; east: boolean; west: boolean };
  nearbyPhones: Position[];
}

// -- Core functions ---------------------------------------------------------

/**
 * Called every game tick for each jacked-in agent.
 * - Between Haiku calls: walks the planned path (1 tile/tick)
 * - Every AI_TICK_INTERVAL: calls Haiku for a new decision
 */
export function tickAgentAI(agentName: AgentName, store: GameStateSlice): void {
  const agent = store.agents[agentName];
  if (agent.status !== 'in_matrix') return;

  const mission = store.mission;
  if (!mission) return;

  const map = getMissionMap(mission.type);
  if (!map) return;

  const aiState = agent.aiState;
  const currentTick = store.tickCount;

  // Step the agent along its planned path (1 tile per tick)
  if (aiState?.plannedPath && aiState.plannedPath.length > 0) {
    const nextPos = aiState.plannedPath[0];
    if (isWalkable(map, nextPos, store.hackableElements)) {
      store.updateAgent(agentName, { position: { ...nextPos } });
      const remainingPath = aiState.plannedPath.slice(1);
      store.updateAgentAIState(agentName, { plannedPath: remainingPath });
      store.updateRoutePreview(agentName, remainingPath);

      // Post action message to chat
      store.addChatMessage(agentName, {
        id: `action-${Date.now()}`,
        timestamp: Date.now(),
        sender: 'system',
        text: `[MOVE] ${agent.displayName} moved to (${nextPos.x}, ${nextPos.y})`,
        action: { type: 'move', target: `(${nextPos.x},${nextPos.y})`, success: true },
      });
    } else {
      // Path blocked — clear it
      store.updateAgentAIState(agentName, { plannedPath: [], isMoving: false });
      store.updateRoutePreview(agentName, []);
      store.addChatMessage(agentName, {
        id: `blocked-${Date.now()}`,
        timestamp: Date.now(),
        sender: 'system',
        text: `[BLOCKED] ${agent.displayName} — path obstructed`,
      });
    }
  }

  // Check if it's time for a Haiku AI decision
  const lastAITick = aiState?.lastAITick ?? 0;
  const hasNewGuidance = (aiState?.lastGuidance ?? '') !== '';
  const shouldCallAI = (currentTick - lastAITick >= AI_TICK_INTERVAL) || hasNewGuidance;

  if (!shouldCallAI) return;

  // Queue the Haiku call
  aiCallQueue.enqueue(async () => {
    await makeAgentDecision(agentName, store, map);
  });
}

/**
 * Send operator guidance to the agent's AI state.
 * The agent will process this on its next AI tick.
 */
export function sendOperatorGuidance(
  agentName: AgentName,
  message: string,
  store: GameStateSlice,
): void {
  store.updateAgentAIState(agentName, { lastGuidance: message });
}

/**
 * Compute what the agent can see (2-tile Manhattan radius).
 */
export function computeAgentAwareness(
  agent: { position: Position },
  map: GameMap,
  threats: Threat[],
  hackableElements: HackableElement[],
): AgentAwareness {
  const visibleTiles = getTilesInRadius(agent.position, AGENT_VISION_RADIUS, map);

  const visibleThreats = threats.filter(
    (t) =>
      t.active &&
      Math.abs(t.position.x - agent.position.x) + Math.abs(t.position.y - agent.position.y) <= AGENT_VISION_RADIUS,
  );

  const visibleHackables = hackableElements.filter(
    (el) =>
      Math.abs(el.position.x - agent.position.x) + Math.abs(el.position.y - agent.position.y) <= AGENT_VISION_RADIUS,
  );

  const adjacentWalls = {
    north: !isWalkable(map, { x: agent.position.x, y: agent.position.y - 1 }, hackableElements),
    south: !isWalkable(map, { x: agent.position.x, y: agent.position.y + 1 }, hackableElements),
    west: !isWalkable(map, { x: agent.position.x - 1, y: agent.position.y }, hackableElements),
    east: !isWalkable(map, { x: agent.position.x + 1, y: agent.position.y }, hackableElements),
  };

  const nearbyPhones = map.phonePositions.filter(
    (p) =>
      Math.abs(p.x - agent.position.x) + Math.abs(p.y - agent.position.y) <= AGENT_VISION_RADIUS,
  );

  return {
    agentPosition: { ...agent.position },
    visibleTiles,
    visibleThreats,
    visibleHackables,
    adjacentWalls,
    nearbyPhones,
  };
}

// -- Internal ---------------------------------------------------------------

async function makeAgentDecision(
  agentName: AgentName,
  _initialStore: GameStateSlice,
  map: GameMap,
): Promise<void> {
  // Re-read fresh state — the queue may delay execution by several seconds
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useGameStore } = require('./game-state');
  const store = useGameStore.getState() as GameStateSlice;

  const agent = store.agents[agentName];
  if (agent.status !== 'in_matrix') return;

  const awareness = computeAgentAwareness(agent, map, store.threats, store.hackableElements);
  const guidance = agent.aiState?.lastGuidance ?? '';
  const mission = store.mission;

  // Build context for Haiku
  const context: Record<string, unknown> = {
    agentName: agent.displayName,
    agentNameLower: agentName,
    position: `(${agent.position.x}, ${agent.position.y})`,
    guidance,
    missionTitle: mission?.title ?? '',
    missionObjectives: mission?.objectives ?? [],
    visibleThreats: awareness.visibleThreats.map(
      (t) => `${t.type} at (${t.position.x},${t.position.y}) level ${t.level}`,
    ),
    visibleHackables: awareness.visibleHackables.map(
      (el) => `${el.type} [${el.label}] at (${el.position.x},${el.position.y}) state:${el.state}`,
    ),
    adjacentWalls: awareness.adjacentWalls,
    adjacentTiles: {
      north: describeTile(map, { x: agent.position.x, y: agent.position.y - 1 }, store.hackableElements),
      south: describeTile(map, { x: agent.position.x, y: agent.position.y + 1 }, store.hackableElements),
      east:  describeTile(map, { x: agent.position.x + 1, y: agent.position.y }, store.hackableElements),
      west:  describeTile(map, { x: agent.position.x - 1, y: agent.position.y }, store.hackableElements),
    },
    nearbyPhones: awareness.nearbyPhones.map((p) => `(${p.x},${p.y})`),
    phonePositions: map.phonePositions.map((p) => `(${p.x},${p.y})`),
    exitPositions: map.exitPositions.map((p) => `(${p.x},${p.y})`),
    currentPath: (agent.aiState?.plannedPath ?? []).slice(0, 5).map((p) => `(${p.x},${p.y})`),
    mapWidth: map.width,
    mapHeight: map.height,
  };

  const response = await callHaiku('agentAutonomousTick', context);

  // Parse the action from the response
  const { text, action } = parseAgentResponse(response);

  // Clear the guidance after processing
  store.updateAgentAIState(agentName, {
    lastGuidance: '',
    lastAITick: store.tickCount,
  });

  // Execute the action
  if (action) {
    executeAgentAction(agentName, action, store, map);
  }

  // Post the agent's response to chat (only if there's meaningful text)
  if (text && text.length > 0 && !text.includes('[Signal lost')) {
    store.addChatMessage(agentName, {
      id: `ai-${Date.now()}`,
      timestamp: Date.now(),
      sender: 'agent',
      text,
      action: action ?? undefined,
    });
  }
}

interface ParsedAction {
  type: 'move' | 'wait' | 'evade';
  target?: string;
  steps?: number;
}

function parseAgentResponse(response: string): { text: string; action: ParsedAction | null } {
  // Extract <action> JSON block
  const actionMatch = response.match(/<action>([\s\S]*?)<\/action>/);
  let action: ParsedAction | null = null;

  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]);
    } catch {
      // Invalid JSON — ignore
    }
  }

  // Strip the action tags from the text
  const text = response.replace(/<action>[\s\S]*?<\/action>/, '').trim();

  return { text, action };
}

function executeAgentAction(
  agentName: AgentName,
  action: ParsedAction,
  store: GameStateSlice,
  map: GameMap,
): void {
  const agent = store.agents[agentName];

  if (action.type === 'wait') {
    store.updateAgentAIState(agentName, { plannedPath: [], isMoving: false });
    store.updateRoutePreview(agentName, []);
    return;
  }

  if (action.type === 'move' || action.type === 'evade') {
    const target = action.target?.toLowerCase() ?? '';
    const steps = action.steps ?? Infinity;

    // Directional movement
    const directions = ['north', 'south', 'east', 'west'] as const;
    const matchedDir = directions.find((d) => target.includes(d));

    if (matchedDir) {
      const path = computeDirectionalPath(
        agent.position,
        matchedDir,
        steps,
        map,
        store.hackableElements,
      );
      store.updateAgentAIState(agentName, { plannedPath: path, isMoving: true });
      store.updateRoutePreview(agentName, path);
      return;
    }

    // Named target: "phone", "exit"
    if (target.includes('phone')) {
      const nearestPhone = findNearestPosition(agent.position, map.phonePositions);
      if (nearestPhone) {
        const path = findPath(agent.position, nearestPhone, map, store.hackableElements);
        store.updateAgentAIState(agentName, {
          plannedPath: path,
          isMoving: true,
          movementTarget: nearestPhone,
        });
        store.updateRoutePreview(agentName, path);
      }
      return;
    }

    if (target.includes('exit')) {
      const nearestExit = findNearestPosition(agent.position, map.exitPositions);
      if (nearestExit) {
        const path = findPath(agent.position, nearestExit, map, store.hackableElements);
        store.updateAgentAIState(agentName, {
          plannedPath: path,
          isMoving: true,
          movementTarget: nearestExit,
        });
        store.updateRoutePreview(agentName, path);
      }
      return;
    }

    // Coordinate target: "(x,y)"
    const coordMatch = target.match(/\(?\s*(\d+)\s*,\s*(\d+)\s*\)?/);
    if (coordMatch) {
      const dest: Position = { x: parseInt(coordMatch[1]), y: parseInt(coordMatch[2]) };
      const path = findPath(agent.position, dest, map, store.hackableElements);
      store.updateAgentAIState(agentName, {
        plannedPath: path,
        isMoving: true,
        movementTarget: dest,
      });
      store.updateRoutePreview(agentName, path);
      return;
    }
  }
}

/** Describe what is at a given tile for AI context (replaces plain wall/open booleans). */
function describeTile(map: GameMap, pos: Position, hackableElements: HackableElement[]): string {
  if (pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height) return 'wall';
  const tile = map.tiles[pos.y]?.[pos.x];
  if (!tile || tile === '#') return 'wall';
  if (tile === 'd') {
    const el = hackableElements.find((e) => e.position.x === pos.x && e.position.y === pos.y);
    return el?.state === 'breached' ? 'door (unlocked, walkable)' : `door (LOCKED — hack to open)`;
  }
  if (tile === 'D') return 'door (open, walkable)';
  if (tile === 'P') return 'phone (extraction point — GO HERE)';
  if (tile === 'E' || tile === 'X') return 'exit';
  if (tile === 'C') return 'camera';
  if (tile === 'S') return 'security_panel';
  return 'floor';
}

function findNearestPosition(from: Position, positions: Position[]): Position | null {
  if (positions.length === 0) return null;
  let nearest = positions[0];
  let minDist = Math.abs(from.x - nearest.x) + Math.abs(from.y - nearest.y);
  for (let i = 1; i < positions.length; i++) {
    const dist = Math.abs(from.x - positions[i].x) + Math.abs(from.y - positions[i].y);
    if (dist < minDist) {
      nearest = positions[i];
      minDist = dist;
    }
  }
  return nearest;
}
