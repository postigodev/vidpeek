import { writeFile } from "node:fs/promises";
import path from "node:path";
import { toVidPeekError, VidPeekError } from "./errors";
import { runFfmpeg } from "./ffmpeg";
import { probeVideo } from "./ffprobe";
import {
  assertCanWriteOutput,
  assertInputFileExists,
  ensureOutputDirectory,
  getFileSize,
} from "./output";
import { resolveOptions } from "./presets";
import { planPreviewSegments } from "./plan-segments";
import { cleanupTempDir, createTempDir } from "./temp";
import type { GeneratePreviewOptions, GeneratePreviewResult, PreviewFormat } from "../types/public";

function formatSeconds(value: number): string {
  return value.toFixed(3);
}

function buildVideoFilters(options: {
  fps?: number;
  width?: number;
  height?: number;
  speed?: number;
}): string[] {
  const filters: string[] = [];

  if (options.fps) {
    filters.push(`fps=${options.fps}`);
  }

  if (options.width && options.height) {
    filters.push(`scale=${options.width}:${options.height}`);
  } else if (options.width) {
    filters.push(`scale=${options.width}:-2`);
  } else if (options.height) {
    filters.push(`scale=-2:${options.height}`);
  }

  if (options.speed && options.speed !== 1) {
    filters.push(`setpts=${1 / options.speed}*PTS`);
  }

  return filters;
}

function concatFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return `file '${normalized.replace(/'/g, "'\\''")}'`;
}

function overwriteArg(overwrite: boolean): string {
  return overwrite ? "-y" : "-n";
}

async function transcodeFinal(options: {
  input: string;
  output: string;
  format: PreviewFormat;
  filters: string[];
  overwrite: boolean;
  ffmpegPath: string;
}): Promise<void> {
  const args = [overwriteArg(options.overwrite), "-i", options.input, "-an"];

  if (options.filters.length > 0) {
    args.push("-vf", options.filters.join(","));
  }

  if (options.format === "webp") {
    args.push("-loop", "0", "-c:v", "libwebp", "-quality", "80", options.output);
  } else if (options.format === "gif") {
    args.push("-f", "gif", options.output);
  } else {
    args.push(
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      options.output,
    );
  }

  await runFfmpeg(args, options.ffmpegPath, "final encoding");
}

export async function generatePreview(
  options: GeneratePreviewOptions,
): Promise<GeneratePreviewResult> {
  const startedAt = performance.now();
  const resolved = resolveOptions(options);
  const tempDir = await createTempDir();

  try {
    await assertInputFileExists(resolved.input);
    await assertCanWriteOutput(resolved.output, resolved.overwrite);
    await ensureOutputDirectory(resolved.output);

    const metadata = await probeVideo(resolved.input, resolved.ffprobePath);
    const segments = await planPreviewSegments(resolved.input, metadata.duration, resolved);
    if (segments.length === 0) {
      throw new VidPeekError("No preview segments were selected.", {
        code: "NO_SEGMENTS_SELECTED",
        stage: "segment selection",
      });
    }
    const clipPaths: string[] = [];

    for (const segment of segments) {
      const clipPath = path.join(tempDir, `clip-${String(segment.index + 1).padStart(3, "0")}.mp4`);
      await runFfmpeg(
        [
          "-y",
          "-ss",
          formatSeconds(segment.start),
          "-t",
          formatSeconds(segment.duration),
          "-i",
          resolved.input,
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          clipPath,
        ],
        resolved.ffmpegPath,
        "segment extraction",
      );
      clipPaths.push(clipPath);
    }

    const fileListPath = path.join(tempDir, "filelist.txt");
    await writeFile(fileListPath, `${clipPaths.map(concatFilePath).join("\n")}\n`, "utf8");

    const mergedPath = path.join(tempDir, "merged.mp4");
    await runFfmpeg(
      ["-y", "-f", "concat", "-safe", "0", "-i", fileListPath, "-c", "copy", mergedPath],
      resolved.ffmpegPath,
      "clip concatenation",
    );

    await transcodeFinal({
      input: mergedPath,
      output: resolved.output,
      format: resolved.format,
      filters: buildVideoFilters(resolved),
      overwrite: resolved.overwrite,
      ffmpegPath: resolved.ffmpegPath,
    });

    return {
      output: resolved.output,
      format: resolved.format,
      duration: metadata.duration,
      segments,
      elapsedMs: Math.round(performance.now() - startedAt),
      sizeBytes: await getFileSize(resolved.output),
    };
  } catch (error) {
    throw toVidPeekError(error);
  } finally {
    if (!resolved.keepTemp) {
      await cleanupTempDir(tempDir);
    }
  }
}
