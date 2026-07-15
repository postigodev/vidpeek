# VidPeek

Generate previews. Not FFmpeg headaches.

VidPeek is a typed video preview generation package for Node.js and CLI. It turns media files into lightweight animated previews and thumbnails using FFmpeg/FFprobe, with safe temp handling, useful presets, overwrite protection, JSON output, and readable errors for real developer workflows.

## Features

- Typed Node.js API and scriptable CLI.
- Animated preview generation for WebP, GIF, and MP4.
- Still thumbnail generation for JPG, JPEG, PNG, and WebP.
- FFprobe metadata API for duration, dimensions, FPS, codecs, and format.
- Dry-run preview planning without writing output files.
- Scene-change sampling with configurable detection, spacing, fallback, and analysis speed.
- Presets for common preview sizes.
- Safe per-run temp directories.
- No shell command strings; FFmpeg is called with spawn argument arrays.
- Readable FFmpeg/FFprobe errors with stage, command, exit code, and stderr.

## Requirements

- Node.js 18+
- FFmpeg
- FFprobe

Verify FFmpeg and FFprobe:

```bash
ffmpeg -version
ffprobe -version
```

## Installation

```bash
pnpm add vidpeek
```

```bash
npm install vidpeek
```

## Quick Start

Generate an animated preview:

```bash
vidpeek input.mp4 --out preview.webp --preset web --overwrite
```

Generate a thumbnail:

```bash
vidpeek thumbnail input.mp4 --out thumb.jpg --at 25% --width 640 --overwrite
```

Probe video metadata:

```bash
vidpeek probe input.mp4 --json
```

## CLI Usage

```bash
vidpeek input.mp4 \
  --out preview.webp \
  --preset web \
  --strategy evenly-spaced \
  --clips 5 \
  --clip-duration 2 \
  --width 320 \
  --fps 10 \
  --overwrite
```

Dry-run a preview plan without generating files:

```bash
vidpeek input.mp4 --out preview.webp --preset web --dry-run --json
```

Build a preview from the strongest visual scene changes:

```bash
vidpeek input.mp4 \
  --out scene-preview.webp \
  --strategy scene-change \
  --scene-threshold 10 \
  --scene-min-gap 2 \
  --overwrite
```

Create a thumbnail from a percentage timestamp:

```bash
vidpeek thumbnail input.mp4 --out thumb.png --at 10% --height 360 --overwrite
```

Print readable metadata:

```bash
vidpeek probe input.mp4
```

## Node API

### generatePreview

```ts
import { generatePreview } from "vidpeek";

const result = await generatePreview({
  input: "video.mp4",
  output: "preview.webp",
  preset: "web",
  strategy: "evenly-spaced",
  clips: {
    count: 5,
    duration: 2,
  },
  width: 320,
  fps: 10,
  overwrite: true,
});

console.log(result.sizeBytes);
```

### generateThumbnail

```ts
import { generateThumbnail } from "vidpeek";

await generateThumbnail({
  input: "video.mp4",
  output: "thumb.jpg",
  at: "25%",
  width: 640,
  overwrite: true,
});
```

### probeVideo

```ts
import { probeVideo } from "vidpeek";

const metadata = await probeVideo("video.mp4");

console.log(metadata.duration);
console.log(metadata.width, metadata.height);
console.log(metadata.videoCodec);
```

### dryRunPreview

```ts
import { dryRunPreview } from "vidpeek";

const plan = await dryRunPreview({
  input: "video.mp4",
  output: "preview.webp",
  preset: "web",
});

console.log(plan.segments);
```

### Scene-change strategy

```ts
import { generatePreview } from "vidpeek";

await generatePreview({
  input: "video.mp4",
  output: "scene-preview.webp",
  strategy: "scene-change",
  clips: {
    count: 5,
    duration: 2,
    range: [0.05, 0.95],
    scene: {
      threshold: 10,
      minGap: 2,
      fallback: "evenly-spaced",
      maxCandidates: 200,
      analysisFps: 8,
    },
  },
  overwrite: true,
});
```

Omit `analysisFps` for precise analysis of every frame. Setting it can make long videos faster to analyze, but brief cuts may be skipped.

The equivalent CLI controls are `--scene-threshold`, `--scene-min-gap`, `--scene-fallback`, `--scene-max-candidates`, and `--scene-analysis-fps`. Scene-specific flags require `--strategy scene-change`.

## JSON Output

Preview JSON:

```json
{
  "output": "preview.webp",
  "format": "webp",
  "duration": 128.4,
  "segments": [
    {
      "index": 0,
      "start": 6.42,
      "duration": 2,
      "source": "scene-change",
      "sceneScore": 18.75
    }
  ],
  "elapsedMs": 1842,
  "sizeBytes": 384920
}
```

Thumbnail JSON:

```json
{
  "output": "thumb.jpg",
  "at": 32.1,
  "elapsedMs": 312,
  "sizeBytes": 42188
}
```

Probe JSON:

```json
{
  "duration": 128.4,
  "width": 1920,
  "height": 1080,
  "fps": 29.97,
  "videoCodec": "h264",
  "audioCodec": "aac",
  "format": "mov,mp4,m4a,3gp,3g2,mj2"
}
```

## Presets

