// ---------------------------------------------------------------------------
// Matrix Operator – Dialogue Generator (Haiku-first, fallback-second)
// ---------------------------------------------------------------------------

import { callHaiku } from './haiku-client';
import {
  getFallbackDialogue,
  getRandomLine,
  SMITH_TAUNTS,
  ANOMALY_ANALYSES,
  MISSION_BRIEFINGS,
} from './fallback-dialogue';
import type { Anomaly, Mission } from '@/engine/types';

const FALLBACK_MARKER = '[Signal lost';

function isFallback(text: string): boolean {
  return text.startsWith(FALLBACK_MARKER);
}

// ---------------------------------------------------------------------------
// Agent dialogue
// ---------------------------------------------------------------------------

export async function generateAgentDialogue(
  agentName: string,
  situation: string,
  playerCommand: string,
): Promise<string> {
  const result = await callHaiku('agentDialogue', {
    agentName,
    situation,
    playerCommand,
    agentStatus: 'in_matrix',
  });

  if (isFallback(result)) {
    return getFallbackDialogue(agentName, situation);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Smith taunt
// ---------------------------------------------------------------------------

export async function generateSmithTaunt(situation: string): Promise<string> {
  const result = await callHaiku('smithTransmission', {
    situation,
    playerActions: [],
  });

  if (isFallback(result)) {
    return getRandomLine(SMITH_TAUNTS);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Anomaly analysis
// ---------------------------------------------------------------------------

export async function generateAnomalyAnalysis(
  anomaly: Anomaly,
  context: { missionPhase: string; activeThreats: number },
): Promise<string> {
  const result = await callHaiku('anomalyAnalysis', {
    anomalyType: anomaly.type,
    coordinates: `sector-${anomaly.id.slice(-6)}`,
    missionPhase: context.missionPhase,
    activeThreats: context.activeThreats,
  });

  if (isFallback(result)) {
    return getRandomLine(ANOMALY_ANALYSES);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Mission briefing
// ---------------------------------------------------------------------------

export async function generateMissionBriefing(
  mission: Mission,
): Promise<string> {
  const result = await callHaiku('missionBriefing', {
    missionType: mission.type,
    difficulty: 2,
    agents: mission.agents,
    campaignContext: '',
  });

  if (isFallback(result)) {
    const pool = MISSION_BRIEFINGS[mission.type] ?? MISSION_BRIEFINGS.extraction;
    return getRandomLine(pool);
  }
  return result;
}
