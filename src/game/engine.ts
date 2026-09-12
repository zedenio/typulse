import { WordBag } from "./words";
import { sfx } from "./audio";
import { MODES, type ModeDef } from "./modes";

export interface HudState {
  score: number; combo: number; mult: number; lives: number; maxLives: number;
  acc: number; level: number; cleared: number;
  /** Signed value of the most recent score change: +gain / -loss. */
  lastGain: number;
}
export interface FinalStats {
  score: number; acc: number; maxCombo: number; cleared: number; keys: number;
  correctKeys: number; wrongKeys: number;
  /** Points deducted by mistyped keys. */
  lost: number;
  /** Fastest single word typed this run, in WPM. */
  bestWordWpm: number;
  /** Active play time in seconds (paused time excluded). */
  seconds: number;
  /** Words-per-minute, standard 5-chars-per-word definition. */
  wpm: number;
  level: number;
}
export type EngineEvent =
  | { type: "gameover"; stats: FinalStats }
  | { type: "lifeLost" }
  | { type: "toast"; text: string; kind: "info" | "gold" | "danger" };

interface Callbacks {
  onHud(h: HudState): void;
  onEvent(e: EngineEvent): void;
}

type WordState = "alive" | "dying" | "boom";

interface WordEnt {
  id: number;
  text: string;
  x: number; y: number;
  life: number; maxLife: number;
  typed: number;
  state: WordState;
  t: number;            // time in current anim state
  wob: number;          // wobble phase
  sprite: HTMLCanvasElement | null;
  /** Same glyphs in the "typed" colour; revealed by clipping. */
  spriteTyped: HTMLCanvasElement | null;
  sw: number; sh: number; // sprite css size
  adv: number;          // mono advance
  spad: number;
  px: number;
  baseR: number;
  /** playTime at the first keystroke, for measuring real typing speed. */
  typeStart: number;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 0 | 1; }
interface RingFx { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string; lw: number; }
interface Popup { x: number; y: number; txt: string; life: number; max: number; size: number; color: string; vy: number; }

/* ---------- flat palette ---------- */
const PAPER = "#f5f0e6";
const INK = "#1d2330";
const BLUE = "#2f6fe4";
const RED = "#e8472f";
const AMBER = "#c07c00";
const GREEN = "#1fa755";
const PURPLE = "#7b4fd6";

const TIER_COLORS = [BLUE, GREEN, AMBER, PURPLE, RED, "#ff6b4a", "#0fa3b1", "#d6457f"];
const BOOM_DUR = 0.42;
const DYING_DUR = 0.3;
function hexRgb(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a: string, b: string, t: number): string {
  const x = hexRgb(a), y = hexRgb(b);
  const r = (x[0] + (y[0] - x[0]) * t) | 0;
  const g = (x[1] + (y[1] - x[1]) * t) | 0;
  const bl = (x[2] + (y[2] - x[2]) * t) | 0;
  return `rgb(${r},${g},${bl})`;
}

/** Typing speed (WPM) that earns a full 1x speed bonus. */
const PAR_WPM = 55;
/** Ceiling on the speed multiplier (reached at PAR_WPM * this). */
const SPEED_CAP = 3.5;

/** Flavour label + colour for how fast a single word was typed. */
function speedTier(wpm: number): { label: string; color: string } {
  if (wpm >= 110) return { label: "BLAZING", color: AMBER };
  if (wpm >= 85) return { label: "SUPERB", color: PURPLE };
  if (wpm >= 60) return { label: "FAST", color: GREEN };
  if (wpm >= 40) return { label: "GOOD", color: BLUE };
  return { label: "", color: INK };
}

