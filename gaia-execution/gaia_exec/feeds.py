from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from .research import recommend_semantic_scholar, search


def run_config(path: Path) -> dict[str, Any]:
    config = json.loads(path.read_text(encoding="utf-8"))
    feeds = config.get("feeds", [])
    results: list[dict[str, Any]] = []
    for feed in feeds:
        if not feed.get("enabled", False):
            results.append({"name": feed.get("name", "unnamed"), "status": "disabled"})
            continue
        mode = feed.get("mode", "search")
        try:
            if mode == "recommend":
                papers = recommend_semantic_scholar(
                    str(feed["paper_id"]), int(feed.get("limit", 20))
                )
                results.append(
                    {
                        "name": feed.get("name", "unnamed"),
                        "status": "ok",
                        "provider": "semantic-scholar-recommendations",
                        "items": papers,
                    }
                )
            else:
                provider = str(feed.get("provider", "semantic-scholar"))
                query = str(feed["query"])
                results.append(
                    {
                        "name": feed.get("name", "unnamed"),
                        "status": "ok",
                        **search(provider, query, int(feed.get("limit", 20))),
                    }
                )
        except Exception as exc:
            results.append(
                {
                    "name": feed.get("name", "unnamed"),
                    "status": "error",
                    "error": str(exc),
                }
            )
    return {"generated_at": time.time(), "feeds": results}
