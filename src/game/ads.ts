/**
 * Google AdSense configuration.
 *
 * ── How to fill this in ──────────────────────────────────────────────
 * 1. Sign up at https://adsense.google.com and add your site URL.
 * 2. Wait for approval (see README → "Monetisation").
 * 3. In AdSense, go to Ads → By ad unit → Display ads → create a unit.
 *    Choose a VERTICAL 160x600 "skyscraper" for the side rails.
 * 4. Copy the two IDs out of the generated code:
 *      data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"  → ADSENSE_CLIENT
 *      data-ad-slot="1234567890"                 → AD_SLOT_SIDE
 * 5. Paste them below, rebuild, redeploy.
 *
 * Until both are filled in the ads are disabled and the layout is exactly
 * as it is today — no empty boxes, no console errors, no layout shift.
 */

/** Your publisher ID, e.g. "ca-pub-1234567890123456". */
export const ADSENSE_CLIENT = "ca-pub-3568752383759082";

/** The ad-unit slot ID for the side rails, e.g. "1234567890". */
export const AD_SLOT_SIDE = "";

/** Rail width in px. 160 = skyscraper, 300 = half-page. */
export const SIDE_AD_WIDTH = 160;

/** Rail height in px. 600 pairs with both widths above. */
export const SIDE_AD_HEIGHT = 600;

/** True only when both IDs look valid, so the UI can skip ads entirely. */
export function adsEnabled(): boolean {
  return (
    /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT.trim()) &&
    /^\d{6,}$/.test(AD_SLOT_SIDE.trim())
  );
}
