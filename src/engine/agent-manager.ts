// ---------------------------------------------------------------------------
// Matrix Operator – Agent Manager
// ---------------------------------------------------------------------------

import type { Agent, AgentName, GameMap, HackableElement, Position, GameStateSlice } from './types';
import { attemptHack } from './hackable-elements';

// -- Utility ----------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Returns true if the given map position can be walked into.
 * Walls (#) are always blocked. Locked doors (d) are blocked unless breached.
 */
export function isWalkable(
  map: GameMap,
  pos: Position,
  hackableElements: HackableElement[],
): boolean {
  if (pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height) return false;
  const tile = map.tiles[pos.y]?.[pos.x];
  if (!tile || tile === '#') return false;
  if (tile === 'd') {
    const el = hackableElements.find(
      (e) => e.position.x === pos.x && e.position.y === pos.y,
    );
    return el?.state === 'breached';
  }
  return true;
}

// -- Agent operations -------------------------------------------------------

/**
 * Jack an agent into the Matrix.
 * Sets status to in_matrix and places them at the given map position.
 */
export function jackIn(
  agent: Agent,
  spawnPosition: Position = { x: 1, y: 1 },
): Partial<Agent> {
  if (agent.status !== 'ready') {
    throw new Error(
      `${agent.displayName} cannot jack in — current status: ${agent.status}`,
    );
  }
  if (agent.fatigue >= 90) {
    throw new Error(
      `${agent.displayName} is too fatigued to jack in (fatigue: ${agent.fatigue}).`,
    );
  }
  return {
    status: 'in_matrix',
    position: { ...spawnPosition },
  };
}

/**
 * Jack an agent out of the Matrix.
 * Sets status to resting and adds fatigue.
 */
export function jackOut(agent: Agent): Partial<Agent> {
  if (agent.status !== 'in_matrix') {
    throw new Error(
      `${agent.displayName} is not in the Matrix — current status: ${agent.status}`,
    );
  }
  return {
    status: 'resting',
    fatigue: clamp(agent.fatigue + 15, 0, 100),
    position: { x: 0, y: 0 },
  };
}

/**
 * Calculate one step of movement toward a destination.
 * Moves 1 tile per call along the Manhattan distance path.
 * Respects walls when map and hackableElements are provided.
 */
export function routeAgent(
  agent: Agent,
  destination: Position,
  map?: GameMap,
  hackableElements?: HackableElement[],
): Position {
  if (agent.status !== 'in_matrix') {
    throw new Error(`${agent.displayName} is not in the Matrix.`);
  }

  const { x, y } = agent.position;
  const dx = destination.x - x;
  const dy = destination.y - y;

  // Already at destination
  if (dx === 0 && dy === 0) return { x, y };

  // Move 1 tile toward destination, prefer axis with greater distance
  const candidate: Position = Math.abs(dx) >= Math.abs(dy)
    ? { x: x + Math.sign(dx), y }
    : { x, y: y + Math.sign(dy) };

  // Block on walls/locked doors when map is available
  if (map && hackableElements && !isWalkable(map, candidate, hackableElements)) {
    return { x, y }; // blocked — stay put
  }

  return candidate;
}

/**
 * Get a formatted status string for an agent.
 */
export function getAgentStatus(agent: Agent): string[] {
  const statusLabel: Record<string, string> = {
    ready: 'READY',
    in_matrix: 'IN MATRIX',
    resting: 'RESTING',
    injured: 'INJURED',
    dead: 'DEAD',
  };

  const statusIcon: Record<string, string> = {
    ready: '●',
    in_matrix: '◉',
    resting: '◌',
    injured: '✖',
    dead: '☠',
  };

  const lines: string[] = [
    `${statusIcon[agent.status]} ${agent.displayName} — ${statusLabel[agent.status]}`,
    `  Health:  ${agent.health}%`,
    `  Fatigue: ${agent.fatigue}%`,
    `  Missions: ${agent.missionsCompleted}`,
  ];

  if (agent.status === 'in_matrix') {
    lines.push(`  Position: (${agent.position.x}, ${agent.position.y})`);
  }

  return lines;
}

/**
 * Check if an agent is available for a mission (ready and not too fatigued).
 */
export function isAgentAvailable(agent: Agent): boolean {
  return agent.status === 'ready' && agent.fatigue < 80 && agent.health > 20;
}

/**
 * Heal an agent — reduce fatigue by 20, cap at 0.
 */
export function healAgent(agent: Agent): Partial<Agent> {
  if (agent.status === 'dead') {
    throw new Error(`${agent.displayName} cannot be healed.`);
  }
  return {
    fatigue: clamp(agent.fatigue - 20, 0, 100),
    health: clamp(agent.health + 10, 0, 100),
    status: agent.status === 'injured' && agent.health + 10 > 30 ? 'resting' : agent.status,
  };
}

/**
 * Injure an agent — reduce health and potentially update status.
 */
export function injureAgent(
  agent: Agent,
  damage: number = 25,
): Partial<Agent> {
  const newHealth = clamp(agent.health - damage, 0, 100);

  let newStatus = agent.status;
  if (newHealth <= 0) {
    newStatus = 'dead';
  } else if (newHealth <= 30) {
    newStatus = 'injured';
  }

  return {
    health: newHealth,
    status: newStatus,
    fatigue: clamp(agent.fatigue + 10, 0, 100),
  };
}

/**
 * Rest an agent — recover fatigue when in resting state.
 * Called each tick for resting agents.
 */
export function restAgent(agent: Agent): Partial<Agent> {
  if (agent.status !== 'resting') return {};
  const newFatigue = clamp(agent.fatigue - 5, 0, 100);
  return {
    fatigue: newFatigue,
    status: newFatigue <= 10 ? 'ready' : 'resting',
  };
}

/**
 * Get all available agents from the roster.
 */
export function getAvailableAgents(
  agents: Record<AgentName, Agent>,
): AgentName[] {
  return (Object.keys(agents) as AgentName[]).filter((name) =>
    isAgentAvailable(agents[name]),
  );
}

/**
 * Get all agents currently in the Matrix.
 */
export function getJackedInAgents(
  agents: Record<AgentName, Agent>,
): AgentName[] {
  return (Object.keys(agents) as AgentName[]).filter(
    (name) => agents[name].status === 'in_matrix',
  );
}

/**
 * Execute a hack attempt by an agent on a hackable element.
 * Mutates the game state via the store actions.
 * Returns result lines for terminal display.
 */
export function executeHack(
  agentName: AgentName,
  element: HackableElement,
  gameState: GameStateSlice,
): string[] {
  const agent = gameState.agents[agentName];

  if (agent.status !== 'in_matrix') {
    return [`${agent.displayName} is not in the Matrix.`];
  }

  const { newState, success, scoreGained } = attemptHack(element, agent);

  gameState.updateHackableElement(element.id, { state: newState });

  if (success) {
    if (scoreGained > 0) gameState.addScore(scoreGained);
    const actionLabel = element.type === 'door_locked' ? 'BREACHED' : 'DISABLED';
    return [
      `[${element.label}] ${agent.displayName} ${actionLabel} — +${scoreGained} pts`,
    ];
  } else {
    // Spawn an additional threat on alarm
    gameState.addThreat({
      id: `alarm-${Date.now()}`,
      type: 'police',
      position: { ...element.position },
      level: 1,
      eta: 15,
      active: true,
    });
    return [
      `[${element.label}] ALARM TRIGGERED — Security responding!`,
    ];
  }
}

/**
 * Execute a hack from the operator (no agent required).
 * The operator hacks from the ship — base 40% success + difficulty modifiers.
 */
export function executeOperatorHack(
  element: HackableElement,
  gameState: GameStateSlice,
): string[] {
  // Operator hack: base 40%, difficulty penalty -8% per level, clamped 5-95
  let chance = 40 - element.difficulty * 8;
  chance = Math.max(5, Math.min(95, chance));

  const success = Math.random() * 100 < chance;
  const scoreGained = success ? element.difficulty * 10 : 0;

  if (success) {
    const newState = (element.type === 'door_locked' || element.type === 'data_terminal' || element.type === 'lure_system')
      ? 'breached' as const
      : 'disabled' as const;
    gameState.updateHackableElement(element.id, { state: newState });
    if (scoreGained > 0) gameState.addScore(scoreGained);
    const actionLabel = element.type === 'door_locked' ? 'BREACHED' : 'DISABLED';
    return [
      `[${element.label}] Operator ${actionLabel} — +${scoreGained} pts`,
    ];
  } else {
    gameState.updateHackableElement(element.id, { state: 'alarmed' });
    gameState.addThreat({
      id: `alarm-${Date.now()}`,
      type: 'police',
      position: { ...element.position },
      level: 1,
      eta: 15,
      active: true,
    });
    return [
      `[${element.label}] ALARM TRIGGERED — Hack failed, security responding!`,
    ];
  }
}
