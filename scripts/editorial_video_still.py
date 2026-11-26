#!/usr/bin/env python3
"""Generate an editorial still from a locally supplied, cleared press video.

No network access, YouTube downloads, uploads or article updates.
The caller must independently verify the rights recorded in the manifest.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import tempfile
from urllib.parse import urlsplit


MAX_BYTES = 250 * 1024 * 1024
MAX_DURATION = 600
SAMPLE_SIZE = 64 * 36 * 3
VIDEO_FORMATS = 'mov,mp4,m4a,3gp,3g2,mj2,matroska,webm'
IMAGE_FORMATS = 'image2,png_pipe,jpeg_pipe,webp_pipe'
REQUIRED_RIGHTS = ('frame_extraction', 'editorial_publication', 'thumbnail',
                   'self_hosting', 'third_party_rights', 'conditions_satisfied')


def local_file(value, extensions):
    p = Path(value).resolve(strict=True)
    if not p.is_file() or p.suffix.lower() not in extensions or not 0 < p.stat().st_size <= MAX_BYTES:
        raise ValueError('Unsupported local file or size')
    return p


def https_url(value):
    u = urlsplit(value)
    if u.scheme != 'https' or not u.hostname or u.username or u.password:
        raise ValueError('Expected HTTPS evidence URL')
    return u


def validate_manifest(m):
    if not isinstance(m, dict) or any(m.get(k) is not True for k in REQUIRED_RIGHTS):
        raise ValueError('All required rights must be independently confirmed')
    for k in ('source_url', 'announcement_url', 'rights_url'):
        https_url(m[k])
    host = https_url(m['source_url']).hostname.lower()
    if host == 'youtu.be' or any(host == d or host.endswith('.' + d) for d in ('youtube.com', 'youtube-nocookie.com', 'googlevideo.com', 'ytimg.com')):
        raise ValueError('Use a separately authorized manufacturer-distributed local video')
    if not all(isinstance(m.get(k), str) and m[k].strip() for k in ('credit', 'verified_at', 'title')):
        raise ValueError('Missing attribution, verification date or title')
    if m.get('advertising_compatible') is not True:
        raise ValueError('Advertising compatibility must be confirmed')
    if not isinstance(m.get('article_id'), int) or isinstance(m['article_id'], bool) or m['article_id'] <= 0:
        raise ValueError('Invalid article ID')


def run(args, timeout=20):
    return subprocess.run(args, check=True, capture_output=True, timeout=timeout).stdout


def probe(video):
    out = run(['ffprobe', '-v', 'error', '-protocol_whitelist', 'file',
               '-format_whitelist', VIDEO_FORMATS, '-show_entries', 'format=duration:stream=width,height,codec_type',
               '-of', 'json', str(video)])
    data = json.loads(out)
    duration = float(data['format']['duration'])
    streams = [s for s in data['streams'] if s['codec_type'] == 'video']
    if not math.isfinite(duration) or not 0 < duration <= MAX_DURATION or not streams:
        raise ValueError('Unsupported video duration or missing video stream')
    if any(not 0 < s.get('width', 0) <= 4096 or not 0 < s.get('height', 0) <= 4096 for s in streams):
        raise ValueError('Unsupported video dimensions')
    return duration


def frame_command(path, timestamp=None, image=False):
    cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-filter_threads', '1',
           '-protocol_whitelist', 'file,pipe', '-format_whitelist', IMAGE_FORMATS if image else VIDEO_FORMATS]
    if timestamp is not None:
        cmd += ['-ss', f'{timestamp:.3f}']
    return cmd + ['-i', str(path), '-map', '0:v:0', '-frames:v', '1', '-an', '-sn', '-dn']


def pixels(path, timestamp=None, image=False):
    raw = run(frame_command(path, timestamp, image) + ['-vf', 'scale=64:36', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    if len(raw) != SAMPLE_SIZE:
        raise ValueError('Frame decode failed')
    return raw


def choose(video, times, reference=None):
    ref = pixels(reference, image=True) if reference else None
    candidates = []
    for t in times:
        raw = pixels(video, t)
        luma = [(raw[i] * 3 + raw[i+1] * 6 + raw[i+2]) / 10 for i in range(0, len(raw), 3)]
        spread = statistics.pstdev(luma)
        if spread < 8 or not 15 < statistics.mean(luma) < 240:
            continue  # avoid blank or nearly blank frames
        score = -sum(abs(a-b) for a, b in zip(raw, ref)) / len(raw) if ref else spread
        candidates.append((score, t))
    if not candidates:
        raise ValueError('No usable frame; keep thumbnail waiting')
    return max(candidates, key=lambda item: (item[0], -item[1]))[1]


def generate(video, manifest, output_dir, times=None, reference=None):
    validate_manifest(manifest)
    video = local_file(video, {'.mp4', '.mov', '.webm', '.mkv'})
    if reference:
        reference = local_file(reference, {'.jpg', '.jpeg', '.png', '.webp'})
    duration = probe(video)
    times = times if times else [duration * (i + 1) / 10 for i in range(8)]
    if len(times) > 12 or any(not math.isfinite(t) or not 0 <= t < duration for t in times):
        raise ValueError('Invalid candidate timestamps')
    chosen = choose(video, times, reference)
    output_dir = Path(output_dir).resolve(strict=True)
    if not output_dir.is_dir():
        raise ValueError('Output directory required')
    with tempfile.TemporaryDirectory(dir=output_dir) as tmp:
        result = Path(tmp) / 'still.webp'
        run(frame_command(video, chosen) + ['-vf', "scale='min(1200,iw)':-2", '-c:v', 'libwebp',
                                           '-quality', '85', '-f', 'webp', str(result)])
        pixels(result, image=True)
        blob = result.read_bytes()
        digest = hashlib.sha256(blob).hexdigest()
        dest = output_dir / f"{manifest['article_id']}-still-{digest[:16]}.webp"
        try:
            dest.hardlink_to(result)
        except FileExistsError:
            if dest.read_bytes() != blob:
                raise ValueError('Existing output differs; refusing overwrite')
    return {'path': str(dest), 'sha256': digest, 'timestamp_seconds': round(chosen, 3),
            'source_url': manifest['source_url'], 'announcement_url': manifest['announcement_url'],
            'rights_url': manifest['rights_url'], 'credit': manifest['credit'],
            'verified_at': manifest['verified_at'], 'title': manifest['title'],
            'requires_editorial_review': True}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--video', required=True)
    p.add_argument('--manifest', required=True)
    p.add_argument('--output-dir', required=True)
    p.add_argument('--reference', help='Optional authorized local reference image')
    p.add_argument('--time', type=float, action='append', help='Candidate timestamp in seconds (repeat up to 12)')
    a = p.parse_args()
    try:
        manifest = json.loads(Path(a.manifest).read_text(encoding='utf-8'))
        print(json.dumps(generate(a.video, manifest, a.output_dir, a.time, a.reference), ensure_ascii=False))
    except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError) as exc:
        p.exit(1, f'Unable to generate a still: {exc}\n')


if __name__ == '__main__':
    main()
