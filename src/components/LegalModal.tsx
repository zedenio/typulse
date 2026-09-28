import { X } from "lucide-react";

type Page = "about" | "privacy" | "terms";

const TITLES: Record<Page, string> = {
  about: "ABOUT TYPULSE",
  privacy: "PRIVACY POLICY",
  terms: "TERMS OF USE",
};

function Content({ page }: { page: Page }) {
  switch (page) {
    case "about":
      return (
        <>
          <p>
            TYPULSE is a free-to-play browser typing game inspired by rhythm
            arcades. Words appear inside shrinking approach rings — type them
            before the ring closes, or they detonate and cost you a life.
          </p>
          <p>
            The game features four difficulty modes (Easy, Normal, Hard, Expert),
            a 5,800-word dictionary sourced from a real English corpus, speed-based
            scoring that rewards fast typists up to 3.5× more points, smooth
            difficulty progression, procedural sound effects, and full career
            statistics tracking.
          </p>
          <p>
            TYPULSE was built as an independent personal project. There are no
            locked modes, no pay-to-win mechanics, and no required sign-ups.
            Ads help support continued development. Tips are welcome but
            entirely optional and never unlock anything.
          </p>
          <p>
            Built with React, TypeScript, Vite, and Tailwind CSS. The entire game
            compiles to a single self-contained HTML file and runs entirely in the
            browser — no downloads, no accounts, no server required.
          </p>
        </>
      );
    case "privacy":
      return (
        <>
          <p>TYPULSE respects your privacy. Here is exactly what happens with your data:</p>
          <ul>
            <li><strong>Local storage only.</strong> Your profile, game settings, and career statistics are stored in your browser's localStorage. They never leave your device.</li>
            <li><strong>No accounts or sign-ups.</strong> TYPULSE does not collect your name, email address, or any personal information.</li>
            <li><strong>No analytics or tracking scripts</strong> beyond Google AdSense.</li>
            <li><strong>Google AdSense.</strong> This site displays ads served by Google. Google may use cookies to serve ads based on your prior visits to this and other websites. You can opt out of personalised advertising at <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="underline text-blue">Google Ads Settings</a> or at <a href="https://www.aboutads.info/" target="_blank" rel="noopener noreferrer" className="underline text-blue">aboutads.info</a>.</li>
            <li><strong>Google Fonts.</strong> Font files are loaded from Google's CDN. See <a href="https://developers.google.com/fonts/faq/privacy" target="_blank" rel="noopener noreferrer" className="underline text-blue">Google Fonts privacy policy</a>.</li>
            <li><strong>No other third parties</strong> receive any data from this site.</li>
          </ul>
        </>
      );
    case "terms":
      return (
        <>
          <p>
            TYPULSE is provided "as is" without warranty of any kind. You may
            play the game freely for personal, non-commercial use.
          </p>
          <p>
            You may not redistribute, resell, or embed the game on other websites
            without permission. All game code, artwork, and sound design are the
            intellectual property of the developer.
          </p>
          <p>
            Ads are served by Google AdSense and are governed by Google's own
            terms of service.
          </p>
        </>
      );
  }
}

export default function LegalModal({ page, onClose }: { page: Page; onClose: () => void }) {
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(245,240,230,0.92)] p-3 sm:p-4">
      <div className="modal-in panel flex max-h-[95dvh] w-[min(96vw,580px)] flex-col overflow-hidden rounded-sm">
        <div className="flex items-center justify-between border-b-2 border-ink bg-yellow px-4 py-3 sm:px-5">
          <div className="font-display text-sm font-black tracking-[0.2em] text-ink">
            {TITLES[page]}
          </div>
          <button onClick={onClose} aria-label="Close" className="btn rounded-sm p-1.5">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div className="prose prose-sm max-w-none text-xs leading-relaxed text-ink/80 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1.5 [&_strong]:text-ink [&_a]:text-blue [&_a:hover]:underline">
            <Content page={page} />
          </div>
        </div>
      </div>
    </div>
  );
}
