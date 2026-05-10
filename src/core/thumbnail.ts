import path from "node:path";
import { z } from "zod";
import { VidPeekError, toVidPeekError } from "./errors";
import { runFfmpeg } from "./ffmpeg";
import { probeVideo } from "./ffprobe";
import {
  assertCanWriteOutput,
  assertInputFileExists,
  ensureOutputDirectory,
  getFileSize,
} from "./output";
import type {
  GenerateThumbnailOptions,
  GenerateThumbnailResult,
  ThumbnailTimestamp,
} from "../types/public";

const supportedThumbnailExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const thumbnailOptionsSchema = z.object({
  input: z.string().min(1, "input is required"),
  output: z.string().min(1, "output is required"),
  at: z.union([z.number().finite().min(0), z.custom<`${number}%`>()]).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  overwrite: z.boolean().optional(),
  ffmpegPath: z.string().min(1).optional(),
  ffprobePath: z.string().min(1).optional(),
});

export function assertValidThumbnailOutput(output: string): void {
  const extension = path.extname(output).toLowerCase();
  if (!supportedThumbnailExtensions.has(extension)) {
    throw new VidPeekError(
      "Thumbnail output must use one of these extensions: .jpg, .jpeg, .png, .webp.",
      { code: "INVALID_THUMBNAIL_FORMAT" },
    );
  }
}

export function parseThumbnailTimestamp(at: ThumbnailTimestamp | undefined, duration: number): number {
  const value = at ?? "10%";

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new VidPeekError("Thumbnail timestamp must be zero or greater.", {
        code: "INVALID_THUMBNAIL_TIMESTAMP",
      });
    }

    return Math.min(value, Math.max(duration - 0.001, 0));
  }

  const match = /^(\d+(?:\.\d+)?)%$/.exec(value);
  if (!match) {
    throw new VidPeekError("Thumbnail percentage must look like 25%.", {
      code: "INVALID_THUMBNAIL_PERCENTAGE",
    });
  }

  const percentage = Number(match[1]);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new VidPeekError("Thumbnail percentage must be between 0% and 100%.", {
      code: "INVALID_THUMBNAIL_PERCENTAGE",
    });
  }

  return Math.min(duration * (percentage / 100), Math.max(duration - 0.001, 0));
}

function buildScaleFilter(width?: number, height?: number): string | undefined {
  if (width && height) {
    return `scale=${width}:${height}`;
  }

  if (width) {
    return `scale=${width}:-2`;
  }

  if (height) {
    return `scale=-2:${height}`;
  }

  return undefined;
}

export async function generateThumbnail(
  options: GenerateThumbnailOptions,
): Promise<GenerateThumbnailResult> {
  const startedAt = performance.now();
  const parsed = thumbnailOptionsSchema.safeParse(options);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new VidPeekError(`Invalid thumbnail options: ${message}`, {
      code: "INVALID_OPTIONS",
    });
  }

  const resolved = {
    ...parsed.data,
    at: parsed.data.at ?? "10%",
    overwrite: parsed.data.overwrite ?? false,
    ffmpegPath: parsed.data.ffmpegPath ?? "ffmpeg",
    ffprobePath: parsed.data.ffprobePath ?? "ffprobe",
  };

  try {
    assertValidThumbnailOutput(resolved.output);
    await assertInputFileExists(resolved.input);
    await assertCanWriteOutput(resolved.output, resolved.overwrite);
    await ensureOutputDirectory(resolved.output);

    const metadata = await probeVideo(resolved.input, resolved.ffprobePath);
    const at = parseThumbnailTimestamp(resolved.at, metadata.duration);
    const scaleFilter = buildScaleFilter(resolved.width, resolved.height);
    const args = [
      resolved.overwrite ? "-y" : "-n",
      "-ss",
      at.toFixed(3),
      "-i",
      resolved.input,
      "-frames:v",
      "1",
    ];

    if (scaleFilter) {
      args.push("-vf", scaleFilter);
    }

    args.push(resolved.output);

    await runFfmpeg(args, resolved.ffmpegPath, "thumbnail generation");

    return {
      output: resolved.output,
      at,
      elapsedMs: Math.round(performance.now() - startedAt),
      sizeBytes: await getFileSize(resolved.output),
    };
  } catch (error) {
    throw toVidPeekError(error);
  }
}
