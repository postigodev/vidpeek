import { VidPeekError } from "./errors";
import type { ResolvedGeneratePreviewOptions } from "./presets";
import type { ManualSegment, SelectedSegment } from "../types/public";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampSegment(segment: ManualSegment, duration: number, index: number): SelectedSegment {
  if (segment.duration <= 0) {
    throw new VidPeekError("Segment duration must be greater than zero.", {
      code: "INVALID_SEGMENT",
    });
  }

  if (segment.start < 0) {
    throw new VidPeekError("Segment start must be zero or greater.", {
      code: "INVALID_SEGMENT",
    });
  }

  if (segment.start >= duration) {
    throw new VidPeekError("Segment start must be before the end of the video.", {
      code: "INVALID_SEGMENT",
    });
  }

  const start = clamp(segment.start, 0, Math.max(duration - 0.001, 0));
  const availableDuration = Math.max(duration - start, 0.001);

  return {
    index,
    start,
    duration: Math.min(segment.duration, availableDuration),
  };
}

function selectEvenlySpaced(
  duration: number,
  count: number,
  clipDuration: number,
  range: [number, number],
): SelectedSegment[] {
  const maxStart = Math.max(duration - Math.min(clipDuration, duration), 0);
  const rangeStart = clamp(duration * range[0], 0, maxStart);
  const rangeEnd = clamp(duration * range[1], rangeStart, maxStart);
  const window = rangeEnd - rangeStart;

  return Array.from({ length: count }, (_, index) => {
    const start =
      count === 1 ? rangeStart + window / 2 : rangeStart + (window * index) / (count - 1);

    return clampSegment({ start, duration: clipDuration }, duration, index);
  });
}

function selectRandom(
  duration: number,
  count: number,
  clipDuration: number,
  range: [number, number],
): SelectedSegment[] {
  const maxStart = Math.max(duration - Math.min(clipDuration, duration), 0);
  const rangeStart = clamp(duration * range[0], 0, maxStart);
  const rangeEnd = clamp(duration * range[1], rangeStart, maxStart);

  return Array.from({ length: count }, (_, index) => {
    const start = rangeStart + Math.random() * (rangeEnd - rangeStart);
    return clampSegment({ start, duration: clipDuration }, duration, index);
  }).sort((a, b) => a.start - b.start);
}

export function selectSegments(
  duration: number,
  options: Pick<ResolvedGeneratePreviewOptions, "strategy" | "clips">,
): SelectedSegment[] {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new VidPeekError("Video duration must be greater than zero.", {
      code: "INVALID_DURATION",
    });
  }

  if (options.strategy === "manual") {
    if (!options.clips.segments?.length) {
      throw new VidPeekError("Manual strategy requires clips.segments.", {
        code: "MISSING_MANUAL_SEGMENTS",
      });
    }

    return options.clips.segments.map((segment, index) =>
      clampSegment(segment, duration, index),
    );
  }

  if (options.strategy === "scene-change") {
    throw new VidPeekError("Scene-change strategy requires FFmpeg analysis.", {
      code: "SCENE_ANALYSIS_REQUIRED",
    });
  }

  if (options.strategy === "random") {
    return selectRandom(
      duration,
      options.clips.count,
      options.clips.duration,
      options.clips.range,
    );
  }

  return selectEvenlySpaced(
    duration,
    options.clips.count,
    options.clips.duration,
    options.clips.range,
  );
}
