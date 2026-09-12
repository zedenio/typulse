import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Home, Skull, Star } from "lucide-react";
import type { FinalStats } from "../game/engine";
import { MODES, type ModeId } from "../game/modes";
import { loadStats, rankFor, recordRun } from "../game/stats";
import type { Profile } from "../game/profile";

/* -------------------- PAUSE -------------------- */

export function PausePanel({
  onResume, onRestart, onExit,
}: { onResume: () => void; onRestart: () => void; onExit: () => void }) {
  return (
    <div className="fade-in absolute inset-0 z-40 flex items-center justify-center bg-[rgba(245,240,230,0.88)]">
      <div className="modal-in panel flex w-[min(92vw,380px)] flex-col items-center gap-5 rounded-sm px-8 py-9">
        <div className="title-shadow-sm font-display text-3xl font-black tracking-[0.25em] text-ink">PAUSED</div>
        <div className="flex w-full flex-col gap-3">
          <button onClick={onResume} className="btn btn-primary flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-sm font-bold tracking-[0.15em]">
            <Play size={16} /> RESUME
          </button>
          <button onClick={onRestart} className="btn flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-sm font-bold tracking-[0.15em]">
            <RotateCcw size={16} /> RESTART
          </button>
          <button onClick={onExit} className="btn btn-danger flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-sm font-bold tracking-[0.15em]">
            <Home size={16} /> MENU
          </button>
        </div>
        <div className="text-[10px] font-bold tracking-[0.3em] text-ink/40">ESC — RESUME</div>
      </div>
    </div>
  );
}

/* -------------------- GAME OVER -------------------- */

export function GameOverPanel({
  stats, mode, profile, onRestart, onExit,
}: { stats: FinalStats; mode: ModeId; profile: Profile; onRestart: () => void; onExit: () => void }) {
  const rank = rankFor(stats.acc, stats.cleared);
  const def = MODES[mode];
  const savedOnce = useRef(false);
  // Personal bests before this run, so we can flag new records.
  const [prev] = useState(() => loadStats().modes[mode]);

  useEffect(() => {
    if (savedOnce.current) return;
    savedOnce.current = true;
    recordRun(mode, stats);
  }, [mode, stats]);

  const isBestScore = stats.score > 0 && stats.score > (prev?.bestScore ?? 0);
  const isBestWpm = stats.wpm > 0 && stats.wpm > (prev?.bestWpm ?? 0);

  return (
    <div className="fade-in absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[rgba(245,240,230,0.88)] p-4">
      <div className="modal-in panel flex max-h-[94dvh] w-[min(94vw,460px)] flex-col items-center gap-4 overflow-y-auto rounded-sm px-6 py-7 sm:px-9">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 border-2 border-ink bg-red px-2.5 py-0.5 text-[10px] font-bold tracking-[0.4em] text-paper">
            <Skull size={12} /> SIGNAL LOST
          </div>
          <div
            className="font-display text-4xl font-black tracking-wider text-ink sm:text-5xl"
            style={{ textShadow: "4px 4px 0 #e8472f" }}
          >
            GAME&nbsp;OVER
          </div>
          <span
            className="mt-1 border-2 border-ink px-2 py-0.5 font-display text-[10px] font-bold tracking-[0.25em]"
            style={{ background: def.color, color: "#f5f0e6" }}
          >
            {def.label} MODE
          </span>
        </div>

        <div
          className="rank-in font-display text-7xl font-black sm:text-8xl"
          style={{ color: rank.hex, textShadow: "5px 5px 0 #1d2330" }}
        >
          {rank.letter}
        </div>

        <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { l: "SCORE", v: stats.score.toLocaleString(), hot: true },
            { l: "WPM", v: `${stats.wpm}` },
            { l: "ACCURACY", v: `${stats.acc}%` },
            { l: "MAX COMBO", v: `${stats.maxCombo}` },
          ].map((s) => (
            <div key={s.l} className="rounded-sm border-2 border-ink bg-paper px-2 py-2.5 text-center shadow-chip">
              <div className="text-[9px] tracking-[0.2em] text-ink/50">{s.l}</div>
              <div className={`mt-0.5 font-display text-sm font-extrabold tabular-nums sm:text-base ${s.hot ? "text-red" : "text-ink"}`}>
                {s.v}
              </div>
            </div>
          ))}
        </div>

        <div className="flex w-full items-center gap-2 rounded-sm border-2 border-ink bg-paper px-3 py-2 shadow-chip">
          <span className="min-w-0 flex-1 truncate font-display text-xs font-extrabold tracking-widest text-ink">
            {profile.name}
          </span>
          <span className="shrink-0 text-[10px] text-ink/50 tabular-nums">
            {stats.cleared} words{stats.bestWordWpm > 0 && ` · peak ${stats.bestWordWpm} wpm`}
            {stats.lost > 0 && (
              <span className="text-red"> · −{stats.lost.toLocaleString()} misses</span>
            )}
          </span>
        </div>

        {(isBestScore || isBestWpm) && (
          <div className="flex items-center gap-1.5 border-2 border-ink bg-green px-3 py-1 text-[11px] font-bold tracking-[0.25em] text-paper shadow-chip">
            <Star size={12} fill="currentColor" />
            {isBestScore ? "NEW BEST SCORE" : "NEW BEST WPM"}
          </div>
        )}

        <div className="flex w-full gap-3 pt-1">
          <button onClick={onRestart} className="btn btn-primary flex flex-1 items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-sm font-extrabold tracking-[0.15em]">
            <RotateCcw size={16} /> RETRY
          </button>
          <button onClick={onExit} className="btn flex items-center justify-center gap-2 rounded-sm px-5 py-3.5 text-sm font-bold tracking-[0.15em]">
            <Home size={16} /> MENU
          </button>
        </div>
        <div className="text-[10px] font-bold tracking-[0.3em] text-ink/40">
          <span className="text-ink">ENTER</span> — INSTANT RETRY
        </div>
      </div>
    </div>
  );
}
