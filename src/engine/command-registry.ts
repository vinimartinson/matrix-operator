// ---------------------------------------------------------------------------
// Matrix Operator – Command Registry
// ---------------------------------------------------------------------------

import type {
  CommandCategory,
  CommandDefinition,
  CommandResult,
  GameStateSlice,
} from './types';

interface RegisteredCommand extends CommandDefinition {
  name: string;
}

export class CommandRegistry {
  private commands: Map<string, RegisteredCommand> = new Map();
  private aliasMap: Map<string, string> = new Map();

  /**
   * Register a new command.
   */
  register(
    name: string,
    definition: CommandDefinition,
  ): void {
    const lower = name.toLowerCase();
    const cmd: RegisteredCommand = { ...definition, name: lower };
    this.commands.set(lower, cmd);

    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.aliasMap.set(alias.toLowerCase(), lower);
      }
    }
  }

  /**
   * Resolve an input token to the canonical command name.
   */
  private resolve(token: string): string | undefined {
    const lower = token.toLowerCase();
    if (this.commands.has(lower)) return lower;
    return this.aliasMap.get(lower);
  }

  /**
   * Parse raw input and execute the matching command handler.
   */
  execute(input: string, gameState: GameStateSlice): CommandResult {
    const trimmed = input.trim();
    if (!trimmed) {
      return { output: [] };
    }

    const parts = trimmed.split(/\s+/);
    const token = parts[0];
    const args = parts.slice(1);

    const resolved = this.resolve(token);
    if (!resolved) {
      return {
        output: [
          `Unknown command: ${token}`,
          'Type "help" for available commands.',
        ],
        className: 'error',
      };
    }

    const cmd = this.commands.get(resolved)!;

    try {
      return cmd.handler(args, gameState);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      return {
        output: [`Error executing ${resolved}: ${message}`],
        className: 'error',
      };
    }
  }

  /**
   * Return a formatted help listing grouped by category.
   */
  getHelp(): CommandResult {
    const categories: Record<CommandCategory, RegisteredCommand[]> = {
      navigation: [],
      tactical: [],
      ship: [],
      meta: [],
    };

    const seen = new Set<string>();
    for (const cmd of this.commands.values()) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);
      if (cmd.hidden) continue;
      categories[cmd.category].push(cmd);
    }

    const categoryLabels: Record<CommandCategory, string> = {
      navigation: 'NAVIGATION',
      tactical: 'TACTICAL',
      ship: 'SHIP SYSTEMS',
      meta: 'META',
    };

    const lines: string[] = [
      '╔══════════════════════════════════════════╗',
      '║        MATRIX OPERATOR — COMMANDS        ║',
      '╚══════════════════════════════════════════╝',
      '',
    ];

    for (const cat of ['navigation', 'tactical', 'ship', 'meta'] as CommandCategory[]) {
      const cmds = categories[cat];
      if (cmds.length === 0) continue;

      lines.push(`  [ ${categoryLabels[cat]} ]`);
      for (const cmd of cmds) {
        const aliases =
          cmd.aliases && cmd.aliases.length > 0
            ? ` (${cmd.aliases.join(', ')})`
            : '';
        lines.push(`    ${cmd.usage.padEnd(28)} ${cmd.description}${aliases}`);
      }
      lines.push('');
    }

    return { output: lines, className: 'success' };
  }

  /**
   * Return tab-completion candidates for a partial input string.
   */
  getCompletions(partial: string): string[] {
    const lower = partial.toLowerCase();
    const matches: string[] = [];

    for (const [name, cmd] of this.commands.entries()) {
      if (!cmd.hidden && name.startsWith(lower)) {
        matches.push(name);
      }
    }

    for (const [alias, canonical] of this.aliasMap.entries()) {
      const cmd = this.commands.get(canonical);
      if (!cmd?.hidden && alias.startsWith(lower) && !matches.includes(canonical)) {
        matches.push(alias);
      }
    }

    return matches.sort();
  }

  /**
   * Check if a command exists.
   */
  has(name: string): boolean {
    return this.resolve(name) !== undefined;
  }

  /**
   * Get a single command definition by name or alias.
   */
  get(name: string): RegisteredCommand | undefined {
    const resolved = this.resolve(name);
    return resolved ? this.commands.get(resolved) : undefined;
  }

  /**
   * Return all registered command names (no aliases).
   */
  getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }
}

/** Singleton command registry instance */
export const commandRegistry = new CommandRegistry();
