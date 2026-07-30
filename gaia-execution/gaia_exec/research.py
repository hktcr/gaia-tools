from __future__ import annotations

import urllib.parse
from typing import Any, Callable

from .http import HttpClient
from .secrets import SecretStore


def _headers_for_semantic_scholar() -> dict[str, str]:
    key = SecretStore().get("SEMANTIC_SCHOLAR_API_KEY")
    return {"x-api-key": key} if key else {}


def search_semantic_scholar(query: str, limit: int = 10) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    params = urllib.parse.urlencode(
        {
            "query": query,
            "limit": limit,
            "fields": "paperId,title,abstract,year,authors,url,externalIds,citationCount,openAccessPdf",
        }
    )
    data = HttpClient().get_json(
        f"https://api.semanticscholar.org/graph/v1/paper/search?{params}",
        headers=_headers_for_semantic_scholar(),
    )
    return list(data.get("data", []))


def recommend_semantic_scholar(paper_id: str, limit: int = 20) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 500))
    encoded = urllib.parse.quote(paper_id, safe="")
    params = urllib.parse.urlencode(
        {
            "limit": limit,
            "fields": "paperId,title,abstract,year,authors,url,externalIds,citationCount,openAccessPdf",
        }
    )
    data = HttpClient().get_json(
        f"https://api.semanticscholar.org/recommendations/v1/papers/forpaper/{encoded}?{params}",
        headers=_headers_for_semantic_scholar(),
    )
    return list(data.get("recommendedPapers", []))


def search_crossref(query: str, limit: int = 10) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    params = urllib.parse.urlencode({"query": query, "rows": limit})
    data = HttpClient().get_json(f"https://api.crossref.org/works?{params}")
    return list(data.get("message", {}).get("items", []))


def search_openalex(query: str, limit: int = 10) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    params = urllib.parse.urlencode({"search": query, "per-page": limit})
    data = HttpClient().get_json(f"https://api.openalex.org/works?{params}")
    return list(data.get("results", []))


def search_datacite(query: str, limit: int = 10) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    params = urllib.parse.urlencode({"query": query, "page[size]": limit})
    data = HttpClient().get_json(f"https://api.datacite.org/dois?{params}")
    return list(data.get("data", []))


def search_europe_pmc(query: str, limit: int = 10) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 1000))
    params = urllib.parse.urlencode({"query": query, "pageSize": limit, "format": "json"})
    data = HttpClient().get_json(
        f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?{params}"
    )
    return list(data.get("resultList", {}).get("result", []))


SEARCHERS: dict[str, Callable[[str, int], list[dict[str, Any]]]] = {
    "semantic-scholar": search_semantic_scholar,
    "crossref": search_crossref,
    "openalex": search_openalex,
    "datacite": search_datacite,
    "europe-pmc": search_europe_pmc,
}


def search(provider: str, query: str, limit: int = 10) -> dict[str, Any]:
    try:
        searcher = SEARCHERS[provider]
    except KeyError as exc:
        raise ValueError(f"Unknown research provider: {provider}") from exc
    return {"provider": provider, "query": query, "results": searcher(query, limit)}
