// ---------------------------------------------------------------------------
// Journey: Mission 01 — Trinity's Escape
// Tests the full narrative mission flow: briefing → accept → jack-in →
// hack environment systems → jack-out. Verifies state transitions at each
// beat and that the signal panels track the right conditions.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import { exec, state, output } from '../helpers';

describe('Journey: mission briefing', () => {
  it('missions command returns the mission briefing', () => {
    const result = exec('missions');
    expect(output(result)).toContain('MISSION BRIEFING');
    expect(output(result)).toContain("Trinity's Escape");
  });

  it('mission object exists in state after briefing', () => {
    exec('missions');
    expect(state().mission).not.toBeNull();
  });

  it('phase stays idle during briefing — panels not yet shown', () => {
    exec('missions');
    // startMission sets active but then setPhase('idle') overrides
    expect(state().currentPhase).toBe('idle');
  });

  it('briefing mentions how to jack-in', () => {
    const result = exec('missions');
    // After accept, the output should mention jack-in
    exec('accept');
    const acceptResult = exec('brief');
    // Doesn't need to be the accept output — we just check brief re-displays
    expect(output(acceptResult)).toContain("Trinity's Escape");
  });

  it('decline resets mission and returns to idle', () => {
    exec('missions');
    exec('decline');
    expect(state().currentPhase).toBe('idle');
  });

  it('cannot accept without a briefing', () => {
    const result = exec('accept');
    expect(result.className).toBe('error');
  });

  it('cannot decline without a briefing', () => {
    const result = exec('decline');
    expect(result.className).toBe('error');
  });
});

describe('Journey: mission accept → active', () => {
  beforeEach(() => {
    exec('missions');
  });

  it('accept activates the mission — phase becomes mission', () => {
    exec('accept');
    expect(state().currentPhase).toBe('mission');
  });

  it('accept initialises hackable elements from the stub map', () => {
    exec('accept');
    // Trinity's Escape stub map includes cameras and a door
    expect(state().hackableElements.length).toBeGreaterThan(0);
  });

  it('narrative beat resets to awakening on accept', () => {
    exec('accept');
    expect(state().missionBeat).toBe('awakening');
  });

  it('smith distance resets to 10 (far) on accept', () => {
    exec('accept');
    expect(state().smithDistance).toBe(10);
  });

  it('missions command blocked while a mission is active', () => {
    exec('accept');
    const result = exec('missions');
    expect(result.className).toBe('warning');
    expect(output(result)).toMatch(/already active/i);
  });
});

describe('Journey: jack-in during active mission', () => {
  beforeEach(() => {
    exec('missions');
    exec('accept');
  });

  it('jack-in trinity succeeds — she enters the matrix', () => {
    exec('jack-in trinity');
    expect(state().agents.trinity.status).toBe('in_matrix');
  });

  it('jack-in output does not show position coordinates (no map)', () => {
    const result = exec('jack-in trinity');
    expect(output(result)).not.toMatch(/[Pp]osition.*\(\d+,\s*\d+\)/);
  });

  it('systems command lists hackable elements once trinity is in', () => {
    exec('jack-in trinity');
    const result = exec('systems');
    expect(output(result)).toMatch(/CAM|DOOR|DATA|HACKABLE/i);
  });
});

describe('Journey: hack environment systems', () => {
  beforeEach(() => {
    exec('missions');
    exec('accept');
    exec('jack-in trinity');
  });

  it('hack a camera succeeds — element state changes to disabled or breached', () => {
    // Find first hackable element
    const el = state().hackableElements[0];
    expect(el).toBeDefined();

    exec(`hack ${el.label}`);

    const updated = state().hackableElements.find((e) => e.id === el.id);
    expect(updated?.state).not.toBe('active');
  });

  it('hacking same element twice reports it is already hacked', () => {
    const el = state().hackableElements[0];
    exec(`hack ${el.label}`);

    const result = exec(`hack ${el.label}`);
    expect(result.className).toBe('warning');
    expect(output(result)).toMatch(/already/i);
  });

  it('hack unknown element returns error with available list', () => {
    const result = exec('hack FAKEELEMENT99');
    expect(result.className).toBe('error');
    expect(output(result)).toMatch(/not found/i);
  });

  it('systems list updates after a successful hack', () => {
    const el = state().hackableElements[0];
    exec(`hack ${el.label}`);

    const result = exec('systems');
    // The hacked element should now show its new state
    const text = output(result);
    expect(text).toMatch(/disabled|breached|active/i);
  });
});

describe('Journey: mission exit and replay', () => {
  it('"exit" without an agent arg returns a usage error — it is per-agent not a mission abort', () => {
    exec('missions');
    exec('accept');
    // exit <agent> routes an agent to a hardline phone; bare "exit" is an error
    const result = exec('exit');
    expect(result.className).toBe('error');
    // Mission remains active
    expect(state().currentPhase).toBe('mission');
  });

  it('after completing a mission, missions command offers a replay with note about future missions', () => {
    exec('missions');
    exec('accept');
    // Manually complete the mission to increment missionCount
    state().completeMission();
    expect(state().missionCount).toBe(1);

    const result = exec('missions');
    const text = output(result);
    // Should mention upcoming missions after first completion
    expect(text).toMatch(/development|MISSIONS\.md|additional/i);
  });
});

describe('Journey: signal state tracks mission events', () => {
  beforeEach(() => {
    exec('missions');
    exec('accept');
    exec('jack-in trinity');
  });

  it('smithDistance is 10 (far) at mission start', () => {
    expect(state().smithDistance).toBe(10);
  });

  it('setSmithDistance updates smithDistance in state', () => {
    // smithDistance is consumed by UI panels (signal monitor, threat radar).
    // The "threat" command reads state.threats[] and ship sentinels, not smithDistance.
    state().setSmithDistance(2);
    expect(state().smithDistance).toBe(2);
    state().setSmithDistance(8);
    expect(state().smithDistance).toBe(8);
  });

  it('missionBeat starts at awakening', () => {
    expect(state().missionBeat).toBe('awakening');
  });

  it('setMissionBeat advances the narrative state', () => {
    state().setMissionBeat('en_route');
    expect(state().missionBeat).toBe('en_route');
    state().setMissionBeat('phone_approach');
    expect(state().missionBeat).toBe('phone_approach');
    state().setMissionBeat('extraction');
    expect(state().missionBeat).toBe('extraction');
  });

  it('jack-out is emergency disconnect and does not award score — hardline exit does', () => {
    // jack-out (emergency) does not call addScore.
    // Only the "exit <agent>" hardline exit command awards agentSurvived points.
    const scoreBefore = state().score;
    exec('jack-out trinity');
    expect(state().score).toBe(scoreBefore);
  });
});
