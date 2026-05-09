import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePreview } from "../src/index";
import type { VidPeekPreset } from "../src/types/public";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = path.join(root, "benchmarks", "fixtures", "sample.mp4");
const outDir = path.join(root, "benchmarks", "out");
const presets: VidPeekPreset[] = ["tiny", "web", "high-quality"];

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

if (!(await exists(samplePath))) {
  console.log("No benchmark sample found.");
  console.log("Place a video at benchmarks/fixtures/sample.mp4, then run pnpm bench.");
  process.exit(0);
}

await mkdir(outDir, { recursive: true });

for (const preset of presets) {
  const output = path.join(outDir, `${preset}.webp`);
  const result = await generatePreview({
    input: samplePath,
    output,
    preset,
    overwrite: true,
  });
  const size = (await stat(output)).size;

  console.log(`${preset.padEnd(13)} ${String(result.elapsedMs).padStart(6)}ms ${formatBytes(size)}`);
}
