import unittest

from gaia_exec.news import parse_feed


class NewsTests(unittest.TestCase):
    def test_parse_rss(self):
        xml = b"""<?xml version='1.0'?><rss><channel><item><title>A</title><link>https://example.org/a</link><pubDate>Thu, 30 Jul 2026 10:00:00 GMT</pubDate></item></channel></rss>"""
        items = parse_feed(xml, "https://example.org/feed")
        self.assertEqual(items[0]["title"], "A")
        self.assertTrue(items[0]["id"])


if __name__ == "__main__":
    unittest.main()
