#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { pathToFileURL } from "node:url";
import { dryRunPreview, generatePreview, generateThumbnail, probeVideo } from "./index";
import { toVidPeekError } from "./core/errors";
import type {
  GeneratePreviewOptions,
  GenerateThumbnailOptions,
  PreviewFormat,
  SceneFallback,
  SegmentStrategy,
  VidPeekPreset,
} from "./types/public";

interface PreviewCliOptions {
  out?: string;
  preset?: VidPeekPreset;
  strategy?: SegmentStrategy;
  clips?: string;
  clipDuration?: string;
  range?: string;
  sceneThreshold?: string;
  sceneMinGap?: string;
  sceneFallback?: string;
  sceneMaxCandidates?: string;
  sceneAnalysisFps?: string;
  width?: string;
  height?: string;
  fps?: string;
  speed?: string;
  format?: PreviewFormat;
  overwrite?: boolean;
  keepTemp?: boolean;
  ffmpegPath?: string;
  ffprobePath?: string;
  json?: boolean;
  dryRun?: boolean;
}

interface ThumbnailCliOptions {
  out?: string;
  at?: string;
  width?: string;
  height?: string;
  overwrite?: boolean;
  ffmpegPath?: string;
  ffprobePath?: string;
  json?: boolean;
}

interface ProbeCliOptions {
  ffprobePath?: string;
  json?: boolean;
}

const presetChoices = ["tiny", "web", "discord", "high-quality"] as const;
const strategyChoices = ["evenly-spaced", "random", "manual", "scene-change"] as const;
const sceneFallbackChoices = ["evenly-spaced", "none", "error"] as const;
const formatChoices = ["webp", "gif", "mp4"] as const;

function parsePositiveNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
}

function parseNonNegativeNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be zero or greater.`);
  }

  return parsed;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function parseRange(value: string): [number, number] {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (
    parts.length !== 2 ||
    parts.some((part) => !Number.isFinite(part)) ||
    parts[0] < 0 ||
    parts[1] > 1 ||
    parts[0] >= parts[1]
  ) {
    throw new Error("--range must be formatted as start,end with values from 0 to 1.");
  }

  return [parts[0], parts[1]];
}

function parseSceneThreshold(value: string): number {
  const parsed = parseNonNegativeNumber(value, "--scene-threshold");
  if (parsed > 100) {
    throw new Error("--scene-threshold must be between 0 and 100.");
  }
  return parsed;
}

function hasSceneCliOptions(cli: PreviewCliOptions): boolean {
  return [
    cli.sceneThreshold,
    cli.sceneMinGap,
    cli.sceneFallback,
    cli.sceneMaxCandidates,
    cli.sceneAnalysisFps,
  ].some((value) => value !== undefined);
}

function parseThumbnailAt(value: string | undefined): GenerateThumbnailOptions["at"] {
  if (!value) {
    return undefined;
  }

  if (value.endsWith("%")) {
    return value as `${number}%`;
  }

  return parseNonNegativeNumber(value, "--at");
}

export function toGenerateOptions(input: string, cli: PreviewCliOptions): GeneratePreviewOptions {
  if (!cli.out) {
    throw new Error("--out is required.");
  }

  const scene = hasSceneCliOptions(cli)
    ? {
        threshold:
          cli.sceneThreshold === undefined
            ? undefined
            : parseSceneThreshold(cli.sceneThreshold),
        minGap:
          cli.sceneMinGap === undefined
            ? undefined
            : parseNonNegativeNumber(cli.sceneMinGap, "--scene-min-gap"),
        fallback: cli.sceneFallback as SceneFallback | undefined,
        maxCandidates:
          cli.sceneMaxCandidates === undefined
            ? undefined
            : parsePositiveInteger(cli.sceneMaxCandidates, "--scene-max-candidates"),
        analysisFps:
          cli.sceneAnalysisFps === undefined
            ? undefined
            : parsePositiveNumber(cli.sceneAnalysisFps, "--scene-analysis-fps"),
      }
    : undefined;

  return {
    input,
    output: cli.out,
    preset: cli.preset,
    strategy: cli.strategy,
    format: cli.format,
    clips: {
      count: cli.clips ? parsePositiveInteger(cli.clips, "--clips") : undefined,
      duration: cli.clipDuration
        ? parsePositiveNumber(cli.clipDuration, "--clip-duration")
        : undefined,
      range: cli.range ? parseRange(cli.range) : undefined,
      scene,
    },
    width: cli.width ? parsePositiveInteger(cli.width, "--width") : undefined,
    height: cli.height ? parsePositiveInteger(cli.height, "--height") : undefined,
    fps: cli.fps ? parsePositiveNumber(cli.fps, "--fps") : undefined,
    speed: cli.speed ? parsePositiveNumber(cli.speed, "--speed") : undefined,
    overwrite: cli.overwrite,
    keepTemp: cli.keepTemp,
    ffmpegPath: cli.ffmpegPath,
    ffprobePath: cli.ffprobePath,
  };
}

function toThumbnailOptions(input: string, cli: ThumbnailCliOptions): GenerateThumbnailOptions {
  if (!cli.out) {
    throw new Error("--out is required.");
  }

  return {
    input,
    output: cli.out,
    at: parseThumbnailAt(cli.at),
    width: cli.width ? parsePositiveInteger(cli.width, "--width") : undefined,
    height: cli.height ? parsePositiveInteger(cli.height, "--height") : undefined,
    overwrite: cli.overwrite,
    ffmpegPath: cli.ffmpegPath,
    ffprobePath: cli.ffprobePath,
  };
}

function printError(error: unknown, json?: boolean): void {
  const vidPeekError = toVidPeekError(error);

  if (json) {
    console.error(
      JSON.stringify(
        {
          error: vidPeekError.message,
          code: vidPeekError.code,
          stage: vidPeekError.stage,
          command: vidPeekError.command,
          exitCode: vidPeekError.exitCode,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.error(`VidPeek error: ${vidPeekError.message}`);
}

function addPreviewOptions(command: Command): Command {
  return command
    .option("--out <path>", "output preview path")
    .option("--preset <preset>", "tiny, web, discord, or high-quality")
    .option("--strategy <strategy>", "evenly-spaced, random, manual, or scene-change")
    .option("--clips <number>", "number of clips to sample")
    .option("--clip-duration <seconds>", "duration of each sampled clip")
    .option("--range <start,end>", "normalized sampling range, for example 0.05,0.95")
    .option("--scene-threshold <number>", "scene score threshold from 0 to 100")
    .option("--scene-min-gap <seconds>", "minimum gap between detected scenes")
    .option("--scene-fallback <mode>", "evenly-spaced, none, or error")
    .option("--scene-max-candidates <number>", "maximum top scene candidates to consider")
    .option("--scene-analysis-fps <number>", "sample FPS used during scene analysis")
    .option("--width <number>", "output width")
    .option("--height <number>", "output height")
    .option("--fps <number>", "output frames per second")
    .option("--speed <number>", "preview speed multiplier")
    .option("--format <format>", "webp, gif, or mp4")
    .option("--overwrite", "replace output if it already exists")
    .option("--keep-temp", "keep temporary working directory")
    .option("--ffmpeg-path <path>", "custom ffmpeg binary path")
    .option("--ffprobe-path <path>", "custom ffprobe binary path")
    .option("--json", "print machine-readable result JSON")
    .option("--dry-run", "probe and print planned preview segments without generating files");
}

function validatePreviewChoices(options: PreviewCliOptions): void {
  if (options.preset && !presetChoices.includes(options.preset)) {
    throw new Error(`Invalid preset: ${options.preset}. Expected one of: ${presetChoices.join(", ")}.`);
  }

  if (options.strategy && !strategyChoices.includes(options.strategy)) {
    throw new Error(
      `Invalid strategy: ${options.strategy}. Expected one of: ${strategyChoices.join(", ")}.`,
    );
  }

  if (options.format && !formatChoices.includes(options.format)) {
    throw new Error(`Invalid format: ${options.format}. Expected one of: ${formatChoices.join(", ")}.`);
  }

  if (
    options.sceneFallback &&
    !sceneFallbackChoices.includes(options.sceneFallback as (typeof sceneFallbackChoices)[number])
  ) {
    throw new Error(
      `Invalid scene fallback: ${options.sceneFallback}. Expected one of: ${sceneFallbackChoices.join(", ")}.`,
    );
  }

  if (hasSceneCliOptions(options) && options.strategy !== "scene-change") {
    throw new Error("Scene options require --strategy scene-change.");
  }
}

async function runPreview(input: string, cli: PreviewCliOptions): Promise<void> {
  validatePreviewChoices(cli);
  const options = toGenerateOptions(input, cli);

  if (cli.dryRun) {
    const result = await dryRunPreview(options);
    if (cli.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`VidPeek dry run for ${result.input}`);
    console.log(`Output: ${result.output}`);
    console.log(`Preset: ${result.preset}`);
    console.log(`Format: ${result.format}`);
    console.log(`Duration: ${result.duration.toFixed(2)}s`);
    console.log(`Segments: ${result.segments.length}`);
    return;
  }

  const result = await generatePreview(options);

  if (cli.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`VidPeek generated ${result.format} preview: ${result.output}`);
  console.log(`Duration: ${result.duration.toFixed(2)}s`);
  console.log(`Segments: ${result.segments.length}`);
  if (result.sizeBytes !== undefined) {
    console.log(`Size: ${result.sizeBytes} bytes`);
  }
  console.log(`Elapsed: ${result.elapsedMs}ms`);
}

async function runThumbnail(input: string, cli: ThumbnailCliOptions): Promise<void> {
  const result = await generateThumbnail(toThumbnailOptions(input, cli));

  if (cli.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`VidPeek generated thumbnail: ${result.output}`);
  console.log(`Timestamp: ${result.at.toFixed(3)}s`);
  if (result.sizeBytes !== undefined) {
    console.log(`Size: ${result.sizeBytes} bytes`);
  }
  console.log(`Elapsed: ${result.elapsedMs}ms`);
}

async function runProbe(input: string, cli: ProbeCliOptions): Promise<void> {
  const metadata = await probeVideo(input, cli.ffprobePath);

  if (cli.json) {
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }

  console.log(`Duration: ${metadata.duration.toFixed(2)}s`);
  if (metadata.width && metadata.height) {
    console.log(`Dimensions: ${metadata.width}x${metadata.height}`);
  }
  if (metadata.fps) {
    console.log(`FPS: ${metadata.fps}`);
  }
  if (metadata.videoCodec) {
    console.log(`Video codec: ${metadata.videoCodec}`);
  }
  if (metadata.audioCodec) {
    console.log(`Audio codec: ${metadata.audioCodec}`);
  }
  if (metadata.format) {
    console.log(`Format: ${metadata.format}`);
  }
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("vidpeek")
    .description("A modern typed FFmpeg preview generator for Node and CLI.")
    .enablePositionalOptions()
    .showHelpAfterError()
    .exitOverride();

  addPreviewOptions(program.argument("[input]", "input video path")).action(
    async (input: string | undefined, cli: PreviewCliOptions) => {
      if (!input) {
        throw new Error("input is required.");
      }

      await runPreview(input, cli);
    },
  );

  program
    .command("thumbnail")
    .description("generate a still thumbnail")
    .argument("<input>", "input video path")
    .requiredOption("--out <path>", "output thumbnail path")
    .option("--at <time>", "timestamp in seconds or percentage, for example 12.5 or 25%")
    .option("--width <number>", "output width")
    .option("--height <number>", "output height")
    .option("--overwrite", "replace output if it already exists")
    .option("--ffmpeg-path <path>", "custom ffmpeg binary path")
    .option("--ffprobe-path <path>", "custom ffprobe binary path")
    .option("--json", "print machine-readable result JSON")
    .action(runThumbnail);

  program
    .command("probe")
    .description("print video metadata from ffprobe")
    .argument("<input>", "input video path")
    .option("--ffprobe-path <path>", "custom ffprobe binary path")
    .option("--json", "print machine-readable result JSON")
    .action(runProbe);

  return program;
}

async function main(): Promise<void> {
  try {
    await createProgram().parseAsync();
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
    } else {
      printError(error, process.argv.includes("--json"));
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
