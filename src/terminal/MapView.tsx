'use client';

import type { GameMap, Agent, Threat, Position, HackableElement } from '@/engine/types';

// ---------------------------------------------------------------------------
// Color wrappers — these return HTML spans for colored terminal output
// ---------------------------------------------------------------------------

function span(text: string, color: string, extra = ''): string {
  const style = `color:${color}${extra ? `;${extra}` : ''}`;
  return `<span style="${style}">${text}</span>`;
}

const COLORS = {
  wall: '#444',
  floor: '#1a1a1a',
  door: 'var(--yellow)',
  doorLocked: 'var(--red)',
  phone: 'var(--cyan)',
  exit: '#00ff41',
  exitBright: '#66ff99',
  neo: '#00ff41',
  trinity: 'var(--cyan)',
  morpheus: 'var(--yellow)',
  niobe: 'var(--orange)',
  ghost: '#aaa',
  smith: 'var(--red)',
  danger: 'var(--red)',
  sentinel: 'var(--red)',
  police: 'var(--yellow)',
  camera: 'var(--yellow)',
  cameraDisabled: '#555',
  securityPanel: 'var(--orange)',
  securityBreached: '#555',
  dataTerminal: 'var(--cyan)',
  dataTerminalDone: '#007a7a',
  neoMarker: '#ffffff',
  lure: '#ff00ff',
  lureTriggered: '#660066',
};

const AGENT_CHARS: Record<string, string> = {
  neo: 'N',
  trinity: 'T',
  morpheus: 'M',
  niobe: 'B',
  ghost: 'G',
};

function posKey(p: Position): string {
  return `${p.x},${p.y}`;
}

// ---------------------------------------------------------------------------
// renderMap — full map view
// ---------------------------------------------------------------------------

/** Smith detection radius for shadow/radar overlay */
const SMITH_DETECTION_RADIUS = 2;

