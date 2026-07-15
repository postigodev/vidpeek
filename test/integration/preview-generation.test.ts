import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli";
import { dryRunPreview } from "../../src/core/dry-run";
import { runProcess } from "../../src/core/ffmpeg";
import { generatePreview } from "../../src/core/generate-preview";
import { probeVideo } from "../../src/core/ffprobe";
import { generateThumbnail } from "../../src/core/thumbnail";

async function hasBinary(binary: string): Promise<boolean> {
  try {
    await runProcess({ binary, args: ["-version"], label: binary });
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function hasEncoder(encoder: string): Promise<boolean> {
  try {
    const result = await runProcess({
      binary: "ffmpeg",
      label: "FFmpeg",
      stage: "encoder detection",
      args: ["-hide_banner", "-encoders"],
    });

    const output = `${result.stdout}\n${result.stderr}`;
    const pattern = new RegExp(`(^|\\n)\\s*[A-Z.]{6}\\s+${escapeRegExp(encoder)}(\\s|$)`);
    return pattern.test(output);
  } catch {
    return false;
  }
}

async function sizeOf(filePath: string): Promise<number> {
  return (await stat(filePath)).size;
}

async function createSyntheticVideo(output: string): Promise<void> {
  await runProcess({
    binary: "ffmpeg",
    label: "FFmpeg",
    stage: "integration fixture generation",
    args: [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=3:size=320x240:rate=24",
      "-pix_fmt",
      "yuv420p",
      output,
    ],
  });
}

async function createSceneChangeVideo(output: string): Promise<void> {
  await runProcess({
    binary: "ffmpeg",
    label: "FFmpeg",
    stage: "scene integration fixture generation",
    args: [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=red:size=320x240:rate=24:duration=1",
      "-f",
      "lavfi",
      "-i",
      "color=blue:size=320x240:rate=24:duration=1",
      "-f",
      "lavfi",
      "-i",
      "color=green:size=320x240:rate=24:duration=1",
      "-filter_complex",
      "[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[v]",
      "-map",
      "[v]",
      output,
    ],
  });
}

const canRunIntegration = (await hasBinary("ffmpeg")) && (await hasBinary("ffprobe"));
const canEncodeWebP = canRunIntegration ? await hasEncoder("libwebp") : false;

if (!canRunIntegration) {
  console.warn("Skipping FFmpeg integration tests. Install ffmpeg and ffprobe to enable them.");
}

if (canRunIntegration && !canEncodeWebP) {
  console.warn(
    "Skipping WebP integration test because this FFmpeg build does not include libwebp.",
  );
}

describe.skipIf(!canRunIntegration)("FFmpeg integration", () => {
  let tempDir = "";
  let samplePath = "";
  let sceneSamplePath = "";

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "vidpeek-integration-"));
    samplePath = path.join(tempDir, "sample video.mp4");
    sceneSamplePath = path.join(tempDir, "scene sample.mp4");
    await createSyntheticVideo(samplePath);
    await createSceneChangeVideo(sceneSamplePath);
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("probes a synthetic sample video", async () => {
    const metadata = await probeVideo(samplePath);

    expect(metadata.duration).toBeGreaterThan(0);
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(240);
    expect(metadata.videoCodec).toBeTruthy();
  });

  it("generates an mp4 preview, enforces overwrite, and handles paths with spaces", async () => {
    const previewPath = path.join(tempDir, "output preview.mp4");

    const preview = await generatePreview({
      input: samplePath,
      output: previewPath,
      format: "mp4",
      preset: "tiny",
      overwrite: true,
    });

    expect(preview.format).toBe("mp4");
    expect(preview.sizeBytes).toBeGreaterThan(0);
    expect(await sizeOf(previewPath)).toBeGreaterThan(0);

    await expect(
      generatePreview({
        input: samplePath,
        output: previewPath,
        format: "mp4",
        preset: "tiny",
      }),
    ).rejects.toThrow("Output already exists");
  });

  it("generates a png thumbnail", async () => {
    const thumbnailPath = path.join(tempDir, "thumbnail output.png");

    const thumbnail = await generateThumbnail({
      input: samplePath,
      output: thumbnailPath,
      at: "25%",
      width: 160,
      overwrite: true,
    });

    expect(thumbnail.at).toBeGreaterThan(0);
    expect(thumbnail.sizeBytes).toBeGreaterThan(0);
    expect(await sizeOf(thumbnailPath)).toBeGreaterThan(0);
  });

  it("runs CLI preview, thumbnail, and probe commands", async () => {
    const cliPreviewPath = path.join(tempDir, "cli preview.mp4");

    await createProgram().parseAsync([
      "node",
      "vidpeek",
      samplePath,
      "--out",
      cliPreviewPath,
      "--format",
      "mp4",
      "--preset",
      "tiny",
      "--overwrite",
    ]);

    expect(await sizeOf(cliPreviewPath)).toBeGreaterThan(0);

    const cliThumbnailPath = path.join(tempDir, "cli thumbnail.png");

    await createProgram().parseAsync([
      "node",
      "vidpeek",
      "thumbnail",
      samplePath,
      "--out",
      cliThumbnailPath,
      "--at",
      "10%",
      "--overwrite",
    ]);

    expect(await sizeOf(cliThumbnailPath)).toBeGreaterThan(0);

    await expect(
      createProgram().parseAsync(["node", "vidpeek", "probe", samplePath, "--json"]),
    ).resolves.toBeTruthy();
  });

  it("detects scene changes through API, CLI dry-run JSON, and preview generation", async () => {
    const clips = {
      count: 2,
      duration: 0.4,
      range: [0.2, 1] as [number, number],
      scene: { threshold: 5, minGap: 0.5, fallback: "error" as const },
    };
    const dryRun = await dryRunPreview({
      input: sceneSamplePath,
      output: path.join(tempDir, "scene dry-run.mp4"),
      format: "mp4",
      strategy: "scene-change",
      clips,
    });

    expect(dryRun.segments).toHaveLength(2);
    expect(dryRun.segments.map((segment) => segment.source)).toEqual([
      "scene-change",
      "scene-change",
    ]);
    expect(dryRun.segments[0].start).toBeCloseTo(1, 1);
    expect(dryRun.segments[1].start).toBeCloseTo(2, 1);
    expect(dryRun.segments.every((segment) => segment.sceneScore !== undefined)).toBe(true);

    const cliOutput: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((value) => {
      cliOutput.push(String(value));
    });
    try {
      await createProgram().parseAsync([
        "node",
        "vidpeek",
        sceneSamplePath,
        "--out",
        path.join(tempDir, "scene cli dry-run.mp4"),
        "--format",
        "mp4",
        "--strategy",
        "scene-change",
        "--clips",
        "2",
        "--clip-duration",
        "0.4",
        "--range",
        "0.2,1",
        "--scene-threshold",
        "5",
        "--scene-min-gap",
        "0.5",
        "--scene-fallback",
        "error",
        "--dry-run",
        "--json",
      ]);
    } finally {
      logSpy.mockRestore();
    }
    expect(JSON.parse(cliOutput.join("\n")).segments).toHaveLength(2);

    const previewPath = path.join(tempDir, "scene preview.mp4");
    const preview = await generatePreview({
      input: sceneSamplePath,
      output: previewPath,
      format: "mp4",
      strategy: "scene-change",
      clips,
      overwrite: true,
    });
    expect(preview.segments).toEqual(dryRun.segments);
    expect(await sizeOf(previewPath)).toBeGreaterThan(0);
  });

  it("returns an empty scene dry-run but fails generation clearly when fallback is none", async () => {
    const options = {
      input: sceneSamplePath,
      output: path.join(tempDir, "empty scene preview.mp4"),
      format: "mp4" as const,
      strategy: "scene-change" as const,
      clips: {
        count: 2,
        duration: 0.4,
        range: [0.2, 1] as [number, number],
        scene: { threshold: 100, fallback: "none" as const },
      },
    };

    await expect(dryRunPreview(options)).resolves.toMatchObject({ segments: [] });
    await expect(generatePreview(options)).rejects.toMatchObject({
      code: "NO_SEGMENTS_SELECTED",
      stage: "segment selection",
    });
  });

  it.skipIf(!canEncodeWebP)("generates a WebP preview when libwebp is available", async () => {
    const previewPath = path.join(tempDir, "output preview.webp");

    const preview = await generatePreview({
      input: samplePath,
      output: previewPath,
      format: "webp",
      preset: "tiny",
      overwrite: true,
    });

    expect(preview.format).toBe("webp");
    expect(preview.sizeBytes).toBeGreaterThan(0);
    expect(await sizeOf(previewPath)).toBeGreaterThan(0);
  });
});
