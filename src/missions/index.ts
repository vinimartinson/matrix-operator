// ---------------------------------------------------------------------------
// Mission Registry — collects all mission templates from individual files
// ---------------------------------------------------------------------------

import type { MissionType, GameMap, GameStateSlice } from '../engine/types';
import type { MissionTemplate } from '../engine/types';

import { trinityEscapeMission } from './01-trinitys-escape';

// Future missions — not yet active in the main game.
// Contributors: see MISSIONS.md for how to propose a new mission.
import { governmentBreachMission } from './02-government-breach';
import { trappedOperativeMission } from './03-trapped-operative';
import { merovingianArchiveMission } from './04-merovingians-archive';
import { smithReplicationMission } from './05-smith-replication';
import { sentinelSwarmMission } from './06-sentinel-swarm';

/** Active missions available in the current build */
export const MISSION_TEMPLATES: MissionTemplate[] = [
  trinityEscapeMission,
];

/**
 * Future missions proposed by contributors — not yet playable.
 * See MISSIONS.md for how to add your own.
 */
export const FUTURE_MISSIONS: MissionTemplate[] = [
  governmentBreachMission,
  trappedOperativeMission,
  merovingianArchiveMission,
  smithReplicationMission,
  sentinelSwarmMission,
];

/** Get the map for a given mission type */
export function getMissionMap(type: MissionType): GameMap | undefined {
  const template = MISSION_TEMPLATES.find((t) => t.type === type);
  return template?.map;
}

/** Per-mission objective checker callbacks */
export type ObjectiveChecker = (store: GameStateSlice) => void;

const MISSION_OBJECTIVE_CHECKERS: Partial<Record<MissionType, ObjectiveChecker>> = {
  trinitys_escape: checkTrinityEscapeObjectives,
};

export function getMissionObjectiveChecker(type: MissionType): ObjectiveChecker | undefined {
  return MISSION_OBJECTIVE_CHECKERS[type];
}

// ---------------------------------------------------------------------------
// Trinity's Escape objective checking (narrative mode)
// ---------------------------------------------------------------------------

function checkTrinityEscapeObjectives(store: GameStateSlice): void {
  const mission = store.mission;
  if (!mission || mission.status !== 'active') return;

  // Narrative mission completes when orchestrator advances beat to 'complete'
  if (store.missionBeat === 'complete') {
    store.addTerminalLine('[SIGNAL] Trinity has jacked out. Extraction successful.', 'success');
    store.completeMission();
  }
}
