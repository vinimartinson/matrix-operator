// ---------------------------------------------------------------------------
// Mission 05 – Smith Replication Crisis (formerly smith_containment)
// ---------------------------------------------------------------------------

import type { AgentName, GameMap } from '../engine/types';
import type { MissionTemplate } from '../engine/types';

const SEWERS_MAP: GameMap = {
  name: 'Sewer Network',
  width: 20,
  height: 10,
  tiles: [
    '####################',
    '#..........P.......#',
    '#.####.####.####.###',
    '#.#..........#.....#',
    '#.#.####.###.d.....#',
    '#...#..........E...#',
    '#.#.####.###.D.....#',
    '#.#..S.......#.....#',
    '#.####.####.####.P.#',
    '########XX##########',
  ],
  agentPositions: [{ x: 1, y: 1 }],
  threatPositions: [{ x: 10, y: 5 }],
  exitPositions: [{ x: 8, y: 9 }, { x: 9, y: 9 }],
  phonePositions: [{ x: 11, y: 1 }, { x: 17, y: 8 }],
  hackableElementDefs: [
    { id: 'sewers-node', type: 'data_terminal', position: { x: 15, y: 5 }, requiredSkill: 'hacking', difficulty: 4, label: 'NODE-X' },
    { id: 'sewers-door-1', type: 'door_locked', position: { x: 13, y: 4 }, requiredSkill: 'lockpick', difficulty: 3, label: 'DOOR-S1' },
    { id: 'sewers-panel-1', type: 'security_panel', position: { x: 4, y: 7 }, requiredSkill: 'hacking', difficulty: 4, label: 'PANEL-X' },
  ],
};

export const smithReplicationMission: MissionTemplate = {
  type: 'smith_containment',
  title: 'Smith Replication Crisis',
  description:
    'Smith is replicating out of control in sector 7G. Contain the spread by reaching the source node and uploading a counter-virus before he overwrites the entire sector.',
  objectives: [
    'Navigate to the source node in the sewers',
    'Avoid Smith copies (do NOT engage)',
    'Upload counter-virus at the marked terminal',
    'Extract before sector purge (auto at time limit)',
  ],
  timeLimit: 120,
  suggestedAgents: ['neo'] as AgentName[],
  difficulty: 4,
  map: SEWERS_MAP,
};
