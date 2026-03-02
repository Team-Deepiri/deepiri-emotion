# Security Policy

## Supported versions

We release security updates for the latest major version of Deepiri IDE Desktop. Older major versions may receive critical fixes on a best-effort basis.

## Reporting a vulnerability

If you believe you have found a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security-sensitive bugs.
2. **Email** the maintainers (or use the contact method listed in the repository description) with:
   - A short description of the issue.
   - Steps to reproduce (if applicable).
   - Impact (e.g. local only, remote, data exposure).
3. We will acknowledge receipt and aim to respond within a reasonable time. We may ask for more detail.
4. After the issue is addressed, we can coordinate on a public disclosure (e.g. release note, CVE) if appropriate.

## Security-related design

- The renderer process does **not** use `nodeIntegration`; all privileged actions go through the preload script and main process IPC.
- File system and shell access are implemented in the main process only; the preload script exposes a whitelisted `window.electronAPI`.
- Do not commit secrets or `.env` files; use `.env.example` for documented variables. See [.gitignore](.gitignore).

Thank you for helping keep Deepiri IDE and its users safe.
