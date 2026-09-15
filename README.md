# TYPULSE

A fast-paced browser typing game with shrinking approach rings, speed-based scoring, smooth difficulty progression, profiles, career statistics, and four difficulty modes.

## Play Locally

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production Build

```bash
npm run build
```

The complete game is generated in `dist/index.html`. JavaScript and CSS are inlined into that file.

## Publish With GitHub Pages

This repository includes `.github/workflows/deploy-pages.yml`. It builds and publishes the game automatically whenever code is pushed to the `main` branch.

1. Create a new empty repository on GitHub. Do not add a README, license, or `.gitignore` during creation.
2. Copy the repository URL from GitHub.
3. Run the commands below from this project directory, replacing the sample URL with your own.

```bash
git init
git add .
git commit -m "Publish TYPULSE"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/typulse.git
git push -u origin main
```

4. Open the repository on GitHub.
5. Go to **Settings > Pages**.
6. Under **Build and deployment**, set **Source** to **GitHub Actions**.
7. Open the **Actions** tab and wait for **Deploy TYPULSE to GitHub Pages** to finish.
8. Open the live URL shown by the deployment. It will normally be `https://YOUR_USERNAME.github.io/typulse/`.

Future updates only need:

```bash
git add .
git commit -m "Update TYPULSE"
git push
```

Every push to `main` triggers a fresh deployment.

## Monetisation (Google AdSense)

Ad support is built in but **switched off** until you add your IDs. While it is
off, no ad script loads and the layout is full-bleed — identical to a game with
no ads at all.

### Step 1 — get approved

1. Sign up at [adsense.google.com](https://adsense.google.com) with a Google account.
2. Add your live site URL, e.g. `https://YOUR_USERNAME.github.io/typulse/`.
3. Paste the snippet it gives you — or skip it, since the site injects it once
   you complete step 2 below.
4. Wait for review. This usually takes a few days to two weeks.

**Approval requirements that catch people out:**

- The site **must already be live** at a real URL. Deploy to GitHub Pages first.
- You need a **privacy policy** explaining cookies and data use. AdSense will
  not approve a site without one, and it is legally required for European and
  UK visitors.
- You must be **18 or older** and have a verified payment address.
- Brand-new sites with no traffic history are reviewed more slowly.

### Step 2 — turn the ads on

Create an ad unit in AdSense (**Ads → By ad unit → Display ads**, vertical
160x600), then open `src/game/ads.ts` and fill in:

```ts
export const ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";
export const AD_SLOT_SIDE = "1234567890";
```

Rebuild and redeploy. The left and right rails appear automatically on
viewports 1280px and wider, and stay hidden on narrower screens so gameplay is
never squeezed.

### Step 3 — add ads.txt (after approval)

AdSense will warn about a missing `ads.txt`. Create `public/ads.txt` in the
project containing your publisher line:

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

The `pub-` value is your publisher ID **without** the `ca-` prefix. Rebuild and
redeploy — Vite copies it to the site root.

### Notes

- **European / UK traffic:** Google requires a consent management platform for
  personalised ads. Enable **Privacy & messaging → GDPR** in AdSense and use
  their built-in CMP, which needs no extra code.
- **Do not click your own ads.** AdSense treats this as invalid traffic and it
  is the fastest way to lose the account.
- Side ads stay visible while the game is paused, which is where they are most
  seen without interrupting play.

## Data

Profiles, settings, and career statistics are stored locally in the player's browser. They are not uploaded to GitHub or a server.