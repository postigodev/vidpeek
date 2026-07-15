import { describe, expect, it } from "vitest";
import { createProgram, toGenerateOptions } from "../src/cli";

function createTestProgram() {
  let output = "";
  let error = "";
  const program = createProgram();
  program.configureOutput({
    writeOut: (text) => {
      output += text;
    },
    writeErr: (text) => {
      error += text;
    },
  });

  return { program, getOutput: () => output, getError: () => error };
}

describe("CLI smoke tests", () => {
  it("prints help without requiring FFmpeg", async () => {
    const { program, getOutput } = createTestProgram();

    await expect(program.parseAsync(["node", "vidpeek", "--help"])).rejects.toMatchObject({
      exitCode: 0,
    });
    expect(getOutput()).toContain("Usage:");
    expect(getOutput()).toContain("thumbnail");
    expect(getOutput()).toContain("probe");
  });

  it("requires --out for preview generation", async () => {
    const { program } = createTestProgram();

    await expect(program.parseAsync(["node", "vidpeek", "input.mp4"])).rejects.toThrow(
      "--out is required",
    );
  });

  it("rejects invalid preview choices before FFmpeg runs", async () => {
    const { program } = createTestProgram();

    await expect(
      program.parseAsync(["node", "vidpeek", "input.mp4", "--out", "preview.webp", "--preset", "huge"]),
    ).rejects.toThrow("Invalid preset");

    await expect(
      createProgram().parseAsync([
        "node",
        "vidpeek",
        "input.mp4",
        "--out",
        "preview.webp",
        "--strategy",
        "middle",
      ]),
    ).rejects.toThrow("Invalid strategy");

    await expect(
      createProgram().parseAsync([
        "node",
        "vidpeek",
        "input.mp4",
        "--out",
        "preview.bmp",
        "--format",
        "bmp",
      ]),
    ).rejects.toThrow("Invalid format");

    await expect(
      createProgram().parseAsync([
        "node",
        "vidpeek",
        "input.mp4",
        "--out",
        "preview.webp",
        "--range",
        "0.9,0.1",
      ]),
    ).rejects.toThrow("--range must be formatted");

    await expect(
      createProgram().parseAsync([
        "node",
        "vidpeek",
        "input.mp4",
        "--out",
        "preview.webp",
        "--scene-threshold",
        "20",
      ]),
    ).rejects.toThrow("Scene options require --strategy scene-change");

    await expect(
      createProgram().parseAsync([
        "node",
        "vidpeek",
        "input.mp4",
        "--out",
        "preview.webp",
        "--strategy",
        "scene-change",
        "--scene-fallback",
        "guess",
      ]),
    ).rejects.toThrow("Invalid scene fallback");
  });

  it("maps advanced scene-change flags to API options", () => {
    expect(
      toGenerateOptions("input.mp4", {
        out: "preview.webp",
        strategy: "scene-change",
        sceneThreshold: "12.5",
        sceneMinGap: "1.25",
        sceneFallback: "none",
        sceneMaxCandidates: "50",
        sceneAnalysisFps: "8",
      }),
    ).toMatchObject({
      strategy: "scene-change",
      clips: {
        scene: {
          threshold: 12.5,
          minGap: 1.25,
          fallback: "none",
          maxCandidates: 50,
          analysisFps: 8,
        },
      },
    });
  });

  it("rejects invalid thumbnail output extensions before FFmpeg runs", async () => {
    await expect(
      createProgram().parseAsync([
        "node",
        "vidpeek",
        "thumbnail",
        "input.mp4",
        "--out",
        "thumb.txt",
      ]),
    ).rejects.toThrow("Thumbnail output must use");
  });
});
