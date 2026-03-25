# Matrix Operator — Mission System

> "I know kung fu." — Neo

This document explains how the mission system works and how contributors can propose new missions for the game.

---

## Current Missions

| # | Title | Type | Difficulty | Status |
|---|-------|------|-----------|--------|
| 01 | Trinity's Escape | `trinitys_escape` | ★☆☆☆☆ | **Active** |
| 02 | Government Server Breach | `infiltration` | ★★☆☆☆ | Proposed |
| 03 | Trapped Operative | `rescue` | ★★☆☆☆ | Proposed |
| 04 | Merovingian's Archive | `data_heist` | ★★★☆☆ | Proposed |
| 05 | Smith Replication Crisis | `smith_containment` | ★★★★☆ | Proposed |
| 06 | Sentinel Swarm | `ship_defense` | ★★★★★ | Proposed |

Only **Mission 01** is active in the current build. The others are defined but hidden — they can be activated once reviewed and balanced.

---

## How Missions Work

### Mission Types

```typescript
type MissionType =
  | 'trinitys_escape'    // Narrative AI-orchestrated story mission
  | 'infiltration'       // Hack your way through a secured facility
  | 'rescue'             // Extract a trapped operative before time runs out
  | 'data_heist'         // Retrieve files without triggering alarms
  | 'smith_containment'  // Neutralize a Smith replication event
  | 'ship_defense'       // Defend the Nebuchadnezzar from sentinel attack
  | 'extraction'         // (reserved)
```

### Narrative Missions (`isNarrativeMission: true`)

