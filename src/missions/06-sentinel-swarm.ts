// ---------------------------------------------------------------------------
// Mission 06 – Sentinel Swarm (ship_defense)
// ---------------------------------------------------------------------------

import type { AgentName, GameMap } from '../engine/types';
import type { MissionTemplate } from '../engine/types';

const CONSTRUCT_MAP: GameMap = {
  name: 'Training Construct',
  width: 16,
  height: 8,
  tiles: [
    '################',
    '#..............#',
    '#..............#',
    '#......P.......#',
    '#..............#',
    '#..............#',
    '#..............#',
    '######XX########',
  ],
  agentPositions: [{ x: 1, y: 6 }, { x: 2, y: 6 }],
  threatPositions: [],
  exitPositions: [{ x: 6, y: 7 }, { x: 7, y: 7 }],
  phonePositions: [{ x: 7, y: 3 }],
};

export const sentinelSwarmMission: MissionTemplate = {
  type: 'ship_defense',
  title: 'Sentinel Swarm',
  description:
    'The sentinels have found the Nebuchadnezzar. All hands on deck. Manage ship systems, charge the EMP, and survive the assault. If anyone is jacked in, get them out NOW.',
  objectives: [
    'Jack out all agents from the Matrix immediately',
    'Manage ship power and hull integrity',
    'Charge and fire EMP when sentinels are in range',
    'Survive the sentinel assault',
  ],
  timeLimit: 90,
  suggestedAgents: [] as AgentName[],
  difficulty: 5,
  map: CONSTRUCT_MAP,
};
