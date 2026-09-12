export type ModeId = "easy" | "normal" | "hard" | "expert";

export interface ModeDef {
  id: ModeId;
  label: string;
  tagline: string;
  detail: string;
  color: string;
  /** Ring lifetime multiplier — bigger means the circle closes slower. */
  life: number;
  /** Spawn-interval multiplier — bigger means words arrive slower. */
  spawn: number;
  /** Virtual level offset: harder modes start deeper on the difficulty curve. */
  boost: number;
  /** Max simultaneous words cap. */
  cap: number;
  /** Score multiplier. */
  score: number;
  /** Approach-ring travel distance multiplier (visual warning time). */
  ring: number;
  /** Starting lives. */
  lives: number;
  /**
   * Fairness floor — the fastest sustained typing speed (characters/second)
   * the mode is ever allowed to demand. Keeps deep levels brutal but human.
   */
  maxCps: number;
  /** Fairness floor — seconds granted to read and lock onto a new word. */
  react: number;
}

export const MODES: Record<ModeId, ModeDef> = {
  easy: {
    id: "easy",
    label: "EASY",
    tagline: "Slow rings, chill pace",
    detail: "Rings close at ~1.5× time · shorter words · score ×0.7",
    color: "#1fa755",
    life: 1.55,
    spawn: 1.35,
    boost: 0,
    cap: 4,
    score: 0.7,
    ring: 1.25,
    lives: 3,
    maxCps: 2.2,
    react: 1.2,
  },
  normal: {
    id: "normal",
    label: "NORMAL",
    tagline: "The classic blitz",
    detail: "Standard ring timing · full speedwords · score ×1.0",
    color: "#2f6fe4",
    life: 1,
    spawn: 1,
    boost: 1,
    cap: 6,
    score: 1,
    ring: 1,
    lives: 3,
    maxCps: 3.6,
    react: 0.9,
  },
  hard: {
    id: "hard",
    label: "HARD",
    tagline: "Rings slam shut",
    detail: "Rings close ~40% faster · big words early · score ×1.6",
    color: "#e8472f",
    life: 0.62,
    spawn: 0.72,
    boost: 3,
    cap: 7,
    score: 1.6,
    ring: 0.82,
    lives: 3,
    maxCps: 5.0,
    react: 0.65,
  },
  expert: {
    // Exactly 2× Hard: half the ring time, double the payout.
    id: "expert",
    label: "EXPERT",
    tagline: "2× Hard. Only 2 lives.",
    detail: "Rings close 2× faster than Hard · 2 lives · score ×3.2",
    color: "#7b4fd6",
    life: 0.31,   // hard 0.62 ÷ 2
    spawn: 0.5,
    boost: 6,
    cap: 8,
    score: 3.2,   // hard 1.6 × 2
    ring: 0.6,
    lives: 2,
    maxCps: 7.0,
    react: 0.45,
  },
};

export const MODE_LIST: ModeDef[] = [MODES.easy, MODES.normal, MODES.hard, MODES.expert];
