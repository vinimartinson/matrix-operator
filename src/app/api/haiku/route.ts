// ---------------------------------------------------------------------------
// Matrix Operator – Claude Haiku API Proxy Route
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { AgentSkill, AnomalyType, MissionType } from '@/engine/types';
import {
  getMissionBriefingPrompt,
  getAgentDialoguePrompt,
  getAnomalyAnalysisPrompt,
  getSmithTransmissionPrompt,
  getOracleMessagePrompt,
  getHackingPuzzlePrompt,
  getOperatorCommandPrompt,
  getSkillDownloadPrompt,
  getMissionNarrativePrompt,
  getAgentAutonomousTickPrompt,
  getSmithAutonomousTickPrompt,
} from '@/ai/prompts';

const MODEL = 'claude-haiku-4-5-20251001';

// Max tokens per prompt type
const MAX_TOKENS: Record<string, number> = {
  missionBriefing: 200,
  agentDialogue: 150,
  anomalyAnalysis: 200,
  smithTransmission: 100,
  oracleMessage: 150,
  hackingPuzzle: 200,
  operatorCommand: 200,
  skillDownload: 150,
  missionNarrative: 120,
  agentAutonomousTick: 150,
  smithAutonomousTick: 80,
};

// Temperature per prompt type
const TEMPERATURE: Record<string, number> = {
  missionBriefing: 0.7,
  agentDialogue: 0.8,
  anomalyAnalysis: 0.3,
  smithTransmission: 0.8,
  oracleMessage: 0.9,
  hackingPuzzle: 0.4,
  operatorCommand: 0.8,
  skillDownload: 0.9,
  missionNarrative: 0.7,
  agentAutonomousTick: 0.6,
  smithAutonomousTick: 0.4,
};

type PromptBuilder = (ctx: Record<string, unknown>) => { system: string; user: string };

const PROMPT_BUILDERS: Record<string, PromptBuilder> = {
  missionBriefing: (ctx) =>
    getMissionBriefingPrompt(
      ctx.missionType as MissionType,
      (ctx.difficulty as number) ?? 1,
      (ctx.agents as string[]) ?? [],
      (ctx.campaignContext as string) ?? '',
    ),
  agentDialogue: (ctx) =>
    getAgentDialoguePrompt(
      (ctx.agentName as string) ?? 'neo',
      (ctx.situation as string) ?? '',
      (ctx.playerCommand as string) ?? '',
      (ctx.agentStatus as string) ?? 'in_matrix',
    ),
  anomalyAnalysis: (ctx) =>
    getAnomalyAnalysisPrompt(
      ctx.anomalyType as AnomalyType,
      (ctx.coordinates as string) ?? 'unknown',
      (ctx.missionPhase as string) ?? 'active',
      (ctx.activeThreats as number) ?? 0,
    ),
  smithTransmission: (ctx) =>
    getSmithTransmissionPrompt(
      (ctx.situation as string) ?? '',
      (ctx.playerActions as string[]) ?? [],
    ),
  oracleMessage: (ctx) =>
    getOracleMessagePrompt(
      (ctx.dayNumber as number) ?? 1,
      (ctx.recentEvents as string[]) ?? [],
    ),
  hackingPuzzle: (ctx) =>
    getHackingPuzzlePrompt(
      (ctx.difficulty as number) ?? 1,
      (ctx.puzzleType as string) ?? 'pattern',
    ),
  operatorCommand: (ctx) =>
    getOperatorCommandPrompt(
      (ctx.agentName as string) ?? 'neo',
      (ctx.message as string) ?? '',
      (ctx.missionContext as string) ?? '',
      (ctx.nearbyThreats as string[]) ?? [],
      (ctx.agentSkills as AgentSkill[]) ?? [],
      (ctx.agentHealth as number) ?? 100,
      (ctx.agentFatigue as number) ?? 0,
      (ctx.mapContext as string) ?? '',
    ),
  skillDownload: (ctx) =>
    getSkillDownloadPrompt(
      (ctx.agentName as string) ?? 'neo',
      (ctx.skill as AgentSkill) ?? 'hacking',
      (ctx.currentSkills as AgentSkill[]) ?? [],
    ),
  missionNarrative: (ctx) =>
    getMissionNarrativePrompt(
      (ctx.missionType as string) ?? 'extraction',
      (ctx.elapsedTime as number) ?? 0,
      (ctx.timeRemaining as number) ?? 60,
      (ctx.smithProximity as 'none' | 'distant' | 'near' | 'contact') ?? 'none',
      (ctx.agentsInMatrix as string[]) ?? [],
      (ctx.recentEvents as string[]) ?? [],
      (ctx.hackableStatuses as string[]) ?? [],
    ),
  agentAutonomousTick: (ctx) =>
    getAgentAutonomousTickPrompt(
      (ctx.agentName as string) ?? 'Neo',
      (ctx.agentNameLower as string) ?? 'neo',
      (ctx.position as string) ?? '(0,0)',
      (ctx.guidance as string) ?? '',
      (ctx.missionTitle as string) ?? '',
      (ctx.missionObjectives as string[]) ?? [],
      (ctx.visibleThreats as string[]) ?? [],
      (ctx.visibleHackables as string[]) ?? [],
      (ctx.adjacentWalls as { north: boolean; south: boolean; east: boolean; west: boolean }) ?? { north: false, south: false, east: false, west: false },
      (ctx.nearbyPhones as string[]) ?? [],
      (ctx.currentPath as string[]) ?? [],
      (ctx.mapWidth as number) ?? 20,
      (ctx.mapHeight as number) ?? 10,
      ctx.adjacentTiles as { north: string; south: string; east: string; west: string } | undefined,
      (ctx.phonePositions as string[]) ?? [],
      (ctx.exitPositions as string[]) ?? [],
    ),
  smithAutonomousTick: (ctx) =>
    getSmithAutonomousTickPrompt(
      (ctx.position as string) ?? '(0,0)',
      (ctx.level as number) ?? 1,
      (ctx.knownAlerts as string[]) ?? [],
      (ctx.knownFailedHacks as string[]) ?? [],
      (ctx.nearbyAgents as string[]) ?? [],
      (ctx.lureSignals as string[]) ?? [],
      (ctx.mapWidth as number) ?? 20,
      (ctx.mapHeight as number) ?? 10,
    ),
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { promptType, context } = body as {
      promptType: string;
      context: Record<string, unknown>;
    };

    const builder = PROMPT_BUILDERS[promptType];
    if (!builder) {
      return NextResponse.json(
        { error: `Unknown prompt type: ${promptType}` },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 },
      );
    }

    const client = new Anthropic({ apiKey });
    const { system, user } = builder(context);

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS[promptType] ?? 150,
      temperature: TEMPERATURE[promptType] ?? 0.7,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';

    return NextResponse.json({ text });
  } catch (err) {
    console.error('Haiku API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
