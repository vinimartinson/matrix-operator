// ---------------------------------------------------------------------------
// Matrix Operator – Scoring System
// ---------------------------------------------------------------------------

import type { Mission, Rank } from './types';

// -- Point values -----------------------------------------------------------

export const SCORE_VALUES = {
  /** Base score for completing a mission */
  missionComplete: 1000,
  /** Bonus per agent that survived */
  agentSurvived: 250,
  /** Per anomaly successfully detected */
  anomalyDetected: 150,
  /** Per anomaly fully analysed */
  anomalyAnalyzed: 300,
  /** Per Smith encounter avoided */
  smithAvoided: 200,
  /** Completing under par time */
  underParTimeBonus: 500,
  /** Bonus multiplier per additional second under par (stacks) */
  perSecondUnderPar: 10,
  /** Ship hull intact bonus (per % remaining) */
  hullIntactPerPercent: 5,
  /** EMP fired successfully */
  empFired: 100,
  /** Full extraction (all agents out) */
  fullExtraction: 400,
  /** Penalty: agent injured */
  agentInjured: -200,
  /** Penalty: agent killed */
  agentKilled: -500,
  /** Penalty: mission failed */
  missionFailed: -300,
} as const;

// -- Ranks ------------------------------------------------------------------

export const RANKS: Rank[] = [
  { level: 1, title: 'Coppertop', pointsRequired: 0 },
  { level: 2, title: 'Bluepill', pointsRequired: 500 },
  { level: 3, title: 'Awakened', pointsRequired: 1500 },
  { level: 4, title: 'Potential', pointsRequired: 3000 },
  { level: 5, title: 'Operator', pointsRequired: 5000 },
  { level: 6, title: 'First Mate', pointsRequired: 8000 },
  { level: 7, title: 'Crew Chief', pointsRequired: 12000 },
  { level: 8, title: 'Ship Captain', pointsRequired: 18000 },
  { level: 9, title: 'Zion Commander', pointsRequired: 25000 },
  { level: 10, title: 'The One', pointsRequired: 35000 },
];

// -- Helpers ----------------------------------------------------------------

/**
 * Get the rank for a given total score.
 */
export function getRank(totalScore: number): Rank {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (totalScore >= rank.pointsRequired) {
      current = rank;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Get the next rank and how many points are still needed.
 * Returns null if already at max rank.
 */
export function getNextRank(
  totalScore: number,
): { rank: Rank; pointsNeeded: number } | null {
  const current = getRank(totalScore);
  const idx = RANKS.findIndex((r) => r.level === current.level);
  if (idx >= RANKS.length - 1) return null;
  const next = RANKS[idx + 1];
  return { rank: next, pointsNeeded: next.pointsRequired - totalScore };
}

/**
 * Calculate score for a completed mission.
 */
export function calculateMissionScore(
  mission: Mission,
  agentsSafe: number,
  anomaliesDetected: number,
  anomaliesTotal: number,
  smithsAvoided: number,
  timeTaken: number,
  parTime: number,
): number {
  let score = 0;

  if (mission.status === 'completed') {
    score += SCORE_VALUES.missionComplete;
    score += agentsSafe * SCORE_VALUES.agentSurvived;
    score += anomaliesDetected * SCORE_VALUES.anomalyDetected;
    score += smithsAvoided * SCORE_VALUES.smithAvoided;

    if (timeTaken < parTime) {
      score += SCORE_VALUES.underParTimeBonus;
      score += Math.floor((parTime - timeTaken) * SCORE_VALUES.perSecondUnderPar);
    }

    // Bonus for detecting all anomalies
    if (anomaliesTotal > 0 && anomaliesDetected === anomaliesTotal) {
      score += anomaliesTotal * SCORE_VALUES.anomalyAnalyzed;
    }

    // Full extraction bonus
    if (agentsSafe === mission.agents.length) {
      score += SCORE_VALUES.fullExtraction;
    }
  } else {
    score += SCORE_VALUES.missionFailed;
  }

  return Math.max(0, score);
}

// -- Score card generation --------------------------------------------------

export interface SessionStats {
  missionsCompleted: number;
  missionsFailed: number;
  totalScore: number;
  agentsSaved: number;
  agentsLost: number;
  anomaliesDetected: number;
  smithEncounters: number;
  empsFired: number;
  sessionDuration: number; // seconds
}

/**
 * Generate a shareable text score card (Wordle-style).
 */
export function generateScoreCard(stats: SessionStats): string {
  const rank = getRank(stats.totalScore);
  const duration = formatDuration(stats.sessionDuration);

  // Generate a visual bar using filled/empty blocks
  const maxScore = RANKS[RANKS.length - 1].pointsRequired;
  const progress = Math.min(1, stats.totalScore / maxScore);
  const filled = Math.round(progress * 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  const lines = [
    '┌──────────────────────────────────┐',
    '│    MATRIX OPERATOR — DEBRIEF    │',
    '├──────────────────────────────────┤',
    `│  Rank: ${rank.title.padEnd(24)} │`,
    `│  Score: ${String(stats.totalScore).padEnd(23)} │`,
    `│  Progress: [${bar}]       │`,
    `│  Duration: ${duration.padEnd(20)} │`,
    '├──────────────────────────────────┤',
    `│  Missions:  ✓${String(stats.missionsCompleted).padStart(2)} ✗${String(stats.missionsFailed).padStart(2)}              │`,
    `│  Agents:    saved ${String(stats.agentsSaved).padStart(2)} / lost ${String(stats.agentsLost).padStart(2)}   │`,
    `│  Anomalies: ${String(stats.anomaliesDetected).padEnd(19)} │`,
    `│  Smith:     ${String(stats.smithEncounters).padEnd(19)} │`,
    `│  EMPs:      ${String(stats.empsFired).padEnd(19)} │`,
    '└──────────────────────────────────┘',
  ];

  return lines.join('\n');
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}
