# Contributing to VidPeek

Thanks for your interest in contributing to VidPeek. Small fixes, sharper docs, tiny tests, and rough-edge reports are all welcome.

VidPeek is preview generation infrastructure for media apps. It is not trying to become a general video editor. The project focuses on animated previews, thumbnails, segment selection, safe temp handling, presets, CLI UX, readable FFmpeg errors, and typed Node APIs.

## Local Setup

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

For real video generation, make sure FFmpeg and FFprobe are installed:

```bash
ffmpeg -version
ffprobe -version
```

## Running the CLI Locally

Place a sample video at:

```txt
benchmarks/fixtures/sample.mp4
```

Then run:

```bash
pnpm dev ./benchmarks/fixtures/sample.mp4 --out ./preview.webp --preset web --overwrite
```

## Running Benchmarks

Place `sample.mp4` in `benchmarks/fixtures/`, then run:

```bash
pnpm bench
```

If the sample video is missing, the benchmark script should exit cleanly with instructions.

## Good Contribution Areas

- Docs
- Tests
- Presets
- CLI UX
- FFmpeg pipeline reliability
- Segment strategies
- Benchmarks
- Examples
- Better error messages

## Code Style

VidPeek should stay small, typed, and maintainable.

- Prefer TypeScript-first APIs.
- Keep public APIs typed and explicit.
- Do not build shell command strings for FFmpeg.
- Use `child_process.spawn` with argument arrays.
- Preserve useful FFmpeg stderr in errors.
- Keep errors readable for humans and useful for scripts.
- Keep core logic testable without requiring FFmpeg where possible.
- Unit tests should avoid requiring FFmpeg unless specifically testing integration behavior.
- Avoid heavy dependencies unless they clearly improve the project.
- Keep CLI behavior predictable and scriptable.

## FFmpeg Rules

VidPeek shells out to FFmpeg and FFprobe. Be careful with:

- User-provided paths
- Temp directories
- Overwrite behavior
- Argument ordering
- Error output
- Cross-platform compatibility

Avoid patterns like:

```ts
`ffmpeg ${options} ${input} ${output}`;
```

Prefer:

```ts
spawn("ffmpeg", ["-i", input, output]);
```

## Commit Message Examples

```bash
feat: add scene-change segment strategy
fix: preserve stderr in ffmpeg errors
docs: clarify ffmpeg installation
test: add segment range validation cases
```

## Pull Request Checklist

Before opening a PR, try to run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

For FFmpeg-related changes, also test with a real video file.

A good PR includes:

- A clear summary
- Why the change matters
- Any relevant CLI/API examples
- Tests when possible
- README or docs updates when behavior changes
- A note on whether FFmpeg is required to test it

## Project Scope

Good fits for VidPeek:

- Preview generation
- Animated WebP/GIF/MP4 previews
- Segment selection
- Contact sheets
- Sprites
- Benchmarks
- Safe FFmpeg orchestration
- CLI and library developer experience

Probably out of scope:

- Full video editing timelines
- Complex transcoding suites
- Streaming servers
- Media hosting
- DRM workflows
- GUI video editors
