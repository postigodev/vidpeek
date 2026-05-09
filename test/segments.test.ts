import { describe, expect, it } from "vitest";
import { resolveOptions } from "../src/core/presets";
import { selectSegments } from "../src/core/segments";

describe("selectSegments", () => {
  it("generates evenly spaced segments inside the normalized range", () => {
    const options = resolveOptions({
      input: "video.mp4",
      output: "preview.webp",
      clips: { count: 3, duration: 2, range: [0.1, 0.9] },
    });

    const segments = selectSegments(100, options);

    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.start)).toEqual([10, 50, 90]);
    expect(segments.every((segment) => segment.duration === 2)).toBe(true);
  });

  it("clamps segments so they do not exceed the video duration", () => {
    const options = resolveOptions({
      input: "video.mp4",
      output: "preview.webp",
      clips: { count: 2, duration: 10, range: [0.8, 1] },
    });

    const segments = selectSegments(12, options);

    expect(segments[0]?.start).toBeLessThanOrEqual(2);
    expect(segments[1]?.start).toBeLessThanOrEqual(2);
    expect(segments.every((segment) => segment.start + segment.duration <= 12)).toBe(true);
  });

  it("validates manual segments", () => {
    const options = resolveOptions({
      input: "video.mp4",
      output: "preview.webp",
      strategy: "manual",
      clips: { segments: [{ start: 5, duration: 3 }] },
    });

    expect(selectSegments(20, options)).toEqual([{ index: 0, start: 5, duration: 3 }]);
  });
});
