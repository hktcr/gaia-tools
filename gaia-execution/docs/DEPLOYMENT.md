# Deployment and activation

## Status vocabulary

Use these terms exactly:

| Status | Meaning |
|---|---|
| Designed | Architecture and interface are documented |
| Built | Code or configuration exists |
| Locally tested | Automated local tests have passed |
| Installed | Files are present in the target environment |
| Activated | Required credentials, OAuth grants or deployments are configured |
| Production verified | A real end-to-end run has succeeded and a receipt exists |

Never infer a higher status from a lower one.

## Local runner

```bash
cd gaia-execution
./scripts/install_local.sh
$HOME/.local/bin/gaia-exec doctor
$HOME/.local/bin/gaia-exec health
```

The local runner is the preferred route when a workflow needs local files, macOS speech, a browser or a user-owned secret.

## GitHub Actions

The repository contains three workflows:

1. `GAIA open API health` for scheduled and manual health checks.
2. `GAIA research feeds` for scheduled and manual research monitoring.
3. `GAIA allowlisted job` for explicit manual jobs.

They create JSON receipts as workflow artifacts. Add repository secrets only for adapters that require them. Open API health and disabled example feeds require no secrets.

## Google Tasks bridge

1. Create an Apps Script project.
2. Copy `apps_script/google_tasks/Code.gs` and `appsscript.json`.
3. Enable the Advanced Google Tasks service and the Google Tasks API for the project.
4. Add a strong `GAIA_TASKS_BRIDGE_TOKEN` in Script Properties.
5. Deploy as a web app that runs as Håkan and is accessible only to the intended account.
6. Store the deployment URL and token in macOS Keychain or the relevant encrypted secret store.
7. Run `gaia-exec tasks list` and preserve the receipt.

The code is built before these steps. The bridge is not activated until OAuth and the web app deployment have completed successfully.
