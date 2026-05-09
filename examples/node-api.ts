import { generatePreview } from "vidpeek";

await generatePreview({
  input: "video.mp4",
  output: "preview.webp",
  preset: "web",
  strategy: "evenly-spaced",
  clips: {
    count: 5,
    duration: 2,
  },
  width: 320,
  fps: 10,
});
