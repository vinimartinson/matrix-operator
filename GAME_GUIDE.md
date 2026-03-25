# Matrix Operator — Game Guide

You are the **Operator** aboard the Nebuchadnezzar. Your crew is jacked into the Matrix.
You watch the code. You guide them. You keep them alive.

---

## Screen Layout

```
┌──────────────────────────────┬──────────────────────────┐
│  OPERATOR CONSOLE  (left)    │  AGENT COMMS  (right)    │
│                              │                          │
│  ┌── LIVE MAP ─────────────┐ │  [Neo] [Trinity] [Ghost] │
│  │  ##C######d#############│ │──────────────────────────│
│  │  # N  .  .  S  .  . # │ │  NEO > I see the door.   │
│  │  # .  .  .  .  . X . # │ │  OPR > Move north.       │
│  └─────────────────────────┘ │  NEO > On it.            │
│                              │                          │
│  operator@neb:~$ _           │  > type here...          │
└──────────────────────────────┴──────────────────────────┘
```

- **Left panel** — operator terminal + live map (auto-refreshes every ~3.5s)
- **Right panel** — per-agent chat tabs; type natural language to command agents

---

## Starting a Mission

```
missions          — list available missions
accept <type>     — start a mission (e.g. accept extraction)
jack neo in       — jack an agent into the Matrix
```

Once agents are jacked in, they appear on the live map. The map updates automatically.

---

## Live Map Symbols

| Symbol | Meaning |
|--------|---------|
| `N` `T` `M` `B` `G` | Neo, Trinity, Morpheus, Niobe, Ghost |
| `S` (red) | Agent Smith — **frozen until alerted** |
| `!` | Other threat (sentinel, police) |
| `X` | Exit hardline — jack out here |
| `P` | Phone hardline |
| `A` (cyan) | Data terminal — mission objective |
| `a` (dim) | Data terminal — already breached |
| `C` (yellow) | Active camera — **will alert Smith if you get too close** |
| `c` (dim) | Disabled camera — safe |
| `S` (orange) | Security panel |
| `d` (red) | Locked door |
| `D` (yellow) | Open door |
| `#` | Wall |
| `.` | Floor |

---

## Smith Behavior — Camera-Gated Awareness

**Smith does not move until he has a reason to.**

Smith only activates when:
1. An **active camera (`C`)** detects an agent within 2 tiles — camera turns alarmed, Smith mobilizes toward it
2. A **hack attempt fails** — element goes alarmed, same result

Until then: Smith stands completely still, wherever he spawned.

When alerted:
- Smith moves toward the alarmed camera position first
- Once he reaches it, he hunts the nearest agent
- He escalates in level the longer he's active

**Stealth skill** makes an agent invisible to cameras — they can walk past `C` tiles safely.

**To de-escalate:** Hack a camera to `disabled` (breached). Cameras already alarmed stay alarmed until the mission ends — there's no resetting a triggered alert.

---

## Commanding Agents (Right Panel)

Click an agent's tab and type naturally:

```
Move north toward the exit
Override the camera near you
Head to the archive terminal
Evade — get out of there
```

Claude Haiku interprets your command and responds in character. The agent also performs the action (move, hack, evade).

**Slash commands (typed in the agent chat):**
```
/download hacking     — download hacking skill to this agent
/download stealth     — stealth makes agent invisible to cameras
/download kung-fu     — survive one Smith contact
/download lockpick    — open locked doors (d)
/download combat      — firearms proficiency
/download pilot       — hovercraft / APU skills
```

A download takes ~2.5s and plays an ASCII progress bar.

---

## Operator Terminal Commands (Left Panel)

```
missions              — list missions
accept <type>         — accept a mission
jack <agent> in       — jack agent into Matrix
jack <agent> out      — extract agent
status                — current mission + agent status
map                   — print current map
systems               — list hackable elements and their states
hack <label>          — hack element by label (e.g. hack CAM-1)
agents                — list all agents
call <agent>          — open that agent's chat tab
skills <agent>        — show agent's downloaded skills
help                  — full command list
```

---

## Mission Flow

### Extraction — Find Neo (difficulty 1)
Goal: lure Smith away, reach **Neo** (`N`), then lead Trinity to the extraction phone (`P`).

**Map overview:**
```
####################
#.......P..........#   ← phone at (8,1); lure element L at (17,1)
#.......C..........#   ← camera guards the door below
########d###########   ← locked door at (8,3) — blocks escape north
#.......N..........#   ← Neo (NPC) at (8,4)
#..................#
#..................#
#..................#
#T.................#   ← Trinity spawns at (1,8)
####################
```

**Step-by-step:**
1. `jack trinity in` — Trinity appears at bottom-left
2. `hack trinity LURE-1` — Smith walks north toward the lure at (17,1), **away from Neo**
3. While Smith is walking away, route Trinity north to (8,4) — **Neo found** ✓
4. `hack trinity DOOR-1` — unlocks the wall blocking the escape corridor
5. `hack trinity CAM-1` — disables camera guarding the phone
6. Route Trinity north to phone at (8,1) — **mission complete** ✓

**Timing:** Once Smith reaches the lure he'll start hunting Trinity — you have limited time to extract after step 3.

Smith spawns at (16,7) and is **completely frozen** until:
- You hack `LURE-1` → Smith walks toward the lure
- Trinity walks within **1 tile** of Smith → immediate alarm, Smith hunts
- Camera spots Trinity (2-tile range) → alarm, Smith mobilizes

### Infiltration — Government Server Breach (difficulty 2)
Reach the `SERVER` terminal in the center. Cameras guard the path.

### Rescue — Trapped Operative (difficulty 2)
Navigate the subway. Reach the far end, then extract via hardline.

### Data Heist — Merovingian's Archive (difficulty 3)
Reach the `ARCHIVE` terminal in the upper right. Two cameras guard the route.

### Smith Containment (difficulty 4)
Multiple Smiths. Reach the `NODE-X` terminal in the sewers without engaging.

### Ship Defense (difficulty 5)
No Matrix. Manage ship systems and survive sentinel assault.

---

## Agent Status

| Status | Meaning |
|--------|---------|
| `standby` | In the construct, not jacked in |
| `in_matrix` | Active on the map |
| `resting` | Recovering health/fatigue |
| `extracted` | Safely jacked out this mission |

---

## Tips

- **Go slow.** Smith won't move until cameras are triggered.
- **Disable cameras before moving through them** — failed hacks alarm Smith.
- **Stealth first** — `/download stealth` before approaching cameras removes all camera risk.
- **Cameras have 2-tile detection radius.** You can walk 3 tiles away safely.
- When Smith is alerted, he moves toward the camera that triggered — not directly at you. Use this to create diversions.
- Jack out before the time limit runs out or it counts as a failed mission.
