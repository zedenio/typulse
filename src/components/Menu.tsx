import { useEffect, useMemo, useState, type RefObject } from "react";
import { Play, Keyboard, Timer, Heart, UserRound, Gauge } from "lucide-react";
import { sfx } from "../game/audio";
import { MODES, MODE_LIST, type ModeId } from "../game/modes";
import { avgWpm, loadStats } from "../game/stats";
import type { Profile } from "../game/profile";

const GHOSTS = [
  "velocity", "stardust", "blitz", "keyboard", "overdrive", "turbo",
  "interstellar", "flux", "kaleidoscope", "hyper", "moonlight", "glitch",
];

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

export default function Menu({
  onStart,
  kbRef,
  profile,
  onOpenProfile,
}: {
  onStart: (mode: ModeId) => void;
  kbRef: RefObject<HTMLInputElement | null>;
  profile: Profile;
  onOpenProfile: () => void;
}) {
  const [mode, setMode] = useState<ModeId>("normal");
  const stats = useMemo(() => loadStats(), []);
  const total = stats.total;

  const ghosts = useMemo(
    () =>
      GHOSTS.map((w, i) => ({
        w,
        left: (i * 83 + 7) % 92,
        size: 14 + ((i * 13) % 30),
        dur: 16 + ((i * 7) % 18),
        delay: -((i * 3.7) % 20),
      })),
    []
  );

  // Focus must run synchronously inside the gesture for mobile keyboards to open.
  const start = () => {
    sfx.init();
    sfx.ui();
    if (isTouchDevice()) kbRef.current?.focus({ preventScroll: true });
    onStart(mode);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        start();
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= MODE_LIST.length) {
        setMode(MODE_LIST[Number(e.key) - 1].id);
        sfx.init(); sfx.ui();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStart, mode]);

  return (
    <div className="fade-in menu-viewport relative z-10 h-full overflow-x-hidden overflow-y-auto px-4">
      {/* drifting ghost words */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {ghosts.map((g, i) => (
          <span
            key={i}
            className="ghost-word"
            style={{
              left: `${g.left}%`,
              bottom: "-10vh",
              fontSize: g.size,
              animationDuration: `${g.dur}s`,
              animationDelay: `${g.delay}s`,
            }}
          >
            {g.w}
          </span>
        ))}
      </div>
      <div className="dot-pan pointer-events-none absolute inset-0" aria-hidden />

      {/* min-h-full centres normal layouts, but unlike justify-center on the
          scroll container it keeps the top reachable on short displays. */}
      <div className="menu-frame relative z-10 flex min-h-full w-full items-center justify-center">
      <div className="menu-shell relative flex w-full max-w-3xl flex-col items-center lg:max-w-4xl">
        {/* Profile chip */}
        <button
          onClick={() => { sfx.init(); sfx.ui(); onOpenProfile(); }}
          className="btn menu-profile flex w-full max-w-md items-center gap-3 rounded-sm px-3 py-2 text-left"
          aria-label="Open profile and stats"
        >
          <UserRound size={18} className="shrink-0 text-ink/70" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-display text-xs font-extrabold tracking-widest text-ink">
                {profile.name}
              </span>
              {profile.guest && (
                <span className="shrink-0 border-2 border-ink bg-ink/10 px-1 py-px text-[7px] font-bold tracking-[0.1em] text-ink/70">
                  GUEST
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[9px] font-normal tracking-normal text-ink/50">
              {total.games > 0
                ? `${total.games} games · ${avgWpm(total)} avg wpm · best ${total.bestScore.toLocaleString()}`
                : "Tap to set your name & see your stats"}
            </span>
          </span>
          <Gauge size={15} className="shrink-0 text-ink/60" />
        </button>

        {/* Title */}
        <div className="menu-title-block flex flex-col items-center text-center">
          <div className="pulse-soft border-2 border-ink bg-panel px-3 py-1 text-[10px] font-bold tracking-[0.5em] text-ink shadow-chip">
            SPEED-TYPING // ARCADE
          </div>
          <h1 className="title-shadow menu-title font-title tracking-tight text-ink">
            TYPULSE
          </h1>
          <p className="max-w-md text-xs leading-relaxed text-ink/60 sm:text-sm">
            Words drop. The ring closes. Type them before they detonate.
          </p>
        </div>

        {/* Mode select */}
        <div className="grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {MODE_LIST.map((m, i) => {
            const active = mode === m.id;
            const best = stats.modes[m.id]?.bestScore ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => { sfx.init(); sfx.ui(); setMode(m.id); }}
                className="menu-mode relative flex flex-col items-start gap-1 rounded-sm border-2 border-ink p-3 text-left transition-all duration-100 sm:p-3.5"
                style={{
                  background: active ? m.color : "#fffdf6",
                  color: active ? "#f5f0e6" : "#1d2330",
                  boxShadow: active ? "2px 2px 0 #1d2330" : "4px 4px 0 #1d2330",
                  transform: active ? "translate(2px,2px)" : "none",
                }}
              >
                {m.id === "expert" && (
                  <span
                    className="absolute -top-2 right-1.5 border-2 border-ink bg-yellow px-1 py-px text-[7px] font-black tracking-[0.1em] text-ink"
                    style={{ boxShadow: "2px 2px 0 #1d2330" }}
                  >
                    2× HARD
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border-2"
                    style={{
                      borderColor: active ? "#f5f0e6" : m.color,
                      background: active ? "#f5f0e6" : "transparent",
                    }}
                  />
                  <span className="font-display text-[11px] font-extrabold tracking-[0.1em] sm:text-xs">
                    {m.label}
                  </span>
                </div>
                <span className={`text-[9px] leading-tight sm:text-[10px] ${active ? "text-white/85" : "text-ink/55"}`}>
                  {m.tagline}
                </span>
                <span className={`mt-0.5 text-[9px] font-bold tabular-nums sm:text-[10px] ${active ? "text-white" : "text-ink/75"}`}>
                  {best > 0 ? `BEST ${best.toLocaleString()}` : "NO RECORD"}
                </span>
                <span className={`text-[8px] ${active ? "text-white/60" : "text-ink/35"}`}>
                  [{i + 1}]
                </span>
              </button>
            );
          })}
        </div>

        {/* Start */}
        <div className="menu-start flex flex-col items-center gap-2.5">
          <button
            onClick={start}
            className="btn btn-primary menu-start-button flex items-center gap-3 rounded-sm px-10 py-4 text-base font-extrabold tracking-[0.2em] sm:px-14 sm:text-lg"
          >
            <Play size={20} />
            START
          </button>
          <span className="text-[10px] tracking-[0.3em] text-ink/45">
            PRESS <span className="font-bold text-ink">ENTER</span> · RING TIMING:{" "}
            <span className="font-bold" style={{ color: MODES[mode].color }}>
              {MODES[mode].label}
            </span>
          </span>
        </div>

        {/* How to play */}
        <div className="menu-help grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { icon: Keyboard, t: "TYPE THE WORD", d: "First letter locks on. No backspace — trust yourself." },
            { icon: Timer, t: "BEAT THE RING", d: "When the ring touches the pad, the word detonates." },
            { icon: Heart, t: "STAY ALIVE", d: "A missed word costs a life. Expert mode gives you only two." },
          ].map((c) => (
            <div key={c.t} className="panel menu-help-card flex items-start gap-3 rounded-sm px-4 py-3 shadow-hard-sm">
              <c.icon size={18} className="mt-0.5 shrink-0 text-ink" />
              <div>
                <div className="font-display text-[10px] font-bold tracking-[0.18em] text-ink">{c.t}</div>
                <div className="menu-help-description mt-1 text-[11px] leading-snug text-ink/55">{c.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
