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
  stage?: string;
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

function buildFailureHint(stderr: string): string {
  if (/Unknown encoder|Encoder not found/i.test(stderr)) {
    return [
      "",
      "Hint: this FFmpeg build does not include the required encoder for this output format.",
      "Install an FFmpeg build with the needed encoder support or choose another output format.",
    ].join("\n");
  }

  return "";
}

export async function runProcess({
  binary,
  args,
  label = binary,
  stage,
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
          `${label} could not be started${stage ? ` during ${stage}` : ""}. Is it installed and available on PATH?`,
          {
            code: error.code ?? "PROCESS_START_FAILED",
            stage,
            command,
            binary,
            args,
            stderr,
            cause: error,
          }
        )
      );
    });

    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const stderrText = stderr.trim();
      const hint = buildFailureHint(stderrText);

      reject(
        new VidPeekError(
          `${label} failed${stage ? ` during ${stage}` : ""} with exit code ${exitCode}.\nCommand: ${command}${
            stderrText ? `\n\n${stderrText}` : ""
          }${hint}`,
          {
            code: "PROCESS_FAILED",
            stage,
            command,
            binary,
            args,
            exitCode,
            stderr,
          }
        )
      );
    });
  });
}

export function runFfmpeg(
  args: string[],
  ffmpegPath = "ffmpeg",
  stage?: string
): Promise<ProcessResult> {
  return runProcess({ binary: ffmpegPath, args, label: "FFmpeg", stage });
}
