---
name: Good first issue
about: Propose a small, well-scoped task for new contributors
title: "good first issue: "
labels: good first issue
assignees: ""
---

## Task

What should be changed?

## Why It Helps

Why is this useful for VidPeek or its users?

## Files Likely Involved

- `README.md`
- `src/...`
- `test/...`

## Expected Outcome

What should be true when this is done?

## Setup Notes

Run:

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
```

FFmpeg and FFprobe are only required if this task involves real video generation:

```bash
ffmpeg -version
ffprobe -version
```

## Acceptance Criteria

- [ ] The change is small and focused.
- [ ] Tests or docs are updated if relevant.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes if build behavior is touched.
