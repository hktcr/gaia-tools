from __future__ import annotations

import urllib.parse
from typing import Any

from .http import HttpClient
from .secrets import SecretStore


class TasksBridge:
    def __init__(self) -> None:
        self.url = SecretStore().get("GAIA_TASKS_BRIDGE_URL", required=True) or ""
        self.token = SecretStore().get("GAIA_TASKS_BRIDGE_TOKEN", required=True) or ""
        parsed = urllib.parse.urlparse(self.url)
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("GAIA_TASKS_BRIDGE_URL must be a valid HTTPS URL")
        allowed_hosts = {parsed.hostname.lower()}
        if parsed.hostname.lower() == "script.google.com":
            allowed_hosts.add("script.googleusercontent.com")
        self.client = HttpClient(allowed_hosts=allowed_hosts, max_bytes=2_000_000)

    def call(self, action: str, **payload: Any) -> Any:
        return self.client.post_json(
            self.url, {"action": action, "token": self.token, **payload}
        )

    def list_tasklists(self) -> Any:
        return self.call("list_tasklists")

    def list_tasks(self, tasklist_id: str = "@default", show_completed: bool = False) -> Any:
        return self.call(
            "list_tasks", tasklist_id=tasklist_id, show_completed=show_completed
        )

    def create_task(
        self, title: str, *, tasklist_id: str = "@default", notes: str | None = None, due: str | None = None
    ) -> Any:
        return self.call(
            "create_task",
            tasklist_id=tasklist_id,
            title=title,
            notes=notes,
            due=due,
        )

    def complete_task(self, task_id: str, *, tasklist_id: str = "@default") -> Any:
        return self.call("complete_task", tasklist_id=tasklist_id, task_id=task_id)
