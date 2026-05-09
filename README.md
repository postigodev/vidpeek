# VidPeek

Generate previews. Not FFmpeg headaches.

Modern typed video preview generation for Node and CLI. VidPeek turns videos into lightweight animated previews using FFmpeg, with clean presets, safe temp handling, typed options, and a CLI designed for media apps.

## Installation

```bash
pnpm add vidpeek
```

```bash
npm install vidpeek
```

## FFmpeg Requirement

VidPeek uses FFmpeg and FFprobe under the hood. Install both and make sure `ffmpeg` and `ffprobe` are available on your `PATH`, or pass custom binary paths with `--ffmpeg-path`, `--ffprobe-path`, `ffmpegPath`, and `ffprobePath`.

## CLI Usage

```bash
vidpeek input.mp4 --out preview.webp
```

```bash
vidpeek input.mp4 \
  --out preview.webp \
  --preset web \
  --strategy evenly-spaced \
  --clips 5 \
  --clip-duration 2 \
  --width 320 \
  --fps 10
```

Print JSON for application workflows:

```bash
vidpeek input.mp4 --out preview.webp --json
```

## Node API

```ts
import { generatePreview } from "vidpeek";

await generatePreview({
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
});
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
| `input` | `string` | Input video path. |
| `output` | `string` | Output preview path. |
| `format` | `"webp" \| "gif" \| "mp4"` | Output format. Defaults from the selected preset. |
| `preset` | `"tiny" \| "web" \| "discord" \| "high-quality"` | Preview preset. Defaults to `web`. |
| `strategy` | `"evenly-spaced" \| "random" \| "manual"` | Segment selection strategy. Defaults to `evenly-spaced`. |
| `clips.count` | `number` | Number of clips to sample. |
| `clips.duration` | `number` | Duration of each sampled clip in seconds. |
| `clips.range` | `[number, number]` | Normalized sampling range. Defaults to `[0.05, 0.95]`. |
| `clips.segments` | `{ start: number; duration: number }[]` | Required for manual segment selection. |
| `width` | `number` | Output width. |
| `height` | `number` | Output height. |
| `fps` | `number` | Output frames per second. |
| `speed` | `number` | Preview speed multiplier. |
| `overwrite` | `boolean` | Replace an existing output file. |
| `keepTemp` | `boolean` | Keep the temporary work directory for debugging. |
| `ffmpegPath` | `string` | Custom FFmpeg binary path. |
| `ffprobePath` | `string` | Custom FFprobe binary path. |

## Benchmark

Place a sample video at `benchmarks/fixtures/sample.mp4`, then run:

```bash
pnpm bench
```

The benchmark generates `tiny`, `web`, and `high-quality` previews and prints elapsed time plus output file size.

## Why VidPeek

- Typed API for Node apps.
- CLI and library from the same core pipeline.
- Safe per-run temp directories.
- No shell command strings.
- Readable FFmpeg and FFprobe errors.
- Useful presets for real media product workflows.

## Roadmap

- Scene-change strategy.
- Contact sheets.
- Sprites.
- AVIF previews.
- Worker and concurrency options.

## License

MIT
