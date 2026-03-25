// ---------------------------------------------------------------------------
// Matrix Operator – Central Game State (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

import type {
  Agent,
  AgentAIState,
  AgentChatHistory,
  AgentName,
  AgentSkill,
  Anomaly,
  ChatMessage,
  EventPriority,
  GameEvent,
  GamePhase,
  GameStateSlice,
  HackableElement,
  Mission,
  NarrativeBeat,
  Position,
  Rank,
  ShipStatus,
  SmithAIState,
  TerminalLine,
  Threat,
} from './types';
import { createDefaultShip } from './ship-systems';
import { getRank, RANKS } from './scoring';

// -- Default agents ---------------------------------------------------------

function createDefaultAgents(): Record<AgentName, Agent> {
  return {
    neo: {
      name: 'neo',
      displayName: 'Neo',
      status: 'ready',
      position: { x: 0, y: 0 },
      fatigue: 20,
      health: 100,
      missionsCompleted: 0,
      skills: [],
    },
    trinity: {
      name: 'trinity',
      displayName: 'Trinity',
      status: 'ready',
      position: { x: 0, y: 0 },
      fatigue: 30,
      health: 100,
      missionsCompleted: 0,
      skills: [],
    },
    morpheus: {
      name: 'morpheus',
      displayName: 'Morpheus',
      status: 'ready',
      position: { x: 0, y: 0 },
      fatigue: 25,
      health: 100,
      missionsCompleted: 0,
      skills: [],
    },
    niobe: {
      name: 'niobe',
      displayName: 'Niobe',
      status: 'ready',
      position: { x: 0, y: 0 },
      fatigue: 15,
      health: 100,
      missionsCompleted: 0,
      skills: [],
    },
    ghost: {
      name: 'ghost',
      displayName: 'Ghost',
      status: 'resting',
      position: { x: 0, y: 0 },
      fatigue: 70,
      health: 100,
      missionsCompleted: 0,
      skills: [],
    },
  };
}

// -- Default AI states ------------------------------------------------------

function createDefaultAIState(): AgentAIState {
  return {
    movementTarget: null,
    plannedPath: [],
    isMoving: false,
    lastGuidance: '',
    visibleTiles: [],
    lastAITick: 0,
  };
}

function createDefaultSmithAIState(): SmithAIState {
  return {
    currentTarget: null,
    anomalyAware: false,
    knownFailedHacks: [],
    lastAITick: 0,
  };
}

// -- Initial state ----------------------------------------------------------

function createEmptyChatHistories(): AgentChatHistory {
  return { neo: [], trinity: [], morpheus: [], niobe: [], ghost: [] };
}

function createInitialState() {
  return {
    currentPhase: 'boot' as GamePhase,
    score: 0,
    totalScore: 0,
    rank: RANKS[0] as Rank,
    agents: createDefaultAgents(),
    mission: null as Mission | null,
    missionCount: 0,
    completedMissions: 0,
    ship: createDefaultShip(),
    threats: [] as Threat[],
    anomalies: [] as Anomaly[],
    events: [] as GameEvent[],
    tickCount: 0,
    sessionStartTime: Date.now(),
    terminalLines: [] as TerminalLine[],
    inputEnabled: false,
    bootComplete: false,
    agentChatHistories: createEmptyChatHistories(),
    hackableElements: [] as HackableElement[],
    activeAgentTab: null as AgentName | null,
    narrativeQueue: [] as string[],
    routePreviews: {} as Partial<Record<AgentName, Position[]>>,
    missionBeat: 'awakening' as NarrativeBeat,
    waitingForInput: false,
    narrativeContext: [] as string[],
    signalSpike: false,
    smithDistance: 10,
    empFired: false,
    trinityShockAt: 0,
  };
}

// -- Store ------------------------------------------------------------------

const STORAGE_KEY = 'matrix-operator-save';
const MAX_TERMINAL_LINES = 500;
const MAX_EVENTS = 200;

