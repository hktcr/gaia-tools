# GAIA Execution

GAIA Execution is a free-first, portable execution layer for workflows that need network access, scheduled jobs, local commands or secrets.

It separates four concerns:

1. ChatGPT connectors for supported services.
2. Open APIs and RSS for public structured data.
3. A local Python runner for macOS, browser and user-owned secrets.
4. GitHub Actions and Apps Script for scheduled or service-specific work.

## Safety properties

- Runtime dependencies use only the Python standard library.
- HTTPS is mandatory.
- Network responses are bounded.
- Hosts are allowlisted or explicitly supplied for an RSS feed.
- Secret values come only from environment variables, macOS Keychain, encrypted GitHub secrets or Apps Script Properties.
- No adapter reads secret values from Markdown or source files.
- Paid TTS is never selected automatically.
- Every allowlisted job writes a receipt.

## Quick start

```bash
python -m gaia_exec doctor
python -m gaia_exec health --offline
python -m gaia_exec tts generate "Hej Håkan" --provider browser --output output/hej.html
python -m gaia_exec secret scan .
```

## Main commands

```text
gaia-exec doctor
gaia-exec secret status NAME...
gaia-exec secret set-keychain NAME
gaia-exec secret scan PATH...
gaia-exec tts generate TEXT
gaia-exec tts play FILE
gaia-exec health
gaia-exec research search QUERY
gaia-exec research recommend PAPER_ID
gaia-exec feeds CONFIG
gaia-exec news rss URL...
gaia-exec tasks list
gaia-exec job run JOB.json
```

## Status after initial build

The source package, tests, workflows and Apps Script bridge are built. The local offline tests can be run without secrets. Provider activation and production verification remain separate, explicit steps described in `docs/DEPLOYMENT.md`.
