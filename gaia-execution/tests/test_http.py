import unittest

from gaia_exec.http import HttpClient, HttpError


class HttpTests(unittest.TestCase):
    def test_rejects_http(self):
        with self.assertRaises(HttpError):
            HttpClient(allowed_hosts={"example.org"})._validate_url("http://example.org")

    def test_rejects_localhost(self):
        with self.assertRaises(HttpError):
            HttpClient(allowed_hosts={"localhost"})._validate_url("https://localhost/test")

    def test_redacts_sensitive_headers(self):
        metadata = HttpClient.safe_request_metadata(
            "GET", "https://example.org", {"Authorization": "secret", "Accept": "json"}
        )
        self.assertEqual(metadata["headers"]["Authorization"], "[REDACTED]")


if __name__ == "__main__":
    unittest.main()
