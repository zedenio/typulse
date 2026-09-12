import { useMemo, useState } from "react";
import {
  X, Gauge, Trophy, Flame, Type, Target, Timer, Gamepad2, TrendingUp,
  RotateCcw, Lock, Pencil, Check, Zap,
} from "lucide-react";
import {
  avgAcc, avgScore, avgWpm, formatDate, formatPlaytime, loadStats, resetStats,
  type StatBucket, type StatsData,
} from "../game/stats";
import { MODES, MODE_LIST } from "../game/modes";
import {
  MAX_NAME, NAME_LIMIT, applyRename, canChangeName, formatDuration,
  nameChangesLeft, nextNameChangeAt, sanitizeName, saveProfile, type Profile,
} from "../game/profile";
import { sfx } from "../game/audio";

function Stat({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-sm border-2 border-ink bg-paper px-2.5 py-2 shadow-chip">
      <div className="flex items-center gap-1 text-[8px] font-bold tracking-[0.2em] text-ink/50">
        <Icon size={10} /> {label}
      </div>
      <div
        className="mt-0.5 font-display text-base font-extrabold tabular-nums leading-none sm:text-lg"
        style={{ color: accent ?? "#1d2330" }}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[8px] leading-tight text-ink/45">{sub}</div>}
    </div>
  );
}

