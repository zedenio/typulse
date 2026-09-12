import type { FinalStats } from "./engine";
import { MODE_LIST, type ModeId } from "./modes";

/** Aggregate counters for a single mode (or the lifetime total). */
export interface StatBucket {
  games: number;
  score: number;        // cumulative
  bestScore: number;
  words: number;
  correctKeys: number;
  wrongKeys: number;
  seconds: number;      // active play time
  bestCombo: number;
  bestWpm: number;
  bestAcc: number;
  bestLevel: number;
  bestWords: number;
  /** Fastest single word ever typed, in WPM. */
  bestWordWpm: number;
}

export interface StatsData {
  v: 1;
  total: StatBucket;
  modes: Record<ModeId, StatBucket>;
  firstPlayed: number;
  lastPlayed: number;
  /** Rolling log of recent runs for the sparkline/history. */
  recent: RunRecord[];
}

export interface RunRecord {
  mode: ModeId;
  score: number;
  wpm: number;
  acc: number;
  combo: number;
  words: number;
  date: number;
}

const KEY = "typulse.stats.v1";
/** Pre-rename keys; read once so existing players keep their stats. */
const LEGACY_KEYS = ["clackwave.stats.v1", "typeblitz.stats.v1"];
const MAX_RECENT = 20;

function emptyBucket(): StatBucket {
  return {
    games: 0, score: 0, bestScore: 0, words: 0,
    correctKeys: 0, wrongKeys: 0, seconds: 0,
    bestCombo: 0, bestWpm: 0, bestAcc: 0, bestLevel: 0, bestWords: 0,
    bestWordWpm: 0,
  };
}

function emptyModes(): Record<ModeId, StatBucket> {
  const m = {} as Record<ModeId, StatBucket>;
  for (const def of MODE_LIST) m[def.id] = emptyBucket();
  return m;
}

export function emptyStats(): StatsData {
  return {
    v: 1,
    total: emptyBucket(),
    modes: emptyModes(),
    firstPlayed: 0,
    lastPlayed: 0,
    recent: [],
  };
}

/** Merge a possibly-partial stored bucket onto a fresh one. */
function hydrateBucket(raw: unknown): StatBucket {
  const b = emptyBucket();
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(b) as (keyof StatBucket)[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v)) b[k] = v;
    }
  }
  return b;
}

export function loadStats(): StatsData {
  try {
    const raw = localStorage.getItem(KEY)
      ?? LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) return emptyStats();
    const p = JSON.parse(raw) as Partial<StatsData>;
    const out = emptyStats();
    out.total = hydrateBucket(p.total);
    for (const def of MODE_LIST) {
      out.modes[def.id] = hydrateBucket(p.modes?.[def.id]);
    }
    out.firstPlayed = typeof p.firstPlayed === "number" ? p.firstPlayed : 0;
    out.lastPlayed = typeof p.lastPlayed === "number" ? p.lastPlayed : 0;
    out.recent = Array.isArray(p.recent) ? p.recent.slice(0, MAX_RECENT) : [];
    return out;
  } catch {
    return emptyStats();
  }
}

function saveStats(s: StatsData): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

function applyRun(b: StatBucket, r: FinalStats): void {
  b.games += 1;
  b.score += r.score;
  b.words += r.cleared;
  b.correctKeys += r.correctKeys;
  b.wrongKeys += r.wrongKeys;
  b.seconds += r.seconds;
  if (r.score > b.bestScore) b.bestScore = r.score;
  if (r.maxCombo > b.bestCombo) b.bestCombo = r.maxCombo;
  if (r.wpm > b.bestWpm) b.bestWpm = r.wpm;
  if (r.acc > b.bestAcc) b.bestAcc = r.acc;
  if (r.level > b.bestLevel) b.bestLevel = r.level;
  if (r.cleared > b.bestWords) b.bestWords = r.cleared;
  if (r.bestWordWpm > b.bestWordWpm) b.bestWordWpm = r.bestWordWpm;
}

/** Fold a finished run into the persisted stats and return the new snapshot. */
export function recordRun(mode: ModeId, r: FinalStats): StatsData {
  const s = loadStats();
  applyRun(s.total, r);
  applyRun(s.modes[mode] ?? (s.modes[mode] = emptyBucket()), r);
  const now = Date.now();
  if (!s.firstPlayed) s.firstPlayed = now;
  s.lastPlayed = now;
  s.recent.unshift({
    mode, score: r.score, wpm: r.wpm, acc: r.acc,
    combo: r.maxCombo, words: r.cleared, date: now,
  });
  s.recent = s.recent.slice(0, MAX_RECENT);
  saveStats(s);
  return s;
}

export function resetStats(): StatsData {
  const s = emptyStats();
  saveStats(s);
  return s;
}

/* ---------------- derived values ---------------- */

/** Average WPM across all recorded play time. */
export function avgWpm(b: StatBucket): number {
  if (b.seconds <= 0) return 0;
  return Math.round((b.correctKeys / 5) / (b.seconds / 60));
}

export function avgAcc(b: StatBucket): number {
  const k = b.correctKeys + b.wrongKeys;
  if (k <= 0) return 0;
  return Math.round((b.correctKeys / k) * 100);
}

export function avgScore(b: StatBucket): number {
  if (b.games <= 0) return 0;
  return Math.round(b.score / b.games);
}

export function formatPlaytime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

/** Letter grade for a finished run, based on accuracy. */
export function rankFor(acc: number, cleared: number): { letter: string; hex: string } {
  if (cleared < 3) return { letter: "D", hex: "#8b8f9a" };
  if (acc >= 97) return { letter: "S", hex: "#f5b801" };
  if (acc >= 93) return { letter: "A", hex: "#2f6fe4" };
  if (acc >= 87) return { letter: "B", hex: "#1fa755" };
  if (acc >= 78) return { letter: "C", hex: "#7b4fd6" };
  return { letter: "D", hex: "#8b8f9a" };
}
