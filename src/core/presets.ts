import { z } from "zod";
import { VidPeekError } from "./errors";
import type {
  GeneratePreviewOptions,
  PreviewFormat,
  SceneFallback,
  VidPeekPreset,
} from "../types/public";

export interface ResolvedGeneratePreviewOptions extends GeneratePreviewOptions {
  format: PreviewFormat;
  preset: VidPeekPreset;
  strategy: NonNullable<GeneratePreviewOptions["strategy"]>;
  clips: {
    count: number;
    duration: number;
    range: [number, number];
    segments?: NonNullable<GeneratePreviewOptions["clips"]>["segments"];
    scene: {
      threshold: number;
      minGap: number;
      fallback: SceneFallback;
      maxCandidates: number;
      analysisFps?: number;
    };
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

const sceneOptionsSchema = z.object({
  threshold: z.number().finite().min(0).max(100).optional(),
  minGap: z.number().finite().min(0).optional(),
  fallback: z.enum(["evenly-spaced", "none", "error"]).optional(),
  maxCandidates: z.number().int().positive().optional(),
  analysisFps: z.number().finite().positive().optional(),
});

const optionsSchema = z.object({
  input: z.string().min(1, "input is required"),
  output: z.string().min(1, "output is required"),
  format: z.enum(["webp", "gif", "mp4"]).optional(),
  preset: z.enum(["tiny", "web", "discord", "high-quality"]).optional(),
  strategy: z.enum(["evenly-spaced", "random", "manual", "scene-change"]).optional(),
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
      scene: sceneOptionsSchema.optional(),
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
  const clipDuration = parsed.data.clips?.duration ?? preset.clips.duration;
  const clips = {
    count: parsed.data.clips?.count ?? preset.clips.count,
    duration: clipDuration,
    range: parsed.data.clips?.range ?? ([0.05, 0.95] as [number, number]),
    segments: parsed.data.clips?.segments,
    scene: {
      threshold: parsed.data.clips?.scene?.threshold ?? 10,
      minGap: parsed.data.clips?.scene?.minGap ?? clipDuration,
      fallback: parsed.data.clips?.scene?.fallback ?? "evenly-spaced",
      maxCandidates: parsed.data.clips?.scene?.maxCandidates ?? 200,
      analysisFps: parsed.data.clips?.scene?.analysisFps,
    },
  };
  const strategy = parsed.data.strategy ?? "evenly-spaced";

  if (strategy === "manual" && !clips.segments?.length) {
    throw new VidPeekError("Manual strategy requires clips.segments.", {
      code: "MISSING_MANUAL_SEGMENTS",
    });
  }

  if (strategy !== "scene-change" && parsed.data.clips?.scene !== undefined) {
    throw new VidPeekError("clips.scene requires strategy: scene-change.", {
      code: "INVALID_OPTIONS",
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
