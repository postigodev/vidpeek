import { describe, expect, it } from "vitest";
import { VidPeekError } from "../src/core/errors";
import { runProcess } from "../src/core/ffmpeg";

describe("process errors", () => {
  it("preserves stage, args, command, exit code, and stderr", async () => {
    await expect(
      runProcess({
        binary: process.execPath,
        label: "Node",
        stage: "test failure",
        args: ["-e", "console.error('useful stderr'); process.exit(7);"],
      }),
    ).rejects.toMatchObject({
      name: "VidPeekError",
      code: "PROCESS_FAILED",
      stage: "test failure",
      binary: process.execPath,
      exitCode: 7,
      stderr: "useful stderr\n",
    } satisfies Partial<VidPeekError>);
  });
});
