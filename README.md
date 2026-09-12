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

## Data

Profiles, settings, and career statistics are stored locally in the player's browser. They are not uploaded to GitHub or a server.