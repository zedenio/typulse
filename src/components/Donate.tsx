import { useEffect, useState } from "react";
import { Heart, X, ExternalLink, Sparkles } from "lucide-react";
import { DONATE_URL, hasDonateTarget } from "../game/donate";
import { sfx } from "../game/audio";

/**
 * Small "SUPPORT" button for the menu footer, plus the panel it opens.
 * The button carries a live EKG trace — a nod to the game's name.
 */
export default function Donate() {
  const [open, setOpen] = useState(false);
  const ready = hasDonateTarget();

  // Escape closes the panel, matching the pause and profile panels.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const openPanel = () => { sfx.init(); sfx.ui(); setOpen(true); };

  return (
    <>
      <button
        onClick={openPanel}
        className="donate-btn btn flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[9px] font-bold tracking-[0.2em]"
        aria-label="Support TYPULSE"
      >
        <svg className="donate-ekg" viewBox="0 0 34 12" aria-hidden>
          {/* faint full trace so the path is always readable */}
          <path className="donate-ekg-trace" pathLength={100} d="M1 6 H8 L10.5 6 L12.5 2 L15 10 L17 6 H21 L23.5 6 L25 4 L26.5 8 L28 6 H33" />
          {/* bright segment travelling along it */}
          <path className="donate-ekg-blip" pathLength={100} d="M1 6 H8 L10.5 6 L12.5 2 L15 10 L17 6 H21 L23.5 6 L25 4 L26.5 8 L28 6 H33" />
        </svg>
        <Heart size={11} className="donate-heart" aria-hidden />
        SUPPORT
      </button>

      {open && (
        <div className="fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(245,240,230,0.92)] p-4">
          <div className="modal-in panel flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-sm">
            <div className="flex items-center justify-between border-b-2 border-ink bg-yellow px-5 py-3">
              <div className="font-display text-sm font-black tracking-[0.2em] text-ink">
                SUPPORT TYPULSE
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="btn rounded-sm p-1.5">
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 px-5 py-6 text-center">
              <svg className="donate-ekg donate-ekg-lg" viewBox="0 0 34 12" aria-hidden>
                <path className="donate-ekg-trace" pathLength={100} d="M1 6 H8 L10.5 6 L12.5 2 L15 10 L17 6 H21 L23.5 6 L25 4 L26.5 8 L28 6 H33" />
                <path className="donate-ekg-blip" pathLength={100} d="M1 6 H8 L10.5 6 L12.5 2 L15 10 L17 6 H21 L23.5 6 L25 4 L26.5 8 L28 6 H33" />
              </svg>

              <p className="text-xs leading-relaxed text-ink/70">
                TYPULSE is free to play — every mode is unlocked from the
                start and nothing is pay-to-win. Ads help support the project.
                Tips go straight into new words, modes and polish.
              </p>

              {ready ? (
                <a
                  href={DONATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sfx.ui()}
                  className="btn btn-green flex w-full items-center justify-center gap-2 rounded-sm px-6 py-3 text-sm font-extrabold tracking-[0.15em]"
                >
                  <Heart size={15} className="fill-paper" /> SEND A TIP
                  <ExternalLink size={12} className="opacity-70" />
                </a>
              ) : (
                <div className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-ink bg-paper px-4 py-3 text-[10px] font-bold tracking-[0.15em] text-ink/60 shadow-chip">
                  <Sparkles size={13} /> COMING SOON
                </div>
              )}

              <p className="text-[9px] leading-relaxed text-ink/40">
                Tipping is optional and never unlocks anything. Every mode is
                yours either way.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
