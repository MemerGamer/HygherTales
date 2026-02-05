# Release checklist

Steps to ship a HygherTales release.

## 0. When does release-please open a PR?

Release-please **only** opens a release PR when it finds **`feat:`** or **`fix:`** commits on `main`. Other types (`chore:`, `docs:`, `ci:`, etc.) are **ignored** and do not trigger a release.

- `feat: something` → minor release (e.g. 0.1.0 → 0.2.0)
- `fix: something` → patch (0.1.0 → 0.1.1)
- `chore:`, `docs:`, merge commits, "update", "wip" → **no release**

If you see **"No user facing commits found - skipping"** in the Actions log, there were no `feat:` or `fix:` commits since the last release.

**To trigger a release with an empty commit (use `fix:` or `feat:`):**

```bash
git commit --allow-empty -m "fix: release"
git push origin main
```

Or use a real change: `feat: add X`, `fix: Y`, etc.

## 1. Merge release-please PR

Release-please opens a PR when such commits exist on `main`. Merging it:

- Bumps version in `package.json`
- Updates `CHANGELOG.md`
- Creates a git tag (e.g. `v0.0.2`)
- Triggers CI builds

## 2. CI builds (automatic)

After merging the release PR, GitHub Actions builds:

- Windows `.msi` installer
- macOS `.dmg` and universal `.app.tar.gz`
- Linux `.deb`, `.AppImage`, and update artifacts
- Proxy Docker image (`proxy-image.tar.gz`)

All artifacts attach to the GitHub release.

## 3. Deploy proxy

### Option A: Docker (recommended)

Load the image from the release:

```bash
wget https://github.com/yourorg/HygherTales/releases/download/v0.0.2/proxy-image.tar.gz
docker load < proxy-image.tar.gz
```

Or build from source:

```bash
docker build -f apps/proxy/Dockerfile -t hyghertales-proxy:0.0.2 .
```

Run with secrets:

```bash
docker run -d \
  --name hyghertales-proxy \
  -p 8787:8787 \
  -e CURSEFORGE_API_KEY=your_secret_key \
  -e CURSEFORGE_GAME_ID=70216 \
  -e CORS_ORIGINS=https://yourapp.com \
  -e RATE_LIMIT_PER_MIN=120 \
  --restart unless-stopped \
  hyghertales-proxy:0.0.2
```

### Option B: Direct (Bun)

```bash
cd apps/proxy
cp .env.example .env
# Edit .env with CURSEFORGE_API_KEY and CURSEFORGE_GAME_ID
bun run build
bun run start
```

Run behind a reverse proxy (nginx, Caddy) for HTTPS.

## 4. Configure desktop

End users download the installer for their platform from the GitHub release.

After installing:

1. Open HygherTales
2. Go to Settings
3. Set **Proxy base URL** to your hosted proxy (e.g. `https://proxy.example.com`)
4. Set **Mods directory path** (Auto-detect or Browse)
5. Optional: Set **Hytale executable** for Launch feature

## 5. Verify

- Desktop can reach proxy (`/health` returns `{ "ok": true }`)
- Browse page loads mods from CurseForge and Orbis.place
- Download a mod (goes to Mods folder)
- Check updates works
- Profiles switch correctly

## 6. Update proxy CORS (if needed)

If desktop can't reach proxy due to CORS:

- Add the desktop's origin to `CORS_ORIGINS` (for Tauri, test from app and check browser console for actual origin)
- Or set `CORS_ORIGINS=*` for testing (not recommended for production)

## Security reminders

- Never commit `CURSEFORGE_API_KEY` to git
- Never bake secrets into Docker images
- Use HTTPS for production proxy deployments
- Restrict `CORS_ORIGINS` to known origins
- Monitor proxy logs for unusual traffic

---

## Quick reference

**Build desktop locally:**

```bash
bun run build --cwd apps/desktop
```

Outputs in `apps/desktop/src-tauri/target/release/bundle/`.

**Build proxy Docker:**

```bash
docker build -f apps/proxy/Dockerfile -t hyghertales-proxy .
```

**Run proxy dev:**

```bash
bun run dev:proxy
```

**Run desktop dev:**

```bash
bun run dev
```
