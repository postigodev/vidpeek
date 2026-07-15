import { runFfmpeg } from "./ffmpeg";

export interface SceneCandidate {
  time: number;
  score: number;
}

const NUMBER_PATTERN = "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?";
const FRAME_TIME_PATTERN = new RegExp(`(?:^|\\s)pts_time:(${NUMBER_PATTERN})(?:\\s|$)`);
const SCENE_TIME_PATTERN = new RegExp(`^lavfi\\.scd\\.time=(${NUMBER_PATTERN})$`);
const SCENE_SCORE_PATTERN = new RegExp(`^lavfi\\.scd\\.score=(${NUMBER_PATTERN})$`);

export function parseSceneMetadata(output: string): SceneCandidate[] {
  const candidates: SceneCandidate[] = [];
  let frameTime: number | undefined;
  let sceneTime: number | undefined;
  let score: number | undefined;

  const flush = (): void => {
    const time = sceneTime ?? frameTime;
    if (time !== undefined && score !== undefined && Number.isFinite(time) && Number.isFinite(score)) {
      candidates.push({ time, score });
    }
    frameTime = undefined;
    sceneTime = undefined;
    score = undefined;
  };

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("frame:")) {
      flush();
      const match = FRAME_TIME_PATTERN.exec(line);
      frameTime = match ? Number(match[1]) : undefined;
      continue;
    }

    const sceneTimeMatch = SCENE_TIME_PATTERN.exec(line);
    if (sceneTimeMatch) {
      sceneTime = Number(sceneTimeMatch[1]);
      continue;
    }

    const scoreMatch = SCENE_SCORE_PATTERN.exec(line);
    if (scoreMatch) {
      score = Number(scoreMatch[1]);
    }
  }
  flush();

  const byTime = new Map<number, SceneCandidate>();
  for (const candidate of candidates) {
    const previous = byTime.get(candidate.time);
    if (!previous || candidate.score > previous.score) {
      byTime.set(candidate.time, candidate);
    }
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function formatSeconds(value: number): string {
  return value.toFixed(3);
}

export async function analyzeSceneChanges(options: {
  input: string;
  start: number;
  end: number;
  threshold: number;
  analysisFps?: number;
  ffmpegPath: string;
}): Promise<SceneCandidate[]> {
  const analysisDuration = options.end - options.start;
  if (analysisDuration <= 0) {
    return [];
  }

  const filters = [];
  if (options.analysisFps !== undefined) {
    filters.push(`fps=${options.analysisFps}`);
  }
  filters.push(
    `scdet=threshold=${options.threshold}:sc_pass=1`,
    "metadata=mode=print:file=pipe\\\\:1:direct=1",
  );

  const result = await runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      formatSeconds(options.start),
      "-t",
      formatSeconds(analysisDuration),
      "-i",
      options.input,
      "-an",
      "-vf",
      filters.join(","),
      "-f",
      "null",
      "-",
    ],
    options.ffmpegPath,
    "scene detection",
  );

  return parseSceneMetadata(result.stdout).map((candidate) => ({
    ...candidate,
    time: candidate.time + options.start,
  }));
}
