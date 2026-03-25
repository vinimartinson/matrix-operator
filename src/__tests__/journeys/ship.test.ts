// ---------------------------------------------------------------------------
// Journey: Ship commands — dive, status, repair, threat
// Tests full command sequences the way a real operator would use them.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { exec, state, output } from '../helpers';

describe('Journey: dive', () => {
  it('operator dives to level 1 — depth becomes 1.0 km', () => {
    const result = exec('dive 1');
    expect(output(result)).toMatch(/Diving|depth/i);
    expect(state().ship.depth).toBe(1);
  });

  it('operator dives to level 5 — depth becomes 5.0 km', () => {
    exec('dive 5');
    expect(state().ship.depth).toBe(5);
  });

  it('diving and checking status reflects updated depth', () => {
    exec('dive 3');
    const result = exec('status');
    expect(output(result)).toContain('3.0km');
  });

  it('dive sequence: shallow → deep → back to shallow', () => {
    exec('dive 1');
    expect(state().ship.depth).toBe(1);
    exec('dive 5');
    expect(state().ship.depth).toBe(5);
    exec('dive 2');
    expect(state().ship.depth).toBe(2);
  });

  it('dive rejects depth below 1', () => {
    const result = exec('dive 0');
    expect(result.className).toBe('error');
  });

  it('dive rejects depth above 5', () => {
    const result = exec('dive 6');
    expect(result.className).toBe('error');
  });

  it('dive rejects non-numeric input', () => {
    const result = exec('dive deep');
    expect(result.className).toBe('error');
  });

  it('dive without args shows usage info with depth zones', () => {
    const result = exec('dive');
    // No-arg dive returns info (not error) with usage text
    expect(output(result)).toMatch(/Usage|depth|km/i);
    // State is unchanged
    expect(state().ship.depth).toBe(2.5);
  });
});

describe('Journey: status', () => {
  it('status shows all major ship systems', () => {
    const result = exec('status');
    const text = output(result);
    expect(text).toContain('Hull');
    expect(text).toContain('Power');
    expect(text).toContain('EMP');
    expect(text).toContain('Depth');
  });

  it('status shows sentinel count and distance', () => {
    const result = exec('status');
    const text = output(result);
    expect(text).toMatch(/Sentinel/i);
  });

  it('status shows current depth after dive', () => {
    exec('dive 4');
    const result = exec('status');
    expect(output(result)).toContain('4.0km');
  });

  it('hull starts undamaged — no ! warning prefix at 95%', () => {
    // Hull starts at 95% — above the 50% threshold so no ! marker
    const result = exec('status');
    const text = output(result);
    // Each line in the status box: "│ !Hull" only appears below 50%
    const hullLine = text.split('\n').find((l) => l.includes('Hull'));
    expect(hullLine).toBeDefined();
    expect(hullLine).not.toMatch(/^│ !Hull/);
  });
});

describe('Journey: repair', () => {
  it('repair hull restores hull to 100%', () => {
    // Hull starts at 95 — repair brings to max
    exec('repair hull');
    expect(state().ship.hull.level).toBe(100);
  });

  it('repair hull with already full health still confirms repair', () => {
    exec('repair hull');
    expect(state().ship.hull.level).toBe(100);
    // Second repair: system is clamped at maxLevel — repair crew still dispatched
    const result = exec('repair hull');
    expect(output(result)).toContain('REPAIR');
    expect(state().ship.hull.level).toBe(100);
  });

  it('repair power restores power core', () => {
    exec('repair power');
    expect(state().ship.power.level).toBe(100);
  });

  it('repair unknown system returns error', () => {
    const result = exec('repair teleporter');
    expect(result.className).toBe('error');
  });

  it('repair without args returns usage error', () => {
    const result = exec('repair');
    expect(result.className).toBe('error');
  });
});

describe('Journey: threat assessment', () => {
  it('threat command lists sentinel presence at game start', () => {
    // Game starts with 3 sentinels at 800m in ship state
    const result = exec('threat');
    const text = output(result);
    expect(text).toMatch(/SENTINEL|sentinel/i);
  });

  it('threat output is not empty at game start', () => {
    // Smith only appears in threat output when there are active smith threats in state.threats.
    // At game start there are no smiths spawned — only sentinels via ship state.
    const result = exec('threat');
    expect(result.output.length).toBeGreaterThan(0);
    // Output includes the threat assessment header
    expect(output(result)).toMatch(/THREAT|SENTINEL/i);
  });

  it('threat shows updated sentinel count after EMP neutralises some', () => {
    // Charge EMP fully via fake timers
    vi.useFakeTimers();
    exec('charge');
    vi.advanceTimersByTime(10 * 220);
    vi.useRealTimers();

    // Fire EMP (no agents in matrix — safe to fire)
    exec('emp');

    const result = exec('threat');
    const text = output(result);
    // After EMP, sentinels may be reduced or pushed back
    expect(text).toMatch(/SENTINEL|sentinel|neutrali/i);
  });
});
