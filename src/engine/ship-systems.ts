// ---------------------------------------------------------------------------
// Matrix Operator – Ship Systems Management
// ---------------------------------------------------------------------------

import type {
  Agent,
  AgentName,
  GamePhase,
  ShipStatus,
  ShipSystem,
} from './types';

// -- Helpers ----------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function createSystem(
  name: string,
  level: number,
  maxLevel: number,
  critical: boolean,
): ShipSystem {
  return { name, level, maxLevel, critical };
}

// -- Factory ----------------------------------------------------------------

/**
 * Create a fresh ShipStatus with reasonable starting values.
 */
export function createDefaultShip(): ShipStatus {
  return {
    hull: createSystem('Hull Integrity', 95, 100, true),
    power: createSystem('Power Core', 90, 100, true),
    broadcastArray: createSystem('Broadcast Array', 88, 100, false),
    lifeSupport: createSystem('Life Support', 92, 100, true),
    empSystem: createSystem('EMP System', 85, 100, false),
    matrixFeed: createSystem('Matrix Feed', 90, 100, false),
    empCharge: 0,
    empCharging: false,
    depth: 2.5,
    sentinelDistance: 800,
    sentinelCount: 3,
  };
}

// -- System operations ------------------------------------------------------

/**
 * Reduce a system's level by `amount`. Clamps to 0.
 */
export function degradeSystem(
  ship: ShipStatus,
  systemName: keyof ShipStatus,
  amount: number,
): ShipStatus {
  const system = ship[systemName];
  if (!isShipSystem(system)) return ship;
  return {
    ...ship,
    [systemName]: {
      ...system,
      level: clamp(system.level - amount, 0, system.maxLevel),
    },
  };
}

/**
 * Repair a system's level by `amount`. Clamps to maxLevel.
 */
export function repairSystem(
  ship: ShipStatus,
  systemName: keyof ShipStatus,
  amount: number,
): ShipStatus {
  const system = ship[systemName];
  if (!isShipSystem(system)) return ship;
  return {
    ...ship,
    [systemName]: {
      ...system,
      level: clamp(system.level + amount, 0, system.maxLevel),
    },
  };
}

function isShipSystem(val: unknown): val is ShipSystem {
  return (
    typeof val === 'object' &&
    val !== null &&
    'level' in val &&
    'maxLevel' in val
  );
}

const SYSTEM_KEYS: (keyof ShipStatus)[] = [
  'hull',
  'power',
  'broadcastArray',
  'lifeSupport',
  'empSystem',
  'matrixFeed',
];

/**
 * Allocate power to a specific system.
 * Increasing one system reduces others proportionally.
 */
export function allocatePower(
  ship: ShipStatus,
  targetSystem: keyof ShipStatus,
  targetLevel: number,
): ShipStatus {
  const target = ship[targetSystem];
  if (!isShipSystem(target)) return ship;

  const clamped = clamp(targetLevel, 0, target.maxLevel);
  const delta = clamped - target.level;

  if (delta <= 0) {
    // Reducing power — just set it
    return {
      ...ship,
      [targetSystem]: { ...target, level: clamped },
    };
  }

  // Distribute the cost across other systems proportionally
  const others = SYSTEM_KEYS.filter((k) => k !== targetSystem);
  const otherTotals = others.reduce((sum, k) => {
    const sys = ship[k];
    return sum + (isShipSystem(sys) ? sys.level : 0);
  }, 0);

  if (otherTotals === 0) return ship;

  const result = { ...ship, [targetSystem]: { ...target, level: clamped } };
  for (const k of others) {
    const sys = ship[k];
    if (!isShipSystem(sys)) continue;
    const proportion = sys.level / otherTotals;
    const reduction = delta * proportion;
    (result as Record<string, unknown>)[k] = {
      ...sys,
      level: clamp(sys.level - reduction, 0, sys.maxLevel),
    };
  }

  return result;
}

/**
 * Charge the EMP by ~15% per tick.
 */
export function chargeEmp(ship: ShipStatus): ShipStatus {
  if (ship.empCharge >= 100) {
    return { ...ship, empCharge: 100, empCharging: false };
  }
  const increment = 15;
  return {
    ...ship,
    empCharge: clamp(ship.empCharge + increment, 0, 100),
    empCharging: true,
  };
}

/**
 * Fire the EMP.
 * Resets charge, returns updated ship. The caller handles sentinel/agent effects.
 */
export function fireEmp(ship: ShipStatus): ShipStatus {
  return {
    ...ship,
    empCharge: 0,
    empCharging: false,
    sentinelDistance: ship.sentinelDistance + 400, // Push sentinels back
    empSystem: {
      ...ship.empSystem,
      level: clamp(ship.empSystem.level - 5, 0, ship.empSystem.maxLevel),
    },
  };
}

/**
 * Broadcast signal factor by depth:
 *   1km → 100%, 2km → 90%, 3km → 75%, 4km → 55%, 5km → 30%
 */
export function depthSignalFactor(depth: number): number {
  if (depth <= 2) return 1.0 - 0.10 * (depth - 1);  // 1.00 → 0.90
  if (depth <= 3) return 0.90 - 0.15 * (depth - 2); // 0.90 → 0.75
  if (depth <= 4) return 0.75 - 0.20 * (depth - 3); // 0.75 → 0.55
  return             0.55 - 0.25 * (depth - 4);      // 0.55 → 0.30
}

/**
 * EMP kill-chance by depth:
 *   1-2km → 60%, 3km → 65%, 4km → 75%, 5km → 85%
 * Deeper water = EMP blast radius better contained → more sentinels hit.
 */
