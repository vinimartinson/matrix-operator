// ---------------------------------------------------------------------------
// Matrix Operator – Command Implementations
// ---------------------------------------------------------------------------

import type {
  Agent,
  AgentName,
  CommandResult,
  GameStateSlice,
  Threat,
} from '@/engine/types';
import { CommandRegistry } from '@/engine/command-registry';
import {
  jackIn,
  jackOut,
  getAgentStatus,
  getAvailableAgents,
  getJackedInAgents,
  routeAgent,
  executeHack,
  executeOperatorHack,
} from '@/engine/agent-manager';
import {
  getShipStatusDisplay,
  getCrewDisplay,
  allocatePower,
  changeDive,
  chargeEmp,
  fireEmp,
  repairSystem,
  depthSignalFactor,
  depthEmpKillChance,
  sentinelCountForDepth,
} from '@/engine/ship-systems';
import { getRank, getNextRank, SCORE_VALUES, RANKS } from '@/engine/scoring';
import {
  getNextMission,
  getMissionBriefing,
  getMissionMap,
  instantiateHackableElements,
  MISSION_TEMPLATES,
} from '@/engine/mission-engine';
import { analyzeAnomaly, generateAnomaly } from '@/engine/anomaly-engine';
import { getThreatSummary, getSmithTaunt, spawnSmith } from '@/engine/threat-engine';
import { validateAgentName } from '@/terminal/input-handler';
import { renderMap } from '@/terminal/MapView';
import { generateAgentDialogue } from '@/ai/dialogue-generator';
import { listHackableElements } from '@/engine/hackable-elements';
import { callOrchestrator } from '@/engine/mission-orchestrator';
import { useGameStore } from '@/engine/game-state';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(output: string[], className?: string): CommandResult {
  return { output, className };
}

function err(message: string): CommandResult {
  return { output: [message], className: 'error' };
}

function info(output: string[]): CommandResult {
  return { output, className: 'success' };
}

function warn(output: string[]): CommandResult {
  return { output, className: 'warning' };
}

const AGENT_NAMES: AgentName[] = ['neo', 'trinity', 'morpheus', 'niobe', 'ghost'];

const SYSTEM_NAME_MAP: Record<string, keyof GameStateSlice['ship']> = {
  hull: 'hull',
  power: 'power',
  broadcast: 'broadcastArray',
  array: 'broadcastArray',
  life: 'lifeSupport',
  lifesupport: 'lifeSupport',
  emp: 'empSystem',
  matrix: 'matrixFeed',
  feed: 'matrixFeed',
};

const POWER_LEVEL_MAP: Record<string, number> = {
  high: 95,
  medium: 70,
  low: 40,
};

// ---------------------------------------------------------------------------
// Register all commands
// ---------------------------------------------------------------------------

