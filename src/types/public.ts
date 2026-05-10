export type PreviewFormat = "webp" | "gif" | "mp4";

export type SegmentStrategy = "evenly-spaced" | "random" | "manual";

export type VidPeekPreset = "tiny" | "web" | "discord" | "high-quality";

export interface ManualSegment {
  start: number; // seconds
  duration: number; // seconds
}

export interface GeneratePreviewOptions {
  input: string;
  output: string;

  format?: PreviewFormat;
  preset?: VidPeekPreset;
  strategy?: SegmentStrategy;

  clips?: {
    count?: number;
    duration?: number;
    range?: [number, number]; // normalized 0 to 1
    segments?: ManualSegment[];
  };

  width?: number;
  height?: number;
  fps?: number;
  speed?: number;

  overwrite?: boolean;
  keepTemp?: boolean;
  ffmpegPath?: string;
  ffprobePath?: string;
}

export interface DryRunPreviewOptions extends GeneratePreviewOptions {
  dryRun: true;
}

export interface SelectedSegment extends ManualSegment {
  index: number;
}

export interface GeneratePreviewResult {
  output: string;
  format: PreviewFormat;
  duration: number;
  segments: SelectedSegment[];
  elapsedMs: number;
  sizeBytes?: number;
}

export interface PreviewDryRunResult {
  input: string;
  output: string;
  preset: VidPeekPreset;
  strategy: SegmentStrategy;
  format: PreviewFormat;
  duration: number;
  segments: SelectedSegment[];
  options: {
    width?: number;
    height?: number;
    fps: number;
    speed: number;
    clips: {
      count: number;
      duration: number;
      range: [number, number];
    };
    overwrite: boolean;
  };
  ffmpegRequired: true;
}

export interface VideoMetadata {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  format?: string;
}

export type ThumbnailTimestamp = number | `${number}%`;

export interface GenerateThumbnailOptions {
  input: string;
  output: string;
  at?: ThumbnailTimestamp;
  width?: number;
  height?: number;
  overwrite?: boolean;
  ffmpegPath?: string;
  ffprobePath?: string;
}

export interface GenerateThumbnailResult {
  output: string;
  at: number;
  elapsedMs: number;
  sizeBytes?: number;
}

export interface VidPeekErrorMetadata {
  code?: string;
  stage?: string;
  command?: string;
  binary?: string;
  args?: string[];
  exitCode?: number | null;
  stderr?: string;
}
