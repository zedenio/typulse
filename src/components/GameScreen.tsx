import { useEffect, useRef, useState, type RefObject } from "react";
import { Pause, Play, Volume2, VolumeX, Heart, Keyboard as KeyboardIcon } from "lucide-react";
import { Game, type HudState, type FinalStats } from "../game/engine";
import { sfx } from "../game/audio";
import { MODES, type ModeId } from "../game/modes";
import type { Profile } from "../game/profile";
import { PausePanel, GameOverPanel } from "./Overlays";

type Phase = "playing" | "paused" | "over";

const INIT_HUD: HudState = { score: 0, combo: 0, mult: 1, lives: 3, maxLives: 3, acc: 100, level: 1, cleared: 0, lastGain: 0 };
const TOAST_COLORS: Record<string, string> = {
  info: "#2f6fe4",
  gold: "#c07c00",
  danger: "#e8472f",
};

export default function GameScreen({
  onExit,
  kbRef,
  mode,
  profile,
}: {
  onExit: () => void;
  kbRef: RefObject<HTMLInputElement | null>;
  mode: ModeId;
  profile: Profile;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = kbRef;
  const engineRef = useRef<Game | null>(null);
  const phaseRef = useRef<Phase>("playing");
  const touchRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("playing");
  const [hud, setHud] = useState<HudState>(INIT_HUD);
  const [stats, setStats] = useState<FinalStats | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; kind: string } | null>(null);
  const [lifePulse, setLifePulse] = useState(0);
  const [touch, setTouch] = useState(false);
  const [kbFocused, setKbFocused] = useState(true);
  const [muted, setMuted] = useState(sfx.muted);

  const modeDef = MODES[mode];
  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const focusKb = () => {
    if (touchRef.current) {
      const el = inputRef.current;
      if (el) el.focus({ preventScroll: true });
    }
  };

  /* ---------- engine lifecycle ---------- */
  useEffect(() => {
    const eng = new Game(canvasRef.current!, {
      onHud: (h) => setHud(h),
      onEvent: (e) => {
        if (e.type === "gameover") {
          setStats(e.stats);
          setPhaseBoth("over");
          inputRef.current?.blur(); // drop the touch keyboard so RETRY is visible
        } else if (e.type === "lifeLost") {
          setLifePulse((n) => n + 1);
        } else if (e.type === "toast") {
          setToast({ id: Date.now() + Math.random(), text: e.text, kind: e.kind });
        }
      },
    });
    const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    touchRef.current = isTouch;
    setTouch(isTouch);
    eng.touchMode = isTouch;
    engineRef.current = eng;

    const doResize = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      eng.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
    };
    const ro = new ResizeObserver(doResize);
    ro.observe(wrapRef.current!);

    const onVis = () => {
      if (document.hidden && phaseRef.current === "playing") {
        eng.pause();
        setPhaseBoth("paused");
      }
    };
    document.addEventListener("visibilitychange", onVis);

    let started = false;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (started || engineRef.current !== eng) return;
      started = true;
      doResize();
      eng.begin(modeDef);
      focusKb();
    });

    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      eng.destroy();
      if (engineRef.current === eng) engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- shared hidden input (touch keyboards) ---------- */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onInp = () => {
      const data = el.value.toLowerCase();
      const eng = engineRef.current;
      if (eng && phaseRef.current === "playing") {
        for (const ch of data) if (ch >= "a" && ch <= "z") eng.handleChar(ch);
      }
      el.value = "";
    };
    const onF = () => setKbFocused(true);
    const onB = () => setKbFocused(false);
    el.addEventListener("input", onInp);
    el.addEventListener("focus", onF);
    el.addEventListener("blur", onB);
    return () => {
      el.removeEventListener("input", onInp);
      el.removeEventListener("focus", onF);
      el.removeEventListener("blur", onB);
      el.value = "";
      el.blur();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- toast auto-dismiss ---------- */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1150);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- actions ---------- */
  const restart = () => {
    sfx.init(); sfx.ui();
    setStats(null);
    setPhaseBoth("playing");
    engineRef.current?.begin(modeDef);
    focusKb();
  };
  const pauseGame = () => {
    if (phaseRef.current !== "playing") return;
    sfx.ui();
    engineRef.current?.pause();
    setPhaseBoth("paused");
    inputRef.current?.blur();
  };
  const resumeGame = () => {
    if (phaseRef.current !== "paused") return;
    sfx.ui();
    engineRef.current?.resume();
    setPhaseBoth("playing");
    focusKb();
  };
  const toggleMute = () => {
    sfx.init();
    const m = !muted;
    sfx.setMuted(m);
    setMuted(m);
  };

  /* ---------- global keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const ph = phaseRef.current;

      if (ph === "over") {
        const inField = document.activeElement instanceof HTMLInputElement && document.activeElement !== inputRef.current;
        if (inField) return;
        if (k === "Enter" || k === "r" || k === "R") { e.preventDefault(); restart(); }
        else if (k === "Escape") { e.preventDefault(); onExit(); }
        return;
      }
      if (k === "Escape") {
        if (ph === "playing") pauseGame();
        else if (ph === "paused") resumeGame();
        return;
      }
      if (ph !== "playing") return;
      if (document.activeElement === inputRef.current) return; // touch keyboards deliver via 'input'
      if (k.length === 1 && /[a-zA-Z]/.test(k)) {
        engineRef.current?.handleChar(k);
        e.preventDefault();
      } else if (k === " " || k === "/" || k === "'") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full touch-manipulation select-none overflow-hidden"
      onPointerDown={(e) => {
        if (touchRef.current && phaseRef.current === "playing" && !(e.target as HTMLElement).closest("button,input")) {
          focusKb();
        }
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* flash + danger overlays */}
      {lifePulse > 0 && <div key={lifePulse} className="life-flash" />}
      {hud.lives === 1 && phase === "playing" && <div className="danger-vignette" />}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-3 [padding-top:max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="min-w-0">
          <div className="inline-block rounded-sm border-2 border-ink bg-panel px-3 py-1.5 shadow-chip">
            <div className="text-[8px] font-bold tracking-[0.35em] text-ink/50">SCORE</div>
          <div
            key={hud.score}
            className={`font-display text-xl font-black tabular-nums text-ink sm:text-3xl ${hud.lastGain < 0 ? "anim-dip" : "anim-pop"}`}
          >
            {hud.score.toLocaleString()}
          </div>
          </div>
          <div className="mt-1.5 text-[10px] font-bold tracking-[0.2em] text-ink/60 tabular-nums">
            ACC{" "}
            <span className={hud.acc >= 93 ? "text-green" : hud.acc >= 80 ? "text-amber" : "text-red"}>{hud.acc}%</span>
            {"  "}LV <span className="text-purple">{hud.level}</span>
          </div>
          <div
            className="mt-1 inline-block border-2 border-ink px-1.5 py-0.5 text-[9px] font-bold tracking-[0.25em]"
            style={{ background: modeDef.color, color: "#f5f0e6" }}
          >
            {modeDef.label}
          </div>
        </div>

        <div className="flex flex-col items-center pt-1">
          {hud.combo >= 2 && (
            <div key={hud.combo} className="anim-pop flex items-center gap-2 rounded-sm border-2 border-ink bg-yellow px-3 py-1.5 shadow-chip">
              <span className="font-display text-sm font-extrabold tabular-nums text-ink sm:text-lg">{hud.combo}</span>
              <span className="text-[9px] font-bold tracking-[0.25em] text-ink/60">COMBO</span>
              <span className="rounded-[2px] bg-ink px-1.5 py-0.5 font-display text-[11px] font-extrabold text-paper">
                ×{hud.mult}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="pointer-events-auto flex items-center gap-2">
            <button onClick={toggleMute} aria-label="Toggle sound" className="btn rounded-sm p-2 text-ink">
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            {phase !== "over" && (
              <button onClick={phase === "paused" ? resumeGame : pauseGame} aria-label="Pause" className="btn rounded-sm p-2 text-ink">
                {phase === "paused" ? <Play size={15} /> : <Pause size={15} />}
              </button>
            )}
          </div>
          <div key={hud.lives} className="anim-pop flex items-center gap-1 rounded-sm border-2 border-ink bg-panel px-2 py-1 shadow-chip">
            {Array.from({ length: hud.maxLives }, (_, i) => (
              <Heart
                key={i}
                size={15}
                className={i < hud.lives ? "fill-red text-red" : "text-ink/25"}
              />
            ))}
          </div>
        </div>
      </div>

      {/* milestone toast */}
      {toast && (
        <div
          key={toast.id}
          className="toast-in pointer-events-none absolute left-1/2 top-[21%] z-30 -translate-x-1/2 whitespace-nowrap font-display text-lg font-black tracking-[0.18em] sm:text-2xl"
          style={{ color: TOAST_COLORS[toast.kind] ?? "#2f6fe4", textShadow: "3px 3px 0 rgba(29,35,48,0.9)" }}
        >
          {toast.text}
        </div>
      )}

      {/* tap-to-type pill when the touch keyboard is dismissed */}
      {touch && !kbFocused && phase === "playing" && (
        <button
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); focusKb(); }}
          className="btn btn-blue absolute bottom-[8%] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-6 py-3 text-xs font-extrabold tracking-[0.2em]"
        >
          <KeyboardIcon size={16} /> TAP TO TYPE
        </button>
      )}

      {/* overlays */}
      {phase === "paused" && <PausePanel onResume={resumeGame} onRestart={restart} onExit={onExit} />}
      {phase === "over" && stats && <GameOverPanel stats={stats} mode={mode} profile={profile} onRestart={restart} onExit={onExit} />}
    </div>
  );
}
