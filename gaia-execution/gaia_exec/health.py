from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from typing import Any

from .http import HttpClient, HttpError


@dataclass(frozen=True)
class ProviderCheck:
    name: str
    url: str
    expected: str


OPEN_PROVIDER_CHECKS = (
    ProviderCheck(
        "open-meteo",
        "https://api.open-meteo.com/v1/forecast?latitude=56.13&longitude=12.95&current=temperature_2m",
        "json",
    ),
    ProviderCheck(
        "noaa-swpc",
        "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
        "json",
    ),
    ProviderCheck(
        "crossref",
        "https://api.crossref.org/works?query.title=biology&rows=1",
        "json",
    ),
    ProviderCheck(
        "openalex",
        "https://api.openalex.org/works?search=biology&per-page=1",
        "json",
    ),
    ProviderCheck(
        "datacite",
        "https://api.datacite.org/dois?page%5Bsize%5D=1",
        "json",
    ),
    ProviderCheck(
        "europe-pmc",
        "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=OPEN_ACCESS%3AY&pageSize=1&format=json",
        "json",
    ),
    ProviderCheck(
        "openlibrary",
        "https://openlibrary.org/search.json?q=biology&limit=1",
        "json",
    ),
    ProviderCheck(
        "internet-archive",
        "https://archive.org/advancedsearch.php?q=mediatype%3Atexts&fl%5B%5D=identifier&rows=1&page=1&output=json",
        "json",
    ),
    ProviderCheck(
        "semantic-scholar",
        "https://api.semanticscholar.org/graph/v1/paper/search?query=biology&limit=1&fields=title",
        "json",
    ),
)


def run_health(*, offline: bool = False) -> dict[str, Any]:
    started = time.time()
    if offline:
        return {
            "status": "configured",
            "mode": "offline",
            "providers": [asdict(check) for check in OPEN_PROVIDER_CHECKS],
            "duration_seconds": round(time.time() - started, 3),
        }

    client = HttpClient(timeout=15, max_bytes=2_000_000, retries=2)
    results: list[dict[str, Any]] = []
    for check in OPEN_PROVIDER_CHECKS:
        check_started = time.time()
        try:
            response = client.request("GET", check.url)
            if check.expected == "json":
                response.json()
            results.append(
                {
                    "name": check.name,
                    "ok": True,
                    "status_code": response.status,
                    "duration_seconds": round(time.time() - check_started, 3),
                }
            )
        except HttpError as exc:
            results.append(
                {
                    "name": check.name,
                    "ok": False,
                    "error": str(exc),
                    "duration_seconds": round(time.time() - check_started, 3),
                }
            )
    ok_count = sum(1 for result in results if result["ok"])
    return {
        "status": "ok" if ok_count == len(results) else "degraded",
        "mode": "live",
        "ok": ok_count,
        "total": len(results),
        "providers": results,
        "duration_seconds": round(time.time() - started, 3),
    }
