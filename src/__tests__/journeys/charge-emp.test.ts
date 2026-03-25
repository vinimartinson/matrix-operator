// ---------------------------------------------------------------------------
// Journey: Charge → EMP discharge
// Tests the full operator flow: charge the EMP, verify biometric cost to
// Trinity, then fire and check sentinel/Trinity state changes.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec, state, output } from '../helpers';

// Charge completes in 10 steps × 220 ms = 2 200 ms total
const CHARGE_DURATION_MS = 10 * 220;

describe('Journey: EMP charge sequence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('charge initiates — Trinity immediately loses 10 HP and gains 20% stress', () => {
    const hpBefore     = state().agents.trinity.health;   // 100
    const stressBefore = state().agents.trinity.fatigue;  // 30

    exec('charge');

    expect(state().agents.trinity.health).toBe(hpBefore - 10);
    expect(state().agents.trinity.fatigue).toBe(stressBefore + 20);
  });

  it('charge completes — EMP reaches 100% after the full sequence', () => {
    exec('charge');
    vi.advanceTimersByTime(CHARGE_DURATION_MS + 50);

    expect(state().ship.empCharge).toBe(100);
    expect(state().ship.empCharging).toBe(false);
  });

  it('charge re-enables input when sequence finishes', () => {
    exec('charge');
    // Input is disabled during the charge sequence
    expect(state().inputEnabled).toBe(false);

    vi.advanceTimersByTime(CHARGE_DURATION_MS + 50);

    expect(state().inputEnabled).toBe(true);
  });

  it('charge blocked when already at 100%', () => {
    // Manually set charge to full
    state().updateShip({ empCharge: 100 });
    vi.useRealTimers();

    const result = exec('charge');
    expect(result.output.join(' ')).toMatch(/already|100/i);
  });

  it('charge blocked when already charging', () => {
    exec('charge');
    const result = exec('charge');
    expect(result.output.join(' ')).toMatch(/already|progress/i);
  });

  it('charge blocked when Trinity is dead', () => {
    state().updateAgent('trinity', { health: 0 });
    vi.useRealTimers();

    const result = exec('charge');
    expect(result.className).toBe('error');
    expect(result.output.join(' ')).toMatch(/Trinity|non-operational/i);
  });
});

describe('Journey: EMP discharge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function chargeToFull() {
    exec('charge');
    vi.advanceTimersByTime(CHARGE_DURATION_MS + 50);
  }

  it('emp fires after full charge — output confirms discharge', () => {
    chargeToFull();
    vi.useRealTimers();

    const result = exec('emp');
    expect(result.output.join('\n')).toMatch(/EMP|DISCHARGE/i);
  });

  it('emp resets charge to 0 after firing', () => {
    chargeToFull();
    vi.useRealTimers();

    exec('emp');
    expect(state().ship.empCharge).toBe(0);
  });

  it('emp costs Trinity 8 HP on discharge', () => {
    chargeToFull();
    vi.useRealTimers();

    const hpBeforeEmp = state().agents.trinity.health;
    exec('emp');
    expect(state().agents.trinity.health).toBe(Math.max(1, hpBeforeEmp - 8));
  });

  it('emp sets empFired flag — triggers sonar pulse animation', () => {
    chargeToFull();
    vi.useRealTimers();

    exec('emp');
    expect(state().empFired).toBe(true);
  });

  it('emp records an emp_fired event', () => {
    chargeToFull();
    vi.useRealTimers();

    exec('emp');
    const empEvent = state().events.find((e) => e.type === 'emp_fired');
    expect(empEvent).toBeDefined();
    expect(empEvent?.priority).toBe('critical');
  });

  it('emp not ready when not charged — warns to charge first', () => {
    vi.useRealTimers();
    const result = exec('emp');
    // Not charged → returns warning (not error)
    expect(result.className).toBe('warning');
    expect(result.output.join(' ')).toMatch(/charge/i);
  });

  it('full journey: charge → emp → sentinel distance increases', () => {
    const distBefore = state().ship.sentinelDistance; // 800m at start

    chargeToFull();
    vi.useRealTimers();
    exec('emp');

    // EMP pushes surviving sentinels back (+220m per kill), distance should be ≥ original
    expect(state().ship.sentinelDistance).toBeGreaterThanOrEqual(distBefore);
  });

  it('emp fires with agents in matrix — kills jacked-in agents', () => {
    // EMP does not block — it fires and kills any agents still in the matrix.
    vi.useRealTimers();
    exec('missions');
    exec('accept');
    exec('jack-in trinity');
    expect(state().agents.trinity.status).toBe('in_matrix');

    vi.useFakeTimers();
    chargeToFull();
    vi.useRealTimers();

    const result = exec('emp');
    expect(output(result)).toMatch(/EMP|DISCHARGE/i);
    // Kill loop sets status to 'dead'. The biometric shock update runs after and
    // restores health to a non-zero value (pre-fire snapshot), but status stays 'dead'.
    expect(state().agents.trinity.status).toBe('dead');
  });
});

describe('Journey: cumulative biometric cost (charge + emp)', () => {
  it('charge then emp reduces Trinity HP by at least 18 from baseline', () => {
    const baseline = state().agents.trinity.health; // 100

    vi.useFakeTimers();
    exec('charge');
    vi.advanceTimersByTime(CHARGE_DURATION_MS + 50);
    vi.useRealTimers();

    exec('emp');

    // charge costs 10 HP, emp costs 8 HP → total ≥ 18
    const finalHp = state().agents.trinity.health;
    expect(baseline - finalHp).toBeGreaterThanOrEqual(18);
  });

  it('charge then emp raises Trinity stress by at least 20 from baseline', () => {
    const baseline = state().agents.trinity.fatigue; // 30

    vi.useFakeTimers();
    exec('charge');
    vi.advanceTimersByTime(CHARGE_DURATION_MS + 50);
    vi.useRealTimers();

    exec('emp');

    // charge adds +20 stress, emp adds +15 → total ≥ 35
    const finalStress = state().agents.trinity.fatigue;
    expect(finalStress - baseline).toBeGreaterThanOrEqual(35);
  });
});
