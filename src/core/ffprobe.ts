import { VidPeekError } from "./errors";
import { runProcess } from "./ffmpeg";
import { assertInputFileExists } from "./output";
import type { VideoMetadata } from "../types/public";

interface FfprobeJson {
  format?: {
    duration?: string;
    format_name?: string;
  };
  streams?: Array<{
    codec_type?: string;
    duration?: string;
    width?: number;
    height?: number;
    codec_name?: string;
    avg_frame_rate?: string;
    r_frame_rate?: string;
  }>;
}

function parseDuration(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

function parseFrameRate(value: string | undefined): number | undefined {
  if (!value || value === "0/0") {
    return undefined;
  }

  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator)) {
    return undefined;
  }

  const fps = denominator && Number.isFinite(denominator) ? numerator / denominator : numerator;
  return Number.isFinite(fps) && fps > 0 ? Number(fps.toFixed(3)) : undefined;
}

export function parseFfprobeMetadata(data: FfprobeJson): VideoMetadata {
  const videoStream = data.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = data.streams?.find((stream) => stream.codec_type === "audio");
  const duration = parseDuration(data.format?.duration) ?? parseDuration(videoStream?.duration);

  if (!duration) {
    throw new VidPeekError("Could not read video duration from FFprobe output.", {
      code: "MISSING_DURATION",
      stage: "probing",
    });
  }

  return {
    duration,
    width: videoStream?.width,
    height: videoStream?.height,
    fps: parseFrameRate(videoStream?.avg_frame_rate) ?? parseFrameRate(videoStream?.r_frame_rate),
    videoCodec: videoStream?.codec_name,
    audioCodec: audioStream?.codec_name,
    format: data.format?.format_name,
  };
}

export async function probeVideo(
  input: string,
  ffprobePath = "ffprobe",
): Promise<VideoMetadata> {
  await assertInputFileExists(input);
  const { stdout } = await runProcess({
    binary: ffprobePath,
    label: "FFprobe",
    stage: "probing",
    args: ["-v", "error", "-show_format", "-show_streams", "-of", "json", input],
  });

  let data: FfprobeJson;
  try {
    data = JSON.parse(stdout) as FfprobeJson;
  } catch (error) {
    throw new VidPeekError("FFprobe returned invalid JSON.", {
      code: "INVALID_FFPROBE_JSON",
      stage: "probing",
      cause: error,
    });
  }

  return parseFfprobeMetadata(data);
}
