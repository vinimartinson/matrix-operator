// ---------------------------------------------------------------------------
// Matrix Operator – Core Type Definitions
// ---------------------------------------------------------------------------

/** Playable agent identifiers */
export type AgentName = 'neo' | 'trinity' | 'morpheus' | 'niobe' | 'ghost';

/** Lifecycle status of an agent */
export type AgentStatus = 'ready' | 'in_matrix' | 'resting' | 'injured' | 'dead';

/** 2-D coordinate on a game map */
export interface Position {
  x: number;
  y: number;
}

/** Skills that can be downloaded into an agent */
export type AgentSkill = 'kung-fu' | 'hacking' | 'stealth' | 'lockpick' | 'combat' | 'pilot';

/** Autonomous agent AI state — drives movement and decision-making */
export interface AgentAIState {
  /** Current movement target (if any) */
  movementTarget: Position | null;
  /** Queued movement path for route preview on map */
  plannedPath: Position[];
  /** Is the agent currently executing a movement? */
  isMoving: boolean;
  /** Last operator guidance message */
  lastGuidance: string;
  /** Agent's current awareness (tiles within 2-tile radius) */
  visibleTiles: Position[];
  /** Tick of last AI decision (Haiku call) */
  lastAITick: number;
}

/** A field agent that can jack-in to the Matrix */
export interface Agent {
  name: AgentName;
  displayName: string;
  status: AgentStatus;
  position: Position;
  /** 0 = fresh, 100 = exhausted */
  fatigue: number;
  /** 0 = dead, 100 = full health */
  health: number;
  missionsCompleted: number;
  skills: AgentSkill[];
  /** AI state for autonomous agent behavior */
  aiState?: AgentAIState;
}

// -- Threats ----------------------------------------------------------------

export type ThreatType = 'smith' | 'sentinel' | 'police';

/** Smith AI state — drives autonomous Smith behavior */
export interface SmithAIState {
  /** Current hunt target or patrol point */
  currentTarget: Position | null;
  /** Whether Smith has detected an anomaly */
  anomalyAware: boolean;
  /** Known failed hack element IDs */
  knownFailedHacks: string[];
  /** Tick of last AI decision (Haiku call) */
  lastAITick: number;
}

export interface Threat {
  id: string;
  type: ThreatType;
  position: Position;
  /** 1-4 escalation level */
  level: number;
  /** Estimated time of arrival / contact (seconds) */
  eta: number;
  active: boolean;
  /** AI state for autonomous Smith behavior */
  aiState?: SmithAIState;
}

export type SmithLevel = 'lone' | 'pursuit' | 'replicating' | 'swarm';

// -- Anomalies --------------------------------------------------------------

export type AnomalyType = 'pattern_break' | 'hidden_coords' | 'color_shift' | 'morse_pulse';

export type AnomalyThreatLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  detected: boolean;
  analyzed: boolean;
  threatLevel: AnomalyThreatLevel;
  description: string;
  timestamp: number;
}

// -- Missions ---------------------------------------------------------------

export type MissionType =
  | 'extraction'
  | 'infiltration'
  | 'rescue'
  | 'data_heist'
  | 'smith_containment'
  | 'ship_defense'
  | 'trinitys_escape';

/** Narrative story beat for AI-orchestrated missions */
export type NarrativeBeat =
  | 'awakening'       // Mission start — anomalies, Smiths closing in
  | 'guidance_needed' // Operator must engage Trinity via chat
  | 'en_route'        // Trinity moving through corridors
  | 'door_blocked'    // Trinity at locked door — operator must hack
  | 'path_clear'      // Door open, phone room visible
  | 'phone_approach'  // Trinity closing in on phone
  | 'extraction'      // Trinity at phone — operator must jack out
  | 'complete';       // Mission success

export type MissionStatus = 'briefing' | 'active' | 'completed' | 'failed';

