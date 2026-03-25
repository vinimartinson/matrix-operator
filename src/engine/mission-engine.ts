// ---------------------------------------------------------------------------
// Matrix Operator – Mission Engine
// ---------------------------------------------------------------------------

import type {
  GameEvent,
  GameMap,
  HackableElement,
  HackableElementDef,
  Mission,
  MissionTemplate,
  MissionType,
} from './types';

import { MISSION_TEMPLATES, getMissionMap } from '../missions';

// Re-export for convenience
export type { MissionTemplate };
export { MISSION_TEMPLATES, getMissionMap };

// -- Hackable element instantiation -----------------------------------------

/**
 * Convert HackableElementDef from a mission map into live HackableElements.
 */
export function instantiateHackableElements(map: GameMap): HackableElement[] {
  if (!map.hackableElementDefs) return [];
  return map.hackableElementDefs.map((def: HackableElementDef) => ({
    ...def,
    state: 'active' as const,
  }));
}

// -- Mission creation -------------------------------------------------------

let missionCounter = 0;

/**
 * Create a mission instance from a template, scaled by difficulty.
 */
export function createMission(
  type: MissionType,
  difficulty: number = 1,
): Mission {
  const template = MISSION_TEMPLATES.find((t) => t.type === type);
  if (!template) {
    throw new Error(`Unknown mission type: ${type}`);
  }

  missionCounter++;
  const scaledTimeLimit = Math.max(
    60,
    template.timeLimit - (difficulty - template.difficulty) * 15,
  );

  return {
    id: `mission-${missionCounter}-${Date.now()}`,
    type: template.type,
    status: 'briefing',
    title: template.title,
    description: template.description,
    objectives: [...template.objectives],
    agents: [...template.suggestedAgents],
    timeLimit: scaledTimeLimit,
    noTimeLimit: template.noTimeLimit ?? false,
    elapsedTime: 0,
    score: 0,
    events: [],
  };
}

/**
 * Return the next mission.
 * Currently only Mission 01 – Trinity's Escape is active.
 * More missions are coming — see MISSIONS.md to propose one.
 */
export function getNextMission(_missionCount: number): Mission {
  return createMission('trinitys_escape', 1);
}

// -- Mission tick / lifecycle -----------------------------------------------

/**
 * Advance mission timers and generate events. Call each game tick.
 * Returns any new events generated this tick.
 */
export function processMissionTick(
  mission: Mission,
  tickDurationSeconds: number,
): { updatedMission: Mission; newEvents: GameEvent[] } {
  if (mission.status !== 'active') {
    return { updatedMission: mission, newEvents: [] };
  }

  const newEvents: GameEvent[] = [];
  const elapsed = mission.elapsedTime + tickDurationSeconds;

  // Time warnings and timeout — skipped for missions with no time limit
  let status: Mission['status'] = mission.status;
  if (!mission.noTimeLimit) {
    const remaining = mission.timeLimit - elapsed;
    if (remaining <= 30 && remaining + tickDurationSeconds > 30) {
      newEvents.push({
        timestamp: Date.now(),
        type: 'mission_warning',
        message: '30 SECONDS REMAINING. Complete objectives NOW.',
        priority: 'critical',
      });
    } else if (remaining <= 60 && remaining + tickDurationSeconds > 60) {
      newEvents.push({
        timestamp: Date.now(),
        type: 'mission_warning',
        message: '60 seconds remaining.',
        priority: 'warning',
      });
    }

    if (elapsed >= mission.timeLimit) {
      status = 'failed';
      newEvents.push({
        timestamp: Date.now(),
        type: 'mission_timeout',
        message: 'MISSION FAILED — Time limit exceeded.',
        priority: 'critical',
      });
    }
  }

  return {
    updatedMission: {
      ...mission,
      elapsedTime: elapsed,
      status,
      events: [...mission.events, ...newEvents],
    },
    newEvents,
  };
}

/**
 * Check if all mission objectives could be considered complete.
 */
export function checkMissionComplete(mission: Mission): boolean {
  return mission.status === 'completed';
}

/**
 * Generate a formatted mission briefing.
 */
export function getMissionBriefing(mission: Mission): string[] {
  const template = MISSION_TEMPLATES.find((t) => t.type === mission.type);
  const diffLabel = template
    ? '★'.repeat(template.difficulty) + '☆'.repeat(5 - template.difficulty)
    : '';

  const lines: string[] = [
    '╔══════════════════════════════════════════╗',
    '║           MISSION BRIEFING               ║',
    '╠══════════════════════════════════════════╣',
    `║  ${mission.title.padEnd(40)}║`,
    `║  Difficulty: ${diffLabel.padEnd(28)}║`,
    `║  Time Limit: ${(mission.noTimeLimit ? 'No limit' : formatTime(mission.timeLimit)).padEnd(28)}║`,
    '╠══════════════════════════════════════════╣',
    '║  DESCRIPTION:                            ║',
  ];

  // Word-wrap description to 40 chars
  const descLines = wordWrap(mission.description, 40);
  for (const line of descLines) {
    lines.push(`║  ${line.padEnd(40)}║`);
  }

  lines.push('╠══════════════════════════════════════════╣');
  lines.push('║  OBJECTIVES:                             ║');

  for (let i = 0; i < mission.objectives.length; i++) {
    const obj = `${i + 1}. ${mission.objectives[i]}`;
    const wrapped = wordWrap(obj, 40);
    for (const w of wrapped) {
      lines.push(`║  ${w.padEnd(40)}║`);
    }
  }

  if (mission.agents.length > 0) {
    lines.push('╠══════════════════════════════════════════╣');
    lines.push(
      `║  Agents: ${mission.agents.join(', ').padEnd(32)}║`,
    );
  }

  lines.push('╚══════════════════════════════════════════╝');
  lines.push('');
  lines.push('Type "accept" to begin or "decline" to skip.');

  return lines;
}

// -- Helpers ----------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