| Preset | Format | Width | FPS | Clips | Clip duration |
| --- | --- | ---: | ---: | ---: | ---: |
| `tiny` | `webp` | 240 | 8 | 4 | 1.5s |
| `web` | `webp` | 320 | 10 | 5 | 2s |
| `discord` | `webp` | 360 | 12 | 4 | 2s |
| `high-quality` | `webp` | 480 | 15 | 6 | 2s |

## Options

| Option | Type | Description |
| --- | --- | --- |
| `input` | `string` | Input video path. Must exist locally. |
| `output` | `string` | Output preview or thumbnail path. Parent directories are created. |
| `format` | `"webp" \| "gif" \| "mp4"` | Preview output format. Defaults from the selected preset. |
| `preset` | `"tiny" \| "web" \| "discord" \| "high-quality"` | Preview preset. Defaults to `web`. |
| `strategy` | `"evenly-spaced" \| "random" \| "manual" \| "scene-change"` | Segment selection strategy. Defaults to `evenly-spaced`. |
| `clips.count` | `number` | Number of clips to sample. |
| `clips.duration` | `number` | Duration of each sampled clip in seconds. |
| `clips.range` | `[number, number]` | Normalized sampling range. Defaults to `[0.05, 0.95]`. |
| `clips.segments` | `{ start: number; duration: number }[]` | Required for manual segment selection. |
| `clips.scene.threshold` | `number` | FFmpeg scene score from 0 to 100. Defaults to `10`. |
| `clips.scene.minGap` | `number` | Preferred seconds between selected cuts. Defaults to clip duration. |
| `clips.scene.fallback` | `"evenly-spaced" \| "none" \| "error"` | Behavior when too few cuts are found. `none` may produce zero dry-run segments; generation then fails clearly. Defaults to `evenly-spaced`. |
| `clips.scene.maxCandidates` | `number` | Maximum top-scoring candidates considered. Defaults to `200`. |
| `clips.scene.analysisFps` | `number` | Optional sampling FPS for faster analysis. Omit to inspect every frame. |
| `width` | `number` | Output width. If height is omitted, VidPeek preserves aspect ratio. |
| `height` | `number` | Output height. If width is omitted, VidPeek preserves aspect ratio. |
| `fps` | `number` | Preview frames per second. |
| `speed` | `number` | Preview speed multiplier. |
| `at` | `number \| \`${number}%\`` | Thumbnail timestamp in seconds or percentage. Defaults to `10%`. Values beyond duration clamp to the last valid frame. |
| `overwrite` | `boolean` | Replace an existing output file. |
| `keepTemp` | `boolean` | Keep temporary preview files for debugging. |
| `ffmpegPath` | `string` | Custom FFmpeg binary path. |
| `ffprobePath` | `string` | Custom FFprobe binary path. |

## Overwrite Behavior

VidPeek does not replace existing output files unless you explicitly ask it to.

```bash
vidpeek input.mp4 --out preview.webp
```

If `preview.webp` already exists, this fails with a readable error. Use `--overwrite` to replace it:

```bash
vidpeek input.mp4 --out preview.webp --overwrite
```

The same behavior applies to thumbnails.

## Benchmark

Place a sample video at `benchmarks/fixtures/sample.mp4`, then run:

```bash
pnpm bench
```

The benchmark generates `tiny`, `web`, and `high-quality` previews and prints elapsed time plus output file size.

## Troubleshooting

### FFmpeg Not Found

Install FFmpeg and FFprobe, then verify both commands work:

```bash
ffmpeg -version
ffprobe -version
```

If they are not on `PATH`, pass custom binary paths:

```bash
vidpeek input.mp4 --out preview.webp --ffmpeg-path /path/to/ffmpeg --ffprobe-path /path/to/ffprobe
```

### Invalid Input

VidPeek expects a local file path. Use `vidpeek probe input.mp4 --json` first if you need to inspect metadata before preview generation.

### Scene Detection Not Available

The `scene-change` strategy requires an FFmpeg build containing the `scdet` filter. Check it with:

```bash
ffmpeg -hide_banner -h filter=scdet
```

If it is unavailable, install a fuller FFmpeg build or use another segment strategy.

### Existing Output

Pass `--overwrite` when replacing files intentionally. Without it, VidPeek refuses to overwrite output.

### Windows Paths

Paths with spaces are supported because VidPeek calls FFmpeg with argument arrays:

```bat
vidpeek "benchmarks\fixtures\sample video.mp4" --out "output preview.webp" --preset web --overwrite
```

### Output Directory

Parent output directories are created automatically:

```bash
vidpeek input.mp4 --out previews/preview.webp --overwrite
```

## Visual Output

VidPeek outputs standard media files you can embed anywhere your app, README, dashboard, or pipeline already displays images and video. For a quick local demo, generate a WebP preview and a thumbnail:

```bash
vidpeek input.mp4 --out preview.webp --preset web --overwrite
vidpeek thumbnail input.mp4 --out thumb.jpg --at 25% --width 640 --overwrite
```

## Why VidPeek

- Typed API for Node apps.
- CLI and library from the same core pipeline.
- Safe temp dirs.
- No shell command strings.
- Readable FFmpeg/FFprobe errors.
- Useful presets.
- JSON output for automation.

## Roadmap

- Contact sheets.
- Sprites.
- AVIF previews.
- Worker and concurrency options.

## License

MIT