export interface Mission {
  id: string;
  type: MissionType;
  status: MissionStatus;
  title: string;
  description: string;
  objectives: string[];
  agents: AgentName[];
  /** Time limit in seconds */
  timeLimit: number;
  /** Elapsed time in seconds */
  elapsedTime: number;
  score: number;
  events: GameEvent[];
  /** Extraction mission: true once Trinity has reached Neo's position */
  neoFound?: boolean;
  /** When true, the mission has no time limit and will never time out */
  noTimeLimit?: boolean;
}

// -- Ship -------------------------------------------------------------------

export interface ShipSystem {
  name: string;
  /** Current operating level 0-100 */
  level: number;
  maxLevel: number;
  /** Is this system critical for survival? */
  critical: boolean;
}

export interface ShipStatus {
  hull: ShipSystem;
  power: ShipSystem;
  broadcastArray: ShipSystem;
  lifeSupport: ShipSystem;
  empSystem: ShipSystem;
  matrixFeed: ShipSystem;
  /** 0-100 charge level */
  empCharge: number;
  empCharging: boolean;
  /** Ship depth in km */
  depth: number;
  /** Distance to nearest sentinel in metres */
  sentinelDistance: number;
  /** How many sentinel units are currently in proximity */
  sentinelCount: number;
}

// -- Game -------------------------------------------------------------------

export type GamePhase = 'boot' | 'idle' | 'mission' | 'ship_defense' | 'game_over';

export type EventPriority = 'info' | 'warning' | 'critical';

export interface GameEvent {
  timestamp: number;
  type: string;
  message: string;
  priority: EventPriority;
}

export interface Rank {
  level: number;
  title: string;
  pointsRequired: number;
}

// -- Map --------------------------------------------------------------------

/** Map tile legend: # wall, . floor, D door (open), d door (locked), P phone, E elevator, X exit, C camera, S security panel, A data terminal, N Neo NPC marker */
export type MapTile = '#' | '.' | 'D' | 'd' | 'P' | 'E' | 'X' | 'C' | 'S' | 'A' | 'N';

export interface GameMap {
  name: string;
  width: number;
  height: number;
  /** Each string is one row of MapTile characters */
  tiles: string[];
  agentPositions: Position[];
  threatPositions: Position[];
  exitPositions: Position[];
  phonePositions: Position[];
  /** Hackable element initial configs for this map */
  hackableElementDefs?: HackableElementDef[];
}

// -- Hackable Elements -------------------------------------------------------

export type HackableType = 'camera' | 'security_panel' | 'door_locked' | 'data_terminal' | 'lure_system';
export type HackableState = 'active' | 'disabled' | 'breached' | 'alarmed';

/** Definition used in map templates — converted to HackableElement at mission start */
export interface HackableElementDef {
  id: string;
  type: HackableType;
  position: Position;
  requiredSkill: AgentSkill;
  difficulty: number; // 1-5
  label: string;      // e.g. "B3" for player reference
}

export interface HackableElement extends HackableElementDef {
  state: HackableState;
}

// -- Agent Chat System -------------------------------------------------------

export interface AgentAction {
  type: 'move' | 'hack' | 'override' | 'breach' | 'evade' | 'wait' | 'none';
  target?: string;
  success?: boolean;
  scoreGained?: number;
}

export interface ChatMessage {
  id: string;
  timestamp: number;
  /** 'operator' = player input, 'agent' = AI response, 'system' = automated event */
  sender: 'operator' | 'agent' | 'system';
  text: string;
  action?: AgentAction;
}

export type AgentChatHistory = Record<AgentName, ChatMessage[]>;

// -- Terminal ---------------------------------------------------------------

export interface TerminalLine {
  text: string;
  className?: string;
}

export interface CommandResult {
  output: string[];
  className?: string;
}

// -- Mission Templates ------------------------------------------------------

export interface MissionTemplate {
  type: MissionType;
  title: string;
  description: string;
  objectives: string[];
  timeLimit: number; // seconds
  suggestedAgents: AgentName[];
  difficulty: number; // 1-5
  map: GameMap;
  noTimeLimit?: boolean;
  /** When true, mission is driven by AI orchestrator (no map, no agent AI ticks) */
  isNarrativeMission?: boolean;
  /** Initial narrative beats context for orchestrator priming */
  narrativeBeats?: Partial<Record<NarrativeBeat, string>>;
}

