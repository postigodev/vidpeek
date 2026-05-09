export interface VidPeekErrorOptions {
  code?: string;
  command?: string;
  exitCode?: number | null;
  stderr?: string;
  cause?: unknown;
}

export class VidPeekError extends Error {
  readonly code?: string;
  readonly command?: string;
  readonly exitCode?: number | null;
  readonly stderr?: string;

  constructor(message: string, options: VidPeekErrorOptions = {}) {
    super(message);
    this.name = "VidPeekError";
    this.code = options.code;
    this.command = options.command;
    this.exitCode = options.exitCode;
    this.stderr = options.stderr;

    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export function toVidPeekError(error: unknown): VidPeekError {
  if (error instanceof VidPeekError) {
    return error;
  }

  if (error instanceof Error) {
    return new VidPeekError(error.message, { cause: error });
  }

  return new VidPeekError(String(error));
}
