import { VidPeekError } from "./errors";
import type { ResolvedGeneratePreviewOptions } from "./presets";
import { analyzeSceneChanges, type SceneCandidate } from "./scene-detection";
import { selectSegments } from "./segments";
import type { SelectedSegment } from "../types/public";

const DISTINCT_START_EPSILON = 0.001;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getSelectionWindow(
  duration: number,
  options: ResolvedGeneratePreviewOptions,
): { start: number; end: number } {
  const maxStart = Math.max(duration - Math.min(options.clips.duration, duration), 0);
  const start = clamp(duration * options.clips.range[0], 0, maxStart);
  const end = clamp(duration * options.clips.range[1], start, maxStart);
  return { start, end };
}

function toSegment(
  start: number,
  duration: number,
  videoDuration: number,
  source: SelectedSegment["source"],
  sceneScore?: number,
): SelectedSegment {
  const availableDuration = Math.max(videoDuration - start, 0.001);
  return {
    index: 0,
    start,
    duration: Math.min(duration, availableDuration),
    source,
    ...(sceneScore === undefined ? {} : { sceneScore }),
  };
}

function isDistinct(start: number, segments: SelectedSegment[]): boolean {
  return segments.every((segment) => Math.abs(segment.start - start) >= DISTINCT_START_EPSILON);
}

function respectsGap(start: number, segments: SelectedSegment[], minGap: number): boolean {
  return segments.every((segment) => Math.abs(segment.start - start) >= minGap);
}

function evenlySpacedStarts(start: number, end: number, count: number): number[] {
  if (count <= 1 || start === end) {
    return [start + (end - start) / 2];
  }

  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

function distanceToNearest(start: number, segments: SelectedSegment[]): number {
  return segments.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...segments.map((segment) => Math.abs(segment.start - start)));
}

export function selectSceneSegments(
  duration: number,
  options: ResolvedGeneratePreviewOptions,
  candidates: SceneCandidate[],
): SelectedSegment[] {
  const { start: rangeStart, end: rangeEnd } = getSelectionWindow(duration, options);
  const sceneOptions = options.clips.scene;
  const rankedCandidates = candidates
    .filter(
      (candidate) =>
        candidate.time >= rangeStart &&
        candidate.time <= rangeEnd &&
        candidate.score >= sceneOptions.threshold,
    )
    .sort((a, b) => b.score - a.score || a.time - b.time)
    .slice(0, sceneOptions.maxCandidates);

  const selected: SelectedSegment[] = [];
  for (const candidate of rankedCandidates) {
    if (selected.length >= options.clips.count) {
      break;
    }
    if (!respectsGap(candidate.time, selected, sceneOptions.minGap)) {
      continue;
    }
    selected.push(
      toSegment(
        candidate.time,
        options.clips.duration,
        duration,
        "scene-change",
        candidate.score,
      ),
    );
  }

  if (selected.length < options.clips.count && sceneOptions.fallback === "error") {
    throw new VidPeekError(
      `Scene detection selected ${selected.length} clips, but ${options.clips.count} were requested.`,
      { code: "INSUFFICIENT_SCENES", stage: "scene selection" },
    );
  }

  if (selected.length < options.clips.count && sceneOptions.fallback === "evenly-spaced") {
    const poolSize = Math.max(options.clips.count * 20, 20);
    const idealStarts = evenlySpacedStarts(rangeStart, rangeEnd, options.clips.count);
    const denseStarts = evenlySpacedStarts(rangeStart, rangeEnd, poolSize);
    const fallbackStarts = [...idealStarts, ...denseStarts].filter(
      (start, index, values) =>
        values.findIndex((value) => Math.abs(value - start) < DISTINCT_START_EPSILON) === index,
    );

    for (const requireGap of [true, false]) {
      const orderedStarts = [...fallbackStarts].sort(
        (a, b) => distanceToNearest(b, selected) - distanceToNearest(a, selected) || a - b,
      );
      for (const fallbackStart of orderedStarts) {
        if (selected.length >= options.clips.count) {
          break;
        }
        if (!isDistinct(fallbackStart, selected)) {
          continue;
        }
        if (requireGap && !respectsGap(fallbackStart, selected, sceneOptions.minGap)) {
          continue;
        }
        selected.push(
          toSegment(fallbackStart, options.clips.duration, duration, "fallback"),
        );
      }
    }
  }

  return selected
    .sort((a, b) => a.start - b.start)
    .map((segment, index) => ({ ...segment, index }));
}

export async function planPreviewSegments(
  input: string,
  duration: number,
  options: ResolvedGeneratePreviewOptions,
): Promise<SelectedSegment[]> {
  if (options.strategy !== "scene-change") {
    return selectSegments(duration, options);
  }

  const window = getSelectionWindow(duration, options);
  const candidates = await analyzeSceneChanges({
    input,
    start: window.start,
    end: window.end,
    threshold: options.clips.scene.threshold,
    analysisFps: options.clips.scene.analysisFps,
    ffmpegPath: options.ffmpegPath,
  });

  return selectSceneSegments(duration, options, candidates);
}