Narrative missions (like Trinity's Escape) are AI-orchestrated experiences. There is no map — the story is driven by a Sonnet AI orchestrator that responds to player commands and advances through **narrative beats**:

```
awakening → guidance_needed → en_route → door_blocked
  → path_clear → phone_approach → extraction → complete
```

The operator communicates with agents via the chat panel. The AI orchestrator reads context and advances beats in response to player actions.

### Map Missions

All other mission types use a tile-based map rendered in the terminal. Map tiles:

| Tile | Meaning |
|------|---------|
| `#`  | Wall |
| `.`  | Floor |
| `D`  | Door (open) |
| `d`  | Door (locked) |
| `P`  | Phone (extraction point) |
| `E`  | Elevator |
| `X`  | Exit |
| `C`  | Camera |
| `S`  | Security panel |
| `A`  | Data terminal |
| `N`  | Neo NPC marker |

---

## Operator Commands Reference

These are the commands available to the player during a session.

### Navigation & Agents

| Command | Usage | Description |
|---------|-------|-------------|
| `jack-in` | `jack-in <agent>` | Jack an agent into the Matrix |
| `jack-out` | `jack-out <agent>` | Extract an agent via hardline |
| `route` | `route <agent> <x,y>` | Route an agent to a map position |
| `locate` | `locate <agent\|threat>` | Show position of an agent or threat |
| `map` | `map` | Display the current mission map |

### Tactical

| Command | Usage | Description |
|---------|-------|-------------|
| `hack` | `hack <element>` | Hack a camera, door, terminal, or security panel |
| `override` | `override <system>` | Override a critical system failure |
| `scan` | `scan` | Scan the area for anomalies |
| `analyze` | `analyze <anomaly-id>` | Analyze a detected anomaly |
| `systems` | `systems` | List hackable elements in the current mission |
| `threat` | `threat` | Show active threats (Smiths, sentinels) |
| `alert` | `alert` | Show active alerts |

### Ship Systems

| Command | Usage | Description |
|---------|-------|-------------|
| `status` | `status` | Full ship status (hull, power, systems, depth) |
| `dive` | `dive <1-5>` | Change ship depth (1 = shallow, 5 = deep) |
| `emp` | `emp` | Fire the EMP (requires full charge, no agents in Matrix) |
| `charge` | `charge` | Charge the EMP system |
| `repair` | `repair <system>` | Repair a damaged ship system |
| `power` | `power <system> <level>` | Allocate power to a ship system |
| `crew` | `crew` | Show crew status and assignments |

**Ship depth effects:**
- **Depth 1** (shallow): Strong signal, high broadcast amplitude, sentinels nearby
- **Depth 5** (deep): Weak/noisy signal, low broadcast amplitude, sentinels distant
- The broadcast array and frequency scanner visually reflect current depth

**EMP:**
- Requires 100% charge; `charge` builds it up over time
- Kills all sentinels within range based on depth
- All agents must be jacked out before firing
- After firing: EMP needs to recharge before reuse

### Mission Control

| Command | Usage | Description |
|---------|-------|-------------|
| `missions` | `missions` | Show the mission briefing |
| `accept` | `accept` | Accept the current briefing and begin |
| `decline` | `decline` | Decline the current mission |
| `brief` | `brief` | Re-display the mission briefing |
| `exit` | `exit` | Abort the current mission |
| `score` | `score` | Show current score breakdown |

### Meta

| Command | Usage | Description |
|---------|-------|-------------|
| `help` | `help [command]` | Show all commands or help for a specific one |
| `status` | `status` | Ship + mission overview |
| `log` | `log` | Recent event log |
| `rank` | `rank` | Your current rank and progress |
| `daily` | `daily` | Daily briefing |
| `clear` | `clear` | Clear the terminal screen |

---

## How to Propose a New Mission

Mission files live in `src/missions/`. Each mission is a TypeScript file that exports a `MissionTemplate` object.

### 1. Create the mission file

Name it `NN-your-mission-name.ts` (e.g. `07-architect-vault.ts`).

```typescript
// src/missions/07-architect-vault.ts
import type { MissionTemplate } from '../engine/types';

export const architectVaultMission: MissionTemplate = {
  type: 'data_heist',           // choose from MissionType
  title: "The Architect's Vault",
  description: 'Infiltrate the Architect\'s data fortress and retrieve the source code.',
  difficulty: 4,                // 1–5
  timeLimit: 180,               // seconds (ignored if noTimeLimit: true)
  suggestedAgents: ['neo', 'trinity'],
  objectives: [
    'Disable the vault camera array',
    'Breach the data terminal',
    'Extract before Smith arrives',
  ],
  map: {
    name: "Architect's Tower",
    width: 20,
    height: 15,
    tiles: [
      // Each string is one row, length must equal `width`
      '####################',
      '#..................#',
      // ... etc
    ],
    agentPositions:  [{ x: 1, y: 1 }],
    threatPositions: [{ x: 18, y: 13 }],
    exitPositions:   [{ x: 1, y: 13 }],
    phonePositions:  [],
    hackableElementDefs: [
      {
        id: 'vault-cam-1',
        type: 'camera',
        position: { x: 10, y: 5 },
        requiredSkill: 'hacking',
        difficulty: 3,
        label: 'CAM-1',
      },
      {
        id: 'vault-terminal',
        type: 'data_terminal',
        position: { x: 15, y: 7 },
        requiredSkill: 'hacking',
        difficulty: 4,
        label: 'DATA-1',
      },
    ],
  },
};
```

### 2. Register it in `src/missions/index.ts`

Add your import to the `FUTURE_MISSIONS` array (not `MISSION_TEMPLATES` — that's for active missions):

```typescript
import { architectVaultMission } from './07-architect-vault';

export const FUTURE_MISSIONS: MissionTemplate[] = [
  // ... existing entries
  architectVaultMission,
];
```

### 3. Open a Pull Request

- Title: `[Mission] Your Mission Title`
- Include a short description of the story beat and what makes it fun
- The maintainer will review balance, map layout, and lore consistency
- Accepted missions get moved from `FUTURE_MISSIONS` to `MISSION_TEMPLATES`

### Narrative Mission (no map)

For a fully AI-orchestrated mission like Mission 01, set `isNarrativeMission: true` and `noTimeLimit: true`. Use a stub map (1×1 with a single `.` tile). Define `narrativeBeats` to prime the AI orchestrator with context for each beat.

```typescript
export const myNarrativeMission: MissionTemplate = {
  type: 'rescue',
  title: 'The Keymaker',
  isNarrativeMission: true,
  noTimeLimit: true,
  narrativeBeats: {
    awakening: 'The Keymaker has been captured by the Merovingian...',
    en_route:  'Agent is moving through the Frenchman\'s chateau...',
    // ...
  },
  map: STUB_MAP, // 1x1 placeholder
  // ...
};
```

---

## Hackable Element Types

| Type | Tile | Effect when hacked |
|------|------|--------------------|
| `camera` | `C` | Disables camera alert |
| `security_panel` | `S` | Opens adjacent locked doors |
| `door_locked` | `d` | Unlocks the door |
| `data_terminal` | `A` | Retrieves data (mission objective) |
| `lure_system` | — | Diverts Smith/threats away |

---

## Scoring

| Action | Points |
|--------|--------|
| Mission complete | 500 |
| Agent survived | 100 |
| Full extraction | 200 |
| Anomaly detected | 50 |
| Anomaly analyzed | 75 |
| Hack successful | 30 |
| Time bonus (>50% remaining) | 150 |

---

## Questions?

Open an issue or start a discussion on GitHub. Free your mind.
