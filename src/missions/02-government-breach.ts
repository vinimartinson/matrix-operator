// ---------------------------------------------------------------------------
// Mission 02 – Government Server Breach (formerly infiltration)
// ---------------------------------------------------------------------------

import type { AgentName, GameMap } from '../engine/types';
import type { MissionTemplate } from '../engine/types';

const LOBBY_MAP: GameMap = {
  name: 'Government Lobby',
  width: 20,
  height: 12,
  tiles: [
    '####################',
    '#..................#',
    '#..###....###..P..##',
    '#..#........#.....##',
    '#..#..D..D..#.....##',
    '#....C........E...##',
    '#.............E...##',
    '#..#..d..D..#.....##',
    '#..#........#.S...##',
    '#..###....###..P..##',
    '#..................#',
    '########XX##########',
  ],
  agentPositions: [{ x: 1, y: 10 }, { x: 2, y: 10 }],
  threatPositions: [{ x: 10, y: 5 }, { x: 15, y: 3 }],
  exitPositions: [{ x: 8, y: 11 }, { x: 9, y: 11 }],
  phonePositions: [{ x: 15, y: 2 }, { x: 15, y: 9 }],
  hackableElementDefs: [
    { id: 'lobby-server', type: 'data_terminal', position: { x: 13, y: 5 }, requiredSkill: 'hacking', difficulty: 3, label: 'SERVER' },
    { id: 'lobby-cam-1', type: 'camera', position: { x: 5, y: 5 }, requiredSkill: 'hacking', difficulty: 2, label: 'CAM-A' },
    { id: 'lobby-panel-1', type: 'security_panel', position: { x: 16, y: 8 }, requiredSkill: 'hacking', difficulty: 3, label: 'PANEL-1' },
    { id: 'lobby-door-1', type: 'door_locked', position: { x: 6, y: 7 }, requiredSkill: 'lockpick', difficulty: 2, label: 'DOOR-B3' },
  ],
};

export const governmentBreachMission: MissionTemplate = {
  type: 'infiltration',
  title: 'Government Server Breach',
  description:
    "Intelligence suggests a government facility holds data on Zion's location. Infiltrate the lobby, reach the server room, and download the data.",
  objectives: [
    'Enter the government building undetected',
    'Reach the server room (marked E)',
    'Download classified data (hold position for 15s)',
    'Extract via hardline phone',
  ],
  timeLimit: 180,
  suggestedAgents: ['neo', 'trinity'] as AgentName[],
  difficulty: 2,
  map: LOBBY_MAP,
};
