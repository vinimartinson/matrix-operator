// ---------------------------------------------------------------------------
// Matrix Operator – Command Input Processing
// ---------------------------------------------------------------------------

import type { AgentName } from '@/engine/types';

// ---------------------------------------------------------------------------
// Agent aliases
// ---------------------------------------------------------------------------

export const AGENT_ALIASES: Record<string, AgentName> = {
  n: 'neo',
  neo: 'neo',
  t: 'trinity',
  trinity: 'trinity',
  trin: 'trinity',
  m: 'morpheus',
  morpheus: 'morpheus',
  morph: 'morpheus',
  b: 'niobe',
  niobe: 'niobe',
  g: 'ghost',
  ghost: 'ghost',
};

const VALID_AGENTS: Set<AgentName> = new Set([
  'neo',
  'trinity',
  'morpheus',
  'niobe',
  'ghost',
]);

// ---------------------------------------------------------------------------
// parseCommand — split raw input into command + args
// ---------------------------------------------------------------------------

export interface ParsedCommand {
  command: string;
  args: string[];
}

/**
 * Parse a raw command string into a command token and argument array.
 * Supports quoted strings as single arguments (both single and double quotes).
 *
 * Examples:
 *   'move neo 3 4'       -> { command: 'move', args: ['neo', '3', '4'] }
 *   'comms neo "go now"' -> { command: 'comms', args: ['neo', 'go now'] }
 *   ''                   -> { command: '', args: [] }
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return { command: '', args: [] };
  }

  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (inQuote) {
      if (ch === inQuote) {
        // End quote — push accumulated token
        tokens.push(current);
        current = '';
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      // Start quote — push any accumulated non-quoted text first
      if (current) {
        tokens.push(current);
        current = '';
      }
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }

  // Push any remaining token
  if (current) {
    tokens.push(current);
  }

  const command = (tokens[0] ?? '').toLowerCase();
  const args = tokens.slice(1);

  return { command, args };
}

// ---------------------------------------------------------------------------
// validateAgentName — resolve name or alias to canonical AgentName
// ---------------------------------------------------------------------------

/**
 * Validate and resolve an agent name or alias to the canonical AgentName.
 * Returns the canonical name if valid, or null if not recognized.
 */
export function validateAgentName(name: string): AgentName | null {
  const lower = name.toLowerCase().trim();
  const resolved = AGENT_ALIASES[lower];
  if (resolved && VALID_AGENTS.has(resolved)) {
    return resolved;
  }
  return null;
}
