#!/usr/bin/env python3
"""Generate placeholder RGBA PNG icons for the Tauri shell.

No image libraries required. Produces a simple shield-ish mark on a solid
background. Swap in real artwork later (e.g. via `tauri icon brand.png`).
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

#: (size, filename) pairs expected by the Tauri bundle config.
ICONS = [
    (32, "32x32.png"),
    (128, "128x128.png"),
    (256, "128x128@2x.png"),
    (512, "icon.png"),
]

BG = (17, 24, 39)  # slate-900
FG = (52, 211, 153)  # emerald-400, shield
FD = (255, 255, 255)  # check mark


def _crc(chunk_type: bytes, data: bytes) -> bytes:
    return struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)


def _png(width: int, height: int, rows: list[bytes]) -> bytes:
    signature = b"\x89PNG\r\n\x1a\n"

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + _crc(tag, data)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    out = signature + chunk(b"IHDR", ihdr)
    raw = b"".join(b"\x00" + row for row in rows)
    out += chunk(b"IDAT", zlib.compress(raw, 9))
    out += chunk(b"IEND", b"")
    return out


def make_icon(size: int) -> bytes:
    rows = [bytearray([*BG, 255]) * size for _ in range(size)]

    def px(x: int, y: int, color: tuple[int, int, int]) -> None:
        rows[y][x * 4 : x * 4 + 3] = bytes(color)

    # Simple shield shape centered in the canvas.
    cx = size // 2
    top = size // 8
    bottom = size - top
    half = size * 3 // 10
    for y in range(top, bottom):
        t = (y - top) / (bottom - top)
        # Curved sides: rows taper inward more toward the top of the shield.
        inset = max(0, half - int(half * (1 - t) ** 0.6))
        if inset <= 0:
            continue
        for x in range(cx - inset, cx + inset, 2):
            px(x, y, FG)

    # White check mark: vertical bar plus a diagonal arm.
    for y in range(top + size // 3, top + size * 3 // 5):
        for x in range(cx - size // 12, cx + size // 12):
            if 0 <= x < size and 0 <= y < size:
                px(x, y, FD)
    for n in range(size // 5):
        x = cx - size // 12 + n
        y = top + size * 3 // 5 + n - size // 24
        for k in range(size // 14):
            if 0 <= x + k < size and 0 <= y < size:
                px(x + k, y, FD)

    return _png(size, size, [bytes(row) for row in rows])


def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent / "apps/desktop/src-tauri/icons"
    out_dir.mkdir(parents=True, exist_ok=True)
    for size, filename in ICONS:
        (out_dir / filename).write_bytes(make_icon(size))
        print(f"wrote {out_dir / filename} ({size}x{size})")


if __name__ == "__main__":
    main()
