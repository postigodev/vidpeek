import { probeVideo } from "./ffprobe";
import { assertInputFileExists } from "./output";
import { resolveOptions } from "./presets";
import { planPreviewSegments } from "./plan-segments";
import type { GeneratePreviewOptions, PreviewDryRunResult } from "../types/public";

export async function dryRunPreview(options: GeneratePreviewOptions): Promise<PreviewDryRunResult> {
  const resolved = resolveOptions(options);
  await assertInputFileExists(resolved.input);
  const metadata = await probeVideo(resolved.input, resolved.ffprobePath);
  const segments = await planPreviewSegments(resolved.input, metadata.duration, resolved);

  return {
    input: resolved.input,
    output: resolved.output,
    preset: resolved.preset,
    strategy: resolved.strategy,
    format: resolved.format,
    duration: metadata.duration,
    segments,
    options: {
      width: resolved.width,
      height: resolved.height,
      fps: resolved.fps,
      speed: resolved.speed,
      clips: {
        count: resolved.clips.count,
        duration: resolved.clips.duration,
        range: resolved.clips.range,
        ...(resolved.strategy === "scene-change" ? { scene: resolved.clips.scene } : {}),
      },
      overwrite: resolved.overwrite,
    },
    ffmpegRequired: true,
  };
}
