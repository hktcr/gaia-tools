from __future__ import annotations

import ipaddress
import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping


DEFAULT_ALLOWED_HOSTS = frozenset(
    {
        "api.open-meteo.com",
        "services.swpc.noaa.gov",
        "api.crossref.org",
        "api.openalex.org",
        "api.datacite.org",
        "www.ebi.ac.uk",
        "openlibrary.org",
        "archive.org",
        "api.semanticscholar.org",
        "api.skolverket.se",
        "api.artdatabanken.se",
        "api.elevenlabs.io",
        "newsdata.io",
    }
)

REDACTED_HEADER_NAMES = frozenset(
    {
        "authorization",
        "x-api-key",
        "xi-api-key",
        "ocp-apim-subscription-key",
        "api-key",
        "apikey",
    }
)


class HttpError(RuntimeError):
    """Raised when a bounded HTTP request fails."""


@dataclass(frozen=True)
class HttpResponse:
    status: int
    url: str
    headers: Mapping[str, str]
    body: bytes

    def json(self) -> Any:
        try:
            return json.loads(self.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HttpError(f"Response from {self.url} was not valid JSON") from exc


def _validate_host(host: str) -> None:
    lowered = host.rstrip(".").lower()
    if lowered in {"localhost", "localhost.localdomain"}:
        raise HttpError("Localhost is not an allowed network target")
    if lowered.endswith((".local", ".internal", ".lan", ".home")):
        raise HttpError(f"Private hostname is not allowed: {host}")
    try:
        address = ipaddress.ip_address(lowered.strip("[]"))
    except ValueError:
        return
    if not address.is_global:
        raise HttpError(f"Private or non-global IP address is not allowed: {host}")


def _redact_headers(headers: Mapping[str, str]) -> dict[str, str]:
    return {
        key: ("[REDACTED]" if key.lower() in REDACTED_HEADER_NAMES else value)
        for key, value in headers.items()
    }


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, validator):
        super().__init__()
        self._validator = validator

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self._validator(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class HttpClient:
    """Small HTTPS client with allowlists, bounded reads, retry and redaction."""

    def __init__(
        self,
        *,
        allowed_hosts: set[str] | frozenset[str] | None = None,
        timeout: float = 20.0,
        max_bytes: int = 5_000_000,
        retries: int = 3,
        user_agent: str = "GAIA-Execution/0.1 (+local user-controlled client)",
    ) -> None:
        self.allowed_hosts = frozenset(allowed_hosts or DEFAULT_ALLOWED_HOSTS)
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.retries = retries
        self.user_agent = user_agent

    def _validate_url(self, url: str) -> urllib.parse.ParseResult:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https":
            raise HttpError("Only HTTPS URLs are allowed")
        if not parsed.hostname:
            raise HttpError("URL has no hostname")
        _validate_host(parsed.hostname)
        if parsed.hostname.lower() not in self.allowed_hosts:
            raise HttpError(f"Host is not on the allowlist: {parsed.hostname}")
        if parsed.username or parsed.password:
            raise HttpError("Credentials embedded in URLs are not allowed")
        return parsed

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        data: bytes | None = None,
    ) -> HttpResponse:
        self._validate_url(url)
        clean_headers = {"User-Agent": self.user_agent, **dict(headers or {})}
        request = urllib.request.Request(
            url=url,
            method=method.upper(),
            headers=clean_headers,
            data=data,
        )
        opener = urllib.request.build_opener(_SafeRedirectHandler(self._validate_url))
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with opener.open(request, timeout=self.timeout) as response:
                    body = response.read(self.max_bytes + 1)
                    if len(body) > self.max_bytes:
                        raise HttpError(
                            f"Response exceeded the configured limit of {self.max_bytes} bytes"
                        )
                    return HttpResponse(
                        status=int(response.status),
                        url=str(response.geturl()),
                        headers={k: v for k, v in response.headers.items()},
                        body=body,
                    )
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code not in {429, 500, 502, 503, 504} or attempt >= self.retries:
                    detail = exc.read(2_000).decode("utf-8", errors="replace")
                    raise HttpError(
                        f"HTTP {exc.code} from {url}: {detail[:500]}"
                    ) from exc
            except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
                last_error = exc
                if attempt >= self.retries:
                    raise HttpError(f"Network error while requesting {url}: {exc}") from exc
            time.sleep(min(2**attempt, 8))
        raise HttpError(f"Request failed: {last_error}")

    def get_json(self, url: str, *, headers: Mapping[str, str] | None = None) -> Any:
        return self.request("GET", url, headers=headers).json()

    def post_json(
        self,
        url: str,
        payload: Any,
        *,
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        merged = {"Content-Type": "application/json", **dict(headers or {})}
        return self.request("POST", url, headers=merged, data=encoded).json()

    @staticmethod
    def safe_request_metadata(
        method: str, url: str, headers: Mapping[str, str] | None = None
    ) -> dict[str, Any]:
        return {
            "method": method.upper(),
            "url": url,
            "headers": _redact_headers(dict(headers or {})),
        }
