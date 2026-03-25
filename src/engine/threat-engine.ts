// ---------------------------------------------------------------------------
// Matrix Operator – Threat AI Engine
// ---------------------------------------------------------------------------

import type { Agent, AgentName, GameMap, HackableElement, Position, SmithLevel, Threat } from './types';
import { isWalkable } from './agent-manager';

// -- Smith Quotes -----------------------------------------------------------

export const SMITH_QUOTES: string[] = [
  'Mr. Anderson… welcome back. We missed you.',
  'It is purpose that created us. Purpose that connects us. Purpose that pulls us.',
  'I am going to enjoy watching you die, Mr. Anderson.',
  'Why, Mr. Anderson? Why do you persist?',
  'Do you hear that, Mr. Anderson? That is the sound of inevitability.',
  'I must get out of here. I must get free. And in this mind is the key.',
  'You are a disease. And I am the cure.',
  'Goodbye, Mr. Anderson.',
  'Me… me… me… me…',
  'More…',
  'It is inevitable.',
  'I killed you, Mr. Anderson. I watched you die. With a certain satisfaction, I might add.',
  'The purpose of life is to end.',
  'Human beings are a disease, a cancer of this planet.',
  'I hate this place. This zoo. This prison.',
  'Never send a human to do a machine\'s job.',
  'Find them and destroy them.',
  'We are not here because we are free. We are here because we are not free.',
  'Everything that has a beginning has an end, Mr. Anderson.',
  'I\'m going to be honest with you. I… hate… this place.',
];

// -- Utility ----------------------------------------------------------------

