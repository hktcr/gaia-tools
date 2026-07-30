from __future__ import annotations

import datetime as dt
from typing import Any

from .http import HttpClient
from .secrets import SecretStore


BASE_URL = "https://api.artdatabanken.se/species-observation-system/v1"


def _date(value: str | None) -> str | None:
    if value is None:
        return None
    parsed = dt.date.fromisoformat(value)
    return parsed.isoformat()


def count_observations(
    *,
    taxon_ids: list[int] | None = None,
    area_feature_ids: list[int] | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    taxon_ids = taxon_ids or []
    area_feature_ids = area_feature_ids or []
    if any(value <= 0 for value in taxon_ids + area_feature_ids):
        raise ValueError("Taxon and area identifiers must be positive integers")
    start = _date(start_date)
    end = _date(end_date)
    if start and end and start > end:
        raise ValueError("start_date must not be later than end_date")

    payload: dict[str, Any] = {}
    if taxon_ids:
        payload["taxon"] = {"ids": taxon_ids, "includeUnderlyingTaxa": True}
    if area_feature_ids:
        payload["geographics"] = {"areas": [{"featureId": value} for value in area_feature_ids]}
    if start or end:
        payload["date"] = {
            key: value
            for key, value in {"startDate": start, "endDate": end}.items()
            if value
        }

    key = SecretStore().get("ARTPORTALEN_API_KEY", required=True)
    data = HttpClient().post_json(
        f"{BASE_URL}/Observations/Count",
        payload,
        headers={"Ocp-Apim-Subscription-Key": key or ""},
    )
    return {"provider": "artportalen-sos", "filter": payload, "response": data}
