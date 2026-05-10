# Releasing VidPeek

VidPeek releases are manual. Do not publish from CI.

## Pre-release Checks

```bash
git status
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:dry
```

You can also run the combined release check:

```bash
pnpm release:check
```

## Local Tarball Consumer Test

Run the smoke script:

```bash
pnpm smoke:consumer
```

Or test manually:

```bash
pnpm build
npm pack
mkdir ../vidpeek-consumer-test
cd ../vidpeek-consumer-test
npm init -y
npm install ../vidpeek/vidpeek-1.0.0.tgz
npx vidpeek --help
```

## Real FFmpeg Smoke Test

Use a real local video file:

```bash
node dist/cli.js path/to/video.mp4 --out preview.webp --preset web --overwrite
node dist/cli.js path/to/video.mp4 --out preview.webp --preset tiny --json --overwrite
node dist/cli.js thumbnail path/to/video.mp4 --out thumb.jpg --at 25% --width 640 --overwrite
node dist/cli.js probe path/to/video.mp4 --json
```

On Windows, also test paths with spaces:

```bat
node dist\cli.js "path\to\sample video.mp4" --out "output preview.webp" --preset web --overwrite
```

## Manual Publish

```bash
npm login
npm publish --dry-run
npm publish
```

## After Publish

```bash
git tag v1.0.0
git push origin main --tags
```

Then create a GitHub release for `v1.0.0`.

Finally, test install from npm:

```bash
mkdir ../vidpeek-npm-install-test
cd ../vidpeek-npm-install-test
npm init -y
npm install vidpeek
npx vidpeek --help
```
