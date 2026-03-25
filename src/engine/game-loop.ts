// ---------------------------------------------------------------------------
// Matrix Operator – Game Loop (requestAnimationFrame + fixed timestep)
// ---------------------------------------------------------------------------

import { useGameStore } from './game-state';
import { generateAnomaly } from './anomaly-engine';
import { advanceSentinel, replicateSmith } from './threat-engine';
import { tickShipSystems } from './ship-systems';
import { processMissionTick } from './mission-engine';
import { restAgent } from './agent-manager';
import { getMissionMap, getMissionObjectiveChecker } from '../missions';
import { tickAgentAI } from './agent-ai';
import { tickSmithAI } from './smith-ai';
import { aiCallQueue } from './ai-call-queue';
import { callOrchestrator } from './mission-orchestrator';
import type { AgentName } from './types';

export class GameLoop {
  /** Milliseconds between logical ticks */
  private tickRate: number;
  private running: boolean = false;
  private paused: boolean = false;
  private rafId: number | null = null;
  private lastTickTime: number = 0;
  private accumulator: number = 0;

  /** Countdown to next auto-generated anomaly (ms) */
  private nextAnomalyIn: number = 0;

  /** Counts up each tick; narrative fires every 6 ticks (~18s) */
  private narrativeTick: number = 0;

  /**
   * Grace period countdown — threats don't hunt during first N ticks.
   * Reset when a new mission starts. 5 ticks = 15s of breathing room.
   */
  private graceTick: number = 0;

  /** Track last Smith transmission per smith-agent pair (throttle to 60s) */
  private lastSmithProximity: Record<string, number> = {};

  /** Counts up each tick; ambient orchestrator fires every 8 ticks (~24s) */
  private ambientOrchestratorTick: number = 0;

  /** External callback fired on every logical tick */
  private onTick: (() => void) | null = null;

  constructor(tickRate: number = 3000) {
    this.tickRate = tickRate;
    this.resetAnomalyTimer();
  }

  // -- Public API -----------------------------------------------------------

