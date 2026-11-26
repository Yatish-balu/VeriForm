"""
Quick CLI helper to test Gemini Vision extraction on a local image or PDF.

Usage:
    python scripts/try_extract.py path/to/bform.jpg
"""
from __future__ import annotations

import asyncio
import json
import mimetypes
import sys
from dataclasses import asdict
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure backend/.env is loaded even when invoked outside backend/
env_path = BACKEND_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)

from app.services.gemini_extraction import extract_form  # noqa: E402

_MIME_MAP = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _detect_mime(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in _MIME_MAP:
        return _MIME_MAP[ext]
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "image/jpeg"


async def _run(file_path: Path) -> None:
    content_type = _detect_mime(file_path)
    file_bytes = file_path.read_bytes()
    result = await extract_form(file_bytes, content_type)
    print(json.dumps(asdict(result), indent=2, default=str))


def main() -> None:
    if len(sys.argv) < 2:
        print(f"Usage: python {Path(sys.argv[0]).name} <image_or_pdf_path>", file=sys.stderr)
        sys.exit(1)

    target = Path(sys.argv[1]).expanduser().resolve()
    if not target.is_file():
        print(f"Error: file not found: {target}", file=sys.stderr)
        sys.exit(1)

    asyncio.run(_run(target))


if __name__ == "__main__":
    main()