export function renderMap(
  map: GameMap,
  agents: Agent[],
  threats: Threat[],
  hackableElements: HackableElement[] = [],
  routePreviews: Record<string, Position[]> = {},
): string[] {
  // Build lookup tables
  const agentMap = new Map<string, Agent>();
  for (const a of agents) {
    if (a.status === 'in_matrix') {
      agentMap.set(posKey(a.position), a);
    }
  }

  const threatMap = new Map<string, Threat>();
  for (const t of threats) {
    if (t.active) {
      threatMap.set(posKey(t.position), t);
    }
  }

  // Hackable element state overrides (by position)
  const hackableMap = new Map<string, HackableElement>();
  for (const el of hackableElements) {
    hackableMap.set(posKey(el.position), el);
  }

  // Smith shadow/radar: compute danger zone (2-tile Manhattan radius around each Smith)
  const dangerZoneSet = new Set<string>();
  for (const t of threats) {
    if (t.type === 'smith' && t.active) {
      for (let dy = -SMITH_DETECTION_RADIUS; dy <= SMITH_DETECTION_RADIUS; dy++) {
        for (let dx = -SMITH_DETECTION_RADIUS; dx <= SMITH_DETECTION_RADIUS; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > SMITH_DETECTION_RADIUS) continue;
          const px = t.position.x + dx;
          const py = t.position.y + dy;
          if (px >= 0 && py >= 0 && px < map.width && py < map.height) {
            dangerZoneSet.add(posKey({ x: px, y: py }));
          }
        }
      }
    }
  }

  // Route preview: build lookup from all agent route previews
  const routePreviewMap = new Map<string, string>(); // posKey → agentName
  for (const [name, path] of Object.entries(routePreviews)) {
    if (!path) continue;
    for (const p of path) {
      const key = posKey(p);
      if (!routePreviewMap.has(key)) {
        routePreviewMap.set(key, name);
      }
    }
  }

  const exitSet = new Set(map.exitPositions.map(posKey));
  const phoneSet = new Set(map.phonePositions.map(posKey));

  const lines: string[] = [];

  // Title
  lines.push(span(`  MAP: ${map.name}`, COLORS.exit));
  lines.push('');

  // Column header — single digit 0-9 repeating for each column
  let header = '   ';
  for (let x = 0; x < map.width; x++) {
    header += span(String(x % 10), '#555');
  }
  lines.push(header);

  // Rows
  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y] ?? '';
    let line = span(String(y).padStart(2, ' '), '#555') + ' ';

    for (let x = 0; x < map.width; x++) {
      const key = posKey({ x, y });
      const tile = row[x] ?? '.';

      // Priority: agent > threat > exit > phone > tile
      if (agentMap.has(key)) {
        const agent = agentMap.get(key)!;
        const ch = AGENT_CHARS[agent.name] ?? '?';
        const color = COLORS[agent.name as keyof typeof COLORS] ?? COLORS.neo;
        line += span(ch, color, 'font-weight:bold');
      } else if (threatMap.has(key)) {
        const threat = threatMap.get(key)!;
        if (threat.type === 'smith') {
          line += span('S', COLORS.smith, 'text-shadow:0 0 6px var(--red)');
        } else {
          line += `<span class="alert-flash" style="color:var(--red)">!</span>`;
        }
      } else if (exitSet.has(key)) {
        line += span('E', COLORS.exitBright, 'font-weight:bold');
      } else if (phoneSet.has(key)) {
        line += span('P', COLORS.phone);
      } else if (hackableMap.has(key)) {
        const el = hackableMap.get(key)!;
        if (el.type === 'camera') {
          if (el.state === 'active') {
            line += span('C', COLORS.camera, 'font-weight:bold');
          } else if (el.state === 'alarmed') {
            line += `<span class="alert-flash" style="color:var(--red);font-weight:bold">C</span>`;
          } else {
            line += span('c', COLORS.cameraDisabled);
          }
        } else if (el.type === 'security_panel') {
          if (el.state === 'active') {
            line += span('S', COLORS.securityPanel, 'font-weight:bold');
          } else {
            line += span('s', COLORS.securityBreached);
          }
        } else if (el.type === 'door_locked') {
          if (el.state === 'active') {
            line += span('d', COLORS.doorLocked, 'font-weight:bold');
          } else if (el.state === 'breached') {
            line += span('D', COLORS.door);
          } else {
            line += span('d', COLORS.securityBreached);
          }
        } else if (el.type === 'data_terminal') {
          if (el.state === 'active') {
            line += span('A', COLORS.dataTerminal, 'font-weight:bold;text-shadow:0 0 6px var(--cyan)');
          } else if (el.state === 'breached') {
            line += span('a', COLORS.dataTerminalDone);
          } else if (el.state === 'alarmed') {
            line += `<span class="alert-flash" style="color:var(--red);font-weight:bold">A</span>`;
          } else {
            line += span('a', COLORS.securityBreached);
          }
        } else if (el.type === 'lure_system') {
          if (el.state === 'breached') {
            line += span('l', COLORS.lureTriggered);
          } else if (el.state === 'alarmed') {
            line += `<span class="alert-flash" style="color:var(--red);font-weight:bold">L</span>`;
          } else {
            line += span('L', COLORS.lure, 'font-weight:bold');
          }
        } else {
          line += span(tile, COLORS.floor);
        }
      } else if (routePreviewMap.has(key) && (tile === '.' || tile === 'D')) {
        // Route preview — show dotted path in agent's color
        const routeAgent = routePreviewMap.get(key)!;
        const routeColor = COLORS[routeAgent as keyof typeof COLORS] ?? COLORS.neo;
        line += span('·', routeColor, 'opacity:0.5');
      } else {
        // Check for danger zone overlay on floor tiles
        const inDanger = dangerZoneSet.has(key) && tile === '.';

        switch (tile) {
          case '#':
            line += span('#', COLORS.wall);
            break;
          case '.':
            if (inDanger) {
              line += span('░', '#660000', 'opacity:0.5');
            } else {
              line += span('.', COLORS.floor);
            }
            break;
          case 'D':
            line += span('D', COLORS.door);
            break;
          case 'd':
            line += span('d', COLORS.doorLocked, 'font-weight:bold');
            break;
          case 'P':
            line += span('P', COLORS.phone);
            break;
          case 'E':
            line += span('E', COLORS.exit);
            break;
          case 'X':
            line += span('X', COLORS.exitBright, 'font-weight:bold');
            break;
          case 'C':
            line += span('C', COLORS.camera, 'font-weight:bold');
            break;
          case 'S':
            line += span('S', COLORS.securityPanel, 'font-weight:bold');
            break;
          case 'A':
            line += span('A', COLORS.dataTerminal, 'font-weight:bold;text-shadow:0 0 6px var(--cyan)');
            break;
          case 'N':
            line += span('N', COLORS.neoMarker, 'font-weight:bold;text-shadow:0 0 6px #ffffff');
            break;
          default:
            line += span(tile, COLORS.floor);
        }
      }
    }

    lines.push(line);
  }

  // Legend
  lines.push('');
  lines.push(
    '  ' +
      span('N', COLORS.neo) + '=Neo  ' +
      span('T', COLORS.trinity) + '=Trinity  ' +
      span('M', COLORS.morpheus) + '=Morpheus  ' +
      span('B', COLORS.niobe) + '=Niobe  ' +
      span('G', COLORS.ghost) + '=Ghost',
  );
  lines.push(
    '  ' +
      span('S', COLORS.smith) + '=Smith  ' +
      span('!', COLORS.danger) + '=Threat  ' +
      span('X', COLORS.exitBright) + '=Exit  ' +
      span('P', COLORS.phone) + '=Phone  ' +
      span('D', COLORS.door) + '=Door  ' +
      span('d', COLORS.doorLocked) + '=Locked  ' +
      span('C', COLORS.camera) + '=Cam  ' +
      span('S', COLORS.securityPanel) + '=Panel  ' +
      span('A', COLORS.dataTerminal) + '=Terminal  ' +
      span('N', COLORS.neoMarker) + '=Neo(NPC)  ' +
      span('L', COLORS.lure) + '=Lure  ' +
      span('░', '#660000') + '=Danger  ' +
      span('·', COLORS.neo) + '=Route',
  );

  return lines;
}

