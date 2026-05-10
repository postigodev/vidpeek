import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { VidPeekError } from "./errors";

export async function ensureOutputDirectory(output: string): Promise<void> {
  await mkdir(path.dirname(output), { recursive: true });
}

export async function assertCanWriteOutput(output: string, overwrite: boolean): Promise<void> {
  if (overwrite) {
    return;
  }

  try {
    await access(output);
  } catch {
    return;
  }

  throw new VidPeekError(`Output already exists: ${output}. Pass overwrite: true to replace it.`, {
    code: "OUTPUT_EXISTS",
  });
}

export async function assertInputFileExists(input: string): Promise<void> {
  try {
    const inputStat = await stat(input);
    if (!inputStat.isFile()) {
      throw new VidPeekError(`Input is not a file: ${input}`, {
        code: "INVALID_INPUT",
      });
    }
  } catch (error) {
    if (error instanceof VidPeekError) {
      throw error;
    }

    throw new VidPeekError(`Input file does not exist: ${input}`, {
      code: "INPUT_NOT_FOUND",
      cause: error,
    });
  }
}

export async function getFileSize(filePath: string): Promise<number | undefined> {
  try {
    return (await stat(filePath)).size;
  } catch {
    return undefined;
  }
}
