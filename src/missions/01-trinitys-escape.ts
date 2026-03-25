// ---------------------------------------------------------------------------
// Mission 01 – Trinity's Escape (Narrative Mode)
// AI-orchestrated experience — no map rendering, story driven by Sonnet.
// The operator guides Trinity out of a compromised safe house via chat.
// Each playthrough produces a unique narrative within Matrix lore.
// ---------------------------------------------------------------------------

import type { AgentName, GameMap, HackableElementDef, NarrativeBeat } from '../engine/types';
// HackableElementDef used via `satisfies` in STUB_MAP.hackableElementDefs
import type { MissionTemplate } from '../engine/types';

// Minimal stub map — not rendered, but required by MissionTemplate shape.
// Includes hackable element defs so instantiateHackableElements() can initialize them.
const STUB_MAP: GameMap = {
  name: "Hart's Apartment Complex",
  width: 1,
  height: 1,
  tiles: ['.'],
  agentPositions: [{ x: 0, y: 0 }], // Trinity spawn (narrative — not used for positioning)
  threatPositions: [],               // No map-based threats; narrative-driven
  exitPositions: [],
  phonePositions: [],
  hackableElementDefs: [
    {
      id: 'escape-cam-1',
      type: 'camera',
      position: { x: 0, y: 0 },
      requiredSkill: 'hacking',
      difficulty: 1,
      label: 'CAM-1',
    },
    {
      id: 'escape-lure-1',
      type: 'lure_system',
      position: { x: 0, y: 0 },
      requiredSkill: 'hacking',
      difficulty: 1,
      label: 'LURE-1',
    },
    {
      id: 'escape-door-a',
      type: 'door_locked',
      position: { x: 0, y: 0 },
      requiredSkill: 'hacking',
      difficulty: 1,
      label: 'DOOR-A',
    },
  ] satisfies HackableElementDef[],
};

// Initial narrative context per beat — fed to the orchestrator to prime its
// understanding of where the story is.
export const TRINITY_ESCAPE_BEATS: Partial<Record<NarrativeBeat, string>> = {
  awakening:
    "Trinity is jacked into a Matrix simulation of Hart's apartment complex. " +
    'The broadcast array is registering anomalous signal patterns — Smith has found her location. ' +
    'At least two Smith instances are converging on the building. ' +
    'Trinity does not yet know the full danger. The operator must establish contact.',

  guidance_needed:
    'Trinity is aware of her surroundings but waiting for operator guidance. ' +
    'She is in an inner room with limited visibility. ' +
    'Smith units are 2-3 blocks away and closing. ' +
    'The operator needs to advise her to move — fast.',

  en_route:
    'Trinity is moving through corridors. ' +
    'She is navigating toward the lower level of the complex. ' +
    'Smith units are trailing her signal. ' +
    'The operator must stay alert for threats and route deviations.',

  door_blocked:
    'Trinity has reached a locked maintenance door — designation DOOR-A. ' +
    'It is the only access to the phone room. ' +
    'She cannot proceed without operator help. ' +
    'The operator must hack DOOR-A to open the path.',

  path_clear:
    'DOOR-A has been breached. The path to the exit phone is open. ' +
    'Trinity can see the hardline terminal at the end of the corridor. ' +
    'The Smith units are aware of the breach and accelerating. ' +
    'She needs to move to the phone NOW.',

  phone_approach:
    'Trinity is in the phone room, moving toward the hardline terminal. ' +
    'She can hear the Smiths in the corridor. ' +
    'The operator must hold the line and talk her through the final steps.',

  extraction:
    'Trinity is at the phone. The hardline is active. ' +
    'She is ready to jack out — waiting for the operator to initiate extraction sequence. ' +
    'Smith is at the door. This is the last moment.',
};

export const trinityEscapeMission: MissionTemplate = {
  type: 'trinitys_escape',
  title: "Trinity's Escape",
  description:
    "Trinity is jacked into a compromised Matrix simulation. Smith has found her location. " +
    "Guide her out through operator comms — hack the environment, manage the threats, " +
    "and get her to the hardline before the Smiths close in. " +
    "Every operator makes different choices. Every extraction is a different story.",
  objectives: [
    'Establish contact with Trinity via the comms channel',
    'Guide Trinity through the complex toward the exit hardline',
    'Hack environmental systems to manage Smith threat level',
    'Breach DOOR-A to open the path to the exit phone',
    'Initiate extraction when Trinity reaches the hardline',
  ],
  timeLimit: 9999,
  noTimeLimit: true,
  suggestedAgents: ['trinity'] as AgentName[],
  difficulty: 1,
  map: STUB_MAP,
  isNarrativeMission: true,
  narrativeBeats: TRINITY_ESCAPE_BEATS,
};
