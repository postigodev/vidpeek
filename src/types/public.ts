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

export interface SelectedSegment extends ManualSegment {
  index: number;
}

export interface GeneratePreviewResult {
  output: string;
  format: PreviewFormat;
  duration: number;
  segments: SelectedSegment[];
  elapsedMs: number;
}
