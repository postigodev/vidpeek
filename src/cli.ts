#!/usr/bin/env node
import { Command } from "commander";
import { generatePreview } from "./index";
import { toVidPeekError } from "./core/errors";
import type {
  GeneratePreviewOptions,
  PreviewFormat,
  SegmentStrategy,
  VidPeekPreset,
} from "./types/public";

interface CliOptions {
  out?: string;
  preset?: VidPeekPreset;
  strategy?: SegmentStrategy;
  clips?: string;
  clipDuration?: string;
  range?: string;
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
}

function parsePositiveNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
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

function toGenerateOptions(input: string, cli: CliOptions): GeneratePreviewOptions {
  if (!cli.out) {
    throw new Error("--out is required.");
  }

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

const program = new Command();

program
  .name("vidpeek")
  .description("A modern typed FFmpeg preview generator for Node and CLI.")
  .argument("<input>", "input video path")
  .requiredOption("--out <path>", "output preview path")
  .option("--preset <preset>", "tiny, web, discord, or high-quality")
  .option("--strategy <strategy>", "evenly-spaced, random, or manual")
  .option("--clips <number>", "number of clips to sample")
  .option("--clip-duration <seconds>", "duration of each sampled clip")
  .option("--range <start,end>", "normalized sampling range, for example 0.05,0.95")
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
  .action(async (input: string, cli: CliOptions) => {
    try {
      const result = await generatePreview(toGenerateOptions(input, cli));

      if (cli.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`VidPeek generated ${result.format} preview: ${result.output}`);
      console.log(`Duration: ${result.duration.toFixed(2)}s`);
      console.log(`Segments: ${result.segments.length}`);
      console.log(`Elapsed: ${result.elapsedMs}ms`);
    } catch (error) {
      const vidPeekError = toVidPeekError(error);

      if (cli.json) {
        console.error(
          JSON.stringify(
            {
              error: vidPeekError.message,
              code: vidPeekError.code,
              command: vidPeekError.command,
              exitCode: vidPeekError.exitCode,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(`VidPeek error: ${vidPeekError.message}`);
      }

      process.exitCode = 1;
    }
  });

await program.parseAsync();
