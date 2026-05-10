# Changelog

All notable changes to VidPeek are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning.

## [1.0.0] - 2026-05-10

### Added

- Stable CLI for preview generation.
- Node API for `generatePreview()`.
- Thumbnail generation with `generateThumbnail()`.
- FFprobe metadata probing with `probeVideo()`.
- Dry-run preview planning with `dryRunPreview()`.
- JSON output for preview, thumbnail, probe, and dry-run workflows.
- Preview presets for tiny, web, Discord, and high-quality output.
- Safe unique temp directories with cleanup by default.
- Overwrite protection for preview and thumbnail outputs.
- Readable FFmpeg/FFprobe errors with stage, command, exit code, and stderr.
- Benchmark script for preset comparisons.
- CI and release checks for typecheck, tests, build, and package dry-run.
