// ---------------------------------------------------------------------------
// Mission 04 – Merovingian's Archive (formerly data_heist)
// ---------------------------------------------------------------------------

import type { AgentName, GameMap } from '../engine/types';
import type { MissionTemplate } from '../engine/types';

const ROOFTOP_MAP: GameMap = {
  name: 'Rooftop Chase',
  width: 22,
  height: 8,
  tiles: [
    '######################',
    '#.................A..#',
    '#..##..##..##..##..P.#',
    '#........C...........#',
    '#....................#',
    '#.P..##..##C.##..##..#',
    '#....................#',
    '####XX################',
  ],
  agentPositions: [{ x: 1, y: 6 }, { x: 2, y: 6 }],
  threatPositions: [{ x: 10, y: 3 }, { x: 12, y: 1 }],
  exitPositions: [{ x: 4, y: 7 }, { x: 5, y: 7 }],
  phonePositions: [{ x: 19, y: 2 }, { x: 2, y: 5 }],
  hackableElementDefs: [
    { id: 'rooftop-archive', type: 'data_terminal', position: { x: 18, y: 1 }, requiredSkill: 'hacking', difficulty: 3, label: 'ARCHIVE' },
    { id: 'rooftop-cam-1', type: 'camera', position: { x: 9, y: 3 }, requiredSkill: 'hacking', difficulty: 2, label: 'CAM-1' },
    { id: 'rooftop-cam-2', type: 'camera', position: { x: 11, y: 5 }, requiredSkill: 'hacking', difficulty: 2, label: 'CAM-2' },
  ],
};

export const merovingianArchiveMission: MissionTemplate = {
  type: 'data_heist',
  title: "Merovingian's Archive",
  description:
    "The Merovingian has information about a backdoor in the Matrix. Breach his rooftop penthouse and steal the access codes before his Exiles intervene.",
  objectives: [
    'Infiltrate the rooftop level',
    'Locate the archive terminal',
    'Decrypt and download access codes',
    'Evade Exiles and extract',
  ],
  timeLimit: 150,
  suggestedAgents: ['trinity', 'ghost'] as AgentName[],
  difficulty: 3,
  map: ROOFTOP_MAP,
};
