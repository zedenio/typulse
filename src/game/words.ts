import { TIERS, TOTAL_WORDS } from "./dictionary";

export { TOTAL_WORDS };

/**
 * A "shuffle bag" word source.
 *
 * Each length-tier gets its own independently shuffled queue. Words are drawn
 * sequentially from the queue, so a word can never repeat until its entire
 * tier has been exhausted (hundreds to thousands of words — far longer than
 * any single run). A fresh bag is created every time a run starts, so the
 * order is different on every mode click.
 */
export class WordBag {
  private orders: Uint16Array[] = [];
  private cursors: number[] = [];

  constructor() {
    for (const pool of TIERS) {
      const order = new Uint16Array(pool.length);
      for (let i = 0; i < pool.length; i++) order[i] = i;
      this.shuffle(order);
      this.orders.push(order);
      this.cursors.push(0);
    }
  }

  /** Fisher-Yates, seeded by Math.random for a fresh order each session. */
  private shuffle(a: Uint16Array) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
  }

  /**
   * Draw the next unused word from a tier, preferring one whose first letter
   * isn't already claimed by an on-screen word (so typing stays unambiguous).
   */
  private drawFrom(tier: number, avoid: Set<string>): string {
    const pool = TIERS[tier];
    const order = this.orders[tier];
    if (this.cursors[tier] >= order.length) {
      // Tier exhausted — reshuffle for a brand-new cycle.
      this.shuffle(order);
      this.cursors[tier] = 0;
    }
    const cur = this.cursors[tier];
    const lookahead = Math.min(24, order.length - cur);
    for (let k = 0; k < lookahead; k++) {
      const w = pool[order[cur + k]];
      if (!avoid.has(w[0])) {
        // Swap the pick into the cursor slot so nothing is skipped/lost.
        const t = order[cur]; order[cur] = order[cur + k]; order[cur + k] = t;
        this.cursors[tier]++;
        return w;
      }
    }
    this.cursors[tier]++;
    return pool[order[cur]];
  }

  /**
   * Pick a word appropriate for the current level, biased toward that
   * level's tier with a sprinkle of easier words for rhythm variety.
   */
  next(level: number, avoidFirstLetters: Set<string>): string {
    const base = Math.min(TIERS.length - 1, Math.floor((level - 1) / 2));
    const roll = Math.random();
    let tier = base;
    if (roll < 0.18 && base > 0) tier = base - 1;
    else if (roll < 0.24) tier = (Math.random() * (base + 1)) | 0;
    return this.drawFrom(tier, avoidFirstLetters);
  }
}
