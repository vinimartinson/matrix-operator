import { commandRegistry } from '@/engine/command-registry';
import { useGameStore } from '@/engine/game-state';
import type { CommandResult } from '@/engine/types';

/** Execute a command against the live store and return the result. */
export function exec(command: string): CommandResult {
  return commandRegistry.execute(command, useGameStore.getState());
}

/** Read the current store state. */
export function state() {
  return useGameStore.getState();
}

/** Flatten all output lines from a CommandResult into a single string. */
export function output(result: CommandResult): string {
  return result.output.join('\n');
}
