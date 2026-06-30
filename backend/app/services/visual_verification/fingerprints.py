"""Perceptual fingerprints (Pillow-only — no numpy/imagehash needed).

average-hash + difference-hash for near-duplicate / reused-image detection, plus
dominant colors. Hashes are hex strings; compare with hamming() (0 = identical).
"""
from io import BytesIO


def _bits_to_hex(bits: str) -> str:
    return f"{int(bits, 2):0{max(1, len(bits) // 4)}x}" if bits else ""


def compute(img_bytes: bytes) -> dict:
    try:
        from PIL import Image
        g = Image.open(BytesIO(img_bytes)).convert("L")

        # average hash (8x8)
        s = g.resize((8, 8))
        px = list(s.getdata())
        avg = sum(px) / len(px) if px else 0
        ahash = "".join("1" if p > avg else "0" for p in px)

        # difference hash (9x8 → 8x8 comparisons)
        d = g.resize((9, 8))
        dp = list(d.getdata())
        dbits = ""
        for r in range(8):
            for c in range(8):
                dbits += "1" if dp[r * 9 + c] > dp[r * 9 + c + 1] else "0"

        # dominant colors (downsample → most common)
        rgb = Image.open(BytesIO(img_bytes)).convert("RGB").resize((48, 48))
        from collections import Counter
        common = Counter(rgb.getdata()).most_common(3)
        dominant = ["#%02x%02x%02x" % c for c, _ in common]

        return {"ahash": _bits_to_hex(ahash), "dhash": _bits_to_hex(dbits),
                "phash": _bits_to_hex(dbits), "dominant_colors": dominant}
    except Exception as e:
        return {"error": str(e)[:100]}


def hamming(a: str, b: str) -> int:
    """Hamming distance between two equal-length hex hashes (lower = more similar)."""
    if not a or not b or len(a) != len(b):
        return 999
    try:
        x = int(a, 16) ^ int(b, 16)
        return bin(x).count("1")
    except Exception:
        return 999


def similarity_pct(a: str, b: str, bits: int = 64) -> int:
    h = hamming(a, b)
    if h >= 900:
        return 0
    return round((1 - h / bits) * 100)
