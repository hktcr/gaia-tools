# Secret handling

## Rule

Secret values must never be stored in Markdown, JSON, YAML, source code, chat transcripts, logs or public artifacts.

The registry records only secret names, owner, purpose, storage class, scopes, rotation status and last verification date.

## Supported sources

1. Connector-managed OAuth for Gmail, Google Calendar, Google Drive and GitHub.
2. macOS Keychain for local execution.
3. Environment variables for one process or one CI job.
4. GitHub Actions encrypted secrets for repository workflows.
5. Apps Script Properties for the Google Tasks bridge.

## Local setup

```bash
./scripts/set_secret_macos.sh ARTPORTALEN_API_KEY
./scripts/set_secret_macos.sh ELEVENLABS_API_KEY
```

The second secret is optional and paid. Free TTS remains the default.

## Environment setup

```bash
export SEMANTIC_SCHOLAR_API_KEY='...'
```

Do not place exports in a repository file. Use a shell session, password manager integration or encrypted CI secret.

## Scan

```bash
python -m gaia_exec secret scan .
```

A non-zero exit code means that a potential secret was found. The scanner reports only path, line and pattern class. It does not print the value.

## Rotation

A credential that has appeared in a document, chat, log or source file is treated as exposed. Remove it from current files, rotate it at the provider and update the registry with the rotation date. Removing current text does not revoke an exposed credential.