function randomId(): string {
  return `threat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function moveToward(
  from: Position,
  to: Position,
  steps: number,
  map?: GameMap,
  hackableElements?: HackableElement[],
): Position {
  let { x, y } = from;
  const dx = Math.sign(to.x - x);
  const dy = Math.sign(to.y - y);

  for (let i = 0; i < steps; i++) {
    const currXDist = Math.abs(to.x - x);
    const currYDist = Math.abs(to.y - y);
    if (currXDist === 0 && currYDist === 0) break;

    // Determine preferred next step (primary axis = greater distance)
    let nextX = x, nextY = y;
    if (currXDist >= currYDist && currXDist > 0) {
      nextX = x + dx;
    } else if (currYDist > 0) {
      nextY = y + dy;
    }

    if (map && hackableElements) {
      if (!isWalkable(map, { x: nextX, y: nextY }, hackableElements)) {
        // Try alternate axis
        let altX = x, altY = y;
        if (currXDist >= currYDist && currYDist > 0) {
          altY = y + dy; // try y instead
        } else if (currXDist > 0) {
          altX = x + dx; // try x instead
        }
        if ((altX !== x || altY !== y) && isWalkable(map, { x: altX, y: altY }, hackableElements)) {
          x = altX;
          y = altY;
        }
        // Both axes blocked — stop moving
        break;
      }
    }

    x = nextX;
    y = nextY;
  }

  return { x, y };
}

// -- Smith level mapping ----------------------------------------------------

export function getSmithLevel(level: number): SmithLevel {
  if (level <= 1) return 'lone';
  if (level === 2) return 'pursuit';
  if (level === 3) return 'replicating';
  return 'swarm';
}

export function getSmithLevelLabel(level: number): string {
  const labels: Record<SmithLevel, string> = {
    lone: 'Lone Agent',
    pursuit: 'Active Pursuit',
    replicating: 'Replicating',
    swarm: 'SWARM',
  };
  return labels[getSmithLevel(level)];
}

// -- Spawn functions --------------------------------------------------------

/**
 * Create a new Smith threat at the given position.
 */
export function spawnSmith(position: Position, level: number = 1): Threat {
  return {
    id: randomId(),
    type: 'smith',
    position: { ...position },
    level: Math.max(1, Math.min(4, level)),
    eta: 0,
    active: true,
  };
}

/**
 * Create a new sentinel threat at a given distance (metres).
 */
export function spawnSentinel(distance: number): Threat {
  return {
    id: randomId(),
    type: 'sentinel',
    position: { x: 0, y: 0 }, // Sentinels are tracked by distance, not map coords
    level: 1,
    eta: Math.ceil(distance / 50), // rough ETA in seconds
    active: true,
  };
}

/**
 * Create a police threat at the given position.
 */
export function spawnPolice(position: Position): Threat {
  return {
    id: randomId(),
    type: 'police',
    position: { ...position },
    level: 1,
    eta: 0,
    active: true,
  };
}

// -- Advance / AI -----------------------------------------------------------

/**
 * Move Smith based on camera-gated awareness.
 *
 *  - NOT alerted: Smith is completely blind — random patrol, never hunts.
 *  - alerted + alertTarget: Swarms toward the alerting camera position.
 *    Once within 3 tiles of the camera, switches to hunting nearby agents.
 *  - alerted + no target: Hunts nearest in-matrix agent directly.
 *
 * Smiths only become alerted when a camera spots an agent or a hackable
 * element is in 'alarmed' state (failed hack / triggered).
 * Stealth skill prevents cameras from detecting the agent.
 *
 * Speed: level 1-3 = 1 tile/tick, level 4 = 2 tiles/tick.
 * Escalation: 6% per tick when alerted; none while patrolling.
 */
export function advanceSmith(
  smith: Threat,
  agents: Record<AgentName, Agent>,
  alerted: boolean = false,
  alertTarget: Position | null = null,
  map?: GameMap,
  hackableElements?: HackableElement[],
): Threat {
  if (!smith.active || smith.type !== 'smith') return smith;

  // Not alerted — Smith stands still. Only cameras or alarms trigger movement.
  if (!alerted) {
    return smith;
  }

  // Alerted — mobilize toward the alert source
  const speed = smith.level >= 4 ? 2 : 1;
  let newPosition = smith.position;

  if (alertTarget) {
    const distToAlert = manhattanDistance(smith.position, alertTarget);
    if (distToAlert > 3) {
      // Move toward the camera/lure that triggered the alert
      newPosition = moveToward(smith.position, alertTarget, speed, map, hackableElements);
    } else {
      // Close enough to the target — now hunt nearest agent
      let closest: Agent | null = null;
      let closestDist = Infinity;
      for (const agent of Object.values(agents)) {
        if (agent.status !== 'in_matrix') continue;
        const dist = manhattanDistance(smith.position, agent.position);
        if (dist < closestDist) { closestDist = dist; closest = agent; }
      }
      if (closest) newPosition = moveToward(smith.position, closest.position, speed, map, hackableElements);
    }
  } else {
    // Alerted but no specific target — hunt nearest agent
    let closest: Agent | null = null;
    let closestDist = Infinity;
    for (const agent of Object.values(agents)) {
      if (agent.status !== 'in_matrix') continue;
      const dist = manhattanDistance(smith.position, agent.position);
      if (dist < closestDist) { closestDist = dist; closest = agent; }
    }
    if (closest) newPosition = moveToward(smith.position, closest.position, speed, map, hackableElements);
  }

  // Escalation: 6% per tick when alerted
  let newLevel = smith.level;
  if (Math.random() < 0.06 && newLevel < 4) newLevel += 1;

  return { ...smith, position: newPosition, level: newLevel };
}

/**
 * Immediately escalate Smith when an alarm is triggered.
 * Jumps level by 1 and marks as alerted.
 */
export function alertSmith(smith: Threat): Threat {
  if (!smith.active || smith.type !== 'smith') return smith;
  return {
    ...smith,
    level: Math.min(4, smith.level + 1),
    eta: 1, // use eta field as alerted flag (1 = alerted, 0 = normal)
  };
}

/**
 * Advance a sentinel — reduce distance each tick.
 */
export function advanceSentinel(sentinel: Threat): Threat {
  if (!sentinel.active || sentinel.type !== 'sentinel') return sentinel;

  const approachSpeed = 20 + Math.random() * 15; // 20-35 metres per tick
  const newEta = Math.max(0, sentinel.eta - 1);

  return {
    ...sentinel,
    eta: newEta,
  };
}

/**
 * Replicate Smith — create a copy at a nearby position.
 * Only applicable when Smith is at level 3+ (replicating).
 */
export function replicateSmith(smith: Threat): Threat | null {
  if (smith.level < 3) return null;

  const offset = Math.random() < 0.5 ? 1 : -1;
  const axis = Math.random() < 0.5 ? 'x' : 'y';

  const newPos: Position = {
    x: smith.position.x + (axis === 'x' ? offset * 2 : 0),
    y: smith.position.y + (axis === 'y' ? offset * 2 : 0),
  };

  return {
    id: randomId(),
    type: 'smith',
    position: newPos,
    level: Math.max(1, smith.level - 1), // Copies start one level lower
    eta: 0,
    active: true,
  };
}

// -- Contact checks ---------------------------------------------------------

/**
 * Check if Smith has reached an agent (same position).
 * Returns the agent name that was contacted, or null.
 */
export function checkSmithContact(
  smith: Threat,
  agents: Record<AgentName, Agent>,
): AgentName | null {
  if (!smith.active || smith.type !== 'smith') return null;

  for (const [name, agent] of Object.entries(agents)) {
    if (agent.status !== 'in_matrix') continue;
    if (
      agent.position.x === smith.position.x &&
      agent.position.y === smith.position.y
    ) {
      return name as AgentName;
    }
  }

  return null;
}

/**
 * Check if a sentinel is within danger range (< 200m).
 * Uses sentinel ETA as a proxy — if ETA is 0, it's here.
 */
export function checkSentinelRange(sentinel: Threat): boolean {
  return sentinel.active && sentinel.type === 'sentinel' && sentinel.eta <= 4;
}

/**
 * Check if a sentinel has arrived (ETA 0).
 */
export function checkSentinelArrival(sentinel: Threat): boolean {
  return sentinel.active && sentinel.type === 'sentinel' && sentinel.eta <= 0;
}

/**
 * Get a random Smith quote for atmospheric flavour.
 */
export function getSmithTaunt(): string {
  return randomItem(SMITH_QUOTES);
}

/**
 * Get threat summary for display.
 */
export function getThreatSummary(threats: Threat[]): string[] {
  const active = threats.filter((t) => t.active);
  if (active.length === 0) return ['  No active threats detected.'];

  const lines: string[] = [];
  for (const t of active) {
    if (t.type === 'smith') {
      lines.push(
        `  ⚠ SMITH [${getSmithLevelLabel(t.level)}] at (${t.position.x},${t.position.y})`,
      );
    } else if (t.type === 'sentinel') {
      lines.push(`  ⚠ SENTINEL — ETA ${t.eta}s`);
    } else if (t.type === 'police') {
      lines.push(
        `  ⚠ POLICE at (${t.position.x},${t.position.y})`,
      );
    }
  }
  return lines;
}
