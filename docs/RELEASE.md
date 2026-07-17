# Releasing Deepiri Emotion Desktop

Canonical repo: [Team-Deepiri/deepiri-emotion](https://github.com/Team-Deepiri/deepiri-emotion). The old name `deepiri-emotion-desktop` redirects here (clone and release URLs keep working).

GitHub Actions builds installers for macOS, Linux, and Windows when you push a version tag. Assets are uploaded to a GitHub Release with fixed filenames used by the [Deepiri landing site](https://github.com/Team-Deepiri/deepiri-landing).

## Cut a release

1. Merge your changes to `main`.
2. Bump `version` in `package.json` if needed (installer metadata only; release asset names stay `*-latest.*`).
3. Tag and push:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. Watch the [Release workflow](https://github.com/Team-Deepiri/deepiri-emotion/actions/workflows/release.yml) on GitHub. When it finishes, the tag has a release with three installers.

## Test builds without tagging

Use **Actions → Release → Run workflow** on a branch. This runs all three OS build jobs only; the publish job is skipped unless the ref is a `v*` tag.

## Release assets

| Platform | Filename |
|----------|----------|
| macOS (arm64) | `Deepiri-Emotion-latest-arm64.dmg` |
| Linux | `Deepiri-Emotion-latest.AppImage` |
| Windows | `Deepiri-Emotion-latest-setup.exe` |

## Verify download URLs

After the workflow succeeds, confirm each asset is reachable (HTTP 302 or 200):

```bash
BASE=https://github.com/Team-Deepiri/deepiri-emotion/releases/latest/download

curl -I "$BASE/Deepiri-Emotion-latest-arm64.dmg"
curl -I "$BASE/Deepiri-Emotion-latest.AppImage"
curl -I "$BASE/Deepiri-Emotion-latest-setup.exe"
```

The `deepiri-emotion-desktop` hostname redirects to `deepiri-emotion`; either URL works.

You can also open the [latest release](https://github.com/Team-Deepiri/deepiri-emotion/releases/latest) page and download each file manually.

## Code signing (v1)

CI builds are **unsigned**. That is expected for early releases:

- **macOS:** Gatekeeper may block the app until you right-click → Open, or allow it in System Settings.
- **Windows:** SmartScreen may warn on first run.

Signed/notarized builds can be added later with Apple and Windows certificates in GitHub Actions secrets.
