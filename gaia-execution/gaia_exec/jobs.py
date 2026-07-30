from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

from .artportalen import count_observations
from .health import run_health
from .news import fetch_rss
from .research import recommend_semantic_scholar, search
from .tasks_bridge import TasksBridge
from .tts import generate


ALLOWED_JOB_TYPES = frozenset(
    {
        "health.open_apis",
        "tts.generate",
        "research.search",
        "research.recommend",
        "news.rss",
        "artportalen.count",
        "tasks.list",
    }
)


def validate_job(job: dict[str, Any]) -> None:
    if not isinstance(job, dict):
        raise ValueError("Job must be a JSON object")
    job_type = job.get("type")
    if job_type not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Job type is not allowlisted: {job_type}")
    payload = job.get("payload", {})
    if not isinstance(payload, dict):
        raise ValueError("Job payload must be a JSON object")


def execute(job: dict[str, Any], *, output_dir: Path) -> dict[str, Any]:
    validate_job(job)
    output_dir.mkdir(parents=True, exist_ok=True)
    job_id = str(job.get("id") or uuid.uuid4())
    started = time.time()
    job_type = str(job["type"])
    payload = dict(job.get("payload", {}))
    receipt: dict[str, Any] = {
        "id": job_id,
        "type": job_type,
        "status": "running",
        "started_at": started,
        "executor": "gaia-execution/0.1",
        "artifacts": [],
    }
    try:
        if job_type == "health.open_apis":
            result = run_health(offline=bool(payload.get("offline", False)))
        elif job_type == "tts.generate":
            output = output_dir / str(payload.get("output", f"{job_id}.html"))
            result = generate(
                str(payload["text"]),
                output,
                provider=str(payload.get("provider", "auto")),
                allow_paid=bool(payload.get("allow_paid", False)),
                voice=payload.get("voice"),
            )
            receipt["artifacts"].append(result.get("artifact"))
        elif job_type == "research.search":
            result = search(
                str(payload.get("provider", "semantic-scholar")),
                str(payload["query"]),
                int(payload.get("limit", 10)),
            )
        elif job_type == "research.recommend":
            result = {
                "provider": "semantic-scholar-recommendations",
                "paper_id": str(payload["paper_id"]),
                "results": recommend_semantic_scholar(
                    str(payload["paper_id"]), int(payload.get("limit", 20))
                ),
            }
        elif job_type == "news.rss":
            result = fetch_rss(
                [str(value) for value in payload.get("urls", [])],
                int(payload.get("limit_per_feed", 50)),
            )
        elif job_type == "artportalen.count":
            result = count_observations(
                taxon_ids=[int(value) for value in payload.get("taxon_ids", [])],
                area_feature_ids=[int(value) for value in payload.get("area_feature_ids", [])],
                start_date=payload.get("start_date"),
                end_date=payload.get("end_date"),
            )
        elif job_type == "tasks.list":
            result = TasksBridge().list_tasks(
                str(payload.get("tasklist_id", "@default")),
                bool(payload.get("show_completed", False)),
            )
        else:
            raise ValueError(f"Unhandled job type: {job_type}")
        receipt.update(
            {
                "status": "success",
                "finished_at": time.time(),
                "duration_seconds": round(time.time() - started, 3),
                "result": result,
            }
        )
    except Exception as exc:
        receipt.update(
            {
                "status": "error",
                "finished_at": time.time(),
                "duration_seconds": round(time.time() - started, 3),
                "error": {"type": type(exc).__name__, "message": str(exc)},
            }
        )
    receipt_path = output_dir / f"receipt-{job_id}.json"
    receipt_path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    receipt["receipt"] = str(receipt_path)
    return receipt
