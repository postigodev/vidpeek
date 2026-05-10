import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VidPeekError } from "../src/core/errors";
import {
  assertValidThumbnailOutput,
  parseThumbnailTimestamp,
} from "../src/core/thumbnail";
import { assertCanWriteOutput } from "../src/core/output";

describe("thumbnail helpers", () => {
  it("parses percentage timestamps against video duration", () => {
    expect(parseThumbnailTimestamp("25%", 120)).toBe(30);
    expect(parseThumbnailTimestamp(undefined, 50)).toBe(5);
  });

  it("rejects invalid thumbnail percentages", () => {
    expect(() => parseThumbnailTimestamp("125%", 120)).toThrow(VidPeekError);
    expect(() => parseThumbnailTimestamp("nope%" as `${number}%`, 120)).toThrow(VidPeekError);
  });

  it("validates thumbnail output extensions", () => {
    expect(() => assertValidThumbnailOutput("thumb.jpg")).not.toThrow();
    expect(() => assertValidThumbnailOutput("thumb.png")).not.toThrow();
    expect(() => assertValidThumbnailOutput("thumb.txt")).toThrow(VidPeekError);
  });
});

describe("overwrite validation", () => {
  it("rejects existing output when overwrite is false", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vidpeek-test-"));
    const output = path.join(dir, "preview.webp");

    try {
      await writeFile(output, "already here");
      await expect(assertCanWriteOutput(output, false)).rejects.toThrow("Output already exists");
      await expect(assertCanWriteOutput(output, true)).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
