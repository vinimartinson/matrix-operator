// ---------------------------------------------------------------------------
// Matrix Operator – Hackable Element Logic
// ---------------------------------------------------------------------------

import type { Agent, AgentSkill, HackableElement, HackableState } from './types';

// Skill effectiveness per hackable type
const SKILL_BONUS: Partial<Record<AgentSkill, number>> = {
  hacking: 30,
  lockpick: 25,
  stealth: 10,
};

/**
 * Attempt to hack a hackable element.
 * Returns the new state and whether the attempt succeeded.
 */
export function attemptHack(
  element: HackableElement,
  agent: Agent,
): { newState: HackableState; success: boolean; scoreGained: number } {
  if (element.state === 'breached' || element.state === 'disabled') {
    // Already hacked
    return { newState: element.state, success: true, scoreGained: 0 };
  }

  // Base success chance 40%, modified by skill and difficulty
  let chance = 40;

  // Check if agent has the required skill
  const hasRequiredSkill = agent.skills.includes(element.requiredSkill);
  if (hasRequiredSkill) {
    chance += SKILL_BONUS[element.requiredSkill] ?? 20;
  }

  // Reduce chance by difficulty
  chance -= element.difficulty * 8;

  // Health modifier
  if (agent.health < 50) chance -= 10;

  // Clamp between 5 and 95
  chance = Math.max(5, Math.min(95, chance));

  const roll = Math.random() * 100;
  const success = roll < chance;

  if (success) {
    const newState: HackableState =
      element.type === 'door_locked' ||
      element.type === 'data_terminal' ||
      element.type === 'lure_system'
        ? 'breached'
        : 'disabled';
    const scoreGained = element.difficulty * 10 + (hasRequiredSkill ? 5 : 0);
    return { newState, success: true, scoreGained };
  } else {
    // Failure — element goes alarmed, spawning threats
    return { newState: 'alarmed', success: false, scoreGained: 0 };
  }
}

/**
 * Get a display label for a hackable element.
 */
export function getHackableLabel(el: HackableElement): string {
  const typeLabel = {
    camera: 'CAM',
    security_panel: 'PANEL',
    door_locked: 'DOOR',
    data_terminal: 'TERMINAL',
    lure_system: 'LURE',
  }[el.type];

  const stateLabel = {
    active: 'ACTIVE',
    disabled: 'OFFLINE',
    breached: 'OPEN',
    alarmed: '!ALARM!',
  }[el.state];

  return `${typeLabel} ${el.label}: ${stateLabel}`;
}

/**
 * List all hackable elements in the current mission with their status.
 */
export function listHackableElements(elements: HackableElement[]): string[] {
  if (elements.length === 0) return ['  No hackable elements detected.'];
  return elements.map((el) => `  ${getHackableLabel(el)}`);
}
