#!/usr/bin/env python3

import sys
import os
from pathlib import Path
from io import BytesIO

def main():
    if len(sys.argv) != 3:
        print("Usage: remove_bg.py <input_image> <output_image>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' not found")
        sys.exit(1)

    try:
        from rembg import remove
        from PIL import Image
    except ImportError as e:
        print(f"Error: Required module not installed - {e}")
        print("Please install with: uv pip install -r requirements.txt")
        sys.exit(1)

    try:
        # Open the image
        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()

        # Remove background
        output_data = remove(input_data)

        # Save the result based on output format
        output_ext = Path(output_path).suffix.lower()

        if output_ext == '.webp':
            # For WebP, we need to use PIL to save with proper settings
            img = Image.open(BytesIO(output_data))
            img.save(output_path, 'WEBP', lossless=True)
        else:
            # For PNG and other formats, save directly
            with open(output_path, 'wb') as output_file:
                output_file.write(output_data)

        # Verify the output was created
        if os.path.exists(output_path):
            print(f"Success: Background removed and saved to {output_path}")
        else:
            print("Error: Failed to create output file")
            sys.exit(1)

    except Exception as e:
        print(f"Error processing image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()