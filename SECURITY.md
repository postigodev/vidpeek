# Security Policy

VidPeek shells out to FFmpeg and FFprobe through `child_process.spawn` with argument arrays. It should never build shell-concatenated FFmpeg command strings.

If you believe you found a security issue, please do not report it publicly before maintainers have a chance to respond. Open a private report through GitHub security advisories if available, or contact the maintainer directly.

Maintainer: Piero Postigo

## Supported Versions

| Version | Security fixes |
| --- | --- |
| `0.x` | Best-effort |

## Areas of Concern

Security-sensitive areas include:

- Command injection
- Unsafe temp handling
- Path traversal
- Unexpected file overwrite behavior
- Dependency vulnerabilities
- Leaking local paths or stderr in inappropriate contexts

Useful reports include the affected version, OS, Node version, command or API call, expected behavior, actual behavior, and a minimal reproduction when possible.
