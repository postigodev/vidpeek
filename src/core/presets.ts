import { z } from "zod";
import { VidPeekError } from "./errors";
import type { GeneratePreviewOptions, PreviewFormat, VidPeekPreset } from "../types/public";

export interface ResolvedGeneratePreviewOptions extends GeneratePreviewOptions {
  format: PreviewFormat;
  preset: VidPeekPreset;
  strategy: NonNullable<GeneratePreviewOptions["strategy"]>;
  clips: {
    count: number;
    duration: number;
    range: [number, number];
    segments?: NonNullable<GeneratePreviewOptions["clips"]>["segments"];
  };
  fps: number;
  speed: number;
  overwrite: boolean;
  keepTemp: boolean;
  ffmpegPath: string;
  ffprobePath: string;
}

export const PRESETS = {
  tiny: {
    format: "webp",
    width: 240,
    fps: 8,
    clips: { count: 4, duration: 1.5 },
  },
  web: {
    format: "webp",
    width: 320,
    fps: 10,
    clips: { count: 5, duration: 2 },
  },
  discord: {
    format: "webp",
    width: 360,
    fps: 12,
    clips: { count: 4, duration: 2 },
  },
  "high-quality": {
    format: "webp",
    width: 480,
    fps: 15,
    clips: { count: 6, duration: 2 },
  },
} as const satisfies Record<
  VidPeekPreset,
  Pick<ResolvedGeneratePreviewOptions, "format" | "fps" | "width"> & {
    clips: Pick<ResolvedGeneratePreviewOptions["clips"], "count" | "duration">;
  }
>;

const manualSegmentSchema = z.object({
  start: z.number().finite().min(0),
  duration: z.number().finite().positive(),
});

const optionsSchema = z.object({
  input: z.string().min(1, "input is required"),
  output: z.string().min(1, "output is required"),
  format: z.enum(["webp", "gif", "mp4"]).optional(),
  preset: z.enum(["tiny", "web", "discord", "high-quality"]).optional(),
  strategy: z.enum(["evenly-spaced", "random", "manual"]).optional(),
  clips: z
    .object({
      count: z.number().int().positive().optional(),
      duration: z.number().finite().positive().optional(),
      range: z
        .tuple([z.number().finite(), z.number().finite()])
        .refine(([start, end]) => start >= 0 && end <= 1 && start < end, {
          message: "range must be [start,end] normalized between 0 and 1 with start < end",
        })
        .optional(),
      segments: z.array(manualSegmentSchema).nonempty().optional(),
    })
    .optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().finite().positive().optional(),
  speed: z.number().finite().positive().optional(),
  overwrite: z.boolean().optional(),
  keepTemp: z.boolean().optional(),
  ffmpegPath: z.string().min(1).optional(),
  ffprobePath: z.string().min(1).optional(),
});

export function resolveOptions(options: GeneratePreviewOptions): ResolvedGeneratePreviewOptions {
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new VidPeekError(`Invalid VidPeek options: ${message}`, {
      code: "INVALID_OPTIONS",
    });
  }

  const presetName = parsed.data.preset ?? "web";
  const preset = PRESETS[presetName];
  const clips = {
    count: parsed.data.clips?.count ?? preset.clips.count,
    duration: parsed.data.clips?.duration ?? preset.clips.duration,
    range: parsed.data.clips?.range ?? ([0.05, 0.95] as [number, number]),
    segments: parsed.data.clips?.segments,
  };
  const strategy = parsed.data.strategy ?? "evenly-spaced";

  if (strategy === "manual" && !clips.segments?.length) {
    throw new VidPeekError("Manual strategy requires clips.segments.", {
      code: "MISSING_MANUAL_SEGMENTS",
    });
  }

  return {
    ...parsed.data,
    format: parsed.data.format ?? preset.format,
    preset: presetName,
    strategy,
    clips,
    width: parsed.data.width ?? preset.width,
    fps: parsed.data.fps ?? preset.fps,
    speed: parsed.data.speed ?? 1,
    overwrite: parsed.data.overwrite ?? false,
    keepTemp: parsed.data.keepTemp ?? false,
    ffmpegPath: parsed.data.ffmpegPath ?? "ffmpeg",
    ffprobePath: parsed.data.ffprobePath ?? "ffprobe",
  };
}
