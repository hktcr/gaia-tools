import json
import tempfile
import unittest
from pathlib import Path

from gaia_exec.jobs import execute, validate_job


class JobTests(unittest.TestCase):
    def test_rejects_unknown_job(self):
        with self.assertRaises(ValueError):
            validate_job({"type": "shell.exec", "payload": {}})

    def test_offline_health_job_writes_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = execute(
                {"id": "test-health", "type": "health.open_apis", "payload": {"offline": True}},
                output_dir=Path(directory),
            )
            self.assertEqual(receipt["status"], "success")
            path = Path(receipt["receipt"])
            self.assertTrue(path.exists())
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(data["id"], "test-health")

    def test_browser_tts_job(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = execute(
                {
                    "id": "test-tts",
                    "type": "tts.generate",
                    "payload": {"text": "Hej", "provider": "browser", "output": "hej.html"},
                },
                output_dir=Path(directory),
            )
            self.assertEqual(receipt["status"], "success")
            self.assertTrue((Path(directory) / "hej.html").exists())


if __name__ == "__main__":
    unittest.main()
