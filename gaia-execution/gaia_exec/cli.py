from __future__ import annotations

import argparse
import getpass
import json
import platform
import shutil
import sys
from pathlib import Path
from typing import Any

from .feeds import run_config
from .health import run_health
from .jobs import execute
from .news import fetch_rss
from .research import recommend_semantic_scholar, search
from .secrets import SecretStore, scan_paths
from .tasks_bridge import TasksBridge
from .tts import generate, play


def _print(value: Any, pretty: bool = True) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2 if pretty else None))


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="gaia-exec")
    parser.add_argument("--compact", action="store_true", help="Print compact JSON")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("doctor", help="Inspect local execution capabilities")

    secret = sub.add_parser("secret", help="Inspect or store secret references")
    secret_sub = secret.add_subparsers(dest="secret_command", required=True)
    secret_status = secret_sub.add_parser("status")
    secret_status.add_argument("names", nargs="+")
    secret_set = secret_sub.add_parser("set-keychain")
    secret_set.add_argument("name")
    secret_scan = secret_sub.add_parser("scan")
    secret_scan.add_argument("paths", nargs="+", type=Path)

    tts = sub.add_parser("tts")
    tts_sub = tts.add_subparsers(dest="tts_command", required=True)
    tts_generate = tts_sub.add_parser("generate")
    tts_generate.add_argument("text")
    tts_generate.add_argument("--output", type=Path, default=Path("output/gaia-voice"))
    tts_generate.add_argument(
        "--provider", choices=["auto", "local", "browser", "elevenlabs"], default="auto"
    )
    tts_generate.add_argument("--voice")
    tts_generate.add_argument("--allow-paid", action="store_true")
    tts_play = tts_sub.add_parser("play")
    tts_play.add_argument("path", type=Path)

    health = sub.add_parser("health")
    health.add_argument("--offline", action="store_true")
    health.add_argument("--output", type=Path)

    research = sub.add_parser("research")
    research_sub = research.add_subparsers(dest="research_command", required=True)
    research_search = research_sub.add_parser("search")
    research_search.add_argument("query")
    research_search.add_argument(
        "--provider",
        choices=["semantic-scholar", "crossref", "openalex", "datacite", "europe-pmc"],
        default="semantic-scholar",
    )
    research_search.add_argument("--limit", type=int, default=10)
    research_rec = research_sub.add_parser("recommend")
    research_rec.add_argument("paper_id")
    research_rec.add_argument("--limit", type=int, default=20)

    feeds = sub.add_parser("feeds")
    feeds.add_argument("config", type=Path)
    feeds.add_argument("--output", type=Path)

    news = sub.add_parser("news")
    news_sub = news.add_subparsers(dest="news_command", required=True)
    rss = news_sub.add_parser("rss")
    rss.add_argument("urls", nargs="+")
    rss.add_argument("--limit-per-feed", type=int, default=50)
    rss.add_argument("--output", type=Path)

    tasks = sub.add_parser("tasks")
    tasks_sub = tasks.add_subparsers(dest="tasks_command", required=True)
    tasks_sub.add_parser("tasklists")
    tasks_list = tasks_sub.add_parser("list")
    tasks_list.add_argument("--tasklist-id", default="@default")
    tasks_list.add_argument("--show-completed", action="store_true")
    tasks_create = tasks_sub.add_parser("create")
    tasks_create.add_argument("title")
    tasks_create.add_argument("--tasklist-id", default="@default")
    tasks_create.add_argument("--notes")
    tasks_create.add_argument("--due")
    tasks_complete = tasks_sub.add_parser("complete")
    tasks_complete.add_argument("task_id")
    tasks_complete.add_argument("--tasklist-id", default="@default")

    job = sub.add_parser("job")
    job_sub = job.add_subparsers(dest="job_command", required=True)
    job_run = job_sub.add_parser("run")
    job_run.add_argument("job_file", type=Path)
    job_run.add_argument("--output-dir", type=Path, default=Path("output"))
    job_inline = job_sub.add_parser("run-inline")
    job_inline.add_argument("job_type")
    job_inline.add_argument("payload_json")
    job_inline.add_argument("--output-dir", type=Path, default=Path("output"))
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    pretty = not args.compact
    try:
        if args.command == "doctor":
            _print(
                {
                    "python": platform.python_version(),
                    "platform": platform.platform(),
                    "commands": {
                        name: bool(shutil.which(name))
                        for name in ["say", "espeak-ng", "espeak", "afplay", "ffplay", "security", "git", "gh"]
                    },
                    "secret_sources": ["environment", "macos-keychain"],
                    "network_policy": "HTTPS, allowlisted or explicit feed host, bounded response",
                },
                pretty,
            )
        elif args.command == "secret":
            store = SecretStore()
            if args.secret_command == "status":
                _print([store.status(name).__dict__ for name in args.names], pretty)
            elif args.secret_command == "set-keychain":
                value = getpass.getpass(f"Value for {args.name}: ")
                store.set_macos_keychain(args.name, value)
                _print({"name": args.name, "stored": True, "source": "macos-keychain"}, pretty)
            else:
                findings = scan_paths(args.paths)
                _print({"ok": not findings, "findings": findings}, pretty)
                return 0 if not findings else 2
        elif args.command == "tts":
            if args.tts_command == "generate":
                _print(
                    generate(
                        args.text,
                        args.output,
                        provider=args.provider,
                        allow_paid=args.allow_paid,
                        voice=args.voice,
                    ),
                    pretty,
                )
            else:
                _print(play(args.path), pretty)
        elif args.command == "health":
            result = run_health(offline=args.offline)
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            _print(result, pretty)
        elif args.command == "research":
            if args.research_command == "search":
                _print(search(args.provider, args.query, args.limit), pretty)
            else:
                _print(
                    {
                        "provider": "semantic-scholar-recommendations",
                        "paper_id": args.paper_id,
                        "results": recommend_semantic_scholar(args.paper_id, args.limit),
                    },
                    pretty,
                )
        elif args.command == "feeds":
            result = run_config(args.config)
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            _print(result, pretty)
        elif args.command == "news":
            result = fetch_rss(args.urls, args.limit_per_feed)
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            _print(result, pretty)
        elif args.command == "tasks":
            bridge = TasksBridge()
            if args.tasks_command == "tasklists":
                _print(bridge.list_tasklists(), pretty)
            elif args.tasks_command == "list":
                _print(bridge.list_tasks(args.tasklist_id, args.show_completed), pretty)
            elif args.tasks_command == "create":
                _print(
                    bridge.create_task(
                        args.title,
                        tasklist_id=args.tasklist_id,
                        notes=args.notes,
                        due=args.due,
                    ),
                    pretty,
                )
            else:
                _print(bridge.complete_task(args.task_id, tasklist_id=args.tasklist_id), pretty)
        elif args.command == "job":
            if args.job_command == "run":
                job = json.loads(args.job_file.read_text(encoding="utf-8"))
            else:
                job = {"type": args.job_type, "payload": json.loads(args.payload_json)}
            receipt = execute(job, output_dir=args.output_dir)
            _print(receipt, pretty)
            return 0 if receipt["status"] == "success" else 1
        else:
            raise AssertionError(f"Unhandled command: {args.command}")
        return 0
    except KeyboardInterrupt:
        return 130
    except Exception as exc:
        _print({"status": "error", "type": type(exc).__name__, "message": str(exc)}, pretty)
        return 1
