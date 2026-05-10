import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProgram } from "../../src/cli";
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

const canRunIntegration = (await hasBinary("ffmpeg")) && (await hasBinary("ffprobe"));

describe.skipIf(!canRunIntegration)("FFmpeg integration", () => {
  let tempDir = "";
  let samplePath = "";

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "vidpeek-integration-"));
    samplePath = path.join(tempDir, "sample video.mp4");
    await createSyntheticVideo(samplePath);
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("probes, previews, thumbnails, overwrites, and handles paths with spaces", async () => {
    const metadata = await probeVideo(samplePath);
    expect(metadata.duration).toBeGreaterThan(0);
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(240);
    expect(metadata.videoCodec).toBeTruthy();

    const previewPath = path.join(tempDir, "output preview.webp");
    const preview = await generatePreview({
      input: samplePath,
      output: previewPath,
      preset: "tiny",
      overwrite: true,
    });
    expect(preview.sizeBytes).toBeGreaterThan(0);
    expect(await sizeOf(previewPath)).toBeGreaterThan(0);

    await expect(
      generatePreview({
        input: samplePath,
        output: previewPath,
        preset: "tiny",
      }),
    ).rejects.toThrow("Output already exists");

    const thumbnailPath = path.join(tempDir, "thumbnail output.jpg");
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

    const cliPreviewPath = path.join(tempDir, "cli preview.webp");
    await createProgram().parseAsync([
      "node",
      "vidpeek",
      samplePath,
      "--out",
      cliPreviewPath,
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
});

if (!canRunIntegration) {
  console.warn("Skipping FFmpeg integration tests. Install ffmpeg and ffprobe to enable them.");
}
