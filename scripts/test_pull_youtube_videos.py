import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "pull_youtube_videos", Path(__file__).with_name("pull-youtube-videos.py")
)
pull = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pull)


def video(vid, tab, published="2026-10-01T00:00:00Z"):
    return {"videoId": vid, "title": vid, "publishedAt": published, "tab": tab}


class MergeTabsTest(unittest.TestCase):
    def test_failed_tab_keeps_previous_entries(self):
        previous = [video("s1", "shorts"), video("v1", "videos")]
        merged = pull.merge_tabs(previous, {"videos": [video("v1", "videos")], "shorts": None, "streams": []})
        self.assertEqual({v["videoId"] for v in merged}, {"s1", "v1"})

    def test_entries_without_a_tab_count_as_videos(self):
        previous = [{"videoId": "old", "title": "old", "publishedAt": None}]
        merged = pull.merge_tabs(previous, {"videos": None, "shorts": [], "streams": []})
        self.assertEqual([v["videoId"] for v in merged], ["old"])

    def test_a_stream_listed_under_videos_too_stays_a_stream(self):
        fetched = {
            "streams": [video("x", "streams")],
            "shorts": [],
            "videos": [video("x", "videos"), video("y", "videos")],
        }
        merged = pull.merge_tabs([], fetched)
        self.assertEqual(sorted((v["videoId"], v["tab"]) for v in merged), [("x", "streams"), ("y", "videos")])

    def test_newest_first_with_undated_shorts_last(self):
        fetched = {
            "streams": [],
            "shorts": [video("s", "shorts", None)],
            "videos": [video("a", "videos", "2026-01-01T00:00:00Z"), video("b", "videos", "2026-09-01T00:00:00Z")],
        }
        self.assertEqual([v["videoId"] for v in pull.merge_tabs([], fetched)], ["b", "a", "s"])


if __name__ == "__main__":
    unittest.main()