export function depthEmpKillChance(depth: number): number {
  if (depth <= 2) return 0.60;
  if (depth <= 3) return 0.65;
  if (depth <= 4) return 0.75;
  return 0.85;
}

/**
 * Number of sentinels that can detect the ship at a given depth.
 *   1 km → 1  |  2 km → 1  |  3 km → 2  |  4 km → 3  |  5 km → 4
 */
export function sentinelCountForDepth(depth: number): number {
  if (depth <= 2) return 1;
  if (depth <= 3) return 2;
  if (depth <= 4) return 3;
  return 4;
}

/**
 * Change ship depth. Depth range 1-5 km.
 * 1-2 km: safe zone — harder for sentinels to detect, stronger broadcast.
 * >3 km:  danger zone — sentinels detect faster, EMP hits more, weaker signal.
 * Sentinel count adjusts immediately to reflect new detectability.
 */
export function changeDive(ship: ShipStatus, depth: number): ShipStatus {
  const clamped        = clamp(depth, 1, 5);
  const factor         = depthSignalFactor(clamped);
  const newSentCount   = sentinelCountForDepth(clamped);
  return {
    ...ship,
    depth: clamped,
    sentinelCount: newSentCount,
    broadcastArray: {
      ...ship.broadcastArray,
      level: clamp(Math.round(ship.broadcastArray.maxLevel * factor), 0, ship.broadcastArray.maxLevel),
    },
  };
}

// -- Display ----------------------------------------------------------------

function bar(level: number, width: number = 20): string {
  const filled = Math.round((level / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function levelColor(level: number): string {
  if (level >= 70) return 'success';
  if (level >= 40) return 'warning';
  return 'error';
}

/**
 * Generate a formatted ASCII ship status display.
 */
export function getShipStatusDisplay(ship: ShipStatus): string[] {
  const lines: string[] = [
    '┌─────────────────────────────────────────┐',
    '│          NEBUCHADNEZZAR STATUS           │',
    '├─────────────────────────────────────────┤',
  ];

  const systems: { key: keyof ShipStatus; label: string }[] = [
    { key: 'hull', label: 'Hull      ' },
    { key: 'power', label: 'Power     ' },
    { key: 'broadcastArray', label: 'Broadcast ' },
    { key: 'lifeSupport', label: 'Life Sup. ' },
    { key: 'empSystem', label: 'EMP Sys.  ' },
    { key: 'matrixFeed', label: 'Mtx Feed  ' },
  ];

  for (const { key, label } of systems) {
    const sys = ship[key] as ShipSystem;
    const pct = Math.round(sys.level);
    const crit = sys.critical && sys.level < 50 ? '!' : ' ';
    lines.push(
      `│ ${crit}${label} [${bar(sys.level)}] ${String(pct).padStart(3)}% │`,
    );
  }

  lines.push('├─────────────────────────────────────────┤');
  lines.push(
    `│  EMP Charge: [${bar(ship.empCharge, 16)}] ${String(Math.round(ship.empCharge)).padStart(3)}%  │`,
  );
  lines.push(
    `│  Depth: ${ship.depth.toFixed(1)}km    Sentinels: ${String(Math.round(ship.sentinelDistance)).padStart(4)}m  │`,
  );
  lines.push('└─────────────────────────────────────────┘');

  return lines;
}

/**
 * Generate a formatted ASCII crew status display.
 */
export function getCrewDisplay(agents: Record<AgentName, Agent>): string[] {
  const lines: string[] = [
    '┌─────────────────────────────────────────┐',
    '│              CREW STATUS                 │',
    '├─────────────────────────────────────────┤',
  ];

  const names: AgentName[] = ['neo', 'trinity', 'morpheus', 'niobe', 'ghost'];

  for (const name of names) {
    const agent = agents[name];
    const statusIcon = getStatusIcon(agent.status);
    const healthBar = bar(agent.health, 8);
    const fatigueBar = bar(100 - agent.fatigue, 8);
    lines.push(
      `│  ${statusIcon} ${agent.displayName.padEnd(10)} HP[${healthBar}] FT[${fatigueBar}] │`,
    );
  }

  lines.push('└─────────────────────────────────────────┘');
  return lines;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'ready':
      return '●';
    case 'in_matrix':
      return '◉';
    case 'resting':
      return '◌';
    case 'injured':
      return '✖';
    case 'dead':
      return '☠';
    default:
      return '?';
  }
}

/**
 * Apply per-tick degradation to ship systems during ship_defense phase.
 */
export function tickShipSystems(
  ship: ShipStatus,
  phase: GamePhase,
): ShipStatus {
  if (phase !== 'ship_defense') return ship;

  let updated = { ...ship };

  // Slight degradation each tick during defense
  updated = degradeSystem(updated, 'hull', Math.random() * 2);
  updated = degradeSystem(updated, 'power', Math.random() * 1.5);
  updated = degradeSystem(updated, 'lifeSupport', Math.random() * 0.5);

  // Sentinels approach — deeper depth = faster detection rate
  // 1-2km: 10 m/tick  |  2-3km: 15 m/tick  |  >3km: 25-35 m/tick
  const sentApproach = updated.depth > 3
    ? 15 + Math.round((updated.depth - 3) * 10)
    : updated.depth > 2 ? 15 : 10;
  updated.sentinelDistance = Math.max(0, updated.sentinelDistance - sentApproach);

  // If charging EMP, advance charge
  if (updated.empCharging) {
    updated = chargeEmp(updated);
  }

  return updated;
}
