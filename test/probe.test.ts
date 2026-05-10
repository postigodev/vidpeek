import { describe, expect, it } from "vitest";
import { parseFfprobeMetadata } from "../src/core/ffprobe";

describe("parseFfprobeMetadata", () => {
  it("parses useful metadata from ffprobe JSON", () => {
    const metadata = parseFfprobeMetadata({
      format: {
        duration: "128.4",
        format_name: "mov,mp4,m4a,3gp,3g2,mj2",
      },
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          width: 1920,
          height: 1080,
          avg_frame_rate: "30000/1001",
        },
        {
          codec_type: "audio",
          codec_name: "aac",
        },
      ],
    });

    expect(metadata).toEqual({
      duration: 128.4,
      width: 1920,
      height: 1080,
      fps: 29.97,
      videoCodec: "h264",
      audioCodec: "aac",
      format: "mov,mp4,m4a,3gp,3g2,mj2",
    });
  });

  it("handles missing audio and weird FPS safely", () => {
    const metadata = parseFfprobeMetadata({
      format: {
        duration: "3.0",
        format_name: "mov,mp4",
      },
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          width: 320,
          height: 240,
          avg_frame_rate: "0/0",
          r_frame_rate: "not-a-rate",
        },
      ],
    });

    expect(metadata).toEqual({
      duration: 3,
      width: 320,
      height: 240,
      fps: undefined,
      videoCodec: "h264",
      audioCodec: undefined,
      format: "mov,mp4",
    });
  });
});
