// ---------------------------------------------------------------------------
// Matrix Operator – LocalStorage Helpers
// ---------------------------------------------------------------------------

const SAVE_KEY = 'matrix-operator-save';
const HIGH_SCORES_KEY = 'matrix-operator-highscores';
const DAILY_RESULTS_KEY = 'matrix-operator-daily';

// ---------------------------------------------------------------------------
// Game state persistence
// ---------------------------------------------------------------------------

export interface SaveableState {
  totalScore: number;
  rank: { level: number; title: string; pointsRequired: number };
  agents: Record<string, unknown>;
  missionCount: number;
  completedMissions: number;
  ship: Record<string, unknown>;
  tickCount: number;
  savedAt: number;
}

export function saveGameState(state: SaveableState): boolean {
  try {
    const data = { ...state, savedAt: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGameState(): SaveableState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveableState;
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// High scores
// ---------------------------------------------------------------------------

export interface HighScoreEntry {
  score: number;
  rank: string;
  date: string;
  missions: number;
}

export function saveHighScore(score: number, rank: string, missions: number = 0): void {
  try {
    const existing = getHighScores();
    const entry: HighScoreEntry = {
      score,
      rank,
      date: new Date().toISOString().split('T')[0],
      missions,
    };
    existing.push(entry);
    existing.sort((a, b) => b.score - a.score);
    const top10 = existing.slice(0, 10);
    localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(top10));
  } catch {
    // Ignore
  }
}

export function getHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(HIGH_SCORES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HighScoreEntry[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Daily challenge results
// ---------------------------------------------------------------------------

export interface DailyResult {
  date: string;
  score: number;
  rank: string;
  completed: boolean;
}

export function saveDailyResult(date: string, score: number, rank: string = ''): void {
  try {
    const existing = getDailyResults();
    const entry: DailyResult = {
      date,
      score,
      rank,
      completed: true,
    };
    // Replace existing entry for the same date
    const filtered = existing.filter((e) => e.date !== date);
    filtered.push(entry);
    // Keep last 30 days
    const sorted = filtered.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    localStorage.setItem(DAILY_RESULTS_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore
  }
}

export function getDailyResults(): DailyResult[] {
  try {
    const raw = localStorage.getItem(DAILY_RESULTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DailyResult[];
  } catch {
    return [];
  }
}
