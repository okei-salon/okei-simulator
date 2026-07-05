#!/usr/bin/env python3
"""Re-export O-chan v2 poses from the motion-set reference sheet.

Usage:
  python3 tools/ochan-v2-export.py [path/to/reference-sheet.png]

Output: assets/ochan/v2/01_normal.png … 20_wave.png (512x512 RGBA)

Replace the reference sheet with a higher-resolution master when available.
"""
from PIL import Image
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = os.path.join(
    ROOT,
    'assets/ochan/v2/_source/motion-set-ver1.png'
)
OUT = os.path.join(ROOT, 'assets/ochan/v2')
CANVAS = 512
PADDING = 36

NAMES = [
    '01_normal', '02_smile', '03_laugh', '04_wink', '05_cheer', '06_point',
    '07_thumbsup', '08_fist', '09_think', '10_idea', '11_clap', '12_celebrate',
    '13_heart', '14_cry', '15_sad', '16_panic', '17_surprised', '18_sparkle',
    '19_bow', '20_wave'
]


def bg_to_alpha(im):
    im = im.copy()
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 232 and g > 232 and b > 232:
                px[x, y] = (r, g, b, 0)
            elif r > 215 and g > 215 and b > 215 and abs(r - g) < 10 and abs(g - b) < 10:
                px[x, y] = (r, g, b, 0)
    return im


def trim_and_center(cell):
    cell = bg_to_alpha(cell)
    bbox = cell.getbbox()
    if not bbox:
        return None
    cropped = cell.crop(bbox)
    cw, ch = cropped.size
    mx = int(cw * 0.10)
    focus = cropped.crop((mx, 0, max(mx + 1, cw - mx), ch))
    bbox2 = focus.getbbox()
    if bbox2:
        focus = focus.crop(bbox2)
    fw, fh = focus.size
    inner = CANVAS - PADDING * 2
    scale = min(inner / fw, inner / fh)
    nw, nh = max(1, int(fw * scale)), max(1, int(fh * scale))
    resized = focus.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(resized, ((CANVAS - nw) // 2, CANVAS - nh - PADDING // 2), resized)
    return canvas


def export_poses(src_path):
    img = Image.open(src_path).convert('RGBA')
    w, h = img.size
    grid_top, grid_left, grid_right, grid_bottom = 118, 8, w - 8, h - 8
    cols, rows = 4, 5
    cell_w = (grid_right - grid_left) // cols
    cell_h = (grid_bottom - grid_top) // rows
    os.makedirs(OUT, exist_ok=True)
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= len(NAMES):
                break
            x0 = grid_left + c * cell_w
            y0 = grid_top + r * cell_h
            cell = img.crop((x0, y0, x0 + cell_w, y0 + cell_h))
            out = trim_and_center(cell)
            if out:
                out.save(os.path.join(OUT, NAMES[idx] + '.png'), optimize=True)
                print('wrote', NAMES[idx])
            idx += 1


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    export_poses(src)
