import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('still', Path(__file__).resolve().parents[1] / 'scripts/editorial_video_still.py')
still = importlib.util.module_from_spec(spec)
spec.loader.exec_module(still)


def manifest():
    return dict.fromkeys(still.REQUIRED_RIGHTS, True) | {
        'article_id': 123, 'source_url': 'https://example.com/press/video.mp4',
        'announcement_url': 'https://example.com/press', 'rights_url': 'https://example.com/terms',
        'credit': 'Synthetic test', 'verified_at': '2026-11-27', 'title': 'Synthetic test',
        'advertising_compatible': True,
    }


class StillTests(unittest.TestCase):
    def test_missing_rights(self):
        m = manifest()
        m['frame_extraction'] = False
        with self.assertRaises(ValueError):
            still.validate_manifest(m)

    def test_youtube_rejected(self):
        m = manifest()
        m['source_url'] = 'https://www.youtube.com/watch?v=example'
        with self.assertRaises(ValueError):
            still.validate_manifest(m)

    def test_local_generation_and_deduplication(self):
        with tempfile.TemporaryDirectory() as tmp:
            video = Path(tmp) / 'test.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10',
                            '-t', '3', '-c:v', 'libx264', '-threads', '1', str(video)], check=True)
            ref = Path(tmp) / 'reference.png'
            subprocess.run(['ffmpeg', '-v', 'error', '-ss', '2', '-i', str(video), '-frames:v', '1', '-threads', '1', str(ref)], check=True)
            a = still.generate(video, manifest(), tmp, [0.5, 2], ref)
            self.assertEqual(a['timestamp_seconds'], 2)
            self.assertTrue(a['requires_editorial_review'])
            self.assertEqual(Path(a['path']).read_bytes()[:4], b'RIFF')
            b = still.generate(video, manifest(), tmp, [0.5, 2], ref)
            self.assertEqual(a['path'], b['path'])


if __name__ == '__main__':
    unittest.main()
