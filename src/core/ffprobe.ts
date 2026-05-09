import { VidPeekError } from "./errors";
import { runProcess } from "./ffmpeg";

export interface VideoMetadata {
  duration: number;
}

interface FfprobeJson {
  format?: {
    duration?: string;
  };
  streams?: Array<{
    codec_type?: string;
    duration?: string;
  }>;
}

function parseDuration(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

export async function probeVideo(
  input: string,
  ffprobePath = "ffprobe",
): Promise<VideoMetadata> {
  const { stdout } = await runProcess({
    binary: ffprobePath,
    label: "FFprobe",
    args: ["-v", "error", "-show_format", "-show_streams", "-of", "json", input],
  });

  let data: FfprobeJson;
  try {
    data = JSON.parse(stdout) as FfprobeJson;
  } catch (error) {
    throw new VidPeekError("FFprobe returned invalid JSON.", {
      code: "INVALID_FFPROBE_JSON",
      cause: error,
    });
  }

  const duration =
    parseDuration(data.format?.duration) ??
    parseDuration(data.streams?.find((stream) => stream.codec_type === "video")?.duration);

  if (!duration) {
    throw new VidPeekError("Could not read video duration from FFprobe output.", {
      code: "MISSING_DURATION",
    });
  }

  return { duration };
}
