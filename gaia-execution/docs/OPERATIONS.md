# Operations

## Routing order

1. Use a native ChatGPT connector when one exists and supports the requested read or write.
2. Use an open, keyless API for structured public data.
3. Use the local runner for local files, browser work, macOS speech and user-owned secrets.
4. Use GitHub Actions for scheduled, reproducible or long-running batch jobs.
5. Use the Google Apps Script bridge only for Google Tasks until a native connector is available.
6. Use browser automation only when no stable API or connector exists.
7. Use a paid provider only after explicit approval and cost awareness.

## Job receipts

Every external job writes a receipt containing:

- job identifier and type
- start and finish time
- executor version
- success or error state
- non-secret result metadata
- artifact paths
- a redacted error description

A receipt proves execution, not scientific correctness. Scientific claims still need source validation.

## Failure policy

- 401 or 403: stop and report missing or invalid authorization.
- 429: retry with bounded exponential backoff.
- 5xx: retry a limited number of times, then mark degraded.
- malformed data: stop and preserve the raw response only when it is safe and bounded.
- missing secret: do not search documents for a key. Report the secret reference name.
- unavailable provider: choose the next approved route, never silently switch to a paid service.

## Free TTS

```bash
python -m gaia_exec tts generate "Text" --provider auto --output output/tal.aiff
```

On macOS this uses `say`. Elsewhere it creates a local SpeechSynthesis page. ElevenLabs requires both `--provider elevenlabs` and `--allow-paid`.

## Research search

```bash
python -m gaia_exec research search "origin of life" --provider openalex --limit 20
python -m gaia_exec research search "origin of life" --provider europe-pmc --limit 20
```

Use multiple providers for discovery, then verify important claims against primary sources.

## RSS news collection

```bash
python -m gaia_exec news rss https://example.org/feed.xml --output output/news.json
```

The collector deduplicates items. Editorial grouping, factual verification and significance assessment remain separate steps.
