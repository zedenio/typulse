import { useEffect, useRef } from "react";
import {
  ADSENSE_CLIENT, AD_SLOT_SIDE, SIDE_AD_HEIGHT, SIDE_AD_WIDTH, adsEnabled,
} from "../game/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** The AdSense loader only needs to be added to <head> once. */
let injected = false;
function ensureLoader(client: string) {
  if (injected || typeof document === "undefined") return;
  // AdSense's site-verification snippet may already be in index.html.
  if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
    injected = true;
    return;
  }
  injected = true;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  document.head.appendChild(s);
}

/**
 * A vertical ad rail for the left or right of the game.
 *
 * Renders nothing at all while AdSense is unconfigured, so the current
 * full-bleed layout is untouched until ads are switched on. Rails are hidden
 * below 1280px so narrow screens never lose playing space.
 */
export default function AdRail({ side }: { side: "left" | "right" }) {
  const pushed = useRef(false);
  const enabled = adsEnabled();

  useEffect(() => {
    if (!enabled) return;
    ensureLoader(ADSENSE_CLIENT.trim());
    if (pushed.current) return;
    pushed.current = true;
    // Ask AdSense to fill this <ins>. Safe to call before the loader finishes.
    try {
      ((window.adsbygoogle = window.adsbygoogle || []) as unknown[]).push({});
    } catch {
      /* loader not ready yet — AdSense retries on its own */
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside
      aria-label={`Advertisement (${side})`}
      className={`hidden shrink-0 items-center justify-center overflow-hidden py-4 xl:flex ${
        side === "left" ? "border-r-2 border-ink/10" : "border-l-2 border-ink/10"
      }`}
      style={{ width: SIDE_AD_WIDTH }}
    >
      {/* Fixed size reserves the space up-front, so ads cannot shift the layout. */}
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: SIDE_AD_WIDTH, height: SIDE_AD_HEIGHT }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={AD_SLOT_SIDE}
        data-ad-format="vertical"
        data-full-width-responsive="false"
      />
    </aside>
  );
}
