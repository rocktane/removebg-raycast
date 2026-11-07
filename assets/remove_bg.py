#!/usr/bin/env python3

import itertools
import json
import os
import subprocess
import sys
import tempfile
from io import BytesIO
from pathlib import Path

SIPS = "/usr/bin/sips"
HEIF_EXTENSIONS = {".heic", ".heif"}


def read_image(input_path):
    """Return image bytes that rembg can open."""
    if Path(input_path).suffix.lower() not in HEIF_EXTENSIONS:
        return Path(input_path).read_bytes()

    # Pillow can't open HEIF on its own, and macOS always ships sips
    with tempfile.TemporaryDirectory() as temp_dir:
        converted = os.path.join(temp_dir, "converted.png")
        result = subprocess.run(
            [SIPS, "-s", "format", "png", input_path, "--out", converted],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not os.path.exists(converted):
            # sips ends with a usage hint: the first line is the actual error
            reason = (result.stderr.strip().splitlines() or ["unknown error"])[0]
            raise ValueError(f"sips could not convert the image: {reason}")
        return Path(converted).read_bytes()


def encode_output(output_data, output_ext):
    if output_ext != ".webp":
        return output_data

    # For WebP, we need to use PIL to save with proper settings
    from PIL import Image

    encoded = BytesIO()
    Image.open(BytesIO(output_data)).save(encoded, "WEBP", lossless=True)
    return encoded.getvalue()


def save_without_overwriting(input_path, encoded):
    """Write next to the input as name-bg, name-bg-2, ... and return the path."""
    source = Path(input_path)
    output_ext = output_extension(input_path)

    for index in itertools.count(1):
        suffix = "-bg" if index == 1 else f"-bg-{index}"
        output_path = source.with_name(f"{source.stem}{suffix}{output_ext}")
        try:
            # Exclusive creation, so even another run can't take the same name
            with open(output_path, "xb") as output_file:
                try:
                    output_file.write(encoded)
                except OSError:
                    output_path.unlink(missing_ok=True)
                    raise
            return str(output_path)
        except FileExistsError:
            continue


def output_extension(input_path):
    # Only PNG and WebP keep their format: the others can't hold transparency here
    ext = Path(input_path).suffix.lower()
    return ext if ext in {".png", ".webp"} else ".png"


def report(**result):
    print(json.dumps(result), flush=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: remove_bg.py <input_image> [<input_image> ...]", file=sys.stderr)
        sys.exit(1)

    try:
        from rembg import new_session, remove
    except ImportError as e:
        print(f"Error: Required module not installed - {e}", file=sys.stderr)
        print("Please install with: uv pip install -r requirements.txt", file=sys.stderr)
        sys.exit(1)

    try:
        # Name the model: recent rembg defaults to bria-rmbg, about 30x slower here
        session = new_session("u2net")
    except Exception as e:
        print(f"Error loading the model: {e}", file=sys.stderr)
        sys.exit(1)

    # One line per image: a bad file must not cost the rest of the selection
    for input_path in sys.argv[1:]:
        try:
            output_data = remove(read_image(input_path), session=session)
            encoded = encode_output(output_data, output_extension(input_path))
            report(input=input_path, output=save_without_overwriting(input_path, encoded))
        except Exception as e:
            report(input=input_path, error=f"Error processing image: {e}")


if __name__ == "__main__":
    main()
