import os
import tempfile
import unittest
from pathlib import Path

from gaia_exec.secrets import SecretStore, scan_paths


class SecretTests(unittest.TestCase):
    def test_environment_secret(self):
        os.environ["GAIA_TEST_SECRET"] = "test-value"
        try:
            self.assertEqual(SecretStore().get("GAIA_TEST_SECRET"), "test-value")
            status = SecretStore().status("GAIA_TEST_SECRET")
            self.assertTrue(status.present)
            self.assertEqual(status.source, "environment")
        finally:
            del os.environ["GAIA_TEST_SECRET"]

    def test_invalid_name(self):
        with self.assertRaises(Exception):
            SecretStore().get("bad-name")

    def test_scan_reports_location_without_value(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.md"
            path.write_text("api_key: " + "A" * 40, encoding="utf-8")
            findings = scan_paths([path])
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]["line"], 1)
            self.assertNotIn("A" * 40, str(findings))


if __name__ == "__main__":
    unittest.main()