/** Tiny bar chart of recent scores. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-10 items-end gap-[3px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 border-2 border-ink transition-[height] duration-300 ease-out"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: i === values.length - 1 ? "#f5b801" : "#2f6fe4",
          }}
          title={v.toLocaleString()}
        />
      ))}
    </div>
  );
}

export default function ProfilePanel({
  profile, onChange, onClose,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<StatsData>(() => loadStats());
  const [confirmReset, setConfirmReset] = useState(false);
  const [editing, setEditing] = useState(profile.guest);
  const [draft, setDraft] = useState(profile.guest ? "" : profile.name);
  const [err, setErr] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const now = Date.now();
  const unlocked = canChangeName(profile, now);
  const left = nameChangesLeft(profile, now);
  const unlockAt = nextNameChangeAt(profile, now);

  const t: StatBucket = stats.total;
  const played = t.games > 0;

  const sparkVals = useMemo(
    () => stats.recent.slice(0, 12).map((r) => r.score).reverse(),
    [stats.recent]
  );

  const saveName = () => {
    const trimmed = draft.trim();
    if (trimmed.length < 2) { setErr("Name needs at least 2 characters."); return; }
    const next = applyRename(profile, trimmed, Date.now());
    // Keep the editor open if the name could not be written to disk, so the
    // player finds out now rather than after a reload wipes it.
    if (!saveProfile(next)) {
      setErr("Couldn't save — storage is blocked. Check private browsing settings.");
      return;
    }
    onChange(next);
    setEditing(false);
    setErr(null);
    setJustSaved(true);
    sfx.ui();
  };

  const doReset = () => {
    setStats(resetStats());
    setConfirmReset(false);
    sfx.ui();
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(245,240,230,0.92)] p-3 sm:p-4">
      <div className="modal-in panel flex max-h-[95dvh] w-[min(96vw,620px)] flex-col overflow-hidden rounded-sm">
        {/* header */}
        <div className="flex items-center justify-between border-b-2 border-ink bg-yellow px-4 py-3 sm:px-5">
          <div className="font-display text-sm font-black tracking-[0.2em] text-ink sm:text-base">
            PROFILE
          </div>
          <button onClick={onClose} aria-label="Close" className="btn rounded-sm p-1.5">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-5">
          {/* ---- name ---- */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.3em] text-ink/60">
              USERNAME {!unlocked && <Lock size={10} className="text-red" />}
            </div>

            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  autoFocus
                  maxLength={MAX_NAME}
                  disabled={!unlocked}
                  onChange={(e) => { setDraft(sanitizeName(e.target.value)); setErr(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") { setEditing(false); setErr(null); }
                    e.stopPropagation();
                  }}
                  placeholder={profile.guest ? profile.name : "Enter a name"}
                  className="name-slot min-w-0 flex-1 rounded-sm border-2 border-ink bg-paper px-3 py-2 font-display text-sm font-extrabold tracking-widest text-ink placeholder:font-mono placeholder:font-normal placeholder:tracking-normal placeholder:text-ink/30"
                />
                <button
                  onClick={saveName}
                  className="btn btn-green flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2.5 text-[11px] font-bold tracking-[0.1em]"
                >
                  <Check size={13} /> SAVE
                </button>
                {!profile.guest && (
                  <button
                    onClick={() => { setEditing(false); setDraft(profile.name); setErr(null); }}
                    className="btn shrink-0 rounded-sm px-3 py-2.5 text-[11px] font-bold tracking-[0.1em]"
                  >
                    CANCEL
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border-2 border-ink bg-paper px-3 py-2 shadow-chip">
                  <span className="truncate font-display text-sm font-extrabold tracking-widest text-ink">
                    {profile.name}
                  </span>
                  {profile.guest && (
                    <span className="shrink-0 border-2 border-ink bg-ink/10 px-1 py-px text-[7px] font-bold tracking-[0.1em] text-ink/70">
                      GUEST
                    </span>
                  )}
                  {justSaved && !profile.guest && (
                    <span className="anim-pop flex shrink-0 items-center gap-1 border-2 border-ink bg-green px-1.5 py-px text-[7px] font-bold tracking-[0.1em] text-paper">
                      <Check size={8} strokeWidth={4} /> SAVED
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setEditing(true); setDraft(profile.guest ? "" : profile.name); sfx.ui(); }}
                  disabled={!unlocked}
                  className="btn flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2.5 text-[11px] font-bold tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil size={12} /> CHANGE
                </button>
              </div>
            )}

            <div className="mt-1.5 text-[9px] leading-tight text-ink/45">
              {!unlocked && unlockAt
                ? `Locked — you've used all ${NAME_LIMIT} changes. Unlocks in ${formatDuration(unlockAt - now)}.`
                : profile.guest
                  ? "Claim a name for free — it won't use a change."
                  : `${left} of ${NAME_LIMIT} name changes left (rolling 14 days).`}
            </div>

            {err && (
              <div className="mt-2 border-2 border-ink bg-red px-3 py-1.5 text-[10px] font-bold text-paper">
                {err}
              </div>
            )}
          </div>

          {/* ---- stats ---- */}
          {!played ? (
            <div className="flex flex-col items-center gap-2 border-t-2 border-ink/15 py-9 text-center">
              <Gamepad2 size={30} className="text-ink/30" />
              <div className="font-display text-sm font-bold tracking-[0.2em] text-ink/60">
                NO GAMES YET
              </div>
              <div className="max-w-xs text-[11px] leading-relaxed text-ink/45">
                Play a round and your speed, accuracy, combos and records will show up here.
              </div>
            </div>
          ) : (
            <>
              {/* headline */}
              <div className="border-t-2 border-ink/15 pt-4">
                <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-ink/60">CAREER</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat icon={Gauge} label="AVG WPM" value={`${avgWpm(t)}`} sub={`best run ${t.bestWpm}`} accent="#2f6fe4" />
                  <Stat icon={Target} label="AVG ACC" value={`${avgAcc(t)}%`} sub={`best ${t.bestAcc}%`} accent="#1fa755" />
                  <Stat icon={Trophy} label="BEST SCORE" value={t.bestScore.toLocaleString()} sub={`avg ${avgScore(t).toLocaleString()}`} accent="#c07c00" />
                  <Stat icon={Flame} label="BEST COMBO" value={`${t.bestCombo}`} sub={`lv ${t.bestLevel} reached`} accent="#e8472f" />
                </div>
              </div>

              {/* totals */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat icon={Gamepad2} label="GAMES" value={t.games.toLocaleString()} />
                <Stat icon={Type} label="WORDS" value={t.words.toLocaleString()} sub={`best run ${t.bestWords}`} />
                <Stat icon={TrendingUp} label="KEYSTROKES" value={(t.correctKeys + t.wrongKeys).toLocaleString()} sub={`${t.wrongKeys.toLocaleString()} missed`} />
                <Stat icon={Zap} label="FASTEST WORD" value={t.bestWordWpm > 0 ? `${t.bestWordWpm} wpm` : "—"} sub="single word peak" accent="#7b4fd6" />
                <Stat icon={Timer} label="PLAYTIME" value={formatPlaytime(t.seconds)} sub={`since ${formatDate(stats.firstPlayed)}`} />
              </div>

              {/* recent scores chart */}
              {sparkVals.length > 1 && (
                <div>
                  <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-ink/60">
                    LAST {sparkVals.length} SCORES
                  </div>
                  <div className="rounded-sm border-2 border-ink bg-paper px-3 py-2.5 shadow-chip">
                    <Spark values={sparkVals} />
                  </div>
                </div>
              )}

              {/* per mode */}
              <div>
                <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-ink/60">BY MODE</div>
                <div className="overflow-hidden rounded-sm border-2 border-ink">
                  <table className="w-full border-collapse text-[10px] sm:text-xs">
                    <thead>
                      <tr className="bg-ink/10 text-[8px] tracking-[0.15em] text-ink/60">
                        <th className="px-2 py-1.5 text-left font-bold">MODE</th>
                        <th className="px-1 py-1.5 text-right font-bold">GAMES</th>
                        <th className="px-1 py-1.5 text-right font-bold">BEST</th>
                        <th className="px-1 py-1.5 text-right font-bold">WPM</th>
                        <th className="px-1 py-1.5 text-right font-bold">ACC</th>
                        <th className="px-2 py-1.5 text-right font-bold">CMB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODE_LIST.map((m) => {
                        const b = stats.modes[m.id];
                        const none = !b || b.games === 0;
                        return (
                          <tr key={m.id} className="border-t-2 border-ink/10">
                            <td className="px-2 py-1.5">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink"
                                  style={{ background: m.color }}
                                />
                                <span className="font-bold text-ink">{m.label}</span>
                              </span>
                            </td>
                            {none ? (
                              <td colSpan={5} className="px-2 py-1.5 text-right text-ink/30">
                                not played yet
                              </td>
                            ) : (
                              <>
                                <td className="px-1 py-1.5 text-right tabular-nums text-ink/70">{b.games}</td>
                                <td className="px-1 py-1.5 text-right font-bold tabular-nums text-ink">{b.bestScore.toLocaleString()}</td>
                                <td className="px-1 py-1.5 text-right tabular-nums text-ink/70">{avgWpm(b)}</td>
                                <td className="px-1 py-1.5 text-right tabular-nums text-ink/70">{avgAcc(b)}%</td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-ink/70">{b.bestCombo}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* recent runs */}
              {stats.recent.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-ink/60">RECENT RUNS</div>
                  <ul className="flex max-h-44 flex-col overflow-y-auto rounded-sm border-2 border-ink bg-paper">
                    {stats.recent.map((r, i) => (
                      <li
                        key={`${r.date}-${i}`}
                        className="flex items-center gap-2 border-b border-ink/10 px-2.5 py-1.5 text-[10px] last:border-b-0"
                      >
                        <span
                          className="shrink-0 border-2 border-ink px-1 py-px text-[7px] font-bold tracking-[0.1em] text-paper"
                          style={{ background: MODES[r.mode]?.color ?? "#2f6fe4" }}
                        >
                          {MODES[r.mode]?.label ?? r.mode}
                        </span>
                        <span className="w-14 shrink-0 text-right font-bold tabular-nums text-ink sm:w-16">
                          {r.score.toLocaleString()}
                        </span>
                        <span className="flex-1 truncate text-ink/55 tabular-nums">
                          {r.wpm} wpm · {r.acc}% · {r.combo}x · {r.words}w
                        </span>
                        <span className="shrink-0 text-[9px] text-ink/35">{formatDate(r.date)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* reset */}
              <div className="flex items-center justify-between gap-3 border-t-2 border-ink/15 pt-3">
                <span className="text-[9px] leading-tight text-ink/40">
                  Stats are stored on this device only.
                </span>
                {confirmReset ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <button onClick={doReset} className="btn btn-danger rounded-sm px-3 py-1.5 text-[10px] font-bold tracking-[0.1em]">
                      CONFIRM
                    </button>
                    <button onClick={() => setConfirmReset(false)} className="btn rounded-sm px-3 py-1.5 text-[10px] font-bold tracking-[0.1em]">
                      CANCEL
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => { setConfirmReset(true); sfx.ui(); }}
                    className="btn flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1.5 text-[10px] font-bold tracking-[0.1em]"
                  >
                    <RotateCcw size={11} /> RESET STATS
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