export function registerAllCommands(registry: CommandRegistry): void {
  // =========================================================================
  // META COMMANDS
  // =========================================================================

  registry.register('help', {
    description: 'Show available commands or help for a specific command',
    usage: 'help [command]',
    category: 'meta',
    aliases: ['h', '?'],
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length > 0) {
        const cmd = registry.get(args[0]);
        if (!cmd) {
          return err(`Unknown command: ${args[0]}`);
        }
        return info([
          `Command: ${cmd.name}`,
          `Usage:   ${cmd.usage}`,
          `         ${cmd.description}`,
          cmd.aliases ? `Aliases: ${cmd.aliases.join(', ')}` : '',
        ].filter(Boolean));
      }
      return registry.getHelp();
    },
  });

  registry.register('clear', {
    description: 'Clear the terminal screen',
    usage: 'clear',
    category: 'meta',
    aliases: ['cls'],
    handler: (_args: string[], state: GameStateSlice) => {
      state.clearTerminal();
      return ok([]);
    },
  });

  registry.register('log', {
    description: 'Show recent game events',
    usage: 'log',
    category: 'meta',
    handler: (_args: string[], state: GameStateSlice) => {
      if (state.events.length === 0) {
        return info(['No events recorded yet.']);
      }
      const recent = state.events.slice(-15);
      const lines = ['=== RECENT EVENTS ===', ''];
      for (const evt of recent) {
        const time = new Date(evt.timestamp).toLocaleTimeString();
        const tag = evt.priority === 'critical' ? '[!!]' : evt.priority === 'warning' ? '[!]' : '[i]';
        lines.push(`  ${tag} ${time} — ${evt.message}`);
      }
      return info(lines);
    },
  });

  registry.register('rank', {
    description: 'Show current rank, score, and progress',
    usage: 'rank',
    category: 'meta',
    handler: (_args: string[], state: GameStateSlice) => {
      const next = getNextRank(state.totalScore);
      const lines = [
        '╔══════════════════════════════════════╗',
        '║          OPERATOR RANK               ║',
        '╠══════════════════════════════════════╣',
        `║  Rank:  ${state.rank.title.padEnd(28)} ║`,
        `║  Level: ${String(state.rank.level).padEnd(28)} ║`,
        `║  Score: ${String(state.totalScore).padEnd(28)} ║`,
      ];
      if (next) {
        const progress = Math.round(
          ((state.totalScore - state.rank.pointsRequired) /
            (next.rank.pointsRequired - state.rank.pointsRequired)) * 100,
        );
        const barLen = 20;
        const filled = Math.round((progress / 100) * barLen);
        const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        lines.push(`║  Next:  ${next.rank.title.padEnd(28)} ║`);
        lines.push(`║  Need:  ${String(next.pointsNeeded + ' pts').padEnd(28)} ║`);
        lines.push(`║  [${bar}] ${String(progress + '%').padStart(4)}        ║`);
      } else {
        lines.push('║  >> MAXIMUM RANK ACHIEVED <<           ║');
      }
      lines.push('╚══════════════════════════════════════╝');
      return info(lines);
    },
  });

  registry.register('daily', {
    description: 'Show daily challenge info',
    usage: 'daily',
    category: 'meta',
    handler: (_args: string[], _state: GameStateSlice) => {
      return info([
        '=== DAILY CHALLENGE ===',
        '',
        '  Daily challenges coming soon.',
        '  Complete missions to earn points toward your rank.',
        '',
        '  Check back tomorrow, Operator.',
      ]);
    },
  });

  registry.register('score', {
    description: 'Show detailed score breakdown',
    usage: 'score',
    category: 'meta',
    handler: (_args: string[], state: GameStateSlice) => {
      const lines = [
        '=== SCORE BREAKDOWN ===',
        '',
        `  Total Score:       ${state.totalScore}`,
        `  Session Score:     ${state.score}`,
        `  Missions Done:     ${state.completedMissions}`,
        `  Mission Attempts:  ${state.missionCount}`,
        `  Current Rank:      ${state.rank.title} (Level ${state.rank.level})`,
        '',
        '  SCORING REFERENCE:',
        `    Mission Complete:   +${SCORE_VALUES.missionComplete}`,
        `    Agent Survived:    +${SCORE_VALUES.agentSurvived}`,
        `    Anomaly Detected:  +${SCORE_VALUES.anomalyDetected}`,
        `    Anomaly Analyzed:  +${SCORE_VALUES.anomalyAnalyzed}`,
        `    Under Par Time:    +${SCORE_VALUES.underParTimeBonus}`,
        `    Full Extraction:   +${SCORE_VALUES.fullExtraction}`,
        `    Agent Injured:     ${SCORE_VALUES.agentInjured}`,
        `    Mission Failed:    ${SCORE_VALUES.missionFailed}`,
      ];
      return info(lines);
    },
  });

  registry.register('missions', {
    description: 'Start next mission or show available missions',
    usage: 'missions',
    category: 'meta',
    aliases: ['mission'],
    handler: (_args: string[], state: GameStateSlice) => {
      if (state.mission && state.mission.status === 'active') {
        return warn(['A mission is already active. Complete or fail it first.', '', `  Current: ${state.mission.title}`]);
      }

      // Only one mission is active in this build.
      // After completing it the crew resets and it can be replayed.
      const mission = getNextMission(state.missionCount);
      const briefing = getMissionBriefing(mission);

      // Store the mission in briefing state
      state.startMission(mission);
      state.setPhase('idle');

      const lines = [...briefing];

      if (state.missionCount > 0) {
        lines.push('');
        lines.push('  [Additional missions are in development.]');
        lines.push('  [See MISSIONS.md to propose the next operation.]');
      }

      return info(lines);
    },
  });

  registry.register('accept', {
    description: 'Accept the current mission briefing',
    usage: 'accept',
    category: 'meta',
    handler: (_args: string[], state: GameStateSlice) => {
      if (!state.mission) {
        return err('No mission to accept. Type "missions" to get a briefing.');
      }
      if (state.mission.status === 'active' && state.currentPhase === 'mission') {
        return warn(['Mission already active.']);
      }

      // Activate the mission
      state.startMission({ ...state.mission, status: 'active' });

      // Reset all agents from previous missions
      const allAgentNames = Object.keys(state.agents) as AgentName[];
      for (const name of allAgentNames) {
        const agent = state.agents[name];
        if (agent.status === 'in_matrix' || agent.status === 'resting') {
          state.updateAgent(name, {
            status: 'ready',
            position: { x: 0, y: 0 },
          });
        }
      }

      // Initialize hackable elements from the mission map (narrative missions use a stub map)
      const map = getMissionMap(state.mission.type);
      if (map) {
        const elements = instantiateHackableElements(map);
        state.setHackableElements(elements);
      }

      state.addEvent('mission_start', `Mission accepted: ${state.mission.title}`, 'info');

      const isNarrative = state.mission.type === 'trinitys_escape';

      const lines = [
        '>> MISSION ACCEPTED <<',
        '',
        'Good luck, Operator.',
        '',
      ];
      if (isNarrative) {
        lines.push('Jack Trinity in when ready: jack-in trinity');
        lines.push('Monitor the signal panels. Contact Trinity via the comms channel.');
        lines.push('Use "hack <label>" to interact with environment systems.');
        lines.push('Use "systems" to see available hackable elements.');
      } else {
        lines.push('Use "jack-in <agent>" to send agents into the Matrix.');
      }

      // Narrative mission: fire opening orchestrator tick
      if (isNarrative) {
        setTimeout(() => {
          void callOrchestrator('', true);
        }, 1500);
      }

      return ok(lines, 'success');
    },
  });

  registry.register('decline', {
    description: 'Decline the current mission briefing',
    usage: 'decline',
    category: 'meta',
    handler: (_args: string[], state: GameStateSlice) => {
      if (!state.mission) {
        return err('No mission to decline.');
      }
      state.failMission();
      return warn(['Mission declined. The crew stands down.', '', 'Type "missions" when ready to run the operation.']);
    },
  });

  registry.register('brief', {
    description: 'Show current mission briefing',
    usage: 'brief',
    category: 'meta',
    handler: (_args: string[], state: GameStateSlice) => {
      if (!state.mission) {
        return err('No active mission. Type "missions" to get one.');
      }
      const briefing = getMissionBriefing(state.mission);
      return info(briefing);
    },
  });

  // =========================================================================
  // NAVIGATION COMMANDS
  // =========================================================================

  registry.register('scan', {
    description: 'Scan Matrix feed for anomalies',
    usage: 'scan',
    category: 'navigation',
    hidden: true,
    aliases: ['s'],
    handler: (_args: string[], state: GameStateSlice) => {
      if (state.currentPhase !== 'mission' && state.currentPhase !== 'idle') {
        return warn(['No active Matrix feed to scan.']);
      }

      // Detect undetected anomalies
      const undetected = state.anomalies.filter((a) => !a.detected);
      if (undetected.length === 0 && state.anomalies.length === 0) {
        // Generate one for the player
        const newAnomaly = generateAnomaly();
        state.addAnomaly({ ...newAnomaly, detected: true });
        state.addScore(SCORE_VALUES.anomalyDetected);
        state.addEvent('anomaly_detected', `Anomaly detected: ${newAnomaly.type}`, 'info');
        return info([
          '>> SCANNING MATRIX FEED <<',
          '',
          `  [${newAnomaly.id.slice(-8)}] ${newAnomaly.type.replace('_', ' ').toUpperCase()} — Threat: ${newAnomaly.threatLevel.toUpperCase()}`,
          `  ${newAnomaly.description}`,
          '',
          'Use "analyze <id>" for detailed analysis.',
        ]);
      }

      // Mark undetected as detected
      for (const a of undetected) {
        state.updateAnomaly(a.id, { detected: true });
        state.addScore(SCORE_VALUES.anomalyDetected);
      }

      const detected = [...state.anomalies.filter((a) => a.detected), ...undetected];

      if (detected.length === 0) {
        return info(['>> SCANNING MATRIX FEED <<', '', '  No anomalies detected. Feed is clean.']);
      }

      const lines = ['>> SCANNING MATRIX FEED <<', ''];
      for (const a of detected) {
        const status = a.analyzed ? '[ANALYZED]' : '[DETECTED]';
        lines.push(`  ${status} [${a.id.slice(-8)}] ${a.type.replace('_', ' ').toUpperCase()} — ${a.threatLevel.toUpperCase()}`);
      }
      lines.push('');
      lines.push('Use "analyze <id>" for detailed analysis.');

      return info(lines);
    },
  });

  registry.register('analyze', {
    description: 'Analyze a detected anomaly',
    usage: 'analyze <id>',
    category: 'navigation',
    hidden: true,
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length === 0) {
        return err('Usage: analyze <anomaly-id>');
      }

      const searchId = args[0].toLowerCase();
      const anomaly = state.anomalies.find(
        (a) => a.id.endsWith(searchId) || a.id.includes(searchId),
      );

      if (!anomaly) {
        return err(`Anomaly not found: ${searchId}. Use "scan" to detect anomalies.`);
      }

      if (!anomaly.detected) {
        return err('Anomaly not yet detected. Run "scan" first.');
      }

      if (anomaly.analyzed) {
        return warn(['This anomaly has already been analyzed.', '', `  ${analyzeAnomaly(anomaly)}`]);
      }

      state.updateAnomaly(anomaly.id, { analyzed: true });
      state.addScore(SCORE_VALUES.anomalyAnalyzed);
      state.addEvent('anomaly_analyzed', `Anomaly analyzed: ${anomaly.type}`, 'info');

      const analysis = analyzeAnomaly(anomaly);

      return info([
        `>> ANOMALY ANALYSIS: ${anomaly.type.replace('_', ' ').toUpperCase()} <<`,
        '',
        `  Threat Level: ${anomaly.threatLevel.toUpperCase()}`,
        `  ${anomaly.description}`,
        '',
        `  ${analysis}`,
      ]);
    },
  });

  registry.register('map', {
    description: 'Display the current mission area map',
    usage: 'map',
    category: 'navigation',
    hidden: true,
    aliases: ['m'],
    handler: (_args: string[], state: GameStateSlice) => {
      if (!state.mission) {
        return warn([
          'No active mission. The map is available during missions.',
          'Type "missions" to start one.',
        ]);
      }

      const map = getMissionMap(state.mission.type);
      if (!map) {
        return err('Map data unavailable for this mission.');
      }

      const agents = AGENT_NAMES.map((n) => state.agents[n]);
      const mapLines = renderMap(map, agents, state.threats, state.hackableElements);

      return ok(mapLines);
    },
  });

  registry.register('locate', {
    description: 'Show an agent\'s position and status',
    usage: 'locate <agent>',
    category: 'navigation',
    hidden: true,
    aliases: ['loc', 'find'],
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length === 0) {
        return err('Usage: locate <agent>  (e.g., "locate neo")');
      }

      const agentName = validateAgentName(args[0]);
      if (!agentName) {
        return err(`Unknown agent: ${args[0]}. Valid agents: ${AGENT_NAMES.join(', ')}`);
      }

      const agent = state.agents[agentName];
      const status = getAgentStatus(agent);

      return info(['>> AGENT LOCATION <<', '', ...status]);
    },
  });

  registry.register('route', {
    description: 'Direct an agent to move to a position',
    usage: 'route <agent> <x> <y>',
    category: 'navigation',
    hidden: true,
    aliases: ['move'],
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length < 2) {
        return err('Usage: route <agent> <x> <y>  or  route <agent> exit  or  route <agent> phone');
      }

      const agentName = validateAgentName(args[0]);
      if (!agentName) {
        return err(`Unknown agent: ${args[0]}`);
      }

      const agent = state.agents[agentName];
      if (agent.status !== 'in_matrix') {
        return err(`${agent.displayName} is not in the Matrix (status: ${agent.status}).`);
      }

      let destX: number;
      let destY: number;

      // Handle named destinations
      const dest = args[1].toLowerCase();
      if (dest === 'exit' || dest === 'x') {
        const map = state.mission ? getMissionMap(state.mission.type) : null;
        if (map && map.exitPositions.length > 0) {
          destX = map.exitPositions[0].x;
          destY = map.exitPositions[0].y;
        } else {
          return err('No exit position available.');
        }
      } else if (dest === 'phone' || dest === 'p') {
        const map = state.mission ? getMissionMap(state.mission.type) : null;
        if (map && map.phonePositions.length > 0) {
          // Find nearest phone
          let nearest = map.phonePositions[0];
          let nearestDist = Math.abs(nearest.x - agent.position.x) + Math.abs(nearest.y - agent.position.y);
          for (const p of map.phonePositions) {
            const d = Math.abs(p.x - agent.position.x) + Math.abs(p.y - agent.position.y);
            if (d < nearestDist) {
              nearest = p;
              nearestDist = d;
            }
          }
          destX = nearest.x;
          destY = nearest.y;
        } else {
          return err('No phone positions available.');
        }
      } else {
        destX = parseInt(args[1], 10);
        destY = args.length >= 3 ? parseInt(args[2], 10) : 0;
        if (isNaN(destX) || isNaN(destY)) {
          return err('Invalid coordinates. Usage: route <agent> <x> <y>');
        }
      }

      try {
        const routeMap = state.mission ? getMissionMap(state.mission.type) : undefined;
        const newPos = routeAgent(agent, { x: destX, y: destY }, routeMap, state.hackableElements);
        state.updateAgent(agentName, { position: newPos });
        state.addEvent('agent_move', `${agent.displayName} moving to (${destX},${destY})`, 'info');

        const distance = Math.abs(destX - newPos.x) + Math.abs(destY - newPos.y);
        return info([
          `>> ${agent.displayName} ROUTING <<`,
          '',
          `  Moving toward (${destX}, ${destY})`,
          `  Current position: (${newPos.x}, ${newPos.y})`,
          `  Remaining distance: ${distance} tiles`,
          distance === 0 ? '  >> ARRIVED AT DESTINATION <<' : '',
        ].filter(Boolean));
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Route failed.');
      }
    },
  });

  registry.register('exit', {
    description: 'Call a hardline exit for an agent',
    usage: 'exit <agent>',
    category: 'navigation',
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length === 0) {
        return err('Usage: exit <agent>');
      }

      const agentName = validateAgentName(args[0]);
      if (!agentName) {
        return err(`Unknown agent: ${args[0]}`);
      }

      const agent = state.agents[agentName];
      if (agent.status !== 'in_matrix') {
        return err(`${agent.displayName} is not in the Matrix.`);
      }

      // Narrative mission: bypass phone-proximity check — route to orchestrator
      if (state.mission?.type === 'trinitys_escape') {
        const beat = state.missionBeat;
        if (beat !== 'extraction') {
          return warn([
            `${agent.displayName} has not reached the hardline yet.`,
            'Guide her to the phone first.',
          ]);
        }
        // Fire orchestrator — it will advance beat to 'complete' and trigger mission success
        void callOrchestrator(`jack ${agent.displayName.toLowerCase()} out`, false);
        return info([
          `>> EXTRACTION INITIATED <<`,
          `Pulling ${agent.displayName} from the Matrix...`,
        ]);
      }

      // Standard mission: check if agent is near a phone
      const map = state.mission ? getMissionMap(state.mission.type) : null;
      let nearPhone = false;
      if (map) {
        for (const p of map.phonePositions) {
          const dist = Math.abs(p.x - agent.position.x) + Math.abs(p.y - agent.position.y);
          if (dist <= 2) {
            nearPhone = true;
            break;
          }
        }
      }

      if (!nearPhone && map) {
        return warn([
          `${agent.displayName} is not near a hardline phone.`,
          'Route them to a phone location first (shown as P on the map).',
          `Current position: (${agent.position.x}, ${agent.position.y})`,
        ]);
      }

      try {
        const update = jackOut(agent);
        state.updateAgent(agentName, update);
        state.updateAgent(agentName, { missionsCompleted: agent.missionsCompleted + 1 });
        state.addScore(SCORE_VALUES.agentSurvived);
        state.addEvent('agent_exit', `${agent.displayName} extracted via hardline.`, 'info');

        // Check if all agents are out
        const stillIn = getJackedInAgents(state.agents);
        const allOut = stillIn.length === 0 || (stillIn.length === 1 && stillIn[0] === agentName);

        const lines = [
          `>> ${agent.displayName.toUpperCase()} EXTRACTED <<`,
          '',
          `  ${agent.displayName} is out. Safe on the ship.`,
        ];

        if (allOut && state.mission && state.mission.status === 'active') {
          state.completeMission();
          state.addScore(SCORE_VALUES.missionComplete + SCORE_VALUES.fullExtraction);
          state.addEvent('mission_complete', `Mission complete: ${state.mission.title}`, 'info');
          lines.push('');
          lines.push('  >> ALL AGENTS EXTRACTED — MISSION COMPLETE <<');
          lines.push(`  Score: +${SCORE_VALUES.missionComplete + SCORE_VALUES.fullExtraction}`);
          lines.push('');
          lines.push('  Type "missions" for the next operation.');
        }

        return ok(lines, 'success');
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Exit failed.');
      }
    },
  });

  // =========================================================================
  // TACTICAL COMMANDS
  // =========================================================================

  registry.register('threat', {
    description: 'List all active threats with positions',
    usage: 'threat',
    category: 'tactical',
    aliases: ['threats'],
    handler: (_args: string[], state: GameStateSlice) => {
      const lines = ['>> THREAT ASSESSMENT <<', ''];
      const summary = getThreatSummary(state.threats);

      // Merge ship-level sentinels into the summary when no sentinel threats are in state.threats
      const hasSentinelThreat = state.threats.some((t) => t.type === 'sentinel' && t.active);
      if (!hasSentinelThreat && state.ship.sentinelCount > 0) {
        const sentinelLines = Array.from({ length: state.ship.sentinelCount }, (_, i) =>
          `  ⚠ SENTINEL ${i + 1}/${state.ship.sentinelCount} — ${state.ship.sentinelDistance}m out`,
        );
        const noThreats = summary.length === 1 && summary[0].includes('No active threats');
        lines.push(...(noThreats ? sentinelLines : [...summary, ...sentinelLines]));
      } else {
        lines.push(...summary);
      }

      const smithThreats = state.threats.filter((t) => t.type === 'smith' && t.active);
      if (smithThreats.length > 0) {
        lines.push('');
        lines.push(`  Smith intercept: "${getSmithTaunt()}"`);
      }

      return info(lines);
    },
  });

  registry.register('alert', {
    description: 'Warn an agent of danger',
    usage: 'alert <agent> <message>',
    category: 'tactical',
    hidden: true,
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length < 2) {
        return err('Usage: alert <agent> <message>');
      }

      const agentName = validateAgentName(args[0]);
      if (!agentName) {
        return err(`Unknown agent: ${args[0]}`);
      }

      const agent = state.agents[agentName];
      if (agent.status !== 'in_matrix') {
        return warn([`${agent.displayName} is not in the Matrix. Alert not delivered.`]);
      }

      const message = args.slice(1).join(' ');
      state.addEvent('alert_sent', `Alert to ${agent.displayName}: ${message}`, 'warning');

      // Fire off async AI dialogue but return immediately with a placeholder
      // The AI response will be added to terminal asynchronously
      generateAgentDialogue(agentName, message, `alert ${message}`).then((response) => {
        state.addTerminalLine(`  ${agent.displayName}: "${response}"`, 'system');
      });

      return info([
        `>> ALERT SENT TO ${agent.displayName.toUpperCase()} <<`,
        '',
        `  You: "${message}"`,
        `  Awaiting response...`,
      ]);
    },
  });

  registry.register('override', {
    description: 'Override a Matrix system (doors, cameras, elevators, traffic)',
    usage: 'override <system>',
    category: 'tactical',
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length === 0) {
        return err('Usage: override <doors|cameras|elevators|traffic>');
      }

      const system = args[0].toLowerCase();
      const validSystems = ['doors', 'cameras', 'elevators', 'traffic'];
      if (!validSystems.includes(system)) {
        return err(`Invalid system. Choose: ${validSystems.join(', ')}`);
      }

      if (state.currentPhase !== 'mission') {
        return warn(['No active mission. Override unavailable.']);
      }

      state.addEvent('override', `System override: ${system}`, 'info');

      const messages: Record<string, string[]> = {
        doors: [
          '>> OVERRIDE: DOORS <<',
          '',
          '  Accessing building security mainframe...',
          '  Door locks disengaged. All doors in sector are UNLOCKED.',
          '  Window: 45 seconds before system resets.',
        ],
        cameras: [
          '>> OVERRIDE: CAMERAS <<',
          '',
          '  Injecting loop into surveillance feed...',
          '  Camera feeds now showing 30-second loop.',
          '  Agents can move undetected for a short time.',
        ],
        elevators: [
          '>> OVERRIDE: ELEVATORS <<',
          '',
          '  Hijacking elevator control system...',
          '  Elevators rerouted to agent positions.',
          '  Express mode engaged — no stops.',
        ],
        traffic: [
          '>> OVERRIDE: TRAFFIC <<',
          '',
          '  Manipulating traffic light network...',
          '  Creating green corridor for extraction route.',
          '  Police response time increased.',
        ],
      };

      return info(messages[system] ?? ['Override engaged.']);
    },
  });

  registry.register('emp', {
    description: 'Fire the EMP (requires full charge)',
    usage: 'emp',
    category: 'tactical',
    handler: (_args: string[], state: GameStateSlice) => {
      if (state.ship.empCharge < 100) {
        return warn([
          `EMP charge: ${Math.round(state.ship.empCharge)}%. Not ready.`,
          'Use "charge" to begin charging.',
        ]);
      }

      return fireEmpNow(state);
    },
  });

  registry.register('jack-in', {
    description: 'Jack an agent into the Matrix',
    usage: 'jack-in <agent>',
    category: 'tactical',
    aliases: ['jackin', 'ji'],
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length === 0) {
        return err('Usage: jack-in <agent>');
      }

      const agentName = validateAgentName(args[0]);
      if (!agentName) {
        return err(`Unknown agent: ${args[0]}`);
      }

      const agent = state.agents[agentName];
      try {
        // Use the current mission map's spawn positions, fallback to default
        const map = state.mission ? getMissionMap(state.mission.type) : undefined;
        const spawnPos = map?.agentPositions?.[0] ?? { x: 1, y: 1 };
        const update = jackIn(agent, spawnPos);
        state.updateAgent(agentName, update);
        state.addEvent('jack_in', `${agent.displayName} jacked in.`, 'info');

        return info([
          `>> ${agent.displayName.toUpperCase()} JACKED IN <<`,
          '',
          `  ${agent.displayName} is now in the Matrix.`,
        ]);
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Jack-in failed.');
      }
    },
  });

  registry.register('jack-out', {
    description: 'Emergency disconnect an agent (adds fatigue)',
    usage: 'jack-out <agent>',
    category: 'tactical',
    aliases: ['jackout', 'jo'],
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length === 0) {
        return err('Usage: jack-out <agent>');
      }

      const agentName = validateAgentName(args[0]);
      if (!agentName) {
        return err(`Unknown agent: ${args[0]}`);
      }

      const agent = state.agents[agentName];
      try {
        const update = jackOut(agent);
        state.updateAgent(agentName, update);
        state.addEvent('jack_out', `${agent.displayName} emergency disconnected.`, 'warning');

        return warn([
          `>> ${agent.displayName.toUpperCase()} JACKED OUT <<`,
          '',
          `  Emergency disconnect. ${agent.displayName} is disoriented.`,
          `  Fatigue increased to ${update.fatigue}%.`,
          '  Status: RESTING',
        ]);
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Jack-out failed.');
      }
    },
  });

  // =========================================================================
  // SHIP COMMANDS
  // =========================================================================

  registry.register('status', {
    description: 'Show full ship systems status',
    usage: 'status',
    category: 'ship',
    aliases: ['ship', 'sys'],
    handler: (_args: string[], state: GameStateSlice) => {
      const lines = getShipStatusDisplay(state.ship);
      return info(lines);
    },
  });

  registry.register('crew', {
    description: 'Show crew status with health and fatigue',
    usage: 'crew',
    category: 'ship',
    aliases: ['agents'],
    handler: (_args: string[], state: GameStateSlice) => {
      const lines = getCrewDisplay(state.agents);
      return info(lines);
    },
  });

  registry.register('power', {
    description: 'Allocate power to a system (high/medium/low)',
    usage: 'power <system> <level>',
    category: 'ship',
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length < 2) {
        return err('Usage: power <system> <high|medium|low>');
      }

      const systemKey = SYSTEM_NAME_MAP[args[0].toLowerCase()];
      if (!systemKey) {
        return err(`Unknown system: ${args[0]}. Valid: hull, power, broadcast, life, emp, matrix`);
      }

      const level = POWER_LEVEL_MAP[args[1].toLowerCase()];
      if (level === undefined) {
        return err('Invalid level. Use: high, medium, or low');
      }

      const updated = allocatePower(state.ship, systemKey, level);
      state.updateShip(updated);
      state.addEvent('power_change', `Power allocated to ${args[0]}: ${args[1]}`, 'info');

      return info([
        `>> POWER ALLOCATION <<`,
        '',
        `  ${args[0].toUpperCase()} set to ${args[1].toUpperCase()} (${level}%)`,
        '  Other systems adjusted proportionally.',
        '',
        '  Use "status" to see updated levels.',
      ]);
    },
  });

  registry.register('repair', {
    description: 'Repair a damaged ship system',
    usage: 'repair <system>',
    category: 'ship',
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length === 0) {
        return err('Usage: repair <system>  (hull, power, broadcast, life, emp, matrix)');
      }

      const systemKey = SYSTEM_NAME_MAP[args[0].toLowerCase()];
      if (!systemKey) {
        return err(`Unknown system: ${args[0]}`);
      }

      const updated = repairSystem(state.ship, systemKey, 15);
      state.updateShip(updated);
      state.addEvent('repair', `Repaired: ${args[0]}`, 'info');

      return info([
        `>> REPAIR: ${args[0].toUpperCase()} <<`,
        '',
        `  Repair crew dispatched. System integrity improving.`,
        `  +15% to ${args[0]}.`,
        '',
        '  Use "status" to see updated levels.',
      ]);
    },
  });

  registry.register('dive', {
    description: 'Change broadcast depth (1-5 km). Safe zone: 1-2km. Danger: >3km.',
    usage: 'dive <depth>',
    category: 'ship',
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length === 0) {
        return info([
          'Usage: dive <1-5>',
          '',
          '  1-2 km  SAFE ZONE    — hard to detect, strong broadcast signal',
          '  2-3 km  NEUTRAL ZONE — standard detection, moderate signal',
          '  3-5 km  DANGER ZONE  — easy to detect, weak signal, EMP bonus',
          '',
          `  Current depth: ${state.ship.depth.toFixed(1)} km`,
        ]);
      }

      const depth = parseFloat(args[0]);
      if (isNaN(depth) || depth < 1 || depth > 5) {
        return err('Depth must be between 1 and 5 km.');
      }

      const prevDepth = state.ship.depth;
      const updated   = changeDive(state.ship, depth);
      state.updateShip(updated);
      state.addEvent('dive', `Depth changed to ${depth.toFixed(1)}km`, 'info');

      const deeper      = depth > prevDepth;
      const signalPct    = Math.round(depthSignalFactor(depth) * 100);
      const empKillPct   = Math.round(depthEmpKillChance(depth) * 100);
      const newSentCount = sentinelCountForDepth(depth);
      const oldSentCount = state.ship.sentinelCount;
      const inDanger     = depth > 3;
      const inSafe       = depth <= 2;

      const zoneLabel    = inSafe    ? 'SAFE ZONE ✓'
                         : inDanger  ? 'DANGER ZONE ⚠'
                         :             'NEUTRAL ZONE';

      const sentApproach = depth > 3
        ? 15 + Math.round((depth - 3) * 10)
        : depth > 2 ? 15 : 10;

      const sentChange   = newSentCount > oldSentCount
        ? `+${newSentCount - oldSentCount} appearing on sonar`
        : newSentCount < oldSentCount
        ? `${oldSentCount - newSentCount} lost your signal — gone from sonar`
        : 'no change';

      return info([
        `>> DEPTH ${deeper ? 'DIVE' : 'ASCENT'}: ${depth.toFixed(1)} km  [ ${zoneLabel} ] <<`,
        '',
        `  ▸ BROADCAST SIGNAL  : ${signalPct}%  ${inSafe ? '(boosted)' : inDanger ? '(degraded)' : '(nominal)'}`,
        `  ▸ SENTINEL APPROACH : ${sentApproach} m/tick  ${inDanger ? '(ELEVATED — sentinels closing faster)' : '(nominal)'}`,
        `  ▸ EMP KILL CHANCE   : ${empKillPct}%  ${inDanger ? '(depth bonus active)' : ''}`,
        `  ▸ SENTINELS ON SONAR: ${newSentCount}  [${sentChange}]`,
        '',
        inSafe
          ? '  Shallow water: sentinels lose your signal, broadcast array boosted.'
          : inDanger
          ? '  Deep water: more sentinels detect you — signal degraded.'
          : '  Neutral depth. Standard detection range.',
      ]);
    },
  });

  registry.register('charge', {
    description: 'Charge the EMP to 100% — costs Trinity HP & stress',
    usage: 'charge',
    category: 'ship',
    handler: (_args: string[], state: GameStateSlice) => {
      if (state.ship.empCharge >= 100) {
        return info(['EMP already at 100%. Use "emp" to discharge.']);
      }
      if (state.ship.empCharging) {
        return warn([`EMP charge already in progress... ${Math.round(state.ship.empCharge)}%`]);
      }

      const trinity = state.agents.trinity;
      if (trinity.health <= 0) {
        return err('Trinity is non-operational. Cannot charge EMP.');
      }

      // Apply biometric cost to Trinity immediately
      const newHealth = Math.max(1, trinity.health - 10);
      const newFatigue = Math.min(100, trinity.fatigue + 20);
      state.updateAgent('trinity', { health: newHealth, fatigue: newFatigue });
      state.updateShip({ empCharging: true });
      state.setInputEnabled(false);
      state.setTrinityShock(Date.now());
      state.addEvent('emp_charge', 'EMP charge sequence initiated — Trinity biometrics stressed.', 'warning');

      // Animated charge sequence — one line per 10% step
      const STEPS = 10;
      const STEP_MS = 220;
      for (let i = 1; i <= STEPS; i++) {
        setTimeout(() => {
          const pct = i * 10;
          const bar = '█'.repeat(i) + '░'.repeat(10 - i);
          state.addTerminalLine(
            `  ▸ CHARGING  [${bar}] ${pct}%`,
            i < STEPS ? 'warning' : 'success',
          );
          if (i === STEPS) {
            state.updateShip({ empCharge: 100, empCharging: false });
            state.addTerminalLine('', undefined);
            state.addTerminalLine('  ✓ EMP FULLY CHARGED — 100%', 'success');
            state.addTerminalLine('  Type "emp" to discharge.', 'success');
            state.addTerminalLine('', undefined);
            state.addTerminalLine('  !! TRINITY BIOMETRIC IMPACT !!', 'warning');
            state.addTerminalLine(
              `  HP: ${newHealth}%  |  STRESS: ${newFatigue}%  |  BPM & EKG ELEVATED`,
              'warning',
            );
            state.addEvent('emp_charged', 'EMP fully charged and ready to fire.', 'info');
            state.setInputEnabled(true);
          }
        }, i * STEP_MS);
      }

      return ok([
        '>> EMP CHARGE SEQUENCE INITIATED <<',
        '',
        '  Routing capacitor discharge through Trinity\'s neural link...',
        '  !! BIOMETRIC COST: HP -10% / STRESS +20%',
        '',
      ], 'warning');
    },
  });

  // =========================================================================
  // HACK / OVERRIDE / BREACH COMMANDS
  // =========================================================================

  registry.register('hack', {
    description: 'Hack a system element (camera, panel, door). Usage: hack <label>',
    usage: 'hack <element-label>',
    category: 'tactical',
    aliases: ['override', 'breach'],
    handler: (args: string[], state: GameStateSlice) => {
      if (args.length < 1) {
        return err('Usage: hack <element-label>  (e.g. hack CAM-1)');
      }

      const targetLabel = args.join(' ').toUpperCase();
      const element = state.hackableElements.find(
        (el) => el.label.toUpperCase() === targetLabel || el.id.toUpperCase().includes(targetLabel),
      );

      if (!element) {
        const available = listHackableElements(state.hackableElements);
        return err([`Element "${targetLabel}" not found.`, '', 'Available:', ...available].join('\n'));
      }

      if (element.state !== 'active') {
        return warn([`[${element.label}] Already ${element.state}.`]);
      }

      const resultLines = executeOperatorHack(element, state);
      const success = !resultLines[0]?.includes('ALARM');

      // Narrative missions: notify orchestrator of hack so it can advance the beat
      if (success && state.mission?.type === 'trinitys_escape') {
        void callOrchestrator(`hack ${element.label}`, false);
      }

      return success ? info(resultLines) : { output: resultLines, className: 'warning' };
    },
  });

  registry.register('systems', {
    description: 'List hackable systems in the current mission',
    usage: 'systems',
    category: 'tactical',
    aliases: ['panels', 'cameras'],
    handler: (_args: string[], state: GameStateSlice) => {
      if (!state.mission) {
        return warn(['No active mission.']);
      }
      const lines = [
        '╔══════════════════════════════════════╗',
        '║  HACKABLE SYSTEMS — CURRENT MISSION  ║',
        '╠══════════════════════════════════════╣',
        ...listHackableElements(state.hackableElements),
        '╚══════════════════════════════════════╝',
        '',
        'Use: hack <label>',
      ];
      return info(lines);
    },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function fireEmpNow(state: GameStateSlice): CommandResult {
  // sentinel count comes directly from ship state — single source of truth
  const totalSentinels = state.ship.sentinelCount;
  const origDistM      = state.ship.sentinelDistance;
  const depth          = state.ship.depth;

  // Kill chance scales with depth — deeper = EMP blast better contained
  const killChance = depthEmpKillChance(depth);
  const killPct    = Math.round(killChance * 100);
  const depthBonus = depth > 3;

  let killed   = 0;
  let survived = 0;
  for (let i = 0; i < totalSentinels; i++) {
    if (Math.random() < killChance) killed++;
    else survived++;
  }

  // Survivors stay at current distance; kills push the swarm back
  const newDistM    = Math.min(1200, origDistM + killed * 220);
  const newCount    = survived;
  const baseUpdated = fireEmp(state.ship);
  const updated     = { ...baseUpdated, sentinelDistance: newDistM, sentinelCount: newCount };
  state.updateShip(updated);

  // EMP discharge spikes broadcast array and matrix feed for 2s
  const spikeShip = useGameStore.getState().ship;
  state.updateShip({
    broadcastArray: { ...spikeShip.broadcastArray, level: 95 },
    matrixFeed:     { ...spikeShip.matrixFeed,     level: 95 },
  });
  setTimeout(() => {
    const s = useGameStore.getState();
    const factor = depthSignalFactor(s.ship.depth);
    s.updateShip({
      broadcastArray: { ...s.ship.broadcastArray, level: Math.round(s.ship.broadcastArray.maxLevel * factor) },
      matrixFeed:     { ...s.ship.matrixFeed,     level: Math.min(90, s.ship.matrixFeed.level) },
    });
  }, 2000);

  // Kill jacked-in agents
  const jackedIn = getJackedInAgents(state.agents);
  for (const name of jackedIn) {
    state.updateAgent(name, { status: 'dead', health: 0 });
    state.addScore(SCORE_VALUES.agentKilled);
    state.addEvent('agent_killed', `${name} killed by EMP discharge.`, 'critical');
  }

  // EMP discharge shocks Trinity — biometric jolt
  const trinity    = state.agents.trinity;
  const empHealth  = Math.max(1, trinity.health - 8);
  const empFatigue = Math.min(100, trinity.fatigue + 15);
  state.updateAgent('trinity', { health: empHealth, fatigue: empFatigue });
  state.setTrinityShock(Date.now());

  // Trigger proximity sonar EMP pulse animation
  state.setEmpFired(true);

  state.addScore(SCORE_VALUES.empFired);
  state.addEvent(
    'emp_fired',
    `EMP discharged. ${killed}/${totalSentinels} sentinel(s) neutralized.`,
    'critical',
  );

  const lines = [
    '',
    '  ╔═══════════════════════════════════════╗',
    '  ║                                       ║',
    '  ║    ⚡  E M P   D I S C H A R G E  ⚡ ║',
    '  ║                                       ║',
    '  ╚═══════════════════════════════════════╝',
    '',
    `  PROXIMITY SONAR: ${totalSentinels} sentinel(s) detected in range`,
    `  Depth: ${depth.toFixed(1)} km  |  EMP kill probability: ${killPct}%${depthBonus ? ' (depth bonus ✓)' : ''}`,
    '',
    `  ✓ NEUTRALIZED : ${killed} sentinel(s) — contact lost`,
    `  ✗ SURVIVED    : ${survived} sentinel(s) — still closing`,
    '',
    `  Sentinel distance: ${Math.round(origDistM)}m → ${Math.round(newDistM)}m`,
    '',
    '  !! TRINITY BIOMETRIC SHOCK !!',
    `  HP: ${empHealth}%  |  STRESS: ${empFatigue}%  |  EKG SPIKING`,
    '',
    '  ▸ BROADCAST ARRAY : SPIKE 95% — decays in 2s',
    '  ▸ MATRIX FEED     : SPIKE 95% — decays in 2s',
  ];

  if (jackedIn.length > 0) {
    lines.push('');
    lines.push(`  !! ${jackedIn.length} agent(s) killed by EMP: ${jackedIn.join(', ')} !!`);
  }

  // Mission completion check
  if (state.mission && state.mission.type === 'ship_defense' && killed > 0) {
    state.completeMission();
    state.addScore(SCORE_VALUES.missionComplete);
    lines.push('');
    lines.push('  >> SENTINEL SWARM NEUTRALIZED — MISSION COMPLETE <<');
  }

  return ok(lines, 'warning');
}