export const useGameStore = create<GameStateSlice>((set, get) => ({
  ...createInitialState(),

  // -- Terminal output ------------------------------------------------------

  addTerminalLine: (text: string, className?: string) =>
    set((state) => {
      const lines = [...state.terminalLines, { text, className }];
      // Trim old lines to prevent memory issues
      if (lines.length > MAX_TERMINAL_LINES) {
        return { terminalLines: lines.slice(-MAX_TERMINAL_LINES) };
      }
      return { terminalLines: lines };
    }),

  clearTerminal: () => set({ terminalLines: [] }),

  // -- Events ---------------------------------------------------------------

  addEvent: (type: string, message: string, priority: EventPriority) =>
    set((state) => {
      const event: GameEvent = {
        timestamp: Date.now(),
        type,
        message,
        priority,
      };
      const events = [...state.events, event];
      return {
        events: events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events,
      };
    }),

  // -- Agent management -----------------------------------------------------

  updateAgent: (name: AgentName, partial: Partial<Agent>) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [name]: { ...state.agents[name], ...partial },
      },
    })),

  // -- Ship management ------------------------------------------------------

  updateShip: (partial: Partial<ShipStatus>) =>
    set((state) => ({
      ship: { ...state.ship, ...partial },
    })),

  // -- Threat management ----------------------------------------------------

  addThreat: (threat: Threat) =>
    set((state) => ({
      threats: [...state.threats, threat],
    })),

  removeThreat: (id: string) =>
    set((state) => ({
      threats: state.threats.filter((t) => t.id !== id),
    })),

  // -- Anomaly management ---------------------------------------------------

  addAnomaly: (anomaly: Anomaly) =>
    set((state) => ({
      anomalies: [...state.anomalies, anomaly],
    })),

  updateAnomaly: (id: string, partial: Partial<Anomaly>) =>
    set((state) => ({
      anomalies: state.anomalies.map((a) =>
        a.id === id ? { ...a, ...partial } : a,
      ),
    })),

  // -- Mission lifecycle ----------------------------------------------------

  startMission: (mission: Mission) =>
    set({
      mission: { ...mission, status: 'active' },
      currentPhase: mission.type === 'ship_defense' ? 'ship_defense' : 'mission',
      missionBeat: 'awakening',
      waitingForInput: false,
      narrativeContext: [],
      signalSpike: false,
      smithDistance: 10,
    }),

  completeMission: () =>
    set((state) => {
      if (!state.mission) return {};
      return {
        mission: { ...state.mission, status: 'completed' },
        missionCount: state.missionCount + 1,
        completedMissions: state.completedMissions + 1,
        currentPhase: 'idle',
      };
    }),

  failMission: () =>
    set((state) => {
      if (!state.mission) return {};
      return {
        mission: { ...state.mission, status: 'failed' },
        missionCount: state.missionCount + 1,
        currentPhase: 'idle',
      };
    }),

  // -- Scoring --------------------------------------------------------------

  addScore: (points: number) =>
    set((state) => {
      const newTotal = state.totalScore + points;
      return {
        score: state.score + points,
        totalScore: newTotal,
        rank: getRank(newTotal),
      };
    }),

  // -- Game tick -------------------------------------------------------------

  tick: () =>
    set((state) => ({
      tickCount: state.tickCount + 1,
    })),

  // -- Phase & flags --------------------------------------------------------

  setPhase: (phase: GamePhase) => set({ currentPhase: phase }),

  setInputEnabled: (enabled: boolean) => set({ inputEnabled: enabled }),

  setBootComplete: (complete: boolean) =>
    set({ bootComplete: complete, inputEnabled: complete }),

  // -- Agent chat -----------------------------------------------------------

  addChatMessage: (agentName: AgentName, message: ChatMessage) =>
    set((state) => ({
      agentChatHistories: {
        ...state.agentChatHistories,
        [agentName]: [
          ...state.agentChatHistories[agentName],
          message,
        ].slice(-200),
      },
    })),

  setActiveAgentTab: (agent: AgentName | null) => set({ activeAgentTab: agent }),

  // -- Hackable elements ----------------------------------------------------

  addHackableElement: (el: HackableElement) =>
    set((state) => ({
      hackableElements: [...state.hackableElements, el],
    })),

  updateHackableElement: (id: string, partial: Partial<HackableElement>) =>
    set((state) => ({
      hackableElements: state.hackableElements.map((el) =>
        el.id === id ? { ...el, ...partial } : el,
      ),
    })),

  setHackableElements: (elements: HackableElement[]) =>
    set({ hackableElements: elements }),

  // -- Agent skills ---------------------------------------------------------

  updateAgentSkills: (agentName: AgentName, skills: AgentSkill[]) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentName]: { ...state.agents[agentName], skills },
      },
    })),

  // -- Narrative queue ------------------------------------------------------

  addNarrativeLine: (line: string) =>
    set((state) => ({
      narrativeQueue: [...state.narrativeQueue, line].slice(-10),
    })),

  clearNarrativeQueue: () => set({ narrativeQueue: [] }),

  // -- AI-driven agent system -----------------------------------------------

  updateRoutePreview: (agent: AgentName, path: Position[]) =>
    set((state) => ({
      routePreviews: { ...state.routePreviews, [agent]: path },
    })),

  updateAgentAIState: (agentName: AgentName, partial: Partial<AgentAIState>) =>
    set((state) => {
      const agent = state.agents[agentName];
      return {
        agents: {
          ...state.agents,
          [agentName]: {
            ...agent,
            aiState: { ...(agent.aiState ?? createDefaultAIState()), ...partial },
          },
        },
      };
    }),

  updateThreatAIState: (id: string, partial: Partial<SmithAIState>) =>
    set((state) => ({
      threats: state.threats.map((t) =>
        t.id === id
          ? { ...t, aiState: { ...(t.aiState ?? createDefaultSmithAIState()), ...partial } }
          : t,
      ),
    })),

  // -- Narrative orchestrator -----------------------------------------------

  setMissionBeat: (beat: NarrativeBeat) => set({ missionBeat: beat }),

  setWaitingForInput: (v: boolean) => set({ waitingForInput: v }),

  addNarrativeContext: (line: string) =>
    set((state) => ({
      narrativeContext: [...state.narrativeContext, line].slice(-8),
    })),

  setSignalSpike: (v: boolean) => set({ signalSpike: v }),

  setSmithDistance: (n: number) => set({ smithDistance: n }),

  setEmpFired: (v: boolean) => set({ empFired: v }),

  setTrinityShock: (t: number) => set({ trinityShockAt: t }),

  // -- Reset ----------------------------------------------------------------

  reset: () => set(createInitialState()),

  // -- Persistence ----------------------------------------------------------

  saveToLocalStorage: () => {
    try {
      const state = get();
      // Truncate chat history to last 50 messages per agent for storage efficiency
      const truncatedChats: AgentChatHistory = createEmptyChatHistories();
      for (const agent of Object.keys(state.agentChatHistories) as AgentName[]) {
        truncatedChats[agent] = state.agentChatHistories[agent].slice(-50);
      }
      const saveable = {
        totalScore: state.totalScore,
        rank: state.rank,
        agents: state.agents,
        missionCount: state.missionCount,
        completedMissions: state.completedMissions,
        ship: state.ship,
        tickCount: state.tickCount,
        // Note: agentChatHistories intentionally excluded — chat is per-session
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveable));
    } catch {
      // localStorage may not be available (SSR)
    }
  },

  loadFromLocalStorage: (): boolean => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      // Merge loaded agents with defaults to pick up new fields (e.g. skills)
      const defaultAgents = createDefaultAgents();
      const loadedAgents = data.agents ?? {};
      const mergedAgents: Record<AgentName, import('./types').Agent> = { ...defaultAgents };
      for (const name of Object.keys(defaultAgents) as AgentName[]) {
        if (loadedAgents[name]) {
          mergedAgents[name] = { ...defaultAgents[name], ...loadedAgents[name] };
        }
      }
      set({
        totalScore: data.totalScore ?? 0,
        rank: data.rank ?? RANKS[0],
        agents: mergedAgents,
        missionCount: data.missionCount ?? 0,
        completedMissions: data.completedMissions ?? 0,
        ship: data.ship ?? createDefaultShip(),
        tickCount: data.tickCount ?? 0,
        // agentChatHistories intentionally not restored — chat is per-session
      });
      return true;
    } catch {
      return false;
    }
  },
}));
