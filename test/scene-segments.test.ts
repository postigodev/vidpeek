import { describe, expect, it } from "vitest";
import { VidPeekError } from "../src/core/errors";
import { selectSceneSegments } from "../src/core/plan-segments";
import { resolveOptions } from "../src/core/presets";

function sceneOptions(overrides: Parameters<typeof resolveOptions>[0]["clips"] = {}) {
  return resolveOptions({
    input: "video.mp4",
    output: "preview.webp",
    strategy: "scene-change",
    clips: {
      count: 2,
      duration: 2,
      range: [0, 1],
      scene: { threshold: 10, minGap: 3, fallback: "none", maxCandidates: 200 },
      ...overrides,
    },
  });
}

describe("selectSceneSegments", () => {
  it("ranks by score, applies minGap, and returns chronological segments", () => {
    const segments = selectSceneSegments(30, sceneOptions(), [
      { time: 10, score: 20 },
      { time: 12, score: 90 },
      { time: 20, score: 50 },
    ]);

    expect(segments).toEqual([
      { index: 0, start: 12, duration: 2, source: "scene-change", sceneScore: 90 },
      { index: 1, start: 20, duration: 2, source: "scene-change", sceneScore: 50 },
    ]);
  });

  it("applies maxCandidates before selecting clips", () => {
    const options = sceneOptions({
      count: 2,
      scene: { threshold: 10, minGap: 0, fallback: "none", maxCandidates: 1 },
    });

    expect(
      selectSceneSegments(30, options, [
        { time: 5, score: 10 },
        { time: 15, score: 20 },
      ]),
    ).toEqual([
      { index: 0, start: 15, duration: 2, source: "scene-change", sceneScore: 20 },
    ]);
  });

  it("fills missing scenes with distinct evenly spaced fallback clips", () => {
    const options = sceneOptions({
      count: 3,
      scene: { threshold: 10, minGap: 20, fallback: "evenly-spaced", maxCandidates: 200 },
    });
    const segments = selectSceneSegments(30, options, [{ time: 10, score: 50 }]);

    expect(segments).toHaveLength(3);
    expect(segments.filter((segment) => segment.source === "scene-change")).toHaveLength(1);
    expect(segments.filter((segment) => segment.source === "fallback")).toHaveLength(2);
    expect(new Set(segments.map((segment) => segment.start)).size).toBe(3);
  });

  it("can return fewer scenes or fail when the requested count is unavailable", () => {
    expect(selectSceneSegments(30, sceneOptions(), [])).toEqual([]);

    const errorOptions = sceneOptions({
      scene: { threshold: 10, minGap: 3, fallback: "error", maxCandidates: 200 },
    });
    expect(() => selectSceneSegments(30, errorOptions, [{ time: 5, score: 20 }])).toThrow(
      VidPeekError,
    );
    try {
      selectSceneSegments(30, errorOptions, [{ time: 5, score: 20 }]);
    } catch (error) {
      expect(error).toMatchObject({ code: "INSUFFICIENT_SCENES" });
    }
  });
});
