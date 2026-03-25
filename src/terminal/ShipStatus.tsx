'use client';

import type { ShipStatus, ShipSystem, Agent } from '@/engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function colorSpan(text: string, color: string, extra = ''): string {
  const style = `color:${color}${extra ? `;${extra}` : ''}`;
  return `<span style="${style}">${text}</span>`;
}

function levelColor(pct: number): string {
  if (pct > 70) return 'var(--green)';
  if (pct > 40) return 'var(--yellow)';
  return 'var(--red)';
}

function renderBar(current: number, max: number, width = 10): string {
  const pct = Math.round((current / max) * 100);
  const filled = Math.round((current / max) * width);
  const empty = width - filled;
  const color = levelColor(pct);

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return colorSpan(bar, color) + colorSpan(` ${pct}%`, color);
}

function renderSystemLine(system: ShipSystem, labelWidth = 18): string {
  const label = system.name.padEnd(labelWidth);
  const bar = renderBar(system.level, system.maxLevel);
  const warning =
    system.critical && system.level < 30
      ? colorSpan(' ⚠ CRITICAL', 'var(--red)', 'font-weight:bold')
      : system.level < 50
        ? colorSpan(' ⚠', 'var(--yellow)')
        : '';

  return `  ${colorSpan(label, 'var(--green-dim)')} ${bar}${warning}`;
}

// ---------------------------------------------------------------------------
// renderShipStatus — full ASCII ship status panel
// ---------------------------------------------------------------------------

export function renderShipStatus(ship: ShipStatus): string[] {
  const g = 'var(--green-dim)';
  const w = 50;

  const lines: string[] = [];

  lines.push(colorSpan('╔' + '═'.repeat(w) + '╗', g));
  lines.push(
    colorSpan('║', g) +
      colorSpan('  NEBUCHADNEZZAR — SHIP STATUS'.padEnd(w), 'var(--green)') +
      colorSpan('║', g),
  );
  lines.push(colorSpan('╠' + '═'.repeat(w) + '╣', g));

  // Systems
  const systems: ShipSystem[] = [
    ship.hull,
    ship.power,
    ship.broadcastArray,
    ship.lifeSupport,
    ship.empSystem,
    ship.matrixFeed,
  ];

  for (const sys of systems) {
    const sysLine = renderSystemLine(sys);
    lines.push(colorSpan('║', g) + sysLine.padEnd(w + 200) + ''); // padEnd won't work with HTML, just let it flow
    // We use a simpler approach: wrap the whole inner content
  }

  // Rebuild with proper padding
  lines.length = 3; // keep header

  for (const sys of systems) {
    lines.push(colorSpan('║ ', g) + renderSystemLine(sys));
  }

  lines.push(colorSpan('╠' + '═'.repeat(w) + '╣', g));

  // Ship info
  const depthColor =
    ship.depth > 200 ? 'var(--yellow)' : 'var(--green)';
  lines.push(
    colorSpan('║ ', g) +
      colorSpan('  Depth:             ', 'var(--green-dim)') +
      colorSpan(`${ship.depth} km`, depthColor),
  );

  const sentColor =
    ship.sentinelDistance < 500
      ? 'var(--red)'
      : ship.sentinelDistance < 2000
        ? 'var(--yellow)'
        : 'var(--green)';
  lines.push(
    colorSpan('║ ', g) +
      colorSpan('  Sentinel Distance: ', 'var(--green-dim)') +
      colorSpan(`${ship.sentinelDistance} m`, sentColor),
  );

  lines.push(colorSpan('╠' + '═'.repeat(w) + '╣', g));

  // EMP status
  lines.push(
    colorSpan('║ ', g) + renderEmpLine(ship.empCharge, ship.empCharging),
  );

  lines.push(colorSpan('╚' + '═'.repeat(w) + '╝', g));

  return lines;
}

// ---------------------------------------------------------------------------
// renderEmpLine — inline EMP display
// ---------------------------------------------------------------------------

function renderEmpLine(empCharge: number, empCharging: boolean): string {
  const bar = renderBar(empCharge, 100, 15);
  const status = empCharging
    ? colorSpan(' [CHARGING]', 'var(--yellow)')
    : empCharge >= 100
      ? colorSpan(' [READY]', 'var(--green)')
      : colorSpan(' [OFFLINE]', 'var(--red)');

  return (
    colorSpan('  EMP System:        ', 'var(--green-dim)') + bar + status
  );
}

// ---------------------------------------------------------------------------
// renderEmpStatus — standalone EMP charge display
// ---------------------------------------------------------------------------

export function renderEmpStatus(
  empCharge: number,
  empCharging: boolean,
): string {
  return renderEmpLine(empCharge, empCharging);
}

// ---------------------------------------------------------------------------
// renderCrewStatus — agent fatigue/health overview
// ---------------------------------------------------------------------------

export function renderCrewStatus(agents: Agent[]): string[] {
  const g = 'var(--green-dim)';
  const w = 50;
  const lines: string[] = [];

  lines.push(colorSpan('╔' + '═'.repeat(w) + '╗', g));
  lines.push(
    colorSpan('║', g) +
      colorSpan('  CREW STATUS'.padEnd(w), 'var(--green)') +
      colorSpan('║', g),
  );
  lines.push(colorSpan('╠' + '═'.repeat(w) + '╣', g));

  const agentColors: Record<string, string> = {
    neo: 'var(--green)',
    trinity: 'var(--cyan)',
    morpheus: 'var(--yellow)',
    niobe: 'var(--orange)',
    ghost: '#aaa',
  };

  for (const agent of agents) {
    const nameColor = agentColors[agent.name] ?? 'var(--green)';
    const displayName = agent.displayName.padEnd(12);
    const statusStr = agent.status.toUpperCase().padEnd(10);

    const statusColor =
      agent.status === 'ready' || agent.status === 'in_matrix'
        ? 'var(--green)'
        : agent.status === 'resting'
          ? 'var(--yellow)'
          : agent.status === 'injured'
            ? 'var(--orange)'
            : 'var(--red)';

    // Health bar
    const healthBar = renderBar(agent.health, 100, 8);
    // Fatigue bar (inverted — 0 is good, 100 is bad)
    const fatigueInv = 100 - agent.fatigue;
    const fatigueFilled = Math.round((fatigueInv / 100) * 8);
    const fatigueEmpty = 8 - fatigueFilled;
    const fatigueColor = levelColor(fatigueInv);
    const fatigueBar =
      colorSpan('█'.repeat(fatigueFilled) + '░'.repeat(fatigueEmpty), fatigueColor);

    lines.push(
      colorSpan('║ ', g) +
        '  ' +
        colorSpan(displayName, nameColor) +
        colorSpan(statusStr, statusColor) +
        ' HP:' +
        healthBar +
        '  FTG:' +
        fatigueBar,
    );
  }

  lines.push(colorSpan('╚' + '═'.repeat(w) + '╝', g));

  return lines;
}
