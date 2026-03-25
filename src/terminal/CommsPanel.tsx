'use client';

import type { Mission } from '@/engine/types';

// ---------------------------------------------------------------------------
// Formatted message return type
// ---------------------------------------------------------------------------

export interface FormattedMessage {
  text: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Agent display colors
// ---------------------------------------------------------------------------

const AGENT_COLORS: Record<string, string> = {
  neo: 'var(--green)',
  trinity: 'var(--cyan)',
  morpheus: 'var(--yellow)',
  niobe: 'var(--orange)',
  ghost: '#aaa',
  oracle: 'var(--cyan)',
};

function colorSpan(text: string, color: string): string {
  return `<span style="color:${color}">${text}</span>`;
}

// ---------------------------------------------------------------------------
// formatCommsMessage — agent communication
// ---------------------------------------------------------------------------

export function formatCommsMessage(
  agentName: string,
  message: string,
): FormattedMessage {
  const color = AGENT_COLORS[agentName.toLowerCase()] ?? 'var(--green)';
  const displayName =
    agentName.charAt(0).toUpperCase() + agentName.slice(1).toLowerCase();

  return {
    text:
      colorSpan('[COMMS]', 'var(--green-dim)') +
      ' ' +
      colorSpan(displayName, color) +
      ': ' +
      colorSpan(`"${message}"`, color),
    className: 'system',
  };
}

// ---------------------------------------------------------------------------
// formatSystemMessage — system notifications
// ---------------------------------------------------------------------------

export function formatSystemMessage(message: string): FormattedMessage {
  return {
    text: colorSpan('[SYSTEM]', 'var(--cyan)') + ' ' + colorSpan(message, 'var(--cyan)'),
    className: 'cyan',
  };
}

// ---------------------------------------------------------------------------
// formatAlertMessage — warnings and alerts
// ---------------------------------------------------------------------------

export function formatAlertMessage(message: string): FormattedMessage {
  return {
    text:
      colorSpan('[⚠ ALERT]', 'var(--red)') +
      ' ' +
      colorSpan(message, 'var(--red)'),
    className: 'critical',
  };
}

// ---------------------------------------------------------------------------
// formatSmithMessage — intercepted Smith communications
// ---------------------------------------------------------------------------

export function formatSmithMessage(message: string): FormattedMessage {
  return {
    text:
      `<span style="color:var(--red);text-shadow:0 0 8px var(--red),0 0 16px rgba(255,51,51,0.3)">[INTERCEPTED] Smith: "${message}"</span>`,
    className: 'smith',
  };
}

// ---------------------------------------------------------------------------
// formatMissionBriefing — multi-line mission brief with box drawing
// ---------------------------------------------------------------------------

export function formatMissionBriefing(mission: Mission): FormattedMessage {
  const g = 'var(--green)';
  const gd = 'var(--green-dim)';
  const c = 'var(--cyan)';
  const y = 'var(--yellow)';

  const maxLen = Math.max(
    mission.title.length + 10,
    mission.description.length,
    ...mission.objectives.map((o) => o.length + 6),
    40,
  );
  const w = Math.min(maxLen + 4, 60);

  const pad = (s: string, len: number) => s + ' '.repeat(Math.max(0, len - s.length));

  const lines: string[] = [];

  lines.push(colorSpan('╔' + '═'.repeat(w) + '╗', gd));
  lines.push(
    colorSpan('║', gd) +
      colorSpan(pad(` MISSION BRIEFING: ${mission.title}`, w), g) +
      colorSpan('║', gd),
  );
  lines.push(colorSpan('╠' + '═'.repeat(w) + '╣', gd));

  // Type and time limit
  lines.push(
    colorSpan('║', gd) +
      colorSpan(pad(` Type: ${mission.type.toUpperCase().replace('_', ' ')}`, w), c) +
      colorSpan('║', gd),
  );

  const mins = Math.floor(mission.timeLimit / 60);
  const secs = mission.timeLimit % 60;
  const timeStr = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  lines.push(
    colorSpan('║', gd) +
      colorSpan(pad(` Time Limit: ${timeStr}`, w), y) +
      colorSpan('║', gd),
  );

  lines.push(colorSpan('╠' + '═'.repeat(w) + '╣', gd));

  // Description (word-wrapped)
  const descWords = mission.description.split(' ');
  let descLine = ' ';
  for (const word of descWords) {
    if (descLine.length + word.length + 1 > w - 1) {
      lines.push(
        colorSpan('║', gd) +
          colorSpan(pad(descLine, w), g) +
          colorSpan('║', gd),
      );
      descLine = ' ';
    }
    descLine += word + ' ';
  }
  if (descLine.trim()) {
    lines.push(
      colorSpan('║', gd) +
        colorSpan(pad(descLine, w), g) +
        colorSpan('║', gd),
    );
  }

  lines.push(colorSpan('╠' + '═'.repeat(w) + '╣', gd));

  // Objectives
  lines.push(
    colorSpan('║', gd) +
      colorSpan(pad(' OBJECTIVES:', w), y) +
      colorSpan('║', gd),
  );

  for (const obj of mission.objectives) {
    lines.push(
      colorSpan('║', gd) +
        colorSpan(pad(`   ▸ ${obj}`, w), g) +
        colorSpan('║', gd),
    );
  }

  // Assigned agents
  if (mission.agents.length > 0) {
    lines.push(colorSpan('╠' + '═'.repeat(w) + '╣', gd));
    const agentStr = mission.agents
      .map((a) => a.charAt(0).toUpperCase() + a.slice(1))
      .join(', ');
    lines.push(
      colorSpan('║', gd) +
        colorSpan(pad(` Agents: ${agentStr}`, w), c) +
        colorSpan('║', gd),
    );
  }

  lines.push(colorSpan('╚' + '═'.repeat(w) + '╝', gd));

  return {
    text: lines.join('\n'),
    className: 'system',
  };
}
