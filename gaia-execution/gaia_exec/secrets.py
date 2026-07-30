from __future__ import annotations

import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


class SecretError(RuntimeError):
    """Raised for missing or invalid secret configuration."""


@dataclass(frozen=True)
class SecretStatus:
    name: str
    present: bool
    source: str | None


class SecretStore:
    """Resolve secrets without reading Markdown, config files or source files."""

    def __init__(self, *, keychain_account: str = "gaia") -> None:
        self.keychain_account = keychain_account

    @staticmethod
    def _normalise_name(name: str) -> str:
        if not re.fullmatch(r"[A-Z][A-Z0-9_]{2,127}", name):
            raise SecretError(
                "Secret names must use uppercase letters, digits and underscores"
            )
        return name

    def _from_environment(self, name: str) -> str | None:
        value = os.environ.get(name)
        return value if value else None

    def _from_macos_keychain(self, name: str) -> str | None:
        security = shutil.which("security")
        if not security:
            return None
        result = subprocess.run(
            [
                security,
                "find-generic-password",
                "-a",
                self.keychain_account,
                "-s",
                f"gaia:{name}",
                "-w",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return None
        value = result.stdout.strip()
        return value or None

    def get(self, name: str, *, required: bool = False) -> str | None:
        name = self._normalise_name(name)
        value = self._from_environment(name)
        if value:
            return value
        value = self._from_macos_keychain(name)
        if value:
            return value
        if required:
            raise SecretError(
                f"Secret {name} is missing. Use an environment variable or macOS Keychain."
            )
        return None

    def status(self, name: str) -> SecretStatus:
        name = self._normalise_name(name)
        if self._from_environment(name):
            return SecretStatus(name, True, "environment")
        if self._from_macos_keychain(name):
            return SecretStatus(name, True, "macos-keychain")
        return SecretStatus(name, False, None)

    def set_macos_keychain(self, name: str, value: str) -> None:
        name = self._normalise_name(name)
        if not value:
            raise SecretError("Refusing to store an empty secret")
        security = shutil.which("security")
        if not security:
            raise SecretError("The macOS security command is unavailable")
        subprocess.run(
            [
                security,
                "add-generic-password",
                "-U",
                "-a",
                self.keychain_account,
                "-s",
                f"gaia:{name}",
                "-w",
                value,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


SECRET_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("github-token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b")),
    ("openai-like-key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("elevenlabs-like-key", re.compile(r"\bsk_[A-Za-z0-9]{24,}\b")),
    (
        "assigned-secret",
        re.compile(
            r"(?i)(?:api[_ -]?key|token|secret|password)\s*[:=]\s*[\"']?[A-Za-z0-9_./+-]{24,}"
        ),
    ),
)

TEXT_SUFFIXES = {
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".py",
    ".js",
    ".ts",
    ".html",
    ".css",
    ".toml",
    ".ini",
    ".cfg",
    ".sh",
}


def scan_paths(paths: Iterable[Path]) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(p for p in path.rglob("*") if p.is_file())
        elif path.is_file():
            files.append(path)
    for path in sorted(set(files)):
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for line_number, line in enumerate(text.splitlines(), start=1):
            for label, pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    findings.append(
                        {
                            "path": str(path),
                            "line": line_number,
                            "kind": label,
                        }
                    )
    return findings
