import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vidpeek-"));
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}
