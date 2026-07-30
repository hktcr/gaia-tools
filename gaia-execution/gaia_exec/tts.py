from __future__ import annotations

import html
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from .http import HttpClient
from .secrets import SecretStore


RIVER_VOICE_ID = "SAz9YHcvj6GT2YYXdXww"


class TtsError(RuntimeError):
    """Raised when speech generation cannot be completed."""


def _browser_document(text: str, lang: str = "sv-SE") -> str:
    safe_text = json.dumps(text, ensure_ascii=False)
    safe_lang = html.escape(lang, quote=True)
    return f"""<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>gAIa lokal talsyntes</title>
<style>
body {{ font-family: system-ui, sans-serif; max-width: 760px; margin: 3rem auto; padding: 0 1rem; line-height: 1.55; }}
button, select, input {{ font: inherit; padding: .65rem .8rem; margin: .25rem; }}
textarea {{ width: 100%; min-height: 15rem; font: inherit; padding: .8rem; }}
.controls {{ display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; margin: 1rem 0; }}
</style>
</head>
<body>
<h1>gAIa lokal talsyntes</h1>
<p>Den här sidan använder webbläsarens inbyggda SpeechSynthesis. Ingen text skickas till en extern TTS-tjänst.</p>
<textarea id="text"></textarea>
<div class="controls">
<label>Röst <select id="voice"></select></label>
<label>Hastighet <input id="rate" type="number" min="0.5" max="2" step="0.1" value="1"></label>
<button id="speak">Läs upp</button>
<button id="stop">Stoppa</button>
</div>
<script>
const initialText = {safe_text};
const language = "{safe_lang}";
const text = document.getElementById('text');
const voices = document.getElementById('voice');
text.value = initialText;
function refreshVoices() {{
  const all = speechSynthesis.getVoices();
  voices.innerHTML = '';
  all.forEach((voice, index) => {{
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${{voice.name}} (${{voice.lang}})`;
    if (voice.lang.toLowerCase().startsWith(language.slice(0,2).toLowerCase())) option.selected = true;
    voices.appendChild(option);
  }});
}}
refreshVoices();
speechSynthesis.onvoiceschanged = refreshVoices;
document.getElementById('speak').onclick = () => {{
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.value);
  const all = speechSynthesis.getVoices();
  const selected = all[Number(voices.value)];
  if (selected) utterance.voice = selected;
  utterance.lang = selected?.lang || language;
  utterance.rate = Number(document.getElementById('rate').value) || 1;
  speechSynthesis.speak(utterance);
}};
document.getElementById('stop').onclick = () => speechSynthesis.cancel();
</script>
</body>
</html>
"""


def _run_local_synth(text: str, output: Path, voice: str | None = None) -> dict[str, Any] | None:
    say = shutil.which("say")
    if say:
        output = output if output.suffix.lower() in {".aiff", ".aif", ".m4a"} else output.with_suffix(".aiff")
        command = [say, "-o", str(output)]
        if voice:
            command.extend(["-v", voice])
        command.append(text)
        subprocess.run(command, check=True)
        return {"provider": "macos-say", "artifact": str(output), "format": output.suffix.lstrip(".") or "aiff"}

    for executable in ("espeak-ng", "espeak"):
        binary = shutil.which(executable)
        if binary:
            output = output if output.suffix.lower() == ".wav" else output.with_suffix(".wav")
            command = [binary, "-w", str(output), text]
            subprocess.run(command, check=True)
            return {"provider": executable, "artifact": str(output), "format": "wav"}
    return None


def _generate_elevenlabs(
    text: str,
    output: Path,
    *,
    allow_paid: bool,
    voice_id: str = RIVER_VOICE_ID,
) -> dict[str, Any]:
    if not allow_paid:
        raise TtsError("ElevenLabs requires the explicit --allow-paid flag")
    key = SecretStore().get("ELEVENLABS_API_KEY", required=True)
    client = HttpClient(max_bytes=25_000_000)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    response = client.request(
        "POST",
        url,
        headers={
            "xi-api-key": key or "",
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    )
    output.write_bytes(response.body)
    return {
        "provider": "elevenlabs",
        "artifact": str(output),
        "format": "mp3",
        "characters": len(text),
        "paid": True,
    }


def generate(
    text: str,
    output: Path,
    *,
    provider: str = "auto",
    allow_paid: bool = False,
    voice: str | None = None,
    lang: str = "sv-SE",
) -> dict[str, Any]:
    output.parent.mkdir(parents=True, exist_ok=True)
    selected = provider.lower()
    if selected not in {"auto", "local", "browser", "elevenlabs"}:
        raise TtsError(f"Unknown provider: {provider}")

    if selected in {"auto", "local"}:
        result = _run_local_synth(text, output, voice=voice)
        if result:
            return result
        if selected == "local":
            raise TtsError("No supported local speech command was found")

    if selected in {"auto", "browser"}:
        html_output = output if output.suffix.lower() == ".html" else output.with_suffix(".html")
        html_output.write_text(_browser_document(text, lang=lang), encoding="utf-8")
        return {
            "provider": "browser-speechsynthesis",
            "artifact": str(html_output),
            "format": "html",
            "paid": False,
        }

    paid_output = output if output.suffix.lower() == ".mp3" else output.with_suffix(".mp3")
    return _generate_elevenlabs(text, paid_output, allow_paid=allow_paid)


def play(path: Path) -> dict[str, str]:
    if not path.exists():
        raise TtsError(f"Audio file does not exist: {path}")
    candidates = (
        ("afplay", ["afplay", str(path)]),
        ("ffplay", ["ffplay", "-nodisp", "-autoexit", str(path)]),
        ("aplay", ["aplay", str(path)]),
    )
    for name, command in candidates:
        if shutil.which(name):
            subprocess.run(command, check=True)
            return {"player": name, "artifact": str(path)}
    raise TtsError("No supported audio player was found")
