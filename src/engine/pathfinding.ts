// ---------------------------------------------------------------------------
// Matrix Operator – A* Pathfinding
// ---------------------------------------------------------------------------

import type { GameMap, HackableElement, Position } from './types';
import { isWalkable } from './agent-manager';

interface AStarNode {
  pos: Position;
  g: number; // cost from start
  h: number; // heuristic (Manhattan distance to goal)
  f: number; // g + h
  parent: AStarNode | null;
}

function posKey(p: Position): string {
  return `${p.x},${p.y}`;
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const DIRS: Position[] = [
  { x: 0, y: -1 }, // north
  { x: 0, y: 1 },  // south
  { x: -1, y: 0 }, // west
  { x: 1, y: 0 },  // east
];

/**
 * A* pathfinding from `start` to `goal` on the given map.
 * Returns an array of Positions (excluding start, including goal).
 * Returns empty array if no path exists.
 */
export function findPath(
  start: Position,
  goal: Position,
  map: GameMap,
  hackableElements: HackableElement[],
): Position[] {
  if (start.x === goal.x && start.y === goal.y) return [];

  const openSet = new Map<string, AStarNode>();
  const closedSet = new Set<string>();

  const startNode: AStarNode = {
    pos: { ...start },
    g: 0,
    h: manhattan(start, goal),
    f: manhattan(start, goal),
    parent: null,
  };
  openSet.set(posKey(start), startNode);

  while (openSet.size > 0) {
    // Find node with lowest f
    let current: AStarNode | null = null;
    for (const node of openSet.values()) {
      if (!current || node.f < current.f || (node.f === current.f && node.h < current.h)) {
        current = node;
      }
    }
    if (!current) break;

    // Reached goal
    if (current.pos.x === goal.x && current.pos.y === goal.y) {
      const path: Position[] = [];
      let node: AStarNode | null = current;
      while (node && node.parent) {
        path.unshift({ ...node.pos });
        node = node.parent;
      }
      return path;
    }

    const currentKey = posKey(current.pos);
    openSet.delete(currentKey);
    closedSet.add(currentKey);

    // Expand neighbors
    for (const dir of DIRS) {
      const neighbor: Position = {
        x: current.pos.x + dir.x,
        y: current.pos.y + dir.y,
      };
      const neighborKey = posKey(neighbor);

      if (closedSet.has(neighborKey)) continue;
      if (!isWalkable(map, neighbor, hackableElements)) continue;

      const g = current.g + 1;
      const existing = openSet.get(neighborKey);

      if (!existing || g < existing.g) {
        const h = manhattan(neighbor, goal);
        const node: AStarNode = {
          pos: neighbor,
          g,
          h,
          f: g + h,
          parent: current,
        };
        openSet.set(neighborKey, node);
      }
    }
  }

  return []; // No path found
}

/**
 * Get positions within a given Manhattan distance radius.
 */
export function getTilesInRadius(center: Position, radius: number, map: GameMap): Position[] {
  const tiles: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const x = center.x + dx;
      const y = center.y + dy;
      if (x >= 0 && y >= 0 && x < map.width && y < map.height) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/**
 * Compute a path for directional movement ("move right", "move north 3", etc.).
 * Moves in the given direction for `steps` tiles (or until wall if steps is Infinity).
 */
export function computeDirectionalPath(
  start: Position,
  direction: 'north' | 'south' | 'east' | 'west',
  steps: number,
  map: GameMap,
  hackableElements: HackableElement[],
): Position[] {
  const dirMap: Record<string, Position> = {
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
  };
  const dir = dirMap[direction];
  const path: Position[] = [];
  let current = { ...start };

  const maxSteps = steps === Infinity ? map.width + map.height : steps;

  for (let i = 0; i < maxSteps; i++) {
    const next: Position = { x: current.x + dir.x, y: current.y + dir.y };
    if (!isWalkable(map, next, hackableElements)) break;
    path.push({ ...next });
    current = next;
  }

  return path;
}
