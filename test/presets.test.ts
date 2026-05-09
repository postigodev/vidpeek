import { describe, expect, it } from "vitest";
import { VidPeekError } from "../src/core/errors";
import { resolveOptions } from "../src/core/presets";

describe("resolveOptions", () => {
  it("merges preset defaults with user overrides", () => {
    const options = resolveOptions({
      input: "video.mp4",
      output: "preview.webp",
      preset: "web",
      clips: { count: 2 },
      fps: 12,
    });

    expect(options.format).toBe("webp");
    expect(options.width).toBe(320);
    expect(options.fps).toBe(12);
    expect(options.clips).toMatchObject({ count: 2, duration: 2, range: [0.05, 0.95] });
  });

  it("rejects invalid ranges", () => {
    expect(() =>
      resolveOptions({
        input: "video.mp4",
        output: "preview.webp",
        clips: { range: [0.9, 0.1] },
      }),
    ).toThrow(VidPeekError);
  });

  it("requires manual segments for manual strategy", () => {
    expect(() =>
      resolveOptions({
        input: "video.mp4",
        output: "preview.webp",
        strategy: "manual",
      }),
    ).toThrow("Manual strategy requires clips.segments");
  });
});
