import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmBinary = process.platform === "win32" ? "npm.cmd" : "npm";
const npxBinary = process.platform === "win32" ? "npx.cmd" : "npx";
const pnpmBinary = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

interface RunOptions {
  cwd: string;
  allowFailure?: boolean;
}

function run(binary: string, args: string[], options: RunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const command =
      process.platform === "win32" && /\.(cmd|bat)$/i.test(binary) ? "cmd.exe" : binary;
    const commandArgs =
      process.platform === "win32" && /\.(cmd|bat)$/i.test(binary)
        ? ["/d", "/s", "/c", binary, ...args]
        : args;
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0 || options.allowFailure) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `${binary} ${args.join(" ")} failed with exit code ${exitCode}\n${stderr.trim()}`,
        ),
      );
    });
  });
}

async function hasBinary(binary: string): Promise<boolean> {
  try {
    await run(binary, ["-version"], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  await run(pnpmBinary, ["build"], { cwd: root });
  const packOutput = await run(npmBinary, ["pack"], { cwd: root });
  const tarballName = packOutput
    .trim()
    .split(/\r?\n/)
    .find((line) => line.endsWith(".tgz"));

  if (!tarballName) {
    throw new Error("Could not find npm pack tarball name in npm output.");
  }

  const tarballPath = path.join(root, tarballName);
  const consumerDir = await mkdtemp(path.join(tmpdir(), "vidpeek-consumer-"));

  try {
    await run(npmBinary, ["init", "-y"], { cwd: consumerDir });
    await run(npmBinary, ["install", tarballPath], { cwd: consumerDir });
    await run(npxBinary, ["vidpeek", "--help"], { cwd: consumerDir });
    const installedCliPath = path.join(
      consumerDir,
      "node_modules",
      "vidpeek",
      "dist",
      "cli.js",
    );

    if ((await hasBinary("ffmpeg")) && (await hasBinary("ffprobe"))) {
      const samplePath = path.join(consumerDir, "sample video.mp4");
      await run(
        "ffmpeg",
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "testsrc=duration=2:size=320x240:rate=24",
          "-pix_fmt",
          "yuv420p",
          samplePath,
        ],
        { cwd: consumerDir },
      );
      await run(process.execPath, [installedCliPath, "probe", samplePath, "--json"], {
        cwd: consumerDir,
      });
      await run(
        process.execPath,
        [
          installedCliPath,
          samplePath,
          "--out",
          path.join(consumerDir, "preview output.webp"),
          "--preset",
          "tiny",
          "--overwrite",
        ],
        { cwd: consumerDir },
      );
      await run(
        process.execPath,
        [
          installedCliPath,
          "thumbnail",
          samplePath,
          "--out",
          path.join(consumerDir, "thumb output.jpg"),
          "--at",
          "25%",
          "--overwrite",
        ],
        { cwd: consumerDir },
      );
    }
  } finally {
    await rm(consumerDir, { recursive: true, force: true });
    await rm(tarballPath, { force: true });
  }

  console.log("Consumer smoke test passed.");
}

await main();
