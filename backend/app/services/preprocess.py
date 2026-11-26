"""
VeriForm — Image Pre-processor
Fixes EXIF rotation, resizes to max 2000 px on the longest side,
and returns a Laplacian blur score (OpenCV).

Only called for raster uploads (JPEG/PNG).
PDF uploads bypass this module entirely and go straight to Gemini.
"""
from __future__ import annotations

import io
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps

MAX_SIDE = 2_000   # pixels — longest edge cap sent to Gemini


@dataclass
class PreprocessResult:
    image_bytes: bytes  # JPEG bytes, rotation-corrected & resized
    blur_score: float   # Laplacian variance; <100 is likely blurry


def preprocess_image(raw_bytes: bytes) -> PreprocessResult:
    """
    1. Open with Pillow and auto-apply EXIF orientation tag.
    2. Resize so the longest side ≤ MAX_SIDE (bicubic, aspect-preserved).
    3. Re-encode to JPEG at quality 92.
    4. Compute OpenCV Laplacian variance for blur detection.

    Returns a PreprocessResult with corrected JPEG bytes and blur_score.
    Raises ValueError if the bytes cannot be decoded as an image.
    """
    # ── 1. EXIF rotation ─────────────────────────────────────────────────────
    try:
        pil_img = Image.open(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise ValueError(f"Cannot open image bytes: {exc}") from exc

    pil_img = ImageOps.exif_transpose(pil_img)   # handles all 8 EXIF orientations

    # Normalise colour mode (e.g. RGBA / P / CMYK → RGB)
    if pil_img.mode not in ("RGB", "L"):
        pil_img = pil_img.convert("RGB")

    # ── 2. Resize ─────────────────────────────────────────────────────────────
    w, h = pil_img.size
    longest = max(w, h)
    if longest > MAX_SIDE:
        scale = MAX_SIDE / longest
        pil_img = pil_img.resize(
            (max(1, int(w * scale)), max(1, int(h * scale))),
            Image.BICUBIC,
        )

    # ── 3. Re-encode as JPEG ──────────────────────────────────────────────────
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=92, optimize=True)
    jpeg_bytes = buf.getvalue()

    # ── 4. Blur score (Laplacian variance) ───────────────────────────────────
    np_arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    cv_img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
    if cv_img is None:
        # Extremely unlikely after a successful Pillow save, but guard anyway
        blur_score = 0.0
    else:
        blur_score = float(cv2.Laplacian(cv_img, cv2.CV_64F).var())

    return PreprocessResult(image_bytes=jpeg_bytes, blur_score=blur_score)
