// ---------------------------------------------------------------------------
// Matrix Operator – Mission Orchestrator API Route
// Uses claude-sonnet-4-6 to drive narrative beat progression for Mission 1.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getMissionOrchestratorPrompt } from '@/ai/prompts';
import type { NarrativeBeat } from '@/engine/types';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 300;
const TEMPERATURE = 0.8;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      beat,
      operatorInput,
      narrativeContext,
      hackableStates,
      trinityStatus,
      isAmbient,
    } = body as {
      beat: NarrativeBeat;
      operatorInput: string;
      narrativeContext: string[];
      hackableStates: Record<string, string>;
      trinityStatus: string;
      isAmbient: boolean;
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 },
      );
    }

    const client = new Anthropic({ apiKey });
    const { system, user } = getMissionOrchestratorPrompt(
      beat,
      operatorInput ?? '',
      narrativeContext ?? [],
      hackableStates ?? {},
      trinityStatus ?? 'status unknown',
      isAmbient ?? false,
    );

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock && 'text' in textBlock ? textBlock.text : '';

    // Parse <orchestrator> JSON block
    const match = raw.match(/<orchestrator>([\s\S]*?)<\/orchestrator>/);
    if (!match) {
      // Fallback: return empty safe response
      return NextResponse.json({
        narrativeLine: 'Broadcast array nominal.',
        trinityMessage: null,
        beatAdvance: null,
        signalSpike: false,
        dejaVu: false,
        injectAnomaly: false,
      });
    }

    try {
      const parsed = JSON.parse(match[1]);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({
        narrativeLine: raw.replace(/<[^>]+>/g, '').trim().slice(0, 120),
        trinityMessage: null,
        beatAdvance: null,
        signalSpike: false,
        dejaVu: false,
        injectAnomaly: false,
      });
    }
  } catch (err) {
    console.error('Orchestrator API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