// -- Command Registry -------------------------------------------------------

export type CommandCategory = 'navigation' | 'tactical' | 'ship' | 'meta';

export interface CommandDefinition {
  description: string;
  usage: string;
  handler: (args: string[], gameState: GameStateSlice) => CommandResult;
  category: CommandCategory;
  aliases?: string[];
  hidden?: boolean;
}

/**
 * Minimal slice of the game state that command handlers receive.
 * Kept as an interface so the actual Zustand store satisfies it.
 */
export interface GameStateSlice {
  currentPhase: GamePhase;
  score: number;
  totalScore: number;
  rank: Rank;
  agents: Record<AgentName, Agent>;
  mission: Mission | null;
  missionCount: number;
  completedMissions: number;
  ship: ShipStatus;
  threats: Threat[];
  anomalies: Anomaly[];
  events: GameEvent[];
  tickCount: number;
  sessionStartTime: number;
  terminalLines: TerminalLine[];
  inputEnabled: boolean;
  bootComplete: boolean;

  // Agent chat & hackable elements
  agentChatHistories: AgentChatHistory;
  hackableElements: HackableElement[];
  activeAgentTab: AgentName | null;
  narrativeQueue: string[];

  // AI-driven agent system
  routePreviews: Partial<Record<AgentName, Position[]>>;

  // Narrative orchestrator system (mission 1 / isNarrativeMission)
  missionBeat: NarrativeBeat;
  waitingForInput: boolean;
  narrativeContext: string[];   // last 8 orchestrator/event lines
  signalSpike: boolean;
  /** Narrative Smith proximity 0=contact … 10=far. Updated by orchestrator. */
  smithDistance: number;

  // Actions
  addTerminalLine: (text: string, className?: string) => void;
  clearTerminal: () => void;
  addEvent: (type: string, message: string, priority: EventPriority) => void;
  updateAgent: (name: AgentName, partial: Partial<Agent>) => void;
  updateShip: (partial: Partial<ShipStatus>) => void;
  addThreat: (threat: Threat) => void;
  removeThreat: (id: string) => void;
  addAnomaly: (anomaly: Anomaly) => void;
  updateAnomaly: (id: string, partial: Partial<Anomaly>) => void;
  startMission: (mission: Mission) => void;
  completeMission: () => void;
  failMission: () => void;
  addScore: (points: number) => void;
  tick: () => void;
  reset: () => void;
  setPhase: (phase: GamePhase) => void;
  setInputEnabled: (enabled: boolean) => void;
  setBootComplete: (complete: boolean) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;

  // New actions
  addChatMessage: (agent: AgentName, message: ChatMessage) => void;
  setActiveAgentTab: (agent: AgentName | null) => void;
  addHackableElement: (el: HackableElement) => void;
  updateHackableElement: (id: string, partial: Partial<HackableElement>) => void;
  updateAgentSkills: (agent: AgentName, skills: AgentSkill[]) => void;
  setHackableElements: (elements: HackableElement[]) => void;
  addNarrativeLine: (line: string) => void;
  clearNarrativeQueue: () => void;

  // AI-driven agent actions
  updateRoutePreview: (agent: AgentName, path: Position[]) => void;
  updateAgentAIState: (agent: AgentName, partial: Partial<AgentAIState>) => void;
  updateThreatAIState: (id: string, partial: Partial<SmithAIState>) => void;

  // Narrative orchestrator actions
  setMissionBeat: (beat: NarrativeBeat) => void;
  setWaitingForInput: (v: boolean) => void;
  addNarrativeContext: (line: string) => void;
  setSignalSpike: (v: boolean) => void;
  setSmithDistance: (n: number) => void;

  // EMP UI animation
  /** True briefly after EMP fires — triggers radar pulse animation */
  empFired: boolean;
  setEmpFired: (v: boolean) => void;

  // Trinity biometric shock — set to Date.now() when charge/EMP spikes her stress
  trinityShockAt: number;
  setTrinityShock: (t: number) => void;
}