  /**
   * Start the game loop.
   */
  start(onTick?: () => void): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.onTick = onTick ?? null;
    this.lastTickTime = performance.now();
    this.accumulator = 0;
    this.scheduleFrame();
  }

  /**
   * Stop the game loop completely.
   */
  stop(): void {
    this.running = false;
    this.paused = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Pause without destroying state.
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume from pause.
   */
  resume(): void {
    if (!this.running) return;
    this.paused = false;
    this.lastTickTime = performance.now();
    this.accumulator = 0;
    this.scheduleFrame();
  }

  /**
   * Change tick rate at runtime.
   */
  setTickRate(ms: number): void {
    this.tickRate = Math.max(500, ms);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  // -- Internal -------------------------------------------------------------

  private scheduleFrame(): void {
    if (!this.running || this.paused) return;
    this.rafId = requestAnimationFrame((now) => this.frame(now));
  }

  private frame(now: number): void {
    if (!this.running || this.paused) return;

    const delta = now - this.lastTickTime;
    this.lastTickTime = now;
    this.accumulator += delta;

    // Process as many fixed-step ticks as have accumulated
    while (this.accumulator >= this.tickRate) {
      this.accumulator -= this.tickRate;
      this.executeTick();
    }

    this.scheduleFrame();
  }

  private executeTick(): void {
    const store = useGameStore.getState();
    const phase = store.currentPhase;

    // Only tick when the game is actually active
    if (phase === 'boot' || phase === 'game_over') return;

    // Advance the central tick counter
    store.tick();

    // Tick duration in seconds
    const tickSec = this.tickRate / 1000;

    // -- Agent rest recovery --
    const agentNames: AgentName[] = ['neo', 'trinity', 'morpheus', 'niobe', 'ghost'];
    for (const name of agentNames) {
      const agent = store.agents[name];
      if (agent.status === 'resting') {
        const update = restAgent(agent);
        if (Object.keys(update).length > 0) {
          store.updateAgent(name, update);
        }
      }
    }

    // -- Mission processing --
    if (store.mission && store.mission.status === 'active') {
      const { updatedMission, newEvents } = processMissionTick(
        store.mission,
        tickSec,
      );

      // Apply mission update
      useGameStore.setState({ mission: updatedMission });

      // Log new events
      for (const evt of newEvents) {
        store.addEvent(evt.type, evt.message, evt.priority);
        store.addTerminalLine(
          `[${evt.priority.toUpperCase()}] ${evt.message}`,
          evt.priority === 'critical'
            ? 'critical'
            : evt.priority === 'warning'
              ? 'warning'
              : 'system',
        );
      }

      // Check for mission failure by timeout
      if (updatedMission.status === 'failed') {
        store.failMission();
      }

      // -- Per-mission objective checking --
      if (updatedMission.status === 'active') {
        const checker = getMissionObjectiveChecker(updatedMission.type);
        if (checker) {
          checker(useGameStore.getState());
        }
      }
    }

    const isNarrativeMission = store.mission?.type === 'trinitys_escape';

    // -- Autonomous agent AI ticks (skipped for narrative missions) --
    if (phase === 'mission' && store.mission?.status === 'active' && !isNarrativeMission) {
      for (const name of agentNames) {
        const agent = store.agents[name];
        if (agent.status === 'in_matrix') {
          tickAgentAI(name, useGameStore.getState());
        }
      }
    }

    // -- Ambient orchestrator tick (narrative missions only, every 8 ticks) --
    if (
      phase === 'mission' &&
      isNarrativeMission &&
      store.mission?.status === 'active' &&
      !store.waitingForInput
    ) {
      this.ambientOrchestratorTick++;
      if (this.ambientOrchestratorTick >= 8) {
        this.ambientOrchestratorTick = 0;
        aiCallQueue.enqueue(async () => {
          await callOrchestrator('', true);
        });
      }
    }

    // -- Threat advancement (skipped for narrative missions) --
    if ((phase === 'mission' || phase === 'ship_defense') && !isNarrativeMission) {
      if (this.graceTick > 0) this.graceTick--;

      // -- Camera detection: active cameras spot nearby agents (no stealth) --
      // Detection range: 2 tiles (tight coverage — agents can pass nearby safely)
      const CAMERA_RANGE = 2;
      let cameraAlertPos: { x: number; y: number } | null = null;

      const activeCameras = store.hackableElements.filter(
        (el) => el.type === 'camera' && el.state === 'active',
      );

      outer: for (const camera of activeCameras) {
        for (const name of agentNames) {
          const agent = store.agents[name];
          if (agent.status !== 'in_matrix') continue;
          if (agent.skills?.includes('stealth')) continue; // stealth bypasses cameras

          const dist =
            Math.abs(camera.position.x - agent.position.x) +
            Math.abs(camera.position.y - agent.position.y);

          if (dist <= CAMERA_RANGE) {
            // Camera spots agent — trigger alarm
            useGameStore.setState({
              hackableElements: store.hackableElements.map((el) =>
                el.id === camera.id ? { ...el, state: 'alarmed' as const } : el,
              ),
            });
            cameraAlertPos = camera.position;
            store.addTerminalLine(
              `[ALERT] ${camera.label} detected movement — Smith units mobilizing.`,
              'critical',
            );
            store.addEvent('camera_alert', `Camera ${camera.label} spotted an agent.`, 'critical');
            break outer;
          }
        }
      }

      // 1-tile Smith proximity: agent adjacent to Smith → immediate alarm
      if (!cameraAlertPos) {
        const smithThreats = store.threats.filter((t) => t.type === 'smith' && t.active);
        outerProx: for (const smith of smithThreats) {
          for (const name of agentNames) {
            const agent = store.agents[name];
            if (agent.status !== 'in_matrix') continue;
            const dist =
              Math.abs(smith.position.x - agent.position.x) +
              Math.abs(smith.position.y - agent.position.y);
            if (dist <= 1) {
              cameraAlertPos = smith.position;
              store.addTerminalLine(
                `[ALERT] Agent Smith is on ${agent.displayName}! Get out NOW.`,
                'critical',
              );
              store.addEvent('smith_contact', `Smith made contact with ${agent.displayName}.`, 'critical');
              break outerProx;
            }
          }
        }
      }

      // Reload state after potential camera/proximity update
      const freshStore = useGameStore.getState();

      // Alert target: camera/proximity alert > alarmed element > lure system (walk target only)
      const alarmedEl = freshStore.hackableElements.find((el) => el.state === 'alarmed');
      const luredEl   = freshStore.hackableElements.find(
        (el) => el.type === 'lure_system' && el.state === 'breached',
      );
      const alertTarget = cameraAlertPos ?? alarmedEl?.position ?? luredEl?.position ?? null;
      const hasAlarm    = alarmedEl !== null || cameraAlertPos !== null;
      const isLured     = !hasAlarm && luredEl !== null;

      // -- Smith AI ticks (autonomous behavior) --
      for (const threat of freshStore.threats) {
        if (threat.type === 'smith' && threat.active) {
          // Notify Smith of alerts via its AI state
          if (hasAlarm || isLured) {
            freshStore.updateThreatAIState(threat.id, {
              anomalyAware: true,
              currentTarget: alertTarget,
            });
          }
          tickSmithAI(threat, useGameStore.getState());
        }
      }

      // Re-read threats — tickSmithAI may have updated positions
      const reloadedThreats = useGameStore.getState().threats;

      // Advance sentinels (not AI-driven). Build a map keyed by id for fast lookup.
      const sentinelUpdateMap = new Map<string, ReturnType<typeof advanceSentinel>>();
      for (const threat of freshStore.threats) {
        if (threat.type === 'sentinel') {
          sentinelUpdateMap.set(threat.id, advanceSentinel(threat));
        }
      }

      // Smith replication — only when truly alarmed (not just lured), 4% chance, level 3+
      const newThreats = [...reloadedThreats];
      if (hasAlarm) {
        for (const threat of reloadedThreats) {
          if (
            threat.type === 'smith' &&
            threat.level >= 3 &&
            Math.random() < 0.04
          ) {
            const copy = replicateSmith(threat);
            if (copy) newThreats.push(copy);
          }
        }
      }

      // Apply sentinel updates only to sentinel threats — do NOT touch Smith positions
      // (Smith positions are owned by tickSmithAI and must not be overwritten)
      const finalThreats = newThreats.map((t) => {
        if (t.type === 'sentinel') {
          return sentinelUpdateMap.get(t.id) ?? t;
        }
        return t;
      });

      useGameStore.setState({ threats: finalThreats });
    }

    // -- Ship systems tick --
    if (phase === 'ship_defense') {
      const updatedShip = tickShipSystems(store.ship, phase);
      store.updateShip(updatedShip);
    }

    // -- Auto-generate anomalies during missions --
    if (phase === 'mission') {
      this.nextAnomalyIn -= this.tickRate;
      if (this.nextAnomalyIn <= 0) {
        const anomaly = generateAnomaly();
        store.addAnomaly(anomaly);
        store.addEvent(
          'anomaly_spawn',
          'Anomaly detected in Matrix feed.',
          'info',
        );
        this.resetAnomalyTimer();
      }
    }

    // -- Mission narrative auto-generation (every 6 ticks = ~18s) --
    // Skipped for narrative missions — orchestrator handles atmosphere.
    if (phase === 'mission' && store.mission && !isNarrativeMission) {
      this.narrativeTick++;
      if (this.narrativeTick >= 6) {
        this.narrativeTick = 0;
        this.triggerMissionNarrative(store);
      }
    }

    // -- Smith proximity auto-transmission (skipped for narrative missions) --
    if ((phase === 'mission' || phase === 'ship_defense') && !isNarrativeMission) {
      this.checkSmithProximity(store);
    }

    // -- External callback --
    if (this.onTick) {
      this.onTick();
    }
  }

  /**
   * Fire a missionNarrative Haiku call and push result to narrativeQueue.
   * Non-blocking — uses fetch in fire-and-forget pattern.
   */
  private triggerMissionNarrative(store: ReturnType<typeof useGameStore.getState>): void {
    if (!store.mission) return;

    const mission = store.mission;
    const agentNames: AgentName[] = ['neo', 'trinity', 'morpheus', 'niobe', 'ghost'];
    const agentsInMatrix = agentNames
      .filter((n) => store.agents[n].status === 'in_matrix')
      .map((n) => store.agents[n].displayName);

    if (agentsInMatrix.length === 0) return;

    const smithThreats = store.threats.filter((t) => t.type === 'smith' && t.active);
    let smithProximity: 'none' | 'distant' | 'near' | 'contact' = 'none';
    if (smithThreats.length > 0) {
      // Compute actual Manhattan distance — eta field is not a distance metric for Smiths
      let minDist = Infinity;
      for (const smith of smithThreats) {
        for (const n of agentNames) {
          const agent = store.agents[n];
          if (agent.status !== 'in_matrix') continue;
          const dist = Math.abs(smith.position.x - agent.position.x) +
                       Math.abs(smith.position.y - agent.position.y);
          if (dist < minDist) minDist = dist;
        }
      }
      if (minDist <= 2) smithProximity = 'contact';
      else if (minDist <= 7) smithProximity = 'near';
      else if (minDist < Infinity) smithProximity = 'distant';
    }

    const recentEvents = store.events.slice(-3).map((e) => e.message);
    const hackableStatuses = store.hackableElements.slice(0, 3).map(
      (el) => `${el.label}: ${el.state}`,
    );

    const timeRemaining = mission.timeLimit - mission.elapsedTime;

    aiCallQueue.enqueue(async () => {
      const res = await fetch('/api/haiku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType: 'missionNarrative',
          context: {
            missionType: mission.type,
            elapsedTime: mission.elapsedTime,
            timeRemaining,
            smithProximity,
            agentsInMatrix,
            recentEvents,
            hackableStatuses,
          },
        }),
      });
      const data = await res.json();
      if (data.text) {
        useGameStore.getState().addNarrativeLine(data.text);
      }
    });
  }

  /**
   * Check Smith proximity and fire a smithTransmission Haiku when Smith
   * is within 5 tiles of any agent. Throttled to once per agent encounter.
   */
  private checkSmithProximity(store: ReturnType<typeof useGameStore.getState>): void {
    const agentNames: AgentName[] = ['neo', 'trinity', 'morpheus', 'niobe', 'ghost'];
    const smithThreats = store.threats.filter((t) => t.type === 'smith' && t.active);

    for (const name of agentNames) {
      const agent = store.agents[name];
      if (agent.status !== 'in_matrix') continue;

      for (const smith of smithThreats) {
        const dist = Math.abs(smith.position.x - agent.position.x) +
          Math.abs(smith.position.y - agent.position.y);

        if (dist <= 5) {
          const key = `${smith.id}-${name}`;
          const lastFired = this.lastSmithProximity[key] ?? 0;
          const now = Date.now();

          // Fire at most once per 60 seconds per smith-agent pair
          if (now - lastFired < 60000) continue;
          this.lastSmithProximity[key] = now;

          this.triggerSmithTransmission(store, name, dist);
        }
      }
    }
  }

  private triggerSmithTransmission(
    store: ReturnType<typeof useGameStore.getState>,
    targetAgentName: AgentName,
    distance: number,
  ): void {
    const situation = `Agent Smith is ${distance} tiles from ${store.agents[targetAgentName].displayName} in the Matrix.`;
    const recentActions = store.events.slice(-3).map((e) => e.message);

    aiCallQueue.enqueue(async () => {
      const res = await fetch('/api/haiku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType: 'smithTransmission',
          context: { situation, playerActions: recentActions },
        }),
      });
      const data = await res.json();
      if (data.text) {
        useGameStore.getState().addTerminalLine(`[SMITH] ${data.text}`, 'smith');
      }
    });
  }

  private resetAnomalyTimer(): void {
    // 8-15 seconds between anomalies
    this.nextAnomalyIn = (8 + Math.random() * 7) * 1000;
  }
}

/** Singleton game loop instance */
export const gameLoop = new GameLoop();
