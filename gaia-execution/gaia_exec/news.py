from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import re
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any

from .http import HttpClient


def _text(element: ET.Element | None) -> str:
    if element is None or element.text is None:
        return ""
    return re.sub(r"\s+", " ", element.text).strip()


def _normalise_date(value: str) -> str | None:
    if not value:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        try:
            return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
        except ValueError:
            return value


def parse_feed(xml_bytes: bytes, source_url: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_bytes)
    items: list[dict[str, Any]] = []
    if root.tag.lower().endswith("rss") or root.find("channel") is not None:
        channel = root.find("channel")
        if channel is None:
            channel = root
        for item in channel.findall("item"):
            title = _text(item.find("title"))
            link = _text(item.find("link"))
            guid = _text(item.find("guid"))
            published = _text(item.find("pubDate"))
            summary = _text(item.find("description"))
            items.append(
                {
                    "title": title,
                    "url": link or guid,
                    "published": _normalise_date(published),
                    "summary": summary,
                    "source_feed": source_url,
                }
            )
    else:
        namespace = "{http://www.w3.org/2005/Atom}"
        entries = root.findall(f"{namespace}entry") or root.findall("entry")
        for entry in entries:
            title_element = entry.find(f"{namespace}title")
            if title_element is None:
                title_element = entry.find("title")
            title = _text(title_element)
            link_element = entry.find(f"{namespace}link")
            if link_element is None:
                link_element = entry.find("link")
            link = link_element.get("href", "") if link_element is not None else ""
            published_element = entry.find(f"{namespace}published")
            if published_element is None:
                published_element = entry.find(f"{namespace}updated")
            if published_element is None:
                published_element = entry.find("published")
            if published_element is None:
                published_element = entry.find("updated")
            published = _text(published_element)
            summary_element = entry.find(f"{namespace}summary")
            if summary_element is None:
                summary_element = entry.find(f"{namespace}content")
            if summary_element is None:
                summary_element = entry.find("summary")
            if summary_element is None:
                summary_element = entry.find("content")
            summary = _text(summary_element)
            items.append(
                {
                    "title": title,
                    "url": link,
                    "published": _normalise_date(published),
                    "summary": summary,
                    "source_feed": source_url,
                }
            )
    for item in items:
        identity = (item.get("url") or item.get("title") or "").strip().lower()
        item["id"] = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    return items


def fetch_rss(urls: list[str], limit_per_feed: int = 50) -> dict[str, Any]:
    all_items: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for url in urls:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname:
            errors.append({"url": url, "error": "Only HTTPS feed URLs are accepted"})
            continue
        client = HttpClient(
            allowed_hosts={parsed.hostname.lower()}, max_bytes=5_000_000, retries=2
        )
        try:
            response = client.request("GET", url)
            all_items.extend(parse_feed(response.body, url)[:limit_per_feed])
        except Exception as exc:
            errors.append({"url": url, "error": str(exc)})
    unique: dict[str, dict[str, Any]] = {}
    for item in all_items:
        unique[item["id"]] = item
    ordered = sorted(
        unique.values(), key=lambda item: item.get("published") or "", reverse=True
    )
    return {"items": ordered, "errors": errors, "feeds": len(urls)}
