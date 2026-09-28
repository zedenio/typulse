/**
 * Where the SUPPORT button sends players.
 *
 * Paste your own link between the quotes and it goes live immediately —
 * nothing else in the codebase needs to change. Any of these work:
 *
 *   Ko-fi:            https://ko-fi.com/yourname
 *   Buy Me a Coffee:  https://buymeacoffee.com/yourname
 *   GitHub Sponsors:  https://github.com/sponsors/yourname
 *   Stripe link:      https://buy.stripe.com/xxxx
 *   PayPal:           https://paypal.me/yourname
 *
 * While it is left empty the button still appears, but opens a thank-you
 * panel instead of a payment page, so nothing is broken in the meantime.
 */
export const DONATE_URL = "";

/** True when DONATE_URL has been filled in with a real link. */
export function hasDonateTarget(): boolean {
  return /^https?:\/\/\S+$/i.test(DONATE_URL.trim());
}
