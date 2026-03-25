// ---------------------------------------------------------------------------
// Matrix Operator – Mission Orchestrator Engine
// Calls /api/orchestrator (Sonnet) and applies the response to game state.
// Used exclusively for isNarrativeMission missions (Mission 1).
// ---------------------------------------------------------------------------

import type { NarrativeBeat } from './types';

/** Cooldown: deja-vu fires at most once per 90 seconds */
let lastDejaVuMs = 0;

interface OrchestratorResponse {
  narrativeLine?: string;
  trinityMessage?: string | null;
  beatAdvance?: NarrativeBeat | null;
  signalSpike?: boolean;
  dejaVu?: boolean;
  injectAnomaly?: boolean;
  /** Smith distance estimate (0=contact, 10=far). Used by ThreatRadar. */
  smithDistance?: number;
  /** Delta applied to trinity.health (negative = damage). Range: -30 to +10 */
  trinityHealthDelta?: number;
  /** Delta applied to trinity.fatigue (positive = more stress). Range: -20 to +30 */
  trinityStressDelta?: number;
}

/**
 * Call the orchestrator API and apply results to the game store.
 * - operatorInput: the operator's message (empty string for ambient ticks)
 * - isAmbient: true when called from the game loop without operator input
 */
export async function callOrchestrator(
  operatorInput: string,
  isAmbient: boolean,
): Promise<OrchestratorResponse | null> {
  // Lazy-require to avoid circular deps with game-state
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useGameStore } = require('./game-state');
  const store = useGameStore.getState();

  const mission = store.mission;
  if (!mission) return null;

  // Build hackable state snapshot
  const hackableStates: Record<string, string> = {};
  for (const el of store.hackableElements) {
    hackableStates[el.label] = el.state;
  }

  // Build Trinity status string
  const trinity = store.agents.trinity;
  const trinityStatus =
    trinity.status === 'in_matrix'
      ? `Trinity is jacked in. Health: ${trinity.health}%, Fatigue: ${trinity.fatigue}%.`
      : `Trinity is not jacked in (status: ${trinity.status}).`;

  try {
    const res = await fetch('/api/orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beat: store.missionBeat,
        operatorInput,
        narrativeContext: store.narrativeContext,
        hackableStates,
        trinityStatus,
        isAmbient,
      }),
    });

    if (!res.ok) return null;
    const data: OrchestratorResponse = await res.json();

    applyOrchestratorResponse(data, operatorInput);
    return data;
  } catch {
    return null;
  }
}

/**
 * Apply orchestrator response fields to the live game store.
 */
function applyOrchestratorResponse(
  data: OrchestratorResponse,
  operatorInput: string,
): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useGameStore } = require('./game-state');
  const store = useGameStore.getState();

  // 1. Narrative line — only via narrativeQueue (play/page.tsx adds ▸ prefix).
  //    Do NOT also call addTerminalLine — that would double-print.
  if (data.narrativeLine) {
    store.addNarrativeLine(data.narrativeLine);
    store.addNarrativeContext(data.narrativeLine);
  }

  // 2. Trinity message → chat
  if (data.trinityMessage) {
    store.addChatMessage('trinity', {
      id: `orch-${Date.now()}`,
      timestamp: Date.now(),
      sender: 'agent',
      text: data.trinityMessage,
    });
  }

  // 3. Beat advance
  if (data.beatAdvance && data.beatAdvance !== store.missionBeat) {
    store.setMissionBeat(data.beatAdvance);

    // Log beat transition
    const beatLabel = data.beatAdvance.replace(/_/g, ' ').toUpperCase();
    store.addTerminalLine(`[STATUS] Narrative state: ${beatLabel}`, 'dim');

    // Automatic effects per beat
    const trinity = store.agents.trinity;
    if (data.beatAdvance === 'complete') {
      // Normalize everything on extraction complete
      store.setSmithDistance(10);
      store.setSignalSpike(false);
      store.updateAgent('trinity', { status: 'resting', fatigue: Math.max(0, trinity.fatigue - 10) });
    } else if (data.beatAdvance === 'path_clear') {
      // Path opens but Smiths start replicating — tension spikes
      store.setSmithDistance(4);
      store.addEvent('smith_contact', 'Smith units detected replicating in adjacent sector.', 'warning');
      store.addNarrativeLine('Signal analysis: maintenance crawlway detected — bypasses CAM-1. Move fast.');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { generateAnomaly } = require('./anomaly-engine');
      store.addAnomaly(generateAnomaly());
      store.addEvent('anomaly_spawn', 'Replication anomaly detected in matrix feed.', 'info');
    } else if (data.beatAdvance === 'door_blocked') {
      store.updateAgent('trinity', { fatigue: Math.min(100, trinity.fatigue + 15) });
    } else if (data.beatAdvance === 'en_route') {
      store.updateAgent('trinity', { fatigue: Math.min(100, trinity.fatigue + 5) });
    } else if (data.beatAdvance === 'phone_approach') {
      store.updateAgent('trinity', { fatigue: Math.min(100, trinity.fatigue + 10) });
    }
  }

  // 4. Signal spike
  if (data.signalSpike) {
    store.setSignalSpike(true);
    // Auto-clear after 3s
    setTimeout(() => {
      useGameStore.getState().setSignalSpike(false);
    }, 3000);
  }

  // 5. Deja-vu — throttled to once per 90s; emits event for AnomalyCodeFeed + BroadcastWave
  if (data.dejaVu && Date.now() - lastDejaVuMs > 90000) {
    lastDejaVuMs = Date.now();
    store.addEvent('deja_vu', 'Deja-vu pattern detected in Matrix feed.', 'warning');
    // Narrative note goes through addNarrativeLine so it gets ▸ prefix
    store.addNarrativeLine('[ANOMALY] Deja-vu signature — pattern repeat detected.');
  }

  // 6. Inject anomaly
  if (data.injectAnomaly) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateAnomaly } = require('./anomaly-engine');
    const anomaly = generateAnomaly();
    store.addAnomaly(anomaly);
    store.addEvent('anomaly_spawn', 'Anomaly detected in Matrix feed.', 'info');
  }

  // 7. Smith distance — update store for ThreatRadar
  if (typeof data.smithDistance === 'number') {
    store.setSmithDistance(Math.max(0, Math.min(10, data.smithDistance)));
  }

  // 8b. Trinity health/stress deltas from orchestrator
  if (typeof data.trinityHealthDelta === 'number' || typeof data.trinityStressDelta === 'number') {
    const t = store.agents.trinity;
    const newHealth = typeof data.trinityHealthDelta === 'number'
      ? Math.max(0, Math.min(100, t.health + data.trinityHealthDelta))
      : t.health;
    const newFatigue = typeof data.trinityStressDelta === 'number'
      ? Math.max(0, Math.min(100, t.fatigue + data.trinityStressDelta))
      : t.fatigue;
    store.updateAgent('trinity', { health: newHealth, fatigue: newFatigue });
  }

  // 8. Add operator input to narrative context (for history)
  if (operatorInput) {
    store.addNarrativeContext(`[OPERATOR]: ${operatorInput}`);
  }
}
