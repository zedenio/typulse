export interface Profile {
  name: string;
  created: number;
  /** True until the player claims a real username. */
  guest: boolean;
  /** Timestamps of past renames, used for the rolling-window limit. */
  nameChanges: number[];
}

const KEY = "typulse.profile.v1";
/** Pre-rename keys; read once so existing players keep their profile. */
const LEGACY_KEYS = ["clackwave.profile.v1", "typeblitz.profile.v1"];

export const MAX_NAME = 12;
/** Players may rename twice per rolling 14-day window. */
export const NAME_LIMIT = 2;
export const NAME_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Guests get a stable, unique-ish tag like GUEST#4821. */
export function createGuestProfile(): Profile {
  return {
    name: `GUEST#${Math.floor(1000 + Math.random() * 9000)}`,
    created: Date.now(),
    guest: true,
    nameChanges: [],
  };
}

export function loadProfile(): Profile | null {
  try {
    let raw = localStorage.getItem(KEY);
    let fromLegacy = false;
    if (!raw) {
      raw = LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) ?? null;
      fromLegacy = !!raw;
    }
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    if (!p || typeof p.name !== "string" || !p.name) return null;
    const profile: Profile = {
      name: p.name.slice(0, MAX_NAME + 5),
      created: p.created || Date.now(),
      guest: p.guest ?? false,
      nameChanges: Array.isArray(p.nameChanges)
        ? p.nameChanges.filter((t) => typeof t === "number")
        : [],
    };
    // Copy an old-key profile onto the current key so it survives even if the
    // legacy fallbacks are dropped in a future version.
    if (fromLegacy) saveProfile(profile);
    return profile;
  } catch {
    return null;
  }
}

/**
 * Persist the profile. Returns false when storage is unavailable (private
 * browsing, quota exceeded, storage disabled) so callers can warn the player
 * instead of silently losing their name.
 */
export function saveProfile(p: Profile): boolean {
  try {
    const json = JSON.stringify(p);
    localStorage.setItem(KEY, json);
    // Read back: some browsers accept the write then discard it.
    return localStorage.getItem(KEY) === json;
  } catch {
    return false;
  }
}

export function sanitizeName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 _-]/g, "").slice(0, MAX_NAME);
}

/* ---------------- rename budget ---------------- */

/** Rename timestamps still inside the rolling window. */
export function recentNameChanges(p: Profile, now = Date.now()): number[] {
  return p.nameChanges.filter((t) => now - t < NAME_WINDOW_MS);
}

export function nameChangesLeft(p: Profile, now = Date.now()): number {
  return Math.max(0, NAME_LIMIT - recentNameChanges(p, now).length);
}

/**
 * Guests claiming a username for the first time do so for free — that's
 * profile creation, not a rename. After that the 14-day budget applies.
 */
export function canChangeName(p: Profile, now = Date.now()): boolean {
  return p.guest || nameChangesLeft(p, now) > 0;
}

/** When the next rename slot frees up, or null if one is already available. */
export function nextNameChangeAt(p: Profile, now = Date.now()): number | null {
  if (canChangeName(p, now)) return null;
  const recent = recentNameChanges(p, now).sort((a, b) => a - b);
  return recent[0] + NAME_WINDOW_MS;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${Math.max(1, m)}m`;
}

/**
 * Rename the player, consuming a slot only when the name actually changed on
 * a non-guest profile. Returns the updated profile (unchanged if not allowed).
 */
export function applyRename(
  current: Profile,
  nextName: string,
  now = Date.now()
): Profile {
  const wantsRename = nextName !== current.name;
  const allowed = wantsRename && canChangeName(current, now);
  const consumes = allowed && !current.guest;

  return {
    ...current,
    name: allowed ? nextName : current.name,
    guest: allowed ? false : current.guest,
    nameChanges: consumes
      ? [...recentNameChanges(current, now), now]
      : recentNameChanges(current, now),
  };
}
