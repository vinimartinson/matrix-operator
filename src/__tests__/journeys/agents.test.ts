// ---------------------------------------------------------------------------
// Journey: Agent jack-in / jack-out / chat
// Tests the operator's full agent management flow: starting a mission,
// jacking agents in and out, using aliases, and messaging via comm channel.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import { exec, state, output } from '../helpers';

function startMission() {
  exec('missions');
  exec('accept');
}

describe('Journey: jack-in', () => {
  beforeEach(() => {
    startMission();
  });

  it('jack-in trinity places her in the matrix', () => {
    exec('jack-in trinity');
    expect(state().agents.trinity.status).toBe('in_matrix');
  });

  it('jack-in output confirms agent name without position coordinates', () => {
    const result = exec('jack-in trinity');
    const text = output(result);
    expect(text).toContain('Trinity');
    // No map — position should not appear in the output
    expect(text).not.toMatch(/[Pp]osition.*\(\d+,\s*\d+\)/);
  });

  it('ji alias works identically to jack-in', () => {
    exec('ji trinity');
    expect(state().agents.trinity.status).toBe('in_matrix');
  });

  it('jackin alias works', () => {
    exec('jackin trinity');
    expect(state().agents.trinity.status).toBe('in_matrix');
  });

  it('jack-in multiple agents — each ends up in the matrix', () => {
    exec('jack-in trinity');
    exec('jack-in morpheus');
    expect(state().agents.trinity.status).toBe('in_matrix');
    expect(state().agents.morpheus.status).toBe('in_matrix');
  });

  it('jack-in fails when agent is already in the matrix', () => {
    exec('jack-in trinity');
    const result = exec('jack-in trinity');
    expect(result.className).toBe('error');
    expect(output(result)).toMatch(/cannot jack in|already/i);
  });

  it('jack-in fails for unknown agent name', () => {
    const result = exec('jack-in agent47');
    expect(result.className).toBe('error');
  });

  it('jack-in fails when agent is dead', () => {
    state().updateAgent('trinity', { status: 'ready', health: 0 });
    // Make her status dead so jackIn throws
    state().updateAgent('trinity', { status: 'dead' });
    const result = exec('jack-in trinity');
    expect(result.className).toBe('error');
  });

  it('jack-in fails when agent is too fatigued (≥90%)', () => {
    state().updateAgent('trinity', { fatigue: 90 });
    const result = exec('jack-in trinity');
    expect(result.className).toBe('error');
    expect(output(result)).toMatch(/fatigued|fatigue/i);
  });

  it('jack-in without args returns usage error', () => {
    const result = exec('jack-in');
    expect(result.className).toBe('error');
  });
});

describe('Journey: jack-out', () => {
  beforeEach(() => {
    startMission();
    exec('jack-in trinity');
  });

  it('jack-out extracts trinity from the matrix', () => {
    exec('jack-out trinity');
    expect(state().agents.trinity.status).toBe('resting');
  });

  it('jack-out output announces extraction', () => {
    const result = exec('jack-out trinity');
    expect(output(result)).toMatch(/JACKED OUT|extracted|disconnect/i);
  });

  it('jo alias works identically to jack-out', () => {
    exec('jo trinity');
    expect(state().agents.trinity.status).toBe('resting');
  });

  it('jackout alias works', () => {
    exec('jackout trinity');
    expect(state().agents.trinity.status).toBe('resting');
  });

  it('jack-out fails when agent is not in the matrix', () => {
    exec('jack-out trinity'); // first jack-out — now resting
    const result = exec('jack-out trinity');
    expect(result.className).toBe('error');
    expect(output(result)).toMatch(/not in the Matrix|not in matrix/i);
  });

  it('jack-out leaves mission count unchanged (hardline exit via "exit" command awards score)', () => {
    // jack-out is emergency disconnect — no scoring or mission credit.
    // Hardline exit via the "exit <agent>" command is what increments missionsCompleted.
    const before = state().agents.trinity.missionsCompleted;
    exec('jack-out trinity');
    expect(state().agents.trinity.missionsCompleted).toBe(before);
  });
});

describe('Journey: full jack-in → jack-out cycle', () => {
  beforeEach(() => {
    startMission();
  });

  it('ready → in_matrix → resting lifecycle', () => {
    expect(state().agents.trinity.status).toBe('ready');
    exec('jack-in trinity');
    expect(state().agents.trinity.status).toBe('in_matrix');
    exec('jack-out trinity');
    expect(state().agents.trinity.status).toBe('resting');
  });

  it('after jack-out, agent cannot jack in again without rest (resting status blocks)', () => {
    exec('jack-in trinity');
    exec('jack-out trinity');
    // status is now 'resting' — jackIn requires 'ready'
    const result = exec('jack-in trinity');
    expect(result.className).toBe('error');
  });

  it('EMP fires with agents in the matrix — kills them (EMP does not block)', () => {
    // EMP does not block if agents are jacked in. Instead it fires and kills them.
    exec('jack-in trinity');
    state().updateShip({ empCharge: 100 });

    const result = exec('emp');
    // EMP fires successfully
    expect(output(result)).toMatch(/EMP|DISCHARGE/i);
    // Trinity's status is set to dead by the kill loop.
    // Note: the biometric shock update runs after the kill and restores health to a
    // non-zero value (it uses the pre-fire health snapshot), but status stays 'dead'.
    expect(state().agents.trinity.status).toBe('dead');
  });

  it('EMP fires safely when no agents are in the matrix', () => {
    // trinity starts ready — not jacked in — so EMP is safe
    state().updateShip({ empCharge: 100 });

    const result = exec('emp');
    expect(output(result)).toMatch(/EMP|DISCHARGE/i);
    expect(state().empFired).toBe(true);
    // No agents were harmed
    expect(state().agents.trinity.status).not.toBe('dead');
  });
});

describe('Journey: agent chat', () => {
  beforeEach(() => {
    startMission();
    exec('jack-in trinity');
  });

  it('crew command shows trinity with in_matrix icon (◉)', () => {
    const result = exec('crew');
    expect(output(result)).toContain('Trinity');
    // in_matrix status renders as ◉ (filled circle) in the crew display
    expect(output(result)).toContain('◉');
  });

  it('crew command shows HP and fatigue bars', () => {
    const result = exec('crew');
    const text = output(result);
    // Crew display renders: HP[████████] FT[████████]
    expect(text).toContain('HP[');
    expect(text).toContain('FT[');
  });
});