// ---------------------------------------------------------------------------
// renderMiniMap — compact 3-line minimap for status bar
// ---------------------------------------------------------------------------

export function renderMiniMap(
  map: GameMap,
  agents: Agent[],
  threats: Threat[],
): string[] {
  // Show a 3-row summary centered on the first active agent, or map center
  const activeAgent = agents.find(
    (a) => a.status === 'in_matrix',
  );
  const centerY = activeAgent
    ? Math.min(Math.max(activeAgent.position.y, 1), map.height - 2)
    : Math.floor(map.height / 2);
  const centerX = activeAgent
    ? activeAgent.position.x
    : Math.floor(map.width / 2);

  // Show a window of 20 chars wide, 3 rows tall
  const viewW = Math.min(20, map.width);
  const startX = Math.max(0, Math.min(centerX - Math.floor(viewW / 2), map.width - viewW));
  const startY = Math.max(0, centerY - 1);

  const agentMap = new Map<string, Agent>();
  for (const a of agents) {
    if (a.status === 'in_matrix') {
      agentMap.set(posKey(a.position), a);
    }
  }
  const threatMap = new Map<string, Threat>();
  for (const t of threats) {
    if (t.active) threatMap.set(posKey(t.position), t);
  }

  const lines: string[] = [];
  for (let dy = 0; dy < 3 && startY + dy < map.height; dy++) {
    const y = startY + dy;
    const row = map.tiles[y] ?? '';
    let line = '';

    for (let dx = 0; dx < viewW && startX + dx < map.width; dx++) {
      const x = startX + dx;
      const key = posKey({ x, y });

      if (agentMap.has(key)) {
        const agent = agentMap.get(key)!;
        const ch = AGENT_CHARS[agent.name] ?? '?';
        const color = COLORS[agent.name as keyof typeof COLORS] ?? COLORS.neo;
        line += span(ch, color);
      } else if (threatMap.has(key)) {
        line += span('!', COLORS.danger);
      } else {
        const tile = row[x] ?? '.';
        switch (tile) {
          case '#':
            line += span('#', COLORS.wall);
            break;
          case '.':
            line += span('.', COLORS.floor);
            break;
          default:
            line += span(tile, '#555');
        }
      }
    }

    lines.push(line);
  }

  return lines;
}
