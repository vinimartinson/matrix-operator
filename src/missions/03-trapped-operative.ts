// ---------------------------------------------------------------------------
// Mission 03 – Trapped Operative (formerly rescue)
// ---------------------------------------------------------------------------

import type { AgentName, GameMap } from '../engine/types';
import type { MissionTemplate } from '../engine/types';

const SUBWAY_MAP: GameMap = {
  name: 'Subway Station',
  width: 24,
  height: 8,
  tiles: [
    '########################',
    '#......P..............##',
    '#.C..##################',
    '#......................#',
    '#....................S.#',
    '#....##################',
    '#......P..............##',
    '####XX##################',
  ],
  agentPositions: [{ x: 1, y: 3 }, { x: 1, y: 4 }],
  threatPositions: [{ x: 18, y: 3 }],
  exitPositions: [{ x: 4, y: 7 }, { x: 5, y: 7 }],
  phonePositions: [{ x: 7, y: 1 }, { x: 7, y: 6 }],
  hackableElementDefs: [
    { id: 'subway-cam-1', type: 'camera', position: { x: 3, y: 2 }, requiredSkill: 'hacking', difficulty: 2, label: 'CAM-1' },
    { id: 'subway-panel-1', type: 'security_panel', position: { x: 21, y: 4 }, requiredSkill: 'hacking', difficulty: 3, label: 'PANEL-1' },
  ],
};

export const trappedOperativeMission: MissionTemplate = {
  type: 'rescue',
  title: 'Trapped Operative',
  description:
    'An operative went dark during a recon mission in the subway system. Their signal was last detected underground. Find them before Smith does.',
  objectives: [
    'Navigate the subway tunnels',
    'Locate the trapped operative',
    'Clear a path to the exit',
    'Extract both agents via hardline',
  ],
  timeLimit: 150,
  suggestedAgents: ['neo', 'morpheus'] as AgentName[],
  difficulty: 2,
  map: SUBWAY_MAP,
};