function easeOutBack(t: number): number {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
function easeOut(t: number): number { return 1 - (1 - t) * (1 - t); }
function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mctx: CanvasRenderingContext2D;
  private cb: Callbacks;

  private w = 0; private h = 0; private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private wordPx = 28;
  private topPad = 96;

  private raf = 0;
  private lastT = 0;
  private running = false;
  private dead = false;
  private time = 0;

  state: "idle" | "playing" | "over" = "idle";
  paused = false;
  touchMode = false;
  private mode: ModeDef = MODES.normal;

  private words: WordEnt[] = [];
  private nextId = 1;
  private target: WordEnt | null = null;
  private spawnT = 0;
  /** Freshly shuffled every run so no two sessions play the same words. */
  private bag = new WordBag();

  private score = 0; private combo = 0; private maxCombo = 0; private mult = 1;
  private lives = 3; private cleared = 0; private correctKeys = 0; private wrongKeys = 0;
  private level = 1;

  private particles: Particle[] = [];
  private rings: RingFx[] = [];
  private popups: Popup[] = [];

  private trauma = 0;
  private errorFlash = 0;
  private bigFlash = 0;
  private overT = 0;
  private timeScale = 1;
  /** Active seconds spent playing this run (pauses excluded). */
  private playTime = 0;
  /**
   * Continuous difficulty. Eases toward `diffTarget` every frame so the ring
   * tightens gradually instead of lurching at level boundaries.
   */
  private diffSmooth = 0;
  /** Running total of points lost to mistyped keys. */
  private pointsLost = 0;
  /** Fastest single word this run (WPM). */
  private bestWordWpm = 0;
  /** Signed value of the most recent score change. */
  private lastGain = 0;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.mctx = document.createElement("canvas").getContext("2d")!;
    this.cb = cb;
    for (let i = 0; i < 480; i++) {
      this.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: "#fff", kind: 0 });
    }
  }

  /* ---------------- lifecycle ---------------- */

  resize(w: number, h: number, dpr: number) {
    if (w <= 0 || h <= 0) return;
    const rw = this.w > 0 ? w / this.w : 1;
    const rh = this.h > 0 ? h / this.h : 1;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.wordPx = clamp(Math.round(Math.min(w, h) * 0.052), 20, 34);
    for (const wd of this.words) {
      wd.x = clamp(wd.x * rw, 20, w - 20);
      wd.y = clamp(wd.y * rh, this.topPad, h - 30);
      this.buildSprite(wd);
    }
    this.buildBg();
  }

  begin(mode?: ModeDef) {
    if (mode) this.mode = mode;
    this.bag = new WordBag(); // reshuffle the whole dictionary for this run
    this.state = "playing";
    this.paused = false;
    this.timeScale = 1;
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.mult = 1;
    this.lives = this.mode.lives; this.cleared = 0; this.correctKeys = 0; this.wrongKeys = 0;
    this.level = 1;
    this.words = [];
    this.target = null;
    this.rings = [];
    this.popups = [];
    this.trauma = 0; this.errorFlash = 0; this.bigFlash = 0;
    this.playTime = 0;
    this.diffSmooth = 0;
    this.pointsLost = 0;
    this.bestWordWpm = 0;
    this.lastGain = 0;
    for (const p of this.particles) p.life = 0;
    // First word: front and center so the fun starts instantly.
    this.spawn(clamp(this.w * 0.5 + (Math.random() - 0.5) * 80, 120, this.w - 120), this.h * (this.touchMode ? 0.3 : 0.42));
    this.spawnT = 1.35 * this.mode.spawn;
    this.pushPopup(this.w / 2, this.h * (this.touchMode ? 0.18 : 0.26), "TYPE!", this.mode.color, clamp(this.wordPx * 1.3, 26, 44));
    this.emitHud();
    this.startLoop();
  }

  pause() {
    if (this.state !== "playing") return;
    this.paused = true;
    this.stopLoop();
  }

  resume() {
    if (this.state !== "playing") return;
    this.paused = false;
    this.startLoop();
  }

  destroy() {
    this.dead = true;
    this.stopLoop();
  }

  /* ---------------- input ---------------- */

  handleChar(raw: string) {
    if (this.state !== "playing" || this.paused) return;
    const c = raw.toLowerCase();
    if (c < "a" || c > "z") return;

    const t = this.target;
    if (t && t.state === "alive") {
      if (c === t.text[t.typed]) {
        this.correctKeys++;
        t.typed++;
        sfx.tick(t.typed);
        this.keystrokeSparks(t);
        if (t.typed >= t.text.length) this.completeWord(t);
      } else {
        this.wrongKey();
      }
      this.emitHud();
      return;
    }

    // Acquire a new target: most urgent word starting with this letter.
    let best: WordEnt | null = null;
    for (const wd of this.words) {
      if (wd.state !== "alive" || wd.text[0] !== c) continue;
      if (!best || wd.life < best.life) best = wd;
    }
    if (best) {
      this.correctKeys++;
      this.target = best;
      best.typed = 1;
      best.typeStart = this.playTime;
      sfx.tick(1);
      this.keystrokeSparks(best);
      if (best.typed >= best.text.length) this.completeWord(best);
    } else {
      this.wrongKey();
    }
    this.emitHud();
  }

  private wrongKey() {
    this.wrongKeys++;
    // Mistypes cost points, scaled by the mode's payout so risk tracks reward.
    const penalty = Math.round(25 * this.mode.score);
    const applied = Math.min(penalty, this.score); // never go negative
    this.score -= applied;
    this.pointsLost += applied;

    this.lastGain = -applied;

    const t = this.target;
    const px = t ? t.x : this.w / 2;
    const py = t ? t.y - t.baseR * 0.45 : this.h * 0.32;
    // Show the amount actually deducted — never claim a loss that didn't happen.
    if (applied > 0) {
      this.pushPopup(px, py, `-${applied}`, RED, clamp(this.wordPx * 0.6, 14, 20));
    }
    this.burst(px, py, 8, [RED], 150);

    if (this.combo >= 5) this.cb.onEvent({ type: "toast", text: "COMBO LOST", kind: "danger" });
    this.combo = 0; this.mult = 1;
    this.errorFlash = 0.3;
    this.addTrauma(0.14);
    sfx.error();
  }

  /** Continuous effective difficulty used for ring timing and spawn cadence. */
  private effLevel(): number {
    return 1 + this.diffSmooth + this.mode.boost;
  }

  private completeWord(wd: WordEnt) {
    const frac = clamp(wd.life / wd.maxLife, 0, 1);
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const newMult = Math.min(8, 1 + Math.floor(this.combo / 6));
    if (newMult !== this.mult) {
      this.mult = newMult;
      this.cb.onEvent({ type: "toast", text: `×${newMult} MULTIPLIER`, kind: "gold" });
      sfx.multiplier();
    }
    // --- speed-based scoring -------------------------------------------
    // Measure how fast the word was actually typed: first keystroke to last.
    // playTime excludes pauses, so pausing mid-word can't inflate the bonus.
    const len = wd.text.length;
    const dur = Math.max(0.08, this.playTime - wd.typeStart);
    // The span covers first->last keystroke, i.e. (len - 1) intervals. Using
    // len here would make short words look unfairly fast, so use the gaps.
    const cps = Math.min((len - 1) / dur, 20);     // cap beyond human limits
    const wordWpm = Math.round(cps * 12);          // 5 chars == 1 word
    if (wordWpm > this.bestWordWpm) this.bestWordWpm = wordWpm;

    const base = len * 6;
    // PAR_WPM earns a 1x bonus; typing faster scales the bonus up to SPEED_CAP,
    // so a blazing run pays roughly 3.5x what a plodding one does.
    const speedRatio = clamp(wordWpm / PAR_WPM, 0.2, SPEED_CAP);
    const speedBonus = Math.round(base * speedRatio * 1.8);
    const urgency = Math.round(35 * frac);         // reward reacting early too
    const pts = Math.round((base + speedBonus + urgency) * this.mult * this.mode.score);
    this.score += pts;
    this.lastGain = pts;
    this.cleared++;

    const tier = Math.min(this.mult - 1, 7);
    const color = TIER_COLORS[tier];
    wd.state = "dying"; wd.t = 0;
    if (this.target === wd) this.target = null;
    this.pushRing(wd.x, wd.y, wd.baseR, wd.baseR * 2.1, color, DYING_DUR + 0.12);

    const sp = speedTier(wordWpm);
    this.pushPopup(wd.x, wd.y - wd.baseR * 0.5, `+${pts}`, sp.color, clamp(this.wordPx * 0.62, 15, 21));
    if (sp.label) {
      this.pushPopup(wd.x, wd.y - wd.baseR * 0.5 - this.wordPx * 0.95,
        `${sp.label} ${wordWpm}`, sp.color, clamp(this.wordPx * 0.46, 12, 16));
    }
    this.burst(wd.x, wd.y, Math.min(30 + this.combo, 62), [color, INK, this.mode.color], 320);
    this.addTrauma(0.24);
    sfx.complete(tier);

    const lvl = 1 + Math.floor(this.cleared / 8);
    if (lvl !== this.level) {
      this.level = lvl;
      this.cb.onEvent({ type: "toast", text: `LEVEL ${lvl}`, kind: "info" });
      sfx.multiplier();
    }
  }

  private expireWord(wd: WordEnt) {
    if (this.state !== "playing") return;
    wd.state = "boom"; wd.t = 0;
    if (this.target === wd) this.target = null;
    this.lives--;
    if (this.combo >= 5) this.cb.onEvent({ type: "toast", text: "COMBO LOST", kind: "danger" });
    this.combo = 0; this.mult = 1;
    this.pushRing(wd.x, wd.y, wd.baseR, wd.baseR * 0.15, RED, BOOM_DUR);
    this.pushRing(wd.x, wd.y, wd.baseR * 0.5, wd.baseR * 1.9, RED, BOOM_DUR + 0.1);
    this.pushPopup(wd.x, wd.y, "-1 LIFE", RED, clamp(this.wordPx * 0.6, 14, 20));
    this.burst(wd.x, wd.y, 44, [RED, AMBER, INK], 420);
    this.bigFlash = 0.6;
    this.addTrauma(0.7);
    sfx.explode();
    this.cb.onEvent({ type: "lifeLost" });
    if (this.lives <= 0) this.gameOver();
    this.emitHud();
  }

  private gameOver() {
    this.state = "over";
    this.overT = 0;
    this.addTrauma(1);
    sfx.gameOver();
    for (const wd of this.words) {
      if (wd.state === "alive") {
        wd.state = "boom"; wd.t = -Math.random() * 0.25; // slight stagger
        this.burst(wd.x, wd.y, 30, [RED, AMBER, this.mode.color], 380);
        this.pushRing(wd.x, wd.y, wd.baseR, wd.baseR * 1.7, RED, 0.55);
      }
    }
    const keys = this.correctKeys + this.wrongKeys;
    const secs = Math.max(0.001, this.playTime);
    this.cb.onEvent({
      type: "gameover",
      stats: {
        score: this.score,
        acc: keys > 0 ? Math.round((this.correctKeys / keys) * 100) : 100,
        maxCombo: this.maxCombo,
        cleared: this.cleared,
        keys,
        correctKeys: this.correctKeys,
        wrongKeys: this.wrongKeys,
        lost: this.pointsLost,
        bestWordWpm: this.bestWordWpm,
        seconds: secs,
        // Standard WPM: every 5 correctly typed characters counts as a word.
        wpm: Math.round((this.correctKeys / 5) / (secs / 60)),
        level: this.level,
      },
    });
  }

  /* ---------------- spawning ---------------- */

  private spawn(fx?: number, fy?: number) {
    const eff = this.effLevel();
    const alive = this.words.filter((w) => w.state === "alive");
    const firsts = new Set(alive.map((w) => w.text[0]));
    const text = this.bag.next(eff, firsts);
    const wd: WordEnt = {
      id: this.nextId++, text,
      x: 0, y: 0,
      life: 1, maxLife: 1,
      typed: 0, state: "alive", t: 0,
      wob: Math.random() * Math.PI * 2,
      sprite: null, spriteTyped: null, sw: 0, sh: 0, adv: 0, spad: 0, px: this.wordPx, baseR: 30,
      typeStart: 0,
    };
    this.buildSprite(wd);
    // Mode-driven ring timing. `raw` is the difficulty curve (tightens as the
    // level climbs), scaled by the mode's life multiplier. The floor guarantees
    // the word never demands more than the mode's max chars/sec plus a moment
    // to read it — so even EXPERT stays humanly possible at deep levels.
    const floor = wd.text.length / this.mode.maxCps + this.mode.react;
    const raw = (6.4 - eff * 0.34) * (0.9 + wd.text.length * 0.055) * (0.96 + Math.random() * 0.08);
    const life = clamp(raw * this.mode.life, floor, 12);
    wd.maxLife = life; wd.life = life;
    if (fx !== undefined && fy !== undefined) {
      wd.x = fx; wd.y = fy;
    } else {
      this.place(wd);
    }
    this.words.push(wd);
  }

  private place(wd: WordEnt) {
    const mx = wd.sw / 2 + 28;
    const yTop = this.topPad + 36;
    const yBot = this.h * (this.touchMode ? 0.5 : 0.78);
    let bestX = this.w / 2, bestY = (yTop + yBot) / 2, bestD = -1;
    for (let i = 0; i < 14; i++) {
      const x = mx + Math.random() * Math.max(10, this.w - mx * 2);
      const y = yTop + Math.random() * Math.max(10, yBot - yTop);
      let d = Infinity;
      for (const o of this.words) {
        if (o.state !== "alive") continue;
        const dd = Math.hypot(o.x - x, o.y - y) - o.baseR * 0.6;
        if (dd < d) d = dd;
      }
      if (d > bestD) { bestD = d; bestX = x; bestY = y; }
      if (d > 240) break;
    }
    wd.x = bestX; wd.y = bestY;
  }

  /* ---------------- sprites ---------------- */

  private buildSprite(wd: WordEnt) {
    const dpr = this.dpr;
    const px = this.wordPx;
    const pad = Math.ceil(px * 0.8);
    this.mctx.font = `800 ${px}px "JetBrains Mono", ui-monospace, monospace`;
    const adv = Math.max(this.mctx.measureText("M").width, px * 0.55);
    const w = Math.ceil(adv * wd.text.length + pad * 2);
    const h = Math.ceil(px * 1.55 + pad);
    const bw = Math.ceil(w * dpr);
    const bh = Math.ceil(h * dpr);

    // Two static layers (untyped + typed). Drawing the caret progress is a
    // clip at render time, so typing never re-rasterises anything.
    const layer = (fill: string, existing: HTMLCanvasElement | null) => {
      const cv = existing ?? document.createElement("canvas");
      // Only reallocate the backing store when the size actually changed.
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      const c = cv.getContext("2d")!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      c.font = this.mctx.font;
      c.textBaseline = "middle";
      c.textAlign = "left";
      const midY = h / 2 + px * 0.04;
      c.fillStyle = "rgba(29,35,48,0.14)";
      for (let i = 0; i < wd.text.length; i++) {
        c.fillText(wd.text[i], pad + i * adv + px * 0.1, midY + px * 0.1);
      }
      c.fillStyle = fill;
      for (let i = 0; i < wd.text.length; i++) {
        c.fillText(wd.text[i], pad + i * adv, midY);
      }
      return cv;
    };

    wd.sprite = layer(INK, wd.sprite);
    wd.spriteTyped = layer(BLUE, wd.spriteTyped);
    wd.sw = w; wd.sh = h; wd.adv = adv; wd.spad = pad; wd.px = px;
    wd.baseR = Math.max((adv * wd.text.length) / 2, px * 0.85) + px * 0.75;
  }

  /* ---------------- fx helpers ---------------- */

  private burst(x: number, y: number, n: number, colors: string[], speed: number) {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= n) break;
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const v = (0.25 + Math.random() * 0.75) * speed;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.max = p.life = 0.35 + Math.random() * 0.5;
      p.size = 1.6 + Math.random() * 2.6;
      p.color = colors[(Math.random() * colors.length) | 0];
      p.kind = Math.random() < 0.55 ? 0 : 1;
      spawned++;
    }
  }

  private keystrokeSparks(wd: WordEnt) {
    const left = wd.x - (wd.adv * wd.text.length) / 2;
    const cx = left + (wd.typed - 0.5) * wd.adv;
    const cy = wd.y - wd.px * 0.1;
    this.burst(cx, cy, 4, [BLUE], 130);
  }

  private pushRing(x: number, y: number, r0: number, r1: number, color: string, dur: number) {
    this.rings.push({ x, y, r0, r1, life: dur, max: dur, color, lw: 4 });
    if (this.rings.length > 24) this.rings.shift();
  }

  private pushPopup(x: number, y: number, txt: string, color: string, size: number) {
    this.popups.push({ x, y, txt, life: 0.9, max: 0.9, size, color, vy: -52 });
    if (this.popups.length > 20) this.popups.shift();
  }

  private addTrauma(v: number) { this.trauma = clamp(this.trauma + v, 0, 1); }

  /* ---------------- loop ---------------- */

  private startLoop() {
    if (this.running || this.dead) return;
    this.running = true;
    this.lastT = performance.now();
    const frame = (now: number) => {
      if (!this.running || this.dead) return;
      const rdt = clamp((now - this.lastT) / 1000, 0, 0.05);
      this.lastT = now;
      this.update(rdt);
      this.render();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private stopLoop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private update(rdt: number) {
    // Slow-mo on game over for drama.
    if (this.state === "over") {
      this.overT += rdt;
      this.timeScale += (0.14 - this.timeScale) * (1 - Math.exp(-rdt * 4));
    }
    const dt = rdt * this.timeScale;
    this.time += rdt;
    if (this.state === "playing" && !this.paused) {
      this.playTime += rdt;
      // Target rises with words cleared (main driver) plus a slow time term so
      // stalling never makes the run easier. 8 words == +1 level, as before.
      const target = this.cleared * 0.125 + this.playTime * 0.015;
      // Exponential ease: even a single word's step is spread over ~2.5s.
      this.diffSmooth += (target - this.diffSmooth) * (1 - Math.exp(-rdt / 2.5));
    }

    // Spawning
    if (this.state === "playing" && !this.paused) {
      const eff = this.effLevel();
      const aliveCount = this.words.reduce((n, w) => n + (w.state === "alive" ? 1 : 0), 0);
      const maxConc = Math.min(3 + Math.floor((eff - 1) / 2) + (this.mode.cap > 6 ? 1 : 0), this.mode.cap);
      if (aliveCount === 0 && this.spawnT > 0.5) this.spawnT = 0.5;
      this.spawnT -= dt;
      if (this.spawnT <= 0 && aliveCount < maxConc) {
        this.spawn();
        const interval = Math.max(0.55, Math.max(0.95, 2.15 - eff * 0.14) * this.mode.spawn);
        this.spawnT = interval * (0.75 + Math.random() * 0.5);
      }
    }

    // Words
    for (let i = this.words.length - 1; i >= 0; i--) {
      const wd = this.words[i];
      if (wd.state === "alive") {
        wd.life -= dt;
        if (wd.life <= 0) this.expireWord(wd);
      } else {
        wd.t += dt;
        const dur = wd.state === "dying" ? DYING_DUR : BOOM_DUR;
        if (wd.t >= dur) {
          if (this.target === wd) this.target = null;
          this.words.splice(i, 1);
        }
      }
    }

    // Particles
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Exponential damping is frame-rate independent, so motion is identical
      // on 60Hz and 144Hz displays.
      const k = Math.exp(-(p.kind === 0 ? 3.2 : 1.6) * dt);
      p.vx *= k;
      p.vy *= k;
      if (p.kind === 1) p.vy += 140 * dt;
    }

    // Rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }

    // Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= Math.exp(-2.4 * dt);
      if (p.life <= 0) this.popups.splice(i, 1);
    }

    this.trauma = Math.max(0, this.trauma - rdt * 1.7);
    this.errorFlash = Math.max(0, this.errorFlash - rdt * 3.2);
    this.bigFlash = Math.max(0, this.bigFlash - rdt * 1.9);
  }

  /* ---------------- render ---------------- */

  private buildBg() {
    const { w, h, dpr } = this;
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const c = cv.getContext("2d")!;
    c.scale(dpr, dpr);
    c.fillStyle = PAPER;
    c.fillRect(0, 0, w, h);
    // flat dot grid
    c.fillStyle = "rgba(29,35,48,0.08)";
    const step = 30;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        c.fillRect(x, y, 2, 2);
      }
    }
    this.bg = cv;
  }

  private render() {
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    if (this.bg) ctx.drawImage(this.bg, 0, 0, w, h);

    // Screen shake
    const amt = this.trauma * this.trauma;
    const n1 = (Math.sin(this.time * 67.3) + Math.sin(this.time * 31.7)) / 2;
    const n2 = (Math.cos(this.time * 59.1) + Math.sin(this.time * 41.3)) / 2;
    const n3 = Math.sin(this.time * 73.7);
    ctx.save();
    ctx.translate(n1 * amt * 16, n2 * amt * 16);
    if (amt > 0.002) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(n3 * amt * 0.018);
      ctx.translate(-w / 2, -h / 2);
    }

    // Ring FX (under words)
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const rad = lerp(r.r0, r.r1, easeOut(t));
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.lineWidth = r.lw * (1 - t * 0.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(1, rad), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Words
    for (const wd of this.words) this.drawWord(ctx, wd);

    // Particles — flat squares, normal blending
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 0) {
        // elongated chip along velocity
        const len = Math.hypot(p.vx, p.vy) * 0.02 + p.size;
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillRect(-len / 2, -p.size * 0.4, len, p.size * 0.8);
        ctx.restore();
      } else {
        const s = p.size * a + 0.8;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;

    // Popups — flat type with hard offset shadow
    for (const p of this.popups) {
      const t = 1 - p.life / p.max;
      const intro = clamp(t / 0.14, 0, 1);
      const scale = 0.7 + 0.3 * easeOutBack(intro);
      ctx.globalAlpha = clamp(p.life / (p.max * 0.55), 0, 1);
      ctx.font = `800 ${Math.max(10, p.size * scale)}px Unbounded, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fs = Math.max(2, p.size * 0.09);
      ctx.fillStyle = "rgba(29,35,48,0.22)";
      ctx.fillText(p.txt, p.x + fs, p.y + fs);
      ctx.fillStyle = p.color;
      ctx.fillText(p.txt, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // Full-screen flashes — solid tints
    if (this.errorFlash > 0.005) {
      ctx.fillStyle = `rgba(232,71,47,${(this.errorFlash * 0.4).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.bigFlash > 0.005) {
      ctx.fillStyle = `rgba(232,71,47,${(this.bigFlash * 0.3).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /**
   * Urgency colour: blue -> amber -> red as the ring closes. Holds each flat
   * tier for most of its range, then crossfades over a narrow band so the
   * colour glides instead of snapping.
   */
  private urgencyColor(f: number): string {
    const B = 0.06; // half-width of the crossfade band
    if (f > 0.5 + B) return BLUE;
    if (f > 0.5 - B) return mixHex(AMBER, BLUE, (f - (0.5 - B)) / (2 * B));
    if (f > 0.25 + B) return AMBER;
    if (f > 0.25 - B) return mixHex(RED, AMBER, (f - (0.25 - B)) / (2 * B));
    return RED;
  }

  private drawWord(ctx: CanvasRenderingContext2D, wd: WordEnt) {
    let x = wd.x;
    let y = wd.y;
    let alpha = 1;
    let scale = 1;
    let bobAmt = 1;

    if (wd.state === "alive") {
      // Pop in over the first 0.3s of life, easing position + alpha together.
      const intro = clamp((wd.maxLife - wd.life) / 0.3, 0, 1);
      scale = 0.62 + 0.38 * easeOutBack(intro);
      alpha = easeOut(clamp(intro * 1.4, 0, 1));
      bobAmt = intro;
    } else if (wd.state === "dying") {
      const t = clamp(wd.t / DYING_DUR, 0, 1);
      const e = easeOut(t);
      alpha = 1 - e * e;
      scale = 1 + 0.5 * e;
      y -= 24 * e;
    } else {
      // Staggered game-over blasts hold the word still until their turn,
      // instead of hiding it (which made words blink out then reappear).
      const t = clamp(Math.max(0, wd.t) / BOOM_DUR, 0, 1);
      alpha = 1 - t;
      if (wd.t >= 0) {
        // Deterministic shake: identical at any refresh rate.
        const j = (1 - t) * 7;
        x += Math.sin(this.time * 61 + wd.wob * 7) * j;
        y += Math.cos(this.time * 53 + wd.wob * 11) * j;
      }
    }

    y += Math.sin(this.time * 1.7 + wd.wob) * 3 * bobAmt;

    if (wd.state === "alive") {
      const frac = clamp(wd.life / wd.maxLife, 0, 1);
      const extra = clamp(Math.min(this.w, this.h) * 0.17, 90, 150) * this.mode.ring;
      const r = wd.baseR + extra * frac;
      const col = this.urgencyColor(frac);
      const isTarget = this.target === wd;
      // Blink fades in as the ring closes so the warning never pops on.
      const amp = 0.4 * clamp((0.32 - frac) / 0.14, 0, 1);
      const blink = 1 - amp * (0.5 - 0.5 * Math.cos(this.time * 14));

      // Base circle (the "pad")
      ctx.strokeStyle = "rgba(29,35,48,0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, wd.baseR, 0, Math.PI * 2);
      ctx.stroke();
      // cardinal ticks
      ctx.strokeStyle = "rgba(29,35,48,0.32)";
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.moveTo(x + Math.cos(a) * (wd.baseR + 3), y + Math.sin(a) * (wd.baseR + 3));
        ctx.lineTo(x + Math.cos(a) * (wd.baseR + 8), y + Math.sin(a) * (wd.baseR + 8));
      }
      ctx.stroke();

      // Approach ring — single flat stroke
      ctx.globalAlpha = alpha * blink;
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, r), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // head marker
      ctx.fillStyle = col;
      ctx.fillRect(x - 3, y - r - 3, 6, 6);

      // Lock-on reticle around targeted word
      if (isTarget && wd.typed < wd.text.length) {
        const tw = wd.adv * wd.text.length + 18;
        const th = wd.px * 1.9;
        const pulse = 1 + 0.03 * Math.sin(this.time * 9);
        const hw = (tw / 2) * pulse, hh = (th / 2) * pulse;
        const l = wd.px * 0.34;
        ctx.strokeStyle = BLUE;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const corners: [number, number, number, number][] = [
          [x - hw, y - hh, 1, 1], [x + hw, y - hh, -1, 1],
          [x - hw, y + hh, 1, -1], [x + hw, y + hh, -1, -1],
        ];
        for (const [cx, cy, sx, sy] of corners) {
          ctx.moveTo(cx + sx * l, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + sy * l);
        }
        ctx.stroke();

        // Caret under next character
        const left = x - (wd.adv * wd.text.length) / 2;
        const ccx = left + (wd.typed + 0.5) * wd.adv;
        const cy2 = y + wd.px * 0.68;
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.time * 12);
        ctx.strokeStyle = BLUE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ccx - wd.adv * 0.3, cy2);
        ctx.lineTo(ccx + wd.adv * 0.3, cy2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Word sprite: untyped layer, then the typed layer revealed by a clip.
    if (wd.sprite) {
      ctx.globalAlpha = alpha;
      const dw = wd.sw * scale;
      const dh = wd.sh * scale;
      const dx = x - dw / 2;
      const dy = y - dh / 2;
      ctx.drawImage(wd.sprite, dx, dy, dw, dh);
      if (wd.typed > 0 && wd.spriteTyped) {
        const cut = (wd.spad + wd.typed * wd.adv) * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(dx, dy, cut, dh);
        ctx.clip();
        ctx.drawImage(wd.spriteTyped, dx, dy, dw, dh);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- hud ---------------- */

  private emitHud() {
    const keys = this.correctKeys + this.wrongKeys;
    this.cb.onHud({
      score: this.score,
      combo: this.combo,
      mult: this.mult,
      lives: this.lives,
      maxLives: this.mode.lives,
      acc: keys > 0 ? Math.round((this.correctKeys / keys) * 100) : 100,
      level: this.level,
      cleared: this.cleared,
      lastGain: this.lastGain,
    });
  }
}
