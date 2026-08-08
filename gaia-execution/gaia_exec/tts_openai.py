from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


MODEL = "gpt-4o-mini-tts"
VOICE = "marin"
MAX_CHARS = 3_500


def clean_manuscript(text: str) -> str:
    text = re.sub(r"<break\s+time=[\"'][^\"']+[\"']\s*/>", "\n\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def split_long_piece(piece: str, limit: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", piece)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if len(sentence) > limit:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(sentence[i : i + limit] for i in range(0, len(sentence), limit))
        elif not current:
            current = sentence
        elif len(current) + 1 + len(sentence) <= limit:
            current += " " + sentence
        else:
            chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)
    return chunks


def split_text(text: str, limit: int = MAX_CHARS) -> list[str]:
    pieces: list[str] = []
    for paragraph in re.split(r"\n\s*\n", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        pieces.extend(split_long_piece(paragraph, limit))

    chunks: list[str] = []
    current = ""
    for piece in pieces:
        candidate = piece if not current else current + "\n\n" + piece
        if len(candidate) <= limit:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = piece
    if current:
        chunks.append(current)
    return chunks


def request_audio(api_key: str, text: str, output: Path) -> None:
    payload = json.dumps(
        {
            "model": MODEL,
            "voice": VOICE,
            "input": text,
            "instructions": (
                "Tala på naturlig och tydlig svenska. Använd ett lugnt, professionellt "
                "och reflekterande berättartempo. Uttala siffror, procenttal och ämnesnamn "
                "omsorgsfullt. Gör korta naturliga pauser mellan stycken."
            ),
            "response_format": "mp3",
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            output.write_bytes(response.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI TTS failed with HTTP {exc.code}: {detail}") from exc


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manuscript", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    raw_text = args.manuscript.read_text(encoding="utf-8")
    text = clean_manuscript(raw_text)
    chunks = split_text(text)
    if not chunks:
        raise RuntimeError("The manuscript is empty")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="gaia-openai-tts-") as temp_name:
        temp_dir = Path(temp_name)
        segment_paths: list[Path] = []
        for index, chunk in enumerate(chunks, start=1):
            segment = temp_dir / f"segment-{index:02d}.mp3"
            request_audio(api_key, chunk, segment)
            segment_paths.append(segment)

        concat_file = temp_dir / "concat.txt"
        concat_file.write_text(
            "".join(f"file '{path.as_posix()}'\n" for path in segment_paths),
            encoding="utf-8",
        )
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_file),
                "-c:a",
                "libmp3lame",
                "-q:a",
                "2",
                "-y",
                str(args.output),
            ],
            check=True,
        )

    digest = hashlib.sha256(args.output.read_bytes()).hexdigest()
    receipt = {
        "provider": "OpenAI",
        "model": MODEL,
        "voice": VOICE,
        "language": "sv",
        "characters": len(text),
        "segments": len(chunks),
        "sha256": digest,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclosure": "AI-generated voice",
    }
    args.receipt.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
