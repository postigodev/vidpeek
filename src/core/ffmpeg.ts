import { spawn } from "node:child_process";
import { VidPeekError } from "./errors";

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

export interface RunProcessOptions {
  binary: string;
  args: string[];
  label?: string;
}

function quoteArg(arg: string): string {
  if (/^[a-zA-Z0-9_./:=+-]+$/.test(arg)) {
    return arg;
  }

  return JSON.stringify(arg);
}

export function formatCommand(binary: string, args: string[]): string {
  return [binary, ...args].map(quoteArg).join(" ");
}

export async function runProcess({
  binary,
  args,
  label = binary,
}: RunProcessOptions): Promise<ProcessResult> {
  const command = formatCommand(binary, args);

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
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

    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        new VidPeekError(
          `${label} could not be started. Is it installed and available on PATH?`,
          {
            code: error.code ?? "PROCESS_START_FAILED",
            command,
            stderr,
            cause: error,
          },
        ),
      );
    });

    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const stderrText = stderr.trim();
      reject(
        new VidPeekError(
          `${label} failed with exit code ${exitCode}.\nCommand: ${command}${
            stderrText ? `\n\n${stderrText}` : ""
          }`,
          {
            code: "PROCESS_FAILED",
            command,
            exitCode,
            stderr,
          },
        ),
      );
    });
  });
}

export function runFfmpeg(args: string[], ffmpegPath = "ffmpeg"): Promise<ProcessResult> {
  return runProcess({ binary: ffmpegPath, args, label: "FFmpeg" });
}
