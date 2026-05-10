import { describe, expect, it } from "vitest";
import { createProgram } from "../src/cli";

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
