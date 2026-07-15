import { describe, expect, it } from "vitest";
import { parseSceneMetadata } from "../src/core/scene-detection";

describe("parseSceneMetadata", () => {
  it("parses scene timestamps and scores while ignoring noise and incomplete frames", () => {
    const output = [
      "unrelated output",
      "frame:0 pts:1000 pts_time:1",
      "lavfi.scd.mafd=12.5",
      "lavfi.scd.score=12.500",
      "lavfi.scd.time=1",
      "frame:1 pts:2500 pts_time:2.5",
      "lavfi.scd.score=8.25e+0",
      "frame:2 pts:3000 pts_time:3",
      "lavfi.scd.time=3",
    ].join("\n");

    expect(parseSceneMetadata(output)).toEqual([
      { time: 1, score: 12.5 },
      { time: 2.5, score: 8.25 },
    ]);
  });

  it("keeps the highest score for duplicate timestamps", () => {
    const output = [
      "frame:0 pts:1000 pts_time:1",
      "lavfi.scd.score=4",
      "frame:1 pts:1000 pts_time:1",
      "lavfi.scd.score=9",
    ].join("\n");

    expect(parseSceneMetadata(output)).toEqual([{ time: 1, score: 9 }]);
  });
});
