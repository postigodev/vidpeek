import { stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { cleanupTempDir, createTempDir } from "../src/core/temp";

describe("temp handling", () => {
  it("creates isolated temp directories", async () => {
    const first = await createTempDir();
    const second = await createTempDir();

    try {
      expect(first).not.toBe(second);
      expect((await stat(first)).isDirectory()).toBe(true);
      expect((await stat(second)).isDirectory()).toBe(true);
    } finally {
      await cleanupTempDir(first);
      await cleanupTempDir(second);
    }
  });
});
