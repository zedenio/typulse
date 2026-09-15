import { useEffect, useRef, useState } from "react";
import Menu from "./components/Menu";
import GameScreen from "./components/GameScreen";
import ProfilePanel from "./components/ProfilePanel";
import AdRail from "./components/AdRail";
import { sfx } from "./game/audio";
import type { ModeId } from "./game/modes";
import { createGuestProfile, loadProfile, saveProfile, type Profile } from "./game/profile";

export default function App() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [gameId, setGameId] = useState(0);
  const [mode, setMode] = useState<ModeId>("normal");
  // Everyone always has a profile: newcomers get an auto-assigned guest
  // identity (e.g. GUEST#4821) and can rename it whenever they like.
  const [profile, setProfile] = useState<Profile>(() => {
    const existing = loadProfile();
    if (existing) return existing;
    const guest = createGuestProfile();
    saveProfile(guest);
    return guest;
  });
  const [showProfile, setShowProfile] = useState(false);
  // Shared hidden input — persists across screens so the mobile keyboard,
  // once summoned inside a tap handler, never gets dropped.
  const kbRef = useRef<HTMLInputElement>(null);

  // Unlock the AudioContext on the very first user gesture.
  useEffect(() => {
    const init = () => sfx.init();
    window.addEventListener("pointerdown", init, { once: true });
    window.addEventListener("keydown", init, { once: true });
    return () => {
      window.removeEventListener("pointerdown", init);
      window.removeEventListener("keydown", init);
    };
  }, []);

  return (
    // Full-viewport shell: ad rails flank a centred game column. The rails
    // render nothing while AdSense is unconfigured, so this is identical to
    // the old full-bleed layout until ads are switched on.
    <div className="flex h-[100dvh] w-full overflow-hidden bg-paper font-mono text-ink">
      <AdRail side="left" />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* keyboard summoner for touch devices (near-invisible, always mounted) */}
        <input
          ref={kbRef}
          className="fixed left-1 top-1 z-[5] h-8 w-8 opacity-[0.03]"
          style={{ fontSize: 16 }}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Typing input"
          tabIndex={-1}
        />
        {screen === "menu" ? (
          <Menu
            kbRef={kbRef}
            profile={profile}
            onOpenProfile={() => setShowProfile(true)}
            onStart={(m) => {
              setMode(m);
              setGameId((g) => g + 1);
              setScreen("game");
            }}
          />
        ) : (
          <GameScreen
            key={gameId}
            kbRef={kbRef}
            mode={mode}
            profile={profile}
            onExit={() => setScreen("menu")}
          />
        )}
      </div>

      <AdRail side="right" />

      {showProfile && (
        <ProfilePanel
          profile={profile}
          onChange={setProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
